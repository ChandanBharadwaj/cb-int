/* Beginner intro: each everyday question lights up the database family built for it. */
IA.widget('sql-vs-nosql-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-svni-style')) document.head.append(el('style', { id: 'w-svni-style', html: `
.w-svni-q { font-size: 15px; font-weight: 600; min-height: 26px; text-align: center; margin-bottom: 10px; }
.w-svni-fams { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.w-svni-f { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; font-size: 13px; background: var(--surface); transition: all .3s; text-align: center; }
.w-svni-f small { display: block; color: var(--text-3); font-size: 11px; }
.w-svni-f.on { border-color: var(--accent); background: var(--accent-soft); transform: translateY(-3px); }
` }));
  const FAM = [['📄', 'Document'], ['🔑', 'Key-value'], ['🧱', 'Wide-column'], ['🕸️', 'Graph'], ['🔎', 'Search'], ['⏱️', 'Time-series'], ['🧭', 'Vector'], ['🐘', 'SQL']];
  const QS = [
    ['“Load order 42 with all its items”', 0, 'A document holds the whole order in one piece.'],
    ['“Get the session for token abc123”', 1, 'You have the exact key: a key-value store answers instantly.'],
    ['“Friends of my friends who like jazz”', 3, 'Hopping along connections is what graphs do.'],
    ['“Products matching ‘red runing shoes’” (typo!)', 4, 'Word lookup with stemming and typo tolerance: a search index.'],
    ['“Average temperature per hour, last week”', 5, 'Time-range scans and rollups: time-series.'],
    ['“Help articles similar to this question”', 6, 'Similarity of meaning: nearest vectors.'],
    ['“Revenue by region and plan, excluding refunds”', 7, 'An ad-hoc question with joins and filters: SQL.']
  ];
  const fams = FAM.map(([i, n]) => el('div', { class: 'w-svni-f' }, i, el('small', { text: n })));
  const q = el('div', { class: 'w-svni-q', 'aria-live': 'polite', text: 'Seven questions, seven families.' });
  const cap = el('div', { class: 'caption' }, el('div', { class: 't', text: 'Press “Show me” to route each question to the family built for it.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(q, el('div', { class: 'w-svni-fams' }, fams), el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  let gen = 0;
  btn.addEventListener('click', async () => {
    const g = ++gen;
    for (const [text, i, why] of QS) {
      fams.forEach((f) => f.classList.remove('on')); q.textContent = text; cap.firstChild.textContent = 'Which family is built for this?';
      await sleep(reduced ? 400 : 1600); if (g !== gen) return;
      fams[i].classList.add('on'); cap.firstChild.textContent = why;
      await sleep(reduced ? 400 : 2200); if (g !== gen) return;
    }
    fams.forEach((f) => f.classList.remove('on')); q.textContent = 'Postgres can answer all seven, at small to medium scale.';
    cap.firstChild.textContent = 'JSONB, a primary key, recursive CTEs, tsvector/pg_trgm, partitioning/Timescale, pgvector and SQL. Specialists win when one question dominates at large scale.';
  });
});
