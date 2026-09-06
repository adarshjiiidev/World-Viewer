import * as Cesium from 'cesium';
import { StyleManager } from './ui.js';
import { flyToAustin } from './camera.js';
import { DataLayerManager } from './data/manager.js';
import flightsLayer from './data/flights.js';
import militaryFlightsLayer from './data/militaryFlights.js';
import earthquakesLayer from './data/earthquakes.js';
import satellitesLayer from './data/satellites.js';
import rocketLaunchesLayer from './data/rocketLaunches.js';
import trafficLayer from './data/traffic.js';
import cctvLayer from './data/cctv.js';
import radioLayer from './data/radio.js';
import bikeshareLayer from './data/bikeshare.js';
import aisLiveVesselsLayer from './data/aisLiveVessels.js';
import militaryInstallationsLayer from './data/militaryInstallations.js';
import militaryAwarenessLayer from './data/militaryAwareness.js';
import localDataLayers from './data/localLayers.js';
import { LAYER_STATE_REGISTRY } from './data/layerState.js';
import { LayerRegistry } from './world-model/index.js';
import { registerDataCredits } from './data/dataCredits.js';
import { SceneDirector } from './scenes/director.js';
import { initGevVoiceCommands } from './voice/gevRealtime.js';
import { MapStackController } from './mapStackController.js';
import { initAnnotations } from './annotations/index.js';
import { initLogoGaze } from './logoGaze.js';
import { initCockpitCloudEffects } from './cockpitCloudEffects.js';
import {
  installRenderGovernor,
  getRenderGovernorDiagnostics,
  governorRequestRender,
  holdContinuousRender,
  releaseContinuousRender,
} from './renderGovernor.js';
import { installScopeMask } from './scopeMask.js';
import { initFirstRunExperience } from './firstRunExperience.js';
import { initFirstRunLoading } from './firstRun.js';

import EntityStore from './world-model/entities.js';
import EventStore from './world-model/events.js';
import RelationshipGraph from './world-model/relationships.js';
import ProviderHealth from './world-model/sources.js';
import EventBus from './events/bus.js';
import IngestPipeline from './events/ingest.js';
import { RssAdapter, GdeltAdapter, startAll as startAllNewsProviders } from './providers/news/index.js';

import initCommandPalette from './commandPaletteController.js';
import initWorldPulse from './worldPulseController.js';
import initEventsPanel from './eventsPanelController.js';
import initLayerSelector, { appendLayerSelectorStyles } from './layerSelectorController.js';
import initHotspotEngine from './hotspotEngineController.js';
import initTimeline from './timelineController.js';
import initLocalInvestigation from './localInvestigationController.js';
import initFloatingPanels from './floatingPanelController.js';
import initPlaceIntelligence from './placeIntelligenceController.js';
import initLiveSignals from './liveSignalsController.js';

initLogoGaze();
const firstRunLoading = initFirstRunLoading();

/**
 * Extract a human-readable error message from any thrown value.
 * Handles Error objects, strings, and plain objects with message/error fields.
 * @param {*} error — caught exception value
 * @returns {string} best-effort error description
 */
function describeError(error) {
  if (!error) return 'Unknown initialization error';
  if (error instanceof Error) {
    if (error.message && error.message.trim()) return error.message.trim();
    return error.name || 'Initialization error';
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (typeof error === 'object') {
    const maybeMessage = String(error.message || error.error || '').trim();
    if (maybeMessage) return maybeMessage;
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}') return serialized;
    } catch {
      // ignore serialization error
    }
  }
  return String(error);
}

/**
 * GOD'S EYE VIEW — Main Entry Point
 * Initializes CesiumJS with Google Photorealistic 3D Tiles,
 * style system, intelligence HUD, location presets, and share links.
 */
async function init() {
  const loadingScreen = document.getElementById('loading-screen');
  const loaderStatus = loadingScreen.querySelector('.loader-status');

  try {
    loaderStatus.textContent = 'Configuring viewer...';

    // Set Cesium Ion token for World Terrain
    const cesiumToken = import.meta.env.CESIUM_ION_TOKEN;
    if (cesiumToken) {
      Cesium.Ion.defaultAccessToken = cesiumToken;
    }

    // Set Google Maps API key for 3D Tiles (optional — WORLD VIEWER runs
    // on Cesium Ion imagery if no Google key is provided).
    const googleApiKey = import.meta.env.GOOGLE_MAPS_API_KEY;
    const hasGoogleKey = googleApiKey && googleApiKey.trim() && googleApiKey !== 'your_google_maps_api_key_here';
    if (hasGoogleKey) {
      Cesium.GoogleMaps.defaultApiKey = googleApiKey;
      // Expose for geocoding in locations.js
      window.__GOOGLE_MAPS_API_KEY__ = googleApiKey;
    } else {
      console.info('[WORLD VIEWER] No Google Maps key — using Cesium Ion imagery + terrain.');
    }

    // Create the Cesium viewer with minimal chrome
    const viewer = new Cesium.Viewer('cesiumContainer', {
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      vrButton: false,
      selectionIndicator: false,
      infoBox: false,
      baseLayer: false,
      // Visible attribution container — Google Maps / 3D Tiles credits are
      // required by Google's Terms of Service, so they must be shown (styled
      // subtly via #cesium-credits). The credit line stays visible in
      // clean-view AND recording modes too (ToS requires attribution while the
      // content is displayed — those are the exact modes used to record
      // demos), including the "Data attribution" link that opens the per-layer
      // license popover.
      creditContainer: (() => {
        const el = document.createElement('div');
        el.id = 'cesium-credits';
        document.body.appendChild(el);
        return el;
      })(),
      msaaSamples: 4,
      contextOptions: {
        webgl: {
          preserveDrawingBuffer: true,
        },
      },
    });

    // Cap the default render loop at 60 fps. Cesium's loop otherwise runs at
    // the display's refresh rate — 120 Hz on ProMotion panels — doubling GPU
    // and CPU burn for zero visual benefit in a map app whose animation
    // cadences (poll interpolation, trail fades, style crossfades) are all
    // designed against wall-clock time, not frame count. Measured on the
    // 2026-08-05 perf investigation as a strict halving of idle burn on
    // 120 Hz hardware; a no-op on 60 Hz displays. (perf item 2)
    viewer.targetFrameRate = 60;

    // Register per-layer data attribution into the "Data attribution" popover.
    // Required by each source's license (ODbL, CC BY-NC-SA, NASA FIRMS, etc.);
    // strings are verbatim from DATA_SOURCES.md. Static + always-present in the
    // expandable bottom-left credit lightbox (showOnScreen=false), so they never
    // clutter the on-globe attribution line.
    registerDataCredits(viewer);

    // Sky atmosphere — softened to avoid hard limb seam.
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.skyAtmosphere.atmosphereLightIntensity = 18;
    viewer.scene.skyAtmosphere.saturationShift = -0.12;
    viewer.scene.skyAtmosphere.brightnessShift = -0.08;

    let tileset = null;
    if (hasGoogleKey) {
      loaderStatus.textContent = 'Loading 3D Tiles...';
      try {
        // Google Photorealistic 3D Tiles (preferred when key is available)
        tileset = await Cesium.createGooglePhotorealistic3DTileset({
          onlyUsingWithGoogleGeocoder: true,
        });
        viewer.scene.primitives.add(tileset);
        // Google tiles provide own terrain — hide default globe to avoid depth conflicts.
        viewer.scene.globe.show = false;
      } catch (tileError) {
        console.warn('[WORLD VIEWER] Google 3D Tiles unavailable, using Cesium Ion globe:', tileError);
        loaderStatus.textContent = 'Using Cesium Ion globe...';
        viewer.scene.globe.show = true;
        // Enable Cesium World Terrain for elevation data.
        try {
          if (cesiumToken) {
            viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
          }
        } catch { /* terrain optional */ }
      }
    } else {
      // Cesium Ion path — show globe with Bing/Ion imagery + World Terrain
      loaderStatus.textContent = 'Loading Cesium Ion globe...';
      viewer.scene.globe.show = true;
      try {
        if (cesiumToken) {
          // Cesium World Terrain (asset 1) — high-res elevation worldwide
          viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
          // Use Bing Maps Aerial imagery (asset 2) via Cesium Ion for best photorealism
          const imageryProvider = await Cesium.IonImageryProvider.fromAssetId(2);
          viewer.imageryLayers.addImageryProvider(imageryProvider);
          viewer.scene.globe.baseColor = Cesium.Color.BLACK;
        }
      } catch (ionError) {
        console.warn('[WORLD VIEWER] Cesium Ion imagery unavailable, using OSM:', ionError);
      }
    }

    loaderStatus.textContent = 'Initializing systems...';

    const mapStackController = new MapStackController(viewer, {
      googleTileset: tileset,
      cesiumToken,
      initialStack: tileset ? 'photoreal' : 'osm',
      // Task 5 (height-datum fix): rebroadcast stack changes as a window
      // CustomEvent so data layers (CCTV per-regime ground resolution) can
      // react without coupling MapStackController to layer modules. Fires on
      // 'switching'/'ready'/'error'; listeners derive the surface regime from
      // live scene state, so intermediate emissions are harmless.
      onChange: (state) => {
        window.dispatchEvent(new CustomEvent('gev:map-stack-changed', { detail: state }));
      },
      onError: (message) => console.warn('[MapStack]', message),
    });
    await mapStackController.setStack(tileset ? 'photoreal' : 'osm', { silent: true });

    // Initialize the style manager (post-processing, HUD, locations, share links)
    const styleManager = new StyleManager(viewer, { mapStackController });
    // The previous multi-canvas weather compositor remains disabled. Cockpit
    // clouds use a separate, capped low-resolution GPU pass that never attaches
    // Cesium fog or post-process stages and is fully stopped in map mode.
    const weatherEffects = null;
    const cockpitCloudEffects = initCockpitCloudEffects(viewer);

    // If no share link state, do default fly-to Austin
    if (!styleManager.hasShareState) {
      loaderStatus.textContent = 'Flying to Austin, TX...';
      flyToAustin(viewer);
    } else {
      loaderStatus.textContent = 'Restoring shared view...';
    }

    // Initialize data layer manager
    const dataManager = new DataLayerManager(viewer, {
      allowQaRegistration: import.meta.env.DEV,
    });
    dataManager.register(flightsLayer);
    dataManager.register(militaryFlightsLayer);
    dataManager.register(earthquakesLayer);
    dataManager.register(satellitesLayer);
    dataManager.register(rocketLaunchesLayer);
    rocketLaunchesLayer.attachDataManager(dataManager);
    dataManager.register(trafficLayer);
    dataManager.register(cctvLayer);
    dataManager.register(radioLayer);
    dataManager.register(bikeshareLayer);
    dataManager.register(aisLiveVesselsLayer);
    dataManager.register(militaryInstallationsLayer);
    dataManager.register(militaryAwarenessLayer);
    militaryAwarenessLayer.attachDataManager(dataManager);
    for (const layer of localDataLayers) {
      dataManager.register(layer);
    }
    // Restoration starts only after the complete production registry is sealed.
    dataManager.finalizeRegistrations(LAYER_STATE_REGISTRY);
    if (import.meta.env.DEV) {
      window.__gevQaRegisterLayer = (targetManager, layerModule) => {
        if (targetManager !== dataManager) throw new Error('QA layer manager mismatch');
        return dataManager.registerForQa(layerModule);
      };
      window.__gevQaUnregisterLayer = (targetManager, layerId) => {
        if (targetManager !== dataManager) throw new Error('QA layer manager mismatch');
        return dataManager.unregisterForQa(layerId);
      };
    }
    dataManager.buildTogglePanel(document.getElementById('data-toggles'));
    styleManager.attachDataManager(dataManager);

    // Initialize deterministic scene playback for social clip capture
    const sceneDirector = new SceneDirector(viewer, styleManager, dataManager);

    // Initialize the voice "whiteboard" annotation engine (world-space renderer)
    const annotations = initAnnotations({ viewer, tileset });

    // Signal the cinematic first-run overlay that world model construction is
    // complete and it can dismiss as soon as its minimum duration has elapsed.
    window.worldViewerReady = true;

    // Keep startup chrome truthful: a share is not restored until camera,
    // visual/map/panel lanes, and every requested layer have terminated.
    void Promise.all([
      styleManager.initialRestorePromise,
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]).finally(async () => {
      // Trigger the cinematic overlay to fade out (waits for min duration,
      // then fades and removes the loading-screen element).
      await firstRunLoading.dismiss();

      if (window.__godsEyeView && !window.__godsEyeView.providers._newsStarted) {
        try {
          const started = startAllNewsProviders({
            rss: { intervalMs: 120 * 1000 },
            gdelt: { intervalMs: 180 * 1000 },
          });
          window.__godsEyeView.providers._newsStarted = true;
          window.__godsEyeView.providers._startResult = started;
          console.info('[WORLD VIEWER] News providers started:', started?.providers || []);
        } catch (newsErr) {
          console.warn('[WORLD VIEWER] News providers start skipped:', newsErr?.message || newsErr);
        }
      }

      // Reveal the mission-chooser first-run experience only after the
      // loading cover has fully yielded.
      let firstRunRevealed = false;
      const revealFirstRun = () => {
        if (firstRunRevealed) return;
        firstRunRevealed = true;
        initFirstRunExperience({ styleManager, dataManager });
      };
      const loadingEl = document.getElementById('loading-screen');
      if (loadingEl) {
        loadingEl.addEventListener('transitionend', revealFirstRun, { once: true });
      }
      setTimeout(revealFirstRun, 900);
    });

    // Expose for debugging
    // Idle render governor: flips the scene into requestRenderMode whenever
    // nothing animates per frame. Installed AFTER every module above has had
    // its chance to register pre-install holds. (perf wave 2)
    installRenderGovernor(viewer);

    // The explicit scope mask replaces the emergent six-pass artifact —
    // see src/scopeMask.js. Installed before the UI so the DISPLAY-rail
    // toggle finds it live.
    installScopeMask(viewer);

    // The follow camera recomputes the tracked target's dead-reckon position
    // every frame — tracking anything is a per-frame animation. (perf wave 2)
    viewer.trackedEntityChanged.addEventListener(() => {
      if (viewer.trackedEntity) holdContinuousRender('tracked-entity');
      else releaseContinuousRender('tracked-entity');
    });

    // Hidden-state suspension (perf wave 2): when the window/tab is hidden,
    // stop the default render loop outright — a hidden canvas repaints for
    // nobody, and browser rAF throttling still lets throttled frames burn
    // GPU. Holder/data state is untouched, so return is seamless: restore
    // the loop, refresh the one DOM surface we gated, render a frame.
    const syncVisibilitySuspension = () => {
      const hidden = document.hidden;
      viewer.useDefaultRenderLoop = !hidden;
      cockpitCloudEffects?.setSuspended?.(hidden);
      if (!hidden) {
        if (dataManager._panelRefreshPendingOnVisible) {
          dataManager._panelRefreshPendingOnVisible = false;
          dataManager._refreshTogglePanel();
        }
        governorRequestRender('visibility-restore');
      }
    };
    document.addEventListener('visibilitychange', syncVisibilitySuspension);
    // Apply the CURRENT state too — bootstrap can complete while the tab is
    // already hidden, and waiting for the next transition would leave the
    // loop burning behind a hidden tab. (perf wave 2 fix)
    syncVisibilitySuspension();

    const _resolveLocalLayer = (id) => {
      const found = localDataLayers.find((L) => L && L.id === id);
      return found || null;
    };

    const _layerStatsToHealth = (layerModule) => {
      const stats = (typeof layerModule?.getStats === 'function')
        ? (layerModule.getStats() || {})
        : {};
      const lastUpdate = Number(stats.lastUpdate) || 0;
      const rawStatus = String(stats.status || '').toLowerCase();
      const unavailable = stats.unavailable === true || stats.available === false;
      const degraded = Boolean(stats.degraded) || Boolean(stats.stale);
      const errored = Boolean(stats.error) || Boolean(stats.lastError) || Boolean(stats.managerRefreshError);
      let status;
      if (rawStatus === 'auth_required' || rawStatus === 'unauthorized' || rawStatus.startsWith('auth')) {
        status = 'auth_required';
      } else if (unavailable || errored) {
        status = 'offline';
      } else if (degraded) {
        status = 'online';
      } else if (Number(stats.count) > 0 || lastUpdate > 0) {
        status = 'online';
      } else if (rawStatus === 'loading' || rawStatus === 'zoom-in' || rawStatus === 'idle' || rawStatus === 'empty') {
        status = 'online';
      } else {
        status = 'offline';
      }
      return { status, lastUpdate };
    };

    const _registerLayerEntry = (id, name, category, {
      layerModule = null,
      authRequired = false,
      defaultOn = false,
      provider = null,
    } = {}) => {
      LayerRegistry.register(id, {
        name,
        category,
        authRequired,
        defaultOn,
        provider,
        toggle: (state) => {
          const dm = window.__godsEyeView?.dataManager || dataManager;
          if (dm && typeof dm.setEnabled === 'function') {
            void dm.setEnabled(id, Boolean(state), { origin: 'registry' });
          }
        },
        getHealth: () => {
          const dm = window.__godsEyeView?.dataManager || dataManager;
          const entry = dm?.layers?.get?.(id);
          const mod = entry?.module || layerModule;
          return _layerStatsToHealth(mod);
        },
      });
    };

    const datacentersLayer = _resolveLocalLayer('local-datacenters');
    const damsLayer = _resolveLocalLayer('local-dams');
    const submarineCablesResolved = _resolveLocalLayer('telegeography-submarine-cables');
    const firmsLayer = _resolveLocalLayer('local-firms');

    _registerLayerEntry('flights', 'Live Flights', 'air', {
      layerModule: flightsLayer,
      defaultOn: false,
      provider: 'OpenSky Network / adsb.lol',
    });
    _registerLayerEntry('military', 'Military Flights', 'air', {
      layerModule: militaryFlightsLayer,
      defaultOn: false,
      provider: 'adsb.lol',
    });
    _registerLayerEntry('ais-live-vessels', 'AIS Live Vessels', 'sea', {
      layerModule: aisLiveVesselsLayer,
      defaultOn: false,
      provider: 'AISStream',
    });
    _registerLayerEntry('satellites', 'Satellites', 'space', {
      layerModule: satellitesLayer,
      defaultOn: false,
      provider: 'CelesTrak',
    });
    _registerLayerEntry('earthquakes', 'Earthquakes', 'earth', {
      layerModule: earthquakesLayer,
      defaultOn: false,
      provider: 'USGS',
    });
    _registerLayerEntry('traffic', 'Street Traffic', 'transport', {
      layerModule: trafficLayer,
      defaultOn: false,
      provider: 'OpenStreetMap / TomTom',
    });
    _registerLayerEntry('cctv', 'CCTV Cameras', 'cameras', {
      layerModule: cctvLayer,
      defaultOn: false,
      provider: 'Public CCTV feeds',
    });
    _registerLayerEntry('radio', 'Radio Stations', 'communication', {
      layerModule: radioLayer,
      defaultOn: false,
      provider: 'Radio Browser',
    });
    _registerLayerEntry('bikeshare', 'Bikeshare Stations', 'transport', {
      layerModule: bikeshareLayer,
      defaultOn: false,
      provider: 'GBFS systems',
    });
    _registerLayerEntry('local-firms', 'FIRMS Active Fires', 'weather', {
      layerModule: firmsLayer,
      defaultOn: false,
      provider: 'NASA FIRMS',
    });
    _registerLayerEntry('rocket-launches', 'Space Missions', 'space', {
      layerModule: rocketLaunchesLayer,
      defaultOn: false,
      provider: 'Launch Library 2',
    });
    _registerLayerEntry('local-datacenters', 'Datacenters', 'infrastructure', {
      layerModule: datacentersLayer,
      defaultOn: false,
      provider: 'Local',
    });
    _registerLayerEntry('local-dams', 'Dams', 'infrastructure', {
      layerModule: damsLayer,
      defaultOn: false,
      provider: 'USACE',
    });
    _registerLayerEntry('telegeography-submarine-cables', 'Submarine Cables', 'infrastructure', {
      layerModule: submarineCablesResolved,
      defaultOn: false,
      provider: 'TeleGeography',
    });

    window.__godsEyeView = {
      viewer,
      styleManager,
      tileset,
      dataManager,
      sceneDirector,
      mapStackController,
      annotations,
      weatherEffects,
      cockpitCloudEffects,
      getRenderGovernorDiagnostics,
      requestRender: governorRequestRender,
      stores: {
        EntityStore,
        EventStore,
        RelationshipGraph,
        ProviderHealth,
      },
      pipeline: {
        EventBus,
        IngestPipeline,
      },
      providers: {
        RssAdapter,
        GdeltAdapter,
        startAllNewsProviders,
        _newsStarted: false,
      },
    };
    window.__godsEyeView.voiceCommands = initGevVoiceCommands({ viewer, styleManager, dataManager, sceneDirector, annotations });

    appendLayerSelectorStyles(document);
    const eventsPanel = initEventsPanel({
      viewer,
      EventStore,
      EventBus,
      dataManager,
      EntityStore,
      RelationshipGraph,
    });
    const worldPulse = initWorldPulse({
      EventStore,
      dataManager,
      viewer,
    });
    window.__godsEyeView.eventsPanel = eventsPanel;
    window.__godsEyeView.worldPulse = worldPulse;

    window.__godsEyeView.layerSelector = initLayerSelector({
      dataManager,
      LayerRegistry,
      viewer,
      eventsPanel,
      worldPulse,
    });
    window.__godsEyeView.investigation = initLocalInvestigation({ viewer, dataManager });
    window.__godsEyeView.commandPalette = initCommandPalette({
      viewer,
      styleManager,
      dataManager,
      sceneDirector,
      annotations,
      EventBus,
      EntityStore,
      EventStore,
      investigatePlace: window.__godsEyeView.investigation.investigate,
    });
    window.__godsEyeView.hotspotEngine = initHotspotEngine({
      viewer,
      EventStore,
      EntityStore,
      EventBus,
    });
    window.__godsEyeView.timeline = initTimeline({
      viewer,
      EventBus,
      EventStore,
      EntityStore,
      dataManager,
      LayerRegistry,
    });
    window.__godsEyeView.placeIntelligence = initPlaceIntelligence({ viewer });
    window.__godsEyeView.liveSignals = initLiveSignals({ dataManager });
    window.__godsEyeView.floatingPanels = initFloatingPanels();

  } catch (error) {
    console.error("God's Eye View initialization failed:", error);
    loaderStatus.textContent = `Error: ${describeError(error)}`;
    loaderStatus.style.color = '#ff4444';
    window.worldViewerReady = true;
    void firstRunLoading.dismiss(true);
  }
}

init();
