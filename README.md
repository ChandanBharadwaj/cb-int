# cb-int: Interview Atlas

A one-stop, **visual** interview-prep site: animated mechanisms, a real Postgres in the browser (PGlite), tricky puzzles, production incidents and interview questions. The first track is **SQL & Postgres** (46 topics, fundamentals → internals → choosing a database as an architect).

Look and feel adapted from [cb-sys-design](https://github.com/ChandanBharadwaj/cb-sys-design).

## GitHub Pages
Settings → Pages → Deploy from a branch → `main` / `/docs`.

## Run locally
```bash
cd docs && python3 -m http.server 8000
```
No build step. See `TRACKER.md` for progress and `tools/AUTHORING.md` for the page schema.
