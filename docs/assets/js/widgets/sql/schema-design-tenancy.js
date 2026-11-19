/* Multi-tenancy comparison: shared table + tenant_id + RLS vs schema-per-tenant vs database-per-tenant. */
IA.widget('schema-design-tenancy', (root, ctx) => {
  const { el } = ctx;
  let n = 'k'; let iso = 'normal'; let noisy = 'no';
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); draw(); }); s.append(b); }); return s; };
  const OPTS = ['Shared tables + tenant_id + RLS', 'Schema per tenant', 'Database per tenant'];
  const ROWS = [
    ['Tenants it handles well', ['100k+', '~hundreds to low thousands (catalog bloat, migrations)', 'tens to hundreds']],
    ['Isolation', ['logical: one missing WHERE (or RLS bug) leaks data', 'namespace: search_path mistakes leak', 'physical: separate DB, can be a separate server']],
    ['Migrations', ['one ALTER', 'N ALTERs; partial failure = drift', 'N ALTERs across N DBs']],
    ['Connection pooling', ['one pool', 'one pool, but SET search_path per request (pooler caveats)', 'a pool per DB: connections × tenants']],
    ['Noisy neighbour', ['shares everything; partition or shard big tenants', 'shares the instance', 'can move a tenant to its own hardware']],
    ['Per-tenant backup / restore / delete', ['DELETE … WHERE tenant_id (slow), or partition and DROP', 'DROP SCHEMA, pg_dump -n', 'DROP DATABASE, pg_dump']],
    ['Cross-tenant analytics', ['trivial', 'UNION over schemas', 'needs ETL']]
  ];
  const out = el('div');
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'tenants' }), seg([['few', '≤ 50'], ['k', '~1,000'], ['many', '100k+']], () => n, (v) => { n = v; }, 'Tenant count')),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'isolation' }), seg([['normal', 'standard SaaS'], ['strict', 'contractual / regulated']], () => iso, (v) => { iso = v; }, 'Isolation')),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'a few huge tenants?' }), seg([['no', 'no'], ['yes', 'yes']], () => noisy, (v) => { noisy = v; }, 'Noisy tenants')), out);
  function pick() {
    if (n === 'many') return { i: 0, why: 'At 100k tenants only shared tables scale: one schema, one migration, one pool. Use RLS as the safety net, and put tenant_id first in every index and PK.' + (noisy === 'yes' ? ' Move the whales out with list partitioning or Citus-style sharding on tenant_id.' : '') };
    if (iso === 'strict') return { i: 2, why: 'Contractual isolation (per-tenant encryption keys, data residency, “delete everything of customer X”) is easiest with a database, or even a cluster, per tenant. Budget for automation: provisioning, migrations and monitoring times N.' };
    if (noisy === 'yes' && n === 'few') return { i: 2, why: 'Few tenants with very different sizes: a database each lets you place big tenants on their own hardware.' };
    return { i: 0, why: 'The default for most SaaS: shared tables with <code>tenant_id</code> + RLS. Schema-per-tenant looks tidy, but thousands of schemas mean millions of catalog rows, slow pg_dump, and migrations that drift.' + (noisy === 'yes' ? ' For a few big tenants, partition by tenant_id or split them off later.' : '') };
  }
  function draw() {
    const p = pick();
    const th = (t, i) => el('th', { text: t, style: i === p.i ? { color: 'var(--accent)', background: 'var(--accent-soft)' } : null });
    out.innerHTML = '';
    out.append(el('div', { class: 'caption' }, el('div', { class: 't', html: `<b>Suggested: ${OPTS[p.i]}.</b> ${p.why}` })),
      el('div', { class: 'tscroll', style: { marginTop: '10px' } }, el('table', { class: 't' },
        el('thead', null, el('tr', null, el('th', { text: '' }), OPTS.map(th))),
        el('tbody', null, ROWS.map(([k2, v]) => el('tr', null, el('td', { text: k2 }), v.map((c, i) => el('td', { text: c, style: i === p.i ? { background: 'var(--accent-soft)' } : null }))))))));
  }
  draw();
});
