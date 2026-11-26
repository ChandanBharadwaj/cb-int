IA.register({
  track: 'vue',
  slug: 'vue-what-is-vue',
  title: 'What Vue is',
  tagline: 'Vue is a <b>progressive</b> JavaScript framework for building user interfaces. You describe the UI as a function of <b>reactive state</b>; Vue keeps the DOM in sync. You can drop it into one page or build a whole app with Router, Pinia and Nuxt.',
  tldr: {
    problem: 'Hand-written DOM code (<code>document.querySelector</code>, <code>innerHTML</code>, event listeners) turns into spaghetti once several parts of a page depend on the same data. Every change needs you to remember every place to update.',
    model: '<b>UI = f(state)</b>. You declare state with <code>ref()</code>/<code>reactive()</code> and write a template. Vue tracks which state each component reads, and re-renders <b>only</b> those components when that state changes.',
    hook: '“How is Vue different from React?” Vue tracks dependencies automatically (reactive proxies), uses HTML-based templates compiled ahead of time, and ships official Router and store libraries. React re-runs component functions on state change and leaves more choices to the ecosystem.',
    facts: [
      { v: '2014', l: 'first public release, by Evan You. Vue 3.0 shipped in September 2020' },
      { v: 'Dec 31 2023', l: 'Vue 2 end of life. New projects should use Vue 3' },
      { v: 'MIT', l: 'licence for Vue core, Vue Router, Pinia and Vite' }
    ]
  },
  intro: {
    what: 'A web page is a tree of elements, the <b>DOM</b>. A frontend framework lets you describe what that tree should look like for the current data, and updates it for you when data changes. Vue is one such framework. Think of it as the view layer of an MVC app, but running in the browser and updating live.',
    analogy: { icon: '📊', title: 'A spreadsheet', text: 'In a spreadsheet, cell C1 is <code>=A1*B1</code>. Change A1 and C1 updates by itself; you never “call” C1. Vue templates work the same way: <code>{{ price * qty }}</code> re-evaluates when <code>price</code> or <code>qty</code> changes.' },
    steps: [
      { t: 'State', d: 'Variables Vue watches. Like fields on a Java bean, but changes are observed.', code: "import { ref } from 'vue'\nconst count = ref(0)" },
      { t: 'Template', d: 'HTML with placeholders and directives. It is compiled into a render function.', code: '<button @click="count++">Clicked {{ count }} times</button>', lang: 'text' },
      { t: 'Component', d: 'A reusable piece of UI with its own state and template, usually one <code>.vue</code> file. Apps are trees of components.' },
      { t: 'Reactivity', d: 'When <code>count</code> changes, Vue re-renders the component that read it and patches only the changed DOM.' },
      { t: 'Ecosystem', d: 'Add <b>Vue Router</b> for pages, <b>Pinia</b> for shared state, <b>Vite</b> for tooling, <b>Nuxt</b> for server rendering. All optional.' }
    ],
    terms: [
      ['DOM', 'The browser’s live tree of page elements. Changing it is what makes the screen change.'],
      ['SPA', 'Single-page app: the server sends one HTML shell; JavaScript renders every “page” in the browser.'],
      ['component', 'A self-contained UI unit (template + logic + style). Like a class you instantiate many times.'],
      ['virtual DOM', 'A lightweight JS copy of the DOM. Vue compares old and new copies and applies the difference.'],
      ['SFC', 'Single-File Component: a <code>.vue</code> file with <code>&lt;template&gt;</code>, <code>&lt;script&gt;</code> and <code>&lt;style&gt;</code>.'],
      ['reactivity', 'Automatic tracking of which code reads which state, so changes re-run exactly that code.']
    ]
  },
  visual: {
    title: 'What “progressive” means, and Vue’s core loop',
    caption: 'Pick a view and press Play. <b>Progressive adoption</b> stacks the optional layers. <b>State → DOM loop</b> shows a click becoming a DOM patch without you touching the DOM.'
  },
  gotchas: [
    { trap: 'Following Vue 2 tutorials', why: 'Much old content uses <code>new Vue()</code>, filters, <code>Vue.set</code>, <code>$on</code> event buses and Vuex. Vue 3 removed or replaced all of these, and Vue 2 is end-of-life.', fix: 'Check the date and look for <code>createApp</code> and <code>&lt;script setup&gt;</code>. Use Pinia instead of Vuex, mitt or props/emits instead of <code>$on</code>.' },
    { trap: 'Mixing Vue and manual DOM writes', code: "onMounted(() => {\n  document.querySelector('#total')!.textContent = '42'  // Vue will overwrite this\n})", why: 'Vue owns the DOM it renders. Its next patch is based on the virtual DOM, not on what you wrote, so your change is lost or causes mismatches.', fix: 'Change state, let the template show it. Use template refs only for things Vue can’t express (focus, measuring, third-party widgets).' },
    { trap: 'Expecting SEO from a plain SPA', why: 'A Vite + Vue SPA ships an almost empty <code>index.html</code>. Crawlers that don’t run JavaScript, and link previews, see nothing useful.', fix: 'Use SSR or static generation (Nuxt, or Vue’s SSR APIs) for public, content-heavy pages. Internal tools are fine as SPAs.' },
    { trap: 'Picking the Options API from old docs for new TS code', why: 'Both styles work in Vue 3, but TypeScript inference and code reuse are simpler with the Composition API in <code>&lt;script setup&gt;</code>. Mixed styles in one codebase confuse reviewers.', fix: 'Pick <code>&lt;script setup lang="ts"&gt;</code> as the team default. See <a href="vue-composition-api.html">Composition API</a>.' },
    { trap: 'Thinking Vue is “just for small apps”', why: 'The progressive story starts small, so it is often filed as a toy. Large apps are built with Vue + TS + Router + Pinia, and Nuxt for SSR.', fix: 'Judge on architecture: typed components, stores, routing, tests. The same practices as any large frontend.' }
  ],
  scenarios: [
    { title: 'Admin page randomly reverts a value the user just saw change',
      symptom: 'A legacy jQuery snippet updates a price label. A second later the old price is back.',
      diagnose: "// legacy.js\n$('#price').text(newPrice)\n// Price.vue renders: <span id=\"price\">{{ price }}</span>",
      cause: 'Two owners of one DOM node. When any reactive state used by that component changes, Vue re-renders and patches the label from <code>price</code>, which never changed.',
      fix: 'Route the update through Vue state: expose a store or event, and let the component render it.',
      fixCode: "// legacy code calls into the store instead of the DOM\nimport { usePriceStore } from '@/stores/price'\nusePriceStore().setPrice(newPrice)" },
    { title: 'Marketing pages invisible in link previews',
      symptom: 'Shared links on chat apps show a blank card. Search console shows thin content.',
      diagnose: 'curl https://example.com/pricing | grep -c "Pricing"   # 0: only <div id="app"></div>',
      cause: 'Pages were built as a client-only SPA. Bots that do not execute JS see the empty shell.',
      fix: 'Move public pages to SSR or pre-rendering (e.g. Nuxt with route rules), keep the logged-in app as SPA.',
      fixCode: "// nuxt.config.ts\nexport default defineNuxtConfig({\n  routeRules: { '/pricing': { prerender: true }, '/app/**': { ssr: false } }\n})" }
  ],
  puzzles: [
    { kind: 'concept', q: 'What does “progressive framework” mean for Vue?', options: ['It upgrades itself automatically', 'You can adopt it incrementally: from one widget on a page up to a full SPA or SSR app', 'It only supports progressive web apps', 'It renders progressively, line by line'], answer: 1, explain: 'Vue’s core is small and usable on its own. Router, Pinia, build tooling and SSR are optional layers you add as needs grow.' },
    { kind: 'what renders', q: 'Clicking the button once shows what?', code: "<script setup lang=\"ts\">\nimport { ref } from 'vue'\nconst count = ref(0)\n</script>\n<template>\n  <button @click=\"count++\">{{ count * 2 }}</button>\n</template>", lang: 'text', options: ['0', '1', '2', 'NaN'], answer: 2, explain: 'The template auto-unwraps the ref, so <code>count++</code> increments <code>count.value</code> to 1 and <code>{{ count * 2 }}</code> renders 2.' },
    { kind: 'concept', q: 'When <code>count</code> changes, what does Vue re-render?', options: ['The whole page', 'Every component in the app', 'The components whose render read <code>count</code> (then it patches only the DOM that differs)', 'Nothing; you call <code>render()</code> yourself'], answer: 2, explain: 'Vue tracks reads during render per component. A change triggers only the dependent components’ render effects; the virtual DOM diff then limits DOM writes.' },
    { kind: 'concept', q: 'Which is the official state management library recommended for Vue 3?', options: ['Vuex 5', 'Redux', 'Pinia', 'MobX'], answer: 2, explain: 'Pinia is the official recommendation. Vuex is in maintenance mode; Vuex 5 was never released, and Pinia took its place.' },
    { kind: 'concept', q: 'A Spring Boot app serves Thymeleaf pages. You want one interactive filter widget on one page. Simplest Vue approach?', options: ['Rewrite the site as a Nuxt app', 'Load Vue from a script tag (or a small Vite build) and mount an app on that widget’s element', 'It is impossible without a full SPA', 'Use Vue only on the server'], answer: 1, explain: 'This is the progressive use case: <code>createApp(...).mount(\'#filter\')</code> on one element. The rest of the page stays server-rendered.' },
    { kind: 'concept', q: 'Which statement about Vue templates is TRUE?', options: ['They are interpreted at runtime by parsing HTML strings in production', 'In a Vite build they are compiled ahead of time into JavaScript render functions', 'They cannot contain JavaScript expressions', 'They are the same as JSX'], answer: 1, explain: 'With SFCs, <code>@vitejs/plugin-vue</code> compiles templates at build time, so production ships render functions plus compiler optimisation hints. Expressions are allowed; JSX is an optional alternative.' }
  ],
  interview: [
    { q: 'What is Vue, in one minute?', a: '<p>A progressive JavaScript framework for UIs. You write components with reactive state and HTML-based templates; Vue compiles templates to render functions, tracks which state each render reads, and re-renders only affected components, patching the DOM through a virtual DOM diff.</p>', lvl: 'core' },
    { q: 'Vue vs React?', a: '<ul><li><b>Reactivity:</b> Vue tracks dependencies automatically with proxies; React re-runs a component when its state or parent changes, and you optimise with <code>memo</code>/<code>useMemo</code>.</li><li><b>Templates vs JSX:</b> Vue templates are compiled with static hints; React uses JSX (JS all the way).</li><li><b>Ecosystem:</b> Vue has official Router and Pinia; React leaves choices to the community.</li></ul>', fu: 'Which one re-renders a child when the parent re-renders? React by default; Vue only if the child’s props actually changed or it reads changed state.', lvl: 'core' },
    { q: 'Vue vs Angular?', a: '<p>Angular is a full, opinionated platform: TypeScript-first, dependency injection, RxJS, its own CLI and module system. Vue is lighter and incremental: you add Router, Pinia and tooling as needed. Both have moved toward fine-grained reactivity (Angular signals, Vue refs).</p>', lvl: 'core' },
    { q: 'What changed from Vue 2 to Vue 3?', a: '<ul><li>Proxy-based reactivity (detects new keys and array index writes).</li><li>Composition API and <code>&lt;script setup&gt;</code>.</li><li><code>createApp</code> instead of a global <code>new Vue</code>.</li><li>Fragments (multiple root nodes), Teleport, Suspense.</li><li>Better TypeScript support, smaller tree-shakable core.</li></ul>', lvl: 'core' },
    { q: 'Why does Vue still use a virtual DOM if it knows exactly which state changed?', a: '<p>Reactivity is tracked per <b>component</b>, not per DOM node. Inside a component the render function re-runs and the diff finds what changed. The compiler marks static nodes and dynamic bindings (patch flags, hoisting) so the diff skips most of the tree. Vue has an experimental no-VDOM “Vapor mode” that compiles to direct DOM updates.</p>', fu: 'Is Vapor mode production-ready? Treat it as experimental unless you have checked the current release notes.', lvl: 'deep' },
    { q: 'What is an SFC and why is it useful?', a: '<p>A <code>.vue</code> file holding one component’s <code>&lt;template&gt;</code>, <code>&lt;script setup&gt;</code> and optionally <code>&lt;style scoped&gt;</code>. It co-locates what changes together, enables compile-time template checks and optimisations, and needs a build step (Vite).</p>', lvl: 'core' },
    { q: 'When would you not pick a client-side SPA?', a: '<p>Public content pages where SEO, link previews and first paint matter: use SSR or static generation (Nuxt). Also simple forms where server-rendered HTML plus a sprinkle of JS is enough.</p>', lvl: 'core' },
    { q: 'Name the main pieces of the Vue ecosystem.', a: '<ul><li><b>Vite</b>: dev server and build.</li><li><b>Vue Router</b>: routing.</li><li><b>Pinia</b>: stores.</li><li><b>Vitest + Vue Test Utils</b>: tests.</li><li><b>Nuxt</b>: SSR / full-stack meta-framework.</li><li><b>Vue DevTools</b>: inspect components, state, timelines.</li></ul>', lvl: 'core' },
    { q: 'How does a Vue app talk to a Spring Boot backend?', a: '<p>Over HTTP (usually JSON via <code>fetch</code> or axios). In dev, Vite’s <code>server.proxy</code> forwards <code>/api</code> to <code>localhost:8080</code> to avoid CORS. In prod, either serve <code>dist/</code> from the same origin (Spring <code>static/</code> or a reverse proxy) or configure CORS.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Smallest Vue app (no build)', lang: 'text', code: "<div id=\"app\">\n  <button @click=\"count++\">Clicked {{ count }} times</button>\n</div>\n<script type=\"module\">\n  import { createApp, ref } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js'\n  createApp({ setup() { return { count: ref(0) } } }).mount('#app')\n</script>", note: 'The in-browser template compiler build. Fine for a widget; use Vite for real apps.' },
    { title: 'The same thing as an SFC', lang: 'text', code: "<!-- Counter.vue -->\n<script setup lang=\"ts\">\nimport { ref } from 'vue'\nconst count = ref(0)\n</script>\n\n<template>\n  <button @click=\"count++\">Clicked {{ count }} times</button>\n</template>\n\n<style scoped>\nbutton { font-weight: 600; }\n</style>" },
    { title: 'Calling a Spring Boot API', lang: 'ts', code: "import { ref, onMounted } from 'vue'\n\ninterface Order { id: number; total: number }\nconst orders = ref<Order[]>([])\n\nonMounted(async () => {\n  const res = await fetch('/api/orders')   // proxied to :8080 in dev\n  if (!res.ok) throw new Error(`HTTP ${res.status}`)\n  orders.value = await res.json()\n})" }
  ]
});
