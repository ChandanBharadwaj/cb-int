/* Build tools: dev server vs production build vs tree shaking, step by step. */
IA.widget('fe-build-tools', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  // Scene format: nodes [id, x, y, w, h, label, sub?]; edges [id, from, to, label?]; steps { hot, ok, err, dim, txt: {id: label}, cap }
  const SCENES = {
  'Dev server (Vite)': {
    h: 280, intro: 'Vite in dev does <b>not</b> bundle your code. Press Play to follow one page load and one edit.',
    nodes: [['br', 20, 30, 150, 60, 'Browser', 'native ES modules'], ['vs', 300, 30, 170, 60, 'Vite dev server', 'transform on request'],
      ['src', 580, 20, 160, 50, 'src/*.ts, *.vue', 'your code'], ['deps', 580, 110, 160, 50, 'node_modules', 'lodash-es, react…'],
      ['cache', 300, 170, 170, 60, 'node_modules/.vite', 'pre-bundled deps'], ['eb', 580, 200, 160, 50, 'esbuild', 'Go, very fast'],
      ['hmr', 20, 170, 150, 60, 'HMR client', 'WebSocket']],
    edges: [['e1', 'br', 'vs', 'GET'], ['e2', 'vs', 'src', 'read 1 file'], ['e3', 'deps', 'eb'], ['e4', 'eb', 'cache', 'bundle once'], ['e5', 'cache', 'vs'], ['e6', 'vs', 'hmr', 'update'], ['e7', 'hmr', 'br']],
    steps: [
      { hot: ['vs'], cap: '<code>vite</code> starts in well under a second even on big apps: it only scans imports, it does not build a bundle.' },
      { hot: ['deps', 'eb', 'cache', 'e3', 'e4'], cap: 'Dependencies are <b>pre-bundled once</b> with esbuild: CommonJS becomes ESM, and a package with 600 internal files becomes one request. Cached until the lockfile changes.' },
      { hot: ['br', 'vs', 'e1'], txt: { br: 'Browser\nGET /src/main.ts' }, cap: 'The browser loads <code>index.html</code>, sees <code>&lt;script type="module"&gt;</code>, and asks for each import as a separate HTTP request.' },
      { hot: ['vs', 'src', 'e2'], cap: 'Only the requested file is transformed (TS → JS strips types; Vue SFC → JS). Unvisited routes cost nothing. Type checking is <b>not</b> done here: run <code>tsc --noEmit</code> separately.' },
      { hot: ['cache', 'e5', 'e1'], cap: 'Bare imports like <code>import "react"</code> are rewritten to <code>/node_modules/.vite/deps/react.js</code>, served with a strong cache.' },
      { ok: ['src', 'vs', 'hmr', 'br', 'e6', 'e7'], txt: { src: 'Button.vue edited' }, cap: 'Save a file: the server invalidates just that module and pushes an HMR update over a WebSocket. The page swaps the module without a reload, so state survives.' }
    ]
  },
  'Production build': {
    h: 280, intro: 'For production Vite hands the module graph to Rollup (Rolldown in newer versions). Play to see chunks appear.',
    nodes: [['ent', 20, 110, 120, 50, 'main.ts', 'entry'], ['g', 180, 110, 130, 50, 'module graph', '1,200 modules'],
      ['ts', 350, 110, 120, 50, 'tree shake', 'drop unused'], ['c1', 520, 20, 220, 44, 'index-[hash].js', 'app shell'],
      ['c2', 520, 85, 220, 44, 'vendor-[hash].js', 'react, router'], ['c3', 520, 150, 220, 44, 'Settings-[hash].js', 'lazy route'],
      ['c4', 520, 215, 220, 44, 'index-[hash].css', 'extracted CSS']],
    edges: [['e1', 'ent', 'g'], ['e2', 'g', 'ts'], ['e3', 'ts', 'c1'], ['e4', 'ts', 'c2'], ['e5', 'ts', 'c3', 'import()'], ['e6', 'ts', 'c4']],
    steps: [
      { hot: ['ent', 'g', 'e1'], cap: 'Start at the entry and follow every static <code>import</code>. The result is a graph, like a Maven dependency tree but at file level.' },
      { hot: ['ts', 'e2'], cap: 'Tree shaking: exports nobody imports are dropped. It needs <b>ES modules</b>, because <code>import</code>/<code>export</code> are static and analysable; <code>require()</code> is not.' },
      { hot: ['c1', 'e3'], cap: 'The entry chunk. Minified (esbuild or Terser), content-hashed file name.' },
      { hot: ['c3', 'e5'], cap: 'A dynamic <code>import(\'./Settings\')</code> is a <b>split point</b>: it gets its own chunk, downloaded only when the user navigates there.' },
      { hot: ['c2', 'e4'], cap: 'Shared code can be grouped with <code>manualChunks</code>. A separate vendor chunk stays cached across app releases if its hash doesn’t change.' },
      { ok: ['c1', 'c2', 'c3', 'c4'], cap: 'Hashed names mean you can serve them with <code>Cache-Control: max-age=31536000, immutable</code>. Only <code>index.html</code> must stay short-lived.' }
    ]
  },
  'Tree shaking': {
    h: 250, intro: 'Which exports survive? Step through.',
    nodes: [['app', 20, 100, 150, 56, 'app.ts', 'import { fmt } from "./utils"'], ['u', 260, 100, 140, 56, 'utils.ts', '3 exports'],
      ['a', 500, 20, 240, 50, 'fmt()', 'imported'], ['b', 500, 100, 240, 50, 'parse()', 'never imported'], ['c', 500, 180, 240, 50, 'polyfill at top level', 'side effect']],
    edges: [['e1', 'app', 'u'], ['e2', 'u', 'a'], ['e3', 'u', 'b'], ['e4', 'u', 'c']],
    steps: [
      { hot: ['app', 'u', 'e1'], cap: 'The app imports a single named export.' },
      { ok: ['a', 'e2'], cap: '<code>fmt</code> is used, so it is kept.' },
      { err: ['b'], dim: ['e3'], txt: { b: 'parse() removed' }, cap: '<code>parse</code> is a pure, unused function: removed from the bundle.' },
      { hot: ['c', 'e4'], cap: 'Top-level code that might have side effects (patching <code>Array.prototype</code>, registering a custom element) is <b>kept</b> because the bundler can’t prove it is safe to drop.' },
      { ok: ['c'], txt: { c: '"sideEffects": false' }, cap: 'A library can declare <code>"sideEffects": false</code> (or a list of files) in <code>package.json</code>. Then whole unused modules are skipped. Lie about it and your polyfill silently disappears.' }
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
  const stage = svg('svg', { role: 'img', 'aria-label': 'Boxes for browser, dev server, files and output chunks with arrows showing the flow' });
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
    const defs = svg('defs'); ['m-n', 'm-h'].forEach((id, i) => defs.append(svg('marker', { id: id + '-fe-build-tools', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M0 0L10 5L0 10z', style: `fill:${i ? 'var(--accent)' : 'var(--text-3)'}` })))); stage.append(defs);
    const byId = {}; sc.nodes.forEach((n) => { byId[n[0]] = n; });
    (sc.edges || []).forEach((e) => {
      const a = byId[e[1]], b = byId[e[2]]; if (!a || !b) return;
      const hot = has(st.hot, e[0]), err = has(st.err, e[0]), ok = has(st.ok, e[0]), dim = has(st.dim, e[0]) || (sc.hideEdges && !hot && !err && !ok);
      const [x1, y1] = anchor(a, b[1] + b[3] / 2, b[2] + b[4] / 2); const [x2, y2] = anchor(b, a[1] + a[3] / 2, a[2] + a[4] / 2);
      const col = err ? 'var(--err)' : ok ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)';
      const ln = svg('line', { x1, y1, x2, y2, 'marker-end': `url(#${hot || ok || err ? 'm-h' : 'm-n'}-fe-build-tools)`, style: `stroke:${col};stroke-width:${hot || ok || err ? 2.4 : 1.4};opacity:${dim ? 0.15 : 1}` });
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
