IA.register({
  track: 'sql',
  slug: 'data-types-that-bite',
  title: 'Data types that bite',
  tagline: 'The wrong column type doesn’t fail on day one. It fails at month-end close (<code>float</code> money), at the first daylight-saving switch (<code>timestamp</code>), or when id 2,147,483,648 arrives (<code>serial</code>). Know the six that bite most.',
  tldr: {
    problem: 'Types are chosen once, in a migration nobody reviews, and then outlive three rewrites of the app. Changing them later means rewriting big tables under locks.',
    model: '<b>numeric</b> for money, <b>timestamptz</b> for moments, <b>text</b> (+ CHECK) for strings, <b>jsonb</b> for documents, <b>bigint identity</b> for keys. Avoid <code>money</code>, <code>timestamp</code> for events, and <code>serial</code>.',
    hook: '“Why does the report say the order was placed at 03:00?” Someone stored a moment in <code>timestamp without time zone</code>.',
    facts: [
      { v: '0.1 + 0.2 ≠ 0.3', l: 'in float8: Postgres 12+ prints <code>0.30000000000000004</code>. With numeric it is exactly 0.3' },
      { v: '8 bytes, no zone', l: 'what timestamptz stores: a UTC instant. The zone is applied only on input and output' },
      { v: '2.1 billion', l: 'the max of <code>int</code>/<code>serial</code> (2,147,483,647). Busy tables hit it; use <code>bigint</code>' }
    ]
  },
  intro: {
    what: 'Every column has a <b>data type</b> that decides what values it accepts and how they behave in math, sorting and comparisons. Some types look interchangeable but behave very differently: a <i>float</i> is approximate, a <i>numeric</i> is exact; a <i>timestamp</i> may or may not know its time zone.',
    analogy: { icon: '📏', title: 'Measuring cups', text: 'A kitchen scale (numeric) gives the exact grams. A cup measure (float) is quick but approximate: fine for flour, not for medicine. Picking the type is picking the measuring tool before you know what you’ll measure.' },
    steps: [
      { t: 'Money: numeric, never float', d: 'Floats can’t represent 0.1 exactly.', code: 'SELECT 0.1::float8 + 0.2::float8 AS f,\n       0.1::numeric + 0.2::numeric AS n;' },
      { t: 'Moments: timestamptz', d: 'It stores an absolute instant and shows it in your session’s zone.', code: "SELECT now()::timestamptz;   -- e.g. 2026-01-15 14:00:00+00" },
      { t: 'Strings: text', d: 'In Postgres <code>text</code> and <code>varchar(n)</code> perform the same; <code>n</code> is only a length check.' },
      { t: 'Ids: bigint identity', d: 'The standard way to auto-number rows (PG10+).', code: 'CREATE TABLE t (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY);' }
    ],
    terms: [
      ['numeric(p, s)', 'Exact decimal with p total digits, s after the point.'],
      ['float8 / double precision', 'Binary floating point: fast, approximate.'],
      ['timestamptz', 'Timestamp with time zone: an absolute moment, stored in UTC.'],
      ['timestamp', 'Without time zone: a wall-clock reading with no zone.'],
      ['identity column', 'A column filled from a sequence, SQL-standard replacement for serial.'],
      ['jsonb', 'Parsed binary JSON, indexable.']
    ]
  },
  visual: {
    title: 'One 09:00, two column types, two time zones',
    caption: 'Choose where the writer and reader sessions are, then press Play. timestamptz keeps the instant; timestamp keeps a clock reading and loses its meaning.'
  },
  extras: [
    { id: 'data-types-that-bite-float', title: 'numeric vs float: watch the drift', label: 'Float drift', caption: 'Add 0.1 many times. The exact decimal stays exact; the double accumulates rounding error.' }
  ],
  playground: {
    setup: `
CREATE TABLE prices (id int PRIMARY KEY, f float8, n numeric(12,2), m money);
INSERT INTO prices VALUES (1, 0.1, 0.1, 0.1), (2, 0.2, 0.2, 0.2);
CREATE TABLE events (id int PRIMARY KEY, at_tz timestamptz, at_local timestamp);
SET TimeZone = 'America/New_York';
INSERT INTO events VALUES (1, '2026-01-15 09:00', '2026-01-15 09:00');
SET TimeZone = 'UTC';
CREATE TABLE s_old (id serial PRIMARY KEY, v text);
CREATE TABLE s_new (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, v text);
CREATE TABLE docs (j json, jb jsonb);
INSERT INTO docs VALUES ('{"b":1, "a":2, "a":3}', '{"b":1, "a":2, "a":3}');`,
    presets: [
      { label: 'float vs numeric', sql: `SELECT sum(f) AS float_sum, sum(n) AS numeric_sum,\n       sum(f) = 0.3 AS float_eq, sum(n) = 0.3 AS numeric_eq\nFROM prices;`, note: 'float8 sum is 0.30000000000000004, so it is not equal to 0.3.' },
      { label: 'timestamptz shift', sql: `SET TimeZone = 'Asia/Kolkata';\nSELECT at_tz, at_local FROM events;\nSET TimeZone = 'UTC';\nSELECT at_tz, at_local FROM events;`, note: 'Written in New York at 09:00. timestamptz shows 19:30+05:30 in Kolkata and 14:00+00 in UTC; timestamp shows 09:00 everywhere.' },
      { label: 'AT TIME ZONE', sql: `SELECT at_tz AT TIME ZONE 'Europe/Berlin' AS berlin_wallclock,      -- → timestamp\n       at_local AT TIME ZONE 'America/New_York' AS as_instant          -- → timestamptz\nFROM events;`, note: '<code>AT TIME ZONE</code> converts between the two types. Direction matters.' },
      { label: 'varchar(n) vs text', sql: `CREATE TABLE v (a varchar(5), b text CHECK (length(b) <= 5));\nINSERT INTO v VALUES ('hello', 'hello');\nSELECT pg_column_size(a) AS a_bytes, pg_column_size(b) AS b_bytes FROM v;\nINSERT INTO v VALUES ('hello!', 'x');`, note: 'Same storage. Too-long input fails with “value too long for type character varying(5)”.' },
      { label: 'money', sql: `SELECT m, m * 3 AS triple, m / 3 AS third, sum(m) OVER () AS total\nFROM prices;`, note: 'Output format depends on lc_monetary; one currency per database; division truncates to the cent.' },
      { label: 'serial vs identity', sql: `INSERT INTO s_old (id, v) VALUES (1, 'manual');      -- allowed: sequence not advanced\nINSERT INTO s_old (v) VALUES ('auto');               -- duplicate key! seq gives 1\n`, note: 'serial lets you bypass the sequence and collide. Try the same on s_new: <code>GENERATED ALWAYS</code> rejects an explicit id unless you write <code>OVERRIDING SYSTEM VALUE</code>.' },
      { label: 'json vs jsonb', sql: `SELECT j, jb, j->>'a' AS json_a, jb->>'a' AS jsonb_a FROM docs;`, note: 'json keeps text, order and duplicates; jsonb normalizes, keeping the last duplicate key.' }
    ]
  },
  gotchas: [
    { trap: 'Money in float / double', code: `SELECT 0.1::float8 + 0.2::float8;   -- 0.30000000000000004`, why: 'Binary floating point can’t represent most decimal fractions. Sums drift, equality checks fail, and rounding at different layers disagrees by a cent.', fix: '<code>numeric(12,2)</code> (or integer cents as <code>bigint</code>) in Postgres, <code>BigDecimal</code> in Java. Use float only for measurements where approximation is fine.' },
    { trap: 'timestamp for moments in time', code: `created_at timestamp DEFAULT now()   -- now() converted to the SESSION zone, then the zone discarded`, why: 'The value depends on the TimeZone setting of whichever session wrote it. Servers, JDBC drivers and cron jobs disagree, and DST makes some local times ambiguous or nonexistent.', fix: 'Use <code>timestamptz</code> for events. Keep the user’s zone in a separate column if you need to show “their” local time.' },
    { trap: '“timestamptz stores the time zone”', why: 'It doesn’t. It stores a UTC instant; <code>+05:30</code> in the output is the reader’s session zone, not the writer’s.', fix: 'If you need the original zone or offset, store it in another column (<code>text</code> IANA name).' },
    { trap: 'varchar(n) as a performance optimization', why: 'In Postgres, <code>text</code>, <code>varchar</code> and <code>varchar(n)</code> have identical storage and speed. <code>char(n)</code> is slower and pads with spaces. The limit is a business rule, and changing it means a migration.', fix: 'Use <code>text</code>, with <code>CHECK (length(x) &lt;= n)</code> if you need a limit (easy to change, <code>NOT VALID</code>-able). Raising a varchar(n) limit (or going to text) doesn’t rewrite the table; lowering it does.' },
    { trap: 'The money type', why: 'Its output and parsing depend on <code>lc_monetary</code>, it holds one currency, has fixed fractional digits, and dumps can restore wrongly under a different locale.', fix: 'Use <code>numeric</code> plus a currency column (<code>char(3)</code> ISO code).' },
    { trap: 'serial: int overflow and sequence ownership surprises', code: `id serial   -- int4: dies at 2,147,483,647`, why: '<code>serial</code> is <code>int</code> by default, creates a separately owned sequence (grants and dumps can drift), and lets explicit inserts collide with the sequence later.', fix: '<code>bigint GENERATED ALWAYS AS IDENTITY</code> (PG10+). Both identity and sequences have gaps on rollback; never rely on contiguous ids.' },
    { trap: 'json instead of jsonb', why: '<code>json</code> re-parses text on every access, can’t be GIN-indexed, and has no equality operator (so no DISTINCT or GROUP BY on it).', fix: 'Use <code>jsonb</code> unless you must keep exact input text (signatures, audit of raw payloads).' }
  ],
  scenarios: [
    { title: 'Inserts start failing: “integer out of range” at 3 a.m.',
      symptom: 'Every insert into <code>events</code> fails with <code>nextval: reached maximum value of sequence</code> / integer out of range.',
      diagnose: `SELECT last_value, (SELECT max_value FROM pg_sequences WHERE sequencename = 'events_id_seq')\nFROM events_id_seq;`,
      cause: 'A <code>serial</code> (int4) primary key hit 2,147,483,647 after years of growth (and gaps from rollbacks and caching).',
      fix: 'Short term: none that’s pretty. Long term: migrate to bigint by adding a new column, backfilling in batches, then swapping, since <code>ALTER COLUMN TYPE bigint</code> rewrites the table under an ACCESS EXCLUSIVE lock. Monitor sequence usage.',
      fixCode: `SELECT schemaname, sequencename, last_value::numeric / max_value AS used\nFROM pg_sequences ORDER BY used DESC NULLS LAST LIMIT 10;` },
    { title: 'Orders show up on the wrong day in the EU report',
      symptom: 'Orders placed at 23:30 in Berlin appear under the next or previous day depending on who runs the report.',
      diagnose: `SELECT current_setting('TimeZone');\nSELECT data_type FROM information_schema.columns WHERE table_name='orders' AND column_name='created_at';`,
      cause: 'Column is <code>timestamp</code>; app servers in different zones wrote local wall-clock times, and <code>date_trunc(\'day\', …)</code> grouped them inconsistently.',
      fix: 'Convert to timestamptz, interpreting existing values in the zone they were written in, and group by day in an explicit zone.',
      fixCode: `ALTER TABLE orders ALTER COLUMN created_at TYPE timestamptz\n  USING created_at AT TIME ZONE 'UTC';   -- the zone the old values were written in\nSELECT date_trunc('day', created_at, 'Europe/Berlin'), count(*) FROM orders GROUP BY 1;  -- 3-arg date_trunc: PG12+` },
    { title: 'Ledger off by €0.01 after a currency conversion',
      symptom: 'Daily reconciliation finds sums that differ by a cent from the payment provider.',
      diagnose: `SELECT id, amount, amount::numeric(12,2) FROM ledger WHERE amount <> round(amount::numeric, 2);`,
      cause: 'Conversion rates and amounts stored as <code>double precision</code>; summing thousands of rounded doubles drifted.',
      fix: 'Store amounts as <code>numeric(12,2)</code> (rates as <code>numeric(18,8)</code>), round once at a defined point (banker’s or half-up, as finance specifies).' }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this return?', code: `SELECT 0.1::float8 + 0.2::float8 = 0.3::float8 AS f, 0.1 + 0.2 = 0.3 AS n;`, options: ['true, true', 'false, true', 'false, false', 'true, false'], answer: 1, explain: 'Untyped literals like <code>0.1</code> are numeric in Postgres, so the second is exact. The float8 sum is 0.30000000000000004.' },
    { kind: 'predict', q: 'Seeded in New York at 09:00. What hour does the reader see for <code>at_tz</code>?', code: `SET TimeZone = 'Asia/Kolkata';\nSELECT extract(hour FROM at_tz) AS h_tz, extract(hour FROM at_local) AS h_local FROM events;`, options: ['9 and 9', '19 and 9', '14 and 9', '19 and 19'], answer: 1, explain: '09:00 EST = 14:00 UTC = 19:30 IST. timestamp has no zone, so it stays 9.' },
    { kind: 'predict', q: 'What happens?', code: `INSERT INTO s_new (id, v) VALUES (10, 'x');`, options: ['inserted with id 10', 'inserted with id 1', 'ERROR: cannot insert a non-DEFAULT value into column "id"', 'ERROR: duplicate key'], answer: 2, explain: '<code>GENERATED ALWAYS</code> rejects explicit values unless you add <code>OVERRIDING SYSTEM VALUE</code>.' },
    { kind: 'predict', q: 'What does this return?', code: `SELECT '{"a":1,"a":2}'::json ->> 'a' AS j, '{"a":1,"a":2}'::jsonb ->> 'a' AS jb;`, options: ['1, 1', '2, 2', '1, 2', '2, 1'], answer: 1, explain: 'Both return the last duplicate: jsonb stores only the last key; json’s <code>-&gt;&gt;</code> also picks the last matching key when processing the text. The difference shows when you print the value itself.' },
    { kind: 'predict', q: 'What is stored?', code: `CREATE TABLE r (x numeric(6,2));\nINSERT INTO r VALUES (1.005), (2.675);\nSELECT x FROM r;`, options: ['1.00, 2.67', '1.01, 2.68', '1.00, 2.68', '1.005, 2.675'], answer: 1, explain: 'numeric rounds half away from zero, exactly: <b>1.01, 2.68</b>. With float8, 2.675 is really 2.67499999… and rounds down.' },
    { kind: 'predict', q: 'How many bytes does each stored value take?', code: `CREATE TABLE cs (v varchar(10), t text, c char(10));\nINSERT INTO cs VALUES ('hello', 'hello', 'hello');\nSELECT pg_column_size(v) AS v, pg_column_size(t) AS t, pg_column_size(c) AS c FROM cs;`, options: ['6, 6, 11', '10, 5, 10', '5, 5, 5', '9, 9, 14'], answer: 0, explain: '1-byte header + 5 bytes for varchar and text. char(10) pads to 10 characters: 11 bytes.' }
  ],
  interview: [
    { q: 'Why not use double precision for money?', a: '<p>IEEE 754 doubles are binary fractions; 0.1 is a repeating fraction in base 2, so values are stored approximately and errors accumulate across sums and conversions. Use <code>numeric</code> (exact, arbitrary precision, slower) or integer minor units in <code>bigint</code>.</p>', fu: 'When is numeric too slow? (Heavy analytics over billions of rows; then integer cents.)', lvl: 'core' },
    { q: 'What exactly does timestamptz store?', a: '<p>A 64-bit count of microseconds since 2000-01-01 UTC. On input, a value without an explicit offset is interpreted in the session TimeZone; on output it is converted to the session TimeZone. No zone is stored.</p>', lvl: 'core' },
    { q: 'When is timestamp without time zone correct?', a: '<p>For wall-clock values not tied to an instant: “store opens at 09:00 local”, a birthday-and-time in a calendar, a future appointment where the zone’s rules might change (store local time + IANA zone and compute the instant late).</p>', lvl: 'deep' },
    { q: 'How do JDBC and Java types map to these?', a: '<p>Use <code>OffsetDateTime</code>/<code>Instant</code> ↔ timestamptz, <code>LocalDateTime</code> ↔ timestamp. pgJDBC supports <code>setObject(i, OffsetDateTime)</code> and <code>getObject(i, OffsetDateTime.class)</code> (returned in UTC). Set <code>hibernate.jdbc.time_zone=UTC</code> to avoid JVM-default-zone conversions.</p>', lvl: 'deep' },
    { q: 'text vs varchar(n) vs char(n) in Postgres?', a: '<p>text and varchar are the same varlena type internally; varchar(n) adds a length check. char(n) pads with spaces, ignores trailing spaces in comparisons, and is usually slower. Prefer text + CHECK.</p>', lvl: 'core' },
    { q: 'serial vs identity?', a: '<p>serial is a macro: an int column + a sequence + a DEFAULT nextval, with ownership. Identity (PG10+) is SQL standard, tied to the column (permissions and dumps behave), and <code>GENERATED ALWAYS</code> blocks accidental manual ids. Both are non-transactional: rollbacks leave gaps.</p>', lvl: 'core' },
    { q: 'How do you change a column type on a large table with low downtime?', a: '<p><code>ALTER COLUMN TYPE</code> usually rewrites the table and rebuilds indexes under an ACCESS EXCLUSIVE lock (exceptions: binary-compatible changes like varchar(n) → text or increasing n). For big tables: add a new column, dual-write via trigger or app, backfill in batches, build indexes CONCURRENTLY, swap in a short transaction.</p>', lvl: 'deep' },
    { q: 'json vs jsonb, and when json?', a: '<p>jsonb: parsed binary, deduplicated keys, no whitespace/order preservation, GIN-indexable, equality and containment operators. json: exact text, cheaper to ingest, re-parsed on every access. Use json only when exact text matters.</p>', lvl: 'core' },
    { q: 'What surprises are there with interval arithmetic?', a: '<p>Months have no fixed length: <code>\'2026-01-31\'::date + interval \'1 month\'</code> = 2026-02-28. Adding <code>\'1 day\'</code> to a timestamptz across a DST switch keeps the local time (23 or 25 hours), while <code>\'24 hours\'</code> adds exactly 24 h.</p>', lvl: 'deep' },
    { q: 'Why might a UUID primary key be a type that bites?', a: '<p>Random UUIDv4 keys scatter inserts across the B-tree, hurting cache locality and WAL volume (full-page writes). Time-ordered UUIDv7 (native <code>uuidv7()</code> in PG18; generated in the app before that) or bigint identity avoid that.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Entity types that don’t bite', lang: 'java', code: `@Entity
public class Order {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)    // bigint identity column
  private Long id;
  @Column(precision = 12, scale = 2) private BigDecimal amount;   // numeric(12,2)
  private Instant createdAt;                                      // timestamptz
  @JdbcTypeCode(SqlTypes.JSON) private Map<String, Object> attrs; // jsonb
}
// application.yml
// spring.jpa.properties.hibernate.jdbc.time_zone: UTC`, note: 'Prefer <code>SEQUENCE</code> with a pooled optimizer for batch inserts: IDENTITY disables Hibernate’s JDBC insert batching.' },
    { title: 'Reading timestamptz with JDBC', lang: 'java', code: `try (PreparedStatement ps = conn.prepareStatement("select created_at from orders where id = ?")) {
  ps.setLong(1, 42);
  ResultSet rs = ps.executeQuery(); rs.next();
  OffsetDateTime t = rs.getObject(1, OffsetDateTime.class);   // UTC offset from pgJDBC
  Instant i = t.toInstant();
}` }
  ]
});
