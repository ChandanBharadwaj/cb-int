/* npm & dependencies: a semver range explorer on a version number line, plus a lockfile story
   (npm ci vs npm install without a lockfile, a regression and a hijacked release). */
IA.widget('npm-dependencies', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-npm-style')) {
    document.head.append(el('style', { id: 'w-npm-style', text: `
.w-npm .ax { stroke: var(--border); stroke-width: 2; }
.w-npm .dot { fill: var(--surface); stroke: var(--text-3); stroke-width: 2; transition: fill .3s, stroke .3s, opacity .3s; }
.w-npm .dot.m { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 3; }
.w-npm .dot.pick { fill: var(--accent); stroke: var(--accent); }
.w-npm .dot.pre { stroke-dasharray: 3 3; }
.w-npm .dot.bad { stroke: var(--err); }
.w-npm .dot.na { opacity: .18; }
.w-npm .vl { fill: var(--text-2); font-size: 12px; font-family: var(--mono); transition: opacity .3s; }
.w-npm .vl.m { fill: var(--accent); font-weight: 700; }
.w-npm .vl.na { opacity: .25; }
.w-npm .band { fill: var(--accent-soft); opacity: .6; transition: x .4s, width .4s; }
.w-npm-envs { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; margin-top: 10px; }
.w-npm-env { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--surface-2); min-width: 0; }
.w-npm-env .h { font-size: 12px; color: var(--text-3); }
.w-npm-env .v { font-family: var(--mono); font-size: 17px; font-weight: 700; margin-top: 2px; }
.w-npm-env.ok { border-color: var(--ok); } .w-npm-env.ok .v { color: var(--ok); }
.w-npm-env.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 10%, var(--surface-2)); } .w-npm-env.bad .v { color: var(--err); }
.w-npm-env.off { opacity: .45; }
` }));
  }
  // ---------- tiny semver ----------
  const parse = (v) => { const [core, pre] = v.split('-'); const [M, m, p] = core.split('.').map(Number); return { M, m, p, pre: pre || null, v }; };
  const cmp = (a, b) => (a.M - b.M) || (a.m - b.m) || (a.p - b.p) || (a.pre === b.pre ? 0 : a.pre === null ? 1 : b.pre === null ? -1 : (a.pre < b.pre ? -1 : 1));
  const RANGES = {
    '^1.4.2': { lo: '1.4.2', hi: '2.0.0', say: '<code>^1.4.2</code> = <code>&gt;=1.4.2 &lt;2.0.0</code>: any minor or patch release in 1.x.' },
    '~1.4.2': { lo: '1.4.2', hi: '1.5.0', say: '<code>~1.4.2</code> = <code>&gt;=1.4.2 &lt;1.5.0</code>: patch releases only.' },
    '1.4.2': { lo: '1.4.2', hi: '1.4.3', say: '<code>1.4.2</code>: exactly that version (but its own dependencies can still float).' },
    '^0.4.2': { lo: '0.4.2', hi: '0.5.0', say: '<code>^0.4.2</code> = <code>&gt;=0.4.2 &lt;0.5.0</code>: below 1.0 the caret treats the <b>minor</b> as breaking.' },
    '>=1.4.2': { lo: '1.4.2', hi: null, say: '<code>&gt;=1.4.2</code>: no upper bound, so a future 2.0 or 9.0 qualifies. Avoid in apps.' },
    '*': { lo: '0.0.0', hi: null, say: '<code>*</code>: any version. Prereleases are still excluded.' }
  };
  const sat = (range, ver) => { const r = RANGES[range]; const x = parse(ver); if (x.pre) return false; // no prerelease in our ranges → prereleases never match
    return cmp(x, parse(r.lo)) >= 0 && (!r.hi || cmp(x, parse(r.hi)) < 0); };
  const ALL = ['0.4.2', '0.4.7', '0.5.0', '1.3.0', '1.4.0', '1.4.2', '1.4.9', '1.5.0-rc.1', '1.5.0', '1.5.1', '2.0.0', '2.1.0-beta.1'];
  const DAY1 = ['0.4.2', '0.4.7', '0.5.0', '1.3.0', '1.4.0', '1.4.2', '2.0.0', '2.1.0-beta.1'];
  const BAD = { '1.5.0': 'regression', '1.5.1': 'hijacked: postinstall' };
  const LOCK = `"node_modules/tiny-date": {\n  "version": "1.4.2",\n  "resolved": "https://registry.npmjs.org/tiny-date/-/tiny-date-1.4.2.tgz",\n  "integrity": "sha512-…"   // tarball hash, checked on every install\n}`;
  const STORY = [
    { day: 1, avail: DAY1, envs: { laptop: 1 }, t: 'Day 1: you run <code>npm install tiny-date</code>. npm saves <code>"tiny-date": "^1.4.2"</code> in package.json, and the <b>lockfile</b> pins the exact version, tarball URL and integrity hash.' },
    { day: 20, avail: DAY1.concat(['1.4.9']), envs: { laptop: 1, mate: 1 }, t: 'Day 20: 1.4.9 is published. A teammate runs <code>npm ci</code>: it installs exactly what the lockfile says, 1.4.2, and fails if package.json and the lockfile disagree.' },
    { day: 30, avail: DAY1.concat(['1.4.9', '1.5.0-rc.1', '1.5.0']), envs: { laptop: 1, mate: 1, docker: 1 }, t: 'Day 30: 1.5.0 ships with a regression. The Docker build copies only <code>package.json</code> and runs <code>npm install</code>. With no lockfile, npm picks the <b>highest version in range</b>. Production now runs code nobody tested.' },
    { day: 31, avail: ALL, envs: { laptop: 1, mate: 1, docker: 1 }, t: 'Day 31: an attacker takes over the maintainer’s account and publishes 1.5.1 with a <code>postinstall</code> script. Any install that resolves to it runs that script <b>with your CI’s credentials</b>.' },
    { day: 31, avail: ALL, envs: { laptop: 1, mate: 1, docker: 1, fixed: 1 }, t: 'The fix: copy <code>package-lock.json</code> too and run <code>npm ci --ignore-scripts</code> (allow-list the few packages that need scripts). Bumps then arrive as reviewed PRs (Renovate/Dependabot) instead of by surprise.' }
  ];
  let range = '^1.4.2'; let k = 0; let gen = 0; let running = false; let speed = 3200;
  const seg = (opts, cur, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); set(v); }); s.append(b); }); return s; };
  const segR = seg(Object.keys(RANGES).map((r) => [r, r]), range, (v) => { range = v; render(); }, 'Version range');
  const segS = seg([[4400, 'Slow'], [3200, 'Normal'], [1600, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play the story' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const rangeSay = el('div', { class: 'tiny', style: { margin: '-4px 0 6px', fontSize: '13px' } });
  const line = svg('svg', { viewBox: '0 0 720 120', role: 'img', 'aria-label': 'Published versions on a number line; versions matching the range are highlighted' });
  const envs = el('div', { class: 'w-npm-envs' });
  const lockBox = el('div', { class: 'codebox', style: { marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-npm');
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'range in package.json' }), segR), rangeSay, el('div', { class: 'w-stage' }, line), envs, lockBox,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  lockBox.append(el('div', { class: 'ch', text: 'package-lock.json (excerpt)' }), el('pre', { html: IA.highlight(LOCK, 'js') }));

  const X = (i) => 40 + i * 57;
  function render() {
    const st = k ? STORY[k - 1] : null;
    const avail = st ? st.avail : ALL;
    const ok = (v) => avail.includes(v);
    const matches = ALL.filter((v) => ok(v) && sat(range, v));
    const pick = matches.slice().sort((a, b) => cmp(parse(a), parse(b))).pop();
    line.innerHTML = '';
    line.append(svg('line', { class: 'ax', x1: 10, y1: 60, x2: 710, y2: 60 }));
    ALL.forEach((v, i) => {
      const m = ok(v) && sat(range, v); const up = i % 2 === 0;
      const cls = 'dot' + (m ? ' m' : '') + (v === pick ? ' pick' : '') + (parse(v).pre ? ' pre' : '') + (BAD[v] && ok(v) ? ' bad' : '') + (ok(v) ? '' : ' na');
      line.append(svg('circle', { class: cls, cx: X(i), cy: 60, r: v === pick ? 11 : 8 }));
      line.append(svg('text', { class: 'vl' + (m ? ' m' : '') + (ok(v) ? '' : ' na'), x: X(i), y: up ? 38 : 92, 'text-anchor': 'middle', text: v }));
      if (BAD[v] && ok(v)) line.append(svg('text', { x: X(i), y: up ? 20 : 110, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--err)', text: BAD[v] }));
    });
    rangeSay.innerHTML = RANGES[range].say + (pick ? ` Highest match available now: <b>${pick}</b>.` : ' Nothing available matches.');
    // environments
    const lockOk = sat(range, '1.4.2');   // npm ci refuses a lockfile that doesn't satisfy package.json
    const E = [
      ['laptop', 'your laptop (lockfile)', '1.4.2', 'ok'],
      ['mate', 'teammate: npm ci', lockOk ? '1.4.2' : 'ERR: lock out of sync', lockOk ? 'ok' : 'bad'],
      ['docker', 'Docker: no lockfile, npm install', pick || 'no match', pick && BAD[pick] ? 'bad' : ''],
      ['fixed', 'Docker: lockfile + npm ci --ignore-scripts', lockOk ? '1.4.2' : 'ERR: lock out of sync', lockOk ? 'ok' : 'bad']
    ];
    envs.innerHTML = '';
    E.forEach(([id, h, v, cls]) => { const on = st && st.envs[id];
      envs.append(el('div', { class: 'w-npm-env ' + (on ? cls : 'off') }, el('div', { class: 'h', text: h }), el('div', { class: 'v', text: on ? v + (BAD[v] ? ' ⚠' : '') : '—' }))); });
    narr.firstChild.innerHTML = st ? st.t : 'Click a range to see which published versions it allows (prereleases are dashed). Then press <b>Play the story</b> to see what a lockfile protects you from.';
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `day <b>${st ? st.day : '—'}</b>` }), el('span', { class: 'w-stat', html: `matching versions <b>${matches.length}</b>` }), el('span', { class: 'w-stat', html: `step <b>${k}/${STORY.length}</b>` }));
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play the story'; k = 0; bStep.disabled = false; render(); }
  function step() { if (k >= STORY.length) return false; k++; render(); if (k >= STORY.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play the story'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play the story'; return; }
    if (k >= STORY.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 900 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play the story'; }
  });
  reset();
});
