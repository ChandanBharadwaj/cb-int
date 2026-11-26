IA.register({
  track: 'vue',
  slug: 'vue-reactivity-basics',
  title: 'ref & reactive',
  tagline: '<code>ref()</code> wraps any value in a box with a <code>.value</code>; <code>reactive()</code> wraps an object in a <b>Proxy</b>. Both record who <b>reads</b> them and notify those readers on <b>write</b>. Most “Vue stopped updating” bugs are a lost link: a destructured value, a replaced object, a missing <code>.value</code>.',
  tldr: {
    problem: 'Plain JS variables can’t tell anyone they changed. Vue needs to know when state changes and which components care, without you calling “refresh”.',
    model: 'Reads through a ref or proxy call <code>track()</code> (subscribe the running effect); writes call <code>trigger()</code> (re-run subscribers, batched). Templates auto-unwrap refs; in script you write <code>.value</code>.',
    hook: '“ref or reactive?” The Vue docs recommend <code>ref()</code> as the primary API: it holds any type, can be reassigned and survives destructuring of the object you return. <code>reactive()</code> is fine for objects you never replace.',
    facts: [
      { v: 'Proxy', l: 'Vue 3 reactivity is built on ES2015 Proxy, so new keys and array index writes are detected (Vue 2’s getters could not)' },
      { v: '.value', l: 'needed in script; top-level refs are unwrapped automatically in templates' },
      { v: 'shallowRef', l: 'tracks only <code>.value</code> reassignment, not nested changes: useful for large immutable data' }
    ]
  },
  intro: {
    what: 'In Java, if you change a field nobody is notified unless you write an observer. Vue makes state <b>observable</b> automatically: wrap it with <code>ref</code> or <code>reactive</code>, read it in the template, and Vue re-renders when it changes.',
    analogy: { icon: '🔔', title: 'A subscription list on the value', text: 'Every reactive value carries a sign-up sheet. Anyone who <i>reads</i> it while rendering signs the sheet. When someone <i>writes</i> it, everyone on the sheet gets a ring and re-renders.' },
    steps: [
      { t: 'ref for anything', d: 'Numbers, strings, objects, arrays. Read and write via <code>.value</code> in script.', code: "const name = ref('Ann')\nname.value = 'Bo'" },
      { t: 'No .value in templates', d: 'Top-level refs are unwrapped for you.', code: '<p>Hi {{ name }}</p>', lang: 'text' },
      { t: 'reactive for objects', d: 'A Proxy. No <code>.value</code>, but you can’t replace the whole object or destructure it.', code: "const form = reactive({ email: '', agree: false })\nform.email = 'a@b.c'" },
      { t: 'Deep by default', d: 'Nested objects and arrays are reactive too: <code>todos.value.push(t)</code> or <code>form.address.city = …</code> updates the UI.' }
    ],
    terms: [
      ['ref', 'A reactive box: <code>{ value }</code> with tracked get/set.'],
      ['reactive', 'A deep reactive Proxy of an object, Map, Set or array.'],
      ['Proxy', 'A JS object that intercepts get/set on another object.'],
      ['effect', 'A function Vue re-runs when its dependencies change (render, computed, watch).'],
      ['toRefs', 'Converts each property of a reactive object into a linked ref.'],
      ['unwrap', 'Vue reading <code>.value</code> for you (templates, refs nested in reactive objects).']
    ]
  },
  visual: {
    title: 'Track on read, trigger on write',
    caption: 'Pick <b>ref</b>, <b>reactive</b> or the <b>destructuring trap</b>, then step through. Arrows show <code>track()</code> when the render reads and <code>trigger()</code> when you write.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Mini reactivity (simulation)', note: 'A simplified model of Vue’s idea, in plain JS. Not Vue’s real code: no batching, no cleanup of stale deps.', code: "// SIMULATION of Vue's core idea: Proxy + track + trigger\nlet active = null\nconst deps = new WeakMap()\nfunction track(t, k) {\n  if (!active) return\n  let m = deps.get(t); if (!m) deps.set(t, m = new Map())\n  let s = m.get(k); if (!s) m.set(k, s = new Set())\n  s.add(active)\n}\nfunction trigger(t, k) { deps.get(t)?.get(k)?.forEach(fn => fn()) }\nfunction reactive(obj) {\n  return new Proxy(obj, {\n    get(t, k) { track(t, k); return t[k] },\n    set(t, k, v) { t[k] = v; trigger(t, k); return true }\n  })\n}\nfunction effect(fn) { active = fn; fn(); active = null }\n\nconst state = reactive({ count: 0, theme: 'dark' })\neffect(() => console.log('render: count =', state.count))\nstate.count++          // re-renders\nstate.theme = 'light'  // nobody read theme: no render\nstate.count = 10       // re-renders" },
      { label: 'Destructuring trap (simulation)', code: "let active = null; const subs = new Map()\nconst state = new Proxy({ count: 0 }, {\n  get(t, k) { if (active) (subs.get(k) ?? subs.set(k, new Set()).get(k)).add(active); return t[k] },\n  set(t, k, v) { t[k] = v; subs.get(k)?.forEach(f => f()); return true }\n})\nlet { count } = state             // read ONCE, outside any effect\nactive = () => console.log('render', count)\nactive(); active = null           // render reads the local copy, not the proxy\nstate.count++                     // no subscriber for count -> nothing\nconsole.log('state.count =', state.count, 'local count =', count)" },
      { label: 'Proxy identity', code: "// reactive() returns a proxy; comparing with the raw object fails\nconst raw = { id: 1 }\nconst p = new Proxy(raw, {})\nconsole.log(p === raw)           // false\nconst list = [p]\nconsole.log(list.includes(raw))  // false (Vue's reactive arrays special-case this; plain proxies don't)" }
    ]
  },
  gotchas: [
    { trap: 'Destructuring a reactive object', code: "const state = reactive({ count: 0 })\nconst { count } = state   // plain number, not reactive", why: 'Destructuring reads the current value once and copies it. The local variable has no link to the Proxy.', fix: 'Use <code>toRefs(state)</code>, access <code>state.count</code> directly, or use <code>ref</code>s from the start. For Pinia: <code>storeToRefs(store)</code>.' },
    { trap: 'Replacing a reactive object', code: "let state = reactive({ items: [] })\nstate = reactive({ items: data })  // template still shows the OLD proxy", why: 'The template captured the first proxy. Reassigning the variable creates a new proxy nobody reads.', fix: 'Mutate instead (<code>state.items = data</code>, or <code>Object.assign(state, data)</code>), or use <code>ref()</code> and assign <code>.value</code>.' },
    { trap: 'Forgetting .value in script', code: "const count = ref(0)\nif (count > 5) { … }       // compares an object: always false\nconst total = count + 1    // '[object Object]1' or NaN-ish", why: 'In script a ref is an object. TypeScript usually catches arithmetic but not every comparison or truthiness check (<code>if (count)</code> is always true).', fix: 'Write <code>count.value</code> in script. Enable strict TS and the Vue ESLint rules (<code>vue/no-ref-as-operand</code>).' },
    { trap: 'Passing a reactive property to a function loses reactivity', code: "useTitle(state.title)        // passes a string\nuseTitle(() => state.title)  // passes a getter: stays reactive\nuseTitle(toRef(state, 'title'))", why: 'Reading <code>state.title</code> produces a plain value at call time.', fix: 'Pass a ref or a getter and read it with <code>toValue()</code> (3.3+) inside the composable.' },
    { trap: 'Comparing a proxy with the raw object', code: "const raw = { id: 1 }\nconst s = reactive(raw)\ns === raw          // false\ntoRaw(s) === raw   // true", why: '<code>reactive()</code> returns a different object (a Proxy). Identity checks, <code>Set</code>/<code>Map</code> membership and third-party libs may see two objects.', fix: 'Compare ids, not object identity. Use <code>toRaw()</code> when handing data to non-Vue code. Use <code>markRaw()</code> for objects that should never be proxied (map instances, class-heavy SDK objects).' },
    { trap: 'Huge datasets made deeply reactive', why: 'Deep reactivity wraps nested objects lazily on access, but iterating 50k rows still creates proxies and dependency entries: memory and CPU cost.', fix: 'Use <code>shallowRef</code> for big data you replace as a whole: <code>rows.value = await load()</code>. Trigger manually with <code>triggerRef</code> if you mutate it in place.' }
  ],
  scenarios: [
    { title: 'Cart badge stuck at 0 after refactor to a composable',
      symptom: 'Items are added (store shows them in DevTools) but the header badge never changes.',
      diagnose: "// Header.vue\nconst { count } = useCartStore()   // Pinia store is reactive()\n// template: {{ count }}",
      cause: 'Destructuring a Pinia store (a reactive object) copies <code>count</code> once. The template reads a plain number.',
      fix: 'Use <code>storeToRefs</code> for state and getters; actions can be destructured directly.',
      fixCode: "const cart = useCartStore()\nconst { count } = storeToRefs(cart)\nconst { add } = cart" },
    { title: 'Search results page freezes for 2 seconds on each load',
      symptom: 'Loading 40k rows from the API makes the tab unresponsive; DevTools profiler shows time inside reactivity code.',
      diagnose: "const rows = ref<Row[]>([])\nrows.value = await api.search(q)  // 40k objects × 20 fields, deeply reactive\n// table component iterates all rows → proxies + deps for each",
      cause: '<code>ref()</code> makes the array deeply reactive. Rendering reads every field of every row, so Vue creates proxies and dependency entries for each.',
      fix: 'Data is replaced wholesale, never mutated: use <code>shallowRef</code>. Also paginate or virtualize the table.',
      fixCode: "const rows = shallowRef<Row[]>([])\nrows.value = await api.search(q)   // only .value is tracked" }
  ],
  puzzles: [
    { kind: 'concept', q: 'In script, <code>const n = ref(1)</code>. What is <code>n + 1</code> conceptually?', options: ['2', 'An object (the ref) used in arithmetic: a bug; TS reports an error', '"11"', 'Vue unwraps it automatically: 2'], answer: 1, explain: 'Auto-unwrapping happens in templates (and in reactive objects), not in script. Use <code>n.value + 1</code>.' },
    { kind: 'what renders', q: 'After clicking once, what is shown?', code: "<script setup lang=\"ts\">\nimport { reactive } from 'vue'\nconst state = reactive({ n: 0 })\nlet { n } = state\nfunction inc() { state.n++ }\n</script>\n<template><button @click=\"inc\">{{ n }} / {{ state.n }}</button></template>", lang: 'text', options: ['1 / 1', '0 / 1', '0 / 0', '1 / 0'], answer: 1, explain: '<code>n</code> is a copied number (0) and never changes. <code>state.n</code> is read through the proxy and becomes 1, re-rendering the component. The re-render shows <code>0 / 1</code>.' },
    { kind: 'what renders', q: 'What shows after <code>add()</code>?', code: "const todos = ref<string[]>([])\nfunction add() { todos.value.push('a'); todos.value.push('b') }\n// template: {{ todos.length }}", options: ['0', '1', '2', 'Error: push on a ref'], answer: 2, explain: '<code>ref</code> of an array is deep: <code>.value</code> is a reactive array, and push triggers. Both pushes are batched into one render showing 2.' },
    { kind: 'what renders', q: 'What shows after <code>add()</code>?', code: "const todos = shallowRef<string[]>([])\nfunction add() { todos.value.push('a') }\n// template: {{ todos.length }}", options: ['0', '1', 'Error', 'undefined'], answer: 0, explain: '<code>shallowRef</code> only tracks reassignment of <code>.value</code>. An in-place push changes the array but triggers nothing. Use <code>todos.value = [...todos.value, \'a\']</code> or <code>triggerRef(todos)</code>.' },
    { kind: 'concept', q: 'Which of these keeps reactivity?', options: ["const { a } = reactive({ a: 1 })", "const { a } = toRefs(reactive({ a: 1 }))", "const a = reactive({ a: 1 }).a", "let s = reactive({}); s = reactive({ a: 1 }) // template used the first s"], answer: 1, explain: '<code>toRefs</code> returns refs that proxy each property: <code>a.value</code> reads and writes the source.' },
    { kind: 'concept', q: 'Why can’t <code>reactive()</code> hold a number?', options: ['Numbers are too small', 'A Proxy can only wrap objects; primitives have no properties to intercept', 'It can, with { primitive: true }', 'Because of TypeScript'], answer: 1, explain: 'That’s why <code>ref()</code> exists: it boxes the primitive in an object with a tracked <code>value</code> getter/setter.' },
    { kind: 'concept', q: '<code>const user = ref({ name: \'Ann\' })</code>. Is <code>user.value.name = \'Bo\'</code> reactive?', options: ['No, only user.value = … is', 'Yes: a ref holding an object makes it deeply reactive via reactive()', 'Only with { deep: true }', 'Only in templates'], answer: 1, explain: 'When a ref’s value is an object, Vue converts it with <code>reactive()</code>. Use <code>shallowRef</code> to opt out.' }
  ],
  interview: [
    { q: 'ref vs reactive?', a: '<ul><li><code>ref</code>: any type, access via <code>.value</code>, can be reassigned, safe to return from composables and destructure.</li><li><code>reactive</code>: objects only, no <code>.value</code>, but you can’t reassign it and destructuring breaks reactivity.</li></ul><p>The official docs recommend <code>ref</code> as the primary API.</p>', lvl: 'core' },
    { q: 'How does Vue know a component needs to re-render?', a: '<p>Each component’s render runs inside a reactive effect. Reads of refs/proxies call <code>track()</code>, linking that property to the effect. A write calls <code>trigger()</code>, which queues the effect; the scheduler flushes the queue asynchronously, once per tick.</p>', fu: 'Why batched? So many synchronous writes produce one render.', lvl: 'core' },
    { q: 'When are refs unwrapped automatically?', a: '<ul><li>Top-level refs in templates.</li><li>Refs nested as properties of a <code>reactive</code> object (<code>state.count</code> where <code>count</code> is a ref).</li><li><b>Not</b> refs inside reactive arrays or Maps (<code>list[0].value</code> is needed).</li></ul>', lvl: 'deep' },
    { q: 'Why does destructuring lose reactivity?', a: '<p>Reactivity lives in the Proxy’s get/set traps. Destructuring performs one get and stores the primitive in a local variable; later reads of the variable never touch the Proxy, and later writes go to the Proxy, not the variable.</p>', lvl: 'core' },
    { q: 'What is the difference between ref and shallowRef?', a: '<p><code>ref</code> deep-converts object values with <code>reactive()</code>. <code>shallowRef</code> only tracks <code>.value</code> itself, so it is cheaper for large or immutable data and for external class instances. Mutate in place → call <code>triggerRef</code>.</p>', lvl: 'deep' },
    { q: 'What do toRaw and markRaw do?', a: '<p><code>toRaw(proxy)</code> returns the original object (for passing to libraries or cheap reads). <code>markRaw(obj)</code> flags an object so Vue never proxies it, e.g. a chart or map instance.</p>', lvl: 'deep' },
    { q: 'What changed vs Vue 2 reactivity?', a: '<p>Vue 2 used <code>Object.defineProperty</code> getters/setters added at creation, so it could not see added keys or <code>arr[i] = x</code> (you needed <code>Vue.set</code>). Vue 3 uses Proxy, which intercepts any key, deletes, <code>in</code> checks and iteration.</p>', lvl: 'core' },
    { q: 'Is Vue reactivity synchronous?', a: '<p>Tracking and triggering are synchronous; the resulting component re-render is scheduled and runs later in a microtask. <code>computed</code> values recompute lazily on read, so they are always up to date when you read them.</p>', fu: 'How do you wait for the DOM? <code>await nextTick()</code>. See <a href="vue-lifecycle.html">Lifecycle</a>.', lvl: 'deep' },
    { q: 'How do you make a reactive value readonly for consumers?', a: '<p><code>readonly(state)</code> returns a proxy that warns on writes in dev. Composables often return <code>readonly(count)</code> plus functions that mutate, keeping writes in one place.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Typed refs', lang: 'ts', code: "import { ref, reactive, shallowRef } from 'vue'\n\ninterface User { id: number; name: string }\nconst user = ref<User | null>(null)         // null until loaded\nconst filters = reactive({ q: '', page: 1 })\nconst rows = shallowRef<User[]>([])        // big, replaced wholesale\n\nasync function load() {\n  const res = await fetch(`/api/users?q=${encodeURIComponent(filters.q)}&page=${filters.page}`)\n  rows.value = await res.json()\n}" },
    { title: 'Returning refs from a composable', lang: 'ts', code: "export function useToggle(initial = false) {\n  const on = ref(initial)\n  const toggle = () => { on.value = !on.value }\n  return { on: readonly(on), toggle }   // caller can destructure safely\n}\n\n// in a component\nconst { on, toggle } = useToggle()" },
    { title: 'Java mental model', lang: 'java', code: "// Roughly what ref() gives you, written as a Java class\nclass Ref<T> {\n  private T value;\n  private final Set<Runnable> subscribers = new HashSet<>();\n  T get()        { if (Effect.active != null) subscribers.add(Effect.active); return value; }\n  void set(T v)  { value = v; subscribers.forEach(Scheduler::queue); }\n}", note: 'Illustration only. Vue’s real implementation adds batching, dependency cleanup and version counters.' }
  ]
});
