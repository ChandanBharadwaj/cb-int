IA.register({
  track: 'vue',
  slug: 'vue-composition-api',
  title: 'Composition API & composables',
  tagline: '<code>&lt;script setup&gt;</code> is the Composition API with less boilerplate: top-level variables are available in the template. Extract related state and logic into <b>composables</b>, plain <code>useX()</code> functions that use refs and lifecycle hooks, and reuse them across components.',
  tldr: {
    problem: 'In the Options API one feature is spread across <code>data</code>, <code>computed</code>, <code>watch</code>, <code>methods</code> and hooks, and reuse means mixins: name clashes and invisible sources of properties.',
    model: 'A composable is a function called during <code>setup</code>. It creates refs, computeds, watchers and lifecycle hooks <b>bound to the calling component</b>, and returns what the caller needs. Each call creates fresh state, like <code>new</code>.',
    hook: '“Composables vs mixins?” Composables have explicit inputs and outputs (you see where <code>x</code> came from), no name collisions, full TS inference, and can take reactive arguments.',
    facts: [
      { v: '3.2', l: '<code>&lt;script setup&gt;</code> became stable in Vue 3.2 (2021)' },
      { v: 'use*', l: 'naming convention for composables, e.g. <code>useFetch</code>, <code>useMouse</code>' },
      { v: 'toValue', l: 'Vue 3.3+ helper that normalizes a ref, getter or plain value: the standard way to accept flexible composable arguments' }
    ]
  },
  intro: {
    what: 'Vue has two ways to write component logic. The <b>Options API</b> is an object with sections (<code>data</code>, <code>methods</code>…). The <b>Composition API</b> is plain functions (<code>ref</code>, <code>computed</code>, <code>onMounted</code>) called in <code>setup</code>. With <code>&lt;script setup&gt;</code> you just write code top to bottom; what you declare, the template can use.',
    analogy: { icon: '🧰', title: 'Utility classes vs. inheritance', text: 'Mixins are like inheriting from several base classes at once: fields appear from nowhere and collide. Composables are like calling a helper that returns an object: <code>var paging = new Paging(results)</code>. Explicit, testable, composable.' },
    steps: [
      { t: 'Write logic top-down', d: 'Imports, state, derived state, functions. All usable in the template.', code: "<script setup lang=\"ts\">\nimport { ref, computed } from 'vue'\nconst items = ref<string[]>([])\nconst count = computed(() => items.value.length)\nfunction add(s: string) { items.value.push(s) }\n</script>", lang: 'text' },
      { t: 'Extract a composable', d: 'Move a feature into <code>src/composables/useX.ts</code>.', code: "export function useCounter(start = 0) {\n  const n = ref(start)\n  const inc = () => n.value++\n  return { n, inc }\n}" },
      { t: 'Use it', d: 'Call it in setup and destructure the refs.', code: 'const { n, inc } = useCounter(10)' },
      { t: 'Compose', d: 'Composables can call other composables, take refs as arguments and register hooks/cleanup.' }
    ],
    terms: [
      ['setup', 'The function (or <code>&lt;script setup&gt;</code> block) that runs once per component instance.'],
      ['composable', 'A function using Vue reactivity that encapsulates stateful logic.'],
      ['Options API', 'Object-based style: <code>data</code>, <code>methods</code>, <code>computed</code>, <code>this</code>.'],
      ['mixin', 'Options API reuse by merging option objects. Discouraged in Vue 3.'],
      ['MaybeRefOrGetter', 'A type for args that can be a value, ref or getter; read with <code>toValue()</code>.'],
      ['effect scope', 'The group of watchers/computeds owned by a component, disposed on unmount.']
    ]
  },
  visual: {
    title: 'Group by feature, reuse by function',
    caption: '<b>Options vs Composition</b>: colours are features. Step through to see how they scatter or cluster. Then compare <b>per-call</b> and <b>module</b> state in a composable.'
  },
  gotchas: [
    { trap: 'Calling a composable outside setup (or after await)', code: "async function onClick() {\n  const { data } = useFetch(url)   // hooks/watchers not bound to the component\n}\n// also risky:\nconst a = await something()\nconst b = useThing()              // after await in setup", why: 'Composables that register lifecycle hooks or watchers need the <b>current component instance</b>, which is only set during synchronous setup. Hooks registered elsewhere warn and watchers leak.', fix: 'Call composables at the top level of <code>&lt;script setup&gt;</code>, before any <code>await</code>. Trigger work later via returned functions (<code>execute()</code>).' },
    { trap: 'Module-level state shared by accident', code: "const items = ref<Item[]>([])   // outside the function!\nexport function useCart() { return { items } }", why: 'Modules are evaluated once, so every component shares <code>items</code>. With SSR, all users on a server process share it: data leaks between requests.', fix: 'Create state inside the function. For intentional shared state, use Pinia (SSR-safe per request).' },
    { trap: 'Composable takes a plain value and never updates', code: "function useUser(id: number) { /* fetch once */ }\nuseUser(props.id)   // later id changes are ignored", why: 'The argument was read at call time; nothing re-runs.', fix: 'Accept <code>MaybeRefOrGetter&lt;number&gt;</code>, read it with <code>toValue()</code> inside a <code>watch</code>/<code>watchEffect</code>, and call it as <code>useUser(() => props.id)</code>.' },
    { trap: 'Returning a reactive object from a composable', code: "return reactive({ x, y })      // caller: const { x } = useMouse() → not reactive", why: 'Destructuring a reactive object loses reactivity.', fix: 'Return a plain object of refs. Callers who want an object can wrap: <code>const mouse = reactive(useMouse())</code>.' },
    { trap: 'Forgetting cleanup in a composable', code: "export function useInterval(fn: () => void, ms: number) {\n  setInterval(fn, ms)   // keeps running after unmount\n}", why: 'Timers, listeners and sockets aren’t Vue effects; they survive the component.', fix: 'Register <code>onUnmounted</code> (or <code>onScopeDispose</code>, which also works inside <code>effectScope</code>) to clear them.' },
    { trap: 'Mixing this and Composition API', why: 'In <code>&lt;script setup&gt;</code> there is no <code>this</code>. Copy-pasted Options code with <code>this.x</code> fails.', fix: 'Replace <code>this.x</code> with refs (<code>x.value</code>), <code>this.$emit</code> with <code>defineEmits</code>, <code>this.$router</code> with <code>useRouter()</code>.' }
  ],
  scenarios: [
    { title: 'SSR app shows another user’s notifications',
      symptom: 'After moving to Nuxt, users occasionally see someone else’s unread count on first load.',
      diagnose: "// composables/useNotifications.ts\nconst unread = ref<Notification[]>([])     // module scope\nexport const useNotifications = () => ({ unread, load })",
      cause: 'On the server, the module is evaluated once per process and shared by all concurrent requests. One user’s data stayed in the ref and was serialized into another user’s HTML.',
      fix: 'Keep per-user state in Pinia or Nuxt <code>useState</code> (request-scoped), or inside the composable function.',
      fixCode: "export const useNotifications = defineStore('notifications', () => {\n  const unread = ref<Notification[]>([])\n  async function load() { unread.value = await $fetch('/api/notifications') }\n  return { unread, load }\n})" },
    { title: 'Window resize listeners pile up',
      symptom: 'After navigating between pages for a while, the app gets sluggish; the performance panel shows hundreds of resize handlers.',
      diagnose: "export function useWindowWidth() {\n  const w = ref(window.innerWidth)\n  window.addEventListener('resize', () => (w.value = window.innerWidth))\n  return w\n}",
      cause: 'Each mounted component added a listener; none was removed on unmount.',
      fix: 'Remove the listener in <code>onScopeDispose</code> (or use VueUse’s <code>useWindowSize</code>).',
      fixCode: "export function useWindowWidth() {\n  const w = ref(window.innerWidth)\n  const on = () => (w.value = window.innerWidth)\n  window.addEventListener('resize', on, { passive: true })\n  onScopeDispose(() => window.removeEventListener('resize', on))\n  return w\n}" }
  ],
  puzzles: [
    { kind: 'what renders', q: 'Two components each call <code>useCounter()</code> (state created inside the function). A’s button is clicked twice. What do A and B show?', code: "export function useCounter() {\n  const n = ref(0)\n  return { n, inc: () => n.value++ }\n}", options: ['A: 2, B: 2', 'A: 2, B: 0', 'A: 1, B: 1', 'A: 0, B: 0'], answer: 1, explain: 'Each call creates its own ref. Composables share logic, not state.' },
    { kind: 'what renders', q: 'Same, but <code>const n = ref(0)</code> is moved above the function, at module level. A is clicked twice. Now?', options: ['A: 2, B: 0', 'A: 2, B: 2', 'A: 0, B: 2', 'Error'], answer: 1, explain: 'One module, one ref, shared by every caller. That is a tiny global store (and an SSR leak risk).' },
    { kind: 'concept', q: 'What is available to the template in <code>&lt;script setup&gt;</code>?', options: ['Only what you return', 'Top-level bindings: variables, functions, imports (including components)', 'Only refs', 'Only what is passed to defineExpose'], answer: 1, explain: 'All top-level bindings are exposed to the template. <code>defineExpose</code> controls what a <i>parent</i> can access via a template ref.' },
    { kind: 'concept', q: 'Which signature lets a composable react to a changing prop?', options: ['useUser(id: number)', 'useUser(id: MaybeRefOrGetter<number>) and read toValue(id) inside a watcher', 'useUser(id: string)', 'useUser(this.id)'], answer: 1, explain: 'Callers pass <code>() => props.id</code> or a ref; <code>toValue</code> unwraps it inside a tracking context, so changes re-run.' },
    { kind: 'concept', q: 'Main drawback of mixins that composables fix?', options: ['Mixins are slower', 'Implicit property sources and name collisions; unclear where this.x comes from', 'Mixins can’t use data()', 'Mixins don’t work in Vue 2'], answer: 1, explain: 'Composable return values are explicit and can be renamed on destructure: <code>const { data: user } = useFetch(…)</code>.' },
    { kind: 'concept', q: 'Is the Options API removed in Vue 3?', options: ['Yes', 'No: it is fully supported and built on top of the Composition API internally', 'Only in Vue 3.5', 'Only data() is removed'], answer: 1, explain: 'Both are supported. You can even disable Options API support at build time with the <code>__VUE_OPTIONS_API__</code> flag to save bytes.' }
  ],
  interview: [
    { q: 'Options API vs Composition API?', a: '<ul><li><b>Options</b>: sections and <code>this</code>; easy to start; logic for one feature is scattered; reuse via mixins.</li><li><b>Composition</b>: functions in setup; group by feature; reuse via composables; better TS inference.</li></ul><p>Both are supported in Vue 3.</p>', lvl: 'core' },
    { q: 'What does <code>&lt;script setup&gt;</code> compile to?', a: '<p>A component with a <code>setup()</code> function whose top-level bindings are exposed to the render function. Macros like <code>defineProps</code> are compiled into options. The template is compiled inline into the same scope, so it accesses bindings directly (faster than a proxy lookup).</p>', lvl: 'deep' },
    { q: 'What makes a good composable?', a: '<ul><li>Named <code>useX</code>, called synchronously in setup.</li><li>Accepts refs/getters (<code>MaybeRefOrGetter</code>) and reads with <code>toValue</code>.</li><li>Returns a plain object of refs (destructure-friendly).</li><li>Cleans up side effects (<code>onScopeDispose</code>).</li><li>SSR-safe: no module-level per-user state, guard <code>window</code>.</li></ul>', lvl: 'core' },
    { q: 'Why must composables be called synchronously in setup?', a: '<p>Hooks like <code>onMounted</code> and watchers attach to the <b>current instance</b>, a global set while setup runs. After an <code>await</code>, that global may be cleared or point at another component. <code>&lt;script setup&gt;</code> with top-level await restores the instance after the first await by compiler magic, but plain functions don’t.</p>', lvl: 'deep' },
    { q: 'What is effectScope?', a: '<p>An API to group effects (computeds, watchers) so they can be stopped together. Components use one internally. Libraries use <code>effectScope()</code> for state outside components; <code>onScopeDispose</code> registers cleanup for the active scope.</p>', lvl: 'deep' },
    { q: 'Composables vs Pinia stores?', a: '<p>A composable gives each caller fresh state (unless you deliberately hoist it). A Pinia store is a singleton per app (per request on SSR) with DevTools, plugins and SSR serialization. Use composables for reusable logic, stores for shared app state.</p>', lvl: 'core' },
    { q: 'How do you test a composable?', a: '<p>If it uses only reactivity, call it directly in a test and assert on refs. If it uses lifecycle hooks or inject, mount a tiny host component (or a helper that calls it inside <code>setup</code>). Await <code>nextTick()</code> or <code>flushPromises()</code> for async updates.</p>', lvl: 'deep' },
    { q: 'What is VueUse?', a: '<p>A popular community collection of composables (<code>useStorage</code>, <code>useDebounceFn</code>, <code>useEventListener</code>, <code>useIntersectionObserver</code>…). Good reference for idiomatic composable design.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'useFetch composable', lang: 'ts', code: "import { ref, watchEffect, toValue, type MaybeRefOrGetter } from 'vue'\n\nexport function useFetch<T>(url: MaybeRefOrGetter<string>) {\n  const data = ref<T | null>(null)\n  const error = ref<Error | null>(null)\n  const loading = ref(false)\n\n  watchEffect(async (onCleanup) => {\n    const ctrl = new AbortController()\n    onCleanup(() => ctrl.abort())\n    const u = toValue(url)            // tracked: read before the first await\n    loading.value = true; error.value = null\n    try {\n      const res = await fetch(u, { signal: ctrl.signal })\n      if (!res.ok) throw new Error(`HTTP ${res.status}`)\n      data.value = await res.json()\n    } catch (e) {\n      if ((e as Error).name !== 'AbortError') error.value = e as Error\n    } finally { loading.value = false }\n  })\n  return { data, error, loading }\n}\n\n// usage: const { data: order } = useFetch<Order>(() => `/api/orders/${props.id}`)" },
    { title: 'Options API → script setup', lang: 'text', code: "<!-- Options API -->\nexport default {\n  props: ['id'],\n  data: () => ({ order: null }),\n  computed: { total() { return this.order?.total ?? 0 } },\n  async mounted() { this.order = await api.get(this.id) }\n}\n\n<!-- script setup -->\n<script setup lang=\"ts\">\nconst props = defineProps<{ id: number }>()\nconst order = ref<Order | null>(null)\nconst total = computed(() => order.value?.total ?? 0)\nonMounted(async () => { order.value = await api.get(props.id) })\n</script>" },
    { title: 'Testing a composable (Vitest)', lang: 'ts', code: "import { describe, it, expect } from 'vitest'\nimport { useCounter } from './useCounter'\n\ndescribe('useCounter', () => {\n  it('increments', () => {\n    const { n, inc } = useCounter(1)\n    inc()\n    expect(n.value).toBe(2)\n  })\n})" }
  ]
});
