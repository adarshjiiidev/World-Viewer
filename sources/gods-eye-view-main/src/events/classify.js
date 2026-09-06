/**
 * Keyword-based event classifier and severity scorer.
 * Maps textual signals to the 19 canonical event types.
 */

const EVENT_TYPES = Object.freeze([
  'CONFLICT',
  'MILITARY_ACTIVITY',
  'PROTEST',
  'POLITICAL',
  'DIPLOMATIC',
  'SANCTIONS',
  'TRADE',
  'INFRASTRUCTURE',
  'AVIATION',
  'MARITIME',
  'CYBER_OUTAGE',
  'EARTHQUAKE',
  'WILDFIRE',
  'VOLCANO',
  'WEATHER',
  'HUMANITARIAN',
  'SPACE',
  'TRANSPORT',
  'ENVIRONMENT',
]);

const TYPE_KEYWORDS = Object.freeze({
  EARTHQUAKE: ['earthquake', 'quake', 'tremor', 'magnitude', 'seismic', 'epicenter', 'aftershock', 'richter'],
  WILDFIRE: ['wildfire', 'fire', 'burning', 'bushfire', 'forest fire', 'blaze', 'inferno', 'wild fire'],
  PROTEST: ['protest', 'rally', 'demonstration', 'unrest', 'riots', 'riot', 'march', 'strike', 'uprising', 'clashes with police'],
  CONFLICT: ['conflict', 'airstrike', 'battle', 'clash', 'shelling', 'war', 'invasion', 'offensive', 'missile strike', 'drone attack', 'attack', 'bombing', 'killed', 'casualties', 'explosion'],
  MILITARY_ACTIVITY: ['military', 'troops', 'navy', 'drone strike', 'exercise', 'army', 'air force', 'deployment', 'maneuver', 'tank', 'fighter jet', 'warship', 'naval exercise'],
  POLITICAL: ['election', 'vote', 'poll', 'parliament', 'president', 'prime minister', 'government', 'opposition', 'coup', 'impeach', 'legislation', 'senate', 'congress', 'referendum', 'minister'],
  SANCTIONS: ['sanction', 'embargo', 'tariff', 'trade ban', 'asset freeze', 'blacklist'],
  TRADE: ['trade', 'export', 'import', 'bilateral', 'deal', 'agreement', 'tariff', 'supply chain', 'logistics', 'shipping costs'],
  DIPLOMATIC: ['diplomacy', 'summit', 'embassy', 'ambassador', 'treaty', 'talks', 'meeting', 'bilateral talks', 'diplomatic', 'envoy', 'foreign minister'],
  CYBER_OUTAGE: ['power', 'outage', 'blackout', 'internet', 'cloud', 'downtime', 'network', 'telecom', 'cyberattack', 'hacked', 'data breach', 'ransomware', 'ddos', 'mobile network'],
  AVIATION: ['airport', 'airspace', 'closure', 'flight', 'disruption', 'airline', 'canceled', 'cancelled', 'aviation', 'plane', 'aircraft', 'runway', 'boarding'],
  MARITIME: ['port', 'shipping', 'vessel', 'maritime', 'suez', 'panama', 'strait', 'cargo ship', 'container ship', 'piracy', 'naval', 'oil tanker', 'canal'],
  INFRASTRUCTURE: ['infrastructure', 'dam', 'pipeline', 'bridge', 'rail', 'power plant', 'substation', 'grid', 'refinery', 'construction', 'tunnel', 'highway collapse'],
  VOLCANO: ['volcano', 'eruption', 'magma', 'lava', 'volcanic', 'ash cloud'],
  WEATHER: ['storm', 'cyclone', 'hurricane', 'typhoon', 'flood', 'tsunami', 'weather', 'drought', 'heatwave', 'tornado', 'thunderstorm', 'landslide', 'mudslide', 'hailstorm', 'monsoon'],
  HUMANITARIAN: ['humanitarian', 'refugee', 'displacement', 'aid', 'famine', 'crisis', 'food shortage', 'malnutrition', 'disaster relief', 'rescue', 'evacuation', 'displaced'],
  SPACE: ['rocket', 'launch', 'satellite', 'orbit', 'space', 'iss', 'reentry', 'spacecraft', 'astronaut', 'mission', 'cosmos', 'payload'],
  TRANSPORT: ['road', 'rail', 'transport', 'train', 'highway', 'accident', 'collision', 'derailment', 'traffic', 'subway', 'metro', 'bus'],
  ENVIRONMENT: ['deforestation', 'pollution', 'oil spill', 'climate', 'environment', 'ecological', 'carbon', 'emissions', 'greenhouse', 'waste', 'contamination'],
});

const SEVERITY_KEYWORDS_HIGH = Object.freeze([
  'killed', 'dead', 'deaths', 'casualties', 'massacre', 'destroyed', 'leveled',
  'catastrophic', 'critical', 'emergency', 'state of emergency', 'evacuated',
  'evacuation', 'nuclear', 'biological', 'chemical', 'attack', 'bombing',
  'missile', 'airstrike', 'coup', 'war', 'invasion',
]);

const SEVERITY_KEYWORDS_MED = Object.freeze([
  'injured', 'wounded', 'damage', 'warning', 'watch', 'alert', 'disruption',
  'delayed', 'canceled', 'cancelled', 'suspended', 'shortage', 'risk',
  'threat', 'tense', 'standoff', 'deployed', 'sanctions',
]);

const tokenize = (text) => {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
};

const countKeywordMatches = (text, keywords) => {
  const blob = String(text || '').toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    if (blob.includes(kw)) count += kw.includes(' ') ? 2 : 1;
  }
  return count;
};

const classify = (title, summary, tags, rawTypeHint) => {
  const blob = [title, summary, Array.isArray(tags) ? tags.join(' ') : tags]
    .filter(Boolean)
    .join(' ');
  const scores = new Map();
  const signals = [];
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    const score = countKeywordMatches(blob, keywords);
    if (score > 0) {
      scores.set(type, score);
      for (const kw of keywords) {
        if (String(blob).toLowerCase().includes(kw)) {
          signals.push(`${type}:${kw}`);
        }
      }
    }
  }
  let bestType = null;
  let bestScore = 0;
  for (const [type, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }
  if (!bestType) {
    if (rawTypeHint && EVENT_TYPES.includes(rawTypeHint)) {
      bestType = rawTypeHint;
    } else {
      bestType = 'ENVIRONMENT';
    }
  }
  const totalTokens = tokenize(blob).length;
  const confidence = totalTokens === 0 ? 10 : Math.max(10, Math.min(98, Math.round((bestScore / Math.max(1, totalTokens / 8)) * 50 + 30)));
  return {
    type: bestType,
    confidence,
    signals: Array.from(new Set(signals)).slice(0, 10),
  };
};

const classifySeverity = (confidence, keywords) => {
  const blob = Array.isArray(keywords) ? keywords.join(' ') : String(keywords || '');
  const lower = blob.toLowerCase();
  let score = 0;
  for (const kw of SEVERITY_KEYWORDS_HIGH) {
    if (lower.includes(kw)) score += 3;
  }
  for (const kw of SEVERITY_KEYWORDS_MED) {
    if (lower.includes(kw)) score += 1;
  }
  if (confidence >= 90) score += 1;
  if (score >= 5) return 'CRITICAL';
  if (score >= 3) return 'HIGH';
  if (score >= 1) return 'MEDIUM';
  return 'LOW';
};

export { classify, classifySeverity, EVENT_TYPES, TYPE_KEYWORDS };
export default classify;
