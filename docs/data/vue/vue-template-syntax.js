IA.register({
  track: 'vue',
  slug: 'vue-template-syntax',
  title: 'Template syntax',
  tagline: 'Templates are HTML plus four ideas: <code>{{ }}</code> for text, <code>:</code> (<code>v-bind</code>) for attributes and props, <code>@</code> (<code>v-on</code>) for events, and directives like <code>v-if</code>, <code>v-show</code> and <code>v-for</code> for structure. Get <code>key</code> right and lists behave.',
  tldr: {
    problem: 'Templates look like plain HTML, so beginners mix up literal strings and expressions, toggle heavy components the wrong way, and use array indexes as keys, which silently attaches state to the wrong row.',
    model: 'Every binding is a <b>JavaScript expression</b> evaluated against the component’s state on each render. <code>v-if</code> adds or removes DOM; <code>v-show</code> toggles CSS. <code>v-for</code> + <code>:key</code> tells Vue which DOM node belongs to which item.',
    hook: '“Why not use the index as key?” Because keys identify items across re-orders. With the index, Vue reuses DOM by position and inputs, focus or child state end up on the wrong item.',
    facts: [
      { v: ':  @  #', l: 'shorthands for <code>v-bind</code>, <code>v-on</code> and <code>v-slot</code>' },
      { v: 'v-if > v-for', l: 'in Vue 3, <code>v-if</code> has higher priority than <code>v-for</code> on the same element (the reverse of Vue 2)' },
      { v: 'escaped', l: '<code>{{ }}</code> outputs text, never HTML. Only <code>v-html</code> injects raw HTML' }
    ]
  },
  intro: {
    what: 'A Vue template describes the HTML a component should show. It is like a Thymeleaf template, but it runs in the browser and <b>re-renders automatically</b> when data changes. Special attributes starting with <code>v-</code> are <b>directives</b>: instructions to Vue.',
    analogy: { icon: '📝', title: 'A form letter', text: '“Dear {{ name }}, your order of {{ items.length }} items ships {{ when }}.” The template is the letter; the data fills the blanks. Change the data, and the letter rewrites itself.' },
    steps: [
      { t: 'Show data', d: 'Double braces hold any JS expression.', code: '<p>Hello {{ user.name }}, you have {{ items.length }} items</p>', lang: 'text' },
      { t: 'Bind attributes', d: '<code>:attr="expr"</code>. Without the colon, the value is a plain string.', code: '<img :src="avatarUrl" :alt="user.name" :disabled="!ready">', lang: 'text' },
      { t: 'Listen to events', d: '<code>@event="handler"</code> or an inline statement.', code: '<button @click="save">Save</button>\n<form @submit.prevent="submit">…</form>', lang: 'text' },
      { t: 'Conditionals', d: '<code>v-if</code> / <code>v-else-if</code> / <code>v-else</code> add or remove elements. <code>v-show</code> only hides.', code: '<p v-if="loading">Loading…</p>\n<p v-else-if="error">{{ error }}</p>\n<OrderList v-else :orders="orders" />', lang: 'text' },
      { t: 'Lists', d: 'Repeat with <code>v-for</code>; always give a stable <code>:key</code>.', code: '<li v-for="o in orders" :key="o.id">{{ o.id }}: {{ o.total }}</li>', lang: 'text' }
    ],
    terms: [
      ['interpolation', '<code>{{ expr }}</code>: inserts the result as text.'],
      ['directive', 'A <code>v-</code> attribute that tells Vue to do something (bind, loop, show).'],
      ['modifier', 'A suffix like <code>.prevent</code>, <code>.stop</code>, <code>.enter</code> that tweaks a directive.'],
      ['key', 'A unique id per list item so Vue can match old and new DOM nodes.'],
      ['&lt;template&gt;', 'An invisible wrapper to apply <code>v-if</code>/<code>v-for</code> to several elements.']
    ]
  },
  visual: {
    title: 'Bindings, v-if vs v-show, and keyed lists',
    caption: 'Pick a concept. For lists, compare <b>key=index</b> and <b>key=id</b>: a note typed into Bob’s input either follows Bob or lands on the wrong person.'
  },
  gotchas: [
    { trap: 'Forgetting the colon', code: '<UserCard active="false" />   <!-- the STRING "false", which is truthy -->\n<UserCard :active="false" />  <!-- boolean false -->', lang: 'text', why: 'Without <code>:</code> the attribute value is a literal string. Strings like <code>"false"</code> or <code>"0"</code> are truthy.', fix: 'Use <code>:</code> for anything that isn’t a fixed string: numbers, booleans, objects, variables.' },
    { trap: 'Index as key in a list that changes order', code: '<li v-for="(t, i) in todos" :key="i"><input v-model="t.text"></li>', lang: 'text', why: 'Vue patches by key. After an insert, delete or sort, key 1 is a different item, so DOM state (focus, uncontrolled input text, child component state, transitions) stays at the position.', fix: 'Use a stable, unique id from the data: <code>:key="t.id"</code>. Index is only OK for static lists that never reorder.' },
    { trap: 'v-if and v-for on the same element', code: '<li v-for="u in users" v-if="u.active" :key="u.id">  <!-- u is undefined in v-if -->', lang: 'text', why: 'In Vue 3, <code>v-if</code> is evaluated first, before <code>u</code> exists. (Vue 2 was the opposite.)', fix: 'Filter in a computed (<code>activeUsers</code>), or wrap with <code>&lt;template v-for&gt;</code> and put <code>v-if</code> inside.' },
    { trap: 'v-html with user content', code: '<div v-html="comment.body"></div>', lang: 'text', why: '<code>v-html</code> sets <code>innerHTML</code>. Anything the user typed, including <code>&lt;img onerror=…&gt;</code>, runs in your page: XSS.', fix: 'Use <code>{{ }}</code> (escaped). If you must render HTML, sanitize with a library such as DOMPurify first.' },
    { trap: 'Calling heavy methods in the template', code: '<p>{{ formatReport(rows) }}</p>', lang: 'text', why: 'Method calls in the template run on <b>every</b> re-render of the component, even when <code>rows</code> didn’t change.', fix: 'Use a <code>computed</code>: cached until its inputs change. See <a href="vue-computed-watch.html">computed & watch</a>.' },
    { trap: 'v-show on something expensive that is rarely shown', why: '<code>v-show</code> renders the element up front even if hidden, mounting every child component and running their setup (and fetches).', fix: 'Use <code>v-if</code> for rarely opened, heavy content; <code>v-show</code> for things toggled often.' }
  ],
  scenarios: [
    { title: 'Comments land on the wrong ticket after sorting',
      symptom: 'Support agents type a reply in a ticket row, click “sort by priority”, and the half-typed reply now sits under a different ticket.',
      diagnose: '<TicketRow v-for="(t, i) in sorted" :key="i" :ticket="t" />\n<!-- TicketRow keeps draft text in its own ref -->',
      cause: 'Keys were indexes. On sort, Vue reused each <code>TicketRow</code> instance by position and only updated its <code>ticket</code> prop; the local draft stayed with the position.',
      fix: 'Key by ticket id so instances move with their data.', fixCode: '<TicketRow v-for="t in sorted" :key="t.id" :ticket="t" />', lang: 'text' },
    { title: 'Dashboard fires 40 API calls on page load for hidden panels',
      symptom: 'Network tab shows every report panel fetching data even though only one tab is visible.',
      diagnose: '<ReportPanel v-for="r in reports" v-show="r.id === activeId" :key="r.id" :report="r" />',
      cause: '<code>v-show</code> mounts every panel; each panel fetches in <code>onMounted</code>.',
      fix: 'Render only the active panel with <code>v-if</code> (optionally wrap in <code>&lt;KeepAlive&gt;</code> to keep visited panels alive).',
      fixCode: '<KeepAlive>\n  <ReportPanel v-if="active" :key="active.id" :report="active" />\n</KeepAlive>', lang: 'text' }
  ],
  puzzles: [
    { kind: 'what renders', q: 'With <code>const n = ref(3)</code>, what does this render?', code: '<span title="n">{{ n + 1 }}</span>', lang: 'text', options: ['title="3", text 4', 'title="n", text 4', 'title="n", text 31', 'title="4", text 4'], answer: 1, explain: 'No colon, so <code>title</code> is the literal string “n”. Interpolation evaluates <code>n + 1</code> with the ref unwrapped: 4.' },
    { kind: 'what renders', q: '<code>ok = false</code>. Which elements exist in the DOM?', code: '<p v-if="ok">A</p>\n<p v-show="ok">B</p>\n<p v-else>C</p>', lang: 'text', options: ['A, B (hidden), C', 'B (hidden) only', 'Compile error: v-else must follow v-if / v-else-if directly', 'C only'], answer: 2, explain: '<code>v-else</code> must immediately follow a <code>v-if</code> or <code>v-else-if</code> sibling. The <code>v-show</code> element in between breaks the chain, and the compiler reports an error.' },
    { kind: 'what renders', q: 'What does this render?', code: '<span v-for="n in 3" :key="n">{{ n }}</span>', lang: 'text', options: ['012', '123', '0123', 'Nothing: 3 is not iterable'], answer: 1, explain: '<code>v-for="n in 3"</code> iterates a range starting at <b>1</b>: 1, 2, 3.' },
    { kind: 'concept', q: 'Which statement about <code>v-show</code> is correct?', options: ['It removes the element when false', 'It toggles <code>display: none</code>, keeps the element and its child components mounted, and works with v-else', 'It toggles <code>display: none</code> and keeps the element mounted; it has no v-else and does not work on &lt;template&gt;', 'It is identical to v-if'], answer: 2, explain: '<code>v-show</code> is CSS only. It doesn’t support <code>v-else</code> and can’t be used on <code>&lt;template&gt;</code> (there’s no element to style).' },
    { kind: 'what renders', q: '<code>msg = \'&lt;b&gt;hi&lt;/b&gt;\'</code>. What does the user see?', code: '<p>{{ msg }}</p>', lang: 'text', options: ['hi in bold', 'The literal text &lt;b&gt;hi&lt;/b&gt;', 'Nothing', 'An XSS alert'], answer: 1, explain: 'Interpolation sets text content, so tags are shown, not parsed. Only <code>v-html</code> would make it bold.' },
    { kind: 'concept', q: 'In a list where items can be inserted at the top, what is the best key?', options: ['The index', 'Math.random()', 'A stable unique id from the data', 'No key'], answer: 2, explain: 'Random keys are worse than index: every render looks like all-new items, so everything is destroyed and recreated. Stable ids let Vue move nodes.' },
    { kind: 'concept', q: 'What does <code>@submit.prevent="save"</code> do?', options: ['Prevents save from running twice', 'Calls save and calls event.preventDefault(), so the browser does not reload the page', 'Submits only if save returns true', 'Stops event bubbling'], answer: 1, explain: '<code>.prevent</code> calls <code>preventDefault()</code>. <code>.stop</code> would stop propagation; <code>.once</code> runs once.' }
  ],
  interview: [
    { q: 'What can go inside <code>{{ }}</code>?', a: '<p>A single JavaScript <b>expression</b> evaluated against the component scope: <code>{{ ok ? \'Yes\' : \'No\' }}</code>, <code>{{ list.length }}</code>, <code>{{ fmt(date) }}</code>. No statements (<code>if</code>, <code>let</code>). Globals are restricted to an allow-list (e.g. <code>Math</code>, <code>Date</code>).</p>', lvl: 'core' },
    { q: 'v-if vs v-show?', a: '<p><code>v-if</code> is real conditional rendering: it creates/destroys DOM and child components (lifecycle hooks run). <code>v-show</code> always renders and toggles <code>display</code>. v-if has higher toggle cost, v-show higher initial cost.</p>', fu: 'Which one resets child component state? v-if.', lvl: 'core' },
    { q: 'Why does <code>v-for</code> need a key?', a: '<p>To identify items between renders. With keys, Vue’s diff can move, insert and remove DOM nodes per item. Without, it patches in place by position, which is fast but wrong whenever DOM or child state depends on the item.</p>', lvl: 'core' },
    { q: 'How do you bind classes and styles?', a: '<p><code>:class</code> accepts a string, an object (<code>{ active: isActive }</code>) or an array, and merges with a static <code>class</code>. <code>:style</code> accepts an object of CSS properties (<code>{ color: c, fontSize: size + \'px\' }</code>).</p>', lvl: 'core' },
    { q: 'What does <code>v-bind="obj"</code> without an argument do?', a: '<p>Binds every key of the object as an attribute/prop: <code>v-bind="{ id: 1, title: t }"</code> equals <code>:id="1" :title="t"</code>. Useful for forwarding props.</p>', lvl: 'deep' },
    { q: 'Name some event modifiers.', a: '<ul><li><code>.prevent</code>, <code>.stop</code>, <code>.self</code>, <code>.once</code>, <code>.capture</code>, <code>.passive</code></li><li>Key modifiers: <code>@keyup.enter</code>, <code>.esc</code></li><li>System: <code>.ctrl</code>, <code>.exact</code></li></ul>', lvl: 'core' },
    { q: 'Is <code>v-html</code> safe?', a: '<p>No. It sets <code>innerHTML</code>, so untrusted content is an XSS hole. Also scoped styles don’t apply inside it, and no Vue directives inside it are compiled. Sanitize or avoid.</p>', lvl: 'core' },
    { q: 'How are templates turned into code?', a: '<p>The compiler parses the template into an AST and generates a render function returning virtual DOM nodes. It adds <b>patch flags</b> (what is dynamic on each node) and hoists static subtrees, so the runtime diff only checks dynamic parts. With Vite this happens at build time.</p>', lvl: 'deep' },
    { q: 'What is a dynamic argument?', a: '<p><code>:[attrName]="v"</code> or <code>@[eventName]="h"</code>: the attribute or event name itself comes from an expression. Keep names lowercase in in-DOM templates because browsers lowercase attributes.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'A typical list view', lang: 'text', code: "<script setup lang=\"ts\">\nimport { ref, computed } from 'vue'\ninterface Order { id: number; customer: string; total: number; paid: boolean }\nconst orders = ref<Order[]>([])\nconst onlyUnpaid = ref(false)\nconst visible = computed(() => onlyUnpaid.value ? orders.value.filter(o => !o.paid) : orders.value)\n</script>\n\n<template>\n  <label><input type=\"checkbox\" v-model=\"onlyUnpaid\"> unpaid only</label>\n  <p v-if=\"!visible.length\">No orders.</p>\n  <ul v-else>\n    <li v-for=\"o in visible\" :key=\"o.id\" :class=\"{ unpaid: !o.paid }\">\n      #{{ o.id }} {{ o.customer }}: {{ o.total.toFixed(2) }}\n      <button @click.stop=\"o.paid = true\" :disabled=\"o.paid\">Mark paid</button>\n    </li>\n  </ul>\n</template>" },
    { title: 'Thymeleaf → Vue cheat sheet', lang: 'text', code: "th:text=\"${name}\"          →  {{ name }}\nth:href=\"@{/o/{id}(id=${id})}\" →  :href=\"`/o/${id}`\"\nth:if=\"${ok}\"              →  v-if=\"ok\"\nth:each=\"o : ${orders}\"     →  v-for=\"o in orders\" :key=\"o.id\"\nth:classappend=\"${a}?'x'\"   →  :class=\"{ x: a }\"\n(form post)                →  @submit.prevent=\"save\"" }
  ]
});
