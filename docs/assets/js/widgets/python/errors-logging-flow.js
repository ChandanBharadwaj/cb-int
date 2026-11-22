/* Logging flow: a LogRecord goes from the logger call through the effective-level check, this logger's handlers,
   then up the dotted tree (propagate) to ancestor handlers, each with its own level and formatter. */
IA.widget('errors-logging-flow', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-pylg-style')) {
    document.head.append(el('style', { id: 'w-pylg-style', text: `
.w-pylg .lg{fill:var(--surface);stroke:var(--border);stroke-width:1.5;transition:all .3s}
.w-pylg .lg.on{stroke:var(--accent);stroke-width:3;fill:var(--accent-soft)}
.w-pylg .lg.no{stroke:var(--err);stroke-width:3;fill:color-mix(in srgb,var(--err) 10%,transparent)}
.w-pylg .lg.ok{stroke:var(--ok);stroke-width:2.5}
.w-pylg .hd{fill:var(--surface-2);stroke:var(--border);stroke-width:1.5;transition:all .3s}
.w-pylg .hd.on{stroke:var(--accent);stroke-width:3}
.w-pylg .hd.ok{stroke:var(--ok);stroke-width:2.5}
.w-pylg .hd.off{opacity:.45}
.w-pylg .ed{stroke:var(--edge);stroke-width:2;fill:none}
.w-pylg .ed.hd-e{stroke-dasharray:4 4}
.w-pylg .ed.cut{stroke:var(--err);stroke-dasharray:3 5}
.w-pylg .rec{transition:transform .6s ease}
.w-pylg .outs{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-family:var(--mono);font-size:12px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;background:var(--surface)}
.w-pylg .outs .k{color:var(--text-3)}
.w-pylg .outs .v{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text)}
.w-pylg .rc{font-family:var(--mono);font-size:12px;color:var(--text-2);margin-top:8px}
` }));
  }
  const CALLS = {
    debug: { who: 'app.orders', code: 'log.debug("cart %s", cart)', lvl: 'DEBUG', n: 10 },
    info: { who: 'app.orders', code: 'log.info("order paid", extra={"order_id": 42})', lvl: 'INFO', n: 20 },
    exc: { who: 'app.orders', code: 'log.exception("charge failed")   # inside except', lvl: 'ERROR', n: 40 },
    lib: { who: 'urllib3', code: 'logging.getLogger("urllib3").info("Starting new HTTPS connection")', lvl: 'INFO', n: 20 }
  };
  // geometry
  const N = {
    root: { x: 20, y: 18, w: 150, t: 'root', s: 'level WARNING' },
    app: { x: 70, y: 104, w: 150, t: 'app', s: 'level INFO' },
    'app.orders': { x: 130, y: 190, w: 150, t: 'app.orders', s: 'level NOTSET → INFO' },
    urllib3: { x: 300, y: 190, w: 140, t: 'urllib3', s: 'NOTSET → WARNING' }
  };
  const H = {
    h2: { x: 350, y: 18, w: 270, t: 'StreamHandler(stderr)', s: 'level NOTSET · text formatter' },
    h1: { x: 350, y: 104, w: 270, t: 'StreamHandler(stdout)', s: 'level INFO · JSON formatter' }
  };
  function plan(call, prop) {
    const C = CALLS[call]; const S = [];
    const text = (lvl) => `${lvl} app.orders: ${call === 'exc' ? 'charge failed\nTraceback (most recent call last): … PaymentError: card declined' : 'order paid'}`;
    const json = (lvl) => `{"level": "${lvl}", "logger": "app.orders", "msg": "${call === 'exc' ? 'charge failed' : 'order paid'}"${call === 'info' ? ', "order_id": 42' : ''}${call === 'exc' ? ', "exc_info": "Traceback … PaymentError: card declined"' : ''}}`;
    if (call === 'lib') {
      S.push({ at: 'urllib3', cls: { urllib3: 'on' }, cap: 'A library logs at INFO. <code>urllib3</code> has no level of its own, so its <b>effective level</b> is the first one set on the way up: root’s WARNING.' });
      S.push({ at: 'urllib3', cls: { urllib3: 'no' }, rec: false, cap: 'INFO &lt; WARNING: dropped before a LogRecord is even created. This is why library INFO logs “disappear”: set <code>logging.getLogger("urllib3").setLevel(logging.INFO)</code> if you want them.' });
      return S;
    }
    S.push({ at: 'app.orders', cls: { 'app.orders': 'on' }, cap: `<code>${C.code}</code> on logger <code>app.orders</code>. First check: <code>isEnabledFor(${C.lvl})</code> against the <b>effective</b> level, inherited from <code>app</code>: INFO.` });
    if (call === 'debug') {
      S.push({ at: 'app.orders', cls: { 'app.orders': 'no' }, cap: 'DEBUG &lt; INFO: the call returns immediately. No record is built and <code>cart</code> is never formatted. That cheap early exit is why you pass <code>%s</code> arguments instead of f-strings.' });
      return S;
    }
    S.push({ at: 'app.orders', cls: { 'app.orders': 'ok' }, rec: true, cap: `Enabled. A <b>LogRecord</b> is created: name, level, msg + args, file and line, thread, taskName (3.12+)${call === 'info' ? ', plus <code>order_id=42</code> from <code>extra</code>' : ', plus <code>exc_info</code>, because <code>log.exception</code> is meant to be called inside <code>except</code>'}.` });
    S.push({ at: 'app', cls: { 'app.orders': 'ok', app: 'on' }, rec: true, up1: true, cap: '<code>app.orders</code> has no handlers. <code>propagate</code> is True (the default), so the record goes to the parent’s handlers. Note: the parent logger’s <i>level</i> is not checked again.' });
    S.push({ at: 'h1', cls: { 'app.orders': 'ok', app: 'ok' }, hcls: { h1: 'on' }, rec: true, up1: true, cap: '<code>app</code>’s handler: its own level (INFO) passes, its <b>JSON formatter</b> turns the record into one line, and it writes to stdout.', stdout: json(C.lvl) });
    if (!prop) {
      S.push({ at: 'app', cls: { 'app.orders': 'ok', app: 'ok' }, hcls: { h1: 'ok', h2: 'off' }, cut: true, rec: true, up1: true, stdout: json(C.lvl), cap: '<code>app.propagate = False</code>: the journey stops here. Root’s handler never sees the record, so there is exactly one copy, in JSON.' });
      return S;
    }
    S.push({ at: 'root', cls: { 'app.orders': 'ok', app: 'ok', root: 'on' }, hcls: { h1: 'ok' }, rec: true, up1: true, up2: true, stdout: json(C.lvl), cap: '<code>app.propagate</code> is True too, so the record continues to <b>root</b>. Root’s level is WARNING, but that is <b>not checked</b> during propagation, even for an INFO record.' });
    S.push({ at: 'h2', cls: { 'app.orders': 'ok', app: 'ok', root: 'ok' }, hcls: { h1: 'ok', h2: 'on' }, rec: true, up1: true, up2: true, stdout: json(C.lvl), stderr: text(C.lvl), cap: 'Root’s handler (level NOTSET) accepts it and its text formatter writes a second copy to stderr. <b>Every event is logged twice</b>, in two formats. Fix: handlers only on root, or <code>propagate = False</code> on <code>app</code>.' });
    return S;
  }
  let call = 'info', prop = true, k = 0, gen = 0, running = false, S = plan(call, prop);
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }); opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segC = seg([['debug', 'log.debug'], ['info', 'log.info + extra'], ['exc', 'log.exception'], ['lib', 'urllib3 INFO']], call, (v) => { call = v; reset(); }, 'Log call');
  const segP = seg([[true, 'app.propagate = True'], [false, 'app.propagate = False']], prop, (v) => { prop = v; reset(); }, 'propagate');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 640 250', role: 'img', 'aria-label': 'Logger tree with handlers; a record moves between them' });
  const outs = el('div', { class: 'outs' });
  const rc = el('div', { class: 'rc' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pylg');
  root.append(el('div', { class: 'w-controls' }, segC), el('div', { class: 'w-controls' }, segP), el('div', { class: 'w-stage' }, stage), rc, outs,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  // static drawing
  const box = {}; const hbox = {};
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text: t }, o || {}));
  const edge = (d, cls) => svg('path', { class: 'ed ' + (cls || ''), d });
  stage.append(edge(`M${N.root.x + 40} ${N.root.y + 46} L ${N.app.x + 40} ${N.app.y}`), edge(`M${N.app.x + 40} ${N.app.y + 46} L ${N['app.orders'].x + 40} ${N['app.orders'].y}`),
    edge(`M${N.root.x + 20} ${N.root.y + 46} L ${N.root.x + 20} 170 L ${N.urllib3.x + 30} 170 L ${N.urllib3.x + 30} ${N.urllib3.y}`));
  const cutEdge = edge(`M${N.root.x + 40} ${N.root.y + 46} L ${N.app.x + 40} ${N.app.y}`, 'cut'); cutEdge.style.display = 'none'; stage.append(cutEdge);
  stage.append(edge(`M${N.root.x + N.root.w} ${N.root.y + 23} L ${H.h2.x} ${H.h2.y + 23}`, 'hd-e'), edge(`M${N.app.x + N.app.w} ${N.app.y + 23} L ${H.h1.x} ${H.h1.y + 23}`, 'hd-e'));
  Object.entries(N).forEach(([k2, n]) => { const r = svg('rect', { class: 'lg', x: n.x, y: n.y, width: n.w, height: 46, rx: 10 }); box[k2] = r; stage.append(r, T(n.x + 10, n.y + 19, n.t, { 'font-weight': 700, 'font-family': 'var(--mono)' }), T(n.x + 10, n.y + 36, n.s, { 'font-size': 10.5, fill: 'var(--text-3)' })); });
  Object.entries(H).forEach(([k2, n]) => { const r = svg('rect', { class: 'hd', x: n.x, y: n.y, width: n.w, height: 46, rx: 10 }); hbox[k2] = r; stage.append(r, T(n.x + 10, n.y + 19, n.t, { 'font-weight': 700, 'font-family': 'var(--mono)' }), T(n.x + 10, n.y + 36, n.s, { 'font-size': 10.5, fill: 'var(--text-3)' })); });
  stage.append(T(20, 244, 'loggers (dotted tree)', { 'font-size': 11, fill: 'var(--text-3)' }), T(350, 168, 'handlers → formatter → stream', { 'font-size': 11, fill: 'var(--text-3)' }));
  const recG = svg('g', { class: 'rec' }, svg('rect', { x: -26, y: -11, width: 52, height: 22, rx: 6, fill: 'var(--accent)' }), T(0, 4, 'record', { 'text-anchor': 'middle', 'font-size': 10.5, fill: 'var(--surface)', 'font-weight': 700 }));
  if (reduced) recG.style.transition = 'none';
  stage.append(recG);
  const centre = (id) => { const n = N[id] || H[id]; return [n.x + n.w - 34, n.y + 23]; };

  function render() {
    const cur = k ? S[k - 1] : null;
    Object.entries(box).forEach(([id, r]) => r.setAttribute('class', 'lg' + (cur && cur.cls && cur.cls[id] ? ' ' + cur.cls[id] : '')));
    Object.entries(hbox).forEach(([id, r]) => r.setAttribute('class', 'hd' + (cur && cur.hcls && cur.hcls[id] ? ' ' + cur.hcls[id] : '')));
    cutEdge.style.display = cur && cur.cut ? '' : 'none';
    recG.style.display = cur && cur.rec ? '' : 'none';
    if (cur && cur.rec) { const [x, y] = centre(cur.at); recG.style.transform = `translate(${x}px, ${y}px)`; }
    const C = CALLS[call];
    rc.innerHTML = '';
    rc.append(el('span', { html: cur && cur.rec ? `LogRecord(name='${C.who}', levelname='${C.lvl}', levelno=${C.n}, msg=…${call === 'info' ? ', order_id=42' : ''}${call === 'exc' ? ', exc_info=(PaymentError, …)' : ''})` : `call: <code>${C.code}</code>` }));
    outs.innerHTML = '';
    outs.append(el('span', { class: 'k', text: 'stdout' }), el('span', { class: 'v', text: cur && cur.stdout ? cur.stdout : '' }), el('span', { class: 'k', text: 'stderr' }), el('span', { class: 'v', text: cur && cur.stderr ? cur.stderr : '' }));
    narr.innerHTML = '';
    narr.className = 'caption' + (cur && cur.stderr ? ' warn' : '');
    narr.append(el('div', { class: 'n', text: `${k}/${S.length}` }), el('div', { class: 't', html: cur ? cur.cap : 'Pick a call and the <code>propagate</code> setting, then press <b>Play</b> or <b>Step</b>.' }));
    bStep.disabled = k >= S.length;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); S = plan(call, prop); k = 0; render(); }
  function step() { if (k >= S.length) return false; k++; render(); return k < S.length; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= S.length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2600); }
    if (g === gen) stop();
  });
  reset();
});
