IA.register({
  track: 'nodejs',
  slug: 'npm-dependencies',
  title: 'npm & dependencies',
  tagline: 'A <b>range</b> in package.json says what you’d accept. The <b>lockfile</b> says what you actually got. Most dependency incidents, from “works on my machine” to a hijacked package stealing CI secrets, come from installing without the lockfile.',
  tldr: {
    problem: 'A typical Node service has hundreds of transitive packages, written by strangers, that can run code at install time. Without discipline, every build may install a slightly different tree.',
    model: '<b>package.json</b> holds ranges (<code>^1.4.2</code> = any 1.x from 1.4.2 up). <b>package-lock.json</b> pins every package in the tree to an exact version, URL and integrity hash. <code>npm ci</code> installs exactly the lockfile; <code>npm install</code> may re-resolve ranges and update it. <b>Peer dependencies</b> say “the host app must provide this”; <b>workspaces</b> link local packages in a monorepo.',
    hook: '“What’s the difference between <code>npm install</code> and <code>npm ci</code>?” <code>ci</code> deletes <code>node_modules</code>, installs exactly the lockfile, never writes to it, and fails if it doesn’t match package.json. Use it in CI and Docker.',
    facts: [
      { v: '^ vs ~', l: '<code>^1.4.2</code> allows <code>&lt;2.0.0</code>; <code>~1.4.2</code> allows <code>&lt;1.5.0</code>. For 0.x, <code>^0.4.2</code> stops at <code>&lt;0.5.0</code>' },
      { v: 'npm 7+', l: 'installs peer dependencies automatically and fails with <code>ERESOLVE</code> on conflicts (<code>--legacy-peer-deps</code> restores the old behaviour)' },
      { v: '10.x', l: 'the npm major bundled with Node 22. Lockfile v3 has been the default since npm 9' }
    ]
  },
  intro: {
    what: 'Node projects reuse code from the <b>npm registry</b>. You list the packages you need in <code>package.json</code>, and <code>npm install</code> downloads them, plus everything <i>they</i> need, into <code>node_modules</code>. Each package has a version like <code>1.4.2</code>, following <b>semantic versioning</b>: MAJOR.MINOR.PATCH. A <b>lockfile</b> records the exact versions installed, so everyone gets the same thing.',
    analogy: { icon: '🛒', title: 'Shopping list vs receipt', text: 'package.json is a <b>shopping list</b>: “milk, any brand, 1 litre or more”. The lockfile is the <b>receipt</b>: “Brand X, 1 L, batch 4471”. Shopping from the list gets you something acceptable, but it may differ each time. Re-buying from the receipt gets you exactly the same thing, and you’d notice if the batch number didn’t match.' },
    steps: [
      { t: 'Add a dependency', d: 'npm writes a range to package.json and exact versions to the lockfile.', code: 'npm install express          # "express": "^5.1.0" in package.json\nnpm install -D vitest        # devDependencies: build/test only', lang: 'bash' },
      { t: 'Read a version', d: '<b>MAJOR</b> breaks things, <b>MINOR</b> adds features, <b>PATCH</b> fixes bugs. <code>^</code> accepts new minors and patches; <code>~</code> only patches.' },
      { t: 'Commit the lockfile', d: '<code>package-lock.json</code> goes into Git. It is what makes installs repeatable.' },
      { t: 'Install from it in CI', d: '<code>npm ci</code> reproduces the exact tree, or fails loudly.', code: 'npm ci --omit=dev     # production image: exact tree, no devDependencies', lang: 'bash' }
    ],
    terms: [
      ['semver', 'MAJOR.MINOR.PATCH versioning; a major bump signals breaking changes.'],
      ['range', 'A version pattern such as <code>^1.4.2</code> or <code>~1.4.2</code>.'],
      ['lockfile', '<code>package-lock.json</code>: exact versions and hashes for the whole tree.'],
      ['transitive dependency', 'A dependency of your dependency.'],
      ['peer dependency', 'A package a plugin expects the host app to install, e.g. a React component library needing <code>react</code>.'],
      ['workspace', 'A local package inside a monorepo, linked instead of downloaded.']
    ]
  },
  visual: {
    title: 'Ranges, lockfiles and a bad release',
    caption: 'Click a range to see which published versions it allows; the filled dot is what a fresh <code>npm install</code> would pick. Then press <b>Play the story</b> and compare the four machines as new versions are published.'
  },
  gotchas: [
    { trap: 'Building Docker images without the lockfile', lang: 'docker', code: `COPY package.json ./\nRUN npm install          # re-resolves every range on every build\nCOPY . .`, why: 'Each build can pull newer versions, including a regression or a compromised release, that never ran in CI.', fix: '<code>COPY package.json package-lock.json ./</code> then <code>RUN npm ci --omit=dev</code>.' },
    { trap: 'Caret ranges on 0.x packages', code: `"some-sdk": "^0.4.2"   // means >=0.4.2 <0.5.0, NOT <1.0.0`, why: 'Below 1.0, semver treats the minor as the breaking part, and npm’s caret follows that. People expect 0.5 or 0.9 to come in automatically; they don’t.', fix: 'Expect manual bumps for 0.x dependencies, and read their changelogs: “0.x” means the API isn’t stable.' },
    { trap: 'Install scripts run with your credentials', code: `// package.json of some transitive dependency\n"scripts": { "postinstall": "node collect.js" }   // runs on npm install`, why: '<code>preinstall</code>/<code>install</code>/<code>postinstall</code> scripts of every package in the tree run by default, on developer laptops and on CI runners that hold tokens.', fix: 'Use <code>npm ci --ignore-scripts</code> in CI (run <code>npm rebuild &lt;pkg&gt;</code> for the few that need native builds), keep CI tokens narrowly scoped, and review new dependencies before adding them.' },
    { trap: 'Phantom dependencies via hoisting', code: `// package.json lists "express" only\nimport qs from 'qs';   // works: express depends on qs, hoisted to the root\n// breaks when express drops qs or a different version gets hoisted`, why: 'npm hoists transitive packages into the root <code>node_modules</code>, so code can import packages it never declared.', fix: 'Declare everything you import. pnpm’s strict layout or the <code>import/no-extraneous-dependencies</code> lint rule catch this.' },
    { trap: 'Forcing peer dependencies with --legacy-peer-deps', lang: 'bash', code: `npm ERR! ERESOLVE unable to resolve dependency tree\nnpm ERR! peer react@"^18" from ui-kit@3.2.0   # app has react 19\nnpm install --legacy-peer-deps                 # "fixed"`, why: 'The flag only stops npm from checking. The plugin may really break with the other major at runtime.', fix: 'Upgrade the plugin to a version whose peer range includes yours, or align the host version. Use <code>overrides</code> only after testing.' },
    { trap: 'Expecting a library’s lockfile to protect its users', why: 'npm uses only the <b>root</b> project’s lockfile. When your library is installed as a dependency, its <code>package-lock.json</code> is ignored, and its ranges are resolved against the app’s tree.', fix: 'Libraries: use sensible ranges and test against the latest versions in range. Apps: commit the lockfile. (<code>npm-shrinkwrap.json</code> is published and honoured, but is rarely appropriate for libraries.)' }
  ],
  scenarios: [
    { title: 'Production breaks on a Tuesday with no deploy of ours',
      symptom: 'An autoscaling event starts new pods, and only the new pods throw <code>TypeError: format is not a function</code>.',
      diagnoseLang: 'bash',
      diagnose: `# compare the tree inside an old and a new image\ndocker run --rm app:old npm ls date-utils\ndocker run --rm app:new npm ls date-utils   # 1.4.2 vs 1.5.0`,
      cause: 'The image is built at deploy time with <code>npm install</code> and no lockfile, so a minor release that came out that morning (with a breaking change) went in.',
      fix: 'Build images once in CI with <code>npm ci</code> from the committed lockfile, and promote the same image. Never resolve dependencies at deploy time.',
      fixCode: `FROM node:22-slim AS deps\nWORKDIR /app\nCOPY package.json package-lock.json ./\nRUN npm ci --omit=dev --ignore-scripts\n\nFROM node:22-slim\nWORKDIR /app\nCOPY --from=deps /app/node_modules ./node_modules\nCOPY . .\nUSER node\nCMD ["node", "server.js"]`, lang: 'docker' },
    { title: 'A dependency update steals CI secrets',
      symptom: 'Security reports unusual npm publishes from the company’s CI token, a few hours after a routine dependency-update PR was merged.',
      diagnose: `npm ls --all | grep -i suspicious-pkg\nnpm view suspicious-pkg@2.3.1 scripts        # "postinstall": "node setup.js"\ngit log -p package-lock.json                  # when did it enter the tree?`,
      cause: 'A transitive package was taken over and a new patch release added a <code>postinstall</code> script that read environment variables (including <code>NPM_TOKEN</code>) and sent them out. This class of attack is public and recurring (for example the event-stream incident in 2018 and ua-parser-js in 2021).',
      fix: 'Revoke and rotate the tokens first. Then: <code>npm ci --ignore-scripts</code> in CI, short-lived and narrowly scoped tokens (or trusted publishing with provenance), a cooling-off period before adopting brand-new releases, and <code>npm audit signatures</code> in the pipeline.',
      fixCode: `# .npmrc (project)\nignore-scripts=true\nsave-exact=false\n\n# CI\nnpm ci\nnpm audit signatures            # verify registry signatures / provenance\nnpm audit --omit=dev --audit-level=high`, lang: 'bash' },
    { title: 'Two copies of a library in a monorepo',
      symptom: 'In a workspaces monorepo, <code>packages/api</code> registers a plugin with a shared registry, but <code>packages/worker</code> never sees it.',
      diagnoseLang: 'bash',
      diagnose: `npm ls @acme/registry --all\n# ├─┬ @acme/api → @acme/registry@2.1.0\n# └─┬ @acme/worker → @acme/registry@1.9.0 (nested copy)`,
      cause: 'The two workspaces declare incompatible ranges, so npm installs a second, nested copy. Each copy has its own module-level singleton.',
      fix: 'Align the ranges across workspaces (or make the shared one a peer dependency of the plugins), and check for duplicates in CI with <code>npm ls</code>/<code>npm dedupe</code>.',
      fixCode: `// root package.json\n{\n  "workspaces": ["packages/*"],\n  "overrides": { "@acme/registry": "2.1.0" }   // one version everywhere\n}`, lang: 'json' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which version does <code>"^1.4.2"</code> allow?', options: ['1.4.1', '1.9.0', '2.0.0', '1.5.0-rc.1'], answer: 1, explain: 'Caret on 1.x means <code>&gt;=1.4.2 &lt;2.0.0</code>, so 1.9.0 is allowed. 1.4.1 is too low, 2.0.0 is a new major, and prereleases match only if the range itself names a prerelease of the same version.' },
    { kind: 'concept', q: 'Which version does <code>"^0.4.2"</code> allow?', options: ['0.5.0', '0.4.9', '1.0.0', '0.4.1'], answer: 1, explain: 'Below 1.0, the caret locks the minor: <code>&gt;=0.4.2 &lt;0.5.0</code>. (And <code>^0.0.3</code> allows only 0.0.3.)' },
    { kind: 'concept', q: 'package.json says <code>"tiny-date": "^1.5.0"</code>, but the committed lockfile still pins 1.4.2. What does <code>npm ci</code> do?', options: ['Installs 1.4.2 from the lockfile', 'Installs the newest 1.x and updates the lockfile', 'Fails: package.json and the lockfile are out of sync', 'Installs 1.5.0 and leaves the lockfile alone'], answer: 2, explain: '<code>npm ci</code> never modifies the lockfile. If the lockfile can’t satisfy package.json, it exits with an error. Run <code>npm install</code> locally to update the lockfile, and commit it.' },
    { kind: 'concept', q: 'Your app uses react 19. You add <code>ui-kit</code>, which declares <code>"peerDependencies": { "react": "^18" }</code>. What happens with npm 10?', options: ['npm installs react 18 next to 19', 'Install fails with ERESOLVE', 'A warning, then it installs', 'npm silently downgrades your react'], answer: 1, explain: 'Since npm 7, peer dependencies are part of the tree and conflicts are errors. <code>--legacy-peer-deps</code> skips the check (npm 6 behaviour) but doesn’t make the plugin compatible.' },
    { kind: 'concept', q: 'You publish a library with a committed <code>package-lock.json</code>. An app installs your library. Which versions of your dependencies does the app get?', options: ['Exactly those in your lockfile', 'Whatever the app’s own lockfile/resolution picks within your ranges', 'The latest versions, ignoring ranges', 'Your lockfile versions, unless the app runs npm update'], answer: 1, explain: 'Only the root project’s lockfile is used. Your lockfile isn’t even included in the published package by default. Your <code>dependencies</code> ranges are what count.' },
    { kind: 'concept', q: 'A deep transitive dependency has a vulnerability, and the fix is in a patch release the parent package doesn’t allow yet. What’s the npm-native way to force it?', options: ['Edit node_modules by hand', '"overrides" in the root package.json (npm 8.3+)', 'npm install --force', 'Add it to devDependencies'], answer: 1, explain: '<code>"overrides": { "vuln-pkg": "1.2.4" }</code> replaces that package everywhere in the tree (it can also be scoped to one parent). It is like Maven’s <code>dependencyManagement</code>. Test it: you are overriding a choice another maintainer made.' },
    { kind: 'concept', q: 'In an npm workspaces monorepo, how does <code>packages/api</code> load <code>@acme/shared</code> from <code>packages/shared</code>?', options: ['From the registry, like any package', 'Through a symlink: node_modules/@acme/shared → packages/shared', 'npm copies the folder on every build', 'Only via relative imports like ../shared'], answer: 1, explain: '<code>npm install</code> at the root links each workspace into the root <code>node_modules</code>, so normal package resolution finds the local source. Changes show up without publishing.' }
  ],
  interview: [
    { q: 'What do ^ and ~ mean in a version range?', a: '<p><code>^1.4.2</code>: compatible with 1.4.2, i.e. <code>&gt;=1.4.2 &lt;2.0.0</code>. <code>~1.4.2</code>: <code>&gt;=1.4.2 &lt;1.5.0</code>. For 0.x the caret is stricter: <code>^0.4.2</code> = <code>&lt;0.5.0</code>. Prereleases (<code>1.5.0-rc.1</code>) are excluded unless the range itself mentions a prerelease of the same version. npm saves caret ranges by default.</p>', lvl: 'core' },
    { q: 'Why commit package-lock.json, and what’s in it?', a: '<p>It pins the <b>whole tree</b>, not just direct dependencies: for each package, the exact version, the tarball URL and an <b>integrity</b> hash (SHA-512). Everyone and every build gets byte-identical packages, and a tampered tarball fails the hash check. It also makes installs faster.</p>', lvl: 'core' },
    { q: 'npm install vs npm ci?', a: '<ul><li><b>npm install</b>: resolves ranges, uses the lockfile where it still satisfies package.json, can update the lockfile, and keeps the existing node_modules.</li><li><b>npm ci</b>: requires a lockfile, deletes node_modules, installs exactly what is locked, never writes the lockfile, and fails if it doesn’t match package.json.</li></ul><p>Use <code>ci</code> in CI and Dockerfiles.</p>', lvl: 'core' },
    { q: 'dependencies, devDependencies, peerDependencies, optionalDependencies?', a: '<p><b>dependencies</b>: needed at runtime. <b>devDependencies</b>: build and test only, skipped with <code>--omit=dev</code> and not installed for consumers of a library. <b>peerDependencies</b>: “the host must provide this, in this range”, for plugins (eslint plugins, React components) so there is one shared copy. <b>optionalDependencies</b>: install failures are tolerated (platform-specific binaries).</p>', lvl: 'core' },
    { q: 'How do you reduce npm supply-chain risk?', a: '<ul><li>Commit the lockfile and install with <code>npm ci</code>.</li><li>Disable install scripts in CI (<code>--ignore-scripts</code>) and allow-list the few that need them. pnpm 10+ doesn’t run dependencies’ install scripts unless you allow them.</li><li>Keep tokens short-lived and scoped; prefer trusted publishing with provenance.</li><li>Verify with <code>npm audit signatures</code>; scan with <code>npm audit</code> or a commercial scanner.</li><li>Review new dependencies (maintainers, install scripts, size) and delay adopting brand-new releases.</li></ul>', lvl: 'deep' },
    { q: 'How does npm lay out node_modules, and what problems does that cause?', a: '<p>npm hoists packages to the top of <code>node_modules</code> when it can, and nests a different version under the package that needs it when versions conflict. Problems: <b>phantom dependencies</b> (importing something you never declared), <b>duplicates</b> (two copies of a stateful library), and a layout that depends on install order. pnpm uses a content-addressed store with symlinks and a strict layout, which avoids phantoms.</p>', lvl: 'deep' },
    { q: 'What are workspaces, and when do you use them?', a: '<p>A monorepo feature (npm 7+): the root <code>package.json</code> lists <code>"workspaces": ["packages/*"]</code>; one install links the local packages together and shares one lockfile. Run scripts in one or all workspaces with <code>npm run test -w @acme/api</code> or <code>--workspaces</code>. Use them for shared libraries and services that change together.</p>', lvl: 'core' },
    { q: 'How does this compare with Maven or Gradle?', a: '<p>Maven usually uses exact versions, puts <b>one version per artifact</b> on the classpath and resolves conflicts with “nearest wins”. npm can install <b>several versions</b> of the same package side by side. <code>overrides</code> ≈ <code>dependencyManagement</code>/BOMs. Gradle has optional lockfiles; npm has one by default. The Java ecosystem has no install scripts in jars, which removes a whole class of supply-chain attacks.</p>', lvl: 'core' },
    { q: 'A vulnerability is reported in a transitive dependency. Walk through your response.', a: '<ol><li><code>npm ls vuln-pkg --all</code>: who pulls it in, and which versions?</li><li>Is it reachable and exploitable in your usage? (Many advisories aren’t.)</li><li>Prefer upgrading the direct parent to a version that allows the fix.</li><li>Otherwise add an <code>overrides</code> entry, run the tests, and leave a comment with a removal date.</li><li>Rebuild images with <code>npm ci</code> and redeploy.</li></ol>', lvl: 'deep' }
  ],
  code: [
    { title: 'package.json for a service', lang: 'json', code: `{
  "name": "@acme/orders-api",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.12 <23" },
  "scripts": {
    "start": "node dist/server.js",
    "test": "node --test",
    "audit:ci": "npm audit signatures && npm audit --omit=dev --audit-level=high"
  },
  "dependencies": {
    "fastify": "^5.2.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "typescript": "~5.7.2"
  },
  "overrides": {
    "cross-spawn": "^7.0.6"
  }
}`, note: '<code>"private": true</code> stops an accidental <code>npm publish</code>. <code>engines</code> documents the Node version; add <code>engine-strict=true</code> in .npmrc to enforce it.' },
    { title: 'Monorepo with workspaces', lang: 'bash', code: `# layout
#   package.json            { "workspaces": ["packages/*"] }
#   packages/shared/        name: @acme/shared
#   packages/api/           depends on "@acme/shared": "*"

npm install                          # links packages/* into node_modules/@acme/*
npm run build -w @acme/shared        # one workspace
npm test --workspaces --if-present   # all of them
npm ls @acme/shared                  # → packages/shared (symlink)`, note: 'One root lockfile for the whole repo. CI runs <code>npm ci</code> once at the root.' },
    { title: 'Java comparison: Maven dependencyManagement', lang: 'text', code: `<!-- pom.xml: one version per artifact on the classpath; nearest wins -->
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>com.fasterxml.jackson</groupId>
      <artifactId>jackson-bom</artifactId>
      <version>2.18.2</version>
      <type>pom</type>
      <scope>import</scope>          <!-- ≈ a shared set of npm "overrides" -->
    </dependency>
  </dependencies>
</dependencyManagement>

<!-- mvn dependency:tree  ≈  npm ls --all -->`, note: 'npm may keep several versions of one package; Maven picks one and you find conflicts at runtime (NoSuchMethodError).' }
  ]
});
