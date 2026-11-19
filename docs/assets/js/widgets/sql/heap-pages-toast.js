/* Heap page anatomy: header, line pointers growing down, tuples growing up; HOT vs non-HOT updates; TOAST. */
IA.widget('heap-pages-toast', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-hpt-css')) document.head.append(el('style', { id: 'w-hpt-css', text: `
.w-hpt .pg{fill:var(--surface);stroke:var(--text-3);stroke-width:1.5}
.w-hpt .hdr{fill:var(--surface-2);stroke:var(--border)}
.w-hpt .lp{fill:var(--surface-2);stroke:var(--border)}
.w-hpt .lp.new,.w-hpt .tp.new{stroke:var(--accent);stroke-width:2.5}
.w-hpt .lp.red{fill:var(--accent-soft);stroke:var(--warn)}
.w-hpt .lp.dead{stroke:var(--err);stroke-dasharray:3 2}
.w-hpt .tp{fill:var(--accent-soft);stroke:var(--border)}
.w-hpt .tp.old{fill:var(--surface-2);stroke:var(--err);stroke-dasharray:5 3}
.w-hpt .tp.foc{stroke:var(--accent);stroke-width:3}
.w-hpt .free{fill:none;stroke:var(--border);stroke-dasharray:2 4}
.w-hpt .box{fill:var(--surface);stroke:var(--border)}
.w-hpt .ie{fill:var(--surface-2);stroke:var(--border)}
.w-hpt .ie.new{stroke:var(--warn);stroke-width:2}` }));
  const PAGE = 8192, HDR = 24, LPB = 4, TUP = 1336;
  const W = 760, H = 470, PX = 16, PY = 36, PW = 300, PH = 420;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'An 8 KB heap page on the left; tuple header, indexes and overflow storage on the right' });
  root.classList.add('w-hpt');
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function build(st) {
    const ff = +st.ff, S = [];
    let s = { lps: [], tups: [], p1: [], pk: [], si: [], toast: [], focus: null };
    const push = (say) => S.push(Object.assign(clone(s), { say }));
    push('An empty 8 KB page. The 24-byte <b>page header</b> holds the LSN, checksum, and two offsets: <code>pd_lower</code> (end of the line-pointer array) and <code>pd_upper</code> (start of tuple data). Free space is everything in between.');
    const limit = Math.floor(PAGE * ff / 100);
    let n = 0;
    while (true) {
      const used = HDR + (s.lps.length + 1) * LPB + (s.tups.length + 1) * TUP;
      if (PAGE - used < 0 || (PAGE - (PAGE - used)) > limit) break;
      n++; const slot = s.lps.length + 1;
      s.lps.forEach((l) => { l.c = ''; }); s.tups.forEach((t) => { t.c = ''; });
      s.lps.push({ slot, kind: 'n', c: 'new' }); s.tups.push({ slot, id: n, xmin: 700 + n, xmax: 0, ctid: `(0,${slot})`, fl: '', c: 'new' });
      s.pk.push({ k: n, tid: `(0,${slot})` }); s.si.push({ k: 'new', tid: `(0,${slot})` }); s.focus = slot;
      push(n === 1 ? `INSERT id 1: a 4-byte <b>line pointer</b> is appended at the top (pd_lower grows down), and the 1,336-byte tuple is written at the <b>bottom</b> of the page (pd_upper moves up). Its address is <code>ctid (0,1)</code>.` : `INSERT id ${n} → line pointer ${slot}, tuple at ctid (0,${slot}). Both indexes get an entry pointing at (0,${slot}).`);
    }
    s.lps.forEach((l) => { l.c = ''; }); s.tups.forEach((t) => { t.c = ''; });
    const free = () => PAGE - HDR - s.lps.length * LPB - s.tups.length * TUP;
    push(ff < 100 ? `fillfactor ${ff}: the next INSERT would push the page past ${ff}% (${limit.toLocaleString()} B), so it goes to a new page. <b>${free().toLocaleString()} B stay reserved</b> for UPDATEs of these rows.` : `fillfactor 100: the page is packed with ${n} rows. Only <b>${free()} B</b> of free space remain.`);
    if (st.act === 'toast') {
      s.focus = null;
      push('INSERT a row whose <code>body</code> is 5,000 bytes of random text. The tuple would be ~5 KB, above <b>TOAST_TUPLE_THRESHOLD (~2 KB)</b>, so the TOAST machinery runs before the tuple is placed.');
      s.toast = [{ seq: 0, b: 1996 }, { seq: 1, b: 1996 }, { seq: 2, b: 1008 }];
      push('Step 1: try to compress (pglz by default, lz4 in PG14+ if configured). Random text doesn’t shrink enough. Step 2: move it <b>out of line</b>: split into ~2 KB chunks stored as rows of <code>pg_toast.pg_toast_&lt;oid&gt;</code> (with its own index on chunk_id, chunk_seq).');
      const slot = s.lps.length + 1; const small = 64;
      s.lps.push({ slot, kind: 'n', c: 'new' }); s.tups.push({ slot, id: 99, xmin: 902, xmax: 0, ctid: `(0,${slot})`, fl: 'HASEXTERNAL', c: 'new', size: small, toast: true });
      s.pk.push({ k: 99, tid: `(0,${slot})`, c: 'new' }); s.focus = slot;
      push(`The heap tuple now holds an <b>18-byte TOAST pointer</b> instead of the value: the row is ~${small} B and fits even on this page. Reading <code>body</code> later costs extra chunk fetches; queries that don’t select it never touch the TOAST table.`);
      return S;
    }
    const upd = 2, old = s.tups.find((t) => t.id === upd);
    const indexed = st.act === 'status';
    const fits = free() >= TUP + LPB;
    s.focus = old.slot;
    push(`UPDATE id ${upd} SET ${indexed ? "status = 'paid' (indexed)" : "note = '…' (not indexed)"}. Postgres never overwrites: it writes a <b>new tuple version</b>. Free space on this page: ${free().toLocaleString()} B; a new version needs ${(TUP + LPB).toLocaleString()} B.`);
    const hot = fits && !indexed;
    let nt;
    if (fits) {
      const slot = s.lps.length + 1;
      s.lps.push({ slot, kind: 'n', c: 'new' }); nt = { slot, id: upd, xmin: 900, xmax: 0, ctid: `(0,${slot})`, fl: hot ? 'HEAP_ONLY_TUPLE' : '', c: 'new' }; s.tups.push(nt);
      old.xmax = 900; old.ctid = `(0,${slot})`; old.fl = hot ? 'HOT_UPDATED' : ''; old.c = 'old';
    } else {
      nt = { slot: 1, id: upd, xmin: 900, xmax: 0, ctid: '(1,1)', fl: '', c: 'new' }; s.p1.push(nt);
      old.xmax = 900; old.ctid = '(1,1)'; old.c = 'old';
    }
    s.focus = old.slot;
    push(`The old version gets <code>xmax = 900</code> (the updating transaction) and its <code>t_ctid</code> now points to the new version <b>${nt.ctid}</b>. Readers with older snapshots still see the old one.` + (fits ? '' : ' There was no room here, so the new version went to <b>page 1</b>.'));
    if (hot) {
      push('<b>HOT update</b>: same page and no indexed column changed. Flags HOT_UPDATED / HEAP_ONLY_TUPLE are set and <b>no index entry is added</b>. An index lookup lands on (0,2) and follows the chain to the live version.');
      const lp = s.lps.find((l) => l.slot === old.slot); lp.kind = 'r'; lp.to = nt.slot; lp.c = '';
      s.tups = s.tups.filter((t) => t !== old); s.focus = nt.slot;
      push(`After commit, the next access to this page <b>prunes</b> it (no VACUUM needed): the dead version is removed and line pointer ${old.slot} becomes a <b>REDIRECT → ${nt.slot}</b>. The index still says (0,${old.slot}) and still works. pd_upper moved back by 1,336 B.`);
    } else {
      s.pk.push({ k: upd, tid: nt.ctid, c: 'new' }); s.si.push({ k: indexed ? 'paid' : 'new', tid: nt.ctid, c: 'new' });
      push(`<b>Not HOT</b> (${!fits ? 'no room on the page' : 'an indexed column changed'}): <b>every index</b> on the table gets a new entry pointing at ${nt.ctid}, even the primary key whose value didn’t change. That is the write amplification: more WAL, index bloat, more vacuum work.`);
      if (fits) { const lp = s.lps.find((l) => l.slot === old.slot); lp.kind = 'd'; s.tups = s.tups.filter((t) => t !== old); }
      s.focus = null;
      push(fits ? `Pruning can remove the dead tuple, but line pointer ${old.slot} stays <b>DEAD</b> (not redirect) until VACUUM removes the stale index entries that point at it.` : 'The old version stays on page 0 until VACUUM removes it and its index entries. Rows of this table now spread across more pages. Lower fillfactor would have kept this update HOT.');
    }
    return S;
  }
  const T = (x, y, text, a) => svg('text', Object.assign({ x, y, text }, a || {}));
  function draw(s, st, stats) {
    stage.innerHTML = '';
    const tsize = (t) => t.size || TUP;
    const lower = HDR + s.lps.length * LPB, upper = PAGE - s.tups.reduce((a, t) => a + tsize(t), 0);
    stage.append(T(PX, 22, 'heap page 0 (8,192 bytes)', { 'font-size': 14, 'font-weight': 700, fill: 'var(--text)' }),
      svg('rect', { class: 'pg', x: PX, y: PY, width: PW, height: PH, rx: 4 }),
      svg('rect', { class: 'hdr', x: PX + 4, y: PY + 4, width: PW - 8, height: 26, rx: 3 }),
      T(PX + 12, PY + 22, `header 24 B · pd_lower ${lower} · pd_upper ${upper}`, { 'font-size': 12, fill: 'var(--text)' }));
    // line pointers
    s.lps.forEach((l, i) => { const x = PX + 6 + (i % 4) * 72, y = PY + 36 + Math.floor(i / 4) * 24;
      stage.append(svg('rect', { class: 'lp ' + (l.kind === 'r' ? 'red' : l.kind === 'd' ? 'dead' : '') + ' ' + (l.c || ''), x, y, width: 66, height: 20, rx: 3 }),
        T(x + 33, y + 14, l.kind === 'r' ? `lp${l.slot}→${l.to}` : l.kind === 'd' ? `lp${l.slot} dead` : `lp${l.slot}`, { 'font-size': 11, 'text-anchor': 'middle', fill: 'var(--text)' })); });
    const lpBottom = PY + 36 + Math.ceil(Math.max(s.lps.length, 1) / 4) * 24;
    stage.append(T(PX + PW - 8, lpBottom + 10, '↓ line pointers grow down', { 'font-size': 10, 'text-anchor': 'end', fill: 'var(--text-3)' }));
    // tuples from bottom
    let y = PY + PH - 4;
    const slots = s.tups.slice().sort((a, b) => a.slot - b.slot);
    slots.forEach((t) => { const h = t.size ? 22 : 40; y -= h + 3;
      stage.append(svg('rect', { class: 'tp ' + (t.c || '') + (s.focus === t.slot ? ' foc' : ''), x: PX + 6, y, width: PW - 12, height: h, rx: 4 }),
        T(PX + 14, y + (t.size ? 15 : 17), `(0,${t.slot})  id ${t.id}${t.toast ? '  [TOAST ptr]' : ''}`, { 'font-size': 12, 'font-weight': 700, fill: t.c === 'old' ? 'var(--text-3)' : 'var(--text)' }));
      if (!t.size) stage.append(T(PX + 14, y + 33, `xmin ${t.xmin} · xmax ${t.xmax || 0} · ${tsize(t).toLocaleString()} B`, { 'font-size': 11, fill: 'var(--text-2)' })); });
    const freeTop = lpBottom + 14, freeBot = y - 4;
    if (freeBot - freeTop > 14) { stage.append(svg('rect', { class: 'free', x: PX + 6, y: freeTop, width: PW - 12, height: freeBot - freeTop, rx: 4 }),
      T(PX + PW / 2, (freeTop + freeBot) / 2 + 4, `free ${(upper - lower).toLocaleString()} B`, { 'font-size': 12, 'text-anchor': 'middle', fill: 'var(--text-3)' })); }
    stage.append(T(PX + PW - 8, Math.min(freeBot + 2, PY + PH - 6), s.tups.length ? '↑ tuples grow up' : '', { 'font-size': 10, 'text-anchor': 'end', fill: 'var(--text-3)' }));
    // right panel: tuple header
    const RX = 340, RW = 404;
    const f = s.tups.find((t) => t.slot === s.focus) || null;
    stage.append(svg('rect', { class: 'box', x: RX, y: PY, width: RW, height: 112, rx: 8 }), T(RX + 12, PY + 22, 'tuple header (23 B + padding)', { 'font-size': 13, 'font-weight': 700, fill: 'var(--text)' }));
    if (f) [[`t_xmin`, f.xmin], [`t_xmax`, f.xmax || '0 (live)'], [`t_ctid`, f.ctid + (f.ctid !== `(0,${f.slot})` ? '  ← newer version' : '  (itself)')], ['flags', f.fl || '–']].forEach(([k, v], i) =>
      stage.append(T(RX + 12, PY + 44 + i * 18, k, { 'font-size': 12, fill: 'var(--text-3)' }), T(RX + 90, PY + 44 + i * 18, String(v), { 'font-size': 12, fill: 'var(--text)', 'font-weight': 700 })));
    else stage.append(T(RX + 12, PY + 50, 'select a step that touches a tuple', { 'font-size': 12, fill: 'var(--text-3)' }));
    // indexes
    const IY = PY + 124;
    const idx = (x, name, list) => { stage.append(T(x, IY + 14, name, { 'font-size': 12, 'font-weight': 700, fill: 'var(--text)' }));
      list.slice(-8).forEach((e, i) => { const yy = IY + 22 + i * 21; stage.append(svg('rect', { class: 'ie ' + (e.c || ''), x, y: yy, width: 190, height: 18, rx: 3 }), T(x + 8, yy + 13, `${e.k} → ${e.tid}`, { 'font-size': 11, fill: 'var(--text)' })); }); };
    idx(RX, 'index pkey (id)', s.pk); idx(RX + 210, 'index acct_status', s.si);
    // page 1 / toast
    const BY = IY + 200;
    if (s.toast.length) { stage.append(svg('rect', { class: 'box', x: RX, y: BY, width: RW, height: 70, rx: 8 }), T(RX + 12, BY + 18, 'pg_toast.pg_toast_<oid>  (chunk_id, chunk_seq, data)', { 'font-size': 12, 'font-weight': 700, fill: 'var(--text)' }));
      s.toast.forEach((c, i) => stage.append(svg('rect', { class: 'ie new', x: RX + 12 + i * 128, y: BY + 30, width: 120, height: 26, rx: 4 }), T(RX + 72 + i * 128, BY + 47, `seq ${c.seq} · ${c.b} B`, { 'font-size': 11, 'text-anchor': 'middle', fill: 'var(--text)' }))); }
    else if (s.p1.length) { stage.append(svg('rect', { class: 'box', x: RX, y: BY, width: RW, height: 70, rx: 8 }), T(RX + 12, BY + 18, 'heap page 1', { 'font-size': 12, 'font-weight': 700, fill: 'var(--text)' }));
      s.p1.forEach((t) => stage.append(svg('rect', { class: 'tp new', x: RX + 12, y: BY + 28, width: RW - 24, height: 30, rx: 4 }), T(RX + 22, BY + 48, `(1,1)  id ${t.id}  xmin ${t.xmin}  (new version, not HOT)`, { 'font-size': 12, fill: 'var(--text)' }))); }
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `pd_lower <b>${lower}</b>` }), el('span', { class: 'w-stat', html: `pd_upper <b>${upper}</b>` }), el('span', { class: 'w-stat', html: `free <b>${(upper - lower).toLocaleString()} B</b>` }), el('span', { class: 'w-stat', html: `index entries <b>${s.pk.length + s.si.length}</b>` }));
  }
  // ---- generic stepper ----
  const st = { ff: '70', act: 'note' }; let steps = [], k = 0, gen = 0, running = false, speed = 2400;
  const seg = (items, cur, on, lab) => { const s = el('div', { class: 'seg', 'aria-label': lab }); items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'fillfactor' }), seg([['100', '100'], ['70', '70']], st.ff, (v) => { st.ff = v; reset(); }, 'Fillfactor')),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'then' }), seg([['note', 'UPDATE non-indexed col'], ['status', 'UPDATE indexed col'], ['toast', 'INSERT 5 KB value']], st.act, (v) => { st.act = v; reset(); }, 'Action')),
    el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed')),
    narr, stats);
  const show = () => { draw(steps[k], st, stats); narr.firstChild.innerHTML = steps[k].say; bStep.disabled = k >= steps.length - 1; };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; steps = build(st); k = 0; show(); }
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
