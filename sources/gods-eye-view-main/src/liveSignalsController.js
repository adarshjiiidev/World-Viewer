/** A compact, truthful launcher for the public live data already available in
 * WORLD VIEWER. It intentionally reports provider prerequisites rather than
 * presenting delayed, simulated, or unavailable sources as live. */

const SIGNALS = Object.freeze([
  { id: 'flights', name: 'AIRCRAFT', note: 'OpenSky / ADS-B state vectors', required: false },
  { id: 'ais-live-vessels', name: 'VESSELS', note: 'AISStream vessel transponders', required: true },
  { id: 'traffic', name: 'ROAD FLOW', note: 'TomTom traffic flow / aggregate fallback', required: false },
  { id: 'satellites', name: 'SATELLITES', note: 'CelesTrak elements + local propagation', required: false },
  { id: 'earthquakes', name: 'EARTHQUAKES', note: 'USGS real-time GeoJSON feed', required: false },
  { id: 'local-firms', name: 'ACTIVE FIRES', note: 'NASA FIRMS thermal detections', required: true },
]);

function entryFor(dataManager, id) {
  return dataManager?.layers?.get?.(id) || null;
}

function statusFor(dataManager, signal) {
  const entry = entryFor(dataManager, signal.id);
  const stats = entry?.module?.getStats?.() || {};
  if (entry?.enabled && (stats.status === 'live' || stats.status === 'online' || stats.count > 0)) return 'LIVE';
  if (entry?.enabled && (stats.status === 'missing-key' || stats.status === 'auth_required' || stats.unavailable)) return 'KEY REQUIRED';
  if (entry?.enabled) return 'CONNECTING';
  return signal.required ? 'OPTIONAL KEY' : 'READY';
}

export default function initLiveSignals({ dataManager } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'wv-live-signals-trigger';
  button.innerHTML = '<span class="wv-live-dot"></span> LIVE SIGNALS';
  button.title = 'Activate public live layers';
  const panel = document.createElement('section');
  panel.id = 'wv-live-signals';
  panel.setAttribute('data-wv-floating-panel', '');
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Public live data signals');
  panel.innerHTML = '<header data-wv-panel-handle><span>PUBLIC LIVE SIGNALS</span><button type="button" data-live-activate>ACTIVATE AVAILABLE</button></header><div class="wv-live-signals-list"></div><footer>Positions and flow are public-source observations; availability varies by provider.</footer>';
  document.body.append(button, panel);
  const list = panel.querySelector('.wv-live-signals-list');
  let timer = null;

  function render() {
    list.innerHTML = SIGNALS.map((signal) => `<button type="button" data-live-layer="${signal.id}"><span><b>${signal.name}</b><small>${signal.note}</small></span><em data-live-status="${signal.id}">${statusFor(dataManager, signal)}</em></button>`).join('');
  }
  async function activateAll() {
    button.disabled = true;
    await Promise.allSettled(SIGNALS.map((signal) => dataManager?.setEnabled?.(signal.id, true, { origin: 'live-signals' })));
    button.disabled = false;
    render();
  }
  button.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) render();
  });
  panel.addEventListener('click', (event) => {
    if (event.target.closest('[data-live-activate]')) {
      void activateAll();
      return;
    }
    const row = event.target.closest('[data-live-layer]');
    if (!row) return;
    const id = row.dataset.liveLayer;
    const enabled = Boolean(entryFor(dataManager, id)?.enabled);
    void dataManager?.setEnabled?.(id, !enabled, { origin: 'live-signals' }).finally(render);
  });
  timer = setInterval(() => { if (!panel.hidden) render(); }, 5_000);
  return { show: () => { panel.hidden = false; render(); }, hide: () => { panel.hidden = true; }, activateAll, destroy: () => { clearInterval(timer); button.remove(); panel.remove(); } };
}
