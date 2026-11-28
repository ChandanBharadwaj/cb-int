(function () {
  // Page-weight model: n micro-frontends on one page, each with its own code, sharing (or not) one framework runtime.
  function mf(v) {
    const n = Math.round(v.mfes), k = Math.min(n + 1, Math.round(v.copies));
    const shared = v.runtime + n * v.own;
    const dup = k * v.runtime + n * v.own;
    return { n, k, shared, dup, extra: dup - shared };
  }
  const kb = (x) => Math.round(x).toLocaleString('en-US') + ' kB';

  SD.register({
    slug: 'micro-frontends',
    domain: 4,
    title: 'Micro-Frontends',
    examples: 'Module Federation, IKEA, Spotify, Zalando',
    tagline: 'Split one large web frontend into parts that <b>separate teams build, test and deploy on their own</b>, then compose them into one page: at build time, in the browser, on the server or edge, or with iframes. You buy team autonomy and pay in <b>page weight, consistency and operations</b>.',
    tldr: {
      problem: 'The backend is split into services, but every team still commits to <b>one frontend codebase</b> with one release train. A change to the cart waits for the checkout team\'s broken test, a framework upgrade is a company-wide project, and nobody owns the whole bundle.',
      idea: 'Cut the frontend <b>vertically by business area</b> (catalog, cart, checkout). Each team owns its slice end to end, ships its own bundle, and a thin <b>app shell</b> composes the slices behind one URL. Share only a <b>design system</b> and a few pinned libraries; talk through <b>URLs and events</b>, not shared state.',
      insight: 'Micro-frontends solve an <b>organisational</b> problem, not a technical one. The composition technique matters less than three rules: <b>independent deploys</b>, <b>no shared runtime state</b>, and <b>one framework version at a time</b> unless you are migrating. With two or three teams, a modular monolith frontend is cheaper.',
      numbers: [
        { v: '2016 → 2019', l: 'Thoughtworks Radar: Assess (Nov 2016), Trial (May 2018), Adopt (Nov 2019)' },
        { v: '5 ways', l: 'to compose: build-time packages, run-time JS, server/edge includes, iframes, web components' },
        { v: '1 copy', l: 'of the framework per page is the target; each extra copy is tens of kB of JS (rule of thumb)' }
      ]
    },

    intro: {
      what: 'A <b>micro-frontend</b> is a part of a web application that one team builds and deploys on its own, the way a microservice is on the backend. The user still sees <b>one website</b>: a small program called the <b>app shell</b> loads the parts and places them on the page. The parts are stitched together at build time, in the browser, or on the server.',
      analogy: {
        icon: '🏬',
        title: 'A shopping mall with independent shops',
        text: 'A mall gives every shop the same corridors, signs, opening hours and electricity. Each shop decorates, stocks and renovates its own space without closing the mall. The mall owner is the app shell; the shared rules are the design system. The analogy breaks in one place: shops in a mall do not slow each other down, but every micro-frontend adds JavaScript to the <b>same page</b> and the same main thread.'
      },
      problem: 'Forty developers in six teams work on one single-page app. One team\'s flaky test blocks everybody\'s release. Upgrading the framework means touching every screen at once, so it is postponed for two years. A bug in the product page takes the checkout down, because it is all one bundle. The question this page answers is <b>how do several teams ship one frontend without waiting for each other?</b>',
      story: [
        {
          stage: 'naive',
          title: 'One frontend, many teams',
          text: 'All teams commit to one repository and one build. A single pipeline produces one bundle, released together. It is simple, consistent and fast for a small group.',
          scene: {
            nodes: [
              { id: 'a', label: 'Catalog team', sub: 'commits', kind: 'team', at: [70, 0] },
              { id: 'b', label: 'Cart team', sub: 'commits', kind: 'team', at: [210, 0] },
              { id: 'c', label: 'Checkout team', sub: 'commits', kind: 'team', at: [350, 0] },
              { id: 'app', label: 'One SPA', sub: 'one build, one deploy', kind: 'service', at: [210, 110] },
              { id: 'u', label: 'Browser', sub: 'one bundle', kind: 'client', at: [210, 220] }
            ],
            edges: [{ from: 'a', to: 'app' }, { from: 'b', to: 'app' }, { from: 'c', to: 'app' }, { from: 'app', to: 'u' }],
            flow: [['a>app', 'b>app', 'c>app'], 'app>u'],
            badges: { app: ['release train', 'info'] }
          }
        },
        {
          stage: 'breaks',
          title: 'Everyone waits for everyone',
          text: 'With more teams the single pipeline becomes a queue. One red test stops all releases, the bundle grows without an owner, and a framework upgrade needs every team at once. Teams are independent on the backend and <b>coupled again in the browser</b>.',
          scene: {
            nodes: [
              { id: 'a', label: 'Catalog team', sub: 'ready to ship', kind: 'team', at: [70, 0] },
              { id: 'b', label: 'Cart team', sub: 'ready to ship', kind: 'team', at: [210, 0] },
              { id: 'c', label: 'Checkout team', sub: 'test is red', kind: 'team', at: [350, 0] },
              { id: 'app', label: 'One SPA', sub: 'release blocked', kind: 'service', at: [210, 110] },
              { id: 'u', label: 'Browser', sub: 'old version', kind: 'client', at: [210, 220] }
            ],
            edges: [{ from: 'a', to: 'app' }, { from: 'b', to: 'app' }, { from: 'c', to: 'app' }, { from: 'app', to: 'u', dashed: true }],
            flow: [['a>app', 'b>app', 'c>app']],
            err: ['app', 'c'], warn: ['a', 'b'],
            badges: { app: ['blocked', 'err'], a: ['waiting', 'warn'] }
          }
        },
        {
          stage: 'fix',
          title: 'A shell composes independently shipped parts',
          text: 'Each team ships its own bundle. A thin <b>app shell</b> owns routing and layout and loads the parts at run time. The checkout team can be red without blocking the cart. A shared <b>design system</b> keeps the parts looking like one product.',
          scene: {
            nodes: [
              { id: 'a', label: 'Catalog MFE', sub: 'own deploy', kind: 'service', at: [70, 0] },
              { id: 'b', label: 'Cart MFE', sub: 'own deploy', kind: 'service', at: [210, 0] },
              { id: 'c', label: 'Checkout MFE', sub: 'own deploy', kind: 'service', at: [350, 0] },
              { id: 'app', label: 'App shell', sub: 'routes + layout', kind: 'edge', at: [210, 110] },
              { id: 'u', label: 'Browser', sub: 'one website', kind: 'client', at: [210, 220] }
            ],
            edges: [{ from: 'a', to: 'app' }, { from: 'b', to: 'app' }, { from: 'c', to: 'app' }, { from: 'app', to: 'u' }],
            flow: ['b>app', 'app>u'],
            ok: ['a', 'b', 'app'], warn: ['c'],
            badges: { b: ['shipped alone', 'ok'], c: ['still red', 'warn'] }
          }
        }
      ],
      usedBy: ['IKEA (edge-side includes)', 'Zalando (Mosaic, then Interface Framework)', 'Spotify (earlier desktop client)', 'webpack Module Federation', 'single-spa', 'Thoughtworks Technology Radar'],
      whenToUse: [
        '<b>Many teams</b> (roughly five or more) share one frontend and block each other\'s releases',
        'The product splits cleanly into <b>business areas with few shared screens</b>',
        'You must <b>migrate a legacy frontend piece by piece</b> while it stays in production'
      ],
      whenNot: [
        'One to three teams: a <b>modular monolith frontend</b> in one repository is simpler and lighter',
        'The teams are split by layer, not by business area: fix the organisation first (see <a href="conways-law.html">Conway\'s Law</a>)',
        'Every screen needs data from every area: you would only move the coupling into the browser (see <a href="ms-service-boundaries.html">service boundaries</a>)'
      ],
      glossary: [
        { term: 'Micro-frontend (MFE)', def: 'An independently built and deployed part of a web UI, owned by one team.' },
        { term: 'App shell (host)', def: 'The thin application that owns the URL, the page layout and the loading of micro-frontends.' },
        { term: 'Remote', def: 'A micro-frontend bundle the shell loads at run time from another deployment.' },
        { term: 'Module Federation', def: 'A bundler feature that lets separately built bundles load code from each other at run time and share libraries.' },
        { term: 'Shared singleton', def: 'A library, such as the UI framework, that must exist only once on the page and is negotiated between the bundles.' },
        { term: 'Server-side or edge composition', def: 'Assembling HTML fragments from several teams on a server or CDN before the page reaches the browser.' },
        { term: 'Design system', def: 'A versioned library of UI components and style tokens that keeps separately built parts looking the same.' },
        { term: 'Backend for frontend (BFF)', def: 'A small API owned by a frontend team that shapes backend data for that one frontend.' }
      ]
    },

    requirements: {
      functional: [
        '<b>Vertical slices</b>: split by business area, one team owns UI, BFF and data for its slice',
        '<b>Independent deploys</b>: a team releases without rebuilding or redeploying the shell or other slices',
        '<b>Thin shell</b>: routing, layout, authentication session and loading only; no business logic',
        '<b>No shared runtime state</b>: communicate through the URL, custom events and backend APIs',
        '<b>One design system</b>: versioned components and tokens, owned as a product',
        '<b>Isolation</b>: prefixed CSS and events, an error boundary and a fallback around every slice'
      ],
      nonFunctional: [
        'Lead time: a one-line UI fix reaches production in under 1 hour without another team (<em>example target</em>)',
        'Performance budget per route, e.g. JS ≤ 200 kB gzipped and LCP ≤ 2.5 s at p75, checked in CI',
        'One copy of the framework runtime per page outside planned migrations',
        'A failed slice degrades its own area only; the rest of the page stays usable',
        'Design-system adoption: at most two major versions live at once',
        'Rollback of one slice in under 5 minutes by repointing to the previous bundle'
      ],
      outOfScope: [
        '<b>Micro-frontend anarchy</b>: mixing several frameworks on one page with no migration plan',
        '<b>Shared global store</b>: one Redux-style store all slices read and write',
        '<b>Horizontal split</b>: a "header team" and a "forms team" instead of business areas',
        '<b>Fat shell</b>: business rules and data fetching creeping into the host',
        '<b>Nano-frontends</b>: a deployable per button, each with its own pipeline'
      ]
    },

    calculator: {
      inputs: [
        { id: 'mfes', label: 'Micro-frontends on one page', min: 1, max: 12, value: 4 },
        { id: 'runtime', label: 'Framework runtime (gzipped)', min: 10, max: 150, value: 45, unit: 'kB' },
        { id: 'own', label: 'Own code per micro-frontend (gzipped)', min: 5, max: 200, value: 40, unit: 'kB' },
        { id: 'copies', label: 'Framework copies on the page (1 = shared)', min: 1, max: 6, value: 3 },
        { id: 'mbps', label: 'Connection speed', min: 0.4, max: 50, value: 1.6, step: 0.1, unit: 'Mbps', log: true },
        { id: 'teams', label: 'Teams', min: 2, max: 40, value: 8 }
      ],
      outputs: [
        { label: 'JS on the page with one shared framework copy', fmt: 'raw', f: (v) => kb(mf(v).shared) },
        { label: 'JS on the page with the copies you chose', fmt: 'raw', f: (v) => kb(mf(v).dup) },
        { label: 'Extra download from duplicated runtimes', fmt: 'raw', f: (v) => { const x = mf(v); return kb(x.extra) + ' · ' + (x.extra * 8 / (v.mbps * 1000)).toFixed(1) + ' s'; } },
        { label: 'Extra requests before first render (entry + chunk per slice)', fmt: 'raw', f: (v) => (2 * mf(v).n) + ' requests' },
        { label: 'Contracts to keep stable: via shell · direct slice-to-slice', fmt: 'raw', f: (v) => { const n = mf(v).n; return n + ' · ' + (n * (n - 1) / 2); } },
        { label: 'Pairs of teams that must coordinate a shared release train', fmt: 'raw', f: (v) => { const t = Math.round(v.teams); return (t * (t - 1) / 2) + ' pairs'; } }
      ],
      note: 'Sizes are transfer sizes and <em>estimates</em>; measure your own bundles. Download time ignores parsing and execution, which on a mid-range phone often cost as much again. The copies slider is capped at slices + 1 (each slice plus the shell). The last two rows are simple counting: a contract through the shell grows linearly with slices, direct imports between slices grow with the square, and so do team pairs on one release train. This is the trade: <b>micro-frontends remove the team pairs and add bytes and requests</b>.'
    },

    api: [
      { m: 'DOC', p: 'Slice contract: <acme-mini-cart>', d: 'What a slice exposes to others: element or module name, attributes/props, events it emits and listens to, and the URL paths it owns. This is the only thing other teams may depend on.' },
      { m: 'YAML', p: 'mfe-manifest (remote registry)', d: 'Maps slice name → bundle URL, version, integrity hash and rollout ring. The shell reads it at run time, so a deploy or rollback is a pointer change, not a shell release.' },
      { m: 'POLICY', p: 'Shared dependency policy', d: 'Which libraries are shared singletons (framework, router, design system), the allowed version range, and who approves a major upgrade. Everything else is bundled privately.' },
      { m: 'EVENT', p: 'cart:item-added (browser CustomEvent)', d: 'Namespaced event with a small, versioned payload: <code>{ sku, qty }</code>. Fire and forget; no slice may require a listener to exist.' },
      { m: 'ADR', p: 'ADR-031: Run-time composition with Module Federation', d: 'Why this composition style, how the split follows team boundaries, performance budget per route, fallback behaviour and when a slice may be merged back.' },
      { m: 'SLO', p: 'Per-route web vitals', d: 'LCP, INP and JS weight per route with an owner. A slice that breaks the budget blocks its own release, not everybody\'s.' }
    ],
    dataModel: [
      { name: 'mfe_release', store: 'Postgres (manifest service)', fields: [['name', 'text', 'pk'], ['version', 'text', 'pk'], ['ring', 'canary|stable', 'pk'], ['url', 'text'], ['integrity', 'text'], ['active', 'boolean', 'idx'], ['deployed_at', 'timestamptz']], note: 'One active row per (name, ring). Rollback flips <code>active</code> to the previous version; bundles are immutable and content-hashed on the CDN.' },
      { name: 'shared_dependency', store: 'Policy file in the platform repo', fields: [['package', 'text', 'pk'], ['range', 'semver range'], ['singleton', 'boolean'], ['owner_team', 'text'], ['upgrade_deadline', 'date']], note: 'CI compares each slice\'s <code>package.json</code> against this file and fails on a framework version outside the range.' },
      { name: 'route_ownership', store: 'Shell configuration', fields: [['path_prefix', 'text', 'pk'], ['slice', 'text', 'fk'], ['team', 'text'], ['fallback', 'text'], ['js_budget_kb', 'int']], note: 'The shell\'s router table. One prefix has exactly one owner; inside the prefix the slice routes on its own.' }
    ],

    architecture: {
      title: 'Run-time composition: shell, remotes, a BFF per slice',
      nodes: [
        { id: 'user', label: 'Browser', sub: 'one URL, one page', kind: 'client', wide: [90, 0], tall: [70, 0], tip: 'The user sees one site. All slices run in the same document and on the same main thread.' },
        { id: 'cdn', label: 'CDN / edge', sub: 'immutable bundles', kind: 'edge', wide: [280, 0], tall: [210, 0], tip: 'Serves the shell and every slice\'s content-hashed bundle. With edge composition this node also assembles HTML fragments.' },
        { id: 'shell', label: 'App shell', sub: 'routes · layout · auth', kind: 'service', wide: [470, 0], tall: [210, 105], tip: 'Thin host. Owns the top-level router and layout slots, loads the slice for the current route, wraps each in an error boundary. Custom events between slices travel through the shared window it owns.' },
        { id: 'manifest', label: 'Remote manifest', sub: 'name → URL@version', kind: 'store', wide: [680, 0], tall: [350, 0], tip: 'Tells the shell where each slice\'s current bundle lives. Deploy and rollback change this pointer.' },
        { id: 'ds', label: 'Design system', sub: 'tokens + components', kind: 'compute', wide: [90, 115], tall: [70, 105], tip: 'A versioned package every slice imports. Shared as a singleton at run time so the page loads it once.' },
        { id: 'cat', label: 'Catalog MFE', sub: 'team Catalog', kind: 'service', wide: [280, 115], tall: [70, 210], tip: 'Owns /products. Built and deployed by the Catalog team on its own pipeline.' },
        { id: 'cart', label: 'Cart MFE', sub: 'team Cart', kind: 'service', wide: [470, 115], tall: [210, 210], tip: 'Owns /cart and exposes a mini-cart element other pages can embed.' },
        { id: 'chk', label: 'Checkout MFE', sub: 'team Checkout', kind: 'service', wide: [680, 115], tall: [350, 210], tip: 'Owns /checkout. Often the first slice to be isolated because its risk and release rhythm differ.' },
        { id: 'bffa', label: 'Catalog BFF', sub: 'owned by Catalog', kind: 'service', wide: [280, 230], tall: [70, 315], tip: 'Backend for frontend: shapes data for this slice only, so the slice makes one call instead of five.' },
        { id: 'bffb', label: 'Cart BFF', sub: 'owned by Cart', kind: 'service', wide: [470, 230], tall: [210, 315], tip: 'Same team as the Cart MFE. UI and BFF deploy together when the contract between them changes.' },
        { id: 'bffc', label: 'Checkout BFF', sub: 'owned by Checkout', kind: 'service', wide: [680, 230], tall: [350, 315], tip: 'Holds the session with the payment provider; the browser never sees those credentials.' },
        { id: 'svc', label: 'Domain services', sub: 'orders · stock · pricing', kind: 'service', wide: [470, 340], tall: [210, 420], tip: 'The microservices behind the BFFs. Slices never call them directly.' }
      ],
      edges: [
        { from: 'user', to: 'cdn' },
        { from: 'cdn', to: 'shell' },
        { from: 'shell', to: 'manifest' },
        { from: 'shell', to: 'cat', bidi: true },
        { from: 'shell', to: 'cart', bidi: true },
        { from: 'shell', to: 'chk', bidi: true },
        { from: 'ds', to: 'cat', dashed: true },
        { from: 'cat', to: 'bffa' },
        { from: 'cart', to: 'bffb' },
        { from: 'chk', to: 'bffc' },
        { from: 'bffa', to: 'svc' },
        { from: 'bffb', to: 'svc' },
        { from: 'bffc', to: 'svc' }
      ]
    },

    scenarios: [
      {
        id: 'load', title: 'Page load: compose in the browser', tone: 'info',
        steps: [
          { text: 'The browser requests <code>/products/42</code>. The CDN returns the <b>app shell</b>: a small HTML page and a small script. No business code yet.', flow: ['user>cdn', 'cdn>shell'], badges: { shell: 'tiny host' } },
          { text: 'The shell reads the <b>manifest</b> to find the current bundle URL of each slice. Nothing about slice versions is baked into the shell\'s build.', flow: ['shell>manifest'], badges: { manifest: 'cart → v87' } },
          { text: 'The route belongs to Catalog, so the shell loads the <b>Catalog remote</b>, plus the mini-cart from the Cart remote for the header slot.', flow: [['shell>cat', 'shell>cart']], ok: ['cat', 'cart'], badges: { cat: 'route owner', cart: 'header slot' } },
          { text: 'The bundles negotiate <b>shared libraries</b>: the framework and the design system are loaded once and used by all. Everything else stays private to its slice.', flow: ['ds>cat'], ok: ['ds'], badges: { ds: ['loaded once', 'ok'] } },
          { text: 'Each slice calls <b>its own BFF</b>, which fans out to domain services. The page is one site to the user and three deployments to the organisation.', flow: [['cat>bffa', 'cart>bffb'], ['bffa>svc', 'bffb>svc']], ok: ['bffa', 'bffb'], tone: 'ok' }
        ]
      },
      {
        id: 'comm', title: 'Add to cart: slices talk by events', tone: 'info',
        steps: [
          { text: 'The user clicks "Add to cart" inside the <b>Catalog</b> slice. Catalog does not import any Cart code.', nodes: ['cat'], badges: { cat: 'click' } },
          { text: 'Catalog posts to the Cart API through its BFF contract, then fires a browser event <code>cart:item-added</code> on the shared window.', flow: ['cat>bffa', 'bffa>svc', 'cat>shell'], badges: { shell: 'cart:item-added' } },
          { text: 'The <b>mini-cart</b> listens for that event and refreshes its count from its own BFF. If the mini-cart is not on the page, nothing breaks: nobody was waiting for an answer.', flow: ['shell>cart', 'cart>bffb'], ok: ['cart'], badges: { cart: ['count = 3', 'ok'] } },
          { text: 'Navigation works the same way: Catalog links to <code>/checkout</code>. The <b>URL is the contract</b>; the shell swaps slices. No slice reaches into another slice\'s state.', flow: ['shell>chk'], ok: ['chk'], tone: 'ok' }
        ]
      },
      {
        id: 'ship', title: 'Cart ships a bad build, then rolls back', tone: 'err',
        steps: [
          { text: 'The Cart team deploys v88 at 14:00: a new content-hashed bundle on the CDN, then one pointer change in the manifest. <b>No shell release, no other team involved.</b>', flow: ['shell>manifest'], badges: { manifest: 'cart → v88', cart: 'v88' } },
          { text: 'v88 throws on render for logged-out users. Without isolation the exception would unmount the whole page.', flow: ['shell>cart'], err: ['cart'], badges: { cart: ['render error', 'err'] }, tone: 'err' },
          { text: 'The shell wraps every slice in an <b>error boundary with a timeout</b>. The cart area shows a plain "Cart" link as fallback; catalog and checkout keep working.', flow: ['shell>cat'], warn: ['cart'], ok: ['cat', 'chk'], badges: { cart: ['fallback link', 'warn'] }, tone: 'warn' },
          { text: 'The error-rate alert is tagged with slice and version, so it pages the <b>Cart team only</b>. They flip the manifest back to v87. Bundles are immutable, so rollback is instant.', flow: ['shell>manifest', 'shell>cart'], ok: ['cart', 'manifest'], badges: { manifest: ['cart → v87', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'clash', title: 'Two framework versions on one page', tone: 'err',
        steps: [
          { text: 'Checkout upgrades to the next <b>major</b> framework version on its own. The shell and other slices stay on the old one.', nodes: ['chk'], warn: ['chk'], badges: { chk: 'framework v19', shell: 'framework v18' } },
          { text: 'If the framework is a <b>shared singleton</b>, Checkout now runs on a version it was not built for and fails at run time. If it is not shared, the page downloads <b>two copies</b>.', flow: ['shell>chk'], err: ['chk'], badges: { chk: ['version mismatch', 'err'] }, tone: 'err' },
          { text: 'Two copies also break shared UI: a design-system component rendered by one copy cannot use context or hooks from the other.', flow: ['ds>cat'], warn: ['ds'], badges: { ds: ['2 runtimes', 'warn'] }, tone: 'warn' },
          { text: 'Fix: a <b>shared dependency policy</b>. The framework is a singleton with an agreed range, CI rejects a slice outside it, and a major upgrade is a planned, time-boxed migration led by the platform team.', nodes: ['shell', 'cat', 'cart', 'chk'], ok: ['shell', 'cat', 'cart', 'chk'], badges: { shell: ['one range', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'scale', title: 'At scale: ten slices, one slow page', tone: 'warn',
        steps: [
          { text: 'Two years later the home page embeds ten slices from eight teams. Each adds an entry file, a chunk and a call to its BFF.', flow: [['shell>cat', 'shell>cart', 'shell>chk']], hot: ['shell'], badges: { shell: ['10 remotes', 'warn'] } },
          { text: 'The browser discovers them <b>one after another</b>: shell, then manifest, then entries, then chunks, then data. A request waterfall, and nobody owns the total.', flow: ['user>cdn', 'cdn>shell', 'shell>manifest'], warn: ['user'], badges: { user: ['LCP 4.8 s', 'err'] }, tone: 'err' },
          { text: 'Fix the loading: the shell inlines the manifest and <b>preloads</b> the entries for this route, slices below the fold load lazily, and the first screen is rendered on the <b>server or edge</b>.', flow: ['cdn>shell', ['shell>cat', 'shell>cart']], ok: ['cdn'], badges: { cdn: ['preload + SSR', 'ok'] } },
          { text: 'Fix the ownership: a <b>performance budget per route</b> in CI, with the route owner accountable. Small slices that always ship together are <b>merged back</b> into one.', nodes: ['shell', 'cat'], ok: ['user'], badges: { user: ['LCP 2.1 s', 'ok'] }, tone: 'ok' }
        ]
      }
    ],

    knobs: {
      intro: 'Each control is a real choice when you split a frontend. Meter values are <em>illustrative</em> judgements, not benchmarks.',
      controls: [
        { id: 'compose', label: 'Composition', type: 'seg', value: 'runtime', options: [
          { v: 'build', l: 'Build-time packages' }, { v: 'runtime', l: 'Run-time (Module Federation)' }, { v: 'edge', l: 'Server / edge includes' }, { v: 'iframe', l: 'Iframes' }] },
        { id: 'deps', label: 'Framework & design system', type: 'seg', value: 'shared', options: [
          { v: 'own', l: 'Each slice bundles its own' }, { v: 'shared', l: 'Shared singleton, agreed range' }] },
        { id: 'gran', label: 'Slice size', type: 'seg', value: 'page', options: [
          { v: 'page', l: 'One slice per route' }, { v: 'frag', l: 'Several slices per page' }] },
        { id: 'comm', label: 'Cross-slice communication', type: 'seg', value: 'events', options: [
          { v: 'events', l: 'URL + events' }, { v: 'store', l: 'Shared global store' }] },
        { id: 'teams', label: 'Frontend teams', type: 'range', min: 2, max: 40, step: 1, value: 8 }
      ],
      evaluate(s) {
        const clamp = (x) => Math.max(0.03, Math.min(0.97, x));
        const C = s.compose, own = s.deps === 'own', frag = s.gran === 'frag', store = s.comm === 'store', T = s.teams;
        const auton = { build: 0.25, runtime: 0.9, edge: 0.85, iframe: 0.95 }[C] - (store ? 0.3 : 0) - (C === 'build' && T > 10 ? 0.1 : 0);
        const weight = { build: 0.85, runtime: 0.72, edge: 0.8, iframe: 0.32 }[C] - (own ? (C === 'iframe' ? 0.05 : 0.28) : 0) - (frag ? 0.12 : 0);
        const cons = { build: 0.85, runtime: 0.7, edge: 0.68, iframe: 0.4 }[C] + (own ? -0.18 : 0.1) - (frag ? 0.05 : 0);
        const iso = { build: 0.2, runtime: 0.6, edge: 0.72, iframe: 0.95 }[C] - (store ? 0.25 : 0) - (own ? 0 : 0.05);
        const coup = (store ? 0.25 : 0.8) - (C === 'build' ? 0.2 : 0) - (own ? 0 : 0.08) - (frag ? 0.05 : 0);
        const ops = { build: 0.85, runtime: 0.45, edge: 0.4, iframe: 0.6 }[C] - (frag ? 0.12 : 0) - (own ? 0.05 : 0);
        const metrics = [
          { k: 'Independent deploys', v: auton >= 0.75 ? 'each team ships alone' : auton >= 0.45 ? 'mostly, with coordination' : 'lockstep: shell rebuild per change', s: clamp(auton) },
          { k: 'Page weight & speed', v: weight >= 0.7 ? 'close to a single app' : weight >= 0.45 ? 'noticeably heavier' : 'heavy: duplicated runtimes', s: clamp(weight) },
          { k: 'UX consistency', v: cons >= 0.75 ? 'one look, one behaviour' : cons >= 0.5 ? 'drifts without governance' : 'visible seams', s: clamp(cons) },
          { k: 'Failure isolation', v: iso >= 0.8 ? 'a slice cannot break the page' : iso >= 0.5 ? 'contained by error boundaries' : 'one bug takes the page down', s: clamp(iso) },
          { k: 'Coupling between teams', v: coup >= 0.65 ? 'low: contracts only' : coup >= 0.4 ? 'medium' : 'high: shared state or shared build', s: clamp(coup) },
          { k: 'Build & run complexity', v: ops >= 0.7 ? 'low' : ops >= 0.4 ? 'moderate: manifest, versions, RUM' : 'high: many moving parts', s: clamp(ops), hint: 'lower bar = harder' }
        ];
        const notes = [];
        if (C === 'build') notes.push('Slices are npm packages compiled into one bundle. The bundler dedupes well, but <b>every change needs a new shell build and release</b>: a monolith with extra steps. Good as a first step, or for a small number of teams.');
        if (C === 'runtime') notes.push('The shell loads each slice\'s entry file at run time. Deploy and rollback are a manifest change. You must manage <b>shared versions</b> and a request waterfall.');
        if (C === 'edge') notes.push('Each team serves HTML fragments; the CDN or a layout service stitches them (ESI, SSI, streaming). Best first-paint for content-heavy pages; interactive state across fragments is harder.');
        if (C === 'iframe') notes.push('The strongest isolation the browser has: separate document, styles and globals. You pay with sizing, focus, deep links, accessibility and no sharing of code. Right for embedding untrusted or legacy screens.');
        if (own && C !== 'iframe') notes.push('Each slice ships its own framework copy. Upgrades are free of coordination, but the page downloads and runs the runtime several times.');
        if (!own && C === 'iframe') notes.push('Iframes cannot share JavaScript modules. A "shared" framework only helps through the HTTP cache when every frame loads the same URL.');
        if (store) notes.push('A shared store means every slice depends on its shape. One team\'s refactor breaks the others at run time: the coupling you removed from the build is back.');
        if (frag) notes.push('Several slices per page multiplies requests and contracts. Split by route first; embed a fragment only where a page truly needs another team\'s widget.');
        let verdict;
        if (T < 4 && C !== 'build') verdict = '⚠ <b>Too few teams.</b> With ' + T + ' teams the operational cost outweighs the autonomy. Use a modular monolith frontend with clear folder ownership.';
        else if (store) verdict = '❌ <b>Distributed monolith in the browser.</b> A shared global store couples every slice; replace it with events, the URL and each slice\'s own BFF.';
        else if (C === 'build' && T >= 10) verdict = '⚠ <b>Lockstep releases.</b> ' + T + ' teams behind one build queue is the problem you set out to solve. Move to run-time or edge composition.';
        else if (C === 'iframe') verdict = '👍 <b>Fine for islands, not for the whole site.</b> Use iframes for legacy or third-party screens and compose the rest another way.';
        else if (own) verdict = '⚠ <b>Duplicated runtimes.</b> Autonomy is high but users pay for every copy. Share the framework and the design system as singletons.';
        else if (C === 'runtime') verdict = '✅ <b>The common target:</b> run-time composition, one shared framework range, events and URLs between slices, a BFF per slice.';
        else if (C === 'edge') verdict = '✅ <b>Strong for content and commerce pages:</b> HTML assembled at the edge, fast first paint, teams still deploy alone.';
        else verdict = '👍 <b>Workable for a few teams.</b> Simple and light; revisit when the build queue starts to hurt.';
        const hide = [];
        if (C !== 'runtime') hide.push('manifest');
        const labels = {
          shell: C === 'build' ? { label: 'One app bundle', sub: 'slices as npm packages' } : C === 'iframe' ? { label: 'App shell', sub: 'one iframe per slice' } : C === 'edge' ? { label: 'Layout service', sub: 'stitches HTML fragments' } : { label: 'App shell', sub: 'routes · layout · auth' },
          cdn: C === 'edge' ? { label: 'CDN / edge', sub: 'ESI include + cache' } : { label: 'CDN / edge', sub: 'immutable bundles' },
          ds: own ? { label: 'Design system', sub: 'copied into each slice' } : { label: 'Design system', sub: 'shared singleton' }
        };
        const badges = {};
        if (store) badges.shell = ['global store', 'err'];
        if (own && C !== 'build') badges.cat = ['+ own runtime', 'warn'];
        if (C === 'build') badges.shell = ['rebuild per change', 'warn'];
        if (C === 'iframe') badges.chk = ['isolated document', 'ok'];
        const flow = ['user>cdn', 'cdn>shell'];
        if (C === 'runtime') flow.push('shell>manifest');
        flow.push(['shell>cat', 'shell>cart'], ['cat>bffa', 'cart>bffb']);
        return {
          metrics, verdict, notes: notes.slice(0, 4), labels, hide, flow, badges,
          err: store ? ['shell'] : [],
          warn: (own && C !== 'build' ? ['cat', 'cart', 'chk'] : []).concat(C === 'build' ? ['shell'] : []),
          ok: !store && !own && (C === 'runtime' || C === 'edge') ? ['shell', 'ds'] : [],
          hot: frag ? ['shell'] : []
        };
      }
    },

    widget: {
      title: 'Shared dependency lab: which framework copy does each slice get?',
      caption: 'This runs the <b>version negotiation of Module Federation</b>. Give the shell and each remote a framework version, then toggle <b>singleton</b>, <b>strictVersion</b> and whether remotes are known at startup. Watch which copy each slice uses, how many copies the page downloads, and when a slice fails to load.'
    },

    realWorld: {
      intro: 'The idea was named around 2016. The organisations below published how they composed their pages, and several later simplified what they had built.',
      timeline: [
        { when: '2016', who: 'Zalando', title: 'Project Mosaic and Tailor', text: 'Zalando moved its shop off a monolith to pages built from <b>fragments owned by different teams</b>. Its open-source <b>Tailor</b> is a Node.js layout service that fetches fragments and <b>streams</b> the assembled page to the browser.', src: 3 },
        { when: 'Nov 2016', who: 'Thoughtworks', title: 'Micro frontends on the Technology Radar', text: 'The Radar listed micro frontends at <b>Assess</b> in November 2016, noting that teams had split the backend but still built frontend monoliths. It moved to <b>Trial</b> in May 2018 and <b>Adopt</b> in November 2019.', src: 1 },
        { when: '2018', who: 'IKEA', title: 'Pages and fragments with ESI', text: 'Gustaf Nilsson Kotte described IKEA\'s approach: teams own <b>pages</b> and <b>fragments</b>, and <b>Edge Side Includes</b> stitch them, "like an image tag, but for HTML". He prefers vertical, self-contained systems where one team builds backend and frontend, and stresses the design is not right for everyone.', src: 6 },
        { when: '2019', who: 'Cam Jackson (Thoughtworks)', title: 'The reference article', text: 'Defines micro frontends as "an architectural style where independently deliverable frontend applications are composed into a greater whole", and compares server-side composition, build-time integration and run-time integration via iframes, JavaScript and web components. It also lists the costs: payload size and operational complexity.', src: 0 },
        { when: '2020', who: 'webpack', title: 'Module Federation', text: 'webpack 5 added <b>Module Federation</b>: separately built bundles act as <b>hosts</b> and <b>remotes</b>, load each other\'s modules at run time, and negotiate <b>shared</b> libraries with options such as <code>singleton</code>, <code>requiredVersion</code> and <code>strictVersion</code>. Rspack accepts the same plugin options.', src: 9 },
        { when: '2021', who: 'Zalando', title: 'From fragments to renderers', text: 'Zalando wrote that Mosaic let many teams work on the site independently, but that the <b>fragments approach had limits</b>. Its successor, the Interface Framework, composes views declaratively and also feeds content to the native apps.', src: 4 },
        { when: '2021', who: 'Spotify', title: 'One codebase for desktop and web player', text: 'Spotify\'s desktop client and web player had grown apart. The team <b>converged them into a single codebase</b> built on the web player. Secondary coverage (SD Times) describes the earlier desktop client as using an iframe per feature. A reminder that splitting is reversible, and sometimes reversed.', src: 8 },
        { when: 'Radar', who: 'Thoughtworks', title: 'Micro frontend anarchy', text: 'A separate Radar entry warns that the style is sometimes used as an excuse to <b>mix competing frameworks on one page</b>, such as React and Angular, outside a deliberate transition, and recommends consistent styling and integration approaches across teams.', src: 2 },
        { when: '2023', who: 'IKEA', title: 'History of IKEA.com', text: 'IKEA\'s engineering blog looked back: ESI is a web standards proposal from 2001, the CDN already supported it, and static files plus includes let teams deploy without waiting for each other.', src: 7 }
      ],
      lessons: [
        'Split by <b>business area and team</b>, never by technical layer.',
        'The composition technique is a detail; <b>independent deploys and no shared state</b> are the point.',
        'Keep <b>one framework version</b> on a page unless you are migrating, with a deadline.',
        'Give every route a <b>performance budget and an owner</b>; nobody owns the total by default.',
        'Be ready to <b>merge slices back</b>: several organisations simplified after their first design.'
      ],
      sources: [
        { title: 'Micro Frontends', url: 'https://martinfowler.com/articles/micro-frontends.html', pub: 'Cam Jackson, martinfowler.com, 2019' },
        { title: 'Micro frontends (Technology Radar)', url: 'https://www.thoughtworks.com/en-us/radar/techniques/micro-frontends', pub: 'Thoughtworks, 2016–2019' },
        { title: 'Micro frontend anarchy (Technology Radar)', url: 'https://thoughtworks.com/radar/techniques/micro-frontend-anarchy', pub: 'Thoughtworks' },
        { title: 'Better streaming layouts for frontend microservices with Tailor', url: 'https://engineering.zalando.com/posts/2016/06/frontend-microservices-tailor.html', pub: 'Zalando Engineering, 2016' },
        { title: 'Micro Frontends: from Fragments to Renderers (Part 1)', url: 'https://engineering.zalando.com/posts/2021/03/micro-frontends-part1.html', pub: 'Zalando Engineering, 2021' },
        { title: 'Building a Modular Portal with Webpack Module Federation', url: 'https://engineering.zalando.com/posts/2024/10/building-modular-portal-with-webpack-module-federation.html', pub: 'Zalando Engineering, 2024' },
        { title: 'Experiences Using Micro Frontends at IKEA', url: 'https://www.infoq.com/news/2018/08/experiences-micro-frontends', pub: 'InfoQ, August 2018' },
        { title: 'History of IKEA.com: Static files and Microfrontends', url: 'https://medium.com/flat-pack-tech/history-of-ikea-com-static-files-and-microfrontends-6def9d7c4285', pub: 'Gustaf Nilsson Kotte, IKEA Flat Pack Tech, 2023' },
        { title: 'Building the Future of Our Desktop Apps', url: 'https://engineering.atspotify.com/2021/4/building-the-future-of-our-desktop-apps', pub: 'Spotify Engineering, April 2021' },
        { title: 'Module Federation (concepts)', url: 'https://webpack.js.org/concepts/module-federation', pub: 'webpack documentation' },
        { title: 'ModuleFederationPlugin (shared, singleton, requiredVersion, strictVersion)', url: 'https://webpack.js.org/plugins/module-federation-plugin', pub: 'webpack documentation' },
        { title: 'Micro Frontends: extending the microservice idea to frontend development', url: 'https://micro-frontends.org/', pub: 'Michael Geers' },
        { title: 'Building Micro-Frontends, chapter 4: Discovering Micro-Frontend Architectures', url: 'https://www.oreilly.com/library/view/building-micro-frontends/9781492082989/ch04.html', pub: 'Luca Mezzalira, O\'Reilly' },
        { title: 'ModuleFederationPlugin', url: 'https://rspack.rs/plugins/webpack/module-federation-plugin', pub: 'Rspack documentation' },
        { title: 'Spotify web and desktop client unification (news coverage)', url: 'https://www.infoq.com/news/2021/04/spotify-web-desktop-unification/', pub: 'InfoQ, April 2021' },
        { title: 'Starting from scratch may sometimes be the best option when trying to improve your applications', url: 'https://sdtimes.com/softwaredev/starting-from-scratch-may-sometimes-be-the-best-option-when-trying-to-improve-your-applications/', pub: 'SD Times (secondary coverage of Spotify\'s desktop client)' }
      ]
    },

    tradeoffs: {
      headers: ['Composition', 'How it works', 'Strength', 'Cost', 'Pick when…'],
      rows: [
        ['<b>Build-time packages</b>', 'Each slice is an npm package; the shell bundles them', 'One optimised bundle, simple runtime', 'Every change needs a shell release: lockstep', 'Few teams, or as a first step toward a split'],
        ['<b>Run-time JavaScript</b> (Module Federation, import maps, single-spa)', 'The shell loads each slice\'s entry file in the browser', 'Independent deploy and rollback; shared libraries', 'Version negotiation, request waterfall, more to observe', 'App-like products with many teams'],
        ['<b>Server / edge composition</b> (SSI, ESI, streaming layout)', 'HTML fragments are stitched before the browser', 'Fast first paint, works without JS, cacheable', 'Cross-fragment interactivity and local dev are harder', 'Content and commerce pages'],
        ['<b>Iframes</b>', 'Each slice is its own document', 'Strongest isolation of styles, globals and crashes', 'Sizing, focus, deep links, accessibility; no code sharing', 'Legacy or third-party screens'],
        ['<b>Web components</b>', 'Slices are custom elements; the DOM is the API', 'Framework-neutral contract, style scoping with shadow DOM', 'Server rendering and shared state need care', 'As the <i>interface</i> of a slice, combined with one of the above'],
        ['<b>Modular monolith frontend</b>', 'One repo and build, strict module boundaries and owners', 'Lightest and most consistent', 'One release train', 'One to three teams']
      ]
    },
    failures: [
      { f: 'Duplicated or mismatched framework versions', detect: 'Bundle analysis shows several runtimes; "invalid hook call" style errors at slice borders', fix: 'Shared singleton with an agreed range, checked in CI; planned major upgrades with a deadline.' },
      { f: 'Shared global state between slices', detect: 'A slice breaks after another team\'s deploy; imports from another slice\'s store', fix: 'URL, custom events and each slice\'s own BFF; lint rule that forbids cross-slice imports.' },
      { f: 'A failing remote takes down the page', detect: 'White screen when one entry file returns 5xx or times out', fix: 'Error boundary and load timeout per slot with a static fallback; alerts tagged by slice and version.' },
      { f: 'CSS and global leaks', detect: 'A slice\'s styles change another slice; globals overwritten on <code>window</code>', fix: 'Scoped CSS (modules, shadow DOM, prefixes); unique bundle names; no global resets outside the shell.' },
      { f: 'Request waterfall and slow first paint', detect: 'LCP and JS weight rise with each added slice; long chains in the network panel', fix: 'Preload entries from an inlined manifest; lazy-load below the fold; render the first screen on the server or edge; budgets in CI.' },
      { f: 'Inconsistent UX', detect: 'Different buttons, spacing and error messages per area', fix: 'A design system run as a product with its own team, versioning and adoption tracking.' },
      { f: 'Wrong split', detect: 'Most features need changes in three slices and the shell', fix: 'Re-cut along business capabilities; merge slices that always change together.' }
    ],

    interview: [
      { q: 'What is a micro-frontend, and what problem does it solve?', a: '<p>Cam Jackson\'s definition (2019): "an architectural style where <b>independently deliverable</b> frontend applications are composed into a greater whole". Each part is owned by one team, built and deployed on its own.</p><p>It solves a <b>scaling-the-organisation</b> problem: many teams blocked by one frontend codebase and one release train. It does not make a page faster or code better. A common misreading is that it is about using several frameworks; that is a side effect to avoid, not a goal.</p>', lvl: 'core' },
      { q: 'What are the ways to compose micro-frontends, and how do you choose?', a: '<ul><li><b>Build time</b>: slices as packages in one bundle. Light, but releases stay coupled.</li><li><b>Run time in the browser</b>: the shell loads remote bundles (Module Federation, import maps, single-spa). Independent deploys; needs version management.</li><li><b>Server or edge</b>: HTML fragments stitched by SSI, ESI or a streaming layout service. Best first paint.</li><li><b>Iframes</b>: strongest isolation, weakest integration.</li><li><b>Web components</b>: a framework-neutral interface for a slice, used with one of the above.</li></ul><p>I choose by product type and team count: content or commerce pages lean to edge composition; app-like products with many teams lean to run-time composition; legacy or third-party screens get iframes.</p>', fu: 'Which of these keeps deploys independent?', lvl: 'core' },
      { q: 'How does Module Federation share a library between separately built bundles?', a: '<p>Each build declares <code>shared</code> libraries. At startup every container registers the versions it can provide in a <b>share scope</b>. When code asks for the library, the runtime picks a version:</p><ul><li>Normal sharing: the <b>highest registered version that satisfies</b> the consumer\'s <code>requiredVersion</code>; otherwise the consumer falls back to its own bundled copy.</li><li><code>singleton: true</code>: only one version is used for everybody. A consumer whose range is not satisfied gets a <b>warning</b>, or an <b>error</b> with <code>strictVersion: true</code>.</li></ul><p>So singleton trades duplicate downloads for the risk of running on an unexpected version. Use it for libraries with global state: the framework, the router, the design system.</p>', lvl: 'deep' },
      { q: 'How should micro-frontends communicate with each other?', a: '<p>As little as possible, and never through shared mutable state.</p><ul><li><b>URL</b>: the main contract. Navigation and deep links carry ids and filters.</li><li><b>Custom events</b> on the window or a tiny pub/sub: namespaced, small versioned payloads, fire and forget.</li><li><b>Props or attributes</b> from the shell downward, callbacks or events upward.</li><li><b>Backend</b>: if two slices need the same data, each asks its own BFF; the server is the source of truth.</li></ul><p>If two slices chat constantly, they are probably one slice.</p>', lvl: 'core' },
      { q: 'How do you keep the user experience consistent across teams?', a: '<p>With a <b>design system run as a product</b>: tokens and components, versioned, documented, with its own owners and a contribution model. It should hold UI building blocks only, no business logic.</p><p>At run time it is a shared singleton so the page loads it once. Governance is light but real: an allowed version range, a deadline to leave old majors, and visual regression tests at slice borders. Shared things like the header, login state and error pages belong to the shell or a clearly named owning team.</p>', lvl: 'core' },
      { q: 'What does it cost in performance, and how do you control it?', a: '<ul><li><b>Bytes</b>: duplicated libraries, plus an entry file and chunk per slice.</li><li><b>Round trips</b>: shell → manifest → entries → chunks → data is a waterfall.</li><li><b>Main thread</b>: every slice boots on the same thread.</li></ul><p>Controls: share the framework; inline the manifest and preload the route\'s entries; lazy-load below the fold; render the first screen on the server or edge; set a <b>budget per route</b> in CI with a named owner; watch real-user web vitals tagged by slice and version.</p>', lvl: 'deep' },
      { q: 'How do micro-frontends relate to the backend for frontend (BFF) pattern and to Conway\'s Law?', a: '<p>A slice works best as a <b>vertical</b>: UI, a BFF and the services behind it, owned by one stream-aligned team. The BFF gives the slice one tailored API, hides service fan-out and keeps tokens off the browser. See <a href="ms-edge-bff.html">Edge & BFF</a>.</p><p><a href="conways-law.html">Conway\'s Law</a> says the system will mirror the communication structure anyway. Micro-frontends are an <b>inverse Conway manoeuvre</b> for the UI: draw the technical seams where you want the team seams. If teams are organised by layer, the split will fail.</p>', lvl: 'core' },
      { q: 'One remote fails to load in production. What should the user see, and how is that designed?', a: '<p>The rest of the page, with a fallback in that slot. Design:</p><ul><li>The shell loads each slice inside an <b>error boundary</b> with a <b>timeout</b>, and renders a static fallback (a link, a cached fragment, or nothing).</li><li>Critical slots (checkout on the checkout route) fail loudly with a retry; decorative ones fail silently.</li><li>Bundles are <b>immutable and content-hashed</b>; the manifest points to a version, so rollback is a pointer flip.</li><li>Errors and web vitals carry <b>slice and version tags</b> so the alert reaches the owning team.</li></ul>', lvl: 'deep' },
      { q: 'How do you handle authentication and routing across slices?', a: '<p><b>Authentication</b> belongs to the shell and the BFFs. The shell establishes the session once (ideally an HttpOnly cookie managed by a BFF or gateway); slices never handle raw tokens and learn "who is the user" from the shell or their BFF.</p><p><b>Routing</b> is two-level: the shell owns the top-level prefixes (<code>/cart</code> → Cart slice); each slice routes inside its prefix. Slices link to each other with plain URLs, so they never import each other\'s router.</p>', lvl: 'deep' },
      { q: 'When would you advise against micro-frontends?', a: '<ul><li><b>Few teams</b>: under roughly four or five, a modular monolith frontend gives the same boundaries with one build.</li><li><b>Highly interwoven UI</b>, such as a design tool or spreadsheet, where every part shares live state.</li><li><b>No platform capacity</b> to own the shell, manifest, design system and monitoring.</li><li><b>Team structure by layer</b>: the split will follow the org chart and produce horizontal slices.</li></ul><p>I would say in the interview: start with strict module boundaries in one repo, measure where teams actually block each other, and split only those seams.</p>', lvl: 'core' },
      { q: 'How would you migrate a large legacy single-page app to micro-frontends?', a: '<p>As a <a href="strangler-fig.html">strangler fig</a>: put a thin shell in front that owns the router; mount the <b>old app as one big slice</b>; then carve out one route at a time, starting with one that has a clear owner and few shared screens.</p><p>Extract the design system early so old and new look the same. Allow two framework versions only at the route level and with a deadline. Track progress as the share of routes served by new slices, and delete old code as you go.</p>', lvl: 'deep' },
      { q: 'Tell me about a time you had to convince teams to change a frontend architecture.', a: '<p><em>Sample story with illustrative numbers. Swap in your own experience.</em><br><b>Situation</b>: seven teams shared one SPA; releases went out twice a week and about one in three was delayed by another team\'s failing test. <b>Task</b>: reduce lead time without a rewrite and without hurting page speed. <b>Action</b>: measured the waiting time per team for a month and showed it to the leads; wrote an ADR proposing run-time composition for the three areas with the most contention only, a shared dependency policy and a per-route performance budget; ran a two-week spike on checkout with the most sceptical team; kept the other areas in the modular monolith. <b>Result</b>: the three areas moved to on-demand deploys several times a day, page weight grew by a few percent and stayed within budget, and two smaller areas were deliberately left unsplit.</p>', lvl: 'core' }
    ],

    code: [
      {
        title: 'Module Federation: shell (host) and cart (remote) with a shared singleton', lang: 'js',
        code: `// shell/webpack.config.js  (webpack 5; Rspack accepts the same plugin options)
const { ModuleFederationPlugin } = require('webpack').container;
const deps = require('./package.json').dependencies;

const shared = {
  // One copy on the page. A slice built for another major fails fast.
  react: { singleton: true, strictVersion: true, requiredVersion: deps.react },
  'react-dom': { singleton: true, strictVersion: true, requiredVersion: deps['react-dom'] },
  '@acme/design-system': { singleton: true, requiredVersion: deps['@acme/design-system'] }
};

module.exports = {
  entry: './src/index.js',            // index.js contains only: import('./bootstrap')
  output: { publicPath: 'auto', uniqueName: 'shell' },
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: { cart: 'cart@https://cdn.acme.example/cart/remoteEntry.js' },
      shared
    })
  ]
};

// cart/webpack.config.js  (separate repository, separate pipeline)
module.exports = {
  entry: './src/index.js',
  output: { publicPath: 'auto', uniqueName: 'cart' },
  plugins: [
    new ModuleFederationPlugin({
      name: 'cart',
      filename: 'remoteEntry.js',
      exposes: { './MiniCart': './src/MiniCart' },   // the public contract
      shared                                         // same policy file in real life
    })
  ]
};

// shell/src/Header.jsx: lazy remote inside an error boundary with a fallback
// const MiniCart = React.lazy(() => import('cart/MiniCart'));
// <ErrorBoundary fallback={<a href="/cart">Cart</a>}><Suspense fallback={null}><MiniCart /></Suspense></ErrorBoundary>`,
        note: 'The async <code>import(\'./bootstrap\')</code> entry gives the runtime a moment to negotiate shared versions before any app code runs. A hard-coded remote URL couples the shell to the cart\'s location; in production, resolve it from the manifest below.'
      },
      {
        title: 'Spring Boot 3: manifest service, deploy and rollback as a pointer flip', lang: 'java',
        code: `// Spring Boot 3.3+, Java 21, Postgres. Table: mfe_release(name, version, ring, url, integrity, active)
@RestController
@RequestMapping("/mfe")
public class ManifestController {
  public record Remote(String name, String version, String url, String integrity) {}

  private final JdbcClient jdbc;
  public ManifestController(JdbcClient jdbc) { this.jdbc = jdbc; }

  @GetMapping("/manifest.json")
  public ResponseEntity<Map<String, Remote>> manifest(
      @RequestParam(defaultValue = "stable") String ring) {
    Map<String, Remote> body = jdbc.sql("""
        SELECT name, version, url, integrity FROM mfe_release
        WHERE ring = :ring AND active ORDER BY name""")
        .param("ring", ring)
        .query(Remote.class).list().stream()
        .collect(Collectors.toMap(Remote::name, r -> r, (a, b) -> a, LinkedHashMap::new));
    // Short cache: a rollback reaches every user within 30 seconds.
    return ResponseEntity.ok()
        .cacheControl(CacheControl.maxAge(Duration.ofSeconds(30)).cachePublic())
        .body(body);
  }

  @PostMapping("/{name}/activate")
  @Transactional   // exactly one active version per (name, ring), switched atomically
  public ResponseEntity<Void> activate(@PathVariable String name,
      @RequestParam String version, @RequestParam(defaultValue = "stable") String ring) {
    jdbc.sql("UPDATE mfe_release SET active = false WHERE name = :n AND ring = :r AND active")
        .param("n", name).param("r", ring).update();
    int changed = jdbc.sql("""
        UPDATE mfe_release SET active = true
        WHERE name = :n AND ring = :r AND version = :v""")
        .param("n", name).param("r", ring).param("v", version).update();
    if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "unknown version");
    return ResponseEntity.noContent().build();
  }
}`,
        note: 'Bundles on the CDN are immutable and cached for a year; only this small JSON is short-lived. A partial unique index <code>ON mfe_release (name, ring) WHERE active</code> makes "two active versions" impossible. Protect <code>activate</code> with the deploying team\'s identity.'
      },
      {
        title: 'TypeScript: a custom element as the slice contract, events between slices', lang: 'js',
        code: `// Owned by the Cart team. Other teams depend on the tag name, the attribute
// and the event name only: never on Cart's source code or framework.
type ItemAdded = { sku: string; qty: number };

class MiniCart extends HTMLElement {
  static observedAttributes = ['locale'];
  #count = 0;
  #onAdded = (e: Event) => {
    this.#count += (e as CustomEvent<ItemAdded>).detail.qty;
    this.#render();
  };

  connectedCallback() {
    window.addEventListener('cart:item-added', this.#onAdded);
    this.#render();
  }
  disconnectedCallback() {                      // always clean up: slices come and go
    window.removeEventListener('cart:item-added', this.#onAdded);
  }
  attributeChangedCallback() { this.#render(); }

  #render() {
    const label = this.getAttribute('locale') === 'de' ? 'Warenkorb' : 'Cart';
    this.textContent = label + ' (' + this.#count + ')';
  }
}
if (!customElements.get('acme-mini-cart')) customElements.define('acme-mini-cart', MiniCart);

// Owned by the Catalog team: no import from Cart, only the documented event.
export function announceAdded(sku: string, qty = 1): void {
  window.dispatchEvent(new CustomEvent<ItemAdded>('cart:item-added', { detail: { sku, qty } }));
}

// Any page, any framework:  <acme-mini-cart locale="de"></acme-mini-cart>`,
        note: 'The guard around <code>customElements.define</code> matters: defining the same tag twice throws, which happens when two bundles ship the same element. Keep payloads small and versioned; if the count must be exact, the element re-reads it from the Cart BFF instead of trusting events.'
      }
    ],

    related: ['ms-edge-bff', 'conways-law', 'strangler-fig', 'platform-engineering', 'ms-service-boundaries', 'sd:cdn', 'sd:api-gateway']
  });
})();
