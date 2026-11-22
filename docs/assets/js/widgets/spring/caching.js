/* Caching abstraction: concurrent requests through the CacheInterceptor; hit/miss, TTL stampede, sync=true, evict-before-commit race, self-invocation. */
IA.widget('caching', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-ca-style')) {
    document.head.append(el('style', { id: 'w-ca-style', text: `
.w-ca svg text { font-family: var(--mono); }
.w-ca .col { fill: var(--surface); stroke: var(--border); stroke-width: 1.6; transition: stroke .3s, fill .3s; }
.w-ca .col.hot { stroke: var(--accent); stroke-width: 2.4; fill: var(--accent-soft); }
.w-ca .col.bad { stroke: var(--err); stroke-width: 2.4; fill: color-mix(in srgb, var(--err) 10%, var(--surface)); }
.w-ca .col.ok { stroke: var(--ok); stroke-width: 2.2; }
.w-ca .tk { stroke: var(--surface); stroke-width: 2.5; fill: var(--accent); transition: transform .6s ease, fill .3s; }
.w-ca .tk.ok { fill: var(--ok); } .w-ca .tk.w { fill: var(--warn); } .w-ca .tk.K { fill: var(--warn); }
` }));
  }
  const COLX = { s: 56, p: 228, c: 404, h: 404, w: 456, d: 628, k: 56, K: 56 };
  const SC = {
    hit: { label: 'miss, then hit', lanes: ['R1 find(42)', 'R2 find(42)'], intro: '<code>@Cacheable("products") Product find(long id)</code>, Caffeine, empty cache.',
      steps: [
        { t: 'p.', hi: { p: 'hot' }, say: 'R1 enters the proxy. <code>CacheInterceptor</code> builds the key with <code>SimpleKeyGenerator</code>: one argument, so the key is just <code>42</code>.' },
        { t: 'c.', hi: { c: 'bad' }, say: 'Lookup in cache <code>products</code>: <b>miss</b>.' },
        { t: 'd.', hi: { d: 'hot' }, q: 1, say: 'Your method runs: the repository issues <code>SELECT … WHERE id = 42</code>.' },
        { t: 'k.', hi: { c: 'ok' }, q: 1, cache: ['42', 'Product(42, €10)', 'ok'], say: 'On the way back the interceptor <b>puts</b> the result under key 42 (unless <code>unless</code> vetoes it) and returns it.' },
        { t: 'kp', hi: { p: 'hot' }, q: 1, cache: ['42', 'Product(42, €10)', 'ok'], say: 'R2 asks for the same id. Same key.' },
        { t: 'kh', hi: { c: 'ok' }, q: 1, cache: ['42', 'Product(42, €10)', 'ok'], tone: 'ok', say: '<b>Hit.</b> The interceptor returns the cached object and never calls your method: no query, no code in <code>find()</code> runs (so no logging or metrics you put there either).' },
        { t: 'kk', q: 1, cache: ['42', 'Product(42, €10)', 'ok'], tone: 'ok', say: 'Two calls, one query. With Caffeine, R1 and R2 received the <b>same instance</b>: if either mutates it, the cache changes.' }] },
    stampede: { label: 'TTL expiry stampede', lanes: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'], intro: 'A hot key (<code>pricingRules:EU</code>) has just expired. Six requests arrive in the same millisecond; the query takes 800 ms.',
      steps: [
        { t: 'pppppp', hi: { p: 'hot' }, cache: ['EU', '(expired)', 'bad'], say: 'All six enter the interceptor at once.' },
        { t: 'cccccc', hi: { c: 'bad' }, cache: ['EU', '(expired)', 'bad'], say: 'All six look up the key and all six <b>miss</b>: nobody has reloaded it yet.' },
        { t: 'dddddd', hi: { d: 'bad' }, q: 6, cache: ['EU', '(expired)', 'bad'], tone: 'err', say: 'All six run the expensive query in parallel. On one pod that is 6×; on 24 pods it is 144 identical queries hitting the database in the same second, which slows each of them down further.' },
        { t: 'kkkkkk', hi: { c: 'ok' }, q: 6, cache: ['EU', 'Rules(v7) ×6 puts', 'ok'], tone: 'warn', say: 'Each one puts the same value; the last write wins. The cache is fine again, but the database took a spike. Fixed TTLs make it repeat on a schedule.' }] },
    sync: { label: 'sync = true', lanes: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'], intro: 'Same expiry, now with <code>@Cacheable(cacheNames = "pricingRules", sync = true)</code>.',
      steps: [
        { t: 'cccccc', hi: { c: 'bad' }, cache: ['EU', '(expired)', 'bad'], say: 'All six miss…' },
        { t: 'dwwwww', hi: { d: 'hot', c: 'hot' }, q: 1, cache: ['EU', '(loading… locked)', 'hot'], say: '…but the lookup is done through the cache’s own “get or compute” (Caffeine <code>get(key, loader)</code>). R1 computes; R2–R6 <b>wait</b> on the same key instead of querying.' },
        { t: 'khhhhh', hi: { c: 'ok' }, q: 1, cache: ['EU', 'Rules(v7)', 'ok'], tone: 'ok', say: 'R1’s result is stored and handed to the waiters. <b>One query.</b>' },
        { t: 'kkkkkk', q: 1, cache: ['EU', 'Rules(v7)', 'ok'], tone: 'warn', say: 'The lock is per JVM: 24 pods still means up to 24 loads. Combine with <code>refreshAfterWrite</code> (reload in the background before expiry) and TTL jitter. Note: <code>sync</code> can’t be combined with <code>unless</code>.' }] },
    race: { label: 'evict before commit', lanes: ['T1 reprice(7, €12)', 'R  find(7)'], intro: '<code>@Transactional @CacheEvict(key = "#id") reprice()</code>. The cache holds the current price, €10.',
      steps: [
        { t: 'd.', hi: { d: 'hot' }, cache: ['7', 'Product(7, €10)', 'ok'], db: ['committed: €10', 'T1 pending: €12'], q: 0, say: 'T1 runs <code>UPDATE product SET price = 12 WHERE id = 7</code>. Not committed yet: other transactions still see €10.' },
        { t: 'p.', hi: { p: 'hot', c: 'bad' }, cache: null, db: ['committed: €10', 'T1 pending: €12'], q: 0, log: 'T1: method returned → @CacheEvict products::7', say: '<code>reprice()</code> returns. The cache interceptor evicts key 7 <b>now</b>; the transaction commits only when the outer transactional proxy finishes.' },
        { t: 'pc', hi: { c: 'bad' }, cache: null, db: ['committed: €10', 'T1 pending: €12'], q: 0, say: 'In that gap, reader R misses…' },
        { t: 'pd', hi: { d: 'hot' }, cache: null, db: ['committed: €10', 'T1 pending: €12'], q: 1, say: '…and reads the row. It sees the last <b>committed</b> version: €10.' },
        { t: 'pK', hi: { c: 'bad' }, cache: ['7', 'Product(7, €10) ← old', 'bad'], db: ['committed: €10', 'T1 pending: €12'], q: 1, tone: 'warn', log: 'R: put products::7 = €10', say: 'R puts €10 back into the cache.' },
        { t: 'kK', hi: { d: 'ok', c: 'bad' }, cache: ['7', 'Product(7, €10) ← stale', 'bad'], db: ['committed: €12', ''], q: 1, tone: 'err', log: 'T1: COMMIT (price €12) · cache still €10 until TTL', logc: 'e', say: 'T1 commits €12. The cache serves <b>€10 until the TTL</b>. Fix: a transaction-aware cache manager defers the evict until after commit (<code>RedisCacheManager…transactionAware()</code> or <code>TransactionAwareCacheManagerProxy</code>).' }] },
    self: { label: 'self-invocation', lanes: ['many([1, 1, 1])'], intro: '<code>many(ids)</code> (not cached) calls <code>this.find(id)</code> (<code>@Cacheable</code>) for each id.',
      steps: [
        { t: 'p', hi: { p: 'hot' }, say: 'The controller calls <code>many()</code> through the proxy. No caching annotation on it, so the interceptor just proceeds.' },
        { t: 'd', hi: { d: 'hot', p: '', c: '' }, q: 1, log: 'this.find(1) → SELECT', say: 'Inside the target, <code>this.find(1)</code> is a plain Java call. It never re-enters the proxy, so the cache is never consulted.' },
        { t: 'd', hi: { d: 'hot' }, q: 2, log: 'this.find(1) → SELECT', say: 'Same id again: another query.' },
        { t: 'd', hi: { d: 'bad' }, q: 3, log: 'this.find(1) → SELECT', tone: 'err', say: 'And again. The cache stays empty forever.' },
        { t: 'k', hi: { c: 'bad' }, q: 3, tone: 'err', say: 'Three queries, zero cache entries. Move <code>find()</code> to another bean (or call it from the controller), exactly as with <code>@Transactional</code>.' }] }
  };
  let sc = 'hit'; let k = 0; let gen = 0; let running = false; let speed = 2200; let st;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(SC).map((x) => [x, SC[x].label]), sc, (v) => { sc = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3400, 'Slow'], [2200, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 284', role: 'img', 'aria-label': 'Requests in lanes passing the cache interceptor, the cache and the repository' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-log', 'aria-label': 'Log' });
  root.classList.add('w-ca');
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, log);
  const tokens = []; let lastSc = null;
  function laneY(i, n) { const top = 48; const h = 132; return n === 1 ? top + h / 2 : top + 12 + i * ((h - 24) / (n - 1)); }
  function render() {
    const S = SC[sc]; const n = S.lanes.length; const hi = st.hi || {};
    // static part (rebuilt; tokens kept for transitions)
    [...stage.querySelectorAll('.static')].forEach((x) => x.remove());
    const g = svg('g', { class: 'static' });
    const col = (id, x, w, title, sub) => { g.append(svg('rect', { class: 'col ' + (hi[id] || ''), x, y: 30, width: w, height: 160, rx: 12 }), svg('text', { x: x + w / 2, y: 22, 'font-size': 12, 'font-weight': 700, 'text-anchor': 'middle', fill: 'var(--text)', text: title }));
      if (sub) g.append(svg('text', { x: x + w / 2, y: 206, 'font-size': 10.5, 'text-anchor': 'middle', fill: 'var(--text-3)', text: sub })); };
    col('p', 160, 136, 'proxy', 'CacheInterceptor');
    col('c', 340, 160, 'cache "products"', sc === 'stampede' || sc === 'sync' ? 'pricingRules · Caffeine' : 'Caffeine / Redis');
    col('d', 548, 160, 'your method → DB', 'repository');
    S.lanes.forEach((l, i) => g.append(svg('text', { x: 6, y: laneY(i, n) - 13, 'font-size': 10.5, fill: 'var(--text-3)', text: l })));
    const c = st.cache;
    g.append(svg('rect', { x: 340, y: 222, width: 160, height: 50, rx: 7, fill: 'var(--surface-2)', stroke: c ? (c[2] === 'ok' ? 'var(--ok)' : c[2] === 'bad' ? 'var(--err)' : 'var(--accent)') : 'var(--border)' }));
    g.append(svg('text', { x: 350, y: 240, 'font-size': 10.5, fill: 'var(--text-3)', text: c ? 'key ' + c[0] : '(no entry)' }));
    if (c) g.append(svg('text', { x: 350, y: 260, 'font-size': 10.5, 'font-weight': 700, fill: c[2] === 'bad' ? 'var(--err)' : 'var(--text)', text: c[1].length > 23 ? c[1].slice(0, 23) + '…' : c[1] }));
    g.append(svg('rect', { x: 548, y: 222, width: 160, height: 50, rx: 7, fill: 'var(--surface-2)', stroke: (st.q || 0) > 2 ? 'var(--err)' : 'var(--border)' }),
      svg('text', { x: 558, y: 240, 'font-size': 10.5, fill: (st.q || 0) > 2 ? 'var(--err)' : 'var(--text)', 'font-weight': 700, text: `queries: ${st.q || 0}` }));
    (st.db || []).filter(Boolean).forEach((t, j) => g.append(svg('text', { x: 640 + 0, y: 240 + j * 16, 'font-size': 10, fill: j ? 'var(--warn)' : 'var(--text-2)', text: t.replace('committed: ', 'db ').replace('T1 pending: ', 'T1 ') })));
        stage.prepend(g);
    // tokens
    if (lastSc !== sc) { tokens.forEach((t) => t.remove()); tokens.length = 0; lastSc = sc; }
    while (tokens.length < n) { const t = svg('circle', { class: 'tk', r: 9, cx: 0, cy: 0 }); tokens.push(t); stage.append(t); }
    const codes = st.t || 's'.repeat(n);
    tokens.forEach((t, i) => { const ch = codes[i] || '.'; const vis = ch !== '.';
      t.style.opacity = vis ? 1 : 0; t.setAttribute('class', 'tk ' + (ch === 'k' || ch === 'h' ? 'ok' : ch === 'w' ? 'w' : ch === 'K' ? 'K' : ''));
      if (reduced) t.style.transition = 'none';
      t.style.transform = `translate(${COLX[ch] || COLX.s}px, ${laneY(i, n)}px)`; });
    log.innerHTML = ''; st.log.forEach(([tt, cl]) => log.append(el('div', { text: tt, style: { color: cl === 'e' ? 'var(--err)' : cl === 'o' ? 'var(--ok)' : '' } }))); log.scrollTop = log.scrollHeight;
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${SC[sc].steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; const S = SC[sc]; st = { log: [], t: 's'.repeat(S.lanes.length), cache: sc === 'hit' || sc === 'self' ? null : S.steps[0].cache, q: 0 }; render(); say(S.intro); bStep.disabled = false; }
  function step() {
    const steps = SC[sc].steps; if (k >= steps.length) return false; const s = steps[k++];
    const logs = st.log; st = Object.assign({ q: st.q }, s, { log: logs });
    if (!('cache' in s)) st.cache = null;
    if (s.log) logs.push([s.log, s.logc]);
    render(); say(s.say, s.tone);
    if (k >= steps.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= SC[sc].steps.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
