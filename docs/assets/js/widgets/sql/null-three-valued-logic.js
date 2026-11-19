/* NULL & three-valued logic: expand IN / NOT IN / NOT EXISTS term by term and watch UNKNOWN poison the result. */
IA.widget('null-three-valued-logic', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-n3v-css')) document.head.append(el('style', { id: 'w-n3v-css', text: `
.w-n3v-expr{display:flex;flex-wrap:wrap;align-items:center;gap:6px;justify-content:center;margin:12px 0;font-family:var(--mono);font-size:13px}
.w-n3v-term{border:1px solid var(--border);border-radius:8px;padding:6px 8px;background:var(--surface);display:flex;flex-direction:column;align-items:center;gap:4px;min-width:74px;transition:all .3s}
.w-n3v-term.cur{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.w-n3v-op{color:var(--text-3);font-weight:700}
.w-n3v-v{font-size:11.5px;font-weight:700;border-radius:999px;padding:1px 8px;border:1px solid var(--border);color:var(--text-3)}
.w-n3v-v.T{color:var(--ok);border-color:var(--ok)}
.w-n3v-v.F{color:var(--err);border-color:var(--err)}
.w-n3v-v.U{color:var(--warn);border-color:var(--warn);background:color-mix(in srgb,var(--warn) 12%,transparent)}
.w-n3v-res{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center;margin:6px 0 4px}
.w-n3v-big{font-family:var(--mono);font-size:15px;padding:6px 14px;border-radius:10px;border:2px solid var(--border);color:var(--text-3)}
.w-n3v-big.T{border-color:var(--ok);color:var(--ok)}.w-n3v-big.F{border-color:var(--err);color:var(--err)}.w-n3v-big.U{border-color:var(--warn);color:var(--warn)}` }));
  let op = 'notin'; let hasNull = 'yes'; let probe = '3'; let gen = 0; let k = 0; let running = false; let speed = 2400; let steps = [];
  const seg = (opts, cur, on) => { const s = el('div', { class: 'seg' }); opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segO = seg([['in', 'x IN (…)'], ['notin', 'x NOT IN (…)'], ['notexists', 'NOT EXISTS (…)']], op, (v) => { op = v; reset(); });
  const segN = seg([['yes', 'list: 1, 2, NULL'], ['no', 'list: 1, 2']], hasNull, (v) => { hasNull = v; reset(); });
  const segP = seg([['3', 'x = 3'], ['1', 'x = 1'], ['null', 'x = NULL']], probe, (v) => { probe = v; reset(); });
  const sqlBox = el('div', { class: 'codebox' });
  const expr = el('div', { class: 'w-n3v-expr' });
  const res = el('div', { class: 'w-n3v-res' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const num = el('span', { class: 'n', text: '0' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, num, el('div', { class: 't' }));
  const say = (h) => cap.replaceChild(el('div', { class: 't', html: h }), cap.lastChild);
  root.append(el('div', { class: 'w-controls' }, segO), el('div', { class: 'w-controls' }, segN, segP), sqlBox, expr, res,
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), cap);
  const NAME = { T: 'TRUE', F: 'FALSE', U: 'UNKNOWN' };
  const eq = (a, b) => (a == null || b == null ? 'U' : a === b ? 'T' : 'F');
  const not = (v) => (v === 'T' ? 'F' : v === 'F' ? 'T' : 'U');
  const and = (a, b) => (a === 'F' || b === 'F' ? 'F' : a === 'U' || b === 'U' ? 'U' : 'T');
  const or = (a, b) => (a === 'T' || b === 'T' ? 'T' : a === 'U' || b === 'U' ? 'U' : 'F');
  const fmt = (v) => (v == null ? 'NULL' : String(v));
  let terms = [];
  function plan() {
    const x = probe === 'null' ? null : +probe; const L = hasNull === 'yes' ? [1, 2, null] : [1, 2];
    const s = [];
    const list = L.map(fmt).join(', ');
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(op === 'notexists' ? `SELECT ${fmt(x)} AS x\nWHERE NOT EXISTS (SELECT 1 FROM (VALUES ${L.map((v) => '(' + (v == null ? 'NULL::int' : v) + ')').join(', ')}) l(v)\n                  WHERE l.v = ${fmt(x)});` : `SELECT ${fmt(x)} AS x\nWHERE ${fmt(x)} ${op === 'in' ? 'IN' : 'NOT IN'} (${list});`, 'sql') }));
    expr.innerHTML = ''; res.innerHTML = '';
    terms = L.map((v, i) => {
      const val = el('span', { class: 'w-n3v-v', text: '?' });
      const t = el('div', { class: 'w-n3v-term' }, el('span', { text: op === 'notin' ? `${fmt(x)} <> ${fmt(v)}` : op === 'in' ? `${fmt(x)} = ${fmt(v)}` : `v=${fmt(v)}: ${fmt(v)} = ${fmt(x)}` }), val);
      if (i && op !== 'notexists') expr.append(el('span', { class: 'w-n3v-op', text: op === 'in' ? 'OR' : 'AND' }));
      expr.append(t); return { t, val, v };
    });
    const intro = op === 'notin' ? `<code>${fmt(x)} NOT IN (${list})</code> is shorthand for <code>${L.map((v) => fmt(x) + ' &lt;&gt; ' + fmt(v)).join(' AND ')}</code>.`
      : op === 'in' ? `<code>${fmt(x)} IN (${list})</code> is shorthand for <code>${L.map((v) => fmt(x) + ' = ' + fmt(v)).join(' OR ')}</code>.`
      : 'NOT EXISTS runs the subquery and asks one question: did <b>any</b> row come back? A row only comes back when its WHERE is TRUE.';
    s.push({ cap: intro, run: () => {} });
    let acc = op === 'notin' ? 'T' : 'F'; let found = false;
    L.forEach((v, i) => {
      const r = op === 'notin' ? not(eq(x, v)) : eq(x, v);
      const before = acc;
      if (op === 'notin') acc = and(acc, r); else if (op === 'in') acc = or(acc, r); else if (r === 'T') found = true;
      const why = r === 'U' ? `Comparing with NULL gives <b>UNKNOWN</b>, never TRUE or FALSE. NULL means “some value we don’t know”: it might be ${fmt(x)}, it might not.`
        : `<code>${fmt(x)} ${op === 'notin' ? '&lt;&gt;' : '='} ${fmt(v)}</code> is <b>${NAME[r]}</b>.`;
      const comb = op === 'notexists' ? (r === 'T' ? ' A row is returned, so EXISTS is satisfied.' : ' No row returned for this value: UNKNOWN counts as “not matched”.')
        : ` Running ${op === 'in' ? 'OR' : 'AND'}: ${NAME[before]} ${op === 'in' ? 'OR' : 'AND'} ${NAME[r]} = <b>${NAME[acc]}</b>.`;
      s.push({ cap: why + comb, run: () => { terms.forEach((q) => q.t.classList.remove('cur')); terms[i].t.classList.add('cur'); terms[i].val.textContent = NAME[r]; terms[i].val.className = 'w-n3v-v ' + r; } });
    });
    const final = op === 'notexists' ? (found ? 'F' : 'T') : acc;
    const keep = final === 'T';
    let fin;
    if (op === 'notin' && final === 'U') fin = 'TRUE AND … AND UNKNOWN can never become TRUE. One NULL in the list makes NOT IN return <b>UNKNOWN for every value not in the list</b>, so it returns no rows at all.';
    else if (op === 'notexists') fin = found ? 'A match exists, so NOT EXISTS is FALSE: row dropped.' : 'No subquery row came back, so NOT EXISTS is <b>TRUE</b>. NULLs in the list can’t poison it. This is why NOT EXISTS is the safe anti-join.';
    else if (op === 'in' && final === 'U') fin = 'IN gives UNKNOWN here, but WHERE treats it like FALSE, so the result is the same as “not found”. IN is mostly harmless; its negation is the trap.';
    else fin = `Result is <b>${NAME[final]}</b>.`;
    s.push({ cap: fin + (keep ? ' WHERE keeps the row.' : ` WHERE keeps only TRUE, so the row is <b>dropped</b>.${final === 'U' ? ' (A CHECK constraint, by contrast, passes on UNKNOWN.)' : ''}`), run: () => {
      terms.forEach((q) => q.t.classList.remove('cur'));
      res.innerHTML = ''; res.append(el('span', { class: 'w-n3v-big ' + final, text: NAME[final] }), el('span', { class: 'w-n3v-big ' + (keep ? 'T' : 'F'), text: keep ? 'WHERE: row kept' : 'WHERE: row dropped' }));
    } });
    return s;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan();
    num.textContent = '0/' + steps.length; bStep.disabled = false;
    say('Pick an operator, the list and x, then press Play to evaluate it term by term in three-valued logic.');
  }
  function step() { if (k >= steps.length) return false; const s = steps[k++]; s.run(); say(s.cap); num.textContent = k + '/' + steps.length; if (k >= steps.length) bStep.disabled = true; return true; }
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
