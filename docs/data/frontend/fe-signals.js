IA.register({
  track: 'frontend',
  slug: 'fe-signals',
  title: 'Signals & fine-grained reactivity',
  tagline: 'A <b>signal</b> is a value that knows who reads it. Change it and only the exact computations and DOM nodes that depend on it update, with no component re-render and no virtual-DOM diff. Solid, Vue, Angular, Preact and Svelte 5 all use them; a TC39 proposal wants them in JavaScript itself.',
  tldr: {
    problem: 'In a VDOM framework, changing one number re-runs the component and its children and diffs the result. Usually fine; but in large trees it causes wasted renders, and memoisation becomes a manual chore.',
    model: 'Three primitives: <b>signal</b> (writable value), <b>computed</b> (derived, cached, lazy), <b>effect</b> (side effect that re-runs on change). Reads are <b>tracked automatically</b> at run time to build a dependency graph. Writes <b>push</b> “dirty” marks; reads <b>pull</b> fresh values, which gives glitch-free, minimal updates.',
    hook: '“Signals vs React state?” React tracks state per component and re-renders to find what changed. Signals track per value and update exactly what depends on it, so the work is proportional to the change, not to the tree.',
    facts: [
      { v: 'Stage 1', l: 'the TC39 Signals proposal (<code>Signal.State</code>, <code>Signal.Computed</code>, <code>Signal.subtle.Watcher</code>), entered in April 2024; no browser ships it yet, a polyfill exists' },
      { v: 'Angular 17', l: 'made <code>signal()</code>/<code>computed()</code> stable (preview in 16); <code>effect()</code> and related APIs became stable in Angular 20' },
      { v: 'Vue 3.0', l: 'already had signal-style <code>ref</code>/<code>computed</code>; Vue 3.5 reworked the reactivity core for lower memory and faster updates' }
    ]
  },
  intro: {
    what: 'UI is a function of state. The question every framework answers is: when state changes, how do we find which parts of the screen to update? <b>Signals</b> answer it by recording, while code runs, which values each piece of UI reads. Later, a change to a value goes straight to its readers. It’s like the Observer pattern in Java, but subscriptions are created automatically by just reading the value.',
    analogy: { icon: '📊', title: 'A spreadsheet', text: 'Cell A1 holds 5. B1 is <code>=A1*2</code>. A chart uses B1. Change A1 and Excel recomputes only B1 and redraws only that chart, not the whole workbook. A1 is a signal, B1 is a computed, the chart is an effect. A VDOM framework is more like re-printing the sheet and comparing it with the old printout.' },
    steps: [
      { t: 'Signal', d: 'A box with a value. Reading it inside a tracked context subscribes the reader.', code: 'const count = signal(0);\ncount.value;      // read (tracked)\ncount.value = 1;  // write (notifies)', lang: 'ts' },
      { t: 'Computed', d: 'A derived value, cached until one of its sources changes, and recomputed lazily when read.', code: 'const double = computed(() => count.value * 2);', lang: 'ts' },
      { t: 'Effect', d: 'Code that runs again whenever something it read changes. Frameworks turn templates into many small effects bound to DOM nodes.', code: 'effect(() => { el.textContent = String(double.value); });', lang: 'ts' },
      { t: 'Automatic tracking', d: 'No dependency arrays: the graph is whatever was read on the last run, so conditional reads are handled.' },
      { t: 'Batching and glitch-free updates', d: 'Several writes are batched; effects run once, after the graph is consistent.' }
    ],
    terms: [
      ['signal', 'A reactive value cell with tracked reads and notifying writes.'],
      ['computed / memo / derived', 'A cached, lazily recomputed function of signals.'],
      ['effect', 'A reaction that re-runs when its dependencies change.'],
      ['fine-grained reactivity', 'Updates at the level of individual values and DOM nodes, not components.'],
      ['glitch', 'An effect observing a mix of old and new values during propagation.'],
      ['push-pull', 'Writes push invalidation; reads pull and recompute only what’s needed.']
    ]
  },
  visual: {
    title: 'What re-runs when count changes',
    caption: 'Compare <b>Signals</b> with a <b>VDOM</b> re-render, then try the <b>Diamond</b> to see why push-pull evaluation avoids glitches. Press Play or Step.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Tiny signals (simulation)', code: `// A ~40-line signals library: automatic tracking, lazy computeds, batched effects.
// Educational only: real libraries also handle cleanup, cycles and ownership.
let current = null;            // the computation currently running
const queue = new Set(); let batching = 0;

function signal(v) {
  const subs = new Set();
  return {
    get value() { if (current) { subs.add(current); current.deps.add(subs); } return v; },
    set value(nv) { if (Object.is(nv, v)) return; v = nv; [...subs].forEach(s => s.mark()); flush(); },
  };
}
function computed(fn) {
  const subs = new Set(); let v, dirty = true;
  const node = { deps: new Set(), mark() { if (!dirty) { dirty = true; [...subs].forEach(s => s.mark()); } } };
  return { get value() {
    if (current) { subs.add(current); current.deps.add(subs); }
    if (dirty) { node.deps.forEach(d => d.delete(node)); node.deps.clear();
      const prev = current; current = node; try { v = fn(); } finally { current = prev; } dirty = false; }
    return v; } };
}
function effect(fn) {
  const node = { deps: new Set(), mark() { queue.add(node); }, run() {
    node.deps.forEach(d => d.delete(node)); node.deps.clear();
    const prev = current; current = node; try { fn(); } finally { current = prev; } } };
  node.run();
}
function flush() { if (batching) return; const q = [...queue]; queue.clear(); q.forEach(n => n.run()); }
function batch(fn) { batching++; try { fn(); } finally { batching--; flush(); } }

// --- demo ---
const first = signal('bob'), last = signal('lee');
let fullRuns = 0;
const full = computed(() => { fullRuns++; return first.value + ' ' + last.value; });
const upper = computed(() => first.value.toUpperCase());
effect(() => console.log('effect:', full.value, '/', upper.value));

first.value = 'ann';                       // effect runs once, consistent values
batch(() => { first.value = 'cy'; last.value = 'wu'; });   // two writes, one effect run
last.value = 'wu';                         // same value: nothing happens
console.log('full computed ran', fullRuns, 'times');`, note: 'Expected: three effect lines (bob lee / BOB, ann lee / ANN, cy wu / CY), then “full computed ran 3 times”.' },
      { label: 'Conditional dependencies', code: `// Dependencies are whatever was read on the LAST run.
let current = null;
function signal(v) { const subs = new Set();
  return { get value() { if (current) subs.add(current); return v; },
           set value(n) { v = n; [...subs].forEach(f => f()); }, subs }; }
function effect(fn) { const run = () => { current = run; fn(); current = null; }; run(); }

const showDetails = signal(false), details = signal('v1');
effect(() => console.log(showDetails.value ? 'details: ' + details.value : 'hidden'));
details.value = 'v2';      // not read on the last run → no re-run
showDetails.value = true;  // re-runs, and now details IS read
details.value = 'v3';      // re-runs
// prints: hidden, details: v2, details: v3`, note: 'This simpler toy skips cleanup, so stale subscriptions would linger: that is why real libraries clear dependencies before every re-run (as the first preset does).' }
    ]
  },
  gotchas: [
    { trap: 'Destructuring loses reactivity', code: `// Solid\nfunction Price(props) {\n  const { amount } = props;     // read once, never updates\n  return <b>{amount}</b>;\n}\n// Vue\nconst { count } = reactive(state);   // plain number now`, why: 'Reactivity lives in the read (a getter or function call). Copying the value out reads it once, outside any tracking context.', fix: 'Solid: read <code>props.amount</code> in JSX, or use <code>splitProps</code>. Vue: <code>toRefs(state)</code> or keep <code>state.count</code>.' },
    { trap: 'Writing signals inside computeds', why: 'A computed should be a pure function. Writing state inside it creates hidden cycles and ordering bugs; Angular disallows it by default.', fix: 'Derive with computed, write in event handlers or effects. In Angular, consider <code>linkedSignal</code> for writable derived state.' },
    { trap: 'Using effects to sync state', code: `effect(() => { total.set(price() * qty()); });   // ✗\nconst total = computed(() => price() * qty());    // ✓`, why: 'An effect that copies one signal into another runs after the change, so there is a moment where they disagree, plus an extra update pass.', fix: 'Use computed for anything derivable. Effects are for the outside world: DOM, logging, network, storage.' },
    { trap: 'Mutating objects in place', code: `const user = signal({ name: 'a' });\nuser().name = 'b';           // Angular/Solid: no notification`, why: 'Plain signals compare by identity (<code>Object.is</code>). Mutating the object keeps the same reference, so nobody is notified. (Vue’s <code>reactive</code> uses Proxies and does track deep mutation.)', fix: 'Replace immutably: <code>user.update(u =&gt; ({ ...u, name: \'b\' }))</code>, or use a store/proxy designed for nested data.' },
    { trap: 'Reading untracked when you meant tracked (and vice versa)', why: 'Reads in a <code>setTimeout</code>, after an <code>await</code>, or in an event handler are not tracked. Reads you don’t want to track (logging inside an effect) create extra dependencies.', fix: 'Read signals synchronously at the start of the effect. Use <code>untrack()</code>/<code>untracked()</code> for deliberate non-dependencies.' }
  ],
  scenarios: [
    { title: 'Typing in a search box lags in a 5,000-row grid (React)',
      symptom: 'Each keystroke takes 120 ms; the Profiler shows every row re-rendering although only the filter text changed.',
      diagnose: 'State lives in the grid’s parent; each update re-renders all rows, and inline object props defeat <code>memo</code>.',
      cause: 'Component-granular updates on a wide tree.',
      fix: 'Short term: memoise rows (or enable React Compiler), keep the input state local, and use <code>useDeferredValue</code> for the filter. Alternative: a store with selectors, or a signals-based grid component where cells subscribe to their own values.',
      fixCode: `const deferred = useDeferredValue(query);\nconst rows = useMemo(() => filter(all, deferred), [all, deferred]);\nreturn <Grid rows={rows} />;   // Row is memo()'d` },
    { title: 'Angular effect loop pegs the CPU',
      symptom: 'After a refactor to signals, a page freezes; the console shows change detection running thousands of times.',
      diagnose: 'An <code>effect()</code> reads <code>items()</code> and writes <code>items.set([...])</code> to “normalise” it.',
      cause: 'An effect that writes to a signal it depends on: each run schedules another.',
      fix: 'Make the normalised value a <code>computed()</code>. Keep effects for side effects only.',
      fixCode: `readonly items = signal<Item[]>([]);\nreadonly sorted = computed(() => [...this.items()].sort(byName));` }
  ],
  puzzles: [
    { kind: 'concept', q: 'A computed is defined but never read by anything. Its source signal changes 10 times. How many times does the computed function run (in Solid, Vue, Angular or Preact)?', options: ['10', '1', '0', '11'], answer: 2, explain: 'Computeds are lazy: they only (re)compute when read. Nobody reads it, so it never runs.' },
    { kind: 'concept', q: 'Why don’t signals need dependency arrays like React’s <code>useEffect(fn, [a, b])</code>?', options: ['They re-run on every change anywhere', 'Dependencies are recorded automatically when signals are read during execution', 'The compiler guesses them', 'They do need them'], answer: 1, explain: 'Each run records which signals were read; that set becomes the dependency list for the next change. Conditional reads are handled naturally.' },
    { kind: 'concept', q: 'In the diamond <code>a → b, a → c, (b, c) → effect</code>, what does “glitch-free” guarantee when <code>a</code> changes?', options: ['The effect never runs', 'The effect runs once and sees both b and c updated', 'b and c update in alphabetical order', 'The effect runs twice'], answer: 1, explain: 'Push-pull propagation marks nodes dirty first and evaluates in dependency order when read, so the effect never sees b new and c old.' },
    { kind: 'concept', q: 'Setting a signal to the value it already has (a primitive)…', options: ['always notifies', 'is skipped by the default equality check', 'throws', 'clears subscribers'], answer: 1, explain: 'Signals compare with <code>Object.is</code> (configurable via an <code>equals</code> option in most libraries), so equal writes don’t propagate.' },
    { kind: 'concept', q: 'What is the status of the TC39 Signals proposal?', options: ['Shipped in ES2025', 'Stage 1: an API design in progress, with a polyfill; not in browsers', 'Rejected', 'Stage 4'], answer: 1, explain: 'It reached Stage 1 in April 2024, aiming for a shared core that frameworks can build on (with <code>Signal.subtle.Watcher</code> for scheduling effects). Check the proposal repo for its current stage.' },
    { kind: 'concept', q: 'Which framework is NOT built on signal-style fine-grained reactivity?', options: ['Solid', 'Vue', 'React', 'Svelte 5 (runes)'], answer: 2, explain: 'React re-renders components and reconciles a virtual DOM. Solid, Vue (refs), Svelte 5 (<code>$state</code>/<code>$derived</code>) and Angular (signals) use fine-grained reactivity.' }
  ],
  interview: [
    { q: 'What is a signal?', a: '<p>A reactive primitive holding a value. Reads in a tracking context (a computed, an effect, a template) register a dependency; writes notify dependents. With computed values and effects it forms a dependency graph that updates only what depends on a change.</p>', lvl: 'core' },
    { q: 'Signals vs virtual DOM: trade-offs?', a: '<p><b>VDOM</b>: simple mental model (UI = f(state), re-run and diff); cost grows with subtree size; needs memoisation to avoid waste. <b>Signals</b>: updates proportional to what changed, no diff; but reactivity rules (don’t destructure, read in tracked scope) and debugging a graph instead of a call stack. Many signal frameworks also compile templates to direct DOM writes (Solid, Svelte, Vue Vapor mode).</p>', lvl: 'core' },
    { q: 'Explain push-pull evaluation.', a: '<p>On write, the system pushes a cheap “dirty/check” flag through dependents without computing anything. Effects are scheduled. When an effect (or anyone) reads a computed, it pulls: checks whether its sources really changed, recomputes if needed, and caches. This gives laziness (unused computeds never run), glitch-freedom, and skips work when a recomputed value is unchanged.</p>', lvl: 'deep' },
    { q: 'How do Solid, Vue and Angular expose signals?', a: '<ul><li><b>Solid</b>: <code>createSignal</code> returns a getter/setter pair; <code>createMemo</code>, <code>createEffect</code>. Components run once; JSX compiles to effects bound to DOM nodes.</li><li><b>Vue</b>: <code>ref()</code> (<code>.value</code>), <code>reactive()</code> (Proxy), <code>computed()</code>, <code>watchEffect()</code>. Templates track reads per component render; Vapor mode (Vue 3.6, in development) compiles to fine-grained DOM updates.</li><li><b>Angular</b>: <code>signal()</code>, <code>computed()</code>, <code>effect()</code>, signal inputs <code>input()</code>, <code>linkedSignal</code>, <code>resource()</code>; signals enable zoneless change detection.</li></ul>', lvl: 'core' },
    { q: 'Why is Angular moving to signals?', a: '<p>Classic Angular used Zone.js to patch async APIs and then dirty-check the component tree after any async event. Signals tell Angular exactly which components read changed values, allowing targeted change detection and removing Zone.js (zoneless, stable in recent versions). It also improves interop with RxJS via <code>toSignal</code>/<code>toObservable</code>.</p>', lvl: 'deep' },
    { q: 'What does the TC39 Signals proposal include and exclude?', a: '<p>It proposes <code>Signal.State</code> and <code>Signal.Computed</code> with automatic tracking and glitch-free, lazy evaluation, plus low-level <code>Signal.subtle</code> APIs (like <code>Watcher</code>) for frameworks to build effects and scheduling. It deliberately leaves out an effect API, since scheduling is framework-specific. Authors include contributors from Angular, Vue, Solid, Preact, Svelte, Ember and others. It’s Stage 1, so the API may change.</p>', lvl: 'deep' },
    { q: 'What is a glitch, and how do libraries avoid it?', a: '<p>A glitch is an observer seeing an intermediate, inconsistent state, e.g. an effect using a new <code>fullName</code> with an old <code>initials</code>. Libraries avoid it by marking dirty first and evaluating lazily in topological order, and by batching effects to run after propagation completes.</p>', lvl: 'deep' },
    { q: 'Is React adopting signals?', a: '<p>Not as its model. React keeps component re-rendering and addresses waste with the <b>React Compiler</b> (1.0 in Oct 2025), which auto-memoises components and values at build time. You can still use signal libraries (Preact Signals, MobX, Jotai-like atoms) in React through external-store hooks like <code>useSyncExternalStore</code>.</p>', lvl: 'core' },
    { q: 'How do signals compare to RxJS Observables?', a: '<p>Signals always have a current value, are synchronous to read, and are pull-based for derived values: good for state. Observables are push-based streams of events over time, with operators for async orchestration (debounce, switchMap): good for events. Angular now recommends signals for state and RxJS for event streams, bridging with <code>toSignal</code>.</p>', lvl: 'deep' },
    { q: 'How do you debug a signals app?', a: '<p>Framework devtools show the dependency graph (Vue devtools, Angular DevTools signal graph, Solid devtools). In code: <code>onTrack</code>/<code>onTrigger</code> debug hooks on Vue computeds and watchers, logging inside effects, and <code>untrack</code> to remove accidental dependencies.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Same counter, three frameworks', lang: 'ts', code: `// Solid
const [count, setCount] = createSignal(0);
const double = createMemo(() => count() * 2);
<button onClick={() => setCount(c => c + 1)}>{double()}</button>;

// Vue (script setup)
const count = ref(0);
const double = computed(() => count.value * 2);
// <button @click="count++">{{ double }}</button>

// Angular (17+)
@Component({ selector: 'app-counter', template: '<button (click)="inc()">{{ double() }}</button>' })
export class Counter {
  count = signal(0);
  double = computed(() => this.count() * 2);
  inc() { this.count.update(c => c + 1); }
}` },
    { title: 'TC39 proposal shape (polyfill)', lang: 'ts', code: `import { Signal } from 'signal-polyfill';   // Stage 1: API may change

const counter = new Signal.State(0);
const isEven = new Signal.Computed(() => (counter.get() & 1) === 0);

// effects are built by frameworks on top of Watcher
const w = new Signal.subtle.Watcher(() => queueMicrotask(processPending));
w.watch(isEven);
counter.set(1);` , note: 'The proposal deliberately has no built-in <code>effect()</code>; scheduling is left to frameworks.' },
    { title: 'Angular: signals + RxJS interop', lang: 'ts', code: `export class Search {
  private http = inject(HttpClient);
  query = signal('');
  // event stream → debounce → signal
  results = toSignal(
    toObservable(this.query).pipe(debounceTime(250), switchMap(q => this.http.get<Hit[]>('/api?q=' + q))),
    { initialValue: [] }
  );
}` }
  ]
});
