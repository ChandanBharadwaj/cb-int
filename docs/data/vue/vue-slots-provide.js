IA.register({
  track: 'vue',
  slug: 'vue-slots-provide',
  title: 'Slots & provide/inject',
  tagline: 'Props pass <b>data</b> down. Slots pass <b>markup</b> down. provide/inject passes values down <b>many levels</b> without touching the components in between. Know which one fits and why a slot is really a function.',
  tldr: {
    problem: 'Reusable components need two kinds of flexibility: the caller wants to choose what goes <i>inside</i> (a card body, a table row), and deep descendants need app-wide values (theme, current user, form context) without threading props through ten layers.',
    model: 'A slot is a <b>render callback</b> the parent hands to the child: the child decides <i>where</i> and <i>how often</i> to call it, and may pass arguments (scoped slot props). provide/inject is a <b>lookup up the component tree</b> for the nearest ancestor that provided a key.',
    hook: '“How does a scoped slot see the child’s loop variable?” Because the parent’s template is compiled into a function, and the child calls it with <code>{ item }</code> as the argument.',
    facts: [
      { v: '#name', l: 'is shorthand for <code>v-slot:name</code>; <code>#default</code> is the unnamed slot' },
      { v: 'parent scope', l: 'slot content is compiled in the parent and sees only parent state plus the slot props' },
      { v: 'ref in, ref out', l: 'inject is reactive only if what was provided is reactive (a ref or reactive object)' }
    ]
  },
  intro: {
    what: 'In Vue, a <b>component</b> is a reusable piece of UI, like a class you instantiate in a template. <b>Props</b> are its constructor arguments. A <b>slot</b> is a hole in the component’s template that the <i>user</i> of the component fills with their own HTML. <b>provide/inject</b> lets a component make a value available to every component below it, however deep.',
    analogy: { icon: '🖼️', title: 'A picture frame and a building intercom', text: 'A slot is a picture frame: the frame (child) decides the border and where the picture goes; you (parent) bring the picture. provide/inject is the building’s intercom: the lobby (ancestor) broadcasts, any flat (descendant) can listen, and the floors in between do nothing.' },
    steps: [
      { t: 'Default slot', d: 'The child marks the hole with <code>&lt;slot /&gt;</code>. Whatever you put between the tags goes there.', code: '<!-- Card.vue -->\n<div class="card"><slot>Nothing here yet</slot></div>\n\n<!-- usage -->\n<Card><p>Hello</p></Card>', lang: 'text' },
      { t: 'Named slots', d: 'Several holes, each with a name. The parent targets one with <code>&lt;template #header&gt;</code>.', code: '<Card>\n  <template #header>Title</template>\n  Body text goes to #default\n  <template #footer><button>OK</button></template>\n</Card>', lang: 'text' },
      { t: 'Scoped slots', d: 'The child passes data back to the parent’s slot content: <code>&lt;slot :item="row"/&gt;</code> in the child, <code>#default="{ item }"</code> in the parent.' },
      { t: 'provide / inject', d: 'An ancestor calls <code>provide(key, value)</code>; any descendant calls <code>inject(key)</code>. No props in between.', code: "// ancestor\nprovide('locale', ref('en'))\n// any descendant\nconst locale = inject('locale')" }
    ],
    terms: [
      ['slot', 'A placeholder in a child’s template, filled by the parent.'],
      ['fallback content', 'What the child shows when the parent gives nothing for a slot.'],
      ['scoped slot / slot props', 'A slot that receives data from the child, like arguments to a callback.'],
      ['renderless component', 'A component that renders no markup of its own, only its default slot with data or behaviour.'],
      ['InjectionKey', 'A typed <code>Symbol</code> used as a provide/inject key so TypeScript knows the injected type.']
    ]
  },
  visual: {
    title: 'Slots are callbacks; inject walks up the tree',
    caption: 'Pick <b>Scoped slot</b> or <b>provide / inject</b>, then press Play or Step. Highlighted boxes are active; red marks the failure case.'
  },
  gotchas: [
    { trap: 'Expecting slot content to see child state', code: '<UserList>\n  <!-- ✗ user is undefined here: it lives in the child -->\n  <li>{{ user.name }}</li>\n</UserList>', lang: 'text', why: 'Slot content is compiled in the <b>parent’s</b> scope. The child’s variables are invisible unless the child passes them as slot props.', fix: 'Expose them: <code>&lt;slot :user="u"/&gt;</code> in the child, <code>#default="{ user }"</code> in the parent.' },
    { trap: 'Providing a plain value and expecting updates', code: "const theme = ref('light')\nprovide('theme', theme.value)   // ✗ provides the string 'light' once\nprovide('theme', theme)         // ✓ provides the ref", why: '<code>theme.value</code> is evaluated once at provide time. Descendants get a frozen string.', fix: 'Provide the ref (or a <code>reactive</code>/<code>computed</code>). Wrap with <code>readonly()</code> and provide an update function if children should not mutate it directly.' },
    { trap: 'Calling inject() outside setup', why: '<code>inject()</code> needs the current component instance to find ancestors. In a <code>setTimeout</code>, an event handler or after an <code>await</code> in plain code, there is none, and Vue warns.', fix: 'Call <code>inject()</code> synchronously at the top of <code>setup</code> / <code>&lt;script setup&gt;</code> or inside a composable called from there. App-level values can use <code>app.provide()</code> and <code>app.runWithContext()</code>.' },
    { trap: 'String keys that collide', why: 'Two libraries both providing <code>\'config\'</code> shadow each other; the nearest provider wins silently.', fix: 'Use <code>Symbol</code> keys, typed as <code>InjectionKey&lt;T&gt;</code>, exported from one module.', code: "export const ThemeKey: InjectionKey<{ theme: Readonly<Ref<string>>; toggle(): void }> = Symbol('theme')" },
    { trap: 'Using provide/inject as a global store', why: 'It hides data flow: nothing in the component signature says “I need X”. Tests must provide it, and DevTools shows no actions.', fix: 'Use it for scoped context (a form and its fields, a tabs container and its tabs, a theme). Use <a href="vue-pinia.html">Pinia</a> for shared application state.' },
    { trap: 'Checking for a slot the wrong way', why: 'In <code>&lt;script setup&gt;</code> there is no <code>this.$slots</code>. In templates <code>$slots.footer</code> works; in script use <code>useSlots()</code>.', fix: 'Wrap optional chrome: <code>&lt;footer v-if="$slots.footer"&gt;&lt;slot name="footer"/&gt;&lt;/footer&gt;</code> so an empty footer is not rendered. Type slots with <code>defineSlots()</code> (3.3+).' }
  ],
  scenarios: [
    { title: 'Theme toggle works on the page but not in dialogs',
      symptom: 'Switching to dark mode recolours the layout, but buttons inside modals stay light until a full reload.',
      diagnose: "// App.vue\nconst theme = ref('light')\nprovide(ThemeKey, theme.value)   // found in review",
      cause: 'The provided value was the unwrapped string. Components mounted before the toggle captured the old value; modals happened to read it the same way. Nothing was reactive.',
      fix: 'Provide the ref wrapped in <code>readonly()</code> plus a <code>toggle</code> function. Add a component test that toggles and asserts a descendant’s class.',
      fixCode: "provide(ThemeKey, { theme: readonly(theme), toggle })" },
    { title: 'Table component grows 14 boolean props',
      symptom: 'A shared <code>DataTable</code> has props like <code>showEmailAsLink</code>, <code>boldOverdue</code>, <code>statusColorMap</code>. Every new screen adds one.',
      diagnose: 'Each prop exists to change how one cell renders for one caller.',
      cause: 'Presentation decisions were pushed into the child instead of letting the caller own them.',
      fix: 'Expose a scoped slot per column: <code>#cell-{key}="{ row, value }"</code> with a sensible fallback. The table keeps sorting, paging and selection; callers render cells.',
      fixCode: '<!-- DataTable.vue -->\n<td v-for="col in columns" :key="col.key">\n  <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">{{ row[col.key] }}</slot>\n</td>\n\n<!-- usage -->\n<DataTable :rows="invoices" :columns="cols">\n  <template #cell-status="{ value }"><StatusBadge :status="value" /></template>\n</DataTable>', lang: 'text' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Where is this slot content compiled, and what can it access?', code: '<!-- Parent.vue: has const title = ref("Hi") -->\n<Child><h2>{{ title }}</h2></Child>', lang: 'text', options: ['In Child; it sees Child’s state', 'In Parent; it sees Parent’s state', 'In both; Child’s state wins', 'Nowhere until Child calls render()'], answer: 1, explain: 'Slot content lives in the parent’s template, so it is compiled in the parent and sees <code>title</code>. The child only decides where it appears.' },
    { kind: 'predict', q: 'The child renders <code>&lt;slot name="footer"&gt;Default&lt;/slot&gt;</code>. The parent passes only a default slot. What renders in the footer?', options: ['Nothing', '“Default”', 'The parent’s default slot content', 'A warning and nothing'], answer: 1, explain: 'Content between <code>&lt;slot&gt;</code> tags is <b>fallback</b> content, used when the parent supplies nothing for that slot.' },
    { kind: 'concept', q: 'App provides <code>ref(1)</code> under key K. A grandchild injects K and later App sets it to 2. What does the grandchild see?', options: ['1 forever', '2, and its template re-renders', 'undefined', 'An error: provide is one-time'], answer: 1, explain: 'The same ref object is shared, so the grandchild reads <code>.value</code> = 2 and any template using it is re-rendered. Provide <code>ref.value</code> instead and it would stay 1.' },
    { kind: 'concept', q: 'Two ancestors provide the same key: App provides <code>"en"</code>, Section provides <code>"de"</code>. A component inside Section injects it. Result?', options: ['"en"', '"de"', 'An array of both', 'Error: duplicate provider'], answer: 1, explain: 'inject resolves to the <b>nearest</b> ancestor that provides the key. Section shadows App for its subtree, which is how you override context locally.' },
    { kind: 'concept', q: 'What does <code>&lt;Child v-slot="{ n }"&gt;{{ n }}&lt;/Child&gt;</code> compile to, roughly?', options: ['A computed property on Child', 'A function <code>default: ({ n }) =&gt; [n]</code> passed in Child’s slots', 'An event listener', 'A prop named <code>n</code>'], answer: 1, explain: 'Slots are compiled to functions in the slots object of the child VNode. Scoped slot props are just the function’s argument.' },
    { kind: 'bug', q: 'Why does this warn “inject() can only be used inside setup()”?', code: "onMounted(async () => {\n  await loadConfig()\n  const t = inject(ThemeKey)\n})", options: ['inject must be imported from pinia', 'It runs in a callback, not synchronously during setup', 'Symbol keys are not allowed', 'onMounted cannot be async'], answer: 1, explain: 'inject needs the current component instance, which is set only while setup runs. Hook callbacks run later. Inject at the top of setup and use the value inside the hook.' }
  ],
  interview: [
    { q: 'Props, slots, emits and provide/inject: when do you use each?', a: '<ul><li><b>Props</b>: data the child needs to render, from its direct parent.</li><li><b>Emits</b>: the child telling its parent something happened.</li><li><b>Slots</b>: the parent supplies markup the child places.</li><li><b>provide/inject</b>: context for a whole subtree (theme, form, i18n) without drilling.</li></ul><p>Shared mutable app state goes to Pinia.</p>', lvl: 'core' },
    { q: 'Explain scoped slots to a Java developer.', a: '<p>The child accepts a callback <code>Function&lt;Props, VNodes&gt;</code>. It calls it with its own data (e.g. each row) and inserts the result. The parent writes the callback body as a template. Like passing a <code>RowMapper</code> to <code>JdbcTemplate</code>: the template owns the loop, you own the per-row mapping.</p>', lvl: 'core' },
    { q: 'What is a renderless component, and what replaced most of them in Vue 3?', a: '<p>A component that only manages state or behaviour and exposes it via its default scoped slot (e.g. <code>&lt;Fetch v-slot="{ data, loading }"&gt;</code>). In Vue 3 most of these became <b>composables</b> (<code>useFetch()</code>), which share logic without an extra component instance. Renderless components are still handy when the logic must be used from templates only.</p>', lvl: 'deep' },
    { q: 'How do you type provide/inject in TypeScript?', a: '<p>Export an <code>InjectionKey&lt;T&gt;</code> (a typed Symbol). <code>provide(key, value)</code> checks the value; <code>inject(key)</code> returns <code>T | undefined</code>. Use a default or a small <code>useTheme()</code> helper that throws a clear error if no provider exists.</p>', lvl: 'core' },
    { q: 'Is provide/inject reactive?', a: '<p>Only as reactive as the value. Vue does not wrap it. Provide a ref, reactive or computed for live values; a primitive is a snapshot. Prefer <code>readonly(state)</code> plus mutation functions so changes stay with the provider.</p>', lvl: 'core' },
    { q: 'How does inject find its value internally?', a: '<p>Each component instance has a <code>provides</code> object whose prototype is its parent’s <code>provides</code>. When a component first calls <code>provide()</code>, Vue creates its own object with the parent’s as prototype. <code>inject(key)</code> is then a prototype-chain lookup: nearest provider wins, and app-level <code>app.provide()</code> sits at the root.</p>', lvl: 'deep' },
    { q: 'How do you render a slot only if the parent provided it?', a: '<p>In templates: <code>v-if="$slots.footer"</code>. In script: <code>const slots = useSlots(); slots.footer?.()</code>. Note that a provided slot may still render nothing (e.g. a <code>v-if</code> inside it), so it is not a perfect “has content” test.</p>', lvl: 'deep' },
    { q: 'What is <code>defineSlots</code>?', a: '<p>A compiler macro (Vue 3.3+) that declares slot names and their prop types for type checking in <code>&lt;script setup lang="ts"&gt;</code>, e.g. <code>defineSlots&lt;{ row(props: { user: User }): any }&gt;()</code>. It has no runtime effect beyond returning the slots object.</p>', lvl: 'deep' },
    { q: 'What happens to slots and inject with <code>&lt;Teleport&gt;</code>?', a: '<p>Teleport moves DOM nodes elsewhere (e.g. to <code>body</code> for a modal) but the component keeps its logical position in the tree. Slots, props, emits and inject all behave as if it had not moved.</p>', fu: 'Why teleport modals at all? To escape <code>overflow: hidden</code> and stacking contexts of ancestors.', lvl: 'core' }
  ],
  code: [
    { title: 'Typed context composable', lang: 'ts', code: `// form-context.ts
import { inject, provide, reactive, readonly, type InjectionKey } from 'vue'

interface FormCtx { errors: Readonly<Record<string, string>>; register(name: string): void }
const FormKey: InjectionKey<FormCtx> = Symbol('form')

export function provideForm() {
  const errors = reactive<Record<string, string>>({})
  const fields = new Set<string>()
  const ctx: FormCtx = { errors: readonly(errors), register: (n) => fields.add(n) }
  provide(FormKey, ctx)
  return { errors, fields }
}

export function useForm(): FormCtx {
  const ctx = inject(FormKey)
  if (!ctx) throw new Error('useForm() must be used inside <AppForm>')
  return ctx
}`, note: 'Same idea as a request-scoped bean: the provider owns the state, consumers get a read-only view and methods.' },
    { title: 'Scoped slot with typed props', lang: 'ts', code: `<!-- List.vue -->
<script setup lang="ts" generic="T extends { id: string | number }">
defineProps<{ items: T[] }>()
defineSlots<{ default(props: { item: T; index: number }): any; empty(): any }>()
</script>

<template>
  <ul v-if="items.length">
    <li v-for="(item, index) in items" :key="item.id"><slot :item="item" :index="index" /></li>
  </ul>
  <slot v-else name="empty">No items</slot>
</template>`, note: '<code>generic</code> on <code>&lt;script setup&gt;</code> needs Vue 3.3+.' }
  ]
});
