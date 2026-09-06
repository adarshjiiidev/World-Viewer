/**
 * Normalize raw RSS/GDELT article records into a canonical shape
 * suitable for downstream geocoding + classification.
 * Never invents data: if the source has no location, confidence is
 * set low and coordinates stay null.
 */

const parsePublishedAt = (publishedAt) => {
  if (!publishedAt) return Date.now();
  const num = Number(publishedAt);
  if (Number.isFinite(num) && num > 946684800000) return num;
  const d = new Date(publishedAt);
  const t = d.getTime();
  return Number.isFinite(t) ? t : Date.now();
};

const cleanText = (raw) => {
  if (!raw) return '';
  return String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-zA-Z]+;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeRawArticle = (raw) => {
  const item = raw && typeof raw === 'object' ? raw : {};
  const title = cleanText(item.title);
  const summary = cleanText(item.summary || item.description || item.content);
  const content = cleanText(item.content || item.fullText || item.body || summary);
  const url = item.link || item.url ? String(item.link || item.url) : null;
  const sourceName = item.sourceName || item.source || item.author || item.publisher ? String(item.sourceName || item.source || item.author || item.publisher) : 'unknown';
  const publishedAt = parsePublishedAt(item.publishedAt || item.pubDate || item.date || item.timestamp);
  const lat = item.lat != null ? Number(item.lat) : null;
  const lon = item.lon != null ? Number(item.lon) : null;
  const locationText = cleanText(item.locationText || item.location || item.place);
  const rawTags = item.tags || item.categories || item.topics || [];
  const tags = Array.isArray(rawTags) ? rawTags.map((t) => String(t)).filter(Boolean) : [];
  const hasExplicitLoc = Number.isFinite(lat) && Number.isFinite(lon);
  const hasTextLoc = locationText.length > 0;
  const confidence = hasExplicitLoc ? 80 : hasTextLoc ? 50 : 20;
  return Object.freeze({
    title,
    summary: summary || title,
    content: content || summary || title,
    url,
    sourceName,
    publishedAt,
    lat: hasExplicitLoc ? lat : null,
    lon: hasExplicitLoc ? lon : null,
    locationText,
    tags,
    confidence,
  });
};

export default normalizeRawArticle;
export { normalizeRawArticle, cleanText, parsePublishedAt };
