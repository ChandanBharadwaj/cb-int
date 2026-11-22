IA.register({
  track: 'spring',
  slug: 'caching',
  title: 'Caching abstraction',
  tagline: '<code>@Cacheable</code> puts a <b>CacheInterceptor</b> in your bean’s proxy: it builds a key from the arguments, looks it up, and only calls your method on a miss. The annotation is easy. The hard parts are the key, the expiry, what happens when a thousand requests miss at the same moment, and evicting at the right time relative to your transaction.',
  tldr: {
    problem: 'A cache that never hits (self-invocation, keys that differ every call), one that returns the wrong object (two methods sharing a key), one that is stale after an update, or one that turns a TTL expiry into a database spike.',
    model: 'Key = <code>SimpleKeyGenerator</code> over the arguments (not the method name). Hit: the method is skipped. Miss: the method runs and the result is stored, unless <code>unless</code> says otherwise. <code>@CachePut</code> always runs and stores; <code>@CacheEvict</code> removes after the method (by default). It is all proxy-based, per cache name, and the provider (Caffeine, Redis…) decides TTL, size and serialization.',
    hook: '“What happens when a popular key expires under load?” Every concurrent request misses and hits the database: a <b>cache stampede</b>. <code>@Cacheable(sync = true)</code> lets only one thread per JVM load the value; across instances you need refresh-ahead, jittered TTLs or a lock.',
    facts: [
      { v: '@EnableCaching', l: 'required: Boot auto-configures a <code>CacheManager</code> only when caching is enabled' },
      { v: 'no TTL', l: 'the fallback <code>ConcurrentMapCacheManager</code> (no provider on the classpath) never expires or evicts entries' },
      { v: 'Spring 6.1', l: 'parameter names for SpEL keys like <code>#id</code> come only from <code>-parameters</code> bytecode; the old debug-info fallback was removed' }
    ]
  },
  intro: {
    what: 'A cache keeps the result of an expensive call so the next identical call can skip it. Spring’s caching abstraction lets you add this with annotations instead of code: <code>@Cacheable</code> on a method means “look in the cache first”. Where the cache lives (in the JVM with Caffeine, or shared in Redis) is configuration.',
    analogy: { icon: '📝', title: 'A sticky note next to the phone', text: 'You write down the answer to a question people keep asking, so you don’t have to look it up again. The note goes stale if the answer changes and nobody updates it. And if the note falls off at lunchtime, everyone who asks in the next minute runs to the archive at once.' },
    steps: [
      { t: 'Enable caching and pick a provider', d: 'Add <code>@EnableCaching</code> and, for example, Caffeine on the classpath. Boot builds the <code>CacheManager</code>.', code: 'spring.cache.caffeine.spec: maximumSize=10000,expireAfterWrite=10m' },
      { t: 'Annotate a read', d: 'The cache name groups entries; the key comes from the arguments.', code: '@Cacheable("products")\npublic Product find(long id) { … }' },
      { t: 'Hit or miss', d: 'A hit returns the stored value without calling your method. A miss calls it and stores the result.' },
      { t: 'Keep it fresh', d: '<code>@CacheEvict</code> or <code>@CachePut</code> on writes, plus a TTL as a safety net.' },
      { t: 'Measure', d: 'Hit ratio and size via Micrometer (<code>cache.gets</code>, <code>cache.puts</code>, <code>cache.evictions</code>); Caffeine needs <code>recordStats</code>.' }
    ],
    terms: [
      ['cache name', 'A named region (<code>"products"</code>) with its own settings in the provider.'],
      ['key', 'Built from arguments by the <code>KeyGenerator</code>, or from SpEL: <code>key = "#id"</code>.'],
      ['TTL', 'Time to live: how long an entry stays before it expires.'],
      ['stampede', 'Many concurrent misses for the same key loading it at once (also called dog-piling or thundering herd).'],
      ['Caffeine', 'An in-process Java cache with size limits, expiry and refresh.'],
      ['Redis', 'A shared, out-of-process store; values are serialized and sent over the network.']
    ]
  },
  visual: {
    title: 'Hit, miss, stampede and a stale evict',
    caption: 'Each lane is a concurrent request. They pass the proxy’s <code>CacheInterceptor</code>, check the cache, and on a miss call the repository. Press Play, then compare <b>stampede</b> with <b>sync = true</b>, and watch how <b>evict before commit</b> puts an old price back into the cache.'
  },
  gotchas: [
    { trap: 'Two methods, one cache, same key', code: `@Cacheable("users") public User byId(long id) { … }
@Cacheable("users") public UserSummary summary(long id) { … }   // ClassCastException later`, why: 'The default key is built only from the arguments. Both methods produce key <code>42</code> in cache <code>users</code>, so the second call gets the other method’s object.', fix: 'Use separate cache names, or include the method in the key: <code>key = "#root.methodName + \':\' + #id"</code>.' },
    { trap: 'Self-invocation bypasses the cache', code: `public Page<Product> list(…) { return ids.stream().map(this::find)…; }  // never cached
@Cacheable("products") public Product find(long id) { … }`, why: 'The cache interceptor is in the proxy. Calls on <code>this</code> go straight to the target, exactly like <code>@Transactional</code>. See <a href="aop-proxies.html">AOP &amp; proxies</a>.', fix: 'Move the cached method to another bean, or use the <code>CacheManager</code> programmatically for internal calls.' },
    { trap: 'Evicting before the transaction commits', code: `@Transactional
@CacheEvict(cacheNames = "products", key = "#id")
public void reprice(long id, Money p) { repo.updatePrice(id, p); }`, why: 'The evict runs when the method returns, before the outer transaction commits. A concurrent reader can miss, read the <b>old</b> row (not committed yet), and put it back. The cache then serves the old price until the TTL.', fix: 'Make the cache transaction-aware so puts and evicts happen after commit: <code>RedisCacheManager.builder(cf).transactionAware()</code>, or wrap any manager in <code>TransactionAwareCacheManagerProxy</code>. Keep a TTL as a backstop.' },
    { trap: 'Unbounded default cache', why: 'With no provider on the classpath, Boot falls back to <code>ConcurrentMapCacheManager</code>: no size limit, no expiry. A cache keyed by user or query string grows until the heap is full.', fix: 'Always choose a provider with limits: Caffeine with <code>maximumSize</code> and <code>expireAfterWrite</code>, or Redis with <code>time-to-live</code>. Set <code>spring.cache.type</code> explicitly so a missing dependency fails loudly.' },
    { trap: 'Caching mutable objects in-process', why: 'Caffeine stores a reference. A caller that modifies the returned object (sets a field, sorts a list) changes the cached value for everyone.', fix: 'Cache immutable values (records, unmodifiable collections), or copy before returning. Redis is immune because it deserializes a fresh copy each time, at a CPU cost.' },
    { trap: 'SpEL key is null after the Spring 6.1 upgrade', code: `@Cacheable(cacheNames = "products", key = "#id")
// IllegalArgumentException: Null key returned for cache operation …`, why: 'Since Spring Framework 6.1, parameter names are only available if the code was compiled with <code>-parameters</code>. Without it, <code>#id</code> resolves to null.', fix: 'Compile with <code>-parameters</code> (the Boot Maven and Gradle plugins configure it), or use positional names: <code>#p0</code> / <code>#a0</code>.' },
    { trap: 'Redis cache with JDK serialization', why: 'The default <code>RedisCacheConfiguration</code> serializes values with JDK serialization: classes must be <code>Serializable</code>, payloads are opaque and large, and a renamed class breaks every cached entry on deploy.', fix: 'Configure a JSON serializer (<code>GenericJackson2JsonRedisSerializer</code> or a typed <code>Jackson2JsonRedisSerializer</code>) through a <code>RedisCacheConfiguration</code> bean, and add a version to the key prefix so a format change starts a fresh namespace.' }
  ],
  scenarios: [
    { title: 'Database CPU spikes every ten minutes on the dot',
      symptom: 'Postgres CPU jumps to 100% for a few seconds every 10 minutes. Slow-query log: thousands of identical <code>SELECT … FROM pricing_rules</code> within one second.',
      diagnose: `spring.cache.caffeine.spec: expireAfterWrite=10m
# the pricing rules entry is loaded at startup on every pod, so all pods expire it at the same time
# then: 24 pods × ~300 concurrent requests each miss at once`,
      cause: 'A hot key with a fixed TTL, loaded at the same moment on every instance. When it expired, every concurrent request on every pod missed and ran the expensive query: a stampede.',
      fix: 'Refresh before expiry instead of expiring under load: Caffeine’s <code>refreshAfterWrite</code> reloads in the background while serving the old value. Add <code>sync = true</code> so at most one load per pod runs, and jitter the TTL across pods.',
      fixCode: `@Bean
CacheManager cacheManager(PricingRepository repo) {
  var m = new CaffeineCacheManager("pricingRules");
  m.setCaffeine(Caffeine.newBuilder()
      .maximumSize(1_000)
      .refreshAfterWrite(Duration.ofMinutes(5))        // background reload, old value still served
      .expireAfterWrite(Duration.ofMinutes(30))        // hard upper bound
      .recordStats());
  m.setCacheLoader(key -> repo.loadRules((String) key));   // needed for refreshAfterWrite
  return m;
}

@Cacheable(cacheNames = "pricingRules", sync = true)       // one loader per key per JVM
public Rules rules(String region) { return repo.loadRules(region); }` },
    { title: 'Old prices shown for an hour after a price change',
      symptom: 'Merchants update a price; the product page shows the old price for up to an hour (the Redis TTL), but only sometimes, and only for popular products.',
      diagnose: `t0  T1 BEGIN; UPDATE product SET price = 12 WHERE id = 7
t1  T1 @CacheEvict products::7           (method returned, tx not committed yet)
t2  R  GET product 7 → miss → SELECT price → 10 (old, committed) → SET products::7
t3  T1 COMMIT`,
      cause: 'The evict ran before the commit. A concurrent reader repopulated the cache with the pre-update row, which then lived until the TTL. Popular products had readers in that window; unpopular ones didn’t.',
      fix: 'Defer cache writes and evicts until after commit with a transaction-aware cache manager. For extra safety, evict again after commit from an <code>@TransactionalEventListener</code>.',
      fixCode: `@Bean
RedisCacheManager cacheManager(RedisConnectionFactory cf) {
  var json = RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer());
  return RedisCacheManager.builder(cf)
      .cacheDefaults(RedisCacheConfiguration.defaultCacheConfig()
          .entryTtl(Duration.ofMinutes(60))
          .prefixCacheNameWith("v2:")
          .serializeValuesWith(json))
      .transactionAware()                                   // puts/evicts after commit
      .build();
}` },
    { title: 'OutOfMemoryError a week after enabling caching',
      symptom: 'Heap usage grows slowly but steadily; after about a week, <code>OutOfMemoryError</code>. A heap dump shows a huge <code>ConcurrentHashMap</code> inside <code>ConcurrentMapCache "search"</code>.',
      diagnose: `/actuator/caches   → cacheManager: ConcurrentMapCacheManager
@Cacheable("search") public List<Hit> search(String q, int page) { … }   // key: (q, page), unbounded`,
      cause: 'The Caffeine dependency had been removed in a cleanup, so Boot fell back to the simple map-based manager. Every distinct search query and page became a permanent entry.',
      fix: 'Pin the provider with <code>spring.cache.type: caffeine</code> (startup fails if it is missing), set size and expiry, and alert on cache size.',
      fixCode: `spring:
  cache:
    type: caffeine
    cache-names: search, products
    caffeine:
      spec: maximumSize=50000,expireAfterWrite=5m,recordStats`, lang: 'yaml' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Both are called with 42 from a controller, <code>byId</code> first. What does <code>summary(42)</code> return?', code: `@Cacheable("users") public User byId(long id) { … }
@Cacheable("users") public UserSummary summary(long id) { … }`, options: ['A fresh UserSummary', 'null', 'The cached User object, so the caller gets a ClassCastException', 'Startup fails: duplicate cache'], answer: 2, explain: 'The default key is just the argument, <code>42</code>, in cache <code>users</code>. <code>summary</code> finds the <code>User</code> stored by <code>byId</code> and returns it without running.' },
    { kind: 'predict', q: 'How many times does the repository run?', code: `@Service
class ProductService {
  public List<Product> many(List<Long> ids) { return ids.stream().map(this::find).toList(); }
  @Cacheable("products") public Product find(long id) { return repo.load(id); }
}
// controller: service.many(List.of(1L, 1L, 1L)); service.many(List.of(1L));`, options: ['1', '2', '4', '3'], answer: 2, explain: '<code>find</code> is called through <code>this</code>, so the cache interceptor never runs: 3 + 1 = 4 loads. Calling <code>service.find(1)</code> from the controller would be cached.' },
    { kind: 'concept', q: 'What does <code>@Cacheable(sync = true)</code> guarantee?', options: ['One load per key across all instances', 'The cache is updated after the transaction commits', 'Writes are synchronized with the database', 'One load per key at a time within one JVM, if the provider supports it; others wait'], answer: 3, explain: 'It asks the cache to compute the value under a per-key lock (Caffeine’s <code>get(key, loader)</code>). Other JVMs are unaffected, so 20 pods can still mean 20 loads. <code>sync</code> can’t be combined with <code>unless</code>.' },
    { kind: 'predict', q: 'The method returns null. Caffeine via Spring’s <code>CaffeineCacheManager</code> with defaults. Next call with the same key?', code: `@Cacheable("profiles") public Profile find(String id) { return repo.find(id).orElse(null); }`, options: ['Runs the method again: nulls aren’t cached', 'Returns null from the cache without running the method', 'Throws IllegalArgumentException', 'Depends on the TTL'], answer: 1, explain: 'Spring’s cache managers allow null values by default and store a <code>NullValue</code> placeholder, so “not found” is cached too. Use <code>unless = "#result == null"</code> if you don’t want that.' },
    { kind: 'concept', q: 'Where is <code>condition</code> evaluated, and where <code>unless</code>?', options: ['Both after the method', 'Both before', '<code>condition</code> before the call (decides whether to use the cache at all), <code>unless</code> after (can see <code>#result</code>)', '<code>unless</code> before, <code>condition</code> after'], answer: 2, explain: '<code>condition</code> decides whether caching applies to this call; it can’t see the result. <code>unless</code> vetoes storing the result and can use <code>#result</code>.' },
    { kind: 'concept', q: 'Caffeine or Redis for a per-request lookup of feature flags that change a few times a day, on 30 instances?', options: ['Redis only: Caffeine can’t expire', 'A ConcurrentHashMap with no expiry', 'No cache: flags must be read every time', 'Caffeine with a short TTL or refresh, accepting a little staleness per instance'], answer: 3, explain: 'In-process lookups cost nanoseconds and survive a Redis outage. A short TTL (or refresh-after-write) bounds staleness. Redis adds a network hop per request and serialization; use it when entries are large, shared or expensive to compute and must be consistent across instances.' },
    { kind: 'predict', q: 'Which method runs every time it is called?', options: ['@CachePut', '@Cacheable', '@CacheEvict(beforeInvocation = true) only', 'None of them'], answer: 0, explain: '<code>@CachePut</code> always executes the method and stores its result. It is for writes that return the new state. Don’t put <code>@Cacheable</code> and <code>@CachePut</code> on the same method.' }
  ],
  interview: [
    { q: 'How does @Cacheable work under the hood?', a: '<p><code>@EnableCaching</code> registers a caching advisor; beans with caching annotations get a proxy whose <code>CacheInterceptor</code> runs around the method. It resolves the cache(s) by name from the <code>CacheManager</code>, builds the key with SpEL or the <code>KeyGenerator</code>, evaluates <code>condition</code>, looks up the key, and on a hit returns the value without invoking the target. On a miss it invokes the method, evaluates <code>unless</code> and puts the result.</p>', lvl: 'core' },
    { q: 'What is the default key?', a: '<p><code>SimpleKeyGenerator</code>: no arguments → <code>SimpleKey.EMPTY</code>; one argument → that argument itself; several → a <code>SimpleKey</code> of all of them. The method name and class are <b>not</b> part of it, so two methods sharing a cache name collide. Key objects need correct <code>equals</code>/<code>hashCode</code> (records are ideal) and, for Redis, a stable string form.</p>', lvl: 'core' },
    { q: 'Caffeine vs Redis?', a: '<ul><li><b>Caffeine</b>: in-process, nanosecond reads, no serialization, size-based eviction (W-TinyLFU), expiry and refresh. Each instance has its own copy: inconsistent across instances and empty after a restart.</li><li><b>Redis</b>: shared across instances, survives restarts, one place to evict; costs a network round trip and serialization per access, and is another system to run.</li></ul><p>Two-level caching (Caffeine in front of Redis) is possible but needs invalidation messages to keep local copies fresh.</p>', lvl: 'core' },
    { q: 'How do you prevent a cache stampede?', a: '<ul><li><code>sync = true</code>: one loader per key per JVM.</li><li>Refresh-ahead: Caffeine <code>refreshAfterWrite</code> reloads in the background and keeps serving the old value.</li><li>Jitter TTLs so instances and keys don’t expire together.</li><li>Probabilistic early expiration, or a short distributed lock (Redis <code>SET NX PX</code>) around the load across instances.</li><li>Serve stale on error (keep a longer hard TTL).</li></ul>', lvl: 'deep' },
    { q: 'How do you keep the cache consistent with the database?', a: '<p>Cache-aside with evict-on-write is the usual default: update the DB, then evict, <b>after commit</b> (transaction-aware cache manager or an after-commit event listener). Evicting is safer than <code>@CachePut</code> with a value built inside the transaction. Keep a TTL as a backstop for missed invalidations. Across instances with Caffeine, publish invalidation events (Redis pub/sub, Kafka) or accept bounded staleness.</p>', lvl: 'deep' },
    { q: 'What are condition, unless and sync for?', a: '<p><code>condition</code> (SpEL, before the call): use the cache only for some arguments, e.g. <code>#id &gt; 0</code>. <code>unless</code> (after the call): don’t store some results, e.g. <code>#result == null</code> or <code>#result.isEmpty()</code>. <code>sync</code>: compute under a per-key lock; it allows only one cache and no <code>unless</code>.</p>', lvl: 'core' },
    { q: 'What do you monitor for a cache?', a: '<p>Hit ratio (and how it changes after deploys), size, evictions (size-based evictions mean the cache is too small), load time and load failures. Boot’s Actuator binds metrics for caches known to the <code>CacheManager</code> at startup (<code>cache.gets{result=hit|miss}</code>, <code>cache.puts</code>, <code>cache.evictions</code>); for Caffeine enable <code>recordStats</code>. <code>/actuator/caches</code> lists them and can clear one.</p>', lvl: 'core' },
    { q: 'Can you cache async or reactive methods?', a: '<p>Since Spring Framework 6.1, yes: <code>@Cacheable</code> on methods returning <code>CompletableFuture</code>, <code>Mono</code> or <code>Flux</code> caches the eventual value, with a provider that supports it (Caffeine via <code>CaffeineCacheManager.setAsyncCacheMode(true)</code>). Before 6.1, caching a <code>Mono</code> stored the publisher object, not its result.</p>', lvl: 'deep' },
    { q: 'What should never be cached?', a: '<p>Data that must be exact right now (balances used for decisions, stock at checkout), per-user data in a shared cache without the user in the key, objects holding resources (entities attached to a persistence context, streams), and anything security-sensitive whose revocation must be immediate. And don’t cache something cheaper to compute than to look up.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Cache-aside service', lang: 'java', code: `@Configuration
@EnableCaching
class CacheConfig { }

@Service
class ProductService {
  private final ProductRepository repo;
  ProductService(ProductRepository repo) { this.repo = repo; }

  @Cacheable(cacheNames = "products", key = "#id", unless = "#result == null")
  public ProductView find(long id) { return repo.findView(id).orElse(null); }   // record: immutable

  @Transactional
  @CacheEvict(cacheNames = "products", key = "#id")     // transaction-aware manager: after commit
  public void reprice(long id, BigDecimal price) { repo.updatePrice(id, price); }

  @CacheEvict(cacheNames = "products", allEntries = true)
  public void evictAll() { }                            // call it from another bean (e.g. an admin endpoint)
}` },
    { title: 'Caffeine via properties', lang: 'yaml', code: `spring:
  cache:
    type: caffeine                     # fail fast if Caffeine is missing
    cache-names: products, pricingRules
    caffeine:
      spec: maximumSize=20000,expireAfterWrite=10m,recordStats
management:
  endpoints.web.exposure.include: health, caches, metrics` },
    { title: 'Per-cache TTLs in Redis', lang: 'java', code: `@Bean
RedisCacheManagerBuilderCustomizer redisCaches() {
  var json = RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer());
  var base = RedisCacheConfiguration.defaultCacheConfig()
      .serializeValuesWith(json)
      .prefixCacheNameWith("shop:v3:")
      .disableCachingNullValues();
  return b -> b.cacheDefaults(base.entryTtl(Duration.ofMinutes(10)))
      .withCacheConfiguration("products", base.entryTtl(Duration.ofMinutes(60)))
      .withCacheConfiguration("sessions", base.entryTtl(Duration.ofMinutes(5)))
      .transactionAware();
}`, note: 'Keys look like <code>shop:v3:products::42</code>. Bumping the version prefix starts a fresh namespace after a format change.' }
  ]
});
