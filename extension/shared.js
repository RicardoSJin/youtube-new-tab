/* Shared in the extension isolated world, service worker and settings page. */
globalThis.YTNewTab = (() => {
  'use strict';
  const defaults = Object.freeze({ videos: true, search: true, active: true });
  function settings(value) {
    return Object.fromEntries(Object.entries(defaults).map(([k, v]) =>
      [k, typeof value?.[k] === 'boolean' ? value[k] : v]));
  }
  function youtubeURL(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
      const url = new URL(raw, 'https://www.youtube.com/');
      return url.origin === 'https://www.youtube.com' && !url.username && !url.password ? url : null;
    } catch { return null; }
  }
  function videoURL(raw) {
    const url = youtubeURL(raw);
    // Standard watch links only. Shorts, live routes, playlists and redirectors
    // are intentionally left native until their DOM contracts are verified.
    return url?.pathname === '/watch' && /^[\w-]{11}$/.test(url.searchParams.get('v') || '') ? url.href : null;
  }
  function searchURL(query) {
    if (typeof query !== 'string' || !query.trim()) return null;
    const url = new URL('https://www.youtube.com/results');
    url.searchParams.set('search_query', query.trim());
    return url.href;
  }
  function validDestination(kind, raw) {
    const url = youtubeURL(raw);
    if (!url) return null;
    if (kind === 'video') return videoURL(url.href);
    if (kind === 'search' && url.pathname === '/results' && url.searchParams.get('search_query')?.trim()) {
      return searchURL(url.searchParams.get('search_query'));
    }
    return null;
  }
  return Object.freeze({ defaults, settings, youtubeURL, videoURL, searchURL, validDestination });
})();
