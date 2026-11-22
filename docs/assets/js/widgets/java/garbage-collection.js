/* Garbage collection: marking from GC roots, G1 regions through a young → concurrent mark → mixed cycle,
   pause profiles of Parallel / G1 / ZGC, and reading a G1 log. */
IA.widget('garbage-collection', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'mark'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['mark', 'reachability & roots'], ['g1', 'G1 regions'], ['pauses', 'Parallel vs G1 vs ZGC'], ['log', 'reading a GC log']], () => mode, (v) => { mode = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 320;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Garbage collector state' });
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const code = (src, lang) => { codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(src, lang || 'bash') })); };

  const TONE = { '': ['var(--surface)', 'var(--border)'], hot: ['var(--accent-soft)', 'var(--accent)'], ok: ['var(--surface)', 'var(--ok)'], err: ['var(--surface)', 'var(--err)'], warn: ['var(--surface)', 'var(--warn)'], dim: ['var(--surface-2)', 'var(--border)'],
    E: ['var(--accent-soft)', 'var(--accent)'], S: ['var(--surface)', 'var(--ok)'], O: ['var(--surface)', 'var(--warn)'], H: ['var(--surface)', 'var(--err)'], F: ['var(--surface-2)', 'var(--border)'], pause: ['var(--err)', 'var(--err)'], run: ['var(--accent-soft)', 'var(--accent-soft)'], conc: ['var(--surface)', 'var(--accent-2)'] };
  const LC = { '': 'var(--text-3)', hot: 'var(--accent)', ok: 'var(--ok)', err: 'var(--err)', warn: 'var(--warn)' };
  let S;
  const clip = (a, b) => { const cx = a.x + a.w / 2, cy = a.y + a.h / 2; const dx = b.x + b.w / 2 - cx, dy = b.y + b.h / 2 - cy; const t = Math.min(dx ? (a.w / 2) / Math.abs(dx) : 1e9, dy ? (a.h / 2) / Math.abs(dy) : 1e9); return [cx + dx * t, cy + dy * t]; };
  function render() {
    stage.innerHTML = '';
    stage.append(svg('defs', null, ...['', 'hot', 'ok', 'err', 'warn'].map((t) => svg('marker', { id: 'gc-a' + t, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: LC[t] })))));
    (S.edges || []).forEach((e) => { const a = S.nodes[e.from], b = S.nodes[e.to]; if (!a || !b) return; const [x1, y1] = clip(a, b); const [x2, y2] = clip(b, a); const st = e.state || '';
      stage.append(svg('line', { x1, y1, x2, y2, stroke: LC[st], 'stroke-width': st ? 2.2 : 1.3, opacity: e.faded ? 0.35 : 1, 'marker-end': `url(#gc-a${st})` })); });
    Object.values(S.nodes).forEach((n) => { const [f, s] = TONE[n.state || ''];
      stage.append(svg('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: n.r == null ? 7 : n.r, fill: f, stroke: s, 'stroke-width': n.state && !['dim', 'F', 'run'].includes(n.state) ? 2 : 1.1, 'stroke-dasharray': n.state === 'dim' ? '4 3' : null, opacity: n.gone ? 0.25 : 1 }));
      if (n.label) stage.append(svg('text', { x: n.x + n.w / 2, y: n.y + (n.sub ? Math.min(17, n.h / 2) : n.h / 2 + 4.5), 'text-anchor': 'middle', 'font-size': n.fs || 12.5, 'font-weight': 700, fill: n.state === 'dim' || n.state === 'F' ? 'var(--text-3)' : 'var(--text)', 'text-decoration': n.gone ? 'line-through' : null, text: n.label }));
      if (n.sub) stage.append(svg('text', { x: n.x + n.w / 2, y: n.y + Math.min(32, n.h / 2 + 13), 'text-anchor': 'middle', 'font-size': 10.5, 'font-family': 'var(--mono)', fill: 'var(--text-2)', text: n.sub })); });
    (S.notes || []).forEach((t) => stage.append(svg('text', { x: t.x, y: t.y, 'font-size': t.size || 12, 'text-anchor': t.anchor || 'start', 'font-family': t.mono ? 'var(--mono)' : null, 'font-weight': t.bold ? 700 : 400, fill: t.c || 'var(--text-2)', text: t.t })));
    stats.innerHTML = ''; (S.stats || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
  }
  const N = (id, x, y, w, h, label, sub, o) => { S.nodes[id] = Object.assign({ x, y, w, h, label, sub, state: '' }, o || {}); };
  const set = (id, o) => Object.assign(S.nodes[id], o);

  /* ---------- G1 region grid ---------- */
  const COLS = 10, ROWS = 4, RW = 70, RH = 46, GX = 25, GY = 44;
  const regions = () => { for (let i = 0; i < COLS * ROWS; i++) N('r' + i, GX + (i % COLS) * (RW + 2), GY + Math.floor(i / COLS) * (RH + 4), RW, RH, '', '', { state: 'F', r: 4, fs: 12 }); };
  const R = (i, t, sub) => set('r' + i, { state: t, label: t === 'F' ? '' : t, sub: sub || '' });
  const count = (t) => Object.keys(S.nodes).filter((id) => id[0] === 'r' && S.nodes[id].state === t).length;
  const g1stats = (extra) => { S.stats = [['eden', count('E')], ['survivor', count('S')], ['old', count('O')], ['humongous', count('H')], ['free', count('F')]].concat(extra || []); };

  function plan() {
    const st = []; const P = (run, t) => st.push({ run, t });
    if (mode === 'mark') {
      code('// roots: locals of live frames, static fields, JNI refs, active threads, class loaders, …\nstatic final Map<String, Session> SESSIONS = new HashMap<>();   // a root, via the Class object', 'java');
      N('stack', 20, 40, 130, 44, 'stack: main', 'local req'); N('static', 20, 130, 130, 44, 'static', 'SESSIONS'); N('thr', 20, 220, 130, 44, 'thread: worker', 'Runnable');
      [['req', 220, 40, 'Request'], ['user', 380, 20, 'User'], ['addr', 540, 20, 'Address'], ['map', 220, 130, 'HashMap'], ['s1', 380, 110, 'Session'], ['s2', 380, 170, 'Session'], ['task', 220, 230, 'Task'], ['buf', 380, 250, 'byte[]'], ['c1', 570, 130, 'Node A'], ['c2', 570, 220, 'Node B'], ['tmp', 640, 70, 'String']].forEach(([id, x, y, l]) => N(id, x, y, 110, 40, l, ''));
      S.nodes.tmp.w = 100;
      S.edges = [['stack', 'req'], ['req', 'user'], ['user', 'addr'], ['static', 'map'], ['map', 's1'], ['map', 's2'], ['thr', 'task'], ['task', 'buf'], ['c1', 'c2'], ['c2', 'c1'], ['s1', 'user']].map(([from, to]) => ({ from, to }));
      const mark = (ids, edges) => { ids.forEach((id) => set(id, { state: 'ok' })); S.edges.forEach((e) => { if (edges.includes(e.from + '>' + e.to)) e.state = 'ok'; }); };
      P(() => { ['stack', 'static', 'thr'].forEach((id) => set(id, { state: 'hot' })); S.stats = [['marked', 0]]; }, 'A tracing GC never asks “is this object garbage?”. It asks “what can the program still reach?”, starting from the <b>GC roots</b>: local variables in live stack frames, static fields, active threads, JNI references and a few JVM-internal ones.');
      P(() => { mark(['req', 'map', 'task'], ['stack>req', 'static>map', 'thr>task']); S.stats = [['marked', 3]]; }, 'Mark everything the roots point at directly.');
      P(() => { mark(['user', 's1', 's2', 'buf'], ['req>user', 'map>s1', 'map>s2', 'task>buf', 's1>user']); S.stats = [['marked', 7]]; }, 'Then everything <i>those</i> objects point at, and so on. A shared object (User) is marked once, however many paths lead to it.');
      P(() => { mark(['addr'], ['user>addr']); S.stats = [['marked', 8], ['unreached', 3]]; }, 'Marking ends when no new objects are found. The String was dropped by a finished method; nothing points to it.');
      P(() => { ['c1', 'c2'].forEach((id) => set(id, { state: 'warn' })); }, 'Node A and Node B point at <b>each other</b>, so a reference counter would keep them forever. A tracing GC doesn’t care: no path from a root reaches them, so they are garbage.');
      P(() => { ['c1', 'c2', 'tmp'].forEach((id) => set(id, { state: 'dim', gone: true })); S.edges.forEach((e) => { if (e.from === 'c1' || e.from === 'c2') e.faded = true; }); S.stats = [['live', 11], ['reclaimed', 3]]; }, 'Unmarked objects are reclaimed: by copying the live ones elsewhere (young GC), by compacting, or by sweeping free lists. Cost scales with <b>live</b> objects, not garbage. A leak is the opposite case: an object you no longer need that is <i>still reachable</i>, e.g. a session nobody removed from <code>SESSIONS</code>. See <a href="leaks-oom.html">Memory leaks</a>.');
    } else if (mode === 'g1') {
      code('-XX:+UseG1GC -Xmx640m -XX:MaxGCPauseMillis=200 -XX:InitiatingHeapOccupancyPercent=45\n# 40 regions × 16 MB in this picture (G1 picks 1–32 MB regions from the heap size)');
      regions(); S.notes = [{ x: GX, y: 30, t: 'heap = 40 equal regions; each region is E(den), S(urvivor), O(ld), H(umongous) or free', size: 11.5, c: 'var(--text-3)' }];
      P(() => { for (let i = 0; i < 12; i++) R(i, 'E'); g1stats(); }, 'G1 splits the heap into equal <b>regions</b>. Young and old are just labels on regions, not fixed areas. New objects fill <b>eden</b> regions; G1 sizes eden to meet the pause-time goal.');
      P(() => { for (let i = 0; i < 12; i++) R(i, 'F'); R(12, 'S'); R(13, 'S'); g1stats([['pause', 'Young 9 ms']]); }, '<b>Pause Young</b>: the application stops; G1 copies live objects from all eden regions into 2 survivor regions and frees the 12 eden regions in one go. Pause time is proportional to live data copied.');
      P(() => { for (let i = 0; i < 12; i++) R(i, 'E'); [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34].forEach((i) => R(i, 'O')); g1stats([['old occupancy', '≥ 45% IHOP']]); }, 'After many young GCs, long-lived objects have been <b>promoted</b> into old regions. When old occupancy crosses the <b>IHOP</b> (45% by default, adapted at runtime), G1 starts a marking cycle.');
      P(() => { const live = ['92%', '15%', '88%', '5%', '70%', '0%', '30%', '95%', '12%', '60%', '0%', '85%', '20%', '78%', '40%'];
        [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34].forEach((i, j) => R(i, 'O', 'live ' + live[j])); g1stats([['pause', 'Young (Concurrent Start)'], ['then', 'concurrent mark']]); },
        '<b>Concurrent marking</b> runs alongside the application (SATB: it marks what was live at the start). It records, per old region, how much is still live. Only the start (piggybacked on a young pause), <b>Remark</b> and <b>Cleanup</b> are short pauses.');
      P(() => { [25, 30].forEach((i) => R(i, 'F')); g1stats([['freed at cleanup', '2 empty regions']]); }, 'Regions with no live data at all are freed immediately at Cleanup.');
      P(() => { for (let i = 0; i < 12; i++) R(i, 'F'); [23, 28, 21].forEach((i) => R(i, 'F')); R(14, 'S'); R(26, 'O', 'live 30%'); R(15, 'O', 'compacted'); g1stats([['pause', 'Young (Mixed) 31 ms']]); },
        '<b>Mixed GCs</b>: young regions plus the old regions with the <b>most garbage</b> (5%, 12%, 15% live): <b>garbage first</b>. Their few live objects are copied out and the regions freed. G1 spreads this over several mixed pauses to stay within <code>MaxGCPauseMillis</code>.');
      P(() => { [36, 37, 38].forEach((i) => R(i, 'H', i === 36 ? '40 MB byte[]' : '')); g1stats(); }, 'An object of at least half a region goes into <b>humongous</b> regions: contiguous, allocated straight in old space. Many short-lived humongous objects are a classic G1 problem; raise <code>-XX:G1HeapRegionSize</code> or allocate smaller chunks.');
      P(() => { for (let i = 0; i < 40; i++) { const s = S.nodes['r' + i].state; if (s === 'F') R(i, i < 12 ? 'E' : 'O', ''); } g1stats([['pause', 'Full GC 2.4 s'], ['cause', 'no free regions']]); S.notes.push({ x: W / 2, y: 300, t: 'Pause Full (G1 Compaction Pause): to-space exhausted, all threads stopped', anchor: 'middle', bold: true, c: 'var(--err)' }); },
        'If the application allocates faster than marking and mixed GCs can free regions, G1 runs out of space to copy into (evacuation failure) and falls back to a <b>Full GC</b>: stop-the-world compaction of the whole heap (parallel since JDK 10, but still long). Fix: more heap headroom, an earlier IHOP, or less allocation.');
    } else if (mode === 'pauses') {
      code('-XX:+UseParallelGC      # throughput\n-XX:+UseG1GC            # default since JDK 9: balanced\n-XX:+UseZGC -XX:+ZGenerational   # JDK 21: sub-millisecond pauses (generational is default from JDK 23)');
      S.notes = [{ x: 150, y: 24, t: 'Illustrative 10 s of the same workload (not a benchmark).  ▮ = stop-the-world pause  ▭ = concurrent GC work', size: 11, c: 'var(--text-3)' }];
      const X0 = 150, PX = 58; const row = (id, y, label) => { N(id + 'L', 14, y, 126, 50, label, '', { state: 'dim', fs: 12 }); N(id + 'run', X0, y + 18, 10 * PX, 14, '', '', { state: 'run', r: 3 }); };
      const pause = (id, t, ms, y) => N(id, X0 + t * PX, y, Math.max(2, ms / 1000 * PX), 50, '', '', { state: 'pause', r: 1 });
      const conc = (id, t, d, y) => N(id, X0 + t * PX, y + 36, d * PX, 10, '', '', { state: 'conc', r: 2 });
      P(() => { row('par', 50, 'Parallel'); [1, 2, 3, 4, 5, 6, 8, 9].forEach((t, i) => pause('pp' + i, t, 120, 50)); pause('pf', 7, 1300, 50); S.stats = [['Parallel', 'longest pause ~1.3 s, least GC CPU']]; }, '<b>Parallel GC</b>: every collection is stop-the-world, using all cores. Young pauses are short; an old-gen (full) collection pauses for a time proportional to the live heap, often seconds. It has the <b>best throughput</b>: good for batch jobs that don’t care about latency.');
      P(() => { row('g1', 140, 'G1 (default)'); [0.8, 1.7, 2.6, 3.5, 4.4, 5.3, 6.2, 7.1, 8.0, 8.9, 9.6].forEach((t, i) => pause('gp' + i, t, 30, 140)); conc('gc1', 4.4, 1.6, 140); S.stats.push(['G1', 'pauses ~10–50 ms, concurrent marking']); }, '<b>G1</b>: young and mixed pauses aim at <code>MaxGCPauseMillis</code> (200 ms default), usually landing at tens of milliseconds; old-gen <b>marking</b> runs concurrently. A balanced default for most services, from small heaps to tens of GB.');
      P(() => { row('z', 230, 'ZGC (gen.)'); for (let i = 0; i < 20; i++) pause('zp' + i, 0.3 + i * 0.49, 0.5, 230); conc('zc1', 0.4, 2.2, 230); conc('zc2', 3.2, 2.4, 230); conc('zc3', 6.4, 2.6, 230); S.stats.push(['ZGC', 'pauses < 1 ms, more GC CPU']); }, '<b>ZGC</b>: marking, relocation and reference fixing are all concurrent (colored pointers + load barriers), so pauses stay <b>below a millisecond</b> regardless of heap size, up to multi-TB heaps. The price: more CPU and memory headroom. Generational mode (JDK 21, JEP 439) cut that overhead a lot. <b>Shenandoah</b> (in OpenJDK builds such as Temurin and Red Hat’s, not Oracle JDK) takes a similar concurrent-compaction approach.');
      P(() => { S.notes.push({ x: X0, y: 306, t: 'Choose by goal: throughput → Parallel · balanced → G1 · tail latency / huge heaps → ZGC', size: 12, bold: true, c: 'var(--text)' }); }, 'Choosing: start with G1 and set only the heap size. Move to <b>ZGC</b> if p99 latency suffers from GC pauses and you have spare CPU; to <b>Parallel</b> for batch throughput. Under 2 CPUs or ~1.7 GB, the JVM picks <b>Serial</b> by default, which surprises people in tiny containers.');
    } else {
      code('java -Xlog:gc*,safepoint:file=gc.log:time,uptime,level,tags:filecount=5,filesize=20m -jar app.jar');
      const L = [
        '[2026-11-22T10:00:01.120+0000][41.228s][info][gc] GC(118) Pause Young (Normal) (G1 Evacuation Pause) 1210M->302M(2048M) 11.842ms',
        '[2026-11-22T10:00:05.410+0000][45.518s][info][gc] GC(119) Pause Young (Concurrent Start) (G1 Evacuation Pause) 1240M->961M(2048M) 14.215ms',
        '[2026-11-22T10:00:05.411+0000][45.519s][info][gc] GC(120) Concurrent Mark Cycle',
        '[2026-11-22T10:00:05.702+0000][45.810s][info][gc] GC(120) Pause Remark 1020M->1001M(2048M) 6.003ms',
        '[2026-11-22T10:00:05.790+0000][45.898s][info][gc] GC(120) Pause Cleanup 1012M->1012M(2048M) 0.412ms',
        '[2026-11-22T10:00:05.795+0000][45.903s][info][gc] GC(120) Concurrent Mark Cycle 384.012ms',
        '[2026-11-22T10:00:07.010+0000][47.118s][info][gc] GC(121) Pause Young (Mixed) (G1 Evacuation Pause) 1388M->640M(2048M) 27.551ms',
        '[2026-11-22T10:03:12.300+0000][232.408s][info][gc] GC(170) Pause Full (G1 Compaction Pause) 2040M->1890M(2048M) 2410.770ms'];
      L.forEach((l, i) => N('l' + i, 14, 20 + i * 36, 732, 30, '', '', { state: 'dim', r: 4 }));
      const show = (i, st) => { set('l' + i, { state: st || 'hot' }); S.notes.push({ x: 22, y: 40 + i * 36, t: L[i].replace(/^\[[^\]]+\]/, ''), mono: true, size: 10.2, c: 'var(--text)' }); };
      P(() => { show(0); S.stats = [['pause', '11.8 ms'], ['before→after', '1210M → 302M'], ['heap', '2048M committed']]; }, 'One line per GC event. <code>GC(118)</code> is the GC id; <b>Pause Young (Normal)</b> is the event and cause; <code>1210M-&gt;302M(2048M)</code> is heap used before → after (committed size); the last number is the <b>pause</b>. 900 MB freed in 12 ms: healthy young GC.');
      P(() => { show(1); show(2, ''); S.stats = [['after young', '961M: old gen is filling']]; }, '<b>Concurrent Start</b>: old occupancy crossed IHOP, so this young pause also kicks off a <b>concurrent mark cycle</b>. Note “after” is 961M, much higher than before: lots of data is surviving into old regions.');
      P(() => { show(3); show(4); show(5, ''); S.stats = [['Remark', '6.0 ms'], ['Cleanup', '0.4 ms'], ['marking', '384 ms concurrent']]; }, '<b>Remark</b> and <b>Cleanup</b> are the short stop-the-world parts of marking. The final <code>Concurrent Mark Cycle 384ms</code> is wall-clock time while the app kept running: not a pause.');
      P(() => { show(6); S.stats = [['Mixed', '1388M → 640M in 27.6 ms']]; }, '<b>Pause Young (Mixed)</b> reclaims old regions too: after-GC usage drops back to 640M. If after-GC usage keeps <b>climbing</b> from one cycle to the next, live data is growing: a leak or an undersized heap.');
      P(() => { show(7, 'err'); S.stats = [['Full GC', '2.4 s'], ['freed', 'only 150M'], ['verdict', 'heap ≈ live set']]; }, '<b>Pause Full</b>: 2.4 seconds, and it freed only 150 MB of 2 GB. The live set nearly fills the heap. More GC tuning won’t help: give it more heap, or find what is holding the memory (heap dump). Look at the trend in <b>after-GC</b> usage and the <b>pause</b> column; feed long logs to GCeasy or JDK Mission Control.');
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    S = { nodes: {}, edges: [], notes: [], stats: [] };
    steps = plan(); render(); bStep.disabled = false;
    say({ mark: 'Three GC roots and a small object graph. Press Play to mark what is reachable.', g1: 'A 640 MB G1 heap in 40 regions. Press Play to run allocation, young GCs, a marking cycle and mixed GCs.', pauses: 'Press Play to compare how three collectors spend 10 seconds of the same workload.', log: 'Press Play to read a real-format G1 log line by line (JDK 21, <code>-Xlog:gc</code>).' }[mode]);
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
