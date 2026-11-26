/* Exceptions basics: one load() function, four inputs. Step through try / except / else / finally, re-raise and an unhandled error reaching the top. */
(function () {
  /* Shared step-through shell for the Python Basics widgets.
     S = [{ label, lang?, code: [lines], intro?, steps: [{ line: n | [n], cap, out?, st }] }]
     renderState(st, scenario) returns an HTML string for the state panel. */
  function pybStepper(root, ctx, S, renderState, opt) {
    const { el, sleep, reduced } = ctx;
    opt = opt || {};
    if (!document.getElementById('w-pyb-base')) {
      document.head.append(el('style', { id: 'w-pyb-base', text: `
.pyb .code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.pyb .code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent;min-height:1.55em}
.pyb .code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.pyb .out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.pyb .out .err{color:var(--err)}
.pyb .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.pyb .grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:12px;align-items:start}
@media (max-width:720px){.pyb .grid{grid-template-columns:1fr}}
.pyb .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:2px 0}
.pyb .cell{font-family:var(--mono);font-size:12.5px;padding:3px 9px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)}
.pyb .cell.hot{border-color:var(--accent);background:var(--accent-soft)}
.pyb .cell.ok{border-color:var(--ok)}
.pyb .cell.bad{border-color:var(--err);color:var(--err)}
.pyb .cell.dim{opacity:.45}
.pyb .cell.new{animation:capin .35s ease both}
.pyb .box{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface-2);margin-bottom:8px}
.pyb .box.hot{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.pyb .box.miss{border-style:dashed;opacity:.75}
.pyb .box.bad{border-color:var(--err)}
.pyb .box h5{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)}
.pyb .kv{font-family:var(--mono);font-size:12.5px;color:var(--text);padding:1px 0}
.pyb .kv b{color:var(--accent)}
.pyb .kv.hot{background:var(--accent-soft);border-radius:4px}
.pyb .note{font-size:12.5px;color:var(--text-2)}
.pyb .pillx{display:inline-block;font-family:var(--mono);font-size:12px;padding:2px 10px;border-radius:999px;border:1px solid var(--border);color:var(--text-3)}
.pyb .pillx.live{border-color:var(--err);color:var(--err);background:color-mix(in srgb,var(--err) 10%,transparent)}
.pyb .pillx.ok{border-color:var(--ok);color:var(--ok)}
.pyb .arrow{color:var(--text-3);font-family:var(--mono)}
` }));
    }
    root.classList.add('pyb');
    let si = 0; let k = 0; let running = false; let gen = 0;
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': opt.segLabel || 'Scenario' });
    S.forEach((s, i) => { const b = el('button', { text: s.label, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { si = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); seg.append(b); });
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const counter = el('span', { class: 'tiny' });
    const codeHost = el('div', { class: 'code' });
    const stateHost = el('div');
    const outHost = el('div', { class: 'out', 'aria-live': 'polite' });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
    root.append(el('div', { class: 'w-controls' }, seg),
      el('div', { class: 'grid' },
        el('div', null, el('div', { class: 'lbl', text: 'code' }), codeHost, el('div', { class: 'lbl', text: 'output (stdout)' }), outHost),
        el('div', null, el('div', { class: 'lbl', text: opt.stateLabel || 'what Python holds' }), stateHost)),
      el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, counter), narr);
    function render() {
      const s = S[si]; const st = k ? s.steps[k - 1] : null;
      const on = st ? [].concat(st.line == null ? [] : st.line) : [];
      codeHost.innerHTML = '';
      s.code.forEach((ln, i) => codeHost.append(el('div', { class: on.includes(i) ? 'on' : '', html: ln ? IA.highlight(ln, s.lang || 'python') : ' ' })));
      const outs = []; for (let i = 0; i < k; i++) if (s.steps[i].out != null) outs.push(s.steps[i]);
      outHost.innerHTML = outs.map((o) => o.err ? '<span class="err">' + ctx.esc(o.out) + '</span>' : ctx.esc(o.out)).join('\n');
      stateHost.innerHTML = renderState(st ? st.st : (s.init || {}), s, k);
      narr.firstChild.innerHTML = st ? st.cap : (s.intro || 'Press <b>Play</b> or <b>Step</b> to run the code one line at a time.');
      counter.textContent = `step ${k} / ${s.steps.length}`;
      bStep.disabled = k >= s.steps.length;
    }
    function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; render(); }
    function step() { if (k >= S[si].steps.length) return false; k++; render(); return true; }
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (reduced) { k = S[si].steps.length; render(); return; }
      if (k >= S[si].steps.length) reset();
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && step()) await sleep(1900);
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    reset();
  }
  IA.widget('exceptions-basics', (root, ctx) => {
    const e = ctx.esc;
    const base = (arg) => ['def load(raw):', '    try:', '        n = int(raw)', '        r = 100 / n', '    except ValueError:', '        print("not a number")', '        return None', '    except ZeroDivisionError as e:', '        print("bad:", e)', '        raise                  # re-raise the same error', '    else:', '        print("ok")            # only if try had no error', '        return r', '    finally:', '        print("cleanup")       # always', '', 'try:', `    print(load(${arg}))`, 'except ZeroDivisionError:', '    print("caller caught it")'];
    const F = (fr, x) => Object.assign({ frames: ['<module>'].concat(fr ? ['load(raw)'] : []) }, x || {});
    const S = [
      { label: 'load("4")', code: base('"4"'), steps: [
        { line: 17, cap: 'The caller calls <code>load("4")</code>. A new frame goes on the call stack.', st: F(true, { block: 'try' }) },
        { line: [1, 2], cap: '<code>int("4")</code> → 4. No error.', st: F(true, { block: 'try', vars: 'n = 4' }) },
        { line: 3, cap: '<code>100 / 4</code> → 25.0 (<code>/</code> always gives a float). The whole <code>try</code> body finished without raising.', st: F(true, { block: 'try', vars: 'n = 4, r = 25.0' }) },
        { line: [10, 11], cap: '<b>else</b> runs only when <code>try</code> raised nothing. Put “success” code here, so it isn’t accidentally covered by the <code>except</code> clauses.', out: 'ok', st: F(true, { block: 'else', vars: 'n = 4, r = 25.0' }) },
        { line: 12, cap: '<code>return r</code>… but there is a <code>finally</code>. The return value is held <b>pending</b> while finally runs.', st: F(true, { block: 'else', pending: '25.0' }) },
        { line: [13, 14], cap: '<b>finally</b> always runs: after success, after a handled error, after an unhandled one, and on <code>return</code>/<code>break</code>.', out: 'cleanup', st: F(true, { block: 'finally', pending: '25.0' }) },
        { line: 17, cap: 'The frame is popped and the caller prints the returned value.', out: '25.0', st: F(false, { done: 'ok' }) }
      ] },
      { label: 'load("x")', code: base('"x"'), steps: [
        { line: 17, cap: 'Call <code>load("x")</code>.', st: F(true, { block: 'try' }) },
        { line: 2, cap: '<code>int("x")</code> <b>raises</b> <code>ValueError</code>. Line 4 is skipped: the rest of the try body never runs.', st: F(true, { block: 'try', exc: "ValueError: invalid literal for int() with base 10: 'x'" }) },
        { line: 4, cap: 'Python checks the <code>except</code> clauses <b>top to bottom</b> and runs the first whose type matches (subclasses match too). <code>ValueError</code> matches.', st: F(true, { block: 'except ValueError', exc: 'ValueError', caught: true }) },
        { line: 5, cap: 'The error is now <b>handled</b>. Execution continues normally inside the handler.', out: 'not a number', st: F(true, { block: 'except ValueError' }) },
        { line: 6, cap: '<code>return None</code> is pending. <code>else</code> is skipped because there was an error.', st: F(true, { block: 'except ValueError', pending: 'None' }) },
        { line: [13, 14], cap: '<b>finally</b> still runs.', out: 'cleanup', st: F(true, { block: 'finally', pending: 'None' }) },
        { line: 17, cap: 'The caller gets <code>None</code>. Returning <code>None</code> on error is common in scripts, but it hides <i>why</i>; in services, prefer raising a clear exception.', out: 'None', st: F(false, { done: 'ok' }) }
      ] },
      { label: 'load("0")', code: base('"0"'), steps: [
        { line: 17, cap: 'Call <code>load("0")</code>.', st: F(true, { block: 'try' }) },
        { line: [2, 3], cap: '<code>int("0")</code> works, then <code>100 / 0</code> raises <code>ZeroDivisionError</code>.', st: F(true, { block: 'try', vars: 'n = 0', exc: 'ZeroDivisionError: division by zero' }) },
        { line: [4, 7], cap: '<code>except ValueError</code> doesn’t match. <code>except ZeroDivisionError as e</code> does, and binds the exception object to <code>e</code>.', st: F(true, { block: 'except ZeroDivisionError', exc: 'ZeroDivisionError', caught: true }) },
        { line: 8, cap: 'Printing an exception shows its message.', out: 'bad: division by zero', st: F(true, { block: 'except ZeroDivisionError' }) },
        { line: 9, cap: 'A bare <code>raise</code> <b>re-raises</b> the current exception with its original traceback, like <code>throw e;</code> in a Java catch block. Use it after logging or cleanup.', st: F(true, { block: 'except ZeroDivisionError', exc: 'ZeroDivisionError (re-raised)' }) },
        { line: [13, 14], cap: '<b>finally</b> runs while the exception is still in flight.', out: 'cleanup', st: F(true, { block: 'finally', exc: 'ZeroDivisionError (in flight)' }) },
        { line: [18, 19], cap: 'The <code>load</code> frame is popped; the exception travels up to the caller, whose <code>except</code> catches it.', out: 'caller caught it', st: F(false, { exc: 'ZeroDivisionError', caught: true, done: 'ok' }) }
      ] },
      { label: 'load([])  unhandled', code: base('[]'), steps: [
        { line: 17, cap: 'Call <code>load([])</code>: a list, not a string.', st: F(true, { block: 'try' }) },
        { line: 2, cap: '<code>int([])</code> raises <code>TypeError</code>.', st: F(true, { block: 'try', exc: "TypeError: int() argument must be ... not 'list'" }) },
        { line: [4, 7], cap: 'Neither handler matches <code>TypeError</code>.', st: F(true, { block: '(no match)', exc: 'TypeError' }) },
        { line: [13, 14], cap: '<b>finally</b> runs anyway. This is why cleanup belongs in <code>finally</code> (or a <code>with</code> block), not after the try.', out: 'cleanup', st: F(true, { block: 'finally', exc: 'TypeError (in flight)' }) },
        { line: 18, cap: 'The caller only catches <code>ZeroDivisionError</code>, so the error keeps going up.', st: F(false, { exc: 'TypeError (in flight)' }) },
        { line: null, cap: 'Nothing caught it. Python prints a <b>traceback</b> to stderr (most recent call <i>last</i>, the opposite of a Java stack trace) and exits with status 1.', out: 'Traceback (most recent call last):\n  ...\nTypeError: int() argument must be a string, a bytes-like object or a real number, not \'list\'', err: true, st: { frames: [], exc: 'TypeError', done: 'crash' } }
      ] }
    ];
    function renderState(st) {
      const frames = st.frames || ['<module>'];
      let h = '<div class="box"><h5>call stack (top = running)</h5>' + (frames.length ? frames.slice().reverse().map((f, i) => `<div class="cell ${i === 0 ? 'hot' : ''}" style="margin:3px 0">${e(f)}</div>`).join('') : '<div class="note">empty: program ended</div>') + '</div>';
      h += `<div class="box ${st.exc && !st.caught ? 'bad' : ''}"><h5>exception</h5>${st.exc ? `<span class="pillx ${st.caught ? 'ok' : 'live'}">${e(st.exc)}${st.caught ? ' · caught' : ''}</span>` : '<span class="pillx">none</span>'}</div>`;
      h += `<div class="box"><h5>now in</h5><div class="kv"><b>${e(st.block || '—')}</b></div>${st.vars ? `<div class="kv">${e(st.vars)}</div>` : ''}${st.pending ? `<div class="kv">pending return: <b>${e(st.pending)}</b></div>` : ''}</div>`;
      if (st.done) h += `<div class="note">${st.done === 'crash' ? '❌ program crashed (exit status 1)' : '✓ program continues'}</div>`;
      return h;
    }
    pybStepper(root, ctx, S, renderState, { segLabel: 'Input', stateLabel: 'stack and exception' });
  });
})();
