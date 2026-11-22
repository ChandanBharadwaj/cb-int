/* JPA N+1: ten orders, six distinct customers. Watch the persistence context and the statements Postgres receives for five fetch strategies. */
IA.widget('jpa-n-plus-1', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const ORD = [[101, 1], [102, 2], [103, 1], [104, 3], [105, 4], [106, 2], [107, 5], [108, 1], [109, 6], [110, 3]];
  const NAMES = { 1: 'Asha', 2: 'Ben', 3: 'Chen', 4: 'Dina', 5: 'Emil', 6: 'Farah' };
  const MODES = {
    lazy: { l: 'LAZY + loop (N+1)', code: 'orderRepo.findAll()  →  o.getCustomer().getName()' },
    eager: { l: 'EAGER mapping', code: '@ManyToOne  // default EAGER;  orderRepo.findAll()' },
    fetch: { l: 'join fetch / @EntityGraph', code: '@EntityGraph(attributePaths = "customer")  findAll()' },
    batch: { l: 'default_batch_fetch_size = 16', code: 'LAZY + hibernate.default_batch_fetch_size: 16' },
    dto: { l: 'DTO projection', code: 'select new OrderRow(o.id, o.total, c.name) from Order o join o.customer c' }
  };
  const Q_ORD = 'select o.id, o.customer_id, o.total from orders o';
  const Q_C = (id) => `select c.id, c.name from customer c where c.id = ${id}`;
  function build(m) {
    const F = []; let pc = []; let sql = []; let loop = -1; let printed = [];
    const snap = (cap, tone, extra) => F.push(Object.assign({ pc: pc.slice(), sql: sql.slice(), loop, printed: printed.slice(), cap, tone }, extra || {}));
    snap(`${MODES[m].l}. Ten orders, six distinct customers. Press Play.`);
    if (m === 'fetch') {
      sql.push(['select o.id, o.total, c.id, c.name\n  from orders o join customer c on c.id = o.customer_id', 'ok']); pc = Object.keys(NAMES).map(Number);
      snap('One statement with a join. Postgres can hash-join or nested-loop over the index; every customer arrives with its order and lands in the persistence context.', 'ok');
    } else if (m === 'dto') {
      sql.push(['select o.id, o.total, c.name\n  from orders o join customer c on c.id = o.customer_id', 'ok']);
      snap('One statement, only the three columns the page needs. Nothing enters the persistence context: no proxies, no dirty checking, nothing lazy to trip over later.', 'ok');
    } else {
      sql.push([Q_ORD]); snap('<code>findAll()</code>: one SELECT returns 10 order rows. Each <code>customer</code> field holds a proxy with only the id set.');
      if (m === 'eager') {
        const seen = new Set();
        ORD.forEach(([, c]) => { if (seen.has(c)) return; seen.add(c); pc.push(c); sql.push([Q_C(c), 'warn']);
          snap(`EAGER must be satisfied before <code>findAll()</code> returns, so Hibernate runs a secondary select for customer ${c}${seen.size === 1 ? ', before your code touches anything' : ''}.`, 'warn'); });
      }
    }
    // the loop
    ORD.forEach(([o, c], i) => {
      loop = i;
      if (m === 'lazy' && !pc.includes(c)) { pc.push(c); sql.push([Q_C(c), 'warn']); printed.push(o); snap(`Order ${o}: <code>getName()</code> on an uninitialised proxy → SELECT customer ${c}. Round trip #${sql.length}.`, 'warn'); return; }
      if (m === 'batch' && !pc.includes(c)) {
        const pending = [...new Set(ORD.map((x) => x[1]))].filter((x) => !pc.includes(x)).slice(0, 16);
        pc.push(...pending); sql.push([`select c.id, c.name from customer c\n  where c.id in (${pending.join(', ')})`, 'ok']); printed.push(o);
        snap(`Order ${o} touches the first proxy. Hibernate loads <b>all pending customer proxies</b> (up to 16) in one IN-list query.`, 'ok'); return;
      }
      printed.push(o);
      if (i < 3 || i === ORD.length - 1) snap(m === 'dto' ? `Row ${o}: <code>c.name</code> is already a plain String.` : `Order ${o}: customer ${c} (${NAMES[c]}) is already in the persistence context. No query.`, null);
    });
    loop = -1;
    const n = sql.length;
    const big = m === 'lazy' || m === 'eager' ? '500 orders with 400 distinct customers → 401 statements.' : m === 'batch' ? '500 orders, 400 customers → 1 + 25 statements.' : '500 orders → still 1 statement.';
    snap(`Done: <b>${n}</b> statement${n > 1 ? 's' : ''} for this page. Scale it: ${big}`, n > 2 ? 'err' : 'ok');
    return F;
  }
  let mode = 'lazy'; let F = build(mode); let k = 0; let gen = 0; let running = false; let speed = 1800;
  const mkSeg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segM = mkSeg(Object.keys(MODES).map((x) => [x, MODES[x].l]), mode, (v) => { mode = v; F = build(v); reset(); }, 'Fetch strategy');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = mkSeg([[2800, 'Slow'], [1800, 'Normal'], [900, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const codeLine = el('div', { class: 'tiny', style: { fontFamily: 'var(--mono)', margin: '0 0 8px' } });
  const W = 700; const H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Orders in the loop, persistence context contents, and SQL statements sent to Postgres' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), codeLine, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text: t }, o || {}));
  function draw(f) {
    stage.innerHTML = '';
    stage.append(T(10, 18, 'for (Order o : orders)', { 'font-weight': 700, 'font-family': 'var(--mono)', 'font-size': 12 }), T(196, 18, 'Persistence context', { 'font-weight': 700, 'font-size': 13 }), T(352, 18, 'Sent to Postgres', { 'font-weight': 700, 'font-size': 13 }));
    ORD.forEach(([o, c], i) => {
      const y = 28 + i * 29; const cur = f.loop === i; const done = f.printed.includes(o);
      stage.append(svg('rect', { x: 10, y, width: 170, height: 24, rx: 5, fill: cur ? 'var(--accent-soft)' : 'var(--surface)', stroke: cur ? 'var(--accent)' : 'var(--border)', 'stroke-width': cur ? 2 : 1 }));
      stage.append(T(18, y + 16, `#${o}  → cust ${c}`, { 'font-family': 'var(--mono)', 'font-size': 11 }), T(172, y + 16, done ? NAMES[c] : '…', { 'text-anchor': 'end', 'font-size': 11, fill: done ? 'var(--ok)' : 'var(--text-3)' }));
    });
    stage.append(svg('rect', { x: 190, y: 28, width: 150, height: 286, rx: 10, fill: 'var(--surface-2)', stroke: 'var(--border)', 'stroke-dasharray': mode === 'dto' ? '4 3' : '' }));
    if (mode === 'dto') stage.append(T(265, 170, 'empty: DTOs', { 'text-anchor': 'middle', fill: 'var(--text-3)' }), T(265, 186, 'aren’t managed', { 'text-anchor': 'middle', fill: 'var(--text-3)' }));
    else {
      stage.append(T(200, 46, 'orders 101–110', { 'font-size': 11, fill: 'var(--text-2)' }));
      Object.keys(NAMES).forEach((c, j) => {
        const y = 58 + j * 40; const loaded = f.pc.includes(Number(c));
        stage.append(svg('rect', { x: 200, y, width: 130, height: 32, rx: 6, fill: loaded ? 'var(--accent-soft)' : 'var(--surface)', stroke: loaded ? 'var(--accent)' : 'var(--border)', 'stroke-dasharray': loaded ? '' : '4 3' }));
        stage.append(T(210, y + 20, loaded ? `Customer#${c} ${NAMES[c]}` : `proxy Customer#${c}`, { 'font-size': 11, 'font-family': 'var(--mono)', fill: loaded ? 'var(--text)' : 'var(--text-3)' }));
      });
    }
    // SQL log
    stage.append(svg('rect', { x: 350, y: 28, width: 340, height: 286, rx: 10, fill: 'var(--surface)', stroke: 'var(--border)' }));
    let y = 46; const rows = f.sql.slice(-9);
    if (f.sql.length > 9) { stage.append(T(360, y, `… ${f.sql.length - 9} earlier statements`, { 'font-size': 10.5, fill: 'var(--text-3)' })); y += 16; }
    rows.forEach((s, i) => {
      const last = i === rows.length - 1;
      s[0].split('\n').forEach((ln) => { stage.append(T(360, y, ln.length > 52 ? ln.slice(0, 51) + '…' : ln, { 'font-family': 'var(--mono)', 'font-size': 10.2, 'font-weight': last ? 700 : 400, fill: s[1] === 'warn' ? 'var(--warn)' : s[1] === 'ok' ? 'var(--ok)' : 'var(--text)' })); y += 14; });
      y += 13;
    });
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `statements / round trips <b>${f.sql.length}</b>` }), el('span', { class: 'w-stat', html: `managed customers <b>${f.pc.length}</b>` }),
      el('span', { class: 'w-stat', html: `at 1 ms per round trip <b>≥ ${f.sql.length} ms</b> network time` }));
  }
  function show() {
    const f = F[k]; draw(f); codeLine.textContent = MODES[mode].code;
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
