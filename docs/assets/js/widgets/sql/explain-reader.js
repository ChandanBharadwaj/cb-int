/* EXPLAIN reader: paste a text plan, compute self time and misestimates, highlight the hottest node. */
IA.widget('explain-reader', (root, ctx) => {
  const { el, esc } = ctx;
  if (!document.getElementById('w-explain-r-css')) document.head.append(el('style', { id: 'w-explain-r-css', text: `
.w-explain-r textarea { width: 100%; min-height: 190px; box-sizing: border-box; font: 12px/1.45 ui-monospace, Menlo, Consolas, monospace; background: var(--surface-2); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 10px; }
.w-explain-r .bar { height: 8px; border-radius: 4px; background: var(--accent); min-width: 2px; }
.w-explain-r tr.hot td { background: var(--accent-soft); font-weight: 700; }
.w-explain-r td.bad { color: var(--err); font-weight: 700; }
.w-explain-r td.nm { white-space: nowrap; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; }` }));
  const S = {
    'N+1 inside the DB': `Nested Loop  (cost=0.71..25.40 rows=3 width=15) (actual time=0.051..431.220 rows=48000 loops=1)
  Buffers: shared hit=146012 read=9611
  ->  Index Scan using orders_status_idx on orders o  (cost=0.43..8.45 rows=3 width=12) (actual time=0.032..118.400 rows=48000 loops=1)
        Index Cond: (status = 'pending'::text)
        Filter: (region = 'EU'::text)
        Rows Removed by Filter: 2100
        Buffers: shared hit=2012 read=9611
  ->  Index Scan using customers_pkey on customers c  (cost=0.28..5.65 rows=1 width=11) (actual time=0.004..0.005 rows=1 loops=48000)
        Index Cond: (id = o.customer_id)
        Buffers: shared hit=144000
Planning Time: 0.412 ms
Execution Time: 433.910 ms`,
    'Sort spills to disk': `Limit  (cost=58210.11..58210.36 rows=100 width=40) (actual time=2210.4..2210.5 rows=100 loops=1)
  ->  Sort  (cost=58210.11..60710.11 rows=1000000 width=40) (actual time=2210.4..2210.4 rows=100 loops=1)
        Sort Key: (sum(e.amount)) DESC
        Sort Method: top-N heapsort  Memory: 38kB
        ->  HashAggregate  (cost=21370.00..31370.00 rows=1000000 width=40) (actual time=640.2..2050.1 rows=812000 loops=1)
              Group Key: e.account_id
              Batches: 21  Memory Usage: 4145kB  Disk Usage: 61240kB
              Buffers: shared hit=8334, temp read=7408 written=13770
              ->  Seq Scan on events e  (cost=0.00..16370.00 rows=1000000 width=12) (actual time=0.01..140.3 rows=1000000 loops=1)
                    Buffers: shared hit=8334
Execution Time: 2219.0 ms`,
    'Healthy hash join': `Hash Join  (cost=143.79..1042.11 rows=22572 width=15) (actual time=9.976..39.969 rows=22641 loops=1)
  Hash Cond: (o.customer_id = c.id)
  Buffers: shared hit=417
  ->  Index Scan using orders_created_idx on orders o  (cost=0.29..839.29 rows=22572 width=12) (actual time=0.031..14.100 rows=22641 loops=1)
        Index Cond: (created_at >= '2025-01-20'::timestamptz)
        Buffers: shared hit=380
  ->  Hash  (cost=81.00..81.00 rows=5000 width=11) (actual time=4.600..4.601 rows=5000 loops=1)
        Buckets: 8192  Batches: 1  Memory Usage: 300kB
        Buffers: shared hit=37
        ->  Seq Scan on customers c  (cost=0.00..81.00 rows=5000 width=11) (actual time=0.010..1.900 rows=5000 loops=1)
              Buffers: shared hit=37
Execution Time: 41.2 ms`
  };
  const ta = el('textarea', { spellcheck: 'false', 'aria-label': 'EXPLAIN ANALYZE text plan' });
  const seg = el('div', { class: 'seg' });
  Object.keys(S).forEach((k, i) => { const b = el('button', { text: k, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); ta.value = S[k]; analyze(); }); seg.append(b); });
  const bGo = el('button', { class: 'btn primary', text: 'Analyze pasted plan' });
  const out = el('div'); const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.classList.add('w-explain-r');
  root.append(el('div', { class: 'w-controls' }, seg), ta, el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bGo), cap, out);
  function parse(txt) {
    const nodes = [];
    txt.split('\n').forEach((raw) => {
      const line = raw.replace(/^\s*\|?/, (m) => m.replace('|', ' ')).replace(/\s*\|?\s*$/, '');
      const m = line.match(/^(\s*)(->\s+)?(.+?)\s+\(cost=([\d.]+)\.\.([\d.]+) rows=(\d+)[^)]*\)(?:\s+\(actual(?: time=([\d.]+)\.\.([\d.]+))? rows=([\d.]+) loops=(\d+)\))?/);
      if (m) {
        const ind = m[1].length + (m[2] ? 0 : -1);
        nodes.push({ ind, name: m[3].trim(), est: +m[6], t: m[8] != null ? +m[8] : null, rows: m[9] != null ? +m[9] : null, loops: m[10] != null ? +m[10] : 1, buf: '', props: [] });
        return;
      }
      if (nodes.length) { const p = line.trim(); if (/^Buffers:/.test(p)) nodes[nodes.length - 1].buf = p.replace('Buffers: ', ''); else if (p && !/^(Planning|Execution|JIT|Settings)/.test(p)) nodes[nodes.length - 1].props.push(p); }
    });
    nodes.forEach((n, i) => { n.parent = null; for (let j = i - 1; j >= 0; j--) if (nodes[j].ind < n.ind) { n.parent = j; break; } });
    nodes.forEach((n) => { n.total = n.t != null ? n.t * n.loops : null; });
    nodes.forEach((n, i) => { const kids = nodes.filter((c) => c.parent === i); n.self = n.total == null ? null : Math.max(0, n.total - kids.reduce((s, c) => s + (c.total || 0), 0)); });
    return nodes;
  }
  function analyze() {
    const N = parse(ta.value); out.innerHTML = '';
    if (!N.length) { cap.firstChild.textContent = 'No plan nodes found. Paste the text output of EXPLAIN (ANALYZE, BUFFERS).'; return; }
    if (N.every((n) => n.rows == null)) { cap.firstChild.textContent = 'This plan has estimates only. Run it with EXPLAIN (ANALYZE, BUFFERS) to get actual numbers.'; }
    const maxSelf = Math.max(...N.map((n) => n.self || 0)); const hot = N.findIndex((n) => (n.self || 0) === maxSelf && maxSelf > 0);
    const ratio = (n) => n.rows == null ? null : Math.max(n.rows, 0.5) / Math.max(n.est, 0.5);
    let worst = -1; // deepest misestimate
    N.forEach((n, i) => { const r = ratio(n); if (r != null && Math.max(r, 1 / r) >= 10 && (worst < 0 || n.ind > N[worst].ind)) worst = i; });
    const tb = el('tbody');
    N.forEach((n, i) => {
      const r = ratio(n); const off = r == null ? '' : Math.max(r, 1 / r) < 1.5 ? '≈ ok' : r >= 1 ? '×' + Math.round(r).toLocaleString('en-US') + ' under' : '×' + Math.round(1 / r).toLocaleString('en-US') + ' over';
      const bad = r != null && Math.max(r, 1 / r) >= 10;
      tb.append(el('tr', { class: i === hot ? 'hot' : '' },
        el('td', { class: 'nm', html: '&nbsp;'.repeat(Math.max(0, n.ind)) + esc(n.name.length > 46 ? n.name.slice(0, 44) + '…' : n.name) }),
        el('td', { text: n.est.toLocaleString('en-US') }),
        el('td', { text: n.rows == null ? '-' : Math.round(n.rows * n.loops).toLocaleString('en-US') + (n.loops > 1 ? ` (${n.loops.toLocaleString('en-US')} loops)` : '') }),
        el('td', { class: bad ? 'bad' : '', text: off }),
        el('td', { text: n.self == null ? '-' : n.self.toFixed(1) + ' ms' }),
        el('td', { style: { minWidth: '80px' } }, el('div', { class: 'bar', style: { width: (maxSelf ? 100 * (n.self || 0) / maxSelf : 0) + '%' } })),
        el('td', { class: 'tiny', style: { whiteSpace: 'nowrap' }, text: n.buf + (n.props.find((p) => /Disk|Batches: [2-9]|Rows Removed/.test(p)) ? '  ' + n.props.find((p) => /Disk|Batches: [2-9]|Rows Removed/.test(p)) : '') })));
    });
    out.append(el('div', { class: 'tscroll' }, el('table', { class: 't rg' }, el('thead', null, el('tr', null, ['node', 'est rows (per loop)', 'actual rows (total)', 'misestimate', 'self time', '', 'buffers / notes'].map((h) => el('th', { text: h })))), tb)));
    const msgs = [];
    if (hot >= 0) msgs.push(`Hottest node: <b>${esc(N[hot].name)}</b>, ${N[hot].self.toFixed(1)} ms self time.`);
    if (worst >= 0) msgs.push(`Deepest bad estimate: <b>${esc(N[worst].name)}</b> (${Math.round(N[worst].est).toLocaleString('en-US')} estimated vs ${Math.round(N[worst].rows).toLocaleString('en-US')} actual per loop). Fix it first: everything above it was planned with wrong numbers.`);
    if (N.some((n) => n.props.some((p) => /Disk:|Disk Usage|Batches: ([2-9]|\d\d)/.test(p)) || /temp /.test(n.buf))) msgs.push('A node spilled to disk (temp buffers, Disk, or Batches > 1). Check work_mem or reduce its input.');
    if (N.some((n) => n.loops >= 1000)) msgs.push('A node ran 1,000+ loops. Its printed time is per loop, so the totals above multiply by loops.');
    if (msgs.length) cap.firstChild.innerHTML = msgs.join(' ');
  }
  bGo.addEventListener('click', analyze);
  ta.value = S['N+1 inside the DB']; analyze();
});
