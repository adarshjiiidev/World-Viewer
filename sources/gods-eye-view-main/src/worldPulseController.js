const METRIC_ORDER = [
  'global',
  'conflict',
  'unrest',
  'aviation',
  'maritime',
  'hazards',
  'cyber',
  'space',
  'infrastructure',
];

const METRIC_LABELS = {
  global: 'Global Activity',
  conflict: 'Conflict Activity',
  unrest: 'Civil Unrest',
  aviation: 'Aviation',
  maritime: 'Maritime',
  hazards: 'Natural Hazards',
  cyber: 'Cyber / Outage',
  space: 'Space',
  infrastructure: 'Infrastructure',
};

const METHODOLOGY = {
  global: 'Weighted composite of all eight domain indicators, normalized 0-100.',
  conflict: 'Derived from last-24h public event count (CONFLICT / MILITARY_ACTIVITY) × 5 plus severity bonus, capped.',
  unrest: 'Derived from last-24h PROTEST / CIVIL / HUMANITARIAN public event count + severity weighting.',
  aviation: 'AVIATION-class events in last 24h plus airborne-flight data-provider density.',
  maritime: 'MARITIME-class events plus active AIS vessel density from data provider.',
  hazards: 'WILDFIRE + EARTHQUAKE + VOLCANO + WEATHER events plus seismic / fire feed counts.',
  cyber: 'Rare CYBER_OUTAGE events × 10 scale factor plus infrastructure-outage correlation.',
  space: 'SPACE-class events plus active satellite catalog count / 100.',
  infrastructure: 'INFRASTRUCTURE-class events × 8 scale factor plus provider asset density.',
};

const SEVERITY_BONUS = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 4 };
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function getEventsInWindow(EventStore, fromMs, toMs) {
  if (!EventStore || typeof EventStore.getAll !== 'function') return [];
  try {
    const all = EventStore.getAll() || [];
    return all.filter((ev) => {
      const t = typeof ev.timestampMs === 'number' ? ev.timestampMs : new Date(ev.timestamp || ev.createdAt || 0).getTime();
      return t >= fromMs && t < toMs;
    });
  } catch {
    return [];
  }
}

function countByTypes(events, types) {
  const set = new Set(types);
  let n = 0;
  let sevBonus = 0;
  for (const ev of events) {
    if (!ev) continue;
    const type = (ev.type || ev.category || '').toUpperCase();
    if (set.has(type)) {
      n++;
      sevBonus += SEVERITY_BONUS[(ev.severity || 'LOW').toUpperCase()] || 0;
    }
  }
  return { n, sevBonus };
}

function getLayerCount(dataManager, layerKey) {
  try {
    const layer = dataManager?.layers?.[layerKey];
    const stats = layer?.stats || layer;
    const count = stats?.count ?? stats?.entities?.length ?? layer?.entities?.length ?? 0;
    return typeof count === 'number' ? count : 0;
  } catch {
    return 0;
  }
}

function trendArrow(current, prior) {
  if (prior <= 0 && current <= 0) return '→';
  const base = prior > 0 ? prior : Math.max(current, 1);
  const pct = (current - prior) / base * 100;
  if (pct > 10) return '↑';
  if (pct < -10) return '↓';
  return '→';
}

function clip100(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeMetrics({ EventStore, dataManager } = {}, nowMs = Date.now()) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const curFrom = now - DAY_MS;
  const priFrom = now - 2 * DAY_MS;

  const curEvents = getEventsInWindow(EventStore, curFrom, now);
  const priEvents = getEventsInWindow(EventStore, priFrom, curFrom);

  const cntCur = (types) => {
    const { n, sevBonus } = countByTypes(curEvents, types);
    return { n, sevBonus };
  };
  const cntPri = (types) => countByTypes(priEvents, types).n;

  const flightsCount = getLayerCount(dataManager, 'flights');
  const vesselsCount = getLayerCount(dataManager, 'ais-live-vessels');
  const satsCount = getLayerCount(dataManager, 'satellites');
  const quakesCount = getLayerCount(dataManager, 'earthquakes');
  const firesCount = getLayerCount(dataManager, 'local-firms');

  const conflictCur = cntCur(['CONFLICT', 'MILITARY_ACTIVITY']);
  const conflict = clip100(conflictCur.n * 5 + conflictCur.sevBonus * 2);
  const conflictPrior = cntPri(['CONFLICT', 'MILITARY_ACTIVITY']);

  const unrestCur = cntCur(['PROTEST', 'CIVIL_UNREST', 'CIVIL', 'HUMANITARIAN']);
  const unrest = clip100(unrestCur.n * 4 + unrestCur.sevBonus * 2);
  const unrestPrior = cntPri(['PROTEST', 'CIVIL_UNREST', 'CIVIL', 'HUMANITARIAN']);

  const aviationCur = cntCur(['AVIATION', 'AIRSPACE']);
  const aviation = clip100(aviationCur.n * 3 + aviationCur.sevBonus + flightsCount / 50);
  const aviationPrior = cntPri(['AVIATION', 'AIRSPACE']);

  const maritimeCur = cntCur(['MARITIME', 'NAVAL']);
  const maritime = clip100(maritimeCur.n * 3 + maritimeCur.sevBonus + vesselsCount / 200);
  const maritimePrior = cntPri(['MARITIME', 'NAVAL']);

  const hazardsCur = cntCur(['WILDFIRE', 'EARTHQUAKE', 'VOLCANO', 'WEATHER', 'ENVIRONMENT', 'FLOOD', 'STORM']);
  const hazards = clip100(hazardsCur.n * 3.5 + hazardsCur.sevBonus * 2 + quakesCount / 10 + firesCount / 20);
  const hazardsPrior = cntPri(['WILDFIRE', 'EARTHQUAKE', 'VOLCANO', 'WEATHER', 'ENVIRONMENT', 'FLOOD', 'STORM']);

  const cyberCur = cntCur(['CYBER', 'CYBER_OUTAGE', 'OUTAGE']);
  const cyber = clip100(cyberCur.n * 10 + cyberCur.sevBonus * 3);
  const cyberPrior = cntPri(['CYBER', 'CYBER_OUTAGE', 'OUTAGE']);

  const spaceCur = cntCur(['SPACE', 'ROCKET_LAUNCH', 'SATELLITE']);
  const space = clip100(spaceCur.n * 4 + spaceCur.sevBonus * 2 + satsCount / 100);
  const spacePrior = cntPri(['SPACE', 'ROCKET_LAUNCH', 'SATELLITE']);

  const infraCur = cntCur(['INFRASTRUCTURE', 'POWER_OUTAGE', 'DAM']);
  const infrastructure = clip100(infraCur.n * 8 + infraCur.sevBonus * 3);
  const infrastructurePrior = cntPri(['INFRASTRUCTURE', 'POWER_OUTAGE', 'DAM']);

  const global = clip100(
    conflict * 0.18 +
      unrest * 0.12 +
      aviation * 0.12 +
      maritime * 0.10 +
      hazards * 0.16 +
      cyber * 0.10 +
      space * 0.10 +
      infrastructure * 0.12
  );

  const priorGlobal = clip100(
    conflictPrior * 0.18 +
      unrestPrior * 0.12 +
      aviationPrior * 0.12 +
      maritimePrior * 0.10 +
      hazardsPrior * 0.16 +
      cyberPrior * 0.10 +
      spacePrior * 0.10 +
      infrastructurePrior * 0.12
  );

  return {
    global: { value: global, trend: trendArrow(global, priorGlobal) },
    conflict: { value: conflict, trend: trendArrow(conflictCur.n, conflictPrior) },
    unrest: { value: unrest, trend: trendArrow(unrestCur.n, unrestPrior) },
    aviation: { value: aviation, trend: trendArrow(aviationCur.n, aviationPrior) },
    maritime: { value: maritime, trend: trendArrow(maritimeCur.n, maritimePrior) },
    hazards: { value: hazards, trend: trendArrow(hazardsCur.n, hazardsPrior) },
    cyber: { value: cyber, trend: trendArrow(cyberCur.n, cyberPrior) },
    space: { value: space, trend: trendArrow(spaceCur.n, spacePrior) },
    infrastructure: { value: infrastructure, trend: trendArrow(infraCur.n, infrastructurePrior) },
  };
}

export default function initWorldPulse({
  viewer,
  styleManager,
  dataManager,
  sceneDirector,
  annotations,
  EventBus,
  EntityStore,
  EventStore,
} = {}) {
  const panel = document.getElementById('wv-world-pulse');
  if (!panel) {
    return { destroy: () => {}, show: () => {}, hide: () => {} };
  }

  const closeBtn = document.getElementById('wv-pulse-close');

  function ensureRows() {
    const list = panel.querySelector('#wv-pulse-list, .wv-pulse-list');
    if (!list) return;
    for (const key of METRIC_ORDER) {
      const id = `wv-pulse-${key}-row`;
      if (document.getElementById(id)) continue;
      const row = document.createElement('div');
      row.id = id;
      row.className = 'wv-pulse-row';
      row.setAttribute('data-methodology', METHODOLOGY[key] || '');
      row.title = METRIC_LABELS[key] + ' — ' + (METHODOLOGY[key] || '');
      row.innerHTML = `
        <div class="wv-pulse-label">${METRIC_LABELS[key]}</div>
        <div class="wv-pulse-metric">
          <span id="wv-pulse-${key}-value" class="wv-pulse-value">0</span>
          <span id="wv-pulse-${key}-trend" class="wv-pulse-trend">→</span>
        </div>
      `;
      list.appendChild(row);
    }
    const footer = panel.querySelector('.wv-pulse-footer');
    if (!footer) {
      const f = document.createElement('div');
      f.className = 'wv-pulse-footer';
      f.textContent = 'INDICATORS ONLY · NOT OBJECTIVE MEASUREMENTS';
      panel.appendChild(f);
    }
  }

  function updateDOM(metrics) {
    for (const key of METRIC_ORDER) {
      const v = document.getElementById(`wv-pulse-${key}-value`);
      const t = document.getElementById(`wv-pulse-${key}-trend`);
      const m = metrics[key];
      if (v && m) v.textContent = String(m.value);
      if (t && m) {
        t.textContent = m.trend;
        t.classList.remove('wv-pulse-up', 'wv-pulse-down', 'wv-pulse-flat');
        if (m.trend === '↑') t.classList.add('wv-pulse-up');
        else if (m.trend === '↓') t.classList.add('wv-pulse-down');
        else t.classList.add('wv-pulse-flat');
      }
    }
  }

  function refresh() {
    const metrics = computeMetrics({ EventStore, dataManager });
    updateDOM(metrics);
  }

  function show() {
    panel.hidden = false;
    refresh();
  }

  function hide() {
    panel.hidden = true;
  }

  function onCloseClick() {
    hide();
  }

  function onBulk() {
    if (!panel.hidden) refresh();
  }

  ensureRows();
  closeBtn?.addEventListener('click', onCloseClick);
  EventBus?.on?.('event:bulk', onBulk);

  const intervalId = setInterval(refresh, 60 * 1000);
  refresh();

  function destroy() {
    clearInterval(intervalId);
    closeBtn?.removeEventListener('click', onCloseClick);
    EventBus?.off?.('event:bulk', onBulk);
  }

  return { destroy, show, hide, refresh, computeMetrics: (now) => computeMetrics({ EventStore, dataManager }, now) };
}
