IA.register({
  track: 'frontend',
  slug: 'fe-build-tools',
  title: 'Bundlers & build tools',
  tagline: 'A bundler is a <b>compiler for a module graph</b>: it follows imports from an entry, transforms each file, drops dead exports and writes a few hashed chunks. Vite, esbuild, Rollup, Rolldown and Turbopack differ mainly in <i>when</i> they do that work and in which language.',
  tldr: {
    problem: 'Browsers can load ES modules natively, but shipping 1,500 unminified files, TypeScript and JSX to users is slow or impossible. Bundling it all on every save made dev servers slow on big apps.',
    model: 'Two modes. <b>Dev</b>: serve modules unbundled, transform on request, hot-swap the changed module (Vite). <b>Build</b>: walk the whole graph once, tree shake, split at <code>import()</code>, minify, hash file names (Rollup / Rolldown / webpack / Turbopack).',
    hook: '“Why is Vite’s dev server fast but its production output still bundled?” Native ESM avoids bundling in dev, but in production thousands of requests and waterfalls would hurt, and you want tree shaking and minification.',
    facts: [
      { v: 'ESM', l: 'tree shaking needs static <code>import</code>/<code>export</code>; CommonJS <code>require()</code> is dynamic and mostly can’t be shaken' },
      { v: 'import()', l: 'every dynamic import is a code-split point that becomes its own chunk' },
      { v: '[hash]', l: 'content-hashed file names let you cache assets for a year with <code>immutable</code>; only <code>index.html</code> must stay fresh' }
    ]
  },
  intro: {
    what: 'You write many small files that <code>import</code> each other, in TypeScript, with JSX or <code>.vue</code> files, plus npm packages. Browsers want plain JavaScript and CSS, and ideally few, small, cacheable files. A <b>build tool</b> turns the first into the second. A <b>bundler</b> is the part that combines modules into chunks.',
    analogy: { icon: '📦', title: 'Maven shade plugin, but smarter', text: 'Think of building a fat JAR: start from your main class, pull in everything it references, and package it. A JS bundler does the same at file level, then also throws away unused methods (tree shaking), splits rarely used parts into separate files to download later, and renames the output so caches never serve stale code.' },
    steps: [
      { t: 'Transform', d: 'Each file is compiled to plain JS: TypeScript types stripped, JSX turned into function calls, modern syntax optionally lowered for older browsers. esbuild, SWC and Babel do this.' },
      { t: 'Resolve and graph', d: 'Follow every <code>import</code> from the entry, including into <code>node_modules</code>. The result is a module graph.' },
      { t: 'Shake and split', d: 'Drop exports nobody uses. Cut the graph at each <code>import()</code> so routes load on demand.', code: "const Settings = () => import('./pages/Settings') // separate chunk" },
      { t: 'Emit', d: 'Minify, extract CSS, write <code>main-3f9a1c.js</code>-style names, and generate an <code>index.html</code> that points at them.' }
    ],
    terms: [
      ['ES module (ESM)', 'The standard <code>import</code>/<code>export</code> syntax. Static, so tools can analyse it.'],
      ['chunk', 'One output JS file containing one or more modules.'],
      ['tree shaking', 'Removing exports that nothing imports (dead-code elimination at module level).'],
      ['code splitting', 'Breaking the bundle into chunks loaded on demand, usually per route.'],
      ['HMR', 'Hot Module Replacement: swap a changed module in the running page without a full reload.'],
      ['source map', 'A file that maps minified output back to your original lines, for debuggers and error trackers.']
    ]
  },
  visual: {
    title: 'Dev server vs production build',
    caption: 'Pick a scenario. <b>Dev server</b> shows why Vite starts instantly, <b>Production build</b> shows chunks being produced, <b>Tree shaking</b> shows what survives. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Barrel files defeat tree shaking and slow dev', code: `// components/index.ts
export * from './Button';
export * from './DataGrid';   // 400 KB, pulls in a charting lib
// app.ts
import { Button } from './components';`, why: 'Re-export “barrels” force the tool to load and parse every re-exported module. If any of them has side effects (or the package lacks <code>"sideEffects": false</code>), it stays in the bundle. In Vite dev, each one is an extra request.', fix: 'Import from the concrete file, or mark the package side-effect free. Next.js offers <code>optimizePackageImports</code> for large libraries.' },
    { trap: 'Vite / esbuild don’t type-check', why: 'They strip types file by file, for speed. A type error builds fine and fails at runtime, or never fails at all.', fix: 'Run <code>tsc --noEmit</code> (or <code>vue-tsc --noEmit</code>) in CI and in a pre-commit hook. Treat it like <code>mvn compile</code>.' },
    { trap: '<code>"sideEffects": false</code> on a package that has side effects', code: `{ "sideEffects": false }   // but src/polyfills.ts patches globals`, why: 'The bundler trusts the flag and drops whole modules that are only imported for their effect (<code>import "./polyfills"</code>) and global CSS imports.', fix: 'List the files that do have effects: <code>"sideEffects": ["*.css", "./src/polyfills.ts"]</code>.' },
    { trap: 'Env vars baked in at build time', code: `const api = import.meta.env.VITE_API_URL;  // replaced by a string literal at build`, why: 'Frontend “env vars” are text substitution during the build. One image cannot be promoted from staging to prod, and anything you put there is public.', fix: 'For build-once-deploy-many, serve a small <code>/config.json</code> at runtime. Never put secrets in <code>VITE_*</code> or <code>NEXT_PUBLIC_*</code>.' },
    { trap: 'Caching index.html', why: 'Hashed assets can be cached forever, but if a CDN caches the HTML that references them, users load old chunk names. After the next deploy removes old files, lazy chunks 404 (“ChunkLoadError”).', fix: '<code>index.html</code>: <code>Cache-Control: no-cache</code>. Keep the previous release’s assets deployed for a while.' },
    { trap: 'Dev and prod use different pipelines', why: 'Vite (up to v7) used esbuild in dev and Rollup for builds, so ordering of CSS, CJS interop or circular imports could behave differently in production.', fix: 'Run <code>vite build && vite preview</code> and the e2e suite against the built output in CI, not just against the dev server.' }
  ],
  scenarios: [
    { title: 'Users get a blank screen right after every deploy',
      symptom: 'Sentry fills with <code>Failed to fetch dynamically imported module</code> for ~30 minutes after each release, then it stops.',
      diagnose: `curl -I https://app.example.com/            # Cache-Control: max-age=3600 (!)\ncurl -I https://app.example.com/assets/Settings-a1b2.js   # 404 after deploy`,
      cause: 'The CDN cached <code>index.html</code> for an hour. Open tabs and cached HTML reference chunk hashes from the previous build, which the deploy deleted.',
      fix: 'Serve HTML with <code>no-cache</code>, keep old assets for a release or two, and catch chunk-load failures to force one reload.',
      fixCode: `window.addEventListener('vite:preloadError', (e) => {\n  e.preventDefault();\n  if (!sessionStorage.getItem('reloaded')) { sessionStorage.setItem('reloaded', '1'); location.reload(); }\n});` },
    { title: 'Bundle grew from 300 KB to 1.4 MB with one import',
      symptom: 'LCP on mobile went from 2 s to 4 s after a small feature that formats dates.',
      diagnose: `npx vite-bundle-visualizer     # or rollup-plugin-visualizer\n# moment + all locales: 700 KB; lodash (CJS): 530 KB`,
      cause: '<code>import _ from "lodash"</code> pulls the CommonJS build, which cannot be tree-shaken, and a date library bundled every locale.',
      fix: 'Use ESM builds (<code>lodash-es</code>, per-function imports), a smaller date library, and add a size budget to CI.',
      fixCode: `import debounce from 'lodash-es/debounce';\n// CI: fail if gzipped entry > 200 KB (size-limit, bundlesize, or a custom check)` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Why does Vite’s dev server start much faster than a classic webpack dev server on a large app?', options: ['It caches the previous bundle on disk', 'It serves source files as native ES modules and transforms each one only when the browser requests it', 'It skips TypeScript files', 'It uses a CDN for node_modules'], answer: 1, explain: 'No up-front bundle. Only dependencies are pre-bundled once with esbuild; your code is transformed lazily per request.' },
    { kind: 'concept', q: 'Which import can a bundler tree-shake most reliably?', code: `// A\nconst { debounce } = require('lodash');\n// B\nimport { debounce } from 'lodash-es';\n// C\nimport _ from 'lodash';\n// D\nconst m = await import(name);`, options: ['A', 'B', 'C', 'D'], answer: 1, explain: 'A named import from an ESM package is static and analysable. CommonJS (A, and C which resolves to the CJS build) and a dynamic specifier (D) are not.' },
    { kind: 'concept', q: 'You add <code>const Admin = () =&gt; import(\'./Admin\')</code>. What changes in the build output?', options: ['Nothing; it is inlined', 'Admin and its exclusive dependencies move to a separate chunk loaded on demand', 'Admin is excluded from the build', 'A new HTML page is generated'], answer: 1, explain: 'Dynamic <code>import()</code> is a split point. Modules shared with the main chunk stay there, or go to a shared chunk.' },
    { kind: 'concept', q: 'Which statement about esbuild is correct?', options: ['It is written in Rust and type-checks TypeScript', 'It is written in Go and strips TypeScript types without type-checking', 'It is Vite’s production bundler in all versions', 'It only works with webpack'], answer: 1, explain: 'esbuild is Go, transforms TS by erasing types, and in Vite (up to v7) it handles dependency pre-bundling, TS transforms and minification, while Rollup does the production bundle.' },
    { kind: 'concept', q: 'Best caching headers for <code>/assets/index-9f3c1a.js</code> and <code>/index.html</code>?', options: ['Both max-age=3600', 'Asset: max-age=31536000, immutable. HTML: no-cache', 'Asset: no-store. HTML: immutable', 'Both no-cache'], answer: 1, explain: 'The hash changes whenever content changes, so the asset can be cached forever. The HTML is the pointer to the current hashes and must be revalidated.' },
    { kind: 'bug', q: 'After a release, global styles imported as <code>import "./theme.css"</code> from a library vanished from the bundle. Likely cause?', options: ['CSS minifier bug', 'The library’s package.json says "sideEffects": false', 'The browser blocked the CSS', 'HMR is disabled'], answer: 1, explain: 'A bare side-effect import exports nothing. With <code>"sideEffects": false</code> the bundler may drop it. Fix: <code>"sideEffects": ["*.css"]</code>.' }
  ],
  interview: [
    { q: 'What does a bundler actually do?', a: '<p>Resolves imports from one or more entries into a module graph, transforms each module (TS, JSX, SFC, CSS), removes unused exports, splits the graph into chunks at dynamic imports and shared boundaries, minifies, and emits hashed files plus a manifest or HTML that references them.</p>', lvl: 'core' },
    { q: 'Explain tree shaking and why ESM matters for it.', a: '<p>Tree shaking is dead-code elimination at export level. ESM <code>import</code>/<code>export</code> are top-level and static, so the tool knows at build time which bindings are used. CommonJS can compute exports at runtime (<code>module.exports[name] = …</code>), so tools must keep everything. Side effects block it too, hence <code>"sideEffects"</code> and <code>/*#__PURE__*/</code> annotations.</p>', fu: 'What is a /*#__PURE__*/ annotation? (A hint that a call has no side effects, so it can be dropped if its result is unused.)', lvl: 'core' },
    { q: 'Compare Vite, webpack, esbuild, Rollup and Turbopack.', a: '<ul><li><b>webpack 5</b>: JS, very configurable, huge plugin ecosystem, bundles in dev too. Introduced Module Federation.</li><li><b>esbuild</b>: Go, extremely fast transform/bundle, fewer optimisation features.</li><li><b>Rollup</b>: ESM-first, excellent tree shaking and library output; Vite’s production bundler up to v7.</li><li><b>Vite</b>: dev server on native ESM plus a production build; framework-neutral (Vue, React, Svelte…). Newer versions move to <b>Rolldown</b>, a Rust Rollup-compatible bundler, to unify dev and build.</li><li><b>Turbopack</b>: Rust, incremental, built for Next.js; stable for <code>next dev</code> since Next.js 15 and the default bundler from Next.js 16.</li></ul>', lvl: 'core' },
    { q: 'How do you decide where to split code?', a: '<p>Start with routes, since each page loads its own chunk. Then split heavy, rarely used widgets (rich text editor, charts, PDF export) behind <code>import()</code> on interaction. Avoid splitting too finely: each chunk is a request and a possible waterfall. Preload chunks you know you’ll need next (<code>&lt;link rel="modulepreload"&gt;</code>).</p>', lvl: 'deep' },
    { q: 'What is dependency pre-bundling in Vite and why is it needed?', a: '<p>Many npm packages ship CommonJS, which browsers cannot import, and some ESM packages have hundreds of internal files, which would mean hundreds of requests. Vite bundles each dependency once with esbuild into <code>node_modules/.vite/deps</code>, converts it to ESM, and caches it with a strong cache header until the lockfile or config changes.</p>', lvl: 'deep' },
    { q: 'How does HMR work?', a: '<p>The dev server watches files and keeps a module graph. When a file changes, it finds the nearest module that “accepts” hot updates (framework plugins make components accept themselves), and sends a message over a WebSocket. The client re-imports the new version with a cache-busting query and swaps it in. If no boundary accepts it, it falls back to a full reload.</p>', lvl: 'deep' },
    { q: 'Why is there still a production bundle if browsers support ESM?', a: '<p>An unbundled app means deep import waterfalls (the browser discovers <code>c.js</code> only after parsing <code>b.js</code>), many requests, no cross-module minification, and no tree shaking. HTTP/2 helps with request count but not with the waterfall depth.</p>', lvl: 'core' },
    { q: 'What goes in a CI pipeline for a frontend build?', a: '<p>Install with a lockfile (<code>npm ci</code>), lint, <code>tsc --noEmit</code>, unit and component tests, production build, a bundle size budget, e2e tests against the built output, and upload of source maps to the error tracker (not to the public CDN, if you want to keep source private).</p>', lvl: 'core' },
    { q: 'Where does SWC fit in?', a: '<p>SWC is a Rust compiler (like Babel but much faster) for TS/JSX transforms and minification. Next.js uses it for compilation, and Vite has an SWC-based React plugin. It is a transformer, not a full bundler.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'vite.config.ts with splitting and a proxy to Spring Boot', lang: 'ts', code: `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    // dev only: avoid CORS by proxying /api to the Boot app on :8080
    proxy: { '/api': 'http://localhost:8080' }
  },
  build: {
    sourcemap: 'hidden',            // generate maps, but don't reference them from the JS
    rollupOptions: {
      output: { manualChunks: { vendor: ['vue', 'vue-router'] } }
    }
  }
});`, note: 'The dev proxy means the browser sees one origin, so no CORS config is needed locally.' },
    { title: 'Serving a Vite build from Spring Boot with the right cache headers', lang: 'java', code: `@Configuration
class SpaConfig implements WebMvcConfigurer {
  @Override public void addResourceHandlers(ResourceHandlerRegistry r) {
    r.addResourceHandler("/assets/**")                 // hashed files from dist/assets
     .addResourceLocations("classpath:/static/assets/")
     .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());
    r.addResourceHandler("/index.html")
     .addResourceLocations("classpath:/static/")
     .setCacheControl(CacheControl.noCache());
  }
}`, note: 'Add a fallback that forwards unknown non-API paths to <code>index.html</code> so client-side routes survive a refresh.' }
  ]
});
