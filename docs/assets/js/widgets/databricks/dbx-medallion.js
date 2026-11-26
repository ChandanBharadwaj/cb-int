/* dbx-medallion: step-through diagram (generated layout, edit freely). */
IA.widget('dbx-medallion', (root, ctx) => {
  const S = {
 "H": 300,
 "aria": "Bronze silver gold flow with replay and SCD type 2",
 "modes": [
  {
   "name": "Bronze → Silver → Gold",
   "nodes": [
    {
     "id": "src",
     "x": 20,
     "y": 110,
     "w": 120,
     "h": 70,
     "t": "Sources",
     "s": "files, Kafka,\nCDC"
    },
    {
     "id": "b",
     "x": 170,
     "y": 110,
     "w": 170,
     "h": 70,
     "t": "Bronze",
     "s": "raw, append-only"
    },
    {
     "id": "s",
     "x": 370,
     "y": 110,
     "w": 170,
     "h": 70,
     "t": "Silver",
     "s": "clean, deduped"
    },
    {
     "id": "g",
     "x": 570,
     "y": 110,
     "w": 170,
     "h": 70,
     "t": "Gold",
     "s": "business aggregates"
    }
   ],
   "edges": [
    {
     "id": "e1",
     "a": "src",
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
    }
   ],
   "steps": [
    {
     "hot": [
      "src",
      "b"
     ],
     "edges": [
      "e1"
     ],
     "sub": {
      "b": "1,000 rows (+ 30 dupes)\n_ingest_ts, _file"
     },
     "t": "<b>Bronze</b> keeps data as it arrived, plus metadata (file name, ingest time). Never “fix” here: it is your replay source."
    },
    {
     "hot": [
      "s"
     ],
     "edges": [
      "e2"
     ],
     "sub": {
      "s": "1,000 rows, typed,\nkey = order_id"
     },
     "t": "<b>Silver</b> casts types, drops bad rows (or quarantines them), dedupes by business key and conforms codes. Use MERGE on the key, not blind append."
    },
    {
     "hot": [
      "g"
     ],
     "edges": [
      "e3"
     ],
     "sub": {
      "g": "revenue by day\n(for BI / ML)"
     },
     "t": "<b>Gold</b> holds the tables people query: aggregates, star schemas, features."
    },
    {
     "hot": [
      "b",
      "s"
     ],
     "ok": [
      "s"
     ],
     "edges": [
      "e2"
     ],
     "sub": {
      "b": "same batch re-read\n(job retried)",
      "s": "still 1,000 rows ✓\nMERGE is idempotent"
     },
     "t": "A job retry replays the same bronze batch. Because silver uses MERGE on <code>order_id</code>, nothing doubles. An <code>append</code> here would have given 2,000."
    }
   ]
  },
  {
   "name": "SCD type 2",
   "nodes": [
    {
     "id": "in",
     "x": 20,
     "y": 30,
     "w": 250,
     "h": 70,
     "t": "Change arrives",
     "s": "cust 7: city Pune → Austin\n@ 2025-03-01"
    },
    {
     "id": "old",
     "x": 320,
     "y": 30,
     "w": 420,
     "h": 70,
     "t": "dim_customer (current)",
     "s": "7 | Pune | 2024-01-10 | NULL | true"
    },
    {
     "id": "new",
     "x": 320,
     "y": 150,
     "w": 420,
     "h": 90,
     "t": "dim_customer (after)",
     "s": ""
    }
   ],
   "edges": [
    {
     "id": "a",
     "a": "in",
     "b": "old"
    }
   ],
   "steps": [
    {
     "hot": [
      "in",
      "old"
     ],
     "edges": [
      "a"
     ],
     "t": "SCD type 2 keeps history: one row per version with <code>valid_from</code>, <code>valid_to</code> and <code>is_current</code>."
    },
    {
     "bad": [
      "old"
     ],
     "hot": [
      "new"
     ],
     "sub": {
      "new": "7 | Pune   | 2024-01-10 | 2025-03-01 | false"
     },
     "t": "Step 1: <b>close</b> the current row: set <code>valid_to</code> and <code>is_current = false</code>."
    },
    {
     "ok": [
      "new"
     ],
     "sub": {
      "new": "7 | Pune   | 2024-01-10 | 2025-03-01 | false\n7 | Austin | 2025-03-01 | NULL       | true"
     },
     "t": "Step 2: <b>insert</b> the new version. One MERGE can do both with the “staged union” trick (see code), or let <code>AUTO CDC … STORED AS SCD TYPE 2</code> do it."
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
