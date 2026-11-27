/* equals & hashCode: watch HashMap route keys to buckets by hash, then confirm with equals. Mutable keys, missing hashCode, collisions. */
IA.widget('equals-hashcode', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-jt-style')) {
    document.head.append(el('style', { id: 'w-jt-style', text: `
.jt-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 12px; align-items: start; }
@media (max-width: 760px) { .jt-grid { grid-template-columns: 1fr; } }
.jt-code { font-family: var(--mono); font-size: 12.5px; line-height: 1.6; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 0; overflow-x: auto; }
.jt-code div { padding: 0 10px; white-space: pre; border-left: 3px solid transparent; }
.jt-code div.on { background: var(--accent-soft); border-left-color: var(--accent); }
.jt-out { font-family: var(--mono); font-size: 12.5px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 6px 10px; margin-top: 8px; min-height: 2.2em; white-space: pre-wrap; }
.jt-out .h { font-size: 11px; color: var(--text-3); font-family: var(--sans); }
.jt-out .e { color: var(--err); }
.jt-box { fill: var(--surface); stroke: var(--border); stroke-width: 1.2; }
.jt-box.hot { stroke: var(--accent); stroke-width: 2; fill: var(--accent-soft); }
.jt-box.chg { stroke: var(--warn); stroke-width: 2; }
.jt-box.gc { stroke-dasharray: 4 3; opacity: .45; }
.jt-box.bad { stroke: var(--err); stroke-width: 2; }
.jt-box.ok { stroke: var(--ok); stroke-width: 2; }
.jt-box.frame { fill: var(--surface-2); }
.jt-arrow { fill: none; stroke: var(--accent); stroke-width: 1.8; }
.jt-arrow.chg { stroke: var(--warn); stroke-width: 2.4; }
.jt-arrow.gc { opacity: .35; }
` }));
  }
  // entry: [bucket, keyLabel, storedHash, value, cls]; probe: { t: text, b: bucket, res: 'ok'|'bad'|null, at: entry index checked }
  const SC = {
    nohash: { label: 'equals without hashCode', code: [
      'class Key {',
      '  final String name;',
      '  Key(String n) { name = n; }',
      '  @Override public boolean equals(Object o) {',
      '    return o instanceof Key k && k.name.equals(name);',
      '  }',
      '  // no hashCode(): inherits identity hash',
      '}',
      'var map = new HashMap<Key, Integer>();',
      'map.put(new Key("a"), 1);',
      'System.out.println(map.get(new Key("a")));'],
    steps: [
      { l: 8, e: [], s: 'An empty HashMap. The default capacity is 16 buckets. A key’s bucket is <code>(h ^ h &gt;&gt;&gt; 16) &amp; 15</code>, where <code>h = key.hashCode()</code>.' },
      { l: 9, e: [[12, 'Key a', 'id#…5e2d', 1, 'hot']], probe: { t: 'put: hashCode() = identity hash (e.g. 0x5e2de821) → bucket 12', b: 12 }, s: 'Without an override, <code>hashCode()</code> comes from <code>Object</code>. It is different for every object (an <b>identity hash</b>). This key lands in bucket 12 on this run.' },
      { l: 10, e: [[12, 'Key a', 'id#…5e2d', 1]], probe: { t: 'get: new Key("a").hashCode() = 0x1d44bcf2 → bucket 6', b: 6, res: 'bad' }, s: 'The lookup key is a <i>new</i> object with its own identity hash, so HashMap looks in another bucket. It finds nothing and never calls <code>equals</code>.' },
      { l: 10, e: [[12, 'Key a', 'id#…5e2d', 1]], probe: { t: 'result: null, although the keys are equal', b: 6, res: 'bad' }, out: 'null', s: 'Prints <b>null</b>. Even if both hashes landed in the same bucket, HashMap compares the stored hash before calling <code>equals</code>. <b>Equal objects must have equal hash codes.</b>' }
    ] },
    mutable: { label: 'Mutable key', code: [
      'class Key {',
      '  String name;                     // mutable!',
      '  Key(String n) { name = n; }',
      '  public boolean equals(Object o) { return o instanceof Key k && k.name.equals(name); }',
      '  public int hashCode() { return name.hashCode(); }',
      '}',
      'var k = new Key("a");',
      'map.put(k, 1);',
      'k.name = "b";',
      'System.out.println(map.get(k));',
      'System.out.println(map.get(new Key("a")));',
      'System.out.println(map.size());'],
    steps: [
      { l: 7, e: [[1, 'Key a', 'h 97', 1, 'hot']], probe: { t: 'put: "a".hashCode() = 97 → bucket 97 & 15 = 1', b: 1 }, s: 'Correct equals and hashCode. <code>"a".hashCode()</code> is 97, so the entry goes to bucket 1. The map’s node also <b>stores the hash</b> (97).' },
      { l: 8, e: [[1, 'Key b', 'h 97', 1, 'chg']], s: 'The key changes <i>while it is inside the map</i>. The entry doesn’t move. It stays in bucket 1 with stored hash 97, but its key now says “b”.' },
      { l: 9, e: [[1, 'Key b', 'h 97', 1]], probe: { t: 'get(k): "b".hashCode() = 98 → bucket 2: empty', b: 2, res: 'bad' }, out: 'null', s: 'Looking up with the same object fails: its hash is now 98, so HashMap checks bucket 2. Prints <b>null</b>.' },
      { l: 10, e: [[1, 'Key b', 'h 97', 1]], probe: { t: 'get(Key a): hash 97 → bucket 1 → stored hash ✓ → equals("a" vs "b") ✗', b: 1, res: 'bad', at: 0 }, out: 'null', s: 'The original value leads to the right bucket and the hash matches, but <code>equals</code> compares “a” with the mutated “b”. Prints <b>null</b>.' },
      { l: 11, e: [[1, 'Key b', 'h 97', 1, 'bad']], out: '1', s: 'Prints <b>1</b>. The entry is still there but no lookup can reach it. Repeat this in a cache and you have a memory leak. Keys must be immutable, at least in the fields that equals and hashCode use.' }
    ] },
    collide: { label: 'Collision ("Aa" vs "BB")', code: [
      'var map = new HashMap<String, Integer>();',
      'map.put("Aa", 1);',
      'map.put("BB", 2);',
      'System.out.println("Aa".hashCode() + " " + "BB".hashCode());',
      'System.out.println(map.get("BB"));'],
    steps: [
      { l: 1, e: [[0, '"Aa"', 'h 2112', 1, 'hot']], probe: { t: 'put: 65·31 + 97 = 2112 → bucket 2112 & 15 = 0', b: 0 }, s: '<code>String.hashCode</code> is specified as <code>s[0]·31^(n-1) + … + s[n-1]</code>. For “Aa” that is 2112, bucket 0.' },
      { l: 2, e: [[0, '"Aa"', 'h 2112', 1], [0, '"BB"', 'h 2112', 2, 'hot']], probe: { t: 'put: 66·31 + 66 = 2112 → bucket 0: hash ✓, equals ✗ → chain', b: 0, at: 0, res: 'bad' }, s: 'Different string, <b>same hash</b>. HashMap finds a node with the same hash, calls <code>equals</code>, gets false, and appends a second node to the bucket.' },
      { l: 3, e: [[0, '"Aa"', 'h 2112', 1], [0, '"BB"', 'h 2112', 2]], out: '2112 2112', s: 'Unequal objects <i>may</i> share a hash code. The contract only works in one direction.' },
      { l: 4, e: [[0, '"Aa"', 'h 2112', 1], [0, '"BB"', 'h 2112', 2, 'ok']], probe: { t: 'get("BB"): bucket 0 → node 1 equals ✗ → node 2 equals ✓', b: 0, at: 1, res: 'ok' }, out: '2', s: 'Lookup walks the chain and uses <code>equals</code> to pick the right node. Prints <b>2</b>. Since Java 8 a bucket with 8+ nodes turns into a tree (once there are 64+ buckets), so heavy collisions cost O(log n) instead of O(n).' }
    ] },
    record: { label: 'Record key (correct)', code: [
      'record Key(String name) {}   // Java 16+',
      '// equals, hashCode, toString are generated',
      'var map = new HashMap<Key, Integer>();',
      'map.put(new Key("a"), 1);',
      'System.out.println(map.get(new Key("a")));',
      'System.out.println(new Key("a"));'],
    steps: [
      { l: 3, e: [[1, 'Key[a]', 'h 97', 1, 'hot']], probe: { t: 'put: hash derived from name → bucket 1', b: 1 }, s: 'A record’s generated <code>hashCode</code> is computed from all components and is consistent with its generated <code>equals</code>. The exact formula is unspecified; OpenJDK 21 gives 97 here.' },
      { l: 4, e: [[1, 'Key[a]', 'h 97', 1, 'ok']], probe: { t: 'get: same hash → bucket 1 → hash ✓ → equals ✓', b: 1, at: 0, res: 'ok' }, out: '1', s: 'An equal key gives an equal hash, the same bucket and a successful <code>equals</code>. Prints <b>1</b>. Components are <code>final</code>, so the key can’t drift (unless a component is itself mutable, like a List or an array).' },
      { l: 5, e: [[1, 'Key[a]', 'h 97', 1]], out: 'Key[name=a]', s: 'The generated <code>toString</code> prints <b>Key[name=a]</b>.' }
    ] }
  };

  const ids = Object.keys(SC); let cur = ids[0]; let k = -1; let gen = 0; let running = false;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  ids.forEach((id) => { const b = el('button', { text: SC[id].label, class: id === cur ? 'on' : '' }); b.addEventListener('click', () => { cur = id; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const code = el('div', { class: 'jt-code' });
  const out = el('div', { class: 'jt-out', 'aria-label': 'Program output' });
  const W = 520, H = 300;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Sixteen HashMap buckets with entries; a lookup arrow shows which bucket is searched' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, seg),
    el('div', { class: 'jt-grid' }, el('div', null, code, out), el('div', { class: 'w-stage' }, stage)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', 'font-family': 'var(--mono)', text: t }, o || {}));
  const BW = 61, BH = 96, BX = (i) => 6 + (i % 8) * (BW + 3), BY = (i) => (i < 8 ? 78 : 186);
  function draw(st) {
    stage.innerHTML = '';
    stage.append(svg('defs', null, svg('marker', { id: 'jt-ah-eh', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--accent)' }))));
    const pr = st && st.probe;
    stage.append(svg('rect', { class: 'jt-box' + (pr ? (pr.res === 'bad' ? ' bad' : pr.res === 'ok' ? ' ok' : ' hot') : ''), x: 6, y: 8, width: 508, height: 40, rx: 8 }));
    stage.append(T(16, 33, pr ? pr.t : (st ? 'HashMap<K,V>  table[16]' : 'press Play or Step'), { 'font-size': 11.5, fill: pr ? 'var(--text)' : 'var(--text-3)' }));
    const byB = {};
    (st ? st.e : []).forEach((e) => { (byB[e[0]] = byB[e[0]] || []).push(e); });
    for (let i = 0; i < 16; i++) {
      const x = BX(i), y = BY(i);
      const target = pr && pr.b === i;
      stage.append(svg('rect', { class: 'jt-box frame' + (target ? (pr.res === 'bad' && !(byB[i] || []).length ? ' bad' : ' hot') : ''), x, y, width: BW, height: BH, rx: 6 }));
      stage.append(T(x + 5, y + 13, '[' + i + ']', { 'font-size': 10, fill: 'var(--text-3)' }));
      (byB[i] || []).forEach((e, j) => {
        const cy = y + 20 + j * 37;
        const checked = target && pr.at === j;
        const cls = e[4] || (checked ? (pr.res === 'ok' ? 'ok' : 'bad') : '');
        stage.append(svg('rect', { class: 'jt-box ' + cls, x: x + 3, y: cy, width: BW - 6, height: 33, rx: 5 }));
        stage.append(T(x + 7, cy + 13, e[1], { 'font-size': 10.5, 'font-weight': 700, fill: cls === 'chg' ? 'var(--warn)' : 'var(--text)' }),
          T(x + 7, cy + 27, e[2] + ' =' + e[3], { 'font-size': 9.5, fill: 'var(--text-2)' }));
        if (j > 0) stage.append(svg('path', { class: 'jt-arrow', d: `M${x + BW / 2} ${cy - 4} L${x + BW / 2} ${cy}`, 'marker-end': 'url(#jt-ah-eh)' }));
      });
    }
    if (pr) {
      const x2 = BX(pr.b) + BW / 2, y2 = BY(pr.b) - 2;
      const p = svg('path', { class: 'jt-arrow' + (pr.res === 'bad' ? ' chg' : ''), d: `M260 48 C 260 ${y2 - 10}, ${x2} 52, ${x2} ${y2}`, 'marker-end': 'url(#jt-ah-eh)' });
      if (pr.b >= 8) p.setAttribute('d', `M${x2 < 260 ? 6 : 514} 48 L${x2 < 260 ? 3 : 517} 180 L${x2} ${BY(pr.b) - 2}`);
      if (!reduced) { p.style.strokeDasharray = '600'; p.style.strokeDashoffset = '600'; p.style.transition = 'stroke-dashoffset .8s ease'; requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; }); }
      stage.append(p);
    }
    stage.append(T(6, 296, 'bucket = (h ^ (h >>> 16)) & (capacity − 1)', { 'font-size': 10.5, fill: 'var(--text-3)' }));
  }
  function paint() {
    const S = SC[cur]; const st = k >= 0 ? S.steps[k] : null;
    code.innerHTML = '';
    S.code.forEach((ln, i) => code.append(el('div', { class: st && st.l === i ? 'on' : '', html: IA.highlight(ln, 'java') || ' ' })));
    out.innerHTML = ''; out.append(el('div', { class: 'h', text: 'stdout' }));
    S.steps.slice(0, k + 1).forEach((s) => { if (s.out) out.append(el('div', { text: s.out })); });
    draw(st);
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: st ? `${k + 1}/${S.steps.length}` : '0' }), el('div', { class: 't', html: st ? st.s : 'Pick a scenario, then press <b>Play</b> or <b>Step</b>. The top bar shows the hash computation; the arrow shows which bucket HashMap searches.' }));
    bStep.disabled = k >= S.steps.length - 1;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = -1; paint(); }
  function step() { const S = SC[cur]; if (k >= S.steps.length - 1) return false; k++; paint(); return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= SC[cur].steps.length - 1) k = -1;
    if (reduced) { k = SC[cur].steps.length - 1; paint(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
