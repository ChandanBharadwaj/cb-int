IA.register({
  track: 'frontend',
  slug: 'fe-hydration-islands',
  title: 'Hydration, islands & resumability',
  tagline: 'Server-rendered HTML looks finished but is <b>inert</b>. Hydration makes it interactive by re-running components in the browser. <b>Partial/progressive hydration</b>, <b>islands</b> (Astro) and <b>resumability</b> (Qwik) are different answers to “how much of that work can we skip?”',
  tldr: {
    problem: 'An SSR page paints in 1 s, but buttons do nothing until 4 s on a phone, because the browser is downloading and executing the whole app to hydrate text that never changes.',
    model: 'Hydration cost ≈ <b>download + parse + execute every component + attach listeners</b>, proportional to the page, not to what’s interactive. Progressive hydration splits and schedules that work; islands hydrate only interactive components; resumability serialises state and listeners into HTML so nothing re-executes on load.',
    hook: '“What does Qwik do differently from React?” React replays the component tree on the client to recover state (hydration). Qwik serialises the state and handler references into the HTML and resumes on the first interaction.',
    facts: [
      { v: '0 KB', l: 'of JS is Astro’s default for a component; only components with a <code>client:*</code> directive hydrate' },
      { v: 'React 18+', l: 'selective hydration: Suspense boundaries hydrate independently, and a boundary the user interacts with is hydrated first' },
      { v: 'O(interaction)', l: 'Qwik’s startup cost: code for a handler is fetched and run only when that event fires (usually prefetched)' }
    ]
  },
  intro: {
    what: 'With SSR, the server sends real HTML so the page shows quickly. But a click handler is JavaScript, and the browser can’t get JavaScript out of HTML. So the framework downloads the component code, runs it again in the browser to rebuild its internal model of the page, and attaches event listeners to the existing DOM. That catch-up step is <b>hydration</b>.',
    analogy: { icon: '🎭', title: 'A stage set', text: 'SSR delivers a fully built stage set: it looks real. Hydration is the whole cast walking every scene once to learn their marks before the show can start. Islands give lines only to the actors who speak. Resumability hands each actor a note with their next line and lets them wake up only when the audience addresses them.' },
    steps: [
      { t: 'Server renders HTML', d: 'Components run on the server and produce HTML. The user sees content early.' },
      { t: 'Browser downloads the JS', d: 'The same component code is fetched, parsed and compiled.' },
      { t: 'Hydrate', d: 'Components run again, the framework matches its output to the existing DOM and attaches listeners.', code: "import { hydrateRoot } from 'react-dom/client';\nhydrateRoot(document.getElementById('root')!, <App />);", lang: 'ts' },
      { t: 'Do less of it', d: '<b>Progressive</b>: hydrate in chunks, by priority. <b>Islands</b>: hydrate only interactive parts. <b>Resumability</b>: don’t re-run anything at load.' }
    ],
    terms: [
      ['hydration', 'Re-running components on the client to attach behaviour to server HTML.'],
      ['hydration mismatch', 'The client’s first render differs from the server HTML; React warns and may re-render that part on the client.'],
      ['island', 'An independently hydrated interactive component in an otherwise static page.'],
      ['partial hydration', 'Hydrating only some components, not the whole tree.'],
      ['progressive / selective hydration', 'Hydrating in pieces over time, prioritised by visibility or interaction.'],
      ['resumability', 'Continuing execution on the client from serialised server state, with no replay.']
    ]
  },
  visual: {
    title: 'Same page, four hydration strategies',
    caption: 'Pick a strategy and press Play. Grey = static HTML with no JS, amber = JS downloading or hydrating, green = interactive, faded = never needs JS.'
  },
  gotchas: [
    { trap: 'Hydration mismatch', code: `function Price() {\n  return <span>{new Intl.NumberFormat().format(9.99)}</span>; // server locale ≠ browser locale\n}`, why: 'The client’s first render must produce the same markup as the server. Locale, time zones, <code>Date.now()</code>, random ids and <code>typeof window</code> branches all differ.', fix: 'Pass such values from the server as data, use <code>useId()</code> for ids, or render client-only bits in <code>useEffect</code>. <code>suppressHydrationWarning</code> is for one-off text like timestamps only.' },
    { trap: 'Fast FCP, slow interactivity', why: 'SSR moves paint earlier but not interactivity. Users click buttons that look ready and nothing happens, or the click is lost (rage clicks).', fix: 'Measure INP and total blocking time, not just LCP. Reduce hydrated JS (islands/RSC), and make critical forms work without JS (native <code>&lt;form&gt;</code> posts).' },
    { trap: 'Wrapping the whole page in one island', code: `<App client:load />   <!-- Astro, but it's just an SPA again -->`, lang: 'text', why: 'Islands only help if most of the page is static. One giant island hydrates everything.', fix: 'Push <code>client:*</code> down to the smallest interactive leaf (a cart button, a carousel).' },
    { trap: 'Islands that need shared state', why: 'Islands are separate roots, so React context doesn’t flow between them.', fix: 'Share through a small framework-agnostic store (Astro recommends Nano Stores), URL state or custom events.' },
    { trap: 'Assuming resumability is free', why: 'Qwik’s first interaction may need to fetch a handler chunk, and serialised state adds HTML bytes. Closures over non-serialisable values must be restructured.', fix: 'Rely on its prefetching (service worker / modulepreload), keep serialised state small, and follow the <code>$</code> boundary rules.' }
  ],
  scenarios: [
    { title: 'Marketing site INP is “poor” though it’s mostly text',
      symptom: 'CrUX shows INP above 500 ms on mobile for a blog built as a full React SSR app. Lighthouse shows a 1.2 s main-thread task right after load.',
      diagnose: 'The Performance panel shows one long <code>hydrateRoot</code> task executing hundreds of article, header and footer components.',
      cause: 'Full hydration of a page where 95% of components never change.',
      fix: 'Move to an islands architecture (Astro), or React Server Components so static parts ship no JS; hydrate only search and comments.',
      fixCode: `---\nimport Search from '../components/Search.tsx';\nimport Comments from '../components/Comments.tsx';\n---\n<article set:html={post.html} />\n<Search client:idle />\n<Comments client:visible />`, lang: 'text' },
    { title: 'Buttons “randomly” do nothing on slow phones',
      symptom: 'Analytics show users tapping Add to cart 3–4 times in the first seconds after load.',
      diagnose: 'Taps happen before hydration finishes; the button is a <code>div</code> with an onClick, so before hydration there is nothing to handle the tap.',
      cause: 'Interactivity depends entirely on hydration.',
      fix: 'Use a real <code>&lt;form&gt;</code>/<code>&lt;button&gt;</code> that posts without JS (progressive enhancement), and wrap the area in a Suspense boundary so React 18+ can prioritise hydrating it when it is touched.',
      fixCode: `<form action={addToCart}>          {/* React 19 form action works pre-hydration */}\n  <input type="hidden" name="id" value={id} />\n  <button type="submit">Add to cart</button>\n</form>` }
  ],
  puzzles: [
    { kind: 'concept', q: 'What is the main cost of hydration?', options: ['Downloading HTML', 'Re-executing component code on the client to rebuild state and attach listeners', 'Server CPU', 'CSS parsing'], answer: 1, explain: 'The HTML is already there. Hydration spends client CPU running components again, plus the download and parse of their JS.' },
    { kind: 'concept', q: 'In Astro, a component used without any <code>client:</code> directive…', options: ['hydrates on load', 'renders to HTML and ships no JS', 'renders only on the client', 'is an error'], answer: 1, explain: 'Astro renders framework components to static HTML by default. You opt in per component with <code>client:load</code>, <code>client:idle</code>, <code>client:visible</code>, <code>client:media</code> or <code>client:only</code>.' },
    { kind: 'concept', q: 'Which Astro directive fits a comments widget far down the page?', options: ['client:load', 'client:only', 'client:visible', 'No directive'], answer: 2, explain: '<code>client:visible</code> hydrates when the element enters the viewport, so its JS isn’t loaded for readers who never scroll that far.' },
    { kind: 'concept', q: 'React 18+ selective hydration: the user clicks inside a Suspense boundary that hasn’t hydrated yet. What happens?', options: ['The click is lost', 'React raises that boundary’s priority, hydrates it, then replays the event', 'The page reloads', 'React hydrates everything synchronously'], answer: 1, explain: 'React prioritises the boundary the user interacted with and replays supported discrete events after it hydrates.' },
    { kind: 'concept', q: 'Why can Qwik skip hydration?', options: ['It doesn’t use SSR', 'It serialises state and listener references (pointing at lazy-loadable chunks) into the HTML', 'It uses WebAssembly', 'It caches the DOM in localStorage'], answer: 1, explain: 'Everything needed to continue is in the HTML: <code>on:click</code> attributes reference code chunks, and state is serialised. A small global loader handles events.' },
    { kind: 'concept', q: 'Which is a downside of resumability compared with islands?', options: ['More JS at load', 'Possible network fetch on first interaction, and serialisation constraints on code', 'No SSR', 'Can’t be interactive'], answer: 1, explain: 'Code is fetched lazily (usually prefetched), and closures must capture only serialisable values, which affects how you write components.' }
  ],
  interview: [
    { q: 'What is hydration and why is it needed?', a: '<p>SSR HTML has no behaviour. Hydration loads the component code, renders it on the client against the existing DOM (without recreating nodes), rebuilds the framework’s state, and attaches event listeners. It’s needed because state and closures can’t be sent as HTML in a classic framework.</p>', lvl: 'core' },
    { q: 'Explain the “uncanny valley” of SSR.', a: '<p>Between first paint and the end of hydration the page looks interactive but isn’t. Users click and nothing happens. The longer hydration takes (big bundles, slow CPUs), the wider the valley. It shows up as poor INP and rage clicks.</p>', lvl: 'core' },
    { q: 'Partial vs progressive hydration?', a: '<p><b>Partial</b>: some components never hydrate (static). <b>Progressive</b>: everything (or the hydrated set) hydrates in pieces over time, prioritised by viewport, idle time or interaction. Islands are partial hydration with independent roots; React’s selective hydration is progressive.</p>', lvl: 'core' },
    { q: 'How does the islands architecture work in Astro?', a: '<p>Pages are rendered to HTML on the server or at build. Each interactive component marked <code>client:*</code> becomes an island: Astro emits a small loader per island which imports that component’s framework runtime and code and hydrates it in place. Islands can use different frameworks (React, Vue, Svelte, Solid) on one page. Server islands (<code>server:defer</code>, Astro 5) render a slow, dynamic part on the server after the page and swap it in.</p>', lvl: 'deep' },
    { q: 'How is Qwik’s resumability different from lazy hydration?', a: '<p>Lazy hydration still re-runs components, only later. Resumability never re-runs them: the server serialises the component state, the reactive subscription graph and listener references into HTML. On an event the loader fetches the specific handler chunk (split at <code>$</code> boundaries by the optimizer) and runs it with the deserialised state. Startup cost is near constant.</p>', fu: 'Cost? Serialisation limits (no arbitrary closures), bigger HTML, and an unusual mental model.', lvl: 'deep' },
    { q: 'How do React Server Components relate to partial hydration?', a: '<p>Server Components never hydrate: they ship no JS, only their rendered output in the RSC payload. Client components (<code>\'use client\'</code>) hydrate. So RSC achieves partial hydration at the component level inside one React tree, unlike islands which are separate roots. See <a href="fe-server-components.html">Server Components</a>.</p>', lvl: 'deep' },
    { q: 'What causes hydration mismatches and how does React 19 report them?', a: '<p>Non-deterministic render output: time, random, locale, browser-only APIs, invalid HTML nesting the parser “fixes” (a <code>&lt;div&gt;</code> inside <code>&lt;p&gt;</code>), and browser extensions editing the DOM. React 19 logs a single error with a diff of the mismatch, and falls back to client rendering up to the nearest Suspense boundary.</p>', lvl: 'deep' },
    { q: 'How would you measure the cost of hydration?', a: '<p>Lab: Performance panel (long tasks after FCP), Lighthouse TBT, React Profiler. Field: INP and Long Animation Frames attribution in RUM. Compare the time between LCP and when the first interaction can be handled.</p>', lvl: 'core' },
    { q: 'When would you not bother with islands or resumability?', a: '<p>For highly interactive apps (editors, dashboards) almost everything needs JS anyway, so the savings are small and a SPA or full hydration is simpler. Islands shine for content-heavy sites with small pockets of interactivity.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Astro islands with shared state', lang: 'ts', code: `// cartStore.ts (Nano Stores: framework-agnostic)
import { atom } from 'nanostores';
export const cartCount = atom(0);

// BuyButton.tsx (React island)
import { useStore } from '@nanostores/react';
export function BuyButton() {
  const n = useStore(cartCount);
  return <button onClick={() => cartCount.set(n + 1)}>Add ({n})</button>;
}
// page.astro:  <BuyButton client:idle />   <CartBadge client:load />   (two islands, one store)` },
    { title: 'Qwik component (resumable)', lang: 'ts', code: `import { component$, useSignal } from '@builder.io/qwik';

export const Counter = component$(() => {
  const count = useSignal(0);
  // onClick$ is extracted into its own lazily-loaded chunk by the optimizer
  return <button onClick$={() => count.value++}>Clicked {count.value}</button>;
});`, note: 'The <code>$</code> suffix marks a lazy-loading boundary. Captured variables must be serialisable.' },
    { title: 'Avoiding a mismatch in React', lang: 'ts', code: `function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState(iso);               // same on server and first client render
  useEffect(() => setText(new Date(iso).toLocaleTimeString()), [iso]);
  return <time dateTime={iso}>{text}</time>;
}` }
  ]
});
