IA.register({
  track: 'spring',
  slug: 'ioc-di',
  title: 'IoC & dependency injection',
  tagline: 'Your classes stop calling <code>new</code> on their collaborators. The <b>ApplicationContext</b> reads recipes (bean definitions), builds every singleton at startup in dependency order, and hands each object what its constructor asks for. Most “Spring magic” bugs are really questions about <i>which</i> bean, <i>when</i>, and <i>in what state</i>.',
  tldr: {
    problem: 'Startup fails with <code>NoUniqueBeanDefinitionException</code> or a cycle report, or worse, it starts but injects the wrong implementation or a half-built object. Field injection hides all of this until a test or a refactor exposes it.',
    model: 'Startup is two passes. First <b>definitions</b>: component scan and <code>@Bean</code> methods register recipes. Then <b>instances</b>: every non-lazy singleton is created depth-first, resolving each dependency <b>by type</b>, then narrowing by <code>@Qualifier</code>, <code>@Primary</code> and finally parameter name.',
    hook: '“Why does constructor injection win?” Final fields, no hidden dependencies, plain unit tests with <code>new</code>, and cycles fail loudly at startup instead of being papered over.',
    facts: [
      { v: '4.3', l: 'Spring Framework version since which a class with a <b>single constructor</b> needs no <code>@Autowired</code>' },
      { v: 'Boot 2.6', l: 'circular references between beans are <b>prohibited by default</b> (<code>spring.main.allow-circular-references=false</code>)' },
      { v: 'type → qualifier → primary → name', l: 'the order Spring uses to pick one bean when several match an injection point' }
    ]
  },
  intro: {
    what: 'In a normal program, an <code>OrderService</code> would create its own <code>OrderRepository</code> with <code>new</code>. With <b>inversion of control</b> (IoC), it just declares “I need an OrderRepository” in its constructor, and a container builds and supplies it. That act of supplying is <b>dependency injection</b> (DI). In Spring the container is the <b>ApplicationContext</b>, and the objects it manages are <b>beans</b>.',
    analogy: { icon: '🍽️', title: 'A restaurant kitchen with a head chef', text: 'Cooks don’t go shopping. Each recipe card lists what it needs (“2 eggs, 1 sauce”). Before service, the head chef reads all the cards, prepares the sauce first because the omelette needs it, and places everything at each station. If two cards both say “sauce” and there are two sauces, the chef stops and asks which one. That chef is the ApplicationContext.' },
    steps: [
      { t: 'Mark classes as beans', d: 'Annotate with <code>@Component</code> (or <code>@Service</code>, <code>@Repository</code>, <code>@RestController</code>, which are specialisations). Component scanning finds them under your main class’s package.' },
      { t: 'Ask for dependencies in the constructor', d: 'One constructor means no <code>@Autowired</code> is needed. Fields can be <code>final</code>.', code: '@Service\nclass OrderService {\n  private final OrderRepository repo;\n  OrderService(OrderRepository repo) { this.repo = repo; }\n}' },
      { t: 'Spring builds the graph at startup', d: 'It creates beans with no dependencies first, then the ones that need them. Each singleton is created once and shared.' },
      { t: 'Ambiguity must be resolved', d: 'If two beans fit the requested type, mark one <code>@Primary</code> or say which with <code>@Qualifier("name")</code>. Otherwise startup fails, which is good: you find out now, not in production.' }
    ],
    terms: [
      ['bean', 'An object whose creation, wiring and lifecycle Spring manages.'],
      ['BeanDefinition', 'The recipe for a bean: class or factory method, scope, constructor args, qualifiers, lazy flag.'],
      ['ApplicationContext', 'The container. A <code>BeanFactory</code> plus events, environment/properties, resources, i18n and automatic post-processor registration.'],
      ['singleton (scope)', 'One instance per container. The default scope, not the GoF singleton pattern.'],
      ['@Qualifier / @Primary', 'Ways to pick one bean when several match the requested type.'],
      ['component scan', 'Classpath search for <code>@Component</code>-annotated classes, starting at a base package.']
    ]
  },
  visual: {
    title: 'Watch the context wire itself',
    caption: 'Pick a scenario and press Play (or Step). Dashed boxes are bean <b>definitions</b>; amber means “in creation”, green means a finished singleton, red means startup failed. The log underneath is what Boot prints. In the last scenario, watch the three singleton caches.'
  },
  gotchas: [
    { trap: 'Field injection hides dependencies and blocks immutability', code: `@Service
class OrderService {
  @Autowired private OrderRepository repo;   // can't be final
  @Autowired private PaymentGateway gateway; // test needs reflection or a context
}`, why: 'The class can be constructed in an invalid state (<code>new OrderService()</code> gives nulls), the dependency list is invisible from the API, and a growing list of <code>@Autowired</code> fields never “hurts” the way a 9-argument constructor does.', fix: 'Use constructor injection with <code>final</code> fields. Keep field injection for test classes (<code>@Autowired</code> in a <code>@SpringBootTest</code> is fine).' },
    { trap: 'Two implementations, one injection point', code: `@Component class StripeGateway implements PaymentGateway {}
@Component class PaypalGateway implements PaymentGateway {}

OrderService(PaymentGateway gateway) { … }   // NoUniqueBeanDefinitionException`, why: 'Resolution is by type. With two candidates, Spring tries qualifier, then primary, then matches the parameter name against bean names. <code>gateway</code> matches neither <code>stripeGateway</code> nor <code>paypalGateway</code>.', fix: 'Mark the default <code>@Primary</code>, qualify the injection point, or inject <code>List&lt;PaymentGateway&gt;</code> / <code>Map&lt;String, PaymentGateway&gt;</code> if you really want all of them (a strategy registry).' },
    { trap: 'Relying on the parameter-name fallback', why: 'Matching <code>PaymentGateway stripeGateway</code> to the bean named <code>stripeGateway</code> needs parameter names in the bytecode. Spring 6.1 removed the old local-variable-table fallback, so code compiled without <code>-parameters</code> loses this match. Boot’s Maven and Gradle plugins set <code>-parameters</code>, but a custom compiler config may not.', fix: 'Be explicit with <code>@Qualifier</code> when the choice matters. Don’t let a parameter rename change which bean you get.' },
    { trap: 'Constructor cycles can never be resolved', code: `OrderService(AuditService audit) {…}
AuditService(OrderService orders) {…}   // BeanCurrentlyInCreationException`, why: 'To call either constructor, Spring needs the other object, which does not exist yet. <code>allow-circular-references=true</code> only helps field/setter injection, where a raw early reference can be handed out.', fix: 'Break the cycle: extract the shared logic into a third bean, publish an event instead of calling back, or (last resort) <code>@Lazy</code> on one parameter to inject a proxy.' },
    { trap: 'Turning circular references back on hides a design problem', code: `spring.main.allow-circular-references: true   # "fixes" the Boot 2.6+ upgrade`, why: 'It makes field-injected cycles start again, but one side receives a bean that isn’t fully initialised yet. If that bean needs a proxy that isn’t created early (for example <code>@Async</code>), startup fails with “injected into other beans in its raw version”.', fix: 'Treat the flag as a migration crutch. Find the cycle in the startup report and remove it.' },
    { trap: '<code>new</code> on a bean class skips Spring entirely', code: `var svc = new OrderService(repo, gateway); // no @Transactional, no @Async, no BPPs`, why: 'Only objects created by the container go through post-processors. A hand-made instance gets no proxy, so annotations that need one (transactions, caching, security, async) silently do nothing.', fix: 'Inject the bean. For many instances with runtime arguments, use <code>ObjectProvider&lt;T&gt;.getObject(args)</code> with a prototype bean, or a plain factory bean that you inject.' },
    { trap: 'Multiple constructors, none annotated', code: `@Service
class ReportService {
  ReportService() {}                       // Spring picks this one
  ReportService(ReportRepository repo) {…} // never called → repo null
}`, why: 'With several constructors and none marked <code>@Autowired</code>, Spring uses the no-arg constructor if there is one. Without a default constructor it fails with “No default constructor found”.', fix: 'Keep one constructor, or annotate the one Spring should use with <code>@Autowired</code>.' }
  ],
  scenarios: [
    { title: 'A new payment provider breaks startup in every environment',
      symptom: 'After merging a <code>PaypalGateway</code> for a pilot, the service fails to start in CI and staging: “Parameter 1 of constructor in OrderService required a single bean, but 2 were found”.',
      diagnose: `# Boot prints the candidates and the injection point
APPLICATION FAILED TO START
Parameter 1 of constructor in com.shop.OrderService required a single bean, but 2 were found:
  - paypalGateway: defined in file [.../PaypalGateway.class]
  - stripeGateway: defined in file [.../StripeGateway.class]`,
      cause: 'Every consumer asked for <code>PaymentGateway</code> by type. The second implementation made all of them ambiguous at once.',
      fix: 'Make the existing behaviour the default with <code>@Primary</code>, and inject the pilot explicitly where it is needed. If the choice is per request, inject all gateways as a map and select at runtime.',
      fixCode: `@Component @Primary
class StripeGateway implements PaymentGateway { … }

@Service
class PaymentRouter {
  private final Map<String, PaymentGateway> byName;   // bean name → bean
  PaymentRouter(Map<String, PaymentGateway> byName) { this.byName = byName; }
  PaymentGateway forTenant(Tenant t) { return byName.getOrDefault(t.gatewayBean(), byName.get("stripeGateway")); }
}` },
    { title: 'Boot 2.5 → 3.x upgrade: “The dependencies of some of the beans form a cycle”',
      symptom: 'An app that ran for years refuses to start after the upgrade. The report shows <code>userService ↔ notificationService</code>, both field-injected.',
      diagnose: `┌─────┐
|  userService (field private NotificationService notifications)
↑     ↓
|  notificationService (field private UserService users)
└─────┘`,
      cause: 'Circular references are prohibited by default since Boot 2.6. The cycle always existed; field injection plus the old default had hidden it.',
      fix: 'Short-term, the property gets you running. The real fix is to remove the back-reference: here notifications only needed a user’s email, so an event carries it instead.',
      fixCode: `// temporary only
spring.main.allow-circular-references=true

// real fix: UserService publishes, NotificationService listens. No back-reference.
@Service
class UserService {
  private final ApplicationEventPublisher events;
  UserService(ApplicationEventPublisher events) { this.events = events; }
  void register(User u) { /* save */ events.publishEvent(new UserRegistered(u.id(), u.email())); }
}
@Component
class NotificationService {
  @EventListener void on(UserRegistered e) { /* send welcome mail to e.email() */ }
}` },
    { title: 'Transactions “randomly” not applied in a batch job',
      symptom: 'Partial writes after failures in a nightly import. The <code>@Transactional</code> method on <code>ImportStep</code> never rolls back.',
      diagnose: `// in the job configuration
List<ImportStep> steps = files.stream()
    .map(f -> new ImportStep(f, repo))   // ← hand-made instances
    .toList();`,
      cause: 'The steps were created with <code>new</code>, so no transactional proxy wrapped them. The annotation was just metadata nobody read.',
      fix: 'Make <code>ImportStep</code> a prototype bean and create instances through <code>ObjectProvider</code>, so each one goes through the container and gets its proxy.',
      fixCode: `@Component @Scope("prototype")
class ImportStep {
  ImportStep(Path file, ImportRepository repo) { … }
  @Transactional public void run() { … }
}

@Component
class ImportJob {
  private final ObjectProvider<ImportStep> steps;
  ImportJob(ObjectProvider<ImportStep> steps) { this.steps = steps; }
  void runAll(List<Path> files) { files.forEach(f -> steps.getObject(f).run()); }
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Two <code>@Component</code> classes implement <code>PaymentGateway</code>: <code>StripeGateway</code> and <code>PaypalGateway</code>. Neither is primary. What happens at startup?', code: `@Service
class OrderService {
  OrderService(PaymentGateway gateway) { … }
}`, options: ['Spring injects whichever was scanned first', 'Startup fails: NoUniqueBeanDefinitionException (no unique bean of that type)', 'Spring injects a composite that calls both', 'gateway is null until first use'], answer: 1, explain: 'Spring never picks arbitrarily. Two candidates, no qualifier, no primary, and the parameter name <code>gateway</code> matches neither bean name, so startup fails. Boot’s failure analyzer lists both beans and suggests <code>@Primary</code> or <code>@Qualifier</code>.' },
    { kind: 'predict', q: 'Now <code>StripeGateway</code> is <code>@Primary</code>. Which bean is injected here?', code: `OrderService(@Qualifier("paypalGateway") PaymentGateway gateway) { … }`, options: ['stripeGateway, because @Primary always wins', 'paypalGateway', 'Startup fails: conflicting hints', 'Both, as a List'], answer: 1, explain: 'The qualifier filters the candidates first, leaving only paypalGateway. <code>@Primary</code> is only consulted when several candidates remain. Qualifier beats primary.' },
    { kind: 'predict', q: 'Boot 3.x, two constructors, no <code>@Autowired</code>. What is <code>repo</code> at runtime?', code: `@Service
class ReportService {
  private ReportRepository repo;
  ReportService() { }
  ReportService(ReportRepository repo) { this.repo = repo; }
}`, options: ['The repository bean: Spring picks the greediest constructor', 'null: Spring uses the no-arg constructor', 'Startup fails: ambiguous constructors', 'A lazy proxy'], answer: 1, explain: 'With several constructors and none annotated, Spring falls back to the default (no-arg) constructor. <code>repo</code> stays null and you get an NPE later. Keep a single constructor, or mark one <code>@Autowired</code>.' },
    { kind: 'predict', q: 'Boot 3.x with <code>spring.main.allow-circular-references=true</code>. What happens?', code: `@Service class A { A(B b) { } }
@Service class B { B(A a) { } }`, options: ['Starts: the property allows the cycle', 'Starts, but one of them gets null', 'Fails: BeanCurrentlyInCreationException (unresolvable cycle)', 'Starts lazily on first request'], answer: 2, explain: 'The property only lets Spring hand out an <b>early reference</b> to an object that has already been constructed. With constructor injection neither object can be constructed first, so the cycle is unresolvable regardless of the flag.' },
    { kind: 'predict', q: 'Same cycle with field injection, Boot 3.x, default properties. What happens?', code: `@Service class A { @Autowired B b; }
@Service class B { @Autowired A a; }`, options: ['Starts fine: field injection resolves cycles', 'Fails at startup with the cycle report', 'Starts, b.a is null', 'Spring creates two A instances'], answer: 1, explain: 'Field cycles <i>can</i> be resolved through the early-reference cache, but Boot 2.6+ sets <code>allow-circular-references=false</code> by default, so it refuses. Set the flag and it would start.' },
    { kind: 'predict', q: 'What order does the list have?', code: `@Component @Order(2) class StripeGateway implements PaymentGateway {}
@Component @Order(1) class PaypalGateway implements PaymentGateway {}

OrderService(List<PaymentGateway> gateways) { … }`, options: ['[Stripe, Paypal]: registration order', '[Paypal, Stripe]', 'Random order', 'Startup fails: two candidates'], answer: 1, explain: 'Collection injection gets <b>all</b> candidates, so there is no ambiguity, sorted by <code>Ordered</code>/<code>@Order</code> (lower first). Without ordering, it follows registration order. A <code>Map&lt;String, T&gt;</code> is keyed by bean name.' },
    { kind: 'concept', q: 'Two <code>PaymentGateway</code> beans, no qualifier or primary, the app is built with Boot’s Maven plugin. Which bean does this get?', code: `OrderService(PaymentGateway stripeGateway) { … }`, options: ['Startup fails: ambiguous', 'stripeGateway: the parameter name matches the bean name', 'paypalGateway: alphabetical', 'A random one'], answer: 1, explain: 'As a last resort Spring matches the parameter name against bean names. It needs the <code>-parameters</code> compiler flag, which Boot’s build plugins set. It works, but a rename silently changes behaviour, so prefer <code>@Qualifier</code>.' },
    { kind: 'concept', q: 'A <code>@Transactional</code> method on a class you created with <code>new</code> inside another bean. Does it run in a transaction?', options: ['Yes, the annotation is on the method', 'Only if the caller is transactional', 'No: no proxy was created for that instance, unless the caller already started one', 'Yes, if @EnableTransactionManagement is present'], answer: 2, explain: 'Transactions are applied by a proxy that the container creates around beans. An object built with <code>new</code> has no proxy, so the annotation is ignored. It joins a transaction only if its caller already started one.' }
  ],
  interview: [
    { q: 'What is inversion of control, and how is DI one form of it?', a: '<p>IoC means the framework, not your code, controls object creation and the flow around it. DI is the form where an object declares its dependencies (constructor, setter or field) and the container supplies them. Other forms include the template method pattern and service locators. DI is preferred because dependencies are explicit and the code stays testable without the container.</p>', lvl: 'core' },
    { q: 'BeanFactory vs ApplicationContext?', a: '<p><code>BeanFactory</code> is the core container: definitions, creation, wiring. <code>ApplicationContext</code> extends it with an <code>Environment</code> (profiles and properties), event publishing, <code>MessageSource</code>, resource loading, automatic registration of BeanFactoryPostProcessors and BeanPostProcessors, and <b>eager</b> creation of non-lazy singletons on refresh. In practice you always use an ApplicationContext.</p>', lvl: 'core' },
    { q: 'Why prefer constructor injection?', a: '<ul><li>Fields can be <code>final</code>: the object is complete and immutable after construction.</li><li>Dependencies are visible in the API, so a bloated class is obvious.</li><li>Unit tests just call <code>new</code>, with no reflection or context.</li><li>Cycles fail fast instead of being resolved with half-built objects.</li></ul><p>Setter injection is fine for genuinely optional dependencies. Field injection is acceptable in tests.</p>', lvl: 'core' },
    { q: 'How does Spring choose a bean when several match?', a: '<p>It finds all candidates by type (generics included), then narrows: <code>@Qualifier</code> (or a custom qualifier annotation) first; then <code>@Primary</code>; then, in Spring 6.2+, beans not marked <code>@Fallback</code>; then a match of the parameter or field name against bean names. If more than one remains, it throws <code>NoUniqueBeanDefinitionException</code>. Collection, array and <code>Map</code> injection points get all candidates.</p>', fu: 'How would you inject “all strategies, sorted”? (<code>List&lt;T&gt;</code> with <code>@Order</code>.)', lvl: 'core' },
    { q: 'How does Spring resolve a circular dependency, and why did Boot turn that off?', a: '<p>For singletons with field or setter injection, Spring instantiates A, registers an early-reference factory in the third-level cache (<code>singletonFactories</code>), then populates A. When B needs A, it gets that early reference (via <code>getEarlyBeanReference</code>, which lets AOP create the proxy early) and the reference moves to <code>earlySingletonObjects</code>. Constructor cycles can’t work this way, because no object exists yet. Boot 2.6 made <code>allow-circular-references</code> default to <code>false</code> because cycles are usually a design smell and can expose partly initialised beans.</p>', fu: 'Why can @Async break this when @Transactional does not? (The async post-processor wraps the bean after initialisation, not via the early-reference hook, so B ends up holding the raw object.)', lvl: 'deep' },
    { q: 'When is @Autowired not needed?', a: '<p>On a class with exactly one constructor (Spring 4.3+). It is also unnecessary on <code>@Bean</code> method parameters, which are always resolved from the context. You still need it to choose among several constructors, or for field and setter injection.</p>', lvl: 'core' },
    { q: 'How do you inject something optional or lazily?', a: '<p><code>ObjectProvider&lt;T&gt;</code> (<code>getIfAvailable()</code>, <code>getIfUnique()</code>, <code>orderedStream()</code>), <code>Optional&lt;T&gt;</code>, or <code>@Autowired(required = false)</code>. For lazy resolution, <code>@Lazy</code> on the injection point injects a proxy that looks the bean up on first use. <code>ObjectProvider</code> is also how you get a new prototype instance per call.</p>', lvl: 'core' },
    { q: 'What happens between “refresh started” and “singletons created”?', a: '<ol><li>Bean definitions are loaded (scan, <code>@Import</code>, auto-configuration).</li><li><code>BeanFactoryPostProcessor</code>s run: <code>ConfigurationClassPostProcessor</code> parses <code>@Configuration</code> classes; placeholders are resolved.</li><li><code>BeanPostProcessor</code>s are instantiated and registered (they must exist before other beans so they can wrap them).</li><li>Message source, event multicaster and (in Boot web apps) the web server are initialised.</li><li><code>preInstantiateSingletons()</code> creates every non-lazy singleton; then <code>SmartInitializingSingleton</code> callbacks run and <code>ContextRefreshedEvent</code> is published.</li></ol>', lvl: 'deep' },
    { q: 'What is the default bean name, and why does it matter?', a: '<p>For a scanned class, the simple class name with the first letter lower-cased (<code>OrderService</code> → <code>orderService</code>). For a <code>@Bean</code> method, the method name. Names matter for qualifier matching, the parameter-name fallback, <code>Map&lt;String,T&gt;</code> keys, and overriding: since Boot 2.1, <code>spring.main.allow-bean-definition-overriding</code> is false, so two definitions with the same name fail startup.</p>', lvl: 'core' },
    { q: 'How would you implement a strategy pattern with DI?', a: '<p>Make each strategy a bean implementing one interface, then inject <code>Map&lt;String, Strategy&gt;</code> (keyed by bean name) or <code>List&lt;Strategy&gt;</code> and index it by a <code>key()</code> method in the constructor. Adding a strategy is then adding a class, with no switch statements and no changes to the router.</p>', lvl: 'core' },
    { q: 'Is a Spring singleton thread-safe?', a: '<p>No. “Singleton” is only about the number of instances per container. One instance serves all threads concurrently, so it must be stateless or guard mutable state. Keep request data in method locals or request-scoped beans, not in fields.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Constructor injection + strategy map', lang: 'java', code: `public interface PaymentGateway { String key(); Receipt charge(Order o); }

@Component @Primary
class StripeGateway implements PaymentGateway { public String key() { return "stripe"; } … }

@Component
class PaypalGateway implements PaymentGateway { public String key() { return "paypal"; } … }

@Service
public class CheckoutService {
  private final Map<String, PaymentGateway> gateways;
  private final PaymentGateway fallback;               // the @Primary one

  CheckoutService(List<PaymentGateway> all, PaymentGateway fallback) {
    this.gateways = all.stream().collect(Collectors.toMap(PaymentGateway::key, g -> g));
    this.fallback = fallback;
  }
  public Receipt pay(Order o) { return gateways.getOrDefault(o.provider(), fallback).charge(o); }
}`, note: 'No <code>@Autowired</code>: one constructor. <code>List</code> gets every gateway; the single-valued parameter gets the <code>@Primary</code> one.' },
    { title: 'Custom qualifier annotation', lang: 'java', code: `@Target({ElementType.TYPE, ElementType.PARAMETER, ElementType.FIELD, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Qualifier
public @interface ReadOnly {}

@Configuration
class DataSources {
  @Bean @Primary DataSource primary(…) { … }
  @Bean @ReadOnly DataSource replica(…) { … }
}

@Repository
class ReportRepository {
  ReportRepository(@ReadOnly DataSource ds) { … }   // type-safe, survives renames
}`, note: 'A meta-annotated qualifier is refactor-safe, unlike string names.' },
    { title: 'Optional and lazy dependencies', lang: 'java', code: `@Service
class AuditService {
  private final ObjectProvider<MeterRegistry> meters;

  AuditService(ObjectProvider<MeterRegistry> meters) { this.meters = meters; }

  void record(String event) {
    meters.ifAvailable(r -> r.counter("audit.events", "type", event).increment());
  }
}

// Break a cycle as a last resort: inject a lazy-resolution proxy
OrderService(@Lazy AuditService audit) { this.audit = audit; }`, note: 'Spring Boot 3.x / Framework 6.x.' },
    { title: 'Find who depends on what', lang: 'bash', code: `# Actuator: every bean, its type, scope and dependencies
curl -s localhost:8080/actuator/beans | jq '.contexts[].beans.orderService'

# needs: management.endpoints.web.exposure.include=beans
# Startup timeline per bean (Boot 2.4+): BufferingApplicationStartup + /actuator/startup`, note: 'See <a href="actuator-observability.html">Actuator & observability</a> for exposing endpoints safely.' }
  ]
});
