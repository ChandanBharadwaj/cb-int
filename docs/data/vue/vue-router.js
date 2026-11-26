IA.register({
  track: 'vue',
  slug: 'vue-router',
  title: 'Vue Router',
  tagline: 'Vue Router 4 maps URLs to components, runs a <b>pipeline of guards</b> before every navigation, and loads route code <b>lazily</b>. Most bugs come from one of three things: params are strings, the component is reused, and guards can redirect in a loop.',
  tldr: {
    problem: 'A single-page app has one HTML page, but users expect real URLs: bookmarkable, shareable, Back-button friendly, and protected by login.',
    model: 'A route table (like Spring <code>@RequestMapping</code>s) maps path patterns to components. Each navigation is an async transaction: <b>match → leave guards → beforeEach → beforeEnter → resolve lazy components → beforeResolve → confirm → afterEach → render</b>. Any guard can cancel or redirect.',
    hook: '“Why does my page show the old user after clicking Next?” Because <code>/users/1 → /users/2</code> reuses the same component instance and <code>onMounted</code> does not run again.',
    facts: [
      { v: 'Router 4', l: 'is the version for Vue 3; it uses <code>createRouter</code> and <code>createWebHistory</code>' },
      { v: 'string', l: 'is the type of every <code>route.params</code> value (or <code>string[]</code> for repeatable params)' },
      { v: 'return', l: 'value of a guard decides: <code>false</code> cancels, a location redirects, <code>true</code>/<code>undefined</code> continues (<code>next()</code> is legacy)' }
    ]
  },
  intro: {
    what: 'In a <b>single-page app</b> (SPA) the browser loads one HTML page once. When you click a link, JavaScript swaps the visible component and updates the URL, without asking the server for a new page. <b>Vue Router</b> is the official library that does this: you list routes (“<code>/users/:id</code> shows <code>UserView</code>”), and it renders the right component inside <code>&lt;RouterView&gt;</code>.',
    analogy: { icon: '🚉', title: 'A station with ticket gates', text: 'The route table is the departure board (which platform for which destination). Guards are ticket gates on the way: one checks you are logged in, another asks “leave without saving?”. Only after every gate opens do you reach the platform (the component renders).' },
    steps: [
      { t: 'Define routes', d: 'Each route has a <code>path</code> and a <code>component</code>. <code>:id</code> is a dynamic segment.', code: "const router = createRouter({\n  history: createWebHistory(),\n  routes: [\n    { path: '/', component: Home },\n    { path: '/users/:id', name: 'user', component: () => import('./UserView.vue') },\n  ],\n})\napp.use(router)" },
      { t: 'Render and link', d: '<code>&lt;RouterView/&gt;</code> is where the matched component appears. <code>&lt;RouterLink to="/users/42"&gt;</code> renders an <code>&lt;a&gt;</code> that navigates without a page reload.' },
      { t: 'Read the URL', d: '<code>useRoute()</code> gives the current location: <code>route.params.id</code>, <code>route.query.page</code>.' },
      { t: 'Navigate from code', d: '<code>useRouter().push({ name: \'user\', params: { id: 42 } })</code>. It returns a Promise.' },
      { t: 'Guard', d: 'A global <code>beforeEach</code> can redirect anonymous users to <code>/login</code>.' }
    ],
    terms: [
      ['route record', 'One entry in the routes array: path, component, children, meta.'],
      ['params vs query', '<code>/users/42</code> → params <code>{ id: "42" }</code>; <code>?page=2</code> → query <code>{ page: "2" }</code>.'],
      ['navigation guard', 'A function that runs before (or after) a navigation and can cancel or redirect it.'],
      ['history mode', '<code>createWebHistory</code> uses real paths (needs a server fallback); <code>createWebHashHistory</code> uses <code>#/path</code>.'],
      ['lazy route', 'A component given as <code>() =&gt; import(...)</code>, built into a separate chunk and loaded on first visit.'],
      ['meta', 'Free-form data on a route (e.g. <code>requiresAuth: true</code>) that guards can read.']
    ]
  },
  visual: {
    title: 'One navigation, step by step',
    caption: '<b>Navigation</b> walks the guard pipeline for <code>push(\'/users/42\')</code>, including the redirect to login. <b>Params reuse</b> shows why <code>onMounted</code> does not fire when only the id changes. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Treating params as numbers', code: "const id = route.params.id        // '42' (string)\nif (id === 42) { /* never true */ }", why: 'URLs are text. Router 4 never converts types. Repeatable params (<code>:ids+</code>) are <code>string[]</code>.', fix: 'Convert at the boundary: <code>Number(route.params.id)</code>, or map params to props with a function: <code>props: (r) =&gt; ({ id: Number(r.params.id) })</code>.' },
    { trap: 'Data not reloading when only params change', why: 'Navigating between URLs of the same route record reuses the component instance. <code>setup</code> and <code>onMounted</code> do not run again.', fix: '<code>watch(() =&gt; route.params.id, load, { immediate: true })</code>, or <code>onBeforeRouteUpdate</code>, or <code>&lt;RouterView :key="route.fullPath"/&gt;</code> to force remounts (costlier).' },
    { trap: 'Infinite redirect in beforeEach', code: "router.beforeEach((to) => {\n  if (!auth.isLoggedIn) return '/login'   // ✗ /login also hits this\n})", why: 'A redirect starts a new navigation, which runs <code>beforeEach</code> again, which redirects again.', fix: 'Only redirect when <code>to.meta.requiresAuth</code> (or when <code>to.name !== \'login\'</code>).' },
    { trap: 'Calling next() twice or mixing next() with return', why: 'In Router 4 the third <code>next</code> argument is optional and legacy. Calling it more than once, or calling it and also returning a value, gives warnings and unpredictable navigation.', fix: 'Drop <code>next</code>. Return <code>false</code>, a route location, or nothing. Guards may be <code>async</code>.' },
    { trap: 'History mode 404 on refresh', why: 'With <code>createWebHistory()</code>, reloading <code>/users/42</code> asks the server for that path. A plain static server or Spring Boot returns 404.', fix: 'Serve <code>index.html</code> for unknown non-API paths (nginx <code>try_files $uri /index.html</code>, or a Spring controller forwarding to <code>/index.html</code>). Add a client catch-all route <code>/:pathMatch(.*)*</code> for a real 404 page.' },
    { trap: 'Using useRoute() inside a guard or a store at module level', why: '<code>useRoute()</code>/<code>useRouter()</code> use inject, so they work only inside component setup.', fix: 'In global guards use the <code>to</code>/<code>from</code> arguments. Elsewhere import the router instance directly.' }
  ],
  scenarios: [
    { title: 'Login page spins forever after a deploy',
      symptom: 'Logged-out users see a blank page; the browser tab freezes and the console shows “Maximum call stack” or repeated navigation warnings.',
      diagnose: "router.beforeEach(async (to) => {\n  await auth.ensureSession()\n  if (!auth.user) return { name: 'login' }\n})",
      cause: 'A new guard redirected <i>every</i> route, including <code>login</code> itself, so each redirect triggered another one.',
      fix: 'Mark public routes with <code>meta: { public: true }</code> and skip them, or check <code>to.name</code>. Add an e2e test that opens <code>/login</code> logged out.',
      fixCode: "router.beforeEach(async (to) => {\n  if (to.meta.public) return\n  await auth.ensureSession()\n  if (!auth.user) return { name: 'login', query: { redirect: to.fullPath } }\n})" },
    { title: 'Order page shows the wrong order after “Next order”',
      symptom: 'Support agents edit order 1043 while the header says 1042. Some edits were saved to the wrong order.',
      diagnose: "onMounted(() => load(route.params.id))   // runs once per instance",
      cause: '<code>/orders/1042 → /orders/1043</code> reused the component; the id in the URL changed, the loaded data did not.',
      fix: 'Load from a watcher on the param, and send the id from the route, not from local state, when saving.',
      fixCode: "watch(() => route.params.id, (id) => load(String(id)), { immediate: true })" },
    { title: 'First click on “Reports” takes 4 seconds',
      symptom: 'The initial bundle got smaller after lazy routes were added, but the first visit to the Reports tab feels slow and sometimes fails after a deploy (“Failed to fetch dynamically imported module”).',
      cause: 'The Reports chunk includes a large charting library and is downloaded only on click. After a deploy, old tabs request chunk names that no longer exist.',
      fix: 'Prefetch likely chunks on idle or hover, keep previous build assets for a while after deploying, and handle <code>router.onError</code> for chunk load failures by reloading the target URL.',
      fixCode: "router.onError((err, to) => {\n  if (/Failed to fetch dynamically imported module/.test(String(err))) location.assign(to.fullPath)\n})" }
  ],
  puzzles: [
    { kind: 'predict', q: 'Route <code>/users/:id</code>, URL <code>/users/7?tab=2</code>. What is <code>typeof route.params.id</code> and <code>route.query.tab</code>?', options: ['number, 2', 'string, "2"', 'string, 2', 'number, "2"'], answer: 1, explain: 'Router 4 keeps everything from the URL as strings. Convert explicitly.' },
    { kind: 'concept', q: 'In which order do these run for a navigation that leaves PageA for lazy PageB?', options: ['beforeEach → beforeRouteLeave(A) → beforeEnter → beforeResolve', 'beforeRouteLeave(A) → beforeEach → beforeEnter → beforeRouteEnter(B) → beforeResolve → afterEach', 'beforeEnter → beforeEach → afterEach → beforeResolve', 'beforeResolve → beforeEach → beforeRouteLeave(A)'], answer: 1, explain: 'Leave guards of deactivated components first, then global <code>beforeEach</code>, then per-route <code>beforeEnter</code>, then the lazy component is resolved and its <code>beforeRouteEnter</code> runs, then global <code>beforeResolve</code>, confirmation, <code>afterEach</code>.' },
    { kind: 'concept', q: 'A <code>beforeEach</code> guard returns <code>\'/login\'</code>. What happens to the original <code>router.push(\'/admin\')</code> promise?', options: ['It rejects with an Error', 'It resolves after the redirect completes', 'It never settles', 'It resolves immediately with undefined'], answer: 1, explain: 'A redirect replaces the navigation; <code>push()</code> resolves when the final navigation finishes (it can resolve with a navigation failure object when cancelled, e.g. by returning <code>false</code>). It does not throw for normal guard redirects or cancellations.' },
    { kind: 'concept', q: 'User navigates <code>/users/1 → /users/2</code>, both on the same record. Which hook runs on UserView?', options: ['onMounted', 'onBeforeRouteUpdate', 'onBeforeRouteLeave', 'beforeEnter of the route'], answer: 1, explain: 'The instance is reused, so in-component <code>onBeforeRouteUpdate</code> runs. <code>beforeEnter</code> on the record only runs when entering the route from a different one.' },
    { kind: 'concept', q: 'Why define a route component as <code>() =&gt; import(\'./Reports.vue\')</code> rather than a static import?', options: ['It makes the component reactive', 'The bundler emits a separate chunk loaded on first navigation, shrinking the initial bundle', 'It enables SSR', 'Guards only work with lazy components'], answer: 1, explain: 'Dynamic import is a code-split point. The cost moves to the first visit of that route.' },
    { kind: 'bug', q: 'Refreshing <code>https://app.example.com/settings</code> gives a 404 from the server, but navigating there by clicking works. Why?', options: ['A guard rejects refreshes', 'Web history mode needs the server to return index.html for app paths', 'Hash mode is required for nested routes', 'The route needs a name'], answer: 1, explain: 'The click is handled in JavaScript; the refresh is a real HTTP request for <code>/settings</code>. Configure a fallback to <code>index.html</code>.' },
    { kind: 'concept', q: 'What does the route <code>{ path: \'/:pathMatch(.*)*\', component: NotFound }</code> do?', options: ['Matches only the root', 'Catches every unmatched path, with segments in params.pathMatch', 'Disables history mode', 'Redirects to the last route'], answer: 1, explain: 'It is Router 4’s catch-all (the Vue 2 <code>*</code> route no longer exists). Ranking puts more specific routes first, so it only gets what nothing else matched.' }
  ],
  interview: [
    { q: 'Describe the full navigation resolution flow.', a: '<ol><li>Navigation triggered</li><li><code>beforeRouteLeave</code> in deactivated components</li><li>global <code>beforeEach</code></li><li><code>beforeRouteUpdate</code> in reused components</li><li><code>beforeEnter</code> in route records</li><li>resolve async route components</li><li><code>beforeRouteEnter</code> in activated components</li><li>global <code>beforeResolve</code></li><li>confirm; global <code>afterEach</code></li><li>DOM update; <code>beforeRouteEnter</code> <code>next(vm =&gt; …)</code> callbacks</li></ol>', lvl: 'deep' },
    { q: 'How do you protect routes that need login?', a: '<p>Put <code>meta: { requiresAuth: true }</code> on records (child records inherit through <code>to.matched</code>; <code>to.meta</code> merges them). A global <code>beforeEach</code> checks the auth store and returns <code>{ name: \'login\', query: { redirect: to.fullPath } }</code>. This is UX only; the API must still enforce authorization, as your Spring Security config does.</p>', lvl: 'core' },
    { q: 'Hash vs web history mode?', a: '<p><code>createWebHashHistory</code>: URLs like <code>/#/users</code>; the server sees only <code>/</code>, so no server config, but uglier URLs and worse SEO. <code>createWebHistory</code>: clean URLs using the History API; needs a server fallback to <code>index.html</code>. <code>createMemoryHistory</code>: no URL, used for SSR and tests.</p>', lvl: 'core' },
    { q: 'What changed from Vue Router 3 to 4?', a: '<ul><li><code>new VueRouter</code> → <code>createRouter</code>; <code>mode</code> → <code>history: createWebHistory()</code></li><li>Catch-all <code>*</code> → <code>/:pathMatch(.*)*</code></li><li>Guards can return values; <code>next</code> is optional</li><li><code>router.push</code> always returns a Promise</li><li>Composition API: <code>useRoute</code>, <code>useRouter</code>, <code>onBeforeRouteLeave/Update</code></li></ul>', lvl: 'core' },
    { q: 'How do nested routes work?', a: '<p>A record with <code>children</code> renders its component, which contains its own <code>&lt;RouterView/&gt;</code> for the matched child. <code>/users/42/posts</code> matches <code>[UsersLayout, UserPosts]</code> in <code>route.matched</code>. Use it for layouts with tabs or sidebars.</p>', lvl: 'core' },
    { q: 'Should components read <code>route.params</code> directly?', a: '<p>It couples them to the router. With <code>props: true</code> (or a function) the router passes params as props, so the component is reusable and easy to test with plain props. Still watch for reuse: props update in place, so derive state with <code>computed</code>/<code>watch</code>.</p>', lvl: 'core' },
    { q: 'How does route ranking pick between overlapping paths?', a: '<p>Router 4 scores each path segment (static beats dynamic, dynamic beats custom regex like <code>(.*)</code>, more segments before fewer) and picks the highest score, regardless of declaration order. <code>/users/new</code> beats <code>/users/:id</code> even if declared after it.</p>', lvl: 'deep' },
    { q: 'How would you handle data loading for a route?', a: '<p>Options: fetch in the component (show a skeleton) with a param watcher; fetch in <code>beforeEnter</code>/<code>beforeResolve</code> so the page renders only with data (navigation waits, show a global progress bar); or use the experimental data loaders in newer Router versions. With Nuxt, <code>useFetch</code>/<code>useAsyncData</code> handle this with SSR. Always handle stale responses when params change quickly (abort or check the id).</p>', fu: 'How do you avoid a race when the user clicks Next twice? Track the latest id or use AbortController and ignore older responses.', lvl: 'deep' },
    { q: 'What is <code>scrollBehavior</code>?', a: '<p>A router option called after navigation that returns a position: <code>savedPosition</code> on Back/Forward, <code>{ el: to.hash }</code> for anchors, or <code>{ top: 0 }</code>. It can return a Promise to wait for content (e.g. after a transition).</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Router with auth and lazy routes', lang: 'ts', code: `import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' { interface RouteMeta { requiresAuth?: boolean; roles?: string[] } }

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/Login.vue') },
    { path: '/orders/:id(\\\\d+)', name: 'order', component: () => import('@/views/Order.vue'),
      props: (r) => ({ id: Number(r.params.id) }), meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/NotFound.vue') },
  ],
  scrollBehavior: (to, _from, saved) => saved ?? (to.hash ? { el: to.hash } : { top: 0 }),
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.roles && !to.meta.roles.some((r) => auth.roles.includes(r))) return false
})`, note: '<code>(\\\\d+)</code> in a JS string is the regex <code>\\d+</code>: only numeric ids match this route.' },
    { title: 'Spring Boot SPA fallback', lang: 'java', code: `@Controller
class SpaForwardController {
  // forward non-API, extension-less paths to the SPA entry point
  @GetMapping({ "/{p:^(?!api$)[^.]*}", "/{p:^(?!api$)[^.]*}/**" })
  String forward() { return "forward:/index.html"; }
}`, note: 'Needed with <code>createWebHistory()</code> when Spring serves the built app from <code>static/</code>. Adjust the pattern to your API prefix; newer Spring path-pattern parsers restrict <code>**</code> to the end of a pattern.' }
  ]
});
