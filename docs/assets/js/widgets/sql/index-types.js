/* Index types: animated lookups for GIN, GiST, BRIN, hash, partial and expression indexes. */
IA.widget('index-types', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-ixt-css')) document.head.append(el('style', { id: 'w-ixt-css', text: `
.w-ixt .bx{fill:var(--surface);stroke:var(--border)}
.w-ixt .bx.hot{fill:var(--accent-soft);stroke:var(--accent);stroke-width:2.5}
.w-ixt .bx.ok{fill:var(--accent-soft);stroke:var(--ok);stroke-width:2.5}
.w-ixt .bx.bad{stroke:var(--err);stroke-width:2;stroke-dasharray:5 3}
.w-ixt .bx.dim{opacity:.35}
.w-ixt .bx.q{fill:var(--surface-2);stroke:var(--warn);stroke-width:2}
.w-ixt .tx{font-size:12px;fill:var(--text)}
.w-ixt .tx.h{font-weight:700;font-size:13px}
.w-ixt .tx.s{fill:var(--text-3);font-size:11px}` }));
  const W = 760, H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Diagram of the selected index type answering a query' });
  root.classList.add('w-ixt');
  const B = (id, x, y, w, h, lines, extra) => Object.assign({ id, x, y, w, h, lines }, extra || {});
  const L = (x, y, text, cls) => ({ label: true, x, y, text, cls: cls || 's' });
  const MODES = {
    gin: { name: 'GIN', sql: "CREATE INDEX ON posts USING gin (tags);\nSELECT * FROM posts WHERE tags @> ARRAY['sql','pg'];", build() {
      const rows = [[1, 'sql, pg'], [2, 'java'], [3, 'sql, go'], [4, 'pg, sql, java'], [5, 'pg']];
      const keys = [['go', '3'], ['java', '2, 4'], ['pg', '1, 4, 5'], ['sql', '1, 3, 4']];
      const items = [L(20, 24, 'heap: posts (id, tags)', 'h'), L(400, 24, 'GIN: key → posting list of rows', 'h'),
        ...rows.map(([id, t], i) => B('r' + id, 20, 40 + i * 50, 300, 40, [`row ${id}`, `tags {${t}}`])),
        ...keys.map(([k, p], i) => B('k' + k, 400, 40 + i * 56, 340, 44, [`'${k}'`, `→ rows ${p}`])),
        B('res', 400, 270, 340, 44, ['bitmap AND', '–'], { q: 1 })];
      return { items, steps: [
        { say: 'An <b>inverted index</b>: one entry per distinct element, each with the list of rows containing it. Query: <code>tags @&gt; {sql, pg}</code>.' },
        { say: 'Extract the query’s keys: <b>sql</b> and <b>pg</b>. Look up <b>pg</b> (a B-tree search over the keys): rows 1, 4, 5.', c: { kpg: 'hot' } },
        { say: 'Look up <b>sql</b>: rows 1, 3, 4.', c: { kpg: 'hot', ksql: 'hot' } },
        { say: '<code>@&gt;</code> means “contains all”, so intersect the posting lists: <b>{1, 4}</b>. GIN produces a bitmap; it never returns rows in order and has no index-only scans.', c: { kpg: 'hot', ksql: 'hot', res: 'ok' }, set: { res: ['bitmap AND', 'rows 1, 4'] } },
        { say: 'Bitmap Heap Scan fetches rows 1 and 4 and <b>rechecks</b> the condition. Rows 2, 3, 5 were never touched. The cost is paid on write instead: row 4 added 3 index entries.', c: { kpg: 'hot', ksql: 'hot', res: 'ok', r1: 'ok', r4: 'ok', r2: 'dim', r3: 'dim', r5: 'dim' }, set: { res: ['bitmap AND', 'rows 1, 4'] } }] };
    } },
    gist: { name: 'GiST', sql: "CREATE INDEX ON bookings USING gist (during);\nSELECT * FROM bookings WHERE during && '[11:00, 13:30)';", build() {
      const X = (h) => 40 + (h - 8) * 68; const bars = [['b1', 9, 10], ['b2', 10, 11.5], ['b3', 13, 14], ['b4', 14, 16], ['b5', 15, 17]];
      const items = [L(20, 22, 'ranges on a timeline (hours)', 'h'), ...[8, 10, 12, 14, 16, 18].map((h) => L(X(h) - 6, 42, String(h))),
        ...bars.map(([id, a, b], i) => B(id, X(a), 50 + i * 18, X(b) - X(a), 14, [], { bar: id })),
        B('q', X(11), 146, X(13.5) - X(11), 14, [], { q: 1 }), L(X(13.5) + 6, 157, 'query 11:00–13:30', 'tx'),
        L(20, 190, 'GiST tree: each entry stores the union (bounding range) of its subtree', 'h'),
        B('root', 300, 200, 160, 34, ['root']),
        B('n1', 90, 250, 260, 50, ['N1 bound [9, 11.5)', 'b1, b2']), B('n2', 410, 250, 300, 50, ['N2 bound [13, 17)', 'b3, b4, b5'])];
      return { items, steps: [
        { say: 'GiST is a balanced tree of <b>bounding predicates</b>. For ranges, each internal entry is the union of the ranges below it. Query: <code>during &amp;&amp; [11:00, 13:30)</code> (overlaps).' },
        { say: 'Root: does the query overlap N1’s bound [9, 11.5)? Yes (11 &lt; 11.5). N2’s bound [13, 17)? Yes (13 &lt; 13.5). Unlike a B-tree, a search can descend <b>several children</b>.', c: { root: 'hot', n1: 'hot', n2: 'hot', q: 'q' } },
        { say: 'In N1: b1 [9, 10) doesn’t overlap; <b>b2</b> [10, 11.5) does.', c: { n1: 'hot', b2: 'ok', b1: 'dim', q: 'q' } },
        { say: 'In N2: <b>b3</b> [13, 14) overlaps; b4 and b5 don’t. Result: b2, b3. The same structure powers exclusion constraints (“no two rows may overlap”) and nearest-neighbour <code>ORDER BY p &lt;-&gt; point</code>.', c: { n2: 'hot', b2: 'ok', b3: 'ok', b1: 'dim', b4: 'dim', b5: 'dim', q: 'q' } }] };
    } },
    brin: { name: 'BRIN', variants: [['sorted', 'append-only (sorted)'], ['shuffled', 'shuffled data']], sql: "CREATE INDEX ON metrics USING brin (ts);   -- 128 pages per range\nSELECT * FROM metrics WHERE ts >= '10:00' AND ts < '11:00';", build(v) {
      const sorted = v !== 'shuffled';
      const rng = Array.from({ length: 8 }, (_, i) => sorted ? [i * 3, i * 3 + 2] : [0 + (i % 2), 22 + (i % 2)]);
      const f = (h) => String(h).padStart(2, '0') + ':' + (h === rng[0][1] || true ? '59' : '00');
      const items = [L(20, 24, 'BRIN: one summary (min, max) per block range of 128 heap pages', 'h'),
        ...rng.map(([a, b], i) => B('g' + i, 20 + (i % 4) * 182, 44 + Math.floor(i / 4) * 120, 170, 100, [`pages ${i * 128}–${i * 128 + 127}`, `min ${String(a).padStart(2, '0')}:00`, `max ${f(b)}`]))];
      const hit = rng.map(([a, b]) => a <= 10 && b >= 10);
      const cm = {}; hit.forEach((h, i) => { cm['g' + i] = h ? 'ok' : 'dim'; });
      const n = hit.filter(Boolean).length;
      return { items, steps: [
        { say: (sorted ? 'Rows were inserted in time order, so each block range covers a <b>narrow</b> slice of time.' : 'Rows were inserted in random order (or updated / backfilled), so every block range spans <b>almost the whole day</b>.') + ' The whole index is a few entries: tiny.' },
        { say: 'Query 10:00–11:00: compare against each range’s min/max. ' + (sorted ? `Only ${n} range can contain matches.` : `All ${n} ranges <i>might</i> contain matches.`), c: cm },
        { say: `Read every page of the matching ranges (a <b>lossy</b> bitmap: ${n * 128} pages) and recheck each row. ` + (sorted ? 'Here that’s 1/8 of the table for a 24 kB index: a great trade for append-only time series.' : 'That is the whole table: the index is useless. Check <code>pg_stats.correlation</code> before choosing BRIN.'), c: Object.assign({}, cm) }] };
    } },
    hash: { name: 'Hash', sql: "CREATE INDEX ON sessions USING hash (token);\nSELECT * FROM sessions WHERE token = 'f3a9…c1';", build() {
      const items = [L(20, 24, 'hash index: hash(key) → bucket → (hash code, TID)', 'h'),
        B('qk', 20, 50, 200, 44, ["token = 'f3a9…c1'", 'a 64-char value'], { q: 1 }),
        B('hf', 260, 50, 200, 44, ['hash_any()', '→ 0x7c41e2a9']),
        ...[0, 1, 2, 3].map((i) => B('bk' + i, 20 + i * 182, 130, 170, 70, [`bucket ${i}`, i === 1 ? '0x7c41e2a9 → (88,3)' : '…', i === 1 ? '0x7c41ff02 → (12,7)' : '…'])),
        B('heap', 260, 240, 240, 50, ['heap tuple (88,3)', "recheck token = 'f3a9…c1'"])];
      return { items, steps: [
        { say: 'A hash index stores only a <b>4-byte hash code</b> per entry, not the key itself. For long keys (tokens, URLs) that can make it smaller than a B-tree.' },
        { say: 'Hash the search value: 0x7c41e2a9. The low bits pick the bucket: <b>bucket 1</b>.', c: { qk: 'q', hf: 'hot', bk1: 'hot' } },
        { say: 'Scan the bucket for matching hash codes (collisions are possible), then fetch the heap tuple and <b>recheck</b> the real value.', c: { hf: 'hot', bk1: 'ok', heap: 'ok' } },
        { say: 'Only <code>=</code> works. Hash order is meaningless, so no ranges, no ORDER BY, no UNIQUE, no multi-column, no index-only scans. Crash-safe since PG10.', c: { bk0: 'dim', bk2: 'dim', bk3: 'dim', bk1: 'ok' } }] };
    } },
    partial: { name: 'Partial', variants: [['hit', "WHERE status = 'pending'"], ['miss', 'WHERE status = $1 (generic plan)']], sql: "CREATE INDEX ON jobs (run_at) WHERE status = 'pending';", build(v) {
      const st = ['done', 'done', 'pending', 'done', 'done', 'done', 'pending', 'done', 'done', 'done'];
      const items = [L(20, 24, 'jobs table (10,000,000 rows, 0.1% pending)', 'h'), L(470, 24, 'partial index: pending rows only', 'h'),
        ...st.map((s, i) => B('j' + i, 20 + (i % 5) * 84, 40 + Math.floor(i / 5) * 60, 76, 48, [`job ${i + 1}`, s])),
        B('ix', 470, 40, 270, 108, ['run_at → TID', 'job 3 (pending)', 'job 7 (pending)']),
        B('qq', 20, 190, 720, 44, [v === 'miss' ? 'WHERE status = $1 AND run_at < now()   -- generic plan' : "WHERE status = 'pending' AND run_at < now()"], { q: 1 })];
      const pend = { j2: 'ok', j6: 'ok' };
      return { items, steps: [
        { say: 'The index stores entries <b>only for rows matching its WHERE</b>. Done jobs never enter it, so it stays tiny and in cache, and updates of done rows don’t maintain it.', c: { j0: 'dim', j1: 'dim', j3: 'dim', j4: 'dim', j5: 'dim', j7: 'dim', j8: 'dim', j9: 'dim' } },
        v === 'miss' ? { say: 'The planner must <b>prove</b> the query’s WHERE implies <code>status = \'pending\'</code>. With a parameter in a <b>generic plan</b> (e.g. after 5 executions of a JDBC prepared statement), it can’t: <code>$1</code> could be anything.', c: { qq: 'q', ix: 'bad' } }
          : { say: 'The query says <code>status = \'pending\'</code> literally, which implies the index predicate. Index usable.', c: Object.assign({ qq: 'q', ix: 'hot' }, pend) },
        v === 'miss' ? { say: 'Result: a seq scan over 10M rows, or another index. Fix: put the literal in the SQL (it is a constant for this query anyway), or <code>plan_cache_mode = force_custom_plan</code> for that statement.', c: { qq: 'q', ix: 'bad', j0: 'hot', j1: 'hot', j3: 'hot', j4: 'hot', j5: 'hot', j7: 'hot', j8: 'hot', j9: 'hot', j2: 'hot', j6: 'hot' } }
          : { say: 'Index scan touches only jobs 3 and 7. The classic job-queue pattern: <code>… ORDER BY run_at LIMIT 10 FOR UPDATE SKIP LOCKED</code> over a partial index.', c: Object.assign({ qq: 'q', ix: 'ok' }, pend) }] };
    } },
    expr: { name: 'Expression', variants: [['hit', 'WHERE lower(email) = …'], ['miss', 'WHERE email = …']], sql: 'CREATE INDEX ON users (lower(email));', build(v) {
      const em = ['Ann@Mail.io', 'bob@x.io', 'CARL@corp.com', 'dina@x.io'];
      const items = [L(20, 24, 'users.email (as stored)', 'h'), L(400, 24, 'index on lower(email), sorted', 'h'),
        ...em.map((e, i) => B('u' + i, 20, 40 + i * 50, 300, 40, [e])),
        ...em.map((e) => e.toLowerCase()).sort().map((e, i) => B('x' + i, 400, 40 + i * 50, 340, 40, [e + ' → row'])),
        B('qq', 20, 260, 720, 44, [v === 'miss' ? "WHERE email = 'carl@corp.com'" : "WHERE lower(email) = lower('CARL@corp.com')"], { q: 1 })];
      return { items, steps: [
        { say: 'The index stores the <b>computed value</b> <code>lower(email)</code>, sorted. The function must be IMMUTABLE. ANALYZE also collects statistics on the expression.' },
        v === 'miss' ? { say: 'The query compares the raw column. The planner matches index expressions <b>textually</b>: <code>email</code> ≠ <code>lower(email)</code>. Not usable.', c: { qq: 'q', x0: 'bad', x1: 'bad', x2: 'bad', x3: 'bad' } }
          : { say: 'The query uses exactly <code>lower(email)</code>. B-tree search finds <b>carl@corp.com</b>.', c: { qq: 'q', x2: 'ok' } },
        v === 'miss' ? { say: 'Seq scan, and it doesn’t even find CARL@corp.com (case differs). Same trap with <code>created_at::date = …</code> vs an index on <code>created_at</code>.', c: { qq: 'q', u0: 'hot', u1: 'hot', u2: 'bad', u3: 'hot' } }
          : { say: 'One index probe, then fetch the row. To enforce it, make it <code>UNIQUE</code>: no more Carl and carl as two accounts.', c: { qq: 'q', x2: 'ok', u2: 'ok' } }] };
    } }
  };
  function build(st) {
    const M = MODES[st.m]; const { items, steps } = M.build(st.v);
    let set = {};
    return steps.map((s) => { set = Object.assign({}, set, s.set || {}); return { say: s.say, c: s.c || {}, items, set }; });
  }
  function draw(s, st, stats) {
    stage.innerHTML = '';
    s.items.forEach((it) => {
      if (it.label) { stage.append(svg('text', { x: it.x, y: it.y, class: 'tx ' + it.cls, text: it.text })); return; }
      const c = s.c[it.id] || (it.q ? 'q' : '');
      stage.append(svg('rect', { class: 'bx ' + c, x: it.x, y: it.y, width: it.w, height: it.h, rx: 6 }));
      const lines = s.set[it.id] || it.lines;
      lines.forEach((t, i) => stage.append(svg('text', { x: it.x + 10, y: it.y + 17 + i * 18, class: 'tx' + (i === 0 ? ' h' : ''), text: t })));
    });
    stats.innerHTML = '';
    const n = Object.values(s.c).filter((v) => v === 'ok').length;
    stats.append(el('span', { class: 'w-stat', html: `type <b>${MODES[st.m].name}</b>` }), el('span', { class: 'w-stat', html: `step <b>${k + 1}</b> / ${steps.length}` }), el('span', { class: 'w-stat', html: `matched <b>${n}</b>` }));
  }
  // ---- generic stepper ----
  const st = { m: 'gin', v: null }; let steps = [], k = 0, gen = 0, running = false, speed = 2400;
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const seg = (items, cur, on, lab) => { const s = el('div', { class: 'seg', 'aria-label': lab }); items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  const varHost = el('div', { class: 'w-controls' });
  const setVariants = () => { varHost.innerHTML = ''; const V = MODES[st.m].variants; if (!V) { st.v = null; varHost.style.display = 'none'; return; } varHost.style.display = ''; st.v = V[0][0]; varHost.append(el('span', { class: 'tiny', text: 'variant' }), seg(V, st.v, (v) => { st.v = v; reset(); }, 'Variant')); };
  root.append(
    el('div', { class: 'w-controls' }, seg(Object.keys(MODES).map((m) => [m, MODES[m].name]), st.m, (v) => { st.m = v; setVariants(); reset(); }, 'Index type')),
    varHost, sqlBox, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed')),
    narr, stats);
  const show = () => { draw(steps[k], st, stats); narr.firstChild.innerHTML = steps[k].say; bStep.disabled = k >= steps.length - 1; };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; steps = build(st); k = 0; sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(MODES[st.m].sql, 'sql') })); show(); }
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
  setVariants(); reset();
});
