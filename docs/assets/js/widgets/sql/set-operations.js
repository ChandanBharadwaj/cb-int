/* Set operations: stream rows of A then B into a hash table of (countA, countB); then emit per operation rules. */
IA.widget('set-operations', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-setop-css')) document.head.append(el('style', { id: 'w-setop-css', text: `
.w-setop-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 1fr); gap: 12px; }
@media (max-width: 640px) { .w-setop-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.w-setop table { border-collapse: collapse; font-family: var(--mono); font-size: 12.5px; width: 100%; }
.w-setop td, .w-setop th { border: 1px solid var(--border); padding: 4px 7px; text-align: left; }
.w-setop th { background: var(--surface-2); color: var(--text-3); font-weight: 600; }
.w-setop h5 { margin: 0 0 4px; font-family: var(--mono); font-size: 13px; }
.w-setop tr.cur td { background: var(--accent-soft); }
.w-setop tr.done td { color: var(--text-3); }
.w-setop tr.dup td { background: color-mix(in srgb, var(--warn) 24%, transparent); }
.w-setop tr.out td { background: color-mix(in srgb, var(--ok) 24%, transparent); }
.w-setop tr.zero td { opacity: .45; }
.w-setop .nul { color: var(--err); font-style: italic; }
.w-setop .fresh { animation: capin .35s ease both; }
` }));
  const A = [1, 1, 1, 2, 2, 3, null]; const B = [1, 1, 2, null, 4];
  const OPS = ['UNION ALL', 'UNION', 'INTERSECT', 'INTERSECT ALL', 'EXCEPT', 'EXCEPT ALL'];
  const RULE = { UNION: (l, r) => (l + r ? 1 : 0), INTERSECT: (l, r) => (l && r ? 1 : 0), 'INTERSECT ALL': (l, r) => Math.min(l, r), EXCEPT: (l, r) => (l && !r ? 1 : 0), 'EXCEPT ALL': (l, r) => Math.max(l - r, 0) };
  const RTXT = { UNION: '1 if l + r > 0', INTERSECT: '1 if l > 0 and r > 0', 'INTERSECT ALL': 'min(l, r)', EXCEPT: '1 if l > 0 and r = 0', 'EXCEPT ALL': 'max(l − r, 0)' };
  const NODE = { 'UNION ALL': 'Append', UNION: 'HashAggregate ← Append', INTERSECT: 'HashSetOp Intersect', 'INTERSECT ALL': 'HashSetOp Intersect All', EXCEPT: 'HashSetOp Except', 'EXCEPT ALL': 'HashSetOp Except All' };
  let op = 'UNION'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (label, opts, cur, pick) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); pick(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } }); const grid = el('div', { class: 'w-setop-grid' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-setop');
  root.append(el('div', { class: 'w-controls' }, seg('Operation', OPS.map((o) => [o, o]), op, (v) => { op = v; reset(); })), sqlBox, el('div', { class: 'w-stage' }, grid),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; })), narr, stats);
  const key = (v) => (v == null ? 'NULL' : String(v));
  function build() {
    const out = []; const H = new Map(); const res = [];
    const snap = (o) => out.push({ ...o, H: [...H.entries()].map(([kk, c]) => [kk, c.l, c.r, c.st]), res: res.slice() });
    if (op === 'UNION ALL') {
      A.forEach((v, i) => { res.push(key(v)); snap({ side: 'A', i, why: `Append: A row ${key(v)} goes straight out. No hashing, no memory.` }); });
      B.forEach((v, i) => { res.push(key(v)); snap({ side: 'B', i, why: `Append: B row ${key(v)} goes straight out${v == null || A.includes(v) ? ' (yes, a duplicate: ALL keeps it)' : ''}.` }); });
      return out;
    }
    const feed = (side, arr) => arr.forEach((v, i) => {
      const kk = key(v); const c = H.get(kk) || { l: 0, r: 0, st: '' }; const isNew = !H.has(kk); if (side === 'A') c.l++; else c.r++; c.st = 'cur'; H.forEach((x) => { if (x !== c) x.st = ''; }); H.set(kk, c);
      let why = `${side} row ${kk}: hash it. ${isNew ? 'New group.' : `Group exists: ${side === 'A' ? 'l' : 'r'} becomes ${side === 'A' ? c.l : c.r}.`}`;
      if (v == null && isNew) why += ' NULL gets its own group, and later NULLs land in it: for set ops, NULL is not distinct from NULL.';
      else if (v == null) why += ' Two NULLs are duplicates here, unlike in a join.';
      if (op === 'UNION') { if (isNew) { res.push(kk); why += ' First time seen, so emit it.'; } else { c.st = 'dup'; why += ' Already emitted: dropped.'; } }
      snap({ side, i, why });
    });
    feed('A', A); feed('B', B);
    if (op !== 'UNION') {
      H.forEach((x) => { x.st = ''; });
      [...H.entries()].forEach(([kk, c]) => {
        const n = RULE[op](c.l, c.r); for (let j = 0; j < n; j++) res.push(kk); H.forEach((x) => { x.st = x === c ? (n ? 'out' : 'zero') : x.st === 'out' || x.st === 'zero' ? x.st : ''; });
        snap({ why: `Group ${kk}: l = ${c.l}, r = ${c.r}. Rule ${RTXT[op]} → emit ${n} cop${n === 1 ? 'y' : 'ies'}.` });
      });
    }
    return out;
  }
  const cell = (v) => el('td', { class: v === 'NULL' ? 'nul' : '', text: v });
  function render(upto) {
    const s = upto ? steps[upto - 1] : null;
    const pos = (side, i) => { if (!s) return ''; const curA = s.side === 'A'; const curB = s.side === 'B';
      if (s.side == null) return 'done';
      if (side === 'A') return curA ? (i === s.i ? 'cur' : i < s.i ? 'done' : '') : 'done';
      return curB ? (i === s.i ? 'cur' : i < s.i ? 'done' : '') : ''; };
    const list = (t, arr, side) => el('div', null, el('h5', { text: t }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'x' }))), el('tbody', null, arr.map((v, i) => el('tr', { class: pos(side, i) }, cell(key(v)))))));
    const ht = op === 'UNION ALL' ? el('div', null, el('h5', { text: 'no hash table' }), el('p', { class: 'tiny', text: 'UNION ALL is a plain Append: rows stream through in order, nothing is remembered.' }))
      : el('div', null, el('h5', { text: 'hash table' }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'value' }), el('th', { text: 'l (A)' }), el('th', { text: 'r (B)' }))),
        el('tbody', null, (s ? s.H : []).map(([kk, l, r, st]) => el('tr', { class: st }, cell(kk), el('td', { text: String(l) }), el('td', { text: String(r) }))))));
    const res = s ? s.res : [];
    const outT = el('div', null, el('h5', { text: 'output' }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'x' }))), el('tbody', null, res.map((v, i) => { const tr = el('tr', null, cell(v)); if (i === res.length - 1 && !reduced) tr.className = 'fresh'; return tr; }))));
    grid.innerHTML = ''; grid.append(list('A', A, 'A'), list('B', B, 'B'), ht, outT);
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `rows in <b>${A.length + B.length}</b>` }), el('span', { class: 'w-stat', html: `rows out <b>${res.length}</b>` }),
      el('span', { class: 'w-stat', html: `hash entries <b>${op === 'UNION ALL' ? 0 : s ? s.H.length : 0}</b>` }), el('span', { class: 'w-stat', html: `plan <b>${NODE[op]}</b>` }));
  }
  function say(n, t) { narr.firstChild.textContent = String(n); narr.replaceChild(el('div', { class: 't', text: t }), narr.lastChild); }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = build(); render(0); bStep.disabled = false;
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(`SELECT x FROM a   -- {1,1,1,2,2,3,NULL}\n${op}\nSELECT x FROM b;  -- {1,1,2,NULL,4}`, 'sql') }));
    say(0, op === 'UNION ALL' ? 'UNION ALL just concatenates. Press Play.' : op === 'UNION' ? 'UNION hashes every row and emits only the first copy. Press Play.' : `${op}: first count every row per side, then emit by the rule “${RTXT[op]}”. Press Play.`);
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; render(k); say(k, s.why);
    if (k >= steps.length) { bStep.disabled = true; say(k, s.why + ` Done: ${s.res.length} rows out of ${A.length + B.length}.${op !== 'UNION ALL' ? ' Output order follows the hash table, not the input: add ORDER BY if you care.' : ''}`); }
    return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
