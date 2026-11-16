// Úložiště a sdílení dat aplikace Naše doma.
// Data jsou vždy v telefonu (localStorage). Když je zapnuté sdílení, posílají se navíc do vlastní Firebase
// Realtime Database přes její REST rozhraní (fetch) a změny od partnera chodí živě přes EventSource.
// Žádná knihovna: Firebase REST umí PUT/PATCH/DELETE na <adresa>/<cesta>.json a streamování přes text/event-stream.
//
// Tvar sdílených dat (každý záznam má t = čas poslední změny v ms; vyhrává novější):
//   people:  { a: {name,t}, b: {name,t} }
//   shop:    { id: {n, q, c, done, by, t, del} }
//   chores:  { id: {n, pts, freq, who, last, lastBy, t, del} }
//   log:     { id: {chore, name, by, at, pts, t, del} }
//   answers: { 'YYYY-MM-DD': { a: {text,t}, b: {text,t} } }
//   fav:     { nazev: {n, count, c, t} }
//   ideas:   { id: {n, k ('dinner'|'movie'), by, t, del} }   – nápady do rozhodovače
//   picks:   { k: {ids: [poslední vybrané id…], at, t} }      – co naposledy padlo (ať se hned nevrací)
(function () {
  const KEY = 'naseDoma.v1';
  const CFG = 'naseDoma.cfg.v1';
  const QUEUE = 'naseDoma.queue.v1';
  const COLLS = ['people', 'shop', 'chores', 'log', 'answers', 'fav', 'ideas', 'picks'];
  // Připravená databáze (Mohyho Firebase projekt nase-doma, Belgie). Adresa není tajná: bez klíče domácnosti (≥ 16 znaků)
  // pravidla databáze nic nepustí a kořen ani seznam domů nejde číst. Vlastní databázi lze nastavit v záložce Víc.
  const DEFAULT_DB = 'https://nase-doma-d0ab6-default-rtdb.europe-west1.firebasedatabase.app';

  const now = () => Date.now();
  const uid = () => now().toString(36) + Math.random().toString(36).slice(2, 8);

  function emptyState() { const s = {}; COLLS.forEach(c => s[c] = {}); return s; }

  function load(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* plný prostor – necháme být */ } }

  const Store = {
    state: Object.assign(emptyState(), load(KEY, {})),
    cfg: Object.assign({ me: '', lang: '', theme: 'auto', db: '', key: '' }, load(CFG, {})),
    queue: load(QUEUE, []),
    listeners: [],
    status: 'off', // off | wait | ok | err
    defaultDb: DEFAULT_DB,
    es: null,
    flushing: false,

    onChange(fn) { this.listeners.push(fn); },
    emit() { this.listeners.forEach(fn => fn()); },
    persist() { save(KEY, this.state); save(CFG, this.cfg); save(QUEUE, this.queue); },

    // Zápis záznamu: lokálně hned, do Firebase přes frontu. Odpovědi (answers) jsou vnořené o úroveň víc.
    set(coll, id, rec, sub) {
      rec = Object.assign({}, rec, { t: now() });
      if (sub) { this.state[coll][id] = this.state[coll][id] || {}; this.state[coll][id][sub] = rec; }
      else this.state[coll][id] = rec;
      this.enqueue({ m: 'PUT', p: sub ? `${coll}/${id}/${sub}` : `${coll}/${id}`, b: rec });
      this.persist(); this.emit(); this.flush();
      return rec;
    },
    // Mazání = náhrobek (del: true), aby partnerův telefon smazání převzal i offline. Po 30 dnech se uklidí.
    del(coll, id) {
      const rec = this.state[coll][id]; if (!rec) return;
      this.set(coll, id, Object.assign({}, rec, { del: true }));
    },
    get(coll) {
      return Object.entries(this.state[coll] || {}).filter(([, r]) => r && !r.del).map(([id, r]) => Object.assign({ id }, r));
    },
    purge() {
      const limit = now() - 30 * 86400000; let changed = false;
      COLLS.forEach(c => Object.entries(this.state[c]).forEach(([id, r]) => {
        if (r && r.del && r.t < limit) { delete this.state[c][id]; this.enqueue({ m: 'DELETE', p: `${c}/${id}` }); changed = true; }
      }));
      if (changed) { this.persist(); this.flush(); }
    },

    // Sloučení cizích dat (ze serveru nebo ze zálohy): u každého záznamu vyhrává novější t.
    merge(data, path) {
      let changed = false;
      const mergeRec = (coll, id, sub, rec) => {
        if (!rec || typeof rec !== 'object') return;
        const cur = sub ? (this.state[coll][id] || {})[sub] : this.state[coll][id];
        if (!cur || (rec.t || 0) > (cur.t || 0)) {
          if (sub) { this.state[coll][id] = this.state[coll][id] || {}; this.state[coll][id][sub] = rec; }
          else this.state[coll][id] = rec;
          changed = true;
        }
      };
      const parts = (path || '/').split('/').filter(Boolean);
      if (parts.length === 0) {
        if (data) COLLS.forEach(c => data[c] && Object.entries(data[c]).forEach(([id, r]) => {
          if (c === 'answers') Object.entries(r || {}).forEach(([sub, rr]) => mergeRec(c, id, sub, rr)); else mergeRec(c, id, null, r);
        }));
      } else if (parts.length === 1) {
        const c = parts[0]; if (!COLLS.includes(c) || !data) return false;
        Object.entries(data).forEach(([id, r]) => { if (c === 'answers') Object.entries(r || {}).forEach(([sub, rr]) => mergeRec(c, id, sub, rr)); else mergeRec(c, id, null, r); });
      } else if (parts.length === 2) {
        const [c, id] = parts; if (!COLLS.includes(c)) return false;
        if (c === 'answers') Object.entries(data || {}).forEach(([sub, rr]) => mergeRec(c, id, sub, rr)); else mergeRec(c, id, null, data);
      } else if (parts.length === 3) {
        const [c, id, sub] = parts; if (c !== 'answers') return false; mergeRec(c, id, sub, data);
      }
      if (changed) { this.persist(); this.emit(); }
      return changed;
    },

    // --- Sdílení přes Firebase ---
    base() { const d = (this.cfg.db || this.defaultDb || '').replace(/\/+$/, ''); return d && this.cfg.key ? `${d}/domy/${this.cfg.key}` : ''; },
    enabled() { return !!this.base(); },
    enqueue(op) { if (!this.enabled()) return; this.queue.push(op); if (this.queue.length > 500) this.queue.splice(0, this.queue.length - 500); save(QUEUE, this.queue); },
    async flush() {
      if (!this.enabled() || this.flushing || !this.queue.length || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
      this.flushing = true;
      try {
        while (this.queue.length) {
          const op = this.queue[0];
          const r = await fetch(`${this.base()}/${op.p}.json`, { method: op.m, body: op.b === undefined ? undefined : JSON.stringify(op.b) });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          this.queue.shift(); save(QUEUE, this.queue);
        }
        if (this.status !== 'ok') { this.status = 'ok'; this.emit(); }
      } catch (e) {
        this.status = 'err'; this.emit();
        setTimeout(() => this.flush(), 15000);
      } finally { this.flushing = false; }
    },
    // Živé naslouchání: první zpráva „put /“ přinese všechno, další jen změny.
    connect() {
      this.disconnect();
      if (!this.enabled() || typeof EventSource === 'undefined') { this.status = 'off'; this.emit(); return; }
      this.status = 'wait'; this.emit();
      let es;
      try { es = new EventSource(`${this.base()}.json`); } catch (e) { this.status = 'err'; this.emit(); return; }
      this.es = es;
      const onData = ev => { try { const d = JSON.parse(ev.data); if (d && 'path' in d) this.merge(d.data, d.path); } catch (e) { /* vadný řádek přeskočíme */ } };
      es.addEventListener('put', ev => { onData(ev); if (this.status !== 'ok') { this.status = 'ok'; this.emit(); } this.pushAllOnce(); });
      es.addEventListener('patch', onData);
      es.addEventListener('cancel', () => { this.status = 'err'; this.emit(); });
      es.onerror = () => { this.status = 'err'; this.emit(); };
      this.flush();
    },
    disconnect() { if (this.es) { this.es.close(); this.es = null; } },
    // Po prvním připojení pošleme na server i vše, co už v telefonu máme (server může být prázdný).
    pushAllOnce() {
      if (this.pushed) return; this.pushed = true;
      if (!this.queue.length) {
        const hasLocal = COLLS.some(c => Object.keys(this.state[c]).length);
        if (hasLocal) { this.enqueue({ m: 'PATCH', p: '', b: this.state }); this.flush(); }
      }
    },
    setSharing(db, key) {
      this.cfg.db = db || ''; this.cfg.key = key || ''; this.pushed = false; this.queue = [];
      this.persist(); this.connect();
    },
    // Záloha pro export / import (vč. jmen, bez nastavení telefonu).
    exportJSON() { return JSON.stringify({ app: 'nase-doma', v: 1, exported: new Date().toISOString(), data: this.state }, null, 1); },
    importJSON(text) {
      let o; try { o = JSON.parse(text); } catch (e) { return false; }
      if (!o || o.app !== 'nase-doma' || !o.data) return false;
      this.merge(o.data, '/');
      if (this.enabled()) { this.enqueue({ m: 'PATCH', p: '', b: this.state }); this.flush(); }
      return true;
    },
    resetLocal() { localStorage.removeItem(KEY); localStorage.removeItem(CFG); localStorage.removeItem(QUEUE); },
    newKey() { const a = new Uint8Array(24); (crypto.getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 256)); return Array.from(a, b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join(''); },
    uid,
  };

  // Fronta „PATCH /“ s celým stavem: Firebase PATCH na kořen bere jen první úroveň, proto posíláme po kolekcích.
  const origFlush = Store.flush.bind(Store);
  Store.flush = async function () {
    this.queue = this.queue.flatMap(op => (op.m === 'PATCH' && op.p === '') ? COLLS.filter(c => Object.keys(op.b[c] || {}).length).map(c => ({ m: 'PATCH', p: c, b: op.b[c] })) : [op]);
    return origFlush();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { Store.flush(); if (Store.enabled() && (!Store.es || Store.es.readyState === 2)) Store.connect(); });
    // Když se aplikace vrátí z pozadí (iPhone EventSource často uspí), znovu se připojíme.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Store.enabled()) Store.connect(); });
  }
  window.Store = Store;
})();
