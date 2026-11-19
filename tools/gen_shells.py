#!/usr/bin/env python3
"""Generate docs/<track>/<slug>.html shells for every topic whose data file exists."""
import pathlib, re
ROOT = pathlib.Path(__file__).resolve().parent.parent / 'docs'
cat = (ROOT / 'assets/js/catalog.js').read_text()
SHELL = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Interview Atlas</title>
<meta name="description" content="Interactive interview prep: {title}. Animated visual, Postgres playground, gotchas, real-world incidents, puzzles and interview questions.">
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
n = 0
for track in ('sql',):
    for slug, title in re.findall(r"slug: '([^']+)', title: '([^']+)'", cat):
        if not (ROOT / f'data/{track}/{slug}.js').exists():
            continue
        ws = sorted((ROOT / f'assets/js/widgets/{track}').glob(f'{slug}*.js'))
        tags = '\n'.join(f'<script src="../assets/js/widgets/{track}/{w.name}"></script>' for w in ws)
        (ROOT / track / f'{slug}.html').write_text(SHELL.format(title=title.replace('&', '&amp;'), track=track, slug=slug, widgets=tags))
        n += 1
print(f'{n} shells written')
