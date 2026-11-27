/* Java Memory Model: two threads with store buffers over shared memory. Litmus tests (store buffering, message passing, loop hoisting, DCL) with plain vs volatile, and happens-before edges. */
IA.widget('java-memory-model', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'mp'; let vol = false; let gen = 0; let running = false; let speed = 2600; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['mp', 'message passing'], ['sb', 'store buffering (Dekker)'], ['hoist', 'stop flag'], ['dcl', 'double-checked locking']], () => mode, (v) => { mode = v; reset(); }, 'Litmus test');
  const segV = seg([[false, 'plain fields'], [true, 'volatile']], () => vol, (v) => { vol = v; reset(); }, 'Field kind');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 370, CX = [20, 430], CW = 310, LY = 62, LH = 22, SBY = 210, MY = 286;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Two threads, each with code and a store buffer, above shared memory' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-controls' }, segV), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const R = (x, y, w, h, o = {}) => svg('rect', { x, y, width: w, height: h, rx: o.rx == null ? 6 : o.rx, fill: o.fill || 'var(--surface)', stroke: o.stroke || 'var(--border)', 'stroke-width': o.sw || 1, 'stroke-dasharray': o.dash || null });
  const T = (x, y, s, o = {}) => svg('text', { x, y, 'font-size': o.fs || 12, 'font-weight': o.fw || null, 'text-anchor': o.a || 'start', 'font-family': o.mono ? 'var(--mono)' : null, fill: o.fill || 'var(--text)', text: s });
  function arrow(x1, y1, x2, y2, col, bend, w) {
    const mx = (x1 + x2) / 2 + (bend || 0), my = (y1 + y2) / 2 - Math.abs(bend || 0) * 0.3;
    const g = svg('g');
    g.append(svg('path', { d: `M${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`, fill: 'none', stroke: col, 'stroke-width': w || 2 }));
    const a = Math.atan2(y2 - my, x2 - mx), s = 8;
    g.append(svg('polygon', { points: `${x2},${y2} ${x2 - s * Math.cos(a - 0.45)},${y2 - s * Math.sin(a - 0.45)} ${x2 - s * Math.cos(a + 0.45)},${y2 - s * Math.sin(a + 0.45)}`, fill: col }));
    return g;
  }

  let S;
  const TESTS = {
    mp: { vars: ['data', 'ready'], t1: ['data = 42;', 'ready = true;'], t2: ['if (ready)', '    r = data;'], decl: () => `int data;  ${vol ? 'volatile ' : ''}boolean ready;` },
    sb: { vars: ['x', 'y'], t1: ['x = 1;', 'r1 = y;'], t2: ['y = 1;', 'r2 = x;'], decl: () => `${vol ? 'volatile ' : ''}int x, y;   // both 0` },
    hoist: { vars: ['stop'], t1: ['while (!stop)', '    i++;', '// after the loop'], t2: ['Thread.sleep(1000);', 'stop = true;'], decl: () => `${vol ? 'volatile ' : ''}boolean stop;` },
    dcl: { vars: ['inst', 'obj.size'], t1: ['if (inst == null)', '  synchronized (L) {', '    inst = new Helper();', '  }'], t2: ['Helper h = inst;', 'if (h != null)', '    r = h.size;'], decl: () => `${vol ? 'static volatile' : 'static'} Helper inst;   // Helper() sets size = 64` }
  };
  function render() {
    stage.innerHTML = '';
    const tst = TESTS[mode];
    stage.append(T(W / 2, 20, tst.decl(), { a: 'middle', mono: true, fs: 12.5, fill: 'var(--text-2)' }));
    [0, 1].forEach((t) => {
      const x = CX[t]; const lines = t ? tst.t2 : tst.t1; const pc = S.pc[t];
      stage.append(T(x, 44, t ? 'Thread 2' : 'Thread 1', { fw: 700, fs: 13 }));
      stage.append(R(x, 50, CW, 4 * LH + 14, { fill: 'var(--surface-2)' }));
      lines.forEach((ln, i) => {
        const y = LY + i * LH;
        if (pc === i) stage.append(R(x + 4, y - 4, CW - 8, LH - 2, { rx: 4, fill: 'var(--accent-soft)', stroke: 'var(--accent)' }));
        stage.append(T(x + 12, y + 11, ln, { mono: true, fs: 12.5, fill: S.done[t] && S.done[t].has(i) ? 'var(--text-3)' : 'var(--text)' }));
      });
      // registers
      const regs = S.regs[t]; const rk = Object.keys(regs);
      stage.append(T(x, 172, 'registers', { fs: 11, fill: 'var(--text-3)' }));
      rk.forEach((r, i) => stage.append(T(x + 70 + i * 110, 172, `${r} = ${regs[r]}`, { mono: true, fs: 13, fw: 700, fill: S.bad === r ? 'var(--err)' : 'var(--text)' })));
      // store buffer
      stage.append(T(x, SBY - 8, 'store buffer (this core only)', { fs: 11, fill: 'var(--text-3)' }));
      stage.append(R(x, SBY, CW, 38, { fill: 'none', dash: '4 3', stroke: S.sb[t].length ? 'var(--warn)' : 'var(--border)' }));
      S.sb[t].forEach(([v, val], i) => {
        const bx = x + 8 + i * 100;
        stage.append(R(bx, SBY + 7, 92, 24, { rx: 5, fill: 'var(--surface)', stroke: 'var(--warn)', sw: 1.5 }));
        stage.append(T(bx + 46, SBY + 23, `${v}=${val}`, { a: 'middle', mono: true, fs: 12 }));
      });
      if (S.fence && S.fence[t]) stage.append(T(x + CW - 6, SBY + 24, S.fence[t], { a: 'end', fs: 11, fw: 700, fill: 'var(--accent)' }));
    });
    // memory
    stage.append(T(20, MY - 8, 'shared memory (coherent caches)', { fs: 11, fill: 'var(--text-3)' }));
    stage.append(R(20, MY, W - 40, 64, { fill: 'var(--surface-2)' }));
    const vars = tst.vars; const vw = 150; const x0 = W / 2 - (vars.length * (vw + 20) - 20) / 2;
    S.memPos = {};
    vars.forEach((v, i) => {
      const x = x0 + i * (vw + 20); const hot = S.hotMem === v;
      S.memPos[v] = x + vw / 2;
      stage.append(R(x, MY + 14, vw, 36, { rx: 7, fill: hot ? 'var(--accent-soft)' : 'var(--surface)', stroke: hot ? 'var(--accent)' : 'var(--border)', sw: hot ? 2 : 1 }));
      stage.append(T(x + vw / 2, MY + 37, `${v} = ${S.mem[v]}`, { a: 'middle', mono: true, fs: 13, fw: 600 }));
    });
    // flows
    (S.flows || []).forEach((f) => {
      const col = f.k === 'read' ? 'var(--accent)' : f.k === 'drain' ? 'var(--warn)' : 'var(--ok)';
      if (f.k === 'drain') stage.append(arrow(CX[f.t] + CW / 2, SBY + 38, S.memPos[f.v], MY + 14, col, 0, 2));
      if (f.k === 'read') stage.append(arrow(S.memPos[f.v], MY + 14, CX[f.t] + CW / 2, 180, col, f.t ? 40 : -40, 2));
    });
    // happens-before edges
    (S.hb || []).forEach(([i, j]) => {
      const y1 = LY + i * LH + 7, y2 = LY + j * LH + 7;
      stage.append(arrow(CX[0] + CW - 6, y1, CX[1] + 6, y2, 'var(--ok)', 0, 2.5));
      stage.append(T((CX[0] + CW + CX[1]) / 2, Math.min(y1, y2) - 6, 'happens-before', { a: 'middle', fs: 10.5, fw: 700, fill: 'var(--ok)' }));
    });
    (S.hbR || []).forEach(([i, j]) => {
      const y1 = LY + i * LH + 7, y2 = LY + j * LH + 7;
      stage.append(arrow(CX[1] + 6, y1, CX[0] + CW - 6, y2, 'var(--ok)', 0, 2.5));
      stage.append(T((CX[0] + CW + CX[1]) / 2, Math.min(y1, y2) - 6, 'happens-before', { a: 'middle', fs: 10.5, fw: 700, fill: 'var(--ok)' }));
    });
    if (S.banner) stage.append(T(W - 20, H - 4, S.banner, { a: 'end', fs: 12.5, fw: 700, fill: S.bannerC || 'var(--text)' }));
  }
  function statLine() {
    stats.innerHTML = '';
    const add = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    add(`fields <b>${vol ? 'volatile' : 'plain'}</b>`);
    add(`buffered writes <b>${S.sb[0].length + S.sb[1].length}</b>`);
    add(`happens-before edges <b>${(S.hb || []).length + (S.hbR || []).length}</b>`);
    if (S.outcome) add(`outcome <b>${S.outcome}</b>`);
  }
  // primitive actions
  const mark = (t, i) => { S.done[t].add(i); };
  const write = (t, i, v, val) => { S.pc[t] = i; mark(t, i); S.sb[t].push([v, val]); S.flows = []; S.hotMem = null; };
  const drain = (t, v) => { const j = S.sb[t].findIndex((e) => e[0] === v); const [, val] = S.sb[t][j]; S.sb[t].splice(j, 1); S.mem[v] = val; S.hotMem = v; S.flows = [{ k: 'drain', t, v }]; };
  const drainAll = (t) => { const fl = []; while (S.sb[t].length) { const [v, val] = S.sb[t].shift(); S.mem[v] = val; S.hotMem = v; fl.push({ k: 'drain', t, v }); } S.flows = fl; };
  const read = (t, i, v, reg) => { S.pc[t] = i; mark(t, i); const own = S.sb[t].find((e) => e[0] === v); const val = own ? own[1] : S.mem[v]; if (reg) S.regs[t][reg] = val; S.hotMem = v; S.flows = own ? [] : [{ k: 'read', t, v }]; return val; };

  function plan() {
    const st = []; const P = (run, t) => st.push({ run, t });
    if (mode === 'mp') {
      if (!vol) {
        P(() => write(0, 0, 'data', 42), 'T1: <code>data = 42</code>. The store goes into T1’s <b>store buffer</b>. Other cores can’t see it yet.');
        P(() => write(0, 1, 'ready', 'true'), 'T1: <code>ready = true</code>. Also buffered. Nothing orders these two plain stores for other threads.');
        P(() => drain(0, 'ready'), '<code>ready</code> reaches memory <b>first</b>. The JIT may swap the two stores, and so may a loosely ordered CPU like ARM. (x86 keeps stores in order, so there the JIT is the usual culprit.)');
        P(() => { read(1, 0, 'ready', 'ready'); }, 'T2 reads <code>ready</code> from memory: <b>true</b>.');
        P(() => { read(1, 1, 'data', 'r'); S.bad = 'r'; S.outcome = 'ready=true, r=0'; S.banner = 'saw the flag, missed the data'; S.bannerC = 'var(--err)'; }, 'T2 reads <code>data</code>: still <b>0</b> in memory. T2 saw the flag but not the data it was meant to carry. This is a data race, and the JMM allows it.');
        P(() => { drainAll(0); }, 'T1’s buffer drains later, too late for T2. Fix: make <code>ready</code> <code>volatile</code> (try the toggle).');
      } else {
        P(() => write(0, 0, 'data', 42), 'T1: <code>data = 42</code> (a plain store) goes into the store buffer.');
        P(() => { write(0, 1, 'ready', 'true'); S.fence = ['release', null]; }, 'T1: <code>ready = true</code> is a <b>volatile write</b>. No earlier write may become visible after it.');
        P(() => { drainAll(0); S.fence = [null, null]; }, 'So the buffer drains <b>in order</b>: <code>data</code>, then <code>ready</code>.');
        P(() => { read(1, 0, 'ready', 'ready'); S.hb = [[1, 0]]; }, 'T2’s <b>volatile read</b> sees <code>true</code>. A volatile write is linked to every later read that sees it: a <b>happens-before</b> link.');
        P(() => { read(1, 1, 'data', 'r'); S.outcome = 'ready=true, r=42'; S.banner = 'guaranteed: r = 42'; S.bannerC = 'var(--ok)'; }, '<code>data = 42</code> comes before the volatile write in T1. <code>r = data</code> comes after the volatile read in T2. Chain those together, and T2 <b>must</b> see 42. That chain is what “safe publication” means.');
      }
    } else if (mode === 'sb') {
      if (!vol) {
        P(() => write(0, 0, 'x', 1), 'T1: <code>x = 1</code> waits in T1’s store buffer.');
        P(() => write(1, 0, 'y', 1), 'T2: <code>y = 1</code> waits in T2’s store buffer.');
        P(() => { read(0, 1, 'y', 'r1'); }, 'T1: <code>r1 = y</code>. Its own buffer has no <code>y</code>, so it reads memory: <b>0</b>. The load ran <i>before</i> T1’s own earlier store became visible.');
        P(() => { read(1, 1, 'x', 'r2'); S.outcome = 'r1=0, r2=0'; S.bad = 'r2'; }, 'T2: <code>r2 = x</code> reads memory: <b>0</b>.');
        P(() => { drainAll(0); S.flows.push({ k: 'drain', t: 1, v: 'y' }); while (S.sb[1].length) { const [v, val] = S.sb[1].shift(); S.mem[v] = val; } S.banner = '(0, 0): impossible in any interleaving, yet allowed'; S.bannerC = 'var(--err)'; }, 'Both buffers drain. Result: <b>r1 = 0, r2 = 0</b>. No ordering of the four lines gives that. But a load passing an earlier store does, <b>even on x86</b>. Classic lock-free mutual-exclusion algorithms break right here.');
      } else {
        P(() => { write(0, 0, 'x', 1); S.fence = ['StoreLoad fence', null]; }, 'T1: volatile <code>x = 1</code>. On x86, HotSpot puts a full fence after a volatile store (often <code>lock addl</code>).');
        P(() => { drainAll(0); S.fence = [null, null]; }, 'The fence empties T1’s buffer before any later load runs. <code>x = 1</code> is now visible.');
        P(() => { write(1, 0, 'y', 1); S.fence = [null, 'StoreLoad fence']; }, 'T2: volatile <code>y = 1</code>, then its fence.');
        P(() => { drainAll(1); S.fence = [null, null]; }, 'T2’s buffer drains: <code>y = 1</code> visible.');
        P(() => { read(0, 1, 'y', 'r1'); S.hb = [[0, 1]]; }, 'T1 reads <code>y</code>: 1. (This run’s interleaving lets both see 1.)');
        P(() => { read(1, 1, 'x', 'r2'); S.outcome = 'r1=1, r2=1'; S.banner = '(0, 0) can no longer happen'; S.bannerC = 'var(--ok)'; }, 'All volatile accesses fall into <b>one total order</b> that respects each thread’s order. Whichever store comes first, the other thread’s later load sees it. So at least one of r1, r2 is 1.');
      }
    } else if (mode === 'hoist') {
      S.regs[0].i = 0;
      if (!vol) {
        P(() => { S.pc[0] = 0; read(0, 0, 'stop', 'stop'); S.regs[0].i = '…'; }, 'T1 enters the loop and reads <code>stop</code>: false.');
        P(() => { S.pc[0] = 1; S.regs[0].i = '10⁷'; S.banner = 'C2: if (!stop) while (true) i++;'; S.bannerC = 'var(--warn)'; S.flows = []; S.hotMem = null; }, 'The loop gets hot and C2 compiles it. Nothing in it synchronizes, and <code>stop</code> is plain. So C2 may <b>move the read out</b>: check once, then spin forever. That’s legal, because no rule forces a re-read.');
        P(() => { S.pc[1] = 0; mark(1, 0); }, 'T2 sleeps for a second.');
        P(() => { write(1, 1, 'stop', 'true'); }, 'T2: <code>stop = true</code>.');
        P(() => { drainAll(1); }, 'The write reaches memory. Caches stay in sync, so any core that <i>reads</i> <code>stop</code> now gets true.');
        P(() => { S.pc[0] = 1; S.regs[0].i = '10⁹…'; S.flows = []; S.hotMem = null; S.outcome = 'never stops'; S.banner = 'T1 never reads stop again: hangs'; S.bannerC = 'var(--err)'; }, 'But T1 <b>never reads it again</b>. The problem isn’t a stale cache. The compiler removed the read. A <code>println</code> in the loop often “fixes” it by accident. That’s why this bug survives code review.');
      } else {
        P(() => { S.pc[0] = 0; read(0, 0, 'stop', 'stop'); S.regs[0].i = '…'; }, 'T1 reads volatile <code>stop</code>: false.');
        P(() => { S.pc[0] = 1; S.regs[0].i = '10⁷'; S.flows = []; S.hotMem = null; S.banner = 'C2 must re-read stop each iteration'; S.bannerC = 'var(--ok)'; }, 'C2 compiles the loop but can’t move a volatile read out. Each loop run reads <code>stop</code> again.');
        P(() => { S.pc[1] = 1; mark(1, 0); write(1, 1, 'stop', 'true'); }, 'T2: volatile <code>stop = true</code>.');
        P(() => { drainAll(1); }, 'It becomes visible.');
        P(() => { read(0, 0, 'stop', 'stop'); S.hbR = [[1, 0]]; }, 'T1’s next read sees <b>true</b>. The volatile write is linked to this read.');
        P(() => { S.pc[0] = 2; mark(0, 0); mark(0, 1); S.flows = []; S.outcome = 'stops'; S.banner = 'loop exits'; S.bannerC = 'var(--ok)'; }, 'The loop exits. <code>AtomicBoolean</code> or checking <code>Thread.currentThread().isInterrupted()</code> work too.');
      }
    } else {
      S.mem.inst = 'null'; S.mem['obj.size'] = '—';
      if (!vol) {
        P(() => { read(0, 0, 'inst', null); }, 'T1: first check, <code>inst == null</code>: true.');
        P(() => { S.pc[0] = 1; mark(0, 1); S.flows = []; S.hotMem = null; }, 'T1 takes the lock and checks again: still null.');
        P(() => { S.pc[0] = 2; S.mem['obj.size'] = 0; S.hotMem = 'obj.size'; S.flows = []; }, '<code>new Helper()</code> step 1: <b>allocate</b>. The new object’s fields hold defaults: <code>size = 0</code>.');
        P(() => { write(0, 2, 'obj.size', 64); write(0, 2, 'inst', '@obj'); }, 'Step 2 is the constructor’s <code>size = 64</code>. Step 3 is <code>inst = @obj</code>. Both are plain stores in the buffer, and nothing orders them for other threads.');
        P(() => { drain(0, 'inst'); }, 'The reference store becomes visible <b>first</b>.');
        P(() => { read(1, 0, 'inst', 'h'); }, 'T2: <code>h = inst</code> sees <code>@obj</code>, non-null. T2 never takes the lock, so nothing links it to T1.');
        P(() => { read(1, 2, 'obj.size', 'r'); S.pc[1] = 2; mark(1, 1); S.bad = 'r'; S.outcome = 'r = 0'; S.banner = 'a half-constructed Helper'; S.bannerC = 'var(--err)'; }, 'T2 reads <code>h.size</code>: <b>0</b>. To T2, the constructor “hasn’t run”. Toggle <b>volatile</b> to fix it, or make <code>size</code> <code>final</code>.');
        P(() => { drainAll(0); S.pc[0] = 3; mark(0, 3); }, 'T1’s constructor write lands later, and T1 unlocks. Too late for T2.');
      } else {
        P(() => { read(0, 0, 'inst', null); }, 'T1: first check (a volatile read): null.');
        P(() => { S.pc[0] = 1; mark(0, 1); S.flows = []; S.hotMem = null; }, 'T1 locks and checks again: still null.');
        P(() => { S.pc[0] = 2; S.mem['obj.size'] = 0; S.hotMem = 'obj.size'; S.flows = []; }, 'Allocate: <code>size = 0</code> (default).');
        P(() => { write(0, 2, 'obj.size', 64); }, 'The constructor writes <code>size = 64</code> (buffered).');
        P(() => { write(0, 2, 'inst', '@obj'); S.fence = ['release', null]; }, '<code>inst = @obj</code> is a <b>volatile write</b>. The constructor’s write must become visible no later than it.');
        P(() => { drainAll(0); S.fence = [null, null]; }, 'In order: <code>size</code>, then <code>inst</code>.');
        P(() => { read(1, 0, 'inst', 'h'); S.hb = [[2, 0]]; }, 'T2’s volatile read sees <code>@obj</code>. That links it to T1’s write.');
        P(() => { read(1, 2, 'obj.size', 'r'); S.pc[1] = 2; mark(1, 1); S.outcome = 'r = 64'; S.banner = 'fully constructed, guaranteed'; S.bannerC = 'var(--ok)'; }, 'So T2 sees <b>size = 64</b>. Even simpler: the holder idiom (<code>static final</code> in a nested class) gets the same promise from class setup, with no volatile read.');
      }
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    const tst = TESTS[mode]; const mem = {}; tst.vars.forEach((v) => { mem[v] = v === 'ready' || v === 'stop' ? 'false' : 0; });
    S = { pc: [null, null], done: [new Set(), new Set()], regs: [{}, {}], sb: [[], []], mem, flows: [], hb: [], fence: [null, null], hbR: [], hotMem: null, bad: null, outcome: null, banner: null };
    steps = plan(); render(); statLine(); bStep.disabled = false;
    say({ mp: 'T1 publishes <code>data</code> and then raises a flag. T2 checks the flag and reads the data.', sb: 'Each thread writes its own variable, then reads the other’s. Can both read 0?', hoist: 'T1 loops until T2 sets <code>stop</code>. Does it ever stop?', dcl: 'Lazy setup with double-checked locking. T2 arrives while T1 is constructing.' }[mode] + ` Fields: <b>${vol ? 'volatile' : 'plain'}</b>. Press Play or Step.`);
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; s.run(); render(); statLine(); say(typeof s.t === 'function' ? s.t() : s.t);
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
