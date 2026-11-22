/* Context managers: what `with` calls and when, exceptions reaching __exit__, suppression,
   @contextmanager generators, and ExitStack unwinding in LIFO order. */
IA.widget('context-managers', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
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
  if (!document.getElementById('w-pycm-style')) {
    document.head.append(el('style', { id: 'w-pycm-style', text: `
.w-pycm .stk{display:flex;flex-direction:column-reverse;gap:6px;min-height:120px;border:1px solid var(--border);border-radius:10px;padding:8px;background:var(--surface-2)}
.w-pycm .res{font-family:var(--mono);font-size:13px;border:1.5px solid var(--ok);border-radius:8px;padding:6px 10px;background:var(--surface);animation:capin .35s ease both}
.w-pycm .res.closing{border-color:var(--warn);text-decoration:line-through;opacity:.7}
.w-pycm .res.noanim{animation:none}
.w-pycm .empty{color:var(--text-3);font-size:12.5px;text-align:center;margin:auto}
.w-pycm .log{font-family:var(--mono);font-size:12.5px;border:1px solid var(--border);border-radius:10px;padding:8px 10px;min-height:120px;background:var(--surface)}
.w-pycm .log div{padding:1px 0;animation:capin .3s ease both}
.w-pycm .log div.noanim{animation:none}
.w-pycm .log .in{color:var(--accent)} .w-pycm .log .outc{color:var(--accent-2)} .w-pycm .log .ex{color:var(--err)} .w-pycm .log .ok{color:var(--ok)}
.w-pycm .exc{display:inline-block;font-family:var(--mono);font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--border);color:var(--text-3)}
.w-pycm .exc.live{border-color:var(--err);color:var(--err);background:color-mix(in srgb,var(--err) 10%,transparent)}
.w-pycm .exc.done{border-color:var(--ok);color:var(--ok)}
.w-pycm .two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:10px}
@media (max-width:520px){.w-pycm .two{grid-template-columns:1fr}}
` }));
  }
  // step: line, stack (names, bottom first), closing (name being closed), log [cls, text], exc (string | null), excDone
  const S = [
    { label: 'Body succeeds', code: ['with Conn("db") as c:', '    c.query("SELECT 1")', 'print("after")'],
      steps: [
        { line: 0, stack: [], log: ['in', 'mgr = Conn("db")'], cap: 'The expression after <code>with</code> is evaluated first: it produces the <b>context manager</b> object.' },
        { line: 0, stack: ['db connection'], log: ['in', 'c = mgr.__enter__()'], cap: 'Python calls <code>__enter__()</code>. Its <b>return value</b> is what <code>as c</code> binds. (For files it is the file itself; for many objects it is <code>self</code>, but it doesn’t have to be.)' },
        { line: 1, stack: ['db connection'], log: ['', 'body: c.query(...)'], cap: 'The body runs.' },
        { line: 1, stack: ['db connection'], closing: 'db connection', log: ['outc', 'mgr.__exit__(None, None, None)'], cap: 'The body finished normally, so <code>__exit__</code> gets three <code>None</code>s. It runs no matter how the block ends: normal exit, <code>return</code>, <code>break</code> or an exception.' },
        { line: 2, stack: [], log: ['ok', 'after'], cap: 'It is <code>try/finally</code> with a reusable, named cleanup.' }
      ] },
    { label: 'Body raises', code: ['with Conn("db") as c:', '    c.query("SELEC 1")      # bad SQL', 'print("after")'],
      steps: [
        { line: 0, stack: ['db connection'], log: ['in', 'c = mgr.__enter__()'], cap: 'Enter as before.' },
        { line: 1, stack: ['db connection'], exc: 'DbError', log: ['ex', 'raise DbError("syntax error")'], cap: 'The body raises. The rest of the block is skipped.' },
        { line: 1, stack: ['db connection'], closing: 'db connection', exc: 'DbError', log: ['outc', 'mgr.__exit__(DbError, err, tb) → None'], cap: '<code>__exit__</code> receives the exception type, instance and traceback. It can roll back, log, close… and its <b>return value</b> decides what happens next. <code>None</code>/False means “don’t suppress”.' },
        { line: 2, stack: [], exc: 'DbError', log: ['ex', 'DbError propagates; "after" never prints'], cap: 'The connection was cleaned up, <i>and</i> the caller still sees the error. That is the behaviour you want 99% of the time.' }
      ] },
    { label: '__exit__ returns True', code: ['class Ignore:', '    def __enter__(self): return self', '    def __exit__(self, typ, exc, tb):', '        return typ is KeyError', '', 'with Ignore():', '    {}["missing"]', 'print("after")'],
      steps: [
        { line: 5, stack: ['Ignore'], log: ['in', '__enter__() → self'], cap: 'A context manager whose job is to swallow one exception type, like <code>contextlib.suppress(KeyError)</code>.' },
        { line: 6, stack: ['Ignore'], exc: 'KeyError', log: ['ex', "raise KeyError('missing')"], cap: 'The body raises KeyError.' },
        { line: 3, stack: ['Ignore'], closing: 'Ignore', exc: 'KeyError', log: ['outc', '__exit__(KeyError, …) → True'], cap: 'A <b>truthy</b> return value tells Python the exception was handled.' },
        { line: 7, stack: [], exc: 'KeyError', excDone: true, log: ['ok', 'after'], cap: 'Execution continues after the <code>with</code> block. Easy to do by accident: a cleanup method that happens to <code>return True</code> (or returns a non-empty value) silently hides every error.' }
      ] },
    { label: '@contextmanager', code: ['@contextmanager', 'def transaction(conn):', '    conn.begin()', '    try:', '        yield conn', '    except Exception:', '        conn.rollback()', '        raise', '    else:', '        conn.commit()', '', 'with transaction(conn) as tx:', '    tx.execute("UPDATE ...")', '    raise ValueError("boom")'],
      steps: [
        { line: 11, stack: [], log: ['in', 'mgr = transaction(conn)'], cap: '<code>@contextmanager</code> turns a generator into a context manager. Calling it builds the generator; nothing runs yet.' },
        { line: 2, stack: ['transaction'], log: ['in', '__enter__ → next(gen): conn.begin()'], cap: '<code>__enter__</code> runs the generator up to its <code>yield</code>. Everything before <code>yield</code> is setup.' },
        { line: 4, stack: ['transaction'], log: ['in', 'yield conn  → bound to tx'], cap: 'The yielded value becomes <code>as tx</code>. The generator is now <b>paused inside the try</b>.' },
        { line: 13, stack: ['transaction'], exc: 'ValueError', log: ['ex', 'body raises ValueError("boom")'], cap: 'The body raises.' },
        { line: 4, stack: ['transaction'], exc: 'ValueError', log: ['outc', '__exit__ → gen.throw(ValueError)'], cap: '<code>__exit__</code> <b>throws the exception into the generator</b>, at the paused <code>yield</code>. That is why the <code>yield</code> must be inside <code>try</code>: otherwise the cleanup after it never runs.' },
        { line: 6, stack: ['transaction'], closing: 'transaction', exc: 'ValueError', log: ['outc', 'except: conn.rollback(); raise'], cap: 'The generator’s <code>except</code> rolls back and re-raises.' },
        { line: 13, stack: [], exc: 'ValueError', log: ['ex', 'ValueError propagates to the caller'], cap: 'Had the body succeeded, <code>__exit__</code> would call <code>next(gen)</code> instead, reaching the <code>else</code> → commit. If the generator swallows the exception (no re-raise), the error is suppressed.' }
      ] },
    { label: 'ExitStack unwinds', code: ['with ExitStack() as stack:', '    a = stack.enter_context(open("a.csv"))', '    b = stack.enter_context(open("b.csv"))', '    c = stack.enter_context(open("missing.csv"))', '    merge(a, b, c)'],
      steps: [
        { line: 0, stack: [], log: ['in', 'stack = ExitStack().__enter__()'], cap: '<code>ExitStack</code> manages a <b>dynamic</b> number of context managers: a list of files, a set of locks, optional resources.' },
        { line: 1, stack: ['a.csv'], log: ['in', 'enter_context(a): a.__enter__()'], cap: '<code>enter_context</code> enters a manager and pushes its <code>__exit__</code> onto the stack.' },
        { line: 2, stack: ['a.csv', 'b.csv'], log: ['in', 'enter_context(b): b.__enter__()'], cap: 'Second file open.' },
        { line: 3, stack: ['a.csv', 'b.csv'], exc: 'FileNotFoundError', log: ['ex', 'open("missing.csv") raises FileNotFoundError'], cap: 'Opening the third file fails <i>before</i> it is pushed. Without ExitStack, a and b would leak unless you nest three <code>with</code>s or hand-write try/finally.' },
        { line: 3, stack: ['a.csv', 'b.csv'], closing: 'b.csv', exc: 'FileNotFoundError', log: ['outc', 'b.__exit__(FileNotFoundError, …)'], cap: 'The stack unwinds in <b>LIFO</b> order, like nested <code>with</code>s: last opened, first closed.' },
        { line: 3, stack: ['a.csv'], closing: 'a.csv', exc: 'FileNotFoundError', log: ['outc', 'a.__exit__(FileNotFoundError, …)'], cap: 'Then a. Each exit sees the in-flight exception and could suppress it.' },
        { line: 4, stack: [], exc: 'FileNotFoundError', log: ['ex', 'FileNotFoundError propagates'], cap: 'Everything opened was closed. Other tools on the stack: <code>stack.callback(fn, *args)</code>, <code>stack.pop_all()</code> to hand resources to someone else, and <code>AsyncExitStack</code> for async code.' }
      ] }
  ];
  let si = 0, k = 0, gen = 0, running = false;
  const segS = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  S.forEach((s, i) => { const b = el('button', { text: s.label, class: i === si ? 'on' : '' }); b.addEventListener('click', () => { si = i; [...segS.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); segS.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'wpy-code' });
  const stk = el('div', { class: 'stk' });
  const log = el('div', { class: 'log', 'aria-live': 'polite' });
  const exc = el('span', { class: 'exc' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pycm');
  root.append(el('div', { class: 'w-controls' }, segS),
    el('div', { class: 'wpy-grid' },
      el('div', null, el('div', { class: 'wpy-lbl', text: 'code' }), codeHost, el('div', { class: 'wpy-lbl', text: 'exception in flight' }), exc),
      el('div', { class: 'two' },
        el('div', null, el('div', { class: 'wpy-lbl', text: 'open resources (top = newest)' }), stk),
        el('div', null, el('div', { class: 'wpy-lbl', text: 'what Python calls' }), log))),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  function render() {
    const sc = S[si]; const n = sc.steps.length; const cur = k ? sc.steps[k - 1] : null;
    codeHost.innerHTML = '';
    sc.code.forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: ln ? IA.highlight(ln, 'python') : '&nbsp;' })));
    stk.innerHTML = '';
    const prevLen = k > 1 ? sc.steps[k - 2].stack.length : 0;
    (cur ? cur.stack : []).forEach((r, i) => stk.append(el('div', { class: 'res' + (cur.closing === r ? ' closing' : '') + (reduced || i < prevLen ? ' noanim' : ''), text: r + (cur.closing === r ? '  · __exit__' : '') })));
    if (!cur || !cur.stack.length) stk.append(el('div', { class: 'empty', text: 'nothing open' }));
    log.innerHTML = '';
    sc.steps.slice(0, k).forEach((s, i) => log.append(el('div', { class: s.log[0] + (reduced || i < k - 1 ? ' noanim' : ''), text: s.log[1] })));
    if (!k) log.append(el('div', { class: 'tiny', text: '—' }));
    exc.className = 'exc' + (cur && cur.exc ? (cur.excDone ? ' done' : ' live') : '');
    exc.textContent = cur && cur.exc ? (cur.excDone ? cur.exc + ' (suppressed)' : cur.exc) : 'none';
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${n}` }), el('div', { class: 't', html: cur ? cur.cap : 'Pick a scenario and press <b>Play</b> or <b>Step</b>. The log shows every special method Python calls for the <code>with</code> statement.' }));
    bStep.disabled = k >= n;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; render(); }
  function step() { const n = S[si].steps.length; if (k >= n) return false; k++; render(); return k < n; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= S[si].steps.length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2500); }
    if (g === gen) stop();
  });
  reset();
});
