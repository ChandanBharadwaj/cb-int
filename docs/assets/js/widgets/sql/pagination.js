/* Pagination: OFFSET reads and discards rows; keyset seeks. Deep-page and concurrent-insert scenarios. */
IA.widget('pagination', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-pag-css')) document.head.append(el('style', { id: 'w-pag-css', text: `
.w-pag .c{fill:var(--surface);stroke:var(--border)}
.w-pag .c.scan{fill:var(--surface-2);stroke:var(--text-3)}
.w-pag .c.skip{fill:var(--surface-2);stroke:var(--border);opacity:.45}
.w-pag .c.ret{fill:var(--accent-soft);stroke:var(--ok);stroke-width:2}
.w-pag .c.p1{fill:var(--surface-2);stroke:var(--accent)}
.w-pag .c.dup{fill:var(--accent-soft);stroke:var(--err);stroke-width:3}
.w-pag .c.new{stroke:var(--warn);stroke-width:2;stroke-dasharray:4 3}` }));
  const PS = 4, COLS = 10, CW = 72, CH = 38, X0 = 20, Y0 = 70, W = 760, H = 300;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Index entries in sort order, newest first, laid out in rows of ten' });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  root.classList.add('w-pag');
  const base = () => Array.from({ length: 40 }, (_, i) => ({ id: 40 - i, c: '' }));
  function build(st) {
    const S = []; let cells = base(); let read = 0, ret = 0, seek = null, page1 = [];
    const push = (say, extra) => S.push(Object.assign({ say, cells: cells.map((c) => Object.assign({}, c)), read, ret, seek }, extra || {}));
    const off = st.mode === 'offset';
    if (st.sc === 'deep') {
      const P = 7, skip = (P - 1) * PS;
      push(off ? `Fetch <b>page ${P}</b> with <code>LIMIT ${PS} OFFSET ${skip}</code>. The index already gives the order, so no sort is needed.` : `Fetch <b>page ${P}</b> with a cursor: the client sent back the last row of page ${P - 1} (id ${40 - skip + 1}).`);
      if (off) {
        for (let p = 0; p < P - 1; p++) {
          for (let j = 0; j < PS; j++) { cells[p * PS + j].c = 'skip'; read++; }
          push(`Read rows ${p * PS + 1}–${(p + 1) * PS}: each is fetched, checked for visibility, handed to Limit, and <b>thrown away</b>. ${read} discarded so far.`);
        }
      } else {
        seek = skip; read = 0;
        push(`One B-tree descent (root → leaf, ~3 page reads) lands on the first entry <code>&lt; (ts, ${40 - skip + 1})</code>. Nothing before it is touched.`);
      }
      for (let j = 0; j < PS; j++) { cells[skip + j].c = 'ret'; read++; ret++; }
      push(`Return ${PS} rows. Rows read: <b>${read}</b>, returned: <b>${ret}</b>. ` + (off ? 'Page 7,000 would read 28,000 rows for the same 4.' : 'Page 7,000 costs the same as page 7.'));
    } else {
      push('Page 1, then a new post arrives, then page 2. Watch what each method shows on page 2.');
      for (let j = 0; j < PS; j++) { cells[j].c = 'ret'; read++; ret++; }
      page1 = cells.slice(0, PS).map((c) => c.id);
      push(`Page 1 returns ids ${page1.join(', ')}. The client shows them.`);
      cells.forEach((c) => { if (c.c === 'ret') c.c = 'p1'; });
      cells.unshift({ id: 41, c: 'new' }); cells.pop();
      push('Meanwhile a new post (id 41) is inserted. It sorts <b>first</b>, so every existing row moves one place down.');
      if (off) {
        for (let j = PS; j < PS * 2; j++) { cells[j].c = page1.includes(cells[j].id) ? 'dup' : 'ret'; }
        cells.slice(0, PS).forEach((c) => { if (c.c !== 'new') c.c = 'skip'; });
        read = PS * 2; ret = PS;
        push(`Page 2 = <code>OFFSET ${PS}</code>: skip the first ${PS} <i>current</i> rows. Id <b>${cells[PS].id}</b> was already on page 1: a <b>duplicate</b>. (Had a row been deleted, one would be skipped instead.)`);
      } else {
        const at = cells.findIndex((c) => c.id < page1[PS - 1]);
        seek = at; for (let j = at; j < at + PS; j++) cells[j].c = 'ret'; read = PS; ret = PS;
        push(`Page 2 = <code>WHERE (ts, id) &lt; (…, ${page1[PS - 1]})</code>. The cursor is a <b>value</b>, so the shift doesn’t matter: ids ${cells.slice(at, at + PS).map((c) => c.id).join(', ')}. No duplicates, no gaps. The new post appears when the user refreshes page 1.`);
      }
    }
    return S;
  }
  const T = (x, y, text, a) => svg('text', Object.assign({ x, y, text }, a || {}));
  function draw(s, st, stats) {
    stage.innerHTML = '';
    stage.append(T(X0, 26, 'index posts (created_at, id), scanned backward: newest → oldest', { 'font-size': 14, 'font-weight': 700, fill: 'var(--text)' }),
      T(X0, 48, 'grey = read & discarded · green = returned · red = duplicate · dashed = new row', { 'font-size': 12, fill: 'var(--text-3)' }));
    s.cells.forEach((c, i) => { const x = X0 + (i % COLS) * CW, y = Y0 + Math.floor(i / COLS) * (CH + 12);
      stage.append(svg('rect', { class: 'c ' + c.c, x, y, width: CW - 8, height: CH, rx: 6 }), T(x + (CW - 8) / 2, y + 24, 'id ' + c.id, { 'font-size': 13, 'text-anchor': 'middle', fill: c.c === 'skip' ? 'var(--text-3)' : 'var(--text)' })); });
    if (s.seek != null) { const x = X0 + (s.seek % COLS) * CW + (CW - 8) / 2, y = Y0 + Math.floor(s.seek / COLS) * (CH + 12);
      const p = svg('path', { d: `M ${x} ${Y0 - 14} L ${x} ${y - 2}`, stroke: 'var(--accent)', 'stroke-width': 3, 'marker-end': '', fill: 'none' });
      stage.append(p, svg('circle', { cx: x, cy: y - 4, r: 5, fill: 'var(--accent)' }), T(x + 8, Y0 - 16 > 60 ? Y0 - 16 : 62, 'seek', { 'font-size': 12, fill: 'var(--accent)', 'font-weight': 700 })); }
    const ratio = s.ret ? (s.read / s.ret).toFixed(1) : '–';
    stage.append(T(X0, H - 16, `rows read ${s.read}   ·   rows returned ${s.ret}   ·   work per useful row ${ratio}×`, { 'font-size': 14, fill: 'var(--text-2)' }));
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `read <b>${s.read}</b>` }), el('span', { class: 'w-stat', html: `returned <b>${s.ret}</b>` }));
  }
  const SQL = {
    offset: 'SELECT * FROM posts\nORDER BY created_at DESC, id DESC\nLIMIT 4 OFFSET :n;',
    keyset: 'SELECT * FROM posts\nWHERE (created_at, id) < (:last_ts, :last_id)\nORDER BY created_at DESC, id DESC\nLIMIT 4;'
  };
  // ---- generic stepper ----
  const st = { mode: 'offset', sc: 'deep' }; let steps = [], k = 0, gen = 0, running = false, speed = 2400;
  const seg = (items, cur, on, lab) => { const s = el('div', { class: 'seg', 'aria-label': lab }); items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(
    el('div', { class: 'w-controls' }, seg([['offset', 'OFFSET'], ['keyset', 'Keyset (seek)']], st.mode, (v) => { st.mode = v; reset(); }, 'Method')),
    el('div', { class: 'w-controls' }, seg([['deep', 'Deep page (7)'], ['insert', 'Insert between pages']], st.sc, (v) => { st.sc = v; reset(); }, 'Scenario')),
    sqlBox, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed')),
    narr, stats);
  const show = () => { draw(steps[k], st, stats); narr.firstChild.innerHTML = steps[k].say; bStep.disabled = k >= steps.length - 1; };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; steps = build(st); k = 0; sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(SQL[st.mode], 'sql') })); show(); }
  const step = () => { if (k >= steps.length - 1) return false; k++; show(); return true; };
  bStep.addEventListener('click', () => { gen++; running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { gen++; running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length - 1) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
