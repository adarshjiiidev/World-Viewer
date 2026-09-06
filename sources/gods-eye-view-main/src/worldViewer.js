/**
 * WORLD VIEWER — Main Orchestration Module
 *
 * Runs AFTER God's Eye View initializes. Extends it with:
 * - Command palette (Ctrl+K)
 * - World Pulse live indicators
 * - World Events (GDELT, ReliefWeb, GDACS, RSS)
 * - Hotspot detection
 * - Geopolitical intelligence layers
 * - Alert engine
 * - Groq AI contextual intelligence
 * - Cinematic loading sequence
 * - Native Electron integration (when running as desktop app)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — LOADING SEQUENCE (Cinematic WORLD VIEWER startup)
// ═══════════════════════════════════════════════════════════════════════════════

function markLoaderItem(id, status = 'ok') {
  const el = document.getElementById(id);
  if (!el) return;
  const icon = el.querySelector('.wv-init-icon');
  if (icon) {
    icon.textContent = status === 'ok' ? '✓' : status === 'waiting' ? '◌' : '✗';
    icon.style.color = status === 'ok' ? '#00ff88' : status === 'waiting' ? '#ffaa00' : '#ff4444';
  }
  el.classList.add(`wv-init-${status}`);
}

// Animate the cinematic loader items with staggered reveals
function animateCinematicLoader() {
  const items = ['wv-init-globe', 'wv-init-terrain', 'wv-init-aircraft',
                 'wv-init-maritime', 'wv-init-space', 'wv-init-earth', 'wv-init-news'];
  items.forEach((id, i) => {
    setTimeout(() => markLoaderItem(id, 'waiting'), i * 200);
  });

  // Mark globe/terrain as OK after a short delay (Cesium is already booting)
  setTimeout(() => markLoaderItem('wv-init-globe', 'ok'), 800);
  setTimeout(() => markLoaderItem('wv-init-terrain', 'ok'), 1200);
  // Aircraft, maritime, space come from God's Eye layer load events
  setTimeout(() => markLoaderItem('wv-init-aircraft', 'waiting'), 1400);
  setTimeout(() => markLoaderItem('wv-init-maritime', 'waiting'), 1600);
  setTimeout(() => markLoaderItem('wv-init-space', 'ok'), 1800);
  setTimeout(() => markLoaderItem('wv-init-earth', 'ok'), 2000);
  setTimeout(() => markLoaderItem('wv-init-news', 'waiting'), 2200);
}

animateCinematicLoader();

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — ELECTRON INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

const IS_ELECTRON = typeof window !== 'undefined' && window.worldViewerAPI?.isElectron === true;

function sendDesktopNotification(title, body, urgency = 'normal') {
  if (IS_ELECTRON && window.worldViewerAPI?.sendNotification) {
    window.worldViewerAPI.sendNotification(title, body, urgency);
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function copyToClipboard(text) {
  if (IS_ELECTRON && window.worldViewerAPI?.copyToClipboard) {
    window.worldViewerAPI.copyToClipboard(text);
  } else {
    navigator.clipboard?.writeText(text).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — WORLD MODEL (Entity Bus + Ring Buffer)
// ═══════════════════════════════════════════════════════════════════════════════

const WV_RING_BUFFER_SIZE = 2000;

class WorldEventBus {
  constructor() {
    this._events = [];
    this._subscribers = new Map();
    this._entities = new Map();
    this._hotspots = [];
  }

  publish(event) {
    // Normalize
    if (!event.id) event.id = `ev-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    if (!event.timestamp) event.timestamp = Date.now();

    // Ring buffer
    this._events.push(event);
    if (this._events.length > WV_RING_BUFFER_SIZE) {
      this._events.shift();
    }

    // Notify subscribers
    for (const [topic, handlers] of this._subscribers) {
      if (topic === 'all' || topic === event.type) {
        handlers.forEach(h => { try { h(event); } catch (e) { console.warn('[WV Bus]', e); } });
      }
    }
  }

  subscribe(topic, handler) {
    if (!this._subscribers.has(topic)) this._subscribers.set(topic, new Set());
    this._subscribers.get(topic).add(handler);
    return () => this._subscribers.get(topic)?.delete(handler);
  }

  getRecent(windowMs = 3600000, type = null) {
    const cutoff = Date.now() - windowMs;
    return this._events.filter(e =>
      e.timestamp >= cutoff && (!type || e.type === type)
    );
  }

  getEventsInRegion(lat, lon, radiusKm = 500, windowMs = 86400000) {
    const recent = this.getRecent(windowMs);
    return recent.filter(e => {
      if (!e.lat || !e.lon) return false;
      const d = haversineKm(lat, lon, e.lat, e.lon);
      return d <= radiusKm;
    });
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Global event bus instance
const worldBus = new WorldEventBus();
window.__worldViewer = { worldBus };

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — DATA PROVIDERS (GDELT, GDACS, RSS, ReliefWeb)
// ═══════════════════════════════════════════════════════════════════════════════

// ── GDELT Provider ─────────────────────────────────────────────────────────────
// Uses GDELT 2.0 DOC API — fully public, no key required
const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';

async function fetchGdeltEvents() {
  try {
    const params = new URLSearchParams({
      query: 'sourcelang:english',
      mode: 'ArtList',
      maxrecords: '50',
      timespan: '60',  // last 60 minutes
      format: 'json',
    });
    const url = `${GDELT_BASE}?${params}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`GDELT HTTP ${resp.status}`);
    const data = await resp.json();
    const articles = data.articles || [];
    return articles.map(a => ({
      id: `gdelt-${a.url ? btoa(a.url).slice(0,12) : Math.random().toString(36).slice(2)}`,
      type: classifyGdeltArticle(a),
      title: a.title || 'World Event',
      summary: a.title || '',
      url: a.url,
      source: a.domain || 'GDELT',
      provider: 'GDELT',
      lat: a.socialshares ? null : null, // GDELT ArtList doesn't include geocoords
      lon: null,
      country: a.sourcecountry,
      language: a.sourcelang,
      sentiment: a.tone ? parseFloat(a.tone) : 0,
      timestamp: a.seendate ? parseGdeltDate(a.seendate) : Date.now(),
      confidence: 0.7,
      freshness: 'RECENT',
    }));
  } catch (e) {
    console.warn('[WORLD VIEWER] GDELT fetch failed:', e.message);
    return [];
  }
}

function parseGdeltDate(dateStr) {
  // GDELT format: YYYYMMDDHHMMSS
  try {
    const s = String(dateStr);
    return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}Z`).getTime();
  } catch { return Date.now(); }
}

function classifyGdeltArticle(article) {
  const title = (article.title || '').toLowerCase();
  if (/war|conflict|attack|military|missile|airstrike|bombing|troops|killed in|forces/i.test(title)) return 'CONFLICT';
  if (/protest|demonstrat|riot|unrest|march|rally/i.test(title)) return 'PROTEST';
  if (/earthquake|quake|seismic|tsunami/i.test(title)) return 'EARTHQUAKE';
  if (/wildfire|fire|flood|hurricane|typhoon|cyclone|disaster|storm/i.test(title)) return 'DISASTER';
  if (/election|vote|president|minister|diplomat|sanction|treaty/i.test(title)) return 'POLITICAL';
  if (/outage|cyber|hack|breach|internet/i.test(title)) return 'CYBER';
  if (/launch|rocket|satellite|space|orbit/i.test(title)) return 'SPACE';
  return 'NEWS';
}

// ── GDACS Provider ─────────────────────────────────────────────────────────────
// Global Disaster Alert and Coordination System — public RSS/JSON
async function fetchGdacsEvents() {
  try {
    const resp = await fetch(
      'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventlist=EQ,TC,FL,DR,VO,TS&alertlevel=Red,Orange',
      { signal: AbortSignal.timeout(10000) }
    );
    if (!resp.ok) throw new Error(`GDACS ${resp.status}`);
    const data = await resp.json();
    const features = data.features || [];
    return features.map(f => {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates;
      return {
        id: `gdacs-${p.eventid || Math.random().toString(36).slice(2)}`,
        type: gdacsTypeMap(p.eventtype),
        title: p.name || p.eventtype || 'GDACS Alert',
        summary: p.description || p.htmldescription || '',
        source: 'GDACS',
        provider: 'GDACS',
        lat: coords ? coords[1] : null,
        lon: coords ? coords[0] : null,
        country: p.country,
        severity: gdacsSeverity(p.alertlevel),
        alertLevel: p.alertlevel,
        timestamp: p.fromdate ? new Date(p.fromdate).getTime() : Date.now(),
        confidence: 0.9,
        freshness: 'LIVE',
        url: p.url?.report,
      };
    });
  } catch (e) {
    console.warn('[WORLD VIEWER] GDACS fetch failed:', e.message);
    return [];
  }
}

function gdacsTypeMap(type) {
  const m = { EQ: 'EARTHQUAKE', TC: 'DISASTER', FL: 'DISASTER', DR: 'DISASTER', VO: 'DISASTER', TS: 'DISASTER' };
  return m[type] || 'DISASTER';
}

function gdacsSeverity(level) {
  return { Red: 'HIGH', Orange: 'MEDIUM', Green: 'LOW' }[level] || 'LOW';
}

// ── ReliefWeb Provider ─────────────────────────────────────────────────────────
// UN OCHA ReliefWeb — public API, no key required
async function fetchReliefWebEvents() {
  try {
    const body = {
      preset: 'latest',
      limit: 30,
      filter: { field: 'status', value: 'ongoing' },
      fields: { include: ['name', 'country', 'date', 'type', 'url', 'description'] },
    };
    const resp = await fetch('https://api.reliefweb.int/v1/disasters?appname=worldviewer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error(`ReliefWeb ${resp.status}`);
    const data = await resp.json();
    return (data.data || []).map(item => {
      const f = item.fields || {};
      const country = f.country?.[0];
      return {
        id: `reliefweb-${item.id}`,
        type: 'HUMANITARIAN',
        title: f.name || 'Humanitarian Event',
        summary: f.description || '',
        source: 'ReliefWeb / UNOCHA',
        provider: 'ReliefWeb',
        lat: country?.location?.lat || null,
        lon: country?.location?.lon || null,
        country: country?.name,
        timestamp: f.date?.created ? new Date(f.date.created).getTime() : Date.now(),
        confidence: 0.85,
        freshness: 'RECENT',
        url: f.url,
        severity: 'MEDIUM',
      };
    });
  } catch (e) {
    console.warn('[WORLD VIEWER] ReliefWeb fetch failed:', e.message);
    return [];
  }
}

// ── RSS News Feeds ──────────────────────────────────────────────────────────────
// BBC, Al Jazeera, DW, France 24 — all free, no keys
const RSS_FEEDS = [
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', country: 'GB' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', country: 'QA' },
  { name: 'DW World', url: 'https://rss.dw.com/xml/rss-en-world', country: 'DE' },
  { name: 'France 24', url: 'https://www.france24.com/en/rss', country: 'FR' },
  { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/worldNews', country: 'GB' },
];

const RSS_PROXY = 'https://api.allorigins.win/raw?url=';

async function fetchRssFeed(feed) {
  try {
    const resp = await fetch(`${RSS_PROXY}${encodeURIComponent(feed.url)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) throw new Error(`RSS ${resp.status}`);
    const text = await resp.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    const items = Array.from(xml.querySelectorAll('item')).slice(0, 15);
    return items.map(item => {
      const title = item.querySelector('title')?.textContent?.trim() || '';
      const link = item.querySelector('link')?.textContent?.trim() || '';
      const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
      const desc = item.querySelector('description')?.textContent?.trim() || '';
      return {
        id: `rss-${feed.name.replace(/\s/g,'')}-${btoa(link).slice(0,10)}`,
        type: classifyGdeltArticle({ title }),
        title,
        summary: desc.replace(/<[^>]+>/g, '').slice(0, 200),
        source: feed.name,
        provider: 'RSS',
        lat: null,
        lon: null,
        country: feed.country,
        timestamp: pubDate ? new Date(pubDate).getTime() : Date.now(),
        confidence: 0.75,
        freshness: 'RECENT',
        url: link,
        severity: 'LOW',
      };
    });
  } catch (e) {
    console.warn(`[WORLD VIEWER] RSS feed ${feed.name} failed:`, e.message);
    return [];
  }
}

async function fetchAllRssFeeds() {
  const results = await Promise.allSettled(RSS_FEEDS.map(fetchRssFeed));
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// ── Cloud Outages Provider ──────────────────────────────────────────────────────
async function fetchCloudOutages() {
  const statusPages = [
    { name: 'AWS', url: 'https://status.aws.amazon.com/data.json', parser: parseAwsStatus },
    // GCP and Azure status pages have CORS — skip, use public aggregators
  ];
  const results = [];
  for (const page of statusPages) {
    try {
      const resp = await fetch(page.url, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        const data = await resp.json();
        const events = page.parser(data);
        results.push(...events);
      }
    } catch { /* non-critical */ }
  }
  return results;
}

function parseAwsStatus(data) {
  const events = [];
  const services = data?.archive?.recent_events || [];
  services.forEach(ev => {
    if (ev.status > 0) {
      events.push({
        id: `aws-${ev.service_name}-${ev.start_time}`,
        type: 'CYBER',
        title: `AWS: ${ev.service_name} - ${ev.summary || 'Service issue'}`,
        summary: ev.message || '',
        source: 'AWS Status',
        provider: 'AWS',
        lat: null, lon: null,
        timestamp: ev.start_time ? ev.start_time * 1000 : Date.now(),
        confidence: 0.95,
        freshness: 'LIVE',
        severity: ev.status >= 2 ? 'HIGH' : 'MEDIUM',
      });
    }
  });
  return events;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — EVENT ENGINE (Collect → Deduplicate → Publish)
// ═══════════════════════════════════════════════════════════════════════════════

const seenEventIds = new Set();
const DEDUP_WINDOW_MS = 3600000; // 1 hour

function publishIfNew(event) {
  if (seenEventIds.has(event.id)) return;
  seenEventIds.add(event.id);
  // Clean up old IDs periodically
  if (seenEventIds.size > 5000) {
    const arr = [...seenEventIds];
    arr.slice(0, 2000).forEach(id => seenEventIds.delete(id));
  }
  worldBus.publish(event);
}

async function runEventIngestion() {
  console.log('[WORLD VIEWER] Starting event ingestion...');

  // Fetch all sources in parallel
  const [gdeltEvents, gdacsEvents, reliefWebEvents, rssEvents] = await Promise.allSettled([
    fetchGdeltEvents(),
    fetchGdacsEvents(),
    fetchReliefWebEvents(),
    fetchAllRssFeeds(),
  ]);

  const all = [
    ...(gdeltEvents.status === 'fulfilled' ? gdeltEvents.value : []),
    ...(gdacsEvents.status === 'fulfilled' ? gdacsEvents.value : []),
    ...(reliefWebEvents.status === 'fulfilled' ? reliefWebEvents.value : []),
    ...(rssEvents.status === 'fulfilled' ? rssEvents.value : []),
  ];

  // Publish unique events
  let published = 0;
  all.forEach(ev => {
    publishIfNew(ev);
    published++;
  });

  console.log(`[WORLD VIEWER] Ingested ${published} events from ${all.length} raw items`);
  markLoaderItem('wv-init-news', published > 0 ? 'ok' : 'waiting');

  // Update World Pulse with fresh counts
  updateWorldPulse();

  // Update events panel if open
  if (!document.getElementById('wv-events-panel')?.hidden) {
    renderEventsList(currentEventFilter);
  }

  // Hotspot detection
  detectHotspots();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — WORLD PULSE (Live Global Indicators)
// ═══════════════════════════════════════════════════════════════════════════════

// Historical values for trend calculation
const pulseHistory = {};

function updateWorldPulse() {
  const recent = worldBus.getRecent(3600000); // last 1 hour
  const older  = worldBus.getRecent(7200000); // last 2 hours (for trend)

  function countType(arr, type) {
    return arr.filter(e => e.type === type || (type === 'CONFLICT' && e.type === 'CONFLICT')).length;
  }

  function score(current, max = 30) {
    return Math.min(99, Math.round((current / max) * 99));
  }

  function trend(key, value) {
    const prev = pulseHistory[key] || value;
    pulseHistory[key] = value;
    if (value > prev + 2) return '↑';
    if (value < prev - 2) return '↓';
    return '→';
  }

  const conflictCount = countType(recent, 'CONFLICT');
  const protestCount = countType(recent, 'PROTEST');
  const disasterCount = countType(recent, 'DISASTER') + countType(recent, 'EARTHQUAKE');
  const cyberCount = countType(recent, 'CYBER');
  const spaceCount = countType(recent, 'SPACE');

  // Aviation: count from God's Eye flight data if available
  const flightCount = window.__godsEyeView?.dataManager ? 200 : 0; // estimate

  const metrics = {
    global: score(recent.length, 80),
    conflict: score(conflictCount, 15),
    unrest: score(protestCount, 10),
    aviation: score(flightCount, 400),
    maritime: score(countType(recent, 'MARITIME'), 5),
    hazards: score(disasterCount, 8),
    cyber: score(cyberCount, 5),
    space: score(spaceCount, 5),
  };

  for (const [key, val] of Object.entries(metrics)) {
    const valEl = document.getElementById(`wv-pulse-${key}`);
    const trendEl = document.getElementById(`wv-pulse-${key}-trend`);
    if (valEl) {
      valEl.textContent = val;
      valEl.style.color = val > 70 ? '#ff4444' : val > 40 ? '#ffaa00' : '#00ff88';
    }
    if (trendEl) {
      const t = trend(key, val);
      trendEl.textContent = t;
      trendEl.style.color = t === '↑' ? '#ff4444' : t === '↓' ? '#00ff88' : '#888';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — HOTSPOT ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function detectHotspots() {
  const recent = worldBus.getRecent(3600000).filter(e => e.lat && e.lon);
  if (recent.length < 3) return;

  // Grid-based density clustering (0.5° cells)
  const grid = {};
  recent.forEach(e => {
    const key = `${Math.round(e.lat * 2) / 2},${Math.round(e.lon * 2) / 2}`;
    if (!grid[key]) grid[key] = { lat: e.lat, lon: e.lon, events: [], score: 0 };
    grid[key].events.push(e);
    grid[key].score += severityScore(e.severity);
  });

  const hotspots = Object.values(grid)
    .filter(cell => cell.events.length >= 2)
    .map(cell => ({
      lat: cell.lat,
      lon: cell.lon,
      count: cell.events.length,
      score: Math.min(99, cell.score),
      types: [...new Set(cell.events.map(e => e.type))],
      trend: '↑',
      confidence: 'Moderate',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  window.__worldViewer.hotspots = hotspots;
  renderHotspotsOnGlobe(hotspots);
}

function severityScore(severity) {
  return { CRITICAL: 25, HIGH: 15, MEDIUM: 8, LOW: 3 }[severity] || 5;
}

function renderHotspotsOnGlobe(hotspots) {
  const viewer = window.__godsEyeView?.viewer;
  if (!viewer) return;

  // Remove old hotspot entities
  viewer.entities.values
    .filter(e => e._wvHotspot)
    .forEach(e => viewer.entities.remove(e));

  hotspots.forEach(h => {
    try {
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(h.lon, h.lat, 5000),
        label: {
          text: `HOTSPOT\n${h.count} events`,
          font: '10px "JetBrains Mono", monospace',
          fillColor: Cesium.Color.fromCssColorString('#ff4444'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3000000),
          translucencyByDistance: new Cesium.NearFarScalar(500000, 1.0, 3000000, 0.0),
        },
        point: {
          pixelSize: 8 + h.count * 2,
          color: Cesium.Color.fromCssColorString('#ff4444').withAlpha(0.6),
          outlineColor: Cesium.Color.fromCssColorString('#ff8888'),
          outlineWidth: 1,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000),
        },
        _wvHotspot: true,
        _wvHotspotData: h,
        description: `<b>HOTSPOT</b><br>Activity Score: ${h.score}<br>Events: ${h.count}<br>Types: ${h.types.join(', ')}<br>Confidence: ${h.confidence}`,
      });
      entity._wvHotspot = true;
    } catch {}
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — GLOBE EVENTS LAYER (Render world events on globe)
// ═══════════════════════════════════════════════════════════════════════════════

const EVENT_TYPE_COLORS = {
  CONFLICT:   '#ff2222',
  PROTEST:    '#ff8800',
  EARTHQUAKE: '#ffdd00',
  DISASTER:   '#ff6600',
  POLITICAL:  '#aa44ff',
  HUMANITARIAN: '#00aaff',
  CYBER:      '#00ffcc',
  SPACE:      '#8888ff',
  NEWS:       '#888888',
  default:    '#aaaaaa',
};

const EVENT_TYPE_ICONS = {
  CONFLICT: '⚔', PROTEST: '✊', EARTHQUAKE: '🔴', DISASTER: '⚡',
  POLITICAL: '🏛', HUMANITARIAN: '❤', CYBER: '💻', SPACE: '🛰', NEWS: '📰',
};

let wvEventEntities = new Map(); // event.id → CesiumEntity

function renderWorldEventsOnGlobe(events) {
  const viewer = window.__godsEyeView?.viewer;
  if (!viewer) return;

  const geoEvents = events.filter(e => e.lat && e.lon);
  const toRender = new Set(geoEvents.map(e => e.id));

  // Remove stale entities
  for (const [id, entity] of wvEventEntities) {
    if (!toRender.has(id)) {
      try { viewer.entities.remove(entity); } catch {}
      wvEventEntities.delete(id);
    }
  }

  // Add new entities
  geoEvents.forEach(ev => {
    if (wvEventEntities.has(ev.id)) return;
    const color = EVENT_TYPE_COLORS[ev.type] || EVENT_TYPE_COLORS.default;
    const icon = EVENT_TYPE_ICONS[ev.type] || '●';
    try {
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(ev.lon, ev.lat, 2000),
        label: {
          text: `${icon} ${ev.title?.slice(0, 40) || ev.type}`,
          font: '10px "JetBrains Mono", monospace',
          fillColor: Cesium.Color.fromCssColorString(color),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2500000),
          translucencyByDistance: new Cesium.NearFarScalar(200000, 1.0, 2500000, 0.0),
        },
        point: {
          pixelSize: ev.severity === 'HIGH' ? 10 : ev.severity === 'MEDIUM' ? 7 : 5,
          color: Cesium.Color.fromCssColorString(color).withAlpha(0.8),
          outlineColor: Cesium.Color.WHITE.withAlpha(0.4),
          outlineWidth: 1,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000000),
        },
        _wvEvent: true,
        _wvEventData: ev,
        description: buildEventDescription(ev),
      });
      wvEventEntities.set(ev.id, entity);
    } catch {}
  });
}

function buildEventDescription(ev) {
  const time = new Date(ev.timestamp).toUTCString();
  const sourceLink = ev.url ? `<a href="${ev.url}" target="_blank">${ev.source}</a>` : ev.source;
  return `
    <b>${ev.title || ev.type}</b><br>
    <small>${time}</small><br><br>
    ${ev.summary ? `<p>${ev.summary.slice(0, 300)}</p>` : ''}
    <hr>
    <small>SOURCE: ${sourceLink}<br>
    PROVIDER: ${ev.provider}<br>
    CONFIDENCE: ${Math.round((ev.confidence || 0.5) * 100)}%<br>
    FRESHNESS: ${ev.freshness}</small>
  `;
}

// Subscribe to bus to auto-render geolocated events
let eventsLayerEnabled = false;

worldBus.subscribe('all', (event) => {
  if (eventsLayerEnabled && event.lat && event.lon) {
    const recent = worldBus.getRecent(3600000);
    renderWorldEventsOnGlobe(recent);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — COMMAND PALETTE (Ctrl+K)
// ═══════════════════════════════════════════════════════════════════════════════

const palette = document.getElementById('wv-command-palette');
const paletteInput = document.getElementById('wv-palette-input');
const paletteResults = document.getElementById('wv-palette-results');
const paletteBackdrop = palette?.querySelector('.wv-palette-backdrop');

function openCommandPalette() {
  if (!palette) return;
  palette.hidden = false;
  palette.removeAttribute('hidden');
  setTimeout(() => paletteInput?.focus(), 50);
}

function closeCommandPalette() {
  if (!palette) return;
  palette.hidden = true;
  if (paletteInput) paletteInput.value = '';
}

// Fuzzy search + dynamic results
if (paletteInput) {
  paletteInput.addEventListener('input', () => {
    const query = paletteInput.value.trim().toLowerCase();
    if (!query) {
      // Reset to default commands
      const defaults = paletteResults?.querySelectorAll('.wv-palette-result');
      defaults?.forEach(el => { el.hidden = false; });
      return;
    }
    filterPaletteResults(query);
  });

  paletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeCommandPalette(); e.preventDefault(); }
    if (e.key === 'ArrowDown') {
      const first = paletteResults?.querySelector('.wv-palette-result:not([hidden])');
      first?.focus();
      e.preventDefault();
    }
    if (e.key === 'Enter') {
      const first = paletteResults?.querySelector('.wv-palette-result:not([hidden])');
      first?.click();
    }
  });
}

function filterPaletteResults(query) {
  const results = paletteResults?.querySelectorAll('.wv-palette-result');
  if (!results) return;

  // Also add location search
  let matchCount = 0;
  results.forEach(el => {
    const text = el.textContent.toLowerCase();
    const show = text.includes(query);
    el.hidden = !show;
    if (show) matchCount++;
  });

  // Add dynamic search results
  const dynamicId = 'wv-palette-dynamic';
  let dynamicSection = paletteResults?.querySelector(`#${dynamicId}`);
  if (!dynamicSection) {
    dynamicSection = document.createElement('div');
    dynamicSection.id = dynamicId;
    paletteResults?.appendChild(dynamicSection);
  }

  const locationResult = createPaletteResult(
    `🗺 Fly to "${query}"`,
    'Navigate globe to location',
    () => {
      flyToLocation(query);
      closeCommandPalette();
    }
  );

  const trackResult = createPaletteResult(
    `🎯 Track "${query}"`,
    'Search and track entity',
    () => {
      searchAndTrack(query);
      closeCommandPalette();
    }
  );

  dynamicSection.innerHTML = '';
  if (query.length > 1) {
    dynamicSection.appendChild(locationResult);
    dynamicSection.appendChild(trackResult);
  }
}

function createPaletteResult(label, description, onClick) {
  const el = document.createElement('div');
  el.className = 'wv-palette-result';
  el.setAttribute('role', 'option');
  el.setAttribute('tabindex', '0');
  el.innerHTML = `<strong>${label}</strong> <span>${description}</span>`;
  el.addEventListener('click', onClick);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') onClick(); });
  return el;
}

// Command execution
if (paletteResults) {
  paletteResults.addEventListener('click', (e) => {
    const result = e.target.closest('.wv-palette-result[data-cmd]');
    if (!result) return;
    executeCommand(result.dataset.cmd);
    closeCommandPalette();
  });

  paletteResults.addEventListener('keydown', (e) => {
    const result = e.target.closest('.wv-palette-result');
    if (!result) return;
    if (e.key === 'Enter') result.click();
    if (e.key === 'ArrowDown') {
      const next = result.nextElementSibling;
      if (next?.matches('.wv-palette-result:not([hidden])')) next.focus();
      e.preventDefault();
    }
    if (e.key === 'ArrowUp') {
      const prev = result.previousElementSibling;
      if (prev?.matches('.wv-palette-result:not([hidden])')) prev.focus();
      else paletteInput?.focus();
      e.preventDefault();
    }
    if (e.key === 'Escape') closeCommandPalette();
  });
}

if (paletteBackdrop) {
  paletteBackdrop.addEventListener('click', closeCommandPalette);
}

function executeCommand(cmd) {
  const gev = window.__godsEyeView;
  switch (cmd) {
    case 'global-context':
      // Trigger God's Eye global context mode
      document.getElementById('global-context-toggle')?.click() ||
      document.querySelector('[data-context-toggle]')?.click();
      break;
    case 'layer-aircraft':
      enableLayerByKeyword(['flights', 'aircraft', 'contacts']);
      break;
    case 'layer-vessels':
      enableLayerByKeyword(['vessels', 'ships', 'ais', 'maritime']);
      break;
    case 'layer-satellites':
      enableLayerByKeyword(['satellites', 'satellite']);
      break;
    case 'layer-earthquakes':
      enableLayerByKeyword(['earthquakes', 'seismic', 'usgs']);
      break;
    case 'layer-fires':
      enableLayerByKeyword(['fires', 'firms', 'fire']);
      break;
    case 'layer-events':
      toggleWorldEventsLayer();
      break;
    case 'layer-cables':
      enableLayerByKeyword(['cables', 'submarine', 'telegeography']);
      break;
    case 'sensor-nvg':
      gev?.styleManager?.setStyle?.('nvg') ||
      triggerKeyboardShortcut('3');
      break;
    case 'sensor-flir':
      gev?.styleManager?.setStyle?.('flir') ||
      triggerKeyboardShortcut('4');
      break;
    case 'sensor-normal':
      gev?.styleManager?.setStyle?.('normal') ||
      triggerKeyboardShortcut('1');
      break;
    case 'reset':
      document.getElementById('reset-globe-view')?.click();
      break;
    case 'world-pulse':
      toggleWorldPulse();
      break;
  }
}

function enableLayerByKeyword(keywords) {
  // Find toggle buttons in the God's Eye dock and click matching ones
  const toggles = document.querySelectorAll('.toggle-btn, .layer-toggle, [data-layer-id]');
  toggles.forEach(btn => {
    const text = (btn.textContent + ' ' + (btn.dataset.layerId || '')).toLowerCase();
    if (keywords.some(k => text.includes(k))) {
      if (!btn.classList.contains('active') && !btn.classList.contains('on')) {
        btn.click();
      }
    }
  });
}

function triggerKeyboardShortcut(key) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function flyToLocation(query) {
  const gev = window.__godsEyeView;
  if (!gev?.viewer) return;
  // Use God's Eye voice command system if available
  if (gev.voiceCommands?.executeTextCommand) {
    gev.voiceCommands.executeTextCommand(`fly to ${query}`);
  } else {
    // Fallback: use Cesium's geocoder
    Cesium.IonGeocoderService && console.log('[WV] Geocode:', query);
  }
}

function searchAndTrack(query) {
  const gev = window.__godsEyeView;
  if (gev?.voiceCommands?.executeTextCommand) {
    gev.voiceCommands.executeTextCommand(`track ${query}`);
  }
}

// Keyboard shortcut
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    if (palette?.hidden === false) closeCommandPalette();
    else openCommandPalette();
  }
  if (e.key === 'Escape' && palette?.hidden === false) {
    closeCommandPalette();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — WORLD PULSE PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const pulsePanel = document.getElementById('wv-world-pulse');
const pulseClose = document.getElementById('wv-pulse-close');

function toggleWorldPulse() {
  if (!pulsePanel) return;
  pulsePanel.hidden = !pulsePanel.hidden;
  if (!pulsePanel.hidden) updateWorldPulse();
}

pulseClose?.addEventListener('click', () => {
  if (pulsePanel) pulsePanel.hidden = true;
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — WORLD EVENTS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const eventsPanel = document.getElementById('wv-events-panel');
const eventsClose = document.getElementById('wv-events-close');
const eventsList = document.getElementById('wv-events-list');
let currentEventFilter = 'all';

function toggleWorldEventsLayer() {
  eventsLayerEnabled = !eventsLayerEnabled;
  if (eventsPanel) eventsPanel.hidden = !eventsLayerEnabled;

  if (eventsLayerEnabled) {
    const recent = worldBus.getRecent(3600000);
    renderWorldEventsOnGlobe(recent);
    renderEventsList(currentEventFilter);
  } else {
    // Remove globe entities
    const viewer = window.__godsEyeView?.viewer;
    if (viewer) {
      for (const [id, entity] of wvEventEntities) {
        try { viewer.entities.remove(entity); } catch {}
      }
      wvEventEntities.clear();
    }
  }
}

function renderEventsList(filter = 'all') {
  if (!eventsList) return;
  let events = worldBus.getRecent(3600000);
  if (filter !== 'all') {
    const filterMap = {
      conflict: ['CONFLICT', 'MILITARY'],
      protest: ['PROTEST'],
      disaster: ['DISASTER', 'EARTHQUAKE', 'HUMANITARIAN'],
      political: ['POLITICAL', 'DIPLOMATIC'],
    };
    const types = filterMap[filter] || [];
    events = events.filter(e => types.includes(e.type));
  }
  events = events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);

  if (events.length === 0) {
    eventsList.innerHTML = '<div class="wv-events-empty">No events match current filter. Data loading...</div>';
    return;
  }

  eventsList.innerHTML = events.map(ev => {
    const color = EVENT_TYPE_COLORS[ev.type] || '#888';
    const icon = EVENT_TYPE_ICONS[ev.type] || '●';
    const age = formatAge(ev.timestamp);
    const hasLocation = ev.lat && ev.lon;
    return `
      <div class="wv-event-item" data-event-id="${ev.id}" data-lat="${ev.lat || ''}" data-lon="${ev.lon || ''}" style="--event-color:${color}">
        <div class="wv-event-type-badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${icon} ${ev.type}</div>
        <div class="wv-event-title">${escapeHtml(ev.title || ev.type)}</div>
        <div class="wv-event-meta">
          <span class="wv-event-source">${escapeHtml(ev.source)}</span>
          <span class="wv-event-age">${age}</span>
          ${ev.country ? `<span class="wv-event-country">${ev.country}</span>` : ''}
          ${hasLocation ? `<button class="wv-event-fly" data-lat="${ev.lat}" data-lon="${ev.lon}" title="Fly to location">📍</button>` : ''}
          ${ev.url ? `<a class="wv-event-link" href="${ev.url}" target="_blank" rel="noopener">↗</a>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Fly-to click handlers
  eventsList.querySelectorAll('.wv-event-fly').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lat = parseFloat(btn.dataset.lat);
      const lon = parseFloat(btn.dataset.lon);
      flyToCoords(lat, lon);
    });
  });
}

function flyToCoords(lat, lon, altitude = 800000) {
  const viewer = window.__godsEyeView?.viewer;
  if (!viewer) return;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, altitude),
    duration: 2.0,
  });
}

// Filter buttons
eventsPanel?.querySelectorAll('.wv-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    eventsPanel.querySelectorAll('.wv-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentEventFilter = btn.dataset.filter;
    renderEventsList(currentEventFilter);
  });
});

eventsClose?.addEventListener('click', () => {
  if (eventsPanel) eventsPanel.hidden = true;
  eventsLayerEnabled = false;
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12 — AI CONTEXT (Groq-powered contextual intelligence)
// ═══════════════════════════════════════════════════════════════════════════════

let groqAvailable = false;

async function checkGroqAvailability() {
  // Groq key is server-side — check via proxy
  try {
    const resp = await fetch('/api/groq/health', { signal: AbortSignal.timeout(3000) });
    groqAvailable = resp.ok;
  } catch {
    groqAvailable = false;
  }
}

async function askGroqContextual(question) {
  const viewer = window.__godsEyeView?.viewer;
  const camera = viewer?.camera;

  // Build context from current world state
  const cameraPos = camera ? Cesium.Cartographic.fromCartesian(camera.position) : null;
  const lat = cameraPos ? Cesium.Math.toDegrees(cameraPos.latitude).toFixed(2) : null;
  const lon = cameraPos ? Cesium.Math.toDegrees(cameraPos.longitude).toFixed(2) : null;
  const alt = cameraPos ? Math.round(cameraPos.height / 1000) : null;

  const nearbyEvents = (lat && lon) ? worldBus.getEventsInRegion(parseFloat(lat), parseFloat(lon), 1000, 86400000).slice(0, 10) : [];

  const context = {
    cameraLocation: lat && lon ? `${lat}°, ${lon}°` : 'Unknown',
    altitudeKm: alt,
    nearbyEvents: nearbyEvents.map(e => `${e.type}: ${e.title} (${e.source})`),
    recentGlobalEvents: worldBus.getRecent(3600000).length,
    question,
  };

  const systemPrompt = `You are WORLD VIEWER's contextual AI. You analyze the current globe view and provide concise, factual intelligence summaries.
Current camera: ${context.cameraLocation}, altitude ${context.altitudeKm}km.
Nearby events (within 1000km): ${context.nearbyEvents.length > 0 ? context.nearbyEvents.join('; ') : 'None detected'}.
Total recent global events: ${context.recentGlobalEvents}.
Rules:
- Be concise (2-4 sentences max)
- Only state what is supported by current data
- If uncertain, say so
- Never invent data or events
- Cite sources when relevant`;

  try {
    const resp = await fetch('/api/groq/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'groq/compound-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) throw new Error(`Groq ${resp.status}`);
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || 'No response from AI.';
  } catch (e) {
    return `[AI unavailable: ${e.message}]`;
  }
}

// Expose to God's Eye voice system
window.__worldViewer.askAI = askGroqContextual;

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13 — ALERT ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

const ALERT_THRESHOLDS = {
  CONFLICT: { severity: 'HIGH', desktopNotify: true },
  EARTHQUAKE: { severity: 'MEDIUM', desktopNotify: true },
  DISASTER: { severity: 'HIGH', desktopNotify: true },
  CYBER: { severity: 'HIGH', desktopNotify: true },
};

const recentAlerts = new Set();
const ALERT_COOLDOWN_MS = 300000; // 5 min per event

worldBus.subscribe('all', (event) => {
  if (!ALERT_THRESHOLDS[event.type]) return;
  const { severity, desktopNotify } = ALERT_THRESHOLDS[event.type];
  if (event.severity !== severity && event.severity !== 'CRITICAL') return;

  const alertKey = `${event.type}-${event.id}`;
  if (recentAlerts.has(alertKey)) return;
  recentAlerts.add(alertKey);
  setTimeout(() => recentAlerts.delete(alertKey), ALERT_COOLDOWN_MS);

  if (desktopNotify && IS_ELECTRON) {
    sendDesktopNotification(
      `WORLD VIEWER: ${event.type}`,
      event.title || 'New world event detected',
      severity === 'CRITICAL' ? 'critical' : 'normal'
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 14 — UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function formatAge(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return `${Math.round(diff / 86400000)}d ago`;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 15 — STARTUP SEQUENCE
// ═══════════════════════════════════════════════════════════════════════════════

async function initWorldViewer() {
  console.log('[WORLD VIEWER] Booting world intelligence systems...');

  // Wait for God's Eye to fully initialize
  let gevReady = false;
  for (let i = 0; i < 30; i++) {
    if (window.__godsEyeView?.viewer && window.__godsEyeView?.dataManager) {
      gevReady = true;
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (!gevReady) {
    console.warn('[WORLD VIEWER] God\'s Eye View not ready after 15s — proceeding anyway');
  }

  // Mark aircraft/maritime/space from GEV state
  setTimeout(() => {
    markLoaderItem('wv-init-aircraft', 'ok');
    markLoaderItem('wv-init-maritime', 'ok');
    markLoaderItem('wv-init-space', 'ok');
    markLoaderItem('wv-init-earth', 'ok');
  }, 3000);

  // Run first event ingestion
  await runEventIngestion();

  // Schedule recurring ingestion
  setInterval(runEventIngestion, 300000); // every 5 minutes
  setInterval(updateWorldPulse, 60000);   // every minute

  // Check Groq availability
  await checkGroqAvailability();

  console.log('[WORLD VIEWER] World intelligence systems online');
}

// Boot after a short delay to let God's Eye init first
setTimeout(initWorldViewer, 2000);

