IA.register({
  track: 'vue',
  slug: 'vue-pinia',
  title: 'State with Pinia',
  tagline: 'Pinia is Vue’s official store: a <b>singleton reactive object per app</b> with state, getters and actions, visible in DevTools and safe for SSR. Learn when state belongs in a store and when it should stay in props.',
  tldr: {
    problem: 'Some state is needed by components that are far apart (the cart badge in the header and the cart page). Passing it through props and events across the tree becomes brittle.',
    model: 'A store is created lazily, once per Pinia instance, and cached by id. Its state is a <code>reactive()</code> object, getters are <code>computed</code>, actions are methods. Components read it reactively; DevTools records every action.',
    hook: '“Why does my total stop updating after <code>const { total } = useCart()</code>?” Destructuring a reactive store copies values. Use <code>storeToRefs()</code>.',
    facts: [
      { v: 'Pinia 2 / 3', l: 'Pinia 3 (2025) drops Vue 2 support and requires Vue 3; the store API is the same as Pinia 2' },
      { v: '1 per id', l: 'store instance per Pinia instance; on the server you need one Pinia per request' },
      { v: 'no mutations', l: 'unlike Vuex: actions change state directly, sync or async' }
    ]
  },
  intro: {
    what: 'Components each have their own local state. When several unrelated components need the <b>same</b> data (logged-in user, cart, feature flags), you put it in a <b>store</b>: one shared object outside any component. <b>Pinia</b> is the official store library for Vue 3 and replaced Vuex.',
    analogy: { icon: '🗄️', title: 'A Spring singleton service with observable fields', text: 'Think of a <code>@Service</code> bean holding state: every component that asks for it gets the same instance. The difference: when its fields change, every screen that displayed them re-renders automatically.' },
    steps: [
      { t: 'Install once', d: '<code>app.use(createPinia())</code> in <code>main.ts</code>.' },
      { t: 'Define a store', d: 'Give it a unique id. The setup style returns refs (state), computeds (getters) and functions (actions).', code: "export const useCounter = defineStore('counter', () => {\n  const count = ref(0)\n  const double = computed(() => count.value * 2)\n  function inc() { count.value++ }\n  return { count, double, inc }\n})" },
      { t: 'Use it in a component', d: '<code>const counter = useCounter()</code>, then <code>counter.count</code>, <code>counter.inc()</code>. No <code>.value</code>: the store unwraps refs.' },
      { t: 'Destructure safely', d: '<code>const { count } = storeToRefs(counter)</code> keeps reactivity. Actions can be destructured directly.' }
    ],
    terms: [
      ['store', 'A named, shared, reactive container of state and logic.'],
      ['state', 'The raw data in a store (refs in setup stores, <code>state()</code> in option stores).'],
      ['getter', 'A computed value derived from state, cached until its inputs change.'],
      ['action', 'A method that changes state; can be async and call other stores.'],
      ['storeToRefs', 'Turns a store’s state and getters into refs so destructuring stays reactive.'],
      ['$patch / $reset', 'Apply several changes at once / restore initial state (option stores; setup stores need their own reset).']
    ]
  },
  visual: {
    title: 'One store, many readers',
    caption: '<b>Shared store</b>: watch a store being created lazily, an action running, and only readers re-rendering. <b>storeToRefs</b>: see why plain destructuring freezes a value. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Destructuring the store', code: "const cart = useCart()\nconst { total } = cart              // ✗ number, frozen\nconst { total } = storeToRefs(cart) // ✓ Ref<number>", why: 'The store is a reactive proxy. Destructuring reads each property once and stores the plain value.', fix: '<code>storeToRefs()</code> for state and getters; destructure actions directly, or just use <code>cart.total</code>.' },
    { trap: 'Calling useStore() at module level', code: "// api.ts\nconst auth = useAuthStore()   // ✗ runs at import, before app.use(pinia)\nexport const http = () => fetch(url, { headers: { Authorization: auth.token } })", why: 'At import time there is no active Pinia yet (“getActivePinia() was called but there was no active Pinia”). On the server it would also share one store across requests.', fix: 'Call <code>useAuthStore()</code> inside the function that needs it. In guards and plugins that run after <code>app.use(pinia)</code> it is fine.' },
    { trap: 'Setup store forgets to return state', why: 'Only returned refs become store state. A ref kept private is invisible to DevTools and is not serialized for SSR hydration. Pinia requires all state to be returned.', fix: 'Return every ref the store owns. Keep truly private data in a separate private store if you must.' },
    { trap: '$reset() missing in setup stores', why: '<code>$reset()</code> is built in for option stores only. In setup stores Pinia cannot know the initial state, and calling it throws in development.', fix: 'Write your own <code>reset()</code> action that reassigns each ref, or use an option store if you rely on <code>$reset</code>.' },
    { trap: 'Everything goes into the store', why: 'Form drafts, a dropdown’s open flag, a list filtered for one page: putting them in a global store makes components hard to reuse and leaks state between screens.', fix: 'Default to local state and props. Promote to a store when unrelated components share it, it must survive navigation, or it is server cache you want to deduplicate.' },
    { trap: 'Mutating a getter result', why: 'A getter returning an array returns the same array object; pushing to it may mutate state behind your back, or is lost on recompute.', fix: 'Treat getter results as read-only. Change state only in actions.' }
  ],
  scenarios: [
    { title: 'User A sees User B’s cart (SSR)',
      symptom: 'After moving to server rendering, a customer reported another person’s name and cart on first page load. It only happened under load.',
      diagnose: "// plugins/store.ts (custom SSR setup)\nconst pinia = createPinia()          // module scope: shared by every request\nexport default (app) => app.use(pinia)",
      cause: 'One Pinia instance lived for the whole server process, so stores were singletons across requests: the same bug as mutable static state in a servlet.',
      fix: 'Create a new app and a new Pinia per request (Nuxt’s <code>@pinia/nuxt</code> module does this). Serialize <code>pinia.state.value</code> into the HTML and restore it on the client.',
      fixCode: "export function createApp() {\n  const app = createSSRApp(App)\n  const pinia = createPinia()     // per request\n  app.use(pinia)\n  return { app, pinia }\n}" },
    { title: 'Order total badge stuck at 0',
      symptom: 'The header badge always shows 0 items, although the cart page lists three.',
      diagnose: "const { count } = useCartStore()   // in Header.vue",
      cause: 'Destructuring copied the initial number out of the store’s reactive proxy.',
      fix: 'Use <code>storeToRefs</code>. Add a lint rule (eslint-plugin-vue / a custom rule) or a code-review checklist item.',
      fixCode: "const { count } = storeToRefs(useCartStore())" }
  ],
  puzzles: [
    { kind: 'predict', q: 'Header and Footer both call <code>useCart()</code>. Footer calls <code>cart.add(x)</code>. Does Header re-render its <code>{{ cart.count }}</code>?', options: ['No: each call creates a new store', 'Yes: both got the same store instance', 'Only if Header calls <code>cart.$subscribe</code>', 'Only after a route change'], answer: 1, explain: 'The first <code>useCart()</code> creates the store; later calls return the cached instance from the active Pinia. Header tracked <code>count</code> while rendering.' },
    { kind: 'predict', q: 'What does the template show after clicking +?', code: "<script setup lang=\"ts\">\nconst store = useCounter()\nlet { count } = store\nfunction plus() { store.inc() }\n</script>\n<template><button @click=\"plus\">{{ count }}</button></template>", lang: 'text', options: ['1', '0', 'undefined', 'Error'], answer: 1, explain: '<code>count</code> is a plain number copied at setup time. The store’s count becomes 1, but the template reads the local copy: <b>0</b>.' },
    { kind: 'concept', q: 'Which part of a setup store becomes a getter?', options: ['Every function', 'Every <code>computed()</code> returned', 'Every <code>ref()</code>', 'Anything starting with <code>get</code>'], answer: 1, explain: 'refs → state, computeds → getters, functions → actions. Naming does not matter.' },
    { kind: 'concept', q: 'You call <code>store.$reset()</code> on a setup store. What happens?', options: ['State goes back to the initial values', 'It throws (dev) because setup stores have no built-in $reset', 'Only getters are reset', 'The store is destroyed'], answer: 1, explain: 'Pinia cannot replay a setup function’s initial values. Define your own reset action.' },
    { kind: 'concept', q: 'Why does Pinia not need Vuex-style mutations?', options: ['It uses immutable state', 'Reactivity tracks direct changes and DevTools records actions and patches', 'Mutations moved to getters', 'It only supports sync code'], answer: 1, explain: 'Vuex used mutations so DevTools could track sync changes. Pinia’s DevTools integration tracks actions and state changes directly, so the extra layer was dropped.' },
    { kind: 'concept', q: 'Data is needed only by a parent and its two direct children. Best choice?', options: ['A Pinia store', 'Props down, events up', 'A global window variable', 'localStorage'], answer: 1, explain: 'Short, explicit data flow is easiest to read and test. A store would add hidden coupling for no gain.' }
  ],
  interview: [
    { q: 'Pinia vs Vuex?', a: '<ul><li>No mutations; actions change state directly.</li><li>No nested modules: many flat stores that import each other.</li><li>First-class TypeScript inference without wrappers.</li><li>Setup stores use the Composition API.</li><li>Vuex 4 still works but is in maintenance mode; Pinia is the recommended store for Vue 3.</li></ul>', lvl: 'core' },
    { q: 'Option store vs setup store?', a: '<p>Option stores (<code>state</code>, <code>getters</code>, <code>actions</code> objects) are simple and give you <code>$reset</code>. Setup stores are a function returning refs, computeds and functions: you can use watchers and composables inside, but you must return all state and write your own reset.</p>', lvl: 'core' },
    { q: 'When should state go in Pinia instead of a component?', a: '<p>When unrelated components share it, it must survive route changes, it is session-wide (auth, preferences), or you want one cache for server data. Keep UI-only and page-only state local. A big store of everything is the frontend equivalent of a god object.</p>', lvl: 'core' },
    { q: 'How do stores work with SSR?', a: '<p>One Pinia per request, created with the app. After rendering, <code>pinia.state.value</code> is serialized into the HTML; on the client it is assigned before stores are used, so they start from the server state (hydration). Nuxt’s <code>@pinia/nuxt</code> does this. Non-serializable state (functions, class instances) needs care.</p>', lvl: 'deep' },
    { q: 'How does one store use another?', a: '<p>Call <code>useOtherStore()</code> inside a getter or action (or at the top of a setup store). Avoid two stores that both read each other during setup, because that is a circular initialization.</p>', lvl: 'deep' },
    { q: 'What are <code>$patch</code>, <code>$subscribe</code> and <code>$onAction</code>?', a: '<p><code>$patch(obj | fn)</code> applies several changes as one DevTools entry. <code>$subscribe(cb)</code> runs after state changes (e.g. persist to localStorage). <code>$onAction(cb)</code> hooks before/after actions, with <code>after</code> and <code>onError</code> callbacks: good for logging and analytics.</p>', lvl: 'deep' },
    { q: 'How do you test components that use stores?', a: '<p>Unit-test the store with <code>setActivePinia(createPinia())</code>. For components, use <code>createTestingPinia()</code> from <code>@pinia/testing</code> as a plugin in <code>mount()</code>: actions become spies (stubbed by default) and you can set initial state. See <a href="vue-testing.html">Testing Vue</a>.</p>', lvl: 'core' },
    { q: 'Should server data (API responses) live in Pinia?', a: '<p>It can, but you then own caching, invalidation, loading and error states yourself. Many teams use a query library (TanStack Query for Vue, Pinia Colada) or Nuxt’s <code>useFetch</code> for server state, and keep Pinia for client state (auth, UI preferences, drafts).</p>', lvl: 'deep' },
    { q: 'Why is <code>storeToRefs</code> needed but <code>toRefs</code> is not enough?', a: '<p><code>toRefs(store)</code> would also wrap actions and store internals. <code>storeToRefs</code> picks only state and getters and returns refs linked to them.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Auth store (setup style)', lang: 'ts', code: `import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<{ id: string; name: string; roles: string[] } | null>(null)
  const token = ref<string | null>(null)
  const isLoggedIn = computed(() => !!token.value)
  const roles = computed(() => user.value?.roles ?? [])

  async function login(email: string, password: string) {
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }) })
    if (!res.ok) throw new Error('Login failed: ' + res.status)
    const body = await res.json()
    token.value = body.token; user.value = body.user
  }
  function reset() { user.value = null; token.value = null }

  return { user, token, isLoggedIn, roles, login, reset }
})`, note: 'Prefer an HttpOnly session cookie from your Spring backend over keeping tokens in JS memory or localStorage, which XSS can read.' },
    { title: 'Using it in a component', lang: 'ts', code: `<script setup lang="ts">
import { storeToRefs } from 'pinia'
const auth = useAuthStore()
const { user, isLoggedIn } = storeToRefs(auth)   // reactive refs
const { login } = auth                            // actions: plain destructure
</script>

<template>
  <span v-if="isLoggedIn">Hi {{ user?.name }}</span>
  <button v-else @click="login(email, pw)">Sign in</button>
</template>` }
  ]
});
