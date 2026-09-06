/**
 * Relationship graph between entities and events.
 * Includes a bounding-box country lookup for lat/lon geocoding.
 */

const COUNTRY_BBOX = Object.freeze({
  IN: { minLat: 6.55, maxLat: 35.67, minLon: 68.11, maxLon: 97.40, name: 'India' },
  US: { minLat: 24.39, maxLat: 49.38, minLon: -125.00, maxLon: -66.93, name: 'United States' },
  CN: { minLat: 18.16, maxLat: 53.56, minLon: 73.50, maxLon: 135.09, name: 'China' },
  RU: { minLat: 41.19, maxLat: 81.86, minLon: -180.00, maxLon: 180.00, name: 'Russia' },
  GB: { minLat: 49.90, maxLat: 60.86, minLon: -8.65, maxLon: 1.77, name: 'United Kingdom' },
  FR: { minLat: 41.33, maxLat: 51.09, minLon: -5.14, maxLon: 9.56, name: 'France' },
  DE: { minLat: 47.27, maxLat: 55.06, minLon: 5.87, maxLon: 15.04, name: 'Germany' },
  BR: { minLat: -33.77, maxLat: 5.27, minLon: -73.99, maxLon: -34.73, name: 'Brazil' },
  JP: { minLat: 24.25, maxLat: 45.52, minLon: 122.94, maxLon: 145.82, name: 'Japan' },
  KR: { minLat: 33.11, maxLat: 38.62, minLon: 124.61, maxLon: 131.87, name: 'South Korea' },
  AU: { minLat: -43.63, maxLat: -10.67, minLon: 112.92, maxLon: 153.64, name: 'Australia' },
  CA: { minLat: 41.68, maxLat: 83.11, minLon: -141.00, maxLon: -52.62, name: 'Canada' },
  IT: { minLat: 36.62, maxLat: 47.10, minLon: 6.63, maxLon: 18.52, name: 'Italy' },
  ES: { minLat: 35.95, maxLat: 43.75, minLon: -9.30, maxLon: 3.31, name: 'Spain' },
  MX: { minLat: 14.54, maxLat: 32.72, minLon: -118.67, maxLon: -86.66, name: 'Mexico' },
  ID: { minLat: -11.11, maxLat: 6.07, minLon: 95.01, maxLon: 141.03, name: 'Indonesia' },
  TR: { minLat: 35.81, maxLat: 42.11, minLon: 25.67, maxLon: 44.82, name: 'Turkey' },
  IR: { minLat: 24.40, maxLat: 39.78, minLon: 44.03, maxLon: 63.32, name: 'Iran' },
  IL: { minLat: 29.47, maxLat: 33.35, minLon: 34.23, maxLon: 35.89, name: 'Israel' },
  SY: { minLat: 32.31, maxLat: 37.32, minLon: 35.49, maxLon: 42.41, name: 'Syria' },
  UA: { minLat: 44.29, maxLat: 52.38, minLon: 22.08, maxLon: 40.23, name: 'Ukraine' },
  EG: { minLat: 21.59, maxLat: 31.67, minLon: 24.64, maxLon: 36.89, name: 'Egypt' },
  NG: { minLat: 4.07, maxLat: 13.89, minLon: 2.68, maxLon: 14.68, name: 'Nigeria' },
  SA: { minLat: 16.24, maxLat: 32.16, minLon: 34.34, maxLon: 55.67, name: 'Saudi Arabia' },
  PK: { minLat: 23.63, maxLat: 37.08, minLon: 60.75, maxLon: 77.85, name: 'Pakistan' },
  AR: { minLat: -55.06, maxLat: -21.78, minLon: -73.58, maxLon: -52.60, name: 'Argentina' },
  PL: { minLat: 49.03, maxLat: 55.06, minLon: 14.07, maxLon: 24.09, name: 'Poland' },
  NL: { minLat: 50.75, maxLat: 53.68, minLon: 3.19, maxLon: 7.23, name: 'Netherlands' },
  SE: { minLat: 55.34, maxLat: 69.06, minLon: 10.96, maxLon: 24.17, name: 'Sweden' },
  NO: { minLat: 57.97, maxLat: 71.19, minLon: 4.43, maxLon: 31.60, name: 'Norway' },
});

const findCountryForLatLon = (lat, lon) => {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  for (const [iso2, bbox] of Object.entries(COUNTRY_BBOX)) {
    if (
      la >= bbox.minLat &&
      la <= bbox.maxLat &&
      lo >= bbox.minLon &&
      lo <= bbox.maxLon
    ) {
      return { iso2, name: bbox.name };
    }
  }
  return null;
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
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

class RelationshipGraphImpl {
  constructor() {
    /** @type {Map<string, Map<string, Map<string, object>>>} fromId -> toId -> type -> edge */
    this._adj = new Map();
    this._eventStore = null;
    this._entityStore = null;
  }

  _bindStores(eventStore, entityStore) {
    this._eventStore = eventStore;
    this._entityStore = entityStore;
  }

  relate(fromId, toId, type, metadata) {
    if (!fromId || !toId || !type) return false;
    if (!this._adj.has(fromId)) this._adj.set(fromId, new Map());
    const fromMap = this._adj.get(fromId);
    if (!fromMap.has(toId)) fromMap.set(toId, new Map());
    const typeMap = fromMap.get(toId);
    typeMap.set(type, Object.freeze({
      fromId,
      toId,
      type: String(type),
      metadata: metadata ? { ...metadata } : {},
      createdAt: Date.now(),
    }));
    if (!this._adj.has(toId)) this._adj.set(toId, new Map());
    const toMap = this._adj.get(toId);
    if (!toMap.has(fromId)) toMap.set(fromId, new Map());
    const revMap = toMap.get(fromId);
    revMap.set(type, Object.freeze({
      fromId: toId,
      toId: fromId,
      type: String(type),
      metadata: metadata ? { ...metadata } : {},
      createdAt: Date.now(),
      reverse: true,
    }));
    return true;
  }

  unrelate(fromId, toId) {
    if (!fromId || !toId) return false;
    let removed = false;
    const fromMap = this._adj.get(fromId);
    if (fromMap && fromMap.has(toId)) {
      fromMap.delete(toId);
      if (fromMap.size === 0) this._adj.delete(fromId);
      removed = true;
    }
    const toMap = this._adj.get(toId);
    if (toMap && toMap.has(fromId)) {
      toMap.delete(fromId);
      if (toMap.size === 0) this._adj.delete(toId);
      removed = true;
    }
    return removed;
  }

  getRelated(id, typeFilter) {
    if (!id) return [];
    const fromMap = this._adj.get(id);
    if (!fromMap) return [];
    const out = [];
    for (const [toId, typeMap] of fromMap) {
      for (const [type, edge] of typeMap) {
        if (typeFilter && type !== typeFilter) continue;
        out.push(edge);
      }
    }
    return out;
  }

  countryContext(countryIso2) {
    const iso = countryIso2 ? String(countryIso2).toUpperCase() : null;
    const out = { recentEvents: [], nearbyEntities: [], relatedInfra: [] };
    if (!iso) return out;
    if (this._eventStore && typeof this._eventStore.getByCountry === 'function') {
      const evs = this._eventStore.getByCountry(iso);
      const cutoff = Date.now() - 7 * 86400000;
      out.recentEvents = evs.filter((e) => e.timestamp >= cutoff);
    }
    if (this._entityStore && typeof this._entityStore.list === 'function') {
      const ents = this._entityStore.list((e) => e.countryIso2 === iso);
      out.nearbyEntities = ents.filter((e) => e.type !== 'infrastructure');
      out.relatedInfra = ents.filter((e) => e.type === 'infrastructure');
    }
    return out;
  }

  nearby(entityId, radiusKm) {
    if (!this._entityStore) return [];
    const ent = this._entityStore.get(entityId);
    if (!ent || ent.lat == null || ent.lon == null) return [];
    return this._entityStore.getNearby(ent.lat, ent.lon, Number(radiusKm) || 100);
  }
}

const RelationshipGraph = new RelationshipGraphImpl();

export default RelationshipGraph;
export { RelationshipGraphImpl, COUNTRY_BBOX, findCountryForLatLon, haversineKm };
