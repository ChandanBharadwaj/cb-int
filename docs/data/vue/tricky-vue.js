IA.register({
  track: 'vue',
  slug: 'tricky-vue',
  title: '★ Tricky Vue (timed)',
  tagline: 'Forty “what does this show / does it update / which hook runs” questions from every Vue topic, against the clock. Each one is a trap that makes a Vue UI silently stop updating, update at the wrong time, or leak state.',
  tldr: {
    problem: 'Vue interviews for experienced developers rarely ask you to build a component from scratch. They show a snippet and ask what renders, whether it stays reactive, or in which order things run.',
    model: 'Almost every trick is one of five things: <b>the reactive link</b> (was the value read through a proxy or ref, or copied out?), <b>timing</b> (DOM updates are batched; hooks run in a fixed order), <b>scope</b> (slot content belongs to the parent; inject walks up), <b>one-way data flow</b> (props down, events up, no bubbling), and <b>where code runs</b> (server vs client, per request vs per process).',
    hook: '<code>const { total } = useCartStore()</code> shows 0 forever. If you can explain why in one sentence, start the drill.',
    facts: [
      { v: '40', l: 'questions across all 16 Vue topics, from template syntax to SSR and testing' },
      { v: '60 s', l: 'per question by default. Slow (90 s) and Fast (30 s) modes too' },
      { v: 'Vue 3.5', l: 'is the baseline (Router 4, Pinia 2/3, Nuxt 3/4); version-specific behaviour is called out' }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short snippet or situation, a timer and four answers. Answer in your head, as you would in an interview, then read the explanation. At the end you see your score per topic and a review of every miss, each with a link back to the topic page.',
    analogy: { icon: '⏱️', title: 'Flashcards with a stopwatch', text: 'Reading about reactivity is not the same as spotting, in five seconds, that a destructured prop will never update. Speed comes from having seen the trap before.' },
    steps: [
      { t: 'Ask “is it still reactive?”', d: 'Follow the value: is it read through a <code>reactive</code> proxy, a <code>ref.value</code> or a getter at the moment the effect runs? Destructuring, <code>.value</code> passed to provide, or a primitive passed to <code>watch</code> breaks the link.' },
      { t: 'Ask “when?”', d: 'State changes are synchronous; DOM updates are batched until <code>nextTick</code>. Children mount before parents. Watchers default to pre-flush.' },
      { t: 'Ask “whose scope?”', d: 'Slot content sees the parent. inject finds the nearest ancestor. Component events go to the direct parent only.' },
      { t: 'Ask “where does this run?”', d: 'In SSR, setup runs on the server and the client; module state lives for the whole server process.' }
    ],
    terms: [
      ['auto-unwrap', 'Templates and reactive objects read refs without <code>.value</code> (not inside arrays or Maps).'],
      ['flush', 'When the scheduler runs queued work: pre, post or sync.'],
      ['fallthrough attrs', 'Attributes not declared as props, applied to the component’s root element.'],
      ['hydration', 'The client attaching to server-rendered HTML.'],
      ['stubbed action', 'In tests with <code>createTestingPinia</code>, an action replaced by a spy.']
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a topic (or All), how many questions, and the time per question, then press Start. Skip counts as a miss. At the end, your misses are listed with explanations and links to the topic pages.'
  },
  gotchas: [
    { trap: 'Answering with Vue 2 rules', why: 'Vue 2 needed <code>Vue.set</code> for new keys, had <code>v-for</code> before <code>v-if</code>, used <code>value</code>/<code>input</code> for component v-model, and let events use <code>.native</code>. Vue 3 changed all of these.', fix: 'Say “in Vue 3” and give the Vue 3 behaviour. Mention the Vue 2 difference if it helps.' },
    { trap: 'Forgetting the version for newer features', why: '<code>defineModel</code> (stable 3.4), reactive props destructure and <code>useId</code> (3.5), lazy hydration (3.5), Nuxt 4’s <code>app/</code> directory: interviewers may use an older version at work.', fix: 'Name the version when you use one: “in 3.5 you can destructure props reactively; before that, use <code>toRefs</code>”.' },
    { trap: 'Guessing instead of reasoning out loud', why: 'An interviewer learns more from “the getter returns the same object, so nothing is tracked” than from a lucky correct letter.', fix: 'State the rule, apply it to the snippet, then answer.' }
  ],
  interview: [
    { q: 'How do you approach a “does this update?” question?', a: '<p>Trace the value from the write to the reader: is the reader running inside an effect (template, computed, watch)? Did it read the value <i>through</i> a proxy or ref at that time? Is the write a real change (<code>Object.is</code>) on the same object the reader tracked? If any link is a copy, it does not update.</p>', lvl: 'core' },
    { q: 'How do you approach an ordering question?', a: '<p>Separate state from DOM: state changes immediately, DOM after the scheduler flush (<code>nextTick</code>). Then apply the fixed orders: setup → children setup/mount → parent mounted; watchers <code>pre</code> before render, <code>post</code> after; router guards leave → beforeEach → beforeEnter → beforeResolve → afterEach.</p>', lvl: 'core' },
    { q: 'Which three Vue traps cause the most production bugs?', a: '<p>1) Lost reactivity: destructuring stores, props or reactive objects; providing <code>.value</code>. 2) Stale data on reused route components (onMounted does not rerun). 3) SSR state leaking through module-level refs or a shared Pinia instance.</p>', lvl: 'core' },
    { q: 'How do you verify a tricky claim quickly?', a: '<p>The Vue SFC Playground (play.vuejs.org) runs a single-file component in the browser and lets you switch Vue versions. For router or Pinia behaviour, a minimal Vitest test with <code>createMemoryHistory</code> or <code>createPinia</code>.</p>', lvl: 'core' },
    { q: 'You do not know the answer. What do you say?', a: '<p>Narrow it down: “It depends on whether the getter tracks a property. Here it returns the proxy without reading a key, so I believe nothing is tracked and the callback does not run. I would confirm with <code>{ deep: true }</code> in the playground.”</p>', lvl: 'core' }
  ]
});
