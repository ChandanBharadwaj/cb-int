/* Beginner intro: a nested subquery gets lifted out and named. */
IA.widget('ctes-intro', (root, ctx) => {
  const { el, sleep, reduced, codeBox } = ctx;
  const V = [
    ['Nested: read it inside-out', 'SELECT name, total\nFROM (SELECT customer_id, sum(amount) AS total\n      FROM orders GROUP BY customer_id) t\nJOIN customers c ON c.id = t.customer_id\nWHERE total > 100;'],
    ['Step 1: lift the inner query out and give it a name', 'WITH totals AS (\n  SELECT customer_id, sum(amount) AS total\n  FROM orders GROUP BY customer_id\n)\n…'],
    ['Step 2: use the name like a table', 'WITH totals AS (\n  SELECT customer_id, sum(amount) AS total\n  FROM orders GROUP BY customer_id\n)\nSELECT name, total\nFROM totals t\nJOIN customers c ON c.id = t.customer_id\nWHERE total > 100;'],
    ['Same result, read top to bottom', 'WITH totals AS (…),\n     big AS (SELECT * FROM totals WHERE total > 100)\nSELECT … FROM big …;   -- CTEs can build on each other']
  ];
  const host = el('div'); const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: V[0][0] }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  const show = (i) => { host.innerHTML = ''; host.append(codeBox(V[i][1], 'sql')); cap.firstChild.textContent = V[i][0]; };
  root.append(host, el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap); show(0);
  let gen = 0;
  btn.addEventListener('click', async () => { const g = ++gen; for (let i = 0; i < V.length; i++) { show(i); await sleep(reduced ? 600 : 2800); if (g !== gen) return; } cap.firstChild.textContent = 'A CTE is a named subquery: same meaning, but each step has a name and reads in order.'; });
});
