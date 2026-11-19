/* Connection math: pods × Hikari pool vs max_connections, with and without PgBouncer (transaction mode) and its caveats. */
IA.widget('postgres-in-production-pool', (root, ctx) => {
  const { el } = ctx;
  let pods = 12; let pool = 20; let cores = 8; let bouncer = 'none';
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); draw(); }); s.append(b); }); return s; };
  const out = el('div');
  root.append(
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'app pods' }), seg([[3, '3'], [12, '12'], [40, '40 (autoscaled)']], () => pods, (v) => { pods = v; }, 'Pods')),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'Hikari maximumPoolSize' }), seg([[10, '10 (default)'], [20, '20'], [50, '50']], () => pool, (v) => { pool = v; }, 'Pool size')),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'DB vCPUs' }), seg([[4, '4'], [8, '8'], [16, '16']], () => cores, (v) => { cores = v; }, 'Cores')),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'between app and DB' }), seg([['none', 'direct'], ['tx', 'PgBouncer, transaction mode']], () => bouncer, (v) => { bouncer = v; }, 'Pooler')), out);
  function draw() {
    const client = pods * pool; const maxConn = 200; const ideal = cores * 2 + 1; const bServer = Math.max(ideal * 2, 20);
    const server = bouncer === 'tx' ? bServer : client; const over = server > maxConn;
    const bar = (label, v, max, color) => el('div', { style: { margin: '6px 0' } }, el('div', { class: 'tiny', html: `${label}: <b>${v}</b>` }),
      el('div', { style: { height: '12px', borderRadius: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' } },
        el('div', { style: { width: Math.min(100, (v / max) * 100) + '%', height: '100%', background: color } })));
    out.innerHTML = '';
    out.append(bar('app-side connections (pods × pool)', client, 2000, 'var(--accent)'),
      bar('Postgres backends' + (bouncer === 'tx' ? ' (PgBouncer default_pool_size)' : ''), server, maxConn, over ? 'var(--err)' : server > ideal * 4 ? 'var(--warn)' : 'var(--ok)'),
      el('div', { class: 'w-stats' }, el('span', { class: 'w-stat', html: `max_connections <b>${maxConn}</b>` }), el('span', { class: 'w-stat', html: `rule of thumb ≈ cores × 2 + 1 = <b>${ideal}</b> busy backends` })),
      el('div', { class: 'caption' }, el('div', { class: 't', html: over
        ? `<b>${client} connections won’t fit.</b> New pods fail with <code>FATAL: sorry, too many clients already</code>. And even below the limit, hundreds of backends competing for ${cores} cores make every query slower (context switches, lock contention, memory per backend).`
        : bouncer === 'tx' ? `PgBouncer multiplexes ${client} client connections onto ~${server} server connections, assigning one only <b>for the duration of a transaction</b>. That breaks anything that relies on session state (list below).`
        : `${client} backends is OK for max_connections, but more than ${ideal * 4} active ones on ${cores} cores usually <b>lowers</b> throughput. Smaller pools + a queue in the app beat big pools.` })));
    if (bouncer === 'tx') out.append(el('div', { class: 'tscroll', style: { marginTop: '8px' } }, el('table', { class: 't' }, el('thead', null, el('tr', null, ['Breaks in transaction mode', 'What to do'].map((h) => el('th', { text: h })))),
      el('tbody', null, [
        ['Server-side prepared statements (pgJDBC switches to them after prepareThreshold = 5 executions)', 'PgBouncer 1.21+ with max_prepared_statements > 0 tracks protocol-level prepares; otherwise set prepareThreshold=0'],
        ['SET / SET search_path / SET ROLE that outlive the transaction', 'Use SET LOCAL or set_config(…, true) inside the transaction'],
        ['Session advisory locks (pg_advisory_lock)', 'pg_advisory_xact_lock'],
        ['LISTEN / NOTIFY, WITH HOLD cursors, temp tables across transactions', 'A separate direct (session) connection for these'],
        ['Long transactions', 'They pin a server connection, so pool exhaustion moves to PgBouncer']
      ].map((r) => el('tr', null, r.map((c) => el('td', { text: c }))))))));
  }
  draw();
});
