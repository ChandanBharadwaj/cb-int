# Brief for review agents (validation phase)

The topic pages in `/home/user/cb-int/docs` were written by content agents (see `tools/AGENT_BRIEF.md` and `tools/AUTHORING.md`). Every page already loads with no errors and passes the layout checks. Every runnable Java/Python/Node puzzle (`run: true`) has been executed, and all of them print their `expect`. Your job is **factual accuracy** of what could not be executed.

## What to check, in priority order
1. **The flagged claims** listed in your prompt. The content agents themselves said they were unsure of these.
2. **Every concept/scenario puzzle** (no `run: true`) in your track: is the marked `answer` correct, and is exactly one option defensible? Then interview answers and gotchas for clear factual errors: wrong defaults, wrong version numbers, wrong behaviour, wrong API names.
3. **Version claims** ("GA in 1.33", "since Boot 3.4", "Java 21+") anywhere in the track.

## How to verify
- Use web search and fetch against **official** sources first: kubernetes.io, learn.microsoft.com, docs.spring.io, openjdk.org / docs.oracle.com, docs.python.org / peps.python.org, nodejs.org. Use release notes and KEPs/JEPs/PEPs for version numbers.
- If the web tools are unavailable or blocked, reason carefully from what you know and mark the item as "unverified (no web)" in your report. Don't change content you can't show is wrong.
- Local runtimes are available if you need to test JVM, Python or Node behaviour: `java` (JDK 21), `python3` (3.13), `node` (22). Use them in a scratch directory under `/tmp`, never inside the repo.

## How to fix
- Edit only the data and widget files of **your track**, by exact path, with minimal changes. Never run `sed`/scripts across a directory, and never edit `catalog.js`, `engine.js`, `site.css` or other tracks.
- When a claim is wrong: correct it. When it's uncertain and unverifiable: soften the wording (drop the exact version or number) rather than guessing.
- If you change a puzzle's correct option, update `answer` (the index) and `explain` together. Keep option positions varied.
- After editing a file: run `node --check <file>`. Then run `python3 tools/gen_shells.py >/dev/null && node tools/check_topic.cjs <track> <slug>` from `/home/user/cb-int`, which must print `1/1 pages pass`.
- Don't run any git command.

## Report
End with:
- **Fixed:** a list of `slug: what was wrong → what it says now (source)`.
- **Verified OK:** the flagged claims you confirmed, with their sources.
- **Softened / unverified:** anything you could not confirm.
