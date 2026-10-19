const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..', 'extension');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/observed.html'), 'utf8');

async function setup(t, settings, options = {}) {
  const dom = new JSDOM(fixture, { url: 'https://www.youtube.com/results?search_query=nature', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window;
  const created = [], requests = [], changes = [];
  const store = { settings };
  let workerListener;
  const chrome = {
    storage: {
      local: { get: async () => ({ ...store }), set: async value => { Object.assign(store, value); } },
      onChanged: { addListener: fn => changes.push(fn) }
    },
    runtime: { id: 'test-extension', onMessage: { addListener: fn => { workerListener = fn; } } },
    tabs: { create: async value => {
      if (options.createFails) throw new Error('creation failure');
      created.push(value); return { id: created.length + 10 };
    } }
  };
  const worker = vm.createContext({ chrome, URL, console });
  worker.importScripts = name => vm.runInContext(source(name), worker);
  vm.runInContext(source('background.js'), worker);
  const sender = () => ({ id: chrome.runtime.id, frameId: 0, url: w.location.href, tab: { id: 7, windowId: 2 } });
  w.chrome = {
    storage: chrome.storage,
    runtime: { sendMessage: message => {
      requests.push(message);
      if (options.messageFails) return Promise.reject(new Error('disconnected'));
      return new Promise(resolve => workerListener(message, sender(), resolve));
    } }
  };
  w.eval(source('shared.js'));
  w.eval(source('content.js'));
  await flush();
  let native = 0;
  // Models a site listener reached only if our window capture listener lets
  // the gesture through; prevents jsdom's unimplemented real navigation.
  w.document.addEventListener('click', event => { native++; event.preventDefault(); });
  function click(selector, init = {}) {
    const event = new w.MouseEvent('click', { bubbles: true, cancelable: true, composed: true, button: 0, detail: 1, ...init });
    w.document.querySelector(selector).dispatchEvent(event);
    return event;
  }
  function key(init = {}) {
    const event = new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init });
    w.document.querySelector('input[name=search_query]').dispatchEvent(event);
    return event;
  }
  function submit() {
    const event = new w.Event('submit', { bubbles: true, cancelable: true });
    w.document.querySelector('form').dispatchEvent(event);
    return event;
  }
  function update(next) {
    store.settings = next;
    for (const callback of changes) callback({ settings: { newValue: next } }, 'local');
  }
  return { w, created, requests, click, key, submit, update, store, workerListener, sender, native: () => native };
}
function flush() { return new Promise(resolve => setImmediate(resolve)); }

for (const selector of ['#video-title yt-formatted-string', '#thumbnail img', '.title span', '.cover img']) {
  test(`video title / thumbnail: ${selector} opens exactly once and stops site click`, async t => {
    const s = await setup(t);
    const before = s.w.location.href;
    s.click(selector); await flush();
    assert.equal(s.created.length, 1);
    assert.equal(s.requests.length, 1);
    assert.equal(s.created[0].active, true);
    assert.equal(s.created[0].openerTabId, 7);
    assert.equal(s.created[0].windowId, 2);
    assert.equal(s.native(), 0);
    assert.equal(s.w.location.href, before);
  });
}
test('preserves watch parameters, playlist context and time on a video link', async t => {
  const s = await setup(t);
  s.w.document.querySelector('.title').href = '/watch?v=015eDw5i6P8&list=RD015eDw5i6P8&index=2&t=12s#part';
  s.click('.title'); await flush();
  assert.equal(s.created[0].url, 'https://www.youtube.com/watch?v=015eDw5i6P8&list=RD015eDw5i6P8&index=2&t=12s#part');
});
test('Enter search encodes Chinese, ampersand and plus without changing source URL', async t => {
  const s = await setup(t);
  s.w.document.querySelector('input').value = '  中文 & C++  ';
  const event = s.key(); await flush();
  assert.equal(event.defaultPrevented, true);
  assert.equal(s.created.length, 1);
  assert.equal(new URL(s.created[0].url).searchParams.get('search_query'), '中文 & C++');
  assert.equal(s.w.location.search, '?search_query=nature');
});
test('search button outside form, including nested icon, creates one tab', async t => {
  const s = await setup(t);
  s.w.document.querySelector('input').value = 'button test';
  s.click('.search-icon'); await flush();
  assert.equal(s.created.length, 1);
  assert.equal(s.native(), 0);
});
test('submit-only fallback is supported', async t => {
  const s = await setup(t);
  s.w.document.querySelector('input').value = 'submit';
  assert.equal(s.submit().defaultPrevented, true); await flush();
  assert.equal(s.created.length, 1);
});
for (const action of ['enter', 'button']) {
  test(`deduplicates ${action} followed by submit`, async t => {
    const s = await setup(t);
    s.w.document.querySelector('input').value = 'one tab';
    action === 'enter' ? s.key() : s.click('.search-icon');
    s.submit(); await flush();
    assert.equal(s.created.length, 1);
    assert.equal(s.requests.length, 1);
  });
}
test('held Enter and double click create one tab per gesture', async t => {
  const s = await setup(t);
  s.w.document.querySelector('input').value = 'one tab';
  s.key(); s.key({ repeat: true }); s.key({ repeat: true }); await flush();
  assert.equal(s.created.length, 1);
  s.click('.title', { detail: 1 }); s.click('.title', { detail: 2 }); await flush();
  assert.equal(s.created.length, 2);
});
test('successive intentional Enter and click gestures are not throttled', async t => {
  const s = await setup(t);
  s.w.document.querySelector('input').value = 'same query';
  s.key();
  s.w.dispatchEvent(new s.w.KeyboardEvent('keyup', { key: 'Enter' }));
  s.key(); s.click('.title'); s.click('.title'); await flush();
  assert.equal(s.created.length, 4);
});
for (const init of [{ctrlKey:true}, {shiftKey:true}, {metaKey:true}, {altKey:true}, {button:1}, {button:2}]) {
  test(`modified / non-left click remains native: ${JSON.stringify(init)}`, async t => {
    const s = await setup(t);
    s.click('.title', init); await flush();
    assert.equal(s.requests.length, 0);
    assert.equal(s.native(), 1);
  });
}
test('auxclick and contextmenu are untouched', async t => {
  const s = await setup(t);
  for (const type of ['auxclick', 'contextmenu']) {
    const event = new s.w.MouseEvent(type, { bubbles:true, cancelable:true, button: type === 'auxclick' ? 1 : 2 });
    s.w.document.querySelector('.title').dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  }
  assert.equal(s.requests.length, 0);
});
test('modified Enter and its native submit are not intercepted', async t => {
  const s = await setup(t);
  s.w.document.querySelector('input').value = 'native';
  assert.equal(s.key({ ctrlKey: true }).defaultPrevented, false);
  assert.equal(s.submit().defaultPrevented, false); await flush();
  assert.equal(s.requests.length, 0);
});
test('modified search button and its native submit are not intercepted', async t => {
  const s = await setup(t);
  s.w.document.querySelector('input').value = 'native';
  s.click('.search-icon', { shiftKey: true });
  assert.equal(s.submit().defaultPrevented, false); await flush();
  assert.equal(s.requests.length, 0);
});
for (const selector of ['.channel', '.menu', '.later', '.ad-watch', '#expand-search', 'button[aria-label="清空搜索查询"]', '[role=option]']) {
  test(`non-target control remains native: ${selector}`, async t => {
    const s = await setup(t);
    s.w.document.querySelector('input').value = 'do not search';
    s.click(selector); await flush();
    assert.equal(s.requests.length, 0);
    assert.equal(s.native(), 1);
  });
}
for (const href of ['/playlist?list=PLtest', '/@8kEarth', '/shorts/015eDw5i6P8', '/live/015eDw5i6P8', '/watch?v=bad', 'https://evil.example/watch?v=015eDw5i6P8', 'javascript:alert(1)']) {
  test(`non-watch destination stays native: ${href}`, async t => {
    const s = await setup(t);
    s.w.document.querySelector('.title').setAttribute('href', href);
    s.click('.title'); await flush();
    assert.equal(s.requests.length, 0);
    assert.equal(s.native(), 1);
  });
}
test('settings toggles are independent and apply without reloading page', async t => {
  const s = await setup(t, {videos:false,search:true,active:false});
  s.click('.title'); await flush(); assert.equal(s.created.length, 0);
  s.w.document.querySelector('input').value = 'background'; s.key(); await flush();
  assert.equal(s.created[0].active, false);
  s.update({videos:true,search:false,active:true});
  s.click('.title'); await flush(); assert.equal(s.created[1].active, true);
  s.w.dispatchEvent(new s.w.KeyboardEvent('keyup', {key:'Enter'}));
  assert.equal(s.key().defaultPrevented, false);
  s.click('.search-icon'); await flush(); assert.equal(s.created.length, 2);
});
test('SPA URL change, replaced search box and appended cards need no reinitialization', async t => {
  const s = await setup(t);
  s.w.history.pushState({}, '', '/@8kEarth/videos');
  const box = s.w.document.querySelector('yt-searchbox'); box.outerHTML = box.outerHTML;
  const card = s.w.document.querySelector('yt-lockup-view-model').cloneNode(true);
  card.id = 'appended'; s.w.document.querySelector('main').append(card);
  s.w.eval(source('content.js')); // repeated injection cannot bind twice
  s.click('#appended .title');
  s.w.document.querySelector('input').value = 'SPA'; s.key(); await flush();
  assert.equal(s.created.length, 2);
  assert.equal(s.requests.length, 2);
  assert.equal(s.w.location.pathname, '/@8kEarth/videos');
});
test('empty search and IME confirmation remain native', async t => {
  const s = await setup(t);
  assert.equal(s.key().defaultPrevented, false);
  s.w.document.querySelector('input').value = '中文';
  assert.equal(s.key({ isComposing:true }).defaultPrevented, false);
  s.w.dispatchEvent(new s.w.CompositionEvent('compositionstart'));
  assert.equal(s.key().defaultPrevented, false);
  s.w.dispatchEvent(new s.w.CompositionEvent('compositionend'));
  assert.equal(s.key().defaultPrevented, true); await flush();
  assert.equal(s.created.length, 1);
});
test('unrelated forms and search boxes outside masthead remain native', async t => {
  const s = await setup(t);
  const form = s.w.document.createElement('form'); form.action='/results';
  form.innerHTML='<input name="search_query" value="not top search">';
  s.w.document.body.append(form);
  const event = new s.w.KeyboardEvent('keydown', {key:'Enter',bubbles:true,cancelable:true});
  form.firstChild.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(s.requests.length, 0);
});
for (const failure of ['createFails', 'messageFails']) {
  test(`failure does not retry or navigate source: ${failure}`, async t => {
    const s = await setup(t, undefined, {[failure]:true});
    s.click('.title'); await flush();
    assert.equal(s.requests.length, 1);
    assert.equal(s.created.length, 0);
    assert.equal(s.native(), 0);
    assert.ok(s.w.document.querySelector('#yt-new-tab-error'));
    assert.equal(s.w.location.pathname, '/results');
  });
}
test('worker validates sender, destination and current stored switch', async t => {
  const s = await setup(t);
  const message = {type:'yt-new-tab:open',kind:'video',url:'https://www.youtube.com/watch?v=015eDw5i6P8'};
  const ask = (m, sender) => new Promise(resolve => s.workerListener(m, sender, resolve));
  for (const sender of [{...s.sender(),frameId:1}, {...s.sender(),id:'other'}, {...s.sender(),url:'https://evil.example/'}, {...s.sender(),url:undefined}]) {
    assert.equal((await ask(message,sender)).ok, false);
  }
  assert.equal((await ask({...message,url:'https://evil.example/watch?v=015eDw5i6P8'},s.sender())).ok,false);
  s.store.settings={videos:false};
  assert.equal((await ask(message,s.sender())).ok,false);
  assert.equal(s.created.length,0);
});
test('real playlist-card structure with watch URLs remains native for title and cover', async t => {
  const s=await setup(t);
  const card=s.w.document.querySelector('yt-lockup-view-model');
  const thumbnail=card.querySelector('yt-thumbnail-view-model');
  const collection=s.w.document.createElement('yt-collection-thumbnail-view-model');
  thumbnail.replaceWith(collection);collection.append(thumbnail);
  for (const anchor of card.querySelectorAll('a')) anchor.href='/watch?v=D8uGCdzHCsY&list=PLeCPQtbuJaPtLugP7UijMU-ozdNmkdNFO';
  s.click('.title');s.click('.cover img');await flush();
  assert.equal(s.created.length,0);assert.equal(s.native(),2);
});
test('IME confirming Enter does not turn its following submit into a search', async t => {
  const s=await setup(t);
  s.w.document.querySelector('input').value='中文';
  s.key({isComposing:true});
  assert.equal(s.submit().defaultPrevented,false);
  await flush();assert.equal(s.requests.length,0);
});
