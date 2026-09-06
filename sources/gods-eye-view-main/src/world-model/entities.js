/**
 * Entity store for geospatial objects (aircraft, ships, sensors, events, etc.).
 * Uses a Map keyed by entity id with a 1-degree lat/lon grid spatial index.
 */

const VALID_ENTITY_TYPES = Object.freeze([
  'aircraft',
  'ship',
  'satellite',
  'earthquake',
  'fire',
  'camera',
  'infrastructure',
  'event',
  'airport',
  'port',
  'country',
  'city',
  'region',
]);

const VALID_FRESHNESS = Object.freeze([
  'live',
  'recent',
  'delayed',
  'stale',
  'unavailable',
  'simulated',
  'estimated',
]);

const gridKey = (lat, lon) => {
  const latCell = Math.floor(Number(lat) || 0);
  const lonCell = Math.floor(Number(lon) || 0);
  return `${latCell}:${lonCell}`;
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

class EntityStoreImpl {
  constructor() {
    /** @type {Map<string, object>} id -> entity */
    this._entities = new Map();
    /** @type {Map<string, Set<string>>} gridKey -> Set of entity ids */
    this._grid = new Map();
  }

  _addToGrid(entity) {
    if (entity.lat == null || entity.lon == null) return;
    const key = gridKey(entity.lat, entity.lon);
    if (!this._grid.has(key)) this._grid.set(key, new Set());
    this._grid.get(key).add(entity.id);
  }

  _removeFromGrid(entity) {
    if (entity.lat == null || entity.lon == null) return;
    const key = gridKey(entity.lat, entity.lon);
    const bucket = this._grid.get(key);
    if (bucket) {
      bucket.delete(entity.id);
      if (bucket.size === 0) this._grid.delete(key);
    }
  }

  upsert(id, data = {}) {
    if (!id || typeof id !== 'string') {
      throw new Error('EntityStore.upsert(): id must be a non-empty string');
    }
    const existing = this._entities.get(id);
    if (existing) {
      this._removeFromGrid(existing);
    }
    const now = Date.now();
    const merged = {
      id,
      type: data.type && VALID_ENTITY_TYPES.includes(data.type) ? data.type : 'event',
      lat: Number(data.lat) ?? 0,
      lon: Number(data.lon) ?? 0,
      alt: data.alt != null ? Number(data.alt) : null,
      heading: data.heading != null ? Number(data.heading) : 0,
      speed: data.speed != null ? Number(data.speed) : 0,
      source: data.source ? String(data.source) : 'unknown',
      freshness: data.freshness && VALID_FRESHNESS.includes(data.freshness) ? data.freshness : 'estimated',
      metadata: data.metadata && typeof data.metadata === 'object' ? { ...data.metadata } : {},
      firstSeen: existing ? existing.firstSeen : (data.firstSeen || now),
      lastSeen: data.lastSeen || now,
      countryIso2: data.countryIso2 ? String(data.countryIso2).toUpperCase() : null,
      confidence: Math.max(0, Math.min(100, Number(data.confidence) ?? 50)),
    };
    const frozen = Object.freeze(merged);
    this._entities.set(id, frozen);
    this._addToGrid(frozen);
    return frozen;
  }

  bulkUpsert(items) {
    if (!Array.isArray(items)) return [];
    const out = [];
    for (const item of items) {
      if (!item || !item.id) continue;
      try {
        out.push(this.upsert(item.id, item));
      } catch (err) {
        console.warn('[EntityStore] bulkUpsert skip:', err.message);
      }
    }
    return out;
  }

  get(id) {
    return this._entities.get(id) || null;
  }

  list(filterFn) {
    const all = Array.from(this._entities.values());
    if (typeof filterFn !== 'function') return all;
    return all.filter(filterFn);
  }

  // Kept alongside list() because display controllers historically consume a
  // getAll() store interface.
  getAll(filterFn) {
    return this.list(filterFn);
  }

  deleteOlderThan(ageMs) {
    const cutoff = Date.now() - Number(ageMs || 0);
    const removed = [];
    for (const [id, entity] of this._entities) {
      if (entity.lastSeen < cutoff) {
        this._removeFromGrid(entity);
        this._entities.delete(id);
        removed.push(id);
      }
    }
    return removed;
  }

  getNearby(lat, lon, radiusKm) {
    const latNum = Number(lat);
    const lonNum = Number(lon);
    const r = Number(radiusKm) || 0;
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || r <= 0) return [];
    const cellSpan = Math.ceil(r / 111) + 1;
    const results = [];
    const seen = new Set();
    const latCenter = Math.floor(latNum);
    const lonCenter = Math.floor(lonNum);
    for (let dLat = -cellSpan; dLat <= cellSpan; dLat++) {
      for (let dLon = -cellSpan; dLon <= cellSpan; dLon++) {
        const key = gridKey(latCenter + dLat, lonCenter + dLon);
        const bucket = this._grid.get(key);
        if (!bucket) continue;
        for (const id of bucket) {
          if (seen.has(id)) continue;
          seen.add(id);
          const ent = this._entities.get(id);
          if (!ent) continue;
          const d = haversineKm(latNum, lonNum, ent.lat, ent.lon);
          if (d <= r) results.push({ entity: ent, distanceKm: d });
        }
      }
    }
    results.sort((a, b) => a.distanceKm - b.distanceKm);
    return results.map((r) => r.entity);
  }
}

const EntityStore = new EntityStoreImpl();

export default EntityStore;
export { EntityStoreImpl, VALID_ENTITY_TYPES, VALID_FRESHNESS, haversineKm, gridKey };
