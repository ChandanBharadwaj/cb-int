/* Callbacks → promises → async/await: a timeline of three async calls under sequential awaits and the four combinators. */
IA.widget('callbacks-promises-async', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-cpa-style')) {
    document.head.append(el('style', { id: 'w-cpa-style', text: `
.w-cpa .lane { fill: var(--surface-2); stroke: var(--border); }
.w-cpa .bar { fill: color-mix(in srgb, var(--warn) 45%, var(--surface)); transition: width .8s ease; }
.w-cpa .bar.ok { fill: color-mix(in srgb, var(--ok) 55%, var(--surface)); }
.w-cpa .bar.err { fill: color-mix(in srgb, var(--err) 55%, var(--surface)); }
.w-cpa .bar.ghost { fill: none; stroke: var(--text-3); stroke-dasharray: 4 4; }
.w-cpa .tl { fill: var(--text); font-size: 14px; font-family: var(--mono); }
.w-cpa .tk { fill: var(--text-3); font-size: 12px; }
.w-cpa .cur { stroke: var(--accent); stroke-width: 2.5; transition: transform .8s ease; }
.w-cpa .set { fill: var(--accent); }
.w-cpa .set.err { fill: var(--err); }
.w-cpa .pl { fill: var(--text-2); font-size: 13px; }
.w-cpa-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.w-cpa-pill { font-family: var(--mono); font-size: 12px; border-radius: 999px; padding: 3px 10px; border: 1px solid var(--border); background: var(--surface-2); }
.w-cpa-pill.pending { border-color: var(--warn); } .w-cpa-pill.fulfilled { border-color: var(--ok); color: var(--ok); } .w-cpa-pill.rejected { border-color: var(--err); color: var(--err); }
` }));
  }
  const TASKS = [{ id: 'A', fn: 'getUser()', dur: 300, val: 'user' }, { id: 'B', fn: 'getOrders()', dur: 100, val: 'orders' }, { id: 'C', fn: 'getPrefs()', dur: 200, val: 'prefs' }];
  const CODE = {
    seq: "const user   = await getUser();     // 300 ms\nconst orders = await getOrders();   // 100 ms\nconst prefs  = await getPrefs();    // 200 ms",
    all: "const [user, orders, prefs] = await Promise.all([\n  getUser(), getOrders(), getPrefs(),   // all three start now\n]);",
    allSettled: "const results = await Promise.allSettled([getUser(), getOrders(), getPrefs()]);\n// [{ status: 'fulfilled', value } | { status: 'rejected', reason }, …]",
    race: "const first = await Promise.race([getUser(), getOrders(), getPrefs()]);\n// the first to SETTLE wins, fulfilled or rejected",
    any: "const first = await Promise.any([getUser(), getOrders(), getPrefs()]);\n// the first to FULFIL wins; AggregateError if all reject"
  };
  const MODES = [['seq', 'sequential awaits'], ['all', 'Promise.all'], ['allSettled', 'allSettled'], ['race', 'race'], ['any', 'any']];
  let mode = 'seq'; let fail = 'none'; let k = 0; let gen = 0; let running = false; let speed = 2200; let P = null;

  function plan() {
    const fails = new Set(fail === 'none' ? [] : fail === 'B' ? ['B'] : ['A', 'B', 'C']);
    const spans = {}; let settle;
    const errOf = (t) => `Error: ${t.fn} failed`;
    if (mode === 'seq') {
      let t = 0;
      for (const x of TASKS) {
        spans[x.id] = { s: t, e: t + x.dur, ok: !fails.has(x.id) }; t += x.dur;
        if (fails.has(x.id)) { settle = { t, ok: false, v: errOf(x), why: `The <code>await</code> on ${x.fn} throws. Later calls <b>never start</b>.` }; break; }
      }
      if (!settle) settle = { t, ok: true, v: '[user, orders, prefs]', why: 'Each <code>await</code> waited for the previous call: 300 + 100 + 200 = <b>600 ms</b>. The calls don’t depend on each other, so this is wasted time.' };
    } else {
      TASKS.forEach((x) => { spans[x.id] = { s: 0, e: x.dur, ok: !fails.has(x.id) }; });
      const byEnd = TASKS.slice().sort((a, b) => a.dur - b.dur); const max = Math.max(...TASKS.map((x) => x.dur));
      if (mode === 'all') { const f = byEnd.find((x) => fails.has(x.id)); settle = f ? { t: f.dur, ok: false, v: errOf(f), why: `<b>Fail-fast</b>: the first rejection (${f.fn} at ${f.dur} ms) rejects <code>Promise.all</code> at once. The other results are thrown away.` } : { t: max, ok: true, v: '[user, orders, prefs]', why: 'All three ran in parallel: total = the slowest call, <b>300 ms</b> instead of 600. Results keep the <b>input order</b>, not the finish order.' }; }
      if (mode === 'allSettled') settle = { t: max, ok: true, v: '[' + TASKS.map((x) => fails.has(x.id) ? '{rejected}' : `{fulfilled: ${x.val}}`).join(', ') + ']', why: '<code>allSettled</code> never rejects. It waits for <b>every</b> promise and reports each outcome. Use it when partial results are fine.' };
      if (mode === 'race') { const f = byEnd[0]; settle = { t: f.dur, ok: !fails.has(f.id), v: fails.has(f.id) ? errOf(f) : f.val, why: `The first promise to settle (${f.fn} at ${f.dur} ms) decides, <b>even if it rejected</b>. Typical use: racing a call against a timeout.` }; }
      if (mode === 'any') { const f = byEnd.find((x) => !fails.has(x.id)); settle = f ? { t: f.dur, ok: true, v: f.val, why: `The first <b>fulfilment</b> wins (${f.fn} at ${f.dur} ms). Rejections before it are ignored. Use it for redundant sources (mirrors, replicas).` } : { t: max, ok: false, v: 'AggregateError: All promises were rejected', why: 'Every promise rejected, so <code>any</code> rejects with an <b>AggregateError</b> whose <code>.errors</code> holds all three reasons.' }; }
    }
    const times = new Set([0, settle.t]); Object.values(spans).forEach((sp) => times.add(sp.e));
    return { spans, settle, times: [...times].sort((a, b) => a - b) };
  }
  const seg = (opts, cur, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); set(v); }); s.append(b); }); return s; };
  const segM = seg(MODES, mode, (v) => { mode = v; reset(); }, 'Strategy');
  const segF = seg([['none', 'all succeed'], ['B', 'getOrders() fails'], ['all', 'all fail']], fail, (v) => { fail = v; reset(); }, 'Failures');
  const segS = seg([[3200, 'Slow'], [2200, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const stage = svg('svg', { viewBox: '0 0 640 236', role: 'img', 'aria-label': 'Timeline of three async calls and when the combined result settles' });
  const pills = el('div', { class: 'w-cpa-pills' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-cpa');
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-controls' }, segF), codeHost, el('div', { class: 'w-stage' }, stage), pills,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  const X0 = 130; const SC = 0.7; const xOf = (ms) => X0 + ms * SC;
  let bars = {}; let cur; let setMark;
  function draw() {
    stage.innerHTML = ''; bars = {};
    for (let ms = 0; ms <= 700; ms += 100) stage.append(svg('line', { x1: xOf(ms), y1: 14, x2: xOf(ms), y2: 200, stroke: 'var(--border)', 'stroke-dasharray': '2 5' }), svg('text', { class: 'tk', x: xOf(ms), y: 222, 'text-anchor': 'middle', text: ms + ' ms' }));
    TASKS.forEach((x, i) => {
      const y = 22 + i * 50; const sp = P.spans[x.id];
      stage.append(svg('text', { class: 'tl', x: 8, y: y + 21, text: x.fn }), svg('rect', { class: 'lane', x: X0, y, width: 490, height: 32, rx: 6 }));
      if (sp) { stage.append(svg('rect', { class: 'bar ghost', x: xOf(sp.s), y: y + 4, width: sp.e - sp.s ? (sp.e - sp.s) * SC : 0, height: 24, rx: 5 }));
        const b = svg('rect', { class: 'bar', x: xOf(sp.s), y: y + 4, width: 0, height: 24, rx: 5 }); if (reduced) b.style.transition = 'none'; stage.append(b); bars[x.id] = b; }
      else stage.append(svg('text', { class: 'pl', x: X0 + 12, y: y + 21, text: 'never called' }));
    });
    stage.append(svg('text', { class: 'tl', x: 8, y: 191, text: 'result' }));
    setMark = svg('g', { style: 'display:none' }); stage.append(setMark);
    cur = svg('line', { class: 'cur', x1: X0, y1: 10, x2: X0, y2: 204 }); if (reduced) cur.style.transition = 'none'; stage.append(cur);
  }
  const stateAt = (sp, t) => !sp ? 'not started' : t < sp.s ? 'not started' : t < sp.e ? 'pending' : sp.ok ? 'fulfilled' : 'rejected';
  function render(t) {
    TASKS.forEach((x) => { const sp = P.spans[x.id]; const b = bars[x.id]; if (!b) return;
      const w = Math.max(0, Math.min(t, sp.e) - sp.s) * SC; b.setAttribute('width', w);
      b.setAttribute('class', 'bar' + (t >= sp.e ? (sp.ok ? ' ok' : ' err') : '')); });
    cur.style.transform = `translateX(${(t) * SC}px)`;
    const st = P.settle; setMark.innerHTML = '';
    if (t >= st.t) { setMark.style.display = ''; const x = xOf(st.t);
      setMark.append(svg('circle', { class: 'set' + (st.ok ? '' : ' err'), cx: x, cy: 186, r: 8 }), svg('text', { class: 'pl', x: x + 14 > 470 ? x - 14 : x + 14, y: 191, 'text-anchor': x + 14 > 470 ? 'end' : 'start', text: (st.ok ? 'fulfilled ' : 'rejected ') + (st.v.length > 34 ? st.v.slice(0, 33) + '…' : st.v) })); }
    else setMark.style.display = 'none';
    pills.innerHTML = '';
    TASKS.forEach((x) => { const s = stateAt(P.spans[x.id], t); pills.append(el('span', { class: 'w-cpa-pill ' + s.replace(' ', '-'), text: `${x.fn}: ${s}` })); });
    const cs = t >= st.t ? (st.ok ? 'fulfilled' : 'rejected') : 'pending';
    pills.append(el('span', { class: 'w-cpa-pill ' + cs, html: `<b>${mode === 'seq' ? 'async fn' : 'Promise.' + mode}</b>: ${cs}` }));
  }
  function caption(t, prevT) {
    const parts = [];
    if (t === 0) parts.push(mode === 'seq' ? 'Only <code>getUser()</code> starts. The next line can’t run until its <code>await</code> resolves.' : 'All three calls start <b>at once</b>: each returns a pending promise immediately, and the combinator waits on them.');
    TASKS.forEach((x) => { const sp = P.spans[x.id]; if (sp && sp.e === t && t > 0) parts.push(`<code>${x.fn}</code> ${sp.ok ? 'fulfilled' : '<b>rejected</b>'} at ${t} ms.`); });
    if (P.settle.t === t) parts.push(P.settle.why);
    if (P.settle.t < t && prevT !== undefined) {
      const still = TASKS.filter((x) => { const sp = P.spans[x.id]; return sp && sp.e === t; });
      if (still.length) parts.push('The result was already decided, but this call <b>still ran</b>: promises can’t be cancelled. Pass an <code>AbortSignal</code> if the work should stop.');
    }
    return parts.join(' ');
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; P = plan(); draw(); render(-1);
    cur.style.transform = 'translateX(0px)';
    codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(CODE[mode], 'js') }));
    narr.firstChild.innerHTML = 'Pick a strategy and which calls fail, then press Play. Dashed outlines show how long each call will take; the red line is the clock.';
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `settles at <b>?</b>` }));
    bStep.disabled = false;
  }
  function step() {
    if (k >= P.times.length) return false;
    const t = P.times[k]; const prev = k ? P.times[k - 1] : undefined; k++;
    render(t); narr.firstChild.innerHTML = caption(t, prev);
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `clock <b>${t} ms</b>` }), el('span', { class: 'w-stat', html: `settles at <b>${t >= P.settle.t ? P.settle.t + ' ms' : '?'}</b>` }), el('span', { class: 'w-stat', html: `step <b>${k}/${P.times.length}</b>` }));
    if (k >= P.times.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= P.times.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
