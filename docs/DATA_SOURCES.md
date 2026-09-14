# WORLD VIEWER — Data Sources

**Last updated:** 2026-09-12

---

## Overview

All external data flows through adapters or proxies. No renderer code calls upstream APIs directly (except Cesium's own terrain/imagery tiles, which are loaded by the Cesium engine).

---

## News & Events

### RSS Feeds (RSSAdapter)

14 RSS feeds ingested via `src/providers/news/index.js`:

| # | Source | Feed URL |
|---|--------|----------|
| 1 | Reuters World | https://www.reutersagency.com/feed/?best-topics=world&post_type=best |
| 2 | Al Jazeera | https://www.aljazeera.com/news/rssfeed/ |
| 3 | AP News | https://apnews.com/rss/apf-topnews |
| 4 | BBC News | https://feeds.bbci.co.uk/news/world/rss.xml |
| 5 | CNN | http://rss.cnn.com/rss/edition.rss |
| 6 | The Guardian | https://www.theguardian.com/world/rss |
| 7 | NYT World | https://rss.nytimes.com/services/xml/rss/nyt/World.xml |
| 8 | DW | https://www.dw.com/en/world/rss |
| 9 | France24 | https://www.france24.com/en/rss |
| 10 | NHK | https://www3.nhk.or.jp/rss/news overseeing.xml |
| 11 | Times of India | https://timesofindia.indiatimes.com/rssfeeds/296589695.cms |
| 12 | NDTV | https://ndtv.com/rss/latest.rss |
| 13 | The Hindu | https://www.thehindu.com/news/national/?service=rss |
| 14 | Hindustan Times | https://www.hindustantimes.com/rss/india/rssfeed.xml |

Provider health tracked via `ProviderHealth` in `src/world-model/sources.js`.

### GDELT

Global Database of Events, Language, and Tone — ingested via `GdeltAdapter` in `src/providers/news/index.js`.

### ReliefWeb

Humanitarian crisis reporting — available as an event source.

### RSS + GDELT ingestion flow:
1. `startAll()` kicks off RSS + GDELT polling
2. `RSSAdapter` fetches feeds → normalizes to common format
3. `GdeltAdapter` queries GDELT → normalizes
4. Events pass through `IngestPipeline`: normalize → dedup → classify → score
5. Stored in `EventStore` + `EntityStore`

---

## Geospatial Base Maps (Cesium)

| Layer | Provider | Auth |
|-------|---------|-------|
| Terrain | Cesium World Terrain (.terrain | `CESIUM_TOKEN` env var |
| Imagery | Bing Maps Aerial | `BING_MAPS_KEY` env var |
| Buildings | Cesium OSM Buildings | None (open) |
| Satellite View | Cesium Satellite View | None |
| Streets/Labels | Cesium Streets | None |
| Ion | Cesium Ion | `CESIUM_TOKEN` |

Cesium Earth initialization in `src/main.js`:
```javascript
Cesium.GeoJsonDataSource.clock = AWAClock
try { Cesium.Ion.defaultAccessToken = CesiumAccessToken } catch {}
viewer.scene.globe = new Cesium.Globe(Cesium.IonWorldTerrain)
viewer.cesiumWidget.imageryLayers.addImageryProvider(
  new Cesium.BingMapsImageryProvider({ url: BingMapsApi, key: BingMapsKey })
)
```

---

## Geocoding

### OSM Nominatim (online)
- Used in `src/events/geocode.js` `geocodeText()` function
- Free, no key required
- Rate-limited — used sparingly

### Offline tables
- `CITIES_TABLE` — 1000 cities with coords
- `COUNTRIES_TABLE` — country names → coords
- Stored in `src/events/geocode.js` — no network needed

---

## Entity Data (14 layers)

### Air
- **Flights:** OpenSky Network API (`src/data/flights.js`)
- **Military Flights:** OpenSky + filtering (`src/data/militaryFlights.js`)

### Sea
- **AIS Live Vessels:** AIS API (`src/data/aisLiveVessels.js`)
- **AIS Stream Adapter:** `src/data/aisStreamAdapter.js`
- **AIS Watchdog:** `src/data/aisWatchdog.js`

### Space
- **Satellites (TLE):** CelesTrak (`src/data/satellites.js`)
- **ISS:** CelesTrak / Open Notify (`src/data/issPass.js`)
- **Rocket Launches:** Launch library API (`src/data/rocketLaunches.js`)

### Earth
- **Earthquakes:** USGS API (`src/data/earthquakes.js`)

### Transport
- **Traffic:** Overpass API (OSM) (`src/data/traffic.js`)
- **Bikeshare:** City open data APIs (`src/data/bikeshare.js`)

### Cameras
- **CCTV Cameras:** OpenData endpoints (`src/data/cctv.js`, `cctvCards.js`, `cctvGizmo.js`, `cctvLod.js`, `cctvProxy.test.mjs`)

### Communication
- **Radio Spectrum:** OpenData endpoints (`src/data/radio.js`, `radioCountry.js`)

### Infrastructure
- **Military Installations:** OpenData (`src/data/militaryInstallations.js`, `militaryInstallationData.js`)
- **Military Awareness:** OpenData (`src/data/militaryAwareness.js`, `militaryAwarenessEngine.js`)
- **Datacenters:** OpenData (`src/data/local_data/datacenters/datacenters.geojsonl`)
- **Dams:** OpenData (`src/data/local_data/dams/dams.geojsonl`)
- **Submarine Cables:** Telegeography (`src/data/telegeographySubmarineCables.js`, `src/data/local_data/telegeography_submarine_cables/`)
- **Regions/Buildings:** OSM + Cesium 3D Tiles (`src/data/naturalEarthRegions.js`, `neighborhoodPolygons.js`)

---

## AI (Groq)

- **Provider:** Groq Cloud
- **Endpoint:** `https://api.groq.com/openai/v1/chat/completions`
- **Key:** `GROQ_API_KEY` environment variable
- **Used in:** `worldViewer.js` for contextual intelligence, event summarization, geopolitical context
- **No Node.js APIs leak to renderer** — calls go through preload bridge or direct fetch

---

## Provider Health Tracking

`ProviderHealth` (`src/world-model/sources.js`) tracks:
- `status` — online/offline/degraded
- `lastUpdate` — timestamp of last successful update
- `errorCount` — consecutive failures
- `latency` — response time

Used by layer registry to show health indicators in UI.
