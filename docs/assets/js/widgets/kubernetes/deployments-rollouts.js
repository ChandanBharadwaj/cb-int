/* Deployments: a rolling update simulated one Deployment-controller sync at a time, with maxSurge / maxUnavailable, a failing v2, the progress deadline and rollout undo. */
IA.widget('deployments-rollouts', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8dr-style')) {
    document.head.append(el('style', { id: 'w-k8dr-style', text: `
.k8dr svg text { font-family: var(--sans); }
.k8dr .rsl { fill: var(--text); font-size: 12.5px; font-weight: 700; }
.k8dr .rss { fill: var(--text-3); font-size: 10.5px; font-family: var(--mono); }
.k8dr .lane { fill: var(--surface-2); stroke: var(--border); }
.k8dr .pd { transition: opacity .4s; }
.k8dr .pd rect { stroke-width: 1.8; }
.k8dr .pd.ready rect { fill: color-mix(in srgb, var(--ok) 20%, var(--surface)); stroke: var(--ok); }
.k8dr .pd.start rect { fill: var(--surface); stroke: var(--warn); stroke-dasharray: 4 3; }
.k8dr .pd.bad rect { fill: color-mix(in srgb, var(--err) 12%, var(--surface)); stroke: var(--err); stroke-dasharray: 4 3; }
.k8dr .pd.term rect { fill: var(--surface); stroke: var(--k-external); }
.k8dr .pd.term { opacity: .45; }
.k8dr .pd text { font-size: 10px; fill: var(--text); font-family: var(--mono); }
.k8dr .lim { stroke-width: 2; stroke-dasharray: 5 4; }
.k8dr .bar { fill: var(--accent); opacity: .8; }
.k8dr .bar.low { fill: var(--err); }
.k8dr .bt { font-size: 11px; fill: var(--text-2); }
.k8dr .err { fill: var(--err); font-size: 13px; font-weight: 700; }
` }));
  }
  let R = 4, surgeO = '1', unavO = '0', v2ok = true; let gen = 0; let running = false; let speed = 2000; let k = 0;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segR = seg([[4, '4 replicas'], [10, '10 replicas']], () => R, (v) => { R = v; reset(); }, 'Replicas');
  const segSu = seg([['0', '0'], ['1', '1'], ['25%', '25%']], () => surgeO, (v) => { surgeO = v; reset(); }, 'maxSurge');
  const segUn = seg([['0', '0'], ['1', '1'], ['25%', '25%']], () => unavO, (v) => { unavO = v; reset(); }, 'maxUnavailable');
  const segV = seg([[true, 'v2 healthy'], [false, 'v2 fails readiness']], () => v2ok, (v) => { v2ok = v; reset(); }, 'v2 health');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Sync ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3000, 'Slow'], [2000, 'Normal'], [900, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 250', role: 'img', 'aria-label': 'Old and new ReplicaSet lanes with pods, and an availability bar' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('k8dr');
  root.append(el('div', { class: 'w-controls' }, segR, el('span', { class: 'tiny', text: 'maxSurge' }), segSu, el('span', { class: 'tiny', text: 'maxUnavailable' }), segUn),
    el('div', { class: 'w-controls' }, segV), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  const abs = (o, round) => o.endsWith('%') ? round(parseInt(o, 10) / 100 * R) : parseInt(o, 10);
  let pods, target, tick, phase, idle, seq, surge, unav, hist;
  const healthy = (rs) => rs === 'v1' || v2ok;
  function draw(note) {
    stage.innerHTML = '';
    if (surge === 0 && unav === 0) { stage.append(svg('text', { class: 'err', x: 20, y: 120, text: 'Rejected by the API server: maxSurge and maxUnavailable may not both be 0.' })); stats.innerHTML = ''; return; }
    const lanes = [['v1', 'web-6d8 (revision 1, image web:5.0)'], ['v2', 'web-7c9 (revision 2, image web:5.1)']];
    lanes.forEach(([rs, lab], i) => { const y = 14 + i * 84; const n = pods.filter((p) => p.rs === rs && p.st !== 'gone' && p.st !== 'term').length;
      stage.append(svg('rect', { class: 'lane', x: 10, y, width: 740, height: 74, rx: 10 }), svg('text', { class: 'rsl', x: 22, y: y + 20, text: (rs === target ? '▶ ' : '') + lab }),
        svg('text', { class: 'rss', x: 22, y: y + 36, text: `spec.replicas ${n}` }));
      pods.filter((p) => p.rs === rs && p.st !== 'gone').forEach((p, j) => { const x = 170 + j * 44; const c = p.st === 'start' && !healthy(rs) && p.age >= 2 ? 'bad' : p.st;
        const g = svg('g', { class: 'pd ' + c }); g.append(svg('rect', { x, y: y + 14, width: 38, height: 46, rx: 7 }), svg('text', { x: x + 5, y: y + 32, text: p.id }),
          svg('text', { x: x + 5, y: y + 50, text: c === 'ready' ? '✓' : c === 'term' ? 'bye' : c === 'bad' ? '✕' : '…' })); stage.append(g); }); });
    // availability bar
    const avail = pods.filter((p) => p.st === 'ready').length; const total = pods.filter((p) => p.st !== 'gone' && p.st !== 'term').length;
    const y = 190, x0 = 170, w = 560, sc = w / (R + Math.max(surge, 1) + 1);
    stage.append(svg('text', { class: 'bt', x: 22, y: y + 14, text: 'available (ready)' }), svg('rect', { class: 'lane', x: x0, y, width: w, height: 20, rx: 5 }),
      svg('rect', { class: 'bar' + (avail < R - unav ? ' low' : ''), x: x0, y, width: avail * sc, height: 20, rx: 5 }));
    const lim = (v, col, lab, dy) => { stage.append(svg('line', { class: 'lim', x1: x0 + v * sc, x2: x0 + v * sc, y1: y - 6, y2: y + 26, stroke: col }), svg('text', { class: 'bt', x: x0 + v * sc - 30, y: y + 40 + dy, text: lab })); };
    lim(R - unav, 'var(--err)', `min ${R - unav}`, 0); lim(R + surge, 'var(--warn)', `max pods ${R + surge}`, 0);
    stats.innerHTML = ''; const st = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    st(`sync <b>#${tick}</b>`); st(`pods (non-terminating) <b>${total}</b> ≤ ${R} + ${surge}`); st(`available <b>${avail}</b> ≥ ${R} − ${unav}`);
    st(`condition <b>${phase === 'deadline' ? 'Progressing=False (ProgressDeadlineExceeded)' : phase === 'done' ? 'NewReplicaSetAvailable' : 'Progressing=True'}</b>`);
  }
  function sync() {
    tick++; const msgs = []; let changed = false;
    pods.forEach((p) => { if (p.st === 'term') { p.st = 'gone'; changed = true; } else if (p.st === 'start') { p.age++; if (p.age >= 2 && healthy(p.rs)) { p.st = 'ready'; changed = true; msgs.push(`${p.id} became Ready`); } } });
    const live = () => pods.filter((p) => p.st !== 'gone' && p.st !== 'term');
    const newC = live().filter((p) => p.rs === target).length;
    const room = R + surge - live().length;
    const add = Math.min(R - newC, room);
    if (add > 0) { for (let i = 0; i < add; i++) pods.push({ rs: target, st: 'start', age: 0, id: (target === 'v2' ? 'n' : 'o') + (++seq) }); msgs.push(`scaled <b>${target === 'v2' ? 'new' : 'v1'}</b> RS up by ${add} (total now ${live().length} ≤ ${R + surge})`); changed = true; }
    else if (newC < R) msgs.push(`can’t scale ${target === 'v2' ? 'new' : 'v1'} RS up: already at ${live().length} = replicas + maxSurge`);
    const newUnavail = live().filter((p) => p.rs === target && p.st !== 'ready').length;
    const maxDown = live().length - (R - unav) - newUnavail;
    const olds = live().filter((p) => p.rs !== target).sort((a, b) => (a.st === 'ready') - (b.st === 'ready'));
    const down = Math.min(Math.max(0, maxDown), olds.length);
    if (down > 0) { olds.slice(0, down).forEach((p) => { p.st = 'term'; }); msgs.push(`scaled <b>old</b> RS down by ${down} (keeps ≥ ${R - unav} available)`); changed = true; }
    else if (olds.length) msgs.push(`can’t scale old RS down: ${live().length} pods − ${newUnavail} unready new = ${live().length - newUnavail} would drop below ${R - unav} available`);
    const done = live().filter((p) => p.rs === target && p.st === 'ready').length === R && !pods.some((p) => p.rs !== target && p.st !== 'gone');
    return { msgs, changed, done };
  }
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; tick = 0; seq = 0; idle = 0; phase = 'roll'; target = 'v2'; hist = [];
    surge = abs(surgeO, Math.ceil); unav = abs(unavO, Math.floor);
    pods = Array.from({ length: R }, (_, i) => ({ rs: 'v1', st: 'ready', age: 9, id: 'o' + (i + 1) })); seq = R;
    draw(); bStep.disabled = surge === 0 && unav === 0;
    say(surge === 0 && unav === 0 ? 'Both limits are 0: the controller could never replace a pod, so validation rejects this. Pick another combination.'
      : `<code>kubectl set image deploy/web app=web:5.1</code> just created ReplicaSet web-7c9. With ${R} replicas, maxSurge ${surgeO} → <b>${surge}</b> (rounds up), maxUnavailable ${unavO} → <b>${unav}</b> (rounds down). Press Sync or Play.`);
  }
  function step() {
    if (surge === 0 && unav === 0) return false;
    if (phase === 'done' || phase === 'undone') return false;
    if (phase === 'deadline') { phase = 'undo'; target = 'v1'; tick++; draw(); say(`<b>kubectl rollout undo deploy/web</b>: revision 1’s template is copied back, so web-6d8 is the target again. Same rules, other direction: it scales up v1 and removes v2’s unready pods first.`); return true; }
    const r = sync();
    if (r.done) { phase = phase === 'undo' ? 'undone' : 'done'; draw(); say(`Sync #${tick}: ${r.msgs.join('; ')}. ` + (phase === 'undone' ? '<b>Rolled back</b>: v1 is fully available again, and the v2 ReplicaSet is kept at 0 replicas as history.' : `<b>Rollout complete</b> in ${tick} syncs. The old ReplicaSet stays at 0 replicas so <code>rollout undo</code> can use it.`)); bStep.disabled = true; return true; }
    if (!r.changed) idle++; else idle = 0;
    if (idle >= 2 && !v2ok && phase === 'roll') { phase = 'deadline'; draw(); say(`Sync #${tick}: nothing can move. v2 pods never become Ready, and the limits forbid removing more v1 pods. After <code>progressDeadlineSeconds</code> (600 s by default) the controller sets <b>ProgressDeadlineExceeded</b>, and then just waits: <b>no automatic rollback</b>. ${R - unav === R ? 'v1 still serves at full capacity.' : 'v1 serves at reduced capacity.'}`); return true; }
    draw(); say(`Sync #${tick}: ${r.msgs.join('; ') || 'waiting for new pods to become Ready'}.`); return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (phase === 'done' || phase === 'undone') reset();
    if (reduced) { let n = 0; while (step() && n++ < 60); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
