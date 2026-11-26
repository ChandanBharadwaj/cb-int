IA.register({
  track: 'frontend',
  slug: 'fe-modern-css',
  title: 'Modern CSS',
  tagline: 'CSS in 2024+ is a real layout and component language: <b>flexbox</b> for one axis, <b>grid</b> for two, <b>container queries</b> for components that adapt to their slot, <b>:has()</b> for parent selection, and <b>cascade layers</b> to end specificity wars.',
  tldr: {
    problem: 'Brittle layouts built from floats and magic numbers, components that only look right at one viewport width, and <code>!important</code> chains because a third-party stylesheet keeps winning.',
    model: 'Flex lays items along <b>one axis</b> and lets content size them; grid defines <b>rows and columns</b> first and places items into them. Container queries ask “how wide is my <i>container</i>?”, not the viewport. <code>@layer</code> makes <b>layer order</b> beat specificity.',
    hook: '“Flex or grid?” Content-out, one dimension (a toolbar): flex. Layout-in, two dimensions (a page, a card grid): grid. They nest happily.',
    facts: [
      { v: 'Baseline', l: 'container size queries (2023), <code>:has()</code> (Dec 2023, Firefox 121) and cascade layers (2022) work in all major current browsers' },
      { v: 'layer > specificity', l: 'for normal rules a later layer wins regardless of selector specificity; unlayered styles beat all layers' },
      { v: '!important flips', l: 'the layer order: an important declaration in an earlier layer beats one in a later layer' }
    ]
  },
  intro: {
    what: 'CSS decides how HTML looks: colours, spacing and, most importantly, <b>layout</b> (where boxes go). Modern CSS has dedicated layout systems (flexbox and grid), ways for components to react to the space they’re given (container queries), and tools to keep large stylesheets predictable (cascade layers, <code>:has()</code>, nesting).',
    analogy: { icon: '🧱', title: 'Shelves vs a pegboard', text: 'Flexbox is a shelf: you put items on it and they line up, wrapping when full. Grid is a pegboard: you draw the slots first, then hang items in them. A container query is a picture frame that changes layout depending on the size of the wall section it hangs on, not the size of the room.' },
    steps: [
      { t: 'The cascade', d: 'When rules conflict the browser picks a winner by origin and importance, then <b>layer</b>, then <b>specificity</b> (id > class > element), then source order.' },
      { t: 'Flexbox: one axis', d: 'Items line up in a row or column; <code>gap</code>, <code>flex: 1</code> and <code>justify-content</code> control spacing and growth.', code: '.toolbar { display: flex; gap: 8px; align-items: center; }\n.toolbar .spacer { flex: 1; }', lang: 'text' },
      { t: 'Grid: two axes', d: 'Define tracks, then place items. <code>repeat(auto-fill, minmax(200px, 1fr))</code> makes a responsive card grid without media queries.', code: '.cards { display: grid; gap: 16px;\n  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }', lang: 'text' },
      { t: 'Container queries', d: 'Mark a wrapper as a container; children then style themselves by its size.' },
      { t: ':has() and @layer', d: '<code>:has()</code> selects an element by what it contains. <code>@layer</code> groups rules into ordered priority bands.' }
    ],
    terms: [
      ['specificity', 'A score from a selector: ids, then classes/attributes/pseudo-classes, then elements.'],
      ['main / cross axis', 'Flexbox’s direction of flow, and the perpendicular one.'],
      ['track / fr', 'A grid row or column; <code>fr</code> is a share of the leftover space.'],
      ['container query', '<code>@container</code> rules that test the size (or style) of an ancestor container.'],
      ['cascade layer', 'A named <code>@layer</code> whose order decides priority before specificity.'],
      ['subgrid', 'A nested grid that reuses its parent’s tracks so items align across cards.']
    ]
  },
  visual: {
    title: 'Three mechanisms, step by step',
    caption: 'Pick <b>@layer</b> to see which rule wins, <b>container query</b> to watch a card change with its slot (not the viewport), or <b>:has()</b> to see a parent styled by its child. Then press Play.'
  },
  gotchas: [
    { trap: 'Unlayered CSS beats your layers', code: `@layer components { .btn { color: white; } }\n.btn { color: black; }   /* unlayered: wins, though it looks "earlier" in priority */`, lang: 'text', why: 'For normal declarations, styles outside any layer have higher priority than every layer.', fix: 'Put everything you own into layers, including resets and third-party CSS: <code>@import url(lib.css) layer(vendor);</code>' },
    { trap: 'Container query without a container', code: `@container (min-width: 400px) { .card { … } }   /* never matches */`, lang: 'text', why: 'A container query looks for the nearest ancestor with <code>container-type</code>. If there is none, it doesn’t match.', fix: 'Add <code>container-type: inline-size</code> on the wrapper. Note it applies size containment on that axis, so the wrapper can’t be sized by its content in that direction.' },
    { trap: 'Flex items refuse to shrink', code: `.row { display: flex; }\n.row .title { flex: 1; }          /* long URL overflows anyway */\n.row .title { flex: 1; min-width: 0; }   /* fix */`, lang: 'text', why: 'Flex items default to <code>min-width: auto</code>, which is their content’s minimum size. Long words or nested <code>pre</code> push the row wider than its container.', fix: 'Set <code>min-width: 0</code> (or <code>overflow: hidden</code>) on the flexible item.' },
    { trap: 'Using <code>100vh</code> on mobile', why: 'On mobile browsers <code>vh</code> is based on the largest viewport (toolbar hidden), so a 100vh hero is cut off when the toolbar is visible.', fix: 'Use <code>100dvh</code> (dynamic) or <code>100svh</code> (small viewport) units.' },
    { trap: 'Expensive <code>:has()</code> selectors', code: `body:has(.error) { … }   /* re-checked on many DOM changes */`, lang: 'text', why: '<code>:has()</code> is well optimised, but broad anchors like <code>body:has(...)</code> or <code>*:has()</code> make style invalidation wider on every mutation.', fix: 'Anchor <code>:has()</code> to a specific, nearby element (<code>.field:has(input:invalid)</code>).' },
    { trap: 'Grid items in cards don’t line up', why: 'Each card is its own grid, so titles of different lengths push buttons to different heights.', fix: 'Use <code>grid-template-rows: subgrid</code> so cards share the parent grid’s rows (Baseline since 2023).' }
  ],
  scenarios: [
    { title: 'Design-system buttons turn the wrong colour on one product page',
      symptom: 'After adding a marketing widget, every primary button on the page turns grey. Removing the widget fixes it.',
      diagnose: 'DevTools’ Styles pane shows <code>.widget-root button.btn</code> from the widget’s CSS beating <code>.btn-primary</code> on specificity.',
      cause: 'An unscoped third-party stylesheet with higher-specificity selectors.',
      fix: 'Put vendor CSS in a low-priority layer, so specificity inside it no longer matters against your components.',
      fixCode: `@layer reset, vendor, base, components, utilities;\n@import url("widget.css") layer(vendor);`, lang: 'text' },
    { title: 'Product card looks broken only in the sidebar',
      symptom: 'The card uses media queries; at 1440px wide it shows the horizontal layout, which is squashed in the 280px sidebar.',
      cause: 'Media queries respond to the viewport, but the component lives in slots of different widths.',
      fix: 'Switch the card to container queries; the layout follows the slot.',
      fixCode: `.card-slot { container-type: inline-size; }\n@container (min-width: 420px) {\n  .card { display: grid; grid-template-columns: 160px 1fr; }\n}`, lang: 'text' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Which colour does the button get?', code: `@layer base, components;\n@layer components { .btn { color: blue; } }\n@layer base { #buy.btn { color: gray; } }`, lang: 'text', options: ['gray: higher specificity', 'blue: components is a later layer', 'Whichever appears last in the file', 'Browser default'], answer: 1, explain: 'Layer order is compared before specificity. <code>components</code> is declared after <code>base</code>, so its rule wins.' },
    { kind: 'predict', q: 'Now add an unlayered rule. Which colour?', code: `@layer base, components;\n@layer components { .btn { color: blue; } }\n.btn { color: green; }`, lang: 'text', options: ['blue', 'green', 'gray', 'Depends on specificity'], answer: 1, explain: 'Unlayered normal declarations beat all layered ones.' },
    { kind: 'predict', q: 'And with !important in both layers?', code: `@layer base, components;\n@layer base { .btn { color: gray !important; } }\n@layer components { .btn { color: blue !important; } }`, lang: 'text', options: ['blue', 'gray', 'green', 'Error'], answer: 1, explain: 'For <code>!important</code> the layer order reverses: earlier layers win. This lets a reset layer protect critical rules.' },
    { kind: 'concept', q: 'What does <code>.card:has(> img)</code> select?', options: ['Images inside cards', 'Cards that have a direct child img', 'Cards next to an img', 'Nothing; :has() can’t take combinators'], answer: 1, explain: '<code>:has()</code> takes a relative selector. <code>&gt; img</code> means a direct child; it selects the card, not the image.' },
    { kind: 'concept', q: 'Best fit for a horizontal toolbar with a logo, a flexible search box and three icons?', options: ['Grid with fixed columns', 'Flexbox with the search box set to flex: 1', 'Floats', 'Absolute positioning'], answer: 1, explain: 'One axis, content-sized items, one item growing: textbook flexbox.' },
    { kind: 'concept', q: 'What does <code>repeat(auto-fill, minmax(200px, 1fr))</code> do?', options: ['Exactly 200px columns', 'As many columns of at least 200px as fit, sharing leftover space', 'One column per item', 'A 200px gap'], answer: 1, explain: 'It creates as many ≥ 200px tracks as fit, then stretches them equally. <code>auto-fit</code> collapses empty tracks so items stretch further.' }
  ],
  interview: [
    { q: 'How does the cascade decide which declaration wins?', a: '<p>In order: origin and importance (user agent, user, author; <code>!important</code> reverses the origin order), then context (shadow DOM), then <b>cascade layers</b>, then <b>specificity</b>, then source order. Inline styles sit above author selectors.</p>', lvl: 'core' },
    { q: 'Flexbox vs grid?', a: '<p>Flex is one-dimensional and content-out: items size themselves, the container distributes space along one axis. Grid is two-dimensional and layout-in: you define tracks, then place items, so rows and columns align. Use grid for page and card layouts, flex for components inside them.</p>', lvl: 'core' },
    { q: 'What problem do container queries solve that media queries can’t?', a: '<p>Media queries respond to the viewport. A reusable component appears in slots of different widths on the same viewport. Container queries let it respond to its container’s size. They need <code>container-type: inline-size</code> (or <code>size</code>) on an ancestor, and they also add <code>cqw</code>/<code>cqi</code> units.</p>', fu: 'Style queries? <code>@container style(--theme: dark)</code> tests custom properties; support is still uneven, so check before relying on it.', lvl: 'core' },
    { q: 'Why was a parent selector considered impossible for years, and what changed?', a: '<p>Browsers match selectors right-to-left and invalidate styles when the DOM changes. A parent selector means a change deep in the tree can restyle ancestors, which was feared to be too slow. Engines found efficient invalidation strategies, and <code>:has()</code> shipped in Safari 15.4, Chrome 105 and Firefox 121.</p>', lvl: 'deep' },
    { q: 'What are cascade layers for?', a: '<p>They make priority explicit. You declare an order (<code>@layer reset, vendor, components, utilities;</code>) and later layers win regardless of specificity. That stops specificity wars, lets utilities override components without <code>!important</code>, and contains third-party CSS via <code>@import … layer(vendor)</code>.</p>', lvl: 'core' },
    { q: 'How would you build a responsive card grid without media queries?', a: '<p><code>grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr))</code>. The <code>min()</code> stops overflow on very narrow screens. Add container queries inside the card for its internal layout.</p>', lvl: 'core' },
    { q: 'What is subgrid?', a: '<p>A nested grid that uses its parent’s track definitions in one or both axes (<code>grid-template-rows: subgrid</code>). Typical use: cards in a row whose titles, bodies and buttons line up across cards. Baseline across major browsers since 2023.</p>', lvl: 'deep' },
    { q: 'Native CSS nesting: anything to watch?', a: '<p>Nesting is supported in all current major browsers. <code>&amp;</code> refers to the parent selector. Nested selectors get specificity as if wrapped in <code>:is()</code>, which takes the highest specificity in the list, so it can differ from Sass output.</p>', lvl: 'deep' },
    { q: 'Logical properties, why?', a: '<p><code>margin-inline-start</code>, <code>padding-block</code>, <code>inset-inline</code> follow the writing direction, so a layout flips correctly for right-to-left languages without overrides.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Layered stylesheet skeleton', lang: 'text', code: `@layer reset, vendor, base, components, utilities;

@import url("normalize.css") layer(reset);
@import url("datepicker.css") layer(vendor);

@layer components {
  .btn { padding: .5rem 1rem; background: var(--brand); }
  .btn:has(> svg) { display: inline-flex; gap: .5rem; }
}
@layer utilities {
  .mt-0 { margin-top: 0; }        /* beats .btn without !important */
}` },
    { title: 'A card that adapts to its slot', lang: 'text', code: `.card-slot { container: card / inline-size; }

.card { display: grid; gap: 12px; }
@container card (min-width: 420px) {
  .card { grid-template-columns: 160px 1fr; }
}
.form:has(input:user-invalid) .submit { opacity: .5; pointer-events: none; }` , note: '<code>:user-invalid</code> only matches after the user has interacted, avoiding red fields on page load.' }
  ]
});
