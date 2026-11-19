# TRACKER: resume point for building the Interview Atlas

> Read this first in any new session. Update it in **every** commit.

## Current state
- **Platform:** ✅ hub (`docs/index.html`), SQL track page, engine, CSS, PGlite playground, puzzles, shell generator
- **Pilot 1:** ✅ `joins` (merged to main). Site: https://chandanbharadwaj.github.io/cb-int/ once Pages is on (main, /docs).
- **Next action:** after review, build `window-ranking` (pilot 2), then `isolation-levels`, then `explain`; after that, module order.

## Decisions (from the user)
- Postgres only for internals. Other databases appear only in M9 comparisons.
- Visual first: every page has an animated visual, a playground, gotchas, real-world incidents, puzzles, interview Q&A and a Java/Spring tie-in.
- Multi-topic hub (SQL first). Deploy GitHub Pages from `main` → `/docs`.
- Ask the user before adding topics, changing the template or changing the seed dataset.
- Develop on `claude/interview-repo-sql-structure-2zhpqy`; one topic per commit.

## How to add a topic
1. `docs/data/sql/<slug>.js` (schema: see `tools/AUTHORING.md`; reference: `joins.js`)
2. `docs/assets/js/widgets/sql/<slug>.js` (`IA.widget('<slug>', (root, ctx) => …)`)
3. Mark `status: 'done'` in `docs/assets/js/catalog.js`
4. `python3 tools/gen_shells.py`
5. Verify the puzzle answers against real Postgres (PGlite in Node), then take Playwright screenshots in desktop/light and phone/dark
6. Update this file, then commit and push

## Topics (46)
| # | slug | title | depth | status |
|---|---|---|---|---|
| 0a | `data-in-applications` | How applications see data | F | ⬜ todo |
| 0b | `types-of-data` | Structured vs semi vs unstructured | F | ⬜ todo |
| 0c | `transactional-data` | Transactional vs analytical vs event data | F | ⬜ todo |
| 0d | `why-sql` | What SQL is & why it lasts | F | ⬜ todo |
| 1 | `logical-query-order` | Logical query processing order | F | ⬜ todo |
| 2 | `null-three-valued-logic` | NULL & three-valued logic | D | ⬜ todo |
| 3 | `data-types-that-bite` | Data types that bite | D | ⬜ todo |
| 4 | `constraints` | Constraints, deferrable & exclusion | D | ⬜ todo |
| 5 | `joins` | Joins, visualized | F | ✅ done |
| 6 | `semi-anti-joins` | Semi & anti joins (EXISTS / NOT IN) | D | ✅ done |
| 7 | `lateral-top-n` | LATERAL & top-N per group | D | ✅ done |
| 8 | `set-operations` | UNION / INTERSECT / EXCEPT | F | ✅ done |
| 9 | `join-fan-out` | Join fan-out & double counting | D | ✅ done |
| 10 | `grouping` | GROUP BY, FILTER, ROLLUP/CUBE | D | ✅ done |
| 11 | `window-ranking` | Window functions I: ranking | D | ✅ done |
| 12 | `window-frames` | Window functions II: frames | X | ✅ done |
| 13 | `gaps-islands` | Gaps & islands, sessionization | X | ✅ done |
| 14 | `pivot-percentiles` | Pivots & percentiles | D | ✅ done |
| 15 | `ctes` | CTEs: materialized vs inlined | D | ✅ done |
| 16 | `recursive-ctes` | Recursive CTEs & graphs | X | ✅ done |
| 17 | `subqueries` | Correlated subqueries | D | ✅ done |
| 18 | `upsert-merge` | Upsert, MERGE, RETURNING | D | ⬜ todo |
| 19 | `pagination` | OFFSET vs keyset pagination | D | ⬜ todo |
| 20 | `latest-per-key` | Dedup & latest row per key | D | ⬜ todo |
| 21 | `heap-pages-toast` | Heap pages, tuples & TOAST | X | ⬜ todo |
| 22 | `btree-internals` | B-tree internals & covering indexes | X | ⬜ todo |
| 23 | `index-types` | GIN, GiST, BRIN, partial, expression | D | ⬜ todo |
| 24 | `index-not-used` | Why isn’t my index used? | X | ⬜ todo |
| 25 | `explain` | Reading EXPLAIN ANALYZE | X | ⬜ todo |
| 26 | `join-algorithms` | Nested loop, hash & merge joins | X | ⬜ todo |
| 27 | `statistics` | Statistics & bad estimates | X | ⬜ todo |
| 28 | `partitioning` | Partitioning & pruning | D | ⬜ todo |
| 29 | `isolation-levels` | Isolation levels & anomalies | X | ⬜ todo |
| 30 | `mvcc-vacuum` | MVCC, VACUUM, bloat, wraparound | X | ⬜ todo |
| 31 | `locking` | Locks, SKIP LOCKED, lock queues | X | ⬜ todo |
| 32 | `deadlocks-optimistic` | Deadlocks & optimistic locking | X | ⬜ todo |
| 33 | `schema-design` | Schema design, tenancy & IDs | D | ⬜ todo |
| 34 | `postgres-in-production` | Postgres in production | X | ⬜ todo |
| 35 | `db-decision-navigator` | Decision navigator | X | ⬜ todo |
| 36 | `relational-compared` | Postgres vs MySQL vs Oracle vs SQL Server | D | ⬜ todo |
| 37 | `sql-vs-nosql` | SQL vs NoSQL families | X | ⬜ todo |
| 38 | `distributed-sql` | Distributed SQL & NewSQL | X | ⬜ todo |
| 39 | `oltp-vs-olap` | OLTP vs OLAP & columnar | D | ⬜ todo |
| 40 | `scenario-lab` | Real-time scenario lab | X | ⬜ todo |
| 41 | `polyglot-persistence` | Polyglot persistence & migrations | X | ⬜ todo |
| ★ | `tricky-50` | Tricky 50 (timed) | X | ⬜ todo |

## Backlog / notes
- On phones the joins SVG scales down. Consider a stacked vertical layout below 520px.
- Sections below the fold reveal on scroll, so full-page screenshots show empty space. That is expected.

## Template decisions (from the user's review of Joins)
- **Left sidebar** lists every module and topic (the current module is expanded) plus "On this page". On screens under 1100px, a ☰ Topics drawer replaces it.
- **Every topic starts with "Start here"** (`intro` in the data file), written for a first-time reader: plain words, an analogy, 3–4 numbered steps, an optional mini animation (`intro.widget`) and a glossary of terms.
- **Animations are slow by default.** About 2.4 s per step, with a Slow/Normal/Fast control, and line draws take 1 s.
