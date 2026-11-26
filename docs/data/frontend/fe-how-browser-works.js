IA.register({
  track: 'frontend',
  slug: 'fe-how-browser-works',
  title: 'How the browser renders',
  tagline: 'A browser turns bytes into pixels through a fixed pipeline: <b>parse → style → layout → paint → composite</b>. Every performance trick is about making a change re-run as few of those stages as possible.',
  tldr: {
    problem: 'Pages that stutter on scroll, animations that jank, a click that freezes the tab for 300 ms. These usually aren’t “slow JavaScript”; they are the main thread re-running layout and paint far more often than needed.',
    model: 'HTML → <b>DOM</b>, CSS → <b>CSSOM</b>. Together they give computed styles, then <b>layout</b> (geometry), <b>paint</b> (draw commands, rasterised to pixels) and <b>composite</b> (GPU stacks layers). A change to geometry re-runs layout onward; a colour re-runs paint onward; <code>transform</code>/<code>opacity</code> can skip to composite.',
    hook: '“Why is animating <code>left</code> janky but <code>transform</code> smooth?” Because <code>left</code> triggers layout and paint on the main thread every frame, while <code>transform</code> on its own layer is just compositing.',
    facts: [
      { v: '~16.7 ms', l: 'per frame at 60 Hz. Script, style, layout and paint must fit in it (less on 120 Hz screens)' },
      { v: '1 thread', l: 'runs your JS, style, layout and paint (the main thread). The compositor and raster work run on other threads' },
      { v: 'offsetWidth', l: 'and other geometry reads force a synchronous layout if styles are dirty: the root of “layout thrashing”' }
    ]
  },
  intro: {
    what: 'A web page arrives as plain text: <b>HTML</b> (structure), <b>CSS</b> (looks) and <b>JavaScript</b> (behaviour). The browser builds two trees from the text, works out where every box goes, draws them, and shows the result. It repeats part of that work every time something changes. Think of it as a small compiler and renderer that runs inside every tab.',
    analogy: { icon: '🏗️', title: 'Building a house from plans', text: 'HTML is the floor plan (which rooms exist), CSS is the interior-design spec (colours, sizes). Layout is the surveyor measuring where each wall goes. Paint is the painters. Compositing is stacking finished glass panels in front of each other. Moving a wall (layout) means re-measuring and repainting; changing a colour only needs painters; sliding a glass panel needs neither.' },
    steps: [
      { t: 'Parse HTML into the DOM', d: 'The <b>DOM</b> (Document Object Model) is a tree of element objects. It’s what <code>document.querySelector</code> returns nodes from. Parsing is incremental: the browser builds it while bytes still stream in.' },
      { t: 'Parse CSS into the CSSOM', d: 'All stylesheets become the <b>CSSOM</b>. The cascade then gives each element its <b>computed style</b>.', code: 'getComputedStyle(el).width   // the result of the cascade', lang: 'ts' },
      { t: 'Layout', d: 'Turn styled elements into boxes with x, y, width and height. Also called <b>reflow</b>.' },
      { t: 'Paint and composite', d: 'Paint records draw commands per layer, raster turns them into pixels, and the compositor stacks layers into the frame you see.' },
      { t: 'Changes re-run part of it', d: 'JS changes the DOM or styles, and the browser re-runs only the stages that change affects, ideally once per frame.' }
    ],
    terms: [
      ['DOM', 'The live tree of elements built from HTML. JS reads and changes it.'],
      ['CSSOM', 'The parsed form of all CSS rules, used to compute each element’s style.'],
      ['layout / reflow', 'Computing the size and position of every box.'],
      ['paint / raster', 'Recording draw commands, then turning them into pixels.'],
      ['compositing layer', 'A separately rasterised surface the GPU can move or fade without repainting.'],
      ['main thread', 'The single thread that runs JS, style, layout and paint for a page.']
    ]
  },
  visual: {
    title: 'What a change re-runs',
    caption: 'Pick a change at the top, then press Play or Step. Green means a stage ran, grey means it was skipped. Try <b>layout thrash</b> to see the forced synchronous layout.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Simulated frame budget', code: `// A simulation (no real DOM in this worker): what fits in one 60 Hz frame?
const BUDGET = 1000 / 60;
const cost = { script: 4, style: 2, layout: 6, paint: 3, composite: 1 };   // ms, illustrative
const changes = {
  'left: 10px': ['script', 'style', 'layout', 'paint', 'composite'],
  'background': ['script', 'style', 'paint', 'composite'],
  'transform':  ['script', 'style', 'composite'],
};
for (const [prop, stages] of Object.entries(changes)) {
  const ms = stages.reduce((s, x) => s + cost[x], 0);
  console.log(prop.padEnd(12), stages.join(' → ').padEnd(46), ms + 'ms', ms <= BUDGET ? 'fits' : 'DROPS FRAME');
}`, note: 'Illustrative numbers. Real costs depend on DOM size and the device; measure in the DevTools Performance panel.' },
      { label: 'Layout thrash model', code: `// Model a browser that lazily computes layout, like a real one does.
let dirty = false, layouts = 0;
const write = () => { dirty = true; };
const read = () => { if (dirty) { layouts++; dirty = false; } return 100; };

// interleaved: read, write, read, write …
for (let i = 0; i < 1000; i++) { read(); write(); }
console.log('interleaved layouts:', layouts);

layouts = 0; dirty = false;
const widths = []; for (let i = 0; i < 1000; i++) widths.push(read()); // all reads
for (let i = 0; i < 1000; i++) write();                                 // then all writes
read(); // next frame
console.log('batched layouts:', layouts);`, note: 'Interleaving gives 999 forced layouts; batching gives 1.' }
    ]
  },
  gotchas: [
    { trap: 'Animating layout properties', code: `.drawer { transition: left .3s; }          /* layout + paint each frame */\n.drawer { transition: transform .3s; }     /* composite only */`, lang: 'text', why: '<code>left</code>, <code>top</code>, <code>width</code>, <code>height</code>, <code>margin</code> change geometry, so every frame re-runs layout and paint on the main thread. Any long task then makes the animation stutter.', fix: 'Animate <code>transform</code> and <code>opacity</code>. They can run on the compositor thread, even while JS is busy.' },
    { trap: 'Layout thrashing in a loop', code: `items.forEach(el => {\n  el.style.height = el.offsetHeight + 10 + 'px'; // read after write → forced layout\n});`, why: 'Reading geometry (<code>offsetHeight</code>, <code>getBoundingClientRect()</code>, <code>scrollTop</code>, <code>getComputedStyle</code>) while styles are dirty forces layout synchronously. In a loop that is N layouts in one task.', fix: 'Batch: read all values first, then write all. Put writes in <code>requestAnimationFrame</code>.' },
    { trap: '<code>will-change</code> on everything', code: `* { will-change: transform; }   /* please don't */`, lang: 'text', why: 'Each promoted layer costs GPU memory and compositing work. Hundreds of layers can make things slower, especially on phones.', fix: 'Promote only elements that actually animate, and only while they animate.' },
    { trap: '“The DOM is slow”', why: 'Creating or editing DOM nodes is cheap. What costs is the style, layout and paint work your changes cause, and how often you force it.', fix: 'Measure with the Performance panel. Look for long purple (style/layout) and green (paint) blocks rather than blaming DOM calls.' },
    { trap: 'Huge DOMs and deep selectors', why: 'Style recalculation and layout scale with the number of affected elements. A 15,000-node page makes every invalidation expensive.', fix: 'Virtualise long lists, and use <code>content-visibility: auto</code> for off-screen sections so the browser skips their layout and paint.' },
    { trap: '<code>display: none</code> vs <code>visibility: hidden</code>', why: '<code>display: none</code> removes the box from layout (toggling it reflows). <code>visibility: hidden</code> keeps the space, so toggling it only repaints.', fix: 'Choose based on whether the space should collapse. For fade-outs use <code>opacity</code>.' }
  ],
  scenarios: [
    { title: 'Infinite feed scrolls at 20 fps on mid-range Android',
      symptom: 'Scrolling the product feed stutters; DevTools shows long “Recalculate Style” and “Layout” blocks on every scroll event.',
      diagnose: `// Performance panel → a scroll handler doing this:\nwindow.addEventListener('scroll', () => {\n  cards.forEach(c => c.classList.toggle('sticky', c.getBoundingClientRect().top < 0));\n});`,
      cause: 'Each iteration reads geometry, then toggles a class that dirties style. With 800 cards that is hundreds of forced layouts per scroll event.',
      fix: 'Replace geometry polling with an <code>IntersectionObserver</code> (or CSS <code>position: sticky</code>), make the handler passive, and virtualise the list.',
      fixCode: `const io = new IntersectionObserver(entries => {\n  for (const e of entries) e.target.classList.toggle('sticky', !e.isIntersecting);\n});\ncards.forEach(c => io.observe(c));` },
    { title: 'Side menu animation janks only while the page is loading data',
      symptom: 'The menu slides smoothly on an idle page, but stutters badly while a big JSON response is being parsed.',
      diagnose: 'The animation uses <code>transition: margin-left</code>. The Performance panel shows the frames waiting behind a 400 ms task (JSON parse plus rendering).',
      cause: 'Layout-based animations run on the main thread, so any long task freezes them.',
      fix: 'Animate <code>transform: translateX()</code>. Compositor-driven animations keep running while the main thread is busy. Split the long task too.',
      fixCode: `.menu { transform: translateX(-100%); transition: transform .25s ease; }\n.menu.open { transform: none; }`, lang: 'text' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which property change can usually skip both layout and paint?', options: ['width', 'background-color', 'transform', 'margin-top'], answer: 2, explain: '<code>transform</code> (and <code>opacity</code>) don’t change layout. If the element is on its own compositor layer, only compositing runs. Background colour skips layout but still repaints.' },
    { kind: 'predict', q: 'How many forced synchronous layouts does this cause, roughly, for 100 elements?', code: `for (const el of els) {\n  const h = el.offsetHeight;   // read\n  el.style.height = h * 2 + 'px'; // write\n}`, options: ['0', '1', '~100', 'It depends on the CSS file size'], answer: 2, explain: 'Each read after the previous write finds layout dirty, so the browser lays out synchronously: about one per iteration (the first read may be clean). Batch reads then writes to get one.' },
    { kind: 'concept', q: 'Why is CSS called render-blocking?', options: ['The browser can’t parse HTML until CSS loads', 'The browser won’t paint until the CSSOM is built, to avoid a flash of unstyled content', 'CSS runs on the main thread like JS', 'It isn’t; only JS blocks'], answer: 1, explain: 'HTML parsing continues while CSS downloads, but rendering waits for the CSSOM. Scripts after a stylesheet also wait, because they could read computed styles.' },
    { kind: 'concept', q: 'An element has <code>display: none</code>. Which is true?', options: ['It is in the DOM but not in the render tree', 'It is not in the DOM', 'It is laid out with zero size', 'It is painted transparent'], answer: 0, explain: 'It stays in the DOM (JS can find it) but produces no boxes, so layout and paint ignore it. <code>visibility: hidden</code> keeps its box.' },
    { kind: 'concept', q: 'Your JS runs a 300 ms loop. What still works during it?', options: ['Nothing at all', 'Click handlers', 'A CSS transform animation already running on the compositor', 'Layout changes from CSS :hover'], answer: 2, explain: 'The main thread is blocked, so no handlers, style or layout. Compositor-driven animations of transform/opacity keep going, and so does scrolling in many cases.' },
    { kind: 'concept', q: 'What does <code>content-visibility: auto</code> do?', options: ['Lazy-loads images', 'Lets the browser skip layout and paint of off-screen content until it nears the viewport', 'Hides content from screen readers', 'Turns an element into a compositor layer'], answer: 1, explain: 'It skips rendering work for off-screen subtrees. Pair it with <code>contain-intrinsic-size</code> so the scrollbar doesn’t jump as sections render.' }
  ],
  interview: [
    { q: 'Walk me through what happens from receiving HTML to pixels on screen.', a: '<p>Bytes are decoded and tokenised; the parser builds the <b>DOM</b> incrementally. Stylesheets become the <b>CSSOM</b>. Style resolution computes each element’s styles. <b>Layout</b> computes geometry. <b>Paint</b> records draw commands per layer; raster turns them into tiles; the <b>compositor</b> assembles layers into a frame on the GPU. Scripts can pause parsing (classic sync scripts), and CSS blocks rendering.</p>', fu: 'Where does the preload scanner fit? (It scans ahead for URLs while the parser is blocked, so downloads start early.)', lvl: 'core' },
    { q: 'What is the difference between reflow and repaint?', a: '<p><b>Reflow</b> (layout) recomputes geometry, and it can cascade to ancestors, siblings and descendants. <b>Repaint</b> redraws pixels without moving anything (colour, shadow). Reflow implies repaint; repaint doesn’t imply reflow.</p>', lvl: 'core' },
    { q: 'What is layout thrashing and how do you fix it?', a: '<p>Interleaving DOM writes with geometry reads in the same task. Each read forces a synchronous layout so it can return a correct value. Fix: read everything, then write everything; defer writes to <code>requestAnimationFrame</code>; use observers (<code>ResizeObserver</code>, <code>IntersectionObserver</code>) instead of polling geometry.</p>', lvl: 'core' },
    { q: 'Why are transform and opacity “cheap” to animate?', a: '<p>They don’t change layout, and for a promoted layer they don’t require a repaint: the compositor just moves or blends the existing texture. That work can happen off the main thread, so long JS tasks don’t freeze the animation.</p>', fu: 'Costs? Each layer uses GPU memory; too many layers hurt.', lvl: 'core' },
    { q: 'What is the main thread, and why does it matter for responsiveness?', a: '<p>One thread per page runs JS, style, layout, paint recording and most event handling. A long task (over 50 ms) delays input handling and frames. That is what INP measures. Workers can take CPU work off it, but they can’t touch the DOM.</p>', lvl: 'core' },
    { q: 'How does the browser decide what goes on its own compositing layer?', a: '<p>It’s a heuristic and differs between engines. Typical triggers: 3D transforms, <code>will-change: transform/opacity</code>, active transform/opacity animations, <code>&lt;video&gt;</code>/<code>&lt;canvas&gt;</code>, fixed-position elements, and elements that overlap another layer (implicit promotion). DevTools’ Layers panel shows the result and the reason.</p>', lvl: 'deep' },
    { q: 'How do requestAnimationFrame and the event loop interact with rendering?', a: '<p>After a task and its microtasks run, the browser <i>may</i> do a rendering update: run rAF callbacks, then style, layout, paint and composite. rAF callbacks run just before style/layout, so they are the right place for visual writes. Microtasks run before rendering, so an endless microtask chain starves rendering.</p>', lvl: 'deep' },
    { q: 'What tools would you use to find a rendering bottleneck?', a: '<ul><li>Chrome DevTools Performance panel: long tasks, purple style/layout blocks, “Forced reflow” warnings with stack traces.</li><li>Rendering tab: paint flashing, layout shift regions, layer borders.</li><li>Layers panel for promotion reasons.</li><li>Field data (INP, long animation frames API) to confirm users are affected.</li></ul>', lvl: 'core' },
    { q: 'What is CSS containment and why does it help?', a: '<p><code>contain: layout paint</code> (or <code>content</code>) promises the browser that an element’s internals don’t affect the outside, so invalidations stay inside it. <code>content-visibility: auto</code> goes further and skips rendering off-screen subtrees entirely. Both cut style/layout cost on big pages.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Measure, then mutate', lang: 'ts', code: `// read phase
const heights = cards.map(c => c.getBoundingClientRect().height);
// write phase, in the next frame
requestAnimationFrame(() => {
  cards.forEach((c, i) => { c.style.minHeight = heights[i] + 'px'; });
});`, note: 'One layout for the reads, one for the frame. Libraries like fastdom formalise this.' },
    { title: 'Smooth drawer with transform', lang: 'text', code: `.drawer {
  position: fixed; inset: 0 auto 0 0; width: 320px;
  transform: translateX(-100%);
  transition: transform 250ms ease;
}
.drawer.open { transform: translateX(0); }
@media (prefers-reduced-motion: reduce) { .drawer { transition: none; } }` },
    { title: 'Skip off-screen rendering', lang: 'text', code: `.article-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 800px;  /* placeholder height until rendered */
}` }
  ]
});
