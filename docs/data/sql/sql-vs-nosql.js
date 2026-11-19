IA.register({
  track: 'sql',
  slug: 'sql-vs-nosql',
  title: 'SQL vs NoSQL: the families',
  tagline: '“NoSQL” is not one thing. It is <b>seven families</b>, each built around one access pattern: documents, keys, wide partitions, graphs, search terms, time and vectors. Each has a canonical use case and a <b>classic failure mode</b>, and Postgres covers part of each.',
  tldr: {
    problem: 'Teams adopt a NoSQL store for its strength and discover its failure mode in production: hot partitions, unmodelled queries, eventual consistency, a search index used as the source of truth.',
    model: 'Every family trades general-purpose querying for one fast path. You get that fast path only if your <b>access pattern matches the data model</b> you designed up front. Postgres trades some peak speed for generality, plus extensions (JSONB, tsvector, pgvector, Timescale).',
    hook: '“Model the data, then the queries” is relational thinking. In Cassandra and DynamoDB it is the reverse: <b>list the queries, then design one table per query</b>.',
    facts: [
      { v: '7', l: 'families: document, key-value, wide-column, graph, search, time-series, vector' },
      { v: '1 s', l: 'default Elasticsearch refresh interval: a new document is not searchable until the next refresh (near-real-time)' },
      { v: '16 MB', l: 'maximum BSON document size in MongoDB: unbounded embedded arrays eventually hit it' }
    ]
  },
  intro: {
    what: '<b>SQL databases</b> store data in tables with a fixed schema and let you ask almost any question with joins. <b>NoSQL</b> is an umbrella name for databases that store data differently: as JSON documents, as key → value pairs, as graphs of nodes and edges, as search indexes, and so on. Each kind is very fast for <i>one kind of question</i> and awkward for others.',
    analogy: { icon: '🗂️', title: 'Different filing systems', text: 'A spreadsheet (SQL) can be sorted and filtered in any way. A folder per customer (document) is great when you always open one customer. A coat-check ticket (key-value) is instant if you have the ticket, useless if you don’t. A corkboard with strings (graph) shows who knows whom. A book’s index (search) finds pages by word.' },
    steps: [
      { t: 'Start from the question', d: 'What will the app ask most often? “Get order 42”, “find products matching red shoes”, “friends of friends”, “average temperature per hour”, “documents similar to this one”.' },
      { t: 'Each family has one fast path', d: 'Document: fetch a whole object. Key-value: get by key. Wide-column: read a partition in order. Graph: hop along edges. Search: look up words. Time-series: scan a time range. Vector: find nearest neighbours.' },
      { t: 'Each has a classic failure', d: 'Asking a question the model was not designed for is slow or impossible, e.g. a key-value store asked “all orders over $100”.' },
      { t: 'Postgres can do much of this', d: 'JSONB for documents, tsvector for search, recursive CTEs for graphs, partitioning or Timescale for time series, pgvector for vectors. Specialists win past certain sizes.', code: "SELECT doc->>'name' FROM product\nWHERE doc @> '{\"attrs\":{\"color\":\"red\"}}';" }
    ],
    widget: 'sql-vs-nosql-intro',
    terms: [
      ['schema', 'The agreed shape of the data: which fields, which types.'],
      ['partition key', 'The field a distributed store hashes to decide which server holds an item.'],
      ['inverted index', 'A map from each word to the list of documents containing it, like the index at the back of a book.'],
      ['eventual consistency', 'Copies of the data may disagree for a short time but converge if writes stop.'],
      ['embedding', 'A list of numbers (a vector) representing the meaning of a text or image, so “similar” = “close together”.']
    ]
  },
  visual: {
    title: 'Seven families, one at a time',
    caption: 'Pick a family and press Play: canonical use case → data model → write/read path → strength → <b>classic failure mode</b>. The last step shows how far Postgres gets with the same job.'
  },
  extras: [
    { id: 'sql-vs-nosql-matrix', title: 'Postgres can do much of this, until it can’t', label: 'Postgres coverage', caption: 'For each family: the Postgres feature that covers it, and the point where a specialist store starts to win. Sort or filter.' }
  ],
  playground: {
    setup: `
CREATE TABLE product (id int PRIMARY KEY, doc jsonb NOT NULL);
CREATE INDEX product_doc_gin ON product USING gin (doc jsonb_path_ops);
INSERT INTO product VALUES
 (1,'{"name":"Trail running shoe","brand":"Kite","price":120,"tags":["shoe","running"],"attrs":{"color":"red","size":[41,42,43]}}'),
 (2,'{"name":"Road runner shoe","brand":"Kite","price":95,"tags":["shoe","running"],"attrs":{"color":"blue"}}'),
 (3,'{"name":"Wool hiking sock","brand":"Fjell","price":15,"tags":["sock"],"attrs":{"color":"red","material":"wool"}}'),
 (4,'{"name":"Rain jacket","brand":"Fjell","price":180,"tags":["jacket"],"attrs":{"color":"green","waterproof":true}}');
CREATE TABLE article (id int PRIMARY KEY, body text,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', body)) STORED);
CREATE INDEX article_tsv ON article USING gin (tsv);
INSERT INTO article (id, body) VALUES (1,'How to choose running shoes for trails'),(2,'Runners guide: road shoes compared'),
 (3,'Keeping your feet dry while hiking'),(4,'The history of the marathon run');
CREATE TABLE follows (src text, dst text, PRIMARY KEY (src, dst));
INSERT INTO follows VALUES ('ana','ben'),('ben','cy'),('cy','dee'),('ana','cy'),('dee','eli'),('eli','ana');
CREATE TABLE reading (device int, ts timestamptz, temp numeric);
INSERT INTO reading SELECT d, timestamptz '2026-01-01 00:00+00' + g * interval '10 minutes', 20 + (g % 7) + d
FROM generate_series(1,3) d, generate_series(0,143) g;
CREATE TABLE kv (k text PRIMARY KEY, v text) PARTITION BY HASH (k);
CREATE TABLE kv_p0 PARTITION OF kv FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE kv_p1 PARTITION OF kv FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE kv_p2 PARTITION OF kv FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE kv_p3 PARTITION OF kv FOR VALUES WITH (MODULUS 4, REMAINDER 3);
INSERT INTO kv SELECT 'user#' || g, 'profile ' || g FROM generate_series(1,20) g;`,
    presets: [
      { label: 'Document (JSONB)', sql: `SELECT id, doc->>'name' AS name, doc->'attrs' AS attrs\nFROM product\nWHERE doc @> '{"attrs":{"color":"red"}}'\nORDER BY id;`, note: '<code>@&gt;</code> (containment) can use the GIN index. Schema-flexible documents, but still inside a transactional database.' },
      { label: 'JSONB index plan', sql: `SET enable_seqscan = off;   -- tiny table: force the index to show it\nEXPLAIN SELECT id FROM product WHERE doc @> '{"brand":"Kite"}';`, note: 'A GIN index with <code>jsonb_path_ops</code> answers containment queries. It does not help <code>doc-&gt;&gt;\'price\' &gt; \'100\'</code>: use an expression index for that.' },
      { label: 'Search (tsvector)', sql: `SELECT id, body, ts_rank(tsv, q) AS rank\nFROM article, websearch_to_tsquery('english', 'running shoes') q\nWHERE tsv @@ q\nORDER BY rank DESC;`, note: 'Stemming turns “running” into “run”. “Runners” stems to “runner”, so article 2 does not match. Relevance tuning beyond this is where Elasticsearch earns its place.' },
      { label: 'Graph (recursive CTE)', sql: `-- who can ana reach within 3 hops?\nWITH RECURSIVE reach(who, depth, path) AS (\n  SELECT dst, 1, ARRAY['ana', dst] FROM follows WHERE src = 'ana'\n  UNION ALL\n  SELECT f.dst, r.depth + 1, r.path || f.dst\n  FROM reach r JOIN follows f ON f.src = r.who\n  WHERE r.depth < 3 AND NOT f.dst = ANY (r.path)\n)\nSELECT who, min(depth) AS hops FROM reach GROUP BY who ORDER BY 2, 1;`, note: 'Fine for shallow, bounded traversals. Each hop is an index join; deep, variable-length paths over millions of edges is where a graph DB wins.' },
      { label: 'Time series', sql: `SELECT device, date_trunc('hour', ts) AS hour,\n       round(avg(temp), 2) AS avg_temp, max(temp)\nFROM reading\nWHERE ts >= '2026-01-01 20:00+00'\nGROUP BY 1, 2 ORDER BY 1, 2;`, note: 'Plain SQL buckets. TimescaleDB adds automatic time partitioning (chunks), <code>time_bucket</code>, compression and continuous aggregates.' },
      { label: 'Key-value partitions', sql: `-- hash partitioning: which partition holds each key?\nSELECT tableoid::regclass AS partition, count(*) FROM kv GROUP BY 1 ORDER BY 1;\nSELECT tableoid::regclass AS partition, k FROM kv WHERE k = 'user#7';`, note: 'The same idea DynamoDB and Cassandra use: hash(partition key) → partition. Here the keys spread 4/7/6/3. If one key gets all the traffic, its partition is hot no matter how many partitions exist.' }
    ]
  },
  gotchas: [
    { trap: 'Embedding everything in one document', why: 'Embedding customer data into every order duplicates it; an unbounded array (comments, events) grows the document every write and eventually hits the 16 MB limit. Each update rewrites a bigger document.', fix: 'Embed what is read together and bounded; reference what is shared or unbounded. In Postgres JSONB the same rule applies: large JSONB values are TOASTed and rewritten on update.' },
    { trap: 'A low-cardinality partition key in DynamoDB / Cassandra', why: 'Keys like <code>status</code> or <code>date</code> send most traffic to a few partitions. Throughput is limited per partition, so you get throttling while total capacity is unused.', fix: 'Use high-cardinality keys (user id, device id). For write-heavy keys add a suffix (write sharding) and read across the suffixes.' },
    { trap: 'Designing Cassandra tables like relational tables', why: 'There are no joins, and filtering on non-key columns needs <code>ALLOW FILTERING</code> (a scan) or a secondary index with poor performance at scale.', fix: 'Query-first modelling: one table per query, duplicating data on write. Bound partition size with time buckets in the partition key.' },
    { trap: 'Using Elasticsearch as the system of record', why: 'Search is near-real-time (refresh), mapping changes often need a full reindex, and there are no multi-document transactions. You must be able to rebuild the index.', fix: 'Keep the truth in a database and feed the index via CDC or an outbox. Use aliases to reindex without downtime.' },
    { trap: 'Graph DB for everything connected', why: 'Almost all data is “connected”. Graph DBs excel at multi-hop traversals but are weaker at large aggregates and are harder to shard.', fix: 'Choose a graph DB when variable-depth traversal (fraud rings, recommendations, network paths) is the main query. Recursive CTEs cover shallow hierarchies.' },
    { trap: 'Forgetting ANN is approximate', why: 'HNSW and IVF indexes trade recall for speed. With a restrictive filter (tenant, permission), post-filtering can return fewer than k results.', fix: 'Measure recall against exact search. Tune <code>hnsw.ef_search</code>; pgvector 0.8+ has iterative index scans for filtered queries. Partition by tenant if filters are very selective.' },
    { trap: 'Deletes are not free in LSM stores', why: 'Cassandra writes a <b>tombstone</b> for each delete. Reads must skip tombstones until compaction removes them; queue-like delete patterns cause slow reads and timeouts.', fix: 'Avoid queue patterns on Cassandra. Use TTLs with time-windowed compaction and time-bucketed partitions.' }
  ],
  scenarios: [
    { title: 'Black Friday: DynamoDB throttles while capacity is 70% unused',
      symptom: '<code>ProvisionedThroughputExceededException</code> spikes for one flash-sale product; other products are fine.',
      cause: 'The partition key was <code>product_id</code>, and the flash-sale item’s counter and orders all went to one partition, which has a per-partition throughput limit.',
      fix: 'Shard the hot key (<code>product_id#0..N</code>) and aggregate on read; move the counter to a sharded counter or Redis; keep orders keyed by order id.' },
    { title: 'Customer updated their email; search still shows the old one for days',
      symptom: 'Support search in Elasticsearch disagrees with the app.',
      cause: 'The app wrote to Postgres and Elasticsearch separately (dual write). The ES write failed during a cluster restart and was never retried.',
      fix: 'Feed Elasticsearch from Postgres via Debezium CDC (or an outbox), with idempotent upserts by id and version. Run a periodic reconciliation.' },
    { title: 'Cassandra reads time out on the “inbox” table',
      symptom: 'Reading a user’s unread messages takes seconds; logs warn about scanning thousands of tombstones.',
      cause: 'Messages were deleted after being read (queue pattern). Each delete is a tombstone that reads must skip until compaction.',
      fix: 'Model the inbox with time buckets and a TTL, read only the latest buckets, and use time-window compaction. Or keep the inbox in Postgres if volume allows.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'How many products does this return?', code: `SELECT id FROM product\nWHERE doc @> '{"attrs":{"color":"red"}}';`, options: ['1', '2', '3', '0 (nested keys are not matched)'], answer: 1, explain: 'Containment works on nested objects: products 1 (shoe) and 3 (sock) have <code>attrs.color = red</code>: <b>2</b>.' },
    { kind: 'predict', q: 'Which articles match the stemmed term “run”?', code: `SELECT id FROM article\nWHERE tsv @@ to_tsquery('english', 'run')\nORDER BY id;`, options: ['1 and 4', '1, 2 and 4', 'Only 4', 'All four'], answer: 0, explain: '“running” stems to <code>run</code> (article 1) and “run” is in article 4. “Runners” stems to <code>runner</code>, so article 2 does <b>not</b> match.' },
    { kind: 'predict', q: 'Minimum number of hops from ana to eli?', code: `WITH RECURSIVE reach(who, depth, path) AS (\n  SELECT dst, 1, ARRAY['ana', dst] FROM follows WHERE src = 'ana'\n  UNION ALL\n  SELECT f.dst, r.depth + 1, r.path || f.dst\n  FROM reach r JOIN follows f ON f.src = r.who\n  WHERE r.depth < 3 AND NOT f.dst = ANY (r.path))\nSELECT min(depth) FROM reach WHERE who = 'eli';`, options: ['2', '3', '4', 'unreachable'], answer: 1, explain: 'ana → cy → dee → eli: <b>3</b> hops (ana follows cy directly).' },
    { kind: 'concept', q: 'A chat app stores messages in Cassandra with partition key <code>channel_id</code>. Popular channels get slow over months. Why?', options: ['Cassandra cannot store text', 'Partitions grow without bound; the fix is a time bucket in the key: (channel_id, day)', 'It needs more secondary indexes', 'Clustering order must be random'], answer: 1, explain: 'A partition lives on one replica set and should stay bounded in size. Bucketing by time keeps partitions small while recent messages are still read from one partition.' },
    { kind: 'concept', q: 'Why is Elasticsearch “eventually consistent” for search right after a write?', options: ['It replicates asynchronously to S3', 'New documents become searchable only after a refresh creates a new segment (default 1 s)', 'It uses last-writer-wins', 'It caches all queries for a minute'], answer: 1, explain: 'Indexing writes to an in-memory buffer; a refresh makes it a searchable segment. GET by id is real-time, search is near-real-time.' },
    { kind: 'concept', q: 'You need semantic search over 5 million chunks, filtered by tenant and permissions, already on Postgres. Best first choice?', options: ['A dedicated vector DB with permissions copied over', 'pgvector with HNSW, the filters in the same query, recall measured', 'Elasticsearch keyword search', 'Store vectors in Redis'], answer: 1, explain: '5M vectors fits pgvector on a reasonable node, and you keep ACID and permission joins. Move to a dedicated store only when measured size or QPS requires it.' }
  ],
  interview: [
    { q: 'When would you choose a document store over Postgres JSONB?', a: '<p>When the application is naturally aggregate-oriented (each request reads/writes one self-contained document), cross-document joins are rare, the team already operates MongoDB well, and you want its native sharding and driver ergonomics. JSONB is enough when documents live next to relational data and you want constraints and joins. Note: MongoDB supports multi-document transactions (4.0+), but its model favours single-document atomicity.</p>', lvl: 'core' },
    { q: 'Explain partition key design in DynamoDB and the hot-partition problem.', a: '<p>Items are placed by hash of the partition key; each partition has a throughput limit. A key with skewed traffic (one celebrity user, one flash-sale product, “today’s date”) concentrates load. Choose high-cardinality keys aligned with access patterns, add write sharding suffixes for hot keys, and use the sort key for range queries within a partition. Adaptive capacity helps but does not remove per-key limits.</p>', fu: 'How would you model “orders by customer” and “orders by status”? (Base table keyed by customer, GSI keyed by status with sharding.)', lvl: 'deep' },
    { q: 'Why does Cassandra write so fast, and what does it cost on reads?', a: '<p>Writes are appended to a commit log and an in-memory memtable, then flushed to immutable SSTables: sequential I/O, no read-before-write (LSM tree). Reads may need to merge several SSTables (helped by bloom filters, caches and compaction) and skip tombstones. Consistency is tunable per query (ONE, QUORUM, ALL).</p>', lvl: 'deep' },
    { q: 'What is query-first modelling?', a: '<p>List every query the application will run, then design a table per query whose partition key matches the query’s equality predicate and whose clustering columns match its sort order. Denormalize and write the same data to several tables. The opposite of normal-form-first relational modelling.</p>', lvl: 'core' },
    { q: 'What makes a graph database faster for traversals?', a: '<p>Native graph stores like Neo4j keep relationships as direct references between nodes (index-free adjacency), so each hop follows a pointer instead of an index lookup and join. Cost grows with the part of the graph touched, not the total size. Weak spots: global aggregates, supernodes with millions of edges, and horizontal sharding.</p>', lvl: 'core' },
    { q: 'Why shouldn’t Elasticsearch be the primary database?', a: '<p>No multi-document transactions, near-real-time visibility, mapping changes often need a reindex, and historically some failure modes could lose acknowledged writes. Treat it as a derived index that can be rebuilt from the system of record, fed by CDC/outbox with versioned, idempotent upserts.</p>', lvl: 'core' },
    { q: 'pgvector or a dedicated vector database?', a: '<p>pgvector: vectors next to your data, ACID, joins and filters in one query, one store to operate, HNSW and IVFFlat indexes. It fits most RAG and recommendation workloads up to tens of millions of vectors per node, depending on dimensions and memory. A dedicated vector DB is worth it for very large collections, very high QPS, specialized features (built-in hybrid ranking, multi-tenancy at scale), and when the team accepts a second store and its sync path.</p>', lvl: 'deep' },
    { q: 'What does TimescaleDB add over plain Postgres partitioning?', a: '<p>Hypertables that create time chunks automatically, chunk exclusion, <code>time_bucket</code>, native columnar compression of old chunks, continuous aggregates (incrementally refreshed materialized rollups), and retention policies that drop whole chunks. It stays a Postgres extension, so SQL and joins still work.</p>', lvl: 'core' },
    { q: 'Where does “Postgres can do it all” stop?', a: '<ul><li>Write throughput beyond one primary (needs sharding).</li><li>Multi-region writes during partitions.</li><li>Relevance search with facets, synonyms and typo tolerance at large scale.</li><li>Billions of vectors or very high ANN QPS.</li><li>Deep traversals over huge graphs.</li><li>Petabyte analytics (columnar warehouses).</li></ul>', lvl: 'core' }
  ],
  code: [
    { title: 'JSONB in JPA (Hibernate 6)', lang: 'java', code: `@Entity
public class Product {
  @Id Long id;

  @JdbcTypeCode(SqlTypes.JSON)        // Hibernate 6 maps this to jsonb on Postgres
  @Column(columnDefinition = "jsonb")
  private Map<String, Object> doc;
}

// Containment query via native SQL (uses the GIN index)
@Query(value = "select * from product where doc @> cast(:filter as jsonb)", nativeQuery = true)
List<Product> findByDoc(@Param("filter") String jsonFilter);
// findByDoc("{\\"attrs\\":{\\"color\\":\\"red\\"}}")`, note: 'Keep stable, frequently filtered fields as real columns; use JSONB for the long tail of attributes.' }
  ]
});
