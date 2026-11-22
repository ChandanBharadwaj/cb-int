# cb-int: all interview-prep tracks in one repo

One repo and one GitHub Pages site for every track. Each track keeps its original folder structure, content and design. The tracks used to be separate repos.

**Live site:** https://chandanbharadwaj.github.io/cb-int/

| Track | Folder in this repo | URL | Formerly |
|---|---|---|---|
| Landing page | `home/` | `/cb-int/` | (new) |
| SQL & Postgres Atlas | `docs/` | `/cb-int/sql-atlas/` | cb-int |
| Modern AI/ML & GenAI | `cb-ml/` | `/cb-int/cb-ml/` | cb-ml |
| The Missing Middle (Transformers) | `cb-ml-transformers/` | `/cb-int/cb-ml-transformers/` | cb-ml-transformers |
| System Design Atlas | `cb-sys-design/` (site in `cb-sys-design/docs/`) | `/cb-int/cb-sys-design/` | cb-sys-design |
| DSA Interview Runbook | `dsa-interview/` | `/cb-int/dsa-interview/` | dsa-interview |

Each track folder has its own README with its details.

## GitHub Pages
`.github/workflows/pages.yml` copies each folder into place and deploys on every push to `main`.
One-time setup: **Settings → Pages → Source → GitHub Actions**.

Workflows inside the track folders (for example `cb-ml-transformers/.github/`) came from the old repos. GitHub ignores them.

## Run locally
Build the same layout that the workflow deploys:
```bash
rm -rf _site && mkdir _site && cp -a home/. _site/ && cp -a docs _site/sql-atlas \
  && cp -a cb-ml cb-ml-transformers dsa-interview _site/ && cp -a cb-sys-design/docs _site/cb-sys-design
cd _site && python3 -m http.server 8000
```
You can also serve a single track straight from its own folder. For the SQL Atlas, `cd docs && python3 -m http.server 8000` works as before.

SQL Atlas: see `TRACKER.md` for progress and `tools/AUTHORING.md` for the page schema.
