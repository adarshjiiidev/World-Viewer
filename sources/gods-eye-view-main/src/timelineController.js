import './styles/timeline.css';

const PRESETS = [
  { key: 'LIVE', label: 'LIVE', value: 'live' },
  { key: '15M', label: '15M', value: '15m' },
  { key: '1H', label: '1H', value: '1h' },
  { key: '6H', label: '6H', value: '6h' },
  { key: '12H', label: '12H', value: '12h' },
  { key: '24H', label: '24H', value: '24h' },
  { key: '7D', label: '7D', value: '7d' },
  { key: '30D', label: '30D', value: '30d' },
  { key: 'CUSTOM', label: 'CUSTOM', value: 'custom' },
];

const SPEED_CYCLE = [1, 2, 0.5];
const PLAY_ICON = '▶';
const PAUSE_ICON = '❚❚';

function pad2(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

function formatScrubTime(pct, modeValue) {
  const now = Date.now();
  switch (modeValue) {
    case '15m': {
      const t = now - (1 - pct) * 15 * 60 * 1000;
      const d = new Date(t);
      return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }
    case '1h':
    case '6h':
    case '12h':
    case '24h': {
      const hr = { '1h': 1, '6h': 6, '12h': 12, '24h': 24 }[modeValue];
      const t = now - (1 - pct) * hr * 60 * 60 * 1000;
      const d = new Date(t);
      return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }
    case '7d':
    case '30d': {
      const days = modeValue === '7d' ? 7 : 30;
      const t = now - (1 - pct) * days * 24 * 60 * 60 * 1000;
      const d = new Date(t);
      return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
    }
    case 'live':
    default: {
      const d = new Date(now);
      return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }
  }
}

function modalActive() {
  const ids = ['wv-command-palette', 'wv-world-pulse', 'wv-events-panel'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && !el.hidden && !el.classList.contains('hidden')) return true;
  }
  return false;
}

let state = {
  scrubValue: 100,
  isPlaying: false,
  preset: 'live',
  speed: 1,
  wrapOnEnd: false,
};

const listeners = new Set();

function emitChange() {
  for (const fn of listeners) {
    try { fn({ ...state }); } catch {}
  }
}

export function getState() {
  return { ...state };
}

export function setState(patch) {
  state = { ...state, ...patch };
  emitChange();
  return state;
}

export function play() {
  if (state.isPlaying) return { ...state };
  state.isPlaying = true;
  emitChange();
  return { ...state };
}

export function pause() {
  if (!state.isPlaying) return { ...state };
  state.isPlaying = false;
  emitChange();
  return { ...state };
}

export default function initTimeline({
  viewer,
  styleManager,
  dataManager,
  sceneDirector,
  annotations,
  EventBus,
  EntityStore,
  EventStore,
} = {}) {
  const bar = document.createElement('div');
  bar.className = 'wv-timeline-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Playback timeline control');

  const presetsWrap = document.createElement('div');
  presetsWrap.className = 'wv-tl-presets';
  const chipEls = new Map();
  for (const p of PRESETS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'wv-tl-chip';
    chip.dataset.preset = p.key;
    chip.textContent = p.label;
    chip.setAttribute('aria-pressed', p.key === 'LIVE' ? 'true' : 'false');
    chip.addEventListener('click', () => selectPreset(p.key));
    presetsWrap.appendChild(chip);
    chipEls.set(p.key, chip);
  }
  chipEls.get('LIVE')?.classList.add('is-selected');

  const scrubWrap = document.createElement('div');
  scrubWrap.className = 'wv-tl-scrub-wrap';

  const leftLabel = document.createElement('div');
  leftLabel.className = 'wv-tl-label';
  leftLabel.textContent = 'PLAYBACK POSITION';

  const scrub = document.createElement('input');
  scrub.type = 'range';
  scrub.min = '0';
  scrub.max = '100';
  scrub.value = String(state.scrubValue);
  scrub.className = 'wv-tl-scrub';
  scrub.setAttribute('aria-label', 'Playback position scrubber');
  scrub.style.setProperty('--wv-tl-progress', state.scrubValue + '%');

  const scrubTime = document.createElement('div');
  scrubTime.className = 'wv-tl-time';
  scrubTime.textContent = formatScrubTime(state.scrubValue, state.preset);

  scrubWrap.appendChild(leftLabel);
  scrubWrap.appendChild(scrub);
  scrubWrap.appendChild(scrubTime);

  const controls = document.createElement('div');
  controls.className = 'wv-tl-controls';

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'wv-tl-play';
  playBtn.setAttribute('aria-label', 'Play or pause playback');
  playBtn.textContent = PLAY_ICON;

  const speedWrap = document.createElement('div');
  speedWrap.className = 'wv-tl-speed';
  const speedChip = document.createElement('button');
  speedChip.type = 'button';
  speedChip.className = 'wv-tl-chip';
  speedChip.textContent = state.speed + '×';
  speedChip.title = 'Playback speed';
  speedChip.addEventListener('click', cycleSpeed);
  speedWrap.appendChild(speedChip);

  controls.appendChild(playBtn);
  controls.appendChild(speedWrap);

  bar.appendChild(presetsWrap);
  bar.appendChild(scrubWrap);
  bar.appendChild(controls);
  document.body.appendChild(bar);

  function syncChipSelection(key) {
    for (const [k, el] of chipEls) {
      const on = k === key;
      el.classList.toggle('is-selected', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function updateScrubVisual() {
    scrub.value = String(state.scrubValue);
    scrub.style.setProperty('--wv-tl-progress', state.scrubValue + '%');
    scrubTime.textContent = formatScrubTime(state.scrubValue, state.preset);
  }

  function syncPlayButton() {
    playBtn.textContent = state.isPlaying ? PAUSE_ICON : PLAY_ICON;
    playBtn.classList.toggle('is-playing', state.isPlaying);
  }

  function syncAllFromState() {
    const presetObj = PRESETS.find((p) => p.value === state.preset);
    if (presetObj) syncChipSelection(presetObj.key);
    updateScrubVisual();
    syncPlayButton();
    speedChip.textContent = state.speed + '×';
  }

  function selectPreset(key) {
    const preset = PRESETS.find((p) => p.key === key);
    if (!preset) return;
    state.preset = preset.value;
    syncChipSelection(key);
    EventBus?.emit?.('timeline:seek', { mode: 'preset', value: preset.value });
    state.scrubValue = 100;
    updateScrubVisual();
    emitChange();
  }

  function cycleSpeed() {
    const idx = SPEED_CYCLE.indexOf(state.speed);
    const next = SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length];
    state.speed = next;
    speedChip.textContent = next + '×';
    emitChange();
  }

  function onScrubInput() {
    const v = parseInt(scrub.value, 10);
    if (isNaN(v)) return;
    state.scrubValue = Math.max(0, Math.min(100, v));
    scrub.style.setProperty('--wv-tl-progress', state.scrubValue + '%');
    scrubTime.textContent = formatScrubTime(state.scrubValue, state.preset);
    EventBus?.emit?.('timeline:seek', { mode: 'scrub', value: state.scrubValue / 100 });
    emitChange();
  }

  function localPlay() {
    play();
  }

  function localPause() {
    pause();
  }

  playBtn.addEventListener('click', () => {
    if (state.isPlaying) localPause();
    else localPlay();
  });

  scrub.addEventListener('input', onScrubInput);

  function onKey(e) {
    if (e.key !== ' ') return;
    if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target;
    if (target && target.matches) {
      if (target.matches('input, textarea, select')) return;
    }
    if (modalActive()) return;
    e.preventDefault();
    if (state.isPlaying) localPause();
    else localPlay();
  }

  document.addEventListener('keydown', onKey);

  let rafId = null;
  let lastFrame = 0;
  function tick(ts) {
    if (!state.isPlaying) {
      rafId = null;
      return;
    }
    if (!lastFrame) lastFrame = ts;
    const dt = (ts - lastFrame) / 1000;
    lastFrame = ts;
    const advance = dt * 6 * state.speed;
    let next = state.scrubValue + advance;
    let wrapped = false;
    if (next >= 100) {
      if (state.wrapOnEnd) {
        next = 0;
        wrapped = true;
      } else {
        next = 100;
        pause();
      }
    } else if (next < 0) {
      next = 0;
    }
    state.scrubValue = next;
    updateScrubVisual();
    EventBus?.emit?.('timeline:tick', {
      value: state.scrubValue / 100,
      dt,
      speed: state.speed,
      wrapped,
    });
    emitChange();
    rafId = requestAnimationFrame(tick);
  }

  function ensureLoop() {
    if (state.isPlaying && rafId == null) {
      lastFrame = 0;
      rafId = requestAnimationFrame(tick);
    }
  }

  function onStateChange(s) {
    syncPlayButton();
    ensureLoop();
  }
  listeners.add(onStateChange);

  updateScrubVisual();
  syncPlayButton();
  ensureLoop();

  function destroy() {
    document.removeEventListener('keydown', onKey);
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
    listeners.delete(onStateChange);
    bar.remove();
  }

  function show() {
    bar.classList.remove('hidden');
    bar.style.display = '';
  }
  function hide() {
    bar.classList.add('hidden');
    bar.style.display = 'none';
  }
  function toggle() {
    if (bar.classList.contains('hidden') || bar.style.display === 'none') show();
    else hide();
  }

  return {
    destroy,
    play: localPlay,
    pause: localPause,
    getState,
    setState: (patch) => {
      const next = setState(patch);
      syncAllFromState();
      ensureLoop();
      return next;
    },
    selectPreset,
    getBar: () => bar,
    show,
    hide,
    toggle,
  };
}
