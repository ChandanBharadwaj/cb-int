/* MVC request flow: one Tomcat thread through filters → DispatcherServlet → mapping → adapter → resolvers/converters → controller → return value → interceptors, for five requests. */
IA.widget('mvc-request-flow', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  // stations: depth = nesting level; box = container that wraps the rows until `end`
  const R = [
    { id: 'tc', t: 'Tomcat worker thread · http-nio-8080-exec-7', d: 0, end: 'aft' },
    { id: 'f1', t: 'Filter · ServerHttpObservationFilter (timer, trace)', d: 1, end: 'aft' },
    { id: 'f2', t: 'Filter · Spring Security FilterChainProxy', d: 2, end: 'aft' },
    { id: 'f3', t: 'Filter · your ApiKeyFilter (OncePerRequestFilter)', d: 3, end: 'aft' },
    { id: 'ds', t: 'DispatcherServlet.doDispatch()', d: 4, end: 'aft' },
    { id: 'hm', t: 'HandlerMapping → HandlerExecutionChain', d: 5 },
    { id: 'pre', t: 'Interceptor.preHandle()', d: 5 },
    { id: 'ha', t: 'HandlerAdapter · RequestMappingHandlerAdapter', d: 5, end: 'rv' },
    { id: 'ar', t: 'Argument resolvers (@PathVariable, @RequestBody…)', d: 6 },
    { id: 'rd', t: 'HttpMessageConverter.read (Jackson) + @Valid', d: 6 },
    { id: 'ct', t: 'OrderController.create(cmd)  → service, @Transactional', d: 6 },
    { id: 'rv', t: 'Return value handler → HttpMessageConverter.write', d: 6 },
    { id: 'post', t: 'Interceptor.postHandle()', d: 5 },
    { id: 'ex', t: 'HandlerExceptionResolvers (@ExceptionHandler…)', d: 5 },
    { id: 'aft', t: 'Interceptor.afterCompletion()', d: 5 }
  ];
  const IX = Object.fromEntries(R.map((r, i) => [r.id, i]));
  const unwind = (status) => [
    ['f3', `Back in your filter, after <code>chain.doFilter()</code> returns. It can log the status (${status}) but the body is already written.`],
    ['f1', 'The observation filter stops its timer: <code>http.server.requests</code> gets one sample tagged with the status and URI template.'],
    ['tc', 'The thread goes back to Tomcat’s pool. One request occupied it from first filter to last byte.', 'ok']
  ];
  const S = {
    ok: { label: 'POST /orders → 201', req: 'POST /orders  Content-Type: application/json  Accept: application/json', steps: [
      ['tc', 'Tomcat parses the request and hands it to a free worker thread (200 max by default).'],
      ['f1', 'Outermost filter: start an observation (metrics + trace span), then <code>chain.doFilter()</code>.'],
      ['f2', 'Spring Security’s filter chain authenticates the JWT and stores the user in the <code>SecurityContext</code> (a thread-local).'],
      ['f3', 'Your filter checks the API key and passes the request on.'],
      ['ds', 'The last “filter” is the servlet itself: <code>DispatcherServlet.doDispatch()</code>.'],
      ['hm', '<code>RequestMappingHandlerMapping</code> matches path, method, <code>consumes</code> and <code>produces</code>: <code>OrderController#create</code>, plus the interceptors for <code>/api/**</code>.'],
      ['pre', '<code>preHandle()</code> returns true. It can see the <code>HandlerMethod</code> and its annotations; a filter can’t.'],
      ['ha', 'The dispatcher asks each adapter <code>supports(handler)</code>. <code>RequestMappingHandlerAdapter</code> knows how to call an annotated method.'],
      ['ar', 'For each parameter, the first matching <code>HandlerMethodArgumentResolver</code> wins. <code>@RequestBody</code> → <code>RequestResponseBodyMethodProcessor</code>.'],
      ['rd', 'Content-Type is JSON, so Jackson’s converter reads the body into <code>CreateOrder</code>. Then <code>@Valid</code> runs Bean Validation: OK.'],
      ['ct', 'Your method finally runs. The service opens a transaction, INSERTs, and commits.'],
      ['rv', '<code>ResponseEntity</code> 201: content negotiation picks <code>application/json</code>, Jackson writes the body and the response is <b>committed</b>.', 'ok'],
      ['post', '<code>postHandle()</code> runs, but the body is already written. Headers set here are lost.', 'warn'],
      ['aft', '<code>afterCompletion()</code> always runs if <code>preHandle</code> returned true. Clean up thread-locals here.'],
      ...unwind(201)] },
    invalid: { label: 'Invalid body → 400', req: 'POST /orders  {"sku":"", "qty":0}', skip: ['ct', 'rv', 'post'], steps: [
      ['tc', 'Same thread, same filters.'], ['f3', 'Filters pass the request through.'], ['ds', 'Into the dispatcher.'],
      ['hm', 'Mapped to <code>OrderController#create</code>.'], ['pre', '<code>preHandle()</code> returns true.'], ['ha', 'The adapter starts resolving arguments.'],
      ['rd', 'Jackson reads the JSON fine, but <code>@Valid</code> fails: <code>sku</code> is blank and <code>qty</code> is below 1. <code>MethodArgumentNotValidException</code>.', 'err'],
      ['ex', 'Your method and <code>postHandle</code> are skipped. <code>ExceptionHandlerExceptionResolver</code> finds a handler in your <code>@RestControllerAdvice</code> (or <code>ResponseEntityExceptionHandler</code>) and writes a 400 ProblemDetail.', 'warn'],
      ['aft', '<code>afterCompletion()</code> still runs.'], ...unwind(400)] },
    accept: { label: 'Accept: xml → 406', req: 'POST /orders  Content-Type: application/json  Accept: application/xml', skip: ['post'], steps: [
      ['f3', 'Through the filters.'], ['ds', 'Into the dispatcher.'],
      ['hm', 'The mapping declares no <code>produces</code>, so <code>Accept: application/xml</code> doesn’t stop it. Mapped.', 'warn'],
      ['pre', '<code>preHandle()</code> returns true.'], ['rd', 'Body read and validated.'],
      ['ct', 'The method runs. The service INSERTs and <b>commits</b> the order.', 'warn'],
      ['rv', 'Now the converter search: nothing on the classpath can write XML. <code>HttpMediaTypeNotAcceptableException</code>.', 'err'],
      ['ex', '<code>DefaultHandlerExceptionResolver</code> maps it to <b>406</b>. The client sees an error, but the order exists. With <code>produces = "application/json"</code> this would have been decided at mapping time.', 'err'],
      ['aft', '<code>afterCompletion()</code> runs.'], ...unwind(406)] },
    filter: { label: 'Filter throws → /error 500', req: 'POST /orders  X-Api-Key: expired', skip: ['ds', 'hm', 'pre', 'ha', 'ar', 'rd', 'ct', 'rv', 'post', 'ex', 'aft'], steps: [
      ['tc', 'Worker thread picks it up.'], ['f1', 'Observation starts.'], ['f2', 'Security passes (the key isn’t its job).'],
      ['f3', 'Your filter throws <code>InvalidApiKeyException</code>. The DispatcherServlet is never reached, so <b>no</b> exception resolver or <code>@ControllerAdvice</code> can see it.', 'err'],
      ['f1', 'The exception propagates out through the outer filters.', 'err'],
      ['tc', 'Tomcat catches it, sets 500 and does an ERROR dispatch to <code>/error</code>. Boot’s <code>BasicErrorController</code> writes its generic error body. Write the 401 in the filter instead.', 'err']] },
    slash: { label: 'GET /orders/ → 404', req: 'GET /orders/   (trailing slash)', skip: ['ar', 'rd', 'ct', 'rv', 'post'], steps: [
      ['f3', 'Through the filters.'], ['ds', 'Into the dispatcher.'],
      ['hm', 'Framework 6.x doesn’t match trailing slashes: <code>/orders/</code> ≠ <code>/orders</code>. The only mapping left is the static resource handler for <code>/**</code>.', 'warn'],
      ['ha', 'A different adapter this time: <code>HttpRequestHandlerAdapter</code> calls <code>ResourceHttpRequestHandler</code>, which isn’t an annotated method, so no argument resolvers run.'],
      ['ex', 'No file <code>static/orders/</code> → <code>NoResourceFoundException</code> (6.1+), resolved to <b>404</b>.', 'err'],
      ['aft', '<code>afterCompletion()</code> runs.'], ...unwind(404)] }
  };
  let sc = 'ok'; let k = 0; let gen = 0; let running = false; let speed = 2400;
  const mkSeg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = mkSeg(Object.keys(S).map((x) => [x, S[x].label]), sc, (v) => { sc = v; reset(); }, 'Request');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = mkSeg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const RH = 25; const TOP = 44; const W = 660; const H = TOP + R.length * RH + 34;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Nested request pipeline from Tomcat thread through filters and DispatcherServlet to the controller' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text: t }, o || {}));
  const dot = svg('circle', { r: 7, fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 2 });
  if (!reduced) dot.style.transition = 'transform .5s ease';
  const visited = new Set();
  function draw() {
    const D = S[sc]; const st = D.steps[k]; const cur = IX[st[0]]; const tone = st[2];
    stage.innerHTML = '';
    stage.append(T(10, 18, 'request', { fill: 'var(--text-3)', 'font-size': 11 }), T(64, 18, D.req, { 'font-family': 'var(--mono)', 'font-size': 11.5 }));
    R.forEach((r, i) => {
      const x = 10 + r.d * 14; const y = TOP + i * RH;
      if (r.end) { // container box spanning to its end row
        const yEnd = TOP + IX[r.end] * RH + RH - 2 + (6 - r.d) * 2;
        stage.append(svg('rect', { x: x - 4, y: y - 4, width: W - 2 * x + 8, height: yEnd - y + 6, rx: 8, fill: 'none', stroke: 'var(--border)', 'stroke-dasharray': r.d < 4 ? '4 3' : '' }));
      }
      const skipped = (D.skip || []).includes(r.id); const on = i === cur; const seen = visited.has(i);
      const stroke = on ? (tone === 'err' ? 'var(--err)' : tone === 'warn' ? 'var(--warn)' : tone === 'ok' ? 'var(--ok)' : 'var(--accent)') : 'var(--border)';
      const g = svg('g', { opacity: skipped ? 0.35 : 1 });
      g.append(svg('rect', { x: x + 14, y, width: W - 2 * x - 28, height: RH - 5, rx: 5, fill: on ? 'var(--accent-soft)' : seen ? 'var(--surface-2)' : 'var(--surface)', stroke, 'stroke-width': on ? 2 : 1 }));
      g.append(T(x + 22, y + 14, r.t, { 'font-size': 11.5, 'font-family': r.d >= 5 ? 'var(--mono)' : 'var(--sans)', 'font-weight': on ? 700 : 400, 'text-decoration': skipped ? 'line-through' : 'none' }));
      stage.append(g);
    });
    stage.append(dot);
    dot.setAttribute('fill', tone === 'err' ? 'var(--err)' : tone === 'ok' ? 'var(--ok)' : 'var(--accent)');
    dot.style.transform = `translate(${10 + R[cur].d * 14 + 8}px, ${TOP + cur * RH + 10}px)`;
    stage.append(T(10, H - 10, 'Dashed boxes = filters (outside Spring MVC). Solid = inside DispatcherServlet.', { fill: 'var(--text-3)', 'font-size': 11 }));
    narr.className = 'caption' + (tone ? ' ' + tone : '');
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k + 1}/${D.steps.length}` }), el('div', { class: 't', html: st[1] }));
    bStep.disabled = k >= D.steps.length - 1;
  }
  function show() { visited.add(IX[S[sc].steps[k][0]]); draw(); }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; visited.clear(); show(); }
  bStep.addEventListener('click', () => { gen++; stop(); if (k < S[sc].steps.length - 1) { k++; show(); } });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { gen++; stop(); return; }
    const n = S[sc].steps.length;
    if (k >= n - 1) { k = 0; visited.clear(); }
    if (reduced) { while (k < n - 1) { visited.add(IX[S[sc].steps[k][0]]); k++; } show(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen; show();
    while (running && g === gen && k < n - 1) { await sleep(speed); if (g !== gen) return; k++; show(); }
    if (g === gen) stop();
  });
  reset();
});
