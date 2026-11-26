/* dbx-auto-loader: step-through diagram (generated layout, edit freely). */
IA.widget('dbx-auto-loader', (root, ctx) => {
  const S = {
 "H": 320,
 "aria": "Auto Loader discovering files, checkpointing and evolving schema",
 "modes": [
  {
   "name": "Discover & evolve",
   "nodes": [
    {
     "id": "land",
     "x": 20,
     "y": 30,
     "w": 210,
     "h": 100,
     "t": "Landing (volume / s3)",
     "s": "a.json  b.json"
    },
    {
     "id": "al",
     "x": 280,
     "y": 30,
     "w": 200,
     "h": 100,
     "t": "Auto Loader",
     "s": "cloudFiles\nlisting or file events"
    },
    {
     "id": "ck",
     "x": 280,
     "y": 190,
     "w": 200,
     "h": 100,
     "t": "Checkpoint",
     "s": "file log (RocksDB)"
    },
    {
     "id": "sl",
     "x": 20,
     "y": 190,
     "w": 210,
     "h": 100,
     "t": "schemaLocation",
     "s": "v0: id, amount"
    },
    {
     "id": "br",
     "x": 530,
     "y": 30,
     "w": 210,
     "h": 100,
     "t": "Bronze table",
     "s": ""
    }
   ],
   "edges": [
    {
     "id": "d",
     "a": "land",
     "b": "al",
     "t": "discover"
    },
    {
     "id": "w",
     "a": "al",
     "b": "br",
     "t": "append"
    },
    {
     "id": "c",
     "a": "al",
     "b": "ck"
    },
    {
     "id": "s",
     "a": "al",
     "b": "sl"
    }
   ],
   "steps": [
    {
     "hot": [
      "land",
      "al",
      "sl"
     ],
     "edges": [
      "d",
      "s"
     ],
     "t": "First run: Auto Loader samples files, infers a schema and <b>stores it in schemaLocation</b>. JSON/CSV columns are strings unless <code>inferColumnTypes</code> is true."
    },
    {
     "hot": [
      "br",
      "ck"
     ],
     "edges": [
      "w",
      "c"
     ],
     "sub": {
      "br": "rows from a, b",
      "ck": "seen: a.json, b.json"
     },
     "t": "Rows are appended and each file is recorded in the <b>checkpoint</b>. A re-run skips seen files: exactly-once ingestion per file."
    },
    {
     "hot": [
      "land"
     ],
     "sub": {
      "land": "a.json b.json c.json\n(c has new col “coupon”)"
     },
     "t": "A new file arrives with an unknown column."
    },
    {
     "bad": [
      "al"
     ],
     "edges": [
      "s"
     ],
     "sub": {
      "al": "UnknownFieldException\nstream stops",
      "sl": "v1: id, amount, coupon"
     },
     "t": "Default mode <code>addNewColumns</code>: the stream <b>fails on purpose</b> after updating the schema. This is expected; jobs should retry."
    },
    {
     "ok": [
      "al",
      "br"
     ],
     "edges": [
      "w",
      "c"
     ],
     "sub": {
      "al": "restarted",
      "br": "rows a, b, c\n+ column coupon",
      "ck": "seen: a, b, c"
     },
     "t": "On restart it uses the new schema. Values that don’t fit the type (e.g. <code>\"12x\"</code> for an int) go into <code>_rescued_data</code> instead of being lost."
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
