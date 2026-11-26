IA.register({
  track: 'frontend',
  slug: 'fe-caching-pwa',
  title: 'Caching, CDN & PWA',
  tagline: 'The fastest request is the one never sent. <b>HTTP caching</b> decides how long a response may be reused and how to cheaply check it, a <b>CDN</b> puts that cache near users, and a <b>service worker</b> is a programmable proxy in the browser that can make your app work offline.',
  tldr: {
    problem: 'Without the right headers, users either re-download unchanged 2 MB bundles on every visit, or keep running week-old code and stale data after you deploy. Service workers make both mistakes more permanent.',
    model: '<b>Freshness</b> (<code>Cache-Control: max-age</code>): reuse without asking. <b>Validation</b> (<code>ETag</code> / <code>If-None-Match</code> → <code>304</code>): ask cheaply. <b>Who</b> may cache (<code>private</code>, <code>public</code>, <code>s-maxage</code>). Then a cache hierarchy: service worker → browser HTTP cache → CDN edge → origin.',
    hook: '“What does <code>no-cache</code> mean?” It does <i>not</i> mean “don’t cache”. It means “store it, but revalidate before every use”. <code>no-store</code> means don’t store.',
    facts: [
      { v: '304', l: 'Not Modified: a revalidation answer with headers only, no body' },
      { v: 'immutable', l: 'tells the browser not to revalidate a fresh response even on reload; ideal for hashed asset URLs' },
      { v: 'HTTPS', l: 'service workers only run on secure origins (localhost is treated as secure for development)' }
    ]
  },
  intro: {
    what: 'When your browser downloads a file, it can keep a copy and reuse it next time. <b>Response headers</b> from the server tell it how long the copy stays good, and how to check whether it changed. A <b>CDN</b> is a network of servers around the world that keeps such copies close to users. A <b>service worker</b> is a script your site installs in the browser that sits between the page and the network, so it can answer requests itself, even offline. That is the core of a <b>PWA</b> (progressive web app).',
    analogy: { icon: '🥛', title: 'Milk with a best-before date', text: '<code>max-age</code> is the best-before date: until then, just use it. After that you don’t throw it away; you ask the shop “is this batch still current?” (<code>ETag</code>), and they say “yes, keep it” (<code>304</code>). A CDN is the corner shop that stocks the same milk so you don’t drive to the farm. A service worker is your own fridge, which you manage yourself.' },
    steps: [
      { t: 'Hashed static assets', d: 'File names change when content changes, so cache them for a year.', code: 'Cache-Control: public, max-age=31536000, immutable', lang: 'text' },
      { t: 'HTML entry points', d: 'Must always point at the latest assets: revalidate each time.', code: 'Cache-Control: no-cache', lang: 'text' },
      { t: 'API responses', d: 'Usually <code>private, no-cache</code> with an <code>ETag</code>, or short <code>max-age</code> for public data. <code>no-store</code> for sensitive data.' },
      { t: 'Add a CDN', d: 'Use <code>s-maxage</code> for the edge, purge or version on deploy, and be careful with <code>Vary</code>.' },
      { t: 'Optionally a service worker', d: 'Precache the app shell, choose strategies per route, and design how updates reach users.' }
    ],
    terms: [
      ['max-age', 'Seconds a response stays fresh and can be reused without contacting the server.'],
      ['ETag', 'A version identifier for a response; sent back as <code>If-None-Match</code> to revalidate.'],
      ['s-maxage', 'Like max-age, but only for shared caches such as CDNs and proxies.'],
      ['Vary', 'Lists request headers that change the response, so caches store separate copies.'],
      ['service worker', 'A background script that intercepts fetches for pages in its scope.'],
      ['Cache Storage', 'A browser API (<code>caches</code>) that service workers use to store request/response pairs.']
    ]
  },
  visual: {
    title: 'Caches in the request path',
    caption: 'Pick <b>HTTP cache & CDN</b>, <b>Service worker lifecycle</b> or <b>Strategies</b>, then press Play or Step.'
  },
  gotchas: [
    { trap: 'Confusing no-cache and no-store', why: '<code>no-cache</code> stores and revalidates; <code>no-store</code> never stores. Using <code>no-store</code> on everything kills performance and can make pages ineligible for the back/forward cache; using <code>no-cache</code> for secrets still writes them to disk.', fix: '<code>no-store</code> only for sensitive responses (bank statements). <code>no-cache</code> + ETag for HTML and frequently changing data.' },
    { trap: 'Long max-age on un-hashed URLs', code: `Cache-Control: max-age=86400   # on /app.js`, lang: 'text', why: 'After a deploy, users keep the old <code>app.js</code> for up to a day, possibly mixed with new HTML. There is no way to recall a cached response from browsers.', fix: 'Only cache long when the URL contains a content hash. Otherwise use <code>no-cache</code> with validators.' },
    { trap: 'Caching personalised responses at the CDN', code: `Cache-Control: public, max-age=300   # on /api/me`, lang: 'text', why: 'The CDN serves user A’s profile to user B. This is one of the most damaging caching bugs.', fix: '<code>private</code> (or <code>no-store</code>) for anything user-specific. Make CDN rules default to bypass for authenticated paths and cookies.' },
    { trap: 'A service worker that never updates', why: 'If the SW precaches <code>index.html</code> cache-first and never activates the new version, users run the old app forever. Serving <code>sw.js</code> itself with a long <code>max-age</code> made this worse in older browsers.', fix: 'Serve <code>sw.js</code> with <code>no-cache</code>, version caches, delete old ones in <code>activate</code>, and show a “new version available” prompt that calls <code>skipWaiting()</code>. Keep a kill-switch SW ready.' },
    { trap: '<code>Vary: *</code> or <code>Vary: Cookie</code> on CDN', why: 'Every unique cookie value becomes a separate cache entry: hit rate drops to near zero, or the CDN refuses to cache.', fix: 'Vary only on headers that really change the body (<code>Accept-Encoding</code>, sometimes <code>Accept-Language</code>). Strip irrelevant cookies at the edge.' },
    { trap: 'Caching API POSTs or auth in the service worker', why: 'Replaying stale auth or payment responses offline is wrong and can leak data between users on a shared device.', fix: 'Network-only for auth, payments and mutations. Queue offline writes explicitly (Background Sync where supported) and make them idempotent.' }
  ],
  scenarios: [
    { title: 'One customer saw another customer’s account page',
      symptom: 'Support gets screenshots of users seeing someone else’s name and orders, only for a few minutes after a CDN configuration change.',
      diagnose: `curl -sI https://shop.example.com/account | grep -iE 'cache-control|age|x-cache|set-cookie'\n# cache-control: public, max-age=600   ← from a global "cache HTML 10 min" rule\n# x-cache: HIT · age: 212`,
      cause: 'A new CDN rule cached all HTML for 10 minutes, overriding the origin, including authenticated pages.',
      fix: 'Origin sends <code>Cache-Control: private, no-store</code> on authenticated pages, the CDN honours origin headers, and bypasses cache when a session cookie is present. Purge immediately.',
      fixCode: `@GetMapping("/account")\nResponseEntity<AccountView> account() {\n  return ResponseEntity.ok().cacheControl(CacheControl.noStore().cachePrivate()).body(view());\n}`, lang: 'java' },
    { title: 'Users stuck on a broken release for days',
      symptom: 'A bug was fixed and deployed in an hour, but error reports continue for days from a subset of users.',
      diagnose: `// DevTools → Application → Service Workers: "waiting to activate" (v8), active: v7\n// the fixed v8 is installed but never takes control`,
      cause: 'The SW precached the app shell cache-first and only activated when every tab closed. Users who keep the app open in a pinned tab never got v8.',
      fix: 'Listen for a waiting worker and prompt to reload; on confirmation, post a message that calls <code>skipWaiting()</code>, then reload on <code>controllerchange</code>.',
      fixCode: `// page\nconst reg = await navigator.serviceWorker.register('/sw.js');\nreg.addEventListener('updatefound', () => {\n  const w = reg.installing!;\n  w.addEventListener('statechange', () => {\n    if (w.state === 'installed' && navigator.serviceWorker.controller) showReloadBanner(() => w.postMessage('SKIP_WAITING'));\n  });\n});\nnavigator.serviceWorker.addEventListener('controllerchange', () => location.reload());\n// sw.js\nself.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });` }
  ],
  puzzles: [
    { kind: 'concept', q: 'What does <code>Cache-Control: no-cache</code> do?', options: ['Prevents storing the response', 'Allows storing, but requires revalidation with the server before each reuse', 'Caches for 0 seconds then deletes', 'Only disables the CDN'], answer: 1, explain: '<code>no-cache</code> = always revalidate. <code>no-store</code> = never store.' },
    { kind: 'concept', q: 'A response has <code>ETag: "v42"</code> and is stale. What does the next request send, and what is the best-case reply?', options: ['<code>If-Modified-Since</code> → 200', '<code>If-None-Match: "v42"</code> → 304 Not Modified, no body', '<code>If-Match: "v42"</code> → 412', 'Nothing; it downloads again'], answer: 1, explain: 'Conditional GET with If-None-Match. If the ETag still matches, the server sends 304 and the cached body is reused.' },
    { kind: 'concept', q: 'Headers: <code>Cache-Control: public, max-age=60, s-maxage=600</code>. How long may the CDN serve it without revalidating?', options: ['60 s', '600 s', '660 s', 'Not at all'], answer: 1, explain: '<code>s-maxage</code> overrides max-age for shared caches. Browsers still use 60 s.' },
    { kind: 'concept', q: 'You deploy a new service worker. Users with the app open in a tab still run the old one. Why?', options: ['Browsers cache SWs for 24 h', 'The new SW is installed but waiting until all clients controlled by the old one close (unless skipWaiting)', 'SWs only update on reinstall', 'The manifest is stale'], answer: 1, explain: 'The waiting phase guarantees one page isn’t controlled by two versions. You decide when to switch.' },
    { kind: 'concept', q: 'Which strategy fits hashed files like <code>/assets/app-3f9a.js</code>?', options: ['Network only', 'Network first', 'Cache first', 'Never cache'], answer: 2, explain: 'The URL changes whenever content changes, so a cached copy is never wrong for that URL.' },
    { kind: 'concept', q: 'Which header combination lets users see a slightly stale page instantly while the cache refreshes?', options: ['<code>max-age=0, must-revalidate</code>', '<code>max-age=60, stale-while-revalidate=300</code>', '<code>no-store</code>', '<code>private</code>'], answer: 1, explain: 'For 300 s after becoming stale, caches may serve the stale copy and revalidate in the background.' }
  ],
  interview: [
    { q: 'Walk me through HTTP caching.', a: '<p>Caches store responses keyed by method + URL (+ <code>Vary</code> headers). While a response is <b>fresh</b> (<code>max-age</code>, or <code>Expires</code>), it is reused without contacting the server. When stale, it is <b>revalidated</b> with <code>If-None-Match</code> (ETag) or <code>If-Modified-Since</code>; the server returns 304 or a new 200. <code>private</code> limits to the browser, <code>public</code>/<code>s-maxage</code> allow shared caches. <code>no-cache</code> forces revalidation; <code>no-store</code> forbids storing.</p>', lvl: 'core' },
    { q: 'What caching policy would you use for a SPA?', a: '<ul><li>Hashed assets: <code>public, max-age=31536000, immutable</code>.</li><li><code>index.html</code>: <code>no-cache</code> (with ETag).</li><li>API: <code>private, no-cache</code> + ETag, or <code>no-store</code> for sensitive; short public max-age for shared reference data.</li><li><code>sw.js</code>: <code>no-cache</code>.</li></ul><p>Keep old assets available after deploy for users with an older HTML.</p>', lvl: 'core' },
    { q: 'How do ETags work in Spring Boot?', a: '<p><code>ShallowEtagHeaderFilter</code> hashes the response body and returns 304 if it matches, which saves bandwidth but not server work. For real savings compute ETags from a version column and use <code>WebRequest.checkNotModified(etag)</code> or <code>ResponseEntity.eTag()</code> so the query and serialisation can be skipped.</p>', lvl: 'deep' },
    { q: 'How do you invalidate CDN caches on deploy?', a: '<p>Prefer not to need it: version URLs (hashed assets) so new content has new URLs. For HTML and API, use short TTLs or <code>no-cache</code> at the edge with revalidation. Use purge APIs or cache tags/surrogate keys for content updates (e.g. product changed → purge tag <code>product-123</code>).</p>', lvl: 'deep' },
    { q: 'Explain the service worker lifecycle.', a: '<p>Register → download → <b>install</b> (precache; failure aborts) → <b>waiting</b> (if an older SW controls clients) → <b>activate</b> (clean old caches; <code>clients.claim()</code> to control open pages) → handles <code>fetch</code>, <code>push</code>, <code>sync</code> events. The browser checks for updates on navigation and compares bytes. <code>skipWaiting()</code> skips the wait.</p>', lvl: 'core' },
    { q: 'What makes a web app a PWA?', a: '<p>Served over HTTPS, a web app manifest (name, icons, <code>start_url</code>, <code>display</code>), and usually a service worker for offline support and installability. Optional capabilities: push notifications (supported on iOS for home-screen web apps since iOS 16.4), background sync (Chromium), badging. Installability criteria differ by browser.</p>', lvl: 'core' },
    { q: 'How do you design offline writes?', a: '<p>Store intended mutations in IndexedDB with a client-generated id, show them as pending in the UI, replay when online (Background Sync where available, otherwise on <code>online</code> event / app start), make the server endpoint idempotent on that id, and handle conflicts explicitly (last-write-wins is rarely right for business data).</p>', lvl: 'deep' },
    { q: 'What is the difference between the HTTP cache, the bfcache and Cache Storage?', a: '<p>HTTP cache: automatic, header-driven, per response. <b>bfcache</b>: an in-memory snapshot of a whole page (including JS heap) for instant back/forward navigation. <b>Cache Storage</b>: an explicit API your service worker (or page) controls, ignoring Cache-Control unless you implement it.</p>', lvl: 'deep' },
    { q: 'What is Vary and why is it dangerous?', a: '<p><code>Vary</code> tells caches which request headers select different variants, e.g. <code>Accept-Encoding</code> for gzip vs brotli. Missing a needed Vary serves the wrong variant (wrong language, or CORS headers for the wrong origin, so add <code>Vary: Origin</code>). Too broad a Vary (<code>Cookie</code>, <code>User-Agent</code>) fragments the cache and kills hit rates.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Conditional GET with a real ETag in Spring Boot', lang: 'java', code: `@GetMapping("/api/products/{id}")
ResponseEntity<ProductDto> get(@PathVariable long id, WebRequest req) {
  long version = repo.versionOf(id);                 // cheap: SELECT version FROM product WHERE id = ?
  String etag = "\\"" + id + "-" + version + "\\"";
  if (req.checkNotModified(etag)) return null;        // Spring writes 304, no body
  return ResponseEntity.ok()
      .eTag(etag)
      .cacheControl(CacheControl.noCache().cachePrivate())
      .body(mapper.toDto(repo.findById(id).orElseThrow()));
}` },
    { title: 'A small service worker with Workbox', lang: 'ts', code: `// sw.ts (bundled with vite-plugin-pwa or workbox-build)
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

precacheAndRoute(self.__WB_MANIFEST);      // hashed app shell, injected at build time
cleanupOutdatedCaches();

registerRoute(({ request }) => request.mode === 'navigate', new NetworkFirst({ cacheName: 'pages', networkTimeoutSeconds: 3 }));
registerRoute(({ url }) => url.pathname.startsWith('/api/catalog'), new StaleWhileRevalidate({ cacheName: 'catalog' }));
registerRoute(({ request }) => request.destination === 'image',
  new CacheFirst({ cacheName: 'img', plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 86400 })] }));
// /api/auth, /api/payments: no route → network only`, note: 'Never cache authenticated API responses in a SW without thinking about shared devices and logout.' }
  ]
});
