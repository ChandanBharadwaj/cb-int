# TRACKS-TRACKER: Java, Spring, Kubernetes, Python, Node.js & Azure

> Resume point for the six tracks added to the Interview Atlas (`docs/`). Read this first in a new session and update it in every commit. The SQL track has its own tracker in `TRACKER.md`.

## How it is built
- Each topic is `docs/data/<track>/<slug>.js` plus `docs/assets/js/widgets/<track>/<slug>*.js` (schema: `tools/AUTHORING.md`). `docs/assets/js/catalog.js` holds the modules, topics and subtopics.
- **Phase 2 (content):** Opus sub-agents write topics. Agent A/B/C own the slugs in the tables below. Status `todo → written`.
- **Phase 3 (validation, at the end):** page checks (no errors, every section, no overflow at 390px), and puzzle verification (Java/Python/Node snippets executed; Kubernetes/Azure/Spring reviewed against the docs). Status `written → done`, and the catalog topic gets `status: 'done'`.
- Status values: `todo` · `written` · `done` · `needs-fix`.

## Status board
| Track | Topics | todo | written | done |
|---|---|---|---|---|
| Java & JVM (`java`) | 28 | 28 | 0 | 0 |
| Spring & Spring Boot (`spring`) | 27 | 27 | 0 | 0 |
| Kubernetes (`kubernetes`) | 25 | 25 | 0 | 0 |
| Python (`python`) | 22 | 14 | 8 | 0 |
| Node.js (`nodejs`) | 21 | 14 | 7 | 0 |
| Azure (`azure`) | 26 | 26 | 0 | 0 |
| **Total** | **149** | **134** | **15** | **0** |

## Agent log
| Wave | Agent | Track | Slugs | Status | Report |
|---|---|---|---|---|---|
| 1 | java-A | Java & JVM | 10 topics: `references-pass-by-value`, `equals-hashcode`, `immutability-records`, `generics-erasure`, `exceptions`, `strings-interning`, `sealed-pattern-matching`, `lambdas-functional`, `streams-collectors`, `optional` | pending | |
| 1 | java-B | Java & JVM | 8 topics: `hashmap-internals`, `choosing-collections`, `concurrent-collections`, `class-loading`, `jvm-memory-areas`, `garbage-collection`, `jit-compilation`, `leaks-oom` | pending | |
| 2 | java-C | Java & JVM | 10 topics: `threads-executors`, `java-memory-model`, `locks-synchronized`, `completablefuture`, `virtual-threads`, `concurrency-bugs`, `java-versions`, `profiling-jfr`, `io-nio`, `tricky-java` | pending | |
| 1 | spring-A | Spring & Spring Boot | 9 topics: `ioc-di`, `bean-lifecycle-scopes`, `configuration-profiles`, `aop-proxies`, `spring-events`, `auto-configuration`, `starters-dependencies`, `externalized-config`, `actuator-observability` | pending | |
| 1 | spring-B | Spring & Spring Boot | 9 topics: `boot-testing`, `mvc-request-flow`, `errors-validation`, `webflux-reactive`, `http-clients`, `transactions-propagation`, `jpa-n-plus-1`, `spring-data`, `hikari-pooling` | pending | |
| 2 | spring-C | Spring & Spring Boot | 9 topics: `security-filter-chain`, `oauth2-jwt`, `kafka-messaging`, `resilience`, `caching`, `async-scheduling`, `aot-native`, `startup-performance`, `tricky-spring` | pending | |
| 1 | kubernetes-A | Kubernetes | 8 topics: `containers-vs-vms`, `architecture`, `pods`, `desired-state`, `deployments-rollouts`, `statefulsets-jobs`, `probes`, `resources-qos` | pending | |
| 1 | kubernetes-B | Kubernetes | 8 topics: `services`, `ingress-gateway`, `dns-network-policy`, `configmaps-secrets`, `volumes-storage`, `scheduling`, `autoscaling`, `disruptions-pdb` | pending | |
| 2 | kubernetes-C | Kubernetes | 9 topics: `rbac-security`, `debugging`, `observability`, `helm-kustomize-gitops`, `operators-crds`, `jvm-on-k8s`, `multi-tenancy-cost`, `cluster-upgrades`, `tricky-k8s` | pending | |
| 1 | python-A | Python | 8 topics: `data-model`, `scoping-closures`, `dunder-methods`, `iterators-generators`, `decorators`, `context-managers`, `typing`, `dataclasses-pydantic` | done | 8 written, 60 runnable puzzles, 6 Pyodide presets each; uncertain: class-body comprehension scope, 3.13 dataclass __eq__, Pydantic lax-mode coercions, runtime_checkable data members |
| 2 | python-B | Python | 7 topics: `memory-gc`, `gil`, `dict-internals`, `imports`, `threading-multiprocessing`, `asyncio`, `concurrency-choice` | pending | |
| 2 | python-C | Python | 7 topics: `packaging`, `pytest`, `performance`, `fastapi`, `errors-logging`, `python-for-java-devs`, `tricky-python` | pending | |
| 1 | nodejs-A | Node.js | 7 topics: `node-architecture`, `event-loop-phases`, `microtasks-macrotasks`, `modules-cjs-esm`, `npm-dependencies`, `callbacks-promises-async`, `async-errors` | done | 7 written, 25 runnable puzzles; uncertain: ESM nextTick order, return-await ticks, require(esm) version notes, AbortError/TimeoutError names |
| 2 | nodejs-B | Node.js | 6 topics: `streams-backpressure`, `eventemitter`, `blocking-event-loop`, `worker-threads-cluster`, `v8-gc-leaks`, `profiling` | pending | |
| 2 | nodejs-C | Node.js | 8 topics: `express-fastify`, `http-internals`, `security`, `graceful-shutdown`, `typescript-node`, `testing-node`, `node-vs-java`, `tricky-node` | pending | |
| 1 | azure-A | Azure | 9 topics: `azure-hierarchy`, `regions-zones`, `entra-managed-identity`, `rbac-policy`, `compute-choice`, `app-service`, `container-apps`, `aks`, `functions` | pending | |
| 2 | azure-B | Azure | 9 topics: `storage-accounts`, `azure-sql-postgres`, `cosmos-db`, `redis-cache`, `messaging-choice`, `api-management`, `vnet-private-endpoints`, `key-vault`, `front-door-gateway` | pending | |
| 2 | azure-C | Azure | 8 topics: `monitor-app-insights`, `bicep-terraform`, `devops-pipelines`, `cost-management`, `azure-openai`, `well-architected`, `spring-on-azure`, `tricky-azure` | pending | |

## Java & JVM (`java`, 28 topics)
Verified by: `java`. Code language: `java`.

| # | slug | Topic | Subtopics | Depth | Agent | Status | Verified |
|---|---|---|---|---|---|---|---|
| **M0** | | **Language core** | | | | | |
| 1 | `references-pass-by-value` | References & pass-by-value | stack vs heap refs; why Java is always pass-by-value; == vs equals; aliasing bugs | F | A | todo | |
| 2 | `equals-hashcode` | equals & hashCode contract | the contract; mutable keys in HashMap; records’ generated methods; Comparable consistency | D | A | todo | |
| 3 | `immutability-records` | Immutability & records | final vs immutable; defensive copies; records & compact constructors; List.of vs unmodifiableList | D | A | todo | |
| 4 | `generics-erasure` | Generics & type erasure | erasure & bridge methods; PECS (? extends / ? super); heap pollution; raw types | X | A | todo | |
| 5 | `exceptions` | Exceptions done right | checked vs unchecked; try-with-resources & suppressed; finally pitfalls; exception translation | D | A | todo | |
| 6 | `strings-interning` | Strings, interning & text | string pool & intern(); compact strings; concatenation & StringBuilder; text blocks; Unicode pitfalls | D | A | todo | |
| 7 | `sealed-pattern-matching` | Sealed types & pattern matching | sealed interfaces; record patterns; switch patterns & exhaustiveness; guarded patterns | D | A | todo | |
| 8 | `lambdas-functional` | Lambdas & functional interfaces | invokedynamic; effectively final capture; method references; built-in functional interfaces | D | A | todo | |
| 9 | `streams-collectors` | Streams & collectors | laziness & short-circuit; stateful ops; groupingBy/toMap traps; parallel streams & the common pool | D | A | todo | |
| 10 | `optional` | Optional | intended use; orElse vs orElseGet; anti-patterns (fields, params); map/flatMap chains | F | A | todo | |
| **M1** | | **Collections** | | | | | |
| 11 | `hashmap-internals` | HashMap internals | buckets & hashing; resize & load factor; treeification; iteration order; ConcurrentModificationException | X | B | todo | |
| 12 | `choosing-collections` | Choosing collections | ArrayList vs LinkedList; ArrayDeque; TreeMap/NavigableMap; EnumMap/Set; big-O table | F | B | todo | |
| 13 | `concurrent-collections` | Concurrent collections | ConcurrentHashMap (compute, size); CopyOnWrite; BlockingQueues; ConcurrentSkipList | X | B | todo | |
| **M2** | | **JVM internals** | | | | | |
| 14 | `class-loading` | Class loading | delegation model; linking & init order; static init deadlock; ClassCastException across loaders; metaspace leaks | X | B | todo | |
| 15 | `jvm-memory-areas` | JVM memory areas | heap generations; stack & frames; metaspace; direct memory; object header & compressed oops | X | B | todo | |
| 16 | `garbage-collection` | Garbage collection | reachability & GC roots; G1 regions & pauses; ZGC/Shenandoah; choosing & tuning; reading GC logs | X | B | todo | |
| 17 | `jit-compilation` | JIT compilation | interpreter → C1 → C2 tiers; inlining & escape analysis; deoptimization; warm-up & microbenchmark traps (JMH) | X | B | todo | |
| 18 | `leaks-oom` | Memory leaks & OOM | OOM kinds; leak patterns (static maps, ThreadLocal, listeners); heap dumps & MAT; container memory limits | X | B | todo | |
| **M3** | | **Concurrency** | | | | | |
| 19 | `threads-executors` | Threads & executors | thread lifecycle; ThreadPoolExecutor params & rejection; sizing pools; shutdown | D | C | todo | |
| 20 | `java-memory-model` | Java Memory Model | happens-before; volatile; safe publication; double-checked locking; final-field semantics | X | C | todo | |
| 21 | `locks-synchronized` | Locks & synchronized | monitors; ReentrantLock & Conditions; ReadWriteLock & StampedLock; fairness | X | C | todo | |
| 22 | `completablefuture` | CompletableFuture | thenApply vs thenCompose; async executors; exception handling; allOf/anyOf; timeouts | D | C | todo | |
| 23 | `virtual-threads` | Virtual threads (Java 21) | carrier threads & mounting; pinning (synchronized, native); structured concurrency; when not to use them | X | C | todo | |
| 24 | `concurrency-bugs` | Concurrency bugs | race conditions; deadlock & livelock; thread dumps; lost updates; atomics & LongAdder | X | C | todo | |
| **M4** | | **Modern Java & production** | | | | | |
| 25 | `java-versions` | Java 8 → 21 tour | LTS timeline; key features per version; migration traps (modules, removed APIs) | F | C | todo | |
| 26 | `profiling-jfr` | Profiling & JFR | JFR & JMC; async-profiler flame graphs; CPU vs alloc profiling; safepoint bias | X | C | todo | |
| 27 | `io-nio` | I/O & NIO | blocking vs non-blocking; buffers & channels; memory-mapped files; selectors | D | C | todo | |
| **M5** | | **Drill** | | | | | |
| ★ | `tricky-java` | Tricky Java (timed) | 50 mixed puzzles across the track | X | C | todo | |

## Spring & Spring Boot (`spring`, 27 topics)
Verified by: `docs`. Code language: `java`.

| # | slug | Topic | Subtopics | Depth | Agent | Status | Verified |
|---|---|---|---|---|---|---|---|
| **M0** | | **Spring core** | | | | | |
| 1 | `ioc-di` | IoC & dependency injection | ApplicationContext; constructor vs field injection; @Qualifier/@Primary; circular deps | F | A | todo | |
| 2 | `bean-lifecycle-scopes` | Bean lifecycle & scopes | instantiate → populate → init → destroy; BeanPostProcessor; scopes & scoped proxies; prototype-in-singleton trap | D | A | todo | |
| 3 | `configuration-profiles` | @Configuration & profiles | full vs lite mode (CGLIB); @Bean methods; @Profile & @Conditional; import ordering | D | A | todo | |
| 4 | `aop-proxies` | AOP & proxies | JDK vs CGLIB proxies; the self-invocation trap; pointcuts & advice order; final methods | X | A | todo | |
| 5 | `spring-events` | Application events | publish & listen; @TransactionalEventListener phases; async events; ordering | D | A | todo | |
| **M1** | | **Spring Boot** | | | | | |
| 6 | `auto-configuration` | Auto-configuration | AutoConfiguration.imports; @ConditionalOn*; condition evaluation report; writing your own | X | A | todo | |
| 7 | `starters-dependencies` | Starters & dependency management | BOMs & parent POM; version overrides; dependency conflicts; Gradle vs Maven | F | A | todo | |
| 8 | `externalized-config` | Externalized configuration | property-source order; @ConfigurationProperties & validation; profiles; secrets | D | A | todo | |
| 9 | `actuator-observability` | Actuator & observability | health groups & probes; Micrometer metrics; tracing (OTel); securing endpoints | D | A | todo | |
| 10 | `boot-testing` | Testing in Boot | test slices; @MockitoBean; Testcontainers & @ServiceConnection; context caching | D | B | todo | |
| **M2** | | **Web** | | | | | |
| 11 | `mvc-request-flow` | Spring MVC request flow | DispatcherServlet; handler mapping & adapters; argument resolvers; message converters; interceptors vs filters | X | B | todo | |
| 12 | `errors-validation` | Errors & validation | @ControllerAdvice; ProblemDetail (RFC 9457); Bean Validation groups; validation in services | D | B | todo | |
| 13 | `webflux-reactive` | WebFlux & reactive | Mono/Flux; Netty event loop; backpressure; blocking-call traps; when to choose MVC | X | B | todo | |
| 14 | `http-clients` | HTTP clients | RestClient vs WebClient vs RestTemplate; timeouts; connection pools; HTTP interfaces | D | B | todo | |
| **M3** | | **Data** | | | | | |
| 15 | `transactions-propagation` | @Transactional deep dive | propagation & isolation; rollback rules; proxy pitfalls; readOnly; transaction boundaries | X | B | todo | |
| 16 | `jpa-n-plus-1` | JPA fetching & N+1 | lazy vs eager; N+1 detection; fetch joins & entity graphs; LazyInitializationException & OSIV | X | B | todo | |
| 17 | `spring-data` | Spring Data repositories | derived queries; projections; paging & slicing; auditing; custom repos | D | B | todo | |
| 18 | `hikari-pooling` | HikariCP & connection pools | pool sizing; timeouts; leak detection; pool exhaustion incidents | D | B | todo | |
| **M4** | | **Security** | | | | | |
| 19 | `security-filter-chain` | Security filter chain | SecurityFilterChain beans; authentication flow; method security; CSRF & CORS | X | C | todo | |
| 20 | `oauth2-jwt` | OAuth2, OIDC & JWT | resource server; JWT validation & JWKS; client credentials; token relay | D | C | todo | |
| **M5** | | **Distributed & async** | | | | | |
| 21 | `kafka-messaging` | Kafka with Spring | listener containers; offsets & ack modes; retries & DLT; idempotency & outbox | X | C | todo | |
| 22 | `resilience` | Resilience patterns | Resilience4j circuit breaker, retry, bulkhead & time limiter; retry storms | D | C | todo | |
| 23 | `caching` | Caching abstraction | @Cacheable semantics & keys; Caffeine vs Redis; stampede & TTLs; self-invocation again | D | C | todo | |
| 24 | `async-scheduling` | @Async & scheduling | executors; @Scheduled & ShedLock; virtual threads in Boot 3.2+; context propagation | D | C | todo | |
| **M6** | | **Production** | | | | | |
| 25 | `aot-native` | AOT & native image | GraalVM native; reachability metadata; startup vs throughput; CRaC | X | C | todo | |
| 26 | `startup-performance` | Startup & runtime performance | lazy init; class-data sharing; graceful shutdown; memory sizing in containers | D | C | todo | |
| **M7** | | **Drill** | | | | | |
| ★ | `tricky-spring` | Tricky Spring (timed) | 50 mixed puzzles across the track | X | C | todo | |

## Kubernetes (`kubernetes`, 25 topics)
Verified by: `docs`. Code language: `yaml`.

| # | slug | Topic | Subtopics | Depth | Agent | Status | Verified |
|---|---|---|---|---|---|---|---|
| **M0** | | **Foundations** | | | | | |
| 1 | `containers-vs-vms` | Containers vs VMs | namespaces & cgroups; image layers; OCI; why orchestration | F | A | todo | |
| 2 | `architecture` | Cluster architecture | API server, etcd, scheduler & controller manager; kubelet & kube-proxy; request path of kubectl apply | D | A | todo | |
| 3 | `pods` | Pods | multi-container patterns (sidecar, init); pod lifecycle & phases; restart policy; native sidecars (1.29+) | F | A | todo | |
| 4 | `desired-state` | Desired state & reconciliation | declarative vs imperative; controllers & control loops; owner references & garbage collection; labels & selectors | D | A | todo | |
| **M1** | | **Workloads** | | | | | |
| 5 | `deployments-rollouts` | Deployments & rollouts | ReplicaSets; rolling update (maxSurge/maxUnavailable); rollback; blue-green & canary | D | A | todo | |
| 6 | `statefulsets-jobs` | StatefulSet, DaemonSet & Jobs | stable identity & ordered rollout; DaemonSets; Jobs & CronJobs; backoff & concurrency | D | A | todo | |
| 7 | `probes` | Probes | liveness vs readiness vs startup; probe-induced outages; tuning for JVM warm-up | D | A | todo | |
| 8 | `resources-qos` | Requests, limits & QoS | scheduling on requests; CPU throttling (CFS); OOMKilled; QoS classes & eviction | X | A | todo | |
| **M2** | | **Networking** | | | | | |
| 9 | `services` | Services | ClusterIP, NodePort & LoadBalancer; kube-proxy (iptables/IPVS); EndpointSlices; headless services | D | B | todo | |
| 10 | `ingress-gateway` | Ingress & Gateway API | ingress controllers; TLS termination; Gateway API resources; path routing | D | B | todo | |
| 11 | `dns-network-policy` | DNS & NetworkPolicy | CoreDNS & ndots; default-allow; writing policies; CNI’s role | X | B | todo | |
| **M3** | | **Config & storage** | | | | | |
| 12 | `configmaps-secrets` | ConfigMaps & Secrets | env vs volume mounts; update propagation; secrets are base64, not encryption; external secrets | D | B | todo | |
| 13 | `volumes-storage` | Volumes, PV & PVC | volume types; StorageClass & dynamic provisioning; access modes; reclaim policy | D | B | todo | |
| **M4** | | **Scheduling & scaling** | | | | | |
| 14 | `scheduling` | Scheduler, affinity & taints | filtering & scoring; node/pod (anti-)affinity; taints & tolerations; topology spread | X | B | todo | |
| 15 | `autoscaling` | HPA, VPA & Cluster Autoscaler | metrics pipeline; HPA algorithm & stabilization; VPA modes; Karpenter / Cluster Autoscaler; KEDA | X | B | todo | |
| 16 | `disruptions-pdb` | Disruptions & PDBs | voluntary vs involuntary; PodDisruptionBudgets; node drains; graceful termination & preStop | D | B | todo | |
| **M5** | | **Security & operations** | | | | | |
| 17 | `rbac-security` | RBAC & Pod security | Roles & bindings; service accounts & tokens; Pod Security Standards; securityContext | D | C | todo | |
| 18 | `debugging` | Debugging workloads | CrashLoopBackOff, ImagePullBackOff & Pending; kubectl debug & ephemeral containers; events & logs | D | C | todo | |
| 19 | `observability` | Observability | metrics-server & Prometheus; logging architectures; tracing; golden signals | D | C | todo | |
| 20 | `helm-kustomize-gitops` | Helm, Kustomize & GitOps | charts & values; overlays; Argo CD / Flux; drift | D | C | todo | |
| 21 | `operators-crds` | Operators & CRDs | custom resources; the operator pattern; admission webhooks; finalizers | X | C | todo | |
| 22 | `jvm-on-k8s` | Java/Spring on Kubernetes | container-aware JVM (MaxRAMPercentage); probes with Actuator; graceful shutdown; image building (Jib, buildpacks) | X | C | todo | |
| 23 | `multi-tenancy-cost` | Namespaces, quotas & cost | ResourceQuota & LimitRange; multi-tenancy models; right-sizing | D | C | todo | |
| 24 | `cluster-upgrades` | Upgrades & cluster ops | version skew; node upgrades; etcd backup; API deprecations | X | C | todo | |
| **M6** | | **Drill** | | | | | |
| ★ | `tricky-k8s` | Tricky Kubernetes (timed) | 50 mixed scenario puzzles | X | C | todo | |

## Python (`python`, 22 topics)
Verified by: `python3`. Code language: `python`.

| # | slug | Topic | Subtopics | Depth | Agent | Status | Verified |
|---|---|---|---|---|---|---|---|
| **M0** | | **Language core** | | | | | |
| 1 | `data-model` | Everything is an object | names vs objects; identity vs equality; mutability; small-int & string caching | F | A | written | |
| 2 | `scoping-closures` | Scope, closures & defaults | LEGB; nonlocal/global; late-binding closures; mutable default arguments | D | A | written | |
| 3 | `dunder-methods` | Dunder methods & protocols | __repr__/__eq__/__hash__; operator overloading; container protocols; __slots__ | D | A | written | |
| 4 | `iterators-generators` | Iterators & generators | iteration protocol; generators & yield from; laziness; itertools | D | A | written | |
| 5 | `decorators` | Decorators | functions as objects; functools.wraps; parameterized decorators; class decorators | D | A | written | |
| 6 | `context-managers` | Context managers | with protocol; contextlib; exceptions in __exit__; ExitStack | D | A | written | |
| 7 | `typing` | Type hints | generics & Protocols; TypedDict; mypy/pyright; runtime vs static | D | A | written | |
| 8 | `dataclasses-pydantic` | Dataclasses & Pydantic | field defaults; frozen & slots; Pydantic v2 validation; when to use which | D | A | written | |
| **M1** | | **Internals** | | | | | |
| 9 | `memory-gc` | Memory & garbage collection | reference counting; cyclic GC & generations; weakref; memory leaks | X | B | todo | |
| 10 | `gil` | The GIL & free-threading | what the GIL protects; CPU- vs I/O-bound; PEP 703 free-threaded 3.13 | X | B | todo | |
| 11 | `dict-internals` | Dict & set internals | hash tables; insertion order; key requirements; performance traps | X | B | todo | |
| 12 | `imports` | Import system | modules & packages; sys.path; circular imports; __main__ | D | B | todo | |
| **M2** | | **Concurrency** | | | | | |
| 13 | `threading-multiprocessing` | Threads vs processes | threading; multiprocessing & pickling; concurrent.futures; shared state | D | B | todo | |
| 14 | `asyncio` | asyncio event loop | coroutines & tasks; await semantics; blocking the loop; TaskGroup & cancellation | X | B | todo | |
| 15 | `concurrency-choice` | Choosing a concurrency model | decision guide; mixing sync & async; async frameworks | D | B | todo | |
| **M3** | | **Practice** | | | | | |
| 16 | `packaging` | Packaging & environments | venv; pip vs uv vs poetry; pyproject.toml; lockfiles & reproducibility | F | C | todo | |
| 17 | `pytest` | Testing with pytest | fixtures & scopes; parametrize; mocking & monkeypatch; coverage | D | C | todo | |
| 18 | `performance` | Profiling & performance | cProfile & py-spy; vectorize with NumPy; C extensions & Cython; common slow patterns | D | C | todo | |
| 19 | `fastapi` | FastAPI services | routing & dependency injection; Pydantic models; async endpoints; production serving (uvicorn/gunicorn) | D | C | todo | |
| 20 | `errors-logging` | Exceptions & logging | exception hierarchy & chaining; ExceptionGroup; logging config; structured logs | D | C | todo | |
| 21 | `python-for-java-devs` | Python for Java developers | idiom mapping; duck typing vs interfaces; where Java habits hurt | F | C | todo | |
| **M4** | | **Drill** | | | | | |
| ★ | `tricky-python` | Tricky Python (timed) | 50 mixed puzzles | X | C | todo | |

## Node.js (`nodejs`, 21 topics)
Verified by: `node`. Code language: `js`.

| # | slug | Topic | Subtopics | Depth | Agent | Status | Verified |
|---|---|---|---|---|---|---|---|
| **M0** | | **Runtime** | | | | | |
| 1 | `node-architecture` | Node architecture | V8 + libuv; the thread pool; bindings; single-threaded myth | F | A | written | |
| 2 | `event-loop-phases` | Event-loop phases | timers, poll, check & close; setImmediate vs setTimeout; I/O callbacks | X | A | written | |
| 3 | `microtasks-macrotasks` | Microtasks vs macrotasks | promise jobs; process.nextTick priority; starvation; ordering puzzles | X | A | written | |
| 4 | `modules-cjs-esm` | CommonJS vs ESM | require vs import; interop; package.json "type"; top-level await | D | A | written | |
| 5 | `npm-dependencies` | npm & dependencies | semver & lockfiles; peer deps; supply-chain risk; workspaces | F | A | written | |
| **M1** | | **Async** | | | | | |
| 6 | `callbacks-promises-async` | Callbacks → promises → async/await | promise states; Promise.all/allSettled/race/any; sequential vs parallel awaits | D | A | written | |
| 7 | `async-errors` | Async error handling | unhandled rejections; errors in callbacks; AbortController; domains are gone | D | A | written | |
| 8 | `streams-backpressure` | Streams & backpressure | readable/writable/transform; pipeline; highWaterMark; async iteration | X | B | todo | |
| 9 | `eventemitter` | EventEmitter | listeners & once; error events; memory-leak warnings; patterns | D | B | todo | |
| **M2** | | **Performance** | | | | | |
| 10 | `blocking-event-loop` | Blocking the event loop | CPU work; sync APIs; JSON on big payloads; measuring event-loop lag | X | B | todo | |
| 11 | `worker-threads-cluster` | Worker threads & cluster | worker_threads & SharedArrayBuffer; cluster & PM2; when to scale out instead | D | B | todo | |
| 12 | `v8-gc-leaks` | V8 memory & leaks | heap spaces; GC (Scavenge, Mark-Compact); leak patterns; heap snapshots | X | B | todo | |
| 13 | `profiling` | Profiling Node | --inspect & --cpu-prof; flame graphs; clinic.js; diagnostics_channel | D | B | todo | |
| **M3** | | **Web** | | | | | |
| 14 | `express-fastify` | Express & Fastify | middleware chain; error middleware; Fastify schemas & performance | D | C | todo | |
| 15 | `http-internals` | HTTP internals | keep-alive & agents; timeouts; HTTP/2; fetch (undici) | X | C | todo | |
| 16 | `security` | Node security | injection & prototype pollution; ReDoS; secrets; the permission model | D | C | todo | |
| **M4** | | **Production** | | | | | |
| 17 | `graceful-shutdown` | Graceful shutdown & containers | SIGTERM handling; draining connections; PID 1; health checks | D | C | todo | |
| 18 | `typescript-node` | TypeScript on Node | tsconfig for Node; type stripping (22.6+); ESM & TS | D | C | todo | |
| 19 | `testing-node` | Testing Node | node:test vs Jest/Vitest; mocking timers; integration tests | D | C | todo | |
| 20 | `node-vs-java` | Node vs Java for services | concurrency models; when to pick which; interop | D | C | todo | |
| **M5** | | **Drill** | | | | | |
| ★ | `tricky-node` | Tricky Node (timed) | 50 mixed puzzles | X | C | todo | |

## Azure (`azure`, 26 topics)
Verified by: `docs`. Code language: `bash`.

| # | slug | Topic | Subtopics | Depth | Agent | Status | Verified |
|---|---|---|---|---|---|---|---|
| **M0** | | **Foundations** | | | | | |
| 1 | `azure-hierarchy` | Tenants to resources | Entra tenant; management groups; subscriptions; resource groups & ARM | F | A | todo | |
| 2 | `regions-zones` | Regions & availability zones | region pairs; zonal vs zone-redundant; SLAs & composite SLAs | F | A | todo | |
| 3 | `entra-managed-identity` | Entra ID & managed identities | app registrations vs service principals; system vs user-assigned MI; DefaultAzureCredential | D | A | todo | |
| 4 | `rbac-policy` | RBAC & Azure Policy | role assignments & scopes; custom roles; Policy & initiatives; landing zones | D | A | todo | |
| **M1** | | **Compute** | | | | | |
| 5 | `compute-choice` | Choosing compute | VMs vs App Service vs Container Apps vs AKS vs Functions decision guide | D | A | todo | |
| 6 | `app-service` | App Service | plans & scaling; deployment slots; Java/Spring deploys; always-on & health checks | D | A | todo | |
| 7 | `container-apps` | Container Apps | environments; revisions & traffic split; KEDA scaling; Dapr | D | A | todo | |
| 8 | `aks` | AKS | node pools; networking (kubenet, CNI overlay); workload identity; upgrades | X | A | todo | |
| 9 | `functions` | Azure Functions | triggers & bindings; plans (Consumption, Flex, Premium); cold starts; Durable Functions | D | A | todo | |
| **M2** | | **Data** | | | | | |
| 10 | `storage-accounts` | Storage accounts | Blob tiers; redundancy (LRS→GZRS); SAS vs MI access; lifecycle rules | D | B | todo | |
| 11 | `azure-sql-postgres` | Azure SQL & Postgres Flexible Server | tiers; HA & read replicas; connection pooling (PgBouncer); backups & PITR | D | B | todo | |
| 12 | `cosmos-db` | Cosmos DB | partition keys; RUs; the five consistency levels; change feed | X | B | todo | |
| 13 | `redis-cache` | Azure Cache for Redis | tiers; eviction; clustering; cache-aside with Spring | D | B | todo | |
| **M3** | | **Integration** | | | | | |
| 14 | `messaging-choice` | Service Bus vs Event Hubs vs Event Grid | queues & topics; sessions & DLQ; partitions & consumer groups; event routing | X | B | todo | |
| 15 | `api-management` | API Management | policies; products & subscriptions; rate limiting; versioning | D | B | todo | |
| **M4** | | **Networking & security** | | | | | |
| 16 | `vnet-private-endpoints` | VNets & private endpoints | subnets & NSGs; private endpoint vs service endpoint; private DNS zones; hub-spoke | X | B | todo | |
| 17 | `key-vault` | Key Vault | secrets, keys & certs; RBAC vs access policies; Spring Cloud Azure integration; rotation | D | B | todo | |
| 18 | `front-door-gateway` | Front Door & Application Gateway | global vs regional; WAF; routing rules; choosing a load balancer | D | B | todo | |
| **M5** | | **Operations & architecture** | | | | | |
| 19 | `monitor-app-insights` | Monitor & Application Insights | Log Analytics & KQL; App Insights Java agent; alerts; distributed tracing | D | C | todo | |
| 20 | `bicep-terraform` | Bicep & Terraform | ARM vs Bicep; modules; Terraform azurerm; what-if & drift | D | C | todo | |
| 21 | `devops-pipelines` | CI/CD pipelines | Azure DevOps vs GitHub Actions; OIDC federation; environments & approvals | D | C | todo | |
| 22 | `cost-management` | Cost management | pricing models (reserved, savings plans, spot); budgets; common cost leaks | D | C | todo | |
| 23 | `azure-openai` | Azure OpenAI & AI Foundry | deployments & quotas (TPM); content filters; RAG with AI Search; Spring AI | D | C | todo | |
| 24 | `well-architected` | Well-Architected & reliability | the five pillars; reliability patterns; disaster recovery (RTO/RPO) | D | C | todo | |
| 25 | `spring-on-azure` | Spring apps on Azure end to end | reference architecture; identity-first config; observability; migration options | X | C | todo | |
| **M6** | | **Drill** | | | | | |
| ★ | `tricky-azure` | Tricky Azure (timed) | 50 mixed scenario puzzles | X | C | todo | |
