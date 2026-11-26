/* Classes & objects: new and constructors, this, static fields, access modifiers, packages. */
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
  IA.widget('java-classes-objects', (root, ctx) => {
    const S = [
      { label: 'new & constructor', code: [
        'public class Account {',
        '    private final String owner;',
        '    private long balance;',
        '    public Account(String owner, long balance) {',
        '        this.owner = owner;',
        '        this.balance = balance;',
        '    }',
        '    public Account(String owner) { this(owner, 0); }',
        '}',
        'Account a = new Account("Asha");',
        'Account b = a;'],
      steps: [
        { line: [0, 1, 2], cap: 'A <b>class</b> is a blueprint. Fields are declared up front with a type. Nothing exists in memory yet.', st: { boxes: [{ name: 'class Account', kv: [['owner', 'String (final)'], ['balance', 'long']], hot: true }] } },
        { line: 9, cap: '<code>new</code> allocates an object on the <b>heap</b>. Every field starts at its default: <code>null</code> for references, <code>0</code> for numbers.', st: { boxes: [{ name: 'heap: Account#1', kv: [['owner', 'null'], ['balance', '0']], hot: true }] } },
        { line: [7, 9], cap: 'The one-argument constructor runs. <code>this(owner, 0)</code> delegates to the other constructor. It must be the first statement.', st: { boxes: [{ name: 'heap: Account#1', kv: [['owner', 'null'], ['balance', '0']], hot: true }], frame: 'Account(owner="Asha") → this("Asha", 0)' } },
        { line: [3, 4, 5], cap: '<code>this.owner = owner</code>: the parameter has the same name as the field, so <code>this.</code> picks the field. Without it you would assign the parameter to itself.', st: { boxes: [{ name: 'heap: Account#1', kv: [['owner', '"Asha"'], ['balance', '0']], hot: true, hotKey: 'owner' }], frame: 'Account(owner="Asha", balance=0)' } },
        { line: 9, cap: '<code>new</code> returns a <b>reference</b> (an arrow to the object). The variable <code>a</code> holds that reference, not the object.', st: { boxes: [{ name: 'stack: main', kv: [['a', '→ Account#1']], hot: true, hotKey: 'a' }, { name: 'heap: Account#1', kv: [['owner', '"Asha"'], ['balance', '0']] }] } },
        { line: 10, cap: '<code>b = a</code> copies the arrow. Still <b>one</b> object. A change through <code>b</code> is visible through <code>a</code>. See <a href="references-pass-by-value.html">References &amp; pass-by-value</a>.', st: { boxes: [{ name: 'stack: main', kv: [['a', '→ Account#1'], ['b', '→ Account#1']], hot: true, hotKey: 'b' }, { name: 'heap: Account#1', kv: [['owner', '"Asha"'], ['balance', '0']], hot: true }] } }
      ] },
      { label: 'static members', code: [
        'public class Ticket {',
        '    private static int next = 1;   // shared',
        '    private final int id;          // per object',
        '    public Ticket() { id = next++; }',
        '}',
        'Ticket t1 = new Ticket();',
        'Ticket t2 = new Ticket();',
        'Ticket t3 = new Ticket();'],
      steps: [
        { line: 1, cap: 'A <code>static</code> field lives with the class, created once when the class is first used. Every object reads and writes the same one.', st: { boxes: [{ name: 'class Ticket (static)', kv: [['next', '1']], hot: true, hotKey: 'next' }] } },
        { line: [5, 3], cap: '<code>id = next++</code> copies the current <code>next</code> into this object, then increments the shared counter.', st: { boxes: [{ name: 'class Ticket (static)', kv: [['next', '2']], hot: true, hotKey: 'next' }, { name: 't1', kv: [['id', '1']] }] } },
        { line: [6, 7], cap: 'Each object gets its own <code>id</code>. There is still one <code>next</code>.', st: { boxes: [{ name: 'class Ticket (static)', kv: [['next', '4']], hot: true, hotKey: 'next' }, { name: 't1', kv: [['id', '1']] }, { name: 't2', kv: [['id', '2']] }, { name: 't3', kv: [['id', '3']] }], note: 'Not thread-safe: two threads can read the same <code>next</code>. Real code uses <code>AtomicInteger</code>.' } }
      ] },
      { label: 'Access modifiers', code: [
        'package com.shop.billing;',
        'public class Invoice {',
        '    public    String number;   // everyone',
        '    protected long total;      // package + subclasses',
        '              String status;   // package only (default)',
        '    private   String secret;   // this class only',
        '}'],
      steps: [
        { line: [1, 5], cap: 'Inside <code>Invoice</code> itself, every member is visible, including <code>private</code>.', st: { boxes: [{ name: 'from: Invoice', kv: [['number', '✓'], ['total', '✓'], ['status', '✓'], ['secret', '✓']], hot: true }] } },
        { line: 4, cap: 'Another class in the <b>same package</b> <code>com.shop.billing</code>: everything except <code>private</code>. No modifier means “package-private”.', st: { boxes: [{ name: 'from: com.shop.billing.Report', kv: [['number', '✓'], ['total', '✓'], ['status', '✓'], ['secret', '✗']], hot: true, hotKey: 'status' }] } },
        { line: 3, cap: 'A <b>subclass</b> in another package sees <code>public</code> and <code>protected</code> members (inherited through its own type).', st: { boxes: [{ name: 'from: com.shop.web.SpecialInvoice extends Invoice', kv: [['number', '✓'], ['total', '✓ (protected)'], ['status', '✗'], ['secret', '✗']], hot: true, hotKey: 'total' }] } },
        { line: 2, cap: 'An unrelated class in another package sees only <code>public</code>. Rule of thumb: make fields <code>private</code> and expose methods.', st: { boxes: [{ name: 'from: com.shop.api.Controller', kv: [['number', '✓'], ['total', '✗'], ['status', '✗'], ['secret', '✗']], hot: true, hotKey: 'number' }] } }
      ] },
      { label: 'Packages & imports', code: [
        'package com.shop.api;              // must match folder com/shop/api/',
        '',
        'import java.util.List;             // one class',
        'import java.util.*;                // all classes in java.util',
        'import static java.lang.Math.max;  // a static member',
        '',
        'public class Controller {',
        '    List<String> tags = new ArrayList<>();',
        '    int m = max(3, 7);',
        '    String s = "no import needed";  // java.lang is automatic',
        '}'],
      steps: [
        { line: 0, cap: 'A <b>package</b> is a namespace. The full name of this class is <code>com.shop.api.Controller</code>. The file lives in <code>com/shop/api/Controller.java</code>.', st: { boxes: [{ name: 'fully qualified name', kv: [['com.shop.api.Controller', '']], hot: true }] } },
        { line: [2, 7], cap: '<code>import</code> only lets you write a <b>short name</b>. It loads nothing and copies nothing. Without it you could write <code>java.util.List</code> in full.', st: { boxes: [{ name: 'short name → full name', kv: [['List', 'java.util.List'], ['ArrayList', 'java.util.ArrayList (via *)']], hot: true }] } },
        { line: [4, 8], cap: '<code>import static</code> brings in a static method or constant, so <code>max(3, 7)</code> means <code>Math.max(3, 7)</code>.', st: { boxes: [{ name: 'short name → full name', kv: [['max', 'java.lang.Math.max']], hot: true, hotKey: 'max' }] } },
        { line: 9, cap: '<code>java.lang</code> (String, Math, Integer, System…) is imported automatically. Classes in your own package need no import either.', st: { boxes: [{ name: 'always visible', kv: [['java.lang.*', ''], ['com.shop.api.*', '(same package)']], hot: true }] } }
      ] }
    ];
    jbStepper(root, ctx, S, { segLabel: 'Classes scenario', stateLabel: 'objects, references and visibility' });
  });
})();
