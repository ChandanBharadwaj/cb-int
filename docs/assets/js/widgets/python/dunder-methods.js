/* Dunder dispatch: what the interpreter actually calls for +, ==/hash in a dict, `in`, truthiness, str() and __slots__. */
IA.widget('dunder-methods', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-py-base')) {
    document.head.append(el('style', { id: 'w-py-base', text: `
.wpy-code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.wpy-code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent}
.wpy-code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.wpy-out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.wpy-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.wpy-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:12px;align-items:start}
@media (max-width:720px){.wpy-grid{grid-template-columns:1fr}}
` }));
  }
  if (!document.getElementById('w-pydu-style')) {
    document.head.append(el('style', { id: 'w-pydu-style', text: `
.w-pydu .expr{font-family:var(--mono);font-size:15px;font-weight:700;padding:8px 12px;border-radius:10px;background:var(--accent-soft);border:1px solid var(--accent);color:var(--text);display:inline-block;margin-bottom:6px}
.w-pydu .tr{display:flex;flex-direction:column;gap:0}
.w-pydu .nd{display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:space-between;border:1.5px solid var(--border);border-radius:10px;padding:7px 10px;background:var(--surface);animation:capin .35s ease both}
.w-pydu .nd code{font-size:12.5px;overflow-wrap:anywhere}
.w-pydu .nd .r{font-family:var(--mono);font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid var(--border);white-space:nowrap}
.w-pydu .nd.ok{border-color:var(--ok)} .w-pydu .nd.ok .r{color:var(--ok);border-color:var(--ok)}
.w-pydu .nd.ni{border-color:var(--warn)} .w-pydu .nd.ni .r{color:var(--warn);border-color:var(--warn)}
.w-pydu .nd.fail{border-color:var(--err)} .w-pydu .nd.fail .r{color:var(--err);border-color:var(--err)}
.w-pydu .nd.skip{opacity:.6;border-style:dashed}
.w-pydu .nd.try{border-color:var(--accent)}
.w-pydu .lk{align-self:flex-start;margin-left:18px;color:var(--text-3);font-size:13px;line-height:18px}
.w-pydu .nd.noanim{animation:none}
` }));
  }
  // Each step appends one trace node {c: call, r: result, s: ok|ni|fail|skip|try, why: small note} and highlights a code line.
  const S = [
    { label: 'a + b', expr: 'Money(5) + 3', code: ['class Money:', '    def __init__(self, cents):', '        self.cents = cents', '    def __add__(self, other):', '        if isinstance(other, Money):', '            return Money(self.cents + other.cents)', '        return NotImplemented', '    def __radd__(self, other):', '        if other == 0:', '            return self', '        return NotImplemented'],
      steps: [
        { line: 3, n: { c: 'Money.__add__(m, 3)', r: '…', s: 'try' }, cap: 'For <code>a + b</code> Python first asks the <b>left</b> operand: <code>type(a).__add__(a, b)</code>. It looks the method up on the <i>type</i>, not the instance.' },
        { line: 6, n: { c: 'Money.__add__(m, 3)', r: 'NotImplemented', s: 'ni' }, replace: true, cap: '<code>3</code> isn’t Money, so <code>__add__</code> returns the special singleton <code>NotImplemented</code>. That means “I don’t know how; ask the other side”. It is not an error.' },
        { line: 7, n: { c: 'int.__radd__(3, m)', r: '…', s: 'try' }, cap: 'Next Python tries the <b>right</b> operand’s reflected method: <code>type(b).__radd__(b, a)</code>. Here b is the int 3.' },
        { line: 7, n: { c: 'int.__radd__(3, m)', r: 'NotImplemented', s: 'ni' }, replace: true, cap: 'int doesn’t know Money either.' },
        { line: null, n: { c: 'raise TypeError', r: "unsupported operand type(s) for +: 'Money' and 'int'", s: 'fail' }, cap: 'Both sides declined, so Python raises <code>TypeError</code>. Raising inside <code>__add__</code> yourself would have skipped the right-hand side’s chance; return <code>NotImplemented</code> instead.' }
      ] },
    { label: 'sum() & __radd__', expr: 'sum([Money(5), Money(7)])', code: ['class Money:', '    def __init__(self, cents):', '        self.cents = cents', '    def __add__(self, other):', '        if isinstance(other, Money):', '            return Money(self.cents + other.cents)', '        return NotImplemented', '    def __radd__(self, other):', '        if other == 0:', '            return self', '        return NotImplemented'],
      steps: [
        { line: null, n: { c: 'sum starts with start=0', r: 'acc = 0', s: 'ok' }, cap: '<code>sum()</code> starts from <code>0</code> and does <code>acc = acc + item</code>. The first addition is <code>0 + Money(5)</code>.' },
        { line: null, n: { c: 'int.__add__(0, m5)', r: 'NotImplemented', s: 'ni' }, cap: 'The left operand is the int 0. It doesn’t know Money.' },
        { line: 9, n: { c: 'Money.__radd__(m5, 0)', r: 'm5', s: 'ok' }, cap: 'So Python tries <code>Money.__radd__</code>. Treating <code>0</code> as the identity makes <code>sum()</code> work without passing <code>start=</code>.' },
        { line: 5, n: { c: 'Money.__add__(m5, m7)', r: 'Money(12)', s: 'ok' }, cap: 'Now both operands are Money, and the left side handles it directly.' },
        { line: null, n: { c: 'result', r: 'Money(12)', s: 'ok' }, cap: 'Rule worth knowing: if the right operand’s type is a <b>subclass</b> of the left’s and overrides the reflected method, Python tries the right side <i>first</i>.' }
      ] },
    { label: 'dict key: hash & eq', expr: 'prices[Point(1, 2)]', code: ['class Point:', '    def __init__(self, x, y):', '        self.x, self.y = x, y', '    def __eq__(self, other):', '        if not isinstance(other, Point):', '            return NotImplemented', '        return (self.x, self.y) == (other.x, other.y)', '    def __hash__(self):', '        return hash((self.x, self.y))', '', 'prices = {Point(1, 2): 9.5}'],
      steps: [
        { line: 7, n: { c: 'Point.__hash__(key)', r: 'hash((1, 2))', s: 'ok' }, cap: 'A dict lookup starts by hashing the key. The hash picks a slot in the table.' },
        { line: null, n: { c: 'stored_key is key ?', r: 'False', s: 'ni' }, cap: 'The slot holds an entry. First a cheap <b>identity</b> check: this is a different Point object with the same value, so it fails.' },
        { line: null, n: { c: 'stored hash == hash(key) ?', r: 'yes', s: 'ok' }, cap: 'The dict stores each entry’s hash. If the stored hash differs, the entry is skipped without calling <code>__eq__</code>.' },
        { line: 6, n: { c: 'Point.__eq__(stored, key)', r: 'True', s: 'ok' }, cap: 'Finally <code>__eq__</code>. The values match.' },
        { line: null, n: { c: 'return value', r: '9.5', s: 'ok' }, cap: 'Contract: <code>a == b</code> must imply <code>hash(a) == hash(b)</code>, and the hash must not change while the key is in the dict. Define <code>__eq__</code> without <code>__hash__</code> and Python sets <code>__hash__ = None</code>: the class becomes unhashable.' }
      ] },
    { label: 'x in c (fallbacks)', expr: '3 in Deck()', code: ['class Deck:', '    cards = [1, 2, 3]', '    def __getitem__(self, i):', '        return self.cards[i]', '', '# no __contains__, no __iter__'],
      steps: [
        { line: null, n: { c: 'Deck.__contains__', r: 'not defined', s: 'skip' }, cap: '<code>in</code> first looks for <code>__contains__</code>.' },
        { line: null, n: { c: 'Deck.__iter__', r: 'not defined', s: 'skip' }, cap: 'Then for <code>__iter__</code>, to scan the items.' },
        { line: 2, n: { c: '__getitem__(0), (1), (2)', r: '1, 2, 3', s: 'try' }, cap: 'Last resort: the old <b>sequence protocol</b>. Python calls <code>__getitem__</code> with 0, 1, 2… until it finds a match or gets <code>IndexError</code>.' },
        { line: null, n: { c: '3 == 3', r: 'True', s: 'ok' }, cap: 'Found at index 2. (For a missing value, the <code>IndexError</code> from <code>cards[3]</code> ends the scan and gives False.)' },
        { line: null, n: { c: 'performance', r: 'O(n)', s: 'ni' }, cap: 'This fallback also makes <code>for</code> and <code>iter()</code> work. Define <code>__contains__</code> when you can do better than a linear scan.' }
      ] },
    { label: 'truthiness', expr: 'if Cart():', code: ['class Cart:', '    def __init__(self):', '        self.items = []', '    def __len__(self):', '        return len(self.items)', '', '# no __bool__'],
      steps: [
        { line: null, n: { c: 'Cart.__bool__', r: 'not defined', s: 'skip' }, cap: '<code>if x:</code> calls <code>bool(x)</code>, which looks for <code>__bool__</code> first.' },
        { line: 3, n: { c: 'Cart.__len__(cart)', r: '0', s: 'ok' }, cap: 'Without <code>__bool__</code> it falls back to <code>__len__</code>: zero length means falsy.' },
        { line: null, n: { c: 'bool(cart)', r: 'False', s: 'fail' }, cap: 'An empty Cart is falsy. With neither method, every object is truthy.' },
        { line: null, n: { c: 'trap', r: 'if cart: vs if cart is not None:', s: 'ni' }, cap: 'Code that means “was a cart passed?” must say <code>is not None</code>. Otherwise an empty cart takes the “missing” branch.' }
      ] },
    { label: 'str / repr', expr: 'print(Money(5)); f"{m!r}"', code: ['class Money:', '    def __init__(self, cents):', '        self.cents = cents', '    def __repr__(self):', '        return f"Money({self.cents})"', '', '# no __str__'],
      steps: [
        { line: null, n: { c: 'print → str(m) → Money.__str__', r: 'inherited object.__str__', s: 'skip' }, cap: '<code>print</code> calls <code>str()</code>. Money doesn’t define <code>__str__</code>, so the one from <code>object</code> runs.' },
        { line: 4, n: { c: 'object.__str__ → Money.__repr__', r: 'Money(5)', s: 'ok' }, cap: '<code>object.__str__</code> just calls <code>repr()</code>. So defining <code>__repr__</code> alone covers both.' },
        { line: 4, n: { c: 'f"{m!r}" / [m] / logging %r', r: 'Money(5)', s: 'ok' }, cap: 'Containers always use <code>repr</code> for their items, so a good <code>__repr__</code> is what you see in lists, logs and debuggers.' },
        { line: null, n: { c: 'rule of thumb', r: 'repr: unambiguous', s: 'ni' }, cap: '<code>__repr__</code> is for developers: unambiguous, ideally valid Python. <code>__str__</code> is for end users. Never put secrets in either.' }
      ] },
    { label: '__slots__', expr: 'p.z = 1', code: ['class P:', '    __slots__ = ("x", "y")', '    def __init__(self, x, y):', '        self.x, self.y = x, y', '', 'p = P(1, 2)'],
      steps: [
        { line: 1, n: { c: 'class creation', r: 'slot descriptors x, y', s: 'ok' }, cap: '<code>__slots__</code> makes the class reserve fixed storage for <code>x</code> and <code>y</code> and skip the per-instance <code>__dict__</code>.' },
        { line: null, n: { c: 'type(p).__mro__ lookup "z"', r: 'no descriptor', s: 'skip' }, cap: 'Setting an attribute first checks the type for a data descriptor named <code>z</code>. There isn’t one.' },
        { line: null, n: { c: 'p.__dict__', r: 'does not exist', s: 'skip' }, cap: 'Normally the value would go into the instance dict. With slots, there is no dict.' },
        { line: null, n: { c: 'raise AttributeError', r: "'P' object has no attribute 'z'", s: 'fail' }, cap: 'Typos in attribute names now fail loudly, and each instance is smaller. Slots must be declared in <b>every</b> class of a hierarchy, or a subclass gets a <code>__dict__</code> back.' }
      ] }
  ];

  let si = 0, k = 0, gen = 0, running = false;
  const segS = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  S.forEach((s, i) => { const b = el('button', { text: s.label, class: i === si ? 'on' : '' }); b.addEventListener('click', () => { si = i; [...segS.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); segS.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'wpy-code' });
  const exprHost = el('div', { class: 'expr' });
  const trace = el('div', { class: 'tr', 'aria-live': 'polite' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pydu');
  root.append(el('div', { class: 'w-controls' }, segS),
    el('div', { class: 'wpy-grid' },
      el('div', null, el('div', { class: 'wpy-lbl', text: 'class' }), codeHost),
      el('div', null, el('div', { class: 'wpy-lbl', text: 'you write' }), exprHost, el('div', { class: 'wpy-lbl', text: 'the interpreter calls' }), trace)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  function nodesAt(n) {
    const out = [];
    for (let i = 0; i < n; i++) { const s = S[si].steps[i]; if (s.replace) out[out.length - 1] = s.n; else out.push(s.n); }
    return out;
  }
  function render() {
    const sc = S[si]; const n = sc.steps.length; const cur = k ? sc.steps[k - 1] : null;
    codeHost.innerHTML = '';
    sc.code.forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: ln ? IA.highlight(ln, 'python') : '&nbsp;' })));
    exprHost.textContent = sc.expr;
    trace.innerHTML = '';
    nodesAt(k).forEach((nd, i, arr) => {
      if (i) trace.append(el('div', { class: 'lk', text: '↓' }));
      const fresh = i === arr.length - 1 && !reduced;
      trace.append(el('div', { class: 'nd ' + nd.s + (fresh ? '' : ' noanim') }, el('code', { text: nd.c }), el('span', { class: 'r', text: nd.r })));
    });
    if (!k) trace.append(el('div', { class: 'tiny', text: 'Nothing called yet.' }));
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${n}` }), el('div', { class: 't', html: cur ? cur.cap : 'Pick an expression and press <b>Play</b> or <b>Step</b> to see which special methods run, in order.' }));
    bStep.disabled = k >= n;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; render(); }
  function step() { const n = S[si].steps.length; if (k >= n) return false; k++; render(); return k < n; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= S[si].steps.length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2500); }
    if (g === gen) stop();
  });
  reset();
});
