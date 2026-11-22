/* Exceptions: (1) chaining: __cause__ / __context__ links form as code runs, and the resulting traceback;
   (2) except*: an ExceptionGroup is split clause by clause, leftovers re-raised. */
IA.widget('errors-logging', (root, ctx) => {
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
  if (!document.getElementById('w-pyex-style')) {
    document.head.append(el('style', { id: 'w-pyex-style', text: `
.w-pyex .ex{fill:var(--surface);stroke:var(--err);stroke-width:2}
.w-pyex .ex.new{fill:color-mix(in srgb,var(--err) 12%,transparent);stroke-width:3}
.w-pyex .ex.handled{stroke:var(--warn);stroke-dasharray:5 3}
.w-pyex .lk{fill:none;stroke-width:2.2}
.w-pyex .lk.cause{stroke:var(--accent)}
.w-pyex .lk.ctx{stroke:var(--text-3);stroke-dasharray:5 4}
.w-pyex .lk.hid{stroke:var(--border);stroke-dasharray:3 4}
.w-pyex .grp{fill:none;stroke:var(--err);stroke-width:2;stroke-dasharray:6 4}
.w-pyex .cl{fill:var(--surface-2);stroke:var(--border)}
.w-pyex .cl.on{stroke:var(--accent);stroke-width:2.5;fill:var(--accent-soft)}
.w-pyex .pill-g{transition:transform .7s ease}
.w-pyex .tb .dim{color:var(--text-3)}
.w-pyex .tb .msg{color:var(--accent);font-style:italic}
.w-pyex .tb .err{color:var(--err);font-weight:700}
` }));
  }
  /* ---------------- chaining ---------------- */
  const RAISE = { from: 'raise ConfigError(f"missing {path}") from e', implicit: 'raise ConfigError(f"missing {path}")', none: 'raise ConfigError(f"missing {path}") from None' };
  const chainCode = (s) => ['def load_config(path):', '    try:', '        return json.loads(open(path).read())', '    except FileNotFoundError as e:', '        ' + RAISE[s], '', 'def start():', '    try:', '        load_config("app.json")', '    except ConfigError:', '        metrics.incr("config_error")   # bug: never imported', '', 'start()'];
  const CH = [
    { line: 2, vis: 1, nw: 0, cap: '<code>open()</code> raises <b>FileNotFoundError</b>. An exception object is created and starts travelling up the stack, collecting a traceback.' },
    { line: 3, vis: 1, handled: 0, cap: '<code>except FileNotFoundError as e</code> matches (by <code>isinstance</code>). While this block runs, <code>e</code> is “the exception being handled”.' },
    { line: 4, vis: 2, handled: 0, nw: 1, links: true, cap: (s) => s === 'from' ? '<code>raise … from e</code>: the new ConfigError gets <code>__cause__ = e</code> and <code>__suppress_context__ = True</code>. Python also sets <code>__context__ = e</code> automatically, because it was raised inside <code>except</code>.' : s === 'implicit' ? 'No <code>from</code>: Python still links the exceptions, implicitly. <code>__context__ = e</code>, <code>__cause__ = None</code>. The traceback will say “During handling…”, which reads like a second bug.' : '<code>from None</code>: <code>__cause__ = None</code>, <code>__suppress_context__ = True</code>. The FileNotFoundError is still stored in <code>__context__</code>, but it will be <b>hidden</b> in the traceback.' },
    { line: 9, vis: 2, handled: 1, links: true, cap: 'ConfigError propagates out of <code>load_config</code> and is caught in <code>start()</code>. Now <i>it</i> is the exception being handled.' },
    { line: 10, vis: 3, handled: 1, nw: 2, links: true, l2: true, cap: 'A bug in the handler raises <b>NameError</b>. Raised during handling, so its <code>__context__</code> is the ConfigError. Nothing catches it.' },
    { line: 12, vis: 3, links: true, l2: true, tb: true, cap: (s) => 'Unhandled: Python prints the whole chain, <b>oldest first</b>, joined by the sentence that describes each link. Read the <b>last</b> block for what finally failed, and walk up for why.' + (s === 'none' ? ' With <code>from None</code> the original FileNotFoundError is gone from the output.' : '') }
  ];
  const EXN = [['FileNotFoundError', "[Errno 2] … 'app.json'"], ['ConfigError', 'missing app.json'], ['NameError', "name 'metrics' is not defined"]];
  function traceback(s) {
    const L = [];
    const blk = (frames, err) => { L.push(['', 'Traceback (most recent call last):']); frames.forEach((f) => L.push(['dim', '  File "app.py", ' + f])); L.push(['err', err]); };
    if (s !== 'none') {
      blk(['line 3, in load_config'], "FileNotFoundError: [Errno 2] No such file or directory: 'app.json'");
      L.push(['', ''], ['msg', s === 'from' ? 'The above exception was the direct cause of the following exception:' : 'During handling of the above exception, another exception occurred:'], ['', '']);
    }
    blk(['line 9, in start', 'line 5, in load_config'], 'ConfigError: missing app.json');
    L.push(['', ''], ['msg', 'During handling of the above exception, another exception occurred:'], ['', '']);
    blk(['line 13, in <module>', 'line 11, in start'], "NameError: name 'metrics' is not defined");
    return L;
  }
  /* ---------------- except* ---------------- */
  const GCODE = ['try:', '    import_rows(rows)     # raises ExceptionGroup("4 rows invalid", [...])', 'except* ValueError as eg:', '    report(eg.exceptions)   # runs ONCE, with both ValueErrors', 'except* KeyError as eg:', '    log.warning("missing keys: %d", len(eg.exceptions))', '# no clause matched TypeError → re-raised as a group'];
  const KIDS = [['ValueError', 'row 2'], ['KeyError', 'row 5'], ['ValueError', 'row 7'], ['TypeError', 'row 9']];
  // row: 0 = in the raised group, 1 = except* ValueError, 2 = except* KeyError, 3 = leftover
  const GS = [
    { line: 1, rows: [0, 0, 0, 0], cap: '<code>import_rows</code> validated every row and raised <b>one</b> <code>ExceptionGroup</code> holding all four failures, instead of stopping at the first.' },
    { line: 2, rows: [1, 0, 1, 0], cl: 1, cap: '<code>except* ValueError</code> calls <code>eg.split(ValueError)</code>: the matching exceptions move into a new group (same message), the rest stays behind.' },
    { line: 3, rows: [1, 0, 1, 0], cl: 1, cap: 'The handler runs <b>once</b>, with <code>eg = ExceptionGroup("4 rows invalid", [ValueError, ValueError])</code>. Not once per exception.' },
    { line: 4, rows: [1, 2, 1, 0], cl: 2, cap: 'Unlike plain <code>except</code>, matching continues: <code>except* KeyError</code> takes the KeyError from what is left. Several clauses can run for one raise.' },
    { line: 5, rows: [1, 2, 1, 0], cl: 2, cap: 'Its handler runs once too. Inside an <code>except*</code> block, <code>return</code>, <code>break</code> and <code>continue</code> are not allowed.' },
    { line: 6, rows: [1, 2, 1, 3], cl: 3, cap: 'The TypeError matched no clause, so at the end of the <code>try</code> statement it is <b>re-raised</b> as <code>ExceptionGroup("4 rows invalid", [TypeError])</code>. Had nothing been left, execution would simply continue.' }
  ];
  let mode = 'chain', style = 'from', k = 0, gen = 0, running = false;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }); opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segMode = seg([['chain', 'Chaining'], ['group', 'ExceptionGroup + except*']], mode, (v) => { mode = v; segStyle.style.display = v === 'chain' ? '' : 'none'; reset(); }, 'Mechanism');
  const segStyle = seg([['from', 'raise … from e'], ['implicit', 'raise … (no from)'], ['none', 'raise … from None']], style, (v) => { style = v; reset(); }, 'How ConfigError is raised');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'wpy-code' });
  const stage = svg('svg', { viewBox: '0 0 640 290', role: 'img', 'aria-label': 'Exception objects and the links between them' });
  const out = el('div', { class: 'wpy-out tb' });
  const outLbl = el('div', { class: 'wpy-lbl', text: 'output' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pyex');
  root.append(el('div', { class: 'w-controls' }, segMode, segStyle), el('div', { class: 'wpy-lbl', text: 'code' }), codeHost,
    el('div', { class: 'w-stage', style: { marginTop: '8px' } }, stage), outLbl, out,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);
  const steps = () => (mode === 'chain' ? CH : GS);

  function renderChain(cur) {
    stage.setAttribute('viewBox', '0 0 640 200');
    stage.innerHTML = '';
    const X = [24, 236, 448], Y = 70, W = 168, H = 70;
    const vis = cur ? cur.vis : 0;
    for (let i = 0; i < vis; i++) {
      const cls = 'ex' + (cur.nw === i ? ' new' : cur.handled === i ? ' handled' : '');
      stage.append(svg('rect', { class: cls, x: X[i], y: Y, width: W, height: H, rx: 12 }),
        svg('text', { x: X[i] + 12, y: Y + 26, 'font-size': 13.5, 'font-weight': 700, 'font-family': 'var(--mono)', fill: 'var(--err)', text: EXN[i][0] }),
        svg('text', { x: X[i] + 12, y: Y + 48, 'font-size': 11, 'font-family': 'var(--mono)', fill: 'var(--text-2)', text: EXN[i][1] }));
      if (cur.handled === i) stage.append(svg('text', { x: X[i] + W / 2, y: Y + H + 18, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--warn)', text: 'being handled' }));
    }
    if (!vis) stage.append(svg('text', { x: 320, y: 110, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--text-3)', text: 'no exception yet' }));
    const arrow = (x1, x2, y, cls, label, up) => {
      const mid = (x1 + x2) / 2; const cy = up ? y - 40 : y + 40;
      const p = svg('path', { class: 'lk ' + cls, d: `M${x1} ${y} Q ${mid} ${cy} ${x2} ${y}` });
      stage.append(p, svg('polygon', { points: `${x2},${y} ${x2 + 9},${y + (up ? -6 : 6)} ${x2 + 10},${y + (up ? 4 : -4)}`, fill: cls === 'cause' ? 'var(--accent)' : cls === 'hid' ? 'var(--border)' : 'var(--text-3)' }),
        svg('text', { x: mid, y: up ? y - 26 : y + 36, 'text-anchor': 'middle', 'font-size': 11.5, 'font-family': 'var(--mono)', fill: cls === 'cause' ? 'var(--accent)' : 'var(--text-3)', text: label }));
    };
    if (cur && cur.links) {
      if (style === 'from') { arrow(X[1] + 30, X[0] + W - 10, Y, 'cause', '__cause__', true); arrow(X[1] + 30, X[0] + W - 10, Y + H, 'ctx', '__context__ (suppressed)', false); }
      else if (style === 'implicit') arrow(X[1] + 30, X[0] + W - 10, Y + H, 'ctx', '__context__', false);
      else { arrow(X[1] + 30, X[0] + W - 10, Y + H, 'hid', '__context__ (hidden: from None)', false); stage.append(svg('text', { x: X[1] + W / 2, y: Y - 14, 'text-anchor': 'middle', 'font-size': 11.5, 'font-family': 'var(--mono)', fill: 'var(--text-3)', text: '__cause__ = None' })); }
    }
    if (cur && cur.l2) arrow(X[2] + 30, X[1] + W - 10, Y + H, 'ctx', '__context__', false);
    out.innerHTML = '';
    if (cur && cur.tb) traceback(style).forEach(([c, t]) => out.append(el('div', { class: c, text: t || ' ' })));
    else out.append(el('div', { class: 'dim', text: '(the traceback appears when the last exception goes unhandled)' }));
  }

  // persistent pills so they can glide between rows
  let pills = null;
  function renderGroup(cur) {
    stage.setAttribute('viewBox', '0 0 640 290');
    let fresh = false;
    if (!pills || !stage.contains(pills[0])) {
      stage.innerHTML = '';
      const rows = [['raised: ExceptionGroup("4 rows invalid")', 14], ['except* ValueError', 86], ['except* KeyError', 152], ['left over → re-raised', 218]];
      rows.forEach(([t, y], i) => stage.append(svg('rect', { class: i === 0 ? 'grp' : 'cl', 'data-row': i, x: 8, y, width: 624, height: i === 0 ? 62 : 54, rx: 10 }), svg('text', { x: 20, y: y + 20, 'font-size': 12, 'font-weight': 700, 'font-family': 'var(--mono)', fill: i === 0 ? 'var(--err)' : 'var(--text-2)', text: t })));
      pills = KIDS.map(([t, r]) => { const g = svg('g', { class: 'pill-g' }); g.append(svg('rect', { x: 0, y: 0, width: 140, height: 26, rx: 13, fill: 'var(--surface)', stroke: t === 'ValueError' ? 'var(--accent)' : t === 'KeyError' ? 'var(--k-store)' : 'var(--err)', 'stroke-width': 2 }), svg('text', { x: 70, y: 17, 'text-anchor': 'middle', 'font-size': 11.5, 'font-family': 'var(--mono)', fill: 'var(--text)', text: `${t} (${r})` })); g.style.transition = 'none'; stage.append(g); return g; });
      fresh = true;
    }
    const rowY = [58, 112, 178, 244];
    const pos = cur ? cur.rows : [0, 0, 0, 0];
    pills.forEach((g, i) => { const x = pos[i] === 0 ? 100 + i * 130 : 230 + KIDS.slice(0, i).filter((_, j) => pos[j] === pos[i]).length * 150; g.style.transform = `translate(${x}px, ${rowY[pos[i]] - 13}px)`; });
    if (fresh && !reduced) requestAnimationFrame(() => requestAnimationFrame(() => pills && pills.forEach((g) => { g.style.transition = ''; })));
    stage.querySelectorAll('rect[data-row]').forEach((r) => { const i = +r.getAttribute('data-row'); if (i > 0) r.setAttribute('class', 'cl' + (cur && cur.cl === i ? ' on' : '')); });
    out.innerHTML = '';
    const lines = [];
    if (cur && cur.line >= 3) lines.push(['', 'report(): got ExceptionGroup("4 rows invalid", [ValueError(row 2), ValueError(row 7)])']);
    if (cur && cur.line >= 5) lines.push(['', 'WARNING missing keys: 1']);
    if (cur && cur.line >= 6) lines.push(['', ''], ['', '  + Exception Group Traceback (most recent call last):'], ['dim', '  |   File "import.py", line 2, in <module>'], ['err', '  | ExceptionGroup: 4 rows invalid (1 sub-exception)'], ['dim', '  +-+---------------- 1 ----------------'], ['err', "    | TypeError: qty must be int, got str"], ['dim', '    +------------------------------------']);
    if (!lines.length) lines.push(['dim', '(nothing printed yet)']);
    lines.forEach(([c, t]) => out.append(el('div', { class: c, text: t || ' ' })));
  }

  function render() {
    const S = steps(); const cur = k ? S[k - 1] : null;
    const code = mode === 'chain' ? chainCode(style) : GCODE;
    codeHost.innerHTML = '';
    code.forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: ln ? IA.highlight(ln, 'python') : '&nbsp;' })));
    if (mode === 'chain') { pills = null; renderChain(cur); } else renderGroup(cur);
    outLbl.textContent = mode === 'chain' ? 'traceback printed by Python' : 'output';
    narr.innerHTML = '';
    const cap = cur ? (typeof cur.cap === 'function' ? cur.cap(style) : cur.cap) : (mode === 'chain' ? 'Choose how <code>ConfigError</code> is raised, then press <b>Play</b> or <b>Step</b>.' : 'Press <b>Play</b> or <b>Step</b> to send the group through the <code>except*</code> clauses.');
    narr.append(el('div', { class: 'n', text: `${k}/${S.length}` }), el('div', { class: 't', html: cap }));
    bStep.disabled = k >= S.length;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; render(); }
  function step() { if (k >= steps().length) return false; k++; render(); return k < steps().length; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= steps().length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2800); }
    if (g === gen) stop();
  });
  reset();
});
