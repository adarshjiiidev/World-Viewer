/**
 * Cross-type event correlation engine.
 * Given a new event, searches the EventStore for related events
 * within 500km and 72 hours across different event types.
 */

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

const COMPLEMENTARY_TYPES = Object.freeze({
  EARTHQUAKE: ['HUMANITARIAN', 'INFRASTRUCTURE', 'TRANSPORT'],
  WILDFIRE: ['HUMANITARIAN', 'WEATHER', 'ENVIRONMENT', 'INFRASTRUCTURE'],
  VOLCANO: ['AIRSPACE', 'HUMANITARIAN', 'ENVIRONMENT'],
  CONFLICT: ['MILITARY_ACTIVITY', 'HUMANITARIAN', 'DIPLOMATIC', 'AVIATION', 'MARITIME'],
  MILITARY_ACTIVITY: ['CONFLICT', 'DIPLOMATIC', 'SANCTIONS'],
  PROTEST: ['POLITICAL', 'HUMANITARIAN', 'CONFLICT'],
  POLITICAL: ['DIPLOMATIC', 'PROTEST', 'SANCTIONS', 'TRADE'],
  DIPLOMATIC: ['POLITICAL', 'TRADE', 'SANCTIONS', 'CONFLICT'],
  SANCTIONS: ['TRADE', 'DIPLOMATIC', 'POLITICAL'],
  TRADE: ['SANCTIONS', 'DIPLOMATIC', 'MARITIME', 'TRANSPORT'],
  CYBER_OUTAGE: ['INFRASTRUCTURE', 'TRANSPORT', 'AVIATION'],
  AVIATION: ['INFRASTRUCTURE', 'TRANSPORT', 'MARITIME'],
  MARITIME: ['TRADE', 'INFRASTRUCTURE', 'TRANSPORT', 'ENVIRONMENT'],
  INFRASTRUCTURE: ['HUMANITARIAN', 'TRANSPORT', 'AVIATION', 'MARITIME', 'CYBER_OUTAGE'],
  WEATHER: ['HUMANITARIAN', 'INFRASTRUCTURE', 'TRANSPORT', 'ENVIRONMENT'],
  HUMANITARIAN: ['CONFLICT', 'WEATHER', 'INFRASTRUCTURE', 'ENVIRONMENT'],
  SPACE: ['MILITARY_ACTIVITY', 'DIPLOMATIC'],
  TRANSPORT: ['INFRASTRUCTURE', 'AVIATION', 'MARITIME'],
  ENVIRONMENT: ['WEATHER', 'HUMANITARIAN', 'INFRASTRUCTURE', 'MARITIME'],
});

class CorrelateEngineImpl {
  constructor() {
    this._radiusKm = 500;
    this._windowMs = 72 * 3600 * 1000;
    this._eventStore = null;
  }

  _bindStore(eventStore) {
    this._eventStore = eventStore;
  }

  findRelated(newEvent) {
    const relatedEvents = [];
    const relationships = [];
    if (!newEvent) return { relatedEvents, relationships };
    const pool = this._eventStore && typeof this._eventStore.list === 'function'
      ? this._eventStore.list()
      : [];
    if (pool.length === 0) return { relatedEvents, relationships };
    const lat = newEvent.location && newEvent.location.lat;
    const lon = newEvent.location && newEvent.location.lon;
    const ts = Number(newEvent.timestamp) || Date.now();
    const evType = newEvent.type;
    const complements = new Set(COMPLEMENTARY_TYPES[evType] || []);
    const candidates = [];
    for (const ev of pool) {
      if (!ev || ev.id === newEvent.id) continue;
      const evLat = ev.location && ev.location.lat;
      const evLon = ev.location && ev.location.lon;
      const dist = haversineKm(lat, lon, evLat, evLon);
      if (dist > this._radiusKm) continue;
      const evTs = Number(ev.timestamp) || 0;
      const dt = Math.abs(ts - evTs);
      if (dt > this._windowMs) continue;
      const typeScore = (ev.type !== evType ? 1 : 0) + (complements.has(ev.type) ? 1 : 0);
      if (ev.type === evType && complements.size > 0 && typeScore === 0) continue;
      const timeScore = 1 - Math.min(1, dt / this._windowMs);
      const spaceScore = 1 - Math.min(1, dist / this._radiusKm);
      const confScore = (ev.confidence || 50) / 100;
      const total = typeScore * 0.35 + timeScore * 0.25 + spaceScore * 0.3 + confScore * 0.1;
      candidates.push({ ev, dist, dt, score: total });
    }
    candidates.sort((a, b) => b.score - a.score);
    const alreadySeen = new Set();
    for (const c of candidates.slice(0, 10)) {
      if (alreadySeen.has(c.ev.id)) continue;
      alreadySeen.add(c.ev.id);
      relatedEvents.push(c.ev);
      const relType = (evType < c.ev.type) ? `${evType}__${c.ev.type}` : `${c.ev.type}__${evType}`;
      relationships.push({
        fromId: newEvent.id,
        toId: c.ev.id,
        type: relType,
        metadata: {
          distanceKm: c.dist,
          timeDeltaMs: c.dt,
          correlationScore: c.score,
        },
      });
    }
    return { relatedEvents, relationships };
  }
}

const CorrelateEngine = new CorrelateEngineImpl();

export default CorrelateEngine;
export { CorrelateEngineImpl, COMPLEMENTARY_TYPES, haversineKm };
