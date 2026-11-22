# Brief for content agents (Interview Atlas tracks)

You are writing topic pages for the **Interview Atlas**, a static, visual interview-prep site in `/home/user/cb-int/docs`. Its reader is an experienced Java / Spring Boot / Postgres developer who also builds AI agents in Python. Pages must be accurate, visual and practical: what you would want open the night before a senior interview, and again during a production incident.

## Phase rule: content first
Write the content. **Do not** run browsers, Playwright, site builds or test suites, and do not execute puzzle programs; validation happens later, in a separate phase. The only check allowed is `node --check <file>` on the files you wrote, to catch syntax errors.

## Files you may touch, and nothing else
- `docs/data/<track>/<slug>.js`: the data file (one per topic).
- `docs/assets/js/widgets/<track>/<slug>.js`: the main animated visual (required).
- Optional: `docs/assets/js/widgets/<track>/<slug>-intro.js` (Start-here widget) and `<slug>-<extra>.js` for `extras`.

Never edit `catalog.js`, `engine.js`, `site.css`, other tracks, other agents' slugs, or anything outside those paths. **Do not run `git add`/`commit`/`push`.** Other agents are writing in the same tree at the same time.

## Read first (in this order)
1. `tools/AUTHORING.md`: the schema, playground kinds, code languages, runnable puzzles and widget rules.
2. `docs/data/sql/joins.js` + `docs/assets/js/widgets/sql/joins.js` + `docs/assets/js/widgets/sql/joins-intro.js`: the reference topic (tone, density, widget style).
3. `docs/data/sql/mvcc-vacuum.js` + `docs/assets/js/widgets/sql/mvcc-vacuum.js`: a deep, internals-heavy reference.
4. `docs/assets/js/engine.js`, lines 1–170: the helpers widgets receive (`el`, `svg`, `loop`, `onVisible`, …).
5. `docs/assets/css/site.css`: skim for the CSS variables and widget classes (`w-controls`, `btn`, `seg`, `pill`, `tiny`, `card`).
6. `docs/assets/js/catalog.js`: your track's entry (`lang`, `text`) and your topics' `title`, `sub` (subtopics) and `depth`.
7. Drill topics (`tricky-*`) only: also read `docs/data/sql/tricky-50.js` and `docs/assets/js/widgets/sql/tricky-50.js`, and build the drill the same way (timed, scored, per-topic breakdown, review of misses linking back to the topic pages).

## Every topic must have
- `track`, `slug` and `title` exactly as in `catalog.js`. `title` may add a little flavour, but keep the catalog meaning.
- **tagline + tldr**: problem, mental model, interview hook and 3 `facts`. Facts must be real and checkable; never invent statistics.
- **intro (Start here)**: plain-words `what`, an `analogy`, 3–5 `steps` and 4–6 `terms`. Assume a smart beginner.
- **visual**: an animated, step-through widget (`IA.widget('<slug>', …)`) that makes the core mechanism visible: Play, Step and Reset controls, plus a caption explaining what to click. Cover the topic's subtopics, or put a second mechanism in `extras`.
  - SVG uses a `viewBox` and scales to 390px wide.
  - Colours come only from CSS variables, so light and dark both work.
  - Honour `ctx.reduced`.
  - No external libraries, images or network calls.
- **gotchas**: 4–7, each with trap, why and fix, and code where it helps.
- **scenarios**: 2–4 production incidents laid out as symptom → diagnose → cause → fix (with `fixCode`). Make them realistic composites. Don't attribute incidents to named companies unless a public postmortem exists and you are sure of the details.
- **puzzles**: 5–8, the kind interviewers ask. They need plausible distractors, the right `answer` index, and an `explain` that teaches.
- **interview**: 8–12 Q&As mixing `core` and `deep`. Answers are short HTML paragraphs or lists; add `fu` (follow-up) where natural.
- **code**: 2–4 tabs tying the topic to real work. Every code item needs the right `lang`.
- Subtopics listed in the catalog for your topic must each be covered somewhere on the page.

## Accuracy rules
- State versions explicitly where behaviour depends on them (Java 21, Boot 3.x, K8s 1.30+, Python 3.12/3.13, Node 22, the Azure service tier).
- Runnable puzzles (Java / Python / Node tracks): when a puzzle asks what a program prints, make `code` a complete program and add `run: true` and `expect` (exact stdout), as described in AUTHORING.md. Work out the output carefully by reasoning; it will be executed in the validation phase.
- When unsure of a fact, leave it out or phrase it conservatively. Say “typically” only when that's true.

## Style
Short sentences and plain English. Use typographic quotes like the reference (“ ” ’). Prefer something the reader can see or click over a paragraph. Inline HTML is allowed in text fields (`<b>`, `<code>`, `<i>`, `<a href="other-slug.html">`). Link only to slugs of your own track that exist in `catalog.js`.

## When you finish
Reply with a short report:
- **Written:** each slug, with its puzzle count and how many are `run: true`.
- **Uncertain:** any facts or puzzle answers you are not sure of (slug + what).
- **Skipped:** anything you could not finish, and why.
