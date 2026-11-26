IA.register({
  track: 'vue',
  slug: 'vue-ssr-nuxt',
  title: 'SSR & Nuxt',
  tagline: 'Server-side rendering sends <b>real HTML</b> first and then <b>hydrates</b> it into a live Vue app. Nuxt (3 and 4) wraps that in conventions: file-based routes, server API routes, <code>useFetch</code> and per-request state. Most SSR bugs are about state shared between requests and output that differs between server and client.',
  tldr: {
    problem: 'A plain SPA shows a blank page until JavaScript downloads and runs, which hurts first paint on slow devices, SEO for public pages and link previews.',
    model: 'Per request, the server creates a <b>fresh app</b>, runs components (awaiting data), and streams HTML plus a serialized <b>payload</b>. The browser paints immediately, loads JS, and <b>hydrates</b>: it renders virtually and attaches to the existing DOM instead of recreating it. Server and client must produce the same markup.',
    hook: '“What causes a hydration mismatch?” Anything that renders differently on server and client: dates and timezones, <code>Math.random()</code>, <code>window</code>/<code>localStorage</code> checks, user-agent-dependent markup.',
    facts: [
      { v: 'Nuxt 4', l: '(released July 2025) moved app code into an <code>app/</code> directory by default; Nuxt 3 uses the project root' },
      { v: 'Nitro', l: 'is Nuxt’s server engine; it runs in Node, serverless and edge runtimes' },
      { v: '1 app / request', l: 'on the server: module-level mutable state leaks between users' }
    ]
  },
  intro: {
    what: 'With an <b>SPA</b> the server sends an almost empty HTML page and the browser builds everything with JavaScript. With <b>SSR</b> (server-side rendering) the server runs your Vue components and sends finished HTML, so content appears before the JavaScript is ready. <b>Nuxt</b> is the full-stack framework on top of Vue that sets this up for you, a bit like Spring Boot does for Spring.',
    analogy: { icon: '🏠', title: 'A furnished show home', text: 'SPA: you get an empty plot and a truck of parts; the house is built in front of you. SSR: you walk into a furnished show home immediately, but the lights work only once the electrician (JavaScript) arrives and wires everything up (hydration).' },
    steps: [
      { t: 'Pages from files', d: '<code>pages/users/[id].vue</code> becomes the route <code>/users/:id</code>. No router config.' },
      { t: 'Fetch data the SSR way', d: '<code>const { data } = await useFetch(\'/api/users/1\')</code> runs on the server, and the result is reused on the client.' },
      { t: 'Server routes', d: '<code>server/api/users/[id].get.ts</code> is an API endpoint (Nitro), handy as a backend-for-frontend in front of your Spring services.' },
      { t: 'Shared state', d: '<code>useState(\'key\', () =&gt; init)</code> is SSR-safe, per-request state that is transferred to the client.' },
      { t: 'Choose rendering per route', d: '<code>routeRules</code>: SSR, prerender (static), SWR caching or client-only per path.' }
    ],
    terms: [
      ['SSR', 'Rendering HTML on the server for each request.'],
      ['SSG / prerender', 'Rendering HTML at build time for static hosting.'],
      ['hydration', 'Attaching the client app to server-rendered HTML.'],
      ['payload', 'Serialized data and state from the server, embedded in the HTML for the client.'],
      ['Nitro', 'Nuxt’s server engine: API routes, middleware, deploy presets.'],
      ['universal code', 'Code that runs on both server and client; must not touch <code>window</code> at the top level.']
    ]
  },
  visual: {
    title: 'From request to interactive page',
    caption: '<b>SSR + hydration</b> follows one request through Nitro, <code>useFetch</code>, HTML + payload and hydration. <b>Mismatch</b> shows the classic date bug and its fixes. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Module-level state on the server', code: "// composables/user.ts\nconst user = ref<User | null>(null)   // ✗ one per server process\nexport const useUser = () => user", why: 'The module is evaluated once per server process and shared by every request, so one user’s data can be served to another.', fix: 'Use <code>useState(\'user\', () =&gt; null)</code> or a Pinia store (with <code>@pinia/nuxt</code>), both created per request.' },
    { trap: 'Touching window/localStorage during setup', why: 'Setup runs on the server, where <code>window</code> and <code>document</code> do not exist: “window is not defined”.', fix: 'Move browser-only code to <code>onMounted</code> (client only), guard with <code>import.meta.client</code>, or wrap components in <code>&lt;ClientOnly&gt;</code>. Name a plugin <code>*.client.ts</code> to run it only in the browser.' },
    { trap: 'Using $fetch in setup instead of useFetch', code: "const data = await $fetch('/api/items')   // runs on server AND again on client", why: '<code>$fetch</code> is a plain HTTP call: during SSR it runs on the server, then again during hydration, and its result is not in the payload.', fix: 'In component setup use <code>useFetch</code>/<code>useAsyncData</code>, which dedupe by key and transfer the result. Use <code>$fetch</code> in event handlers (e.g. form submit).' },
    { trap: 'Non-deterministic render output', why: 'Dates, random ids, locale formatting and “is logged in” checks from cookies read only on the client produce different HTML and a hydration mismatch.', fix: 'Render the same thing on both sides: format with a fixed timezone/locale, use <code>useId()</code> (3.5) for ids, read cookies with <code>useCookie</code> (works on both sides).' },
    { trap: 'Forgetting cookies on server-side API calls', why: 'During SSR, <code>useFetch(\'/api/me\')</code> to an <i>external</i> API runs from the server, which does not automatically forward the user’s cookies or headers.', fix: 'Calls to the app’s own server routes forward headers for you. For external APIs, forward explicitly with <code>useRequestHeaders([\'cookie\'])</code> or proxy through a Nitro route.' },
    { trap: 'Thinking SSR makes the app faster everywhere', why: 'SSR improves first contentful paint, but adds server CPU, and the page is not interactive until hydration. A huge bundle still delays interaction.', fix: 'Use SSR/prerender for public, content-heavy pages; consider <code>ssr: false</code> routes for logged-in dashboards. Keep bundles small and use lazy hydration.' }
  ],
  scenarios: [
    { title: 'Customers see another customer’s name in the header',
      symptom: 'Rare reports: after login, the header briefly shows a different person’s name. Cannot reproduce locally with one user.',
      diagnose: "grep -rn \"^const .* = ref(\" composables/   # module-scope refs",
      cause: 'A composable kept the current user in a module-level <code>ref</code>. On the server it was shared by concurrent requests.',
      fix: 'Replace with <code>useState</code> (or a Pinia store). Add a load test with two users in parallel asserting each response’s header.',
      fixCode: "export const useCurrentUser = () => useState<User | null>('current-user', () => null)" },
    { title: 'Hydration mismatch warnings flood the console',
      symptom: '“Hydration text content mismatch” on every product page; prices flicker from “$1,299.00” to “1.299,00 $”.',
      cause: 'Prices were formatted with the default locale: <code>en-US</code> on the Node server, the user’s browser locale on the client.',
      fix: 'Determine the locale once per request (from the URL or <code>Accept-Language</code>), store it with <code>useState</code>, and pass it explicitly to <code>Intl.NumberFormat</code>.',
      fixCode: "const locale = useState('locale', () => useRequestHeaders(['accept-language'])['accept-language']?.split(',')[0] ?? 'en-US')\nconst fmt = computed(() => new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'USD' }))" },
    { title: 'API hit twice per page view after migrating to Nuxt',
      symptom: 'Backend request counts doubled for the catalog service after the Nuxt rollout.',
      diagnose: "const items = await $fetch('/api/catalog')   // in <script setup>",
      cause: 'Plain <code>$fetch</code> in setup ran on the server during SSR, then again on the client during hydration.',
      fix: 'Switch to <code>useFetch</code>, which stores the server result in the payload and skips the client fetch during hydration.',
      fixCode: "const { data: items } = await useFetch('/api/catalog')" }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which hook runs on the client only?', options: ['setup', 'onServerPrefetch', 'onMounted', 'onBeforeMount on the server'], answer: 2, explain: 'There is no DOM on the server, so <code>onMounted</code> and <code>onUpdated</code> never run there. Setup runs on both sides.' },
    { kind: 'concept', q: 'What does hydration do?', options: ['Re-renders the page from scratch and replaces the HTML', 'Builds the virtual DOM on the client and attaches it to existing DOM nodes, adding event listeners', 'Downloads CSS', 'Sends client state back to the server'], answer: 1, explain: 'Hydration reuses the server’s DOM nodes. That is why output must match: Vue expects to find the same nodes.' },
    { kind: 'predict', q: 'A page has <code>const { data } = await useFetch(\'/api/x\')</code>. With SSR, how many requests to <code>/api/x</code> happen for the initial page load?', options: ['0', '1 (on the server; the client reads the payload)', '2 (server and client)', 'It depends on the browser cache'], answer: 1, explain: 'The server fetches during render and serializes the result. On hydration <code>useFetch</code> finds its key in the payload and does not refetch.' },
    { kind: 'bug', q: 'Why does this crash during SSR?', code: "<script setup lang=\"ts\">\nconst saved = localStorage.getItem('draft')\n</script>", lang: 'text', options: ['localStorage needs await', 'localStorage does not exist on the server', 'script setup cannot read storage', 'It needs useState'], answer: 1, explain: 'Setup runs on the server too. Read it in <code>onMounted</code>, or guard with <code>if (import.meta.client)</code>, accepting that the first render will not have it.' },
    { kind: 'concept', q: 'In Nuxt, what does <code>useState(\'cart\', () =&gt; [])</code> give you that <code>ref([])</code> at module scope does not?', options: ['Persistence in localStorage', 'Per-request state that is serialized to the client and shared between components by key', 'Deep watching', 'Automatic API sync'], answer: 1, explain: 'useState is SSR-safe: a new value per request on the server, transferred in the payload, shared across components on the client by key.' },
    { kind: 'concept', q: 'Which rendering suits a public marketing page that changes weekly?', options: ['Client-only SPA', 'Prerender (SSG) or SWR-cached SSR via routeRules', 'SSR with no caching, always', 'An iframe'], answer: 1, explain: 'Static or cached HTML is fastest and cheapest. Nuxt’s <code>routeRules</code> lets you mix strategies per path (e.g. <code>\'/blog/**\': { swr: 3600 }</code>).' }
  ],
  interview: [
    { q: 'SSR vs SPA vs SSG: trade-offs?', a: '<ul><li><b>SPA</b>: simplest hosting (static files), fast navigation after load, slow first paint, weak SEO.</li><li><b>SSR</b>: fast first paint, SEO, personalised HTML; needs a server, more complexity, hydration cost.</li><li><b>SSG</b>: HTML at build time, CDN-fast and cheap; only for content that is the same for everyone or rebuilt often.</li></ul><p>Nuxt lets you mix them per route.</p>', lvl: 'core' },
    { q: 'Why must SSR create a new app per request?', a: '<p>Because the server process serves many users concurrently. Any state in a singleton (app, router, Pinia, module-level refs) would leak between requests. Think of it as request scope vs singleton scope in Spring.</p>', lvl: 'core' },
    { q: 'What causes hydration mismatches and how do you fix them?', a: '<p>Server and client rendering different output: time, randomness, locale, browser-only APIs, invalid HTML that the browser auto-corrects (a <code>&lt;div&gt;</code> inside <code>&lt;p&gt;</code>, missing <code>&lt;tbody&gt;</code>). Fix by making renders deterministic, deferring client-only parts to <code>onMounted</code>/<code>&lt;ClientOnly&gt;</code>, and passing data through the payload. Vue 3.4+ gives detailed mismatch messages; 3.5 adds <code>data-allow-mismatch</code> for intentional ones.</p>', lvl: 'deep' },
    { q: 'useFetch vs useAsyncData vs $fetch?', a: '<p><code>$fetch</code> (ofetch): a plain HTTP client, for event handlers and server routes. <code>useAsyncData(key, fn)</code>: SSR-aware wrapper for any async function, dedupes by key and transfers results. <code>useFetch(url)</code>: <code>useAsyncData</code> + <code>$fetch</code> with a key derived from the URL and options; reactive URL/query refetch automatically. They return <code>data</code>, <code>error</code>, <code>status</code>, <code>refresh</code>.</p>', lvl: 'core' },
    { q: 'How do you put Nuxt in front of Spring Boot services?', a: '<p>Common shape: Nuxt server routes (<code>server/api/*</code>) as a backend-for-frontend, calling Spring APIs with forwarded auth, or <code>routeRules: { \'/api/**\': { proxy: \'http://spring:8080/api/**\' } }</code>. Keep auth in HttpOnly cookies; on SSR, forward the cookie when calling the backend.</p>', lvl: 'deep' },
    { q: 'What changed in Nuxt 4?', a: '<p>Nuxt 4 (2025) mostly refines Nuxt 3: the default <code>srcDir</code> is <code>app/</code> (pages, components, composables move there), <code>useAsyncData</code>/<code>useFetch</code> data is shared between calls with the same key and defaults to <code>undefined</code> instead of <code>null</code>, and TypeScript projects are split per context. Migration is usually incremental; Nuxt 3 could opt in early with <code>future.compatibilityVersion: 4</code>.</p>', lvl: 'deep' },
    { q: 'What is streaming SSR and does Vue support it?', a: '<p>Sending HTML in chunks as it is rendered, so the browser starts parsing earlier. Vue’s server renderer has streaming APIs (<code>renderToNodeStream</code>, <code>renderToWebStream</code>); <code>&lt;Suspense&gt;</code> coordinates async setup. Nuxt mostly renders whole responses and caches them.</p>', lvl: 'deep' },
    { q: 'What is lazy (partial) hydration?', a: '<p>Hydrating parts of the page only when needed (visible, idle, on interaction), so below-the-fold widgets do not block interactivity. Vue 3.5 supports it for async components (<code>hydrateOnVisible</code>, <code>hydrateOnIdle</code>, <code>hydrateOnInteraction</code>, <code>hydrateOnMediaQuery</code>); Nuxt exposes it on lazy components too.</p>', lvl: 'deep' },
    { q: 'How do you handle authentication with SSR?', a: '<p>Use cookies, not localStorage, so the server can see the session on the first request. In Nuxt, read with <code>useCookie</code>, validate in a server middleware or route middleware, and forward the cookie when calling backends during SSR. Do not cache personalised HTML at the CDN.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Nuxt page with useFetch', lang: 'ts', code: `<!-- app/pages/products/[id].vue (Nuxt 4; pages/ in Nuxt 3) -->
<script setup lang="ts">
const route = useRoute()
const { data: product, status, error } = await useFetch(() => \`/api/products/\${route.params.id}\`, {
  key: () => 'product-' + route.params.id,
  pick: ['id', 'name', 'price'],          // only these fields go into the payload
})
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: 'Not found' })
useSeoMeta({ title: () => product.value?.name ?? 'Product' })
</script>

<template>
  <p v-if="status === 'pending'">Loading…</p>
  <h1 v-else>{{ product?.name }}</h1>
</template>`, note: 'A reactive URL (a getter) refetches when the param changes.' },
    { title: 'Server route proxying a Spring API', lang: 'ts', code: `// server/api/products/[id].get.ts  (Nitro)
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const cookie = getHeader(event, 'cookie') ?? ''
  return $fetch(\`\${useRuntimeConfig().backendUrl}/api/products/\${id}\`, {
    headers: { cookie },                   // forward the session to Spring
  })
})` },
    { title: 'Per-route rendering rules', lang: 'ts', code: `// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/':          { prerender: true },          // static at build time
    '/blog/**':   { swr: 3600 },                // cached SSR, revalidated hourly
    '/account/**':{ ssr: false },               // client-only dashboard
    '/api/legacy/**': { proxy: 'http://spring:8080/**' },
  },
  runtimeConfig: { backendUrl: 'http://spring:8080' },
})` }
  ]
});
