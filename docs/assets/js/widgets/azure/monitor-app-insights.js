/* Monitor & App Insights: telemetry from the Java agent to Log Analytics, KQL and an alert; and a distributed trace across HTTP and Service Bus. */
IA.widget('monitor-app-insights', (root, ctx) => {
  /* ---- shared Azure widget kit (identical in every azure widget file) ---- */
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-az-style')) {
    document.head.append(el('style', { id: 'w-az-style', text: `
.w-az .nb rect { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .4s, stroke .4s; }
.w-az .nb { transition: opacity .45s; }
.w-az .nb text { fill: var(--text); font-size: 13px; font-family: var(--sans); }
.w-az .nb text.s { fill: var(--text-3); font-size: 10.5px; font-family: var(--mono); }
.w-az .nb.hot rect { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-az .nb.ok rect { stroke: var(--ok); stroke-width: 2.5; fill: color-mix(in srgb, var(--ok) 15%, var(--surface)); }
.w-az .nb.warn rect { stroke: var(--warn); stroke-width: 2.5; fill: color-mix(in srgb, var(--warn) 16%, var(--surface)); }
.w-az .nb.bad rect { stroke: var(--err); stroke-width: 2.5; fill: color-mix(in srgb, var(--err) 15%, var(--surface)); }
.w-az .nb.bad text.s, .w-az .nb.warn text.s, .w-az .nb.ok text.s, .w-az .nb.hot text.s { fill: var(--text-2); }
.w-az .nb.dim { opacity: .32; }
.w-az .nb.gone { opacity: .1; }
.w-az .eg { stroke: var(--border); stroke-width: 1.6; fill: none; transition: stroke .4s, opacity .4s; }
.w-az .eg.hot { stroke: var(--accent); stroke-width: 2.6; }
.w-az .eg.ok { stroke: var(--ok); stroke-width: 2.6; }
.w-az .eg.warn { stroke: var(--warn); stroke-width: 2.6; }
.w-az .eg.bad { stroke: var(--err); stroke-width: 2.6; stroke-dasharray: 6 4; }
.w-az .eg.dim { opacity: .25; }
.w-az .zn { fill: color-mix(in srgb, var(--surface-2) 70%, transparent); stroke: var(--border); stroke-dasharray: 6 5; transition: stroke .4s, fill .4s; }
.w-az .zn.bad { stroke: var(--err); fill: color-mix(in srgb, var(--err) 9%, transparent); }
.w-az .zn.hot { stroke: var(--accent); }
.w-az .lbl { fill: var(--text-2); font-size: 12px; font-family: var(--sans); }
.w-az .lbl.m { font-family: var(--mono); font-size: 11px; fill: var(--text-3); }
.w-az .pkt { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.w-az .bar { transition: width .6s ease, x .6s ease; }
.w-az.rm * { transition: none !important; animation: none !important; }
` }));
  }
  root.classList.add('w-az'); if (reduced) root.classList.add('rm');
  const Z = {};
  const clearZ = () => { for (const k in Z) delete Z[k]; };
  const seg = (opts, cur, on, label) => {
    const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' });
      b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); });
    return s;
  };
  const node = (g, id, x, y, w, h, t, s) => {
    const n = svg('g', { class: 'nb' });
    n.append(svg('rect', { x, y, width: w, height: h, rx: 8 }));
    n.append(svg('text', { x: x + w / 2, y: s != null ? y + h / 2 - 3 : y + h / 2 + 4, 'text-anchor': 'middle', text: t }));
    let se = null;
    if (s != null) { se = svg('text', { class: 's', x: x + w / 2, y: y + h / 2 + 12, 'text-anchor': 'middle', text: s }); n.append(se); }
    g.append(n); Z[id] = { n, base: 'nb', sub: se, sub0: s || '', x, y, w, h }; return n;
  };
  const edge = (g, id, d) => { const p = svg('path', { class: 'eg', d }); g.append(p); Z[id] = { n: p, base: 'eg' }; return p; };
  const link = (g, id, a, b) => {
    const A = Z[a]; const B = Z[b];
    const x1 = A.x + A.w / 2; const y1 = A.y + A.h; const x2 = B.x + B.w / 2; const y2 = B.y; const my = (y1 + y2) / 2;
    return edge(g, id, `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`);
  };
  const hlink = (g, id, a, b) => {
    const A = Z[a]; const B = Z[b]; const y1 = A.y + A.h / 2; const y2 = B.y + B.h / 2;
    const [x1, x2] = A.x < B.x ? [A.x + A.w, B.x] : [A.x, B.x + B.w]; const mx = (x1 + x2) / 2;
    return edge(g, id, `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
  };
  const mid = (id) => { const z = Z[id]; return [z.x + z.w / 2, z.y + z.h / 2]; };
  function paint(s) {
    for (const id in Z) { const z = Z[id]; const c = s && s.c && s.c[id];
      z.n.setAttribute('class', z.base + (c ? ' ' + c : ''));
      if (z.sub) z.sub.textContent = s && s.sub && s.sub[id] != null ? s.sub[id] : z.sub0; }
  }
  const cum = () => { let acc = {}; let sub = {};
    return { set(c, sb) { Object.assign(acc, c || {}); Object.assign(sub, sb || {}); return { c: { ...acc }, sub: { ...sub } }; }, clear() { acc = {}; sub = {}; } }; };
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const say = (n, h, cls) => { narr.className = 'caption' + (cls ? ' ' + cls : ''); narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: String(n) }), el('div', { class: 't', html: h })); };
  let gen = 0;
  const pkt = svg('circle', { r: 7, class: 'pkt', opacity: 0 });
  function fly(ids, ms) {
    const g = gen; const pts = ids.map((p) => (typeof p === 'string' ? mid(p) : p));
    return new Promise((res) => {
      if (reduced || pts.length < 2) return res();
      const L = []; let tot = 0;
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
      const dur = ms || 900; const t0 = performance.now(); pkt.setAttribute('opacity', 1);
      const fr = (t) => {
        if (g !== gen) { pkt.setAttribute('opacity', 0); return res(); }
        let d = Math.min(1, (t - t0) / dur) * tot; let i = 0;
        while (i < L.length - 1 && d > L[i]) { d -= L[i]; i++; }
        const f = L[i] ? Math.min(1, d / L[i]) : 1; const [x1, y1] = pts[i]; const [x2, y2] = pts[i + 1];
        pkt.setAttribute('cx', x1 + (x2 - x1) * f); pkt.setAttribute('cy', y1 + (y2 - y1) * f);
        if (t - t0 < dur) requestAnimationFrame(fr); else { pkt.setAttribute('opacity', 0); res(); }
      };
      requestAnimationFrame(fr);
    });
  }
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const controls = el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset);
  let steps = []; let k = 0; let running = false; let busy = false;
  function makeStepper(plan, intro, onReset, pause) {
    const reset = () => {
      gen++; running = false; busy = false; bPlay.textContent = '▶ Play'; k = 0;
      if (onReset) onReset(); steps = plan(); paint(null); say(0, intro()); bStep.disabled = false;
    };
    const step = async () => {
      if (busy || k >= steps.length) return false;
      busy = true; const g = gen; const s = steps[k++];
      if (s.pre) paint(s.pre);
      if (s.fly) await fly(s.fly, s.ms);
      if (g !== gen) return false;
      paint(s); if (s.run) s.run(); say(k, s.t, s.cls); busy = false;
      if (k >= steps.length) bStep.disabled = true;
      return true;
    };
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= steps.length) reset();
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && await step()) { if (k >= steps.length) break; await sleep(reduced ? 700 : (pause || 2600)); }
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    return reset;
  }
  /* ---- end kit ---- */
  let mode = 'pipe';
  const stage = svg('svg', { viewBox: '0 0 640 340', role: 'img', 'aria-label': 'Telemetry flowing from a Spring Boot app to Log Analytics, a KQL query and an alert, or a distributed trace across services' });
  const segM = seg([['pipe', 'Telemetry → alert'], ['trace', 'Distributed trace']], mode, (v) => { mode = v; reset(); }, 'Mechanism');
  const stats = el('div', { class: 'w-stats' });
  const stat = (h) => { stats.innerHTML = ''; h.forEach((x) => stats.append(el('span', { class: 'w-stat', html: x }))); };
  const zrect = (g, id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 10 }); g.append(r, svg('text', { class: 'lbl', x: x + 8, y: y + 17, text: label })); Z[id] = { n: r, base: 'zn' }; };
  let wf = null;
  const T0 = 200; const TW = 430;
  function bar(row, from, to, label, cls) {
    if (!wf) return;
    const y = 214 + row * 24;
    wf.append(svg('text', { class: 'lbl m', x: 10, y: y + 12, text: label }));
    const r = svg('rect', { class: 'bar', x: T0 + from * TW, y, width: reduced ? (to - from) * TW : 0, height: 16, rx: 4, fill: cls === 'bad' ? 'var(--err)' : cls === 'warn' ? 'var(--warn)' : 'var(--accent)', opacity: 0.8 });
    wf.append(r);
    if (!reduced) requestAnimationFrame(() => requestAnimationFrame(() => r.setAttribute('width', (to - from) * TW)));
  }
  function build() {
    stage.innerHTML = ''; clearZ(); wf = null;
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    if (mode === 'pipe') {
      zrect(bg, 'jvm', 10, 10, 190, 232, 'orders-api JVM + Java agent');
      node(g, 'req', 22, 36, 166, 44, 'request', 'GET /orders/42');
      node(g, 'dsql', 22, 86, 166, 44, 'dependency: SQL', 'postgresql · SELECT');
      node(g, 'dhttp', 22, 136, 166, 44, 'dependency: HTTP', 'POST payments/pay');
      node(g, 'exc', 22, 186, 166, 44, 'exception + log', 'Logback ERROR');
      node(g, 'ing', 220, 96, 130, 60, 'Ingestion', 'connection string');
      zrect(bg, 'law', 370, 10, 262, 232, 'law-prod (Log Analytics workspace)');
      node(g, 'tR', 382, 36, 238, 44, 'AppRequests', '');
      node(g, 'tD', 382, 86, 238, 44, 'AppDependencies', '');
      node(g, 'tE', 382, 136, 238, 44, 'AppExceptions', '');
      node(g, 'tT', 382, 186, 238, 44, 'AppTraces', '');
      ['req', 'dsql', 'dhttp', 'exc'].forEach((id) => hlink(e, 'x' + id, id, 'ing'));
      ['tR', 'tD', 'tE', 'tT'].forEach((id) => hlink(e, 'y' + id, 'ing', id));
      node(g, 'kql', 10, 268, 250, 62, 'KQL query', 'failRate by 5m bins');
      node(g, 'rule', 285, 268, 165, 62, 'Log search alert', 'every 5m · 15m window');
      node(g, 'ag', 475, 268, 157, 62, 'Action group', 'Teams + on-call');
      edge(e, 'q', 'M501 242 C 501 256, 135 252, 135 268');
      hlink(e, 'r', 'kql', 'rule'); hlink(e, 'a', 'rule', 'ag');
    } else {
      node(g, 'cl', 10, 30, 100, 56, 'Browser', 'no traceparent');
      node(g, 'ord', 130, 30, 150, 56, 'orders-api', 'role: orders-api');
      node(g, 'pay', 300, 30, 150, 56, 'payments-api', 'role: payments-api');
      node(g, 'sb', 300, 110, 150, 56, 'Service Bus', 'queue: shipments');
      node(g, 'ship', 470, 110, 160, 56, 'shipping-worker', 'role: shipping');
      node(g, 'pg', 470, 30, 160, 56, 'Postgres', 'Flexible Server');
      hlink(e, 'e1', 'cl', 'ord'); hlink(e, 'e2', 'ord', 'pay');
      edge(e, 'e3', 'M205 86 C 205 138, 250 138, 300 138');
      hlink(e, 'e4', 'sb', 'ship');
      edge(e, 'e5', 'M550 110 L 550 86');
      stage.append(svg('line', { x1: T0, y1: 202, x2: T0 + TW, y2: 202, stroke: 'var(--border)' }));
      stage.append(svg('text', { class: 'lbl m', x: 10, y: 198, text: 'waterfall (one OperationId)' }));
      wf = svg('g');
    }
    stage.append(bg, e, g); if (wf) stage.append(wf); stage.append(pkt);
    stat([]);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'pipe') {
      S.push({ ...A.set({ jvm: 'hot', req: 'hot' }, { req: 'GET /orders/42 · started' }), run: () => stat(['OperationId <b>4bf92f35…</b>']), t: 'A request arrives. The agent (attached with <code>-javaagent</code>) wraps the Spring MVC handler and starts a <b>request</b> span with a new W3C trace id. That id becomes <code>OperationId</code> on every row this request produces.' });
      S.push({ ...A.set({ dsql: 'ok', dhttp: 'bad', exc: 'bad', req: 'bad' }, { dsql: 'SELECT … 12 ms', dhttp: 'POST /pay · 503 · 1.6 s', exc: 'PaymentException', req: 'GET … · 500 · 1.9 s' }), run: () => stat(['OperationId <b>4bf92f35…</b>', 'rows <b>4</b>']), t: 'Without code changes the agent records the JDBC call and the <code>RestClient</code> call as <b>dependencies</b>, and the Logback ERROR line and exception as traces/exceptions. The payment call failed, so the request failed too.', cls: 'err' });
      S.push({ ...A.set({ jvm: 'warn' }), run: () => stat(['OperationId <b>4bf92f35…</b>', 'sampling: <b>kept</b>', 'ItemCount <b>4</b>']), t: '<b>Sampling</b> decides per operation (from the trace id), so a kept request keeps all its rows and the trace stays whole. This one is kept and stamped <code>ItemCount = 4</code>: it stands for about four similar requests that were dropped.', cls: 'warn' });
      S.push({ fly: ['req', 'ing'], ...A.set({ xreq: 'hot', xdsql: 'hot', xdhttp: 'hot', xexc: 'hot', ing: 'hot', jvm: '' }), run: () => stat(['batched export over HTTPS', 'ItemCount <b>4</b>']), t: 'The agent batches telemetry and sends it over HTTPS to the <b>ingestion endpoint</b> named in the connection string. Your request thread never waits for this.' });
      S.push({ fly: ['ing', 'tD'], ...A.set({ ytR: 'ok', ytD: 'ok', ytE: 'ok', ytT: 'ok', law: 'hot', tR: 'ok', tD: 'ok', tE: 'ok', tT: 'ok' }, { tR: '+1 row · Success=false', tD: '+2 rows (SQL, HTTP 503)', tE: '+1 row · PaymentException', tT: '+1 row · SeverityLevel 3' }), run: () => stat(['ingestion delay: <b>typically minutes</b>']), t: 'After an ingestion delay (typically minutes) the rows land in <b>workspace tables</b>, one table per telemetry type, all sharing <code>OperationId</code> and <code>AppRoleName</code>.', cls: 'ok' });
      S.push({ fly: ['tR', [501, 242], 'kql'], ...A.set({ q: 'hot', kql: 'hot' }, { kql: 'failRate 7.8% (02:05 bin)' }), run: () => stat(['<code>sum(ItemCount)</code>, not <code>count()</code>']), t: 'A KQL query turns rows into a signal: <code>AppRequests | summarize total = sum(ItemCount), failed = sumif(ItemCount, Success == false) by bin(TimeGenerated, 5m)</code>. Because of sampling it sums <code>ItemCount</code>.' });
      S.push({ fly: ['kql', 'rule'], ...A.set({ r: 'warn', rule: 'warn' }, { rule: '7.8% > 5% → Fired' }), run: () => stat(['window <b>15m</b> &gt; frequency <b>5m</b>']), t: 'The <b>log search alert</b> runs that query every 5 minutes over a 15-minute window. The window is longer than the frequency so late-arriving rows still count. 7.8% is above the 5% threshold, so it fires.', cls: 'warn' });
      S.push({ fly: ['rule', 'ag'], ...A.set({ a: 'bad', ag: 'bad' }, { ag: 'paged: on-call (sev 1)' }), run: () => stat(['alert <b>Fired</b>', 'auto-resolve when the rate drops']), t: 'The <b>action group</b> pages on-call and posts to Teams with a link to the query results. With auto-mitigate, the alert resolves itself when the condition clears. For “page within a minute” on CPU or edge 5xx, use a <b>metric alert</b> instead.', cls: 'err' });
      return S;
    }
    S.push({ fly: ['cl', 'ord'], ...A.set({ e1: 'hot', ord: 'hot' }, { ord: 'new trace 4bf92f35…' }), run: () => { bar(0, 0, 1, 'orders-api  POST /checkout'); stat(['OperationId <b>4bf92f35…</b>']); }, t: 'The browser sends no trace context, so the agent in <code>orders-api</code> starts a new trace. Its id is the <code>OperationId</code>, and the request span is the root of the tree.' });
    S.push({ fly: ['ord', 'pay'], ...A.set({ e2: 'hot', pay: 'hot' }, { pay: 'traceparent 00-4bf9…-01' }), run: () => { bar(1, 0.08, 0.52, 'payments-api POST /pay'); stat(['OperationId <b>4bf92f35…</b>', 'parent span <b>a1b2…</b>']); }, t: 'The outgoing HTTP call carries a <code>traceparent</code> header: version, trace id, the caller’s span id, flags. <code>payments-api</code> continues the same trace and records <code>ParentId</code> = the caller’s span.' });
    S.push({ fly: ['ord', [205, 138], 'sb'], ...A.set({ e3: 'hot', sb: 'hot' }, { sb: 'context in msg props' }), run: () => { bar(2, 0.56, 0.62, 'orders-api   send shipments'); }, t: 'Sending with the Azure Service Bus SDK puts the trace context into <b>message properties</b>. The agent instruments the SDK, so the send becomes a dependency span in the same trace.' });
    S.push({ fly: ['sb', 'ship'], ...A.set({ e4: 'hot', ship: 'hot' }, { ship: 'same OperationId' }), run: () => { bar(3, 0.68, 0.97, 'shipping     process message'); }, t: 'Seconds later <code>shipping-worker</code> receives the message. The agent reads the context from the properties, so its processing span joins the <b>same OperationId</b>, even though no HTTP call links the two services.' });
    S.push({ fly: ['ship', 'pg'], ...A.set({ e5: 'ok', pg: 'ok', ord: 'ok', pay: 'ok', sb: 'ok', ship: 'ok', e1: 'ok', e2: 'ok', e3: 'ok', e4: 'ok' }, { pg: 'INSERT shipment 9 ms' }), run: () => { bar(4, 0.78, 0.86, 'shipping     INSERT (JDBC)'); stat(['5 spans · 3 roles · <b>1 trace</b>']); }, t: 'The JDBC insert is a dependency of the worker’s span. The <b>end-to-end transaction</b> view now shows all five spans on one timeline: <code>union AppRequests, AppDependencies | where OperationId == "4bf92f35…"</code>.', cls: 'ok' });
    S.push({ ...A.set({ sb: 'warn', ship: 'warn', e3: 'warn' }, { sb: 'outbox: new trace', ship: 'orphan trace 77c0…' }), run: () => stat(['break: <b>outbox / custom protocol</b>']), t: 'Where context is not propagated, the trace <b>breaks</b>: a Postgres outbox read by a scheduled poller, a custom TCP protocol, or a hand-rolled thread pool. The worker then starts a new trace. Fix: store <code>traceparent</code> with the message and restore it.', cls: 'warn' });
    return S;
  }
  const intro = () => ({ pipe: 'Press Play: one failing request becomes rows in four tables, a KQL signal and a page.', trace: 'Press Play: follow one trace id through HTTP, a queue and a database, and watch the waterfall build.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), stats, controls, narr);
  const reset = makeStepper(plan, intro, build);
  reset();
});
