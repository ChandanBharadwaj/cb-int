/* dbx-workspace-compute: step-through diagram (generated layout, edit freely). */
IA.widget('dbx-workspace-compute', (root, ctx) => {
  const S = {
 "H": 300,
 "aria": "All-purpose cluster vs job cluster vs serverless lifecycles",
 "modes": [
  {
   "name": "All-purpose vs job",
   "nodes": [
    {
     "id": "nb",
     "x": 20,
     "y": 30,
     "w": 170,
     "h": 56,
     "t": "Notebook",
     "s": "interactive, by humans"
    },
    {
     "id": "ap",
     "x": 250,
     "y": 30,
     "w": 230,
     "h": 56,
     "t": "All-purpose cluster",
     "s": "state: TERMINATED"
    },
    {
     "id": "at",
     "x": 540,
     "y": 30,
     "w": 200,
     "h": 56,
     "t": "Auto-termination",
     "s": "idle 60 min → stop"
    },
    {
     "id": "job",
     "x": 20,
     "y": 190,
     "w": 170,
     "h": 56,
     "t": "Job run",
     "s": "scheduled task"
    },
    {
     "id": "jc",
     "x": 250,
     "y": 190,
     "w": 230,
     "h": 56,
     "t": "Job cluster",
     "s": "not created yet"
    },
    {
     "id": "done",
     "x": 540,
     "y": 190,
     "w": 200,
     "h": 56,
     "t": "Run ends",
     "s": ""
    }
   ],
   "edges": [
    {
     "id": "a1",
     "a": "nb",
     "b": "ap",
     "t": "attach"
    },
    {
     "id": "a2",
     "a": "ap",
     "b": "at"
    },
    {
     "id": "j1",
     "a": "job",
     "b": "jc",
     "t": "create"
    },
    {
     "id": "j2",
     "a": "jc",
     "b": "done"
    }
   ],
   "steps": [
    {
     "hot": [
      "nb",
      "ap"
     ],
     "edges": [
      "a1"
     ],
     "sub": {
      "ap": "state: PENDING → RUNNING\n(VMs boot, several minutes)"
     },
     "t": "You attach a notebook to an <b>all-purpose</b> (interactive) cluster. Starting it boots VMs, which usually takes minutes on classic compute."
    },
    {
     "hot": [
      "ap"
     ],
     "sub": {
      "ap": "state: RUNNING\nshared by 3 users"
     },
     "t": "Many people and notebooks can share it. It stays up between commands, so you pay while you think."
    },
    {
     "hot": [
      "at"
     ],
     "edges": [
      "a2"
     ],
     "sub": {
      "ap": "state: TERMINATED",
      "at": "idle timer fired"
     },
     "t": "<b>Auto-termination</b> stops it after N idle minutes. Config is kept; restart re-boots VMs."
    },
    {
     "hot": [
      "job",
      "jc"
     ],
     "edges": [
      "j1"
     ],
     "sub": {
      "jc": "created for this run only"
     },
     "t": "A <b>job</b> can use a <b>job cluster</b>: created for the run, billed at the lower jobs-compute rate."
    },
    {
     "hot": [
      "done"
     ],
     "edges": [
      "j2"
     ],
     "sub": {
      "jc": "TERMINATED (deleted)",
      "done": "cluster gone"
     },
     "t": "When the run ends the job cluster is torn down. Nothing idles. Rule: humans on all-purpose, production on job or serverless compute."
    }
   ]
  },
  {
   "name": "Serverless",
   "nodes": [
    {
     "id": "t",
     "x": 20,
     "y": 110,
     "w": 170,
     "h": 60,
     "t": "Job / notebook",
     "s": "serverless env"
    },
    {
     "id": "pool",
     "x": 260,
     "y": 40,
     "w": 240,
     "h": 70,
     "t": "Warm serverless fleet",
     "s": "Databricks-managed"
    },
    {
     "id": "run",
     "x": 260,
     "y": 180,
     "w": 240,
     "h": 70,
     "t": "Your workload",
     "s": "auto-scaled"
    },
    {
     "id": "bill",
     "x": 560,
     "y": 110,
     "w": 180,
     "h": 60,
     "t": "Billing",
     "s": "DBUs per use"
    }
   ],
   "edges": [
    {
     "id": "s1",
     "a": "t",
     "b": "pool",
     "t": "request"
    },
    {
     "id": "s2",
     "a": "pool",
     "b": "run"
    },
    {
     "id": "s3",
     "a": "run",
     "b": "bill"
    }
   ],
   "steps": [
    {
     "hot": [
      "t",
      "pool"
     ],
     "edges": [
      "s1"
     ],
     "t": "With <b>serverless</b> you pick no instance types or runtime version. You choose an environment version (Python deps)."
    },
    {
     "hot": [
      "run"
     ],
     "edges": [
      "s2"
     ],
     "sub": {
      "run": "starts in seconds\n(typically)"
     },
     "t": "Capacity comes from a fleet kept warm by Databricks, so start-up is typically seconds, not minutes."
    },
    {
     "hot": [
      "bill"
     ],
     "edges": [
      "s3"
     ],
     "t": "You pay DBUs for what runs; no separate VM bill. Trade-off: less control (no init scripts, limited Spark confs, no RDD APIs). Check the current limits in your workspace."
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
