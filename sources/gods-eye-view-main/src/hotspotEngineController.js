const WINDOW_24H_MS = 24 * 60 * 60 * 1000;
const WINDOW_48H_MS = 2 * WINDOW_24H_MS;
const HOTSPOT_SLICE_DEG = 1.5;
const MAX_HOTSPOTS = 10;
const SEVERITY_WEIGHT = { LOW: 1, MEDIUM: 1.6, HIGH: 2.4, CRITICAL: 3.6 };
const MIN_HOTSPOT_RADIUS_M = 40_000;
const MAX_HOTSPOT_RADIUS_M = 220_000;

function toLat(ev) {
  const v = typeof ev?.lat === 'number'
    ? ev.lat
    : (typeof ev?.latitude === 'number'
      ? ev.latitude
      : (typeof ev?.location?.lat === 'number' ? ev.location.lat : null));
  return v;
}
function toLon(ev) {
  const v = typeof ev?.lon === 'number'
    ? ev.lon
    : (typeof ev?.longitude === 'number'
      ? ev.longitude
      : (typeof ev?.location?.lon === 'number' ? ev.location.lon : null));
  return v;
}
function toTs(ev) {
  if (typeof ev.timestampMs === 'number') return ev.timestampMs;
  if (typeof ev.timestamp === 'number') return ev.timestamp;
  const t = new Date(ev.timestamp || ev.createdAt || 0).getTime();
  return isNaN(t) ? 0 : t;
}
function sevWeight(ev) {
  return SEVERITY_WEIGHT[(ev.severity || 'LOW').toUpperCase()] || 1;
}

function haversineApprox(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const la1 = lat1 * Math.PI / 180;
  const la2 = lat2 * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bucketKey(lat, lon) {
  const la = Math.floor(lat / HOTSPOT_SLICE_DEG);
  const lo = Math.floor(lon / HOTSPOT_SLICE_DEG);
  return la + ':' + lo;
}

function getAllStoreEvents(EventStore) {
  try {
    if (EventStore && typeof EventStore.getAll === 'function') {
      const arr = EventStore.getAll();
      if (Array.isArray(arr)) return arr;
    }
  } catch {}
  return [];
}
function getAllStoreEntities(EntityStore) {
  try {
    if (EntityStore && typeof EntityStore.getAll === 'function') {
      const arr = EntityStore.getAll();
      if (Array.isArray(arr)) return arr;
    }
  } catch {}
  return [];
}

export function computeHotspotScores({ EventStore, EntityStore, now = Date.now() } = {}) {
  const allEvents = getAllStoreEvents(EventStore).filter((e) => {
    const lat = toLat(e);
    const lon = toLon(e);
    const ts = toTs(e);
    return (lat != null && lon != null && !isNaN(lat) && !isNaN(lon) && ts > 0);
  });
  const allEntities = getAllStoreEntities(EntityStore).filter((e) => {
    const lat = toLat(e);
    const lon = toLon(e);
    return lat != null && lon != null && !isNaN(lat) && !isNaN(lon);
  });

  const cutoffCur = now - WINDOW_24H_MS;
  const cutoffPrev = now - WINDOW_48H_MS;

  const curEvents = allEvents.filter((e) => toTs(e) >= cutoffCur);
  const prevEvents = allEvents.filter((e) => {
    const t = toTs(e);
    return t >= cutoffPrev && t < cutoffCur;
  });

  const buckets = new Map();

  for (const ev of curEvents) {
    const lat = toLat(ev);
    const lon = toLon(ev);
    const key = bucketKey(lat, lon);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        latSum: 0,
        lonSum: 0,
        eventCount: 0,
        weightedSum: 0,
        sources: new Set(),
        types: new Set(),
        velocities: [],
        vel24hAgoCounts: prevEvents.length,
      });
    }
    const b = buckets.get(key);
    b.latSum += lat;
    b.lonSum += lon;
    b.eventCount++;
    b.weightedSum += sevWeight(ev);
    if (ev.sourceId || ev.source || ev.sourceName) {
      b.sources.add(ev.sourceId || ev.source || ev.sourceName);
    }
    // IngestPipeline stores provenance in sources[], not the legacy source
    // fields above. Counting it restores the diversity signal used for score.
    for (const source of Array.isArray(ev.sources) ? ev.sources : []) {
      const name = source?.provider || source?.name || source?.id || source?.url;
      if (name) b.sources.add(String(name));
    }
    if (ev.type || ev.category) b.types.add((ev.type || ev.category).toUpperCase());
    if (typeof ev.speed === 'number') b.velocities.push(ev.speed);
    else if (typeof ev.velocity === 'number') b.velocities.push(ev.velocity);
  }

  for (const ent of allEntities) {
    const lat = toLat(ent);
    const lon = toLon(ent);
    const key = bucketKey(lat, lon);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        latSum: 0,
        lonSum: 0,
        eventCount: 0,
        weightedSum: 0,
        sources: new Set(),
        types: new Set(),
        velocities: [],
        vel24hAgoCounts: 0,
      });
    }
    const b = buckets.get(key);
    b.latSum += lat * 0.2;
    b.lonSum += lon * 0.2;
    b.eventCount += 0.3;
    b.weightedSum += 0.4;
    if (ent.id) b.sources.add('ent:' + String(ent.id).slice(0, 8));
    if (typeof ent.speed === 'number') b.velocities.push(ent.speed);
    else if (typeof ent.velocity === 'number') b.velocities.push(ent.velocity);
  }

  const hotspots = [];
  for (const b of buckets.values()) {
    if (b.eventCount < 2) continue;
    const density = b.eventCount;
    const severityAvg = b.eventCount > 0 ? b.weightedSum / b.eventCount : 1;
    const sourceDiversityFactor = Math.min(1.6, 1 + Math.log1p(Math.max(0, b.sources.size - 1)) * 0.35);
    const concentrationFactor = Math.min(1.8, 1 + Math.log1p(density) * 0.22);
    const velAvg = b.velocities.length > 0
      ? b.velocities.reduce((a, v) => a + v, 0) / b.velocities.length
      : 0;
    const velocityChange24hPct = velAvg > 0 ? Math.min(60, velAvg * 0.8) : 0;

    const rawScore =
      density *
      severityAvg *
      sourceDiversityFactor *
      (1 + velocityChange24hPct / 100) *
      concentrationFactor;

    const centroidLat = b.latSum / (b.eventCount || 1);
    const centroidLon = b.lonSum / (b.eventCount || 1);
    const typeMix = Array.from(b.types);

    let neighborEvents = 0;
    for (const ev of curEvents) {
      const lat = toLat(ev);
      const lon = toLon(ev);
      if (haversineApprox(centroidLat, centroidLon, lat, lon) <= 100) neighborEvents++;
    }
    let priorNeighbor = 0;
    for (const ev of prevEvents) {
      const lat = toLat(ev);
      const lon = toLon(ev);
      if (haversineApprox(centroidLat, centroidLon, lat, lon) <= 100) priorNeighbor++;
    }
    const pctIncrease = priorNeighbor > 0
      ? Math.round(((neighborEvents - priorNeighbor) / priorNeighbor) * 100)
      : (neighborEvents > 0 ? 100 : 0);

    const score = Math.round(rawScore * 10) / 10;
    const radiusM = Math.min(
      MAX_HOTSPOT_RADIUS_M,
      MIN_HOTSPOT_RADIUS_M + density * 8000 + Math.min(60, score) * 1200
    );

    hotspots.push({
      key: b.key,
      score,
      density,
      severityAvg: Math.round(severityAvg * 10) / 10,
      sourceCount: b.sources.size,
      typeMix,
      lat: centroidLat,
      lon: centroidLon,
      radiusM,
      pct: pctIncrease,
      eventCount: neighborEvents,
    });
  }

  hotspots.sort((a, b) => b.score - a.score);
  return hotspots.slice(0, MAX_HOTSPOTS);
}

export function renderHotspotEntities(viewer, hotspots, existingIds = new Set()) {
  if (!viewer || !window.Cesium) return new Set();
  const ids = new Set();
  try {
    for (const id of existingIds) {
      try {
        const ent = viewer.entities.getById(id);
        if (ent) viewer.entities.remove(ent);
      } catch {}
    }
    for (let i = 0; i < hotspots.length; i++) {
      const h = hotspots[i];
      const ringId = 'wv-hotspot-ring-' + i;
      const labelId = 'wv-hotspot-label-' + i;
      try {
        const position = Cesium.Cartesian3.fromDegrees(h.lon, h.lat);
        const material = Cesium.Color.fromCssColorString('#ff6a00').withAlpha(0.12);
        const outlineColor = Cesium.Color.fromCssColorString('#ff6a00');
        viewer.entities.add({
          id: ringId,
          position,
          ellipse: {
            semiMinorAxis: h.radiusM,
            semiMajorAxis: h.radiusM,
            material,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            outline: true,
            outlineColor,
            fill: true,
            outlineWidth: 1.5,
          },
        });
        viewer.entities.add({
          id: labelId,
          position: Cesium.Cartesian3.fromDegrees(h.lon, h.lat, 80_000),
          label: {
            text: `HOTSPOT\nActivity +${Math.max(0, h.pct)}%\nScore ${Math.round(h.score)}`,
            font: "600 10px 'JetBrains Mono', monospace",
            fillColor: Cesium.Color.fromCssColorString('#ffb066'),
            outlineColor: Cesium.Color.BLACK.withAlpha(0.85),
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -8),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('#0a0f14').withAlpha(0.75),
            backgroundPadding: new Cesium.Cartesian2(8, 6),
          },
        });
        ids.add(ringId);
        ids.add(labelId);
      } catch {}
    }
  } catch {}
  return ids;
}

function buildHotspotChip() {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.id = 'wv-hotspots-chip';
  chip.setAttribute('data-hotspots-trigger', '');
  Object.assign(chip.style, {
    position: 'fixed',
    bottom: '92px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '6px 14px',
    borderRadius: '999px',
    background: 'rgba(10, 15, 20, 0.88)',
    border: '1px solid rgba(255, 106, 0, 0.4)',
    color: '#ffb066',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)',
    zIndex: '9994',
    transition: 'all 150ms ease',
  });
  chip.innerHTML = `
    <span style="display:inline-block;margin-right:8px;width:7px;height:7px;border-radius:50%;background:#ff6a00;box-shadow:0 0 10px rgba(255,106,0,0.7);animation:wv-hotspot-pulse 1.6s ease-in-out infinite;"></span>
    HOTSPOTS
    <span id="wv-hotspots-count" style="margin-left:8px;padding:1px 6px;border-radius:999px;background:rgba(255,106,0,0.15);border:1px solid rgba(255,106,0,0.3);font-size:9.5px;letter-spacing:0.1em;color:#ffcc99;">0</span>
  `;
  chip.addEventListener('mouseenter', () => {
    chip.style.borderColor = 'rgba(255, 106, 0, 0.7)';
    chip.style.background = 'rgba(25, 15, 8, 0.9)';
  });
  chip.addEventListener('mouseleave', () => {
    chip.style.borderColor = 'rgba(255, 106, 0, 0.4)';
    chip.style.background = 'rgba(10, 15, 20, 0.88)';
  });
  return chip;
}

function injectKeyframes(doc = document) {
  if (doc.getElementById('wv-hotspots-keyframes')) return;
  const style = doc.createElement('style');
  style.id = 'wv-hotspots-keyframes';
  style.textContent = `
    @keyframes wv-hotspot-pulse {
      0%, 100% { opacity: 0.65; transform: scale(0.92); }
      50% { opacity: 1; transform: scale(1.15); }
    }
  `;
  doc.head.appendChild(style);
}

export default function initHotspotEngine({
  viewer,
  styleManager,
  dataManager,
  sceneDirector,
  annotations,
  EventBus,
  EntityStore,
  EventStore,
} = {}) {
  injectKeyframes();

  let activeEntityIds = new Set();
  let latestHotspots = [];
  let selectedRegionKey = null;
  let chip = null;
  let chipClickHandler = null;
  let entityClickHandler = null;
  let destroyed = false;

  function flyToHotspot(h) {
    if (!viewer || !window.Cesium) return;
    try {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(h.lon, h.lat, 2_500_000),
        duration: 2.2,
      });
    } catch {}
  }

  function wireEntityClicks() {
    if (!viewer || !window.Cesium) return;
    try {
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      entityClickHandler = handler;
      handler.setInputAction((click) => {
        if (!viewer.scene) return;
        const picked = viewer.scene.pick(click.position);
        if (!picked || !picked.id) return;
        const id = typeof picked.id === 'string' ? picked.id : (picked.id.id || null);
        if (!id || !id.startsWith('wv-hotspot-')) return;
        const idxMatch = id.match(/(\d+)$/);
        if (!idxMatch) return;
        const i = parseInt(idxMatch[1], 10);
        const hs = latestHotspots[i];
        if (hs) flyToHotspot(hs);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    } catch {}
  }

  function refresh() {
    if (destroyed) return;
    latestHotspots = computeHotspotScores({ EventStore, EntityStore });
    if (viewer) {
      activeEntityIds = renderHotspotEntities(viewer, latestHotspots, activeEntityIds);
    }
    const countEl = document.getElementById('wv-hotspots-count');
    if (countEl) countEl.textContent = String(latestHotspots.length);
  }

  function showPanel() {
    if (!latestHotspots.length) return;
    const top = latestHotspots[0];
    flyToHotspot(top);
  }

  function computeEscalation(regionKey = selectedRegionKey) {
    const events = getAllStoreEvents(EventStore);
    const now = Date.now();
    const cutoff = now - WINDOW_24H_MS;
    let recent = events.filter((e) => toTs(e) >= cutoff);
    if (regionKey) {
      recent = recent.filter((e) => {
        const r = e.region || e.country || e.area || '';
        return String(r).toLowerCase().includes(String(regionKey).toLowerCase());
      });
    }
    const n = recent.length;
    let aviationDisruption = 0;
    let infraEvents = 0;
    let weighted = 0;
    for (const ev of recent) {
      const t = (ev.type || ev.category || '').toUpperCase();
      if (t === 'AVIATION' || t === 'AIRSPACE') aviationDisruption++;
      if (t === 'INFRASTRUCTURE' || t === 'POWER_OUTAGE' || t === 'CYBER_OUTAGE' || t === 'OUTAGE' || t === 'DAM') infraEvents++;
      weighted += sevWeight(ev);
    }
    const raw = weighted * 6 + aviationDisruption * 4 + infraEvents * 3;
    const score = Math.max(0, Math.min(100, Math.round(raw * 3.5)));
    const before = events.filter((e) => {
      const t = toTs(e);
      return t >= now - WINDOW_48H_MS && t < cutoff;
    }).length;
    const trend = before > 0
      ? (((n - before) / before) * 100)
      : (n > 0 ? 100 : 0);
    const trendStr = trend > 10 ? '↑' : trend < -10 ? '↓' : '→';
    return {
      region: regionKey || 'Global',
      score,
      trend: trendStr,
      trendPct: Math.round(trend),
      signals: `SUPPORTED SIGNALS: ${n} events, ${aviationDisruption} aviation disruption, ${infraEvents} infra events`,
    };
  }

  chip = buildHotspotChip();
  document.body.appendChild(chip);
  chipClickHandler = () => showPanel();
  chip.addEventListener('click', chipClickHandler);
  wireEntityClicks();

  const onBulk = () => refresh();
  EventBus?.on?.('event:bulk', onBulk);
  const intervalId = setInterval(refresh, 120 * 1000);

  setTimeout(refresh, 300);

  function destroy() {
    destroyed = true;
    clearInterval(intervalId);
    EventBus?.off?.('event:bulk', onBulk);
    if (chip && chipClickHandler) chip.removeEventListener('click', chipClickHandler);
    chip?.remove();
    try { entityClickHandler?.destroy?.(); } catch {}
    if (viewer) {
      for (const id of activeEntityIds) {
        try {
          const ent = viewer.entities.getById(id);
          if (ent) viewer.entities.remove(ent);
        } catch {}
      }
    }
    activeEntityIds.clear();
  }

  return {
    destroy,
    refresh,
    computeHotspotScores: (opts) => computeHotspotScores({ EventStore, EntityStore, ...opts }),
    renderHotspotEntities: (list) => renderHotspotEntities(viewer, list, activeEntityIds),
    setSelectedRegion: (key) => { selectedRegionKey = key; },
    computeEscalation,
    getHotspots: () => latestHotspots.slice(),
  };
}
