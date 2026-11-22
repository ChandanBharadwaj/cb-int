/* CommonJS vs ESM: resolution (which paths Node tries), the CJS cache + wrapper, and ESM's parse → link → evaluate phases. */
IA.widget('modules-cjs-esm', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-mod-style')) {
    document.head.append(el('style', { id: 'w-mod-style', text: `
.w-mod .st { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .3s, stroke .3s; }
.w-mod .st.on { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2.5; }
.w-mod .st.done { fill: color-mix(in srgb, var(--ok) 14%, var(--surface)); stroke: var(--ok); }
.w-mod .stl { fill: var(--text); font-size: 13px; font-weight: 700; }
.w-mod .arr { stroke: var(--text-3); stroke-width: 2; fill: none; }
.w-mod-grid { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 12px; align-items: start; margin-top: 10px; }
@media (max-width: 680px) { .w-mod-grid { grid-template-columns: 1fr; } }
.w-mod-tree { font-family: var(--mono); font-size: 12.5px; border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--surface-2); min-width: 0; }
.w-mod-tree div { padding: 2px 6px; border-radius: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background .3s; }
.w-mod-tree div.exec { background: var(--accent-soft); color: var(--accent); font-weight: 700; }
.w-mod-tree div.hit { background: color-mix(in srgb, var(--ok) 18%, transparent); }
.w-mod-tree div.cached { background: color-mix(in srgb, var(--accent-2) 16%, transparent); }
.w-mod-tree div.miss { color: var(--text-3); text-decoration: line-through; }
.w-mod-tries { font-family: var(--mono); font-size: 12px; margin-top: 8px; }
.w-mod-tries div { padding: 1px 0; overflow-wrap: anywhere; animation: capin .3s ease both; }
.w-mod-tries .ok { color: var(--ok); } .w-mod-tries .no { color: var(--err); }
` }));
  }
  const T = (rows) => rows.map(([d, name, id]) => ({ d, name, id: id || name }));
  const CJS_TREE = T([[0, '/app/'], [1, 'package.json  { "type": "commonjs" }', 'pkg'], [1, 'node_modules/', 'nm'], [2, 'lodash/', 'lodash'], [3, 'package.json  { "main": "lodash.js" }', 'lpkg'], [3, 'lodash.js', 'ljs'], [1, 'src/', 'src'], [2, 'index.js', 'index'], [2, 'utils/', 'utilsDir'], [3, 'index.js', 'utilsIdx']]);
  const ESM_TREE = T([[0, '/app/'], [1, 'package.json  { "type": "module" }', 'pkg'], [1, 'src/', 'src'], [2, 'main.js', 'main'], [2, 'cart.js', 'cart'], [2, 'tax.js', 'tax']]);
  const MIX_TREE = T([[0, '/app/'], [1, 'package.json  { "type": "commonjs" }', 'pkg'], [1, 'src/', 'src'], [2, 'app.js  (CommonJS)', 'app'], [2, 'legacy.cjs', 'legacy'], [2, 'esm-lib.mjs', 'esmlib'], [2, 'slow-lib.mjs  (top-level await)', 'slow']]);
  const MODES = {
    rel: { label: "require('./utils')", tree: CJS_TREE, stages: ['resolve', 'cache?', 'wrap', 'execute', 'module.exports'], code: "// /app/src/index.js\nconst utils = require('./utils');\nconsole.log(utils.slugify('Hello World'));",
      steps: [
        { s: 0, tr: { index: 'exec' }, t: '<code>index.js</code> runs. <code>require(\'./utils\')</code> is an ordinary <b>synchronous</b> function call: index.js stops here until it returns.' },
        { s: 0, tr: { index: 'exec' }, tries: [['./utils is not a built-in module, and it starts with ./ → resolve against __dirname = /app/src', null]], t: 'Not a built-in (like <code>fs</code> or <code>node:fs</code>), and it starts with <code>./</code>, so Node resolves it relative to the calling file’s folder.' },
        { s: 0, tr: { index: 'exec', utilsDir: 'hit' }, tries: [['/app/src/utils', false], ['/app/src/utils.js', false], ['/app/src/utils.json', false], ['/app/src/utils.node', false]], t: 'First as a file: the exact name, then with <code>.js</code>, <code>.json</code> and <code>.node</code> appended. None exist, but a <b>directory</b> called utils does.' },
        { s: 0, tr: { index: 'exec', utilsDir: 'hit', utilsIdx: 'hit' }, tries: [['/app/src/utils/package.json "main"', false], ['/app/src/utils/index.js', true]], t: 'As a directory: a <code>package.json</code> with <code>"main"</code>? No. So <code>index.js</code>. Resolved filename: <code>/app/src/utils/index.js</code>.' },
        { s: 1, tr: { index: 'exec', utilsIdx: 'hit' }, t: '<code>require.cache</code> is keyed by that resolved filename. Miss: Node creates a new <code>Module</code> and <b>puts it in the cache before running it</b>. That is why circular requires see a half-filled <code>exports</code>.' },
        { s: 2, tr: { index: 'exec', utilsIdx: 'exec' }, snip: '(function (exports, require, module, __filename, __dirname) {\n  // ↓ the source of /app/src/utils/index.js\n  exports.slugify = (s) => s.toLowerCase().replace(/\\s+/g, \'-\');\n});', t: 'Node wraps the source in a function. <code>require</code>, <code>module</code>, <code>exports</code>, <code>__filename</code> and <code>__dirname</code> are <b>parameters</b>, not globals. Top-level variables stay private to the module.' },
        { s: 3, tr: { index: 'exec', utilsIdx: 'exec' }, t: 'The wrapper runs <b>now</b>, synchronously, top to bottom. Any <code>require</code> inside it would repeat this whole process, depth first.' },
        { s: 4, tr: { index: 'exec', utilsIdx: 'cached' }, t: '<code>require</code> returns <code>module.exports</code> (here <code>{ slugify }</code>) and index.js continues on the next line.' },
        { s: 1, tr: { index: 'exec', utilsIdx: 'cached' }, tries: [["require('./utils/index.js') from another file", true]], t: 'Any later <code>require</code> that resolves to the same filename is a <b>cache hit</b>: same object, and the code does not run again. Module state is a per-process singleton.' }
      ] },
    bare: { label: "require('lodash')", tree: CJS_TREE, stages: ['resolve', 'cache?', 'wrap', 'execute', 'module.exports'], code: "// /app/src/index.js\nconst _ = require('lodash');",
      steps: [
        { s: 0, tr: { index: 'exec' }, t: '<code>\'lodash\'</code> is a <b>bare specifier</b>: not built-in, not relative, not absolute. Node searches <code>node_modules</code> folders, starting next to the calling file and walking up.' },
        { s: 0, tr: { index: 'exec', nm: 'hit', lodash: 'hit' }, tries: [['/app/src/node_modules/lodash', false], ['/app/node_modules/lodash', true], ['(would go on: /node_modules/lodash)', null]], t: 'Not in <code>/app/src/node_modules</code>; found in <code>/app/node_modules</code>. You can see this search list in <code>module.paths</code>.' },
        { s: 0, tr: { index: 'exec', lpkg: 'hit', ljs: 'hit' }, tries: [['package.json "exports"?', false], ['package.json "main": "lodash.js"', true], ['→ /app/node_modules/lodash/lodash.js', true]], t: 'Node reads the package’s <code>package.json</code>. With an <code>"exports"</code> field, <b>only</b> the listed entry points could be loaded (anything else throws <code>ERR_PACKAGE_PATH_NOT_EXPORTED</code>). This one has only <code>"main"</code>.' },
        { s: 1, tr: { index: 'exec', ljs: 'hit' }, t: 'Cache check by full filename: miss. Two different copies of lodash at two paths would be two separate modules with separate state.' },
        { s: 2, tr: { index: 'exec', ljs: 'exec' }, t: 'Wrap, as for any CommonJS file.' },
        { s: 3, tr: { index: 'exec', ljs: 'exec' }, t: 'Execute synchronously. Big libraries make <code>require</code> slow at start-up; that cost is paid once.' },
        { s: 4, tr: { index: 'exec', ljs: 'cached' }, t: '<code>_</code> is lodash’s <code>module.exports</code>. <code>require.resolve(\'lodash\')</code> gives you the resolved path without running anything.' }
      ] },
    esm: { label: "import … from './cart.js'", tree: ESM_TREE, stages: ['parse', 'resolve imports', 'link', 'evaluate', 'namespace'], code: "// /app/src/main.js   (\"type\": \"module\")\nimport { total, add } from './cart.js';\nadd(10);\nconsole.log(total);\n\n// cart.js\nimport { rate } from './tax.js';\nexport let total = 0;\nexport function add(p) { total += p * (1 + rate); }\n\n// tax.js\nexport const rate = await loadRate();   // top-level await",
      steps: [
        { s: 0, tr: { pkg: 'hit', main: 'exec' }, t: 'The nearest <code>package.json</code> says <code>"type": "module"</code>, so <code>.js</code> files are ES modules. Node <b>parses</b> main.js and collects its static <code>import</code>s. No code runs yet.' },
        { s: 1, tr: { main: 'exec', cart: 'hit' }, tries: [["'./cart.js' → file:///app/src/cart.js", true], ["('./cart' would fail: ESM does no extension or index.js guessing)", false]], t: 'Specifiers are resolved as <b>URLs</b>. Relative imports need the full file name, extension included.' },
        { s: 1, tr: { main: 'exec', cart: 'exec', tax: 'hit' }, tries: [["cart.js imports './tax.js' → file:///app/src/tax.js", true]], t: 'cart.js is fetched and parsed, which finds its import of tax.js, and so on, until the <b>whole graph</b> is known. Loading is asynchronous, which is why ESM can support top-level await.' },
        { s: 2, tr: { main: 'hit', cart: 'hit', tax: 'hit' }, t: '<b>Link</b>: every module gets its environment, and each import is bound to the exporting module’s variable. <code>total</code> in main.js is a <b>live view</b> of cart’s <code>total</code>, not a copy. A misspelled named import fails here, before any code runs.' },
        { s: 3, tr: { main: 'hit', cart: 'hit', tax: 'exec' }, t: '<b>Evaluate</b>, dependencies first (post-order): tax.js runs first. Its top-level <code>await</code> pauses everything that depends on it: cart.js and main.js wait.' },
        { s: 3, tr: { main: 'hit', cart: 'exec', tax: 'cached' }, t: 'tax.js finished, so cart.js runs: it defines <code>total = 0</code> and <code>add</code>.' },
        { s: 3, tr: { main: 'exec', cart: 'cached', tax: 'cached' }, t: 'Finally main.js runs. <code>add(10)</code> changes cart’s <code>total</code>, and main.js sees the new value through the live binding. Imports are read-only: <code>total = 5</code> in main.js would throw.' },
        { s: 4, tr: { main: 'cached', cart: 'cached', tax: 'cached' }, t: 'Each module is cached by its <b>URL</b> and runs once. <code>import(\'./cart.js?v=2\')</code> is a different URL, so it would load a second instance.' }
      ] },
    mix: { label: 'Interop (Node 22)', tree: MIX_TREE, stages: ['detect format', 'load', 'evaluate', 'result'], code: "// legacy.cjs\nmodule.exports = { parse, version: '1.4' };\n\n// esm-lib.mjs\nexport default function hello() {}\nexport const x = 1;\n\n// app.js (CommonJS)\nconst lib = require('./esm-lib.mjs');        // Node 22.12+\nconst slow = require('./slow-lib.mjs');      // has top-level await\nconst mod = await import('./slow-lib.mjs'); // inside an async function",
      steps: [
        { s: 0, tr: { pkg: 'hit', legacy: 'hit', esmlib: 'hit', slow: 'hit' }, tries: [['.cjs → always CommonJS', true], ['.mjs → always ESM', true], ['.js → nearest package.json "type" (default "commonjs")', true]], t: 'The format comes from the extension, then from the nearest <code>package.json</code>. Node 22.7+ also <b>detects</b> ESM syntax in a <code>.js</code> file that has no <code>"type"</code>, and runs it as ESM.' },
        { s: 1, tr: { app: 'exec', esmlib: 'exec' }, t: '<code>require(\'./esm-lib.mjs\')</code>: since <b>Node 22.12</b> (and 20.19) this works without a flag. The ES module graph is loaded and evaluated <b>synchronously</b>.' },
        { s: 3, tr: { app: 'exec', esmlib: 'cached' }, tries: [["lib → [Module: null prototype] { default: [Function: hello], x: 1 }", true]], t: 'You get the <b>namespace object</b>, so a default export is <code>lib.default</code>, not <code>lib</code>.' },
        { s: 2, tr: { app: 'exec', slow: 'miss' }, tries: [['require(./slow-lib.mjs) → ERR_REQUIRE_ASYNC_MODULE', false]], t: 'slow-lib.mjs uses <b>top-level await</b>. <code>require</code> is synchronous and can’t wait, so it throws <code>ERR_REQUIRE_ASYNC_MODULE</code>.' },
        { s: 3, tr: { app: 'exec', slow: 'cached' }, tries: [["await import('./slow-lib.mjs') → Promise<namespace>", true]], t: 'Dynamic <code>import()</code> works from CommonJS in every supported Node version. It returns a promise, so the caller must be async.' },
        { s: 3, tr: { legacy: 'exec' }, tries: [["import legacy from './legacy.cjs' → module.exports", true], ["import { parse } from './legacy.cjs' → only if detectable statically", null]], t: 'The other direction: an ES module importing CommonJS gets <code>module.exports</code> as the <b>default</b> export. Named imports work only when Node’s static analysis (cjs-module-lexer) can see them, as with <code>exports.parse = …</code>.' }
      ] }
  };
  let mode = 'rel'; let k = 0; let gen = 0; let running = false; let speed = 2600;
  const seg = (opts, cur, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); set(v); }); s.append(b); }); return s; };
  const segM = seg(Object.entries(MODES).map(([id, m]) => [id, m.label]), mode, (v) => { mode = v; reset(); }, 'Scenario');
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const pipe = svg('svg', { viewBox: '0 0 640 70', role: 'img', 'aria-label': 'Loading pipeline stages' });
  const tree = el('div', { class: 'w-mod-tree' }); const tries = el('div', { class: 'w-mod-tries' });
  const codeHost = el('div', { class: 'codebox' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-mod');
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, pipe),
    el('div', { class: 'w-mod-grid' }, el('div', null, tree, tries), codeHost),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  let stRects = [];
  function drawPipe(stages) {
    pipe.innerHTML = ''; stRects = [];
    const n = stages.length; const gap = 18; const w = (640 - 8 - gap * (n - 1)) / n;
    stages.forEach((name, i) => {
      const x = 4 + i * (w + gap);
      const r = svg('rect', { class: 'st', x, y: 10, width: w, height: 48, rx: 10 }); stRects.push(r);
      pipe.append(r, svg('text', { class: 'stl', x: x + w / 2, y: 40, 'text-anchor': 'middle', text: name }));
      if (i < n - 1) pipe.append(svg('path', { class: 'arr', d: `M${x + w + 3} 34 h${gap - 8} m-5 -5 l5 5 l-5 5` }));
    });
  }
  function render(s) {
    const m = MODES[mode];
    stRects.forEach((r, i) => r.setAttribute('class', 'st' + (s && i === s.s ? ' on' : s && i < s.s ? ' done' : '')));
    tree.innerHTML = '';
    m.tree.forEach((f) => tree.append(el('div', { class: (s && s.tr && s.tr[f.id]) || '', style: { paddingLeft: (6 + f.d * 16) + 'px' }, text: f.name })));
    tries.innerHTML = '';
    ((s && s.tries) || []).forEach(([txt, ok]) => tries.append(el('div', { class: ok === true ? 'ok' : ok === false ? 'no' : '', text: (ok === true ? '✓ ' : ok === false ? '✗ ' : '· ') + txt })));
    codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight((s && s.snip) || m.code, 'js') }));
    narr.firstChild.innerHTML = s ? s.t : 'Pick a scenario and press Play or Step. The top row is the loading pipeline; the file tree shows what Node looks at.';
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `stage <b>${s ? m.stages[s.s] : '—'}</b>` }), el('span', { class: 'w-stat', html: `step <b>${k}/${m.steps.length}</b>` }));
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; drawPipe(MODES[mode].stages); render(null); bStep.disabled = false; }
  function step() { const st = MODES[mode].steps; if (k >= st.length) return false; k++; render(st[k - 1]); if (k >= st.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= MODES[mode].steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 800 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
