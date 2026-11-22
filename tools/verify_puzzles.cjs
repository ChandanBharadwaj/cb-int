#!/usr/bin/env node
/* Runs every puzzle marked `run: true` and compares stdout with `expect`.
   Java → `java Main.java` (JDK 21), Python → `python3`, Node → `node` (CommonJS).
   Usage: node tools/verify_puzzles.cjs [track ...]        (default: java python nodejs)
   Writes a JSON report to stdout's last line and a readable summary above it. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const RUNNERS = {
  java: { file: 'Main.java', cmd: (f) => ['java', [f]] },
  python: { file: 'main.py', cmd: (f) => ['python3', ['-I', f]] },
  nodejs: { file: 'main.js', cmd: (f) => ['node', [f]] },
};
// drills reuse puzzles from the whole track
const tracks = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(RUNNERS);

function loadTopic(file) {
  let data = null;
  const IA = { register: (d) => { data = d; }, widget: () => {}, h: {} };
  new Function('IA', 'window', fs.readFileSync(file, 'utf8'))(IA, { IA });
  return data;
}

// tricky-* drills may keep their questions in another field; collect any array of puzzle-like objects
function puzzlesOf(d) {
  const out = [];
  const seen = new Set();
  (function walk(v, where) {
    if (!v || typeof v !== 'object' || seen.has(v)) return; seen.add(v);
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, where + '[' + i + ']')); return; }
    if (v.run === true && typeof v.code === 'string') out.push({ p: v, where });
    for (const k of Object.keys(v)) walk(v[k], where + '.' + k);
  })(d, '');
  return out;
}

const norm = (s) => String(s == null ? '' : s).replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').trim();
const results = [];
for (const track of tracks) {
  const R = RUNNERS[track];
  if (!R) { console.error('No runner for track ' + track); continue; }
  const dir = path.join(DOCS, 'data', track);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
    let d;
    try { d = loadTopic(path.join(dir, f)); } catch (e) { results.push({ track, slug: f, where: '(load)', ok: false, error: 'data file failed to load: ' + e.message }); continue; }
    // drills (tricky-*) keep their questions in the widget, between /*Q-START*/ and /*Q-END*/
    const wf = path.join(DOCS, 'assets/js/widgets', track, f);
    if (/^tricky/.test(f) && fs.existsSync(wf)) {
      const src = fs.readFileSync(wf, 'utf8');
      const m = src.match(/\/\*Q-START\*\/([\s\S]*?)\/\*Q-END\*\//);
      if (m) {
        try { d = Object.assign({}, d, { drill: new Function(m[1].replace(/^\s*(const|let|var)\s+(\w+)\s*=/, 'return ') + '')() }); }
        catch (e) { results.push({ track, slug: f, where: '(drill)', ok: false, error: 'drill questions failed to load: ' + e.message }); }
      }
    }
    for (const { p, where } of puzzlesOf(d)) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pz-'));
      const file = path.join(tmp, R.file);
      fs.writeFileSync(file, p.code);
      const [cmd, args] = R.cmd(file);
      const r = spawnSync(cmd, args, { cwd: tmp, encoding: 'utf8', timeout: 30000, env: Object.assign({}, process.env, { NODE_OPTIONS: '' }) });
      fs.rmSync(tmp, { recursive: true, force: true });
      const got = norm(r.stdout);
      const want = norm(p.expect);
      const ok = p.expect != null && got === want;
      results.push({ track, slug: d.slug || f, where, ok, expect: want, got, stderr: ok ? undefined : norm(r.stderr).slice(0, 600), status: r.status, q: (p.q || '').replace(/<[^>]+>/g, '').slice(0, 90) });
    }
  }
}
const bad = results.filter((r) => !r.ok);
for (const r of bad) {
  console.log(`✗ ${r.track}/${r.slug} ${r.where}  ${r.q || ''}`);
  if (r.error) { console.log('   ' + r.error); continue; }
  console.log('   expect: ' + JSON.stringify(r.expect));
  console.log('   got:    ' + JSON.stringify(r.got) + (r.status ? '  (exit ' + r.status + ')' : ''));
  if (r.stderr) console.log('   stderr: ' + r.stderr.split('\n').slice(0, 4).join(' | '));
}
const byTrack = {};
results.forEach((r) => { const t = (byTrack[r.track] = byTrack[r.track] || { run: 0, ok: 0 }); t.run++; if (r.ok) t.ok++; });
console.log('\nSummary: ' + Object.entries(byTrack).map(([t, v]) => `${t} ${v.ok}/${v.run}`).join(' · '));
fs.writeFileSync(path.join(os.tmpdir(), 'verify_puzzles.json'), JSON.stringify(results, null, 1));
process.exit(bad.length ? 1 : 0);
