/* Errors: an exception climbs the call stack to DispatcherServlet, which walks the HandlerExceptionResolver chain; the client response depends on your advice and Boot's problemdetails flag. */
IA.widget('errors-validation', (root, ctx) => {
  const { el, svg, sleep, reduced, codeBox } = ctx;
  const EX = {
    nf: { label: 'OrderNotFoundException', from: 2, path: '/orders/42', origin: [[2, '<code>OrderService.find(42)</code> finds nothing and throws <code>OrderNotFoundException</code> (your own <code>RuntimeException</code>, no <code>@ResponseStatus</code>).']] },
    mav: { label: 'MethodArgumentNotValidException', from: 0, path: '/orders', origin: [[0, 'While resolving <code>@Valid @RequestBody CreateOrder</code>, Bean Validation finds <code>sku</code> blank. <code>MethodArgumentNotValidException</code> is thrown <b>before</b> your controller runs.']] },
    cve: { label: 'ConstraintViolationException', from: 2, path: '/orders', origin: [[2, 'The controller had no <code>@Valid</code>. The <code>@Validated</code> service proxy validates <code>place(@Valid CreateOrder)</code> and throws Jakarta’s <code>ConstraintViolationException</code>.']] },
    dive: { label: 'DataIntegrityViolationException', from: 4, path: '/users', origin: [
      [4, 'Postgres rejects the INSERT: <code>ERROR: duplicate key value violates unique constraint "users_email_key"</code>, SQLSTATE <b>23505</b>.'],
      [3, 'At flush, Hibernate raises its <code>ConstraintViolationException</code>; Spring’s JPA dialect translates it into <code>DataIntegrityViolationException</code>.']] }
  };
  const STACK = ['DispatcherServlet (argument resolution)', 'OrderController', 'OrderService (@Validated proxy)', 'Repository / Hibernate flush', 'Postgres'];
  const RES = ['ExceptionHandlerExceptionResolver', 'ResponseStatusExceptionResolver', 'DefaultHandlerExceptionResolver', 'Container → /error (BasicErrorController)'];
  const now = '2026-11-22T10:15:30.123+00:00';
  const bootErr = (st, err, path) => `{\n  "timestamp": "${now}",\n  "status": ${st},\n  "error": "${err}",\n  "path": "${path}"\n}`;
  let ex = 'nf'; let advice = true; let pdOn = false;
  function plan() {
    const E = EX[ex]; const F = [];
    const adv = advice ? 'ApiErrors (yours, extends ResponseEntityExceptionHandler)' : pdOn ? 'ProblemDetailsExceptionHandler (Boot)' : null;
    E.origin.forEach(([lvl, cap]) => F.push({ at: lvl, cap, tone: 'err' }));
    if (E.from > 0) F.push({ at: 0, climb: true, cap: `No try/catch on the way up: the exception unwinds through ${E.from >= 2 ? 'the service and ' : ''}the controller to the <code>DispatcherServlet</code>, which hands it to its <code>HandlerExceptionResolver</code>s in order.` });
    // resolver 1
    let handled = null;
    const adviceHandles = advice ? { nf: [404, 'yours'], mav: [400, 'base'], cve: [400, 'yours'], dive: [409, 'yours'] }[ex] : pdOn ? { mav: [400, 'base'] }[ex] : null;
    F.push({ at: 0, r: 0, adv, cap: 'Resolver 1 looks for an <code>@ExceptionHandler</code> in <code>OrderController</code> itself (none), then in each <code>@ControllerAdvice</code> bean by <code>@Order</code>.' + (adv ? ` Advice registered: <b>${adv}</b>.` : ' No advice beans are registered.') });
    if (adviceHandles) {
      handled = adviceHandles;
      F.push({ at: 0, r: 0, adv, hit: true, tone: 'ok', cap: adviceHandles[1] === 'base' ? `Match: <code>ResponseEntityExceptionHandler</code> handles <code>MethodArgumentNotValidException</code>${advice ? ' and your override of <code>handleMethodArgumentNotValid</code> adds the field errors' : ''}. It returns a ProblemDetail.` : `Match: your <code>@ExceptionHandler(${E.label}.class)</code> builds a <b>${adviceHandles[0]}</b> ProblemDetail.` });
    } else {
      F.push({ at: 0, r: 0, adv, miss: true, tone: 'warn', cap: adv ? `The advice has no handler for <code>${E.label}</code>. <code>ResponseEntityExceptionHandler</code> only covers Spring MVC’s own exceptions.` : 'Nothing to match. Next resolver.' });
      F.push({ at: 0, r: 1, miss: true, cap: `Resolver 2: is <code>${E.label}</code> annotated with <code>@ResponseStatus</code>, or a <code>ResponseStatusException</code>? No.` });
      if (ex === 'mav') {
        F.push({ at: 0, r: 2, hit: true, tone: 'warn', cap: 'Resolver 3 knows the standard MVC exceptions: <code>MethodArgumentNotValidException</code> → <code>response.sendError(400)</code>. No body yet: the container does an error dispatch.' });
        F.push({ at: 0, r: 3, tone: 'warn', cap: 'The ERROR dispatch to <code>/error</code>: <code>BasicErrorController</code> renders Boot’s default body with status 400. No field errors, because <code>include-binding-errors</code> defaults to <code>never</code>.' });
        handled = [400, 'boot'];
      } else {
        F.push({ at: 0, r: 2, miss: true, cap: `Resolver 3 only maps Spring MVC exceptions (<code>HttpMessageNotReadableException</code>, <code>HttpRequestMethodNotSupportedException</code>…). Not <code>${E.label}</code>.` });
        F.push({ at: 0, r: 3, tone: 'err', cap: 'Unresolved: the exception propagates to Tomcat, which forwards to <code>/error</code>. The client gets a generic <b>500</b>, and the log gets a stack trace.' });
        handled = [500, 'boot'];
      }
    }
    // response
    let body; let ct = 'application/problem+json';
    const [st, kind] = handled;
    if (kind === 'boot') { ct = 'application/json'; body = bootErr(st, st === 400 ? 'Bad Request' : 'Internal Server Error', E.path); }
    else if (ex === 'nf') body = `{\n  "type": "https://api.example.com/problems/order-not-found",\n  "title": "Order not found",\n  "status": 404,\n  "detail": "Order 42 not found",\n  "instance": "/orders/42",\n  "orderId": 42\n}`;
    else if (ex === 'mav' && advice) body = `{\n  "type": "https://api.example.com/problems/invalid-request",\n  "title": "Bad Request",\n  "status": 400,\n  "detail": "Invalid request content.",\n  "instance": "/orders",\n  "errors": [ { "field": "sku", "message": "must not be blank" } ]\n}`;
    else if (ex === 'mav') body = `{\n  "type": "about:blank",\n  "title": "Bad Request",\n  "status": 400,\n  "detail": "Invalid request content.",\n  "instance": "/orders"\n}`;
    else if (ex === 'cve') body = `{\n  "type": "about:blank",\n  "title": "Bad Request",\n  "status": 400,\n  "instance": "/orders",\n  "errors": [ { "field": "place.cmd.sku", "message": "must not be blank" } ]\n}`;
    else body = `{\n  "type": "https://api.example.com/problems/email-taken",\n  "title": "Email already registered",\n  "status": 409,\n  "instance": "/users"\n}`;
    const good = kind !== 'boot';
    F.push({ at: 0, r: handled && kind !== 'boot' ? 0 : 3, done: true, tone: good ? 'ok' : st === 500 ? 'err' : 'warn', resp: { st, ct, body },
      cap: good ? `Client gets <b>${st}</b> as <code>${ct}</code>: one consistent RFC 9457 shape, with a stable <code>type</code> clients can switch on.` : `Client gets <b>${st}</b> with Boot’s default body. ${st === 500 ? 'Add a handler to your advice for this exception.' : 'Turn on <code>problemdetails</code> or extend <code>ResponseEntityExceptionHandler</code>.'}` });
    return F;
  }
  // ---- UI ----
  let F = plan(); let k = 0; let gen = 0; let running = false; let speed = 2400;
  const mkSeg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segEx = mkSeg(Object.keys(EX).map((x) => [x, EX[x].label]), ex, (v) => { ex = v; reset(); }, 'Exception');
  const segAdv = mkSeg([[true, 'your advice: on'], [false, 'your advice: off']], advice, (v) => { advice = v; reset(); }, 'Your advice');
  const segPd = mkSeg([[false, 'problemdetails.enabled: false'], [true, 'problemdetails.enabled: true']], pdOn, (v) => { pdOn = v; reset(); }, 'Boot problemdetails');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = mkSeg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const W = 680; const H = 290;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Call stack on the left, exception resolver chain on the right' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const resp = el('div', { style: { marginTop: '10px' } });
  root.append(el('div', { class: 'w-controls' }, segEx), el('div', { class: 'w-controls' }, segAdv, segPd), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, resp);
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text: t }, o || {}));
  function draw(f) {
    stage.innerHTML = '';
    stage.append(T(14, 18, 'Call stack (one thread)', { 'font-weight': 700, 'font-size': 13 }), T(356, 18, 'Resolver chain (in order)', { 'font-weight': 700, 'font-size': 13 }));
    STACK.forEach((s, i) => {
      const y = 30 + i * 50; const on = f.at === i; const below = i > f.at && i <= EX[ex].from;
      stage.append(svg('rect', { x: 14, y, width: 300, height: 38, rx: 7, fill: on ? 'var(--accent-soft)' : 'var(--surface)', stroke: on ? (f.tone === 'err' ? 'var(--err)' : 'var(--accent)') : below ? 'var(--warn)' : 'var(--border)', 'stroke-width': on ? 2 : 1, 'stroke-dasharray': below ? '4 3' : '' }));
      stage.append(T(26, y + 23, s, { 'font-family': i === 4 ? 'var(--sans)' : 'var(--mono)', 'font-size': 12 }));
      if (on) stage.append(svg('circle', { cx: 296, cy: y + 19, r: 8, fill: f.done && f.tone === 'ok' ? 'var(--ok)' : 'var(--err)' }), T(296, y + 23, '!', { fill: '#fff', 'font-weight': 700, 'text-anchor': 'middle' }));
      if (i < 4) stage.append(svg('line', { x1: 164, y1: y + 38, x2: 164, y2: y + 50, stroke: 'var(--border)' }));
    });
    RES.forEach((r, i) => {
      const y = 30 + i * 62; const on = f.r === i; const past = f.r != null && i < f.r;
      const stroke = on ? (f.hit ? 'var(--ok)' : f.miss ? 'var(--text-3)' : f.tone === 'err' ? 'var(--err)' : 'var(--accent)') : 'var(--border)';
      stage.append(svg('rect', { x: 356, y, width: 310, height: i === 0 ? 54 : 44, rx: 7, fill: on ? 'var(--accent-soft)' : 'var(--surface)', stroke, 'stroke-width': on ? 2 : 1, opacity: past ? 0.5 : 1 }));
      stage.append(T(366, y + 18, `${i + 1}. ${r}`, { 'font-family': 'var(--mono)', 'font-size': 11.5, 'font-weight': on ? 700 : 400 }));
      if (i === 0) stage.append(T(366, y + 38, f.adv || (f.r === 0 ? 'no @ControllerAdvice beans' : 'controller → @ControllerAdvice beans'), { 'font-size': 10.5, fill: 'var(--text-2)' }));
      if (on && (f.hit || f.miss)) stage.append(T(656, y + 18, f.hit ? '✓' : '✗', { 'text-anchor': 'end', 'font-weight': 700, 'font-size': 14, fill: f.hit ? 'var(--ok)' : 'var(--text-3)' }));
      if (i < 3) stage.append(svg('line', { x1: 511, y1: y + (i === 0 ? 54 : 44), x2: 511, y2: y + 62, stroke: 'var(--border)' }));
    });
    if (f.r != null || f.climb) stage.append(svg('path', { d: `M314 49 C 335 49, 335 ${30 + (f.r || 0) * 62 + 20}, 356 ${30 + (f.r || 0) * 62 + 20}`, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }));
    resp.innerHTML = '';
    if (f.resp) resp.append(codeBox(f.resp.body, 'json', `HTTP ${f.resp.st}  ·  Content-Type: ${f.resp.ct}`));
    else resp.append(el('div', { class: 'tiny', text: 'Response: not decided yet…' }));
  }
  function show() {
    const f = F[k]; draw(f);
    narr.className = 'caption' + (f.tone ? ' ' + f.tone : '');
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k + 1}/${F.length}` }), el('div', { class: 't', html: f.cap }));
    bStep.disabled = k >= F.length - 1;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); F = plan(); k = 0; show(); }
  bStep.addEventListener('click', () => { gen++; stop(); if (k < F.length - 1) { k++; show(); } });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { gen++; stop(); return; }
    if (k >= F.length - 1) k = 0;
    if (reduced) { k = F.length - 1; show(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen; show();
    while (running && g === gen && k < F.length - 1) { await sleep(speed); if (g !== gen) return; k++; show(); }
    if (g === gen) stop();
  });
  reset();
});
