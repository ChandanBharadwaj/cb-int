/* Virtual threads: mounting and unmounting on two carrier threads, pinning on JDK 21 vs JDK 24+, and a structured-concurrency scope that cancels a sibling. */
IA.widget('virtual-threads', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'mount'; let jdk = 21; let gen = 0; let running = false; let speed = 2600; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['mount', 'mount & unmount'], ['pin', 'pinning'], ['scope', 'structured concurrency']], () => mode, (v) => { mode = v; reset(); }, 'Scenario');
  const segJ = seg([[21, 'JDK 21–23'], [24, 'JDK 24+ (JEP 491)']], () => jdk, (v) => { jdk = v; reset(); }, 'JDK version');
  const jdkRow = el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'behaviour of' }), segJ);
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 350;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Two carrier threads at the top, the scheduler run queue and I/O poller in the middle, parked virtual threads at the bottom' });
  const zonesG = svg('g'); const chipsG = svg('g'); const topG = svg('g'); stage.append(zonesG, chipsG, topG);
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), jdkRow, codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const code = (src) => { codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(src, 'java') })); };
  const R = (x, y, w, h, o = {}) => svg('rect', { x, y, width: w, height: h, rx: o.rx == null ? 8 : o.rx, fill: o.fill || 'var(--surface)', stroke: o.stroke || 'var(--border)', 'stroke-width': o.sw || 1, 'stroke-dasharray': o.dash || null });
  const T = (x, y, s, o = {}) => svg('text', { x, y, 'font-size': o.fs || 12, 'font-weight': o.fw || null, 'text-anchor': o.a || 'start', 'font-family': o.mono ? 'var(--mono)' : null, fill: o.fill || 'var(--text)', text: s });
  const CW = 54, CH = 26;
  let S; const chips = {};
  function chip(name) {
    if (chips[name]) return chips[name];
    const g = svg('g', { style: reduced ? '' : 'transition: transform .7s ease, opacity .4s' });
    const r = R(0, 0, CW, CH, { rx: 7 });
    const t = T(CW / 2, 17, name, { a: 'middle', mono: true, fs: 12, fw: 700 });
    const fr = svg('g'); for (let i = 0; i < 3; i++) fr.append(svg('rect', { x: CW + 3, y: 3 + i * 7, width: 9, height: 5, rx: 1, fill: 'var(--text-3)' }));
    g.append(r, t, fr); chipsG.append(g); chips[name] = { g, r, t, fr }; return chips[name];
  }

  /* ---------- carriers / queue / parked ---------- */
  function renderVT() {
    zonesG.innerHTML = ''; topG.innerHTML = '';
    zonesG.append(T(16, 20, 'carrier threads: ForkJoinPool, parallelism 2 (= cores)', { fw: 700, fs: 12.5 }));
    [0, 1].forEach((c) => {
      const x = 16 + c * 374; const pinned = S.pinned[c]; const who = S.car[c];
      zonesG.append(R(x, 30, 354, 96, { fill: 'var(--surface-2)', stroke: pinned ? 'var(--err)' : who ? 'var(--accent)' : 'var(--border)', sw: pinned || who ? 2 : 1 }));
      zonesG.append(T(x + 10, 48, `ForkJoinPool-1-worker-${c + 1}`, { mono: true, fs: 11.5, fw: 600 }));
      zonesG.append(T(x + 10, 64, '(a platform / OS thread)', { fs: 10.5, fill: 'var(--text-3)' }));
      zonesG.append(T(x + 344, 48, pinned ? 'PINNED: OS thread blocked' : who ? 'running ' + who : 'idle: looking for work', { a: 'end', fs: 11, fw: 700, fill: pinned ? 'var(--err)' : who ? 'var(--accent)' : 'var(--text-3)' }));
      if (S.carNote[c]) zonesG.append(T(x + 344, 116, S.carNote[c], { a: 'end', fs: 10.5, fill: pinned ? 'var(--err)' : 'var(--text-2)' }));
    });
    zonesG.append(T(16, 152, 'scheduler run queue (runnable, unmounted)', { fs: 11.5, fw: 700, fill: 'var(--text-2)' }));
    zonesG.append(R(16, 160, 470, 44, { fill: 'none', dash: '5 4' }));
    zonesG.append(T(502, 152, 'I/O poller & timers', { fs: 11.5, fw: 700, fill: 'var(--text-2)' }));
    zonesG.append(R(502, 160, 242, 44, { fill: 'none', dash: '5 4' }));
    (S.poll || []).forEach((p, i) => zonesG.append(T(512, 178 + i * 14, p, { mono: true, fs: 10.5, fill: 'var(--text-2)' })));
    zonesG.append(T(16, 230, 'parked: frames saved to the heap (stack chunks)', { fs: 11.5, fw: 700, fill: 'var(--text-2)' }));
    zonesG.append(R(16, 238, 470, 70, { fill: 'none', dash: '5 4' }));
    zonesG.append(T(502, 230, 'finished', { fs: 11.5, fw: 700, fill: 'var(--text-2)' }));
    zonesG.append(R(502, 238, 242, 70, { fill: 'none', dash: '5 4' }));
    const seen = new Set();
    const place = (name, x, y, kind) => {
      seen.add(name); const c = chip(name); c.g.setAttribute('transform', `translate(${x},${y})`); c.g.style.opacity = '1';
      const pin = kind === 'car' && S.pinned[S.car.indexOf(name)];
      const col = kind === 'car' ? (pin ? ['var(--surface)', 'var(--err)', 'var(--err)'] : ['var(--accent-soft)', 'var(--accent)', 'var(--accent)']) : kind === 'done' ? ['var(--surface)', 'var(--ok)', 'var(--ok)'] : kind === 'park' ? ['var(--surface)', 'var(--text-3)', 'var(--text-2)'] : ['var(--surface)', 'var(--warn)', 'var(--text)'];
      c.r.setAttribute('fill', col[0]); c.r.setAttribute('stroke', S.hot === name ? 'var(--accent)' : col[1]); c.r.setAttribute('stroke-width', S.hot === name ? 2.5 : 1.5); c.t.setAttribute('fill', col[2]);
      c.fr.style.opacity = kind === 'done' ? '0' : '1';
      c.fr.querySelectorAll('rect').forEach((b) => b.setAttribute('fill', kind === 'car' ? 'var(--accent)' : 'var(--text-3)'));
    };
    S.car.forEach((n, c) => { if (n) { place(n, 16 + c * 374 + 150, 72, 'car'); topG.append(T(16 + c * 374 + 150 + CW + 16, 85, 'frames on carrier stack', { fs: 10, fill: 'var(--text-3)' })); } });
    S.queue.forEach((n, i) => place(n, 26 + i * 76, 169, 'q'));
    S.parked.forEach(([n, why], i) => { const x = 26 + (i % 5) * 92, y = 248 + Math.floor(i / 5) * 32; place(n, x, y, 'park'); topG.append(T(x + CW / 2 + 6, y + CH + 11, why, { a: 'middle', fs: 9.5, fill: 'var(--text-3)' })); });
    S.done.forEach((n, i) => place(n, 512 + (i % 3) * 76, 250 + Math.floor(i / 3) * 30, 'done'));
    Object.keys(chips).forEach((n) => { if (!seen.has(n)) chips[n].g.style.opacity = '0'; });
    if (S.banner) topG.append(T(W - 16, H - 10, S.banner, { a: 'end', fs: 12.5, fw: 700, fill: S.bannerC || 'var(--text)' }));
  }
  /* ---------- structured scope ---------- */
  function renderScope() {
    zonesG.innerHTML = ''; topG.innerHTML = '';
    Object.keys(chips).forEach((n) => { chips[n].g.style.opacity = '0'; });
    const sc = S.scope;
    zonesG.append(R(150, 24, 460, 70, { fill: 'var(--surface-2)', stroke: sc.state === 'shutdown' ? 'var(--err)' : sc.state === 'closed' ? 'var(--ok)' : 'var(--accent)', sw: 2 }));
    zonesG.append(T(380, 46, 'StructuredTaskScope.ShutdownOnFailure', { a: 'middle', mono: true, fs: 12.5, fw: 700 }));
    zonesG.append(T(380, 66, 'owner: request thread (virtual) · ' + sc.owner, { a: 'middle', fs: 11.5, fill: 'var(--text-2)' }));
    zonesG.append(T(380, 84, 'scope state: ' + sc.state, { a: 'middle', fs: 11.5, fw: 700, fill: sc.state === 'shutdown' ? 'var(--err)' : sc.state === 'closed' ? 'var(--ok)' : 'var(--accent)' }));
    sc.kids.forEach((kd, i) => {
      const x = 80 + i * 340, y = 150;
      zonesG.append(svg('line', { x1: 380, y1: 94, x2: x + 130, y2: y, stroke: kd.st === 'cancelled' || kd.st === 'failed' ? 'var(--err)' : 'var(--border)', 'stroke-width': 1.5, 'stroke-dasharray': kd.st === 'pending' ? '4 4' : null }));
      const col = { pending: 'var(--border)', running: 'var(--accent)', done: 'var(--ok)', failed: 'var(--err)', cancelled: 'var(--warn)' }[kd.st];
      zonesG.append(R(x, y, 260, 92, { fill: kd.st === 'running' ? 'var(--accent-soft)' : 'var(--surface)', stroke: col, sw: 2, dash: kd.st === 'pending' ? '5 4' : null }));
      zonesG.append(T(x + 12, y + 22, kd.name, { mono: true, fs: 12.5, fw: 700 }));
      zonesG.append(T(x + 12, y + 40, 'subtask on its own virtual thread', { fs: 10.5, fill: 'var(--text-3)' }));
      zonesG.append(R(x + 12, y + 52, 236, 12, { rx: 6, fill: 'var(--surface-2)' }));
      zonesG.append(R(x + 12, y + 52, 236 * kd.p, 12, { rx: 6, fill: col, stroke: 'none' }));
      zonesG.append(T(x + 12, y + 82, kd.note || kd.st, { fs: 11.5, fw: 600, fill: col === 'var(--border)' ? 'var(--text-3)' : col }));
    });
    if (S.leak) {
      zonesG.append(R(150, 266, 460, 40, { fill: 'none', dash: '5 4', stroke: 'var(--warn)' }));
      zonesG.append(T(380, 291, S.leak, { a: 'middle', fs: 11.5, fill: 'var(--warn)' }));
    }
    if (S.clock != null) topG.append(T(W - 14, 18, `t = ${S.clock} ms`, { a: 'end', mono: true, fs: 12.5, fw: 700, fill: 'var(--text-2)' }));
    if (S.banner) topG.append(T(W - 16, H - 10, S.banner, { a: 'end', fs: 12.5, fw: 700, fill: S.bannerC || 'var(--text)' }));
  }
  function render() { if (mode === 'scope') renderScope(); else renderVT(); statLine(); }
  function statLine() {
    stats.innerHTML = ''; const add = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    if (mode === 'scope') { add(`subtasks <b>${S.scope.kids.length}</b>`); add(`running <b>${S.scope.kids.filter((x) => x.st === 'running').length}</b>`); return; }
    add(`OS threads <b>2</b>`); add(`virtual threads alive <b>${S.car.filter(Boolean).length + S.queue.length + S.parked.length}</b>`);
    add(`mounted <b>${S.car.filter(Boolean).length}</b>`); add(`parked <b>${S.parked.length}</b>`); add(`pinned carriers <b>${S.pinned.filter(Boolean).length}</b>`);
  }
  // actions
  const mount = (c, n) => { S.queue = S.queue.filter((x) => x !== n); S.car[c] = n; S.hot = n; S.carNote[c] = ''; };
  const unmount = (c, why) => { const n = S.car[c]; S.car[c] = null; S.parked.push([n, why]); S.hot = n; S.carNote[c] = ''; };
  const unpark = (n) => { S.parked = S.parked.filter(([x]) => x !== n); S.queue.push(n); S.hot = n; };
  const finish = (c) => { const n = S.car[c]; S.car[c] = null; S.done.push(n); S.hot = n; S.carNote[c] = ''; };
  const P = (st, run, t) => st.push({ run, t });

  function plan() {
    const st = [];
    if (mode === 'mount') {
      code('try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {\n    for (int i = 1; i <= 6; i++) ex.submit(() -> handle(request));   // v1 … v6\n}\n// handle(): blocking socket reads, Thread.sleep, plain JDBC… on 2 carriers');
      P(st, () => { mount(0, 'v1'); mount(1, 'v2'); }, 'Six virtual threads start. They are just objects in the run queue. The scheduler <b>mounts</b> v1 on worker-1 and v2 on worker-2. Their frames now live on the carriers’ stacks.');
      P(st, () => { unmount(0, 'socket read'); S.poll = ['v1: fd 41 readable?']; }, 'v1 calls <code>socket.read()</code> and no bytes are ready. The JDK hands the socket to a watcher (the poller) and puts v1 to sleep (<b>parks</b> it). Its frames are copied to the heap, and worker-1 is <b>free</b>. No OS thread waits for the network.');
      P(st, () => { mount(0, 'v3'); }, 'worker-1 immediately mounts the next runnable thread, v3.');
      P(st, () => { unmount(1, 'sleep(100)'); S.poll = ['v1: fd 41 readable?', 'v2: timer +100 ms']; }, 'v2 calls <code>Thread.sleep(100)</code>. Same thing: it parks with a timer and unmounts.');
      P(st, () => { mount(1, 'v4'); }, 'worker-2 picks up v4.');
      P(st, () => { unpark('v1'); S.poll = ['v2: timer +100 ms']; }, 'The poller reports data on fd 41 and wakes (<b>unparks</b>) v1. It goes to the back of the run queue. Ready, but not running until a carrier is free.');
      P(st, () => { finish(1); mount(1, 'v5'); }, 'v4 finishes; worker-2 mounts v5.');
      P(st, () => { finish(0); mount(0, 'v6'); }, 'v3 finishes; worker-1 mounts v6.');
      P(st, () => { finish(1); mount(1, 'v1'); S.carNote[1] = 'v1 resumed here (it started on worker-1)'; }, 'v5 finishes and worker-2 mounts <b>v1</b>. v1’s frames are copied back and <code>read()</code> returns its bytes. It started on worker-1 and resumes on worker-2. A virtual thread isn’t tied to one carrier. So never rely on which carrier you are on.');
      P(st, () => { unpark('v2'); S.poll = []; }, 'v2’s timer fires; it becomes runnable.');
      P(st, () => { finish(0); mount(0, 'v2'); S.banner = '6 blocking tasks, 2 OS threads, no callbacks'; S.bannerC = 'var(--ok)'; }, 'v6 finishes. v2 resumes on worker-1. Six “blocking” tasks ran on two OS threads. While parked, each cost only its stack on the heap: a few KB. A platform thread reserves far more (often 1 MB).');
    } else if (mode === 'pin') {
      code(jdk === 21
        ? '// Java 21: blocking inside synchronized pins the carrier\nsynchronized (lock) {\n    return soapClient.call(req);   // 800 ms network round-trip\n}'
        : '// JDK 24+ (JEP 491): the same code no longer pins\nsynchronized (lock) {\n    return soapClient.call(req);   // virtual thread unmounts while holding the monitor\n}');
      P(st, () => { mount(0, 'v1'); mount(1, 'v2'); }, 'v1 and v2 are mounted; v3–v6 wait in the run queue.');
      if (jdk === 21) {
        P(st, () => { S.pinned[0] = true; S.carNote[0] = 'v1 holds monitor and waits on the network'; S.poll = ['v1: fd 52 readable?']; S.hot = 'v1'; }, 'v1 enters <code>synchronized (lock)</code> and makes an 800 ms HTTP call. On Java 21 the monitor is tied to the carrier, so v1 <b>can’t unmount</b>. It is <b>pinned</b>, and worker-1’s OS thread sits stuck in the kernel.');
        P(st, () => { S.pinned[1] = true; S.carNote[1] = 'v2 blocked entering the monitor'; S.hot = 'v2'; }, 'v2 reaches the same <code>synchronized (lock)</code>. Waiting to <i>enter</i> a monitor also pins on Java 21, so worker-2 is stuck too.');
        P(st, () => { S.hot = null; S.banner = 'all carriers pinned: v3–v6 cannot run'; S.bannerC = 'var(--err)'; }, 'Both carriers are pinned. v3–v6 are ready but <b>nothing can run them</b>. The scheduler doesn’t add carriers to make up for pinning. In production this looks like a hang with idle CPU. JFR records <code>jdk.VirtualThreadPinned</code> for each pin over 20 ms.');
        P(st, () => { S.pinned[0] = false; S.poll = []; finish(0); S.carNote[1] = 'v2 now owns the monitor…'; mount(0, 'v3'); S.banner = null; }, '800 ms later, v1’s call returns. It leaves the monitor and finishes. v2 gets the monitor (and will pin for its own call). worker-1 can finally run v3.');
        P(st, () => { S.banner = 'fix on 21: ReentrantLock (parks, doesn’t pin)'; S.bannerC = 'var(--ok)'; }, 'Fix on Java 21: use <code>ReentrantLock</code> instead of <code>synchronized</code> around blocking work. Its <code>lock()</code> parks the virtual thread, which unmounts. Keep monitors for short CPU-only code. Or upgrade to JDK 24+. Switch the toggle to see JDK 24.');
      } else {
        P(st, () => { unmount(0, 'socket, holds monitor'); S.poll = ['v1: fd 52 readable?']; }, 'v1 enters <code>synchronized (lock)</code> and makes the HTTP call. Since JDK 24, monitors track virtual threads directly. So v1 <b>unmounts while still owning the monitor</b>. worker-1 is free.');
        P(st, () => { mount(0, 'v3'); }, 'worker-1 runs v3.');
        P(st, () => { unmount(1, 'waits for monitor'); }, 'v2 tries to enter the same monitor. It waits, but as a sleeping (<b>parked</b>) virtual thread. So worker-2 is freed too.');
        P(st, () => { mount(1, 'v4'); }, 'worker-2 runs v4. The monitor still lets v1 and v2 in one at a time, as it should. But it holds no OS thread.');
        P(st, () => { unpark('v1'); S.poll = []; finish(0); mount(0, 'v5'); }, 'v1’s response arrives, v1 is unparked into the queue; v3 finishes and worker-1 mounts v5.');
        P(st, () => { finish(1); mount(1, 'v1'); }, 'v4 finishes; v1 resumes (on worker-2), leaves the monitor…');
        P(st, () => { unpark('v2'); S.banner = 'JDK 24+: synchronized no longer pins'; S.bannerC = 'var(--ok)'; }, '…which wakes v2, the next owner. What still pins on JDK 24+: <b>native code</b> (JNI or a foreign-function call) on the stack. Some file I/O still blocks the OS thread. The scheduler makes up for it by adding a carrier for a while.');
      }
    } else {
      code('try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {   // Java 21, --enable-preview\n    var user   = scope.fork(() -> users.find(id));       // ~2 s today\n    var orders = scope.fork(() -> orders.recent(id));    // fails after 50 ms\n    scope.join().throwIfFailed();\n    return new Page(user.get(), orders.get());\n}');
      S.clock = 0;
      P(st, () => { S.scope.state = 'open'; S.scope.owner = 'running'; }, 'The request’s virtual thread opens a scope. Every subtask started in it must finish before the <code>try</code> block can exit.');
      P(st, () => { S.scope.kids[0].st = 'running'; S.scope.kids[0].p = 0.05; S.scope.kids[1].st = 'running'; S.scope.kids[1].p = 0.1; }, '<code>fork</code> starts each subtask on its <b>own virtual thread</b>. They run concurrently.');
      P(st, () => { S.scope.owner = 'parked in join()'; S.scope.kids[0].p = 0.1; S.scope.kids[1].p = 0.3; S.clock = 20; }, 'The owner calls <code>join()</code> and parks (cheap: it is virtual too).');
      P(st, () => { S.clock = 50; S.scope.kids[1].st = 'failed'; S.scope.kids[1].p = 0.4; S.scope.kids[1].note = 'failed: PartnerDownException'; S.scope.kids[0].p = 0.12; }, 't = 50 ms: <code>orders.recent</code> throws.');
      P(st, () => { S.scope.state = 'shutdown'; S.scope.kids[0].st = 'cancelled'; S.scope.kids[0].note = 'interrupted by shutdown()'; }, '<b>ShutdownOnFailure</b> reacts to the first failure. It shuts the scope down, which <b>interrupts</b> the other subtask. <code>users.find</code> sees <code>InterruptedException</code> (or a closed socket) and stops after ~50 ms instead of 2 s.');
      P(st, () => { S.clock = 55; S.scope.owner = 'join() returned'; S.scope.kids[0].note = 'stopped, result discarded'; }, '<code>join()</code> returns once both threads have actually finished. No subtask is left running.');
      P(st, () => { S.scope.state = 'closed'; S.scope.owner = 'ExecutionException → 502'; S.leak = 'with a plain ExecutorService, users.find would keep running ~2 s after the error'; S.banner = 'subtasks live and die with their scope'; S.bannerC = 'var(--ok)'; }, '<code>throwIfFailed()</code> throws an <code>ExecutionException</code> carrying PartnerDownException, and the scope closes. Compare a hand-made <code>ExecutorService</code> version. The failed request returns, but the leftover <code>users.find</code> keeps a connection busy. Preview API in Java 21: it changed shape in later JDKs.');
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    jdkRow.style.display = mode === 'pin' ? '' : 'none';
    Object.keys(chips).forEach((n) => { chips[n].g.remove(); delete chips[n]; });
    S = { car: [null, null], pinned: [false, false], carNote: ['', ''], queue: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'], parked: [], done: [], poll: [], hot: null, banner: null,
      scope: { state: 'not open', owner: '—', kids: [{ name: 'users.find(id)', st: 'pending', p: 0 }, { name: 'orders.recent(id)', st: 'pending', p: 0 }] }, clock: null, leak: null };
    steps = plan(); render(); bStep.disabled = false;
    say({ mount: 'Six virtual threads, two carriers. Watch them mount, park on I/O, and resume, maybe on another carrier. Press Play or Step.', pin: `Two virtual threads call a slow service inside <code>synchronized</code>. Behaviour: <b>${jdk === 21 ? 'JDK 21–23' : 'JDK 24+'}</b>.`, scope: 'Two subtasks in a structured scope; one fails quickly.' }[mode]);
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; s.run(); render(); say(typeof s.t === 'function' ? s.t() : s.t);
    if (k >= steps.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
