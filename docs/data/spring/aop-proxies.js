IA.register({
  track: 'spring',
  slug: 'aop-proxies',
  title: 'AOP & proxies',
  tagline: '<code>@Transactional</code>, <code>@Cacheable</code>, <code>@Async</code>, <code>@PreAuthorize</code> and your own aspects all work the same way: Spring puts a <b>proxy</b> in front of your bean, and the proxy runs a chain of interceptors before and after calling your real object. Anything that doesn’t go <i>through</i> the proxy (a call on <code>this</code>, a final method, an object made with <code>new</code>) gets none of it.',
  tldr: {
    problem: 'Annotations that silently do nothing: a <code>REQUIRES_NEW</code> that never opens a transaction, a cache that never caches, an NPE on a field that is definitely injected, or a startup error saying your bean is a <code>$Proxy87</code>.',
    model: 'The container stores the <b>proxy</b>, created in a BeanPostProcessor after init. Calls from <i>other</i> beans enter the proxy, run each interceptor in <code>@Order</code> (lowest value outermost), reach the target, and unwind in reverse. Inside the target, <code>this</code> is the raw object, so internal calls skip the chain.',
    hook: '“Why doesn’t @Transactional work when I call the method from the same class?” Self-invocation never passes through the proxy. Move the method to another bean, or use <code>TransactionTemplate</code>.',
    facts: [
      { v: 'Boot 2.0+', l: '<code>spring.aop.proxy-target-class=true</code> by default: class-based CGLIB proxies even when the bean implements an interface' },
      { v: 'lower @Order = outer', l: 'higher-precedence advice runs first on the way in and last on the way out' },
      { v: '6.0', l: 'Spring Framework version since which <code>@Transactional</code> also works on protected and package-private methods with class-based proxies (never private)' }
    ]
  },
  intro: {
    what: 'Some concerns cut across many classes: transactions, security checks, timing, caching. Instead of writing that code in every method, <b>aspect-oriented programming</b> (AOP) lets you write it once and say where it applies. Spring does this at runtime by handing other beans a <b>proxy</b>: a generated object that looks like your bean, does the extra work, and then calls your real bean.',
    analogy: { icon: '🛂', title: 'A reception desk in front of an office', text: 'Visitors never walk straight into the office. They stop at reception: ID check (security), sign-in book (logging), a timer for the meeting (metrics). Then they’re shown in. But if someone already inside the office walks to the next desk, they don’t go back through reception. That’s self-invocation.' },
    steps: [
      { t: 'You annotate a method', d: '<code>@Transactional</code>, <code>@Cacheable</code> or your own annotation backed by an aspect.', code: '@Transactional\npublic void placeOrder(Order o) { … }' },
      { t: 'Spring wraps the bean at startup', d: 'After the bean is initialised, a post-processor checks whether any advice applies to its methods. If so, it generates a proxy class and registers the proxy instead of your object.' },
      { t: 'Other beans get the proxy', d: 'Your controller’s <code>orderService</code> field holds the proxy. <code>orderService.getClass()</code> prints something like <code>OrderService$$SpringCGLIB$$0</code>.' },
      { t: 'Calls go through the interceptor chain', d: 'Each layer runs its “before” part, calls the next, and runs its “after” part on the way back.' },
      { t: 'Calls that skip the proxy skip everything', d: 'Calls on <code>this</code>, <code>private</code>, <code>final</code> or <code>static</code> methods, and objects created with <code>new</code>, never pass through it.' }
    ],
    terms: [
      ['aspect', 'A class holding cross-cutting logic (<code>@Aspect</code>), made of pointcuts and advice.'],
      ['advice', 'The code to run: <code>@Before</code>, <code>@AfterReturning</code>, <code>@AfterThrowing</code>, <code>@After</code>, <code>@Around</code>.'],
      ['pointcut', 'An expression choosing where advice applies, e.g. <code>execution(* com.shop..*Service.*(..))</code> or <code>@annotation(Timed)</code>.'],
      ['join point', 'A point in execution where advice can run. In Spring AOP it is always a method execution on a bean.'],
      ['JDK dynamic proxy', 'A generated class implementing the bean’s interfaces. Only interface methods are proxied.'],
      ['CGLIB proxy', 'A generated <b>subclass</b> of the bean class that overrides its methods. It can’t override final or private methods.']
    ]
  },
  visual: {
    title: 'Follow one call through the proxy',
    caption: 'The dashed box is the proxy, with three interceptors stacked by <code>@Order</code>; the grey box is your real object. Press Play and follow the dot. Then try <b>self-invocation</b>, a <b>final method</b> and a <b>JDK proxy</b> to see each way the chain gets bypassed or breaks.'
  },
  extras: [
    { id: 'aop-proxies-order', title: 'Advice order: who wraps whom?', label: 'Order', caption: 'Pick an ordering of a timing aspect, a logging aspect and the transaction interceptor, and whether the target throws. Step through to see every advice in sequence, then read what that order means for your logs and metrics.' }
  ],
  gotchas: [
    { trap: 'Self-invocation skips the proxy', code: `@Service
class OrderService {
  @Transactional public void placeOrder(Order o) { …; audit(o); }   // this.audit()
  @Transactional(propagation = REQUIRES_NEW) public void audit(Order o) { … } // ignored
}`, why: 'The proxy only sees calls that arrive from outside. Inside <code>placeOrder()</code>, <code>this</code> is the target object, so <code>audit()</code> is a plain Java call and its annotation is never read.', fix: 'Move <code>audit()</code> to a separate bean (cleanest), use <code>TransactionTemplate</code> for the inner part, or, as a last resort, <code>@EnableAspectJAutoProxy(exposeProxy = true)</code> and <code>((OrderService) AopContext.currentProxy()).audit(o)</code>.' },
    { trap: 'final methods run on the proxy instance, with null fields', code: `@Service
class PaymentService {
  private final PaymentRepository repo;
  @Transactional public final void pay(…) { repo.save(…); }  // NPE: repo is null
}`, why: 'CGLIB can’t override a final method, so a call to <code>pay()</code> on the proxy runs the inherited body on the <i>proxy object</i>. The proxy was instantiated without running your constructor (Objenesis), so all its fields are null. No interceptor runs either.', fix: 'Don’t make advised methods (or the class) final. Watch out for linters that add <code>final</code>, and use the <code>kotlin-spring</code> (all-open) plugin in Kotlin, where classes are final by default.' },
    { trap: 'private (and static) methods are never advised', code: `@Transactional private void reprice() { … }   // no transaction, no warning`, why: 'A subclass can’t override private or static methods, and a JDK proxy only exposes interface methods.', fix: 'Make the method at least package-private (Spring 6.0+ with class-based proxies) or public, and call it from another bean.' },
    { trap: 'Injecting the implementation class with JDK proxies', code: `spring.aop.proxy-target-class: false

@Autowired OrderServiceImpl impl;   // BeanNotOfRequiredTypeException: …was actually of type 'jdk.proxy2.$Proxy87'`, why: 'A JDK proxy implements the interfaces; it is not a subclass of the implementation, so it can’t be assigned to that type.', fix: 'Inject the interface, or keep Boot’s default (class-based proxies). Use <code>AopUtils.getTargetClass(bean)</code> when you need the real class.' },
    { trap: 'Aspect order left undefined', why: 'Aspects without <code>@Order</code> and the transaction advisor all default to <code>Ordered.LOWEST_PRECEDENCE</code>. Equal precedence means the order between them is not defined, so a retry aspect may end up inside the transaction it should be retrying.', fix: 'Give every aspect an explicit <code>@Order</code>. If you need the transaction inside or outside a specific aspect, set <code>@EnableTransactionManagement(order = …)</code> too.' },
    { trap: 'Pointcut too broad, or too narrow', code: `@Around("execution(* com.shop..*(..))")           // advises every bean method, incl. config & getters
@Around("execution(* com.shop.service.*.*(..))")   // misses com.shop.service.impl.*`, why: '<code>..</code> in a type pattern matches any number of sub-packages; <code>*</code> matches exactly one segment. A broad pointcut proxies every bean in the package (slower startup, deeper stack traces); a narrow one silently skips classes.', fix: 'Prefer annotation-driven pointcuts (<code>@annotation(com.shop.Timed)</code>, <code>@within(…)</code>) combined with a package scope, and assert with <code>AopUtils.isAopProxy(bean)</code> in a test.' }
  ],
  scenarios: [
    { title: 'Audit trail is missing exactly the failed payments',
      symptom: 'Compliance asks why declined payments never appear in <code>audit_log</code>. Successful ones do.',
      diagnose: `-- the audit insert is in the same transaction as the order
SELECT pid, xact_start, query FROM pg_stat_activity WHERE application_name = 'shop';
-- one transaction id for both INSERTs; on failure both roll back

@Transactional(propagation = REQUIRES_NEW)   // intended: commit independently
public void audit(Order o) { … }               // called as this.audit(o)`,
      cause: 'Self-invocation. <code>audit()</code> was called from <code>placeOrder()</code> on the same bean, so REQUIRES_NEW never applied and the audit row rolled back with the failed order.',
      fix: 'Extract an <code>AuditService</code> bean. Its method runs through its own proxy and commits in a separate transaction. Add a test that asserts an audit row exists after a declined payment.',
      fixCode: `@Service
class AuditService {
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void record(Order o, String outcome) { repo.save(new AuditEntry(o.id(), outcome)); }
}

@Service
class OrderService {
  private final AuditService audit;
  @Transactional public void placeOrder(Order o) {
    try { charge(o); audit.record(o, "PAID"); }
    catch (PaymentDeclined e) { audit.record(o, "DECLINED"); throw e; }   // survives the rollback
  }
}` },
    { title: 'NPEs in production after a “make methods final” refactor',
      symptom: 'After a static-analysis rule was enabled and auto-fixed, <code>NullPointerException: this.repo is null</code> appears in services that have worked for years, only on methods with <code>@Transactional</code>.',
      diagnose: `# startup log, DEBUG level (logging.level.org.springframework.aop=debug):
Final method [public final void com.shop.PaymentService.pay(...)] cannot get proxied via CGLIB:
Calls to this method will NOT be routed to the target instance and might lead to NPEs
against uninitialized fields in the proxy instance.`,
      cause: 'The auto-fix added <code>final</code> to public methods. On a CGLIB proxy, a final method runs on the proxy object itself, whose fields were never set.',
      fix: 'Revert <code>final</code> on bean methods and exclude Spring components from that rule. Enable DEBUG for <code>org.springframework.aop</code> in a test and treat that CGLIB log line as build-breaking (or enforce it with the ArchUnit rule below).',
      fixCode: `// ArchUnit guard
@ArchTest
static final ArchRule noFinalPublicMethodsInServices =
    methods().that().areDeclaredInClassesThat().areAnnotatedWith(Service.class)
        .and().arePublic().should().notHaveModifier(JavaModifier.FINAL);` },
    { title: 'Retry on optimistic-lock failures never succeeds',
      symptom: 'A custom <code>@RetryOnConflict</code> aspect retries three times, and all three attempts fail with <code>ObjectOptimisticLockingFailureException</code>, even when there is no further contention.',
      diagnose: `# log order per attempt
TransactionInterceptor: begin
RetryAspect: attempt 1 → OptimisticLockException
RetryAspect: attempt 2 → OptimisticLockException   ← same transaction, same stale entity
…
TransactionInterceptor: rollback`,
      cause: 'Both the retry aspect and the transaction advisor had the default lowest precedence. The retry ended up <i>inside</i> the transaction, so every attempt reused the same persistence context with the same stale version.',
      fix: 'Order the retry outside the transaction so each attempt starts a fresh transaction and re-reads the row.',
      fixCode: `@Aspect @Component
@Order(Ordered.HIGHEST_PRECEDENCE)       // outermost: wraps the transaction
class RetryAspect {
  @Around("@annotation(retry)")
  Object retry(ProceedingJoinPoint pjp, RetryOnConflict retry) throws Throwable {
    for (int i = 1; ; i++) {
      try { return pjp.proceed(); }
      catch (OptimisticLockingFailureException e) { if (i >= retry.attempts()) throw e; }
    }
  }
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Called from a controller. How many transactions are started?', code: `@Service
class OrderService {
  @Transactional
  public void placeOrder() { saveOrder(); audit(); }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void audit() { … }
}`, options: ['2: the outer one and a new one for audit()', '1: audit() is a self-call and its annotation is ignored', '0: nested @Transactional cancels out', 'Startup fails: conflicting propagation'], answer: 1, explain: 'Only <code>placeOrder()</code> enters through the proxy. <code>audit()</code> is called on <code>this</code>, the target, so the REQUIRES_NEW interceptor never runs. Everything happens in one transaction.' },
    { kind: 'predict', q: 'Two aspects advise the same method, each with an <code>@Around</code> that prints before and after <code>proceed()</code>. A is <code>@Order(1)</code>, B is <code>@Order(2)</code>. Output?', options: ['A-in, B-in, target, A-out, B-out', 'A-in, B-in, target, B-out, A-out', 'B-in, A-in, target, A-out, B-out', 'Order is undefined'], answer: 1, explain: 'Lower order value = higher precedence = outer layer. A wraps B, which wraps the target: in A then B, out B then A. Like nested try/finally blocks.' },
    { kind: 'predict', q: 'One aspect has all of these for the same method (Spring 6.x), and the target returns normally. In what order do they run?', code: `@Around  // prints "around-in" … proceed() … "around-out"
@Before  // prints "before"
@After   // prints "after"
@AfterReturning // prints "returning"`, options: ['before, around-in, target, around-out, returning, after', 'around-in, before, target, returning, after, around-out', 'around-in, before, target, after, returning, around-out', 'before, around-in, target, after, around-out, returning'], answer: 1, explain: 'Within one aspect (since 5.2.7) precedence is Around, Before, After, AfterReturning, AfterThrowing. Higher precedence goes in first and out last. So: around-in, before, target, then on the way out returning, after (it behaves like <code>finally</code>), around-out.' },
    { kind: 'predict', q: 'Boot 3.x defaults. What happens when <code>pay()</code> is called from another bean?', code: `@Service
public class PaymentService {
  private final PaymentRepository repo;
  public PaymentService(PaymentRepository repo) { this.repo = repo; }
  @Transactional public final void pay(Payment p) { repo.save(p); }
}`, options: ['Works in a transaction', 'Works, but without a transaction', 'NullPointerException: repo is null', 'Startup fails: final method'], answer: 2, explain: 'The CGLIB proxy can’t override <code>pay()</code>, so the inherited body runs on the <b>proxy instance</b>, whose constructor never ran: <code>repo</code> is null. Startup doesn’t fail: Spring only logs the final method at DEBUG level (a WARN appears only when the final method implements an interface method).' },
    { kind: 'predict', q: '<code>spring.aop.proxy-target-class=false</code>. <code>OrderServiceImpl implements OrderService</code> and has a <code>@Transactional</code> method. What happens?', code: `@RestController
class OrderController {
  OrderController(OrderServiceImpl service) { … }
}`, options: ['Works: Spring injects the target', 'Works: Spring injects a CGLIB proxy', 'Startup fails: BeanNotOfRequiredTypeException (it is a JDK proxy)', 'Works, but transactions are off'], answer: 2, explain: 'With class-based proxying disabled, Spring creates a JDK dynamic proxy that implements <code>OrderService</code>. It is not an <code>OrderServiceImpl</code>, so it can’t be injected as one. Boot’s default (<code>true</code>) avoids this.' },
    { kind: 'concept', q: 'Does this pointcut match <code>com.shop.service.impl.OrderServiceImpl.place()</code>?', code: `@Before("execution(* com.shop.service.*.*(..))")`, options: ['Yes: * matches any package depth', 'No: com.shop.service.* matches only types directly in com.shop.service', 'Only if the method is public', 'Only with AspectJ weaving'], answer: 1, explain: 'In a type pattern <code>*</code> matches one name segment, so the declaring type must be directly in <code>com.shop.service</code>. Use <code>com.shop.service..*.*(..)</code> to include sub-packages.' },
    { kind: 'predict', q: 'What does this print for a bean with a <code>@Transactional</code> method (Boot 3.x defaults)?', code: `System.out.println(orderService.getClass() == OrderService.class);
System.out.println(AopUtils.getTargetClass(orderService) == OrderService.class);`, options: ['true / true', 'false / true', 'false / false', 'true / false'], answer: 1, explain: 'The injected object is a generated subclass (named like <code>OrderService$$SpringCGLIB$$0</code> in Spring 6), so <code>getClass()</code> differs. <code>AopUtils.getTargetClass</code> unwraps it.' },
    { kind: 'concept', q: 'Which of these does Spring AOP (proxy-based) <b>not</b> intercept, while AspectJ weaving can?', options: ['Public method calls from another bean', 'A method called on this from inside the same object', 'Calls to an interface method on a JDK proxy', '@Around advice on a @Service'], answer: 1, explain: 'Proxy-based AOP only sees calls that cross the proxy. AspectJ compile-time or load-time weaving changes the bytecode of the class itself, so it also covers self-calls, private and final methods, constructors and field access.' }
  ],
  interview: [
    { q: 'JDK dynamic proxy vs CGLIB: how do they differ?', a: '<p>A <b>JDK proxy</b> is generated at runtime to implement the target’s interfaces and dispatch through an <code>InvocationHandler</code>. Only interface methods are proxied, and the proxy can’t be cast to the implementation class. A <b>CGLIB proxy</b> is a generated subclass that overrides non-final, non-private methods and dispatches to interceptors. It works without interfaces but can’t handle final classes or methods. Spring Boot defaults to CGLIB (<code>proxy-target-class=true</code>) so injecting by class or interface both work.</p>', lvl: 'core' },
    { q: 'Explain the self-invocation problem and the ways around it.', a: '<p>Advice lives in the proxy. A method calling another method on <code>this</code> is a direct call on the target, so the second method’s advice never runs. Fixes, best first:</p><ul><li>Move the method to another bean.</li><li>Use programmatic APIs (<code>TransactionTemplate</code>) for the inner boundary.</li><li><code>AopContext.currentProxy()</code> with <code>exposeProxy = true</code> (couples code to AOP).</li><li>AspectJ weaving (<code>mode = ASPECTJ</code>), which modifies the class itself.</li></ul>', lvl: 'core' },
    { q: 'How does a bean become a proxy?', a: '<p>An <code>AbstractAutoProxyCreator</code> (e.g. <code>AnnotationAwareAspectJAutoProxyCreator</code>) is a BeanPostProcessor. In <code>postProcessAfterInitialization</code> it collects every <code>Advisor</code> in the context (aspect advice, the transaction advisor, the caching advisor and so on), checks whether any pointcut matches a method of the bean class, and if so builds a <code>ProxyFactory</code> with the matching advisors sorted by order. The proxy replaces the bean in the container. For circular references it can do this earlier through <code>getEarlyBeanReference</code>.</p>', lvl: 'deep' },
    { q: 'Advice, advisor, pointcut, join point: define them.', a: '<p><b>Join point</b>: a place advice can apply. In Spring AOP, always a method execution. <b>Pointcut</b>: a predicate selecting join points. <b>Advice</b>: the action (before, after, around…). <b>Advisor</b>: a pointcut + one advice, Spring’s internal unit. <b>Aspect</b>: a class grouping pointcuts and advice. Infrastructure such as transactions is implemented as an advisor (<code>BeanFactoryTransactionAttributeSourceAdvisor</code>) rather than an <code>@Aspect</code>.</p>', lvl: 'core' },
    { q: 'How is advice ordered?', a: '<p>Across aspects or advisors: by <code>Ordered</code>/<code>@Order</code>, with lower values having higher precedence, which means outer (first in, last out). Equal precedence means undefined order. Within one aspect (Spring 5.2.7+): <code>@Around</code>, <code>@Before</code>, <code>@After</code>, <code>@AfterReturning</code>, <code>@AfterThrowing</code>, with <code>@After</code> running after the returning/throwing advice. Two advice methods of the same type in one aspect have undefined order, so split them into separate aspects if order matters.</p>', lvl: 'deep' },
    { q: 'Why do final methods cause NullPointerExceptions instead of just skipping advice?', a: '<p>CGLIB proxy instances are created with Objenesis, bypassing constructors, so all their fields are null. A non-final method is overridden and delegates to the target, which does have its fields. A final method can’t be overridden, so the call executes the original body <b>on the proxy instance</b>, where the injected fields are null.</p>', lvl: 'deep' },
    { q: 'Spring AOP vs AspectJ?', a: '<p>Spring AOP is proxy-based and runtime-only: method execution on Spring beans, no self-calls, no final/private methods, no field or constructor join points. It uses AspectJ’s annotation style and pointcut language, but not its weaver. Full AspectJ weaves bytecode at compile time (ajc) or load time (a Java agent) and handles all of those cases, at the cost of build or agent complexity. Most applications never need full AspectJ.</p>', lvl: 'core' },
    { q: 'Should @Transactional go on the interface or the class?', a: '<p>On the class (or its methods). Since Spring 5, annotations on interfaces are honoured for both JDK and CGLIB proxies in most cases, but class-level placement is unambiguous, survives a switch to AspectJ weaving (which ignores interface annotations), and keeps the contract with the implementation.</p>', lvl: 'core' },
    { q: 'How would you write a timing aspect for methods annotated @Timed?', a: '<p>An <code>@Aspect @Component</code> with <code>@Around("@annotation(timed)")</code> binding the annotation as a parameter. Start a <code>Timer.Sample</code>, call <code>pjp.proceed()</code> in a <code>try</code>, and stop the sample in <code>finally</code> with tags from the annotation and the outcome. Give it an explicit <code>@Order</code> relative to transactions. (Micrometer already ships <code>TimedAspect</code>, and the Observation API with <code>@Observed</code>.)</p>', lvl: 'core' },
    { q: 'Which pointcut designators do you actually use in Spring?', a: '<ul><li><code>execution(…)</code>: method signature patterns.</li><li><code>within(com.shop..*)</code>: all methods of types in a package.</li><li><code>@annotation(X)</code>: the method has annotation X.</li><li><code>@within(X)</code>: the declaring type has annotation X.</li><li><code>args(…)</code>, <code>this(…)</code> (proxy type), <code>target(…)</code> (target type).</li><li><code>bean(orderService)</code>: Spring-specific, by bean name.</li></ul><p>Combine with <code>&amp;&amp;</code>, <code>||</code>, <code>!</code>, and name them with <code>@Pointcut</code>.</p>', lvl: 'core' },
    { q: 'What does exposeProxy do, and why avoid it?', a: '<p><code>@EnableAspectJAutoProxy(exposeProxy = true)</code> stores the current proxy in a ThreadLocal during each call, so <code>AopContext.currentProxy()</code> can return it for self-calls. It works, but ties business code to Spring AOP, costs a ThreadLocal per call and hides a design smell (two responsibilities in one bean).</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'An annotation-driven @Around aspect', lang: 'java', code: `@Target(ElementType.METHOD) @Retention(RetentionPolicy.RUNTIME)
public @interface Timed { String value(); }

@Aspect
@Component
@Order(1)                                     // outside the transaction
class TimingAspect {
  private final MeterRegistry registry;
  TimingAspect(MeterRegistry registry) { this.registry = registry; }

  @Around("@annotation(timed) && within(com.shop..*)")
  Object time(ProceedingJoinPoint pjp, Timed timed) throws Throwable {
    Timer.Sample sample = Timer.start(registry);
    String outcome = "ok";
    try { return pjp.proceed(); }
    catch (Throwable t) { outcome = t.getClass().getSimpleName(); throw t; }
    finally { sample.stop(registry.timer(timed.value(), "outcome", outcome)); }
  }
}`, note: 'Needs <code>spring-boot-starter-aop</code> on Boot 3.x (it brings AspectJ’s <code>aspectjweaver</code>). Boot 4: the starter is renamed <code>spring-boot-starter-aspectj</code>.' },
    { title: 'Escaping self-invocation without a new class', lang: 'java', code: `@Service
class ImportService {
  private final TransactionTemplate requiresNew;

  ImportService(PlatformTransactionManager tm) {
    this.requiresNew = new TransactionTemplate(tm);
    this.requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
  }

  @Transactional
  public void importAll(List<Row> rows) {
    for (Row r : rows) {
      try { save(r); }
      catch (DataIntegrityViolationException e) {
        requiresNew.executeWithoutResult(s -> errors.save(new ImportError(r, e)));  // own tx
      }
    }
  }
}` },
    { title: 'Test that a bean is (or isn’t) proxied', lang: 'java', code: `@SpringBootTest
class ProxyWiringTest {
  @Autowired OrderService orderService;
  @Autowired ReportService reportService;

  @Test void advisedBeansAreProxies() {
    assertThat(AopUtils.isAopProxy(orderService)).isTrue();
    assertThat(AopUtils.isCglibProxy(orderService)).isTrue();          // Boot default
    assertThat(AopUtils.getTargetClass(orderService)).isEqualTo(OrderService.class);
  }
}` }
  ]
});
