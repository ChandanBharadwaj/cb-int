/* V8 memory & leaks: young generation (two semi-spaces, Scavenge copies survivors, promotes after 2),
   old generation (Mark-Compact: mark from roots, sweep, compact). Leak mode keeps one object per request
   reachable from a global Map until the old space hits its limit. */
IA.widget('v8-gc-leaks', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-gc-style')) {
    document.head.append(el('style', { id: 'w-gc-style', text: `
.w-gc .sp { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.5; }
.w-gc .sp.on { stroke: var(--accent); stroke-width: 2.5; }
.w-gc .slot { fill: none; stroke: var(--border); stroke-width: 1; stroke-dasharray: 2 3; }
.w-gc .o { stroke: var(--surface); stroke-width: 1.5; }
.w-gc .o.req { fill: var(--accent-2); }
.w-gc .o.ses { fill: var(--accent); }
.w-gc .o.cfg { fill: var(--ok); }
.w-gc .o.leak { fill: var(--warn); }
.w-gc .o.dead { fill: var(--surface); stroke: var(--text-3); stroke-dasharray: 3 2; opacity: .7; }
.w-gc .o.mark { stroke: var(--text); stroke-width: 2.5; }
.w-gc .o.new { animation: w-gc-in .4s ease both; }
@keyframes w-gc-in { from { opacity: 0; } to { opacity: 1; } }
.w-gc .ol { fill: #fff; font-family: var(--mono); font-size: 10.5px; font-weight: 700; pointer-events: none; }
.w-gc .ol.d { fill: var(--text-3); }
.w-gc .t1 { fill: var(--text); font-size: 13px; font-weight: 700; }
.w-gc .t2 { fill: var(--text-3); font-size: 11.5px; }
.w-gc .te { fill: var(--err); font-size: 13px; font-weight: 700; }
.w-gc .bar { fill: var(--accent-2); } .w-gc .bar.hot { fill: var(--err); }
.w-gc .lim { stroke: var(--err); stroke-width: 2; stroke-dasharray: 5 4; }
.w-gc-key { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--text-2); margin-top: 6px; }
.w-gc-key i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -2px; margin-right: 5px; }
` }));
  }
  const CAP = 12; const OLD = 12; const COLS = 6; const CW = 36;
  function simulate(leak) {
    let uid = 0; const F = []; let from = []; let toShow = null; let old = []; let scav = 0; let mc = 0; let promoted = 0; let nextMC = 4; let phase = 'alloc';
    const all = [];
    const mk = (label, kind, life) => { const o = { id: ++uid, label, kind, age: 0, live: true, life, born: 0 }; all.push(o); return o; };
    const cfg = mk('cfg', 'cfg', Infinity);
    from.push(cfg);
    const snap = (cap, extra) => F.push(Object.assign({ from: from.map((o) => ({ ...o })), to: toShow ? toShow.map((o) => ({ ...o })) : null, old: old.map((o) => ({ ...o })), scav, mc, promoted, phase, cap,
      cacheN: all.filter((o) => o.kind === 'leak' && o.live).length }, extra || {}));
    snap('The heap starts with one long-lived object, <code>cfg</code> (green), referenced from a root. Press Play or Step.');
    let r = 0; const fresh = new Set();
    const scavenge = () => {
      scav++;
      const surv = from.filter((o) => o.live); const dead = from.length - surv.length;
      const prom = surv.filter((o) => o.age >= 1); const stay = surv.filter((o) => o.age < 1);
      stay.forEach((o) => { o.age++; }); prom.forEach((o) => { o.age++; });
      toShow = stay;
      phase = 'scavenge';
      snap(`<b>Scavenge #${scav}</b>: the semi-space is full. V8 copies the <b>${surv.length}</b> live objects and simply forgets the <b>${dead}</b> dead ones (dashed). ${prom.length ? `${prom.map((o) => o.label).join(', ')} survived a second time, so ${prom.length > 1 ? 'they are' : 'it is'} <b>promoted</b> to old space.` : 'Survivors go to the other semi-space.'} Cost ∝ live objects.`, { promoting: prom.map((o) => o.id) });
      old.push(...prom); promoted += prom.length;
      from = stay; toShow = null; phase = 'alloc';
    };
    const markCompact = () => {
      mc++; phase = 'mark';
      snap(`Old space reached its limit (${old.length}/${nextMC}): <b>Mark-Compact #${mc}</b>. Marking starts at the roots and follows every reference (mostly concurrently). Marked objects have a dark outline.`, { marking: true });
      const before = old.length; old = old.filter((o) => o.live); const freed = before - old.length;
      nextMC = Math.min(OLD, Math.max(4, old.length + 3));
      phase = 'compact';
      snap(freed ? `Sweep + compact: <b>${freed}</b> unmarked objects are freed and the survivors are moved together. ${leak ? `But the <b>${old.filter((o) => o.kind === 'leak').length}</b> cached results are still reachable from the <code>Map</code>: nothing the GC can do.` : 'Old space is small again.'}`
        : `Sweep + compact frees <b>nothing</b>: every object in old space is still reachable from the cache <code>Map</code>. V8 raises the limit and will try again soon.`);
      phase = 'alloc';
    };
    const maxReq = leak ? 30 : 14;
    while (r < maxReq) {
      r++;
      // requests r-2 finish: their objects become unreachable (except a leaked result)
      all.filter((o) => o.kind === 'req' && o.born === r - 2).forEach((o) => { o.live = false; });
      all.filter((o) => o.kind === 'ses' && o.live && r - o.born >= o.life).forEach((o) => { o.live = false; });
      const objs = [mk('q' + r, 'req'), mk('b' + r, 'req'), leak ? mk('r' + r, 'leak') : mk('r' + r, 'req')];
      if (r % 3 === 2) objs.push(mk('s' + r, 'ses', 6));
      objs.forEach((o) => { o.born = r; });
      if (from.length + objs.length > CAP) scavenge();
      if (old.length >= nextMC) markCompact();
      if (old.length >= OLD) {
        phase = 'oom';
        snap('<b>FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory.</b> Every Mark-Compact freed almost nothing because the leaked results are reachable. A heap snapshot would show them all retained by one <code>Map</code>.', { oom: true });
        return F;
      }
      from.push(...objs); fresh.clear(); objs.forEach((o) => fresh.add(o.id));
      snap(`Request ${r} allocates ${objs.map((o) => '<code>' + o.label + '</code>').join(', ')} with a fast pointer bump. Request ${r - 2 > 0 ? r - 2 : '—'} has finished, so its objects are now garbage${leak && r > 2 ? ', except its result <code>r' + (r - 2) + '</code>, which the cache keeps' : ''}.`, { fresh: [...fresh] });
    }
    snap(leak ? 'Old space keeps growing: every cached result is still reachable, so each GC copies or marks it again and frees nothing.' : 'Steady state: lots of allocation, many cheap Scavenges, and old space holds only what really lives long. Most objects died young and never reached old space. Switch to <b>Leaky cache</b>.');
    return F;
  }

  let mode = 'ok'; let frames = []; let k = 0; let gen = 0; let playing = false; let speed = 1700;
  const seg = (opts, cur, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); set(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 600 300', role: 'img', 'aria-label': 'V8 heap: roots, young generation semi-spaces and old space' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  const key = el('div', { class: 'w-gc-key' }, ...[['var(--accent-2)', 'request temp (q, b, r)'], ['var(--accent)', 'session (lives ~6 requests)'], ['var(--ok)', 'config'], ['var(--warn)', 'result kept in cache Map']].map(([c, t]) => el('span', null, el('i', { style: { background: c } }), t)));
  root.classList.add('w-gc');
  root.append(el('div', { class: 'w-controls' }, seg([['ok', 'Healthy'], ['leak', 'Leaky cache']], mode, (v) => { mode = v; reset(); }, 'Mode')),
    el('div', { class: 'w-stage' }, stage), key, narr,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[2600, 'Slow'], [1700, 'Normal'], [750, 'Fast']], speed, (v) => { speed = v; }, 'Speed')), stats);

  function cell(g, x, y, w, h, o, f) {
    const cls = 'o ' + (o.live ? o.kind : 'dead') + (f.marking && o.live ? ' mark' : '') + (f.fresh && f.fresh.includes(o.id) && !reduced ? ' new' : '');
    g.append(svg('rect', { class: cls, x, y, width: w, height: h, rx: 5 }));
    g.append(svg('text', { class: 'ol' + (o.live ? '' : ' d'), x: x + w / 2, y: y + h / 2 + 4, 'text-anchor': 'middle', text: o.label }));
  }
  function render(f) {
    stage.innerHTML = '';
    // roots
    stage.append(svg('rect', { class: 'sp', x: 6, y: 30, width: 104, height: 200, rx: 10 }));
    stage.append(svg('text', { class: 't1', x: 58, y: 22, 'text-anchor': 'middle', text: 'roots' }));
    const rootsList = ['globals', 'stack', 'handles', 'config ref'].concat(mode === 'leak' ? [`cache Map (${f.cacheN})`] : []);
    rootsList.forEach((t, i) => stage.append(svg('text', { class: i === 4 ? 'te' : 't2', x: 16, y: 56 + i * 22, 'font-size': i === 4 ? 11.5 : null, text: '• ' + t })));
    // young gen
    const yx = 124; const ch = 30;
    stage.append(svg('text', { class: 't1', x: yx, y: 22, text: 'young generation (new space)' }));
    const semi = (y, label, list, on) => {
      stage.append(svg('rect', { class: 'sp' + (on ? ' on' : ''), x: yx, y, width: 224, height: 82, rx: 10 }));
      stage.append(svg('text', { class: 't2', x: yx + 8, y: y + 15, text: label }));
      for (let i = 0; i < CAP; i++) { const cx = yx + 6 + (i % COLS) * CW; const cy = y + 22 + Math.floor(i / COLS) * 29; stage.append(svg('rect', { class: 'slot', x: cx, y: cy, width: CW - 3, height: ch - 4, rx: 5 })); }
      const g = svg('g'); stage.append(g);
      (list || []).slice(0, CAP).forEach((o, i) => cell(g, yx + 6 + (i % COLS) * CW, y + 22 + Math.floor(i / COLS) * 29, CW - 3, ch - 4, o, f));
    };
    semi(30, f.phase === 'scavenge' ? 'from-space (being evacuated)' : 'semi-space A: allocating', f.from, f.phase === 'alloc');
    semi(148, f.phase === 'scavenge' ? 'to-space: copied survivors' : 'semi-space B: empty, waits for the next Scavenge', f.to, f.phase === 'scavenge');
    // old space
    const ox = 362; const ocw = 54;
    stage.append(svg('text', { class: 't1', x: ox, y: 22, text: 'old generation (old space)' }));
    stage.append(svg('rect', { class: 'sp' + (f.phase === 'mark' || f.phase === 'compact' ? ' on' : ''), x: ox, y: 30, width: 232, height: 200, rx: 10 }));
    for (let i = 0; i < OLD; i++) stage.append(svg('rect', { class: 'slot', x: ox + 8 + (i % 4) * 56, y: 44 + Math.floor(i / 4) * 60, width: ocw - 2, height: 48, rx: 5 }));
    const og = svg('g'); stage.append(og);
    f.old.slice(0, OLD).forEach((o, i) => cell(og, ox + 8 + (i % 4) * 56, 44 + Math.floor(i / 4) * 60, ocw - 2, 48, o, f));
    if (f.promoting) f.from.filter((o) => f.promoting.includes(o.id)).forEach((o, i) => {
      const fi = f.from.indexOf(o); const sx = yx + 6 + (fi % COLS) * CW + 16; const sy = 30 + 22 + Math.floor(fi / COLS) * 29 + 13; const n = Math.min(OLD - 1, f.old.length + i);
      stage.append(svg('path', { d: `M${sx},${sy} L${ox + 8 + (n % 4) * 56 + 26},${44 + Math.floor(n / 4) * 60 + 24}`, stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-dasharray': '5 4', fill: 'none' }));
    });
    // heap bar
    const used = f.from.length + f.old.length; const tot = CAP + OLD;
    stage.append(svg('text', { class: 't2', x: 6, y: 254, text: 'heap used' }));
    stage.append(svg('rect', { class: 'sp', x: 80, y: 244, width: 514, height: 14, rx: 4 }));
    stage.append(svg('rect', { class: 'bar' + (f.old.length >= OLD - 3 ? ' hot' : ''), x: 80, y: 244, width: 514 * Math.min(1, used / tot), height: 14, rx: 4 }));
    stage.append(svg('line', { class: 'lim', x1: 593, x2: 593, y1: 238, y2: 264 }));
    stage.append(svg('text', { class: 't2', x: 594, y: 278, 'text-anchor': 'end', text: 'heap limit (--max-old-space-size)' }));
    if (f.oom) stage.append(svg('text', { class: 'te', x: 300, y: 294, 'text-anchor': 'middle', text: 'FATAL ERROR: … JavaScript heap out of memory' }));
    if (f.cap) narr.firstChild.innerHTML = f.cap;
    stats.innerHTML = '';
    [['Scavenges', f.scav], ['Mark-Compacts', f.mc], ['promoted', f.promoted], ['old space', `${f.old.length}/${OLD}`], ['step', `${k}/${frames.length}`]]
      .forEach(([a, b]) => stats.append(el('span', { class: 'w-stat', html: `${a} <b>${b}</b>` })));
  }
  function reset() { gen++; playing = false; bPlay.textContent = '▶ Play'; frames = simulate(mode === 'leak'); k = 1; bStep.disabled = false; render(frames[0]); }
  function step() { if (k >= frames.length) { bStep.disabled = true; return false; } render(frames[k]); k++; if (k >= frames.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { playing = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (playing) { playing = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { k = frames.length - 1; step(); return; }
    if (k >= frames.length) reset();
    playing = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (playing && g === gen && step()) await sleep(speed);
    if (g === gen) { playing = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
