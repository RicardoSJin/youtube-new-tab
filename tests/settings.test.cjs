const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const dir = path.join(__dirname, '..', 'extension');
const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

test('settings UI loads defaults, saves all controls and survives reopening', async t => {
  let value;
  async function open() {
    const dom = new JSDOM(read('settings.html'), {runScripts:'outside-only'});
    t.after(() => dom.window.close());
    const w=dom.window;
    w.chrome={storage:{local:{get:async()=>({settings:value}),set:async data=>{value=data.settings;}}},runtime:{getManifest:()=>({version:'1.0.0'})}};
    w.eval(read('shared.js')); w.eval(read('settings.js')); await flush();
    return w;
  }
  const w=await open();
  const form=w.document.querySelector('form');
  assert.equal(form.elements.videos.checked,true);
  assert.equal(form.elements.search.checked,true);
  assert.equal(form.elements.active.value,'true');
  assert.equal(form.elements.videos.disabled,false);
  form.elements.videos.checked=false;
  form.elements.search.checked=false;
  form.querySelector('[name=active][value=false]').checked=true;
  form.dispatchEvent(new w.Event('change',{bubbles:true})); await flush();
  assert.equal(value.videos,false); assert.equal(value.search,false); assert.equal(value.active,false);
  const again=await open();
  assert.equal(again.document.querySelector('form').elements.active.value,'false');
  assert.equal(again.document.querySelector('form').elements.videos.checked,false);
});
test('failed settings save restores confirmed saved state and reports failure', async t => {
  const dom=new JSDOM(read('settings.html'),{runScripts:'outside-only'});t.after(()=>dom.window.close());
  const w=dom.window;
  w.chrome={storage:{local:{get:async()=>({}),set:async()=>{throw new Error('quota');}}},runtime:{getManifest:()=>({version:'1.0.0'})}};
  w.eval(read('shared.js'));w.eval(read('settings.js'));await flush();
  const form=w.document.querySelector('form');form.elements.videos.checked=false;
  form.dispatchEvent(new w.Event('change',{bubbles:true}));await flush();
  assert.equal(form.elements.videos.checked,true);
  assert.match(w.document.querySelector('#status').textContent,/保存失败/);
});
test('an older failed save cannot revert a newer queued choice', async t => {
  const dom=new JSDOM(read('settings.html'),{runScripts:'outside-only'});t.after(()=>dom.window.close());
  const w=dom.window;let calls=0;let saved;
  w.chrome={storage:{local:{get:async()=>({}),set:async data=>{if(++calls===1)throw new Error('transient');saved=data.settings;}}},runtime:{getManifest:()=>({version:'1.0.0'})}};
  w.eval(read('shared.js'));w.eval(read('settings.js'));await flush();
  const form=w.document.querySelector('form');
  form.elements.videos.checked=false;form.dispatchEvent(new w.Event('change',{bubbles:true}));
  form.elements.search.checked=false;form.dispatchEvent(new w.Event('change',{bubbles:true}));
  await flush();assert.equal(saved.videos,false);assert.equal(saved.search,false);
  assert.equal(form.elements.videos.checked,false);assert.equal(form.elements.search.checked,false);
  assert.match(w.document.querySelector('#status').textContent,/已保存/);
});
