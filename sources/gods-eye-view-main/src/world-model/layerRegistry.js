const VALID_CATEGORIES = Object.freeze([
  'air',
  'sea',
  'space',
  'earth',
  'weather',
  'infrastructure',
  'cameras',
  'news',
  'events',
  'transport',
  'communication',
]);

class LayerRegistryImpl {
  constructor() {
    /** @type {Map<string, object>} id -> entry */
    this._entries = new Map();
    /** @type {Map<string, boolean>} id -> enabled */
    this._enabled = new Map();
  }

  register(id, opts = {}) {
    if (!id || typeof id !== 'string') {
      throw new Error('LayerRegistry.register(): id must be a non-empty string');
    }
    if (this._entries.has(id)) {
      throw new Error(`LayerRegistry.register(): duplicate layer id "${id}"`);
    }
    const {
      name = id,
      category = 'earth',
      authRequired = false,
      defaultOn = false,
      toggle = null,
      getHealth = null,
      provider = null,
    } = opts;

    if (!VALID_CATEGORIES.includes(category)) {
      throw new Error(
        `LayerRegistry.register(): invalid category "${category}" for layer "${id}". ` +
        `Valid categories: ${VALID_CATEGORIES.join(', ')}`,
      );
    }

    const safeToggle = typeof toggle === 'function'
      ? toggle
      : () => {};

    const safeHealth = typeof getHealth === 'function'
      ? getHealth
      : () => ({ status: 'offline', lastUpdate: 0 });

    const entry = Object.freeze({
      id,
      name,
      category,
      authRequired: Boolean(authRequired),
      defaultOn: Boolean(defaultOn),
      toggle: safeToggle,
      getHealth: safeHealth,
      provider: provider ? String(provider) : null,
    });

    this._entries.set(id, entry);
    if (!this._enabled.has(id)) {
      this._enabled.set(id, Boolean(defaultOn));
    }
    return entry;
  }

  list() {
    return Array.from(this._entries.values());
  }

  get(id) {
    return this._entries.get(id) || null;
  }

  setEnabled(id, shouldEnable) {
    const entry = this._entries.get(id);
    if (!entry) return false;
    const next = Boolean(shouldEnable);
    const prev = this._enabled.get(id);
    if (prev === next) return true;
    this._enabled.set(id, next);
    try {
      entry.toggle(next);
    } catch (err) {
      console.warn(`[LayerRegistry] toggle(${id}, ${next}) threw:`, err);
    }
    return true;
  }

  allEnabled() {
    const out = [];
    for (const entry of this._entries.values()) {
      if (this._enabled.get(entry.id)) out.push(entry);
    }
    return out;
  }
}

const LayerRegistry = new LayerRegistryImpl();

export default LayerRegistry;
export { VALID_CATEGORIES, LayerRegistryImpl };
