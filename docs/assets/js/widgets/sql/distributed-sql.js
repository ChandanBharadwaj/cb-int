/* Distributed SQL: animate a Raft write (client → leader → followers → majority → commit) across regions, with a running latency tally. */
IA.widget('distributed-sql', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const RTT = { 'US|EU': 75, 'US|AP': 190, 'EU|AP': 120 };
  const rtt = (a, b) => (a === b ? 1 : RTT[[a, b].sort((x, y) => ['US', 'EU', 'AP'].indexOf(x) - ['US', 'EU', 'AP'].indexOf(y)).join('|')]);
  const NAME = { US: 'us-east', EU: 'eu-west', AP: 'ap-south' };
  let client = 'EU', leader = 'US', topo = 'multi', gen = 0, k = 0, frames = [], running = false, speed = 2400;
  const mkSeg = (label, items, cur, on) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const R3 = [['US', 'US'], ['EU', 'EU'], ['AP', 'AP']];
  const W = 540, Hh = 400;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${Hh}`, role: 'img', 'aria-label': 'Three replicas, a client, and messages flowing between them', style: { width: '100%', height: 'auto' } });
  const stats = el('div', { class: 'w-stats' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.append(
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'replicas' }), mkSeg('Replica placement', [['multi', '3 regions'], ['single', '3 AZs in us-east']], topo, (v) => { topo = v; reset(); })),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'client in' }), mkSeg('Client region', R3, client, (v) => { client = v; reset(); }),
      el('span', { class: 'tiny', text: 'leader in' }), mkSeg('Leader region', R3, leader, (v) => { leader = v; reset(); })),
    el('div', { class: 'w-stage' }, stage), stats,
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), mkSeg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], 2400, (v) => { speed = v; })), cap);

  const POS = { multi: { US: [125, 125], EU: [320, 60], AP: [445, 215] }, single: { a: [110, 80], b: [300, 80], c: [205, 200] } };
  const CPOS = { US: [80, 355], EU: [270, 355], AP: [460, 355] };
  let nodes = {}, logs = {}, packetLayer, tally;
  function replicas() {
    if (topo === 'multi') return ['US', 'EU', 'AP'].map((r) => ({ id: r, region: r, label: NAME[r], pos: POS.multi[r] }));
    return ['a', 'b', 'c'].map((z) => ({ id: z, region: 'US', label: 'us-east-' + z, pos: POS.single[z] }));
  }
  function draw(reps, L) {
    stage.innerHTML = '';
    const links = svg('g');
    for (let i = 0; i < reps.length; i++) for (let j = i + 1; j < reps.length; j++) {
      const [a, b] = [reps[i], reps[j]]; const ms = topo === 'multi' ? rtt(a.region, b.region) : 1;
      links.append(svg('line', { x1: a.pos[0], y1: a.pos[1], x2: b.pos[0], y2: b.pos[1], stroke: 'var(--border)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }),
        svg('text', { x: (a.pos[0] + b.pos[0]) / 2, y: (a.pos[1] + b.pos[1]) / 2 - 6, 'font-size': 16, fill: 'var(--text-3)', 'text-anchor': 'middle', text: ms + ' ms' }));
    }
    const cp = CPOS[client];
    links.append(svg('line', { x1: cp[0], y1: cp[1], x2: L.pos[0], y2: L.pos[1], stroke: 'var(--accent)', 'stroke-opacity': .35, 'stroke-width': 2 }));
    stage.append(links);
    nodes = {}; logs = {};
    reps.forEach((r) => { const isL = r.id === L.id; const g = svg('g');
      const c = svg('circle', { cx: r.pos[0], cy: r.pos[1], r: 42, fill: 'var(--surface)', stroke: isL ? 'var(--accent)' : 'var(--border)', 'stroke-width': isL ? 3 : 2 });
      g.append(c, svg('text', { x: r.pos[0], y: r.pos[1] - 4, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: 'var(--text)', text: isL ? '★ leader' : 'follower' }),
        svg('text', { x: r.pos[0], y: r.pos[1] + 15, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--text-3)', text: r.label }));
      const lg = svg('text', { x: r.pos[0], y: r.pos[1] + 62, 'text-anchor': 'middle', 'font-size': 15, 'font-family': 'var(--mono)', fill: 'var(--text-2)', text: 'log: –' });
      g.append(lg); stage.append(g); nodes[r.id] = c; logs[r.id] = lg; });
    const cg = svg('g'); cg.append(svg('rect', { x: cp[0] - 70, y: cp[1] - 22, width: 140, height: 44, rx: 8, fill: 'var(--accent-soft)', stroke: 'var(--accent)' }),
      svg('text', { x: cp[0], y: cp[1] + 6, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: 'var(--accent)', text: '💻 client ' + client }));
    stage.append(cg);
    packetLayer = svg('g'); stage.append(packetLayer);
  }
  async function fly(from, to, color, g, label) {
    const p = svg('g'); const c = svg('circle', { r: 10, fill: color }); p.append(c); if (label) p.append(svg('text', { x: 13, y: 5, 'font-size': 15, 'font-weight': 700, fill: color, text: label }));
    packetLayer.append(p); const dur = reduced ? 1 : Math.min(900, speed * 0.4); const t0 = performance.now();
    await new Promise((res) => { const tick = (now) => { if (g !== gen) { p.remove(); return res(); } const t = Math.min(1, (now - t0) / dur);
      p.setAttribute('transform', `translate(${from[0] + (to[0] - from[0]) * t},${from[1] + (to[1] - from[1]) * t})`); if (t < 1) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    if (g === gen) setTimeout(() => p.remove(), 300);
  }
  let elapsed = 0;
  const paintStats = (maj) => { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `elapsed <b>${Math.round(elapsed)} ms</b>` }), el('span', { class: 'w-stat', html: `votes <b>${maj}</b> / 3 (need 2)` })); };
  function build() {
    const reps = replicas(); const L = topo === 'multi' ? reps.find((r) => r.id === leader) : reps[0]; const F = reps.filter((r) => r !== L);
    draw(reps, L); elapsed = 0; paintStats(0);
    const lr = L.region; const cl = rtt(client, lr); const fr = F.map((f) => ({ f, ms: topo === 'multi' ? rtt(lr, f.region) : 1 })).sort((a, b) => a.ms - b.ms);
    const fast = fr[0], slow = fr[1]; const cp = CPOS[client];
    const out = [];
    out.push([`The client in ${NAME[client]} sends <code>UPDATE … WHERE id = 42</code>. The range holding id 42 has its leader in ${L.label}. ${client === lr ? 'Same region: about 0.5 ms one way.' : `Different region: half of a ${cl} ms round trip just to get there.`}`,
      () => { fly(cp, L.pos, 'var(--accent)', gen, 'write'); elapsed += cl / 2; paintStats(0); }]);
    out.push(['The leader appends the write to its Raft log. It is <b>not committed yet</b>: one copy is not durable enough. That is 1 vote of the 2 needed.',
      () => { logs[L.id].textContent = 'log: w42 …'; nodes[L.id].setAttribute('fill', 'var(--accent-soft)'); paintStats(1); }]);
    out.push([`The leader sends <b>AppendEntries</b> to both followers in parallel (${fr.map((x) => x.f.label + ' ' + x.ms + ' ms RTT').join(', ')}).`,
      () => { F.forEach((f) => fly(L.pos, f.pos, 'var(--warn)', gen, 'append')); }]);
    out.push([`${fast.f.label} persists the entry and acks first. Leader + 1 follower = <b>majority (2 of 3): committed</b>. The leader waited ${fast.ms} ms, the RTT to its <i>nearest</i> follower.`,
      () => { logs[fast.f.id].textContent = 'log: w42 ✓'; logs[L.id].textContent = 'w42 committed ✓'; nodes[fast.f.id].setAttribute('fill', 'var(--accent-soft)'); fly(fast.f.pos, L.pos, 'var(--ok)', gen, 'ack'); elapsed += fast.ms; paintStats(2); }]);
    out.push([`${slow.f.label} acks later (${slow.ms} ms). Nobody waits for it: with 3 replicas, one slow or dead replica does not block commits. Lose two, and writes stop.`,
      () => { logs[slow.f.id].textContent = 'log: w42 ✓'; nodes[slow.f.id].setAttribute('fill', 'var(--accent-soft)'); fly(slow.f.pos, L.pos, 'var(--text-3)', gen, 'ack'); paintStats(3); }]);
    out.push([`The leader replies to the client: the other half of the ${client === lr ? '~1' : cl} ms round trip.`,
      () => { fly(L.pos, cp, 'var(--ok)', gen, 'OK'); elapsed += client === lr ? 0.5 : cl / 2; paintStats(3); }]);
    const total = Math.round((client === lr ? 1 : cl) + fast.ms);
    out.push([`Commit latency ≈ client↔leader RTT (${client === lr ? '~1' : cl} ms) + leader↔nearest follower RTT (${fast.ms} ms) ≈ <b>${total} ms</b>. ${topo === 'single' ? 'Three AZs in one region: fast, but a full region outage stops writes.' : client === lr ? 'Moving the leader to the writer’s region is the biggest win; the quorum hop to another region remains.' : 'Try putting the leader in the client’s region: locality matters more than anything else.'}`,
      () => { paintStats(3); }]);
    return out;
  }
  const say = (t) => { cap.firstChild.innerHTML = t; };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; frames = build();
    say(topo === 'single' ? 'All three replicas are in one region (different availability zones). The leader selector is ignored: the leader is in us-east-a. Press Play.' : 'Press Play to follow one write through Raft.'); }
  function step() { if (k >= frames.length) return false; const [t, f] = frames[k++]; f(); say(t); if (k >= frames.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= frames.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
