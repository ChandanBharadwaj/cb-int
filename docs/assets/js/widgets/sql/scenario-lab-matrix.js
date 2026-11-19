/* Cheat sheet for the 12 scenarios: sortable, filterable, answers hidden until the reader asks. */
IA.widget('scenario-lab-matrix', (root, ctx) => {
  const { el } = ctx;
  const OPT = ['Postgres', 'Postgres + Redis', 'DynamoDB / Cassandra', 'MongoDB', 'Elasticsearch', 'Neo4j', 'TimescaleDB / ClickHouse', 'Distributed SQL', 'Columnar warehouse', 'Postgres + pgvector'];
  const S = (IA.scenarioLab || []).map((s, i) => ({ n: i + 1, title: s.title, deciding: s.facts[0], pick: OPT[s.pick], pickText: s.pickText, risk: s.tenx[0], pg: [0, 1, 6, 9].includes(s.pick) })); // TimescaleDB counts as Postgres-based (extension)
  let show = false, q = '', fam = 'all', sortK = 'n', dir = 1;
  const tog = el('button', { class: 'btn', text: '👁 Show answers' });
  tog.addEventListener('click', () => { show = !show; tog.textContent = show ? '🙈 Hide answers' : '👁 Show answers'; paint(); });
  const seg = el('div', { class: 'seg', 'aria-label': 'Filter by pick' });
  [['all', 'All'], ['pg', 'Postgres-based'], ['other', 'Specialist primary']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === fam ? 'on' : '' }); b.addEventListener('click', () => { fam = v; if (v !== 'all' && !show) tog.click(); [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); paint(); }); seg.append(b); });
  const inp = el('input', { type: 'search', placeholder: 'Filter…', 'aria-label': 'Filter', style: { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text)', maxWidth: '100%' } });
  inp.addEventListener('input', () => { q = inp.value.toLowerCase(); paint(); });
  const host = el('div', { class: 'tscroll' });
  root.append(el('div', { class: 'w-controls' }, tog, seg, inp), host);
  const COLS = [['n', '#'], ['title', 'Scenario'], ['deciding', 'Key number'], ['pick', 'Primary pick'], ['risk', 'First thing to break at 10×']];
  function paint() {
    const rows = S.filter((s) => (fam === 'all' || (fam === 'pg') === s.pg) && (!q || (show ? Object.values(s).join(' ') : s.title + ' ' + s.deciding).toLowerCase().includes(q)))
      .sort((a, b) => (typeof a[sortK] === 'number' ? a[sortK] - b[sortK] : String(a[sortK]).localeCompare(String(b[sortK]))) * dir);
    const ths = COLS.map(([key, h]) => { const th = el('th', { text: h + (key === sortK ? (dir > 0 ? ' ▲' : ' ▼') : ''), tabindex: '0', style: { cursor: 'pointer' } }); const go = () => { if (sortK === key) dir = -dir; else { sortK = key; dir = 1; } paint(); }; th.addEventListener('click', go); th.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); return th; });
    host.innerHTML = ''; host.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, ths)), el('tbody', null, rows.map((s) => el('tr', null,
      el('td', { text: String(s.n) }), el('td', { html: `<b>${s.title}</b>` }), el('td', { html: s.deciding }),
      el('td', { html: show ? s.pickText : '<span class="tiny">hidden</span>' }), el('td', { html: show ? s.risk : '<span class="tiny">hidden</span>' }))))));
  }
  paint();
});
