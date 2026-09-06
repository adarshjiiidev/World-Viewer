/*
 * WORLD VIEWER — Cinematic First-Run Loading Experience
 *
 * Drives the existing #loading-screen in index.html:
 *   - Dark background with title "WORLD VIEWER"
 *   - Subtitle "Initializing World Model…"
 *   - Seven system tiles: GLOBE, TERRAIN, AIRCRAFT, MARITIME, SPACE, EARTH, NEWS
 *     Each tile flips from waiting → ✓ ready with staggered delays.
 *   - Fades overlay out to reveal the globe after either:
 *       a) a natural cinematic duration has elapsed AND window.worldViewerReady === true, OR
 *       b) an external caller invokes the returned dismiss() function.
 *
 * The module is idempotent and safe to call multiple times (the second call
 * returns a no-op dismiss handle).
 */

import './styles/firstRun.css';

const TILES = Object.freeze([
  { id: 'wv-init-globe',     label: 'GLOBE',     readyAtMs: 600  },
  { id: 'wv-init-terrain',   label: 'TERRAIN',   readyAtMs: 1200 },
  { id: 'wv-init-aircraft',  label: 'AIRCRAFT',  readyAtMs: 1900 },
  { id: 'wv-init-maritime',  label: 'MARITIME',  readyAtMs: 2500 },
  { id: 'wv-init-space',     label: 'SPACE',     readyAtMs: 3100 },
  { id: 'wv-init-earth',     label: 'EARTH',     readyAtMs: 3700 },
  { id: 'wv-init-news',      label: 'NEWS',      readyAtMs: 4300 },
]);

const CINEMATIC_MIN_MS = 5200;
const FADE_OUT_EXTRA_MS = 120;

const STATUS_LINES = Object.freeze([
  { text: 'Booting geospatial kernel…',     atMs: 200   },
  { text: 'Loading world ellipsoid…',       atMs: 700   },
  { text: 'Streaming terrain mesh…',        atMs: 1300  },
  { text: 'Connecting to ADS-B exchange…',  atMs: 2000  },
  { text: 'Resolving AIS vessel links…',    atMs: 2600  },
  { text: 'Synchronizing orbital catalog…', atMs: 3200  },
  { text: 'Indexing seismic & fire feeds…', atMs: 3800  },
  { text: 'Splicing global event wires…',   atMs: 4400  },
  { text: 'Systems nominal — standing by.', atMs: 5100  },
]);

let initialized = false;
let dismissHandle = null;

function setTileState(tileEl, state) {
  if (!tileEl) return;
  tileEl.classList.remove('wv-init-waiting', 'wv-init-ok', 'wv-init-err');
  const iconEl = tileEl.querySelector('.wv-init-icon');
  if (state === 'waiting') {
    tileEl.classList.add('wv-init-waiting');
    if (iconEl) iconEl.textContent = '○';
  } else if (state === 'ok') {
    tileEl.classList.add('wv-init-ok');
    if (iconEl) iconEl.textContent = '✓';
  } else if (state === 'err') {
    tileEl.classList.add('wv-init-err');
    if (iconEl) iconEl.textContent = '!';
  }
}

function resolveDocument(doc) {
  try { return doc || (typeof document !== 'undefined' ? document : null); }
  catch { return null; }
}

/**
 * Start the cinematic first-run loading sequence.
 *
 * @param {object} [opts]
 * @param {Document|null} [opts.documentRef]
 * @param {number} [opts.cinematicMinMs]  Override the minimum on-screen time (debug).
 * @returns {{dismiss: (force?: boolean) => Promise<void>}}
 */
export function initFirstRunLoading(opts = {}) {
  if (initialized) {
    return { dismiss: dismissHandle || (async () => {}) };
  }
  initialized = true;

  const doc = resolveDocument(opts.documentRef);
  const cinematicMinMs = Number.isFinite(opts.cinematicMinMs)
    ? opts.cinematicMinMs
    : CINEMATIC_MIN_MS;

  const loadingScreen = doc?.getElementById?.('loading-screen');
  if (!loadingScreen) {
    return { dismiss: async () => {} };
  }

  const statusEl = loadingScreen.querySelector('.loader-status');
  const timers = new Set();
  let startedAt = performance.now();
  let dismissed = false;
  let dismissResolve = null;

  const tileHandles = TILES.map((tile) => {
    const el = doc.getElementById(tile.id);
    // Start in waiting state after tile appear-animation lands
    timers.add(setTimeout(() => setTileState(el, 'waiting'), Math.max(200, tile.readyAtMs - 450)));
    // Flip to ready at the staggered delay
    timers.add(setTimeout(() => setTileState(el, 'ok'), tile.readyAtMs));
    return { tile, el };
  });

  for (const line of STATUS_LINES) {
    timers.add(setTimeout(() => {
      if (statusEl && !dismissed) statusEl.textContent = line.text;
    }, line.atMs));
  }

  function clearAllTimers() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  function doFadeOut() {
    if (!loadingScreen.isConnected) {
      dismissResolve?.();
      return;
    }
    loadingScreen.classList.add('hidden');
    const remove = () => {
      loadingScreen.remove();
      dismissResolve?.();
    };
    loadingScreen.addEventListener('transitionend', remove, { once: true });
    timers.add(setTimeout(remove, 900 + FADE_OUT_EXTRA_MS));
  }

  function tryDismiss() {
    if (dismissed) return;
    const elapsed = performance.now() - startedAt;
    const readyFlag = typeof window !== 'undefined' && window.worldViewerReady === true;
    const enoughTime = elapsed >= cinematicMinMs;
    if (!(readyFlag && enoughTime)) return;
    dismissed = true;
    clearAllTimers();
    // Force any straggler tiles to OK so no stuck amber state bleeds through fade
    for (const { el } of tileHandles) setTileState(el, 'ok');
    if (statusEl) statusEl.textContent = 'Revealing world model.';
    doFadeOut();
  }

  // Poll for window.worldViewerReady + minimum cinematic duration
  const pollInterval = setInterval(tryDismiss, 80);
  timers.add(pollInterval);

  // Safety net: never block the app forever even if worldViewerReady never flips
  timers.add(setTimeout(() => {
    if (!dismissed) {
      if (typeof window !== 'undefined') window.worldViewerReady = true;
      tryDismiss();
    }
  }, cinematicMinMs + 8000));

  dismissHandle = async (force = false) => {
    if (force) {
      if (!dismissed) {
        dismissed = true;
        clearAllTimers();
        for (const { el } of tileHandles) setTileState(el, 'ok');
        doFadeOut();
      }
    } else {
      if (typeof window !== 'undefined') window.worldViewerReady = true;
      tryDismiss();
    }
    return new Promise((res) => {
      if (!loadingScreen.isConnected) { res(); return; }
      const prior = dismissResolve;
      dismissResolve = () => { prior?.(); res(); };
    });
  };

  return { dismiss: dismissHandle };
}
