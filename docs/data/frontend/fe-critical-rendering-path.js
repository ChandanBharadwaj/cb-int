IA.register({
  track: 'frontend',
  slug: 'fe-critical-rendering-path',
  title: 'Critical rendering path',
  tagline: 'The <b>critical rendering path</b> is the chain of resources the browser must fetch and process before it can paint anything. Shorten the chain, and stop scripts and styles from blocking it.',
  tldr: {
    problem: 'A page with a fast server still shows white for two seconds, because the browser is waiting on a sync script, a CSS file and a font that was discovered late.',
    model: 'Parsing builds the DOM; a classic <code>&lt;script&gt;</code> <b>pauses the parser</b>; CSS <b>blocks rendering</b>. <code>defer</code> downloads in parallel and runs after parsing in order; <code>async</code> runs as soon as it arrives. <code>preload</code> starts late-discovered downloads early.',
    hook: '“async or defer?” defer for your app code (keeps order, needs the DOM); async for independent third-party scripts like analytics.',
    facts: [
      { v: 'defer', l: 'is implied for <code>&lt;script type="module"&gt;</code>; adding <code>async</code> to a module makes it run as soon as it and its imports are ready' },
      { v: 'DOMContentLoaded', l: 'fires after parsing and after all deferred scripts have run, not after images or async scripts' },
      { v: 'crossorigin', l: 'is required on font preloads, because fonts are always fetched in CORS mode; without it the preload is fetched twice' }
    ]
  },
  intro: {
    what: 'Before a browser can show anything it needs the HTML, all the CSS that applies, and any script that stands in the parser’s way. Those resources form a dependency chain. The <b>critical rendering path</b> is that chain, and optimising it means fewer, smaller, earlier resources on it.',
    analogy: { icon: '🍳', title: 'Cooking breakfast', text: 'You can’t serve until the eggs, toast and coffee are ready. Running them one after another (sync scripts) is slow. Starting them all at once (defer, preload) and serving when the slowest finishes is fast. Forgetting to buy bread until you open the toaster is a late-discovered resource.' },
    steps: [
      { t: 'HTML streams in', d: 'The parser builds the DOM top to bottom. A side <b>preload scanner</b> looks ahead for URLs to start downloading.' },
      { t: 'CSS blocks paint', d: 'The browser won’t paint until stylesheets in the head are loaded and parsed, so the first frame isn’t unstyled.' },
      { t: 'Classic scripts block parsing', d: 'A plain <code>&lt;script src&gt;</code> stops the parser until it downloads and runs, because it could change the document.', code: '<script src="app.js"></script>          <!-- blocks -->\n<script defer src="app.js"></script>    <!-- doesn’t -->', lang: 'text' },
      { t: 'defer, async, module', d: '<code>defer</code>: run after parsing, in order. <code>async</code>: run when ready, any order. <code>type="module"</code>: deferred by default.' },
      { t: 'Hints for late resources', d: '<code>preload</code> fetches something needed now (a hero image, a font); <code>preconnect</code> warms up a connection to another origin.' }
    ],
    terms: [
      ['render-blocking', 'A resource that must load before the first paint (CSS in the head, sync scripts in the head).'],
      ['parser-blocking', 'A script that pauses HTML parsing until it has run.'],
      ['preload scanner', 'A secondary parser that finds and starts downloads while the main parser is blocked.'],
      ['FCP / LCP', 'First Contentful Paint and Largest Contentful Paint: when the first content and the main content appear.'],
      ['resource hint', '<code>preload</code>, <code>preconnect</code>, <code>dns-prefetch</code>, <code>prefetch</code>: tell the browser about fetches early.']
    ]
  },
  visual: {
    title: 'Four ways to load a resource',
    caption: 'Choose a loading strategy and press Play. Bars show the parser, the network and script execution over time. Watch where first paint (FP) lands, and whether order is kept.'
  },
  gotchas: [
    { trap: 'Sync third-party script in the head', code: `<head>\n  <script src="https://tags.example.com/tag.js"></script>  <!-- their outage = your blank page -->\n</head>`, lang: 'text', why: 'The parser stops until another origin answers. If it hangs, your page hangs (a single point of failure).', fix: 'Load it with <code>async</code> (or <code>defer</code>), or inject it after load. Preconnect to the origin if it’s critical.' },
    { trap: '<code>async</code> on scripts that depend on each other', code: `<script async src="lib.js"></script>\n<script async src="app-uses-lib.js"></script>   <!-- may run first -->`, lang: 'text', why: 'Async scripts run in arrival order, not document order. Works on your fast machine, fails randomly in production.', fix: 'Use <code>defer</code> (document order) or ES modules with imports.' },
    { trap: 'Preloading everything', why: 'Preloads get high priority and compete with truly critical resources. Unused preloads trigger console warnings and waste bandwidth.', fix: 'Preload only late-discovered, critical resources: the LCP image, the main font. Use <code>fetchpriority="high"</code> on the LCP <code>&lt;img&gt;</code> instead where it suffices.' },
    { trap: 'Font preload without <code>crossorigin</code>', code: `<link rel="preload" href="/inter.woff2" as="font">              <!-- wasted -->\n<link rel="preload" href="/inter.woff2" as="font" type="font/woff2" crossorigin>`, lang: 'text', why: 'Fonts are always requested in CORS mode. A preload without <code>crossorigin</code> doesn’t match, so the font is downloaded twice.', fix: 'Always add <code>crossorigin</code> to font preloads, even for same-origin fonts.' },
    { trap: 'Lazy-loading the hero image', code: `<img src="hero.avif" loading="lazy">   <!-- delays LCP -->`, lang: 'text', why: '<code>loading="lazy"</code> waits for layout to know it’s near the viewport, so the most important image starts late.', fix: 'Lazy-load below-the-fold images only. Mark the LCP image <code>fetchpriority="high"</code>.' },
    { trap: 'CSS <code>@import</code> chains', code: `/* app.css */\n@import url("theme.css");   /* discovered only after app.css arrives */`, lang: 'text', why: 'Each @import adds a sequential round-trip to the render-blocking chain.', fix: 'Bundle CSS at build time, or use multiple <code>&lt;link&gt;</code> tags so downloads run in parallel.' }
  ],
  scenarios: [
    { title: 'Whole site white for 20 s during a tag-manager outage',
      symptom: 'Pages are blank in every browser while the backend is healthy. HAR files show the HTML arrived in 80 ms.',
      diagnose: 'The waterfall shows the parser stalled at a third-party script in the head that never responds (pending until a ~20 s timeout).',
      cause: 'A sync, parser-blocking script from another origin on the critical path.',
      fix: 'Make it <code>async</code>, or load it after the <code>load</code> event. Treat every third-party script as optional on the critical path.',
      fixCode: `<script async src="https://tags.example.com/tag.js"></script>`, lang: 'text' },
    { title: 'LCP regressed from 1.8 s to 3.4 s after a redesign',
      symptom: 'Field data (CrUX) shows LCP doubled on mobile. The new hero is a CSS <code>background-image</code>.',
      diagnose: 'The waterfall: HTML → CSS → (parse CSS) → hero image. The preload scanner can’t see background images, so the image starts after the CSS is parsed.',
      cause: 'A late-discovered LCP resource behind a render-blocking stylesheet.',
      fix: 'Use an <code>&lt;img&gt;</code> with <code>fetchpriority="high"</code>, or preload the image in the head.',
      fixCode: `<link rel="preload" as="image" href="/hero.avif" fetchpriority="high">\n<!-- or -->\n<img src="/hero.avif" fetchpriority="high" alt="…" width="1200" height="600">`, lang: 'text' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Two scripts, both <code>defer</code>. a.js is 500 KB, b.js is 2 KB and listed second. Which runs first?', options: ['b.js, it arrives first', 'a.js, document order is kept', 'Random', 'They run in parallel'], answer: 1, explain: 'Deferred scripts run in document order after parsing, regardless of which download finishes first.' },
    { kind: 'concept', q: 'Same, but both <code>async</code>?', options: ['a.js first', 'b.js most likely first', 'Always document order', 'Neither runs until DOMContentLoaded'], answer: 1, explain: 'Async scripts run as soon as each one is downloaded. The small one usually wins, but there is no guarantee.' },
    { kind: 'concept', q: 'When does <code>DOMContentLoaded</code> fire?', options: ['After all images load', 'When parsing is done and deferred scripts have run', 'When the first paint happens', 'After async scripts run'], answer: 1, explain: 'It waits for parsing and deferred (and module) scripts, not for images, stylesheets alone, or async scripts. <code>load</code> waits for everything.' },
    { kind: 'concept', q: 'What is the default loading behaviour of <code>&lt;script type="module" src&gt;</code>?', options: ['Parser-blocking', 'Like defer', 'Like async', 'Only on user interaction'], answer: 1, explain: 'Module scripts are deferred by default. With <code>async</code> they run as soon as they and their dependencies are ready.' },
    { kind: 'concept', q: 'Which hint fits “we will call api.stripe.com soon, but don’t know which URL”?', options: ['preload', 'preconnect', 'prefetch', 'modulepreload'], answer: 1, explain: '<code>preconnect</code> does DNS, TCP and TLS ahead of time without fetching anything. <code>preload</code> needs a concrete URL; <code>prefetch</code> is for future navigations at low priority.' },
    { kind: 'concept', q: 'A stylesheet is linked in the head and a classic inline <code>&lt;script&gt;</code> follows it. What does the script wait for?', options: ['Nothing', 'The stylesheet to load', 'DOMContentLoaded', 'All images'], answer: 1, explain: 'A script after a pending stylesheet waits for it, because it might read computed styles. So the CSS indirectly blocks parsing too.' }
  ],
  interview: [
    { q: 'What is the critical rendering path?', a: '<p>The sequence of steps and resources needed for the first render: HTML → DOM, CSS → CSSOM, any parser-blocking script, then style, layout, paint. Optimising it means fewer critical resources, fewer bytes, and fewer sequential round-trips.</p>', lvl: 'core' },
    { q: 'Explain async vs defer.', a: '<p>Both download without blocking the parser. <b>defer</b> runs after parsing, in document order, before <code>DOMContentLoaded</code>. <b>async</b> runs as soon as it arrives, pausing the parser briefly, in any order. Use defer for app code, async for independent scripts.</p>', fu: 'What about inline scripts? defer/async have no effect on classic inline scripts.', lvl: 'core' },
    { q: 'Why is CSS render-blocking but not parser-blocking?', a: '<p>Painting before CSS arrives would show unstyled content and then re-layout everything. Parsing can continue safely because CSS doesn’t change the DOM. Scripts after a stylesheet wait for it, so in practice CSS can block parsing indirectly.</p>', lvl: 'core' },
    { q: 'How would you speed up first paint for a content site?', a: '<ul><li>Inline critical above-the-fold CSS, load the rest non-blocking.</li><li>Defer all JS; drop sync third-party scripts.</li><li>Preload the LCP image or font; use <code>fetchpriority="high"</code>.</li><li>Server-render the HTML; compress (Brotli); use HTTP/2 or HTTP/3 and a CDN.</li><li>Avoid request chains (@import, JS-injected critical resources).</li></ul>', lvl: 'core' },
    { q: 'preload vs prefetch vs preconnect vs modulepreload?', a: '<p><b>preload</b>: fetch this URL now, high priority, for this page. <b>prefetch</b>: maybe for the next navigation, idle priority. <b>preconnect</b>: open the connection only. <b>modulepreload</b>: fetch and parse an ES module (and optionally its graph) ahead of time.</p>', lvl: 'deep' },
    { q: 'What is the preload scanner and what defeats it?', a: '<p>A lightweight parser that runs ahead while the main parser is blocked and starts fetching URLs it sees in markup. It can’t see resources referenced only in CSS (background images, fonts), injected by JS, or loaded via <code>loading="lazy"</code> client-side logic. That is why late discovery is a common LCP problem.</p>', lvl: 'deep' },
    { q: 'How do fonts affect rendering?', a: '<p>Text using a web font that hasn’t loaded is invisible (block period) or shown in a fallback (swap). <code>font-display: swap</code> shows fallback text immediately but can cause layout shift; <code>optional</code> avoids shifts by only using the font if it’s ready almost immediately. Size-adjusted fallback fonts reduce the shift.</p>', lvl: 'deep' },
    { q: 'What does 103 Early Hints do?', a: '<p>The server sends an informational <code>103</code> response with <code>Link: rel=preload</code>/<code>preconnect</code> headers before the final response is ready. The browser starts fetching critical resources during server think time. Chrome supports it for preconnect and preload on navigations.</p>', lvl: 'deep' },
    { q: 'Where should a script tag go: head or end of body?', a: '<p>With <code>defer</code> or <code>type="module"</code>, put it in the head: it’s discovered early and still doesn’t block. The old “end of body” advice was a workaround for blocking scripts, and it delays discovery.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'A lean <head>', lang: 'text', code: `<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://cdn.example.com" crossorigin>
  <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
  <style>/* critical above-the-fold CSS, inlined */</style>
  <link rel="stylesheet" href="/app.css">
  <script type="module" src="/main.js"></script>        <!-- deferred -->
  <script async src="https://analytics.example.com/a.js"></script>
</head>`, note: 'Order matters: preconnect and preload early, CSS before scripts that need it.' },
    { title: 'Spring Boot: Early Hints / Link header', lang: 'java', code: `@GetMapping("/")
public String home(HttpServletResponse res) {
  // Many CDNs turn Link: preload headers into 103 Early Hints
  res.addHeader("Link", "</app.css>; rel=preload; as=style, </fonts/inter.woff2>; rel=preload; as=font; crossorigin");
  return "index";
}`, note: 'Whether a 103 is actually sent depends on the CDN or server in front of you.' }
  ]
});
