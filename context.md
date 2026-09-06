# Context.md File

> **Workspace:** /home/adarshjii/Projects/world-viewer

---

**User**

`/home/adarshjii/Projects/world-viewer/.trae/specs/Context.md`

**Assistant**

I can see this is a context document for building the **WORLD VIEWER** - a comprehensive Electron desktop application with CesiumJS globe, multi-domain data ingestion, and live monitoring features. The user mentions partial work is done and wants everything completed, optimized, and polished.

Let me first explore the current project structure and read the master specification to understand what needs to be done.

Now let me read the existing specification and tasks documents to understand what has been planned and what remains to be completed.

I can see this is resuming an interrupted Spec Mode workflow. The spec.md and tasks.md have been created with 19 comprehensive tasks. Some initial work was started on the Electron shell, CSP, IPC handlers, cinematic loading, LayerRegistry, and keyboard shortcuts. Let me check the actual current state of the code to understand exactly what's been completed and what remains.

Good, Spec Mode is now active. The spec.md and tasks.md are already created from an interrupted workflow. Let me audit the current codebase state to understand exactly what was completed vs. what remains before selecting the implementation tasks. Let me check the key implementation files.

Good, the Electron shell and preload are well-implemented with security features. Now let me check the actual state of the God's Eye renderer files to see what was implemented vs. still pending. I need to check main.js, ui.js, firstRun.js, style.css, and whether LayerRegistry exists.

The God's Eye codebase is quite extensive with hundreds of modules. Let me check the critical integration files to understand what's actually been wired together: main.js (bootstrap), world-model/layerRegistry.js (14 layers?), ui.js (keyboard shortcuts), firstRun experience, and index.html.

Now let me check the critical integration points: main.js (bootstrap wiring), ui.js (keyboard shortcuts), and index.html for loading-screen elements.

Excellent! I can see main.js is well-structured with all 14 LayerRegistry registrations already in place. Now let me check the cinematic firstRun.js loading, ui.js for keyboard shortcuts (G, Space, R), and index.html for loading-screen elements.

Let me read the specific keyboard shortcuts section in ui.js around line 3332 to see what shortcuts are implemented, and also check if the loading-screen tiles exist in index.html.

Excellent! I now have a comprehensive understanding of the current state. Let me summarize what's been done and what remains:

**Completed:**
- ✅ **Electron Shell (Task 1)**: CSP, contextIsolation, safeStorage, preload bridge, IPC handlers, window state, notifications, clipboard
- ✅ **God's Eye Base + LayerRegistry (Task 2)**: All 14 layers registered, G/Space/R shortcuts implemented, cinematic firstRun loading, mission launcher firstRunExperience, share links, cockpit, scenes, HUD, detection, annotations, 8 sensor styles, voice commands
- ✅ **hundreds of source modules** (annotations, scenes, overlays, voice, cockpit, data layers, etc.)

**Still pending:**
- Tasks 3-19: World Model Core, Event Engine, News Providers, Domain Expansions, Floating Controls, Search, Hotspots, Timeline, AI HUD, Voice Whiteboard, Scene Director Presets, Settings, Optimization, Visual Polish, Freshness Labeling, License Audit, E2E Gauntlet.

Let me now run the application to see the current state, then systematically implement what's remaining.

Let me start by installing dependencies and verifying the current base works. I'll install root dependencies first, then check if the God's Eye view dependencies are installed.

Now let me check and install the God's Eye view dependencies.

Good, dependencies installed. Now let me build the missing pieces. This is a substantial scope, so I'll delegate to subagents in parallel, working on non-overlapping file areas. Let me start with the two highest-impact, non-overlapping work streams:

**Stream A (Data Core):** World Model + Event Engine Pipeline + News/RSS Adapters  
**Stream B (UI Systems):** Command Palette Controller + World Pulse + Events Panel + Timeline Bar

Let me launch both concurrently.

Now launching two concurrent subagents for the high-impact, non-overlapping work streams. Stream A builds pure data/core modules (no edits to existing files). Stream B builds UI controllers. I will integrate them into main.js/ui.js myself afterward.

I'll start by reading the existing layerRegistry.js to understand the code style conventions, then create all 16 files systematically.

Now I understand the style conventions. Let me create the todo list and start building all 16 files.

Let me create the first batch of files (world-model modules):

Now creating the events modules (bus, normalize, geocode, classify):

Now let me check if the world-model/index.js file exists (referenced by the barrel file) before creating the final barrel file:

Good, the index exists. Now creating the final barrel file:

All files created. Let me finalize the todo list and verify the files were created correctly:

All files are in place. Now let me run a quick syntax/import check to ensure the modules are valid:

All 16 files pass syntax validation. Let me finalize the todo list:

All 16 modules have been created successfully. Here's what was built:

**world-model layer (4 files)**
- `src/world-model/entities.js` — `EntityStore` with 13 entity types, 1° lat/lon grid spatial index, haversine `getNearby()`, `bulkUpsert()`, and `deleteOlderThan()`. Map-keyed internal state + singleton default export.
- `src/world-model/events.js` — `EventStore` covering 19 event types (`CONFLICT`…`ENVIRONMENT`), 4 severity levels, `search()`, `getByCountry()`, `getNearby()`, plus dedup helpers `normalizeTitle`, `roundLatLon`, `dayBucket`, `buildDeduplicationKey`.
- `src/world-model/relationships.js` — `RelationshipGraph` (Map-of-Maps adjacency), 30-country bounding-box `findCountryForLatLon()`, `countryContext()` aggregator, `nearby(entityId, radiusKm)`.
- `src/world-model/sources.js` — `ProviderHealth` with 5 status states, `markError`, `heartbeat`, pub/sub `subscribe()` via listener Set.

**events pipeline (8 files)**
- `src/events/bus.js` — `EventBus` with `on/off/once/emit` for 10 event types (`event:new`, `entity:bulk`, `hotspot:detect`, etc.).
- `src/events/normalize.js` — `normalizeRawArticle()` with conservative confidence (explicit coords=80, text loc=50, none=20), HTML-stripping `cleanText`, RFC3339/epoch `parsePublishedAt`.
- `src/events/geocode.js` — Offline `geocodeText()` backed by 50-entry `CITIES_TABLE` + 38-entry `COUNTRIES_TABLE` with name-matching indices.
- `src/events/classify.js` — Keyword `classify()` across all 19 event types with signal tracking, + `classifySeverity()` using severity-keyword score ladder.
- `src/events/dedup.js` — `DedupEngine` with Jaccard `similarityScore()` (stopwords removed), 100 km / 24 h window, and union-based `merge()` strategy (max confidence, earliest timestamp, merged sources/actors).
- `src/events/correlate.js` — `CorrelateEngine.findRelated()` across 500 km / 72 h with `COMPLEMENTARY_TYPES` boost, returns related events + relationship edges.
- `src/events/score.js` — `computeEventScore()` (severity weight × confidence × source log-boost + 7-day linear recency), `computeHotspotScore()` (count/severity/type diversity/source diversity/velocity).
- `src/events/ingest.js` — `IngestPipeline.ingestArticle()` wiring normalize → geocode → classify → dedup → score → EventStore → EntityStore sync → RelationshipGraph edges → `event:new/update` bus emits, with `beforeNormalize`/`afterClassify`/`afterDedup` hooks and `ingestBulk()`.

**providers/news (3 files)**
- `src/providers/news/rssAdapter.js` — `RssAdapter` Provider (connect/disconnect/fetch/normalize/health), DOMParser-based RSS/Atom parsing, 5 default public feeds (Reuters, BBC, Al Jazeera, NPR, CNN), 60 s timer, graceful CORS fallback with per-feed + aggregate `ProviderHealth`.
- `src/providers/news/gdeltAdapter.js` — `GdeltAdapter` that tries the GDELT GeoJSON endpoint first and automatically falls back to 5 curated international RSS feeds on CORS/parse failure. Runs results through `IngestPipeline.ingestBulk()` on every tick.
- `src/providers/news/index.js` — Named exports of both adapters + `startAll(options)` bootstrap helper.

**barrel file (1 file)**
- `src/index.worldviewer.js` — Re-exports `LayerRegistry` + `VALID_CATEGORIES` from the existing world-model index, all 4 stores (default + Impl), EventBus, IngestPipeline, RssAdapter/GdeltAdapter/startAll, classify/classifySeverity, geocodeText + both tables, and both scorers. Also exports a frozen `default` object aggregating the entire public API.

All files follow conventions from `layerRegistry.js`: frozen static tables (`Object.freeze`), Map-based internal state, classes with constructors + instance methods, singleton default exports plus named Impl/helper exports, single JSDoc header block, zero comments inside function bodies, and `console.warn` only in catch paths. A full 16-file syntax-parsing check passed (exit 0).

All 8 new module files were created successfully under `sources/gods-eye-view-main/src/`. No existing files were edited.

## Created files

| # | File | Lines | Description |
|---|------|-------|-------------|
| 1 | `src/commandPaletteController.js` | 220 | Ctrl+K palette, fuzzy filter, arrow nav, 13 data-cmd actions, Esc/backdrop close, ARIA dialog + focus trap/restore. Default export `initCommandPalette` → `{destroy, show, hide}`. |
| 2 | `src/worldPulseController.js` | 278 | 9-metric panel (global, conflict, unrest, aviation, maritime, hazards, cyber, space, **infrastructure** added dynamically). `computeMetrics` uses 24h vs prior 24h trend arrows, 60s refresh + `event:bulk`, footer caveat, methodology tooltips. Default export `initWorldPulse` → `{destroy, show, hide, refresh, computeMetrics}`. |
| 3 | `src/eventsPanelController.js` | 417 | Populates from `EventStore` with 6-item demo seed fallback; 5 filters (all/conflict/protest/disaster/political); rich items: type icon, title, summary, 📍 location, ⏱ relative time, severity chip (LOW/gray MEDIUM/yellow HIGH/orange CRITICAL/red), 📡 source count, confidence bar. Cesium `flyTo` + 30s red pulsing pin on click, close btn, 500px scroll area, empty state. Default export `initEventsPanel`. |
| 4 | `src/styles/layerSelector.css` | 217 | Dark tactical, `rgba(5,10,15,0.82)` + `backdrop-filter: blur(6px)`, green `#00ff88` accent, glowing hover borders, active dot green / off `#444`, fixed 32×32 trigger chip bottom-right, `opacity 150ms` transitions, responsive. |
| 5 | `src/layerSelectorController.js` | 345 | Appends 32×32 **LAYERS** trigger + floating 260px panel. 9 domain rows (AIR/SEA/SPACE/EVENTS/EARTH/WEATHER/INFRASTRUCTURE/CAMERAS/NEWS) with toggle dots, labels, count badges. Toggles `dataManager.setEnabled` (or `LayerRegistry` when present); NEWS synced with EVENTS (panel visibility). Outside-click + Esc close, 5s count refresh. Named exports `appendLayerSelectorStyles` + default `initLayerSelector`. |
| 6 | `src/hotspotEngineController.js` | 467 | `computeHotspotScores`: 100km × 24h sliding window, score = density × severityWeight × sourceDiversityFactor × (1+velocityChange/100) × concentrationFactor, top 10 globally. `renderHotspotEntities`: pulsing orange rings + "HOTSPOT\nActivity +{pct}%\nScore {score}" labels. Click-to-`flyTo` (2.2s, 2.5Mm alt). 120s refresh + `event:bulk`. Pulsing **HOTSPOTS** bottom-center chip. `computeEscalation(region)`: 0–100 score + "SUPPORTED SIGNALS: N events, X aviation disruption, Y infra events" (no "war" word). Named exports `computeHotspotScores`, `renderHotspotEntities` + default `initHotspotEngine`. |
| 7 | `src/styles/timeline.css` | 285 | 62px fixed bottom bar, glass blur 6px, `rgba(0,255,1

---

