/* The rendering pipeline: which stages a change re-runs (layout → paint → composite), and forced synchronous layout. */
IA.widget('fe-how-browser-works', (root, ctx) => {
  const P = () => [
    { id: 'html', x: 20, y: 20, w: 180, h: 64, t: 'HTML bytes', s: 'tokenise → parse' },
    { id: 'css', x: 20, y: 120, w: 180, h: 64, t: 'CSS bytes', s: 'parse rules' },
    { id: 'dom', x: 230, y: 20, w: 180, h: 64, t: 'DOM', s: 'tree of nodes' },
    { id: 'cssom', x: 230, y: 120, w: 180, h: 64, t: 'CSSOM', s: 'rules + cascade' },
    { id: 'style', x: 440, y: 70, w: 180, h: 64, t: 'Style', s: 'computed styles' },
    { id: 'layout', x: 20, y: 240, w: 180, h: 64, t: 'Layout', s: 'boxes: x, y, w, h' },
    { id: 'paint', x: 230, y: 240, w: 180, h: 64, t: 'Paint', s: 'draw lists per layer' },
    { id: 'comp', x: 440, y: 240, w: 180, h: 64, t: 'Composite', s: 'GPU stacks layers' }];
  const ED = [['html', 'dom'], ['css', 'cssom'], ['dom', 'style'], ['cssom', 'style'], ['style', 'layout'], ['layout', 'paint'], ['paint', 'comp']];
  const ALL = { html: 'off', css: 'off', dom: 'off', cssom: 'off', style: 'off', layout: 'off', paint: 'off', comp: 'off' };
  const S = {
    W: 640, H: 320, aria: 'Rendering pipeline: HTML and CSS parse into DOM and CSSOM, then style, layout, paint and composite', segLabel: 'What changes',
    modes: {
      load: { label: 'First load', start: 'A page arrives as bytes. Press Play to follow it to pixels.', nodes: P(), edges: ED, frames: [
        { on: { html: 'acc' }, e: { 'html>dom': 'acc' }, cap: 'The HTML parser tokenises bytes into tags and builds the DOM incrementally, as bytes stream in.' },
        { on: { html: 'ok', dom: 'acc', css: 'acc' }, e: { 'css>cssom': 'acc' }, cap: 'A <link rel=stylesheet> is found. CSS is parsed into the CSSOM. The page cannot render until the CSSOM is complete, so CSS is render-blocking.', tone: 'warn' },
        { on: { dom: 'ok', css: 'ok', cssom: 'ok', style: 'acc' }, e: { 'dom>style': 'acc', 'cssom>style': 'acc' }, cap: 'Style: the cascade matches selectors to every element and produces computed styles (display:none elements drop out of the render tree).' },
        { on: { style: 'ok', layout: 'acc' }, e: { 'style>layout': 'acc' }, cap: 'Layout (reflow): compute the geometry of every box, from the root down. Widths flow down, heights flow back up.' },
        { on: { layout: 'ok', paint: 'acc' }, e: { 'layout>paint': 'acc' }, cap: 'Paint: record draw commands (text, borders, shadows) for each layer, then rasterise them into pixels/tiles.' },
        { on: { paint: 'ok', comp: 'ok' }, e: { 'paint>comp': 'acc' }, cap: 'Composite: the compositor thread stacks layers on the GPU and puts a frame on screen. Done: first paint.', tone: 'ok', stat: [['stages run', '8/8']] }] },
      width: { label: 'el.style.width', code: "box.style.width = '320px';   // geometry change", nodes: P(), edges: ED, frames: [
        { on: { ...ALL, html: 'dim', css: 'dim', dom: 'acc' }, cap: 'JS changes a geometric property. DOM/CSSOM already exist, so parsing is skipped.' },
        { on: { style: 'acc' }, cap: 'Style is recalculated for the affected elements.' },
        { on: { layout: 'err' }, cap: 'Width changed → layout must re-run, and siblings/parents may move too. This is a reflow, the expensive part.', tone: 'err' },
        { on: { paint: 'warn', comp: 'ok' }, cap: 'Moved boxes must be repainted, then composited. Layout + paint + composite every time.', stat: [['re-run', 'style · layout · paint · composite']] }] },
      color: { label: 'color', code: "box.style.background = 'tomato';   // paint-only change", nodes: P(), edges: ED, frames: [
        { on: { ...ALL, html: 'dim', css: 'dim', style: 'acc' }, cap: 'A colour change: recalculate style for the element.' },
        { on: { layout: 'dim' }, cap: 'Geometry is unchanged, so layout is skipped.', tone: 'ok' },
        { on: { paint: 'warn', comp: 'ok' }, cap: 'Repaint the affected area and composite. Cheaper than reflow, but still main-thread work.', stat: [['re-run', 'style · paint · composite']] }] },
      transform: { label: 'transform', code: "box.style.transform = 'translateX(120px)';   // compositor-only (when on its own layer)", nodes: P(), edges: ED, frames: [
        { on: { ...ALL, html: 'dim', css: 'dim', style: 'acc' }, cap: 'transform and opacity do not change layout.' },
        { on: { layout: 'dim', paint: 'dim' }, cap: 'If the element already has its own compositor layer (e.g. will-change: transform, or an active transform animation), its pixels are reused.' },
        { on: { comp: 'ok' }, cap: 'Only composite runs, and it can run on the compositor thread, so it stays smooth even when the main thread is busy.', tone: 'ok', stat: [['re-run', 'composite only']] }] },
      thrash: { label: 'layout thrash', code: "for (const el of items) {\n  el.style.width = box.offsetWidth + 'px'; // read → write → read …\n}", nodes: P(), edges: ED, frames: [
        { on: { ...ALL, html: 'dim', css: 'dim', layout: 'ok' }, cap: 'Normally the browser batches: many style writes, then one layout before the next frame.' },
        { on: { layout: 'warn' }, s: { layout: 'dirty after write #1' }, cap: 'Iteration 1 writes a width. Layout is now dirty.' },
        { on: { layout: 'err' }, s: { layout: 'forced sync layout ×1' }, cap: 'Iteration 2 reads offsetWidth. To answer correctly the browser must run layout now, synchronously: a forced reflow.', tone: 'err' },
        { s: { layout: 'forced sync layout ×1000' }, cap: 'Repeat for 1000 items → 1000 layouts in one task. DevTools shows purple “Layout” blocks with a “Forced reflow” warning.', tone: 'err', stat: [['layouts', '1000 instead of 1']] },
        { on: { layout: 'ok' }, s: { layout: 'one layout per frame' }, cap: 'Fix: read everything first, then write everything (or use requestAnimationFrame / a measure-then-mutate library).', tone: 'ok', stat: [['layouts', '1']] }] }
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
