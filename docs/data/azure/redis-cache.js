IA.register({
  track: 'azure',
  slug: 'redis-cache',
  title: 'Azure Cache for Redis',
  tagline: 'Redis on Azure is a <b>managed, in-memory key-value store</b> you put beside Postgres or Cosmos DB to absorb reads. The tier decides replication, clustering and features. The <b>eviction policy</b> decides what happens when memory is full. <b>Cache-aside</b> in Spring is three lines of annotations and one hard question: when is the cached value wrong?',
  lang: 'java',
  tldr: {
    problem: 'Caches fail in quiet ways: keys without TTLs fill memory until writes fail, a popular key expires and 500 requests hit the database at once, a multi-key command breaks the day you enable clustering, and a failover drops every connection.',
    model: '<b>Cache-aside</b>: read the cache; on a miss, read the database and write the value back with a TTL; on an update, write the database and <b>delete</b> the key. Redis holds everything in memory, so when it reaches <code>maxmemory</code> the <b>eviction policy</b> chooses victims. A <b>cluster</b> splits the key space into 16,384 hash slots across shards, each with its own replica.',
    hook: '“Why did Redis start returning OOM errors when the policy is LRU?” The Azure default is <code>volatile-lru</code>: only keys <b>with a TTL</b> can be evicted. Once memory is full of keys without a TTL, writes fail.',
    facts: [
      { v: '16,384', l: 'hash slots in a Redis cluster: slot = CRC16(key) mod 16384, or of the <code>{hash tag}</code> part when there is one' },
      { v: 'volatile-lru', l: 'the default <code>maxmemory-policy</code> on Azure Cache for Redis: least recently used, among keys that have an expiry' },
      { v: '6380', l: 'TLS port on Azure Cache for Redis (the non-TLS port 6379 is disabled by default); Azure Managed Redis uses port 10000' }
    ]
  },
  intro: {
    what: '<b>Redis</b> keeps data in RAM, so reads and writes take well under a millisecond inside the server. Azure offers it as a managed service: <b>Azure Cache for Redis</b> (Basic, Standard, Premium, and Enterprise tiers), and the newer <b>Azure Managed Redis</b>, built on Redis Enterprise, which Microsoft positions as its successor. Microsoft has announced retirement timelines for the older tiers, so check the current dates on Microsoft Learn before starting something new. Spring apps mostly use Redis as a <b>cache</b> in front of a database, for <b>sessions</b>, and for <b>rate limits</b> or locks.',
    analogy: { icon: '🗒️', title: 'Sticky notes on the monitor', text: 'Looking a number up in the filing cabinet (the database) takes a walk. So you write the answer on a sticky note on your monitor (the cache), with a date after which you won’t trust it (TTL). When the monitor is full, you peel off the note you haven’t looked at for longest (LRU). If someone changes the number in the cabinet, you tear up the note so the next look goes back to the cabinet.' },
    steps: [
      { t: 'Create a cache with the right tier', d: 'Basic for dev only (one node, no SLA). Standard or higher for production, so there is a replica.', lang: 'bash', code: 'az redis create -g rg-shop-prod -n redis-catalog -l westeurope \\\n  --sku Standard --vm-size C1 --minimum-tls-version 1.2' },
      { t: 'Connect over TLS with Entra, not an access key', d: 'Spring Cloud Azure adds the token handling to Lettuce.', lang: 'yaml', code: 'spring:\n  data:\n    redis:\n      host: redis-catalog.redis.cache.windows.net\n      port: 6380\n      ssl.enabled: true\n      azure.passwordless-enabled: true' },
      { t: 'Turn on Spring’s cache abstraction', d: '<code>@EnableCaching</code>, a <code>RedisCacheManager</code> with a TTL, and <code>@Cacheable</code> on the read.' },
      { t: 'Evict on write', d: 'Update the database, then <code>@CacheEvict</code> the key. Deleting is safer than writing the new value into the cache.' }
    ],
    terms: [
      ['cache-aside', 'The app reads the cache, falls back to the database on a miss, and fills the cache itself. Also called lazy loading.'],
      ['TTL', 'Time to live: Redis deletes the key after this many seconds (<code>EXPIRE</code>, <code>SET … EX</code>).'],
      ['maxmemory-policy', 'What Redis does when memory is full: evict by LRU or LFU among all keys or only keys with a TTL, evict random keys, or refuse writes (<code>noeviction</code>).'],
      ['shard / hash slot', 'In a cluster, each shard owns a range of the 16,384 slots. A key’s slot comes from CRC16 of the key.'],
      ['hash tag', 'The part of a key inside <code>{…}</code>. Only that part is hashed, so <code>{cart:42}:items</code> and <code>{cart:42}:total</code> share a slot.'],
      ['cache stampede', 'Many requests miss the same key at once (for example when it expires) and all hit the database together.']
    ]
  },
  visual: {
    title: 'Cache-aside, eviction and clustering',
    caption: 'Pick a mechanism and press Play. <b>Cache-aside</b>: a miss, a hit, an update with eviction, then a stampede. <b>Eviction</b>: memory fills and <code>volatile-lru</code> picks victims until only keys without TTLs are left. <b>Cluster</b>: keys hash to slots on three shards, a multi-key command fails with CROSSSLOT, hash tags fix it, and a shard fails over.'
  },
  gotchas: [
    { trap: 'Keys without a TTL under volatile-lru', code: `127.0.0.1:6380> SET session:abc "{...}"          # no EX → never evictable under volatile-*
(error) OOM command not allowed when used memory > 'maxmemory'.`, lang: 'bash', why: 'The <code>volatile-*</code> policies only evict keys that have an expiry. Spring’s default <code>RedisCacheConfiguration</code> has <b>no TTL</b>, so every cache entry is permanent unless you set one.', fix: 'Always set <code>entryTtl</code> in the cache configuration. Or choose <code>allkeys-lru</code> / <code>allkeys-lfu</code> when the instance is a pure cache. Use <code>noeviction</code> only for data you can’t lose, and alert on used memory.' },
    { trap: 'Cache stampede when a hot key expires', why: 'When a popular key expires, every concurrent request misses and queries the database. <code>@Cacheable(sync = true)</code> serialises loads only <b>within one JVM</b>, so 20 pods still send 20 queries (or far more without it).', fix: 'Use <code>sync = true</code>, add random jitter to TTLs so keys don’t expire together, and for very hot keys refresh ahead of expiry or use a short distributed lock (<code>SET lock:k NX PX 5000</code>).' },
    { trap: 'Writing the new value into the cache on update', why: 'Two concurrent updates can write the database in one order and the cache in the other, leaving a stale value until the TTL expires. With a transaction that later rolls back, the cache can even hold a value the database never committed.', fix: 'Write the database, then <b>delete</b> the key (<code>@CacheEvict</code>) after commit. The next read reloads it. Keep TTLs as the safety net.' },
    { trap: 'Multi-key commands after enabling clustering', code: `MGET cart:42:items cart:42:total
(error) CROSSSLOT Keys in request don't hash to the same slot`, lang: 'bash', why: 'In a cluster, multi-key operations (<code>MGET</code>, transactions, Lua scripts, <code>RENAME</code>) need all keys in the <b>same slot</b>. Code that worked on a single node fails after scaling out.', fix: 'Use hash tags (<code>{cart:42}:items</code>, <code>{cart:42}:total</code>) for keys that are used together. Use a cluster-aware client (Lettuce supports it), or the proxy-based Enterprise cluster policy on Azure Managed Redis.' },
    { trap: 'No reconnect plan for failover and patching', why: 'Standard and higher tiers fail over to the replica during maintenance and failures. Connections drop, and a cluster client with a stale topology keeps talking to the old primary.', fix: 'Lettuce reconnects automatically. For clusters, enable adaptive and periodic topology refresh. Configure a maintenance window, use short command timeouts, and treat cache errors as misses (fall back to the database) instead of failing the request.' },
    { trap: 'Running KEYS or big values in production', why: 'Redis executes commands on a single main thread. <code>KEYS *</code> on millions of keys, or a 50 MB value, blocks everyone, and server load spikes to 100%.', fix: 'Use <code>SCAN</code> with a cursor, keep values small (split large objects), and watch the <b>Server Load</b> metric and slow log. Redis isn’t a document store.' }
  ],
  scenarios: [
    { title: 'Checkout fails with OOM after a marketing campaign',
      symptom: 'Writes to Redis fail with <code>OOM command not allowed</code>. Product pages still load because reads work. Used memory is at 100%.',
      diagnose: `redis-cli -h redis-catalog.redis.cache.windows.net -p 6380 --tls -a "$TOKEN" INFO keyspace
# db0:keys=4120034,expires=12011   ← almost no key has a TTL
CONFIG GET maxmemory-policy           # volatile-lru`,
      cause: 'A new “recently viewed” feature wrote <code>viewed:{user}</code> lists without expiry. Under <code>volatile-lru</code> nothing was evictable once they filled memory.',
      fix: 'Add TTLs to the new keys (and backfill <code>EXPIRE</code> with a SCAN loop), set an <code>entryTtl</code> in every Spring cache, and alert at 80% used memory. If this instance is purely a cache, switch to <code>allkeys-lru</code>.',
      fixCode: `az redis update -g rg-shop-prod -n redis-catalog \\
  --set "redisConfiguration.maxmemory-policy"="allkeys-lru"`, lang: 'bash' },
    { title: 'Database CPU spikes every 10 minutes on the dot',
      symptom: 'Postgres CPU jumps to 90% for a few seconds every 10 minutes. The app’s p99 latency spikes at the same time.',
      diagnose: `// RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofMinutes(10))
// the home-page cache is warmed at startup → every key expires at the same moment`,
      cause: 'All hot keys were loaded together at deploy time with the same fixed TTL, so they expired together. Each of 30 pods recomputed them at once: a <b>stampede</b>.',
      fix: 'Add jitter to the TTL, enable <code>sync = true</code> on the hot caches, and refresh the heaviest keys in the background before they expire.',
      fixCode: `// Spring Data Redis 3.2+ (Boot 3.2+): entryTtl accepts a TtlFunction
@Bean RedisCacheManagerBuilderCustomizer ttlWithJitter() {
  return b -> b.cacheDefaults(RedisCacheConfiguration.defaultCacheConfig()
      .entryTtl((key, value) -> Duration.ofMinutes(10).plusSeconds(ThreadLocalRandom.current().nextInt(120))));
}`, lang: 'java' },
    { title: 'Timeouts after scaling to a clustered tier',
      symptom: 'After moving to a clustered cache, a few requests fail with <code>CROSSSLOT</code>, and after a shard failover some pods log <code>MOVED</code> redirections and timeouts for minutes.',
      diagnose: `// Lettuce client created as standalone, not cluster-aware; no topology refresh configured
logging.level.io.lettuce.core.cluster=DEBUG`,
      cause: 'The cart code used <code>MGET</code> on keys in different slots, and the client didn’t refresh its slot map after the failover.',
      fix: 'Rename related keys with a hash tag and enable Lettuce’s adaptive topology refresh.',
      fixCode: `spring:
  data:
    redis:
      cluster:
        nodes: redis-catalog.redis.cache.windows.net:6380
      lettuce:
        cluster:
          refresh:
            adaptive: true
            period: 30s`, lang: 'yaml' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'Memory is full. <code>maxmemory-policy</code> is <code>volatile-lru</code>. Every key was written without a TTL. What happens on the next <code>SET</code>?', options: ['The least recently used key is evicted', 'A random key is evicted', 'The write fails with an OOM error', 'Redis grows past maxmemory'], answer: 2, explain: '<code>volatile-*</code> policies only consider keys with an expiry. With none, there is nothing to evict, so writes fail with OOM.' },
    { kind: 'predict', q: 'In a 3-shard cluster, which pair of keys is guaranteed to be in the same slot?', options: ['cart:42:items and cart:42:total', '{cart:42}:items and {cart:42}:total', 'cart:42 and cart:43', 'Any two keys with the same prefix'], answer: 1, explain: 'With a hash tag only the text inside <code>{}</code> is hashed, so both keys hash “cart:42” to slot 15749. Without tags, <code>cart:42:items</code> (slot 6635) and <code>cart:42:total</code> (slot 11155) land on different shards.' },
    { kind: 'scenario', q: 'A product’s price is updated in Postgres. What should the service do with the cache?', options: ['Write the new price into the cache before the DB commit', 'Delete the cached key after the DB commit', 'Do nothing and wait for the TTL', 'Flush the whole cache'], answer: 1, explain: 'Delete after commit (cache-aside invalidation). Writing the value races with other writers and can cache uncommitted data. Waiting for the TTL serves stale prices.' },
    { kind: 'scenario', q: 'Twenty pods use <code>@Cacheable(value = "home", sync = true)</code>. The hot key expires. How many database loads can happen at once?', options: ['1', 'Up to 20, one per JVM', '0', 'Unlimited'], answer: 1, explain: '<code>sync = true</code> locks inside one cache manager in one JVM. Across 20 pods you can still get up to 20 concurrent loads; use jitter, refresh-ahead or a distributed lock for the hottest keys.' },
    { kind: 'scenario', q: 'Which tier would you avoid for production because it has a single node and no SLA?', options: ['Basic', 'Standard', 'Premium', 'Azure Managed Redis Balanced'], answer: 0, explain: 'Basic runs one node with no replica. Any restart or patch loses the data and the service is unavailable. Use Standard or higher, or Azure Managed Redis, for production.' },
    { kind: 'scenario', q: 'You need Redis JSON and search modules, plus active-active geo-replication. What do you look at?', options: ['Azure Cache for Redis Standard', 'Azure Cache for Redis Premium', 'Azure Managed Redis (or the Enterprise tiers it succeeds)', 'Basic with persistence'], answer: 2, explain: 'Modules such as RediSearch and RedisJSON and active geo-replication come from Redis Enterprise, which is what Azure Managed Redis and the Enterprise tiers are built on. Premium offers passive geo-replication only.' },
    { kind: 'scenario', q: 'A Spring service treats a Redis timeout as a failed request and returns 500. During a cache failover, what is better?', options: ['Keep returning 500', 'Treat cache errors as misses: log, skip the cache and read the database, with a short timeout and a circuit breaker', 'Retry the cache forever', 'Disable TLS for speed'], answer: 1, explain: 'A cache should degrade to “slower”, not to “down”. A <code>CacheErrorHandler</code> can log and fall through, while a circuit breaker stops the database being flooded if the cache is out for long.' }
  ],
  interview: [
    { q: 'Compare the Azure Cache for Redis tiers and Azure Managed Redis.', a: '<ul><li><b>Basic</b>: one node, no SLA; dev and test only.</li><li><b>Standard</b>: primary + replica with automatic failover.</li><li><b>Premium</b>: adds clustering, persistence (RDB/AOF), VNet injection, passive geo-replication and zone redundancy.</li><li><b>Enterprise / Enterprise Flash</b>: Redis Enterprise with modules and active geo-replication.</li><li><b>Azure Managed Redis</b>: the Redis Enterprise-based successor, with memory-, compute- and flash-optimised options.</li></ul><p>Microsoft has announced retirement timelines for the older offerings, so for new work check Azure Managed Redis first.</p>', lvl: 'core' },
    { q: 'Explain cache-aside and its consistency risks.', a: '<p>Read: get from the cache; on a miss load from the database and <code>SET</code> with a TTL. Write: update the database, then delete the key. Risks: a stale read between commit and delete, a race where a slow reader re-caches an old value just after the delete, and a stampede on expiry. TTLs bound the staleness. For stricter needs, use delayed double delete or versioned values, or keep that data out of the cache.</p>', lvl: 'core' },
    { q: 'Walk through the eviction policies.', a: '<p><code>noeviction</code> (writes fail when full), <code>allkeys-lru</code> / <code>allkeys-lfu</code> (any key), <code>volatile-lru</code> / <code>volatile-lfu</code> / <code>volatile-ttl</code> (only keys with an expiry), and <code>allkeys-random</code> / <code>volatile-random</code>. LRU and LFU are approximated by sampling. For a pure cache, <code>allkeys-lru</code> or <code>allkeys-lfu</code> is usually right. For mixed cache and session data, keep <code>volatile-lru</code> and make sure cache keys have TTLs.</p>', lvl: 'core' },
    { q: 'How does Redis clustering distribute keys, and what does it mean for application code?', a: '<p>The key space is split into 16,384 slots: CRC16 of the key (or of its hash tag) mod 16384. Each shard owns a range of slots and has its own replica. Clients follow <code>MOVED</code> and <code>ASK</code> redirects and cache the slot map. Multi-key commands, transactions and Lua scripts must stay in one slot, so you design keys with hash tags. Scaling out moves slots between shards online.</p>', lvl: 'deep' },
    { q: 'How do you configure Spring Boot caching with Redis properly?', a: '<p><code>@EnableCaching</code>, a <code>RedisCacheManager</code> with <code>entryTtl</code> per cache, a JSON serializer (<code>GenericJackson2JsonRedisSerializer</code>) instead of JDK serialization, and a key prefix per app and version, so a deploy with a changed DTO doesn’t read incompatible entries. Use <code>@Cacheable</code> for reads, <code>@CacheEvict</code> on writes, and a <code>CacheErrorHandler</code> that logs and falls through.</p>', fu: 'Why not JDK serialization? (It is tied to class versions, is larger, and deserializing untrusted bytes is a security risk.)', lvl: 'core' },
    { q: 'How do you secure Azure Cache for Redis?', a: '<p>Use TLS only (port 6380), Entra authentication with data access policies instead of access keys (then disable access-key auth), a private endpoint with <code>privatelink.redis.cache.windows.net</code>, and public network access disabled. Rotate access keys if any remain, and keep them in <a href="key-vault.html">Key Vault</a>, not in app settings.</p>', lvl: 'core' },
    { q: 'What would you store in Redis besides a cache?', a: '<p>HTTP sessions (Spring Session Data Redis), rate-limit counters (<code>INCR</code> + <code>EXPIRE</code>), short distributed locks with a TTL, leaderboards (sorted sets), idempotency keys, and for AI apps semantic-cache entries or short-term conversation memory. Not the system of record: persistence options exist, but Redis is designed to lose data on failover edge cases.</p>', lvl: 'core' },
    { q: 'What happens to clients during a failover or patch?', a: '<p>The replica is promoted and connections to the old primary drop. In a cluster the slot map changes. Clients must reconnect and refresh their topology. Writes acknowledged by the primary but not yet replicated can be lost, because replication is asynchronous. Plan with short timeouts, retries, topology refresh and a maintenance window, and fall back to the database when the cache is unavailable.</p>', lvl: 'deep' },
    { q: 'How would you build a semantic cache for LLM calls on Redis?', a: '<p>Embed the normalised prompt, then search a vector index in Redis (RediSearch, available with Azure Managed Redis or the Enterprise tiers) for a cached prompt above a similarity threshold, and return its answer on a hit. Include the model, system prompt version and tool context in the key, so changes invalidate the cache. Set TTLs, and never cache user-specific answers across users.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Spring Boot 3.x cache configuration', lang: 'java', code: `@Configuration
@EnableCaching
class CacheConfig {
  @Bean
  RedisCacheManagerBuilderCustomizer caches() {
    var json = RedisSerializationContext.SerializationPair
        .fromSerializer(new GenericJackson2JsonRedisSerializer());
    var base = RedisCacheConfiguration.defaultCacheConfig()
        .serializeValuesWith(json)
        .prefixCacheNameWith("catalog:v3:")          // bump on incompatible DTO changes
        .entryTtl(Duration.ofMinutes(10));           // never leave the default (no TTL)
    return b -> b.cacheDefaults(base)
        .withCacheConfiguration("product", base.entryTtl(Duration.ofMinutes(30)));
  }
}

@Service
class ProductService {
  @Cacheable(value = "product", key = "#id", sync = true)
  public ProductDto get(long id) { return repo.findDto(id).orElseThrow(); }

  @Transactional
  @CacheEvict(value = "product", key = "#cmd.id")    // evicts after the method returns
  public void updatePrice(UpdatePrice cmd) { repo.updatePrice(cmd.id(), cmd.price()); }
}`, note: '<code>@CacheEvict</code> runs when the method returns. With <code>transactionAware()</code> on the cache manager the eviction is deferred until the transaction commits.' },
    { title: 'Treat cache failures as misses', lang: 'java', code: `@Configuration
class CacheErrors implements CachingConfigurer {
  private static final Logger log = LoggerFactory.getLogger(CacheErrors.class);

  @Override
  public CacheErrorHandler errorHandler() {
    return new SimpleCacheErrorHandler() {
      @Override public void handleCacheGetError(RuntimeException e, Cache c, Object key) {
        log.warn("cache get failed for {}::{}, falling back to DB", c.getName(), key, e);
      }
      @Override public void handleCachePutError(RuntimeException e, Cache c, Object key, Object v) {
        log.warn("cache put failed for {}::{}", c.getName(), key, e);
      }
    };
  }
}`, note: 'Pair this with a short Lettuce command timeout (for example <code>spring.data.redis.timeout=500ms</code>) so a sick cache doesn’t add seconds to every request.' },
    { title: 'Passwordless Redis with Spring Cloud Azure', lang: 'yaml', code: `# dependency: com.azure.spring:spring-cloud-azure-starter-data-redis-lettuce
spring:
  data:
    redis:
      host: redis-catalog.redis.cache.windows.net
      port: 6380
      ssl:
        enabled: true
      timeout: 500ms
      azure:
        passwordless-enabled: true     # Entra token instead of an access key
  cloud:
    azure:
      credential:
        managed-identity-enabled: true
        client-id: \${AZURE_CLIENT_ID}`, note: 'The identity needs a Redis <b>data access policy</b> assignment (for example “Data Contributor”) on the cache; Azure RBAC roles on the resource alone are not enough.' },
    { title: 'CLI: create, configure, inspect', lang: 'bash', code: `az redis create -g rg-shop-prod -n redis-catalog -l westeurope \\
  --sku Premium --vm-size P1 --shard-count 3 --zones 1 2 3 \\
  --minimum-tls-version 1.2 --redis-configuration '{"maxmemory-policy":"allkeys-lru"}'

# Entra access for the app's managed identity
az redis access-policy-assignment create -g rg-shop-prod -n redis-catalog \\
  --access-policy-name "Data Contributor" --object-id $APP_PRINCIPAL_ID \\
  --object-id-alias catalog-api --policy-assignment-name catalog-api

# in redis-cli: SCAN, never KEYS
redis-cli --tls -h redis-catalog.redis.cache.windows.net -p 6380 --scan --pattern 'catalog:v3:*' | head` }
  ]
});
