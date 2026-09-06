/**
 * world-viewer public API barrel file.
 * Re-exports every store, bus, pipeline, provider adapter, and
 * utility classifier/geocoder as both default-import compatible
 * named exports and ES re-exports.
 */

import LayerRegistry, { VALID_CATEGORIES } from './world-model/index.js';
import EntityStore, { EntityStoreImpl } from './world-model/entities.js';
import EventStore, { EventStoreImpl } from './world-model/events.js';
import RelationshipGraph, { RelationshipGraphImpl } from './world-model/relationships.js';
import ProviderHealth, { ProviderHealthImpl } from './world-model/sources.js';
import EventBus, { EventBusImpl } from './events/bus.js';
import IngestPipeline, { IngestPipelineImpl } from './events/ingest.js';
import { RssAdapter, GdeltAdapter, startAll } from './providers/news/index.js';
import classify, { classifySeverity } from './events/classify.js';
import geocodeText, { CITIES_TABLE, COUNTRIES_TABLE } from './events/geocode.js';
import computeEventScore, { computeHotspotScore } from './events/score.js';

export {
  LayerRegistry,
  VALID_CATEGORIES,
  EntityStore,
  EntityStoreImpl,
  EventStore,
  EventStoreImpl,
  RelationshipGraph,
  RelationshipGraphImpl,
  ProviderHealth,
  ProviderHealthImpl,
  EventBus,
  EventBusImpl,
  IngestPipeline,
  IngestPipelineImpl,
  RssAdapter,
  GdeltAdapter,
  startAll,
  classify,
  classifySeverity,
  geocodeText,
  CITIES_TABLE,
  COUNTRIES_TABLE,
  computeEventScore,
  computeHotspotScore,
};

const publicApi = Object.freeze({
  LayerRegistry,
  VALID_CATEGORIES,
  EntityStore,
  EntityStoreImpl,
  EventStore,
  EventStoreImpl,
  RelationshipGraph,
  RelationshipGraphImpl,
  ProviderHealth,
  ProviderHealthImpl,
  EventBus,
  EventBusImpl,
  IngestPipeline,
  IngestPipelineImpl,
  RssAdapter,
  GdeltAdapter,
  startAll,
  classify,
  classifySeverity,
  geocodeText,
  CITIES_TABLE,
  COUNTRIES_TABLE,
  computeEventScore,
  computeHotspotScore,
});

export default publicApi;
