/* Autoscaling (main): HPA control loop simulation, one 15 s sync per step, with tolerance, scale-up policies and scale-down stabilization. */
IA.widget('autoscaling', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8s-hpa-style')) {
    document.head.append(el('style', { id: 'w-k8s-hpa-style', text: `
.w-hpa .ax { stroke: var(--border); stroke-width: 1; }
.w-hpa .gl { stroke: var(--border); stroke-width: .6; stroke-dasharray: 2 4; }
.w-hpa .lbl { font: 500 10.5px var(--mono); fill: var(--text-3); }
.w-hpa .ideal { fill: none; stroke: var(--text-3); stroke-width: 1.6; stroke-dasharray: 5 4; }
.w-hpa .reps { fill: none; stroke: var(--accent); stroke-width: 2.6; }
.w-hpa .rdy { fill: none; stroke: var(--accent-2); stroke-width: 1.6; opacity: .8; }
.w-hpa .now { stroke: var(--accent); stroke-width: 1; opacity: .5; }
.w-hpa .sat { fill: var(--err); opacity: .14; }
.w-hpa .panel { font-family: var(--mono); font-size: 12.5px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; margin-top: 10px; display: grid; gap: 3px; overflow-x: auto; }
.w-hpa .panel .k { color: var(--text-3); }
.w-hpa .panel .hi { color: var(--accent); font-weight: 700; }
.w-hpa .panel .bad { color: var(--err); font-weight: 700; }
.w-hpa .panel .good { color: var(--ok); font-weight: 700; }
.w-hpa .lg { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--text-2); margin-top: 6px; }
.w-hpa .lg i { display: inline-block; width: 18px; height: 3px; vertical-align: middle; margin-right: 5px; border-radius: 2px; }
` }));
  }
  const REQ = 500; const MAXPER = 1000; const TARGET = 60; const MIN = 2; const MAX = 20; const TICKS = 40; const TOL = 0.1;
  const PROF = {
    spike: { l: 'spike at 1:00', init: 3, d: (t) => (t < 4 ? 900 : t < 24 ? 5400 : 1200) },
    ramp: { l: 'steady ramp', init: 3, d: (t) => Math.min(8000, 900 + t * 220) },
    drop: { l: 'load drops at 1:30', init: 18, d: (t) => (t < 6 ? 5400 : 900) } };
  let prof = 'spike'; let win = 300; let gen = 0; let running = false; let speed = 900;
  let t; let pods; let recs; let hist;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step › (15 s)' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[1500, 'Slow'], [900, 'Normal'], [400, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const W = 760; const H = 260; const X0 = 46; const X1 = 744; const Y0 = 228; const Y1 = 16;
  const xs = (i) => X0 + (i / TICKS) * (X1 - X0); const ys = (r) => Y0 - (Math.min(r, 22) / 22) * (Y0 - Y1);
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Chart of replicas over time against the replicas the load needs' });
  const panel = el('div', { class: 'panel', 'aria-live': 'polite' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-hpa');
  root.append(el('div', { class: 'w-controls' }, seg(Object.entries(PROF).map(([k, v]) => [k, v.l]), prof, (v) => { prof = v; reset(); }, 'Load pattern'),
    seg([[300, 'scaleDown window 300 s (default)'], [60, '60 s'], [0, '0 s']], win, (v) => { win = v; reset(); }, 'Scale-down stabilization window')),
  el('div', { class: 'w-stage' }, stage),
  el('div', { class: 'lg' }, el('span', { html: '<i style="background:var(--accent)"></i>replicas (spec)' }), el('span', { html: '<i style="background:var(--accent-2)"></i>ready replicas' }), el('span', { html: '<i style="background:var(--text-3)"></i>replicas the load needs at 60%' }), el('span', { html: '<i style="background:var(--err);opacity:.4;height:8px"></i>saturated' })),
  el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), panel, narr, stats);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const mmss = (tk) => `${Math.floor((tk * 15) / 60)}:${String((tk * 15) % 60).padStart(2, '0')}`;

  function draw() {
    stage.innerHTML = '';
    [0, 5, 10, 15, 20].forEach((r) => stage.append(svg('line', { class: 'gl', x1: X0, x2: X1, y1: ys(r), y2: ys(r) }), svg('text', { class: 'lbl', x: X0 - 8, y: ys(r) + 4, 'text-anchor': 'end', text: String(r) })));
    for (let i = 0; i <= TICKS; i += 8) stage.append(svg('text', { class: 'lbl', x: xs(i), y: Y0 + 16, 'text-anchor': 'middle', text: mmss(i) }));
    stage.append(svg('line', { class: 'ax', x1: X0, x2: X1, y1: Y0, y2: Y0 }), svg('text', { class: 'lbl', x: X0, y: 10, text: 'replicas' }), svg('text', { class: 'lbl', x: X1, y: Y0 + 30, 'text-anchor': 'end', text: 'time (each step = one 15 s HPA sync)' }));
    hist.forEach((h, i) => { if (h.sat) stage.append(svg('rect', { class: 'sat', x: xs(i), y: Y1, width: xs(1) - xs(0), height: Y0 - Y1 })); });
    const id = []; for (let i = 0; i <= TICKS; i++) id.push(`${xs(i)},${ys(PROF[prof].d(i) / (REQ * TARGET / 100))}`);
    stage.append(svg('polyline', { class: 'ideal', points: id.join(' ') }));
    const step = (key) => { const p = []; hist.forEach((h, i) => { p.push(`${xs(i)},${ys(h[key])}`); p.push(`${xs(i + 1)},${ys(h[key])}`); }); return p.join(' '); };
    if (hist.length) { stage.append(svg('polyline', { class: 'rdy', points: step('ready') }), svg('polyline', { class: 'reps', points: step('n') })); }
    stage.append(svg('line', { class: 'now', x1: xs(t), x2: xs(t), y1: Y1, y2: Y0 }));
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; bStep.disabled = false;
    t = 0; pods = Array.from({ length: PROF[prof].init }, () => ({ readyAt: -1 })); recs = []; hist = [];
    draw(); panel.innerHTML = ''; panel.append(el('div', { html: '<span class="k">desiredReplicas = ceil(currentReplicas × currentUtilization / targetUtilization)</span>' }), el('div', { html: `<span class="k">target</span> ${TARGET}% of request (${REQ}m) · <span class="k">tolerance</span> ${TOL} · <span class="k">min/max</span> ${MIN}/${MAX}` }));
    renderStats(PROF[prof].d(0), PROF[prof].init, PROF[prof].init, null);
    say(`${PROF[prof].init} replicas, each requesting ${REQ}m CPU. New pods need 2 syncs (30 s of JVM start-up) before they are ready. Press Play or Step.`);
  }
  function renderStats(D, n, ready, util) {
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `t <b>${mmss(t)}</b>` }), el('span', { class: 'w-stat', html: `CPU demand <b>${(D / 1000).toFixed(1)} cores</b>` }),
      el('span', { class: 'w-stat', html: `replicas <b>${n}</b> (ready ${ready})` }), util != null ? el('span', { class: 'w-stat', html: `avg utilization <b>${Math.round(util)}%</b>` }) : null);
  }
  function tick() {
    if (t >= TICKS) return false;
    const D = PROF[prof].d(t); const N = pods.length; const ready = pods.filter((p) => p.readyAt <= t).length;
    const usage = Math.min(D, ready * MAXPER); const sat = D > ready * MAXPER;
    const util = (usage / (N * REQ)) * 100; const ratio = util / TARGET;
    const inTol = Math.abs(ratio - 1) <= TOL;
    let raw = inTol ? N : Math.ceil(N * ratio); const clamped = Math.max(MIN, Math.min(MAX, raw));
    recs.push({ t, r: clamped });
    let desired = N; let why = '';
    if (clamped > N) {
      const cap = Math.max(N * 2, N + 4); desired = Math.min(clamped, cap);
      why = `scale up: policies allow max(${N}×2, ${N}+4) = ${cap} → <span class="hi">${desired}</span>${clamped > cap ? ' (capped)' : ''}`;
    } else if (clamped < N) {
      const back = win / 15; const inWin = recs.filter((x) => x.t > t - back - (win ? 0 : 1) && x.t <= t);
      const stab = Math.max(...inWin.map((x) => x.r));
      desired = Math.min(N, stab);
      why = win ? `scale down: highest recommendation in the last ${win} s = ${stab} → <span class="${desired < N ? 'hi' : 'bad'}">${desired}</span>${desired === N ? ' (held by the stabilization window)' : ''}` : `scale down: window 0 s → <span class="hi">${desired}</span>`;
    } else why = inTol ? `|${ratio.toFixed(2)} − 1| ≤ ${TOL}: inside tolerance, <span class="good">no change</span>` : 'already at the recommendation';
    if (desired > N) for (let i = N; i < desired; i++) pods.push({ readyAt: t + 2 });
    if (desired < N) { pods.sort((a, b) => b.readyAt - a.readyAt); pods.splice(0, N - desired); }
    hist.push({ n: N, ready, sat });
    panel.innerHTML = '';
    panel.append(el('div', { html: `<span class="k">sync ${t + 1} @ ${mmss(t)}</span> · demand ${(D / 1000).toFixed(2)} cores · ready pods ${ready}/${N}${sat ? ' · <span class="bad">ready pods saturated</span>' : ''}` }),
      el('div', { html: `<span class="k">utilization</span> = ${(usage / 1000).toFixed(2)} cores ÷ (${N} × ${REQ}m) = <span class="hi">${Math.round(util)}%</span>${ready < N ? ' <span class="k">(unready pods count as 0% on scale-up)</span>' : ''}` }),
      el('div', { html: `<span class="k">ratio</span> ${Math.round(util)} / ${TARGET} = ${ratio.toFixed(2)} → ${inTol ? 'within tolerance' : `ceil(${N} × ${ratio.toFixed(2)}) = ${raw}`}${raw !== clamped ? ` → clamp to ${clamped}` : ''}` }),
      el('div', { html: why }));
    renderStats(D, desired, pods.filter((p) => p.readyAt <= t + 1).length, util);
    let msg = ''; let tone = '';
    if (sat) { msg = `Demand exceeds what the ${ready} ready pod${ready === 1 ? '' : 's'} can serve: requests queue and latency climbs. New pods are still starting.`; tone = 'err'; }
    else if (desired > N) msg = `The HPA scales ${N} → ${desired}. The new pods show up in the blue line now, but in the green “ready” line only 30 s later.`;
    else if (desired < N) msg = `Load is down, and the HPA removes ${N - desired} pod${N - desired === 1 ? '' : 's'}.`;
    else if (clamped < N) { msg = `The raw recommendation is ${clamped}, but the ${win} s window remembers higher values, so replicas stay at ${N}. This prevents flapping, and costs money.`; tone = 'warn'; }
    else msg = inTol ? 'Inside the 10% tolerance band: the HPA deliberately does nothing.' : 'Stable.';
    say(msg, tone);
    t++; draw();
    if (t >= TICKS) { bStep.disabled = true; say(msg + ' End of run. Try another window or load pattern.', tone); }
    return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; tick(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (t >= TICKS) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && tick()); }
    else while (running && g === gen && tick()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
