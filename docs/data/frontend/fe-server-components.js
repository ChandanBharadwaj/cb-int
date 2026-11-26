IA.register({
  track: 'frontend',
  slug: 'fe-server-components',
  title: 'React Server Components',
  tagline: '<b>Server Components</b> run only on the server and ship <b>no JavaScript</b>; <b>Client Components</b> (<code>\'use client\'</code>) hydrate as before. Add <b>streaming with Suspense</b> and <b>server actions</b> and you get one React tree spanning server and browser. Stable in React 19; the main implementation is the Next.js App Router.',
  tldr: {
    problem: 'SPAs fetch data in a browser waterfall and ship every component’s code, even for static text. Classic SSR fixes the first paint but still hydrates everything.',
    model: 'The tree is split at <code>\'use client\'</code> boundaries. Server Components can be <code>async</code>, read the DB directly, and render to a serialised <b>RSC payload</b>. Client Components are bundled, SSR’d and hydrated. <code>&lt;Suspense&gt;</code> lets slow parts stream in later. <code>\'use server\'</code> functions are RPC endpoints callable from the client.',
    hook: '“Is a Server Component the same as SSR?” No. SSR turns components into HTML for the first load. RSC is a component type that never runs on the client and can re-render on the server during navigation, returning a payload rather than HTML. Next.js uses both.',
    facts: [
      { v: 'React 19', l: '(Dec 2024) made Server Components and Server Actions stable for frameworks; the bundler APIs underneath may still change between minors' },
      { v: 'default = server', l: 'in the Next.js App Router every component is a Server Component unless its module (or an importer) says <code>\'use client\'</code>' },
      { v: 'public POST', l: 'each server action is reachable as an HTTP endpoint: always validate input and check authorisation inside it' }
    ]
  },
  intro: {
    what: 'Classic React components run in the browser. Server Components are React components that run <b>only on the server</b>, like a Thymeleaf template that can call your repository directly, but which composes with interactive browser components inside the same tree. The server sends their output; the browser never downloads their code.',
    analogy: { icon: '🍽️', title: 'Kitchen and table', text: 'Server Components are the kitchen: they have the fridge (database) and the knives (secrets), and they plate the food. Client Components are the salt shaker on the table: small things the diner interacts with. Streaming is bringing dishes out as each is ready instead of waiting for the whole meal. A server action is the diner asking the waiter to bring something back to the kitchen.' },
    steps: [
      { t: 'Server by default', d: 'In the App Router a component is a Server Component unless marked. It can be <code>async</code> and await data.', code: 'export default async function Page() {\n  const p = await db.product.find(1);\n  return <h1>{p.name}</h1>;\n}', lang: 'ts' },
      { t: 'Mark interactive parts', d: '<code>\'use client\'</code> at the top of a file makes it (and what it imports) client code. Hooks like <code>useState</code> only work there.' },
      { t: 'Compose', d: 'Server Components can render Client Components and pass them serialisable props, or pass server-rendered JSX as <code>children</code>.' },
      { t: 'Stream slow parts', d: 'Wrap a slow component in <code>&lt;Suspense fallback&gt;</code>; the shell is sent first and the slow part streams in.' },
      { t: 'Mutate with server actions', d: 'A <code>\'use server\'</code> function can be a form’s <code>action</code>; it runs on the server and can revalidate data.' }
    ],
    terms: [
      ['Server Component', 'Runs only on the server; no hooks with state or effects; ships no JS.'],
      ['Client Component', 'A regular React component, marked by <code>\'use client\'</code> on its module; hydrates in the browser.'],
      ['RSC payload', 'The serialised render output (“Flight” format) with references to client components and their props.'],
      ['Suspense', 'A boundary that shows a fallback while children wait for data.'],
      ['server action / function', 'An async function marked <code>\'use server\'</code>, callable from the client like an RPC.'],
      ['revalidation', 'Marking cached server data stale so the next render fetches fresh data.']
    ]
  },
  visual: {
    title: 'The server/client split, streaming and actions',
    caption: 'Pick a flow: <b>Server vs client</b> shows what ships JS, <b>Streaming</b> shows a slow Suspense boundary arriving later in the same response, and <b>Server action</b> shows a form round-trip. Press Play.'
  },
  gotchas: [
    { trap: '<code>\'use client\'</code> too high in the tree', code: `// app/layout.tsx\n'use client';   // now the WHOLE app is client code again`, why: 'The directive marks a boundary: that module and everything it imports become client code. Putting it on a layout throws away most RSC benefits.', fix: 'Mark only interactive leaves (buttons, forms, widgets). Pass server-rendered content into them as <code>children</code>.' },
    { trap: 'Passing non-serialisable props across the boundary', code: `<Chart data={rows} onSelect={(r) => log(r)} />   // function prop from a Server Component: error`, why: 'Props from server to client go through the RSC payload. Functions, class instances and Symbols can’t be serialised (Dates, Maps, Sets and Promises are supported).', fix: 'Pass plain data. For callbacks, pass a server action, or define the handler inside the client component.' },
    { trap: 'Importing server-only code into a client component', why: 'A client module that imports your DB layer pulls it into the browser bundle, or fails at build. Environment variables without <code>NEXT_PUBLIC_</code> are undefined in the browser.', fix: 'Add <code>import \'server-only\'</code> to server modules so a wrong import fails the build.' },
    { trap: 'Trusting a server action because “it’s my form”', code: `'use server';\nexport async function deletePost(id: string) {\n  await db.post.delete({ where: { id } });   // no auth check!\n}`, why: 'Actions are exposed as POST endpoints identified by an action ID. Anyone can call them with any arguments, not just your UI.', fix: 'Authenticate, authorise and validate (e.g. zod) inside every action, as you would in a <code>@PostMapping</code>.' },
    { trap: 'Sequential awaits create a server waterfall', code: `const user = await getUser();\nconst orders = await getOrders();    // waits for user, though independent`, why: 'Moving fetches to the server removes browser waterfalls but you can still create server ones.', fix: 'Start independent requests together with <code>Promise.all</code>, or split into separate Suspense boundaries so each streams on its own.' },
    { trap: 'Expecting context and hooks in Server Components', why: '<code>useState</code>, <code>useEffect</code> and <code>useContext</code> don’t work in Server Components; they render once per request and have no client lifetime.', fix: 'Put the provider in a client component and wrap server children with it; read request data via framework APIs (<code>cookies()</code>, <code>headers()</code>).' }
  ],
  scenarios: [
    { title: 'Product page TTFB 2.4 s because of reviews',
      symptom: 'After moving to the App Router, product pages render nothing for over 2 s. The reviews API p95 is 2.2 s.',
      diagnose: 'The page awaits product, then reviews, then recommendations before returning anything; there are no Suspense boundaries.',
      cause: 'Blocking on the slowest data source for the whole response.',
      fix: 'Render product info immediately; wrap reviews and recommendations in Suspense so they stream. Kick off fetches in parallel.',
      fixCode: `export default async function Page({ params }: { params: Promise<{ id: string }> }) {\n  const { id } = await params;                 // params is async in Next.js 15+\n  const product = await getProduct(id);\n  return (<>\n    <ProductInfo product={product} />\n    <Suspense fallback={<ReviewsSkeleton />}><Reviews id={id} /></Suspense>\n  </>);\n}` },
    { title: 'A user deleted other users’ posts',
      symptom: 'Audit log shows deletions of posts by a user who never owned them; no admin UI was used.',
      diagnose: 'Requests are POSTs to the post page with a <code>Next-Action</code> header, replayed with different ids.',
      cause: 'A server action trusted its arguments and performed no ownership check.',
      fix: 'Check session and ownership inside the action; validate input; add rate limits like any other endpoint.',
      fixCode: `'use server';\nexport async function deletePost(id: string) {\n  const session = await auth();\n  if (!session) throw new Error('Unauthorized');\n  const res = await db.post.deleteMany({ where: { id, authorId: session.user.id } });\n  if (res.count === 0) throw new Error('Not found');\n  revalidatePath('/posts');\n}` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which can a Server Component do?', options: ['useState', 'Attach onClick', 'Be async and await a DB query', 'Read window.localStorage'], answer: 2, explain: 'Server Components may be async and access server resources. State, effects, event handlers and browser APIs belong to Client Components.' },
    { kind: 'concept', q: 'A Client Component file imports another component that has no directive. That imported component is…', options: ['a Server Component', 'a Client Component (part of the client bundle)', 'an error', 'rendered twice'], answer: 1, explain: '<code>\'use client\'</code> marks a module-graph boundary: everything imported from a client module is client code.' },
    { kind: 'concept', q: 'How can a Client Component display Server Component output?', options: ['It imports the Server Component', 'A Server Component passes it as children/props', 'It can’t', 'With useEffect'], answer: 1, explain: 'A client module can’t import a Server Component, but it can receive already-rendered server JSX via props such as <code>children</code>.' },
    { kind: 'concept', q: 'Which prop can NOT be passed from a Server Component to a Client Component?', options: ['A Date', 'A Promise', 'An inline arrow function', 'A plain object'], answer: 2, explain: 'Functions aren’t serialisable (server actions are the exception, passed as references). Promises can be passed and read with <code>use()</code>.' },
    { kind: 'concept', q: 'With a Suspense boundary around a slow component, how many HTTP responses does the initial page load use?', options: ['One, streamed in chunks', 'Two', 'One per boundary', 'It switches to client fetching'], answer: 0, explain: 'The server flushes the shell and fallback first, then streams the resolved content (with a small inline script to swap it in) over the same response.' },
    { kind: 'concept', q: 'What is the RSC payload?', options: ['The HTML page', 'A serialised description of the rendered server tree with references to client components', 'The JS bundle', 'A JSON API response'], answer: 1, explain: 'It’s React’s Flight format. On first load it’s inlined alongside SSR HTML; on client navigations it’s fetched alone and merged into the existing tree, preserving client state.' },
    { kind: 'concept', q: 'Which React 19 hook gives a form’s pending state and the action’s last result?', options: ['useEffect', 'useActionState', 'useMemo', 'useReducer'], answer: 1, explain: '<code>useActionState(action, initial)</code> returns <code>[state, formAction, isPending]</code>. <code>useFormStatus</code> reads the pending state of the parent form.' }
  ],
  interview: [
    { q: 'What are React Server Components, in one minute?', a: '<p>Components that execute only on the server (at build or request time). They can be async, access data sources directly, and their code never ships to the browser. Their output is serialised into the RSC payload. Client Components, marked with <code>\'use client\'</code>, are bundled and hydrated as usual. One tree mixes both.</p>', lvl: 'core' },
    { q: 'How are RSC different from SSR?', a: '<p>SSR renders (client) components to HTML for the initial request; the same code then hydrates. RSC is about <i>which</i> components run where. Server Components render to a payload, not HTML, can be refetched during navigation without a full reload, and never hydrate. In Next.js the RSC payload is <i>also</i> SSR’d to HTML on first load.</p>', lvl: 'core' },
    { q: 'What does <code>\'use client\'</code> really mean?', a: '<p>It’s a boundary in the module graph, not “this renders only in the browser”. Client Components still SSR to HTML on first load. It means: this module and its imports are part of the client bundle and may use state, effects and browser APIs. Props crossing into it from the server must be serialisable.</p>', lvl: 'core' },
    { q: 'Explain streaming with Suspense.', a: '<p>When a component suspends (awaits data), React renders the nearest <code>&lt;Suspense&gt;</code> fallback and keeps going. The server flushes the HTML it has; when the data resolves it streams the completed HTML plus an inline script that replaces the fallback. Boundaries hydrate independently (selective hydration). In Next.js, <code>loading.tsx</code> is a Suspense boundary for a route segment.</p>', lvl: 'deep' },
    { q: 'How do server actions work under the hood?', a: '<p>The bundler replaces a <code>\'use server\'</code> function with a reference containing an action ID. Calling it (or submitting a form whose action is it) sends a POST to the current route with the ID and serialised arguments. The server runs the function and responds with its result and, if revalidated, an updated RSC payload, all in one round-trip.</p>', fu: 'Security: they’re public endpoints; Next.js adds origin checks against CSRF, but you still need auth and validation.', lvl: 'deep' },
    { q: 'What problems do RSC solve, and what do they cost?', a: '<p><b>Solve</b>: less client JS, no client data waterfalls, secrets stay on the server, data fetching colocated with components. <b>Cost</b>: a new mental model (two environments in one tree), framework and bundler coupling, caching complexity, a server is required for dynamic routes, and serialisation constraints.</p>', lvl: 'core' },
    { q: 'How does client navigation work in the App Router?', a: '<p>Links prefetch route segments. On navigation the router fetches the RSC payload for the changed segments only, and React reconciles it into the existing tree, so shared layouts keep their client state (an open sidebar, a playing video). There is no full page reload and no HTML re-download.</p>', lvl: 'deep' },
    { q: 'How do you avoid waterfalls with Server Components?', a: '<p>Start independent fetches in parallel (<code>Promise.all</code>, or start a promise and pass it down to be read with <code>use()</code>), split slow parts into separate Suspense boundaries, and use <code>React.cache</code> to dedupe the same request across components in one render.</p>', lvl: 'deep' },
    { q: 'Which React 19 features pair with RSC?', a: '<ul><li><code>use(promise)</code>: read a promise (or context) while rendering, suspending until it resolves.</li><li>Form actions: <code>&lt;form action={fn}&gt;</code>.</li><li><code>useActionState</code>, <code>useFormStatus</code>, <code>useOptimistic</code> for pending and optimistic UI.</li><li>Native <code>&lt;title&gt;</code>/<code>&lt;meta&gt;</code> hoisting, stylesheet and preload APIs.</li></ul>', lvl: 'core' },
    { q: 'Can you use RSC without Next.js?', a: '<p>Yes in principle: RSC is a React feature that needs bundler and server integration. Next.js App Router is the most mature; React Router (v7) and others have RSC support at various stages, and Vite has an official RSC plugin. Treat non-Next options as newer and check their status before production.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Server + client split', lang: 'ts', code: `// app/products/[id]/page.tsx  (Server Component)
import { AddToCart } from './AddToCart';
import 'server-only';

export default async function Product({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await db.product.findUnique({ where: { id } });   // direct DB access
  return (
    <section>
      <h1>{p!.name}</h1>
      <p>{p!.description}</p>          {/* no JS shipped for this */}
      <AddToCart id={id} price={p!.price} />
    </section>
  );
}

// app/products/[id]/AddToCart.tsx
'use client';
export function AddToCart({ id, price }: { id: string; price: number }) {
  const [qty, setQty] = useState(1);
  return <button onClick={() => add(id, qty)}>Add {qty} × {price}</button>;
}` },
    { title: 'Form + server action + pending state (React 19)', lang: 'ts', code: `// actions.ts
'use server';
import { z } from 'zod';
const Schema = z.object({ email: z.string().email() });

export async function subscribe(prev: { error?: string }, fd: FormData) {
  const parsed = Schema.safeParse({ email: fd.get('email') });
  if (!parsed.success) return { error: 'Invalid e-mail' };
  await db.subscriber.create({ data: parsed.data });
  revalidatePath('/newsletter');
  return {};
}

// Subscribe.tsx
'use client';
import { useActionState } from 'react';
export function Subscribe() {
  const [state, action, pending] = useActionState(subscribe, {});
  return (
    <form action={action}>
      <input name="email" /> <button disabled={pending}>Join</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}` },
    { title: 'Java analogy', lang: 'java', code: `// A Server Component is close to a controller + template that renders on the server…
@GetMapping("/products/{id}")
String product(@PathVariable String id, Model m) {
  m.addAttribute("p", repo.findById(id).orElseThrow());
  return "product";   // HTML; no Java ships to the browser
}
// …and a server action is close to a @PostMapping you didn't have to write by hand,
// which is exactly why it needs the same auth and validation.` }
  ]
});
