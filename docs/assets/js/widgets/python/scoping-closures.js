/* Scope & closures: nested LEGB scopes, name lookup walking outward, UnboundLocalError,
   nonlocal cells, late-binding lambdas and the shared mutable default. */
IA.widget('scoping-closures', (root, ctx) => {
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
  if (!document.getElementById('w-pysc-style')) {
    document.head.append(el('style', { id: 'w-pysc-style', text: `
.w-pysc .sc{fill:var(--surface);stroke:var(--border);stroke-width:1.5;transition:stroke .25s,fill .25s}
.w-pysc .sc.d1{fill:var(--surface-2)}
.w-pysc .sc.look{stroke:var(--accent);stroke-width:2.5;stroke-dasharray:6 4}
.w-pysc .sc.found{stroke:var(--ok);stroke-width:3;stroke-dasharray:none}
.w-pysc .sc.err{stroke:var(--err);stroke-width:3;stroke-dasharray:none}
.w-pysc .ch{fill:var(--bg);stroke:var(--border);stroke-width:1.2}
.w-pysc .ch.hit{stroke:var(--ok);stroke-width:2.5;fill:color-mix(in srgb,var(--ok) 14%,var(--bg))}
.w-pysc .ch.err{stroke:var(--err);stroke-width:2.5;fill:color-mix(in srgb,var(--err) 12%,var(--bg))}
.w-pysc .ch.chg{stroke:var(--warn);stroke-width:2.5}
.w-pysc .ar{fill:none;stroke:var(--accent-2);stroke-width:2}
.w-pysc .ah{fill:var(--accent-2)}
.w-pysc .trail{font-family:var(--mono);font-size:12.5px;min-height:1.6em;margin-bottom:6px;color:var(--text-2)}
.w-pysc .trail b.ok{color:var(--ok)} .w-pysc .trail b.no{color:var(--err)}
` }));
  }
  const B = { id: 'B', t: 'Built-in (builtins module)', v: [['print', 'fn'], ['len', 'fn'], ['range', 'type']] };
  const NAMES = { B: 'Built-in', G: 'Global', E: 'Enclosing', L: 'Local' };
  const S = [
    { label: 'LEGB lookup', code: ['x = "global"', 'def outer():', '    x = "enclosing"', '    def inner():', '        print(x, len)', '    inner()', 'outer()'],
      steps: [
        { line: 0, scopes: [B, { id: 'G', t: 'Global (module)', v: [['x', '"global"']] }], chg: ['G.x'], cap: 'A module-level assignment creates a <b>global</b> name. Built-ins such as <code>print</code> and <code>len</code> sit in an outer scope you never write to.' },
        { line: 1, scopes: [B, { id: 'G', t: 'Global (module)', v: [['x', '"global"'], ['outer', 'fn']] }], chg: ['G.outer'], cap: '<code>def</code> is an assignment too: it binds the name <code>outer</code> to a new function object.' },
        { line: 2, scopes: [B, { id: 'G', t: 'Global (module)', v: [['x', '"global"'], ['outer', 'fn']] }, { id: 'E', t: 'outer() call', v: [['x', '"enclosing"']] }], chg: ['E.x'], cap: 'Calling <code>outer()</code> creates a new local scope. Its <code>x</code> is a <b>different</b> name from the global one.' },
        { line: 3, scopes: [B, { id: 'G', t: 'Global (module)', v: [['x', '"global"'], ['outer', 'fn']] }, { id: 'E', t: 'outer() call', v: [['x', '"enclosing"'], ['inner', 'fn']] }], chg: ['E.inner'], cap: '<code>inner</code> is defined inside <code>outer</code>, so outer’s scope becomes its <b>enclosing</b> scope.' },
        { line: 5, scopes: [B, { id: 'G', t: 'Global (module)', v: [['x', '"global"'], ['outer', 'fn']] }, { id: 'E', t: 'Enclosing: outer()', v: [['x', '"enclosing"'], ['inner', 'fn']] }, { id: 'L', t: 'Local: inner() call', v: [] }], cap: 'Calling <code>inner()</code> creates its local scope. It assigns nothing, so it is empty.' },
        { line: 4, look: { n: 'x', path: ['L', 'E'], at: 'E' }, cap: 'Lookup of <code>x</code>: <b>L</b>ocal (no), <b>E</b>nclosing (yes). The search stops at the first hit, so the global <code>x</code> is shadowed.' },
        { line: 4, look: { n: 'len', path: ['L', 'E', 'G', 'B'], at: 'B' }, cap: 'Lookup of <code>len</code> goes all the way out: Local → Enclosing → Global → <b>B</b>uilt-in. That is LEGB.' },
        { line: 4, out: 'enclosing <built-in function len>', cap: 'The scope of a name is decided by <b>where the code is written</b> (lexical scoping), not by who calls it.' }
      ] },
    { label: 'UnboundLocalError', code: ['count = 0', 'def bump():', '    count += 1', 'bump()'],
      steps: [
        { line: 0, scopes: [B, { id: 'G', t: 'Global (module)', v: [['count', '0']] }], chg: ['G.count'], cap: 'A global counter.' },
        { line: 1, scopes: [B, { id: 'G', t: 'Global (module)', v: [['count', '0'], ['bump', 'fn']] }], chg: ['G.bump'], cap: 'When <code>bump</code> is <b>compiled</b>, Python sees an assignment to <code>count</code> inside it. So <code>count</code> is local for the <i>whole</i> function body.' },
        { line: 3, scopes: [B, { id: 'G', t: 'Global (module)', v: [['count', '0'], ['bump', 'fn']] }, { id: 'L', t: 'Local: bump() call', v: [['count', '<unbound>']] }], cap: 'The call creates a local slot for <code>count</code>, with no value yet.' },
        { line: 2, look: { n: 'count', path: ['L'], at: 'L', err: true }, cap: '<code>count += 1</code> must read <code>count</code> first. The local slot is empty, and Python does <b>not</b> fall back to the global: it raises.' },
        { line: 2, out: "UnboundLocalError: cannot access local variable 'count' where it is not associated with a value", cap: 'Fix: <code>global count</code> (for module state) or <code>nonlocal</code> (for an enclosing function). Better: return the new value, or keep state in an object.' }
      ] },
    { label: 'nonlocal counter', code: ['def make_counter():', '    n = 0', '    def inc():', '        nonlocal n', '        n += 1', '        return n', '    return inc', 'c = make_counter()', 'print(c(), c())'],
      steps: [
        { line: 7, scopes: [B, { id: 'G', t: 'Global (module)', v: [['make_counter', 'fn']] }, { id: 'E', t: 'make_counter() call', v: [['n', '0  (cell)']] }], chg: ['E.n'], cap: '<code>n</code> is used by a nested function, so the compiler stores it in a <b>cell</b> instead of a plain local slot.' },
        { line: 2, scopes: [B, { id: 'G', t: 'Global (module)', v: [['make_counter', 'fn']] }, { id: 'E', t: 'make_counter() call', v: [['n', '0  (cell)'], ['inc', 'fn']] }], chg: ['E.inc'], cap: 'The <code>inc</code> function object keeps a reference to that cell in <code>inc.__closure__</code>.' },
        { line: 7, scopes: [B, { id: 'G', t: 'Global (module)', v: [['make_counter', 'fn'], ['c', 'inc']] }, { id: 'E', t: 'cell kept alive by c.__closure__', v: [['n', '0  (cell)']] }], arrows: [['G.c', 'E.n']], chg: ['G.c'], cap: '<code>make_counter</code> has returned and its frame is gone. The cell survives because <code>c</code> still references it. That is a <b>closure</b>.' },
        { line: 4, scopes: [B, { id: 'G', t: 'Global (module)', v: [['make_counter', 'fn'], ['c', 'inc']] }, { id: 'E', t: 'cell kept alive by c.__closure__', v: [['n', '1  (cell)']] }, { id: 'L', t: 'Local: c() call', v: [] }], arrows: [['G.c', 'E.n']], look: { n: 'n', path: ['L', 'E'], at: 'E' }, chg: ['E.n'], cap: '<code>nonlocal n</code> makes <code>n += 1</code> write to the cell rather than create a local. First call: 1.' },
        { line: 4, scopes: [B, { id: 'G', t: 'Global (module)', v: [['make_counter', 'fn'], ['c', 'inc']] }, { id: 'E', t: 'cell kept alive by c.__closure__', v: [['n', '2  (cell)']] }, { id: 'L', t: 'Local: c() call', v: [] }], arrows: [['G.c', 'E.n']], look: { n: 'n', path: ['L', 'E'], at: 'E' }, chg: ['E.n'], cap: 'Second call: the same cell, so 2. Each <code>make_counter()</code> call would get its own cell.' },
        { line: 8, out: '1 2', cap: 'Without <code>nonlocal</code>, the assignment would make <code>n</code> local to <code>inc</code> and you would get <code>UnboundLocalError</code>.' }
      ] },
    { label: 'Late-binding lambdas', code: ['fns = []', 'for i in range(3):', '    fns.append(lambda: i)', 'print([f() for f in fns])'],
      steps: [
        { line: 2, scopes: [B, { id: 'G', t: 'Global (module)', v: [['fns', '[λ]'], ['i', '0']] }], chg: ['G.fns'], cap: 'The lambda stores <b>code that says “look up i”</b>. It does not store the value 0.' },
        { line: 2, scopes: [B, { id: 'G', t: 'Global (module)', v: [['fns', '[λ, λ]'], ['i', '1']] }], chg: ['G.fns', 'G.i'], cap: 'The loop rebinds the same name <code>i</code>.' },
        { line: 2, scopes: [B, { id: 'G', t: 'Global (module)', v: [['fns', '[λ, λ, λ]'], ['i', '2']] }], chg: ['G.fns', 'G.i'], cap: 'Three lambdas, all referring to the one name <code>i</code>, which is now 2.' },
        { line: 3, scopes: [B, { id: 'G', t: 'Global (module)', v: [['fns', '[λ, λ, λ]'], ['i', '2']] }, { id: 'L', t: 'Local: each λ() call', v: [] }], look: { n: 'i', path: ['L', 'G'], at: 'G' }, cap: 'Each call looks <code>i</code> up <b>now</b>, at call time, and finds 2. (Inside a function the same happens through a shared cell.)' },
        { line: 3, out: '[2, 2, 2]', cap: 'Late binding: closures capture <b>variables</b>, not values. Fix: <code>lambda i=i: i</code>, <code>functools.partial</code>, or a factory function.' }
      ] },
    { label: 'Default freezes value', code: ['fns = []', 'for i in range(3):', '    fns.append(lambda i=i: i)', 'print([f() for f in fns])'],
      steps: [
        { line: 2, scopes: [B, { id: 'G', t: 'Global (module)', v: [['fns', '[λ(i=0)]'], ['i', '0']] }], chg: ['G.fns'], cap: 'Default values are evaluated <b>once, when the function is created</b>, and stored in <code>__defaults__</code>. This lambda carries <code>(0,)</code>.' },
        { line: 2, scopes: [B, { id: 'G', t: 'Global (module)', v: [['fns', '[λ(i=0), λ(i=1), λ(i=2)]'], ['i', '2']] }], chg: ['G.fns', 'G.i'], cap: 'Each lambda has its own frozen copy of the value at that iteration.' },
        { line: 3, scopes: [B, { id: 'G', t: 'Global (module)', v: [['fns', '[λ(i=0), λ(i=1), λ(i=2)]'], ['i', '2']] }, { id: 'L', t: 'Local: fns[0]() call', v: [['i', '0  (from default)']] }], look: { n: 'i', path: ['L'], at: 'L' }, cap: 'Now <code>i</code> is a <b>parameter</b>, so it is local and the lookup stops immediately.' },
        { line: 3, out: '[0, 1, 2]', cap: 'Same trick, opposite effect from the next scenario: defaults are evaluated once, which is exactly what goes wrong with a mutable default.' }
      ] },
    { label: 'Mutable default', code: ['def add(x, acc=[]):', '    acc.append(x)', '    return acc', 'print(add(1))', 'print(add(2))'],
      steps: [
        { line: 0, scopes: [B, { id: 'G', t: 'Global (module)', v: [['add', 'fn'], ['add.__defaults__', '([],)']] }], chg: ['G.add.__defaults__'], cap: 'The <code>[]</code> is evaluated <b>once</b>, at <code>def</code> time, and stored on the function object.' },
        { line: 1, scopes: [B, { id: 'G', t: 'Global (module)', v: [['add', 'fn'], ['add.__defaults__', '([1],)']] }, { id: 'L', t: 'Local: add(1) call', v: [['x', '1'], ['acc', '→ default']] }], arrows: [['L.acc', 'G.add.__defaults__']], chg: ['G.add.__defaults__'], cap: 'No <code>acc</code> was passed, so the parameter is bound to the stored default list, and <code>append</code> mutates it.' },
        { line: 3, out: '[1]', cap: 'Looks fine.' },
        { line: 1, scopes: [B, { id: 'G', t: 'Global (module)', v: [['add', 'fn'], ['add.__defaults__', '([1, 2],)']] }, { id: 'L', t: 'Local: add(2) call', v: [['x', '2'], ['acc', '→ default']] }], arrows: [['L.acc', 'G.add.__defaults__']], chg: ['G.add.__defaults__'], cap: 'A new call, a new local scope, but the <b>same</b> default list.' },
        { line: 4, out: '[1, 2]', cap: 'State leaks between calls. Fix: <code>acc: list | None = None</code>, then <code>if acc is None: acc = []</code> inside the body.' }
      ] }
  ];

  const W = 640, PAD = 8, BAND = 62, INSET = 14;
  let si = 0, k = 0, gen = 0, running = false, H = 300, depth = 2;
  const segS = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  S.forEach((s, i) => { const b = el('button', { text: s.label, class: i === si ? 'on' : '' }); b.addEventListener('click', () => { si = i; [...segS.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); segS.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'wpy-code' });
  const out = el('div', { class: 'wpy-out' });
  const trail = el('div', { class: 'trail', 'aria-live': 'polite' });
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Nested scopes: built-in outermost, then global, enclosing and local. Name lookups walk outward.' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pysc');
  root.append(el('div', { class: 'w-controls' }, segS),
    el('div', { class: 'wpy-grid' },
      el('div', null, el('div', { class: 'wpy-lbl', text: 'code' }), codeHost, el('div', { class: 'wpy-lbl', text: 'output' }), out),
      el('div', null, el('div', { class: 'wpy-lbl', text: 'scopes (outermost first)' }), trail, el('div', { class: 'w-stage' }, stage))),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  function stateAt(n) {
    let scopes = [], arrows = []; const outs = [];
    for (let i = 0; i < n; i++) {
      const s = S[si].steps[i];
      if (s.scopes) { scopes = s.scopes; arrows = s.arrows || []; } else if (s.arrows) arrows = s.arrows;
      if (s.out != null) outs.push(s.out);
    }
    return { scopes, arrows, outs };
  }
  function render() {
    const sc = S[si]; const n = sc.steps.length; const cur = k ? sc.steps[k - 1] : null;
    const st = stateAt(k);
    codeHost.innerHTML = '';
    sc.code.forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: ln ? IA.highlight(ln, 'python') : '&nbsp;' })));
    out.textContent = st.outs.join('\n');
    const look = cur && cur.look;
    trail.innerHTML = look ? `lookup <b>${look.n}</b>: ` + look.path.map((p) => (p === look.at ? `${NAMES[p]} <b class="${look.err ? 'no' : 'ok'}">${look.err ? '✗ unbound' : '✓'}</b>` : `${NAMES[p]} <b class="no">✗</b>`)).join(' → ') : '&nbsp;';
    stage.setAttribute('viewBox', `0 0 ${W} ${H}`);
    stage.innerHTML = '';
    const chipPos = {}; const chips = svg('g');
    st.scopes.forEach((s, i) => {
      const x = PAD + i * INSET, y = PAD + i * BAND, w = W - 2 * x, h = H - y - PAD - i * 6;
      let cls = 'sc' + (i % 2 ? ' d1' : '');
      const pi = look ? look.path.indexOf(s.id) : -1;
      if (pi >= 0) cls += s.id === look.at ? (look.err ? ' err' : ' found') : ' look';
      const r = svg('rect', { class: cls, x, y, width: w, height: h, rx: 12 });
      if (pi >= 0 && !reduced) r.style.transitionDelay = (pi * 0.35) + 's';
      stage.append(r, svg('text', { x: x + 12, y: y + 17, 'font-size': 12, 'font-weight': 700, fill: 'var(--text-2)', text: s.t }));
      let cx = x + 12;
      s.v.forEach(([nm, val]) => {
        const key = s.id + '.' + nm; const label = `${nm} = ${val}`;
        const cw = Math.max(70, label.length * 7.6 + 18);
        let ccls = 'ch';
        if (look && look.at === s.id && look.n === nm) ccls += look.err ? ' err' : ' hit';
        else if (cur && (cur.chg || []).includes(key)) ccls += ' chg';
        chips.append(svg('rect', { class: ccls, x: cx, y: y + 25, width: cw, height: 26, rx: 7 }),
          svg('text', { x: cx + 9, y: y + 42, 'font-size': 12.5, 'font-family': 'var(--mono)', fill: 'var(--text)', text: label }));
        chipPos[key] = { x: cx, y: y + 25, w: cw, h: 26 };
        cx += cw + 8;
      });
    });
    stage.append(chips);
    st.arrows.forEach(([a, b]) => {
      const p = chipPos[a], q = chipPos[b]; if (!p || !q) return;
      const x1 = p.x + p.w / 2, y1 = q.y < p.y ? p.y : p.y + p.h, x2 = q.x + q.w / 2, y2 = q.y < p.y ? q.y + q.h + 2 : q.y - 2;
      const mx = (x1 + x2) / 2 + 40;
      const path = svg('path', { class: 'ar', d: `M${x1} ${y1} Q ${mx} ${(y1 + y2) / 2} ${x2} ${y2}` });
      const ang = Math.atan2(y2 - (y1 + y2) / 2, x2 - mx);
      const hx = (d, s) => x2 - 10 * Math.cos(ang) + s * 5 * Math.sin(ang);
      const hy = (d, s) => y2 - 10 * Math.sin(ang) - s * 5 * Math.cos(ang);
      stage.append(path, svg('polygon', { class: 'ah', points: `${x2},${y2} ${hx(0, 1)},${hy(0, 1)} ${hx(0, -1)},${hy(0, -1)}` }));
    });
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${n}` }), el('div', { class: 't', html: cur ? cur.cap : 'Press <b>Play</b> or <b>Step</b>. Each box is a scope; inner boxes can see outer ones, never the reverse.' }));
    bStep.disabled = k >= n;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() {
    gen++; stop(); k = 0;
    depth = 1; S[si].steps.forEach((s) => { if (s.scopes) depth = Math.max(depth, s.scopes.length); });
    H = PAD + (depth - 1) * BAND + 62 + PAD + (depth - 1) * 6;
    render();
  }
  function step() { const n = S[si].steps.length; if (k >= n) return false; k++; render(); return k < n; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= S[si].steps.length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2700); }
    if (g === gen) stop();
  });
  reset();
});
