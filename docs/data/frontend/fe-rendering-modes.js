IA.register({
  track: 'frontend',
  slug: 'fe-rendering-modes',
  title: 'CSR, SSR, SSG & ISR',
  tagline: 'The core question of frontend architecture: <b>where and when is the HTML produced?</b> In the browser (CSR), on the server per request (SSR), at build time (SSG), or at build time with a refresh timer (ISR).',
  tldr: {
    problem: 'Teams pick a framework and inherit its rendering default without knowing the cost: a blank page for crawlers, a server that melts under traffic, or product prices that are a day stale.',
    model: '<b>CSR</b>: empty HTML + JS builds the page. <b>SSR</b>: server renders full HTML per request, then JS hydrates it. <b>SSG</b>: HTML rendered once at build, served from a CDN. <b>ISR</b>: SSG pages that regenerate in the background after a time window or on demand. Modern frameworks mix them per route.',
    hook: '“SSR or SSG?” Ask: how often does the data change, and is it per-user? Per-user and live → SSR. Same for everyone, rarely changes → SSG. Same for everyone, changes hourly → ISR.',
    facts: [
      { v: 'per route', l: 'Next.js, Nuxt, SvelteKit, Astro and Remix-style frameworks let each route choose static or dynamic rendering' },
      { v: 'TTFB vs FCP', l: 'SSR raises TTFB (server work) but usually gives earlier FCP/LCP than CSR, which paints only after JS and data' },
      { v: 'stale once', l: 'with time-based ISR, the first request after expiry still gets the stale page while regeneration runs' }
    ]
  },
  intro: {
    what: 'A page needs HTML before a user sees anything. That HTML can be built in the user’s browser by JavaScript, by your server for each request, or ahead of time during the build. Each choice trades off speed, freshness, cost and SEO. As a Java developer: SSR is what Spring MVC + Thymeleaf always did; CSR is a React SPA calling your REST API.',
    analogy: { icon: '🍕', title: 'Pizza', text: '<b>CSR</b>: you get a kit and bake it at home. <b>SSR</b>: the restaurant bakes it when you order. <b>SSG</b>: pre-baked slices waiting under a heat lamp. <b>ISR</b>: pre-baked slices, but the kitchen bakes a fresh tray whenever the current one is older than an hour.' },
    steps: [
      { t: 'CSR: client-side rendering', d: 'The server sends a shell (<code>&lt;div id="root"&gt;</code>) and a JS bundle. The browser runs the app, fetches data and builds the DOM.' },
      { t: 'SSR: server-side rendering', d: 'The server runs the same components, fetches data and sends finished HTML. The browser shows it, then <b>hydrates</b> it with JS.' },
      { t: 'SSG: static site generation', d: 'During the build, every page is rendered to an HTML file and deployed to a CDN.' },
      { t: 'ISR: incremental static regeneration', d: 'Like SSG, but each page has a revalidation window, or is refreshed by a webhook.', code: '// Next.js App Router\nexport const revalidate = 3600; // seconds', lang: 'ts' },
      { t: 'Mix per route', d: 'Marketing pages static, product pages ISR, the account area SSR or CSR.' }
    ],
    terms: [
      ['TTFB', 'Time to first byte: how long until the server starts answering.'],
      ['FCP / LCP', 'When the first content, and the largest content element, are painted.'],
      ['hydration', 'Attaching JS behaviour and state to server-rendered HTML.'],
      ['SPA', 'Single-page app: one HTML page, navigation handled by JS.'],
      ['revalidation', 'Refreshing a cached, pre-rendered page with new data.'],
      ['edge rendering', 'Running SSR in CDN locations close to the user.']
    ]
  },
  visual: {
    title: 'One request, four ways',
    caption: 'Pick a mode, press Play, and watch where the HTML is produced and what the browser must do before content appears. The stats at the bottom summarise the trade-off.'
  },
  gotchas: [
    { trap: 'CSR for SEO-critical pages', why: 'Google can render JS, but rendering is deferred and costs crawl budget; many other crawlers and link-preview bots (chat apps, social sites) don’t run JS at all.', fix: 'Use SSR or SSG for public, indexable pages. Keep CSR for authenticated app areas.' },
    { trap: 'SSR that calls your own API over HTTP', code: `// server component / getServerSideProps\nconst res = await fetch('https://myapp.com/api/products'); // extra hop, same box`, why: 'The server makes a network round-trip to itself, adds latency and double-serialises. Under load it can even exhaust connections.', fix: 'Call the service or data layer directly on the server; keep HTTP APIs for the browser.' },
    { trap: 'Personalised data in a static or cached page', why: 'If SSG/ISR or a CDN caches a page rendered with one user’s cookie, the next visitor sees that user’s data.', fix: 'Render per-user parts dynamically (SSR, or a client fetch). Set <code>Cache-Control: private</code> on personalised responses.' },
    { trap: 'Hydration mismatch from time or randomness', code: `<span>{new Date().toLocaleTimeString()}</span>   // server ≠ client`, why: 'SSR output and the first client render must match. Time, <code>Math.random()</code>, locale or <code>window</code> checks differ between server and browser.', fix: 'Render such values after mount (in an effect), or pass the server value as data.' },
    { trap: 'Expecting ISR to be instantly fresh', why: 'Time-based revalidation serves stale content until a request triggers regeneration, and the visitor that triggers it still gets the old page.', fix: 'Use on-demand revalidation (<code>revalidateTag</code>/<code>revalidatePath</code> in Next.js) from a CMS or admin webhook when content changes.' }
  ],
  scenarios: [
    { title: 'Black Friday: SSR product pages time out',
      symptom: 'p95 latency of product pages climbs from 200 ms to 8 s; Node SSR pods at 100% CPU while the DB is fine.',
      diagnose: 'Every request re-renders an identical page for anonymous users; no CDN caching because the response sets a session cookie.',
      cause: 'Dynamic SSR for content that is the same for everyone.',
      fix: 'Render product pages statically with ISR (or cache them at the CDN with <code>s-maxage</code> + <code>stale-while-revalidate</code>), and load per-user bits (cart, price tier) client-side.',
      fixCode: `// app/products/[id]/page.tsx (Next.js App Router)\nexport const revalidate = 300;\nexport async function generateStaticParams() {\n  return (await topProducts(1000)).map(p => ({ id: p.id }));\n}` },
    { title: 'Customer saw another customer’s name in the header',
      symptom: 'Support tickets: “Hello, Priya” shown to users who are not Priya, on the home page only.',
      diagnose: 'The CDN cache key ignores cookies; the home page response had <code>Cache-Control: public, s-maxage=60</code> but its HTML contained the logged-in name.',
      cause: 'Personalised SSR output cached as shared content.',
      fix: 'Never cache personalised HTML publicly. Split the page: static shell cached, user-specific part fetched per user or rendered with <code>private, no-store</code>.',
      fixCode: `Cache-Control: private, no-store   # for personalised HTML\nVary: Cookie                        # if you must cache per user (rarely wise)`, lang: 'text' }
  ],
  puzzles: [
    { kind: 'concept', q: 'A documentation site with 2,000 pages, updated a few times a week. Best default?', options: ['CSR', 'SSR on every request', 'SSG (rebuild on change)', 'Edge SSR'], answer: 2, explain: 'Same content for everyone and rare changes: pre-render at build and serve from a CDN. ISR or partial rebuilds help if builds get slow.' },
    { kind: 'concept', q: 'An internal admin dashboard behind SSO. Strongest case for…', options: ['SSG', 'CSR (SPA)', 'ISR', 'SSR is mandatory'], answer: 1, explain: 'No SEO needs, highly interactive, per-user data. A CSR SPA (or SSR, if you like) is fine; static generation brings nothing.' },
    { kind: 'concept', q: 'Which metric does SSR usually make worse than serving static files?', options: ['TTFB', 'CLS', 'Bundle size', 'Nothing'], answer: 0, explain: 'The server must fetch data and render before it can send the first byte, while a CDN hit answers immediately. Streaming SSR reduces this.' },
    { kind: 'concept', q: 'ISR with <code>revalidate = 60</code>. A page was generated at 10:00:00. A user requests it at 10:05:00. What do they get?', options: ['A fresh page rendered for them', 'The 10:00 page, and a background regeneration starts', 'A 503 while it rebuilds', 'A blank page'], answer: 1, explain: 'Stale-while-revalidate: the first request after expiry gets the cached page and triggers regeneration. Later requests get the new one.' },
    { kind: 'concept', q: 'Why does an SSR app still ship JavaScript?', options: ['It doesn’t', 'To hydrate: attach event handlers and state to the HTML', 'Only for analytics', 'To re-download the HTML'], answer: 1, explain: 'Server HTML is inert. Hydration runs components on the client to make it interactive. Islands, RSC and resumability reduce how much JS that takes.' },
    { kind: 'concept', q: 'Which is true of CSR?', options: ['Best LCP', 'Content visible only after JS downloads, runs and fetches data', 'Needs a Node server', 'Impossible to cache'], answer: 1, explain: 'CSR creates a request waterfall: HTML → JS → data → render. The shell itself is easy to cache on a CDN.' }
  ],
  interview: [
    { q: 'Compare CSR, SSR, SSG and ISR.', a: '<ul><li><b>CSR</b>: cheap hosting, rich interactivity, slow first content, weak SEO.</li><li><b>SSR</b>: fresh and personalised HTML, good SEO and LCP, server cost per request, higher TTFB.</li><li><b>SSG</b>: fastest and cheapest (CDN), stale until rebuild, build time grows with page count.</li><li><b>ISR</b>: static speed with bounded staleness, more moving parts (cache invalidation).</li></ul>', lvl: 'core' },
    { q: 'How do you choose a rendering mode for a route?', a: '<p>Ask: is it per-user? How fresh must it be? Does it need SEO? How many pages? Then: public and stable → SSG; public and changing → ISR or SSR with CDN caching; per-user → SSR or CSR; app-like and private → CSR is fine.</p>', lvl: 'core' },
    { q: 'What is streaming SSR?', a: '<p>Instead of waiting for all data, the server flushes HTML in chunks: the shell first, then slow sections as their data resolves (React’s <code>renderToPipeableStream</code>/<code>renderToReadableStream</code> with Suspense). It improves TTFB and FCP. See <a href="fe-server-components.html">Server Components</a>.</p>', lvl: 'deep' },
    { q: 'How does Next.js App Router decide static vs dynamic rendering?', a: '<p>A route is rendered statically by default unless it uses dynamic APIs (<code>cookies()</code>, <code>headers()</code>, <code>searchParams</code>), uncached data, or opts in with segment config such as <code>dynamic = \'force-dynamic\'</code>. Next.js 15 changed <code>fetch</code> to not cache by default; newer versions add “Cache Components” with <code>\'use cache\'</code>. Check the version, because caching defaults changed between 13, 14, 15 and 16.</p>', fu: 'What is Partial Prerendering? A static shell served instantly with dynamic holes streamed in, in the same response.', lvl: 'deep' },
    { q: 'What problems does SSR introduce that CSR doesn’t have?', a: '<ul><li>Code must run in two environments (no <code>window</code> on the server).</li><li>Hydration mismatches.</li><li>Server capacity, cold starts and observability for a Node tier.</li><li>Caching personalised output safely.</li></ul>', lvl: 'core' },
    { q: 'What is edge rendering and when is it worth it?', a: '<p>Running SSR in CDN points of presence near the user, which lowers TTFB. It helps only if the data is also near the edge (or cached). If every render calls a database in one region, edge rendering can be slower because each query crosses the world.</p>', lvl: 'deep' },
    { q: 'Is SSR good for SEO by itself?', a: '<p>It ensures crawlers get content without running JS, but SEO also needs correct status codes (real 404s), metadata, canonical URLs, sitemaps and fast pages. A CSR app returning 200 for every URL is a classic soft-404 problem.</p>', lvl: 'core' },
    { q: 'How would you serve a mostly static product page with a live stock count?', a: '<p>Statically generate (or ISR) the page, and fetch stock on the client or stream it as a dynamic hole (Partial Prerendering / islands). Cache the static part at the CDN; keep the volatile part small.</p>', lvl: 'core' },
    { q: 'How does this relate to classic Spring MVC + Thymeleaf?', a: '<p>That is SSR without hydration: every request renders HTML on the server, and interactivity comes from small scripts (or htmx). The modern twist is using the <i>same</i> components on server and client, so the server output can become a client app after hydration.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Next.js App Router: per-route choices', lang: 'ts', code: `// app/blog/[slug]/page.tsx: static, refreshed hourly
export const revalidate = 3600;

// app/account/page.tsx: dynamic because it reads cookies
import { cookies } from 'next/headers';
export default async function Account() {
  const session = (await cookies()).get('session');   // async in Next.js 15+
  return <Profile session={session?.value} />;
}

// app/api/revalidate/route.ts: on-demand ISR from a CMS webhook
import { revalidateTag } from 'next/cache';
export async function POST(req: Request) {
  revalidateTag('posts');
  return Response.json({ ok: true });
}`, note: 'Next.js caching APIs changed across versions (13 → 16). Check the docs for the version you run.' },
    { title: 'CDN caching of SSR output from Spring', lang: 'java', code: `@GetMapping("/products/{id}")
public ResponseEntity<String> product(@PathVariable long id) {
  String html = renderer.render(id);   // same for every anonymous user
  return ResponseEntity.ok()
      .cacheControl(CacheControl.maxAge(Duration.ZERO)
          .sMaxAge(Duration.ofMinutes(5))
          .staleWhileRevalidate(Duration.ofMinutes(1)))
      .body(html);
}`, note: 'An ISR-like effect at the CDN layer: shared caches keep it 5 minutes, then serve stale while refetching.' }
  ]
});
