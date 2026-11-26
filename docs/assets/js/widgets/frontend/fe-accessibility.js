/* Accessibility: the accessibility tree, modal focus management and live regions. */
IA.widget('fe-accessibility', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  // Scene format: nodes [id, x, y, w, h, label, sub?]; edges [id, from, to, label?]; steps { hot, ok, err, dim, txt: {id: label}, cap }
  const SCENES = {
  'div vs button': {
    h: 270, intro: 'Assistive tech doesn’t see pixels. It reads the <b>accessibility tree</b>. Compare two “buttons”.',
    nodes: [['div', 20, 30, 220, 56, '<div onclick="save()">', 'looks like a button'], ['btn', 20, 170, 220, 56, '<button>Save</button>', 'a real button'],
      ['t1', 300, 30, 200, 56, 'a11y tree: generic', 'name: "Save"? no role'], ['t2', 300, 170, 200, 56, 'a11y tree: button', 'name "Save", focusable'],
      ['sr1', 560, 30, 180, 56, 'Screen reader', '“Save” (text only)'], ['sr2', 560, 170, 180, 56, 'Screen reader', '“Save, button”']],
    edges: [['e1', 'div', 't1'], ['e2', 't1', 'sr1'], ['e3', 'btn', 't2'], ['e4', 't2', 'sr2']],
    steps: [
      { hot: ['div', 't1', 'e1'], cap: 'The browser builds an accessibility tree from the DOM: every node gets a <b>role</b>, a <b>name</b> and <b>states</b>. A <code>div</code> has no role.' },
      { err: ['sr1', 'e2'], cap: 'A screen reader announces just the text, with no hint that it is clickable. Tab skips it (not focusable) and Enter/Space do nothing.' },
      { ok: ['btn', 't2', 'e3'], cap: 'A <code>&lt;button&gt;</code> is focusable, fires <code>click</code> on Enter and Space, has role button, and supports <code>disabled</code>. All for free.' },
      { ok: ['sr2', 'e4'], cap: '“Save, button”. <b>First rule of ARIA</b>: if a native element does the job, use it. <code>role="button" tabindex="0"</code> plus key handlers is a worse copy.' }
    ]
  },
  'Modal focus': {
    h: 280, intro: 'Keyboard user opens a dialog. Where does focus go? Press Play.',
    nodes: [['open', 20, 30, 170, 50, 'Open “Delete”', 'button, focused'], ['dlg', 260, 20, 260, 150, 'dialog', ''],
      ['f1', 280, 60, 220, 36, 'Cancel', ''], ['f2', 280, 110, 220, 36, 'Delete', ''], ['bg', 20, 200, 500, 56, 'page behind', 'inert'],
      ['esc', 580, 90, 160, 56, 'Esc', 'close']],
    edges: [['e1', 'open', 'f1', 'focus moves'], ['e2', 'f2', 'f1', 'Tab wraps'], ['e3', 'esc', 'open', 'focus returns']], hideEdges: true,
    steps: [
      { hot: ['open'], cap: 'Focus is on the trigger button.' },
      { hot: ['dlg', 'f1', 'e1'], cap: '<code>dialog.showModal()</code> moves focus into the dialog (first focusable, or the element with <code>autofocus</code>). Put it on the safest action.' },
      { hot: ['f2', 'f1', 'e2'], dim: ['bg'], cap: 'The rest of the page is <b>inert</b>: Tab cycles inside the dialog, and screen readers can’t wander into the background. Native <code>showModal()</code> does this; a custom div modal needs <code>inert</code> on the background.' },
      { ok: ['esc', 'open', 'e3'], cap: 'Esc closes it (built in for <code>showModal()</code>), and focus must <b>return to the trigger</b> so the user doesn’t lose their place. The native dialog restores focus on close in current browsers; custom modals must do it themselves.' }
    ]
  },
  'Live regions': {
    h: 230, intro: 'A form saves via fetch with no page reload. How does a blind user know?',
    nodes: [['form', 20, 80, 170, 60, 'Save clicked', 'fetch /api/profile'], ['msg', 260, 80, 220, 60, 'toast: “Saved”', 'appears visually'],
      ['sr', 560, 80, 180, 60, 'Screen reader', '']],
    edges: [['e1', 'form', 'msg'], ['e2', 'msg', 'sr']],
    steps: [
      { hot: ['form', 'msg', 'e1'], cap: 'The toast appears. Sighted users see it.' },
      { err: ['sr', 'e2'], txt: { sr: 'silence' }, cap: 'A plain <code>div</code> appearing elsewhere is not announced, because focus didn’t move.' },
      { ok: ['sr', 'e2'], txt: { sr: '“Saved”', msg: 'role="status"' }, cap: 'Put messages in a <b>live region</b> that exists before the update: <code>role="status"</code> (polite) or <code>role="alert"</code> (assertive, for errors). Change its text and it is announced.' }
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
  const stage = svg('svg', { role: 'img', 'aria-label': 'Boxes showing DOM elements, the accessibility tree and what a screen reader announces' });
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
    const defs = svg('defs'); ['m-n', 'm-h'].forEach((id, i) => defs.append(svg('marker', { id: id + '-fe-accessibility', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M0 0L10 5L0 10z', style: `fill:${i ? 'var(--accent)' : 'var(--text-3)'}` })))); stage.append(defs);
    const byId = {}; sc.nodes.forEach((n) => { byId[n[0]] = n; });
    (sc.edges || []).forEach((e) => {
      const a = byId[e[1]], b = byId[e[2]]; if (!a || !b) return;
      const hot = has(st.hot, e[0]), err = has(st.err, e[0]), ok = has(st.ok, e[0]), dim = has(st.dim, e[0]) || (sc.hideEdges && !hot && !err && !ok);
      const [x1, y1] = anchor(a, b[1] + b[3] / 2, b[2] + b[4] / 2); const [x2, y2] = anchor(b, a[1] + a[3] / 2, a[2] + a[4] / 2);
      const col = err ? 'var(--err)' : ok ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)';
      const ln = svg('line', { x1, y1, x2, y2, 'marker-end': `url(#${hot || ok || err ? 'm-h' : 'm-n'}-fe-accessibility)`, style: `stroke:${col};stroke-width:${hot || ok || err ? 2.4 : 1.4};opacity:${dim ? 0.15 : 1}` });
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
