/* Asset Bundles & CI/CD: one databricks.yml deployed to a dev target (prefixed, paused) and a prod target (service principal), with deployment state deciding creates, updates and deletes. */
IA.widget('dbx-asset-bundles', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const W = 760, H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Git repository with databricks.yml on the left, the CLI or CI in the middle, dev and prod workspace targets on the right' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  root.append(el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  // f: repo lines, cli [cmd, who, state], dev resources, prod resources, active side
  const R1 = ['databricks.yml', '  bundle: orders', '  targets: dev, prod', 'resources/', '  nightly_orders.job.yml', '  orders.pipeline.yml', 'src/ *.py'];
  const R2 = R1.slice(0, 4).concat(['  nightly_orders.job.yml', '  (pipeline removed)', 'src/ *.py']);
  const FR = [
    { repo: R1, cli: ['', '', 'idle'], dev: [], prod: [], c: 'A <b>bundle</b> is a folder in Git with a <code>databricks.yml</code>: code (<code>src/</code>) plus resource definitions (jobs, pipelines, …) as YAML, and <b>targets</b> such as dev and prod.' },
    { repo: R1, cli: ['databricks bundle validate -t dev', 'you (laptop)', 'ok'], dev: [], prod: [], c: '<code>bundle validate</code> resolves variables (<code>${var.catalog}</code>, <code>${bundle.target}</code>) and checks the config without changing anything.' },
    { repo: R1, cli: ['databricks bundle deploy -t dev', 'you (laptop)', 'run'], dev: [['[dev ana] nightly_orders', 'job · schedule PAUSED', 'new'], ['[dev ana] orders', 'pipeline · development', 'new']], prod: [], c: '<code>mode: development</code>: resources get a <b>[dev username]</b> prefix, schedules and triggers are <b>paused</b>, files go under your user folder. Two developers never clash.', side: 'dev' },
    { repo: R1, cli: ['databricks bundle run -t dev nightly_orders', 'you (laptop)', 'ok'], dev: [['[dev ana] nightly_orders', 'job · run #1 succeeded', 'ok'], ['[dev ana] orders', 'pipeline · development', 'ok']], prod: [], c: '<code>bundle run</code> starts the job in your dev copy, writing to a dev catalog via a variable. Iterate: edit, deploy, run.', side: 'dev' },
    { repo: R1, cli: ['PR merged → CI: bundle deploy -t prod', 'service principal (OAuth)', 'run'], dev: [['[dev ana] nightly_orders', 'job', 'ok'], ['[dev ana] orders', 'pipeline', 'ok']], prod: [['nightly_orders', 'job · run_as sp-etl · schedule ON', 'new'], ['orders', 'pipeline · production', 'new']], c: 'After review, <b>CI</b> deploys to <b>prod</b> authenticated as a <b>service principal</b> (OAuth M2M or workload identity federation). <code>mode: production</code> checks things like <code>run_as</code>; schedules are live.', side: 'prod' },
    { repo: R1, cli: ['state: .databricks/…/deployment state', 'tracked per target', 'ok'], dev: [['[dev ana] nightly_orders', 'job', 'ok'], ['[dev ana] orders', 'pipeline', 'ok']], prod: [['nightly_orders', 'job · id 7781', 'ok'], ['orders', 'pipeline · id 31a9', 'ok']], c: 'Each target keeps <b>deployment state</b> (stored in the workspace) mapping config keys to real resource ids. The next deploy updates those resources in place instead of creating duplicates.', side: 'prod' },
    { repo: R2, cli: ['CI: bundle deploy -t prod', 'service principal', 'warn'], dev: [['[dev ana] nightly_orders', 'job', 'ok'], ['[dev ana] orders', 'pipeline', 'ok']], prod: [['nightly_orders', 'job · updated', 'ok'], ['orders', 'pipeline · DELETED', 'del']], c: 'Someone deletes <code>orders.pipeline.yml</code>. The next prod deploy sees a resource in state but not in config and <b>deletes it</b>. Review the deploy plan in CI before it runs.', side: 'prod' },
    { repo: R2, cli: ['databricks bundle destroy -t dev', 'you (laptop)', 'ok'], dev: [], prod: [['nightly_orders', 'job', 'ok']], c: 'Clean up your sandbox with <code>bundle destroy -t dev</code>. Prod stays as it is. As of 2025 the CLI is the newer Go-based <code>databricks</code> CLI (v0.2xx); check your version.', side: 'dev' }
  ];
  const STC = { new: 'var(--accent)', ok: 'var(--ok)', del: 'var(--err)', run: 'var(--accent)', warn: 'var(--warn)', idle: 'var(--border)' };
  let k = 0, gen = 0, playing = false;
  const t = (x, y, s, o) => stage.append(svg('text', Object.assign({ x, y, 'font-size': 11.5, fill: 'var(--text-2)', text: s }, o || {})));
  function target(x, y, name, items, on) {
    stage.append(svg('rect', { x, y, width: 260, height: 128, rx: 10, fill: 'var(--surface-2)', stroke: on ? 'var(--accent)' : 'var(--border)', 'stroke-width': on ? 2.4 : 1.2 }));
    t(x + 10, y + 20, name, { 'font-size': 13, 'font-weight': 700, fill: 'var(--text)' });
    if (!items.length) t(x + 10, y + 46, 'nothing deployed', { fill: 'var(--text-3)' });
    items.forEach(([n, d, st], i) => {
      const yy = y + 32 + i * 46;
      stage.append(svg('rect', { x: x + 10, y: yy, width: 240, height: 38, rx: 6, fill: 'none', stroke: STC[st], 'stroke-width': 1.8, 'stroke-dasharray': st === 'del' ? '4 3' : null }));
      t(x + 18, yy + 16, n, { fill: st === 'del' ? 'var(--err)' : 'var(--text)', 'font-weight': 600, 'text-decoration': st === 'del' ? 'line-through' : null });
      t(x + 18, yy + 31, d, { 'font-size': 10.5, fill: st === 'del' ? 'var(--err)' : 'var(--text-3)' });
    });
  }
  function draw(f) {
    stage.append(svg('rect', { x: 12, y: 30, width: 200, height: 250, rx: 10, fill: 'var(--surface-2)', stroke: 'var(--border)' }));
    t(22, 50, 'Git repo (main)', { 'font-size': 13, 'font-weight': 700, fill: 'var(--text)' });
    f.repo.forEach((l, i) => t(22, 74 + i * 20, l, { 'font-family': 'var(--mono)', 'font-size': 11, fill: /removed/.test(l) ? 'var(--err)' : 'var(--text-2)' }));
    const [cmd, who, st] = f.cli;
    stage.append(svg('rect', { x: 226, y: 120, width: 250, height: 74, rx: 10, fill: 'var(--surface-2)', stroke: STC[st], 'stroke-width': st === 'idle' ? 1.2 : 2.2 }));
    t(236, 140, 'CLI / CI', { 'font-size': 13, 'font-weight': 700, fill: 'var(--text)' });
    t(236, 160, cmd || '–', { 'font-family': 'var(--mono)', 'font-size': 9.5, fill: 'var(--text)' });
    t(236, 180, who ? 'as: ' + who : '', { 'font-size': 10.5 });
    target(490, 22, 'target dev (mode: development)', f.dev, f.side === 'dev');
    target(490, 166, 'target prod (mode: production)', f.prod, f.side === 'prod');
    const arr = (y2, on) => stage.append(svg('line', { x1: 476, y1: 157, x2: 490, y2, stroke: on ? 'var(--accent)' : 'var(--text-3)', 'stroke-width': on ? 2.4 : 1.2, 'stroke-dasharray': on ? null : '4 4' }));
    arr(86, f.side === 'dev'); arr(230, f.side === 'prod');
    stage.append(svg('line', { x1: 212, y1: 157, x2: 226, y2: 157, stroke: 'var(--text-3)', 'stroke-width': 1.4 }));
    stage.append(svg('text', { x: 12, y: H - 12, 'font-size': 11, fill: 'var(--text-3)', text: 'Databricks Asset Bundles (as of 2025; newer docs may use a different product name). Check your CLI version.' }));
  }
  function render() {
    stage.innerHTML = ''; draw(FR[k]);
    narr.innerHTML = ''; narr.className = 'caption' + (FR[k].cli[2] === 'warn' ? ' warn' : '');
    narr.append(el('div', { class: 'n', text: `${k + 1}/${FR.length}` }), el('div', { class: 't', html: FR[k].c }));
    bStep.disabled = k >= FR.length - 1;
  }
  const stop = () => { gen++; playing = false; bPlay.textContent = '▶ Play'; };
  async function play() {
    if (playing) { stop(); return; }
    if (k >= FR.length - 1) k = 0;
    if (reduced) { k = FR.length - 1; render(); return; }
    playing = true; const g = ++gen; bPlay.textContent = '❚❚ Pause'; render();
    while (g === gen && k < FR.length - 1) { await sleep(2800); if (g !== gen) return; k++; render(); }
    playing = false; bPlay.textContent = '▶ Play';
  }
  bPlay.addEventListener('click', play);
  bStep.addEventListener('click', () => { stop(); if (k < FR.length - 1) { k++; render(); } });
  bReset.addEventListener('click', () => { stop(); k = 0; render(); });
  render();
});
