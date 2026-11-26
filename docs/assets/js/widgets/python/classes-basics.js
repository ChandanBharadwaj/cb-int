/* Classes basics: step through object creation, self, attribute lookup (instance → class → base), super() and the shared-class-attribute trap. */
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
  IA.widget('classes-basics', (root, ctx) => {
    const e = ctx.esc;
    // st: { boxes: [{ name, kv: [[k, v]], hot?, miss?, hotKey? }], frame?: 'text', note?: 'text' }
    const ACC = [['bank', "'Atlas'"], ['__init__', 'function'], ['deposit', 'function']];
    const S = [
      { label: 'Create & call', code: [
        'class Account:',
        '    bank = "Atlas"                 # class attribute (shared)',
        '    def __init__(self, owner, balance=0):',
        '        self.owner = owner         # instance attributes',
        '        self.balance = balance',
        '    def deposit(self, amt):',
        '        self.balance += amt',
        '        return self.balance',
        '',
        'acct = Account("Asha")            # no `new` keyword',
        'acct.deposit(50)',
        'print(acct.bank, acct.balance)'],
      steps: [
        { line: [0, 1, 2, 5], cap: 'The <code>class</code> statement <b>runs</b> like any other code. It creates a class object holding <code>bank</code> and two functions. No fields are declared: instances get attributes when you assign them.', st: { boxes: [{ name: 'class Account', kv: ACC, hot: true }] } },
        { line: 9, cap: 'Calling the class like a function creates an object. Python first makes an <b>empty</b> instance (that is <code>__new__</code>; you rarely touch it).', st: { boxes: [{ name: 'acct  (new instance)', kv: [], hot: true }, { name: 'class Account', kv: ACC }] } },
        { line: [2, 9], cap: 'Then it calls <code>__init__(self, "Asha")</code>. <code>self</code> is the new object, passed <b>explicitly</b> as the first parameter: it is Java’s <code>this</code>, but you must write it.', st: { boxes: [{ name: 'acct = self', kv: [], hot: true }, { name: 'class Account', kv: ACC, hotKey: '__init__' }], frame: '__init__(self=acct, owner="Asha", balance=0)' } },
        { line: 3, cap: '<code>self.owner = owner</code> creates the attribute right now, in the instance’s own dictionary (<code>acct.__dict__</code>).', st: { boxes: [{ name: 'acct.__dict__', kv: [['owner', "'Asha'"]], hot: true, hotKey: 'owner' }, { name: 'class Account', kv: ACC }], frame: '__init__(self=acct, owner="Asha", balance=0)' } },
        { line: 4, cap: '<code>balance</code> used its default value <code>0</code>. <code>__init__</code> returns <code>None</code>; the call expression returns the instance, which is bound to <code>acct</code>.', st: { boxes: [{ name: 'acct.__dict__', kv: [['owner', "'Asha'"], ['balance', '0']], hot: true, hotKey: 'balance' }, { name: 'class Account', kv: ACC }] } },
        { line: 10, cap: '<code>acct.deposit</code>: look in the instance first. No <code>deposit</code> there…', st: { boxes: [{ name: 'acct.__dict__', kv: [['owner', "'Asha'"], ['balance', '0']], miss: true }, { name: 'class Account', kv: ACC }], note: 'lookup: acct → Account' } },
        { line: [5, 10], cap: '…so look in the class. Found. Python <b>binds</b> it to the instance, so <code>acct.deposit(50)</code> is really <code>Account.deposit(acct, 50)</code>.', st: { boxes: [{ name: 'acct.__dict__', kv: [['owner', "'Asha'"], ['balance', '0']], miss: true }, { name: 'class Account', kv: ACC, hot: true, hotKey: 'deposit' }], frame: 'deposit(self=acct, amt=50)' } },
        { line: 6, cap: '<code>self.balance += amt</code> reads 0, adds 50 and writes 50 back to the instance.', st: { boxes: [{ name: 'acct.__dict__', kv: [['owner', "'Asha'"], ['balance', '50']], hot: true, hotKey: 'balance' }, { name: 'class Account', kv: ACC }], frame: 'deposit(self=acct, amt=50)' } },
        { line: 11, cap: '<code>acct.bank</code> isn’t in the instance, so it is found on the class. <code>acct.balance</code> is found in the instance. Same lookup rule for data and methods.', out: 'Atlas 50', st: { boxes: [{ name: 'acct.__dict__', kv: [['owner', "'Asha'"], ['balance', '50']], hotKey: 'balance' }, { name: 'class Account', kv: ACC, hot: true, hotKey: 'bank' }] } }
      ] },
      { label: 'Inheritance & super()', code: [
        'class Animal:',
        '    def __init__(self, name):',
        '        self.name = name',
        '    def speak(self):',
        '        return f"{self.name} makes a sound"',
        '',
        'class Dog(Animal):                 # extends Animal',
        '    def __init__(self, name, breed):',
        '        super().__init__(name)     # NOT automatic',
        '        self.breed = breed',
        '    def speak(self):               # override (no @Override)',
        '        return super().speak() + " (woof)"',
        '',
        'd = Dog("Rex", "lab")',
        'print(d.speak())'],
      steps: [
        { line: [6], cap: '<code>class Dog(Animal)</code> is <code>class Dog extends Animal</code>. Python computes the <b>MRO</b> (method resolution order): Dog → Animal → object.', st: { boxes: [{ name: 'class Dog', kv: [['__init__', 'function'], ['speak', 'function']], hot: true }, { name: 'class Animal', kv: [['__init__', 'function'], ['speak', 'function']] }, { name: 'object', kv: [['__repr__, __eq__, …', 'defaults']] }], note: 'Dog.__mro__ = (Dog, Animal, object)' } },
        { line: [7, 13], cap: '<code>Dog("Rex", "lab")</code> finds <code>__init__</code> on Dog first, so <b>only Dog’s</b> runs. Unlike a Java constructor, the parent’s is not called for you.', st: { boxes: [{ name: 'd.__dict__', kv: [], hot: true }, { name: 'class Dog', kv: [['__init__', 'function'], ['speak', 'function']], hotKey: '__init__' }, { name: 'class Animal', kv: [['__init__', 'function'], ['speak', 'function']] }], frame: 'Dog.__init__(self=d, "Rex", "lab")' } },
        { line: [8, 1, 2], cap: '<code>super().__init__(name)</code> means “the next class after Dog in the MRO”, here Animal. It sets <code>self.name</code> on the <b>same</b> object.', st: { boxes: [{ name: 'd.__dict__', kv: [['name', "'Rex'"]], hot: true, hotKey: 'name' }, { name: 'class Dog', kv: [['__init__', 'function'], ['speak', 'function']] }, { name: 'class Animal', kv: [['__init__', 'function'], ['speak', 'function']], hotKey: '__init__' }], frame: 'Animal.__init__(self=d, "Rex")' } },
        { line: 9, cap: 'Back in Dog’s <code>__init__</code>: add <code>breed</code>. Forget the <code>super()</code> line and <code>d.name</code> would raise <code>AttributeError</code> later.', st: { boxes: [{ name: 'd.__dict__', kv: [['name', "'Rex'"], ['breed', "'lab'"]], hot: true, hotKey: 'breed' }, { name: 'class Dog', kv: [['__init__', 'function'], ['speak', 'function']] }, { name: 'class Animal', kv: [['__init__', 'function'], ['speak', 'function']] }] } },
        { line: [10, 14], cap: '<code>d.speak()</code>: instance → Dog. Found on Dog, so Dog’s override wins. All methods are “virtual” in Python.', st: { boxes: [{ name: 'd.__dict__', kv: [['name', "'Rex'"], ['breed', "'lab'"]], miss: true }, { name: 'class Dog', kv: [['__init__', 'function'], ['speak', 'function']], hot: true, hotKey: 'speak' }, { name: 'class Animal', kv: [['__init__', 'function'], ['speak', 'function']] }], frame: 'Dog.speak(self=d)' } },
        { line: [11, 3, 4], cap: '<code>super().speak()</code> continues the search <b>after</b> Dog: Animal’s version runs with the same <code>self</code>.', st: { boxes: [{ name: 'd.__dict__', kv: [['name', "'Rex'"], ['breed', "'lab'"]] }, { name: 'class Dog', kv: [['__init__', 'function'], ['speak', 'function']] }, { name: 'class Animal', kv: [['__init__', 'function'], ['speak', 'function']], hot: true, hotKey: 'speak' }], frame: 'Animal.speak(self=d) → "Rex makes a sound"' } },
        { line: 14, cap: 'Dog adds its suffix and returns. Inheritance in Python is the same idea as Java’s, with two differences to remember: explicit <code>self</code> and explicit <code>super().__init__</code>.', out: 'Rex makes a sound (woof)', st: { boxes: [{ name: 'd.__dict__', kv: [['name', "'Rex'"], ['breed', "'lab'"]] }, { name: 'class Dog', kv: [['__init__', 'function'], ['speak', 'function']] }, { name: 'class Animal', kv: [['__init__', 'function'], ['speak', 'function']] }] } }
      ] },
      { label: 'Shared class attribute', code: [
        'class Cart:',
        '    items = []                # ONE list, on the class',
        '    def add(self, x):',
        '        self.items.append(x)',
        '',
        'a, b = Cart(), Cart()',
        'a.add("apple")',
        'print(b.items)',
        '',
        '# fix: give each instance its own list',
        '#   def __init__(self): self.items = []'],
      steps: [
        { line: [0, 1], cap: 'In Java, <code>List items = new ArrayList&lt;&gt;();</code> in the class body is a per-object field. In Python, an assignment in the class body is a <b>class attribute</b>: closer to a Java <code>static</code>.', st: { boxes: [{ name: 'class Cart', kv: [['items', '[]  ← one list'], ['add', 'function']], hot: true, hotKey: 'items' }] } },
        { line: 5, cap: 'Two instances. Neither has its own <code>items</code>: both dictionaries are empty.', st: { boxes: [{ name: 'a.__dict__', kv: [] }, { name: 'b.__dict__', kv: [] }, { name: 'class Cart', kv: [['items', '[]'], ['add', 'function']] }] } },
        { line: [6, 3], cap: '<code>self.items</code> isn’t on <code>a</code>, so lookup finds the class list, and <code>.append</code> <b>mutates</b> it in place.', st: { boxes: [{ name: 'a.__dict__', kv: [], miss: true }, { name: 'b.__dict__', kv: [] }, { name: 'class Cart', kv: [['items', "['apple']"], ['add', 'function']], hot: true, hotKey: 'items' }] } },
        { line: 7, cap: '<code>b.items</code> finds the same class list. b “sees” a’s apple. Fix: create mutable state in <code>__init__</code> (or use <code>@dataclass</code> with <code>field(default_factory=list)</code>).', out: "['apple']", st: { boxes: [{ name: 'a.__dict__', kv: [] }, { name: 'b.__dict__', kv: [], miss: true }, { name: 'class Cart', kv: [['items', "['apple']"], ['add', 'function']], hot: true, hotKey: 'items' }] } }
      ] }
    ];
    function renderState(st) {
      let h = '';
      if (st.frame) h += `<div class="box"><h5>running call</h5><div class="kv">${e(st.frame)}</div></div>`;
      (st.boxes || []).forEach((b, i) => {
        if (i) h += '<div class="arrow" style="text-align:center;font-size:12px">↓ if not found, look here</div>';
        h += `<div class="box ${b.hot ? 'hot' : ''} ${b.miss ? 'miss' : ''}"><h5>${e(b.name)}${b.miss ? ' · not here' : ''}</h5>` +
          (b.kv.length ? b.kv.map(([k, v]) => `<div class="kv ${k === b.hotKey ? 'hot' : ''}">${e(k)}: <b>${e(v)}</b></div>`).join('') : '<div class="note">{} (empty)</div>') + '</div>';
      });
      if (st.note) h += `<div class="note">${e(st.note)}</div>`;
      return h || '<div class="note">Press Step.</div>';
    }
    pybStepper(root, ctx, S, renderState, { segLabel: 'Class scenario', stateLabel: 'objects and lookup order' });
  });
})();
