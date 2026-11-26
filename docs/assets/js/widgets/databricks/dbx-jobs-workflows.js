/* Jobs & workflows: a step-through job run with a task DAG, a shared job cluster, retries, run_if, task values and a repair run. */
IA.widget('dbx-jobs-workflows', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const W = 760, H = 320;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'A job DAG: ingest feeds clean_orders and clean_customers, which feed build_gold, which feeds refresh_dashboard; a cleanup task runs with run_if ALL_DONE' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  root.append(el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  const COL = { idle: 'var(--border)', run: 'var(--accent)', ok: 'var(--ok)', err: 'var(--err)', warn: 'var(--warn)', skip: 'var(--text-3)' };
  const BW = 150, BH = 58;
  const P = { ingest: [20, 130], clean_orders: [205, 55], clean_customers: [205, 205], build_gold: [395, 130], refresh_dash: [590, 70], cleanup: [590, 210] };
  const EDGES = [['ingest', 'clean_orders'], ['ingest', 'clean_customers'], ['clean_orders', 'build_gold'], ['clean_customers', 'build_gold'], ['build_gold', 'refresh_dash'], ['build_gold', 'cleanup']];
  const LBL = { ingest: 'ingest', clean_orders: 'clean_orders', clean_customers: 'clean_customers', build_gold: 'build_gold', refresh_dash: 'refresh_dash', cleanup: 'cleanup (ALL_DONE)' };
  const I = 'idle';
  const base = { ingest: [I], clean_orders: [I], clean_customers: [I], build_gold: [I], refresh_dash: [I], cleanup: [I] };
  const f = (o, cl, c, run) => ({ t: Object.assign({}, base, o), cl, c, run });
  const FR = [
    f({}, 'job cluster: not started', 'Run 1 is triggered by its <b>schedule</b> (Quartz cron). Every task is pending. The DAG comes from each task’s <code>depends_on</code>.', 'run 1 · scheduled'),
    f({ ingest: ['run', 'running'] }, 'job cluster “etl”: starting → running', 'The shared <b>job cluster</b> starts once for the run. Tasks with the same <code>job_cluster_key</code> reuse it, so you pay startup once.', 'run 1'),
    f({ ingest: ['ok', 'succeeded · set rows=48210'] }, 'job cluster “etl”: running', '<code>ingest</code> succeeds and publishes a <b>task value</b>: <code>dbutils.jobs.taskValues.set("rows", 48210)</code>. Downstream tasks can read <code>{{tasks.ingest.values.rows}}</code>.', 'run 1'),
    f({ ingest: ['ok', 'succeeded'], clean_orders: ['run', 'running'], clean_customers: ['run', 'running'] }, 'job cluster “etl”: 2 tasks in parallel', 'Both clean tasks depend only on ingest, so they run <b>in parallel</b> on the same cluster.', 'run 1'),
    f({ ingest: ['ok', 'succeeded'], clean_orders: ['ok', 'succeeded'], clean_customers: ['warn', 'failed · retry 1 of 2'] }, 'job cluster “etl”: running', '<code>clean_customers</code> throws. It has <code>max_retries: 2</code> and <code>min_retry_interval_millis</code>, so the task retries. Only this task retries, not the whole job.', 'run 1'),
    f({ ingest: ['ok', 'succeeded'], clean_orders: ['ok', 'succeeded'], clean_customers: ['err', 'failed · retries used up'] }, 'job cluster “etl”: running', 'The bug is deterministic (a bad column name after a source change), so every retry fails. Retries help with transient errors, not with bugs.', 'run 1'),
    f({ ingest: ['ok', 'succeeded'], clean_orders: ['ok', 'succeeded'], clean_customers: ['err', 'failed'], build_gold: ['skip', 'upstream failed'], refresh_dash: ['skip', 'upstream failed'], cleanup: ['run', 'running'] }, 'job cluster “etl”: running', '<code>build_gold</code> uses the default <code>run_if: ALL_SUCCESS</code>, so it is <b>not run</b> (“Upstream failed”), and so is its child. <code>cleanup</code> has <code>run_if: ALL_DONE</code>, so it runs anyway.', 'run 1'),
    f({ ingest: ['ok', 'succeeded'], clean_orders: ['ok', 'succeeded'], clean_customers: ['err', 'failed'], build_gold: ['skip', 'upstream failed'], refresh_dash: ['skip', 'upstream failed'], cleanup: ['ok', 'succeeded'] }, 'job cluster “etl”: terminated', 'The run ends <b>Failed</b>. The job cluster terminates. A notification goes to the on-call channel. Someone fixes the column name and deploys.', 'run 1 · failed'),
    f({ ingest: ['ok', 'kept from run 1'], clean_orders: ['ok', 'kept from run 1'], clean_customers: ['run', 'repair: running'], build_gold: [I, 'pending'], refresh_dash: [I, 'pending'], cleanup: ['ok', 'kept'] }, 'job cluster “etl”: starting again', '<b>Repair run</b>: rerun only the failed task and everything downstream of it, inside the same run. Successful tasks are not rerun. That is why each task must be <b>idempotent</b>.', 'run 1 · repair #1'),
    f({ ingest: ['ok', 'kept'], clean_orders: ['ok', 'kept'], clean_customers: ['ok', 'succeeded'], build_gold: ['ok', 'succeeded'], refresh_dash: ['ok', 'succeeded'], cleanup: ['ok', 'kept'] }, 'job cluster “etl”: terminated', 'The repaired run is green. <code>max_concurrent_runs</code> (default 1) meant the next scheduled run would have waited or been skipped instead of overlapping with this one.', 'run 1 · succeeded after repair')
  ];
  const defs = svg('defs'); const mk = svg('marker', { id: 'ah-dbxjobs', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
  mk.append(svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--text-3)' })); defs.append(mk);
  let k = 0, gen = 0, playing = false;
  function draw(fr) {
    stage.append(defs);
    stage.append(svg('text', { x: 20, y: 24, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: 'Job: nightly_orders · ' + fr.run }));
    stage.append(svg('text', { x: 20, y: 44, 'font-size': 12.5, fill: 'var(--text-2)', text: fr.cl }));
    EDGES.forEach(([a, b]) => {
      const [x1, y1] = P[a], [x2, y2] = P[b];
      const st = fr.t[b][0] === 'skip' ? 'skip' : (fr.t[a][0] === 'ok' ? 'ok' : 'idle');
      stage.append(svg('line', { x1: x1 + BW, y1: y1 + BH / 2, x2: x2 - 2, y2: y2 + BH / 2, stroke: st === 'ok' ? 'var(--ok)' : 'var(--text-3)', 'stroke-width': 1.6, 'stroke-dasharray': st === 'skip' ? '4 4' : null, 'marker-end': 'url(#ah-dbxjobs)' }));
    });
    Object.keys(P).forEach((id) => {
      const [x, y] = P[id]; const [st, sub] = fr.t[id];
      const g = svg('g');
      g.append(svg('rect', { x, y, width: BW, height: BH, rx: 9, fill: 'var(--surface-2)', stroke: COL[st], 'stroke-width': st === I ? 1.2 : 2.6, 'stroke-dasharray': st === 'skip' ? '5 4' : null }));
      g.append(svg('text', { x: x + BW / 2, y: y + 24, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 600, fill: st === 'skip' ? 'var(--text-3)' : 'var(--text)', text: LBL[id] }));
      g.append(svg('text', { x: x + BW / 2, y: y + 43, 'text-anchor': 'middle', 'font-size': 11, fill: st === I ? 'var(--text-3)' : COL[st], text: sub || 'pending' }));
      stage.append(g);
    });
    stage.append(svg('text', { x: 20, y: H - 12, 'font-size': 11.5, fill: 'var(--text-3)', text: 'Lakeflow Jobs (formerly Workflows), as of 2025. Solid = dependency met, dashed = not run.' }));
  }
  function render() {
    stage.innerHTML = ''; draw(FR[k]);
    narr.innerHTML = ''; narr.className = 'caption' + (/failed/.test(FR[k].run) ? ' err' : /succeeded/.test(FR[k].run) ? ' ok' : '');
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
