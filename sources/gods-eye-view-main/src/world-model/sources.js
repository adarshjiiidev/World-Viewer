/**
 * Provider health registry. Tracks each data provider's connectivity,
 * latency, error counts, and data freshness. Emits change events to
 * subscribers.
 */

const VALID_STATUS = Object.freeze([
  'online',
  'degraded',
  'stale',
  'offline',
  'auth_required',
]);

const DEFAULT_STATE = Object.freeze({
  status: 'offline',
  lastUpdate: 0,
  latency: 0,
  errorCount: 0,
  dataAge: 0,
  message: '',
});

class ProviderHealthImpl {
  constructor() {
    /** @type {Map<string, object>} providerId -> state */
    this._providers = new Map();
    /** @type {Function[]} subscriber callbacks */
    this._listeners = new Set();
  }

  set(id, state = {}) {
    if (!id || typeof id !== 'string') return null;
    const prev = this._providers.get(id) || { ...DEFAULT_STATE };
    const merged = {
      status: state.status && VALID_STATUS.includes(state.status) ? state.status : prev.status,
      lastUpdate: state.lastUpdate != null ? Number(state.lastUpdate) : Date.now(),
      latency: state.latency != null ? Number(state.latency) : prev.latency,
      errorCount: state.errorCount != null ? Number(state.errorCount) : prev.errorCount,
      dataAge: state.dataAge != null ? Number(state.dataAge) : prev.dataAge,
      message: state.message != null ? String(state.message) : prev.message,
    };
    const frozen = Object.freeze({ id, ...merged });
    this._providers.set(id, frozen);
    this._emit(id, frozen);
    return frozen;
  }

  get(id) {
    if (!id) return null;
    return this._providers.get(id) || null;
  }

  all() {
    return Array.from(this._providers.values());
  }

  markError(id, errMsg) {
    if (!id) return null;
    const prev = this._providers.get(id) || { ...DEFAULT_STATE };
    const errs = (prev.errorCount || 0) + 1;
    let status = prev.status || 'offline';
    if (errs >= 5) status = 'offline';
    else if (errs >= 2) status = 'degraded';
    return this.set(id, {
      status,
      errorCount: errs,
      lastUpdate: Date.now(),
      message: errMsg ? String(errMsg) : 'error',
    });
  }

  heartbeat(id, latencyMs) {
    if (!id) return null;
    const prev = this._providers.get(id) || { ...DEFAULT_STATE };
    const lat = Number(latencyMs) || 0;
    let status = 'online';
    if (lat > 5000) status = 'degraded';
    return this.set(id, {
      status,
      latency: lat,
      lastUpdate: Date.now(),
      errorCount: 0,
      message: '',
    });
  }

  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  _emit(id, state) {
    for (const cb of this._listeners) {
      try {
        cb(id, state);
      } catch (err) {
        console.warn('[ProviderHealth] subscriber error:', err.message);
      }
    }
  }
}

const ProviderHealth = new ProviderHealthImpl();

export default ProviderHealth;
export { ProviderHealthImpl, VALID_STATUS, DEFAULT_STATE };
