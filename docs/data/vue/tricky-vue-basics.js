IA.register({
  track: 'vue',
  slug: 'tricky-vue-basics',
  title: 'Basics drill (timed)',
  tagline: 'Thirty first-interview Vue questions from the six Basics topics, against the clock: what Vue is, Vite setup, templates, ref and reactive, computed and watch, and components.',
  tldr: {
    problem: 'A first Vue interview checks that you know the everyday building blocks without looking them up: what a directive does, when you need <code>.value</code>, how a child talks to its parent.',
    model: 'Most basics questions are one of four ideas: <b>templates are declarative</b> (interpolation, <code>:</code> binds, <code>@</code> listens), <b>refs hold state</b> (<code>.value</code> in script, unwrapped in templates), <b>computed derives, watch reacts</b>, and <b>props down, events up</b>.',
    hook: '<code>&lt;Rating max="5" /&gt;</code> and <code>&lt;Rating :max="5" /&gt;</code> pass different types. If you know which is which, start the drill.',
    facts: [
      { v: '30', l: 'questions, 5 from each of the 6 Basics topics' },
      { v: '60 s', l: 'per question by default. Slow (90 s) and Fast (30 s) modes too' },
      { v: 'Vue 3', l: 'is the baseline (script setup, Vite); Vue 2 differences are mentioned where they matter' }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a question, a timer and four answers. Answer in your head, as you would in an interview, then read the explanation. At the end you see your score per topic and a review of every miss, each with a link back to the topic page.',
    analogy: { icon: '⏱️', title: 'Flashcards with a stopwatch', text: 'Knowing that <code>v-show</code> keeps the element in the DOM is easy when you read it. Saying it in five seconds under pressure takes practice.' },
    steps: [
      { t: 'Read the template', d: '<code>{{ }}</code> shows text, <code>:</code> binds an attribute to an expression, <code>@</code> listens to an event, <code>v-if</code> adds or removes, <code>v-show</code> hides.' },
      { t: 'Find the state', d: 'Is it a <code>ref</code> (use <code>.value</code> in script) or a <code>reactive</code> object (use properties, do not destructure)?' },
      { t: 'Derive or react?', d: 'A value for the page is a <code>computed</code>. A side effect on change is a <code>watch</code>.' },
      { t: 'Who owns the data?', d: 'The parent. The child gets props and emits events.' }
    ],
    terms: [
      ['SFC', 'Single-file component: a .vue file with template, script and style.'],
      ['directive', 'A special template attribute starting with <code>v-</code>, such as <code>v-if</code> or <code>v-for</code>.'],
      ['ref', 'A reactive box for any value, read and written through <code>.value</code>.'],
      ['props / emits', 'A component’s inputs from the parent and the events it sends back.']
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a topic (or All), how many questions, and the time per question, then press Start. Skip counts as a miss. At the end, your misses are listed with explanations and links to the topic pages.'
  },
  gotchas: [
    { trap: 'Answering with Vue 2 habits', why: 'Vue 2 used the Options API, <code>this.x</code> and <code>value</code>/<code>input</code> for component v-model. Interviews today assume Vue 3 with <code>&lt;script setup&gt;</code>.', fix: 'Say “in Vue 3” and give the Composition API answer.' },
    { trap: 'Forgetting .value in script', why: 'Templates unwrap refs, so <code>count++</code> works there. In script, <code>count++</code> on a ref does nothing useful.', fix: 'Template: no <code>.value</code>. Script: always <code>.value</code>.' },
    { trap: 'Guessing instead of reasoning out loud', why: 'An interviewer learns more from “props are readonly, so the child should emit” than from a lucky letter.', fix: 'State the rule, apply it, then answer.' }
  ],
  interview: [
    { q: 'How do you explain ref vs reactive in one sentence?', a: '<p><code>ref</code> wraps any value in an object with <code>.value</code> (and can be reassigned); <code>reactive</code> makes an object a Proxy you use directly, but you must not replace or destructure it.</p>', lvl: 'core' },
    { q: 'computed or watch?', a: '<p>computed for a value derived from state (cached, no side effects); watch for doing something when state changes (fetching, saving, logging).</p>', lvl: 'core' },
    { q: 'How do parent and child communicate?', a: '<p>Props down, events up. The child declares <code>defineProps</code> and <code>defineEmits</code>; <code>v-model</code> on a component is <code>modelValue</code> + <code>update:modelValue</code> (or <code>defineModel</code>).</p>', lvl: 'core' },
    { q: 'You do not know the answer. What do you say?', a: '<p>Narrow it down out loud: “Without the colon it is a plain attribute, so I believe the child gets a string. I would check the prop type warning in dev tools.”</p>', lvl: 'core' }
  ]
});
