# TRACKS-TRACKER: Java, Spring, Kubernetes, Python, Node.js & Azure

> Resume point for the six tracks added to the Interview Atlas (`docs/`). Read this first in a new session and update it in every commit. The SQL track has its own tracker in `TRACKER.md`.

## How it is built
- Each topic is `docs/data/<track>/<slug>.js` plus `docs/assets/js/widgets/<track>/<slug>*.js` (schema: `tools/AUTHORING.md`). `docs/assets/js/catalog.js` holds the modules, topics and subtopics.
- **Phase 2 (content):** Opus sub-agents write topics. Agent A/B/C own the slugs in the tables below. Status `todo → written`.
- **Phase 3 (validation, at the end):** page checks (no errors, every section, no overflow at 390px), and puzzle verification (Java/Python/Node snippets executed; Kubernetes/Azure/Spring reviewed against the docs). Status `written → done`, and the catalog topic gets `status: 'done'`.
- Status values: `todo` · `written` · `done` · `needs-fix`.

## Validation summary (Phase 3)
- **Pages:** all 195 Atlas topic pages pass `tools/check_topic.cjs` (no console errors, every section, no horizontal scroll at 390px). 69 pages first overflowed on phones because of long inline tokens; a shared CSS wrap rule fixed them.
- **Runnable puzzles:** all 418 `run: true` puzzles and drill questions print their `expect` when executed (`tools/verify_puzzles.cjs`: java 153, python 158, nodejs 107). One answer was wrong (PEP 695 TypeVar repr) and is fixed.
- **Playgrounds:** 125 Python presets ran cleanly on CPython. 15 JS presets ran in the browser sandbox; this found and fixed a sandbox bug that cut off busy code.
- **Docs review:** 4 Opus reviewers checked every flagged claim, every concept/scenario puzzle (~730) and all 292 drill questions (runnable ones executed, the rest reviewed). Fixes: Kubernetes 10 (mostly newer GA versions), Spring 11, Azure 8, Java/Python/Node 6. Claims they could check only from memory are listed in their reports in the agent log below.
- **Site:** 571 pages crawled with no broken links; old `sql-atlas/` URLs redirect to `atlas/`.

## Status board
| Track | Topics | todo | written | done |
|---|---|---|---|---|
| Java & JVM (`java`) | 28 | 0 | 0 | 28 |
| Spring & Spring Boot (`spring`) | 27 | 0 | 0 | 27 |
| Kubernetes (`kubernetes`) | 25 | 0 | 0 | 25 |
| Python (`python`) | 22 | 0 | 0 | 22 |
| Node.js (`nodejs`) | 21 | 0 | 0 | 21 |
| Azure (`azure`) | 26 | 0 | 0 | 26 |
| **Total** | **149** | **0** | **0** | **149** |

## Agent log
| Wave | Agent | Track | Slugs | Status | Report |
|---|---|---|---|---|---|
| 1 | java-A | Java & JVM | 10 topics: `references-pass-by-value`, `equals-hashcode`, `immutability-records`, `generics-erasure`, `exceptions`, `strings-interning`, `sealed-pattern-matching`, `lambdas-functional`, `streams-collectors`, `optional` | done | 10 written, 63 runnable puzzles; uncertain: precise-rethrow retry helper compiles, OpenJDK-specific puzzle outputs (List.of contains null, count skips peek), Hibernate/Jackson version claims |
| 1 | java-B | Java & JVM | 8 topics: `hashmap-internals`, `choosing-collections`, `concurrent-collections`, `class-loading`, `jvm-memory-areas`, `garbage-collection`, `jit-compilation`, `leaks-oom` | done | 8 written, 26 runnable puzzles, extra choosing-collections-bigo; uncertain: OOM array message, object sizes, JIT thresholds, G1/ZGC log formats |
| 2 | java-C | Java & JVM | 10 topics: `threads-executors`, `java-memory-model`, `locks-synchronized`, `completablefuture`, `virtual-threads`, `concurrency-bugs`, `java-versions`, `profiling-jfr`, `io-nio`, `tricky-java` | done | 10 written incl. tricky-java (48 Qs, 30 runnable); 34 runnable topic puzzles; uncertain: JFR custom-event puzzle, helpful-NPE static field text, JDK 25 scoped values/structured concurrency status |
| 1 | spring-A | Spring & Spring Boot | 9 topics: `ioc-di`, `bean-lifecycle-scopes`, `configuration-profiles`, `aop-proxies`, `spring-events`, `auto-configuration`, `starters-dependencies`, `externalized-config`, `actuator-observability` | done | 9 written, 65 concept puzzles, extras for scopes/conditions/aop-order/trace; uncertain: 6.1 @Transactional on tx listeners, Modulith property name, graceful shutdown default 3.4, 6.2 @Fallback/background bootstrap |
| 1 | spring-B | Spring & Spring Boot | 9 topics: `boot-testing`, `mvc-request-flow`, `errors-validation`, `webflux-reactive`, `http-clients`, `transactions-propagation`, `jpa-n-plus-1`, `spring-data`, `hikari-pooling` | done | 9 written, 61 concept puzzles, 5 extras (testing intro, groups, backpressure, OSIV, derived queries); uncertain: RestTemplate deprecation wording, Reactor Netty pool defaults, 6.2 rollbackOn, pgjdbc readOnly mode, Hibernate batch SQL |
| 2 | spring-C | Spring & Spring Boot | 9 topics: `security-filter-chain`, `oauth2-jwt`, `kafka-messaging`, `resilience`, `caching`, `async-scheduling`, `aot-native`, `startup-performance`, `tricky-spring` | done | 9 written incl. tricky-spring (50 Qs); 55 concept puzzles, 6 extras (outbox, storm, shedlock, memory, startup); uncertain: Security 6 chain-order startup failure version, Boot 3.x property minors, readiness after ApplicationReadyEvent |
| 1 | kubernetes-A | Kubernetes | 8 topics: `containers-vs-vms`, `architecture`, `pods`, `desired-state`, `deployments-rollouts`, `statefulsets-jobs`, `probes`, `resources-qos` | done | 8 written, 59 scenario puzzles, extras rollout-strategies/qos-eviction; uncertain: native sidecar GA 1.33, CronJob 100-missed rule, eviction order, JDK cgroup backports |
| 1 | kubernetes-B | Kubernetes | 8 topics: `services`, `ingress-gateway`, `dns-network-policy`, `configmaps-secrets`, `volumes-storage`, `scheduling`, `autoscaling`, `disruptions-pdb` | done | 8 written, 59 scenario puzzles, 4 extras (netpol, spread, nodes, shutdown); uncertain: GA versions (nftables 1.33, PVC retention 1.32, unhealthyPodEvictionPolicy 1.31), ingress-nginx retirement dates |
| 2 | kubernetes-C | Kubernetes | 9 topics: `rbac-security`, `debugging`, `observability`, `helm-kustomize-gitops`, `operators-crds`, `jvm-on-k8s`, `multi-tenancy-cost`, `cluster-upgrades`, `tricky-k8s` | done | 9 written incl. tricky-k8s (50 Qs, shuffled); 67 scenario puzzles, extra jvm-on-k8s-cpu; uncertain: JDK CPU-shares change, Paketo thread count, MutatingAdmissionPolicy alpha 1.32, Argo CD poll interval |
| 1 | python-A | Python | 8 topics: `data-model`, `scoping-closures`, `dunder-methods`, `iterators-generators`, `decorators`, `context-managers`, `typing`, `dataclasses-pydantic` | done | 8 written, 60 runnable puzzles, 6 Pyodide presets each; uncertain: class-body comprehension scope, 3.13 dataclass __eq__, Pydantic lax-mode coercions, runtime_checkable data members |
| 2 | python-B | Python | 7 topics: `memory-gc`, `gil`, `dict-internals`, `imports`, `threading-multiprocessing`, `asyncio`, `concurrency-choice` | done | 7 written, 36 runnable puzzles, 38 Pyodide presets; uncertain: 3.13/3.14 GC + free-threading details, dict/set resize rules, default pool sizing, Pyodide tempfile + task order |
| 2 | python-C | Python | 7 topics: `packaging`, `pytest`, `performance`, `fastapi`, `errors-logging`, `python-for-java-devs`, `tricky-python` | done | 7 written incl. tricky-python (46 Qs, 33 runnable); 29 runnable topic puzzles, 2 extras (logging flow, Java habits); uncertain: FastAPI yield-teardown timing, uv image tag, Pyodide settrace/cProfile availability |
| 1 | nodejs-A | Node.js | 7 topics: `node-architecture`, `event-loop-phases`, `microtasks-macrotasks`, `modules-cjs-esm`, `npm-dependencies`, `callbacks-promises-async`, `async-errors` | done | 7 written, 25 runnable puzzles; uncertain: ESM nextTick order, return-await ticks, require(esm) version notes, AbortError/TimeoutError names |
| 2 | nodejs-B | Node.js | 6 topics: `streams-backpressure`, `eventemitter`, `blocking-event-loop`, `worker-threads-cluster`, `v8-gc-leaks`, `profiling` | done | 6 written, 24 runnable puzzles; uncertain: Node 22 default highWaterMark 64 KiB, pipeline destroy order, DataCloneError name, memoryUsage key order, undici channel names |
| 2 | nodejs-C | Node.js | 8 topics: `express-fastify`, `http-internals`, `security`, `graceful-shutdown`, `typescript-node`, `testing-node`, `node-vs-java`, `tricky-node` | done | 8 written incl. tricky-node (48 Qs, 30 runnable, questions live in the widget); 28 runnable topic puzzles; uncertain: strip-types flags, agent property names, mock.timers Date, timing-threshold puzzles |
| 1 | azure-A | Azure | 9 topics: `azure-hierarchy`, `regions-zones`, `entra-managed-identity`, `rbac-policy`, `compute-choice`, `app-service`, `container-apps`, `aks`, `functions` | done | 9 written, 59 scenario puzzles, extras aks-net/aks-wi/functions-durable; uncertain: role GUIDs, App Service/Container Apps defaults, Flex CLI flags, DefaultAzureCredential order |
| 2 | azure-B | Azure | 9 topics: `storage-accounts`, `azure-sql-postgres`, `cosmos-db`, `redis-cache`, `messaging-choice`, `api-management`, `vnet-private-endpoints`, `key-vault`, `front-door-gateway` | done | 9 written, 64 scenario puzzles, 4 extras (access, consistency, net, choose); uncertain: az CLI flags (migration, redis access policy, dns-resolver, WAF exclusions), KQL column names, Spring Cloud Azure property names; APIM XML shown as yaml |
| 2 | azure-C | Azure | 8 topics: `monitor-app-insights`, `bicep-terraform`, `devops-pipelines`, `cost-management`, `azure-openai`, `well-architected`, `spring-on-azure`, `tricky-azure` | done | 8 written incl. tricky-azure (50 Qs, shuffled); 50 scenario puzzles; uncertain: App Insights agent sampling defaults, federated-credential limit, AOAI metric names, Spring AI keyless wiring, drill facts (APIM quota 403, Redis default policy, Functions 230 s) |

## Java & JVM (`java`, 28 topics)
Verified by: `java`. Code language: `java`.

| # | slug | Topic | Subtopics | Depth | Agent | Status | Verified |
|---|---|---|---|---|---|---|---|
| **M0** | | **Language core** | | | | | |
| 1 | `references-pass-by-value` | References & pass-by-value | stack vs heap refs; why Java is always pass-by-value; == vs equals; aliasing bugs | F | A | done | run (java 21) + review |
| 2 | `equals-hashcode` | equals & hashCode contract | the contract; mutable keys in HashMap; records’ generated methods; Comparable consistency | D | A | done | run (java 21) + review |
| 3 | `immutability-records` | Immutability & records | final vs immutable; defensive copies; records & compact constructors; List.of vs unmodifiableList | D | A | done | run (java 21) + review |
| 4 | `generics-erasure` | Generics & type erasure | erasure & bridge methods; PECS (? extends / ? super); heap pollution; raw types | X | A | done | run (java 21) + review |
| 5 | `exceptions` | Exceptions done right | checked vs unchecked; try-with-resources & suppressed; finally pitfalls; exception translation | D | A | done | run (java 21) + review |
| 6 | `strings-interning` | Strings, interning & text | string pool & intern(); compact strings; concatenation & StringBuilder; text blocks; Unicode pitfalls | D | A | done | run (java 21) + review |
| 7 | `sealed-pattern-matching` | Sealed types & pattern matching | sealed interfaces; record patterns; switch patterns & exhaustiveness; guarded patterns | D | A | done | run (java 21) + review |
| 8 | `lambdas-functional` | Lambdas & functional interfaces | invokedynamic; effectively final capture; method references; built-in functional interfaces | D | A | done | run (java 21) + review |
| 9 | `streams-collectors` | Streams & collectors | laziness & short-circuit; stateful ops; groupingBy/toMap traps; parallel streams & the common pool | D | A | done | run (java 21) + review |
| 10 | `optional` | Optional | intended use; orElse vs orElseGet; anti-patterns (fields, params); map/flatMap chains | F | A | done | run (java 21) + review |
| **M1** | | **Collections** | | | | | |
| 11 | `hashmap-internals` | HashMap internals | buckets & hashing; resize & load factor; treeification; iteration order; ConcurrentModificationException | X | B | done | run (java 21) + review |
| 12 | `choosing-collections` | Choosing collections | ArrayList vs LinkedList; ArrayDeque; TreeMap/NavigableMap; EnumMap/Set; big-O table | F | B | done | run (java 21) + review |
| 13 | `concurrent-collections` | Concurrent collections | ConcurrentHashMap (compute, size); CopyOnWrite; BlockingQueues; ConcurrentSkipList | X | B | done | run (java 21) + review |
| **M2** | | **JVM internals** | | | | | |
| 14 | `class-loading` | Class loading | delegation model; linking & init order; static init deadlock; ClassCastException across loaders; metaspace leaks | X | B | done | run (java 21) + review |
| 15 | `jvm-memory-areas` | JVM memory areas | heap generations; stack & frames; metaspace; direct memory; object header & compressed oops | X | B | done | run (java 21) + review |
| 16 | `garbage-collection` | Garbage collection | reachability & GC roots; G1 regions & pauses; ZGC/Shenandoah; choosing & tuning; reading GC logs | X | B | done | run (java 21) + review |
| 17 | `jit-compilation` | JIT compilation | interpreter → C1 → C2 tiers; inlining & escape analysis; deoptimization; warm-up & microbenchmark traps (JMH) | X | B | done | run (java 21) + review |
| 18 | `leaks-oom` | Memory leaks & OOM | OOM kinds; leak patterns (static maps, ThreadLocal, listeners); heap dumps & MAT; container memory limits | X | B | done | run (java 21) + review |
| **M3** | | **Concurrency** | | | | | |
| 19 | `threads-executors` | Threads & executors | thread lifecycle; ThreadPoolExecutor params & rejection; sizing pools; shutdown | D | C | done | run (java 21) + review |
| 20 | `java-memory-model` | Java Memory Model | happens-before; volatile; safe publication; double-checked locking; final-field semantics | X | C | done | run (java 21) + review |
| 21 | `locks-synchronized` | Locks & synchronized | monitors; ReentrantLock & Conditions; ReadWriteLock & StampedLock; fairness | X | C | done | run (java 21) + review |
| 22 | `completablefuture` | CompletableFuture | thenApply vs thenCompose; async executors; exception handling; allOf/anyOf; timeouts | D | C | done | run (java 21) + review |
| 23 | `virtual-threads` | Virtual threads (Java 21) | carrier threads & mounting; pinning (synchronized, native); structured concurrency; when not to use them | X | C | done | run (java 21) + review |
| 24 | `concurrency-bugs` | Concurrency bugs | race conditions; deadlock & livelock; thread dumps; lost updates; atomics & LongAdder | X | C | done | run (java 21) + review |
| **M4** | | **Modern Java & production** | | | | | |
| 25 | `java-versions` | Java 8 → 21 tour | LTS timeline; key features per version; migration traps (modules, removed APIs) | F | C | done | run (java 21) + review |
| 26 | `profiling-jfr` | Profiling & JFR | JFR & JMC; async-profiler flame graphs; CPU vs alloc profiling; safepoint bias | X | C | done | run (java 21) + review |
| 27 | `io-nio` | I/O & NIO | blocking vs non-blocking; buffers & channels; memory-mapped files; selectors | D | C | done | run (java 21) + review |
| **M5** | | **Drill** | | | | | |
| ★ | `tricky-java` | Tricky Java (timed) | 50 mixed puzzles across the track | X | C | done | run (java 21) + review |

## Spring & Spring Boot (`spring`, 27 topics)
Verified by: `docs`. Code language: `java`.

| # | slug | Topic | Subtopics | Depth | Agent | Status | Verified |
|---|---|---|---|---|---|---|---|
| **M0** | | **Spring core** | | | | | |
| 1 | `ioc-di` | IoC & dependency injection | ApplicationContext; constructor vs field injection; @Qualifier/@Primary; circular deps | F | A | done | docs review (Spring source/release notes) |
| 2 | `bean-lifecycle-scopes` | Bean lifecycle & scopes | instantiate → populate → init → destroy; BeanPostProcessor; scopes & scoped proxies; prototype-in-singleton trap | D | A | done | docs review (Spring source/release notes) |
| 3 | `configuration-profiles` | @Configuration & profiles | full vs lite mode (CGLIB); @Bean methods; @Profile & @Conditional; import ordering | D | A | done | docs review (Spring source/release notes) |
| 4 | `aop-proxies` | AOP & proxies | JDK vs CGLIB proxies; the self-invocation trap; pointcuts & advice order; final methods | X | A | done | docs review (Spring source/release notes) |
| 5 | `spring-events` | Application events | publish & listen; @TransactionalEventListener phases; async events; ordering | D | A | done | docs review (Spring source/release notes) |
| **M1** | | **Spring Boot** | | | | | |
| 6 | `auto-configuration` | Auto-configuration | AutoConfiguration.imports; @ConditionalOn*; condition evaluation report; writing your own | X | A | done | docs review (Spring source/release notes) |
| 7 | `starters-dependencies` | Starters & dependency management | BOMs & parent POM; version overrides; dependency conflicts; Gradle vs Maven | F | A | done | docs review (Spring source/release notes) |
| 8 | `externalized-config` | Externalized configuration | property-source order; @ConfigurationProperties & validation; profiles; secrets | D | A | done | docs review (Spring source/release notes) |
| 9 | `actuator-observability` | Actuator & observability | health groups & probes; Micrometer metrics; tracing (OTel); securing endpoints | D | A | done | docs review (Spring source/release notes) |
| 10 | `boot-testing` | Testing in Boot | test slices; @MockitoBean; Testcontainers & @ServiceConnection; context caching | D | B | done | docs review (Spring source/release notes) |
| **M2** | | **Web** | | | | | |
| 11 | `mvc-request-flow` | Spring MVC request flow | DispatcherServlet; handler mapping & adapters; argument resolvers; message converters; interceptors vs filters | X | B | done | docs review (Spring source/release notes) |
| 12 | `errors-validation` | Errors & validation | @ControllerAdvice; ProblemDetail (RFC 9457); Bean Validation groups; validation in services | D | B | done | docs review (Spring source/release notes) |
| 13 | `webflux-reactive` | WebFlux & reactive | Mono/Flux; Netty event loop; backpressure; blocking-call traps; when to choose MVC | X | B | done | docs review (Spring source/release notes) |
| 14 | `http-clients` | HTTP clients | RestClient vs WebClient vs RestTemplate; timeouts; connection pools; HTTP interfaces | D | B | done | docs review (Spring source/release notes) |
| **M3** | | **Data** | | | | | |
| 15 | `transactions-propagation` | @Transactional deep dive | propagation & isolation; rollback rules; proxy pitfalls; readOnly; transaction boundaries | X | B | done | docs review (Spring source/release notes) |
| 16 | `jpa-n-plus-1` | JPA fetching & N+1 | lazy vs eager; N+1 detection; fetch joins & entity graphs; LazyInitializationException & OSIV | X | B | done | docs review (Spring source/release notes) |
| 17 | `spring-data` | Spring Data repositories | derived queries; projections; paging & slicing; auditing; custom repos | D | B | done | docs review (Spring source/release notes) |
| 18 | `hikari-pooling` | HikariCP & connection pools | pool sizing; timeouts; leak detection; pool exhaustion incidents | D | B | done | docs review (Spring source/release notes) |
| **M4** | | **Security** | | | | | |
| 19 | `security-filter-chain` | Security filter chain | SecurityFilterChain beans; authentication flow; method security; CSRF & CORS | X | C | done | docs review (Spring source/release notes) |
| 20 | `oauth2-jwt` | OAuth2, OIDC & JWT | resource server; JWT validation & JWKS; client credentials; token relay | D | C | done | docs review (Spring source/release notes) |
| **M5** | | **Distributed & async** | | | | | |
| 21 | `kafka-messaging` | Kafka with Spring | listener containers; offsets & ack modes; retries & DLT; idempotency & outbox | X | C | done | docs review (Spring source/release notes) |
| 22 | `resilience` | Resilience patterns | Resilience4j circuit breaker, retry, bulkhead & time limiter; retry storms | D | C | done | docs review (Spring source/release notes) |
| 23 | `caching` | Caching abstraction | @Cacheable semantics & keys; Caffeine vs Redis; stampede & TTLs; self-invocation again | D | C | done | docs review (Spring source/release notes) |
| 24 | `async-scheduling` | @Async & scheduling | executors; @Scheduled & ShedLock; virtual threads in Boot 3.2+; context propagation | D | C | done | docs review (Spring source/release notes) |
| **M6** | | **Production** | | | | | |
| 25 | `aot-native` | AOT & native image | GraalVM native; reachability metadata; startup vs throughput; CRaC | X | C | done | docs review (Spring source/release notes) |
| 26 | `startup-performance` | Startup & runtime performance | lazy init; class-data sharing; graceful shutdown; memory sizing in containers | D | C | done | docs review (Spring source/release notes) |
| **M7** | | **Drill** | | | | | |
| ★ | `tricky-spring` | Tricky Spring (timed) | 50 mixed puzzles across the track | X | C | done | docs review (Spring source/release notes) |

## Kubernetes (`kubernetes`, 25 topics)
Verified by: `docs`. Code language: `yaml`.

| # | slug | Topic | Subtopics | Depth | Agent | Status | Verified |
|---|---|---|---|---|---|---|---|
| **M0** | | **Foundations** | | | | | |
| 1 | `containers-vs-vms` | Containers vs VMs | namespaces & cgroups; image layers; OCI; why orchestration | F | A | done | docs review (kubernetes.io/KEPs) |
| 2 | `architecture` | Cluster architecture | API server, etcd, scheduler & controller manager; kubelet & kube-proxy; request path of kubectl apply | D | A | done | docs review (kubernetes.io/KEPs) |
| 3 | `pods` | Pods | multi-container patterns (sidecar, init); pod lifecycle & phases; restart policy; native sidecars (1.29+) | F | A | done | docs review (kubernetes.io/KEPs) |
| 4 | `desired-state` | Desired state & reconciliation | declarative vs imperative; controllers & control loops; owner references & garbage collection; labels & selectors | D | A | done | docs review (kubernetes.io/KEPs) |
| **M1** | | **Workloads** | | | | | |
| 5 | `deployments-rollouts` | Deployments & rollouts | ReplicaSets; rolling update (maxSurge/maxUnavailable); rollback; blue-green & canary | D | A | done | docs review (kubernetes.io/KEPs) |
| 6 | `statefulsets-jobs` | StatefulSet, DaemonSet & Jobs | stable identity & ordered rollout; DaemonSets; Jobs & CronJobs; backoff & concurrency | D | A | done | docs review (kubernetes.io/KEPs) |
| 7 | `probes` | Probes | liveness vs readiness vs startup; probe-induced outages; tuning for JVM warm-up | D | A | done | docs review (kubernetes.io/KEPs) |
| 8 | `resources-qos` | Requests, limits & QoS | scheduling on requests; CPU throttling (CFS); OOMKilled; QoS classes & eviction | X | A | done | docs review (kubernetes.io/KEPs) |
| **M2** | | **Networking** | | | | | |
| 9 | `services` | Services | ClusterIP, NodePort & LoadBalancer; kube-proxy (iptables/IPVS); EndpointSlices; headless services | D | B | done | docs review (kubernetes.io/KEPs) |
| 10 | `ingress-gateway` | Ingress & Gateway API | ingress controllers; TLS termination; Gateway API resources; path routing | D | B | done | docs review (kubernetes.io/KEPs) |
| 11 | `dns-network-policy` | DNS & NetworkPolicy | CoreDNS & ndots; default-allow; writing policies; CNI’s role | X | B | done | docs review (kubernetes.io/KEPs) |
| **M3** | | **Config & storage** | | | | | |
| 12 | `configmaps-secrets` | ConfigMaps & Secrets | env vs volume mounts; update propagation; secrets are base64, not encryption; external secrets | D | B | done | docs review (kubernetes.io/KEPs) |
| 13 | `volumes-storage` | Volumes, PV & PVC | volume types; StorageClass & dynamic provisioning; access modes; reclaim policy | D | B | done | docs review (kubernetes.io/KEPs) |
| **M4** | | **Scheduling & scaling** | | | | | |
| 14 | `scheduling` | Scheduler, affinity & taints | filtering & scoring; node/pod (anti-)affinity; taints & tolerations; topology spread | X | B | done | docs review (kubernetes.io/KEPs) |
| 15 | `autoscaling` | HPA, VPA & Cluster Autoscaler | metrics pipeline; HPA algorithm & stabilization; VPA modes; Karpenter / Cluster Autoscaler; KEDA | X | B | done | docs review (kubernetes.io/KEPs) |
| 16 | `disruptions-pdb` | Disruptions & PDBs | voluntary vs involuntary; PodDisruptionBudgets; node drains; graceful termination & preStop | D | B | done | docs review (kubernetes.io/KEPs) |
| **M5** | | **Security & operations** | | | | | |
| 17 | `rbac-security` | RBAC & Pod security | Roles & bindings; service accounts & tokens; Pod Security Standards; securityContext | D | C | done | docs review (kubernetes.io/KEPs) |
| 18 | `debugging` | Debugging workloads | CrashLoopBackOff, ImagePullBackOff & Pending; kubectl debug & ephemeral containers; events & logs | D | C | done | docs review (kubernetes.io/KEPs) |
| 19 | `observability` | Observability | metrics-server & Prometheus; logging architectures; tracing; golden signals | D | C | done | docs review (kubernetes.io/KEPs) |
| 20 | `helm-kustomize-gitops` | Helm, Kustomize & GitOps | charts & values; overlays; Argo CD / Flux; drift | D | C | done | docs review (kubernetes.io/KEPs) |
| 21 | `operators-crds` | Operators & CRDs | custom resources; the operator pattern; admission webhooks; finalizers | X | C | done | docs review (kubernetes.io/KEPs) |
| 22 | `jvm-on-k8s` | Java/Spring on Kubernetes | container-aware JVM (MaxRAMPercentage); probes with Actuator; graceful shutdown; image building (Jib, buildpacks) | X | C | done | docs review (kubernetes.io/KEPs) |
| 23 | `multi-tenancy-cost` | Namespaces, quotas & cost | ResourceQuota & LimitRange; multi-tenancy models; right-sizing | D | C | done | docs review (kubernetes.io/KEPs) |
| 24 | `cluster-upgrades` | Upgrades & cluster ops | version skew; node upgrades; etcd backup; API deprecations | X | C | done | docs review (kubernetes.io/KEPs) |
| **M6** | | **Drill** | | | | | |
| ★ | `tricky-k8s` | Tricky Kubernetes (timed) | 50 mixed scenario puzzles | X | C | done | docs review (kubernetes.io/KEPs) |

## Python (`python`, 22 topics)
Verified by: `python3`. Code language: `python`.

| # | slug | Topic | Subtopics | Depth | Agent | Status | Verified |
|---|---|---|---|---|---|---|---|
| **M0** | | **Language core** | | | | | |
| 1 | `data-model` | Everything is an object | names vs objects; identity vs equality; mutability; small-int & string caching | F | A | done | run (python3) + review |
| 2 | `scoping-closures` | Scope, closures & defaults | LEGB; nonlocal/global; late-binding closures; mutable default arguments | D | A | done | run (python3) + review |
| 3 | `dunder-methods` | Dunder methods & protocols | __repr__/__eq__/__hash__; operator overloading; container protocols; __slots__ | D | A | done | run (python3) + review |
| 4 | `iterators-generators` | Iterators & generators | iteration protocol; generators & yield from; laziness; itertools | D | A | done | run (python3) + review |
| 5 | `decorators` | Decorators | functions as objects; functools.wraps; parameterized decorators; class decorators | D | A | done | run (python3) + review |
| 6 | `context-managers` | Context managers | with protocol; contextlib; exceptions in __exit__; ExitStack | D | A | done | run (python3) + review |
| 7 | `typing` | Type hints | generics & Protocols; TypedDict; mypy/pyright; runtime vs static | D | A | done | run (python3) + review |
| 8 | `dataclasses-pydantic` | Dataclasses & Pydantic | field defaults; frozen & slots; Pydantic v2 validation; when to use which | D | A | done | run (python3) + review |
| **M1** | | **Internals** | | | | | |
| 9 | `memory-gc` | Memory & garbage collection | reference counting; cyclic GC & generations; weakref; memory leaks | X | B | done | run (python3) + review |
| 10 | `gil` | The GIL & free-threading | what the GIL protects; CPU- vs I/O-bound; PEP 703 free-threaded 3.13 | X | B | done | run (python3) + review |
| 11 | `dict-internals` | Dict & set internals | hash tables; insertion order; key requirements; performance traps | X | B | done | run (python3) + review |
| 12 | `imports` | Import system | modules & packages; sys.path; circular imports; __main__ | D | B | done | run (python3) + review |
| **M2** | | **Concurrency** | | | | | |
| 13 | `threading-multiprocessing` | Threads vs processes | threading; multiprocessing & pickling; concurrent.futures; shared state | D | B | done | run (python3) + review |
| 14 | `asyncio` | asyncio event loop | coroutines & tasks; await semantics; blocking the loop; TaskGroup & cancellation | X | B | done | run (python3) + review |
| 15 | `concurrency-choice` | Choosing a concurrency model | decision guide; mixing sync & async; async frameworks | D | B | done | run (python3) + review |
| **M3** | | **Practice** | | | | | |
| 16 | `packaging` | Packaging & environments | venv; pip vs uv vs poetry; pyproject.toml; lockfiles & reproducibility | F | C | done | run (python3) + review |
| 17 | `pytest` | Testing with pytest | fixtures & scopes; parametrize; mocking & monkeypatch; coverage | D | C | done | run (python3) + review |
| 18 | `performance` | Profiling & performance | cProfile & py-spy; vectorize with NumPy; C extensions & Cython; common slow patterns | D | C | done | run (python3) + review |
| 19 | `fastapi` | FastAPI services | routing & dependency injection; Pydantic models; async endpoints; production serving (uvicorn/gunicorn) | D | C | done | run (python3) + review |
| 20 | `errors-logging` | Exceptions & logging | exception hierarchy & chaining; ExceptionGroup; logging config; structured logs | D | C | done | run (python3) + review |
| 21 | `python-for-java-devs` | Python for Java developers | idiom mapping; duck typing vs interfaces; where Java habits hurt | F | C | done | run (python3) + review |
| **M4** | | **Drill** | | | | | |
| ★ | `tricky-python` | Tricky Python (timed) | 50 mixed puzzles | X | C | done | run (python3) + review |

## Node.js (`nodejs`, 21 topics)
Verified by: `node`. Code language: `js`.

| # | slug | Topic | Subtopics | Depth | Agent | Status | Verified |
|---|---|---|---|---|---|---|---|
| **M0** | | **Runtime** | | | | | |
| 1 | `node-architecture` | Node architecture | V8 + libuv; the thread pool; bindings; single-threaded myth | F | A | done | run (node 22) + review |
| 2 | `event-loop-phases` | Event-loop phases | timers, poll, check & close; setImmediate vs setTimeout; I/O callbacks | X | A | done | run (node 22) + review |
| 3 | `microtasks-macrotasks` | Microtasks vs macrotasks | promise jobs; process.nextTick priority; starvation; ordering puzzles | X | A | done | run (node 22) + review |
| 4 | `modules-cjs-esm` | CommonJS vs ESM | require vs import; interop; package.json "type"; top-level await | D | A | done | run (node 22) + review |
| 5 | `npm-dependencies` | npm & dependencies | semver & lockfiles; peer deps; supply-chain risk; workspaces | F | A | done | run (node 22) + review |
| **M1** | | **Async** | | | | | |
| 6 | `callbacks-promises-async` | Callbacks → promises → async/await | promise states; Promise.all/allSettled/race/any; sequential vs parallel awaits | D | A | done | run (node 22) + review |
| 7 | `async-errors` | Async error handling | unhandled rejections; errors in callbacks; AbortController; domains are gone | D | A | done | run (node 22) + review |
| 8 | `streams-backpressure` | Streams & backpressure | readable/writable/transform; pipeline; highWaterMark; async iteration | X | B | done | run (node 22) + review |
| 9 | `eventemitter` | EventEmitter | listeners & once; error events; memory-leak warnings; patterns | D | B | done | run (node 22) + review |
| **M2** | | **Performance** | | | | | |
| 10 | `blocking-event-loop` | Blocking the event loop | CPU work; sync APIs; JSON on big payloads; measuring event-loop lag | X | B | done | run (node 22) + review |
| 11 | `worker-threads-cluster` | Worker threads & cluster | worker_threads & SharedArrayBuffer; cluster & PM2; when to scale out instead | D | B | done | run (node 22) + review |
| 12 | `v8-gc-leaks` | V8 memory & leaks | heap spaces; GC (Scavenge, Mark-Compact); leak patterns; heap snapshots | X | B | done | run (node 22) + review |
| 13 | `profiling` | Profiling Node | --inspect & --cpu-prof; flame graphs; clinic.js; diagnostics_channel | D | B | done | run (node 22) + review |
| **M3** | | **Web** | | | | | |
| 14 | `express-fastify` | Express & Fastify | middleware chain; error middleware; Fastify schemas & performance | D | C | done | run (node 22) + review |
| 15 | `http-internals` | HTTP internals | keep-alive & agents; timeouts; HTTP/2; fetch (undici) | X | C | done | run (node 22) + review |
| 16 | `security` | Node security | injection & prototype pollution; ReDoS; secrets; the permission model | D | C | done | run (node 22) + review |
| **M4** | | **Production** | | | | | |
| 17 | `graceful-shutdown` | Graceful shutdown & containers | SIGTERM handling; draining connections; PID 1; health checks | D | C | done | run (node 22) + review |
| 18 | `typescript-node` | TypeScript on Node | tsconfig for Node; type stripping (22.6+); ESM & TS | D | C | done | run (node 22) + review |
| 19 | `testing-node` | Testing Node | node:test vs Jest/Vitest; mocking timers; integration tests | D | C | done | run (node 22) + review |
| 20 | `node-vs-java` | Node vs Java for services | concurrency models; when to pick which; interop | D | C | done | run (node 22) + review |
| **M5** | | **Drill** | | | | | |
| ★ | `tricky-node` | Tricky Node (timed) | 50 mixed puzzles | X | C | done | run (node 22) + review |

## Azure (`azure`, 26 topics)
Verified by: `docs`. Code language: `bash`.

| # | slug | Topic | Subtopics | Depth | Agent | Status | Verified |
|---|---|---|---|---|---|---|---|
| **M0** | | **Foundations** | | | | | |
| 1 | `azure-hierarchy` | Tenants to resources | Entra tenant; management groups; subscriptions; resource groups & ARM | F | A | done | docs review (Microsoft Learn) |
| 2 | `regions-zones` | Regions & availability zones | region pairs; zonal vs zone-redundant; SLAs & composite SLAs | F | A | done | docs review (Microsoft Learn) |
| 3 | `entra-managed-identity` | Entra ID & managed identities | app registrations vs service principals; system vs user-assigned MI; DefaultAzureCredential | D | A | done | docs review (Microsoft Learn) |
| 4 | `rbac-policy` | RBAC & Azure Policy | role assignments & scopes; custom roles; Policy & initiatives; landing zones | D | A | done | docs review (Microsoft Learn) |
| **M1** | | **Compute** | | | | | |
| 5 | `compute-choice` | Choosing compute | VMs vs App Service vs Container Apps vs AKS vs Functions decision guide | D | A | done | docs review (Microsoft Learn) |
| 6 | `app-service` | App Service | plans & scaling; deployment slots; Java/Spring deploys; always-on & health checks | D | A | done | docs review (Microsoft Learn) |
| 7 | `container-apps` | Container Apps | environments; revisions & traffic split; KEDA scaling; Dapr | D | A | done | docs review (Microsoft Learn) |
| 8 | `aks` | AKS | node pools; networking (kubenet, CNI overlay); workload identity; upgrades | X | A | done | docs review (Microsoft Learn) |
| 9 | `functions` | Azure Functions | triggers & bindings; plans (Consumption, Flex, Premium); cold starts; Durable Functions | D | A | done | docs review (Microsoft Learn) |
| **M2** | | **Data** | | | | | |
| 10 | `storage-accounts` | Storage accounts | Blob tiers; redundancy (LRS→GZRS); SAS vs MI access; lifecycle rules | D | B | done | docs review (Microsoft Learn) |
| 11 | `azure-sql-postgres` | Azure SQL & Postgres Flexible Server | tiers; HA & read replicas; connection pooling (PgBouncer); backups & PITR | D | B | done | docs review (Microsoft Learn) |
| 12 | `cosmos-db` | Cosmos DB | partition keys; RUs; the five consistency levels; change feed | X | B | done | docs review (Microsoft Learn) |
| 13 | `redis-cache` | Azure Cache for Redis | tiers; eviction; clustering; cache-aside with Spring | D | B | done | docs review (Microsoft Learn) |
| **M3** | | **Integration** | | | | | |
| 14 | `messaging-choice` | Service Bus vs Event Hubs vs Event Grid | queues & topics; sessions & DLQ; partitions & consumer groups; event routing | X | B | done | docs review (Microsoft Learn) |
| 15 | `api-management` | API Management | policies; products & subscriptions; rate limiting; versioning | D | B | done | docs review (Microsoft Learn) |
| **M4** | | **Networking & security** | | | | | |
| 16 | `vnet-private-endpoints` | VNets & private endpoints | subnets & NSGs; private endpoint vs service endpoint; private DNS zones; hub-spoke | X | B | done | docs review (Microsoft Learn) |
| 17 | `key-vault` | Key Vault | secrets, keys & certs; RBAC vs access policies; Spring Cloud Azure integration; rotation | D | B | done | docs review (Microsoft Learn) |
| 18 | `front-door-gateway` | Front Door & Application Gateway | global vs regional; WAF; routing rules; choosing a load balancer | D | B | done | docs review (Microsoft Learn) |
| **M5** | | **Operations & architecture** | | | | | |
| 19 | `monitor-app-insights` | Monitor & Application Insights | Log Analytics & KQL; App Insights Java agent; alerts; distributed tracing | D | C | done | docs review (Microsoft Learn) |
| 20 | `bicep-terraform` | Bicep & Terraform | ARM vs Bicep; modules; Terraform azurerm; what-if & drift | D | C | done | docs review (Microsoft Learn) |
| 21 | `devops-pipelines` | CI/CD pipelines | Azure DevOps vs GitHub Actions; OIDC federation; environments & approvals | D | C | done | docs review (Microsoft Learn) |
| 22 | `cost-management` | Cost management | pricing models (reserved, savings plans, spot); budgets; common cost leaks | D | C | done | docs review (Microsoft Learn) |
| 23 | `azure-openai` | Azure OpenAI & AI Foundry | deployments & quotas (TPM); content filters; RAG with AI Search; Spring AI | D | C | done | docs review (Microsoft Learn) |
| 24 | `well-architected` | Well-Architected & reliability | the five pillars; reliability patterns; disaster recovery (RTO/RPO) | D | C | done | docs review (Microsoft Learn) |
| 25 | `spring-on-azure` | Spring apps on Azure end to end | reference architecture; identity-first config; observability; migration options | X | C | done | docs review (Microsoft Learn) |
| **M6** | | **Drill** | | | | | |
| ★ | `tricky-azure` | Tricky Azure (timed) | 50 mixed scenario puzzles | X | C | done | docs review (Microsoft Learn) |

## Python Basics module (`python`, module B, 12 topics)
B1–B12: `py-setup-first-program`, `variables-types`, `operators-expressions`, `strings`, `control-flow`, `lists-tuples`, `dicts-sets`, `functions-basics`, `comprehensions`, `classes-basics`, `exceptions-basics`, `files-modules-stdlib`. Status: done. 89 new runnable puzzles pass (`verify_puzzles.cjs python`: 247/247); all Pyodide presets run on CPython; `check_topic.cjs` 12/12.

## Spark & PySpark (`spark`, 19 topics)
M0 Basics (why-spark, spark-architecture, rdd-basics, dataframes-basics, pyspark-setup), M1 Working with data (reading-writing, transformations-aggregations, spark-sql, udfs, nulls-types-dates), M2 Internals (lazy-eval-dag, partitions-shuffle, join-strategies, caching-persistence, memory-tuning-aqe), M3 Production (structured-streaming, delta-lake-lakehouse, spark-for-java-devs), Drill (tricky-spark, 40 Qs). Status: done. Puzzles are concept questions; playground presets are plain-Python simulations and all run. Flagged claims checked against local PySpark 4.0.1 (ANSI default, CAST_INVALID_INPUT, AQE defaults 64 MB / 5 / 256 MB, UDF wrong-type → NULL, na.fill on NaN, WindowExec warning, withColumnsRenamed/toArrow/try_to_timestamp/max_by). Not checked live: Delta Lake defaults, Structured Streaming version notes, Kubernetes memory-overhead factor. `check_topic.cjs` 19/19.

## Basics (start here) modules: Java, Spring, Node.js, Kubernetes, Azure (34 topics)
Module `B` added at the front of each track, numbered B1… so existing numbers are unchanged.
- Java (8): java-setup-first-program, java-types-variables, java-operators-control-flow, java-arrays-strings-basics, java-methods, java-classes-objects, java-inheritance-interfaces, java-collections-basics. 50 runnable puzzles pass (`verify_puzzles.cjs java` 203/203).
- Spring (6): spring-what-is-spring, spring-first-app, spring-layers, spring-rest-basics, spring-config-basics, spring-data-jpa-basics. Concept puzzles.
- Node.js (8): node-setup-first-script, js-variables-types, js-functions-basics, js-objects-arrays, js-control-flow-errors, js-classes-modules, js-async-basics, node-first-http-server. 51 runnable puzzles pass (`nodejs` 158/158); all 31 JS presets run.
- Kubernetes (6): docker-basics, k8s-local-cluster, kubectl-basics, k8s-yaml-manifests, first-deployment-service, configmaps-secrets-basics. Concept puzzles.
- Azure (6): cloud-basics, azure-portal-cli, azure-services-tour, azure-storage-basics, azure-networking-basics, azure-first-deploy. Concept puzzles.
`check_topic.cjs` passes on all 34. Not checked against live docs (docs hosts blocked): Spring Boot defaults (ddl-auto, properties vs yml precedence), K8s event TTL / --validate=strict, Azure runtime strings and Bicep API versions, exact JDK launcher error texts.

## New tracks: TypeScript, Vue.js, Modern frontend, Databricks (64 topics)
Each starts with a Basics (start here) module and ends with a timed 40-question drill.
- TypeScript (`typescript`, 14): basics B1–B6, deeper (generics, utility, mapped/conditional, modules/config, strict, runtime validation), ts-for-java-devs, tricky-typescript. 49 runnable puzzles pass via `verify_puzzles.cjs typescript` (new runner: `node --experimental-strip-types`).
- Vue.js (`vue`, 17): basics B1–B6, building apps, internals & production, tricky-vue. Concept puzzles.
- Modern frontend (`frontend`, 17): browser rendering, CRP, modern CSS, rendering modes, hydration/islands, RSC, signals, state, build tools, micro-frontends, web components, Core Web Vitals, a11y, security, caching/PWA, testing, tricky-frontend. Concept puzzles.
- Databricks (`databricks`, 16): basics B1–B5, data engineering, analytics/ML/ops, tricky-databricks. Concept puzzles.
`check_topic.cjs`: 64/64. All JS and Python playground presets run (one Vue/TS strict-mode preset and one slow frontend preset fixed to fit the 5 s sandbox). Not checked against live docs (docs hosts blocked): fast-moving version/status claims (Vue 3.5/3.6 Vapor, Nuxt 4, Next.js caching defaults, TC39 Signals stage, Vite/Rolldown, web-vitals v5 field names), Databricks product renames, CLI subcommands and system-table column names.
