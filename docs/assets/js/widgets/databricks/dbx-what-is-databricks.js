/* dbx-what-is-databricks: step-through diagram (generated layout, edit freely). */
IA.widget('dbx-what-is-databricks', (root, ctx) => {
  const S = {
 "desc": "Lakehouse layers and control vs compute plane.",
 "H": 320,
 "aria": "Databricks layers: storage, Delta, Unity Catalog, compute, workloads",
 "modes": [
  {
   "name": "Lakehouse stack",
   "intro": "Press Play to build the lakehouse from the bottom up.",
   "nodes": [
    {
     "id": "st",
     "x": 20,
     "y": 250,
     "w": 720,
     "h": 54,
     "t": "Cloud object storage (your account)",
     "s": "S3 · ADLS Gen2 · GCS: cheap files, Parquet"
    },
    {
     "id": "dl",
     "x": 20,
     "y": 180,
     "w": 720,
     "h": 54,
     "t": "Delta Lake (table format)",
     "s": "_delta_log/ + Parquet → ACID, time travel, MERGE"
    },
    {
     "id": "uc",
     "x": 20,
     "y": 110,
     "w": 720,
     "h": 54,
     "t": "Unity Catalog (governance)",
     "s": "catalog.schema.table · GRANTs · lineage · audit"
    },
    {
     "id": "sp",
     "x": 20,
     "y": 40,
     "w": 230,
     "h": 54,
     "t": "Spark clusters",
     "s": "DBR + Photon"
    },
    {
     "id": "wh",
     "x": 265,
     "y": 40,
     "w": 230,
     "h": 54,
     "t": "SQL warehouses",
     "s": "BI / SQL"
    },
    {
     "id": "sv",
     "x": 510,
     "y": 40,
     "w": 230,
     "h": 54,
     "t": "Serverless",
     "s": "notebooks · jobs · DLT"
    }
   ],
   "labels": [
    {
     "x": 20,
     "y": 24,
     "t": "Engines read the SAME tables; nobody copies data into a warehouse"
    }
   ],
   "steps": [
    {
     "hot": [
      "st"
     ],
     "t": "Your data lives as <b>files in your own cloud storage</b>. A plain data lake: cheap and open, but no transactions, no schema checks."
    },
    {
     "hot": [
      "dl"
     ],
     "t": "<b>Delta Lake</b> adds a transaction log next to the Parquet files. Now writers commit atomically and readers see snapshots. Same idea as the Spark track’s <a href=\"../spark/delta-lake-lakehouse.html\">Delta page</a>."
    },
    {
     "hot": [
      "uc"
     ],
     "t": "<b>Unity Catalog</b> names every table <code>catalog.schema.table</code> and decides who may read it, across all workspaces in a region."
    },
    {
     "hot": [
      "sp",
      "wh",
      "sv"
     ],
     "t": "Several <b>engines</b> sit on top: Spark clusters for ETL/ML, SQL warehouses for BI, serverless compute. All read the same governed Delta tables."
    },
    {
     "hot": [
      "st",
      "dl",
      "uc",
      "sp",
      "wh",
      "sv"
     ],
     "t": "That is the <b>lakehouse</b>: warehouse-style tables and governance on top of open lake storage. Databricks sells the managed platform around it."
    }
   ]
  },
  {
   "name": "Control vs compute plane",
   "intro": "Who runs what, and where your data actually flows.",
   "nodes": [
    {
     "id": "u",
     "x": 20,
     "y": 130,
     "w": 130,
     "h": 56,
     "t": "You (browser)",
     "s": "UI / API / CLI"
    },
    {
     "id": "cp",
     "x": 200,
     "y": 30,
     "w": 250,
     "h": 84,
     "t": "Control plane",
     "s": "Databricks account:\nweb app, jobs scheduler,\nnotebooks, UC metadata"
    },
    {
     "id": "cc",
     "x": 200,
     "y": 200,
     "w": 250,
     "h": 84,
     "t": "Classic compute plane",
     "s": "VMs in YOUR cloud account\n(clusters you configure)"
    },
    {
     "id": "sc",
     "x": 500,
     "y": 30,
     "w": 240,
     "h": 84,
     "t": "Serverless compute plane",
     "s": "VMs in Databricks’ account,\nsame region, isolated"
    },
    {
     "id": "s3",
     "x": 500,
     "y": 200,
     "w": 240,
     "h": 84,
     "t": "Your storage",
     "s": "Delta / Parquet files"
    }
   ],
   "edges": [
    {
     "id": "e1",
     "a": "u",
     "b": "cp",
     "t": "HTTPS"
    },
    {
     "id": "e2",
     "a": "cp",
     "b": "cc",
     "t": "start VMs"
    },
    {
     "id": "e3",
     "a": "cc",
     "b": "s3",
     "t": "read/write"
    },
    {
     "id": "e4",
     "a": "cp",
     "b": "sc"
    },
    {
     "id": "e5",
     "a": "sc",
     "b": "s3",
     "t": "read/write"
    }
   ],
   "steps": [
    {
     "hot": [
      "u",
      "cp"
     ],
     "edges": [
      "e1"
     ],
     "t": "You talk to the <b>control plane</b>: the managed web app, job scheduler and metadata services, run by Databricks."
    },
    {
     "hot": [
      "cp",
      "cc"
     ],
     "edges": [
      "e2"
     ],
     "t": "For <b>classic</b> compute the control plane launches VMs <b>in your own cloud account</b>. You pay the cloud for VMs and Databricks for DBUs."
    },
    {
     "hot": [
      "cc",
      "s3"
     ],
     "edges": [
      "e3"
     ],
     "t": "Data is processed in the compute plane and read straight from your storage. Bulk data does not flow through the control plane."
    },
    {
     "hot": [
      "cp",
      "sc",
      "s3"
     ],
     "edges": [
      "e4",
      "e5"
     ],
     "t": "<b>Serverless</b> compute runs in a Databricks-managed account in the same region: no VMs to manage, fast start, billed in DBUs only (as of 2025; check your workspace)."
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
