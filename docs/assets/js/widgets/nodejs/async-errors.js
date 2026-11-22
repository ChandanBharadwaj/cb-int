/* Async error handling: follow an error from where it is thrown to where (if anywhere) it is caught:
   call stack frames with try blocks, waiting work, and the process-level handlers. */
IA.widget('async-errors', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-ae-style')) {
    document.head.append(el('style', { id: 'w-ae-style', text: `
.w-ae-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 10px; }
.w-ae-col { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--surface-2); min-height: 120px; min-width: 0; }
.w-ae-col > .h { font-size: 11.5px; color: var(--text-3); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
.w-ae-fr { font-family: var(--mono); font-size: 12.5px; border: 1px solid var(--border); background: var(--surface); border-radius: 7px; padding: 5px 8px; margin-top: 5px; overflow-wrap: anywhere; animation: capin .3s ease both; }
.w-ae-fr.try { border: 2px dashed var(--accent); }
.w-ae-fr.try::before { content: 'try { }'; display: block; font-size: 10.5px; color: var(--accent); }
.w-ae-fr.err { background: color-mix(in srgb, var(--err) 16%, var(--surface)); border-color: var(--err); }
.w-ae-fr.err::after { content: ' ⚡ throws / rejects'; color: var(--err); font-weight: 700; }
.w-ae-fr.ok { background: color-mix(in srgb, var(--ok) 16%, var(--surface)); border-color: var(--ok); }
.w-ae-q { font-family: var(--mono); font-size: 12px; border-left: 4px solid var(--text-3); background: var(--surface); border-radius: 6px; padding: 4px 8px; margin-top: 5px; overflow-wrap: anywhere; }
.w-ae-h { font-size: 12.5px; padding: 5px 8px; border-radius: 7px; margin-top: 5px; border: 1px solid var(--border); background: var(--surface); }
.w-ae-h.hit { border-color: var(--err); background: color-mix(in srgb, var(--err) 14%, var(--surface)); font-weight: 700; }
.w-ae-verdict { display: inline-block; font-weight: 700; border-radius: 999px; padding: 4px 12px; margin-top: 10px; border: 1px solid var(--border); }
.w-ae-verdict.ok { color: var(--ok); border-color: var(--ok); } .w-ae-verdict.crash { color: var(--err); border-color: var(--err); } .w-ae-verdict.esc { color: var(--warn); border-color: var(--warn); }
` }));
  }
  const SC = {
    timer: { label: 'throw in setTimeout', code: `try {\n  setTimeout(() => {\n    throw new Error('boom');\n  }, 10);\n} catch (e) {\n  console.log('caught', e);   // never runs\n}`,
      steps: [
        { st: [{ n: 'main script', try: 1 }], t: 'The <code>try</code> block calls <code>setTimeout</code>. That only <b>registers</b> the callback.' },
        { st: [{ n: 'main script', try: 1 }], q: ['timer (10 ms): () => { throw … }'], t: '<code>setTimeout</code> returns at once. Nothing has thrown, so the try block completes and <code>catch</code> is skipped.' },
        { st: [], q: ['timer (10 ms): () => { throw … }'], t: 'The main script ends. The call stack is empty, and that try/catch <b>no longer exists</b>.' },
        { st: [{ n: 'timer callback', err: 1 }], t: '10 ms later, the timers phase calls the callback on a fresh, empty stack. It throws.' },
        { st: [], h: { ue: 1 }, t: 'The error unwinds the stack and finds no <code>catch</code>. Node emits <code>\'uncaughtException\'</code>, and there is no listener.' },
        { st: [], h: { ue: 1 }, v: 'crash', log: ['Uncaught Error: boom', '    at Timeout._onTimeout (app.js:3:11)', 'process exited with code 1'], t: 'Node prints the stack and exits with code <b>1</b>. Fix: catch inside the callback, or use <code>await setTimeout()</code> from <code>node:timers/promises</code> so the error flows through a promise.' }
      ] },
    floating: { label: 'floating promise', code: `app.post('/orders', (req, res) => {\n  saveOrder(req.body);          // async: no await, no .catch\n  res.status(202).end();\n});\n\nasync function saveOrder(o) {\n  await db.insert(o);           // rejects: duplicate key\n}`,
      steps: [
        { st: [{ n: "POST /orders handler" }, { n: 'saveOrder()' }], t: '<code>saveOrder</code> runs up to its <code>await</code> and returns a pending promise. Nobody keeps a reference to it.' },
        { st: [{ n: 'POST /orders handler' }], q: ['pending: db.insert(o)'], t: 'The handler replies 202 and returns. The promise is now a <b>floating promise</b>.' },
        { st: [{ n: 'saveOrder() resumes', err: 1 }], t: 'The database rejects. <code>saveOrder</code> resumes, the <code>await</code> throws, and with no try its promise is <b>rejected</b>.' },
        { st: [], h: { ur: 1 }, t: 'Once the microtask queue has drained, Node checks for rejected promises without a handler. It finds one and emits <code>\'unhandledRejection\'</code>.' },
        { st: [], h: { ur: 1, mode: 1 }, v: 'crash', log: ['Error: duplicate key value violates unique constraint', 'Node.js v22.x', 'process exited with code 1'], t: 'There is no listener. Since <b>Node 15</b> the default is <code>--unhandled-rejections=throw</code>: the rejection is raised as an uncaught exception. The process exits, taking every in-flight request with it.' }
      ] },
    awaited: { label: 'await inside try', code: `app.post('/orders', async (req, res, next) => {\n  try {\n    await saveOrder(req.body);\n    res.status(201).end();\n  } catch (err) {\n    next(err);                // → error middleware → 409\n  }\n});`,
      steps: [
        { st: [{ n: 'POST /orders handler', try: 1 }, { n: 'saveOrder()' }], t: 'The handler calls <code>saveOrder</code> inside the try and awaits it.' },
        { st: [], q: ['handler suspended at await (try block saved)', 'pending: db.insert(o)'], t: 'At <code>await</code> the handler <b>suspends</b>. Its frame, including the try block, is saved with the promise, not thrown away.' },
        { st: [{ n: 'handler resumes', try: 1, err: 1 }], t: '<code>saveOrder</code> rejects. The handler resumes <b>inside the try</b>, and <code>await</code> throws the reason right there.' },
        { st: [{ n: 'handler', try: 1 }, { n: 'catch (err) → next(err)', ok: 1 }], v: 'ok', log: ['409 Conflict: order already exists'], t: '<code>catch</code> runs and forwards the error to the error middleware. Express 5 also catches a rejected async handler by itself; Express 4 doesn’t.' }
      ] },
    returned: { label: 'return without await', code: `async function getUser(id) {\n  try {\n    return db.findUser(id);     // no await!\n  } catch (err) {\n    return null;                // never runs\n  }\n}`,
      steps: [
        { st: [{ n: 'getUser()', try: 1 }, { n: 'db.findUser()' }], t: '<code>db.findUser</code> returns a pending promise, and <code>return</code> hands it straight back.' },
        { st: [], q: ['getUser’s promise follows db.findUser’s promise'], t: 'The try block <b>ends as soon as</b> the function returns. getUser’s promise now just follows the query’s promise.' },
        { st: [{ n: 'db.findUser rejects', err: 1 }], t: 'The query rejects. getUser’s promise rejects with the same error. The catch was never in the path.' },
        { st: [{ n: 'caller: await getUser(7)', err: 1 }], v: 'esc', log: ['Error: connection terminated (from getUser, not caught there)'], t: 'The <b>caller</b> gets the error. Fix: <code>return await db.findUser(id)</code>, so the rejection is thrown inside this try.' }
      ] },
    callback: { label: 'error-first callback', code: `fs.readFile('missing.json', 'utf8', (err, text) => {\n  if (err) return done(err);       // errors arrive as a value\n  done(null, JSON.parse(text));    // a throw here would crash\n});`,
      steps: [
        { st: [{ n: 'main script' }], q: ['fs.readFile (thread pool)'], t: '<code>readFile</code> starts on the thread pool and returns at once.' },
        { st: [], q: ['fs.readFile (thread pool)'], t: 'The open fails with <code>ENOENT</code> on the pool thread. Nothing throws: no JavaScript runs there.' },
        { st: [{ n: 'readFile callback (err = ENOENT)' }], t: 'In the poll phase the callback runs with <code>err</code> set. In callback APIs the error is a <b>value</b>; check it first.' },
        { st: [{ n: 'readFile callback' }, { n: 'done(err)', ok: 1 }], v: 'ok', log: ['done(Error: ENOENT: no such file or directory)'], t: '<code>return done(err)</code> passes it on. But a <code>throw</code> inside this callback (say <code>JSON.parse</code> on bad input) would be uncaught. Wrap it, or use <code>fs/promises</code> with try/await.' }
      ] },
    abort: { label: 'AbortController timeout', code: `const signal = AbortSignal.timeout(2000);   // Node 17.3+\ntry {\n  const [rates, user] = await Promise.all([\n    fetch(ratesUrl, { signal }),\n    fetch(userUrl, { signal }),\n  ]);\n} catch (err) {\n  if (err.name === 'TimeoutError') return res.status(504).end();\n  throw err;\n}`,
      steps: [
        { st: [{ n: 'handler', try: 1 }], q: ['timer: 2000 ms → abort', 'fetch rates', 'fetch user'], t: 'One signal is shared by both calls. <code>AbortSignal.timeout</code> starts an (unref’d) timer.' },
        { st: [], q: ['timer: 2000 ms → abort', 'fetch user (server hangs)', 'handler suspended at await'], t: 'The handler awaits. The rates call finishes quickly; the user service hangs.' },
        { st: [], q: ['fetch user → aborted'], t: 'At 2 s the signal aborts with a <code>TimeoutError</code>. fetch is listening: it closes the socket and rejects with the signal’s reason.' },
        { st: [{ n: 'handler resumes', try: 1, err: 1 }], t: '<code>Promise.all</code> rejects with the TimeoutError, and the <code>await</code> throws inside the try.' },
        { st: [{ n: 'handler', try: 1 }, { n: 'catch → 504', ok: 1 }], v: 'ok', log: ['504 Gateway Timeout'], t: 'Mapped to 504, and the hanging request is really <b>stopped</b>, not just ignored. A <code>Promise.race</code> against a timer would leave it running.' }
      ] }
  };
  let sid = 'timer'; let k = 0; let gen = 0; let running = false; let speed = 2600;
  const seg = (opts, cur, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); set(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.entries(SC).map(([id, v]) => [id, v.label]), sid, (v) => { sid = v; reset(); }, 'Scenario');
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'codebox' });
  const colStack = el('div', { class: 'w-ae-col' }); const colQ = el('div', { class: 'w-ae-col' }); const colP = el('div', { class: 'w-ae-col' });
  const verdict = el('div');
  const logBox = el('div', { class: 'w-log' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segSc), codeHost, el('div', { class: 'w-ae-grid' }, colStack, colQ, colP), verdict, logBox,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  function render(s) {
    colStack.innerHTML = ''; colStack.append(el('div', { class: 'h', text: 'call stack (top first)' }));
    const st = s ? s.st.slice().reverse() : [];
    if (!st.length) colStack.append(el('div', { class: 'tiny', text: 'empty: no try/catch can see a throw now' }));
    st.forEach((f) => colStack.append(el('div', { class: 'w-ae-fr' + (f.try ? ' try' : '') + (f.err ? ' err' : '') + (f.ok ? ' ok' : ''), text: f.n })));
    colQ.innerHTML = ''; colQ.append(el('div', { class: 'h', text: 'waiting (timers, I/O, promises)' }));
    const q = (s && s.q) || []; if (!q.length) colQ.append(el('div', { class: 'tiny', text: 'nothing' }));
    q.forEach((x) => colQ.append(el('div', { class: 'w-ae-q', text: x })));
    const h = (s && s.h) || {};
    colP.innerHTML = ''; colP.append(el('div', { class: 'h', text: 'process (last resort)' }),
      el('div', { class: 'w-ae-h' + (h.ue ? ' hit' : ''), html: '<code>\'uncaughtException\'</code> listeners: 0' }),
      el('div', { class: 'w-ae-h' + (h.ur ? ' hit' : ''), html: '<code>\'unhandledRejection\'</code> listeners: 0' }),
      el('div', { class: 'w-ae-h' + (h.mode ? ' hit' : ''), html: 'mode: <code>--unhandled-rejections=throw</code> (default since Node 15)' }));
    verdict.innerHTML = '';
    if (s && s.v) verdict.append(el('span', { class: 'w-ae-verdict ' + s.v, text: { ok: '✓ handled', crash: '✗ process crashes (exit 1)', esc: '↗ escapes to the caller' }[s.v] }));
    logBox.innerHTML = ''; ((s && s.log) || ['(no output yet)']).forEach((l) => logBox.append(el('div', { text: l })));
    narr.firstChild.innerHTML = s ? s.t : 'Pick a pattern and press Play or Step. Watch whether a <b>try</b> frame (dashed) is still on the stack when the error happens.';
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `step <b>${k}/${SC[sid].steps.length}</b>` }));
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(SC[sid].code, 'js') })); render(null); bStep.disabled = false; }
  function step() { const st = SC[sid].steps; if (k >= st.length) return false; k++; render(st[k - 1]); if (k >= st.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= SC[sid].steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 800 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
