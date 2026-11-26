/* dbx-declarative-pipelines: step-through diagram (generated layout, edit freely). */
IA.widget('dbx-declarative-pipelines', (root, ctx) => {
  const S = {
 "H": 330,
 "aria": "Declarative pipeline graph with expectations and AUTO CDC",
 "modes": [
  {
   "name": "Pipeline graph",
   "nodes": [
    {
     "id": "f",
     "x": 20,
     "y": 30,
     "w": 150,
     "h": 64,
     "t": "cloud files",
     "s": "/Volumes/…/orders"
    },
    {
     "id": "b",
     "x": 210,
     "y": 30,
     "w": 160,
     "h": 64,
     "t": "bronze_orders",
     "s": "STREAMING TABLE"
    },
    {
     "id": "s",
     "x": 410,
     "y": 30,
     "w": 160,
     "h": 64,
     "t": "silver_orders",
     "s": "STREAMING TABLE"
    },
    {
     "id": "g",
     "x": 610,
     "y": 30,
     "w": 130,
     "h": 64,
     "t": "gold_daily",
     "s": "MATERIALIZED VIEW"
    },
    {
     "id": "ex",
     "x": 410,
     "y": 150,
     "w": 160,
     "h": 64,
     "t": "Expectations",
     "s": "valid_amount"
    },
    {
     "id": "ev",
     "x": 20,
     "y": 250,
     "w": 720,
     "h": 54,
     "t": "Event log",
     "s": "every update, row counts, expectation metrics"
    }
   ],
   "edges": [
    {
     "id": "e1",
     "a": "f",
     "b": "b"
    },
    {
     "id": "e2",
     "a": "b",
     "b": "s"
    },
    {
     "id": "e3",
     "a": "s",
     "b": "g"
    },
    {
     "id": "e4",
     "a": "s",
     "b": "ex"
    }
   ],
   "steps": [
    {
     "hot": [
      "f",
      "b",
      "s",
      "g"
     ],
     "t": "You declare <b>datasets</b>, not tasks. The engine reads the queries, finds dependencies and builds this graph."
    },
    {
     "hot": [
      "b"
     ],
     "edges": [
      "e1"
     ],
     "sub": {
      "b": "+500 new rows\n(only new files)"
     },
     "t": "A <b>streaming table</b> processes each input row once (incremental, append-style), here via Auto Loader."
    },
    {
     "hot": [
      "s",
      "ex"
     ],
     "edges": [
      "e2",
      "e4"
     ],
     "sub": {
      "s": "+497 rows",
      "ex": "3 rows dropped\n(amount < 0)"
     },
     "t": "<b>Expectations</b> are data-quality rules: warn (keep), drop the row, or fail the update. Counts land in the event log."
    },
    {
     "hot": [
      "g"
     ],
     "edges": [
      "e3"
     ],
     "sub": {
      "g": "recomputed\n(incrementally if possible)"
     },
     "t": "A <b>materialized view</b> always reflects its query. On serverless the engine refreshes it incrementally when it can, otherwise fully."
    },
    {
     "hot": [
      "ev"
     ],
     "t": "Every update writes to the <b>event log</b>: lineage, timings, quality metrics. Query it for monitoring."
    }
   ]
  },
  {
   "name": "AUTO CDC",
   "intro": "Change events for customer 7 arrive out of order. Watch SEQUENCE BY sort it out.",
   "nodes": [
    {
     "id": "in",
     "x": 20,
     "y": 30,
     "w": 330,
     "h": 150,
     "t": "CDC feed (arrival order)",
     "s": ""
    },
    {
     "id": "t",
     "x": 410,
     "y": 30,
     "w": 330,
     "h": 150,
     "t": "customers (SCD 1 target)",
     "s": "(empty)"
    },
    {
     "id": "r",
     "x": 20,
     "y": 220,
     "w": 720,
     "h": 70,
     "t": "Rule",
     "s": "KEYS (id) · SEQUENCE BY seq · APPLY AS DELETE WHEN op = \"D\""
    }
   ],
   "edges": [
    {
     "id": "a",
     "a": "in",
     "b": "t"
    }
   ],
   "steps": [
    {
     "hot": [
      "in"
     ],
     "sub": {
      "in": "seq 1  INSERT  7 Pune"
     },
     "edges": [
      "a"
     ],
     "ok": [
      "t"
     ],
     "t": "Event seq 1 inserts customer 7."
    },
    {
     "hot": [
      "in"
     ],
     "sub": {
      "in": "seq 1  INSERT  7 Pune\nseq 3  UPDATE  7 Delhi"
     },
     "ok": [
      "t"
     ],
     "edges": [
      "a"
     ],
     "t": "seq 3 arrives early."
    },
    {
     "hot": [
      "in",
      "t"
     ],
     "sub": {
      "t": "7 | Delhi   (seq 3)"
     },
     "edges": [
      "a"
     ],
     "t": "Target now shows the latest sequence seen: Delhi."
    },
    {
     "bad": [
      "in"
     ],
     "sub": {
      "in": "seq 1  INSERT  7 Pune\nseq 3  UPDATE  7 Delhi\nseq 2  UPDATE  7 Austin (late)"
     },
     "t": "seq 2 arrives <b>late</b>. A naive “last write wins” MERGE would overwrite Delhi with Austin."
    },
    {
     "ok": [
      "t",
      "r"
     ],
     "sub": {
      "t": "7 | Delhi   (seq 3) ✓\nlate seq 2 ignored for SCD 1"
     },
     "t": "<b>AUTO CDC</b> (formerly APPLY CHANGES) orders by <code>SEQUENCE BY</code>, so the stale event loses. With SCD 2 it would be inserted as a historical row instead."
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
