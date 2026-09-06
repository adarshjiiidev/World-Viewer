# WORLD VIEWER - Product Requirements Document

## Overview
- **Summary**: WORLD VIEWER is a professional Linux desktop Electron application that evolves the open-source God's Eye View project into a comprehensive global intelligence platform. It preserves the full God's Eye experience (3D Cesium globe, cockpit mode, tracking, sensor modes, voice control) while dramatically expanding into geopolitical intelligence, world events, news fusion, multi-domain data, and a unified World Model.
- **Purpose**: Replace browsing multiple OSINT dashboards with a single, cinematic, globe-first interface where the user feels "I am looking at Earth through a technological command instrument" rather than using a SaaS dashboard.
- **Target Users**: Intelligence analysts, researchers, journalists, geopolitical watchers, OSINT enthusiasts, and anyone wanting a unified, spatial view of live public world signals.

## Goals
- Preserve 100% of mature God's Eye View capabilities with zero feature regression
- Package as a production-grade Linux Electron desktop application (AppImage + .deb)
- Expand into a unified World Model spanning Air / Sea / Space / Earth / Weather / Infrastructure / Geopolitics / News / Events
- Integrate World Monitor-style live news → world event fusion and geopolitical hotspot engine
- Build an event engine with ingest → normalize → geocode → classify → deduplicate → correlate → score → publish pipeline
- Add contextual AI HUD, World Pulse metrics, escalation indicators, conflict monitor, and country intelligence panels
- Achieve a polished, optimized, cinematic visual identity: dark, technical, minimal chrome, globe-first

## Non-Goals
- Do NOT convert into a traditional admin/news dashboard, giant-sidebar app, or AI chatbot
- Do NOT access private cameras, private-person tracking, facial recognition, or offensive cyber capabilities
- Do NOT require paid API keys for baseline functionality (Google Maps is the only required key and carries a generous free tier)
- Do NOT present simulated/estimated data as real telemetry (clearly label SIMULATED / ESTIMATED / STALE)
- Do NOT make unsupported battlefield claims or accusatory anomaly judgments (use "ACTIVITY ANOMALY" with signals)

## Background & Context
- Existing baseline: 4 source repos under `sources/` — gods-eye-view-main (visual/globe foundation + 13 live layers + voice + cockpit + scenes), SIGINT-main (Next.js + newsConfig + UCDP + cctv sources), osiris-main (data fusion + ACLED + sanctions + feeds registry), worldmonitor-main (news/events, hotspots, MCP, feeds, geopolitical data).
- Electron shell already exists at `electron/main/index.cjs` and `electron/preload/index.cjs` with contextIsolation, preload bridge, native notifications, clipboard, window state.
- Root `package.json` wires electron:dev → gods-eye-view vite dev server on port 4173.
- Master specification documented in `/home/adarshjii/Projects/world-viewer/prompt.md` (85 requirements + acceptance scenario).

## Functional Requirements

### Electron Desktop Shell
- **FR-1**: Launch as native-feeling Electron app "WORLD VIEWER" on Linux, not browser/localhost
- **FR-2**: Secure Electron: contextIsolation, preload bridge, sandbox, CSP, no nodeIntegration in renderer
- **FR-3**: Native integration: notifications, clipboard, always-on-top, fullscreen, window state restore
- **FR-4**: First-run cinematic loading sequence: initializing World Model → Globe/Terrain/Air/Space/Earth/News checks → Earth appears
- **FR-5**: Distributable packages: AppImage and .deb for x64 Linux via electron-builder

### God's Eye Foundation (Zero Regression)
- **FR-6**: Photorealistic 3D CesiumJS Earth with terrain and satellite/imagery basemaps
- **FR-7**: Live aircraft, military/public aircraft, live vessels/AIS, satellites with orbit rings, USGS earthquakes, NASA FIRMS fires, traffic, CCTV/public cameras, launches, radio, bikeshare, datacenters, dams, submarine cables
- **FR-8**: Cockpit mode with terrain following, live pos/heading/alt/speed/orient, aircraft model, nearby contacts, regional headlines, weather
- **FR-9**: 250 km contact roster (configurable 25/50/100/250/500/1000 km), nearby aircraft/ships/satellites/events/infrastructure/cameras/hazards
- **FR-10**: Click-to-track: camera lock, fading trail, full metadata card, source/freshness, related entities; applies to aircraft/ship/satellite/fire/earthquake/camera/weather/event/infrastructure
- **FR-11**: 3D aircraft class models with LOD (distant=marker, close=3D, very close=detailed); extend to ships/satellites/infrastructure where practical
- **FR-12**: Visual sensor modes (Normal, CRT, NVG, FLIR, NOIR, Snow, Tactical, Surveillance) with GLSL transitions applied across whole scene
- **FR-13**: Detection overlay screen-space IDs/labels for entities in view; lightweight, avoid wall-of-text
- **FR-14**: Tactical HUD, global context mode (pull back → stage major signals → restore exact prior camera), scene director / cinematic scene presets (Orbital Watch, Global Pulse, Live Air Traffic, Maritime World, Natural Earth, Conflict Monitor, Space Watch, Night Earth, World at Night)
- **FR-15**: Shareable scene URLs (camera, layers, sensor, timeline, style, target) — no private credentials in URL
- **FR-16**: Reset globe, keyboard shortcuts (1-7 sensors, H HUD, D detection, C cockpit, Esc, Ctrl+K search, Space p/p, G global context, L layers, T timeline, A annotate)
- **FR-17**: Voice control: 28+ commands (go-to, track, layers, sensor, replay, reset, annotate, cockpit, global context)
- **FR-18**: Voice whiteboard: outline country, draw route, mark location, circle region, measure distance → real map objects (points/lines/routes/polygons/measurements/labels) persist until cleared
- **FR-19**: Contextual scene-aware AI HUD + entity Q&A + visual grounding at street level; "What am I looking at?", "What changed?", sources cited

### Unified World Model
- **FR-20**: World Model = Entities / Events / Locations / Infrastructure / Signals / Sources / Relationships / History; every globe object references this model
- **FR-21**: Entity relationships graph (country-region-event-aircraft-ship-satellite-airport-port-infrastructure-news-hazard) powering related events / nearby / country context / event chains

### Expanded Data Domains
- **FR-22**: Air domain extensions: OpenSky, ADS-B public feeds, ADSB.lol, airport state, airspace, route history, flight trails, density, disruptions
- **FR-23**: Maritime domain extensions: AIS Stream, port data, vessel trails/destinations/ETA, chokepoints, shipping density
- **FR-24**: Space domain extensions: CelesTrak SGP4/satellite.js, orbital pos/alt/vel/inclination/orbit-path/ground-track/next-pass/visibility, launches, re-entry, space weather; worker-based calculation for thousands of objects
- **FR-25**: Earth/Environment: USGS, NASA FIRMS, NASA EONET + volcanoes, storms, floods, tsunami, extreme weather public feeds
- **FR-26**: Contextual weather (temp/wind/pressure/cloud/storms/precip/alerts) shown only when useful for selected aircraft/ship/country/event/region
- **FR-27**: Infrastructure expansion: submarine cables, datacenters, dams, pipelines, airports, ports, power, telecom, major roads, rail, bridges, strategic infrastructure (all legitimate public data)
- **FR-28**: Public camera network: source/status/location/estimated FOV/viewshed/frame refresh; never private cameras
- **FR-29**: Communications / outages: internet, cloud, telecom, major service disruptions, mapped geographically (where legitimate public info exists)

### Geopolitical & News Intelligence (World Monitor fusion)
- **FR-30**: Geopolitical events: conflicts, military activity (public sources), protests, civil unrest, elections, diplomacy, border incidents, sanctions, trade restrictions, political crises, humanitarian crises → displayed as WORLD EVENTS
- **FR-31**: Global news integration: GDELT, RSS, World Monitor-style feeds, official gov/intl org feeds; convert news into contextual WORLD EVENTS, not a newspaper UI
- **FR-32**: News → Event fusion: multiple articles → single event with title/summary/location/timestamp/sources/actors/entities/confidence/severity/related
- **FR-33**: Event engine pipeline: INGEST → NORMALIZE → GEOCODE → CLASSIFY → DEDUPLICATE → CORRELATE → SCORE → PUBLISH
- **FR-34**: Event types: CONFLICT, MILITARY ACTIVITY, PROTEST, POLITICAL, DIPLOMATIC, SANCTIONS, TRADE, INFRASTRUCTURE, AVIATION, MARITIME, CYBER/OUTAGE, EARTHQUAKE, WILDFIRE, VOLCANO, WEATHER, HUMANITARIAN, SPACE, TRANSPORT, ENVIRONMENT
- **FR-35**: Geopolitical hotspots auto-identified via event density / severity / change / source diversity / concentration → click hotspot to fly globe there
- **FR-36**: Country intelligence contextual panel (no new page): current events, political/security/civil/natural-hazards/infrastructure/news/relations/sanctions/transport/space/aviation/maritime; concise by default, expandable
- **FR-37**: Country history via timeline (24H/7D/30D/90D) with event density playback
- **FR-38**: Conflict monitor contextual view: event locations, activity density, timeline, actors, related news, air traffic, maritime traffic, infrastructure, natural events; cautious language, no unsupported claims
- **FR-39**: Escalation indicator per region (0-100 score with trend + confidence + supporting signals: event freq/severity/spread/military/transport/infrastructure/diplomacy) — described as ACTIVITY ANOMALY, not guaranteed war prediction

### Timelines & Replay
- **FR-40**: Timeline with LIVE/15M/1H/6H/12H/24H/7D/30D/CUSTOM presets; synchronizes aircraft/ships/satellites/events/fires/earthquakes/news/infrastructure
- **FR-41**: Event replay for any history-bearing event (First Signal → News → Additional Signals → Development → Escalation → Current State); map + panels update together
- **FR-42**: Track history trails 15MIN/1H/6H/24H for aircraft/ships/satellites where source supports

### UI/UX: Top Bar, Floating Controls, Panels, Search, World Pulse
- **FR-43**: Minimal top bar: Left=WORLD VIEWER title, Center=universal search/command palette, Right=LIVE connection indicator + tiny settings/control access; NOT a nav menu
- **FR-44**: Floating controls (compact, contextual, hideable, kbd-accessible): Live Contacts, Layers, World Context, Timeline, Sensors, HUD, Detection, God's Eye, Annotate
- **FR-45**: Layer selector (no permanent sidebar): AIR/SEA/SPACE/EVENTS/EARTH/WEATHER/INFRASTRUCTURE/CAMERAS/NEWS with toggles; opens temporarily
- **FR-46**: Universal search across country/city/aircraft/ship/satellite/airport/port/event/news/infrastructure/camera/earthquake/fire/conflict/region → result flies camera + selects object + opens context if appropriate
- **FR-47**: Command palette (Ctrl+K): Go to / Track / Show / Hide / Enable / Disable / Switch sensor / Replay / Global context / Reset / Measure / Annotate
- **FR-48**: World Pulse floating instrument: Global Activity, Conflict Activity, Civil Unrest, Aviation, Maritime, Natural Hazards, Infrastructure, Cyber/Outage, Space — each with score, trend arrow, timestamp/coverage/methodology caveat

### Providers, Health, Freshness, Provenance, Alerts
- **FR-49**: Provider adapter pattern (name, capabilities, health, connect/disconnect, fetch/subscribe, normalize); no provider objects leak across app
- **FR-50**: Provider health states ONLINE/DEGRADED/STALE/OFFLINE/AUTH REQUIRED with last-update/latency/error-count/data-age; one failed provider must not crash WORLD VIEWER
- **FR-51**: Data freshness labeling per live object: LIVE / RECENT / DELAYED / STALE / UNAVAILABLE / SIMULATED / ESTIMATED; traffic sim and estimated poses never presented as real telemetry
- **FR-52**: Data provenance per event/entity: source, source URL, provider, timestamp, ingestion time, confidence, derivation — user can inspect evidence
- **FR-53**: Air anomaly engine (route deviation, unusual airport activity, diversions, concentration, holding patterns, traffic gaps, airspace changes) → ACTIVITY ANOMALY score + confidence + signals (non-accusatory)
- **FR-54**: Maritime anomaly engine (route deviation, unexpected stops, density, chokepoint congestion, loitering, major port changes) → cautious language
- **FR-55**: Local-first with cache (recent events/tracks/metadata/map state/settings/watch areas); clearly indicate stale state; never fake live
- **FR-56**: Geo-fenced watch areas + desktop notifications (LOW/MEDIUM/HIGH/CRITICAL) for major event / conflict / escalation / quake / fire / storm / airspace / airport / shipping / internet / infrastructure

## Non-Functional Requirements
- **NFR-1**: Responsive globe displaying thousands of aircraft/ships/satellites + large event datasets without UI stalls
- **NFR-2**: Performance architecture: Web Workers, Cesium primitives, clustering, LOD, batching, spatial indexes, throttled updates, virtualized lists, incremental/ progressive loading; no massive React rerenders on live entities
- **NFR-3**: Memory bounded with ring buffers, time-windowed caches, lazy historical loading
- **NFR-4**: Smooth 60 FPS where hardware permits; fast app startup; graceful degradation
- **NFR-5**: Dark, technical, minimal, cinematic, precise, high-density, professional visual identity with subtle tactical HUD, thin overlays, small telemetry, minimal chrome, large unobstructed globe, context-on-demand
- **NFR-6**: Globe-first golden rule: when in doubt, make the globe more important, not menus/cards/sidebars/chat
- **NFR-7**: Structured application logs (ELECTRON, CESIUM, PROVIDER, DATA, EVENT, VOICE, AI, PERFORMANCE, SECURITY) with diagnostic view
- **NFR-8**: Responsible OSINT boundary: only publicly-available legitimate authorized signals; no named-person search, face recognition, private tracking, offensive cyber
- **NFR-9**: License audit: docs/LICENSE_MATRIX.md recording repository, license, component used, modification, attribution, redistribution

## Constraints
- **Technical**: Electron 33 + Vite 6 + CesiumJS 1.124 + vanilla JS/TS; Node >= 22; browser engine in renderer
- **Security**: contextIsolation, preload bridge, CSP; private keys brokered via Electron main or local service; renderer never receives provider credentials except intentionally Google Maps / Cesium ion tokens (which should be restricted provider-side)
- **Business**: Baseline functionality must not require paid keys beyond the single Google Maps key which has a free 1,000 tile-sessions/month tier
- **Dependencies**: Existing source repos in sources/gods-eye-view-main, SIGINT-main, osiris-main, worldmonitor-main; integrate selectively without whole-repo blind merges

## Assumptions
- User typically has Google Maps API key for photorealistic tiles; everything else is optional upgrades
- OpenSky anonymous mode works for live flights; AISStream key (free signup) unlocks vessels; other keys are optional
- Electron 33 on Linux with Wayland and X11 compatibility, AppImage and deb targets
- CesiumJS can render the extended entity counts when using primitives/clustering/LOD

## Acceptance Criteria

### AC-1: Electron App Launches Natively on Linux
- **Type**: `rule`
- **Given**: WORLD VIEWER built artifacts
- **When**: User launches AppImage or .deb on a Linux desktop
- **Then**: A standalone titled window "WORLD VIEWER" opens, not a browser, with the globe occupying nearly all window area, and no localhost/browser chrome visible
- **Pass Condition**: `npm run dist:linux` produces AppImage and .deb artifacts in dist/; launching the AppImage shows the WORLD VIEWER window with title and globe
- **Evidence**: Screenshot of running app + `ls dist/` output + smoke test log showing the window loaded `RENDERER_URL` successfully

### AC-2: Electron Security Model Intact
- **Type**: `rule`
- **Given**: Running Electron app
- **When**: Inspecting preload and webPreferences + CSP headers
- **Then**: contextIsolation=true, nodeIntegration=false, sandbox=true, preload bridge surfaces only worldViewerAPI methods, CSP header present with restricted sources
- **Pass Condition**: Reading `electron/main/index.cjs` and `electron/preload/index.cjs` confirms settings; session webRequest CSP log shows header injected
- **Evidence**: Code inspection + runtime CSP report (devtools network tab or log)

### AC-3: God's Eye Cockpit Acceptance Scenario (Globe → Aircraft → Cockpit → Sensors)
- **Type**: `rule`
- **Given**: Running app with Google Maps key configured and at least one live flight provider returning data
- **When**: User enables Live Contacts, clicks an aircraft, enters cockpit, switches NVG then FLIR sensors, exits cockpit
- **Then**: Aircraft appear, click locks camera, trail renders, metadata card surfaces, cockpit holds terrain under aircraft with heading/alt/speed, scene re-renders through NVG then FLIR shader, exiting returns to free camera
- **Pass Condition**: All seven sub-steps of the scenario execute without exception or crash, with sensor transitions visible
- **Evidence**: Step-by-step smoke test log + screenshots of cockpit and each sensor

### AC-4: Click-to-Track and Metadata Across Domains
- **Type**: `rule`
- **Given**: App with sample data loaded (ship, satellite, earthquake, fire, infrastructure, camera)
- **When**: User clicks each visible entity type in sequence
- **Then**: Each entity locks camera, shows trail/history where applicable, and metadata card displays source, freshness, and related entities
- **Pass Condition**: 6/6 entity types (aircraft/ship/satellite/earthquake/fire/camera) respond to click with tracking + metadata
- **Evidence**: Screenshots or console log of tracking metadata per entity type

### AC-5: World Monitor-style News → Event Fusion Pipeline
- **Type**: `rule`
- **Given**: 3+ distinct RSS/GDELT articles describing the same real-world event
- **When**: Articles pass through the event engine (INGEST → NORMALIZE → GEOCODE → CLASSIFY → DEDUPLICATE → CORRELATE → SCORE → PUBLISH)
- **Then**: A single merged WORLD EVENT is produced with title, summary, geocoded location, timestamp, aggregated sources list, confidence 0-100, severity, and list of actor/entity references
- **Pass Condition**: Event store contains 1 deduplicated event (not 3) with 3+ source entries and geocoded lat/lon within 50 km of true event location
- **Evidence**: JSON dump of fused event + source count + geocoding accuracy log

### AC-6: Geopolitical Hotspot Detection and Fly-To
- **Type**: `rule`
- **Given**: A seeded region with elevated event density/severity/velocity
- **When**: Hotspot engine runs scoring pass
- **Then**: A HOTSPOT entry surfaces with location + activity score + trend + confidence; clicking the hotspot results in Cesium camera flying to that region within 3 seconds
- **Pass Condition**: Hotspot detected for seeded region; camera.distance to region center < 500 km after flyTo completes
- **Evidence**: Hotspot JSON + camera position before/after

### AC-7: Timeline Synchronizes Multiple Domains
- **Type**: `rule`
- **Given**: App with aircraft, ship, satellite, earthquake, and news events all having history across last 24 hours
- **When**: User scrubs timeline from LIVE → 6H AGO → 24H AGO → LIVE
- **Then**: Visible entities/events update their positions/visibility consistently (entities that weren't active 24h ago disappear, past events surface)
- **Pass Condition**: Count of visible aircraft + events at 24h ago differs from LIVE count deterministically; no renderer crash during scrub
- **Evidence**: Before/after entity count logs + scrubbing session recording or screenshots

### AC-8: World Pulse Instrument Shows Valid Metrics
- **Type**: `rule`
- **Given**: App fully loaded with all available providers
- **When**: World Pulse panel opens
- **Then**: 9 metric rows (Global Activity, Conflict, Civil Unrest, Aviation, Maritime, Natural Hazards, Infrastructure, Cyber/Outage, Space) each display score, trend arrow, and a timestamp/coverage/methodology line indicating "indicator" status
- **Pass Condition**: All 9 rows render with numeric score in 0-100 range and non-empty methodology caveat
- **Evidence**: Panel screenshot + DOM snapshot text

### AC-9: Escalation Indicator Explainability
- **Type**: `rule`
- **Given**: A conflict region with seeded signals (conflict events + aviation disruption + infra events + diplomacy events)
- **When**: Escalation engine computes score
- **Then**: Score (0-100) + trend + confidence level + list of supporting signals are displayed; no text predicts "war"
- **Pass Condition**: Score is numeric, trend is one of ↑/→/↓, confidence is Low/Moderate/High, at least 2 supporting signals listed, substring "war" does NOT appear in indicator text
- **Evidence**: Indicator JSON + rendered panel text

### AC-10: Country Context Panel (No Page Navigation)
- **Type**: `rule`
- **Given**: User clicks or searches for a country
- **When**: Country selection completes
- **Then**: A contextual panel opens over the globe (NOT a new page / route change) containing at minimum: Current events, Political activity, Infrastructure, News sections; panel is dismissable without leaving globe view
- **Pass Condition**: URL hash/path unchanged; panel DOM appended to globe; panel has 4 required sections
- **Evidence**: URL before/after identical + panel screenshot

### AC-11: Voice Controls Execute Globe Verbs Correctly
- **Type**: `rule`
- **Given**: Voice module initialized (OpenAI key optional — simulate via tool router test)
- **When**: Tool router receives commands: "Take me to Delhi", "Show me all aircraft near Dubai", "Switch to night vision", "Reset globe"
- **Then**: 1) camera flies to Delhi (lon 77.2, lat 28.6, tolerance 2°), 2) aircraft layer activates + filters within 500 km of Dubai, 3) sensor mode === NVG, 4) camera returns to full-earth default
- **Pass Condition**: All 4 command outcomes match expectations within tolerance
- **Evidence**: Command router results log + camera position snapshots + layer/sensor state snapshots

### AC-12: Provider Health Isolation (One Provider Fails, App Survives)
- **Type**: `rule`
- **Given**: App with 4 data providers
- **When**: Provider 3 network requests are mocked to throw repeatedly
- **Then**: Provider 3 health transitions to DEGRADED → OFFLINE with error count visible; the other 3 providers continue updating; app remains responsive (no crash, globe still interactive)
- **Pass Condition**: Provider 3 state=OFFLINE after N failures; providers 1,2,4 state=ONLINE; window responsive to Cesium input for 10 additional seconds after failure
- **Evidence**: Provider health store dump + responsiveness ping log

### AC-13: Freshness and Simulated Data Labeling Honesty
- **Type**: `rule`
- **Given**: App displaying traffic and a public camera
- **When**: No TomTom key is configured for traffic, and camera pose is estimated (not calibrated)
- **Then**: Traffic layer displays "SIMULATED" or "LIVE AGGREGATED FLOW" label, and camera metadata displays "ESTIMATED" pose — neither labeled as real telemetry
- **Pass Condition**: DOM/text inspection finds expected labels; substring "LIVE" not used for unkeyed traffic
- **Evidence**: UI annotation screenshots + DOM text grep output

### AC-14: Visual / Cinematic Quality (Tactical Dark Aesthetic)
- **Type**: `rubric`
- **Dimension**: Globe-first cinematic visual identity
- **Scale**: 1-5
- **Anchors**: 1 = dashboard look, bright, sidebars dominate, globe a small widget; 3 = dark theme works, globe central, but some clutter / generic SaaS controls; 5 = unmistakably God's Eye / command-instrument aesthetic — deep blacks, subtle HUD telemetry, thin overlays, 90%+ pixels devoted to Earth, no permanent sidebar
- **Pass Threshold**: >= 4
- **Evidence**: 4 screenshots (full earth, zoomed city, cockpit global context, detection overlay) reviewed by checklist

### AC-15: Performance Under Load
- **Type**: `rubric`
- **Dimension**: Responsiveness with heavy data
- **Scale**: 1-5
- **Anchors**: 1 = < 20 FPS, frequent stalls, > 5s UI freezes; 3 = ~30-45 FPS, occasional frame drops on big updates, manageable; 5 = 55-60 FPS steady, no perceptible stalls even with 5k+ markers + events, camera input feels immediate
- **Pass Threshold**: >= 4
- **Evidence**: Cesium performance monitor screenshots + devtools FPS meter with aircraft=3k, ships=2k, satellites=1k, events=1k visible

### AC-16: Feature Regression Guard (All Original God's Eye Layers Present)
- **Type**: `rule`
- **Given**: Layer toggles panel open
- **When**: User enumerates available layer toggles
- **Then**: Following are all present and independently toggleable: Flights, Military Flights, Vessels, Satellites, Earthquakes, Traffic, CCTV, Radio, Bikeshare, Fires, Space Missions, Datacenters, Dams, Submarine Cables
- **Pass Condition**: 14/14 original God's Eye layers appear in layer registry
- **Evidence**: Layer registry snapshot (JSON) + toggles UI screenshot

### AC-17: Shareable Scene URL (No Credentials)
- **Type**: `rule`
- **Given**: A configured scene with specific camera, tracked aircraft, NVG sensor, layers
- **When**: Share URL is generated
- **Then**: URL query string or hash encodes camera position, target ID, sensor mode, and layer bits; URL does NOT contain any value matching `/sk-|key=|token|secret|password/i` pattern; loading URL reconstructs scene within visual tolerance
- **Pass Condition**: Regex scan negative for secrets; after URL load, camera.lookAt within 5% of original, tracked target ID matches, sensor mode matches
- **Evidence**: URL string + regex grep output + before/after scene state dump

### AC-18: Native Desktop Notifications Fire for Alert Triggers
- **Type**: `rule`
- **Given**: Watch area "Middle East" configured, HIGH threshold
- **When**: A HIGH-severity conflict event ingests inside watch area polygon
- **Then**: Electron Notification fires with title + body via preload → main ipc; desktop notification visible in OS log
- **Pass Condition**: `notification:send` IPC call observed with correct args; OS notif daemon log entry
- **Evidence**: IPC log + notification daemon dbus message capture

### AC-19: Anomaly Engine Language Is Non-Accusatory
- **Type**: `rule`
- **Given**: Air anomaly detector flags a route deviation + density spike
- **When**: Anomaly card rendered
- **Then**: Card header reads "ACTIVITY ANOMALY" (or similar neutral) with Score + Confidence; listed signals (route deviation, density increase, airspace restriction) do NOT include words like "suspicious", "hostile", "proof", "guilty"
- **Pass Condition**: Snapshot of anomaly UI contains required header and passes forbidden-words grep
- **Evidence**: Anomaly output JSON + UI text grep

### AC-20: Acceptance Test 78-Step Gauntlet Runs End-to-End
- **Type**: `rubric`
- **Dimension**: Completeness of the 78-step master acceptance scenario (from spec section 78)
- **Scale**: 1-5
- **Anchors**: 1 = < 25 steps working; 3 = 40-55 steps working, cockpit/voice/AI partially functional; 5 = 70+ steps working end-to-end with no world-break in user flow
- **Pass Threshold**: >= 4
- **Evidence**: Step-by-step checklist log of the 78-step gauntlet with pass/fail per step

## Open Questions
- [ ] Exact Cesium ion / Google key handling in production packaged app: keep env vars vs Electron safeStorage? (Current plan: safeStorage brokering for non-Google keys, Google key user-supplied at first-run.)
- [ ] Should voice module require user to paste OpenAI key into an in-app POWER UP panel on first use? (Assume yes.)
- [ ] Worker-based satellite propagation target object count: 5k, 10k, or full Starlink shell? (Assume ~2k default with DENSE chip option.)
- [ ] Depth of World Monitor integration: reuse convex/api endpoints vs reimplement ingest pipeline locally? (Assume local pipeline reimplementations drawing from same public source patterns to avoid Convex dependency.)
