/**
 * Lightweight GDELT news adapter.
 * Attempts the public GDELT GeoJSON endpoint first; falls back to a curated
 * list of international news RSS feeds if the endpoint is blocked (CORS).
 * Implements the same Provider pattern as RssAdapter.
 */

import ProviderHealth from '../../world-model/sources.js';
import EventBus from '../../events/bus.js';
import { normalizeRawArticle } from '../../events/normalize.js';
import IngestPipeline from '../../events/ingest.js';

const FALLBACK_FEEDS = Object.freeze([
  Object.freeze({ id: 'gdelt-nyt', name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' }),
  Object.freeze({ id: 'gdelt-guardian', name: 'Guardian World', url: 'https://www.theguardian.com/world/rss' }),
  Object.freeze({ id: 'gdelt-dw', name: 'Deutsche Welle', url: 'https://rss.dw.com/rdf/rss-en-world' }),
  Object.freeze({ id: 'gdelt-voa', name: 'VOA News', url: 'https://www.voanews.com/api/zmgqme$mrp' }),
  Object.freeze({ id: 'gdelt-ap', name: 'AP News', url: 'https://rsshub.app/apnews/topics/world-news' }),
]);

// Broad global query: the previous hard-coded `domain:isreview.org` filter
// almost always returned an empty map, leaving the hotspot engine with no
// geolocated input. Keep RSS as a separate source-diversity path.
const GDELT_GEO_ENDPOINT = 'https://api.gdeltproject.org/api/v2/geo/geo?query=world&mode=PointData&format=GeoJSON&maxrecords=250&timespan=1d';
const PROVIDER_ID = 'gdelt-adapter';
const DEFAULT_INTERVAL_MS = 120000;

const textOf = (el, selectors) => {
  if (!el) return '';
  for (const sel of selectors) {
    const node = el.querySelector(sel);
    if (node && node.textContent) return node.textContent.trim();
  }
  return '';
};

const parseRssXmlSimple = (xmlText, feedMeta) => {
  const out = [];
  if (!xmlText || typeof xmlText !== 'string') return out;
  if (typeof DOMParser === 'undefined') return out;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    if (!doc || !doc.documentElement) return out;
    if (doc.querySelector('parsererror')) return out;
    const items = doc.querySelectorAll('item, entry');
    for (const item of items) {
      const title = textOf(item, ['title']);
      const summary = textOf(item, ['description', 'summary', 'content']);
      const link = textOf(item, ['link', 'id']);
      const pubRaw = textOf(item, ['pubDate', 'published', 'updated']);
      if (!title && !summary) continue;
      out.push({
        title,
        summary,
        content: summary,
        url: link,
        sourceName: feedMeta ? feedMeta.name : 'gdelt',
        publishedAt: pubRaw || Date.now(),
        tags: [],
      });
    }
  } catch (err) {
    console.warn('[GdeltAdapter] fallback parse:', err.message);
  }
  return out;
};

const parseGdeltGeoJson = (rawText) => {
  const out = [];
  if (!rawText) return out;
  let parsed;
  try {
    parsed = typeof rawText === 'string' ? JSON.parse(rawText) : rawText;
  } catch (err) {
    return out;
  }
  const features = (parsed && Array.isArray(parsed.features)) ? parsed.features : [];
  for (const feat of features) {
    const p = feat && feat.properties ? feat.properties : {};
    const coords = feat && feat.geometry && Array.isArray(feat.geometry.coordinates) ? feat.geometry.coordinates : null;
    const title = p.title || p.name || p.headline || '';
    const summary = p.summary || p.description || p.content || '';
    if (!title && !summary) continue;
    const lat = coords && coords.length >= 2 ? coords[1] : null;
    const lon = coords && coords.length >= 2 ? coords[0] : null;
    out.push({
      title,
      summary,
      content: summary,
      url: p.url || p.link || p.sourceurl || null,
      sourceName: p.source || p.domain || 'gdelt',
      publishedAt: p.timestamp || p.datetime || p.date || Date.now(),
      lat,
      lon,
      locationText: p.location || p.country || p.adm1 || '',
      tags: Array.isArray(p.themes) ? p.themes : [],
    });
  }
  return out;
};

class GdeltAdapterImpl {
  constructor() {
    this._fallbackFeeds = [...FALLBACK_FEEDS];
    this._gdeltEndpoint = GDELT_GEO_ENDPOINT;
    this._intervalMs = DEFAULT_INTERVAL_MS;
    this._timer = null;
    this._connected = false;
    this._useFallback = false;
  }

  getFallbackFeeds() {
    return [...this._fallbackFeeds];
  }

  setEndpoint(url) {
    this._gdeltEndpoint = String(url || GDELT_GEO_ENDPOINT);
  }

  normalize(item) {
    return normalizeRawArticle(item);
  }

  async _tryGdeltGeo() {
    const t0 = performance.now();
    try {
      const res = await fetch(this._gdeltEndpoint, { mode: 'cors', redirect: 'follow' });
      if (!res || !res.ok) throw new Error(`HTTP ${res ? res.status : 'no response'}`);
      const text = await res.text();
      const lat = Math.round(performance.now() - t0);
      ProviderHealth.heartbeat(PROVIDER_ID, lat);
      const events = parseGdeltGeoJson(text);
      if (events.length > 0) {
        this._useFallback = false;
        return events;
      }
      throw new Error('no features');
    } catch (err) {
      this._useFallback = true;
      return null;
    }
  }

  async _tryFallback() {
    const allRaw = [];
    let anyOk = false;
    for (const feed of this._fallbackFeeds) {
      const t0 = performance.now();
      try {
        const res = await fetch(feed.url, { mode: 'cors', redirect: 'follow' });
        if (!res || !res.ok) {
          ProviderHealth.markError(feed.id, `HTTP ${res ? res.status : 'x'}`);
          continue;
        }
        const text = await res.text();
        const items = parseRssXmlSimple(text, feed);
        if (items.length > 0) anyOk = true;
        for (const it of items) allRaw.push(it);
        ProviderHealth.set(feed.id, {
          status: 'online',
          latency: Math.round(performance.now() - t0),
          lastUpdate: Date.now(),
          message: '',
        });
      } catch (err) {
        console.warn(`[GdeltAdapter] fallback feed ${feed.id}:`, err.message);
        ProviderHealth.markError(feed.id, err.message);
      }
    }
    if (anyOk) {
      ProviderHealth.set(PROVIDER_ID, { status: 'degraded', message: 'using fallback feeds', lastUpdate: Date.now() });
    } else {
      ProviderHealth.markError(PROVIDER_ID, 'all fallback feeds failed');
    }
    return allRaw;
  }

  async fetch() {
    if (!this._connected) {
      ProviderHealth.set(PROVIDER_ID, { status: 'offline', message: 'not connected' });
      return [];
    }
    const geo = await this._tryGdeltGeo();
    const allRaw = geo || (await this._tryFallback());
    const normalized = [];
    for (const raw of allRaw) {
      try {
        normalized.push(this.normalize(raw));
      } catch (err) {
        console.warn('[GdeltAdapter] normalize skip:', err.message);
      }
    }
    return normalized;
  }

  async _tick() {
    try {
      const candidates = await this.fetch();
      if (candidates.length > 0) {
        const ingested = IngestPipeline.ingestBulk(candidates);
        EventBus.emit('provider:health', { provider: PROVIDER_ID, ingested: ingested.length });
      }
    } catch (err) {
      console.warn('[GdeltAdapter] tick error:', err.message);
    }
  }

  connect(options = {}) {
    if (this._connected) return true;
    if (options.intervalMs && Number(options.intervalMs) > 0) {
      this._intervalMs = Number(options.intervalMs);
    }
    this._connected = true;
    ProviderHealth.set(PROVIDER_ID, {
      status: 'online',
      lastUpdate: Date.now(),
      message: 'connected',
    });
    if (typeof setTimeout !== 'undefined') {
      this._tick();
      this._timer = setInterval(() => this._tick(), this._intervalMs);
    }
    return true;
  }

  disconnect() {
    this._connected = false;
    if (this._timer != null) {
      clearInterval(this._timer);
      this._timer = null;
    }
    ProviderHealth.set(PROVIDER_ID, {
      status: 'offline',
      lastUpdate: Date.now(),
      message: 'disconnected',
    });
    return true;
  }

  health() {
    return ProviderHealth.get(PROVIDER_ID) || { status: 'offline', lastUpdate: 0 };
  }
}

const GdeltAdapter = new GdeltAdapterImpl();

export default GdeltAdapter;
export { GdeltAdapterImpl, FALLBACK_FEEDS, PROVIDER_ID as GDELT_PROVIDER_ID, parseGdeltGeoJson };
