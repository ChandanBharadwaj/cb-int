/* Upsert: two concurrent sessions upsert the same key. ON CONFLICT DO UPDATE / DO NOTHING / plain INSERT / MERGE. */
IA.widget('upsert-merge', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-ups-css')) document.head.append(el('style', { id: 'w-ups-css', text: `
.w-ups .lane{fill:var(--surface);stroke:var(--border)}
.w-ups .lane.run{stroke:var(--accent);stroke-width:2}
.w-ups .lane.wait{stroke:var(--warn);stroke-width:2;stroke-dasharray:5 4}
.w-ups .lane.ok{stroke:var(--ok);stroke-width:2}
.w-ups .lane.err{stroke:var(--err);stroke-width:2}
.w-ups .row{fill:var(--surface-2);stroke:var(--border)}
.w-ups .row.flight{stroke:var(--warn);stroke-dasharray:4 3;fill:var(--accent-soft)}
.w-ups .row.fresh{stroke:var(--accent);stroke-width:2}
.w-ups .ln{font-size:13px;fill:var(--text-2)}
.w-ups .ln.cur{fill:var(--text);font-weight:700}
.w-ups .ln.bad{fill:var(--err);font-weight:700}
.w-ups .ln.good{fill:var(--ok);font-weight:700}` }));
  const W = 760, H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Session T1 on the left, the counters table and its unique index in the middle, session T2 on the right' });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  root.classList.add('w-ups');
  const SQL = {
    update: "INSERT INTO counters (id, key, hits)\nVALUES (DEFAULT, 'promo', 1)\nON CONFLICT (key) DO UPDATE SET hits = counters.hits + EXCLUDED.hits\nRETURNING id, hits;",
    nothing: "INSERT INTO counters (id, key, hits)\nVALUES (DEFAULT, 'promo', 1)\nON CONFLICT (key) DO NOTHING\nRETURNING id, hits;",
    plain: "INSERT INTO counters (id, key, hits)\nVALUES (DEFAULT, 'promo', 1);",
    merge: "MERGE INTO counters c USING (VALUES ('promo', 1)) s(key, hits)\nON c.key = s.key\nWHEN MATCHED THEN UPDATE SET hits = c.hits + s.hits\nWHEN NOT MATCHED THEN INSERT (key, hits) VALUES (s.key, s.hits);"
  };
  // ---- snapshot builder ----
  function build(st) {
    const m = st.mode, ex = st.exists === 'yes';
    const S = []; let l1 = [], l2 = [], rows = ex ? [{ id: 1, hits: 5, c: '' }] : [], seq = ex ? 1 : 0, s1 = '', s2 = '', r1 = '–', r2 = '–';
    const push = (say, cur) => S.push({ say, l1: l1.slice(), l2: l2.slice(), rows: rows.map((r) => Object.assign({}, r)), seq, s1, s2, r1, r2, cur });
    push(ex ? 'Key <b>promo</b> already exists (hits = 5). Two requests upsert it at the same instant. Press Play.' : 'Key <b>promo</b> does not exist yet. Two requests insert it at the same instant. The unique index on <code>key</code> is the referee.');
    const isMerge = m === 'merge';
    // T1 starts
    seq++; l1.push(['nextval() → id ' + seq, '']); s1 = 'run';
    if (isMerge) l1.push([ex ? 'join: row found → MATCHED' : 'join: no row → NOT MATCHED', 'cur']);
    else l1.push([ex ? 'probe index: key exists' : 'probe index: no conflict', 'cur']);
    push(isMerge ? 'T1’s MERGE joins the source to the target <b>using its snapshot</b> and picks a WHEN branch.' : 'T1 evaluates the defaults first (<code>nextval()</code>), then probes the unique index for <code>promo</code>.', 1);
    if (!ex) {
      // race on a new key
      rows.push({ id: seq, hits: 1, c: 'flight', by: 'T1' });
      l1.push([isMerge ? 'INSERT heap + index entry' : 'speculative insert', 'cur']);
      push(isMerge ? 'T1 inserts the row. It is not committed, so nobody else can see it yet.' : 'T1 does a <b>speculative insertion</b>: heap tuple plus index entry, tagged with a token so it can be backed out if a conflict appears.', 1);
      seq++; s2 = 'run';
      l2.push(['nextval() → id ' + seq, '']);
      if (isMerge) { l2.push(['join: no row (snapshot)', '']); l2.push(['→ NOT MATCHED → INSERT', 'cur']); }
      else l2.push(['probe index: in-flight dup!', 'cur']);
      push(isMerge ? 'T2’s snapshot can’t see T1’s uncommitted row, so it also picks <b>NOT MATCHED</b> and tries to INSERT.' : 'T2 burns id ' + seq + ', probes the index, and finds T1’s <b>in-progress</b> entry for the same key.', 2);
      s2 = 'wait'; l2.push(['wait for T1 to finish…', 'cur']);
      push('T2 can’t decide yet: if T1 rolls back there is no conflict. It <b>waits on T1’s transaction lock</b> (wait event <code>Lock: transactionid</code>).', 2);
      rows[rows.length - 1].c = 'fresh'; s1 = 'ok'; s2 = 'run'; r1 = 'id ' + rows[0].id + ', hits 1'; l1.push(['COMMIT ✓', 'good']);
      if (m === 'plain' || m === 'nothing' || m === 'update' || isMerge) r1 = m === 'plain' || isMerge ? 'INSERT 0 1' : 'id ' + rows[0].id + ', hits 1';
      push('T1 commits. Its row is now visible. T2 wakes up.', 1);
      if (m === 'update') { rows[0].hits = 2; rows[0].c = 'fresh'; s2 = 'ok'; r2 = 'id ' + rows[0].id + ', hits 2'; l2.push(['conflict → lock row', '']); l2.push(['DO UPDATE: hits 1 + 1 = 2 ✓', 'good']);
        push('T2 sees a committed conflict, <b>locks the row</b> and runs DO UPDATE on the latest version. Both increments are counted. RETURNING gives T2 the <i>existing</i> id ' + rows[0].id + '.', 2); }
      else if (m === 'nothing') { s2 = 'ok'; r2 = '0 rows'; l2.push(['conflict → DO NOTHING', 'good']);
        push('T2 sees the committed conflict and skips. No error, but <b>RETURNING returns 0 rows</b>. Code that expects an id back gets null.', 2); }
      else { s2 = 'err'; r2 = 'ERROR 23505'; l2.push(['ERROR 23505 duplicate key', 'bad']);
        push(isMerge ? 'T2’s INSERT hits the unique index: <b>duplicate key error</b>. MERGE does not go back and re-evaluate as MATCHED (PG15–18). This is why MERGE is not a race-free upsert.' : 'Plain INSERT: T2 fails with <b>duplicate key value violates unique constraint</b>. The app must catch 23505 and retry as an UPDATE.', 2); }
    } else {
      if (m === 'plain') { s1 = 'err'; r1 = 'ERROR 23505'; l1.push(['ERROR 23505 duplicate key', 'bad']); push('A plain INSERT of an existing key fails at once.', 1);
        seq++; s2 = 'err'; r2 = 'ERROR 23505'; l2.push(['nextval() → id ' + seq, '']); l2.push(['ERROR 23505 duplicate key', 'bad']); push('So does T2. Each failed attempt still burned a sequence value.', 2); }
      else if (m === 'nothing') { s1 = 'ok'; r1 = '0 rows'; l1.push(['DO NOTHING → 0 rows', 'good']); push('Conflict → skip. DO NOTHING takes <b>no row lock</b>, so it never blocks on a committed row.', 1);
        seq++; s2 = 'ok'; r2 = '0 rows'; l2.push(['nextval() → id ' + seq, '']); l2.push(['DO NOTHING → 0 rows', 'good']); push('T2 also skips. Two ids were burned and nothing was inserted: that is where sequence gaps come from.', 2); }
      else {
        rows[0].hits = 6; rows[0].c = 'flight'; l1.push([isMerge ? 'UPDATE hits 5 → 6 (locked)' : 'lock row, DO UPDATE → 6', 'cur']);
        push('T1 locks the row and writes a new version with hits = 6 (uncommitted).', 1);
        seq++; s2 = 'run'; l2.push(['nextval() → id ' + seq, '']); l2.push([isMerge ? 'join: MATCHED' : 'probe: conflict', '']); s2 = 'wait'; l2.push(['row locked by T1, wait…', 'cur']);
        push('T2 also finds the row, but T1 holds the row lock. T2 <b>waits</b>.', 2);
        s1 = 'ok'; r1 = isMerge ? 'MERGE 1' : 'id 1, hits 6'; rows[0].c = 'fresh'; l1.push(['COMMIT ✓', 'good']); push('T1 commits hits = 6.', 1);
        rows[0].hits = 7; s2 = 'ok'; r2 = isMerge ? 'MERGE 1' : 'id 1, hits 7'; l2.push([isMerge ? 'recheck ON on new version' : 'lock latest version', '']); l2.push(['UPDATE hits 6 → 7 ✓', 'good']);
        push(isMerge ? 'T2 re-checks its join condition on the <b>new row version</b> (EvalPlanQual), still MATCHED, and applies +1 → 7. For existing rows MERGE behaves well; only the NOT MATCHED → INSERT path races.' : 'T2 gets the lock on the <b>latest committed version</b> (6) and applies +1 → 7. No lost update, even in READ COMMITTED.', 2);
      }
    }
    const ins = rows.length - (ex ? 1 : 0); const burned = seq - (ex ? 1 : 0) - ins;
    push(S[S.length - 1].say + ` <br><b>Result:</b> T1 → ${r1}; T2 → ${r2}. Sequence values used: ${seq - (ex ? 1 : 0)}, rows inserted: ${ins}, ids burned: ${burned}.`);
    return S;
  }
  // ---- drawing ----
  const T = (x, y, text, a) => svg('text', Object.assign({ x, y, text }, a || {}));
  function draw(s, st, stats) {
    stage.innerHTML = '';
    const lane = (x, name, log, state, res, cur) => {
      stage.append(svg('rect', { class: 'lane ' + (state || ''), x, y: 10, width: 230, height: H - 20, rx: 10 }), T(x + 12, 34, name, { 'font-size': 15, 'font-weight': 700, fill: 'var(--text)' }),
        T(x + 218, 34, state === 'wait' ? '⏳ waiting' : state === 'err' ? '✗ failed' : state === 'ok' ? '✓ done' : state === 'run' ? '● running' : 'idle', { 'font-size': 12, 'text-anchor': 'end', fill: state === 'err' ? 'var(--err)' : state === 'wait' ? 'var(--warn)' : state === 'ok' ? 'var(--ok)' : 'var(--text-3)' }));
      log.forEach(([t, c], i) => stage.append(T(x + 12, 62 + i * 24, t, { class: 'ln ' + (c === 'cur' && (!cur || i !== log.length - 1) ? '' : c) })));
      stage.append(T(x + 12, H - 24, 'returns: ' + res, { 'font-size': 12, fill: 'var(--text-3)' }));
    };
    lane(10, 'T1  (request A)', s.l1, s.s1, s.r1, s.cur === 1);
    lane(520, 'T2  (request B)', s.l2, s.s2, s.r2, s.cur === 2);
    const cx = 255;
    stage.append(T(cx + 125, 34, 'counters', { 'font-size': 15, 'font-weight': 700, 'text-anchor': 'middle', fill: 'var(--text)' }),
      T(cx + 125, 52, 'UNIQUE (key)', { 'font-size': 11, 'text-anchor': 'middle', fill: 'var(--text-3)' }));
    ['id', 'key', 'hits', 'state'].forEach((h, i) => stage.append(T(cx + 12 + i * 58, 80, h, { 'font-size': 11, fill: 'var(--text-3)' })));
    s.rows.forEach((r, i) => { const y = 90 + i * 40;
      stage.append(svg('rect', { class: 'row ' + r.c, x: cx, y, width: 250, height: 32, rx: 6 }));
      [r.id, 'promo', r.hits, r.c === 'flight' ? 'uncommitted' : 'committed'].forEach((v, j) => stage.append(T(cx + 12 + j * 58, y + 21, String(v), { 'font-size': j === 3 ? 11 : 13, fill: j === 3 && r.c === 'flight' ? 'var(--warn)' : 'var(--text)' }))); });
    if (!s.rows.length) stage.append(T(cx + 125, 112, '(no row for promo)', { 'font-size': 12, 'text-anchor': 'middle', fill: 'var(--text-3)' }));
    if (s.s2 === 'wait') { const p = svg('path', { d: `M 520 ${H / 2} C 480 ${H / 2}, 470 120, 505 110`, fill: 'none', stroke: 'var(--warn)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }); stage.append(p, T(cx + 125, 170, 'T2 blocked on T1', { 'font-size': 12, 'text-anchor': 'middle', fill: 'var(--warn)' })); }
    stage.append(T(cx + 125, H - 24, `sequence last_value = ${s.seq}`, { 'font-size': 12, 'text-anchor': 'middle', fill: 'var(--text-2)' }));
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `rows <b>${s.rows.length}</b>` }), el('span', { class: 'w-stat', html: `seq used <b>${s.seq - (st.exists === 'yes' ? 1 : 0)}</b>` }), el('span', { class: 'w-stat', html: `T2 <b>${ctx.esc ? ctx.esc(s.r2) : s.r2}</b>` }));
  }
  // ---- generic stepper ----
  const st = { mode: 'update', exists: 'no' }; let steps = [], k = 0, gen = 0, running = false, speed = 2400;
  const seg = (items, cur, on, lab) => { const s = el('div', { class: 'seg', 'aria-label': lab }); items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(
    el('div', { class: 'w-controls' }, seg([['update', 'ON CONFLICT DO UPDATE'], ['nothing', 'DO NOTHING'], ['plain', 'plain INSERT'], ['merge', 'MERGE']], st.mode, (v) => { st.mode = v; reset(); }, 'Statement')),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'key promo' }), seg([['no', 'is new (race)'], ['yes', 'already exists']], st.exists, (v) => { st.exists = v; reset(); }, 'Key exists')),
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
