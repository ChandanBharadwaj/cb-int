/* Memory leaks & OOM: the kinds of OutOfMemoryError, a leaking heap over time, three leak patterns,
   a heap-dump walk-through (dominator tree), and container memory limits. */
IA.widget('leaks-oom', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'leak'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['leak', 'a leak over time'], ['patterns', 'leak patterns'], ['mat', 'heap dump in MAT'], ['kinds', 'OOM kinds'], ['container', 'container limits']], () => mode, (v) => { mode = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 320;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Memory leak diagnosis diagram' });
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const code = (src, lang) => { codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(src, lang || 'java') })); };

  const TONE = { '': ['var(--surface)', 'var(--border)'], hot: ['var(--accent-soft)', 'var(--accent)'], ok: ['var(--surface)', 'var(--ok)'], err: ['var(--surface)', 'var(--err)'], warn: ['var(--surface)', 'var(--warn)'], dim: ['var(--surface-2)', 'var(--border)'] };
  const LC = { '': 'var(--text-3)', hot: 'var(--accent)', ok: 'var(--ok)', err: 'var(--err)', warn: 'var(--warn)' };
  let S;
  const clip = (a, b) => { const cx = a.x + a.w / 2, cy = a.y + a.h / 2; const dx = b.x + b.w / 2 - cx, dy = b.y + b.h / 2 - cy; const t = Math.min(dx ? (a.w / 2) / Math.abs(dx) : 1e9, dy ? (a.h / 2) / Math.abs(dy) : 1e9); return [cx + dx * t, cy + dy * t]; };
  function render() {
    stage.innerHTML = '';
    stage.append(svg('defs', null, ...['', 'hot', 'ok', 'err', 'warn'].map((t) => svg('marker', { id: 'lk-a' + t, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: LC[t] })))));
    Object.values(S.nodes).forEach((n) => { const [f, s] = TONE[n.state || ''];
      stage.append(svg('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 7, fill: f, stroke: s, 'stroke-width': n.state && n.state !== 'dim' ? 2.2 : 1.2, 'stroke-dasharray': n.state === 'dim' ? '4 3' : null }));
      if (n.label) stage.append(svg('text', { x: n.x + (n.left ? 10 : n.w / 2), y: n.y + (n.sub ? 17 : n.h / 2 + 5), 'text-anchor': n.left ? 'start' : 'middle', 'font-size': n.fs || 12.5, 'font-weight': 700, fill: n.state === 'dim' ? 'var(--text-3)' : 'var(--text)', text: n.label }));
      if (n.sub) stage.append(svg('text', { x: n.x + (n.left ? 10 : n.w / 2), y: n.y + 32, 'text-anchor': n.left ? 'start' : 'middle', 'font-size': 10.5, 'font-family': 'var(--mono)', fill: 'var(--text-2)', text: n.sub }));
      if (n.right) stage.append(svg('text', { x: n.x + n.w - 110, y: n.y + n.h / 2 + 4, 'text-anchor': 'end', 'font-size': 11.5, 'font-family': 'var(--mono)', fill: n.rightC || 'var(--text-2)', text: n.right }));
      if (n.right2) stage.append(svg('text', { x: n.x + n.w - 10, y: n.y + n.h / 2 + 4, 'text-anchor': 'end', 'font-size': 11.5, 'font-family': 'var(--mono)', 'font-weight': 700, fill: n.rightC || 'var(--text)', text: n.right2 })); });
    (S.lines || []).forEach((l) => stage.append(svg('polyline', { points: l.pts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: l.c, 'stroke-width': l.w || 1.6, 'stroke-dasharray': l.dash || null, 'stroke-linejoin': 'round' })));
    (S.dots || []).forEach((d) => stage.append(svg('circle', { cx: d[0], cy: d[1], r: 3, fill: d[2] || 'var(--warn)' })));
    (S.edges || []).forEach((e) => { const a = S.nodes[e.from], b = S.nodes[e.to]; if (!a || !b) return; const [x1, y1] = clip(a, b); const [x2, y2] = clip(b, a); const st = e.state || '';
      stage.append(svg('line', { x1, y1, x2, y2, stroke: LC[st], 'stroke-width': st ? 2.2 : 1.3, 'stroke-dasharray': e.dash ? '5 4' : null, 'marker-end': `url(#lk-a${st})` }));
      if (e.label) stage.append(svg('text', { x: (x1 + x2) / 2 + 4, y: (y1 + y2) / 2 - 5, 'font-size': 10.5, fill: LC[st], text: e.label })); });
    (S.notes || []).forEach((t) => stage.append(svg('text', { x: t.x, y: t.y, 'font-size': t.size || 12, 'text-anchor': t.anchor || 'start', 'font-family': t.mono ? 'var(--mono)' : null, 'font-weight': t.bold ? 700 : 400, fill: t.c || 'var(--text-2)', text: t.t })));
    stats.innerHTML = ''; (S.stats || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
  }
  const N = (id, x, y, w, h, label, sub, o) => { S.nodes[id] = Object.assign({ x, y, w, h, label, sub, state: '' }, o || {}); };
  const set = (id, o) => Object.assign(S.nodes[id], o);

  /* ---------- heap-over-time simulation ---------- */
  const CX = 60, CW = 660, CY = 30, CH = 230, MAXMB = 1024;
  const sim = (() => { const pts = []; const gcs = []; let used = 220; let live = 200;
    for (let i = 0; i <= 120; i++) { if (i > 30) live = Math.min(1000, live + 9); used += 48; if (used >= 1000) { pts.push([i, 1000]); used = Math.min(live, 1000); gcs.push([i, used]); } pts.push([i, Math.min(used, 1010)]); }
    return { pts, gcs }; })();
  const X = (i) => CX + i / 120 * CW; const Y = (mb) => CY + CH - mb / MAXMB * CH;
  function chartUpTo(n) {
    S.lines = [{ pts: sim.pts.filter((p) => p[0] <= n).map(([i, v]) => [X(i), Y(v)]), c: 'var(--accent)' }];
    const g = sim.gcs.filter((p) => p[0] <= n); S.dots = g.map(([i, v]) => [X(i), Y(v), v > 800 ? 'var(--err)' : 'var(--warn)']);
    if (g.length > 1) S.lines.push({ pts: g.map(([i, v]) => [X(i), Y(v)]), c: 'var(--warn)', w: 2, dash: '5 4' });
    S.stats = [['young/mixed GCs', g.length], ['after-GC (live) MB', g.length ? Math.round(g[g.length - 1][1]) : '—']];
  }
  const axes = () => { S.notes = [{ x: CX - 8, y: Y(1024) + 4, t: '1 GB', anchor: 'end', size: 10.5, c: 'var(--text-3)' }, { x: CX - 8, y: Y(512) + 4, t: '512', anchor: 'end', size: 10.5, c: 'var(--text-3)' }, { x: CX - 8, y: Y(0) + 4, t: '0', anchor: 'end', size: 10.5, c: 'var(--text-3)' }, { x: CX + CW, y: CY + CH + 22, t: 'time →', anchor: 'end', size: 11, c: 'var(--text-3)' }, { x: CX + 10, y: CY + CH + 22, t: '— heap used   - - after-GC usage (≈ live set)', size: 11, c: 'var(--text-3)' }];
    N('frame', CX, CY, CW, CH, '', '', { state: 'dim' }); S.nodes.frame.state = ''; };

  function plan() {
    const st = []; const P = (run, t) => st.push({ run, t });
    if (mode === 'leak') {
      code('@Component\nclass QuoteCache {\n    private static final Map<String, Quote> CACHE = new ConcurrentHashMap<>();   // no bound, no eviction\n    Quote get(String key) { return CACHE.computeIfAbsent(key, this::price); }    // key includes a timestamp…\n}');
      axes();
      P(() => { chartUpTo(30); }, 'A healthy heap looks like a <b>saw-tooth</b>. Allocation fills it, a GC drops it back. The bottoms of the teeth (orange dots: usage right after GC) show the <b>live data</b>. Here they are flat.');
      P(() => { chartUpTo(62); }, 'A release adds a timestamp to the cache key. Every request now makes a new entry that never leaves. The saw-tooth goes on, but the <b>floor rises</b>. This one chart tells a leak from “high but normal” heap use.');
      P(() => { chartUpTo(96); }, 'As live data grows, each GC frees less. So GCs come <b>more often</b> and the old generation fills. GC CPU rises and latency suffers long before any error.');
      P(() => { chartUpTo(120); S.notes.push({ x: X(120), y: Y(1024) - 6, t: 'OutOfMemoryError: Java heap space', anchor: 'end', bold: true, c: 'var(--err)' }); }, 'Finally GCs free almost nothing, one after another. The JVM throws <b>OutOfMemoryError: Java heap space</b> in whichever thread allocates next. That thread is usually <i>not</i> the culprit. So the OOM stack trace is mostly useless.');
      P(() => { S.notes.push({ x: CX + 10, y: CY + 18, t: '-XX:+HeapDumpOnOutOfMemoryError  →  open the .hprof in MAT  →  dominator tree', mono: true, size: 11, c: 'var(--text)' }); }, 'What helps instead is a <b>heap dump</b>, taken at the OOM (<code>-XX:+HeapDumpOnOutOfMemoryError</code>) or while the floor rises. The leak is whatever <b>holds</b> the growing memory. A dominator tree shows it directly. Switch to “heap dump in MAT”.');
    } else if (mode === 'patterns') {
      code('// 1) static collection      2) ThreadLocal on a pooled thread      3) listener never removed');
      const scene = (n) => { S.nodes = {}; S.edges = []; S.notes = [];
        if (n === 1) {
          N('root', 20, 50, 190, 50, 'GC root', 'class QuoteCache'); N('map', 270, 50, 190, 50, 'static CACHE', 'ConcurrentHashMap'); N('ent', 520, 30, 220, 90, 'entries', '1,200,000 Quote objects', { state: 'err' });
          S.edges = [{ from: 'root', to: 'map', state: 'warn' }, { from: 'map', to: 'ent', state: 'err', label: 'grows forever' }];
          N('fix', 20, 190, 720, 60, 'Fix: bound it (Caffeine maximumSize / expireAfterWrite), or remove entries in the same code path that adds them', '', { state: 'ok', fs: 12 });
        } else if (n === 2) {
          N('thr', 20, 40, 180, 50, 'pool thread', 'http-nio-exec-7'); N('tlm', 240, 40, 170, 50, 'ThreadLocalMap', 'per thread'); N('e', 450, 40, 130, 50, 'Entry', 'key: weak'); N('v', 610, 30, 130, 70, 'value', 'strong → 40 MB', { state: 'err' });
          S.edges = [{ from: 'thr', to: 'tlm', state: 'warn' }, { from: 'tlm', to: 'e', state: 'warn' }, { from: 'e', to: 'v', state: 'err', label: 'strong' }];
          S.notes = [{ x: 20, y: 130, t: 'The thread never dies (it is pooled), so its ThreadLocalMap lives as long as the JVM.', size: 12 }, { x: 20, y: 150, t: 'The key is weak, the value is not: a value referencing its own ThreadLocal or class loader is never freed.', size: 12 }];
          N('fix', 20, 190, 720, 60, 'Fix: try { TL.set(x); … } finally { TL.remove(); }, or use ScopedValue (preview in 21) / request-scoped beans', '', { state: 'ok', fs: 12 });
        } else {
          N('bus', 20, 50, 180, 50, 'EventBus', 'singleton (root)'); N('list', 250, 50, 170, 50, 'listeners', 'CopyOnWriteArrayList'); N('l1', 480, 20, 120, 36, 'Screen#1', '', { state: 'err' }); N('l2', 480, 64, 120, 36, 'Screen#2', '', { state: 'err' }); N('l3', 480, 108, 120, 36, 'Screen#…', '', { state: 'err' }); N('data', 640, 60, 100, 44, 'their data', '');
          S.edges = [{ from: 'bus', to: 'list', state: 'warn' }, { from: 'list', to: 'l1', state: 'err' }, { from: 'list', to: 'l2', state: 'err' }, { from: 'list', to: 'l3', state: 'err' }, { from: 'l2', to: 'data' }];
          S.notes = [{ x: 20, y: 170, t: 'Short-lived objects register a callback and never unregister; a lambda or inner class also captures its outer object.', size: 12 }];
          N('fix', 20, 190, 720, 60, 'Fix: unregister in close()/@PreDestroy, return a Subscription to close, or tie listener lifetime to the owner', '', { state: 'ok', fs: 12 });
        } };
      P(() => { scene(1); S.stats = [['pattern', 'unbounded static collection']]; }, '<b>Static collections</b> (caches, registries, “seen ids” sets). A static field is a GC root for as long as its class is loaded, which means forever. Most production leaks are this: a cache with no size limit, or a key that is unique by accident.');
      P(() => { scene(2); S.stats = [['pattern', 'ThreadLocal on pooled threads']]; }, '<b>ThreadLocal</b> values live in a map on the <i>thread</i>. Request threads are pooled and live forever. A value set and never removed stays. The next request on that thread may even see it, a data leak too. Large values times 200 threads add up.');
      P(() => { scene(3); S.stats = [['pattern', 'listeners / callbacks']]; }, '<b>Listeners and callbacks</b>: registering with a long-lived publisher makes it hold on to you. Also common: lambdas capturing <code>this</code>, connections never closed, and <code>HttpSession</code> attributes holding big graphs.');
    } else if (mode === 'mat') {
      code('jcmd <pid> GC.heap_dump /dumps/app.hprof        # live objects only (forces a full GC)\n# open in Eclipse MAT: Leak Suspects report → Dominator Tree → Path to GC Roots', 'bash');
      const rows = [['r0', 'class com.acme.QuoteCache @ 0x7f…', 'static CACHE', '16 B', '1.41 GB'], ['r1', 'java.util.concurrent.ConcurrentHashMap', '', '64 B', '1.41 GB'], ['r2', 'ConcurrentHashMap$Node[2097152]', '', '8.0 MB', '1.41 GB'], ['r3', '1,200,000 × ConcurrentHashMap$Node', '', '38 MB', '1.40 GB'], ['r4', '1,200,000 × com.acme.Quote', 'each ~1.2 KB retained', '29 MB', '1.36 GB']];
      N('hdr', 20, 20, 720, 26, 'object', '', { left: true, state: 'dim', fs: 11, right: 'shallow', right2: 'retained', rightC: 'var(--text-3)' });
      P(() => { S.notes = [{ x: 20, y: 300, t: 'Leak Suspects: “One instance of QuoteCache occupies 1.41 GB (78%)”', bold: true, c: 'var(--err)' }]; S.stats = [['heap in dump', '1.8 GB'], ['objects', '9.4 M']]; }, 'Open the dump in Eclipse MAT. The <b>Leak Suspects</b> report runs on its own. It often names the culprit outright: one object holding 78% of the heap.');
      rows.forEach(([id, label, sub, sh, ret], i) => P(() => { N(id, 20 + i * 18, 54 + i * 46, 720 - i * 18, 40, label, sub, { left: true, right: sh, right2: ret, state: i === 0 ? 'hot' : i === 4 ? 'err' : '', fs: 12 }); if (i) S.edges = (S.edges || []).concat([{ from: rows[i - 1][0], to: id }]); },
        i === 0 ? 'The <b>dominator tree</b> lists objects by <b>retained size</b>: the memory freed if that object were gone. At the top is the QuoteCache class, through its static field. <b>Shallow</b> size is the object alone (16 bytes). Retained is everything it keeps alive.'
          : i === 2 ? 'Expand it: the map, then its table. The table is 8 MB on its own. What matters is the retained column. It stays at ~1.4 GB all the way down.'
          : i === 4 ? 'At the bottom: 1.2 million <code>Quote</code> objects. Open a few (“List objects → with outgoing references”) and look at the keys. Each contains a timestamp. That’s the bug.' : 'Each level down retains almost the same amount: this is the chain keeping the memory alive.'));
      P(() => { S.notes.push({ x: 20, y: 282, t: 'Path to GC Roots (exclude weak/soft refs) answers “why is this still alive?”', size: 12, c: 'var(--text-2)' }); }, 'For an object you expected to be dead, use <b>Path to GC Roots → exclude weak/soft references</b>. It shows the chain of strong references keeping it alive. Also useful: Histogram (count per class), and comparing two dumps an hour apart.');
    } else if (mode === 'kinds') {
      code('java.lang.OutOfMemoryError: <message>     // the message tells you which area ran out', 'text');
      const areas = [['heap', 20, 40, 300, 110, 'Java heap'], ['meta', 340, 40, 190, 50, 'Metaspace'], ['ccs', 340, 100, 190, 50, 'Compressed class space'], ['direct', 550, 40, 190, 50, 'Direct buffers'], ['threads', 550, 100, 190, 50, 'Native threads (OS)'], ['cg', 20, 170, 720, 40, 'Container / cgroup memory limit (kernel)']];
      areas.forEach(([id, x, y, w, h, l]) => N(id, x, y, w, h, l, '', { fs: 12 }));
      const K = [
        ['heap', 'Java heap space', 'live set > -Xmx (leak, or genuinely too small heap, or one giant allocation)', 'heap dump → dominator tree'],
        ['heap', 'GC overhead limit exceeded', 'Parallel GC: > 98% time in GC recovering < 2% heap: the heap is full of live data', 'same as heap space'],
        ['heap', 'Requested array size exceeds VM limit', 'an array near Integer.MAX_VALUE elements, e.g. a size computed from bad input', 'find the allocation in the stack trace (here it IS the culprit)'],
        ['meta', 'Metaspace', 'too many classes: class-loader leak, runaway proxy or script generation', 'jcmd VM.classloader_stats, heap dump: loaders'],
        ['ccs', 'Compressed class space', 'class metadata pointers > CompressedClassSpaceSize (1 GB default)', 'same as Metaspace'],
        ['direct', 'Cannot reserve … bytes of direct buffer memory', 'off-heap NIO buffers hit MaxDirectMemorySize', 'jvm.buffer.memory.used, NMT, buffer pooling'],
        ['threads', 'unable to create native thread', 'OS refused a thread: ulimit -u, pids cgroup limit, or no memory for its stack', 'count threads (jcmd Thread.print), bound pools'],
        ['cg', '(no Java error) OOMKilled, exit code 137', 'RSS > container limit: the kernel kills the process', 'NMT vs RSS; MaxRAMPercentage; cap native areas']];
      K.forEach(([area, msg, why, act]) => P(() => { Object.values(S.nodes).forEach((n) => { n.state = ''; }); set(area, { state: area === 'cg' ? 'err' : 'hot' });
        S.notes = [{ x: 20, y: 240, t: msg, bold: true, mono: true, size: 13, c: 'var(--err)' }, { x: 20, y: 264, t: 'why: ' + why, size: 12 }, { x: 20, y: 286, t: 'first step: ' + act, size: 12, c: 'var(--text)' }]; S.stats = [['area', S.nodes[area].label]]; },
        `<b>${msg}</b>: ${why}. First step: ${act}.`));
    } else {
      code('# pod: memory limit 2Gi\nJAVA_TOOL_OPTIONS="-Xmx1800m"     # ✗ leaves ~250 MB for everything else', 'bash');
      N('lim', 20, 40, 720, 30, '', '', { state: 'dim' }); S.notes = [{ x: 740, y: 34, t: 'limit 2048 MB', anchor: 'end', size: 11, c: 'var(--err)' }];
      const scale = 720 / 2048; const seg2 = (id, x0, mb, l, st) => N(id, 20 + x0 * scale, 90, mb * scale, 50, mb * scale > l.length * 7 + 8 ? l : '', mb * scale > 60 ? mb + ' MB' : '', { state: st, fs: 12 });
      P(() => { seg2('heap', 0, 1800, 'heap (committed)', 'hot'); S.stats = [['RSS', '1800 MB']]; }, 'Committed heap grows toward <code>-Xmx</code> as the app warms up: 1800 MB of a 2048 MB limit. The heap dashboard looks fine. Lots of free heap inside it.');
      P(() => { seg2('meta', 1800, 150, 'metaspace', 'warn'); S.stats = [['RSS', '1950 MB']]; }, 'Add metaspace and code cache: ~150 MB.');
      P(() => { seg2('thr', 1950, 120, 'threads + direct', 'err'); S.stats = [['RSS', '2070 MB > limit']]; S.notes.push({ x: 380, y: 180, t: 'kernel: Memory cgroup out of memory: Killed process (java)', anchor: 'middle', bold: true, mono: true, size: 12, c: 'var(--err)' }, { x: 380, y: 202, t: 'kubectl: Last State: Terminated, Reason: OOMKilled, Exit Code: 137', anchor: 'middle', mono: true, size: 11.5, c: 'var(--text-2)' }); },
        'A traffic burst adds threads and direct buffers. Total memory passes 2048 MB, and the <b>kernel</b> kills the JVM. No OutOfMemoryError, no heap dump, no shutdown hooks. Only <code>OOMKilled</code> / exit 137 in <code>kubectl describe pod</code>.');
      P(() => { S.nodes = { lim: S.nodes.lim }; seg2('heap', 0, 1230, 'heap (MaxRAMPercentage=60)', 'ok'); seg2('meta', 1230, 150, 'meta', 'ok'); seg2('thr', 1380, 200, 'threads+direct', 'ok'); S.notes = [S.notes[0], { x: 20 + 1580 * scale + 8, y: 120, t: '≈ 470 MB headroom', size: 12, c: 'var(--ok)', bold: true }]; S.stats = [['RSS', '~1580 MB'], ['headroom', '~470 MB']]; },
        'Fix: size the heap as a share of the limit (<code>-XX:MaxRAMPercentage=60</code> → ~1230 MB). Cap direct memory and metaspace. Limit thread pools. Now the heap runs out first. You get a Java OOM <b>with</b> a heap dump instead of a silent kill.');
      P(() => { S.notes.push({ x: 20, y: 200, t: '-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps  (a mounted volume)', mono: true, size: 11.5, c: 'var(--text)' }, { x: 20, y: 222, t: '-XX:+ExitOnOutOfMemoryError  → the pod restarts cleanly after the dump', mono: true, size: 11.5, c: 'var(--text)' }); },
        'Make a Java OOM useful. Write the dump to a persistent volume, because a container’s own disk vanishes on restart. Then exit, so Kubernetes restarts the pod instead of leaving it half-broken. Alert on <code>jvm_memory_used_bytes</code> after GC and on container memory.');
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    S = { nodes: {}, edges: [], notes: [], lines: [], dots: [], stats: [] };
    steps = plan(); render(); bStep.disabled = false;
    say({ leak: 'Heap usage of a service over a day. Press Play and watch the bottoms of the saw-tooth.', patterns: 'Three ways code keeps objects reachable by accident. Press Play.', mat: 'A heap dump of the leaking service, opened in Eclipse MAT. Press Play.', kinds: 'Every OutOfMemoryError message names the area that ran out. Press Play to go through them.', container: 'A JVM in a 2 GiB pod. Press Play to add up its memory.' }[mode]);
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
