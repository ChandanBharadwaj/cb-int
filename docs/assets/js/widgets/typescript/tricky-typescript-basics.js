/* TypeScript basics drill: a timed drill of 30 beginner interview questions across the 6 Basics topics. Misses link back to the topic pages. */
IA.widget('tricky-typescript-basics', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- Why TS & setup ----------
    { t: 'Why TS & setup', s: 'ts-why-setup', q: 'A function is typed <code>(n: number)</code> and compiled with tsc. At runtime someone calls it with <code>"5"</code> from plain JS. What happens?', o: ['TypeError at runtime', 'It runs with the string: types are erased and nothing checks them at runtime', 'tsc inserted a check that converts it', 'It returns undefined'], a: 1, x: 'TypeScript checks at compile time only. The output is plain JS with the types removed. Validate untrusted data at runtime.' },
    { t: 'Why TS & setup', s: 'ts-why-setup', q: 'What does this print when run with Node’s type stripping?', code: "const add = (a: number, b: number): number => a + b;\nconst x: any = '2';\nconsole.log(add(x, 3));", run: true, expect: '23', o: ['5', '23', 'TypeError', 'NaN'], a: 1, x: '<code>any</code> switches the checker off, and the types vanish at runtime, so <code>\'2\' + 3</code> is string concatenation: <code>"23"</code>.' },
    { t: 'Why TS & setup', s: 'ts-why-setup', q: 'tsc reports a type error, but <code>noEmitOnError</code> is off (the default). What happens to the .js output?', o: ['No JS is written', 'JS is still written', 'Only a .d.ts is written', 'The broken lines are removed'], a: 1, x: 'Type errors do not stop emit by default. Fail CI on <code>tsc --noEmit</code> instead of trusting that JS was produced.' },
    { t: 'Why TS & setup', s: 'ts-why-setup', q: 'What does <code>node --experimental-strip-types app.ts</code> (Node 22.6+) do with your types?', o: ['Type-checks them', 'Removes them and runs the JS, without type-checking', 'Converts them to JSDoc', 'Ignores the file'], a: 1, x: 'Type stripping only deletes erasable syntax. It does not check types and does not support enums or namespaces. Run <code>tsc --noEmit</code> to check.' },
    { t: 'Why TS & setup', s: 'ts-why-setup', q: 'Which file holds the compiler options of a TypeScript project?', o: ['package.json', 'tsconfig.json', '.tsrc', 'types.d.ts'], a: 1, x: '<code>tsconfig.json</code> sets <code>strict</code>, <code>target</code>, <code>module</code> and which files belong to the project. <code>tsc --init</code> creates one.' },
    // ---------- Basic types ----------
    { t: 'Basic types', s: 'ts-basic-types', q: 'What is the inferred type of <code>x</code> and of <code>y</code>?', code: "let x = 'hi';\nconst y = 'hi';", o: ['string and string', 'string and "hi"', '"hi" and "hi"', 'any and string'], a: 1, x: '<code>let</code> can be re-assigned, so its literal type <b>widens</b> to <code>string</code>. A <code>const</code> keeps the literal type <code>"hi"</code>.' },
    { t: 'Basic types', s: 'ts-basic-types', q: 'Which line is a compile error?', code: "const a: unknown = JSON.parse('1');\nconst b: any = JSON.parse('1');\nb.toFixed();   // line 3\na.toFixed();   // line 4", o: ['line 3', 'line 4', 'both', 'neither'], a: 1, x: '<code>any</code> allows anything. <code>unknown</code> allows nothing until you narrow it (e.g. <code>typeof a === \'number\'</code>). Prefer <code>unknown</code> for untrusted data.' },
    { t: 'Basic types', s: 'ts-basic-types', q: 'What does this print?', code: "const pair: [string, number] = ['age', 30];\nconst [label, value] = pair;\nconsole.log(label, value + 1, pair.length);", run: true, expect: 'age 31 2', o: ['age 31 2', 'age 301 2', 'age 31 undefined', 'compile error'], a: 0, x: 'A tuple is an array with a fixed length and a type per position. At runtime it is a normal array.' },
    { t: 'Basic types', s: 'ts-basic-types', q: 'What does this print?', code: "const ids: number[] = [3, 1, 10];\nids.sort();\nconsole.log(ids.join(','));", run: true, expect: '1,10,3', o: ['1,3,10', '1,10,3', '10,3,1', 'compile error'], a: 1, x: 'The type <code>number[]</code> does not change JavaScript: <code>sort()</code> without a compare function sorts as strings. Use <code>sort((a, b) =&gt; a - b)</code>.' },
    { t: 'Basic types', s: 'ts-basic-types', q: 'What is the type of <code>arr</code>?', code: "const arr = [1, 'a'];", o: ['[number, string]', '(string | number)[]', 'any[]', 'unknown[]'], a: 1, x: 'TypeScript infers an array of the union of the element types, not a tuple. Write <code>as const</code> or annotate a tuple type to get <code>[number, string]</code>.' },
    // ---------- Functions ----------
    { t: 'Functions', s: 'ts-functions', q: 'What does this print?', code: "function greet(name: string, greeting: string = 'Hello', mark?: string): string {\n  return greeting + ', ' + name + (mark ?? '.');\n}\nconsole.log(greet('Ann'));\nconsole.log(greet('Bob', 'Hi', '!'));", run: true, expect: 'Hello, Ann.\nHi, Bob!', o: ['Hello, Ann.undefined / Hi, Bob!', 'Hello, Ann. / Hi, Bob!', 'compile error: mark is required', 'Hello, Ann / Hi, Bob!'], a: 1, x: 'A default value makes a parameter optional; <code>mark?</code> is <code>undefined</code> when left out, and <code>??</code> supplies the fallback.' },
    { t: 'Functions', s: 'ts-functions', q: 'What is the difference between return types <code>void</code> and <code>never</code>?', o: ['None', 'void: returns normally with no useful value; never: does not return at all (throws or loops forever)', 'never means it returns null', 'void is only for async functions'], a: 1, x: 'A function that always throws, like <code>fail(msg): never</code>, returns <code>never</code>. Narrowing also leaves <code>never</code> when no case is left.' },
    { t: 'Functions', s: 'ts-functions', q: 'Is this a compile error?', code: "function f(a: string, b?: string, c: string) {}", o: ['No', 'Yes: a required parameter cannot follow an optional one', 'Only in strict mode', 'Only when called'], a: 1, x: 'Optional parameters must come last. Reorder them, or give <code>b</code> a default value instead.' },
    { t: 'Functions', s: 'ts-functions', q: 'What does this print?', code: "function len(x: string): number;\nfunction len(x: unknown[]): number;\nfunction len(x: string | unknown[]): number {\n  return x.length;\n}\nconsole.log(len('abc') + len([1, 2]));", run: true, expect: '5', o: ['5', '"abc"2', 'compile error', 'NaN'], a: 0, x: 'Overload signatures are type-only and get stripped; only the implementation runs. 3 + 2 = 5.' },
    { t: 'Functions', s: 'ts-functions', q: 'Without an annotation, what return type does TypeScript infer here?', code: "function parse(s: string) {\n  return s ? Number(s) : undefined;\n}", o: ['number', 'number | undefined', 'any', 'unknown'], a: 1, x: 'Return types are inferred from every <code>return</code>. Annotate exported functions so a change in the body cannot silently change the API.' },
    // ---------- Objects & interfaces ----------
    { t: 'Objects & interfaces', s: 'ts-objects-interfaces', q: 'Does this compile?', code: "interface Point { x: number; y: number }\nconst p3 = { x: 1, y: 2, z: 3 };\nconst p: Point = p3;", o: ['Yes: structural typing, p3 has at least x and y', 'No: z is not in Point', 'Only with implements', 'Only with a cast'], a: 0, x: 'Types are compared by shape. The excess-property check only applies to an object <b>literal</b> written directly in the assignment: <code>const p: Point = { x: 1, y: 2, z: 3 }</code> is an error.' },
    { t: 'Objects & interfaces', s: 'ts-objects-interfaces', q: 'What does this print?', code: "interface User { readonly id: number; name: string; nick?: string }\nconst u: User = { id: 1, name: 'Ann' };\nconsole.log(u.nick ?? 'none', 'nick' in u);", run: true, expect: 'none false', o: ['undefined true', 'none false', 'none true', 'compile error'], a: 1, x: 'An optional property may be missing entirely. <code>readonly</code> stops writes at compile time only; it does not freeze the object.' },
    { t: 'Objects & interfaces', s: 'ts-objects-interfaces', q: 'Which can an <code>interface</code> NOT express, but a <code>type</code> alias can?', o: ['An object shape', 'A union like <code>"a" | "b"</code>', 'Optional properties', 'Methods'], a: 1, x: 'Interfaces describe object shapes (and can be merged/extended). Type aliases can name any type: unions, tuples, primitives, mapped types.' },
    { t: 'Objects & interfaces', s: 'ts-objects-interfaces', q: 'What does this print?', code: "const scores: { [name: string]: number } = { ann: 3 };\nscores.bob = 5;\nconsole.log(Object.keys(scores).length, scores.carl);", run: true, expect: '2 undefined', o: ['2 0', '2 undefined', 'compile error on scores.bob', '1 undefined'], a: 1, x: 'An index signature allows any string key. Reading a missing key gives <code>undefined</code> at runtime, though the type says <code>number</code> (turn on <code>noUncheckedIndexedAccess</code>).' },
    { t: 'Objects & interfaces', s: 'ts-objects-interfaces', q: 'Two declarations <code>interface A { x: number }</code> and <code>interface A { y: number }</code> in the same scope. Result?', o: ['Error: duplicate identifier', 'They merge: A has x and y', 'The second replaces the first', 'Only with type aliases'], a: 1, x: 'Interfaces support <b>declaration merging</b>; that is how libraries add to global types. Two <code>type A = …</code> would be an error.' },
    // ---------- Unions & narrowing ----------
    { t: 'Unions & narrowing', s: 'ts-unions-narrowing', q: 'What does this print?', code: "function fmt(v: string | number): string {\n  if (typeof v === 'number') return v.toFixed(1);\n  return v.toUpperCase();\n}\nconsole.log(fmt(2), fmt('ok'));", run: true, expect: '2.0 OK', o: ['2 OK', '2.0 OK', '2.0 ok', 'compile error'], a: 1, x: 'Inside the <code>typeof</code> check, <code>v</code> is narrowed to <code>number</code>; after the early return it is <code>string</code>.' },
    { t: 'Unions & narrowing', s: 'ts-unions-narrowing', q: 'What does this print?', code: "type Shape =\n  | { kind: 'circle'; r: number }\n  | { kind: 'square'; side: number };\nfunction area(s: Shape): number {\n  switch (s.kind) {\n    case 'circle': return Math.round(Math.PI * s.r ** 2);\n    case 'square': return s.side ** 2;\n  }\n}\nconsole.log(area({ kind: 'circle', r: 1 }), area({ kind: 'square', side: 3 }));", run: true, expect: '3 9', o: ['3 9', '3.14 9', 'compile error: s.r may not exist', 'NaN 9'], a: 0, x: 'A <b>discriminated union</b>: checking the shared literal field <code>kind</code> narrows <code>s</code> to one member, so <code>s.r</code> is allowed in that case.' },
    { t: 'Unions & narrowing', s: 'ts-unions-narrowing', q: 'Someone adds <code>{ kind: \'triangle\' }</code> to Shape. How do you make the compiler flag every switch that forgot it?', o: ['Add a default that returns 0', 'In default, assign the value to a variable of type never', 'Use any', 'Use an interface'], a: 1, x: '<code>default: { const _x: never = s; }</code> compiles only while every case is handled. A new member is not <code>never</code>, so it errors.' },
    { t: 'Unions & narrowing', s: 'ts-unions-narrowing', q: 'What does this print?', code: "type Dir = 'up' | 'down';\nfunction move(d: Dir): number { return d === 'up' ? 1 : -1; }\nconst input: string = 'left';\nconsole.log(move(input as Dir));", run: true, expect: '-1', o: ['1', '-1', 'TypeError', 'compile error'], a: 1, x: '<code>as</code> only tells the checker to trust you; nothing is checked at runtime. <code>"left"</code> is not <code>"up"</code>, so -1. Validate input instead of casting.' },
    { t: 'Unions & narrowing', s: 'ts-unions-narrowing', q: 'Which check narrows <code>x: Date | { iso: string }</code> to the object branch?', o: ['typeof x === "object"', '"iso" in x', 'x !== null', 'Array.isArray(x)'], a: 1, x: 'Both members are objects, so <code>typeof</code> does not help. The <code>in</code> operator (or <code>x instanceof Date</code>) separates them.' },
    // ---------- Classes & enums ----------
    { t: 'Classes & enums', s: 'ts-classes', q: 'What does this print?', code: "class Account {\n  private balance = 0;\n  deposit(n: number) { this.balance += n; return this; }\n}\nconst a = new Account().deposit(10);\nconsole.log((a as any).balance);", run: true, expect: '10', o: ['undefined', '10', 'TypeError', '0'], a: 1, x: 'TS <code>private</code> is a compile-time label; the field is a normal property at runtime. Use JS <code>#balance</code> for real runtime privacy.' },
    { t: 'Classes & enums', s: 'ts-classes', q: 'What does this print?', code: "abstract class Shape {\n  abstract area(): number;\n  describe() { return 'area=' + this.area(); }\n}\nclass Sq extends Shape {\n  side: number;\n  constructor(side: number) { super(); this.side = side; }\n  area() { return this.side ** 2; }\n}\nconsole.log(new Sq(4).describe());", run: true, expect: 'area=16', o: ['area=16', 'area=undefined', 'compile error: cannot extend abstract', 'TypeError'], a: 0, x: 'An abstract class cannot be instantiated itself, but subclasses must implement its abstract members. <code>new Shape()</code> would be the error.' },
    { t: 'Classes & enums', s: 'ts-classes', q: 'What does the parameter property <code>constructor(private name: string) {}</code> do?', o: ['Nothing at runtime', 'Declares a private field name and assigns the argument to it', 'Makes name a static field', 'Only types the parameter'], a: 1, x: 'It is shorthand for declaring the field plus <code>this.name = name</code>. Because it generates code, Node’s type stripping does not support it (nor enums).' },
    { t: 'Classes & enums', s: 'ts-classes', q: 'Why do many teams prefer <code>type Status = \'open\' | \'closed\'</code> to <code>enum Status { Open, Closed }</code>?', o: ['Enums are slower to type-check', 'A union of literals is erased (no runtime code), reads as plain strings in JSON, and works with type stripping', 'Enums cannot be used in switch', 'Unions are required by strict mode'], a: 1, x: 'Enums emit a runtime object, and numeric enums accept any number. String literal unions (or an <code>as const</code> object) are simpler.' },
    { t: 'Classes & enums', s: 'ts-classes', q: 'What does this print?', code: "class Temp {\n  #c = 0;\n  get f(): number { return this.#c * 9 / 5 + 32; }\n  set f(v: number) { this.#c = (v - 32) * 5 / 9; }\n}\nconst t = new Temp();\nt.f = 212;\nconsole.log(t.f);", run: true, expect: '212', o: ['100', '212', '32', 'undefined'], a: 1, x: 'The setter stores 100 °C; the getter converts it back to 212 °F. Getters and setters look like properties to callers.' },
  ];
  /*Q-END*/
  const TOPICS = ['All', ...[...new Set(Q.map((q) => q.t))]];
  const slugOf = {}; Q.forEach((q) => { slugOf[q.t] = q.s; });
  if (!document.getElementById('w-tv-style')) {
    document.head.append(el('style', { id: 'w-tv-style', text: `
.w-tv-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tv-bar div { height: 100%; background: var(--accent); }
.w-tv-bar div.low { background: var(--err); }
.w-tv-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tv-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-tv-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tv-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tv-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tv-opts button:disabled { cursor: default; }
.w-tv-q { font-size: 16px; margin: 6px 0 8px; }
.w-tv-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tv-rev:first-child { border-top: 0; }
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
    const bar = el('div'); const barWrap = el('div', { class: 'w-tv-bar' }, bar);
    const opts = el('div', { class: 'w-tv-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tv-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, 'ts'));
    q.o.forEach((o, j) => { const b = el('button', { html: `<b>${'ABCD'[j]}.</b> ${o}` }); b.addEventListener('click', () => answer(j)); opts.append(b); });
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
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x }));
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
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tv-rev' }, el('div', { html: `<span class="pill">${q.t}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, 'ts'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : q.o[j]} · Correct: <b>${q.o[q.a]}</b>` }), el('div', { class: 'pz-exp', html: q.x + ` <a href="${q.s}.html">Review the topic →</a>` }));
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
