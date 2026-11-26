/* Web Components: custom element lifecycle, Shadow DOM style boundaries and composed events. */
IA.widget('fe-web-components', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  // Scene format: nodes [id, x, y, w, h, label, sub?]; edges [id, from, to, label?]; steps { hot, ok, err, dim, txt: {id: label}, cap }
  const SCENES = {
  'Lifecycle': {
    h: 270, intro: 'What runs when the parser meets <code>&lt;user-card name="Asha"&gt;</code>? Press Play.',
    nodes: [['html', 20, 20, 200, 56, '<user-card name="Asha">', 'in the HTML'], ['def', 20, 120, 200, 56, 'customElements.define', "('user-card', UserCard)"],
      ['ctor', 300, 20, 180, 50, 'constructor()', 'attachShadow, no attrs yet'], ['acc', 300, 90, 180, 50, 'attributeChangedCallback', 'name: null → "Asha"'],
      ['con', 300, 160, 180, 50, 'connectedCallback', 'in the document'], ['dis', 560, 160, 180, 50, 'disconnectedCallback', 'removed: clean up'],
      ['up', 560, 20, 180, 50, 'undefined element', 'HTMLElement, :not(:defined)']],
    edges: [['e0', 'html', 'up', 'before define'], ['e1', 'def', 'ctor', 'upgrade'], ['e2', 'ctor', 'acc'], ['e3', 'acc', 'con'], ['e4', 'con', 'dis', 'el.remove()']],
    steps: [
      { hot: ['html', 'up', 'e0'], cap: 'If the script hasn’t run yet, the tag is just an unknown <code>HTMLElement</code>. Style it with <code>user-card:not(:defined)</code> to avoid a flash.' },
      { hot: ['def', 'ctor', 'e1'], cap: '<code>customElements.define()</code> <b>upgrades</b> existing instances. The constructor runs first. Call <code>super()</code>, attach a shadow root, set defaults. Don’t read attributes or add children here.' },
      { hot: ['acc', 'e2'], cap: 'For each attribute listed in <code>static observedAttributes</code>, <code>attributeChangedCallback(name, old, new)</code> fires. Attributes are always <b>strings</b>.' },
      { hot: ['con', 'e3'], cap: '<code>connectedCallback</code>: the element is in the document. Render, add listeners, fetch. It can run more than once if the element is moved.' },
      { hot: ['dis', 'e4'], cap: '<code>disconnectedCallback</code>: remove global listeners, abort fetches, stop timers. Forgetting this leaks, just like a missing <code>@PreDestroy</code>.' }
    ]
  },
  'Shadow DOM & styles': {
    h: 290, intro: 'Which styles cross the shadow boundary? Step through.',
    nodes: [['page', 20, 20, 220, 56, 'Page CSS', 'p { color: red }'], ['vars', 20, 110, 220, 56, 'Custom properties', '--brand: teal'],
      ['part', 20, 200, 220, 56, '::part(title)', 'opt-in hooks'], ['sr', 340, 40, 400, 220, 'shadow root', ''],
      ['in', 370, 90, 160, 50, '<p part="title">', 'inside the component'], ['slot', 560, 90, 160, 50, '<slot>', 'shows light DOM'],
      ['st', 370, 180, 350, 50, ':host, ::slotted(*), own <style>', 'scoped to this component']],
    edges: [['e1', 'page', 'in'], ['e2', 'vars', 'in'], ['e3', 'part', 'in']],
    steps: [
      { err: ['page', 'e1'], cap: 'Page selectors do <b>not</b> match inside a shadow root. <code>p { color: red }</code> doesn’t reach the inner <code>&lt;p&gt;</code>. That is the encapsulation.' },
      { ok: ['vars', 'e2'], cap: 'Inherited properties (<code>color</code>, <code>font</code>) and <b>CSS custom properties</b> do inherit through the boundary. This is how design tokens theme components.' },
      { ok: ['part', 'e3'], cap: 'The component can expose elements with <code>part="title"</code>; the page styles them with <code>user-card::part(title)</code>.' },
      { hot: ['slot'], cap: 'Children you write inside <code>&lt;user-card&gt;</code> stay in the <b>light DOM</b> (page CSS still styles them) and are rendered where the <code>&lt;slot&gt;</code> is.' },
      { hot: ['st', 'sr'], cap: 'Inside, <code>:host</code> styles the element itself and <code>::slotted()</code> styles top-level slotted children. Page CSS for the host element wins over <code>:host</code>.' }
    ]
  },
  'Events & composed': {
    h: 240, intro: 'A button inside the shadow root dispatches an event. Who hears it?',
    nodes: [['btn', 20, 90, 160, 56, '<button> in shadow', 'dispatches'], ['sr', 230, 90, 140, 56, 'shadow root', 'boundary'],
      ['host', 420, 90, 140, 56, '<user-card>', 'host element'], ['doc', 600, 90, 140, 56, 'document', 'app listener']],
    edges: [['e1', 'btn', 'sr'], ['e2', 'sr', 'host'], ['e3', 'host', 'doc']],
    steps: [
      { hot: ['btn', 'sr', 'e1'], cap: '<code>new CustomEvent(\'select\', { bubbles: true })</code>: bubbles, but only inside the shadow tree.' },
      { err: ['host', 'e2'], cap: 'Without <code>composed: true</code>, it stops at the shadow root. A listener on <code>&lt;user-card&gt;</code> never fires.' },
      { ok: ['host', 'doc', 'e2', 'e3'], txt: { btn: '<button> in shadow' }, cap: 'With <code>{ bubbles: true, composed: true }</code> it crosses the boundary. Outside, <code>event.target</code> is <b>retargeted</b> to the host, so internals stay hidden. Built-in UI events like <code>click</code> are already composed.' }
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
  const stage = svg('svg', { role: 'img', 'aria-label': 'Boxes for a custom element, its shadow root, page styles and events with arrows' });
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
    const defs = svg('defs'); ['m-n', 'm-h'].forEach((id, i) => defs.append(svg('marker', { id: id + '-fe-web-components', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M0 0L10 5L0 10z', style: `fill:${i ? 'var(--accent)' : 'var(--text-3)'}` })))); stage.append(defs);
    const byId = {}; sc.nodes.forEach((n) => { byId[n[0]] = n; });
    (sc.edges || []).forEach((e) => {
      const a = byId[e[1]], b = byId[e[2]]; if (!a || !b) return;
      const hot = has(st.hot, e[0]), err = has(st.err, e[0]), ok = has(st.ok, e[0]), dim = has(st.dim, e[0]) || (sc.hideEdges && !hot && !err && !ok);
      const [x1, y1] = anchor(a, b[1] + b[3] / 2, b[2] + b[4] / 2); const [x2, y2] = anchor(b, a[1] + a[3] / 2, a[2] + a[4] / 2);
      const col = err ? 'var(--err)' : ok ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)';
      const ln = svg('line', { x1, y1, x2, y2, 'marker-end': `url(#${hot || ok || err ? 'm-h' : 'm-n'}-fe-web-components)`, style: `stroke:${col};stroke-width:${hot || ok || err ? 2.4 : 1.4};opacity:${dim ? 0.15 : 1}` });
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
