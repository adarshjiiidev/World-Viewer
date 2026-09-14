# WORLD VIEWER — Architecture

**Version:** 1.0.0 | **Last updated:** 2026-09-12

---

## Overview

WORLD VIEWER is an Electron + Cesium desktop application for geospatial intelligence. It combines a photorealistic 3D globe with live global telemetry (aircraft, ships, satellites, earthquakes, CCTV, radio, etc.), world events (GDELT + RSS), contextual AI (Groq), and desktop integration (notifications, clipboard, credentials, window controls).

The project has two main parts:
- **Electron shell** (`electron/`) — main process + preload bridge
- **Renderer** (`sources/gods-eye-view-main/`) — God's Eye View Cesium app + WORLD VIEWER orchestration

---

## Process Model

| Process | Role | Lifetime |
|---------|------|----------|
| **Electron Main** (`electron/main/index.cjs`) | IPC handlers, HTTP proxy (Express :39151), notifications, clipboard, credentials, window controls | App lifetime |
| **Vite Dev Server** | Serves renderer at `http://localhost:4173` | Dev session only |
| **Renderer** (God's Eye View + WORLD VIEWER) | Cesium globe, all UI panels, data layers, event system, AI | App lifetime (renderer process) |

The renderer is ONE Vite app that combines God's Eye View (globe + data layers + place intelligence) with WORLD VIEWER orchestration (event system, news, hotspots, AI, panels, timeline, command palette).

---

## Data Flow

```
External APIs / RSS / GDELT
    │
    ▼
Providers (RSSAdapter, GdeltAdapter)
    │
    ▼
IngestPipeline.ingest(raw)
  normalize → dedup → classify → score
    │
    ▼
EventStore.upsert() + EntityStore.sync()
    │
    ▼
EventBus.emit('event:new' | 'event:update')
    │
    ├──► EventsPanel (list)
    ├──► HotspotEngine (cluster → top 10)
    └──► WorldPulse (live counters)
              │
              ▼
         Cesium overlay (entity markers)
```

---

## World Model (In-Process)

| Module | File | Responsibility |
|--------|------|---------------|
| **EntityStore** | `src/world-model/entities.js` | View-model for entities (aircraft, vessels, etc.) — upsert, remove, subscribe, snapshot |
| **EventStore** | `src/world-model/events.js` | Append-only event log — upsert, remove, subscribe, getRange, clear |
| **RelationshipGraph** | `src/world-model/relationships.js` | Typed edges (12 types) — addEdge, removeEdge, query, subgraph |
| **LayerRegistry** | `src/world-model/index.js` | Validates + stores layer metadata — 11 valid categories |
| **ProviderHealth** | `src/world-model/sources.js` | Per-source uptime, latency, last success/failure, status |

---

## Data Layers

All 14 layers loaded in `src/main.js`:

| Layer | Source | Category |
|-------|--------|----------|
| Flights | OpenSky Network API | air |
| Military Flights | OpenSky + filtering | air |
| AIS Live Vessels | AIS API | sea |
| Satellites (TLE) | CelesTrak | space |
| ISS | CelesTrak / Open Notify | space |
| Rocket Launches | Launch library API | space |
| Earthquakes | USGS API | earth |
| Traffic | Overpass API (OSM) | transport |
| CCTV Cameras | OpenData endpoints | cameras |
| Radio Spectrum | OpenData endpoints | communication |
| Bikeshare | City open data APIs | transport |
| Military Installations | OpenData endpoints | infrastructure |
| Military Awareness | OpenData endpoints | infrastructure |
| Datacenters | OpenData endpoints | infrastructure |
| Dams | OpenData endpoints | infrastructure |
| Submarine Cables | OpenData endpoints | infrastructure |

Plus 6 Cesium base layers: World Terrain, Bing Maps Aerial, OSM Buildings, Satellite View, Streets, Cesium Ion auth.

---

## Electron Integration

### Preload Bridge (`electron/preload/index.cjs`)

Exposes a minimal, audited API surface via `contextBridge`:

| API | Purpose |
|-----|---------|
| `copyToClipboard(text)` | System clipboard write |
| `readFromClipboard()` | System clipboard read |
| `sendNotification(title, body, urgency)` | Native desktop notifications |
| `getSystemInfo()` | Platform, memory, CPU info |
| `openExternal(url)` | Open URL in system browser |
| `appVersion()` | App version string |
| `windowMinimize/Maximize/Fullscreen` | Window controls |
| `windowAlwaysOnTop(val)` | Always-on-top toggle |
| `setCredential(key, value)` | Secure storage (safeStorage) |
| `getCredential(key)` | Retrieve stored credential |

### Main Process (`electron/main/index.cjs`)

- IPC handlers for all preload API calls
- HTTP proxy (Express on port 39151)
- `nativeImage` for icon/bitmap manipulation
- `safeStorage` for encrypted credential storage

---

## AI Integration (Groq)

`worldViewer.js` integrates Groq LLMs:
- **Context-aware prompts** — AI knows what you're looking at (coords, place, active layers, nearby events)
- **Event summarization** — natural language summaries of event clusters
- **Geopolitical context** — background on places, conflicts, infrastructure

No Node.js APIs leak to the renderer — all AI calls go through the preload bridge or direct fetch.

---

## UI Features

- Cinematic loading sequence (staggered loader items)
- Command palette (`Ctrl+K`)
- World Pulse (live indicator counters)
- World Events panel (dedup, clustering, source attribution)
- Hotspot engine (top 10 global hotspots by score)
- Timeline (scrub historical events)
- Place intelligence (click for local investigation)
- Layer selector (toggle 14+ layers)
- Floating panels (draggable, minimizable)
- Cockpit UI (HUD, altitude datum, cloud effects)
- Annotations (4 renderers)
- Logo Gaze (branded animation)

---

## Build Pipeline

```bash
npm run build:renderer   # Vite → sources/gods-eye-view-main/dist/
npm run dist:linux       # Build renderer + electron-builder → AppImage + .deb
```

Package contents (from `package.json` build config):
- `electron/**/*` — main process + preload
- `sources/gods-eye-view-main/dist/**/*` — renderer build output
- `package.json`

Targets: AppImage (x64) + .deb (x64), category: Science

---

## Development

### Add a data layer
1. Create `src/data/<layer>.js` — export layer config + `onActivate`/`onDeactivate`/`update`
2. Register in `src/main.js`
3. Add to `LayerRegistry` with valid category

### Add a UI feature
1. Create `src/<feature>.js` — export init function reading from `window.wv` or `window.gev`
2. Call from `worldViewer.js` or `main.js`

### Add an IPC handler
1. Add handler in `electron/main/index.cjs` (main process)
2. Add bridge method in `electron/preload/index.cjs` (preload)
3. Call from renderer via `window.worldViewerAPI.method()`

### Environment variables
Create `sources/gods-eye-view-main/.env`:
```env
CESIUM_TOKEN=<token>
BING_MAPS_KEY=<key>
OPENSKY_USERNAME=<user>
OPENSKY_PASSWORD=<pass>
GROQ_API_KEY=<key>
```

---

## Known Issues

- `npm run dist:linux` fails at icon conversion — no icon in `build/`. Renderer builds fine. Existing `dist/linux-unpacked/` from commit `371d443` is functional.

---

## License

MIT
