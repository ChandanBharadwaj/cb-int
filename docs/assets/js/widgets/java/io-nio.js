/* I/O & NIO: ByteBuffer position/limit/capacity through put/flip/get/compact/clear, thread-per-connection vs a Selector loop, and the copies made by read/write, mmap and transferTo. */
IA.widget('io-nio', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'buffer'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['buffer', 'ByteBuffer'], ['selector', 'blocking vs selector'], ['copy', 'copies: read/write, mmap, transferTo']], () => mode, (v) => { mode = v; reset(); }, 'View');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Diagram of a byte buffer, socket handling threads, or the copies between disk, kernel and JVM memory' });
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const code = (src) => { codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(src, 'java') })); };
  const R = (x, y, w, h, o = {}) => svg('rect', { x, y, width: w, height: h, rx: o.rx == null ? 7 : o.rx, fill: o.fill || 'var(--surface)', stroke: o.stroke || 'var(--border)', 'stroke-width': o.sw || 1, 'stroke-dasharray': o.dash || null });
  const T = (x, y, s, o = {}) => svg('text', { x, y, 'font-size': o.fs || 12, 'font-weight': o.fw || null, 'text-anchor': o.a || 'start', 'font-family': o.mono ? 'var(--mono)' : null, fill: o.fill || 'var(--text)', text: s });
  function arrow(x1, y1, x2, y2, col, w, dash) {
    const g = svg('g'); g.append(svg('line', { x1, y1, x2, y2, stroke: col, 'stroke-width': w || 2, 'stroke-dasharray': dash || null }));
    const a = Math.atan2(y2 - y1, x2 - x1), s = 9;
    g.append(svg('polygon', { points: `${x2},${y2} ${x2 - s * Math.cos(a - 0.45)},${y2 - s * Math.sin(a - 0.45)} ${x2 - s * Math.cos(a + 0.45)},${y2 - s * Math.sin(a + 0.45)}`, fill: col }));
    return g;
  }
  let S;

  /* ---------- ByteBuffer ---------- */
  const CAP = 8, BX = 124, CWD = 64, BY = 110;
  function renderBuffer() {
    stage.append(T(W / 2, 30, S.op || 'ByteBuffer.allocate(8)', { a: 'middle', mono: true, fs: 14, fw: 700, fill: 'var(--accent)' }));
    stage.append(T(W / 2, 52, S.mode === 'read' ? 'draining: you may read position … limit' : 'filling: you may write position … limit', { a: 'middle', fs: 12, fill: 'var(--text-2)' }));
    // readable/writable region
    const x0 = BX + S.pos * CWD, x1 = BX + S.lim * CWD;
    if (x1 > x0) stage.append(R(x0, BY - 10, x1 - x0, 68, { rx: 6, fill: S.mode === 'read' ? 'var(--accent-soft)' : 'none', stroke: S.mode === 'read' ? 'var(--accent)' : 'var(--ok)', dash: '5 4', sw: 1.5 }));
    for (let i = 0; i < CAP; i++) {
      const x = BX + i * CWD; const v = S.data[i]; const stale = S.stale.has(i);
      stage.append(R(x + 4, BY, CWD - 8, 48, { rx: 6, fill: v == null ? 'var(--surface-2)' : 'var(--surface)', stroke: S.hot === i ? 'var(--accent)' : 'var(--border)', sw: S.hot === i ? 2.5 : 1 }));
      stage.append(T(x + CWD / 2, BY + 30, v == null ? '·' : String(v), { a: 'middle', mono: true, fs: 16, fw: 700, fill: stale ? 'var(--text-3)' : 'var(--text)' }));
      stage.append(T(x + CWD / 2, BY + 66, String(i), { a: 'middle', fs: 10, fill: 'var(--text-3)' }));
    }
    const mark = (idx, lab, col, row) => {
      const x = BX + idx * CWD; const y = BY + 84 + row * 34;
      stage.append(svg('line', { x1: x, y1: BY - 14, x2: x, y2: y - 12, stroke: col, 'stroke-width': 2, 'stroke-dasharray': row ? '3 3' : null }));
      stage.append(svg('polygon', { points: `${x},${y - 14} ${x - 6},${y - 4} ${x + 6},${y - 4}`, fill: col }));
      stage.append(T(x, y + 10, lab, { a: 'middle', fs: 12, fw: 700, fill: col, mono: true }));
    };
    mark(S.pos, `position=${S.pos}`, 'var(--accent)', 0);
    mark(S.lim, `limit=${S.lim}`, 'var(--warn)', 1);
    if (S.lim !== CAP) mark(CAP, `capacity=${CAP}`, 'var(--text-3)', 2);
    else stage.append(T(BX + CAP * CWD, BY + 152, `(= capacity ${CAP})`, { a: 'middle', fs: 11, fill: 'var(--text-3)' }));
    if (S.out.length) stage.append(T(20, H - 12, 'read so far: ' + S.out.join(', '), { mono: true, fs: 12, fill: 'var(--text-2)' }));
  }
  /* ---------- Selector ---------- */
  function renderSel() {
    stage.append(T(190, 22, 'java.io: one thread per connection', { a: 'middle', fw: 700, fs: 13 }));
    stage.append(T(570, 22, 'NIO: one Selector thread', { a: 'middle', fw: 700, fs: 13 }));
    stage.append(svg('line', { x1: 380, y1: 34, x2: 380, y2: 300, stroke: 'var(--border)' }));
    S.conns.forEach((c, i) => {
      const y = 44 + i * 58;
      // left: socket + its own thread
      stage.append(R(16, y, 96, 44, { fill: c.data ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: c.data ? 'var(--accent)' : 'var(--border)' }));
      stage.append(T(64, y + 18, 'socket ' + (i + 1), { a: 'middle', fs: 11.5, fw: 600 }));
      stage.append(T(64, y + 34, c.data ? 'data!' : 'idle', { a: 'middle', fs: 10.5, fill: c.data ? 'var(--accent)' : 'var(--text-3)' }));
      const st = c.lt; const col = st === 'running' ? 'var(--accent)' : st === 'stuck' ? 'var(--err)' : 'var(--text-3)';
      stage.append(arrow(112, y + 22, 150, y + 22, 'var(--border)', 1.5));
      stage.append(R(154, y, 210, 44, { fill: st === 'running' ? 'var(--accent-soft)' : 'var(--surface)', stroke: col, sw: st === 'running' ? 2 : 1 }));
      stage.append(T(164, y + 18, `thread-${i + 1}  (1 MB stack reserved)`, { fs: 11, mono: true }));
      stage.append(T(164, y + 34, st === 'running' ? 'running: read() returned' : st === 'stuck' ? 'slow handler (only this conn)' : 'BLOCKED in read() … waiting', { fs: 10.5, fill: col }));
      // right: channel registered
      stage.append(R(396, y, 120, 44, { fill: c.ready ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: c.ready ? 'var(--accent)' : 'var(--border)', sw: c.ready ? 2 : 1 }));
      stage.append(T(456, y + 18, `channel ${i + 1}`, { a: 'middle', fs: 11.5, fw: 600 }));
      stage.append(T(456, y + 34, c.ready ? 'OP_READ ready' : 'interest: OP_READ', { a: 'middle', fs: 10.5, mono: true, fill: c.ready ? 'var(--accent)' : 'var(--text-3)' }));
      stage.append(arrow(516, y + 22, 588, 150, c.ready ? 'var(--accent)' : 'var(--border)', c.ready ? 2 : 1));
    });
    const st = S.selState; const col = st === 'blocked-bad' ? 'var(--err)' : st === 'select' ? 'var(--text-3)' : 'var(--accent)';
    stage.append(R(592, 104, 152, 92, { fill: st === 'select' ? 'var(--surface)' : 'var(--accent-soft)', stroke: col, sw: 2 }));
    stage.append(T(668, 126, 'selector thread', { a: 'middle', fs: 12, fw: 700 }));
    stage.append(T(668, 146, S.selLine1 || 'select()  (sleeping)', { a: 'middle', fs: 10.5, mono: true, fill: col }));
    stage.append(T(668, 164, S.selLine2 || '', { a: 'middle', fs: 10.5, mono: true, fill: col }));
    stage.append(T(668, 182, S.selLine3 || '', { a: 'middle', fs: 10.5, mono: true, fill: 'var(--text-3)' }));
    if (S.banner) stage.append(T(W / 2, H - 8, S.banner, { a: 'middle', fs: 12.5, fw: 700, fill: S.bannerC || 'var(--text)' }));
  }
  /* ---------- copies ---------- */
  const BOX = { disk: [20, 230, 'disk / SSD'], cache: [210, 230, 'page cache (kernel RAM)'], user: [210, 60, 'JVM buffer (user space)'], sock: [470, 230, 'socket buffer (kernel)'], nic: [620, 230, 'NIC'] };
  function renderCopy() {
    stage.append(svg('line', { x1: 16, y1: 165, x2: W - 16, y2: 165, stroke: 'var(--border)', 'stroke-dasharray': '6 4' }));
    stage.append(T(20, 158, 'user space (the JVM)', { fs: 11, fill: 'var(--text-3)' }));
    stage.append(T(20, 182, 'kernel space', { fs: 11, fill: 'var(--text-3)' }));
    stage.append(T(W - 16, 22, S.title || '', { a: 'end', fs: 13, fw: 700, fill: 'var(--accent)' }));
    Object.entries(BOX).forEach(([id, [x, y, lab]]) => {
      const w = id === 'nic' ? 120 : id === 'disk' ? 150 : 220;
      const hot = S.hotBox && S.hotBox.includes(id); const dim = S.dimBox && S.dimBox.includes(id);
      stage.append(R(x, y, w, 56, { fill: hot ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: hot ? 'var(--accent)' : 'var(--border)', sw: hot ? 2 : 1, dash: dim ? '5 4' : null }));
      stage.append(T(x + w / 2, y + 24, lab, { a: 'middle', fs: 12, fw: 600, fill: dim ? 'var(--text-3)' : 'var(--text)' }));
      if (id === 'user' && S.mapped) stage.append(T(x + w / 2, y + 42, 'mapped view of page-cache pages', { a: 'middle', fs: 10.5, fill: 'var(--accent)' }));
      if (id === 'cache' && S.pages) stage.append(T(x + w / 2, y + 42, S.pages, { a: 'middle', fs: 10.5, mono: true, fill: 'var(--text-2)' }));
    });
    (S.flows || []).forEach(([a, b, lab, kind]) => {
      const [ax, ay] = BOX[a], [bx, by] = BOX[b];
      const aw = a === 'nic' ? 120 : a === 'disk' ? 150 : 220, bw = b === 'nic' ? 120 : b === 'disk' ? 150 : 220;
      let x1, y1, x2, y2;
      if (ay === by) { x1 = ax + aw; y1 = ay + 28; x2 = bx; y2 = by + 28; } else { x1 = ax + aw / 2 + (ay > by ? -40 : 40); y1 = ay > by ? ay : ay + 56; x2 = bx + bw / 2 + (ay > by ? -40 : 40); y2 = ay > by ? by + 56 : by; }
      if (a === 'user' && b === 'sock') { x1 = ax + aw; y1 = ay + 40; x2 = bx + 40; y2 = by; }
      const col = kind === 'cpu' ? 'var(--err)' : kind === 'map' ? 'var(--accent)' : 'var(--ok)';
      stage.append(arrow(x1, y1, x2, y2, col, 2.5, kind === 'map' ? '6 4' : null));
      stage.append(T((x1 + x2) / 2 + 6, (y1 + y2) / 2 - 6, lab, { fs: 10.5, fw: 700, fill: col }));
    });
    stage.append(T(20, H - 10, 'green = DMA (no CPU copy) · red = CPU copy · blue dashed = memory mapping', { fs: 10.5, fill: 'var(--text-3)' }));
  }
  function render() {
    stage.innerHTML = '';
    if (mode === 'buffer') renderBuffer(); else if (mode === 'selector') renderSel(); else renderCopy();
    statLine();
  }
  function statLine() {
    stats.innerHTML = ''; const add = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    if (mode === 'buffer') { add(`position <b>${S.pos}</b>`); add(`limit <b>${S.lim}</b>`); add(`remaining <b>${S.lim - S.pos}</b>`); add(`capacity <b>${CAP}</b>`); }
    else if (mode === 'selector') { add(`OS threads (left) <b>${S.conns.length}</b>`); add(`OS threads (right) <b>1</b>`); add(`events handled <b>${S.handled}</b>`); }
    else { add(`CPU copies <b>${S.cpu}</b>`); add(`DMA transfers <b>${S.dma}</b>`); add(`syscalls <b>${S.sys}</b>`); }
  }
  const P = (st, run, t) => st.push({ run, t });
  function plan() {
    const st = [];
    if (mode === 'buffer') {
      code('ByteBuffer b = ByteBuffer.allocate(8);\nb.put((byte) 7).put((byte) 8).put((byte) 9);   // fill\nb.flip();                                        // switch to draining\nb.get();                                         // read one\nb.compact();                                     // keep the unread, refill\nb.put((byte) 4);  b.flip();  …  b.clear();');
      const put = (v) => () => { S.data[S.pos] = v; S.stale.delete(S.pos); S.hot = S.pos; S.pos++; S.op = `put((byte) ${v})`; S.mode = 'write'; };
      P(st, put(7), '<code>put(7)</code> writes at <b>position</b> 0 and advances it. In fill mode, the writable region is position … limit (green).');
      P(st, put(8), '<code>put(8)</code>: position 2.');
      P(st, put(9), '<code>put(9)</code>: position 3. If you handed this buffer to <code>channel.write()</code> now, it would write slots 3–7: five meaningless bytes.');
      P(st, () => { S.lim = S.pos; S.pos = 0; S.op = 'flip()'; S.mode = 'read'; S.hot = null; }, '<code>flip()</code>: <b>limit = position (3), position = 0</b>. Now the readable region (blue) is exactly the three bytes you wrote.');
      P(st, () => { S.out.push(S.data[S.pos]); S.hot = S.pos; S.pos++; S.op = 'get() → 7'; }, '<code>get()</code> returns 7 and advances position to 1. Two bytes remain.');
      P(st, () => { const rem = S.data.slice(S.pos, S.lim); for (let i = 0; i < CAP; i++) { if (i < rem.length) { S.data[i] = rem[i]; S.stale.delete(i); } else if (S.data[i] != null) S.stale.add(i); } S.pos = rem.length; S.lim = CAP; S.op = 'compact()'; S.mode = 'write'; S.hot = null; }, '<code>compact()</code> copies the unread bytes (8, 9) to the front, sets <b>position = 2</b> and <b>limit = capacity</b>. Typical for network reads: a partial message stays, and the next read appends to it. The old 9 in slot 2 is now garbage (grey): buffers never erase.');
      P(st, put(4), '<code>put(4)</code> appends after the kept bytes.');
      P(st, () => { S.lim = S.pos; S.pos = 0; S.op = 'flip()'; S.mode = 'read'; S.hot = null; }, '<code>flip()</code> again: readable 8, 9, 4.');
      P(st, () => { S.pos = 0; S.lim = CAP; S.op = 'clear()'; S.mode = 'write'; for (let i = 0; i < CAP; i++) if (S.data[i] != null) S.stale.add(i); }, '<code>clear()</code>: <b>position = 0, limit = capacity</b>. The bytes are still there (grey) but will be overwritten. Use <code>clear</code> when everything was consumed, <code>compact</code> when some wasn’t, and <code>rewind</code> (position = 0, limit unchanged) to read the same data again.');
    } else if (mode === 'selector') {
      code('// left: classic blocking server\nwhile (true) { Socket s = server.accept(); new Thread(() -> serve(s)).start(); }\n\n// right: NIO\nwhile (true) { selector.select(); for (key : selectedKeys) { handle(key); remove(key); } }');
      P(st, () => { S.conns.forEach((c) => { c.lt = 'blocked'; }); S.selLine1 = 'select()  (sleeping)'; }, 'Four clients connect. Left: four threads, each <b>blocked in read()</b>, each holding an OS thread and a reserved stack while doing nothing. Right: four non-blocking channels registered with <b>one</b> selector, whose thread sleeps in <code>select()</code> (epoll_wait on Linux).');
      P(st, () => { S.conns[1].data = true; S.conns[1].ready = true; S.conns[1].lt = 'running'; S.selState = 'run'; S.selLine1 = 'select() → 1 ready'; S.selLine2 = 'read(ch2), handle'; S.selLine3 = 'selectedKeys.remove()'; S.handled++; }, 'Data arrives on connection 2. Left: thread-2’s <code>read()</code> returns and it handles the request. Right: <code>select()</code> returns 1; the loop reads channel 2 (whatever bytes are available, maybe a partial message), handles it, and <b>removes</b> the key from the selected set.');
      P(st, () => { S.conns[1].data = false; S.conns[1].ready = false; S.conns[1].lt = 'blocked'; S.conns[0].data = true; S.conns[0].ready = true; S.conns[3].data = true; S.conns[3].ready = true; S.conns[0].lt = 'running'; S.conns[3].lt = 'running'; S.selLine1 = 'select() → 2 ready'; S.selLine2 = 'handle ch1, then ch4'; S.handled += 2; }, 'Data on 1 and 4 at once. Left: two threads wake in parallel. Right: <code>select()</code> reports both; the one thread handles them <b>one after another</b>. Fine, as long as each handler is quick.');
      P(st, () => { S.conns.forEach((c) => { c.data = false; c.ready = false; c.lt = 'blocked'; }); S.conns[2].data = true; S.conns[2].ready = true; S.conns[2].lt = 'stuck'; S.conns[0].data = true; S.conns[0].ready = true; S.selState = 'blocked-bad'; S.selLine1 = 'handle ch3 → JDBC call…'; S.selLine2 = 'BLOCKED 800 ms'; S.selLine3 = 'ch1 ready, nobody reads it'; S.banner = 'never block the event loop'; S.bannerC = 'var(--err)'; }, 'Now a handler on the selector thread makes a <b>blocking</b> database call. Right: while it waits, channel 1 is ready but nobody reads it; every connection on this loop stalls. Left: only connection 3 is slow. This is the Netty / WebFlux rule: no blocking calls on event-loop threads.');
      P(st, () => { S.conns.forEach((c) => { c.data = false; c.ready = false; c.lt = 'blocked'; }); S.selState = 'select'; S.selLine1 = 'select()  (sleeping)'; S.selLine2 = ''; S.selLine3 = ''; S.banner = 'Java 21: blocking code on virtual threads ≈ selector cost'; S.bannerC = 'var(--ok)'; }, 'Scale it to 20,000 mostly idle connections: the left model needs 20,000 platform threads; the right needs one thread per core and some buffers. Java 21 offers a third option: the left-hand code on <b>virtual threads</b>, where a blocked <code>read()</code> parks on the JDK’s internal poller instead of holding an OS thread.');
    } else {
      code('// 1) read + write: in.read(buf); socket.write(buf);\n// 2) memory-mapped: MappedByteBuffer m = ch.map(READ_ONLY, 0, size);\n// 3) zero-copy:     fileChannel.transferTo(0, size, socketChannel);   // sendfile on Linux');
      P(st, () => { S.title = '1) read() + write()'; S.flows = [['disk', 'cache', 'DMA', 'dma']]; S.hotBox = ['disk', 'cache']; S.dma = 1; S.sys = 1; S.pages = 'file pages cached'; }, '<code>read()</code> syscall: if the pages aren’t cached, the disk controller <b>DMAs</b> them into the page cache (no CPU copying).');
      P(st, () => { S.flows.push(['cache', 'user', 'copy #1', 'cpu']); S.hotBox = ['cache', 'user']; S.cpu = 1; }, 'The kernel then <b>copies</b> the bytes from the page cache into your buffer (CPU copy #1). For a heap <code>ByteBuffer</code> the JDK reads into a temporary direct buffer first and copies again into the heap.');
      P(st, () => { S.flows.push(['user', 'sock', 'copy #2', 'cpu']); S.hotBox = ['user', 'sock']; S.cpu = 2; S.sys = 2; }, '<code>write()</code> syscall: the kernel copies your buffer into the socket buffer (CPU copy #2).');
      P(st, () => { S.flows.push(['sock', 'nic', 'DMA', 'dma']); S.hotBox = ['sock', 'nic']; S.dma = 2; }, 'The NIC DMAs it out. Total: <b>2 CPU copies</b>, 2 syscalls per chunk, and the data crossed into user space and back for no reason.');
      P(st, () => { S.title = '2) memory-mapped file'; S.flows = [['disk', 'cache', 'page fault → DMA', 'dma'], ['cache', 'user', 'mapped', 'map']]; S.mapped = true; S.hotBox = ['cache', 'user']; S.cpu = 0; S.dma = 1; S.sys = 0; S.dimBox = ['sock', 'nic']; S.pages = 'pages loaded on first touch'; }, '<code>FileChannel.map</code>: your buffer <i>is</i> the page cache, mapped into the JVM’s address space. Touching a page that isn’t loaded triggers a page fault; the kernel DMAs it in. Reading it costs <b>no copy and no syscall</b>. Great for random access to big files (indexes, databases); writes dirty pages that the OS writes back later, or on <code>force()</code>.');
      P(st, () => { S.title = '3) FileChannel.transferTo (sendfile)'; S.mapped = false; S.flows = [['disk', 'cache', 'DMA', 'dma'], ['cache', 'sock', 'in-kernel', 'dma'], ['sock', 'nic', 'DMA', 'dma']]; S.hotBox = ['cache', 'sock', 'nic']; S.dimBox = ['user']; S.cpu = 0; S.dma = 3; S.sys = 1; S.pages = 'file pages cached'; }, '<code>transferTo</code> to a socket: on Linux the JDK can use <code>sendfile</code>, so data goes from the page cache to the socket <b>inside the kernel</b>; the JVM never touches the bytes (with scatter-gather NICs, not even that copy). One syscall per chunk, <b>0 CPU copies</b> into user space. Kafka serves consumers this way. TLS breaks it, because encryption happens in user space.');
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    S = { pos: 0, lim: CAP, data: Array(CAP).fill(null), stale: new Set(), op: null, mode: 'write', hot: null, out: [],
      conns: [0, 1, 2, 3].map(() => ({ data: false, ready: false, lt: 'none' })), selState: 'select', selLine1: '', handled: 0, banner: null,
      flows: [], cpu: 0, dma: 0, sys: 0, title: '', hotBox: [], dimBox: [], mapped: false, pages: '' };
    steps = plan(); render(); bStep.disabled = false;
    say({ buffer: 'An 8-byte buffer. Watch position (P), limit (L) and capacity as you fill, flip, read and compact. Press Play or Step.', selector: 'Four connections, served two ways.', copy: 'Sending a file to a socket three ways. Count the copies.' }[mode]);
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
