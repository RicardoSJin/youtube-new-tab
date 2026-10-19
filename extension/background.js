'use strict';
importScripts('shared.js');

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'yt-new-tab:open') return;
  const source = YTNewTab.youtubeURL(sender.url);
  const destination = YTNewTab.validDestination(message.kind, message.url);
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 ||
      !Number.isInteger(sender.tab?.id) || !source || !destination) {
    respond({ ok: false, error: 'invalid-request' });
    return;
  }
  (async () => {
    const { settings } = await chrome.storage.local.get('settings');
    const config = YTNewTab.settings(settings);
    if (!config[message.kind === 'video' ? 'videos' : 'search']) {
      respond({ ok: false, error: 'disabled' });
      return;
    }
    // tabs.create does not require the broad "tabs" permission. No query,
    // history API, network API, or persistent navigation log is used.
    const tab = await chrome.tabs.create({
      url: destination,
      active: config.active,
      windowId: sender.tab.windowId,
      openerTabId: sender.tab.id
    });
    respond({ ok: true, tabId: tab.id });
  })().catch(() => respond({ ok: false, error: 'open-failed' }));
  // Hold the response channel across service worker wakeup and async storage.
  return true;
});
