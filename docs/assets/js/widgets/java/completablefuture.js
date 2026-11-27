/* CompletableFuture: an animated dependency graph. thenApply vs thenCompose, fan-out with thenCombine/allOf, exception propagation and recovery, timeouts, and which thread runs each callback. */
IA.widget('completablefuture', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'compose'; let gen = 0; let running = false; let speed = 2600; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['compose', 'thenApply vs thenCompose'], ['combine', 'fan-out: thenCombine / allOf'], ['error', 'exceptions'], ['timeout', 'timeouts'], ['threads', 'which thread?']], () => mode, (v) => { mode = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 340, NW = 168, NH = 50;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'A graph of CompletableFuture stages and the dependencies between them' });
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const code = (src) => { codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(src, 'java') })); };
  const R = (x, y, w, h, o = {}) => svg('rect', { x, y, width: w, height: h, rx: o.rx == null ? 8 : o.rx, fill: o.fill || 'var(--surface)', stroke: o.stroke || 'var(--border)', 'stroke-width': o.sw || 1, 'stroke-dasharray': o.dash || null });
  const T = (x, y, s, o = {}) => svg('text', { x, y, 'font-size': o.fs || 12, 'font-weight': o.fw || null, 'text-anchor': o.a || 'start', 'font-family': o.mono ? 'var(--mono)' : null, fill: o.fill || 'var(--text)', text: s });
  function arrow(x1, y1, x2, y2, col, w, dash) {
    const mx = (x1 + x2) / 2; const g = svg('g');
    g.append(svg('path', { d: `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`, fill: 'none', stroke: col, 'stroke-width': w || 1.5, 'stroke-dasharray': dash || null }));
    const a = Math.atan2(y2 - y2, x2 - mx), s = 8;
    g.append(svg('polygon', { points: `${x2},${y2} ${x2 - s * Math.cos(a - 0.45)},${y2 - s * Math.sin(a - 0.45)} ${x2 - s * Math.cos(a + 0.45)},${y2 - s * Math.sin(a + 0.45)}`, fill: col }));
    return g;
  }
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  let S;
  const COL = { pending: ['none', 'var(--border)', 'var(--text-3)'], running: ['var(--accent-soft)', 'var(--accent)', 'var(--accent)'], done: ['var(--surface)', 'var(--ok)', 'var(--text)'], failed: ['var(--surface)', 'var(--err)', 'var(--err)'], warn: ['var(--surface)', 'var(--warn)', 'var(--warn)'] };
  function render() {
    stage.innerHTML = '';
    (S.edges || []).forEach(([a, b, lab, kind]) => {
      const A = S.nodes[a], B = S.nodes[b]; if (!A || !B) return;
      const hot = S.fire && S.fire.includes(a + '>' + b);
      const col = hot ? (kind === 'err' ? 'var(--err)' : 'var(--accent)') : 'var(--border)';
      let x1 = A.x + NW, y1 = A.y + NH / 2, x2 = B.x, y2 = B.y + NH / 2;
      if (kind === 'inner') {
        const down = B.y > A.y; x1 = A.x + NW / 2; x2 = B.x + NW / 2;
        y1 = down ? A.y + NH : A.y; y2 = down ? B.y : B.y + NH; const d = down ? -9 : 9;
        stage.append(svg('path', { d: `M${x1} ${y1} L ${x2} ${y2 + d * 0.6}`, fill: 'none', stroke: col, 'stroke-width': hot ? 2.5 : 1.5, 'stroke-dasharray': '5 4' }), svg('polygon', { points: `${x2},${y2} ${x2 - 5},${y2 + d} ${x2 + 5},${y2 + d}`, fill: col }));
      }
      else stage.append(arrow(x1, y1, x2, y2, col, hot ? 2.5 : 1.5));
      if (lab) {
        const lx = kind === 'inner' ? x1 + 8 : (x1 + x2) / 2, ly = kind === 'inner' ? (y1 + y2) / 2 : (y1 + y2) / 2 - 6;
        stage.append(T(lx, ly, lab, { a: kind === 'inner' ? 'start' : 'middle', fs: 10.5, mono: true, fill: hot ? 'var(--accent)' : 'var(--text-3)' }));
      }
    });
    Object.entries(S.nodes).forEach(([id, n]) => {
      const c = COL[n.st] || COL.pending;
      stage.append(R(n.x, n.y, NW, NH, { fill: c[0], stroke: c[1], sw: n.st === 'pending' ? 1.2 : 2, dash: n.st === 'pending' ? '5 4' : null }));
      stage.append(T(n.x + 8, n.y + 18, trunc(n.label, 24), { mono: true, fs: 11.5, fw: 600, fill: n.st === 'pending' ? 'var(--text-3)' : 'var(--text)' }));
      const v = n.st === 'pending' ? 'not completed' : n.st === 'running' ? 'running…' : n.val || '';
      stage.append(T(n.x + 8, n.y + 36, trunc(v, 25), { mono: true, fs: 11, fill: c[2] }));
      if (n.thr) stage.append(T(n.x + NW - 6, n.y + NH + 13, n.thr, { a: 'end', fs: 10, fill: 'var(--text-3)' }));
    });
    if (S.clock != null) stage.append(T(W - 14, 18, `t = ${S.clock} ms`, { a: 'end', mono: true, fs: 12.5, fw: 700, fill: 'var(--text-2)' }));
    if (S.banner) stage.append(T(14, H - 8, S.banner, { fs: 12.5, fw: 700, fill: S.bannerC || 'var(--text)' }));
  }
  function statLine() {
    stats.innerHTML = '';
    const ns = Object.values(S.nodes); const add = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    add(`stages <b>${ns.length}</b>`); add(`completed <b>${ns.filter((n) => n.st === 'done' || n.st === 'warn').length}</b>`);
    add(`exceptional <b>${ns.filter((n) => n.st === 'failed').length}</b>`); add(`running <b>${ns.filter((n) => n.st === 'running').length}</b>`);
  }
  const N = (id, x, y, label, st, val, thr) => { S.nodes[id] = { x, y, label, st: st || 'pending', val, thr }; };
  const set = (id, st, val, thr) => { const n = S.nodes[id]; n.st = st; if (val !== undefined) n.val = val; if (thr !== undefined) n.thr = thr; };
  const E = (a, b, lab, kind) => S.edges.push([a, b, lab, kind]);
  const P = (st, run, t) => st.push({ run: () => { S.fire = []; run(); }, t });

  function plan() {
    const st = [];
    if (mode === 'compose') {
      code('CompletableFuture<User> user = supplyAsync(() -> users.get(7), io);\n\nuser.thenApply(u -> orders.forUser(u))      // CF<CF<List<Order>>>  ✗\nuser.thenCompose(u -> orders.forUser(u))    // CF<List<Order>>      ✓\n    .thenApply(OrderDto::list);');
      P(st, () => { N('U', 16, 105, 'supplyAsync(users.get)', 'running', null, 'io-1'); }, '<code>supplyAsync</code> starts loading the user on the <code>io</code> executor and immediately returns a pending future.');
      P(st, () => { N('A', 210, 20, 'thenApply(forUser)'); N('C', 210, 180, 'thenCompose(forUser)'); N('D', 450, 180, 'thenApply(toDto)'); E('U', 'A', 'thenApply'); E('U', 'C', 'thenCompose'); E('C', 'D', 'thenApply'); }, 'We register two different dependents on the same future: one with <code>thenApply</code>, one with <code>thenCompose</code>, plus a mapping step after the compose. Nothing runs yet: the user isn’t loaded.');
      P(st, () => { set('U', 'done', 'User#7'); S.fire = ['U>A', 'U>C']; set('A', 'running', null, 'io-1'); set('C', 'running', null, 'io-1'); }, 'The user arrives. Completing <code>U</code> triggers both dependents, on the thread that completed it (io-1).');
      P(st, () => { set('A', 'warn', 'CF<List<Order>> (nested!)'); N('IA', 450, 20, 'orders.forUser (inner)', 'running'); E('A', 'IA', '', ''); }, '<code>thenApply</code> calls <code>forUser(u)</code>, which <b>returns a future</b>. thenApply wraps that value as-is. So <code>A</code> finishes at once with… a future. Type: <code>CompletableFuture&lt;CompletableFuture&lt;List&lt;Order&gt;&gt;&gt;</code>. Anyone joining <code>A</code> gets an <i>unfinished</i> inner future.');
      P(st, () => { N('IC', 210, 268, 'orders.forUser (inner)', 'running'); E('IC', 'C', 'completes C', 'inner'); set('C', 'running', 'waiting for inner…'); }, '<code>thenCompose</code> also calls <code>forUser(u)</code>, but it <b>waits on the returned future</b>. <code>C</code> stays pending until the inner one is done. That is flatMap.');
      P(st, () => { set('IC', 'done', '3 orders'); set('IA', 'done', '3 orders'); S.fire = ['IC>C']; set('C', 'done', 'List<Order> (3)'); }, 'The orders arrive. The inner future completes <code>C</code> with the <b>flattened</b> value: <code>List&lt;Order&gt;</code>.');
      P(st, () => { S.fire = ['C>D']; set('D', 'done', 'List<OrderDto> (3)', 'io-1'); S.banner = 'returns a future? → thenCompose'; S.bannerC = 'var(--ok)'; }, '<code>D</code> maps the list to DTOs. Rule of thumb: if your lambda returns a <code>CompletableFuture</code>, use <code>thenCompose</code>.');
    } else if (mode === 'combine') {
      code('var price   = supplyAsync(() -> pricing.price(sku), io);\nvar stock   = supplyAsync(() -> inventory.stock(sku), io);\nvar reviews = supplyAsync(() -> reviewsApi.top(sku), io);\nvar offer   = price.thenCombine(stock, Offer::new);\nvar page    = allOf(price, stock, reviews).thenApply(v -> render(price.join(), stock.join(), reviews.join()));');
      S.clock = 0;
      P(st, () => { N('P', 16, 20, 'price', 'running', null, 'io-1'); N('S', 16, 130, 'stock', 'running', null, 'io-2'); N('V', 16, 240, 'reviews', 'running', null, 'io-3'); }, 'Three independent calls start <b>at the same time</b>, each on its own thread. Total latency will be the slowest one, not the sum.');
      P(st, () => { N('O', 290, 70, 'thenCombine(Offer::new)'); N('A', 290, 200, 'allOf(price,stock,rev)'); N('G', 570, 200, 'thenApply(render)'); E('P', 'O'); E('S', 'O'); E('P', 'A'); E('S', 'A'); E('V', 'A'); E('A', 'G'); }, 'Dependents: <code>thenCombine</code> waits for price <b>and</b> stock; <code>allOf</code> waits for all three and yields <code>Void</code>.');
      P(st, () => { S.clock = 80; set('S', 'done', 'stock=12'); S.fire = ['S>O', 'S>A']; }, 't = 80 ms: stock completes. thenCombine still needs price; allOf still needs two.');
      P(st, () => { S.clock = 140; set('P', 'done', '€19.90'); S.fire = ['P>O', 'P>A']; set('O', 'done', 'Offer(€19.90, 12)', 'io-1'); }, 't = 140 ms: price completes. Both inputs of thenCombine are ready, so it runs, on the thread that completed the <i>second</i> input (io-1).');
      P(st, () => { S.clock = 210; set('V', 'done', '5 reviews'); S.fire = ['V>A']; set('A', 'done', 'null (Void)', 'io-3'); }, 't = 210 ms: reviews complete. <code>allOf</code> completes with <b>null</b>: it only signals “all done”.');
      P(st, () => { S.fire = ['A>G']; set('G', 'done', 'ProductPage', 'io-3'); S.banner = 'latency ≈ max(80, 140, 210) = 210 ms'; S.bannerC = 'var(--ok)'; }, 'The follow-up reads each result with <code>join()</code>, which doesn’t block because they are complete. Sequentially this would have taken 430 ms. Note: if one input fails, <code>allOf</code> fails, but only after <b>all</b> inputs finish. <code>anyOf</code> completes with whichever finishes first, success <i>or</i> failure.');
    } else if (mode === 'error') {
      code('supplyAsync(() -> rates.load("EUR"), io)        // throws UncheckedIOException\n    .thenApply(r -> r.convert(amount))\n    .thenApply(Money::format)\n    .whenComplete((v, ex) -> log(ex))            // observes, passes the failure on\n    .exceptionally(ex -> "n/a")                  // recovers\n    .thenAccept(ui::show);');
      P(st, () => { N('L', 16, 40, 'supplyAsync(load)', 'running', null, 'io-1'); N('C1', 16, 150, 'thenApply(convert)'); N('F', 200, 150, 'thenApply(format)'); N('W', 384, 150, 'whenComplete(log)'); N('X', 384, 40, 'exceptionally("n/a")'); N('Z', 580, 40, 'thenAccept(show)'); E('L', 'C1', '', 'inner'); E('C1', 'F'); E('F', 'W'); E('W', 'X', '', 'inner'); E('X', 'Z'); }, 'A pipeline of six stages. The first one is loading exchange rates.');
      P(st, () => { set('L', 'failed', 'UncheckedIOException'); S.fire = ['L>C1']; }, 'The supplier <b>throws</b>. <code>supplyAsync</code> catches it and completes its future exceptionally (wrapped in a <code>CompletionException</code>).');
      P(st, () => { set('C1', 'failed', 'skipped → CompletionException'); S.fire = ['C1>F']; }, '<code>thenApply(convert)</code> is <b>skipped</b>: its function never runs. Its own future fails with the same cause, wrapped in a <code>CompletionException</code>.');
      P(st, () => { set('F', 'failed', 'skipped → CompletionException'); S.fire = ['F>W']; }, 'Same for <code>format</code>. A failure travels down the chain like a value, skipping every normal stage.');
      P(st, () => { set('W', 'failed', 'logged; still failed', 'io-1'); S.fire = ['W>X']; }, '<code>whenComplete</code> <b>does</b> run, on both outcomes. It logs, but its stage completes with the <b>same failure</b>: it is an observer, not a recovery.');
      P(st, () => { set('X', 'done', '"n/a" (recovered)', 'io-1'); S.fire = ['X>Z']; }, '<code>exceptionally</code> runs only on failure and turns it into a value. Tip: <code>ex</code> here is a <code>CompletionException</code>; check <code>ex.getCause()</code>.');
      P(st, () => { set('Z', 'done', 'ui shows "n/a"', 'io-1'); S.banner = 'skip … skip … observe … recover … continue'; S.bannerC = 'var(--ok)'; }, 'Downstream stages run normally again. <code>handle((v, ex) -&gt; …)</code> would do both jobs in one stage. If no stage recovers and nobody joins, the error is simply never seen.');
    } else if (mode === 'timeout') {
      code('var call = supplyAsync(() -> partner.quote(sku), io);   // takes 3 s today\nvar a = call.copy().orTimeout(1, SECONDS)                     // fail fast\n            .exceptionally(ex -> Quote.unavailable());\nvar b = call.copy().completeOnTimeout(Quote.cached(sku), 1, SECONDS);   // default value');
      S.clock = 0;
      P(st, () => { N('Q', 16, 125, 'supplyAsync(partner)', 'running', null, 'io-1 busy'); N('A', 290, 40, 'orTimeout(1 s)'); N('B', 290, 210, 'completeOnTimeout(1 s)'); N('A2', 560, 40, 'exceptionally(unavail.)'); E('Q', 'A', 'copy()'); E('Q', 'B', 'copy()'); E('A', 'A2'); }, 'The partner call starts on io-1. We derive two futures with different timeout policies (<code>copy()</code> so each gets its own stage).');
      P(st, () => { S.clock = 1000; set('A', 'failed', 'TimeoutException'); S.fire = ['A>A2']; set('A2', 'done', 'Quote.unavailable', 'delayer'); }, 't = 1000 ms: <code>orTimeout</code> completes its future <b>exceptionally</b> with <code>TimeoutException</code>, from the JDK’s internal delay-scheduler thread. The fallback runs.');
      P(st, () => { set('B', 'done', 'Quote.cached (default)', 'delayer'); }, 'Same instant: <code>completeOnTimeout</code> completes its future <b>normally</b> with the default value.');
      P(st, () => { S.clock = 2000; set('Q', 'running', null, 'io-1 STILL busy'); S.banner = 'the caller moved on; the work did not stop'; S.bannerC = 'var(--warn)'; }, 't = 2000 ms: the original call is <b>still running</b>, holding io-1 and an HTTP connection. No timeout (nor <code>cancel(true)</code>) interrupts it. A CompletableFuture doesn’t know which thread is doing the work.');
      P(st, () => { S.clock = 3000; set('Q', 'done', 'Quote(€21) (ignored)', 'io-1 free'); S.banner = 'put the real timeout on the HTTP client'; S.bannerC = 'var(--ok)'; }, 't = 3000 ms: the call finally returns. Its result goes nowhere: the later futures are already done. Under load, this is how “fast 504s” still use up a connection pool. Set read timeouts on the client itself.');
    } else {
      code('var f = supplyAsync(() -> load(), io);            // runs on io-1\nf.thenApply(x -> x * 2);                          // registered while f is pending\n// … later, f is complete …\nf.thenApply(x -> x + 1);                          // registered after completion\nf.thenApplyAsync(x -> x - 1);                     // no executor → commonPool\nf.thenApplyAsync(x -> x * 10, cpu);               // explicit executor');
      P(st, () => { N('F', 16, 125, 'supplyAsync(load, io)', 'running', null, 'thread: io-1'); N('A', 290, 10, 'thenApply(x*2)'); E('F', 'A'); }, '<code>f</code> is running on io-1. We register <code>thenApply(x*2)</code> while it is still pending.');
      P(st, () => { set('F', 'done', '21', 'thread: io-1'); S.fire = ['F>A']; set('A', 'done', '42', 'ran on io-1 (completer)'); }, '<code>f</code> completes on io-1, and io-1 <b>immediately runs</b> the pending callback. A slow callback here would delay io-1’s next task (or, with an HTTP client, its I/O thread).');
      P(st, () => { N('B', 290, 85, 'thenApply(x+1)'); E('F', 'B'); S.fire = ['F>B']; set('B', 'done', '22', 'ran on main (caller)'); }, 'Now <code>f</code> is already complete. Registering <code>thenApply(x+1)</code> runs it <b>right away, on the calling thread</b> (main). Same code, different thread: non-async callbacks run wherever completion happens to meet registration.');
      P(st, () => { N('C', 290, 160, 'thenApplyAsync(x-1)'); E('F', 'C'); S.fire = ['F>C']; set('C', 'done', '20', 'ForkJoinPool.commonPool-worker-1'); }, '<code>thenApplyAsync</code> without an executor always goes to <code>ForkJoinPool.commonPool()</code>, shared with parallel streams. Fine for tiny CPU work; never for blocking I/O.');
      P(st, () => { N('D', 290, 235, 'thenApplyAsync(x*10,cpu)'); E('F', 'D'); S.fire = ['F>D']; set('D', 'done', '210', 'ran on cpu-1'); S.banner = 'heavy or blocking callback? → …Async(fn, executor)'; S.bannerC = 'var(--ok)'; }, 'With an explicit executor you <b>choose</b> the thread. Do this for anything slow, and for callbacks that must not run on someone else’s I/O thread.');
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    S = { nodes: {}, edges: [], fire: [], clock: null, banner: null };
    steps = plan(); render(); statLine(); bStep.disabled = false;
    say({ compose: 'Load a user, then the user’s orders: map or flat-map? Press Play or Step.', combine: 'Three independent calls, combined. Watch the clock.', error: 'One stage throws. Watch the failure travel.', timeout: 'A partner call that takes 3 s, and two timeout policies of 1 s.', threads: 'Same future, four callbacks. Which thread runs each?' }[mode]);
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; s.run(); render(); statLine(); say(typeof s.t === 'function' ? s.t() : s.t);
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
