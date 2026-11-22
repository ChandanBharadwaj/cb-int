/* Scheduling (extra): topology spread constraints. Each new replica computes skew = count + 1 − global min per zone. */
IA.widget('scheduling-spread', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8s-spr-style')) {
    document.head.append(el('style', { id: 'w-k8s-spr-style', text: `
.w-spr .zb { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: all .3s; }
.w-spr .zb.ok { stroke: var(--ok); stroke-width: 3; }
.w-spr .zb.no { stroke: var(--err); stroke-width: 2; stroke-dasharray: 5 4; }
.w-spr .ttl { font: 600 13px var(--sans); fill: var(--text); }
.w-spr .sub { font: 500 11px var(--mono); fill: var(--text-3); }
.w-spr .calc { font: 700 11.5px var(--mono); }
.w-spr .pod { fill: var(--accent); }
.w-spr .pod.new { fill: var(--ok); }
.w-spr .full { font: 700 11px var(--mono); fill: var(--err); }
` }));
  }
  const START = [2, 1, 0]; const Z = ['a', 'b', 'c'];
  let counts = START.slice(); let maxSkew = 1; let when = 'DoNotSchedule'; let cFull = false;
  let gen = 0; let running = false; let last = null; let blocked = false; let evals = null; let speed = 1800;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: '+ Add replica' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 760; const H = 280;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Three zones with replica counts and the skew calculation for each' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-spr');
  root.append(el('div', { class: 'w-controls' }, seg([[1, 'maxSkew: 1'], [2, 'maxSkew: 2']], maxSkew, (v) => { maxSkew = v; reset(); }, 'maxSkew'),
    seg([['DoNotSchedule', 'DoNotSchedule'], ['ScheduleAnyway', 'ScheduleAnyway']], when, (v) => { when = v; reset(); }, 'whenUnsatisfiable')),
  el('div', { class: 'w-controls' }, seg([[false, 'zone c has room'], [true, 'zone c is full (no CPU)']], cFull, (v) => { cFull = v; reset(); }, 'Zone c capacity')),
  el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };

  function evaluate() {
    const min = Math.min(...counts);
    return Z.map((z, i) => {
      const skew = counts[i] + 1 - min; const room = !(cFull && z === 'c');
      const okSkew = skew <= maxSkew;
      const pass = room && (when === 'ScheduleAnyway' || okSkew);
      return { z, i, skew, room, okSkew, pass, min };
    });
  }
  function draw() {
    stage.innerHTML = '';
    const min = Math.min(...counts);
    Z.forEach((z, i) => {
      const x = 20 + i * 250; const e = evals && evals[i];
      stage.append(svg('rect', { class: 'zb ' + (e ? (last === i ? 'ok' : e.pass ? '' : 'no') : ''), x, y: 16, width: 220, height: 178, rx: 12 }),
        svg('text', { class: 'ttl', x: x + 12, y: 38, text: `zone ${z}` }), svg('text', { class: 'sub', x: x + 208, y: 38, 'text-anchor': 'end', text: `${counts[i]} replica${counts[i] === 1 ? '' : 's'}` }));
      if (cFull && z === 'c') stage.append(svg('text', { class: 'full', x: x + 12, y: 56, text: 'nodes full: Insufficient cpu' }));
      for (let p = 0; p < counts[i]; p++) {
        const col = p % 6; const row = Math.floor(p / 6);
        stage.append(svg('circle', { class: 'pod' + (last === i && p === counts[i] - 1 ? ' new' : ''), cx: x + 30 + col * 32, cy: 170 - row * 32, r: 12 }));
      }
      if (e) {
        stage.append(svg('text', { class: 'calc', x: x + 12, y: 222, fill: e.okSkew ? 'var(--ok)' : 'var(--err)', text: `skew = ${counts[i] - (last === i ? 1 : 0)} + 1 − ${e.min} = ${e.skew}` }),
          svg('text', { class: 'sub', x: x + 12, y: 240, text: e.okSkew ? `≤ maxSkew ${maxSkew}` : `> maxSkew ${maxSkew}${when === 'ScheduleAnyway' ? ' (only a score penalty)' : ''}` }),
          svg('text', { class: 'sub', x: x + 12, y: 258, fill: e.pass ? 'var(--ok)' : 'var(--err)', text: !e.room ? '✗ no capacity' : e.pass ? '✓ feasible' : '✗ filtered (DoNotSchedule)' }));
      }
    });
    stage.append(svg('text', { class: 'sub', x: 380, y: 276, 'text-anchor': 'middle', text: `global minimum now: ${min}` }));
  }
  function addOne() {
    if (blocked) return false;
    const ev = evaluate(); evals = ev;
    const ok = ev.filter((e) => e.pass);
    if (!ok.length) {
      blocked = true; last = null; draw();
      const r = ev.map((e) => `zone ${e.z}: ${!e.room ? 'no room' : `skew ${e.skew} > ${maxSkew}`}`).join('; ');
      say(`<b>Pending.</b> ${r}. Zone c still counts as an eligible domain with 0 replicas, so the global minimum stays 0 and a and b are “too far ahead”. Fixes: capacity in zone c (the autoscaler can add a node there), <code>ScheduleAnyway</code>, or a larger <code>maxSkew</code>.`, 'err');
      return false;
    }
    ok.sort((p, q) => p.skew - q.skew || p.i - q.i);
    const w = ok[0]; counts[w.i]++; last = w.i; draw();
    say(`Replica ${counts.reduce((a, b) => a + b, 0)} → <b>zone ${w.z}</b>. Feasible zones: ${ok.map((e) => e.z).join(', ')}. ${when === 'ScheduleAnyway' ? 'With ScheduleAnyway every zone with room is feasible; the spread plugin only <i>scores</i> lower skew higher.' : 'DoNotSchedule turns the skew rule into a hard filter.'}${!w.okSkew ? ' Note: this placement exceeds maxSkew, which ScheduleAnyway allows.' : ''}`, w.okSkew ? 'ok' : 'warn');
    if (counts.reduce((a, b) => a + b, 0) >= 12) { blocked = true; return false; }
    return true;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; counts = START.slice(); last = null; blocked = false; evals = null; bStep.disabled = false; draw();
    say('Zones start with 2, 1 and 0 replicas of <code>app=web</code>. Press “+ Add replica” to schedule one more, or Play to keep adding.');
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; if (!addOne()) bStep.disabled = blocked; });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (blocked) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && addOne()); }
    else while (running && g === gen && addOne()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; bStep.disabled = blocked; }
  });
  reset();
});
