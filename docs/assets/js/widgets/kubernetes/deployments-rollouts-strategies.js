/* Release strategies compared: rolling update, blue-green and weighted canary. Pods per version and the traffic split at each phase. */
IA.widget('deployments-rollouts-strategies', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8st-style')) {
    document.head.append(el('style', { id: 'w-k8st-style', text: `
.k8st svg text { font-family: var(--sans); }
.k8st .pool { fill: var(--surface-2); stroke: var(--border); }
.k8st .pl { fill: var(--text); font-size: 12.5px; font-weight: 700; }
.k8st .pp { stroke-width: 1.8; transition: opacity .4s; }
.k8st .pp.v1 { fill: color-mix(in srgb, var(--k-service) 22%, var(--surface)); stroke: var(--k-service); }
.k8st .pp.v2 { fill: color-mix(in srgb, var(--ok) 22%, var(--surface)); stroke: var(--ok); }
.k8st .pp.st { fill: var(--surface); stroke-dasharray: 4 3; }
.k8st .rt { fill: var(--accent-soft); stroke: var(--accent); }
.k8st .path { fill: none; stroke: var(--accent); stroke-linecap: round; transition: stroke-width .5s, opacity .5s; }
.k8st .pct { font-size: 14px; font-weight: 800; fill: var(--text); font-family: var(--mono); }
.k8st .sm { font-size: 11px; fill: var(--text-2); }
` }));
  }
  const PH = {
    rolling: [[4, 0, 0, 0, 'Start: 4 v1 pods take all traffic.'], [4, 1, 1, 0, 'Surge one v2 pod (maxSurge 1). It is not Ready yet, so it gets nothing.'], [3, 1, 0, 25, 'v2 pod Ready → one v1 pod removed. The Service splits by <b>ready pod count</b>: 1 of 4 ≈ 25% to v2.'],
      [2, 2, 0, 50, 'Halfway. Both versions serve real users at the same time, so they must be compatible (API, schema, cache formats).'], [1, 3, 0, 75, 'You cannot choose the share: it follows the pod ratio, and rollback means another rolling update.'], [0, 4, 0, 100, 'Done. Peak cost: 5 pods. Simple and built in, but no control over exposure.']],
    bluegreen: [[4, 0, 0, 0, 'Blue (v1) is live with 4 pods.'], [4, 4, 4, 0, 'Deploy green (v2) at <b>full size</b> as a separate Deployment. No user traffic yet; the Service still selects <code>version: blue</code>.'],
      [4, 4, 0, 0, 'Green is Ready. Run smoke tests through a separate <code>web-green</code> Service. Cost: <b>double capacity</b> (8 pods).'], [4, 4, 0, 100, 'Flip the Service selector to <code>version: green</code>. All <b>new</b> connections move at once. Existing keep-alive connections stay on blue until they close.'],
      [4, 4, 0, 100, 'Keep blue running for a while: rollback is one selector change, seconds, no pod starts.'], [0, 4, 0, 100, 'Confident: scale blue to 0. Cleanest switch and fastest rollback, at twice the cost during the release.']],
    canary: [[4, 0, 0, 0, '4 stable (v1) pods take all traffic.'], [4, 1, 0, 0, 'Deploy a canary Deployment with 1 pod. With a weighted route (Gateway API, mesh, ingress), weight starts at 0.'],
      [4, 1, 0, 5, 'Set weight <b>5%</b>. Without weights, a shared Service would give it 1 of 5 pods ≈ 20%, far more than you wanted.'], [4, 1, 0, 5, 'Analyse: compare the canary’s error rate and p99 latency with stable. Bad? Set weight 0: only 5% of users ever saw it.'],
      [4, 2, 0, 25, 'Good: step up to 25%, scaling the canary so it can carry it.'], [2, 4, 0, 50, '50%.'], [0, 4, 0, 100, 'Promote: v2 takes 100% and becomes stable. Argo Rollouts and Flagger automate these steps and the analysis.']]
  };
  let strat = 'rolling'; let gen = 0; let running = false; let speed = 2600; let k = 0;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segT = seg([['rolling', 'Rolling update'], ['bluegreen', 'Blue-green'], ['canary', 'Canary (weighted)']], () => strat, (v) => { strat = v; reset(); }, 'Strategy');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 760 260', role: 'img', 'aria-label': 'A router on the left sending traffic to a v1 pool and a v2 pool' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('k8st');
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  const p1 = svg('path', { class: 'path', d: 'M180 130 C 260 130, 260 70, 330 70' }); const p2 = svg('path', { class: 'path', d: 'M180 130 C 260 130, 260 190, 330 190' });
  const t1 = svg('text', { class: 'pct', x: 236, y: 84, text: '' }); const t2 = svg('text', { class: 'pct', x: 236, y: 196, text: '' });
  const poolG = svg('g');
  stage.append(svg('rect', { class: 'rt', x: 20, y: 100, width: 160, height: 60, rx: 10 }), svg('text', { class: 'pl', x: 32, y: 124, text: 'Service / Route' }), svg('text', { class: 'sm', x: 32, y: 144, text: 'users →' }),
    p1, p2, t1, t2, svg('rect', { class: 'pool', x: 330, y: 22, width: 420, height: 96, rx: 10 }), svg('rect', { class: 'pool', x: 330, y: 142, width: 420, height: 96, rx: 10 }),
    svg('text', { class: 'pl', x: 344, y: 44, text: 'v1 (stable / blue)' }), svg('text', { class: 'pl', x: 344, y: 164, text: 'v2 (new / green / canary)' }), poolG);
  function draw(ph) {
    const [a, b, starting, pct] = ph; poolG.innerHTML = '';
    for (let i = 0; i < a; i++) poolG.append(svg('rect', { class: 'pp v1', x: 344 + i * 46, y: 56, width: 38, height: 46, rx: 7 }));
    for (let i = 0; i < b; i++) poolG.append(svg('rect', { class: 'pp v2' + (i >= b - starting ? ' st' : ''), x: 344 + i * 46, y: 176, width: 38, height: 46, rx: 7 }));
    p1.style.strokeWidth = 2 + (100 - pct) * 0.16; p2.style.strokeWidth = 2 + pct * 0.16; p1.style.opacity = pct === 100 ? 0.15 : 1; p2.style.opacity = pct === 0 ? 0.15 : 1;
    t1.textContent = (100 - pct) + '%'; t2.textContent = pct + '%';
    stats.innerHTML = ''; const st = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    st(`pods running <b>${a + b}</b>`); st(`extra capacity <b>${Math.max(0, a + b - 4)}</b> pods`); st(`users on v2 <b>${pct}%</b>`);
  }
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  if (reduced) { p1.style.transition = 'none'; p2.style.transition = 'none'; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; draw(PH[strat][0]); bStep.disabled = false; say('Press Play or Step to walk the release. Dashed pods are starting and not Ready.'); }
  function step() { const L = PH[strat]; if (k >= L.length) return false; const ph = L[k++]; draw(ph); say(`<b>${k}/${L.length}</b> · ` + ph[4]); if (k >= L.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= PH[strat].length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
