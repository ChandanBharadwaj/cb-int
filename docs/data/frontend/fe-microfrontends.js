IA.register({
  track: 'frontend',
  slug: 'fe-microfrontends',
  title: 'Micro-frontends',
  tagline: 'Micro-frontends are <b>microservices for the UI</b>: several teams build and deploy parts of one web app independently. They solve an <i>organisational</i> problem and cost you performance, consistency and complexity. Know how they compose, and when to say no.',
  tldr: {
    problem: 'One large frontend owned by eight teams means a shared release train, merge conflicts and a build nobody understands. Teams want to ship their slice on their own schedule.',
    model: 'Split by <b>business domain</b> (search, checkout, account), not by technical layer. A <b>shell</b> owns routing, auth and layout and composes the slices at build time, on the server or edge, or at runtime in the browser (Module Federation, import maps, iframes).',
    hook: '“When would you not use micro-frontends?” With one or two teams, when slices share most state, or when bundle size and consistency matter more than deploy independence. A modular monolith with clear package boundaries is usually enough.',
    facts: [
      { v: 'webpack 5', l: 'introduced Module Federation (2020); Rspack and a Vite plugin implement it too' },
      { v: 'singleton', l: 'shared frameworks like React must load once, or hooks and context break' },
      { v: 'Conway', l: 'the split should mirror team boundaries; that is the reason to do it at all' }
    ]
  },
  intro: {
    what: 'Normally one frontend app is built and deployed as a unit. With <b>micro-frontends</b>, the page is assembled from pieces owned by different teams, each with its own repo, pipeline and release schedule. A <b>shell</b> (or host) app glues them together.',
    analogy: { icon: '🏬', title: 'A shopping mall', text: 'The mall owns the building, the corridors and the security guards (shell: routing, layout, login). Each shop fits out and changes its own space whenever it likes (team slices). But if every shop picks its own floor height and fire exits, visitors get lost. You need shared rules.' },
    steps: [
      { t: 'Split by domain', d: 'Each team owns a vertical slice end to end, for example “checkout” = UI + BFF + service. Like bounded contexts in DDD.' },
      { t: 'Choose a composition point', d: 'Build time (npm packages), server/edge (HTML fragments), or runtime in the browser (Module Federation, import maps). Iframes for hard isolation.' },
      { t: 'Agree on contracts', d: 'URLs/routes, a few shared singletons (framework, design system), and how slices talk: URL, custom DOM events, or a tiny shared event bus. Not a shared global store.' },
      { t: 'Protect the user', d: 'Budget bundle size, keep one design system, and fall back gracefully when a remote fails to load.' }
    ],
    terms: [
      ['shell / host', 'The app that owns the page frame and loads the slices.'],
      ['remote', 'An independently deployed bundle that exposes modules to the host.'],
      ['Module Federation', 'A bundler feature that lets separately built apps load each other’s modules at runtime and share dependencies.'],
      ['import map', 'A <code>&lt;script type="importmap"&gt;</code> that maps bare specifiers like <code>"react"</code> to URLs, natively in the browser.'],
      ['vertical slice', 'A feature owned top to bottom by one team.']
    ]
  },
  visual: {
    title: 'How the pieces come together',
    caption: 'Pick a scenario: the Module Federation runtime handshake, the four composition options, or the classic “two copies of React” failure. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Duplicate framework copies', code: `// remote webpack/rspack config, missing the shared block\nnew ModuleFederationPlugin({ name: 'checkout', exposes: { './Page': './src/Page' } })`, why: 'Without <code>shared</code>, the remote bundles its own React. Users download it twice, and hooks and context fail across the boundary.', fix: '<code>shared: { react: { singleton: true, requiredVersion: \'^18.3.0\' }, \'react-dom\': { singleton: true, requiredVersion: \'^18.3.0\' } }</code> on host and every remote.' },
    { trap: 'A shared global store couples everything again', why: 'If all slices read and write one Redux/Pinia store, every change to its shape needs coordinated releases. You have a distributed monolith.', fix: 'Each slice owns its state. Communicate through the URL, small typed custom events, or backend APIs.' },
    { trap: 'CSS leaking between teams', why: 'Global class names like <code>.btn</code> from one team restyle another team’s page.', fix: 'CSS Modules, a per-team prefix, cascade layers, or Shadow DOM (see <a href="fe-web-components.html">Web Components</a>). One design system for shared tokens.' },
    { trap: 'Remote down = blank shell', why: 'A runtime remote is a network dependency like a downstream service. If its <code>remoteEntry.js</code> 404s, the dynamic import rejects.', fix: 'Wrap each remote in an error boundary with a fallback, add timeouts, and monitor remote load failures like any service SLO.' },
    { trap: 'Runtime version drift', why: 'With runtime composition nobody tests the exact combination of versions users get. A remote can ship code that needs a newer shared library than the host provides.', fix: 'Contract tests on the exposed module, compatible <code>requiredVersion</code> ranges, and a staging environment that loads the latest of every remote.' }
  ],
  scenarios: [
    { title: '“Invalid hook call” only in production',
      symptom: 'The account page crashes after the account team’s release. Locally, where they run the remote standalone, it works.',
      diagnose: `// in the browser console on the shell page\n[...document.scripts].map(s => s.src).filter(s => /react/.test(s))\n// or check window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.size  → 2`,
      cause: 'The remote upgraded React and removed it from the shared config, so two Reacts loaded. Standalone there was only one, so local testing never caught it.',
      fix: 'Restore <code>singleton</code> sharing with a version range, and add a CI job that runs e2e tests of the shell with the remote’s release candidate.',
      fixCode: `shared: {\n  react: { singleton: true, requiredVersion: '^18.3.0' },\n  'react-dom': { singleton: true, requiredVersion: '^18.3.0' }\n}` },
    { title: 'Home page JS grew 3× after the micro-frontend migration',
      symptom: 'INP and LCP got worse on mobile after splitting the monolith into five remotes.',
      diagnose: `# compare bundles of each remote\nnpx source-map-explorer dist/**/*.js\n# found: 3 date libraries, 2 icon sets, 2 copies of the design system`,
      cause: 'Each team picked its own utility libraries and bundled the design system privately. Sharing was configured only for React.',
      fix: 'Share the design system as a singleton, publish an approved-libraries list, and set a per-remote size budget enforced in CI.' }
  ],
  puzzles: [
    { kind: 'concept', q: 'What is the main reason to adopt micro-frontends?', options: ['Smaller bundles', 'Faster page loads', 'Independent deployment and ownership for multiple teams', 'Better SEO'], answer: 2, explain: 'It is an organisational scaling technique. It usually makes bundles and performance <i>worse</i> unless managed carefully.' },
    { kind: 'concept', q: 'Two remotes and the host each bundle their own React. What breaks first?', options: ['CSS', 'Hooks and context across the boundary (“Invalid hook call”)', 'Routing', 'Nothing, just bigger bundles'], answer: 1, explain: 'Hooks rely on a module-level dispatcher in the React copy that is rendering. Components from another copy can’t see it or its contexts.' },
    { kind: 'concept', q: 'Which composition gives the strongest isolation (JS, CSS, crashes)?', options: ['Module Federation', 'npm packages', 'iframes', 'Import maps'], answer: 2, explain: 'An iframe is a separate document and JS realm. The price is routing, sizing, focus, accessibility and performance pain.' },
    { kind: 'concept', q: 'Teams publish their slices as npm packages and the shell pins versions. What do you lose?', options: ['Type safety', 'Independent deploys: every change needs a shell rebuild and release', 'Tree shaking', 'Code splitting'], answer: 1, explain: 'Build-time composition is simple and fast at runtime, but releases are coupled again.' },
    { kind: 'concept', q: 'How should the cart slice tell the header slice that the item count changed?', options: ['Both import a shared global store', 'The header polls localStorage', 'A small, documented custom DOM event (or the backend), e.g. <code>cart:updated</code>', 'Direct function calls into the header’s internals'], answer: 2, explain: 'Loose, explicit contracts keep slices independently deployable. A shared store couples their release schedules.' },
    { kind: 'concept', q: 'Which browser-native feature can map <code>import "react"</code> to a CDN URL without a bundler?', options: ['Service worker', 'Import maps', 'Shadow DOM', 'Preload'], answer: 1, explain: '<code>&lt;script type="importmap"&gt;{"imports":{"react":"https://…"}}&lt;/script&gt;</code>. Supported in all current major browsers.' }
  ],
  interview: [
    { q: 'What are micro-frontends and why would you use them?', a: '<p>An architecture where a web UI is split into slices owned and deployed independently by different teams, composed into one experience. Use them when many teams on one frontend are blocked by a shared release process. The benefits are organisational: autonomy, independent deploys, smaller codebases per team.</p>', lvl: 'core' },
    { q: 'When should you avoid them?', a: '<ul><li>One or two teams: the overhead outweighs the gain.</li><li>Slices that share lots of state or UI.</li><li>Strict performance budgets on low-end mobile.</li><li>No platform team to own the shell, design system and tooling.</li></ul><p>Start with a modular monolith (workspace packages with enforced boundaries); extract later if needed.</p>', lvl: 'core' },
    { q: 'Explain how Module Federation works at runtime.', a: '<p>Each build is a <b>container</b>. Remotes expose modules through a small entry file. The host loads that entry at runtime, initialises a <b>share scope</b> where every container registers shared dependencies with versions, then calls <code>get(\'./Module\')</code> which loads the needed chunks. Shared modules are negotiated: the highest compatible version wins, singletons are forced to one copy, and incompatibilities produce warnings or errors depending on config.</p>', fu: 'What is Module Federation 2.0? (A runtime and manifest layer, @module-federation/enhanced, that works across webpack, Rspack and others and adds type hints and devtools.)', lvl: 'deep' },
    { q: 'How do you compare build-time, server-side and runtime composition?', a: '<p><b>Build time</b>: simplest, best performance, coupled releases. <b>Server/edge</b> (SSI/ESI/fragment services): good first paint and SEO, but client-side interactivity still needs coordination. <b>Runtime</b> (Module Federation, import maps, single-spa): independent deploys, shared deps, but version drift and runtime failures. <b>Iframes</b>: isolation for untrusted or legacy apps.</p>', lvl: 'core' },
    { q: 'How do slices communicate?', a: '<p>Prefer the URL (route and query params) as the shared state. For events, use small typed custom DOM events or a minimal pub/sub with a documented schema. For data, each slice calls its own BFF. Avoid sharing a global store or importing each other’s internals.</p>', lvl: 'core' },
    { q: 'How do you keep a consistent look and feel?', a: '<p>A versioned design system with tokens (CSS custom properties) and components, shared as a singleton so it loads once. Visual regression tests in each team’s pipeline. A platform team owns the shell and the design system.</p>', lvl: 'core' },
    { q: 'How do you handle authentication across slices?', a: '<p>The shell owns login. Prefer an HttpOnly session cookie set by a BFF on the same site, so every slice’s API calls are authenticated without passing tokens around in JS. If tokens are unavoidable, the shell exposes a <code>getToken()</code> function in a shared module, not a global variable.</p>', lvl: 'deep' },
    { q: 'How do you test a runtime-composed app?', a: '<p>Each team tests its slice standalone (unit, component, e2e). Add <b>contract tests</b> for exposed modules (props, events), and an integration environment where the shell loads the release candidate of every remote with smoke e2e tests. Monitor remote load failures in production.</p>', lvl: 'deep' },
    { q: 'How do micro-frontends relate to backend microservices?', a: '<p>Same motivation (team autonomy), same risks (distributed failures, versioning, duplication). Often a team owns a vertical slice: micro-frontend + BFF + services. As with microservices, splitting along the wrong boundaries is worse than not splitting.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Host config (Rspack/webpack Module Federation)', lang: 'ts', code: `// rspack.config.ts (shell)
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';

export default {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: { checkout: 'checkout@https://checkout.cdn.example.com/remoteEntry.js' },
      shared: {
        react: { singleton: true, requiredVersion: '^18.3.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.3.0' },
        '@acme/design-system': { singleton: true }
      }
    })
  ]
};

// usage, with a fallback if the remote is down
const Checkout = React.lazy(() => import('checkout/Page'));
<ErrorBoundary fallback={<CheckoutUnavailable />}>
  <Suspense fallback={<Spinner />}><Checkout /></Suspense>
</ErrorBoundary>`, note: 'Load the remote URL from runtime config to point environments at different remote versions.' },
    { title: 'Cross-slice events with a typed contract', lang: 'ts', code: `// @acme/contracts (tiny shared package, types only)
export type CartUpdated = CustomEvent<{ count: number }>;
export const CART_UPDATED = 'cart:updated';

// cart slice
window.dispatchEvent(new CustomEvent(CART_UPDATED, { detail: { count: 3 } }));

// header slice
window.addEventListener(CART_UPDATED, (e) => setCount((e as CartUpdated).detail.count));` }
  ]
});
