/* EventEmitter: listener arrays per event name; emit() iterates a copy, synchronously;
   once-wrappers remove themselves; 'error' with no listener throws; the 11th listener warns. */
IA.widget('eventemitter', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-ee-style')) {
    document.head.append(el('style', { id: 'w-ee-style', text: `
.w-ee .row { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.2; }
.w-ee .row.on { stroke: var(--accent); stroke-width: 2; }
.w-ee .nm { fill: var(--text); font-family: var(--mono); font-size: 13px; font-weight: 700; }
.w-ee .chip { fill: var(--surface); stroke: var(--accent-2); stroke-width: 1.6; transition: fill .3s; }
.w-ee .chip.once { stroke-dasharray: 4 3; }
.w-ee .chip.run { fill: var(--accent); stroke: var(--accent); }
.w-ee .chip.done { fill: var(--accent-soft); }
.w-ee .chip.gone { opacity: .35; }
.w-ee .chip.new { animation: w-ee-in .4s ease both; }
@keyframes w-ee-in { from { opacity: 0; } to { opacity: 1; } }
.w-ee .cl { fill: var(--text); font-family: var(--mono); font-size: 12px; font-weight: 700; pointer-events: none; }
.w-ee .cl.run { fill: #fff; }
.w-ee .t2 { fill: var(--text-3); font-size: 12px; }
.w-ee .cp { fill: var(--surface-2); stroke: var(--text-3); stroke-width: 1; stroke-dasharray: 3 3; }
.w-ee .ptr { fill: var(--accent); }
.w-ee .warn { fill: var(--warn); font-size: 13px; font-weight: 700; }
.w-ee .crash { fill: var(--err); font-size: 14px; font-weight: 700; }
.w-ee-ops { font-family: var(--mono); font-size: 12.5px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; margin: 0; list-style: none; }
.w-ee-ops li { padding: 1px 6px; border-radius: 5px; color: var(--text-2); white-space: pre-wrap; overflow-wrap: anywhere; }
.w-ee-ops li.cur { background: var(--accent-soft); color: var(--text); font-weight: 700; }
.w-ee-ops li.past { color: var(--text-3); }
.w-ee-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 10px; align-items: start; }
@media (max-width: 640px) { .w-ee-grid { grid-template-columns: 1fr; } }
` }));
  }
  const L = (label, out, note, extra) => Object.assign({ label, out, note }, extra || {});
  const SC = {
    basics: { label: 'on / once / prepend', ops: [
      { code: "e.on('data', A)", do: (s) => s.on('data', L('A', 'A got', 'A runs second: it was added first, but P was prepended.')) },
      { code: "e.prependListener('data', P)", do: (s) => s.on('data', L('P', 'P got', 'P runs first: <code>prependListener</code> put it at index 0.'), { prepend: true }) },
      { code: "e.once('data', O)", do: (s) => s.on('data', L('O', 'O got', '<code>once</code>: Node removes the wrapper from the real array <b>before</b> calling O, so O can never run twice.', { once: true })) },
      { code: "e.emit('data', 1)", do: (s) => s.emit('data', 1) },
      { code: "e.emit('data', 2)", do: (s) => s.emit('data', 2) },
      { code: "e.off('data', A)", do: (s) => s.off('data', 'A') }
    ] },
    mutate: { label: 'Remove during emit', ops: [
      { code: "e.on('go', A)  // A: off(B); on(C)", do: (s) => s.on('go', L('A', 'A', (labels) => (labels.includes('B') ? 'A runs: it removes B and adds C to the <b>real</b> array. The copy that emit is walking still says [A, B].' : 'A runs again: <code>off(B)</code> finds nothing, and it adds another C. That new C is not in this copy, so it waits for the next emit.'), { act: (s2) => { s2.off('go', 'B', true); s2.on('go', L('C', 'C', 'C runs: it was in the array when this emit started.'), { quiet: true }); } })) },
      { code: "e.on('go', B)", do: (s) => s.on('go', L('B', 'B', 'B still runs. It was removed from the real array, but emit iterates the copy it took at the start.')) },
      { code: "e.emit('go')", do: (s) => s.emit('go') },
      { code: "e.emit('go')", do: (s) => s.emit('go') }
    ] },
    error: { label: "'error' event", ops: [
      { code: "e.on('data', A)", do: (s) => s.on('data', L('A', 'A got', 'A runs.')) },
      { code: "e.emit('error', err)", do: (s) => s.emit('error') },
      { code: "e.on('error', H)", do: (s) => s.on('error', L('H', 'H handled err', 'H handles the error. <code>emit</code> returns <b>true</b>; the process lives.')) },
      { code: "e.emit('error', err)", do: (s) => s.emit('error') },
      { code: "e.emit('nobody')", do: (s) => s.emit('nobody') }
    ] },
    leak: { label: 'Leak: on() per request', ops: [
      ...Array.from({ length: 12 }, (_, i) => ({ code: `GET /stream #${i + 1} → bus.on('price', h${i + 1})`, do: (s) => s.on('price', L('h' + (i + 1), null, null)) })),
      { code: "bus.emit('price', 101)", do: (s) => s.emit('price', 101, true) },
      { code: "fix: res.on('close', () => bus.off('price', h))", do: (s) => s.offAll('price') }
    ] }
  };

  function simulate(sc) {
    const ev = {}; const out = []; const F = []; let warn = null; let crash = null; let fresh = null;
    const warned = {};
    const snap = (op, cap, copy) => { F.push({ ev: Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, v.map((x) => ({ label: x.label, once: x.once, id: x.id }))])), copy, out: out.slice(), warn, crash, op, cap, fresh }); fresh = null; };
    let uid = 0; let curOp = 0;
    const s = {
      on(name, l, o) {
        o = o || {};
        const item = Object.assign({ id: ++uid, once: !!l.once }, l);
        (ev[name] = ev[name] || []);
        if (o.prepend) ev[name].unshift(item); else ev[name].push(item);
        fresh = item.id;
        if (ev[name].length > 10 && !warned[name]) { warned[name] = true; warn = `MaxListenersExceededWarning: 11 ${name} listeners added. Use emitter.setMaxListeners() to increase limit`; }
        if (o.quiet) return;
        const n = ev[name].length;
        snap(curOp, warn && n === 11
          ? 'The <b>11th</b> listener for one event: Node prints a <code>MaxListenersExceededWarning</code>, once, and still adds it. Each closure here keeps a whole request (<code>req</code>, <code>res</code>) alive.'
          : (name === 'price' ? `Listener ${n} added. The array grows by one per request and nothing removes it.` : `<code>${o.prepend ? 'prependListener' : (l.once ? 'once' : 'on')}</code> ${o.prepend ? 'inserts at the front of' : 'appends to'} the <code>'${name}'</code> array${l.once ? ' (a self-removing wrapper, dashed)' : ''}. Nothing runs yet.`));
      },
      off(name, label, quiet) {
        const a = ev[name] || []; const i = a.findIndex((x) => x.label === label);
        if (i >= 0) a.splice(i, 1);
        if (!quiet) snap(curOp, `<code>off</code> removes <code>${label}</code> by identity: you must pass the <b>same</b> function you added.`);
      },
      offAll(name) { const n = (ev[name] || []).length; ev[name] = []; warn = null; snap(curOp, `Each request removes its own listener when the client disconnects. ${n} → 0 listeners, and the closures (and their requests) can be garbage-collected.`); },
      emit(name, arg, summary) {
        const list = ev[name] || [];
        if (!list.length) {
          if (name === 'error') { crash = 'throw err  // Unhandled \'error\' event'; snap(curOp, '<code>\'error\'</code> with <b>no listener</b>: <code>emit</code> throws the error. From a socket or timer callback nothing catches it, so the process crashes.'); crash = null; return; }
          out.push(`emit('${name}') → false`);
          snap(curOp, `No listeners for <code>'${name}'</code>: nothing runs and <code>emit</code> returns <b>false</b>.`); return;
        }
        const copy = list.slice(); const labels = copy.map((x) => x.label);
        snap(curOp, `<code>emit('${name}')</code> first takes a <b>copy</b> of the array: [${labels.join(', ')}]. It will call each one, in order, synchronously.`, { name, items: labels, idx: -1 });
        if (summary) {
          copy.forEach((x) => out.push(`${x.label}(${arg})`));
          snap(curOp, `All ${copy.length} listeners run, one after another, on this one call stack. Leaked listeners cost CPU on every emit, too.`, { name, items: labels, idx: copy.length - 1, all: true });
        } else {
          copy.forEach((x, i) => {
            if (x.once) { const j = ev[name].indexOf(x); if (j >= 0) ev[name].splice(j, 1); }
            if (x.act) x.act(s);
            out.push(x.out + (arg != null ? ' ' + arg : ''));
            snap(curOp, (typeof x.note === 'function' ? x.note(labels) : x.note) || `${x.label} runs.`, { name, items: labels, idx: i });
          });
        }
        out.push(`emit('${name}') → true`);
        snap(curOp, `Every listener in the copy has returned, so <code>emit</code> returns <b>true</b> and the next line of the caller runs.`, null);
      }
    };
    snap(-1, 'Press Play or Step. The rows are the emitter’s internal listener arrays, one per event name.');
    sc.ops.forEach((op, i) => { curOp = i; op.do(s); });
    return F;
  }

  let sid = 'basics'; let frames = []; let k = 0; let gen = 0; let playing = false; let speed = 1800;
  const seg = (opts, cur, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); set(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 600 280', role: 'img', 'aria-label': 'Listener arrays of an EventEmitter' });
  const ops = el('ul', { class: 'w-ee-ops' });
  const outBox = el('div', { class: 'w-log', style: { maxHeight: '150px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.classList.add('w-ee');
  root.append(el('div', { class: 'w-controls' }, seg(Object.entries(SC).map(([v, x]) => [v, x.label]), sid, (v) => { sid = v; reset(); }, 'Script')),
    el('div', { class: 'w-ee-grid' }, el('div', { class: 'w-stage' }, stage), el('div', null, ops, el('div', { class: 'tiny', style: { margin: '8px 0 0' }, text: 'output' }), outBox)),
    narr, el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[2800, 'Slow'], [1800, 'Normal'], [800, 'Fast']], speed, (v) => { speed = v; }, 'Speed')));

  function chips(g, x0, y, items, state) {
    const n = items.length; const w = Math.min(56, Math.floor(460 / Math.max(n, 1)) - 4);
    items.forEach((it, i) => {
      const x = x0 + i * (w + 4); const st = state ? state(it, i) : '';
      g.append(svg('rect', { class: 'chip ' + st + (it.once ? ' once' : ''), x, y, width: w, height: 30, rx: 7 }));
      g.append(svg('text', { class: 'cl' + (st.includes('run') ? ' run' : ''), x: x + w / 2, y: y + 20, 'text-anchor': 'middle', 'font-size': w < 40 ? 10 : 12, text: it.label || it }));
    });
  }
  function render(f) {
    stage.innerHTML = '';
    stage.append(svg('text', { class: 't2', x: 10, y: 18, text: 'emitter._events  (one array per event name)' }));
    const names = Object.keys(f.ev);
    let y = 32;
    if (!names.length) stage.append(svg('text', { class: 't2', x: 300, y: 120, 'text-anchor': 'middle', text: '(no listeners yet)' }));
    names.forEach((name) => {
      const active = f.copy && f.copy.name === name;
      stage.append(svg('rect', { class: 'row' + (active ? ' on' : ''), x: 6, y, width: 588, height: 44, rx: 9 }));
      stage.append(svg('text', { class: 'nm', x: 16, y: y + 27, text: `'${name}'` }));
      const g = svg('g'); stage.append(g);
      if (!f.ev[name].length) g.append(svg('text', { class: 't2', x: 120, y: y + 27, text: '[ ]  empty' }));
      chips(g, 120, y + 7, f.ev[name], (it) => (it.id === f.fresh && !reduced ? 'new' : ''));
      y += 52;
      if (active) {
        stage.append(svg('rect', { class: 'cp', x: 110, y: y - 6, width: 484, height: 44, rx: 8 }));
        stage.append(svg('text', { class: 't2', x: 16, y: y + 20, text: 'emit’s copy' }));
        const g2 = svg('g'); stage.append(g2);
        chips(g2, 120, y + 1, f.copy.items.map((l) => ({ label: l })), (it, i) => (f.copy.all ? 'run' : i === f.copy.idx ? 'run' : i < f.copy.idx ? 'done' : ''));
        y += 50;
      }
    });
    if (f.warn) stage.append(svg('text', { class: 'warn', x: 10, y: Math.min(y + 18, 248), text: '⚠ ' + f.warn.slice(0, 70) + (f.warn.length > 70 ? '…' : '') }));
    if (f.crash) { stage.append(svg('text', { class: 'crash', x: 300, y: Math.min(y + 30, 262), 'text-anchor': 'middle', text: '💥 ' + f.crash })); }
    [...ops.children].forEach((li, i) => li.className = i === f.op ? 'cur' : i < f.op ? 'past' : '');
    const cur = ops.children[f.op]; if (cur && ops.scrollHeight > ops.clientHeight) ops.scrollTop += cur.getBoundingClientRect().top - ops.getBoundingClientRect().top - 40;
    outBox.innerHTML = ''; (f.out.length ? f.out.slice(-14) : ['(nothing yet)']).forEach((l) => outBox.append(el('div', { text: l })));
    if (f.crash) outBox.append(el('div', { style: { color: 'var(--err)' }, text: "Error: boom  ← Unhandled 'error' event" }));
    narr.firstChild.innerHTML = f.cap;
  }
  function reset() {
    gen++; playing = false; bPlay.textContent = '▶ Play';
    const sc = SC[sid]; frames = simulate(sc); k = 1; bStep.disabled = false;
    ops.innerHTML = ''; ops.style.maxHeight = '190px'; ops.style.overflow = 'auto';
    sc.ops.forEach((o) => ops.append(el('li', { text: o.code })));
    render(frames[0]);
  }
  function step() { if (k >= frames.length) { bStep.disabled = true; return false; } render(frames[k]); k++; if (k >= frames.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { playing = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (playing) { playing = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { k = frames.length - 1; step(); return; }
    if (k >= frames.length) reset();
    playing = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (playing && g === gen && step()) await sleep(speed);
    if (g === gen) { playing = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
