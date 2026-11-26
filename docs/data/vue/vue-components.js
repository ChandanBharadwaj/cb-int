IA.register({
  track: 'vue',
  slug: 'vue-components',
  title: 'Components, props & emits',
  tagline: 'Components are the building blocks of a Vue app. Data flows <b>down</b> through <code>defineProps</code>, and change requests go <b>up</b> through <code>defineEmits</code>. <code>v-model</code> on a component is a prop plus an event: two-way in feel, one-way underneath.',
  tldr: {
    problem: 'Once a UI has more than one component, you need a contract between them. Without one, children mutate parent data, state gets copied out of sync, and nobody knows who changed what.',
    model: 'A component is like a class with a constructor contract. <b>Props</b> are its readonly inputs; <b>emits</b> are its typed events; the <b>parent owns</b> the state. <code>v-model="x"</code> = <code>:modelValue="x" @update:modelValue="v => x = v"</code>.',
    hook: '“Why can’t a child modify a prop?” One-way data flow: if every child could write shared data, you couldn’t trace changes. The child emits; the owner decides.',
    facts: [
      { v: '3.4', l: '<code>defineModel()</code> became stable in Vue 3.4' },
      { v: '3.5', l: 'destructuring <code>defineProps</code> is reactive, with JS default values (reactive props destructure)' },
      { v: 'readonly', l: 'props objects are shallow-readonly; writing to one warns in dev' }
    ]
  },
  intro: {
    what: 'A <b>component</b> is a reusable piece of UI in its own <code>.vue</code> file. A page is a tree: <code>App</code> contains <code>OrderList</code>, which contains many <code>OrderRow</code>s. Parents configure children with <b>props</b> (like constructor arguments), and children tell parents about things with <b>events</b> (like callbacks or listeners).',
    analogy: { icon: '📮', title: 'Manager and team member', text: 'The manager hands over a brief (props). The team member doesn’t edit the brief; they send back a message: “client wants a change” (emit). The manager updates the brief and hands over the new version.' },
    steps: [
      { t: 'Declare props', d: 'With TS, a type is enough. Optional props use <code>?</code>.', code: "const props = defineProps<{ order: Order; compact?: boolean }>()" },
      { t: 'Declare events', d: 'Typed payloads, named tuples.', code: "const emit = defineEmits<{ remove: [id: number]; select: [order: Order] }>()" },
      { t: 'Use the component', d: 'Import it and use it as a tag. Bind props with <code>:</code>, listen with <code>@</code>.', code: '<OrderRow :order="o" compact @remove="removeOrder" />', lang: 'text' },
      { t: 'Two-way with v-model', d: 'Child uses <code>defineModel()</code>; parent writes <code>v-model</code>.', code: "// child\nconst model = defineModel<string>({ required: true })\n// parent\n<SearchBox v-model=\"query\" />" }
    ],
    terms: [
      ['props', 'Inputs passed from parent to child. Readonly inside the child.'],
      ['emit', 'Fire a custom event the parent can listen to with <code>@name</code>.'],
      ['one-way data flow', 'State lives in one owner and flows down; changes go up as events.'],
      ['defineProps / defineEmits', 'Compiler macros in <code>&lt;script setup&gt;</code>. No import needed.'],
      ['fallthrough attrs', 'Attributes like <code>class</code> or <code>id</code> not declared as props, applied to the child’s root element.']
    ]
  },
  visual: {
    title: 'Props down, events up',
    caption: '<b>Props down, events up</b> shows a counter owned by the parent, and what happens if the child tries to write the prop. <b>v-model on a component</b> shows the expansion to <code>modelValue</code> + <code>update:modelValue</code>.'
  },
  gotchas: [
    { trap: 'Mutating a prop', code: "const props = defineProps<{ items: string[]; title: string }>()\nprops.title = 'x'       // warns: readonly\nprops.items.push('x')   // NO warning, but mutates the parent's array", why: 'Props are shallow-readonly. Reassigning warns, but nested objects and arrays are the parent’s own reactive data, so mutating them silently changes parent state.', fix: 'Emit an event and let the owner change it, or use <code>defineModel</code>. For local editing, copy: <code>const draft = ref(structuredClone(toRaw(props.item)))</code>.' },
    { trap: 'Copying a prop into local state once', code: 'const props = defineProps<{ userId: number }>()\nconst id = ref(props.userId)   // never updates when the parent changes userId', why: 'The ref is initialised from the prop at setup time only.', fix: 'Use the prop directly, or derive: <code>const id = computed(() => props.userId)</code>. Copy only when you truly want an editable draft.' },
    { trap: 'Destructuring props before Vue 3.5', code: 'const { userId } = defineProps<{ userId: number }>()', why: 'Before 3.5 this produced a constant. Since 3.5 the compiler rewrites access to <code>props.userId</code>, so it stays reactive in templates and computeds, but passing <code>userId</code> to <code>watch(userId, …)</code> still passes a plain value.', fix: 'On 3.5+: <code>watch(() => userId, …)</code>. On older versions, keep <code>props.userId</code>.' },
    { trap: 'Mutable default for an object prop (runtime declaration)', code: "props: { tags: { type: Array, default: [] } }   // shared array, Vue warns\nprops: { tags: { type: Array, default: () => [] } }", why: 'Object and array defaults must be factories so each instance gets its own copy.', fix: 'Use a factory, or with TS: <code>withDefaults(defineProps&lt;…&gt;(), { tags: () =&gt; [] })</code>, or 3.5 destructure defaults.' },
    { trap: 'Event names and listeners not matching', code: "emit('updateValue')           // child\n<Child @update-value=\"h\" />   <!-- works: kebab-case listener is normalized -->\n<Child @updatevalue=\"h\" />    <!-- never fires -->", lang: 'ts', why: 'Vue normalizes camelCase emits to match kebab-case listeners, but not arbitrary casing. Undeclared events also fall through as native listeners on the root element.', fix: 'Declare every event in <code>defineEmits</code> with types; TS and Volar then flag wrong names.' },
    { trap: 'Prop drilling through five levels', why: 'Passing the same prop through components that don’t use it couples every layer.', fix: 'Use <code>provide/inject</code> for subtree context (theme, form) or a Pinia store for app state.' }
  ],
  scenarios: [
    { title: 'Cancel button in an edit dialog doesn’t cancel',
      symptom: 'User edits a customer in a modal, clicks Cancel, and the list behind already shows the edited values.',
      diagnose: "const props = defineProps<{ customer: Customer }>()\n// template: <input v-model=\"props.customer.name\">",
      cause: 'The dialog bound inputs to the parent’s object through the prop. Nested mutation doesn’t warn, so edits went straight into the list.',
      fix: 'Edit a draft copy; emit <code>save</code> with the draft; the parent applies it.',
      fixCode: "const props = defineProps<{ customer: Customer }>()\nconst emit = defineEmits<{ save: [c: Customer]; cancel: [] }>()\nconst draft = ref<Customer>(structuredClone(toRaw(props.customer)))\nconst save = () => emit('save', draft.value)" },
    { title: 'Child shows the previous user after navigation',
      symptom: 'Navigating from /users/1 to /users/2 updates the header but the profile card still shows user 1.',
      diagnose: "const props = defineProps<{ userId: number }>()\nconst user = ref<User>()\nonMounted(async () => { user.value = await api.user(props.userId) })",
      cause: 'The router reused the component instance; <code>onMounted</code> runs once, so only the first id was ever loaded.',
      fix: 'React to the prop with a watcher (immediate), or key the component by id to force a remount.',
      fixCode: "watch(() => props.userId, async (id) => { user.value = await api.user(id) }, { immediate: true })\n// or in the parent: <ProfileCard :key=\"userId\" :user-id=\"userId\" />" }
  ],
  puzzles: [
    { kind: 'what renders', q: 'Child has <code>defineProps&lt;{ n: number }&gt;()</code>. What does it receive?', code: '<Child n="5" />', lang: 'text', options: ['the number 5', 'the string "5" (and a dev warning for the type mismatch)', 'undefined', 'a compile error'], answer: 1, explain: 'Without <code>:</code> it is a string attribute. TS types become runtime type checks in dev, so Vue warns “Expected Number, got String”.' },
    { kind: 'concept', q: 'Inside a child, <code>props.list.push(x)</code> where list is an array prop. What happens?', options: ['Vue throws', 'Vue warns and ignores it', 'It works and mutates the parent’s array, without a warning', 'Only the child’s copy changes'], answer: 2, explain: 'Props are only <i>shallow</i> readonly. Nested data is the parent’s reactive object. It “works”, which is why it is a bug magnet.' },
    { kind: 'concept', q: 'What does <code>&lt;Comp v-model:title="t" /&gt;</code> compile to?', options: [':modelValue="t" @update:modelValue', ':title="t" @update:title="v => t = v"', ':value="t" @input', 'v-bind:title.sync'], answer: 1, explain: 'An argument renames the prop and the event: <code>title</code> / <code>update:title</code>. In the child: <code>defineModel(\'title\')</code>.' },
    { kind: 'what renders', q: 'Parent renders <code>&lt;Badge class="big" /&gt;</code>. Badge has one root <code>&lt;span class="badge"&gt;</code> and declares no class prop. Result?', options: ['<span class="badge">', '<span class="badge big">', '<span class="big">', 'A warning, nothing rendered'], answer: 1, explain: 'Undeclared attributes fall through to a single root element; <code>class</code> and <code>style</code> are merged. Disable with <code>defineOptions({ inheritAttrs: false })</code>.' },
    { kind: 'concept', q: 'The child calls <code>emit(\'save\', data)</code>. How does the parent get <code>data</code>?', options: ['From props', '<code>@save="onSave"</code> where onSave(data) receives it, or inline <code>@save="d => …"</code>', 'Through a global event bus', 'It can’t'], answer: 1, explain: 'Emitted arguments are passed to the listener. Unlike DOM events, component events don’t bubble beyond the direct parent.' },
    { kind: 'concept', q: 'Why is <code>defineProps</code> not imported?', options: ['It’s a global variable', 'It’s a compiler macro processed in &lt;script setup&gt; and removed at compile time', 'Vite auto-imports it', 'It is imported implicitly from vue-router'], answer: 1, explain: '<code>defineProps</code>, <code>defineEmits</code>, <code>defineModel</code>, <code>defineExpose</code>, <code>defineOptions</code>, <code>defineSlots</code> are macros. They only work in <code>&lt;script setup&gt;</code>.' }
  ],
  interview: [
    { q: 'Explain one-way data flow in Vue.', a: '<p>State has a single owner. The owner passes it down as props; children treat props as readonly and request changes by emitting events. When the owner updates its state, the new values flow down. Every change is traceable to the owner.</p>', lvl: 'core' },
    { q: 'How do you declare props with TypeScript?', a: '<p><code>defineProps&lt;{ id: number; label?: string }&gt;()</code>. The compiler turns the type into runtime prop options. Defaults: <code>withDefaults(defineProps&lt;P&gt;(), { label: \'x\' })</code>, or in 3.5+ destructure with JS defaults: <code>const { label = \'x\' } = defineProps&lt;P&gt;()</code>.</p>', lvl: 'core' },
    { q: 'How does v-model work on components?', a: '<p>It expands to a <code>modelValue</code> prop and an <code>update:modelValue</code> listener. In the child, <code>defineModel()</code> (3.4+) returns a ref: reading it reads the prop, assigning it emits the update. Named models (<code>v-model:title</code>) and modifiers (<code>v-model.trim</code>) are supported.</p>', fu: 'What did Vue 2 use? <code>value</code> + <code>input</code>, and <code>.sync</code> for others; Vue 3 unified them.', lvl: 'core' },
    { q: 'What are fallthrough attributes?', a: '<p>Attributes and listeners passed to a component but not declared as props or emits. They land on the root element (<code>class</code>/<code>style</code> merged). With multiple roots, you must bind <code>v-bind="$attrs"</code> yourself, or Vue warns. <code>useAttrs()</code> gives access in script.</p>', lvl: 'deep' },
    { q: 'How do you expose methods from a child to a parent?', a: '<p><code>&lt;script setup&gt;</code> components are closed by default. Use <code>defineExpose({ focus, reset })</code>, then in the parent a template ref: <code>const form = useTemplateRef(\'form\')</code>; <code>form.value?.reset()</code>. Use sparingly: prefer props/events.</p>', lvl: 'deep' },
    { q: 'Props validation at runtime?', a: '<p>In dev Vue checks types, <code>required</code>, and custom <code>validator</code> functions (runtime declaration). Warnings only; no checks in production builds. Types from TS declarations become the same runtime checks.</p>', lvl: 'core' },
    { q: 'When do you use a component key?', a: '<p><code>:key</code> on a component forces Vue to treat a changed key as a different instance: unmount old, mount new. Useful to reset all internal state, e.g. <code>&lt;Editor :key="docId" /&gt;</code>.</p>', lvl: 'deep' },
    { q: 'Global vs local registration?', a: '<p>In <code>&lt;script setup&gt;</code> an imported component is usable in the template directly (local). <code>app.component(\'X\', X)</code> registers globally: convenient, but not tree-shakable and hides dependencies.</p>', lvl: 'core' },
    { q: 'How do siblings communicate?', a: '<p>Lift state to the common parent (props down, events up), or use a store (Pinia) when they are far apart. Vue 3 removed <code>$on</code>, so event buses need a small library like mitt, and are usually a smell.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Typed child component', lang: 'text', code: "<!-- OrderRow.vue -->\n<script setup lang=\"ts\">\ninterface Order { id: number; customer: string; total: number }\nconst { order, compact = false } = defineProps<{ order: Order; compact?: boolean }>()  // 3.5+\nconst emit = defineEmits<{ remove: [id: number] }>()\n</script>\n\n<template>\n  <li :class=\"{ compact }\">\n    {{ order.customer }}: {{ order.total }}\n    <button @click=\"emit('remove', order.id)\">✕</button>\n  </li>\n</template>" },
    { title: 'Parent owning the state', lang: 'text', code: "<script setup lang=\"ts\">\nimport { ref } from 'vue'\nimport OrderRow from './OrderRow.vue'\nconst orders = ref([{ id: 1, customer: 'Ann', total: 30 }])\nfunction removeOrder(id: number) { orders.value = orders.value.filter(o => o.id !== id) }\n</script>\n\n<template>\n  <ul><OrderRow v-for=\"o in orders\" :key=\"o.id\" :order=\"o\" @remove=\"removeOrder\" /></ul>\n</template>" },
    { title: 'defineModel with a modifier', lang: 'ts', code: "// MoneyInput.vue\nconst [model, modifiers] = defineModel<number>({\n  set(v) { return modifiers.round ? Math.round(v) : v }\n})\n// parent: <MoneyInput v-model.round=\"amount\" />" }
  ]
});
