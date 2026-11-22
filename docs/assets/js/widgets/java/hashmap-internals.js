/* HashMap internals: hash → index, tail-inserted chains, resize with lo/hi split, treeification, fail-fast iteration. */
IA.widget('hashmap-internals', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'put'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['put', 'put & resize'], ['tree', 'collisions → tree'], ['cme', 'map.remove in for-each'], ['safe', 'iterator.remove()']], () => mode, (v) => { mode = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 360, X0 = 20, CY = 44, CH = 26, NY = 92, NH = 20, NG = 6;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'HashMap bucket array with chains of nodes below each bucket' });
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };

  let S;
  const idx = (h, n) => h & (n - 1);
  const order = () => S.b.flatMap((c) => c.map((x) => x.k));
  function render() {
    stage.innerHTML = '';
    const n = S.n; const cw = (W - 2 * X0) / n;
    stage.append(svg('text', { x: X0, y: 22, 'font-size': 13, 'font-weight': 700, fill: 'var(--text)', text: S.n ? `Node[] table  (length ${n})` : 'table = null (allocated on first put)' }));
    if (!n) return;
    for (let i = 0; i < n; i++) {
      const x = X0 + i * cw;
      const hot = S.hotB === i; const tree = S.tree === i;
      stage.append(svg('rect', { x: x + 0.5, y: CY, width: cw - 1, height: CH, rx: 3, fill: hot ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: hot || tree ? 'var(--accent)' : 'var(--border)', 'stroke-width': hot ? 2 : 1 }));
      if (n <= 32 || i % 8 === 0) stage.append(svg('text', { x: x + cw / 2, y: CY + 17, 'text-anchor': 'middle', 'font-size': n <= 16 ? 12 : 10, fill: 'var(--text-3)', text: String(i) }));
    }
    S.b.forEach((chain, i) => {
      if (!chain.length) return;
      const cx = X0 + i * cw + cw / 2;
      if (S.tree === i) { drawTree(chain, cx); return; }
      const bw = n <= 32 ? Math.max(cw - 3, 18) : 38;
      stage.append(svg('line', { x1: cx, y1: CY + CH, x2: cx, y2: NY, stroke: 'var(--border)', 'stroke-width': 1.5 }));
      chain.forEach((nd, j) => {
        const y = NY + j * (NH + NG);
        if (j) stage.append(svg('line', { x1: cx, y1: y - NG, x2: cx, y2: y, stroke: 'var(--text-3)', 'stroke-width': 1.5 }));
        stage.append(svg('rect', { x: cx - bw / 2, y, width: bw, height: NH, rx: 4, fill: nd.hot ? 'var(--accent-soft)' : nd.gone ? 'none' : 'var(--surface)', stroke: nd.hot ? 'var(--accent)' : nd.moved ? 'var(--warn)' : nd.gone ? 'var(--err)' : 'var(--border)', 'stroke-width': nd.hot || nd.moved ? 2 : 1, 'stroke-dasharray': nd.gone ? '4 3' : null }));
        stage.append(svg('text', { x: cx, y: y + 14, 'text-anchor': 'middle', 'font-size': bw < 24 ? 10 : 12, 'font-family': 'var(--mono)', fill: nd.gone ? 'var(--text-3)' : 'var(--text)', 'text-decoration': nd.gone ? 'line-through' : null, text: String(nd.k) }));
        if (S.cur === nd.k) stage.append(svg('text', { x: cx + bw / 2 + 4, y: y + 14, 'font-size': 12, fill: 'var(--accent)', 'font-weight': 700, text: '◀ it' }));
        if (S.nxt === nd.k) stage.append(svg('text', { x: cx + bw / 2 + 4, y: y + 14, 'font-size': 11, fill: 'var(--text-3)', text: '◀ next' }));
      });
    });
    if (S.banner) stage.append(svg('text', { x: W - X0, y: 22, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, fill: S.bannerC || 'var(--accent)', text: S.banner }));
  }
  function drawTree(chain, bx) {
    const keys = chain.map((x) => x.k).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    const pos = []; const build = (lo, hi, d, parent) => { if (lo > hi) return; const m = (lo + hi) >> 1; pos.push({ k: keys[m], i: m, d, parent }); build(lo, m - 1, d + 1, m); build(m + 1, hi, d + 1, m); };
    build(0, keys.length - 1, 0, -1);
    const px = (i) => 150 + i * ((W - 300) / Math.max(1, keys.length - 1)); const py = (d) => 110 + d * 56;
    const byI = {}; pos.forEach((p) => { byI[p.i] = p; });
    const rootP = pos[0];
    stage.append(svg('path', { d: `M${bx} ${CY + CH} C ${bx} ${CY + CH + 30}, ${px(rootP.i)} ${py(0) - 40}, ${px(rootP.i)} ${py(0) - 12}`, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.5 }));
    pos.forEach((p) => { if (p.parent >= 0) stage.append(svg('line', { x1: px(p.parent), y1: py(byI[p.parent].d), x2: px(p.i), y2: py(p.d), stroke: 'var(--text-3)', 'stroke-width': 1.2 })); });
    pos.forEach((p) => {
      stage.append(svg('circle', { cx: px(p.i), cy: py(p.d), r: 17, fill: 'var(--surface)', stroke: p.d % 2 ? 'var(--err)' : 'var(--text)', 'stroke-width': 2 }));
      stage.append(svg('text', { x: px(p.i), y: py(p.d) + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'var(--mono)', fill: 'var(--text)', text: p.k }));
    });
    stage.append(svg('text', { x: W / 2, y: H - 10, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-3)', text: 'TreeNode bin: red-black tree ordered by hash, then compareTo (colours illustrative)' }));
  }
  function statLine() {
    stats.innerHTML = '';
    const add = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    if (mode === 'put' || mode === 'tree') { add(`size <b>${S.size}</b>`); add(`threshold <b>${S.n ? S.thr : '—'}</b>`); add(`resizes <b>${S.resizes}</b>`); }
    else { add(`modCount <b>${S.mod}</b>`); add(`iterator.expectedModCount <b>${S.exp == null ? '—' : S.exp}</b>`); add(`size <b>${S.size}</b>`); }
    if (mode === 'put') add(`iteration order <b>${order().join(', ') || '—'}</b>`);
  }
  const code = (src) => { codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(src, 'java') })); };
  const clearMarks = () => S.b.forEach((c) => c.forEach((x) => { x.hot = false; x.moved = false; }));

  function putStep(key, hash, label) {
    return { run: () => {
      clearMarks(); let note = '';
      if (!S.n) { S.n = 16; S.thr = 12; S.b = Array.from({ length: 16 }, () => []); note = 'First put: the table is allocated now (16 buckets, threshold 16 × 0.75 = 12). '; }
      const n0 = S.n; const i = idx(hash, n0); S.hotB = i; const chain = S.b[i];
      chain.push({ k: label, h: hash, hot: true }); S.size++;
      const coll = chain.length > 1;
      let extra = '';
      if (mode === 'tree' && chain.length >= 9 && S.tree !== i) {
        if (S.n < 64) { extra = ` The bin now holds <b>${chain.length}</b> nodes (≥ 8), so <code>treeifyBin</code> runs, but the table has only ${n0} buckets (&lt; MIN_TREEIFY_CAPACITY 64). It <b>resizes to ${n0 * 2}</b> instead of building a tree. Every key still lands in bucket 7, so the chain doesn’t shrink.`; grow(); }
        else { S.tree = i; extra = ` Bin length ≥ 8 and the table has ${S.n} buckets, so the bin is <b>treeified</b>: a red-black tree. Lookups in this bin become O(log n), because these keys are <code>Comparable</code>.`; }
      }
      S.msg = note + (mode === 'tree'
        ? `<code>put(${label})</code>: <code>hashCode()</code> always returns 7, so index = 7 &amp; ${n0 - 1} = <b>${i}</b>. ${coll ? `Collision: the node is appended at the <b>tail</b> (chain length ${chain.length}).` : ''}`
        : `<code>put(${label})</code>: hash = ${hash} ^ (${hash} &gt;&gt;&gt; 16) = ${hash}; index = ${hash} &amp; ${n0 - 1} = <b>${i}</b>. ` + (coll ? `Bucket ${i} is taken, so the node is appended at the <b>tail</b> (Java 8+; Java 7 inserted at the head).` : 'Empty bucket: the node goes straight in.')) + extra;
      if (mode === 'put' && S.size > S.thr) S.pendingResize = true;
    }, t: () => S.msg + (S.pendingResize ? ` Now <b>size ${S.size} &gt; threshold ${S.thr}</b>: a resize follows.` : '') };
  }
  function grow() {
    const old = S.b; const on = S.n; const nn = on * 2;
    const nb = Array.from({ length: nn }, () => []);
    old.forEach((c) => c.forEach((x) => { const lo = (x.h & on) === 0; nb[lo ? idx(x.h, on) : idx(x.h, on) + on].push({ ...x, hot: false, moved: !lo }); }));
    S.b = nb; S.n = nn; S.thr = nn * 0.75; S.resizes++;
  }
  function plan() {
    const st = [];
    if (mode === 'put') {
      code('Map<Integer, String> m = new HashMap<>();   // capacity 16, load factor 0.75\nfor (int k : new int[]{5, 21, 37, 12, 28, 3, 19, 8, 44, 1, 17, 14, 30})\n    m.put(k, "v");                           // Integer.hashCode() == the value');
      [5, 21, 37, 12, 28, 3, 19, 8, 44, 1, 17, 14, 30].forEach((x) => st.push(putStep(x, x, String(x))));
      st.push({ run: () => { const before = order().join(', '); grow(); S.pendingResize = false; S.hotB = null; S.msg = `<b>resize()</b>: 16 → 32 buckets, new threshold 24. No hash is recomputed: each node checks one bit, <code>hash &amp; 16</code>. If it is 0 the node stays at index <i>i</i> (“lo” list); if 1 it moves to <i>i + 16</i> (“hi” list, orange). Order inside each list is preserved. Iteration order was <code>${before}</code>.`; },
        t: () => S.msg });
      st.push({ run: () => { clearMarks(); }, t: () => `Iteration walks bucket 0 → 31 and each chain head → tail, so the order is now <code>${order().join(', ')}</code>. Nothing about the keys changed, yet the order did. <b>HashMap never promises an order</b>; use <code>LinkedHashMap</code> or <code>TreeMap</code> when it matters.` });
    } else if (mode === 'tree') {
      code('record K(int id) implements Comparable<K> {\n    @Override public int hashCode() { return 7; }     // every key collides\n    public int compareTo(K o) { return Integer.compare(id, o.id); }\n}\nfor (int i = 1; i <= 11; i++) m.put(new K(i), i);');
      for (let i = 1; i <= 11; i++) st.push(putStep(i, 7, 'k' + i));
      st.push({ run: () => { clearMarks(); S.hotB = null; }, t: () => 'Summary: a bin is treeified when it reaches <b>8+ nodes</b> (TREEIFY_THRESHOLD) and the table has <b>≥ 64 buckets</b>. Below 64, HashMap resizes instead. On removal or resize, a tree with <b>≤ 6</b> nodes turns back into a list (UNTREEIFY_THRESHOLD). With a sane <code>hashCode()</code> a bin almost never reaches 8.' });
    } else {
      const safe = mode === 'safe';
      code(safe
        ? 'for (Iterator<Integer> it = m.keySet().iterator(); it.hasNext(); ) {\n    Integer k = it.next();\n    if (k == 1) it.remove();          // removes AND re-syncs expectedModCount\n}\n// or simply: m.keySet().removeIf(k -> k == 1);'
        : 'for (Integer k : m.keySet()) {        // hidden Iterator\n    if (k == 1) m.remove(k);          // structural change behind the iterator’s back\n}');
      st.push({ run: () => { S.exp = S.mod; S.cur = null; S.nxt = 0; }, t: () => `The loop creates an iterator. It copies <b>expectedModCount = modCount = ${S.mod}</b> (four puts, four structural changes) and points <code>next</code> at the first node: key 0 in bucket 0.` });
      st.push({ run: () => { S.cur = 0; S.nxt = 1; S.hotB = 0; }, t: 'hasNext() is just <code>next != null</code>. next() first checks <code>modCount == expectedModCount</code> (OK), returns key 0 and moves <code>next</code> to key 1.' });
      st.push({ run: () => { S.cur = 1; S.nxt = 2; S.hotB = 1; }, t: 'next() returns key 1. Note: the iterator has <b>already</b> moved <code>next</code> to key 2.' });
      if (!safe) {
        st.push({ run: () => { S.b[1][0].gone = true; S.mod++; S.size--; }, t: () => `<code>m.remove(1)</code> unlinks the node and bumps <b>modCount to ${S.mod}</b>. The iterator doesn’t know: its expectedModCount is still ${S.exp}.` });
        st.push({ run: () => { S.banner = 'ConcurrentModificationException'; S.bannerC = 'var(--err)'; S.hotB = 2; }, t: () => `hasNext() sees <code>next</code> = key 2, so it returns true. next() checks ${S.mod} ≠ ${S.exp} and throws <b>ConcurrentModificationException</b>. Single thread, no concurrency at all: “concurrent” here means “while iterating”. Had we removed key 3 (the <i>last</i> one), <code>next</code> would already be null, hasNext() would return false, and <b>no exception</b> would be thrown. Fail-fast is best-effort.` });
      } else {
        st.push({ run: () => { S.b[1][0].gone = true; S.mod++; S.size--; S.exp = S.mod; }, t: () => `<code>it.remove()</code> removes the node through the iterator, then sets <b>expectedModCount = modCount = ${S.mod}</b>. The two counters agree again.` });
        st.push({ run: () => { S.cur = 2; S.nxt = 3; S.hotB = 2; }, t: 'next() passes the check and returns key 2.' });
        st.push({ run: () => { S.cur = 3; S.nxt = null; S.hotB = 3; }, t: 'Key 3, then <code>next</code> becomes null.' });
        st.push({ run: () => { S.cur = null; S.hotB = null; S.banner = 'done: size 3'; S.bannerC = 'var(--ok)'; }, t: 'hasNext() is false and the loop ends: {0, 2, 3}. <code>removeIf</code> does the same thing in one line. For a map shared between threads, use <a href="concurrent-collections.html">ConcurrentHashMap</a>, whose iterators are weakly consistent and never throw CME.' });
      }
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    if (mode === 'cme' || mode === 'safe') {
      S = { n: 16, thr: 12, b: Array.from({ length: 16 }, (_, i) => (i < 4 ? [{ k: i, h: i }] : [])), size: 4, mod: 4, exp: null, resizes: 0, cur: null, nxt: null };
    } else S = { n: 0, thr: 0, b: [], size: 0, resizes: 0 };
    steps = plan(); render(); statLine(); bStep.disabled = false;
    say(mode === 'put' ? 'Thirteen Integer keys go into a default HashMap. Watch where each lands, which buckets collide, and what the 13th put does. Press Play or Step.'
      : mode === 'tree' ? 'A key type whose <code>hashCode()</code> is a constant: every key lands in the same bucket. When does HashMap build a tree?'
      : 'Map {0, 1, 2, 3}. We remove key 1 while looping. Watch the two counters.');
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
