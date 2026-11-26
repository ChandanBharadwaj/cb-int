/* Streaming on Databricks: micro-batches from Kafka into Delta, with the checkpoint's offsets/commits logs, a crash, replay and an idempotent sink. Trigger mode toggle. */
IA.widget('dbx-streaming', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const W = 760, H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Kafka topic on the left, the streaming query in the middle, the checkpoint below it and a Delta table on the right' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  let mode = 'pt';
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Trigger' });
  [['pt', 'processingTime="1 minute"'], ['an', 'availableNow=True']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); stop(); k = 0; render(); }); seg.append(b); });
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'trigger' }), seg), el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  const COL = { idle: 'var(--border)', run: 'var(--accent)', ok: 'var(--ok)', err: 'var(--err)', warn: 'var(--warn)' };
  // frame: kafka end offsets, query state, offsets log, commits log, delta versions (rows), caption
  const PT = [
    { end: [0, 0], q: ['idle', 'query started'], off: [], com: [], dv: ['v0: empty'], c: 'A new query with a fresh checkpoint. Kafka has 2 partitions. <code>startingOffsets</code> applies <b>only now</b>, because the checkpoint is empty.' },
    { end: [40, 35], q: ['run', 'batch 0 planning'], off: ['0: p0→40 p1→35'], com: [], dv: ['v0: empty'], c: 'Batch 0: the driver picks an offset range and writes it to <code>offsets/0</code> <b>before</b> processing. This is the write-ahead log.' },
    { end: [40, 35], q: ['run', 'batch 0 writing'], off: ['0: p0→40 p1→35'], com: [], dv: ['v0: empty', 'v1: +75 rows (txn 0)'], c: 'Executors read exactly that range and write to Delta, which commits <b>v1</b>. The writer records the query id and batch id in the Delta log.' },
    { end: [40, 35], q: ['ok', 'batch 0 done'], off: ['0: p0→40 p1→35'], com: ['0'], dv: ['v0: empty', 'v1: +75 rows (txn 0)'], c: 'Then <code>commits/0</code> is written. A batch is finished only when its commit file exists.' },
    { end: [90, 60], q: ['run', 'batch 1 writing'], off: ['0: p0→40 p1→35', '1: p0→90 p1→60'], com: ['0'], dv: ['v0: empty', 'v1: +75 rows (txn 0)', 'v2: +75 rows (txn 1)'], c: 'One minute later (processingTime) batch 1 plans offsets, writes Delta v2…' },
    { end: [90, 60], q: ['err', 'CRASH (driver lost)'], off: ['0: p0→40 p1→35', '1: p0→90 p1→60'], com: ['0'], dv: ['v0: empty', 'v1: +75 rows (txn 0)', 'v2: +75 rows (txn 1)'], c: '…and the cluster dies <b>after</b> the Delta write but <b>before</b> <code>commits/1</code>. Offsets says batch 1 started; commits says it never finished.' },
    { end: [90, 60], q: ['warn', 'restart: replay batch 1'], off: ['0: p0→40 p1→35', '1: p0→90 p1→60'], com: ['0'], dv: ['v0: empty', 'v1: +75 rows (txn 0)', 'v2: +75 rows (txn 1)'], c: 'The job retries. On restart the query finds <code>offsets/1</code> without <code>commits/1</code> and <b>re-runs batch 1 with the same offset range</b>. Your new <code>startingOffsets</code> would be ignored.' },
    { end: [90, 60], q: ['ok', 'batch 1 done (no dup)'], off: ['0: p0→40 p1→35', '1: p0→90 p1→60'], com: ['0', '1'], dv: ['v0: empty', 'v1: +75 rows (txn 0)', 'v2: +75 rows (txn 1)'], c: 'The Delta sink sees that (query id, batch 1) is already committed and <b>skips the write</b>: end-to-end exactly-once. A <code>foreachBatch</code> sink only gets this if you make it idempotent (MERGE, or <code>txnAppId</code>/<code>txnVersion</code>).' }
  ];
  const AN = [
    { end: [130, 110], q: ['idle', 'job run starts'], off: ['0: p0→40 p1→35', '1: p0→90 p1→60'], com: ['0', '1'], dv: ['… v2'], c: '<code>availableNow</code> in a scheduled job: the cluster starts, the query resumes from the checkpoint (last commit: batch 1).' },
    { end: [130, 110], q: ['run', 'batch 2 (rate-limited)'], off: ['…', '2: p0→110 p1→85'], com: ['…', '1'], dv: ['… v2', 'v3: +45 rows'], c: 'It takes a snapshot of “what’s available now” (p0→130, p1→110) and processes it in <b>several batches</b>, respecting <code>maxOffsetsPerTrigger</code>.' },
    { end: [130, 110], q: ['run', 'batch 3'], off: ['…', '2: p0→110 p1→85', '3: p0→130 p1→110'], com: ['…', '2'], dv: ['… v2', 'v3: +45 rows', 'v4: +45 rows'], c: 'Batch 3 reaches the snapshot end. New data arriving now waits for the next run.' },
    { end: [150, 120], q: ['ok', 'query stops → cluster ends'], off: ['…', '2: p0→110 p1→85', '3: p0→130 p1→110'], com: ['…', '2', '3'], dv: ['… v2', 'v3: +45 rows', 'v4: +45 rows'], c: 'All committed, the query <b>stops by itself</b>, and the job cluster terminates. Same code, same exactly-once guarantees, but you pay only while it runs. The older <code>once=True</code> did one big batch and is deprecated.' }
  ];
  let k = 0, gen = 0, playing = false;
  const FR = () => (mode === 'pt' ? PT : AN);
  const panel = (x, y, w, h, title, lines, st) => {
    const g = svg('g');
    g.append(svg('rect', { x, y, width: w, height: h, rx: 9, fill: 'var(--surface-2)', stroke: COL[st || 'idle'], 'stroke-width': st && st !== 'idle' ? 2.4 : 1.2 }));
    g.append(svg('text', { x: x + 10, y: y + 20, 'font-size': 13, 'font-weight': 700, fill: 'var(--text)', text: title }));
    lines.forEach((l, i) => g.append(svg('text', { x: x + 10, y: y + 40 + i * 17, 'font-size': 11.5, 'font-family': 'var(--mono)', fill: 'var(--text-2)', text: l })));
    return g;
  };
  function draw(f, prev) {
    stage.append(panel(14, 40, 190, 120, 'Kafka topic “orders”', [`p0 end offset: ${f.end[0]}`, `p1 end offset: ${f.end[1]}`, '', mode === 'pt' ? 'trigger: every 1 min' : 'trigger: availableNow'], 'idle'));
    const qs = f.q[0];
    stage.append(panel(250, 40, 230, 120, 'Streaming query', [f.q[1], mode === 'pt' ? 'runs until stopped' : 'stops when caught up'], qs));
    stage.append(panel(250, 180, 230, 140, 'checkpoint/', ['offsets/  (planned)'].concat(f.off.map((s) => '  ' + s)).concat(['commits/  (finished)', '  ' + (f.com.join(', ') || '–')]), 'idle'));
    stage.append(panel(526, 40, 220, 280, 'Delta table silver.orders', f.dv, f.q[1].includes('writing') ? 'run' : 'idle'));
    const ln = (x1, y1, x2, y2, on) => svg('line', { x1, y1, x2, y2, stroke: on ? 'var(--accent)' : 'var(--text-3)', 'stroke-width': on ? 2.6 : 1.3, 'stroke-dasharray': on ? null : '4 4' });
    const active = qs === 'run' || qs === 'warn';
    stage.append(ln(204, 100, 250, 100, active), ln(480, 100, 526, 100, f.q[1].includes('writing') || f.q[1].includes('batch')), ln(365, 160, 365, 180, active || qs === 'ok'));
    stage.append(svg('text', { x: 14, y: 24, 'font-size': 12.5, fill: 'var(--text-2)', text: 'Structured Streaming on Databricks · illustrative offsets' }));
    if (qs === 'err') stage.append(svg('text', { x: 365, y: 140, 'text-anchor': 'middle', 'font-size': 20, fill: 'var(--err)', text: '✕' }));
  }
  function render() {
    const fr = FR(); const f = fr[k]; stage.innerHTML = ''; draw(f);
    narr.innerHTML = ''; narr.className = 'caption' + (f.q[0] === 'err' ? ' err' : f.q[0] === 'warn' ? ' warn' : f.q[0] === 'ok' ? ' ok' : '');
    narr.append(el('div', { class: 'n', text: `${k + 1}/${fr.length}` }), el('div', { class: 't', html: f.c }));
    bStep.disabled = k >= fr.length - 1;
  }
  function stop() { gen++; playing = false; bPlay.textContent = '▶ Play'; }
  async function play() {
    if (playing) { stop(); return; }
    const n = FR().length; if (k >= n - 1) k = 0;
    if (reduced) { k = n - 1; render(); return; }
    playing = true; const g = ++gen; bPlay.textContent = '❚❚ Pause'; render();
    while (g === gen && k < FR().length - 1) { await sleep(2600); if (g !== gen) return; k++; render(); }
    playing = false; bPlay.textContent = '▶ Play';
  }
  bPlay.addEventListener('click', play);
  bStep.addEventListener('click', () => { stop(); if (k < FR().length - 1) { k++; render(); } });
  bReset.addEventListener('click', () => { stop(); k = 0; render(); });
  render();
});
