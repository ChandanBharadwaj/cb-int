/* Health groups & probes: three pods, a Service and a database through startup, a DB outage, recovery and a graceful shutdown, under three health-group policies. */
IA.widget('actuator-observability', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-act-style')) {
    document.head.append(el('style', { id: 'w-act-style', text: `
.w-act svg text { font-family: var(--mono); }
.w-act .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.6; transition: fill .3s, stroke .3s, opacity .3s; }
.w-act .bx.down { stroke: var(--err); stroke-width: 2.4; fill: color-mix(in srgb, var(--err) 10%, var(--surface)); }
.w-act .bx.warn { stroke: var(--warn); stroke-width: 2.4; fill: color-mix(in srgb, var(--warn) 12%, var(--surface)); }
.w-act .bx.ok { stroke: var(--ok); stroke-width: 2; }
.w-act .bx.gone { opacity: .35; stroke-dasharray: 5 4; }
.w-act .dot.up { fill: var(--ok); } .w-act .dot.down { fill: var(--err); } .w-act .dot.oos { fill: var(--warn); } .w-act .dot.na { fill: var(--text-3); }
.w-act .ln { fill: none; stroke: var(--edge); stroke-width: 1.7; }
.w-act .ln.on { stroke: var(--ok); stroke-width: 2.4; }
.w-act .ln.off { stroke: var(--text-3); stroke-dasharray: 4 5; opacity: .5; }
.w-act .ln.err { stroke: var(--err); stroke-width: 2.2; stroke-dasharray: 6 4; }
.w-act-json { font-family: var(--mono); font-size: 12px; line-height: 1.5; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-2); margin-top: 10px; }
` }));
  }
  const POL = {
    def: { label: 'default groups', yaml: 'management.endpoint.health.probes.enabled: true\n# liveness  = livenessState\n# readiness = readinessState' },
    ready: { label: 'db in readiness', yaml: 'management.endpoint.health.group.readiness.include: readinessState,db' },
    live: { label: 'db in liveness (anti-pattern)', yaml: 'management.endpoint.health.group.liveness.include: livenessState,db   # don’t' }
  };
  let pol = 'def'; let k = 0; let gen = 0; let running = false; let speed = 2600;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segP = seg(Object.keys(POL).map((p) => [p, POL[p].label]), pol, (v) => { pol = v; reset(); }, 'Health group policy');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const yamlHost = el('div', { style: { marginBottom: '10px' } });
  const stage = svg('svg', { viewBox: '0 0 760 270', role: 'img', 'aria-label': 'Kubernetes Service, three pods with liveness and readiness state, and the database' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const json = el('div', { class: 'w-act-json', 'aria-label': 'Health endpoint of pod a' });
  root.classList.add('w-act');
  root.append(el('div', { class: 'w-controls' }, segP), yamlHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, json);

  // state per step: db up?, pods [{live, ready, restarts, phase}]
  function plan() {
    const P = (live, ready, restarts, phase) => ({ live, ready, restarts, phase });
    const S = [];
    S.push({ db: true, pods: [P('up', 'oos', 0, 'starting'), P('up', 'oos', 0, 'starting'), P('up', 'oos', 0, 'starting')], say: 'Pods start. Once the context is refreshed, <b>liveness</b> is <code>CORRECT</code> (UP), but while runners and warm-up are still going, <b>readiness</b> stays <code>REFUSING_TRAFFIC</code> (OUT_OF_SERVICE), so the Service sends them nothing. Boot enables the probe groups automatically when it detects Kubernetes. Give slow starters a <code>startupProbe</code>.' });
    S.push({ db: true, pods: [P('up', 'up', 0, 'ready'), P('up', 'up', 0, 'ready'), P('up', 'up', 0, 'ready')], tone: 'ok', say: 'After <code>ApplicationReadyEvent</code> (runners done), readiness flips to <code>ACCEPTING_TRAFFIC</code>. <code>/actuator/health/readiness</code> returns 200 and the pods join the Service endpoints.' });
    if (pol === 'def') {
      S.push({ db: false, pods: [P('up', 'up', 0, '500s'), P('up', 'up', 0, '500s'), P('up', 'up', 0, '500s')], tone: 'warn', say: 'The database goes down. <code>/actuator/health</code> (all contributors) is DOWN with HTTP 503, but neither probe group includes <code>db</code>. Pods stay in the Service and answer with errors, ideally fast thanks to connection timeouts.' });
      S.push({ db: false, pods: [P('up', 'up', 0, '500s'), P('up', 'up', 0, '500s'), P('up', 'up', 0, '500s')], say: 'Two minutes later: no restarts, no endpoint churn. For a dependency that <i>every</i> pod shares, this is often the right call: taking all pods out wouldn’t help anyone, and the errors are honest.' });
      S.push({ db: true, pods: [P('up', 'up', 0, 'ready'), P('up', 'up', 0, 'ready'), P('up', 'up', 0, 'ready')], tone: 'ok', say: 'The database recovers and requests succeed again immediately. Nothing had to restart or warm up.' });
    } else if (pol === 'ready') {
      S.push({ db: false, pods: [P('up', 'down', 0, 'removed'), P('up', 'down', 0, 'removed'), P('up', 'down', 0, 'removed')], tone: 'warn', say: 'The database goes down; readiness (which includes <code>db</code>) is DOWN on every pod. Kubernetes removes all of them from the endpoints. Clients now get connection errors or 503s from the ingress instead of the app’s own error responses.' });
      S.push({ db: false, pods: [P('up', 'down', 0, 'removed'), P('up', 'down', 0, 'removed'), P('up', 'down', 0, 'removed')], say: 'No restarts: liveness is still UP, the JVMs stay warm. Good for a dependency that only <i>some</i> pods lose (a per-zone cache); for a shared database it turns your error responses into a blank outage.' });
      S.push({ db: true, pods: [P('up', 'up', 0, 'ready'), P('up', 'up', 0, 'ready'), P('up', 'up', 0, 'ready')], tone: 'ok', say: 'The database recovers. After the next readiness probe periods the pods return to the endpoints, warm and ready.' });
    } else {
      S.push({ db: false, pods: [P('down', 'up', 0, 'failing'), P('down', 'up', 0, 'failing'), P('down', 'up', 0, 'failing')], tone: 'err', say: 'The database goes down and <b>liveness</b> (which includes <code>db</code>) is DOWN everywhere. After <code>failureThreshold</code> failed probes, the kubelet decides the JVMs are broken and <b>restarts every pod</b>.' });
      S.push({ db: false, pods: [P('down', 'oos', 3, 'CrashLoop'), P('down', 'oos', 2, 'CrashLoop'), P('down', 'oos', 3, 'CrashLoop')], tone: 'err', say: 'Restarted pods find the database still down, fail liveness again and are restarted again: <code>CrashLoopBackOff</code>, with growing back-off delays. A database problem has become an application outage.' });
      S.push({ db: true, pods: [P('up', 'oos', 3, 'back-off'), P('up', 'oos', 2, 'back-off'), P('up', 'up', 3, 'ready')], tone: 'warn', say: 'The database is back, but most pods are waiting out their back-off, then starting cold, and all of them open new connection pools at once. Recovery takes minutes longer than the outage. Liveness should only answer “is this JVM wedged?”.' });
    }
    S.push({ db: true, pods: [P('up', 'oos', 0, 'draining'), P('up', 'up', 0, 'ready'), P('up', 'up', 0, 'ready')], term: true, tone: 'ok', say: 'A rolling deploy sends <code>SIGTERM</code> to pod a. Boot sets readiness to <code>REFUSING_TRAFFIC</code>; with graceful shutdown (<code>server.shutdown=graceful</code>, the default since Boot 3.4) the server stops accepting new requests and finishes in-flight ones, up to <code>spring.lifecycle.timeout-per-shutdown-phase</code>.' });
    return S;
  }
  let steps = []; let st;
  const PX = 270; const PY = (i) => 20 + i * 82; const PW = 250; const PH = 66;
  function render() {
    stage.innerHTML = '';
    const ready = st.pods.filter((p) => p.ready === 'up' && p.phase !== 'draining').length;
    stage.append(svg('rect', { class: 'bx ' + (ready ? 'ok' : 'down'), x: 10, y: 100, width: 190, height: 70, rx: 10 }), svg('text', { x: 24, y: 128, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: 'Service shop' }), svg('text', { x: 24, y: 150, 'font-size': 12, fill: ready ? 'var(--text-2)' : 'var(--err)', text: `endpoints: ${ready} / 3` }));
    stage.append(svg('rect', { class: 'bx ' + (st.db ? 'ok' : 'down'), x: 600, y: 100, width: 150, height: 70, rx: 10 }), svg('text', { x: 614, y: 128, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: 'PostgreSQL' }), svg('text', { x: 614, y: 150, 'font-size': 12, fill: st.db ? 'var(--ok)' : 'var(--err)', text: st.db ? 'UP' : 'DOWN' }));
    st.pods.forEach((p, i) => {
      const y = PY(i); const inSvc = p.ready === 'up' && p.phase !== 'draining';
      stage.append(svg('path', { class: 'ln ' + (inSvc ? 'on' : 'off'), d: `M200 135 C 235 135, 235 ${y + PH / 2}, ${PX} ${y + PH / 2}` }));
      stage.append(svg('path', { class: 'ln ' + (st.db ? (p.phase === 'starting' ? 'off' : 'on') : 'err'), d: `M${PX + PW} ${y + PH / 2} C ${PX + PW + 40} ${y + PH / 2}, 560 135, 600 135` }));
      const cls = p.live === 'down' ? 'down' : (p.ready !== 'up' || p.phase === '500s') ? 'warn' : 'ok';
      stage.append(svg('rect', { class: 'bx ' + cls, x: PX, y, width: PW, height: PH, rx: 10 }),
        svg('text', { x: PX + 12, y: y + 22, 'font-size': 13.5, 'font-weight': 700, fill: 'var(--text)', text: `pod ${'abc'[i]}` }),
        svg('text', { x: PX + 80, y: y + 22, 'font-size': 11.5, fill: 'var(--text-3)', text: p.phase + (p.restarts ? ` · restarts ${p.restarts}` : '') }));
      [['liveness', p.live], ['readiness', p.ready]].forEach(([n, v], j) => {
        const x = PX + 12 + j * 118;
        const lab = { up: 'UP', down: 'DOWN', oos: 'OOS', na: '—' }[v];
        stage.append(svg('circle', { class: 'dot ' + v, cx: x + 6, cy: y + 46, r: 6 }), svg('text', { x: x + 18, y: y + 50, 'font-size': 11.5, fill: 'var(--text-2)', text: `${n} ${lab}` }));
      });
    });
    const a = st.pods[0];
    const comp = { db: st.db ? 'UP' : 'DOWN', diskSpace: 'UP', livenessState: a.phase === 'CrashLoop' || a.phase === 'back-off' ? 'n/a (restarting)' : 'UP', ping: 'UP', readinessState: a.ready === 'oos' && a.phase !== 'CrashLoop' ? 'OUT_OF_SERVICE' : 'UP' };
    const overall = Object.values(comp).includes('DOWN') ? 'DOWN' : comp.readinessState === 'OUT_OF_SERVICE' ? 'OUT_OF_SERVICE' : 'UP';
    json.textContent = `GET /actuator/health            → ${overall === 'UP' ? 200 : 503} ${overall}\n  components: ${Object.entries(comp).map(([kk, v]) => `${kk}=${v}`).join(', ')}\nGET /actuator/health/liveness   → ${a.live === 'up' ? '200 UP' : '503 DOWN'}\nGET /actuator/health/readiness  → ${a.ready === 'up' ? '200 UP' : a.ready === 'down' ? '503 DOWN' : '503 OUT_OF_SERVICE'}   (pod a)`;
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan();
    st = { db: true, pods: [0, 1, 2].map(() => ({ live: 'na', ready: 'na', restarts: 0, phase: 'not started' })) };
    yamlHost.innerHTML = ''; yamlHost.append(ctx.codeBox(POL[pol].yaml, 'yaml'));
    render(); say('A Service in front of three pods that share one database. Pick a health-group policy and press Play or Step.'); bStep.disabled = false;
  }
  function step() { if (k >= steps.length) return false; st = steps[k++]; render(); say(st.say, st.tone); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
