# WORLD VIEWER — Development Guide

**Last updated:** 2026-09-12  
**Node.js requirement:** >= 22

---

## Prerequisites

- **Node.js 22+** — the app uses ES modules in renderer, CJS in main
- **npm** — for dependencies
- **Cesium Ion token** — for terrain + imagery (free tier available)
- **Bing Maps key** — for aerial imagery (free tier available)
- **OpenSky username/password** — for live flight data (free account)
- **Groq API key** — for AI features (free tier available)

---

## Getting Started

```bash
cd /home/adarshjii/Projects/world-viewer

# Install dependencies (both root + renderer)
npm install
cd sources/gods-eye-view-main && npm install && cd ../..

# Set up environment
cp sources/gods-eye-view-main/.env.example sources/gods-eye-view-main/.env
# Edit .env with your keys

# Terminal 1: Vite dev server
npm run dev

# Terminal 2: Electron
npm run electron:dev
```

---

## Project Structure

```
world-viewer/
├── electron/
│   ├── main/index.cjs         # Electron main process
│   └── preload/index.cjs      # Preload bridge (contextBridge)
│
├── sources/gods-eye-view-main/
│   ├── src/
│   │   ├── main.js            # Init orchestrator — loads Cesium, all layers, panels
│   │   ├── worldViewer.js     # MAIN orchestration — events, hotspots, alerts, AI,
│   │   │                       │  timeline, command palette, panels
│   │   ├── data/              # 14 data layers + manager + layer state + local geojson
│   │   ├── world-model/       # EntityStore, EventStore, RelationshipGraph,
│   │   │                       │  LayerRegistry, ProviderHealth
│   │   ├── events/            # EventBus, IngestPipeline, classify, geocode,
│   │   │                       │  score, dedup, correlate, normalize
│   │   ├── providers/         # RSS + GDELT news adapters
│   │   ├── scenes/            # SceneDirector — cinematic camera presets
│   │   ├── voice/             # Voice command system
│   │   ├── annotations/       # Annotation engine (4 renderers)
│   │   ├── camera.js          # Camera controls
│   │   ├── hud.js             # HUD display
│   │   ├── commandPaletteController.js
│   │   ├── worldPulseController.js
│   │   ├── eventsPanelController.js
│   │   ├── hotspotEngineController.js
│   │   ├── timelineController.js
│   │   ├── layerSelectorController.js
│   │   ├── floatingPanelController.js
│   │   ├── localInvestigationController.js
│   │   ├── placeIntelligenceController.js
│   │   ├── liveSignalsController.js
│   │   └── ... (47 source files total)
│   ├── dist/                  # Vite production build (gitignored)
│   ├── public/                # Static assets (models, icons, SVGs)
│   ├── scripts/               # QA scripts, build scripts, fixtures
│   ├── docs/                  # God's Eye View docs (CURRENT-STATE, KNOWN-ISSUES, media)
│   ├── .env                   # Environment variables (gitignored)
│   ├── .env.example           # Example env (committed)
│   └── package.json           # Renderer dependencies
│
├── electron/main/index.cjs    # Root Electron main process
├── electron/preload/index.cjs # Preload bridge
├── package.json               # Root — Electron, electron-builder, build scripts
├── .gitignore                 # node_modules, dist/
├── context.md                 # Application context
├── prompt.md                  # AI interaction prompts
└── docs/
    ├── ARCHITECTURE.md        # Deep-dive architecture
    ├── DATA_SOURCES.md        # All external data sources
    └── DEVELOPMENT.md         # This file
```

---

## API Surface

### Preload Bridge (renderer → Electron main)

Available as `window.worldViewerAPI`:

```javascript
window.worldViewerAPI.copyToClipboard(text)
window.worldViewerAPI.readFromClipboard()
window.worldViewerAPI.sendNotification(title, body, urgency)
window.worldViewerAPI.getSystemInfo()
window.worldViewerAPI.openExternal(url)
window.worldViewerAPI.appVersion()
window.worldViewerAPI.windowMinimize()
window.worldViewerAPI.windowMaximize()
window.worldViewerAPI.windowFullscreen()
window.worldViewerAPI.windowAlwaysOnTop(val)
window.worldViewerAPI.setCredential(key, value)
window.worldViewerAPI.getCredential(key)
```

### Main Process IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `clipboard:write` | renderer → main | Write to clipboard |
| `clipboard:read` | renderer → main | Read from clipboard |
| `notification:send` | renderer → main | Send desktop notification |
| `system:info` | renderer → main | Get system info |
| `shell:openExternal` | renderer → main | Open URL in browser |
| `app:version` | renderer → main | Get app version |
| `window:minimize` | renderer → main | Minimize window |
| `window:maximize` | renderer → main | Maximize window |
| `window:fullscreen` | renderer → main | Toggle fullscreen |
| `window:alwaysOnTop` | renderer → main | Set always-on-top |
| `window:hideControls` | renderer → main | Hide window controls |
| `window:showControls` | renderer → main | Show window controls |
| `credentials:set` | renderer → main | Store credential (encrypted) |
| `credentials:get` | renderer → main | Retrieve credential |

---

## Adding a Data Layer

1. **Create the layer file:**
   ```bash
   touch sources/gods-eye-view-main/src/data/<layer-name>.js
   ```

2. **Export layer config + lifecycle:**
   ```javascript
   export const <layer>Layer = {
     id: '<layer-id>',
     name: '<Display Name>',
     category: '<valid-category>', // air, sea, space, earth, weather, infrastructure, cameras, news, events, transport, communication
     defaultOn: false,
     // ... layer-specific config
   }

   export function onActivate(layer) { /* ... */ }
   export function onDeactivate(layer) { /* ... */ }
   export function update(layer, time) { /* ... */ }
   ```

3. **Register in `src/main.js`:**
   ```javascript
   import { <layer>Layer, onActivate as onActivate<layer> } from './data/<layer>.js'
   // Add to imports at top of main.js
   ```

4. **Add to LayerRegistry with valid category from `VALID_CATEGORIES`:**
   - air, sea, space, earth, weather, infrastructure, cameras, news, events, transport, communication

---

## Adding a UI Feature

1. **Create the controller:**
   ```bash
   touch sources/gods-eye-view-main/src/<feature>Controller.js
   ```

2. **Export init function:**
   ```javascript
   export default function init<Feature>() {
     // Read from window.wv or window.gev as needed
     // Set up event listeners, DOM, etc.
   }
   ```

3. **Call from `worldViewer.js` or `main.js`:**
   ```javascript
   import init<Feature> from './<feature>Controller.js'
   init<Feature>()
   ```

---

## Adding an IPC Handler

1. **Main process** (`electron/main/index.cjs`):
   ```javascript
   ipcMain.handle('my:feature', async (event, ...args) => {
     // Handle the request
     return result
   })
   ```

2. **Preload bridge** (`electron/preload/index.cjs`):
   ```javascript
   myFeature: (...args) => ipcRenderer.invoke('my:feature', ...args),
   ```

3. **Renderer:**
   ```javascript
   const result = await window.worldViewerAPI.myFeature(args)
   ```

---

## Environment Variables

Create `sources/gods-eye-view-main/.env`:

```env
CESIUM_TOKEN=your_cesium_ion_token
BING_MAPS_KEY=your_bing_maps_key
OPENSKY_USERNAME=your_opensky_username
OPENSKY_PASSWORD=your_opensky_password
GROQ_API_KEY=your_groq_api_key
```

The `.env.example` is committed — copy it and fill in your values.

---

## Build & Packaging

### Development
```bash
npm run dev              # Vite dev server (port 4173)
npm run electron:dev     # Electron + dev server concurrently
```

### Production build
```bash
npm run build:renderer   # Vite → sources/gods-eye-view-main/dist/
npm run dist:linux       # Build + electron-builder → dist/world-viewer-*.AppImage + .deb
```

### Known build issue
`npm run dist:linux` fails at icon conversion — no icon file in `build/`. To fix:
1. Add `build/icon.png` (512x512 PNG recommended)
2. Or configure `build.icon` in `package.json`
3. Re-run `npm run dist:linux`

The existing `dist/linux-unpacked/` from commit `371d443` is functional for testing.

### Package metadata
- **appId:** `com.worldviewer.app`
- **productName:** `WORLD VIEWER`
- **artifactName:** `world-viewer-${version}.${ext}`
- **Linux targets:** AppImage (x64) + .deb (x64)
- **Category:** Science

---

## Testing

```bash
cd sources/gods-eye-view-main
npm test              # Runs unit tests via node scripts/run-unit-tests.mjs
```

The God's Eye View renderer has extensive test coverage across data layers, world model, events, annotations, cockpit UI, and more.

---

## Debugging

### Renderer
- Open Cesium debug: `viewer.debugCommandFactory` in console
- Check `window.wv` and `window.gev` for state
- Look at browser devtools (Electron: `Ctrl+Shift+I` or `Cmd+Opt+I`)

### Main process
- Console output goes to terminal where Electron was launched
- Check `console.log` in `electron/main/index.cjs`

### Events
- EventBus emits `event:new` and `event:update` — subscribe to debug
- Check `EventStore` state via `EventStore.getAll()`

---

## License

MIT
