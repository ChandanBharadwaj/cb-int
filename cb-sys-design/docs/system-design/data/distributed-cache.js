SD.register({
  slug: 'distributed-cache',
  domain: 1,
  title: 'Caching Patterns',
  examples: 'Redis, Memcached, Caffeine',
  tagline: 'The <b>17 caching concepts</b> in one place: how to read and write through a cache, keep it fresh, survive stampedes, avalanches and hot keys, and spread it over many nodes while it <b>stays correct enough</b>.',
  tldr: {
    problem: 'The database can serve thousands of reads per second; the product needs millions. Reads are skewed: a few keys are very hot.',
    idea: 'Put a <b>look-aside cache</b> in front of the DB, <b>sharded by key hash</b> (consistent hashing or Redis hash slots). On a write, update the DB and <b>delete</b> the cached key. Pick the read and write pattern, TTL and eviction policy per kind of data.',
    insight: 'The hard part is not speed but <b>invalidation and herds</b>: stale sets after races, stampedes when a hot key expires, avalanches when many keys expire together, and load spikes when a node dies. Leases, TTL jitter, warm-up, gutter pools and change-log invalidation solve them.',
    numbers: [
      { v: 'billions/s', l: 'requests served by Facebook\'s memcache tier (NSDI \'13 paper)' },
      { v: '~5B/s', l: 'peak requests through mcrouter at Facebook (2014)' },
      { v: '16,384', l: 'hash slots in a Redis Cluster (CRC16 mod 16384)' }
    ]
  },
  intro: {
    what: 'This page walks the caching roadmap in 17 steps, from what a cache is to keeping a cluster of caches consistent. The steps are numbered <b>01–17</b> in the glossary below and again in the walkthrough near the end. A cache keeps copies of frequently read data <b>in memory</b>, spread across many servers, so applications can read it much faster than from the database. The database stays the <b>source of truth</b>. The cache only holds copies that can be thrown away and rebuilt at any time.',
    analogy: {
      icon: '📚',
      title: 'A library front desk that keeps the popular books',
      text: 'The library\'s stacks hold every book, but fetching one takes a while. So the front desk keeps copies of the most requested books within arm\'s reach. If a book is not at the desk, a clerk fetches it from the stacks and leaves a copy at the desk for the next reader. When a book gets a new edition, the desk copy is thrown away so nobody reads the old one. A big library has several desks, each in charge of a range of titles. Unlike a real desk, a cache copy can be briefly out of date before it is thrown away.'
    },
    problem: 'Your app shows each user\'s profile on every page. Every page view reads the same rows from the database again and again, and a database can only answer so many queries per second. When traffic grows tenfold the database falls over, even though almost all of those reads ask for data that has not changed. The question is <b>"how do I serve most reads from fast memory without showing stale data, and without crushing the database when the cache misses?"</b>',
    story: [
      {
        stage: 'naive',
        title: 'Put one cache server in front of the database',
        text: 'The app asks the cache first. On a <b>miss</b> (the key is not there) it reads the database and stores a copy in the cache with an expiry time. Later reads are <b>hits</b> served from memory. This pattern is called <b>cache-aside</b>, and it takes most of the load off the database.',
        scene: {
          nodes: [
            { id: 'app', label: 'App servers', sub: 'cache first', kind: 'service', at: [70, 0] },
            { id: 'cache', label: 'Cache server', sub: 'one box · RAM', kind: 'cache', at: [350, 0] },
            { id: 'db', label: 'Database', sub: 'source of truth', kind: 'store', at: [70, 220] }
          ],
          edges: [{ from: 'app', to: 'cache' }, { from: 'app', to: 'db' }],
          flow: ['app>cache', 'app>db', 'app>cache']
        }
      },
      {
        stage: 'breaks',
        title: 'One box fills up, and every miss lands at once',
        text: 'The data outgrows one machine\'s memory and network. When the box restarts, or a very popular key expires, thousands of requests miss <b>at the same moment</b> and all query the database for the same row: a <b>stampede</b>. Writes cause a quieter problem too: the cache can keep serving the old value after the database changed.',
        scene: {
          nodes: [
            { id: 'app', label: 'App servers', sub: 'all miss at once', kind: 'service', at: [70, 0] },
            { id: 'cache', label: 'Cache server', sub: 'full · restarting', kind: 'cache', at: [350, 0] },
            { id: 'db', label: 'Database', sub: 'same query ×1000', kind: 'store', at: [70, 220] }
          ],
          edges: [{ from: 'app', to: 'cache' }, { from: 'app', to: 'db' }],
          flow: ['app>cache', ['app>db', 'app>db'], ['app>db', 'app>db']],
          warn: ['cache'],
          err: ['db'],
          badges: { cache: ['miss', 'warn'], db: ['stampede', 'err'] }
        }
      },
      {
        stage: 'fix',
        title: 'Shard by key, delete on write, let one request refill',
        text: 'Spread keys over many cache servers by <b>hashing the key</b>, using consistent hashing so adding a server moves only a few keys. On a write, update the database and then <b>delete</b> the cached copy. When a hot key is missing, a <b>lease</b> lets only one request reload it while the others wait a moment.',
        scene: {
          nodes: [
            { id: 'app', label: 'App servers', sub: 'cache-aside', kind: 'service', at: [70, 0] },
            { id: 'rtr', label: 'hash(key)', sub: 'picks a shard', kind: 'edge', at: [210, 110] },
            { id: 's1', label: 'Shard A', sub: '⅓ of keys · RAM', kind: 'cache', at: [350, 0] },
            { id: 's2', label: 'Shard B', sub: '⅓ of keys · RAM', kind: 'cache', at: [350, 110] },
            { id: 's3', label: 'Shard C', sub: '⅓ of keys · RAM', kind: 'cache', at: [350, 220] },
            { id: 'db', label: 'Database', sub: '1 reload per key', kind: 'store', at: [70, 220] }
          ],
          edges: [{ from: 'app', to: 'rtr' }, { from: 'rtr', to: 's1' }, { from: 'rtr', to: 's2' }, { from: 'rtr', to: 's3' }, { from: 'app', to: 'db' }],
          flow: ['app>rtr', 'rtr>s2', 'app>rtr', 'rtr>s3'],
          ok: ['s1', 's2', 's3', 'db'],
          badges: { s2: ['hit', 'ok'] }
        }
      }
    ],
    usedBy: ['Facebook', 'Twitter / X', 'Stack Overflow', 'Redis', 'Memcached', 'Amazon ElastiCache'],
    whenToUse: [
      'Reads far outnumber writes, and the <b>same items</b> are read again and again',
      'The database is the bottleneck, and a value that is a few seconds old is acceptable',
      'Results are expensive to compute or fetch, such as a rendered feed or a joined query'
    ],
    whenNot: [
      'The value must always be exactly current, like a balance during a money transfer',
      'The data must survive restarts on its own: use a real store (see <a href="kv-store.html">Distributed Key-Value Store</a>)',
      'You want to cache whole files and pages close to users around the world: use a <a href="cdn.html">Content Delivery Network</a>'
    ],
    glossary: [
      { term: '01 · Cache basics', def: 'A cache keeps a disposable copy of data in fast memory, so the slower source of truth is asked less often.' },
      { term: '02 · Cache hits & misses', def: 'A hit is answered from the cache; a miss has to go to the database. The hit ratio is the share of reads that hit, and a small drop can multiply the database load.' },
      { term: '03 · Cache-aside (look-aside)', def: 'The app checks the cache, reads the database on a miss, then writes the value into the cache itself.' },
      { term: '04 · TTL (time to live)', def: 'How long a cached copy may be kept before it expires and is reloaded.' },
      { term: '05 · Cache eviction (LRU)', def: 'When memory is full the cache must remove entries. LRU removes the one that has gone unused the longest.' },
      { term: '06 · Cache invalidation', def: 'Removing a cached copy after the underlying data changes, so the next read loads the fresh value.' },
      { term: '07 · Write-through', def: 'Every write updates the database and the cache together, before the caller gets its answer.' },
      { term: '08 · Write-back (write-behind)', def: 'A write is acknowledged from the cache and saved to the database later, in batches.' },
      { term: '09 · Write-around', def: 'Writes go only to the database. The cache fills when the data is first read.' },
      { term: '10 · Cache stampede (thundering herd)', def: 'Many requests miss the same key at once and all hit the database together. A <b>lease</b> lets one request reload it while the others wait.' },
      { term: '11 · Cache avalanche', def: 'Many keys expire or disappear at the same moment, so a wave of misses lands on the database.' },
      { term: '12 · Cache penetration', def: 'Requests for data that does not exist anywhere miss the cache every time, so each one reaches the database.' },
      { term: '13 · Hot keys', def: 'A single key read so often that the one server holding it becomes overloaded.' },
      { term: '14 · Cache warming', def: 'Loading the popular entries into an empty cache before real traffic arrives.' },
      { term: '15 · Distributed caching', def: 'Spreading the cache over many servers, each holding a share of the keys.' },
      { term: '16 · Consistent hashing', def: 'A way to map keys to servers so that adding or removing a server moves only a small share of keys.' },
      { term: '17 · Cache consistency', def: 'How closely the cached copies match the database, and for how long they may differ after a write.' }
    ]
  },

  requirements: {
    functional: [
      '<code>get / set / delete</code> by key, with TTL',
      'Batch reads (<code>multi-get</code>) for page rendering',
      'Invalidate on DB writes',
      'Add or remove nodes without a full cache flush',
      'Atomic counters and simple data structures (Redis)',
      'Per-key or per-namespace TTLs'
    ],
    nonFunctional: [
      'Sub-millisecond p99 inside a datacenter',
      'Hit ratio ≥ 95% on skewed traffic',
      'A node failure must not overload the DB',
      'Bounded staleness after writes (seconds)',
      'Scale linearly with nodes',
      'Hot keys must not melt one node'
    ],
    outOfScope: ['Durable storage (the DB is the source of truth)', 'CDN / edge caching of HTTP responses', 'Full-text or secondary-index queries']
  },

  calculator: {
    inputs: [
      { id: 'qps', label: 'Read requests / second', min: 10000, max: 100000000, value: 5000000, log: true },
      { id: 'hit', label: 'Hit ratio', min: 50, max: 99.9, step: 0.1, value: 95, unit: '%' },
      { id: 'items', label: 'Items in the hot set', min: 1000000, max: 10000000000, value: 200000000, log: true },
      { id: 'size', label: 'Average item size (key + value)', min: 100, max: 100000, value: 800, log: true, fmt: 'bytes' },
      { id: 'rep', label: 'Copies of each item (primary + replicas)', min: 1, max: 3, value: 2 },
      { id: 'ram', label: 'Usable RAM per cache node (GB)', min: 16, max: 512, value: 64, log: true, unit: 'GB' }
    ],
    outputs: [
      { label: 'DB reads/s from misses', f: (v) => v.qps * (1 - v.hit / 100) },
      { label: 'DB reads/s if the cache were empty', f: (v) => v.qps },
      { label: 'Cache memory (×1.3 overhead, × copies)', fmt: 'bytes', f: (v) => v.items * v.size * 1.3 * v.rep },
      { label: 'Cache nodes needed (by RAM)', fmt: 'raw', f: (v) => String(Math.max(1, Math.ceil((v.items * v.size * 1.3 * v.rep) / (v.ram * 1e9)))) },
      { label: 'Cache egress for hits', fmt: 'bytesps', f: (v) => v.qps * (v.hit / 100) * v.size },
      { label: 'Extra DB load per 1% hit-ratio drop', f: (v) => v.qps * 0.01 }
    ],
    note: 'The 1.3× per-item overhead (keys, pointers, allocator slack) is an <em>estimate</em>. Look at the last row: at high QPS a <b>one-point drop in hit ratio</b> can double the DB load. Hit ratio is the number to watch.'
  },

  api: [
    { m: 'GET', p: 'get(key) / mget(keys[])', d: 'Look-aside read. On a miss the <b>application</b> loads from the DB and calls <code>set</code>. Batch keys per page to cut round trips.' },
    { m: 'PUT', p: 'set(key, value, ttl)', d: 'Always with a TTL (plus a little random jitter) so mistakes heal themselves and expiries do not line up.' },
    { m: 'DELETE', p: 'delete(key)', d: 'Called after a DB write, and by the change-log invalidator. Deletes are idempotent, so they are safe to retry and to broadcast.' },
    { m: 'RPC', p: 'lease_get(key) → value | token', d: 'Facebook-style lease: on a miss the server hands out a token. Only the token holder may <code>set</code>; a delete in between voids the token.' },
    { m: 'RPC', p: 'CLUSTER SLOTS / -MOVED 3999 10.0.0.7:6379', d: 'Redis Cluster: the client caches the slot → node map and follows <code>MOVED</code> / <code>ASK</code> redirects while slots migrate.' }
  ],
  dataModel: [
    { name: 'Cache entry', store: 'Memcached / Redis (RAM)', fields: [['key', 'user:42:profile', 'pk'], ['value', 'serialized bytes'], ['ttl', 'seconds'], ['cas / version', 'int64']], note: 'Key naming includes a schema version (<code>v3:user:42</code>) so a deploy can switch formats safely.' },
    { name: 'Ring / slot map', store: 'Client router config', fields: [['vnode_hash', 'uint32', 'pk'], ['node', 'host:port'], ['slot (Redis)', '0…16383', 'idx']], note: 'Consistent-hash ring with many virtual nodes per server, or Redis Cluster\'s 16384 slots.' },
    { name: 'Source table', store: 'Postgres', fields: [['id', 'bigint', 'pk'], ['…columns', ''], ['updated_at', 'timestamptz'], ['version', 'int']], note: 'The truth. Its WAL / binlog drives invalidation.' }
  ],

  architecture: {
    title: 'Caching architecture',
    nodes: [
      { id: 'l1', label: 'L1 local cache', sub: 'in-process, hot keys', kind: 'cache', wide: [160, 40], tall: [350, 0], tip: 'A tiny per-server cache (e.g. Caffeine) with a short TTL for the hottest keys. Takes hot-key load off any single shard.' },
      { id: 'app', label: 'App servers', sub: 'cache-aside client', kind: 'service', wide: [160, 160], tall: [210, 0], tip: 'Read: cache first, DB on miss, then set. Write: DB first, then delete the key.' },
      { id: 'bloom', label: 'Bloom filter', sub: 'ids that exist', kind: 'compute', wide: [160, 280], tall: [70, 0], tip: 'A compact bit array holding every valid id. It answers "definitely not there" or "maybe there", so requests for ids that do not exist stop before the cache and the DB. It never gives a false "not there".' },
      { id: 'gut', label: 'Gutter pool', sub: 'takes over dead shard', kind: 'cache', wide: [460, 40], tall: [350, 105], tip: 'A small spare pool (Facebook used about 1% of servers). When a shard does not answer, clients use the gutter instead of rehashing, so the DB is not hit by a wave of misses. Entries expire quickly.' },
      { id: 'rtr', label: 'Client router', sub: 'ring + vnodes (mcrouter)', kind: 'edge', wide: [460, 160], tall: [210, 105], tip: 'Maps key → shard with consistent hashing (or Redis slots). Facebook runs mcrouter as a proxy that speaks the memcached protocol.' },
      { id: 'inv', label: 'Invalidator', sub: 'tails WAL → DELETE', kind: 'queue', wide: [460, 280], tall: [70, 210], tip: 'Reads the DB commit log (Facebook\'s mcsqueal; Debezium/logical decoding on Postgres) and sends deletes for changed keys. Catches writers that forgot to invalidate.' },
      { id: 'db', label: 'Postgres', sub: 'source of truth', kind: 'store', wide: [460, 400], tall: [70, 105], tip: 'Must survive the load of all misses, plus the extra misses after a node failure or a cold start.' },
      { id: 's1', label: 'Cache shard 1', sub: 'primary + replica', kind: 'cache', wide: [790, 40], tall: [70, 345], tip: 'Owns a set of ring ranges (or hash slots). Evicts with LRU/LFU when full.' },
      { id: 's2', label: 'Cache shard 2', sub: 'primary + replica', kind: 'cache', wide: [790, 160], tall: [210, 345], tip: 'Each shard is independent: no cross-shard transactions, which is why it scales linearly.' },
      { id: 's3', label: 'Cache shard 3', sub: 'primary + replica', kind: 'cache', wide: [790, 280], tall: [350, 345], tip: 'Adding a shard with consistent hashing moves only about 1/N of keys.' },
      { id: 'warm', label: 'Warmer job', sub: 'preloads hot keys', kind: 'compute', wide: [790, 400], tall: [350, 210], tip: 'Runs after a deploy, a failover or a scale-out. Reads the most popular rows at a limited rate and fills the cache before real traffic arrives, so a cold cache does not become a wave of misses.' }
    ],
    edges: [
      { from: 'app', to: 'l1', bidi: true },
      { from: 'app', to: 'rtr', bidi: true },
      { from: 'app', to: 'db' },
      { from: 'app', to: 'bloom', dashed: true },
      { from: 'rtr', to: 'gut', dashed: true },
      { from: 'rtr', to: 's1' },
      { from: 'rtr', to: 's2' },
      { from: 'rtr', to: 's3' },
      { from: 'db', to: 'inv', label: 'WAL' },
      { from: 'inv', to: 'rtr' },
      { from: 'warm', to: 'db', dashed: true },
      { from: 'warm', to: 'rtr', dashed: true }
    ]
  },

  scenarios: [
    {
      id: 'aside', title: 'Cache-aside: miss, then hit', tone: 'ok',
      steps: [
        { text: 'A request needs <code>user:42</code>. The app asks the router, which hashes the key to <b>shard 2</b>.', flow: ['app>rtr', 'rtr>s2'], badges: { s2: ['miss', 'warn'] } },
        { text: 'Miss. The app reads the row from <b>Postgres</b> (a few ms instead of sub-ms).', flow: ['app>db'], badges: { db: 'SELECT … id=42' } },
        { text: 'The app writes the value back with a <b>TTL</b> (plus jitter, so keys loaded together do not expire together).', flow: ['app>rtr', 'rtr>s2'], badges: { s2: 'set · ttl 600 s' } },
        { text: 'The next thousand reads hit shard 2 in well under a millisecond. The DB sees none of them.', flow: ['app>rtr', 'rtr>s2'], ok: ['s2'], badges: { s2: ['hit', 'ok'] }, tone: 'ok' }
      ]
    },
    {
      id: 'write', title: 'Write → invalidate', tone: 'info',
      steps: [
        { text: 'A user edits their profile. The app writes <b>Postgres first</b>; the DB is the source of truth.', flow: ['app>db'], badges: { db: 'UPDATE users' } },
        { text: 'Then it <b>deletes</b> the key (it does not set the new value). Deletes are idempotent and cannot race into storing an old value.', flow: ['app>rtr', 'rtr>s2'], badges: { s2: 'DELETE user:42' } },
        { text: 'As a safety net, the <b>invalidator</b> tails the WAL and sends the same delete. This catches writes from batch jobs and other services that forgot to invalidate.', flow: ['db>inv', 'inv>rtr', 'rtr>s2'], badges: { inv: 'from WAL' } },
        { text: 'The next read misses and reloads the fresh row. Staleness is bounded by replication + invalidation lag, usually well under a second.', flow: ['app>rtr', 'rtr>s2', 'app>db'], ok: ['s2'], tone: 'ok' }
      ]
    },
    {
      id: 'stampede', title: 'Hot key expires → stampede', tone: 'warn',
      steps: [
        { text: 'A celebrity\'s profile is read <b>50,000 times/s</b>. Its TTL runs out.', flow: [['app>rtr', 'app>rtr'], 'rtr>s2'], warn: ['s2'], badges: { s2: ['expired', 'warn'] }, tone: 'warn' },
        { text: 'Without protection, <b>every concurrent miss</b> queries the DB for the same row: thousands of identical queries in the time one takes.', flow: [['app>db', 'app>db']], err: ['db'], badges: { db: ['herd', 'err'] }, tone: 'err' },
        { text: '<b>Leases</b> (Facebook): the first miss gets a token and loads the row. Other clients are told to wait briefly and retry instead of querying.', nodes: ['s2', 'app'], badges: { s2: 'lease → 1 loader' } },
        { text: 'One DB query, one <code>set</code> with the token, then everyone hits. The paper reports leases cutting a peak DB query rate from <b>17K/s to 1.3K/s</b>.', flow: ['app>db', 'app>rtr', 'rtr>s2'], ok: ['db', 's2'], badges: { db: ['1 query', 'ok'] }, tone: 'ok' },
        { text: 'For extreme keys, also keep a copy in each server\'s <b>L1 cache</b> for a second or two. The shard then sees one read per server, not one per request.', flow: ['app>l1'], ok: ['l1'], badges: { l1: 'hot key copy' }, tone: 'ok' }
      ]
    },
    {
      id: 'node-loss', title: 'Cache shard dies', tone: 'err',
      steps: [
        { text: 'Shard 2 stops answering. A third of all keys are suddenly unreachable.', flow: ['rtr>s2'], err: ['s2'], badges: { s2: ['down', 'err'] }, tone: 'err' },
        { text: 'Naive fix: rehash its keys to shards 1 and 3. They all start <b>cold</b>, so their misses flood the DB at the worst possible moment.', flow: [['rtr>s1', 'rtr>s3'], 'app>db'], warn: ['db'], badges: { db: ['+33% misses', 'warn'] }, tone: 'warn' },
        { text: '<b>Gutter pool</b> (Facebook): on a timeout the client retries against a small spare pool. The first miss there loads from the DB and fills it with a short TTL.', flow: ['rtr>gut'], ok: ['gut'], badges: { gut: 'serving shard 2 keys' } },
        { text: 'Load on the DB stays bounded and the other shards keep their hit ratio. When shard 2 (or its replacement) returns, traffic moves back.', nodes: ['s2', 'gut', 'db'], ok: ['s2', 'db'], badges: { s2: ['replaced', 'ok'] }, tone: 'ok' }
      ]
    },
    {
      id: 'stale-set', title: 'Race: stale value cached', tone: 'warn',
      steps: [
        { text: 'Reader A misses on <code>user:42</code> and reads the row from the DB: <b>name = "Ann"</b>.', flow: ['app>rtr', 'rtr>s2', 'app>db'], badges: { app: 'A has "Ann"' } },
        { text: 'Before A writes it back, writer B updates the row to <b>"Anna"</b> and deletes the key, which is not there yet.', flow: ['app>db', 'app>rtr', 'rtr>s2'], badges: { db: '"Anna"' } },
        { text: 'A finally <code>set</code>s its old value. The cache now holds <b>"Ann"</b> until the TTL expires: a <b>stale set</b>.', flow: ['app>rtr', 'rtr>s2'], warn: ['s2'], badges: { s2: ['"Ann" (stale)', 'warn'] }, tone: 'warn' },
        { text: 'Fixes: <b>leases</b> (B\'s delete voids A\'s token, so A\'s set is rejected), versioned sets (only newer versions win), or a short TTL as a backstop.', nodes: ['s2'], ok: ['s2'], badges: { s2: ['set rejected', 'ok'] }, tone: 'ok' }
      ]
    },
    {
      id: 'writes', title: 'Three ways to write', tone: 'info',
      steps: [
        { text: '<b>Write-through.</b> The write goes to Postgres and to the cache in the same call. The caller waits for both, so the next read is a fresh hit.', flow: ['app>db', 'app>rtr', 'rtr>s2'], ok: ['s2'], badges: { db: 'UPDATE', s2: ['SET · fresh', 'ok'] } },
        { text: '<b>Write-back.</b> The write lands in the cache only and is acknowledged at once. A flusher saves it to Postgres a few seconds later, in a batch.', flow: ['app>rtr', 'rtr>s2', 's2>db'], warn: ['s2'], badges: { s2: ['not in DB yet', 'warn'], db: 'batch, later' }, tone: 'warn' },
        { text: 'If shard 2 dies before the flush, those acknowledged writes are <b>gone</b>. Use write-back only for data you can lose, such as view counts.', nodes: ['s2', 'db'], err: ['s2'], badges: { s2: ['writes lost', 'err'] }, tone: 'err' },
        { text: '<b>Write-around.</b> The write goes to Postgres only. The cache is not touched, so nothing is cached that nobody reads.', flow: ['app>db'], badges: { db: 'INSERT', s2: 'untouched' } },
        { text: 'The first read after a write-around is a <b>miss</b>, then cache-aside fills the key. If an older copy was cached, delete it or keep its TTL short.', flow: ['app>rtr', 'rtr>s2', 'app>db', 'app>rtr', 'rtr>s2'], ok: ['s2'], badges: { s2: ['miss, then set', 'ok'] }, tone: 'ok' }
      ]
    },
    {
      id: 'penetration', title: 'Penetration: ids that do not exist', tone: 'err',
      steps: [
        { text: 'A crawler or attacker asks for <code>user:-1</code>, <code>user:99999999</code> and other ids that <b>do not exist</b>. Each one misses the cache.', flow: [['app>rtr', 'app>rtr'], 'rtr>s2'], warn: ['s2'], badges: { s2: ['miss', 'warn'] }, tone: 'warn' },
        { text: 'Postgres finds no row, so there is <b>nothing to cache</b>. The same request misses again next time. The cache gives no protection at all.', flow: [['app>db', 'app>db']], err: ['db'], badges: { db: ['0 rows, every time', 'err'] }, tone: 'err' },
        { text: 'Fix 1, <b>negative caching</b>: store a "not found" marker with a short TTL. Repeats of the same bad id now hit the cache.', flow: ['app>rtr', 'rtr>s2'], ok: ['s2'], badges: { s2: ['∅ · ttl 60 s', 'ok'] }, tone: 'ok' },
        { text: 'Fix 2, a <b>Bloom filter</b> of every valid id, checked first. "Definitely not there" returns 404 without touching the cache or the DB.', flow: ['app>bloom'], ok: ['bloom', 'db'], badges: { bloom: ['not present', 'ok'], db: ['0 queries', 'ok'] }, tone: 'ok' },
        { text: 'A Bloom filter can say "maybe" for an id that is absent (a <b>false positive</b>), and those few fall through. It never hides an id that exists. Add each new id on insert.', flow: ['app>bloom', 'app>rtr', 'rtr>s2'], nodes: ['bloom'], badges: { bloom: '≈ 1% maybe' } }
      ]
    },
    {
      id: 'avalanche', title: 'Avalanche: mass expiry', tone: 'err',
      steps: [
        { text: 'A deploy at 02:00 loaded the whole catalogue with the <b>same TTL</b> of one hour. At 03:00 every key expires together.', nodes: ['s1', 's2', 's3'], warn: ['s1', 's2', 's3'], badges: { s1: ['expired', 'warn'], s2: ['expired', 'warn'], s3: ['expired', 'warn'] }, tone: 'warn' },
        { text: 'Every request misses, on <b>every key</b>. A stampede is one key and many readers; an avalanche is many keys at once. Postgres takes the full read load.', flow: [['app>rtr', 'app>rtr'], ['app>db', 'app>db']], err: ['db'], badges: { db: ['miss wave', 'err'] }, tone: 'err' },
        { text: 'Fix 1, <b>TTL jitter</b>: add a random ±10% to each TTL. The same keys now expire spread over twelve minutes instead of one instant.', nodes: ['s1', 's2', 's3'], ok: ['s1', 's2', 's3'], badges: { s2: ['ttl 3240–3960 s', 'ok'] }, tone: 'ok' },
        { text: 'Fix 2, <b>warm before traffic</b>: after a restart the warmer job reads the hottest rows at a limited rate and fills the shards before requests arrive.', flow: ['warm>db', 'warm>rtr', ['rtr>s1', 'rtr>s2', 'rtr>s3']], ok: ['warm', 's1', 's2', 's3'], badges: { warm: 'top keys' }, tone: 'ok' },
        { text: 'Protect Postgres anyway: cap concurrent DB reads, shed excess load, and let the <b>L1 cache</b> serve a slightly old copy while the shards refill.', flow: ['app>l1'], ok: ['l1', 'db'], badges: { l1: 'serve stale', db: ['bounded', 'ok'] }, tone: 'ok' }
      ]
    }
  ],

  knobs: {
    intro: 'Choose the caching pattern, TTL strategy, eviction policy, sharding scheme and stampede protection. The router and shard labels follow your choices.',
    controls: [
      { id: 'pat', label: 'Caching pattern', type: 'seg', value: 'aside', options: [
        { v: 'aside', l: 'Cache-aside' }, { v: 'rt', l: 'Read-through' }, { v: 'wt', l: 'Write-through' }, { v: 'wb', l: 'Write-behind' }, { v: 'wa', l: 'Write-around' }] },
      { id: 'ttl', label: 'TTL strategy', type: 'seg', value: 'jit', options: [
        { v: 'fixed', l: 'Fixed TTL' }, { v: 'jit', l: 'TTL + jitter' }, { v: 'slide', l: 'Sliding TTL' }] },
      { id: 'ev', label: 'Eviction (Redis maxmemory-policy)', type: 'seg', value: 'lru', options: [
        { v: 'lru', l: 'allkeys-lru' }, { v: 'lfu', l: 'allkeys-lfu' }, { v: 'none', l: 'noeviction (TTL only)' }] },
      { id: 'shard', label: 'Sharding', type: 'seg', value: 'ring', options: [
        { v: 'mod', l: 'hash % N' }, { v: 'ring', l: 'Consistent hash + vnodes' }, { v: 'slots', l: 'Redis 16384 slots' }] },
      { id: 'herd', label: 'Stampede protection', type: 'seg', value: 'none', options: [
        { v: 'none', l: 'None' }, { v: 'lease', l: 'Leases' }, { v: 'early', l: 'Probabilistic early expiry' }, { v: 'single', l: 'Request coalescing' }] },
      { id: 'n', label: 'Cache nodes', type: 'range', min: 2, max: 64, step: 1, value: 8 }
    ],
    evaluate(s) {
      const n = s.n, apps = 200, concurrent = 2000; // illustrative: app servers, concurrent readers of one hot key
      const hit = { lru: [0.95, '≈ 95% (recency)'], lfu: [0.96, '≈ 96% (frequency, skewed load)'], none: [0.9, 'writes fail when full (OOM)'] }[s.ev];
      let hitS = s.ev === 'none' ? 0.3 : hit[0];
      const stale = { aside: ['until delete / TTL; race possible', 0.65], rt: ['until delete / TTL; race possible', 0.65], wt: ['≈ none: cache updated on write', 0.9], wb: ['none in cache; DB lags', 0.75], wa: ['old copy stays until TTL', 0.4] }[s.pat];
      if (s.ttl === 'slide' && s.pat !== 'wt' && s.pat !== 'wb') { stale[0] += '; hot keys never expire'; stale[1] -= 0.25; }
      const wlat = { aside: ['DB write + delete', 0.75], rt: ['DB write + delete', 0.75], wt: ['DB write + cache write', 0.55], wb: ['cache only (fastest)', 0.95], wa: ['DB write only', 0.85] }[s.pat];
      const mass = { fixed: ['high: keys loaded together expire together', 0.15], jit: ['low: expiries spread by ±10%', 0.9], slide: ['medium: only unread keys line up', 0.6] }[s.ttl];
      const moved = s.shard === 'mod' ? n / (n + 1) : 1 / (n + 1);
      const herdN = { none: concurrent, lease: 1, early: 1, single: apps }[s.herd];
      const loss = s.pat === 'wb' ? ['writes lost if a node dies before flush', 0.15] : ['none (DB written first)', 0.95];
      const metrics = [
        { k: 'Hit ratio', v: hit[1], s: hitS, hint: 'illustrative' },
        { k: 'Staleness after write', v: stale[0], s: stale[1] },
        { k: 'Write latency', v: wlat[0], s: wlat[1] },
        { k: 'Keys moved on +1 node', v: (moved * 100).toFixed(moved < 0.1 ? 1 : 0) + '% of keys', s: 1 - moved },
        { k: 'DB queries on hot-key expiry', v: '≈ ' + SD.fmt.num(herdN) + (s.herd === 'single' ? ' (1 per app server)' : ''), s: herdN <= 1 ? 0.95 : herdN <= apps ? 0.6 : 0.1 },
        { k: 'Mass-expiry (avalanche) risk', v: mass[0], s: mass[1] },
        { k: 'Data-loss risk', v: loss[0], s: loss[1] }
      ];
      const notes = [];
      if (s.shard === 'mod') notes.push('<code>hash % N</code>: going from ' + n + ' to ' + (n + 1) + ' nodes remaps ≈ ' + Math.round(moved * 100) + '% of keys. The cache is effectively flushed and the DB takes every miss.');
      if (s.shard === 'ring') notes.push('Consistent hashing moves ≈ 1/(N+1) of keys. Each server owns many <b>virtual nodes</b> on the ring so load and moved keys are spread evenly.');
      if (s.shard === 'slots') notes.push('Redis Cluster: <code>CRC16(key) mod 16384</code> picks a slot; slots are assigned to primaries and moved with <code>MIGRATE</code>. Clients follow <code>MOVED</code>/<code>ASK</code>. Use <code>{hash tags}</code> to keep related keys in one slot.');
      if (s.herd === 'none') notes.push('About ' + SD.fmt.num(concurrent) + ' concurrent readers (illustrative) all miss and query the DB for the same row.');
      if (s.herd === 'lease') notes.push('Leases also fix <b>stale sets</b>: a delete invalidates the outstanding token, so a slow reader cannot write an old value back.');
      if (s.herd === 'early') notes.push('XFetch-style early expiry: each reader recomputes early with a probability that rises as expiry nears, so usually exactly one refreshes before the TTL.');
      if (s.herd === 'single') notes.push('Coalescing (single-flight, Spring <code>@Cacheable(sync = true)</code>) dedupes per process: ' + apps + ' app servers still send ' + apps + ' queries.');
      if (s.pat === 'wb') notes.push('Write-behind acknowledges before the DB has the data. Only for data you can lose or rebuild (counters, view counts).');
      if (s.pat === 'wt') notes.push('Write-through caches everything that is written, including rows nobody reads. Keep a TTL so unread entries leave.');
      if (s.pat === 'wa') notes.push('Write-around writes the DB only. The first read after each write is a miss, and a copy cached earlier stays stale until its TTL unless you also delete it.');
      if (s.ttl === 'fixed') notes.push('With one fixed TTL, keys loaded in the same batch (a deploy, a warm-up, a nightly job) all expire in the same second.');
      if (s.ttl === 'slide') notes.push('A sliding TTL is renewed by every read, so a popular key never expires. It then relies entirely on invalidation to stay fresh.');
      if (s.ev === 'none') notes.push('Redis\'s default <code>maxmemory-policy</code> is <code>noeviction</code>: when memory is full, writes return OOM errors. Set an eviction policy for a cache.');
      let verdict;
      if (s.pat === 'wb') verdict = '⚠ <b>Fast writes, but the cache is now a database</b> without a database\'s durability. Avoid for anything users would miss.';
      else if (s.ev === 'none') verdict = '❌ <b>No eviction:</b> a full cache starts rejecting writes. Use allkeys-lru or allkeys-lfu.';
      else if (s.shard === 'mod') verdict = '⚠ <b>Scaling the cache flushes it.</b> Use consistent hashing or Redis slots.';
      else if (s.herd === 'none') verdict = '⚠ <b>One hot-key expiry can take down the DB.</b> Add leases, early expiry or at least coalescing.';
      else if (s.ttl === 'fixed') verdict = '⚠ <b>Identical TTLs invite an avalanche.</b> Add random jitter so expiries spread out.';
      else if (s.pat === 'aside' && s.herd === 'lease' && s.ttl === 'jit') verdict = '✅ <b>Facebook-style:</b> look-aside, delete on write, leases against herds and stale sets, jittered TTLs, consistent hashing.';
      else verdict = '👍 <b>Solid.</b> Check staleness and write latency for your read/write mix.';
      const rtrSub = { mod: 'hash(key) % N', ring: 'ring + vnodes', slots: '16384 slots · MOVED' }[s.shard];
      const evSub = { lru: 'allkeys-lru', lfu: 'allkeys-lfu', none: 'noeviction' }[s.ev];
      const flow = s.pat === 'wb' ? ['app>rtr', 'rtr>s2', 's2>db'] : s.pat === 'wt' ? ['app>db', 'app>rtr', 'rtr>s2'] : s.pat === 'wa' ? ['app>db'] : s.pat === 'rt' ? ['app>rtr', 'rtr>s2', 's2>db'] : ['app>rtr', 'rtr>s2', 'app>db'];
      return {
        metrics, verdict, notes, flow,
        labels: { rtr: { label: s.shard === 'slots' ? 'Cluster client' : 'Client router', sub: rtrSub }, s1: { label: 'Cache shard 1', sub: evSub }, s2: { label: 'Cache shard 2', sub: evSub }, s3: { label: 'Cache shard 3', sub: evSub } },
        hot: s.herd === 'single' ? ['app'] : [],
        warn: s.shard === 'mod' ? ['rtr'] : [],
        err: s.herd === 'none' ? ['db'] : s.pat === 'wb' ? ['s2'] : [],
        badges: { db: [s.herd === 'none' ? 'herd risk' : 'protected', s.herd === 'none' ? 'err' : 'ok'], rtr: [Math.round(moved * 100) + '% move', s.shard === 'mod' ? 'warn' : 'ok'] }
      };
    }
  },

  widget: {
    title: 'Consistent hash ring with virtual nodes',
    caption: 'Dots are keys, coloured by the node that owns them. <b>Add or remove a node</b> and see what share of keys move. Switch to <b>hash % N</b> to compare, and raise <b>vnodes</b> to even out the load.'
  },

  realWorld: {
    intro: 'Facebook\'s memcache paper is the classic reference; Redis Cluster and Twitter\'s caches show other choices. The entries tagged with a step number show where each of the 17 concepts is used in a real system.',
    timeline: [
      { when: '1998', who: 'IETF (DNS)', title: '04 · 12 · TTLs and negative caching in DNS', text: 'Every DNS record carries a <b>TTL</b> that tells resolvers how long they may cache it. RFC 2308 adds <b>negative caching</b>: a resolver also caches the answer "this name does not exist", so repeated lookups for a missing name stop reaching the name servers. This is the same defence used against cache penetration.', src: 15 },
      { when: '2007', who: 'Amazon', title: '16 · Dynamo: consistent hashing with virtual nodes', text: 'Dynamo partitions keys with <b>consistent hashing</b>, and each physical machine owns several <b>virtual nodes</b> on the ring. That spreads load evenly and lets a larger machine take a larger share.', src: 19 },
      { when: 'Docs', who: 'Apache Cassandra', title: '12 · Bloom filters skip lookups for missing keys', text: 'Each SSTable has a <b>Bloom filter</b> that says whether the file might hold a partition, so reads skip files that definitely do not. A lower <code>bloom_filter_fp_chance</code> means fewer wasted reads and more memory.', src: 16 },
      { when: 'Docs', who: 'Redis', title: '05 · Approximated LRU and LFU eviction', text: 'When <code>maxmemory</code> is reached, Redis evicts by <code>maxmemory-policy</code>. Its LRU is an <b>approximation</b>: it samples a few keys (<code>maxmemory-samples</code>) and evicts the best candidate. LFU uses a small probabilistic counter with a decay period.', src: 14 },
      { when: 'Docs', who: 'Caffeine (Java)', title: '05 · Window TinyLFU', text: 'The Caffeine library evicts with <b>Window TinyLFU</b>: a small recency window in front of a main region, with a frequency sketch that decides whether a new entry may replace an old one. It is the usual in-process (L1) cache on the JVM.', src: 18 },
      { when: 'Docs', who: 'Fastly', title: '06 · Purge a group of entries by surrogate key', text: 'The origin tags each response with a <code>Surrogate-Key</code> header. One purge call for a key then <b>invalidates every cached response</b> carrying that tag, for example every page that shows one product.', src: 17 },
      { when: 'Docs', who: 'AWS (DynamoDB DAX)', title: '07 · A write-through item cache', text: 'DAX passes writes through to DynamoDB <b>synchronously</b> and then updates its item cache, so a later read of that item is served fresh from the cache. Reads from DAX are eventually consistent by default; strongly consistent reads go straight to DynamoDB.', src: 10 },
      { when: 'Docs', who: 'AWS', title: '03 · 07 · Lazy loading and write-through together', text: 'AWS\'s caching whitepaper describes <b>cache-aside (lazy loading)</b> as filling the cache only after data is requested, and <b>write-through</b> as updating it right after the database changes. It recommends using both, with an expiry on every entry.', src: 20 },
      { when: 'Docs', who: 'Hazelcast', title: '08 · Write-behind with one setting', text: 'A Hazelcast <code>MapStore</code> with <code>write-delay-seconds</code> of 0 is <b>write-through</b>; any larger value makes it <b>write-behind</b>, flushing changed entries after the delay. By default it keeps only the latest change per key in that window (write coalescing).', src: 11 },
      { when: '2018', who: 'Netflix', title: '14 · Cache warming for EVCache', text: 'Netflix built a <b>cache warmer</b> for EVCache, its memcached-based cache. A replica warmer copies data from an existing replica to new ones, and an instance warmer fills a replaced node from another replica, so replacing nodes does not send a herd of misses to the origin services.', src: 12 },
      { when: '2019', who: 'Stack Overflow', title: '01 · A local cache plus a shared Redis cache', text: 'Each web server process keeps a <b>local in-memory cache</b>, with <b>Redis</b> as the shared cache behind the web tier. The post weighs the cost of a network round trip to Redis against the memory and invalidation cost of caching locally.', src: 8 },
      { when: '2020', who: 'Twitter', title: '02 · Measuring 153 production cache clusters', text: 'A study of traces from <b>153 in-memory cache clusters</b> found that key popularity mostly follows a Zipf-like curve, that write-heavy workloads are common (over 35% of clusters), and that TTLs limit the working set, so removing expired objects matters as much as eviction.', src: 9 },
      { when: '2022', who: 'Meta', title: '17 · Measuring cache consistency (Polaris)', text: 'Meta\'s <b>Polaris</b> service acts as a cache client: it receives invalidation events and checks that every cache replica eventually matches the database. It reports only mismatches that persist over a time window, which is how the team finds invalidation bugs.', src: 13 },
      { when: '1997', who: 'MIT (Karger et al.)', title: 'Consistent hashing (STOC \'97)', text: 'Karger, Lehman, Leighton, Panigrahy, Levine and Lewin define a hash that <b>changes minimally when the set of caches changes</b>, and use it to spread web-cache load without every client knowing the full, current set of servers. The idea behind Akamai and every hash ring since.', src: 6 },
      { when: '2013', who: 'Facebook', title: 'Scaling Memcache at Facebook (NSDI \'13)', text: 'A look-aside memcache tier serving <b>billions of requests per second</b> and holding <b>trillions of items</b>. Writes go to MySQL, then delete the key. The paper introduces <b>leases</b> against stale sets and herds (peak DB query rate 17K/s → 1.3K/s in their measurement), <b>gutter</b> servers for failed hosts and <b>mcsqueal</b>, which reads the MySQL commit log to broadcast deletes.', src: 0 },
      { when: '2013', who: 'Facebook', title: 'Engineering blog companion', text: 'Facebook\'s own summary of the paper: regions, clusters and how invalidations reach every cache.', src: 1 },
      { when: '2014', who: 'Facebook', title: 'mcrouter open-sourced', text: 'A memcached-protocol router used across thousands of cache servers in dozens of clusters, handling close to <b>5 billion requests per second</b> at peak. Any memcached client can talk to it unchanged, because it speaks the memcached protocol.', src: 2 },
      { when: '2015', who: 'Vattani et al.', title: 'XFetch: optimal probabilistic early expiry (VLDB)', text: 'Vattani, Chierichetti and Lowenstein show that refreshing early with probability rising towards expiry, scaled by how long the value takes to <b>recompute</b>, prevents stampedes with no locks or coordination, and prove the scheme optimal in their model.', src: 7 },
      { when: '2012', who: 'Twitter', title: 'Twemcache', text: 'Twitter forked Memcached into <b>Twemcache</b> to make it a reliable building block for its production environment.', src: 3 },
      { when: 'Later', who: 'Twitter', title: 'Twemcache → Pelikan', text: 'Twemcache is no longer maintained; Twitter\'s later caching work moved to <b>Pelikan</b>, a framework for building cache servers.', src: 4 },
      { when: 'Spec', who: 'Redis', title: 'Redis Cluster: 16384 hash slots', text: '<code>HASH_SLOT = CRC16(key) mod 16384</code>. Nodes gossip over a cluster bus, do not proxy requests, and redirect clients with <code>-MOVED</code> / <code>-ASK</code>. Hash tags <code>{…}</code> force related keys into one slot.', src: 5 }
    ],
    lessons: [
      '<span>Write to the DB, then <b>delete</b> from the cache; never update both.</span>',
      '<span>Plan for <b>herds</b> (hot-key expiry) and <b>stale sets</b> (read/write races) from day one.</span>',
      '<span>A dead cache node is a <b>DB-load problem</b>. Gutter pools beat rehashing to cold nodes.</span>',
      '<span>Tail the DB change log so every writer\'s changes invalidate the cache.</span>'
    ],
    sources: [
      { title: 'Scaling Memcache at Facebook', url: 'https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala', pub: 'Nishtala et al., USENIX NSDI 2013' },
      { title: 'Scaling memcache at Facebook (blog)', url: 'https://engineering.fb.com/2013/04/15/core-infra/scaling-memcache-at-facebook/', pub: 'Facebook Engineering, 2013' },
      { title: 'Introducing mcrouter: a memcached protocol router', url: 'https://engineering.fb.com/2014/09/15/web/introducing-mcrouter-a-memcached-protocol-router-for-scaling-memcached-deployments/', pub: 'Facebook Engineering, 2014' },
      { title: 'Caching with Twemcache', url: 'https://blog.x.com/engineering/en_us/a/2012/caching-with-twemcache', pub: 'Twitter Engineering, 2012' },
      { title: 'twitter/twemcache (see Pelikan)', url: 'https://github.com/twitter/twemcache', pub: 'GitHub' },
      { title: 'Redis cluster specification', url: 'https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/', pub: 'Redis docs' },
      { title: 'Consistent Hashing and Random Trees: Distributed Caching Protocols for Relieving Hot Spots on the World Wide Web', url: 'https://cs.brown.edu/courses/csci2950-u/f09/papers/chash97stoc.pdf', pub: 'Karger et al., ACM STOC 1997 (doi 10.1145/258533.258660)' },
      { title: 'Optimal Probabilistic Cache Stampede Prevention', url: 'https://mail.vldb.org/pvldb/volumes/8/paper/Optimal%20Probabilistic%20Cache%20Stampede%20Prevention', pub: 'Vattani, Chierichetti, Lowenstein · PVLDB 8(8), 2015' },
      { title: 'Stack Overflow: How We Do App Caching (2019 edition)', url: 'https://nickcraver.com/blog/2019/08/06/stack-overflow-how-we-do-app-caching/', pub: 'Nick Craver, 2019' },
      { title: 'A large scale analysis of hundreds of in-memory cache clusters at Twitter', url: 'https://www.usenix.org/conference/osdi20/presentation/yang', pub: 'Yang, Yue, Rashmi · USENIX OSDI 2020' },
      { title: 'DAX and DynamoDB consistency models', url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DAX.consistency.html', pub: 'AWS docs' },
      { title: 'MapStore configuration guide', url: 'https://docs.hazelcast.com/hazelcast/5.5/mapstore/configuration-guide', pub: 'Hazelcast docs' },
      { title: 'Cache warming: Agility for a stateful service', url: 'https://netflixtechblog.com/cache-warming-agility-for-a-stateful-service-2d3b1da82642', pub: 'Netflix Technology Blog, 2018' },
      { title: 'Cache made consistent', url: 'https://engineering.fb.com/2022/06/08/core-infra/cache-made-consistent/', pub: 'Meta Engineering, 2022' },
      { title: 'Key eviction', url: 'https://redis.io/docs/latest/develop/reference/eviction/', pub: 'Redis docs' },
      { title: 'RFC 2308: Negative Caching of DNS Queries (DNS NCACHE)', url: 'https://www.rfc-editor.org/rfc/rfc2308', pub: 'M. Andrews, IETF, 1998' },
      { title: 'Bloom Filters', url: 'https://cassandra.apache.org/doc/4.0/cassandra/operating/bloom_filters.html', pub: 'Apache Cassandra docs' },
      { title: 'Working with surrogate keys', url: 'https://www.fastly.com/documentation/guides/full-site-delivery/purging/working-with-surrogate-keys/', pub: 'Fastly docs' },
      { title: 'Caffeine wiki: Efficiency', url: 'https://github.com/ben-manes/caffeine/wiki/Efficiency', pub: 'GitHub, ben-manes/caffeine' },
      { title: 'Dynamo: Amazon\'s Highly Available Key-value Store', url: 'https://courses.cs.washington.edu/courses/cse444/21wi/papers/p205-decandia.pdf', pub: 'DeCandia et al., ACM SOSP 2007' },
      { title: 'Database Caching Strategies Using Redis: caching patterns', url: 'https://docs.aws.amazon.com/whitepapers/latest/database-caching-strategies-using-redis/caching-patterns.html', pub: 'AWS whitepaper' }
    ]
  },

  tradeoffs: {
    headers: ['Decision', 'Option A', 'Option B', 'Pick when…'],
    rows: [
      ['Pattern', '<b>Cache-aside</b>: app controls, simple', '<b>Read/write-through</b>: library hides it', 'Cache-aside by default; through-patterns when one library owns all access'],
      ['On write', '<b>Delete key</b>: idempotent, race-safe', '<b>Update key</b>: no miss after write', 'Delete, unless the value is expensive and writes are rare'],
      ['Engine', '<b>Memcached</b>: simple, multithreaded, slab memory', '<b>Redis</b>: data structures, replication, cluster', 'Memcached for plain blobs at huge scale; Redis for counters, sets, sorted sets'],
      ['Sharding', '<b>Consistent hash</b> in the client / proxy', '<b>Redis Cluster slots</b>: server-side map', 'Proxy (mcrouter, twemproxy) for memcached; slots when you run Redis Cluster'],
      ['Node failure', '<b>Rehash</b> to survivors', '<b>Gutter pool</b> / replica promotion', 'Gutter or replicas when the DB cannot absorb a shard\'s misses'],
      ['Eviction', '<b>LRU</b>: recency', '<b>LFU</b>: frequency', 'LFU for stable popularity skew; LRU for shifting working sets'],
      ['Sync or async write', '<b>Write-through</b>: cache and DB before the reply; fresh, slower', '<b>Write-back</b>: reply from the cache, DB later; fast, can lose writes', 'Write-through when users read their own writes; write-back only for counters you can afford to lose'],
      ['Cache on write?', '<b>Write-through</b>: every write fills the cache', '<b>Write-around</b>: only reads fill the cache', 'Write-around when most writes are never read back (logs, history, imports)'],
      ['TTL length', '<b>Short</b> (seconds to minutes): fresher, more misses', '<b>Long</b> (hours) plus invalidation: higher hit ratio', 'Short when there is no reliable delete path; long when deletes are reliable'],
      ['Cold start', '<b>Lazy</b>: fill on demand', '<b>Warm</b>: preload the hot keys first', 'Warm when the DB cannot take the miss rate of an empty cache']
    ]
  },
  failures: [
    { f: 'Hot key expiry → stampede', detect: 'DB QPS spike for one query shape', fix: 'Leases / single-flight, probabilistic early refresh, TTL jitter, L1 copies of hot keys.' },
    { f: 'Stale value after a race', detect: 'Users see old data until TTL', fix: 'Delete-on-write, leases or versioned sets, and a TTL as the backstop.' },
    { f: 'Cache node dies', detect: 'Client timeouts, shard health checks', fix: 'Gutter pool or replica promotion; avoid rehashing a third of keys onto cold nodes.' },
    { f: 'Cache penetration', detect: 'Many misses for keys that do not exist; DB queries returning zero rows', fix: 'Cache "not found" with a short TTL, check a Bloom filter of valid ids first, validate id format and rate-limit the caller.' },
    { f: 'Avalanche (mass expiry)', detect: 'Miss rate jumps on many keys at a fixed time', fix: 'Random TTL jitter, staggered batch loads, and a cap on concurrent DB reads so the database degrades instead of failing.' },
    { f: 'Cold cache after a deploy or failover', detect: 'Hit ratio near zero right after a release; DB CPU pinned', fix: 'Warm the top keys before taking traffic, ramp traffic up gradually, or copy from a warm replica.' },
    { f: 'Dual-write drift', detect: 'A sampled compare job finds keys that differ from the DB and never heal', fix: 'One write path (DB, then delete), change-log invalidation as a backstop, and a TTL on every key.' },
    { f: 'Missed invalidation', detect: 'Data differs from DB long after writes', fix: 'Tail the WAL/binlog (CDC) and delete changed keys, in addition to app deletes.' },
    { f: 'Hot shard', detect: 'One node\'s CPU/network far above others', fix: 'Local L1 cache, replicate the hot key to several nodes, split big values.' }
  ],

  // Entries 1–17 are the concept walkthrough, in the roadmap's order: subtopics first, then where it is used.
  interview: [
    { q: '01 · Cache basics: what is a cache, and what belongs in one?', a: '<ul><li><b>What it is</b>: a copy of data kept somewhere faster than its source. A read from RAM takes well under a millisecond; a database query takes milliseconds and uses a connection.</li><li><b>Source of truth vs copy</b>: the database owns the data. Anything in the cache can be deleted and rebuilt.</li><li><b>Layers</b>: browser → CDN → in-process cache (L1) → shared cache such as Redis (L2) → the database\'s own buffer pool. Each layer catches what the one before it missed.</li><li><b>What to cache</b>: data that is read often, changes rarely, is expensive to produce, and is acceptable when slightly old.</li><li><b>Keys</b>: namespaced and versioned, such as <code>v3:user:42:profile</code>, so a deploy can change the format without reading old bytes.</li></ul><p><b>Where it is used:</b> Stack Overflow keeps a local in-memory cache in each web process and uses Redis as the shared cache behind the web tier (<a href="https://nickcraver.com/blog/2019/08/06/stack-overflow-how-we-do-app-caching/">Nick Craver, 2019</a>).</p>', lvl: 'core' },
    { q: '02 · Cache hits & misses: what do you measure?', a: '<ul><li><b>Hit ratio</b> = hits ÷ (hits + misses). The database sees the <b>miss ratio</b>, so going from 99% to 98% hits doubles its read load.</li><li><b>Kinds of miss</b>: cold (never loaded), capacity (evicted to free memory), and expiry or invalidation (TTL ran out, or the key was deleted).</li><li><b>Cost</b>: a hit is one sub-millisecond round trip. A miss is a cache round trip, a database query and a cache write.</li><li><b>Watch</b>: hit ratio, evictions per second, memory used, p99 latency, and database queries caused by misses. Redis reports <code>keyspace_hits</code> and <code>keyspace_misses</code> in <code>INFO stats</code>.</li><li><b>Skew helps</b>: a small hot set gets most of the reads, so a cache much smaller than the data still gives a high hit ratio.</li></ul><p><b>Where it is used:</b> Twitter traced 153 production cache clusters and found key popularity is mostly Zipf-like and that TTLs bound the working set (<a href="https://www.usenix.org/conference/osdi20/presentation/yang">Yang et al., OSDI 2020</a>).</p>', lvl: 'core' },
    { q: '03 · Cache-aside: how do the read and write paths work?', a: '<ul><li><b>Read</b>: get from the cache; on a miss read the database, then set the value with a TTL.</li><li><b>Write</b>: update the database first, then <b>delete</b> the key.</li><li><b>Delete, not update</b>: two writers can reach the cache in the opposite order to the database. A delete cannot store a wrong value.</li><li><b>Weak spots</b>: the first read after every miss is slow, and a slow reader can write an old row back after a delete (the stale-set race).</li><li><b>Read-through</b> is the same flow with the load done by the cache library (Caffeine <code>LoadingCache</code>, Spring <code>@Cacheable</code>), so application code only calls get.</li><li><b>Resilience</b>: if the cache is down the app can still read the database.</li></ul><p><b>Where it is used:</b> Facebook\'s memcache tier is look-aside: web servers read memcache, fall back to MySQL and fill the cache themselves (<a href="https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala">NSDI \'13</a>). AWS calls the same pattern <a href="https://docs.aws.amazon.com/whitepapers/latest/database-caching-strategies-using-redis/caching-patterns.html">lazy loading</a>.</p>', lvl: 'core' },
    { q: '04 · TTL: absolute or sliding, and how long?', a: '<ul><li><b>Absolute TTL</b>: the entry expires a fixed time after it was written, so staleness is bounded.</li><li><b>Sliding TTL</b>: every read renews it. A popular key may never expire, so use it for sessions or for data that is always invalidated explicitly.</li><li><b>Choosing a value</b>: the longest staleness the product tolerates. Shorter means fresher and more misses. Use different TTLs per kind of data: prices in seconds, profiles in minutes, static config in hours.</li><li><b>Jitter</b>: add a random ±10% so keys loaded together do not expire together.</li><li><b>How Redis expires keys</b>: lazily when a key is accessed, plus a background cycle that samples keys with a TTL. An expired key can hold memory for a short while.</li><li><b>Safety net</b>: set a TTL even when you invalidate on write, so a missed delete heals itself.</li></ul><p><b>Where it is used:</b> DNS. Every record carries a TTL that tells resolvers how long to cache it, and <a href="https://www.rfc-editor.org/rfc/rfc2308">RFC 2308</a> gives "no such name" answers a TTL too. HTTP does the same for browsers and CDNs with <code>Cache-Control: max-age</code>.</p>', lvl: 'core' },
    { q: '05 · Cache eviction: how does LRU work, and what else is there?', a: '<ul><li><b>Eviction is not expiry</b>: expiry removes entries that are too old; eviction removes entries because memory is full.</li><li><b>How LRU works</b>: a hash map from key to node, plus a doubly linked list ordered by last use. A get moves the node to the head. A put adds at the head and drops the tail when over capacity. Every step is O(1).</li><li><b>Other policies</b>: LFU (least frequently used; resists one-off scans, adapts slowly), FIFO (cheap and simple), random, and shortest remaining TTL.</li><li><b>Redis</b>: set <code>maxmemory</code> and <code>maxmemory-policy</code>. <code>allkeys-*</code> policies consider every key and <code>volatile-*</code> only keys with a TTL. Its LRU and LFU are approximations that sample a few keys.</li><li><b>Window TinyLFU</b>: admit a new entry only if it is likely to be used more than the one it would replace.</li></ul><p><b>Where it is used:</b> Redis samples keys rather than keeping an exact LRU list (<a href="https://redis.io/docs/latest/develop/reference/eviction/">Redis docs</a>). Caffeine, the common in-process cache on the JVM, uses <a href="https://github.com/ben-manes/caffeine/wiki/Efficiency">Window TinyLFU</a>.</p>', fu: 'Write an LRU cache in Java. (See the <code>LinkedHashMap</code> snippet in the code section.)', lvl: 'core' },
    { q: '06 · Cache invalidation: what are the options?', a: '<ul><li><b>TTL only</b>: simplest. Data is stale for up to one TTL.</li><li><b>Delete on write</b>: the app deletes the key after the database commit.</li><li><b>Change-log driven (CDC)</b>: a process tails the database log and deletes the keys of changed rows. It catches every writer, including batch jobs.</li><li><b>Versioned keys</b>: put a version in the key (<code>user:42:v17</code>). New writes use a new key and old keys age out, so no delete is needed.</li><li><b>Group purge</b>: tag entries and purge by tag, for example every page that shows product 42.</li><li><b>Why it is hard</b>: readers race with writers, some writer always forgets, and one row often feeds many cached values.</li></ul><p><b>Where it is used:</b> Facebook\'s <b>mcsqueal</b> reads the MySQL commit log and broadcasts deletes (<a href="https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala">NSDI \'13</a>). Fastly purges every response tagged with a <a href="https://www.fastly.com/documentation/guides/full-site-delivery/purging/working-with-surrogate-keys/">surrogate key</a> in one call.</p>', lvl: 'core' },
    { q: '07 · Write-through: what do you gain and pay?', a: '<ul><li><b>Flow</b>: on a write, the database and the cache entry are both updated before the caller gets its answer.</li><li><b>Gain</b>: a read straight after a write is a fresh hit. There is no miss after a write.</li><li><b>Cost</b>: every write pays for two writes, and the cache fills with rows nobody reads. Always pair it with a TTL.</li><li><b>Failure case</b>: if the cache update fails after the database commit, the entry is stale. Fall back to deleting the key, with the TTL as backstop.</li><li><b>In practice</b> it is combined with lazy loading, which refills keys that expired or were evicted.</li></ul><p><b>Where it is used:</b> Amazon DynamoDB Accelerator (DAX) passes writes through to DynamoDB synchronously and then updates its item cache (<a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DAX.consistency.html">AWS docs</a>).</p>', lvl: 'core' },
    { q: '08 · Write-back (write-behind): when is it safe?', a: '<ul><li><b>Flow</b>: write to the cache and answer at once. A background flusher saves the changes to the database later, in batches.</li><li><b>Gain</b>: the fastest writes. Many updates to one key collapse into a single database write (coalescing).</li><li><b>Risk</b>: if the cache node dies before the flush, acknowledged writes are lost. The database lags, so reports and other services reading it see old data.</li><li><b>Details that matter</b>: ordering per key, retries with an idempotent flush, and a bounded queue so a slow database pushes back.</li><li><b>Use it for</b> counters, view counts, last-seen timestamps and metrics. Not for orders or money.</li></ul><p><b>Where it is used:</b> a Hazelcast <code>MapStore</code> becomes write-behind when <code>write-delay-seconds</code> is above zero, and keeps only the latest change per key by default (<a href="https://docs.hazelcast.com/hazelcast/5.5/mapstore/configuration-guide">Hazelcast docs</a>). An operating system\'s page cache works the same way: writes land in memory and dirty pages are flushed later, which is why databases call <code>fsync</code>.</p>', lvl: 'core' },
    { q: '09 · Write-around: what is it, and when does it fit?', a: '<ul><li><b>Flow</b>: write only to the database. The cache is not touched and fills on the first read, by cache-aside.</li><li><b>Gain</b>: the cache holds only data that is actually read, and writes stay cheap.</li><li><b>Cost</b>: the first read after a write is a miss. If the key was already cached, the old copy stays until its TTL, so delete it or keep the TTL short when rows are updated and not only inserted.</li><li><b>Fits</b> write-heavy data that is rarely read back: logs, chat history, audit records, bulk imports.</li><li><b>Relation to cache-aside</b>: cache-aside with delete-on-write is write-around plus invalidation.</li></ul><p><b>Where it is used:</b> a pull-based <a href="cdn.html">CDN</a>. You upload a file to the origin store, and an edge server caches it only when a user first requests it.</p>', lvl: 'core' },
    { q: '10 · Cache stampede: what causes it, and how do you stop it?', a: '<ul><li><b>Cause</b>: one hot key expires or is deleted, and every concurrent reader misses and runs the same query.</li><li><b>Lock or lease</b>: the first reader to miss gets a token and loads the value. The others wait briefly or get the old value.</li><li><b>Single-flight</b>: dedupe loads inside one process (Spring <code>sync = true</code>, Caffeine). That still allows one query per app server.</li><li><b>Probabilistic early refresh (XFetch)</b>: refresh before expiry with a probability that rises as expiry nears.</li><li><b>Stale-while-revalidate</b>: serve the old value while one request refreshes it.</li></ul><p><b>Where it is used:</b> Facebook\'s leases cut a peak database query rate from 17K/s to 1.3K/s in their measurement (<a href="https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala">NSDI \'13</a>).</p>', lvl: 'core' },
    { q: '11 · Cache avalanche: how is it different from a stampede?', a: '<ul><li><b>Cause</b>: many keys miss at once. A batch load gave them the same TTL, or the cache tier restarted, was flushed or failed.</li><li><b>Versus a stampede</b>: a stampede is one key and many readers. An avalanche is many keys, so a per-key lock does not help.</li><li><b>Spread expiry</b>: TTL jitter, and stagger batch loads.</li><li><b>Avoid an empty cache</b>: warm it before traffic and ramp traffic up gradually.</li><li><b>Keep the tier up</b>: replicas, a gutter pool, and an L1 cache as a buffer.</li><li><b>Protect the database</b>: limit concurrent reads, shed load, open a circuit breaker and serve stale data.</li></ul><p><b>Where it is used:</b> Facebook\'s <b>cold cluster warm-up</b>: clients in a new, empty cluster fetch misses from a warm cluster\'s cache instead of the database (<a href="https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala">NSDI \'13</a>).</p>', lvl: 'core' },
    { q: '12 · Cache penetration: how do you stop lookups for data that does not exist?', a: '<ul><li><b>Cause</b>: a lookup for a key that is not in the database finds nothing to cache, so every repeat reaches the database. Sources are bugs, crawlers and attackers.</li><li><b>Negative caching</b>: store a "not found" marker with a short TTL (30–60 s) and delete it when the row is created.</li><li><b>Bloom filter of valid ids</b>: "definitely not there" skips the cache and the database. A small share of absent ids get "maybe" (false positives) and fall through. It never hides an id that exists. Add ids on insert; removing ids needs a rebuild or a counting filter.</li><li><b>Validate and limit</b>: reject ids with an impossible format or range, and rate-limit each caller.</li><li><b>Random-key attacks</b> fill the cache with markers, so against those the Bloom filter is the better defence.</li></ul><p><b>Where it is used:</b> DNS resolvers cache "this name does not exist" answers (<a href="https://www.rfc-editor.org/rfc/rfc2308">RFC 2308</a>). Cassandra keeps a Bloom filter per SSTable to skip files that cannot hold the partition (<a href="https://cassandra.apache.org/doc/4.0/cassandra/operating/bloom_filters.html">Cassandra docs</a>).</p>', lvl: 'core' },
    { q: '13 · Hot keys: how do you find and handle them?', a: '<ul><li><b>Problem</b>: one key takes a large share of traffic. The shard that owns it runs out of CPU or network while the rest of the cluster is idle.</li><li><b>Find them</b>: <code>redis-cli --hotkeys</code> (needs an LFU eviction policy), sampling in the client or proxy, and per-shard CPU skew.</li><li><b>L1 copy</b>: keep the key in each app server\'s in-process cache for 1–5 seconds.</li><li><b>Replicate</b>: store it as <code>key#0..7</code> on different shards and read a random copy.</li><li><b>Hot key vs big key</b>: a big key is a large value that blocks the server and the network. Split it into smaller values.</li><li><b>Guard its expiry</b> with a lease or early refresh, or it becomes a stampede.</li></ul><p><b>Where it is used:</b> Facebook replicates some memcache pools so that reads of heavily requested keys are spread over several servers (<a href="https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala">NSDI \'13</a>).</p>', lvl: 'core' },
    { q: '14 · Cache warming: when and how do you pre-fill a cache?', a: '<ul><li><b>Why</b>: after a deploy, a scale-out or a failover the cache is empty. The hit ratio is zero and the database takes the full read load.</li><li><b>Preload the top N</b>: take the most requested keys from access logs or a "most viewed" query and load them at startup.</li><li><b>Copy from a warm cache</b>: dump an existing replica and load it into the new one, without touching the database.</li><li><b>Gate traffic</b>: fail the readiness check until warm-up ends, then ramp traffic up.</li><li><b>Lazy or eager</b>: lazy filling is fine when the database can absorb the misses. Warm eagerly when it cannot.</li><li><b>Be gentle</b>: throttle the warmer, and jitter the TTLs of preloaded keys so they do not expire together.</li></ul><p><b>Where it is used:</b> Netflix\'s EVCache cache warmer copies data from an existing replica into new replicas and replaced nodes (<a href="https://netflixtechblog.com/cache-warming-agility-for-a-stateful-service-2d3b1da82642">Netflix, 2018</a>).</p>', lvl: 'core' },
    { q: '15 · Distributed caching: what changes when one node is not enough?', a: '<ul><li><b>Sharding</b>: each key lives on one node, chosen by a hash of the key. Nodes do not coordinate, so capacity grows linearly.</li><li><b>Replication</b>: copies of each shard for availability and read capacity, with a replica promoted on failure.</li><li><b>Routing</b>: in the client library (ketama), in a proxy (mcrouter, twemproxy), or cluster-aware clients that follow redirects (Redis Cluster).</li><li><b>Node loss</b> is a database-load problem: that node\'s keys all miss. Use replicas or a gutter pool, not a rehash onto cold nodes.</li><li><b>Topology</b>: an in-process L1 in front of the shared L2, and a cache per region with invalidations sent across regions.</li></ul><p><b>Where it is used:</b> Facebook routes memcached traffic through <a href="https://engineering.fb.com/2014/09/15/web/introducing-mcrouter-a-memcached-protocol-router-for-scaling-memcached-deployments/">mcrouter</a>. Redis Cluster shards with <a href="https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/">16384 hash slots</a>.</p>', lvl: 'core' },
    { q: '16 · Consistent hashing: why not hash % N?', a: '<ul><li><b>The problem</b>: with <code>hash % N</code>, adding one node changes the owner of about N/(N+1) of all keys. The cache is effectively flushed.</li><li><b>The ring</b>: hash servers and keys onto a circle. A key belongs to the first server clockwise from it. A new server takes over only the keys in its own arc, about 1/(N+1).</li><li><b>Virtual nodes</b>: each server takes many points on the ring, so load is even and a removed server\'s keys spread over all the others.</li><li><b>Hash slots</b> are the alternative: Redis Cluster has a fixed 16384 slots assigned to nodes, and moving a slot is an explicit migration.</li><li><b>Remaining cost</b>: moved keys start cold on their new node, so add nodes one at a time.</li></ul><p><b>Where it is used:</b> Amazon\'s Dynamo partitions data with consistent hashing and virtual nodes (<a href="https://courses.cs.washington.edu/courses/cse444/21wi/papers/p205-decandia.pdf">SOSP 2007</a>). The idea comes from <a href="https://cs.brown.edu/courses/csci2950-u/f09/papers/chash97stoc.pdf">Karger et al., 1997</a>.</p>', fu: 'How many virtual nodes? (Enough that the busiest server is close to the average, often in the low hundreds per server; ketama uses 160. More costs ring memory and lookup time. Try the deep-dive slider.)', lvl: 'core' },
    { q: '17 · Cache consistency: how close to the database can a cache stay?', a: '<ul><li><b>Core problem</b>: the database and the cache are two systems and no transaction covers both. A crash or a reordering between the two writes leaves them different.</li><li><b>What you can promise</b>: most caches are eventually consistent with bounded staleness. A read that must be exact goes to the database and skips the cache.</li><li><b>Techniques</b>: write the database then delete the key; <b>delayed double delete</b> (delete again after the replica lag has passed); versioned or compare-and-set writes; leases.</li><li><b>Backstops</b>: change-log invalidation and a TTL on every key.</li><li><b>Read-your-writes</b>: after a user\'s own write, send their reads to the primary for a short time.</li><li><b>Measure it</b>: sample keys and compare the cache with the database.</li></ul><p><b>Where it is used:</b> Meta\'s <b>Polaris</b> service watches invalidation events and checks every cache replica against the database, reporting mismatches that persist (<a href="https://engineering.fb.com/2022/06/08/core-infra/cache-made-consistent/">Meta, 2022</a>).</p>', lvl: 'core' },
    // Deeper questions that the walkthrough does not already answer.
    { q: 'How can cache-aside leave stale data in the cache?', a: '<p>Reader A misses and reads the old row. Writer B updates the DB and deletes the key. A then <code>set</code>s the old value. The cache is stale until the TTL.</p><p>Fixes: <b>leases</b> (the delete voids A\'s token), <b>versioned sets</b> (reject older versions), and short TTLs as a backstop.</p>', lvl: 'core' },
    { q: 'On a write, why delete the key instead of updating it?', a: '<p>Two concurrent writers can update the DB in one order and the cache in the other, leaving the cache wrong indefinitely. A <b>delete</b> is idempotent and order-independent: the next reader loads whatever the DB holds.</p>', lvl: 'core' },
    { q: 'Redis or Memcached?', a: '<p><b>Memcached</b>: plain key → blob, multithreaded, very predictable. Good for huge simple look-aside caches.</p><p><b>Redis</b>: data structures (hashes, sorted sets, streams), atomic scripts, replication and Redis Cluster. Good when the cache also does counters, leaderboards, rate limits or queues.</p>', lvl: 'core' },
    { q: 'How does Facebook keep caches consistent across regions?', a: '<p>One region holds the MySQL primary; others hold replicas. In every region, <b>mcsqueal</b> reads the local MySQL commit log and sends deletes to local caches, so caches are invalidated only after the local DB has the change.</p><p>For a user\'s own writes from a non-primary region, a <b>remote marker</b> tells reads to go to the primary region until replication catches up.</p>', lvl: 'deep' },
    { q: 'How do Redis Cluster hash slots work?', a: '<p><code>slot = CRC16(key) mod 16384</code>. Each primary owns ranges of slots. Clients cache the slot map; a wrong node replies <code>MOVED</code> (permanent) or <code>ASK</code> (during migration, one request).</p><p>Multi-key operations need all keys in one slot, which <code>{hash tags}</code> provide.</p>', lvl: 'deep' },
    { q: 'A cache shard dies. What happens to the database?', a: '<p>Every key on that shard now misses. If you rehash to survivors, they start cold and the DB absorbs a burst of misses.</p><p>Mitigations: replicas with fast promotion (Redis), or a <b>gutter pool</b> that briefly serves the dead shard\'s keys (Facebook), plus rate-limited DB access.</p>', lvl: 'deep' },
    { q: 'LRU or LFU?', a: '<p><b>LRU</b> keeps recently used items; one big scan can push out the real working set. <b>LFU</b> keeps frequently used items and resists scans, but adapts more slowly when popularity shifts.</p><p>Redis approximates both by sampling keys rather than keeping exact lists.</p>', lvl: 'deep' }
  ],

  code: [
    {
      title: 'Spring Boot 3: @Cacheable + Redis, evict after commit', lang: 'java',
      code: `@Configuration
@EnableCaching
class CacheConfig {
  @Bean
  RedisCacheManager cacheManager(RedisConnectionFactory cf) {
    var json = RedisSerializationContext.SerializationPair
        .fromSerializer(new GenericJackson2JsonRedisSerializer());
    var defaults = RedisCacheConfiguration.defaultCacheConfig()
        .entryTtl(Duration.ofMinutes(10))
        .disableCachingNullValues()
        .serializeValuesWith(json);
    return RedisCacheManager.builder(cf)
        .cacheDefaults(defaults)
        .transactionAware()          // put/evict run after the DB commit
        .build();
  }
}

@Service
class ProductService {
  private final ProductRepository repo;
  ProductService(ProductRepository repo) { this.repo = repo; }

  @Cacheable(cacheNames = "product", key = "#id", sync = true) // one loader per JVM
  public ProductDto get(long id) {
    return repo.findDtoById(id).orElseThrow();
  }

  @Transactional
  @CacheEvict(cacheNames = "product", key = "#cmd.id()")      // delete, not update
  public void update(UpdateProduct cmd) {
    repo.apply(cmd);
  }
}`,
      note: '<code>transactionAware()</code> defers the evict until the transaction commits, so a reader cannot reload the old row in between. <code>sync = true</code> coalesces misses per JVM only.'
    },
    {
      title: 'Python: lease-style get-or-load with Redis', lang: 'python',
      code: `import json
import random
import time
import uuid
import redis

r = redis.Redis()
# release the lease only if we still hold it (it may have expired and moved on)
RELEASE = r.register_script(
    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0")

def get_or_load(key: str, load, ttl: int = 600, lease_ttl: int = 5):
    for _ in range(100):                       # ~5 s max wait
        cached = r.get(key)
        if cached is not None:
            return json.loads(cached)
        token = uuid.uuid4().hex
        # miss: only one caller per key wins the lease and hits the DB
        if r.set(f"lease:{key}", token, nx=True, ex=lease_ttl):
            try:
                value = load()                 # e.g. SELECT ... FROM products WHERE id = %s
                jitter = random.randint(0, ttl // 10)
                r.set(key, json.dumps(value), ex=ttl + jitter)
                return value
            finally:
                RELEASE(keys=[f"lease:{key}"], args=[token])
        time.sleep(0.05)                       # someone else is loading
    return load()                              # lease holder stuck: fall back`,
      note: 'Unlike Facebook\'s leases, this does not stop stale sets; pair it with delete-on-write and the TTL.'
    },
    {
      title: 'Python: probabilistic early expiry (XFetch)', lang: 'python',
      code: `import math
import random
import time

def xfetch(cache, key: str, recompute, ttl: int = 600, beta: float = 1.0):
    """cache stores {'v': value, 'delta': seconds to recompute, 'exp': expiry ts}."""
    e = cache.get(key)
    now = time.time()
    # -log(U) for U in (0, 1] is >= 0; refresh early with rising probability
    early = -e["delta"] * beta * math.log(1.0 - random.random()) if e else 0
    if e is None or now + early >= e["exp"]:
        start = time.time()
        value = recompute()
        delta = time.time() - start
        cache.set(key, {"v": value, "delta": delta, "exp": time.time() + ttl}, ttl)
        return value
    return e["v"]`,
      note: 'Keys that are slow to recompute (large <code>delta</code>) refresh earlier. Usually one reader refreshes before expiry and nobody waits.'
    },
    {
      title: '05 · Java: an LRU cache in O(1)', lang: 'java',
      code: `import java.util.LinkedHashMap;
import java.util.Map;

/** LinkedHashMap = hash map + doubly linked list. accessOrder = true keeps it in LRU order. */
final class LruCache<K, V> {
  private final Map<K, V> map;

  LruCache(int capacity) {
    this.map = new LinkedHashMap<>(16, 0.75f, true) {     // true = order by last access
      @Override
      protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;                          // evict the least recently used
      }
    };
  }

  // get() reorders the list, so even reads need the lock
  synchronized V get(K key) { return map.get(key); }
  synchronized void put(K key, V value) { map.put(key, value); }
  synchronized int size() { return map.size(); }
}`,
      note: 'This is the classic interview answer. In production use <b>Caffeine</b>: it is concurrent, bounded by size or weight, supports TTLs and evicts with Window TinyLFU.'
    },
    {
      title: '12 · Spring Boot 3: stop cache penetration (Bloom filter + negative caching)', lang: 'java',
      code: `@Service
class UserLookup {
  private static final String MISSING = "<none>";            // "not found" marker
  private final StringRedisTemplate redis;
  private final UserRepository repo;
  private final ObjectMapper json;
  private final BloomFilter<Long> knownIds;                   // Guava; loaded with all ids at startup

  UserLookup(StringRedisTemplate redis, UserRepository repo, ObjectMapper json, BloomFilter<Long> knownIds) {
    this.redis = redis; this.repo = repo; this.json = json; this.knownIds = knownIds;
  }

  Optional<UserDto> find(long id) throws JsonProcessingException {
    if (id <= 0 || !knownIds.mightContain(id)) return Optional.empty();   // definitely absent
    String key = "user:" + id;
    String cached = redis.opsForValue().get(key);
    if (MISSING.equals(cached)) return Optional.empty();                  // negative hit
    if (cached != null) return Optional.of(json.readValue(cached, UserDto.class));

    Optional<UserDto> row = repo.findDtoById(id);
    if (row.isEmpty()) {                                                  // Bloom false positive
      redis.opsForValue().set(key, MISSING, Duration.ofSeconds(60));      // short TTL
      return row;
    }
    redis.opsForValue().set(key, json.writeValueAsString(row.get()), Duration.ofMinutes(10));
    return row;
  }

  void onUserCreated(long id) {
    knownIds.put(id);                 // the filter must learn every new id
    redis.delete("user:" + id);       // drop a "not found" marker, if any
  }
}`,
      note: 'The Bloom filter never says "absent" for an id that exists, so it is safe as a first check. With several app servers, each needs the new id: publish it to all of them, or keep the filter in Redis.'
    },
    {
      title: '14 · Spring Boot 3: warm the cache before taking traffic', lang: 'java',
      code: `@Component
class CacheWarmer implements ApplicationRunner {
  private final ProductRepository repo;
  private final CacheManager cacheManager;

  CacheWarmer(ProductRepository repo, CacheManager cacheManager) {
    this.repo = repo; this.cacheManager = cacheManager;
  }

  @Override
  public void run(ApplicationArguments args) {
    Cache cache = Objects.requireNonNull(cacheManager.getCache("product"));
    int page = 0;
    Slice<ProductDto> hot;
    do {                                           // top 5,000 products, 500 at a time
      hot = repo.findMostViewed(PageRequest.of(page++, 500));
      hot.forEach(p -> cache.put(p.id(), p));      // same key as @Cacheable(key = "#id")
    } while (hot.hasNext() && page < 10);
  }
}`,
      note: 'Spring Boot switches readiness to <code>ACCEPTING_TRAFFIC</code> only after every <code>ApplicationRunner</code> has finished, so with a Kubernetes readiness probe on <code>/actuator/health/readiness</code> the pod gets no traffic until the cache is warm. Paging keeps the load on the database bounded.'
    },
    {
      title: '08 · Spring Boot 3: write-behind view counter', lang: 'java',
      code: `@Component
class ViewCounter {
  private static final String PENDING = "views:pending", FLUSHING = "views:flushing";
  private final StringRedisTemplate redis;
  private final JdbcTemplate jdbc;

  ViewCounter(StringRedisTemplate redis, JdbcTemplate jdbc) { this.redis = redis; this.jdbc = jdbc; }

  void recordView(long videoId) {                       // hot path: one Redis call, no DB
    redis.opsForHash().increment(PENDING, Long.toString(videoId), 1);
  }

  @Scheduled(fixedDelay = 5_000)                        // flush every 5 s (needs @EnableScheduling)
  void flush() {
    if (!Boolean.TRUE.equals(redis.hasKey(FLUSHING))) { // no unfinished batch to retry
      if (!Boolean.TRUE.equals(redis.hasKey(PENDING))) return;
      redis.rename(PENDING, FLUSHING);                  // atomic: new views start a fresh hash
    }
    Map<Object, Object> batch = redis.opsForHash().entries(FLUSHING);
    jdbc.batchUpdate("UPDATE videos SET views = views + ? WHERE id = ?",
        batch.entrySet().stream()
            .map(e -> new Object[] { Long.parseLong((String) e.getValue()), Long.parseLong((String) e.getKey()) })
            .toList());
    redis.delete(FLUSHING);
  }
}`,
      note: 'Many views of one video become one <code>UPDATE</code>. Views recorded since the last flush are lost if Redis loses them, and a crash between the <code>UPDATE</code> and the <code>delete</code> counts a batch twice. That is acceptable for view counts, not for money. Run one flusher (for example with ShedLock).'
    }
  ],

  related: ['kv-store', 'cdn', 'multi-region', 'rate-limiter', 'newsfeed', 'leaderboard']
});
