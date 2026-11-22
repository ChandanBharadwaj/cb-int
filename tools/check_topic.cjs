#!/usr/bin/env node
/* Loads topic pages in headless Chromium and checks them.
   Usage: node tools/check_topic.cjs <track|all> [slug ...] [--shots <dir>]
   Fails a page on: console/page errors, missing required sections, an empty visual widget,
   or horizontal scroll at 390px. Run `python3 tools/gen_shells.py` first. */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const DOCS = path.resolve(__dirname, '..', 'docs');
const args = process.argv.slice(2);
const shotIdx = args.indexOf('--shots');
const SHOTS = shotIdx >= 0 ? path.resolve(args[shotIdx + 1]) : null;
if (shotIdx >= 0) args.splice(shotIdx, 2);
const [trackArg, ...slugArgs] = args;
const REQUIRED = ['overview', 'start', 'visual', 'gotchas', 'real-world', 'puzzles', 'interview'];

global.window = {};
eval(fs.readFileSync(path.join(DOCS, 'assets/js/catalog.js'), 'utf8'));
const catalog = global.window.IA_CATALOG;

const targets = [];
for (const T of catalog.tracks) {
  if (!T.modules || !T.modules.length) continue;
  if (trackArg !== 'all' && trackArg !== T.id) continue;
  for (const m of T.modules) for (const t of m.topics) {
    if (slugArgs.length && !slugArgs.includes(t.slug)) continue;
    if (!fs.existsSync(path.join(DOCS, 'data', T.id, t.slug + '.js'))) continue;
    targets.push({ track: T.id, slug: t.slug, drill: t.slug.startsWith('tricky') });
  }
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm' };
function serve() {
  const srv = http.createServer((req, res) => {
    let f = path.join(DOCS, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    fs.readFile(f, (err, buf) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(buf); });
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await chromium.launch();
  const results = [];
  let next = 0;
  async function worker() {
    const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    while (next < targets.length) {
      const t = targets[next++];
      const url = base + t.track + '/' + t.slug + '.html';
      const problems = [];
      for (const [ctx, label] of [[desk, 'desktop'], [phone, 'phone']]) {
        const pg = await ctx.newPage();
        if (label === 'phone') await pg.addInitScript(() => { try { localStorage.setItem('ia-theme', '"dark"'); } catch (e) {} });
        pg.on('pageerror', (e) => problems.push(label + ' pageerror: ' + e.message.split('\n')[0]));
        pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) problems.push(label + ' console: ' + m.text().slice(0, 200)); });
        pg.on('requestfailed', (r) => { if (r.url().startsWith(base)) problems.push(label + ' 404: ' + r.url().replace(base, '')); });
        pg.on('response', (r) => { if (r.url().startsWith(base) && r.status() >= 400) problems.push(label + ' ' + r.status() + ': ' + r.url().replace(base, '')); });
        try { await pg.goto(url, { waitUntil: 'load', timeout: 30000 }); } catch (e) { problems.push(label + ' load: ' + e.message.split('\n')[0]); }
        await pg.waitForTimeout(400);
        const info = await pg.evaluate((req) => {
          const ids = [...document.querySelectorAll('section[id]')].map((s) => s.id);
          const vis = document.querySelector('#visual .widget-body');
          return {
            ids, missing: req.filter((r) => !ids.includes(r)),
            visualEmpty: !vis || (vis.children.length === 0 && !vis.textContent.trim()),
            failed: !!document.querySelector('#visual .muted') && /failed/i.test(document.querySelector('#visual').textContent),
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        }, t.drill ? ['overview'] : REQUIRED).catch((e) => ({ missing: ['(evaluate failed: ' + e.message + ')'], ids: [] }));
        if (label === 'desktop') {
          if (info.missing && info.missing.length) problems.push('missing sections: ' + info.missing.join(', '));
          if (!t.drill && info.visualEmpty) problems.push('visual widget is empty');
          if (info.failed) problems.push('visual widget threw on load');
        } else if (info.overflow > 1) problems.push('horizontal scroll at 390px: +' + info.overflow + 'px');
        if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `${t.track}--${t.slug}--${label}.png`) }); }
        await pg.close();
      }
      results.push({ track: t.track, slug: t.slug, ok: problems.length === 0, problems: [...new Set(problems)] });
    }
    await desk.close(); await phone.close();
  }
  await Promise.all([0, 1, 2, 3].map(worker));
  await browser.close(); srv.close();
  results.sort((a, b) => (a.track + a.slug).localeCompare(b.track + b.slug));
  for (const r of results.filter((x) => !x.ok)) console.log('✗ ' + r.track + '/' + r.slug + '\n   ' + r.problems.join('\n   '));
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} pages pass`);
  fs.writeFileSync(path.join(require('os').tmpdir(), 'check_topic.json'), JSON.stringify(results, null, 1));
  process.exit(ok === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
