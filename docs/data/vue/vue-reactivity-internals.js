IA.register({
  track: 'vue',
  slug: 'vue-reactivity-internals',
  title: 'Reactivity internals',
  tagline: 'Vue’s reactivity is about 1,000 lines of clever bookkeeping: a <b>Proxy</b> intercepts reads (<code>track</code>) and writes (<code>trigger</code>), effects re-run, and a <b>scheduler</b> batches component updates into one flush. Once you see it, every “why didn’t it update?” has an obvious answer.',
  tldr: {
    problem: 'You change data and the screen does not update, or it updates too often, or a watcher fires twice. Debugging that by trial and error is slow.',
    model: '<code>reactive()</code> returns a Proxy. While an <b>effect</b> (render, computed, watch) runs, each property <b>get</b> registers the effect as a subscriber of that (object, key). Each <b>set</b> that changes the value notifies subscribers. Computeds are lazy and cached; component re-renders are queued and flushed once per tick.',
    hook: '“Why does destructuring a reactive object lose reactivity?” Tracking happens on property access through the proxy. A destructured local is a plain value; nothing intercepts reading it.',
    facts: [
      { v: 'Proxy', l: 'is the mechanism in Vue 3 (Vue 2 used <code>Object.defineProperty</code>, which could not detect added keys or array index writes)' },
      { v: '3.5', l: 'reworked internals: version counters and doubly linked dependency lists, with Vue citing about 56% lower memory use' },
      { v: 'Object.is', l: 'decides whether a write is a change: setting the same value triggers nothing' }
    ]
  },
  intro: {
    what: 'When you write <code>count.value++</code> in Vue, the screen updates by itself. No <code>setState</code>, no manual refresh. Vue achieves this by <b>watching which data each piece of UI reads</b> and re-running only that UI when the data changes. This page shows how that watching works.',
    analogy: { icon: '📋', title: 'A library sign-out sheet', text: 'Each book (property) has a sheet. Whenever a reader (effect) opens the book, they sign the sheet (track). When the book is revised (set), the librarian calls everyone on the sheet (trigger), but sends one combined message per reader per day (scheduler batching).' },
    steps: [
      { t: 'Wrap data', d: '<code>reactive(obj)</code> returns a Proxy. <code>ref(x)</code> is an object with a getter/setter on <code>.value</code>.' },
      { t: 'Run an effect', d: 'Vue runs your component’s render function inside an effect and remembers it as “currently running”.' },
      { t: 'Track reads', d: 'Every reactive read during that run records: this effect depends on this key.' },
      { t: 'Trigger writes', d: 'A write that changes a value finds the dependent effects and schedules them.' },
      { t: 'Flush', d: 'Queued component updates run once, in parent-before-child order, before the browser paints.' }
    ],
    terms: [
      ['Proxy', 'A JavaScript object that intercepts operations (get, set, has, deleteProperty, ownKeys) on another object.'],
      ['effect / subscriber', 'A function Vue re-runs when its dependencies change: render, computed, watch.'],
      ['dep', 'The set of effects that depend on one (target, key).'],
      ['track / trigger', 'Record a dependency on read / notify dependents on write.'],
      ['scheduler', 'Queue that batches and orders effect re-runs (flush: pre, post, sync).'],
      ['nextTick', 'A Promise that resolves after the current queue has flushed.']
    ]
  },
  visual: {
    title: 'track → trigger → schedule → patch',
    caption: '<b>track &amp; trigger</b>: one read and one write, from the template to the DOM. <b>Destructuring</b>: why a local copy never updates and <code>toRefs</code> does. Press Play or Step.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Mini reactivity (simulation)', note: 'A plain-JS <b>simulation</b> of the core idea, about 30 lines. Not Vue’s real code, but the same shape: WeakMap → Map → Set.', code: `// SIMULATION of Vue's track/trigger, not the real implementation
const targetMap = new WeakMap(); let active = null
function track(t, k) { if (!active) return
  let m = targetMap.get(t); if (!m) targetMap.set(t, m = new Map())
  let d = m.get(k); if (!d) m.set(k, d = new Set()); d.add(active) }
function trigger(t, k) { const d = targetMap.get(t)?.get(k); d && [...d].forEach((e) => e()) }
function reactive(o) { return new Proxy(o, {
  get(t, k, r) { track(t, k); return Reflect.get(t, k, r) },
  set(t, k, v, r) { const old = t[k]; const ok = Reflect.set(t, k, v, r); if (!Object.is(old, v)) trigger(t, k); return ok } }) }
function effect(fn) { const run = () => { active = run; try { fn() } finally { active = null } }; run() }

const state = reactive({ count: 0, other: 0 })
effect(() => console.log('render: count =', state.count))
state.count++          // re-runs the effect
state.count = 1        // same value: nothing
state.other++          // not read by the effect: nothing
let { count } = state  // copy
count++                // plain variable: nothing
console.log('state.count is still', state.count)` },
      { label: 'Batching (simulation)', note: 'Simulates the scheduler: three writes, one “render” in a microtask. Real Vue also de-duplicates and sorts by component id.', code: `// SIMULATION of the job queue
const queue = new Set(); let flushing = false
function queueJob(job) { queue.add(job); if (!flushing) { flushing = true; Promise.resolve().then(flush) } }
function flush() { for (const j of queue) j(); queue.clear(); flushing = false }
const nextTick = () => Promise.resolve()

let count = 0; let dom = 0
const render = () => { dom = count; console.log('render, dom =', dom) }
function inc() { count++; queueJob(render) }

inc(); inc(); inc()
console.log('after 3 writes, dom =', dom)   // still 0
await nextTick()
console.log('after nextTick, dom =', dom)` },
      { label: 'Proxy traps you get for free', note: 'Real JS semantics: the traps Vue uses to track <code>in</code>, iteration and deletes.', code: `const log = []
const p = new Proxy({ a: 1 }, {
  get: (t, k, r) => (log.push('get ' + String(k)), Reflect.get(t, k, r)),
  has: (t, k) => (log.push('has ' + String(k)), Reflect.has(t, k)),
  ownKeys: (t) => (log.push('ownKeys'), Reflect.ownKeys(t)),
  deleteProperty: (t, k) => (log.push('delete ' + String(k)), Reflect.deleteProperty(t, k)),
})
p.a; 'a' in p; Object.keys(p); delete p.a; p.newKey = 2
console.log(log.join('\\n'))
// Vue tracks has/ownKeys too, so v-for over Object.keys and "in" checks stay reactive` }
    ]
  },
  gotchas: [
    { trap: 'Destructuring reactive() or props', code: "const state = reactive({ n: 0 })\nlet { n } = state      // plain number\nconst { n: r } = toRefs(state) // Ref linked to state.n", why: 'Tracking happens on property access through the proxy. A destructured local is read once and never again through the proxy.', fix: '<code>toRefs</code>/<code>toRef</code>, or keep accessing <code>state.n</code>. In Vue 3.5 the compiler makes destructured <code>defineProps</code> reactive by rewriting <code>n</code> to <code>props.n</code>; pass <code>() =&gt; n</code>, not <code>n</code>, to <code>watch</code>.' },
    { trap: 'Replacing a reactive() object', code: "let state = reactive({ items: [] })\nstate = reactive({ items: await load() })   // template still holds the old proxy", why: 'Templates and effects hold the old proxy. Reassigning the variable does not tell anyone.', fix: 'Mutate in place (<code>state.items = data</code>) or use a <code>ref</code>, whose <code>.value</code> can be replaced.' },
    { trap: 'Comparing a proxy with the raw object', why: '<code>reactive(obj) !== obj</code>. Storing the raw object in a Set and checking with the proxy fails; identity-based libraries get confused.', fix: 'Use <code>toRaw()</code> when you need the original, or keep everything going through the proxy. <code>markRaw()</code> opts objects (class instances, map SDKs) out of reactivity.' },
    { trap: 'watch on a reactive property value', code: "watch(state.count, cb)        // ✗ watches the number 0\nwatch(() => state.count, cb)  // ✓ getter", why: '<code>state.count</code> is evaluated immediately to a primitive, which cannot be watched. Vue warns.', fix: 'Pass a getter, a ref, or the reactive object itself (which is watched deeply).' },
    { trap: 'Expecting the DOM to update synchronously', why: 'Component updates are queued. Right after <code>count.value++</code> the DOM still shows the old value.', fix: '<code>await nextTick()</code> before reading layout, or use <code>watch(..., { flush: \'post\' })</code> to run after the DOM update.' },
    { trap: 'Deep reactivity on huge or foreign objects', why: 'Wrapping 100k-row arrays or a chart library instance in nested proxies costs memory and CPU, and can break libraries that rely on identity or private fields.', fix: '<code>shallowRef</code>/<code>shallowReactive</code> for big immutable data; <code>markRaw</code> for library instances. See <a href="vue-rendering-perf.html">Rendering &amp; performance</a>.' }
  ],
  scenarios: [
    { title: 'Leaflet map throws after being put in state',
      symptom: 'After <code>state.map = L.map(el)</code>, panning throws errors from inside the map library and DevTools freezes when inspecting the component.',
      cause: 'Vue made the map instance deeply reactive. The library’s internal objects were wrapped in proxies, identity checks failed, and DevTools tried to traverse thousands of nested objects.',
      fix: 'Mark third-party instances raw, or keep them in a non-reactive variable or <code>shallowRef</code>.',
      fixCode: "const map = shallowRef<L.Map>()\nonMounted(() => { map.value = markRaw(L.map(el.value!)) })" },
    { title: 'Watcher fires on every keystroke in an unrelated field',
      symptom: 'An expensive “recalculate quote” watcher runs when the user edits the comment field.',
      diagnose: "watch(form, recalc)   // form = reactive({...}) → deep watch",
      cause: 'Watching a reactive object is implicitly deep: any nested change triggers.',
      fix: 'Watch exactly the inputs: a getter returning a tuple. Since 3.5 you can also bound depth with <code>deep: 1</code>.',
      fixCode: "watch(() => [form.items, form.discountCode] as const, recalc, { deep: true })" }
  ],
  puzzles: [
    { kind: 'predict', q: 'How many times does the effect log?', code: "const s = reactive({ a: 1, b: 1 })\nwatchEffect(() => console.log(s.a))\ns.b = 2\ns.a = 1\n// after a tick", options: ['1', '2', '3', '0'], answer: 0, explain: 'The effect runs once immediately. <code>b</code> is not tracked, and setting <code>a</code> to its current value is not a change (<code>Object.is</code>). Total: <b>1</b>.' },
    { kind: 'predict', q: 'With the default <code>flush: \'pre\'</code>, how many times does the watcher callback run?', code: "const n = ref(0)\nwatch(n, (v) => console.log(v))\nn.value++; n.value++; n.value++", options: ['3 times: 1, 2, 3', 'Once: 3', '0 times', 'Once: 1'], answer: 1, explain: 'Watcher jobs are queued and de-duplicated; when the queue flushes, the getter yields 3 once. With <code>flush: \'sync\'</code> you would get 1, 2, 3.' },
    { kind: 'concept', q: 'Why could Vue 2 not detect <code>obj.newKey = 1</code>, while Vue 3 can?', options: ['Vue 2 had no virtual DOM', 'Vue 2 defined getters/setters per existing key with Object.defineProperty; a Proxy intercepts any key', 'Vue 3 polls objects', 'Vue 3 compiles all keys ahead of time'], answer: 1, explain: 'defineProperty only works on keys that exist when the object is made reactive, hence <code>Vue.set</code>. A Proxy’s set trap sees new keys, deletes and array index writes.' },
    { kind: 'predict', q: 'What is logged?', code: "const n = ref(1)\nconst c = computed(() => { console.log('calc'); return n.value * 2 })\nn.value = 5\nn.value = 6\nconsole.log(c.value)\nconsole.log(c.value)", options: ["calc, calc, 12, 12", "calc, 12, 12", "12, 12 (never calc)", "calc, 12, calc, 12"], answer: 1, explain: 'Computeds are <b>lazy</b>: writes only mark them dirty. The first read computes once (“calc”, 12); the second read is cached.' },
    { kind: 'concept', q: 'Is <code>reactive(obj) === reactive(obj)</code>?', options: ['No, a new proxy each time', 'Yes: Vue caches proxies per target in a WeakMap', 'Only in production', 'Only for arrays'], answer: 1, explain: 'Vue keeps a WeakMap from raw object to proxy, so the same target always gives the same proxy, and <code>reactive(proxy)</code> returns the proxy itself.' },
    { kind: 'concept', q: 'A ref holds an object: <code>const r = ref({ x: 1 })</code>. Is <code>r.value.x++</code> reactive?', options: ['No, only .value replacement is', 'Yes: ref() makes object values deeply reactive via reactive()', 'Only with deep: true', 'Only inside templates'], answer: 1, explain: 'A <code>ref</code> converts object values with <code>reactive()</code>. <code>shallowRef</code> does not, which is the point of it.' },
    { kind: 'concept', q: 'Why does Vue track the <code>has</code> and <code>ownKeys</code> traps, not only <code>get</code>?', options: ['For performance only', 'So <code>"k" in obj</code> and iteration (v-for over keys) re-run when keys are added or deleted', 'Because Proxy requires it', 'To support Vue 2 syntax'], answer: 1, explain: 'An effect that iterates keys depends on the key list itself. Adding or deleting a key triggers the iteration dependency.' }
  ],
  interview: [
    { q: 'Walk through what happens from <code>count.value++</code> to a DOM change.', a: '<ol><li>The ref’s setter compares old and new with <code>Object.is</code>.</li><li>It triggers its dep: subscribers are the effects that read it (e.g. a component’s render effect).</li><li>Component effects are not run directly; their update jobs go into the scheduler queue (de-duplicated).</li><li>A microtask flushes the queue: pre-flush watchers, then component updates sorted parent first, then post-flush callbacks (<code>flush: \'post\'</code> watchers, <code>onUpdated</code>).</li><li>Each re-render produces a new VNode tree, which is patched against the old one.</li></ol>', lvl: 'deep' },
    { q: 'ref vs reactive internally?', a: '<p><code>ref</code> is a small class (<code>RefImpl</code>) with a <code>value</code> getter (track) and setter (trigger); it works with primitives. <code>reactive</code> is a Proxy over an object, tracking every key. A ref holding an object wraps it with <code>reactive</code>. Templates and reactive objects auto-unwrap refs (not inside arrays or Maps).</p>', lvl: 'core' },
    { q: 'How do computeds avoid recalculating?', a: '<p>A computed is both a subscriber (of its inputs) and a dependency (for its readers). When an input changes, it is marked dirty and notifies readers, but does not recompute. On next read, if dirty, it recomputes. Since 3.4, if the new value equals the old one, readers are not triggered; 3.5 uses version counters to check whether dependencies really changed.</p>', lvl: 'deep' },
    { q: 'Why does destructuring props lose reactivity, and what changed in 3.5?', a: '<p><code>props</code> is a shallow reactive object; <code>const { title } = props</code> reads once. In 3.5, Reactive Props Destructure is stable: in <code>&lt;script setup&gt;</code> the compiler rewrites uses of <code>title</code> to <code>props.title</code>, so reads still go through the proxy. It also lets you write defaults as JS defaults. You still need <code>watch(() =&gt; title, …)</code>, not <code>watch(title, …)</code>.</p>', lvl: 'deep' },
    { q: 'What are the scheduler flush timings?', a: '<ul><li><code>pre</code> (default for watchers): before component updates.</li><li><code>post</code>: after the DOM is updated (<code>watchPostEffect</code>).</li><li><code>sync</code>: immediately on every change; no batching, use sparingly.</li></ul>', lvl: 'core' },
    { q: 'What is an effect scope?', a: '<p><code>effectScope()</code> collects effects (computed, watch) created inside <code>scope.run()</code> so they can be stopped together with <code>scope.stop()</code>. Every component has one, which is why watchers in setup are stopped on unmount. Useful for composables used outside components, like Pinia setup stores.</p>', lvl: 'deep' },
    { q: 'What do shallowRef, shallowReactive, markRaw, toRaw do?', a: '<p><code>shallowRef</code>: only <code>.value</code> replacement triggers. <code>shallowReactive</code>: only top-level keys are reactive. <code>markRaw(obj)</code>: never make this object reactive. <code>toRaw(proxy)</code>: get the original object (for identity or to bypass tracking).</p>', lvl: 'core' },
    { q: 'Can you get infinite loops with reactivity?', a: '<p>Yes: an effect that writes to state it reads (e.g. a watcher that increments its own source). Vue detects a job re-queueing itself too often (recursive update limit, 100 in development) and warns “Maximum recursive updates exceeded”. Fix by deriving with <code>computed</code> instead of writing back.</p>', lvl: 'deep' },
    { q: 'How do Map and Set work in reactive()?', a: '<p>Proxies cannot intercept internal slots of Map/Set, so Vue wraps their methods (<code>get</code>, <code>set</code>, <code>has</code>, <code>add</code>, iteration) with instrumented versions. <code>reactive(new Map())</code> works, and refs inside it are not auto-unwrapped.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Composable that keeps reactivity', lang: 'ts', code: `import { toValue, watchEffect, ref, type MaybeRefOrGetter } from 'vue'

// accepts a value, a ref or a getter: callers keep reactivity
export function useUser(id: MaybeRefOrGetter<number>) {
  const user = ref<User | null>(null)
  watchEffect(async (onCleanup) => {
    const ctrl = new AbortController(); onCleanup(() => ctrl.abort())
    const res = await fetch('/api/users/' + toValue(id), { signal: ctrl.signal })  // tracked before await
    user.value = await res.json()
  })
  return { user }
}

// caller
const props = defineProps<{ id: number }>()
const { user } = useUser(() => props.id)   // getter, not props.id`, note: '<code>toValue</code> (3.3+). Only reads <i>before</i> the first <code>await</code> in a watchEffect are tracked.' },
    { title: 'Opting out for heavy data', lang: 'ts', code: `const rows = shallowRef<Row[]>([])          // 100k rows, replaced not mutated
const chart = markRaw(new Chart(canvas, cfg))  // library instance: never proxied

async function refresh() {
  rows.value = Object.freeze(await api.rows())  // freeze documents intent
}` }
  ]
});
