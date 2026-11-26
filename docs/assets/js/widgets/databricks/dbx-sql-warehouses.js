/* SQL warehouses: queries queueing on a warehouse, scale-out (more clusters) vs scale-up (bigger size), result cache and auto-stop. Slot counts are illustrative. */
IA.widget('dbx-sql-warehouses', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const W = 760, H = 320;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'A queue of BI queries on the left feeding one or more warehouse clusters on the right' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  root.append(el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  // f: size label, clusters: [[slotsBusy, slotsTotal, state]], queue count, cache hits, big query state, caption, tone
  const FR = [
    { size: 'Small', max: 1, cl: [[0, 4, 'stopped']], q: 0, hit: 0, big: null, c: 'A SQL warehouse is stopped (auto-stopped overnight). Each box will be one <b>cluster</b> of the warehouse. Slots are illustrative: real concurrency per cluster depends on the queries.' },
    { size: 'Small', max: 1, cl: [[0, 4, 'starting']], q: 3, hit: 0, big: null, c: '9:00, the first dashboard opens. The warehouse <b>starts</b>: seconds on serverless, minutes on classic/pro. Queries wait meanwhile.', tone: 'warn' },
    { size: 'Small', max: 1, cl: [[4, 4, 'running']], q: 6, hit: 0, big: null, c: 'Everyone opens the Monday dashboard. One cluster is full and <b>6 queries queue</b>. Each query is fast once it runs: this is a <b>concurrency</b> problem.', tone: 'err' },
    { size: 'Small', max: 3, cl: [[4, 4, 'running'], [4, 4, 'running'], [2, 4, 'running']], q: 0, hit: 0, big: null, c: 'Raise <b>max clusters</b> to 3 (scale <b>out</b>). The warehouse adds clusters while queries queue and the queue drains. Making each cluster bigger would not have helped as much.', tone: 'ok' },
    { size: 'Small', max: 3, cl: [[3, 4, 'running'], [1, 4, 'running'], [0, 4, 'running']], q: 0, hit: 5, big: null, c: 'Repeated identical queries on unchanged tables are served from the <b>query result cache</b> without using a slot. Changing the table invalidates the cached result.', tone: 'ok' },
    { size: 'Small', max: 3, cl: [[4, 4, 'running'], [1, 4, 'running'], [0, 4, 'running']], q: 0, hit: 5, big: 'spill', c: 'An analyst runs a year-long join. It runs alone but takes 9 minutes and the query profile shows <b>spill to disk</b>. More clusters don’t help one query: this is a <b>size</b> problem.', tone: 'err' },
    { size: 'Large', max: 3, cl: [[4, 4, 'running'], [1, 4, 'running'], [0, 4, 'running']], q: 0, hit: 5, big: 'ok', c: 'Scale <b>up</b> (T-shirt size) for heavy queries, or give heavy users their own larger warehouse. Often the better fix is the data: filters that skip files, clustering, smaller result sets.', tone: 'ok' },
    { size: 'Large', max: 3, cl: [[0, 4, 'stopped']], q: 0, hit: 5, big: null, c: 'Evening: no queries. Extra clusters are removed and after the <b>auto-stop</b> idle time the warehouse stops. Stopped warehouses use no DBUs (storage is billed by your cloud).' }
  ];
  const STC = { stopped: 'var(--border)', starting: 'var(--warn)', running: 'var(--accent)' };
  let k = 0, gen = 0, playing = false;
  function draw(f) {
    stage.append(svg('text', { x: 16, y: 24, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: `SQL warehouse “bi_wh” · size ${f.size} · clusters min 1 / max ${f.max}` }));
    // queue
    stage.append(svg('text', { x: 16, y: 62, 'font-size': 12.5, 'font-weight': 600, fill: 'var(--text-2)', text: `queue: ${f.q}` }));
    stage.append(svg('rect', { x: 16, y: 72, width: 200, height: 150, rx: 9, fill: 'var(--surface-2)', stroke: f.q > 4 ? 'var(--err)' : 'var(--border)', 'stroke-width': f.q > 4 ? 2.4 : 1.2 }));
    for (let i = 0; i < f.q; i++) stage.append(svg('rect', { x: 30 + (i % 3) * 60, y: 86 + Math.floor(i / 3) * 34, width: 50, height: 24, rx: 5, fill: 'var(--warn)', opacity: 0.85 }));
    if (!f.q) stage.append(svg('text', { x: 116, y: 150, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-3)', text: 'empty' }));
    stage.append(svg('text', { x: 16, y: 248, 'font-size': 12.5, fill: 'var(--text-2)', text: `result cache hits: ${f.hit}` }));
    for (let i = 0; i < f.hit; i++) stage.append(svg('circle', { cx: 24 + i * 18, cy: 266, r: 6, fill: 'var(--ok)' }));
    // clusters
    f.cl.forEach(([busy, tot, st], j) => {
      const x = 260 + j * 165, y = 60, w = 150, h = 160;
      stage.append(svg('rect', { x, y, width: w, height: h, rx: 10, fill: 'var(--surface-2)', stroke: STC[st], 'stroke-width': st === 'stopped' ? 1.2 : 2.4, 'stroke-dasharray': st === 'stopped' ? '5 4' : null }));
      stage.append(svg('text', { x: x + 10, y: y + 20, 'font-size': 12.5, 'font-weight': 700, fill: 'var(--text)', text: `cluster ${j + 1}` }));
      stage.append(svg('text', { x: x + w - 10, y: y + 20, 'text-anchor': 'end', 'font-size': 11, fill: STC[st], text: st }));
      const sz = f.size === 'Large' ? 26 : 18;
      for (let s = 0; s < tot; s++) stage.append(svg('rect', { x: x + 14 + (s % 2) * 64, y: y + 36 + Math.floor(s / 2) * 56, width: 54, height: 44, rx: 6, fill: s < busy ? 'var(--accent)' : 'none', opacity: s < busy ? 0.75 : 1, stroke: 'var(--border)' }));
      stage.append(svg('text', { x: x + w / 2, y: y + h - 8, 'text-anchor': 'middle', 'font-size': 10.5, fill: 'var(--text-3)', text: `${f.size.toLowerCase()} cluster${sz > 20 ? ': more cores & memory' : ''}` }));
    });
    if (f.big) {
      stage.append(svg('rect', { x: 260, y: 236, width: 480, height: 40, rx: 8, fill: 'var(--surface-2)', stroke: f.big === 'spill' ? 'var(--err)' : 'var(--ok)', 'stroke-width': 2.2 }));
      stage.append(svg('text', { x: 274, y: 261, 'font-size': 12.5, fill: f.big === 'spill' ? 'var(--err)' : 'var(--ok)', text: f.big === 'spill' ? 'heavy join: 9 min · spilled to disk (query profile)' : 'heavy join on Large: fits in memory, much faster' }));
    }
    stage.append(svg('text', { x: 16, y: H - 10, 'font-size': 11, fill: 'var(--text-3)', text: 'Illustrative: slots and timings are not real limits. Scale out = more clusters; scale up = bigger size.' }));
  }
  function render() {
    const f = FR[k]; stage.innerHTML = ''; draw(f);
    narr.innerHTML = ''; narr.className = 'caption' + (f.tone ? ' ' + f.tone : '');
    narr.append(el('div', { class: 'n', text: `${k + 1}/${FR.length}` }), el('div', { class: 't', html: f.c }));
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
