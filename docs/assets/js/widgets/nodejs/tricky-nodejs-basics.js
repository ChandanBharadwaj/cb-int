/* Node.js basics drill: a timed drill of 30 beginner interview questions across the 8 Basics topics. Misses link back to the topic pages. */
IA.widget('tricky-nodejs-basics', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- Running Node ----------
    { t: 'Running Node', s: 'node-setup-first-script', q: 'You run <code>node app.js one two</code>. What is <code>process.argv[2]</code>?', o: ['"app.js"', '"one"', '"two"', 'undefined'], a: 1, x: '<code>argv[0]</code> is the node binary, <code>argv[1]</code> the script path, then your arguments: <code>argv[2]</code> is <code>"one"</code>.' },
    { t: 'Running Node', s: 'node-setup-first-script', q: 'package.json has <code>"scripts": { "dev": "node --watch app.js" }</code>. How do you run it?', o: ['npm dev', 'npm run dev', 'node dev', 'npx package.json dev'], a: 1, x: 'Custom scripts run with <code>npm run &lt;name&gt;</code>. Only a few names (<code>start</code>, <code>test</code>) have shortcuts like <code>npm start</code>.' },
    { t: 'Running Node', s: 'node-setup-first-script', q: 'What does <code>npm init -y</code> do?', o: ['Installs all dependencies', 'Creates a package.json with default values', 'Installs Node', 'Creates node_modules'], a: 1, x: 'It writes a default <code>package.json</code> without asking questions. Nothing is installed.' },
    { t: 'Running Node', s: 'node-setup-first-script', q: 'Why do teams use <b>nvm</b> (or a similar version manager)?', o: ['To speed up npm install', 'To install and switch between Node versions per project', 'To run TypeScript', 'To publish packages'], a: 1, x: 'Different projects need different Node versions. An <code>.nvmrc</code> file pins the version; <code>nvm use</code> switches to it.' },
    // ---------- Variables & types ----------
    { t: 'Variables & types', s: 'js-variables-types', q: 'What does this print?', code: "console.log(typeof null, typeof [], typeof undefined);", run: true, expect: 'object object undefined', o: ['null array undefined', 'object object undefined', 'null object undefined', 'object array object'], a: 1, x: '<code>typeof null</code> is <code>"object"</code> (a historical bug). Arrays are objects too; use <code>Array.isArray</code>.' },
    { t: 'Variables & types', s: 'js-variables-types', q: 'What does this print?', code: "console.log(1 == '1', 1 === '1', null == undefined);", run: true, expect: 'true false true', o: ['true true true', 'true false true', 'false false false', 'true false false'], a: 1, x: '<code>==</code> converts types first; <code>===</code> does not. <code>null == undefined</code> is a special case that is <code>true</code>. Prefer <code>===</code>.' },
    { t: 'Variables & types', s: 'js-variables-types', q: 'What happens?', code: "const user = { name: 'Ann' };\nuser.name = 'Bob';\nconsole.log(user.name);", run: true, expect: 'Bob', o: ['TypeError: assignment to constant', 'Bob', 'Ann', 'undefined'], a: 1, x: '<code>const</code> stops you from re-assigning the variable, not from changing the object it points to. Use <code>Object.freeze</code> for that.' },
    { t: 'Variables & types', s: 'js-variables-types', q: 'What does this print?', code: "const a = { n: 1 };\nconst b = a;\nb.n = 2;\nconsole.log(a.n, { n: 2 } === { n: 2 });", run: true, expect: '2 false', o: ['1 true', '2 true', '2 false', '1 false'], a: 2, x: 'Objects are copied by reference: <code>a</code> and <code>b</code> are the same object. Two separate literals are two different objects, so <code>===</code> is false.' },
    // ---------- Functions ----------
    { t: 'Functions', s: 'js-functions-basics', q: 'What does this print?', code: "function greet(name = 'guest', ...rest) {\n  return name + ':' + rest.length;\n}\nconsole.log(greet(), greet(undefined, 1, 2));", run: true, expect: 'guest:0 guest:2', o: ['undefined:0 undefined:2', 'guest:0 guest:2', 'guest:0 1:1', 'guest:0 undefined:2'], a: 1, x: 'Defaults apply when the argument is missing <i>or</i> <code>undefined</code>. Rest collects the remaining arguments into a real array.' },
    { t: 'Functions', s: 'js-functions-basics', q: 'What does this print?', code: "function counter() {\n  let n = 0;\n  return () => ++n;\n}\nconst c = counter();\nc(); c();\nconsole.log(c());", run: true, expect: '3', o: ['1', '0', '3', 'undefined'], a: 2, x: 'The arrow function is a <b>closure</b>: it keeps access to <code>n</code> after <code>counter</code> returned. Each call increments the same <code>n</code>.' },
    { t: 'Functions', s: 'js-functions-basics', q: 'What does this print?', code: "console.log(sum(2, 3));\nfunction sum(a, b) { return a + b; }", run: true, expect: '5', o: ['ReferenceError', '5', 'undefined', 'NaN'], a: 1, x: 'Function <b>declarations</b> are hoisted with their body, so you can call them before the line they appear on. A <code>const sum = () =&gt; …</code> would throw.' },
    { t: 'Functions', s: 'js-functions-basics', q: 'What does this print?', code: "const obj = {\n  name: 'box',\n  regular() { return this.name; },\n  arrow: () => typeof this,\n};\nconsole.log(obj.regular(), obj.arrow());", run: true, expect: 'box object', o: ['box box', 'box object', 'undefined object', 'box undefined'], a: 1, x: 'A method called as <code>obj.regular()</code> gets <code>this = obj</code>. An arrow has no own <code>this</code>: it uses the surrounding one, here the CommonJS module’s <code>this</code> (<code>module.exports</code>, an object).' },
    // ---------- Objects & arrays ----------
    { t: 'Objects & arrays', s: 'js-objects-arrays', q: 'What does this print?', code: "const { a, b = 5, ...rest } = { a: 1, c: 3, d: 4 };\nconsole.log(a, b, Object.keys(rest).join(','));", run: true, expect: '1 5 c,d', o: ['1 undefined c,d', '1 5 c,d', '1 5 a,c,d', 'error'], a: 1, x: 'Destructuring picks properties by name; <code>b</code> is missing so its default applies; <code>...rest</code> gets what is left.' },
    { t: 'Objects & arrays', s: 'js-objects-arrays', q: 'What does this print?', code: "const nums = [1, 2, 3, 4];\nconst r = nums.filter(n => n % 2 === 0).map(n => n * 10).reduce((s, n) => s + n, 0);\nconsole.log(r, nums.length);", run: true, expect: '60 4', o: ['60 2', '60 4', '100 4', '20 4'], a: 1, x: 'filter keeps 2 and 4, map gives 20 and 40, reduce sums to 60. These methods return new arrays; <code>nums</code> is unchanged.' },
    { t: 'Objects & arrays', s: 'js-objects-arrays', q: 'What does this print?', code: "const a = { x: 1, inner: { y: 1 } };\nconst b = { ...a };\nb.x = 2;\nb.inner.y = 2;\nconsole.log(a.x, a.inner.y);", run: true, expect: '1 2', o: ['1 1', '2 2', '1 2', '2 1'], a: 2, x: 'Spread makes a <b>shallow</b> copy: top-level values are copied, nested objects are shared. Use <code>structuredClone</code> for a deep copy.' },
    { t: 'Objects & arrays', s: 'js-objects-arrays', q: 'What does this print?', code: "console.log(JSON.stringify({ a: 1, b: undefined, c: () => 1, d: null }));", run: true, expect: '{"a":1,"d":null}', o: ['{"a":1,"b":undefined,"d":null}', '{"a":1,"d":null}', '{"a":1,"b":null,"c":null,"d":null}', 'TypeError'], a: 1, x: '<code>JSON.stringify</code> drops properties whose value is <code>undefined</code> or a function. <code>null</code> is valid JSON and is kept.' },
    // ---------- Control flow & errors ----------
    { t: 'Control flow & errors', s: 'js-control-flow-errors', q: 'What does this print?', code: "const arr = ['a', 'b'];\nfor (const i in arr) process.stdout.write(typeof i + ' ');\nfor (const v of arr) process.stdout.write(v + ' ');\nconsole.log();", run: true, expect: 'string string a b', o: ['number number a b', 'string string a b', 'a b 0 1', 'a b a b'], a: 1, x: '<code>for…in</code> loops over <b>keys</b>, and keys are strings. <code>for…of</code> loops over <b>values</b>. Use <code>for…of</code> for arrays.' },
    { t: 'Control flow & errors', s: 'js-control-flow-errors', q: 'What does this print?', code: "function f() {\n  try {\n    return 'try';\n  } finally {\n    console.log('finally');\n  }\n}\nconsole.log(f());", run: true, expect: 'finally\ntry', o: ['try', 'try then finally', 'finally then try', 'finally'], a: 2, x: '<code>finally</code> always runs, even after <code>return</code>. It runs before the caller receives the value, so <code>finally</code> is logged first.' },
    { t: 'Control flow & errors', s: 'js-control-flow-errors', q: 'What does this print?', code: "const x = 2;\nswitch (x) {\n  case 1: console.log('one');\n  case 2: console.log('two');\n  case 3: console.log('three');\n}", run: true, expect: 'two\nthree', o: ['two', 'two three', 'one two three', 'nothing'], a: 1, x: 'Without <code>break</code>, execution falls through into the next cases. Add <code>break</code> (or <code>return</code>) after each case.' },
    { t: 'Control flow & errors', s: 'js-control-flow-errors', q: 'What does this print?', code: "try {\n  throw new Error('boom');\n} catch (e) {\n  console.log(e instanceof Error, e.message);\n}", run: true, expect: 'true boom', o: ['true boom', 'false boom', 'true Error: boom', 'nothing: it crashes'], a: 0, x: 'Throw <code>Error</code> objects (not strings): they carry <code>message</code> and a <code>stack</code>. <code>catch</code> receives the thrown value.' },
    // ---------- Classes & modules ----------
    { t: 'Classes & modules', s: 'js-classes-modules', q: 'What does this print?', code: "class Animal {\n  constructor(name) { this.name = name; }\n  speak() { return this.name + ' makes a sound'; }\n}\nclass Dog extends Animal {\n  speak() { return super.speak() + ' (woof)'; }\n}\nconsole.log(new Dog('Rex').speak());", run: true, expect: 'Rex makes a sound (woof)', o: ['Rex (woof)', 'Rex makes a sound (woof)', 'undefined makes a sound (woof)', 'TypeError'], a: 1, x: 'Dog inherits the constructor because it does not define one. <code>super.speak()</code> calls the parent method with the same <code>this</code>.' },
    { t: 'Classes & modules', s: 'js-classes-modules', q: 'A file is named <code>app.js</code> and package.json has no <code>"type"</code> field. Which syntax works?', o: ['import/export only', 'require/module.exports (CommonJS)', 'both freely mixed', 'neither'], a: 1, x: 'Without <code>"type": "module"</code>, <code>.js</code> files are CommonJS. Use <code>.mjs</code> or <code>"type": "module"</code> for ESM. (Node 22.12+ can also <code>require()</code> some ESM, but do not rely on mixing.)' },
    { t: 'Classes & modules', s: 'js-classes-modules', q: 'What does this print?', code: "class Counter {\n  #count = 0;\n  inc() { return ++this.#count; }\n}\nconst c = new Counter();\nc.inc();\nconsole.log(c.inc(), c.count);", run: true, expect: '2 undefined', o: ['2 2', '2 undefined', '1 undefined', 'SyntaxError'], a: 1, x: '<code>#count</code> is a truly private field: it is not a normal property, so <code>c.count</code> is <code>undefined</code>, and <code>c.#count</code> outside the class is a syntax error.' },
    // ---------- Async basics ----------
    { t: 'Async basics', s: 'js-async-basics', q: 'What does this print?', code: "console.log('A');\nsetTimeout(() => console.log('B'), 0);\nconsole.log('C');", run: true, expect: 'A\nC\nB', o: ['A B C', 'A C B', 'B A C', 'A C (B never runs)'], a: 1, x: 'The timer callback is queued and runs only after the current synchronous code finishes, even with a 0 ms delay.' },
    { t: 'Async basics', s: 'js-async-basics', q: 'What does this print?', code: "async function get() { return 42; }\nconst r = get();\nconsole.log(r instanceof Promise);\nr.then(v => console.log(v));", run: true, expect: 'true\n42', o: ['false 42', 'true 42', '42 42', 'true undefined'], a: 1, x: 'An <code>async</code> function always returns a Promise. Read the value with <code>await</code> or <code>.then</code>.' },
    { t: 'Async basics', s: 'js-async-basics', q: 'What does this print?', code: "const wait = (ms, v) => new Promise(r => setTimeout(() => r(v), ms));\n(async () => {\n  const [a, b] = await Promise.all([wait(20, 'slow'), wait(5, 'fast')]);\n  console.log(a, b);\n})();", run: true, expect: 'slow fast', o: ['fast slow', 'slow fast', 'only fast', 'undefined undefined'], a: 1, x: '<code>Promise.all</code> keeps results in the order of the input array, not the order they finished. Both waits run at the same time.' },
    { t: 'Async basics', s: 'js-async-basics', q: 'Why can one Node process serve many requests at once with a single JavaScript thread?', o: ['It starts a thread per request', 'I/O is non-blocking: Node starts the operation, keeps running other code, and runs a callback when the result is ready', 'It queues requests and serves one at a time', 'It uses Java threads internally'], a: 1, x: 'Waiting on disk or network does not block the thread; libuv and the OS do it. CPU-heavy code <i>does</i> block everything.' },
    // ---------- First HTTP server ----------
    { t: 'HTTP server', s: 'node-first-http-server', q: 'In <code>http.createServer((req, res) =&gt; { … })</code>, what happens if the handler never calls <code>res.end()</code>?', o: ['Node ends it automatically', 'The client waits until a timeout: the response is never finished', 'It sends 500', 'The server crashes'], a: 1, x: 'You must finish every response with <code>res.end()</code> (Express’s <code>res.send</code>/<code>res.json</code> call it for you).' },
    { t: 'HTTP server', s: 'node-first-http-server', q: 'In Express, what does <code>res.json({ ok: true })</code> do?', o: ['Only sets a header', 'Serialises the object, sets Content-Type: application/json and ends the response', 'Logs the object', 'Parses the request body'], a: 1, x: 'It is the usual way to send JSON. To read a JSON <i>request</i> body you need <code>app.use(express.json())</code>.' },
    { t: 'HTTP server', s: 'node-first-http-server', q: 'What does this print when <code>PORT</code> is not set?', code: "const port = Number(process.env.PORT) || 3000;\nconsole.log(port, typeof process.env.PORT);", run: true, expect: '3000 undefined', o: ['NaN undefined', '3000 undefined', '3000 string', '0 undefined'], a: 1, x: 'Environment variables are always strings or <code>undefined</code>. <code>Number(undefined)</code> is NaN, which is falsy, so the default 3000 is used.' },
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
    if (q.code) card.append(ctx.codeBox(q.code, 'js'));
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
        if (q.code) r.append(ctx.codeBox(q.code, 'js'));
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
