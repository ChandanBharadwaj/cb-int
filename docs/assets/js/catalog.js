/* Interview Atlas catalog: tracks → modules → topics.
   status: 'done' (page live) | 'todo'. depth: F fundamentals · D deep · X internals + edge cases */
window.IA_CATALOG = {
  tracks: [
    {
      id: 'sql', name: 'SQL & Postgres', icon: '⛁', status: 'live',
      blurb: 'From logical query order to MVCC, planner internals and choosing the right database as an architect. Postgres semantics throughout.',
      modules: [
        { id: 'M0', name: 'Intro: data & why SQL', topics: [
          { n: '0a', slug: 'data-in-applications', title: 'How applications see data', depth: 'F', status: 'done' },
          { n: '0b', slug: 'types-of-data', title: 'Structured vs semi vs unstructured', depth: 'F', status: 'done' },
          { n: '0c', slug: 'transactional-data', title: 'Transactional vs analytical vs event data', depth: 'F', status: 'done' },
          { n: '0d', slug: 'why-sql', title: 'What SQL is & why it lasts', depth: 'F', status: 'done' }]},
        { id: 'M1', name: 'Query foundations', topics: [
          { n: '1', slug: 'logical-query-order', title: 'Logical query processing order', depth: 'F', status: 'done' },
          { n: '2', slug: 'null-three-valued-logic', title: 'NULL & three-valued logic', depth: 'D', status: 'done' },
          { n: '3', slug: 'data-types-that-bite', title: 'Data types that bite', depth: 'D', status: 'done' },
          { n: '4', slug: 'constraints', title: 'Constraints, deferrable & exclusion', depth: 'D', status: 'done' }]},
        { id: 'M2', name: 'Joins & set logic', topics: [
          { n: '5', slug: 'joins', title: 'Joins, visualized', depth: 'F', status: 'done' },
          { n: '6', slug: 'semi-anti-joins', title: 'Semi & anti joins (EXISTS / NOT IN)', depth: 'D', status: 'done' },
          { n: '7', slug: 'lateral-top-n', title: 'LATERAL & top-N per group', depth: 'D', status: 'done' },
          { n: '8', slug: 'set-operations', title: 'UNION / INTERSECT / EXCEPT', depth: 'F', status: 'done' },
          { n: '9', slug: 'join-fan-out', title: 'Join fan-out & double counting', depth: 'D', status: 'done' }]},
        { id: 'M3', name: 'Aggregation & analytics', topics: [
          { n: '10', slug: 'grouping', title: 'GROUP BY, FILTER, ROLLUP/CUBE', depth: 'D', status: 'done' },
          { n: '11', slug: 'window-ranking', title: 'Window functions I: ranking', depth: 'D', status: 'done' },
          { n: '12', slug: 'window-frames', title: 'Window functions II: frames', depth: 'X', status: 'done' },
          { n: '13', slug: 'gaps-islands', title: 'Gaps & islands, sessionization', depth: 'X', status: 'done' },
          { n: '14', slug: 'pivot-percentiles', title: 'Pivots & percentiles', depth: 'D', status: 'done' }]},
        { id: 'M4', name: 'Advanced querying', topics: [
          { n: '15', slug: 'ctes', title: 'CTEs: materialized vs inlined', depth: 'D', status: 'done' },
          { n: '16', slug: 'recursive-ctes', title: 'Recursive CTEs & graphs', depth: 'X', status: 'done' },
          { n: '17', slug: 'subqueries', title: 'Correlated subqueries', depth: 'D', status: 'done' },
          { n: '18', slug: 'upsert-merge', title: 'Upsert, MERGE, RETURNING', depth: 'D' },
          { n: '19', slug: 'pagination', title: 'OFFSET vs keyset pagination', depth: 'D' },
          { n: '20', slug: 'latest-per-key', title: 'Dedup & latest row per key', depth: 'D' }]},
        { id: 'M5', name: 'Indexes & storage', topics: [
          { n: '21', slug: 'heap-pages-toast', title: 'Heap pages, tuples & TOAST', depth: 'X' },
          { n: '22', slug: 'btree-internals', title: 'B-tree internals & covering indexes', depth: 'X' },
          { n: '23', slug: 'index-types', title: 'GIN, GiST, BRIN, partial, expression', depth: 'D' },
          { n: '24', slug: 'index-not-used', title: 'Why isn’t my index used?', depth: 'X' }]},
        { id: 'M6', name: 'Planning & performance', topics: [
          { n: '25', slug: 'explain', title: 'Reading EXPLAIN ANALYZE', depth: 'X', status: 'done' },
          { n: '26', slug: 'join-algorithms', title: 'Nested loop, hash & merge joins', depth: 'X', status: 'done' },
          { n: '27', slug: 'statistics', title: 'Statistics & bad estimates', depth: 'X', status: 'done' },
          { n: '28', slug: 'partitioning', title: 'Partitioning & pruning', depth: 'D', status: 'done' }]},
        { id: 'M7', name: 'Transactions & concurrency', topics: [
          { n: '29', slug: 'isolation-levels', title: 'Isolation levels & anomalies', depth: 'X', status: 'done' },
          { n: '30', slug: 'mvcc-vacuum', title: 'MVCC, VACUUM, bloat, wraparound', depth: 'X', status: 'done' },
          { n: '31', slug: 'locking', title: 'Locks, SKIP LOCKED, lock queues', depth: 'X', status: 'done' },
          { n: '32', slug: 'deadlocks-optimistic', title: 'Deadlocks & optimistic locking', depth: 'X', status: 'done' }]},
        { id: 'M8', name: 'Production & design', topics: [
          { n: '33', slug: 'schema-design', title: 'Schema design, tenancy & IDs', depth: 'D', status: 'done' },
          { n: '34', slug: 'postgres-in-production', title: 'Postgres in production', depth: 'X', status: 'done' }]},
        { id: 'M9', name: 'Architect’s choice: picking the DB', topics: [
          { n: '35', slug: 'db-decision-navigator', title: 'Decision navigator', depth: 'X', status: 'done' },
          { n: '36', slug: 'relational-compared', title: 'Postgres vs MySQL vs Oracle vs SQL Server', depth: 'D', status: 'done' },
          { n: '37', slug: 'sql-vs-nosql', title: 'SQL vs NoSQL families', depth: 'X', status: 'done' },
          { n: '38', slug: 'distributed-sql', title: 'Distributed SQL & NewSQL', depth: 'X', status: 'done' },
          { n: '39', slug: 'oltp-vs-olap', title: 'OLTP vs OLAP & columnar', depth: 'D', status: 'done' },
          { n: '40', slug: 'scenario-lab', title: 'Real-time scenario lab', depth: 'X', status: 'done' },
          { n: '41', slug: 'polyglot-persistence', title: 'Polyglot persistence & migrations', depth: 'X', status: 'done' }]},
        { id: 'M10', name: 'Drill', topics: [
          { n: '★', slug: 'tricky-50', title: 'Tricky 50 (timed)', depth: 'X', status: 'done' }]}
      ]
    },
    { id: 'java', name: 'Java & JVM', icon: '☕', status: 'soon', blurb: 'Coming later.', modules: [] },
    { id: 'spring', name: 'Spring Boot', icon: '❀', status: 'soon', blurb: 'Coming later.', modules: [] },
    { id: 'ai-agents', name: 'AI agents (Python)', icon: '✦', status: 'soon', blurb: 'Coming later.', modules: [] }
  ]
};
