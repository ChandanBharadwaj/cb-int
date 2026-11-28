/* JVM memory areas: the process memory map, stack frames vs heap objects, generational allocation,
   object header layout & compressed oops, and direct buffers. */
IA.widget('jvm-memory-areas', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'map'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['map', 'process memory map'], ['stack', 'stack & frames'], ['gen', 'heap generations'], ['header', 'object header'], ['direct', 'direct memory']], () => mode, (v) => { mode = v; reset(); }, 'Area');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 320;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Diagram of JVM memory areas' });
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const code = (src, lang) => { codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(src, lang || 'java') })); };

  /* ---- generic box diagram ---- */
  const TONE = { '': ['var(--surface)', 'var(--border)'], hot: ['var(--accent-soft)', 'var(--accent)'], ok: ['var(--surface)', 'var(--ok)'], err: ['var(--surface)', 'var(--err)'], warn: ['var(--surface)', 'var(--warn)'], dim: ['var(--surface-2)', 'var(--border)'], fill: ['var(--surface-2)', 'var(--border)'] };
  const LC = { '': 'var(--border)', hot: 'var(--accent)', ok: 'var(--ok)', err: 'var(--err)', warn: 'var(--warn)' };
  let S;
  const clip = (a, b) => { const cx = a.x + a.w / 2, cy = a.y + a.h / 2; const dx = b.x + b.w / 2 - cx, dy = b.y + b.h / 2 - cy; const t = Math.min(dx ? (a.w / 2) / Math.abs(dx) : 1e9, dy ? (a.h / 2) / Math.abs(dy) : 1e9); return [cx + dx * t, cy + dy * t]; };
  function render() {
    stage.innerHTML = '';
    stage.append(svg('defs', null, ...['', 'hot', 'ok', 'err', 'warn'].map((t) => svg('marker', { id: 'jm-a' + t, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: LC[t] })))));
    Object.values(S.nodes).forEach((n) => { const [f, s] = TONE[n.state || ''];
      stage.append(svg('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: n.r == null ? 7 : n.r, fill: f, stroke: s, 'stroke-width': n.state && n.state !== 'dim' && n.state !== 'fill' ? 2.2 : 1.2, 'stroke-dasharray': n.state === 'dim' ? '4 3' : null }));
      if (n.label) stage.append(svg('text', { x: n.x + n.w / 2, y: n.y + (n.top || n.sub ? Math.min(18, n.h / 2) : n.h / 2 + 5), 'text-anchor': 'middle', 'font-size': n.fs || 13, 'font-weight': 700, fill: n.state === 'dim' ? 'var(--text-3)' : 'var(--text)', text: n.label }));
      if (n.sub) String(n.sub).split('\n').forEach((ln, i) => stage.append(svg('text', { x: n.x + n.w / 2, y: n.y + Math.min(34, n.h / 2 + 14) + i * 14, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'var(--mono)', fill: 'var(--text-2)', text: ln }))); });
    (S.edges || []).forEach((e) => { const a = S.nodes[e.from], b = S.nodes[e.to]; if (!a || !b) return; const [x1, y1] = clip(a, b); const [x2, y2] = clip(b, a); const st = e.state || '';
      stage.append(svg('line', { x1, y1, x2, y2, stroke: LC[st], 'stroke-width': st ? 2.2 : 1.4, 'stroke-dasharray': e.dash ? '5 4' : null, 'marker-end': `url(#jm-a${st})` })); });
    (S.notes || []).forEach((t) => stage.append(svg('text', { x: t.x, y: t.y, 'font-size': t.size || 12, 'text-anchor': t.anchor || 'start', 'font-family': t.mono ? 'var(--mono)' : null, 'font-weight': t.bold ? 700 : 400, fill: t.c || 'var(--text-2)', text: t.t })));
    stats.innerHTML = ''; (S.stats || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
  }
  const N = (id, x, y, w, h, label, sub, o) => { S.nodes[id] = Object.assign({ x, y, w, h, label, sub, state: '' }, o || {}); };
  const set = (id, o) => Object.assign(S.nodes[id], o);
  const clearAll = () => Object.values(S.nodes).forEach((n) => { if (n.state !== 'fill') n.state = ''; });

  function plan() {
    const st = []; const P = (run, t) => st.push({ run, t });
    if (mode === 'map') {
      code('# example: a Spring Boot service in a 2 GiB container, JDK 21\njava -XX:MaxRAMPercentage=50 -Xss1m -XX:MaxMetaspaceSize=256m \\\n     -XX:ReservedCodeCacheSize=240m -XX:MaxDirectMemorySize=256m -jar app.jar', 'bash');
      const A = [['heap', 'Java heap', 1024, '-Xmx / MaxRAMPercentage'], ['meta', 'Metaspace', 150, 'MaxMetaspaceSize'], ['code', 'Code cache', 60, 'ReservedCodeCacheSize'], ['stk', 'Thread stacks', 120, '-Xss × threads'], ['dir', 'Direct buffers', 100, 'MaxDirectMemorySize'], ['gc', 'GC data', 80, 'remembered sets, card table, bitmaps'], ['oth', 'Other native', 70, 'symbols, arenas, JNI, malloc']];
      const total = A.reduce((s, a) => s + a[2], 0); let x = 20; const scale = 720 / 2048;
      A.forEach(([id, l, mb]) => { const w = mb * scale; N(id, x, 40, w, 60, w > 70 ? l : '', w > 70 ? mb + ' MB' : '', { fs: 12 }); x += w; });
      N('free', x, 40, 740 - x, 60, '', '', { state: 'dim' });
      S.notes = [{ x: 20, y: 28, t: 'Resident memory of one JVM process (example numbers)', c: 'var(--text-3)' }, { x: 740, y: 120, t: '2 GiB container limit ▲', anchor: 'end', c: 'var(--err)', size: 11 }];
      const say1 = (i, t) => P(() => { clearAll(); const [id, l, mb, flag] = A[i]; set(id, { state: 'hot' }); S.notes = S.notes.slice(0, 2).concat([{ x: 20, y: 160, t: l + ': ' + mb + ' MB', bold: true, size: 15, c: 'var(--text)' }, { x: 20, y: 184, t: 'controlled by: ' + flag, mono: true, size: 12 }]); S.stats = [['running total', A.slice(0, i + 1).reduce((s, a) => s + a[2], 0) + ' MB']]; }, t);
      say1(0, '<b>Java heap</b>: where objects live. The GC manages it. <code>-Xmx</code> sets its maximum, or <code>MaxRAMPercentage</code> in containers (default 25% of the limit). Most people size only this area. It is usually half the process.');
      say1(1, '<b>Metaspace</b>: class data (methods, bytecode, constant pools). It is native memory with no limit by default. A Spring Boot app often uses 100–200 MB.');
      say1(2, '<b>Code cache</b>: machine code made by the JIT. 240 MB is reserved by default. If it fills, the JIT stops compiling. You get a warning, not an OOM.');
      say1(3, '<b>Thread stacks</b>: one per platform thread, each up to <code>-Xss</code> (1 MB on Linux x64). Only touched pages count. But 400 threads deep in Spring + Hibernate add up.');
      say1(4, '<b>Direct buffers</b>: <code>ByteBuffer.allocateDirect</code>, used by NIO, Netty, Kafka and gRPC. Native memory, capped by <code>MaxDirectMemorySize</code> (default ≈ max heap).');
      say1(5, '<b>GC data structures</b>: G1’s bookkeeping tables take a few percent of the heap.');
      say1(6, '<b>Everything else</b>: the symbol table, compiler arenas, JNI and native libraries (e.g. compression codecs), glibc malloc arenas.');
      P(() => { clearAll(); S.notes = S.notes.slice(0, 2).concat([{ x: 20, y: 160, t: `Total ≈ ${total} MB for a 1024 MB heap`, bold: true, size: 15, c: 'var(--text)' }, { x: 20, y: 184, t: 'jcmd <pid> VM.native_memory summary   (needs -XX:NativeMemoryTracking=summary)', mono: true, size: 11 }]); S.stats = [['total', total + ' MB'], ['heap share', Math.round(1024 / total * 100) + '%']]; },
        'Total memory is well above <code>-Xmx</code>. So a pod with “-Xmx = limit” gets <b>killed</b> by the kernel with no Java error. Leave 25–50% headroom. Measure with Native Memory Tracking.');
    } else if (mode === 'stack') {
      code('void handle(Request req) {\n    Order order = new Order(req.id());   // object on the heap, reference in the frame\n    int total = price(order, 3);         // primitives live in the frame\n}\nint price(Order o, int qty) { int unit = o.unit(); return unit * qty; }');
      N('stkT', 20, 14, 300, 22, 'Thread stack (grows ↓ in this picture)', '', { state: 'fill', fs: 11 });
      N('heapT', 420, 14, 320, 22, 'Heap (shared by all threads)', '', { state: 'fill', fs: 11 });
      N('main', 20, 44, 300, 50, 'run()', 'locals: this, req →');
      P(() => { set('main', { state: 'hot' }); N('req', 440, 50, 140, 40, 'Request', 'id = 42'); S.edges = [{ from: 'main', to: 'req' }]; S.stats = [['frames', 1]]; }, 'Each thread has its own stack of <b>frames</b>. A frame holds local variables and a return address. Objects never sit in the frame. The frame holds addresses that point to them (<b>references</b>).');
      P(() => { set('main', { state: '' }); N('h', 20, 102, 300, 50, 'handle(req)', 'req →   order →   total = ?'); set('h', { state: 'hot' }); N('order', 600, 110, 130, 40, 'Order', 'unit = 25'); S.edges.push({ from: 'h', to: 'order', state: 'hot' }); S.stats = [['frames', 2]]; }, 'Calling <code>handle</code> adds a frame. <code>new Order(…)</code> puts the object on the heap. The frame keeps a reference, so the GC treats it as a starting point (a <b>GC root</b>).');
      P(() => { set('h', { state: '' }); S.edges[1].state = ''; N('p', 20, 160, 300, 50, 'price(o, qty)', 'o →   qty = 3   unit = 25'); set('p', { state: 'hot' }); S.edges.push({ from: 'p', to: 'order', state: 'hot' }); S.stats = [['frames', 3]]; }, '<code>price</code> gets its own frame. <code>qty</code> and <code>unit</code> are plain ints in the frame. No heap needed. Two frames now point to the same Order.');
      P(() => { delete S.nodes.p; S.edges = S.edges.filter((e) => e.from !== 'p'); set('h', { state: 'hot', sub: 'req →   order →   total = 75' }); S.stats = [['frames', 2]]; }, '<code>price</code> returns 75. Its frame is removed at once. The stack needs no garbage collection.');
      P(() => { delete S.nodes.h; S.edges = S.edges.filter((e) => e.from !== 'h'); set('main', { state: 'hot' }); set('order', { state: 'dim', sub: 'unreachable' }); S.stats = [['frames', 1]]; }, '<code>handle</code> returns. Nothing points to the Order now, so it is garbage. The next young GC frees it. If the JIT proves an object never leaves a method, it may skip the heap entirely (<b>escape analysis</b>, see <a href="jit-compilation.html">JIT</a>).');
      P(() => { set('main', { state: '' }); for (let i = 0; i < 4; i++) N('r' + i, 20, 102 + i * 50, 300, 44, i < 3 ? 'parse(node)  (recursive)' : '… 10 000+ frames …', '', { state: i === 3 ? 'err' : 'warn', fs: 12 }); S.notes = [{ x: 20, y: 312, t: 'java.lang.StackOverflowError', bold: true, c: 'var(--err)' }]; S.stats = [['-Xss', '1 MB default (Linux x64)']]; }, 'Endless recursion fills the stack and throws <b>StackOverflowError</b>. A cycle in <code>toString</code> or deeply nested JSON can cause it. <code>-Xss</code> sets each thread’s maximum. Virtual threads keep parked frames on the heap, so a million of them need no native stacks.');
    } else if (mode === 'gen') {
      code('-XX:+UseG1GC (default since Java 9)   -XX:MaxTenuringThreshold=15 (default)', 'bash');
      N('eden', 20, 40, 360, 110, 'Eden', '', { top: true }); N('s0', 400, 40, 160, 110, 'Survivor S0', '', { top: true }); N('s1', 580, 40, 160, 110, 'Survivor S1', '', { top: true }); N('old', 20, 180, 720, 110, 'Old generation', '', { top: true });
      S.notes = [{ x: 20, y: 28, t: 'Young generation', c: 'var(--text-3)' }, { x: 20, y: 172, t: 'Old generation', c: 'var(--text-3)' }];
      let objs = [];
      const dot = (id, area, i, label, st) => { const A = S.nodes[area]; const cols = Math.floor(A.w / 50); N(id, A.x + 10 + (i % cols) * 50, A.y + 30 + Math.floor(i / cols) * 36, 42, 28, label, '', { state: st || 'hot', fs: 11, r: 5 }); };
      const clearDots = () => { objs.forEach((id) => delete S.nodes[id]); objs = []; };
      P(() => { ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].forEach((id, i) => { dot(id, 'eden', i, id); objs.push(id); }); S.stats = [['eden', '6 objects']]; }, 'New objects go into <b>eden</b>. Each thread owns a slice there (a <b>TLAB</b>). Allocating is a pointer bump: no lock, a few instructions.');
      P(() => { ['a1', 'a3', 'a4', 'a6'].forEach((id) => set(id, { state: 'dim' })); }, 'Most objects die young: request DTOs, iterators, temporary strings. Here four of six are already unreachable (dashed). This idea is the <b>weak generational hypothesis</b>.');
      P(() => { clearDots(); dot('a2', 's0', 0, 'a2·1', 'ok'); dot('a5', 's0', 1, 'a5·1', 'ok'); objs.push('a2', 'a5'); set('eden', { state: 'ok' }); S.stats = [['young GC', '#1: copied 2, freed 4']]; }, '<b>Young GC</b> pauses the app briefly. It copies only the <b>live</b> objects to a survivor space. Then all of eden is free. The cost depends on survivors, not garbage. Each survivor is now age 1.');
      P(() => { set('eden', { state: '' }); ['b1', 'b2', 'b3', 'b4', 'b5'].forEach((id, i) => { dot(id, 'eden', i, id); objs.push(id); }); set('b1', { state: 'dim' }); set('b2', { state: 'dim' }); set('b4', { state: 'dim' }); set('b5', { state: 'dim' }); }, 'More allocation. Again, most of it dies quickly.');
      P(() => { clearDots(); dot('a2', 's1', 0, 'a2·2', 'ok'); dot('a5', 's1', 1, 'a5·2', 'ok'); dot('b3', 's1', 2, 'b3·1', 'ok'); objs.push('a2', 'a5', 'b3'); S.stats = [['young GC', '#2: survivors ping-pong S0 → S1']]; }, 'Young GC #2 copies live objects from eden <b>and</b> S0 into S1. Ages go up. The two survivor spaces swap roles each cycle.');
      P(() => { clearDots(); dot('a2', 'old', 0, 'a2', 'warn'); dot('b3', 's0', 0, 'b3·2', 'ok'); objs.push('a2', 'b3'); S.stats = [['promoted', 'a2 → old']]; }, 'Objects that survive enough cycles (up to 15) get <b>promoted</b> to the old generation. So do ones that don’t fit in survivor space. Think caches, pools, Spring beans. Here a2 is promoted and a5 has died.');
      P(() => { dot('big', 'old', 3, 'byte[]', 'err'); set('big', { w: 140, label: 'humongous' }); objs.push('big'); }, 'In G1, an object of half a region or more is <b>humongous</b>. It goes straight into old regions. The old space is collected much less often. See <a href="garbage-collection.html">Garbage collection</a>.');
    } else if (mode === 'header') {
      code('// 64-bit HotSpot, JDK 21, compressed oops + compressed class pointers (heap < 32 GB)\n// measure yourself: org.openjdk.jol:jol-core → ClassLayout.parseInstance(obj).toPrintable()');
      const PX = 17; const X0 = 40;
      const layout = (title, parts, total, note) => () => {
        S.nodes = {}; S.notes = []; let off = 0;
        parts.forEach(([l, b, st], i) => { N('p' + i, X0 + off * PX, 70, b * PX, 58, b * PX > 44 ? l : '', b * PX > 30 ? b + ' B' : '', { state: st, fs: 11, r: 3 }); off += b; });
        for (let b = 0; b <= total; b += 8) S.notes.push({ x: X0 + b * PX, y: 146, t: String(b), anchor: 'middle', size: 10, c: 'var(--text-3)' });
        S.notes = S.notes.filter((n) => n.y === 146).concat([{ x: X0, y: 40, t: title, bold: true, size: 15, c: 'var(--text)' }, { x: X0, y: 180, t: `instance size: ${total} bytes`, mono: true, size: 13, c: 'var(--accent)' }, { x: X0, y: 204, t: note, size: 12 }]);
        S.stats = [['size', total + ' B']];
      };
      P(layout('new Object()', [['mark word', 8, 'hot'], ['klass', 4, 'ok'], ['pad', 4, 'dim']], 16, 'mark word: identity hash, GC age, lock state. klass: compressed pointer to class metadata.'), 'Every object starts with a <b>header</b>. It has an 8-byte <b>mark word</b> (hash code, GC age, lock bits) and a 4-byte <b>class pointer</b>. Objects align to 8 bytes, so even an empty one is <b>16 bytes</b>.');
      P(layout('Integer', [['mark word', 8, 'hot'], ['klass', 4, 'ok'], ['int value', 4, '']], 16, 'The int fits in the 4-byte gap after the header: no padding.'), 'A boxed <code>Integer</code> is also 16 bytes. Its int fills the gap. That is 4× an <code>int</code> in an array, plus a 4-byte reference.');
      P(layout('Long', [['mark word', 8, 'hot'], ['klass', 4, 'ok'], ['gap', 4, 'dim'], ['long value', 8, '']], 24, 'A long must be 8-byte aligned, so it can’t use the gap at offset 12.'), 'A boxed <code>Long</code> is <b>24 bytes</b>. The long can’t sit at offset 12, so 4 bytes are wasted. A million ids in a <code>List&lt;Long&gt;</code> cost ~28 MB. A <code>long[]</code> costs 8 MB.');
      P(layout('int[3]', [['mark word', 8, 'hot'], ['klass', 4, 'ok'], ['length', 4, 'warn'], ['[0]', 4, ''], ['[1]', 4, ''], ['[2]', 4, ''], ['pad', 4, 'dim']], 32, 'Arrays add a 4-byte length to the header.'), 'Arrays have a 16-byte header (mark, class, <b>length</b>). Then come the elements, padded to a multiple of 8.');
      P(layout('HashMap.Node (compressed oops)', [['mark word', 8, 'hot'], ['klass', 4, 'ok'], ['hash', 4, ''], ['key', 4, 'warn'], ['value', 4, 'warn'], ['next', 4, 'warn'], ['pad', 4, 'dim']], 32, 'References (orange) are 4 bytes: a 32-bit offset scaled by 8.'), '<b>Compressed oops</b>: under ~32 GB of heap, a reference is a 32-bit offset times 8. That reaches 2³² × 8 = 32 GB. So references cost 4 bytes instead of 8.');
      P(layout('HashMap.Node with -Xmx32g or more', [['mark word', 8, 'hot'], ['klass', 4, 'ok'], ['hash', 4, ''], ['key', 8, 'err'], ['value', 8, 'err'], ['next', 8, 'err']], 40, 'At ≥ 32 GB, compressed oops turn off: every reference is 8 bytes.'), 'Pass ~32 GB and compressed oops turn off. This node grows from 32 to <b>40 bytes</b>. Heaps full of references grow 20–40%. A 31 GB heap can hold more than a 36 GB one. Java 25 offers 8-byte headers as a product option (-XX:+UseCompactObjectHeaders, off by default). In Java 21 the header is 12 bytes.');
    } else {
      code('ByteBuffer buf = ByteBuffer.allocateDirect(64 * 1024 * 1024);   // 64 MB off-heap\n// … use it for I/O, then drop the reference\nbuf = null;');
      N('heap', 20, 40, 330, 230, '', ''); N('native', 410, 40, 330, 230, '', '');
      S.notes = [{ x: 30, y: 62, t: 'Java heap', bold: true, c: 'var(--text)' }, { x: 420, y: 62, t: 'Native memory (outside -Xmx)', bold: true, c: 'var(--text)' }];
      P(() => { N('dbb', 40, 90, 170, 46, 'DirectByteBuffer', '~64 B object'); set('dbb', { state: 'hot' }); N('blk', 430, 90, 290, 90, 'malloc’d block', '64 MB'); set('blk', { state: 'hot' }); S.edges = [{ from: 'dbb', to: 'blk', state: 'hot' }]; S.stats = [['direct used', '64 MB of max ≈ Xmx']]; }, '<code>allocateDirect</code> reserves 64 MB against <code>MaxDirectMemorySize</code>, then allocates the block. The heap holds only a tiny <code>DirectByteBuffer</code> wrapper that points at it. NIO hands that memory to the OS without copying.');
      P(() => { set('dbb', { state: 'warn', y: 200, sub: 'promoted to old gen' }); }, 'The buffer lives long enough to be <b>promoted</b> to the old generation. Heap metrics never show its 64 MB.');
      P(() => { set('dbb', { state: 'dim', sub: 'unreachable' }); S.edges[0].state = 'warn'; set('blk', { state: 'warn', sub: '64 MB, still allocated' }); }, 'The code drops the reference. The native block is freed only when the GC <b>collects the wrapper</b>. An old-gen object may wait hours for that.');
      P(() => { N('blk2', 430, 190, 290, 60, 'more buffers…', 'limit reached'); set('blk2', { state: 'err' }); S.stats = [['direct used', 'at limit']]; }, 'New <code>allocateDirect</code> calls hit the limit. The JDK calls <code>System.gc()</code> and retries. So <code>-XX:+DisableExplicitGC</code> can turn this into a failure.');
      P(() => { S.notes.push({ x: 380, y: 300, t: 'OutOfMemoryError: Cannot reserve … bytes of direct buffer memory', anchor: 'middle', bold: true, size: 12, c: 'var(--err)' }); }, 'Still no room: <b>OutOfMemoryError: Cannot reserve … bytes of direct buffer memory</b>, with plenty of free heap. Fix: pool and reuse direct buffers (Netty does). Release them where you can. Cap them, and watch <code>jvm.buffer.memory.used</code>.');
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    S = { nodes: {}, edges: [], notes: [], stats: [] };
    steps = plan(); render(); bStep.disabled = false;
    say({ map: 'One JVM process in a 2 GiB container. Press Play to walk through where its memory goes.', stack: 'One thread runs <code>handle → price</code>. Press Play to watch frames come and go, and what they point at.', gen: 'Press Play to allocate objects and watch two young GCs and a promotion.', header: 'Press Play to see byte-by-byte layouts of common objects.', direct: 'Press Play to allocate a 64 MB direct buffer and follow its lifetime.' }[mode]);
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
