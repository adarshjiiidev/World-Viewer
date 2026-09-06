/**
 * Simple pub/sub EventBus for the world-viewer pipeline.
 * Carries events, entity updates, provider health signals, and UI actions.
 */

const EVENT_TYPES = Object.freeze([
  'event:new',
  'event:update',
  'event:bulk',
  'entity:new',
  'entity:update',
  'entity:bulk',
  'provider:health',
  'alert:trigger',
  'hotspot:detect',
  'timeline:seek',
]);

class EventBusImpl {
  constructor() {
    /** @type {Map<string, Set<Function>>} eventType -> callbacks */
    this._listeners = new Map();
    /** @type {Map<string, Set<Function>>} eventType -> once callbacks */
    this._once = new Map();
  }

  _ensure(type) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    if (!this._once.has(type)) this._once.set(type, new Set());
  }

  on(eventType, cb) {
    if (typeof cb !== 'function') return () => {};
    const type = String(eventType);
    this._ensure(type);
    this._listeners.get(type).add(cb);
    return () => this.off(type, cb);
  }

  off(eventType, cb) {
    const type = String(eventType);
    const set = this._listeners.get(type);
    if (set) set.delete(cb);
    const onceSet = this._once.get(type);
    if (onceSet) onceSet.delete(cb);
  }

  once(eventType, cb) {
    if (typeof cb !== 'function') return () => {};
    const type = String(eventType);
    this._ensure(type);
    this._once.get(type).add(cb);
    return () => this.off(type, cb);
  }

  emit(eventType, payload) {
    const type = String(eventType);
    const regular = this._listeners.get(type);
    if (regular) {
      for (const cb of regular) {
        try {
          cb(payload, eventType);
        } catch (err) {
          console.warn(`[EventBus] on(${type}):`, err.message);
        }
      }
    }
    const once = this._once.get(type);
    if (once && once.size > 0) {
      const snapshot = Array.from(once);
      once.clear();
      for (const cb of snapshot) {
        try {
          cb(payload, eventType);
        } catch (err) {
          console.warn(`[EventBus] once(${type}):`, err.message);
        }
      }
    }
  }

  clearAll() {
    this._listeners.clear();
    this._once.clear();
  }
}

const EventBus = new EventBusImpl();

export default EventBus;
export { EventBusImpl, EVENT_TYPES };
