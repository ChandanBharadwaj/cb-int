/* Three modern CSS mechanisms: cascade layers deciding a winner, a container query reacting to its container, and :has() styling a parent. */
IA.widget('fe-modern-css', (root, ctx) => {
  const S = {
    W: 640, H: 320, aria: 'Modern CSS mechanisms', segLabel: 'Mechanism',
    modes: {
      layers: { label: '@layer', lang: 'text', code: '@layer reset, base, components, utilities;\n@layer components { .btn { background: blue } }\n@layer base { #buy.btn { background: gray } }  /* higher specificity, lower layer */\n.btn { background: green }                      /* unlayered */', nodes: [
        { id: 'reset', x: 20, y: 250, w: 600, h: 50, t: '@layer reset', s: 'lowest priority' },
        { id: 'base', x: 20, y: 190, w: 600, h: 50, t: '@layer base', s: '#buy.btn { gray }  specificity (1,1,0)' },
        { id: 'comp', x: 20, y: 130, w: 600, h: 50, t: '@layer components', s: '.btn { blue }  specificity (0,1,0)' },
        { id: 'util', x: 20, y: 70, w: 600, h: 50, t: '@layer utilities', s: '(nothing for .btn)' },
        { id: 'un', x: 20, y: 10, w: 600, h: 50, t: 'unlayered styles', s: '.btn { green }', dash: true }], frames: [
        { on: { base: 'acc', comp: 'acc' }, cap: 'Without layers, #buy.btn (an id) would beat .btn on specificity. With layers, layer order is compared first.' },
        { on: { base: 'dim', comp: 'ok' }, cap: 'components is declared after base, so it wins, whatever the specificity inside base. Specificity only breaks ties within a layer.', tone: 'ok' },
        { on: { comp: 'dim', un: 'ok' }, cap: 'Unlayered styles beat every layer (for normal declarations). Your legacy CSS keeps winning until you move it into a layer.', tone: 'warn', stat: [['winner', 'green (unlayered)']] },
        { on: { reset: 'err' }, s: { reset: 'button { color: red !important }' }, cap: '!important reverses the order: an !important in the lowest layer beats !important in higher layers and unlayered styles.', tone: 'err' }] },
      cq: { label: 'container query', lang: 'text', code: '.card-wrap { container-type: inline-size; }\n@container (min-width: 400px) {\n  .card { grid-template-columns: 120px 1fr; }\n}', nodes: [
        { id: 'vp', x: 10, y: 10, w: 620, h: 300, t: 'viewport: 1280px (unchanged)', s: '', fill: 'var(--bg-2)', dash: true },
        { id: 'wrap', x: 30, y: 60, w: 220, h: 230, t: 'sidebar slot', s: '220px wide' },
        { id: 'img', x: 45, y: 120, w: 190, h: 70, t: 'image', s: '' },
        { id: 'txt', x: 45, y: 200, w: 190, h: 70, t: 'title + text', s: '' }], frames: [
        { on: { wrap: 'acc' }, cap: 'The same .card component sits in a 220px sidebar. A media query only knows the viewport (1280px), so it would pick the wide layout here: wrong.' },
        { on: { img: 'ok', txt: 'ok' }, cap: 'container-type: inline-size makes the wrapper a query container. At 220px the card stays stacked.', tone: 'ok' },
        { geo: { wrap: [30, 60, 590, 230], img: [45, 120, 150, 150], txt: [205, 120, 400, 150] }, s: { wrap: '590px wide (main column)' }, t: { wrap: 'main column slot' }, cap: 'Move the card into the main column: the container is now ≥ 400px, so @container switches to side-by-side. The viewport never changed.', tone: 'ok', stat: [['queries', 'container size, not viewport']] }] },
      has: { label: ':has()', lang: 'text', code: 'form:has(input:invalid) .submit { opacity: .5; }\n.card:has(> img) { padding-top: 0; }   /* parent selected by child */', nodes: [
        { id: 'form', x: 20, y: 20, w: 600, h: 280, t: 'form', s: 'form:has(input:invalid)' },
        { id: 'in1', x: 50, y: 90, w: 540, h: 50, t: 'input type=email', s: 'value: ""' },
        { id: 'sub', x: 50, y: 220, w: 200, h: 56, t: 'Submit', s: '' }], frames: [
        { on: { in1: 'err' }, s: { in1: 'value: "ann@" → :invalid' }, cap: 'The user types an invalid e-mail. The input matches :invalid.', tone: 'warn' },
        { on: { form: 'err' }, cap: 'form:has(input:invalid) now matches the form: a parent selected by the state of a descendant. Before :has(), this needed JavaScript.', tone: 'err' },
        { on: { sub: 'dim' }, cap: 'So the Submit button inside it fades. :has() is Baseline in all major browsers since late 2023 (Firefox 121).' },
        { on: { in1: 'ok', form: 'ok', sub: 'ok' }, s: { in1: 'value: "ann@x.io" → :valid' }, cap: 'Fix the value: the selector stops matching and styles revert. No event listeners involved.', tone: 'ok' }] }
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
