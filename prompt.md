Yes — **this changes the architecture significantly**.

I checked the current God's Eye View project itself, including its current-state documentation. The baseline is much richer than just “3D globe + planes”: it already has cockpit mode, a 250 km contacts roster, click-to-track with trails, voice whiteboard annotations, per-class 3D aircraft models, multiple GLSL sensor looks, detection overlays, a tactical HUD, global-context mode, cinematic scene director, shareable state URLs, reset-globe, voice control with contextual scene understanding, entity Q&A, visual grounding, and live/replay-oriented data handling. Its current documented sources/features include aircraft, military traffic, satellites, earthquakes, traffic, CCTV, launches, radio, bikeshare, datacenters, dams, submarine cables, and FIRMS fires. ([GitHub][1])

So I would **not build WORLD VIEWER as a new dashboard inspired by God's Eye**.

I would build:

> **God's Eye View → WORLD VIEWER**
>
> Preserve the God's Eye experience almost exactly, convert it into Electron, then turn it into a much deeper global intelligence platform around the same world/globe interaction model.

Here is the prompt I would use.

---

# WORLD VIEWER

## MASTER REBUILD PROMPT

### God's Eye View → Electron Desktop Evolution

```text
============================================================
WORLD VIEWER
MASTER BUILD PROMPT
============================================================

MISSION:

Transform the existing God's Eye View experience into a
professional Linux desktop application called:

WORLD VIEWER

WORLD VIEWER is NOT a separate dashboard inspired by God's Eye.

It is a direct evolution of God's Eye View.

The God's Eye experience is the FOUNDATION.

Preserve the core interaction philosophy, visual identity,
globe behavior, camera behavior, tracking behavior, sensor
modes, cockpit experience, contextual panels, voice control,
timeline, and spatial exploration.

Then expand the system dramatically with additional
open-data world intelligence capabilities.

The user should feel:

"I am looking at Earth through a technological command
instrument."

Not:

"I am using a SaaS dashboard."

============================================================
0. NON-NEGOTIABLE PRODUCT PRINCIPLE
============================================================

WORLD VIEWER = GOD'S EYE FIRST.

Everything revolves around:

EARTH
+
SPATIAL CONTEXT
+
LIVE PUBLIC SIGNALS
+
EXPLORATION
+
TRACKING
+
TEMPORAL REPLAY
+
INTELLIGENCE

Do NOT convert the product into:

- a normal admin dashboard
- a news website
- a traditional OSINT dashboard
- a giant sidebar application
- an AI chat application

The globe remains the primary interface.

============================================================
1. PRESERVE GOD'S EYE CAPABILITIES
============================================================

Before modifying anything:

audit the current God's Eye repository in full.

Preserve and carry forward all mature functionality, including
where implemented in the supplied repository:

- photorealistic 3D Earth
- CesiumJS globe
- terrain
- satellite/imagery basemaps
- live aircraft
- military/public aircraft layers
- live vessels/AIS
- satellites
- earthquakes
- active fires
- traffic
- CCTV/public cameras
- launch/space mission information
- radio
- bikeshare
- datacenters
- dams
- submarine cables
- other existing infrastructure layers

Preserve the interaction systems:

- cockpit mode
- live contact roster
- nearby contacts
- click-to-track
- tracking camera
- fading trails
- full metadata cards
- target handoff
- aircraft-to-cockpit transition
- 3D aircraft models
- detection overlays
- tactical HUD
- screen-space IDs
- global context
- cinematic scene director
- scene tours
- shareable scene state
- reset globe
- keyboard shortcuts
- visual sensor styles
- voice control
- voice whiteboard
- contextual voice commands
- entity Q&A
- visual grounding
- contextual AI HUD
- timeline/playback
- provider health
- caching
- stale-data handling
- server-side credential brokering

These are not optional inspiration.

They define the baseline quality bar.

============================================================
2. RESEARCH BASIS
============================================================

Use the current God's Eye repository and documentation as
the authoritative starting point.

Inspect:

- README
- CURRENT-STATE
- CHANGELOG
- DATA_SOURCES
- SECURITY
- TESTING
- PERFORMANCE
- every src/data module
- UI/HUD code
- camera system
- voice system
- annotation system
- map stack
- provider proxies

The existing project already supports:

- live aircraft
- cockpit mode
- 250 km nearby contacts
- tracked targets
- trails
- 3D aircraft classes
- visual sensor transformations
- tactical HUD
- detection overlays
- global-context staging
- cinematic scene direction
- shareable scene URLs
- voice commands
- scene-aware AI
- voice annotations
- public cameras
- satellite tracking
- earthquakes
- traffic
- radio
- infrastructure
- fires
- launches

Preserve these capabilities rather than rebuilding inferior
versions of them.

============================================================
3. ELECTRONIZATION
============================================================

WORLD VIEWER must become a real Electron desktop app.

Preferred architecture:

Electron
+
React/TypeScript where beneficial
+
Vite
+
CesiumJS
+
secure preload/IPC
+
local services

The final Linux application should launch as:

WORLD VIEWER

not as:

Browser
localhost
development server

Production must feel like a native application.

Support:

- Linux
- Wayland
- X11 where practical
- AppImage
- .deb
- optionally Arch package

============================================================
4. ELECTRON SECURITY
============================================================

Use:

- contextIsolation
- preload bridge
- sandbox where practical
- strict IPC
- CSP
- no unrestricted Node access in renderer
- no nodeIntegration in renderer unless absolutely required
- secure credential handling

Private API keys must not be exposed unnecessarily to the
renderer.

Provider credentials should be brokered through Electron or
a hardened local service where appropriate.

============================================================
5. DO NOT DESTROY GOD'S EYE UX
============================================================

The application should retain the characteristic God's Eye
feel:

- globe-first
- cinematic
- minimal chrome
- tactical telemetry
- direct manipulation
- camera-driven discovery
- context panels
- high density without visual clutter

DO NOT add a giant permanent sidebar.

DO NOT create a dashboard of cards around the globe.

DO NOT move every feature into a separate page.

============================================================
6. PRIMARY WINDOW
============================================================

The application starts directly into the globe.

Concept:

------------------------------------------------------------
WORLD VIEWER          ● LIVE     [ SEARCH ]        [ STATUS ]
------------------------------------------------------------


                         EARTH


             ✈             ●              🛰
                         🔴
                  🚢

                                      ●

      [minimal contextual controls]


------------------------------------------------------------
                         TIMELINE
------------------------------------------------------------

The globe should occupy almost the entire window.

============================================================
7. TOP BAR
============================================================

Keep it extremely minimal.

Left:

WORLD VIEWER

Center:

universal search / command palette

Right:

LIVE
connection indicator
small settings/control access

Do not turn the top bar into a navigation menu.

============================================================
8. FLOATING CONTROL SYSTEM
============================================================

Controls should appear as compact floating controls over the
world.

Examples:

LIVE CONTACTS
LAYERS
WORLD CONTEXT
TIMELINE
SENSORS
HUD
DETECTION
GOD'S EYE
ANNOTATE

Controls should be:

- compact
- contextual
- hideable
- keyboard accessible

============================================================
9. KEEP GOD'S EYE SENSOR MODES
============================================================

Preserve and improve the existing visual modes.

Examples:

NORMAL
CRT
NVG
FLIR
NOIR
SNOW
TACTICAL
SURVEILLANCE

Add proper transitions.

The visual mode affects the entire scene.

============================================================
10. GOD'S EYE COCKPIT
============================================================

Preserve cockpit mode.

Any trackable aircraft can become an interactive cockpit.

Requirements:

- live position
- terrain following
- heading
- altitude
- speed
- orientation
- aircraft model
- trail
- nearby contacts
- regional headlines
- local weather where available
- sensor modes

Allow:

NEXT CONTACT

PREVIOUS CONTACT

NEAREST AIRCRAFT

HELICOPTERS ONLY

MILITARY/PUBLIC CONTACTS WHERE PUBLICLY IDENTIFIABLE

Do not misclassify aircraft.

============================================================
11. CONTACTS
============================================================

Preserve the concept of a local contact roster.

For a selected location/target:

show nearby:

- aircraft
- ships
- satellites
- events
- infrastructure
- cameras
- hazards

Default radius:

250 km where practical.

Allow:

25 km
50 km
100 km
250 km
500 km
1000 km

Use progressive loading.

============================================================
12. CLICK-TO-TRACK EVERYTHING
============================================================

Any visible entity should be trackable.

Examples:

aircraft
ship
satellite
fire
earthquake
camera
weather event
launch
infrastructure
geopolitical event

Tracking should:

- lock camera
- draw trail/history where available
- show metadata
- show source
- show freshness
- show related entities

============================================================
13. EXTEND THE GLOBE INTO A WORLD MODEL
============================================================

Current God's Eye layers must become part of a unified model.

Create:

WORLD MODEL

containing:

Entities
Events
Locations
Infrastructure
Signals
Sources
Relationships
History

Everything on the globe should reference this common model.

============================================================
14. DATA DOMAINS
============================================================

Expand the God's Eye world model with these domains:

AIR
SEA
SPACE
EARTH
WEATHER
INFRASTRUCTURE
GEOPOLITICS
NEWS
COMMUNICATIONS
TRANSPORT
HUMANITARIAN
ENVIRONMENT
PUBLIC SYSTEMS

============================================================
15. AIR DOMAIN
============================================================

Preserve all existing aviation functionality.

Extend with:

- OpenSky where available
- ADS-B sources
- ADSB.lol or equivalent public feeds
- airport state
- airspace data
- route history
- flight trails
- density
- airport activity
- disruptions

Possible public metadata:

callsign
registration
aircraft type
origin
destination
altitude
velocity
heading
timestamp

Never invent missing data.

============================================================
16. AIR ANOMALY SYSTEM
============================================================

Add a non-accusatory anomaly engine.

Detect:

- route deviations
- unusual airport activity
- large-scale diversions
- concentration spikes
- holding patterns
- unusual traffic gaps
- airspace changes

Use:

ACTIVITY ANOMALY

not unsupported conclusions.

Example:

ACTIVITY ANOMALY
Score 72
Confidence Moderate

Signals:
- route deviation
- regional density increase
- airspace restriction

============================================================
17. MARITIME DOMAIN
============================================================

Preserve AIS functionality.

Expand with:

- AIS Stream
- compatible public feeds
- licensed adapters
- port data
- vessel trails
- destinations
- ETA
- chokepoints
- shipping density

Track:

vessel name
MMSI
IMO
callsign
type
speed
heading
destination
ETA
position
timestamp

============================================================
18. MARITIME ANOMALIES
============================================================

Detect:

- route deviations
- unexpected stops
- density changes
- chokepoint congestion
- unusual loitering
- major port changes

Use cautious language.

============================================================
19. SPACE DOMAIN
============================================================

Preserve satellite tracking.

Extend using:

CelesTrak
SGP4
satellite.js-compatible calculations

Support:

- orbital position
- altitude
- velocity
- inclination
- orbit path
- ground track
- next pass
- visibility
- satellite category
- launches
- re-entry
- space weather

Support thousands of objects using worker-based
calculations.

============================================================
20. EARTH / ENVIRONMENT DOMAIN
============================================================

Preserve:

USGS earthquakes
NASA FIRMS fires
NASA EONET

Expand:

volcanoes
storms
floods
tsunami information
extreme weather
other legitimate public environmental feeds

============================================================
21. WEATHER
============================================================

Provide contextual weather.

Not a weather app.

Weather should appear when useful:

- selected aircraft
- selected ship
- selected country
- selected event
- selected region

Support:

temperature
wind
pressure
clouds
storms
precipitation
alerts

Where volumetric visualization is available and technically
reasonable, support it.

============================================================
22. TRAFFIC
============================================================

Preserve traffic visualization.

Clearly distinguish:

REAL LIVE DATA

LIVE AGGREGATED FLOW

SIMULATED VEHICLE POSITIONS

Do not present simulated vehicle positions as real telemetry.

============================================================
23. PUBLIC CAMERA NETWORK
============================================================

Preserve public CCTV functionality.

Cameras can be:

- geographic entities
- map layers
- scene assets
- contextual evidence

Support:

- source
- status
- location
- estimated field of view where supported
- coverage/viewshed
- image/frame refresh

Never access private cameras.

============================================================
24. INFRASTRUCTURE
============================================================

Expand the current infrastructure system.

Potential layers:

- submarine cables
- datacenters
- dams
- pipelines
- airports
- ports
- power infrastructure
- telecom infrastructure
- major roads
- rail
- bridges
- strategic public infrastructure

Everything must be sourced from legitimate public data.

============================================================
25. COMMUNICATIONS / OUTAGES
============================================================

Add public network awareness.

Where legitimate public information is available:

- internet outages
- cloud outages
- telecom outages
- major service disruption
- communications infrastructure incidents

Map them geographically.

============================================================
26. GEOPOLITICAL DOMAIN
============================================================

Now add geopolitical intelligence to the God's Eye model.

Track:

- conflicts
- military activity reported by public sources
- protests
- civil unrest
- elections
- diplomatic events
- border incidents
- sanctions
- trade restrictions
- political crises
- humanitarian crises

These should appear as WORLD EVENTS.

============================================================
27. GLOBAL NEWS
============================================================

Integrate:

- GDELT
- RSS
- World Monitor-style feeds
- official government feeds
- international organization feeds
- licensed APIs when configured

Do not make a newspaper UI.

Convert news into contextual WORLD EVENTS.

============================================================
28. NEWS → WORLD EVENT FUSION
============================================================

Multiple articles reporting the same thing must become one
event.

Example:

Reuters
BBC
AP
GDELT
RSS

becomes:

EVENT #12345

Store:

title
summary
location
timestamp
sources
actors
entities
confidence
severity
related events

============================================================
29. GLOBAL EVENT ENGINE
============================================================

Create a unified event bus.

Every incoming event passes through:

INGEST
↓
NORMALIZE
↓
GEOCODE
↓
CLASSIFY
↓
DEDUPLICATE
↓
CORRELATE
↓
SCORE
↓
PUBLISH

============================================================
30. EVENT TYPES
============================================================

Support at minimum:

CONFLICT
MILITARY ACTIVITY
PROTEST
POLITICAL
DIPLOMATIC
SANCTIONS
TRADE
INFRASTRUCTURE
AVIATION
MARITIME
CYBER/OUTAGE
EARTHQUAKE
WILDFIRE
VOLCANO
WEATHER
HUMANITARIAN
SPACE
TRANSPORT
ENVIRONMENT

============================================================
31. GEOPOLITICAL HOTSPOTS
============================================================

Automatically identify unusually active regions.

Score using:

event density
severity
change over time
source diversity
geographic concentration

Display:

HOTSPOT
Location
Activity score
Trend
Confidence

Clicking a hotspot flies the globe there.

============================================================
32. COUNTRY INTELLIGENCE
============================================================

Clicking a country should not open a new page.

A contextual panel appears.

Show:

COUNTRY

Current events
Political activity
Security activity
Civil activity
Natural hazards
Infrastructure
News
International relations
Sanctions
Transport
Space/aviation/maritime context

Keep it concise initially.

Allow expansion.

============================================================
33. COUNTRY HISTORY
============================================================

Use the timeline to inspect country activity historically.

Examples:

24H
7D
30D
90D

Allow event density playback.

============================================================
34. CONFLICT MONITOR
============================================================

Provide a contextual conflict view.

Show:

event locations
activity density
timeline
reported actors
related news
air traffic
maritime traffic
infrastructure
natural events

Never present unsupported battlefield claims as fact.

============================================================
35. ESCALATION INDICATOR
============================================================

Create an explainable regional activity/escalation score.

Inputs may include:

event frequency
severity
geographic spread
public military signals
transport disruption
infrastructure events
diplomatic events

Display:

ESCALATION
72 / 100

TREND ↑

CONFIDENCE Moderate

Supporting signals

Never describe this as a guaranteed prediction of war.

============================================================
36. GLOBAL CONTEXT MODE
============================================================

Preserve God's Eye global context behavior.

When enabled:

- pull back to global Earth
- stage major active world signals
- temporarily create a full situational picture
- remember previous camera state
- restore the exact prior view when exiting

Enhance this with:

major world events
aviation density
maritime density
space activity
natural hazards
geopolitical hotspots

============================================================
37. WORLD PULSE
============================================================

Create a compact floating status instrument.

WORLD PULSE

Global Activity      72 ↑
Conflict Activity    68 ↑
Civil Unrest         44 →
Aviation             29 →
Maritime             53 ↑
Natural Hazards      41 →
Infrastructure       38 ↑
Cyber/Outage         61 ↑
Space                34 →

Every metric must include:

timestamp
coverage
methodology

These are indicators, not objective truths.

============================================================
38. TIMELINE
============================================================

Preserve God's Eye playback architecture.

Add:

LIVE
15M
1H
6H
12H
24H
7D
30D
CUSTOM

Timeline should synchronize:

aircraft
ships
satellites
events
fires
earthquakes
news
infrastructure changes

where historical data exists.

============================================================
39. EVENT REPLAY
============================================================

Any event with history can be replayed.

Example:

FIRST SIGNAL
↓
NEWS
↓
ADDITIONAL SIGNALS
↓
DEVELOPMENT
↓
ESCALATION
↓
CURRENT STATE

Map and contextual panels update together.

============================================================
40. TRACK HISTORY
============================================================

For supported entities:

aircraft
ships
satellites

provide historical trails.

Allow:

15 MIN
1 HOUR
6 HOURS
24 HOURS

where source data supports it.

============================================================
41. DETECTION OVERLAY
============================================================

Preserve detection overlays.

Extend them to:

aircraft
ships
satellites
events
infrastructure
cameras
hazards

Every label should remain lightweight.

Avoid turning the globe into a wall of text.

============================================================
42. 3D OBJECTS
============================================================

Preserve 3D aircraft class models.

Extend where practical to:

aircraft
ships
satellites
selected infrastructure

Use level-of-detail.

Distant objects:

simple markers.

Closer:

3D representations.

Very close:

detailed model.

============================================================
43. VOICE
============================================================

Preserve God's Eye voice interaction.

Voice should control the globe.

Examples:

"Take me to Delhi."

"Show me all aircraft near Dubai."

"Track that plane."

"Enter cockpit."

"Show ships near the Red Sea."

"Show earthquakes in Japan."

"Switch to night vision."

"Turn on infrastructure."

"Show global context."

"Play the last six hours."

"Reset globe."

============================================================
44. VOICE WHITEBOARD
============================================================

Preserve and improve voice annotations.

Allow:

"Outline India."

"Draw the route from Delhi to Mumbai."

"Mark this location."

"Draw a circle around this region."

"Measure the distance between these locations."

Annotations become real map objects.

Support:

points
lines
routes
polygons
measurements
labels

Persist until cleared.

============================================================
45. CONTEXTUAL AI
============================================================

AI must NOT be a permanent chatbot.

Instead, AI understands the current scene.

It receives:

- camera location
- camera scale
- visible layers
- selected entity
- selected event
- current timeline
- relevant live data

This enables:

"What am I looking at?"

"What is happening here?"

"What changed?"

"What are these aircraft?"

"What ships are nearby?"

"What happened in this region today?"

"What are the major events here?"

"What sources support this?"

============================================================
46. AUTOMATIC INTELLIGENCE
============================================================

AI should generate contextual overlays automatically.

Examples:

CURRENT VIEW

"Heavy aviation activity over Western Europe."

"Three significant earthquake events detected in the
last hour."

"Maritime density has increased near this chokepoint."

Only generate statements supported by current data.

============================================================
47. VISUAL GROUNDING
============================================================

Preserve visual grounding where supported.

When at street level:

AI may inspect the visible viewport for legitimate,
readable public signage/building information.

It must avoid hallucinating.

If uncertain:

"Unable to determine."

============================================================
48. CINEMATIC DIRECTOR
============================================================

Preserve scene director.

Add automated scene presets:

ORBITAL WATCH
GLOBAL PULSE
LIVE AIR TRAFFIC
MARITIME WORLD
NATURAL EARTH
CONFLICT MONITOR
SPACE WATCH
NIGHT EARTH
WORLD AT NIGHT

Each is a camera/layer choreography.

============================================================
49. SHAREABLE SCENES
============================================================

Preserve shareable state links.

Serialize:

camera
target
layers
sensor mode
timeline state
visual style

Do NOT expose private credentials.

A shared scene should reconstruct public world state only.

============================================================
50. UNIVERSAL SEARCH
============================================================

Search all world entities.

Examples:

country
city
aircraft
ship
satellite
airport
port
event
news
infrastructure
camera
earthquake
fire
conflict
region

Selecting a search result should:

fly camera
select object
open context if appropriate

============================================================
51. COMMAND PALETTE
============================================================

Ctrl+K

Commands:

Go to...
Track...
Show...
Hide...
Enable...
Disable...
Switch sensor...
Replay...
Global context...
Reset...
Measure...
Annotate...

Example:

> show aircraft above India

> track ISS

> show earthquakes in Japan

> turn on submarine cables

> switch to FLIR

============================================================
52. NAVIGATION
============================================================

Keyboard-first.

Preserve existing shortcuts where practical.

Suggested:

1–7 sensors
H HUD
D detection
C cockpit
Esc exit
Ctrl+K search
Space play/pause

Add:

G global context
L layers
T timeline
A annotations

============================================================
53. LAYER DISCOVERY
============================================================

No permanent sidebar.

Instead create a compact layer selector.

Example:

┌───────────────────────────┐
│ WORLD                     │
│                           │
│ ● AIR                     │
│ ● SEA                     │
│ ● SPACE                   │
│ ● EVENTS                  │
│ ● EARTH                   │
│ ● WEATHER                 │
│ ● INFRASTRUCTURE          │
│ ● CAMERAS                 │
│ ● NEWS                    │
└───────────────────────────┘

This opens temporarily.

It disappears after interaction.

============================================================
54. DATA SOURCES
============================================================

Prefer open/public sources first.

Candidate categories:

AIR
- OpenSky
- ADS-B public feeds
- ADSB.lol
- local receiver

SEA
- AIS Stream
- public AIS feeds

SPACE
- CelesTrak
- public launch feeds

EARTH
- USGS
- NASA FIRMS
- NASA EONET
- GDACS
- NOAA
- EMSC

NEWS
- GDELT
- RSS
- official feeds
- licensed APIs

MAP
- Cesium
- OSM
- Esri
- Google Photorealistic 3D Tiles where licensed/configured

INFRASTRUCTURE
- OSM
- OpenInfraMap
- TeleGeography data where terms permit
- other legitimate open datasets

Every provider gets its own adapter.

============================================================
55. PROVIDER ARCHITECTURE
============================================================

Use:

Provider
  name
  capabilities
  health
  connect
  disconnect
  fetch
  subscribe
  normalize

Do not allow provider-specific objects to leak across the
application.

============================================================
56. PROVIDER HEALTH
============================================================

Every live source should expose:

ONLINE
DEGRADED
STALE
OFFLINE
AUTH REQUIRED

Show:

last update
latency
error count
data age

One failed provider must not crash WORLD VIEWER.

============================================================
57. DATA FRESHNESS
============================================================

Every live object must indicate freshness.

LIVE
RECENT
DELAYED
STALE
UNAVAILABLE
SIMULATED
ESTIMATED

Traffic simulation and estimated camera poses must never be
presented as direct telemetry.

============================================================
58. DATA PROVENANCE
============================================================

Every event/entity should retain:

source
source URL
provider
timestamp
ingestion time
confidence
derivation

Users should be able to inspect evidence.

============================================================
59. ENTITY RELATIONSHIPS
============================================================

Build relationships between:

country
region
event
aircraft
ship
satellite
airport
port
infrastructure
news
hazard

Example:

EVENT
↓
LOCATION
↓
COUNTRY
↓
PORT
↓
SHIPS
↓
TRADE ROUTE

This powers contextual discovery.

============================================================
60. WORLD GRAPH
============================================================

Maintain an internal relationship graph.

UI should only show it when useful.

Do not permanently render a graph.

Use graph relationships to power:

related events
nearby entities
country context
source relationships
event chains

============================================================
61. HOTSPOT ENGINE
============================================================

Detect places with rapidly increasing observable activity.

Signals:

events
aviation
maritime
earthquakes
fires
news
infrastructure
weather

Example:

HOTSPOT
Eastern Mediterranean
Activity +28%

Click:

camera flies there.

============================================================
62. GEO-FENCED WATCH AREAS
============================================================

Allow users to save areas:

India
Delhi
Middle East
Taiwan Strait
Europe
South China Sea

Trigger notifications for important new activity.

============================================================
63. ALERT SYSTEM
============================================================

Desktop notifications.

Potential triggers:

major event
new conflict event
regional escalation
major earthquake
wildfire
storm
airspace closure
airport disruption
shipping disruption
internet outage
major infrastructure incident

Use:

LOW
MEDIUM
HIGH
CRITICAL

============================================================
64. LOCAL-FIRST
============================================================

The application should continue functioning if providers
temporarily fail.

Cache:

recent events
recent tracks
recent metadata
map state
settings
watch areas

Clearly indicate stale state.

Never fake live information.

============================================================
65. PERFORMANCE
============================================================

The application should remain responsive while displaying:

thousands of aircraft
thousands of ships
thousands of satellites
large event datasets

Use:

Web Workers
Cesium primitives
clustering
LOD
batching
spatial indexes
throttled updates
virtualized lists
incremental loading

Never cause massive React rerenders for live entities.

============================================================
66. MEMORY
============================================================

Avoid retaining unbounded history in memory.

Use:

ring buffers
time-windowed caches
historical storage
lazy loading

============================================================
67. ELECTRON DESKTOP INTEGRATION
============================================================

Add:

native notifications
global shortcuts where appropriate
window state restoration
fullscreen
always-on-top optional mode
system tray optional mode
clipboard integration for share links
secure credential storage

============================================================
68. FIRST-RUN EXPERIENCE
============================================================

Opening the application should be cinematic.

Not a boring setup wizard.

Sequence:

WORLD VIEWER

Initializing World Model...

Globe
✓

Terrain
✓

Aircraft
✓/waiting

Maritime
✓/waiting

Space
✓

Earth
✓

News
✓/waiting

Then:

EARTH APPEARS.

Do not block startup unnecessarily waiting for every provider.

============================================================
69. START WITHOUT PREMIUM DATA
============================================================

The application should provide a useful baseline without
requiring expensive services.

Optional provider credentials are upgrades.

Never make the product depend on a single paid provider.

============================================================
70. SETTINGS / PROVIDER PANEL
============================================================

Create a compact:

POWER UP

panel.

Show:

Provider
Status
What it enables
Credential required?
Data limitations
Terms

Do not expose secrets in logs.

============================================================
71. LOGGING
============================================================

Create structured application logs.

Categories:

ELECTRON
CESIUM
PROVIDER
DATA
EVENT
VOICE
AI
PERFORMANCE
SECURITY

Provide a diagnostic view.

============================================================
72. RESPONSIBLE OSINT
============================================================

The application only models:

publicly available
legitimate
authorized

signals.

Do not add:

- private-camera access
- credential bypass
- unauthorized surveillance
- person-targeting systems
- facial recognition
- private-person tracking
- offensive cyber capabilities

The system models:

aircraft
vessels
satellites
events
infrastructure
cities
public systems

not private individuals.

============================================================
73. LICENSE AUDIT
============================================================

Before importing any external implementation:

inspect its license.

Create:

docs/LICENSE_MATRIX.md

Record:

repository
license
component used
modification
attribution
redistribution requirements

Do not accidentally contaminate the project with
incompatible code/licensing.

============================================================
74. REPOSITORY STRATEGY
============================================================

Do not merge whole repositories blindly.

The hierarchy is:

GOD'S EYE
       ↓
PRIMARY RUNTIME / UX / GLOBE

WORLD MONITOR
       ↓
NEWS / EVENT INTELLIGENCE REFERENCES

OSIRIS
       ↓
DATA FUSION / DOMAIN REFERENCES

SIGINT
       ↓
OPERATIONS / INFRASTRUCTURE REFERENCES

SPECIALIZED PROJECTS
       ↓
AVIATION
MARITIME
SPACE
EARTH
OTHER DATA SOURCES

God's Eye remains the visual and interaction foundation.

============================================================
75. DIRECTORY STRUCTURE
============================================================

Target architecture:

world-viewer/

  electron/
    main/
    preload/
    ipc/
    security/

  src/
    app/
    globe/
    camera/
    hud/
    sensors/
    cockpit/
    contacts/
    detection/
    annotations/
    timeline/
    scene-director/
    search/
    voice/

    world-model/
    events/
    entities/
    relationships/

    data/
      aviation/
      maritime/
      satellites/
      earthquakes/
      fires/
      weather/
      cameras/
      traffic/
      infrastructure/
      geopolitics/
      news/
      outages/

    ai/
    alerts/
    providers/

    ui/

  public/

  docs/

  tests/

============================================================
76. TESTING
============================================================

Preserve existing God's Eye tests.

Add tests for:

Electron IPC
provider adapters
data normalization
event fusion
geocoding
entity relationships
timeline
replay
tracking
search
alerts
voice command routing
AI context retrieval
provider failure
stale state
offline state

============================================================
77. VISUAL REGRESSION
============================================================

Create screenshot/regression tests for:

- globe
- cockpit
- tracking
- tactical HUD
- sensor modes
- detection
- timeline
- context drawer
- global context
- search
- first run

============================================================
78. ACCEPTANCE TEST
============================================================

This exact scenario must work:

1. Launch WORLD VIEWER.

2. Earth appears.

3. Enable Live Contacts.

4. Thousands of aircraft appear where provider data allows.

5. Select an aircraft.

6. Camera locks onto it.

7. Trail appears.

8. Metadata appears.

9. Enter Cockpit.

10. Terrain remains correctly aligned.

11. Switch NVG.

12. Switch FLIR.

13. Exit cockpit.

14. Open Contacts.

15. See nearby aircraft/ships/events.

16. Select a ship.

17. Camera tracks the vessel.

18. Open Space.

19. Select ISS.

20. Camera follows orbital track.

21. Open Earth.

22. Select an earthquake.

23. View event information.

24. Open Cameras.

25. Select a public camera where available.

26. Show its contextual location.

27. Open Infrastructure.

28. Show submarine cable/datacenter/dam context where available.

29. Activate Global Context.

30. Earth pulls back.

31. Major active signals populate the world.

32. Open timeline.

33. Move to 6 hours ago.

34. Replay activity.

35. Select a geopolitical event.

36. Read sources.

37. View related events.

38. Ask AI:

"What's happening here?"

39. AI answers from actual WORLD VIEWER data.

40. Ask:

"What changed in the last six hours?"

41. AI references the timeline.

42. Use voice:

"Take me to Delhi."

43. Globe flies to Delhi.

44. Use voice:

"Show me aircraft near Delhi."

45. Aircraft layer activates.

46. Say:

"Reset globe."

47. Return to full Earth.

At no point should the user feel they left the same world.

============================================================
79. PERFORMANCE TARGET
============================================================

Aim for:

fast application startup
smooth 60fps where hardware permits
no UI stalls during data refresh
progressive loading
bounded memory
graceful degradation

Use the existing God's Eye performance architecture as the
baseline rather than regressing it.

============================================================
80. PRODUCT IDENTITY
============================================================

Name:

WORLD VIEWER

Visual concept:

A window into Earth.

No dashboard clutter.

No giant sidebar.

No generic SaaS styling.

No giant AI panel.

No stock market terminal.

No unnecessary navigation.

The globe is the application.

============================================================
81. FINAL DESIGN LANGUAGE
============================================================

Dark.

Technical.

Minimal.

Cinematic.

Precise.

High-information density.

Professional.

Subtle tactical HUD.

Thin overlays.

Small telemetry.

Minimal chrome.

Large unobstructed globe.

Context appears only when needed.

============================================================
82. GOLDEN RULE
============================================================

WHEN IN DOUBT:

MAKE THE GLOBE MORE IMPORTANT.

Not more menus.

Not more cards.

Not more sidebars.

Not more chat.

More world.

============================================================
83. DEVELOPMENT PROCESS
============================================================

STEP 1

Clone/inspect current God's Eye baseline.

STEP 2

Run it exactly as-is.

STEP 3

Create feature inventory.

STEP 4

Create license inventory.

STEP 5

Create Electron shell.

STEP 6

Move God's Eye runtime into Electron with ZERO feature
regression.

STEP 7

Make tests pass.

STEP 8

Add unified World Model.

STEP 9

Add geopolitical/event engine.

STEP 10

Add additional data domains.

STEP 11

Add contextual intelligence.

STEP 12

Optimize.

STEP 13

Package Linux application.

============================================================
84. NO FEATURE REGRESSION
============================================================

Before claiming completion, verify that all major original
God's Eye capabilities continue to function.

The new WORLD VIEWER must be:

God's Eye View
+
Electron
+
expanded world model
+
geopolitical intelligence
+
more public-data domains
+
better discovery
+
better timeline
+
better event relationships

NOT:

God's Eye View replaced with a dashboard.

============================================================
85. FINAL SUCCESS CRITERIA
============================================================

WORLD VIEWER is successful when the user can launch it and
feel:

"I am looking at Earth itself."

They can:

ZOOM
ROTATE
TRACK
FLY
FOLLOW
REPLAY
SEARCH
MEASURE
ANNOTATE
LISTEN
ASK
INVESTIGATE
DISCOVER

and move seamlessly between:

AIR
SEA
SPACE
EARTH
WEATHER
INFRASTRUCTURE
GEOPOLITICS
NEWS
EVENTS

without leaving the globe.

============================================================
END
============================================================
```

### The crucial difference from the earlier prompt

The current God's Eye code already implements a lot of the “magic”: **cockpit mode, nearby contacts, target tracking/trails, voice whiteboard, 3D aircraft, sensor shaders, detection overlays, tactical HUD, global context, scene direction, shareable state, and scene-aware voice/AI tooling**. ([GitHub][1])

Its documented current data footprint is also broader than the original idea: **aircraft, military traffic, satellites, earthquakes, traffic, CCTV, radio, launches, bikeshare, datacenters, dams, submarine cables and NASA FIRMS fires** are already represented in the project. ([GitHub][1])

So the strategy should be:

**Do not replace God's Eye.**

```text
                 GOD'S EYE VIEW
                       │
                       │ 100% UX + globe foundation
                       ▼
              ┌─────────────────┐
              │   WORLD VIEWER   │
              └─────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   GEO-POLITICS      WORLD DATA      EVENTS
        │              │              │
   conflicts       aviation        GDELT/news
   protests        maritime        fusion
   diplomacy       satellites      timeline
   sanctions       weather         replay
   elections       disasters       relationships
        │              │              │
        └──────────────┼──────────────┘
                       ▼
                 WORLD MODEL
                       │
                       ▼
                  AI / VOICE
                       │
                       ▼
             "UNDERSTAND THE WORLD"
```

That gives you a **God's Eye-derived application**, rather than another OSINT dashboard pretending to be God's Eye.

One especially important implementation detail: the current God's Eye project explicitly distinguishes real/live data from estimated or simulated elements — for example traffic simulation, estimated camera poses and reconstructed launch trajectories — and tracks freshness/provenance. Keep that honesty model in WORLD VIEWER. ([GitHub][1])

Also, the current project says its public-data foundation runs locally and deliberately avoids named-person search, facial recognition, and individual tracking. That boundary is worth preserving in your rebuild. ([GitHub][2])

[1]: https://github.com/bilawalsidhu/gods-eye-view "GitHub - bilawalsidhu/gods-eye-view: A spy satellite simulator in your browser, except the data is real. Live open source spatial intelligence on a photorealistic 3D globe. · GitHub"
[2]: https://github.com/bilawalsidhu/gods-eye-view/blob/main/README.md?utm_source=chatgpt.com "gods-eye-view/README.md at main · bilawalsidhu/gods-eye-view · GitHub"
