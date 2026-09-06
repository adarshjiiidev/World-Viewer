import * as Cesium from 'cesium';
import { isPickedWorldPosition } from './data/scenePick.js';

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function parseItems(xml) {
  if (!xml || typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return [];
  return Array.from(doc.querySelectorAll('item')).slice(0, 8).map((item) => ({
    title: item.querySelector('title')?.textContent?.trim() || '',
    url: item.querySelector('link')?.textContent?.trim() || '#',
    date: item.querySelector('pubDate')?.textContent?.trim() || '',
  })).filter((item) => item.title);
}

export default function initPlaceIntelligence({ viewer } = {}) {
  if (!viewer) return { destroy() {} };
  const panel = document.getElementById('wv-place-intelligence');
  const title = document.getElementById('wv-place-title');
  const location = document.getElementById('wv-place-location');
  const news = document.getElementById('wv-place-news');
  const video = document.getElementById('wv-place-videos');
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  let requestId = 0;

  async function openAt(cartesian) {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    const lat = Cesium.Math.toDegrees(cartographic.latitude);
    const lon = Cesium.Math.toDegrees(cartographic.longitude);
    const id = ++requestId;
    panel.hidden = false;
    title.textContent = 'PLACE INTELLIGENCE';
    location.textContent = `${lat.toFixed(4)}°, ${lon.toFixed(4)}° · locating…`;
    news.innerHTML = '<div class="wv-place-loading">Loading recent public reporting…</div>';
    video.innerHTML = '';
    try {
      const contextRes = await fetch(`/api/place-context?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, { cache: 'no-store' });
      const context = contextRes.ok ? await contextRes.json() : null;
      if (id !== requestId) return;
      const label = context?.label || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
      location.textContent = `${label} · ${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
      const feedRes = await fetch(`/api/world-news?search=${encodeURIComponent(label)}`, { cache: 'no-store' });
      const items = feedRes.ok ? parseItems(await feedRes.text()) : [];
      if (id !== requestId) return;
      news.innerHTML = items.length
        ? items.map((item) => `<a class="wv-place-news-item" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer"><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.date)}</small></a>`).join('')
        : '<div class="wv-place-loading">No recent indexed reporting for this location.</div>';
      const q = encodeURIComponent(`${label} latest news`);
      video.innerHTML = `<a class="wv-place-video" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noreferrer">▶ Search recent video coverage</a>`;
    } catch {
      if (id === requestId) {
        location.textContent = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
        news.innerHTML = '<div class="wv-place-loading">Place intelligence is temporarily unavailable.</div>';
      }
    }
  }

  handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.position);
    // Dedicated entity handlers own contacts; this card is for terrain/city
    // context and must never steal a click-to-track interaction.
    if (picked?.id || picked?.primitive?.id) return;
    const cartesian = viewer.scene.pickPositionSupported ? viewer.scene.pickPosition(movement.position) : viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
    if (isPickedWorldPosition(cartesian)) void openAt(cartesian);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  return { destroy: () => handler.destroy() };
}
