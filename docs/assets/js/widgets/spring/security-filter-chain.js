/* Security filter chain: a request walks through FilterChainProxy's filters; shows the SecurityContext and which filter answers (JWT, 401, 403, CSRF, CORS preflight, form login). */
IA.widget('security-filter-chain', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-sfc-style')) {
    document.head.append(el('style', { id: 'w-sfc-style', text: `
.w-sfc svg text { font-family: var(--mono); }
.w-sfc .row { fill: var(--surface); stroke: var(--border); stroke-width: 1.4; transition: fill .3s, stroke .3s, opacity .3s; }
.w-sfc .row.hot { stroke: var(--accent); stroke-width: 2.4; fill: var(--accent-soft); }
.w-sfc .row.ok { stroke: var(--ok); fill: color-mix(in srgb, var(--ok) 10%, var(--surface)); }
.w-sfc .row.bad { stroke: var(--err); stroke-width: 2.4; fill: color-mix(in srgb, var(--err) 12%, var(--surface)); }
.w-sfc .row.skip { opacity: .4; stroke-dasharray: 4 4; }
.w-sfc .pan { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.2; }
.w-sfc .pan.ok { stroke: var(--ok); stroke-width: 2; } .w-sfc .pan.bad { stroke: var(--err); stroke-width: 2; } .w-sfc .pan.hot { stroke: var(--accent); stroke-width: 2; }
.w-sfc .tok { fill: var(--accent); stroke: var(--surface); stroke-width: 3; }
.w-sfc .tok.bad { fill: var(--err); } .w-sfc .tok.ok { fill: var(--ok); }
` }));
  }
  const ROWS = [
    ['dfp', 'DelegatingFilterProxy', 'servlet filter → bean'],
    ['fcp', 'FilterChainProxy', 'first matching chain wins'],
    ['sch', 'SecurityContextHolderFilter', 'load context'],
    ['hdr', 'HeaderWriterFilter', 'security headers'],
    ['cors', 'CorsFilter', 'answers preflight'],
    ['csrf', 'CsrfFilter', 'token for POST/PUT/…'],
    ['auth', '', ''],
    ['anon', 'AnonymousAuthenticationFilter', 'else anonymous'],
    ['etf', 'ExceptionTranslationFilter', '401 / 403'],
    ['az', 'AuthorizationFilter', 'URL rules'],
    ['ds', 'DispatcherServlet → controller', '@PreAuthorize']
  ];
  const RY = (id) => 12 + ROWS.findIndex((r) => r[0] === id) * 31;
  const at = (id) => [104, RY(id) + 13];
  const API = { chain: 'api · /api/** · stateless', auth: ['BearerTokenAuthenticationFilter', 'JWT → JwtDecoder'] };
  const WEB = { chain: 'web · any request · session', auth: ['UsernamePasswordAuthn…Filter', 'POST /login'] };
  const SC = {
    jwt: Object.assign({ label: 'GET + valid JWT', req: ['GET /api/orders/42', 'Authorization: Bearer eyJhbGci…'], intro: 'A mobile client calls the API with a bearer token. Two chains exist: <code>api</code> (<code>@Order(1)</code>, <code>/api/**</code>) and <code>web</code> (last, any request).',
      steps: [
        { at: 'dfp', hi: { dfp: 'hot' }, say: 'Tomcat runs its servlet filters. Spring Security is just one of them: <code>DelegatingFilterProxy</code>, which forwards to the <code>springSecurityFilterChain</code> bean.' },
        { at: 'fcp', hi: { fcp: 'hot' }, chain: true, log: 'FilterChainProxy: match api chain (1/2)', say: '<code>FilterChainProxy</code> tries each chain in order. <code>/api/orders/42</code> matches <code>/api/**</code>, so the <b>api</b> chain runs. The web chain will never see this request.' },
        { at: 'sch', hi: { sch: 'hot' }, chain: true, ctx: ['(empty)'], say: 'Stateless chain: there is no session to load from, so the <code>SecurityContext</code> starts empty.' },
        { at: 'hdr', hi: { hdr: 'ok' }, chain: true, ctx: ['(empty)'], say: 'Security headers are added to the response (HSTS on HTTPS, <code>X-Content-Type-Options</code>, cache control…).' },
        { at: 'cors', hi: { cors: 'ok' }, chain: true, ctx: ['(empty)'], say: 'Not a cross-origin request (no <code>Origin</code> header from another site), so <code>CorsFilter</code> just passes it on.' },
        { at: 'csrf', hi: { csrf: 'skip' }, chain: true, ctx: ['(empty)'], say: 'CSRF is disabled on this chain (bearer-only, nothing sent automatically by a browser), and GET is a safe method anyway.' },
        { at: 'auth', hi: { auth: 'hot' }, chain: true, ctx: ['JwtAuthenticationToken', 'sub=svc-mobile', 'SCOPE_orders.read'], ctxc: 'hot', log: 'BearerTokenAuthenticationFilter: JWT valid (sig via JWKS, exp, iss)', say: 'The bearer filter extracts the token and asks the <code>AuthenticationManager</code>. <code>JwtDecoder</code> checks signature, expiry and issuer; scopes become <code>SCOPE_…</code> authorities. The result goes into the <b>SecurityContextHolder</b>.' },
        { at: 'anon', hi: { anon: 'skip' }, chain: true, ctx: ['JwtAuthenticationToken', 'sub=svc-mobile', 'SCOPE_orders.read'], say: 'Someone is already authenticated, so the anonymous filter does nothing.' },
        { at: 'etf', hi: { etf: 'hot' }, chain: true, ctx: ['JwtAuthenticationToken', 'sub=svc-mobile', 'SCOPE_orders.read'], say: '<code>ExceptionTranslationFilter</code> wraps everything after it in a try/catch. It only acts if something downstream throws.' },
        { at: 'az', hi: { az: 'ok' }, chain: true, ctx: ['JwtAuthenticationToken', 'sub=svc-mobile', 'SCOPE_orders.read'], log: "AuthorizationFilter: GET /api/orders/** hasAuthority('SCOPE_orders.read') ✓", logc: 'o', say: 'The first matching rule is <code>GET /api/orders/** → hasAuthority(\'SCOPE_orders.read\')</code>. Granted.' },
        { at: 'ds', hi: { ds: 'ok' }, chain: true, ctx: ['JwtAuthenticationToken', 'sub=svc-mobile', 'SCOPE_orders.read'], resp: ['200 OK', 'application/json'], respc: 'ok', tone: 'ok', say: 'Only now does the request reach the <code>DispatcherServlet</code> and your controller. On the way out, the context is cleared from the thread.' }] }, API),
    none: Object.assign({ label: 'no token → 401', req: ['GET /api/orders/42', '(no Authorization header)'], intro: 'Same endpoint, but the client forgot the token.',
      steps: [
        { at: 'fcp', hi: { dfp: 'ok', fcp: 'hot' }, chain: true, say: 'Same chain selection: <b>api</b>.' },
        { at: 'csrf', hi: { sch: 'ok', hdr: 'ok', cors: 'ok', csrf: 'skip' }, chain: true, ctx: ['(empty)'], say: 'Context empty, headers written, no CORS, CSRF off.' },
        { at: 'auth', hi: { auth: 'skip' }, chain: true, ctx: ['(empty)'], say: 'No <code>Authorization: Bearer</code> header: the bearer filter has nothing to authenticate and passes the request on. Missing credentials are not an error <i>yet</i>.' },
        { at: 'anon', hi: { anon: 'hot' }, chain: true, ctx: ['AnonymousAuthenticationToken', 'anonymousUser', 'ROLE_ANONYMOUS'], ctxc: 'hot', say: 'The context is still empty, so <code>AnonymousAuthenticationFilter</code> fills it with an anonymous token. Code downstream never sees a null <code>Authentication</code>.' },
        { at: 'etf', hi: { etf: 'hot' }, chain: true, ctx: ['AnonymousAuthenticationToken', 'anonymousUser', 'ROLE_ANONYMOUS'], say: 'The exception translator opens its try block…' },
        { at: 'az', hi: { etf: 'hot', az: 'bad' }, bad: true, chain: true, ctx: ['AnonymousAuthenticationToken', 'anonymousUser', 'ROLE_ANONYMOUS'], log: 'AuthorizationFilter: denied → AccessDeniedException', logc: 'e', tone: 'err', say: 'The rule needs <code>SCOPE_orders.read</code>. Denied: <code>AuthorizationFilter</code> throws <code>AccessDeniedException</code>.' },
        { at: 'etf', hi: { etf: 'bad', az: 'bad' }, bad: true, chain: true, ctx: ['AnonymousAuthenticationToken', 'anonymousUser', 'ROLE_ANONYMOUS'], resp: ['401 Unauthorized', 'WWW-Authenticate: Bearer'], respc: 'bad', log: 'ExceptionTranslationFilter: anonymous → AuthenticationEntryPoint', logc: 'e', tone: 'err', say: 'Caught. The user is <b>anonymous</b>, so this means “please authenticate”: the <b>entry point</b> runs. For a resource server that is a 401 with <code>WWW-Authenticate: Bearer</code>. (On the web chain it would be a 302 to <code>/login</code>.)' }] }, API),
    deny: Object.assign({ label: 'method security → 403', req: ['DELETE /api/orders/42', 'Authorization: Bearer eyJ…', '(no ROLE_ADMIN authority)'], intro: 'A valid token, but the service method is annotated <code>@PreAuthorize("hasRole(\'ADMIN\')")</code>. The URL rule only says <code>authenticated()</code>.',
      steps: [
        { at: 'auth', hi: { dfp: 'ok', fcp: 'ok', sch: 'ok', hdr: 'ok', cors: 'ok', csrf: 'skip', auth: 'ok' }, chain: true, ctx: ['JwtAuthenticationToken', 'sub=alice', 'SCOPE_orders.write'], say: 'Chain <b>api</b>, token valid: the context holds alice with <code>SCOPE_orders.write</code>.' },
        { at: 'etf', hi: { anon: 'skip', etf: 'hot' }, chain: true, ctx: ['JwtAuthenticationToken', 'sub=alice', 'SCOPE_orders.write'], say: 'Exception translator: try block opened.' },
        { at: 'az', hi: { etf: 'hot', az: 'ok' }, chain: true, ctx: ['JwtAuthenticationToken', 'sub=alice', 'SCOPE_orders.write'], log: 'AuthorizationFilter: /api/** authenticated() ✓', logc: 'o', say: 'The URL rule is coarse: <code>anyRequest().authenticated()</code>. Granted.' },
        { at: 'ds', hi: { etf: 'hot', az: 'ok', ds: 'bad' }, bad: true, chain: true, ctx: ['JwtAuthenticationToken', 'sub=alice', 'SCOPE_orders.write'], log: "@PreAuthorize(hasRole('ADMIN')) → AccessDeniedException", logc: 'e', tone: 'err', say: 'The controller calls <code>orderService.delete(42)</code> through its proxy. The method security interceptor evaluates <code>hasRole(\'ADMIN\')</code> (= authority <code>ROLE_ADMIN</code>) and throws <code>AccessDeniedException</code>.' },
        { at: 'etf', hi: { etf: 'bad', az: 'ok', ds: 'bad' }, bad: true, chain: true, ctx: ['JwtAuthenticationToken', 'sub=alice', 'SCOPE_orders.write'], resp: ['403 Forbidden', 'WWW-Authenticate: Bearer', 'error="insufficient_scope"'], respc: 'bad', log: 'ExceptionTranslationFilter: authenticated → AccessDeniedHandler', logc: 'e', tone: 'err', say: 'The exception travels back up through MVC and the filters to the translator. This user <b>is</b> authenticated, so it is a real “no”: the <b>access denied handler</b> returns 403. (If a <code>@ControllerAdvice</code> catches <code>AccessDeniedException</code> first, it never gets here.)' }] }, API),
    csrf: Object.assign({ label: 'form POST, no CSRF', req: ['POST /profile/email', 'Cookie: JSESSIONID=…  (no _csrf)'], intro: 'A logged-in browser user. Another site’s hidden form submits to your app; the browser attaches the session cookie.',
      steps: [
        { at: 'fcp', hi: { dfp: 'ok', fcp: 'hot' }, chain: true, log: 'FilterChainProxy: api? no · web (any request) ✓', say: '<code>/profile/email</code> does not match <code>/api/**</code>, so the <b>web</b> chain handles it.' },
        { at: 'sch', hi: { sch: 'hot' }, chain: true, ctx: ['UsernamePasswordAuthenticationToken', 'alice', 'ROLE_USER'], ctxc: 'hot', say: 'The session cookie is valid, so the context is loaded from the <code>HttpSession</code>: alice is logged in.' },
        { at: 'cors', hi: { sch: 'ok', hdr: 'ok', cors: 'ok' }, chain: true, ctx: ['UsernamePasswordAuthenticationToken', 'alice', 'ROLE_USER'], say: 'Headers, CORS: nothing to do for a plain form post.' },
        { at: 'csrf', hi: { csrf: 'bad' }, bad: true, chain: true, ctx: ['UsernamePasswordAuthenticationToken', 'alice', 'ROLE_USER'], resp: ['403 Forbidden', 'MissingCsrfTokenException'], respc: 'bad', log: 'CsrfFilter: POST without a valid token → AccessDeniedHandler', logc: 'e', tone: 'err', say: '<code>POST</code> is not a safe method, and there is no <code>_csrf</code> parameter or <code>X-CSRF-TOKEN</code> header. <code>CsrfFilter</code> calls the access denied handler directly: <b>403</b>. Authentication and your role rules never run, even though alice is logged in.' }] }, WEB),
    cors: Object.assign({ label: 'CORS preflight', req: ['OPTIONS /api/orders', 'Origin: https://shop.example', 'Access-Control-Request-Method: POST'], intro: 'Before a cross-origin <code>POST</code> with JSON and an Authorization header, the browser sends a <b>preflight</b>. It carries no credentials.',
      steps: [
        { at: 'fcp', hi: { dfp: 'ok', fcp: 'hot' }, chain: true, say: '<code>/api/orders</code> → <b>api</b> chain.' },
        { at: 'hdr', hi: { sch: 'ok', hdr: 'ok' }, chain: true, ctx: ['(empty)'], say: 'No session, no token: the context is empty.' },
        { at: 'cors', hi: { cors: 'ok' }, chain: true, ctx: ['(empty)'], resp: ['200 OK', 'Allow-Origin: https://shop.example', 'Allow-Methods: GET,POST,…'], respc: 'ok', log: 'CorsFilter: preflight for allowed origin → answered, chain stops', logc: 'o', tone: 'ok', say: 'Because the chain has <code>http.cors(…)</code>, <code>CorsFilter</code> recognises the preflight, checks the <code>CorsConfigurationSource</code>, writes the <code>Access-Control-Allow-*</code> headers and <b>returns without calling the rest of the chain</b>.' },
        { at: 'cors', hi: { cors: 'ok', auth: 'skip', anon: 'skip', etf: 'skip', az: 'skip', ds: 'skip' }, chain: true, ctx: ['(empty)'], resp: ['200 OK', 'Allow-Origin: https://shop.example', 'Allow-Methods: GET,POST,…'], respc: 'ok', tone: 'warn', say: 'Without <code>http.cors(…)</code>, the preflight would continue to <code>AuthorizationFilter</code> as an anonymous request and get <b>401</b>. The browser then reports a CORS error, which sends people looking in the wrong place.' }] }, API),
    login: Object.assign({ label: 'form login', req: ['POST /login', 'username=alice&password=…&_csrf=…'], intro: 'The login form posts credentials, with the CSRF token the login page embedded.',
      steps: [
        { at: 'fcp', hi: { dfp: 'ok', fcp: 'hot' }, chain: true, say: 'Chain <b>web</b> (form login lives there).' },
        { at: 'sch', hi: { sch: 'hot' }, chain: true, ctx: ['(empty)'], say: 'No authenticated session yet: empty context.' },
        { at: 'csrf', hi: { sch: 'ok', hdr: 'ok', cors: 'ok', csrf: 'ok' }, chain: true, ctx: ['(empty)'], log: 'CsrfFilter: token matches ✓', logc: 'o', say: 'The <code>_csrf</code> value matches the token stored in the session. Login forms are protected too, against login CSRF.' },
        { at: 'auth', hi: { auth: 'hot' }, chain: true, ctx: ['(authenticating…)'], log: 'ProviderManager → DaoAuthenticationProvider → UserDetailsService.loadUserByUsername("alice")', say: '<code>UsernamePasswordAuthenticationFilter</code> only handles <code>POST /login</code>. It asks <code>ProviderManager</code>, which delegates to <code>DaoAuthenticationProvider</code>: load the user, then <code>PasswordEncoder.matches()</code> (bcrypt).' },
        { at: 'auth', hi: { auth: 'ok' }, chain: true, ctx: ['UsernamePasswordAuthenticationToken', 'alice', 'ROLE_USER'], ctxc: 'ok', log: 'success: change session id · save context in HttpSession', logc: 'o', say: 'Password correct. Session fixation protection gives the session a new id, and the context is <b>saved</b> through the <code>SecurityContextRepository</code> (here the <code>HttpSession</code>), so the next request is logged in.' },
        { at: 'auth', hi: { auth: 'ok', anon: 'skip', etf: 'skip', az: 'skip', ds: 'skip' }, chain: true, ctx: ['UsernamePasswordAuthenticationToken', 'alice', 'ROLE_USER'], resp: ['302 Found', 'Location: /orders  (saved request)'], respc: 'ok', tone: 'ok', say: 'The login filter writes the response itself (the success handler redirects to the page you first asked for) and does not continue the chain. No controller handles <code>/login</code> POST.' }] }, WEB)
  };
  let sc = 'jwt'; let k = 0; let gen = 0; let running = false; let speed = 2200; let st;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(SC).map((x) => [x, SC[x].label]), sc, (v) => { sc = v; reset(); }, 'Request');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3400, 'Slow'], [2200, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 356', role: 'img', 'aria-label': 'Spring Security filters in order, a dot showing the request position, and panels for request, security context and response' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-log', 'aria-label': 'Filter log' });
  root.classList.add('w-sfc');
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, log);
  let tok;
  function panel(y, h, title, lines, cls) {
    stage.append(svg('rect', { class: 'pan ' + (cls || ''), x: 486, y, width: 268, height: h, rx: 10 }),
      svg('text', { x: 498, y: y + 18, 'font-size': 11.5, 'font-weight': 700, fill: 'var(--text-3)', text: title }));
    (lines || []).forEach((l, j) => stage.append(svg('text', { x: 498, y: y + 38 + j * 17, 'font-size': j === 0 ? 12.5 : 11.5, 'font-weight': j === 0 ? 700 : 400, fill: j === 0 ? 'var(--text)' : 'var(--text-2)', text: l.length > 36 ? l.slice(0, 35) + '…' : l })));
  }
  function render() {
    const S = SC[sc];
    stage.innerHTML = '';
    ROWS.forEach(([id, a, b]) => {
      const y = RY(id); const lab = id === 'auth' ? S.auth : [a, b];
      const inChain = !['dfp', 'fcp', 'ds'].includes(id);
      stage.append(svg('rect', { class: 'row ' + ((st.hi && st.hi[id]) || ''), x: 126, y, width: 344, height: 26, rx: 7 }),
        svg('text', { x: 136, y: y + 17, 'font-size': 12, 'font-weight': 700, fill: 'var(--text)', text: lab[0] }),
        svg('text', { x: 464, y: y + 17, 'font-size': 10, fill: 'var(--text-3)', 'text-anchor': 'end', text: lab[1] }));
      if (inChain && id === 'sch') stage.append(svg('text', { x: 8, y: y + 4, 'font-size': 10.5, fill: 'var(--accent)', 'font-weight': 700, text: 'chain:' }));
    });
    // chain bracket
    const y0 = RY('sch') - 3; const y1 = RY('az') + 29;
    stage.append(svg('path', { d: `M118 ${y0} L112 ${y0} L112 ${y1} L118 ${y1}`, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.6 }));
    S.chain.split(' · ').forEach((t, j) => stage.append(svg('text', { x: 8, y: RY('sch') + 22 + j * 15, 'font-size': 10.5, fill: 'var(--text-2)', text: t })));
    panel(10, 96, 'REQUEST', S.req, '');
    panel(116, 96, 'SecurityContextHolder', st.ctx || ['(not loaded yet)'], st.ctxc || '');
    panel(222, 96, 'RESPONSE', st.resp || ['(pending)'], st.respc || '');
    tok = svg('circle', { class: 'tok' + (st.bad ? ' bad' : st.tone === 'ok' ? ' ok' : ''), r: 9, cx: 0, cy: 0 });
    const [tx, ty] = st.tok;
    tok.style.transform = `translate(${st.prev ? st.prev[0] : tx}px, ${st.prev ? st.prev[1] : ty}px)`;
    if (!reduced) tok.style.transition = 'transform .6s ease';
    stage.append(tok);
    if (st.prev) requestAnimationFrame(() => requestAnimationFrame(() => { tok.style.transform = `translate(${tx}px, ${ty}px)`; }));
    log.innerHTML = ''; st.log.forEach(([t, cl]) => log.append(el('div', { text: t, style: { color: cl === 'e' ? 'var(--err)' : cl === 'o' ? 'var(--ok)' : '' } }))); log.scrollTop = log.scrollHeight;
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${SC[sc].steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; st = { hi: {}, log: [], tok: [104, 2] }; render(); say(SC[sc].intro); bStep.disabled = false; }
  function step() {
    const steps = SC[sc].steps; if (k >= steps.length) return false; const s = steps[k++];
    const prev = st.tok; const logs = st.log;
    st = { hi: s.hi || {}, tok: at(s.at), prev: reduced ? null : prev, bad: s.bad, tone: s.tone, ctx: s.ctx, ctxc: s.ctxc, resp: s.resp, respc: s.respc, log: logs };
    if (s.log) logs.push([s.log, s.logc]);
    render(); say(s.say, s.tone);
    if (k >= steps.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= SC[sc].steps.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
