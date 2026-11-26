/* Tricky frontend: a timed drill of 40 concept puzzles across all 16 frontend topics; misses link back to topic pages. */
IA.widget('tricky-frontend', (root, ctx) => {
  const { el } = ctx;
  const SLUG = { Browser: 'fe-how-browser-works', CRP: 'fe-critical-rendering-path', CSS: 'fe-modern-css', Rendering: 'fe-rendering-modes',
    Hydration: 'fe-hydration-islands', RSC: 'fe-server-components', Signals: 'fe-signals', State: 'fe-state-management',
    Build: 'fe-build-tools', 'Micro-FE': 'fe-microfrontends', 'Web Comp.': 'fe-web-components', Vitals: 'fe-core-web-vitals',
    A11y: 'fe-accessibility', Security: 'fe-security', Caching: 'fe-caching-pwa', Testing: 'fe-testing' };
  /*Q-START*/
  const Q = [
    // ---------- how the browser renders ----------
    { t: 'Browser', q: 'Animating which property can usually skip layout and paint and run on the compositor?', o: ['width', 'top', 'transform', 'margin-left'], a: 2, x: '<code>transform</code> (and <code>opacity</code>) can be handled by the compositor on an existing layer. <code>width</code>, <code>top</code> and <code>margin</code> change geometry, so they trigger layout, then paint.' },
    { t: 'Browser', q: 'Why is this loop slow on a list of 1,000 items?', code: `for (const el of items) {\n  el.style.width = w + 'px';     // write\n  total += el.offsetHeight;      // read\n}`, o: ['String concatenation', 'Each read forces a synchronous layout because the previous write invalidated it (layout thrashing)', 'offsetHeight is deprecated', 'style is read-only'], a: 1, x: 'Reading a layout property after a write forces the browser to recalculate layout immediately, 1,000 times. Batch all reads, then all writes (or use <code>requestAnimationFrame</code>).' },
    { t: 'Browser', q: 'Which element is invisible but still takes up space in the layout?', l: 'text', code: `<div style="display: none">A</div>\n<div style="visibility: hidden">B</div>`, o: ['A', 'B', 'Both', 'Neither'], a: 1, x: '<code>display: none</code> removes the element from the render tree (no box at all). <code>visibility: hidden</code> keeps its box, just doesn’t paint it.' },
    // ---------- critical rendering path ----------
    { t: 'CRP', q: 'Two deferred scripts: <code>big.js</code> (slow to download) appears first, <code>small.js</code> second. Execution order?', l: 'text', code: `<script defer src="big.js"></script>\n<script defer src="small.js"></script>`, o: ['small.js first, it arrives first', 'big.js then small.js, after parsing finishes, before DOMContentLoaded', 'Random', 'Both block parsing'], a: 1, x: '<code>defer</code> scripts download in parallel and run <b>in document order</b> after parsing. <code>async</code> scripts run as soon as each arrives, in any order.' },
    { t: 'CRP', q: 'What does a <code>&lt;link rel="stylesheet"&gt;</code> in the <code>&lt;head&gt;</code> block?', o: ['HTML parsing', 'Rendering (first paint), and execution of later synchronous scripts', 'Nothing; CSS is async', 'Image downloads'], a: 1, x: 'CSS is render-blocking: the browser won’t paint without the CSSOM. A following sync script also waits, since it might read styles. The parser itself keeps going.' },
    { t: 'CRP', q: 'A preloaded font is downloaded twice. The likely fix?', l: 'text', code: `<link rel="preload" href="/f/inter.woff2" as="font" type="font/woff2">`, o: ['Remove type', 'Add <code>crossorigin</code>', 'Use as="style"', 'Add async'], a: 1, x: 'Fonts are always fetched in CORS mode. A preload without <code>crossorigin</code> doesn’t match the real request, so the browser fetches again.' },
    // ---------- modern CSS ----------
    { t: 'CSS', q: 'What colour is the button?', l: 'text', code: `@layer components {\n  #buy.btn { color: red; }\n}\n.btn { color: blue; }   /* not in any layer */`, o: ['red: higher specificity', 'blue: unlayered styles beat layered ones', 'red: layers win', 'Depends on source order only'], a: 1, x: 'Cascade layers are compared <b>before</b> specificity. For normal (non-<code>!important</code>) declarations, unlayered styles beat all layers.' },
    { t: 'CSS', q: 'What does <code>.card:has(img)</code> select?', o: ['Images inside cards', 'Cards that contain an img anywhere inside them', 'Cards that are next to an img', 'Nothing; :has is not CSS'], a: 1, x: '<code>:has()</code> is the relational (“parent”) selector, supported in all current major browsers. The subject is still <code>.card</code>.' },
    { t: 'CSS', q: 'An <code>@container (min-width: 400px)</code> rule never applies. Most likely cause?', o: ['Browsers don’t support it', 'No ancestor has <code>container-type: inline-size</code> (or <code>size</code>)', 'It needs a media query too', 'min-width must be in em'], a: 1, x: 'Container queries look up the nearest ancestor declared as a query container. Without <code>container-type</code>, there is none.' },
    // ---------- rendering modes ----------
    { t: 'Rendering', q: 'With ISR (revalidate = 60 s), the first request after the 60 s expired gets…', o: ['A 503 while it rebuilds', 'The stale page, while a regeneration starts in the background', 'A freshly server-rendered page, blocking', 'A client-rendered shell'], a: 1, x: 'Incremental Static Regeneration is stale-while-revalidate for pages: serve the cached version, rebuild in the background, serve the new one to later requests.' },
    { t: 'Rendering', q: 'Which mode cannot put per-user content (the user’s name) into the initial HTML?', o: ['SSR', 'SSG', 'Streaming SSR', 'SSR with edge rendering'], a: 1, x: 'SSG builds HTML once, at build time, identical for everyone. Personalised parts must be fetched on the client or rendered per request.' },
    // ---------- hydration ----------
    { t: 'Hydration', q: 'This component logs a hydration mismatch warning. Why?', code: `function Clock() {\n  return <span>{new Date().toLocaleTimeString()}</span>;\n}`, o: ['Dates can’t be rendered', 'The server and the client render different text (different time, maybe timezone/locale)', 'span is not allowed', 'Missing key prop'], a: 1, x: 'Hydration expects the client’s first render to match the server HTML. Render time-dependent values after mount (in an effect) or pass the server value down.' },
    { t: 'Hydration', q: 'In Astro, what does <code>&lt;Chart client:visible /&gt;</code> do?', o: ['Renders the chart only on the client', 'Server-renders it, then loads and hydrates its JS only when it scrolls into view', 'Hides it until visible', 'Prerenders it as an image'], a: 1, x: 'Islands architecture: the page is static HTML, and only islands with a <code>client:*</code> directive ship JS, on the schedule you choose.' },
    { t: 'Hydration', q: 'What does “resumability” (Qwik) avoid compared with hydration?', o: ['Server rendering', 'Re-executing component code on the client to rebuild state and attach listeners at startup', 'JavaScript entirely', 'CSS'], a: 1, x: 'State and listener locations are serialised into the HTML. The client loads the code for a handler only when that interaction happens.' },
    // ---------- server components ----------
    { t: 'RSC', q: 'A Server Component calls <code>useState</code>. What happens?', o: ['Works, state lives on the server', 'Error: hooks like useState/useEffect need a Client Component (<code>"use client"</code>)', 'State resets every request but works', 'It becomes a Client Component automatically'], a: 1, x: 'Server Components render once on the server and have no client lifecycle. Interactive parts go into Client Components.' },
    { t: 'RSC', q: 'A Client Component (<code>"use client"</code>) receives a Server Component as <code>children</code>. Is the child still server-rendered?', o: ['No, everything below a client boundary becomes client code', 'Yes: passed as a prop, it is rendered on the server and sent as RSC payload', 'Only in dev', 'It errors'], a: 1, x: '<code>"use client"</code> affects what that module <i>imports</i>. Server Components passed in as props or children stay on the server.' },
    { t: 'RSC', q: 'Which is true of a Server Action (<code>"use server"</code>)?', o: ['It can only be called by your own components', 'It is exposed as a public POST endpoint, so it must check authentication and authorisation and validate input', 'It runs in the browser', 'It is cached like a GET'], a: 1, x: 'Anyone can call it with a crafted request. Treat it like a <code>@PostMapping</code> controller method.' },
    // ---------- signals ----------
    { t: 'Signals', q: 'Vue 3. What is <code>double.value</code> at the end?', code: `const count = ref(1);\nconst double = computed(() => count.value * 2);\ncount.value = 5;\nconsole.log(double.value);`, o: ['2', '10', 'undefined', 'A Promise'], a: 1, x: '<code>computed</code> tracks <code>count</code> as a dependency and recomputes lazily when read after it changes: 10.' },
    { t: 'Signals', q: 'In SolidJS, how often does a component function run?', o: ['On every state change, like React', 'Once; signals update only the specific DOM nodes that read them', 'Once per frame', 'Never on the client'], a: 1, x: 'Fine-grained reactivity: the component is setup code. Effects and JSX expressions subscribe to signals directly, with no virtual DOM diff.' },
    // ---------- state management ----------
    { t: 'State', q: 'TanStack Query with the default <code>staleTime</code> (0). The user switches back to the tab. What happens?', o: ['Nothing', 'Cached data shows immediately and a background refetch runs (refetchOnWindowFocus)', 'The cache is cleared', 'The page reloads'], a: 1, x: 'Data is stale immediately by default, so focus, remount and reconnect trigger background refetches. Raise <code>staleTime</code> for data that changes rarely.' },
    { t: 'State', q: 'Why is this a bug waiting to happen?', code: `const [items, setItems] = useState<Item[]>([]);\nconst [total, setTotal] = useState(0);   // kept "in sync" manually`, o: ['useState can’t hold arrays', 'Derived state duplicated in state can drift out of sync; compute <code>total</code> from <code>items</code>', 'Two useState calls are slow', 'Nothing wrong'], a: 1, x: 'Store the minimal source of truth and derive the rest during render (memoise if expensive).' },
    // ---------- build tools ----------
    { t: 'Build', q: 'Which import is tree-shaken most reliably?', code: `// A  const { debounce } = require('lodash');\n// B  import { debounce } from 'lodash-es';\n// C  import _ from 'lodash';`, o: ['A', 'B', 'C', 'All equally'], a: 1, x: 'Static named imports from an ESM build. CommonJS is dynamic, so bundlers must keep it.' },
    { t: 'Build', q: 'Vite dev server: does it type-check your TypeScript?', o: ['Yes, on every save', 'No, it strips types per file (esbuild); run tsc --noEmit separately', 'Only in production builds', 'Only .tsx files'], a: 1, x: 'Speed comes from not type-checking. Add <code>tsc --noEmit</code> (or <code>vue-tsc</code>) to CI.' },
    { t: 'Build', q: 'Right after each deploy, users see “Failed to fetch dynamically imported module”. Most likely cause?', o: ['A bundler bug', 'Cached old index.html referencing chunk hashes that the deploy deleted', 'CORS', 'Tree shaking removed the chunk'], a: 1, x: 'Serve HTML with <code>no-cache</code>, keep old assets for a while, and reload once on chunk-load failures.' },
    // ---------- micro-frontends ----------
    { t: 'Micro-FE', q: 'A remote stops sharing React and bundles its own copy. What breaks?', o: ['Only bundle size', 'Hooks and context across the boundary (“Invalid hook call”)', 'CSS', 'Routing'], a: 1, x: 'Two React copies mean two dispatchers and two context systems. Share framework libraries as singletons.' },
    { t: 'Micro-FE', q: 'Main legitimate reason to adopt micro-frontends?', o: ['Better performance', 'Independent ownership and deployment for many teams', 'Smaller bundles', 'Better SEO'], a: 1, x: 'It is an organisational tool. It usually costs performance and consistency.' },
    // ---------- web components ----------
    { t: 'Web Comp.', q: 'An inner shadow-DOM button dispatches <code>new CustomEvent("pick", { bubbles: true })</code>. Does a <code>document</code> listener fire?', o: ['Yes', 'No, it needs <code>composed: true</code> to cross the shadow root', 'Only in Chrome', 'Yes, twice'], a: 1, x: 'Without <code>composed</code> it stops at the shadow root. With it, outside listeners see <code>target</code> retargeted to the host.' },
    { t: 'Web Comp.', q: 'Page CSS: <code>p { color: red }</code> and <code>:root { --brand: teal }</code>. Shadow-internal CSS: <code>p { color: var(--brand) }</code>. Colour of the internal p?', o: ['red', 'teal', 'black', 'inherit'], a: 1, x: 'Page selectors don’t reach into shadow roots, but custom properties inherit through them.' },
    // ---------- web vitals ----------
    { t: 'Vitals', q: 'What replaced FID as a Core Web Vital in March 2024?', o: ['TBT', 'INP', 'TTI', 'FCP'], a: 1, x: 'Interaction to Next Paint: all interactions, from input to next paint. Good is ≤ 200 ms at p75.' },
    { t: 'Vitals', q: 'A hero image has <code>loading="lazy"</code>. Which metric suffers most?', o: ['CLS', 'LCP', 'INP', 'TTFB'], a: 1, x: 'Lazy loading delays discovery of the likely LCP element. Use <code>fetchpriority="high"</code> on above-the-fold heroes.' },
    { t: 'Vitals', q: 'Clicking “Show more” expands a section and pushes content down. Does that shift count toward CLS?', o: ['Yes', 'No: shifts within 500 ms of a discrete user input are excluded', 'Only if over 0.1', 'Only on mobile'], a: 1, x: 'Expected shifts right after input are flagged <code>hadRecentInput</code> and excluded.' },
    // ---------- a11y ----------
    { t: 'A11y', q: 'What does adding <code>role="button"</code> to a <code>&lt;div&gt;</code> give you automatically?', o: ['Focusability', 'Enter/Space activation', 'Only the announced role', 'Everything a button has'], a: 2, x: 'ARIA changes semantics, not behaviour. Use <code>&lt;button&gt;</code>.' },
    { t: 'A11y', q: 'WCAG AA minimum contrast for normal-size body text?', o: ['3 : 1', '4.5 : 1', '7 : 1', '2.5 : 1'], a: 1, x: '4.5 : 1 for normal text; 3 : 1 for large text and UI components; 7 : 1 is AAA.' },
    // ---------- security ----------
    { t: 'Security', q: 'Does a correct CORS configuration protect your API from a malicious script running on a server?', o: ['Yes', 'No: CORS is enforced by browsers only; non-browser clients ignore it', 'Only with credentials', 'Only for POST'], a: 1, x: 'CORS lets servers relax the browser’s same-origin policy. Protect APIs with authentication and authorisation.' },
    { t: 'Security', q: 'Are <code>https://app.example.com</code> and <code>https://api.example.com</code> same-site?', o: ['No, different hosts', 'Yes: same scheme and registrable domain (but cross-origin)', 'Only with CORS', 'Only on port 443'], a: 1, x: 'Same-site (SameSite cookies are sent) but cross-origin (CORS applies). CSRF from a sibling subdomain is not stopped by SameSite.' },
    { t: 'Security', q: 'Which rendering is an XSS risk with user-supplied <code>bio</code>?', code: `// A  <p>{bio}</p>                       (React)\n// B  <p v-html="bio"></p>               (Vue)\n// C  <p th:text="\${bio}"></p>          (Thymeleaf)`, o: ['A', 'B', 'C', 'None'], a: 1, x: '<code>v-html</code> inserts raw HTML. React <code>{}</code> and Thymeleaf <code>th:text</code> escape (<code>th:utext</code> would not).' },
    // ---------- caching ----------
    { t: 'Caching', q: 'What does <code>Cache-Control: no-cache</code> mean?', o: ['Never store the response', 'Store it, but revalidate with the server before each reuse', 'Cache only in the CDN', 'Cache for one hour'], a: 1, x: '<code>no-store</code> means don’t store. <code>no-cache</code> means always revalidate (often a cheap 304).' },
    { t: 'Caching', q: 'You deployed a new service worker, but users with an open tab still run the old one. Why?', o: ['SWs are cached for 24 h', 'The new SW waits until all pages controlled by the old one close, unless it calls skipWaiting()', 'The manifest is stale', 'HTTPS is missing'], a: 1, x: 'The waiting phase prevents one page from being served by two versions. Prompt the user and call <code>skipWaiting()</code>.' },
    // ---------- testing ----------
    { t: 'Testing', q: 'Which Testing Library query should you prefer for a “Save” button?', o: ['getByTestId("save")', 'querySelector(".btn-save")', 'getByRole("button", { name: "Save" })', 'getByText("Save")'], a: 2, x: 'Role + accessible name matches how users and assistive tech find it, and survives refactors.' },
    { t: 'Testing', q: 'Playwright: <code>expect(page.getByText("Saved")).toBeVisible()</code> without <code>await</code>, and “Saved” never appears. Result?', o: ['Fails after the timeout', 'The test may pass: the assertion promise is never awaited', 'Syntax error', 'Retries forever'], a: 1, x: 'Web-first assertions are async. Always <code>await</code> them; lint for floating promises.' }
  ];
  /*Q-END*/
  const TOPICS = ['All', ...[...new Set(Q.map((q) => q.t))]];
  if (!document.getElementById('w-tfe-style')) {
    document.head.append(el('style', { id: 'w-tfe-style', text: `
.w-tfe-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tfe-bar div { height: 100%; background: var(--accent); }
.w-tfe-bar div.low { background: var(--err); }
.w-tfe-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tfe-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-tfe-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tfe-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tfe-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tfe-opts button:disabled { cursor: default; }
.w-tfe-q { font-size: 16px; margin: 6px 0 8px; }
.w-tfe-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tfe-rev:first-child { border-top: 0; }
` }));
  }
  let topic = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segT = seg(TOPICS.map((t) => [t, t]), () => topic, (v) => { topic = v; reset(); }, 'Topic');
  const segN = seg([[10, '10 questions'], [20, '20'], [40, 'all 40']], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const link = (t) => `<a href="${SLUG[t]}.html">${t}</a>`;
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: started ? `time <b>${left}s</b>` : `time <b>${secs}s</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-tfe-bar' }, bar);
    const opts = el('div', { class: 'w-tfe-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tfe-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, q.l || 'ts'));
    shuffle(q.o.map((_, j) => j)).forEach((j, pos) => { const b = el('button', { html: `<b>${'ABCD'[pos]}.</b> ${q.o[j]}` }); b.dataset.j = j; b.addEventListener('click', () => answer(j)); opts.append(b); });  // options shuffled per showing
    card.append(opts);
    const paint = () => { bar.style.width = (left / secs) * 100 + '%'; bar.className = left <= 10 ? 'low' : ''; if (!ctx.reduced) bar.style.transition = 'width 1s linear'; };
    paint(); renderStats(); say('Pick an answer before the bar runs out. Skip counts as a miss.');
    stopTimer(); const g = gen;
    tick = setInterval(() => { if (g !== gen || answered) { stopTimer(); return; } left--; paint(); renderStats(); if (left <= 0) answer(-1); }, 1000);
    card.opts = opts;
  }
  function answer(j) {
    if (answered || !started) return; answered = true; stopTimer();
    const q = deck[i]; const ok = j === q.a;
    if (ok) score++; else misses.push({ q, j });
    [...card.opts.children].forEach((b) => { const m = +b.dataset.j; b.disabled = true; if (m === q.a) b.classList.add('ok'); else if (m === j) b.classList.add('bad'); });
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x + ` <span class="tiny">More: ${link(q.t)}</span>` }));
    bStep.textContent = i + 1 < deck.length ? 'Next ›' : 'Finish ›'; renderStats();
    say(ok ? 'Correct. Press Next.' : 'Read the explanation, then press Next.');
  }
  function next() {
    if (!started) return;
    if (!answered) { answer(-2); return; }
    i++; bStep.textContent = 'Skip ›';
    if (i >= deck.length) return finish();
    show();
  }
  function finish() {
    started = false; stopTimer(); bStep.disabled = true; bPlay.textContent = '▶ Again'; card.innerHTML = '';
    const by = {}; deck.forEach((q) => { by[q.t] = by[q.t] || [0, 0]; by[q.t][1]++; }); deck.forEach((q) => { if (!misses.some((m) => m.q === q)) by[q.t][0]++; });
    card.append(el('h3', { text: `Score: ${score} / ${deck.length}`, style: { margin: '0 0 8px' } }),
      el('div', { class: 'w-stats' }, Object.entries(by).map(([t, [a, n]]) => el('span', { class: 'w-stat', html: `${link(t)} <b>${a}/${n}</b>` }))));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tfe-rev' }, el('div', { html: `<span class="pill">${q.t}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, q.l || 'ts'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : q.o[j]} · Correct: <b>${q.o[q.a]}</b>` }), el('div', { class: 'pz-exp', html: q.x + ` Revise: ${link(q.t)}.` }));
        card.append(r); });
    } else card.append(el('p', { text: 'No misses. Try “all 40” on Fast.' }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above, each with a link to its topic page.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => topic === 'All' || q.t === topic); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${topic === 'All' ? 'all topics' : topic}), <b>${secs} s</b> each. Concept puzzles: reason it out in your head, as in an interview.`, style: { margin: 0 } }));
    renderStats(); say('Choose a topic, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});
