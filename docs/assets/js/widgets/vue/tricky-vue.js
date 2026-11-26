/* Tricky Vue: a timed drill of 40 predict-the-output / concept questions across all 16 Vue topics. Misses link back to the topic pages. */
IA.widget('tricky-vue', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- What Vue is ----------
    { t: 'What Vue is', s: 'vue-what-is-vue', q: 'What does “progressive framework” mean for Vue?', o: ['You must adopt router, store and SSR together', 'You can adopt it incrementally: enhance one page with a script tag, or build a full SPA/SSR app', 'It only runs in progressive web apps', 'It compiles to native mobile code'], a: 1, x: 'The core is the view layer; router, Pinia, SSR and tooling are optional layers you add as the app grows.' },
    { t: 'What Vue is', s: 'vue-what-is-vue', q: 'When did Vue 2 reach end of life?', o: ['31 Dec 2021', '31 Dec 2023', '31 Dec 2025', 'It is still supported'], a: 1, x: 'Vue 2 reached EOL on <b>31 December 2023</b>. New work should use Vue 3; paid extended support exists from third parties.' },
    // ---------- Setup with Vite ----------
    { t: 'Vite', s: 'vue-setup-vite', q: 'Why does the Vite dev server start fast even for big apps?', o: ['It bundles everything with webpack in parallel', 'It serves source files as native ES modules on demand and pre-bundles only dependencies', 'It skips TypeScript and Vue files', 'It caches the production build'], a: 1, x: 'In dev, the browser requests modules and Vite transforms each one when asked. Dependencies are pre-bundled once with esbuild. Production uses a real bundler.' },
    { t: 'Vite', s: 'vue-setup-vite', q: 'Your <code>.env</code> has <code>API_URL=…</code> and <code>VITE_API_URL=…</code>. What does <code>import.meta.env</code> expose to client code?', o: ['Both', 'Only VITE_API_URL', 'Only API_URL', 'Neither without a plugin'], a: 1, x: 'Only variables with the <code>VITE_</code> prefix are exposed, so server secrets are not leaked into the bundle by accident. Anything exposed is public.' },
    // ---------- Template syntax ----------
    { t: 'Templates', s: 'vue-template-syntax', q: 'In Vue 3, what happens here?', code: '<li v-for="u in users" v-if="u.active">{{ u.name }}</li>', o: ['v-for runs first, then filters', 'v-if runs first, so it cannot see u (error/warning)', 'Both are ignored', 'Only the first user renders'], a: 1, x: 'Vue 3 gives <code>v-if</code> higher priority than <code>v-for</code> on the same element (the opposite of Vue 2). Filter with a computed, or put <code>v-for</code> on a wrapping <code>&lt;template&gt;</code>.' },
    { t: 'Templates', s: 'vue-template-syntax', q: '<code>msg = \'&lt;b&gt;hi&lt;/b&gt;\'</code>. What does <code>{{ msg }}</code> render?', o: ['bold “hi”', 'the literal text &lt;b&gt;hi&lt;/b&gt;', 'nothing', 'an error'], a: 1, x: 'Interpolation sets text content, so HTML is escaped. <code>v-html</code> renders HTML, and is an XSS risk with user content.' },
    { t: 'Templates', s: 'vue-template-syntax', q: 'isActive = true, hasError = false. Rendered class?', code: '<div class="btn" :class="{ active: isActive, \'text-danger\': hasError }"></div>', o: ['class="btn"', 'class="btn active"', 'class="active"', 'class="btn active text-danger"'], a: 1, x: 'Static and bound classes are merged; object syntax includes keys whose value is truthy.' },
    // ---------- ref & reactive ----------
    { t: 'ref & reactive', s: 'vue-reactivity-basics', q: '<code>const count = ref(1)</code>. What does the template <code>{{ count + 1 }}</code> show?', o: ['[object Object]1', '2', 'NaN', '11'], a: 1, x: 'Top-level refs are auto-unwrapped in templates. In script you need <code>count.value + 1</code>.' },
    { t: 'ref & reactive', s: 'vue-reactivity-basics', q: 'What are <code>s.c</code> and <code>a[0]</code>?', code: 'const s = reactive({ c: ref(1) })\nconst a = reactive([ref(1)])', o: ['1 and 1', '1 and a Ref (needs .value)', 'a Ref and a Ref', 'a Ref and 1'], a: 1, x: 'Refs are unwrapped as properties of a reactive object, but <b>not</b> as elements of reactive arrays or Map/Set.' },
    { t: 'ref & reactive', s: 'vue-reactivity-basics', q: 'What does <code>reactive(5)</code> do?', o: ['Returns a reactive number', 'Returns 5 unchanged (with a dev warning): reactive() only works on objects', 'Throws', 'Returns a ref'], a: 1, x: 'Proxies need an object target. Use <code>ref()</code> for primitives.' },
    // ---------- computed & watch ----------
    { t: 'computed & watch', s: 'vue-computed-watch', q: 'Which runs its callback immediately on creation by default?', o: ['watch(source, cb)', 'watchEffect(fn)', 'computed(fn)', 'none of them'], a: 1, x: '<code>watchEffect</code> runs at once to collect dependencies. <code>watch</code> is lazy unless <code>{ immediate: true }</code>; a computed is lazy until read.' },
    { t: 'computed & watch', s: 'vue-computed-watch', q: 'Does the callback fire after <code>state.x++</code>?', code: 'const state = reactive({ x: 0 })\nwatch(() => state, cb)', o: ['Yes', 'No: a getter returning the same object is not deep; the returned reference did not change', 'Only once', 'It throws'], a: 1, x: 'Watching the reactive object directly (<code>watch(state, cb)</code>) is implicitly deep. A getter is compared by identity unless you add <code>{ deep: true }</code>.' },
    { t: 'computed & watch', s: 'vue-computed-watch', q: 'What happens?', code: 'const c = computed(() => n.value * 2)\nc.value = 10', o: ['c is 10', 'n becomes 5', 'Dev warning: computed is readonly; nothing changes', 'TypeError at runtime in production'], a: 2, x: 'A getter-only computed is readonly. For writes, pass <code>{ get, set }</code>.' },
    // ---------- Components ----------
    { t: 'Components', s: 'vue-components', q: 'A child does <code>props.title = \'New\'</code>. Result?', o: ['The parent’s data changes', 'Dev warning; the prop is readonly and nothing changes', 'Works until the next parent render', 'The child gets a local copy'], a: 1, x: 'Props are a readonly proxy: one-way data flow. Emit an event (or use <code>defineModel</code>) so the parent changes it.' },
    { t: 'Components', s: 'vue-components', q: 'Child emits <code>save</code>. Does a grandparent’s <code>@save</code> on the middle component receive it?', o: ['Yes, events bubble like DOM events', 'No: component events go to the direct parent only', 'Only with .native', 'Only if declared in defineEmits'], a: 1, x: 'Component events do not bubble. Re-emit, pass a callback prop, or use provide/inject or a store.' },
    { t: 'Components', s: 'vue-components', q: '<code>&lt;MyButton class="big" id="x"/&gt;</code>, MyButton has one root <code>&lt;button class="btn"&gt;</code> and declares neither as a prop. Result?', o: ['Attributes are dropped', '&lt;button class="btn big" id="x"&gt;', 'Warning and nothing applied', 'id applied, class dropped'], a: 1, x: 'Fallthrough attributes go to the single root; <code>class</code> and <code>style</code> are merged. Disable with <code>inheritAttrs: false</code>.' },
    // ---------- Composition API ----------
    { t: 'Composition API', s: 'vue-composition-api', q: 'Why must composables like <code>useMouse()</code> be called synchronously in setup?', o: ['For TypeScript', 'Their onMounted/onUnmounted/inject calls need the current component instance, which exists only during setup', 'Because they are async', 'They do not need to be'], a: 1, x: 'Hooks register on the active instance. After an <code>await</code> (outside <code>&lt;script setup&gt;</code>’s compiler help) or in a callback, there is none.' },
    { t: 'Composition API', s: 'vue-composition-api', q: 'A parent has a template ref to a <code>&lt;script setup&gt;</code> child. Can it call the child’s <code>reset()</code> function?', o: ['Yes, everything is public', 'Only if the child calls defineExpose({ reset })', 'Only via $children', 'Never'], a: 1, x: '<code>&lt;script setup&gt;</code> components are closed by default. <code>defineExpose</code> declares the public instance API.' },
    // ---------- Lifecycle ----------
    { t: 'Lifecycle', s: 'vue-lifecycle', q: 'Parent and Child both log in <code>onMounted</code>. Order?', o: ['Parent, Child', 'Child, Parent', 'Random', 'Only Parent logs'], a: 1, x: 'A parent counts as mounted only after its children are mounted, so <b>child first</b>.' },
    { t: 'Lifecycle', s: 'vue-lifecycle', q: 'The <code>&lt;p ref="p"&gt;</code> shows <code>{{ msg }}</code>, initially "a". What is logged?', code: "msg.value = 'b'\nconsole.log(p.value.textContent)\nawait nextTick()\nconsole.log(p.value.textContent)", o: ['b, b', 'a, b', 'a, a', 'b, a'], a: 1, x: 'DOM updates are batched until the next tick. <code>nextTick()</code> resolves after the flush.' },
    { t: 'Lifecycle', s: 'vue-lifecycle', q: 'A component starts <code>setInterval(poll, 1000)</code> in onMounted and never clears it. After navigating away?', o: ['Vue clears it automatically', 'It keeps running (and keeps the component’s closure alive)', 'It throws', 'It pauses'], a: 1, x: 'Vue cleans up its own effects, not your timers or listeners. Clear them in <code>onUnmounted</code> (or <code>onDeactivated</code> under KeepAlive).' },
    // ---------- Slots & provide ----------
    { t: 'Slots & provide', s: 'vue-slots-provide', q: 'Slot content passed by a parent can read…', o: ['the child’s local state', 'the parent’s state, plus slot props the child passes', 'both scopes merged', 'only global properties'], a: 1, x: 'Slot content is compiled in the parent. The child shares data only through slot props.' },
    { t: 'Slots & provide', s: 'vue-slots-provide', q: 'App: <code>provide(\'n\', count.value)</code>, then later <code>count.value++</code>. A descendant’s <code>inject(\'n\')</code>?', o: ['Updates', 'Stays at the initial value', 'Becomes undefined', 'Throws'], a: 1, x: 'The unwrapped number was provided once. Provide the ref itself for a live value.' },
    // ---------- Router ----------
    { t: 'Router', s: 'vue-router', q: 'Route <code>/orders/:id</code>, URL <code>/orders/5</code>. <code>route.params.id === 5</code>?', o: ['true', 'false: it is the string "5"', 'Only with props: true', 'It is undefined'], a: 1, x: 'Vue Router 4 never converts param types. Convert with <code>Number()</code> or a props function.' },
    { t: 'Router', s: 'vue-router', q: '<code>/orders/5 → /orders/6</code> on the same route. Does <code>onMounted</code> run again?', o: ['Yes', 'No: the instance is reused; watch the param or use onBeforeRouteUpdate', 'Only in history mode', 'Only if the route has a name'], a: 1, x: 'Same record, same component instance. Data loaded in onMounted goes stale.' },
    { t: 'Router', s: 'vue-router', q: 'What is wrong?', code: "router.beforeEach(() => {\n  if (!auth.loggedIn) return '/login'\n})", o: ['Guards must call next()', 'Infinite redirect: /login also runs the guard', 'Strings are not allowed', 'Nothing'], a: 1, x: 'Each redirect is a new navigation through the same guard. Check <code>to.meta.requiresAuth</code> or exclude the login route.' },
    // ---------- Pinia ----------
    { t: 'Pinia', s: 'vue-pinia', q: '<code>const { total } = useCart()</code>. Does <code>{{ total }}</code> update when items are added?', o: ['Yes', 'No: destructuring copies the value; use storeToRefs', 'Only for getters', 'Only in dev'], a: 1, x: 'The store is reactive; destructuring breaks the link. <code>storeToRefs()</code> keeps it.' },
    { t: 'Pinia', s: 'vue-pinia', q: '<code>store.$reset()</code> on a setup-style store?', o: ['Resets state', 'Throws in dev: setup stores have no built-in $reset', 'Resets getters only', 'Reloads the page'], a: 1, x: 'Pinia cannot know a setup store’s initial values. Write your own reset action.' },
    { t: 'Pinia', s: 'vue-pinia', q: 'A module calls <code>useAuthStore()</code> at its top level, imported by main.ts before <code>app.use(pinia)</code>. Result?', o: ['Works', 'Error: no active Pinia', 'Creates a second Pinia', 'Silent undefined'], a: 1, x: 'Stores need an active Pinia. Call <code>useStore()</code> inside functions that run after install (and on the server, per request).' },
    // ---------- Forms ----------
    { t: 'Forms', s: 'vue-forms', q: '<code>v-model.number="n"</code>, user types <code>abc</code>. <code>n.value</code>?', o: ['NaN', '0', '"abc"', 'null'], a: 2, x: 'If <code>parseFloat</code> fails, the original string is kept.' },
    { t: 'Forms', s: 'vue-forms', q: '<code>&lt;Child v-model="title"/&gt;</code> passes which prop and listens to which event (Vue 3)?', o: ['value / input', 'modelValue / update:modelValue', 'title / change', 'model / sync'], a: 1, x: 'Vue 3 standardised component v-model on <code>modelValue</code>/<code>update:modelValue</code>. <code>defineModel()</code> (3.4+) wires both.' },
    // ---------- Reactivity internals ----------
    { t: 'Internals', s: 'vue-reactivity-internals', q: 'How many logs in total?', code: "const s = reactive({ a: 1, b: 1 })\nwatchEffect(() => console.log(s.a))\ns.b = 2\ns.a = 1", o: ['1', '2', '3', '0'], a: 0, x: 'One initial run. <code>b</code> is not tracked; <code>a = 1</code> is not a change (<code>Object.is</code>).' },
    { t: 'Internals', s: 'vue-reactivity-internals', q: 'A computed’s input changes three times and nobody reads it. How many times does it recompute?', o: ['3', '1', '0', 'once per render'], a: 2, x: 'Computeds are lazy: changes only mark them dirty. They recompute on the next read.' },
    { t: 'Internals', s: 'vue-reactivity-internals', q: '<code>const o = {}</code>. <code>reactive(o) === reactive(o)</code> and <code>reactive(o) === o</code>?', o: ['true, true', 'true, false', 'false, false', 'false, true'], a: 1, x: 'Vue caches one proxy per target in a WeakMap; the proxy is not the raw object. Use <code>toRaw()</code> to get it back.' },
    // ---------- Rendering & perf ----------
    { t: 'Performance', s: 'vue-rendering-perf', q: '<code>const rows = shallowRef([1,2])</code>; <code>rows.value.push(3)</code>. Re-render?', o: ['Yes', 'No: only .value assignment (or triggerRef) triggers', 'Yes, but delayed', 'Only in templates'], a: 1, x: 'shallowRef does not proxy the array. Assign a new array or call <code>triggerRef(rows)</code>.' },
    { t: 'Performance', s: 'vue-rendering-perf', q: 'A tab inside <code>&lt;KeepAlive&gt;</code> is switched away. Which hook runs?', o: ['onUnmounted', 'onDeactivated', 'onBeforeUpdate', 'none'], a: 1, x: 'Cached components are deactivated, not unmounted; <code>onActivated</code> runs on return.' },
    // ---------- SSR & Nuxt ----------
    { t: 'SSR & Nuxt', s: 'vue-ssr-nuxt', q: 'Which runs only in the browser during SSR + hydration?', o: ['setup', 'computed', 'onMounted', 'watch with immediate: true'], a: 2, x: 'The server has no DOM, so mount and update hooks never run there. Setup runs on both sides.' },
    { t: 'SSR & Nuxt', s: 'vue-ssr-nuxt', q: 'A composable keeps <code>const user = ref(null)</code> at module scope in a Nuxt app. Risk?', o: ['None', 'State shared between all requests on the server: one user can see another’s data', 'It is reset on every render', 'Hydration is skipped'], a: 1, x: 'Server modules live for the process. Use <code>useState</code> or a Pinia store (per request).' },
    // ---------- Testing ----------
    { t: 'Testing', s: 'vue-testing', q: 'Counter starts at 0. What is printed?', code: "const w = mount(Counter)\nw.get('button').trigger('click')\nconsole.log(w.get('span').text())", o: ['"1"', '"0"', 'undefined', 'throws'], a: 1, x: 'No <code>await</code>: the DOM update has not flushed yet.' },
    { t: 'Testing', s: 'vue-testing', q: 'With <code>createTestingPinia()</code>, a component calls <code>store.checkout()</code>. What runs?', o: ['The real action', 'A spy; the original is stubbed by default', 'Nothing; it is undefined', 'An error'], a: 1, x: 'Actions are stubbed unless <code>stubActions: false</code>, so you assert calls instead of side effects.' }
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
  const segN = seg([[10, '10 questions'], [20, '20'], [40, 'all 40']], () => count, (v) => { count = v; reset(); }, 'Number of questions');
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
    } else card.append(el('p', { text: 'No misses. Try “all 40” on Fast.' }));
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
