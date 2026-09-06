/**
 * IngestPipeline orchestrates the normalization -> geocode -> classify ->
 * dedup -> score -> upsert -> emit flow for raw articles and bulk batches.
 * Exposes lifecycle hooks for tracing / inspection.
 */

import EventStore from '../world-model/events.js';
import EntityStore from '../world-model/entities.js';
import RelationshipGraph from '../world-model/relationships.js';
import ProviderHealth from '../world-model/sources.js';
import EventBus from './bus.js';
import normalizeRawArticle from './normalize.js';
import geocodeText from './geocode.js';
import { classify, classifySeverity } from './classify.js';
import DedupEngine from './dedup.js';
import CorrelateEngine from './correlate.js';
import { computeEventScore } from './score.js';

if (typeof RelationshipGraph._bindStores === 'function') {
  RelationshipGraph._bindStores(EventStore, EntityStore);
}
if (typeof CorrelateEngine._bindStore === 'function') {
  CorrelateEngine._bindStore(EventStore);
}

const makeEventId = (seed) => {
  const rand = Math.random().toString(36).slice(2, 10);
  const t = Date.now().toString(36);
  const base = seed ? String(seed).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) : '';
  return `ev_${base || 'art'}_${t}${rand}`;
};

class IngestPipelineImpl {
  constructor() {
    /** @type {Map<string, Function[]>} */
    this._hooks = new Map();
  }

  addHook(stage, cb) {
    if (typeof cb !== 'function') return () => {};
    const s = String(stage);
    if (!this._hooks.has(s)) this._hooks.set(s, []);
    this._hooks.get(s).push(cb);
    return () => {
      const arr = this._hooks.get(s);
      if (!arr) return;
      const idx = arr.indexOf(cb);
      if (idx >= 0) arr.splice(idx, 1);
    };
  }

  _runHooks(stage, payload) {
    const arr = this._hooks.get(String(stage));
    if (!arr) return payload;
    let current = payload;
    for (const cb of arr) {
      try {
        const out = cb(current);
        if (out !== undefined) current = out;
      } catch (err) {
        console.warn(`[IngestPipeline] hook(${stage}):`, err.message);
      }
    }
    return current;
  }

  _toEventShape(candidate) {
    const classified = classify(candidate.title, candidate.summary, candidate.tags);
    const afterClassify = this._runHooks('afterClassify', { candidate, classified });
    const title = afterClassify.candidate.title;
    const summary = afterClassify.candidate.summary || title;
    const publishedAt = Number(afterClassify.candidate.publishedAt) || Date.now();
    let loc;
    if (
      Number.isFinite(afterClassify.candidate.lat) &&
      Number.isFinite(afterClassify.candidate.lon)
    ) {
      loc = {
        lat: afterClassify.candidate.lat,
        lon: afterClassify.candidate.lon,
        placeName: afterClassify.candidate.locationText || null,
        countryIso2: null,
        admin1: null,
      };
      const fromText = afterClassify.candidate.locationText
        ? geocodeText(afterClassify.candidate.locationText)
        : null;
      if (fromText && fromText.confidence >= 60) {
        loc.countryIso2 = fromText.countryIso2 || loc.countryIso2;
        loc.admin1 = fromText.admin1 || loc.admin1;
        loc.placeName = fromText.placeName || loc.placeName;
      }
    } else if (afterClassify.candidate.locationText) {
      const gc = geocodeText(afterClassify.candidate.locationText);
      loc = {
        lat: gc.lat,
        lon: gc.lon,
        placeName: gc.placeName,
        countryIso2: gc.countryIso2,
        admin1: gc.admin1,
      };
    } else {
      loc = { lat: null, lon: null, placeName: null, countryIso2: null, admin1: null };
    }
    const conf = Math.max(
      10,
      Math.min(
        100,
        Math.round((Number(afterClassify.candidate.confidence) || 20) * 0.6 + afterClassify.classified.confidence * 0.4),
      ),
    );
    const severity = classifySeverity(conf, `${title} ${summary}`);
    const sourceEntry = {
      provider: afterClassify.candidate.sourceName || 'unknown',
      name: afterClassify.candidate.sourceName || 'unknown',
      url: afterClassify.candidate.url || null,
      fetchedAt: Date.now(),
    };
    return {
      title,
      summary,
      type: afterClassify.classified.type,
      location: loc,
      timestamp: publishedAt,
      sources: [sourceEntry],
      actors: [],
      confidence: conf,
      severity,
      relatedIds: [],
      url: afterClassify.candidate.url || null,
      escalationScore: 0,
    };
  }

  ingestArticle(rawArticle) {
    const before = this._runHooks('beforeNormalize', rawArticle);
    const normalized = normalizeRawArticle(before);
    const seed = normalized.url || normalized.title;
    const eventShape = this._toEventShape(normalized);
    const existingPool = EventStore.list();
    const dedupDecision = DedupEngine.shouldDeduplicate(eventShape, existingPool);
    this._runHooks('afterDedup', { eventShape, dedupDecision });
    let eventId;
    let upserted;
    let isNew = true;
    if (dedupDecision.shouldMerge && dedupDecision.matchingEventId) {
      const existing = EventStore.get(dedupDecision.matchingEventId);
      if (existing) {
        const merged = DedupEngine.merge(eventShape, existing);
        eventId = existing.id;
        isNew = false;
        upserted = EventStore.upsert(eventId, merged);
      }
    }
    if (!upserted) {
      eventId = makeEventId(seed);
      upserted = EventStore.upsert(eventId, eventShape);
    }
    DedupEngine.register(upserted.id, upserted.deduplicationKey);
    const score = computeEventScore(upserted);
    const scored = EventStore.upsert(upserted.id, { ...upserted, escalationScore: score });
    const { relatedEvents, relationships } = CorrelateEngine.findRelated(scored);
    if (relatedEvents.length > 0) {
      const updatedIds = [...relatedEvents.map((e) => e.id), scored.id];
      EventStore.upsert(scored.id, { ...scored, relatedIds: updatedIds.filter((id) => id !== scored.id) });
    }
    for (const rel of relationships) {
      try {
        RelationshipGraph.relate(rel.fromId, rel.toId, rel.type, rel.metadata);
      } catch (err) {
        console.warn('[IngestPipeline] relate skip:', err.message);
      }
    }
    const finalEvent = EventStore.get(scored.id) || scored;
    try {
      EntityStore.upsert(`ev_ent_${finalEvent.id}`, {
        type: 'event',
        lat: finalEvent.location && finalEvent.location.lat,
        lon: finalEvent.location && finalEvent.location.lon,
        alt: null,
        heading: 0,
        speed: 0,
        source: finalEvent.sources && finalEvent.sources[0] ? finalEvent.sources[0].provider : 'unknown',
        freshness: 'estimated',
        metadata: { eventId: finalEvent.id, eventType: finalEvent.type },
        countryIso2: finalEvent.location && finalEvent.location.countryIso2,
        confidence: finalEvent.confidence,
      });
    } catch (err) {
      console.warn('[IngestPipeline] entity sync skip:', err.message);
    }
    if (isNew) {
      EventBus.emit('event:new', finalEvent);
    } else {
      EventBus.emit('event:update', finalEvent);
    }
    return finalEvent;
  }

  ingestBulk(articles) {
    if (!Array.isArray(articles)) return [];
    const out = [];
    for (const raw of articles) {
      try {
        out.push(this.ingestArticle(raw));
      } catch (err) {
        console.warn('[IngestPipeline] bulk skip:', err.message);
      }
    }
    if (out.length > 0) {
      EventBus.emit('event:bulk', out);
    }
    return out;
  }
}

const IngestPipeline = new IngestPipelineImpl();

export default IngestPipeline;
export { IngestPipelineImpl, makeEventId };
