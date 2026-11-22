IA.register({
  track: 'spring',
  slug: 'mvc-request-flow',
  title: 'Spring MVC request flow',
  tagline: 'Every request is <b>one Tomcat thread</b> walking through an onion: servlet filters on the outside, the <code>DispatcherServlet</code> inside, and a fixed sequence in the middle: <b>mapping → adapter → argument resolvers → your method → return-value handler → message converter</b>. Know the order and most “why didn’t my code run?” questions answer themselves.',
  tldr: {
    problem: 'Headers added in <code>postHandle</code> that never arrive, a <code>@ControllerAdvice</code> that ignores exceptions from a filter, a 406 that happens <i>after</i> the order was saved, and filters that run twice.',
    model: 'Filters wrap the whole servlet and see raw requests. Inside, <code>DispatcherServlet</code> asks each <code>HandlerMapping</code> for a handler, picks a <code>HandlerAdapter</code> that can call it, runs interceptors around it, and turns arguments and return values into and out of HTTP with <code>HttpMessageConverter</code>s.',
    hook: '“Filter or interceptor?” A filter sees every request before Spring MVC does; an interceptor knows <i>which controller method</i> was chosen. Errors thrown in filters never reach <code>@ExceptionHandler</code>.',
    facts: [
      { v: '200', l: 'default Tomcat worker threads in Boot (<code>server.tomcat.threads.max</code>). One request occupies one thread from filter to response' },
      { v: '6.0', l: 'Spring Framework 6 stopped matching trailing slashes by default: <code>/orders/</code> no longer maps to <code>@GetMapping("/orders")</code>' },
      { v: '3.2', l: 'Boot version that added <code>spring.threads.virtual.enabled</code>: Tomcat then runs each request on a virtual thread (Java 21+)' }
    ]
  },
  intro: {
    what: 'When a browser or another service calls your API, Tomcat (the web server inside your Boot app) receives the HTTP request and gives it to a thread. That thread passes the request through a chain of <b>filters</b>, then to Spring’s <b>DispatcherServlet</b>, a front controller that finds the right <code>@GetMapping</code>/<code>@PostMapping</code> method, converts the JSON body into a Java object, calls your method, and converts the result back to JSON.',
    analogy: { icon: '🏨', title: 'A hotel front desk', text: 'Security at the door (filters) checks everyone, even people who just want the lobby toilet. The front desk (DispatcherServlet) looks up which department handles your request (handler mapping), a concierge (adapter) knows how to talk to that department, a translator (message converter) turns your words into their forms and back, and the floor manager (interceptor) knows which department you visited.' },
    steps: [
      { t: 'Tomcat accepts the connection', d: 'A worker thread from a pool (200 by default) takes the request. Everything below happens on that one thread unless you go async.' },
      { t: 'Filters run, outermost first', d: 'Metrics and tracing, Spring Security, your own logging filter. Each calls <code>chain.doFilter()</code> to go deeper, and gets control back afterwards.' },
      { t: 'DispatcherServlet finds your method', d: 'It matches the path, the HTTP method and the headers against every <code>@RequestMapping</code>.', code: '@PostMapping(path = "/orders", consumes = "application/json")\nResponseEntity<OrderDto> create(@Valid @RequestBody CreateOrder cmd) { … }' },
      { t: 'Arguments in, return value out', d: 'Jackson reads the JSON body into <code>CreateOrder</code>, Bean Validation checks it, your method runs, and Jackson writes the result as JSON.' },
      { t: 'The response goes back out through the filters', d: 'In reverse order: your logging filter can log the status, the metrics filter stops its timer, and the thread goes back to the pool.' }
    ],
    terms: [
      ['Servlet', 'The Java standard API for handling HTTP requests. Tomcat implements it.'],
      ['Filter', 'A servlet-level wrapper that can inspect or change every request and response.'],
      ['DispatcherServlet', 'Spring MVC’s single servlet that routes requests to controller methods.'],
      ['Handler', 'Whatever will process the request; usually a controller method (<code>HandlerMethod</code>).'],
      ['HttpMessageConverter', 'Turns a request body into an object and an object into a response body (Jackson for JSON).'],
      ['Interceptor', 'A Spring MVC hook around the handler: <code>preHandle</code>, <code>postHandle</code>, <code>afterCompletion</code>.']
    ]
  },
  visual: {
    title: 'Follow one request through the onion',
    caption: 'Pick a request and press Play or Step. The dot is the Tomcat thread. Nested boxes show who wraps whom: filters wrap the DispatcherServlet, which wraps the adapter. Greyed stations were skipped. Watch where each failure is decided.'
  },
  gotchas: [
    { trap: 'Adding a header in postHandle for a @ResponseBody method',
      code: `public void postHandle(HttpServletRequest req, HttpServletResponse res,\n                       Object handler, ModelAndView mv) {\n  res.setHeader("X-Trace", traceId());   // too late: body already written\n}`,
      why: 'For <code>@ResponseBody</code> and <code>ResponseEntity</code>, the return-value handler writes and commits the response inside the <code>HandlerAdapter</code>, before <code>postHandle</code> runs. Headers set after commit are ignored.',
      fix: 'Set headers in <code>preHandle</code>, in a filter before <code>chain.doFilter</code>, or in a <code>ResponseBodyAdvice</code> (which runs just before the converter writes).' },
    { trap: '@ControllerAdvice doesn’t catch exceptions from filters',
      why: 'Exception resolvers live inside <code>DispatcherServlet</code>. A filter runs outside it, so its exception goes to Tomcat, which forwards to Boot’s <code>/error</code> (<code>BasicErrorController</code>) and returns a generic 500.',
      fix: 'Write the error response in the filter itself (status + ProblemDetail JSON), or delegate to a <code>HandlerExceptionResolver</code> bean from the filter. Spring Security handles its own exceptions with <code>ExceptionTranslationFilter</code>.' },
    { trap: 'A @Component filter added to the security chain runs twice',
      code: `@Component class TenantFilter extends GenericFilterBean { … }   // Boot registers it\n\nhttp.addFilterBefore(tenantFilter, AuthorizationFilter.class);   // and so does Security`,
      why: 'Boot registers every <code>Filter</code> bean with the servlet container. Adding the same instance to a <code>SecurityFilterChain</code> puts it in the chain a second time.',
      fix: 'Extend <code>OncePerRequestFilter</code> (it skips repeat invocations in the same request), or disable the container registration with a <code>FilterRegistrationBean</code> whose <code>setEnabled(false)</code>.' },
    { trap: '@EnableWebMvc in a Boot app',
      why: 'It imports <code>WebMvcConfigurationSupport</code>, and Boot’s <code>WebMvcAutoConfiguration</code> backs off when that bean exists. You lose Boot’s converter setup, <code>spring.mvc.*</code> properties, static resource defaults and more.',
      fix: 'Remove it. Customise with a <code>WebMvcConfigurer</code> bean, which adds to Boot’s setup instead of replacing it.' },
    { trap: 'Declaring your own ObjectMapper @Bean',
      why: 'Boot’s Jackson auto-configuration backs off, so <code>spring.jackson.*</code> properties stop applying, and the MVC converter uses your bare mapper (for example, dates as numbers).',
      fix: 'Customise Boot’s mapper with a <code>Jackson2ObjectMapperBuilderCustomizer</code> bean, or with <code>spring.jackson.*</code> properties.' },
    { trap: 'Reading the request body in a filter',
      why: 'The servlet input stream can be read once. A logging filter that reads it leaves nothing for Jackson, and the controller gets a 400 “Required request body is missing”.',
      fix: 'Wrap with <code>ContentCachingRequestWrapper</code> and read the cached bytes <i>after</i> <code>chain.doFilter</code>, when the converter has consumed them.' },
    { trap: 'Custom argument resolvers can’t override built-in ones',
      why: 'Resolvers registered with <code>addArgumentResolvers</code> are consulted after the built-in ones, so they can’t change how <code>@RequestBody</code>, <code>@PathVariable</code> or <code>@RequestParam</code> are resolved.',
      fix: 'Use your own annotation (<code>@CurrentTenant</code>) or type, and resolve that. To change body parsing, configure the message converter.' }
  ],
  scenarios: [
    { title: 'Mobile client gets 406, but the order was created anyway',
      symptom: 'An old app sends <code>Accept: application/xml</code>. It shows an error, the user retries, and support sees three duplicate orders.',
      diagnose: `curl -i -X POST localhost:8080/orders -H 'Content-Type: application/json' \\\n     -H 'Accept: application/xml' -d '{"sku":"A-1","qty":1}'\n# HTTP/1.1 406\n# and in the log: INSERT INTO orders … COMMIT`,
      diagnoseLang: 'bash',
      cause: 'The mapping had no <code>produces</code>, so it matched. The controller ran and the service transaction committed. Only when the return-value handler tried to write the body did it find no converter for XML and throw <code>HttpMediaTypeNotAcceptableException</code>.',
      fix: 'Declare <code>produces</code>, so the mapping itself rejects the request before any code runs. Make create endpoints idempotent (an <code>Idempotency-Key</code> header with a unique constraint).',
      fixCode: `@PostMapping(path = "/orders",\n             consumes = MediaType.APPLICATION_JSON_VALUE,\n             produces = MediaType.APPLICATION_JSON_VALUE)   // 406 at mapping time` },
    { title: 'Bad API keys return an HTML-ish 500 instead of our 401 ProblemDetail',
      symptom: 'Clients with an expired key get <code>{"status":500,"error":"Internal Server Error","path":"/orders"}</code>, and the 401 advice never fires.',
      diagnose: `class ApiKeyFilter extends OncePerRequestFilter {\n  protected void doFilterInternal(…) {\n    if (!valid(req)) throw new InvalidApiKeyException();   // outside DispatcherServlet\n    chain.doFilter(req, res);\n  }\n}`,
      cause: 'The exception is thrown in a filter, before <code>DispatcherServlet</code>. <code>@RestControllerAdvice</code> never sees it. Tomcat forwards to <code>/error</code>, and Boot renders its default error body with 500.',
      fix: 'Write the 401 response directly in the filter (or move key checking into a Spring Security authentication filter, whose entry point writes the response).',
      fixCode: `if (!valid(req)) {\n  res.setStatus(401);\n  res.setContentType("application/problem+json");\n  mapper.writeValue(res.getOutputStream(),\n      ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Invalid API key"));\n  return;                                   // don't call chain.doFilter\n}` },
    { title: 'After the Boot 3 upgrade, half the partner calls return 404',
      symptom: 'A partner integration calls <code>GET /api/orders/</code> (trailing slash). It worked on Boot 2.7 and returns 404 on Boot 3.x.',
      diagnose: `# logging.level.org.springframework.web: DEBUG\n# GET "/api/orders/", parameters={}\n# Mapped to ResourceHttpRequestHandler [classpath [static/], …]\n# Resolved [NoResourceFoundException: No static resource api/orders.]`,
      diagnoseLang: 'yaml',
      cause: 'Spring Framework 6.0 disabled trailing-slash matching by default. The request matched no controller and fell through to the static-resource handler, which throws <code>NoResourceFoundException</code> (6.1+), returned as 404.',
      fix: 'Fix clients, or map both paths explicitly during a migration window. Framework 6.2 adds <code>UrlHandlerFilter</code> to redirect or rewrite trailing slashes in one place.',
      fixCode: `@GetMapping({"/api/orders", "/api/orders/"})   // temporary, explicit\nList<OrderDto> list() { … }` }
  ],
  puzzles: [
    { kind: 'predict', q: 'A request goes through a <code>OncePerRequestFilter</code> and a <code>HandlerInterceptor</code> to a <code>@RestController</code>. In what order do the hooks run?', options: ['filter → preHandle → controller → postHandle → afterCompletion → filter (after chain)', 'preHandle → filter → controller → filter → postHandle', 'filter → controller → preHandle → postHandle → filter', 'preHandle → controller → filter → afterCompletion'], answer: 0, explain: 'Filters wrap the whole <code>DispatcherServlet</code>, so a filter starts first and finishes last (the code after <code>chain.doFilter</code>). Interceptors run inside the dispatcher, around the handler.' },
    { kind: 'predict', q: 'A client sends <code>Accept: */*</code>. What <code>Content-Type</code> comes back?', code: `@RestController\nclass Ping {\n  @GetMapping("/ping") String ping() { return "pong"; }\n}`, options: ['application/json, body "pong" with quotes', 'text/plain;charset=UTF-8, body pong', 'text/html', '406 Not Acceptable'], answer: 1, explain: 'For a <code>String</code> return value, <code>StringHttpMessageConverter</code> is consulted before Jackson and picks <code>text/plain</code>. You get raw text, not a JSON string. Return a record or a <code>Map</code> if clients expect JSON.' },
    { kind: 'predict', q: 'No XML converter is on the classpath. What does the client get, and is the order in Postgres?', code: `@PostMapping("/orders")   // no 'produces'\nOrderDto create(@RequestBody CreateOrder c) {\n  return service.create(c);   // @Transactional, commits\n}\n// request: Content-Type: application/json, Accept: application/xml`, options: ['406, and no order (rolled back)', '406, and the order is committed', '415, and no order', '200 with a JSON body'], answer: 1, explain: 'Without <code>produces</code>, mapping succeeds and the method runs. The 406 is decided while writing the return value, after the service transaction has committed. Declaring <code>produces</code> moves the 406 to mapping time.' },
    { kind: 'predict', q: 'Boot 3.3 app. What does <code>GET /orders/</code> return?', code: `@GetMapping("/orders")\nList<OrderDto> list() { … }`, options: ['200, same as /orders', '301 redirect to /orders', '404', '405'], answer: 2, explain: 'Spring Framework 6.0 turned trailing-slash matching off. Nothing matches, the static-resource handler can’t find a file, and Framework 6.1+ answers with <code>NoResourceFoundException</code>, mapped to 404.' },
    { kind: 'predict', q: 'Who produces the response when this filter throws?', code: `@Component\nclass AuditFilter extends OncePerRequestFilter {\n  protected void doFilterInternal(HttpServletRequest rq, HttpServletResponse rs, FilterChain ch) {\n    throw new IllegalStateException("audit down");\n  }\n}\n@RestControllerAdvice class Errors {\n  @ExceptionHandler(IllegalStateException.class)\n  ProblemDetail ise() { return ProblemDetail.forStatus(503); }\n}`, options: ['The advice: 503 ProblemDetail', 'Boot’s /error (BasicErrorController): 500', 'Tomcat closes the connection with no response', 'Spring Security: 401'], answer: 1, explain: 'The advice is used by <code>ExceptionHandlerExceptionResolver</code>, which runs inside <code>DispatcherServlet</code>. The filter is outside, so the exception reaches Tomcat, which does an ERROR dispatch to <code>/error</code>: a 500.' },
    { kind: 'concept', q: 'Why does <code>DispatcherServlet</code> use a <code>HandlerAdapter</code> instead of calling the handler directly?', options: ['For thread safety', 'Handlers come in different shapes (HandlerMethod, HttpRequestHandler, HandlerFunction…), and the adapter knows how to invoke each one', 'Adapters cache responses', 'Adapters are only needed for WebFlux'], answer: 1, explain: 'The mapping returns an <code>Object</code>. The dispatcher asks each adapter <code>supports(handler)</code>. <code>RequestMappingHandlerAdapter</code> handles annotated methods (resolving arguments, invoking, handling return values); others handle functional endpoints or plain <code>HttpRequestHandler</code>s.' },
    { kind: 'predict', q: 'A request body fails <code>@Valid</code>. Which interceptor callbacks run?', code: `@PostMapping("/orders")\nOrderDto create(@Valid @RequestBody CreateOrder c) { … }`, options: ['preHandle, postHandle and afterCompletion', 'preHandle and afterCompletion', 'Only afterCompletion', 'None: validation happens in a filter'], answer: 1, explain: 'Validation runs during argument resolution, after <code>preHandle</code>. It throws <code>MethodArgumentNotValidException</code>, so the method and <code>postHandle</code> are skipped. The exception resolvers produce the 400, and <code>afterCompletion</code> always runs once <code>preHandle</code> returned true.' }
  ],
  interview: [
    { q: 'Walk me through what happens between Tomcat receiving a request and your controller method running.', a: '<ol><li>A Tomcat worker thread parses the request and calls the filter chain (observation, Security’s <code>FilterChainProxy</code>, your filters).</li><li>The last link is <code>DispatcherServlet.doDispatch</code>.</li><li><code>getHandler</code>: each <code>HandlerMapping</code> in order; <code>RequestMappingHandlerMapping</code> matches path, method, <code>consumes</code>/<code>produces</code>, headers and params, and returns a <code>HandlerExecutionChain</code> (handler + interceptors).</li><li><code>getHandlerAdapter</code>: the first adapter that supports the handler.</li><li>Interceptors’ <code>preHandle</code>.</li><li>The adapter resolves each argument with <code>HandlerMethodArgumentResolver</code>s (message converters for <code>@RequestBody</code>, then validation), invokes the method, and passes the return value to a <code>HandlerMethodReturnValueHandler</code>, which writes the body with a converter chosen by content negotiation.</li><li><code>postHandle</code>, then exception resolvers or view rendering, then <code>afterCompletion</code>, then the filters unwind.</li></ol>', lvl: 'deep' },
    { q: 'Filter, HandlerInterceptor, AOP aspect, ResponseBodyAdvice: when do you use which?', a: '<ul><li><b>Filter</b>: everything at the HTTP level, for every request (including static and error dispatches): correlation IDs, request logging, security, compression. No knowledge of the handler.</li><li><b>Interceptor</b>: needs the chosen handler (its annotations, e.g. <code>@RequiresTenant</code>), or should only run for MVC requests.</li><li><b>Aspect</b>: business methods, regardless of how they were called (HTTP, Kafka, scheduler).</li><li><b>ResponseBodyAdvice</b>: change the body or headers just before the converter writes.</li></ul>', lvl: 'core' },
    { q: 'How does Spring choose which HttpMessageConverter writes a response?', a: '<p>It computes the acceptable media types from the <code>Accept</code> header, and the producible types from the mapping’s <code>produces</code> or from the converters that can write the return type. It picks the most specific compatible type, then the first converter (in registration order) that can write that class as that type. No overlap → <code>406</code>. Reading works the same way with <code>Content-Type</code>, and no converter means <code>415</code>.</p>', fu: 'Why does returning String give text/plain? (StringHttpMessageConverter comes before Jackson.)', lvl: 'deep' },
    { q: 'How would you inject the current tenant into controller methods?', a: '<p>Write a <code>HandlerMethodArgumentResolver</code> that supports parameters annotated <code>@CurrentTenant</code> and reads the tenant from the security context or a header, then register it with <code>WebMvcConfigurer.addArgumentResolvers</code>. Custom resolvers are consulted after the built-in ones, so use your own annotation or type.</p>', lvl: 'core' },
    { q: 'What happens if you add @EnableWebMvc to a Boot app?', a: '<p>Boot’s MVC auto-configuration backs off entirely, because it is conditional on the absence of <code>WebMvcConfigurationSupport</code>. You keep plain Spring MVC defaults and lose Boot’s customisations, properties and static resource setup. Use a <code>WebMvcConfigurer</code> instead.</p>', lvl: 'core' },
    { q: 'Where would you add a correlation ID so it shows up in every log line?', a: '<p>A filter, as early as possible: read or generate the ID, put it in the MDC and the response header before <code>chain.doFilter</code>, and clear the MDC in <code>finally</code>. With Micrometer Tracing (Boot 3), the trace and span IDs are already in the MDC, and the observation filter starts the span.</p>', fu: 'What breaks with @Async or CompletableFuture? (MDC is thread-local; use context propagation.)', lvl: 'core' },
    { q: 'An exception is thrown in a controller. Who turns it into a response?', a: '<p><code>DispatcherServlet.processHandlerException</code> asks each <code>HandlerExceptionResolver</code> in order: <code>ExceptionHandlerExceptionResolver</code> (<code>@ExceptionHandler</code> in the controller, then <code>@ControllerAdvice</code>), <code>ResponseStatusExceptionResolver</code> (<code>@ResponseStatus</code>, <code>ResponseStatusException</code>), then <code>DefaultHandlerExceptionResolver</code> (standard MVC exceptions to 4xx). If none resolves it, the exception propagates to the container, which forwards to <code>/error</code>. See <a href="errors-validation.html">Errors &amp; validation</a>.</p>', lvl: 'deep' },
    { q: 'What is the threading model of Spring MVC, and what changes with virtual threads?', a: '<p>Thread-per-request: one Tomcat worker (pool of 200 by default) handles the request end to end, so blocking JDBC calls simply park that thread. With <code>spring.threads.virtual.enabled=true</code> (Boot 3.2+, Java 21+) Tomcat runs each request on a new virtual thread, so blocking I/O no longer exhausts a small platform pool. The limits move elsewhere: the Hikari pool, downstream rate limits, and pinning (on JDKs before 24, blocking inside <code>synchronized</code> pins the carrier).</p>', lvl: 'deep' },
    { q: 'What does <code>produces</code> on a mapping actually buy you?', a: '<p>It turns content negotiation into a mapping condition. An <code>Accept</code> header that can’t be satisfied gets a 406 before any handler code runs, and two methods can share a path with different representations. Without it, the mismatch is only discovered when the return value is written.</p>', lvl: 'core' },
    { q: 'How do async return types (Callable, DeferredResult) change the flow?', a: '<p>The handler returns quickly, the servlet request is put into async mode, and the Tomcat thread is released. When the result is ready, the container does an ASYNC dispatch back through the <code>DispatcherServlet</code> to write the response. Interceptors implementing <code>AsyncHandlerInterceptor</code> get <code>afterConcurrentHandlingStarted</code> instead of <code>postHandle</code>/<code>afterCompletion</code> on the first pass. Filters must be async-aware.</p>', lvl: 'deep' },
    { q: 'How do you debug “my request mapped to the wrong place” or a 404 you don’t understand?', a: '<p>Set <code>logging.level.org.springframework.web=DEBUG</code>. The dispatcher logs <code>Mapped to …</code> with the chosen handler, and the resolved exception. The Actuator <code>mappings</code> endpoint lists every mapping with its conditions.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Filter + interceptor + advice', lang: 'java', code: `// 1. Filter: every request, before Spring MVC. Correlation ID in MDC + header.
@Component @Order(Ordered.HIGHEST_PRECEDENCE)
class CorrelationFilter extends OncePerRequestFilter {
  protected void doFilterInternal(HttpServletRequest rq, HttpServletResponse rs, FilterChain ch)
      throws ServletException, IOException {
    String id = Optional.ofNullable(rq.getHeader("X-Correlation-Id")).orElse(UUID.randomUUID().toString());
    MDC.put("cid", id);
    rs.setHeader("X-Correlation-Id", id);        // before the body is written
    try { ch.doFilter(rq, rs); } finally { MDC.remove("cid"); }
  }
}

// 2. Interceptor: knows the chosen handler method
class TenantInterceptor implements HandlerInterceptor {
  public boolean preHandle(HttpServletRequest rq, HttpServletResponse rs, Object h) {
    if (h instanceof HandlerMethod hm && hm.hasMethodAnnotation(RequiresTenant.class)
        && rq.getHeader("X-Tenant") == null) {
      rs.setStatus(400); return false;            // stop here: no handler, no postHandle
    }
    return true;
  }
}

// 3. ResponseBodyAdvice: last chance to touch body/headers before the converter writes
@RestControllerAdvice
class VersionHeaderAdvice implements ResponseBodyAdvice<Object> {
  public boolean supports(MethodParameter p, Class<? extends HttpMessageConverter<?>> c) { return true; }
  public Object beforeBodyWrite(Object body, MethodParameter p, MediaType t,
      Class<? extends HttpMessageConverter<?>> c, ServerHttpRequest rq, ServerHttpResponse rs) {
    rs.getHeaders().add("X-Api-Version", "3");
    return body;
  }
}` },
    { title: 'Custom argument resolver', lang: 'java', code: `@Target(ElementType.PARAMETER) @Retention(RetentionPolicy.RUNTIME)
public @interface CurrentTenant {}

class TenantArgumentResolver implements HandlerMethodArgumentResolver {
  public boolean supportsParameter(MethodParameter p) {
    return p.hasParameterAnnotation(CurrentTenant.class) && p.getParameterType() == TenantId.class;
  }
  public Object resolveArgument(MethodParameter p, ModelAndViewContainer mav,
                                NativeWebRequest req, WebDataBinderFactory bf) {
    return TenantId.of(req.getHeader("X-Tenant"));
  }
}

@Configuration
class WebConfig implements WebMvcConfigurer {          // adds to Boot's setup; no @EnableWebMvc
  public void addArgumentResolvers(List<HandlerMethodArgumentResolver> rs) { rs.add(new TenantArgumentResolver()); }
  public void addInterceptors(InterceptorRegistry r) { r.addInterceptor(new TenantInterceptor()).addPathPatterns("/api/**"); }
}

@GetMapping("/api/orders")
List<OrderDto> list(@CurrentTenant TenantId tenant) { … }` },
    { title: 'Threads & debugging', lang: 'yaml', code: `server:
  tomcat:
    threads:
      max: 200            # default; one request = one worker thread
      min-spare: 10
    accept-count: 100     # OS backlog once max-connections is reached
    max-connections: 8192
spring:
  threads:
    virtual:
      enabled: true       # Boot 3.2+, Java 21+: a virtual thread per request
logging:
  level:
    org.springframework.web: DEBUG   # "Mapped to …", resolved exceptions
management:
  endpoints:
    web:
      exposure:
        include: health,mappings     # /actuator/mappings lists every route` },
    { title: 'Seeing negotiation with curl', lang: 'bash', code: `# 415: no converter can read this Content-Type
curl -i -X POST localhost:8080/orders -H 'Content-Type: text/csv' -d 'A-1,1'

# 406: nothing can produce what Accept asks for
curl -i localhost:8080/orders/1 -H 'Accept: application/xml'

# 405: path matches, method doesn't (Allow header lists the methods)
curl -i -X DELETE localhost:8080/orders

# 400: body doesn't parse (HttpMessageNotReadableException)
curl -i -X POST localhost:8080/orders -H 'Content-Type: application/json' -d '{"qty":'` }
  ]
});
