/* Memory & GC: names → heap objects with live refcount badges. An acyclic object dies at refcount 0;
   an A↔B cycle survives `del` until gc.collect() runs its passes (copy refcounts → subtract internal
   references → mark from roots → free the rest). Toggle b.peer to a weakref to avoid the cycle. */
IA.widget('memory-gc', (root, ctx) => {
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
  if (!document.getElementById('w-pygc-style')) {
    document.head.append(el('style', { id: 'w-pygc-style', text: `
.w-pygc .nm{fill:var(--surface-2);stroke:var(--border);stroke-width:1.5}
.w-pygc .ob{fill:var(--surface);stroke:var(--border);stroke-width:1.5;transition:all .35s}
.w-pygc .ob.hot{stroke:var(--accent);stroke-width:3;fill:var(--accent-soft)}
.w-pygc .ob.leak{stroke:var(--err);stroke-width:2.5;stroke-dasharray:6 4}
.w-pygc .ob.root{stroke:var(--ok);stroke-width:3;fill:color-mix(in srgb,var(--ok) 14%,var(--surface))}
.w-pygc .ob.unr{stroke:var(--err);stroke-width:3;fill:color-mix(in srgb,var(--err) 14%,var(--surface))}
.w-pygc .gone{opacity:.18;transition:opacity .5s}
.w-pygc .rc{fill:var(--accent)} .w-pygc .rc.zero{fill:var(--err)}
.w-pygc .gr{fill:var(--warn)}
.w-pygc .ar{fill:none;stroke:var(--accent);stroke-width:2}
.w-pygc .ar.int{stroke:var(--accent-2)}
.w-pygc .ar.weak{stroke:var(--text-3);stroke-dasharray:5 4}
.w-pygc .ar.sub{stroke:var(--warn);stroke-width:3}
.w-pygc .ah{fill:var(--accent)} .w-pygc .ah.int{fill:var(--accent-2)} .w-pygc .ah.weak{fill:var(--text-3)} .w-pygc .ah.sub{fill:var(--warn)}
.w-pygc .gen{fill:var(--surface-2);stroke:var(--border)} .w-pygc .gen.hot{stroke:var(--accent);stroke-width:2}
` }));
  }

  const POS = { A: [230, 18], B: [470, 18], C: [230, 118], K: [230, 208], M: [470, 208] };
  const NPOS = { a: 22, b: 78, c: 134, k: 222 };
  const OW = 140, OH = 50;
  let mode = 'strong', k = 0, gen = 0, running = false, STEPS = [];

  function build(m) {
    const weak = m === 'weak';
    const S = []; const st = { names: {}, objs: {}, edges: [], g: [[], [], []], out: [] };
    const snap = (line, cap, extra) => S.push(Object.assign(JSON.parse(JSON.stringify(st)), { line, cap }, extra || {}));
    const mk = (id) => { st.objs[id] = { rc: 0, state: 'live' }; st.g[0].push(id); };
    const inc = (id, d) => { st.objs[id].rc += d; };
    const free = (id) => { st.objs[id].state = 'gone'; st.objs[id].rc = 0; st.g = st.g.map((l) => l.filter((x) => x !== id)); st.edges = st.edges.filter((e) => e[0] !== id && e[1] !== id); };
    mk('A'); st.names.a = 'A'; inc('A', 1);
    snap(0, '<code>Node("A")</code> allocates an object whose header says <b>refcount 1</b>: the name <code>a</code>. It is a container, so the cycle collector also starts tracking it in <b>generation 0</b>.', { hot: ['A'] });
    mk('B'); st.names.b = 'B'; inc('B', 1);
    snap(1, 'Same for B. Two names, two objects, each with one reference.', { hot: ['B'] });
    st.edges.push(['A', 'B', false]); inc('B', 1);
    snap(2, '<code>a.peer = b</code> stores a reference inside A, so B’s count goes to <b>2</b>: one from the name <code>b</code>, one from A’s attribute.', { hot: ['B'] });
    if (weak) { st.edges.push(['B', 'A', true]);
      snap(3, '<code>b.peer = weakref.ref(a)</code> points back at A <b>without counting</b>. A stays at refcount 1. There is no strong cycle.', { hot: ['A'] }); }
    else { st.edges.push(['B', 'A', false]); inc('A', 1);
      snap(3, '<code>b.peer = a</code> closes the loop: A is now at <b>2</b> too. A and B form a <b>reference cycle</b>.', { hot: ['A'] }); }
    mk('C'); st.names.c = 'C'; inc('C', 1);
    snap(4, 'C is an ordinary object with no cycle: refcount 1.', { hot: ['C'] });
    delete st.names.c; free('C');
    snap(5, '<code>del c</code> drops the only reference. The count hits <b>0</b> and CPython frees C <b>right now</b>, inside this statement. No garbage collector was involved, and this is how most Python objects die.', { zero: ['C'] });
    mk('K'); mk('M'); st.names.k = 'K'; inc('K', 1); st.edges.push(['K', 'M', false]); inc('M', 1);
    snap(6, 'K is held by the name <code>k</code>, and M only by K’s attribute. Neither is in a cycle; we keep them to see how the collector treats <b>live</b> objects.', { hot: ['K', 'M'] });
    if (weak) {
      delete st.names.a; delete st.names.b; free('A'); free('B');
      snap(7, '<code>del a</code>: A’s count drops to 0, so A is freed and its reference to B is released (B: 2 → 1). <code>del b</code>: B hits 0 and is freed too. The weakref in B was simply cleared. <b>No collector needed.</b>', { zero: ['A', 'B'] });
    } else {
      delete st.names.a; delete st.names.b; inc('A', -1); inc('B', -1);
      snap(7, '<code>del a, b</code> removes both names, but each object is still referenced <b>by the other</b>: refcount 1 each. Nothing in your program can reach them, yet refcounting will never free them. They wait for the cycle collector.', { leak: ['A', 'B'] });
    }
    const members = st.g[0].slice();
    const gcr = {}; members.forEach((id) => { gcr[id] = st.objs[id].rc; });
    snap(8, '<b>Pass 1.</b> <code>gc.collect()</code> copies each tracked object’s refcount into a scratch field, <code>gc_refs</code> (orange badges).', { gcr: Object.assign({}, gcr), hotGen: 0 });
    const internal = st.edges.filter((e) => !e[2] && members.includes(e[0]) && members.includes(e[1]));
    internal.forEach((e) => { gcr[e[1]] -= 1; });
    snap(8, '<b>Pass 2.</b> For every object in the generation, visit what it references and subtract 1 from each target that is also in the generation (orange arrows). What remains counts only references from <b>outside</b>: names, older objects, C code.', { gcr: Object.assign({}, gcr), sub: internal.map((e) => e[0] + e[1]), hotGen: 0 });
    const roots = members.filter((id) => gcr[id] > 0);
    const reach = new Set(roots); let grew = true;
    while (grew) { grew = false; st.edges.forEach((e) => { if (!e[2] && reach.has(e[0]) && !reach.has(e[1])) { reach.add(e[1]); grew = true; } }); }
    const unr = members.filter((id) => !reach.has(id));
    snap(8, '<b>Pass 3.</b> Objects with <code>gc_refs &gt; 0</code> are <b>roots</b> (green): K, because the name <code>k</code> holds it. Everything reachable from a root is alive too, so M is rescued even though its <code>gc_refs</code> was 0.' + (unr.length ? ' A and B have 0 and no root reaches them: <b>unreachable</b> (red).' : ' Nothing is unreachable this time.'), { gcr: Object.assign({}, gcr), roots, reach: [...reach].filter((x) => !roots.includes(x)), unr, hotGen: 0 });
    if (unr.length) {
      unr.forEach((id) => free(id));
      st.out.push('# A and B finalized and freed');
      snap(8, 'The collector runs finalizers (<code>__del__</code>, weakref callbacks), then clears the references inside the unreachable objects. That breaks the cycle, both counts drop to 0, and ordinary refcounting frees them.', { zero: unr, hotGen: 0 });
    }
    st.g[1] = st.g[1].concat(st.g[0]); st.g[0] = [];
    snap(8, 'Survivors K and M are <b>promoted to generation 1</b>, which is scanned 10× less often; gen 2 another 10× less. Most objects die young, so the collector spends its time on new ones. Default thresholds in 3.12/3.13: <code>(700, 10, 10)</code>.', { hotGen: 1 });
    return S;
  }

  const CODE = (m) => ['a = Node("A")', 'b = Node("B")', 'a.peer = b', m === 'weak' ? 'b.peer = weakref.ref(a)' : 'b.peer = a', 'c = Node("C")', 'del c', 'k = Node("K"); k.child = Node("M")', 'del a, b', 'gc.collect()'];
  const segM = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Back reference' });
  [['strong', 'b.peer = a (cycle)'], ['weak', 'b.peer = weakref.ref(a)']].forEach(([v, l]) => {
    const b = el('button', { text: l, class: v === mode ? 'on' : '' });
    b.addEventListener('click', () => { mode = v; [...segM.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); });
    segM.append(b);
  });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'wpy-code' });
  const out = el('div', { class: 'wpy-out' });
  const stage = svg('svg', { viewBox: '0 0 640 340', role: 'img', 'aria-label': 'Names pointing at heap objects with reference counts, and three GC generations' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pygc');
  root.append(el('div', { class: 'w-controls' }, segM),
    el('div', { class: 'wpy-grid' },
      el('div', null, el('div', { class: 'wpy-lbl', text: 'code' }), codeHost, el('div', { class: 'wpy-lbl', text: 'notes' }), out),
      el('div', null, el('div', { class: 'wpy-lbl', text: 'names → heap' }), el('div', { class: 'w-stage' }, stage))),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  function arrow(x1, y1, x2, y2, cls, bend) {
    const mx = (x1 + x2) / 2 + (bend ? bend[0] : 0), my = (y1 + y2) / 2 + (bend ? bend[1] : 0);
    const p = svg('path', { class: 'ar ' + cls, d: `M${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}` });
    const ang = Math.atan2(y2 - my, x2 - mx), s = 8;
    const pts = [[x2, y2], [x2 - s * Math.cos(ang - 0.45), y2 - s * Math.sin(ang - 0.45)], [x2 - s * Math.cos(ang + 0.45), y2 - s * Math.sin(ang + 0.45)]];
    return [p, svg('polygon', { class: 'ah ' + cls, points: pts.map((q) => q.join(',')).join(' ') })];
  }
  function render() {
    const cur = k ? STEPS[k - 1] : null; const n = STEPS.length;
    const code = CODE(mode);
    codeHost.innerHTML = '';
    code.forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: IA.highlight(ln, 'python') })));
    out.textContent = cur ? (cur.out.join('\n') || ' ') : ' ';
    stage.innerHTML = '';
    stage.append(svg('text', { x: 22, y: 12, 'font-size': 11, fill: 'var(--text-3)', text: 'names' }), svg('text', { x: 230, y: 12, 'font-size': 11, fill: 'var(--text-3)', text: 'heap objects (badge = refcount)' }));
    if (cur) {
      // names
      Object.entries(NPOS).forEach(([nm, y]) => {
        const has = cur.names[nm];
        const g = svg('g', { class: has ? '' : 'gone' });
        g.append(svg('rect', { class: 'nm', x: 22, y, width: 64, height: 30, rx: 7 }), svg('text', { x: 54, y: y + 20, 'text-anchor': 'middle', 'font-family': 'var(--mono)', 'font-size': 14, fill: 'var(--text)', text: nm }));
        stage.append(g);
        if (has) { const [ox, oy] = POS[has]; stage.append(...arrow(86, y + 15, ox, oy + OH / 2, '', nm === 'b' ? [0, 50] : [0, 0])); }
      });
      // edges
      cur.edges.forEach(([f, t, w]) => {
        const [fx, fy] = POS[f], [tx, ty] = POS[t];
        const sub = cur.sub && cur.sub.includes(f + t);
        const cls = w ? 'weak' : sub ? 'sub' : 'int';
        if (f === 'A' && t === 'B') stage.append(...arrow(fx + OW, fy + 16, tx, ty + 16, cls, [0, -14]));
        else if (f === 'B' && t === 'A') stage.append(...arrow(fx, fy + OH - 10, tx + OW, ty + OH - 10, cls, [0, 22]));
        else stage.append(...arrow(fx + OW, fy + OH / 2, tx, ty + OH / 2, cls));
      });
      // objects
      Object.entries(POS).forEach(([id, [x, y]]) => {
        const o = cur.objs[id]; if (!o) return;
        const gone = o.state === 'gone';
        let cls = 'ob';
        if ((cur.hot || []).includes(id)) cls += ' hot';
        if ((cur.leak || []).includes(id)) cls += ' leak';
        if ((cur.roots || []).includes(id) || (cur.reach || []).includes(id)) cls += ' root';
        if ((cur.unr || []).includes(id) || (cur.zero || []).includes(id)) cls += ' unr';
        const g = svg('g', { class: gone && !(cur.zero || []).includes(id) ? 'gone' : '' });
        g.append(svg('rect', { class: cls, x, y, width: OW, height: OH, rx: 9 }),
          svg('text', { x: x + 12, y: y + 22, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: 'Node ' + id }),
          svg('text', { x: x + 12, y: y + 40, 'font-size': 11, fill: 'var(--text-3)', text: gone ? 'freed' : (cur.roots || []).includes(id) ? 'root' : (cur.reach || []).includes(id) ? 'reachable' : (cur.unr || []).includes(id) ? 'unreachable' : 'tracked' }),
          svg('circle', { class: 'rc' + (o.rc === 0 ? ' zero' : ''), cx: x + OW - 16, cy: y + 16, r: 12 }),
          svg('text', { x: x + OW - 16, y: y + 21, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#fff', text: String(o.rc) }));
        if (cur.gcr && id in cur.gcr && !gone) g.append(svg('circle', { class: 'gr', cx: x + OW - 16, cy: y + OH - 4, r: 11 }), svg('text', { x: x + OW - 16, y: y + OH + 1, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: '#fff', text: String(cur.gcr[id]) }));
        stage.append(g);
      });
      // generations
      ['gen 0', 'gen 1', 'gen 2'].forEach((lab, i) => {
        const x = 22 + i * 206, y = 284;
        stage.append(svg('rect', { class: 'gen' + (cur.hotGen === i ? ' hot' : ''), x, y, width: 196, height: 46, rx: 8 }),
          svg('text', { x: x + 10, y: y + 18, 'font-size': 12, 'font-weight': 700, fill: 'var(--text-2)', text: lab + (i === 0 ? '  (threshold 700)' : '  (every 10 of gen ' + (i - 1) + ')') }),
          svg('text', { x: x + 10, y: y + 37, 'font-family': 'var(--mono)', 'font-size': 13, fill: 'var(--text)', text: cur.g[i].length ? cur.g[i].join(' ') : '—' }));
      });
    } else {
      stage.append(svg('text', { x: 320, y: 170, 'text-anchor': 'middle', 'font-size': 14, fill: 'var(--text-3)', text: 'Press Play or Step' }));
    }
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${n}` }), el('div', { class: 't', html: cur ? cur.cap : 'Press <b>Play</b> or <b>Step</b>. Lines 1–8 are refcounting at work; the last line runs the cycle collector in several passes.' }));
    bStep.disabled = k >= n;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); STEPS = build(mode); k = 0; render(); }
  function step() { if (k >= STEPS.length) return false; k++; render(); return k < STEPS.length; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= STEPS.length) { k = 0; render(); }
    if (reduced) { k = STEPS.length; render(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(2600); }
    if (g === gen) stop();
  });
  reset();
});
