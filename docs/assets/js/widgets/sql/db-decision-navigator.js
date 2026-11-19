/* Decision navigator: answer questions, then watch the path light up node by node and see which requirement (if any) forces a move off Postgres. */
IA.widget('db-decision-navigator', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-ddn-style')) document.head.append(el('style', { id: 'w-ddn-style', html: `
.w-ddn-q { display: grid; grid-template-columns: 150px 1fr; gap: 6px 10px; align-items: center; margin-bottom: 8px; }
.w-ddn-q .lbl { font-size: 13px; color: var(--text-2); font-weight: 600; }
@media (max-width: 560px) { .w-ddn-q { grid-template-columns: 1fr; } }
.w-ddn-path { display: flex; flex-direction: column; gap: 0; margin: 10px 0; }
.w-ddn-node { display: grid; grid-template-columns: 28px 1fr; gap: 10px; align-items: start; opacity: .45; transition: opacity .3s; }
.w-ddn-node.on, .w-ddn-node.done { opacity: 1; }
.w-ddn-dot { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border); background: var(--surface); margin-top: 6px; position: relative; transition: all .3s; }
.w-ddn-node:not(:last-child) .w-ddn-dot::after { content: ''; position: absolute; left: 8px; top: 22px; width: 2px; height: 46px; background: var(--border); }
.w-ddn-node.on .w-ddn-dot { border-color: var(--accent); background: var(--accent-soft); box-shadow: 0 0 0 5px var(--accent-soft); }
.w-ddn-node.done.ok .w-ddn-dot { border-color: var(--ok); background: var(--ok); }
.w-ddn-node.done.force .w-ddn-dot { border-color: var(--warn); background: var(--warn); }
.w-ddn-box { border: 1px solid var(--border); background: var(--surface); border-radius: 10px; padding: 7px 10px; margin-bottom: 8px; min-width: 0; }
.w-ddn-node.on .w-ddn-box { border-color: var(--accent); }
.w-ddn-box b { font-size: 13px; } .w-ddn-box .v { font-size: 12.5px; color: var(--text-2); margin-top: 2px; }
.w-ddn-tag { display: inline-block; font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 99px; margin-left: 6px; }
.w-ddn-tag.ok { color: var(--ok); border: 1px solid var(--ok); } .w-ddn-tag.force { color: var(--warn); border: 1px solid var(--warn); } .w-ddn-tag.add { color: var(--accent); border: 1px solid var(--accent); }
.w-ddn-rec { border: 2px solid var(--accent); border-radius: 12px; padding: 12px; background: var(--surface-2); margin-top: 10px; }
.w-ddn-rec h4 { margin: 0 0 4px; font-size: 17px; } .w-ddn-rec h5 { margin: 10px 0 4px; font-size: 13px; color: var(--text-2); }
.w-ddn-rec ul { margin: 0; padding-left: 18px; font-size: 13px; } .w-ddn-rec li { margin: 2px 0; }
.w-ddn-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } @media (max-width: 560px) { .w-ddn-cols { grid-template-columns: 1fr; } }
.w-ddn-multi button.on { background: var(--accent); color: #fff; }
` }));

  const Q = [
    { k: 'work', l: 'Workload', o: [['oltp', 'OLTP'], ['olap', 'OLAP'], ['mixed', 'Mixed']] },
    { k: 'cons', l: 'Consistency', o: [['strict', 'Strict (money, invariants)'], ['entity', 'Per-entity'], ['eventual', 'Eventual is fine']] },
    { k: 'shape', l: 'Data shape', o: [['rel', 'Relational'], ['doc', 'Variable documents'], ['graph', 'Highly connected']] },
    { k: 'wps', l: 'Peak writes/s', o: [['low', '< 5k'], ['mid', '5k–50k'], ['high', '> 50k']] },
    { k: 'size', l: 'Data size', o: [['s', '< 1 TB'], ['m', '1–10 TB'], ['l', '> 10 TB']] },
    { k: 'geo', l: 'Geography', o: [['one', 'One region'], ['reads', 'Global reads'], ['writes', 'Writes in many regions']] },
    { k: 'ops', l: 'Team / ops budget', o: [['small', 'Small, managed only'], ['dba', 'Has DBAs / SRE']] }
  ];
  const ACC = [['key', 'Key lookup'], ['adhoc', 'Ad-hoc query'], ['fts', 'Full-text'], ['graph', 'Graph traversal'], ['vec', 'Similarity search'], ['ts', 'Time series']];
  const PRESETS = {
    'SaaS app': { work: 'oltp', cons: 'strict', shape: 'rel', wps: 'low', size: 's', geo: 'one', ops: 'small', acc: ['key', 'adhoc', 'fts'] },
    'Global wallet': { work: 'oltp', cons: 'strict', shape: 'rel', wps: 'mid', size: 'm', geo: 'writes', ops: 'dba', acc: ['key'] },
    'IoT firehose': { work: 'mixed', cons: 'eventual', shape: 'rel', wps: 'high', size: 'l', geo: 'one', ops: 'dba', acc: ['key', 'ts'] },
    'BI warehouse': { work: 'olap', cons: 'eventual', shape: 'rel', wps: 'low', size: 'l', geo: 'one', ops: 'small', acc: ['adhoc'] },
    'RAG app': { work: 'oltp', cons: 'entity', shape: 'doc', wps: 'low', size: 's', geo: 'one', ops: 'small', acc: ['key', 'vec', 'fts'] }
  };
  let A = JSON.parse(JSON.stringify(PRESETS['SaaS app']));
  let gen = 0, k = 0, frames = [], running = false, speed = 2400;

  const segs = {};
  const mkSeg = (label, items, cur, on) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.dataset.v = v; b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const presetSeg = mkSeg('Example', Object.keys(PRESETS).map((p) => [p, p]), 'SaaS app', (p) => { A = JSON.parse(JSON.stringify(PRESETS[p])); syncSegs(); reset(); });
  const form = el('div');
  Q.forEach((q) => { segs[q.k] = mkSeg(q.l, q.o, A[q.k], (v) => { A[q.k] = v; reset(); }); form.append(el('div', { class: 'w-ddn-q' }, el('div', { class: 'lbl', text: q.l }), segs[q.k])); });
  const multi = el('div', { class: 'seg w-ddn-multi', 'aria-label': 'Access patterns (pick several)' });
  ACC.forEach(([v, l]) => { const b = el('button', { text: l, 'aria-pressed': 'false' }); b.dataset.v = v; b.addEventListener('click', () => { A.acc = A.acc.includes(v) ? A.acc.filter((x) => x !== v) : A.acc.concat(v); syncSegs(); reset(); }); multi.append(b); });
  form.append(el('div', { class: 'w-ddn-q' }, el('div', { class: 'lbl', text: 'Access patterns' }), multi));
  function syncSegs() { Q.forEach((q) => [...segs[q.k].children].forEach((b) => b.classList.toggle('on', b.dataset.v === A[q.k]))); [...multi.children].forEach((b) => { const on = A.acc.includes(b.dataset.v); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); }

  const path = el('div', { class: 'w-ddn-path' });
  const recHost = el('div');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = mkSeg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], 2400, (v) => { speed = v; });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'Example' }), presetSeg), form, el('div', { class: 'w-stage' }, path),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), cap, recHost);

  // ---- rules: each node returns {v: verdict text, t: 'ok'|'force'|'add', cap: narration}
  function decide(a) {
    const has = (x) => a.acc.includes(x);
    const R = { primary: 'PostgreSQL', primaryWhy: 'No requirement forced a move, so the default stands: one relational primary with transactions, constraints, joins and ad-hoc SQL.', sec: [], trade: [], mind: [] };
    const nodes = [];
    const n = (title, v, t, c) => nodes.push({ title, v, t, cap: c });
    // workload
    if (a.work === 'olap') { R.primary = 'Columnar warehouse (ClickHouse, BigQuery, Snowflake, Redshift; DuckDB if local)'; R.primaryWhy = 'The main job is scanning and aggregating many rows. Columnar storage reads only the needed columns, compressed, with vectorized execution.';
      n('Workload', 'OLAP: forces a columnar engine', 'force', 'OLAP is the one workload where Postgres is not the default. Row storage reads whole rows to aggregate one column; a columnar engine reads only that column.');
      R.trade.push('Columnar stores are poor at single-row updates and high-rate point writes. The OLTP source of truth (often Postgres) stays separate.');
      R.mind.push('If data stays under a few hundred GB and queries are simple, Postgres with partitioning, BRIN indexes and materialized views may be enough.');
    } else if (a.work === 'mixed') { n('Workload', 'Mixed: keep Postgres, isolate analytics', 'add', 'Mixed workloads: keep OLTP on Postgres. Run reports on a read replica first; move heavy aggregates to a columnar store via CDC when they hurt.');
      R.sec.push(['Read replica, later CDC → columnar warehouse', 'keeps reporting scans off the primary']);
    } else n('Workload', 'OLTP: Postgres default holds', 'ok', 'OLTP: short transactions on a few rows. This is exactly what Postgres is built for.');
    // consistency
    if (a.cons === 'strict') n('Consistency', 'Strict: needs ACID transactions', 'ok', 'Strict invariants (balances, inventory) need multi-row ACID transactions and constraints. This rules OUT eventually consistent stores as the primary.');
    else if (a.cons === 'eventual') n('Consistency', 'Eventual OK: widens the options', 'ok', 'Eventual consistency is acceptable, so partitioned stores like Cassandra or DynamoDB become possible, but only if another requirement needs them.');
    else n('Consistency', 'Per-entity: single-row atomicity is enough', 'ok', 'Per-entity atomicity is enough. Most stores give that; it does not force a choice on its own.');
    // shape
    if (a.shape === 'doc') { n('Data shape', 'Documents: JSONB covers it', 'ok', 'Variable documents: Postgres JSONB with GIN indexes stores and queries them, and you keep relational columns for what needs constraints.'); R.mind.push('Choose a document store (MongoDB) if documents are self-contained, rarely joined, and the team already runs it well.'); }
    else if (a.shape === 'graph' && has('graph')) n('Data shape', 'Connected + traversals: see access step', 'add', 'Highly connected data. Whether it needs a graph DB depends on the traversal depth: checked in the access-pattern step.');
    else n('Data shape', a.shape === 'graph' ? 'Connected, but few traversals: tables are fine' : 'Relational: Postgres default holds', 'ok', 'Relational shape: tables, foreign keys and joins.');
    // scale: writes
    const distSql = a.geo === 'writes' && a.cons !== 'eventual';
    if (a.wps === 'high' && a.work !== 'olap') {
      if (a.cons === 'eventual' && !has('adhoc') && !distSql) { R.primary = 'Wide-column / key-value (Cassandra, ScyllaDB or DynamoDB)'; R.primaryWhy = 'Very high sustained writes, key-based access, and eventual consistency are acceptable: the case these partitioned, LSM-based stores were built for.';
        n('Write rate', '> 50k/s + eventual + key access: forces a partitioned store', 'force', 'More than 50k writes/s sustained, key-based reads, and eventual consistency is fine. A partitioned LSM store scales writes horizontally. You must design tables per query.');
        R.trade.push('No joins or ad-hoc queries; every new query may need a new table. Partition key design decides whether you get hot partitions.');
        R.mind.push('If writes are mostly time-stamped metrics, TimescaleDB with batching often handles much more than people expect on one node.');
      } else if (!distSql) { R.primary = 'Sharded Postgres (Citus) or distributed SQL'; R.primaryWhy = 'Write rate beyond what one tuned node sustains, but you still need SQL and transactions. Shard by a key (tenant, device) so most transactions stay on one shard.';
        n('Write rate', '> 50k/s with SQL needs: shard Postgres', 'force', 'More than 50k writes/s that still need SQL or transactions. First try batching and vertical scale, then shard by a key (Citus) or use distributed SQL.');
        R.trade.push('Cross-shard transactions and joins cost more; choose the distribution key carefully.');
        R.mind.push('Re-measure after batching writes (multi-row INSERT / COPY) and tuning WAL: one node may be enough.');
      } else n('Write rate', 'High; handled by the geography decision', 'add', 'High write rate. The geography step will pick a distributed SQL store, which also scales writes.');
    } else if (a.wps === 'mid') n('Write rate', '5k–50k/s: one tuned node usually copes', 'ok', '5k–50k writes/s: a well-tuned single Postgres node (fast NVMe, batching, sensible indexes) usually copes. Load-test it before assuming otherwise.');
    else n('Write rate', a.work === 'olap' ? 'Batch loads: fine' : '< 5k/s: easily one node', 'ok', 'Low write rate: a single node handles this with room to spare.');
    // size
    if (a.size === 'l' && a.work !== 'olap') { n('Data size', '> 10 TB: partition, plan ahead', 'add', 'More than 10 TB: Postgres can hold it, but backups, restores, vacuum and index builds get slow. Partition big tables and archive cold data.');
      R.trade.push('Very large single nodes mean long restore times: test your recovery time objective.'); }
    else n('Data size', a.size === 'm' ? '1–10 TB: fine with partitioning' : 'Small: fine', 'ok', a.size === 'm' ? '1–10 TB is routine for Postgres. Use partitioning for the largest tables.' : 'Data fits easily on one node.');
    // geo
    if (a.geo === 'writes') {
      if (a.cons === 'eventual') { if (!/Cassandra/.test(R.primary)) { R.primary = 'Multi-region key-value (DynamoDB global tables or Cassandra)'; R.primaryWhy = 'Writes are accepted in every region and replicated asynchronously. Conflicts are resolved by last-writer-wins, which is only OK because eventual consistency is acceptable.'; }
        n('Geography', 'Multi-region writes + eventual: multi-leader store', 'force', 'Multi-region writes with eventual consistency: a multi-leader store accepts writes locally and replicates asynchronously. Concurrent updates resolve as last-writer-wins.');
        R.trade.push('Concurrent writes to the same item in two regions: one is silently lost (last-writer-wins). Design items so that is acceptable.');
      } else { R.primary = 'Distributed SQL (CockroachDB, Spanner or YugabyteDB)'; R.primaryWhy = 'Writes must be accepted in several regions with strong consistency. Only consensus-replicated (Raft/Paxos) SQL databases do that, and they pay cross-region latency on commit.';
        n('Geography', 'Multi-region writes + strong: forces distributed SQL', 'force', 'Multi-region writes with strong consistency: a single-primary Postgres cannot keep writing on both sides of a partition. Distributed SQL uses consensus, so each commit waits for a majority of replicas, often cross-region.');
        R.trade.push('Every commit waits for a quorum: expect tens to hundreds of ms when replicas are in different regions. Pin data to regions (locality) to cut this.');
        R.mind.push('If the business accepts writes routed to one home region with minutes of failover, Postgres + cross-region replicas is far simpler.'); }
    } else if (a.geo === 'reads') { n('Geography', 'Global reads: replicas / CDN', 'add', 'Global reads only: add read replicas in other regions (or a cache/CDN). Writes still go to one primary.'); R.sec.push(['Cross-region read replicas', 'low-latency reads; accept replica lag']); }
    else n('Geography', 'One region: no change', 'ok', 'One region: standard primary plus a synchronous or asynchronous standby for HA.');
    // access patterns
    const notes = [];
    if (has('fts')) { R.sec.push(['tsvector + GIN, pg_trgm (in Postgres)', 'start here for search']); notes.push('full-text → tsvector/pg_trgm'); R.mind.push('Add Elasticsearch/OpenSearch (fed by CDC) when you need relevance tuning, facets and fuzzy search over a large corpus at high QPS.'); }
    if (has('vec')) { R.sec.push(['pgvector (HNSW index)', 'similarity search next to your filters']); notes.push('similarity → pgvector'); R.mind.push('Consider a dedicated vector DB when vectors or QPS outgrow one Postgres node, or you need features you measured pgvector lacks.'); }
    if (has('graph')) { if (a.shape === 'graph') { R.sec.push(['Neo4j (graph DB), fed by CDC', 'deep, variable-length traversals']); notes.push('deep traversal → graph DB'); R.trade.push('A graph DB is another store to sync and operate; keep the truth in one place.'); }
      else { R.sec.push(['Recursive CTEs (in Postgres)', 'shallow, bounded hierarchies']); notes.push('shallow graph → recursive CTE'); } }
    if (has('ts')) { R.sec.push(['Time partitioning or TimescaleDB', 'time-range scans, retention, rollups']); notes.push('time series → partitions/Timescale'); }
    if (has('key') && a.wps !== 'low') { R.sec.push(['Redis cache-aside', 'hot key reads at high QPS']); notes.push('hot keys → Redis'); }
    if (has('adhoc') && /Cassandra|DynamoDB/.test(R.primary)) { R.trade.push('Ad-hoc queries are not supported by the primary: stream to a warehouse for them.'); R.sec.push(['CDC → warehouse', 'ad-hoc analysis the primary cannot do']); }
    n('Access patterns', notes.length ? notes.join(' · ') : 'Covered by B-tree indexes', notes.length ? 'add' : 'ok', notes.length ? 'Each access pattern gets the cheapest structure that serves it. Most live inside Postgres as extensions or index types; specialist stores are added only past a threshold.' : 'Key lookups and ad-hoc queries are covered by B-tree indexes and the planner.');
    // ops
    if (a.ops === 'small') { n('Team / ops', 'Small team: managed services, fewest engines', 'ok', 'A small team should run as few engines as possible, all managed (RDS/Aurora, Cloud SQL, managed Redis). Every extra store is a backup, upgrade and failover runbook.');
      if (/Cassandra/.test(R.primary)) { R.primary = 'DynamoDB (managed) or managed Cassandra (Keyspaces / Astra)'; R.trade.push('Managed key-value removes compaction and repair work, but you pay per request and inherit its data-model limits.'); } }
    else n('Team / ops', 'DBAs available: self-managed is an option', 'ok', 'You have people for the hard operations (repairs, compaction, failover drills), so self-managed engines are possible.');
    if (!R.trade.length) R.trade.push('One engine means one failure domain: you need a hot standby, tested backups, and connection pooling.');
    if (R.primary === 'PostgreSQL') R.mind.push('Sustained writes beyond what one tuned node handles, or a requirement to keep writing in two regions during a partition.');
    return { nodes, R };
  }

  let nodeEls = [];
  function draw(d) {
    path.innerHTML = ''; nodeEls = d.nodes.map((x) => { const tag = el('span', { class: 'w-ddn-tag ' + x.t, text: x.t === 'ok' ? 'keeps default' : x.t === 'force' ? 'forces' : 'adds' });
      const v = el('div', { class: 'v', text: '…' }); const node = el('div', { class: 'w-ddn-node' }, el('div', { class: 'w-ddn-dot' }), el('div', { class: 'w-ddn-box' }, el('b', { text: x.title }), tag, v));
      tag.style.visibility = 'hidden'; node._v = v; node._tag = tag; node._x = x; path.append(node); return node; });
  }
  function showRec(R) {
    recHost.innerHTML = '';
    const ul = (arr) => el('ul', null, arr.map((t) => el('li', { html: Array.isArray(t) ? `<b>${t[0]}</b>: ${t[1]}` : t })));
    recHost.append(el('div', { class: 'w-ddn-rec', style: { animation: reduced ? 'none' : 'capin .4s ease both' } },
      el('div', { class: 'kicker', text: 'Primary store' }), el('h4', { text: R.primary }), el('p', { class: 'tiny', html: R.primaryWhy, style: { margin: 0 } }),
      el('div', { class: 'w-ddn-cols' }, el('div', null, el('h5', { text: 'Optional secondaries' }), R.sec.length ? ul(R.sec) : el('p', { class: 'tiny', text: 'None needed yet.' })),
        el('div', null, el('h5', { text: 'Trade-offs you accept' }), ul(R.trade))),
      el('h5', { text: 'What would change my mind' }), ul(R.mind)));
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; recHost.innerHTML = ''; bStep.disabled = false;
    const d = decide(A); draw(d);
    frames = d.nodes.map((x, i) => () => { nodeEls.forEach((n, j) => n.classList.toggle('on', j === i)); const n = nodeEls[i]; n.classList.add('done', x.t === 'force' ? 'force' : 'ok'); n._v.textContent = x.v; n._tag.style.visibility = 'visible'; say(x.cap); });
    frames.push(() => { nodeEls.forEach((n) => n.classList.remove('on')); showRec(d.R); const f = d.nodes.filter((x) => x.t === 'force').length;
      say(f ? `Done. ${f} requirement${f > 1 ? 's' : ''} forced a move away from the default. The recommendation is below.` : 'Done. Nothing forced a move: start with Postgres, and add the listed secondaries only when their thresholds are reached.'); });
    say('Set the answers (or pick an example), then press Play to walk the tree from the Postgres default.');
  }
  const say = (t) => { cap.firstChild.textContent = t; };
  function step() { if (k >= frames.length) return false; frames[k++](); if (k >= frames.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= frames.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  syncSegs(); reset();
});
