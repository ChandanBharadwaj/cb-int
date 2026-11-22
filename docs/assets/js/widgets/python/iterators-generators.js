/* Iterators & generators: a pull-based lazy pipeline vs eager lists, and a generator frame pausing at yield. */
IA.widget('iterators-generators', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-py-base')) {
    document.head.append(el('style', { id: 'w-py-base', text: `
.wpy-code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.wpy-code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent}
.wpy-code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.wpy-out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.wpy-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.wpy-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:12px;align-items:start}
@media (max-width:720px){.wpy-grid{grid-template-columns:1fr}}
` }));
  }
  if (!document.getElementById('w-pyit-style')) {
    document.head.append(el('style', { id: 'w-pyit-style', text: `
.w-pyit .bx{fill:var(--surface);stroke:var(--border);stroke-width:1.5}
.w-pyit .bx.act{stroke:var(--accent);stroke-width:2.5;fill:var(--accent-soft)}
.w-pyit .bx.done{stroke:var(--ok);stroke-width:2}
.w-pyit .ln{stroke:var(--border);stroke-width:2}
.w-pyit .ln.act{stroke:var(--accent);stroke-width:2.5}
.w-pyit .pull{stroke:var(--accent-2);stroke-width:1.5;stroke-dasharray:4 3;fill:none}
.w-pyit .wpy-code>div.paused{background:color-mix(in srgb,var(--warn) 16%,transparent);border-left-color:var(--warn)}
.w-pyit .st{display:inline-block;font-family:var(--mono);font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid var(--border);margin-right:6px}
.w-pyit .st.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
` }));
  }
  const MODES = [['lazy', 'Lazy: generators'], ['eager', 'Eager: lists'], ['frame', 'Generator frame']];
  let mode = 'lazy', k = 0, gen = 0, running = false;

  /* ---------- pipeline steps ---------- */
  const LAZY_CODE = ['nums = range(1, 10)', 'squares = (n * n for n in nums)', 'evens = (s for s in squares if s % 2 == 0)', 'first2 = itertools.islice(evens, 2)', 'print(list(first2))'];
  const EAGER_CODE = ['nums = range(1, 10)', 'squares = [n * n for n in nums]', 'evens = [s for s in squares if s % 2 == 0]', 'first2 = evens[:2]', 'print(first2)'];
  function lazySteps() {
    const st = []; const res = []; let computed = 0;
    st.push({ line: 3, act: [], vals: ['', '', '', ''], held: [[], [], [], []], res: [], computed, pull: false, states: ['ready', 'created', 'created', 'created'], cap: 'Lines 1–4 ran, and <b>nothing was computed</b>. Each generator expression just built a paused generator object. Memory used: four tiny objects, however long the input.' });
    st.push({ line: 4, act: [4], vals: ['', '', '', ''], held: [[], [], [], []], res: [], computed, pull: true, states: ['ready', 'created', 'created', 'created'], cap: '<code>list()</code> calls <code>next()</code> on <code>islice</code>, which calls <code>next()</code> on <code>evens</code>, which calls <code>next()</code> on <code>squares</code>, which pulls from <code>range</code>. Demand flows <b>right to left</b>; values flow back left to right.' });
    for (let n = 1; res.length < 2; n++) {
      const sq = n * n; computed++; const ok = sq % 2 === 0; if (ok) res.push(sq);
      st.push({ line: 4, act: ok ? [0, 1, 2, 3, 4] : [0, 1, 2], vals: [String(n), String(sq), ok ? String(sq) : '✗ odd', ok ? String(sq) : ''], held: [[n], [sq], ok ? [sq] : [], ok ? [sq] : []], res: res.slice(), computed, pull: false, states: ['ready', 'suspended', 'suspended', 'suspended'],
        cap: ok ? `n = ${n} → ${sq} is even, so it passes all the way through. Result so far: [${res.join(', ')}].` : `n = ${n} → ${sq} is odd. The filter drops it and immediately pulls the next value. Only one value is in flight at a time.` });
    }
    st.push({ line: 4, act: [], vals: ['', '', '', ''], held: [[], [], [], []], res: res.slice(), computed, pull: false, states: ['ready', 'suspended', 'suspended', 'done'], cap: `<code>islice</code> has its 2 items and stops asking. <b>Only ${computed} squares were computed</b>; 5…9 were never touched. The upstream generators stay suspended until garbage-collected.`, out: '[4, 16]' });
    return st;
  }
  function eagerSteps() {
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9]; const sq = nums.map((n) => n * n); const ev = sq.filter((s) => s % 2 === 0);
    return [
      { line: 0, act: [0], vals: ['', '', '', ''], held: [[], [], [], []], res: [], computed: 0, states: ['ready', '', '', ''], cap: '<code>range</code> is lazy too: it stores start, stop and step, not nine numbers.' },
      { line: 1, act: [0, 1], vals: ['1…9', '', '', ''], held: [[], sq, [], []], res: [], computed: 9, states: ['ready', 'list', '', ''], cap: 'The list comprehension runs to completion <b>now</b>: 9 squares computed and stored.' },
      { line: 2, act: [1, 2], vals: ['', 'all 9', '', ''], held: [[], sq, ev, []], res: [], computed: 9, states: ['ready', 'list', 'list', ''], cap: 'A second full list: the 4 even squares. Both lists are in memory at once.' },
      { line: 3, act: [2, 3], vals: ['', '', 'all 4', ''], held: [[], sq, ev, ev.slice(0, 2)], res: [], computed: 9, states: ['ready', 'list', 'list', 'list'], cap: 'Slicing copies again into a third list.' },
      { line: 4, act: [3, 4], vals: ['', '', '', '2'], held: [[], sq, ev, ev.slice(0, 2)], res: [4, 16], computed: 9, states: ['ready', 'list', 'list', 'list'], cap: 'Same answer, but <b>9 squares computed instead of 4</b>, and memory grew with the input. With a 10 GB log file instead of <code>range(1, 10)</code>, this version runs out of RAM.', out: '[4, 16]' }
    ];
  }
  /* ---------- frame steps ---------- */
  const FRAME_CODE = ['def countdown(n):', '    print("start")', '    while n > 0:', '        yield n', '        n -= 1', '    print("done")'];
  const CALLER = ['g = countdown(2)', 'print(next(g))', 'print(next(g))', 'print(next(g, "exhausted"))'];
  const FRAME = [
    { caller: 0, paused: null, state: 'GEN_CREATED', loc: 'n = 2', out: [], cap: 'Calling a generator function runs <b>none</b> of its body. It returns a generator object holding a frame, parked before the first line.' },
    { caller: 1, paused: 3, state: 'GEN_SUSPENDED', loc: 'n = 2', out: ['start', '2'], cap: '<code>next(g)</code> runs the body until the first <code>yield</code>. It prints “start”, then hands 2 to the caller and <b>freezes</b> the frame, locals and all.' },
    { caller: 2, paused: 3, state: 'GEN_SUSPENDED', loc: 'n = 1', out: ['start', '2', '1'], cap: 'The next <code>next()</code> resumes right after the <code>yield</code>: <code>n -= 1</code>, round the loop, yield 1, freeze again.' },
    { caller: 3, paused: null, state: 'GEN_CLOSED', loc: 'n = 0', out: ['start', '2', '1', 'done', 'exhausted'], cap: 'Now <code>n</code> is 0, the loop ends, “done” prints and the function returns. Returning raises <code>StopIteration</code>; <code>next(g, default)</code> turns that into the default. A <code>for</code> loop catches it for you.' },
    { caller: 3, paused: null, state: 'GEN_CLOSED', loc: '(frame released)', out: ['start', '2', '1', 'done', 'exhausted'], cap: 'A generator is <b>single-use</b>. Iterating <code>g</code> again yields nothing; call <code>countdown(2)</code> again for a fresh one.' }
  ];

  /* ---------- DOM ---------- */
  const segM = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Mode' });
  MODES.forEach(([v, l]) => { const b = el('button', { text: l, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...segM.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); segM.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'wpy-code' });
  const out = el('div', { class: 'wpy-out' });
  const right = el('div');
  const stats = el('div', { class: 'w-stats' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pyit');
  root.append(el('div', { class: 'w-controls' }, segM),
    el('div', { class: 'wpy-grid' }, el('div', null, el('div', { class: 'wpy-lbl', text: 'code' }), codeHost, el('div', { class: 'wpy-lbl', text: 'output' }), out), right),
    stats, el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  let steps = [];
  const W = 640, BW = 104, BY = 26, BH = 54, XS = [6, 132, 258, 384, 516];
  const LABELS = [['range(1, 10)', 'source'], ['n * n', 'squares'], ['s % 2 == 0', 'evens'], ['islice(…, 2)', 'first2'], ['list()', 'consumer']];
  function drawPipeline(s) {
    const stage = svg('svg', { viewBox: `0 0 ${W} 250`, role: 'img', 'aria-label': 'Pipeline of five stages with values flowing between them' });
    for (let i = 0; i < 4; i++) {
      const x1 = XS[i] + BW, x2 = XS[i + 1];
      const a = s && s.act.includes(i) && s.act.includes(i + 1);
      stage.append(svg('line', { class: 'ln' + (a ? ' act' : ''), x1, y1: BY + BH / 2, x2, y2: BY + BH / 2 }));
      const v = s ? s.vals[i] : '';
      if (v) stage.append(svg('text', { x: (x1 + x2) / 2, y: BY + BH / 2 - 7, 'text-anchor': 'middle', 'font-size': 13, 'font-family': 'var(--mono)', 'font-weight': 700, fill: v.startsWith('✗') ? 'var(--err)' : 'var(--accent)', text: v }));
    }
    if (s && s.pull) {
      const p = svg('path', { class: 'pull', d: `M${XS[4] + 20} ${BY + BH + 8} C ${XS[4]} ${BY + BH + 34}, ${XS[0] + 80} ${BY + BH + 34}, ${XS[0] + 50} ${BY + BH + 8}` });
      stage.append(p, svg('text', { x: W / 2, y: BY + BH + 40, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--accent-2)', text: '← next() pulls demand upstream' }));
    }
    LABELS.forEach(([lab, sub], i) => {
      const x = XS[i]; const act = s && s.act.includes(i);
      const done = s && i === 4 && s.res.length === 2;
      stage.append(svg('rect', { class: 'bx' + (act ? ' act' : '') + (done ? ' done' : ''), x, y: BY, width: i === 4 ? 118 : BW, height: BH, rx: 10 }),
        svg('text', { x: x + 8, y: BY - 8, 'font-size': 11, fill: 'var(--text-3)', text: sub }),
        svg('text', { x: x + 8, y: BY + 22, 'font-size': 12, 'font-family': 'var(--mono)', fill: 'var(--text)', text: lab }),
        svg('text', { x: x + 8, y: BY + 42, 'font-size': 11, fill: 'var(--text-3)', text: s ? (s.states[i] || '') : '' }));
      if (i < 4) {
        const held = s ? s.held[i] : [];
        stage.append(svg('text', { x: x + 4, y: 122, 'font-size': 10.5, fill: 'var(--text-3)', text: i === 0 ? 'stores 3 ints' : `holds ${held.length}` }));
        held.forEach((v, j) => {
          const cx = x + 4 + (j % 3) * 34, cy = 132 + Math.floor(j / 3) * 26;
          stage.append(svg('rect', { class: 'bx', x: cx, y: cy, width: 30, height: 20, rx: 5 }), svg('text', { x: cx + 15, y: cy + 14, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'var(--mono)', fill: 'var(--text)', text: String(v) }));
        });
      } else {
        stage.append(svg('text', { x: x + 4, y: 122, 'font-size': 10.5, fill: 'var(--text-3)', text: 'result' }),
          svg('text', { x: x + 4, y: 146, 'font-size': 14, 'font-family': 'var(--mono)', 'font-weight': 700, fill: 'var(--ok)', text: s ? '[' + s.res.join(', ') + ']' : '[]' }));
      }
    });
    return stage;
  }
  function render() {
    const n = steps.length; const cur = k ? steps[k - 1] : null;
    codeHost.innerHTML = ''; right.innerHTML = ''; stats.innerHTML = '';
    if (mode === 'frame') {
      FRAME_CODE.forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.paused === i ? 'paused' : '', html: IA.highlight(ln, 'python') + (cur && cur.paused === i ? '   <span class="tok-c"># ⏸ paused here</span>' : '') })));
      const cl = el('div', { class: 'wpy-code' });
      CALLER.forEach((ln, i) => cl.append(el('div', { class: cur && cur.caller === i ? 'on' : '', html: IA.highlight(ln, 'python') })));
      const states = ['GEN_CREATED', 'GEN_RUNNING', 'GEN_SUSPENDED', 'GEN_CLOSED'];
      right.append(el('div', { class: 'wpy-lbl', text: 'caller' }), cl, el('div', { class: 'wpy-lbl', text: 'inspect.getgeneratorstate(g)' }),
        el('div', null, states.map((x) => el('span', { class: 'st' + (cur && cur.state === x ? ' on' : ''), text: x }))),
        el('div', { class: 'wpy-lbl', text: 'frame locals' }), el('div', { class: 'wpy-out', text: cur ? cur.loc : '(no generator yet)' }));
      out.textContent = cur ? cur.out.join('\n') : '';
    } else {
      (mode === 'lazy' ? LAZY_CODE : EAGER_CODE).forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: IA.highlight(ln, 'python') })));
      right.append(el('div', { class: 'wpy-lbl', text: 'pipeline' }), el('div', { class: 'w-stage' }, drawPipeline(cur)));
      out.textContent = cur && cur.out ? cur.out : '';
      const peak = steps.slice(0, k).reduce((m, s) => Math.max(m, s.held.reduce((a, h) => a + h.length, 0)), 0);
      stats.append(el('span', { class: 'w-stat', html: `squares computed <b>${cur ? cur.computed : 0}</b>` }), el('span', { class: 'w-stat', html: `peak items held <b>${peak}</b>` }));
    }
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${n}` }), el('div', { class: 't', html: cur ? cur.cap : (mode === 'frame' ? 'Press <b>Play</b> or <b>Step</b> to drive a generator with <code>next()</code> and watch where its frame pauses.' : 'Same question both ways: the first two even squares of 1…9. Press <b>Play</b> or <b>Step</b>, then switch mode and compare the counters.') }));
    bStep.disabled = k >= n;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; steps = mode === 'lazy' ? lazySteps() : mode === 'eager' ? eagerSteps() : FRAME; render(); }
  function step() { if (k >= steps.length) return false; k++; render(); return k < steps.length; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= steps.length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2400); }
    if (g === gen) stop();
  });
  reset();
});
