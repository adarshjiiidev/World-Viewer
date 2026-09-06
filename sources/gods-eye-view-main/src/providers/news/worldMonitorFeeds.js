/**
 * Reviewed global starter pack derived from World Monitor's canonical feed
 * catalog. This keeps WORLD VIEWER broad by default without treating every
 * source in that much larger catalog as equally vetted or loading hundreds of
 * feeds on startup.
 */

export const WORLD_MONITOR_FEEDS = Object.freeze([
  Object.freeze({ id: 'bbc-world', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', region: 'Global' }),
  Object.freeze({ id: 'guardian-world', name: 'Guardian World', url: 'https://www.theguardian.com/world/rss', region: 'Global' }),
  Object.freeze({ id: 'reuters-world', name: 'Reuters World', url: 'https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en', region: 'Global' }),
  Object.freeze({ id: 'ap-world', name: 'AP News', url: 'https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en', region: 'Global' }),
  Object.freeze({ id: 'aljazeera-world', name: 'Al Jazeera English', url: 'https://www.aljazeera.com/xml/rss/all.xml', region: 'Middle East' }),
  Object.freeze({ id: 'france24-world', name: 'France 24', url: 'https://www.france24.com/en/rss', region: 'Europe' }),
  Object.freeze({ id: 'dw-world', name: 'Deutsche Welle', url: 'https://rss.dw.com/xml/rss-en-world', region: 'Europe' }),
  Object.freeze({ id: 'euronews-world', name: 'Euronews', url: 'https://www.euronews.com/rss?format=xml', region: 'Europe' }),
  Object.freeze({ id: 'middle-east', name: 'Middle East — Google News', url: 'https://news.google.com/rss/search?q=Middle+East+when:1d&hl=en-US&gl=US&ceid=US:en', region: 'Middle East' }),
  Object.freeze({ id: 'asia-pacific', name: 'Asia Pacific — Google News', url: 'https://news.google.com/rss/search?q=Asia+Pacific+when:1d&hl=en-US&gl=US&ceid=US:en', region: 'Asia Pacific' }),
  Object.freeze({ id: 'latin-america', name: 'Latin America — Google News', url: 'https://news.google.com/rss/search?q=Latin+America+when:1d&hl=en-US&gl=US&ceid=US:en', region: 'Americas' }),
  Object.freeze({ id: 'npr-world', name: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml', region: 'Americas' }),
  Object.freeze({ id: 'cbc-world', name: 'CBC World', url: 'https://www.cbc.ca/webfeed/rss/rss-world', region: 'Americas' }),
]);
