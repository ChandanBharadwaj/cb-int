/* Exceptions: follow what is "in flight" (a return value or an exception) through try / catch / finally, try-with-resources and translation. */
IA.widget('exceptions', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-jt-style')) {
    document.head.append(el('style', { id: 'w-jt-style', text: `
.jt-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 12px; align-items: start; }
@media (max-width: 760px) { .jt-grid { grid-template-columns: 1fr; } }
.jt-code { font-family: var(--mono); font-size: 12.5px; line-height: 1.6; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 0; overflow-x: auto; }
.jt-code div { padding: 0 10px; white-space: pre; border-left: 3px solid transparent; }
.jt-code div.on { background: var(--accent-soft); border-left-color: var(--accent); }
.jt-out { font-family: var(--mono); font-size: 12.5px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 6px 10px; margin-top: 8px; min-height: 2.2em; white-space: pre-wrap; }
.jt-out .h { font-size: 11px; color: var(--text-3); font-family: var(--sans); }
.jt-out .e { color: var(--err); }
.jt-box { fill: var(--surface); stroke: var(--border); stroke-width: 1.2; }
.jt-box.hot { stroke: var(--accent); stroke-width: 2; fill: var(--accent-soft); }
.jt-box.chg { stroke: var(--warn); stroke-width: 2; }
.jt-box.gc { stroke-dasharray: 4 3; opacity: .45; }
.jt-box.bad { stroke: var(--err); stroke-width: 2; }
.jt-box.ok { stroke: var(--ok); stroke-width: 2; }
.jt-box.frame { fill: var(--surface-2); }
.jt-arrow { fill: none; stroke: var(--accent); stroke-width: 1.8; }
.jt-arrow.chg { stroke: var(--warn); stroke-width: 2.4; }
.jt-arrow.gc { opacity: .35; }
` }));
  }
  // st: { fr: [frames, top last], fly: [kind 'exc'|'ret'|'', lines[]], gone: [text], res: [[name, state]], sup: [text], out: [text, err] }
  const SC = {
    swallow: { label: 'finally swallows', code: [
      'static int f() {',
      '  try {',
      '    throw new IllegalStateException("boom");',
      '  } finally {',
      '    return 2;   // -Xlint:finally warns here',
      '  }',
      '}',
      'public static void main(String[] args) {',
      '  System.out.println(f());',
      '}'],
    steps: [
      { l: 8, fr: ['main'], fly: ['', ['nothing pending']], s: 'main calls <code>f()</code>.' },
      { l: 2, fr: ['main', 'f'], fly: ['exc', ['IllegalStateException: boom']], s: 'The try block throws. The exception is now <b>in flight</b>: the JVM looks for a handler, but must run the <code>finally</code> block first.' },
      { l: 4, fr: ['main', 'f'], fly: ['ret', ['return 2']], gone: ['IllegalStateException: boom'], s: 'A <code>return</code> inside <code>finally</code> <b>replaces</b> whatever was in flight. The exception is discarded without a trace: no log, no stack trace. The same happens to a pending <code>return 1</code> from the try block.' },
      { l: 8, fr: ['main'], fly: ['', ['f() returned 2']], gone: ['IllegalStateException: boom'], out: ['2'], s: 'Prints <b>2</b>, and the failure vanished. Never <code>return</code>, <code>break</code>, <code>continue</code> or <code>throw</code> out of a finally block. javac’s <code>-Xlint:finally</code> warns about this.' }
    ] },
    mask: { label: 'Masked by close()', code: [
      'InputStream in = open();',
      'try {',
      '  in.read();     // throws IOException("read failed")',
      '} finally {',
      '  in.close();    // throws IOException("close failed")',
      '}'],
    steps: [
      { l: 0, fr: ['handler'], fly: ['', ['nothing pending']], res: [['in', 'open']], s: 'The pre-Java-7 pattern: open, then close in <code>finally</code>.' },
      { l: 2, fr: ['handler'], fly: ['exc', ['IOException: read failed']], res: [['in', 'open']], s: '<code>read</code> fails. This is the exception you need in the logs: it explains what went wrong.' },
      { l: 4, fr: ['handler'], fly: ['exc', ['IOException: close failed']], gone: ['IOException: read failed'], res: [['in', 'failed to close']], s: '<code>close</code> throws too. An exception thrown from <code>finally</code> <b>replaces</b> the one in flight. The root cause is lost, and the logs show only “close failed”.' },
      { l: 5, fr: ['caller'], fly: ['exc', ['IOException: close failed']], gone: ['IOException: read failed'], res: [['in', 'failed to close']], out: ['IOException: close failed', 1], s: 'The caller sees the wrong error. Try-with-resources fixes this: the next scenario keeps the body’s exception and attaches the close failures as <b>suppressed</b>.' }
    ] },
    twr: { label: 'try-with-resources', code: [
      'record Res(String n) implements AutoCloseable {',
      '  public void close() throws IOException {',
      '    System.out.println("close " + n);',
      '    throw new IOException("close " + n);',
      '  }',
      '}',
      'try (var a = new Res("A"); var b = new Res("B")) {',
      '  throw new IllegalStateException("body");',
      '} catch (Exception e) {',
      '  System.out.println(e.getMessage() + " " + e.getSuppressed().length);',
      '}'],
    steps: [
      { l: 6, fr: ['main'], fly: ['', ['nothing pending']], res: [['a = Res(A)', 'open']], s: 'Resources open left to right. If opening <code>b</code> threw, <code>a</code> would still be closed.' },
      { l: 6, fr: ['main'], fly: ['', ['nothing pending']], res: [['a = Res(A)', 'open'], ['b = Res(B)', 'open']], s: 'Both resources are open.' },
      { l: 7, fr: ['main'], fly: ['exc', ['IllegalStateException: body']], res: [['a = Res(A)', 'open'], ['b = Res(B)', 'open']], s: 'The body throws. Before any <code>catch</code> runs, the resources are closed in <b>reverse order</b>.' },
      { l: 2, fr: ['main', 'b.close'], fly: ['exc', ['IllegalStateException: body']], res: [['a = Res(A)', 'open'], ['b = Res(B)', 'closing']], out: ['close B'], s: '<code>b</code> is closed first and prints “close B”…' },
      { l: 3, fr: ['main', 'b.close'], fly: ['exc', ['IllegalStateException: body']], res: [['a = Res(A)', 'open'], ['b = Res(B)', 'closed']], sup: ['IOException: close B'], s: '…and throws. The main exception keeps travelling. The close failure is attached to it with <code>addSuppressed</code>.' },
      { l: 3, fr: ['main', 'a.close'], fly: ['exc', ['IllegalStateException: body']], res: [['a = Res(A)', 'closed'], ['b = Res(B)', 'closed']], sup: ['IOException: close B', 'IOException: close A'], out: ['close A'], s: 'Then <code>a</code> is closed, prints “close A”, throws, and is suppressed too.' },
      { l: 9, fr: ['main'], fly: ['', ['caught: IllegalStateException']], res: [['a = Res(A)', 'closed'], ['b = Res(B)', 'closed']], sup: ['IOException: close B', 'IOException: close A'], out: ['body 2'], s: 'The catch sees the <b>original</b> exception, with 2 suppressed. Prints <b>body 2</b>. Stack traces print them as <code>Suppressed:</code> blocks.' }
    ] },
    translate: { label: 'Exception translation', code: [
      '// JDBC driver',
      'throw new SQLException("deadlock", "40P01");',
      '// repository',
      'catch (SQLException e) {',
      '  throw new OrderStoreException("save order 42", e);',
      '}',
      '// service: unchecked, so no catch, no throws',
      '// @RestControllerAdvice',
      '@ExceptionHandler(OrderStoreException.class)',
      'ProblemDetail busy(OrderStoreException e) { … 503 … }'],
    steps: [
      { l: 1, fr: ['controller', 'service', 'repository', 'JDBC driver'], fly: ['exc', ['SQLException: deadlock [40P01]']], s: 'A low-level, <b>checked</b> exception from the driver. Its type and SQL state mean nothing to the web layer.' },
      { l: 4, fr: ['controller', 'service', 'repository'], fly: ['exc', ['OrderStoreException: save order 42', '  Caused by: SQLException: deadlock [40P01]']], s: '<b>Translation</b>: the repository catches it and throws an exception in its own terms, <b>passing the cause</b>. Nothing is lost, and it adds context (“order 42”).' },
      { l: 6, fr: ['controller', 'service'], fly: ['exc', ['OrderStoreException: save order 42', '  Caused by: SQLException: deadlock [40P01]']], s: 'It is unchecked, so the service neither catches nor declares it. The <code>@Transactional</code> proxy sees a RuntimeException and <b>rolls back</b>, which is Spring’s default for unchecked exceptions.' },
      { l: 9, fr: ['controller advice'], fly: ['', ['HTTP 503 problem+json, retryable']], out: ['WARN save order 42 (cause logged once, here)'], s: 'One place at the edge maps it to HTTP and logs it <b>once</b>, with the full cause chain. Spring’s <code>SQLExceptionTranslator</code> does the same for JdbcTemplate and JPA. It turns a deadlock into a subclass of <code>PessimisticLockingFailureException</code>.' }
    ] }
  };

  const ids = Object.keys(SC); let cur = ids[0]; let k = -1; let gen = 0; let running = false;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  ids.forEach((id) => { const b = el('button', { text: SC[id].label, class: id === cur ? 'on' : '' }); b.addEventListener('click', () => { cur = id; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const code = el('div', { class: 'jt-code' });
  const out = el('div', { class: 'jt-out', 'aria-label': 'Program output' });
  const W = 520, H = 300;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Call stack, what is in flight, open resources and suppressed exceptions' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, seg),
    el('div', { class: 'jt-grid' }, el('div', null, code, out), el('div', { class: 'w-stage' }, stage)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 11.5, fill: 'var(--text)', 'font-family': 'var(--mono)', text: t }, o || {}));
  const H3 = (x, y, t) => T(x, y, t, { 'font-size': 11, fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-weight': 700 });
  function draw(st) {
    stage.innerHTML = '';
    stage.append(H3(8, 16, 'CALL STACK (top = running)'), H3(208, 16, 'IN FLIGHT'));
    if (!st) { stage.append(T(8, 44, 'press Play or Step', { fill: 'var(--text-3)', 'font-family': 'var(--sans)' })); return; }
    const fr = st.fr.slice().reverse();
    fr.forEach((f, i) => {
      const y = 24 + i * 34;
      stage.append(svg('rect', { class: 'jt-box frame' + (i === 0 ? ' hot' : ''), x: 8, y, width: 186, height: 28, rx: 7 }), T(18, y + 18, f + '()'));
      if (i === 0 && st.fly[0] === 'exc') stage.append(T(186, y + 18, '⚡', { 'text-anchor': 'end', fill: 'var(--err)' }));
    });
    const [kind, lines] = st.fly;
    const fh = 20 + lines.length * 18;
    const fbox = svg('rect', { class: 'jt-box ' + (kind === 'exc' ? 'bad' : kind === 'ret' ? 'ok' : 'frame'), x: 208, y: 24, width: 304, height: fh, rx: 8 });
    stage.append(fbox);
    lines.forEach((t, i) => stage.append(T(218, 24 + 20 + i * 18, (i === 0 ? (kind === 'exc' ? '⚡ ' : kind === 'ret' ? '↩ ' : '') : '') + t, { fill: kind === 'exc' && i === 0 ? 'var(--err)' : 'var(--text)', 'font-weight': i === 0 ? 700 : 400 })));
    if (!reduced && kind) { fbox.style.transition = 'opacity .4s'; fbox.style.opacity = '0.3'; requestAnimationFrame(() => { fbox.style.opacity = '1'; }); }
    let y = 24 + fh + 10;
    (st.gone || []).forEach((g) => {
      stage.append(T(218, y + 12, 'discarded: ' + g, { fill: 'var(--text-3)', 'text-decoration': 'line-through' }));
      y += 18;
    });
    if (st.res) {
      const ry = 168;
      stage.append(H3(208, ry, 'RESOURCES'));
      st.res.forEach(([n, s], i) => {
        const x = 208 + i * 154;
        stage.append(svg('rect', { class: 'jt-box ' + (s === 'open' ? 'hot' : s === 'closing' ? 'chg' : s === 'closed' ? 'gc' : 'bad'), x, y: ry + 8, width: 146, height: 36, rx: 7 }),
          T(x + 8, ry + 23, n, { 'font-size': 11 }), T(x + 8, ry + 38, s, { 'font-size': 10.5, fill: 'var(--text-2)', 'font-family': 'var(--sans)' }));
      });
    }
    if (st.sup && st.sup.length) {
      const sy = 228;
      stage.append(H3(208, sy, 'SUPPRESSED (attached to the primary)'));
      st.sup.forEach((t, i) => stage.append(svg('rect', { class: 'jt-box chg', x: 208, y: sy + 8 + i * 26, width: 304, height: 22, rx: 6 }), T(218, sy + 23 + i * 26, t, { 'font-size': 11 })));
    }
  }
  function paint() {
    const S = SC[cur]; const st = k >= 0 ? S.steps[k] : null;
    code.innerHTML = '';
    S.code.forEach((ln, i) => code.append(el('div', { class: st && st.l === i ? 'on' : '', html: IA.highlight(ln, 'java') || ' ' })));
    out.innerHTML = ''; out.append(el('div', { class: 'h', text: 'stdout / uncaught' }));
    S.steps.slice(0, k + 1).forEach((s) => { if (s.out) out.append(el('div', { class: s.out[1] ? 'e' : '', text: s.out[0] })); });
    draw(st);
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: st ? `${k + 1}/${S.steps.length}` : '0' }), el('div', { class: 't', html: st ? st.s : 'Pick a scenario, then press <b>Play</b> or <b>Step</b>. The <b>in flight</b> box shows the pending return value or exception; watch what replaces it.' }));
    bStep.disabled = k >= S.steps.length - 1;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = -1; paint(); }
  function step() { const S = SC[cur]; if (k >= S.steps.length - 1) return false; k++; paint(); return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= SC[cur].steps.length - 1) k = -1;
    if (reduced) { k = SC[cur].steps.length - 1; paint(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
