IA.register({
  track: 'vue',
  slug: 'vue-lifecycle',
  title: 'Lifecycle hooks',
  tagline: 'Every component is created, mounted into the DOM, updated many times and finally unmounted. <code>onMounted</code> is where the DOM first exists; <code>onUnmounted</code> is where you clean up what Vue doesn’t own. <code>nextTick()</code> waits for Vue’s batched DOM update.',
  tldr: {
    problem: 'Code that touches the DOM runs too early (element is <code>null</code>), code that reads the DOM right after a state change sees the old value, and timers or listeners keep running after the component is gone.',
    model: '<b>setup</b> (no DOM) → <b>onMounted</b> (DOM ready) → [state change → <b>onBeforeUpdate</b> → patch → <b>onUpdated</b>]* → <b>onBeforeUnmount</b> → <b>onUnmounted</b>. DOM updates are <b>async and batched</b>; <code>await nextTick()</code> to see them.',
    hook: '“Where do you fetch data?” In <code>&lt;script setup&gt;</code> (or a watcher with <code>immediate</code>) if you don’t need the DOM; that starts earlier than <code>onMounted</code>. On SSR, <code>onMounted</code> never runs on the server.',
    facts: [
      { v: 'child first', l: 'a child’s <code>onMounted</code> runs before its parent’s' },
      { v: 'microtask', l: 'Vue flushes queued updates in a microtask; <code>nextTick()</code> returns a Promise resolved after that flush' },
      { v: 'useTemplateRef', l: 'Vue 3.5+ API to get a template ref by name; it is <code>null</code> until mounted' }
    ]
  },
  intro: {
    what: 'Like a Spring bean has <code>@PostConstruct</code> and <code>@PreDestroy</code>, a Vue component has <b>lifecycle hooks</b>: functions Vue calls at specific moments. You register them inside <code>&lt;script setup&gt;</code>.',
    analogy: { icon: '🎭', title: 'An actor on stage', text: 'Setup is rehearsal (no audience, no stage). Mounted: the actor walks on stage, people can see them. Updated: costume changes during the show. Unmounted: they leave. Before leaving, they must take their props with them: that is your cleanup.' },
    steps: [
      { t: 'Setup: no DOM yet', d: 'Create state, start fetches, register hooks.', code: "const user = ref<User | null>(null)\nfetchUser().then(u => (user.value = u))" },
      { t: 'onMounted: DOM is there', d: 'Focus, measure, init a chart, add window listeners.', code: "const input = useTemplateRef<HTMLInputElement>('q')\nonMounted(() => input.value?.focus())\n// template: <input ref=\"q\">" },
      { t: 'Updates are batched', d: 'Change state, then <code>await nextTick()</code> before reading the DOM.', code: 'messages.value.push(m)\nawait nextTick()\nlist.value!.scrollTop = list.value!.scrollHeight' },
      { t: 'onUnmounted: clean up', d: 'Clear timers, remove listeners, close sockets.', code: 'const id = setInterval(poll, 5000)\nonUnmounted(() => clearInterval(id))' }
    ],
    terms: [
      ['mount', 'Insert the component’s DOM into the page.'],
      ['unmount', 'Remove it (v-if false, route change, list item removed).'],
      ['template ref', 'A handle to a DOM element or child component (<code>ref="name"</code>).'],
      ['nextTick', 'Promise that resolves after Vue applies pending DOM updates.'],
      ['KeepAlive', 'Caches components instead of unmounting; adds <code>onActivated</code>/<code>onDeactivated</code>.']
    ]
  },
  visual: {
    title: 'The lifecycle, the order, and the tick',
    caption: '<b>Hook timeline</b>: step through one component’s life and see when the DOM exists. <b>Parent / child order</b>: watch the console order. <b>nextTick</b>: see why the DOM lags one tick behind state.'
  },
  gotchas: [
    { trap: 'Accessing a template ref in setup', code: "const el = useTemplateRef<HTMLDivElement>('box')\nel.value!.offsetWidth   // TypeError: el.value is null", why: 'Setup runs before the first render. The element doesn’t exist yet.', fix: 'Read it in <code>onMounted</code>, or in a <code>watch(el, …)</code> (useful if the element is behind <code>v-if</code>).' },
    { trap: 'Reading the DOM right after changing state', code: "items.value.push(x)\nconsole.log(listEl.value!.children.length)   // still the old count", why: 'Vue batches DOM updates and applies them in a microtask after your synchronous code.', fix: '<code>await nextTick()</code> first, or use a <code>watch</code> with <code>flush: \'post\'</code>.' },
    { trap: 'No cleanup for timers and global listeners', code: "onMounted(() => {\n  window.addEventListener('scroll', onScroll)\n  setInterval(refresh, 10_000)\n})", why: 'Vue cleans up its own watchers and computed values on unmount, but not browser APIs. After 20 navigations you have 20 intervals.', fix: 'Pair each with <code>onUnmounted</code> (or <code>onBeforeUnmount</code>). Use <code>AbortController</code> to remove several listeners at once.' },
    { trap: 'Registering hooks asynchronously', code: "setTimeout(() => onMounted(init), 0)   // [Vue warn]: onMounted is called when there is no active component instance", why: 'Hooks attach to the instance that is currently running setup.', fix: 'Register all hooks synchronously during setup (composables included).' },
    { trap: 'Changing state in onUpdated', code: 'onUpdated(() => { height.value = el.value!.offsetHeight })  // triggers another update…', why: 'Writing reactive state in <code>onUpdated</code> causes another render, which calls <code>onUpdated</code> again: can loop (Vue stops recursive updates after a limit, with a warning).', fix: 'Use a computed, a <code>watch</code> with <code>flush: \'post\'</code> on the specific source, or a <code>ResizeObserver</code>.' },
    { trap: 'Expecting onMounted during SSR', why: 'On the server there is no DOM; only setup runs. <code>onMounted</code>/<code>onUpdated</code> run only in the browser after hydration.', fix: 'Put browser-only code (window, localStorage) in <code>onMounted</code>. Fetch SSR data in setup with <code>onServerPrefetch</code> or Nuxt’s <code>useFetch</code>.' }
  ],
  scenarios: [
    { title: 'Dashboard gets slower with every visit',
      symptom: 'Ops users who keep the SPA open all day report fan noise and lag. The backend sees 30× the expected polling traffic from one browser.',
      diagnose: "// LiveStats.vue\nonMounted(() => { setInterval(loadStats, 5000) })\n// navigating away and back mounts a NEW instance each time",
      cause: 'Each mount starts an interval; unmount never clears it. Old intervals keep polling and updating refs of dead components.',
      fix: 'Clear the interval on unmount, and pause polling when the tab is hidden.',
      fixCode: "let id: number | undefined\nonMounted(() => { id = window.setInterval(loadStats, 5000) })\nonUnmounted(() => clearInterval(id))\n// bonus: document.visibilityState === 'hidden' → skip" },
    { title: 'Chat doesn’t scroll to the newest message',
      symptom: 'After sending, the list scrolls to the second-to-last message.',
      diagnose: "messages.value.push(msg)\nlist.value!.scrollTop = list.value!.scrollHeight   // height before the new <li> exists",
      cause: 'The DOM had not been patched yet when <code>scrollHeight</code> was read.',
      fix: 'Wait for the flush.',
      fixCode: "messages.value.push(msg)\nawait nextTick()\nlist.value!.scrollTop = list.value!.scrollHeight" }
  ],
  puzzles: [
    { kind: 'concept', q: 'Parent contains one Child. In what order do these log?', code: "// Parent: onMounted(() => log('P mounted'))\n// Child:  onMounted(() => log('C mounted'))\n// both:   log('<name> setup') at the top of script setup", options: ['P setup, P mounted, C setup, C mounted', 'P setup, C setup, C mounted, P mounted', 'C setup, P setup, C mounted, P mounted', 'P setup, C setup, P mounted, C mounted'], answer: 1, explain: 'Setup/render is top-down; mounting completes bottom-up. The parent is mounted only when its subtree is in the DOM.' },
    { kind: 'what renders', q: 'What is logged?', code: "const n = ref(0)\nconst p = useTemplateRef<HTMLElement>('p')   // <p ref=\"p\">{{ n }}</p>\nasync function go() {\n  n.value = 1\n  console.log(p.value!.textContent)\n  await nextTick()\n  console.log(p.value!.textContent)\n}", options: ['1 then 1', '0 then 1', '0 then 0', '1 then 0'], answer: 1, explain: 'The DOM patch is queued. Before <code>nextTick</code> the text is still “0”; after the flush it is “1”.' },
    { kind: 'concept', q: 'A component is wrapped in <code>&lt;KeepAlive&gt;</code> and you switch away from it. Which hook runs?', options: ['onUnmounted', 'onDeactivated', 'onBeforeUpdate', 'None'], answer: 1, explain: 'KeepAlive caches the instance instead of destroying it. <code>onDeactivated</code> runs on leave, <code>onActivated</code> on return.' },
    { kind: 'concept', q: 'Where should <code>localStorage.getItem(…)</code> go in an SSR (Nuxt) component?', options: ['Top of script setup', 'onMounted (browser only)', 'onServerPrefetch', 'Anywhere'], answer: 1, explain: 'Setup also runs on the server, where <code>localStorage</code> doesn’t exist. <code>onMounted</code> runs only in the browser.' },
    { kind: 'concept', q: 'In a handler: <code>a.value++; b.value++; c.value++</code>. All three are used in one component’s template. How many re-renders?', options: ['3', '1', '0', 'Depends on order'], answer: 1, explain: 'The component’s update job is queued once and deduplicated; the flush happens after the synchronous code finishes.' },
    { kind: 'concept', q: 'Which is cleaned up automatically when a component unmounts?', options: ['setInterval started in onMounted', 'A watch() created synchronously in script setup', 'window.addEventListener', 'A WebSocket'], answer: 1, explain: 'Watchers and computed values created during setup belong to the component’s effect scope and stop on unmount. Browser resources are your job.' }
  ],
  interview: [
    { q: 'List the main Composition API lifecycle hooks.', a: '<p><code>onBeforeMount</code>, <code>onMounted</code>, <code>onBeforeUpdate</code>, <code>onUpdated</code>, <code>onBeforeUnmount</code>, <code>onUnmounted</code>; plus <code>onActivated</code>/<code>onDeactivated</code> (KeepAlive), <code>onErrorCaptured</code>, <code>onServerPrefetch</code> (SSR), and dev-only <code>onRenderTracked</code>/<code>onRenderTriggered</code>. There is no <code>onCreated</code>: setup itself is that moment.</p>', lvl: 'core' },
    { q: 'Options API names vs Composition API?', a: '<p><code>beforeCreate</code>/<code>created</code> → setup itself; <code>mounted</code> → <code>onMounted</code>; <code>beforeDestroy</code>/<code>destroyed</code> (Vue 2) were renamed <code>beforeUnmount</code>/<code>unmounted</code> in Vue 3.</p>', lvl: 'core' },
    { q: 'What does nextTick do and when do you need it?', a: '<p>Vue queues component updates and flushes them in a microtask. <code>nextTick()</code> returns a Promise that resolves after the current flush. Use it when you must read or manipulate the DOM right after changing state (scroll, focus a newly shown input, measure).</p>', lvl: 'core' },
    { q: 'Why does Vue batch updates?', a: '<p>Many state writes in one tick would otherwise cause many renders. The scheduler deduplicates jobs per component, sorts them parent-before-child, and runs pre-flush watchers, renders, then post-flush callbacks (<code>onMounted</code>/<code>onUpdated</code>, <code>flush: \'post\'</code> watchers).</p>', lvl: 'deep' },
    { q: 'Fetch in setup or onMounted?', a: '<p>If you don’t need the DOM, start in setup (or <code>watch(..., { immediate: true })</code>): it starts slightly earlier and runs on the server in SSR. Use <code>onMounted</code> for browser-only work. In Nuxt use <code>useFetch</code>/<code>useAsyncData</code> so data is fetched once on the server and reused on hydration.</p>', lvl: 'core' },
    { q: 'How do you handle errors from child components?', a: '<p><code>onErrorCaptured((err, instance, info) => …)</code> in an ancestor catches errors from descendants’ render, hooks, watchers and event handlers. Return <code>false</code> to stop propagation. <code>app.config.errorHandler</code> is the global fallback; send errors to your monitoring there.</p>', lvl: 'deep' },
    { q: 'How do you debug why a component re-rendered?', a: '<p><code>onRenderTriggered(e => console.log(e))</code> (dev only) logs which reactive key triggered the render; <code>onRenderTracked</code> lists dependencies. Vue DevTools shows the same in its timeline.</p>', lvl: 'deep' },
    { q: 'What happens to hooks with KeepAlive?', a: '<p>Cached components are not unmounted when hidden. <code>onDeactivated</code>/<code>onActivated</code> fire instead; <code>onMounted</code> runs once. Pause timers in <code>onDeactivated</code> and resume in <code>onActivated</code>.</p>', lvl: 'deep' },
    { q: 'Equivalents in Spring terms?', a: '<p>Setup ≈ constructor + <code>@PostConstruct</code> (no DOM). <code>onMounted</code> ≈ “after the app context is ready”. <code>onUnmounted</code> ≈ <code>@PreDestroy</code>: release resources the container doesn’t manage.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Third-party chart with cleanup', lang: 'ts', code: "import { onMounted, onBeforeUnmount, useTemplateRef, watch, shallowRef } from 'vue'\nconst props = defineProps<{ data: number[] }>()\nconst canvas = useTemplateRef<HTMLCanvasElement>('canvas')\nconst chart = shallowRef<Chart | null>(null)   // never make chart instances deeply reactive\n\nonMounted(() => { chart.value = new Chart(canvas.value!, { data: props.data }) })\nwatch(() => props.data, (d) => chart.value?.update(d))\nonBeforeUnmount(() => chart.value?.destroy())" , note: '<code>Chart</code> stands for any imperative library.' },
    { title: 'Listener cleanup with AbortController', lang: 'ts', code: "const ctrl = new AbortController()\nonMounted(() => {\n  window.addEventListener('resize', onResize, { signal: ctrl.signal })\n  window.addEventListener('keydown', onKey, { signal: ctrl.signal })\n})\nonUnmounted(() => ctrl.abort())   // removes both" },
    { title: 'Global error handler', lang: 'ts', code: "const app = createApp(App)\napp.config.errorHandler = (err, instance, info) => {\n  console.error('[vue]', info, err)\n  // report to your monitoring here\n}\napp.mount('#app')" }
  ]
});
