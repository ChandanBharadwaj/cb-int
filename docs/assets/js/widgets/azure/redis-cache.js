/* Redis: Spring cache-aside (miss, hit, evict, stampede), volatile-lru eviction filling memory, and cluster hash slots with CROSSSLOT, hash tags and shard failover. */
IA.widget('redis-cache', (root, ctx) => {
  /* ---- shared Azure widget kit (identical in every azure widget file) ---- */
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-az-style')) {
    document.head.append(el('style', { id: 'w-az-style', text: `
.w-az .nb rect { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .4s, stroke .4s; }
.w-az .nb { transition: opacity .45s; }
.w-az .nb text { fill: var(--text); font-size: 13px; font-family: var(--sans); }
.w-az .nb text.s { fill: var(--text-3); font-size: 10.5px; font-family: var(--mono); }
.w-az .nb.hot rect { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-az .nb.ok rect { stroke: var(--ok); stroke-width: 2.5; fill: color-mix(in srgb, var(--ok) 15%, var(--surface)); }
.w-az .nb.warn rect { stroke: var(--warn); stroke-width: 2.5; fill: color-mix(in srgb, var(--warn) 16%, var(--surface)); }
.w-az .nb.bad rect { stroke: var(--err); stroke-width: 2.5; fill: color-mix(in srgb, var(--err) 15%, var(--surface)); }
.w-az .nb.bad text.s, .w-az .nb.warn text.s, .w-az .nb.ok text.s, .w-az .nb.hot text.s { fill: var(--text-2); }
.w-az .nb.dim { opacity: .32; }
.w-az .nb.gone { opacity: .1; }
.w-az .eg { stroke: var(--border); stroke-width: 1.6; fill: none; transition: stroke .4s, opacity .4s; }
.w-az .eg.hot { stroke: var(--accent); stroke-width: 2.6; }
.w-az .eg.ok { stroke: var(--ok); stroke-width: 2.6; }
.w-az .eg.warn { stroke: var(--warn); stroke-width: 2.6; }
.w-az .eg.bad { stroke: var(--err); stroke-width: 2.6; stroke-dasharray: 6 4; }
.w-az .eg.dim { opacity: .25; }
.w-az .zn { fill: color-mix(in srgb, var(--surface-2) 70%, transparent); stroke: var(--border); stroke-dasharray: 6 5; transition: stroke .4s, fill .4s; }
.w-az .zn.bad { stroke: var(--err); fill: color-mix(in srgb, var(--err) 9%, transparent); }
.w-az .zn.hot { stroke: var(--accent); }
.w-az .lbl { fill: var(--text-2); font-size: 12px; font-family: var(--sans); }
.w-az .lbl.m { font-family: var(--mono); font-size: 11px; fill: var(--text-3); }
.w-az .pkt { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.w-az .bar { transition: width .6s ease, x .6s ease; }
.w-az.rm * { transition: none !important; animation: none !important; }
` }));
  }
  root.classList.add('w-az'); if (reduced) root.classList.add('rm');
  const Z = {};
  const clearZ = () => { for (const k in Z) delete Z[k]; };
  const seg = (opts, cur, on, label) => {
    const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' });
      b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); });
    return s;
  };
  const node = (g, id, x, y, w, h, t, s) => {
    const n = svg('g', { class: 'nb' });
    n.append(svg('rect', { x, y, width: w, height: h, rx: 8 }));
    n.append(svg('text', { x: x + w / 2, y: s != null ? y + h / 2 - 3 : y + h / 2 + 4, 'text-anchor': 'middle', text: t }));
    let se = null;
    if (s != null) { se = svg('text', { class: 's', x: x + w / 2, y: y + h / 2 + 12, 'text-anchor': 'middle', text: s }); n.append(se); }
    g.append(n); Z[id] = { n, base: 'nb', sub: se, sub0: s || '', x, y, w, h }; return n;
  };
  const edge = (g, id, d) => { const p = svg('path', { class: 'eg', d }); g.append(p); Z[id] = { n: p, base: 'eg' }; return p; };
  const link = (g, id, a, b) => {
    const A = Z[a]; const B = Z[b];
    const x1 = A.x + A.w / 2; const y1 = A.y + A.h; const x2 = B.x + B.w / 2; const y2 = B.y; const my = (y1 + y2) / 2;
    return edge(g, id, `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`);
  };
  const hlink = (g, id, a, b) => {
    const A = Z[a]; const B = Z[b]; const y1 = A.y + A.h / 2; const y2 = B.y + B.h / 2;
    const [x1, x2] = A.x < B.x ? [A.x + A.w, B.x] : [A.x, B.x + B.w]; const mx = (x1 + x2) / 2;
    return edge(g, id, `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
  };
  const mid = (id) => { const z = Z[id]; return [z.x + z.w / 2, z.y + z.h / 2]; };
  function paint(s) {
    for (const id in Z) { const z = Z[id]; const c = s && s.c && s.c[id];
      z.n.setAttribute('class', z.base + (c ? ' ' + c : ''));
      if (z.sub) z.sub.textContent = s && s.sub && s.sub[id] != null ? s.sub[id] : z.sub0; }
  }
  const cum = () => { let acc = {}; let sub = {};
    return { set(c, sb) { Object.assign(acc, c || {}); Object.assign(sub, sb || {}); return { c: { ...acc }, sub: { ...sub } }; }, clear() { acc = {}; sub = {}; } }; };
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const say = (n, h, cls) => { narr.className = 'caption' + (cls ? ' ' + cls : ''); narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: String(n) }), el('div', { class: 't', html: h })); };
  let gen = 0;
  const pkt = svg('circle', { r: 7, class: 'pkt', opacity: 0 });
  function fly(ids, ms) {
    const g = gen; const pts = ids.map((p) => (typeof p === 'string' ? mid(p) : p));
    return new Promise((res) => {
      if (reduced || pts.length < 2) return res();
      const L = []; let tot = 0;
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
      const dur = ms || 900; const t0 = performance.now(); pkt.setAttribute('opacity', 1);
      const fr = (t) => {
        if (g !== gen) { pkt.setAttribute('opacity', 0); return res(); }
        let d = Math.min(1, (t - t0) / dur) * tot; let i = 0;
        while (i < L.length - 1 && d > L[i]) { d -= L[i]; i++; }
        const f = L[i] ? Math.min(1, d / L[i]) : 1; const [x1, y1] = pts[i]; const [x2, y2] = pts[i + 1];
        pkt.setAttribute('cx', x1 + (x2 - x1) * f); pkt.setAttribute('cy', y1 + (y2 - y1) * f);
        if (t - t0 < dur) requestAnimationFrame(fr); else { pkt.setAttribute('opacity', 0); res(); }
      };
      requestAnimationFrame(fr);
    });
  }
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const controls = el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset);
  let steps = []; let k = 0; let running = false; let busy = false;
  function makeStepper(plan, intro, onReset, pause) {
    const reset = () => {
      gen++; running = false; busy = false; bPlay.textContent = '▶ Play'; k = 0;
      if (onReset) onReset(); steps = plan(); paint(null); say(0, intro()); bStep.disabled = false;
    };
    const step = async () => {
      if (busy || k >= steps.length) return false;
      busy = true; const g = gen; const s = steps[k++];
      if (s.pre) paint(s.pre);
      if (s.fly) await fly(s.fly, s.ms);
      if (g !== gen) return false;
      paint(s); if (s.run) s.run(); say(k, s.t, s.cls); busy = false;
      if (k >= steps.length) bStep.disabled = true;
      return true;
    };
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= steps.length) reset();
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && await step()) { if (k >= steps.length) break; await sleep(reduced ? 700 : (pause || 2600)); }
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    return reset;
  }
  /* ---- end kit ---- */
  let mode = 'aside';
  const stage = svg('svg', { viewBox: '0 0 640 330', role: 'img', 'aria-label': 'Spring app, Redis and Postgres for cache-aside, eviction and clustering' });
  const segM = seg([['aside', 'Cache-aside'], ['evict', 'Eviction'], ['cluster', 'Cluster']], mode, (v) => { mode = v; reset(); }, 'Mechanism');
  const stats = el('div', { class: 'w-stats' });
  const stat = (pairs) => { stats.innerHTML = ''; pairs.forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: `${k} <b>${v}</b>` }))); };
  let memBar = null;
  const KEYS = [['product:42', 'TTL 30m · idle 9m'], ['product:7', 'TTL 30m · idle 1m'], ['home:v3', 'TTL 10m · idle 20s'], ['session:ab', 'TTL 60m · idle 14m'],
    ['viewed:u1', 'no TTL'], ['viewed:u2', 'no TTL'], ['viewed:u3', 'no TTL'], ['viewed:u4', 'no TTL']];
  function setMem(p) { if (memBar) { memBar.setAttribute('width', 600 * Math.min(1, p)); memBar.setAttribute('fill', p >= 1 ? 'var(--err)' : p > 0.85 ? 'var(--warn)' : 'var(--ok)'); } }
  function build() {
    stage.innerHTML = ''; clearZ(); memBar = null;
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    const reg = (id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 12 }); bg.append(r, svg('text', { class: 'lbl', x: x + 10, y: y + 18, text: label })); Z[id] = { n: r, base: 'zn' }; };
    if (mode === 'aside') {
      node(g, 'u', 10, 20, 170, 56, 'Users', 'GET /products/42');
      node(g, 'app', 235, 20, 170, 56, 'catalog-api ×20', '@Cacheable("product")');
      node(g, 'r', 460, 20, 170, 56, 'Redis', 'product:42 → ?');
      node(g, 'db', 235, 160, 170, 56, 'Postgres', 'products');
      node(g, 'adm', 10, 160, 170, 56, 'Admin', 'PUT price');
      hlink(e, 'eU', 'u', 'app'); hlink(e, 'eR', 'app', 'r'); link(e, 'eD', 'app', 'db'); hlink(e, 'eA', 'adm', 'db');
      edge(e, 'eA2', 'M95 160 C 95 120, 300 120, 300 76');
      g.append(svg('text', { class: 'lbl m', x: 320, y: 270, 'text-anchor': 'middle', text: 'read: cache → DB on miss → SET with TTL   ·   write: DB → DEL key' }));
      stat([['hits', '0'], ['misses', '0'], ['DB queries', '0']]);
    } else if (mode === 'evict') {
      reg('mem', 10, 10, 620, 250, 'Redis memory · maxmemory-policy = volatile-lru');
      KEYS.forEach(([k, s], i) => node(g, 'k' + i, 22 + (i % 4) * 152, 40 + Math.floor(i / 4) * 100, 140, 80, k, s));
      node(g, 'app', 22, 268, 300, 50, 'catalog-api', 'SET recent:u9 …');
      g.append(svg('rect', { x: 20, y: 236, width: 600, height: 12, rx: 6, fill: 'var(--surface-2)', stroke: 'var(--border)' }));
      memBar = svg('rect', { class: 'bar', x: 20, y: 236, width: 0, height: 12, rx: 6, fill: 'var(--ok)' }); g.append(memBar);
      setMem(0.6); stat([['used memory', '60%'], ['policy', 'volatile-lru'], ['evicted', '0']]);
    } else {
      node(g, 'app', 10, 130, 150, 60, 'cart-api', 'Lettuce (cluster)');
      [['s1', '0 – 5460'], ['s2', '5461 – 10922'], ['s3', '10923 – 16383']].forEach(([id, sl], i) => {
        reg('g' + id, 200, 6 + i * 108, 430, 100, `Shard ${i + 1} · slots ${sl}`);
        node(g, id, 214, 32 + i * 108, 190, 62, 'primary', '—');
        node(g, id + 'r', 424, 32 + i * 108, 190, 62, 'replica', 'async copy');
        hlink(e, 'eR' + id, id, id + 'r');
        hlink(e, 'e' + id, 'app', id);
      });
      stat([['slot', 'CRC16(key) mod 16384'], ['multi-key ops', 'same slot only']]);
    }
    stage.append(bg, e, g, pkt);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'aside') {
      const st = (h, m, q) => () => stat([['hits', h], ['misses', m], ['DB queries', q]]);
      S.push({ fly: ['u', 'app', 'r'], ...A.set({ u: 'hot', app: 'hot', eU: 'hot', eR: 'hot', adm: 'dim', eA: 'dim', eA2: 'dim' }), t: 'A request for product 42 reaches a pod. Spring’s <code>@Cacheable</code> proxy runs <code>GET catalog:v3:product::42</code> first.' });
      S.push({ ...A.set({ r: 'warn' }, { r: 'product:42 → (nil)' }), run: st('0', '1', '0'), t: '<b>Miss</b>: the key doesn’t exist yet.', cls: 'warn' });
      S.push({ fly: ['app', 'db', 'app'], ...A.set({ db: 'hot', eD: 'hot' }), run: st('0', '1', '1'), t: 'The proxy calls the real method, which queries Postgres (a few milliseconds plus a network hop).' });
      S.push({ fly: ['app', 'r'], ...A.set({ r: 'ok', db: '', eD: '' }, { r: 'product:42 = {…} EX 1800' }), t: 'The result is written back with <code>SET … EX 1800</code>: a 30-minute TTL from <code>entryTtl</code>. Without a TTL this key would live forever.', cls: 'ok' });
      S.push({ fly: ['u', 'app', 'r', 'app', 'u'], ...A.set({ app: 'ok', u: 'ok' }), run: st('1', '1', '1'), t: '<b>Hit</b>: the next request is served from Redis in well under a millisecond inside the server. The database isn’t touched.', cls: 'ok' });
      S.push({ fly: ['adm', 'db'], ...A.set({ adm: 'hot', eA: 'hot', db: 'ok' }, { db: 'price = 19.99 (committed)' }), t: 'An admin changes the price. The service commits the change to Postgres first…' });
      S.push({ fly: ['adm', 'app', 'r'], ...A.set({ eA2: 'hot', r: 'warn' }, { r: 'DEL product:42' }), t: '…then <code>@CacheEvict</code> <b>deletes</b> the key. It doesn’t write the new value: deleting can’t race another writer into caching an older price.', cls: 'warn' });
      S.push({ ...A.set({ r: 'bad', app: 'bad', db: 'bad', eD: 'bad' }, { r: 'home:v3 expired', app: '20 pods miss at once', db: '20 identical queries' }), run: st('1', '21', '21'), t: '<b>Stampede</b>: a hot key that every pod uses expires. All 20 pods miss at the same moment and all query the database. <code>sync = true</code> only helps inside one JVM.', cls: 'err' });
      S.push({ ...A.set({ r: 'ok', app: 'ok', db: 'ok', eD: 'ok' }, { r: 'TTL 10m ± 2m jitter', app: 'sync = true per pod', db: 'a few queries' }), run: st('…', '…', '≤ 1 per pod'), t: 'Fix: random <b>jitter</b> on TTLs so keys don’t expire together, <code>sync = true</code>, and refresh-ahead or a short <code>SET NX</code> lock for the very hottest keys.', cls: 'ok' });
      return S;
    }
    if (mode === 'evict') {
      const st = (m, ev) => () => { setMem(m); stat([['used memory', Math.round(m * 100) + '%'], ['policy', 'volatile-lru'], ['evicted', ev]]); };
      S.push({ ...A.set({ k4: 'warn', k5: 'warn', k6: 'warn', k7: 'warn' }), run: st(0.6, '0'), t: 'Half the keys have a TTL (cache entries, sessions). The <code>viewed:*</code> keys from a new feature were written <b>without</b> one.' });
      S.push({ fly: ['app', 'k0'], ...A.set({ app: 'hot' }), run: st(1.0, '0'), t: 'Traffic grows and memory reaches <code>maxmemory</code>. The next write needs room, so Redis runs the eviction policy.', cls: 'warn' });
      S.push({ ...A.set({ k3: 'bad' }, { k3: 'evicted (idle 14m)' }), run: st(0.97, '1'), t: '<code>volatile-lru</code> samples keys <b>that have an expiry</b> and evicts the least recently used: <code>session:ab</code>, idle for 14 minutes. That user is logged out.', cls: 'warn' });
      S.push({ ...A.set({ k3: 'gone', k0: 'bad' }, { k0: 'evicted (idle 9m)' }), run: st(0.98, '2'), t: 'Next victim: <code>product:42</code>. Its next read becomes a miss and goes to the database. That is fine for a cache.', cls: 'warn' });
      S.push({ ...A.set({ k0: 'gone', k1: 'bad', k2: 'bad' }, { k1: 'evicted', k2: 'evicted' }), run: st(0.99, '4'), t: 'Eviction continues through the keys with a TTL…', cls: 'warn' });
      S.push({ fly: ['app', 'k4'], ...A.set({ k1: 'gone', k2: 'gone', app: 'bad', k4: 'bad', k5: 'bad', k6: 'bad', k7: 'bad' }, { app: 'OOM command not allowed' }), run: st(1.0, '4'), t: '…until only keys <b>without a TTL</b> are left. Nothing is evictable, so every write fails with <b>OOM</b>. Reads still work, which makes it look like a partial outage.', cls: 'err' });
      S.push({ ...A.set({ app: 'ok', k4: 'ok', k5: 'ok', k6: 'ok', k7: 'ok' }, { app: 'writes OK', k4: 'TTL 7d', k5: 'TTL 7d', k6: 'TTL 7d', k7: 'TTL 7d' }), run: st(0.8, '…'), t: 'Fix: give every key a TTL (in Spring, set <code>entryTtl</code>; for others, <code>SET … EX</code>), or use <code>allkeys-lru</code>/<code>allkeys-lfu</code> on a pure cache. Alert on used memory before it reaches 100%.', cls: 'ok' });
      return S;
    }
    S.push({ ...A.set({}, { s1: 'user:7 (slot 2780)', s2: 'cart:42:items (6635)', s3: 'cart:42:total (11155)' }), t: 'A cluster with three shards. Each owns a range of the <b>16,384 slots</b>. A key’s slot is CRC16(key) mod 16384, so related-looking keys can land on different shards.' });
    S.push({ fly: ['app', 's2'], ...A.set({ app: 'hot', s2: 'ok', es2: 'ok' }), t: '<code>GET cart:42:items</code>: the cluster-aware client computes slot 6635 and sends it straight to shard 2.', cls: 'ok' });
    S.push({ fly: ['app', 's2'], ...A.set({ s2: 'bad', s3: 'bad', es2: 'bad', es3: 'bad', app: 'bad' }, { app: 'CROSSSLOT error' }), t: '<code>MGET cart:42:items cart:42:total</code> needs two slots on two shards. Redis refuses with <b>CROSSSLOT</b>. The same applies to <code>MULTI</code> transactions and Lua scripts.', cls: 'err' });
    S.push({ fly: ['app', 's3'], ...A.set({ s2: '', es2: '', s3: 'ok', es3: 'ok', app: 'ok' }, { app: 'MGET OK', s2: '—', s3: '{cart:42}:items, :total (15749)' }), t: 'Rename the keys with a <b>hash tag</b>: <code>{cart:42}:items</code> and <code>{cart:42}:total</code>. Only “cart:42” is hashed, so both land in slot 15749 and multi-key commands work.', cls: 'ok' });
    S.push({ ...A.set({ s3: 'bad', es3: 'bad', gs3: 'bad' }, { s3: 'primary failed' }), t: 'Shard 3’s primary fails (or is patched).', cls: 'err' });
    S.push({ ...A.set({ s3r: 'ok', eRs3: 'ok' }, { s3r: 'promoted to primary' }), t: 'Its replica is promoted. Replication is asynchronous, so a write acknowledged just before the failure can be lost; don’t use the cache as the system of record.', cls: 'warn' });
    S.push({ fly: ['app', 's3r'], ...A.set({ gs3: '', app: 'ok' }, { app: 'topology refreshed' }), t: 'The client gets <code>MOVED</code> or timeouts until it refreshes the slot map. Enable Lettuce’s <b>adaptive topology refresh</b>, so it re-reads the map on redirects and reconnects quickly.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ aside: '@Cacheable in front of Postgres. Press Play.', evict: 'Memory is filling up. Press Play to watch volatile-lru choose victims.', cluster: 'Three shards, 16,384 slots. Press Play.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr, stats);
  const reset = makeStepper(plan, intro, build, 2800);
  reset();
});
