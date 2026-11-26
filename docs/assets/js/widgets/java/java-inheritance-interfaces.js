/* Inheritance & interfaces: super, dynamic dispatch, abstract classes, default methods. */
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
  IA.widget('java-inheritance-interfaces', (root, ctx) => {
    const S = [
      { label: 'extends & super', code: [
        'class Animal {',
        '    protected final String name;',
        '    Animal(String name) { this.name = name; }',
        '    String speak() { return name + " makes a sound"; }',
        '}',
        'class Dog extends Animal {',
        '    Dog(String name) { super(name); }',
        '    @Override String speak() { return super.speak() + " (woof)"; }',
        '}',
        'Dog d = new Dog("Rex");',
        'System.out.println(d.speak());'],
      steps: [
        { line: [5, 0], cap: '<code>Dog extends Animal</code>: a Dog <b>is an</b> Animal. It inherits the <code>name</code> field and the <code>speak()</code> method. A class can extend only <b>one</b> class.', st: { boxes: [{ name: 'class Dog', kv: [['speak()', 'overrides']], hot: true }, { name: 'class Animal', kv: [['name', 'field'], ['speak()', 'method']] }, { name: 'class Object', kv: [['toString(), equals(), hashCode()…', '']] }] } },
        { line: [9, 6], cap: '<code>new Dog("Rex")</code> runs the Dog constructor. Its first statement <code>super(name)</code> runs the <b>parent</b> constructor first. Parents are always built before children.', st: { boxes: [{ name: 'heap: Dog#1', kv: [['name', 'null']], hot: true }], frame: 'Dog("Rex") → super("Rex")' } },
        { line: 2, cap: 'The Animal part of the object is initialised. One object, with fields from every level.', st: { boxes: [{ name: 'heap: Dog#1', kv: [['name', '"Rex"  (from Animal)']], hot: true, hotKey: 'name  (from Animal)' }] } },
        { line: [10, 7], cap: 'Calling <code>d.speak()</code>: the JVM starts at the object’s <b>real class</b>, Dog, and finds an override.', st: { boxes: [{ name: 'class Dog', kv: [['speak()', 'found ✓']], hot: true, hotKey: 'speak()' }, { name: 'class Animal', kv: [['speak()', '']] }], frame: 'Dog.speak(this=Dog#1)' } },
        { line: [7, 3], cap: '<code>super.speak()</code> explicitly calls the <b>parent’s</b> version, then Dog adds to it.', out: 'Rex makes a sound (woof)', st: { boxes: [{ name: 'class Dog', kv: [['speak()', '']] }, { name: 'class Animal', kv: [['speak()', 'via super ✓']], hot: true, hotKey: 'speak()' }], frame: 'Animal.speak(this=Dog#1)' } }
      ] },
      { label: 'Polymorphism', code: [
        'Animal[] zoo = { new Animal("Generic"), new Dog("Rex"), new Cat("Tom") };',
        'for (Animal a : zoo) {',
        '    System.out.println(a.speak());',
        '}',
        '// Cat overrides speak(): name + " says meow"'],
      steps: [
        { line: 0, cap: 'The array’s type is <code>Animal[]</code>, but each slot points to a different <b>real</b> class. The variable type is what the compiler checks; the object type is what runs.', st: { boxes: [{ name: 'zoo (declared Animal[])', kv: [['[0]', '→ Animal'], ['[1]', '→ Dog'], ['[2]', '→ Cat']], hot: true }] } },
        { line: 2, cap: '<code>a</code> points to a plain Animal. Animal’s <code>speak()</code> runs.', out: 'Generic makes a sound', st: { boxes: [{ name: 'a → Animal', kv: [['speak()', 'Animal.speak ✓']], hot: true, hotKey: 'speak()' }] } },
        { line: 2, cap: 'Same line of code, but <code>a</code> now points to a Dog. The JVM picks Dog’s override at <b>run time</b>. This is <b>dynamic dispatch</b>.', out: 'Rex makes a sound (woof)', st: { boxes: [{ name: 'a → Dog', kv: [['speak()', 'Dog.speak ✓']], hot: true, hotKey: 'speak()' }] } },
        { line: 2, cap: 'And a Cat. One loop, three behaviours, no <code>if</code>/<code>instanceof</code>. That is polymorphism.', out: 'Tom says meow', st: { boxes: [{ name: 'a → Cat', kv: [['speak()', 'Cat.speak ✓']], hot: true, hotKey: 'speak()' }], note: 'Overriding is chosen at run time. Overloading (same name, different parameters) is chosen at compile time.' } }
      ] },
      { label: 'Abstract class', code: [
        'abstract class Shape {',
        '    abstract double area();          // no body',
        '    String describe() { return getClass().getSimpleName() + " " + area(); }',
        '}',
        'class Square extends Shape {',
        '    final double side; Square(double s) { side = s; }',
        '    double area() { return side * side; }',
        '}',
        '// new Shape();  → compile error',
        'System.out.println(new Square(3).describe());'],
      steps: [
        { line: [0, 1], cap: 'An <code>abstract</code> class is a half-finished class. It can have fields, constructors and normal methods, plus <b>abstract</b> methods with no body.', st: { boxes: [{ name: 'abstract class Shape', kv: [['area()', 'abstract (no body)'], ['describe()', 'concrete']], hot: true }] } },
        { line: 8, cap: 'You cannot <code>new</code> an abstract class: “Shape is abstract; cannot be instantiated”.', err: true, out: 'error: Shape is abstract; cannot be instantiated', st: { boxes: [{ name: 'new Shape()', kv: [['', '✗']], bad: true }] } },
        { line: [4, 6], cap: 'A concrete subclass <b>must</b> implement every abstract method, or be abstract itself.', st: { boxes: [{ name: 'class Square', kv: [['area()', 'side * side']], hot: true, hotKey: 'area()' }, { name: 'abstract class Shape', kv: [['describe()', 'concrete']] }] } },
        { line: [9, 2, 6], cap: '<code>describe()</code> is written once in Shape but calls <code>area()</code>, which dispatches to Square. This “template method” pattern is a classic use of abstract classes.', out: 'Square 9.0', st: { boxes: [{ name: 'class Square', kv: [['area()', '9.0 ✓']], hot: true, hotKey: 'area()' }, { name: 'abstract class Shape', kv: [['describe()', 'running']], hot: true, hotKey: 'describe()' }] } }
      ] },
      { label: 'Interfaces & default', code: [
        'interface Greeter {',
        '    String name();                       // abstract',
        '    default String greet() { return "Hi " + name(); }',
        '}',
        'interface Loud { default String shout() { return "HEY"; } }',
        'record User(String name) implements Greeter, Loud {}',
        '',
        'Greeter g = new User("Ann");',
        'System.out.println(g.greet());'],
      steps: [
        { line: [0, 1], cap: 'An <b>interface</b> is a contract: a list of methods a type promises to have. Methods without a body are implicitly <code>public abstract</code>.', st: { boxes: [{ name: 'interface Greeter', kv: [['name()', 'abstract'], ['greet()', 'default']], hot: true }] } },
        { line: 2, cap: 'A <code>default</code> method (Java 8+) has a body. Implementers get it for free, and can override it. This lets libraries add methods without breaking old code.', st: { boxes: [{ name: 'interface Greeter', kv: [['greet()', 'default: "Hi " + name()']], hot: true, hotKey: 'greet()' }] } },
        { line: 5, cap: 'A class (or record) can <code>implement</code> <b>many</b> interfaces but <code>extend</code> only one class. The record’s <code>name()</code> accessor satisfies the abstract method.', st: { boxes: [{ name: 'record User', kv: [['name()', 'accessor ✓'], ['greet()', 'from Greeter'], ['shout()', 'from Loud']], hot: true }] } },
        { line: [7, 8, 2], cap: 'Use the interface as the variable type. <code>greet()</code> runs the default body, which calls the record’s <code>name()</code>.', out: 'Hi Ann', st: { boxes: [{ name: 'g (declared Greeter) → User', kv: [['greet()', 'default ✓'], ['name()', '"Ann"']], hot: true, hotKey: 'greet()' }], note: 'If two interfaces give the same default method, the class must override it and can pick one with <code>Greeter.super.greet()</code>.' } }
      ] }
    ];
    jbStepper(root, ctx, S, { segLabel: 'Inheritance scenario', stateLabel: 'objects and method lookup' });
  });
})();
