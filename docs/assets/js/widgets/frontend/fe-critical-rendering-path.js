/* Timeline: how <script>, defer, async and render-blocking CSS change when the parser runs and when first paint happens. */
IA.widget('fe-critical-rendering-path', (root, ctx) => {
  const L = (y, t) => ({ id: 'l' + y, x: 8, y, w: 132, h: 50, t, fs: 15, fill: 'var(--bg-2)' });
  const B = (id, y, x0, x1, t, s, h) => ({ id, x: x0, y, w: x1 - x0, h: h || 50, t, s, hide: true, fs: 14 });
  const lanes = [L(20, 'HTML parser'), L(90, 'Network'), L(160, 'JS / CSSOM'), L(230, 'Milestones')];
  const S = {
    W: 640, H: 290, aria: 'Timeline lanes for parser, network, execution and paint', segLabel: 'Loading strategy', speed: 2400,
    modes: {
      sync: { label: '<script> in head', lang: 'text', code: '<head>\n  <script src="app.js"></script>   <!-- classic, parser-blocking -->\n</head>', nodes: [...lanes,
        B('p1', 20, 145, 250, 'parse', '<head>'), B('n1', 90, 250, 420, 'fetch app.js', 'parser waits'), B('x1', 160, 420, 490, 'run', ''), B('p2', 20, 490, 590, 'parse', '<body>'), B('fp', 230, 590, 636, 'FP', '')], frames: [
        { on: { p1: 'acc' }, cap: 'The parser starts on <head>.' },
        { on: { n1: 'err' }, cap: 'It hits a classic <script src>. It must stop: the script could call document.write or read the DOM so far. The network round-trip is dead time.', tone: 'err' },
        { on: { x1: 'warn' }, cap: 'The script downloads and runs. Only then can parsing continue.' },
        { on: { p2: 'acc', fp: 'ok' }, cap: 'Body parsed, first paint happens late. Every sync script in <head> pushes paint further right.', stat: [['parser blocked', 'yes'], ['order kept', 'yes']] }] },
      defer: { label: 'defer', lang: 'text', code: '<script defer src="app.js"></script>\n<script defer src="chart.js"></script>  <!-- runs after app.js -->', nodes: [...lanes,
        B('p1', 20, 145, 430, 'parse whole document', 'never blocked'), B('n1', 90, 190, 380, 'fetch app.js (parallel)', ''), B('fp', 230, 435, 480, 'FP', ''), B('x1', 160, 435, 500, 'run', 'in order'), B('dcl', 230, 505, 600, 'DOMContentLoaded', '')], frames: [
        { on: { p1: 'acc', n1: 'acc' }, cap: 'defer: download in parallel, parser keeps going. (The preload scanner already found the URL.)', tone: 'ok' },
        { on: { fp: 'ok', x1: 'warn' }, cap: 'After parsing ends, deferred scripts run in document order. The browser may paint before they run.' },
        { on: { dcl: 'ok' }, cap: 'DOMContentLoaded fires only after all deferred scripts have run. type="module" scripts are deferred by default.', tone: 'ok', stat: [['parser blocked', 'no'], ['order kept', 'yes']] }] },
      async: { label: 'async', lang: 'text', code: '<script async src="analytics.js"></script>  <!-- runs whenever it arrives -->', nodes: [...lanes,
        B('p1', 20, 145, 300, 'parse', ''), B('n1', 90, 180, 300, 'fetch (parallel)', ''), B('x1', 160, 300, 370, 'run', 'parser paused'), B('p2', 20, 370, 480, 'parse', ''), B('dcl', 230, 485, 600, 'DOMContentLoaded', '')], frames: [
        { on: { p1: 'acc', n1: 'acc' }, cap: 'async also downloads in parallel without blocking the parser…' },
        { on: { x1: 'warn' }, cap: '…but it executes the moment it arrives, pausing the parser. Order between async scripts is not guaranteed.', tone: 'warn' },
        { on: { p2: 'acc', dcl: 'ok' }, cap: 'Good for independent scripts (analytics). Bad for scripts that depend on each other or on the full DOM.', stat: [['parser blocked', 'briefly'], ['order kept', 'no']] }] },
      css: { label: 'CSS + preload', lang: 'text', code: '<link rel="preload" href="/f/inter.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="stylesheet" href="app.css">  <!-- render-blocking -->', nodes: [...lanes,
        B('p1', 20, 145, 360, 'parse (continues)', ''), B('n1', 90, 160, 380, 'app.css (blocks render)', '', 24), B('n2', 116, 385, 600, 'font, found via CSS', '', 24), B('c1', 160, 380, 430, 'CSSOM', ''), B('fp', 230, 432, 480, 'FP', ''), B('lcp', 230, 525, 630, 'text in font', '')], frames: [
        { on: { p1: 'acc', n1: 'warn' }, cap: 'Stylesheets do not block parsing, but they block rendering: no paint until the CSSOM is built (else content would flash unstyled).', tone: 'warn' },
        { on: { c1: 'acc', fp: 'ok' }, cap: 'CSSOM ready → first paint. (A script after the stylesheet would also wait for it, since JS may read computed styles.)' },
        { on: { n2: 'err', lcp: 'warn' }, cap: 'The font is only discovered after the CSS is parsed: a late request chain (HTML → CSS → font).', tone: 'err' },
        { on: { n2: 'ok', lcp: 'ok' }, geo: { n2: [165, 116, 200, 24], lcp: [485, 230, 110, 50] }, t: { n2: 'font (preloaded)' }, cap: 'With <link rel=preload as=font crossorigin> the font starts with the CSS. Without crossorigin the preload is wasted: fonts are fetched in CORS mode.', tone: 'ok' }] }
    }
  };
  /* Generic step-through stage: modes → nodes, edges and cumulative frames. */
  const { el, svg, sleep, reduced } = ctx;
  const COL = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', acc: 'var(--accent)', off: 'var(--border)' };
  const keys = Object.keys(S.modes); let mode = keys[0]; let k = 0; let gen = 0; let running = false;
  const seg = el('div', { class: 'seg', 'aria-label': S.segLabel || 'Variant' });
  keys.forEach((v) => { const b = el('button', { text: S.modes[v].label, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeEl = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const st = svg('svg', { viewBox: `0 0 ${S.W} ${S.H}`, role: 'img', 'aria-label': S.aria });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: '' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(keys.length > 1 ? el('div', { class: 'w-controls' }, seg) : null, codeEl, el('div', { class: 'w-stage' }, st), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  let N = {}; let E = {};
  const tr = reduced ? 'none' : 'all .6s ease';
  function draw() {
    st.innerHTML = ''; N = {}; E = {}; const M = S.modes[mode];
    const byId = {}; M.nodes.forEach((n) => { byId[n.id] = n; });
    (M.edges || []).forEach(([a, b]) => { const A = byId[a]; const B = byId[b];
      const l = svg('line', { x1: A.x + A.w / 2, y1: A.y + A.h / 2, x2: B.x + B.w / 2, y2: B.y + B.h / 2, stroke: 'var(--border)', 'stroke-width': 3, style: { transition: tr } });
      st.append(l); E[a + '>' + b] = l; });
    M.nodes.forEach((n) => {
      const g = svg('g', { style: { transition: tr } });
      const r = svg('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 10, fill: n.fill || 'var(--surface-2)', stroke: 'var(--border)', 'stroke-width': 2, 'stroke-dasharray': n.dash ? '7 5' : '', style: { transition: tr } });
      const fs = n.fs || 16;
      const t = svg('text', { x: n.x + 10, y: n.y + fs + 6, 'font-size': fs, 'font-weight': 700, fill: 'var(--text)', text: n.t || '' });
      const s = svg('text', { x: n.x + 10, y: n.y + fs * 2 + 10, 'font-size': fs - 3, fill: 'var(--text-2)', text: n.s || '' });
      g.append(r, t, s); st.append(g); N[n.id] = { g, r, t, s, n };
      if (n.hide) g.style.opacity = '0';
    });
  }
  function apply(f) {
    Object.entries(f.on || {}).forEach(([id, c]) => { const x = N[id]; if (!x) return;
      if (c === 'hide') { x.g.style.opacity = '0'; return; }
      if (c === 'dim') { x.g.style.opacity = '0.35'; return; }
      x.g.style.opacity = '1'; x.r.setAttribute('stroke', COL[c] || c); x.r.setAttribute('stroke-width', c === 'off' ? 2 : 3.5);
      x.r.setAttribute('fill', c === 'off' ? (x.n.fill || 'var(--surface-2)') : 'var(--accent-soft)'); });
    Object.entries(f.e || {}).forEach(([id, c]) => { const l = E[id]; if (l) { l.setAttribute('stroke', COL[c] || c); l.setAttribute('stroke-dasharray', c === 'off' ? '' : '6 5'); } });
    Object.entries(f.t || {}).forEach(([id, v]) => { if (N[id]) N[id].t.textContent = v; });
    Object.entries(f.s || {}).forEach(([id, v]) => { if (N[id]) N[id].s.textContent = v; });
    Object.entries(f.geo || {}).forEach(([id, [x, y, w, h]]) => { const q = N[id]; if (!q) return; const fs = q.n.fs || 16;
      q.r.setAttribute('x', x); q.r.setAttribute('y', y); q.r.setAttribute('width', w); q.r.setAttribute('height', h);
      q.t.setAttribute('x', x + 10); q.t.setAttribute('y', y + fs + 6); q.s.setAttribute('x', x + 10); q.s.setAttribute('y', y + fs * 2 + 10); });
  }
  function show() {
    const M = S.modes[mode]; draw(); stats.innerHTML = ''; let statList = null;
    for (let i = 0; i < k; i++) { apply(M.frames[i]); if (M.frames[i].stat) statList = M.frames[i].stat; }
    narr.firstChild.textContent = String(k); narr.className = 'caption' + (k && M.frames[k - 1].tone ? ' ' + M.frames[k - 1].tone : '');
    narr.lastChild.textContent = k ? M.frames[k - 1].cap : (M.start || S.start || 'Press Play, or Step through it.');
    (statList || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
    bStep.disabled = k >= M.frames.length;
  }
  function step() { if (k >= S.modes[mode].frames.length) return false; k++; show(); return true; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    const M = S.modes[mode]; codeEl.style.display = M.code ? '' : 'none'; codeEl.innerHTML = '';
    if (M.code) codeEl.append(el('pre', { html: IA.highlight(M.code, M.lang || 'ts') }));
    if (reduced) { k = 0; } show(); }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { k = S.modes[mode].frames.length; show(); return; }
    if (k >= S.modes[mode].frames.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(S.speed || 2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
