/* Derived query decoder: split a repository method name into subject, predicates and modifiers, then show the SQL Postgres receives. */
IA.widget('spring-data-derived', (root, ctx) => {
  const { el, sleep, reduced, codeBox } = ctx;
  // parts: [text, kind]; kinds: s = subject, p = property, o = operator/keyword, m = modifier
  const Q = [
    { sig: 'Optional<Customer> findByEmailIgnoreCase(String email)', parts: [['find', 's'], ['By', 's'], ['Email', 'p'], ['IgnoreCase', 'o']],
      sql: 'select c1_0.id, c1_0.email, c1_0.name\nfrom customer c1_0\nwhere upper(c1_0.email) = upper(?)',
      pg: 'A plain index on <code>email</code> can’t serve <code>upper(email)</code>. Add <code>CREATE INDEX ON customer (upper(email))</code>, or store emails normalised (or as <code>citext</code>).' },
    { sig: 'List<Order> findTop10ByStatusOrderByCreatedAtDesc(Status status)', parts: [['find', 's'], ['Top10', 'm'], ['By', 's'], ['Status', 'p'], ['OrderBy', 'o'], ['CreatedAt', 'p'], ['Desc', 'o']],
      sql: 'select o1_0.id, o1_0.status, o1_0.created_at, …\nfrom orders o1_0\nwhere o1_0.status = ?\norder by o1_0.created_at desc\nfetch first ? rows only',
      pg: 'An index on <code>(status, created_at DESC)</code> turns this into a short index scan that stops after 10 rows: no sort.' },
    { sig: 'long countByCustomerIdAndStatusIn(long customerId, Collection<Status> s)', parts: [['count', 's'], ['By', 's'], ['CustomerId', 'p'], ['And', 'o'], ['Status', 'p'], ['In', 'o']],
      sql: 'select count(o1_0.id)\nfrom orders o1_0\nwhere o1_0.customer_id = ?\n  and o1_0.status in (?, ?)',
      pg: '<code>CustomerId</code> is resolved as the path <code>customer.id</code>; Hibernate uses the foreign-key column directly, with no join. One bind parameter per collection element.' },
    { sig: 'boolean existsByEmail(String email)', parts: [['exists', 's'], ['By', 's'], ['Email', 'p']],
      sql: 'select c1_0.id\nfrom customer c1_0\nwhere c1_0.email = ?\nfetch first ? rows only',
      pg: 'Fetches at most one id, so it is cheap with an index. Still racy as a uniqueness check: rely on a unique constraint.' },
    { sig: 'List<Customer> findByNameContaining(String part)', parts: [['find', 's'], ['By', 's'], ['Name', 'p'], ['Containing', 'o']],
      sql: "select c1_0.id, c1_0.name, …\nfrom customer c1_0\nwhere c1_0.name like ? escape '\\'\n-- bound as '%' || part || '%'",
      pg: 'A leading wildcard can’t use a btree index, so this is a sequential scan. Use a <code>pg_trgm</code> GIN index, or full-text search, for “contains”.' },
    { sig: 'long deleteByCreatedAtBefore(Instant cutoff)', parts: [['delete', 's'], ['By', 's'], ['CreatedAt', 'p'], ['Before', 'o']],
      sql: 'select e1_0.id, … from event e1_0 where e1_0.created_at < ?\n-- then, for EACH loaded entity at flush:\ndelete from event where id = ?',
      pg: 'Derived deletes load every match and remove it one by one, so callbacks and cascades run. For bulk retention, use a <code>@Modifying</code> query in batches.' }
  ];
  const COL = { s: 'var(--accent)', p: 'var(--accent-2)', o: 'var(--warn)', m: 'var(--k-edge)' };
  const NAME = { s: 'subject', p: 'property', o: 'operator / keyword', m: 'modifier' };
  let cur = 0; let gen = 0;
  const pick = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Method' });
  Q.forEach((q, i) => { const nm = q.sig.match(/ (\w+)\(/)[1]; const b = el('button', { text: nm, class: i === cur ? 'on' : '' }); b.addEventListener('click', () => { cur = i; [...pick.children].forEach((x) => x.classList.toggle('on', x === b)); run(); }); pick.append(b); });
  const sigBox = el('div', { style: { fontFamily: 'var(--mono)', fontSize: '15px', padding: '12px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface-2)', overflowWrap: 'anywhere', margin: '6px 0 10px' } });
  const legend = el('div', { class: 'w-stats', style: { marginTop: '0' } }, Object.keys(NAME).map((k) => el('span', { class: 'w-stat', html: `<b style="color:${COL[k]}">■</b> ${NAME[k]}` })));
  const sqlHost = el('div', { style: { marginTop: '10px' } });
  const note = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.append(pick, sigBox, legend, sqlHost, note);
  async function run() {
    const g = ++gen; const q = Q[cur];
    const [pre, rest] = [q.sig.slice(0, q.sig.indexOf(q.parts.map((p) => p[0]).join(''))), q.sig.slice(q.sig.indexOf('('))];
    sigBox.innerHTML = ''; sigBox.append(el('span', { text: pre, style: { color: 'var(--text-3)' } }));
    sqlHost.innerHTML = ''; note.firstChild.innerHTML = 'Parsing…';
    for (const [t, kd] of q.parts) {
      sigBox.append(el('span', { text: t, title: NAME[kd], style: { color: COL[kd], fontWeight: '700', borderBottom: `2px solid ${COL[kd]}`, marginRight: '2px', animation: reduced ? 'none' : 'capin .3s ease both' } }));
      if (!reduced) { await sleep(320); if (g !== gen) return; }
    }
    sigBox.append(el('span', { text: rest, style: { color: 'var(--text-3)' } }));
    sqlHost.append(codeBox(q.sql, 'sql', 'Hibernate 6 → Postgres'));
    note.firstChild.innerHTML = q.pg;
  }
  run();
});
