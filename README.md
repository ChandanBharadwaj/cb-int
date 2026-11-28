# cb-int: all interview-prep tracks in one repo

One repo and one GitHub Pages site for every track. Each track keeps its original folder structure, content and design. The tracks used to be separate repos.

**Live site:** https://chandanbharadwaj.github.io/cb-int/

| Track | Folder in this repo | URL | Formerly |
|---|---|---|---|
| Landing page | `home/` | `/cb-int/` | (new) |
| Interview Atlas: SQL & Postgres, Java & JVM, Spring & Spring Boot, Kubernetes, Python, Node.js, Azure, Spark & PySpark, TypeScript, Vue.js, Modern frontend, Databricks | `docs/` (one folder per track) | `/cb-int/atlas/<track>/` (old `/cb-int/sql-atlas/…` links redirect) | cb-int |
| Modern AI/ML & GenAI | `cb-ml/` | `/cb-int/cb-ml/` | cb-ml |
| The Missing Middle (Transformers) | `cb-ml-transformers/` | `/cb-int/cb-ml-transformers/` | cb-ml-transformers |
| Design Atlas: System Design (53 systems) and Software Architecture (64 topics) | `cb-sys-design/` (site in `cb-sys-design/docs/`) | `/cb-int/cb-sys-design/system-design/` and `/cb-int/cb-sys-design/architecture/` | cb-sys-design (`main` plus the unmerged Architecture and HLD-pages branches, merged here) |
| DSA Interview Runbook | `dsa-interview/` | `/cb-int/dsa-interview/` | dsa-interview (`main`) |

Each track folder has its own README with its details.

## Global navigation and search
Every page of the deployed site has a small floating pill in the bottom-right corner:
- **⌂ All tracks** goes back to the landing page.
- **⌕ Search** (or Ctrl/⌘ K) searches every page of every track.

On System Design pages, Ctrl/⌘ K and `/` still open that site's own systems search, so use the button there.

The widget renders inside a Shadow DOM, so it can't change any track's CSS. It is added at **deploy time**: the files in this repo are never edited.

## GitHub Pages
`.github/workflows/pages.yml` runs `tools/site/build.cjs` on every push to `main`. The script:
1. copies each track folder into `_site/` unchanged;
2. opens every page in headless Chromium and writes `_site/site/search-index.json` (SQL Atlas and System Design build their text with JavaScript, so raw HTML isn't enough);
3. adds one `<script src=".../site/nav.js">` tag to each page in `_site/`.

One-time setup: **Settings → Pages → Source → GitHub Actions**.

Workflows inside the track folders (for example `cb-ml-transformers/.github/`) came from the old repos. GitHub ignores them.

## Run locally
```bash
node tools/site/build.cjs _site        # needs Playwright: npm i --prefix tools/site playwright
cd _site && python3 -m http.server 8000
```
The widget and search live in `home/site/nav.js`, and the landing page is `home/index.html`.
You can also serve a single track straight from its own folder. For the SQL Atlas, `cd docs && python3 -m http.server 8000` works as before.

Interview Atlas: `TRACKER.md` (SQL) and `TRACKS-TRACKER.md` (the other tracks, starting with Java, Spring, Kubernetes, Python, Node.js and Azure) track progress. `tools/AUTHORING.md` is the page schema, `tools/AGENT_BRIEF.md` the brief for content agents, and `python3 tools/gen_shells.py` regenerates the HTML shells and track pages.
