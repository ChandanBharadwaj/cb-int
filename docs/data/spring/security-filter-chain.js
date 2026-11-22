IA.register({
  track: 'spring',
  slug: 'security-filter-chain',
  title: 'Security filter chain',
  tagline: 'Spring Security is a chain of plain servlet <b>filters</b> that runs before your <code>DispatcherServlet</code>. Each filter has one job: load the security context, check CSRF, authenticate a token, turn exceptions into 401 or 403, apply URL rules. If you know which filter rejected a request, you know why it was rejected.',
  tldr: {
    problem: 'A request comes back 401, 403 or a 302 to <code>/login</code>, and nothing reaches your controller or your logs. Or the opposite: an endpoint you thought was protected is open, because a different chain handled it.',
    model: '<code>DelegatingFilterProxy</code> hands every request to <code>FilterChainProxy</code>, which picks the <b>first</b> <code>SecurityFilterChain</code> whose matcher fits and runs only that chain. Inside it, authentication filters put an <code>Authentication</code> into the <code>SecurityContextHolder</code>; <code>AuthorizationFilter</code> checks it against your rules; <code>ExceptionTranslationFilter</code> turns failures into 401 (entry point) or 403 (access denied handler).',
    hook: '“Why does my SPA get 403 on POST but GET works?” CSRF. <code>CsrfFilter</code> runs before authentication and rejects state-changing requests without a valid token. The 403 comes from it, not from your role rules.',
    facts: [
      { v: 'Security 6.0', l: '<code>WebSecurityConfigurerAdapter</code> is gone (deprecated in 5.7). You declare <code>SecurityFilterChain</code> beans and use the lambda DSL' },
      { v: 'first match wins', l: '<code>FilterChainProxy</code> runs exactly one chain per request: the first, by <code>@Order</code>, whose <code>securityMatcher</code> matches' },
      { v: '401 vs 403', l: 'not authenticated → <code>AuthenticationEntryPoint</code> (401 or redirect to login); authenticated but not allowed → <code>AccessDeniedHandler</code> (403)' }
    ]
  },
  intro: {
    what: 'Before any controller code runs, every HTTP request passes through a line of <b>filters</b>. Spring Security adds one filter to the servlet container, and that filter runs its own list of security filters. Some read who you are (a session cookie, a password, a token). Some protect against browser attacks (CSRF, CORS). The last ones decide if you are allowed in and, if not, write a 401 or 403.',
    analogy: { icon: '🛫', title: 'Airport security lanes', text: 'There are separate lanes (crew, passengers), and you take the first lane whose sign matches you. In the lane, each station does one check in a fixed order: ID, boarding pass, bag scan, gate. A failed check stops you at that station, and which station stopped you tells you what was wrong.' },
    steps: [
      { t: 'One servlet filter enters Spring', d: 'Boot registers <code>DelegatingFilterProxy</code> (named <code>springSecurityFilterChain</code>). It forwards to the <code>FilterChainProxy</code> bean.' },
      { t: 'Pick a chain', d: 'Each <code>SecurityFilterChain</code> bean has a matcher, for example <code>/api/**</code>. The first match (by <code>@Order</code>) handles the request; the others never see it.', code: 'http.securityMatcher("/api/**")' },
      { t: 'Authenticate', d: 'A filter for your login style (form login, HTTP Basic, bearer token) builds an <code>Authentication</code> and stores it in the <code>SecurityContextHolder</code>. No credentials? <code>AnonymousAuthenticationFilter</code> sets an anonymous one.' },
      { t: 'Authorize', d: '<code>AuthorizationFilter</code> checks your <code>authorizeHttpRequests</code> rules. <code>@PreAuthorize</code> on methods checks again later, through a proxy.' },
      { t: 'Translate failures', d: '<code>ExceptionTranslationFilter</code> catches the exception: not logged in → 401 or redirect; logged in but not allowed → 403.' }
    ],
    terms: [
      ['SecurityFilterChain', 'A bean holding a request matcher and an ordered list of filters, built with <code>HttpSecurity</code>.'],
      ['Authentication', 'Who the caller is (principal) and what they may do (authorities), plus whether it is authenticated.'],
      ['SecurityContextHolder', 'A ThreadLocal holder for the current <code>SecurityContext</code> (and its <code>Authentication</code>).'],
      ['AuthenticationManager', 'Usually <code>ProviderManager</code>: asks each <code>AuthenticationProvider</code> to verify credentials.'],
      ['GrantedAuthority', 'A string permission like <code>ROLE_ADMIN</code> or <code>SCOPE_orders.read</code>.'],
      ['CSRF token', 'A secret value the server issues and expects back on POST/PUT/DELETE, so another site can’t forge requests with your cookies.']
    ]
  },
  visual: {
    title: 'Send a request through the filter chain',
    caption: 'Pick a request and press Play (or Step). The dot moves through the filters of the chosen chain; the panel on the right shows the request, the <code>SecurityContextHolder</code> and the response. Watch <i>which</i> filter answers: CSRF and CORS stop requests long before your role rules do.'
  },
  gotchas: [
    { trap: 'Copying pre-6.0 configuration', code: `// Security 5.x style: does not compile on Security 6
class Config extends WebSecurityConfigurerAdapter {
  protected void configure(HttpSecurity http) throws Exception {
    http.authorizeRequests().antMatchers("/admin/**").hasRole("ADMIN").and().formLogin();
  }
}`, why: 'Security 6.0 removed <code>WebSecurityConfigurerAdapter</code> and <code>antMatchers</code>. <code>authorizeRequests</code> is deprecated in favour of <code>authorizeHttpRequests</code>, and the <code>.and()</code> chaining style is deprecated since 6.1.', fix: 'Declare a <code>@Bean SecurityFilterChain</code> and use the lambda DSL: <code>http.authorizeHttpRequests(a -> a.requestMatchers("/admin/**").hasRole("ADMIN"))</code>. Expose <code>UserDetailsService</code> and <code>PasswordEncoder</code> as beans instead of overriding <code>configure(AuthenticationManagerBuilder)</code>.' },
    { trap: 'Rules are checked top to bottom, first match wins', code: `.authorizeHttpRequests(a -> a
    .requestMatchers("/api/**").authenticated()
    .requestMatchers("/api/public/**").permitAll()   // never reached
    .anyRequest().denyAll())`, why: '<code>/api/public/health</code> matches <code>/api/**</code> first, so it needs authentication. The same applies to chains: a chain without <code>securityMatcher</code> matches everything, so any chain ordered after it is dead (Security 6.4+ refuses to start in that case).', fix: 'Order rules from most specific to least specific and finish with <code>anyRequest()</code>. Give every chain except the last a <code>securityMatcher</code> and an explicit <code>@Order</code>.' },
    { trap: '<code>hasRole("ADMIN")</code> vs <code>hasAuthority("ADMIN")</code>', why: '<code>hasRole("ADMIN")</code> checks for the authority <code>ROLE_ADMIN</code>. If your users or JWT converter produce plain <code>ADMIN</code>, every check fails with 403. JWT scopes become <code>SCOPE_x</code> by default.', fix: 'Pick one convention. Use <code>hasAuthority</code> for exact strings (scopes, permissions) and <code>hasRole</code> only when authorities carry the <code>ROLE_</code> prefix (<code>User.withUsername(…).roles("ADMIN")</code> adds it for you).' },
    { trap: 'CORS configured only in Spring MVC', code: `@Override public void addCorsMappings(CorsRegistry r) { r.addMapping("/api/**").allowedOrigins("https://shop.example"); }
// browser: preflight OPTIONS /api/orders → 401`, why: 'A preflight <code>OPTIONS</code> request carries no credentials. If the security chain sees it before MVC does, the authorization rules reject it with 401 and the browser reports a CORS error.', fix: 'Call <code>http.cors(Customizer.withDefaults())</code>. <code>CorsFilter</code> then runs early in the chain and answers preflights itself, using a <code>CorsConfigurationSource</code> bean (or MVC’s CORS configuration if there is no such bean).' },
    { trap: 'Disabling CSRF for a cookie-based browser app', why: '<code>csrf.disable()</code> is right for a stateless API that only accepts bearer tokens. For a session-cookie app, the browser attaches the cookie to requests from any site, so without a CSRF token another site can submit forms as your user.', fix: 'Disable CSRF only on the chain that is stateless and bearer-only. For SPAs on cookies, keep CSRF on and use <code>CookieCsrfTokenRepository.withHttpOnlyFalse()</code> with a request handler that accepts the header value.' },
    { trap: 'A custom filter bean runs twice', code: `@Component                                     // Boot registers it in the servlet container…
class TenantFilter extends GenericFilterBean { … }
http.addFilterAfter(tenantFilter, BearerTokenAuthenticationFilter.class);  // …and you add it to the chain`, why: 'Spring Boot automatically registers every <code>Filter</code> bean with the servlet container. Adding the same bean to a security chain makes it run a second time, outside security, at a different position.', fix: 'Don’t make it a bean, or keep it a bean and disable the container registration with a <code>FilterRegistrationBean</code> whose <code>setEnabled(false)</code>. Extending <code>OncePerRequestFilter</code> also guards against double execution.' },
    { trap: '<code>@PreAuthorize</code> silently ignored', code: `@PreAuthorize("hasRole('ADMIN')")
private void purge() { … }            // private: never proxied
public void cleanup() { purge(); }    // self-call: never proxied`, why: 'Method security is AOP: an interceptor in a proxy. It needs <code>@EnableMethodSecurity</code> (Boot does not turn it on) and a call that enters the bean through the proxy. See <a href="aop-proxies.html">AOP &amp; proxies</a>.', fix: 'Add <code>@EnableMethodSecurity</code>, put annotations on public methods called from other beans, and write a test that calls the method as a user without the role and expects <code>AccessDeniedException</code>.' }
  ],
  scenarios: [
    { title: 'API clients get a 302 to /login instead of 401',
      symptom: 'A mobile app receives HTML (the login page) with status 200 after following a 302, for <code>GET /api/v1/orders</code>. Postman with a valid token works for <code>/api/orders</code> but not for <code>/api/v1/orders</code>.',
      diagnose: `logging.level.org.springframework.security: TRACE

Trying to match request against DefaultSecurityFilterChain [RequestMatcher=Mvc [pattern='/api/*'], ...] (1/2)
Trying to match request against DefaultSecurityFilterChain [RequestMatcher=any request, ...] (2/2)
Securing GET /api/v1/orders
...
Saved request http://…/api/v1/orders to session
Redirecting to http://…/login`,
      cause: 'The API chain used <code>securityMatcher("/api/*")</code>, which matches one path segment only. <code>/api/v1/orders</code> fell through to the form-login chain, whose entry point redirects to <code>/login</code>.',
      fix: 'Use <code>/api/**</code>. Add a test per chain that asserts the status an unauthenticated API call gets (401 with <code>WWW-Authenticate: Bearer</code>), so a matcher mistake fails the build.',
      fixCode: `@Test
void apiReturns401NotRedirect() throws Exception {
  mvc.perform(get("/api/v1/orders"))
     .andExpect(status().isUnauthorized())
     .andExpect(header().string("WWW-Authenticate", startsWith("Bearer")));
}` },
    { title: 'After the Boot 3 upgrade, the SPA’s POSTs fail with 403',
      symptom: 'GET calls work. Every POST, PUT and DELETE from the Angular app returns 403 with an empty body. Nothing reaches the controllers. The app reads the <code>XSRF-TOKEN</code> cookie and sends it in <code>X-XSRF-TOKEN</code>, as before.',
      diagnose: `DEBUG o.s.security.web.csrf.CsrfFilter : Invalid CSRF token found for http://…/api/cart
# Security 6 defaults changed:
#  - XorCsrfTokenRequestAttributeHandler: expects a *masked* token in the request
#  - deferred token loading: the cookie is only written when something reads the token`,
      cause: 'Security 6.0 masks the CSRF token per request (BREACH protection). The cookie holds the raw token, but the default handler now expects the masked form, so the raw value copied from the cookie no longer matches. On a first visit the cookie may also be missing, because token loading is deferred.',
      fix: 'For an SPA that copies the cookie into a header, resolve the header value as a raw token and make sure the cookie is issued. The Spring Security reference shows a fuller SPA handler that keeps masking for server-rendered forms.',
      fixCode: `http.csrf(csrf -> csrf
    .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
    .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))   // accept the raw cookie value
  .addFilterAfter((req, res, chain) -> {            // load the deferred token so the cookie is written
      CsrfToken t = (CsrfToken) req.getAttribute(CsrfToken.class.getName());
      if (t != null) t.getToken();
      chain.doFilter(req, res);
  }, BasicAuthenticationFilter.class);` },
    { title: 'Validation errors arrive as 401 with an empty body',
      symptom: 'After moving to Security 6, a public endpoint (<code>permitAll</code>) that throws a validation error returns 401 instead of a 400 <code>ProblemDetail</code>. Authenticated callers still get a 400.',
      diagnose: `Securing POST /api/signup            → permitted
Securing POST /error                 → AuthorizationFilter: anonymous, denied
Sending to entry point → 401`,
      cause: 'Errors that aren’t handled in MVC are rendered through a servlet ERROR dispatch to <code>/error</code>. Since Security 6.0, <code>AuthorizationFilter</code> applies to every dispatch type, so the ERROR dispatch is authorized too. <code>/error</code> was not permitted, so the anonymous caller got 401.',
      fix: 'Permit <code>/error</code> (or the ERROR dispatcher type). Better still, handle expected exceptions in a <code>@RestControllerAdvice</code> so they never need the error dispatch.',
      fixCode: `.authorizeHttpRequests(a -> a
    .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
    .requestMatchers("/error").permitAll()
    .requestMatchers(HttpMethod.POST, "/api/signup").permitAll()
    .anyRequest().authenticated())` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Two chains, Security 6. What happens?', code: `@Bean @Order(1)
SecurityFilterChain web(HttpSecurity http) throws Exception {
  return http.authorizeHttpRequests(a -> a.anyRequest().authenticated())
             .formLogin(Customizer.withDefaults()).build();
}
@Bean @Order(2)
SecurityFilterChain api(HttpSecurity http) throws Exception {
  return http.securityMatcher("/api/**")
             .authorizeHttpRequests(a -> a.anyRequest().permitAll()).build();
}`, options: ['/api/** is public, everything else needs login', 'Both chains run for /api/**, so it needs login', 'Everything needs login; the api chain is never used, and Security 6.4+ fails at startup', 'Spring merges them by specificity'], answer: 2, explain: 'The <code>web</code> chain has no <code>securityMatcher</code>, so it matches any request, and it is first. <code>FilterChainProxy</code> uses only the first match. Since 6.4, Spring Security detects that a later chain can never be invoked and throws at startup (older 6.x versions silently ignore the api chain), telling you to publish the any-request chain last.' },
    { kind: 'predict', q: 'The user’s only authority is <code>"ADMIN"</code>. Result of <code>DELETE /admin/users/7</code>?', code: `.requestMatchers("/admin/**").hasRole("ADMIN")`, options: ['403 Forbidden', 'Allowed', '401 Unauthorized', 'Startup error'], answer: 0, explain: '<code>hasRole("ADMIN")</code> looks for <code>ROLE_ADMIN</code>. The user is authenticated, so it isn’t a 401; the check fails and the access denied handler returns 403.' },
    { kind: 'predict', q: 'A session-cookie app with default Security 6 settings. A logged-in browser sends <code>POST /profile</code> with no CSRF token. Which filter answers, and with what?', options: ['AuthorizationFilter, 403', 'The controller runs; CSRF only applies to forms', 'ExceptionTranslationFilter, 401', 'CsrfFilter, 403'], answer: 3, explain: '<code>CsrfFilter</code> runs before authentication and authorization. It rejects state-changing methods without a valid token by calling the access denied handler directly: 403. Your rules were never consulted.' },
    { kind: 'predict', q: 'No credentials are sent to a route that requires <code>authenticated()</code>, on a resource-server chain. Response?', options: ['403 Forbidden', '401 with WWW-Authenticate: Bearer', '302 to /login', '200 with an anonymous user'], answer: 1, explain: '<code>AnonymousAuthenticationFilter</code> sets an anonymous token; <code>AuthorizationFilter</code> denies it; <code>ExceptionTranslationFilter</code> sees an anonymous user and calls the <b>entry point</b>. For a resource server that is <code>BearerTokenAuthenticationEntryPoint</code>: 401 with <code>WWW-Authenticate: Bearer</code>.' },
    { kind: 'predict', q: '<code>@EnableMethodSecurity</code> is on. A user without ADMIN calls <code>reportService.monthly()</code> from a controller. What happens?', code: `@Service
class ReportService {
  public Report monthly() { return build(); }

  @PreAuthorize("hasRole('ADMIN')")
  public Report build() { … }
}`, options: ['AccessDeniedException → 403', 'Startup fails: @PreAuthorize on a non-entry method', 'The report is returned', '401'], answer: 2, explain: '<code>monthly()</code> has no annotation, and its call to <code>build()</code> is a self-invocation on <code>this</code>, so the method security interceptor never runs. Move the check to <code>monthly()</code> or to the caller’s bean.' },
    { kind: 'concept', q: 'Where does Spring Security store the <code>Authentication</code> for the current request?', options: ['In the HttpSession only', 'In the ApplicationContext', 'In a request header', 'In the SecurityContextHolder, a ThreadLocal by default'], answer: 3, explain: 'The <code>SecurityContextHolder</code> uses a ThreadLocal strategy by default. A <code>SecurityContextRepository</code> may also persist it in the session between requests. Because it is a ThreadLocal, <code>@Async</code> methods don’t see it unless you propagate it.' },
    { kind: 'concept', q: 'Why should a browser’s CORS preflight be handled by Spring Security’s <code>CorsFilter</code> rather than only by Spring MVC?', options: ['The preflight carries no credentials, so the security chain would reject it before MVC sees it', 'MVC can’t handle OPTIONS', 'CorsFilter is faster', 'Browsers send preflights only to filters'], answer: 0, explain: 'A preflight <code>OPTIONS</code> request has no cookies or Authorization header. With <code>http.cors(…)</code>, <code>CorsFilter</code> runs early, recognises the preflight and answers it without continuing the chain.' }
  ],
  interview: [
    { q: 'Walk me through what happens to a request in Spring Security.', a: '<p>The servlet container calls <code>DelegatingFilterProxy</code>, which delegates to the <code>FilterChainProxy</code> bean. It picks the first <code>SecurityFilterChain</code> whose matcher fits and runs its filters in order: <code>SecurityContextHolderFilter</code> loads the context, header and CORS/CSRF filters run, an authentication filter (form, Basic, bearer) authenticates through the <code>AuthenticationManager</code>, <code>AnonymousAuthenticationFilter</code> fills in an anonymous token if needed, <code>ExceptionTranslationFilter</code> wraps the rest, and <code>AuthorizationFilter</code> applies the URL rules. Then the request reaches the <code>DispatcherServlet</code>, where method security may check again.</p>', lvl: 'core' },
    { q: 'How do authentication providers work?', a: '<p>An authentication filter builds an unauthenticated token (for example <code>UsernamePasswordAuthenticationToken</code>) and passes it to the <code>AuthenticationManager</code>, usually a <code>ProviderManager</code>. It asks each <code>AuthenticationProvider</code> that <code>supports()</code> the token type. <code>DaoAuthenticationProvider</code> loads the user via <code>UserDetailsService</code> and checks the password with the <code>PasswordEncoder</code>. The result is an authenticated token with authorities, which the filter stores in the <code>SecurityContextHolder</code>.</p>', lvl: 'core' },
    { q: 'When do you get 401 and when 403?', a: '<p><code>ExceptionTranslationFilter</code> decides. An <code>AuthenticationException</code>, or an <code>AccessDeniedException</code> for an anonymous user, triggers the <code>AuthenticationEntryPoint</code>: 401 for APIs, a redirect to the login page for form login. An <code>AccessDeniedException</code> for an authenticated user goes to the <code>AccessDeniedHandler</code>: 403. <code>CsrfFilter</code> also answers 403 itself.</p>', lvl: 'core' },
    { q: 'What changed in Spring Security 6 that you had to deal with in a migration?', a: '<ul><li><code>WebSecurityConfigurerAdapter</code> removed: use <code>SecurityFilterChain</code> beans.</li><li><code>antMatchers</code>/<code>mvcMatchers</code> → <code>requestMatchers</code>; <code>authorizeRequests</code> → <code>authorizeHttpRequests</code> (<code>AuthorizationFilter</code>), which applies to all dispatch types.</li><li><code>@EnableGlobalMethodSecurity</code> → <code>@EnableMethodSecurity</code>.</li><li>The security context is no longer saved automatically by <code>SecurityContextHolderFilter</code>; custom login code must save it through a <code>SecurityContextRepository</code>.</li><li>CSRF tokens are deferred and masked (BREACH protection) by default.</li></ul>', lvl: 'deep' },
    { q: 'How do you set up different security for /api and the web UI?', a: '<p>Two <code>SecurityFilterChain</code> beans. The API chain gets <code>@Order(1)</code>, <code>securityMatcher("/api/**")</code>, a resource server (JWT), stateless sessions and CSRF disabled. The web chain comes last, has no matcher, and uses form login or OIDC login with sessions and CSRF on. Each chain has its own entry point, so the API answers 401 and the UI redirects.</p>', lvl: 'core' },
    { q: 'What is CSRF and when can you disable protection?', a: '<p>Cross-site request forgery: another site makes the user’s browser send a request to your site, and the browser attaches your session cookie. A CSRF token, which the other site can’t read, proves the request came from your pages. You can disable it when the browser never authenticates automatically, i.e. a stateless API that only accepts an <code>Authorization: Bearer</code> header the client adds itself.</p>', lvl: 'core' },
    { q: 'URL security or method security?', a: '<p>Both. URL rules in the chain are coarse and cheap, and reject a request before any code runs. Method security (<code>@PreAuthorize</code>, <code>@PostAuthorize</code>) is close to the business logic, can use arguments (<code>#orderId</code>) and beans in SpEL, and protects the method whichever controller, listener or job calls it. Remember it is proxy-based: self-calls and private methods are not checked.</p>', fu: 'How would you check that the caller owns the order? <code>@PreAuthorize("@orderAccess.isOwner(#id, authentication)")</code>, or a custom <code>AuthorizationManager</code>.', lvl: 'deep' },
    { q: 'How would you add a custom filter, for example to resolve the tenant?', a: '<p>Extend <code>OncePerRequestFilter</code> and add it with <code>http.addFilterAfter(filter, BearerTokenAuthenticationFilter.class)</code> so the authentication is already available. Don’t also expose it as a <code>@Component</code>, or Boot registers it a second time in the servlet container. Clear any ThreadLocal you set in a <code>finally</code> block.</p>', lvl: 'core' },
    { q: 'How do you debug “why was this request rejected”?', a: '<p>Set <code>logging.level.org.springframework.security=TRACE</code>. It logs which chain matched, each filter invoked, and the authorization decision. <code>@EnableWebSecurity(debug = true)</code> prints the filter list per request (never in production). In tests, <code>MockMvc</code> with <code>@WithMockUser</code> or <code>jwt()</code> request post-processors reproduces it quickly.</p>', lvl: 'core' },
    { q: 'What is the difference between <code>permitAll()</code> and <code>web.ignoring()</code>?', a: '<p><code>permitAll()</code> still runs the chain: security headers are written, the context is loaded, CSRF still applies. <code>WebSecurityCustomizer</code> with <code>ignoring()</code> removes the request from Spring Security entirely: no headers, no context, no protection. Spring logs a warning recommending <code>permitAll</code>; use ignoring only for static resources, if at all.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Two chains: stateless API and browser UI', lang: 'java', code: `@Configuration
@EnableMethodSecurity                       // @PreAuthorize & co. (not enabled by Boot)
class SecurityConfig {

  @Bean @Order(1)
  SecurityFilterChain api(HttpSecurity http) throws Exception {
    http.securityMatcher("/api/**")
        .authorizeHttpRequests(a -> a
            .requestMatchers(HttpMethod.GET, "/api/orders/**").hasAuthority("SCOPE_orders.read")
            .requestMatchers("/api/admin/**").hasRole("ADMIN")
            .anyRequest().authenticated())
        .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .csrf(c -> c.disable())               // bearer-only: browsers never send it automatically
        .cors(Customizer.withDefaults());
    return http.build();
  }

  @Bean @Order(2)                            // no securityMatcher: must be last
  SecurityFilterChain web(HttpSecurity http) throws Exception {
    http.authorizeHttpRequests(a -> a
            .requestMatchers("/", "/css/**", "/error").permitAll()
            .anyRequest().authenticated())
        .formLogin(Customizer.withDefaults());
    return http.build();
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource() {
    var c = new CorsConfiguration();
    c.setAllowedOrigins(List.of("https://shop.example"));
    c.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
    c.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    var src = new UrlBasedCorsConfigurationSource();
    src.registerCorsConfiguration("/api/**", c);
    return src;
  }
}` },
    { title: 'Method security with arguments', lang: 'java', code: `@Service
class OrderService {
  @PreAuthorize("hasAuthority('SCOPE_orders.write') and @orderAccess.isOwner(#orderId, authentication)")
  public void cancel(long orderId) { … }

  @PostAuthorize("returnObject.customerId == authentication.name")
  public Order get(long orderId) { … }
}

@Component("orderAccess")
class OrderAccess {
  private final OrderRepository repo;
  OrderAccess(OrderRepository repo) { this.repo = repo; }
  public boolean isOwner(long orderId, Authentication auth) {
    return repo.findCustomerId(orderId).map(auth.getName()::equals).orElse(false);
  }
}` },
    { title: 'Testing the chain with MockMvc', lang: 'java', code: `@WebMvcTest(OrderController.class)
@Import(SecurityConfig.class)
class OrderSecurityTest {
  @Autowired MockMvc mvc;
  @MockitoBean OrderService orders;          // Boot 3.4+; @MockBean before that

  @Test void anonymousGets401() throws Exception {
    mvc.perform(get("/api/orders/1")).andExpect(status().isUnauthorized());
  }
  @Test void readScopeAllowed() throws Exception {
    mvc.perform(get("/api/orders/1").with(jwt().authorities(new SimpleGrantedAuthority("SCOPE_orders.read"))))
       .andExpect(status().isOk());
  }
  @Test void formPostWithoutCsrfIs403() throws Exception {
    mvc.perform(post("/profile").with(user("alice"))).andExpect(status().isForbidden());
  }
}` },
    { title: 'Seeing the chain', lang: 'yaml', code: `# application.yml: log chain selection, every filter and each authorization decision
logging:
  level:
    org.springframework.security: TRACE
# startup also logs the filter list of each chain at DEBUG:
# "Will secure Or [Mvc [pattern='/api/**']] with [DisableEncodeUrlFilter, …, AuthorizationFilter]"`, note: 'TRACE is noisy. Enable it for one test or one pod, not for the whole fleet.' }
  ]
});
