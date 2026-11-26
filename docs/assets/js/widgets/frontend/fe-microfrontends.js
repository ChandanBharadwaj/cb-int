/* Micro-frontends: Module Federation at runtime, composition options and the duplicate-React failure. */
IA.widget('fe-microfrontends', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  // Scene format: nodes [id, x, y, w, h, label, sub?]; edges [id, from, to, label?]; steps { hot, ok, err, dim, txt: {id: label}, cap }
  const SCENES = {
  'Module Federation': {
    h: 290, intro: 'A host app loads a remote team’s code <b>at runtime</b>, and they agree on one shared copy of React. Press Play.',
    nodes: [['host', 20, 110, 160, 64, 'Shell (host)', 'shop.example.com'], ['re', 300, 20, 190, 56, 'remoteEntry.js', 'checkout team, own deploy'],
      ['mod', 300, 120, 190, 56, './CheckoutPage', 'exposed module'], ['sh', 300, 220, 190, 56, 'share scope', 'react 18.3 (singleton)'],
      ['cdn', 580, 20, 160, 56, 'checkout CDN', 'v2025.11.20'], ['ui', 580, 170, 160, 64, 'Rendered page', 'one React tree']],
    edges: [['e1', 'host', 're', 'fetch'], ['e2', 're', 'cdn'], ['e3', 'host', 'sh', 'init'], ['e4', 're', 'mod'], ['e5', 'mod', 'sh', 'use shared'], ['e6', 'mod', 'ui', 'render']],
    steps: [
      { hot: ['host'], cap: 'The shell owns routing, layout and login. It knows the checkout remote only by URL, from config, not by an npm version.' },
      { hot: ['host', 'sh', 'e3'], cap: 'The host initialises a <b>share scope</b>: “I provide react 18.3.1, singleton, requiredVersion ^18”.' },
      { hot: ['re', 'cdn', 'e1', 'e2'], cap: 'User opens /checkout. The host fetches the remote’s small <code>remoteEntry.js</code> manifest from the checkout team’s CDN.' },
      { hot: ['re', 'mod', 'e4'], cap: 'The remote container exposes <code>./CheckoutPage</code>. Its chunk is downloaded on demand like any lazy chunk.' },
      { ok: ['sh', 'mod', 'e5'], cap: 'The remote also declared react as shared. Versions are compatible, so it reuses the host’s copy: <b>one React, one context</b>, no duplicate download.' },
      { ok: ['ui', 'e6'], cap: 'Checkout renders inside the shell. The checkout team can deploy again tonight without the shell team rebuilding. That independent deploy is the whole point.' }
    ]
  },
  'Composition options': {
    h: 300, intro: 'Where do the pieces get stitched together? Step through four common answers.',
    nodes: [['b', 20, 20, 170, 60, 'Build time', 'npm packages'], ['s', 20, 90, 170, 60, 'Server / edge', 'SSI, ESI, fragments'],
      ['r', 20, 160, 170, 60, 'Runtime (client)', 'Module Federation, import maps'], ['i', 20, 230, 170, 60, 'iframes', 'hard isolation'],
      ['out', 300, 100, 440, 100, 'Composed page', '']],
    edges: [['e1', 'b', 'out'], ['e2', 's', 'out'], ['e3', 'r', 'out'], ['e4', 'i', 'out']], hideEdges: true,
    steps: [
      { hot: ['b', 'e1'], txt: { out: 'One build, one deploy' }, sub: { out: 'simple, fast, type-safe, but releases are coupled' }, cap: 'Each team publishes a package; the shell pins versions and rebuilds. Not really micro-frontends: you lose independent deploys. Often the right answer anyway.' },
      { hot: ['s', 'e2'], txt: { out: 'HTML stitched before the browser' }, sub: { out: 'good for SEO and first paint; JS still needs coordination' }, cap: 'A server or CDN edge assembles HTML fragments from each team (Server Side Includes, Edge Side Includes, or a layout service).' },
      { hot: ['r', 'e3'], txt: { out: 'JS loaded on demand in one SPA' }, sub: { out: 'independent deploys, shared deps; runtime version risk' }, cap: 'The shell loads remote code at runtime. Module Federation (webpack 5, Rspack, Vite plugin), or native import maps plus ESM.' },
      { hot: ['i', 'e4'], txt: { out: 'Separate documents in frames' }, sub: { out: 'total isolation; poor a11y, sizing, routing, SEO' }, cap: 'Strongest isolation (separate JS realm, CSS, even origin). Painful for deep links, focus, resizing and shared state. Use for untrusted or legacy apps.' }
    ]
  },
  'Two Reacts bug': {
    h: 250, intro: 'What happens when the shared config is wrong.',
    nodes: [['host', 20, 90, 170, 60, 'Shell', 'react 18.3'], ['rem', 300, 90, 170, 60, 'Remote', 'react 19.0, not shared'],
      ['r1', 580, 20, 160, 56, 'React copy #1', 'host context'], ['r2', 580, 160, 160, 56, 'React copy #2', 'remote hooks']],
    edges: [['e1', 'host', 'r1'], ['e2', 'rem', 'r2'], ['e3', 'host', 'rem', 'mount']],
    steps: [
      { hot: ['host', 'rem', 'e3'], cap: 'The remote upgraded to React 19 and dropped react from <code>shared</code>.' },
      { err: ['r1', 'r2', 'e1', 'e2'], cap: 'Now two React copies load. The remote’s hooks look for a dispatcher in copy #2 while rendering under copy #1: <code>Invalid hook call</code>, and context such as auth or theme is invisible.' },
      { ok: ['r1', 'e1'], dim: ['r2', 'e2'], txt: { rem: 'Remote', r2: '(not loaded)' }, cap: 'Fix: declare react and react-dom as <code>singleton: true</code> with a <code>requiredVersion</code> on both sides, and agree major upgrades across teams. Shared singletons are a <b>contract</b>.' }
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
  const stage = svg('svg', { role: 'img', 'aria-label': 'A shell app, a remote app and shared dependencies, with arrows for runtime loading' });
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
    const defs = svg('defs'); ['m-n', 'm-h'].forEach((id, i) => defs.append(svg('marker', { id: id + '-fe-microfrontends', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M0 0L10 5L0 10z', style: `fill:${i ? 'var(--accent)' : 'var(--text-3)'}` })))); stage.append(defs);
    const byId = {}; sc.nodes.forEach((n) => { byId[n[0]] = n; });
    (sc.edges || []).forEach((e) => {
      const a = byId[e[1]], b = byId[e[2]]; if (!a || !b) return;
      const hot = has(st.hot, e[0]), err = has(st.err, e[0]), ok = has(st.ok, e[0]), dim = has(st.dim, e[0]) || (sc.hideEdges && !hot && !err && !ok);
      const [x1, y1] = anchor(a, b[1] + b[3] / 2, b[2] + b[4] / 2); const [x2, y2] = anchor(b, a[1] + a[3] / 2, a[2] + a[4] / 2);
      const col = err ? 'var(--err)' : ok ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)';
      const ln = svg('line', { x1, y1, x2, y2, 'marker-end': `url(#${hot || ok || err ? 'm-h' : 'm-n'}-fe-microfrontends)`, style: `stroke:${col};stroke-width:${hot || ok || err ? 2.4 : 1.4};opacity:${dim ? 0.15 : 1}` });
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
