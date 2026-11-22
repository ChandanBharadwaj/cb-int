IA.register({
  track: 'spring',
  slug: 'errors-validation',
  title: 'Errors & validation',
  tagline: 'An exception thrown anywhere under a controller walks a fixed <b>resolver chain</b>: your <code>@ExceptionHandler</code>s first, then <code>@ResponseStatus</code>, then Spring’s defaults, then Boot’s <code>/error</code>. Decide where each failure is caught, return <b>RFC 9457 ProblemDetail</b>, and validate at every layer that can be called on its own.',
  tldr: {
    problem: 'One API returns four error shapes, validation exceptions become 500s, a unique-key violation leaks SQL to clients, and a “validated” DTO still lets nulls into the database.',
    model: 'Web input is validated during argument resolution (<code>@Valid</code> → <code>MethodArgumentNotValidException</code>). Services are validated by a proxy (<code>@Validated</code> → <code>ConstraintViolationException</code>). Postgres constraints are the last line (<code>23505</code> → <code>DataIntegrityViolationException</code>). One <code>@RestControllerAdvice</code> maps all of them to <code>application/problem+json</code>.',
    hook: '“Why is our validation error a 500?” Because <code>ConstraintViolationException</code> from a <code>@Validated</code> service isn’t a Spring MVC exception, so nothing maps it to 400 unless you do.',
    facts: [
      { v: 'RFC 9457', l: 'Problem Details for HTTP APIs (2023), which obsoletes RFC 7807. Spring’s <code>ProblemDetail</code> (Framework 6.0+) implements it' },
      { v: 'Default', l: 'the group of every constraint without <code>groups</code>. <code>@Validated(OnCreate.class)</code> skips them unless <code>OnCreate extends Default</code>' },
      { v: '6.1', l: 'Spring MVC validates constraints declared directly on controller parameters (<code>@RequestParam @Min(1)</code>) and throws <code>HandlerMethodValidationException</code> (400)' }
    ]
  },
  intro: {
    what: 'Two things go wrong in an API: the <b>client</b> sends something invalid, or <b>your code</b> hits a problem (an order doesn’t exist, a payment fails, a bug). Validation catches the first kind early with annotations like <code>@NotBlank</code>. Exception handlers turn both kinds into a clean HTTP response with the right status code and a consistent JSON body, instead of a stack trace.',
    analogy: { icon: '📮', title: 'A post office counter', text: 'The clerk checks the form before accepting a parcel (validation): missing postcode, come back. If the parcel is lost later, you get an official “problem slip” with a reference number and a plain explanation (a ProblemDetail), not the sorting machine’s error log.' },
    steps: [
      { t: 'Annotate the request DTO', d: 'Constraints from Jakarta Validation describe what “valid” means.', code: 'record CreateOrder(@NotBlank String sku,\n                   @Min(1) @Max(100) int qty) {}' },
      { t: 'Ask Spring to validate it', d: '<code>@Valid</code> on the parameter makes Spring MVC validate after JSON parsing. A failure becomes a 400 before your method runs.', code: '@PostMapping("/orders")\nOrderDto create(@Valid @RequestBody CreateOrder cmd) { … }' },
      { t: 'Throw meaningful exceptions', d: 'In the service, throw your own exception (<code>OrderNotFoundException</code>), not a generic <code>RuntimeException</code>.' },
      { t: 'Map them in one place', d: 'A <code>@RestControllerAdvice</code> class has <code>@ExceptionHandler</code> methods that return a <code>ProblemDetail</code>: status, title, detail, plus your own fields.' }
    ],
    terms: [
      ['Bean Validation', 'The Jakarta standard (<code>jakarta.validation</code>) for constraints like <code>@NotNull</code>; Hibernate Validator implements it.'],
      ['@Valid / @Validated', '<code>@Valid</code> triggers (and cascades) validation; Spring’s <code>@Validated</code> also takes validation groups.'],
      ['@ControllerAdvice', 'A bean whose <code>@ExceptionHandler</code> methods apply to all controllers.'],
      ['ProblemDetail', 'Spring’s type for an RFC 9457 error body: <code>type</code>, <code>title</code>, <code>status</code>, <code>detail</code>, <code>instance</code>.'],
      ['validation group', 'A marker interface that lets one DTO have different rules for create and update.']
    ]
  },
  visual: {
    title: 'Throw an exception, watch who answers',
    caption: 'Pick an exception, toggle your advice and Boot’s <code>spring.mvc.problemdetails.enabled</code>, then press Play. The exception climbs the call stack to the DispatcherServlet, which asks each resolver in order. The panel shows the exact response the client gets.'
  },
  extras: [
    { id: 'errors-validation-groups', title: 'Which constraints fire for which group?', label: 'Groups', caption: 'Pick the group passed to <code>@Validated</code>. Constraints without <code>groups</code> are in <code>Default</code>. Note what happens to <code>@NotBlank name</code> when you validate only <code>OnCreate</code>.' }
  ],
  gotchas: [
    { trap: 'Validation does nothing: the starter is missing',
      why: '<code>spring-boot-starter-web</code> hasn’t included Bean Validation since Boot 2.3. Without a provider, <code>@Valid</code> has nothing to call, and invalid requests reach your code.',
      fix: 'Add <code>spring-boot-starter-validation</code> (Hibernate Validator). Write one test that posts an invalid body and expects 400.' },
    { trap: 'ConstraintViolationException from a service becomes a 500',
      code: `@Service @Validated\nclass OrderService {\n  void place(@Valid CreateOrder cmd) { … }   // proxy throws ConstraintViolationException\n}`,
      why: 'Method validation through <code>MethodValidationPostProcessor</code> throws Jakarta’s <code>ConstraintViolationException</code>. It isn’t one of Spring MVC’s standard exceptions, so no default resolver maps it.',
      fix: 'Add an <code>@ExceptionHandler(ConstraintViolationException.class)</code> that returns 400 if the input came from the client. If it signals a programming error, a 500 may be correct: decide deliberately.' },
    { trap: 'Extending ResponseEntityExceptionHandler and handling the same exception again',
      code: `@RestControllerAdvice\nclass Errors extends ResponseEntityExceptionHandler {\n  @ExceptionHandler(MethodArgumentNotValidException.class)   // already handled by the base class\n  ProblemDetail invalid(MethodArgumentNotValidException e) { … }\n}`,
      why: 'The base class already declares an <code>@ExceptionHandler</code> for it. Two handlers for the same type in one advice is an ambiguous mapping, and the context fails to start with an <code>IllegalStateException</code>.',
      fix: 'Override the protected hook instead: <code>handleMethodArgumentNotValid(…)</code>, then customise the <code>ProblemDetail</code> from <code>ex.getBody()</code>.' },
    { trap: 'A broad handler in a higher-priority advice shadows a specific one',
      why: 'Across advice beans, Spring takes the first advice (by <code>@Order</code>) that has <i>any</i> matching handler. Only within one advice does the closest exception type win. A <code>@Order(1)</code> advice with <code>@ExceptionHandler(RuntimeException.class)</code> catches everything.',
      fix: 'Keep one global advice, or give the catch-all advice the lowest precedence (<code>@Order(Ordered.LOWEST_PRECEDENCE)</code>) and specific ones higher.' },
    { trap: 'Entity constraints fire at commit, wrapped in TransactionSystemException',
      why: 'Hibernate runs Bean Validation on entities before insert or update. With deferred inserts (sequence ids), that happens at flush, typically during commit, so the violation arrives as <code>TransactionSystemException: Could not commit JPA transaction</code>.',
      fix: 'Validate the command at the service boundary, not only on the entity. If you rely on entity validation, flush inside the service so the error surfaces where you can handle it.' },
    { trap: 'Leaking SQL in the error detail',
      code: `@ExceptionHandler(DataIntegrityViolationException.class)\nProblemDetail dup(DataIntegrityViolationException e) {\n  return ProblemDetail.forStatusAndDetail(CONFLICT, e.getMessage()); // ✗ SQL, table, constraint\n}`,
      why: 'The message includes the SQL statement, the constraint name and sometimes values. It tells attackers your schema and can expose personal data.',
      fix: 'Map known constraint names (from the root cause) to a business message; log the original server-side with the trace ID.' },
    { trap: 'Groups silently skip the Default constraints',
      why: 'Validating with <code>@Validated(OnCreate.class)</code> checks <b>only</b> constraints in <code>OnCreate</code>. Every constraint without <code>groups</code> is in <code>Default</code> and is skipped.',
      fix: 'Declare <code>interface OnCreate extends Default {}</code>, or pass both: <code>@Validated({OnCreate.class, Default.class})</code>.' }
  ],
  scenarios: [
    { title: 'Mobile app shows “Something went wrong” for a duplicate email',
      symptom: 'Signing up with an existing email returns 500 with Boot’s default error body. The app can’t tell the user the email is taken.',
      diagnose: `-- Postgres log
ERROR:  duplicate key value violates unique constraint "users_email_key"
DETAIL:  Key (email)=(asha@example.com) already exists.
-- SQLSTATE 23505 → Hibernate ConstraintViolationException → DataIntegrityViolationException`,
      diagnoseLang: 'sql',
      cause: 'Nothing maps <code>DataIntegrityViolationException</code>. It reaches the container and <code>/error</code> renders a 500. A pre-check (<code>existsByEmail</code>) would be racy anyway: two sign-ups can pass the check at the same time.',
      fix: 'Keep the unique constraint as the source of truth and translate it: inspect the constraint name and return a 409 ProblemDetail with a stable <code>type</code>.',
      fixCode: `@ExceptionHandler(DataIntegrityViolationException.class)
ProblemDetail conflict(DataIntegrityViolationException e, HttpServletRequest rq) {
  String c = (NestedExceptionUtils.getMostSpecificCause(e) instanceof PSQLException p
      && p.getServerErrorMessage() != null) ? p.getServerErrorMessage().getConstraint() : null;
  var pd = ProblemDetail.forStatus(HttpStatus.CONFLICT);
  if ("users_email_key".equals(c)) {
    pd.setType(URI.create("https://api.example.com/problems/email-taken"));
    pd.setTitle("Email already registered");
  } else {
    pd.setTitle("Conflicting data");
  }
  log.warn("integrity violation constraint={}", c, e);   // details stay server-side
  return pd;
}` },
    { title: 'PATCH /users stopped validating after the groups refactor',
      symptom: 'After introducing <code>OnCreate</code>/<code>OnUpdate</code> groups, updates with an empty <code>name</code> started succeeding, and blank names appeared in the database.',
      diagnose: `record UserDto(@Null(groups = OnCreate.class) @NotNull(groups = OnUpdate.class) Long id,\n               @NotBlank String name) {}          // Default group\n\n@PutMapping("/users") void update(@Validated(OnUpdate.class) @RequestBody UserDto u)`,
      cause: '<code>@NotBlank name</code> belongs to <code>Default</code>. The update only validated <code>OnUpdate</code>, so the name was never checked.',
      fix: 'Make the groups extend <code>Default</code>, and add a <code>CHECK (length(trim(name)) &gt; 0)</code> constraint in Postgres so the database enforces it too.',
      fixCode: `public interface OnCreate extends Default {}\npublic interface OnUpdate extends Default {}\n\n-- Flyway\nALTER TABLE users ADD CONSTRAINT users_name_not_blank CHECK (length(trim(name)) > 0);` },
    { title: 'Four error formats in one API',
      symptom: 'Clients see Boot’s <code>{"timestamp","status","error","path"}</code> for some errors, custom <code>{"code","message"}</code> for others, and an empty body for 405s.',
      diagnose: `curl -s -X DELETE localhost:8080/orders | jq          # Boot /error body\ncurl -s localhost:8080/orders/999 | jq                # custom ErrorDto\ncurl -s -X POST localhost:8080/orders -d '{}' \\\n     -H 'Content-Type: application/json' | jq        # different again`,
      diagnoseLang: 'bash',
      cause: 'Custom exceptions went through a hand-written advice; standard MVC exceptions went through <code>DefaultHandlerExceptionResolver</code> → <code>sendError</code> → <code>/error</code>.',
      fix: 'Make the advice extend <code>ResponseEntityExceptionHandler</code> (it renders every standard MVC exception as ProblemDetail), return <code>ProblemDetail</code> from your own handlers too, and add a contract test per status code.',
      fixCode: `@RestControllerAdvice\nclass ApiErrors extends ResponseEntityExceptionHandler {   // standard MVC exceptions → ProblemDetail\n  @ExceptionHandler OrderNotFoundException …\n  @ExceptionHandler ConstraintViolationException …\n  @ExceptionHandler DataIntegrityViolationException …\n}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'The request has <code>id = null</code> and <code>name = ""</code>. How many violations?', code: `public interface OnCreate {}               // does NOT extend Default\n\nrecord UserDto(@Null(groups = OnCreate.class) Long id,\n               @NotBlank String name) {}\n\n@PostMapping("/users")\nvoid create(@Validated(OnCreate.class) @RequestBody UserDto u) { … }`, options: ['0: the request passes', '1: name must not be blank', '2: id and name', 'Startup error: groups need @Valid'], answer: 0, explain: 'Only constraints in <code>OnCreate</code> are checked. <code>id</code> is null, which satisfies <code>@Null</code>. <code>@NotBlank</code> is in <code>Default</code>, which isn’t validated. Make <code>OnCreate extends Default</code> to include it.' },
    { kind: 'predict', q: 'The service throws <code>OrderNotFoundException</code>. Which status does the client get?', code: `@RestControllerAdvice @Order(1)\nclass Global {\n  @ExceptionHandler(RuntimeException.class)\n  ProblemDetail any(RuntimeException e) { return ProblemDetail.forStatus(500); }\n}\n@RestControllerAdvice            // default order: lowest precedence\nclass Orders {\n  @ExceptionHandler(OrderNotFoundException.class)\n  ProblemDetail nf(OrderNotFoundException e) { return ProblemDetail.forStatus(404); }\n}`, options: ['404: the most specific handler wins', '500: the higher-priority advice matches first', 'Startup failure: ambiguous handlers', 'It depends on bean registration order'], answer: 1, explain: 'Spring checks advice beans in order and uses the first one with <i>any</i> matching handler. Closest-type matching happens only inside a single advice. <code>Global</code> has <code>@Order(1)</code> and matches <code>RuntimeException</code>, so 500.' },
    { kind: 'predict', q: 'Boot 3.3, starter-validation present, no custom advice. What does <code>POST /orders</code> with an invalid body return?', code: `@Service @Validated\nclass OrderService { void place(@Valid CreateOrder c) { … } }\n\n@PostMapping("/orders")\nvoid create(@RequestBody CreateOrder c) { service.place(c); }   // no @Valid here`, options: ['400 Bad Request', '422 Unprocessable Entity', '500 Internal Server Error', '200: validation is skipped'], answer: 2, explain: 'The controller doesn’t validate, so the service proxy does and throws <code>ConstraintViolationException</code>. No default resolver maps that, so it reaches <code>/error</code> as a 500.' },
    { kind: 'predict', q: 'What happens at startup?', code: `@RestControllerAdvice\nclass ApiErrors extends ResponseEntityExceptionHandler {\n  @ExceptionHandler(MethodArgumentNotValidException.class)\n  ProblemDetail invalid(MethodArgumentNotValidException e) { … }\n}`, options: ['Starts; your handler wins', 'Starts; the base class handler wins', 'Fails: ambiguous @ExceptionHandler for MethodArgumentNotValidException', 'Starts, but logs a warning'], answer: 2, explain: '<code>ResponseEntityExceptionHandler</code> already has an <code>@ExceptionHandler</code> covering <code>MethodArgumentNotValidException</code>. Two mappings for the same type in one advice fail fast with <code>IllegalStateException</code>. Override <code>handleMethodArgumentNotValid</code> instead.' },
    { kind: 'predict', q: 'Boot 3.2 (Framework 6.1). The controller class has no <code>@Validated</code>. What does <code>GET /orders?page=0</code> return?', code: `@GetMapping("/orders")\nList<OrderDto> list(@RequestParam @Min(1) int page) { … }`, options: ['200: constraints on parameters need @Validated on the class', '400 via HandlerMethodValidationException', '500 via ConstraintViolationException', '404'], answer: 1, explain: 'Since 6.1, Spring MVC applies method validation itself when constraints are declared directly on handler parameters. The result is <code>HandlerMethodValidationException</code>, a 400. Before 6.1 this needed a class-level <code>@Validated</code> (AOP), which produced a <code>ConstraintViolationException</code> instead.' },
    { kind: 'predict', q: 'A handler for <code>GET /orders/42</code> returns this. What JSON does the client receive?', code: `var pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Order 42 not found");\npd.setTitle("Order not found");\npd.setProperty("orderId", 42);\nreturn pd;`, options: ['{"type":"about:blank","title":"Order not found","status":404,"detail":"Order 42 not found","instance":"/orders/42","orderId":42}', '{"status":404,"properties":{"orderId":42},…}', '{"error":"Not Found","message":"Order 42 not found"}', 'An empty 404 body'], answer: 0, explain: 'Custom properties are written at the top level (a Jackson mixin uses <code>@JsonAnyGetter</code>), as RFC 9457 extension members. <code>type</code> defaults to <code>about:blank</code>, and Spring fills <code>instance</code> with the request path when it’s unset. The content type is <code>application/problem+json</code>.' }
  ],
  interview: [
    { q: 'How does Spring MVC decide which @ExceptionHandler handles an exception?', a: '<p><code>ExceptionHandlerExceptionResolver</code> looks first in the controller that threw, then in <code>@ControllerAdvice</code> beans in <code>@Order</code> order. Within one class, the closest match in the exception hierarchy wins (root exception before cause). Across advice beans, the first advice with any match wins. If nothing matches, <code>ResponseStatusExceptionResolver</code> and <code>DefaultHandlerExceptionResolver</code> get a turn, and anything left goes to the container’s <code>/error</code>.</p>', lvl: 'deep' },
    { q: 'What is ProblemDetail and how do you enable it in Boot?', a: '<p>An RFC 9457 body: <code>type</code> (a URI, default <code>about:blank</code>), <code>title</code>, <code>status</code>, <code>detail</code>, <code>instance</code>, plus extension members. Since Framework 6.0 you can return <code>ProblemDetail</code> or <code>ErrorResponse</code> from handlers, and <code>ResponseStatusException</code>/<code>ErrorResponseException</code> carry one. In Boot, <code>spring.mvc.problemdetails.enabled=true</code> registers a <code>ResponseEntityExceptionHandler</code> advice so standard MVC exceptions render as problem JSON; extend that class yourself for full control.</p>', fu: 'How do you localise titles? (MessageSource codes problemDetail.title.&lt;exception class&gt; and problemDetail.&lt;exception class&gt;.)', lvl: 'core' },
    { q: '@Valid vs @Validated?', a: '<p><code>@Valid</code> (Jakarta) marks a parameter or field for validation and cascades into nested objects. <code>@Validated</code> (Spring) also accepts <b>groups</b>, and on a class it enables method validation through an AOP proxy. Use <code>@Valid</code> on nested fields and most parameters, <code>@Validated(Group.class)</code> when you need groups.</p>', lvl: 'core' },
    { q: 'Explain validation groups and @GroupSequence.', a: '<p>Groups are marker interfaces that partition constraints: <code>@Null(groups = OnCreate.class) Long id</code>. Constraints without groups are in <code>Default</code>. Validating a group checks only that group, so make groups extend <code>Default</code> if the common rules should apply. <code>@GroupSequence</code> runs groups in order and stops at the first failing group: cheap checks first, expensive or cross-field checks later.</p>', lvl: 'deep' },
    { q: 'Should you validate in controllers or in services?', a: '<p>Both, for different reasons. The controller validates the <b>shape</b> of client input and gives the client a precise 400. The service validates its own <b>contract</b>, because it is also called from Kafka listeners, schedulers and other services. Use <code>@Validated</code> on the service class plus <code>@Valid</code> on parameters, and remember that self-invocation skips the proxy. The database enforces <b>invariants</b> with constraints, which is the only defence against races.</p>', lvl: 'core' },
    { q: 'Why not rely on “SELECT then INSERT” to enforce unique emails?', a: '<p>Two transactions can both run the SELECT, both see nothing, and both INSERT. Under READ COMMITTED neither sees the other’s uncommitted row. Only a unique index makes it impossible: the second INSERT waits for the first transaction and then fails with SQLSTATE <code>23505</code>. Catch that and return 409, or use <code>INSERT … ON CONFLICT DO NOTHING</code> and check the row count.</p>', lvl: 'deep' },
    { q: 'What status code for a business rule failure, like “out of stock”?', a: '<p>There is no single right answer, but be consistent and document it. Common choices: <b>409 Conflict</b> when the request conflicts with the current state of the resource, <b>422</b> when the payload is well-formed but semantically invalid, and <b>400</b> for malformed input. Put a stable machine-readable <code>type</code> URI in the ProblemDetail so clients don’t parse <code>detail</code> strings.</p>', lvl: 'core' },
    { q: 'How do you return all field errors in one response?', a: '<p>Override <code>handleMethodArgumentNotValid</code> in your <code>ResponseEntityExceptionHandler</code> subclass, take <code>ex.getBody()</code> (already a 400 ProblemDetail), and add an <code>errors</code> property built from <code>ex.getBindingResult().getFieldErrors()</code>: field, rejected code, message. Don’t echo rejected values if they may be sensitive.</p>', lvl: 'core' },
    { q: 'What does Boot’s /error endpoint do, and what does it hide by default?', a: '<p><code>BasicErrorController</code> handles container error dispatches (unresolved exceptions and <code>sendError</code>). It returns JSON or a Whitelabel page depending on <code>Accept</code>. By default <code>server.error.include-message</code>, <code>include-binding-errors</code> and <code>include-stacktrace</code> are <code>never</code>, so the body has only timestamp, status, error and path.</p>', lvl: 'core' },
    { q: 'How do you write a cross-field rule such as “end date after start date”?', a: '<p>A class-level constraint: a custom annotation with a <code>ConstraintValidator&lt;ValidRange, Booking&gt;</code>, reporting the violation on a property node with <code>context.buildConstraintViolationWithTemplate(…).addPropertyNode("end")</code>. Or, for records, a method annotated <code>@AssertTrue</code> such as <code>boolean isEndAfterStart()</code>. In Postgres, mirror it with a <code>CHECK (end_at &gt; start_at)</code>.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'One advice for everything', lang: 'java', code: `@RestControllerAdvice
class ApiErrors extends ResponseEntityExceptionHandler {   // standard MVC exceptions → ProblemDetail

  // 400 for @Valid @RequestBody: add the field errors to the default body
  @Override
  protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
      HttpHeaders headers, HttpStatusCode status, WebRequest request) {
    ProblemDetail pd = ex.getBody();
    pd.setType(URI.create("https://api.example.com/problems/invalid-request"));
    pd.setProperty("errors", ex.getBindingResult().getFieldErrors().stream()
        .map(f -> Map.of("field", f.getField(), "message", String.valueOf(f.getDefaultMessage())))
        .toList());
    return handleExceptionInternal(ex, pd, headers, status, request);
  }

  @ExceptionHandler(OrderNotFoundException.class)
  ProblemDetail notFound(OrderNotFoundException e) {
    var pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Order " + e.id() + " not found");
    pd.setType(URI.create("https://api.example.com/problems/order-not-found"));
    pd.setTitle("Order not found");
    pd.setProperty("orderId", e.id());
    return pd;
  }

  // service-layer validation (@Validated proxies)
  @ExceptionHandler(ConstraintViolationException.class)
  ProblemDetail violations(ConstraintViolationException e) {
    var pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
    pd.setProperty("errors", e.getConstraintViolations().stream()
        .map(v -> Map.of("field", v.getPropertyPath().toString(), "message", v.getMessage())).toList());
    return pd;
  }
}` },
    { title: 'Groups for create vs update', lang: 'java', code: `public interface OnCreate extends Default {}   // include the common rules
public interface OnUpdate extends Default {}

public record ProductDto(
    @Null(groups = OnCreate.class) @NotNull(groups = OnUpdate.class) Long id,
    @NotBlank @Size(max = 120) String name,
    @NotNull @DecimalMin("0.00") BigDecimal price,
    @Valid List<@NotBlank String> tags) {}                 // container element constraints

@PostMapping("/products")
ProductDto create(@Validated(OnCreate.class) @RequestBody ProductDto p) { … }

@PutMapping("/products/{id}")
ProductDto update(@PathVariable long id, @Validated(OnUpdate.class) @RequestBody ProductDto p) { … }` },
    { title: 'Validate the service contract', lang: 'java', code: `@Service
@Validated                                      // Boot auto-configures MethodValidationPostProcessor
public class TransferService {

  @Transactional
  public TransferId transfer(@Valid TransferCommand cmd,
                             @NotNull @Positive BigDecimal amount) {
    // called from REST, Kafka and a scheduler: all get the same checks
    …
  }
}
// Note: this.transfer(...) from inside the class skips the proxy, so skips validation.` },
    { title: 'Postgres as the last line', lang: 'sql', code: `-- invariants the database enforces even under concurrency
ALTER TABLE users    ADD CONSTRAINT users_email_key UNIQUE (email);           -- 23505
ALTER TABLE orders   ADD CONSTRAINT orders_qty_ck   CHECK (qty BETWEEN 1 AND 100); -- 23514
ALTER TABLE bookings ADD CONSTRAINT bookings_range_ck CHECK (end_at > start_at);
ALTER TABLE orders   ADD CONSTRAINT orders_user_fk FOREIGN KEY (user_id) REFERENCES users(id); -- 23503

-- idempotent insert instead of SELECT-then-INSERT
INSERT INTO users (email, name) VALUES ($1, $2)
ON CONFLICT (email) DO NOTHING
RETURNING id;      -- no row back = already registered → 409`, note: 'Constraint names are what your advice maps to business errors, so name them deliberately in migrations.' },
    { title: 'Boot settings', lang: 'yaml', code: `spring:
  mvc:
    problemdetails:
      enabled: true          # only if you DON'T extend ResponseEntityExceptionHandler yourself
server:
  error:
    include-message: never        # defaults: keep internals out of /error bodies
    include-binding-errors: never
    include-stacktrace: never` }
  ]
});
