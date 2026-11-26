IA.register({
  track: 'frontend',
  slug: 'fe-testing',
  title: 'Frontend testing',
  tagline: 'Frontend tests should <b>behave like a user</b>: find things by role and label, click, type, and assert on what is visible. Fast unit and component tests with <b>Vitest</b>, a few end-to-end journeys with <b>Playwright</b>, and visual snapshots for CSS. Flakiness almost always comes from waiting for time instead of for a condition.',
  tldr: {
    problem: 'UI tests that query <code>.btn-primary &gt; span</code> break on every refactor, and e2e suites that <code>sleep(2000)</code> fail randomly on CI. Teams stop trusting them and stop running them.',
    model: 'Layers: <b>static</b> (TypeScript, ESLint) → <b>unit</b> (pure logic) → <b>component</b> (one component, user-style queries) → <b>integration</b> (feature with HTTP mocked by MSW) → <b>e2e</b> (real browser, real build). Test <i>behaviour</i>, not implementation; wait for <i>conditions</i>, not time.',
    hook: '“Why use <code>getByRole</code> instead of a CSS selector or test id?” It finds elements the way users and screen readers do, so the test survives refactors and fails when accessibility breaks.',
    facts: [
      { v: 'Vitest', l: 'Vite-native, Jest-compatible API (<code>describe</code>/<code>it</code>/<code>expect</code>/<code>vi.fn</code>); reuses your Vite config and transforms' },
      { v: 'auto-wait', l: 'Playwright actions wait for elements to be visible, stable, enabled and unobscured before acting' },
      { v: '3 engines', l: 'Playwright runs Chromium, Firefox and WebKit from one API' }
    ]
  },
  intro: {
    what: 'Frontend tests check that the UI does the right thing. Some test small pieces of logic in isolation (like JUnit tests). Some render one component and click it like a user would. Some start a real browser and walk through a whole flow, like logging in and checking out. Each layer trades speed for realism.',
    analogy: { icon: '🚗', title: 'Testing a car', text: 'Unit tests check one part on a bench (the brake pad). Component tests check an assembly (the brake system on a rig). E2E tests drive the car around a track. You need a few test drives, but you can’t find every faulty bolt by driving.' },
    steps: [
      { t: 'Unit test pure logic', d: 'Formatting, validation, reducers. No DOM.', code: "import { expect, test } from 'vitest';\ntest('formats cents', () => expect(formatPrice(1999)).toBe('€19.99'));" },
      { t: 'Component test like a user', d: 'Render, find by role and label, interact, assert on visible output.', code: "render(<Login />);\nawait user.type(screen.getByLabelText('Email'), 'a@b.c');\nawait user.click(screen.getByRole('button', { name: 'Sign in' }));\nexpect(await screen.findByText('Welcome')).toBeInTheDocument();" },
      { t: 'Mock the network, not the code', d: 'MSW intercepts <code>fetch</code> at the HTTP level, so components and data libraries run unchanged.' },
      { t: 'E2E the critical journeys', d: 'Playwright against the production build, with a seeded backend (Testcontainers works well).' },
      { t: 'Run in CI on every PR', d: 'Parallel, with traces and screenshots on failure. Quarantine flaky tests and fix them; don’t just retry forever.' }
    ],
    terms: [
      ['Vitest', 'A test runner built on Vite, with a Jest-compatible API.'],
      ['Testing Library', 'Helpers (<code>@testing-library/react</code>, <code>/vue</code>) to render components and query them as users do.'],
      ['jsdom / happy-dom', 'JS implementations of the DOM that run in Node. Fast, but no real layout or rendering.'],
      ['MSW', 'Mock Service Worker: intercepts network requests in browser and Node for tests and local dev.'],
      ['Playwright', 'Browser automation and e2e test framework from Microsoft.'],
      ['flaky test', 'A test that passes and fails on the same code, usually from timing.']
    ]
  },
  visual: {
    title: 'Layers, waiting and flakiness',
    caption: 'Pick <b>Test layers</b>, <b>Playwright auto-wait</b> or <b>Flaky test</b> and press Play or Step. Timings are typical orders of magnitude, not benchmarks.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Simulated: sleep vs retrying assertion', code: `// Simulation: a "toast" appears after a random delay, like a slow API on CI.
const appearsAfter = () => 40 + Math.random() * 300;
let shownAt;
function startApp() { shownAt = performance.now() + appearsAfter(); }
const toastVisible = () => performance.now() >= shownAt;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fixedSleepTest() { startApp(); await sleep(200); return toastVisible(); }
async function retryingTest(timeout = 1000) {
  startApp(); const t0 = performance.now();
  while (performance.now() - t0 < timeout) { if (toastVisible()) return true; await sleep(10); }
  return false;
}
let a = 0, b = 0;
for (let i = 0; i < 10; i++) { if (await fixedSleepTest()) a++; if (await retryingTest()) b++; }
console.log('fixed 200 ms sleep passes:', a, '/ 10');
console.log('retrying assertion passes:', b, '/ 10');`, note: 'A model of what Playwright’s <code>expect(locator)</code> and Testing Library’s <code>findBy*</code> do: poll a condition until a timeout.' }
    ]
  },
  gotchas: [
    { trap: 'Testing implementation details', code: `expect(wrapper.vm.isOpen).toBe(true);           // internal state\nexpect(container.querySelector('.dd__menu--open')).toBeTruthy();`, why: 'Tests break on harmless refactors (rename state, change CSS classes) and still pass when the user-visible behaviour is broken.', fix: 'Assert what a user perceives: <code>expect(screen.getByRole(\'menu\')).toBeVisible()</code>. Query priority: role → label → placeholder → text → test id as last resort.' },
    { trap: 'Fixed sleeps', code: `await page.click('#save');\nawait page.waitForTimeout(2000);\nexpect(await page.textContent('.toast')).toBe('Saved');`, why: 'Too short on a slow CI runner (flaky), too long everywhere else (slow).', fix: '<code>await expect(page.getByRole(\'status\')).toHaveText(\'Saved\')</code>: retries until it passes or times out. In Testing Library, <code>await screen.findByText()</code>.' },
    { trap: 'Forgetting to await user events and async assertions', code: `user.click(button);                       // missing await\nexpect(page.getByText('Done')).toBeVisible();   // Playwright: missing await`, why: 'The assertion runs before the interaction, or a Playwright web-first assertion becomes an unawaited promise that never fails the test.', fix: 'Always <code>await</code> <code>userEvent</code> calls and Playwright <code>expect</code>. Enable <code>@typescript-eslint/no-floating-promises</code>.' },
    { trap: 'jsdom is not a browser', why: 'No layout (<code>getBoundingClientRect</code> returns zeros), no real CSS, partial APIs (IntersectionObserver, ResizeObserver, <code>dialog</code> behaviour need polyfills or mocks). Tests pass while the real UI is broken.', fix: 'Keep jsdom tests for logic and simple components. Use Vitest browser mode or Playwright component testing for layout-dependent components.' },
    { trap: 'Mocking your own fetch wrapper or data hooks', code: `vi.mock('../api', () => ({ getUser: () => Promise.resolve(user) }));`, why: 'You test against a fake that can drift from the real contract, and skip caching, error and loading logic in TanStack Query or your client.', fix: 'Mock at the HTTP boundary with MSW handlers. Share handlers between tests and local dev. Validate them against the OpenAPI spec from the Spring Boot service.' },
    { trap: 'E2E tests sharing state', why: 'Tests that rely on data created by an earlier test, or on one shared user account, fail when run in parallel or in a different order.', fix: 'Each test creates its own data via API in a fixture, uses unique ids, and logs in through saved <code>storageState</code> rather than the UI every time.' }
  ],
  scenarios: [
    { title: 'CI goes red one run in five',
      symptom: 'The checkout e2e test fails roughly 20% of runs on CI with “element not found”, never locally.',
      diagnose: `npx playwright test --repeat-each=20 --workers=4   # reproduce under load\nnpx playwright show-trace test-results/**/trace.zip # the trace shows the spinner still covering the button`,
      cause: 'The test used <code>page.$(\'.pay-btn\')</code> (an element handle, no auto-wait) and a fixed <code>waitForTimeout(1500)</code> before clicking.',
      fix: 'Use role locators and web-first assertions; wait for the network-driven state, not for time.',
      fixCode: `await page.getByRole('button', { name: 'Pay now' }).click();   // waits until actionable\nawait expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();` },
    { title: 'All tests green, production page blank in Safari',
      symptom: 'A release broke the settings page on iOS only. Unit, component and Chromium e2e tests all passed.',
      diagnose: `npx playwright test --project=webkit   # fails: TypeError on a newer API used in a util`,
      cause: 'The code used a browser API not yet available in the Safari versions many users had. The suite ran only on Chromium, and jsdom polyfilled the API in unit tests.',
      fix: 'Add WebKit and Firefox projects for the smoke suite, set a <code>browserslist</code> target, and lint for unsupported APIs (e.g. <code>eslint-plugin-compat</code>).',
      fixCode: `// playwright.config.ts\nprojects: [\n  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },\n  { name: 'webkit',   use: { ...devices['iPhone 15'] }, grep: /@smoke/ },\n  { name: 'firefox',  use: { ...devices['Desktop Firefox'] }, grep: /@smoke/ },\n]` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which Testing Library query should you try first to find a submit button?', options: ['<code>getByTestId(\'submit\')</code>', '<code>container.querySelector(\'.btn\')</code>', '<code>getByRole(\'button\', { name: \'Submit\' })</code>', '<code>getByText(\'Submit\')</code>'], answer: 2, explain: 'Role + accessible name is the top of the recommended query priority. Test ids are a last resort.' },
    { kind: 'concept', q: 'A component fetches data on mount. Which assertion waits correctly?', options: ['<code>expect(screen.getByText(\'Asha\'))…</code>', '<code>expect(await screen.findByText(\'Asha\'))…</code>', '<code>setTimeout(() =&gt; expect(…), 500)</code>', '<code>expect(screen.queryByText(\'Asha\')).toBeNull()</code>'], answer: 1, explain: '<code>findBy*</code> returns a promise that retries until the element appears (default 1 s timeout). <code>getBy*</code> checks once and throws.' },
    { kind: 'concept', q: 'What is the main reason to mock HTTP with MSW rather than mocking your API module?', options: ['It is faster', 'Your real fetch/data-layer code (headers, errors, caching) runs; only the network is replaced', 'It needs no setup', 'It works only in browsers'], answer: 1, explain: 'Mocking at the boundary tests more of your real code and keeps one set of fake responses shared across tests and dev.' },
    { kind: 'concept', q: 'Playwright: <code>expect(page.getByText(\'Saved\')).toBeVisible()</code> without <code>await</code>. What happens if “Saved” never appears?', options: ['The test fails after 5 s', 'The test may pass, because the unawaited assertion promise is never checked', 'Syntax error', 'It retries forever'], answer: 1, explain: 'Web-first assertions are async. Without await the test can finish first (Playwright may warn). Lint for floating promises.' },
    { kind: 'concept', q: 'Which test layer is best at catching a CSS change that hides the “Buy” button on mobile?', options: ['Unit tests', 'jsdom component tests', 'Visual regression or real-browser e2e at a mobile viewport', 'TypeScript'], answer: 2, explain: 'jsdom has no layout or real CSS. A real browser (Playwright <code>toBeVisible</code> at a mobile viewport, or <code>toHaveScreenshot</code>) sees it.' },
    { kind: 'concept', q: 'What does Playwright’s <code>toHaveScreenshot()</code> do on the first run?', options: ['Fails', 'Writes the baseline image (and fails/marks it as new until committed)', 'Compares to a cloud baseline', 'Skips'], answer: 1, explain: 'There is nothing to compare yet, so it generates the baseline. Later runs diff against it with a configurable threshold. Generate baselines in the same OS/browser as CI (fonts differ).' }
  ],
  interview: [
    { q: 'How would you structure a frontend test strategy?', a: '<p>Static analysis (TypeScript strict, ESLint) catches a whole class of bugs for free. Many fast unit tests for logic. Component and integration tests for most UI behaviour, written with Testing Library and MSW; this is usually where most of the confidence per minute comes from (the “testing trophy” idea). A small set of Playwright e2e tests for critical journeys across browsers. Visual regression for the design system. Accessibility checks with axe in component and e2e tests.</p>', lvl: 'core' },
    { q: 'Vitest vs Jest?', a: '<p>Vitest reuses Vite’s config, plugins and transforms (TS, JSX, Vue SFC) without Babel setup, has native ESM support, watch mode based on the module graph, and a Jest-compatible API, so migration is mostly mechanical. Jest is mature and widely used but needs extra setup for ESM and TS. Vitest also has a browser mode that runs tests in a real browser via Playwright or WebdriverIO.</p>', lvl: 'core' },
    { q: 'Why does Playwright have fewer flaky tests than older Selenium suites?', a: '<p>Auto-waiting on actions (actionability checks), web-first assertions that retry, locators that re-query instead of holding stale element references, strict mode on ambiguous matches, isolated browser contexts per test, and tracing to debug failures. It talks to browsers over CDP and similar protocols rather than WebDriver, which also helps with speed.</p>', lvl: 'core' },
    { q: 'What does “test behaviour, not implementation” mean in a component test?', a: '<p>Interact through the public surface (DOM, roles, labels, events) and assert on output a user or caller would notice (text, visibility, emitted events, network calls). Don’t assert on internal state, private methods, component instance names or CSS class names. Then you can refactor a class component to hooks, or Options API to Composition API, without touching tests.</p>', lvl: 'core' },
    { q: 'How do you handle authentication in e2e tests?', a: '<p>Log in once in a setup project (via UI or API), save the browser <code>storageState</code> (cookies, localStorage) to a file, and reuse it in tests. Use separate users per worker if tests mutate account state. Never test against production identity providers with real credentials in CI.</p>', lvl: 'deep' },
    { q: 'How do you set up the backend for e2e tests?', a: '<p>Options: run the real Spring Boot app with Testcontainers (Postgres, Kafka) and seed via API; use a shared staging environment (realistic but slower and flakier); or mock the API with MSW or Playwright <code>page.route()</code> for frontend-only e2e. Many teams combine a mocked suite on every PR with a smaller real-backend suite before deploy. Contract tests (OpenAPI, Pact) keep mocks honest.</p>', lvl: 'deep' },
    { q: 'What causes flaky frontend tests and how do you fix them?', a: '<ul><li>Fixed sleeps → wait for conditions.</li><li>Shared state and order dependence → isolated data per test.</li><li>Animations → disable in tests or wait for stability.</li><li>Real time and timezones → fake timers, fixed <code>timezoneId</code> and locale.</li><li>Uncontrolled network or third parties → mock or block them.</li></ul><p>Track flake rate, quarantine, fix the root cause. Retries hide problems.</p>', lvl: 'deep' },
    { q: 'What is visual regression testing and what are its pitfalls?', a: '<p>Take screenshots of pages or components and diff them against approved baselines. It catches CSS regressions no assertion would. Pitfalls: fonts and anti-aliasing differ across OSes (generate in a consistent Docker image), dynamic content (mask dates, ads), and approval fatigue if diffs are noisy. Playwright <code>toHaveScreenshot</code>, Storybook-based services, or Chromatic-style tools.</p>', lvl: 'core' },
    { q: 'How do you test a hook or composable?', a: '<p>Prefer testing it through a small component that uses it, as a user would. For reusable hooks, <code>renderHook</code> (React Testing Library) or calling a Vue composable inside a test component (or <code>withSetup</code> helper) works. Use fake timers for debounce/polling and MSW for data fetching.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Component test with Vitest, Testing Library and MSW', lang: 'ts', code: `// vitest.config.ts: test: { environment: 'jsdom', setupFiles: ['./test/setup.ts'] }
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { beforeAll, afterAll, afterEach, expect, test } from 'vitest';

const server = setupServer(
  http.post('/api/orders', async ({ request }) => {
    const body = await request.json() as { sku: string };
    return HttpResponse.json({ id: 42, sku: body.sku }, { status: 201 });
  })
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('places an order', async () => {
  const user = userEvent.setup();
  render(<OrderForm sku="A-1" />);
  await user.click(screen.getByRole('button', { name: 'Place order' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Order #42 placed');
});

test('shows a server error', async () => {
  server.use(http.post('/api/orders', () => HttpResponse.json({ detail: 'Out of stock' }, { status: 409 })));
  const user = userEvent.setup();
  render(<OrderForm sku="A-1" />);
  await user.click(screen.getByRole('button', { name: 'Place order' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Out of stock');
});`, note: 'MSW 2.x syntax (<code>http</code>, <code>HttpResponse</code>). The 409 body mirrors a Spring <code>ProblemDetail</code>.' },
    { title: 'Playwright e2e with saved login', lang: 'ts', code: `// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  use: { baseURL: 'http://localhost:4173', trace: 'on-first-retry' },
  webServer: { command: 'npm run build && npm run preview', port: 4173 },
  projects: [
    { name: 'setup', testMatch: /auth\\.setup\\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' }, dependencies: ['setup'] }
  ]
});

// auth.setup.ts
import { test as setup } from '@playwright/test';
setup('login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('e2e@example.com');
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: '.auth/user.json' });
});

// checkout.spec.ts
test('checkout @smoke', async ({ page }) => {
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
  await expect(page).toHaveScreenshot('confirmation.png', { mask: [page.getByTestId('order-date')] });
});`, note: 'Test the built app (<code>vite preview</code>), not the dev server.' }
  ]
});
