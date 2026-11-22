IA.register({
  track: 'spring',
  slug: 'bean-lifecycle-scopes',
  title: 'Bean lifecycle & scopes',
  tagline: 'Every bean passes the same checkpoints: <b>instantiate → populate → init → (maybe) get wrapped in a proxy → in use → destroy</b>. Knowing which checkpoint you are at tells you whether fields are set, whether <code>@Transactional</code> works yet, and whether anyone will ever call your cleanup code. Scopes decide <i>how many</i> instances go through that pipeline.',
  tldr: {
    problem: 'Init code that runs too early (null fields, no transaction), cleanup that never runs (prototypes), and one user’s data showing up in another user’s request because a short-lived object was injected into a singleton.',
    model: 'Creation is a pipeline with hook points. <code>BeanPostProcessor</code>s run <i>around</i> the init callbacks, and the object a post-processor returns after init (often a proxy) is what the container stores and injects. A scope is a lookup policy: singleton = one per container, prototype = new per request to the container, request/session = one per HTTP request/session, reached from singletons through a <b>scoped proxy</b>.',
    hook: '“I injected a prototype bean into a singleton, why is it always the same instance?” Because injection happens once, when the singleton is created. Use <code>ObjectProvider</code>, <code>@Lookup</code> or a scoped proxy.',
    facts: [
      { v: '@PostConstruct → afterPropertiesSet → initMethod', l: 'init callback order; destroy mirrors it: <code>@PreDestroy</code> → <code>destroy()</code> → destroyMethod' },
      { v: '0', l: 'destroy callbacks Spring calls for <b>prototype</b> beans: the container does not track them after handing them out' },
      { v: '6', l: 'scopes in a web-aware context: singleton, prototype, request, session, application, websocket' }
    ]
  },
  intro: {
    what: 'Spring doesn’t just call <code>new</code> on your class. It creates the object, fills in its dependencies, calls your setup methods, may wrap it in a proxy for features like transactions, and, when the app shuts down, calls your cleanup methods. That sequence is the <b>bean lifecycle</b>. The <b>scope</b> says how many copies exist: one for the whole app (the default), a fresh one each time, or one per web request or user session.',
    analogy: { icon: '🏨', title: 'Hotel rooms', text: 'A singleton is the hotel lobby: one, shared by everyone, open from opening day to closing. A prototype is a disposable cup: you get a new one each time you ask, and housekeeping never collects it. A request-scoped bean is a room key card, issued for your stay and deactivated when you check out. The front desk (the scoped proxy) always gives you <i>your</i> key, even though everyone talks to the same desk.' },
    steps: [
      { t: 'Constructor first', d: 'The object is created and constructor arguments are supplied. Field-injected dependencies are still <code>null</code> at this point.' },
      { t: 'Then dependencies and setup', d: 'Fields and setters are injected, then <code>@PostConstruct</code> runs. That is the first place where everything is guaranteed to be set.', code: '@PostConstruct\nvoid loadRates() { rates = client.fetchRates(); }' },
      { t: 'Maybe a proxy', d: 'If the bean needs transactions, caching, security or async, Spring wraps it in a proxy now. Other beans get the proxy.' },
      { t: 'Cleanup at shutdown', d: '<code>@PreDestroy</code> runs when the context closes, for singletons (and request/session beans at the end of their request or session). Never for prototypes.' },
      { t: 'Pick a scope on purpose', d: 'Default is singleton: keep it stateless. Use <code>@RequestScope</code> or <code>@SessionScope</code> for per-user web state, and <code>@Scope("prototype")</code> for stateful helpers you create on demand.' }
    ],
    terms: [
      ['lifecycle callback', 'A method Spring calls at a fixed point: <code>@PostConstruct</code>, <code>@PreDestroy</code>, <code>afterPropertiesSet()</code>.'],
      ['BeanPostProcessor (BPP)', 'A bean that sees every other bean before and after its init callbacks, and may replace it (usually with a proxy).'],
      ['scope', 'How many instances exist and how long they live: singleton, prototype, request, session, application, websocket.'],
      ['scoped proxy', 'A stand-in object injected into a longer-lived bean; each call is forwarded to the instance for the current request or session.'],
      ['SmartLifecycle', 'An interface for beans that need <code>start()</code>/<code>stop()</code> after the context is refreshed, in phases (listeners, schedulers, consumers).']
    ]
  },
  visual: {
    title: 'One bean, every checkpoint',
    caption: 'Pick a bean kind and press Play or Step. The list on the left is the order Spring follows; the box on the right is the actual object: which fields are set, and whether a proxy wraps it. Compare <b>singleton + @Transactional</b> (a proxy appears at step 7) with <b>prototype</b> (no destroy).'
  },
  extras: [
    { id: 'bean-lifecycle-scopes-scopes', title: 'The prototype-in-singleton trap', label: 'Scopes', caption: 'Three users add an item to their cart through one singleton controller. Switch how the controller gets its <code>Cart</code> and see who ends up sharing what.' }
  ],
  gotchas: [
    { trap: 'Prototype injected into a singleton is created once', code: `@Component @Scope("prototype") class Cart { List<Item> items = new ArrayList<>(); }

@RestController
class CartController {
  private final Cart cart;                 // one Cart for every user, forever
  CartController(Cart cart) { this.cart = cart; }
}`, why: 'Prototype means “new instance each time the container is asked”. A singleton asks exactly once, when it is constructed.', fix: 'Inject <code>ObjectProvider&lt;Cart&gt;</code> and call <code>getObject()</code> when you need one, use a <code>@Lookup</code> method, or give Cart the scope you actually mean (<code>@RequestScope</code>/<code>@SessionScope</code>, proxied by default).' },
    { trap: '@Transactional called from @PostConstruct has no transaction', code: `@Service
class RateService {
  @PostConstruct void init() { refreshRates(); }   // runs on the raw object
  @Transactional public void refreshRates() { … }  // proxy doesn't exist yet
}`, why: 'The transactional proxy is created in <code>postProcessAfterInitialization</code>, <i>after</i> <code>@PostConstruct</code>. And even later, a call through <code>this</code> never goes through the proxy.', fix: 'Do the work from an <code>ApplicationReadyEvent</code> listener on another bean, or call it through the proxy. Use <code>TransactionTemplate</code> if it must run during init.' },
    { trap: 'Prototype beans never get @PreDestroy', why: 'The container hands the instance over and drops its reference. A prototype that opens a file, socket or thread pool leaks it unless the caller closes it.', fix: 'Make resource-holding prototypes <code>AutoCloseable</code> and use try-with-resources, or let a singleton own the resource and keep the prototype lightweight.' },
    { trap: 'Request scope without a proxy fails at startup', code: `@Component @Scope("request")          // proxyMode defaults to NO
class RequestContext { … }
// singleton depends on it → "Scope 'request' is not active for the current thread"`, why: 'The singleton is created at startup on the main thread, where no HTTP request exists to hold the request-scoped instance.', fix: 'Use <code>@RequestScope</code> (it sets <code>proxyMode = TARGET_CLASS</code>), or <code>@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)</code>, or <code>ObjectProvider</code>.' },
    { trap: 'Request-scoped beans on other threads', why: 'Request scope is bound to the request thread (via <code>RequestContextHolder</code>). Calling the scoped proxy from an <code>@Async</code> method, a <code>CompletableFuture</code> or a virtual thread you started yourself fails with “No thread-bound request found”, or reads the wrong state.', fix: 'Copy the values you need into a plain object before handing work off, or propagate context explicitly (Micrometer context-propagation, a <code>TaskDecorator</code>).' },
    { trap: 'Non-static @Bean BeanPostProcessor drags beans in early', code: `@Configuration
class AuditConfig {
  @Autowired AuditRepository repo;              // forces early init
  @Bean BeanPostProcessor auditBpp() { … }      // should be static
}`, why: 'BPPs must be created before ordinary beans. A non-static <code>@Bean</code> BPP forces its configuration class, and everything that class injects, to be created early. Those beans miss some post-processing (logged as “is not eligible for getting processed by all BeanPostProcessors”), so they can lose proxies such as <code>@Transactional</code>.', fix: 'Declare BPP and BFPP <code>@Bean</code> methods <code>static</code>, and give them as few dependencies as possible (inject <code>ObjectProvider</code> if needed).' },
    { trap: 'Slow @PostConstruct blocks the whole startup', why: 'Singletons are created one after another on the main thread during refresh. A remote call in <code>@PostConstruct</code> that takes 30 s delays the context, the web server becoming ready, and the readiness probe.', fix: 'Load lazily, or run warm-up after <code>ApplicationReadyEvent</code> with a timeout. Spring 6.2 also lets selected beans initialise in the background (<code>@Bean(bootstrap = BACKGROUND)</code> with a bootstrap executor).' }
  ],
  scenarios: [
    { title: 'Customer sees someone else’s basket',
      symptom: 'Support tickets: “my basket has items I never added”. It only happens in production under load, never in a single-user test.',
      diagnose: `// a heap dump shows exactly ONE CheckoutState instance, referenced by CheckoutController
@Component @Scope("prototype")
class CheckoutState { private final List<LineItem> lines = new ArrayList<>(); … }

@RestController
class CheckoutController {
  private final CheckoutState state;   // injected once at startup
}`,
      cause: 'The author thought prototype scope meant “per request”. It means per container lookup, and the singleton controller looked it up once. All users shared one mutable list, which is also not thread-safe.',
      fix: 'Model per-user state as session-scoped (proxied), or better, keep it out of beans entirely: load it per request from the database or cache, keyed by user.',
      fixCode: `@Component
@SessionScope                         // proxyMode = TARGET_CLASS
class CheckoutState implements Serializable { … }

// or: no state in beans at all
@PostMapping("/checkout/lines")
void add(@AuthenticationPrincipal User u, @RequestBody LineItem li) {
  baskets.addLine(u.id(), li);        // stored per user
}` },
    { title: 'Pods never become ready after a dependency outage',
      symptom: 'During a pricing-service outage, every restarted pod hung in startup for minutes, and Kubernetes kept restarting them, which made recovery slower.',
      diagnose: `# thread dump during startup: main thread stuck in
at com.shop.PriceCache.init(PriceCache.java:31)          // @PostConstruct
at ...InitDestroyAnnotationBeanPostProcessor...
at ...AbstractAutowireCapableBeanFactory.initializeBean`,
      cause: 'A <code>@PostConstruct</code> preloaded prices over HTTP with no timeout. Init runs on the main thread during context refresh, so the whole app waited on the remote service.',
      fix: 'Start with an empty cache and fill it after the application is ready, with a timeout and retries in the background. Report cache warmth through a health indicator rather than blocking startup.',
      fixCode: `@Component
class PriceCache {
  private volatile Map<String, Price> prices = Map.of();

  @EventListener(ApplicationReadyEvent.class)
  @Async                                         // needs @EnableAsync
  public void warm() {
    prices = client.fetchAll(Duration.ofSeconds(3));   // bounded
  }
}` },
    { title: 'File descriptors climb until “Too many open files”',
      symptom: 'An export service crashes every few days. <code>lsof</code> shows thousands of open temp files.',
      diagnose: `@Component @Scope("prototype")
class CsvWriter {
  private final BufferedWriter out = Files.newBufferedWriter(Files.createTempFile("exp", ".csv"));
  @PreDestroy void close() throws IOException { out.close(); }   // never called
}`,
      cause: 'Each export got a new prototype writer via <code>ObjectProvider</code>. The author expected <code>@PreDestroy</code> to close it, but Spring never calls destroy callbacks on prototypes.',
      fix: 'Make the writer <code>AutoCloseable</code> and close it at the call site, or don’t make it a bean at all.',
      fixCode: `class CsvWriter implements AutoCloseable { … public void close() throws IOException { out.close(); } }

try (CsvWriter w = writers.getObject()) {
  rows.forEach(w::write);
}` }
  ],
  puzzles: [
    { kind: 'order', q: 'A singleton implements <code>InitializingBean</code>, has a <code>@PostConstruct</code> method and is declared with <code>@Bean(initMethod = "warmUp")</code>. What order do they run in?', options: ['afterPropertiesSet → @PostConstruct → warmUp', '@PostConstruct → afterPropertiesSet → warmUp', 'warmUp → @PostConstruct → afterPropertiesSet', 'constructor → warmUp only; the others are ignored when initMethod is set'], answer: 1, explain: '<code>@PostConstruct</code> is called by a BeanPostProcessor’s before-init hook, then <code>invokeInitMethods</code> calls <code>afterPropertiesSet()</code> and finally the custom init method. Destroy mirrors it: <code>@PreDestroy</code>, <code>destroy()</code>, destroyMethod.' },
    { kind: 'predict', q: '<code>Counter</code> is prototype-scoped. <code>A</code> and <code>B</code> are singletons that each inject it via the constructor. How many Counter instances exist after startup?', options: ['1', '2', 'One per call to a Counter method', '0 until first use'], answer: 1, explain: 'One per <b>injection point resolution</b>: A gets one, B gets another. Each stays fixed for the lifetime of its singleton. To get a new one per use, inject <code>ObjectProvider&lt;Counter&gt;</code>.' },
    { kind: 'predict', q: 'What does this print at startup?', code: `@Service
class Greeter {
  @Autowired private Clock clock;
  Greeter() { System.out.println("ctor: " + clock); }
  @PostConstruct void init() { System.out.println("init: " + (clock != null)); }
}`, options: ['ctor: SystemClock… / init: true', 'ctor: null / init: true', 'ctor: null / init: false', 'Startup fails: clock not ready'], answer: 1, explain: 'Field injection happens in the populate phase, <i>after</i> the constructor returns. By the time <code>@PostConstruct</code> runs, all injection is done. Constructor injection avoids the null window entirely.' },
    { kind: 'concept', q: 'A <code>@Transactional</code> method is called from <code>@PostConstruct</code> on the same bean. Does it run in a transaction?', options: ['Yes', 'No: the proxy is created after init, and this is a self-call anyway', 'Only with proxyTargetClass=true', 'Only if the method is public'], answer: 1, explain: 'Two reasons, either one enough. The AOP proxy is created in <code>postProcessAfterInitialization</code>, after <code>@PostConstruct</code>. And calls on <code>this</code> never pass through a proxy. See <a href="aop-proxies.html">AOP & proxies</a>.' },
    { kind: 'predict', q: 'A singleton depends on a bean declared <code>@Scope("request")</code> (no <code>proxyMode</code>). What happens?', options: ['Works: a new instance per request', 'Startup fails: no request is active on the startup thread', 'Works, but all requests share one instance', 'Spring silently creates a proxy'], answer: 1, explain: 'With <code>proxyMode</code> left at its default (no proxy), Spring must resolve the real request-scoped bean while creating the singleton, at startup, where there is no request. <code>@RequestScope</code> sets <code>TARGET_CLASS</code> for you.' },
    { kind: 'concept', q: 'Context closes. Which beans get <code>@PreDestroy</code> called?', options: ['All beans, of every scope', 'Singletons only (and request/session beans when their request/session ends)', 'Only beans implementing DisposableBean', 'Prototypes only'], answer: 1, explain: 'Singletons are destroyed in reverse dependency order when the context closes. Request- and session-scoped beans are destroyed when their request or session ends. Prototypes are never tracked, so they never get destroy callbacks.' },
    { kind: 'concept', q: 'Where does a <code>@Transactional</code> bean get replaced by its proxy?', options: ['In the constructor', 'In a BeanFactoryPostProcessor', 'In BeanPostProcessor.postProcessAfterInitialization (auto-proxy creator)', 'At first method call'], answer: 2, explain: 'The auto-proxy creator (an <code>AbstractAutoProxyCreator</code>) is a BPP. After init, it checks whether any advisor applies and returns a proxy if so. That return value is what the container stores. (In a circular reference it may do this earlier, via <code>getEarlyBeanReference</code>.)' }
  ],
  interview: [
    { q: 'Walk through the lifecycle of a singleton bean.', a: '<ol><li>Definition merged; <code>InstantiationAwareBeanPostProcessor</code>s may short-circuit.</li><li>Instantiate: constructor or factory method.</li><li>Populate: autowired fields and setters, <code>@Value</code>.</li><li>Aware callbacks: bean name, class loader, bean factory.</li><li>BPP <code>postProcessBeforeInitialization</code>: <code>ApplicationContextAware</code> and <code>@PostConstruct</code> happen here.</li><li><code>afterPropertiesSet()</code>, then the custom init method.</li><li>BPP <code>postProcessAfterInitialization</code>: proxies are created.</li><li>In use. After all singletons: <code>SmartInitializingSingleton</code>, then <code>SmartLifecycle.start()</code>.</li><li>On close: <code>SmartLifecycle.stop()</code>, then <code>@PreDestroy</code>, <code>destroy()</code>, destroy method.</li></ol>', lvl: 'core' },
    { q: 'BeanPostProcessor vs BeanFactoryPostProcessor?', a: '<p>A <b>BeanFactoryPostProcessor</b> runs once, before any normal bean exists, and edits <i>definitions</i> (for example <code>ConfigurationClassPostProcessor</code> and the placeholder configurer). A <b>BeanPostProcessor</b> runs for every bean <i>instance</i>, around initialisation, and may return a different object (proxies). Both should be declared as <code>static @Bean</code> methods so they don’t force early creation of their configuration class.</p>', lvl: 'core' },
    { q: 'What is the prototype-in-singleton problem and how do you solve it?', a: '<p>A singleton’s dependencies are resolved once, so a prototype injected into it becomes effectively a singleton for that holder. Solutions: <code>ObjectProvider&lt;T&gt;.getObject()</code> (preferred), a <code>@Lookup</code> method (Spring overrides it via CGLIB to call <code>getBean</code>), <code>jakarta.inject.Provider&lt;T&gt;</code>, or a scoped proxy if what you really need is request or session scope.</p>', lvl: 'core' },
    { q: 'How does a scoped proxy work?', a: '<p>Spring registers two definitions: the real bean as <code>scopedTarget.cart</code> with request/session scope, and a singleton proxy under the original name. The proxy (CGLIB subclass for <code>TARGET_CLASS</code>, JDK for <code>INTERFACES</code>) implements each method call as: look up the target in the current scope (request attributes or HTTP session), creating it if absent, then delegate. So a singleton can safely hold it.</p>', fu: 'What happens if you call it outside a request? (<code>IllegalStateException</code>: no thread-bound request.)', lvl: 'deep' },
    { q: 'Why might @PreDestroy not run?', a: '<ul><li>The bean is a prototype.</li><li>The JVM was killed (<code>SIGKILL</code>, OOM killer) rather than shut down; Boot registers a shutdown hook that handles <code>SIGTERM</code>.</li><li>The context was never closed (a non-Boot app without <code>registerShutdownHook()</code>).</li><li>The bean was created with <code>new</code>.</li><li>Shutdown exceeded the orchestrator’s grace period, so it was killed partway through.</li></ul>', lvl: 'core' },
    { q: 'When would you use SmartLifecycle instead of @PostConstruct?', a: '<p>When something must start after the <i>whole</i> context is ready and stop before beans are destroyed: message listeners, schedulers, background pollers. <code>SmartLifecycle</code> has phases (start low first, stop high first) and is how Spring starts its own listener containers and, in Boot, the embedded web server. Graceful shutdown hooks into the same mechanism.</p>', lvl: 'deep' },
    { q: 'Which scopes exist, and which do you actually use?', a: '<p>singleton (default), prototype, and in web contexts request, session, application (one per <code>ServletContext</code>) and websocket. Most services are almost entirely stateless singletons. Request scope is handy for per-request context; session scope for small per-user UI state. You can register custom scopes (Spring Cloud’s refresh scope is one).</p>', lvl: 'core' },
    { q: 'Is a singleton bean the same as the Singleton pattern?', a: '<p>No. The GoF Singleton is one instance per class loader, enforced by the class. A Spring singleton is one instance <b>per bean definition per container</b>: you can define two beans of the same class, and two contexts each have their own. The class itself is ordinary and can be <code>new</code>-ed in tests.</p>', lvl: 'core' },
    { q: 'How do you run code once the application is fully started?', a: '<p>Listen for <code>ApplicationReadyEvent</code> (after runners and the web server have started), or implement <code>ApplicationRunner</code>/<code>CommandLineRunner</code> (run just before it). <code>ContextRefreshedEvent</code> is earlier and fires again on every refresh, including child contexts.</p>', lvl: 'core' },
    { q: 'In what order are singletons destroyed?', a: '<p>In reverse order of their dependencies: a bean is destroyed before the beans it depends on, so during your <code>@PreDestroy</code> your dependencies are still alive. Beans that implement <code>SmartLifecycle</code> are stopped earlier, phase by phase, before any destroy callback.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Getting fresh prototypes from a singleton', lang: 'java', code: `@Component @Scope("prototype")
class ReportBuilder { … }

@Service
class ReportService {
  private final ObjectProvider<ReportBuilder> builders;
  ReportService(ObjectProvider<ReportBuilder> builders) { this.builders = builders; }

  Report build(Query q) { return builders.getObject().with(q).build(); }   // new each call
}

// alternative: @Lookup, which Spring overrides with a CGLIB subclass
@Service
abstract class LegacyReportService {
  @Lookup protected abstract ReportBuilder newBuilder();
}` },
    { title: 'Request- and session-scoped beans', lang: 'java', code: `@Component
@RequestScope                         // = @Scope(value = "request", proxyMode = TARGET_CLASS)
class RequestContext {
  private String tenantId;
  // set by a filter, read anywhere in the request
}

@Component
@SessionScope
class WizardState implements Serializable {   // must be serializable for clustered sessions
  private int step;
}` },
    { title: 'Lifecycle hooks the right way', lang: 'java', code: `@Component
class QueuePoller implements SmartLifecycle {
  private volatile boolean running;
  private final ExecutorService exec = Executors.newSingleThreadExecutor();

  @Override public void start()  { running = true; exec.submit(this::poll); }
  @Override public void stop()   { running = false; exec.shutdown(); }
  @Override public boolean isRunning() { return running; }
  @Override public int getPhase() { return Integer.MAX_VALUE - 100; }   // start late, stop early

  private void poll() { while (running) { /* take & handle */ } }
}

@Configuration
class Infra {
  @Bean(destroyMethod = "close")          // inferred anyway for public close()/shutdown()
  HttpClient httpClient() { return HttpClient.newHttpClient(); }

  @Bean static BeanPostProcessor timingBpp() { return new TimingBpp(); }   // static!
}`, note: '<code>HttpClient.close()</code> exists from Java 21.' }
  ]
});
