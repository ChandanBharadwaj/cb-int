/* Cosmos DB partitioning: requests hashed to physical partitions with an equal RU share; skewed vs high-cardinality vs hierarchical keys, plus the change feed processor with leases. */
IA.widget('cosmos-db', (root, ctx) => {
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
  let mode = 'tenant';
  const stage = svg('svg', { viewBox: '0 0 640 340', role: 'img', 'aria-label': 'Requests hashed by partition key to four physical partitions with RU budgets' });
  const segM = seg([['tenant', '/tenantId (skewed)'], ['cust', '/customerId'], ['hier', '/tenantId + /customerId'], ['feed', 'Change feed']], mode, (v) => { mode = v; reset(); }, 'Partition key');
  const stats = el('div', { class: 'w-stats' });
  const stat = (pairs) => { stats.innerHTML = ''; pairs.forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: `${k} <b>${v}</b>` }))); };
  const BUD = 5000; const BX = 310; const BW = 300; const MAXRU = 10000;
  const bars = [];
  function setLoad(arr) {
    arr.forEach((v, i) => {
      const w = Math.min(BW, (Math.min(v, MAXRU) / MAXRU) * BW);
      bars[i].setAttribute('width', reduced ? w : w);
      bars[i].setAttribute('fill', v > BUD ? 'var(--err)' : v > BUD * 0.8 ? 'var(--warn)' : 'var(--ok)');
    });
    const used = arr.reduce((a, b) => a + Math.min(b, BUD), 0); const thr = arr.reduce((a, b) => a + Math.max(0, b - BUD), 0);
    stat([['provisioned', '20,000 RU/s'], ['per partition', '5,000 RU/s'], ['served', used.toLocaleString('en-US') + ' RU/s'], ['throttled (429)', thr.toLocaleString('en-US') + ' RU/s']]);
  }
  function build() {
    stage.innerHTML = ''; clearZ(); bars.length = 0;
    const e = svg('g'); const g = svg('g'); const b = svg('g');
    if (mode !== 'feed') {
      node(g, 'app', 10, 136, 150, 62, 'orders-api', 'writes + queries');
      node(g, 'hash', 182, 136, 100, 62, 'hash(pk)', 'gateway / SDK');
      hlink(e, 'eA', 'app', 'hash');
      [0, 1, 2, 3].forEach((i) => {
        node(g, 'p' + i, 300, 12 + i * 82, 330, 68, 'Physical partition ' + (i + 1), 'idle');
        hlink(e, 'e' + i, 'hash', 'p' + i);
        b.append(svg('rect', { x: BX, y: 12 + i * 82 + 52, width: BW, height: 9, rx: 4, fill: 'var(--surface-2)', stroke: 'var(--border)' }));
        const r = svg('rect', { class: 'bar', x: BX, y: 12 + i * 82 + 52, width: 0, height: 9, rx: 4, fill: 'var(--ok)' }); b.append(r); bars.push(r);
        b.append(svg('line', { x1: BX + BW / 2, y1: 12 + i * 82 + 48, x2: BX + BW / 2, y2: 12 + i * 82 + 65, stroke: 'var(--text-3)', 'stroke-dasharray': '3 2' }));
      });
      stage.append(e, g, b, pkt);
      setLoad([0, 0, 0, 0]);
    } else {
      node(g, 'app', 10, 14, 170, 56, 'orders-api', 'upserts orders');
      node(g, 'p0', 10, 120, 170, 64, 'Partition A', 'feed: —');
      node(g, 'p1', 10, 220, 170, 64, 'Partition B', 'feed: —');
      node(g, 'lease', 236, 14, 170, 56, 'leases container', 'checkpoints');
      node(g, 'iA', 236, 120, 170, 64, 'processor #1', 'owns lease A');
      node(g, 'iB', 236, 220, 170, 64, 'processor #2', 'owns lease B');
      node(g, 'out', 462, 120, 168, 64, 'AI Search index', 'read model');
      node(g, 'del', 462, 220, 168, 64, 'deleteItem()', 'not in feed');
      link(e, 'eW0', 'app', 'p0'); edge(e, 'eW1', 'M40 70 C 0 150, 0 200, 40 220');
      hlink(e, 'eA', 'p0', 'iA'); hlink(e, 'eB', 'p1', 'iB'); hlink(e, 'eO', 'iA', 'out'); edge(e, 'eO2', 'M406 252 C 440 252, 430 160, 462 152');
      link(e, 'eL', 'lease', 'iA'); edge(e, 'eX', 'M321 184 L 321 220');
      edge(e, 'eAB', 'M236 252 C 200 252, 200 152, 236 152');
      stage.append(e, g, pkt);
      stat([['ordering', 'per partition key'], ['delivery', 'at-least-once'], ['deletes', 'not in latest-version mode']]);
    }
  }
  function plan() {
    const A = cum(); const S = [];
    const pc = (loads, labels) => { const c = {}; const sb = {}; loads.forEach((v, i) => { c['p' + i] = v > BUD ? 'bad' : v > BUD * 0.8 ? 'warn' : v > 0 ? 'ok' : ''; sb['p' + i] = labels[i]; }); return [c, sb]; };
    if (mode === 'tenant') {
      S.push({ ...A.set({}), t: 'Key = <code>/tenantId</code>. 20,000 RU/s provisioned, so each of the 4 physical partitions gets <b>5,000 RU/s</b> (the dashed line). Tenant “contoso” is a big enterprise customer.' });
      let [c, sb] = pc([600, 900, 700, 500], ['tenants fabrikam, …', 'tenant contoso + others', 'tenants adatum, …', 'tenants tailspin, …']);
      S.push({ fly: ['app', 'hash', 'p1'], ...A.set({ ...c, eA: 'hot' }, sb), run: () => setLoad([600, 900, 700, 500]), t: 'Quiet hours: hash(“contoso”) lands in partition 2, along with other tenants. All partitions are well under budget.' });
      [c, sb] = pc([1100, 9800, 1300, 900], ['1,100 RU/s', 'contoso: 9,800 RU/s', '1,300 RU/s', '900 RU/s']);
      S.push({ fly: ['app', 'hash', 'p1'], ...A.set({ ...c, e1: 'bad' }, sb), run: () => setLoad([1100, 9800, 1300, 900]), t: 'Peak: contoso sends most of the traffic. Every one of its requests hashes to the <b>same physical partition</b>, which can only serve 5,000 RU/s. The rest gets <b>HTTP 429</b>.', cls: 'err' });
      S.push({ ...A.set({}), t: 'The account uses about 8,300 of 20,000 RU/s and still throttles. Doubling to 40,000 RU/s would split partitions, but contoso is <b>one logical partition</b> and stays on one physical partition. It would also hit the 20 GB logical-partition limit eventually.', cls: 'err' });
      return S;
    }
    if (mode === 'cust') {
      S.push({ ...A.set({}), t: 'Key = <code>/customerId</code>: millions of distinct values. Contoso’s orders are now spread over many logical partitions, and so over every physical partition.' });
      let [c, sb] = pc([3200, 3300, 3100, 3300], ['3,200 RU/s', '3,300 RU/s', '3,100 RU/s', '3,300 RU/s']);
      S.push({ fly: ['app', 'hash', 'p0', 'p1', 'p2', 'p3'], ms: 1500, ...A.set({ ...c, eA: 'hot', e0: 'ok', e1: 'ok', e2: 'ok', e3: 'ok' }, sb), run: () => setLoad([3200, 3300, 3100, 3300]), t: 'The same peak traffic, about 13,000 RU/s, is spread evenly. <b>No 429s</b>, with headroom left on every partition.', cls: 'ok' });
      S.push({ fly: ['app', 'hash', 'p2'], ...A.set({ p2: 'hot', e0: 'dim', e1: 'dim', e3: 'dim' }, { p2: 'point read: 1 partition' }), t: '“Orders for customer 42” includes the partition key, so it goes to <b>one</b> partition. A point read by id + key costs about 1 RU per KB.', cls: 'ok' });
      [c, sb] = pc([3200, 3300, 3100, 3300], ['queried', 'queried', 'queried', 'queried']);
      S.push({ fly: ['app', 'hash', 'p0', 'p1', 'p2', 'p3'], ms: 1500, ...A.set({ p0: 'warn', p1: 'warn', p2: 'warn', p3: 'warn', e0: 'warn', e1: 'warn', e2: 'warn', e3: 'warn' }, sb), t: 'But “all OPEN orders for tenant contoso” has no customerId, so it <b>fans out</b> to every physical partition. The RU cost grows with the number of partitions, which grows with your data.', cls: 'warn' });
      return S;
    }
    if (mode === 'hier') {
      S.push({ ...A.set({}), t: '<b>Hierarchical partition key</b>: <code>/tenantId</code> then <code>/customerId</code>. Items are placed by the full key path, so one tenant can span several physical partitions, and the 20 GB limit applies per full key value instead of per tenant.' });
      let [c, sb] = pc([3000, 4200, 3900, 1900], ['small tenants', 'contoso (part)', 'contoso (part)', 'small tenants']);
      S.push({ fly: ['app', 'hash', 'p1', 'p2'], ms: 1300, ...A.set({ ...c, eA: 'hot', e1: 'ok', e2: 'ok' }, sb), run: () => setLoad([3000, 4200, 3900, 1900]), t: 'Contoso’s peak is split across partitions 2 and 3. Everything stays under budget.', cls: 'ok' });
      S.push({ fly: ['app', 'hash', 'p1', 'p2'], ms: 1300, ...A.set({ e0: 'dim', e3: 'dim', p0: 'dim', p3: 'dim' }, { p1: 'tenant query', p2: 'tenant query' }), t: 'A query with only <code>tenantId = "contoso"</code> (a key <b>prefix</b>) goes to just the partitions that hold contoso, not to all of them.', cls: 'ok' });
      S.push({ fly: ['app', 'hash', 'p2'], ...A.set({ p1: '', e1: 'dim' }, { p1: 'contoso (part)', p2: 'point read' }), t: 'A point read with the full key path (tenant + customer + id) still costs about 1 RU. Hierarchical keys must be chosen when the container is created; moving to them means copying into a new container.', cls: 'ok' });
      return S;
    }
    S.push({ ...A.set({ iB: '', del: 'dim', eAB: 'dim', eX: 'dim' }), t: 'The <b>change feed</b> is a persistent log of inserts and updates, kept per partition. Two processor instances share a <b>processor name</b>, and a lease container records which instance owns which feed range.' });
    S.push({ fly: ['app', 'p0'], ...A.set({ p0: 'hot', eW0: 'hot' }, { p0: 'feed: o1 v1, o1 v2' }), t: 'The app upserts order o1 twice. Both versions are appended to partition A’s feed, <b>in order</b>. Order is guaranteed per partition key value, not across the container.' });
    S.push({ fly: ['p0', 'iA', 'out'], ...A.set({ iA: 'ok', eA: 'ok', eO: 'ok', out: 'ok' }, { out: 'o1 = v2' }), t: 'Processor #1 reads a batch from partition A, upserts the search index, then writes a <b>checkpoint</b> to its lease.', cls: 'ok' });
    S.push({ fly: ['app', 'p1'], ...A.set({ p1: 'hot', eW1: 'hot', iB: 'hot', eB: 'hot' }, { p1: 'feed: o7 v1' }), t: 'Order o7 lands in partition B. Processor #2 starts its batch…' });
    S.push({ ...A.set({ iB: 'bad', eB: 'bad' }, { iB: 'crashed mid-batch' }), t: '…and crashes before checkpointing. Its lease stops being renewed.', cls: 'err' });
    S.push({ fly: ['p1', 'iA', 'out'], ...A.set({ iA: 'warn', eAB: 'warn', eO: 'ok', p1: 'ok' }, { iA: 'owns leases A + B', out: 'o1 v2, o7 v1' }), t: 'Processor #1 acquires the expired lease and resumes partition B from the <b>last checkpoint</b>, so o7 may be processed twice. Delivery is at-least-once: make the handler idempotent (upsert by id, compare versions).', cls: 'warn' });
    S.push({ fly: ['app', 'del'], ...A.set({ del: 'bad', out: 'bad' }, { out: 'still shows o9!' }), t: 'Someone calls <code>deleteItem(o9)</code>. In the default <b>latest version</b> mode the feed never sees deletes, so the search index keeps o9. Soft-delete with a <code>ttl</code> instead, or use the all-versions-and-deletes mode.', cls: 'err' });
    return S;
  }
  const intro = () => ({ tenant: 'A skewed key. Press Play and watch one partition saturate.', cust: 'A high-cardinality key. Press Play.', hier: 'A hierarchical key. Press Play.', feed: 'The change feed processor. Press Play.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr, stats);
  const reset = makeStepper(plan, intro, build, 2800);
  reset();
});
