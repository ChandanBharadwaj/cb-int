/* Guard for wording-only rewrites of topic data files.
   Usage: node tools/guard_prose.cjs <git-ref> <data-file> [...]
   Compares each file with its version at <git-ref>: every code/expect/answer/run/slug/title/
   fact value and every runnable puzzle's options must be identical, and total prose length
   must not grow. Exits 1 on any problem. */
const fs = require('fs');
const { execFileSync } = require('child_process');
const KEEP = new Set(['code', 'fixCode', 'expect', 'answer', 'run', 'slug', 'track', 'title', 'v', 'lang', 'kind', 'id', 'widget', 'setup', 'lvl', 's']);
function load(src) {
  let d = null;
  new Function('IA', 'window', src)({ register: (x) => { d = x; }, widget: () => {}, h: {} }, {});
  return d;
}
function split(d) {
  const keep = [], prose = [];
  (function walk(v, k, parentRun) {
    if (Array.isArray(v)) { v.forEach((x) => walk(x, k, parentRun)); return; }
    if (v && typeof v === 'object') {
      const run = v.run === true;
      for (const key of Object.keys(v)) {
        if (key === 'options' && run) keep.push(JSON.stringify(v.options));
        else walk(v[key], key, run);
      }
      return;
    }
    if (KEEP.has(k)) keep.push(k + '=' + JSON.stringify(v));
    else if (typeof v === 'string') prose.push(v);
  })(d, '', false);
  return { keep, proseLen: prose.join('').length };
}
const [ref, ...files] = process.argv.slice(2);
let bad = 0;
for (const f of files) {
  const before = split(load(execFileSync('git', ['show', `${ref}:${f}`], { encoding: 'utf8' })));
  const after = split(load(fs.readFileSync(f, 'utf8')));
  const problems = [];
  if (before.keep.length !== after.keep.length) problems.push(`kept-field count ${before.keep.length} → ${after.keep.length}`);
  else before.keep.forEach((x, i) => { if (x !== after.keep[i]) problems.push('changed: ' + x.slice(0, 80)); });
  if (after.proseLen > before.proseLen * 1.05) problems.push(`prose grew ${before.proseLen} → ${after.proseLen}`);
  console.log((problems.length ? 'FAIL ' : 'ok   ') + f + `  prose ${before.proseLen} → ${after.proseLen}`);
  problems.slice(0, 5).forEach((p) => console.log('     ' + p));
  if (problems.length) bad++;
}
process.exit(bad ? 1 : 0);
