/* Dependency conflicts: two paths to jackson-databind; see which version Maven (nearest wins), the Boot BOM, Gradle (highest wins) and overrides pick. */
IA.widget('starters-dependencies', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-dep-style')) {
    document.head.append(el('style', { id: 'w-dep-style', text: `
.w-dep svg text { font-family: var(--mono); }
.w-dep .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.6; transition: fill .3s, stroke .3s, opacity .3s; }
.w-dep .bx.idle { opacity: .3; }
.w-dep .bx.hot { stroke: var(--warn); stroke-width: 2.6; fill: color-mix(in srgb, var(--warn) 14%, var(--surface)); }
.w-dep .bx.win { stroke: var(--ok); stroke-width: 2.8; fill: color-mix(in srgb, var(--ok) 13%, var(--surface)); }
.w-dep .bx.lose { opacity: .45; stroke-dasharray: 5 4; }
.w-dep .bx.bom { stroke: var(--accent); stroke-width: 2; fill: var(--accent-soft); }
.w-dep .bx.bad { stroke: var(--err); stroke-width: 2.6; fill: color-mix(in srgb, var(--err) 12%, var(--surface)); }
.w-dep .ln { fill: none; stroke: var(--edge); stroke-width: 1.7; }
.w-dep .ln.on { stroke: var(--text-3); }
.w-dep .ln.win { stroke: var(--ok); stroke-width: 2.6; }
.w-dep .ln.bom { stroke: var(--accent); stroke-width: 2.4; stroke-dasharray: 6 4; }
` }));
  }
  const BOMV = '2.17.2'; const OVR = '2.18.2';
  const MODES = {
    mvn: { label: 'Maven, no BOM', rule: 'nearest definition wins (then first declared)' },
    mvnbom: { label: 'Maven + Boot parent/BOM', rule: '<dependencyManagement> wins at any depth' },
    mvnovr: { label: 'Maven + property override', rule: '<jackson-bom.version> rewrites the BOM' },
    gradle: { label: 'Gradle, no platform', rule: 'highest version wins' },
    gplat: { label: 'Gradle platform()', rule: 'platform versions are constraints; highest still wins' },
    gdm: { label: 'Gradle + dependency-management plugin', rule: 'Maven-style: managed version is enforced' }
  };
  let mode = 'mvn'; let sdk = 'old'; let k = 0; let gen = 0; let running = false; let speed = 2400;
  const sdkV = () => (sdk === 'old' ? '2.12.7' : '2.18.1');
  const cmp = (a, b) => { const x = a.split('.').map(Number); const y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
  function winner() {
    const viaBoot = BOMV; const viaSdk = sdkV();
    switch (mode) {
      case 'mvn': return { v: viaSdk, from: 'sdk', why: 'The SDK’s path is 2 levels deep; Boot’s is 3. Maven picks the <b>nearest</b> declaration, regardless of version.' };
      case 'mvnbom': return { v: BOMV, from: 'bom', why: 'The Boot BOM (imported via <code>spring-boot-starter-parent</code> or <code>spring-boot-dependencies</code>) manages jackson-databind. Managed versions apply to transitive dependencies too.' };
      case 'mvnovr': return { v: OVR, from: 'bom', why: 'You set <code>&lt;jackson-bom.version&gt;' + OVR + '&lt;/jackson-bom.version&gt;</code>. The parent uses that property, so the whole Jackson family moves together.' };
      case 'gradle': return cmp(viaSdk, viaBoot) > 0 ? { v: viaSdk, from: 'sdk', why: 'Gradle resolves conflicts by picking the <b>highest</b> requested version.' } : { v: viaBoot, from: 'boot', why: 'Gradle resolves conflicts by picking the <b>highest</b> requested version.' };
      case 'gplat': return cmp(viaSdk, BOMV) > 0 ? { v: viaSdk, from: 'sdk', why: '<code>platform(…)</code> adds the BOM’s version as a <i>constraint</i> that takes part in conflict resolution. The SDK asks for a higher version, so the higher one still wins. Use <code>enforcedPlatform</code> or a strict constraint to force it.' } : { v: BOMV, from: 'bom', why: 'The platform constraint (' + BOMV + ') is higher than the SDK’s request, so it wins.' };
      default: return { v: BOMV, from: 'bom', why: 'The <code>io.spring.dependency-management</code> plugin applies Maven semantics: the managed version replaces whatever transitive dependencies ask for, higher or lower.' };
    }
  }
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segM = seg(Object.keys(MODES).map((m) => [m, MODES[m].label]), mode, (v) => { mode = v; reset(); }, 'Build tool');
  const segV = seg([['old', 'SDK needs 2.12.7 (older)'], ['new', 'SDK needs 2.18.1 (newer)']], sdk, (v) => { sdk = v; reset(); }, 'SDK requirement');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 760 290', role: 'img', 'aria-label': 'Dependency tree with two paths to jackson-databind and the resolved version' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-dep');
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-controls' }, segV), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  const W = 172; const H = 54;
  const P = { app: [8, 118], web: [200, 30], json: [392, 30], jA: [584, 30], sdk: [200, 206], jB: [392, 206], res: [584, 206], bom: [8, 230] };
  const hasBom = () => ['mvnbom', 'mvnovr', 'gplat', 'gdm'].includes(mode);
  function render() {
    stage.innerHTML = '';
    const w = k >= 4 ? winner() : null;
    const line = (a, b, cls) => { const [ax, ay] = P[a]; const [bx, by] = P[b]; stage.append(svg('path', { class: 'ln ' + cls, d: `M${ax + W} ${ay + H / 2} C ${ax + W + 26} ${ay + H / 2}, ${bx - 26} ${by + H / 2}, ${bx} ${by + H / 2}` })); };
    if (k >= 1) { line('app', 'web', 'on'); line('app', 'sdk', 'on'); }
    if (k >= 2) { line('web', 'json', 'on'); line('json', 'jA', w && w.from === 'boot' ? 'win' : 'on'); line('sdk', 'jB', w && w.from === 'sdk' ? 'win' : 'on'); }
    if (w) stage.append(svg('path', { class: 'ln ' + (w.from === 'bom' ? 'bom' : 'win'), d: w.from === 'bom' ? `M${P.bom[0] + W} ${P.bom[1] + H / 2 + 10} C 380 288, 520 288, ${P.res[0] + 20} ${P.res[1] + H}` : w.from === 'sdk' ? `M${P.jB[0] + W} ${P.jB[1] + H / 2} L ${P.res[0]} ${P.res[1] + H / 2}` : `M${P.jA[0] + W / 2} ${P.jA[1] + H} L ${P.res[0] + W / 2} ${P.res[1]}` }));
    const box = (id, t1, t2, cls) => { const [x, y] = P[id]; stage.append(svg('rect', { class: 'bx ' + cls, x, y, width: W, height: H, rx: 9 }), svg('text', { x: x + 10, y: y + 22, 'font-size': 12.5, 'font-weight': 700, fill: 'var(--text)', text: t1 }), svg('text', { x: x + 10, y: y + 40, 'font-size': 11.5, fill: 'var(--text-2)', text: t2 })); };
    box('app', 'your-app', mode.startsWith('g') ? 'build.gradle.kts' : 'pom.xml', k >= 0 ? '' : 'idle');
    box('web', 'starter-web', 'depth 1', k >= 1 ? '' : 'idle');
    box('sdk', 'legacy-pdf-sdk 4.1', 'depth 1', k >= 1 ? '' : 'idle');
    box('json', 'starter-json', 'depth 2', k >= 2 ? '' : 'idle');
    const conflict = k >= 3 && !w;
    box('jA', 'jackson-databind', `${BOMV} · depth 3`, k < 2 ? 'idle' : w ? (w.from === 'boot' ? 'win' : 'lose') : conflict ? 'hot' : '');
    box('jB', 'jackson-databind', `${sdkV()} · depth 2`, k < 2 ? 'idle' : w ? (w.from === 'sdk' ? 'win' : 'lose') : conflict ? 'hot' : '');
    if (hasBom()) box('bom', 'Boot BOM', `jackson ${mode === 'mvnovr' ? OVR + ' (override)' : BOMV}`, k >= 1 ? 'bom' : 'idle');
    if (w) { const bad = cmp(w.v, BOMV) < 0 || (sdk === 'new' && cmp(w.v, sdkV()) < 0); box('res', `resolved: ${w.v}`, bad ? 'risk: see caption' : 'one version on classpath', bad ? 'bad' : 'win'); }
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `rule <b>${MODES[mode].rule.replace(/</g, '&lt;')}</b>` }));
    if (w) stats.append(el('span', { class: 'w-stat', html: `jackson-databind <b>${w.v}</b>` }));
  }
  function consequence(w) {
    if (cmp(w.v, BOMV) < 0) return ' <b>Risk:</b> Boot’s Jackson integration was built and tested against ' + BOMV + '. An older databind can fail at runtime with <code>NoSuchMethodError</code> or <code>ClassNotFoundException</code>, often only on a code path you didn’t test.';
    if (sdk === 'new' && cmp(w.v, sdkV()) < 0) return ' <b>Risk:</b> the SDK asked for ' + sdkV() + ' and gets an older version. If it uses newer APIs it fails at runtime. Either accept it (test the SDK) or override the BOM property for the whole Jackson family.';
    if (cmp(w.v, BOMV) > 0) return ' Newer than the BOM: usually fine within a minor line for Jackson, but you’re now off the tested combination. Upgrade the whole family together (jackson-bom) rather than one artifact.';
    return ' This is the version Boot was tested with.';
  }
  const TOTAL = 5;
  function msg() {
    if (k === 0) return 'Your app declares two dependencies. Pick a build setup and press Play or Step.';
    if (k === 1) return `Direct dependencies: <code>spring-boot-starter-web</code> and <code>legacy-pdf-sdk</code>. ${hasBom() ? 'A BOM is also in play: it adds <b>versions</b>, not dependencies.' : 'No BOM: every version comes from whatever each POM says.'}`;
    if (k === 2) return 'Transitive dependencies are pulled in. Both paths lead to <code>jackson-databind</code>, with different versions.';
    if (k === 3) return 'Conflict: only <b>one</b> version of a library can be on the classpath. Each build tool has a rule for choosing.';
    const w = winner();
    if (k === 4) return `${MODES[mode].label}: ${w.why}`;
    return `Result: <b>jackson-databind ${w.v}</b>.${consequence(w)} Check with <code>${mode.startsWith('g') ? './gradlew dependencyInsight --dependency jackson-databind' : 'mvn dependency:tree -Dverbose -Dincludes=com.fasterxml.jackson.core'}</code>.`;
  }
  function say(tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${TOTAL}` }), el('div', { class: 't', html: msg() })); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; render(); say(); bStep.disabled = false; }
  function step() {
    if (k >= TOTAL) return false; k++; render();
    let tone = ''; if (k === 3) tone = 'warn'; if (k === TOTAL) { const w = winner(); tone = (cmp(w.v, BOMV) < 0 || (sdk === 'new' && cmp(w.v, sdkV()) < 0)) ? 'err' : 'ok'; }
    say(tone); if (k >= TOTAL) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= TOTAL) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
