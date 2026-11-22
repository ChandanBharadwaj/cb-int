/* Data model: names (left) are bound to objects (right). Step through aliasing, rebinding,
   is vs ==, a shared nested list and CPython's small-int cache. */
IA.widget('data-model', (root, ctx) => {
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
  if (!document.getElementById('w-pydm-style')) {
    document.head.append(el('style', { id: 'w-pydm-style', text: `
.w-pydm .nm{fill:var(--surface);stroke:var(--border);stroke-width:1.5}
.w-pydm .ob{fill:var(--surface);stroke:var(--border);stroke-width:1.5}
.w-pydm .ob.chg{stroke:var(--warn);stroke-width:2.5;fill:color-mix(in srgb,var(--warn) 12%,var(--surface))}
.w-pydm .ob.cache{stroke-dasharray:5 3}
.w-pydm .ar{fill:none;stroke:var(--accent);stroke-width:2}
.w-pydm .ar.kid{stroke:var(--accent-2)}
.w-pydm .ah{fill:var(--accent)} .w-pydm .ah.kid{fill:var(--accent-2)}
` }));
  }

  // Each step merges into the previous state: names (full list), objs (merged by key), drop, out.
  const S = [
    { label: 'Alias a list', code: ['a = [1, 2]', 'b = a', 'b.append(3)', 'print(a, a is b)', 'b = b + [4]', 'print(a, b, a is b)'],
      steps: [
        { line: 0, names: [['a', 'A']], objs: { A: { t: 'list', v: '[1, 2]', c: 0, r: 0 } }, chg: ['A'], cap: 'Python builds a list object on the heap, then binds the name <code>a</code> to it. A name is a label, not a box that holds the list.' },
        { line: 1, names: [['a', 'A'], ['b', 'A']], cap: '<code>b = a</code> copies the <b>reference</b>. There is still one list, now with two names.' },
        { line: 2, objs: { A: { t: 'list', v: '[1, 2, 3]', c: 0, r: 0 } }, chg: ['A'], cap: '<code>append</code> <b>mutates</b> the object in place. Every name bound to it sees the change.' },
        { line: 3, out: '[1, 2, 3] True', cap: '<code>a</code> shows the new element, and <code>a is b</code> is True: same identity.' },
        { line: 4, names: [['a', 'A'], ['b', 'B']], objs: { B: { t: 'list', v: '[1, 2, 3, 4]', c: 0, r: 1 } }, chg: ['B'], cap: '<code>b + [4]</code> builds a <b>new</b> list, and <code>=</code> rebinds <code>b</code> to it. <code>a</code> is untouched. (<code>b += [4]</code> would have mutated the shared list instead.)' },
        { line: 5, out: '[1, 2, 3] [1, 2, 3, 4] False', cap: 'Mutation changes an object. Assignment changes which object a name points to. Keep those two apart and aliasing stops being surprising.' }
      ] },
    { label: 'Rebind an int', code: ['x = 1000', 'y = x', 'y += 1', 'print(x, y, x is y)'],
      steps: [
        { line: 0, names: [['x', 'A']], objs: { A: { t: 'int', v: '1000', c: 0, r: 0 } }, chg: ['A'], cap: 'An int is an object too, with an identity, a type and a value.' },
        { line: 1, names: [['x', 'A'], ['y', 'A']], cap: 'Two names, one int object. Sharing is harmless here, because an int can never change.' },
        { line: 2, names: [['x', 'A'], ['y', 'B']], objs: { B: { t: 'int', v: '1001', c: 0, r: 1 } }, chg: ['B'], cap: 'ints are <b>immutable</b>, so <code>+=</code> cannot change the object. Python computes a new int and <b>rebinds</b> <code>y</code>.' },
        { line: 3, out: '1000 1001 False', cap: 'Same code shape as the list example, opposite result. Whether <code>+=</code> mutates or rebinds depends on the type (<code>__iadd__</code> exists on list, not on int).' }
      ] },
    { label: 'is vs ==', code: ['a = [1, 2]', 'b = [1, 2]', 'print(a == b)', 'print(a is b)', 'c = None', 'print(c is None)'],
      steps: [
        { line: 0, names: [['a', 'A']], objs: { A: { t: 'list', v: '[1, 2]', c: 0, r: 0 } }, chg: ['A'], cap: 'One list…' },
        { line: 1, names: [['a', 'A'], ['b', 'B']], objs: { B: { t: 'list', v: '[1, 2]', c: 0, r: 1 } }, chg: ['B'], cap: '…and a second, separate list with an equal value. Each list display creates a new object.' },
        { line: 2, out: 'True', cap: '<code>==</code> calls <code>__eq__</code>: list compares element by element. Equal values → True.' },
        { line: 3, out: 'False', cap: '<code>is</code> compares identity: are both names bound to the <i>same</i> object? No.' },
        { line: 4, names: [['a', 'A'], ['b', 'B'], ['c', 'N']], objs: { N: { t: 'NoneType', v: 'None (singleton)', c: 0, r: 2 } }, chg: ['N'], cap: '<code>None</code> is a singleton: one object per interpreter. Every <code>None</code> in your program is that object.' },
        { line: 5, out: 'True', cap: 'That is why <code>x is None</code> is the right test: it can’t be fooled by a custom <code>__eq__</code>, and it is a single pointer comparison.' }
      ] },
    { label: 'Shared rows', code: ['row = [0, 0]', 'grid = [row, row]', 'grid[0][0] = 9', 'print(grid)'],
      steps: [
        { line: 0, names: [['row', 'R']], objs: { R: { t: 'list', v: '[0, 0]', c: 1, r: 0 } }, chg: ['R'], cap: 'One inner list. (Its elements are int objects too; they are shown inline to keep the picture small.)' },
        { line: 1, names: [['row', 'R'], ['grid', 'G']], objs: { G: { t: 'list', v: '[ •, • ]', c: 0, r: 1, kids: ['R', 'R'] } }, chg: ['G'], cap: 'The outer list stores <b>two references to the same</b> inner list. This is exactly what <code>[[0] * 2] * 2</code> builds.' },
        { line: 2, objs: { R: { t: 'list', v: '[9, 0]', c: 1, r: 0 } }, chg: ['R'], cap: '<code>grid[0]</code> is that one inner list, so the write lands in the shared object.' },
        { line: 3, out: '[[9, 0], [9, 0]]', cap: 'Both “rows” changed. Build independent rows with a comprehension: <code>[[0] * 2 for _ in range(2)]</code>.' }
      ] },
    { label: 'Small-int cache', code: ['a = int("256")', 'b = int("256")', 'print(a is b)', 'c = int("257")', 'd = int("257")', 'print(c is d)'],
      steps: [
        { line: 0, names: [['a', 'K']], objs: { K: { t: 'int · cached', v: '256', c: 0, r: 0, cache: true } }, chg: ['K'], cap: 'CPython pre-allocates the ints −5 to 256 at start-up. <code>int("256")</code> returns the cached object instead of allocating.' },
        { line: 1, names: [['a', 'K'], ['b', 'K']], cap: 'Same cached object again.' },
        { line: 2, out: 'True', cap: 'So <code>a is b</code> is True. This is a CPython implementation detail, not a language guarantee.' },
        { line: 3, names: [['a', 'K'], ['b', 'K'], ['c', 'P']], objs: { P: { t: 'int', v: '257', c: 0, r: 2 } }, chg: ['P'], cap: '257 is outside the cache: a new int object is allocated.' },
        { line: 4, names: [['a', 'K'], ['b', 'K'], ['c', 'P'], ['d', 'Q']], objs: { Q: { t: 'int', v: '257', c: 0, r: 3 } }, chg: ['Q'], cap: 'And another one, with an equal value.' },
        { line: 5, out: 'False', cap: 'Equal values, different objects. Literals in the same code block may still share one constant, which is why <code>257 is 257</code> can look True. Never use <code>is</code> for numbers or strings; use <code>==</code>.' }
      ] }
  ];

  const W = 640, RH = 58, TOP = 26, NX = 10, NW = 92, OX = [190, 430], OW = 200, OH = 44;
  let si = 0, k = 0, gen = 0, running = false, H = 200;
  const segS = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  S.forEach((s, i) => { const b = el('button', { text: s.label, class: i === si ? 'on' : '' }); b.addEventListener('click', () => { si = i; [...segS.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); segS.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'wpy-code' });
  const out = el('div', { class: 'wpy-out' });
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Names on the left with arrows to the objects they are bound to on the right' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pydm');
  root.append(el('div', { class: 'w-controls' }, segS),
    el('div', { class: 'wpy-grid' },
      el('div', null, el('div', { class: 'wpy-lbl', text: 'code' }), codeHost, el('div', { class: 'wpy-lbl', text: 'output' }), out),
      el('div', null, el('div', { class: 'wpy-lbl', text: 'names → objects' }), el('div', { class: 'w-stage' }, stage))),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  function stateAt(n) {
    let names = [], objs = {}; const outs = [];
    for (let i = 0; i < n; i++) {
      const s = S[si].steps[i];
      if (s.names) names = s.names;
      if (s.objs) objs = Object.assign({}, objs, s.objs);
      (s.drop || []).forEach((d) => delete objs[d]);
      if (s.out != null) outs.push(s.out);
    }
    return { names, objs, outs };
  }
  const arrowHead = (x, y, cls) => svg('polygon', { class: 'ah' + (cls ? ' ' + cls : ''), points: `${x},${y} ${x - 9},${y - 5} ${x - 9},${y + 5}` });
  function curve(x1, y1, x2, y2, cls, animate) {
    const mx = (x1 + x2) / 2;
    const p = svg('path', { class: 'ar' + (cls ? ' ' + cls : ''), d: `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 8} ${y2}` });
    if (animate && !reduced) { p.style.strokeDasharray = '600'; p.style.strokeDashoffset = '600'; p.style.transition = 'stroke-dashoffset .8s ease'; requestAnimationFrame(() => requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; })); }
    return [p, arrowHead(x2, y2, cls)];
  }
  function render() {
    const sc = S[si]; const n = sc.steps.length; const cur = k ? sc.steps[k - 1] : null;
    const st = stateAt(k); const prev = stateAt(Math.max(0, k - 1));
    codeHost.innerHTML = '';
    sc.code.forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: ln ? IA.highlight(ln, 'python') : '&nbsp;' })));
    out.textContent = st.outs.join('\n');
    stage.setAttribute('viewBox', `0 0 ${W} ${H}`);
    stage.innerHTML = '';
    stage.append(svg('text', { x: NX, y: 14, 'font-size': 11, fill: 'var(--text-3)', text: 'NAMES' }), svg('text', { x: OX[0], y: 14, 'font-size': 11, fill: 'var(--text-3)', text: 'OBJECTS (identity · type · value)' }));
    const pos = {};
    Object.keys(st.objs).forEach((key) => { const o = st.objs[key]; pos[key] = { x: OX[o.c], y: TOP + o.r * RH }; });
    const arrows = svg('g');
    // objects
    Object.keys(st.objs).forEach((key) => {
      const o = st.objs[key]; const p = pos[key];
      const chg = cur && (cur.chg || []).includes(key);
      stage.append(svg('rect', { class: 'ob' + (chg ? ' chg' : '') + (o.cache ? ' cache' : ''), x: p.x, y: p.y, width: OW, height: OH, rx: 8 }),
        svg('text', { x: p.x + 10, y: p.y + 16, 'font-size': 11, fill: 'var(--text-3)', text: `id ${key} · ${o.t}` }),
        svg('text', { x: p.x + 10, y: p.y + 35, 'font-size': 15, 'font-family': 'var(--mono)', fill: 'var(--text)', text: o.v }));
      (o.kids || []).forEach((kid, j) => {
        const q = pos[kid]; if (!q) return;
        const sy = p.y + 14 + j * 16; const ey = q.y + 15 + j * 14;
        const was = prev.objs[key] && (prev.objs[key].kids || [])[j] === kid;
        arrows.append(...curve(p.x + OW - 30 + j * 8, sy, q.x, ey, 'kid', !was));
      });
    });
    // names
    st.names.forEach(([nm, key], i) => {
      const y = TOP + i * RH + 5;
      stage.append(svg('rect', { class: 'nm', x: NX, y, width: NW, height: 34, rx: 17 }),
        svg('text', { x: NX + NW / 2, y: y + 22, 'text-anchor': 'middle', 'font-size': 15, 'font-family': 'var(--mono)', 'font-weight': 700, fill: 'var(--text)', text: nm }));
      const q = pos[key]; if (!q) return;
      const old = prev.names.find(([m]) => m === nm);
      arrows.append(...curve(NX + NW, y + 17, q.x, q.y + OH / 2 + 4, '', !old || old[1] !== key));
    });
    stage.append(arrows);
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${n}` }), el('div', { class: 't', html: cur ? cur.cap : 'Press <b>Play</b> or <b>Step</b> to run the code one line at a time.' }));
    bStep.disabled = k >= n;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() {
    gen++; stop(); k = 0;
    let rows = 1;
    const all = stateAt(S[si].steps.length);
    S[si].steps.forEach((s) => { if (s.names) rows = Math.max(rows, s.names.length); });
    Object.values(all.objs).forEach((o) => { rows = Math.max(rows, o.r + 1); });
    H = TOP + rows * RH;
    render();
  }
  function step() { const n = S[si].steps.length; if (k >= n) return false; k++; render(); return k < n; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= S[si].steps.length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2600); }
    if (g === gen) stop();
  });
  reset();
});
