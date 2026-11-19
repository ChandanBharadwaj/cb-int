/* "Why is my index ignored?" checker: animate the planner's two gates (can it? does it want to?) per symptom, broken vs fixed. */
IA.widget('index-not-used', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-inu-css')) document.head.append(el('style', { id: 'w-inu-css', text: `
.w-inu .gates{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:10px 0}
.w-inu .gate{border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--surface);min-height:120px;transition:border-color .3s,background .3s}
.w-inu .gate .gh{font-size:12px;color:var(--text-3);font-weight:700;margin-bottom:4px}
.w-inu .gate .gs{font-size:20px;line-height:1;margin-bottom:6px}
.w-inu .gate .gt{font-size:13px;color:var(--text-2)}
.w-inu .gate.pending{opacity:.45}
.w-inu .gate.cur{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.w-inu .gate.ok{border-color:var(--ok)}
.w-inu .gate.fail{border-color:var(--err);background:var(--surface-2)}
.w-inu .gate.warn{border-color:var(--warn)}
.w-inu .gate.na{opacity:.5}
.w-inu .plan{font-family:var(--mono,ui-monospace,monospace);font-size:13px;border-radius:8px;padding:10px;background:var(--surface-2);border:1px solid var(--border);white-space:pre-wrap;word-break:break-word}
.w-inu .plan.ok{border-color:var(--ok)}
.w-inu .plan.fail{border-color:var(--err)}
.w-inu .idx{font-size:13px;color:var(--text-2);margin:4px 0}` }));
  const G = ['① Expression matches the index?', '② Operator / opclass / collation fits?', '③ Row estimate', '④ Cost: index vs seq scan'];
  // per case: idx, b = broken, f = fixed. Each: sql, cards [[state, text]×4], plan, planOk, end
  const C = {
    fn: { label: 'Function on column', idx: 'CREATE INDEX ON users (created_at);',
      b: { sql: "WHERE created_at::date = '2025-03-01'", cards: [['fail', 'The index stores <code>created_at</code>. The predicate is on <code>created_at::date</code>, a different expression.'], ['na', 'Not reached.'], ['na', 'Not reached.'], ['na', 'Only a seq scan can evaluate the filter.']], plan: "Seq Scan on users\n  Filter: ((created_at)::date = '2025-03-01'::date)", ok: false, end: 'Can’t use the index: every row is cast and compared.' },
      f: { sql: "WHERE created_at >= '2025-03-01'\n  AND created_at <  '2025-03-02'", cards: [['ok', 'Bare column <code>created_at</code>.'], ['ok', '<code>&gt;=</code> and <code>&lt;</code> are B-tree operators.'], ['ok', '~144 of 50,000 rows (0.3%).'], ['ok', 'Index scan is far cheaper.']], plan: 'Index Scan using u_created on users\n  Index Cond: ((created_at >= …) AND (created_at < …))', ok: true, end: 'Same rows, written as a half-open range on the bare column.' } },
    cast: { label: 'Type mismatch', idx: 'id bigint PRIMARY KEY',
      b: { sql: 'WHERE id = 42.0          -- or a BigDecimal bound from Java', cards: [['fail', 'No <code>bigint = numeric</code> operator in the index’s family, so Postgres rewrites it as <code>(id)::numeric = 42.0</code>: the column is cast.'], ['na', 'Not reached.'], ['na', 'Not reached.'], ['na', 'Seq scan.']], plan: 'Seq Scan on users\n  Filter: ((id)::numeric = 42.0)', ok: false, end: 'A cast on the column side is just like a function: the index is invisible.' },
      f: { sql: 'WHERE id = 42            -- bind a Long', cards: [['ok', 'Bare column <code>id</code>.'], ['ok', 'int4/int8 comparisons are in the same B-tree operator family.'], ['ok', '1 row (unique).'], ['ok', 'Index scan.']], plan: 'Index Scan using users_pkey on users\n  Index Cond: (id = 42)', ok: true, end: 'Look for <code>(col)::type</code> in Filter lines: it is always worth a second look.' } },
    like: { label: 'Leading wildcard', idx: 'CREATE INDEX ON users (email);',
      b: { sql: "WHERE email LIKE '%@gmail.com'", cards: [['ok', 'Bare column <code>email</code>.'], ['fail', 'A B-tree can turn LIKE into a range only for a <b>fixed prefix</b>. <code>%…</code> has none.'], ['na', 'Not reached.'], ['na', 'Seq scan.']], plan: "Seq Scan on users\n  Filter: (email ~~ '%@gmail.com'::text)", ok: false, end: 'Leading wildcards need trigrams (pg_trgm GIN) or a reversed expression index.' },
      f: { sql: "-- CREATE INDEX ON users (reverse(email) text_pattern_ops);\nWHERE reverse(email) LIKE reverse('%@gmail.com')", cards: [['ok', 'Matches the expression index <code>reverse(email)</code>.'], ['ok', '<code>reverse(\'%@gmail.com\')</code> folds to <code>\'moc.liamg@%\'</code>: now a prefix.'], ['warn', '~16,700 rows (a third of users are gmail).'], ['ok', 'Bitmap scan wins at this size.']], plan: "Bitmap Heap Scan on users\n  -> Bitmap Index Scan on u_rev\n     Index Cond: (reverse(email) ~>=~ 'moc.liamg@' AND … ~<~ 'moc.liamgA')", ok: true, end: 'Suffix search turned into prefix search. For arbitrary <code>%x%</code>, use pg_trgm.' } },
    coll: { label: 'Collation (LIKE prefix)', idx: 'CREATE INDEX ON users (email);  -- DB collation en_US.UTF-8',
      b: { sql: "WHERE email LIKE 'user42@%'", cards: [['ok', 'Bare column.'], ['fail', 'Under a linguistic collation the index order isn’t byte order, so a prefix isn’t one contiguous range.'], ['na', 'Not reached.'], ['na', 'Seq scan.']], plan: "Seq Scan on users\n  Filter: (email ~~ 'user42@%'::text)", ok: false, end: 'Works in a C-collation database (like the playground) and silently breaks in en_US.UTF-8 production.' },
      f: { sql: "-- CREATE INDEX ON users (email text_pattern_ops);\nWHERE email LIKE 'user42@%'", cards: [['ok', 'Bare column.'], ['ok', '<code>text_pattern_ops</code> compares byte-wise, so LIKE prefix becomes <code>~&gt;=~ … ~&lt;~</code>.'], ['ok', 'A handful of rows.'], ['ok', 'Index scan.']], plan: "Index Scan using users_email_pattern on users\n  Index Cond: ((email ~>=~ 'user42@') AND (email ~<~ 'user42A'))", ok: true, end: 'Keep the default-collation index too if you need ORDER BY email in locale order.' } },
    lowsel: { label: 'Low selectivity', idx: 'CREATE INDEX ON users (status);',
      b: { sql: "WHERE status = 'active'     -- 99.8% of rows", cards: [['ok', 'Bare column.'], ['ok', '<code>=</code> is a B-tree operator.'], ['warn', '~49,900 of 50,000 rows: the most common value in the stats.'], ['fail', 'Random heap reads for nearly every page cost more than one sequential pass.']], plan: "Seq Scan on users\n  Filter: (status = 'active'::text)", ok: false, end: 'The index <i>could</i> be used; the planner correctly decides it <i>shouldn’t</i>.' },
      f: { sql: "WHERE status = 'pending'    -- 0.2% of rows", cards: [['ok', 'Bare column.'], ['ok', 'B-tree operator.'], ['ok', '~100 rows.'], ['ok', 'Index (or bitmap) scan.']], plan: "Index Scan using u_status on users\n  Index Cond: (status = 'pending'::text)", ok: true, end: 'Same index, different value, different plan. For queue-like data a partial index on the rare value is even better.' } },
    or: { label: 'OR condition', idx: 'indexes on email, phone; none on lower(country)',
      b: { sql: "WHERE email = 'user42@corp.io'\n   OR lower(country) = 'de'", cards: [['fail', 'Branch 1 matches u_email, but branch 2 (<code>lower(country)</code>) matches no index.'], ['na', 'For OR, <b>every</b> branch needs an index to build a BitmapOr.'], ['na', 'Not reached.'], ['na', 'Seq scan with the whole OR as a filter.']], plan: "Seq Scan on users\n  Filter: ((email = …) OR (lower(country) = 'de'))", ok: false, end: 'One unindexable OR branch drags the whole query to a seq scan.' },
      f: { sql: "WHERE email = 'user42@corp.io'\n   OR phone = '+15550000042'", cards: [['ok', 'Both branches match an index.'], ['ok', 'Both use <code>=</code>.'], ['ok', '2 rows.'], ['ok', 'Two bitmap index scans, ORed.']], plan: 'Bitmap Heap Scan on users\n  -> BitmapOr\n     -> Bitmap Index Scan on u_email\n     -> Bitmap Index Scan on u_phone', ok: true, end: 'Or rewrite as UNION of two index-friendly queries.' } },
    stale: { label: 'Stale statistics', idx: 'CREATE INDEX ON jobs (status);  -- last ANALYZE: before the backlog drained',
      b: { sql: "WHERE status = 'pending'", cards: [['ok', 'Bare column.'], ['ok', 'B-tree operator.'], ['fail', 'Stats say pending = 85% of rows (old). Reality: 0.1% after the backlog drained. Estimate rows=850,000, actual 1,000.'], ['fail', 'Based on the wrong estimate, a seq scan looks cheaper.']], plan: "Seq Scan on jobs  (rows=850000) (actual rows=1000)\n  Filter: (status = 'pending'::text)", ok: false, end: 'Estimate vs actual off by 850×: the statistics are the bug, not the index.' },
      f: { sql: "ANALYZE jobs;\nWHERE status = 'pending'", cards: [['ok', 'Bare column.'], ['ok', 'B-tree operator.'], ['ok', 'Fresh stats: ~1,000 rows.'], ['ok', 'Index scan.']], plan: "Index Scan using jobs_status_idx on jobs  (rows=1000) (actual rows=1000)", ok: true, end: 'Analyze after bulk changes; tune autovacuum_analyze_scale_factor for volatile tables.' } },
    small: { label: 'Small table', idx: 'tiny (10 rows, 1 page) with PRIMARY KEY',
      b: { sql: 'SELECT * FROM tiny WHERE id = 3', cards: [['ok', 'Bare column.'], ['ok', 'B-tree operator.'], ['ok', '1 row.'], ['fail', 'Seq scan = read 1 page. Index = read the index (≥1 page) <i>plus</i> the heap page.']], plan: 'Seq Scan on tiny\n  Filter: (id = 3)', ok: false, end: 'Correct choice. Don’t “fix” this; test plans on production-sized data instead.' },
      f: { sql: '-- same query, table grows to 1,000,000 rows', cards: [['ok', 'Bare column.'], ['ok', 'B-tree operator.'], ['ok', '1 row.'], ['ok', '3–4 page reads vs ~5,400 pages.']], plan: 'Index Scan using tiny_pkey on tiny\n  Index Cond: (id = 3)', ok: true, end: 'Plans depend on size. A dev DB with 10 rows tells you nothing.' } },
    generic: { label: 'Generic plan (prepared)', idx: "CREATE INDEX ON users (created_at) WHERE status = 'pending';",
      b: { sql: "PREPARE q(text) AS … WHERE status = $1 AND created_at > …\n-- 6th execution: generic plan", cards: [['fail', 'The partial index needs proof that <code>status = \'pending\'</code>. With <code>$1</code> unknown, it can’t be proven.'], ['na', 'Partial index ruled out.'], ['warn', 'Generic estimate: average selectivity for status, not the rare value.'], ['fail', 'Falls back to the full u_status index (or u_created, or a seq scan) and filters.']], plan: 'Index Scan using u_status on users\n  Index Cond: (status = $1)\n  Filter: (created_at > …)', ok: false, end: 'The JDBC “slow after 5 calls” signature.' },
      f: { sql: "-- plan_cache_mode = force_custom_plan, or a literal:\nWHERE status = 'pending' AND created_at > …", cards: [['ok', 'Literal <code>\'pending\'</code> implies the partial index predicate.'], ['ok', 'B-tree operator on created_at.'], ['ok', 'Uses the per-value statistics.'], ['ok', 'Tiny partial index.']], plan: 'Index Scan using u_pending on users\n  Index Cond: (created_at > …)', ok: true, end: 'Custom plans see the value; generic plans see only <code>$1</code>.' } }
  };
  const st = { c: 'fn', v: 'b' }; let steps = [], k = 0, gen = 0, running = false, speed = 2400;
  const idxLine = el('div', { class: 'idx' }), sqlBox = el('div', { class: 'codebox' }), gates = el('div', { class: 'gates' }), plan = el('div', { class: 'plan' });
  function build() {
    const c = C[st.c], d = c[st.v], S = [];
    S.push({ n: 0, say: `Query on the left, index above. The planner first asks “<b>can</b> I use the index?” (gates ① ②), then “<b>do I want to</b>?” (③ ④). Press Play.` });
    let stopped = false;
    d.cards.forEach(([s, t], i) => { S.push({ n: i + 1, say: (stopped ? '(skipped) ' : '') + t }); if (s === 'fail' && i < 2) stopped = true; });
    S.push({ n: 5, say: (d.ok ? '✓ ' : '✗ ') + d.end + (st.v === 'b' ? ' Flip to <b>fixed</b> to compare.' : '') });
    return S;
  }
  function draw() {
    const c = C[st.c], d = c[st.v], s = steps[k];
    idxLine.innerHTML = '<b>index:</b> ' + ctx.esc(c.idx);
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(d.sql, 'sql') }));
    gates.innerHTML = '';
    G.forEach((h, i) => { const [state, text] = d.cards[i]; const shown = s.n > i;
      gates.append(el('div', { class: 'gate ' + (shown ? state : 'pending') + (s.n === i + 1 ? ' cur' : '') },
        el('div', { class: 'gh', text: h }), el('div', { class: 'gs', text: shown ? ({ ok: '✓', fail: '✗', warn: '!', na: '–' })[state] : '…' }), el('div', { class: 'gt', html: shown ? text : '' }))); });
    plan.className = 'plan' + (s.n >= 5 ? (d.ok ? ' ok' : ' fail') : '');
    plan.textContent = s.n >= 5 ? d.plan : 'EXPLAIN → (pending)';
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `case <b>${c.label}</b>` }), el('span', { class: 'w-stat', html: `version <b>${st.v === 'b' ? 'broken' : 'fixed'}</b>` }), el('span', { class: 'w-stat', html: `index used <b>${s.n >= 5 ? (d.ok ? 'yes' : 'no') : '?'}</b>` }));
  }
  // ---- generic stepper ----
  const seg = (items, cur, on, lab) => { const s = el('div', { class: 'seg', 'aria-label': lab }); items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-inu');
  root.append(
    el('div', { class: 'w-controls' }, seg(Object.keys(C).map((x) => [x, C[x].label]), st.c, (v) => { st.c = v; reset(); }, 'Symptom')),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'query' }), seg([['b', 'as written'], ['f', 'fixed']], st.v, (v) => { st.v = v; reset(); }, 'Version')),
    el('div', { class: 'w-stage' }, idxLine, sqlBox, gates, plan),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed')),
    narr, stats);
  const show = () => { draw(); narr.firstChild.innerHTML = steps[k].say; bStep.disabled = k >= steps.length - 1; };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; steps = build(); k = 0; show(); }
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
