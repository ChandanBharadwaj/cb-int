IA.register({
  track: 'frontend',
  slug: 'fe-core-web-vitals',
  title: 'Core Web Vitals',
  tagline: 'Three numbers Google uses to describe real-user experience: <b>LCP</b> (how fast the main content shows), <b>INP</b> (how fast the page responds to input) and <b>CLS</b> (how much things jump around). Think of them as the frontend’s p75 latency SLOs.',
  tldr: {
    problem: '“The site feels slow” is not actionable. Lab scores on a developer laptop look great while real users on mid-range Android phones wait 4 seconds and tap buttons that don’t respond.',
    model: 'Measure <b>real users</b> (RUM), take the <b>75th percentile</b> per page type and device, and break each metric into parts: LCP = TTFB + load delay + load time + render delay; INP = input delay + processing + presentation delay; CLS = the worst burst of unexpected shifts.',
    hook: '“What replaced FID and why?” INP, in March 2024. FID measured only the delay before the <i>first</i> interaction’s handler started. INP covers every interaction and the whole time until the next paint.',
    facts: [
      { v: '≤ 2.5 s', l: 'LCP “good” threshold (poor &gt; 4 s)' },
      { v: '≤ 200 ms', l: 'INP “good” threshold (poor &gt; 500 ms); INP replaced FID on 12 March 2024' },
      { v: '≤ 0.1', l: 'CLS “good” threshold (poor &gt; 0.25), all assessed at the 75th percentile' }
    ]
  },
  intro: {
    what: 'Core Web Vitals are three measurements of how a page feels to a real person. <b>LCP</b>: how long until the biggest thing on screen (hero image or headline) appears. <b>INP</b>: when you click or type, how long until the screen visibly reacts. <b>CLS</b>: how much content unexpectedly moves while you’re looking at it.',
    analogy: { icon: '🍽️', title: 'A restaurant visit', text: 'LCP is how long until your main course arrives. INP is how quickly the waiter responds whenever you raise your hand, all evening, not just the first time. CLS is someone moving your plate while you’re eating. A good restaurant scores well for the 75th-percentile guest, not just the owner’s friends.' },
    steps: [
      { t: 'Field vs lab', d: '<b>Field</b> (RUM) data comes from real users: Chrome UX Report (CrUX), or your own collection with the <code>web-vitals</code> library. <b>Lab</b> data (Lighthouse, WebPageTest) is a controlled run: great for debugging, not the truth.' },
      { t: 'Use the 75th percentile', d: 'A page “passes” when at least 75% of visits are good, like a p75 latency SLO.' },
      { t: 'Find the dominant part', d: 'Each metric splits into phases. Fix the biggest one first.' },
      { t: 'Ship and re-measure', d: 'CrUX is a 28-day rolling window, so improvements show up gradually. Your own RUM shows them the next day.', code: "import { onLCP, onINP, onCLS } from 'web-vitals';\n[onLCP, onINP, onCLS].forEach((f) => f((m) => navigator.sendBeacon('/rum', JSON.stringify(m))));" }
    ],
    terms: [
      ['LCP', 'Largest Contentful Paint: render time of the largest image, video poster or text block in the viewport.'],
      ['INP', 'Interaction to Next Paint: near-worst latency from a click, tap or key press to the next frame.'],
      ['CLS', 'Cumulative Layout Shift: largest burst of unexpected layout shifts, unitless.'],
      ['TTFB', 'Time to First Byte. Not a Core Web Vital, but part of LCP.'],
      ['long task', 'Main-thread work over 50 ms; it blocks input handling.'],
      ['RUM', 'Real User Monitoring: metrics collected from actual visitors’ browsers.']
    ]
  },
  visual: {
    title: 'Take each metric apart',
    caption: 'Pick <b>LCP breakdown</b>, <b>INP anatomy</b> or <b>CLS</b> and press Play or Step. The bottom box shows the fix for the highlighted phase. Example numbers are illustrative.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Simulated: long task vs yielding', code: `// Simulation: a click arrives at t=5ms while 300ms of work runs on the "main thread".
// We model input delay = time until the event loop is free.
function inputDelay(chunks, clickAt) {
  let t = 0;
  for (const c of chunks) { if (t + c > clickAt) return (t + c) - clickAt; t += c; }
  return 0;
}
console.log('one 300ms task   -> input delay', inputDelay([300], 5), 'ms');
console.log('6 x 50ms (yield) -> input delay', inputDelay([50, 50, 50, 50, 50, 50], 5), 'ms');

// the real pattern in an async loop:
const yieldToMain = () => ('scheduler' in globalThis && scheduler.yield) ? scheduler.yield() : new Promise(r => setTimeout(r, 0));
const t0 = performance.now();
for (let i = 0; i < 5; i++) { const end = performance.now() + 20; while (performance.now() < end) {} await yieldToMain(); }
console.log('5 chunks with yields done in ~', Math.round(performance.now() - t0), 'ms');`, note: 'A labelled model. Breaking a long task into chunks doesn’t make the work faster; it lets input jump the queue between chunks.' }
    ]
  },
  gotchas: [
    { trap: 'Lazy-loading the LCP image', code: `<img src="hero.avif" loading="lazy">   <!-- the hero! -->`, lang: 'text', why: 'Lazy images wait until layout confirms they are in the viewport, which adds load delay to the most important image.', fix: 'Never lazy-load above-the-fold images. Use <code>fetchpriority="high"</code> on the hero, and <code>loading="lazy"</code> only below the fold.' },
    { trap: 'Optimising Lighthouse instead of field data', why: 'Lighthouse runs one load on a simulated device with no interactions. It can’t measure INP at all (it reports Total Blocking Time as a proxy), and it misses cache, geography and device mix.', fix: 'Set targets on CrUX or your own RUM at p75, segmented by device. Use the lab for reproducing and debugging.' },
    { trap: 'Images and embeds without dimensions', code: `<img src="chart.png">   <!-- 0 px tall until it loads -->`, lang: 'text', why: 'The browser can’t reserve space, so everything below jumps when the image arrives.', fix: 'Always set <code>width</code> and <code>height</code> (the browser derives the aspect ratio), or CSS <code>aspect-ratio</code>. Reserve <code>min-height</code> for ad slots and late banners.' },
    { trap: 'Hiding content until the framework hydrates', why: 'A client-rendered or “fade in after mount” hero isn’t painted until all JS has downloaded and run, which inflates LCP render delay.', fix: 'Server-render the LCP element, and don’t animate it in from <code>opacity: 0</code>. See <a href="fe-rendering-modes.html">Rendering modes</a>.' },
    { trap: 'One big synchronous handler', code: `button.onclick = () => {\n  updateCart();          // visible change\n  sendAnalytics();       // 80 ms\n  recomputeRecommendations(); // 150 ms\n};`, why: 'Nothing paints until the whole handler returns, so INP includes the analytics and recommendations work.', fix: 'Do the visual update, then yield (<code>await scheduler.yield()</code> in Chromium 129+, or <code>setTimeout</code>) before the rest. Move heavy computation to a Web Worker.' },
    { trap: 'Web fonts swapping late', why: 'A fallback font with different metrics reflows text when the web font arrives: a layout shift, and sometimes a later LCP.', fix: '<code>font-display: swap</code> or <code>optional</code>, preload the critical font, and match fallback metrics with <code>size-adjust</code> / <code>ascent-override</code>.' }
  ],
  scenarios: [
    { title: 'Product pages fail LCP only on mobile',
      symptom: 'CrUX shows p75 LCP of 3.8 s on phones, 1.9 s on desktop. Lighthouse on a laptop says 1.4 s.',
      diagnose: `// RUM with attribution\nimport { onLCP } from 'web-vitals/attribution';\nonLCP(({ value, attribution }) => send({ value, el: attribution.target,\n  ttfb: attribution.timeToFirstByte, delay: attribution.resourceLoadDelay,\n  load: attribution.resourceLoadDuration, render: attribution.elementRenderDelay }));`,
      cause: 'The hero image was set by a carousel component after hydration, so the browser discovered it only after 900 KB of JS ran on a slow CPU. Load delay dominated.',
      fix: 'Render the first slide’s <code>&lt;img&gt;</code> in the server HTML with <code>fetchpriority="high"</code> and responsive <code>srcset</code>; hydrate the carousel later.',
      fixCode: `<img src="/img/p123-800.avif" srcset="/img/p123-400.avif 400w, /img/p123-800.avif 800w"\n     sizes="(max-width: 600px) 100vw, 50vw" width="800" height="600" fetchpriority="high" alt="…">` },
    { title: 'INP regressed to 450 ms after adding a tag manager',
      symptom: 'Users report the search box “lags”. RUM shows INP jumped from 150 ms to 450 ms the week marketing added three tags.',
      diagnose: `// Long Animation Frames API (Chromium 123+) shows which scripts block\nnew PerformanceObserver((l) => l.getEntries().forEach((e) =>\n  console.log(e.duration, e.scripts.map((s) => s.sourceURL)))).observe({ type: 'long-animation-frame', buffered: true });`,
      cause: 'Third-party scripts ran long tasks on every keystroke (session replay serialising the DOM), so input delay grew.',
      fix: 'Load tags after interaction or idle, sample session replay, debounce the search handler, and put a INP budget on third-party changes.' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which metric replaced First Input Delay (FID) as a Core Web Vital, and when?', options: ['TBT, 2022', 'INP, March 2024', 'TTFB, 2023', 'FCP, 2021'], answer: 1, explain: 'INP became a Core Web Vital on 12 March 2024. TBT is a lab-only proxy; TTFB and FCP are diagnostic metrics.' },
    { kind: 'concept', q: 'A button handler takes 40 ms, but INP for that click is 320 ms. What is the most likely cause?', options: ['The network', 'A long task already running when the user clicked (input delay), and/or heavy rendering after it', 'CLS', 'The click was a scroll'], answer: 1, explain: 'INP = input delay + processing + presentation delay. Handlers are often not the main cost; long tasks in front, and layout/paint after, are.' },
    { kind: 'concept', q: 'Which of these can be the LCP element?', options: ['A <code>&lt;script&gt;</code>', 'A <code>&lt;div&gt;</code> with a CSS <code>background-image: url(…)</code>', 'An element outside the viewport', 'An <code>&lt;iframe&gt;</code>’s inner content'], answer: 1, explain: 'Candidates are images (including CSS background images via url()), video posters, image inside SVG, and block-level text in the viewport. Iframe content is not counted for the parent page.' },
    { kind: 'concept', q: 'An accordion expands when clicked and pushes content down. Does it count toward CLS?', options: ['Yes, always', 'No: shifts within 500 ms after a discrete user input are excluded', 'Only on mobile', 'Only if it uses JS'], answer: 1, explain: 'Expected shifts right after a tap, click or key press have <code>hadRecentInput</code> set and are excluded.' },
    { kind: 'concept', q: 'Lighthouse gives 98, but CrUX says the page fails LCP. Which is “right”?', options: ['Lighthouse, it is more precise', 'CrUX: it is real users at p75; Lighthouse is one simulated load', 'Neither', 'Whichever is run last'], answer: 1, explain: 'Field data reflects real devices, networks and cache states. Use lab tools to reproduce, not to judge.' },
    { kind: 'concept', q: 'Which change most directly improves INP?', options: ['Compressing images', 'Breaking a 300 ms task into chunks that yield to the main thread', 'Adding width/height to images', 'Using a CDN'], answer: 1, explain: 'Yielding lets the browser handle pending input between chunks. Images and CDNs help LCP; dimensions help CLS.' },
    { kind: 'concept', q: 'What percentile does Google use to assess whether a page passes a Core Web Vital?', options: ['p50', 'p75', 'p95', 'p99'], answer: 1, explain: 'p75 of page loads, split by mobile and desktop.' }
  ],
  interview: [
    { q: 'What are the Core Web Vitals and their thresholds?', a: '<p><b>LCP</b> good ≤ 2.5 s, poor &gt; 4 s. <b>INP</b> good ≤ 200 ms, poor &gt; 500 ms. <b>CLS</b> good ≤ 0.1, poor &gt; 0.25. Each is assessed at the 75th percentile of page loads, separately for mobile and desktop.</p>', lvl: 'core' },
    { q: 'Why was FID replaced by INP?', a: '<p>FID only measured the input <i>delay</i> of the <i>first</i> interaction, not handler time or rendering, and most sites passed it easily. INP observes all clicks, taps and key presses during the visit and reports roughly the worst one (ignoring one outlier per 50 interactions), from input to the next paint. It better matches “this page feels sluggish”.</p>', lvl: 'core' },
    { q: 'Lab vs field data?', a: '<p>Field (RUM): real users, real devices, CrUX or your own beacons. It is the truth, but noisy and delayed. Lab: Lighthouse, WebPageTest, DevTools. Reproducible and detailed, but one synthetic environment and no real interactions. Use field data to pick targets and find problem pages, and lab tools to diagnose.</p>', lvl: 'core' },
    { q: 'How do you debug a poor LCP?', a: '<ol><li>Identify the LCP element (DevTools Performance panel or web-vitals attribution).</li><li>Split into TTFB, resource load delay, load duration and render delay.</li><li>Fix the largest part: server/CDN for TTFB; discoverability and <code>fetchpriority</code> for load delay; image size and format for duration; render-blocking resources and client-side rendering for render delay.</li></ol>', lvl: 'deep' },
    { q: 'How do you improve INP in a React or Vue app?', a: '<ul><li>Find slow interactions with RUM attribution and the Long Animation Frames API.</li><li>Reduce input delay: less JS at startup, defer third parties, split hydration.</li><li>Reduce processing: memoise, virtualise long lists, use <code>startTransition</code> (React) for non-urgent updates, move heavy work to a Worker.</li><li>Reduce presentation delay: smaller DOM, avoid forced synchronous layout, <code>content-visibility</code>.</li><li>Yield between chunks with <code>scheduler.yield()</code> where supported.</li></ul>', lvl: 'deep' },
    { q: 'How is CLS calculated?', a: '<p>Each unexpected shift scores impact fraction × distance fraction. Shifts are grouped into session windows (shifts less than 1 s apart, window capped at 5 s). CLS is the largest window’s sum. Shifts within 500 ms of user input are excluded. Since the 2021 change to windows, long-lived single-page apps aren’t punished just for being open long.</p>', lvl: 'deep' },
    { q: 'How do SPAs affect Web Vitals measurement?', a: '<p>LCP and CLS are tied to the initial page load; client-side route changes are not new page loads, so their content doesn’t produce a new LCP. INP and CLS keep accumulating across route changes in one document. Chrome has been experimenting with soft-navigation measurement for SPAs.</p>', lvl: 'deep' },
    { q: 'Do Core Web Vitals affect SEO?', a: '<p>They are part of Google’s page experience signals, a ranking factor, but relevance of content matters much more. The stronger argument is business: faster pages convert better, which you should verify with your own A/B data.</p>', lvl: 'core' },
    { q: 'How does the backend influence Web Vitals?', a: '<p>TTFB is part of LCP: slow queries, cold caches, no CDN, redirects. Sending HTML early (streaming, <code>103 Early Hints</code> for preload hints), caching at the edge, and small payloads all help. API latency also affects INP when the UI waits for a response before giving feedback, so show optimistic or pending state immediately.</p>', lvl: 'core' },
    { q: 'What is the bfcache and why does it matter?', a: '<p>The back/forward cache keeps a fully loaded page in memory so back/forward navigation is instant: LCP essentially zero. Pages are ineligible if they use <code>unload</code> handlers and, in some browsers, <code>Cache-Control: no-store</code>. Check DevTools → Application → Back/forward cache.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Collect Web Vitals with attribution and send them to a Spring Boot endpoint', lang: 'ts', code: `import { onLCP, onINP, onCLS, type Metric } from 'web-vitals/attribution';

function send(m: Metric) {
  const body = JSON.stringify({ name: m.name, value: m.value, rating: m.rating,
    id: m.id, page: location.pathname, nav: m.navigationType,
    target: (m as any).attribution?.interactionTarget ?? (m as any).attribution?.target });
  // sendBeacon survives page unload; keepalive fetch is the fallback
  navigator.sendBeacon?.('/api/rum', body) || fetch('/api/rum', { method: 'POST', body, keepalive: true });
}
onLCP(send); onINP(send); onCLS(send);`, note: 'Aggregate p75 per route and device server-side; Micrometer distribution summaries in Spring Boot work well.' },
    { title: 'Receive it in Boot and record a percentile histogram', lang: 'java', code: `@RestController
class RumController {
  private final MeterRegistry reg;
  RumController(MeterRegistry reg) { this.reg = reg; }

  record Vital(String name, double value, String rating, String page) {}

  @PostMapping(path = "/api/rum", consumes = MediaType.ALL_VALUE)
  void rum(@RequestBody String json) throws Exception {
    Vital v = new ObjectMapper().readValue(json, Vital.class);   // sendBeacon sends text/plain
    DistributionSummary.builder("web_vitals").tag("metric", v.name()).tag("page", v.page())
        .publishPercentiles(0.75).register(reg).record(v.value());
  }
}`, note: 'Keep the <code>page</code> tag low-cardinality (route templates, not raw URLs).' },
    { title: 'Yield inside a long handler', lang: 'ts', code: `async function onAddToCart() {
  renderCartBadge();                          // visible feedback first
  await (globalThis.scheduler?.yield?.() ?? new Promise((r) => setTimeout(r)));
  trackAnalytics();                           // then the rest, in a new task
  await (globalThis.scheduler?.yield?.() ?? new Promise((r) => setTimeout(r)));
  refreshRecommendations();
}` }
  ]
});
