/* Pruning explorer: pick a WHERE clause, see which partitions are scanned and when they are pruned (outcomes taken from real PG plans on the playground). */
IA.widget('partitioning-pruning', (root, ctx) => {
  const { el } = ctx;
  if (!document.getElementById('w-part-x-css')) document.head.append(el('style', { id: 'w-part-x-css', text: `
.w-part-x-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 10px 0; }
.w-part-x-cell { border: 1.5px solid var(--border); border-radius: 8px; padding: 8px 4px; text-align: center; font-size: 12.5px; background: var(--surface); transition: all .3s; }
.w-part-x-cell.scan { border-color: var(--ok); background: var(--accent-soft); font-weight: 700; }
.w-part-x-cell.run { border-color: var(--warn); border-style: dashed; }
.w-part-x-cell.off { opacity: .35; }
.w-part-x-cell small { display: block; color: var(--text-3); font-weight: 400; margin-top: 3px; }` }));
  const NAMES = ['2025_01', '2025_02', '2025_03', '2025_04', 'default'];
  // s = scanned, r = in plan but skipped at run time, x = pruned at plan time
  const C = [
    { l: 'one day in March', w: "created_at >= '2025-03-05' AND created_at < '2025-03-06'", p: 'xxsxx', when: 'Plan time', why: 'Constants on the bare key: only March can match.' },
    { l: 'open-ended range', w: "created_at >= '2025-03-15'", p: 'xxsss', when: 'Plan time', why: 'March and April match, and the <b>default</b> partition is kept too: it could hold any date after April.' },
    { l: 'across a boundary', w: "created_at BETWEEN '2025-01-31' AND '2025-02-01'", p: 'ssxxx', when: 'Plan time', why: 'Two partitions overlap the range. The default is excluded because both bounds are inside defined partitions.' },
    { l: 'function on the key', w: "date_trunc('month', created_at) = '2025-03-01'", p: 'sssss', when: 'No pruning', why: 'Pruning cannot reason through a function. Rewrite it as a range on the bare column.' },
    { l: 'no key at all', w: 'tenant_id = 7', p: 'sssss', when: 'No pruning', why: 'Every partition’s index on (tenant_id, created_at) is searched. Add a time window to the query.' },
    { l: 'subquery value', w: "created_at >= (SELECT timestamptz '2025-04-10')", p: 'rrrss', when: 'Run time', why: 'The value is known only during execution. The plan lists all partitions; three show <code>(never executed)</code>.' },
    { l: 'generic plan $1', w: 'created_at = $1   -- EXECUTE q(\'2025-02-10\')', p: 'rsrrr', when: 'Executor start', why: 'A generic plan contains all partitions; when it starts, Postgres prunes using the parameter and EXPLAIN shows <code>Subplans Removed: 4</code>.' }
  ];
  let cur = 0;
  const seg = el('div', { class: 'seg' }); const code = el('div', { class: 'codebox' }); const grid = el('div', { class: 'w-part-x-grid' }); const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  C.forEach((c, i) => { const b = el('button', { text: c.l, class: i === cur ? 'on' : '' }); b.addEventListener('click', () => { cur = i; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); draw(); }); seg.append(b); });
  root.append(el('div', { class: 'w-controls' }, seg), code, grid, cap, el('div', { class: 'tiny', text: 'green = scanned · dashed = in the plan but skipped at run time · faded = pruned at plan time' }));
  function draw() {
    const c = C[cur]; code.innerHTML = ''; code.append(el('pre', { html: IA.highlight('SELECT count(*) FROM events\nWHERE ' + c.w + ';', 'sql') }));
    grid.innerHTML = ''; NAMES.forEach((n, i) => { const s = c.p[i]; grid.append(el('div', { class: 'w-part-x-cell ' + (s === 's' ? 'scan' : s === 'r' ? 'run off' : 'off') }, n, el('small', { text: s === 's' ? 'scanned' : s === 'r' ? 'skipped' : 'pruned' }))); });
    const n = [...c.p].filter((x) => x === 's').length;
    cap.firstChild.innerHTML = `<b>${c.when}</b>: ${n} of 5 partitions scanned. ${c.why}`;
  }
  draw();
});
