IA.register({
  track: 'vue',
  slug: 'vue-forms',
  title: 'Forms & v-model',
  tagline: '<code>v-model</code> is two-way binding as <b>sugar</b>: a value going down and an event coming up. Learn what it expands to on inputs and on your own components, what <code>.trim</code>, <code>.number</code> and <code>.lazy</code> really do, and how to submit asynchronously without double posts.',
  tldr: {
    problem: 'Forms are where users type bad data, double-click Submit and lose their work on a slow network. The frontend must give fast feedback; the backend must still validate everything.',
    model: '<code>v-model="x"</code> on an input = <code>:value="x"</code> + <code>@input="x = $event.target.value"</code>. On a component (3.4+ <code>defineModel</code>) = <code>:modelValue</code> + <code>@update:modelValue</code>. Submit is a small state machine: idle → validating → submitting → success | error.',
    hook: '“Why is <code>age + 1</code> equal to <code>\'301\'</code>?” Because DOM inputs give strings; use <code>v-model.number</code> (or <code>type="number"</code>).',
    facts: [
      { v: 'string', l: 'is what every text input yields unless you use <code>.number</code> (applied automatically for <code>type="number"</code>)' },
      { v: 'defineModel', l: 'stable since Vue 3.4: one line to make a component work with <code>v-model</code>' },
      { v: 'client ≠ server', l: 'client validation is UX; the API must re-validate (Bean Validation in Spring)' }
    ]
  },
  intro: {
    what: 'A <b>form</b> collects user input. In plain JavaScript you would read each input’s value on submit. Vue’s <code>v-model</code> keeps a variable and an input <b>in sync</b> both ways: typing updates the variable, and changing the variable updates the input.',
    analogy: { icon: '🔁', title: 'A two-way mirror with a filter', text: 'The variable and the input mirror each other. Modifiers are filters on the way back: <code>.trim</code> wipes spaces, <code>.number</code> converts to a number, <code>.lazy</code> waits until you leave the field.' },
    steps: [
      { t: 'Bind a field', d: 'A <code>ref</code> and <code>v-model</code>.', code: "const email = ref('')\n// template: <input v-model.trim=\"email\" type=\"email\" />" },
      { t: 'Other input types', d: 'Checkbox → boolean (or array of values). Radio → selected value. Select → option value (array with <code>multiple</code>).' },
      { t: 'Handle submit', d: '<code>&lt;form @submit.prevent="onSubmit"&gt;</code> prevents the browser reload and keeps Enter-to-submit working.' },
      { t: 'Validate', d: 'Check rules on blur or submit, show messages next to fields, disable Submit while sending.' },
      { t: 'Map server errors', d: 'A 400/422 from the API with field errors goes into the same error display.' }
    ],
    terms: [
      ['v-model', 'Directive for two-way binding between state and an input or component.'],
      ['modifier', 'A suffix such as <code>.trim</code>, <code>.number</code>, <code>.lazy</code> that changes how v-model updates.'],
      ['defineModel()', 'Vue 3.4+ macro that declares a <code>modelValue</code> prop and its update event and returns a writable ref.'],
      ['dirty / touched', 'Field changed from its initial value / field has been focused and left; used to time error messages.'],
      ['schema validation', 'Describing rules once (Zod, Yup, Valibot) and validating whole objects, often via VeeValidate.']
    ]
  },
  visual: {
    title: 'v-model unpacked, and the submit state machine',
    caption: '<b>v-model</b> shows the two arrows behind the directive and where modifiers act. <b>Async submit</b> walks validation, submit, success and a 422 from the server. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Numbers arrive as strings', code: "const qty = ref(1)\n// <input v-model=\"qty\">  user types 3\nqty.value + 1   // '31'", why: 'The input event gives <code>event.target.value</code>, always a string.', fix: '<code>v-model.number</code> (or <code>type="number"</code>, which applies it automatically). Remember that an empty field then gives <code>\'\'</code>, not 0 or null.' },
    { trap: 'Mutating a prop with v-model inside a child', code: "<!-- Child: props.modelValue -->\n<input v-model=\"props.modelValue\" />   <!-- ✗ warns: props are readonly -->", lang: 'text', why: 'Props flow one way. Writing to them warns and gets overwritten by the parent on the next render.', fix: 'Use <code>const model = defineModel&lt;string&gt;()</code> (3.4+) and <code>v-model="model"</code>; it emits <code>update:modelValue</code> for you.' },
    { trap: 'v-model on an object prop field', why: 'With <code>defineModel&lt;User&gt;()</code>, <code>v-model="model.name"</code> mutates the parent’s object in place. It works but no <code>update:modelValue</code> is emitted and the parent cannot intercept.', fix: 'Use separate models (<code>defineModel(\'name\')</code>, <code>defineModel(\'email\')</code>) or emit a new object: <code>model.value = { ...model.value, name }</code>.' },
    { trap: 'Double submit', why: 'Users double-click, or press Enter twice on a slow network, and you create two orders.', fix: 'Guard with a <code>submitting</code> flag and disable the button. On the server, make the endpoint idempotent (an idempotency key) so retries are safe.' },
    { trap: 'Only validating on the client', why: 'Anyone can call your API directly with curl. Client rules can also drift from server rules.', fix: 'Server is the source of truth (<code>@Valid</code> + constraint annotations). Return field errors in a stable format (e.g. RFC 9457 problem details with an <code>errors</code> map) and show them in the form.' },
    { trap: 'Losing the draft on navigation', why: 'Leaving the route unmounts the form; local state is gone.', fix: '<code>onBeforeRouteLeave</code> to confirm when dirty, and/or save drafts to a store or <code>sessionStorage</code>.' }
  ],
  scenarios: [
    { title: 'Prices saved as “1999” cents instead of 19.99',
      symptom: 'The admin price form sometimes stores 100× prices. It started after a refactor of the input component.',
      diagnose: "// payload in the network tab\n{ \"price\": \"19.99\" }   // a string; backend multiplied after a lenient parse",
      cause: 'The new <code>&lt;MoneyInput&gt;</code> emitted the raw string; <code>.number</code> on the parent’s <code>v-model</code> was dropped in the refactor, and the backend’s parser accepted a string.',
      fix: 'Have the component emit a number (or an integer amount in cents) itself, type it with <code>defineModel&lt;number | null&gt;()</code>, and make the DTO strict (<code>BigDecimal</code>, reject strings if your JSON config allows coercion).',
      fixCode: "const model = defineModel<number | null>({ required: true })\nfunction onInput(e: Event) {\n  const v = (e.target as HTMLInputElement).value\n  model.value = v === '' ? null : Number(v)\n}" },
    { title: 'Duplicate orders on slow 3G',
      symptom: 'Support sees pairs of identical orders a few seconds apart from mobile users.',
      diagnose: 'Server logs: two POST /orders with identical bodies 800 ms apart from the same session.',
      cause: 'The Submit button stayed enabled while the request was in flight.',
      fix: 'Disable while submitting, and send an <code>Idempotency-Key</code> header generated once per form instance; the backend stores processed keys.',
      fixCode: "const key = crypto.randomUUID()\nawait fetch('/api/orders', { method: 'POST', headers: { 'Idempotency-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(form) })" }
  ],
  puzzles: [
    { kind: 'predict', q: 'User types <code>" 42 "</code> (with spaces). What is <code>typeof a.value</code> and <code>a.value</code>?', code: '<input v-model.trim.number="a" />', lang: 'text', options: ['string, " 42 "', 'number, 42', 'string, "42"', 'number, NaN'], answer: 1, explain: '<code>.trim</code> strips spaces and <code>.number</code> converts with parseFloat. Result: the number 42.' },
    { kind: 'predict', q: 'With <code>v-model.number="n"</code>, the user types <code>abc</code>. What is <code>n.value</code>?', options: ['NaN', 'null', '"abc"', '0'], answer: 2, explain: 'If <code>parseFloat</code> cannot parse the value, Vue keeps the original string. Do not assume <code>.number</code> gives a number.' },
    { kind: 'concept', q: 'What does <code>&lt;Child v-model="title" /&gt;</code> compile to in Vue 3?', options: [':value + @input', ':modelValue="title" + @update:modelValue="v =&gt; title = v"', ':title.sync', 'v-bind="title"'], answer: 1, explain: 'Vue 3 uses <code>modelValue</code> / <code>update:modelValue</code> on components. <code>v-model:title</code> uses <code>title</code> / <code>update:title</code>, which replaces Vue 2’s <code>.sync</code>.' },
    { kind: 'concept', q: 'When does a <code>v-model.lazy</code> text input update the ref?', options: ['Every keystroke', 'On the change event: blur or Enter', 'Only on form submit', 'After 300 ms debounce'], answer: 1, explain: '<code>.lazy</code> listens to <code>change</code> instead of <code>input</code>. There is no built-in debounce.' },
    { kind: 'predict', q: 'Two checkboxes <code>value="a"</code> and <code>value="b"</code>, both <code>v-model="picked"</code> where <code>picked = ref([])</code>. User checks b then a. <code>picked.value</code>?', options: ['["a","b"]', '["b","a"]', 'true', '"a"'], answer: 1, explain: 'With an array model, checking pushes the value and unchecking removes it, so order follows clicks: <code>["b","a"]</code>.' },
    { kind: 'bug', q: 'The form reloads the page on Enter. What is missing?', code: '<form @submit="save">\n  <input v-model="name" />\n  <button>Save</button>\n</form>', lang: 'text', options: ['type="button" on the button', '.prevent on @submit', 'v-model.lazy', 'A key on the form'], answer: 1, explain: 'Without <code>preventDefault()</code> the browser performs a native submit and reloads. <code>@submit.prevent</code> keeps it in the SPA.' }
  ],
  interview: [
    { q: 'How does v-model work on native inputs vs components?', a: '<p>Native: the compiler picks the right prop/event per element (<code>value</code>/<code>input</code> for text, <code>checked</code>/<code>change</code> for checkbox and radio, <code>change</code> for select) and handles IME composition. Components: <code>modelValue</code> prop + <code>update:modelValue</code> event; named models <code>v-model:foo</code> use <code>foo</code>/<code>update:foo</code>.</p>', lvl: 'core' },
    { q: 'What does defineModel do under the hood?', a: '<p>It is a compiler macro (Vue 3.4+) that declares the <code>modelValue</code> prop (plus <code>modelModifiers</code>) and the <code>update:modelValue</code> emit, and returns a ref. Reading the ref gives the prop; assigning it emits the event. If the parent does not bind v-model, it acts as local state.</p>', lvl: 'deep' },
    { q: 'How do you support custom modifiers on a component’s v-model?', a: '<p>With <code>const [model, mods] = defineModel({ set(v) { return mods.capitalize ? cap(v) : v } })</code>. The parent writes <code>v-model.capitalize="x"</code>; Vue passes <code>{ capitalize: true }</code> as <code>modelModifiers</code>.</p>', lvl: 'deep' },
    { q: 'Where would you validate, and how do you show server errors?', a: '<p>Both. Client: schema (Zod/Yup/Valibot) or VeeValidate for instant feedback. Server: Bean Validation, returning field errors, e.g. <code>{ errors: { email: "already used" } }</code> with 400/422. The form maps them to the same error refs. Show errors after blur or submit, not on first keystroke.</p>', lvl: 'core' },
    { q: 'How do you implement async submit correctly?', a: '<ol><li><code>@submit.prevent</code></li><li>Return early if already submitting or invalid</li><li>Set <code>submitting</code>, disable the button</li><li><code>try { await api } catch { map errors } finally { submitting = false }</code></li><li>Ignore stale responses if the component unmounts (AbortController).</li></ol>', lvl: 'core' },
    { q: 'reactive() or ref() for a form object?', a: '<p>Either works. <code>reactive(form)</code> lets you write <code>form.email</code> without <code>.value</code>, but you cannot reassign it wholesale (use <code>Object.assign</code> to reset). A <code>ref({...})</code> can be replaced (<code>form.value = initial()</code>). Keep the initial values in a factory function.</p>', lvl: 'core' },
    { q: 'Why might an IME (Chinese/Japanese input) user see odd behaviour with v-model?', a: '<p>During composition, Vue’s v-model on text inputs does not update until composition ends, to avoid half-typed characters. If you need every intermediate keystroke, bind <code>:value</code> and <code>@input</code> yourself.</p>', lvl: 'deep' },
    { q: 'How would you build a reusable text field component?', a: '<p><code>defineModel&lt;string&gt;()</code> for the value, props for label/error, <code>useId()</code> (3.5+) to link <code>&lt;label for&gt;</code> and <code>aria-describedby</code> to the error, and <code>defineOptions({ inheritAttrs: false })</code> + <code>v-bind="$attrs"</code> on the inner input so <code>placeholder</code>, <code>autocomplete</code> etc. land on the input, not the wrapper div.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Field component with defineModel', lang: 'ts', code: `<!-- TextField.vue (Vue 3.5) -->
<script setup lang="ts">
defineOptions({ inheritAttrs: false })
const model = defineModel<string>({ default: '' })
defineProps<{ label: string; error?: string }>()
const id = useId()
</script>

<template>
  <div class="field">
    <label :for="id">{{ label }}</label>
    <input :id="id" v-model.trim="model" v-bind="$attrs"
           :aria-invalid="!!error" :aria-describedby="error ? id + '-err' : undefined" />
    <p v-if="error" :id="id + '-err'" class="err">{{ error }}</p>
  </div>
</template>` },
    { title: 'Form with server-side errors from Spring', lang: 'ts', code: `const form = reactive({ email: '', name: '' })
const errors = ref<Record<string, string>>({})
const submitting = ref(false)

async function onSubmit() {
  if (submitting.value) return
  errors.value = validate(form)                 // client rules
  if (Object.keys(errors.value).length) return
  submitting.value = true
  try {
    const res = await fetch('/api/users', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.status === 400 || res.status === 422) { errors.value = (await res.json()).errors ?? {}; return }
    if (!res.ok) throw new Error('HTTP ' + res.status)
    await router.push('/users')
  } finally { submitting.value = false }
}`, note: 'On the Spring side, a <code>@RestControllerAdvice</code> can turn <code>MethodArgumentNotValidException</code> into <code>{ errors: { field: message } }</code>.' }
  ]
});
