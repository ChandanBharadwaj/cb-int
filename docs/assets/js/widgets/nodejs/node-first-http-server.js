/* Your first HTTP server: a request through the http module, an Express middleware chain, and config from env vars. */
IA.widget('node-first-http-server', (root, ctx) => {
  /* ---- shared step-through player (code on the left, state picture on the right) ---- */
  const { el, svg, sleep, reduced } = ctx;
  function stepper(cfg) {
    const uid = 'nb' + Math.random().toString(36).slice(2, 8);
    if (!document.getElementById('w-nb-style')) {
      document.head.append(el('style', { id: 'w-nb-style', text: `
.w-nb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; align-items: start; }
.w-nb-code pre { margin: 0; }
.w-nb-code .ln { display: block; padding: 0 6px; border-left: 3px solid transparent; border-radius: 3px; white-space: pre; }
.w-nb-code .ln.cur { background: var(--accent-soft); border-left-color: var(--accent); }
.w-nb-code .ln.done { opacity: .55; }
.w-nb .bx { fill: var(--surface); stroke: var(--border); }
.w-nb .bx.hot { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; }
.w-nb .bx.ok { stroke: var(--ok); stroke-width: 2; }
.w-nb .bx.err { stroke: var(--err); stroke-width: 2; fill: color-mix(in srgb, var(--err) 10%, var(--surface)); }
.w-nb .bx.warn { stroke: var(--warn); stroke-width: 2; }
.w-nb .bx.dim { opacity: .45; }
.w-nb .bx.lane { fill: var(--surface-2); }
.w-nb .tt { fill: var(--text); font-size: 13px; font-family: var(--mono); }
.w-nb .tt.h { font-family: var(--sans); font-weight: 700; font-size: 13px; }
.w-nb .tt.m { fill: var(--text-3); font-size: 11px; font-family: var(--sans); }
.w-nb .tt.ok { fill: var(--ok); } .w-nb .tt.err { fill: var(--err); } .w-nb .tt.acc { fill: var(--accent); } .w-nb .tt.warn { fill: var(--warn); }
.w-nb .ar { stroke: var(--text-3); stroke-width: 1.6; fill: none; }
.w-nb .ar.hot { stroke: var(--accent); stroke-width: 2.2; }
.w-nb .fresh { animation: nbIn .45s ease both; }
@keyframes nbIn { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .w-nb .fresh { animation: none; } }
` }));
    }
    root.classList.add('w-nb');
    const modes = cfg.modes;
    let mi = 0; let k = 0; let gen = 0; let running = false; let speed = 2600;
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': cfg.modeLabel || 'Example' });
    modes.forEach((m, i) => { const b = el('button', { text: m.label, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { mi = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); seg.append(b); });
    const pre = el('pre'); const codeHost = el('div', { class: 'codebox w-nb-code' }, el('div', { class: 'ch' }, el('span', { class: 'fname' })), pre);
    const W = cfg.W || 420, H = cfg.H || 300;
    const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.aria || 'Step-by-step picture of the program state' });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: 'Press Play, or Step to go one line at a time.' }));
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const segS = el('div', { class: 'seg', 'aria-label': 'Speed' });
    [['Slow', 3800], ['Normal', 2600], ['Fast', 1300]].forEach(([l, v]) => { const b = el('button', { text: l, class: v === speed ? 'on' : '' }); b.addEventListener('click', () => { speed = v; [...segS.children].forEach((x) => x.classList.toggle('on', x === b)); }); segS.append(b); });
    root.append(modes.length > 1 ? el('div', { class: 'w-controls' }, seg) : '',
      el('div', { class: 'w-nb-grid' }, codeHost, el('div', { class: 'w-stage' }, stage)),
      el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
    // drawing helpers handed to cfg.draw
    const defs = svg('defs', null, svg('marker', { id: uid + 'a', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--text-3)' })),
      svg('marker', { id: uid + 'h', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--accent)' })));
    const D = {
      box: (x, y, w, h, cls, fresh) => svg('rect', { x, y, width: w, height: h, rx: 7, class: 'bx ' + (cls || '') + (fresh ? ' fresh' : '') }),
      t: (x, y, s, cls, anchor, fresh) => svg('text', { x, y, class: 'tt ' + (cls || '') + (fresh ? ' fresh' : ''), 'text-anchor': anchor || 'start', text: String(s) }),
      ar: (x1, y1, x2, y2, hot, curve) => svg('path', { d: curve ? `M${x1},${y1} C${x1 + curve},${y1} ${x2 + curve},${y2} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`, class: 'ar' + (hot ? ' hot' : ''), 'marker-end': `url(#${uid}${hot ? 'h' : 'a'})` }),
      W, H
    };
    let lineEls = [];
    function renderCode() {
      const m = modes[mi]; pre.innerHTML = '';
      codeHost.querySelector('.fname').textContent = m.file || 'example.js';
      lineEls = m.code.split('\n').map((ln) => { const s = el('span', { class: 'ln' }); s.innerHTML = IA.highlight(ln || ' ', m.lang || 'js'); pre.append(s); return s; });
    }
    function show(i) {
      const m = modes[mi]; const st = m.steps[i];
      lineEls.forEach((l, j) => { const cur = st && [].concat(st.line == null ? [] : st.line).includes(j + 1); l.classList.toggle('cur', cur); });
      stage.innerHTML = ''; stage.append(defs);
      const g = svg('g'); stage.append(g);
      cfg.draw(g, st || null, D, i, m);
      narr.className = 'caption' + (st && st.tone ? ' ' + st.tone : '');
      narr.firstChild.textContent = st ? `${i + 1}/${m.steps.length}` : '0';
      narr.lastChild.innerHTML = st ? st.cap : (m.intro || 'Press Play, or Step to go one line at a time.');
    }
    function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; renderCode(); if (reduced) { k = modes[mi].steps.length; show(k - 1); } else show(-1); }
    function step() { const n = modes[mi].steps.length; if (k >= n) return false; show(k); k++; return k < n; }
    async function play() {
      if (running) { gen++; running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= modes[mi].steps.length) reset();
      if (reduced) { k = modes[mi].steps.length; show(k - 1); return; }
      const g = ++gen; running = true; bPlay.textContent = '❚❚ Pause';
      while (g === gen && step()) { await sleep(speed); }
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    }
    bPlay.addEventListener('click', play);
    bStep.addEventListener('click', () => { gen++; running = false; bPlay.textContent = '▶ Play'; if (k >= modes[mi].steps.length) reset(); step(); });
    bReset.addEventListener('click', reset);
    reset();
  }
  // nodes: [label, sub]; at: index of the active node; cls: per-node override; req/res: text lines
  const NA = [['client', 'curl :3000/users/7'], ['http.createServer(cb)', 'one cb per request'], ['route: method + url', 'if / switch'], ['res.writeHead + end', 'status, headers, body']];
  const sA = [
    { line: [1, 2], cap: '<code>http.createServer</code> takes <b>one function</b> that Node calls for every request, with a request object (<code>req</code>) and a response object (<code>res</code>).', nodes: NA, at: 1, req: [], res: [] },
    { line: 12, cap: '<code>listen(port)</code> opens the socket. The process now stays alive, waiting for connections. Nothing runs between requests.', nodes: NA, at: 1, req: [], res: [], extra: 'listening on :3000' },
    { line: 2, cap: 'A request arrives. The callback runs with <code>req.method</code> and <code>req.url</code> filled in. Headers are parsed; the body hasn’t been read yet.', nodes: NA, at: 0, flow: [0, 1], req: ['GET /users/7', 'host: localhost:3000', 'accept: */*'], res: [] },
    { line: [3, 4, 5], cap: 'There is no router: you inspect method and URL yourself. A regex extracts the id.', nodes: NA, at: 2, flow: [1, 2], req: ['GET /users/7', "match → id = '7'"], res: [] },
    { line: [5, 6, 7], cap: 'Set the status and <code>content-type</code>, then send a JSON string with <code>res.end</code>. Forget <code>end</code> and the client hangs until it times out.', tone: 'ok', nodes: NA, at: 3, flow: [2, 3], req: ['GET /users/7'], res: ['200 OK', 'content-type: application/json', '{"id":7,"name":"Ada"}'] },
    { line: [9, 10], cap: 'Anything else falls through to a 404. With the raw module, every edge case (body parsing, errors, CORS) is yours to write. That is why frameworks exist.', tone: 'warn', nodes: NA, at: 3, cls: { 3: 'warn' }, flow: [2, 3], req: ['GET /nope'], res: ['404 Not Found', '{"error":"not found"}'] }
  ];
  const NB = [['express.json()', 'parse JSON body'], ['logger', 'next()'], ["GET /users/:id", 'req.params.id'], ['POST /users', 'req.body'], ['404 fallback', 'no route matched']];
  const sB = [
    { line: [1, 2], cap: '<b>Express</b> (v5 is current; v4 is still very common) wraps the http module. <code>app.use</code> adds <b>middleware</b>: functions that run in order for every request, like servlet filters.', nodes: NB, at: 0, req: [], res: [] },
    { line: [3, 4, 5, 6], cap: 'A request <code>POST /users</code> with a JSON body enters the chain. <code>express.json()</code> parses it into <code>req.body</code>; then the logger calls <code>next()</code> to pass control on.', nodes: NB, at: 1, flow: [0, 1], req: ['POST /users', '{"name":"Bob"}', 'req.body = { name: \'Bob\' }'], res: [] },
    { line: 7, cap: 'Routes are matched in order by method <b>and</b> path. <code>GET /users/:id</code> doesn’t match a POST, so it is skipped.', nodes: NB, at: 2, cls: { 2: 'dim' }, req: ['POST /users'], res: [] },
    { line: [10, 11, 12], cap: '<code>POST /users</code> matches. <code>res.status(201).json(…)</code> sets the status, the content-type header and serialises the body in one go.', tone: 'ok', nodes: NB, at: 3, cls: { 2: 'dim' }, flow: [1, 3], req: ['POST /users', "req.body.name = 'Bob'"], res: ['201 Created', 'content-type: application/json', '{"id":8,"name":"Bob"}'] },
    { line: [7, 8, 9], cap: 'A <code>GET /users/7</code> takes the other route. <code>:id</code> becomes <code>req.params.id</code>, always a <b>string</b> (<code>\'7\'</code>).', tone: 'ok', nodes: NB, at: 2, cls: { 3: 'dim' }, flow: [1, 2], req: ['GET /users/7', "req.params.id = '7'"], res: ['200 OK', '{"id":7,"name":"Ada"}'] },
    { line: 13, cap: 'If no route sent a response, the request reaches the last middleware, which answers 404. Express also has a built-in default 404.', tone: 'warn', nodes: NB, at: 4, cls: { 2: 'dim', 3: 'dim', 4: 'warn' }, flow: [1, 4], req: ['GET /nope'], res: ['404 Not Found', '{"error":"not found"}'] }
  ];
  const NC = [['shell / container', 'PORT=8080 node app.js'], ['process.env', "{ PORT: '8080', … }"], ['Number(…) ?? default', 'parse + validate'], ['server.listen(port)', 'bound to :8080']];
  const sC = [
    { line: 1, cap: 'Configuration comes from <b>environment variables</b>: set by the shell, Docker, Kubernetes or a cloud platform. Like Spring reading <code>SERVER_PORT</code>.', nodes: NC, at: 0, req: ['$ PORT=8080 node app.js'], res: [] },
    { line: 1, cap: '<code>process.env</code> is a plain object of <b>strings</b>. A missing variable is <code>undefined</code>, so <code>?? 3000</code> gives a default.', nodes: NC, at: 1, flow: [0, 1], req: ["process.env.PORT → '8080'", "typeof → 'string'"], res: [] },
    { line: [2, 3], cap: 'Convert and validate at startup, and fail fast with a clear message. <code>\'false\'</code> is a truthy string: booleans need an explicit comparison.', tone: 'warn', nodes: NC, at: 2, flow: [1, 2], req: ['port = 8080 (number)', "DEBUG === 'true'"], res: [] },
    { line: 5, cap: 'Node 20.6+ can load a <code>.env</code> file itself: <code>node --env-file=.env app.js</code>. Never commit real secrets in it.', nodes: NC, at: 1, req: ['# .env', 'PORT=8080', 'DB_URL=postgres://…'], res: [] },
    { line: 4, cap: 'Listen on the configured port. Platforms like App Service, Cloud Run or Heroku tell you which port via <code>PORT</code>.', tone: 'ok', nodes: NC, at: 3, flow: [2, 3], req: [], res: ['listening on :8080'] }
  ];
  stepper({
    W: 420, H: 300, aria: 'Request pipeline on the left, request and response details on the right',
    modes: [
      { label: 'http module', file: 'server.js', code: "const http = require('node:http');\nconst server = http.createServer((req, res) => {\n  const m = req.url.match(/^\\/users\\/(\\d+)$/);\n  if (req.method === 'GET' && m) {\n    res.writeHead(200, { 'content-type': 'application/json' });\n    res.end(JSON.stringify({ id: Number(m[1]), name: 'Ada' }));\n    return;\n  }\n  res.writeHead(404, { 'content-type': 'application/json' });\n  res.end(JSON.stringify({ error: 'not found' }));\n});\nserver.listen(3000);", steps: sA },
      { label: 'Express', file: 'app.js', code: "const express = require('express');\nconst app = express();\napp.use(express.json());\napp.use((req, res, next) => {\n  console.log(req.method, req.url); next();\n});\napp.get('/users/:id', (req, res) => {\n  res.json({ id: Number(req.params.id), name: 'Ada' });\n});\napp.post('/users', (req, res) => {\n  res.status(201).json({ id: 8, name: req.body.name });\n});\napp.use((req, res) => res.status(404).json({ error: 'not found' }));\napp.listen(3000);", steps: sB },
      { label: 'env vars', file: 'app.js', code: "const port = Number(process.env.PORT ?? 3000);\nif (!Number.isInteger(port)) throw new Error('PORT must be a number');\nconst debug = process.env.DEBUG === 'true';\napp.listen(port, () => console.log(`listening on :${port}`));\n// run: node --env-file=.env app.js", steps: sC }
    ],
    draw(g, st, D) {
      g.append(D.box(6, 6, 200, 288, 'lane'), D.t(16, 26, 'pipeline', 'h'), D.box(216, 6, 198, 140, 'lane'), D.t(226, 26, 'request / input', 'h'), D.box(216, 154, 198, 140, 'lane'), D.t(226, 174, 'response / output', 'h'));
      if (!st) return;
      const n = st.nodes.length; const gap = n > 4 ? 52 : 64;
      st.nodes.forEach(([l, s], i) => {
        const y = 38 + i * gap; const c = (st.cls && st.cls[i]) || (i === st.at ? 'hot' : '');
        g.append(D.box(14, y, 184, 42, c, i === st.at), D.t(22, y + 18, l, ''), D.t(22, y + 34, s, 'm'));
        if (i > 0) g.append(D.ar(106, y - gap + 43, 106, y - 1, st.flow && st.flow[1] === i));
      });
      const clip = (s) => (s.length > 25 ? s.slice(0, 24) + '…' : s);
      st.req.forEach((r, i) => g.append(D.t(226, 48 + i * 22, clip(r), i === 0 ? 'acc' : '', 'start', true)));
      st.res.forEach((r, i) => g.append(D.t(226, 196 + i * 22, clip(r), i === 0 ? (/^[45]/.test(r) ? 'warn' : 'ok') : '', 'start', true)));
      if (st.extra) g.append(D.t(226, 48, st.extra, 'ok'));
    }
  });
});
