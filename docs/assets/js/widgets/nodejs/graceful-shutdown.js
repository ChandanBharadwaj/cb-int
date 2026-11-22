/* Graceful shutdown: a pod's termination timeline. Endpoint removal runs in parallel with preStop → SIGTERM →
   grace period → SIGKILL. Options: how the container starts (PID 1), what the handler does, and a preStop delay. */
IA.widget('graceful-shutdown', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-gs-style')) {
    document.head.append(el('style', { id: 'w-gs-style', text: `
.w-gs .rl { fill: var(--text-2); font-size: 13px; font-weight: 600; }
.w-gs .track { fill: var(--surface-2); stroke: var(--border); }
.w-gs .s-act { fill: var(--accent); } .w-gs .s-slow { fill: color-mix(in srgb, var(--warn) 50%, var(--surface)); }
.w-gs .s-ok { fill: var(--ok); } .w-gs .s-bad { fill: var(--err); } .w-gs .s-idle { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1; }
.w-gs .m-ok { stroke: var(--ok); } .w-gs .m-bad { stroke: var(--err); } .w-gs .m-info { stroke: var(--text-3); stroke-dasharray: 3 3; }
.w-gs .ml { font-size: 12px; } .w-gs .ml.ok { fill: var(--ok); } .w-gs .ml.bad { fill: var(--err); font-weight: 700; } .w-gs .ml.info { fill: var(--text-2); }
.w-gs .axis { stroke: var(--border); } .w-gs .tick { fill: var(--text-3); font-size: 11px; }
.w-gs .now { stroke: var(--accent); stroke-width: 2; }
.w-gs .fade { animation: capin .4s ease both; }
.w-gs-v { display: inline-block; font-weight: 700; border-radius: 999px; padding: 4px 12px; margin-top: 8px; border: 1px solid var(--border); }
.w-gs-v.ok { color: var(--ok); border-color: var(--ok); } .w-gs-v.bad { color: var(--err); border-color: var(--err); } .w-gs-v.warn { color: var(--warn); border-color: var(--warn); }
` }));
  }
  const ENTRY = {
    exec: { label: 'CMD ["node", …]', pid1: 'node (PID 1)', code: 'CMD ["node", "server.js"]' },
    shell: { label: 'CMD node … (shell form)', pid1: '/bin/sh -c (PID 1)', code: 'CMD node server.js        # = /bin/sh -c "node server.js"' },
    tini: { label: 'tini → node', pid1: 'tini (PID 1)', code: 'ENTRYPOINT ["/sbin/tini", "--"]\nCMD ["node", "server.js"]' }
  };
  const HAND = {
    none: { label: 'no handler', code: '// no SIGTERM handler' },
    exit: { label: 'exit at once', code: "process.on('SIGTERM', () => process.exit(0));" },
    drain: { label: 'drain', code: "process.once('SIGTERM', async () => {\n  readiness = false;\n  await closeServer();   // server.close(): finish in-flight\n  await pool.end();\n  process.exitCode = 0;\n});" }
  };
  let entry = 'exec'; let hand = 'none'; let pre = 0; let gen = 0; let running = false; let speed = 2600; let k = 0; let steps = []; let verdict = null;
  const seg = (opts, get, set, label) => { const e = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...e.children].forEach((x) => x.classList.toggle('on', x === b)); }); e.append(b); }); return e; };
  const segE = seg(Object.entries(ENTRY).map(([key, v]) => [key, v.label]), () => entry, (v) => { entry = v; reset(); }, 'Container entrypoint');
  const segH = seg(Object.entries(HAND).map(([key, v]) => [key, v.label]), () => hand, (v) => { hand = v; reset(); }, 'SIGTERM handler');
  const segP = seg([[0, 'no preStop'], [5, 'preStop: sleep 5']], () => pre, (v) => { pre = v; reset(); }, 'preStop hook');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const codeHost = el('div');
  const W = 600; const X0 = 16; const X1 = W - 16; const RH = 60; const TOP = 30; const TMAX = 32;
  const stage = svg('svg', { role: 'img', 'aria-label': 'Termination timeline: kubelet, PID 1, the node process, new requests and an in-flight request' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' }); const vHost = el('div');
  root.classList.add('w-gs');
  root.append(el('div', { class: 'w-controls' }, segE), el('div', { class: 'w-controls' }, segH, segP), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, vHost, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const s = (r, a, b, kd) => ({ r, a, b, k: kd }); const m = (r, t, l, kd, dy) => ({ r, t, l, k: kd, dy: dy || 0, m: 1 });
  const ROWS = () => ['kubelet', ENTRY[entry].pid1, 'node process', 'new requests (routed until endpoints update)', 'in-flight request'];
  const EP = 2; // endpoint removal takes effect after ~2 s in this model
  function plan() {
    const ts = pre; const delivered = entry !== 'shell'; const nodePid1 = entry === 'exec';
    const react = !delivered ? 'lost' : hand === 'none' ? (nodePid1 ? 'ignored' : 'killed') : hand;
    const st = []; const inflA = Math.max(0, ts - 1); const inflB = ts + 2;
    st.push({ t: 0, add: [m(0, 0, 'pod Terminating', 'info'), s(3, 0, EP, 'act'), m(3, EP, 'endpoints updated (~2 s)', 'info')],
      x: 'A rollout deletes the pod. Two things start <b>at the same time</b>: endpoint removal (EndpointSlice → kube-proxy, ingress, cloud LB: a few seconds) and the container stop sequence. New requests keep arriving until routing catches up.' });
    if (pre) st.push({ t: ts, add: [s(0, 0, ts, 'slow'), m(0, ts, 'preStop done', 'info', 14)], x: 'The <code>preStop</code> hook runs first (K8s 1.30+: native <code>sleep</code> action). SIGTERM waits for it. By the time it finishes, endpoints were updated at ~2 s, so <b>no new requests</b> are on their way.' });
    const pid1Txt = { exec: 'Node itself is PID 1.', shell: '<code>/bin/sh</code> is PID 1. It receives SIGTERM and <b>does not forward it</b> to node.', tini: 'tini is PID 1 and <b>forwards</b> SIGTERM to node, its child.' }[entry];
    st.push({ t: ts, add: [m(0, ts, 'SIGTERM → PID 1', 'bad'), entry === 'tini' ? m(1, ts, 'forwarded to node', 'ok') : entry === 'shell' ? m(1, ts, 'swallowed', 'bad') : m(1, ts, 'node receives it', 'info'), s(4, inflA, ts, 'act')],
      x: `The kubelet sends <b>SIGTERM</b> at ${ts} s. ${pid1Txt} A request that started at ${inflA} s is still in flight.` });
    let end; let code; let failed = 0; let slow = false;
    if (react === 'lost' || react === 'ignored') {
      st.push({ t: ts + 0.5, add: [s(2, 0, ts + 0.5, 'act')], x: react === 'lost' ? 'Node never learns about the shutdown. It keeps running as if nothing happened.' : 'Node is PID 1 and the app installed <b>no handler</b>. For PID 1 the kernel skips the default “terminate” action, so the signal is <b>dropped</b>.' });
      st.push({ t: inflB, add: [s(2, ts + 0.5, inflB, 'act'), s(4, ts, inflB, 'ok'), m(4, inflB, 'completed', 'ok')], x: 'Because nothing stopped, the in-flight request completes and early arrivals were served. So far so good…' });
      end = 30; code = 137; slow = true;
      st.push({ t: 30, add: [s(2, inflB, 30, 'idle'), m(0, 30, 'SIGKILL', 'bad'), m(2, 30, 'killed: exit 137', 'bad', 14)], x: '…but the pod sits idle until <code>terminationGracePeriodSeconds</code> (30 s) expires and the kubelet sends <b>SIGKILL</b>. Exit 137. Every rollout now waits 30 s per pod, and any request running at that moment is cut. Fix: exec-form CMD, tini, and a SIGTERM handler.' });
    } else if (react === 'killed' || react === 'exit') {
      const t2 = ts + 0.05; code = react === 'killed' ? 143 : 0; end = t2;
      st.push({ t: t2, add: [s(2, 0, t2, 'act'), m(2, t2, react === 'killed' ? 'terminated: exit 143' : 'process.exit(0)', 'bad'), s(4, ts, t2, 'bad'), m(4, t2, 'connection reset', 'bad', 14)],
        x: react === 'killed' ? 'node is <b>not</b> PID 1 here, so the default action applies: the process dies immediately (exit 143). The in-flight request’s connection is <b>reset</b>.' : '<code>process.exit(0)</code> ends the process synchronously. Exit code 0 looks clean, but the in-flight request is <b>cut off</b> and nothing was flushed.' });
      failed = 1;
      if (ts < EP) { failed++; st.push({ t: EP, add: [s(3, t2, EP, 'bad'), m(3, 1.2, 'refused → 502', 'bad', 14)], x: 'Requests routed in the next ~2 s hit a port nobody listens on: <b>connection refused → 502</b> at the ingress. A preStop delay would have avoided these.' }); }
    } else {
      const tc = ts + 0.1; const tdone = inflB; code = 0; end = tdone + 0.6;
      st.push({ t: tc, add: [s(2, 0, ts, 'act'), m(2, ts, 'readiness 503, server.close()', 'ok')], x: 'The handler flips readiness to 503 and calls <code>server.close()</code>: no new connections are accepted, but existing ones are <b>not</b> interrupted.' });
      if (ts < EP) { failed++; st.push({ t: EP, add: [s(3, ts, EP, 'bad'), m(3, 1.2, 'refused → 502', 'bad', 14)], x: 'But without a delay, the server stopped listening <b>before routing caught up</b>: requests that arrive in the first ~2 s get connection refused → 502. Switch preStop on, or wait a few seconds in the handler before closing.' }); }
      st.push({ t: tdone, add: [s(2, ts, tdone, 'slow'), s(4, ts, tdone, 'ok'), m(4, tdone, 'completed', 'ok')], x: 'The in-flight request <b>finishes normally</b> and its connection closes. The <code>server.close()</code> callback fires.' });
      st.push({ t: end, add: [s(2, tdone, end, 'slow'), m(2, end, 'pool.end(), exit 0', 'ok', 14)], x: `Consumers stopped, DB pool closed, logs flushed. The event loop is empty, so Node exits <b>0</b> at about ${end.toFixed(1)} s, long before SIGKILL at 30 s.` + (ts >= EP ? ' Zero failed requests.' : '') });
    }
    verdict = { failed, end, code, slow };
    return st;
  }
  function draw() {
    const rows = ROWS(); const H = TOP + rows.length * RH + 28;
    stage.setAttribute('viewBox', `0 0 ${W} ${H}`); stage.innerHTML = '';
    const X = (t) => X0 + (t / TMAX) * (X1 - X0);
    rows.forEach((r, i) => { const y = TOP + i * RH; stage.append(svg('text', { class: 'rl', x: X0, y: y - 8, text: r }), svg('rect', { class: 'track', x: X0, y, width: X1 - X0, height: 16, rx: 4 })); });
    const ay = TOP + rows.length * RH - 8; stage.append(svg('line', { class: 'axis', x1: X0, x2: X1, y1: ay, y2: ay }));
    [0, 5, 10, 15, 20, 25, 30].forEach((t) => stage.append(svg('text', { class: 'tick', x: X(t), y: ay + 16, 'text-anchor': t === 0 ? 'start' : 'middle', text: t + ' s' })));
    steps.slice(0, k).forEach((st, si) => st.add.forEach((a) => {
      const y = TOP + a.r * RH; const cls = si === k - 1 && !reduced ? ' fade' : '';
      if (a.m) { const x = X(a.t); const right = x > W * 0.6;
        stage.append(svg('line', { class: 'm-' + a.k + cls, x1: x, x2: x, y1: y - 3, y2: y + 22, 'stroke-width': 2.5 }),
          svg('text', { class: 'ml ' + a.k + cls, x: right ? x - 4 : x + 4, y: y + 32 + a.dy, 'text-anchor': right ? 'end' : 'start', text: a.l }));
      } else { const x = X(a.a); stage.append(svg('rect', { class: 's-' + a.k + cls, x, y: y + 2, width: Math.max(2, X(a.b) - x), height: 12, rx: 2 })); }
    }));
    if (k > 0) { const x = X(steps[k - 1].t); stage.append(svg('line', { class: 'now', x1: x, x2: x, y1: TOP - 4, y2: ay })); }
    stats.innerHTML = ''; vHost.innerHTML = '';
    if (k >= steps.length && verdict) {
      const v = verdict; const ok = !v.failed && !v.slow;
      vHost.append(el('span', { class: 'w-gs-v ' + (ok ? 'ok' : v.failed ? 'bad' : 'warn'), text: ok ? '✓ clean shutdown' : v.failed ? '✗ requests failed' : '⚠ slow: waited for SIGKILL' }));
      stats.append(el('span', { class: 'w-stat', html: `failed requests <b>${v.failed}</b>` }), el('span', { class: 'w-stat', html: `pod gone after <b>${v.end.toFixed(1)} s</b>` }), el('span', { class: 'w-stat', html: `exit code <b>${v.code}</b>` }));
    } else stats.append(el('span', { class: 'w-stat', html: `t = <b>${k ? steps[k - 1].t.toFixed(1) : '0'} s</b>` }), el('span', { class: 'w-stat', html: `step <b>${k}</b>/${steps.length}` }));
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan(); bStep.disabled = false;
    codeHost.innerHTML = ''; codeHost.append(ctx.codeBox(`# Dockerfile\n${ENTRY[entry].code}\n\n// server.js\n${HAND[hand].code}`, 'bash'));
    draw(); say('terminationGracePeriodSeconds: 30. Press Play to delete the pod.');
  }
  function step() { if (k >= steps.length) return false; k++; draw(); say(steps[k - 1].x); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { while (step()); return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
