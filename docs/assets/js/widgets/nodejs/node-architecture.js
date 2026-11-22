/* Node architecture: follow one call down through lib → bindings → libuv (event loop or thread pool) → OS and back. */
IA.widget('node-architecture', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-na-style')) {
    document.head.append(el('style', { id: 'w-na-style', text: `
.w-na .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .3s, stroke .3s; }
.w-na .bx.hot { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2.5; }
.w-na .bx.bad { fill: color-mix(in srgb, var(--err) 14%, var(--surface)); stroke: var(--err); stroke-width: 2.5; }
.w-na .wk { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.5; transition: fill .3s, stroke .3s; }
.w-na .wk.busy { fill: color-mix(in srgb, var(--warn) 25%, var(--surface)); stroke: var(--warn); }
.w-na .wk.done { fill: color-mix(in srgb, var(--ok) 22%, var(--surface)); stroke: var(--ok); }
.w-na .lb { fill: var(--text); font-size: 16px; font-weight: 700; }
.w-na .sb { fill: var(--text-3); font-size: 13px; }
.w-na .tok { fill: var(--accent); transition: transform .9s cubic-bezier(.5,0,.3,1); }
.w-na .tok.red { fill: var(--err); }
.w-na .mt { fill: none; stroke: var(--accent-2); stroke-width: 2; stroke-dasharray: 6 5; }
` }));
  }
  const MODES = [
    ['read', 'fs.readFile'],
    ['net', 'https.get (socket)'],
    ['pool', 'crypto.pbkdf2 × 6'],
    ['block', 'JSON.parse(50 MB)']
  ];
  const CODE = {
    read: "fs.readFile('config.json', (err, data) => { … });",
    net: "https.get('https://api.example.com/rates', (res) => { … });",
    pool: "for (let i = 0; i < 6; i++)\n  crypto.pbkdf2(pw, salt, 600_000, 64, 'sha512', cb);",
    block: "app.post('/import', (req, res) => {\n  const rows = JSON.parse(req.body);   // 50 MB string\n});"
  };
  // positions (centres) the token can sit at
  const P = { js: [380, 37], lib: [380, 95], bind: [380, 153], v8: [200, 305], loop: [359, 290], os: [380, 385], w0: [486, 264], w1: [554, 264], w2: [622, 264], w3: [690, 264], q: [588, 318] };
  const S = {
    read: [
      { hi: ['js'], tok: 'js', main: 'running your JS', t: 'Your code calls <code>fs.readFile(…, cb)</code>. Nothing has been read yet.' },
      { hi: ['lib'], tok: 'lib', main: 'running your JS', t: '<code>lib/fs.js</code> (plain JavaScript inside Node) checks the arguments and makes a request object that holds <code>cb</code>.' },
      { hi: ['bind'], tok: 'bind', main: 'running your JS', t: 'A <b>C++ binding</b> turns the request into libuv calls (<code>uv_fs_open</code>, then fstat, read and close). The JS call returns straight away.' },
      { hi: ['uv'], tok: 'w0', w: ['busy'], main: 'free: runs other callbacks', t: 'Disk files have no portable non-blocking API, so libuv gives the blocking <code>open()</code>/<code>read()</code> to a <b>thread-pool worker</b>. The main thread is free.' },
      { hi: ['os'], tok: 'os', w: ['busy'], main: 'free: runs other callbacks', t: 'The worker thread waits inside the kernel while the disk read happens. Only that worker waits.' },
      { hi: ['loop'], tok: 'loop', w: ['done'], main: 'poll phase', t: 'The worker finishes and wakes the event loop. In the <b>poll</b> phase the loop picks up the finished request.' },
      { hi: ['js', 'bind'], tok: 'js', main: 'running cb', t: 'The binding calls into V8 and <code>cb(err, data)</code> runs on the <b>main thread</b>. All of your JavaScript runs there, one callback at a time.' }
    ],
    net: [
      { hi: ['js'], tok: 'js', main: 'running your JS', t: '<code>https.get(url, cb)</code> has to open a TCP connection, do TLS and read the response.' },
      { hi: ['lib', 'bind'], tok: 'bind', main: 'running your JS', t: '<code>lib/net.js</code> and the <code>TCPWrap</code> binding create a <b>non-blocking</b> socket. (The DNS step uses <code>dns.lookup</code>, which does run on the pool.)' },
      { hi: ['loop'], tok: 'loop', main: 'free', t: 'libuv registers the socket with the OS readiness API: <b>epoll</b> on Linux, kqueue on macOS, IOCP on Windows. <b>No pool thread is used</b>, so one thread can watch thousands of sockets.' },
      { hi: ['os'], tok: 'os', main: 'free', t: 'The kernel does the TCP handshake and buffers the incoming bytes. Nothing in Node is waiting on this connection.' },
      { hi: ['loop', 'os'], tok: 'loop', main: 'poll phase', t: 'Poll phase: epoll reports “socket readable”. libuv reads the bytes into a buffer without blocking.' },
      { hi: ['js'], tok: 'js', main: 'running cb', t: 'Node emits <code>\'data\'</code> on the response and your handler runs on the main thread. TLS decryption also happens on the main thread.' }
    ],
    pool: [
      { hi: ['js'], tok: 'js', main: 'running your JS', t: 'Six login requests each call <code>crypto.pbkdf2(…, cb)</code>. Say each hash needs about 100 ms of CPU.' },
      { hi: ['uv'], tok: 'q', w: ['busy', 'busy', 'busy', 'busy'], q: 2, main: 'free', t: 'The pool has <b>4 threads</b> by default (<code>UV_THREADPOOL_SIZE</code>). Four hashes start; <b>two wait in the queue</b>.' },
      { hi: ['uv'], tok: 'q', w: ['busy', 'busy', 'busy', 'busy'], q: 3, qNote: '+ fs.readFile', main: 'free', t: 'A request for a static file calls <code>fs.readFile</code>. It joins the <b>same queue</b>, behind the hashes. Slow crypto now slows file I/O.' },
      { hi: ['js', 'loop'], tok: 'js', w: ['busy', 'busy', 'busy', ''], q: 0, main: 'running 4 callbacks', t: 'The first four finish at about 100 ms. Their callbacks run one by one on the main thread. The queued two hashes and the file read take the free workers.' },
      { hi: ['js'], tok: 'js', w: ['done', 'done', 'done', ''], q: 0, main: 'running callbacks', t: 'The last hashes finish at about 200 ms: two rounds. Fixes: set <code>UV_THREADPOOL_SIZE</code> in the launch environment (max 1024), or run CPU work in <code>worker_threads</code>.' }
    ],
    block: [
      { hi: ['js', 'v8'], tok: 'v8', main: 'running JSON.parse', t: 'A handler calls <code>JSON.parse</code> on a 50 MB body. Parsing runs inside V8, on the <b>main thread</b>.' },
      { hi: ['v8'], bad: ['loop', 'js'], tok: 'v8', red: true, main: 'BLOCKED', t: 'While it parses (say 400 ms), the event loop can’t move on. Timers fire late, sockets aren’t read and health checks time out, for <b>every</b> request.' },
      { hi: [], bad: ['loop'], tok: 'v8', red: true, main: 'BLOCKED', t: 'The thread pool is idle. It only runs work that Node’s C++ code puts there (fs, dns.lookup, crypto, zlib). It can’t run your JavaScript.' },
      { hi: ['js'], tok: 'js', main: 'running your JS', t: 'Fixes: limit the body size, parse a stream, or parse in a <code>worker_threads</code> Worker, which has its own V8 isolate and event loop.' }
    ]
  };
  let mode = 'read'; let k = 0; let gen = 0; let running = false; let speed = 2400;
  const seg = (opts, cur, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); set(v); }); s.append(b); }); return s; };
  const segM = seg(MODES, mode, (v) => { mode = v; reset(); }, 'Scenario');
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const stage = svg('svg', { viewBox: '0 0 760 430', role: 'img', 'aria-label': 'Node layers: your JavaScript, core library, C++ bindings, V8 and libuv (event loop and thread pool), and the operating system' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-na');
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  const box = {}; const wk = []; let qText; let tok;
  function draw() {
    stage.innerHTML = '';
    const B = (id, x, y, w, h, lb, sb, ly) => {
      const r = svg('rect', { class: 'bx', x, y, width: w, height: h, rx: 10 }); box[id] = r;
      stage.append(r, svg('text', { class: 'lb', x: x + 14, y: y + (ly || 22), text: lb }), sb ? svg('text', { class: 'sb', x: x + 14, y: y + (ly || 22) + 18, text: sb }) : null);
    };
    B('js', 20, 14, 720, 46, 'Your JavaScript', null, 29);
    stage.append(svg('text', { class: 'sb', x: 250, y: 43, text: 'handlers, callbacks, business logic' }));
    B('lib', 20, 72, 720, 46, 'Node core library', null, 29);
    stage.append(svg('text', { class: 'sb', x: 250, y: 101, text: 'lib/*.js: fs, net, http, crypto, timers' }));
    B('bind', 20, 130, 720, 46, 'C++ bindings', null, 29);
    stage.append(svg('text', { class: 'sb', x: 250, y: 159, text: 'internalBinding(…), Node-API addons' }));
    B('v8', 20, 190, 230, 150, 'V8', 'parse · JIT · heap · GC');
    stage.append(svg('text', { class: 'sb', x: 34, y: 262, text: 'runs JS on the' }), svg('text', { class: 'sb', x: 34, y: 280, text: 'main thread' }));
    B('uv', 262, 190, 478, 150, 'libuv', null);
    B('loop', 274, 222, 170, 106, 'event loop', 'timers · poll · check', 24);
    stage.append(svg('text', { class: 'sb', x: 288, y: 300, text: 'main thread' }));
    stage.append(svg('text', { class: 'sb', x: 456, y: 236, text: 'thread pool (default 4)' }));
    for (let i = 0; i < 4; i++) {
      const r = svg('rect', { class: 'wk', x: 456 + i * 68, y: 244, width: 60, height: 40, rx: 8 }); wk[i] = r;
      stage.append(r, svg('text', { class: 'sb', x: 474 + i * 68, y: 269, text: 'T' + (i + 1) }));
    }
    qText = svg('text', { class: 'sb', x: 456, y: 316, text: 'queue: empty' }); stage.append(qText);
    B('os', 20, 356, 720, 58, 'Operating system', 'epoll (Linux) · kqueue (macOS) · IOCP (Windows) · disks · CPU cores');
    // main-thread outline: JS + lib + bindings + V8 + loop all run on one thread
    stage.append(svg('path', { class: 'mt', d: 'M14 8 H746 V182 H450 V334 H14 Z' }));
    stage.append(svg('text', { x: 600, y: 352, 'font-size': 12, fill: 'var(--accent-2)', text: '- - main thread' }));
    tok = svg('circle', { class: 'tok', r: 10, cx: 0, cy: 0 }); stage.append(tok);
  }
  function apply(s) {
    Object.values(box).forEach((r) => r.setAttribute('class', 'bx'));
    (s.hi || []).forEach((id) => box[id] && box[id].setAttribute('class', 'bx hot'));
    (s.bad || []).forEach((id) => box[id] && box[id].setAttribute('class', 'bx bad'));
    wk.forEach((r, i) => { const st = (s.w || [])[i]; r.setAttribute('class', 'wk' + (st ? ' ' + st : '')); });
    qText.textContent = s.q ? 'queue: ' + '●'.repeat(Math.min(s.q, 2)) + (s.q > 2 ? ' + fs.readFile' : '') + `  (${s.q} waiting)` : 'queue: empty';
    const [x, y] = P[s.tok] || P.js;
    tok.style.transform = `translate(${x}px, ${y}px)`; tok.style.transition = reduced ? 'none' : '';
    tok.setAttribute('class', 'tok' + (s.red ? ' red' : ''));
    narr.firstChild.innerHTML = s.t;
    stats.innerHTML = '';
    const busy = wk.filter((r) => r.getAttribute('class').includes('busy')).length;
    stats.append(el('span', { class: 'w-stat', html: `main thread <b>${s.main}</b>` }), el('span', { class: 'w-stat', html: `pool busy <b>${busy}/4</b>` }), el('span', { class: 'w-stat', html: `step <b>${k}/${S[mode].length}</b>` }));
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; draw();
    codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(CODE[mode], 'js') }));
    apply({ hi: [], tok: 'js', main: 'idle', t: 'Pick a call, then press Play or Step to follow it through the layers. The dashed outline is everything that runs on the main thread.' });
    bStep.disabled = false;
  }
  function step() { const st = S[mode]; if (k >= st.length) return false; k++; apply(st[k - 1]); if (k >= st.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= S[mode].length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
