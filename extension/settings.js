(() => {
  'use strict';
  const form = document.getElementById('settings');
  const status = document.getElementById('status');
  let saved = YTNewTab.defaults;
  let queue = Promise.resolve();
  let revision = 0;
  document.getElementById('version').textContent = `v${chrome.runtime.getManifest().version}`;
  function render(value) {
    form.elements.videos.checked = value.videos;
    form.elements.search.checked = value.search;
    form.querySelector(`input[name="active"][value="${value.active}"]`).checked = true;
  }
  chrome.storage.local.get('settings').then(value => {
    saved = YTNewTab.settings(value.settings);
    render(saved);
    form.querySelectorAll('[disabled]').forEach(element => { element.disabled = false; });
    status.textContent = '设置已就绪，修改后自动保存';
  }).catch(() => { status.textContent = '无法读取设置，请重新打开扩展。'; });
  form.addEventListener('change', () => {
    const currentRevision = ++revision;
    const next = {
      videos: form.elements.videos.checked,
      search: form.elements.search.checked,
      active: form.elements.active.value === 'true'
    };
    status.textContent = '正在保存…';
    // Serialize quick changes to avoid older writes completing after new ones.
    queue = queue.then(async () => {
      try {
        await chrome.storage.local.set({ settings: next });
        saved = next;
        if (currentRevision === revision) status.textContent = '已保存，已打开的 YouTube 页面会自动应用';
      } catch {
        if (currentRevision === revision) {
          render(saved);
          status.textContent = '保存失败，已恢复上次设置。请重新打开扩展。';
        }
      }
    });
  });
})();
