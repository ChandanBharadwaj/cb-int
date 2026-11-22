# Authoring a topic page

Each topic is **one data file + one widget file**. `docs/assets/js/engine.js` renders everything else. The reference page is `docs/data/sql/joins.js` together with `docs/assets/js/widgets/sql/joins.js` (and `joins-intro.js` for the Start-here widget).

```js
IA.register({
  track: '<track id>', slug, title, tagline: 'HTML',
  lang?: 'java',                                    // default code language; else the track's `lang` from catalog.js
  tldr: { problem, model, hook, facts: [{ v, l } ×3] },
  intro: { what, analogy?: { icon, title, text }, steps: [{ t, d, code?, lang? }], widget?, terms?: [[k, v]] },  // beginner "Start here"
  visual: { title, caption },                       // rendered by IA.widget(slug)
  extras?: [{ id, title, label?, caption? }],       // more widgets: IA.widget(id)
  playground?: { kind?: 'sql'|'python'|'js', setup?, presets: [{ label, sql?|code?, note? }] },
  gotchas: [{ trap, code?, lang?, why, fix }],      // 4–7
  scenarios: [{ title, symptom, diagnose?, cause?, fix, fixCode?, lang? }], // 2–4 incidents
  puzzles: [{ kind, q, code?, lang?, options: [], answer: idx, explain, run?: true, expect?: 'exact stdout' }],  // 5–8
  interview: [{ q, a: 'HTML', fu?, lvl: 'core'|'deep' }],            // 8–12
  code?: [{ title, lang, code, note? }]             // tie-in tabs; section title comes from the track's `text` in catalog.js
});
```

## Playgrounds
- `kind: 'sql'` (default): PGlite, a real Postgres in the browser. Presets use `sql`, and `setup` is SQL.
- `kind: 'python'`: Pyodide (CPython in WASM). Presets use `code`. stdout and stderr are shown. Each run gets fresh globals. `setup` is optional Python that runs before each preset.
- `kind: 'js'`: a sandboxed Web Worker running the browser's JS engine. Presets use `code`. `console.log`, top-level `await`, timers and promises all work. **Node-only APIs don't exist here** (`process`, `require`, `setImmediate`, `fs`). Use it only for language and event-loop semantics that behave the same in the browser.

## Code languages
Highlighting supports `sql`, `java`, `python`, `js` (aliases: `ts`, `json`, `node`), `yaml`, `bash`, `bicep`, `kql`, `docker`, `go`, `lua` and `text`. Set `lang` on any code item whose language differs from the page default.

## Runnable puzzles (Java, Python, Node tracks)
When a puzzle asks what a program prints, make `code` a **complete program** and add `run: true` plus `expect` (the exact stdout, trimmed). Validation runs these at the end:
- **Java:** a single file, `public class Main { public static void main(String[] a) {…} }`, run with `java Main.java` (JDK 21).
- **Python:** a script, run with `python3` (3.12+).
- **Node:** a CommonJS script, run with `node` (22); top-level `await` needs an async IIFE.

Concept questions (no program) leave out `run` and `expect`.

## Widgets
`IA.widget('<id>', (root, ctx) => { … })`. `ctx` provides `el`, `svg`, `esc`, `reduced`, `css` (read a CSS variable), `sleep`, `clamp`, `loop`, `onVisible` and `codeBox`. Use CSS variables (`var(--accent)`, `var(--text)`, `var(--muted)`, `var(--line)`, `var(--card)`, …) so light and dark both work. Use existing classes (`w-controls`, `btn`, `seg`, `pill`, `card`, `tiny`). Draw SVG with a `viewBox` so it scales down to 390px. Honour `ctx.reduced` by skipping the animation and showing the end state.

Rules: keep prose short; prefer something the reader can see or click. State version-specific behaviour explicitly (e.g. “PG12+”, “Java 21+”, “K8s 1.29+”).
