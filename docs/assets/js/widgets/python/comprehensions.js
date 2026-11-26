/* Comprehensions: step through list/dict/set/nested comprehensions and a lazy generator expression, next to their loop form. */
(function () {
  /* Shared step-through shell for the Python Basics widgets.
     S = [{ label, lang?, code: [lines], intro?, steps: [{ line: n | [n], cap, out?, st }] }]
     renderState(st, scenario) returns an HTML string for the state panel. */
  function pybStepper(root, ctx, S, renderState, opt) {
    const { el, sleep, reduced } = ctx;
    opt = opt || {};
    if (!document.getElementById('w-pyb-base')) {
      document.head.append(el('style', { id: 'w-pyb-base', text: `
.pyb .code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.pyb .code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent;min-height:1.55em}
.pyb .code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.pyb .out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.pyb .out .err{color:var(--err)}
.pyb .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.pyb .grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:12px;align-items:start}
@media (max-width:720px){.pyb .grid{grid-template-columns:1fr}}
.pyb .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:2px 0}
.pyb .cell{font-family:var(--mono);font-size:12.5px;padding:3px 9px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)}
.pyb .cell.hot{border-color:var(--accent);background:var(--accent-soft)}
.pyb .cell.ok{border-color:var(--ok)}
.pyb .cell.bad{border-color:var(--err);color:var(--err)}
.pyb .cell.dim{opacity:.45}
.pyb .cell.new{animation:capin .35s ease both}
.pyb .box{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface-2);margin-bottom:8px}
.pyb .box.hot{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.pyb .box.miss{border-style:dashed;opacity:.75}
.pyb .box.bad{border-color:var(--err)}
.pyb .box h5{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)}
.pyb .kv{font-family:var(--mono);font-size:12.5px;color:var(--text);padding:1px 0}
.pyb .kv b{color:var(--accent)}
.pyb .kv.hot{background:var(--accent-soft);border-radius:4px}
.pyb .note{font-size:12.5px;color:var(--text-2)}
.pyb .pillx{display:inline-block;font-family:var(--mono);font-size:12px;padding:2px 10px;border-radius:999px;border:1px solid var(--border);color:var(--text-3)}
.pyb .pillx.live{border-color:var(--err);color:var(--err);background:color-mix(in srgb,var(--err) 10%,transparent)}
.pyb .pillx.ok{border-color:var(--ok);color:var(--ok)}
.pyb .arrow{color:var(--text-3);font-family:var(--mono)}
` }));
    }
    root.classList.add('pyb');
    let si = 0; let k = 0; let running = false; let gen = 0;
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': opt.segLabel || 'Scenario' });
    S.forEach((s, i) => { const b = el('button', { text: s.label, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { si = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); seg.append(b); });
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const counter = el('span', { class: 'tiny' });
    const codeHost = el('div', { class: 'code' });
    const stateHost = el('div');
    const outHost = el('div', { class: 'out', 'aria-live': 'polite' });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
    root.append(el('div', { class: 'w-controls' }, seg),
      el('div', { class: 'grid' },
        el('div', null, el('div', { class: 'lbl', text: 'code' }), codeHost, el('div', { class: 'lbl', text: 'output (stdout)' }), outHost),
        el('div', null, el('div', { class: 'lbl', text: opt.stateLabel || 'what Python holds' }), stateHost)),
      el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, counter), narr);
    function render() {
      const s = S[si]; const st = k ? s.steps[k - 1] : null;
      const on = st ? [].concat(st.line == null ? [] : st.line) : [];
      codeHost.innerHTML = '';
      s.code.forEach((ln, i) => codeHost.append(el('div', { class: on.includes(i) ? 'on' : '', html: ln ? IA.highlight(ln, s.lang || 'python') : ' ' })));
      const outs = []; for (let i = 0; i < k; i++) if (s.steps[i].out != null) outs.push(s.steps[i]);
      outHost.innerHTML = outs.map((o) => o.err ? '<span class="err">' + ctx.esc(o.out) + '</span>' : ctx.esc(o.out)).join('\n');
      stateHost.innerHTML = renderState(st ? st.st : (s.init || {}), s, k);
      narr.firstChild.innerHTML = st ? st.cap : (s.intro || 'Press <b>Play</b> or <b>Step</b> to run the code one line at a time.');
      counter.textContent = `step ${k} / ${s.steps.length}`;
      bStep.disabled = k >= s.steps.length;
    }
    function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; render(); }
    function step() { if (k >= S[si].steps.length) return false; k++; render(); return true; }
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (reduced) { k = S[si].steps.length; render(); return; }
      if (k >= S[si].steps.length) reset();
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && step()) await sleep(1900);
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    reset();
  }
  IA.widget('comprehensions', (root, ctx) => {
    const e = ctx.esc;
    const R = (v) => typeof v === 'string' ? `'${v}'` : String(v);
    // ---- list: filter + transform
    function listSteps() {
      const nums = [3, 4, 7, 8]; const out = []; const st = [];
      st.push({ line: 2, cap: 'The comprehension on line 1 does exactly what lines 3–6 do. We step through the <b>loop form</b>. First an empty list is created.', st: { src: nums, i: -1, out: [] } });
      nums.forEach((x, i) => {
        st.push({ line: [0, 3], cap: `Take the next item: <code>x = ${x}</code>. In the comprehension this is the <code>for x in nums</code> part.`, st: { src: nums, i, x, out: out.slice() } });
        const ok = x % 2 === 0;
        st.push({ line: [0, 4], cap: `Filter: <code>${x} % 2 == 0</code> is <b>${ok ? 'True' : 'False'}</b>. ${ok ? 'Keep it.' : 'Skip it: nothing is added.'}`, st: { src: nums, i, x, test: ok, out: out.slice() } });
        if (ok) { out.push(x * x); st.push({ line: [0, 5], cap: `Transform and append: <code>x * x</code> = ${x * x}. The expression at the <b>front</b> of the comprehension is what ends up in the list.`, st: { src: nums, i, x, test: ok, out: out.slice(), fresh: out.length - 1 } }); }
      });
      st.push({ line: 7, cap: 'Done: <code>[16, 64]</code>. Read a comprehension as “<i>give me</i> x*x, <i>for each</i> x in nums, <i>keeping only</i> even x”.', out: '[16, 64]', st: { src: nums, i: -1, out: out.slice() } });
      return st;
    }
    // ---- dict: duplicate keys overwrite
    function dictSteps() {
      const words = ['hi', 'hey', 'yo', 'hey']; const out = {}; const st = [];
      st.push({ line: 1, cap: 'A <b>dict</b> comprehension uses <code>{key: value for …}</code>. Like <code>Collectors.toMap</code>, but duplicates <i>don’t</i> throw.', st: { src: words, i: -1, dict: {} } });
      words.forEach((w, i) => {
        const dup = w in out; out[w] = w.length;
        st.push({ line: 1, cap: dup ? `<code>'${w}'</code> is already a key. The new value <b>overwrites</b> the old one silently (Java’s <code>toMap</code> would throw <code>IllegalStateException</code>).` : `<code>w = '${w}'</code>: store key <code>'${w}'</code> → <code>len(w)</code> = ${w.length}.`, st: { src: words, i, dict: Object.assign({}, out), hotKey: w, dup } });
      });
      st.push({ line: 2, cap: 'Three keys from four words. Insertion order is kept (dicts are ordered since 3.7); the duplicate kept its <i>first</i> position but the <i>last</i> value.', out: "{'hi': 2, 'hey': 3, 'yo': 2}", st: { src: words, i: -1, dict: Object.assign({}, out) } });
      return st;
    }
    // ---- set: dedupe
    function setSteps() {
      const words = ['apple', 'avocado', 'banana', 'cherry', 'blueberry']; const seen = []; const st = [];
      st.push({ line: 1, cap: 'A <b>set</b> comprehension is <code>{expr for …}</code> with no colon. Sets drop duplicates.', st: { src: words, i: -1, set: [] } });
      words.forEach((w, i) => {
        const c = w[0]; const dup = seen.includes(c); if (!dup) seen.push(c);
        st.push({ line: 1, cap: dup ? `<code>'${c}'</code> is already in the set, so adding it changes nothing.` : `Add <code>w[0]</code> = <code>'${c}'</code>.`, st: { src: words, i, set: seen.slice(), hot: c, dup } });
      });
      st.push({ line: 2, cap: 'A set has <b>no guaranteed order</b>, so the code sorts before printing. Watch out: <code>{}</code> on its own is an empty <i>dict</i>; an empty set is <code>set()</code>.', out: "['a', 'b', 'c']", st: { src: words, i: -1, set: seen.slice() } });
      return st;
    }
    // ---- nested: flatten
    function nestedSteps() {
      const grid = [[1, 2], [3], [4, 5]]; const out = []; const st = [];
      st.push({ line: [0, 2], cap: 'Two <code>for</code>s in one comprehension. They nest in the <b>same order you’d write the loops</b>: outer first, inner second.', st: { grid, out: [] } });
      grid.forEach((row, r) => {
        st.push({ line: [0, 3], cap: `Outer loop: <code>row = [${row.join(', ')}]</code>.`, st: { grid, r, out: out.slice() } });
        row.forEach((n, c) => { out.push(n); st.push({ line: [0, 4, 5], cap: `Inner loop: <code>n = ${n}</code> → append.`, st: { grid, r, c, out: out.slice(), fresh: out.length - 1 } }); });
      });
      st.push({ line: 6, cap: 'Flattened. Two levels reads fine; at three levels, or with conditions on each, write plain loops instead.', out: '[1, 2, 3, 4, 5]', st: { grid, out: out.slice() } });
      return st;
    }
    // ---- generator expression: lazy
    function genSteps() {
      const nums = [3, 4, 7, 8]; let total = 0; const st = [];
      st.push({ line: 0, cap: 'Round brackets make a <b>generator expression</b>. Nothing runs yet: Python just builds a small object that knows how to produce values on demand. No list is created.', st: { src: nums, i: -1, total: null, lazy: true } });
      nums.forEach((x, i) => {
        total += x * x;
        st.push({ line: 1, cap: `<code>sum()</code> asks for the next value. The generator computes <code>${x} * ${x}</code> = ${x * x}, hands it over, and forgets it. Running total: ${total}.`, st: { src: nums, i, total, cur: x * x } });
      });
      st.push({ line: 2, cap: 'Memory stayed constant: one value at a time, like a Java <code>Stream</code>. A generator can be consumed <b>once</b>; a second <code>sum(squares)</code> gives 0.', out: String(total) + '\n0', st: { src: nums, i: -1, total, spent: true } });
      return st;
    }
    const S = [
      { label: 'list + filter', code: ['squares = [x * x for x in nums if x % 2 == 0]', '# is the same as:', 'squares = []', 'for x in nums:', '    if x % 2 == 0:', '        squares.append(x * x)', '', 'print(squares)'], steps: listSteps(), kind: 'list' },
      { label: 'dict', code: ['words = ["hi", "hey", "yo", "hey"]', 'lengths = {w: len(w) for w in words}', 'print(lengths)'], steps: dictSteps(), kind: 'dict' },
      { label: 'set', code: ['words = ["apple", "avocado", "banana", "cherry", "blueberry"]', 'initials = {w[0] for w in words}', 'print(sorted(initials))'], steps: setSteps(), kind: 'set' },
      { label: 'nested', code: ['flat = [n for row in grid for n in row]', '# is the same as:', 'flat = []', 'for row in grid:', '    for n in row:', '        flat.append(n)', 'print(flat)'], steps: nestedSteps(), kind: 'nested' },
      { label: 'generator ( )', code: ['squares = (x * x for x in nums)   # nothing computed yet', 'total = sum(squares)              # pulls values one by one', 'print(total); print(sum(squares))'], steps: genSteps(), kind: 'gen' }
    ];
    const cells = (arr, hot, cls) => '<div class="row">' + arr.map((v, i) => `<span class="cell ${i === hot ? 'hot' : ''} ${cls ? cls(i) : ''}">${e(R(v))}</span>`).join('') + '</div>';
    function renderState(st, s) {
      let h = '';
      if (s.kind === 'nested') {
        h += '<div class="box"><h5>grid</h5>' + (st.grid || [[1, 2], [3], [4, 5]]).map((row, r) => '<div class="row"><span class="arrow">' + (r === st.r ? '▶' : '&nbsp;') + '</span>' + row.map((n, c) => `<span class="cell ${r === st.r && c === st.c ? 'hot' : r === st.r ? 'ok' : ''}">${n}</span>`).join('') + '</div>').join('') + '</div>';
      } else {
        const src = st.src || s.steps[0].st.src;
        h += `<div class="box"><h5>${s.kind === 'list' || s.kind === 'gen' ? 'nums' : 'words'}</h5>` + cells(src, st.i) + '</div>';
      }
      if (s.kind === 'list') {
        h += `<div class="box"><h5>current x</h5><div class="kv">x = <b>${st.x == null ? '—' : st.x}</b></div>`;
        if (st.test != null) h += `<div class="kv">x % 2 == 0 → <span class="pillx ${st.test ? 'ok' : 'live'}">${st.test ? 'True' : 'False'}</span></div>`;
        h += '</div>';
      }
      if (s.kind === 'list' || s.kind === 'nested') {
        const out = st.out || [];
        h += `<div class="box hot"><h5>result list</h5><div class="row"><span class="arrow">[</span>${out.map((v, i) => `<span class="cell ok ${i === st.fresh ? 'new' : ''}">${v}</span>`).join('')}<span class="arrow">]</span></div></div>`;
      }
      if (s.kind === 'dict') {
        const d = st.dict || {};
        h += '<div class="box hot"><h5>result dict</h5>' + (Object.keys(d).length ? Object.keys(d).map((k) => `<div class="kv ${k === st.hotKey ? 'hot' : ''}">'${e(k)}': <b>${d[k]}</b>${k === st.hotKey && st.dup ? ' <span class="pillx live">overwritten</span>' : ''}</div>`).join('') : '<div class="note">{} (empty)</div>') + '</div>';
      }
      if (s.kind === 'set') {
        const set = st.set || [];
        h += `<div class="box hot"><h5>result set</h5><div class="row"><span class="arrow">{</span>${set.map((c) => `<span class="cell ${c === st.hot ? (st.dup ? 'bad' : 'hot new') : 'ok'}">'${c}'</span>`).join('')}<span class="arrow">}</span></div>${st.dup ? '<div class="note">duplicate ignored</div>' : ''}</div>`;
      }
      if (s.kind === 'gen') {
        h += `<div class="box ${st.spent ? 'miss' : 'hot'}"><h5>generator object</h5><div class="kv">${st.spent ? 'exhausted: yields nothing more' : st.lazy ? 'paused before the first item' : 'just yielded <b>' + st.cur + '</b>'}</div></div>`;
        h += `<div class="box"><h5>sum() running total</h5><div class="kv"><b>${st.total == null ? '—' : st.total}</b></div><div class="note">no list in memory</div></div>`;
      }
      return h;
    }
    pybStepper(root, ctx, S, renderState, { segLabel: 'Comprehension kind' });
  });
})();
