/**
 * News provider exports and orchestration helper startAll().
 * Wires the RSS and GDELT adapters together for easy bootstrap.
 */

import RssAdapter from './rssAdapter.js';
import GdeltAdapter from './gdeltAdapter.js';
export { WORLD_MONITOR_FEEDS } from './worldMonitorFeeds.js';

const startAll = (options = {}) => {
  const rssOk = RssAdapter.connect(options.rss || {});
  const gdeltOk = GdeltAdapter.connect(options.gdelt || {});
  return {
    rss: rssOk,
    gdelt: gdeltOk,
    providers: ['rss-adapter', 'gdelt-adapter', 'world-monitor-curated-rss'],
  };
};

export { RssAdapter, GdeltAdapter, startAll };
export default startAll;
