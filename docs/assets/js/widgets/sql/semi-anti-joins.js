/* Semi / anti joins: per-comparison probe animation with early exit and the NOT IN three-valued-logic trap. */
IA.widget('semi-anti-joins', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-saj-css')) document.head.append(el('style', { id: 'w-saj-css', text: `
.w-saj-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
@media (max-width: 560px) { .w-saj-grid { grid-template-columns: 1fr; } }
.w-saj table { border-collapse: collapse; font-family: var(--mono); font-size: 12.5px; width: 100%; }
.w-saj td, .w-saj th { border: 1px solid var(--border); padding: 5px 8px; text-align: left; }
.w-saj th { background: var(--surface-2); color: var(--text-3); font-weight: 600; }
.w-saj h5 { margin: 0 0 4px; font-family: var(--mono); font-size: 13px; }
.w-saj tr.cur td { background: var(--accent-soft); }
.w-saj tr.t td { background: color-mix(in srgb, var(--ok) 22%, transparent); }
.w-saj tr.f td { background: var(--surface-2); color: var(--text-3); }
.w-saj tr.u td { background: color-mix(in srgb, var(--warn) 26%, transparent); }
.w-saj tr.skip td { opacity: .3; text-decoration: line-through; }
.w-saj .nul { color: var(--err); font-style: italic; }
.w-saj .v-k { color: var(--ok); font-weight: 700; } .w-saj .v-d { color: var(--err); font-weight: 700; } .w-saj .v-u { color: var(--warn); font-weight: 700; }
.w-saj .plan { font-family: var(--mono); font-size: 12px; white-space: pre; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; overflow-x: auto; color: var(--text-2); margin-top: 10px; }
.w-saj .plan b { color: var(--accent); }
` }));
  const C = [[1, 'Asha'], [2, 'Ben'], [3, 'Chen'], [4, 'Dina']];
  const O0 = [[101, 1], [102, 2], [103, 1], [104, null]];
  const MODES = {
    EXISTS: { sql: 'WHERE EXISTS (SELECT 1 FROM orders o\n              WHERE o.customer_id = c.id)', plan: '<b>Hash Semi Join</b>\n  Hash Cond: (c.id = o.customer_id)\n  ->  Seq Scan on customers c\n  ->  Hash  ->  Seq Scan on orders o\n-- small outer + index: Nested Loop Semi Join', },
    IN: { sql: 'WHERE c.id IN (SELECT customer_id FROM orders)', plan: '<b>Hash Semi Join</b>   (same as EXISTS)\n  Hash Cond: (c.id = orders.customer_id)\n-- or: HashAggregate (unique-ify) + Hash Join' },
    'NOT EXISTS': { sql: 'WHERE NOT EXISTS (SELECT 1 FROM orders o\n                  WHERE o.customer_id = c.id)', plan: '<b>Hash Anti Join</b>   (PG16+: Hash Right Anti Join\n                    when customers is smaller)\n  Hash Cond: (o.customer_id = c.id)' },
    'NOT IN': { sql: 'WHERE c.id NOT IN (SELECT customer_id FROM orders)', plan: 'Seq Scan on customers c\n  Filter: (NOT (ANY (id = (<b>hashed SubPlan 1</b>).col1)))\n  SubPlan 1  ->  Seq Scan on orders\n-- never an anti join; past work_mem: plain SubPlan,\n-- rescanned for EVERY customer' },
    'LEFT JOIN': { sql: 'LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL', plan: '<b>Hash Right Join</b>\n  Hash Cond: (o.customer_id = c.id)\n  Filter: (o.id IS NULL)\n-- testing o.customer_id IS NULL instead gets Hash Anti Join' }
  };
  let mode = 'NOT IN'; let guest = true; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (label, opts, cur, pick) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); pick(v); }); s.append(b); }); return s; };
  const segM = seg('Form', Object.keys(MODES).map((m) => [m, m === 'LEFT JOIN' ? 'LEFT JOIN … IS NULL' : m]), mode, (v) => { mode = v; reset(); });
  const segG = seg('Guest order', [[true, 'guest order 104 has customer_id NULL'], [false, 'no NULLs']], guest, (v) => { guest = v; reset(); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const tables = el('div', { class: 'w-saj-grid' }); const plan = el('div', { class: 'plan' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: '' }));
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-saj');
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-controls' }, segG), sqlBox, el('div', { class: 'w-stage' }, tables, plan),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  const O = () => guest ? O0 : O0.slice(0, 3);
  function build() {
    const os = O(); const out = [];
    const neg = mode === 'NOT IN' || mode === 'NOT EXISTS' || mode === 'LEFT JOIN';
    C.forEach(([id, name], ci) => {
      let sawU = false; let hit = 0;
      for (let j = 0; j < os.length; j++) {
        const cid = os[j][1]; const isNull = cid == null; const eq = !isNull && cid === id;
        let res; let why;
        if (mode === 'NOT IN') { res = isNull ? 'u' : eq ? 'f' : 't'; why = `${id} <> ${isNull ? 'NULL' : cid} is ${isNull ? 'UNKNOWN' : eq ? 'false' : 'true'}.`; }
        else if (mode === 'IN') { res = isNull ? 'u' : eq ? 't' : 'f'; why = `${id} = ${isNull ? 'NULL' : cid} is ${isNull ? 'UNKNOWN' : eq ? 'true' : 'false'}.`; }
        else { res = eq ? 't' : 'f'; why = `o.customer_id = ${id}? ${isNull ? 'NULL = ' + id + ' is unknown, which the inner WHERE treats as no match.' : eq ? 'Yes: a match.' : 'No.'}`; }
        if (res === 'u') sawU = true; if (eq) hit++;
        const s = { ci, j, res, why, done: null };
        const stop = (mode === 'NOT IN' && eq) || (mode !== 'NOT IN' && mode !== 'LEFT JOIN' && eq);
        const last = stop || j === os.length - 1;
        if (last) {
          let v; let tail;
          if (mode === 'EXISTS' || mode === 'IN') { v = eq ? 'k' : (mode === 'IN' && sawU ? 'u' : 'd'); tail = eq ? `First match, so ${name} is kept${j < os.length - 1 ? ' and the remaining orders are never read (early exit)' : ''}.` : v === 'u' ? `No match, but a NULL was seen: IN is UNKNOWN. WHERE drops it, same as false, so the positive form is safe.` : `No match: ${name} is dropped.`; }
          else if (mode === 'NOT EXISTS') { v = eq ? 'd' : 'k'; tail = eq ? `A match exists, so ${name} is dropped${j < os.length - 1 ? '. Early exit: the rest is skipped' : ''}.` : `No order matched ${name}, so the anti join keeps the row. The NULL row simply never matches.`; }
          else if (mode === 'NOT IN') { v = eq ? 'd' : sawU ? 'u' : 'k'; tail = eq ? `Found ${id} in the list: NOT IN is false, ${name} is dropped (early exit).` : sawU ? `true AND … AND UNKNOWN = UNKNOWN. ${name} has no orders, yet WHERE drops her.` : `All comparisons true: ${name} is kept.`; }
          else { v = hit ? 'd' : 'k'; tail = hit ? `The join emitted ${hit} row${hit > 1 ? 's' : ''} for ${name} (no early exit: it needs every match), then WHERE o.id IS NULL throws ${hit > 1 ? 'them' : 'it'} away.` : `No match: one NULL-padded row, o.id IS NULL is true, ${name} is kept.`; }
          s.done = v; s.why = why + ' ' + tail; s.skipFrom = j + 1;
          out.push(s); break;
        }
        out.push(s);
      }
    });
    out.neg = neg; return out;
  }
  function render(upto) {
    const os = O(); const verdict = {}; let cmp = 0; let cur = null;
    for (let i = 0; i < upto; i++) { const s = steps[i]; cmp++; if (s.done) verdict[s.ci] = s.done; cur = s; }
    const cell = (v) => v == null ? el('td', { class: 'nul', text: 'NULL' }) : el('td', { text: String(v) });
    const vTxt = { k: ['v-k', '✓ kept'], d: ['v-d', '✗ dropped'], u: ['v-u', '? unknown → dropped'] };
    const ct = el('tbody'); C.forEach(([id, name], ci) => { const v = verdict[ci];
      ct.append(el('tr', { class: cur && cur.ci === ci ? 'cur' : '' }, cell(id), cell(name), v ? el('td', { class: vTxt[v][0], text: vTxt[v][1] }) : el('td', { text: '' }))); });
    const ot = el('tbody'); os.forEach(([oid, cid], j) => { let cls = '';
      if (cur) { if (cur.j === j) cls = cur.res; else if (cur.done && cur.skipFrom <= j) cls = 'skip'; }
      ot.append(el('tr', { class: cls, style: cur && cur.j === j && !reduced ? { animation: 'capin .35s ease both' } : null }, cell(oid), cell(cid))); });
    tables.innerHTML = '';
    tables.append(el('div', null, el('h5', { text: 'customers c (outer)' }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'id' }), el('th', { text: 'name' }), el('th', { text: 'verdict' }))), ct)),
      el('div', null, el('h5', { text: 'orders (probed)' }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'id' }), el('th', { text: 'customer_id' }))), ot)));
    const kept = C.filter((_, ci) => verdict[ci] === 'k').map(([, n]) => n);
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `comparisons <b>${cmp}</b> / ${C.length * os.length} possible` }),
      el('span', { class: 'w-stat', html: `result <b>${kept.length ? kept.join(', ') : '∅'}</b>` }));
  }
  function say(n, t) { narr.firstChild.textContent = String(n); const d = el('div', { class: 't', text: t }); narr.replaceChild(d, narr.lastChild); }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = build(); render(0); bStep.disabled = false;
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight('SELECT c.* FROM customers c\n' + MODES[mode].sql + ';', 'sql') }));
    plan.innerHTML = '-- EXPLAIN shape (PG17/18)\n' + MODES[mode].plan;
    say(0, mode === 'NOT IN' && guest ? 'NOT IN means “<> every element, ANDed”. Watch what the NULL does. Press Play.' : 'Press Play or Step: one comparison per step, outer loop over customers.');
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; render(k); say(k, s.why);
    if (k >= steps.length) { bStep.disabled = true; const kept = new Set(steps.filter((x) => x.done === 'k').map((x) => x.ci));
      const extra = mode === 'NOT IN' && guest ? ' Chen and Dina have no orders but are lost: switch to NOT EXISTS, or remove the NULL.' : mode === 'LEFT JOIN' ? ' Correct, but every match was materialized first.' : '';
      say(k, s.why + ` Done: ${kept.size} row${kept.size === 1 ? '' : 's'}, ${k} comparisons.` + extra); }
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
