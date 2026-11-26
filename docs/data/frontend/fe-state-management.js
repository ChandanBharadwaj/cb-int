IA.register({
  track: 'frontend',
  slug: 'fe-state-management',
  title: 'State management',
  tagline: 'Most “state management” pain comes from treating all state the same. Split it: <b>local UI state</b> stays in components, <b>global client state</b> goes in a small store, and <b>server state</b> is a cache, owned by a tool like <b>TanStack Query</b>.',
  tldr: {
    problem: 'Apps with a giant Redux store that mirrors the backend, hand-written loading flags everywhere, stale data after mutations, and every keystroke re-rendering half the page.',
    model: '<b>Local</b>: <code>useState</code>/<code>ref</code>, owned by one component. <b>Global client</b>: theme, cart, auth session, in a store with selectors (Zustand, Pinia, Redux Toolkit, signals). <b>Server</b>: data owned by the backend, cached with keys, staleness, background refetch and invalidation. Also: <b>URL state</b> (filters, page) and <b>form state</b>.',
    hook: '“Redux or Context?” Wrong question. First ask which state is server state: move it into a query cache, and what’s left is usually small enough for local state, Context or a tiny store.',
    facts: [
      { v: 'staleTime 0', l: 'TanStack Query’s default: cached data is immediately considered stale and refetched on mount, window focus and reconnect' },
      { v: 'gcTime 5 min', l: 'how long inactive query data stays in cache by default (renamed from <code>cacheTime</code> in TanStack Query v5)' },
      { v: 'Pinia', l: 'is Vue’s official store, replacing Vuex; Redux Toolkit (with RTK Query) is the recommended way to write Redux' }
    ]
  },
  intro: {
    what: '<b>State</b> is any data that can change while the app runs and that the UI depends on: a text field’s value, whether a modal is open, the logged-in user, the list of orders. The hard parts are deciding <b>where</b> each piece lives, <b>who</b> may change it, and how to keep copies <b>in sync</b>, especially copies of server data.',
    analogy: { icon: '🏢', title: 'An office', text: 'Your sticky notes are local state: only you use them. The whiteboard in the hall is the global store: everyone can read it, and writes should go through a clear process. The company database is the server; the printouts on desks are a cache of it. Printouts go stale, so you need a rule for when to print again.' },
    steps: [
      { t: 'Start local', d: 'Keep state in the component that uses it. Lift it to the nearest common parent only when siblings need it.', code: 'const [open, setOpen] = useState(false);', lang: 'ts' },
      { t: 'Global client state', d: 'For data many distant components need (theme, cart), use Context for rarely-changing values, or a store with selectors for frequently-changing ones.' },
      { t: 'Server state is different', d: 'It’s remote, shared, can change without you, and can be stale. It needs caching, deduplication, retries and invalidation.' },
      { t: 'Use a query cache', d: 'TanStack Query (React, Vue, Solid, Svelte, Angular), SWR, RTK Query, Apollo for GraphQL.', code: "const { data, isPending } = useQuery({ queryKey: ['orders'], queryFn: getOrders });", lang: 'ts' },
      { t: 'Put shareable state in the URL', d: 'Filters, tabs and pagination in the query string survive reloads and can be shared as links.' }
    ],
    terms: [
      ['local state', 'Owned by one component (<code>useState</code>, Vue <code>ref</code>).'],
      ['prop drilling', 'Passing props through layers that don’t use them, just to reach a deep child.'],
      ['store', 'An object outside the component tree holding shared state, with subscriptions.'],
      ['selector', 'A function that picks part of the store; components re-render only when it changes.'],
      ['server state', 'A client-side cache of data whose source of truth is the backend.'],
      ['invalidation', 'Marking cached data as stale so it gets refetched.']
    ]
  },
  visual: {
    title: 'Three kinds of state',
    caption: 'Pick <b>Local</b>, <b>Global store</b> or <b>Server state</b> and press Play. Watch which components re-render and how the query cache dedupes, goes stale and is invalidated after a mutation.'
  },
  gotchas: [
    { trap: 'Copying server data into a global store', code: `useEffect(() => {\n  fetch('/api/orders').then(r => r.json()).then(o => dispatch(setOrders(o)));\n}, []);`, why: 'Now you own caching, loading and error flags, deduplication, refetching and invalidation, and every screen can show a different version of the truth.', fix: 'Let a query cache own it (<code>useQuery</code>); keep the store for client-only state.' },
    { trap: 'One big Context for everything', code: `<AppContext.Provider value={{ user, theme, cart, setCart }}>   // new object each render`, why: 'Every consumer re-renders when any part of the value changes, and an inline object literal changes on every render of the provider.', fix: 'Split contexts by concern, memoise the value, or use a store with selectors for frequently-changing data.' },
    { trap: 'Selectors that return new objects', code: `const { items, total } = useCart(s => ({ items: s.items, total: s.total })); // re-renders every time`, why: 'Stores compare selector results by reference. A fresh object is never equal, so every store update re-renders the component (and with <code>useSyncExternalStore</code> can even loop).', fix: 'Select primitives separately, or use a shallow-equality helper (Zustand’s <code>useShallow</code>).' },
    { trap: 'Unstable or incomplete query keys', code: `useQuery({ queryKey: ['orders'], queryFn: () => getOrders(page) });   // page missing from key`, why: 'The key is the cache identity. If a variable the fetch depends on isn’t in the key, page 2 shows page 1’s cached data.', fix: 'Put every input of <code>queryFn</code> in the key: <code>[\'orders\', { page, status }]</code>. The ESLint plugin catches this.' },
    { trap: 'Deriving state into state', code: `const [items, setItems] = useState([]);\nconst [count, setCount] = useState(0);   // always items.length… until it isn't`, why: 'Two sources of truth drift apart when one update forgets the other.', fix: 'Compute derived values during render (or with <code>computed</code>). Store the minimum.' },
    { trap: 'Duplicating URL state in component state', why: 'Filters held in <code>useState</code> are lost on reload and break the back button and shared links.', fix: 'Read and write them from the URL (router search params, nuqs, Vue Router query).' }
  ],
  scenarios: [
    { title: 'Order list shows the old status after “Cancel order”',
      symptom: 'Users cancel an order, see a success toast, but the list still says “Paid” until they reload.',
      diagnose: 'The mutation calls the API but nothing invalidates the cached <code>[\'orders\']</code> query; <code>staleTime</code> is set to 10 minutes.',
      cause: 'A server-state cache that is never told the server changed.',
      fix: 'Invalidate (or update) the affected queries on mutation success. For instant feedback add an optimistic update with rollback.',
      fixCode: `const qc = useQueryClient();\nconst cancel = useMutation({\n  mutationFn: (id: string) => api.cancel(id),\n  onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),\n});` },
    { title: 'Typing in the header search re-renders the whole app',
      symptom: 'Input lag on low-end laptops; the Profiler highlights hundreds of components on every keystroke.',
      diagnose: 'The search text lives in a top-level Context whose value object also holds user and cart.',
      cause: 'High-frequency local state placed in a wide, unsplit context.',
      fix: 'Keep the input value local to the search box; publish only the debounced query (to the URL or a store slice) for consumers.',
      fixCode: `function SearchBox() {\n  const [text, setText] = useState('');\n  const setQuery = useSearch(s => s.setQuery);\n  useEffect(() => { const t = setTimeout(() => setQuery(text), 250); return () => clearTimeout(t); }, [text]);\n  return <input value={text} onChange={e => setText(e.target.value)} />;\n}` },
    { title: 'Dashboard hammers the API: 40 requests on load',
      symptom: 'The backend sees the same <code>GET /api/me</code> 12 times per page view.',
      diagnose: 'Twelve components each call <code>fetch(\'/api/me\')</code> in their own <code>useEffect</code>.',
      cause: 'No shared cache or request deduplication.',
      fix: 'A shared <code>useMe()</code> hook built on <code>useQuery({ queryKey: [\'me\'] })</code>: concurrent calls with the same key share one request, and the result is cached.',
      fixCode: `export const useMe = () => useQuery({ queryKey: ['me'], queryFn: api.me, staleTime: 5 * 60_000 });` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which of these is server state?', options: ['Whether a dropdown is open', 'The dark-mode toggle', 'The list of the user’s invoices', 'Current step of a wizard'], answer: 2, explain: 'Invoices live in the backend; the client holds a possibly stale copy. The others are client state.' },
    { kind: 'concept', q: 'With TanStack Query defaults, a component using <code>[\'todos\']</code> unmounts and remounts 30 s later. What happens?', options: ['A loading spinner and a fresh fetch', 'Cached data shows immediately and a background refetch runs', 'Cached data shows, no refetch', 'An error'], answer: 1, explain: 'Data is still in cache (gcTime 5 min) but stale (staleTime 0), so it’s shown instantly and refetched in the background.' },
    { kind: 'concept', q: 'Three components mount at the same time, all with <code>useQuery({ queryKey: [\'me\'] })</code>. How many network requests?', options: ['3', '1', '0', 'Depends on staleTime'], answer: 1, explain: 'Queries with the same key share one in-flight request; all three subscribe to the same cache entry.' },
    { kind: 'concept', q: 'What is the difference between <code>staleTime</code> and <code>gcTime</code>?', options: ['They are synonyms', 'staleTime: how long data counts as fresh; gcTime: how long unused data stays in memory', 'staleTime is for mutations', 'gcTime controls retries'], answer: 1, explain: 'Fresh data is never refetched automatically. Stale data is served but refetched on triggers. Inactive entries are garbage-collected after gcTime.' },
    { kind: 'concept', q: 'A Zustand component uses <code>useStore(s => s.cart.items.length)</code>. Another part of the store (theme) changes. Does it re-render?', options: ['Yes, any store change re-renders', 'No, the selected value is unchanged', 'Only in development', 'Only if wrapped in memo'], answer: 1, explain: 'The selector result (a number) is compared with the previous one; equal values skip the render.' },
    { kind: 'concept', q: 'Where should a product list’s sort order and page number live?', options: ['localStorage', 'A global store', 'The URL query string', 'A ref'], answer: 2, explain: 'URL state survives reloads, works with back/forward and can be shared. Use the router’s search params as the source of truth.' },
    { kind: 'concept', q: 'Why is React Context alone a poor fit for a frequently-updated global value?', options: ['It can’t hold objects', 'All consumers re-render on every change, with no selector to subscribe to a slice', 'It’s deprecated', 'It only works in class components'], answer: 1, explain: 'Context is a dependency-injection mechanism, not a store. It’s fine for rarely-changing values (theme, locale, user). For hot data use a store with selectors or <code>useSyncExternalStore</code>.' }
  ],
  interview: [
    { q: 'How do you categorise state in a frontend app?', a: '<ul><li><b>Local UI</b>: one component (inputs, toggles).</li><li><b>Shared client</b>: across the app (theme, cart, session).</li><li><b>Server</b>: cached remote data.</li><li><b>URL</b>: navigation-relevant (filters, ids).</li><li><b>Form</b>: drafts, validation (React Hook Form, Vue forms, native forms).</li></ul><p>Each has a natural owner and tool.</p>', lvl: 'core' },
    { q: 'What does a server-state library give you over <code>useEffect</code> + fetch?', a: '<p>Caching by key, request deduplication, background refetch (on focus, reconnect, interval), stale-while-revalidate, retries with backoff, pagination and infinite queries, mutation helpers with invalidation and optimistic updates, cancellation, SSR hydration of the cache, and devtools. It also avoids race conditions where an older response overwrites a newer one.</p>', lvl: 'core' },
    { q: 'Explain optimistic updates and how to roll back.', a: '<p>Update the cache before the server confirms, so the UI feels instant. In TanStack Query: in <code>onMutate</code> cancel outgoing refetches, snapshot the previous data, write the optimistic value and return the snapshot; in <code>onError</code> restore it; in <code>onSettled</code> invalidate to resync. React 19’s <code>useOptimistic</code> covers the simple form-action case.</p>', lvl: 'deep' },
    { q: 'Redux, Zustand, Pinia, signals: how do you choose?', a: '<p><b>Redux Toolkit</b>: explicit actions, middleware, time-travel devtools, good for large teams wanting strict patterns; RTK Query adds server state. <b>Zustand</b>: minimal hook-based store with selectors. <b>Pinia</b>: Vue’s official store, built on Vue reactivity. <b>Signals/atoms</b> (Jotai, Preact Signals, Nano Stores): fine-grained, bottom-up. After moving server state out, the remaining store is usually small, so pick the simplest that fits.</p>', lvl: 'core' },
    { q: 'Why does a store need selectors?', a: '<p>To limit re-renders. A component should subscribe to the smallest derived value it uses; the store compares old and new selector results and skips unchanged ones. Without selectors every store change re-renders every subscriber.</p>', lvl: 'core' },
    { q: 'What is <code>useSyncExternalStore</code> for?', a: '<p>It’s React’s official way to subscribe to an external store (Redux, Zustand, browser APIs) safely under concurrent rendering, avoiding “tearing”, where different components show different versions of the store in the same render. <code>getSnapshot</code> must return a cached value when nothing changed.</p>', lvl: 'deep' },
    { q: 'How do query caches work with SSR and Server Components?', a: '<p>With SSR, you prefetch queries on the server into a QueryClient, dehydrate the cache into the HTML, and hydrate it on the client so the first render has data with no fetch. With RSC, you often fetch in Server Components directly and use a query cache only for client-side interactive data, mutations and polling.</p>', lvl: 'deep' },
    { q: 'How do you avoid race conditions in data fetching?', a: '<p>When inputs change quickly (typing), responses can arrive out of order. Query libraries key responses by input and ignore results for keys no longer observed; with raw fetch, use an <code>AbortController</code> in the effect cleanup or an “ignore” flag.</p>', lvl: 'core' },
    { q: 'State machines: when are they worth it?', a: '<p>When a component has many interdependent booleans (<code>isLoading</code>, <code>isError</code>, <code>isRetrying</code>…) that allow impossible combinations. A discriminated union or a statechart (XState) makes only valid states representable, like an enum-based state pattern in Java.</p>', lvl: 'deep' },
    { q: 'What’s the backend analogy for server state?', a: '<p>It’s a read-through cache with TTLs, like Caffeine or Redis in front of a service: <code>staleTime</code> ≈ TTL, invalidation after writes ≈ cache eviction on update, deduplication ≈ request coalescing. The same rules apply: one source of truth, explicit invalidation, bounded staleness.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'TanStack Query v5: query + mutation with invalidation', lang: 'ts', code: `export function useOrders(page: number) {
  return useQuery({
    queryKey: ['orders', { page }],
    queryFn: ({ signal }) => api.orders(page, { signal }),   // cancellable
    staleTime: 30_000,
    placeholderData: keepPreviousData,                        // no flicker between pages
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.cancelOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),  // prefix match
  });
}` },
    { title: 'Zustand store with selectors', lang: 'ts', code: `type Cart = { items: Item[]; add(i: Item): void; clear(): void };
export const useCart = create<Cart>()((set) => ({
  items: [],
  add: (i) => set((s) => ({ items: [...s.items, i] })),
  clear: () => set({ items: [] }),
}));

const count = useCart((s) => s.items.length);      // re-renders only when the count changes
const add = useCart((s) => s.add);                  // stable function reference` },
    { title: 'Pinia (Vue) setup store', lang: 'ts', code: `export const useCartStore = defineStore('cart', () => {
  const items = ref<Item[]>([]);
  const total = computed(() => items.value.reduce((s, i) => s + i.price, 0));
  function add(i: Item) { items.value.push(i); }      // Vue reactivity tracks the push
  return { items, total, add };
});` }
  ]
});
