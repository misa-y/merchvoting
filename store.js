/* Separate database: production's merch-mockup-voter is only read on explicit import. */
(function (root) {
  'use strict';
  const PUBLIC_DEMO = root.MERCH_PUBLIC_DEMO === true;
  const DB_NAME = PUBLIC_DEMO ? 'mustang-market-public-demo-v1' : 'mustang-market-utokyo-design-lab-v1';
  const KEY = 'prototype';
  const blank = () => ({ schemaVersion: 2, votes: [], demoVotes: PUBLIC_DEMO ? makeDemo(root.DESIGN_CATALOG, 30) : [], originalSnapshot: null, currentIndex: 0, round: 0 });
  let connection;
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(DB_NAME) : null;
  function open() {
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('state');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { connection = null; reject(request.error); };
      request.onblocked = () => { connection = null; reject(new Error('Close other prototype tabs and try again.')); };
    });
    return connection;
  }
  async function read() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = db.transaction('state', 'readonly').objectStore('state').get(KEY);
      request.onsuccess = () => resolve(request.result || blank());
      request.onerror = () => reject(request.error);
    });
  }
  // Read and write in one transaction so simultaneous tabs cannot overwrite votes.
  async function update(change) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      const store = tx.objectStore('state');
      const request = store.get(KEY);
      let state;
      request.onsuccess = () => {
        try { state = request.result || blank(); change(state); store.put(state, KEY); }
        catch (error) { tx.abort(); reject(error); }
      };
      tx.oncomplete = () => { channel?.postMessage('changed'); resolve(state); };
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Could not save. Please try again.'));
    });
  }
  async function readOriginal() {
    const saved = await new Promise((resolve, reject) => {
      const request = indexedDB.open('merch-mockup-voter', 1);
      let absent = false;
      request.onupgradeneeded = () => { absent = true; request.transaction.abort(); };
      request.onerror = () => absent ? resolve(null) : reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('state')) { db.close(); resolve(null); return; }
        const tx = db.transaction('state', 'readonly');
        const get = tx.objectStore('state').get('merch-mockup-voter:v1');
        get.onsuccess = () => resolve(get.result || null);
        get.onerror = () => reject(get.error);
        tx.oncomplete = tx.onabort = () => db.close();
      };
    });
    return saved || JSON.parse(localStorage.getItem('merch-mockup-voter:v1') || 'null');
  }
  async function importOriginal() {
    if (PUBLIC_DEMO) throw new Error('Original records cannot be imported into this public demonstration.');
    const original = await readOriginal();
    if (!original || !Array.isArray(original.designs)) throw new Error('No original records found on this browser and site address. Open the prototype on the same origin as the original to copy its records.');
    return update((state) => {
      if (state.originalSnapshot) throw new Error('Original records have already been copied. The saved snapshot is preserved.');
      state.originalSnapshot = { importedAt: new Date().toISOString(), data: original };
    });
  }
  function summarize(state, catalog, demo = false) {
    demo = PUBLIC_DEMO || demo;
    const ledger = demo ? state.demoVotes : state.votes;
    const legacy = demo ? [] : state.originalSnapshot?.data?.designs || [];
    // Keep records for products that may have been removed from the current catalog.
    const allProducts = [...catalog, ...legacy.filter(d => !catalog.some(c => c.id === d.id))];
    return allProducts.map((design) => {
      const original = legacy.find(d => d.id === design.id);
      const votes = { reject: 0, like: 0, love: 0, ...original?.votes };
      const records = ledger.filter(v => v.productId === design.id);
      records.forEach(v => { votes[v.type] += 1; });
      const positive = records.filter(v => v.type === 'like' || v.type === 'love');
      const preferences = Object.fromEntries(['color', 'fit', 'size'].map(key => {
        const counts = {};
        positive.forEach(v => { const value = v.preferences?.[key]; if (value) counts[value] = (counts[value] || 0) + 1; });
        return [key, counts];
      }));
      const combinations = {};
      positive.forEach(v => {
        const p = v.preferences || {};
        if (p.color && p.fit && p.size) {
          const key = `${p.color} / ${p.fit} / ${p.size}`;
          combinations[key] = (combinations[key] || 0) + 1;
        }
      });
      const total = votes.reject + votes.like + votes.love;
      const detailed = positive.filter(v => v.preferences?.color || v.preferences?.fit || v.preferences?.size).length;
      return { ...design, votes, total, score: votes.like + votes.love * 3 - votes.reject,
        positive: votes.like + votes.love, detailed, preferences, combinations,
        legacyTotal: original ? original.votes.reject + original.votes.like + original.votes.love : 0 };
    }).sort((a, b) => Number(b.total > 0) - Number(a.total > 0) || b.score - a.score || b.positive - a.positive || a.name.localeCompare(b.name));
  }
  function makeDemo(catalog, participants = null) {
    const records = [];
    catalog.forEach((design, i) => {
      const count = participants || 16 + ((i * 13) % 31);
      for (let n = 0; n < count; n += 1) {
        records.push({ id: `demo-${i}-${n}`, productId: design.id,
          type: participants ? (i === 5 ? (n < 2 ? 'reject' : n < 12 ? 'like' : 'love') : (n % 10 < i % 4 + 1 ? 'reject' : n % 10 < 7 ? 'like' : 'love')) : (n % 7 < 2 ? 'reject' : n % 7 < 5 ? 'like' : 'love'),
          preferences: { color: design.colors[participants ? (n % 10 < 6 ? 2 : n % 10 < 9 ? 0 : 3) : (n % 5 < 3 ? 0 : n % design.colors.length)],
            fit: design.fits[n % 4 < 3 ? 1 : 0], size: design.sizes[n % 4 < 3 ? 2 : 3] },
          at: '2026-01-01T12:00:00.000Z', round: Math.floor(n / catalog.length) + 1, participantId: participants ? `simulated-${n + 1}` : null, source: 'demonstration' });
      }
    });
    return records;
  }
  root.MerchStore = { DB_NAME, read, update, importOriginal, summarize, makeDemo,
    reset: () => update(s => { s.votes = []; s.demoVotes = PUBLIC_DEMO ? makeDemo(root.DESIGN_CATALOG, 30) : []; s.currentIndex = 0; s.round = 0; }),
    subscribe: (fn) => { if (channel) channel.onmessage = fn; } };
})(typeof window !== 'undefined' ? window : globalThis);
