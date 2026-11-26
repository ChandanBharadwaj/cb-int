/* spring-rest-basics: beginner step-through widget (scenarios, boxes and arrows, startup log). */
IA.widget('spring-rest-basics', (root, ctx) => {
  const C = {
    id: 'spring-rest-basics', vb: '0 0 760 300', aria: 'An HTTP request routed by Spring MVC to a @RestController method, with arguments bound and the result turned into JSON', logLabel: 'HTTP exchange',
    nodes: {
      client: [10, 20, 200, 'client', 'curl'],
      ds: [270, 20, 220, 'DispatcherServlet', 'front controller'],
      map: [530, 20, 220, 'handler mapping', '@GetMapping…'],
      bind: [530, 130, 220, 'argument binding', 'path / query / body'],
      method: [270, 130, 220, 'BookController', 'your method'],
      jackson: [10, 130, 200, 'Jackson', 'object ↔ JSON'],
      status: [270, 235, 220, 'status code', 'HTTP result']
    },
    sc: {
      get: { label: 'GET with params', nodes: ['client', 'ds', 'map', 'bind', 'method', 'jackson', 'status'],
        intro: '<code>GET /books/42?lang=en</code> hits <code>@GetMapping("/books/{id}")</code>. Press Play.',
        steps: [
          { n: { client: 'on', ds: 'work' }, hot: ['ds'], e: [['client', 'ds', 'try', 'GET /books/42?lang=en']], log: '> GET /books/42?lang=en\n> Accept: application/json', say: 'Every request enters Spring MVC through one servlet, the <b>DispatcherServlet</b>.' },
          { n: { map: 'ok' }, hot: ['map'], e: [['ds', 'map', 'ok']], say: 'It looks for a method whose mapping matches the HTTP method and path. <code>@GetMapping("/books/{id}")</code> matches; <code>{id}</code> is a template variable.' },
          { n: { bind: 'ok' }, lab: { bind: 'id=42L, lang="en"' }, hot: ['bind'], e: [['map', 'bind', 'ok']], say: '<code>@PathVariable Long id</code> gets <code>42</code> from the path, converted from text to <code>Long</code>. <code>@RequestParam String lang</code> gets <code>en</code> from the query string.' },
          { n: { method: 'ok' }, lab: { method: 'returns Book' }, hot: ['method'], e: [['bind', 'method', 'ok', 'call']], say: 'Your method runs and returns a plain Java object. Because the class is a <code>@RestController</code>, the return value <b>is the response body</b>, not a view name.' },
          { n: { jackson: 'ok' }, hot: ['jackson'], e: [['method', 'jackson', 'ok', 'serialize']], say: 'Jackson turns the object into JSON using its getters, or a record’s components.' },
          { n: { status: 'ok' }, lab: { status: '200 OK' }, e: [['jackson', 'client', 'ok', '200 + JSON']], log: '< HTTP/1.1 200\n< Content-Type: application/json\n{"id":42,"title":"Dune","year":1965}', logc: 'o', tone: 'ok', say: 'Default status is <b>200 OK</b>.' }
        ] },
      post: { label: 'POST JSON', nodes: ['client', 'ds', 'map', 'bind', 'method', 'jackson', 'status'],
        intro: '<code>POST /books</code> with a JSON body, handled by <code>@PostMapping</code> and <code>@RequestBody</code>.',
        steps: [
          { n: { client: 'on', ds: 'work' }, e: [['client', 'ds', 'try', 'POST /books']], log: '> POST /books\n> Content-Type: application/json\n{"title":"Emma","year":1815}', say: 'The client sends JSON and says so with <code>Content-Type: application/json</code>.' },
          { n: { map: 'ok' }, e: [['ds', 'map', 'ok']], say: '<code>@PostMapping("/books")</code> matches. Same path with GET would go to a different method.' },
          { n: { jackson: 'work', bind: 'ok' }, lab: { bind: '@RequestBody NewBook' }, hot: ['jackson', 'bind'], e: [['map', 'bind', 'ok'], ['bind', 'jackson', 'try', 'JSON → object']], say: '<code>@RequestBody NewBook body</code> asks Jackson to read the body into a Java object, here a <code>record NewBook(String title, int year)</code>.' },
          { n: { method: 'ok', jackson: 'ok' }, lab: { method: 'saves, id = 43' }, e: [['bind', 'method', 'ok', 'call']], say: 'The method saves the book and builds a <code>ResponseEntity</code> so it can choose the status and headers.' },
          { n: { status: 'ok' }, lab: { status: '201 Created' }, e: [['method', 'status', 'ok'], ['status', 'client', 'ok', '201']], log: '< HTTP/1.1 201\n< Location: /books/43\n{"id":43,"title":"Emma","year":1815}', logc: 'o', tone: 'ok', say: '<code>ResponseEntity.created(uri).body(saved)</code> → <b>201 Created</b> with a <code>Location</code> header. The REST convention for “I made a new resource”.' }
        ] },
      nf: { label: 'Not found → 404', nodes: ['client', 'ds', 'map', 'bind', 'method', 'status'],
        intro: '<code>GET /books/999</code>: the id is valid, but no such book exists.',
        steps: [
          { n: { client: 'on', ds: 'work', map: 'ok', bind: 'ok' }, lab: { bind: 'id=999L' }, e: [['client', 'ds', 'try', 'GET /books/999'], ['ds', 'map', 'ok'], ['map', 'bind', 'ok']], say: 'Routing and binding succeed as before.' },
          { n: { method: 'err' }, lab: { method: 'throws ResponseStatusException' }, hot: ['method'], e: [['bind', 'method', 'try', 'call']], tone: 'warn', say: 'The repository returns an empty <code>Optional</code>. Returning <code>null</code> would give a 200 with an empty body, which is misleading. Throw instead: <code>new ResponseStatusException(HttpStatus.NOT_FOUND)</code>.' },
          { n: { status: 'err' }, lab: { status: '404 Not Found' }, e: [['method', 'status', 'err'], ['status', 'client', 'err', '404']], log: '< HTTP/1.1 404\n{"timestamp":"…","status":404,"error":"Not Found","path":"/books/999"}', logc: 'e', tone: 'err', say: 'Spring turns it into a 404 with Boot’s default error JSON. Later you will centralise this with <code>@RestControllerAdvice</code>; see <a href="errors-validation.html">Errors &amp; validation</a>.' }
        ] },
      bad: { label: 'Bad input → 400', nodes: ['client', 'ds', 'map', 'bind', 'method', 'status'],
        intro: '<code>GET /books/abc</code>: “abc” cannot become a <code>Long</code>.',
        steps: [
          { n: { client: 'on', ds: 'work', map: 'ok' }, e: [['client', 'ds', 'try', 'GET /books/abc'], ['ds', 'map', 'ok']], say: 'The path still matches the <code>/books/{id}</code> template.' },
          { n: { bind: 'err' }, lab: { bind: '"abc" → Long ✗' }, hot: ['bind'], e: [['map', 'bind', 'err']], tone: 'warn', say: 'Type conversion fails while binding <code>@PathVariable Long id</code>.' },
          { n: { method: 'off' }, lab: { method: 'never called' }, say: 'Your method never runs: no partial work, no null id.' },
          { n: { status: 'err' }, lab: { status: '400 Bad Request' }, e: [['bind', 'status', 'err'], ['status', 'client', 'err', '400']], log: '< HTTP/1.1 400\n{"status":400,"error":"Bad Request","path":"/books/abc"}', logc: 'e', tone: 'err', say: '<b>400</b> means “the client sent something wrong”. 4xx = client’s fault, 5xx = server’s fault. A missing required <code>@RequestParam</code> also gives 400.' }
        ] }
    }
  };
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-sb-style')) {
    document.head.append(el('style', { id: 'w-sb-style', text: `
.w-sb .nd rect { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .3s, stroke .3s; }
.w-sb .nd text.nm { fill: var(--text); font-family: var(--mono); font-weight: 700; font-size: 15px; }
.w-sb .nd text.lb { fill: var(--text-2); font-family: var(--mono); font-size: 12px; }
.w-sb .nd.idle { opacity: .35; }
.w-sb .nd.on rect { stroke: var(--accent); stroke-width: 2; fill: var(--accent-soft); }
.w-sb .nd.work rect { stroke: var(--warn); stroke-width: 2; fill: color-mix(in srgb, var(--warn) 14%, var(--surface)); }
.w-sb .nd.ok rect { stroke: var(--ok); stroke-width: 2; fill: color-mix(in srgb, var(--ok) 12%, var(--surface)); }
.w-sb .nd.err rect { stroke: var(--err); stroke-width: 2; fill: color-mix(in srgb, var(--err) 12%, var(--surface)); }
.w-sb .nd.off { opacity: .5; } .w-sb .nd.off rect { stroke-dasharray: 5 4; }
.w-sb .nd.hot rect { stroke-width: 3.5; }
.w-sb .eg { fill: none; stroke: var(--edge); stroke-width: 1.8; }
.w-sb .eg.try { stroke: var(--warn); stroke-width: 2.4; }
.w-sb .eg.ok { stroke: var(--ok); stroke-width: 2.4; }
.w-sb .eg.err { stroke: var(--err); stroke-width: 2.4; stroke-dasharray: 6 4; }
.w-sb .el { fill: var(--text-2); font-family: var(--mono); font-size: 12px; paint-order: stroke; stroke: var(--bg); stroke-width: 4px; }
.w-sb-log { font-family: var(--mono); font-size: 12px; line-height: 1.55; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; max-height: 160px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-2); margin-top: 10px; }
.w-sb-log .e { color: var(--err); } .w-sb-log .o { color: var(--ok); }
` }));
  }
  const N = C.nodes; const S = C.sc;
  let sc = Object.keys(S)[0]; let k = 0; let gen = 0; let running = false; let speed = 2600; let st;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(S).map((x) => [x, S[x].label]), sc, (v) => { sc = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: C.vb, role: 'img', 'aria-label': C.aria });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-sb-log', 'aria-label': C.logLabel || 'Log' });
  root.classList.add('w-sb');
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, log);
  const box = (id) => { const n = N[id]; return { x: n[0], y: n[1], w: n[2] || 200, h: 56 }; };
  const anchor = (a, b) => {
    const A = box(a); const B = box(b);
    const acx = A.x + A.w / 2; const acy = A.y + A.h / 2; const bcx = B.x + B.w / 2; const bcy = B.y + B.h / 2;
    let p, q;
    if (Math.abs(bcx - acx) * 0.5 > Math.abs(bcy - acy)) {
      p = [bcx > acx ? A.x + A.w : A.x, acy]; q = [bcx > acx ? B.x : B.x + B.w, bcy];
    } else {
      p = [acx, bcy > acy ? A.y + A.h : A.y]; q = [bcx, bcy > acy ? B.y : B.y + B.h];
    }
    return { d: `M${p[0]} ${p[1]} L ${q[0]} ${q[1]}`, mx: (p[0] + q[0]) / 2, my: (p[1] + q[1]) / 2 };
  };
  const MK = { n: 'var(--edge)', try: 'var(--warn)', ok: 'var(--ok)', err: 'var(--err)' };
  function render() {
    stage.innerHTML = '';
    const defs = svg('defs');
    Object.entries(MK).forEach(([c, col]) => defs.append(svg('marker', { id: C.id + '-ar-' + c, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: col }))));
    stage.append(defs);
    const labels = [];
    st.edges.forEach(([a, b, c, t]) => { const g = anchor(a, b); stage.append(svg('path', { class: 'eg ' + (c || ''), d: g.d, 'marker-end': `url(#${C.id}-ar-${c || 'n'})` })); if (t) labels.push(svg('text', { class: 'el', x: g.mx, y: g.my - 6, 'text-anchor': 'middle', text: t })); });
    S[sc].nodes.forEach((id) => {
      const b = box(id);
      const g = svg('g', { class: 'nd ' + st.n[id] + (st.hot.includes(id) ? ' hot' : '') });
      g.append(svg('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 9 }), svg('text', { class: 'nm', x: b.x + 12, y: b.y + 23, text: st.nm[id] }), svg('text', { class: 'lb', x: b.x + 12, y: b.y + 43, text: st.lab[id] }));
      stage.append(g);
    });
    labels.forEach((t) => stage.append(t));
    log.innerHTML = '';
    st.log.forEach(([t, c]) => log.append(el('div', { class: c || '', text: t })));
    log.scrollTop = log.scrollHeight;
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${S[sc].steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    st = { n: {}, nm: {}, lab: {}, hot: [], edges: [], log: [] };
    S[sc].nodes.forEach((id) => { st.n[id] = 'idle'; st.nm[id] = (S[sc].nm0 || {})[id] || N[id][3]; st.lab[id] = (S[sc].lab0 || {})[id] || N[id][4] || ''; });
    render(); say(S[sc].intro); bStep.disabled = false;
  }
  function step() {
    const steps = S[sc].steps; if (k >= steps.length) return false;
    const s = steps[k++];
    if (s.clear) st.edges = [];
    Object.assign(st.n, s.n || {}); Object.assign(st.lab, s.lab || {}); Object.assign(st.nm, s.nm || {}); st.hot = s.hot || [];
    (s.e || []).forEach(([a, b, c, t]) => { st.edges = st.edges.filter((x) => !(x[0] === a && x[1] === b)); st.edges.push([a, b, c, t]); });
    if (s.log) st.log.push([s.log, s.logc]);
    render(); say(s.say, s.tone);
    if (k >= steps.length) bStep.disabled = true;
    return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= S[sc].steps.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
