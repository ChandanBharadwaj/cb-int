/* Modules & tsconfig: follow an import through format detection, resolution, exports maps and type lookup. */
IA.widget('ts-modules-config', (root, ctx) => {
  const P = (id, x, y, w, h, t, s, k, cap, hot) => ({ id, x, y, w, h, t, s, k, cap, hot });
  const SCENES = [
    { label: 'Relative import (nodenext)', tag: 'module: nodenext · Node 22', code: `// package.json: { "type": "module" }\n// src/server.ts\nimport { routes } from './routes';      // ✗ TS2835: needs an explicit extension\nimport { routes } from './routes.js';   // ✓ checker maps to routes.ts`,
      steps: [
        { hl: [1, 2], say: 'First question: is <code>server.ts</code> ESM or CJS? The nearest package.json says <code>"type": "module"</code>, so it is <b>ESM</b>. (<code>.mts</code> is always ESM, <code>.cts</code> always CJS.)', nodes: [P('f', 20, 90, 200, 56, 'src/server.ts', 'importing file', 'acc'), P('pj', 290, 90, 220, 56, 'package.json', '"type": "module"', 'mut'), P('fmt', 580, 90, 160, 56, 'ESM', 'format', 'ok', null, true)], edges: [['f', 'pj', 'nearest'], ['pj', 'fmt', '']] },
        { hl: [3], say: 'Node’s ESM loader does <b>not</b> try extensions or index files. With <code>nodenext</code>, the checker enforces the same rule.', nodes: [P('s', 20, 90, 220, 56, "'./routes'", 'specifier', 'acc'), P('n', 320, 90, 200, 56, 'Node ESM', 'no extension guessing', 'mut'), P('e', 590, 90, 150, 56, '✗ not found', 'TS2835', 'err', null, true)], edges: [['s', 'n', ''], ['n', 'e', '', 'err']] },
        { hl: [4], say: 'Write the <b>output</b> file name. The checker substitutes <code>.ts</code> for <code>.js</code> to find the source, and Node later finds <code>dist/routes.js</code>. Both agree.', nodes: [P('s', 20, 40, 220, 56, "'./routes.js'", 'specifier', 'acc'), P('c', 320, 40, 200, 56, 'src/routes.ts', 'what tsc checks', 'ok'), P('r', 320, 160, 200, 56, 'dist/routes.js', 'what Node loads', 'ok', null, true)], edges: [['s', 'c', 'checker'], ['s', 'r', 'runtime']] }
      ] },
    { label: 'Package + exports', tag: 'node_modules lookup', code: `import { z } from 'zod';\n// node_modules/zod/package.json\n// "exports": { ".": { "types": "./index.d.ts",\n//                     "import": "./index.mjs", "require": "./index.cjs" } }`,
      steps: [
        { hl: [1], say: 'A bare specifier: walk up to <code>node_modules/zod</code> and read its package.json.', nodes: [P('s', 20, 90, 180, 56, "'zod'", 'bare specifier', 'acc'), P('pj', 280, 90, 240, 56, 'node_modules/zod', 'package.json', 'mut')], edges: [['s', 'pj', 'walk up']] },
        { hl: [3, 4], say: 'If there is an <code>exports</code> map, it is the <b>only</b> public surface. Conditions are matched in object order, so <code>types</code> goes first.', nodes: [P('pj', 20, 90, 200, 56, 'exports["."]', '', 'mut'), P('t', 300, 20, 200, 46, 'types', 'checker picks', 'ok'), P('i', 300, 100, 200, 46, 'import', 'Node ESM picks', 'acc'), P('r', 300, 180, 200, 46, 'require', 'Node CJS picks', 'alt')], edges: [['pj', 't', ''], ['pj', 'i', ''], ['pj', 'r', '']] },
        { hl: [1], say: 'The checker loads <code>index.d.ts</code> for types; Node loads <code>index.mjs</code> for code. Legacy <code>moduleResolution: node</code> would ignore <code>exports</code> entirely and may read a different file.', nodes: [P('t', 20, 40, 220, 50, 'index.d.ts', 'types', 'ok'), P('i', 20, 160, 220, 50, 'index.mjs', 'runtime code', 'acc'), P('l', 360, 100, 360, 56, 'node10: ignores exports', 'may see different files', 'err', 'legacy')] }
      ] },
    { label: 'Where types come from', tag: 'type lookup', code: `import express from 'express';   // JS package, no bundled types\n// 1) package exports "types"?   no\n// 2) package.json "types"?      no\n// 3) node_modules/@types/express → index.d.ts   ✓`,
      steps: [
        { hl: [1, 2, 3], say: 'The checker first looks in the package itself: a <code>types</code> condition, a top-level <code>types</code> field, or a <code>.d.ts</code> next to the JS file.', nodes: [P('s', 20, 90, 180, 56, "'express'", '', 'acc'), P('a', 280, 30, 260, 50, 'exports → types', 'not found', 'mut'), P('b', 280, 150, 260, 50, '"types" field', 'not found', 'mut')], edges: [['s', 'a', '', 'err'], ['s', 'b', '', 'err']] },
        { hl: [4], say: 'Then DefinitelyTyped: <code>@types/express</code>. Scoped packages map as <code>@types/scope__name</code>.', nodes: [P('s', 20, 90, 180, 56, "'express'", '', 'acc'), P('d', 300, 90, 280, 56, '@types/express', 'index.d.ts', 'ok', null, true)], edges: [['s', 'd', 'fallback', 'ok']] },
        { hl: [1], say: 'Nothing found? You get an implicit <code>any</code>, which is an error under <code>noImplicitAny</code>. The quick fix is <code>declare module \'x\';</code> in a <code>.d.ts</code>; the better fix is a real declaration.', nodes: [P('s', 20, 90, 180, 56, "'legacy-lib'", '', 'acc'), P('x', 300, 30, 280, 50, 'implicit any', 'TS7016 under strict', 'err'), P('d', 300, 150, 280, 50, "declare module 'legacy-lib'", 'your .d.ts', 'ok')], edges: [['s', 'x', '', 'err'], ['s', 'd', 'fix', 'ok']] }
      ] },
    { label: 'paths trap', tag: 'checker vs runtime', code: `// tsconfig: "paths": { "@/*": ["./src/*"] }\nimport { db } from '@/db.js';\n// dist/app.js after tsc: import { db } from '@/db.js';   (unchanged!)\n// package.json "imports": { "#db": "./dist/db.js" } → import { db } from '#db';`,
      steps: [
        { hl: [1, 2], say: 'While checking, <code>paths</code> maps <code>@/db.js</code> to <code>src/db.ts</code>. The editor is happy.', nodes: [P('s', 20, 90, 200, 56, "'@/db.js'", '', 'acc'), P('c', 320, 90, 220, 56, 'src/db.ts', 'checker (paths)', 'ok')], edges: [['s', 'c', 'paths', 'ok']] },
        { hl: [3], say: '<code>tsc</code> never rewrites specifiers. Node sees <code>@/db.js</code>, treats it as a package named <code>@/db.js</code>, and fails.', nodes: [P('s', 20, 90, 200, 56, "'@/db.js'", 'in dist/app.js', 'acc'), P('n', 320, 90, 260, 56, 'ERR_MODULE_NOT_FOUND', 'Node', 'err', null, true)], edges: [['s', 'n', 'runtime', 'err']] },
        { hl: [4], say: 'Package <code>imports</code> (specifiers start with <code>#</code>) are understood by <b>both</b> Node and the checker under <code>nodenext</code>/<code>bundler</code>.', nodes: [P('s', 20, 90, 180, 56, "'#db'", '', 'acc'), P('c', 300, 30, 220, 50, 'src/db.ts', 'checker', 'ok'), P('r', 300, 150, 220, 50, 'dist/db.js', 'Node', 'ok')], edges: [['s', 'c', ''], ['s', 'r', '']] }
      ] }
  ];
  /* ---- shared step-through engine: code on top (current lines highlighted), a type-flow diagram below ---- */
  const { el, svg, reduced, sleep } = ctx;
  if (!document.getElementById('w-tsx-style')) {
    document.head.append(el('style', { id: 'w-tsx-style', text: `
.w-tsx-code { font-family: var(--mono); font-size: 12.5px; line-height: 1.55; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 0; margin: 0 0 10px; overflow-x: auto; white-space: pre; }
.w-tsx-code div { padding: 0 12px; border-left: 3px solid transparent; color: var(--text-2); transition: background .25s; }
.w-tsx-code div.on { background: var(--accent-soft); border-left-color: var(--accent); color: var(--text); }
.w-tsx-node rect { transition: opacity .35s; }
.w-tsx-svg text { font-family: var(--mono); }
` }));
  }
  const TONE = { acc: 'var(--accent)', ok: 'var(--ok)', err: 'var(--err)', warn: 'var(--warn)', mut: 'var(--text-3)', alt: 'var(--accent-2)' };
  let scene = 0; let step = 0; let gen = 0; let speed = 2600;
  const uid = 'tsx' + Math.random().toString(36).slice(2, 8);
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segScene = seg(SCENES.map((s, i) => [i, s.label]), () => scene, (v) => { scene = v; reset(); }, 'Scenario');
  const segSpeed = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const code = el('div', { class: 'w-tsx-code', role: 'region', 'aria-label': 'Code' });
  const H = 250;
  const stage = svg('svg', { viewBox: `0 0 760 ${H}`, class: 'w-tsx-svg', role: 'img', 'aria-label': 'Diagram of how the type checker sees this code', style: 'width:100%;height:auto;display:block' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const counter = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segScene), code, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segSpeed), counter, narr);
  function drawCode() {
    const S = SCENES[scene]; const st = S.steps[step - 1]; const hl = st ? st.hl || [] : [];
    code.innerHTML = '';
    S.code.split('\n').forEach((ln, i) => code.append(el('div', { class: hl.includes(i + 1) ? 'on' : '', text: ln || ' ' })));
  }
  function wrapText(t, max) { const out = []; let cur = '';
    String(t).split(' ').forEach((w) => { if ((cur + ' ' + w).trim().length > max) { if (cur) out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) out.push(cur); return out; }
  function drawStage() {
    stage.innerHTML = '';
    const defs = svg('defs', null, svg('marker', { id: uid + 'a', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--text-3)' })));
    stage.append(defs);
    const S = SCENES[scene]; const st = S.steps[Math.max(0, step - 1)];
    if (!step) { stage.append(svg('text', { x: 380, y: H / 2, 'text-anchor': 'middle', fill: 'var(--text-3)', 'font-size': 15, text: 'Press Play or Step to start.' })); return; }
    const nodes = {}; (st.nodes || []).forEach((n) => { nodes[n.id] = n; });
    (st.edges || []).forEach(([a, b, lab, tone]) => {
      const A = nodes[a]; const B = nodes[b]; if (!A || !B) return;
      const ax = A.x + A.w / 2; const ay = A.y + A.h / 2; const bx = B.x + B.w / 2; const by = B.y + B.h / 2;
      const dx = bx - ax; const dy = by - ay;
      const cut = (N, sx, sy) => { const tx = Math.abs(sx) > 0 ? (N.w / 2) / Math.abs(sx) : 1e9; const ty = Math.abs(sy) > 0 ? (N.h / 2) / Math.abs(sy) : 1e9; return Math.min(tx, ty); };
      const t1 = cut(A, dx, dy); const t2 = cut(B, dx, dy);
      const x1 = ax + dx * t1; const y1 = ay + dy * t1; const x2 = bx - dx * (t2 + 0.02); const y2 = by - dy * (t2 + 0.02);
      stage.append(svg('line', { x1, y1, x2, y2, stroke: TONE[tone] || 'var(--text-3)', 'stroke-width': 1.6, 'marker-end': `url(#${uid}a)`, 'stroke-dasharray': tone === 'err' ? '5 4' : null }));
      if (lab) stage.append(svg('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 6, 'text-anchor': 'middle', 'font-size': 11.5, fill: TONE[tone] || 'var(--text-2)', text: lab }));
    });
    (st.nodes || []).forEach((n) => {
      const c = TONE[n.k] || TONE.acc; const g = svg('g', { class: 'w-tsx-node' });
      g.append(svg('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 9, fill: 'var(--surface)', stroke: c, 'stroke-width': n.hot ? 2.6 : 1.4 }));
      if (n.cap) g.append(svg('text', { x: n.x + 8, y: n.y - 5, 'font-size': 11, fill: 'var(--text-3)', text: n.cap }));
      const lines = String(n.t).split('\n'); const sub = n.s ? wrapText(n.s, Math.max(10, Math.floor(n.w / 6.6))) : [];
      const total = lines.length + sub.length; let y = n.y + n.h / 2 - (total - 1) * 8 + 4;
      lines.forEach((ln) => { g.append(svg('text', { x: n.x + n.w / 2, y, 'text-anchor': 'middle', 'font-size': 13, fill: c, 'font-weight': 600, text: ln })); y += 16; });
      sub.forEach((ln) => { g.append(svg('text', { x: n.x + n.w / 2, y, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-2)', text: ln })); y += 16; });
      if (!reduced) { g.style.opacity = 0; g.style.transition = 'opacity .35s'; requestAnimationFrame(() => { g.style.opacity = 1; }); }
      stage.append(g);
    });
  }
  function paint() {
    const S = SCENES[scene]; drawCode(); drawStage();
    counter.innerHTML = ''; counter.append(el('span', { class: 'w-stat', html: `step <b>${step}</b>/${S.steps.length}` }), el('span', { class: 'w-stat', html: S.tag || 'type-level only: nothing here runs' }));
    narr.innerHTML = ''; narr.append(el('div', { class: 't', html: step ? S.steps[step - 1].say : S.intro || 'Press Play to walk through it, or Step for one move at a time.' }));
    bStep.disabled = step >= S.steps.length;
  }
  function doStep() { const S = SCENES[scene]; if (step < S.steps.length) { step++; paint(); } }
  function reset() { gen++; step = 0; bPlay.textContent = '▶ Play'; paint(); }
  async function play() {
    const g = ++gen; const S = SCENES[scene]; if (step >= S.steps.length) step = 0;
    if (reduced) { step = S.steps.length; paint(); return; }
    bPlay.textContent = '⏸ Playing';
    while (g === gen && step < S.steps.length) { doStep(); await sleep(speed); }
    if (g === gen) bPlay.textContent = '▶ Replay';
  }
  bPlay.addEventListener('click', play); bStep.addEventListener('click', () => { gen++; bPlay.textContent = '▶ Play'; doStep(); }); bReset.addEventListener('click', reset);
  if (reduced) { step = SCENES[0].steps.length; paint(); } else reset();
});
