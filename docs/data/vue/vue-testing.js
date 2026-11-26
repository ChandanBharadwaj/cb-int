IA.register({
  track: 'vue',
  slug: 'vue-testing',
  title: 'Testing Vue',
  tagline: '<b>Vitest</b> for fast unit and component tests, <b>Vue Test Utils</b> to mount components and drive them like a user, and <b>Playwright</b> for a few end-to-end journeys in real browsers. The recurring trap: Vue updates the DOM asynchronously, so tests must <code>await</code>.',
  tldr: {
    problem: 'UI tests have a reputation for being slow and flaky. Usually that is because they test implementation details, mount too much, or do not wait for Vue’s async updates.',
    model: 'Same pyramid as the backend: many <b>unit</b> tests (composables, stores, utils: like plain JUnit), a solid layer of <b>component</b> tests (props + events in, DOM + emitted events out: like <code>@WebMvcTest</code>), and a few <b>e2e</b> tests (like full <code>@SpringBootTest</code> + browser).',
    hook: '“Why does my assertion see the old text?” Because <code>trigger()</code> and <code>setValue()</code> return a Promise for the next DOM update, and you did not <code>await</code> it.',
    facts: [
      { v: 'Vitest', l: 'is the test runner from the Vite team; it reuses your Vite config and has a Jest-compatible API' },
      { v: '@vue/test-utils 2', l: 'is the official component testing library for Vue 3' },
      { v: '3 engines', l: 'Playwright runs tests on Chromium, Firefox and WebKit' }
    ]
  },
  intro: {
    what: 'A <b>component test</b> renders one component in a fake browser environment (jsdom or happy-dom running in Node), clicks and types on it, and checks what it shows. An <b>e2e test</b> opens the real app in a real browser and clicks through it like a user. <b>Vitest</b> is the runner (think JUnit + Maven Surefire), <b>Vue Test Utils</b> mounts components, <b>Playwright</b> drives browsers.',
    analogy: { icon: '🧪', title: 'Bench tests and test drives', text: 'A component test is testing an engine on a bench: fast, isolated, wired to fake inputs. An e2e test is a test drive on a real road: slow and expensive, but it proves the whole car works. You need many bench tests and a few test drives.' },
    steps: [
      { t: 'Install', d: '<code>npm create vue@latest</code> can add Vitest and Playwright. Set <code>test.environment: \'jsdom\'</code> (or happy-dom) in the Vite/Vitest config.' },
      { t: 'Mount', d: '<code>const w = mount(Comp, { props: { … } })</code>.' },
      { t: 'Interact', d: '<code>await w.get(\'input\').setValue(\'a\')</code>, <code>await w.get(\'button\').trigger(\'click\')</code>.' },
      { t: 'Assert', d: '<code>expect(w.text()).toContain(\'Saved\')</code>, <code>expect(w.emitted(\'save\')).toHaveLength(1)</code>.' },
      { t: 'E2E', d: '<code>npx playwright test</code> against <code>vite preview</code> or a deployed environment.' }
    ],
    terms: [
      ['mount / shallowMount', 'Render with real children / with children replaced by stubs.'],
      ['wrapper', 'The object <code>mount()</code> returns: find elements, trigger events, read emitted events.'],
      ['stub', 'A fake replacement for a child component or function.'],
      ['flushPromises', 'Utility that waits for pending promise callbacks, e.g. a mocked API call.'],
      ['jsdom / happy-dom', 'DOM implementations in Node: no layout, no real rendering.'],
      ['locator', 'Playwright’s auto-waiting handle to an element, e.g. <code>page.getByRole(\'button\')</code>.']
    ]
  },
  visual: {
    title: 'Mount, act, await, assert',
    caption: '<b>Component test</b> shows why <code>await</code> matters after <code>trigger()</code>. <b>Pyramid</b> shows what to test at each level, with code. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Not awaiting DOM updates', code: "w.get('button').trigger('click')\nexpect(w.text()).toContain('1')    // ✗ still '0'", why: 'Vue batches DOM updates to the next tick. <code>trigger</code>/<code>setValue</code> return that tick as a Promise.', fix: '<code>await</code> them. For async work (API calls, timers) also <code>await flushPromises()</code> or use fake timers.' },
    { trap: 'Selecting by CSS classes or text that changes', why: 'Restyling or copy changes break tests that did not change behaviour.', fix: 'Use <code>data-test</code> attributes or accessible roles and labels (Testing Library style; Playwright’s <code>getByRole</code>/<code>getByLabel</code>).' },
    { trap: 'Testing internals through wrapper.vm', code: "expect(w.vm.internalCount).toBe(1)   // couples the test to implementation", why: 'Renaming a variable breaks the test while the component still works. With <code>&lt;script setup&gt;</code> internals are closed by default anyway.', fix: 'Assert on rendered output and <code>emitted()</code> events, the component’s public contract.' },
    { trap: 'Real network in component tests', why: 'Slow, flaky and dependent on a backend.', fix: 'Mock the API module with <code>vi.mock()</code>, or intercept <code>fetch</code> with MSW (Mock Service Worker). Keep real network for a small e2e suite.' },
    { trap: 'Forgetting plugins (router, Pinia, i18n)', why: 'A component calling <code>useRouter()</code> or a store fails when mounted bare (“injection not found”, “no active Pinia”).', fix: 'Pass them in <code>global.plugins</code>: <code>createTestingPinia()</code>, a router built with <code>createMemoryHistory()</code>. Wrap it in a <code>renderWithApp()</code> helper.' },
    { trap: 'Fixed sleeps in e2e tests', code: "await page.waitForTimeout(3000)   // ✗", lang: 'ts', why: 'Too short on CI, wasted time locally: the classic source of flaky e2e suites.', fix: 'Playwright locators and web-first assertions auto-wait: <code>await expect(page.getByText(\'Saved\')).toBeVisible()</code>.' }
  ],
  scenarios: [
    { title: 'Component tests pass locally, fail 1 in 10 on CI',
      symptom: 'An “after save, shows toast” test flaps; reruns go green.',
      diagnose: "await w.get('form').trigger('submit')\nexpect(w.text()).toContain('Saved')   // depends on the mocked API resolving in time",
      cause: 'The mocked API returns a resolved Promise; the component awaits it, then updates state, then Vue updates the DOM. <code>trigger</code> only waited one tick. Locally the timing happened to work.',
      fix: 'Await all pending promises, then the DOM update.',
      fixCode: "await w.get('form').trigger('submit')\nawait flushPromises()\nexpect(w.text()).toContain('Saved')" },
    { title: 'E2E suite takes 40 minutes',
      symptom: 'Every PR waits for a Playwright run of 600 tests that log in through the UI each time.',
      cause: 'Logic that belongs in component tests was tested end-to-end, and every test repeated the login flow.',
      fix: 'Move edge cases down to component tests; keep e2e for critical journeys. Log in once in a setup project and reuse <code>storageState</code>; shard across CI workers.',
      fixCode: "// playwright.config.ts\nprojects: [\n  { name: 'setup', testMatch: /auth\\.setup\\.ts/ },\n  { name: 'chromium', use: { storageState: 'playwright/.auth/user.json' }, dependencies: ['setup'] },\n]" }
  ],
  puzzles: [
    { kind: 'predict', q: 'Counter shows <code>{{ n }}</code> and increments on click. What does the assertion see?', code: "const w = mount(Counter)\nw.get('button').trigger('click')\nconsole.log(w.get('span').text())", options: ['"1"', '"0"', 'undefined', 'It throws'], answer: 1, explain: 'State changed synchronously, but the DOM update is queued. Without <code>await</code>, the text is still <b>"0"</b>.' },
    { kind: 'concept', q: 'What is the main difference between <code>mount</code> and <code>shallowMount</code>?', options: ['shallowMount does not render the template', 'shallowMount replaces child components with stubs', 'mount skips lifecycle hooks', 'shallowMount uses a real browser'], answer: 1, explain: 'shallowMount stubs every child component. Faster and more isolated, but tests can miss integration bugs; many teams prefer mount with selective <code>global.stubs</code>.' },
    { kind: 'concept', q: 'How do you check that a component emitted <code>save</code> with the right payload?', options: ['spy on console.log', '<code>expect(w.emitted(\'save\')?.[0]).toEqual([payload])</code>', 'read w.vm.$emit', 'It cannot be tested'], answer: 1, explain: '<code>emitted()</code> records every event with its argument arrays, in order.' },
    { kind: 'concept', q: 'A component calls <code>useCartStore().checkout()</code> on click. With <code>createTestingPinia()</code>, what does <code>checkout</code> do by default?', options: ['Runs the real action', 'It is a spy that does not run the original (stubbed)', 'Throws', 'Is undefined'], answer: 1, explain: '<code>createTestingPinia</code> stubs actions by default (<code>stubActions: true</code>), so you can assert <code>expect(store.checkout).toHaveBeenCalled()</code>. Pass <code>stubActions: false</code> to run them. It needs a spy function: <code>createSpy: vi.fn</code> unless Vitest globals are enabled.' },
    { kind: 'concept', q: 'Which layer should test “discount code field shows an error for expired codes”?', options: ['E2E only', 'Component test with the API mocked', 'Manual QA', 'Snapshot test of the whole page'], answer: 1, explain: 'It is the component’s behaviour for a given API response. Fast, deterministic, no backend needed. E2E can cover one happy path.' },
    { kind: 'concept', q: 'Why does Playwright’s <code>await expect(locator).toHaveText(\'Saved\')</code> reduce flakiness?', options: ['It retries until the condition holds or a timeout passes', 'It disables animations', 'It runs tests serially', 'It mocks the network'], answer: 0, explain: 'Web-first assertions poll the page until the expectation passes (default 5 s), so no manual sleeps.' }
  ],
  interview: [
    { q: 'How do you structure tests for a Vue app?', a: '<p>Unit tests for composables, stores and pure functions (most of the logic). Component tests for each meaningful component: rendering for given props, user interactions, emitted events, loading/error states with a mocked API. A few Playwright e2e tests for critical journeys against a real build. Lint and type-check (<code>vue-tsc</code>) in CI too.</p>', lvl: 'core' },
    { q: 'How do you test a composable?', a: '<p>If it only uses reactivity, call it directly in the test. If it uses lifecycle hooks or inject, mount a tiny host component that calls it (a <code>withSetup</code> helper), or use <code>effectScope</code>. Check returned refs after <code>await nextTick()</code>.</p>', lvl: 'deep' },
    { q: 'Vue Test Utils vs Testing Library?', a: '<p>Vue Test Utils is the official low-level library: access to <code>emitted()</code>, <code>vm</code>, stubs. <code>@testing-library/vue</code> builds on it and pushes you to query by role, label and text, like a user. Both run in Vitest. Teams often use Testing Library style queries for robustness.</p>', lvl: 'core' },
    { q: 'How do you test a component that uses the router?', a: '<p>Create a real router with <code>createMemoryHistory()</code> and the needed routes, install it via <code>global.plugins</code>, <code>await router.push(\'/x\')</code> and <code>await router.isReady()</code> before mounting. Or stub <code>RouterLink</code> and mock <code>useRoute</code> with <code>vi.mock(\'vue-router\')</code> for pure unit tests.</p>', lvl: 'deep' },
    { q: 'Snapshot tests: useful?', a: '<p>Rarely for components: large snapshots get approved without reading and break on harmless changes. Small inline snapshots of a computed structure or an error message can be fine. Prefer explicit assertions.</p>', lvl: 'core' },
    { q: 'How do you mock HTTP in component tests?', a: '<p>Options: <code>vi.mock(\'@/api/users\')</code> to replace your API module (simple, coupled to module structure), or MSW to intercept <code>fetch</code> at the network layer (realistic, works the same in Vitest and the browser). Then <code>await flushPromises()</code>.</p>', lvl: 'core' },
    { q: 'jsdom vs happy-dom vs Vitest browser mode?', a: '<p>jsdom is the most complete DOM emulation; happy-dom is usually faster but less complete. Neither does layout, so <code>getBoundingClientRect</code> returns zeros. Vitest’s browser mode runs component tests in a real browser (via Playwright or WebdriverIO) when you need real layout, events or CSS.</p>', lvl: 'deep' },
    { q: 'How do you keep a Playwright suite fast and stable?', a: '<ul><li>Role/label locators and web-first assertions, never fixed sleeps.</li><li>Log in once per worker with <code>storageState</code>.</li><li>Seed test data through the API, not the UI.</li><li>Run in parallel and shard on CI; use traces (<code>trace: \'on-first-retry\'</code>) to debug failures.</li></ul>', lvl: 'deep' },
    { q: 'How would you test a component with a debounced search?', a: '<p><code>vi.useFakeTimers()</code>, <code>await setValue(\'abc\')</code>, <code>vi.advanceTimersByTime(300)</code>, then <code>await flushPromises()</code> and assert the mocked API was called once with <code>abc</code>. Restore with <code>vi.useRealTimers()</code>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Component test with Pinia and router', lang: 'ts', code: `// OrderForm.spec.ts  (Vitest + @vue/test-utils 2 + @pinia/testing)
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createRouter, createMemoryHistory } from 'vue-router'
import { describe, it, expect, vi } from 'vitest'
import OrderForm from './OrderForm.vue'
import { useOrderStore } from '@/stores/order'

describe('OrderForm', () => {
  it('submits and shows confirmation', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
    const w = mount(OrderForm, {
      global: { plugins: [createTestingPinia({ createSpy: vi.fn }), router] },
    })
    const store = useOrderStore()
    vi.mocked(store.submit).mockResolvedValue({ id: 42 })

    await w.get('[data-test=qty]').setValue('3')
    await w.get('form').trigger('submit')
    await flushPromises()

    expect(store.submit).toHaveBeenCalledWith({ qty: 3 })
    expect(w.get('[data-test=confirm]').text()).toContain('#42')
  })
})` },
    { title: 'Playwright e2e with API mock', lang: 'ts', code: `import { test, expect } from '@playwright/test'

test('shows an error when the API rejects the coupon', async ({ page }) => {
  await page.route('**/api/coupons/*', (route) =>
    route.fulfill({ status: 422, json: { errors: { code: 'Coupon expired' } } }))
  await page.goto('/checkout')
  await page.getByLabel('Coupon').fill('SUMMER')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('Coupon expired')).toBeVisible()
})` },
    { title: 'Testing a composable directly', lang: 'ts', code: `import { nextTick, ref } from 'vue'
import { useCounter } from './useCounter'

it('doubles', async () => {
  const start = ref(2)
  const { count, double, inc } = useCounter(start)
  inc()
  await nextTick()
  expect(count.value).toBe(3)
  expect(double.value).toBe(6)
})` }
  ]
});
