IA.register({
  track: 'spring',
  slug: 'spring-data',
  title: 'Spring Data repositories',
  tagline: 'A repository interface is a <b>query generator</b>: method names become JPQL, return types decide <b>projections</b> and <b>paging</b>, and annotations add auditing. It is a great deal until a <code>Page</code> runs a <code>count(*)</code> over a million rows, <code>save()</code> SELECTs before every INSERT, or <code>deleteBy…</code> deletes one row at a time.',
  tldr: {
    problem: 'Slow list endpoints from OFFSET paging and count queries, full entities loaded where three columns would do, auditing columns that bulk updates skip, and surprise SELECTs from <code>save()</code> on entities with assigned ids.',
    model: 'At startup Spring Data parses each method into a query (derived, <code>@Query</code>, or a custom fragment) and fails fast on bad property names. At runtime the return type shapes the SQL: <code>Page</code> = data + count, <code>Slice</code> = <code>LIMIT n+1</code>, <code>Window</code> = keyset, an interface projection = only those columns.',
    hook: '“Page or Slice?” <code>Page</code> answers “how many pages?” with an extra <code>count</code> query. Infinite scroll doesn’t need it, and keyset scrolling (<code>Window</code>, Spring Data 3.1+) doesn’t get slower on page 5,000.',
    facts: [
      { v: '2 queries', l: 'per <code>Page&lt;T&gt;</code> request (unless the first page is short): the data query and a <code>count</code>. <code>Slice&lt;T&gt;</code> fetches <code>size + 1</code> rows instead' },
      { v: '3.1', l: 'Spring Data version (Boot 3.1) that added scrolling with <code>ScrollPosition</code> and <code>Window&lt;T&gt;</code>, including keyset-based positions' },
      { v: 'SELECT + INSERT', l: 'what <code>save()</code> sends for a new entity with an assigned id and no <code>@Version</code>: it isn’t recognised as new, so it is <code>merge</code>d' }
    ]
  },
  intro: {
    what: 'Instead of writing SQL for every lookup, you declare a Java interface that extends <code>JpaRepository</code>. Spring Data generates the implementation at startup. A method called <code>findByEmail(String email)</code> becomes a query that filters by the <code>email</code> property. You get saving, deleting, paging and sorting for free, and you can still write your own queries when you need to.',
    analogy: { icon: '🗂️', title: 'A filing clerk who reads labels', text: 'You don’t explain to the clerk how to search the cabinets. You hand over a request slip with a structured label, “find by last name, ordered by date, first 10”, and the clerk knows the procedure. When the label is ambiguous or the request is unusual, you write instructions by hand (<code>@Query</code>) or hire a specialist (a custom fragment).' },
    steps: [
      { t: 'Declare an interface', d: 'Pick the entity type and its id type.', code: 'public interface CustomerRepository extends JpaRepository<Customer, Long> {\n  Optional<Customer> findByEmail(String email);\n}' },
      { t: 'Let names become queries', d: 'Keywords like <code>And</code>, <code>Between</code>, <code>IgnoreCase</code>, <code>OrderBy</code> and <code>Top10</code> are parsed into a query. A typo fails at startup, not at runtime.' },
      { t: 'Return only what you need', d: 'A projection interface with a few getters makes the query select only those columns.', code: 'interface CustomerSummary { String getName(); String getEmail(); }\nList<CustomerSummary> findByCity(String city);' },
      { t: 'Page through results', d: 'Pass a <code>Pageable</code> and get a <code>Page</code> (with a total count) or a <code>Slice</code> (just “is there more?”).' }
    ],
    terms: [
      ['repository', 'An interface whose implementation Spring Data generates at startup.'],
      ['derived query', 'A query built from the method name, e.g. <code>findByLastnameOrderByCreatedAtDesc</code>.'],
      ['projection', 'A narrower result type (interface or record) instead of the full entity.'],
      ['Pageable / Page / Slice', 'Page request (number, size, sort); a page with total count; a page with only <code>hasNext</code>.'],
      ['auditing', 'Automatically filled <code>@CreatedDate</code>, <code>@LastModifiedBy</code>… fields.'],
      ['fragment', 'A custom interface + <code>Impl</code> class whose methods are mixed into the repository.']
    ]
  },
  visual: {
    title: 'Page vs Slice vs keyset: what Postgres reads to show 20 rows',
    caption: 'One million orders, an index on <code>(created_at, id)</code>, 20 rows per page. Pick a strategy and press Play to walk pages 1, 2, 3 and then jump to page 5,000. Bars show roughly how many index entries Postgres reads per request.'
  },
  extras: [
    { id: 'spring-data-derived', title: 'Decode a derived query method', label: 'Derived queries', caption: 'Pick a method name. Watch it split into subject, predicates and modifiers, and see the SQL Hibernate sends to Postgres.' }
  ],
  gotchas: [
    { trap: 'save() SELECTs before every INSERT (assigned ids)',
      code: `@Entity class Product { @Id UUID id = UUID.randomUUID(); … }   // id set before save\n\nrepo.save(new Product("Lamp"));\n// select … from product where id = ?    ← merge() checks whether it exists\n// insert into product …`,
      why: '<code>SimpleJpaRepository.save</code> calls <code>persist</code> only when <code>isNew()</code> is true. By default “new” means a null id (or a null <code>@Version</code>). An assigned id looks existing, so Spring Data calls <code>merge</code>, and Hibernate loads the row first.',
      fix: 'Add a <code>@Version</code> field (null = new), implement <code>Persistable&lt;ID&gt;</code> with your own <code>isNew()</code>, or let Postgres generate ids.' },
    { trap: 'Derived deleteBy… deletes one row at a time',
      code: `long deleteByCreatedAtBefore(Instant cutoff);   // SELECT all matches, then one DELETE per entity`,
      why: 'Derived deletes load the matching entities and call <code>remove</code> on each, so that cascades and lifecycle callbacks run. For 200k rows that is 200k DELETE statements and a huge persistence context.',
      fix: 'For bulk work use <code>@Modifying @Query("delete from Event e where e.createdAt &lt; :cutoff")</code>, or a native batched delete. Remember that it bypasses callbacks and the persistence context.' },
    { trap: 'Bulk @Modifying queries skip auditing and leave stale entities',
      why: 'A JPQL <code>update</code>/<code>delete</code> goes straight to the database: <code>@LastModifiedDate</code>, <code>@Version</code> increments and entity listeners don’t run, and entities already loaded in the session keep their old values.',
      fix: 'Set <code>updated_at = CURRENT_TIMESTAMP</code> and <code>version = version + 1</code> in the query yourself; use <code>@Modifying(clearAutomatically = true, flushAutomatically = true)</code>; run it in a <code>@Transactional</code> method (otherwise <code>TransactionRequiredException</code>).' },
    { trap: 'Page on a big table: the count query',
      why: '<code>Page</code> needs a total, so Spring Data derives <code>select count(…)</code> with the same filters. On a large table with a broad filter, the count is often slower than the page itself, on every request.',
      fix: 'Use <code>Slice</code> (or <code>Window</code>) for infinite scroll and “next” buttons. If you need a total, cache it, show an estimate, or supply a cheaper <code>countQuery</code>.' },
    { trap: 'Deep OFFSET pages',
      why: '<code>OFFSET 100000 LIMIT 20</code> makes Postgres produce and discard 100,000 rows before returning 20. Latency grows linearly with the page number, and rows inserted meanwhile shift pages (duplicates or gaps).',
      fix: 'Keyset scrolling: <code>Window&lt;Order&gt; findFirst20ByOrderByCreatedAtDescIdDesc(ScrollPosition p)</code> with <code>ScrollPosition.keyset()</code>, which becomes <code>WHERE (created_at, id) &lt; (?, ?)</code>. Sort on a unique tiebreaker.' },
    { trap: 'Open projections load the whole entity',
      code: `interface CustomerView {\n  @Value("#{target.firstName + ' ' + target.lastName}")   // open projection\n  String getFullName();\n}`,
      why: 'Spring Data can only narrow the SELECT for <b>closed</b> projections (plain getters matching properties). SpEL in <code>@Value</code> needs the target entity, so the full entity is loaded.',
      fix: 'Use closed interface projections or records (constructor projections), and compute derived values in a <code>default</code> method on the interface.' },
    { trap: '@Query with join fetch and Pageable',
      code: `@Query("select o from Order o join fetch o.customer where o.status = :s")\nPage<Order> byStatus(Status s, Pageable p);     // count query derivation breaks`,
      why: 'Spring Data derives the count query from your JPQL. With <code>join fetch</code> the derived <code>count</code> is invalid (“query specified join fetching, but the owner of the fetched association was not present”).',
      fix: 'Provide <code>countQuery = "select count(o) from Order o where o.status = :s"</code>, or use an <code>@EntityGraph</code> instead of <code>join fetch</code>.' }
  ],
  scenarios: [
    { title: 'Order list p99 at 4 s; the slow statement is a count',
      symptom: 'An admin list endpoint got slower every month. The page query itself was fast; the request wasn’t.',
      diagnose: `EXPLAIN (ANALYZE, BUFFERS)
select count(o1_0.id) from orders o1_0 where o1_0.tenant_id = $1;
-- Aggregate  (actual time=3911..3911 rows=1)
--   ->  Index Only Scan using orders_tenant_idx  (rows=4180233)  Heap Fetches: 912044`,
      diagnoseLang: 'sql',
      cause: 'The endpoint returned <code>Page&lt;OrderRow&gt;</code>, so every request also counted 4M rows for the big tenant. Heap fetches were high because the visibility map was stale (heavy updates).',
      fix: 'Switch the API to <code>Slice</code> with a “next” cursor; show “4M+” from a cached or estimated count where the UI needs one.',
      fixCode: `Slice<OrderRow> findByTenantId(long tenantId, Pageable page);   // LIMIT size+1, no count

// or keyset
Window<OrderRow> findFirst50ByTenantIdOrderByCreatedAtDescIdDesc(long tenantId, ScrollPosition pos);` },
    { title: 'Nightly cleanup takes 3 hours and bloats the table',
      symptom: 'A retention job calling <code>eventRepo.deleteByCreatedAtBefore(cutoff)</code> runs for hours, the JVM heap climbs, and autovacuum lags behind.',
      diagnose: `-- pg_stat_statements: one statement, called 1.8M times a night
delete from event where id = $1 and version = $2`,
      diagnoseLang: 'sql',
      cause: 'The derived delete loaded 1.8M entities into one persistence context and removed them one by one: one DELETE round trip each, plus dirty-checking overhead.',
      fix: 'Delete in bounded batches with a bulk statement, committing between batches so vacuum can keep up.',
      fixCode: `@Modifying
@Query(value = """
  DELETE FROM event WHERE id IN (
    SELECT id FROM event WHERE created_at < :cutoff ORDER BY id LIMIT 10000)""", nativeQuery = true)
int deleteBatch(Instant cutoff);

// caller: loop in separate transactions until it returns 0
while (tx.execute(s -> repo.deleteBatch(cutoff)) > 0) { }` },
    { title: 'updated_at is wrong for 30% of rows',
      symptom: 'Sync clients rely on <code>updated_at</code> to fetch changes, and they miss updates to order status.',
      diagnose: `@Modifying\n@Query("update Order o set o.status = :s where o.id in :ids")\nint markShipped(Status s, List<Long> ids);       // no updated_at, no version bump`,
      cause: 'Auditing (<code>@LastModifiedDate</code>) runs in a JPA entity listener on persist and update of managed entities. The bulk JPQL update never touched an entity, so the timestamp stayed old.',
      fix: 'Set audit columns in bulk statements explicitly, or enforce them in the database with a trigger for every writer.',
      fixCode: `@Modifying(clearAutomatically = true)\n@Query("""\n  update Order o set o.status = :s, o.updatedAt = CURRENT_TIMESTAMP, o.version = o.version + 1\n  where o.id in :ids""")\nint markShipped(Status s, List<Long> ids);` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Page 3 (size 20) of a table with 10,000 matching rows. How many SQL statements does this method run?', code: `Page<Order> findByStatus(Status status, Pageable pageable);\n\nrepo.findByStatus(PAID, PageRequest.of(2, 20, Sort.by("createdAt").descending()));`, options: ['1', '2', '3', '21'], answer: 1, explain: 'A <code>Page</code> needs the total, so Spring Data runs the data query (<code>… order by created_at desc offset 40 rows fetch first 20 rows only</code>) <b>and</b> a <code>count</code> query. It skips the count only when it can compute the total, for example a short first page.' },
    { kind: 'predict', q: 'And with <code>Slice&lt;Order&gt;</code> instead? What does the data query ask for?', options: ['LIMIT 20 plus a count', 'LIMIT 21, no count', 'LIMIT 20, no count, hasNext always true', 'Two queries of 20'], answer: 1, explain: '<code>Slice</code> asks for one extra row (<code>size + 1</code>). If 21 rows come back, <code>hasNext()</code> is true, and only 20 are returned. No count.' },
    { kind: 'predict', q: 'What does Postgres receive?', code: `@Entity class Tag { @Id String code; String label; }   // no @Version, id assigned\n\ntagRepo.save(new Tag("JAVA", "Java"));   // the row doesn't exist yet`, options: ['INSERT only', 'SELECT then INSERT', 'INSERT … ON CONFLICT', 'UPDATE, then INSERT when 0 rows'], answer: 1, explain: 'A non-null id with no version field makes <code>isNew()</code> false, so <code>save</code> calls <code>merge</code>. Hibernate SELECTs by id to find out whether to INSERT or UPDATE, then INSERTs at flush.' },
    { kind: 'predict', q: 'What happens when the application starts?', code: `interface CustomerRepository extends JpaRepository<Customer, Long> {\n  List<Customer> findByEmialAddress(String email);   // typo; entity has emailAddress\n}`, options: ['Starts; the call returns an empty list', 'Starts; the call throws at runtime', 'Startup fails: no property “emialAddress” found for type Customer', 'Spring guesses the closest property'], answer: 2, explain: 'Derived queries are parsed when the repository is created. An unknown property throws a <code>PropertyReferenceException</code> (often with a “Did you mean…” hint), and the context fails to start.' },
    { kind: 'predict', q: 'Which columns does Hibernate select?', code: `interface NameOnly { String getName(); }\nList<NameOnly> findByCity(String city);`, options: ['All columns of customer', 'Only name', 'id and name', 'name and city'], answer: 1, explain: 'A <b>closed</b> interface projection lets Spring Data build a query that selects only the projected properties: <code>select c.name from customer c where c.city = ?</code>. No entity is managed.' },
    { kind: 'predict', q: 'Called outside any transaction. What happens?', code: `@Modifying\n@Query("update Order o set o.status = 'ARCHIVED' where o.createdAt < :cutoff")\nint archive(Instant cutoff);`, options: ['Runs in auto-commit', 'TransactionRequiredException: Executing an update/delete query', 'Silently does nothing', 'Runs, but auditing fills updated_at'], answer: 1, explain: 'Your declared query methods don’t get a writing transaction from <code>SimpleJpaRepository</code>, and JPA requires an active transaction for update/delete queries. Annotate the method or its caller with <code>@Transactional</code>.' },
    { kind: 'concept', q: 'Why is keyset scrolling faster than OFFSET on page 5,000?', options: ['It caches previous pages', 'It filters with WHERE (created_at, id) &lt; (last values), so the index range scan starts at the right place and reads only ~size rows', 'It uses parallel workers', 'It skips sorting'], answer: 1, explain: 'OFFSET must walk and discard all earlier rows. A keyset predicate on the sort key, backed by a matching index, jumps straight to the position, so the cost is the same on every page. It can’t jump to an arbitrary page number, which is the trade-off.' }
  ],
  interview: [
    { q: 'How does Spring Data turn a method name into a query?', a: '<p>At startup <code>PartTree</code> parses the name into a subject (<code>find…By</code>, <code>count…By</code>, <code>exists…By</code>, <code>delete…By</code>, with <code>Distinct</code>, <code>First10</code>/<code>Top10</code>) and a predicate: property paths joined by <code>And</code>/<code>Or</code>, each with an operator (<code>Between</code>, <code>LessThan</code>, <code>Like</code>, <code>In</code>, <code>IsNull</code>, <code>IgnoreCase</code>…), plus <code>OrderBy…</code>. Property paths are validated against the entity, so typos fail fast. The JPA module builds a Criteria query; parameters bind by position.</p>', fu: 'When do you stop using derived names? (When the name stops being readable: use @Query or a fragment.)', lvl: 'core' },
    { q: 'Interface projections vs DTO projections vs dynamic projections?', a: '<ul><li><b>Closed interface projection</b>: getters matching properties; Spring Data selects only those columns and returns proxies.</li><li><b>Open projection</b>: <code>@Value</code> SpEL; loads the entity.</li><li><b>Class/record (DTO) projection</b>: constructor parameters matching properties, or a JPQL constructor expression in <code>@Query</code>.</li><li><b>Dynamic</b>: <code>&lt;T&gt; List&lt;T&gt; findByCity(String city, Class&lt;T&gt; type)</code>, chosen per call.</li></ul><p>All avoid dirty checking and lazy-loading surprises.</p>', lvl: 'core' },
    { q: 'Page vs Slice vs Window (scrolling)?', a: '<p><code>Page</code>: content + total elements/pages, costing a count query. <code>Slice</code>: content + <code>hasNext</code>, via <code>LIMIT size+1</code>. <code>Window</code> (3.1+): results plus a <code>ScrollPosition</code> to continue from: offset-based or <b>keyset-based</b>, which turns into a <code>WHERE</code> on the sort keys and stays fast at any depth. Pick by UI: numbered pages need a total; feeds and exports don’t.</p>', lvl: 'core' },
    { q: 'How does save() decide between persist and merge, and why does it matter?', a: '<p><code>JpaEntityInformation.isNew</code>: if the entity implements <code>Persistable</code>, its <code>isNew()</code>; else a null <code>@Version</code> means new; else a null (or zero, for primitives) id means new. New → <code>persist</code>; otherwise <code>merge</code>, which SELECTs first if the entity isn’t managed, and returns a <b>different instance</b>. Use the return value of <code>save</code>.</p>', lvl: 'deep' },
    { q: 'How do you set up auditing?', a: '<p><code>@EnableJpaAuditing</code> on a configuration class, <code>@EntityListeners(AuditingEntityListener.class)</code> on entities (or a mapped superclass), fields annotated <code>@CreatedDate</code>, <code>@LastModifiedDate</code>, <code>@CreatedBy</code>, <code>@LastModifiedBy</code>, and an <code>AuditorAware&lt;T&gt;</code> bean reading the current user from the <code>SecurityContext</code>. It only applies to managed entities going through persist/merge and flush, not to bulk or native statements.</p>', lvl: 'core' },
    { q: 'How do you add a custom method to a repository?', a: '<p>A fragment: declare <code>interface OrderSearch { List&lt;Order&gt; search(Filter f); }</code>, implement it in <code>OrderSearchImpl</code> (the <code>Impl</code> suffix is how Spring Data finds it), and let <code>OrderRepository extends JpaRepository&lt;Order, Long&gt;, OrderSearch</code>. The implementation is a normal bean: inject <code>EntityManager</code>, <code>JdbcTemplate</code> or <code>JdbcClient</code>. For dynamic filters also consider <code>JpaSpecificationExecutor</code> or Querydsl.</p>', lvl: 'core' },
    { q: 'Are repository methods transactional?', a: '<p><code>SimpleJpaRepository</code> is <code>@Transactional(readOnly = true)</code> at class level, with writing methods (<code>save</code>, <code>delete…</code>) overriding it. Those apply to inherited CRUD methods. Each repository call without a surrounding service transaction is its own transaction, so two calls = two transactions and two connection checkouts. Put <code>@Transactional</code> on the service for a unit of work, and on <code>@Modifying</code> queries.</p>', lvl: 'deep' },
    { q: 'How do you stream a large result set from Postgres with Spring Data?', a: '<p>Return <code>Stream&lt;T&gt;</code> inside a transaction, close it (try-with-resources), and set a fetch size hint (<code>@QueryHints(@QueryHint(name = HINT_FETCH_SIZE, value = "500"))</code>). pgjdbc only streams with a server-side cursor when auto-commit is off <b>and</b> a fetch size is set; otherwise it loads every row into memory. Detach or clear processed entities, or stream projections.</p>', lvl: 'deep' },
    { q: 'What happens to sorting input from the client?', a: '<p>For derived queries and JPQL, <code>Sort</code> properties are resolved against the domain model; unknown properties fail with <code>PropertyReferenceException</code>, which you should map to 400. Don’t pass raw strings into native queries. Cap page sizes (<code>spring.data.web.pageable.max-page-size</code>, default 2000) so a client can’t ask for a million rows.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'A repository that scales', lang: 'java', code: `public interface OrderRepository extends JpaRepository<Order, Long>, OrderSearch {

  // derived + closed projection: selects id, total, createdAt only
  Slice<OrderRow> findByCustomerIdOrderByCreatedAtDesc(long customerId, Pageable page);

  // keyset scrolling (Spring Data 3.1+)
  Window<OrderRow> findFirst50ByStatusOrderByCreatedAtDescIdDesc(Status status, ScrollPosition pos);

  // explicit count query when the data query uses joins
  @Query(value = "select o from Order o join o.customer c where c.country = :country",
         countQuery = "select count(o) from Order o join o.customer c where c.country = :country")
  Page<Order> byCountry(String country, Pageable page);

  @Transactional
  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("update Order o set o.status = :s, o.updatedAt = CURRENT_TIMESTAMP where o.id in :ids")
  int setStatus(Status s, Collection<Long> ids);
}

public interface OrderRow { Long getId(); BigDecimal getTotal(); Instant getCreatedAt(); }

// scrolling through all PAID orders
Window<OrderRow> w = repo.findFirst50ByStatusOrderByCreatedAtDescIdDesc(PAID, ScrollPosition.keyset());
while (!w.isEmpty()) {
  w.forEach(this::export);
  if (!w.hasNext()) break;
  w = repo.findFirst50ByStatusOrderByCreatedAtDescIdDesc(PAID, w.positionAt(w.size() - 1));
}` },
    { title: 'Custom fragment', lang: 'java', code: `public interface OrderSearch {
  List<OrderHit> search(OrderFilter f, int limit);
}

public record OrderHit(long id, BigDecimal total, Instant createdAt) {}   // created_at → createdAt

class OrderSearchImpl implements OrderSearch {          // "Impl" suffix → picked up automatically
  private final JdbcClient jdbc;                         // Framework 6.1+
  OrderSearchImpl(JdbcClient jdbc) { this.jdbc = jdbc; }

  public List<OrderHit> search(OrderFilter f, int limit) {
    return jdbc.sql("""
        SELECT id, total, created_at FROM orders
        WHERE tenant_id = :tenant
          AND (CAST(:status AS text) IS NULL OR status = :status)
          AND to_tsvector('simple', note) @@ plainto_tsquery('simple', :q)
        ORDER BY created_at DESC LIMIT :limit""")
      .param("tenant", f.tenantId()).param("status", f.status()).param("q", f.text()).param("limit", limit)
      .query(OrderHit.class).list();
  }
}` },
    { title: 'Auditing & isNew', lang: 'java', code: `@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditor")
class AuditConfig {
  @Bean AuditorAware<String> auditor() {
    return () -> Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
        .map(Authentication::getName);
  }
}

@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class Audited {
  @CreatedDate @Column(updatable = false) Instant createdAt;
  @LastModifiedDate Instant updatedAt;
  @CreatedBy @Column(updatable = false) String createdBy;
  @LastModifiedBy String updatedBy;
  @Version Long version;               // null = new → persist (no SELECT before INSERT)
}` },
    { title: 'Postgres side of paging', lang: 'sql', code: `-- OFFSET: produces and discards 100,000 rows first
select … from orders o order by o.created_at desc, o.id desc offset 100000 rows fetch first 21 rows only;

-- keyset: starts at the right place in the index
select … from orders o
where (o.created_at, o.id) < ($1, $2)
order by o.created_at desc, o.id desc
fetch first 21 rows only;

CREATE INDEX CONCURRENTLY orders_created_id_idx ON orders (created_at DESC, id DESC);` }
  ]
});
