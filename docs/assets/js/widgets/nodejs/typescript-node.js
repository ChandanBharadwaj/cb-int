/* TypeScript on Node: watch Node's type stripping replace type-only syntax with spaces (positions preserved),
   reject syntax that needs code generation, and keep a type-only import that then fails at runtime. */
IA.widget('typescript-node', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-ts-style')) {
    document.head.append(el('style', { id: 'w-ts-style', text: `
.w-ts-code { font-family: var(--mono); font-size: 13px; line-height: 1.7; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 10px 0; overflow-x: auto; }
.w-ts-line { white-space: pre; padding: 0 12px 0 0; display: flex; }
.w-ts-ln { flex: none; width: 34px; text-align: right; padding-right: 10px; color: var(--text-3); user-select: none; }
.w-ts-code .ty { border-radius: 4px; transition: background .4s, color .4s; }
.w-ts-code.hl .ty { background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent); }
.w-ts-code.er .ty { background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--accent) 14%, transparent) 0 6px, transparent 6px 8px); color: transparent; }
.w-ts-code .bad { border-radius: 4px; }
.w-ts-code.hl .bad, .w-ts-code.er .bad { background: color-mix(in srgb, var(--err) 22%, transparent); color: var(--err); font-weight: 700; }
.w-ts-code .keep { border-radius: 4px; }
.w-ts-code.hl .keep, .w-ts-code.er .keep { background: color-mix(in srgb, var(--warn) 22%, transparent); }
.w-ts-out { margin-top: 8px; border-radius: 10px; padding: 8px 12px; font-family: var(--mono); font-size: 12.5px; border: 1px solid var(--border); background: var(--surface); white-space: pre-wrap; overflow-wrap: anywhere; animation: capin .35s ease both; }
.w-ts-out.ok { border-color: var(--ok); } .w-ts-out.bad { border-color: var(--err); color: var(--err); }
.w-ts-lab { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: .04em; margin: 10px 0 4px; }
` }));
  }
  // «…» erasable type syntax, ‹…› needs code generation, ⟦…⟧ kept as-is but is type-only (import pitfall)
  const SN = {
    erasable: { label: 'erasable code', src: [
      "«import type { User } from './types.ts';»",
      '«interface Opts { retries?: number }»',
      'export function greet(u«: User», opts«: Opts» = {})«: string» {',
      '  const n = opts.retries ?? 3;',
      '  return `hi ${u.name} (x${n})`;',
      '}',
      'const id = readId()« as string»;'
    ], out: 'hi Ada (x3)' },
    codegen: { label: 'enum + parameter property', src: [
      '‹enum Status { Active, Banned }›',
      'class Repo {',
      '  constructor(‹private readonly› db«: Db») {}',
      '  ban(id«: string») { return this.db.set(id, Status.Banned); }',
      '}'
    ], gen: [
      'var Status; (function (Status) {',
      '  Status[Status["Active"] = 0] = "Active";',
      '  Status[Status["Banned"] = 1] = "Banned";',
      '})(Status || (Status = {}));',
      'class Repo {',
      '  db;',
      '  constructor(db) { this.db = db; }',
      '  ban(id) { return this.db.set(id, Status.Banned); }',
      '}'
    ] },
    imp: { label: 'type import without “type”', src: [
      "⟦import { User, loadUser } from './users.ts';⟧   // User is an interface",
      '',
      'const u«: User» = await loadUser(42);',
      'console.log(u.name);'
    ] }
  };
  let sn = 'erasable'; let mode = 'strip'; let gen = 0; let running = false; let speed = 2600; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const e = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...e.children].forEach((x) => x.classList.toggle('on', x === b)); }); e.append(b); }); return e; };
  const segN = seg(Object.entries(SN).map(([key, v]) => [key, v.label]), () => sn, (v) => { sn = v; reset(); }, 'Snippet');
  const segM = seg([['strip', 'strip only (default)'], ['transform', '--experimental-transform-types']], () => mode, (v) => { mode = v; reset(); }, 'Mode');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const lab = el('div', { class: 'w-ts-lab' }); const codeEl = el('div', { class: 'w-ts-code' }); const outHost = el('div');
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segN), el('div', { class: 'w-controls' }, segM), lab, codeEl, outHost,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function parse(line) {
    const out = []; const re = /«([^»]*)»|‹([^›]*)›|⟦([^⟧]*)⟧/g; let last = 0; let mm;
    while ((mm = re.exec(line))) { if (mm.index > last) out.push(['', line.slice(last, mm.index)]);
      out.push(mm[1] != null ? ['ty', mm[1]] : mm[2] != null ? ['bad', mm[2]] : ['keep', mm[3]]); last = re.lastIndex; }
    if (last < line.length) out.push(['', line.slice(last)]);
    return out;
  }
  function renderLines(lines, raw) {
    codeEl.innerHTML = '';
    lines.forEach((ln, i) => {
      const row = el('div', { class: 'w-ts-line' }, el('span', { class: 'w-ts-ln', text: String(i + 1) }));
      if (raw) row.append(el('span', { text: ln || ' ' }));
      else parse(ln).forEach(([c, t]) => row.append(c ? el('span', { class: c, text: t }) : document.createTextNode(t)));
      if (!ln) row.append(' ');
      codeEl.append(row);
    });
  }
  const typeCount = (src) => src.reduce((n, l) => n + parse(l).filter(([c]) => c === 'ty').length, 0);
  function plan() {
    const S = SN[sn]; const st = [];
    st.push({ lab: 'source: app.ts', cls: '', x: 'The file as you wrote it. Node loads it like a <code>.js</code> file, except that it first hands the text to Amaro (SWC compiled to WebAssembly).' });
    if (sn === 'erasable') {
      st.push({ lab: 'source: app.ts', cls: 'hl', x: `The parser finds <b>${typeCount(S.src)}</b> pieces of type-only syntax: the type import, the interface, annotations, a return type and an <code>as</code> assertion. None of them produce JavaScript.` });
      st.push({ lab: 'what V8 receives', cls: 'er', x: 'Each piece is replaced by <b>the same number of spaces</b> (shown hatched). Nothing moves: line 5 is still line 5, column 10 is still column 10, so stack traces match your source without a source map.' });
      st.push({ lab: 'what V8 receives', cls: 'er', out: ['ok', '$ node app.ts\n' + S.out], x: 'The result is valid JavaScript and runs. Remember: no type was <b>checked</b>. A wrong annotation would have been erased just as happily. Run <code>tsc --noEmit</code> in CI.' });
    } else if (sn === 'codegen') {
      st.push({ lab: 'source: repo.ts', cls: 'hl', x: 'Blue spans are erasable. The red ones are not: <code>enum</code> becomes a runtime object, and <code>private readonly db</code> means “also do <code>this.db = db</code>”. Erasing them would change what the program does.' });
      if (mode === 'strip') {
        st.push({ lab: 'source: repo.ts', cls: 'hl', out: ['bad', 'SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]:\n  TypeScript enum is not supported in strip-only mode'], x: 'In strip-only mode (the default) Node <b>refuses</b> to run the file. Replace the enum with an <code>as const</code> object and write the field explicitly, or turn on TypeScript 5.8’s <code>erasableSyntaxOnly</code> so the compiler reports this first.' });
      } else {
        st.push({ lab: 'generated JavaScript (simplified)', cls: '', gen: true, x: 'With <code>--experimental-transform-types</code> Node <b>generates code</b>: an enum object and a constructor assignment. Lines no longer line up with the source, so Node also generates a source map for this file.' });
        st.push({ lab: 'generated JavaScript (simplified)', cls: '', gen: true, out: ['ok', '$ node --experimental-transform-types repo.ts\n(runs)'], x: 'It runs, at the cost of a real transform and an experimental flag. For production code most teams prefer erasable-only TypeScript or a separate build step.' });
      }
    } else {
      st.push({ lab: 'source: app.ts', cls: 'hl', x: 'The annotation <code>: User</code> is erasable. But the import line (yellow) looks like a normal value import. Stripping works <b>one file at a time</b> and can’t look into <code>users.ts</code> to see that <code>User</code> is only an interface.' });
      st.push({ lab: 'what V8 receives', cls: 'er', x: 'So the annotation becomes spaces, but the import is <b>kept as written</b>.' });
      st.push({ lab: 'what V8 receives', cls: 'er', out: ['bad', "SyntaxError: The requested module './users.ts' does not provide\nan export named 'User'"], x: 'At link time the ES module loader checks every named import. <code>users.ts</code> exports no runtime value called <code>User</code> (interfaces were erased there too), so the import fails. Fix: <code>import { type User, loadUser }</code>, and enable <code>verbatimModuleSyntax</code> so tsc insists on it. (Shown in strip-only mode, the default.)' });
    }
    return st;
  }
  function render() {
    const S = SN[sn]; const s = steps[k - 1] || steps[0];
    lab.textContent = s.lab;
    if (s.gen) renderLines(S.gen, true); else renderLines(S.src, false);
    codeEl.className = 'w-ts-code' + (s.cls ? ' ' + s.cls : '');
    outHost.innerHTML = '';
    const o = steps.slice(0, k).reverse().find((x) => x.out);
    if (o) outHost.append(el('div', { class: 'w-ts-out ' + o.out[0], text: o.out[1] }));
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `lines in <b>${S.src.length}</b> → out <b>${s.gen ? S.gen.length : S.src.length}</b>` }), el('span', { class: 'w-stat', html: `mode <b>${mode === 'strip' ? 'strip-only' : 'transform'}</b>` }));
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan(); bStep.disabled = false; render();
    say('Node 22.6+ (<code>--experimental-strip-types</code>; on by default from 22.18 and 23.6). Press Play or Step.');
  }
  function step() { if (k >= steps.length) return false; k++; render(); say(steps[k - 1].x); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { while (step()); return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
