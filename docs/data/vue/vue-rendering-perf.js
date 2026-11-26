IA.register({
  track: 'vue',
  slug: 'vue-rendering-perf',
  title: 'Rendering & performance',
  tagline: 'Vue uses a virtual DOM, but its <b>compiler</b> tells the runtime which parts can change, so updates cost proportional to the dynamic parts. When that is not enough you have opt-in tools: <code>shallowRef</code>, <code>v-memo</code>, <code>KeepAlive</code>, virtual lists and lazy loading.',
  tldr: {
    problem: 'Big tables, dashboards and long feeds feel sluggish: typing lags, scrolling stutters, the first load downloads megabytes of JavaScript.',
    model: 'Two separate costs. <b>Update cost</b>: how many VNodes are re-rendered and diffed per change (keep reactive dependencies narrow, components small, lists keyed). <b>Load cost</b>: how much JS must download and run before interaction (code splitting, lazy components, SSR/lazy hydration).',
    hook: '“Is Vue’s virtual DOM slow?” Vue’s compiler-informed VDOM skips static content and diffs only dynamic bindings (patch flags + block tree). Most slow Vue apps re-render far too much, or render 10,000 rows that are not visible.',
    facts: [
      { v: 'per component', l: 'is the re-render granularity: a change re-renders only components that depend on it, not the whole tree' },
      { v: 'v-memo', l: '(Vue 3.2+) skips re-rendering a sub-tree unless one of its dependency values changed' },
      { v: '3.5', l: 'added lazy hydration strategies for async components (<code>hydrateOnVisible</code>, <code>hydrateOnIdle</code>…)' }
    ]
  },
  intro: {
    what: 'A browser page is a tree of elements (the DOM). Changing the DOM is relatively slow. Vue keeps a lightweight copy in JavaScript (the <b>virtual DOM</b>), re-creates the parts that might have changed, compares them with the previous copy, and applies only the differences to the real DOM. Performance work means making that “re-create and compare” step small, and shipping less code.',
    analogy: { icon: '📝', title: 'Proofreading with a highlighter', text: 'Instead of re-reading the whole contract after every edit, the compiler highlights the only blanks that can change (names, dates). On each revision Vue checks just the highlighted blanks.' },
    steps: [
      { t: 'Measure first', d: 'Vue DevTools “Performance” and component render timings, the browser Performance panel, Lighthouse for load.' },
      { t: 'Keep lists keyed and small', d: '<code>:key="item.id"</code>, paginate or virtualize long lists.' },
      { t: 'Narrow reactive dependencies', d: 'Pass components only the props they use; avoid passing a big object whose unrelated fields change.' },
      { t: 'Use the opt-in tools', d: '<code>shallowRef</code> for big data, <code>v-memo</code>/<code>v-once</code> for heavy sub-trees, <code>KeepAlive</code> for tabs.' },
      { t: 'Ship less JS', d: 'Lazy routes, <code>defineAsyncComponent</code>, tree-shaken imports.' }
    ],
    terms: [
      ['VNode', 'A plain JS object describing an element or component in the virtual DOM.'],
      ['patch', 'Comparing old and new VNodes and updating the real DOM.'],
      ['patch flag', 'A compiler hint on a VNode saying what can change (text, class, props…).'],
      ['block tree', 'Compiler structure that collects dynamic descendants into a flat list for fast diffing.'],
      ['virtual scrolling', 'Rendering only the rows visible in the viewport (plus a buffer).'],
      ['hydration', 'Making server-rendered HTML interactive on the client.']
    ]
  },
  visual: {
    title: 'What the compiler lets Vue skip',
    caption: '<b>Compiler hints</b> shows static content being skipped and dynamic nodes tracked in a block. <b>Opt-in tools</b> walks <code>shallowRef</code>, <code>v-memo</code>, <code>KeepAlive</code> and lazy loading. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Using index as key', code: '<Row v-for="(r, i) in rows" :key="i" :row="r" />', lang: 'text', why: 'Insert at the top and every index shifts: Vue patches every row, and stateful children (inputs, expanded state) end up attached to the wrong item.', fix: 'Use a stable unique id: <code>:key="r.id"</code>.' },
    { trap: 'Passing a whole big object as a prop', why: 'A child that receives <code>:order="order"</code> re-renders when any field it reads changes, and with a new object each time (spread, map) it re-renders on every parent render.', fix: 'Pass primitives the child needs (<code>:status="order.status"</code>), and keep object identities stable. Vue 3.4+ computeds that return the same primitive no longer trigger.' },
    { trap: 'v-memo with missing dependencies', code: '<div v-for="r in rows" :key="r.id" v-memo="[r.id === sel]">\n  {{ r.name }} {{ r.price }}   <!-- price change is ignored! -->\n</div>', lang: 'text', why: 'Inside a memoized sub-tree nothing re-renders unless a listed dep changes.', fix: 'List every value the sub-tree depends on, or do not memoize. Measure before using it; it is for lists of hundreds or thousands.' },
    { trap: 'Rendering 10,000 rows', why: 'Even a perfect diff is slow when there are 10,000 components and 100,000 DOM nodes. Memory and layout cost dominate.', fix: 'Paginate, or virtualize (e.g. <code>vue-virtual-scroller</code>, TanStack Virtual), so only ~30 rows exist at a time.' },
    { trap: 'KeepAlive without max', why: 'Every visited tab or route stays in memory with its state and listeners. Long sessions grow until the tab gets slow.', fix: '<code>&lt;KeepAlive :max="5"&gt;</code> (LRU eviction), and <code>include</code> only the components that benefit.' },
    { trap: 'v-if vs v-show chosen at random', why: '<code>v-if</code> destroys and recreates (cheap when hidden, costly to toggle). <code>v-show</code> renders once and toggles CSS <code>display</code> (cheap to toggle, always costs initial render).', fix: 'Toggled often → <code>v-show</code>. Rarely shown → <code>v-if</code>.' }
  ],
  scenarios: [
    { title: 'Typing in the search box lags 300 ms per key',
      symptom: 'An orders grid with 2,000 rows and a search input in the same component. Each keystroke freezes the UI.',
      diagnose: 'Vue DevTools: the grid component re-renders on every input, and each re-render creates 2,000 row VNodes with formatted dates.',
      cause: 'The search text lives in the same component as the grid, so every keystroke re-renders the grid’s template; date formatting runs in the template for every row.',
      fix: 'Move the input into its own component, debounce the filter, precompute formatted fields once, and paginate or virtualize the grid.',
      fixCode: "const query = ref('')\nconst debounced = refDebounced(query, 200)       // @vueuse/core\nconst visible = computed(() => filterRows(rows.value, debounced.value).slice(0, 100))" },
    { title: 'Dashboard memory climbs to 2 GB over a workday',
      symptom: 'Ops staff keep the dashboard open all day; the tab gets slower until it crashes.',
      diagnose: 'Heap snapshot: thousands of detached chart instances and proxied arrays of metrics.',
      cause: 'Every poll appended new samples to a deeply reactive array (never trimmed), and charts inside <code>&lt;KeepAlive&gt;</code> tabs were never destroyed.',
      fix: 'Store samples in a <code>shallowRef</code>, keep a fixed window (ring buffer), <code>markRaw</code> chart instances and dispose them in <code>onDeactivated</code>/<code>onUnmounted</code>, and set <code>KeepAlive :max</code>.',
      fixCode: "const samples = shallowRef<Sample[]>([])\nfunction push(s: Sample) { samples.value = [...samples.value.slice(-999), s] }" }
  ],
  puzzles: [
    { kind: 'concept', q: 'A parent re-renders because its own state changed. Does a child with unchanged props re-render?', options: ['Always, like React without memo', 'No: Vue skips child components whose props did not change', 'Only if it uses slots', 'Only in production'], answer: 1, explain: 'Vue compares props (shallowly) when patching a component VNode and skips the child’s render if nothing changed. Children receiving slot content are an exception: they update when the parent re-renders the slot.' },
    { kind: 'predict', q: 'After this code, how many times has the list re-rendered?', code: "const rows = shallowRef([1, 2, 3])\nrows.value.push(4)\nrows.value[0] = 9", options: ['0', '1', '2', '3'], answer: 0, explain: '<code>shallowRef</code> tracks only <code>.value</code> assignment. In-place mutations trigger nothing; use <code>triggerRef(rows)</code> or assign a new array.' },
    { kind: 'concept', q: 'What does <code>v-once</code> do?', options: ['Renders the element only on the server', 'Renders the element and its children once, then treats them as static', 'Debounces updates', 'Runs a watcher once'], answer: 1, explain: 'Bindings inside <code>v-once</code> are evaluated once and skipped forever after. <code>v-memo="[]"</code> is equivalent.' },
    { kind: 'concept', q: 'A switched-out component inside <code>&lt;KeepAlive&gt;</code> receives which hooks?', options: ['onUnmounted, then onMounted on return', 'onDeactivated, then onActivated on return', 'onBeforeUpdate', 'No hooks at all'], answer: 1, explain: 'Cached components are not unmounted. Pause timers and subscriptions in <code>onDeactivated</code> and resume in <code>onActivated</code>.' },
    { kind: 'concept', q: 'Why are templates often faster than hand-written render functions in Vue 3?', options: ['Templates run in WebAssembly', 'The compiler adds patch flags, static caching and block trees that hand-written render functions usually lack', 'Render functions are not reactive', 'Templates skip the virtual DOM entirely'], answer: 1, explain: 'The template compiler can analyze what is static. Hand-written <code>h()</code> calls or JSX cannot give those hints automatically, so the runtime must fully diff.' },
    { kind: 'bug', q: 'Selecting a row in a 5,000-row memoized list does not highlight it. Why?', code: '<tr v-for="r in rows" :key="r.id" v-memo="[r.name]" :class="{ sel: r.id === selectedId }">', lang: 'text', options: ['v-memo cannot be used with v-for', 'selectedId is not in the v-memo deps, so the row never re-renders', 'class bindings are static', ':key must come after v-memo'], answer: 1, explain: 'The memo key only contains <code>r.name</code>. Add <code>r.id === selectedId</code> to the array.' },
    { kind: 'concept', q: 'Which change reduces time-to-interactive the most for a large SPA landing page?', options: ['Switching all refs to reactive', 'Lazy-loading routes and heavy components so the initial bundle is smaller', 'Adding more computeds', 'Using index keys'], answer: 1, explain: 'Load performance is dominated by JS size and parse/execute time. Code splitting moves code off the critical path.' }
  ],
  interview: [
    { q: 'How does Vue 3’s virtual DOM differ from a “classic” one?', a: '<p>It is <b>compiler-informed</b>: static content is created once and skipped, dynamic nodes carry patch flags naming exactly what to compare, and blocks collect dynamic descendants into flat arrays, so diffing skips the static tree structure. Structural directives (<code>v-if</code>, <code>v-for</code>) start new blocks. Vue calls this approach “compiler-informed virtual DOM”.</p>', lvl: 'deep' },
    { q: 'What is the granularity of re-rendering in Vue?', a: '<p>The component. Reactive tracking tells Vue exactly which components read the changed state; only their render functions re-run. Splitting a large component into children limits re-render scope, which is the main structural optimization.</p>', lvl: 'core' },
    { q: 'When do you use shallowRef?', a: '<p>For large data you replace rather than mutate (API responses, big arrays, immutable structures) and for external objects you do not want proxied. It avoids creating proxies for every nested object. You must assign a new value (or call <code>triggerRef</code>) to update.</p>', lvl: 'core' },
    { q: 'How does v-memo work, and when is it worth it?', a: '<p>It caches the VNode sub-tree with the deps array; on re-render, if every dep is <code>Object.is</code> equal, Vue reuses the old VNodes and skips the diff for that sub-tree. Worth it mainly in long <code>v-for</code> lists where a change (selection) affects few rows. Wrong deps cause stale UI.</p>', lvl: 'deep' },
    { q: 'How would you speed up a table with 10,000 rows?', a: '<ol><li>Is 10,000 needed? Paginate server-side (Spring Data <code>Pageable</code>).</li><li>Virtualize so ~30 rows are in the DOM.</li><li><code>shallowRef</code> for row data; precompute display fields.</li><li>Stable keys; small row components with primitive props.</li><li><code>v-memo</code> for selection.</li></ol>', lvl: 'core' },
    { q: 'What does KeepAlive cost and save?', a: '<p>Saves: re-creating component state, re-fetching data, scroll and form input on return. Costs: memory and anything still running (timers, sockets) in the hidden component. Use <code>include</code>/<code>exclude</code>/<code>max</code>, and pause work in <code>onDeactivated</code>.</p>', lvl: 'core' },
    { q: 'What load-time optimizations apply to a Vue app?', a: '<ul><li>Route-level code splitting (<code>() =&gt; import()</code>).</li><li><code>defineAsyncComponent</code> for heavy widgets (charts, editors).</li><li>Tree-shakeable imports (named imports, no full lodash).</li><li>SSR or SSG for first paint, plus lazy hydration (3.5) for below-the-fold parts.</li><li>HTTP caching with hashed file names (Vite does this by default).</li></ul>', lvl: 'core' },
    { q: 'Vapor Mode?', a: '<p>An experimental compilation mode being developed for Vue that compiles templates to direct DOM operations without a virtual DOM, similar to Solid or Svelte. It is opt-in per component and was shipped as experimental in the Vue 3.6 previews; check the current release notes for its status before recommending it.</p>', lvl: 'deep' },
    { q: 'How do you find what is re-rendering too often?', a: '<p>Vue DevTools: the timeline’s component events and the performance view with render/patch timings (enable <code>app.config.performance = true</code> in dev). <code>onRenderTriggered((e) =&gt; console.log(e))</code> in a component tells you which key triggered a re-render.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Selection in a big list with v-memo', lang: 'ts', code: `<script setup lang="ts">
const rows = shallowRef<Row[]>([])
const selectedId = ref<number | null>(null)
onMounted(async () => { rows.value = await api.rows() })
</script>

<template>
  <div v-for="r in rows" :key="r.id"
       v-memo="[r.id === selectedId, r.version]"
       :class="{ sel: r.id === selectedId }" @click="selectedId = r.id">
    {{ r.name }} · {{ r.total }}
  </div>
</template>`, note: '<code>r.version</code> stands for whatever changes when a row’s data changes; with <code>shallowRef</code> rows are replaced, so the version or a new row object changes.' },
    { title: 'Heavy widget, lazy and lazily hydrated (3.5)', lang: 'ts', code: `import { defineAsyncComponent, hydrateOnVisible } from 'vue'

const SalesChart = defineAsyncComponent({
  loader: () => import('./SalesChart.vue'),
  hydrate: hydrateOnVisible(),     // SSR only: hydrate when scrolled into view
  delay: 200,                       // show loadingComponent after 200 ms
  timeout: 10_000,
})`, note: 'In a plain SPA, <code>hydrate</code> is ignored; the chunk still loads lazily when the component first renders.' },
    { title: 'Debug which dependency triggered a render', lang: 'ts', code: `import { onRenderTriggered } from 'vue'
onRenderTriggered((e) => {
  // dev only: e.target, e.key, e.type ('set' | 'add' | ...), e.newValue
  console.debug('[render]', e.type, e.key, e.newValue)
})` }
  ]
});
