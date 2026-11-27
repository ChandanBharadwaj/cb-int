/* Profiling & JFR: stack samples accumulating into a flame graph (CPU, wall-clock, allocation views of one service), and safepoint bias vs asynchronous sampling. */
IA.widget('profiling-jfr', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'cpu'; let gen = 0; let running = false; let speed = 2200; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['cpu', 'CPU profile'], ['wall', 'wall-clock profile'], ['alloc', 'allocation profile'], ['bias', 'safepoint bias']], () => mode, (v) => { mode = v; reset(); }, 'Profile');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3400, 'Slow'], [2200, 'Normal'], [1000, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 340, BASE = 300, RH = 24, FX = 16, FW = W - 32;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'A flame graph built from stack samples; each box is a method, width is its share of samples' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  const hoverLine = el('div', { class: 'tiny', style: { minHeight: '18px', marginTop: '4px' } });
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), hoverLine,
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const R = (x, y, w, h, o = {}) => { const r = svg('rect', { x, y, width: w, height: h, rx: o.rx == null ? 3 : o.rx, fill: o.fill || 'var(--surface)', stroke: o.stroke || 'var(--border)', 'stroke-width': o.sw || 1, 'stroke-dasharray': o.dash || null }); if (o.fill && o.fill.indexOf('color-mix') === 0) r.style.fill = o.fill; return r; };
  const T = (x, y, s, o = {}) => svg('text', { x, y, 'font-size': o.fs || 12, 'font-weight': o.fw || null, 'text-anchor': o.a || 'start', 'font-family': o.mono ? 'var(--mono)' : null, fill: o.fill || 'var(--text)', text: s, 'pointer-events': 'none' });

  const H0 = ['Thread.run', 'Http11Processor.service', 'DispatcherServlet.doService'];
  const OC = [...H0, 'OrderController.create'];
  const PROFILES = {
    cpu: { unit: 'samples', note: 'CPU time of running threads', data: [
      [[...OC, 'ObjectMapper.writeValue', 'BeanSerializer.serialize'], 30],
      [[...OC, 'OrderValidator.validate', 'Pattern.compile'], 16],
      [[...OC, 'OrderValidator.validate', 'Matcher.matches'], 8],
      [[...OC, 'OrderRepository.save', 'SessionImpl.flush'], 12],
      [[...H0, 'Logger.info', 'String.format'], 10],
      [[...H0, 'SecurityFilter.doFilter', 'JwtDecoder.verify'], 14],
      [['Thread.run', 'G1 Conc#0 (GC thread)'], 6],
      [['Thread.run', 'C2 CompilerThread0'], 4]] },
    wall: { unit: 'samples', note: 'all threads, waiting included', data: [
      [[...OC, 'ObjectMapper.writeValue', 'BeanSerializer.serialize'], 30],
      [[...OC, 'OrderValidator.validate', 'Pattern.compile'], 24],
      [[...OC, 'OrderRepository.save', 'HikariPool.getConnection', 'LockSupport.park'], 120],
      [[...OC, 'OrderRepository.save', 'SessionImpl.flush', 'SocketInputStream.read'], 60],
      [[...OC, 'PartnerClient.quote', 'SocketInputStream.read'], 90],
      [[...H0, 'Logger.info', 'String.format'], 10],
      [[...H0, 'SecurityFilter.doFilter', 'JwtDecoder.verify'], 14],
      [['Thread.run', 'ThreadPoolExecutor.getTask', 'LockSupport.park'], 52]] },
    alloc: { unit: 'MB', note: 'bytes allocated (sampled at TLAB refills)', data: [
      [[...OC, 'ObjectMapper.writeValue', 'ByteArrayBuilder.<init> (byte[])'], 420],
      [[...H0, 'Logger.info', 'String.format (byte[], String)'], 300],
      [[...OC, 'OrderValidator.validate', 'Pattern.compile (int[], Node)'], 120],
      [[...OC, 'OrderRepository.save', 'SessionImpl.flush', 'ArrayList.grow (Object[])'], 60],
      [[...H0, 'SecurityFilter.doFilter', 'JwtDecoder.verify (byte[])'], 90],
      [[...OC, 'OrderController.toDto', 'Long.valueOf (boxing)'], 50]] }
  };

  let S;
  function tree(samples) {
    const rootN = { name: 'all', w: 0, kids: new Map() };
    samples.forEach(([stack, w]) => { rootN.w += w; let n = rootN; stack.forEach((f) => { if (!n.kids.has(f)) n.kids.set(f, { name: f, w: 0, kids: new Map() }); n = n.kids.get(f); n.w += w; }); });
    return rootN;
  }
  const tone = (name, d) => {
    if (/park|Socket|getConnection|getTask/.test(name)) return 'var(--warn)';
    if (/GC|Compiler/.test(name)) return 'var(--text-3)';
    if (/compile|format|serialize|init|grow|valueOf|verify/.test(name)) return 'var(--err)';
    return d < 3 ? 'var(--accent-2)' : 'var(--accent)';
  };
  function renderFlame() {
    stage.innerHTML = '';
    const P = PROFILES[mode];
    const t = tree(S.samples); const total = t.w || 1;
    stage.append(T(FX, 20, `${mode === 'cpu' ? 'CPU' : mode === 'wall' ? 'Wall-clock' : 'Allocation'} flame graph · ${P.note}`, { fw: 700, fs: 13 }));
    stage.append(T(W - FX, 20, `${total} ${P.unit}`, { a: 'end', mono: true, fs: 12, fill: 'var(--text-2)' }));
    stage.append(R(FX, BASE, FW, RH - 2, { fill: 'var(--surface-2)' }));
    stage.append(T(FX + 6, BASE + 15, 'all (root)', { fs: 11, mono: true, fill: 'var(--text-2)' }));
    const draw = (node, x, depth) => {
      let cx = x;
      [...node.kids.values()].sort((a, b) => a.name.localeCompare(b.name)).forEach((c) => {
        const w = c.w / total * FW; const y = BASE - (depth + 1) * RH;
        if (w >= 0.6) {
          const hot = S.hl && S.hl.includes(c.name);
          const col = tone(c.name, depth);
          const r = R(cx + 0.5, y, Math.max(0.5, w - 1), RH - 2, { fill: `color-mix(in srgb, ${col} ${hot ? 60 : 28}%, var(--surface))`, stroke: hot ? 'var(--text)' : col, sw: hot ? 1.8 : 0.8 });
          r.style.cursor = 'default';
          r.addEventListener('mouseenter', () => { hoverLine.textContent = `${c.name}: ${c.w} ${P.unit} (${(c.w / total * 100).toFixed(1)}%)`; });
          stage.append(r);
          if (w > 46) { const maxc = Math.floor((w - 8) / 6.4); const lab = c.name.length > maxc ? c.name.slice(0, Math.max(1, maxc - 1)) + '…' : c.name; stage.append(T(cx + 4, y + 15, lab, { fs: 10.5, mono: true })); }
          draw(c, cx, depth + 1);
        }
        cx += w;
      });
    };
    draw(t, FX, 0);
    if (S.last) {
      stage.append(T(W - FX, 40, 'latest sample (leaf first):', { a: 'end', fs: 10.5, fill: 'var(--text-3)' }));
      S.last.slice().reverse().slice(0, 3).forEach((f, i) => stage.append(T(W - FX, 54 + i * 13, (i ? '← ' : '') + f, { a: 'end', fs: 10.5, mono: true, fill: i ? 'var(--text-3)' : 'var(--text)' })));
    }
  }
  /* ---------- safepoint bias ---------- */
  const TL0 = 60, TL1 = 720;
  const SEGS = [[0, 10, 'Report.build'], [10, 80, 'Crc.update (hot counted loop)'], [80, 90, 'Report.build'], [90, 100, 'Formatter.write']];
  const POLLS = [10, 80, 85, 90, 95, 100];
  const tx = (t) => TL0 + t / 100 * (TL1 - TL0);
  const at = (t) => SEGS.find(([a, b]) => t >= a && t < b) || SEGS[SEGS.length - 1];
  function renderBias() {
    stage.innerHTML = '';
    stage.append(T(16, 20, 'One thread over 100 ms: what really ran', { fw: 700, fs: 13 }));
    SEGS.forEach(([a, b, n]) => {
      const col = /Crc/.test(n) ? 'var(--err)' : /Formatter/.test(n) ? 'var(--accent-2)' : 'var(--accent)';
      stage.append(R(tx(a), 40, tx(b) - tx(a), 34, { fill: `color-mix(in srgb, ${col} 25%, var(--surface))`, stroke: col }));
      if (tx(b) - tx(a) > 60) stage.append(T((tx(a) + tx(b)) / 2, 62, n, { a: 'middle', fs: 11, mono: true }));
    });
    POLLS.forEach((p) => { stage.append(svg('line', { x1: tx(p), y1: 36, x2: tx(p), y2: 80, stroke: 'var(--text)', 'stroke-width': 1.5, 'stroke-dasharray': '2 2' })); });
    stage.append(T(tx(10) - 4, 92, 'safepoint polls (dashed). Crc.update is inlined into Report.build, and its counted loop has no poll', { fs: 10.5, fill: 'var(--text-3)' }));
    for (let t = 0; t <= 100; t += 20) stage.append(T(tx(t), 106, t + ' ms', { a: 'middle', fs: 10, fill: 'var(--text-3)' }));
    // samples
    S.ticks.forEach((tk) => {
      const x = tx(tk.t); const sx = tx(tk.snap);
      stage.append(svg('circle', { cx: x, cy: 30, r: 4, fill: 'var(--text-2)' }));
      if (S.biased) {
        if (tk.snap !== tk.t) stage.append(svg('path', { d: `M${x} 30 Q ${(x + sx) / 2} 14 ${sx} 30`, fill: 'none', stroke: 'var(--warn)', 'stroke-width': 1.5 }));
        stage.append(svg('circle', { cx: sx, cy: 30, r: 5, fill: 'var(--warn)' }));
      }
    });
    stage.append(T(16, 34, 'samples', { fs: 10.5, fill: 'var(--text-3)' }));
    // tallies
    const names = ['Report.build', 'Crc.update', 'Formatter.write'];
    const tally = (biased) => { const m = { 'Report.build': 0, 'Crc.update': 0, 'Formatter.write': 0 }; S.ticks.forEach((tk) => { const n = biased ? (tk.snap >= 90 ? 'Formatter.write' : 'Report.build') : at(tk.t)[2].split(' ')[0]; m[n]++; }); return m; };
    [['what a safepoint-biased sampler reports', true, 140], ['what an async sampler (async-profiler, JFR) reports', false, 236]].forEach(([title, biased, y]) => {
      const show = biased ? S.showBiased : S.showTrue;
      stage.append(T(16, y, title, { fs: 12, fw: 700, fill: show ? 'var(--text)' : 'var(--text-3)' }));
      if (!show) return;
      const m = tally(biased); const n = S.ticks.length || 1;
      names.forEach((nm, i) => {
        const w = m[nm] / n * 420; const yy = y + 10 + i * 24;
        stage.append(T(16, yy + 14, nm, { fs: 11, mono: true }));
        stage.append(R(170, yy, Math.max(1, w), 18, { fill: nm === 'Crc.update' ? 'var(--err)' : 'var(--accent)', stroke: 'none' }));
        stage.append(T(176 + w, yy + 14, `${m[nm]} / ${n}`, { fs: 11, mono: true, fill: 'var(--text-2)' }));
      });
    });
  }
  function render() { if (mode === 'bias') renderBias(); else renderFlame(); statLine(); }
  function statLine() {
    stats.innerHTML = ''; const add = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    if (mode === 'bias') { add(`samples <b>${S.ticks.length}</b>`); add(`real time in Crc.update <b>70%</b>`); return; }
    add(`stacks merged <b>${S.samples.length}</b>`); add(`weight <b>${S.samples.reduce((a, [, w]) => a + w, 0)} ${PROFILES[mode].unit}</b>`);
  }
  function plan() {
    const st = [];
    if (mode === 'bias') {
      const ticks = [5, 15, 25, 35, 45, 55, 65, 75, 85, 95];
      ticks.forEach((t, i) => st.push({ run: () => { S.ticks.push({ t, snap: POLLS.find((p) => p >= t) }); }, t: i === 0 ? 'Every 10 ms the profiler wants a sample. The thread is in <code>Report.build</code>.' : i === 1 ? 'Now the thread is deep inside <code>Crc.update</code>. It’s a tight <code>int</code> loop the JIT compiled <b>with no safepoint check</b> inside.' : `Sample at ${t} ms.` }));
      st.push({ run: () => { S.biased = true; }, t: 'A <b>safepoint-biased</b> sampler (JVMTI <code>GetAllStackTraces</code>, older tools) can’t stop the thread where it is. It waits for the next safepoint check (orange arrows). So every sample during the loop lands at its exit, back in <code>Report.build</code>.' });
      st.push({ run: () => { S.showBiased = true; }, t: 'So the biased profile says <b>Report.build is 90%</b> and <b>Crc.update is 0%</b>. You would optimize the wrong method.' });
      st.push({ run: () => { S.showTrue = true; S.biased = false; }, t: 'async-profiler and JFR’s sampler record the stack wherever the thread is: <b>Crc.update 7/10</b>. Add <code>-XX:+DebugNonSafepoints</code> so samples in inlined code get the right method and line.' });
      return st;
    }
    const data = PROFILES[mode].data;
    data.forEach(([stack, w], i) => st.push({ run: () => { S.samples.push([stack, w]); S.last = stack; S.hl = null; }, t: () => `Merged ${w} ${PROFILES[mode].unit} with the stack ending in <code>${stack[stack.length - 1]}</code>. ` + (i === 0 ? 'Identical stacks are added together. Each frame’s width is its share of the total.' : 'Frames shared with earlier stacks get wider. New branches appear above their caller.') }));
    const finale = {
      cpu: [['Pattern.compile', 'BeanSerializer.serialize'], 'Read the <b>plateaus</b>: wide boxes with nothing on top are time spent right there. <code>Pattern.compile</code> on every request (16%) is the easy win. Compile it once into a <code>static final Pattern</code>. Serialization (30%) is biggest, but harder to shrink. Note what is <i>missing</i>: the database and partner call barely show in a CPU profile.'],
      wall: [['LockSupport.park', 'SocketInputStream.read', 'HikariPool.getConnection'], 'Same service, wall clock. Now <b>waiting</b> dominates. Request threads park in <code>HikariPool.getConnection</code>: the pool is too small, or connections are held too long. They also sit in socket reads on the partner. The CPU profile showed none of this. Idle pool threads in <code>getTask</code> appear too, so filter to request threads.'],
      alloc: [['ByteArrayBuilder.<init> (byte[])', 'String.format (byte[], String)'], 'Allocation view, weighted by bytes. Jackson buffers and <code>String.format</code> in a log line make most of the garbage. That drives young-GC frequency. Fix those sites first (reuse the <code>ObjectMapper</code>, stream output, parameterized logging). Then think about GC flags.']
    }[mode];
    st.push({ run: () => { S.hl = finale[0]; S.last = null; }, t: finale[1] });
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    S = { samples: [], last: null, hl: null, ticks: [], biased: false, showBiased: false, showTrue: false };
    hoverLine.textContent = mode === 'bias' ? '' : 'Hover a box to see its share.';
    steps = plan(); render(); bStep.disabled = false;
    say({ cpu: 'An order API under load. Each step merges a batch of CPU samples into the flame graph. Press Play or Step.', wall: 'The same API, sampled by wall clock: every thread, running or not.', alloc: 'The same API, sampled by bytes allocated.', bias: 'Why some profilers blame the wrong method.' }[mode]);
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; s.run(); render(); say(typeof s.t === 'function' ? s.t() : s.t);
    if (k >= steps.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
