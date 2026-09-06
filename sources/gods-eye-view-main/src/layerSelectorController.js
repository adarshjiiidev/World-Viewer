import './styles/layerSelector.css';

const DOMAIN_DEFS = [
  {
    key: 'AIR',
    layers: ['flights', 'military'],
    description: 'Airborne platforms & ADS-B',
  },
  {
    key: 'SEA',
    layers: ['ais-live-vessels'],
    description: 'Maritime AIS transponders',
  },
  {
    key: 'SPACE',
    layers: ['satellites', 'rocket-launches'],
    description: 'Orbital catalog & launch events',
  },
  {
    key: 'EVENTS',
    layers: [],
    panelToggle: true,
    description: 'World event feed (virtual layer)',
  },
  {
    key: 'EARTH',
    layers: ['earthquakes'],
    description: 'Seismic / tectonic activity',
  },
  {
    key: 'WEATHER',
    layers: ['local-firms'],
    description: 'FIRMS hotspots / wildfire scan',
  },
  {
    key: 'INFRASTRUCTURE',
    layers: ['local-datacenters', 'local-dams', 'telegeography-submarine-cables'],
    description: 'Physical & telecom assets',
  },
  {
    key: 'CAMERAS',
    layers: ['cctv'],
    description: 'Public camera locations',
  },
  {
    key: 'NEWS',
    layers: [],
    panelToggle: true,
    syncWith: 'EVENTS',
    description: 'Event feed alias (synced)',
  },
];

function countLayerEntities(dataManager, layerKey) {
  try {
    const layer = dataManager?.layers?.get?.(layerKey) || dataManager?.layers?.[layerKey];
    const stats = layer?.module?.getStats?.() || layer?.stats || layer;
    const count = stats?.count ?? stats?.entities?.length ?? layer?.entities?.length ?? 0;
    return typeof count === 'number' ? count : 0;
  } catch {
    return 0;
  }
}

function isLayerEnabled(dataManager, LayerRegistry, layerKey) {
  try {
    if (LayerRegistry && typeof LayerRegistry.isEnabled === 'function') {
      return !!LayerRegistry.isEnabled(layerKey);
    }
    const layer = dataManager?.layers?.get?.(layerKey) || dataManager?.layers?.[layerKey];
    const enabled = layer?.enabled ?? layer?.visible ?? layer?.active;
    return !!enabled;
  } catch {
    return false;
  }
}

function setLayerEnabled(dataManager, LayerRegistry, layerKey, enabled) {
  try {
    if (LayerRegistry && typeof LayerRegistry.setEnabled === 'function') {
      LayerRegistry.setEnabled(layerKey, enabled, { origin: 'user' });
      return;
    }
    dataManager?.setEnabled?.(layerKey, enabled, { origin: 'user' });
  } catch {}
}

function eventsPanelVisible() {
  const p = document.getElementById('wv-events-panel');
  return !!(p && !p.hidden && !p.classList.contains('hidden'));
}

function setEventsPanelVisible(visible) {
  const p = document.getElementById('wv-events-panel');
  if (!p) return;
  if (visible) {
    p.hidden = false;
    p.classList.remove('hidden');
  } else {
    p.hidden = true;
    p.classList.add('hidden');
  }
}

export function appendLayerSelectorStyles(doc = document) {
  if (doc.getElementById('wv-layer-selector-styles')) return;
  const style = doc.createElement('style');
  style.id = 'wv-layer-selector-styles';
  style.textContent = '';
  doc.head.appendChild(style);
}

export default function initLayerSelector({
  viewer,
  styleManager,
  dataManager,
  sceneDirector,
  annotations,
  EventBus,
  EntityStore,
  EventStore,
} = {}) {
  const LayerRegistry = (typeof window !== 'undefined' ? window.LayerRegistry : null)
    || (arguments[0] && arguments[0].LayerRegistry);

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.setAttribute('data-layers-trigger', '');
  trigger.setAttribute('aria-label', 'Toggle layer selector panel');
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.textContent = 'LAYERS';

  const panel = document.createElement('div');
  panel.className = 'wv-layer-selector';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-label', 'Layer visibility control');

  let isOpen = false;

  function domainActive(def) {
    if (def.panelToggle) {
      if (def.syncWith) {
        const parent = DOMAIN_DEFS.find((d) => d.key === def.syncWith);
        return parent ? domainActive(parent) : eventsPanelVisible();
      }
      return eventsPanelVisible();
    }
    if (def.layers.length === 0) return false;
    return def.layers.some((k) => isLayerEnabled(dataManager, LayerRegistry, k));
  }

  function domainCount(def) {
    if (def.panelToggle) {
      try {
        const all = EventStore && typeof EventStore.getAll === 'function' ? EventStore.getAll() : [];
        return Array.isArray(all) ? all.length : 0;
      } catch {
        return 0;
      }
    }
    return def.layers.reduce((sum, k) => sum + countLayerEntities(dataManager, k), 0);
  }

  function toggleDomain(def) {
    const currentlyActive = domainActive(def);
    const next = !currentlyActive;

    if (def.panelToggle) {
      setEventsPanelVisible(next);
      if (def.syncWith) {
      } else {
        for (const d of DOMAIN_DEFS) {
          if (d.panelToggle && d.syncWith === def.key) {
            updateRow(d);
          }
        }
      }
      updateRow(def);
      EventBus?.emit?.('layers:changed', { domain: def.key, enabled: next });
      return;
    }

    for (const key of def.layers) {
      setLayerEnabled(dataManager, LayerRegistry, key, next);
    }
    updateRow(def);
    for (const d of DOMAIN_DEFS) {
      if (d.panelToggle && d.syncWith === def.key) updateRow(d);
    }
    EventBus?.emit?.('layers:changed', { domain: def.key, enabled: next, layers: def.layers });
  }

  function buildPanel() {
    panel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'wv-ls-header';
    header.innerHTML = `
      <div class="wv-ls-title">DOMAIN LAYERS</div>
      <div class="wv-ls-sub">9 Channels · Click to toggle</div>
    `;
    panel.appendChild(header);

    for (const def of DOMAIN_DEFS) {
      const row = document.createElement('div');
      row.className = 'wv-ls-row';
      row.setAttribute('tabindex', '0');
      row.setAttribute('role', 'button');
      row.setAttribute('aria-pressed', 'false');
      row.setAttribute('data-domain', def.key);
      row.title = def.description;

      const dot = document.createElement('div');
      dot.className = 'wv-ls-dot';

      const label = document.createElement('div');
      label.className = 'wv-ls-label';
      label.textContent = def.key;

      const badge = document.createElement('div');
      badge.className = 'wv-ls-badge';
      badge.dataset.countFor = def.key;
      badge.textContent = '0';

      row.appendChild(dot);
      row.appendChild(label);
      row.appendChild(badge);

      row.addEventListener('click', () => toggleDomain(def));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleDomain(def);
        }
      });

      panel.appendChild(row);
    }

    const footer = document.createElement('div');
    footer.className = 'wv-ls-footer';
    footer.textContent = 'GREEN = STREAMING · GRAY = IDLE';
    panel.appendChild(footer);

    refreshAll();
  }

  function updateRow(def) {
    const row = panel.querySelector(`.wv-ls-row[data-domain="${def.key}"]`);
    if (!row) return;
    const active = domainActive(def);
    row.classList.toggle('is-active', active);
    row.setAttribute('aria-pressed', active ? 'true' : 'false');
    const badge = panel.querySelector(`.wv-ls-badge[data-count-for="${def.key}"]`);
    if (badge) badge.textContent = String(domainCount(def));
  }

  function refreshAll() {
    for (const def of DOMAIN_DEFS) updateRow(def);
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    panel.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    refreshAll();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  function onTriggerClick(e) {
    e.stopPropagation();
    toggle();
  }

  function onDocClick(e) {
    if (!isOpen) return;
    if (panel.contains(e.target) || trigger.contains(e.target)) return;
    close();
  }

  function onDocKey(e) {
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      close();
    }
  }

  function onBulk() {
    if (isOpen) refreshAll();
  }

  function onLayersExternal() {
    refreshAll();
  }

  buildPanel();
  trigger.setAttribute('aria-expanded', 'false');

  document.body.appendChild(trigger);
  document.body.appendChild(panel);

  trigger.addEventListener('click', onTriggerClick);
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onDocKey);
  EventBus?.on?.('event:bulk', onBulk);
  EventBus?.on?.('layers:external', onLayersExternal);

  const refreshInterval = setInterval(() => {
    if (isOpen) refreshAll();
  }, 5000);

  function destroy() {
    clearInterval(refreshInterval);
    trigger.removeEventListener('click', onTriggerClick);
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onDocKey);
    EventBus?.off?.('event:bulk', onBulk);
    EventBus?.off?.('layers:external', onLayersExternal);
    trigger.remove();
    panel.remove();
  }

  return {
    destroy,
    show: open,
    hide: close,
    toggle,
    refresh: refreshAll,
    getPanel: () => panel,
    getTrigger: () => trigger,
  };
}
