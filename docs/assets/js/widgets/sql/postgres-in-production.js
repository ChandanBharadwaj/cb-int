/* Zero-downtime migrations: naive vs expand/contract during a rolling deploy, for three common changes. */
IA.widget('postgres-in-production', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-pip-style')) {
    document.head.append(el('style', { id: 'w-pip-style', text: `
.w-pip-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 10px; }
@media (max-width: 620px) { .w-pip-row { grid-template-columns: 1fr; } }
.w-pip-box { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--surface-2); min-width: 0; }
.w-pip-box h5 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); }
.w-pip-pods { display: flex; gap: 6px; flex-wrap: wrap; }
.w-pip-pod { flex: 1 1 70px; border: 2px solid var(--ok); border-radius: 8px; padding: 6px; text-align: center; font-family: var(--mono); font-size: 12px; background: var(--surface); transition: all .3s; }
.w-pip-pod.err { border-color: var(--err); color: var(--err); }
.w-pip-pod.new { border-color: var(--accent); }
.w-pip-sch { font-family: var(--mono); font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.w-pip-sch .add { color: var(--ok); } .w-pip-sch .del { color: var(--err); text-decoration: line-through; } .w-pip-sch .ro { color: var(--text-3); }
.w-pip-lock { margin-top: 6px; font-size: 12px; }
.w-pip-lock b { font-family: var(--mono); }
.w-pip-phase { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; }
.w-pip-phase span { font-size: 11.5px; padding: 3px 8px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-3); }
.w-pip-phase span.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); font-weight: 600; }
.w-pip-phase span.done { color: var(--text-2); }
` }));
  }
  let change = 'rename'; let way = 'safe'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segC = seg([['rename', 'rename a column'], ['fk', 'add a foreign key'], ['idx', 'add an index']], () => change, (v) => { change = v; reset(); }, 'Change');
  const segW = seg([['naive', 'naive'], ['safe', 'zero-downtime']], () => way, (v) => { way = v; reset(); }, 'Approach');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const phases = el('div', { class: 'w-pip-phase' }); const pods = el('div', { class: 'w-pip-pods' }); const sch = el('div', { class: 'w-pip-sch' }); const lock = el('div', { class: 'w-pip-lock' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segC), el('div', { class: 'w-controls' }, segW), phases,
    el('div', { class: 'w-pip-row' }, el('div', { class: 'w-pip-box' }, el('h5', { text: 'app pods (rolling deploy)' }), pods, lock), el('div', { class: 'w-pip-box' }, el('h5', { text: 'schema / migration' }), sch)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  // a step: { ph: phase index, pods: ['v1','v1','v1'], err: [bool...], sch: [[text, cls]], lock: 'html', t, e: errors added }
  const P = (a, b, c) => [a, b, c];
  const SC = {
    rename: {
      naive: { ph: ['migrate', 'deploy', 'done'], st: [
        { ph: 0, pods: P('v1', 'v1', 'v1'), sch: [['users(id, name, email)', '']], lock: 'none', t: 'Goal: rename <code>users.name</code> to <code>full_name</code>. Three pods run v1, which reads and writes <code>name</code>.' },
        { ph: 0, pods: P('v1', 'v1', 'v1'), err: [1, 1, 1], sch: [['ALTER TABLE users RENAME COLUMN name TO full_name;', 'add']], lock: 'ACCESS EXCLUSIVE (brief)', e: 1200, t: 'Flyway runs the rename before the pods are replaced. The rename itself is instant, but <b>every v1 pod</b> now fails: <code>ERROR: column "name" does not exist</code>.' },
        { ph: 1, pods: P('v2', 'v1', 'v1'), err: [0, 1, 1], sch: [['users(id, full_name, email)', '']], lock: 'none', e: 800, t: 'The rolling deploy replaces pods one by one. v2 works, the remaining v1 pods keep failing for the whole rollout.' },
        { ph: 2, pods: P('v2', 'v2', 'v2'), sch: [['users(id, full_name, email)', '']], lock: 'none', t: 'Minutes of errors. Worse: if v2 has to be rolled back, v1 can’t run against the new schema at all. <b>Rule: every schema version must work with both the old and the new app version.</b>' }] },
      safe: { ph: ['expand', 'dual-write', 'backfill', 'read new', 'contract'], st: [
        { ph: 0, pods: P('v1', 'v1', 'v1'), sch: [['users(id, name, email)', '']], lock: 'none', t: 'Same goal, but in steps where old and new code always work. First, <b>expand</b>.' },
        { ph: 0, pods: P('v1', 'v1', 'v1'), sch: [['ALTER TABLE users ADD COLUMN full_name text;', 'add']], lock: 'ACCESS EXCLUSIVE for ~1 ms (with lock_timeout)', t: 'Add the new nullable column. A metadata-only change: no table rewrite. v1 ignores the extra column.' },
        { ph: 1, pods: P('v2', 'v2', 'v2'), pods2: 'new', sch: [['users(id, name, full_name, email)', ''], ['v2 writes BOTH columns, reads name', 'ro']], lock: 'none', t: 'Deploy v2: it writes both columns and still reads <code>name</code>. Mixed v1/v2 pods during the rollout are fine. (A trigger can do the dual write instead.)' },
        { ph: 2, pods: P('v2', 'v2', 'v2'), sch: [['UPDATE users SET full_name = name', 'add'], ['WHERE id BETWEEN :a AND :b AND full_name IS NULL;', 'add'], ['-- 10k rows per batch, commit each', 'ro']], lock: 'row locks, short transactions', t: '<b>Backfill</b> old rows in small batches, each its own transaction. One giant UPDATE would hold row locks for minutes, double the table size and lag the replicas.' },
        { ph: 3, pods: P('v3', 'v3', 'v3'), pods2: 'new', sch: [['users(id, name, full_name, email)', ''], ['v3 reads full_name, still writes both', 'ro']], lock: 'none', t: 'Deploy v3: it reads <code>full_name</code>. It keeps writing <code>name</code> too, so rolling back to v2 is still safe.' },
        { ph: 4, pods: P('v4', 'v4', 'v4'), pods2: 'new', sch: [['v4 stops writing name', 'ro'], ['ALTER TABLE users DROP COLUMN name;', 'del']], lock: 'ACCESS EXCLUSIVE for ~1 ms', t: '<b>Contract</b>: once no running version uses <code>name</code>, drop it (one release later). DROP COLUMN is metadata-only too. Four deploys, zero errors.' }] }
    },
    fk: {
      naive: { ph: ['migrate', 'done'], st: [
        { ph: 0, pods: P('v1', 'v1', 'v1'), sch: [['orders: 400M rows', '']], lock: 'none', t: 'Goal: add <code>orders.customer_id → customers(id)</code> on a 400M-row table.' },
        { ph: 0, pods: P('v1', 'v1', 'v1'), err: [1, 1, 1], sch: [['ALTER TABLE orders ADD CONSTRAINT orders_customer_fk', 'add'], ['  FOREIGN KEY (customer_id) REFERENCES customers(id);', 'add']], lock: 'SHARE ROW EXCLUSIVE on orders AND customers, during a full scan', e: 4000, t: 'Adding the FK scans all 400M rows to validate them, and holds <b>SHARE ROW EXCLUSIVE</b> on both tables the whole time. Every INSERT/UPDATE/DELETE on orders and customers blocks for ~20 minutes.' },
        { ph: 1, pods: P('v1', 'v1', 'v1'), sch: [['constraint valid', '']], lock: 'none', t: 'It completes eventually, after an outage for all writes.' }] },
      safe: { ph: ['NOT VALID', 'VALIDATE', 'done'], st: [
        { ph: 0, pods: P('v1', 'v1', 'v1'), sch: [['orders: 400M rows', '']], lock: 'none', t: 'Same goal, in two steps.' },
        { ph: 0, pods: P('v1', 'v1', 'v1'), sch: [["SET lock_timeout = '3s';", 'ro'], ['ALTER TABLE orders ADD CONSTRAINT orders_customer_fk', 'add'], ['  FOREIGN KEY (customer_id) REFERENCES customers(id) NOT VALID;', 'add']], lock: 'SHARE ROW EXCLUSIVE, milliseconds', t: '<code>NOT VALID</code>: the constraint is created and enforced for <b>new</b> rows immediately, but existing rows are not scanned. The lock lasts milliseconds.' },
        { ph: 1, pods: P('v1', 'v1', 'v1'), sch: [['ALTER TABLE orders VALIDATE CONSTRAINT orders_customer_fk;', 'add']], lock: 'SHARE UPDATE EXCLUSIVE on orders (reads + writes continue)', t: '<code>VALIDATE CONSTRAINT</code> scans the old rows under a weaker lock that allows reads and writes. Same trick for CHECK constraints, and for NOT NULL: add <code>CHECK (col IS NOT NULL) NOT VALID</code>, validate, then <code>SET NOT NULL</code> uses it (PG12+) and skips the scan.' },
        { ph: 2, pods: P('v1', 'v1', 'v1'), sch: [['constraint valid', '']], lock: 'none', t: 'Done, no blocked writes.' }] }
    },
    idx: {
      naive: { ph: ['migrate', 'done'], st: [
        { ph: 0, pods: P('v1', 'v1', 'v1'), sch: [['orders: 400M rows', '']], lock: 'none', t: 'Goal: index <code>orders(created_at)</code>.' },
        { ph: 0, pods: P('v1', 'v1', 'v1'), err: [1, 1, 1], sch: [['CREATE INDEX orders_created_idx ON orders (created_at);', 'add']], lock: 'SHARE on orders: reads OK, all writes block', e: 2500, t: 'Plain CREATE INDEX takes a <b>SHARE</b> lock for the whole build. SELECTs work, but every INSERT/UPDATE/DELETE on orders waits for 15 minutes.' },
        { ph: 1, pods: P('v1', 'v1', 'v1'), sch: [['index ready', '']], lock: 'none', t: 'Done, after a write outage.' }] },
      safe: { ph: ['CONCURRENTLY', 'check', 'done'], st: [
        { ph: 0, pods: P('v1', 'v1', 'v1'), sch: [['orders: 400M rows', '']], lock: 'none', t: 'Same goal.' },
        { ph: 0, pods: P('v1', 'v1', 'v1'), sch: [['CREATE INDEX CONCURRENTLY orders_created_idx', 'add'], ['  ON orders (created_at);', 'add'], ['-- cannot run inside a transaction block', 'ro']], lock: 'SHARE UPDATE EXCLUSIVE: reads + writes continue', t: '<code>CONCURRENTLY</code> builds the index in two table scans and waits for older transactions between phases. Slower, but writes never block. Flyway: mark the migration non-transactional.' },
        { ph: 1, pods: P('v1', 'v1', 'v1'), sch: [["SELECT indisvalid FROM pg_index WHERE indexrelid = 'orders_created_idx'::regclass;", 'ro']], lock: 'none', t: 'If it fails (deadlock, unique violation, cancel) it leaves an <b>INVALID</b> index that still slows down writes. Check <code>indisvalid</code>; on failure DROP INDEX CONCURRENTLY and retry.' },
        { ph: 2, pods: P('v1', 'v1', 'v1'), sch: [['index ready', '']], lock: 'none', t: 'Done, no outage. Same idea for rebuilding: <code>REINDEX INDEX CONCURRENTLY</code> (PG12+).' }] }
    }
  };
  let errs;
  function render(s, sc) {
    phases.innerHTML = ''; sc.ph.forEach((p, i) => phases.append(el('span', { class: i === s.ph ? 'on' : i < s.ph ? 'done' : '', text: (i + 1) + '. ' + p })));
    pods.innerHTML = ''; s.pods.forEach((v, i) => pods.append(el('div', { class: 'w-pip-pod' + (s.err && s.err[i] ? ' err' : v !== 'v1' ? ' new' : ''), text: v + (s.err && s.err[i] ? ' ✗' : ' ✓') })));
    lock.innerHTML = `lock: <b>${s.lock}</b>`;
    sch.innerHTML = ''; s.sch.forEach(([txt, cls]) => sch.append(el('div', { class: cls, text: txt })));
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `failed requests <b>${errs.toLocaleString()}</b>` }), el('span', { class: 'w-stat', html: `running app versions <b>${[...new Set(s.pods)].join(' + ')}</b>` }));
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; errs = 0; const sc = SC[change][way]; steps = sc.st; k = 0; bStep.disabled = false; render(steps[0], sc); say(steps[0].t); k = 1; }
  function step() { if (k >= steps.length) return false; const s = steps[k++]; errs += s.e || 0; render(s, SC[change][way]); say(s.t); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => { if (running) { running = false; bPlay.textContent = '▶ Play'; return; } if (k >= steps.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen; while (running && g === gen && step()) await sleep(reduced ? 700 : speed); if (g === gen) { running = false; bPlay.textContent = '▶ Play'; } });
  reset();
});
