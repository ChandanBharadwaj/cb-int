/* Performance & Photon: data skipping with per-file min/max stats under three layouts (no layout, liquid clustering, over-partitioning), then Photon and the disk cache on a second run. */
IA.widget('dbx-performance', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const W = 760, H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Grid of data files with min and max order_date per file; files the query can skip are greyed out' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  let layout = 'none';
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Table layout' });
  [['none', 'appended, no layout'], ['cluster', 'CLUSTER BY (order_date)'], ['part', 'PARTITIONED BY (customer_id)']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === layout ? 'on' : '' }); b.addEventListener('click', () => { layout = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); stop(); k = 0; render(); }); seg.append(b); });
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'layout' }), seg), el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  const Q = 7; // WHERE order_date = day 7
  function files() {
    if (layout === 'none') return Array.from({ length: 12 }, (_, i) => ({ min: 1 + (i % 3), max: 10 + ((i * 7) % 3), mb: 128 }));
    if (layout === 'cluster') return Array.from({ length: 12 }, (_, i) => ({ min: i + 1, max: i + 1 + (i % 4 === 3 ? 1 : 0), mb: 128 }));
    return Array.from({ length: 48 }, (_, i) => ({ min: 1, max: 12, mb: 2, cust: 1000 + i }));
  }
  const hit = (f) => f.min <= Q && Q <= f.max;
  const N = 4;
  const CAP = {
    none: [
      'Data was appended in arrival order, so every file holds a wide mix of dates. Each box is one file with its <b>min/max</b> <code>order_date</code> from the Delta log.',
      'Query: <code>WHERE order_date = 7</code>. Before reading, the engine compares 7 with each file’s min/max (<b>data skipping</b>). Every range contains 7…',
      '…so <b>all 12 files are read</b> (about 1.5 GB). Stats exist, but they can’t help when every file spans everything.',
      'Second run: Photon processes the columns in vectorized batches and the <b>disk cache</b> serves the files from local SSD, so it is faster, but it still reads everything. Layout beats compute.'
    ],
    cluster: [
      'With <b>liquid clustering</b> (<code>CLUSTER BY order_date</code>) <code>OPTIMIZE</code> rewrites data so each file covers a narrow date range. Same rows, different grouping.',
      'Same query, <code>WHERE order_date = 7</code>. Min/max ranges are tight now…',
      '…so only the files whose range contains 7 are read; the rest are <b>skipped</b> without opening them. That is a big part of what “fast on Databricks” means.',
      'Second run: Photon + disk cache on top of good skipping. You can change clustering keys later without rewriting the table up front (new data and OPTIMIZE use the new keys).'
    ],
    part: [
      '<code>PARTITIONED BY (customer_id)</code> with many customers creates a folder per value: here <b>48 tiny files</b> of ~2 MB instead of 12 × 128 MB. Imagine millions in production.',
      'Query filters on <code>order_date</code>, not the partition column, so partition pruning can’t help, and each tiny file spans all dates…',
      '…so <b>all 48 files are read</b>, each with its own open/footer/task overhead. Too many small files is one of the most common Databricks slowdowns.',
      'Fix: don’t partition small or medium tables (guidance: avoid it under about 1 TB), never on high-cardinality columns. Use liquid clustering, and OPTIMIZE / predictive optimization to compact files.'
    ]
  };
  let k = 0, gen = 0, playing = false;
  function draw() {
    const fs = files(); const big = fs.length <= 12;
    const cols = big ? 6 : 12, bw = big ? 112 : 54, bh = big ? 70 : 38, gx = big ? 10 : 6, gy = big ? 12 : 8;
    const ox = 20, oy = 54;
    stage.append(svg('text', { x: 20, y: 24, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: `main.silver.orders · ${fs.length} files` }));
    if (k >= 1) stage.append(svg('text', { x: 20, y: 44, 'font-size': 12.5, 'font-family': 'var(--mono)', fill: 'var(--accent)', text: 'SELECT sum(amount) FROM orders WHERE order_date = 7' }));
    let read = 0, mb = 0;
    fs.forEach((f, i) => {
      const x = ox + (i % cols) * (bw + gx), y = oy + Math.floor(i / cols) * (bh + gy);
      const h = hit(f); if (h) { read++; mb += f.mb; }
      const skipped = k >= 2 && !h; const reading = k >= 2 && h;
      stage.append(svg('rect', { x, y, width: bw, height: bh, rx: 7, fill: skipped ? 'none' : 'var(--surface-2)', stroke: reading ? (k >= 3 ? 'var(--ok)' : 'var(--accent)') : 'var(--border)', 'stroke-width': reading ? 2.4 : 1.1, 'stroke-dasharray': skipped ? '4 4' : null, opacity: skipped ? 0.55 : 1 }));
      if (big) {
        stage.append(svg('text', { x: x + 8, y: y + 20, 'font-size': 11.5, 'font-weight': 600, fill: skipped ? 'var(--text-3)' : 'var(--text)', text: `file ${i + 1} · ${f.mb} MB` }));
        stage.append(svg('text', { x: x + 8, y: y + 40, 'font-size': 11, 'font-family': 'var(--mono)', fill: k >= 1 && h ? 'var(--accent)' : 'var(--text-2)', text: `min ${f.min} max ${f.max}` }));
        if (k >= 2) stage.append(svg('text', { x: x + 8, y: y + 58, 'font-size': 10.5, fill: h ? 'var(--accent)' : 'var(--text-3)', text: h ? (k >= 3 ? 'read (Photon, cached)' : 'read') : 'skipped' }));
      } else {
        stage.append(svg('text', { x: x + 4, y: y + 15, 'font-size': 9, fill: 'var(--text-2)', text: `c=${f.cust}` }));
        stage.append(svg('text', { x: x + 4, y: y + 29, 'font-size': 9, 'font-family': 'var(--mono)', fill: 'var(--text-3)', text: '1…12' }));
      }
    });
    const by = H - 34;
    if (k >= 2) {
      stage.append(svg('text', { x: 20, y: by, 'font-size': 13, 'font-weight': 600, fill: read === fs.length ? 'var(--err)' : 'var(--ok)', text: `files read: ${read} / ${fs.length} · ~${mb >= 1000 ? (mb / 1024).toFixed(1) + ' GB' : mb + ' MB'} scanned · ${fs.length - read} skipped` }));
    }
    stage.append(svg('text', { x: 20, y: H - 12, 'font-size': 11, fill: 'var(--text-3)', text: 'Illustrative: 12 days, sizes rounded. Stats come from the Delta log (first 32 columns by default).' }));
  }
  function render() {
    stage.innerHTML = ''; draw();
    narr.innerHTML = ''; narr.className = 'caption' + (k >= 2 ? (layout === 'cluster' ? ' ok' : ' warn') : '');
    narr.append(el('div', { class: 'n', text: `${k + 1}/${N}` }), el('div', { class: 't', html: CAP[layout][k] }));
    bStep.disabled = k >= N - 1;
  }
  function stop() { gen++; playing = false; bPlay.textContent = '▶ Play'; }
  async function play() {
    if (playing) { stop(); return; }
    if (k >= N - 1) k = 0;
    if (reduced) { k = N - 1; render(); return; }
    playing = true; const g = ++gen; bPlay.textContent = '❚❚ Pause'; render();
    while (g === gen && k < N - 1) { await sleep(2800); if (g !== gen) return; k++; render(); }
    playing = false; bPlay.textContent = '▶ Play';
  }
  bPlay.addEventListener('click', play);
  bStep.addEventListener('click', () => { stop(); if (k < N - 1) { k++; render(); } });
  bReset.addEventListener('click', () => { stop(); k = 0; render(); });
  render();
});
