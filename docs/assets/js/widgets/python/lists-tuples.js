/* Lists & tuples: indexing and slicing, append vs extend, sort vs sorted, unpacking. */
IA.widget('lists-tuples', (root, ctx) => {
  const SCENES = [
    { name: 'index & slice', intro: 'Indexes start at 0; negative indexes count from the end. A slice <code>[start:stop:step]</code> makes a <b>new list</b>.', java: 'list.get(1), list.subList(1, 4) (a view, not a copy!)',
      code: ['a = [10, 20, 30, 40, 50]', 'x = a[1]', 'y = a[-1]', 'b = a[1:4]', 'c = a[::-1]'],
      steps: [
        { line: 0, vars: [['a', '[10, 20, 30, 40, 50]', 1]], cap: 'Square brackets make a list: ordered, mutable, any types.' },
        { line: 1, vars: [['a', '[10, 20, 30, 40, 50]'], ['x', 20, 1]], cap: '<code>a[1]</code> is the second item.' },
        { line: 2, vars: [['a', '[10, 20, 30, 40, 50]'], ['x', 20], ['y', 50, 1]], cap: '<code>a[-1]</code> is the last item. No <code>a[a.length - 1]</code> needed.' },
        { line: 3, vars: [['a', '[10, 20, 30, 40, 50]'], ['x', 20], ['y', 50], ['b', '[20, 30, 40]', 1]], cap: '<code>a[1:4]</code>: from index 1 up to but <b>not including</b> 4. A fresh copy.' },
        { line: 4, vars: [['a', '[10, 20, 30, 40, 50]'], ['x', 20], ['y', 50], ['b', '[20, 30, 40]'], ['c', '[50, 40, 30, 20, 10]', 1]], cap: 'Step −1 walks backwards: the classic reversed copy.' }
      ] },
    { name: 'append vs extend', intro: '<code>append</code> adds <b>one</b> item (even if it is a list). <code>extend</code> adds each item of an iterable.', java: 'list.add(x) vs list.addAll(other)',
      code: ['a = [1, 2]', 'a.append([3, 4])', 'b = [1, 2]', 'b.extend([3, 4])', 'b += [5]'],
      steps: [
        { line: 0, vars: [['a', '[1, 2]', 1]], cap: 'Start with two items.' },
        { line: 1, vars: [['a', '[1, 2, [3, 4]]  len 3', 1]], cap: 'The whole list became <b>one</b> nested item.' },
        { line: 2, vars: [['a', '[1, 2, [3, 4]]  len 3'], ['b', '[1, 2]', 1]], cap: 'A second list.' },
        { line: 3, vars: [['a', '[1, 2, [3, 4]]  len 3'], ['b', '[1, 2, 3, 4]  len 4', 1]], cap: '<code>extend</code> adds 3 and 4 individually.' },
        { line: 4, vars: [['a', '[1, 2, [3, 4]]  len 3'], ['b', '[1, 2, 3, 4, 5]', 1]], cap: '<code>+=</code> on a list is an in-place extend.' }
      ] },
    { name: 'sort vs sorted', intro: '<code>list.sort()</code> changes the list and returns <code>None</code>. <code>sorted(x)</code> returns a new list and works on any iterable.', java: 'Collections.sort(list) vs list.stream().sorted().toList()',
      code: ['nums = [3, 1, 2]', 'new = sorted(nums)', 'r = nums.sort()', 'words = ["bb", "a", "ccc"]', 'w = sorted(words, key=len, reverse=True)'],
      steps: [
        { line: 0, vars: [['nums', '[3, 1, 2]', 1]], cap: 'Unsorted.' },
        { line: 1, vars: [['nums', '[3, 1, 2]'], ['new', '[1, 2, 3]', 1]], cap: '<code>sorted</code> leaves <code>nums</code> alone.' },
        { line: 2, vars: [['nums', '[1, 2, 3]', 1], ['new', '[1, 2, 3]'], ['r', 'None', 1]], cap: '<code>.sort()</code> sorted in place and returned <b>None</b>. Writing <code>nums = nums.sort()</code> loses your list.' },
        { line: 4, vars: [['words', "['bb', 'a', 'ccc']"], ['w', "['ccc', 'bb', 'a']", 1]], cap: '<code>key=len</code> sorts by a computed value (like a Java <code>Comparator.comparing</code>). Sorting is stable.' }
      ] },
    { name: 'tuples & unpacking', intro: 'A tuple is an immutable sequence. Unpacking assigns its items to several names at once.', java: 'no tuples: you would write a record Pair(int a, int b)',
      code: ['p = (3, 4)', 'x, y = p', 'x, y = y, x', 'first, *rest = [1, 2, 3, 4]'],
      steps: [
        { line: 0, vars: [['p', '(3, 4)', 1]], cap: 'Parentheses (really the comma) make a tuple. <code>p[0] = 9</code> would raise <code>TypeError</code>.' },
        { line: 1, vars: [['p', '(3, 4)'], ['x', 3, 1], ['y', 4, 1]], cap: 'Unpacking: the counts must match or you get <code>ValueError</code>.' },
        { line: 2, vars: [['p', '(3, 4)'], ['x', 4, 1], ['y', 3, 1]], cap: 'Swap without a temp variable: the right side builds a tuple first.' },
        { line: 3, vars: [['first', 1, 1], ['rest', '[2, 3, 4]', 1]], cap: 'A starred name collects “the rest” as a <b>list</b>.' }
      ] }
  ];
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-pyb-style')) {
    document.head.append(el('style', { id: 'w-pyb-style', text: `
.w-pyb .code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.w-pyb .code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent}
.w-pyb .code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.w-pyb .out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.w-pyb .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.w-pyb .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}
.w-pyb .java{font-family:var(--mono);font-size:12px;color:var(--text-2);border-left:3px solid var(--warn);padding:4px 10px;margin-top:8px;white-space:pre-wrap}
.w-pyb .vb{fill:var(--surface);stroke:var(--border);stroke-width:1.5}
.w-pyb .vb.hot{stroke:var(--accent);stroke-width:2.5;fill:var(--accent-soft)}
@media (max-width:720px){.w-pyb .grid{grid-template-columns:1fr}}
` }));
  }
  let si = 0, k = 0, gen = 0, running = false;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Example' });
  SCENES.forEach((s, i) => { const b = el('button', { text: s.name, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { si = i; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'code' });
  const out = el('div', { class: 'out' });
  const java = el('div', { class: 'java' });
  const stage = svg('svg', { viewBox: '0 0 400 260', role: 'img', 'aria-label': 'Variables and their current values' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pyb');
  root.append(el('div', { class: 'w-controls' }, seg),
    el('div', { class: 'grid' },
      el('div', null, el('div', { class: 'lbl', text: 'python' }), codeHost, java),
      el('div', null, el('div', { class: 'lbl', text: 'variables' }), el('div', { class: 'w-stage' }, stage), el('div', { class: 'lbl', text: 'output' }), out)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  function render() {
    const S = SCENES[si]; const n = S.steps.length; const cur = k ? S.steps[k - 1] : null;
    codeHost.innerHTML = '';
    S.code.forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: ln ? IA.highlight(ln, 'python') : '&nbsp;' })));
    java.textContent = 'Java: ' + S.java;
    out.textContent = cur ? (cur.out || '') : '';
    stage.innerHTML = '';
    const vars = cur ? (cur.vars || []) : [];
    if (!vars.length) stage.append(svg('text', { x: 200, y: 130, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--text-3)', text: 'no variables yet' }));
    vars.forEach(([name, val, hot], i) => {
      const y = 12 + i * 48;
      const g = svg('g', null,
        svg('text', { x: 92, y: y + 25, 'text-anchor': 'end', 'font-size': 14, 'font-family': 'var(--mono)', 'font-weight': 700, fill: 'var(--text)', text: name }),
        svg('line', { x1: 98, y1: y + 20, x2: 118, y2: y + 20, stroke: 'var(--text-3)', 'stroke-width': 1.5 }),
        svg('rect', { class: 'vb' + (hot ? ' hot' : ''), x: 120, y, width: 272, height: 36, rx: 8 }),
        svg('text', { x: 132, y: y + 23, 'font-size': 13, 'font-family': 'var(--mono)', fill: hot ? 'var(--accent)' : 'var(--text-2)', text: String(val) }));
      if (hot && !reduced) { g.style.opacity = '0'; g.style.transition = 'opacity .4s'; requestAnimationFrame(() => requestAnimationFrame(() => { g.style.opacity = '1'; })); }
      stage.append(g);
    });
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${n}` }), el('div', { class: 't', html: cur ? cur.cap : S.intro }));
    bStep.disabled = k >= n;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = reduced ? SCENES[si].steps.length : 0; render(); }
  function step() { const n = SCENES[si].steps.length; if (k >= n) return false; k++; render(); return k < n; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', () => { gen++; stop(); k = 0; render(); });
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= SCENES[si].steps.length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2200); }
    if (g === gen) stop();
  });
  reset();
});
