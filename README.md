# WORLD VIEWER

**A professional geospatial intelligence desktop application** — photorealistic 3D globe, live air/sea/space/earth signals, world events, and contextual AI.

---

## What It Is

WORLD VIEWER is an Electron + Cesium desktop app that combines:

- **Photorealistic 3D Earth** — CesiumJS with World Terrain, Bing Maps Aerial, 3D buildings, labels, atmosphere
- **Live global telemetry** — aircraft (OpenSky), ships/AIS, satellites (TLE/CelesTrak), ISS, rocket launches, earthquakes (USGS), traffic, CCTV, bikeshare, radio spectrum, datacenters, dams, submarine cables
- **World events & news** — GDELT + RSS ingestion with deduplication, clustering, hotspot detection, source attribution
- **Geopolitical intelligence layers** — military installations, military awareness, datacenters, dams, submarine cables, regions
- **Contextual AI** — Groq LLM integration, grounded on what you're looking at (coordinates, place, active layers, nearby events)
- **Desktop integration** — native notifications, clipboard, file dialogs, system browser, secure credential storage (safeStorage), always-on-top, fullscreen
- **Command palette** — `Ctrl+K` to search places, layers, commands
- **Event timeline** — scrub through historical events on the globe
- **Place intelligence** — click anywhere for local investigation

---

## Quick Start

```bash
cd /home/adarshjii/Projects/world-viewer

# Terminal 1: Vite dev server (port 4173)
npm run dev

# Terminal 2: Electron pointing at dev server
npm run electron:dev
```

| Command | What it does |
|---------|-------------|
| `npm run dev` | Starts Vite dev server (sources/gods-eye-view-main) |
| `npm run electron:dev` | Electron + dev server concurrently |
| `npm run build:renderer` | Vite production build → sources/gods-eye-view-main/dist/ |
| `npm run dist:linux` | Build renderer + electron-builder → AppImage + .deb |
| `./dist/linux-unpacked/world-viewer` | Run the built app directly |

> **Note:** `npm run dist:linux` fails at icon conversion because no icon exists in `build/`. The renderer builds fine — this is a packaging config gap. The existing `dist/linux-unpacked/` from commit `371d443` is functional.

---

## Architecture

```
world-viewer/
├── electron/
│   ├── main/index.cjs         # Electron main — IPC, HTTP proxy (Express :39151),
│   │                           │  notifications, clipboard, credentials, window controls
│   └── preload/index.cjs      # Secure contextBridge — minimal API surface to renderer
│
├── sources/gods-eye-view-main/   # God's Eye View (Cesium globe + all layers)
│   ├── src/
│   │   ├── main.js              # Initialization orchestrator
│   │   ├── worldViewer.js       # MAIN orchestration — events, hotspots, alerts, Groq AI,
│   │   │                         │  timeline, command palette, panels
│   │   ├── data/                # 14 data layers + manager + layer state
│   │   ├── world-model/         # EntityStore, EventStore, RelationshipGraph,
│   │   │                         │  LayerRegistry, ProviderHealth
│   │   ├── events/              # EventBus, IngestPipeline, classify, geocode,
│   │   │                         │  score, dedup, correlate, normalize
│   │   ├── providers/           # RSS + GDELT news adapters
│   │   ├── scenes/              # SceneDirector — cinematic camera presets
│   │   ├── voice/               # Voice command system
│   │   ├── annotations/         # Annotation engine (4 renderers)
│   │   └── ...                  # 47 source files, 100+ test files
│   ├── dist/                    # Vite production build (NOT committed)
│   └── package.json
│
├── electron/main/index.cjs      # Root Electron main process
├── electron/preload/index.cjs   # Preload bridge
├── package.json                 # Root — Electron 33, electron-builder, build scripts
├── .gitignore                   # node_modules, dist/
├── context.md                   # Application context
├── prompt.md                    # AI interaction prompts (large)
└── docs/
    ├── ARCHITECTURE.md          # Deep-dive: process model, data flow, world model,
    │                             │  event pipeline, UI controllers, Cesium, desktop,
    │                             │  build pipeline, module inventory, gaps
    ├── DATA_SOURCES.md          # Every external source: 14 news feeds, Cesium base maps,
    │                             │  OSM Nominatim, offline geocoding, 14 data layers,
    │                             │  Groq AI endpoints, provider health tracking
    └── DEVELOPMENT.md           # Dev guide: prerequisites, workflow, API surface,
                                  │  how to add layers/UI features/IPC handlers,
                                  │  credentials, packaging, known issues, debugging
```

### Process model

| Process | Role | Lifetime |
|---------|------|----------|
| **Electron Main** | IPC handlers, HTTP proxy, notifications, clipboard, credentials, window controls | App lifetime |
| **Vite Dev Server** | Serves renderer at `http://localhost:4173` | Dev session only |
| **Renderer** | Cesium globe, all UI panels, data layers, event system, AI | App lifetime (renderer process) |

The renderer is one Vite app combining **God's Eye View** (globe + data layers + place intelligence) with **WORLD VIEWER orchestration** (event system, news, hotspots, AI, panels, timeline, command palette).

### Data flow

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

### World model modules

| Module | Responsibility |
|--------|---------------|
| **EntityStore** | View-model for entities (aircraft, vessels, etc.) — upsert, remove, subscribe, snapshot |
| **EventStore** | Append-only event log — upsert, remove, subscribe, getRange, clear |
| **RelationshipGraph** | Typed edges (12 relationship types) — addEdge, removeEdge, query, subgraph |
| **LayerRegistry** | Validates + stores layer metadata — 11 valid categories |
| **ProviderHealth** | Per-source uptime, latency, last success/failure, status |

---

## Data Layers

All 14 layers loaded in `sources/gods-eye-view-main/src/main.js`:

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
| Regions/Buildings | OSM + Cesium 3D Tiles | infrastructure |

Plus 6 Cesium base layers: World Terrain, Bing Maps Aerial, OSM Buildings, Satellite View, Streets labels, Cesium Ion auth.

---

## AI Integration (Groq)

`worldViewer.js` integrates Groq LLMs for contextual intelligence:

- **Context-aware prompts** — AI knows what you're looking at (coords, place name, active layers, nearby events)
- **Event summarization** — natural language summaries of event clusters
- **Geopolitical context** — background on places, conflicts, infrastructure

The preload bridge exposes a minimal API surface — no Node.js APIs leak to the renderer.

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
- Annotations (4 renderers: screen, world, hybrid)
- Logo Gaze (branded animation)

---

## Desktop Integration (Electron)

Preload bridge (`electron/preload/index.cjs`) exposes:

| API | What it does |
|-----|-------------|
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

Main process (`electron/main/index.cjs`):
- IPC handlers for all preload API calls
- HTTP proxy (Express on port 39151)
- `nativeImage` for icon/bitmap manipulation
- `safeStorage` for encrypted credential storage

---

## Development

### Add a data layer

1. Create `sources/gods-eye-view-main/src/data/<layer>.js`
2. Export layer config + `onActivate`/`onDeactivate`/`update` functions
3. Register in `sources/gods-eye-view-main/src/main.js`
4. Add to `LayerRegistry` with category from `VALID_CATEGORIES`

### Add a UI feature

1. Create `sources/gods-eye-view-main/src/<feature>.js`
2. Export init function reading from `window.wv` or `window.gev`
3. Call from `worldViewer.js` or `main.js`

### Add an IPC handler

1. Add handler in `electron/main/index.cjs` (main process)
2. Add bridge method in `electron/preload/index.cjs` (preload)
3. Call from renderer via `window.worldViewerAPI.method()`

### Environment variables

Create `sources/gods-eye-view-main/.env`:

```env
CESIUM_TOKEN=<your Cesium Ion token>
BING_MAPS_KEY=<your Bing Maps key>
OPENSKY_USERNAME=<your OpenSky username>
OPENSKY_PASSWORD=<your OpenSky password>
GROQ_API_KEY=<your Groq API key>
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Electron 33 |
| 3D globe | CesiumJS (Ion + World Terrain + Bing Maps) |
| Renderer build | Vite |
| Language | TypeScript / JavaScript (ESM in renderer, CJS in main) |
| Event system | Custom (EventBus, IngestPipeline, EventStore, EntityStore) |
| AI | Groq API (via preload/renderer) |
| Desktop APIs | Electron IPC + safeStorage + nativeNotifications |
| Packaging | electron-builder (AppImage + .deb for Linux) |
| Node.js | >= 22 |

---

## Status

**Phase 1 built.** Desktop shell, 3D globe, 14 data layers, event pipeline, news providers, hotspot engine, Groq AI integration, Electron desktop features, command palette, timeline, place intelligence — all functional.

**Not built (planned):**
- Indian market terminal (NIFTY, BANK NIFTY, options chain)
- Real-time streaming market data
- Prediction engine
- Alert center
- Watchlists
- Full World Monitor integration
- Optimization pass

---

## License

MIT
