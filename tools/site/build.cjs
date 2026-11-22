#!/usr/bin/env node
/* Builds the deployable site:
   1. copies every track folder into OUT, unchanged (same layout as the old separate sites)
   2. renders every page in headless Chromium and writes OUT/site/search-index.json
      (SQL Atlas and System Design build their text with JS, so raw HTML is not enough)
   3. adds one <script> tag for the global "All tracks + Search" widget to each page in OUT
   The source folders in the repo are never modified.
   Usage: node tools/site/build.cjs [outDir=_site] */
const fs = require('fs');
const path = require('path');
const http = require('http');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(REPO, process.argv[2] || '_site');
const TEXT_CAP = 16000;   // characters of body text indexed per page

// [source in repo, destination under OUT, track key]
const TRACKS = [
  ['docs', 'atlas'],          // Interview Atlas: SQL, Java, Spring, Kubernetes, Python, Node.js, Azure
  ['cb-ml', 'cb-ml'],
  ['cb-ml-transformers', 'cb-ml-transformers'],
  ['cb-sys-design/docs', 'cb-sys-design'],
  ['dsa-interview', 'dsa-interview'],
];

function copyDir(src, dst) {
  fs.cpSync(src, dst, {
    recursive: true,
    filter: (p) => !['.git', '.github', 'node_modules'].includes(path.basename(p)),
  });
}

function htmlFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.html')) out.push(p);
    }
  })(dir);
  return out.sort();
}

function assemble() {
  fs.rmSync(OUT, { recursive: true, force: true });
  copyDir(path.join(REPO, 'home'), OUT);
  for (const [src, dst] of TRACKS) copyDir(path.join(REPO, src), path.join(OUT, dst));
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain', '.data': 'application/octet-stream' };
function serve(root) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = path.join(root, p);
    if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

// Runs inside each page: title, section headings (with anchor ids) and body text,
// leaving out navigation/sidebars so every page in a track doesn't match every topic name.
function extract() {
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script,style,noscript,template,svg,canvas,nav,aside,header,footer,[role=navigation],[aria-hidden=true],' +
    '#top,.topbar,.sidebar,.side,.drawer,.toc,.gnav,.gn-panel,.tn,.tracknav,#cb-global-nav').forEach((n) => n.remove());
  // keep words from neighbouring blocks apart ("logic" + "Fundamentals" → "logic Fundamentals")
  const INLINE = new Set(['A', 'B', 'I', 'EM', 'STRONG', 'CODE', 'MARK', 'SUB', 'SUP', 'SMALL', 'U', 'S', 'ABBR', 'KBD', 'VAR']);
  clone.querySelectorAll('*').forEach((e) => { if (!INLINE.has(e.tagName)) e.append(' '); });
  clone.querySelectorAll('a').forEach((a) => { if (/^skip to/i.test((a.textContent || '').trim())) a.remove(); });
  const clean = (s) => (s || '').replace(/\s+/g, ' ').replace(/\s+([.,;:!?)])/g, '$1').trim();
  const h1 = clone.querySelector('h1');
  const headings = [];
  clone.querySelectorAll('h1,h2,h3').forEach((h) => {
    const t = clean(h.textContent);
    if (!t || t.length > 140) return;
    let id = h.id || '';
    if (!id) { const sec = h.closest('section[id],div[id]'); if (sec && sec.querySelectorAll('h1,h2,h3')[0] === h) id = sec.id; }
    headings.push([t, id]);
  });
  return { title: clean(h1 && h1.textContent) || clean(document.title), headings, text: clean(clone.textContent) };
}

// Search filter key: each Atlas track gets its own (atlas-java, atlas-sql, …); other sites use their folder.
function trackKey(rel) {
  const p = rel.split('/');
  if (p[0] === 'atlas') return p.length > 2 ? 'atlas-' + p[1] : 'atlas';
  return p[0];
}

// The Atlas used to be served at sql-atlas/. Keep every old URL working (hash and query included).
function redirectStubs() {
  const atlas = path.join(OUT, 'atlas');
  let n = 0;
  for (const f of htmlFiles(atlas)) {
    const rel = path.relative(atlas, f).split(path.sep).join('/');
    const stub = path.join(OUT, 'sql-atlas', rel);
    const up = '../'.repeat(rel.split('/').length);
    const target = up + 'atlas/' + rel;
    fs.mkdirSync(path.dirname(stub), { recursive: true });
    fs.writeFileSync(stub, '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex" data-cb-redirect>' +
      '<title>Moved</title><link rel="canonical" href="' + target + '"><meta http-equiv="refresh" content="0; url=' + target + '">' +
      '<script>location.replace(' + JSON.stringify(target) + ' + location.search + location.hash)</script></head>' +
      '<body><p>This page moved to <a href="' + target + '">' + target + '</a>.</p></body></html>');
    n++;
  }
  console.log('Wrote ' + n + ' sql-atlas/ redirect stubs');
}

async function buildIndex() {
  const { chromium } = require('playwright');
  const srv = await serve(OUT);
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const files = htmlFiles(OUT)
    .map((f) => path.relative(OUT, f).split(path.sep).join('/'))
    .filter((r) => r !== 'index.html' && !r.endsWith('404.html') && TRACKS.some(([, d]) => r.startsWith(d + '/')));
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const pages = []; const failed = [];
  let next = 0;
  async function worker() {
    const pg = await ctx.newPage();
    while (next < files.length) {
      const rel = files[next++];
      try {
        await pg.goto(base + rel, { waitUntil: 'load', timeout: 45000 });
        await pg.waitForTimeout(250);
        const r = await pg.evaluate(extract);
        pages.push({ u: rel.replace(/(^|\/)index\.html$/, '$1'), t: r.title, k: trackKey(rel), h: r.headings, x: r.text.slice(0, TEXT_CAP) });
      } catch (e) { failed.push(rel + ': ' + e.message.split('\n')[0]); }
    }
    await pg.close();
  }
  await Promise.all([0, 1, 2, 3].map(worker));
  await browser.close(); srv.close();
  if (failed.length) { console.error('Could not index:\n  ' + failed.join('\n  ')); process.exit(1); }
  const order = TRACKS.map(([, d]) => d);
  pages.sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k) || a.u.localeCompare(b.u));
  fs.mkdirSync(path.join(OUT, 'site'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'site', 'search-index.json'), JSON.stringify({ built: new Date().toISOString(), pages }));
  console.log('Indexed ' + pages.length + ' pages');
}

function inject() {
  const nav = path.join(OUT, 'site', 'nav.js');
  let n = 0;
  for (const f of htmlFiles(OUT)) {
    const rel = path.relative(OUT, f).split(path.sep).join('/');
    if (rel === 'index.html' || rel.endsWith('404.html')) continue;   // landing loads it itself; 404s are standalone
    let html = fs.readFileSync(f, 'utf8');
    if (html.includes('data-cb-global') || html.includes('data-cb-redirect')) continue;
    const src = path.relative(path.dirname(f), nav).split(path.sep).join('/');
    const tag = '<script src="' + src + '" defer data-cb-global></script>';
    const i = html.toLowerCase().lastIndexOf('</body>');
    html = i === -1 ? html + '\n' + tag + '\n' : html.slice(0, i) + tag + '\n' + html.slice(i);
    fs.writeFileSync(f, html); n++;
  }
  console.log('Added the global nav to ' + n + ' pages');
}

(async () => {
  assemble();
  await buildIndex();
  redirectStubs();
  inject();
  console.log('Site ready in ' + path.relative(REPO, OUT) + '/');
})().catch((e) => { console.error(e); process.exit(1); });
