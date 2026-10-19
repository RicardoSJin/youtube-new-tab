(() => {
  'use strict';
  if (globalThis.__ytNewTabInstalled) return;
  globalThis.__ytNewTabInstalled = true;
  const api = globalThis.YTNewTab;
  let config = api.defaults;
  let ready = false;
  let changedDuringLoad;
  let composing = false;
  let enterHeld = false;
  let searchGesture;
  let nativeSearchGesture;

  // Listen before the initial read so a settings change cannot be overwritten
  // by a stale in-flight read. local (not sync) stores only these three booleans.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    config = api.settings(changes.settings.newValue);
    if (!ready) changedDuringLoad = config;
  });
  chrome.storage.local.get('settings').then(value => {
    config = changedDuringLoad || api.settings(value.settings);
    ready = true;
  }).catch(() => { /* Keep native navigation if settings cannot be read. */ });

  function pathOf(event) {
    return event.composedPath().filter(node => node instanceof Element);
  }
  function modifiers(event) {
    return event.ctrlKey || event.shiftKey || event.altKey || event.metaKey;
  }
  function consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  function notifyFailure() {
    const id = 'yt-new-tab-error';
    let notice = document.getElementById(id);
    if (!notice) {
      notice = document.createElement('div');
      notice.id = id;
      notice.setAttribute('role', 'status');
      Object.assign(notice.style, {
        position: 'fixed', bottom: '24px', left: '24px', zIndex: '2147483647',
        padding: '12px 18px', background: '#262626', color: '#fff',
        borderRadius: '10px', font: '14px system-ui', maxWidth: '360px'
      });
      (document.body || document.documentElement).append(notice);
    }
    notice.textContent = '新标签页未能打开。请在扩展管理页重新加载插件，再刷新此页面。';
    clearTimeout(notice.dismissTimer);
    notice.dismissTimer = setTimeout(() => notice.remove(), 7000);
  }
  function open(kind, url) {
    // One request, no automatic retry or location fallback: an uncertain reply
    // must never create a second tab or disturb a playing source video.
    try {
      chrome.runtime.sendMessage({ type: 'yt-new-tab:open', kind, url })
        .then(result => { if (!result?.ok) notifyFailure(); })
        .catch(notifyFailure);
    } catch { notifyFailure(); }
  }
  function searchContext(element) {
    if (!element?.closest('ytd-masthead')) return null;
    const root = element.closest('yt-searchbox');
    if (!root) return null;
    const input = root.querySelector('input[name="search_query"]');
    const form = input?.form;
    const action = form && api.youtubeURL(form.getAttribute('action'));
    return action?.pathname === '/results' ? { root, input, form } : null;
  }
  function search(event, context) {
    if (event.type === 'submit' && nativeSearchGesture?.form === context.form &&
        performance.now() - nativeSearchGesture.time < 1000) return;
    const url = api.searchURL(context.input.value);
    if (!url) return;
    consume(event);
    // Deduplicate the fallback submit belonging to an already consumed Enter
    // or button gesture. A new keydown/click starts a new deliberate operation.
    const duplicateSubmit = event.type === 'submit' && searchGesture &&
      searchGesture.form === context.form && searchGesture.url === url &&
      performance.now() - searchGesture.time < 1000;
    if (duplicateSubmit) return;
    searchGesture = { form: context.form, url, time: performance.now() };
    open('search', url);
  }
  function videoAnchor(path) {
    const index = path.findIndex(node => node.matches('a[href]'));
    if (index < 0) return null;
    const anchor = path[index];
    if (anchor.hasAttribute('download') || anchor.isContentEditable) return null;
    // Nested action overlays and interactive children keep their native events.
    if (path.slice(0, index).some(node => node.matches(
      'button, input, select, textarea, [role="button"], [role="menuitem"], [contenteditable="true"]'
    ))) return null;
    const legacy = anchor.id === 'video-title' ||
      (anchor.id === 'thumbnail' && anchor.parentElement?.matches('ytd-thumbnail'));
    const lockup = anchor.closest('yt-lockup-view-model');
    // Real playlist cards use /watch?v=...&list=... for BOTH title and cover,
    // and even contain a nested yt-thumbnail-view-model. Exclude the whole
    // collection card, rather than misclassifying it from its URL or image.
    if (lockup?.querySelector('yt-collection-thumbnail-view-model')) return null;
    const modern = lockup && (anchor.parentElement?.matches('h3') ||
      anchor.querySelector('yt-thumbnail-view-model'));
    return (legacy || modern) && api.videoURL(anchor.getAttribute('href')) ? anchor : null;
  }

  window.addEventListener('click', event => {
    if (!ready || !event.cancelable || event.defaultPrevented) return;
    const path = pathOf(event);
    if (event.button !== 0 || modifiers(event)) {
      const context = searchContext(path.find(node => node.matches('button')));
      if (context) nativeSearchGesture = { form: context.form, time: performance.now() };
      return;
    }
    if (config.search) {
      const button = path.find(node => node.matches('button'));
      const context = searchContext(button);
      // Observed submit button is outside form, with title and accessible name.
      // The masthead expand, voice, clear and suggestion buttons are excluded.
      if (context && button.matches('button[aria-label="Search"][title]')) {
        nativeSearchGesture = null;
        search(event, context);
        return;
      }
    }
    if (!config.videos) return;
    const anchor = videoAnchor(path);
    if (!anchor) return;
    consume(event);
    // A double click delivers two clicks. Treat its second click as part of the
    // same gesture; separate ordinary clicks (detail=1) are never throttled.
    if (event.detail > 1) return;
    open('video', api.videoURL(anchor.getAttribute('href')));
  }, true);

  window.addEventListener('keydown', event => {
    if (!ready || !config.search || !event.cancelable || event.defaultPrevented || event.key !== 'Enter') return;
    const input = pathOf(event).find(node => node.matches('input[name="search_query"]'));
    const context = searchContext(input);
    if (context && modifiers(event)) {
      nativeSearchGesture = { form: context.form, time: performance.now() };
      return;
    }
    if (!context) return;
    if (event.isComposing || event.keyCode === 229 || composing) {
      nativeSearchGesture = { form: context.form, time: performance.now() };
      return;
    }
    if (event.repeat || enterHeld) {
      consume(event);
      return;
    }
    if (!api.searchURL(input.value)) return;
    nativeSearchGesture = null;
    enterHeld = true;
    search(event, context);
  }, true);
  window.addEventListener('keyup', event => { if (event.key === 'Enter') enterHeld = false; }, true);
  window.addEventListener('blur', () => { enterHeld = false; }, true);
  window.addEventListener('compositionstart', () => { composing = true; }, true);
  window.addEventListener('compositionend', () => { composing = false; }, true);
  window.addEventListener('submit', event => {
    if (!ready || !config.search || composing || !event.cancelable || event.defaultPrevented || modifiers(event)) return;
    const form = pathOf(event).find(node => node.matches('form'));
    const context = searchContext(form);
    if (context?.form === form) search(event, context);
  }, true);
  // Delegation lives on window at document_start. No per-card listeners,
  // MutationObserver, polling, route hooks, history patches or DOM rewriting.
})();
