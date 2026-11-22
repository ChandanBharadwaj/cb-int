/* pytest: a small simulator of fixture setup/teardown by scope, printed like `pytest --setup-show`.
   Three fixtures (engine: session, schema: selectable scope, tx: function) and five test items in two modules. */
IA.widget('pytest', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-py-base')) {
    document.head.append(el('style', { id: 'w-py-base', text: `
.wpy-code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.wpy-code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent}
.wpy-code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.wpy-out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.wpy-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.wpy-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:12px;align-items:start}
@media (max-width:720px){.wpy-grid{grid-template-columns:1fr}}
` }));
  }
  if (!document.getElementById('w-pypt-style')) {
    document.head.append(el('style', { id: 'w-pypt-style', text: `
.w-pypt .lane{fill:var(--surface-2);stroke:var(--border)}
.w-pypt .fx{fill:var(--surface);stroke:var(--accent);stroke-width:2;transition:all .35s}
.w-pypt .fx.new{fill:var(--accent-soft);stroke-width:3}
.w-pypt .fx.dying{stroke:var(--warn);stroke-dasharray:5 4;fill:color-mix(in srgb,var(--warn) 12%,transparent)}
.w-pypt .fx.ghost{fill:none;stroke:var(--border);stroke-dasharray:4 4}
.w-pypt .tst{fill:color-mix(in srgb,var(--ok) 16%,transparent);stroke:var(--ok);stroke-width:2}
.w-pypt .log{max-height:260px;overflow:auto}
.w-pypt .log div{white-space:pre}
.w-pypt .log div.cur{color:var(--accent);font-weight:700}
.w-pypt .log div.td{color:var(--warn)}
.w-pypt .log div.run{color:var(--ok)}
` }));
  }
  const CODE = [
    '# conftest.py',
    '@pytest.fixture(scope="session")',
    'def engine():',
    '    eng = create_engine(DB_URL)',
    '    yield eng',
    '    eng.dispose()',
    '',
    '@pytest.fixture(scope="module")',
    'def schema(engine):',
    '    create_tables(engine)',
    '    yield',
    '    drop_tables(engine)',
    '',
    '@pytest.fixture                    # function',
    'def tx(engine, schema):',
    '    conn = engine.connect(); t = conn.begin()',
    '    yield conn',
    '    t.rollback(); conn.close()',
    '',
    '# test_orders.py',
    'def test_create(tx): ...',
    'def test_cancel(tx): ...',
    '',
    '# test_users.py',
    '@pytest.mark.parametrize("email", ["a@x.io", "b@x.io"])',
    'def test_signup(tx, email): ...',
    'def test_slug(): ...               # no fixtures'
  ];
  const FX = {
    engine: { deps: [], setup: 3, td: 5 },
    schema: { deps: ['engine'], setup: 9, td: 11 },
    tx: { deps: ['engine', 'schema'], setup: 15, td: 17, scope: 'function' }
  };
  const ITEMS = [
    { id: 'test_orders.py::test_create', mod: 'test_orders.py', uses: ['tx'], line: 20 },
    { id: 'test_orders.py::test_cancel', mod: 'test_orders.py', uses: ['tx'], line: 21 },
    { id: 'test_users.py::test_signup[a@x.io]', mod: 'test_users.py', uses: ['tx'], line: 25 },
    { id: 'test_users.py::test_signup[b@x.io]', mod: 'test_users.py', uses: ['tx'], line: 25 },
    { id: 'test_users.py::test_slug', mod: 'test_users.py', uses: [], line: 26 }
  ];
  const LETTER = { session: 'S', module: 'M', function: 'F' };
  const IND = { session: '', module: '    ', function: '        ' };
  let schemaScope = 'module';
  const scopeOf = (n) => (n === 'engine' ? 'session' : n === 'schema' ? schemaScope : 'function');
  const keyOf = (scope, item) => (scope === 'session' ? 'S' : scope === 'module' ? item.mod : item.id);

  function closure(names) {
    const out = [];
    const visit = (n) => { FX[n].deps.forEach(visit); if (!out.includes(n)) out.push(n); };
    names.forEach(visit);
    const rank = { session: 0, module: 1, function: 2 };
    const order = out.slice();
    return out.slice().sort((a, b) => rank[scopeOf(a)] - rank[scopeOf(b)] || order.indexOf(a) - order.indexOf(b));
  }

  function simulate() {
    const ev = []; let alive = []; const counts = { engine: 0, schema: 0, tx: 0 };
    const snap = () => alive.map((a) => ({ ...a }));
    let lastMod = null;
    ITEMS.forEach((it, i) => {
      if (it.mod !== lastMod) { ev.push({ kind: 'file', text: it.mod, alive: snap(), mod: it.mod, cap: `pytest enters <code>${it.mod}</code>.` + (lastMod ? '' : ' Nothing exists yet: fixtures are created lazily, on first request.') }); lastMod = it.mod; }
      closure(it.uses).forEach((n) => {
        const sc = scopeOf(n); const key = keyOf(sc, it);
        if (alive.some((a) => a.name === n && a.key === key)) return;
        alive.push({ name: n, scope: sc, key }); counts[n]++;
        const deps = FX[n].deps;
        let cap = `<code>${n}</code> (${sc} scope) is needed and not cached for this ${sc === 'function' ? 'test' : sc}, so its code runs <b>up to <code>yield</code></b>.`;
        if (n === 'engine') cap += ' Created once; every later test reuses it.';
        if (n === 'tx' && counts.tx > 1) cap = '<code>tx</code> is function-scoped: a <b>fresh</b> connection and transaction for this test, so it cannot see rows from the previous one.';
        if (n === 'schema' && sc === 'function') cap = '<code>schema</code> is function-scoped now, so tables are created again for <b>every</b> test. Correct isolation, but slow: watch the counter.';
        if (n === 'schema' && sc === 'module' && counts.schema > 1) cap = 'New module, new <code>schema</code> instance. Module scope = one per test file.';
        ev.push({ kind: 'setup', name: n, line: FX[n].setup, text: `${IND[sc]}SETUP    ${LETTER[sc]} ${n}` + (deps.length ? ` (fixtures used: ${deps.join(', ')})` : ''), alive: snap(), counts: { ...counts }, cap, mod: it.mod });
      });
      const used = closure(it.uses);
      ev.push({ kind: 'run', item: it, line: it.line, text: `${IND.function}${it.id}` + (used.length ? ` (fixtures used: ${used.join(', ')})` : '') + ' .', alive: snap(), counts: { ...counts }, mod: it.mod,
        cap: used.length ? `The test runs with <code>tx</code> injected <b>by parameter name</b>.` + (it.id.includes('[') ? ' Each <code>parametrize</code> value is a separate test item with its own function-scoped fixtures.' : '') : '<code>test_slug</code> asks for no fixtures, so nothing is set up. The module- and session-scoped instances stay alive anyway: they belong to their scope, not to a test.' });
      // teardown: function always; module if next item is elsewhere; session at the end
      const next = ITEMS[i + 1];
      const goes = (a) => a.scope === 'function' || (a.scope === 'module' && (!next || next.mod !== it.mod)) || (a.scope === 'session' && !next);
      const dying = alive.filter(goes).reverse();
      dying.forEach((a) => {
        const sc = a.scope;
        let cap = `Teardown: the code <b>after <code>yield</code></b> in <code>${a.name}</code> runs.`;
        if (sc === 'function') cap += ' Function-scoped fixtures end with their test.';
        if (sc === 'module') cap = `Last test in <code>${it.mod}</code>: the module-scoped <code>${a.name}</code> is finalized, <b>after</b> the narrower fixtures (last in, first out).`;
        if (sc === 'session') cap = 'End of the session: <code>engine</code> goes last, because everything else depended on it.';
        ev.push({ kind: 'td', name: a.name, line: FX[a.name].td, text: `${IND[sc]}TEARDOWN ${LETTER[sc]} ${a.name}`, alive: alive.map((x) => ({ ...x, dying: x === a })), counts: { ...counts }, cap, mod: it.mod });
        alive = alive.filter((x) => x !== a);
      });
    });
    ev.push({ kind: 'end', text: '', alive: [], counts: { ...counts }, cap: `Done. Setups: engine ×${counts.engine}, schema ×${counts.schema}, tx ×${counts.tx}. ` + (schemaScope === 'session' ? 'Fastest, but all five tests share one set of tables, so only the per-test transaction keeps them isolated.' : schemaScope === 'function' ? 'Slowest: tables are rebuilt for every test.' : 'A middle ground: one set of tables per test file.') });
    return ev;
  }

  let EV = simulate(), k = 0, gen = 0, running = false;
  const segS = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scope of the schema fixture' });
  [['function', 'schema: function'], ['module', 'schema: module'], ['session', 'schema: session']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === schemaScope ? 'on' : '' }); b.addEventListener('click', () => { schemaScope = v; [...segS.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); segS.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'wpy-code' });
  const log = el('div', { class: 'wpy-out log' });
  const stats = el('div', { class: 'w-stats' });
  const stage = svg('svg', { viewBox: '0 0 460 250', role: 'img', 'aria-label': 'Three lanes, session, module and function, showing which fixture instances are alive' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pypt');
  root.append(el('div', { class: 'w-controls' }, segS),
    el('div', { class: 'wpy-grid' },
      el('div', null, el('div', { class: 'wpy-lbl', text: 'code' }), codeHost),
      el('div', null, el('div', { class: 'wpy-lbl', text: 'alive fixture instances' }), el('div', { class: 'w-stage' }, stage), stats, el('div', { class: 'wpy-lbl', text: 'pytest --setup-show' }), log)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const LANES = [['session', 14], ['module', 92], ['function', 170]];
  const POS = { engine: 96, schema: 186, tx: 276 };
  function render() {
    const cur = k ? EV[k - 1] : null;
    codeHost.innerHTML = '';
    CODE.forEach((ln, i) => { const t = i === 7 ? (schemaScope === 'function' ? '@pytest.fixture                    # function' : `@pytest.fixture(scope="${schemaScope}")`) : ln; codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: t ? IA.highlight(t, 'python') : '&nbsp;' })); });
    log.innerHTML = '';
    EV.slice(0, k).filter((e) => e.text).forEach((e) => log.append(el('div', { class: (e.kind === 'td' ? 'td' : e.kind === 'run' ? 'run' : '') + (e === cur ? ' cur' : ''), text: e.text })));
    if (!k) log.append(el('div', { class: 'tiny', text: '(nothing yet)' }));
    log.scrollTop = log.scrollHeight;
    // lanes
    stage.innerHTML = '';
    LANES.forEach(([n, y]) => stage.append(svg('rect', { class: 'lane', x: 4, y, width: 452, height: 66, rx: 10 }), svg('text', { x: 14, y: y + 38, 'font-size': 12.5, 'font-weight': 700, fill: 'var(--text-3)', text: n })));
    if (cur && cur.mod) stage.append(svg('text', { x: 448, y: 106, 'text-anchor': 'end', 'font-size': 11, 'font-family': 'var(--mono)', fill: 'var(--text-3)', text: cur.mod }));
    const lanes = { session: 14, module: 92, function: 170 };
    ['engine', 'schema', 'tx'].forEach((n) => {
      const sc = scopeOf(n); const y = lanes[sc] + 14; const x = POS[n];
      const a = cur ? cur.alive.find((z) => z.name === n) : null;
      let cls = 'fx ghost';
      if (a) cls = 'fx' + (a.dying ? ' dying' : '') + (cur.kind === 'setup' && cur.name === n ? ' new' : '');
      const r = svg('rect', { class: cls, x, y, width: 80, height: 38, rx: 9 });
      if (!reduced && cur && cur.kind === 'setup' && cur.name === n) { r.style.transform = 'scale(.6)'; r.style.transformOrigin = `${x + 40}px ${y + 19}px`; requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transform = 'scale(1)'; })); }
      stage.append(r, svg('text', { x: x + 40, y: y + 24, 'text-anchor': 'middle', 'font-size': 13, 'font-family': 'var(--mono)', fill: a ? 'var(--text)' : 'var(--text-3)', text: n }));
    });
    if (cur && cur.kind === 'run') {
      const short = cur.item.id.split('::')[1];
      stage.append(svg('rect', { class: 'tst', x: 362, y: 184, width: 90, height: 38, rx: 9 }), svg('text', { x: 407, y: 207, 'text-anchor': 'middle', 'font-size': 10.5, 'font-family': 'var(--mono)', fill: 'var(--text)', text: short.length > 14 ? short.slice(0, 13) + '…' : short }));
    }
    const c = cur && cur.counts ? cur.counts : { engine: 0, schema: 0, tx: 0 };
    stats.innerHTML = '';
    Object.entries(c).forEach(([n, v]) => stats.append(el('span', { class: 'w-stat', html: `${n} setups <b>${v}</b>` })));
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${EV.length}` }), el('div', { class: 't', html: cur ? cur.cap : `<code>schema</code> scope: <b>${schemaScope}</b>. Press <b>Play</b> or <b>Step</b> to run the five tests.` }));
    bStep.disabled = k >= EV.length;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); EV = simulate(); k = 0; render(); }
  function step() { if (k >= EV.length) return false; k++; render(); return k < EV.length; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= EV.length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 700 : 2200); }
    if (g === gen) stop();
  });
  reset();
});
