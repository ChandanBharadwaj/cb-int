IA.register({
  track: 'vue',
  slug: 'vue-computed-watch',
  title: 'computed & watch',
  tagline: '<code>computed</code> derives a value and <b>caches</b> it until a dependency changes. <code>watch</code> and <code>watchEffect</code> run <b>side effects</b> (fetch, save, log) when state changes. Derive with computed; react with watch.',
  tldr: {
    problem: 'Beginners recompute expensive values on every render, or sync state into other state with watchers, which creates stale values, loops and double fetches.',
    model: '<b>computed</b> = a lazy, cached, pure getter (like a memoized method keyed on its reactive inputs). <b>watch(source, cb)</b> = explicit source, lazy, gives old and new value. <b>watchEffect(fn)</b> = runs immediately, tracks whatever it reads.',
    hook: '“computed or method?” A method in the template runs on every re-render; a computed runs only when its dependencies change, and is shared by every place that reads it.',
    facts: [
      { v: 'lazy', l: 'a computed’s getter runs only when read, and only if a dependency changed since the last run' },
      { v: 'once: true', l: 'watch option added in Vue 3.4 to fire the callback a single time' },
      { v: "flush: 'pre'", l: 'default watcher timing: before the component’s DOM update. Use <code>\'post\'</code> to see the updated DOM' }
    ]
  },
  intro: {
    what: 'Two tools for “when X changes”. If you need a <b>value</b> derived from other state (a total, a filtered list), use <code>computed</code>. If you need to <b>do something</b> (call an API, write localStorage), use <code>watch</code>.',
    analogy: { icon: '🧮', title: 'Formula cell vs. alert rule', text: 'A computed is a spreadsheet formula: it just shows the latest result. A watcher is an alert rule: “when the stock price changes, send an email”. You would never send an email from inside a formula.' },
    steps: [
      { t: 'Derive', d: 'Read-only, cached.', code: 'const total = computed(() => items.value.reduce((s, i) => s + i.price * i.qty, 0))' },
      { t: 'React to one source', d: 'New and old value; lazy by default.', code: "watch(userId, async (id, oldId) => {\n  user.value = await fetchUser(id)\n})" },
      { t: 'React to whatever you read', d: 'Runs now, and again when any read dependency changes.', code: 'watchEffect(() => {\n  document.title = `${unread.value} unread`\n})' },
      { t: 'Options', d: '<code>immediate</code> (run at start), <code>deep</code> (nested changes), <code>once</code>, <code>flush</code>.' }
    ],
    terms: [
      ['computed', 'A cached derived ref. Read with <code>.value</code> in script.'],
      ['dependency', 'Reactive state read while the getter or effect ran.'],
      ['watch source', 'A ref, a reactive object, a getter <code>() => x.y</code>, or an array of these.'],
      ['side effect', 'Anything beyond returning a value: network, storage, DOM, logging.'],
      ['cleanup', 'Code that cancels the previous run of a watcher, e.g. aborting a stale fetch.']
    ]
  },
  visual: {
    title: 'Cache hits and watcher triggers',
    caption: '<b>computed caching</b>: watch the “getter runs” counter stay put on cache hits. <b>watch vs watchEffect</b>: see which one fires for each change.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Lazy cached computed (simulation)', note: 'Plain-JS model of a computed with a dirty flag. Not Vue’s implementation.', code: "// SIMULATION: computed = lazy getter + dirty flag\nfunction computed(getter) {\n  let cache, dirty = true, runs = 0\n  return {\n    get value() { if (dirty) { cache = getter(); dirty = false; runs++ } return cache },\n    invalidate() { dirty = true },          // Vue calls this via trigger()\n    get runs() { return runs }\n  }\n}\nlet price = 10, qty = 2\nconst total = computed(() => price * qty)\nconsole.log('declared, runs =', total.runs)\nconsole.log(total.value, total.value, 'runs =', total.runs)\nqty = 3; total.invalidate()\nconsole.log('after change, runs =', total.runs, '(not recomputed yet)')\nconsole.log(total.value, 'runs =', total.runs)" },
      { label: 'Race: stale responses (simulation)', code: "// Two fast changes; the slower first response arrives last.\nconst delay = (ms, v) => new Promise(r => setTimeout(() => r(v), ms))\nlet shown\nasync function naive(id, ms) { shown = await delay(ms, 'user ' + id) }\nnaive(1, 200); naive(2, 50)\nawait delay(300)\nconsole.log('naive shows:', shown)        // user 1 (stale!)\n\nlet token = 0\nasync function guarded(id, ms) {\n  const mine = ++token\n  const v = await delay(ms, 'user ' + id)\n  if (mine === token) shown = v              // like onWatcherCleanup / onCleanup\n}\nguarded(1, 200); guarded(2, 50)\nawait delay(300)\nconsole.log('guarded shows:', shown)      // user 2" }
    ]
  },
  gotchas: [
    { trap: 'Side effects inside computed', code: "const sorted = computed(() => items.value.sort(byName))  // mutates the source!\nconst user = computed(async () => await fetchUser(id.value)) // a Promise, not a user", why: 'Getters may run at any time (or not at all if nobody reads them). Mutating the source triggers more updates; async getters return Promises.', fix: 'Keep getters pure: <code>[...items.value].sort(byName)</code> (or <code>toSorted</code>). Fetch in a <code>watch</code> and store the result in a ref.' },
    { trap: 'Watching a reactive property directly', code: "watch(state.count, cb)        // passes a number: warning, never fires\nwatch(() => state.count, cb)  // getter: correct", why: '<code>state.count</code> is evaluated once to a plain value. Watch sources must be refs, reactive objects, getters or arrays of them.', fix: 'Wrap the property in a getter.' },
    { trap: 'Expecting nested changes to fire a getter watch', code: "watch(() => state.filters, reload)          // fires only if filters is REPLACED\nwatch(() => state.filters, reload, { deep: true })", why: 'A getter source compares the returned value by identity. Mutating <code>filters.q</code> keeps the same object.', fix: 'Add <code>deep: true</code>, or watch the specific fields: <code>() => [f.q, f.page]</code>. Watching a <code>reactive</code> object directly is deep implicitly.' },
    { trap: 'Stale async responses overwrite fresh ones', why: 'User types fast; request 1 resolves after request 2 and replaces the newer result.', fix: 'Abort or ignore the previous run in the watcher cleanup.', code: "watch(q, async (val, _old, onCleanup) => {\n  const ctrl = new AbortController()\n  onCleanup(() => ctrl.abort())      // or onWatcherCleanup() in 3.5+\n  results.value = await search(val, ctrl.signal)\n})" },
    { trap: 'Syncing state with watchers instead of computed', code: "const fullName = ref('')\nwatch([first, last], ([f, l]) => { fullName.value = `${f} ${l}` })  // stale for the first render", why: 'A lazy watcher leaves <code>fullName</code> empty until something changes, and every derived value becomes extra state to keep in sync.', fix: '<code>const fullName = computed(() => `${first.value} ${last.value}`)</code>.' },
    { trap: 'Reading the DOM in a default watcher', why: 'With <code>flush: \'pre\'</code> the callback runs before Vue patches the component, so the DOM still shows the old state.', fix: "Use <code>{ flush: 'post' }</code> / <code>watchPostEffect</code>, or <code>await nextTick()</code> inside the callback." }
  ],
  scenarios: [
    { title: 'Search box shows results for an older query',
      symptom: 'Typing “spring boot” sometimes shows results for “spr”. Hard to reproduce on fast networks.',
      diagnose: "watch(query, async (q) => {\n  results.value = await api.search(q)   // no cancellation\n})",
      cause: 'Responses arrive out of order. The last response to arrive wins, not the last request sent.',
      fix: 'Debounce input and abort the previous request in the watcher cleanup.',
      fixCode: "import { watch, onWatcherCleanup } from 'vue'   // 3.5+\nwatch(query, async (q) => {\n  const ctrl = new AbortController()\n  onWatcherCleanup(() => ctrl.abort())\n  try { results.value = await api.search(q, { signal: ctrl.signal }) }\n  catch (e) { if ((e as Error).name !== 'AbortError') throw e }\n})" },
    { title: 'Settings page hammers the save endpoint',
      symptom: 'Every keystroke in a settings form triggers a PUT; the backend rate-limits the user.',
      diagnose: "watch(settings, save, { deep: true })   // fires on every nested change",
      cause: 'A deep watcher on the whole form calls save synchronously for every field change.',
      fix: 'Debounce the save, or save on blur/submit. Compare with the last saved snapshot to skip no-op saves.',
      fixCode: "let t: ReturnType<typeof setTimeout> | undefined\nwatch(settings, () => {\n  clearTimeout(t)\n  t = setTimeout(() => save(toRaw(settings)), 800)\n}, { deep: true })" }
  ],
  puzzles: [
    { kind: 'concept', q: 'A computed is declared but never read anywhere. How many times does its getter run?', options: ['Once, at declaration', 'Zero', 'On every render', 'Once per dependency change'], answer: 1, explain: 'Computeds are lazy. With no reader, the getter never runs.' },
    { kind: 'what renders', q: 'How many times is <code>"calc"</code> logged on first render?', code: "const n = ref(2)\nconst sq = computed(() => { console.log('calc'); return n.value * n.value })\n// template: {{ sq }} {{ sq }} {{ sq }}", options: ['0', '1', '3', '6'], answer: 1, explain: 'The first read computes and caches; the next two reads return the cached value.' },
    { kind: 'concept', q: 'Which fires its callback during setup without extra options?', options: ['watch(src, cb)', 'watchEffect(fn)', 'Both', 'Neither'], answer: 1, explain: '<code>watchEffect</code> runs immediately to collect dependencies. <code>watch</code> is lazy unless <code>{ immediate: true }</code>.' },
    { kind: 'concept', q: '<code>const form = reactive({ addr: { city: \'\' } })</code>. Which watcher fires on <code>form.addr.city = \'Pune\'</code>?', options: ['watch(() => form.addr, cb)', 'watch(form, cb)', 'watch(form.addr.city, cb)', 'None of them'], answer: 1, explain: 'Passing a reactive object directly creates an implicitly deep watcher. The getter returning <code>form.addr</code> only fires if <code>addr</code> is replaced. Option C passes a string.' },
    { kind: 'concept', q: 'In <code>watch(count, (n, o) => …)</code>, after <code>count.value</code> goes 1 → 2 → 3 in the same synchronous handler, how often does the callback run (default flush)?', options: ['Twice: (2,1) and (3,2)', 'Once: (3,1)', 'Once: (3,2)', 'Three times'], answer: 1, explain: 'Watcher callbacks are batched per tick. When the job runs, the value is 3 and the last value it saw was 1.' },
    { kind: 'concept', q: 'What is a writable computed for?', code: "const fullName = computed({\n  get: () => `${first.value} ${last.value}`,\n  set: (v) => { [first.value, last.value] = v.split(' ') }\n})", options: ['Caching writes', 'Letting v-model bind to a derived value while writes go to the underlying sources', 'Making computed async', 'Nothing; computed cannot have setters'], answer: 1, explain: 'Assigning <code>fullName.value</code> calls the setter, which updates the real state; the getter then derives the new value.' }
  ],
  interview: [
    { q: 'computed vs method?', a: '<p>Both can produce the same value. A computed caches based on its reactive dependencies and recomputes only when they change; a method called in the template runs on every re-render. Use methods for actions and for values that depend on arguments per call.</p>', lvl: 'core' },
    { q: 'computed vs watch?', a: '<p>Use <code>computed</code> to derive a value (pure, synchronous, cached). Use <code>watch</code> for side effects in response to change (async, IO, imperative APIs). Rule: if you are writing a watcher that sets another ref, you probably want a computed.</p>', lvl: 'core' },
    { q: 'watch vs watchEffect?', a: '<ul><li><code>watch</code>: explicit sources, lazy, gives new and old values, tracks only the source.</li><li><code>watchEffect</code>: runs immediately, tracks everything it reads synchronously, no old value.</li></ul><p>Note: <code>watchEffect</code> only tracks reads before the first <code>await</code>.</p>', fu: 'Why only before await? Tracking relies on a global “current effect” set during the synchronous run.', lvl: 'core' },
    { q: 'What do deep and immediate do?', a: '<p><code>immediate: true</code> runs the callback once at creation (old value <code>undefined</code>). <code>deep: true</code> traverses the source so nested mutations trigger. Since 3.5, <code>deep</code> can be a number limiting traversal depth.</p>', lvl: 'core' },
    { q: 'How do you stop a watcher?', a: '<p><code>watch</code> returns a stop handle: <code>const stop = watch(...); stop()</code>. Watchers created synchronously in setup are stopped automatically when the component unmounts; ones created asynchronously (after an <code>await</code>, in a timeout) are not, and leak.</p>', lvl: 'deep' },
    { q: 'What is the flush option?', a: "<ul><li><code>'pre'</code> (default): before the owning component re-renders.</li><li><code>'post'</code>: after the DOM update (needed to read updated DOM).</li><li><code>'sync'</code>: synchronously on every change. Rarely right; no batching.</li></ul>", lvl: 'deep' },
    { q: 'How does computed caching actually work?', a: '<p>A computed is itself an effect. When a dependency triggers, Vue marks the computed dirty and notifies the computed’s own subscribers; it does not recompute. On the next read it recomputes if needed. Vue 3.4+ also skips notifying subscribers if the recomputed value is unchanged.</p>', lvl: 'deep' },
    { q: 'How do you avoid races in async watchers?', a: '<p>Register cleanup: the third callback argument <code>onCleanup</code>, or <code>onWatcherCleanup()</code> (3.5+). It runs before the next invocation and on stop, so you can abort the previous fetch. Debounce user input on top.</p>', lvl: 'deep' },
    { q: 'Can a computed depend on non-reactive data?', a: '<p>It can read it, but changes won’t invalidate the cache: <code>computed(() => Date.now())</code> never updates. Put the changing value in a ref (e.g. updated by a timer).</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Filtered, sorted list with computed', lang: 'ts', code: "const q = ref('')\nconst sortBy = ref<'name' | 'total'>('name')\nconst visible = computed(() =>\n  orders.value\n    .filter(o => o.customer.toLowerCase().includes(q.value.toLowerCase()))\n    .toSorted((a, b) => sortBy.value === 'name' ? a.customer.localeCompare(b.customer) : b.total - a.total)\n)" , note: '<code>toSorted</code> needs an ES2023 target/browser; otherwise copy with <code>[...arr].sort()</code>.' },
    { title: 'Load on route param change', lang: 'ts', code: "const route = useRoute()\nconst order = ref<Order | null>(null)\nwatch(() => route.params.id as string, async (id) => {\n  order.value = null\n  order.value = await api.getOrder(id)\n}, { immediate: true })" },
    { title: 'Persist to localStorage', lang: 'ts', code: "const prefs = ref(JSON.parse(localStorage.getItem('prefs') ?? '{}'))\nwatch(prefs, (v) => localStorage.setItem('prefs', JSON.stringify(v)), { deep: true })" }
  ]
});
