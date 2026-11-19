const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { IDBFactory } = require('fake-indexeddb');
function setup(publicDemo = false) {
  const indexedDB = new IDBFactory();
  const local = new Map();
  const context = vm.createContext({ indexedDB, localStorage: { getItem: k => local.get(k) ?? null }, structuredClone, console });
  context.window = context;
  context.MERCH_PUBLIC_DEMO = publicDemo;
  vm.runInContext(fs.readFileSync('catalog.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('store.js', 'utf8'), context);
  return { store: context.MerchStore, catalog: context.DESIGN_CATALOG, indexedDB, local };
}
const snapshot = { designs: [{ id: 'asij_hoodie', name: 'ASIJ Hoodie', votes: { reject: 2, like: 4, love: 3 }, history: [{type:'love', at:'2025-02-01', round:1}] }], currentIndex: 3, round: 2, extraField: 'preserve this too' };
const json = value => JSON.parse(JSON.stringify(value));
async function putOriginal(indexedDB, value) {
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open('merch-mockup-voter', 1); r.onupgradeneeded = () => r.result.createObjectStore('state'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  await new Promise((resolve, reject) => { const tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put(value, 'merch-mockup-voter:v1'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  return db;
}
async function getOriginal(db) {
  return new Promise(resolve => { const r = db.transaction('state').objectStore('state').get('merch-mockup-voter:v1'); r.onsuccess = () => resolve(r.result); });
}
test('prototype saves and resets never touch production; original snapshot is exact and import is idempotent', async () => {
  const { store, indexedDB, catalog } = setup();
  const db = await putOriginal(indexedDB, snapshot);
  const initial = await store.read(); assert.equal(initial.votes.length, 0); assert.equal(initial.originalSnapshot, null);
  await store.importOriginal();
  await assert.rejects(store.importOriginal(), /already been copied/);
  await store.update(s => { s.votes.push({ productId: 'asij_hoodie', type:'love', preferences:{color:'Navy',fit:'Oversized',size:'M'} }); s.demoVotes = store.makeDemo(catalog); });
  assert.deepEqual(await getOriginal(db), snapshot);
  const before = await store.read(); assert.deepEqual(json(before.originalSnapshot.data), snapshot);
  const after = await store.reset(); assert.equal(after.votes.length, 0); assert.equal(after.demoVotes.length, 0);
  assert.deepEqual(json(after.originalSnapshot), json(before.originalSnapshot)); assert.deepEqual(await getOriginal(db), snapshot);
  db.close();
});
test('concurrent transactions preserve every vote and failed writes abort without mutation', async () => {
  const { store } = setup();
  await Promise.all(Array.from({ length: 40 }, (_, id) => store.update(s => s.votes.push({id}))));
  assert.equal((await store.read()).votes.length, 40);
  await assert.rejects(store.update(s => { s.votes = []; throw new Error('simulated failure'); }), /simulated failure/);
  assert.equal((await store.read()).votes.length, 40);
});
test('legacy localStorage fallback imports without changing its value or creating a production DB', async () => {
  const { store, local, indexedDB } = setup(); const value = JSON.stringify(snapshot);
  local.set('merch-mockup-voter:v1', value);
  const state = await store.importOriginal();
  assert.deepEqual(json(state.originalSnapshot.data), snapshot); assert.equal(local.get('merch-mockup-voter:v1'), value);
  assert.equal((await indexedDB.databases()).some(db => db.name === 'merch-mockup-voter'), false);
});
test('missing original records fail clearly and preserve prototype votes', async () => {
  const { store } = setup(); await store.update(s => s.votes.push({id:'keep'}));
  await assert.rejects(store.importOriginal(), /No original records/); assert.equal((await store.read()).votes[0].id, 'keep');
});
test('weighted rankings include original counts; preference charts exclude rejects and unspecified attributes', async () => {
  const { store, catalog } = setup();
  const state = await store.update(s => {
    s.originalSnapshot = {data:snapshot};
    s.votes = [
      {productId:'asij_hoodie',type:'like',preferences:{color:'Navy',fit:'Oversized',size:'M'}},
      {productId:'asij_hoodie',type:'love',preferences:{color:'Navy',fit:null,size:null}},
      {productId:'asij_hoodie',type:'reject',preferences:{color:'Black',fit:'Regular',size:'XS'}},
      {productId:'asij_hoodie',type:'love',preferences:{color:null,fit:null,size:null}},
    ];
  });
  const hoodie = store.summarize(state, catalog).find(p => p.id === 'asij_hoodie');
  assert.equal(hoodie.total,13); assert.equal(hoodie.score,17); assert.equal(hoodie.positive,10); assert.equal(hoodie.detailed,2);
  assert.deepEqual(json(hoodie.preferences), {color:{Navy:2},fit:{Oversized:1},size:{M:1}});
  assert.deepEqual(json(hoodie.combinations), {'Navy / Oversized / M':1});
});
test('demo records are labeled, valid for each product, and never mixed into real results', async () => {
  const { store, catalog } = setup();
  const state = await store.update(s => { s.demoVotes = store.makeDemo(catalog); });
  assert.ok(state.demoVotes.length > 300);
  for (const v of state.demoVotes) { const p = catalog.find(p => p.id === v.productId); assert.equal(v.source, 'demonstration'); assert.ok(p.colors.includes(v.preferences.color)); assert.ok(p.fits.includes(v.preferences.fit)); assert.ok(p.sizes.includes(v.preferences.size)); }
  assert.equal(store.summarize(state, catalog).reduce((n,p) => n+p.total, 0), 0);
  assert.equal(store.summarize(state, catalog, true).reduce((n,p) => n+p.total, 0), state.demoVotes.length);
});
test('original products outside the active catalog remain in results', async () => {
  const { store, catalog } = setup();
  const state = await store.update(s => { s.originalSnapshot = {data:{designs:[{id:'retired',name:'Retired design',votes:{reject:1,like:3,love:1},history:[]}]}}; });
  const retired = store.summarize(state,catalog).find(p => p.id === 'retired'); assert.equal(retired.total,5); assert.equal(retired.score,5);
});


test('public preview seeds 30 simulated participants, blocks original import, and preserves local prototype data', async () => {
  const { store, catalog, indexedDB, local } = setup(true);
  const db = await putOriginal(indexedDB, snapshot);
  const originalJSON = JSON.stringify(snapshot);
  local.set('merch-mockup-voter:v1', originalJSON);
  const state = await store.read();
  assert.equal(store.DB_NAME, 'mustang-market-public-demo-v1');
  assert.equal(state.demoVotes.length, 360);
  assert.equal(new Set(state.demoVotes.map(v => v.participantId)).size, 30);
  assert.equal(state.votes.length, 0);
  assert.equal(state.originalSnapshot, null);
  for (const product of catalog) assert.equal(state.demoVotes.filter(v => v.productId === product.id).length, 30);
  await assert.rejects(store.importOriginal(), /cannot be imported/);
  await store.update(s => s.demoVotes.push({id:'rehearsal',productId:'asij_hoodie',type:'love',preferences:{color:'Navy',fit:'Oversized',size:'M'},source:'demonstration-interaction'}));
  assert.equal(store.summarize(await store.read(), catalog).reduce((n,p) => n+p.total,0), 361);
  const reset = await store.reset();
  assert.equal(reset.demoVotes.length,360);
  assert.equal(reset.votes.length,0);
  assert.deepEqual(await getOriginal(db),snapshot);
  assert.equal(local.get('merch-mockup-voter:v1'),originalJSON);
  assert.equal((await indexedDB.databases()).some(d => d.name === 'mustang-market-utokyo-design-lab-v1'),false);
  db.close();
});
