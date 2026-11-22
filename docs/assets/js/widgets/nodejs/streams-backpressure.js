/* Streams & backpressure: a buffer filling to highWaterMark, write() returning false, 'drain',
   and (pipeline mode) the pressure travelling upstream until the source stops reading. */
IA.widget('streams-backpressure', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-sbp-style')) {
    document.head.append(el('style', { id: 'w-sbp-style', text: `
.w-sbp .box { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; }
.w-sbp .box.on { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2.5; }
.w-sbp .box.wait { fill: color-mix(in srgb, var(--warn) 14%, var(--surface)); stroke: var(--warn); stroke-width: 2.5; }
.w-sbp .bk { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.5; }
.w-sbp .cell { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.w-sbp .cell.over { fill: var(--err); }
.w-sbp .cell.r { fill: var(--accent-2); }
.w-sbp .cell.new { animation: w-sbp-in .45s ease both; }
@keyframes w-sbp-in { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: none; } }
.w-sbp .hwm { stroke: var(--warn); stroke-width: 2; stroke-dasharray: 6 4; }
.w-sbp .t1 { fill: var(--text); font-size: 14px; font-weight: 700; }
.w-sbp .t2 { fill: var(--text-3); font-size: 12px; }
.w-sbp .tw { fill: var(--warn); font-size: 12px; font-weight: 700; }
.w-sbp .te { fill: var(--err); font-size: 13px; font-weight: 700; }
.w-sbp .arr { stroke: var(--text-3); stroke-width: 2; fill: none; marker-end: url(#w-sbp-ah); }
.w-sbp .arr.off { stroke: var(--border); stroke-dasharray: 4 4; }
.w-sbp .ret { font-family: var(--mono); font-size: 14px; font-weight: 700; }
.w-sbp .ret.t { fill: var(--ok); } .w-sbp .ret.f { fill: var(--err); }
` }));
  }
  const HWM = 4; const KB = 16;
  const MODES = {
    respect: { label: 'Respect false', total: 12, note: 'A loop calls <code>write()</code> and, when it returns <b>false</b>, awaits <code>once(out, \'drain\')</code>.' },
    ignore: { label: 'Ignore false', total: 12, note: 'The same loop, but it ignores the return value. Every chunk is still accepted, so the buffer (your heap) grows.' },
    pipeline: { label: 'pipeline()', total: 12, note: '<code>pipeline(fs.createReadStream(f), res)</code>: the file stream has its own buffer. When <code>res</code> is full, the pipe pauses the reader; when the reader’s buffer is full, Node stops calling <code>_read()</code>, so the disk read stops too.' }
  };

  function simulate(mode) {
    const T = MODES[mode].total; const F = [];
    let wb = 0; let rb = 0; let made = 0; let got = 0; let read = 0; let waiting = false; let flowing = true; let ret = null; let peak = 0; let tick = 0; let endLogged = false;
    const log = [];
    const snap = (cap, ev, extra) => F.push(Object.assign({ wb, rb, made, got, read, waiting, flowing, ret, peak, tick, cap, ev: ev.slice(), log: log.slice(-7) }, extra || {}));
    snap(MODES[mode].note + ' Press Step.', []);
    while (got < T && tick < 40) {
      tick++; const ev = []; let cap = '';
      if (mode !== 'pipeline') {
        if (!waiting && made < T) {
          for (let k = 0; k < 3 && made < T; k++) {
            wb++; made++; ret = wb < HWM; ev.push('w' + made);
            log.push(`write(chunk ${made}) → ${ret}   (buffer ${wb * KB} KiB)`);
            if (!ret && mode === 'respect') { waiting = true; break; }
          }
          cap = mode === 'respect' && waiting
            ? `The buffer reached <b>${HWM * KB} KiB</b>, so <code>write()</code> returned <b>false</b>. The chunk was accepted, but the loop now stops and waits for <code>'drain'</code>.`
            : (ret === false ? `<code>write()</code> returned <b>false</b> but the loop keeps going. Buffer: <b>${wb * KB} KiB</b> and rising. Nothing in Node stops this.` : 'The producer writes 3 chunks per tick. Each <code>write()</code> returns <b>true</b>: the buffer is below highWaterMark.');
        } else if (waiting) cap = 'The producer is parked on <code>await once(out, \'drain\')</code>. Its memory use stays flat while the client catches up.';
        else cap = 'Everything has been written. The client is still downloading the buffered chunks.';
      } else {
        if (read < T && rb < HWM) { const n = Math.min(2, T - read); rb += n; read += n; ev.push('r'); log.push(`_read() → push ×${n}   (readable buffer ${rb * KB} KiB)`); }
        else if (read < T) log.push('readable buffer at highWaterMark: _read() not called');
        let moved = 0;
        while (flowing && rb > 0 && moved < 3) {
          rb--; wb++; moved++; made++; ret = wb < HWM; ev.push('w' + made);
          log.push(`pipe: res.write() → ${ret}`);
          if (!ret) { flowing = false; waiting = true; log.push('pipe: src.pause()'); }
        }
        if (read >= T && rb === 0 && !endLogged) { endLogged = true; log.push('file fully read: \'end\' → pipe calls res.end()'); }
        cap = !flowing
          ? (rb >= HWM ? 'Both buffers are at highWaterMark. The reader is paused and Node no longer calls <code>_read()</code>: <b>the disk read itself has stopped</b>. Backpressure reached the source.'
            : '<code>res.write()</code> returned <b>false</b>, so the pipe called <code>src.pause()</code>. The file stream keeps reading only until <i>its</i> buffer is full.')
          : (read < T ? 'The file stream reads 2 chunks per tick into its buffer; the pipe moves them into <code>res</code> while <code>write()</code> returns true.' : 'The file is fully read; the last chunks are on their way to the client.');
      }
      if (wb > 0) { wb--; got++; ev.push('c'); }
      peak = Math.max(peak, wb + rb);
      if (waiting && wb === 0) {
        waiting = false; flowing = true; log.push('\'drain\' emitted'); ev.push('drain');
        cap += ' The client took the last buffered chunk: the buffer is empty, so <code>\'drain\'</code> fires and writing resumes.';
      }
      snap(cap, ev);
    }
    log.push(`done. peak buffered: ${peak * KB} KiB`);
    snap(mode === 'ignore'
      ? `Done, but the buffer peaked at <b>${peak * KB} KiB</b> for a 192 KiB payload. With 3 M rows and a slow client, that is the whole result set in memory.`
      : `Done. Memory never went far past highWaterMark (peak <b>${peak * KB} KiB</b>), however big the payload or slow the client.`, [], { ended: true });
    return F;
  }

  let mode = 'respect'; let frames = []; let k = 0; let gen = 0; let playing = false; let speed = 1600;
  const seg = (opts, cur, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); set(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 600 300', role: 'img', 'aria-label': 'Producer, stream buffers with a highWaterMark line, and a slow client' });
  const logBox = el('div', { class: 'w-log', style: { maxHeight: '150px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-sbp');
  root.append(el('div', { class: 'w-controls' }, seg(Object.entries(MODES).map(([v, m]) => [v, m.label]), mode, (v) => { mode = v; reset(); }, 'Mode')),
    el('div', { class: 'w-stage' }, stage), narr,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[2600, 'Slow'], [1600, 'Normal'], [700, 'Fast']], speed, (v) => { speed = v; }, 'Speed')),
    stats, logBox);

  function bucket(x, n, title, cls, fresh) {
    const base = 262; const ch = 21; const cap = 9; const g = svg('g');
    g.append(svg('text', { class: 't1', x: x + 45, y: 22, 'text-anchor': 'middle', text: title }));
    g.append(svg('rect', { class: 'bk', x, y: base - cap * ch - 4, width: 90, height: cap * ch + 8, rx: 6 }));
    for (let i = 0; i < Math.min(n, cap); i++) {
      g.append(svg('rect', { class: 'cell ' + cls + (i >= HWM && cls !== 'r' ? ' over' : '') + (fresh && i >= n - fresh && !reduced ? ' new' : ''), x: x + 6, y: base - (i + 1) * ch, width: 78, height: ch - 2, rx: 4 }));
    }
    if (n > cap) g.append(svg('text', { class: 'te', x: x + 45, y: base - cap * ch - 12, 'text-anchor': 'middle', text: `+${n - cap} more` }));
    const hy = base - HWM * ch;
    g.append(svg('line', { class: 'hwm', x1: x - 8, x2: x + 98, y1: hy, y2: hy }));
    g.append(svg('text', { class: 'tw', x: x + 45, y: hy - 5, 'text-anchor': 'middle', text: 'highWaterMark' }));
    g.append(svg('text', { class: 't2', x: x + 45, y: 288, 'text-anchor': 'middle', text: `${n * KB} KiB buffered` }));
    return g;
  }
  function box(x, y, w, h, title, sub, state) {
    return svg('g', null, svg('rect', { class: 'box ' + (state || ''), x, y, width: w, height: h, rx: 10 }),
      svg('text', { class: 't1', x: x + w / 2, y: y + 24, 'text-anchor': 'middle', text: title }),
      ...[].concat(sub).map((s, i) => svg('text', { class: 't2', x: x + w / 2, y: y + 44 + i * 16, 'text-anchor': 'middle', text: s })));
  }
  function render(f, prev) {
    stage.innerHTML = '';
    stage.append(svg('defs', null, svg('marker', { id: 'w-sbp-ah', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--text-3)' }))));
    const T = MODES[mode].total;
    const wFresh = prev ? Math.max(0, f.wb - prev.wb + (f.ev.includes('c') ? 1 : 0)) : 0;
    if (mode === 'pipeline') {
      stage.append(box(8, 100, 120, 92, 'file on disk', [f.read < T ? (f.rb >= HWM ? 'not reading' : 'reading') : 'all read', `${f.read}/${T} chunks`], f.read < T && f.rb < HWM ? 'on' : (f.read < T ? 'wait' : '')));
      stage.append(svg('path', { class: 'arr' + (f.read < T && f.rb < HWM ? '' : ' off'), d: 'M130,146 L156,146' }));
      stage.append(bucket(162, f.rb, 'ReadStream buf', 'r', prev ? Math.max(0, f.rb - prev.rb) : 0));
      stage.append(svg('path', { class: 'arr' + (f.flowing ? '' : ' off'), d: 'M258,146 L314,146' }));
      stage.append(svg('text', { class: f.flowing ? 't2' : 'tw', x: 286, y: 136, 'text-anchor': 'middle', text: f.flowing ? 'pipe' : 'paused' }));
      stage.append(bucket(322, f.wb, 'res write buf', '', wFresh));
    } else {
      stage.append(box(20, 100, 170, 92, 'producer loop', [f.waiting ? 'await once(\'drain\')' : (f.made < T ? 'write(chunk) ×3/tick' : 'done writing'), `${f.made}/${T} written`], f.waiting ? 'wait' : (f.made < T ? 'on' : '')));
      stage.append(svg('path', { class: 'arr' + (f.waiting || f.made >= T ? ' off' : ''), d: 'M192,146 L300,146' }));
      stage.append(svg('text', { class: 't2', x: 246, y: 136, 'text-anchor': 'middle', text: 'write()' }));
      if (f.ret != null) stage.append(svg('text', { class: 'ret ' + (f.ret ? 't' : 'f'), x: 246, y: 168, 'text-anchor': 'middle', text: '→ ' + f.ret }));
      stage.append(bucket(322, f.wb, 'writable buffer', '', wFresh));
    }
    stage.append(svg('path', { class: 'arr' + (f.ev.includes('c') ? '' : ' off'), d: 'M418,146 L462,146' }));
    stage.append(box(466, 100, 126, 92, 'slow client', ['1 chunk / tick', `${f.got}/${T} received`], f.ev.includes('c') ? 'on' : ''));
    if (f.ev.includes('drain')) stage.append(svg('text', { class: 'tw', x: 529, y: 222, 'text-anchor': 'middle', text: '\'drain\' ✓' }));
    narr.firstChild.innerHTML = f.cap;
    stats.innerHTML = '';
    [['tick', f.tick], ['last write()', f.ret == null ? '—' : String(f.ret)], ['writableLength', (f.wb * KB) + ' KiB'], mode === 'pipeline' ? ['readableLength', (f.rb * KB) + ' KiB'] : null, ['peak buffered', (f.peak * KB) + ' KiB'], ['step', `${k}/${frames.length}`]]
      .filter(Boolean).forEach(([a, b]) => stats.append(el('span', { class: 'w-stat', html: `${a} <b>${b}</b>` })));
    logBox.innerHTML = ''; (f.log.length ? f.log : ['(no events yet)']).forEach((l) => logBox.append(el('div', { text: l })));
  }
  function reset() { gen++; playing = false; bPlay.textContent = '▶ Play'; frames = simulate(mode); k = 1; bStep.disabled = false; render(frames[0]); }
  function step() { if (k >= frames.length) { bStep.disabled = true; return false; } render(frames[k], frames[k - 1]); k++; if (k >= frames.length) bStep.disabled = true; return true; }
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
