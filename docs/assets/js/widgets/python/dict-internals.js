/* Dict internals: CPython's compact dict = sparse indices array + dense entries array.
   Int keys (hash(k) == k) so every probe is checkable: collision, perturb probing, dummy on delete,
   lookup through a dummy, resize at 2/3 full with compaction, iteration in entry order. */
IA.widget('dict-internals', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-py-base')) {
    document.head.append(el('style', { id: 'w-py-base', text: `
.wpy-code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.wpy-code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent}
.wpy-code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.wpy-out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.wpy-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.wpy-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:12px;align-items:start}
@media (max-width:720px){.wpy-grid{grid-template-columns:1fr}}
` }));
  }
  if (!document.getElementById('w-pydict-style')) {
    document.head.append(el('style', { id: 'w-pydict-style', text: `
.w-pydict .cell{fill:var(--surface);stroke:var(--border);stroke-width:1.5;transition:all .3s}
.w-pydict .cell.visit{stroke:var(--warn);stroke-width:3}
.w-pydict .cell.final{stroke:var(--ok);stroke-width:3;fill:color-mix(in srgb,var(--ok) 14%,var(--surface))}
.w-pydict .cell.dummy{fill:color-mix(in srgb,var(--warn) 16%,var(--surface))}
.w-pydict .row{fill:var(--surface);stroke:var(--border)}
.w-pydict .row.hi{stroke:var(--accent);stroke-width:2.5;fill:var(--accent-soft)}
.w-pydict .row.del{fill:var(--surface-2);stroke-dasharray:4 3}
.w-pydict .ptr{fill:none;stroke:var(--accent);stroke-width:2}
.w-pydict .mono{font-family:var(--mono)}
.w-pydict .probe{font-family:var(--mono);font-size:12.5px;line-height:1.7;border:1px solid var(--border);border-radius:10px;padding:8px 12px;background:var(--surface-2);min-height:5.5em}
.w-pydict .probe .bad{color:var(--warn)} .w-pydict .probe .good{color:var(--ok)}
` }));
  }
  const E = (n) => Array(n).fill(null);
  const ix8 = (m) => { const a = E(8); Object.entries(m).forEach(([k, v]) => { a[k] = v; }); return a; };
  const ix16 = (m) => { const a = E(16); Object.entries(m).forEach(([k, v]) => { a[k] = v; }); return a; };
  const R = (k, v) => ({ h: k, k, v });
  const CODE = ['d = {}', 'd[10] = "a"', 'd[18] = "b"', 'd[3] = "c"', 'd[7] = "d"', 'del d[18]', 'd[3]', 'd[42] = "e"', 'd[5] = "f"', 'list(d)'];
  const S = [
    { line: 0, size: 8, usable: 5, ix: ix8({}), en: [], probe: ['size 8 → mask = 7', 'usable = 8 × 2/3 → 5 entries'],
      cap: 'An empty dict starts with <b>8 index slots</b> but room for only <b>5 entries</b>: CPython keeps the table at most ⅔ full so probe chains stay short.' },
    { line: 1, size: 8, usable: 4, ix: ix8({ 2: 0 }), en: [R(10, 'a')], visit: [], fin: 2, hiRow: 0,
      probe: ['hash(10) = 10', '<span class="good">10 &amp; 7 = 2 → empty ✓</span>'],
      cap: 'The entry <code>(hash, key, value)</code> is <b>appended</b> to the entries array as #0, and slot 2 of the indices array stores just the number <b>0</b>. The big records stay dense; only the tiny indices array is sparse.' },
    { line: 2, size: 8, usable: 3, ix: ix8({ 2: 0, 3: 1 }), en: [R(10, 'a'), R(18, 'b')], visit: [2], fin: 3, hiRow: 1,
      probe: ['hash(18) = 18', '<span class="bad">18 &amp; 7 = 2 → taken (entry #0 has hash 10)</span>', 'perturb = 18 &gt;&gt; 5 = 0', '<span class="good">i = (5·2 + 0 + 1) &amp; 7 = 3 → empty ✓</span>'],
      cap: '<b>Collision.</b> 18 also wants slot 2. The stored hash (10) differs, so CPython doesn’t even call <code>==</code>; it moves on with the probe formula <code>i = (5·i + perturb + 1) &amp; mask</code> and lands on slot 3.' },
    { line: 3, size: 8, usable: 2, ix: ix8({ 0: 2, 2: 0, 3: 1 }), en: [R(10, 'a'), R(18, 'b'), R(3, 'c')], visit: [3], fin: 0, hiRow: 2,
      probe: ['hash(3) = 3', '<span class="bad">3 &amp; 7 = 3 → taken (by 18’s probe!)</span>', 'perturb = 3 &gt;&gt; 5 = 0', '<span class="good">i = (5·3 + 0 + 1) &amp; 7 = 0 → empty ✓</span>'],
      cap: 'Key 3’s home slot is occupied by 18, which only got there by probing. Collisions cascade, which is why the load factor is capped.' },
    { line: 4, size: 8, usable: 1, ix: ix8({ 0: 2, 2: 0, 3: 1, 7: 3 }), en: [R(10, 'a'), R(18, 'b'), R(3, 'c'), R(7, 'd')], visit: [], fin: 7, hiRow: 3,
      probe: ['hash(7) = 7', '<span class="good">7 &amp; 7 = 7 → empty ✓</span>', 'usable left: 1'],
      cap: 'Four entries, one usable slot left. Note the entries array is in <b>insertion order</b> while the indices are scattered by hash.' },
    { line: 5, size: 8, usable: 1, ix: ix8({ 0: 2, 2: 0, 3: 'D', 7: 3 }), en: [R(10, 'a'), null, R(3, 'c'), R(7, 'd')], visit: [2], fin: 3, hiRow: 1,
      probe: ['find 18: slot 2 → entry #0, hash 10 ≠ 18', 'slot 3 → entry #1, hash 18 ✓, key 18 ✓', '<span class="bad">slot 3 ← DUMMY, entry #1 cleared</span>'],
      cap: '<b>Delete.</b> The entry is cleared (iteration will skip it) and slot 3 becomes a <b>dummy</b>, not empty. The usable count does not go back up: the hole is only reclaimed by the next resize.' },
    { line: 6, size: 8, usable: 1, ix: ix8({ 0: 2, 2: 0, 3: 'D', 7: 3 }), en: [R(10, 'a'), null, R(3, 'c'), R(7, 'd')], visit: [3], fin: 0, hiRow: 2, out: "'c'",
      probe: ['hash(3) = 3', '<span class="bad">slot 3 → DUMMY: keep probing</span>', '<span class="good">i = (5·3 + 0 + 1) &amp; 7 = 0 → entry #2, key 3 ✓</span>'],
      cap: 'Why the dummy matters: key 3 was placed <i>past</i> slot 3. If <code>del</code> had marked slot 3 empty, this lookup would stop there and raise <code>KeyError</code> for a key that exists.' },
    { line: 7, size: 8, usable: 0, ix: ix8({ 0: 2, 2: 0, 3: 'D', 4: 4, 7: 3 }), en: [R(10, 'a'), null, R(3, 'c'), R(7, 'd'), R(42, 'e')], visit: [2], fin: 4, hiRow: 4,
      probe: ['hash(42) = 42 = 0b101010', '<span class="bad">42 &amp; 7 = 2 → taken</span>', 'perturb = 42 &gt;&gt; 5 = 1', '<span class="good">i = (5·2 + 1 + 1) &amp; 7 = 4 → empty ✓</span>', 'usable left: 0'],
      cap: 'Now <code>perturb</code> is 1: the hash’s <b>high bits</b> feed into the probe, so keys that share low bits (10, 18, 42 all end in <code>010</code>) still spread out. The table is now full by the ⅔ rule.' },
    { line: 8, size: 16, usable: 6, ix: ix16({ 3: 1, 4: 3, 7: 2, 10: 0 }), en: [R(10, 'a'), R(3, 'c'), R(7, 'd'), R(42, 'e')], visit: [10], fin: 4, hiRow: 3, resize: true,
      probe: ['no usable slot → resize', 'live = 4, need ≥ 3 × 4 = 12 → 16 slots, mask 15', 're-insert live entries (stored hashes, no rehash):', '10→10 · 3→3 · 7→7', '42 &amp; 15 = 10 taken → (5·10 + 1 + 1) &amp; 15 = 4'],
      cap: '<b>Resize.</b> <code>d[5]</code> finds no usable entry, so CPython builds a table of the smallest power of two ≥ 3 × live items (16) and re-inserts the 4 live entries. The deleted hole and the dummy are gone: the entries array is <b>compacted</b> and keeps its order.' },
    { line: 8, size: 16, usable: 5, ix: ix16({ 3: 1, 4: 3, 5: 4, 7: 2, 10: 0 }), en: [R(10, 'a'), R(3, 'c'), R(7, 'd'), R(42, 'e'), R(5, 'f')], visit: [], fin: 5, hiRow: 4,
      probe: ['hash(5) = 5', '<span class="good">5 &amp; 15 = 5 → empty ✓</span>'],
      cap: 'Then 5 is inserted into the new table. Resizes are O(n), but because a full table (⅔ × size live) grows to about twice its size, inserts are O(1) <b>amortised</b>.' },
    { line: 9, size: 16, usable: 5, ix: ix16({ 3: 1, 4: 3, 5: 4, 7: 2, 10: 0 }), en: [R(10, 'a'), R(3, 'c'), R(7, 'd'), R(42, 'e'), R(5, 'f')], visit: [], hiRow: -1, iter: true, out: '[10, 3, 7, 42, 5]',
      probe: ['iteration ignores the indices array', 'walk entries #0 … #4, skip holes'],
      cap: '<b>Iteration</b> just walks the dense entries array, which is why dicts are insertion-ordered (guaranteed since 3.7). Sets don’t have this second array, so their order follows the slots.' }
  ];
  let k = 0, gen = 0, running = false;
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'wpy-code' });
  const out = el('div', { class: 'wpy-out' });
  const probe = el('div', { class: 'probe' });
  const stage = svg('svg', { viewBox: '0 0 640 300', role: 'img', 'aria-label': 'Indices array on top, entries array below, with probe steps highlighted' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-pydict');
  root.append(el('div', { class: 'wpy-grid' },
    el('div', null, el('div', { class: 'wpy-lbl', text: 'code' }), codeHost, el('div', { class: 'wpy-lbl', text: 'probe arithmetic' }), probe, el('div', { class: 'wpy-lbl', text: 'result' }), out),
    el('div', null, el('div', { class: 'wpy-lbl', text: 'memory layout' }), el('div', { class: 'w-stage' }, stage))),
  el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr, stats);

  function render() {
    const cur = S[Math.max(0, k - 1)]; const shown = k > 0;
    codeHost.innerHTML = '';
    CODE.forEach((ln, i) => codeHost.append(el('div', { class: shown && cur.line === i ? 'on' : '', html: IA.highlight(ln, 'python') })));
    probe.innerHTML = shown ? cur.probe.map((p) => `<div>${p}</div>`).join('') : '<div>Press Play or Step.</div>';
    out.textContent = shown && cur.out ? cur.out : ' ';
    stage.innerHTML = '';
    const st = shown ? cur : S[0];
    const X0 = 14, W = 612, cw = W / st.size;
    stage.append(svg('text', { x: X0, y: 16, 'font-size': 12, fill: 'var(--text-3)', text: `indices[${st.size}]  (int8 each; ${st.size === 8 ? 'mask 7' : 'mask 15'})` }));
    const cells = [];
    st.ix.forEach((v, i) => {
      let cls = 'cell';
      if (v === 'D') cls += ' dummy';
      if (shown && (cur.visit || []).includes(i)) cls += ' visit';
      if (shown && cur.fin === i) cls += ' final';
      const x = X0 + i * cw;
      stage.append(svg('text', { x: x + cw / 2, y: 34, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-3)', text: String(i) }),
        svg('rect', { class: cls, x: x + 1, y: 40, width: cw - 2, height: 36, rx: 5 }),
        svg('text', { class: 'mono', x: x + cw / 2, y: 63, 'text-anchor': 'middle', 'font-size': st.size === 8 ? 15 : 12, 'font-weight': 700, fill: v === 'D' ? 'var(--warn)' : v == null ? 'var(--text-3)' : 'var(--text)', text: v == null ? '·' : v === 'D' ? 'DUMMY'.slice(0, st.size === 8 ? 5 : 1) : String(v) }));
      cells.push(x + cw / 2);
    });
    const EY = 118, RH = 27;
    stage.append(svg('text', { x: X0, y: EY + 16, 'font-size': 12, 'font-weight': 700, fill: 'var(--text-2)', text: 'entries[ ]' }),
      svg('text', { x: X0, y: EY + 34, 'font-size': 11, fill: 'var(--text-3)', text: 'dense, in insertion order' }));
    ['#', 'hash', 'key', 'value'].forEach((h, c) => stage.append(svg('text', { x: 300 + [12, 70, 150, 230][c], y: EY - 6, 'font-size': 11, fill: 'var(--text-3)', text: h })));
    st.en.forEach((e, j) => {
      const y = EY + j * RH; const x = 300;
      const cls = 'row' + (e == null ? ' del' : '') + (shown && cur.hiRow === j ? ' hi' : '') + (shown && cur.iter && e ? ' hi' : '');
      stage.append(svg('rect', { class: cls, x, y, width: 326, height: RH - 4, rx: 5 }));
      const vals = e ? [`#${j}`, String(e.h), String(e.k), `'${e.v}'`] : [`#${j}`, '—', '<deleted>', ''];
      [12, 70, 150, 230].forEach((dx, c) => stage.append(svg('text', { class: 'mono', x: x + dx, y: y + 16, 'font-size': 13, fill: e ? 'var(--text)' : 'var(--text-3)', text: vals[c] })));
    });
    // pointers from occupied index cells to entry rows (only for the highlighted row to keep it readable)
    if (shown && cur.hiRow >= 0 && cur.fin != null && typeof st.ix[cur.fin] === 'number') {
      const j = st.ix[cur.fin]; const x1 = cells[cur.fin], y1 = 76, x2 = 300, y2 = EY + j * RH + 11;
      const p = svg('path', { class: 'ptr', d: `M${x1} ${y1} C ${x1} ${y1 + 40}, ${x2 - 60} ${y2}, ${x2} ${y2}` });
      if (!reduced) { p.style.strokeDasharray = '500'; p.style.strokeDashoffset = '500'; p.style.transition = 'stroke-dashoffset .8s ease'; requestAnimationFrame(() => requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; })); }
      stage.append(p, svg('circle', { cx: x2, cy: y2, r: 4, fill: 'var(--accent)' }));
    }
    if (shown && cur.resize) stage.append(svg('text', { x: X0, y: 104, 'font-size': 12, 'font-weight': 700, fill: 'var(--warn)', text: '↻ resized 8 → 16 and compacted' }));
    const live = st.en.filter(Boolean).length;
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `slots <b>${st.size}</b>` }), el('span', { class: 'w-stat', html: `live entries <b>${live}</b>` }), el('span', { class: 'w-stat', html: `usable left <b>${st.usable}</b>` }), el('span', { class: 'w-stat', html: `fill <b>${Math.round((st.en.length / st.size) * 100)}%</b> of slots` }));
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${S.length}` }), el('div', { class: 't', html: shown ? cur.cap : 'Press <b>Play</b> or <b>Step</b> to insert, delete and look up keys one operation at a time.' }));
    bStep.disabled = k >= S.length;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; render(); }
  function step() { if (k >= S.length) return false; k++; render(); return k < S.length; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= S.length) { k = 0; render(); }
    if (reduced) { k = S.length; render(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(3000); }
    if (g === gen) stop();
  });
  reset();
});
