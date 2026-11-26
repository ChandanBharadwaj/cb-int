/* Frontend basics drill: a timed drill of 30 beginner questions across the 4 Frontend Basics topics. Misses link back to the topic pages. */
IA.widget('tricky-frontend-basics', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- How the browser renders ----------
    { t: 'Browser rendering', s: 'fe-how-browser-works', q: 'What does the browser build from the HTML it downloads?', o: ['The CSSOM', 'The DOM (Document Object Model), a tree of nodes', 'A bitmap', 'The JavaScript heap'], a: 1, x: 'HTML is parsed into the <b>DOM</b>; CSS is parsed into the <b>CSSOM</b>. Together they produce the styled render tree.' },
    { t: 'Browser rendering', s: 'fe-how-browser-works', q: 'Which order is right for the rendering pipeline after styles are computed?', o: ['Paint → layout → composite', 'Layout → paint → composite', 'Composite → paint → layout', 'Layout → composite → paint'], a: 1, x: '<b>Layout</b> works out sizes and positions, <b>paint</b> draws pixels, <b>composite</b> stacks layers on the GPU.' },
    { t: 'Browser rendering', s: 'fe-how-browser-works', q: 'What is “layout” (also called reflow)?', o: ['Downloading CSS', 'Calculating the size and position of every element', 'Choosing colours', 'Running JavaScript'], a: 1, x: 'Layout is geometry. Changing width, height, font size or adding elements can force layout again, which is the most expensive step.' },
    { t: 'Browser rendering', s: 'fe-how-browser-works', q: 'Which change is usually cheapest to animate?', code: '.box { transition: ??? 0.3s; }', lang: 'text', o: ['width', 'top / left', 'transform', 'margin'], a: 2, x: '<code>transform</code> and <code>opacity</code> can be handled by the compositor without re-running layout or paint. Width, top and margin cause layout.' },
    { t: 'Browser rendering', s: 'fe-how-browser-works', q: 'Changing only <code>background-color</code> triggers which steps?', o: ['Layout, paint and composite', 'Paint and composite (no layout)', 'Nothing', 'Only parsing'], a: 1, x: 'Colour does not change geometry, so layout is skipped, but the pixels must be repainted.' },
    { t: 'Browser rendering', s: 'fe-how-browser-works', q: 'Is an element with <code>display: none</code> in the render tree?', o: ['Yes, but invisible', 'No: it is in the DOM but not rendered and takes no space', 'It is removed from the DOM', 'Only its children are'], a: 1, x: '<code>visibility: hidden</code> keeps the space (it is laid out, just not visible). <code>display: none</code> takes no space at all.' },
    { t: 'Browser rendering', s: 'fe-how-browser-works', q: 'Why is this loop slow?', code: "for (const el of items) {\n  el.style.width = box.offsetWidth + 'px'\n}", o: ['Loops are slow in JS', 'Reading offsetWidth after a style write forces a synchronous layout each time (layout thrashing)', 'style.width is read-only', 'It is not slow'], a: 1, x: 'Batch it: read all measurements first, then do all writes (or use <code>requestAnimationFrame</code>).' },
    { t: 'Browser rendering', s: 'fe-how-browser-works', q: 'At roughly what frame rate should a smooth page update?', o: ['10 fps', '24 fps', '60 fps (about 16 ms per frame)', '1000 fps'], a: 2, x: 'Most screens refresh at 60 Hz or more. Long JavaScript tasks block the main thread and cause dropped frames (jank).' },
    // ---------- Critical rendering path ----------
    { t: 'Critical path', s: 'fe-critical-rendering-path', q: 'What does a plain <code>&lt;script src="app.js"&gt;</code> in the &lt;head&gt; do to HTML parsing?', o: ['Nothing', 'Pauses parsing until the script is downloaded and run', 'Runs after the page loads', 'Runs in a worker'], a: 1, x: 'A classic script is <b>parser-blocking</b>. That is why scripts used to go at the end of &lt;body&gt;; today use <code>defer</code>.' },
    { t: 'Critical path', s: 'fe-critical-rendering-path', q: 'What does <code>defer</code> do?', code: '<script src="app.js" defer></script>', lang: 'text', o: ['Downloads after the page loads', 'Downloads in parallel and runs after HTML parsing, in document order', 'Runs as soon as it arrives, in any order', 'Never runs'], a: 1, x: 'defer = download now, run after parsing, keep order. Good default for app scripts.' },
    { t: 'Critical path', s: 'fe-critical-rendering-path', q: 'What does <code>async</code> do on a script tag?', o: ['Same as defer', 'Downloads in parallel and runs as soon as it arrives, in no guaranteed order', 'Makes the code use promises', 'Runs it on the server'], a: 1, x: 'Use async for independent scripts such as analytics, which do not depend on the DOM or other scripts.' },
    { t: 'Critical path', s: 'fe-critical-rendering-path', q: 'Why is CSS called “render-blocking”?', o: ['CSS is slow to parse', 'The browser does not paint until the CSS it needs is loaded, to avoid a flash of unstyled content', 'CSS blocks JavaScript downloads', 'It is not'], a: 1, x: 'Keep critical CSS small and load it early; non-critical CSS can be loaded later or with <code>media</code> attributes.' },
    { t: 'Critical path', s: 'fe-critical-rendering-path', q: 'What does <code>&lt;link rel="preload" href="font.woff2" as="font" crossorigin&gt;</code> do?', o: ['Applies the font', 'Starts downloading a resource the browser would otherwise find late', 'Caches it forever', 'Loads it after onload'], a: 1, x: 'preload is a high-priority hint for resources discovered late (fonts referenced in CSS, hero images). Overusing it competes with critical files.' },
    { t: 'Critical path', s: 'fe-critical-rendering-path', q: 'What is the “critical rendering path”?', o: ['The server routing table', 'The steps and resources the browser needs before it can show the first pixels', 'The longest JS function', 'The CDN path'], a: 1, x: 'HTML → DOM, CSS → CSSOM, render tree, layout, paint. Fewer blocking resources = faster first render.' },
    { t: 'Critical path', s: 'fe-critical-rendering-path', q: 'Which attribute delays loading of below-the-fold images?', code: '<img src="photo.jpg" ??? alt="">', lang: 'text', o: ['defer', 'async', 'loading="lazy"', 'preload'], a: 2, x: 'Native lazy loading. Do not lazy-load the main (LCP) image above the fold, it would slow it down.' },
    { t: 'Critical path', s: 'fe-critical-rendering-path', q: 'When does <code>DOMContentLoaded</code> fire?', o: ['After all images load', 'When the HTML is parsed and deferred scripts have run (images may still be loading)', 'Before parsing starts', 'Only on reload'], a: 1, x: '<code>load</code> fires later, after images, styles and iframes finish.' },
    // ---------- Modern CSS ----------
    { t: 'Modern CSS', s: 'fe-modern-css', q: 'When is flexbox the better choice than grid?', o: ['Two-dimensional page layouts', 'Laying items out along one axis (a row of buttons, a nav bar)', 'Never', 'Only for tables'], a: 1, x: 'Flex = one axis, content-sized. Grid = rows and columns defined first, then items placed in them.' },
    { t: 'Modern CSS', s: 'fe-modern-css', q: 'What does this centre?', code: '.parent { display: flex; justify-content: center; align-items: center; }', lang: 'text', o: ['Only the text', 'The children, horizontally and vertically (for a row)', 'The parent in the page', 'Nothing'], a: 1, x: 'justify-content works on the main axis, align-items on the cross axis. <code>display: grid; place-items: center</code> also works.' },
    { t: 'Modern CSS', s: 'fe-modern-css', q: 'What does this create?', code: '.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }', lang: 'text', o: ['3 rows', '3 equal-width columns with 16px gaps', 'A 3px border', 'One column 3x wider'], a: 1, x: '<code>fr</code> is a share of the free space. <code>gap</code> spaces rows and columns without margins.' },
    { t: 'Modern CSS', s: 'fe-modern-css', q: 'How is a container query different from a media query?', o: ['No difference', 'It reacts to the size of a parent container, not the viewport', 'It only works in print', 'It is JavaScript'], a: 1, x: 'Mark a parent with <code>container-type: inline-size</code>, then <code>@container (min-width: 400px) { … }</code>. Good for reusable components.' },
    { t: 'Modern CSS', s: 'fe-modern-css', q: 'Which selector wins?', code: '#main p { color: red }\n.text { color: blue }\n/* <div id="main"><p class="text">Hi</p></div> */', lang: 'text', o: ['blue: it comes last', 'red: an id makes the selector more specific', 'black', 'both'], a: 1, x: 'Specificity beats order: ids &gt; classes/attributes &gt; elements. Order only decides between equal specificity.' },
    { t: 'Modern CSS', s: 'fe-modern-css', q: 'What does <code>.card:has(img)</code> select?', o: ['Images inside .card', '.card elements that contain an img', 'cards without images', 'Nothing, invalid'], a: 1, x: '<code>:has()</code> is the “parent selector”: it styles an element based on what it contains.' },
    { t: 'Modern CSS', s: 'fe-modern-css', q: 'With <code>@layer base, components;</code>, a rule in components and a more specific one in base set the same property. Which wins?', o: ['base, it is more specific', 'components: a later layer beats an earlier one regardless of specificity', 'The first declared', 'Neither'], a: 1, x: 'Cascade layers make layer order beat specificity, which ends specificity wars between resets, libraries and your code.' },
    // ---------- Rendering modes ----------
    { t: 'Rendering modes', s: 'fe-rendering-modes', q: 'In CSR (client-side rendering), what does the first HTML response contain?', o: ['The full page', 'A mostly empty shell; JavaScript builds the page in the browser', 'Only images', 'Pre-rendered HTML from build time'], a: 1, x: 'Classic SPA (e.g. a default Vite Vue/React app). Simple to host, but slower first content and weaker SEO without care.' },
    { t: 'Rendering modes', s: 'fe-rendering-modes', q: 'What is SSR?', o: ['HTML built once at build time', 'The server renders full HTML for each request, then JS hydrates it in the browser', 'Rendering in a service worker', 'CSS-only pages'], a: 1, x: 'Good for personalised or frequently changing pages and SEO. Costs server work per request.' },
    { t: 'Rendering modes', s: 'fe-rendering-modes', q: 'What is SSG?', o: ['Server renders per request', 'Pages rendered to HTML once at build time and served as static files, often from a CDN', 'A JS framework', 'Streaming SSR'], a: 1, x: 'Fastest and cheapest to serve. Content is only as fresh as the last build.' },
    { t: 'Rendering modes', s: 'fe-rendering-modes', q: 'What does ISR (incremental static regeneration) add to SSG?', o: ['Client-side routing', 'Static pages that regenerate in the background after a time window or on demand, without a full rebuild', 'Server components', 'Offline support'], a: 1, x: 'Visitors get the cached page; a stale page is rebuilt in the background (stale-while-revalidate).' },
    { t: 'Rendering modes', s: 'fe-rendering-modes', q: 'What is hydration?', o: ['Compressing HTML', 'JavaScript in the browser attaching event handlers and state to server-rendered HTML so it becomes interactive', 'Caching on a CDN', 'Loading CSS'], a: 1, x: 'Until hydration finishes, the page is visible but buttons may not respond. That gap is a known SSR cost.' },
    { t: 'Rendering modes', s: 'fe-rendering-modes', q: 'A marketing blog that changes once a week. Best default?', o: ['CSR', 'SSR on every request', 'SSG (or ISR)', 'Server-side PHP only'], a: 2, x: 'Content rarely changes and is the same for everyone: render at build time and serve from a CDN.' },
    { t: 'Rendering modes', s: 'fe-rendering-modes', q: 'A logged-in dashboard with per-user data, SEO not needed. Reasonable choice?', o: ['SSG', 'CSR (or SSR); per-user data cannot be pre-built at build time', 'ISR with 1 year revalidate', 'A PDF'], a: 1, x: 'Modern frameworks (Nuxt, Next) let you mix modes per route: SSG for marketing, SSR/CSR for the app.' }
  ];
  /*Q-END*/
  const TOPICS = ['All', ...[...new Set(Q.map((q) => q.t))]];
  const slugOf = {}; Q.forEach((q) => { slugOf[q.t] = q.s; });
  if (!document.getElementById('w-tfb-style')) {
    document.head.append(el('style', { id: 'w-tfb-style', text: `
.w-tfb-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tfb-bar div { height: 100%; background: var(--accent); }
.w-tfb-bar div.low { background: var(--err); }
.w-tfb-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tfb-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-tfb-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tfb-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tfb-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tfb-opts button:disabled { cursor: default; }
.w-tfb-q { font-size: 16px; margin: 6px 0 8px; }
.w-tfb-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tfb-rev:first-child { border-top: 0; }
` }));
  }
  let topic = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segT = seg(TOPICS.map((t) => [t, t]), () => topic, (v) => { topic = v; reset(); }, 'Topic');
  const segN = seg([[10, '10 questions'], [20, '20'], [30, 'all 30']], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-tfb-bar' }, bar);
    const opts = el('div', { class: 'w-tfb-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tfb-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, q.lang || 'ts'));
    q.o.forEach((o, j) => { const b = el('button', { html: `<b>${'ABCD'[j]}.</b> ${o}` }); b.addEventListener('click', () => answer(j)); opts.append(b); });
    card.append(opts);
    const paint = () => { bar.style.width = (left / secs) * 100 + '%'; bar.className = left <= 10 ? 'low' : ''; if (!reduced) bar.style.transition = 'width 1s linear'; };
    paint(); renderStats(); say('Pick an answer before the bar runs out. Skip counts as a miss.');
    stopTimer(); const g = gen;
    tick = setInterval(() => { if (g !== gen || answered) { stopTimer(); return; } left--; paint(); renderStats(); if (left <= 0) answer(-1); }, 1000);
    card.opts = opts;
  }
  function answer(j) {
    if (answered || !started) return; answered = true; stopTimer();
    const q = deck[i]; const ok = j === q.a;
    if (ok) score++; else misses.push({ q, j });
    [...card.opts.children].forEach((b, m) => { b.disabled = true; if (m === q.a) b.classList.add('ok'); else if (m === j) b.classList.add('bad'); });
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x }));
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
      el('div', { class: 'w-stats' }, Object.entries(by).map(([t, [a, n]]) => el('span', { class: 'w-stat', html: `<a href="${slugOf[t]}.html">${t}</a> <b>${a}/${n}</b>` }))));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tfb-rev' }, el('div', { html: `<span class="pill">${q.t}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, q.lang || 'ts'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : q.o[j]} · Correct: <b>${q.o[q.a]}</b>` }), el('div', { class: 'pz-exp', html: q.x + ` <a href="${q.s}.html">Review the topic →</a>` }));
        card.append(r); });
    } else card.append(el('p', { text: 'No misses. Try “all 30” on Fast.' }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above with explanations.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => topic === 'All' || q.t === topic); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${topic === 'All' ? 'all topics' : topic}), <b>${secs} s</b> each. No running code: predict the result in your head, like in an interview.`, style: { margin: 0 } }));
    renderStats(); say('Choose a topic, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});
