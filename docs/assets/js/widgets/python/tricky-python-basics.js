/* Python Basics drill: 30 timed beginner questions across the 12 Basics topics. Programs marked run: true are complete scripts; `expect` is their exact stdout under python3 (3.12+). */
IA.widget('tricky-python-basics', (root, ctx) => {
  const { el, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- B1 Running Python ----------
    { t: 'Running Python', s: 'py-setup-first-program', q: 'What does this script print?', run: true, expect: 'a-b!\nc', code: `print("a", "b", sep="-", end="!\\n")
print("c")`, o: ['a b\nc', 'a-b!\nc', 'a-b!c', 'ab-!\nc'], a: 1, x: '<code>sep</code> goes between the arguments (default a space) and <code>end</code> goes after them (default <code>"\\n"</code>). Here <code>end</code> still ends with a newline, so <code>c</code> is on the next line.' },
    { t: 'Running Python', s: 'py-setup-first-program', q: 'Why do scripts wrap their entry code in <code>if __name__ == "__main__":</code>?', o: ['Python will not run a file without it', 'So that code runs when the file is executed directly, but not when another module imports it', 'It makes the code run faster', 'It marks the function the interpreter calls first, like Java’s main'], a: 1, x: 'Python has no required <code>main</code>: top-level code runs whenever the file is loaded, including on import. Run directly, <code>__name__</code> is <code>"__main__"</code>; imported, it is the module’s name.' },
    // ---------- B2 Variables & basic types ----------
    { t: 'Variables & types', s: 'variables-types', q: 'What does this print?', run: true, expect: '3 -3 True False', code: `print(int(3.99), int(-3.99), bool("False"), bool(""))`, o: ['4 -4 False False', '3 -4 True False', '3 -3 True False', '3 -3 False False'], a: 2, x: '<code>int()</code> truncates toward zero; it does not round. <code>bool()</code> of a string only checks emptiness: any non-empty string, even <code>"False"</code>, is truthy.' },
    { t: 'Variables & types', s: 'variables-types', q: 'What does this print?', run: true, expect: 'float int False', code: `print(type(7 / 2).__name__, type(7 // 2).__name__, 0.1 + 0.2 == 0.3)`, o: ['int int True', 'float int False', 'float float False', 'float int True'], a: 1, x: 'In Python 3, <code>/</code> always gives a float and <code>//</code> floors (an int for int operands). <code>0.1 + 0.2</code> is <code>0.30000000000000004</code> in binary floating point; compare with <code>math.isclose</code>.' },
    { t: 'Variables & types', s: 'variables-types', q: 'What happens on <code>print("Total: " + 5)</code>?', o: ['Prints Total: 5', 'TypeError: Python does not convert the int to str for you', 'Prints Total: 5 with a warning', 'SyntaxError'], a: 1, x: 'Python is dynamically but <b>strongly</b> typed: <code>str + int</code> is an error (unlike Java’s string concatenation). Use <code>f"Total: {5}"</code> or <code>str(5)</code>.' },
    // ---------- B3 Operators & expressions ----------
    { t: 'Operators', s: 'operators-expressions', q: 'What does this print?', run: true, expect: '3 -4 2 512', code: `print(7 // 2, -7 // 2, -7 % 3, 2 ** 3 ** 2)`, o: ['3 -3 -1 64', '3 -4 2 512', '3 -4 2 64', '3 -3 2 512'], a: 1, x: '<code>//</code> floors toward minus infinity (−3.5 → −4), and <code>%</code> takes the sign of the divisor (−7 % 3 is 2). Java truncates instead (−3 and −1). <code>**</code> is right-associative: <code>2 ** (3 ** 2)</code> = 2⁹.' },
    { t: 'Operators', s: 'operators-expressions', q: 'What does this print?', run: true, expect: '-4 True x 0 0 2 2', code: `print(-2 ** 2, 1 < 3 > 2, 0 or "x", 5 and 0, round(0.5), round(1.5), round(2.5))`, o: ['4 False x 0 1 2 3', '-4 True x 0 0 2 2', '-4 True x False 0 2 2', '4 True True 0 1 2 3'], a: 1, x: '<code>**</code> binds tighter than unary minus, so it is <code>-(2 ** 2)</code>. Chained <code>1 &lt; 3 &gt; 2</code> means <code>1 &lt; 3 and 3 &gt; 2</code>. <code>or</code>/<code>and</code> return one of the operands, not a bool. <code>round()</code> rounds half to even.' },
    // ---------- B4 Strings ----------
    { t: 'Strings', s: 'strings', q: 'What does this print?', run: true, expect: 'yth n nohtyP', code: `s = "Python"
print(s[1:4], s[-1], s[::-1])`, o: ['Pyt n nohtyP', 'yth n nohtyP', 'ytho n nohtyP', 'yth P nohtyP'], a: 1, x: 'A slice <code>[start:stop]</code> includes start and excludes stop: indexes 1, 2, 3. Negative indexes count from the end; step −1 reverses.' },
    { t: 'Strings', s: 'strings', q: 'What does this print?', run: true, expect: "hello ['a', 'b'] ['a', 'b', '', 'c']", code: `s = "hello"
s.upper()
print(s, " a  b ".split(), "a,b,,c".split(","))`, o: ["HELLO ['a', 'b'] ['a', 'b', 'c']", "hello ['', 'a', '', 'b', ''] ['a', 'b', '', 'c']", "hello ['a', 'b'] ['a', 'b', '', 'c']", "HELLO ['a', 'b'] ['a', 'b', '', 'c']"], a: 2, x: 'Strings are immutable: <code>upper()</code> returns a new string, which is thrown away here. <code>split()</code> with no argument splits on runs of whitespace and drops empty pieces; <code>split(",")</code> keeps empty fields.' },
    { t: 'Strings', s: 'strings', q: 'What does this print?', run: true, expect: 'TypeError\n1-2', code: `try:
    print("-".join([1, 2]))
except TypeError:
    print("TypeError")
print("-".join(map(str, [1, 2])))`, o: ['1-2\n1-2', 'TypeError\n1-2', 'TypeError\nTypeError', '[1, 2]\n1-2'], a: 1, x: '<code>str.join</code> needs strings; it does not convert ints. Convert first with <code>map(str, …)</code> or a generator.' },
    // ---------- B5 if / for / while ----------
    { t: 'if / for / while', s: 'control-flow', q: 'What does this print?', run: true, expect: '2\n[2, 5, 8]', code: `for i in range(3):
    pass
print(i)
print(list(range(2, 10, 3)))`, o: ['3\n[2, 5, 8]', '2\n[2, 5, 8]', 'NameError', '2\n[2, 5, 8, 11]'], a: 1, x: '<code>range(3)</code> is 0, 1, 2, and the loop variable stays defined after the loop with its last value. <code>range(start, stop, step)</code> never includes <code>stop</code>.' },
    { t: 'if / for / while', s: 'control-flow', q: 'What does this print?', run: true, expect: 'no even', code: `for n in [1, 3, 5]:
    if n % 2 == 0:
        print("even", n)
        break
else:
    print("no even")`, o: ['nothing', 'no even', 'even 1', 'SyntaxError: else needs an if'], a: 1, x: 'A loop’s <code>else</code> runs when the loop finishes <b>without</b> <code>break</code>. Read it as “no break”, not “the loop did not run”.' },
    { t: 'if / for / while', s: 'control-flow', q: 'What does this print? (Python 3.10+)', run: true, expect: 'zero pair 1 2 other', code: `def f(x):
    match x:
        case 0:
            return "zero"
        case [a, b]:
            return f"pair {a} {b}"
        case _:
            return "other"

print(f(0), f([1, 2]), f("hi"))`, o: ['zero pair 1 2 pair h i', 'zero pair 1 2 other', 'zero other other', 'TypeError'], a: 1, x: '<code>match</code> compares literals and destructures sequences. A sequence pattern does not match a <code>str</code> (strings are deliberately excluded), so <code>"hi"</code> falls to the wildcard <code>_</code>.' },
    // ---------- B6 Lists & tuples ----------
    { t: 'Lists & tuples', s: 'lists-tuples', q: 'What does this print?', run: true, expect: '[1, 2, 3] None', code: `a = [3, 1, 2]
b = a.sort()
print(a, b)`, o: ['[3, 1, 2] [1, 2, 3]', '[1, 2, 3] [1, 2, 3]', '[1, 2, 3] None', 'None None'], a: 2, x: '<code>list.sort()</code> sorts in place and returns <code>None</code>. <code>sorted(a)</code> returns a new list and leaves <code>a</code> alone.' },
    { t: 'Lists & tuples', s: 'lists-tuples', q: 'What does this print?', run: true, expect: '[1, 2, 3] [1, 2, 3, 4]', code: `a = [1, 2]
b = a
b.append(3)
c = a[:]
c.append(4)
print(a, c)`, o: ['[1, 2] [1, 2, 4]', '[1, 2, 3] [1, 2, 3, 4]', '[1, 2, 3, 4] [1, 2, 3, 4]', '[1, 2] [1, 2, 3, 4]'], a: 1, x: '<code>b = a</code> copies the reference, so both names share one list. <code>a[:]</code> makes a new (shallow) copy, so appending to <code>c</code> does not touch <code>a</code>.' },
    { t: 'Lists & tuples', s: 'lists-tuples', q: 'What does this print?', run: true, expect: '2 3 int tuple', code: `a = [1]
a.append([2, 3])
b = [1]
b.extend([2, 3])
print(len(a), len(b), type((5)).__name__, type((5,)).__name__)`, o: ['3 3 tuple tuple', '2 3 int tuple', '2 3 tuple tuple', '3 2 int tuple'], a: 1, x: '<code>append</code> adds one item (the whole list); <code>extend</code> adds each element. Parentheses alone do not make a tuple: the comma does, so a one-item tuple is <code>(5,)</code>.' },
    // ---------- B7 Dicts & sets ----------
    { t: 'Dicts & sets', s: 'dicts-sets', q: 'What does this print?', run: true, expect: 'None 0 True', code: `d = {"a": 1}
print(d.get("b"), d.get("b", 0), "a" in d)`, o: ['KeyError', 'None 0 True', '0 0 True', 'None None True'], a: 1, x: '<code>d["b"]</code> would raise <code>KeyError</code>; <code>.get</code> returns <code>None</code> or the default you pass. <code>in</code> checks keys, not values.' },
    { t: 'Dicts & sets', s: 'dicts-sets', q: 'What does this print?', run: true, expect: 'dict {1, 2, 3} {2, 3}', code: `print(type({}).__name__, {1, 2} | {2, 3}, {1, 2, 3} & {2, 3, 4})`, o: ['set {1, 2, 3} {2, 3}', 'dict {1, 2, 2, 3} {2, 3}', 'dict {1, 2, 3} {2, 3}', 'dict {1, 3} {1, 4}'], a: 2, x: '<code>{}</code> is an empty <b>dict</b>; an empty set is <code>set()</code>. <code>|</code> is union and <code>&amp;</code> is intersection. (Small ints happen to print in order; in general do not rely on set order.)' },
    { t: 'Dicts & sets', s: 'dicts-sets', q: 'What does this print?', run: true, expect: "{1: 'c'}", code: `d = {1: "a", 1.0: "b", True: "c"}
print(d)`, o: ["{1: 'a', 1.0: 'b', True: 'c'}", "{1: 'c'}", "{True: 'c'}", "{1: 'a'}"], a: 1, x: '<code>1 == 1.0 == True</code> and they hash the same, so they are one key. The first key object is kept (<code>1</code>) and the last value wins (<code>"c"</code>).' },
    // ---------- B8 Functions ----------
    { t: 'Functions', s: 'functions-basics', q: 'What does this print?', run: true, expect: '[1]\n[1, 2]', code: `def add(x, items=[]):
    items.append(x)
    return items

print(add(1))
print(add(2))`, o: ['[1]\n[2]', '[1]\n[1, 2]', '[1, 2]\n[1, 2]', 'TypeError'], a: 1, x: 'The default value is created <b>once</b>, when <code>def</code> runs, and shared by every call. Use <code>items=None</code> and create the list inside.' },
    { t: 'Functions', s: 'functions-basics', q: 'What does this print?', run: true, expect: "1 (2, 3) {'x': 4}", code: `def f(a, *args, **kwargs):
    print(a, args, kwargs)

f(1, 2, 3, x=4)`, o: ["1 [2, 3] {'x': 4}", "1 (2, 3) {'x': 4}", "1 (2, 3, 4) {}", "(1, 2, 3) {'x': 4}"], a: 1, x: 'Extra positional arguments arrive in <code>*args</code> as a <b>tuple</b>; extra keyword arguments arrive in <code>**kwargs</code> as a dict.' },
    { t: 'Functions', s: 'functions-basics', q: 'What does this print?', run: true, expect: 'None 16', code: `def f():
    x = 1

sq = lambda n: n * n
print(f(), sq(4))`, o: ['1 16', 'None 16', 'None None', 'SyntaxError'], a: 1, x: 'A function without <code>return</code> returns <code>None</code>. A <code>lambda</code> is a one-expression function whose value is returned automatically.' },
    // ---------- B9 Comprehensions ----------
    { t: 'Comprehensions', s: 'comprehensions', q: 'What does this print?', run: true, expect: '[0, 4, 16] [0, 0, 2, 3]', code: `print([x * x for x in range(5) if x % 2 == 0],
      [x if x > 1 else 0 for x in range(4)])`, o: ['[0, 4, 16] [2, 3]', '[4, 16] [0, 0, 2, 3]', '[0, 4, 16] [0, 0, 2, 3]', '[0, 1, 4, 9, 16] [0, 0, 2, 3]'], a: 2, x: 'An <code>if</code> at the <b>end</b> filters items out. An <code>a if c else b</code> at the <b>front</b> keeps every item and picks a value for each.' },
    { t: 'Comprehensions', s: 'comprehensions', q: 'What does this print?', run: true, expect: '3 0', code: `g = (x for x in range(3))
print(sum(g), sum(g))`, o: ['3 3', '3 0', '0 0', 'TypeError'], a: 1, x: 'Parentheses make a <b>generator</b>, which can be consumed once. The second <code>sum</code> sees an exhausted generator. Use a list if you need it twice.' },
    // ---------- B10 Classes ----------
    { t: 'Classes', s: 'classes-basics', q: 'What does this print?', run: true, expect: "['sit']", code: `class Dog:
    tricks = []

    def __init__(self, name):
        self.name = name

    def add(self, trick):
        self.tricks.append(trick)

a = Dog("a")
b = Dog("b")
a.add("sit")
print(b.tricks)`, o: ['[]', "['sit']", 'AttributeError', 'None'], a: 1, x: 'An attribute in the class body is a <b>class</b> attribute, shared by all instances (like a Java <code>static</code> field). Create per-object lists in <code>__init__</code>: <code>self.tricks = []</code>.' },
    { t: 'Classes', s: 'classes-basics', q: 'What does this print?', run: true, expect: '1 2 True', code: `class A:
    def __init__(self):
        self.x = 1

class B(A):
    def __init__(self):
        super().__init__()
        self.y = 2

b = B()
print(b.x, b.y, isinstance(b, A))`, o: ['AttributeError', '1 2 False', '1 2 True', 'None 2 True'], a: 2, x: 'Python does not call the parent’s <code>__init__</code> automatically when the child defines its own; <code>super().__init__()</code> does it. Without that line, <code>b.x</code> would raise <code>AttributeError</code>.' },
    // ---------- B11 Errors & exceptions ----------
    { t: 'Exceptions', s: 'exceptions-basics', q: 'What does this print?', run: true, expect: 'try\nfinally\n1', code: `def f():
    try:
        print("try")
        return 1
    finally:
        print("finally")

print(f())`, o: ['try\n1', 'try\n1\nfinally', 'try\nfinally\n1', 'finally\ntry\n1'], a: 2, x: '<code>finally</code> runs on the way out, even after <code>return</code>. The return value is already decided, so <code>1</code> is printed after <code>finally</code> has run.' },
    { t: 'Exceptions', s: 'exceptions-basics', q: 'What does this print?', run: true, expect: 'bad\ndone', code: `try:
    n = int("x")
except ValueError:
    print("bad")
else:
    print("ok")
finally:
    print("done")`, o: ['bad\nok\ndone', 'bad\ndone', 'ok\ndone', 'bad'], a: 1, x: '<code>else</code> runs only if the <code>try</code> block raised nothing; <code>finally</code> always runs. <code>int("x")</code> raises <code>ValueError</code>.' },
    // ---------- B12 Files, modules & stdlib ----------
    { t: 'Files & modules', s: 'files-modules-stdlib', q: '<code>report.txt</code> has 100 lines. You run <code>f = open("report.txt", "w")</code> and the program crashes before writing anything. What is in the file?', o: ['The original 100 lines', 'Nothing: mode "w" truncates the file as soon as it is opened', 'A partial line', 'A lock marker'], a: 1, x: '<code>"w"</code> empties the file immediately. Use <code>"a"</code> to append, <code>"x"</code> to fail if it exists, or write to a temp file and rename. And use <code>with open(...)</code> so the file is closed.' },
    { t: 'Files & modules', s: 'files-modules-stdlib', q: 'Your script is called <code>json.py</code> and it does <code>import json; json.dumps({})</code>. What happens?', o: ['It works: the stdlib always wins', 'Your own json.py is imported instead (the script’s folder is searched first), so dumps is missing: AttributeError', 'ImportError: circular import is not allowed', 'Python renames your file'], a: 1, x: 'The script’s directory is first on <code>sys.path</code>, so it shadows stdlib modules. Never name files <code>json.py</code>, <code>random.py</code>, <code>csv.py</code> and so on.' }
  ];
  /*Q-END*/
  /*Q-END*/
  const TOPICS = ['All', ...[...new Set(Q.map((q) => q.t))]];
  const slugOf = {}; Q.forEach((q) => { slugOf[q.t] = q.s; });
  if (!document.getElementById('w-tpb-style')) {
    document.head.append(el('style', { id: 'w-tpb-style', text: `
.w-tpb-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tpb-bar div { height: 100%; background: var(--accent); }
.w-tpb-bar div.low { background: var(--err); }
.w-tpb-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tpb-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; white-space: pre-line; }
.w-tpb-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tpb-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tpb-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tpb-opts button:disabled { cursor: default; }
.w-tpb-q { font-size: 16px; margin: 6px 0 8px; }
.w-tpb-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tpb-rev:first-child { border-top: 0; }
` }));
  }
  let topic = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segT = seg(TOPICS.map((t) => [t, t]), () => topic, (v) => { topic = v; reset(); }, 'Topic');
  const segN = seg([[10, '10 questions'], [20, '20'], [30, 'all 30']], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-tpb-bar' }, bar);
    const opts = el('div', { class: 'w-tpb-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), q.run ? el('span', { class: 'pill', text: 'Python 3.12' }) : null, el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tpb-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, 'python'));
    q.o.forEach((o, j) => { const b = el('button', { html: `<b>${'ABCD'[j]}.</b> ${ctx.esc(o)}` }); b.addEventListener('click', () => answer(j)); opts.append(b); });
    card.append(opts);
    const paint = () => { bar.style.width = (left / secs) * 100 + '%'; bar.className = left <= 10 ? 'low' : ''; if (!reduced) bar.style.transition = 'width 1s linear'; };
    paint(); renderStats(); say('Pick an answer before the bar runs out. Skip counts as a miss.');
    stopTimer(); const g = gen;
    tick = setInterval(() => { if (g !== gen || answered) { stopTimer(); return; } left--; paint(); renderStats(); if (left <= 0) answer(-1); }, 1000);
    card.opts = opts;
  }
  function answer(j) {
    if (answered || !started) return; answered = true; stopTimer();
    const q = deck[i]; const ok = j === q.a;
    if (ok) score++; else misses.push({ q, j });
    [...card.opts.children].forEach((b, m) => { b.disabled = true; if (m === q.a) b.classList.add('ok'); else if (m === j) b.classList.add('bad'); });
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x + (q.run ? `<div class="tiny" style="margin-top:6px">Exact output (Python 3.12): <code>${ctx.esc(q.expect).replace(/\n/g, ' ⏎ ')}</code></div>` : '') + `<div class="tiny" style="margin-top:6px">Topic: <a href="${q.s}.html">${ctx.esc(q.t)}</a></div>` }));
    bStep.textContent = i + 1 < deck.length ? 'Next ›' : 'Finish ›'; renderStats();
    say(ok ? 'Correct. Press Next.' : 'Read the explanation, then press Next.');
  }
  function next() {
    if (!started) return;
    if (!answered) { answer(-2); return; }
    i++; bStep.textContent = 'Skip ›';
    if (i >= deck.length) return finish();
    show();
  }
  function finish() {
    started = false; stopTimer(); bStep.disabled = true; bPlay.textContent = '▶ Again'; card.innerHTML = '';
    const by = {}; deck.forEach((q) => { by[q.t] = by[q.t] || [0, 0]; by[q.t][1]++; }); deck.forEach((q) => { if (!misses.some((m) => m.q === q)) by[q.t][0]++; });
    card.append(el('h3', { text: `Score: ${score} / ${deck.length}`, style: { margin: '0 0 8px' } }),
      el('div', { class: 'w-stats' }, Object.entries(by).map(([t, [a, n]]) => el('span', { class: 'w-stat', html: `<a href="${slugOf[t]}.html">${t}</a> <b>${a}/${n}</b>` }))));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tpb-rev' }, el('div', { html: `<span class="pill">${q.t}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, 'python'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : ctx.esc(q.o[j])} · Correct: <b>${ctx.esc(q.o[q.a])}</b>` }), el('div', { class: 'pz-exp', html: q.x + ` <a href="${q.s}.html">Review the topic →</a>` }));
        card.append(r); });
    } else card.append(el('p', { text: 'No misses. Try “all 30” on Fast.' }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above with explanations.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => topic === 'All' || q.t === topic); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${topic === 'All' ? 'all topics' : topic}), <b>${secs} s</b> each. No running code: predict the result in your head, like in an interview.`, style: { margin: 0 } }));
    renderStats(); say('Choose a topic, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});
