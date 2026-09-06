/**
 * Event store for geospatial world events.
 * Includes deduplication helpers (title normalization + lat/lon rounding + day bucket).
 */

const EVENT_TYPES = Object.freeze([
  'CONFLICT',
  'MILITARY_ACTIVITY',
  'PROTEST',
  'POLITICAL',
  'DIPLOMATIC',
  'SANCTIONS',
  'TRADE',
  'INFRASTRUCTURE',
  'AVIATION',
  'MARITIME',
  'CYBER_OUTAGE',
  'EARTHQUAKE',
  'WILDFIRE',
  'VOLCANO',
  'WEATHER',
  'HUMANITARIAN',
  'SPACE',
  'TRANSPORT',
  'ENVIRONMENT',
]);

const SEVERITY_LEVELS = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const haversineKm = (lat1, lon1, lat2, lon2) => {
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

const normalizeTitle = (title) => {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const roundLatLon = (lat, lon, decimals) => {
  const d = Math.pow(10, Number(decimals) || 0);
  const rLat = Math.round((Number(lat) || 0) * d) / d;
  const rLon = Math.round((Number(lon) || 0) * d) / d;
  return { lat: rLat, lon: rLon };
};

const dayBucket = (timestamp) => {
  const ts = Number(timestamp) || Date.now();
  return Math.floor(ts / 86400000);
};

const buildDeduplicationKey = (title, lat, lon, timestamp) => {
  const nt = normalizeTitle(title);
  const r = roundLatLon(lat, lon, 2);
  const db = dayBucket(timestamp);
  return `${nt}|${r.lat},${r.lon}|${db}`;
};

class EventStoreImpl {
  constructor() {
    /** @type {Map<string, object>} id -> event */
    this._events = new Map();
    /** @type {Map<string, string>} countryIso2 -> [event ids] */
    this._byCountry = new Map();
    /** @type {Map<string, object>} dedupKey -> eventId */
    this._dedupIndex = new Map();
  }

  _indexCountry(event) {
    const iso = event.location && event.location.countryIso2;
    if (!iso) return;
    const key = iso.toUpperCase();
    if (!this._byCountry.has(key)) this._byCountry.set(key, new Set());
    this._byCountry.get(key).add(event.id);
  }

  _unindexCountry(iso, id) {
    if (!iso) return;
    const set = this._byCountry.get(iso.toUpperCase());
    if (set) {
      set.delete(id);
      if (set.size === 0) this._byCountry.delete(iso.toUpperCase());
    }
  }

  static allTypes() {
    return [...EVENT_TYPES];
  }

  upsert(id, data = {}) {
    if (!id || typeof id !== 'string') {
      throw new Error('EventStore.upsert(): id must be a non-empty string');
    }
    const existing = this._events.get(id);
    if (existing) {
      this._unindexCountry(existing.location && existing.location.countryIso2, id);
      const oldKey = existing.deduplicationKey;
      if (oldKey && this._dedupIndex.get(oldKey) === id) {
        this._dedupIndex.delete(oldKey);
      }
    }
    const now = Date.now();
    const loc = data.location && typeof data.location === 'object'
      ? {
          lat: data.location.lat != null ? Number(data.location.lat) : null,
          lon: data.location.lon != null ? Number(data.location.lon) : null,
          placeName: data.location.placeName ? String(data.location.placeName) : null,
          countryIso2: data.location.countryIso2 ? String(data.location.countryIso2).toUpperCase() : null,
          admin1: data.location.admin1 ? String(data.location.admin1) : null,
        }
      : { lat: null, lon: null, placeName: null, countryIso2: null, admin1: null };

    const evType = data.type && EVENT_TYPES.includes(data.type) ? data.type : 'ENVIRONMENT';
    const sev = data.severity && SEVERITY_LEVELS.includes(data.severity) ? data.severity : 'LOW';
    const ts = Number(data.timestamp) || now;

    const dedupKey = data.deduplicationKey || buildDeduplicationKey(
      data.title || '',
      loc.lat,
      loc.lon,
      ts,
    );

    const merged = {
      id,
      type: evType,
      title: data.title ? String(data.title) : '',
      summary: data.summary ? String(data.summary) : '',
      location: Object.freeze(loc),
      timestamp: ts,
      sources: Array.isArray(data.sources) ? data.sources.map((s) => ({ ...s })) : [],
      actors: Array.isArray(data.actors) ? [...data.actors] : [],
      confidence: Math.max(0, Math.min(100, Number(data.confidence) ?? 50)),
      severity: sev,
      relatedIds: Array.isArray(data.relatedIds) ? [...data.relatedIds] : [],
      url: data.url ? String(data.url) : null,
      deduplicationKey: dedupKey,
      escalationScore: data.escalationScore != null ? Number(data.escalationScore) : 0,
      firstSeen: existing ? existing.firstSeen : ts,
      lastUpdate: now,
    };

    const frozen = Object.freeze(merged);
    this._events.set(id, frozen);
    this._indexCountry(frozen);
    if (dedupKey) this._dedupIndex.set(dedupKey, id);
    return frozen;
  }

  get(id) {
    return this._events.get(id) || null;
  }

  list(filterFn) {
    const all = Array.from(this._events.values());
    if (typeof filterFn !== 'function') return all;
    return all.filter(filterFn);
  }

  // Compatibility projection for map controllers. Keep this as an alias of
  // list() so callers always receive the canonical, immutable event records.
  getAll(filterFn) {
    return this.list(filterFn);
  }

  search(queryText) {
    const q = normalizeTitle(queryText);
    if (!q) return [];
    const terms = q.split(/\s+/).filter((t) => t.length >= 2);
    if (terms.length === 0) return [];
    const out = [];
    for (const ev of this._events.values()) {
      const blob = normalizeTitle(`${ev.title} ${ev.summary} ${ev.location?.placeName || ''}`);
      let matches = 0;
      for (const t of terms) {
        if (blob.includes(t)) matches++;
      }
      if (matches > 0) {
        out.push({ event: ev, score: matches / terms.length });
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out.map((r) => r.event);
  }

  deleteOlderThan(ageMs) {
    const cutoff = Date.now() - Number(ageMs || 0);
    const removed = [];
    for (const [id, ev] of this._events) {
      if (ev.timestamp < cutoff) {
        this._unindexCountry(ev.location && ev.location.countryIso2, id);
        if (ev.deduplicationKey && this._dedupIndex.get(ev.deduplicationKey) === id) {
          this._dedupIndex.delete(ev.deduplicationKey);
        }
        this._events.delete(id);
        removed.push(id);
      }
    }
    return removed;
  }

  getByCountry(countryIso2) {
    if (!countryIso2) return [];
    const set = this._byCountry.get(String(countryIso2).toUpperCase());
    if (!set) return [];
    const out = [];
    for (const id of set) {
      const ev = this._events.get(id);
      if (ev) out.push(ev);
    }
    return out;
  }

  getNearby(lat, lon, radiusKm) {
    const latNum = Number(lat);
    const lonNum = Number(lon);
    const r = Number(radiusKm) || 0;
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || r <= 0) return [];
    const scored = [];
    for (const ev of this._events.values()) {
      const L = ev.location;
      if (!L || L.lat == null || L.lon == null) continue;
      const d = haversineKm(latNum, lonNum, L.lat, L.lon);
      if (d <= r) scored.push({ event: ev, distanceKm: d });
    }
    scored.sort((a, b) => a.distanceKm - b.distanceKm);
    return scored.map((r) => r.event);
  }
}

const EventStore = new EventStoreImpl();

export default EventStore;
export {
  EventStoreImpl,
  EVENT_TYPES,
  SEVERITY_LEVELS,
  normalizeTitle,
  roundLatLon,
  dayBucket,
  buildDeduplicationKey,
  haversineKm,
};
