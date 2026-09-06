const TYPE_ICON_MAP = {
  CONFLICT: '⚔',
  MILITARY_ACTIVITY: '⚔',
  PROTEST: '✊',
  CIVIL_UNREST: '✊',
  CIVIL: '✊',
  HUMANITARIAN: '🆘',
  EARTHQUAKE: '🌍',
  WILDFIRE: '🔥',
  VOLCANO: '🌋',
  WEATHER: '⛈',
  STORM: '🌪',
  FLOOD: '🌊',
  ENVIRONMENT: '🌱',
  DISASTER: '⚠',
  POLITICAL: '🏛',
  DIPLOMATIC: '🤝',
  SANCTIONS: '🚫',
  TRADE: '📦',
  AVIATION: '✈',
  AIRSPACE: '✈',
  MARITIME: '🚢',
  NAVAL: '⚓',
  CYBER: '💻',
  CYBER_OUTAGE: '💥',
  OUTAGE: '⚡',
  SPACE: '🛰',
  ROCKET_LAUNCH: '🚀',
  SATELLITE: '📡',
  INFRASTRUCTURE: '🏗',
  POWER_OUTAGE: '🔌',
  DAM: '💧',
};

const SEVERITY_STYLES = {
  LOW: { color: '#888', bg: 'rgba(136,136,136,0.15)', border: 'rgba(136,136,136,0.3)' },
  MEDIUM: { color: '#ffcc00', bg: 'rgba(255,204,0,0.12)', border: 'rgba(255,204,0,0.35)' },
  HIGH: { color: '#ff8800', bg: 'rgba(255,136,0,0.14)', border: 'rgba(255,136,0,0.4)' },
  CRITICAL: { color: '#ff3333', bg: 'rgba(255,51,51,0.16)', border: 'rgba(255,51,51,0.45)' },
};

const FILTER_MAP = {
  all: null,
  conflict: ['CONFLICT', 'MILITARY_ACTIVITY'],
  protest: ['PROTEST', 'CIVIL', 'CIVIL_UNREST', 'HUMANITARIAN'],
  disaster: ['EARTHQUAKE', 'WILDFIRE', 'VOLCANO', 'WEATHER', 'ENVIRONMENT', 'FLOOD', 'STORM', 'DISASTER'],
  political: ['POLITICAL', 'DIPLOMATIC', 'SANCTIONS', 'TRADE'],
};

const DEMO_SEED_EVENTS = [
  {
    id: 'demo-1', type: 'EARTHQUAKE', severity: 'HIGH',
    title: 'M6.2 Seismic Event — Ring of Fire',
    summary: 'Shallow tectonic event detected 48km offshore; regional advisory active.',
    location: 'Sulawesi, Indonesia',
    timestamp: Date.now() - 3 * 60 * 60 * 1000,
    lat: -2.5, lon: 120.8,
    sourceCount: 3, confidence: 0.88,
  },
  {
    id: 'demo-2', type: 'WILDFIRE', severity: 'MEDIUM',
    title: 'Wildfire Containment — Coastal Range',
    summary: 'Aerial retardant lines holding; evacuation orders remain for 2,200 structures.',
    location: 'Northern CA, USA',
    timestamp: Date.now() - 7 * 60 * 60 * 1000,
    lat: 40.1, lon: -122.7,
    sourceCount: 5, confidence: 0.92,
  },
  {
    id: 'demo-3', type: 'AVIATION', severity: 'LOW',
    title: 'Airspace Diversion — North Atlantic',
    summary: 'Flights rerouted around convective cell; no incidents reported.',
    location: 'Gander Oceanic FIR',
    timestamp: Date.now() - 1 * 60 * 60 * 1000,
    lat: 51.0, lon: -40.0,
    sourceCount: 2, confidence: 0.78,
  },
  {
    id: 'demo-4', type: 'CONFLICT', severity: 'HIGH',
    title: 'Border Posture Shift — Eastern Border',
    summary: 'Redeployment of mechanized elements observed within 12km of frontier.',
    location: 'Luhansk Oblast, UA',
    timestamp: Date.now() - 5 * 60 * 60 * 1000,
    lat: 48.9, lon: 39.3,
    sourceCount: 4, confidence: 0.81,
  },
  {
    id: 'demo-5', type: 'PROTEST', severity: 'MEDIUM',
    title: 'Labor Demonstration — Capital District',
    summary: 'Peaceful assembly of ~8,000; municipal police deployed traffic cordon.',
    location: 'Lisbon, Portugal',
    timestamp: Date.now() - 11 * 60 * 60 * 1000,
    lat: 38.7, lon: -9.1,
    sourceCount: 2, confidence: 0.72,
  },
  {
    id: 'demo-6', type: 'CYBER_OUTAGE', severity: 'CRITICAL',
    title: 'Backbone Provider Routing Instability — Region 3',
    summary: 'BGP path flaps observed on tier-1 transit; recovery partial after 42 min.',
    location: 'Frankfurt, DE',
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
    lat: 50.1, lon: 8.7,
    sourceCount: 3, confidence: 0.86,
  },
];

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  return d + 'd ago';
}

function typeIcon(type) {
  return TYPE_ICON_MAP[(type || '').toUpperCase()] || '●';
}

function severityStyle(sev) {
  return SEVERITY_STYLES[(sev || 'LOW').toUpperCase()] || SEVERITY_STYLES.LOW;
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function eventMatchesFilter(ev, filterKey) {
  const types = FILTER_MAP[filterKey];
  if (!types) return true;
  const t = (ev.type || ev.category || '').toUpperCase();
  return types.includes(t);
}

function getAllEvents(EventStore) {
  try {
    if (EventStore && typeof EventStore.getAll === 'function') {
      const arr = EventStore.getAll();
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch {}
  return DEMO_SEED_EVENTS.slice();
}

function sortEventsByRecency(list) {
  return (list || []).slice().sort((a, b) => {
    const ta = a.timestampMs ?? (typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp || a.createdAt || 0).getTime());
    const tb = b.timestampMs ?? (typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp || b.createdAt || 0).getTime());
    return tb - ta;
  });
}

function eventTimestamp(ev) {
  if (typeof ev.timestampMs === 'number') return ev.timestampMs;
  if (typeof ev.timestamp === 'number') return ev.timestamp;
  return new Date(ev.timestamp || ev.createdAt || 0).getTime();
}

export default function initEventsPanel({
  viewer,
  styleManager,
  dataManager,
  sceneDirector,
  annotations,
  EventBus,
  EntityStore,
  EventStore,
} = {}) {
  const panel = document.getElementById('wv-events-panel');
  if (!panel) {
    return { destroy: () => {}, show: () => {}, hide: () => {} };
  }

  const listEl = document.getElementById('wv-events-list');
  const closeBtn = panel.querySelector('#wv-events-close, .wv-events-close, [data-events-close]');
  const filterBtns = panel.querySelectorAll('.wv-filter-btn');
  const pinEntities = new Map();

  let activeFilter = 'all';

  function ensureListStyles() {
    if (listEl && !listEl.style.maxHeight) {
      listEl.style.maxHeight = '500px';
      listEl.style.overflowY = 'auto';
    }
  }

  function ensureEmptyState(list) {
    const existing = panel.querySelector('.wv-events-empty');
    if (list.length > 0) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    const empty = document.createElement('div');
    empty.className = 'wv-events-empty';
    empty.style.padding = '24px 16px';
    empty.style.textAlign = 'center';
    empty.style.color = 'rgba(255,255,255,0.55)';
    empty.style.fontFamily = "'JetBrains Mono', ui-monospace, monospace";
    empty.style.fontSize = '11px';
    empty.style.letterSpacing = '0.15em';
    empty.style.textTransform = 'uppercase';
    empty.innerHTML = `
      <div style="font-size:13px;color:rgba(0,255,136,0.75);margin-bottom:8px;letter-spacing:0.25em;">NO RECENT WORLD EVENTS</div>
      <div style="color:rgba(255,255,255,0.4);font-size:10.5px;letter-spacing:0.12em;text-transform:none;line-height:1.5;">Feeds connect automatically — check Provider health if this persists.</div>
    `;
    listEl?.parentElement?.insertBefore(empty, listEl);
  }

  function buildItemHtml(ev) {
    const ts = eventTimestamp(ev);
    const sev = (ev.severity || 'LOW').toUpperCase();
    const style = severityStyle(sev);
    const conf = Math.max(0, Math.min(1, typeof ev.confidence === 'number' ? ev.confidence : 0.7));
    const srcCount = typeof ev.sourceCount === 'number' ? ev.sourceCount : 1;
    const sources = Array.isArray(ev.sources) ? ev.sources : [];
    const sourceName = sources[0]?.name || sources[0]?.provider || ev.sourceName || 'unattributed';
    const icon = typeIcon(ev.type);
    return `
      <div class="wv-event-item" data-event-id="${escHtml(ev.id)}" tabindex="0"
           style="padding:10px 12px;border-top:1px solid rgba(0,255,136,0.08);cursor:pointer;transition:background 150ms;"
           onmouseover="this.style.background='rgba(0,255,136,0.04)'"
           onmouseout="this.style.background='transparent'">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="width:24px;height:24px;flex-shrink:0;border-radius:4px;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.18);display:flex;align-items:center;justify-content:center;font-size:13px;">${icon}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
              <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11.5px;font-weight:600;color:#e6fff2;letter-spacing:0.03em;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(ev.title)}</div>
              <div style="flex-shrink:0;font-size:10px;padding:2px 6px;border-radius:3px;border:1px solid ${style.border};background:${style.bg};color:${style.color};font-family:'JetBrains Mono',monospace;letter-spacing:0.1em;text-transform:uppercase;">${escHtml(sev)}</div>
            </div>
            <div style="font-size:11px;color:rgba(255,255,255,0.55);line-height:1.45;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(ev.summary || '')}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px;color:rgba(255,255,255,0.45);font-family:'JetBrains Mono',monospace;letter-spacing:0.05em;">
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <span style="opacity:0.85;">📍 ${escHtml(ev.location || 'Unknown')}</span>
                <span style="opacity:0.7;">⏱ ${relativeTime(ts)}</span>
                <span title="${escHtml(sourceName)}" style="opacity:0.6;">📡 ${srcCount} src · ${escHtml(sourceName)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                <div style="width:56px;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;">
                  <div style="width:${Math.round(conf * 100)}%;height:100%;background:linear-gradient(90deg,#00ff88,rgba(0,255,136,0.55));"></div>
                </div>
                <span style="opacity:0.55;">${Math.round(conf * 100)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    ensureListStyles();
    if (!listEl) return;
    const raw = getAllEvents(EventStore);
    const sorted = sortEventsByRecency(raw);
    const filtered = sorted.filter((e) => eventMatchesFilter(e, activeFilter));
    ensureEmptyState(filtered);
    listEl.innerHTML = filtered.map(buildItemHtml).join('');
  }

  function onListClick(e) {
    const item = e.target.closest('.wv-event-item');
    if (!item) return;
    const id = item.dataset.eventId;
    const raw = getAllEvents(EventStore);
    const ev = raw.find((x) => String(x.id) === String(id))
      || DEMO_SEED_EVENTS.find((x) => String(x.id) === String(id));
    if (!ev) return;

    const lat = typeof ev.lat === 'number' ? ev.lat : (typeof ev.latitude === 'number' ? ev.latitude : null);
    const lon = typeof ev.lon === 'number' ? ev.lon : (typeof ev.longitude === 'number' ? ev.longitude : null);

    if (lat == null || lon == null) return;
    if (!window.Cesium || !viewer) return;
    try {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, 5_000_000),
        duration: 2,
      });
      const position = Cesium.Cartesian3.fromDegrees(lon, lat);
      const entity = viewer.entities.add({
        position,
        point: {
          pixelSize: 14,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
      pinEntities.set(id, entity);
      setTimeout(() => {
        try { viewer.entities.remove(entity); } catch {}
        pinEntities.delete(id);
      }, 30 * 1000);
    } catch {}
  }

  function onFilterClick(e) {
    const btn = e.target.closest('.wv-filter-btn');
    if (!btn) return;
    activeFilter = btn.dataset.filter || 'all';
    filterBtns.forEach((b) => b.classList.toggle('active', b === btn));
    render();
  }

  function show() {
    panel.classList.remove('hidden');
    panel.hidden = false;
    document.body.classList.add('wv-events-open');
    render();
  }

  function hide() {
    panel.classList.add('hidden');
    panel.hidden = true;
    document.body.classList.remove('wv-events-open');
  }

  function toggle() {
    if (panel.hidden || panel.classList.contains('hidden')) show();
    else hide();
  }

  function onClose() {
    hide();
  }

  function onDocKey(e) {
    if (e.key === 'Escape' && !panel.hidden) hide();
  }

  function onBulk() {
    if (!panel.hidden) render();
  }

  ensureListStyles();
  listEl?.addEventListener('click', onListClick);
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.wv-filter-btn')) onFilterClick(e);
  });
  closeBtn?.addEventListener('click', onClose);
  document.addEventListener('keydown', onDocKey);
  EventBus?.on?.('event:bulk', onBulk);

  if (filterBtns.length === 0) {
    const header = panel.querySelector('.wv-events-header, .wv-panel-header');
    if (header) {
      const bar = document.createElement('div');
      bar.className = 'wv-event-filter-bar';
      bar.style.display = 'flex';
      bar.style.gap = '6px';
      bar.style.padding = '8px 12px';
      bar.style.borderBottom = '1px solid rgba(0,255,136,0.1)';
      bar.style.flexWrap = 'wrap';
      ['all', 'conflict', 'protest', 'disaster', 'political'].forEach((k) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'wv-filter-btn' + (k === 'all' ? ' active' : '');
        b.dataset.filter = k;
        b.textContent = k.toUpperCase();
        Object.assign(b.style, {
          padding: '4px 10px',
          fontSize: '10px',
          letterSpacing: '0.12em',
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: 'uppercase',
          background: k === 'all' ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.04)',
          color: k === 'all' ? '#00ff88' : 'rgba(255,255,255,0.6)',
          border: '1px solid ' + (k === 'all' ? 'rgba(0,255,136,0.45)' : 'rgba(255,255,255,0.1)'),
          borderRadius: '3px',
          cursor: 'pointer',
          transition: 'all 150ms ease',
        });
        b.addEventListener('mouseenter', () => {
          b.style.background = 'rgba(0,255,136,0.08)';
          b.style.borderColor = 'rgba(0,255,136,0.25)';
        });
        b.addEventListener('mouseleave', () => {
          const isActive = b.classList.contains('active');
          b.style.background = isActive ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.04)';
          b.style.borderColor = isActive ? 'rgba(0,255,136,0.45)' : 'rgba(255,255,255,0.1)';
          b.style.color = isActive ? '#00ff88' : 'rgba(255,255,255,0.6)';
        });
        b.addEventListener('click', () => {
          activeFilter = k;
          panel.querySelectorAll('.wv-filter-btn').forEach((x) => {
            const on = x === b;
            x.classList.toggle('active', on);
            x.style.background = on ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.04)';
            x.style.color = on ? '#00ff88' : 'rgba(255,255,255,0.6)';
            x.style.borderColor = on ? 'rgba(0,255,136,0.45)' : 'rgba(255,255,255,0.1)';
          });
          render();
        });
        bar.appendChild(b);
      });
      header.after(bar);
    }
  }

  render();

  function destroy() {
    document.body.classList.remove('wv-events-open');
    listEl?.removeEventListener('click', onListClick);
    closeBtn?.removeEventListener('click', onClose);
    document.removeEventListener('keydown', onDocKey);
    EventBus?.off?.('event:bulk', onBulk);
    for (const ent of pinEntities.values()) {
      try { viewer?.entities?.remove(ent); } catch {}
    }
    pinEntities.clear();
  }

  return { destroy, show, hide, toggle, refresh: render };
}
