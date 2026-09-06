/**
 * Deduplication engine for incoming events.
 * Uses a Jaccard token-similarity score, spatial proximity (100km),
 * and time window (24h) to decide merge vs new event.
 */

const STOPWORDS = Object.freeze(new Set([
  'the', 'a', 'an', 'of', 'to', 'and', 'in', 'is', 'was', 'be', 'are',
  'for', 'on', 'with', 'that', 'this', 'at', 'by', 'from', 'as', 'it',
  'or', 'not', 'their', 'can', 'has', 'have', 'had', 'will', 'would',
  'they', 'you', 'his', 'her', 'its', 'but', 'also', 'after', 'before',
  'over', 'under', 'into', 'more', 'than', 'about', 'up', 'out', 'all',
  'said', 'says', 'say', 'new', 'after', 'other', 'some', 'what', 'when',
  'where', 'who', 'which', 'why', 'how', 'been', 'being', 'if', 'then',
  'so', 'no', 'yes', 'just', 'very', 'two', 'one', 'first', 'last',
  'now', 'any', 'only', 'most', 'such', 'than', 'there', 'here', 'like',
]));

const haversineKm = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const tokenSet = (str) => {
  const raw = String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  return new Set(raw);
};

const similarityScore = (str1, str2) => {
  const s1 = tokenSet(str1);
  const s2 = tokenSet(str2);
  if (s1.size === 0 && s2.size === 0) return 0;
  if (s1.size === 0 || s2.size === 0) return 0;
  let inter = 0;
  for (const t of s1) {
    if (s2.has(t)) inter++;
  }
  const union = s1.size + s2.size - inter;
  return union === 0 ? 0 : inter / union;
};

class DedupEngineImpl {
  constructor() {
    /** @type {Map<string, string>} dedupKey -> eventId */
    this._index = new Map();
    this._spatialRadiusKm = 100;
    this._timeWindowMs = 86400000;
    this._titleSimThreshold = 0.55;
  }

  register(eventId, dedupKey) {
    if (!eventId || !dedupKey) return;
    this._index.set(String(dedupKey), String(eventId));
  }

  unregister(dedupKey) {
    this._index.delete(String(dedupKey));
  }

  shouldDeduplicate(incomingEvent, existingEvents) {
    const result = { shouldMerge: false, matchingEventId: null, mergeStrategy: null };
    if (!incomingEvent) return result;
    const inc = incomingEvent;
    const incKey = inc.deduplicationKey;
    if (incKey && this._index.has(incKey)) {
      result.shouldMerge = true;
      result.matchingEventId = this._index.get(incKey);
      result.mergeStrategy = 'dedupKey';
      return result;
    }
    const pool = Array.isArray(existingEvents) ? existingEvents : [];
    if (pool.length === 0) return result;
    const incLat = inc.location && inc.location.lat;
    const incLon = inc.location && inc.location.lon;
    const incTs = inc.timestamp || Date.now();
    const incTitle = inc.title || '';
    for (const ex of pool) {
      if (!ex || !ex.id) continue;
      if (inc.id && ex.id === inc.id) continue;
      const exLat = ex.location && ex.location.lat;
      const exLon = ex.location && ex.location.lon;
      const dist = haversineKm(incLat, incLon, exLat, exLon);
      if (dist > this._spatialRadiusKm) continue;
      const exTs = ex.timestamp || Date.now();
      const dt = Math.abs(incTs - exTs);
      if (dt > this._timeWindowMs) continue;
      const sim = similarityScore(incTitle, ex.title || '');
      if (sim >= this._titleSimThreshold) {
        result.shouldMerge = true;
        result.matchingEventId = ex.id;
        result.mergeStrategy = 'similarity';
        return result;
      }
      if (incKey && incKey === ex.deduplicationKey) {
        result.shouldMerge = true;
        result.matchingEventId = ex.id;
        result.mergeStrategy = 'dedupKey';
        return result;
      }
    }
    return result;
  }

  merge(incoming, existing) {
    if (!existing) return { ...incoming };
    const allSources = [];
    const seenUrls = new Set();
    for (const s of [...(existing.sources || []), ...(incoming.sources || [])]) {
      const u = s && s.url ? String(s.url) : `${s && s.provider}|${s && s.name}`;
      if (seenUrls.has(u)) continue;
      seenUrls.add(u);
      allSources.push({ ...s });
    }
    const actorsUnion = Array.from(new Set([
      ...(existing.actors || []),
      ...(incoming.actors || []),
    ]));
    const relatedUnion = Array.from(new Set([
      ...(existing.relatedIds || []),
      ...(incoming.relatedIds || []),
    ]));
    const earliestTs = Math.min(
      existing.timestamp || Date.now(),
      incoming.timestamp || Date.now(),
    );
    const maxConf = Math.max(
      existing.confidence || 0,
      incoming.confidence || 0,
    );
    const maxEsc = Math.max(
      existing.escalationScore || 0,
      incoming.escalationScore || 0,
    );
    const sevRank = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
    const exSev = sevRank[existing.severity] ?? 0;
    const inSev = sevRank[incoming.severity] ?? 0;
    const sevEntries = Object.entries(sevRank);
    const targetRank = Math.max(exSev, inSev);
    let severity = 'LOW';
    for (const [name, r] of sevEntries) {
      if (r === targetRank) { severity = name; break; }
    }
    return {
      ...existing,
      title: (existing.title && existing.title.length >= (incoming.title || '').length) ? existing.title : incoming.title,
      summary: (existing.summary || '').length >= (incoming.summary || '').length ? existing.summary : incoming.summary,
      sources: allSources,
      actors: actorsUnion,
      relatedIds: relatedUnion,
      timestamp: earliestTs,
      confidence: maxConf,
      severity,
      escalationScore: maxEsc,
      lastUpdate: Date.now(),
      url: existing.url || incoming.url,
    };
  }
}

const DedupEngine = new DedupEngineImpl();

export default DedupEngine;
export { DedupEngineImpl, similarityScore, tokenSet, STOPWORDS, haversineKm };
