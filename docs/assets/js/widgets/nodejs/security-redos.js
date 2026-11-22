/* ReDoS: count the match attempts a backtracking engine makes for /^(a+)+$/ vs /^a+$/ on "a…a!" as the input grows. */
IA.widget('security-redos', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  // Attempts for (a+)+$ on n a's followed by '!': the outer group can split the run in every possible way.
  // C(k) = sum over first-chunk length m=1..k of (1 + C(k-m)) = 2^k - 1 tries before failing at '!'.
  const evil = (n) => Math.pow(2, n) - 1;
  const safe = (n) => n;
  let n = 10; let gen = 0; let running = false;
  const MIN = 5; const MAX = 40;
  const range = el('input', { type: 'range', min: MIN, max: MAX, value: n, 'aria-label': 'Number of a characters' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 600; const H = 190; const X0 = 150; const X1 = W - 20;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Bars comparing match attempts on a log scale' });
  const inputEl = el('div', { class: 'codebox', style: { marginTop: '8px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, el('label', null, 'input length', range)), inputEl, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  const fmt = (v) => v >= 1e6 ? v.toExponential(2).replace('e+', ' × 10^') : v.toLocaleString('en-US');
  function draw() {
    stage.innerHTML = '';
    const lmax = Math.log10(evil(MAX)); const X = (v) => X0 + (Math.log10(Math.max(1, v)) / lmax) * (X1 - X0);
    for (let d = 0; d <= 12; d += 3) { const x = X(Math.pow(10, d));
      stage.append(svg('line', { x1: x, x2: x, y1: 20, y2: 150, stroke: 'var(--border)', 'stroke-dasharray': '3 4' }), svg('text', { x, y: 168, 'font-size': 11, fill: 'var(--text-3)', 'text-anchor': 'middle', text: d === 0 ? '1' : '10^' + d })); }
    const bar = (y, label, v, color) => {
      stage.append(svg('text', { x: 10, y: y + 18, 'font-size': 14, 'font-family': 'var(--mono)', fill: 'var(--text)', text: label }));
      const r = svg('rect', { x: X0, y, width: Math.max(2, X(v) - X0), height: 28, rx: 4, fill: color });
      if (!reduced) r.style.transition = 'width .5s ease';
      stage.append(r, svg('text', { x: Math.min(X(v) + 6, X1 - 4), y: y + 46, 'font-size': 12, fill: 'var(--text-2)', 'text-anchor': X(v) > W - 120 ? 'end' : 'start', text: fmt(v) + ' attempts' }));
    };
    bar(28, '/^(a+)+$/', evil(n), 'var(--err)');
    bar(92, '/^a+$/', safe(n), 'var(--ok)');
    stage.append(svg('text', { x: X1, y: 186, 'font-size': 11, fill: 'var(--text-3)', 'text-anchor': 'end', text: 'log scale' }));
    inputEl.innerHTML = ''; inputEl.append(el('pre', { text: `'${'a'.repeat(n)}!'   // ${n + 1} characters` }));
    range.value = n;
    const ratio = evil(n) / evil(n - 1);
    narr.innerHTML = ''; narr.append(el('div', { class: 't', html: `n = <b>${n}</b>. The nested pattern tries every way to split the a’s between the inner and outer <code>+</code> before failing at <code>!</code>: about <b>2<sup>${n}</sup></b> attempts, so each extra character roughly <b>doubles</b> the work (×${ratio.toFixed(2)}). The simple pattern tries ${n}. ` + (n >= 28 ? 'At this size the nested version keeps the only JavaScript thread busy for a very long time: no other request runs meanwhile.' : 'Keep going: the red bar climbs one order of magnitude every ~3.3 characters.') }));
  }
  range.addEventListener('input', () => { n = Number(range.value); running = false; bPlay.textContent = '▶ Play'; draw(); });
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; if (n < MAX) { n++; draw(); } });
  bReset.addEventListener('click', () => { gen++; running = false; bPlay.textContent = '▶ Play'; n = 10; draw(); });
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { n = MAX; draw(); return; }
    if (n >= MAX) n = MIN;
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && n < MAX) { n++; draw(); await sleep(700); }
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  draw();
});
