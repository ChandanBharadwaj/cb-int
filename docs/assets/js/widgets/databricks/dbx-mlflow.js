/* MLflow & ML: runs in an experiment, registering versions in Unity Catalog, moving the @champion alias, and a serving endpoint with a traffic split. */
IA.widget('dbx-mlflow', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const W = 760, H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Three panels: experiment runs, Unity Catalog model versions with aliases, and a serving endpoint' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  root.append(el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  const RUNS = [['run a1', 'depth=4', 'auc 0.81'], ['run a2', 'depth=8', 'auc 0.86'], ['run a3', 'depth=12', 'auc 0.84'], ['run b1', 'depth=8 +feat', 'auc 0.89']];
  // f: runs shown, best idx, versions [[v, from]], aliases {champion, challenger}, traffic [[v, pct]], active panel, caption
  const FR = [
    { r: 1, best: -1, v: [], al: {}, tr: [], p: 0, c: 'Training code calls <code>mlflow.start_run()</code> (or autolog). Each <b>run</b> records params, metrics, artifacts and the model inside an <b>experiment</b>.' },
    { r: 3, best: 1, v: [], al: {}, tr: [], p: 0, c: 'A small sweep: three runs with different <code>max_depth</code>. Compare them in the UI or with <code>mlflow.search_runs()</code>. a2 has the best validation AUC.' },
    { r: 3, best: 1, v: [[1, 'a2']], al: {}, tr: [], p: 1, c: 'Register a2’s model in <b>Unity Catalog</b> as <code>main.ml.churn</code> → <b>version 1</b>. UC needs a <b>signature</b> (input/output schema) and governs it with grants, like a table.' },
    { r: 3, best: 1, v: [[1, 'a2']], al: { champion: 1 }, tr: [], p: 1, c: 'Set the alias <code>@champion</code> on version 1. Batch scoring jobs load <code>models:/main.ml.churn@champion</code>, never a hardcoded version. (Stages like “Production” belong to the legacy workspace registry.)' },
    { r: 3, best: 1, v: [[1, 'a2']], al: { champion: 1 }, tr: [[1, 100]], p: 2, c: 'A <b>Model Serving</b> endpoint serves version 1 over REST, with autoscaling (optionally scale-to-zero). Requests and responses can be logged to an inference table.' },
    { r: 4, best: 3, v: [[1, 'a2'], [2, 'b1']], al: { champion: 1, challenger: 2 }, tr: [[1, 100]], p: 1, c: 'A new feature gives run b1 AUC 0.89. Register it as <b>version 2</b> and tag it <code>@challenger</code>. Nothing in production changes yet.' },
    { r: 4, best: 3, v: [[1, 'a2'], [2, 'b1']], al: { champion: 1, challenger: 2 }, tr: [[1, 90], [2, 10]], p: 2, c: 'Canary: the endpoint splits traffic <b>90/10</b> between two served entities. Compare live metrics before promoting.' },
    { r: 4, best: 3, v: [[1, 'a2'], [2, 'b1']], al: { champion: 2 }, tr: [[2, 100]], p: 2, c: 'Promote: move <code>@champion</code> to version 2 and route 100% to it. Rollback is moving the alias back to version 1. Lineage links version 2 to run b1 and its training tables.' }
  ];
  let k = 0, gen = 0, playing = false;
  const panel = (x, y, w, h, t, on) => { stage.append(svg('rect', { x, y, width: w, height: h, rx: 10, fill: 'var(--surface-2)', stroke: on ? 'var(--accent)' : 'var(--border)', 'stroke-width': on ? 2.4 : 1.2 })); stage.append(svg('text', { x: x + 10, y: y + 20, 'font-size': 13, 'font-weight': 700, fill: 'var(--text)', text: t })); };
  const txt = (x, y, s, o) => stage.append(svg('text', Object.assign({ x, y, 'font-size': 11.5, fill: 'var(--text-2)', text: s }, o || {})));
  function draw(f) {
    panel(12, 30, 236, 260, 'Experiment /churn', f.p === 0);
    RUNS.slice(0, f.r).forEach((r, i) => {
      const y = 50 + i * 54, best = i === f.best;
      stage.append(svg('rect', { x: 22, y, width: 216, height: 44, rx: 7, fill: 'none', stroke: best ? 'var(--ok)' : 'var(--border)', 'stroke-width': best ? 2.2 : 1 }));
      txt(32, y + 18, r[0], { 'font-weight': 600, fill: 'var(--text)' }); txt(100, y + 18, r[1], { 'font-family': 'var(--mono)' });
      txt(32, y + 35, r[2] + (best ? '  ★ best' : ''), { fill: best ? 'var(--ok)' : 'var(--text-2)', 'font-family': 'var(--mono)' });
    });
    panel(262, 30, 236, 260, 'UC model main.ml.churn', f.p === 1);
    if (!f.v.length) txt(276, 70, 'no versions yet', { fill: 'var(--text-3)' });
    f.v.forEach(([v, from], i) => {
      const y = 50 + i * 80; const als = Object.keys(f.al).filter((a) => f.al[a] === v);
      stage.append(svg('rect', { x: 272, y, width: 216, height: 66, rx: 7, fill: 'none', stroke: als.includes('champion') ? 'var(--ok)' : 'var(--border)', 'stroke-width': als.length ? 2.2 : 1 }));
      txt(282, y + 20, `version ${v}`, { 'font-weight': 600, fill: 'var(--text)' }); txt(282, y + 38, `from run ${from} · signature ✓`);
      als.forEach((a, j) => { const x = 282 + j * 100; stage.append(svg('rect', { x, y: y + 45, width: 92, height: 17, rx: 8, fill: a === 'champion' ? 'var(--ok)' : 'var(--warn)', opacity: 0.9 })); txt(x + 46, y + 58, '@' + a, { 'text-anchor': 'middle', fill: 'var(--bg)', 'font-weight': 700, 'font-size': 11 }); });
    });
    panel(512, 30, 236, 260, 'Serving endpoint churn-api', f.p === 2);
    if (!f.tr.length) txt(526, 70, 'not deployed', { fill: 'var(--text-3)' });
    f.tr.forEach(([v, pct], i) => {
      const y = 56 + i * 60;
      txt(526, y, `v${v}: ${pct}% of traffic`, { fill: 'var(--text)', 'font-weight': 600 });
      stage.append(svg('rect', { x: 526, y: y + 8, width: 208, height: 14, rx: 7, fill: 'none', stroke: 'var(--border)' }));
      stage.append(svg('rect', { x: 526, y: y + 8, width: Math.max(4, 208 * pct / 100), height: 14, rx: 7, fill: 'var(--accent)', opacity: 0.8 }));
    });
    if (f.tr.length) txt(526, 260, 'POST /serving-endpoints/churn-api/invocations', { 'font-size': 10, 'font-family': 'var(--mono)', fill: 'var(--text-3)' });
    stage.append(svg('text', { x: 12, y: H - 12, 'font-size': 11, fill: 'var(--text-3)', text: 'MLflow on Databricks with the Unity Catalog registry, as of 2025. Metrics are illustrative.' }));
  }
  function render() {
    stage.innerHTML = ''; draw(FR[k]);
    narr.innerHTML = ''; narr.className = 'caption' + (k === FR.length - 1 ? ' ok' : '');
    narr.append(el('div', { class: 'n', text: `${k + 1}/${FR.length}` }), el('div', { class: 't', html: FR[k].c }));
    bStep.disabled = k >= FR.length - 1;
  }
  const stop = () => { gen++; playing = false; bPlay.textContent = '▶ Play'; };
  async function play() {
    if (playing) { stop(); return; }
    if (k >= FR.length - 1) k = 0;
    if (reduced) { k = FR.length - 1; render(); return; }
    playing = true; const g = ++gen; bPlay.textContent = '❚❚ Pause'; render();
    while (g === gen && k < FR.length - 1) { await sleep(2600); if (g !== gen) return; k++; render(); }
    playing = false; bPlay.textContent = '▶ Play';
  }
  bPlay.addEventListener('click', play);
  bStep.addEventListener('click', () => { stop(); if (k < FR.length - 1) { k++; render(); } });
  bReset.addEventListener('click', () => { stop(); k = 0; render(); });
  render();
});
