IA.register({
  track: 'frontend',
  slug: 'fe-accessibility',
  title: 'Accessibility',
  tagline: 'Accessibility (a11y) means the app works for people using a keyboard, a screen reader, zoom, voice control or high contrast. Most of it is <b>using the right HTML element</b>, managing focus, and testing with a keyboard. ARIA is a patch kit, not a starting point.',
  tldr: {
    problem: 'A UI built from clickable <code>div</code>s looks fine with a mouse, but a keyboard user can’t reach it and a screen reader announces nothing useful. In many markets that is also a legal problem (ADA lawsuits in the US, the European Accessibility Act from June 2025).',
    model: 'Browsers expose an <b>accessibility tree</b>: each element has a <b>role</b> (button, link, checkbox), a <b>name</b> (“Save”) and <b>states</b> (expanded, checked). Native HTML fills these in correctly; ARIA overrides them when you build custom widgets. WCAG is the checklist: perceivable, operable, understandable, robust.',
    hook: '“What is the first rule of ARIA?” Don’t use ARIA if a native HTML element or attribute already does it. <code>&lt;button&gt;</code> beats <code>&lt;div role="button" tabindex="0"&gt;</code> every time.',
    facts: [
      { v: '4.5 : 1', l: 'WCAG AA minimum contrast for normal text (3 : 1 for large text and for UI components)' },
      { v: 'WCAG 2.2', l: 'current W3C recommendation (Oct 2023); added e.g. focus not obscured and 24×24 px minimum target size' },
      { v: 'AA', l: 'the conformance level most laws and contracts reference (A, AA, AAA)' }
    ]
  },
  intro: {
    what: 'People use the web in different ways: some can’t see the screen and listen to a <b>screen reader</b>; some can’t use a mouse and navigate with Tab and Enter; some zoom to 200%; some are colour-blind. An accessible app works for all of them. The browser helps a lot, as long as you use HTML elements for what they mean.',
    analogy: { icon: '♿', title: 'Ramps and lifts in a building', text: 'Stairs work for most visitors, but a building also needs ramps, lifts and signs in braille. Bolting a ramp on later is expensive; designing it in is cheap. Semantic HTML is the built-in lift. ARIA is the bolted-on ramp: useful, but easy to build at the wrong angle.' },
    steps: [
      { t: 'Use semantic elements', d: '<code>&lt;button&gt;</code> for actions, <code>&lt;a href&gt;</code> for navigation, <code>&lt;label&gt;</code> for inputs, headings in order, landmarks (<code>&lt;header&gt;</code>, <code>&lt;nav&gt;</code>, <code>&lt;main&gt;</code>).', code: '<label for="email">Email</label>\n<input id="email" type="email" autocomplete="email" required>', lang: 'text' },
      { t: 'Give everything a name', d: 'Images need <code>alt</code> (empty <code>alt=""</code> if decorative). Icon-only buttons need <code>aria-label</code> or visually hidden text.' },
      { t: 'Make it work with the keyboard', d: 'Everything clickable is reachable with Tab, activates with Enter/Space, and has a visible focus outline.' },
      { t: 'Manage focus on change', d: 'Opening a dialog moves focus in; closing returns it. Route changes in a SPA move focus to the new heading.' },
      { t: 'Test', d: 'Unplug the mouse for 5 minutes. Run axe (browser extension or in tests). Try VoiceOver (macOS/iOS) or NVDA (Windows).' }
    ],
    terms: [
      ['screen reader', 'Software that reads the UI aloud (NVDA, JAWS, VoiceOver, TalkBack).'],
      ['accessibility tree', 'The browser’s parallel tree of roles, names and states that assistive tech reads.'],
      ['ARIA', 'Attributes (<code>role</code>, <code>aria-*</code>) that change what the accessibility tree says. They don’t add behaviour.'],
      ['WCAG', 'Web Content Accessibility Guidelines; testable success criteria at levels A, AA and AAA.'],
      ['focus', 'Which element receives keyboard input right now.'],
      ['live region', 'An element whose text changes are announced automatically.']
    ]
  },
  visual: {
    title: 'What assistive tech actually sees',
    caption: 'Pick <b>div vs button</b>, <b>Modal focus</b> or <b>Live regions</b>, then press Play or Step. Red is what a screen reader or keyboard user misses.'
  },
  gotchas: [
    { trap: 'Clickable divs', code: `<div class="btn" onclick="save()">Save</div>`, lang: 'text', why: 'Not focusable, no role, no Enter/Space activation, not disabled-able. Keyboard and screen-reader users can’t use it.', fix: 'Use <code>&lt;button type="button"&gt;</code>. Reset its styles with CSS if needed. For navigation, use <code>&lt;a href&gt;</code>.' },
    { trap: 'Removing focus outlines', code: `*:focus { outline: none; }`, lang: 'text', why: 'Keyboard users no longer know where they are. It fails WCAG 2.4.7 Focus Visible.', fix: 'Style it instead, and use <code>:focus-visible</code> so mouse clicks don’t show a ring but keyboard focus does.' },
    { trap: 'ARIA that lies', code: `<a role="button" href="/orders">Orders</a>\n<div role="button">…</div>   <!-- no tabindex, no key handler -->\n<button aria-hidden="true">Close</button>`, lang: 'text', why: 'ARIA changes only what is announced, not behaviour. A role without the matching keyboard support is a promise you break. <code>aria-hidden</code> on a focusable element creates a “ghost” that receives focus but is silent.', fix: 'Use native elements. If you must build a custom widget (combobox, tabs), follow the ARIA Authoring Practices Guide pattern exactly, including keys.' },
    { trap: 'Placeholder instead of label', code: `<input placeholder="Email">`, lang: 'text', why: 'Placeholder text disappears when typing, often has poor contrast, and is not a reliable accessible name.', fix: 'A visible <code>&lt;label for&gt;</code>. Use placeholder only for an example format.' },
    { trap: 'Colour as the only signal', why: 'A red border on an invalid field is invisible to many colour-blind users and to screen readers.', fix: 'Add text and an icon, and link the message: <code>aria-invalid="true" aria-describedby="email-err"</code>.' },
    { trap: 'SPA route changes are silent', why: 'Client-side navigation swaps content without a page load, so screen readers don’t announce anything and focus stays on the old link (or is lost).', fix: 'After navigation, update <code>document.title</code> and move focus to the new page’s <code>&lt;h1&gt;</code> (with <code>tabindex="-1"</code>), or announce it via a live region. Many routers offer this.' }
  ],
  scenarios: [
    { title: 'Checkout unusable by keyboard: a complaint becomes a legal letter',
      symptom: 'A customer using a keyboard can’t choose a delivery slot. The slot picker is a grid of styled <code>div</code>s with click handlers.',
      diagnose: `// axe in the browser console or in Playwright\nimport AxeBuilder from '@axe-core/playwright';\nconst r = await new AxeBuilder({ page }).analyze();\n// violations: 'button-name', 'focus-order-semantics'… plus a manual Tab-through`,
      cause: 'Custom controls without native semantics: not focusable, no role, no selected state.',
      fix: 'Rebuild as a radio group (<code>&lt;fieldset&gt;</code> + <code>&lt;input type="radio"&gt;</code> styled as cards). Arrow keys, selection state and form submission come for free. Add axe checks and a keyboard e2e test to CI.',
      fixCode: `<fieldset><legend>Delivery slot</legend>\n  <label class="slot"><input type="radio" name="slot" value="0900">09:00–11:00</label>\n  <label class="slot"><input type="radio" name="slot" value="1100">11:00–13:00</label>\n</fieldset>` },
    { title: 'Screen reader users stuck behind a cookie banner',
      symptom: 'VoiceOver users report they can “see” the page but can’t accept cookies; keyboard focus wanders behind the overlay.',
      diagnose: `// Tab through: focus goes to links hidden under the overlay\n// Accessibility tree: banner is a <div> at the end of <body>, no dialog role`,
      cause: 'A custom overlay with no focus management: focus wasn’t moved in, the background wasn’t inert, and the banner was last in DOM order.',
      fix: 'Use <code>&lt;dialog&gt;</code> with <code>showModal()</code> (focus moves in, background inert, Esc closes), or for a non-modal banner, place it early in DOM order with a clear heading.',
      fixCode: `const dlg = document.querySelector('dialog#consent');\ndlg.showModal();   // modal: background becomes inert, focus moves inside` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which is the best way to build an icon-only “close” control?', options: ['<code>&lt;div onclick&gt;✕&lt;/div&gt;</code>', '<code>&lt;span role="button"&gt;✕&lt;/span&gt;</code>', '<code>&lt;button type="button" aria-label="Close"&gt;✕&lt;/button&gt;</code>', '<code>&lt;img src="x.svg" onclick&gt;</code>'], answer: 2, explain: 'A native button gives focus, keyboard activation and role; <code>aria-label</code> gives the name, since “✕” would be read as “multiplication x”.' },
    { kind: 'concept', q: 'What does <code>role="button"</code> on a <code>&lt;div&gt;</code> add automatically?', options: ['Focusability', 'Enter/Space activation', 'Only the announced role', 'All of the above'], answer: 2, explain: 'ARIA changes semantics only. You must add <code>tabindex="0"</code> and key handlers yourself, which is why a real button is better.' },
    { kind: 'concept', q: 'WCAG 2.x AA contrast for normal body text?', options: ['3 : 1', '4.5 : 1', '7 : 1', '2 : 1'], answer: 1, explain: '4.5 : 1 for normal text; 3 : 1 for large text (18 pt, or 14 pt bold) and for UI component boundaries and focus indicators. 7 : 1 is AAA.' },
    { kind: 'concept', q: 'A decorative background flourish image. Correct markup?', options: ['No alt attribute', '<code>alt=""</code>', '<code>alt="image"</code>', '<code>alt="decorative flourish"</code>'], answer: 1, explain: 'Empty alt tells assistive tech to skip it. A missing alt makes many screen readers read the file name.' },
    { kind: 'concept', q: 'You show “3 items added” in a toast after a fetch. How do screen reader users hear it?', options: ['They can’t', 'Move focus to the toast every time', 'Render the text into an existing <code>role="status"</code> (aria-live="polite") container', 'Use <code>alert()</code>'], answer: 2, explain: 'Live regions announce content changes without moving focus. The container must exist in the DOM before the text changes.' },
    { kind: 'concept', q: 'Which tool finds the largest share of accessibility issues?', options: ['axe / Lighthouse automated checks alone', 'Manual keyboard and screen reader testing combined with automated checks', 'Color contrast checker', 'HTML validator'], answer: 1, explain: 'Automated tools catch only a subset (missing names, contrast, invalid ARIA). Focus order, meaningful names and usable flows need a human.' }
  ],
  interview: [
    { q: 'What is the accessibility tree?', a: '<p>A tree the browser derives from the DOM and CSS, exposing each meaningful node’s role, accessible name, description and states to platform accessibility APIs. Screen readers and voice control read it. You can inspect it in DevTools (Chrome: Elements → Accessibility; Firefox: Accessibility inspector).</p>', lvl: 'core' },
    { q: 'When should you use ARIA?', a: '<p>Only when no native element fits: complex widgets (tabs, combobox, tree, menu), live regions, relationships (<code>aria-controls</code>, <code>aria-describedby</code>) and states (<code>aria-expanded</code>). Then follow the ARIA Authoring Practices pattern, including all keyboard behaviour. “No ARIA is better than bad ARIA.”</p>', lvl: 'core' },
    { q: 'How is the accessible name computed?', a: '<p>In priority order, roughly: <code>aria-labelledby</code>, then <code>aria-label</code>, then native labelling (<code>&lt;label&gt;</code>, <code>alt</code>, <code>&lt;caption&gt;</code>, <code>&lt;legend&gt;</code>), then text content for roles that allow it (buttons, links), then <code>title</code> as last resort. That is why an icon-only button with no label has no name.</p>', lvl: 'deep' },
    { q: 'Explain the POUR principles of WCAG.', a: '<ul><li><b>Perceivable</b>: text alternatives, captions, contrast, content that reflows at 400% zoom.</li><li><b>Operable</b>: keyboard access, no traps, enough time, visible focus, target size.</li><li><b>Understandable</b>: clear labels, predictable behaviour, error identification and suggestions.</li><li><b>Robust</b>: valid semantics so assistive tech can parse it.</li></ul>', lvl: 'core' },
    { q: 'How do you manage focus in a SPA?', a: '<p>On route change, move focus to the main heading (<code>tabindex="-1"</code>) or a skip target, and update the title. In dialogs, move focus in, trap it (native <code>showModal()</code> or <code>inert</code> on the background), and restore it on close. After deleting a list item, move focus to a sensible neighbour. Never let focus fall to <code>&lt;body&gt;</code>.</p>', lvl: 'deep' },
    { q: 'What is tabindex and how should it be used?', a: '<p><code>tabindex="0"</code> adds an element to the natural tab order; <code>"-1"</code> makes it focusable by script but not by Tab; positive values force an order and should be avoided because they break the DOM order everyone else follows. Fix order by fixing the DOM.</p>', lvl: 'core' },
    { q: 'How would you build an accessible custom dropdown?', a: '<p>First ask whether <code>&lt;select&gt;</code> (now increasingly styleable) or a list of radio buttons will do. If not, implement the APG combobox or menu button pattern: correct roles, <code>aria-expanded</code>, <code>aria-activedescendant</code> or roving tabindex, arrow keys, Home/End, Esc, type-ahead, and focus return. Or use a tested headless library (Radix, Headless UI, React Aria).</p>', lvl: 'deep' },
    { q: 'How do you put accessibility into the delivery process?', a: '<p>Design reviews for contrast and focus states; semantic components in the design system; lint rules (eslint-plugin-jsx-a11y, eslint-plugin-vuejs-accessibility); axe in component and e2e tests; Testing Library queries by role, which fail when semantics are missing; periodic manual audits with screen readers; and an accessibility statement with a feedback route.</p>', lvl: 'core' },
    { q: 'What does WCAG 2.2 add over 2.1?', a: '<p>Nine new criteria, including Focus Not Obscured (focused element not hidden by sticky headers), Target Size Minimum (24×24 CSS px at AA, with exceptions), Dragging Movements (a non-drag alternative), Consistent Help, Redundant Entry and Accessible Authentication (no cognitive tests like puzzles). 4.1.1 Parsing was removed.</p>', lvl: 'deep' },
    { q: 'Does accessibility help other users?', a: '<p>Yes: keyboard shortcuts for power users, captions in noisy places, good contrast in sunlight, larger targets on mobile, clear errors for everyone. Semantic HTML also helps SEO and makes tests more robust (query by role).</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Accessible disclosure (show/hide) in React', lang: 'ts', code: `function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section>
      <h3>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
          {title}
        </button>
      </h3>
      <div id={id} hidden={!open}>{children}</div>
    </section>
  );
}`, note: '<code>aria-expanded</code> tells screen readers the state; <code>hidden</code> removes the content from the accessibility tree too.' },
    { title: 'Accessibility checks in Playwright', lang: 'ts', code: `import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('checkout has no detectable a11y violations', async ({ page }) => {
  await page.goto('/checkout');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('delivery slot can be chosen with the keyboard', async ({ page }) => {
  await page.goto('/checkout');
  await page.getByRole('radio', { name: '09:00–11:00' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: '11:00–13:00' })).toBeChecked();
});` },
    { title: 'Server-rendered form errors (Thymeleaf)', lang: 'text', code: `<label for="email">Email</label>
<input id="email" name="email" type="email" th:field="*{email}"
       th:attr="aria-invalid=\${#fields.hasErrors('email')}, aria-describedby='email-err'">
<p id="email-err" th:if="\${#fields.hasErrors('email')}" th:errors="*{email}" class="error"></p>` }
  ]
});
