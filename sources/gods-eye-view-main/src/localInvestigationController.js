/** Globe-native place investigation: fly to a place, activate nearby public
 * signals, and ingest a bounded recent-news query into the World Event model. */

import { searchAndFlyTo } from './locations.js';
import IngestPipeline from './events/ingest.js';
import EventBus from './events/bus.js';

const parseRecentNews = (xmlText, place) => {
  if (!xmlText || typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) return [];
  return Array.from(doc.querySelectorAll('item')).slice(0, 24).map((item) => ({
    title: item.querySelector('title')?.textContent?.trim() || '',
    summary: item.querySelector('description')?.textContent?.trim() || '',
    url: item.querySelector('link')?.textContent?.trim() || null,
    publishedAt: item.querySelector('pubDate')?.textContent?.trim() || Date.now(),
    sourceName: 'Google News · recent place query',
    locationText: place,
    tags: ['world-monitor', 'place-investigation'],
  })).filter((item) => item.title);
};

const openEventsSurface = () => {
  const panel = document.getElementById('wv-events-panel');
  if (!panel) return;
  panel.hidden = false;
  panel.classList.remove('hidden');
  document.body.classList.add('wv-events-open');
};

export default function initLocalInvestigation({ viewer, dataManager } = {}) {
  async function investigate(place) {
    const query = String(place || '').trim();
    if (!query) return { ok: false, error: 'Enter a place to investigate' };
    EventBus.emit('investigation:started', { query });
    try {
      const destination = await searchAndFlyTo(viewer, query, { duration: 2.4 });
      if (!destination || destination.cancelled) return { ok: false, error: 'Place was not found' };
      // These layers are bounded by their own camera/zoom policies, so turning
      // them on here creates a local investigation without drawing global noise.
      await Promise.allSettled([
        dataManager?.setEnabled?.('flights', true, { origin: 'place-investigation' }),
        dataManager?.setEnabled?.('ais-live-vessels', true, { origin: 'place-investigation' }),
        dataManager?.setEnabled?.('earthquakes', true, { origin: 'place-investigation' }),
        dataManager?.setEnabled?.('military-installations', true, { origin: 'place-investigation' }),
        dataManager?.setEnabled?.('local-firms', true, { origin: 'place-investigation' }),
      ]);
      const response = await fetch(`/api/world-news?search=${encodeURIComponent(query)}`, { cache: 'no-store' });
      const articles = response.ok ? parseRecentNews(await response.text(), query) : [];
      const events = articles.length ? IngestPipeline.ingestBulk(articles) : [];
      openEventsSurface();
      const result = { ok: true, query, destination, articleCount: articles.length, eventCount: events.length };
      EventBus.emit('investigation:complete', result);
      return result;
    } catch (error) {
      const result = { ok: false, query, error: error?.message || 'Investigation unavailable' };
      EventBus.emit('investigation:error', result);
      return result;
    }
  }
  return { investigate };
}
