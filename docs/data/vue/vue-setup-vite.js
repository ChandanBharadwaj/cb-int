IA.register({
  track: 'vue',
  slug: 'vue-setup-vite',
  title: 'Setup with Vite',
  tagline: '<code>npm create vue@latest</code> scaffolds a <b>Vite</b> project. In dev, Vite serves your source as native ES modules and compiles each <code>.vue</code> file on request, with hot updates on save. <code>npm run build</code> bundles everything into static files in <code>dist/</code>.',
  tldr: {
    problem: 'Browsers don’t understand <code>.vue</code> files or TypeScript, and shipping hundreds of unbundled modules to production is slow. You need a compiler, a dev server and a production bundler.',
    model: 'Vite is two tools in one: a <b>dev server</b> that transforms files on demand (no bundling, so startup is fast) and a <b>production build</b> that bundles, tree-shakes, minifies and hashes. <code>@vitejs/plugin-vue</code> compiles SFCs in both.',
    hook: '“Why is Vite’s dev server fast?” It skips bundling: the browser requests modules, Vite compiles just those, and dependencies are pre-bundled once with esbuild.',
    facts: [
      { v: '5173', l: 'Vite’s default dev-server port' },
      { v: 'create-vue', l: 'the official scaffolding tool behind <code>npm create vue@latest</code> (replaced Vue CLI)' },
      { v: 'dist/', l: 'default output folder of <code>vite build</code>: static HTML, JS and CSS' }
    ]
  },
  intro: {
    what: 'Like Maven or Gradle for Java, a frontend project needs a build tool. <b>Node.js</b> runs the tooling, <b>npm</b> installs packages (like Maven Central), and <b>Vite</b> compiles and serves your code. You write <code>.vue</code> and <code>.ts</code> files; Vite turns them into plain JavaScript the browser runs.',
    analogy: { icon: '🍳', title: 'Kitchen vs catering', text: 'In dev, Vite is a short-order cook: each dish (module) is made the moment it’s ordered. For production it is a catering company: everything is prepared, packed and labelled in advance, so serving is fast.' },
    steps: [
      { t: 'Install Node', d: 'Use a current LTS (e.g. Node 22). Check with <code>node -v</code>.', code: 'node -v   # v22.x', lang: 'bash' },
      { t: 'Scaffold', d: 'Answer the prompts: TypeScript yes; Router and Pinia if you need them; Vitest for tests; ESLint + Prettier.', code: 'npm create vue@latest my-app\ncd my-app\nnpm install', lang: 'bash' },
      { t: 'Run the dev server', d: 'Open the printed URL. Edit <code>src/App.vue</code>, save, and the page updates without a reload (HMR).', code: 'npm run dev', lang: 'bash' },
      { t: 'Build for production', d: 'Type check plus bundle. Output in <code>dist/</code>; <code>npm run preview</code> serves it locally.', code: 'npm run build\nnpm run preview', lang: 'bash' }
    ],
    terms: [
      ['npm / package.json', 'Package manager and its manifest (deps + scripts). Like <code>pom.xml</code>.'],
      ['node_modules', 'Installed dependencies. Never commit it; <code>package-lock.json</code> pins versions.'],
      ['ES module', 'Native JS <code>import</code>/<code>export</code>. Browsers load them directly.'],
      ['HMR', 'Hot Module Replacement: swap changed modules in the running page, keeping state where possible.'],
      ['bundle', 'Production JS files combining many modules, minified and tree-shaken.'],
      ['vue-tsc', 'TypeScript checker that understands <code>.vue</code> files. Vite itself only strips types.']
    ]
  },
  visual: {
    title: 'From scaffold to dev server to dist/',
    caption: 'Choose <b>Dev server</b> or <b>Production build</b>, then Play or Step. Highlighted files on the left are the ones involved in each step.'
  },
  gotchas: [
    { trap: 'Assuming Vite type-checks your code', why: 'Vite (esbuild) only <b>strips</b> TypeScript types for speed. A type error still runs in dev.', fix: 'Run <code>vue-tsc --noEmit</code> (the scaffold’s <code>type-check</code> script) in CI and use the editor extension (Vue - Official).' },
    { trap: 'Env vars not showing up in the browser', code: "// .env\nAPI_URL=/api        // undefined in code\nVITE_API_URL=/api   // import.meta.env.VITE_API_URL", why: 'Vite only exposes variables prefixed with <code>VITE_</code> to client code, to avoid leaking secrets. And they are baked in at <b>build time</b>.', fix: 'Prefix with <code>VITE_</code>; never put secrets there (everything shipped to the browser is public). For per-environment runtime config, fetch a <code>/config.json</code> at startup.' },
    { trap: '404 on refresh of /orders/42 in production', why: 'With history-mode routing the URL is handled by JS. The server looks for a file <code>/orders/42</code> and finds none.', fix: 'Configure a fallback to <code>index.html</code> for unknown non-asset paths (Nginx <code>try_files $uri /index.html</code>, or a Spring controller forwarding to <code>/index.html</code>).' },
    { trap: 'CORS errors calling the Spring API in dev', why: 'The app runs on <code>:5173</code>, the API on <code>:8080</code>: different origins.', fix: 'Use Vite’s dev proxy so the browser calls the same origin.', code: "// vite.config.ts\nserver: { proxy: { '/api': 'http://localhost:8080' } }" },
    { trap: 'Deploying under a sub-path breaks asset URLs', why: 'Built HTML references <code>/assets/…</code> from the root. Under <code>/admin/</code> those 404.', fix: 'Set <code>base: \'/admin/\'</code> in <code>vite.config.ts</code> and the router’s <code>createWebHistory(import.meta.env.BASE_URL)</code>.' }
  ],
  scenarios: [
    { title: 'Users see a blank page after every deploy until they hard-refresh',
      symptom: 'Console shows <code>Failed to fetch dynamically imported module /assets/Orders-3f2a.js</code>.',
      diagnose: 'curl -I https://app.example.com/index.html | grep -i cache-control\n# cache-control: max-age=86400',
      cause: '<code>index.html</code> was cached for a day and still points at old hashed chunks, which the deploy deleted.',
      fix: 'Cache hashed assets forever, but never cache <code>index.html</code> (or revalidate it). Keep the previous release’s assets for a while.',
      fixCode: "# nginx\nlocation = /index.html { add_header Cache-Control \"no-cache\"; }\nlocation /assets/     { add_header Cache-Control \"public, max-age=31536000, immutable\"; }",
      lang: 'text' },
    { title: 'API key leaked in the JS bundle',
      symptom: 'A security scan finds a third-party API key in <code>assets/index-*.js</code>.',
      diagnose: 'grep -o "VITE_[A-Z_]*" src -r   # VITE_MAPS_SECRET used in client code',
      cause: 'A secret was put in a <code>VITE_</code> variable. Vite inlines those values into the bundle at build time, by design.',
      fix: 'Rotate the key. Call the third party from the backend (Spring) and expose only your own endpoint. Keep only public values in <code>VITE_*</code>.',
      fixCode: "// client\nconst res = await fetch('/api/maps/geocode?q=' + encodeURIComponent(q))\n// server holds the secret", lang: 'ts' }
  ],
  puzzles: [
    { kind: 'concept', q: 'In dev, what does Vite do when the browser requests <code>/src/App.vue</code>?', options: ['Serves the raw .vue file', 'Compiles that one SFC to JavaScript on demand and returns it as an ES module', 'Rebuilds the whole bundle first', 'Redirects to dist/'], answer: 1, explain: 'Vite transforms files on request. That is why startup does not grow with app size the way bundle-first dev servers do.' },
    { kind: 'concept', q: 'Which file is the actual entry point that Vite starts from?', options: ['src/App.vue', 'vite.config.ts', 'index.html', 'package.json'], answer: 2, explain: 'Vite treats <code>index.html</code> as the entry. Its <code>&lt;script type="module" src="/src/main.ts"&gt;</code> pulls in the rest.' },
    { kind: 'concept', q: '<code>.env</code> has <code>SECRET=x</code> and <code>VITE_TITLE=Shop</code>. In client code, what is <code>import.meta.env.SECRET</code>?', options: ['"x"', 'undefined', 'A build error', '"Shop"'], answer: 1, explain: 'Only <code>VITE_</code>-prefixed variables are exposed to client code. <code>import.meta.env.VITE_TITLE</code> is <code>"Shop"</code>.' },
    { kind: 'concept', q: 'A TypeScript type error exists in a component. What happens on <code>npm run dev</code>?', options: ['Dev server refuses to start', 'Page runs; Vite only strips types. The error shows in the editor and in vue-tsc', 'Vite auto-fixes it', 'Only that component is blank'], answer: 1, explain: 'Type checking is separate (<code>vue-tsc</code>). The scaffold’s <code>build</code> script runs it, so the build fails, but dev does not.' },
    { kind: 'concept', q: 'What does <code>main.ts</code> typically contain?', code: "import { createApp } from 'vue'\nimport { createPinia } from 'pinia'\nimport App from './App.vue'\nimport router from './router'", options: ["createApp(App).use(createPinia()).use(router).mount('#app')", "new Vue({ router }).$mount('#app')", "App.render(document.body)", "router.start(App)"], answer: 0, explain: 'Vue 3 uses <code>createApp</code>, plugins via <code>.use()</code>, then <code>.mount()</code>. <code>new Vue</code> is Vue 2.' },
    { kind: 'concept', q: 'Why do built files have names like <code>index-a1b2c3.js</code>?', options: ['Obfuscation', 'Content hashes: a new build gets new names, so they can be cached forever safely', 'Random to avoid collisions between users', 'Required by ES modules'], answer: 1, explain: 'The hash changes only when content changes, enabling <code>immutable</code> caching. Just don’t cache <code>index.html</code> itself.' }
  ],
  interview: [
    { q: 'Why did the Vue ecosystem move from Vue CLI (webpack) to Vite?', a: '<p>Dev speed. Webpack bundles the whole app before serving; Vite serves native ES modules and compiles on demand, pre-bundling dependencies with esbuild. Cold start and HMR stay fast as the app grows. Vue CLI is in maintenance mode.</p>', lvl: 'core' },
    { q: 'Walk through a create-vue project layout.', a: '<ul><li><code>index.html</code>: entry, contains <code>#app</code>.</li><li><code>src/main.ts</code>: <code>createApp</code>, plugins, mount.</li><li><code>src/App.vue</code>: root component.</li><li><code>src/components/</code>, <code>src/views/</code>, <code>src/router/</code>, <code>src/stores/</code>.</li><li><code>public/</code>: copied as-is (favicon).</li><li><code>vite.config.ts</code>, <code>tsconfig*.json</code>, <code>package.json</code>.</li></ul>', lvl: 'core' },
    { q: 'What is the difference between <code>public/</code> and <code>src/assets/</code>?', a: '<p><code>src/assets</code> files are imported and processed: hashed names, inlined if small, removed if unused. <code>public/</code> files are copied unchanged to the root of <code>dist/</code> and referenced by absolute path; use it for things that need a fixed name (robots.txt, favicon).</p>', lvl: 'core' },
    { q: 'How does HMR keep component state?', a: '<p>The Vue plugin injects code that registers each component with the HMR runtime. When a file changes, Vite sends an update over WebSocket; if only the template changed, Vue re-renders instances with the new render function and keeps their state. Script changes typically re-create the instances, so local state resets.</p>', lvl: 'deep' },
    { q: 'How do you serve a Vue build from Spring Boot?', a: '<p>Build to <code>dist/</code>, copy it into <code>src/main/resources/static</code> (e.g. with the frontend-maven-plugin or a CI step), and add a fallback so unknown non-API routes forward to <code>/index.html</code> for history-mode routing. Or keep them separate behind a reverse proxy/CDN.</p>', fu: 'Same origin or separate? Same origin avoids CORS and cookie headaches; separate gives independent deploys and CDN caching.', lvl: 'deep' },
    { q: 'What does <code>vue-tsc</code> do that <code>tsc</code> can’t?', a: '<p>It type-checks <code>.vue</code> files, including template expressions against your props and refs. Plain <code>tsc</code> doesn’t understand the SFC format.</p>', lvl: 'core' },
    { q: 'Are Vite env variables runtime or build-time?', a: '<p>Build-time: <code>import.meta.env.VITE_*</code> is replaced statically during build. To change config without rebuilding, load it at runtime (a JSON file or an endpoint) before mounting.</p>', lvl: 'deep' },
    { q: 'What is dependency pre-bundling?', a: '<p>On first dev start, Vite uses esbuild to convert dependencies in <code>node_modules</code> (often CommonJS or many small files) into a few ESM files cached in <code>node_modules/.vite</code>. That cuts hundreds of requests and makes CJS packages importable.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'vite.config.ts with API proxy', lang: 'ts', code: "import { fileURLToPath, URL } from 'node:url'\nimport { defineConfig } from 'vite'\nimport vue from '@vitejs/plugin-vue'\n\nexport default defineConfig({\n  plugins: [vue()],\n  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },\n  server: {\n    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }\n  }\n})" },
    { title: 'Spring Boot SPA fallback', lang: 'java', code: "@Controller\nclass SpaController {\n  // forward any path without a dot (not a file) and not /api to index.html\n  @GetMapping(\"/{path:^(?!api$)[^\\\\.]*}/**\")\n  String forward() { return \"forward:/index.html\"; }\n}", note: 'Keep API routes under <code>/api</code> so they never hit the fallback. Test the pattern against your Spring version’s path matcher.' },
    { title: 'Typed env variables', lang: 'ts', code: "// src/env.d.ts\ninterface ImportMetaEnv {\n  readonly VITE_API_BASE: string\n}\ninterface ImportMeta { readonly env: ImportMetaEnv }\n\n// usage\nconst base = import.meta.env.VITE_API_BASE" }
  ]
});
