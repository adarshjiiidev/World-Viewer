/**
 * RSS / Atom news feed adapter.
 * Implements the Provider pattern: connect/disconnect/fetch/normalize/health.
 * Parses RSS/Atom via DOMParser when available in browser-like environments.
 * Falls back gracefully when CORS or parsing fails.
 */

import ProviderHealth from '../../world-model/sources.js';
import EventBus from '../../events/bus.js';
import { normalizeRawArticle } from '../../events/normalize.js';
import IngestPipeline from '../../events/ingest.js';
import { WORLD_MONITOR_FEEDS } from './worldMonitorFeeds.js';

const DEFAULT_FEEDS = WORLD_MONITOR_FEEDS;

const PROVIDER_ID = 'rss-adapter';
const DEFAULT_INTERVAL_MS = 60000;

const textOf = (el, selectors) => {
  if (!el) return '';
  for (const sel of selectors) {
    const node = el.querySelector(sel);
    if (node && node.textContent) {
      return node.textContent.trim();
    }
  }
  return '';
};

const attrOf = (el, selectors, attr) => {
  if (!el) return '';
  for (const sel of selectors) {
    const node = el.querySelector(sel);
    if (node && node.getAttribute(attr)) {
      return node.getAttribute(attr);
    }
  }
  return '';
};

const parseRssXml = (xmlText, feedMeta) => {
  const out = [];
  if (!xmlText || typeof xmlText !== 'string') return out;
  if (typeof DOMParser === 'undefined') return out;
  let doc;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlText, 'application/xml');
  } catch (err) {
    console.warn('[RssAdapter] parse error:', err.message);
    return out;
  }
  if (!doc || !doc.documentElement) return out;
  const parseError = doc.querySelector('parsererror');
  if (parseError) return out;
  const items = doc.querySelectorAll('item, entry');
  for (const item of items) {
    const title = textOf(item, ['title']);
    const summary = textOf(item, ['description', 'summary', 'content']);
    const link = attrOf(item, ['link', 'id'], 'href') || textOf(item, ['link', 'id']);
    const pubRaw = textOf(item, ['pubDate', 'published', 'updated']);
    const categoryEls = item.querySelectorAll('category, category term');
    const tags = [];
    for (const cat of categoryEls) {
      const t = (cat.getAttribute('term') || cat.textContent || '').trim();
      if (t) tags.push(t);
    }
    if (!title && !summary) continue;
    out.push({
      title,
      summary,
      content: summary,
      url: link,
      sourceName: feedMeta ? feedMeta.name : 'rss',
      publishedAt: pubRaw || Date.now(),
      tags,
    });
  }
  return out;
};

class RssAdapterImpl {
  constructor() {
    this._feeds = [...DEFAULT_FEEDS];
    this._intervalMs = DEFAULT_INTERVAL_MS;
    this._timer = null;
    this._connected = false;
  }

  getFeeds() {
    return [...this._feeds];
  }

  addFeed(feed) {
    if (!feed || !feed.id || !feed.url) return false;
    this._feeds.push(Object.freeze({ ...feed }));
    return true;
  }

  removeFeed(id) {
    const before = this._feeds.length;
    this._feeds = this._feeds.filter((f) => f.id !== id);
    return this._feeds.length < before;
  }

  async fetchRss(feed) {
    if (!feed?.url) return '';
    const t0 = performance.now();
    try {
      // In Electron the loopback server brokers this reviewed feed list. It
      // avoids browser CORS failures and keeps the renderer from becoming an
      // unrestricted network client. Browser development falls back to the
      // original public URL when the dev proxy is not present.
      let res = await fetch(`/api/world-news?feed=${encodeURIComponent(feed.id)}`, { cache: 'no-store' });
      if (res.status === 404) res = await fetch(feed.url, { mode: 'cors', redirect: 'follow' });
      if (!res || !res.ok) {
        throw new Error(`HTTP ${res ? res.status : 'no response'}`);
      }
      const text = await res.text();
      const lat = Math.round(performance.now() - t0);
      ProviderHealth.heartbeat(PROVIDER_ID, lat);
      return text;
    } catch (err) {
      ProviderHealth.markError(PROVIDER_ID, err.message);
      return '';
    }
  }

  normalize(item) {
    return normalizeRawArticle(item);
  }

  async fetch() {
    if (!this._connected) {
      ProviderHealth.set(PROVIDER_ID, { status: 'offline', message: 'not connected' });
      return [];
    }
    const allRaw = [];
    let degraded = false;
    for (const feed of this._feeds) {
      const t0 = performance.now();
      try {
        const xmlText = await this.fetchRss(feed);
        if (!xmlText) {
          degraded = true;
          continue;
        }
        const items = parseRssXml(xmlText, feed);
        for (const it of items) {
          it.sourceName = it.sourceName || feed.name;
          allRaw.push(it);
        }
        const lat = Math.round(performance.now() - t0);
        ProviderHealth.set(feed.id, {
          status: 'online',
          latency: lat,
          lastUpdate: Date.now(),
          message: '',
        });
      } catch (err) {
        console.warn(`[RssAdapter] feed ${feed.id}:`, err.message);
        degraded = true;
        ProviderHealth.markError(feed.id, err.message);
      }
    }
    if (degraded) {
      ProviderHealth.set(PROVIDER_ID, { status: 'degraded', message: 'some feeds failed', lastUpdate: Date.now() });
    } else {
      ProviderHealth.set(PROVIDER_ID, { status: 'online', lastUpdate: Date.now(), message: '' });
    }
    const normalized = [];
    for (const raw of allRaw) {
      try {
        normalized.push(this.normalize(raw));
      } catch (err) {
        console.warn('[RssAdapter] normalize skip:', err.message);
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
      console.warn('[RssAdapter] tick error:', err.message);
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

const RssAdapter = new RssAdapterImpl();

export default RssAdapter;
export { RssAdapterImpl, DEFAULT_FEEDS, PROVIDER_ID as RSS_PROVIDER_ID, parseRssXml };
