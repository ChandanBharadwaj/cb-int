/* Setup with Vite: create-vue scaffold, dev server serving native ESM + HMR, and the production build. */
IA.widget('vue-setup-vite', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const W = 760;
  const T = (g, x, y, s, o = {}) => { const n = svg('text', { x, y, 'font-size': o.fs || 13, 'text-anchor': o.a || 'start', fill: o.c || 'var(--text)', 'font-family': o.mono ? 'var(--mono)' : null, 'font-weight': o.b ? 700 : null, text: s }); g.append(n); return n; };
  const B = (g, x, y, w, h, label, o = {}) => {
    const stroke = o.err ? 'var(--err)' : o.ok ? 'var(--ok)' : o.warn ? 'var(--warn)' : o.hot ? 'var(--accent)' : 'var(--border)';
    g.append(svg('rect', { x, y, width: w, height: h, rx: 8, fill: o.hot ? 'var(--accent-soft)' : (o.fill || 'var(--surface)'), stroke, 'stroke-width': (o.hot || o.err || o.ok || o.warn) ? 2.2 : 1.4, 'stroke-dasharray': o.dash ? '5 4' : null, opacity: o.dim ? 0.4 : 1 }));
    if (label != null) { const ls = String(label).split('\n'); ls.forEach((ln, i) => T(g, x + w / 2, y + h / 2 + 5 + (i - (ls.length - 1) / 2) * 17, ln, { a: 'middle', fs: o.fs, mono: o.mono, b: o.b, c: o.dim ? 'var(--text-3)' : o.err ? 'var(--err)' : o.ok ? 'var(--ok)' : 'var(--text)' })); }
  };
  const A = (g, x1, y1, x2, y2, o = {}) => {
    const c = o.err ? 'var(--err)' : o.ok ? 'var(--ok)' : o.hot ? 'var(--accent)' : 'var(--text-3)'; const ang = Math.atan2(y2 - y1, x2 - x1), L = 9;
    g.append(svg('line', { x1, y1, x2, y2, stroke: c, 'stroke-width': o.hot || o.err ? 2.4 : 1.6, 'stroke-dasharray': o.dash ? '5 4' : null }),
      svg('polygon', { points: `${x2},${y2} ${x2 - L * Math.cos(ang - 0.45)},${y2 - L * Math.sin(ang - 0.45)} ${x2 - L * Math.cos(ang + 0.45)},${y2 - L * Math.sin(ang + 0.45)}`, fill: c }));
    if (o.label) T(g, (x1 + x2) / 2 + (o.lx || 0), (y1 + y2) / 2 - 7 + (o.ly || 0), o.label, { a: 'middle', fs: 11, c });
  };
  function mount(cfg) {
    let mode = cfg.modes ? cfg.modes.opts[0][0] : null; let steps = []; let k = 0; let running = false; let gen = 0;
    const stage = svg('svg', { viewBox: `0 0 ${W} ${cfg.H}`, role: 'img', 'aria-label': cfg.aria });
    const num = el('span', { class: 'n', text: '1' }); const say = el('div', { class: 't' });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, num, say);
    const codeHost = el('div', { class: 'codebox', style: { marginTop: '10px' } });
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const top = [];
    if (cfg.modes) {
      const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': cfg.modes.label });
      cfg.modes.opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
      top.push(el('div', { class: 'w-controls' }, seg));
    }
    root.append(...top, el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, codeHost);
    function show(i) {
      const s = steps[i]; stage.innerHTML = ''; const g = svg('g'); stage.append(g); s.draw(g, mode);
      num.textContent = `${i + 1}/${steps.length}`; say.remove(); say.innerHTML = s.say; narr.append(say);
      narr.className = 'caption' + (s.tone ? ' ' + s.tone : '');
      codeHost.innerHTML = ''; codeHost.style.display = s.code ? '' : 'none';
      if (s.code) codeHost.append(el('pre', { html: IA.highlight(s.code, s.lang || 'ts') }));
      bStep.disabled = i >= steps.length - 1;
    }
    function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; steps = cfg.steps(mode); k = 0; show(0); }
    function step() { if (k >= steps.length - 1) return false; show(++k); return true; }
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= steps.length - 1) reset();
      if (reduced) { k = steps.length - 1; show(k); return; }
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && step()) await sleep(cfg.speed || 2600);
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    reset();
  }
  const FILES = ['index.html', 'vite.config.ts', 'package.json', 'src/main.ts', 'src/App.vue', 'src/components/', 'src/assets/', 'public/'];
  function tree(g, hot, x = 30) {
    B(g, x, 50, 220, 222, null);
    T(g, x + 12, 72, 'my-app/', { b: true, mono: true });
    FILES.forEach((f, i) => { const on = hot.includes(f); T(g, x + 24, 98 + i * 21, f, { mono: true, fs: 12, c: on ? 'var(--accent)' : 'var(--text-2)', b: on }); });
  }
  const dev = [
    { say: '<code>npm create vue@latest</code> runs <b>create-vue</b>. It asks: TypeScript? Router? Pinia? Vitest? ESLint? Then writes a Vite project.', code: 'npm create vue@latest my-app\ncd my-app && npm install', lang: 'bash', hot: [] },
    { say: '<code>index.html</code> is the real entry. It loads <code>/src/main.ts</code> as a native ES module.', code: '<div id="app"></div>\n<script type="module" src="/src/main.ts"></script>', lang: 'text', hot: ['index.html'], a: 1 },
    { say: '<code>main.ts</code> creates the app from the root component and mounts it on <code>#app</code>.', code: "import { createApp } from 'vue'\nimport App from './App.vue'\n\ncreateApp(App).mount('#app')", hot: ['src/main.ts'], a: 2 },
    { say: '<code>npm run dev</code>: Vite does <b>not</b> bundle. The browser requests each import; Vite compiles <code>App.vue</code> on demand into JS and serves it. Startup stays fast as the app grows.', code: 'npm run dev\n#  ➜  Local:   http://localhost:5173/', lang: 'bash', hot: ['src/App.vue'], a: 3 },
    { say: 'You save <code>App.vue</code>. Vite pushes an <b>HMR</b> update over a WebSocket; the component is swapped in place and its state is usually kept. No full reload.', hot: ['src/App.vue'], a: 4 }
  ];
  const build = [
    { say: '<code>npm run build</code> runs <code>vue-tsc</code> (type check, if you chose TS) and then <code>vite build</code>.', code: '"build": "run-p type-check \\"build-only {@}\\" --"', lang: 'json', hot: ['package.json'] },
    { say: 'The bundler follows imports from <code>index.html</code>, compiles every <code>.vue</code> file, tree-shakes unused code and minifies.', hot: ['index.html', 'src/main.ts', 'src/App.vue', 'src/components/'] },
    { say: 'Output lands in <code>dist/</code>: one HTML file plus hashed JS/CSS files (<code>index-a1b2c3.js</code>). Hashes let a CDN cache them forever.', hot: [] },
    { say: '<code>dist/</code> is static files. Serve it from Nginx, a CDN, or Spring Boot’s <code>static/</code> folder. Add an SPA fallback to <code>index.html</code> if you use history-mode routing.', hot: [] }
  ];
  function drawDev(s, i) {
    return (g) => {
      tree(g, s.hot);
      T(g, 300, 30, 'npm run dev: native ES modules, compiled on demand', { b: true, fs: 14 });
      B(g, 300, 60, 140, 56, 'Browser', { hot: i >= 1 });
      B(g, 560, 60, 170, 56, 'Vite dev server\n:5173', { hot: i >= 3 });
      if (i >= 1) A(g, 440, 80, 558, 80, { hot: s.a === 1 || s.a === 2, label: 'GET /src/main.ts' });
      if (i >= 3) A(g, 440, 102, 558, 102, { hot: s.a === 3, label: 'GET /src/App.vue', ly: 24 });
      if (i >= 3) { B(g, 560, 150, 170, 50, '@vitejs/plugin-vue\n.vue → JS', { hot: s.a === 3, fs: 12 }); A(g, 645, 116, 645, 148, { hot: s.a === 3 }); }
      if (i >= 4) { B(g, 300, 220, 430, 44, 'save App.vue → WebSocket “update” → swap component', { hot: true, fs: 12 }); A(g, 560, 220, 440, 118, { hot: true, dash: true }); }
    };
  }
  function drawBuild(s, i) {
    return (g) => {
      tree(g, s.hot);
      T(g, 300, 30, 'npm run build: bundle for production', { b: true, fs: 14 });
      B(g, 300, 60, 150, 50, 'vue-tsc\ntype check', { hot: i === 0, ok: i > 0 });
      A(g, 450, 85, 498, 85, { hot: i >= 1 });
      B(g, 500, 60, 230, 50, 'vite build\ncompile · tree-shake · minify', { hot: i === 1, ok: i > 1, fs: 12 });
      if (i >= 2) { A(g, 615, 110, 615, 138, { hot: i === 2 }); B(g, 470, 140, 260, 96, null, { hot: i === 2 }); T(g, 486, 162, 'dist/', { b: true, mono: true }); ['index.html', 'assets/index-a1b2c3.js', 'assets/index-d4e5f6.css'].forEach((f, j) => T(g, 500, 184 + j * 18, f, { mono: true, fs: 12 })); }
      if (i >= 3) { A(g, 470, 190, 400, 190, { hot: true }); B(g, 290, 166, 108, 48, 'CDN / Nginx\n/ Spring', { hot: true, fs: 12 }); }
    };
  }
  mount({ aria: 'Vite project layout, dev server and build', H: 290, modes: { label: 'Phase', opts: [['dev', 'Dev server'], ['build', 'Production build']] },
    steps: (m) => (m === 'dev' ? dev.map((s, i) => ({ ...s, draw: drawDev(s, i) })) : build.map((s, i) => ({ ...s, draw: drawBuild(s, i) }))) });
});
