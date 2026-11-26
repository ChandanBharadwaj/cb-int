/* dbx-notebooks-git: step-through diagram (generated layout, edit freely). */
IA.widget('dbx-notebooks-git', (root, ctx) => {
  const S = {
 "H": 300,
 "aria": "Git folder workflow and notebook magic commands",
 "modes": [
  {
   "name": "Git folder flow",
   "nodes": [
    {
     "id": "gh",
     "x": 560,
     "y": 30,
     "w": 180,
     "h": 60,
     "t": "Remote repo",
     "s": "GitHub / GitLab / ADO"
    },
    {
     "id": "gf",
     "x": 20,
     "y": 30,
     "w": 240,
     "h": 60,
     "t": "Git folder",
     "s": "/Workspace/Users/me/etl"
    },
    {
     "id": "br",
     "x": 20,
     "y": 180,
     "w": 240,
     "h": 60,
     "t": "Your branch",
     "s": "main"
    },
    {
     "id": "pr",
     "x": 300,
     "y": 180,
     "w": 200,
     "h": 60,
     "t": "Pull request",
     "s": "review + CI"
    },
    {
     "id": "job",
     "x": 560,
     "y": 180,
     "w": 180,
     "h": 60,
     "t": "Prod job",
     "s": "runs from git ref"
    }
   ],
   "edges": [
    {
     "id": "c",
     "a": "gh",
     "b": "gf",
     "t": "clone"
    },
    {
     "id": "b",
     "a": "gf",
     "b": "br"
    },
    {
     "id": "p",
     "a": "br",
     "b": "pr",
     "t": "commit & push"
    },
    {
     "id": "m",
     "a": "pr",
     "b": "gh",
     "t": "merge"
    },
    {
     "id": "j",
     "a": "gh",
     "b": "job",
     "t": "checkout main"
    }
   ],
   "steps": [
    {
     "hot": [
      "gh",
      "gf"
     ],
     "edges": [
      "c"
     ],
     "t": "A <b>Git folder</b> (formerly “Repos”) clones a remote repo into the workspace. Notebooks are stored as source files."
    },
    {
     "hot": [
      "br"
     ],
     "edges": [
      "b"
     ],
     "sub": {
      "br": "feature/dedupe-orders"
     },
     "t": "Create or switch a branch from the Git dialog. Each user should work in their own Git folder."
    },
    {
     "hot": [
      "br",
      "pr"
     ],
     "edges": [
      "p"
     ],
     "t": "Commit and push from the UI (or terminal). Review happens in your Git provider, not in Databricks."
    },
    {
     "hot": [
      "pr",
      "gh"
     ],
     "edges": [
      "m"
     ],
     "sub": {
      "pr": "approved, CI green"
     },
     "t": "Merge to main after CI passes."
    },
    {
     "hot": [
      "gh",
      "job"
     ],
     "edges": [
      "j"
     ],
     "t": "Production jobs point at the <b>remote repo + branch/tag</b> (or a deployed Asset Bundle), never at someone’s personal folder."
    }
   ]
  },
  {
   "name": "Magic commands",
   "nodes": [
    {
     "id": "c1",
     "x": 20,
     "y": 20,
     "w": 230,
     "h": 50,
     "t": "%python (default)",
     "s": "runs on driver"
    },
    {
     "id": "c2",
     "x": 20,
     "y": 85,
     "w": 230,
     "h": 50,
     "t": "%sql",
     "s": "spark.sql(...)"
    },
    {
     "id": "c3",
     "x": 20,
     "y": 150,
     "w": 230,
     "h": 50,
     "t": "%sh",
     "s": "driver shell only"
    },
    {
     "id": "c4",
     "x": 20,
     "y": 215,
     "w": 230,
     "h": 50,
     "t": "%run ./utils",
     "s": "inline another notebook"
    },
    {
     "id": "dr",
     "x": 330,
     "y": 60,
     "w": 190,
     "h": 90,
     "t": "Driver node",
     "s": "Python REPL\n+ SparkSession"
    },
    {
     "id": "ex",
     "x": 580,
     "y": 60,
     "w": 160,
     "h": 90,
     "t": "Executors",
     "s": "distributed\nSpark tasks"
    },
    {
     "id": "sc",
     "x": 330,
     "y": 200,
     "w": 190,
     "h": 60,
     "t": "Same scope",
     "s": "defs from utils"
    }
   ],
   "edges": [
    {
     "id": "p",
     "a": "c1",
     "b": "dr"
    },
    {
     "id": "q",
     "a": "c2",
     "b": "dr"
    },
    {
     "id": "x",
     "a": "dr",
     "b": "ex",
     "t": "tasks"
    },
    {
     "id": "h",
     "a": "c3",
     "b": "dr"
    },
    {
     "id": "r",
     "a": "c4",
     "b": "sc"
    }
   ],
   "steps": [
    {
     "hot": [
      "c1",
      "dr"
     ],
     "edges": [
      "p"
     ],
     "t": "A Python cell runs in the REPL on the <b>driver</b>. Only Spark DataFrame work fans out to executors."
    },
    {
     "hot": [
      "c2",
      "dr",
      "ex"
     ],
     "edges": [
      "q",
      "x"
     ],
     "t": "<code>%sql</code> runs the cell through Spark SQL; the result shows as a table. <code>_sqldf</code> holds it as a DataFrame in Python."
    },
    {
     "hot": [
      "c3",
      "dr"
     ],
     "bad": [
      "ex"
     ],
     "edges": [
      "h"
     ],
     "t": "<code>%sh</code> runs only on the driver. A file written to local disk here is invisible to executors and lost when the cluster stops."
    },
    {
     "hot": [
      "c4",
      "sc"
     ],
     "edges": [
      "r"
     ],
     "t": "<code>%run</code> inlines another notebook into <b>this</b> scope (functions and variables appear). <code>dbutils.notebook.run()</code> instead starts a separate run and returns a string."
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
