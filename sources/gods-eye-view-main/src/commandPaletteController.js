function fuzzyMatch(text, query) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export default function initCommandPalette({
  viewer,
  styleManager,
  dataManager,
  sceneDirector,
  annotations,
  EventBus,
  EntityStore,
  EventStore,
  investigatePlace,
} = {}) {
  const palette = document.getElementById('wv-command-palette');
  const backdrop = document.querySelector('.wv-palette-backdrop');
  const input = document.getElementById('wv-palette-input');
  const results = document.querySelector('.wv-palette-results');
  if (!palette || !input) {
    return { destroy: () => {}, show: () => {}, hide: () => {} };
  }

  let lastFocusedEl = null;
  let selectedIndex = -1;
  let visibleRows = [];
  let isOpen = false;

  function setARIA(open) {
    palette.setAttribute('role', 'dialog');
    palette.setAttribute('aria-modal', open ? 'true' : 'false');
    palette.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function show() {
    if (isOpen) return;
    isOpen = true;
    lastFocusedEl = document.activeElement;
    palette.classList.remove('hidden');
    if (backdrop) backdrop.classList.remove('hidden');
    setARIA(true);
    setTimeout(() => {
      input.value = '';
      input.focus();
      filterResults('');
    }, 10);
  }

  function hide() {
    if (!isOpen) return;
    isOpen = false;
    palette.classList.add('hidden');
    if (backdrop) backdrop.classList.add('hidden');
    setARIA(false);
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
      lastFocusedEl.focus();
    }
  }

  function filterResults(query) {
    const rows = Array.from(results?.querySelectorAll('.wv-palette-result') || []);
    visibleRows = [];
    rows.forEach((row) => {
      const txt = row.textContent || '';
      const match = fuzzyMatch(txt, query);
      row.style.display = match ? '' : 'none';
      if (match) visibleRows.push(row);
    });
    selectedIndex = visibleRows.length > 0 ? 0 : -1;
    updateSelection();
  }

  function updateSelection() {
    visibleRows.forEach((row, i) => {
      row.classList.toggle('selected', i === selectedIndex);
    });
  }

  function moveSelection(delta) {
    if (visibleRows.length === 0) return;
    selectedIndex = (selectedIndex + delta + visibleRows.length) % visibleRows.length;
    updateSelection();
    visibleRows[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function dispatchCommand(row) {
    const cmd = row?.dataset?.cmd;
    if (!cmd) return;

    switch (cmd) {
      case 'global-context':
        if (typeof styleManager?.setPanelCollapsed === 'function') {
          styleManager.setPanelCollapsed('global-context-panel', false, { explicit: true });
        } else {
          document.getElementById('global-context-panel')?.classList.remove('collapsed');
        }
        break;
      case 'layer-aircraft':
        dataManager?.setEnabled?.('flights', true, { origin: 'user' });
        break;
      case 'layer-vessels':
        dataManager?.setEnabled?.('ais-live-vessels', true, { origin: 'user' });
        break;
      case 'layer-satellites':
        dataManager?.setEnabled?.('satellites', true, { origin: 'user' });
        break;
      case 'layer-earthquakes':
        dataManager?.setEnabled?.('earthquakes', true, { origin: 'user' });
        break;
      case 'layer-fires':
        dataManager?.setEnabled?.('local-firms', true, { origin: 'user' });
        break;
      case 'layer-events':
        document.getElementById('wv-events-panel')?.classList.toggle('hidden');
        break;
      case 'layer-cables':
        dataManager?.setEnabled?.('telegeography-submarine-cables', true, { origin: 'user' });
        break;
      case 'sensor-nvg':
        styleManager?.setStyle?.('surveillance');
        break;
      case 'sensor-flir':
        styleManager?.setStyle?.('thermal');
        break;
      case 'sensor-normal':
        styleManager?.setStyle?.('normal');
        break;
      case 'reset':
        styleManager?.resetToGlobeView?.();
        break;
      case 'world-pulse': {
        const pulse = document.getElementById('wv-world-pulse');
        if (pulse) {
          pulse.hidden = !pulse.hidden;
        }
        break;
      }
      default:
        break;
    }

    EventBus?.emit?.('command:executed', { cmd });
    hide();
  }

  function onKeyDown(e) {
    if (e.ctrlKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      show();
      return;
    }
    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        hide();
        return;
      }
    }
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveSelection(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveSelection(-1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && visibleRows[selectedIndex]) {
          dispatchCommand(visibleRows[selectedIndex]);
        } else if (input.value.trim() && typeof investigatePlace === 'function') {
          void investigatePlace(input.value.trim()).then((result) => {
            if (result?.ok) hide();
          });
        }
        break;
      case 'Tab':
        e.preventDefault();
        moveSelection(e.shiftKey ? -1 : 1);
        break;
      default:
        break;
    }
  }

  function onInput() {
    filterResults(input.value);
  }

  function onBackdropClick(e) {
    if (e.target === backdrop) hide();
  }

  function onResultsClick(e) {
    const row = e.target.closest('.wv-palette-result');
    if (row) dispatchCommand(row);
  }

  document.addEventListener('keydown', onKeyDown);
  input?.addEventListener('input', onInput);
  backdrop?.addEventListener('click', onBackdropClick);
  results?.addEventListener('click', onResultsClick);

  setARIA(false);

  function destroy() {
    document.removeEventListener('keydown', onKeyDown);
    input?.removeEventListener('input', onInput);
    backdrop?.removeEventListener('click', onBackdropClick);
    results?.removeEventListener('click', onResultsClick);
  }

  return { destroy, show, hide };
}
