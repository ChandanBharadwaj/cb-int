/* Disruptions & PDBs (extra): graceful termination timeline: endpoint removal vs preStop vs SIGTERM vs SIGKILL, with request outcomes. */
IA.widget('disruptions-pdb-shutdown', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8s-term-style')) {
    document.head.append(el('style', { id: 'w-k8s-term-style', text: `
.w-term .ln { font: 600 11.5px var(--sans); fill: var(--text-2); }
.w-term .ax { stroke: var(--border); }
.w-term .tk { font: 500 10px var(--mono); fill: var(--text-3); }
.w-term .bar { rx: 4; }
.w-term .mk { font: 700 10.5px var(--mono); }
.w-term .now { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 3 3; }
.w-term .sum { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
` }));
  }
  const R = 3; // routing converged (illustrative: usually a few seconds)
  let pre = 10; let mode = 'graceful'; let grace = 30; let entry = 'exec';
  let gen = 0; let running = false; let k = 0; let steps = []; let speed = 2300;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 760; const H = 250; const X0 = 150; const X1 = 748; const T0 = -4; const T1 = 48;
  const tx = (t) => X0 + ((t - T0) / (T1 - T0)) * (X1 - X0);
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Timeline of pod termination with lanes for routing, kubelet, the app and requests' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const sum = el('div', { class: 'sum' });
  root.classList.add('w-term');
  root.append(el('div', { class: 'w-controls' }, seg([[0, 'no preStop'], [10, 'preStop sleep 10 s']], pre, (v) => { pre = v; reset(); }, 'preStop'),
    seg([['immediate', 'server.shutdown=immediate'], ['graceful', 'server.shutdown=graceful']], mode, (v) => { mode = v; reset(); }, 'Spring shutdown')),
  el('div', { class: 'w-controls' }, seg([[30, 'grace 30 s (default)'], [45, 'grace 45 s']], grace, (v) => { grace = v; reset(); }, 'Grace period'),
    seg([['exec', 'ENTRYPOINT ["java",…] (exec)'], ['shell', 'ENTRYPOINT java … (shell)']], entry, (v) => { entry = v; reset(); }, 'Entrypoint form')),
  el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, sum);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };

  function model() {
    const term = pre; // SIGTERM sent after preStop
    const shell = entry === 'shell';
    const LONG = { a: -2, end: 34, long: true };
    const shorts = []; for (let a = -3; a < R; a++) shorts.push({ a, end: a + 1 });
    const reqs = shorts.concat([LONG]);
    let stopAccept; let exit; let killed = false;
    if (shell) { stopAccept = grace; exit = grace; killed = true; }
    else if (mode === 'immediate') { stopAccept = term; exit = term; }
    else {
      stopAccept = term;
      const inflight = reqs.filter((r) => r.a < term && r.end > term).map((r) => r.end);
      const want = Math.min(term + 30, Math.max(term, ...inflight)); // spring.lifecycle.timeout-per-shutdown-phase 30s
      exit = Math.min(grace, want); killed = want > grace;
    }
    reqs.forEach((r) => { r.res = r.a >= stopAccept ? 'refused' : r.end > exit ? 'cut' : 'ok'; });
    return { term, shell, reqs, stopAccept, exit, killed };
  }
  const col = { ok: 'var(--ok)', refused: 'var(--err)', cut: 'var(--warn)' };
  function draw(m, now) {
    stage.innerHTML = '';
    const lanes = ['routing to pod', 'kubelet', 'app (JVM)', 'requests'];
    lanes.forEach((l, i) => stage.append(svg('text', { class: 'ln', x: 8, y: 34 + i * 50, text: l })));
    for (let t = 0; t <= 45; t += 5) stage.append(svg('line', { class: 'ax', x1: tx(t), x2: tx(t), y1: 12, y2: 214 }), svg('text', { class: 'tk', x: tx(t), y: 230, 'text-anchor': 'middle', text: t + 's' }));
    const bar = (y, a, b, fill, op) => { const bb = Math.min(b, now); if (bb <= a) return; stage.append(svg('rect', { class: 'bar', x: tx(a), y, width: tx(bb) - tx(a), height: 14, fill, opacity: op || 0.85 })); };
    const mark = (t, y, text, fill) => { if (t > now) return; stage.append(svg('line', { x1: tx(t), x2: tx(t), y1: y - 4, y2: y + 18, stroke: fill, 'stroke-width': 2 }), svg('text', { class: 'mk', x: tx(t) + 4, y: y - 6, fill, text })); };
    // routing
    bar(24, T0, R, 'var(--accent)'); mark(0, 24, 'delete', 'var(--text-2)'); mark(R, 24, 'routes removed', 'var(--accent)');
    // kubelet
    if (pre) { bar(74, 0, pre, 'var(--accent-2)', 0.6); }
    mark(m.term, 74, m.shell ? 'SIGTERM → sh (ignored)' : 'SIGTERM', 'var(--warn)');
    if (m.killed) mark(grace, 74, 'SIGKILL', 'var(--err)');
    // app
    bar(124, T0, m.stopAccept, 'var(--ok)', 0.55);
    if (m.exit > m.stopAccept) bar(124, m.stopAccept, m.exit, 'var(--warn)', 0.55);
    if (!m.killed) mark(m.exit, 124, 'exit 0', 'var(--ok)'); else mark(m.exit, 124, 'exit 137', 'var(--err)');
    // requests
    m.reqs.forEach((r, i) => {
      if (r.a > now) return;
      const y = r.long ? 196 : 160 + (i % 2) * 16;
      const end = r.res === 'ok' ? r.end : r.res === 'cut' ? m.exit : r.a + 0.4;
      bar(y, r.a, Math.max(end, r.a + 0.4), r.end > now && r.res === 'ok' ? 'var(--accent)' : (now >= Math.min(r.end, end) ? col[r.res] : 'var(--accent)'), 0.9);
      if (r.long && now >= 0) stage.append(svg('text', { class: 'tk', x: tx(r.end) + 4, y: 207, text: 'report export (36 s)' }));
    });
    stage.append(svg('line', { class: 'now', x1: tx(now), x2: tx(now), y1: 10, y2: 214 }));
  }
  function plan() {
    const m = model(); const S = [];
    S.push({ now: -0.5, say: 'Requests are flowing. A rollout or drain is about to delete this pod. Press Play.' });
    S.push({ now: 0.2, say: `t = 0: the API server sets <code>deletionTimestamp</code> with a ${grace} s grace period. <b>At the same moment</b> the EndpointSlice marks the endpoint terminating, and the kubelet starts ${pre ? 'the <b>preStop</b> sleep' : 'termination: no preStop, so <b>SIGTERM right away</b>'}.` });
    S.push({ now: R, say: `t ≈ ${R} s: kube-proxy on every node and the ingress controller have caught up, so no <i>new</i> requests arrive. (The real delay varies from under a second to several seconds.) ${m.stopAccept < R ? `<b>But the app stopped accepting at ${m.stopAccept} s</b>, so requests routed in between were refused: the classic 502 burst.` : 'The app was still accepting during that window, so nothing was refused.'}`, tone: m.stopAccept < R ? 'err' : 'ok' });
    if (pre) S.push({ now: pre, say: `t = ${pre} s: preStop finishes, and the kubelet sends SIGTERM to PID 1. ${m.shell ? 'PID 1 is <code>/bin/sh</code>, which does not forward it: the JVM never hears about the shutdown.' : mode === 'graceful' ? 'Spring stops accepting connections and waits for in-flight requests (up to <code>timeout-per-shutdown-phase</code>, 30 s).' : 'With <code>server.shutdown=immediate</code> the JVM stops at once and kills in-flight work.'}`, tone: m.shell ? 'warn' : '' });
    else if (!m.shell) S.push({ now: 0.6, say: mode === 'graceful' ? 'Spring got SIGTERM at t = 0 and stopped accepting connections immediately, while traffic was still being routed here.' : 'The JVM exited at t = 0, with requests still in flight and more still being routed here.', tone: 'warn' });
    S.push({ now: Math.max(m.exit, R) + 0.3, say: m.killed ? `t = ${grace} s: the grace period is over. <b>SIGKILL</b> (exit 137). ${m.shell ? 'Shutdown hooks never ran: no graceful Tomcat stop, no Kafka offset commit, no connection close.' : `Spring was still waiting for the 36 s report export. preStop (${pre} s) + the remaining work didn’t fit in ${grace} s.`}` : `t = ${m.exit} s: the JVM exits cleanly (exit 0) and the pod is gone ${m.exit < grace ? `${grace - m.exit} s before the deadline` : 'right at the deadline'}.`, tone: m.killed ? 'err' : 'ok' });
    const c = { ok: 0, refused: 0, cut: 0 }; m.reqs.forEach((r) => c[r.res]++);
    S.push({ now: 47, final: c, say: c.refused + c.cut === 0 && m.shell ? `No request failed, but only by luck: the JVM never saw SIGTERM, the pod sat Terminating for the full ${grace} s and was SIGKILLed, and no shutdown hook ran. Switch to the exec form.` : c.refused + c.cut === 0 ? '<b>Zero failed requests.</b> The recipe: a preStop sleep longer than routing convergence, graceful shutdown for in-flight work, exec-form PID 1, and a grace period ≥ preStop + shutdown time.' : `${c.refused ? `<b>${c.refused} refused</b> (arrived after the app stopped accepting, before routing caught up). ` : ''}${c.cut ? `<b>${c.cut} cut off</b> mid-flight. ` : ''}Change the toggles to reach zero.`, tone: c.refused + c.cut === 0 ? (m.shell ? 'warn' : 'ok') : 'err' });
    return { m, S };
  }
  let M;
  function renderSum(c) {
    sum.innerHTML = '';
    if (!c) return;
    sum.append(el('span', { class: 'w-stat', html: `succeeded <b style="color:var(--ok)">${c.ok}</b>` }), el('span', { class: 'w-stat', html: `refused (502) <b style="color:var(--err)">${c.refused}</b>` }), el('span', { class: 'w-stat', html: `cut mid-flight <b style="color:var(--warn)">${c.cut}</b>` }), el('span', { class: 'w-stat', html: `pod gone at <b>${M.exit} s</b>` }));
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; const p = plan(); M = p.m; steps = p.S; k = 0; bStep.disabled = false; const s = steps[k++]; draw(M, s.now); say(s.say); renderSum(null); }
  function step() { if (k >= steps.length) return false; const s = steps[k++]; draw(M, s.now); say(s.say, s.tone); renderSum(s.final); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && step()); }
    else while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
