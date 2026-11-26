/* Vue basics drill: a timed drill of 30 beginner questions across the 6 Vue Basics topics. Misses link back to the topic pages. */
IA.widget('tricky-vue-basics', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- What Vue is ----------
    { t: 'What Vue is', s: 'vue-what-is-vue', q: 'What is Vue, in one line?', o: ['A full back-end framework', 'A JavaScript framework for building user interfaces with declarative, reactive components', 'A CSS library', 'A database client'], a: 1, x: 'Vue is a UI framework: you describe what the page should look like for the current state, and Vue keeps the DOM in sync when state changes.' },
    { t: 'What Vue is', s: 'vue-what-is-vue', q: 'What does “progressive framework” mean?', o: ['It only works in PWAs', 'You can adopt it step by step: one widget on a page, up to a full SPA with router, store and SSR', 'It must be upgraded every month', 'It renders progressively from top to bottom'], a: 1, x: 'The core is the view layer. Router, Pinia, SSR (Nuxt) and tooling are optional layers you add when you need them.' },
    { t: 'What Vue is', s: 'vue-what-is-vue', q: 'Which is the official state management library for Vue 3?', o: ['Redux', 'Vuex 5', 'Pinia', 'MobX'], a: 2, x: '<b>Pinia</b> is the official store for Vue 3. Vuex is the older one and is in maintenance mode.' },
    { t: 'What Vue is', s: 'vue-what-is-vue', q: 'Compared with React, what is the most typical difference in how a Vue component is written?', o: ['Vue has no components', 'Vue usually uses HTML-based templates in a .vue file; React uses JSX in JavaScript', 'React has no state', 'Vue cannot use TypeScript'], a: 1, x: 'Vue templates look like HTML with directives (<code>v-if</code>, <code>v-for</code>). Vue can also use JSX/render functions, but templates are the default.' },
    { t: 'What Vue is', s: 'vue-what-is-vue', q: 'Should a new project today start on Vue 2 or Vue 3?', o: ['Vue 2, it is more stable', 'Vue 3: Vue 2 reached end of life on 31 Dec 2023', 'Either, both get updates', 'Vue 1'], a: 1, x: 'Vue 2 is end of life. Vue 3 is the current major, with the Composition API and better TypeScript support.' },
    // ---------- Setup with Vite ----------
    { t: 'Setup with Vite', s: 'vue-setup-vite', q: 'Which command scaffolds a new official Vue 3 project?', o: ['npx vue-cli new', 'npm create vue@latest', 'npm install vue-starter', 'vue init webpack'], a: 1, x: '<code>npm create vue@latest</code> runs <b>create-vue</b>, which sets up a Vite project and asks about TypeScript, Router, Pinia, tests and ESLint.' },
    { t: 'Setup with Vite', s: 'vue-setup-vite', q: 'What are the three blocks a .vue single-file component can contain?', o: ['&lt;head&gt;, &lt;body&gt;, &lt;footer&gt;', '&lt;template&gt;, &lt;script&gt;, &lt;style&gt;', '&lt;view&gt;, &lt;model&gt;, &lt;controller&gt;', '&lt;html&gt;, &lt;js&gt;, &lt;css&gt;'], a: 1, x: 'An SFC keeps markup, logic and styles of one component in one file. <code>@vitejs/plugin-vue</code> compiles it.' },
    { t: 'Setup with Vite', s: 'vue-setup-vite', q: 'What does <code>&lt;style scoped&gt;</code> do?', o: ['Loads the CSS lazily', 'Applies the styles only to this component’s elements (via a data attribute)', 'Makes the styles global', 'Disables the styles in production'], a: 1, x: 'Vue adds a unique <code>data-v-…</code> attribute to the component’s elements and rewrites selectors to match it, so styles do not leak to other components.' },
    { t: 'Setup with Vite', s: 'vue-setup-vite', q: 'What is the difference between <code>npm run dev</code> and <code>npm run build</code> in a Vite project?', o: ['None', 'dev starts a fast dev server with hot reload; build creates optimised, bundled files in dist/', 'dev deploys; build tests', 'build starts the server'], a: 1, x: 'The dev server transforms files on demand (no bundling). The build bundles, tree-shakes, minifies and hashes file names for production.' },
    { t: 'Setup with Vite', s: 'vue-setup-vite', q: 'Which <code>.env</code> variable can client code read via <code>import.meta.env</code>?', o: ['SECRET_KEY', 'VITE_API_URL', 'Both', 'Neither'], a: 1, x: 'Only <code>VITE_</code>-prefixed variables are exposed to the browser bundle. Anything exposed is public, so never put secrets there.' },
    // ---------- Template syntax ----------
    { t: 'Template syntax', s: 'vue-template-syntax', q: '<code>name = \'Ana\'</code>. What renders?', code: '<p>Hello {{ name }}!</p>', lang: 'text', o: ['Hello {{ name }}!', 'Hello Ana!', 'Hello !', 'Hello name!'], a: 1, x: 'Double curly braces (“mustache”) interpolate a JavaScript expression as text.' },
    { t: 'Template syntax', s: 'vue-template-syntax', q: 'What is <code>:href="url"</code> short for?', o: ['v-on:href', 'v-bind:href', 'v-model:href', 'v-html:href'], a: 1, x: '<code>:</code> is shorthand for <code>v-bind</code> (bind an attribute to an expression). <code>@</code> is shorthand for <code>v-on</code> (listen to an event).' },
    { t: 'Template syntax', s: 'vue-template-syntax', q: 'What is the difference between <code>v-if="false"</code> and <code>v-show="false"</code>?', o: ['No difference', 'v-if does not render the element at all; v-show renders it with display: none', 'v-show removes it from the DOM', 'v-if only works on components'], a: 1, x: 'Use <code>v-show</code> for things toggled often (cheap toggle) and <code>v-if</code> when the condition rarely changes or the content is heavy.' },
    { t: 'Template syntax', s: 'vue-template-syntax', q: 'Why should <code>v-for</code> have a <code>:key</code>?', o: ['It is only for CSS', 'So Vue can match each item to its DOM element and move/reuse it correctly when the list changes', 'It makes the loop faster to type', 'Keys are required by HTML'], a: 1, x: 'Use a stable unique id (not the index when items can be reordered, inserted or removed), otherwise state like input text can end up on the wrong row.' },
    { t: 'Template syntax', s: 'vue-template-syntax', q: '<code>msg = \'&lt;b&gt;hi&lt;/b&gt;\'</code>. What does <code>{{ msg }}</code> show?', o: ['bold “hi”', 'the literal text &lt;b&gt;hi&lt;/b&gt;', 'nothing', 'an error'], a: 1, x: 'Interpolation escapes HTML. <code>v-html</code> renders raw HTML, which is an XSS risk with user input.' },
    // ---------- ref & reactive ----------
    { t: 'ref & reactive', s: 'vue-reactivity-basics', q: 'In <code>&lt;script setup&gt;</code>, how do you increase <code>const count = ref(0)</code>?', o: ['count++', 'count.value++', 'count(1)', 'setCount(count + 1)'], a: 1, x: 'A ref holds its value in <code>.value</code> in script. In the template it is unwrapped, so <code>{{ count }}</code> and <code>@click="count++"</code> work.' },
    { t: 'ref & reactive', s: 'vue-reactivity-basics', q: '<code>const count = ref(1)</code>. What does <code>{{ count + 1 }}</code> show?', o: ['[object Object]1', '2', 'NaN', '11'], a: 1, x: 'Top-level refs are auto-unwrapped in templates.' },
    { t: 'ref & reactive', s: 'vue-reactivity-basics', q: 'When would you use <code>reactive()</code> instead of <code>ref()</code>?', o: ['For a single number or string', 'For an object whose properties you read and change directly, without .value', 'Never; reactive is deprecated', 'Only for arrays of refs'], a: 1, x: '<code>reactive</code> works only with objects (it is a Proxy) and cannot be reassigned as a whole. Many teams just use <code>ref</code> everywhere for consistency.' },
    { t: 'ref & reactive', s: 'vue-reactivity-basics', q: 'Does the template update after the button click?', code: "const state = reactive({ count: 0 })\nlet { count } = state\nfunction inc() { count++ }", o: ['Yes', 'No: destructuring copied the number out; changing the copy does not touch state', 'Only after a reload', 'It throws'], a: 1, x: 'Destructuring a reactive object breaks the reactive link for primitives. Use <code>state.count++</code> or <code>toRefs(state)</code>.' },
    { t: 'ref & reactive', s: 'vue-reactivity-basics', q: 'What happens to the page after <code>state = reactive({ n: 1 })</code> runs again inside a function (state declared with let)?', o: ['The page updates to the new object', 'The template keeps showing the old object: replacing the whole reactive object loses the link', 'Vue merges the objects', 'It throws'], a: 1, x: 'The template tracked the old proxy. Change properties (<code>state.n = 1</code>) or use a <code>ref</code>, whose <code>.value</code> can be replaced.' },
    // ---------- computed & watch ----------
    { t: 'computed & watch', s: 'vue-computed-watch', q: 'What is the main difference between a computed and a method used in the template?', o: ['None', 'A computed is cached and recalculates only when its reactive dependencies change; a method runs on every render', 'Methods are cached', 'Computeds can take arguments'], a: 1, x: 'Use <code>computed</code> for derived values (e.g. a filtered list). Use a method when you need arguments or want it to run each time.' },
    { t: 'computed & watch', s: 'vue-computed-watch', q: 'When should you reach for <code>watch</code> instead of <code>computed</code>?', o: ['To derive a value for the template', 'To run a side effect when data changes, e.g. fetch, save to localStorage, log', 'Never', 'To make data readonly'], a: 1, x: 'computed = derive a value (no side effects). watch = do something when a value changes.' },
    { t: 'computed & watch', s: 'vue-computed-watch', q: 'Does this watcher callback run once when the component is created?', code: 'watch(query, (q) => search(q))', o: ['Yes', 'No: watch is lazy; it runs only on change unless you pass { immediate: true }', 'Only in dev', 'It runs twice'], a: 1, x: '<code>watchEffect</code> runs at once; <code>watch</code> waits for the first change unless <code>immediate: true</code>.' },
    { t: 'computed & watch', s: 'vue-computed-watch', q: 'What does <code>watchEffect(() =&gt; console.log(user.value.name))</code> watch?', o: ['Nothing until you list sources', 'Whatever reactive values it reads while running: here user.value.name', 'Every ref in the component', 'Only the first value'], a: 1, x: 'watchEffect tracks dependencies automatically from what it reads, and runs immediately.' },
    { t: 'computed & watch', s: 'vue-computed-watch', q: '<code>const total = computed(() =&gt; a.value + b.value)</code>. What does <code>total.value = 10</code> do?', o: ['Sets total to 10', 'Warns: a getter-only computed is readonly', 'Changes a and b', 'Deletes total'], a: 1, x: 'Computeds are readonly by default. Change the sources instead, or pass <code>{ get, set }</code> for a writable computed.' },
    // ---------- Components ----------
    { t: 'Components', s: 'vue-components', q: 'How does a <code>&lt;script setup&gt;</code> component declare its props?', o: ['export const props', 'defineProps()', 'this.props', 'useProps()'], a: 1, x: '<code>defineProps</code> is a compiler macro, available without an import. With TS: <code>defineProps&lt;{ title: string }&gt;()</code>.' },
    { t: 'Components', s: 'vue-components', q: 'A child needs to tell its parent “the user clicked save”. What is the Vue way?', o: ['Change a prop', 'Emit an event: emit(\'save\'), declared with defineEmits; the parent listens with @save', 'Call window.parent', 'Use a global variable'], a: 1, x: 'Props go down, events go up: one-way data flow.' },
    { t: 'Components', s: 'vue-components', q: 'A child does <code>props.title = \'New\'</code>. Result?', o: ['The parent’s data changes', 'Dev warning; props are readonly and nothing changes', 'It works', 'The parent re-renders'], a: 1, x: 'The parent owns the data. Emit an event so the parent changes it, or copy the prop into a local ref if you need a local draft.' },
    { t: 'Components', s: 'vue-components', q: 'What does <code>&lt;Child v-model="name" /&gt;</code> expand to in Vue 3?', o: [':value="name" @input="…"', ':modelValue="name" @update:modelValue="v =&gt; name = v"', ':name="name"', 'v-bind="name"'], a: 1, x: 'The child either declares <code>modelValue</code> + emits <code>update:modelValue</code>, or (3.4+) uses <code>const model = defineModel()</code>.' },
    { t: 'Components', s: 'vue-components', q: 'How do you pass a number, not a string, as a prop?', code: '<Rating max="5" />  vs  <Rating :max="5" />', lang: 'text', o: ['Both pass the number 5', 'max="5" passes the string "5"; :max="5" evaluates the expression and passes the number 5', 'Both pass a string', 'Neither works'], a: 1, x: 'Without <code>:</code> the value is a plain string attribute. With <code>v-bind</code> (<code>:</code>) it is a JavaScript expression.' }
  ];
  /*Q-END*/
  const TOPICS = ['All', ...[...new Set(Q.map((q) => q.t))]];
  const slugOf = {}; Q.forEach((q) => { slugOf[q.t] = q.s; });
  if (!document.getElementById('w-tvb-style')) {
    document.head.append(el('style', { id: 'w-tvb-style', text: `
.w-tvb-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tvb-bar div { height: 100%; background: var(--accent); }
.w-tvb-bar div.low { background: var(--err); }
.w-tvb-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tvb-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-tvb-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tvb-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tvb-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tvb-opts button:disabled { cursor: default; }
.w-tvb-q { font-size: 16px; margin: 6px 0 8px; }
.w-tvb-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tvb-rev:first-child { border-top: 0; }
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
    const bar = el('div'); const barWrap = el('div', { class: 'w-tvb-bar' }, bar);
    const opts = el('div', { class: 'w-tvb-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tvb-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, q.lang || 'ts'));
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
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tvb-rev' }, el('div', { html: `<span class="pill">${q.t}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, q.lang || 'ts'));
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
