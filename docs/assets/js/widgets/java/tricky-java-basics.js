/* Java Basics drill: 30 timed beginner questions across the 8 Basics topics. Programs marked run: true are single-file `public class Main` programs; `expect` is their exact stdout on JDK 21. */
IA.widget('tricky-java-basics', (root, ctx) => {
  const { el, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- B1 Running Java ----------
    { t: 'Running Java', s: 'java-setup-first-program', q: 'A file named <code>Hello.java</code> contains <code>public class Main { … }</code>. What does <code>javac Hello.java</code> do?', o: ['Compiles to Hello.class', 'Compiles to Main.class with a warning', 'Compile error: a public class must be declared in a file named Main.java', 'Compiles, but java Hello fails'], a: 2, x: 'A <code>public</code> top-level class must live in a file with the same name. Rename the file or the class.' },
    { t: 'Running Java', s: 'java-setup-first-program', q: 'On JDK 11+, what does <code>java Main.java</code> (no javac first) do?', o: ['Error: java only runs .class files', 'Compiles the single source file in memory and runs it', 'Opens JShell', 'Writes Main.class next to the source, then runs it'], a: 1, x: 'Since JDK 11, <code>java Main.java</code> compiles in memory and runs <code>main</code>. No <code>.class</code> file is written. Larger projects still use <code>javac</code> or a build tool.' },
    { t: 'Running Java', s: 'java-setup-first-program', q: 'What does this print?', run: true, expect: 'ab\nc', code: `public class Main {
    public static void main(String[] args) {
        System.out.print("a");
        System.out.println("b");
        System.out.print("c");
    }
}`, o: ['a\nb\nc', 'ab\nc', 'abc', 'a b\nc'], a: 1, x: '<code>print</code> writes without a newline; <code>println</code> adds one after its text.' },
    // ---------- B2 Variables & primitive types ----------
    { t: 'Types & variables', s: 'java-types-variables', q: 'What does this print?', run: true, expect: '-2147483648\n-2147483648', code: `public class Main {
    public static void main(String[] args) {
        int x = Integer.MAX_VALUE;
        x++;
        System.out.println(x);
        long l = Integer.MAX_VALUE + 1;
        System.out.println(l);
    }
}`, o: ['2147483648\n2147483648', '-2147483648\n2147483648', '-2147483648\n-2147483648', 'ArithmeticException'], a: 2, x: 'An <code>int</code> that overflows wraps around without warning. On the second line, the sum is done in <code>int</code> (and wraps) <b>before</b> it becomes a <code>long</code>. Write <code>Integer.MAX_VALUE + 1L</code>, or use <code>Math.addExact</code> to get an exception.' },
    { t: 'Types & variables', s: 'java-types-variables', q: 'What does this print?', run: true, expect: 'true false true', code: `public class Main {
    public static void main(String[] args) {
        Integer a = 127, b = 127, c = 128, d = 128;
        System.out.println((a == b) + " " + (c == d) + " " + c.equals(d));
    }
}`, o: ['true true true', 'true false true', 'false false true', 'true false false'], a: 1, x: '<code>==</code> on wrappers asks “same object?”. Values −128..127 are cached, so 127 gives the same object. 128 (by default) does not. Compare values with <code>equals</code>.' },
    { t: 'Types & variables', s: 'java-types-variables', q: 'What does this print?', run: true, expect: '3.0 3.5 3', code: `public class Main {
    public static void main(String[] args) {
        double d = 7 / 2;
        System.out.println(d + " " + 7 / 2.0 + " " + (int) 3.99);
    }
}`, o: ['3.5 3.5 4', '3.0 3.5 3', '3.5 3.5 3', '3 3.5 3'], a: 1, x: '<code>7 / 2</code> is whole-number division (3). Only then does it become <code>3.0</code>. Make one side a double to get 3.5. A cast to <code>int</code> cuts off the decimals.' },
    { t: 'Types & variables', s: 'java-types-variables', q: 'What happens?', code: 'Integer n = null;\nint m = n;', o: ['m is 0', 'Compile error', 'NullPointerException at runtime when n is unboxed', 'm is null'], a: 2, x: 'Turning an <code>Integer</code> into an <code>int</code> calls <code>n.intValue()</code>, which throws a <code>NullPointerException</code>. It compiles fine. Common with <code>map.get(key)</code> stored in an <code>int</code>.' },
    // ---------- B3 Operators & control flow ----------
    { t: 'Operators & control flow', s: 'java-operators-control-flow', q: 'What does this print?', run: true, expect: '1 -3 -1', code: `public class Main {
    public static void main(String[] args) {
        System.out.println(7 % 3 + " " + (-7 / 2) + " " + (-7 % 3));
    }
}`, o: ['1 -4 2', '1 -3 -1', '1 -3 2', '1 -4 -1'], a: 1, x: 'Java integer division rounds toward zero (−3.5 → −3). <code>%</code> takes the sign of the left side. Python’s <code>//</code> and <code>%</code> differ (−4 and 2).' },
    { t: 'Operators & control flow', s: 'java-operators-control-flow', q: 'What does this print?', run: true, expect: 'one two', code: `public class Main {
    public static void main(String[] args) {
        int k = 1;
        switch (k) {
            case 1: System.out.print("one ");
            case 2: System.out.print("two ");
                break;
            case 3: System.out.print("three ");
        }
        System.out.println();
    }
}`, o: ['one', 'one two', 'one two three', 'Compile error: missing break'], a: 1, x: 'A colon-style <code>case</code> falls through into the next one until a <code>break</code>. Arrow cases (<code>case 1 -&gt;</code>) never fall through.' },
    { t: 'Operators & control flow', s: 'java-operators-control-flow', q: 'What does this print? (Java 14+)', run: true, expect: 'weekend', code: `public class Main {
    public static void main(String[] args) {
        String day = "SAT";
        String type = switch (day) {
            case "SAT", "SUN" -> "weekend";
            default -> "weekday";
        };
        System.out.println(type);
    }
}`, o: ['weekend', 'weekday', 'weekend\nweekday', 'Compile error: switch cannot return a value'], a: 0, x: 'A switch <b>expression</b> (standard since Java 14) gives back a value. It allows several labels per case. With <code>-&gt;</code> it never falls through.' },
    { t: 'Operators & control flow', s: 'java-operators-control-flow', q: 'What does this print?', run: true, expect: '12 6', code: `public class Main {
    public static void main(String[] args) {
        int x = 10;
        x += 2.7;
        int i = 5;
        do {
            i++;
        } while (i < 3);
        System.out.println(x + " " + i);
    }
}`, o: ['12 5', '12 6', '12.7 6', 'Compile error: lossy conversion'], a: 1, x: '<code>+=</code> hides a cast: <code>x = (int) (x + 2.7)</code>, so 12. (<code>x = x + 2.7</code> would not compile.) A <code>do/while</code> body always runs at least once.' },
    // ---------- B4 Arrays & strings ----------
    { t: 'Arrays & strings', s: 'java-arrays-strings-basics', q: 'What does this print?', run: true, expect: 'hi 3345', code: `public class Main {
    public static void main(String[] args) {
        String s = "hi";
        s.toUpperCase();
        System.out.println(s + " " + (1 + 2 + "3" + 4 + 5));
    }
}`, o: ['HI 3345', 'hi 15', 'hi 3345', 'hi 12345'], a: 2, x: 'Strings never change. <code>toUpperCase()</code> returns a new string, which is ignored here. <code>+</code> runs left to right: 1 + 2 is 3, then joining strings takes over: "33", "334", "3345".' },
    { t: 'Arrays & strings', s: 'java-arrays-strings-basics', q: 'What does this print?', run: true, expect: 'false true', code: `public class Main {
    public static void main(String[] args) {
        String a = "java";
        String b = new String("java");
        System.out.println((a == b) + " " + a.equals(b));
    }
}`, o: ['true true', 'false true', 'false false', 'true false'], a: 1, x: '<code>new String</code> always creates a new object, so <code>==</code> (same reference?) is false. Compare text with <code>equals</code>.' },
    { t: 'Arrays & strings', s: 'java-arrays-strings-basics', q: 'What does this print?', run: true, expect: '3 0 [0, 0, 0]', code: `import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int[] arr = new int[3];
        System.out.println(arr.length + " " + arr[0] + " " + Arrays.toString(arr));
    }
}`, o: ['3 null [0, 0, 0]', '3 0 [0, 0, 0]', '2 0 [0, 0, 0]', 'Compile error: arr[0] not initialised'], a: 1, x: 'New arrays start filled with defaults (0, false, null). <code>length</code> is a field, not a method. Printing an array gives something like <code>[I@1b6d3586</code>. Use <code>Arrays.toString</code>.' },
    { t: 'Arrays & strings', s: 'java-arrays-strings-basics', q: 'What does this print?', run: true, expect: '2 3', code: `public class Main {
    public static void main(String[] args) {
        System.out.println("a,b,,".split(",").length + " " + "a,,b".split(",").length);
    }
}`, o: ['4 3', '2 3', '2 2', '3 3'], a: 1, x: '<code>split</code> drops <b>trailing</b> empty strings but keeps empty ones in the middle. Use <code>split(",", -1)</code> to keep them all.' },
    // ---------- B5 Methods ----------
    { t: 'Methods', s: 'java-methods', q: 'What does this print?', run: true, expect: '1 hi!', code: `public class Main {
    static void inc(int n) { n++; }
    static void add(StringBuilder sb) { sb.append("!"); }

    public static void main(String[] args) {
        int x = 1;
        inc(x);
        StringBuilder sb = new StringBuilder("hi");
        add(sb);
        System.out.println(x + " " + sb);
    }
}`, o: ['2 hi!', '1 hi', '1 hi!', '2 hi'], a: 2, x: 'Java always passes a copy. The method gets a copy of <code>x</code>, so the caller’s int doesn’t change. For an object, the copy is an address pointing to it (a <b>reference</b>). So changes to the object itself are visible.' },
    { t: 'Methods', s: 'java-methods', q: 'Which overloads are chosen?', run: true, expect: 'int long Object', code: `public class Main {
    static String f(int x) { return "int"; }
    static String f(long x) { return "long"; }
    static String f(Object o) { return "Object"; }

    public static void main(String[] args) {
        System.out.println(f(5) + " " + f(5L) + " " + f(Integer.valueOf(5)));
    }
}`, o: ['int long int', 'int long Object', 'int int Object', 'Compile error: ambiguous'], a: 1, x: 'The compiler picks the method version at compile time, from the <b>declared</b> argument types. An <code>Integer</code> matches <code>Object</code> directly. So turning it into an <code>int</code> is never tried.' },
    { t: 'Methods', s: 'java-methods', q: 'What does this print?', run: true, expect: '0 6 9', code: `public class Main {
    static int sum(int... nums) {
        int s = 0;
        for (int n : nums) s += n;
        return s;
    }

    public static void main(String[] args) {
        System.out.println(sum() + " " + sum(1, 2, 3) + " " + sum(new int[] {4, 5}));
    }
}`, o: ['Compile error: sum() needs an argument', '0 6 9', '0 6 45', 'NullPointerException'], a: 1, x: 'Varargs (<code>...</code>) is an array parameter. Zero arguments give an empty array, not null. You can also pass an array directly.' },
    { t: 'Methods', s: 'java-methods', q: 'In <code>Main</code>, <code>void greet() { … }</code> is called from <code>public static void main</code> as <code>greet();</code>. Result?', o: ['It works', 'Compile error: non-static method greet() cannot be referenced from a static context', 'NullPointerException', 'It runs on a default Main instance'], a: 1, x: '<code>main</code> is static, so there is no <code>this</code>. Make <code>greet</code> static, or create an object: <code>new Main().greet()</code>.' },
    // ---------- B6 Classes & objects ----------
    { t: 'Classes & objects', s: 'java-classes-objects', q: 'What does this print?', run: true, expect: 'null', code: `public class Main {
    static class Person {
        String name;
        Person(String name) {
            name = name;
        }
    }

    public static void main(String[] args) {
        System.out.println(new Person("Ada").name);
    }
}`, o: ['Ada', 'null', 'Compile error', 'an empty line'], a: 1, x: 'Inside the constructor, <code>name</code> means the parameter. So the line sets the parameter to itself. The field keeps its default, <code>null</code>. Write <code>this.name = name</code>.' },
    { t: 'Classes & objects', s: 'java-classes-objects', q: 'What does this print?', run: true, expect: '1 2 2', code: `public class Main {
    static class Counter {
        static int count;
        int id;
        Counter() {
            count++;
            id = count;
        }
    }

    public static void main(String[] args) {
        Counter a = new Counter();
        Counter b = new Counter();
        System.out.println(a.id + " " + b.id + " " + Counter.count);
    }
}`, o: ['1 1 1', '1 2 2', '2 2 2', '1 2 1'], a: 1, x: 'A <code>static</code> field belongs to the class: one copy shared by all objects. An instance field is per object.' },
    { t: 'Classes & objects', s: 'java-classes-objects', q: 'Class <code>Point</code> declares only <code>Point(int x, int y)</code>. Another class writes <code>new Point()</code>. Result?', o: ['A point at (0, 0)', 'Compile error: the default no-arg constructor is only generated when a class declares no constructors', 'NullPointerException', 'A point with null fields'], a: 1, x: 'Once you write any constructor, Java no longer adds the implicit no-arg one. Add <code>Point() { this(0, 0); }</code> if you need it.' },
    { t: 'Classes & objects', s: 'java-classes-objects', q: 'A field has <b>no</b> access modifier. Who can access it?', o: ['Everyone', 'Only the class itself', 'Classes in the same package', 'Subclasses only'], a: 2, x: 'No modifier means package-private: the same package only. <code>private</code> is the class only; <code>protected</code> adds subclasses; <code>public</code> is everyone.' },
    // ---------- B7 Inheritance & interfaces ----------
    { t: 'Inheritance & interfaces', s: 'java-inheritance-interfaces', q: 'What does this print?', run: true, expect: 'woof', code: `public class Main {
    static class Animal {
        String sound() { return "..."; }
    }
    static class Dog extends Animal {
        @Override
        String sound() { return "woof"; }
    }

    public static void main(String[] args) {
        Animal a = new Dog();
        System.out.println(a.sound());
    }
}`, o: ['...', 'woof', 'Compile error: Animal has no Dog methods', 'ClassCastException'], a: 1, x: 'Overridden methods are picked at runtime from the <b>object’s</b> class, not the variable’s type. That is <i>polymorphism</i>.' },
    { t: 'Inheritance & interfaces', s: 'java-inheritance-interfaces', q: 'What does this print?', run: true, expect: 'A B', code: `public class Main {
    static class A {
        String name = "A";
        String get() { return name; }
    }
    static class B extends A {
        String name = "B";
        @Override
        String get() { return name; }
    }

    public static void main(String[] args) {
        A x = new B();
        System.out.println(x.name + " " + x.get());
    }
}`, o: ['B B', 'A A', 'A B', 'B A'], a: 2, x: 'Fields are <b>not</b> polymorphic: <code>x.name</code> uses the declared type <code>A</code>. Methods are: <code>x.get()</code> runs <code>B.get()</code>. Keep fields private and expose methods.' },
    { t: 'Inheritance & interfaces', s: 'java-inheritance-interfaces', q: 'What does this print?', run: true, expect: 'AB', code: `public class Main {
    static class A {
        A() { System.out.print("A"); }
    }
    static class B extends A {
        B() { System.out.print("B"); }
    }

    public static void main(String[] args) {
        new B();
        System.out.println();
    }
}`, o: ['B', 'BA', 'AB', 'A'], a: 2, x: 'Every constructor first calls a parent constructor. If you write none, the compiler adds <code>super()</code>. So the parent part is built first.' },
    { t: 'Inheritance & interfaces', s: 'java-inheritance-interfaces', q: 'Class <code>C</code> implements interfaces <code>X</code> and <code>Y</code>, and both declare <code>default String hi()</code>. <code>C</code> does not override <code>hi</code>. Result?', o: ['X’s version wins (listed first)', 'Y’s version wins (listed last)', 'Compile error: C must override hi() to resolve the conflict', 'Runtime error when hi() is called'], a: 2, x: 'With two conflicting defaults, the class must override the method. It can delegate with <code>X.super.hi()</code>.' },
    // ---------- B8 Collections ----------
    { t: 'Collections', s: 'java-collections-basics', q: 'What does this print?', run: true, expect: 'UOE', code: `import java.util.List;

public class Main {
    public static void main(String[] args) {
        try {
            List<Integer> nums = List.of(1, 2);
            nums.add(3);
            System.out.println(nums);
        } catch (UnsupportedOperationException e) {
            System.out.println("UOE");
        }
    }
}`, o: ['[1, 2, 3]', '[1, 2]', 'UOE', 'Compile error'], a: 2, x: '<code>List.of</code> (Java 9+) returns a list you <b>can’t change</b>. <code>add</code> compiles but throws at runtime. Need to change it? Wrap it: <code>new ArrayList&lt;&gt;(List.of(…))</code>.' },
    { t: 'Collections', s: 'java-collections-basics', q: 'What does this print?', run: true, expect: '[30]', code: `import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<Integer> list = new ArrayList<>(List.of(10, 20, 30));
        list.remove(1);
        list.remove(Integer.valueOf(10));
        System.out.println(list);
    }
}`, o: ['[20, 30]', '[30]', '[10, 30]', 'IndexOutOfBoundsException'], a: 1, x: '<code>remove(1)</code> with an <code>int</code> removes by <b>index</b> (the 20). <code>remove(Integer.valueOf(10))</code> removes by <b>value</b>.' },
    { t: 'Collections', s: 'java-collections-basics', q: 'What does this print?', run: true, expect: '1 2 null 0', code: `import java.util.HashMap;
import java.util.Map;

public class Main {
    public static void main(String[] args) {
        Map<String, Integer> m = new HashMap<>();
        m.put("a", 1);
        m.put("a", 2);
        System.out.println(m.size() + " " + m.get("a") + " " + m.get("z") + " " + m.getOrDefault("z", 0));
    }
}`, o: ['2 1 null 0', '1 2 null 0', '1 2 0 0', '1 1 null 0'], a: 1, x: 'Keys are unique: a second <code>put</code> replaces the value. <code>get</code> on a missing key returns <code>null</code> (careful when storing it in an <code>int</code>). <code>getOrDefault</code> avoids that.' }
  ];
  /*Q-END*/
  /*Q-END*/
  const TOPICS = ['All', ...[...new Set(Q.map((q) => q.t))]];
  const slugOf = {}; Q.forEach((q) => { slugOf[q.t] = q.s; });
  if (!document.getElementById('w-tjb-style')) {
    document.head.append(el('style', { id: 'w-tjb-style', text: `
.w-tjb-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tjb-bar div { height: 100%; background: var(--accent); }
.w-tjb-bar div.low { background: var(--err); }
.w-tjb-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tjb-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; white-space: pre-line; }
.w-tjb-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tjb-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tjb-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tjb-opts button:disabled { cursor: default; }
.w-tjb-q { font-size: 16px; margin: 6px 0 8px; }
.w-tjb-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tjb-rev:first-child { border-top: 0; }
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
    const bar = el('div'); const barWrap = el('div', { class: 'w-tjb-bar' }, bar);
    const opts = el('div', { class: 'w-tjb-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), q.run ? el('span', { class: 'pill', text: 'JDK 21' }) : null, el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tjb-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, 'java'));
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
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x + (q.run ? `<div class="tiny" style="margin-top:6px">Exact output (JDK 21): <code>${ctx.esc(q.expect).replace(/\n/g, ' ⏎ ')}</code></div>` : '') + `<div class="tiny" style="margin-top:6px">Topic: <a href="${q.s}.html">${ctx.esc(q.t)}</a></div>` }));
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
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tjb-rev' }, el('div', { html: `<span class="pill">${q.t}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, 'java'));
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
