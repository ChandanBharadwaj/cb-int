/* dbx-unity-catalog: step-through diagram (generated layout, edit freely). */
IA.widget('dbx-unity-catalog', (root, ctx) => {
  const S = {
 "H": 320,
 "aria": "Unity Catalog hierarchy and privilege check",
 "modes": [
  {
   "name": "Privilege check",
   "intro": "Ana runs <code>SELECT * FROM main.sales.orders</code>. Step through the checks.",
   "nodes": [
    {
     "id": "ms",
     "x": 20,
     "y": 20,
     "w": 720,
     "h": 44,
     "t": "Metastore (one per region)",
     "s": "top container, attached to workspaces"
    },
    {
     "id": "cat",
     "x": 20,
     "y": 90,
     "w": 230,
     "h": 60,
     "t": "Catalog: main",
     "s": "needs USE CATALOG"
    },
    {
     "id": "sch",
     "x": 265,
     "y": 90,
     "w": 230,
     "h": 60,
     "t": "Schema: sales",
     "s": "needs USE SCHEMA"
    },
    {
     "id": "tb",
     "x": 510,
     "y": 90,
     "w": 230,
     "h": 60,
     "t": "Table: orders",
     "s": "needs SELECT"
    },
    {
     "id": "vol",
     "x": 265,
     "y": 180,
     "w": 230,
     "h": 56,
     "t": "Volume: sales.raw",
     "s": "files: /Volumes/main/sales/raw"
    },
    {
     "id": "loc",
     "x": 510,
     "y": 180,
     "w": 230,
     "h": 56,
     "t": "External location",
     "s": "s3://… + storage credential"
    },
    {
     "id": "res",
     "x": 20,
     "y": 260,
     "w": 720,
     "h": 44,
     "t": "Result",
     "s": ""
    }
   ],
   "edges": [
    {
     "id": "a",
     "a": "cat",
     "b": "sch"
    },
    {
     "id": "b",
     "a": "sch",
     "b": "tb"
    },
    {
     "id": "c",
     "a": "sch",
     "b": "vol"
    }
   ],
   "steps": [
    {
     "hot": [
      "ms"
     ],
     "t": "Every securable lives in a <b>metastore</b>. Names are three levels: <code>catalog.schema.object</code>."
    },
    {
     "ok": [
      "cat"
     ],
     "edges": [
      "a"
     ],
     "sub": {
      "cat": "USE CATALOG ✓ (group analysts)"
     },
     "t": "Check 1: Ana’s group has <code>USE CATALOG</code> on <code>main</code>. It grants no data by itself; it only lets her “walk in”."
    },
    {
     "bad": [
      "sch"
     ],
     "sub": {
      "sch": "USE SCHEMA ✗"
     },
     "sub2": 1,
     "t": "Check 2 fails: no <code>USE SCHEMA</code> on <code>sales</code>. Even a direct <code>SELECT</code> grant on the table would not help."
    },
    {
     "ok": [
      "sch"
     ],
     "edges": [
      "a",
      "b"
     ],
     "sub": {
      "sch": "USE SCHEMA ✓ (granted)"
     },
     "t": "An owner runs <code>GRANT USE SCHEMA ON SCHEMA main.sales TO analysts</code>."
    },
    {
     "ok": [
      "tb",
      "res"
     ],
     "edges": [
      "b"
     ],
     "sub": {
      "tb": "SELECT ✓ (inherited from catalog)",
      "res": "rows returned · access logged in system.access.audit"
     },
     "t": "Check 3: <code>SELECT</code> can be granted on the table, or on the schema/catalog and <b>inherited</b> downward. Query runs; audit and lineage are recorded."
    },
    {
     "hot": [
      "vol",
      "loc"
     ],
     "edges": [
      "c"
     ],
     "t": "<b>Volumes</b> govern non-tabular files under the same names and grants (<code>READ VOLUME</code>). <b>External locations</b> + storage credentials govern raw cloud paths."
    }
   ]
  }
 ]
};
  const { el, svg, sleep, reduced } = ctx;
  const modes = S.modes; let mi = 0; let k = -1; let running = false; let gen = 0;
  const W = S.W || 760, H = S.H || 300;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': S.aria });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: '' }));
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const lbl = el('span', { class: 'tiny' });
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  modes.forEach((m, i) => { const b = el('button', { text: m.name, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { mi = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); seg.append(b); });
  if (modes.length > 1) root.append(el('div', { class: 'w-controls' }, seg));
  root.append(el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, lbl), narr);
  const N = (id) => modes[mi].nodes.find((n) => n.id === id);
  function anchor(a, b) {
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    if (Math.abs(bx - ax) * a.h > Math.abs(by - ay) * a.w) return [[bx > ax ? a.x + a.w : a.x, ay], [bx > ax ? b.x : b.x + b.w, by]];
    return [[ax, by > ay ? a.y + a.h : a.y], [bx, by > ay ? b.y : b.y + b.h]];
  }
  function draw() {
    const m = modes[mi]; const s = k >= 0 ? m.steps[k] : { hot: [], edges: [] };
    const subs = {}; for (let i = 0; i <= k; i++) Object.assign(subs, m.steps[i].sub || {});
    stage.innerHTML = '';
    (m.labels || []).forEach((t) => stage.append(svg('text', { x: t.x, y: t.y, 'font-size': t.s || 12, 'font-weight': 700, fill: 'var(--text-3)', text: t.t })));
    (m.edges || []).forEach((e) => {
      const [p, q] = anchor(N(e.a), N(e.b)); const on = (s.edges || []).includes(e.id);
      const col = on ? (e.bad && on ? 'var(--err)' : 'var(--accent)') : 'var(--edge)';
      const ln = svg('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: col, 'stroke-width': on ? 3 : 1.5, 'stroke-dasharray': on ? '' : '5 4' });
      if (on && !reduced) { ln.style.strokeDasharray = '600'; ln.style.strokeDashoffset = '600'; ln.style.transition = 'stroke-dashoffset .8s ease'; requestAnimationFrame(() => { ln.style.strokeDashoffset = '0'; }); }
      stage.append(ln, svg('circle', { cx: q[0], cy: q[1], r: on ? 4.5 : 3, fill: col }));
      if (e.t) stage.append(svg('text', { x: (p[0] + q[0]) / 2 + 4, y: (p[1] + q[1]) / 2 - 5, 'font-size': 10.5, fill: on ? 'var(--accent)' : 'var(--text-3)', text: e.t }));
    });
    m.nodes.forEach((n) => {
      const hot = (s.hot || []).includes(n.id), bad = (s.bad || []).includes(n.id), ok = (s.ok || []).includes(n.id);
      const stroke = bad ? 'var(--err)' : ok ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)';
      stage.append(svg('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 9, fill: hot || bad || ok ? 'var(--accent-soft)' : 'var(--surface)', stroke, 'stroke-width': hot || bad || ok ? 2.5 : 1.2 }));
      stage.append(svg('text', { x: n.x + 10, y: n.y + 19, 'font-size': 13, 'font-weight': 700, fill: n.c ? `var(${n.c})` : 'var(--text)', text: n.t }));
      String(subs[n.id] != null ? subs[n.id] : (n.s || '')).split('\n').forEach((line, i) => stage.append(svg('text', { x: n.x + 10, y: n.y + 36 + i * 14, 'font-size': 11, 'font-family': 'var(--mono)', fill: subs[n.id] != null ? 'var(--text)' : 'var(--text-2)', text: line })));
    });
    narr.firstChild.innerHTML = k >= 0 ? m.steps[k].t : (m.intro || 'Press Play, or Step through one stage at a time.');
    lbl.textContent = `step ${Math.max(k + 1, 0)} / ${m.steps.length}`;
    bStep.disabled = k >= m.steps.length - 1;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = reduced ? modes[mi].steps.length - 1 : -1; draw(); }
  function step() { if (k >= modes[mi].steps.length - 1) return false; k++; draw(); return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', () => { reset(); if (reduced) { k = -1; draw(); } });
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= modes[mi].steps.length - 1) { k = -1; draw(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : 2300);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
