/** Makes WORLD VIEWER's floating intelligence surfaces movable, resizable,
 * collapsible, and closable without turning the globe into a dashboard. */

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

export default function initFloatingPanels() {
  const cleanups = [];
  document.querySelectorAll('[data-wv-floating-panel]').forEach((panel) => {
    const header = panel.querySelector('[data-wv-panel-handle]') || panel.firstElementChild;
    if (!header) return;
    panel.classList.add('wv-floating-panel');
    header.classList.add('wv-panel-handle');

    const tools = document.createElement('div');
    tools.className = 'wv-panel-tools';
    tools.innerHTML = '<button type="button" data-wv-panel-minimize aria-label="Collapse panel" title="Collapse panel">—</button><button type="button" data-wv-panel-close aria-label="Close panel" title="Close panel">×</button>';
    header.appendChild(tools);
    const minimize = tools.querySelector('[data-wv-panel-minimize]');
    const close = tools.querySelector('[data-wv-panel-close]');
    const toggle = () => {
      const collapsed = panel.classList.toggle('wv-panel-collapsed');
      minimize.textContent = collapsed ? '+' : '—';
      minimize.setAttribute('aria-label', collapsed ? 'Expand panel' : 'Collapse panel');
    };
    const hide = () => {
      panel.hidden = true;
      panel.classList.remove('wv-panel-collapsed');
    };
    minimize.addEventListener('click', toggle);
    close.addEventListener('click', hide);
    cleanups.push(() => { minimize.removeEventListener('click', toggle); close.removeEventListener('click', hide); });

    let drag = null;
    const onMove = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
      panel.style.left = `${clamp(drag.left + event.clientX - drag.x, 8, maxLeft)}px`;
      panel.style.top = `${clamp(drag.top + event.clientY - drag.y, 8, maxTop)}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    };
    const onUp = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      header.releasePointerCapture?.(event.pointerId);
      drag = null;
    };
    const onDown = (event) => {
      if (event.button !== 0 || event.target.closest('button,input,a')) return;
      const rect = panel.getBoundingClientRect();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      header.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };
    header.addEventListener('pointerdown', onDown);
    header.addEventListener('pointermove', onMove);
    header.addEventListener('pointerup', onUp);
    header.addEventListener('pointercancel', onUp);
    cleanups.push(() => {
      header.removeEventListener('pointerdown', onDown);
      header.removeEventListener('pointermove', onMove);
      header.removeEventListener('pointerup', onUp);
      header.removeEventListener('pointercancel', onUp);
    });
  });
  return { destroy: () => cleanups.forEach((fn) => fn()) };
}
