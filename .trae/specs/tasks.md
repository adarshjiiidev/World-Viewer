# WORLD VIEWER - Implementation Plan

## Task 1: Electron Shell Hardening + First-Run Loading Experience
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Ensure Electron shell (main/index.cjs, preload/index.cjs) fully implements: secure settings, CSP, window state, tray/menu if needed, desktop notification plumbing.
  - Add first-run cinematic loading sequence ("Initializing World Model…" with Globe✓ Terrain✓ Aircraft Maritime Space Earth News status tiles) that shows as an overlay until Cesium + initial providers finish connecting; do NOT block startup waiting on every provider.
  - Add POWER UP / Settings panel entry in the top-right; add provider status health indicator.
  - Verify packaging: `npm run dist:linux` produces both AppImage and .deb.
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-18
- **Test Requirements**:
  - `rule` TR-1.1: `npm run dist:linux` completes with exit code 0 and `dist/` contains both `world-viewer-*.AppImage` and `world-viewer_*.deb`. Evidence: shell output log + ls dist.
  - `rule` TR-1.2: Opening app without any env keys still shows globe (Cesium loads; missing providers degrade gracefully to not-loaded). Evidence: first-run screenshot.
  - `rule` TR-1.3: Electron contextIsolation=true, sandbox=true, nodeIntegration=false in both code and runtime. Evidence: grep of main + chrome://inspect remote state.
  - `rule` TR-1.4: Native notification via ipc `notification:send` produces a desktop notification. Evidence: dbus capture or screenshot.
  - `rubric` TR-1.5: First-run cinematic polish; scale 1-5; 1=static text only, 3=progress bars with ✓, 5=cinematic fade, animated tiles, transition to earth; threshold >= 4. Evidence: screenshots + optional short GIF.
- **Notes**: Build on existing electron shell already in repo.

## Task 2: God's Eye Zero-Regression Baseline + Layer Registry Audit
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Verify and catalog that all 14 original God's Eye layers still function: Flights, Military Flights, Vessels, Satellites, Earthquakes, Traffic, CCTV, Radio, Bikeshare, Fires, Space Missions, Datacenters, Dams, Submarine Cables.
  - Fix any broken imports/module wiring caused by being relocated inside world-viewer.
  - Create a unified `src/world-model/layerRegistry.js` module that each layer registers into; expose metadata (name, provider, authRequired, health, toggle).
  - Verify God's Eye core interactions: cockpit mode, 250 km contacts, click-to-track, trails, 3D aircraft, sensor modes, detection overlay, tactical HUD, global context, scene director, share URLs, reset globe, keyboard shortcuts.
- **Acceptance Criteria Addressed**: AC-3, AC-4, AC-16, AC-17
- **Test Requirements**:
  - `rule` TR-2.1: Layer registry contains 14 original GEV layers. Evidence: JSON dump of layerRegistry.list().
  - `rule` TR-2.2: Click aircraft → track → cockpit → NVG → FLIR → exit without error. Evidence: step-by-step log + screenshots.
  - `rule` TR-2.3: Share URL generated for tracked aircraft + NVG; on reload URL reconstructs same scene. Evidence: URL + before/after state diff.
  - `rubric` TR-2.4: Zero visual regression for core cockpit; scale 1-5; 1=terrain misaligned, 3=works with glitches, 5=rock solid; threshold >= 4. Evidence: cockpit screenshots at low altitude.

## Task 3: Unified World Model Core (Entities/Events/Relationships)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - Create `src/world-model/` with modules: `entities.js`, `events.js`, `relationships.js`, `sources.js`.
  - Entity schema: `{ id, type, lat, lon, alt, heading, speed, source, freshness, metadata, firstSeen, lastSeen }`.
  - Event schema: `{ id, type, title, summary, location {lat,lon,placeName}, timestamp, sources[], actors[], confidence 0-100, severity, relatedIds[], url }`.
  - Relationship graph: adjacency map (country → region, event → location, aircraft → airport, ship → port); expose `nearby()`, `related()`, `countryContext()`.
  - Port/adapt existing GEV data manager to emit updates into World Model, not ad-hoc stores.
- **Acceptance Criteria Addressed**: AC-4, AC-6, AC-10
- **Test Requirements**:
  - `rule` TR-3.1: Insert aircraft + airport; relationship graph produces `related(airport.id)` → includes that aircraft. Evidence: unit test pass.
  - `rule` TR-3.2: Insert event with country; `countryContext(country)` returns recent events list. Evidence: unit test.
  - `rubric` TR-3.3: World Model perf with 10k entities; add/update ops < 2 ms avg; scale 1-5; threshold >= 4. Evidence: benchmark output.

## Task 4: Event Engine Pipeline (Ingest → Publish)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - Build ingest pipeline modules in `src/events/`: `ingest.js`, `normalize.js`, `geocode.js`, `classify.js`, `dedup.js`, `correlate.js`, `score.js`, `bus.js`.
  - Bus is publish/subscribe so UI panels subscribe by region/type/severity without polling.
  - Classifier supports all 19 required event types (see spec FR-34).
  - Dedup: title similarity + 100 km geospatial window + 24 h temporal window → merge into one event with multiple sources.
  - Score: severity × confidence × sourceCount.
- **Acceptance Criteria Addressed**: AC-5, AC-36, AC-39
- **Test Requirements**:
  - `rule` TR-4.1: Feed 3 simulated articles about same event → bus emits 1 merged event with sourceCount=3. Evidence: event bus message log.
  - `rule` TR-4.2: Event classifier correctly assigns CONFLICT / EARTHQUAKE / WILDFIRE types for sample inputs (use seed fixtures). Evidence: unit test pass.
  - `rule` TR-4.3: Score numeric 0-100 and confidence populated on every event. Evidence: sample event dump.
  - `rubric` TR-4.4: Dedup accuracy on synthetic bundle of 10 articles (5 events, 2 articles each); accuracy >= 80%. Evidence: dedup test report.

## Task 5: News Provider Adapters (RSS, GDELT-style public streams, World Monitor refs)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - Create `src/providers/news/` with: `rssAdapter.js`, `gdeltAdapter.js` (or GDELT-compatible public endpoint), `worldMonitorRefs.js` (pull feed patterns from sources/worldmonitor-main/src/config/feeds.ts).
  - Each adapter implements Provider pattern: connect, fetch, normalize into World Model Event.
  - Build provider health heartbeat + lastUpdate/latency/errorCount.
  - Geocode: offline city/country lookup table (use worldmonitor shared/geo-data.ts as reference) plus lightweight geocoder fallback.
- **Acceptance Criteria Addressed**: AC-5, AC-12
- **Test Requirements**:
  - `rule` TR-5.1: RSS adapter fetches a public news feed and yields ≥ 1 normalized World Model Event. Evidence: test against a stable public RSS (e.g., Reuters).
  - `rule` TR-5.2: Network-mocked provider failure → transitions to OFFLINE after 3 errors without crashing app. Evidence: health state log.
  - `rubric` TR-5.3: Adapter pluggability / decoupling; scale 1-5; threshold >= 4. Evidence: new dummy adapter added in < 30 lines without touching bus.

## Task 6: Data Domain Expansions (Air, Maritime, Space, Earth, Weather, Infra, Outages)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 2, Task 3
- **Description**:
  - Air: OpenSky + ADSB.lol adapter; airport state, airspace refs, density heatmap primitives. Build Air Anomaly Engine (FR-53 non-accusatory).
  - Maritime: AIS Stream adapter (free key); ports data; chokepoint density; Maritime Anomaly Engine.
  - Space: CelesTrak TLE fetcher; SGP4/satellite.js propagation via Web Worker; ISS/Starlink default catalogs + DENSE option; orbit rings/ground tracks/next pass.
  - Earth/Env: NASA EONET, volcanoes, storms; flood/tsunami public feeds where available.
  - Weather: contextual per-selected-entity weather (Open-Meteo free API).
  - Infrastructure: extend with pipelines, power, telecom, roads, rails (OSM refs).
  - Outages: map Cyber/Outage event type geographically from public sources (downdetector-style patterns where feasible).
  - Honor freshness labeling: SIMULATED/ESTIMATED clearly marked.
- **Acceptance Criteria Addressed**: AC-4, AC-12, AC-13, AC-19
- **Test Requirements**:
  - `rule` TR-6.1: Air anomaly triggers on synthetic route deviation → header ACTIVITY ANOMALY, no forbidden words. Evidence: anomaly card text + grep.
  - `rule` TR-6.2: SGP4 worker propagates ≥ 500 satellites at 1 Hz without blocking UI (> 45 FPS). Evidence: FPS + Cesium performance panel.
  - `rule` TR-6.3: Traffic layer without TomTom key displays SIMULATED or AGGREGATED label. Evidence: UI text capture.
  - `rule` TR-6.4: Selected aircraft/ship → contextual weather panel shows temp + wind. Evidence: panel screenshot.
  - `rubric` TR-6.5: Domain breadth coverage of expanded layers; scale 1-5; threshold >= 4. Evidence: layer registry expanded list.

## Task 7: Floating Control System + Top Bar + Command Palette + Layer Selector
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - Minimal top bar: Left WORLD VIEWER title, center universal search/command palette input, right LIVE indicator (green/yellow/red dot + health), settings icon.
  - Floating controls docked as compact chips: LIVE CONTACTS, LAYERS, WORLD CONTEXT, TIMELINE, SENSORS, HUD, DETECTION, GOD'S EYE, ANNOTATE — hideable with kbd.
  - No permanent sidebar. Layer selector opens as compact floating 10-row panel (AIR/SEA/SPACE/EVENTS/EARTH/WEATHER/INFRA/CAMERAS/NEWS) with toggle dots.
  - Command palette (Ctrl+K): fuzzy search commands + queries (go, track, show, hide, sensor, replay, reset, measure, annotate).
  - Keyboard shortcuts documented and wired: 1-7, H, D, C, Esc, Ctrl+K, Space, G, L, T, A.
- **Acceptance Criteria Addressed**: AC-10, AC-14
- **Test Requirements**:
  - `rule` TR-7.1: Ctrl+K opens palette with fuzzy matching ("show air" → matches Show Aircraft). Evidence: keyboard event + palette results.
  - `rule` TR-7.2: Layer selector renders 9 domains with toggles; toggling a domain updates Cesium layer visibility within 500 ms. Evidence: toggle sequence log.
  - `rule` TR-7.3: LIVE indicator state mirrors aggregate provider health (ONLINE/DEGRADED/OFFLINE). Evidence: mocked network state → indicator changes.
  - `rubric` TR-7.4: Minimal chrome aesthetic score; scale 1-5; threshold >= 4. Evidence: full-window screenshot at 1440×900 with pixel allocation tally (globe pixels vs chrome pixels).

## Task 8: Universal Search + Country Intelligence Panel + Conflict Monitor
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3, Task 4, Task 7
- **Description**:
  - Universal search across domains: country, city, aircraft, ship, satellite, airport, port, event, news, infra, camera, quake, fire, conflict, region.
  - Search result select → Cesium flyTo + select object + open context panel (if appropriate).
  - Country intelligence contextual panel (overlay globe, NOT a new route): Current events, Political, Security, Civil, Natural Hazards, Infrastructure, News, International Relations, Sanctions, Transport, Space/Aviation/Maritime context; concise+expandable.
  - Country history scrub via Timeline.
  - Conflict Monitor contextual panel: event locations, density, timeline, actors, related news, air+maritime traffic, infrastructure, natural events; cautious disclaimer.
- **Acceptance Criteria Addressed**: AC-6, AC-10, AC-38
- **Test Requirements**:
  - `rule` TR-8.1: Search "Delhi" → results include city + country; selecting flies camera to within 2° of 28.61,77.23. Evidence: camera position snapshot.
  - `rule` TR-8.2: Clicking country does NOT change URL. Evidence: location.href before/after identical.
  - `rule` TR-8.3: Country panel renders at minimum 6 required sections. Evidence: DOM structure dump.
  - `rule` TR-8.4: Conflict monitor panel contains disclaimer text "never present unsupported battlefield claims as fact" or equivalent. Evidence: panel text.
  - `rubric` TR-8.5: Information density vs clarity; scale 1-5; threshold >= 4. Evidence: panel screenshot.

## Task 9: Hotspot Engine, Escalation Indicator, World Pulse
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3, Task 4
- **Description**:
  - Hotspot engine: sliding window score = density × severity × changeVelocity × sourceDiversity × concentration → list of hotspots; click → flyTo.
  - Escalation indicator per region 0-100 + trend + confidence + supporting signals (never predicts "war").
  - World Pulse compact floating instrument: 9 metric rows (Global Activity, Conflict, Civil Unrest, Aviation, Maritime, Natural Hazards, Infrastructure, Cyber/Outage, Space) with score + arrow + caveat.
- **Acceptance Criteria Addressed**: AC-6, AC-7, AC-8, AC-9
- **Test Requirements**:
  - `rule` TR-9.1: Seeded hotspot region triggers detection + flyTo works. Evidence: hotspot list JSON + camera position.
  - `rule` TR-9.2: Escalation indicator string does NOT contain "war". Evidence: grep.
  - `rule` TR-9.3: World Pulse renders 9 rows, each numeric 0-100, each with methodology caveat. Evidence: panel DOM snapshot.
  - `rubric` TR-9.4: Metric explainability and caveat visibility; scale 1-5; threshold >= 4. Evidence: screenshot.

## Task 10: Timeline Synchronization + Event Replay + Track History
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3, Task 4
- **Description**:
  - Timeline bottom bar: LIVE / 15M / 1H / 6H / 12H / 24H / 7D / 30D / CUSTOM presets + scrubber + play/pause (Space).
  - Global time cursor propagates to: aircraft trail interpolation, ship positions, satellite positions, event visibility, fires, earthquakes, news, infra changes.
  - Event replay view (FR-41): First Signal → News → Additional → Development → Escalation → Current, with step UI.
  - Track history: 15MIN/1H/6H/24H selectable for aircraft/ships/satellites (where data permits).
- **Acceptance Criteria Addressed**: AC-7, AC-20
- **Test Requirements**:
  - `rule` TR-10.1: Moving scrubber from LIVE to 24HAGO changes visible entity counts deterministically. Evidence: before/after count logs.
  - `rule` TR-10.2: Space shortcut toggles play/pause of timeline. Evidence: timeline isPlaying boolean flip.
  - `rubric` TR-10.3: Timeline smoothness during scrub; scale 1-5; threshold >= 4. Evidence: FPS during scrub.

## Task 11: Contextual AI HUD + Scene-Aware Tools + Automatic Intelligence Overlays
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 2, Task 3, Task 4
- **Description**:
  - Context payload for AI: camera location, scale, visible layers, selected entity, selected event, timeline cursor, relevant live data.
  - Q&A router: "What am I looking at?", "What is happening here?", "What changed?", "What are these aircraft?", "What ships are nearby?", "What happened today here?", "Major events here?", "What sources support this?".
  - Auto-intelligence: 1-line contextual overlay for current view (e.g., "Heavy aviation over W Europe", "3 quakes last hour") — only when data-backed.
  - Visual grounding: at street level, inspect viewport screenshot (legible public signage only); return "Unable to determine" if uncertain.
  - OpenAI Realtime session: keep existing God's Eye voice tooling; gate behind POWER UP panel key entry; all keys via Electron safeStorage or main-process broker.
- **Acceptance Criteria Addressed**: AC-11
- **Test Requirements**:
  - `rule` TR-11.1: Non-voice tool router executes: "Take me to Delhi" → camera within 2° of 28.6,77.2; "Show me aircraft near Dubai" → layer on + 500 km filter; "Switch to night vision" → sensor=NVG; "Reset globe" → full-earth. Evidence: 4 test logs each pass.
  - `rule` TR-11.2: Visual grounding at low confidence says "Unable to determine" (not hallucinating). Evidence: test with intentionally-blank image.
  - `rubric` TR-11.3: Context relevance of AI HUD 1-liner; scale 1-5; threshold >= 4. Evidence: blind evaluation by 3 sample scenes.

## Task 12: Voice Whiteboard + Annotation System (Measure/Routes/Polygons)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 2
- **Description**:
  - Preserve existing voice whiteboard; ensure commands produce real Cesium map objects.
  - Annotation types: points, lines, routes, polygons, measurements, labels.
  - Persist until cleared; export/import as GeoJSON.
  - Keyboard `A` toggles annotation panel.
- **Acceptance Criteria Addressed**: AC-11, AC-14
- **Test Requirements**:
  - `rule` TR-12.1: "Outline India" produces a polygon (rough country boundary) visible on globe. Evidence: Cesium entity collection count.
  - `rule` TR-12.2: Measure command (Delhi to Mumbai) produces measurement line with ~1150 km ± 10%. Evidence: distance text.
  - `rubric` TR-12.3: Annotation visual polish; scale 1-5; threshold >= 4. Evidence: screenshot of multiple annotations.

## Task 13: Cinematic Scene Director Presets + Global Context
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 2, Task 10
- **Description**:
  - Global Context mode: pull back to full Earth, stage major signals, remember prior camera, restore exact prior view on exit.
  - Scene presets: Orbital Watch, Global Pulse, Live Air Traffic, Maritime World, Natural Earth, Conflict Monitor, Space Watch, Night Earth, World at Night — each a choreographed camera + layer sequence.
- **Acceptance Criteria Addressed**: AC-16, AC-14
- **Test Requirements**:
  - `rule` TR-13.1: Enter Global Context → prior camera stored as {lon,lat,height}; exit → camera restored to within 2% of stored. Evidence: before/after camera objects.
  - `rule` TR-13.2: 9 scene preset buttons exist; each executes within 5 s of click without error. Evidence: preset execution logs.
  - `rubric` TR-13.3: Cinematic quality; scale 1-5; threshold >= 4. Evidence: short GIF or screenshots.

## Task 14: Provider Health, Settings/POWER UP Panel, Watch Areas, Alert System
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 2, Task 4
- **Description**:
  - Provider health grid (per provider: ONLINE/DEGRADED/STALE/OFFLINE/AUTH REQUIRED, lastUpdate, latency, errorCount, dataAge).
  - POWER UP settings panel: Provider / Status / What it enables / Credential required / Data limits / Terms; credential entry writes to Electron safeStorage.
  - Watch Areas: save named polygons (India, Delhi, Middle East, Taiwan Strait, Europe, South China Sea…); trigger notifications.
  - Alerts: Electron notifications on trigger; LOW/MEDIUM/HIGH/CRITICAL.
- **Acceptance Criteria Addressed**: AC-12, AC-18
- **Test Requirements**:
  - `rule` TR-14.1: Setting a provider key stores it in safeStorage (or localStorage fallback in dev) and does NOT appear in share URL or logs. Evidence: safeStorage dump mock + logs grep.
  - `rule` TR-14.2: Seed HIGH-severity event inside watch area polygon → desktop notification fires. Evidence: notification payload log.
  - `rubric` TR-14.3: POWER UP panel clarity and UX; scale 1-5; threshold >= 4. Evidence: screenshot.

## Task 15: Performance Optimization + Memory Bounds
- **Status**: `pending`
- **Priority**: high
- **Depends On**: All prior tasks
- **Description**:
  - Cesium: Primitives, clustering, LOD, batching; avoid EntityCollection per-frame churn.
  - Web Workers for SGP4, anomaly scoring, dedup, event scoring.
  - Spatial indexes (e.g., simple grid/lat-lon hash) for nearby() and hotspot().
  - Time-windowed caches + ring buffers for trails; evict history > configured window.
  - Throttle UI updates; virtualize lists (contacts, events).
- **Acceptance Criteria Addressed**: AC-15
- **Test Requirements**:
  - `rubric` TR-15.1: FPS with 3k aircraft, 2k ships, 1k satellites, 1k events visible; scale 1-5; threshold >= 4. Evidence: Cesium FPS panel 1-min sample.
  - `rule` TR-15.2: 1-hour sustained run → memory growth < 1.5× baseline. Evidence: DevTools memory heap snapshot before/after.
  - `rule` TR-15.3: Contacts roster 1000 items scrolls smoothly (virtualized). Evidence: scroll FPS.

## Task 16: Visual Polish (Dark Tactical Identity, Detection Overlay, 3D LOD, Sensor Transitions)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 7
- **Description**:
  - Final visual pass: deep dark backgrounds, thin tactical HUD, small telemetry fonts, subtle scanline/crt/glow where appropriate per sensor, no giant panels.
  - Detection overlay (D): lightweight screen-space bounding boxes; avoid wall of text; cull by distance and priority.
  - 3D LOD: distant marker → 3D simple → 3D detailed. Apply to aircraft; extend to ships/satellites where practical.
  - Sensor transitions: smooth fade/cut between Normal/CRT/NVG/FLIR/NOIR/Snow/Tactical/Surveillance; shader FX preserved.
- **Acceptance Criteria Addressed**: AC-14, AC-16
- **Test Requirements**:
  - `rubric` TR-16.1: Globe-first aesthetic score 0-100 pixel allocation; threshold >= 90% globe. Evidence: pixel counting of full-screen screenshot.
  - `rule` TR-16.2: Detection overlay culls: detection count never exceeds 50 on screen at once. Evidence: count overlay log.
  - `rubric` TR-16.3: Sensor mode transition smoothness; scale 1-5; threshold >= 4. Evidence: GIF of all 8 sensor flips.

## Task 17: Freshness Labeling + Data Provenance UI + Responsible OSINT Boundary
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3, Task 4
- **Description**:
  - Every live entity/event shows freshness badge: LIVE/RECENT/DELAYED/STALE/UNAVAILABLE/SIMULATED/ESTIMATED.
  - Provenance inspector modal per entity: source, sourceURL, provider, timestamp, ingestionTime, confidence, derivation.
  - Hard exclusion: no named-person search, no face recognition, no individual tracking queries; UI actively rejects or warns.
- **Acceptance Criteria Addressed**: AC-13, AC-19
- **Test Requirements**:
  - `rule` TR-17.1: Traffic sim badge shows SIMULATED without TomTom key; substring not LIVE. Evidence: DOM text.
  - `rule` TR-17.2: Entity provenance inspector opens and shows ≥ 5 required fields. Evidence: modal screenshot.
  - `rule` TR-17.3: Attempting a person-name query in search/command-palette shows warning/refusal, not a query result. Evidence: query UI output.

## Task 18: License Audit Matrix + Structured Logging + Diagnostics
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: All prior integration work
- **Description**:
  - Create docs/LICENSE_MATRIX.md covering: gods-eye-view (MIT), SIGINT (check license), osiris (check license), worldmonitor (check license), Cesium, Vite, Electron, satellite.js, and all deps.
  - Structured logger: ELECTRON/CESIUM/PROVIDER/DATA/EVENT/VOICE/AI/PERFORMANCE/SECURITY categories.
  - Diagnostic view (hidden opt-in): live provider health, FPS, memory, entity counts, queued events.
- **Acceptance Criteria Addressed**: AC-12, AC-20
- **Test Requirements**:
  - `rule` TR-18.1: docs/LICENSE_MATRIX.md exists with ≥ 20 entries. Evidence: file present + wc -l.
  - `rule` TR-18.2: Logger produces ≥ 5 distinct category log lines during normal startup. Evidence: log tail capture.

## Task 19: End-to-End Gauntlet Run + Bug Fixing Pass
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 1–18
- **Description**:
  - Walk through the 78-step master acceptance scenario (spec section 78) step by step.
  - Record pass/fail per step; file fixes for failing steps.
  - Extra polish pass: any animation jank, label flicker, broken transitions.
- **Acceptance Criteria Addressed**: AC-20, AC-3, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-15, AC-16, AC-18, AC-19
- **Test Requirements**:
  - `rubric` TR-19.1: 78-step gauntlet pass count / total; threshold >= 70/78. Evidence: step-by-step checklist with screenshots/logs.
  - `rule` TR-19.2: No uncaught exceptions visible in console during 15 min continuous run. Evidence: DevTools console error count = 0.
