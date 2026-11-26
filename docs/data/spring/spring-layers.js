IA.register({
  track: 'spring',
  slug: 'spring-layers',
  title: 'Controller, service, repository',
  tagline: 'Most Spring apps split into three layers: the <b>controller</b> speaks HTTP, the <b>service</b> holds business rules, the <b>repository</b> talks to the database. Spring creates one bean per class and wires them through <b>constructors</b>.',
  tldr: {
    problem: 'Put HTTP parsing, rules and SQL in one class and it becomes impossible to test, reuse or change safely.',
    model: '<code>Controller → Service → Repository → DB</code>. Each layer only calls the one below. Classes are marked with stereotype annotations, found by component scan, and receive their dependencies through the constructor.',
    hook: '“Why constructor injection over field injection?” Dependencies become explicit and <code>final</code>, the object is never half-built, and tests can call <code>new</code> with fakes.',
    facts: [
      { v: '4', l: 'common stereotypes: <code>@Component</code>, <code>@Service</code>, <code>@Repository</code>, <code>@Controller</code> (plus <code>@RestController</code>)' },
      { v: '4.3+', l: 'Spring version since which a single constructor needs no <code>@Autowired</code>' },
      { v: 'singleton', l: 'default bean scope: one shared instance, used by all requests at once, so keep beans stateless' }
    ]
  },
  intro: {
    what: 'A library app lets members borrow books. Somebody has to read the HTTP request, somebody has to check “max 3 loans”, somebody has to write a row to the database. Giving each job its own class (a <b>layer</b>) keeps the code easy to follow. Spring creates these classes for you and connects them.',
    analogy: { icon: '🍽️', title: 'A restaurant', text: 'The waiter (controller) takes the order and brings the plate but never cooks. The chef (service) decides how the dish is made. The pantry keeper (repository) fetches and stores ingredients. The manager (Spring) hires them all on opening day and tells each one who they work with.' },
    steps: [
      { t: 'Repository: data access', d: 'With Spring Data JPA you only write an interface.', code: 'public interface LoanRepository extends JpaRepository<Loan, Long> {\n  long countByMemberId(Long memberId);\n}' },
      { t: 'Service: business rules', d: 'Mark it <code>@Service</code>. It receives the repository in its constructor.', code: '@Service\npublic class LoanService {\n  private final LoanRepository loans;\n  public LoanService(LoanRepository loans) { this.loans = loans; }\n\n  public Loan borrow(Long bookId, Long memberId) {\n    if (loans.countByMemberId(memberId) >= 3) throw new TooManyLoansException();\n    return loans.save(new Loan(bookId, memberId));\n  }\n}' },
      { t: 'Controller: HTTP in and out', d: 'Mark it <code>@RestController</code>. It calls the service and returns data.', code: '@RestController\n@RequestMapping("/loans")\nclass LoanController {\n  private final LoanService service;\n  LoanController(LoanService service) { this.service = service; }\n\n  @PostMapping\n  LoanDto borrow(@RequestBody BorrowRequest r) {\n    return LoanDto.from(service.borrow(r.bookId(), r.memberId()));\n  }\n}' },
      { t: 'Spring wires it at startup', d: 'Component scan finds the annotated classes, creates the repository, then the service (passing the repository), then the controller (passing the service).' }
    ],
    terms: [
      ['layer', 'A group of classes with one responsibility (web, business, data).'],
      ['stereotype annotation', '<code>@Component</code> and its specialisations; they mark a class as a bean and say what role it plays.'],
      ['constructor injection', 'Spring passes dependencies as constructor arguments.'],
      ['DTO', 'Data Transfer Object: a simple class/record shaped for the API, separate from the database entity.'],
      ['singleton scope', 'One instance of the bean for the whole application.']
    ]
  },
  visual: {
    title: 'Three layers, one request',
    caption: 'Choose <b>Request flow</b> to follow a call down and back up, <b>Startup wiring</b> to see constructor injection, or <b>Swap for a test</b>. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Business logic in the controller', code: '@PostMapping\nLoan borrow(@RequestBody BorrowRequest r) {\n  if (repo.countByMemberId(r.memberId()) >= 3) …   // rule in web layer\n  return repo.save(…);\n}', why: 'The rule cannot be reused by a scheduled job or a message listener, and testing it needs HTTP.', fix: 'Controllers translate HTTP to a service call and back. Rules live in services.' },
    { trap: 'Field injection everywhere', code: '@Service\nclass LoanService {\n  @Autowired private LoanRepository loans;   // hidden, mutable, null in plain tests\n}', why: 'Dependencies are invisible from outside, fields cannot be <code>final</code>, and <code>new LoanService()</code> in a test leaves them null.', fix: 'Use one constructor with <code>final</code> fields. Lombok’s <code>@RequiredArgsConstructor</code> can generate it.' },
    { trap: 'Storing request data in a field of a singleton', code: '@Service\nclass CartService {\n  private Long currentUserId;   // shared by ALL requests!\n}', why: 'Beans are singletons by default and serve many threads at once. One user can see another user’s data.', fix: 'Keep beans stateless: pass per-request data as method parameters. More in <a href="bean-lifecycle-scopes.html">Bean lifecycle &amp; scopes</a>.' },
    { trap: 'Returning JPA entities straight to the client', why: 'You leak internal fields, can trigger lazy-loading errors during JSON serialization, and every column rename breaks the API.', fix: 'Map entities to response DTOs (Java records work well) in the controller or service.' },
    { trap: 'Calling <code>new</code> on a bean', code: 'LoanService s = new LoanService(new LoanRepositoryImpl());  // inside app code', why: 'An object you create yourself is not managed by Spring: no injection, no transactions, no proxies.', fix: 'Ask for it through a constructor parameter instead. Use <code>new</code> only in unit tests.' }
  ],
  scenarios: [
    { title: 'Users see each other’s carts under load', symptom: 'Rare, unreproducible reports of wrong items in a cart, only in production.', diagnose: 'Code review finds <code>private Cart current;</code> set at the start of a service method and read later.', cause: 'The service is a singleton shared by all request threads; two concurrent requests overwrite the same field.', fix: 'Make the service stateless and pass the cart around.', fixCode: '@Service\nclass CartService {\n  Cart addItem(Long userId, Item item) {\n    Cart cart = carts.findByUserId(userId).orElseGet(() -> new Cart(userId));\n    cart.add(item);\n    return carts.save(cart);\n  }\n}' },
    { title: 'Startup fails after adding a second implementation', symptom: '“Parameter 0 of constructor in NotificationService required a single bean, but 2 were found: emailSender, smsSender.”', diagnose: 'A new <code>@Component SmsSender implements Sender</code> was added next to <code>EmailSender</code>.', cause: 'Injection is by type; two beans match <code>Sender</code> and Spring will not guess.', fix: 'Mark one <code>@Primary</code>, use <code>@Qualifier</code>, or inject <code>List&lt;Sender&gt;</code>. See <a href="ioc-di.html">IoC &amp; DI</a>.', fixCode: 'NotificationService(@Qualifier("emailSender") Sender sender) { … }' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Where should the rule “a member may hold at most 3 loans” live?', options: ['In the controller', 'In the service', 'In the repository interface', 'In application.properties'], answer: 1, explain: 'Business rules belong in the service layer, so every entry point (HTTP, jobs, messages) shares them.' },
    { kind: 'concept', q: 'What is the difference between <code>@Service</code> and <code>@Component</code>?', options: ['@Service beans are prototypes', '@Service is a specialisation of @Component that documents the role; both make a bean', '@Service enables transactions automatically', '@Component cannot be injected'], answer: 1, explain: '<code>@Service</code> is meta-annotated with <code>@Component</code>. It adds no behaviour by itself; it communicates intent. (<code>@Repository</code> additionally enables persistence exception translation.)' },
    { kind: 'predict', q: 'This class has one constructor and no annotation on it. Boot 3. What happens?', code: '@Service\nclass LoanService {\n  private final LoanRepository loans;\n  LoanService(LoanRepository loans) { this.loans = loans; }\n}', options: ['Startup fails: missing @Autowired', 'Spring uses the constructor and injects the repository', 'loans stays null', 'Spring calls a no-arg constructor'], answer: 1, explain: 'Since Spring 4.3, a class with a single constructor uses it for injection automatically.' },
    { kind: 'bug', q: 'What is wrong here?', code: '@RestController\nclass ReportController {\n  private int counter;\n  @GetMapping("/report") String get() { counter++; return "n=" + counter; }\n}', options: ['Nothing', 'Controllers cannot have fields', 'The singleton is shared by concurrent requests, so counter++ is a data race', 'GET cannot change state'], answer: 2, explain: 'One controller instance serves all threads. <code>counter++</code> is not atomic; use <code>AtomicInteger</code> or, better, avoid mutable state in beans.' },
    { kind: 'concept', q: 'Main reason constructor injection makes unit tests easier?', options: ['It is faster at runtime', 'You can create the object with <code>new</code> and pass fakes, no Spring needed', 'It disables proxies', 'It avoids Mockito'], answer: 1, explain: 'All dependencies are constructor parameters, so a plain JUnit test can build the class directly.' },
    { kind: 'concept', q: 'Recommended package layout for a growing app?', options: ['One package for all classes', 'Under the main package, either by layer (web/service/repo) or by feature (loan/, book/)', 'Each class in a top-level package', 'Controllers in a different root than the main class'], answer: 1, explain: 'Both work as long as everything is under the main class’s package. Package-by-feature tends to scale better for larger apps.' }
  ],
  interview: [
    { q: 'Describe the layered architecture in a Spring app.', a: '<p>Controller (web: HTTP mapping, validation, DTOs) → Service (business logic, transactions) → Repository (persistence). Dependencies point downward only.</p>', lvl: 'core' },
    { q: 'What are stereotype annotations?', a: '<p><code>@Component</code> and its specialisations <code>@Service</code>, <code>@Repository</code>, <code>@Controller</code>. Component scanning registers them as beans. <code>@RestController</code> = <code>@Controller</code> + <code>@ResponseBody</code>. <code>@Repository</code> also translates persistence exceptions into Spring’s <code>DataAccessException</code>.</p>', lvl: 'core' },
    { q: 'Constructor vs field vs setter injection?', a: '<ul><li><b>Constructor</b>: required, immutable deps; recommended.</li><li><b>Setter</b>: optional deps that can change.</li><li><b>Field</b>: concise but hides deps and hurts testing.</li></ul>', fu: 'What happens with two constructors and no @Autowired? (Spring looks for a no-arg one; mark the one to use with @Autowired.)', lvl: 'core' },
    { q: 'Why are beans singletons by default, and what does that imply?', a: '<p>Creating stateless services once is cheap and fast. It implies the instance is shared across threads, so it must not hold per-request mutable state.</p>', lvl: 'core' },
    { q: 'Where do transactions usually go?', a: '<p>On service methods with <code>@Transactional</code>, because a business operation may span several repository calls. See <a href="transactions-propagation.html">Transactions</a>.</p>', lvl: 'core' },
    { q: 'Why use DTOs instead of returning entities?', a: '<p>To decouple the API contract from the database schema, avoid leaking fields, and avoid lazy-loading surprises during serialization.</p>', lvl: 'core' },
    { q: 'Package by layer or by feature?', a: '<p>By layer (<code>web</code>, <code>service</code>, <code>repository</code>) is simple for small apps. By feature (<code>loan</code>, <code>book</code>) keeps related code together and lets you make classes package-private. Both must sit under the main class’s package for scanning.</p>', lvl: 'deep' },
    { q: 'Should a service depend on an interface or a class?', a: '<p>An interface helps when there are real alternative implementations. With a single implementation, depending on the class is fine; Mockito can mock classes, and Spring can proxy them (CGLIB).</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Full slice (package by feature)', lang: 'java', code: `package com.example.library.loan;

@Entity
class Loan {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
  Long bookId; Long memberId; LocalDate due;
  protected Loan() {}                       // JPA needs it
  Loan(Long bookId, Long memberId) { this.bookId = bookId; this.memberId = memberId; this.due = LocalDate.now().plusWeeks(3); }
}

interface LoanRepository extends JpaRepository<Loan, Long> {
  long countByMemberId(Long memberId);
}

@Service
class LoanService {
  private final LoanRepository loans;
  LoanService(LoanRepository loans) { this.loans = loans; }

  @Transactional
  public Loan borrow(Long bookId, Long memberId) {
    if (loans.countByMemberId(memberId) >= 3) throw new ResponseStatusException(HttpStatus.CONFLICT, "max 3 loans");
    return loans.save(new Loan(bookId, memberId));
  }
}

record BorrowRequest(Long bookId, Long memberId) {}
record LoanDto(Long id, LocalDate due) { static LoanDto from(Loan l) { return new LoanDto(l.id, l.due); } }

@RestController @RequestMapping("/loans")
class LoanController {
  private final LoanService service;
  LoanController(LoanService service) { this.service = service; }

  @PostMapping @ResponseStatus(HttpStatus.CREATED)
  LoanDto borrow(@RequestBody BorrowRequest r) { return LoanDto.from(service.borrow(r.bookId(), r.memberId())); }
}`, note: 'Package-private classes are fine: Spring can still create and inject them. Throwing an HTTP exception from a service is a shortcut; larger apps throw a domain exception and map it in the web layer.' },
    { title: 'Unit test without Spring', lang: 'java', code: `class LoanServiceTest {
  LoanRepository repo = Mockito.mock(LoanRepository.class);
  LoanService service = new LoanService(repo);   // constructor injection pays off

  @Test
  void refusesFourthLoan() {
    Mockito.when(repo.countByMemberId(7L)).thenReturn(3L);
    assertThrows(ResponseStatusException.class, () -> service.borrow(42L, 7L));
    Mockito.verify(repo, Mockito.never()).save(Mockito.any());
  }
}` }
  ]
});
