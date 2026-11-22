/* Tracing: build a two-service trace waterfall span by span, with the traceparent header, log correlation and the metric the same observation produces. */
IA.widget('actuator-observability-trace', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-trc-style')) {
    document.head.append(el('style', { id: 'w-trc-style', text: `
.w-trc svg text { font-family: var(--mono); }
.w-trc .bar { stroke-width: 1.5; }
.w-trc .bar.s1 { fill: color-mix(in srgb, var(--k-service) 30%, var(--surface)); stroke: var(--k-service); }
.w-trc .bar.s2 { fill: color-mix(in srgb, var(--k-compute) 30%, var(--surface)); stroke: var(--k-compute); }
.w-trc .bar.db { fill: color-mix(in srgb, var(--k-store) 30%, var(--surface)); stroke: var(--k-store); }
.w-trc .bar.new { stroke-width: 3; }
.w-trc .bar.orphan { stroke-dasharray: 5 4; }
.w-trc .ax { stroke: var(--border); }
.w-trc-log { font-family: var(--mono); font-size: 11.5px; line-height: 1.55; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-2); margin-top: 10px; max-height: 170px; overflow: auto; }
.w-trc-log .h { color: var(--accent); } .w-trc-log .e { color: var(--err); } .w-trc-log .m { color: var(--ok); }
` }));
  }
  const T1 = '4bf92f3577b34da6a3ce929d0e0e4736'; const T2 = 'b7e1c2a9d04f4e1e8a51f0c3d2b6a907';
  let mode = 'ok'; let k = 0; let gen = 0; let running = false;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segM = seg([['ok', 'RestClient from the Boot builder'], ['bad', 'RestClient.create() (not instrumented)']], mode, (v) => { mode = v; reset(); }, 'HTTP client');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 760 250', role: 'img', 'aria-label': 'Trace waterfall of spans across order-service and inventory-service' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-trc-log' });
  root.classList.add('w-trc');
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, log);
  function spans() {
    const ok = mode === 'ok';
    const S = [
      { r: 0, t0: 0, t1: 120, c: 's1', n: 'order-service  http get /orders/{id}', tr: T1, id: '00f067aa0ba902b7' },
      { r: 1, t0: 8, t1: 22, c: 'db', n: 'order-service  query (SELECT orders)', tr: T1, id: 'a1b2c3d4e5f60718' }
    ];
    if (ok) S.push({ r: 2, t0: 30, t1: 110, c: 's1', n: 'order-service  http get (client)', tr: T1, id: '5a6b7c8d9e0f1a2b' });
    S.push({ r: ok ? 3 : 2, t0: 34, t1: 106, c: 's2', n: 'inventory-service  http get /stock/{sku}', tr: ok ? T1 : T2, id: '7d8e9f0a1b2c3d4e', orphan: !ok });
    S.push({ r: ok ? 4 : 3, t0: 40, t1: 60, c: 'db', n: 'inventory-service  query (SELECT stock)', tr: ok ? T1 : T2, id: '9f0a1b2c3d4e5f60', orphan: !ok });
    return S;
  }
  function plan() {
    const ok = mode === 'ok'; const P = [];
    P.push({ sp: 1, log: [['', `INFO [order-service,${T1.slice(0, 8)}…,00f067aa…] OrderController : GET /orders/42`]], say: 'A request arrives. The server observation (Spring MVC’s <code>ServerHttpObservationFilter</code>) starts a span. No <code>traceparent</code> header came in, so a new trace id is created. Boot 3.2+ adds trace and span ids to every log line.' });
    P.push({ sp: 2, say: 'A database query becomes a child span. JDBC isn’t traced by Spring itself; this needs an extra library such as <code>datasource-micrometer</code> (or the OTel Java agent).' });
    if (ok) {
      P.push({ sp: 3, log: [['h', `→ GET http://inventory/stock/SKU-7\n  traceparent: 00-${T1}-5a6b7c8d9e0f1a2b-01`]], say: 'The <code>RestClient</code> was built from Boot’s auto-configured <code>RestClient.Builder</code>, so it is instrumented: it opens a client span and <b>injects</b> the W3C <code>traceparent</code> header (version, trace id, parent span id, sampled flag).' });
      P.push({ sp: 4, log: [['', `INFO [inventory-service,${T1.slice(0, 8)}…,7d8e9f0a…] StockController : GET /stock/SKU-7`]], say: 'inventory-service <b>extracts</b> the header and continues the same trace: same trace id, its server span’s parent is the client span. One waterfall across both services.' });
    } else {
      P.push({ sp: 2, log: [['e', '→ GET http://inventory/stock/SKU-7\n  (no traceparent header)']], tone: 'err', say: '<code>RestClient.create()</code> bypasses Boot’s builder, so no observation is registered: no client span and <b>no header</b>. The latency of the call is invisible in this trace.' });
      P.push({ sp: 3, log: [['e', `INFO [inventory-service,${T2.slice(0, 8)}…,7d8e9f0a…] StockController : GET /stock/SKU-7`]], tone: 'err', say: 'inventory-service sees no header and starts a <b>new trace</b> (dashed). Two disconnected traces, and the logs no longer share an id you can search for.' });
    }
    P.push({ sp: 5, say: 'The downstream database query is a child of inventory’s server span.' });
    P.push({ sp: 9, log: [['m', 'http.server.requests{method=GET,uri=/orders/{id},status=200,outcome=SUCCESS,exception=none}  count+1  ~120ms'], ['', 'export: OTLP → collector (management.otlp.tracing.endpoint); sampled with probability 0.1 by default']], tone: ok ? 'ok' : 'warn',
      say: 'The request completes. The <b>same observation</b> also recorded the <code>http.server.requests</code> timer, tagged with the URI <i>template</i> (not <code>/orders/42</code>, which would explode cardinality). Spans are exported over OTLP. By default only 10% of traces are sampled (<code>management.tracing.sampling.probability</code>).' });
    return P;
  }
  let steps = []; let shownN = 0; let logs = [];
  function render() {
    stage.innerHTML = '';
    const X0 = 10; const X1 = 750; const sx = (t) => X0 + (t / 125) * (X1 - X0);
    [0, 25, 50, 75, 100, 125].forEach((t) => stage.append(svg('line', { class: 'ax', x1: sx(t), y1: 14, x2: sx(t), y2: 240 }), svg('text', { x: sx(t) + 3, y: 12, 'font-size': 10.5, fill: 'var(--text-3)', text: `${t} ms` })));
    spans().slice(0, shownN).forEach((s, i) => {
      const y = 24 + s.r * 44;
      stage.append(svg('rect', { class: 'bar ' + s.c + (s.orphan ? ' orphan' : '') + (i === shownN - 1 ? ' new' : ''), x: sx(s.t0), y, width: Math.max(6, sx(s.t1) - sx(s.t0)), height: 22, rx: 5 }),
        svg('text', { x: Math.min(sx(s.t0) + 6, 520), y: y + 38, 'font-size': 11.5, fill: 'var(--text-2)', text: `${s.n} · trace ${s.tr.slice(0, 6)}…` }));
    });
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${steps.length}` }), el('div', { class: 't', html: h })); }
  function renderLog() { log.innerHTML = ''; if (!logs.length) log.append(el('div', { text: '(logs, headers and metrics appear here)' })); logs.forEach(([c, t]) => log.append(el('div', { class: c, text: t }))); log.scrollTop = log.scrollHeight; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; shownN = 0; logs = []; steps = plan(); render(); renderLog(); say('<code>GET /orders/42</code> on order-service calls inventory-service. Press Play or Step to build the trace span by span.'); bStep.disabled = false; }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++];
    shownN = Math.min(s.sp, spans().length); (s.log || []).forEach((l) => logs.push(l));
    render(); renderLog(); say(s.say, s.tone); if (k >= steps.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
