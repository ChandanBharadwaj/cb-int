/* Window ranking: rows stay; partition, sort, then number each row with ROW_NUMBER / RANK / DENSE_RANK / NTILE side by side. */
IA.widget('window-ranking', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-win-css')) document.head.append(el('style', { id: 'w-win-css', text: `
.w-win table { border-collapse: collapse; font-family: var(--mono); font-size: 12.5px; width: 100%; min-width: 440px; }
.w-win td, .w-win th { border: 1px solid var(--border); padding: 5px 8px; text-align: left; transition: background .3s; }
.w-win th { background: var(--surface-2); color: var(--text-3); font-weight: 600; }
.w-win tr.p-eng td:first-child { box-shadow: inset 4px 0 0 var(--accent); }
.w-win tr.p-ops td:first-child { box-shadow: inset 4px 0 0 var(--warn); }
.w-win tr.p-sales td:first-child { box-shadow: inset 4px 0 0 var(--ok); }
.w-win tr.p-all td:first-child { box-shadow: inset 4px 0 0 var(--text-3); }
.w-win tr.gap td { border-top: 3px solid var(--border); }
.w-win tr.cur td { background: var(--accent-soft); }
.w-win td.tie { background: color-mix(in srgb, var(--warn) 24%, transparent); }
.w-win td.nd { color: var(--err); font-weight: 700; }
.w-win td.num { font-weight: 700; }
.w-win tr.mv { animation: capin .4s ease both; }
` }));
  const E = [[5, 'Ed', 'ops', 80], [1, 'Ana', 'eng', 120], [8, 'Hal', 'sales', 70], [3, 'Cy', 'eng', 100], [7, 'Gu', 'ops', 75], [2, 'Bo', 'eng', 120], [6, 'Fi', 'ops', 75], [4, 'Di', 'eng', 90]];
  let part = true; let tie = true; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (label, opts, cur, pick) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); pick(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } }); const host = el('div', { class: 'tscroll' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-win');
  root.append(el('div', { class: 'w-controls' }, seg('Partition', [[true, 'PARTITION BY dept'], [false, 'no PARTITION BY']], part, (v) => { part = v; reset(); }),
    seg('Tiebreaker', [[true, 'ORDER BY salary DESC, id'], [false, 'ORDER BY salary DESC (no tiebreaker)']], tie, (v) => { tie = v; reset(); })),
    sqlBox, el('div', { class: 'w-stage' }, host),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; })), narr, stats);
  const pk = (r) => (part ? r[2] : 'all');
  function sorted() {
    const order = { eng: 0, ops: 1, sales: 2, all: 0 };
    return E.slice().sort((a, b) => order[pk(a)] - order[pk(b)] || b[3] - a[3] || a[0] - b[0]);
  }
  function build() {
    const out = []; const S = sorted(); const nums = new Map();
    out.push({ order: E, why: 'Input rows, in heap order. Nothing has been grouped or sorted yet.' });
    const parts = [...new Set(S.map(pk))];
    out.push({ order: E.slice().sort((a, b) => parts.indexOf(pk(a)) - parts.indexOf(pk(b))), grouped: true, why: part ? `PARTITION BY dept splits the rows into ${parts.length} partitions. Unlike GROUP BY, nothing is merged: all 8 rows are still here.` : 'No PARTITION BY: the whole table is one partition. Numbering will run across all departments.' });
    out.push({ order: S, grouped: true, why: `Sort inside each partition by salary DESC${tie ? ', then id' : ''}. This is the order the numbers follow; it does not decide the final output order.` });
    const pos = {}; S.forEach((r, i) => {
      const p = pk(r); const peers = S.filter((x) => pk(x) === p); const idx = peers.indexOf(r); pos[p] = idx;
      const rn = idx + 1; const rank = peers.filter((x) => x[3] > r[3]).length + 1; const dense = new Set(peers.filter((x) => x[3] > r[3]).map((x) => x[3])).size + 1;
      const n = peers.length; const q = Math.floor(n / 2); const rem = n % 2; const nt = idx < (q + 1) * rem ? Math.floor(idx / (q + 1)) + 1 : Math.floor((idx - rem) / Math.max(q, 1)) + 1;
      const tied = peers.filter((x) => x[3] === r[3]).length > 1;
      nums.set(r[0], { rn, rank, dense, nt, tied, nd: tied && !tie });
      let why = `${r[1]} (${r[3]}) is row ${rn} of partition ${p}: ROW_NUMBER ${rn}, RANK ${rank}, DENSE_RANK ${dense}, NTILE(2) ${nt}.`;
      if (tied && rank !== rn) why += ` Tie with ${peers.filter((x) => x[3] === r[3] && x !== r).map((x) => x[1]).join(', ')}: RANK repeats ${rank} and will leave a gap; DENSE_RANK repeats ${dense} without a gap.`;
      if (tied && !tie) why += ' No tiebreaker: which tied row gets which ROW_NUMBER is up to the sort. Another run may swap them.';
      if (!tied && rank > rn - 0 && rank !== rn) why += '';
      if (!tied && idx > 0 && rank !== dense) why += ` RANK jumps to ${rank} (the tie above used up ${rank - dense} number${rank - dense > 1 ? 's' : ''}); DENSE_RANK continues at ${dense}.`;
      out.push({ order: S, grouped: true, cur: r[0], nums: new Map(nums), why });
    });
    return out;
  }
  function render(upto) {
    const s = steps[Math.max(0, upto - 1)]; const prev = upto > 1 ? steps[upto - 2] : null;
    const moved = prev && prev.order !== s.order;
    const tb = el('tbody'); let last = null;
    s.order.forEach((r) => { const n = s.nums && s.nums.get(r[0]); const p = pk(r);
      const cls = [s.grouped ? 'p-' + p : '', s.grouped && last != null && last !== p ? 'gap' : '', s.cur === r[0] ? 'cur' : '', moved && !reduced ? 'mv' : ''].join(' '); last = p;
      const c = (v, extra) => el('td', { class: 'num ' + (extra || ''), text: v == null ? '' : String(v) });
      tb.append(el('tr', { class: cls }, el('td', { text: r[2] }), el('td', { text: r[1] }), el('td', { text: String(r[3]) }),
        c(n && (n.nd ? n.rn + ' ?' : n.rn), n && n.nd ? 'nd' : ''), c(n && n.rank, n && n.tied ? 'tie' : ''), c(n && n.dense, n && n.tied ? 'tie' : ''), c(n && n.nt))); });
    host.innerHTML = ''; host.append(el('table', null, el('thead', null, el('tr', null, ['dept', 'name', 'salary', 'row_number', 'rank', 'dense_rank', 'ntile(2)'].map((h) => el('th', { text: h })))), tb));
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: 'rows in <b>8</b>' }), el('span', { class: 'w-stat', html: 'rows out <b>8</b>' }), el('span', { class: 'w-stat', html: `GROUP BY dept would give <b>${part ? 3 : 1}</b>` }));
  }
  function say(n, t) { narr.firstChild.textContent = String(n); narr.replaceChild(el('div', { class: 't', text: t }), narr.lastChild); }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = build(); render(0); bStep.disabled = false;
    const w = `${part ? 'PARTITION BY dept ' : ''}ORDER BY salary DESC`;
    const sql = `SELECT dept, name, salary,\n  row_number() OVER (${w}${tie ? ', id' : ''}),\n  rank()       OVER (${w}),\n  dense_rank() OVER (${w}),\n  ntile(2)     OVER (${w}${tie ? ', id' : ''})\nFROM employees;`;
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(sql, 'sql') }));
    say(0, 'Logical order: FROM → WHERE → GROUP BY → HAVING → window functions → SELECT → ORDER BY. Press Play.');
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; render(k); say(k, s.why);
    if (k >= steps.length) { bStep.disabled = true; say(k, s.why + (tie ? ' Done: 8 rows in, 8 out. To keep only rank 1, wrap this in a subquery: WHERE runs too early.' : ' Done. The red “?” cells are the non-determinism: add a unique tiebreaker (id).')); }
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
