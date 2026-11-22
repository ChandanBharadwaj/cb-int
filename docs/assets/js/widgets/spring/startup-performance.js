/* Graceful shutdown in Kubernetes: endpoint removal vs SIGTERM vs Tomcat drain vs SIGKILL, with each request's outcome; immediate, graceful, graceful + preStop, drain longer than the grace period. */
IA.widget('startup-performance', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const REQ = [[-3.5, 1], [-3, 4.5], [-2.4, 0.5], [-2, 9], [-1.4, 2], [-0.8, 1], [-0.3, 3.5], [0.4, 0.6], [0.9, 1.5], [1.5, 0.4], [1.9, 2.5], [2.6, 1], [3.2, 0.5]];
  const RM = 2.2;            // endpoints updated everywhere ~2.2 s after deletion
  const SC = {
    imm: { label: 'immediate', pre: 0, drain: 0, grace: 30, intro: '<code>server.shutdown=immediate</code> (the default before Boot 3.4), no preStop. Requests keep arriving at about 2 per second.',
      ev: [[0, 'The pod is deleted. Kubernetes starts removing it from the Service’s endpoints and, with no preStop hook, sends <b>SIGTERM</b> at once.'],
        [0.05, 'Spring closes the context. With immediate shutdown, Tomcat stops right away: the 5 requests still running are <b>cut</b> (clients see resets or 502s).', 'err'],
        [RM, 'Until the endpoint change reaches every kube-proxy and ingress (~2 s here), new requests are still routed to the pod: <b>connection refused</b>.', 'err'],
        [6, 'Total: every in-flight request lost, plus everything routed during the endpoint delay. Kafka listeners also stopped mid-batch, so those records will be redelivered.', 'err']] },
    gr: { label: 'graceful, no preStop', pre: 0, drain: 30, grace: 30, intro: '<code>server.shutdown=graceful</code> (default since Boot 3.4), <code>timeout-per-shutdown-phase</code> 30 s, still no preStop hook.',
      ev: [[0, 'Pod deleted, SIGTERM sent immediately.'],
        [0.05, 'Readiness goes to <code>REFUSING_TRAFFIC</code> and Tomcat stops <b>accepting new connections</b>, but lets the in-flight requests finish.', 'warn'],
        [RM, 'In-flight requests complete. But new requests routed during the ~2 s endpoint delay hit a closed port: still <b>refused</b>.', 'err'],
        [7.1, 'The longest request finishes, the drain ends, the context closes and the JVM exits well before the 30 s grace period. Better, but not zero errors.', 'warn']] },
    pre: { label: 'graceful + preStop 10 s', pre: 10, drain: 30, grace: 45, intro: 'Graceful shutdown plus <code>preStop: sleep 10</code> and <code>terminationGracePeriodSeconds: 45</code>.',
      ev: [[0, 'Pod deleted. Kubernetes starts endpoint removal and runs the <b>preStop</b> hook: a 10 s sleep. SIGTERM waits until it finishes.'],
        [RM, 'The app is untouched and keeps serving everything routed to it. By ~2 s, load balancers have stopped sending new requests.', 'ok'],
        [10, 'preStop ends; now <b>SIGTERM</b>. Tomcat stops accepting (nobody is sending anyway) and drains what is left.', 'ok'],
        [11, 'Every request was served. Grace period 45 s ≥ 10 s preStop + drain + margin.', 'ok']] },
    kill: { label: 'drain > grace period', pre: 10, drain: 60, grace: 15, intro: 'A long report request (about 15 s) starts just after the deletion. preStop 10 s, drain timeout 60 s, but <code>terminationGracePeriodSeconds: 15</code>.',
      ev: [[0, 'Pod deleted; the grace period clock starts <b>now</b>, including the preStop time.'],
        [10, 'preStop ends, SIGTERM, graceful drain starts. The drain timeout is 60 s, so Spring is willing to wait…', 'warn'],
        [15, '…but Kubernetes isn’t: at 15 s it sends <b>SIGKILL</b>. The JVM dies mid-drain: no shutdown hooks finish, no Kafka commit, no pool close.', 'err'],
        [17, 'Rule: <code>terminationGracePeriodSeconds</code> ≥ preStop + <code>timeout-per-shutdown-phase</code> + margin, and request timeouts shorter than the drain.', 'err']] }
  };
  // the long request in "kill" (arrives at 0.5, runs 14.6 s → would end at 15.1)
  const reqs = (S) => sc === 'kill' ? REQ.slice(0, 8).concat([[0.5, 14.6]]) : REQ;
  function outcome(S, a, d) {
    const term = S.pre;                       // SIGTERM time
    const kill = S.grace;                     // SIGKILL time
    if (a >= RM) return null;                 // not routed here any more
    if (a >= term && S.drain >= 0) return { st: a, en: a + 0.15, o: 'refused' };     // accept stopped
    const end = a + d;
    if (S.drain === 0 && end > term) return { st: a, en: term, o: 'cut' };
    if (end > Math.min(kill, term + S.drain)) return { st: a, en: Math.min(kill, term + S.drain), o: 'cut' };
    return { st: a, en: end, o: 'ok' };
  }
  let sc = 'imm'; let k = 0; let gen = 0; let running = false; let speed = 2600; let tc = -4;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(SC).map((x) => [x, SC[x].label]), sc, (v) => { sc = v; reset(); }, 'Configuration');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 330', role: 'img', 'aria-label': 'Timeline of pod deletion: endpoints, kubelet signals, Tomcat state and request outcomes' });
  const stats = el('div', { class: 'w-stats' }); const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage), stats,
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
  function render() {
    const S = SC[sc]; stage.innerHTML = '';
    const T0 = -4; const T1 = sc === 'pre' || sc === 'kill' ? 20 : 10; const X0 = 130; const W = 616; const tx = (t) => X0 + ((Math.min(t, T1) - T0) / (T1 - T0)) * W;
    const lab = (y, t) => stage.append(svg('text', { x: 8, y, 'font-size': 11, 'font-weight': 700, 'font-family': 'var(--mono)', fill: 'var(--text-2)', text: t }));
    const bar = (t0, t1, y, h, col, txt) => { if (t1 <= t0) return; const a = Math.max(t0, T0); const b = Math.min(t1, tc); if (b <= a) return;
      stage.append(svg('rect', { x: tx(a), y, width: Math.max(2, tx(b) - tx(a)), height: h, rx: 4, fill: `color-mix(in srgb, ${col} 30%, var(--surface))`, stroke: col, 'stroke-width': 1.2 }));
      if (txt && tx(b) - tx(a) > 60) stage.append(svg('text', { x: tx(a) + 6, y: y + h / 2 + 4, 'font-size': 10.5, 'font-family': 'var(--mono)', fill: 'var(--text)', text: txt })); };
    // axis
    for (let t = T0; t <= T1; t += 2) stage.append(svg('text', { x: tx(t), y: 322, 'font-size': 10, 'text-anchor': 'middle', 'font-family': 'var(--mono)', fill: 'var(--text-3)', text: (t > 0 ? '+' : '') + t + 's' }));
    stage.append(svg('path', { d: `M${tx(0)} 14 L${tx(0)} 308`, stroke: 'var(--text-3)', 'stroke-dasharray': '2 3' }), svg('text', { x: tx(0) + 4, y: 12, 'font-size': 10, 'font-family': 'var(--mono)', fill: 'var(--text-3)', text: 'pod deleted' }));
    lab(36, 'endpoints'); bar(T0, RM, 22, 22, 'var(--ok)', 'routed to this pod'); bar(RM, T1 + 1, 22, 22, 'var(--text-3)', 'removed');
    lab(72, 'kubelet');
    if (S.pre) bar(0, S.pre, 58, 22, 'var(--accent)', `preStop sleep ${S.pre}s`);
    const mark = (t, txt, col) => { if (tc < t) return; stage.append(svg('path', { d: `M${tx(t)} 54 L${tx(t)} 84`, stroke: col, 'stroke-width': 2.4 }), svg('text', { x: tx(t) + 4, y: 96, 'font-size': 10.5, 'font-weight': 700, 'font-family': 'var(--mono)', fill: col, text: txt })); };
    mark(S.pre, 'SIGTERM', 'var(--warn)');
    if (S.grace <= T1) mark(S.grace, 'SIGKILL', 'var(--err)');
    lab(128, 'Tomcat');
    const term = S.pre; const longest = Math.max(...reqs(S).map(([a, d]) => { const o = outcome(S, a, d); return o ? o.en : -99; }));
    const stopAt = S.drain === 0 ? term : Math.min(S.grace, Math.max(term, longest));
    bar(T0, term, 114, 22, 'var(--ok)', 'accepting');
    if (S.drain > 0) bar(term, stopAt, 114, 22, 'var(--warn)', 'draining');
    bar(stopAt, T1 + 1, 114, 22, stopAt >= S.grace ? 'var(--err)' : 'var(--text-3)', stopAt >= S.grace ? 'killed' : 'stopped');
    lab(160, 'requests');
    let ok = 0; let bad = 0;
    reqs(S).forEach(([a, d], i) => { const o = outcome(S, a, d); const y = 150 + i * 11.5; if (!o) return; if (a > tc) return;
      const col = o.o === 'ok' ? 'var(--ok)' : 'var(--err)';
      bar(o.st, Math.max(o.en, o.st + 0.12), y, 8, col);
      if (tc >= o.en) { if (o.o === 'ok') ok++; else bad++;
        if (o.o !== 'ok') stage.append(svg('text', { x: Math.min(tx(o.en) + 4, 700), y: y + 8, 'font-size': 9.5, 'font-family': 'var(--mono)', fill: 'var(--err)', text: o.o })); } });
    stage.append(svg('path', { d: `M${tx(tc)} 18 L${tx(tc)} 308`, stroke: 'var(--accent)', 'stroke-width': 1.6 }));
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `served <b>${ok}</b>` }), el('span', { class: 'w-stat', html: `cut or refused <b style="color:var(--err)">${bad}</b>` }), el('span', { class: 'w-stat', html: `grace period <b>${S.grace} s</b>` }), el('span', { class: 'w-stat', html: `t = <b>${tc.toFixed(1)} s</b>` }));
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${SC[sc].ev.length}` }), el('div', { class: 't', html: h })); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; tc = -4; render(); say(SC[sc].intro); bStep.disabled = false; }
  async function step(animate) {
    const ev = SC[sc].ev; if (k >= ev.length) return false; const [t, h, tone] = ev[k++]; const g = gen;
    if (animate && !reduced) { const from = tc; const n = 14; for (let i = 1; i <= n; i++) { if (g !== gen) return false; tc = from + (t - from) * i / n; render(); await sleep(40); } }
    tc = t; render(); say(h, tone); if (k >= ev.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(true); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= SC[sc].ev.length) reset();
    if (reduced) { while (await step(false)); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && await step(true)) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
