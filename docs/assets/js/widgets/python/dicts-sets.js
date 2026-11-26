/* Dicts & sets: CRUD and .get, iteration, defaultdict/Counter, set operations. */
IA.widget('dicts-sets', (root, ctx) => {
  const SCENES = [
    { name: 'CRUD & .get', intro: 'A dict maps keys to values, like a <code>HashMap</code> that also remembers insertion order (3.7+).', java: 'map.put / map.get / map.getOrDefault / map.remove',
      code: ['ages = {"ann": 31}', 'ages["bob"] = 25', 'ages["ann"] = 32', 'a = ages.get("cy", 0)', 'del ages["bob"]', 'ages["cy"]'],
      steps: [
        { line: 0, vars: [['ages', "{'ann': 31}", 1]], cap: 'A dict literal: <code>{key: value}</code>.' },
        { line: 1, vars: [['ages', "{'ann': 31, 'bob': 25}", 1]], cap: 'Assign to a new key: insert.' },
        { line: 2, vars: [['ages', "{'ann': 32, 'bob': 25}", 1]], cap: 'Assign to an existing key: update. The key keeps its original position.' },
        { line: 3, vars: [['ages', "{'ann': 32, 'bob': 25}"], ['a', 0, 1]], cap: '<code>.get(key, default)</code> never raises. Without a default it returns <code>None</code>.' },
        { line: 4, vars: [['ages', "{'ann': 32}", 1], ['a', 0]], cap: '<code>del</code> removes a key (or use <code>.pop(key)</code> to get the value back).' },
        { line: 5, vars: [['ages', "{'ann': 32}"], ['a', 0]], out: "KeyError: 'cy'", cap: 'Square-bracket lookup of a missing key raises <code>KeyError</code>. Java’s <code>get</code> returns null instead.' }
      ] },
    { name: 'iteration', intro: 'Looping over a dict gives its <b>keys</b>. Use <code>.items()</code> for pairs.', java: 'for (var e : map.entrySet()) { e.getKey(); e.getValue(); }',
      code: ['stock = {"apple": 3, "pear": 0}', 'for name in stock:', '    print(name)', 'for name, qty in stock.items():', '    print(name, qty)'],
      steps: [
        { line: 0, vars: [['stock', "{'apple': 3, 'pear': 0}", 1]], cap: 'Two entries.' },
        { line: 2, vars: [['name', "'apple'", 1]], out: 'apple', cap: 'Plain iteration yields keys, in insertion order.' },
        { line: 2, vars: [['name', "'pear'", 1]], out: 'apple\npear', cap: 'Second key.' },
        { line: 4, vars: [['name', "'apple'", 1], ['qty', 3, 1]], out: 'apple\npear\napple 3', cap: '<code>.items()</code> yields <code>(key, value)</code> tuples, unpacked into two names.' },
        { line: 4, vars: [['name', "'pear'", 1], ['qty', 0, 1]], out: 'apple\npear\napple 3\npear 0', cap: 'Do not add or remove keys while looping: <code>RuntimeError</code>. Loop over <code>list(stock)</code> if you must.' }
      ] },
    { name: 'Counter & defaultdict', intro: 'Two helpers from <code>collections</code> that remove “if key not in d” boilerplate.', java: 'map.merge(k, 1, Integer::sum) / map.computeIfAbsent(k, x -> new ArrayList<>()).add(v)',
      code: ['from collections import Counter, defaultdict', 'c = Counter("abca")', 'g = defaultdict(list)', 'g["x"].append(1)', 'g["x"].append(2)', 'n = c["z"]'],
      steps: [
        { line: 1, vars: [['c', "Counter({'a': 2, 'b': 1, 'c': 1})", 1]], cap: 'Counter counts items of any iterable. Here, characters.' },
        { line: 2, vars: [['c', "Counter({'a': 2, 'b': 1, 'c': 1})"], ['g', 'defaultdict(list, {})', 1]], cap: 'defaultdict takes a <b>factory</b>: <code>list</code>, not <code>list()</code>.' },
        { line: 3, vars: [['c', "Counter({'a': 2, 'b': 1, 'c': 1})"], ['g', "{'x': [1]}", 1]], cap: 'Missing key “x”: the factory makes <code>[]</code>, stores it, then <code>append</code> runs.' },
        { line: 4, vars: [['c', "Counter({'a': 2, 'b': 1, 'c': 1})"], ['g', "{'x': [1, 2]}", 1]], cap: 'Key exists now: normal lookup.' },
        { line: 5, vars: [['c', "Counter({'a': 2, 'b': 1, 'c': 1})"], ['g', "{'x': [1, 2]}"], ['n', 0, 1]], cap: 'A missing key in a Counter reads as 0 (and is not inserted).' }
      ] },
    { name: 'set operations', intro: 'A set holds unique, hashable items with fast membership tests.', java: 'Set<Integer> with addAll / retainAll / removeAll (which mutate)',
      code: ['a = {1, 2, 3}', 'b = {2, 3, 4}', 'u = a | b', 'i = a & b', 'd = a - b', 's = a ^ b'],
      steps: [
        { line: 0, vars: [['a', '{1, 2, 3}', 1]], cap: 'Braces with no colons make a set. (Empty <code>{}</code> is a dict; use <code>set()</code>.)' },
        { line: 1, vars: [['a', '{1, 2, 3}'], ['b', '{2, 3, 4}', 1]], cap: 'Second set.' },
        { line: 2, vars: [['a', '{1, 2, 3}'], ['b', '{2, 3, 4}'], ['u', '{1, 2, 3, 4}', 1]], cap: 'Union: in either.' },
        { line: 3, vars: [['a', '{1, 2, 3}'], ['b', '{2, 3, 4}'], ['u', '{1, 2, 3, 4}'], ['i', '{2, 3}', 1]], cap: 'Intersection: in both.' },
        { line: 4, vars: [['a', '{1, 2, 3}'], ['b', '{2, 3, 4}'], ['u', '{1, 2, 3, 4}'], ['i', '{2, 3}'], ['d', '{1}', 1]], cap: 'Difference: in a, not b.' },
        { line: 5, vars: [['a', '{1, 2, 3}'], ['b', '{2, 3, 4}'], ['i', '{2, 3}'], ['d', '{1}'], ['s', '{1, 4}', 1]], cap: 'Symmetric difference: in exactly one. All four return new sets; <code>a</code> is unchanged.' }
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
