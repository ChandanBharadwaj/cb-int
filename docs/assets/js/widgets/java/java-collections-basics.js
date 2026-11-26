/* Collections basics: ArrayList, HashMap, HashSet, safe iteration, List.of immutability. */
(function () {
  /* Shared step-through shell for the Java Basics widgets (copied per file so each file stands alone).
     S = [{ label, code: [lines], intro?, steps: [{ line: n | [n], cap, out?, err?, st }] }]
     st = { boxes: [{ name, kv: [[k, v]], hot?, miss?, bad?, hotKey? }], frame?, note? } */
  function jbStepper(root, ctx, S, opt) {
    const { el, sleep, reduced, esc: e } = ctx;
    opt = opt || {};
    if (!document.getElementById('w-jb-base')) {
      document.head.append(el('style', { id: 'w-jb-base', text: `
.jb .code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.jb .code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent;min-height:1.55em}
.jb .code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.jb .out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.jb .out .err{color:var(--err)}
.jb .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.jb .grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:12px;align-items:start}
@media (max-width:720px){.jb .grid{grid-template-columns:1fr}}
.jb .box{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface-2);margin-bottom:8px}
.jb .box.hot{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.jb .box.miss{border-style:dashed;opacity:.75}
.jb .box.bad{border-color:var(--err)}
.jb .box h5{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)}
.jb .kv{font-family:var(--mono);font-size:12.5px;color:var(--text);padding:1px 0;overflow-wrap:anywhere}
.jb .kv b{color:var(--accent)}
.jb .kv.hot{background:var(--accent-soft);border-radius:4px}
.jb .note{font-size:12.5px;color:var(--text-2)}
.jb .arrow{color:var(--text-3);font-family:var(--mono);text-align:center;font-size:12px}
` }));
    }
    root.classList.add('jb');
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
        el('div', null, el('div', { class: 'lbl', text: 'code' }), codeHost, el('div', { class: 'lbl', text: 'output (System.out)' }), outHost),
        el('div', null, el('div', { class: 'lbl', text: opt.stateLabel || 'what the JVM holds' }), stateHost)),
      el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, counter), narr);
    function renderState(st) {
      let h = '';
      if (st.frame) h += `<div class="box"><h5>running call</h5><div class="kv">${e(st.frame)}</div></div>`;
      (st.boxes || []).forEach((b, i) => {
        if (i && opt.arrow) h += `<div class="arrow">${e(opt.arrow)}</div>`;
        h += `<div class="box ${b.hot ? 'hot' : ''} ${b.miss ? 'miss' : ''} ${b.bad ? 'bad' : ''}"><h5>${e(b.name)}</h5>` +
          (b.kv.length ? b.kv.map(([kk, v]) => `<div class="kv ${kk === b.hotKey ? 'hot' : ''}">${e(kk)}${v === '' ? '' : ': <b>' + e(v) + '</b>'}</div>`).join('') : '<div class="note">(empty)</div>') + '</div>';
      });
      if (st.note) h += `<div class="note">${st.note}</div>`;
      return h || '<div class="note">Press Step.</div>';
    }
    function render() {
      const s = S[si]; const st = k ? s.steps[k - 1] : null;
      const on = st ? [].concat(st.line == null ? [] : st.line) : [];
      codeHost.innerHTML = '';
      s.code.forEach((ln, i) => codeHost.append(el('div', { class: on.includes(i) ? 'on' : '', html: ln ? IA.highlight(ln, 'java') : ' ' })));
      const outs = []; for (let i = 0; i < k; i++) if (s.steps[i].out != null) outs.push(s.steps[i]);
      outHost.innerHTML = outs.map((o) => o.err ? '<span class="err">' + e(o.out) + '</span>' : e(o.out)).join('\n');
      stateHost.innerHTML = renderState(st ? st.st : (s.init || {}));
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
  IA.widget('java-collections-basics', (root, ctx) => {
    const S = [
      { label: 'ArrayList', code: [
        'List<String> list = new ArrayList<>();',
        'list.add("a"); list.add("b"); list.add("c");',
        'list.add(1, "x");          // insert at index 1',
        'list.remove("b");          // by value',
        'list.remove(0);            // by index',
        'System.out.println(list + " " + list.size() + " " + list.get(0));'],
      steps: [
        { line: 0, cap: 'An <code>ArrayList</code> is a resizable array. You program to the <b>interface</b> <code>List</code>; the class is the implementation.', st: { boxes: [{ name: 'ArrayList (size 0)', kv: [], hot: true }] } },
        { line: 1, cap: '<code>add</code> appends at the end. Lists keep <b>insertion order</b>, allow duplicates and are indexed from 0.', st: { boxes: [{ name: 'ArrayList (size 3)', kv: [['[0]', '"a"'], ['[1]', '"b"'], ['[2]', '"c"']], hot: true, hotKey: '[2]' }] } },
        { line: 2, cap: '<code>add(1, "x")</code> inserts and <b>shifts</b> later elements right. Inserting at the front of a big list is slow (O(n)).', st: { boxes: [{ name: 'ArrayList (size 4)', kv: [['[0]', '"a"'], ['[1]', '"x"'], ['[2]', '"b"'], ['[3]', '"c"']], hot: true, hotKey: '[1]' }] } },
        { line: 3, cap: '<code>remove("b")</code> removes the first element equal to "b" (using <code>equals</code>). Later elements shift left.', st: { boxes: [{ name: 'ArrayList (size 3)', kv: [['[0]', '"a"'], ['[1]', '"x"'], ['[2]', '"c"']], hot: true }] } },
        { line: 4, cap: '<code>remove(0)</code> with an <code>int</code> removes <b>by index</b>. On a <code>List&lt;Integer&gt;</code> this overload trips people up.', st: { boxes: [{ name: 'ArrayList (size 2)', kv: [['[0]', '"x"'], ['[1]', '"c"']], hot: true, hotKey: '[0]' }] } },
        { line: 5, cap: '<code>toString()</code> prints the elements in brackets.', out: '[x, c] 2 x', st: { boxes: [{ name: 'ArrayList (size 2)', kv: [['[0]', '"x"'], ['[1]', '"c"']], hot: true }] } }
      ] },
      { label: 'HashMap', code: [
        'Map<String, Integer> stock = new HashMap<>();',
        'stock.put("apple", 3);',
        'stock.put("pear", 5);',
        'stock.put("apple", 7);     // same key: replaces',
        'stock.get("kiwi");         // missing key',
        'stock.getOrDefault("kiwi", 0);',
        'stock.merge("pear", 1, Integer::sum);'],
      steps: [
        { line: 0, cap: 'A <code>Map</code> stores <b>key → value</b> pairs. Keys are unique. <code>HashMap</code> finds a key by its <code>hashCode()</code>, then confirms with <code>equals()</code>.', st: { boxes: [{ name: 'HashMap', kv: [], hot: true }] } },
        { line: [1, 2], cap: 'Two entries. Iteration order of a HashMap is <b>not</b> insertion order and is not guaranteed. Use <code>LinkedHashMap</code> if order matters.', st: { boxes: [{ name: 'HashMap', kv: [['"apple"', '3'], ['"pear"', '5']], hot: true }] } },
        { line: 3, cap: '<code>put</code> on an existing key <b>replaces</b> the value and returns the old one (3). The map still has 2 entries.', st: { boxes: [{ name: 'HashMap', kv: [['"apple"', '7'], ['"pear"', '5']], hot: true, hotKey: '"apple"' }], note: 'put returned 3' } },
        { line: 4, cap: '<code>get</code> of a missing key returns <code>null</code>, not an exception. Unboxing that <code>null</code> into an <code>int</code> throws <code>NullPointerException</code>.', out: 'null', st: { boxes: [{ name: 'HashMap', kv: [['"apple"', '7'], ['"pear"', '5']], miss: true }], note: 'lookup "kiwi": not found' } },
        { line: 5, cap: '<code>getOrDefault</code> is the safe read.', out: '0', st: { boxes: [{ name: 'HashMap', kv: [['"apple"', '7'], ['"pear"', '5']] }] } },
        { line: 6, cap: '<code>merge(key, 1, Integer::sum)</code> is the idiomatic counter: insert 1 if absent, else add 1.', st: { boxes: [{ name: 'HashMap', kv: [['"apple"', '7'], ['"pear"', '6']], hot: true, hotKey: '"pear"' }] } }
      ] },
      { label: 'Set', code: [
        'Set<String> tags = new HashSet<>();',
        'tags.add("java");',
        'boolean again = tags.add("java");',
        'tags.add("sql");',
        'tags.contains("sql");'],
      steps: [
        { line: [0, 1], cap: 'A <code>Set</code> holds <b>unique</b> elements, with no index. <code>HashSet</code> is backed by a HashMap.', st: { boxes: [{ name: 'HashSet', kv: [['"java"', '']], hot: true }] } },
        { line: 2, cap: 'Adding a duplicate does nothing and returns <code>false</code>. “Duplicate” means <code>equals()</code> is true, so your own classes need <code>equals</code> and <code>hashCode</code> (see <a href="equals-hashcode.html">equals &amp; hashCode</a>).', out: 'false', st: { boxes: [{ name: 'HashSet', kv: [['"java"', '(already here)']], hot: true, hotKey: '"java"' }] } },
        { line: [3, 4], cap: '<code>contains</code> is fast (about O(1)) for a HashSet, versus O(n) for a List. Use <code>TreeSet</code> for sorted order, <code>LinkedHashSet</code> for insertion order.', out: 'true', st: { boxes: [{ name: 'HashSet', kv: [['"java"', ''], ['"sql"', 'found ✓']], hot: true, hotKey: '"sql"' }] } }
      ] },
      { label: 'Iterating safely', code: [
        'List<Integer> nums = new ArrayList<>(List.of(1, 2, 3, 4));',
        'for (Integer n : nums) {',
        '    if (n % 2 == 0) nums.remove(n);   // BUG',
        '}',
        'nums.removeIf(n -> n % 2 == 0);       // fix',
        'for (var e : map.entrySet()) { e.getKey(); e.getValue(); }'],
      steps: [
        { line: 1, cap: 'The for-each loop uses an <b>Iterator</b> behind the scenes. It remembers how many changes the list had when the loop started (<code>modCount</code>).', st: { boxes: [{ name: 'nums', kv: [['[0]', '1'], ['[1]', '2'], ['[2]', '3'], ['[3]', '4']], hot: true, hotKey: '[0]' }] } },
        { line: 2, cap: 'At <code>2</code>, the loop removes from the list <b>directly</b>. The list changes under the iterator.', st: { boxes: [{ name: 'nums', kv: [['[0]', '1'], ['[1]', '3'], ['[2]', '4']], bad: true }], note: 'modCount changed; the iterator still expects the old value' } },
        { line: 1, cap: 'The next <code>next()</code> call notices and throws. (It is a best-effort check, not a guarantee: with some sizes the loop simply ends early and skips elements.)', err: true, out: 'java.util.ConcurrentModificationException', st: { boxes: [{ name: 'iterator', kv: [['state', 'fail-fast ✗']], bad: true }] } },
        { line: 4, cap: 'Fix: <code>removeIf</code>, or use the iterator’s own <code>it.remove()</code>.', out: '[1, 3]', st: { boxes: [{ name: 'nums', kv: [['[0]', '1'], ['[1]', '3']], hot: true }] } },
        { line: 5, cap: 'For a map, loop over <code>entrySet()</code> to get key and value together, without a second lookup.', st: { boxes: [{ name: 'map views', kv: [['keySet()', 'keys'], ['values()', 'values'], ['entrySet()', 'key + value ✓']], hot: true, hotKey: 'entrySet()' }] } }
      ] },
      { label: 'List.of', code: [
        'List<String> fixed = List.of("a", "b");',
        'fixed.add("c");',
        'List<String> view = Arrays.asList("a", "b");',
        'view.set(0, "z");   // allowed',
        'view.add("c");      // not allowed',
        'List<String> mine = new ArrayList<>(fixed);',
        'mine.add("c");'],
      steps: [
        { line: 0, cap: '<code>List.of</code> (Java 9+) builds an <b>unmodifiable</b> list. It also rejects <code>null</code> elements.', st: { boxes: [{ name: 'List.of → unmodifiable', kv: [['[0]', '"a"'], ['[1]', '"b"']], hot: true }] } },
        { line: 1, cap: 'Any change throws at <b>run time</b>. The <code>List</code> interface still has <code>add</code>, so the compiler can’t catch it.', err: true, out: 'java.lang.UnsupportedOperationException', st: { boxes: [{ name: 'List.of → unmodifiable', kv: [['[0]', '"a"'], ['[1]', '"b"']], bad: true }] } },
        { line: [2, 3, 4], cap: '<code>Arrays.asList</code> is different: a <b>fixed-size</b> view over an array. <code>set</code> works; <code>add</code>/<code>remove</code> throw.', err: true, out: 'java.lang.UnsupportedOperationException', st: { boxes: [{ name: 'Arrays.asList → fixed size', kv: [['[0]', '"z"'], ['[1]', '"b"']], hot: true, hotKey: '[0]' }] } },
        { line: [5, 6], cap: 'Need to change it? Copy into a new <code>ArrayList</code>. The copy is yours. See <a href="immutability-records.html">Immutability &amp; records</a>.', st: { boxes: [{ name: 'ArrayList (copy)', kv: [['[0]', '"a"'], ['[1]', '"b"'], ['[2]', '"c"']], hot: true, hotKey: '[2]' }] } }
      ] }
    ];
    jbStepper(root, ctx, S, { segLabel: 'Collections scenario', stateLabel: 'what the collection holds' });
  });
})();
