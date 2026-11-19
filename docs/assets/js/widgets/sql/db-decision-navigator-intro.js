/* Beginner intro: requirements arrive one by one; most are absorbed by Postgres, one forces a specialist store. */
IA.widget('db-decision-navigator-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-ddni-style')) document.head.append(el('style', { id: 'w-ddni-style', html: `
.w-ddni { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } @media (max-width: 560px) { .w-ddni { grid-template-columns: 1fr; } }
.w-ddni-col { border: 1px dashed var(--border); border-radius: 12px; padding: 10px; min-height: 120px; }
.w-ddni-col h5 { margin: 0 0 8px; font-size: 13px; }
.w-ddni-item { border: 1px solid var(--border); background: var(--surface); border-radius: 9px; padding: 6px 9px; font-size: 13px; margin-bottom: 6px; animation: capin .35s ease both; }
.w-ddni-item small { display: block; color: var(--text-3); }
.w-ddni-item.ok { border-left: 4px solid var(--ok); } .w-ddni-item.force { border-left: 4px solid var(--warn); }
` }));
  const R = [
    ['Store orders and customers, with foreign keys', 'tables + constraints', 1],
    ['Search products by name', 'pg_trgm / tsvector index', 1],
    ['Keep flexible product attributes', 'JSONB column + GIN index', 1],
    ['Find similar products from an embedding', 'pgvector extension', 1],
    ['Dashboards over 5 billion click events', 'too big for row storage: columnar warehouse', 0]
  ];
  const pg = el('div', { class: 'w-ddni-col' }, el('h5', { text: '🐘 Postgres handles it' }));
  const other = el('div', { class: 'w-ddni-col' }, el('h5', { text: '🔧 Needs a specialist store' }));
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press “Show me” to test five requirements against the Postgres default.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(el('div', { class: 'w-ddni' }, pg, other), el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  let gen = 0;
  btn.addEventListener('click', async () => {
    const g = ++gen; [pg, other].forEach((c) => { while (c.children.length > 1) c.lastChild.remove(); });
    for (const [need, how, ok] of R) {
      cap.firstChild.textContent = `Requirement: “${need}”. Can Postgres do it?`;
      await sleep(reduced ? 400 : 1800); if (g !== gen) return;
      (ok ? pg : other).append(el('div', { class: 'w-ddni-item ' + (ok ? 'ok' : 'force') }, need, el('small', { text: how })));
      cap.firstChild.textContent = ok ? `Yes: ${how}. No new store needed.` : `This one forces a second store: ${how}. It is fed from Postgres, which stays the source of truth.`;
      await sleep(reduced ? 400 : 2200); if (g !== gen) return;
    }
    cap.firstChild.textContent = 'Four of five needs fit in one database. Only one requirement forced a specialist store. That is the “start with Postgres” bias.';
  });
});
