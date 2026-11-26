IA.register({
  track: 'frontend',
  slug: 'fe-web-components',
  title: 'Web Components',
  tagline: 'Web Components are the browser’s <b>own component model</b>: custom elements give a tag a class and lifecycle, Shadow DOM gives it private markup and styles, and slots let callers pass content in. They work in any framework, or none, which makes them ideal for design systems and embeddable widgets.',
  tldr: {
    problem: 'A design system written in React can’t be used by the Vue, Angular and server-rendered Thymeleaf apps in the same company. A widget embedded in other people’s pages gets wrecked by their CSS.',
    model: '<code>class X extends HTMLElement</code> + <code>customElements.define(\'x-tag\', X)</code>. <code>attachShadow()</code> creates a separate DOM subtree whose styles don’t leak in or out, except inherited properties and CSS custom properties. Inputs are <b>attributes</b> (strings) and <b>properties</b> (any value); outputs are <b>events</b>.',
    hook: '“My event fires inside the component but the app never sees it.” It needs <code>composed: true</code> to cross the shadow boundary.',
    facts: [
      { v: 'a-hyphen', l: 'custom element names must contain a hyphen, so they never clash with future HTML tags' },
      { v: 'composed', l: 'custom events stop at the shadow root unless <code>composed: true</code>; outside, <code>target</code> is retargeted to the host' },
      { v: 'React 19', l: 'first React version with full custom element support (sets properties, listens to custom events)' }
    ]
  },
  intro: {
    what: 'HTML has built-in tags like <code>&lt;video&gt;</code> that hide complex internals behind a simple tag. Web Components let you make your own: <code>&lt;date-picker&gt;</code>, <code>&lt;user-card&gt;</code>. It is three standards: <b>custom elements</b> (a JS class behind a tag), <b>Shadow DOM</b> (private markup and CSS) and <b>templates/slots</b> (reusable markup and placeholders for content).',
    analogy: { icon: '🔌', title: 'A Java interface with a sealed implementation', text: 'The tag and its attributes, properties and events are the public API. The shadow root is the private implementation: callers can’t reach in with CSS selectors or <code>querySelector</code>, just as they can’t touch private fields. CSS custom properties and <code>::part</code> are the deliberately exposed extension points.' },
    steps: [
      { t: 'Define a class', d: 'Extend <code>HTMLElement</code> and register it.', code: "class UserCard extends HTMLElement {\n  connectedCallback() { this.textContent = `Hi ${this.getAttribute('name')}`; }\n}\ncustomElements.define('user-card', UserCard);" },
      { t: 'Use it like any tag', d: 'In plain HTML, Thymeleaf, Vue or React.', code: '<user-card name="Asha"></user-card>', lang: 'text' },
      { t: 'Encapsulate with Shadow DOM', d: '<code>this.attachShadow({ mode: \'open\' })</code> gives the element a private tree with its own <code>&lt;style&gt;</code>.' },
      { t: 'Accept content with slots', d: 'Children you put inside the tag appear where the component places a <code>&lt;slot&gt;</code>.' },
      { t: 'Talk back with events', d: 'Dispatch a <code>CustomEvent</code> with <code>bubbles</code> and <code>composed</code> so the app can listen.' }
    ],
    terms: [
      ['custom element', 'A tag backed by your class, registered with <code>customElements.define</code>.'],
      ['shadow root', 'A hidden DOM subtree attached to an element, with scoped styles.'],
      ['light DOM', 'The normal children of the element, written by the user of the component.'],
      ['slot', 'A placeholder in the shadow tree where light DOM children are shown.'],
      ['upgrade', 'When a tag already in the page gets its class because the definition ran later.'],
      ['Declarative Shadow DOM', '<code>&lt;template shadowrootmode="open"&gt;</code> in HTML, so shadow content can be server-rendered.']
    ]
  },
  visual: {
    title: 'Inside a custom element',
    caption: 'Pick <b>Lifecycle</b>, <b>Shadow DOM & styles</b> or <b>Events & composed</b>, then press Play or Step. Green crosses the boundary, red is blocked.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Simulated: composed events', code: `// Simulation (a Worker has no DOM): models how an event travels.
// path = nodes from target up to document; shadowRoot marks the boundary.
function dispatch(path, { bubbles, composed }) {
  const heard = [];
  for (const node of path) {
    heard.push(node);
    if (!bubbles) break;
    if (node === 'shadow-root' && !composed) break;
  }
  return heard.join(' -> ');
}
const path = ['button', 'div.inner', 'shadow-root', 'user-card (host)', 'body', 'document'];
console.log('bubbles only:      ', dispatch(path, { bubbles: true, composed: false }));
console.log('bubbles + composed:', dispatch(path, { bubbles: true, composed: true }));
console.log('neither:           ', dispatch(path, { bubbles: false, composed: false }));`, note: 'A labelled simulation of the rule, not the real DOM. Real events also retarget <code>event.target</code> to the host outside the shadow root.' }
    ]
  },
  gotchas: [
    { trap: 'Passing objects as attributes', code: `<user-list users="[object Object]"></user-list>   <!-- from a naive template -->`, lang: 'text', why: 'Attributes are always strings. Frameworks that only set attributes (React 18 and earlier did) turn arrays and objects into <code>"[object Object]"</code>.', fix: 'Expose a <b>property</b> (<code>set users(v)</code>) for rich data and keep attributes for simple strings, numbers and booleans. In Vue use <code>.prop</code> modifier or rely on its auto-detection; React 19 sets properties when the element defines them.' },
    { trap: 'Events don’t leave the shadow root', code: `this.dispatchEvent(new CustomEvent('select', { detail: id }));   // dispatched from shadow content? stops at the root`, why: 'Custom events default to <code>bubbles: false, composed: false</code>.', fix: 'Dispatch from the host (<code>this.dispatchEvent</code>) or use <code>{ bubbles: true, composed: true }</code> when dispatching from an inner node.' },
    { trap: 'Doing work in the constructor', why: 'In the constructor, attributes and children may not exist yet (especially when created with <code>document.createElement</code>). The spec forbids adding attributes or children there.', fix: 'Only <code>super()</code>, <code>attachShadow</code> and defaults in the constructor. Render in <code>connectedCallback</code> and react in <code>attributeChangedCallback</code>.' },
    { trap: 'Global styles and fonts don’t reach shadow content', why: 'Your Bootstrap or Tailwind classes don’t apply inside the shadow root. <code>@font-face</code> must be declared in the document, not only in shadow styles.', fix: 'Theme through CSS custom properties and <code>::part</code>. Share stylesheets with <code>adoptedStyleSheets</code> (constructable stylesheets) instead of duplicating <code>&lt;style&gt;</code> per instance.' },
    { trap: 'Custom inputs that forms ignore', why: 'An <code>&lt;input&gt;</code> inside a shadow root isn’t part of the outer <code>&lt;form&gt;</code>: no value on submit, no validation, no label association.', fix: 'Form-associated custom elements: <code>static formAssociated = true</code> and <code>this.internals = this.attachInternals()</code>, then <code>internals.setFormValue()</code> and <code>setValidity()</code>.' },
    { trap: 'Customized built-ins (<code>is="…"</code>)', code: `<button is="fancy-button">`, lang: 'text', why: 'Extending built-in elements like <code>HTMLButtonElement</code> is not supported by Safari/WebKit.', fix: 'Use autonomous custom elements (<code>extends HTMLElement</code>), and wrap a real <code>&lt;button&gt;</code> inside for semantics.' }
  ],
  scenarios: [
    { title: 'Design-system button does nothing in the React app',
      symptom: 'The <code>&lt;ds-button&gt;</code> works in the Vue app and in plain HTML, but <code>onDsClick</code> handlers in the React 18 app never fire and the <code>config</code> prop shows <code>[object Object]</code>.',
      diagnose: `// in DevTools: $0.getAttribute('config')  → "[object Object]"\n// the event is named 'ds-click'; React 18 only wires its known synthetic events`,
      cause: 'React 18 and earlier pass everything to custom elements as attributes and don’t attach listeners for arbitrary custom event names.',
      fix: 'Upgrade to React 19, or use a ref: set properties and add listeners manually (or a thin wrapper such as one generated by <code>@lit/react</code>).',
      fixCode: `const ref = useRef<HTMLElement & { config: Config }>(null);\nuseEffect(() => {\n  const el = ref.current!; el.config = config;\n  const h = (e: Event) => onClick((e as CustomEvent).detail);\n  el.addEventListener('ds-click', h); return () => el.removeEventListener('ds-click', h);\n}, [config, onClick]);\nreturn <ds-button ref={ref} />;` },
    { title: 'Memory grows on a dashboard that swaps widgets',
      symptom: 'Heap snapshots show thousands of detached <code>&lt;live-chart&gt;</code> elements after an hour.',
      diagnose: `// DevTools → Memory → heap snapshot → filter "Detached"\n// retainers: window 'resize' listener → closure → LiveChart instance`,
      cause: 'The component adds a <code>window</code> listener and a <code>setInterval</code> in <code>connectedCallback</code> but never removes them.',
      fix: 'Clean up in <code>disconnectedCallback</code>. An <code>AbortController</code> makes it one line.',
      fixCode: `connectedCallback() {\n  this.ac = new AbortController();\n  window.addEventListener('resize', this.onResize, { signal: this.ac.signal });\n  this.timer = setInterval(this.tick, 1000);\n}\ndisconnectedCallback() { this.ac.abort(); clearInterval(this.timer); }` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which name is a valid custom element name?', options: ['<code>usercard</code>', '<code>UserCard</code>', '<code>user-card</code>', '<code>card</code>'], answer: 2, explain: 'Names must contain a hyphen and be lowercase. The hyphen guarantees no clash with current or future standard elements.' },
    { kind: 'concept', q: 'Page CSS has <code>p { color: red }</code> and <code>:root { --brand: teal }</code>. Inside a shadow root, a <code>&lt;p&gt;</code> uses <code>color: var(--brand)</code> in its own styles. What colour is it?', options: ['red', 'teal', 'black (default)', 'It depends on load order'], answer: 1, explain: 'Page selectors don’t match shadow content, but custom properties inherit through the shadow boundary. So <code>var(--brand)</code> resolves to teal.' },
    { kind: 'concept', q: 'An inner button dispatches <code>new CustomEvent("pick", { bubbles: true })</code>. A listener on <code>document</code> for <code>"pick"</code>…', options: ['fires, with target = inner button', 'fires, with target = host', 'does not fire', 'fires twice'], answer: 2, explain: 'Without <code>composed: true</code> the event stops at the shadow root. With it, the document listener would see target = the host (retargeting).' },
    { kind: 'concept', q: 'When is <code>attributeChangedCallback</code> called for <code>name</code>?', options: ['For every attribute change', 'Only if <code>name</code> is in <code>static observedAttributes</code>', 'Only before connectedCallback', 'Only when set via a property'], answer: 1, explain: 'You must opt in per attribute with <code>static get observedAttributes() { return [\'name\'] }</code> (or a static field).' },
    { kind: 'concept', q: 'Which technique lets a server render shadow DOM content in HTML so it shows before JS loads?', options: ['<code>&lt;slot&gt;</code>', '<code>&lt;template shadowrootmode="open"&gt;</code> (Declarative Shadow DOM)', '<code>adoptedStyleSheets</code>', '<code>mode: "closed"</code>'], answer: 1, explain: 'Declarative Shadow DOM, supported in all major browsers since 2024. The parser attaches the shadow root directly.' },
    { kind: 'concept', q: 'A custom <code>&lt;star-rating&gt;</code> with an inner <code>&lt;input&gt;</code> isn’t submitted with its form. Standard fix?', options: ['Use <code>mode: "closed"</code>', 'Form-associated custom element: <code>static formAssociated = true</code> + <code>attachInternals().setFormValue()</code>', 'Wrap it in an iframe', 'Move the form inside the shadow root'], answer: 1, explain: 'ElementInternals lets a custom element participate in forms: value, validity, labels, reset and disabled state.' }
  ],
  interview: [
    { q: 'What are Web Components made of?', a: '<ul><li><b>Custom elements</b>: a class behind a tag, with lifecycle callbacks.</li><li><b>Shadow DOM</b>: an encapsulated subtree with scoped styles.</li><li><b>HTML templates and slots</b>: inert markup to clone, and placeholders for light DOM content.</li></ul><p>Plus ES modules to ship them. No framework or build step required.</p>', lvl: 'core' },
    { q: 'List the custom element lifecycle callbacks.', a: '<p><code>constructor</code>, <code>connectedCallback</code> (inserted), <code>disconnectedCallback</code> (removed), <code>attributeChangedCallback</code> (for <code>observedAttributes</code>), <code>adoptedCallback</code> (moved to another document). Newer browsers add <code>connectedMoveCallback</code> for atomic moves with <code>moveBefore()</code>.</p>', lvl: 'core' },
    { q: 'Attributes vs properties: what is the difference and why does it matter?', a: '<p>Attributes live in HTML and are strings. Properties are JS fields on the object and can hold any value. Built-in elements reflect some (<code>id</code>) but not all (<code>input.value</code> vs the <code>value</code> attribute). A good component accepts simple config as attributes, rich data as properties, and reflects a few attributes for styling (<code>[disabled]</code>).</p>', lvl: 'core' },
    { q: 'How does Shadow DOM encapsulation work for CSS?', a: '<p>Selectors in the document don’t match nodes in a shadow tree, and shadow styles don’t leak out. Inherited properties and custom properties still flow in. The component can expose <code>::part()</code> hooks, style itself with <code>:host</code>, and style slotted children with <code>::slotted()</code>. Light DOM children remain styled by the page.</p>', lvl: 'core' },
    { q: 'open vs closed shadow roots?', a: '<p><code>open</code> exposes <code>el.shadowRoot</code>; <code>closed</code> returns <code>null</code>. Closed is not a security boundary (scripts on the page can still patch <code>attachShadow</code>), and it makes testing harder. Most libraries use open.</p>', lvl: 'deep' },
    { q: 'How do Web Components interoperate with React, Vue and Angular?', a: '<p>Vue and Angular handle them well (Vue: <code>compilerOptions.isCustomElement</code>; Angular: <code>CUSTOM_ELEMENTS_SCHEMA</code>). React 19 sets properties when the element has them and supports custom events via <code>on</code>+event-name props; older React needs refs or wrappers. custom-elements-everywhere.com tracks this per framework.</p>', lvl: 'deep' },
    { q: 'What about SSR and SEO?', a: '<p>Classic custom elements render only after JS runs. Declarative Shadow DOM lets the server emit <code>&lt;template shadowrootmode&gt;</code>, which the parser turns into a shadow root. Lit has SSR support built on this. Content in the light DOM is always in the HTML.</p>', lvl: 'deep' },
    { q: 'When would you choose Web Components over a framework component library?', a: '<p>When the same components must work across several frameworks or server-rendered pages (a company-wide design system), or when you ship an embeddable widget into pages you don’t control. For a single-framework app, native framework components are simpler to integrate with its state and SSR.</p>', lvl: 'core' },
    { q: 'How do you make a custom element accessible?', a: '<p>Prefer wrapping native elements (<code>&lt;button&gt;</code>, <code>&lt;input&gt;</code>) inside the shadow root. Use <code>ElementInternals</code> for default roles and states (<code>internals.role = \'checkbox\'</code>, <code>ariaChecked</code>). Note that ARIA ID references (<code>aria-labelledby</code>) don’t cross shadow boundaries yet; reference targets are being standardised.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'A complete, well-behaved custom element', lang: 'ts', code: `const sheet = new CSSStyleSheet();
sheet.replaceSync(\`:host { display: inline-block; }
  .name { color: var(--brand, #333); font-weight: 600; }\`);

class UserCard extends HTMLElement {
  static observedAttributes = ['name'];
  #root = this.attachShadow({ mode: 'open' });
  #user?: { avatar: string };

  constructor() { super(); this.#root.adoptedStyleSheets = [sheet]; }

  set user(v: { avatar: string }) { this.#user = v; this.render(); }   // rich data: property

  attributeChangedCallback() { this.render(); }                         // simple data: attribute
  connectedCallback() { this.render(); }

  render() {
    this.#root.innerHTML = \`<img part="avatar" alt="" src="\${this.#user?.avatar ?? ''}">
      <span class="name" part="name"></span><slot></slot>\`;
    this.#root.querySelector('.name')!.textContent = this.getAttribute('name') ?? '';   // no XSS
    this.#root.querySelector('img')!.onclick = () =>
      this.dispatchEvent(new CustomEvent('user-select', { detail: this.getAttribute('name'), bubbles: true, composed: true }));
  }
}
customElements.define('user-card', UserCard);`, note: 'Set user-supplied text with <code>textContent</code>, never interpolate it into <code>innerHTML</code>.' },
    { title: 'Using it from Thymeleaf and from Vue', lang: 'text', code: `<!-- Thymeleaf (server-rendered, Spring Boot) -->
<user-card th:attr="name=\${user.name}">Member since 2021</user-card>
<script type="module" src="/js/user-card.js"></script>

<!-- Vue 3 SFC: .prop forces a property binding, @user-select listens to the custom event -->
<user-card :name="u.name" :user.prop="u" @user-select="open" />
// vite.config.ts → vue({ template: { compilerOptions: { isCustomElement: t => t.includes('-') } } })` }
  ]
});
