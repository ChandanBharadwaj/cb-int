/* Classes & modules: the prototype chain behind class/extends, ESM import/export, and the CommonJS require cache. */
IA.widget('js-classes-modules', (root, ctx) => {
  /* ---- shared step-through player (code on the left, state picture on the right) ---- */
  const { el, svg, sleep, reduced } = ctx;
  function stepper(cfg) {
    const uid = 'nb' + Math.random().toString(36).slice(2, 8);
    if (!document.getElementById('w-nb-style')) {
      document.head.append(el('style', { id: 'w-nb-style', text: `
.w-nb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; align-items: start; }
.w-nb-code pre { margin: 0; }
.w-nb-code .ln { display: block; padding: 0 6px; border-left: 3px solid transparent; border-radius: 3px; white-space: pre; }
.w-nb-code .ln.cur { background: var(--accent-soft); border-left-color: var(--accent); }
.w-nb-code .ln.done { opacity: .55; }
.w-nb .bx { fill: var(--surface); stroke: var(--border); }
.w-nb .bx.hot { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; }
.w-nb .bx.ok { stroke: var(--ok); stroke-width: 2; }
.w-nb .bx.err { stroke: var(--err); stroke-width: 2; fill: color-mix(in srgb, var(--err) 10%, var(--surface)); }
.w-nb .bx.warn { stroke: var(--warn); stroke-width: 2; }
.w-nb .bx.dim { opacity: .45; }
.w-nb .bx.lane { fill: var(--surface-2); }
.w-nb .tt { fill: var(--text); font-size: 13px; font-family: var(--mono); }
.w-nb .tt.h { font-family: var(--sans); font-weight: 700; font-size: 13px; }
.w-nb .tt.m { fill: var(--text-3); font-size: 11px; font-family: var(--sans); }
.w-nb .tt.ok { fill: var(--ok); } .w-nb .tt.err { fill: var(--err); } .w-nb .tt.acc { fill: var(--accent); } .w-nb .tt.warn { fill: var(--warn); }
.w-nb .ar { stroke: var(--text-3); stroke-width: 1.6; fill: none; }
.w-nb .ar.hot { stroke: var(--accent); stroke-width: 2.2; }
.w-nb .fresh { animation: nbIn .45s ease both; }
@keyframes nbIn { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .w-nb .fresh { animation: none; } }
` }));
    }
    root.classList.add('w-nb');
    const modes = cfg.modes;
    let mi = 0; let k = 0; let gen = 0; let running = false; let speed = 2600;
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': cfg.modeLabel || 'Example' });
    modes.forEach((m, i) => { const b = el('button', { text: m.label, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { mi = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); seg.append(b); });
    const pre = el('pre'); const codeHost = el('div', { class: 'codebox w-nb-code' }, el('div', { class: 'ch' }, el('span', { class: 'fname' })), pre);
    const W = cfg.W || 420, H = cfg.H || 300;
    const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.aria || 'Step-by-step picture of the program state' });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: 'Press Play, or Step to go one line at a time.' }));
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const segS = el('div', { class: 'seg', 'aria-label': 'Speed' });
    [['Slow', 3800], ['Normal', 2600], ['Fast', 1300]].forEach(([l, v]) => { const b = el('button', { text: l, class: v === speed ? 'on' : '' }); b.addEventListener('click', () => { speed = v; [...segS.children].forEach((x) => x.classList.toggle('on', x === b)); }); segS.append(b); });
    root.append(modes.length > 1 ? el('div', { class: 'w-controls' }, seg) : '',
      el('div', { class: 'w-nb-grid' }, codeHost, el('div', { class: 'w-stage' }, stage)),
      el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
    // drawing helpers handed to cfg.draw
    const defs = svg('defs', null, svg('marker', { id: uid + 'a', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--text-3)' })),
      svg('marker', { id: uid + 'h', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--accent)' })));
    const D = {
      box: (x, y, w, h, cls, fresh) => svg('rect', { x, y, width: w, height: h, rx: 7, class: 'bx ' + (cls || '') + (fresh ? ' fresh' : '') }),
      t: (x, y, s, cls, anchor, fresh) => svg('text', { x, y, class: 'tt ' + (cls || '') + (fresh ? ' fresh' : ''), 'text-anchor': anchor || 'start', text: String(s) }),
      ar: (x1, y1, x2, y2, hot, curve) => svg('path', { d: curve ? `M${x1},${y1} C${x1 + curve},${y1} ${x2 + curve},${y2} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`, class: 'ar' + (hot ? ' hot' : ''), 'marker-end': `url(#${uid}${hot ? 'h' : 'a'})` }),
      W, H
    };
    let lineEls = [];
    function renderCode() {
      const m = modes[mi]; pre.innerHTML = '';
      codeHost.querySelector('.fname').textContent = m.file || 'example.js';
      lineEls = m.code.split('\n').map((ln) => { const s = el('span', { class: 'ln' }); s.innerHTML = IA.highlight(ln || ' ', m.lang || 'js'); pre.append(s); return s; });
    }
    function show(i) {
      const m = modes[mi]; const st = m.steps[i];
      lineEls.forEach((l, j) => { const cur = st && [].concat(st.line == null ? [] : st.line).includes(j + 1); l.classList.toggle('cur', cur); });
      stage.innerHTML = ''; stage.append(defs);
      const g = svg('g'); stage.append(g);
      cfg.draw(g, st || null, D, i, m);
      narr.className = 'caption' + (st && st.tone ? ' ' + st.tone : '');
      narr.firstChild.textContent = st ? `${i + 1}/${m.steps.length}` : '0';
      narr.lastChild.innerHTML = st ? st.cap : (m.intro || 'Press Play, or Step to go one line at a time.');
    }
    function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; renderCode(); if (reduced) { k = modes[mi].steps.length; show(k - 1); } else show(-1); }
    function step() { const n = modes[mi].steps.length; if (k >= n) return false; show(k); k++; return k < n; }
    async function play() {
      if (running) { gen++; running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= modes[mi].steps.length) reset();
      if (reduced) { k = modes[mi].steps.length; show(k - 1); return; }
      const g = ++gen; running = true; bPlay.textContent = '❚❚ Pause';
      while (g === gen && step()) { await sleep(speed); }
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    }
    bPlay.addEventListener('click', play);
    bStep.addEventListener('click', () => { gen++; running = false; bPlay.textContent = '▶ Play'; if (k >= modes[mi].steps.length) reset(); step(); });
    bReset.addEventListener('click', reset);
    reset();
  }
  // boxes: { id: [x, y, w, label, sub] }; each step: hot {id: cls}, show [ids], arrows [[from, to, hot]]
  const PA = { rex: [20, 20, 170, "rex", "{ name: 'Rex' }"], dog: [230, 20, 175, 'Dog.prototype', 'speak() bark'], ani: [230, 120, 175, 'Animal.prototype', 'speak() describe()'], obj: [230, 220, 175, 'Object.prototype', 'toString() …'], cls: [20, 120, 170, 'class Dog', 'extends Animal'] };
  const sA = [
    { line: [1, 2, 3, 4, 5], cap: '<code>class Animal</code> creates a constructor function plus <code>Animal.prototype</code>, the object that holds its methods.', show: ['ani', 'obj'], hot: { ani: 'hot' }, arrows: [['ani', 'obj']] },
    { line: [6, 7, 8, 9, 10, 11], cap: '<code>extends</code> links <code>Dog.prototype</code> to <code>Animal.prototype</code>. <code>super(name)</code> must be called before using <code>this</code>, as in Java.', show: ['dog', 'ani', 'obj', 'cls'], hot: { dog: 'hot', cls: 'hot' }, arrows: [['dog', 'ani', true], ['ani', 'obj'], ['cls', 'dog']] },
    { line: 12, cap: '<code>new Dog(\'Rex\')</code> makes a plain object with its own field <code>name</code>, whose hidden <b>prototype</b> link points at <code>Dog.prototype</code>.', show: ['rex', 'dog', 'ani', 'obj', 'cls'], hot: { rex: 'hot' }, arrows: [['rex', 'dog', true], ['dog', 'ani'], ['ani', 'obj'], ['cls', 'dog']] },
    { line: 13, cap: '<code>rex.speak()</code>: not on rex itself, so JavaScript walks the chain and finds <code>speak</code> on <code>Dog.prototype</code>. That override wins, like Java dynamic dispatch.', tone: 'ok', show: ['rex', 'dog', 'ani', 'obj', 'cls'], hot: { rex: 'warn', dog: 'ok' }, arrows: [['rex', 'dog', true], ['dog', 'ani'], ['ani', 'obj'], ['cls', 'dog']] },
    { line: 14, cap: '<code>rex.describe()</code>: not on rex, not on Dog.prototype, found one level up on <code>Animal.prototype</code>: an inherited method.', tone: 'ok', show: ['rex', 'dog', 'ani', 'obj', 'cls'], hot: { rex: 'warn', dog: 'warn', ani: 'ok' }, arrows: [['rex', 'dog', true], ['dog', 'ani', true], ['ani', 'obj'], ['cls', 'dog']] },
    { line: 15, cap: '<code>instanceof</code> just checks whether <code>Animal.prototype</code> appears anywhere on rex’s chain. Classes are syntax over this <b>prototype chain</b>.', tone: 'ok', show: ['rex', 'dog', 'ani', 'obj', 'cls'], hot: { ani: 'ok' }, arrows: [['rex', 'dog', true], ['dog', 'ani', true], ['ani', 'obj'], ['cls', 'dog']] }
  ];
  const PB = { m: [20, 30, 180, 'math.js', 'export const PI / add'], d: [20, 160, 180, 'logger.js', 'export default class'], a: [230, 95, 180, 'app.js', "import … from './…'"], n: [230, 220, 180, 'node:fs', 'built-in module'] };
  const sB = [
    { line: [1, 2, 3], cap: 'In <b>ESM</b> (ECMAScript modules) each file is a module. Nothing is visible outside unless it is <code>export</code>ed: like a Java class where everything is package-private by default.', show: ['m'], hot: { m: 'hot' }, arrows: [] },
    { line: 5, cap: 'A <b>default export</b>: one main thing per file. The importer chooses its local name.', show: ['m', 'd'], hot: { d: 'hot' }, arrows: [] },
    { line: 7, cap: '<b>Named imports</b> must match exported names (rename with <code>as</code>). The path is relative and in Node ESM includes the extension: <code>./math.js</code>.', show: ['m', 'd', 'a'], hot: { a: 'hot', m: 'ok' }, arrows: [['m', 'a', true]] },
    { line: 8, cap: 'A default import has no braces.', show: ['m', 'd', 'a'], hot: { a: 'hot', d: 'ok' }, arrows: [['m', 'a'], ['d', 'a', true]] },
    { line: 9, cap: 'Built-ins are imported with the <code>node:</code> prefix. Imports are resolved and linked <b>before</b> app.js runs, so you can’t put a static import inside an <code>if</code> (use <code>await import()</code> for that).', tone: 'ok', show: ['m', 'd', 'a', 'n'], hot: { n: 'ok' }, arrows: [['m', 'a'], ['d', 'a'], ['n', 'a', true]] },
    { line: [11, 12], cap: 'A file is ESM if it ends in <code>.mjs</code>, or is <code>.js</code> in a package with <code>"type": "module"</code>. Otherwise Node treats it as CommonJS.', show: ['m', 'd', 'a', 'n'], hot: {}, arrows: [['m', 'a'], ['d', 'a'], ['n', 'a']] }
  ];
  const PC = { c: [20, 30, 180, 'config.js', 'module.exports = {…}'], cache: [230, 30, 180, 'require.cache', '(empty)'], a: [20, 170, 180, 'app.js', "require('./config')"], b: [230, 170, 180, 'db.js', "require('./config')"] };
  const sC = [
    { line: [1, 2], cap: '<b>CommonJS</b> is Node’s original module system. A file assigns what it exposes to <code>module.exports</code>.', show: ['c', 'cache'], hot: { c: 'hot' }, arrows: [] },
    { line: 4, cap: '<code>require</code> is a normal function call that runs synchronously: it reads config.js, executes it once and returns <code>module.exports</code>.', show: ['c', 'cache', 'a'], hot: { a: 'hot', c: 'ok' }, arrows: [['c', 'a', true]] },
    { line: 4, cap: 'The result is cached by resolved file path. Every module is effectively a <b>singleton</b>.', show: ['c', 'cache', 'a'], hot: { cache: 'ok' }, arrows: [['c', 'a'], ['c', 'cache', true]], cacheSub: "'/app/config.js' ✓" },
    { line: 6, cap: 'A second <code>require</code> of the same file (from db.js) returns the <b>same object</b> from the cache, without running config.js again. Mutations are visible everywhere.', tone: 'warn', show: ['c', 'cache', 'a', 'b'], hot: { b: 'hot', cache: 'warn' }, arrows: [['c', 'a'], ['cache', 'b', true]], cacheSub: "'/app/config.js' ✓" },
    { line: [8, 9], cap: 'Because <code>require</code> is just a function, it can appear anywhere, including inside <code>if</code>. In Node 22, <code>require()</code> of a synchronous ES module also works (behind a flag until 22.12, on by default from 22.12).', tone: 'ok', show: ['c', 'cache', 'a', 'b'], hot: {}, arrows: [['c', 'a'], ['cache', 'b']], cacheSub: "'/app/config.js' ✓" }
  ];
  stepper({
    W: 420, H: 290, aria: 'Boxes for objects or files, with arrows for prototype links or imports',
    modes: [
      { label: 'class & extends', code: "class Animal {\n  constructor(name) { this.name = name; }\n  speak() { return '…'; }\n  describe() { return `${this.name} says ${this.speak()}`; }\n}\nclass Dog extends Animal {\n  constructor(name) {\n    super(name);\n  }\n  speak() { return 'woof'; }\n}\nconst rex = new Dog('Rex');\nrex.speak();          // 'woof'\nrex.describe();       // 'Rex says woof'\nrex instanceof Animal // true", steps: sA, P: PA },
      { label: 'ESM import/export', file: 'math.js / logger.js / app.js', code: "// math.js\nexport const PI = 3.14159;\nexport function add(a, b) { return a + b; }\n// logger.js\nexport default class Logger { }\n// app.js\nimport { add, PI as pi } from './math.js';\nimport Logger from './logger.js';\nimport { readFile } from 'node:fs/promises';\n\n// package.json\n{ \"type\": \"module\" }", steps: sB, P: PB },
      { label: 'CommonJS require', file: 'config.js / app.js / db.js', code: "// config.js\nmodule.exports = { port: 3000 };\n// app.js\nconst config = require('./config');\n// db.js\nconst same = require('./config');  // cached\n// anywhere, even conditionally\nif (process.env.DEBUG) require('./debug');", steps: sC, P: PC }
    ],
    draw(g, st, D, i, m) {
      if (!st) { g.append(D.t(210, 145, 'press Play', 'm', 'middle')); return; }
      const P = m.P; const c = (id) => { const [x, y, w] = P[id]; return [x + w / 2, y + 26, x, y, w]; };
      st.arrows.forEach(([a, b, hot]) => {
        const [ax, ay, axl, ayt, aw] = c(a); const [bx, by, bxl, byt, bw] = c(b);
        let x1, y1, x2, y2;
        if (Math.abs(ayt - byt) < 10) { x1 = ax < bx ? axl + aw : axl; x2 = ax < bx ? bxl : bxl + bw; y1 = y2 = ay; }
        else if (Math.abs(axl - bxl) < 10) { x1 = x2 = ax; y1 = ay < by ? ayt + 52 : ayt; y2 = ay < by ? byt : byt + 52; }
        else { x1 = ax < bx ? axl + aw : axl; x2 = ax < bx ? bxl : bxl + bw; y1 = ay; y2 = by; }
        g.append(D.ar(x1, y1, x2, y2, hot));
      });
      st.show.forEach((id) => {
        const [x, y, w, label, sub] = P[id]; const cls = st.hot[id] || '';
        g.append(D.box(x, y, w, 52, cls, cls === 'hot'), D.t(x + 10, y + 21, label, 'h'), D.t(x + 10, y + 40, id === 'cache' && st.cacheSub ? st.cacheSub : sub, 'm'));
      });
    }
  });
});
