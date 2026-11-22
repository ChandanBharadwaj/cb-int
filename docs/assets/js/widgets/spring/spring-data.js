/* Spring Data paging: Page (offset + count) vs Slice (offset, size+1) vs keyset Window, on 1M rows. Shows SQL and how many index entries Postgres reads. */
IA.widget('spring-data', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const N = 1000000; const SIZE = 20; const PAGES = [1, 2, 3, 5000];
  const MODES = {
    page: { l: 'Page<T>', sig: 'Page<OrderRow> findByStatus(Status s, Pageable p)' },
    slice: { l: 'Slice<T>', sig: 'Slice<OrderRow> findByStatus(Status s, Pageable p)' },
    keyset: { l: 'Window<T> (keyset)', sig: 'Window<OrderRow> findFirst20ByStatusOrderByCreatedAtDescIdDesc(Status s, ScrollPosition p)' }
  };
  const fmt = (n) => n.toLocaleString('en-US');
  function build(m) {
    const F = []; let total = 0;
    F.push({ p: 0, cap: `<code>${MODES[m].sig}</code>. Press Play to request pages 1, 2, 3 and then page 5,000.`, total });
    PAGES.forEach((p) => {
      const off = (p - 1) * SIZE; let data; let count = null; let read; let cap; let tone = null;
      if (m === 'keyset') {
        data = p === 1 ? 'select … from orders o where o.status = $1\norder by o.created_at desc, o.id desc\nfetch first 21 rows only'
          : 'select … from orders o where o.status = $1\n  and (o.created_at, o.id) < ($2, $3)   -- last row seen\norder by o.created_at desc, o.id desc\nfetch first 21 rows only';
        read = SIZE + 1;
        cap = p === 5000 ? 'Keyset can’t jump to “page 5,000”. It continues from the last row seen, so the 5,000th request in a scroll costs the same 21 index entries as the first.' : p === 1 ? 'First window: 21 rows (one extra tells us there is more). The last row’s <code>(created_at, id)</code> becomes the next <code>ScrollPosition</code>.' : `Next window: the WHERE on <code>(created_at, id)</code> lets the index scan start exactly where the last one ended. Still ${SIZE + 1} entries.`;
        tone = p === 5000 ? 'ok' : null;
      } else {
        const lim = m === 'page' ? SIZE : SIZE + 1;
        data = `select … from orders o where o.status = $1\norder by o.created_at desc, o.id desc\n${off ? `offset ${fmt(off)} rows ` : ''}fetch first ${lim} rows only`;
        read = off + lim;
        if (m === 'page') { count = 'select count(o.id) from orders o where o.status = $1'; read += N; }
        cap = m === 'page'
          ? (p === 5000 ? `Page 5,000: Postgres walks and discards <b>${fmt(off)}</b> rows for the OFFSET, and the count still scans all ${fmt(N)}. Every request pays for the count.` : `Page ${p}: the data query is cheap${off ? ` (skips ${off} rows)` : ''}, but the <b>count</b> visits all ${fmt(N)} matching rows to report <code>getTotalPages()</code>.`)
          : (p === 5000 ? `No count any more, but OFFSET still makes Postgres produce and throw away <b>${fmt(off)}</b> rows. Deep pages get linearly slower.` : `Slice asks for ${SIZE + 1} rows: if the 21st exists, <code>hasNext()</code> is true. No count query.`);
        tone = p === 5000 ? (m === 'page' ? 'err' : 'warn') : (m === 'page' ? 'warn' : null);
      }
      total += read;
      F.push({ p, off, data, count, read, dataRead: m === 'keyset' ? SIZE + 1 : off + (m === 'page' ? SIZE : SIZE + 1), countRead: count ? N : 0, cap, tone, total });
    });
    F.push(Object.assign({}, F[F.length - 1], { cap: m === 'page' ? `Four requests read ~${fmt(total)} index entries. Use Page only when the UI really needs a total, and cap the page number.` : m === 'slice' ? `Four requests read ~${fmt(total)} entries: no count, but deep OFFSETs still hurt and rows shift when new orders arrive.` : `Four requests read ${fmt(total)} entries in total. Constant cost per request and stable results under concurrent inserts; the trade-off is no random page access.`, tone: m === 'keyset' ? 'ok' : 'warn' }));
    return F;
  }
  let mode = 'page'; let F = build(mode); let k = 0; let gen = 0; let running = false;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Paging strategy' });
  Object.keys(MODES).forEach((m) => { const b = el('button', { text: MODES[m].l, class: m === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = m; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); F = build(m); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 700; const H = 290;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'SQL sent for the page request and a strip showing which part of a million-entry index Postgres reads' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, seg), el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text: t }, o || {}));
  const logW = (n, w) => (n <= 1 ? 0 : (Math.log10(n) / 6) * w);
  function draw(f) {
    stage.innerHTML = '';
    // SQL box
    stage.append(svg('rect', { x: 10, y: 10, width: W - 20, height: 92, rx: 8, fill: 'var(--surface-2)', stroke: 'var(--border)' }));
    if (!f.p) stage.append(T(22, 60, 'No request yet.', { fill: 'var(--text-3)' }));
    else {
      stage.append(T(22, 28, mode === 'keyset' ? `request #${f.p === 5000 ? '5,000' : f.p}` : `GET /orders?status=PAID&page=${f.p - 1}&size=${SIZE}`, { 'font-family': 'var(--mono)', 'font-size': 11, fill: 'var(--text-3)' }));
      f.data.split('\n').forEach((ln, i) => stage.append(T(22, 46 + i * 14, ln, { 'font-family': 'var(--mono)', 'font-size': 11 })));
      if (f.count) stage.append(T(W - 22, 94, f.count, { 'font-family': 'var(--mono)', 'font-size': 10.5, fill: 'var(--err)', 'text-anchor': 'end' }));
    }
    // index strip (linear)
    const sx = 10; const sw = W - 20; const sy = 128;
    stage.append(T(sx, sy - 8, `index on (created_at desc, id desc): ${fmt(N)} entries, newest first →`, { 'font-size': 11, fill: 'var(--text-2)' }));
    stage.append(svg('rect', { x: sx, y: sy, width: sw, height: 22, rx: 4, fill: 'var(--surface)', stroke: 'var(--border)' }));
    if (f.p) {
      const start = mode === 'keyset' ? f.off : 0; const skip = mode === 'keyset' ? 0 : f.off;
      if (f.countRead) stage.append(svg('rect', { x: sx, y: sy + 15, width: sw, height: 7, fill: 'var(--err)', opacity: 0.35 }));
      if (skip) stage.append(svg('rect', { x: sx, y: sy, width: Math.max(2, (skip / N) * sw), height: 15, fill: 'var(--warn)', opacity: 0.7 }));
      stage.append(svg('rect', { x: sx + ((start + skip) / N) * sw, y: sy - 3, width: 4, height: 28, fill: 'var(--accent)' }));
      stage.append(T(sx, sy + 38, skip ? `■ ${fmt(skip)} read and discarded (OFFSET)` : mode === 'keyset' && f.off ? '■ index scan starts at the last row seen' : '', { 'font-size': 10.5, fill: 'var(--warn)' }));
      if (f.countRead) stage.append(T(W - 10, sy + 38, `■ count(*) visits all ${fmt(N)}`, { 'font-size': 10.5, fill: 'var(--err)', 'text-anchor': 'end' }));
    }
    // log bars
    const by = 196; const bx = 150; const bw = W - bx - 20;
    stage.append(T(10, by - 6, 'index entries read per request (log scale)', { 'font-size': 11, fill: 'var(--text-2)' }));
    [['data query', f.dataRead || 0, 'var(--accent)'], ['count query', f.countRead || 0, 'var(--err)']].forEach(([l, v, c], i) => {
      const y = by + i * 34;
      stage.append(T(10, y + 16, l, { 'font-size': 11.5 }), svg('rect', { x: bx, y, width: bw, height: 22, rx: 4, fill: 'var(--surface-2)', stroke: 'var(--border)' }));
      if (v) stage.append(svg('rect', { x: bx, y, width: Math.max(3, logW(v, bw)), height: 22, rx: 4, fill: c, opacity: 0.85 }));
      stage.append(T(bx + Math.max(3, logW(v, bw)) + 6, y + 15, v ? fmt(v) : (i ? 'none' : ''), { 'font-size': 11, 'font-family': 'var(--mono)' }));
    });
    ['10', '1k', '100k', '1M'].forEach((t, i) => { const v = [1, 3, 5, 6][i]; stage.append(T(bx + (v / 6) * bw, by + 80, t, { 'font-size': 9.5, fill: 'var(--text-3)', 'text-anchor': 'middle' })); });
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `statements this request <b>${f.p ? (f.count ? 2 : 1) : 0}</b>` }), el('span', { class: 'w-stat', html: `entries read so far <b>${fmt(f.total)}</b>` }), el('span', { class: 'w-stat', html: 'rows returned <b>20</b>' }));
  }
  function show() {
    const f = F[k]; draw(f);
    narr.className = 'caption' + (f.tone ? ' ' + f.tone : '');
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k + 1}/${F.length}` }), el('div', { class: 't', html: f.cap }));
    bStep.disabled = k >= F.length - 1;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; show(); }
  bStep.addEventListener('click', () => { gen++; stop(); if (k < F.length - 1) { k++; show(); } });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { gen++; stop(); return; }
    if (k >= F.length - 1) k = 0;
    if (reduced) { k = F.length - 1; show(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen; show();
    while (running && g === gen && k < F.length - 1) { await sleep(2800); if (g !== gen) return; k++; show(); }
    if (g === gen) stop();
  });
  reset();
});
