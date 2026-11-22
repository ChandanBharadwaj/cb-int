/* Startup options: toggle lazy init, trimmed starters, CDS, AOT on the JVM or native image and watch an illustrative startup timeline fill. */
IA.widget('startup-performance-startup', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const opt = { lazy: false, trim: false, cds: false, aot: false, native: false };
  const LBL = { lazy: 'lazy init', trim: 'trim unused starters', cds: 'CDS (Boot 3.3+)', aot: 'AOT on JVM', native: 'native image' };
  let progress = 1; let gen = 0; let running = false;
  function phases() {
    if (opt.native) return [['map image', 0.03, 'var(--accent)'], ['beans', 0.08, 'var(--k-compute)'], ['JPA', 0.06, 'var(--k-store)']];
    const p = [['JVM + class loading', opt.cds ? 0.55 : 1.3, 'var(--accent)'],
      ['scan, parse, conditions', (opt.aot ? 0.25 : 1.1) * (opt.trim ? 0.7 : 1), 'var(--k-edge)'],
      ['create beans', (opt.lazy ? 0.6 : 1.5) * (opt.trim ? 0.8 : 1), 'var(--k-compute)'],
      ['Hibernate / JPA', opt.lazy ? 0.9 : 1.2, 'var(--k-store)']];
    return p;
  }
  const boxes = el('div', { class: 'w-controls' });
  Object.keys(opt).forEach((key) => { const cb = el('input', { type: 'checkbox', 'aria-label': LBL[key] });
    cb.addEventListener('change', () => { opt[key] = cb.checked; if (key === 'native' && cb.checked) { opt.aot = false; } if (key === 'aot' && cb.checked) opt.native = false;
      [...boxes.querySelectorAll('input')].forEach((x, i) => { x.checked = opt[Object.keys(opt)[i]]; }); progress = 1; render(); });
    boxes.append(el('label', {}, cb, LBL[key])); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 760 150', role: 'img', 'aria-label': 'Startup timeline split into phases' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(boxes, el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  function render() {
    const P = phases(); const total = P.reduce((s, x) => s + x[1], 0); const MAX = 5.3; const W = 720; const x0 = 20;
    stage.innerHTML = '';
    for (let t = 0; t <= 5; t++) stage.append(svg('text', { x: x0 + (t / MAX) * W, y: 140, 'font-size': 10, 'text-anchor': 'middle', 'font-family': 'var(--mono)', fill: 'var(--text-3)', text: t + 's' }));
    stage.append(svg('rect', { x: x0, y: 40, width: W, height: 50, rx: 8, fill: 'var(--surface-2)', stroke: 'var(--border)' }));
    let x = x0; let acc = 0; const shownT = progress * total;
    P.forEach(([n, d, c]) => { const vis = Math.max(0, Math.min(d, shownT - acc)); const w = (vis / MAX) * W;
      if (w > 0) stage.append(svg('rect', { x, y: 44, width: Math.max(1, w - 2), height: 42, rx: 5, fill: `color-mix(in srgb, ${c} 35%, var(--surface))`, stroke: c }));
      if (w > 70) stage.append(svg('text', { x: x + 6, y: 70, 'font-size': 10.5, 'font-family': 'var(--mono)', fill: 'var(--text)', text: n }));
      x += (d / MAX) * W; acc += d; });
    if (progress >= 1) {
      const rx = x0 + (total / MAX) * W;
      stage.append(svg('path', { d: `M${rx} 30 L${rx} 100`, stroke: 'var(--ok)', 'stroke-width': 2.4 }), svg('text', { x: Math.min(rx + 6, 640), y: 24, 'font-size': 11.5, 'font-weight': 700, 'font-family': 'var(--mono)', fill: 'var(--ok)', text: `ready ≈ ${total.toFixed(2)} s` }));
      if (opt.lazy) stage.append(svg('text', { x: Math.min(rx + 6, 520), y: 116, 'font-size': 10.5, 'font-family': 'var(--mono)', fill: 'var(--warn)', text: '+ deferred bean creation on the first requests' }));
    }
    const notes = [];
    if (opt.native) notes.push('Native image: the whole Spring configuration and class loading were done at build time; the binary maps a pre-built heap. Build takes minutes; the bean set is fixed at build time. See <a href="aot-native.html">AOT &amp; native</a>.');
    else {
      if (opt.cds) notes.push('CDS maps pre-parsed class data from an archive created by a training run, cutting class-loading time.');
      if (opt.aot) notes.push('AOT on the JVM replaces scanning, parsing and condition evaluation with generated code.');
      if (opt.lazy) notes.push('Lazy init skips creating most beans at startup; the cost (and any misconfiguration) moves to the first requests.');
      if (opt.trim) notes.push('Fewer starters means fewer auto-configurations to evaluate and fewer beans.');
      if (!notes.length) notes.push('Baseline JVM start of a mid-sized service. Toggle options to see which phase each one shortens.');
    }
    narr.className = 'caption'; narr.innerHTML = ''; narr.append(el('div', { class: 't', html: notes.join(' ') + ' <i>Numbers are illustrative.</i>' }));
  }
  bReset.addEventListener('click', () => { gen++; running = false; bPlay.textContent = '▶ Play'; progress = 0; render(); });
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; progress = Math.min(1, progress + 0.25); render(); });
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { progress = 1; render(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen; if (progress >= 1) progress = 0;
    while (running && g === gen && progress < 1) { progress = Math.min(1, progress + 0.02); render(); await sleep(40); }
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  render();
});
