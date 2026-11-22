/* Optional: watch a value (or its absence) move through map / filter / flatMap / orElse, and see orElse evaluate its argument eagerly. */
IA.widget('optional', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-jt-style')) {
    document.head.append(el('style', { id: 'w-jt-style', text: `
.jt-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 12px; align-items: start; }
@media (max-width: 760px) { .jt-grid { grid-template-columns: 1fr; } }
.jt-code { font-family: var(--mono); font-size: 12.5px; line-height: 1.6; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 0; overflow-x: auto; }
.jt-code div { padding: 0 10px; white-space: pre; border-left: 3px solid transparent; }
.jt-code div.on { background: var(--accent-soft); border-left-color: var(--accent); }
.jt-out { font-family: var(--mono); font-size: 12.5px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 6px 10px; margin-top: 8px; min-height: 2.2em; white-space: pre-wrap; }
.jt-out .h { font-size: 11px; color: var(--text-3); font-family: var(--sans); }
.jt-out .e { color: var(--err); }
.jt-box { fill: var(--surface); stroke: var(--border); stroke-width: 1.2; }
.jt-box.hot { stroke: var(--accent); stroke-width: 2; fill: var(--accent-soft); }
.jt-box.chg { stroke: var(--warn); stroke-width: 2; }
.jt-box.gc { stroke-dasharray: 4 3; opacity: .45; }
.jt-box.bad { stroke: var(--err); stroke-width: 2; }
.jt-box.ok { stroke: var(--ok); stroke-width: 2; }
.jt-box.frame { fill: var(--surface-2); }
.jt-arrow { fill: none; stroke: var(--accent); stroke-width: 1.8; }
.jt-arrow.chg { stroke: var(--warn); stroke-width: 2.4; }
.jt-arrow.gc { opacity: .35; }
` }));
  }
  // ops: the chain; each step: r: results per op index [kind, text] where kind is some|none|skip|nested|val|run; db: calls so far
  const SC = {
    present: { label: 'Value present', ops: ['Optional.ofNullable(user)', '.map(User::address)', '.map(Address::city)', '.filter(c -> !c.isBlank())', '.orElse("unknown")'], code: [
      'record Address(String city) {}',
      'record User(String name, Address address) {}',
      'User user = new User("ana", new Address("Lisbon"));',
      'String city = Optional.ofNullable(user)',
      '    .map(User::address)',
      '    .map(Address::city)',
      '    .filter(c -> !c.isBlank())',
      '    .orElse("unknown");'],
    steps: [
      { l: 3, r: [['some', 'User[ana]']], s: '<code>ofNullable</code> wraps a value that may be null. Here it isn’t null, so the Optional is <b>present</b>.' },
      { l: 4, r: [['some', 'User[ana]'], ['some', 'Address[Lisbon]']], s: '<code>map</code> applies the function to the value and wraps the result. If the function returned null, map would give back an <b>empty</b> Optional, which is what makes null-safe chains work.' },
      { l: 5, r: [['some', 'User[ana]'], ['some', 'Address[Lisbon]'], ['some', '"Lisbon"']], s: 'Another hop through the object graph, with no null checks written.' },
      { l: 6, r: [['some', 'User[ana]'], ['some', 'Address[Lisbon]'], ['some', '"Lisbon"'], ['some', '"Lisbon"']], s: '<code>filter</code> keeps the value if the predicate is true and turns the Optional empty otherwise.' },
      { l: 7, r: [['some', 'User[ana]'], ['some', 'Address[Lisbon]'], ['some', '"Lisbon"'], ['some', '"Lisbon"'], ['val', '"Lisbon"']], out: 'city = Lisbon', s: 'A terminal method leaves the Optional world: <code>orElse</code> unwraps the value, or returns the fallback when the Optional is empty.' }
    ] },
    empty: { label: 'Empty short-circuits', ops: ['Optional.ofNullable(user)', '.map(User::address)', '.map(Address::city)', '.filter(c -> !c.isBlank())', '.orElse("unknown")'], code: [
      'User user = new User("ben", null);   // no address',
      'String city = Optional.ofNullable(user)',
      '    .map(User::address)',
      '    .map(Address::city)',
      '    .filter(c -> !c.isBlank())',
      '    .orElse("unknown");'],
    steps: [
      { l: 1, r: [['some', 'User[ben]']], s: 'Present: ben exists.' },
      { l: 2, r: [['some', 'User[ben]'], ['none', 'Optional.empty']], s: '<code>user.address()</code> returns <b>null</b>, so <code>map</code> produces <code>Optional.empty</code>. No exception.' },
      { l: 3, r: [['some', 'User[ben]'], ['none', 'Optional.empty'], ['skip', 'function not called']], s: 'On an empty Optional, <code>map</code> doesn’t call its function at all. <code>Address::city</code> is never invoked on null.' },
      { l: 4, r: [['some', 'User[ben]'], ['none', 'Optional.empty'], ['skip', 'function not called'], ['skip', 'predicate not called']], s: 'Same for <code>filter</code>: emptiness just flows through.' },
      { l: 5, r: [['some', 'User[ben]'], ['none', 'Optional.empty'], ['skip', 'function not called'], ['skip', 'predicate not called'], ['val', '"unknown"']], out: 'city = unknown', s: 'The fallback is used. One expression replaces three nested <code>if (x != null)</code> checks, and the “maybe absent” part is visible in the types.' }
    ] },
    eager: { label: 'orElse vs orElseGet', ops: ['Optional.of("cached")', '.orElse(loadFromDb())', 'Optional.of("cached")', '.orElseGet(() -> loadFromDb())'], code: [
      'static String loadFromDb() { System.out.println("DB call!"); return "db"; }',
      '',
      'String a = Optional.of("cached").orElse(loadFromDb());',
      'String b = Optional.of("cached").orElseGet(() -> loadFromDb());',
      'System.out.println(a + " " + b);'],
    steps: [
      { l: 2, r: [['some', '"cached"']], db: 0, s: 'The value is present, so we won’t need the fallback…' },
      { l: 2, r: [['some', '"cached"'], ['run', 'loadFromDb() runs first!']], db: 1, out: 'DB call!', s: '…but <code>orElse(x)</code> is an ordinary method call: Java evaluates its <b>argument first</b>. <code>loadFromDb()</code> runs even though the result is thrown away.' },
      { l: 2, r: [['some', '"cached"'], ['val', '"cached" (db result discarded)']], db: 1, s: '<code>a</code> is "cached". The database call was pure waste, and if <code>loadFromDb</code> had side effects (insert a default row, call an API, throw), they happened anyway.' },
      { l: 3, r: [['some', '"cached"'], ['val', '"cached"'], ['some', '"cached"'], ['skip', 'supplier not called']], db: 1, s: '<code>orElseGet</code> takes a <code>Supplier</code>: a lambda that runs <b>only if</b> the Optional is empty. Nothing runs here.' },
      { l: 4, r: [['some', '"cached"'], ['val', '"cached"'], ['some', '"cached"'], ['val', '"cached"']], db: 1, out: 'cached cached', s: 'Prints <b>DB call!</b> then <b>cached cached</b>. Use <code>orElse</code> for constants and values you already have; use <code>orElseGet</code> (or <code>orElseThrow</code>) when the fallback costs something.' }
    ] },
    flat: { label: 'map vs flatMap', ops: ['repo.findById(7)', '.map(User::manager)', '.flatMap(User::manager)'], code: [
      '// User.manager() returns Optional<User>',
      'Optional<User> u = repo.findById(7);',
      'Optional<Optional<User>> m1 = u.map(User::manager);',
      'Optional<User> m2 = u.flatMap(User::manager);',
      'String boss = m2.map(User::name).orElse("none");'],
    steps: [
      { l: 1, r: [['some', 'User[7, cara]']], s: 'Spring Data’s <code>findById</code> returns <code>Optional&lt;User&gt;</code>: the textbook use of Optional, a return value that may be absent.' },
      { l: 2, r: [['some', 'User[7, cara]'], ['nested', 'Optional[Optional[User[3]]]']], s: '<code>map</code> wraps whatever the function returns. The function already returns an Optional, so you get an <b>Optional inside an Optional</b>, which is awkward to use.' },
      { l: 3, r: [['some', 'User[7, cara]'], ['nested', 'Optional[Optional[User[3]]]'], ['some', 'User[3, dev]']], s: '<code>flatMap</code> expects a function that returns an Optional and <b>doesn’t</b> wrap it again. Rule: <code>map</code> for <code>T → R</code>, <code>flatMap</code> for <code>T → Optional&lt;R&gt;</code>.' },
      { l: 4, r: [['some', 'User[7, cara]'], ['nested', 'Optional[Optional[User[3]]]'], ['some', 'User[3, dev]']], out: 'boss = dev', s: 'The chain continues flat. The same map/flatMap distinction applies to Stream and CompletableFuture (<code>thenApply</code> vs <code>thenCompose</code>).' }
    ] }
  };

  const ids = Object.keys(SC); let cur = ids[0]; let k = -1; let gen = 0; let running = false;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  ids.forEach((id) => { const b = el('button', { text: SC[id].label, class: id === cur ? 'on' : '' }); b.addEventListener('click', () => { cur = id; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const code = el('div', { class: 'jt-code' });
  const out = el('div', { class: 'jt-out', 'aria-label': 'Program output' });
  const W = 520, H = 300;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Each step of the Optional chain with the Optional it produces: present, empty, skipped or unwrapped' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, seg),
    el('div', { class: 'jt-grid' }, el('div', null, code, out), el('div', { class: 'w-stage' }, stage)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 11.5, fill: 'var(--text)', 'font-family': 'var(--mono)', text: t }, o || {}));
  const KIND = { some: ['ok', 'present'], none: ['gc', 'empty'], skip: ['gc', 'skipped'], nested: ['chg', 'nested!'], val: ['hot', 'unwrapped'], run: ['bad', 'evaluated'] };
  function draw(S, st) {
    stage.innerHTML = '';
    stage.append(T(8, 16, 'operation', { 'font-size': 10.5, fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-weight': 700 }), T(262, 16, 'result', { 'font-size': 10.5, fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-weight': 700 }));
    const rh = 48;
    S.ops.forEach((op, i) => {
      const y = 24 + i * rh;
      const r = st && st.r[i];
      const isCur = st && i === st.r.length - 1;
      stage.append(svg('rect', { class: 'jt-box frame' + (isCur ? ' hot' : ''), x: 4, y, width: 244, height: rh - 10, rx: 7 }), T(12, y + 24, op, { 'font-size': 11 }));
      if (i > 0) stage.append(T(386, y - 1, '↓', { 'text-anchor': 'middle', fill: 'var(--text-3)', 'font-size': 11 }));
      const [cls, tag] = r ? KIND[r[0]] : ['gc', ''];
      const box = svg('rect', { class: 'jt-box ' + cls, x: 258, y, width: 256, height: rh - 10, rx: 7 });
      stage.append(box);
      if (r) {
        stage.append(T(266, y + 14, tag, { 'font-size': 9.5, fill: r[0] === 'run' ? 'var(--err)' : r[0] === 'nested' ? 'var(--warn)' : 'var(--text-3)', 'font-family': 'var(--sans)', 'font-weight': 700 }),
          T(266, y + 30, r[0] === 'some' ? 'Optional[' + r[1] + ']' : r[1], { 'font-size': 11, fill: r[0] === 'skip' ? 'var(--text-3)' : 'var(--text)' }));
        if (isCur && !reduced) { box.style.transition = 'opacity .35s'; box.style.opacity = '0.2'; requestAnimationFrame(() => { box.style.opacity = '1'; }); }
      }
    });
    if (S === SC.eager) {
      const n = st && st.db != null ? st.db : 0;
      stage.append(svg('rect', { class: 'jt-box ' + (n ? 'bad' : 'frame'), x: 4, y: 24 + S.ops.length * rh + 4, width: 510, height: 34, rx: 8 }),
        T(14, 24 + S.ops.length * rh + 26, 'database calls so far: ' + n + (n ? '  (needed: 0)' : ''), { fill: n ? 'var(--err)' : 'var(--text)' }));
    }
    if (!st) stage.append(T(262, 48, 'press Play or Step', { fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-size': 11 }));
  }
  function paint() {
    const S = SC[cur]; const st = k >= 0 ? S.steps[k] : null;
    code.innerHTML = '';
    S.code.forEach((ln, i) => code.append(el('div', { class: st && st.l === i ? 'on' : '', html: IA.highlight(ln, 'java') || ' ' })));
    out.innerHTML = ''; out.append(el('div', { class: 'h', text: 'stdout' }));
    S.steps.slice(0, k + 1).forEach((s) => { if (s.out) out.append(el('div', { text: s.out })); });
    draw(S, st);
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: st ? `${k + 1}/${S.steps.length}` : '0' }), el('div', { class: 't', html: st ? st.s : 'Pick a scenario, then press <b>Play</b> or <b>Step</b>. Green boxes hold a value, dashed boxes are empty or skipped, and red means work that ran when it didn’t need to.' }));
    bStep.disabled = k >= S.steps.length - 1;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = -1; paint(); }
  function step() { const S = SC[cur]; if (k >= S.steps.length - 1) return false; k++; paint(); return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= SC[cur].steps.length - 1) k = -1;
    if (reduced) { k = SC[cur].steps.length - 1; paint(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(2400);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
