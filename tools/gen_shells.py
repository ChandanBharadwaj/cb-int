#!/usr/bin/env python3
"""Generate the HTML shells for every track in docs/assets/js/catalog.js:
   - docs/<track>/<slug>.html for every topic whose data file exists
   - docs/<track>/index.html (track page) from tools/track_index.tmpl.html
Tracks without modules (coming soon) are skipped."""
import json, pathlib, subprocess
TOOLS = pathlib.Path(__file__).resolve().parent
ROOT = TOOLS.parent / 'docs'
CATALOG = json.loads(subprocess.check_output(
    ['node', '-e', "global.window={};eval(require('fs').readFileSync(process.argv[1],'utf8'));console.log(JSON.stringify(window.IA_CATALOG))",
     str(ROOT / 'assets/js/catalog.js')]))
INDEX = (TOOLS / 'track_index.tmpl.html').read_text()
SHELL = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Interview Atlas</title>
<meta name="description" content="Interactive interview prep: {title}. {blurb}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/css/site.css">
<script>try{{var t=JSON.parse(localStorage.getItem("ia-theme")||'"light"');if(t!=="auto")document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light")}}catch(e){{document.documentElement.setAttribute("data-theme","light")}}</script>
</head>
<body>
<div id="app"><noscript>This page needs JavaScript for its animations and playground.</noscript></div>
<script src="../assets/js/catalog.js"></script>
<script src="../assets/js/engine.js"></script>
<script src="../data/{track}/{slug}.js"></script>
{widgets}
</body>
</html>
'''
DEFAULT_BLURB = 'Animated visual, gotchas, real-world incidents, puzzles and interview questions.'
esc = lambda s: s.replace('&', '&amp;').replace('"', '&quot;')

shells = pages = 0
for T in CATALOG['tracks']:
    if not T.get('modules'):
        continue
    tid = T['id']; ix = T.get('index', {}); tx = T.get('text', {})
    out = ROOT / tid; out.mkdir(exist_ok=True)
    (out / 'index.html').write_text(INDEX.format(
        name_html=T['name'], desc=esc(ix.get('desc', T.get('blurb', ''))), hero=ix.get('hero', esc(T['name'])),
        search=esc(ix.get('search', 'Search topics…')), foot=tx.get('footer', 'Interview Atlas'), track=tid))
    pages += 1
    for m in T['modules']:
        for t in m['topics']:
            slug = t['slug']
            if not (ROOT / f'data/{tid}/{slug}.js').exists():
                continue
            ws = sorted((ROOT / f'assets/js/widgets/{tid}').glob(f'{slug}*.js'))
            # a widget file belongs to this slug if its name is the slug or slug-<suffix> and no longer slug claims it
            all_slugs = {x['slug'] for mm in T['modules'] for x in mm['topics']}
            ws = [w for w in ws if w.stem == slug or (w.stem.startswith(slug + '-') and not any(
                  o != slug and len(o) > len(slug) and (w.stem == o or w.stem.startswith(o + '-')) for o in all_slugs))]
            tags = '\n'.join(f'<script src="../assets/js/widgets/{tid}/{w.name}"></script>' for w in ws)
            (out / f'{slug}.html').write_text(SHELL.format(title=t['title'].replace('&', '&amp;'), blurb=tx.get('metaDesc', DEFAULT_BLURB),
                                                           track=tid, slug=slug, widgets=tags))
            shells += 1
print(f'{shells} topic shells and {pages} track pages written')
