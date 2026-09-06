/**
 * Event and hotspot scoring utilities.
 * computeEventScore weights severity, confidence, source diversity,
 * and recency into a single 0-100 score.
 * computeHotspotScore aggregates regional metrics.
 */

const SEVERITY_WEIGHTS = Object.freeze({
  LOW: 1,
  MEDIUM: 1.5,
  HIGH: 2.25,
  CRITICAL: 3.5,
});

const SEVEN_DAYS_MS = 7 * 86400 * 1000;

const computeEventScore = (event) => {
  if (!event || typeof event !== 'object') return 0;
  const sev = event.severity && SEVERITY_WEIGHTS[event.severity] ? SEVERITY_WEIGHTS[event.severity] : SEVERITY_WEIGHTS.LOW;
  const confPct = Math.max(0, Math.min(1, (Number(event.confidence) || 0) / 100));
  const sourceCount = Array.isArray(event.sources) ? event.sources.length : 0;
  const sourceBoost = 1 + Math.log10(sourceCount + 1);
  const ts = Number(event.timestamp) || Date.now();
  const age = Math.max(0, Date.now() - ts);
  const recency = age >= SEVEN_DAYS_MS ? 0 : 1 - (age / SEVEN_DAYS_MS);
  const base = sev * confPct * sourceBoost * 35;
  const recencyBonus = recency * 25;
  const raw = base + recencyBonus;
  return Math.max(0, Math.min(100, Math.round(raw)));
};

const computeHotspotScore = (region) => {
  if (!region || typeof region !== 'object') return 0;
  const eventCount = Math.max(0, Number(region.eventCount) || 0);
  const avgSev = region.avgSeverity || 'LOW';
  const sevWeight = SEVERITY_WEIGHTS[avgSev] || SEVERITY_WEIGHTS.LOW;
  const typeDiversity = Math.max(0, Math.min(1, Number(region.eventTypeDiversity) || 0));
  const sourceDiversity = Math.max(0, Math.min(1, Number(region.sourceDiversity) || 0));
  const velocity = Math.max(-1, Math.min(2, Number(region.velocityPctChange) || 0));
  const countFactor = Math.min(1, eventCount / 15);
  const base =
    countFactor * 30 +
    sevWeight * 10 +
    typeDiversity * 25 +
    sourceDiversity * 15 +
    (velocity > 0 ? velocity * 20 : velocity * 10);
  return Math.max(0, Math.min(100, Math.round(base)));
};

export { computeEventScore, computeHotspotScore, SEVERITY_WEIGHTS, SEVEN_DAYS_MS };
export default computeEventScore;
