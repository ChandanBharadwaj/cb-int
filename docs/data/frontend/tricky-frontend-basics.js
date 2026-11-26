IA.register({
  track: 'frontend',
  slug: 'tricky-frontend-basics',
  title: 'Basics drill (timed)',
  tagline: 'Thirty first-interview frontend questions from the four Basics topics, against the clock: how the browser renders, the critical rendering path, modern CSS, and CSR/SSR/SSG/ISR.',
  tldr: {
    problem: 'Frontend interviews almost always start with fundamentals: what happens between the HTML arriving and pixels on screen, what <code>defer</code> does, flex vs grid, and when to render on the server.',
    model: 'Most basics questions are one of four ideas: <b>the pipeline</b> (DOM + CSSOM → layout → paint → composite), <b>what blocks</b> (classic scripts block parsing, CSS blocks rendering), <b>which layout tool</b> (flex for one axis, grid for two; specificity and layers decide conflicts), and <b>where HTML is made</b> (browser, per request, at build, or rebuilt in the background).',
    hook: 'Why is animating <code>transform</code> smooth but animating <code>width</code> janky? If you can answer, start the drill.',
    facts: [
      { v: '30', l: 'questions, 7–8 from each of the 4 Basics topics' },
      { v: '60 s', l: 'per question by default. Slow (90 s) and Fast (30 s) modes too' },
      { v: 'Evergreen', l: 'browsers are the baseline (container queries, :has() and @layer are widely supported)' }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a question, a timer and four answers. Answer in your head, as you would in an interview, then read the explanation. At the end you see your score per topic and a review of every miss, each with a link back to the topic page.',
    analogy: { icon: '⏱️', title: 'Flashcards with a stopwatch', text: 'Reading that <code>defer</code> keeps script order is easy. Picking it over <code>async</code> in five seconds takes practice.' },
    steps: [
      { t: 'Place it in the pipeline', d: 'Does the change affect geometry (layout), only pixels (paint), or only layers (composite)?' },
      { t: 'Ask “what is blocking?”', d: 'A classic script pauses the parser; CSS delays the first paint; <code>defer</code>, <code>async</code> and <code>preload</code> change that.' },
      { t: 'One axis or two?', d: 'Flex for a row or column, grid for rows and columns. Container queries for component size, media queries for viewport size.' },
      { t: 'When is the HTML made?', d: 'CSR in the browser, SSR per request, SSG at build, ISR at build and then in the background.' }
    ],
    terms: [
      ['DOM / CSSOM', 'The trees the browser builds from HTML and CSS.'],
      ['reflow', 'Another name for layout: recalculating sizes and positions.'],
      ['render-blocking', 'A resource the browser waits for before it shows anything.'],
      ['hydration', 'Client JavaScript making server-rendered HTML interactive.']
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a topic (or All), how many questions, and the time per question, then press Start. Skip counts as a miss. At the end, your misses are listed with explanations and links to the topic pages.'
  },
  gotchas: [
    { trap: 'Mixing up async and defer', why: 'Both download in parallel. Only <code>defer</code> waits for parsing and keeps order.', fix: 'App code: <code>defer</code>. Independent third-party scripts: <code>async</code>.' },
    { trap: 'Thinking order always wins in CSS', why: 'Order only breaks ties. Specificity (and cascade layers, and <code>!important</code>) come first.', fix: 'Compare layer, then specificity, then order.' },
    { trap: 'Saying “SSR is always faster”', why: 'SSR shows content sooner but costs server time per request and still needs hydration before the page is interactive.', fix: 'Pick per route: static content SSG/ISR, per-user pages SSR or CSR.' }
  ],
  interview: [
    { q: 'What happens after the browser receives HTML?', a: '<p>It parses HTML into the DOM and CSS into the CSSOM, combines them into the render tree, runs layout, paints, and composites layers on the GPU. Scripts can pause parsing; CSS delays the first paint.</p>', lvl: 'core' },
    { q: 'async vs defer?', a: '<p>Both download without blocking the parser. <code>defer</code> runs after parsing in document order; <code>async</code> runs as soon as it arrives, in any order.</p>', lvl: 'core' },
    { q: 'Flexbox or grid?', a: '<p>Flexbox for one-dimensional layouts sized by content; grid for two-dimensional layouts where you define rows and columns first. They combine well.</p>', lvl: 'core' },
    { q: 'CSR, SSR, SSG or ISR for a product page?', a: '<p>Usually SSG or ISR: same content for everyone, good SEO, served from a CDN, refreshed when prices or stock change. SSR if it is personalised per user.</p>', lvl: 'core' }
  ]
});
