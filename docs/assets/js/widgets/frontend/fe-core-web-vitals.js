/* Core Web Vitals: LCP broken into parts, the anatomy of INP and a layout shift. */
IA.widget('fe-core-web-vitals', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  // Scene format: nodes [id, x, y, w, h, label, sub?]; edges [id, from, to, label?]; steps { hot, ok, err, dim, txt: {id: label}, cap }
  const SCENES = {
  'LCP breakdown': {
    h: 250, intro: 'LCP = when the largest image or text block in the viewport is painted. It splits into four parts. Press Play.',
    nodes: [['ttfb', 20, 30, 150, 60, 'TTFB', 'server + network'], ['ld', 190, 30, 170, 60, 'Load delay', 'until the img request starts'],
      ['dur', 380, 30, 170, 60, 'Load duration', 'downloading the image'], ['rd', 570, 30, 170, 60, 'Render delay', 'until it paints'],
      ['fix', 20, 150, 720, 70, 'Fixes', '']],
    edges: [['e1', 'ttfb', 'ld'], ['e2', 'ld', 'dur'], ['e3', 'dur', 'rd']],
    steps: [
      { hot: ['ttfb'], txt: { fix: 'CDN, caching, faster backend, early hints' }, sub: { fix: 'nothing can paint before the first HTML byte' }, stats: [['TTFB', '800 ms']], cap: '<b>Time to First Byte.</b> A slow Spring Boot endpoint or a cold cache adds directly to LCP.' },
      { hot: ['ld', 'e1'], txt: { fix: 'put <img> in the HTML, fetchpriority="high", no lazy-load' }, sub: { fix: 'or <link rel="preload"> for CSS background images' }, stats: [['load delay', '1.2 s']], cap: 'Often the biggest part: the hero image is discovered late (injected by JS, a CSS background, or <code>loading="lazy"</code>).' },
      { hot: ['dur', 'e2'], txt: { fix: 'AVIF/WebP, srcset/sizes, CDN image resizing' }, sub: { fix: 'send a 1200 px image, not a 4000 px one' }, stats: [['download', '600 ms']], cap: 'Make the bytes smaller and closer.' },
      { hot: ['rd', 'e3'], txt: { fix: 'less render-blocking CSS/JS, SSR the hero, avoid hiding it until hydration' }, sub: { fix: 'main thread must be free to paint' }, stats: [['render delay', '400 ms']], cap: 'Downloaded but not painted yet: blocked by CSS, long JS tasks, or client-side rendering.' },
      { ok: ['ttfb', 'ld', 'dur', 'rd'], txt: { fix: 'Total LCP = 3.0 s → “needs improvement”' }, sub: { fix: 'good ≤ 2.5 s, poor > 4 s, at the 75th percentile of real users' }, stats: [['LCP', '3.0 s']], cap: 'Measure which part dominates before you optimise. The web-vitals library’s attribution build reports this split.' }
    ]
  },
  'INP anatomy': {
    h: 260, intro: 'A user taps “Add to cart”. INP measures from the tap to the next frame painted. Press Play.',
    nodes: [['tap', 20, 30, 120, 56, 'tap', 'pointerdown'], ['lt', 160, 30, 180, 56, 'input delay', 'a long task is running'],
      ['h', 360, 30, 180, 56, 'processing', 'your event handlers'], ['p', 560, 30, 180, 56, 'presentation delay', 'style, layout, paint'],
      ['fix', 20, 150, 720, 80, 'Fixes', '']],
    edges: [['e1', 'tap', 'lt'], ['e2', 'lt', 'h'], ['e3', 'h', 'p']],
    steps: [
      { hot: ['tap'], txt: { fix: 'INP = (roughly) the worst interaction of the visit' }, sub: { fix: 'clicks, taps and key presses; scrolling and hover don’t count' }, cap: 'INP replaced FID as a Core Web Vital in <b>March 2024</b>. FID only measured the input delay of the first interaction.' },
      { err: ['lt', 'e1'], txt: { fix: 'break up long tasks: await scheduler.yield() or setTimeout' }, sub: { fix: 'defer third-party scripts, less work during hydration' }, stats: [['input delay', '180 ms']], cap: 'The main thread is busy with a 200 ms analytics or hydration task. The tap waits in the queue.' },
      { hot: ['h', 'e2'], txt: { fix: 'do the visible update first, the rest later' }, sub: { fix: 'avoid sync work: big JSON parse, re-rendering a 5,000-row list' }, stats: [['processing', '120 ms']], cap: 'Your click handler and the framework re-render run.' },
      { hot: ['p', 'e3'], txt: { fix: 'smaller DOM, content-visibility: auto, avoid layout thrashing' }, sub: { fix: 'don’t read offsetHeight right after writing styles in a loop' }, stats: [['presentation', '60 ms']], cap: 'The browser recalculates styles, lays out and paints the next frame.' },
      { err: ['tap', 'lt', 'h', 'p'], txt: { fix: 'INP = 360 ms → “needs improvement”' }, sub: { fix: 'good ≤ 200 ms, poor > 500 ms, at the 75th percentile' }, stats: [['INP', '360 ms']], cap: 'Fixing only your handler would save 120 ms. The long task in front of it is the bigger win.' }
    ]
  },
  'CLS': {
    h: 270, intro: 'An ad slot loads late and pushes the article down. Press Play.',
    nodes: [['hdr', 20, 20, 340, 40, 'header', ''], ['ad', 20, 70, 340, 20, '(ad slot, no height)', ''], ['txt', 20, 100, 340, 120, 'article text', 'user starts reading'],
      ['fix', 400, 20, 340, 200, 'Fixes', '']],
    edges: [], 
    steps: [
      { hot: ['txt'], txt: { fix: 'Score so far: 0' }, cap: 'The page has painted; the user begins to read.' },
      { err: ['ad', 'txt'], txt: { ad: 'ad loads: 250 px tall', fix: 'shift = impact fraction × distance fraction' }, sub: { fix: 'e.g. 0.6 of viewport moved by 0.3 → 0.18' }, stats: [['CLS', '0.18']], cap: 'The ad appears and the text jumps down. Layout shifts <b>not</b> within 500 ms of a user input count toward CLS.' },
      { ok: ['ad'], txt: { ad: 'reserved: min-height 250px', fix: 'reserve space: width/height or aspect-ratio' }, sub: { fix: 'font-display + size-adjust, no content inserted above' }, stats: [['CLS', '0']], cap: 'Fix: reserve space for images, ads, embeds; set <code>width</code>/<code>height</code> on <code>&lt;img&gt;</code>; animate with <code>transform</code>, not <code>top</code>.' },
      { ok: ['txt'], txt: { fix: 'good ≤ 0.1, poor > 0.25' }, sub: { fix: 'worst 5 s session window of shifts, 75th percentile' }, cap: 'CLS is unitless. It sums shifts in bursts (session windows, max 5 s, gaps under 1 s) and reports the worst burst.' }
    ]
  }
};
  const W = 760; let mode = Object.keys(SCENES)[0]; let k = 0; let running = false; let gen = 0;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  Object.keys(SCENES).forEach((m) => { const b = el('button', { text: m, class: m === mode ? 'on' : '' });
    b.addEventListener('click', () => { mode = m; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { role: 'img', 'aria-label': 'Timeline boxes for the phases of LCP and INP and a page layout showing a shift' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: '' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, seg), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  const S = () => SCENES[mode];
  const has = (arr, id) => (arr || []).indexOf(id) >= 0;
  function anchor(n, tx, ty) {
    const cx = n[1] + n[3] / 2, cy = n[2] + n[4] / 2; const dx = tx - cx, dy = ty - cy;
    const s = Math.min(dx ? (n[3] / 2 + 4) / Math.abs(dx) : 1e9, dy ? (n[4] / 2 + 4) / Math.abs(dy) : 1e9);
    return [cx + dx * s, cy + dy * s];
  }
  function draw() {
    const sc = S(); const st = k ? sc.steps[k - 1] : (sc.start || {}); const H = sc.h || 300;
    stage.setAttribute('viewBox', `0 0 ${W} ${H}`); stage.innerHTML = '';
    const defs = svg('defs'); ['m-n', 'm-h'].forEach((id, i) => defs.append(svg('marker', { id: id + '-fe-core-web-vitals', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M0 0L10 5L0 10z', style: `fill:${i ? 'var(--accent)' : 'var(--text-3)'}` })))); stage.append(defs);
    const byId = {}; sc.nodes.forEach((n) => { byId[n[0]] = n; });
    (sc.edges || []).forEach((e) => {
      const a = byId[e[1]], b = byId[e[2]]; if (!a || !b) return;
      const hot = has(st.hot, e[0]), err = has(st.err, e[0]), ok = has(st.ok, e[0]), dim = has(st.dim, e[0]) || (sc.hideEdges && !hot && !err && !ok);
      const [x1, y1] = anchor(a, b[1] + b[3] / 2, b[2] + b[4] / 2); const [x2, y2] = anchor(b, a[1] + a[3] / 2, a[2] + a[4] / 2);
      const col = err ? 'var(--err)' : ok ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)';
      const ln = svg('line', { x1, y1, x2, y2, 'marker-end': `url(#${hot || ok || err ? 'm-h' : 'm-n'}-fe-core-web-vitals)`, style: `stroke:${col};stroke-width:${hot || ok || err ? 2.4 : 1.4};opacity:${dim ? 0.15 : 1}` });
      if ((hot || ok || err) && !reduced) { ln.style.strokeDasharray = '6 5'; ln.animate && ln.animate([{ strokeDashoffset: 22 }, { strokeDashoffset: 0 }], { duration: 700, iterations: Infinity }); }
      stage.append(ln);
      const lab = (st.etxt || {})[e[0]] != null ? st.etxt[e[0]] : e[3];
      if (lab && !dim) stage.append(svg('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 5, 'text-anchor': 'middle', 'font-size': 11, style: `fill:${hot || ok || err ? col : 'var(--text-3)'}`, text: lab }));
    });
    sc.nodes.forEach((n) => {
      const id = n[0]; const hot = has(st.hot, id), ok = has(st.ok, id), err = has(st.err, id), dim = has(st.dim, id);
      const col = err ? 'var(--err)' : ok ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)';
      const g = svg('g', { style: `opacity:${dim ? 0.3 : 1};transition:opacity .4s` });
      g.append(svg('rect', { x: n[1], y: n[2], width: n[3], height: n[4], rx: 8, style: `fill:${hot || ok || err ? 'var(--accent-soft)' : 'var(--surface-2)'};stroke:${col};stroke-width:${hot || ok || err ? 2.2 : 1.2};transition:all .4s` }));
      const label = (st.txt || {})[id] != null ? st.txt[id] : n[5]; const sub = (st.sub || {})[id] != null ? st.sub[id] : n[6];
      const cx = n[1] + n[3] / 2; const lines = String(label).split('\n');
      const base = n[2] + n[4] / 2 - (lines.length - 1) * 7 - (sub ? 6 : 0) + 5;
      lines.forEach((t, i) => g.append(svg('text', { x: cx, y: base + i * 14, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, style: `fill:${err ? 'var(--err)' : 'var(--text)'}`, text: t })));
      if (sub) g.append(svg('text', { x: cx, y: base + (lines.length - 1) * 14 + 15, 'text-anchor': 'middle', 'font-size': 10.5, style: 'fill:var(--text-3)', text: sub }));
      stage.append(g);
    });
    narr.firstChild.textContent = String(k); narr.lastChild.innerHTML = st.cap || sc.intro || 'Press Play or Step.';
    narr.className = 'caption' + (st.err && st.err.length ? ' err' : st.ok && st.ok.length ? ' ok' : '');
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `step <b>${k}</b>/${sc.steps.length}` }));
    (st.stats || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
    bStep.disabled = k >= sc.steps.length;
  }
  function step() { if (k >= S().steps.length) return false; k++; draw(); return true; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; draw(); }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= S().steps.length) reset();
    if (reduced) { k = S().steps.length; draw(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
