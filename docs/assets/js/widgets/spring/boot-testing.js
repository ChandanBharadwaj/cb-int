/* Boot testing: the TestContext cache. Test classes compute a key; hits reuse a context, misses build one (and a Hikari pool). Third suite: a cached context outlives its class-scoped container. */
IA.widget('boot-testing', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const SUITES = {
    messy: { label: 'Messy suite', classes: [
      { n: 'OrderApiIT', a: ['@SpringBootTest', '@MockitoBean Pay'], key: 'K1' },
      { n: 'RefundApiIT', a: ['@SpringBootTest', '@MockitoBean Pay', '@MockitoBean Mail'], key: 'K2' },
      { n: 'ReportIT', a: ['@SpringBootTest', '@ActiveProfiles("report")'], key: 'K3' },
      { n: 'InventoryIT', a: ['@SpringBootTest(properties = "flag.x=true")'], key: 'K4' },
      { n: 'CheckoutIT', a: ['@SpringBootTest', '@MockitoBean Pay', '@DirtiesContext'], key: 'K1', dirty: true },
      { n: 'OrderSearchIT', a: ['@SpringBootTest', '@MockitoBean Pay'], key: 'K1' }] },
    tidy: { label: 'Tidy suite (shared base class)', classes: [
      { n: 'OrderApiIT', a: ['extends AbstractIT'], key: 'K1' },
      { n: 'RefundApiIT', a: ['extends AbstractIT'], key: 'K1' },
      { n: 'ReportIT', a: ['extends AbstractIT'], key: 'K1' },
      { n: 'InventoryIT', a: ['extends AbstractIT'], key: 'K1' },
      { n: 'CheckoutIT', a: ['extends AbstractIT'], key: 'K1' },
      { n: 'OrderSearchIT', a: ['extends AbstractIT'], key: 'K1' }] },
    tc: { label: 'Container per class (trap)', classes: [
      { n: 'OrderApiIT', a: ['extends AbstractIT', '@Container static pg'], key: 'K1', tc: true },
      { n: 'RefundApiIT', a: ['extends AbstractIT', '@Container static pg'], key: 'K1', tc: true },
      { n: 'ReportIT', a: ['extends AbstractIT', '@Container static pg'], key: 'K1', tc: true }] }
  };
  const KEYTXT = {
    K1: 'Boot app + mocks{Payment}', K2: 'Boot app + mocks{Payment, Email}', K3: 'Boot app + profile report', K4: 'Boot app + props{flag.x}'
  };
  // ---- build frames by simulating the cache ----
  function frames(id) {
    const S = SUITES[id]; const F = []; const cache = []; let built = 0; let hits = 0; let secs = 0;
    const st = S.classes.map(() => 'wait');
    const snap = (cur, cap, tone, extra) => F.push(Object.assign({ cur, cap, tone, st: st.slice(), cache: cache.map((c) => Object.assign({}, c)), built, hits, secs }, extra || {}));
    const live = () => cache.filter((c) => c.state !== 'closed');
    snap(-1, id === 'tidy' ? 'Every class extends <code>AbstractIT</code>, which declares <b>all</b> the mocks, the profile and the container once. Press Play.'
      : id === 'tc' ? 'Each class inherits a <code>static @Container @ServiceConnection</code> field under JUnit’s <code>@Testcontainers</code> extension. The JUnit extension starts the container before a class and stops it after. Press Play.'
      : 'Six integration test classes, each with slightly different annotations. Press Play and watch the key each one computes.');
    let pgUp = false; let port = 55021;
    S.classes.forEach((c, i) => {
      st[i] = 'run';
      if (c.tc) { pgUp = true; port = 55021 + i * 7; snap(i, `JUnit starts <b>${c.n}</b>’s container: Postgres on <code>localhost:${port}</code>.`, null, { pg: 'up', port }); }
      snap(i, `<b>${c.n}</b> asks for a context. Key = <code>${KEYTXT[c.key]}</code>.`, null, c.tc ? { pg: 'up', port } : null);
      const hit = cache.find((x) => x.key === c.key && x.state !== 'closed');
      if (hit) {
        hit.hits++; hits++; hit.state = 'hot';
        if (c.tc && hit.port !== port) {
          st[i] = 'fail';
          snap(i, `<b>Cache hit</b>, so no startup. But this context’s DataSource still points at <code>localhost:${hit.port}</code>, the container JUnit <b>stopped</b> after the previous class. <code>Connection refused</code>.`, 'err', { pg: 'up', port, stale: hit.port });
        } else {
          st[i] = 'ok';
          snap(i, `<b>Cache hit</b> on ctx #${hit.id}. No Spring startup, no new pool: the test starts in milliseconds.`, 'ok', c.tc ? { pg: 'up', port } : null);
        }
        hit.state = 'live';
      } else {
        built++; secs += 8;
        const nc = { id: built, key: c.key, hits: 0, state: 'new', port: c.tc ? port : null };
        cache.push(nc);
        snap(i, `<b>Miss.</b> Build ctx #${nc.id}: scan, create every bean, run Flyway, open a Hikari pool (10 connections by default). Live contexts now hold <b>${live().length * 10}</b> Postgres connections.`, 'warn', c.tc ? { pg: 'up', port } : null);
        nc.state = 'live'; st[i] = 'ok';
      }
      if (c.dirty) {
        const x = cache.find((y) => y.key === c.key && y.state === 'live'); x.state = 'closed';
        snap(i, `<code>@DirtiesContext</code>: after <b>${c.n}</b>, ctx #${x.id} is closed and evicted. Its pool closes too, and the next class with the same key must build it again.`, 'warn');
      }
      if (c.tc) { pgUp = false; snap(i, `After <b>${c.n}</b>, JUnit stops the container. The cached Spring context is <b>still alive</b>, holding a pool pointed at a dead port.`, st[i] === 'fail' ? 'err' : 'warn', { pg: 'down', port }); }
    });
    const last = id === 'tidy' ? 'One context for six classes: one startup, one pool. This is what a fast suite looks like.'
      : id === 'tc' ? 'Fix: declare the container as a <code>@Bean @ServiceConnection</code> in a <code>@TestConfiguration</code> (Boot 3.1+), so it lives exactly as long as the context. Or start a singleton container in a static initializer and never stop it.'
      : `Done: ${built} contexts built for 6 classes. Unify the mocks, profile and properties in a base class, and drop <code>@DirtiesContext</code>.`;
    snap(-1, last, id === 'tc' ? 'err' : id === 'tidy' ? 'ok' : 'warn', id === 'tc' ? { pg: 'down' } : null);
    void pgUp;
    return F;
  }

  // ---- controls ----
  let suite = 'messy'; let F = frames(suite); let k = 0; let gen = 0; let running = false; let speed = 2400;
  const mkSeg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSuite = mkSeg(Object.keys(SUITES).map((s) => [s, SUITES[s].label]), suite, (v) => { suite = v; F = frames(v); reset(); }, 'Test suite');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = mkSeg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const W = 680; const H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Test classes on the left, the context cache on the right, Postgres connections at the bottom' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segSuite), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text: t }, o || {}));
  function draw(f) {
    stage.innerHTML = '';
    const cls = SUITES[suite].classes;
    stage.append(T(12, 20, 'Test classes (run order)', { 'font-weight': 700, 'font-size': 13 }), T(400, 20, 'Context cache (static, per JVM)', { 'font-weight': 700, 'font-size': 13 }));
    const rh = cls.length > 4 ? 40 : 52;
    cls.forEach((c, i) => {
      const y = 32 + i * rh; const s = f.st[i]; const cur = f.cur === i;
      const stroke = s === 'fail' ? 'var(--err)' : cur ? 'var(--accent)' : s === 'ok' ? 'var(--ok)' : 'var(--border)';
      stage.append(svg('rect', { x: 10, y, width: 360, height: rh - 6, rx: 7, fill: cur ? 'var(--accent-soft)' : 'var(--surface)', stroke, 'stroke-width': cur || s === 'fail' ? 2 : 1 }));
      stage.append(T(20, y + 15, c.n, { 'font-weight': 700, 'font-family': 'var(--mono)' }));
      stage.append(T(20, y + 29, c.a.join(' '), { 'font-size': 10.5, fill: 'var(--text-2)', 'font-family': 'var(--mono)' }));
      const badge = s === 'ok' ? '✓' : s === 'fail' ? '✗' : s === 'run' ? '…' : '';
      if (badge) stage.append(T(352, y + 18, badge, { 'font-size': 15, 'font-weight': 700, fill: s === 'fail' ? 'var(--err)' : s === 'ok' ? 'var(--ok)' : 'var(--accent)', 'text-anchor': 'middle' }));
    });
    // cache shelf
    stage.append(svg('rect', { x: 392, y: 30, width: 278, height: 190, rx: 10, fill: 'var(--surface-2)', stroke: 'var(--border)', 'stroke-dasharray': '5 4' }));
    if (!f.cache.length) stage.append(T(531, 125, 'empty', { fill: 'var(--text-3)', 'text-anchor': 'middle' }));
    f.cache.forEach((c, j) => {
      const y = 40 + j * 36; const closed = c.state === 'closed';
      const fill = c.state === 'new' ? 'var(--accent-soft)' : c.state === 'hot' ? 'var(--accent-soft)' : 'var(--surface)';
      const stroke = closed ? 'var(--text-3)' : c.state === 'new' ? 'var(--warn)' : c.state === 'hot' ? 'var(--ok)' : 'var(--border)';
      const g = svg('g', { opacity: closed ? 0.45 : 1 });
      g.append(svg('rect', { x: 400, y, width: 262, height: 30, rx: 6, fill, stroke, 'stroke-width': c.state === 'live' ? 1 : 2 }));
      g.append(T(408, y + 13, `ctx #${c.id}${closed ? ' (closed)' : ''}`, { 'font-weight': 700, 'font-size': 11.5 }));
      g.append(T(408, y + 25, KEYTXT[c.key] + (c.port ? ` · pg :${c.port}` : ''), { 'font-size': 10, fill: 'var(--text-2)', 'font-family': 'var(--mono)' }));
      g.append(T(654, y + 19, `hits ${c.hits}`, { 'font-size': 10.5, fill: 'var(--text-3)', 'text-anchor': 'end' }));
      stage.append(g);
      if (f.cur >= 0 && c.state !== 'live' && !closed) {
        const yy = 32 + f.cur * rh + (rh - 6) / 2;
        const p = svg('path', { d: `M370 ${yy} C 385 ${yy}, 385 ${y + 15}, 400 ${y + 15}`, fill: 'none', stroke: c.state === 'hot' ? 'var(--ok)' : 'var(--warn)', 'stroke-width': 2 });
        if (!reduced) { p.style.strokeDasharray = '80'; p.style.strokeDashoffset = '80'; p.style.transition = 'stroke-dashoffset .6s ease'; requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; }); }
        stage.append(p);
      }
    });
    // Postgres + pools
    const liveCtx = f.cache.filter((c) => c.state !== 'closed');
    const conns = liveCtx.length * 10;
    stage.append(T(392, 240, 'Postgres  (max_connections = 100)', { 'font-weight': 700, 'font-size': 12 }));
    for (let i = 0; i < 100; i++) {
      const x = 392 + (i % 25) * 11; const y = 248 + Math.floor(i / 25) * 11;
      stage.append(svg('rect', { x, y, width: 9, height: 9, rx: 2, fill: i < conns ? 'var(--accent)' : 'var(--surface-2)', stroke: 'var(--border)', 'stroke-width': 0.5 }));
    }
    if (f.pg) {
      const up = f.pg === 'up';
      stage.append(svg('rect', { x: 10, y: 286, width: 360, height: 34, rx: 7, fill: 'var(--surface)', stroke: up ? 'var(--ok)' : 'var(--err)', 'stroke-dasharray': up ? '' : '5 3' }));
      stage.append(T(20, 307, up ? `🐳 postgres:16-alpine  running on :${f.port}` : '🐳 container stopped by JUnit after the class', { fill: up ? 'var(--text)' : 'var(--err)', 'font-family': 'var(--mono)', 'font-size': 11 }));
    }
    if (f.stale) stage.append(T(10, 280, `cached DataSource → :${f.stale} (dead)`, { fill: 'var(--err)', 'font-size': 11.5, 'font-weight': 700 }));
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `contexts built <b>${f.built}</b>` }), el('span', { class: 'w-stat', html: `cache hits <b>${f.hits}</b>` }),
      el('span', { class: 'w-stat', html: `startup time <b>~${f.secs}s</b> <span class="tiny">(illustrative 8s each)</span>` }), el('span', { class: 'w-stat', html: `pooled connections <b>${conns}</b>` }));
  }
  function show() {
    const f = F[k]; draw(f);
    narr.className = 'caption' + (f.tone ? ' ' + f.tone : '');
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k + 1}/${F.length}` }), el('div', { class: 't', html: f.cap }));
    bStep.disabled = k >= F.length - 1;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; show(); }
  bStep.addEventListener('click', () => { gen++; stop(); if (k < F.length - 1) { k++; show(); } });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { gen++; stop(); return; }
    if (k >= F.length - 1) k = 0;
    if (reduced) { k = F.length - 1; show(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen; show();
    while (running && g === gen && k < F.length - 1) { await sleep(speed); if (g !== gen) return; k++; show(); }
    if (g === gen) stop();
  });
  reset();
});
