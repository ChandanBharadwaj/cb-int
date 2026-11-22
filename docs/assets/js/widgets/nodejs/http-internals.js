/* HTTP internals: socket timelines — the keep-alive race behind LB 502s, LB-closes-first, an agent pool
   with maxSockets, slowloris vs headersTimeout, and HTTP/2 streams on one connection. */
IA.widget('http-internals', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-hi-style')) {
    document.head.append(el('style', { id: 'w-hi-style', text: `
.w-hi .rl { fill: var(--text-2); font-size: 13px; font-weight: 600; }
.w-hi .track { fill: var(--surface-2); stroke: var(--border); }
.w-hi .s-act { fill: var(--accent); } .w-hi .s-idle { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1; }
.w-hi .s-slow { fill: color-mix(in srgb, var(--warn) 45%, var(--surface)); } .w-hi .s-hs { fill: url(#w-hi-hatch); stroke: var(--text-3); stroke-width: 1; }
.w-hi .m-ok { stroke: var(--ok); } .w-hi .m-bad { stroke: var(--err); } .w-hi .m-info { stroke: var(--text-3); stroke-dasharray: 3 3; }
.w-hi .ml { font-size: 12px; } .w-hi .ml.ok { fill: var(--ok); } .w-hi .ml.bad { fill: var(--err); font-weight: 700; } .w-hi .ml.info { fill: var(--text-2); }
.w-hi .axis { stroke: var(--border); } .w-hi .tick { fill: var(--text-3); font-size: 11px; }
.w-hi .now { stroke: var(--accent); stroke-width: 2; }
.w-hi .fade { animation: capin .4s ease both; }
` }));
  }
  const s = (r, a, b, k) => ({ r, a, b, k }); const m = (r, t, l, k, dy) => ({ r, t, l, k, dy: dy || 0, m: 1 });
  const SC = {
    race: { label: 'Node closes first → 502', unit: 's', tmax: 7, rows: ['client → LB', 'LB → Node · socket #1 (LB idle 60 s, Node 5 s)'], steps: [
      { t: 0.35, add: [s(1, 0, 0.1, 'hs'), s(1, 0.1, 0.3, 'act'), s(0, 0, 0.35, 'act'), m(0, 0.35, '200', 'ok')], x: 'Request 1. The LB opens a TCP connection to the pod (hatched: handshake), sends the request, and Node answers 200 with <code>Keep-Alive: timeout=5</code>.' },
      { t: 4.9, add: [s(1, 0.3, 4.98, 'idle')], x: 'The socket is idle. The LB keeps it in its pool for up to <b>60 s</b>. Node’s <code>keepAliveTimeout</code> timer (<b>5 s</b>) is running.' },
      { t: 5, add: [m(1, 5, 'Node closes (FIN)', 'bad')], x: 'At 5 s idle, Node closes the socket. The FIN is on its way to the LB…' },
      { t: 5.15, add: [s(0, 5, 5.15, 'act'), m(1, 5.02, 'LB sends req 2 → RST', 'bad', 14), m(0, 5.15, '502', 'bad')], x: '…but in that same instant the LB picks this “idle” socket for request 2. Node has already closed it and answers with a reset. The LB returns <b>502</b>; Node never logs the request. Rare per request, constant at scale.' },
      { t: 7, add: [], x: 'Fix: <code>server.keepAliveTimeout = 65_000</code>, longer than the LB’s 60 s, so the LB is always the one that closes. See the next scenario.' }
    ] },
    lb: { label: 'LB closes first (fixed)', unit: 's', tmax: 100, rows: ['client → LB', 'LB → Node · socket #1 (LB idle 60 s, Node 65 s)'], steps: [
      { t: 1, add: [s(1, 0, 0.5, 'hs'), s(1, 0.5, 1, 'act'), s(0, 0, 1.2, 'act'), m(0, 1.2, '200', 'ok')], x: 'Request 1 opens the connection. Node now advertises <code>Keep-Alive: timeout=65</code>.' },
      { t: 30.5, add: [s(1, 1, 30, 'idle'), s(1, 30, 30.6, 'act'), s(0, 30, 30.8, 'act'), m(1, 30, 'reused: no handshake', 'ok')], x: 'At 30 s request 2 reuses the idle socket: no TCP or TLS handshake.' },
      { t: 90.6, add: [s(1, 30.6, 90.6, 'idle'), m(1, 90.6, 'LB closes (60 s idle)', 'info')], x: 'After 60 s idle, the <b>LB</b> closes the socket. It will never send on a socket it’s closing itself, so there’s no race.' },
      { t: 95.6, add: [m(0, 95.6, 'Node’s 65 s would fire here', 'info')], x: 'Node’s own timer would only have fired 5 s later. Rule: <b>the side that sends the next request must have the shorter idle timeout.</b> The same rule applies to a Node client calling a Node server.' }
    ] },
    pool: { label: 'Agent pool, maxSockets 2', unit: 'ms', tmax: 300, rows: ['socket 1', 'socket 2', 'agent.requests (queue)'], steps: [
      { t: 40, add: [s(0, 0, 40, 'hs'), s(1, 0, 40, 'hs'), s(2, 0, 40, 'slow'), m(2, 0, 'req 3, req 4 wait', 'info')], x: 'Four concurrent calls through <code>new Agent({ keepAlive: true, maxSockets: 2 })</code>. Two sockets open (handshakes); requests 3 and 4 wait in <code>agent.requests</code>.' },
      { t: 130, add: [s(0, 40, 130, 'act'), s(2, 40, 130, 'slow'), m(0, 130, 'req 1 done → req 3', 'ok')], x: 'Request 1 finishes. Its socket is handed straight to request 3, which skips the handshake. Request 4 still waits: its latency includes queue time, which looks like a slow upstream.' },
      { t: 160, add: [s(1, 40, 160, 'act'), s(0, 130, 220, 'act'), s(2, 130, 160, 'slow'), m(1, 160, 'req 2 done → req 4', 'ok')], x: 'Request 2 finishes and request 4 gets socket 2. The queue is empty.' },
      { t: 300, add: [s(1, 160, 260, 'act'), s(0, 220, 300, 'idle'), s(1, 260, 300, 'idle')], x: 'Both sockets go back to the free list (up to <code>maxFreeSockets</code>, 256). The next call reuses the most recently used one (<code>scheduling: \'lifo\'</code>). Keep the agent’s idle time <b>below the server’s</b> <code>keepAliveTimeout</code>, or you get the 502 race in reverse: <code>ECONNRESET</code>.' }
    ] },
    slow: { label: 'Slowloris vs headersTimeout', unit: 's', tmax: 100, rows: ['attacker socket: 1 header byte every few s', 'normal client'], steps: [
      { t: 25, add: [s(0, 0, 25, 'slow'), s(1, 10, 11, 'act')], x: 'An attacker opens a socket and trickles header bytes. The request never completes, so the socket and its parser state stay allocated. Normal requests still work: nothing is blocking the event loop.' },
      { t: 60, add: [s(0, 25, 60, 'slow'), s(1, 40, 41, 'act'), m(0, 60, 'headersTimeout (60 s) reached', 'info')], x: 'Node 18+ allows <b>60 s</b> for the headers (<code>headersTimeout</code>) and <b>300 s</b> for the whole request (<code>requestTimeout</code>).' },
      { t: 75, add: [s(0, 60, 75, 'slow'), s(1, 70, 71, 'act'), m(0, 75, '408 + close', 'bad')], x: 'The checks run every <code>connectionsCheckingInterval</code> (<b>30 s</b>), so the socket is cut somewhere between 60 and 90 s: Node replies <b>408 Request Timeout</b> and destroys it. Thousands of such sockets would exhaust file descriptors first, which is why a buffering proxy (nginx, an ALB) in front is the real defence.' }
    ] },
    h2: { label: 'HTTP/2: streams on one connection', unit: 'ms', tmax: 400, rows: ['TCP + TLS connection', 'stream 1: GET /a', 'stream 3: GET /b', 'stream 5: POST /c'], steps: [
      { t: 60, add: [s(0, 0, 60, 'hs')], x: 'One TCP + TLS handshake. ALPN negotiates <code>h2</code>. Browsers only use HTTP/2 over TLS; Node can also speak cleartext h2c.' },
      { t: 250, add: [s(0, 60, 250, 'act'), s(1, 60, 200, 'act'), s(2, 65, 250, 'act'), s(3, 70, 250, 'act'), m(1, 200, 'done', 'ok')], x: 'Three requests run <b>at the same time</b> as independent streams (odd ids: client-initiated). No second socket, and a slow response doesn’t block the others at the HTTP level.' },
      { t: 290, add: [s(0, 250, 290, 'slow'), s(2, 250, 290, 'slow'), s(3, 250, 290, 'slow'), m(0, 250, 'packet lost', 'bad')], x: 'One TCP packet is lost. TCP delivers bytes in order, so <b>every</b> stream waits for the retransmission: TCP head-of-line blocking. HTTP/3 (QUIC) removes it; Node 22 has no built-in HTTP/3.' },
      { t: 380, add: [s(0, 290, 380, 'act'), s(2, 290, 320, 'act'), s(3, 290, 380, 'act'), m(2, 320, 'done', 'ok'), m(3, 380, 'done', 'ok')], x: 'Streams finish. Server side, use <code>node:http2</code> (or Fastify’s <code>http2: true</code>). Note that Node’s <code>fetch</code> (undici) speaks HTTP/1.1 unless you opt in to its <code>allowH2</code> option.' }
    ] }
  };
  let sc = 'race'; let gen = 0; let running = false; let speed = 2600; let k = 0;
  const seg = (opts, get, set, label) => { const e = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...e.children].forEach((x) => x.classList.toggle('on', x === b)); }); e.append(b); }); return e; };
  const segSc = seg(Object.entries(SC).map(([key, v]) => [key, v.label]), () => sc, (v) => { sc = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 600; const X0 = 16; const X1 = W - 16; const RH = 64; const TOP = 34;
  const stage = svg('svg', { role: 'img', 'aria-label': 'Socket timelines: one row per socket, time to the right' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-hi');
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function draw() {
    const S = SC[sc]; const H = TOP + S.rows.length * RH + 30;
    stage.setAttribute('viewBox', `0 0 ${W} ${H}`); stage.innerHTML = '';
    const X = (t) => X0 + (t / S.tmax) * (X1 - X0);
    stage.append(svg('defs', null, svg('pattern', { id: 'w-hi-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      svg('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'var(--text-3)', 'stroke-width': 2 }))));
    S.rows.forEach((r, i) => { const y = TOP + i * RH;
      stage.append(svg('text', { class: 'rl', x: X0, y: y - 8, text: r }), svg('rect', { class: 'track', x: X0, y, width: X1 - X0, height: 18, rx: 4 })); });
    const ay = TOP + S.rows.length * RH; stage.append(svg('line', { class: 'axis', x1: X0, x2: X1, y1: ay, y2: ay }));
    for (let j = 0; j <= 4; j++) { const t = (S.tmax * j) / 4; stage.append(svg('text', { class: 'tick', x: X(t), y: ay + 16, 'text-anchor': j === 0 ? 'start' : j === 4 ? 'end' : 'middle', text: (Math.round(t * 10) / 10) + ' ' + S.unit })); }
    const steps = S.steps.slice(0, k);
    steps.forEach((st, si) => st.add.forEach((a) => {
      const y = TOP + a.r * RH; const cls = si === k - 1 && !reduced ? ' fade' : '';
      if (a.m) {
        const x = X(a.t); const right = x > W * 0.62;
        stage.append(svg('line', { class: 'm-' + a.k + cls, x1: x, x2: x, y1: y - 3, y2: y + 26, 'stroke-width': 2.5 }),
          svg('text', { class: 'ml ' + a.k + cls, x: right ? x - 4 : x + 4, y: y + 36 + a.dy, 'text-anchor': right ? 'end' : 'start', text: a.l.trim() }));
      } else {
        const x = X(a.a); const w = Math.max(2, X(a.b) - x);
        stage.append(svg('rect', { class: 's-' + a.k + cls, x, y: y + 2, width: w, height: 14, rx: 2 }));
      }
    }));
    if (k > 0) { const x = X(S.steps[k - 1].t); stage.append(svg('line', { class: 'now', x1: x, x2: x, y1: TOP - 4, y2: ay })); }
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `t = <b>${k ? S.steps[k - 1].t : 0} ${S.unit}</b>` }), el('span', { class: 'w-stat', html: `step <b>${k}</b>/${S.steps.length}` }));
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; draw();
    say({ race: 'An AWS-style load balancer with a 60 s idle timeout in front of Node with its default 5 s <code>keepAliveTimeout</code>. Press Play.',
      lb: 'Same setup, but Node’s <code>keepAliveTimeout</code> is 65 s. Press Play.',
      pool: 'A Node client calling one upstream through a keep-alive agent capped at 2 sockets. Press Play.',
      slow: 'A slowloris client against a Node 22 server with default timeouts. Press Play.',
      h2: 'Three requests over one HTTP/2 connection. Press Play.' }[sc]);
  }
  function step() { const S = SC[sc]; if (k >= S.steps.length) return false; k++; draw(); say(S.steps[k - 1].x); if (k >= S.steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { while (step()); return; }
    if (k >= SC[sc].steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
