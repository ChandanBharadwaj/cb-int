/* Frontend testing: test layers, Playwright auto-waiting and why fixed sleeps are flaky. */
IA.widget('fe-testing', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  // Scene format: nodes [id, x, y, w, h, label, sub?]; edges [id, from, to, label?]; steps { hot, ok, err, dim, txt: {id: label}, cap }
  const SCENES = {
  'Test layers': {
    h: 290, intro: 'Four layers, from fast and narrow to slow and broad. Press Play.',
    nodes: [['u', 20, 200, 170, 70, 'Unit', 'Vitest · pure functions'], ['c', 205, 150, 170, 120, 'Component', 'Testing Library / browser mode'],
      ['i', 390, 100, 170, 170, 'Integration', 'pages + mocked API (MSW)'], ['e', 575, 40, 165, 230, 'End-to-end', 'Playwright · real browser']],
    edges: [],
    steps: [
      { hot: ['u'], stats: [['speed', '~ms per test'], ['confidence', 'logic only']], cap: '<b>Unit</b>: formatters, reducers, validation, hooks without UI. Thousands run in seconds. Like JUnit tests of a service class.' },
      { hot: ['c'], stats: [['speed', '~10–100 ms'], ['confidence', 'one component']], cap: '<b>Component</b>: render one component, interact like a user (<code>getByRole</code>, <code>user.click</code>), assert on what is visible. In jsdom/happy-dom, or a real browser with Vitest browser mode.' },
      { hot: ['i'], stats: [['speed', '~100 ms–1 s'], ['confidence', 'a feature']], cap: '<b>Integration</b>: several components, router and state together, with the network mocked at the HTTP layer (MSW). Often the best value per test.' },
      { hot: ['e'], stats: [['speed', 'seconds'], ['confidence', 'whole system']], cap: '<b>E2E</b>: real browser, real build, real or staged backend. Few, critical journeys (login, checkout). Slowest and most expensive to keep stable.' },
      { ok: ['u', 'c', 'i', 'e'], cap: 'Plus <b>static checks</b> (TypeScript, ESLint) under everything and <b>visual regression</b> on top for CSS. Balance by cost of bugs, not by a fixed shape.' }
    ]
  },
  'Playwright auto-wait': {
    h: 260, intro: '<code>await page.getByRole(\'button\', { name: \'Pay\' }).click()</code>. What happens inside? Press Play.',
    nodes: [['loc', 20, 40, 160, 56, 'locator', 'lazy, re-queried'], ['res', 210, 40, 160, 56, 'resolve', 'exactly one element?'],
      ['act', 400, 40, 160, 56, 'actionability', 'visible, stable, enabled'], ['hit', 590, 40, 150, 56, 'receives events', 'not covered'],
      ['clk', 210, 160, 160, 56, 'click', ''], ['exp', 400, 160, 340, 56, 'await expect(...).toBeVisible()', 'retries until timeout']],
    edges: [['e1', 'loc', 'res'], ['e2', 'res', 'act'], ['e3', 'act', 'hit'], ['e4', 'hit', 'clk'], ['e5', 'clk', 'exp']],
    steps: [
      { hot: ['loc'], cap: 'A locator is a <b>query</b>, not an element handle. It is evaluated fresh each time, so re-renders don’t produce stale references.' },
      { hot: ['res', 'e1'], cap: 'Resolve: if 0 elements match, keep waiting; if 2+ match, fail with a strictness error (good: ambiguous tests are bugs).' },
      { hot: ['act', 'e2'], cap: 'Actionability: attached, visible, stable (not animating), enabled. Retries until the action timeout instead of failing immediately.' },
      { hot: ['hit', 'e3'], cap: 'Hit target check: the element must receive the click, not a spinner overlay on top of it.' },
      { ok: ['clk', 'e4'], cap: 'Then the click is performed with real input events.' },
      { ok: ['exp', 'e5'], cap: '<b>Web-first assertions</b> (<code>await expect(locator).toHaveText()</code>) retry too. No <code>waitForTimeout(2000)</code> needed, and that is where most flakiness goes away.' }
    ]
  },
  'Flaky test': {
    h: 230, intro: 'Same test, two ways. Step through.',
    nodes: [['a', 20, 40, 340, 60, 'sleep(1000); expect(text()).toBe("Saved")', 'fixed wait'], ['b', 400, 40, 340, 60, 'await expect(toast).toHaveText("Saved")', 'retrying assertion'],
      ['ra', 20, 140, 340, 60, '', ''], ['rb', 400, 140, 340, 60, '', '']],
    edges: [['e1', 'a', 'ra'], ['e2', 'b', 'rb']],
    steps: [
      { ok: ['ra', 'rb'], txt: { ra: 'API took 300 ms: pass (700 ms wasted)', rb: 'API took 300 ms: pass at 300 ms' }, cap: 'On a fast laptop both pass.' },
      { err: ['ra'], ok: ['rb'], txt: { ra: 'CI under load, API 1.4 s: FAIL', rb: 'API 1.4 s: pass at 1.4 s' }, cap: 'On a loaded CI runner the fixed sleep is too short: a <b>flaky</b> failure. The retrying assertion just waits a bit longer (up to its timeout, 5 s by default).' },
      { ok: ['rb'], txt: { ra: 'raise sleep to 3 s → slow suite, still flaky', rb: 'fast when fast, patient when slow' }, cap: 'Wait for a <b>condition</b>, never for time. Same rule as Awaitility in Java integration tests.' }
    ]
  }
};
  const W = 760; let mode = Object.keys(SCENES)[0]; let k = 0; let running = false; let gen = 0;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  Object.keys(SCENES).forEach((m) => { const b = el('button', { text: m, class: m === mode ? 'on' : '' });
    b.addEventListener('click', () => { mode = m; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { role: 'img', 'aria-label': 'Boxes for unit, component, integration and end-to-end tests and for Playwright action checks' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: '' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, seg), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  const S = () => SCENES[mode];
  const has = (arr, id) => (arr || []).indexOf(id) >= 0;
  function anchor(n, tx, ty) {
    const cx = n[1] + n[3] / 2, cy = n[2] + n[4] / 2; const dx = tx - cx, dy = ty - cy;
    const s = Math.min(dx ? (n[3] / 2 + 4) / Math.abs(dx) : 1e9, dy ? (n[4] / 2 + 4) / Math.abs(dy) : 1e9);
    return [cx + dx * s, cy + dy * s];
  }
  function draw() {
    const sc = S(); const st = k ? sc.steps[k - 1] : (sc.start || {}); const H = sc.h || 300;
    stage.setAttribute('viewBox', `0 0 ${W} ${H}`); stage.innerHTML = '';
    const defs = svg('defs'); ['m-n', 'm-h'].forEach((id, i) => defs.append(svg('marker', { id: id + '-fe-testing', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M0 0L10 5L0 10z', style: `fill:${i ? 'var(--accent)' : 'var(--text-3)'}` })))); stage.append(defs);
    const byId = {}; sc.nodes.forEach((n) => { byId[n[0]] = n; });
    (sc.edges || []).forEach((e) => {
      const a = byId[e[1]], b = byId[e[2]]; if (!a || !b) return;
      const hot = has(st.hot, e[0]), err = has(st.err, e[0]), ok = has(st.ok, e[0]), dim = has(st.dim, e[0]) || (sc.hideEdges && !hot && !err && !ok);
      const [x1, y1] = anchor(a, b[1] + b[3] / 2, b[2] + b[4] / 2); const [x2, y2] = anchor(b, a[1] + a[3] / 2, a[2] + a[4] / 2);
      const col = err ? 'var(--err)' : ok ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)';
      const ln = svg('line', { x1, y1, x2, y2, 'marker-end': `url(#${hot || ok || err ? 'm-h' : 'm-n'}-fe-testing)`, style: `stroke:${col};stroke-width:${hot || ok || err ? 2.4 : 1.4};opacity:${dim ? 0.15 : 1}` });
      if ((hot || ok || err) && !reduced) { ln.style.strokeDasharray = '6 5'; ln.animate && ln.animate([{ strokeDashoffset: 22 }, { strokeDashoffset: 0 }], { duration: 700, iterations: Infinity }); }
      stage.append(ln);
      const lab = (st.etxt || {})[e[0]] != null ? st.etxt[e[0]] : e[3];
      if (lab && !dim) stage.append(svg('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 5, 'text-anchor': 'middle', 'font-size': 11, style: `fill:${hot || ok || err ? col : 'var(--text-3)'}`, text: lab }));
    });
    sc.nodes.forEach((n) => {
      const id = n[0]; const hot = has(st.hot, id), ok = has(st.ok, id), err = has(st.err, id), dim = has(st.dim, id);
      const col = err ? 'var(--err)' : ok ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)';
      const g = svg('g', { style: `opacity:${dim ? 0.3 : 1};transition:opacity .4s` });
      g.append(svg('rect', { x: n[1], y: n[2], width: n[3], height: n[4], rx: 8, style: `fill:${hot || ok || err ? 'var(--accent-soft)' : 'var(--surface-2)'};stroke:${col};stroke-width:${hot || ok || err ? 2.2 : 1.2};transition:all .4s` }));
      const label = (st.txt || {})[id] != null ? st.txt[id] : n[5]; const sub = (st.sub || {})[id] != null ? st.sub[id] : n[6];
      const cx = n[1] + n[3] / 2; const lines = String(label).split('\n');
      const base = n[2] + n[4] / 2 - (lines.length - 1) * 7 - (sub ? 6 : 0) + 5;
      lines.forEach((t, i) => g.append(svg('text', { x: cx, y: base + i * 14, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, style: `fill:${err ? 'var(--err)' : 'var(--text)'}`, text: t })));
      if (sub) g.append(svg('text', { x: cx, y: base + (lines.length - 1) * 14 + 15, 'text-anchor': 'middle', 'font-size': 10.5, style: 'fill:var(--text-3)', text: sub }));
      stage.append(g);
    });
    narr.firstChild.textContent = String(k); narr.lastChild.innerHTML = st.cap || sc.intro || 'Press Play or Step.';
    narr.className = 'caption' + (st.err && st.err.length ? ' err' : st.ok && st.ok.length ? ' ok' : '');
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `step <b>${k}</b>/${sc.steps.length}` }));
    (st.stats || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
    bStep.disabled = k >= sc.steps.length;
  }
  function step() { if (k >= S().steps.length) return false; k++; draw(); return true; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; draw(); }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= S().steps.length) reset();
    if (reduced) { k = S().steps.length; draw(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
