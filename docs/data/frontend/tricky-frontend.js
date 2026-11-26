IA.register({
  track: 'frontend',
  slug: 'tricky-frontend',
  title: '★ Tricky frontend (timed)',
  tagline: 'Forty “what happens / which one / why does it break” questions from all sixteen frontend topics, against the clock. Each one is a misconception that has shipped real bugs, and every miss links back to the page that explains it.',
  tldr: {
    problem: 'Senior frontend interviews rarely ask you to build a todo app. They ask why a hydration warning appears, why an event never reaches the app, why a cached page shows the wrong user, or why INP got worse.',
    model: 'Most tricks are one of five things: <b>the rendering pipeline</b> (what blocks, what triggers layout), <b>where code runs</b> (server, client, build time), <b>boundaries</b> (shadow DOM, origins, client/server components), <b>caching and time</b> (stale, waiting, retries) and <b>semantics</b> (ARIA, escaping, ESM).',
    hook: '<code>Cache-Control: no-cache</code> does not mean “don’t cache”. If you can say what it does mean in one sentence, start the drill.',
    facts: [
      { v: '40', l: 'questions across all 16 frontend topics, from the browser pipeline to testing' },
      { v: '60 s', l: 'per question by default; Slow (90 s) and Fast (30 s) modes too' },
      { v: '16', l: 'topic links: each miss in the review points to the page that covers it' }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short question, sometimes a snippet, a timer and four answers (shuffled each time). Answer in your head, as you would in an interview, then read the explanation. At the end you see your score per topic and a review of every miss, with a link to the topic page.',
    analogy: { icon: '⏱️', title: 'Flashcards with a stopwatch', text: 'Like revising for a certification: you don’t re-read the book, you test recall under time pressure and go back only to the chapters you got wrong.' },
    steps: [
      { t: 'Ask “where does this run?”', d: 'Build time, server, edge, main thread, worker or service worker. Many puzzles hinge on this.' },
      { t: 'Ask “what is blocked?”', d: 'Parsing, rendering, the main thread, the network, or a waiting service worker.' },
      { t: 'Look for a boundary', d: 'Shadow root, origin vs site, <code>"use client"</code>, a micro-frontend remote. Things behave differently across it.' },
      { t: 'Distrust names', d: '<code>no-cache</code> caches, <code>role="button"</code> adds no behaviour, CORS doesn’t protect your server.' }
    ],
    terms: [
      ['main thread', 'Where JS, style, layout and paint run in a page; one long task blocks input.'],
      ['boundary', 'A line that changes rules: shadow DOM, origin, server/client component.'],
      ['stale', 'A cached value past its freshness lifetime; may still be served while revalidating.'],
      ['p75', 'The 75th percentile, used to judge Core Web Vitals.']
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a topic (or All), how many questions and the time per question, then press Start. Skip counts as a miss. Your misses are listed at the end with explanations and links to the topic pages.'
  },
  gotchas: [
    { trap: 'Reading the snippet in source order', why: 'Many frontend surprises come from timing: <code>defer</code> vs <code>async</code>, hydration after SSR, a service worker in “waiting”, an unawaited assertion.', fix: 'Draw a quick timeline: server, network, main thread, next paint.' },
    { trap: 'Trusting the name of a header or attribute', why: '<code>no-cache</code>, <code>role</code>, <code>SameSite</code>, <code>sideEffects</code> all mean something narrower or different from their plain-English reading.', fix: 'Recall the exact definition before you answer.' },
    { trap: 'Assuming one environment', why: 'jsdom is not a browser, the dev server is not the production build, Chromium is not WebKit, and Lighthouse is not real users.', fix: 'For each question, ask which environment the behaviour depends on.' },
    { trap: 'Confusing origin and site', why: '<code>app.example.com</code> and <code>api.example.com</code> are cross-origin (CORS applies) but same-site (SameSite cookies are sent).', fix: 'Origin = scheme + host + port. Site = scheme + registrable domain.' }
  ],
  scenarios: [
    { title: 'Use it as a team warm-up',
      symptom: 'A frontend guild wants a quick, shared check of fundamentals before an architecture review.',
      cause: 'Mixed backgrounds: some people are strong on React, others on CSS or HTTP.',
      fix: 'Everyone runs “10 questions, Normal” and shares the per-topic breakdown; the weakest topic becomes the next brown-bag session.' },
    { title: 'Use it to prepare for a senior interview',
      symptom: 'You have a frontend or full-stack interview in a week and limited time.',
      cause: 'Reading every page fully takes hours; you need to find your gaps.',
      fix: 'Run “all 40” on Slow once, then open only the topic pages linked from your misses. Repeat on Fast two days later.' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Two <code>async</code> scripts are in the head. Which runs first?', code: `<script async src="a.js"></script>\n<script async src="b.js"></script>`, lang: 'text', options: ['a.js always', 'b.js always', 'Whichever finishes downloading first', 'Both after DOMContentLoaded'], answer: 2, explain: '<code>async</code> scripts execute as soon as they arrive, in any order, possibly before parsing finishes. Use <code>defer</code> when order matters. See <a href="fe-critical-rendering-path.html">Critical rendering path</a>.' },
    { kind: 'concept', q: 'Which is true about <code>Access-Control-Allow-Origin: *</code>?', options: ['It works with cookies', 'It is rejected by browsers for credentialed requests', 'It disables CORS on the server', 'It protects against CSRF'], answer: 1, explain: 'With <code>credentials: \'include\'</code> the server must echo a specific origin. See <a href="fe-security.html">Frontend security</a>.' },
    { kind: 'concept', q: 'Which change most directly reduces INP?', options: ['Compressing images', 'Splitting a 300 ms task and yielding to the main thread', 'A CDN', 'Adding width/height to images'], answer: 1, explain: 'Input waits behind long tasks. Yielding lets it run sooner. See <a href="fe-core-web-vitals.html">Core Web Vitals</a>.' },
    { kind: 'concept', q: 'Why does a component test with <code>getByRole(\'button\', { name: \'Save\' })</code> help accessibility?', options: ['It doesn’t', 'It fails if the button has no accessible role or name, so a11y regressions break tests', 'It runs axe', 'It checks contrast'], answer: 1, explain: 'Queries mirror the accessibility tree. See <a href="fe-testing.html">Frontend testing</a> and <a href="fe-accessibility.html">Accessibility</a>.' },
    { kind: 'concept', q: 'Which of these is <i>not</i> render-blocking by default?', code: `<link rel="stylesheet" href="app.css">\n<script src="app.js"></script>\n<script type="module" src="main.js"></script>\n<link rel="stylesheet" href="print.css" media="print">`, lang: 'text', options: ['app.css', 'app.js', 'Both the module script and print.css', 'None of them'], answer: 2, explain: 'Module scripts are deferred by default, and a stylesheet whose media doesn’t match (print) is fetched at low priority without blocking rendering.' }
  ],
  interview: [
    { q: 'How would you explain the browser rendering pipeline in two minutes?', a: '<p>Parse HTML into the DOM and CSS into the CSSOM; combine into a render tree; <b>layout</b> computes geometry; <b>paint</b> fills pixels into layers; <b>composite</b> assembles layers on the GPU. Changing geometry re-runs layout; colour re-runs paint; <code>transform</code>/<code>opacity</code> can be composite-only. JS runs on the same main thread, so long tasks delay all of it. See <a href="fe-how-browser-works.html">How the browser renders</a>.</p>', lvl: 'core' },
    { q: 'CSR, SSR, SSG, ISR: how do you choose?', a: '<p>SSG for content that is the same for everyone and changes rarely; ISR when it changes occasionally; SSR for per-request or personalised content that needs fast first paint or SEO; CSR for app-like screens behind login. Most real apps mix them per route. See <a href="fe-rendering-modes.html">Rendering modes</a>.</p>', lvl: 'core' },
    { q: 'What is hydration and why is it expensive?', a: '<p>After SSR, the client downloads the same component code, re-runs it to rebuild the component tree and state, and attaches event handlers to the existing DOM. Cost: JS download and execution proportional to the whole page, during which the page looks ready but may not respond. Islands, partial/progressive hydration, server components and resumability all reduce it. See <a href="fe-hydration-islands.html">Hydration & islands</a>.</p>', lvl: 'deep' },
    { q: 'Which frontend bugs are really caching bugs?', a: '<p>Stale bundles after deploy (cached HTML), chunk-load errors, a CDN serving a personalised page to another user, a service worker stuck on an old version, and “it works after hard refresh”. See <a href="fe-caching-pwa.html">Caching, CDN & PWA</a> and <a href="fe-build-tools.html">Build tools</a>.</p>', lvl: 'core' },
    { q: 'What boundaries matter most in modern frontend architecture?', a: '<ul><li>Server/client (<a href="fe-server-components.html">Server Components</a>).</li><li>Shadow root (<a href="fe-web-components.html">Web Components</a>).</li><li>Origin and site (<a href="fe-security.html">Security</a>).</li><li>Team and deploy boundaries (<a href="fe-microfrontends.html">Micro-frontends</a>).</li><li>Server state vs client state (<a href="fe-state-management.html">State management</a>).</li></ul>', lvl: 'deep' },
    { q: 'Signals vs virtual DOM in one paragraph?', a: '<p>A virtual DOM re-runs component functions on state change and diffs the output to find DOM updates. Signals track which computations read which values, so a change updates exactly those computations and DOM nodes, with no diff. Vue uses reactive refs plus a VDOM; Solid and Angular signals go further toward fine-grained updates. See <a href="fe-signals.html">Signals</a>.</p>', lvl: 'deep' },
    { q: 'What is your checklist when a page “feels slow”?', a: '<p>Field data first (CrUX/RUM p75 per metric and device). LCP: TTFB, discovery, size, render-blocking. INP: long tasks, third parties, hydration, heavy handlers. CLS: missing dimensions, late content, fonts. Then bundle size and caching. See <a href="fe-core-web-vitals.html">Core Web Vitals</a>.</p>', lvl: 'core' },
    { q: 'Which modern CSS features changed how you write layouts?', a: '<p>Grid and flexbox for layout, container queries for components that adapt to their container instead of the viewport, <code>:has()</code> for parent-aware styling without JS, and cascade layers to control precedence between reset, library and app styles. See <a href="fe-modern-css.html">Modern CSS</a>.</p>', lvl: 'core' }
  ]
});
