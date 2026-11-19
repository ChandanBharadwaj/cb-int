# Authoring a topic page

Each topic is **one data file + one widget file**. `docs/assets/js/engine.js` renders everything else. The reference page is `docs/data/sql/joins.js` together with `docs/assets/js/widgets/sql/joins.js`.

```js
IA.register({
  track: 'sql', slug, title, tagline: 'HTML',
  tldr: { problem, model, hook, facts: [{ v, l } ×3] },
  intro: { what, analogy?: { icon, title, text }, steps: [{ t, d, code? }], widget?, terms?: [[k, v]] },  // beginner "Start here"
  visual: { title, caption },                       // rendered by IA.widget(slug)
  extras?: [{ id, title, label?, caption? }],       // more widgets: IA.widget(id)
  playground?: { setup: 'SQL', presets: [{ label, sql, note? }] },   // runs in PGlite
  gotchas: [{ trap, code?, why, fix }],             // 4–7
  scenarios: [{ title, symptom, diagnose?, cause?, fix, fixCode? }], // 2–4 incidents
  puzzles: [{ kind, q, code?, options: [], answer: idx, explain }],  // 5–8, verified against real PG
  interview: [{ q, a: 'HTML', fu?, lvl: 'core'|'deep' }],            // 8–12
  code?: [{ title, lang, code, note? }]             // Java / Spring tie-in
});
```
Rules: keep prose short; prefer something the reader can see or click. State Postgres version-specific behaviour explicitly (e.g. “PG12+”).
