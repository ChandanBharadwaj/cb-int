/* Interview Atlas catalog: tracks → modules → topics.
   status: 'done' (page live) | 'todo'. depth: F fundamentals · D deep · X internals + edge cases */
window.IA_CATALOG = {
  tracks: [
    {
      id: 'sql', name: 'SQL & Postgres', icon: '⛁', status: 'live',
      lang: 'sql',
      index: { hero: 'SQL &amp; Postgres, <span class="grad">fundamentals to internals.</span>', search: 'Search: lateral, MVCC, keyset…', desc: 'SQL and Postgres from fundamentals to internals, with animations, a browser Postgres playground and tricky puzzles.' },
      text: { metaDesc: 'Animated visual, Postgres playground, gotchas, real-world incidents, puzzles and interview questions.', footer: 'Interview Atlas · Postgres 16+ semantics unless noted.' },
      blurb: 'From logical query order to MVCC, planner internals and choosing the right database as an architect. Postgres semantics throughout.',
      modules: [
        { id: 'M0', name: 'Intro: data & why SQL', topics: [
          { n: '0a', slug: 'data-in-applications', title: 'How applications see data', depth: 'F', status: 'done' },
          { n: '0b', slug: 'types-of-data', title: 'Structured vs semi vs unstructured', depth: 'F', status: 'done' },
          { n: '0c', slug: 'transactional-data', title: 'Transactional vs analytical vs event data', depth: 'F', status: 'done' },
          { n: '0d', slug: 'why-sql', title: 'What SQL is & why it lasts', depth: 'F', status: 'done' }]},
        { id: 'M1', name: 'Query foundations', topics: [
          { n: '1', slug: 'logical-query-order', title: 'Logical query processing order', depth: 'F', status: 'done' },
          { n: '2', slug: 'null-three-valued-logic', title: 'NULL & three-valued logic', depth: 'D', status: 'done' },
          { n: '3', slug: 'data-types-that-bite', title: 'Data types that bite', depth: 'D', status: 'done' },
          { n: '4', slug: 'constraints', title: 'Constraints, deferrable & exclusion', depth: 'D', status: 'done' }]},
        { id: 'M2', name: 'Joins & set logic', topics: [
          { n: '5', slug: 'joins', title: 'Joins, visualized', depth: 'F', status: 'done' },
          { n: '6', slug: 'semi-anti-joins', title: 'Semi & anti joins (EXISTS / NOT IN)', depth: 'D', status: 'done' },
          { n: '7', slug: 'lateral-top-n', title: 'LATERAL & top-N per group', depth: 'D', status: 'done' },
          { n: '8', slug: 'set-operations', title: 'UNION / INTERSECT / EXCEPT', depth: 'F', status: 'done' },
          { n: '9', slug: 'join-fan-out', title: 'Join fan-out & double counting', depth: 'D', status: 'done' }]},
        { id: 'M3', name: 'Aggregation & analytics', topics: [
          { n: '10', slug: 'grouping', title: 'GROUP BY, FILTER, ROLLUP/CUBE', depth: 'D', status: 'done' },
          { n: '11', slug: 'window-ranking', title: 'Window functions I: ranking', depth: 'D', status: 'done' },
          { n: '12', slug: 'window-frames', title: 'Window functions II: frames', depth: 'X', status: 'done' },
          { n: '13', slug: 'gaps-islands', title: 'Gaps & islands, sessionization', depth: 'X', status: 'done' },
          { n: '14', slug: 'pivot-percentiles', title: 'Pivots & percentiles', depth: 'D', status: 'done' }]},
        { id: 'M4', name: 'Advanced querying', topics: [
          { n: '15', slug: 'ctes', title: 'CTEs: materialized vs inlined', depth: 'D', status: 'done' },
          { n: '16', slug: 'recursive-ctes', title: 'Recursive CTEs & graphs', depth: 'X', status: 'done' },
          { n: '17', slug: 'subqueries', title: 'Correlated subqueries', depth: 'D', status: 'done' },
          { n: '18', slug: 'upsert-merge', title: 'Upsert, MERGE, RETURNING', depth: 'D', status: 'done' },
          { n: '19', slug: 'pagination', title: 'OFFSET vs keyset pagination', depth: 'D', status: 'done' },
          { n: '20', slug: 'latest-per-key', title: 'Dedup & latest row per key', depth: 'D', status: 'done' }]},
        { id: 'M5', name: 'Indexes & storage', topics: [
          { n: '21', slug: 'heap-pages-toast', title: 'Heap pages, tuples & TOAST', depth: 'X', status: 'done' },
          { n: '22', slug: 'btree-internals', title: 'B-tree internals & covering indexes', depth: 'X', status: 'done' },
          { n: '23', slug: 'index-types', title: 'GIN, GiST, BRIN, partial, expression', depth: 'D', status: 'done' },
          { n: '24', slug: 'index-not-used', title: 'Why isn’t my index used?', depth: 'X', status: 'done' }]},
        { id: 'M6', name: 'Planning & performance', topics: [
          { n: '25', slug: 'explain', title: 'Reading EXPLAIN ANALYZE', depth: 'X', status: 'done' },
          { n: '26', slug: 'join-algorithms', title: 'Nested loop, hash & merge joins', depth: 'X', status: 'done' },
          { n: '27', slug: 'statistics', title: 'Statistics & bad estimates', depth: 'X', status: 'done' },
          { n: '28', slug: 'partitioning', title: 'Partitioning & pruning', depth: 'D', status: 'done' }]},
        { id: 'M7', name: 'Transactions & concurrency', topics: [
          { n: '29', slug: 'isolation-levels', title: 'Isolation levels & anomalies', depth: 'X', status: 'done' },
          { n: '30', slug: 'mvcc-vacuum', title: 'MVCC, VACUUM, bloat, wraparound', depth: 'X', status: 'done' },
          { n: '31', slug: 'locking', title: 'Locks, SKIP LOCKED, lock queues', depth: 'X', status: 'done' },
          { n: '32', slug: 'deadlocks-optimistic', title: 'Deadlocks & optimistic locking', depth: 'X', status: 'done' }]},
        { id: 'M8', name: 'Production & design', topics: [
          { n: '33', slug: 'schema-design', title: 'Schema design, tenancy & IDs', depth: 'D', status: 'done' },
          { n: '34', slug: 'postgres-in-production', title: 'Postgres in production', depth: 'X', status: 'done' }]},
        { id: 'M9', name: 'Architect’s choice: picking the DB', topics: [
          { n: '35', slug: 'db-decision-navigator', title: 'Decision navigator', depth: 'X', status: 'done' },
          { n: '36', slug: 'relational-compared', title: 'Postgres vs MySQL vs Oracle vs SQL Server', depth: 'D', status: 'done' },
          { n: '37', slug: 'sql-vs-nosql', title: 'SQL vs NoSQL families', depth: 'X', status: 'done' },
          { n: '38', slug: 'distributed-sql', title: 'Distributed SQL & NewSQL', depth: 'X', status: 'done' },
          { n: '39', slug: 'oltp-vs-olap', title: 'OLTP vs OLAP & columnar', depth: 'D', status: 'done' },
          { n: '40', slug: 'scenario-lab', title: 'Real-time scenario lab', depth: 'X', status: 'done' },
          { n: '41', slug: 'polyglot-persistence', title: 'Polyglot persistence & migrations', depth: 'X', status: 'done' }]},
        { id: 'M10', name: 'Drill', topics: [
          { n: '★', slug: 'tricky-50', title: 'Tricky 50 (timed)', depth: 'X', status: 'done' }]}
      ]
    },
    {
      id: 'java', name: 'Java & JVM', icon: '☕', status: 'live', lang: 'java',
      blurb: 'From references and equals/hashCode to the JMM, GC, JIT and virtual threads. Java 21 LTS throughout.',
      index: { hero: 'Java &amp; the JVM, <span class=\'grad\'>language to internals.</span>', search: 'Search: hashCode, G1, virtual threads…', desc: 'From references and equals/hashCode to the JMM, GC, JIT and virtual threads. Java 21 LTS throughout.' },
      text: { gotchaSub: 'The traps that separate “writes Java” from “debugs Java in production”.', codeTitle: 'In production', codeLabel: 'Production code', codeSub: 'Code you can lift into a real service.', footer: 'Interview Atlas · Java 21 LTS semantics unless noted.' },
      modules: [
        { id: 'B', name: 'Basics (start here)', topics: [
          { n: 'B1', slug: 'java-setup-first-program', title: 'Running Java', sub: 'JDK vs JRE; javac & java; public static void main; JShell; single-file java Main.java', depth: 'F', status: 'done' },
          { n: 'B2', slug: 'java-types-variables', title: 'Variables & primitive types', sub: 'int/long/double/boolean/char; wrappers & autoboxing; var; casting & overflow', depth: 'F', status: 'done' },
          { n: 'B3', slug: 'java-operators-control-flow', title: 'Operators & control flow', sub: 'arithmetic & integer division; if/else; switch expressions; for/while/do & enhanced for', depth: 'F', status: 'done' },
          { n: 'B4', slug: 'java-arrays-strings-basics', title: 'Arrays & strings basics', sub: 'array creation & indexing; String methods; StringBuilder; text blocks', depth: 'F', status: 'done' },
          { n: 'B5', slug: 'java-methods', title: 'Methods', sub: 'parameters & return; overloading; static vs instance; varargs', depth: 'F', status: 'done' },
          { n: 'B6', slug: 'java-classes-objects', title: 'Classes & objects', sub: 'fields & constructors; this; static members; access modifiers; packages & imports', depth: 'F', status: 'done' },
          { n: 'B7', slug: 'java-inheritance-interfaces', title: 'Inheritance & interfaces', sub: 'extends & super; overriding; abstract classes; interfaces & default methods; polymorphism', depth: 'F', status: 'done' },
          { n: 'B8', slug: 'java-collections-basics', title: 'Collections basics', sub: 'List/Set/Map; ArrayList & HashMap; iterating; List.of & immutability', depth: 'F', status: 'done' }]},
        { id: 'M0', name: 'Language core', topics: [
          { n: '1', slug: 'references-pass-by-value', title: 'References & pass-by-value', sub: 'stack vs heap refs; why Java is always pass-by-value; == vs equals; aliasing bugs', depth: 'F', status: 'done' },
          { n: '2', slug: 'equals-hashcode', title: 'equals & hashCode contract', sub: 'the contract; mutable keys in HashMap; records’ generated methods; Comparable consistency', depth: 'D', status: 'done' },
          { n: '3', slug: 'immutability-records', title: 'Immutability & records', sub: 'final vs immutable; defensive copies; records & compact constructors; List.of vs unmodifiableList', depth: 'D', status: 'done' },
          { n: '4', slug: 'generics-erasure', title: 'Generics & type erasure', sub: 'erasure & bridge methods; PECS (? extends / ? super); heap pollution; raw types', depth: 'X', status: 'done' },
          { n: '5', slug: 'exceptions', title: 'Exceptions done right', sub: 'checked vs unchecked; try-with-resources & suppressed; finally pitfalls; exception translation', depth: 'D', status: 'done' },
          { n: '6', slug: 'strings-interning', title: 'Strings, interning & text', sub: 'string pool & intern(); compact strings; concatenation & StringBuilder; text blocks; Unicode pitfalls', depth: 'D', status: 'done' },
          { n: '7', slug: 'sealed-pattern-matching', title: 'Sealed types & pattern matching', sub: 'sealed interfaces; record patterns; switch patterns & exhaustiveness; guarded patterns', depth: 'D', status: 'done' },
          { n: '8', slug: 'lambdas-functional', title: 'Lambdas & functional interfaces', sub: 'invokedynamic; effectively final capture; method references; built-in functional interfaces', depth: 'D', status: 'done' },
          { n: '9', slug: 'streams-collectors', title: 'Streams & collectors', sub: 'laziness & short-circuit; stateful ops; groupingBy/toMap traps; parallel streams & the common pool', depth: 'D', status: 'done' },
          { n: '10', slug: 'optional', title: 'Optional', sub: 'intended use; orElse vs orElseGet; anti-patterns (fields, params); map/flatMap chains', depth: 'F', status: 'done' }]},
        { id: 'M1', name: 'Collections', topics: [
          { n: '11', slug: 'hashmap-internals', title: 'HashMap internals', sub: 'buckets & hashing; resize & load factor; treeification; iteration order; ConcurrentModificationException', depth: 'X', status: 'done' },
          { n: '12', slug: 'choosing-collections', title: 'Choosing collections', sub: 'ArrayList vs LinkedList; ArrayDeque; TreeMap/NavigableMap; EnumMap/Set; big-O table', depth: 'F', status: 'done' },
          { n: '13', slug: 'concurrent-collections', title: 'Concurrent collections', sub: 'ConcurrentHashMap (compute, size); CopyOnWrite; BlockingQueues; ConcurrentSkipList', depth: 'X', status: 'done' }]},
        { id: 'M2', name: 'JVM internals', topics: [
          { n: '14', slug: 'class-loading', title: 'Class loading', sub: 'delegation model; linking & init order; static init deadlock; ClassCastException across loaders; metaspace leaks', depth: 'X', status: 'done' },
          { n: '15', slug: 'jvm-memory-areas', title: 'JVM memory areas', sub: 'heap generations; stack & frames; metaspace; direct memory; object header & compressed oops', depth: 'X', status: 'done' },
          { n: '16', slug: 'garbage-collection', title: 'Garbage collection', sub: 'reachability & GC roots; G1 regions & pauses; ZGC/Shenandoah; choosing & tuning; reading GC logs', depth: 'X', status: 'done' },
          { n: '17', slug: 'jit-compilation', title: 'JIT compilation', sub: 'interpreter → C1 → C2 tiers; inlining & escape analysis; deoptimization; warm-up & microbenchmark traps (JMH)', depth: 'X', status: 'done' },
          { n: '18', slug: 'leaks-oom', title: 'Memory leaks & OOM', sub: 'OOM kinds; leak patterns (static maps, ThreadLocal, listeners); heap dumps & MAT; container memory limits', depth: 'X', status: 'done' }]},
        { id: 'M3', name: 'Concurrency', topics: [
          { n: '19', slug: 'threads-executors', title: 'Threads & executors', sub: 'thread lifecycle; ThreadPoolExecutor params & rejection; sizing pools; shutdown', depth: 'D', status: 'done' },
          { n: '20', slug: 'java-memory-model', title: 'Java Memory Model', sub: 'happens-before; volatile; safe publication; double-checked locking; final-field semantics', depth: 'X', status: 'done' },
          { n: '21', slug: 'locks-synchronized', title: 'Locks & synchronized', sub: 'monitors; ReentrantLock & Conditions; ReadWriteLock & StampedLock; fairness', depth: 'X', status: 'done' },
          { n: '22', slug: 'completablefuture', title: 'CompletableFuture', sub: 'thenApply vs thenCompose; async executors; exception handling; allOf/anyOf; timeouts', depth: 'D', status: 'done' },
          { n: '23', slug: 'virtual-threads', title: 'Virtual threads (Java 21)', sub: 'carrier threads & mounting; pinning (synchronized, native); structured concurrency; when not to use them', depth: 'X', status: 'done' },
          { n: '24', slug: 'concurrency-bugs', title: 'Concurrency bugs', sub: 'race conditions; deadlock & livelock; thread dumps; lost updates; atomics & LongAdder', depth: 'X', status: 'done' }]},
        { id: 'M4', name: 'Modern Java & production', topics: [
          { n: '25', slug: 'java-versions', title: 'Java 8 → 21 tour', sub: 'LTS timeline; key features per version; migration traps (modules, removed APIs)', depth: 'F', status: 'done' },
          { n: '26', slug: 'profiling-jfr', title: 'Profiling & JFR', sub: 'JFR & JMC; async-profiler flame graphs; CPU vs alloc profiling; safepoint bias', depth: 'X', status: 'done' },
          { n: '27', slug: 'io-nio', title: 'I/O & NIO', sub: 'blocking vs non-blocking; buffers & channels; memory-mapped files; selectors', depth: 'D', status: 'done' }]},
        { id: 'M5', name: 'Drill', topics: [
          { n: '★', slug: 'tricky-java', title: 'Tricky Java (timed)', sub: '50 mixed puzzles across the track', depth: 'X', status: 'done' }]}
      ]
    },
    {
      id: 'spring', name: 'Spring & Spring Boot', icon: '❀', status: 'live', lang: 'java',
      blurb: 'IoC, proxies and auto-configuration through @Transactional, JPA, security, Kafka and production Boot. Boot 3.x.',
      index: { hero: 'Spring &amp; Spring Boot, <span class=\'grad\'>magic made visible.</span>', search: 'Search: proxies, @Transactional, N+1…', desc: 'IoC, proxies and auto-configuration through @Transactional, JPA, security, Kafka and production Boot. Boot 3.x.' },
      text: { gotchaSub: 'The traps that separate “uses Spring” from “knows what Spring is doing for you”.', codeTitle: 'In your stack', codeLabel: 'Spring Boot', codeSub: 'Configuration and code for a Spring Boot 3.x service.', footer: 'Interview Atlas · Spring Boot 3.x / Spring Framework 6.x unless noted.' },
      modules: [
        { id: 'B', name: 'Basics (start here)', topics: [
          { n: 'B1', slug: 'spring-what-is-spring', title: 'What Spring & Boot are', sub: 'Spring vs Spring Boot; starters; auto-configuration in one sentence; the ecosystem', depth: 'F', status: 'done' },
          { n: 'B2', slug: 'spring-first-app', title: 'Your first Boot app', sub: 'start.spring.io; Maven/Gradle; @SpringBootApplication; embedded Tomcat; run & package', depth: 'F', status: 'done' },
          { n: 'B3', slug: 'spring-layers', title: 'Controller, service, repository', sub: 'layered architecture; @Component stereotypes; constructor injection; package layout', depth: 'F', status: 'done' },
          { n: 'B4', slug: 'spring-rest-basics', title: 'REST controller basics', sub: '@RestController; @GetMapping/@PostMapping; path & query params; JSON with Jackson; status codes', depth: 'F', status: 'done' },
          { n: 'B5', slug: 'spring-config-basics', title: 'Configuration basics', sub: 'application.properties/yml; @Value; @ConfigurationProperties; profiles intro', depth: 'F', status: 'done' },
          { n: 'B6', slug: 'spring-data-jpa-basics', title: 'Data JPA basics', sub: '@Entity & @Id; JpaRepository; derived queries; H2 vs Postgres; ddl-auto', depth: 'F', status: 'done' }]},
        { id: 'M0', name: 'Spring core', topics: [
          { n: '1', slug: 'ioc-di', title: 'IoC & dependency injection', sub: 'ApplicationContext; constructor vs field injection; @Qualifier/@Primary; circular deps', depth: 'F', status: 'done' },
          { n: '2', slug: 'bean-lifecycle-scopes', title: 'Bean lifecycle & scopes', sub: 'instantiate → populate → init → destroy; BeanPostProcessor; scopes & scoped proxies; prototype-in-singleton trap', depth: 'D', status: 'done' },
          { n: '3', slug: 'configuration-profiles', title: '@Configuration & profiles', sub: 'full vs lite mode (CGLIB); @Bean methods; @Profile & @Conditional; import ordering', depth: 'D', status: 'done' },
          { n: '4', slug: 'aop-proxies', title: 'AOP & proxies', sub: 'JDK vs CGLIB proxies; the self-invocation trap; pointcuts & advice order; final methods', depth: 'X', status: 'done' },
          { n: '5', slug: 'spring-events', title: 'Application events', sub: 'publish & listen; @TransactionalEventListener phases; async events; ordering', depth: 'D', status: 'done' }]},
        { id: 'M1', name: 'Spring Boot', topics: [
          { n: '6', slug: 'auto-configuration', title: 'Auto-configuration', sub: 'AutoConfiguration.imports; @ConditionalOn*; condition evaluation report; writing your own', depth: 'X', status: 'done' },
          { n: '7', slug: 'starters-dependencies', title: 'Starters & dependency management', sub: 'BOMs & parent POM; version overrides; dependency conflicts; Gradle vs Maven', depth: 'F', status: 'done' },
          { n: '8', slug: 'externalized-config', title: 'Externalized configuration', sub: 'property-source order; @ConfigurationProperties & validation; profiles; secrets', depth: 'D', status: 'done' },
          { n: '9', slug: 'actuator-observability', title: 'Actuator & observability', sub: 'health groups & probes; Micrometer metrics; tracing (OTel); securing endpoints', depth: 'D', status: 'done' },
          { n: '10', slug: 'boot-testing', title: 'Testing in Boot', sub: 'test slices; @MockitoBean; Testcontainers & @ServiceConnection; context caching', depth: 'D', status: 'done' }]},
        { id: 'M2', name: 'Web', topics: [
          { n: '11', slug: 'mvc-request-flow', title: 'Spring MVC request flow', sub: 'DispatcherServlet; handler mapping & adapters; argument resolvers; message converters; interceptors vs filters', depth: 'X', status: 'done' },
          { n: '12', slug: 'errors-validation', title: 'Errors & validation', sub: '@ControllerAdvice; ProblemDetail (RFC 9457); Bean Validation groups; validation in services', depth: 'D', status: 'done' },
          { n: '13', slug: 'webflux-reactive', title: 'WebFlux & reactive', sub: 'Mono/Flux; Netty event loop; backpressure; blocking-call traps; when to choose MVC', depth: 'X', status: 'done' },
          { n: '14', slug: 'http-clients', title: 'HTTP clients', sub: 'RestClient vs WebClient vs RestTemplate; timeouts; connection pools; HTTP interfaces', depth: 'D', status: 'done' }]},
        { id: 'M3', name: 'Data', topics: [
          { n: '15', slug: 'transactions-propagation', title: '@Transactional deep dive', sub: 'propagation & isolation; rollback rules; proxy pitfalls; readOnly; transaction boundaries', depth: 'X', status: 'done' },
          { n: '16', slug: 'jpa-n-plus-1', title: 'JPA fetching & N+1', sub: 'lazy vs eager; N+1 detection; fetch joins & entity graphs; LazyInitializationException & OSIV', depth: 'X', status: 'done' },
          { n: '17', slug: 'spring-data', title: 'Spring Data repositories', sub: 'derived queries; projections; paging & slicing; auditing; custom repos', depth: 'D', status: 'done' },
          { n: '18', slug: 'hikari-pooling', title: 'HikariCP & connection pools', sub: 'pool sizing; timeouts; leak detection; pool exhaustion incidents', depth: 'D', status: 'done' }]},
        { id: 'M4', name: 'Security', topics: [
          { n: '19', slug: 'security-filter-chain', title: 'Security filter chain', sub: 'SecurityFilterChain beans; authentication flow; method security; CSRF & CORS', depth: 'X', status: 'done' },
          { n: '20', slug: 'oauth2-jwt', title: 'OAuth2, OIDC & JWT', sub: 'resource server; JWT validation & JWKS; client credentials; token relay', depth: 'D', status: 'done' }]},
        { id: 'M5', name: 'Distributed & async', topics: [
          { n: '21', slug: 'kafka-messaging', title: 'Kafka with Spring', sub: 'listener containers; offsets & ack modes; retries & DLT; idempotency & outbox', depth: 'X', status: 'done' },
          { n: '22', slug: 'resilience', title: 'Resilience patterns', sub: 'Resilience4j circuit breaker, retry, bulkhead & time limiter; retry storms', depth: 'D', status: 'done' },
          { n: '23', slug: 'caching', title: 'Caching abstraction', sub: '@Cacheable semantics & keys; Caffeine vs Redis; stampede & TTLs; self-invocation again', depth: 'D', status: 'done' },
          { n: '24', slug: 'async-scheduling', title: '@Async & scheduling', sub: 'executors; @Scheduled & ShedLock; virtual threads in Boot 3.2+; context propagation', depth: 'D', status: 'done' }]},
        { id: 'M6', name: 'Production', topics: [
          { n: '25', slug: 'aot-native', title: 'AOT & native image', sub: 'GraalVM native; reachability metadata; startup vs throughput; CRaC', depth: 'X', status: 'done' },
          { n: '26', slug: 'startup-performance', title: 'Startup & runtime performance', sub: 'lazy init; class-data sharing; graceful shutdown; memory sizing in containers', depth: 'D', status: 'done' }]},
        { id: 'M7', name: 'Drill', topics: [
          { n: '★', slug: 'tricky-spring', title: 'Tricky Spring (timed)', sub: '50 mixed puzzles across the track', depth: 'X', status: 'done' }]}
      ]
    },
    {
      id: 'kubernetes', name: 'Kubernetes', icon: '⎈', status: 'live', lang: 'yaml',
      blurb: 'Pods to operators: workloads, networking, storage, scheduling, autoscaling and running the JVM on Kubernetes. K8s 1.30+.',
      index: { hero: 'Kubernetes, <span class=\'grad\'>from Pod to production.</span>', search: 'Search: probes, OOMKilled, HPA…', desc: 'Pods to operators: workloads, networking, storage, scheduling, autoscaling and running the JVM on Kubernetes. K8s 1.30+.' },
      text: { gotchaSub: 'The traps that separate “can kubectl apply” from “has been paged for a cluster”.', codeTitle: 'Manifests & Java tie-in', codeLabel: 'YAML / Java', codeSub: 'Manifests, commands and Spring settings that go with this topic.', footer: 'Interview Atlas · Kubernetes 1.30+ unless noted.', metaDesc: 'Animated visual, gotchas, real-world incidents, puzzles and interview questions. Kubernetes 1.30+.' },
      modules: [
        { id: 'B', name: 'Basics (start here)', topics: [
          { n: 'B1', slug: 'docker-basics', title: 'Docker basics', sub: 'images vs containers; Dockerfile; build, run, ports; registries', depth: 'F', status: 'done' },
          { n: 'B2', slug: 'k8s-local-cluster', title: 'A local cluster', sub: 'kind / minikube / Docker Desktop; kubeconfig & contexts', depth: 'F', status: 'done' },
          { n: 'B3', slug: 'kubectl-basics', title: 'kubectl basics', sub: 'get/describe/logs/exec; apply vs create; namespaces; -o yaml', depth: 'F', status: 'done' },
          { n: 'B4', slug: 'k8s-yaml-manifests', title: 'Reading YAML manifests', sub: 'apiVersion/kind/metadata/spec; labels & selectors; multi-doc files', depth: 'F', status: 'done' },
          { n: 'B5', slug: 'first-deployment-service', title: 'First Deployment & Service', sub: 'deploy an app; scale; expose with a Service; port-forward', depth: 'F', status: 'done' },
          { n: 'B6', slug: 'configmaps-secrets-basics', title: 'ConfigMaps & Secrets basics', sub: 'env vars vs mounted files; creating them; Secrets are base64, not encrypted', depth: 'F', status: 'done' }]},
        { id: 'M0', name: 'Foundations', topics: [
          { n: '1', slug: 'containers-vs-vms', title: 'Containers vs VMs', sub: 'namespaces & cgroups; image layers; OCI; why orchestration', depth: 'F', status: 'done' },
          { n: '2', slug: 'architecture', title: 'Cluster architecture', sub: 'API server, etcd, scheduler & controller manager; kubelet & kube-proxy; request path of kubectl apply', depth: 'D', status: 'done' },
          { n: '3', slug: 'pods', title: 'Pods', sub: 'multi-container patterns (sidecar, init); pod lifecycle & phases; restart policy; native sidecars (1.29+)', depth: 'F', status: 'done' },
          { n: '4', slug: 'desired-state', title: 'Desired state & reconciliation', sub: 'declarative vs imperative; controllers & control loops; owner references & garbage collection; labels & selectors', depth: 'D', status: 'done' }]},
        { id: 'M1', name: 'Workloads', topics: [
          { n: '5', slug: 'deployments-rollouts', title: 'Deployments & rollouts', sub: 'ReplicaSets; rolling update (maxSurge/maxUnavailable); rollback; blue-green & canary', depth: 'D', status: 'done' },
          { n: '6', slug: 'statefulsets-jobs', title: 'StatefulSet, DaemonSet & Jobs', sub: 'stable identity & ordered rollout; DaemonSets; Jobs & CronJobs; backoff & concurrency', depth: 'D', status: 'done' },
          { n: '7', slug: 'probes', title: 'Probes', sub: 'liveness vs readiness vs startup; probe-induced outages; tuning for JVM warm-up', depth: 'D', status: 'done' },
          { n: '8', slug: 'resources-qos', title: 'Requests, limits & QoS', sub: 'scheduling on requests; CPU throttling (CFS); OOMKilled; QoS classes & eviction', depth: 'X', status: 'done' }]},
        { id: 'M2', name: 'Networking', topics: [
          { n: '9', slug: 'services', title: 'Services', sub: 'ClusterIP, NodePort & LoadBalancer; kube-proxy (iptables/IPVS); EndpointSlices; headless services', depth: 'D', status: 'done' },
          { n: '10', slug: 'ingress-gateway', title: 'Ingress & Gateway API', sub: 'ingress controllers; TLS termination; Gateway API resources; path routing', depth: 'D', status: 'done' },
          { n: '11', slug: 'dns-network-policy', title: 'DNS & NetworkPolicy', sub: 'CoreDNS & ndots; default-allow; writing policies; CNI’s role', depth: 'X', status: 'done' }]},
        { id: 'M3', name: 'Config & storage', topics: [
          { n: '12', slug: 'configmaps-secrets', title: 'ConfigMaps & Secrets', sub: 'env vs volume mounts; update propagation; secrets are base64, not encryption; external secrets', depth: 'D', status: 'done' },
          { n: '13', slug: 'volumes-storage', title: 'Volumes, PV & PVC', sub: 'volume types; StorageClass & dynamic provisioning; access modes; reclaim policy', depth: 'D', status: 'done' }]},
        { id: 'M4', name: 'Scheduling & scaling', topics: [
          { n: '14', slug: 'scheduling', title: 'Scheduler, affinity & taints', sub: 'filtering & scoring; node/pod (anti-)affinity; taints & tolerations; topology spread', depth: 'X', status: 'done' },
          { n: '15', slug: 'autoscaling', title: 'HPA, VPA & Cluster Autoscaler', sub: 'metrics pipeline; HPA algorithm & stabilization; VPA modes; Karpenter / Cluster Autoscaler; KEDA', depth: 'X', status: 'done' },
          { n: '16', slug: 'disruptions-pdb', title: 'Disruptions & PDBs', sub: 'voluntary vs involuntary; PodDisruptionBudgets; node drains; graceful termination & preStop', depth: 'D', status: 'done' }]},
        { id: 'M5', name: 'Security & operations', topics: [
          { n: '17', slug: 'rbac-security', title: 'RBAC & Pod security', sub: 'Roles & bindings; service accounts & tokens; Pod Security Standards; securityContext', depth: 'D', status: 'done' },
          { n: '18', slug: 'debugging', title: 'Debugging workloads', sub: 'CrashLoopBackOff, ImagePullBackOff & Pending; kubectl debug & ephemeral containers; events & logs', depth: 'D', status: 'done' },
          { n: '19', slug: 'observability', title: 'Observability', sub: 'metrics-server & Prometheus; logging architectures; tracing; golden signals', depth: 'D', status: 'done' },
          { n: '20', slug: 'helm-kustomize-gitops', title: 'Helm, Kustomize & GitOps', sub: 'charts & values; overlays; Argo CD / Flux; drift', depth: 'D', status: 'done' },
          { n: '21', slug: 'operators-crds', title: 'Operators & CRDs', sub: 'custom resources; the operator pattern; admission webhooks; finalizers', depth: 'X', status: 'done' },
          { n: '22', slug: 'jvm-on-k8s', title: 'Java/Spring on Kubernetes', sub: 'container-aware JVM (MaxRAMPercentage); probes with Actuator; graceful shutdown; image building (Jib, buildpacks)', depth: 'X', status: 'done' },
          { n: '23', slug: 'multi-tenancy-cost', title: 'Namespaces, quotas & cost', sub: 'ResourceQuota & LimitRange; multi-tenancy models; right-sizing', depth: 'D', status: 'done' },
          { n: '24', slug: 'cluster-upgrades', title: 'Upgrades & cluster ops', sub: 'version skew; node upgrades; etcd backup; API deprecations', depth: 'X', status: 'done' }]},
        { id: 'M6', name: 'Drill', topics: [
          { n: '★', slug: 'tricky-k8s', title: 'Tricky Kubernetes (timed)', sub: '50 mixed scenario puzzles', depth: 'X', status: 'done' }]}
      ]
    },
    {
      id: 'python', name: 'Python', icon: '🐍', status: 'live', lang: 'python',
      blurb: 'From your first script and basic types to the data model, closures, generators and decorators through the GIL, asyncio, packaging and FastAPI. Runs real Python in your browser.',
      index: { hero: 'Python, <span class=\'grad\'>from zero to internals.</span>', search: 'Search: GIL, asyncio, decorators…', desc: 'The data model, closures, generators and decorators through the GIL, asyncio, packaging and FastAPI. Runs real Python in your browser.' },
      text: { gotchaSub: 'The traps that separate “writes Python” from “knows why Python did that”.', codeTitle: 'In your stack', codeLabel: 'Python', codeSub: 'Production-style Python, plus the Java equivalent where it helps.', footer: 'Interview Atlas · CPython 3.12+ unless noted.', metaDesc: 'Animated visual, a real Python playground in your browser, gotchas, real-world incidents, puzzles and interview questions.' },
      modules: [
        { id: 'B', name: 'Basics (start here)', topics: [
          { n: 'B1', slug: 'py-setup-first-program', title: 'Running Python', sub: 'installing; REPL vs script; print; comments; indentation as syntax', depth: 'F', status: 'done' },
          { n: 'B2', slug: 'variables-types', title: 'Variables & basic types', sub: 'int/float/bool/str/None; dynamic typing; type(); casting', depth: 'F', status: 'done' },
          { n: 'B3', slug: 'operators-expressions', title: 'Operators & expressions', sub: 'arithmetic (//, %, **); comparison chaining; and/or/not; truthiness', depth: 'F', status: 'done' },
          { n: 'B4', slug: 'strings', title: 'Strings', sub: 'slicing; f-strings; common methods; immutability; split/join', depth: 'F', status: 'done' },
          { n: 'B5', slug: 'control-flow', title: 'if / for / while', sub: 'range; break/continue; for…else; match (3.10+)', depth: 'F', status: 'done' },
          { n: 'B6', slug: 'lists-tuples', title: 'Lists & tuples', sub: 'indexing & slicing; append/extend; sort vs sorted; unpacking', depth: 'F', status: 'done' },
          { n: 'B7', slug: 'dicts-sets', title: 'Dicts & sets', sub: 'CRUD & .get; iteration; defaultdict/Counter; set operations', depth: 'F', status: 'done' },
          { n: 'B8', slug: 'functions-basics', title: 'Functions', sub: 'def/return; default & keyword args; *args/**kwargs; lambda', depth: 'F', status: 'done' },
          { n: 'B9', slug: 'comprehensions', title: 'Comprehensions', sub: 'list/dict/set comprehensions; filters; nesting; when not to', depth: 'F', status: 'done' },
          { n: 'B10', slug: 'classes-basics', title: 'Classes & OOP basics', sub: '__init__ & self; methods; inheritance & super(); vs Java classes', depth: 'F', status: 'done' },
          { n: 'B11', slug: 'exceptions-basics', title: 'Errors & exceptions', sub: 'try/except/else/finally; raise; custom exceptions', depth: 'F', status: 'done' },
          { n: 'B12', slug: 'files-modules-stdlib', title: 'Files, modules & stdlib', sub: 'open/with; json & csv; import; pip & venv; pathlib', depth: 'F', status: 'done' }]},
        { id: 'M0', name: 'Language core', topics: [
          { n: '1', slug: 'data-model', title: 'Everything is an object', sub: 'names vs objects; identity vs equality; mutability; small-int & string caching', depth: 'F', status: 'done' },
          { n: '2', slug: 'scoping-closures', title: 'Scope, closures & defaults', sub: 'LEGB; nonlocal/global; late-binding closures; mutable default arguments', depth: 'D', status: 'done' },
          { n: '3', slug: 'dunder-methods', title: 'Dunder methods & protocols', sub: '__repr__/__eq__/__hash__; operator overloading; container protocols; __slots__', depth: 'D', status: 'done' },
          { n: '4', slug: 'iterators-generators', title: 'Iterators & generators', sub: 'iteration protocol; generators & yield from; laziness; itertools', depth: 'D', status: 'done' },
          { n: '5', slug: 'decorators', title: 'Decorators', sub: 'functions as objects; functools.wraps; parameterized decorators; class decorators', depth: 'D', status: 'done' },
          { n: '6', slug: 'context-managers', title: 'Context managers', sub: 'with protocol; contextlib; exceptions in __exit__; ExitStack', depth: 'D', status: 'done' },
          { n: '7', slug: 'typing', title: 'Type hints', sub: 'generics & Protocols; TypedDict; mypy/pyright; runtime vs static', depth: 'D', status: 'done' },
          { n: '8', slug: 'dataclasses-pydantic', title: 'Dataclasses & Pydantic', sub: 'field defaults; frozen & slots; Pydantic v2 validation; when to use which', depth: 'D', status: 'done' }]},
        { id: 'M1', name: 'Internals', topics: [
          { n: '9', slug: 'memory-gc', title: 'Memory & garbage collection', sub: 'reference counting; cyclic GC & generations; weakref; memory leaks', depth: 'X', status: 'done' },
          { n: '10', slug: 'gil', title: 'The GIL & free-threading', sub: 'what the GIL protects; CPU- vs I/O-bound; PEP 703 free-threaded 3.13', depth: 'X', status: 'done' },
          { n: '11', slug: 'dict-internals', title: 'Dict & set internals', sub: 'hash tables; insertion order; key requirements; performance traps', depth: 'X', status: 'done' },
          { n: '12', slug: 'imports', title: 'Import system', sub: 'modules & packages; sys.path; circular imports; __main__', depth: 'D', status: 'done' }]},
        { id: 'M2', name: 'Concurrency', topics: [
          { n: '13', slug: 'threading-multiprocessing', title: 'Threads vs processes', sub: 'threading; multiprocessing & pickling; concurrent.futures; shared state', depth: 'D', status: 'done' },
          { n: '14', slug: 'asyncio', title: 'asyncio event loop', sub: 'coroutines & tasks; await semantics; blocking the loop; TaskGroup & cancellation', depth: 'X', status: 'done' },
          { n: '15', slug: 'concurrency-choice', title: 'Choosing a concurrency model', sub: 'decision guide; mixing sync & async; async frameworks', depth: 'D', status: 'done' }]},
        { id: 'M3', name: 'Practice', topics: [
          { n: '16', slug: 'packaging', title: 'Packaging & environments', sub: 'venv; pip vs uv vs poetry; pyproject.toml; lockfiles & reproducibility', depth: 'F', status: 'done' },
          { n: '17', slug: 'pytest', title: 'Testing with pytest', sub: 'fixtures & scopes; parametrize; mocking & monkeypatch; coverage', depth: 'D', status: 'done' },
          { n: '18', slug: 'performance', title: 'Profiling & performance', sub: 'cProfile & py-spy; vectorize with NumPy; C extensions & Cython; common slow patterns', depth: 'D', status: 'done' },
          { n: '19', slug: 'fastapi', title: 'FastAPI services', sub: 'routing & dependency injection; Pydantic models; async endpoints; production serving (uvicorn/gunicorn)', depth: 'D', status: 'done' },
          { n: '20', slug: 'errors-logging', title: 'Exceptions & logging', sub: 'exception hierarchy & chaining; ExceptionGroup; logging config; structured logs', depth: 'D', status: 'done' },
          { n: '21', slug: 'python-for-java-devs', title: 'Python for Java developers', sub: 'idiom mapping; duck typing vs interfaces; where Java habits hurt', depth: 'F', status: 'done' }]},
        { id: 'M4', name: 'Drill', topics: [
          { n: '★', slug: 'tricky-python', title: 'Tricky Python (timed)', sub: '50 mixed puzzles', depth: 'X', status: 'done' }]}
      ]
    },
    {
      id: 'nodejs', name: 'Node.js', icon: '⬢', status: 'live', lang: 'js',
      blurb: 'V8, libuv and the event loop through streams, workers, memory leaks and production services. Node 22 LTS.',
      index: { hero: 'Node.js, <span class=\'grad\'>inside the event loop.</span>', search: 'Search: event loop, streams, nextTick…', desc: 'V8, libuv and the event loop through streams, workers, memory leaks and production services. Node 22 LTS.' },
      text: { gotchaSub: 'The traps that separate “writes Node” from “knows what the event loop is doing”.', codeTitle: 'In your stack', codeLabel: 'Node / TS', codeSub: 'Production-style Node.js, plus the Java equivalent where it helps.', footer: 'Interview Atlas · Node.js 22 LTS unless noted.' },
      modules: [
        { id: 'B', name: 'Basics (start here)', topics: [
          { n: 'B1', slug: 'node-setup-first-script', title: 'Running Node', sub: 'installing (nvm); node REPL & scripts; npm init; package.json scripts', depth: 'F', status: 'done' },
          { n: 'B2', slug: 'js-variables-types', title: 'Variables & types', sub: 'let/const/var; primitives vs objects; typeof; == vs ===', depth: 'F', status: 'done' },
          { n: 'B3', slug: 'js-functions-basics', title: 'Functions', sub: 'declarations vs arrows; default & rest params; closures intro; this basics', depth: 'F', status: 'done' },
          { n: 'B4', slug: 'js-objects-arrays', title: 'Objects & arrays', sub: 'object literals; destructuring & spread; map/filter/reduce; JSON', depth: 'F', status: 'done' },
          { n: 'B5', slug: 'js-control-flow-errors', title: 'Control flow & errors', sub: 'if/switch/loops; for…of vs for…in; try/catch/finally; throwing Error', depth: 'F', status: 'done' },
          { n: 'B6', slug: 'js-classes-modules', title: 'Classes & modules', sub: 'class syntax & extends; import/export (ESM); require (CJS)', depth: 'F', status: 'done' },
          { n: 'B7', slug: 'js-async-basics', title: 'Async basics', sub: 'callbacks; promises; async/await; why Node is non-blocking', depth: 'F', status: 'done' },
          { n: 'B8', slug: 'node-first-http-server', title: 'Your first HTTP server', sub: 'http module; Express hello world; routes & JSON; reading env vars', depth: 'F', status: 'done' }]},
        { id: 'M0', name: 'Runtime', topics: [
          { n: '1', slug: 'node-architecture', title: 'Node architecture', sub: 'V8 + libuv; the thread pool; bindings; single-threaded myth', depth: 'F', status: 'done' },
          { n: '2', slug: 'event-loop-phases', title: 'Event-loop phases', sub: 'timers, poll, check & close; setImmediate vs setTimeout; I/O callbacks', depth: 'X', status: 'done' },
          { n: '3', slug: 'microtasks-macrotasks', title: 'Microtasks vs macrotasks', sub: 'promise jobs; process.nextTick priority; starvation; ordering puzzles', depth: 'X', status: 'done' },
          { n: '4', slug: 'modules-cjs-esm', title: 'CommonJS vs ESM', sub: 'require vs import; interop; package.json \'type\'; top-level await', depth: 'D', status: 'done' },
          { n: '5', slug: 'npm-dependencies', title: 'npm & dependencies', sub: 'semver & lockfiles; peer deps; supply-chain risk; workspaces', depth: 'F', status: 'done' }]},
        { id: 'M1', name: 'Async', topics: [
          { n: '6', slug: 'callbacks-promises-async', title: 'Callbacks → promises → async/await', sub: 'promise states; Promise.all/allSettled/race/any; sequential vs parallel awaits', depth: 'D', status: 'done' },
          { n: '7', slug: 'async-errors', title: 'Async error handling', sub: 'unhandled rejections; errors in callbacks; AbortController; domains are gone', depth: 'D', status: 'done' },
          { n: '8', slug: 'streams-backpressure', title: 'Streams & backpressure', sub: 'readable/writable/transform; pipeline; highWaterMark; async iteration', depth: 'X', status: 'done' },
          { n: '9', slug: 'eventemitter', title: 'EventEmitter', sub: 'listeners & once; error events; memory-leak warnings; patterns', depth: 'D', status: 'done' }]},
        { id: 'M2', name: 'Performance', topics: [
          { n: '10', slug: 'blocking-event-loop', title: 'Blocking the event loop', sub: 'CPU work; sync APIs; JSON on big payloads; measuring event-loop lag', depth: 'X', status: 'done' },
          { n: '11', slug: 'worker-threads-cluster', title: 'Worker threads & cluster', sub: 'worker_threads & SharedArrayBuffer; cluster & PM2; when to scale out instead', depth: 'D', status: 'done' },
          { n: '12', slug: 'v8-gc-leaks', title: 'V8 memory & leaks', sub: 'heap spaces; GC (Scavenge, Mark-Compact); leak patterns; heap snapshots', depth: 'X', status: 'done' },
          { n: '13', slug: 'profiling', title: 'Profiling Node', sub: '--inspect & --cpu-prof; flame graphs; clinic.js; diagnostics_channel', depth: 'D', status: 'done' }]},
        { id: 'M3', name: 'Web', topics: [
          { n: '14', slug: 'express-fastify', title: 'Express & Fastify', sub: 'middleware chain; error middleware; Fastify schemas & performance', depth: 'D', status: 'done' },
          { n: '15', slug: 'http-internals', title: 'HTTP internals', sub: 'keep-alive & agents; timeouts; HTTP/2; fetch (undici)', depth: 'X', status: 'done' },
          { n: '16', slug: 'security', title: 'Node security', sub: 'injection & prototype pollution; ReDoS; secrets; the permission model', depth: 'D', status: 'done' }]},
        { id: 'M4', name: 'Production', topics: [
          { n: '17', slug: 'graceful-shutdown', title: 'Graceful shutdown & containers', sub: 'SIGTERM handling; draining connections; PID 1; health checks', depth: 'D', status: 'done' },
          { n: '18', slug: 'typescript-node', title: 'TypeScript on Node', sub: 'tsconfig for Node; type stripping (22.6+); ESM & TS', depth: 'D', status: 'done' },
          { n: '19', slug: 'testing-node', title: 'Testing Node', sub: 'node:test vs Jest/Vitest; mocking timers; integration tests', depth: 'D', status: 'done' },
          { n: '20', slug: 'node-vs-java', title: 'Node vs Java for services', sub: 'concurrency models; when to pick which; interop', depth: 'D', status: 'done' }]},
        { id: 'M5', name: 'Drill', topics: [
          { n: '★', slug: 'tricky-node', title: 'Tricky Node (timed)', sub: '50 mixed puzzles', depth: 'X', status: 'done' }]}
      ]
    },
    {
      id: 'azure', name: 'Azure', icon: '☁', status: 'live', lang: 'bash',
      blurb: 'Identity, compute, data, messaging, networking and operations on Azure, from the angle of a Java/Spring and AI developer and architect.',
      index: { hero: 'Azure, <span class=\'grad\'>for Java &amp; AI builders.</span>', search: 'Search: managed identity, Cosmos, Service Bus…', desc: 'Identity, compute, data, messaging, networking and operations on Azure, from the angle of a Java/Spring and AI developer and architect.' },
      text: { gotchaSub: 'The traps that separate “clicked it in the portal” from “runs it in production”.', codeTitle: 'In your stack', codeLabel: 'Bicep / CLI / Java', codeSub: 'Bicep, az CLI and Spring Cloud Azure code for this topic.', footer: 'Interview Atlas · Azure services and limits change; check Microsoft Learn before relying on a number.' },
      modules: [
        { id: 'B', name: 'Basics (start here)', topics: [
          { n: 'B1', slug: 'cloud-basics', title: 'Cloud basics', sub: 'IaaS/PaaS/SaaS; shared responsibility; pay-as-you-go; regions', depth: 'F', status: 'done' },
          { n: 'B2', slug: 'azure-portal-cli', title: 'Portal & Azure CLI', sub: 'account & subscription; portal tour; az login; resource groups', depth: 'F', status: 'done' },
          { n: 'B3', slug: 'azure-services-tour', title: 'Core services tour', sub: 'compute, storage, databases, networking, identity: what to pick for what', depth: 'F', status: 'done' },
          { n: 'B4', slug: 'azure-storage-basics', title: 'Storage basics', sub: 'storage accounts; blobs/queues/tables/files; access tiers; SAS intro', depth: 'F', status: 'done' },
          { n: 'B5', slug: 'azure-networking-basics', title: 'Networking basics', sub: 'VNets & subnets; NSGs; public vs private IPs; DNS', depth: 'F', status: 'done' },
          { n: 'B6', slug: 'azure-first-deploy', title: 'Deploy your first app', sub: 'App Service for a Spring Boot jar; app settings; logs; cleanup', depth: 'F', status: 'done' }]},
        { id: 'M0', name: 'Foundations', topics: [
          { n: '1', slug: 'azure-hierarchy', title: 'Tenants to resources', sub: 'Entra tenant; management groups; subscriptions; resource groups & ARM', depth: 'F', status: 'done' },
          { n: '2', slug: 'regions-zones', title: 'Regions & availability zones', sub: 'region pairs; zonal vs zone-redundant; SLAs & composite SLAs', depth: 'F', status: 'done' },
          { n: '3', slug: 'entra-managed-identity', title: 'Entra ID & managed identities', sub: 'app registrations vs service principals; system vs user-assigned MI; DefaultAzureCredential', depth: 'D', status: 'done' },
          { n: '4', slug: 'rbac-policy', title: 'RBAC & Azure Policy', sub: 'role assignments & scopes; custom roles; Policy & initiatives; landing zones', depth: 'D', status: 'done' }]},
        { id: 'M1', name: 'Compute', topics: [
          { n: '5', slug: 'compute-choice', title: 'Choosing compute', sub: 'VMs vs App Service vs Container Apps vs AKS vs Functions decision guide', depth: 'D', status: 'done' },
          { n: '6', slug: 'app-service', title: 'App Service', sub: 'plans & scaling; deployment slots; Java/Spring deploys; always-on & health checks', depth: 'D', status: 'done' },
          { n: '7', slug: 'container-apps', title: 'Container Apps', sub: 'environments; revisions & traffic split; KEDA scaling; Dapr', depth: 'D', status: 'done' },
          { n: '8', slug: 'aks', title: 'AKS', sub: 'node pools; networking (kubenet, CNI overlay); workload identity; upgrades', depth: 'X', status: 'done' },
          { n: '9', slug: 'functions', title: 'Azure Functions', sub: 'triggers & bindings; plans (Consumption, Flex, Premium); cold starts; Durable Functions', depth: 'D', status: 'done' }]},
        { id: 'M2', name: 'Data', topics: [
          { n: '10', slug: 'storage-accounts', title: 'Storage accounts', sub: 'Blob tiers; redundancy (LRS→GZRS); SAS vs MI access; lifecycle rules', depth: 'D', status: 'done' },
          { n: '11', slug: 'azure-sql-postgres', title: 'Azure SQL & Postgres Flexible Server', sub: 'tiers; HA & read replicas; connection pooling (PgBouncer); backups & PITR', depth: 'D', status: 'done' },
          { n: '12', slug: 'cosmos-db', title: 'Cosmos DB', sub: 'partition keys; RUs; the five consistency levels; change feed', depth: 'X', status: 'done' },
          { n: '13', slug: 'redis-cache', title: 'Azure Cache for Redis', sub: 'tiers; eviction; clustering; cache-aside with Spring', depth: 'D', status: 'done' }]},
        { id: 'M3', name: 'Integration', topics: [
          { n: '14', slug: 'messaging-choice', title: 'Service Bus vs Event Hubs vs Event Grid', sub: 'queues & topics; sessions & DLQ; partitions & consumer groups; event routing', depth: 'X', status: 'done' },
          { n: '15', slug: 'api-management', title: 'API Management', sub: 'policies; products & subscriptions; rate limiting; versioning', depth: 'D', status: 'done' }]},
        { id: 'M4', name: 'Networking & security', topics: [
          { n: '16', slug: 'vnet-private-endpoints', title: 'VNets & private endpoints', sub: 'subnets & NSGs; private endpoint vs service endpoint; private DNS zones; hub-spoke', depth: 'X', status: 'done' },
          { n: '17', slug: 'key-vault', title: 'Key Vault', sub: 'secrets, keys & certs; RBAC vs access policies; Spring Cloud Azure integration; rotation', depth: 'D', status: 'done' },
          { n: '18', slug: 'front-door-gateway', title: 'Front Door & Application Gateway', sub: 'global vs regional; WAF; routing rules; choosing a load balancer', depth: 'D', status: 'done' }]},
        { id: 'M5', name: 'Operations & architecture', topics: [
          { n: '19', slug: 'monitor-app-insights', title: 'Monitor & Application Insights', sub: 'Log Analytics & KQL; App Insights Java agent; alerts; distributed tracing', depth: 'D', status: 'done' },
          { n: '20', slug: 'bicep-terraform', title: 'Bicep & Terraform', sub: 'ARM vs Bicep; modules; Terraform azurerm; what-if & drift', depth: 'D', status: 'done' },
          { n: '21', slug: 'devops-pipelines', title: 'CI/CD pipelines', sub: 'Azure DevOps vs GitHub Actions; OIDC federation; environments & approvals', depth: 'D', status: 'done' },
          { n: '22', slug: 'cost-management', title: 'Cost management', sub: 'pricing models (reserved, savings plans, spot); budgets; common cost leaks', depth: 'D', status: 'done' },
          { n: '23', slug: 'azure-openai', title: 'Azure OpenAI & AI Foundry', sub: 'deployments & quotas (TPM); content filters; RAG with AI Search; Spring AI', depth: 'D', status: 'done' },
          { n: '24', slug: 'well-architected', title: 'Well-Architected & reliability', sub: 'the five pillars; reliability patterns; disaster recovery (RTO/RPO)', depth: 'D', status: 'done' },
          { n: '25', slug: 'spring-on-azure', title: 'Spring apps on Azure end to end', sub: 'reference architecture; identity-first config; observability; migration options', depth: 'X', status: 'done' }]},
        { id: 'M6', name: 'Drill', topics: [
          { n: '★', slug: 'tricky-azure', title: 'Tricky Azure (timed)', sub: '50 mixed scenario puzzles', depth: 'X', status: 'done' }]}
      ]
    },
    {
      id: 'spark', name: 'Spark & PySpark', icon: '⚡', status: 'live', lang: 'python',
      blurb: 'From what Spark is and your first DataFrame to shuffles, join strategies, AQE, Structured Streaming and Delta Lake.',
      index: { hero: 'Spark & PySpark, <span class=\'grad\'>from zero to tuning.</span>', search: 'Search: shuffle, broadcast join, AQE…', desc: 'From what Spark is and your first DataFrame to shuffles, join strategies, AQE, Structured Streaming and Delta Lake.' },
      text: { gotchaSub: 'The traps that turn a 5-minute job into a 5-hour one.', codeTitle: 'In your stack', codeLabel: 'PySpark', codeSub: 'Production-style PySpark, plus the Java/Scala view where it helps.', footer: 'Interview Atlas · Spark 3.5+/4.x unless noted.', metaDesc: 'Animated visuals, gotchas, real-world incidents, puzzles and interview questions for Spark and PySpark.' },
      modules: [
        { id: 'M0', name: 'Basics (start here)', topics: [
          { n: '1', slug: 'why-spark', title: 'Why Spark?', sub: 'big data; MapReduce to Spark; cluster vs laptop', depth: 'F', status: 'done' },
          { n: '2', slug: 'spark-architecture', title: 'Spark architecture', sub: 'driver; executors; cluster manager; SparkSession', depth: 'F', status: 'done' },
          { n: '3', slug: 'rdd-basics', title: 'RDD basics', sub: 'RDDs; transformations vs actions; laziness', depth: 'F', status: 'done' },
          { n: '4', slug: 'dataframes-basics', title: 'DataFrame basics', sub: 'create & read; schema; select/filter/withColumn; show', depth: 'F', status: 'done' },
          { n: '5', slug: 'pyspark-setup', title: 'Setting up PySpark', sub: 'pip install pyspark; Java requirement; notebooks & Databricks', depth: 'F', status: 'done' }]},
        { id: 'M1', name: 'Working with data', topics: [
          { n: '6', slug: 'reading-writing', title: 'Reading & writing data', sub: 'CSV/JSON/Parquet; schemas; save modes; partitionBy', depth: 'F', status: 'done' },
          { n: '7', slug: 'transformations-aggregations', title: 'Transformations & aggregations', sub: 'groupBy/agg; joins; window functions', depth: 'D', status: 'done' },
          { n: '8', slug: 'spark-sql', title: 'Spark SQL', sub: 'temp views; SQL vs DataFrame API; catalog', depth: 'D', status: 'done' },
          { n: '9', slug: 'udfs', title: 'UDFs', sub: 'Python UDF cost; pandas UDFs; built-ins first', depth: 'D', status: 'done' },
          { n: '10', slug: 'nulls-types-dates', title: 'Nulls, types & dates', sub: 'null semantics; casting; timestamps & time zones', depth: 'D', status: 'done' }]},
        { id: 'M2', name: 'Internals & performance', topics: [
          { n: '11', slug: 'lazy-eval-dag', title: 'Lazy evaluation & the DAG', sub: 'jobs, stages, tasks; Catalyst; explain()', depth: 'D', status: 'done' },
          { n: '12', slug: 'partitions-shuffle', title: 'Partitions & shuffle', sub: 'partitioning; repartition vs coalesce; shuffle cost', depth: 'X', status: 'done' },
          { n: '13', slug: 'join-strategies', title: 'Join strategies', sub: 'broadcast; sort-merge; skew handling', depth: 'X', status: 'done' },
          { n: '14', slug: 'caching-persistence', title: 'Caching & persistence', sub: 'cache vs persist; storage levels; when to unpersist', depth: 'D', status: 'done' },
          { n: '15', slug: 'memory-tuning-aqe', title: 'Memory, tuning & AQE', sub: 'executor memory; AQE; spill; config knobs', depth: 'X', status: 'done' }]},
        { id: 'M3', name: 'Production', topics: [
          { n: '16', slug: 'structured-streaming', title: 'Structured Streaming', sub: 'micro-batch; watermarks; checkpoints; output modes', depth: 'X', status: 'done' },
          { n: '17', slug: 'delta-lake-lakehouse', title: 'Delta Lake & the lakehouse', sub: 'ACID tables; time travel; MERGE; OPTIMIZE', depth: 'D', status: 'done' },
          { n: '18', slug: 'spark-for-java-devs', title: 'Spark for Java developers', sub: 'Scala/Java API vs PySpark; Py4J; JVM tuning habits', depth: 'D', status: 'done' }]},
        { id: 'M4', name: 'Drill', topics: [
          { n: '★', slug: 'tricky-spark', title: 'Tricky Spark (timed)', sub: '40 mixed puzzles', depth: 'X', status: 'done' }]}
      ]
    },
    {
      id: 'typescript', name: 'TypeScript', icon: 'TS', status: 'live', lang: 'ts',
      blurb: 'From your first type to generics, mapped & conditional types, strict mode and runtime validation.',
      index: { hero: 'TypeScript, <span class=\'grad\'>from types to type-level tricks.</span>', search: 'Search: generics, narrowing, satisfies…', desc: 'From your first type to generics, mapped & conditional types, strict mode and runtime validation.' },
      text: { gotchaSub: 'The traps that let a type check pass and production still break.', codeTitle: 'In your stack', codeLabel: 'TypeScript', codeSub: 'Production-style TypeScript, plus the Java view where it helps.', footer: 'Interview Atlas · TypeScript 5.x unless noted.', metaDesc: 'Animated visuals, gotchas, real-world incidents, puzzles and interview questions.' },
      modules: [
        { id: 'B', name: 'Basics (start here)', topics: [
          { n: 'B1', slug: 'ts-why-setup', title: 'Why TypeScript & setup', sub: 'JS + types; tsc & tsconfig; running TS (tsx, Node type stripping); editor feedback', depth: 'F', status: 'todo' },
          { n: 'B2', slug: 'ts-basic-types', title: 'Basic types', sub: 'string/number/boolean; arrays & tuples; any vs unknown; inference', depth: 'F', status: 'todo' },
          { n: 'B3', slug: 'ts-functions', title: 'Typing functions', sub: 'parameters & returns; optional & default; overloads; void vs never', depth: 'F', status: 'todo' },
          { n: 'B4', slug: 'ts-objects-interfaces', title: 'Objects, interfaces & types', sub: 'interface vs type alias; optional & readonly; index signatures; structural typing', depth: 'F', status: 'todo' },
          { n: 'B5', slug: 'ts-unions-narrowing', title: 'Unions & narrowing', sub: 'union & literal types; typeof/in/instanceof guards; discriminated unions; exhaustiveness', depth: 'F', status: 'todo' },
          { n: 'B6', slug: 'ts-classes', title: 'Classes & enums', sub: 'access modifiers; parameter properties; abstract; enums vs union literals', depth: 'F', status: 'todo' }]},
        { id: 'M1', name: 'Going deeper', topics: [
          { n: '7', slug: 'ts-generics', title: 'Generics', sub: 'generic functions & types; constraints; defaults; inference', depth: 'D', status: 'todo' },
          { n: '8', slug: 'ts-utility-types', title: 'Utility types', sub: 'Partial/Pick/Omit/Record; ReturnType; Awaited; satisfies', depth: 'D', status: 'todo' },
          { n: '9', slug: 'ts-mapped-conditional', title: 'Mapped & conditional types', sub: 'keyof & indexed access; mapped types; conditional & infer; template literal types', depth: 'X', status: 'todo' },
          { n: '10', slug: 'ts-modules-config', title: 'Modules, tsconfig & .d.ts', sub: 'ESM/CJS interop; moduleResolution; declaration files; @types', depth: 'D', status: 'todo' },
          { n: '11', slug: 'ts-strict-mode', title: 'Strict mode & type safety', sub: 'strict flags; noUncheckedIndexedAccess; type assertions & !; escaping any', depth: 'D', status: 'todo' },
          { n: '12', slug: 'ts-runtime-validation', title: 'Types vs runtime', sub: 'type erasure; validating input with Zod; branded types; API contracts', depth: 'D', status: 'todo' }]},
        { id: 'M2', name: 'Practice', topics: [
          { n: '13', slug: 'ts-for-java-devs', title: 'TypeScript for Java developers', sub: 'structural vs nominal; generics differences; no overloading at runtime; enums', depth: 'F', status: 'todo' },
          { n: '★', slug: 'tricky-typescript', title: 'Tricky TypeScript (timed)', sub: '40 mixed puzzles', depth: 'X', status: 'todo' }]}
      ]
    },
    {
      id: 'vue', name: 'Vue.js', icon: 'V', status: 'live', lang: 'ts',
      blurb: 'From templates and ref to components, Pinia, Router, reactivity internals and Nuxt.',
      index: { hero: 'Vue.js, <span class=\'grad\'>from templates to internals.</span>', search: 'Search: ref vs reactive, Pinia, slots…', desc: 'From templates and ref to components, Pinia, Router, reactivity internals and Nuxt.' },
      text: { gotchaSub: 'The traps that make a Vue UI silently stop updating.', codeTitle: 'In your stack', codeLabel: 'Vue', codeSub: 'Vue 3 + TypeScript, script setup.', footer: 'Interview Atlas · Vue 3.x unless noted.', metaDesc: 'Animated visuals, gotchas, real-world incidents, puzzles and interview questions.' },
      modules: [
        { id: 'B', name: 'Basics (start here)', topics: [
          { n: 'B1', slug: 'vue-what-is-vue', title: 'What Vue is', sub: 'progressive framework; Vue vs React vs Angular; Vue 3; ecosystem', depth: 'F', status: 'todo' },
          { n: 'B2', slug: 'vue-setup-vite', title: 'Setup with Vite', sub: 'create-vue; project layout; dev server & build; SFC files', depth: 'F', status: 'todo' },
          { n: 'B3', slug: 'vue-template-syntax', title: 'Template syntax', sub: 'interpolation; v-bind & v-on; v-if/v-show; v-for & key', depth: 'F', status: 'todo' },
          { n: 'B4', slug: 'vue-reactivity-basics', title: 'ref & reactive', sub: 'ref vs reactive; .value; reactivity in templates; common traps', depth: 'F', status: 'todo' },
          { n: 'B5', slug: 'vue-computed-watch', title: 'computed & watch', sub: 'computed caching; watch vs watchEffect; deep & immediate', depth: 'F', status: 'todo' },
          { n: 'B6', slug: 'vue-components', title: 'Components, props & emits', sub: 'defineProps/defineEmits; one-way data flow; v-model on components', depth: 'F', status: 'todo' }]},
        { id: 'M1', name: 'Building apps', topics: [
          { n: '7', slug: 'vue-composition-api', title: 'Composition API & composables', sub: 'script setup; composables; vs Options API', depth: 'D', status: 'todo' },
          { n: '8', slug: 'vue-lifecycle', title: 'Lifecycle hooks', sub: 'onMounted/onUnmounted; nextTick; cleanup', depth: 'D', status: 'todo' },
          { n: '9', slug: 'vue-slots-provide', title: 'Slots & provide/inject', sub: 'default, named & scoped slots; provide/inject', depth: 'D', status: 'todo' },
          { n: '10', slug: 'vue-router', title: 'Vue Router', sub: 'routes & params; navigation guards; lazy routes', depth: 'D', status: 'todo' },
          { n: '11', slug: 'vue-pinia', title: 'State with Pinia', sub: 'stores; state/getters/actions; storeToRefs; vs props', depth: 'D', status: 'todo' },
          { n: '12', slug: 'vue-forms', title: 'Forms & v-model', sub: 'v-model modifiers; validation; async submit', depth: 'F', status: 'todo' }]},
        { id: 'M2', name: 'Internals & production', topics: [
          { n: '13', slug: 'vue-reactivity-internals', title: 'Reactivity internals', sub: 'Proxy; track & trigger; effect scheduling; why destructuring loses reactivity', depth: 'X', status: 'todo' },
          { n: '14', slug: 'vue-rendering-perf', title: 'Rendering & performance', sub: 'virtual DOM & compiler hints; v-memo, shallowRef; KeepAlive; lazy loading', depth: 'X', status: 'todo' },
          { n: '15', slug: 'vue-ssr-nuxt', title: 'SSR & Nuxt', sub: 'SSR vs SPA; hydration; Nuxt basics; data fetching', depth: 'D', status: 'todo' },
          { n: '16', slug: 'vue-testing', title: 'Testing Vue', sub: 'Vitest & Vue Test Utils; component tests; Playwright e2e', depth: 'D', status: 'todo' },
          { n: '★', slug: 'tricky-vue', title: 'Tricky Vue (timed)', sub: '40 mixed puzzles', depth: 'X', status: 'todo' }]}
      ]
    },
    {
      id: 'frontend', name: 'Modern frontend', icon: '◧', status: 'live', lang: 'ts',
      blurb: 'How browsers render, rendering modes, hydration, server components, signals, Web Vitals, security and testing.',
      index: { hero: 'Modern frontend, <span class=\'grad\'>concepts interviewers ask.</span>', search: 'Search: hydration, INP, CSP…', desc: 'How browsers render, rendering modes, hydration, server components, signals, Web Vitals, security and testing.' },
      text: { gotchaSub: 'The traps behind slow, broken or insecure frontends.', codeTitle: 'In your stack', codeLabel: 'Frontend', codeSub: 'Framework-neutral TypeScript, React and Vue where it helps.', footer: 'Interview Atlas · current browsers unless noted.', metaDesc: 'Animated visuals, gotchas, real-world incidents, puzzles and interview questions.' },
      modules: [
        { id: 'B', name: 'Basics (start here)', topics: [
          { n: 'B1', slug: 'fe-how-browser-works', title: 'How the browser renders', sub: 'HTML→DOM, CSS→CSSOM; layout, paint, composite; reflow', depth: 'F', status: 'todo' },
          { n: 'B2', slug: 'fe-critical-rendering-path', title: 'Critical rendering path', sub: 'render-blocking CSS/JS; async & defer; preload', depth: 'F', status: 'todo' },
          { n: 'B3', slug: 'fe-modern-css', title: 'Modern CSS', sub: 'flexbox & grid; container queries; :has(); cascade layers', depth: 'F', status: 'todo' },
          { n: 'B4', slug: 'fe-rendering-modes', title: 'CSR, SSR, SSG & ISR', sub: 'what each is; trade-offs; when to pick which', depth: 'F', status: 'todo' }]},
        { id: 'M1', name: 'Modern architecture', topics: [
          { n: '5', slug: 'fe-hydration-islands', title: 'Hydration, islands & resumability', sub: 'hydration cost; partial/progressive hydration; islands (Astro); resumability (Qwik)', depth: 'D', status: 'todo' },
          { n: '6', slug: 'fe-server-components', title: 'React Server Components', sub: 'server vs client components; streaming & Suspense; server actions', depth: 'X', status: 'todo' },
          { n: '7', slug: 'fe-signals', title: 'Signals & fine-grained reactivity', sub: 'signals vs VDOM; Solid, Vue, Angular signals; TC39 proposal', depth: 'D', status: 'todo' },
          { n: '8', slug: 'fe-state-management', title: 'State management', sub: 'local vs global vs server state; TanStack Query; stores', depth: 'D', status: 'todo' },
          { n: '9', slug: 'fe-build-tools', title: 'Bundlers & build tools', sub: 'Vite, esbuild, Rollup, Turbopack; tree shaking; code splitting', depth: 'D', status: 'todo' },
          { n: '10', slug: 'fe-microfrontends', title: 'Micro-frontends', sub: 'module federation; composition strategies; when not to', depth: 'D', status: 'todo' },
          { n: '11', slug: 'fe-web-components', title: 'Web Components', sub: 'custom elements; shadow DOM; interop with frameworks', depth: 'D', status: 'todo' }]},
        { id: 'M2', name: 'Quality & production', topics: [
          { n: '12', slug: 'fe-core-web-vitals', title: 'Core Web Vitals', sub: 'LCP, INP, CLS; measuring (RUM vs lab); fixes', depth: 'D', status: 'todo' },
          { n: '13', slug: 'fe-accessibility', title: 'Accessibility', sub: 'semantic HTML; ARIA; keyboard & focus; WCAG basics', depth: 'D', status: 'todo' },
          { n: '14', slug: 'fe-security', title: 'Frontend security', sub: 'XSS & CSP; CORS; CSRF; cookies & token storage', depth: 'D', status: 'todo' },
          { n: '15', slug: 'fe-caching-pwa', title: 'Caching, CDN & PWA', sub: 'HTTP caching; CDN; service workers; offline', depth: 'D', status: 'todo' },
          { n: '16', slug: 'fe-testing', title: 'Frontend testing', sub: 'unit vs component vs e2e; Vitest; Playwright; visual tests', depth: 'D', status: 'todo' },
          { n: '★', slug: 'tricky-frontend', title: 'Tricky frontend (timed)', sub: '40 mixed puzzles', depth: 'X', status: 'todo' }]}
      ]
    },
    {
      id: 'databricks', name: 'Databricks', icon: '◆', status: 'live', lang: 'python',
      blurb: 'From workspace and Unity Catalog to medallion pipelines, Auto Loader, Lakeflow, Photon, MLflow and cost.',
      index: { hero: 'Databricks, <span class=\'grad\'>from workspace to lakehouse.</span>', search: 'Search: Unity Catalog, Auto Loader, Photon…', desc: 'From workspace and Unity Catalog to medallion pipelines, Auto Loader, Lakeflow, Photon, MLflow and cost.' },
      text: { gotchaSub: 'The traps that cost DBUs, data or a weekend.', codeTitle: 'In your stack', codeLabel: 'Databricks', codeSub: 'PySpark and SQL on Databricks, plus Asset Bundle YAML.', footer: 'Interview Atlas · features as of late 2025; check your runtime.', metaDesc: 'Animated visuals, gotchas, real-world incidents, puzzles and interview questions.' },
      modules: [
        { id: 'B', name: 'Basics (start here)', topics: [
          { n: 'B1', slug: 'dbx-what-is-databricks', title: 'What Databricks is', sub: 'lakehouse idea; Spark + Delta + governance; clouds; vs Snowflake', depth: 'F', status: 'todo' },
          { n: 'B2', slug: 'dbx-workspace-compute', title: 'Workspace & compute', sub: 'workspace; all-purpose vs job compute; serverless; runtimes', depth: 'F', status: 'todo' },
          { n: 'B3', slug: 'dbx-notebooks-git', title: 'Notebooks & Git folders', sub: 'notebooks; magic commands; dbutils; Git folders', depth: 'F', status: 'todo' },
          { n: 'B4', slug: 'dbx-unity-catalog', title: 'Unity Catalog', sub: 'metastore, catalog, schema, table; permissions; volumes; lineage', depth: 'F', status: 'todo' },
          { n: 'B5', slug: 'dbx-delta-tables', title: 'Delta tables on Databricks', sub: 'managed vs external; MERGE; time travel; OPTIMIZE & liquid clustering', depth: 'F', status: 'todo' }]},
        { id: 'M1', name: 'Data engineering', topics: [
          { n: '6', slug: 'dbx-medallion', title: 'Medallion architecture', sub: 'bronze/silver/gold; idempotent loads; SCD type 2', depth: 'D', status: 'todo' },
          { n: '7', slug: 'dbx-auto-loader', title: 'Auto Loader & ingestion', sub: 'cloudFiles; schema inference & evolution; COPY INTO', depth: 'D', status: 'todo' },
          { n: '8', slug: 'dbx-declarative-pipelines', title: 'Lakeflow Declarative Pipelines (DLT)', sub: 'streaming tables & materialized views; expectations; CDC with AUTO CDC', depth: 'D', status: 'todo' },
          { n: '9', slug: 'dbx-jobs-workflows', title: 'Jobs & workflows', sub: 'tasks & dependencies; job clusters; retries; parameters', depth: 'D', status: 'todo' },
          { n: '10', slug: 'dbx-streaming', title: 'Streaming on Databricks', sub: 'Structured Streaming; triggers; checkpoints; Kafka', depth: 'D', status: 'todo' }]},
        { id: 'M2', name: 'Analytics, ML & ops', topics: [
          { n: '11', slug: 'dbx-sql-warehouses', title: 'Databricks SQL & warehouses', sub: 'SQL warehouses; serverless; dashboards; query tuning', depth: 'D', status: 'todo' },
          { n: '12', slug: 'dbx-performance', title: 'Performance & Photon', sub: 'Photon; caching; data skipping; partitioning vs clustering', depth: 'X', status: 'todo' },
          { n: '13', slug: 'dbx-mlflow', title: 'MLflow & ML', sub: 'experiments & runs; model registry in UC; serving', depth: 'D', status: 'todo' },
          { n: '14', slug: 'dbx-asset-bundles', title: 'Asset Bundles & CI/CD', sub: 'bundles; environments; deploying jobs; service principals', depth: 'D', status: 'todo' },
          { n: '15', slug: 'dbx-cost-governance', title: 'Cost & governance', sub: 'DBUs; cluster policies; system tables; tagging', depth: 'D', status: 'todo' },
          { n: '★', slug: 'tricky-databricks', title: 'Tricky Databricks (timed)', sub: '40 mixed puzzles', depth: 'X', status: 'todo' }]}
      ]
    },
    { id: 'ai-agents', name: 'AI agents (Python)', icon: '✦', status: 'soon', blurb: 'Coming later.', modules: [] }
  ]
};
