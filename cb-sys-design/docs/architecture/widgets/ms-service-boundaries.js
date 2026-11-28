/* Change-coupling lab: count co-changes in a commit history, compute Code Maat's coupling degree, and test a service assignment against it. */
SD.widget('ms-service-boundaries', function (root, ctx) {
  const { el, svg } = ctx;
  const MODS = ['cart', 'checkout', 'promo', 'payment', 'refund', 'invoice', 'stock', 'shipping'];
  const TRUTH = [[0, 1, 2], [3, 4, 5], [6, 7]];            // the hidden business capabilities
  const GUESS = [0, 1, 2, 0, 1, 2, 0, 1];                  // a first guess that ignores them
  const SVC = [['A', 'var(--accent)'], ['B', 'var(--ok)'], ['C', 'var(--warn)']];
  const MIN_SHARED = 5, MIN_DEGREE = 30;                   // Code Maat defaults
  const N = MODS.length;
  let seed = 7, rnd, commits = [], assign = GUESS.slice(), lastCross = null;

  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function pick(arr, k) { const a = arr.slice(), out = []; while (out.length < k && a.length) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return out; }
  function addCommits(n) {
    for (let c = 0; c < n; c++) {
      if (rnd() < 0.82) {                                   // a change inside one capability
        const g = TRUTH[rnd() < 0.42 ? 0 : rnd() < 0.6 ? 1 : 2], x = rnd();
        commits.push(pick(g, Math.min(g.length, x < 0.35 ? 1 : x < 0.8 ? 2 : 3)));
      } else {                                              // a cross-cutting change
        const gs = pick([0, 1, 2], 2);
        commits.push([pick(TRUTH[gs[0]], 1)[0], pick(TRUTH[gs[1]], 1)[0]]);
      }
    }
  }
  function newHistory() { rnd = rng(seed * 7919); commits = []; addCommits(120); }

  // The real analysis: revisions per module, shared revisions per pair, degree = shared / average revisions.
  function analyse() {
    const revs = new Array(N).fill(0), sh = MODS.map(() => new Array(N).fill(0));
    commits.forEach((c) => { c.forEach((i) => revs[i]++); for (let a = 0; a < c.length; a++) for (let b = a + 1; b < c.length; b++) { sh[c[a]][c[b]]++; sh[c[b]][c[a]]++; } });
    const deg = MODS.map((_, i) => MODS.map((__, j) => (i === j ? 0 : 100 * sh[i][j] / ((revs[i] + revs[j]) / 2 || 1))));
    return { revs, sh, deg };
  }
  function crossShare(as) { return commits.filter((c) => new Set(c.map((i) => as[i])).size > 1).length / commits.length; }
  function cluster() {                                      // average-link agglomerative clustering down to 3 groups
    const { deg } = analyse(); let cl = MODS.map((_, i) => [i]);
    while (cl.length > 3) {
      let best = -1, bi = 0, bj = 1;
      for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) {
        let s = 0; cl[i].forEach((a) => cl[j].forEach((b) => { s += deg[a][b]; })); s /= cl[i].length * cl[j].length;
        if (s > best) { best = s; bi = i; bj = j; }
      }
      cl[bi] = cl[bi].concat(cl[bj]); cl.splice(bj, 1);
    }
    cl.sort((a, b) => Math.min.apply(null, a) - Math.min.apply(null, b));
    const as = new Array(N); cl.forEach((g, k) => g.forEach((i) => { as[i] = k; })); return as;
  }

  let narrow = ctx.narrow, S, stats, log;
  const pct = (x) => Math.round(x * 100) + '%';
  function say(t) { log.prepend(el('div', { html: t })); while (log.children.length > 30) log.lastChild.remove(); }

  function draw() {
    const { revs, sh, deg } = analyse();
    const cell = narrow ? 32 : 46, lab = narrow ? 96 : 150, top = narrow ? 30 : 36, f = narrow ? 13 : 15;
    const W = lab + N * cell + 6, H = top + N * cell + 6;
    S.setAttribute('viewBox', '0 0 ' + W + ' ' + H); S.innerHTML = '';
    const T = (x, y, t, a, fill, w) => svg('text', { x, y, text: t, 'text-anchor': a || 'middle', fill: fill || 'var(--text)', style: 'font:' + (w || 600) + ' ' + f + 'px var(--sans)' });
    let leaks = 0;
    MODS.forEach((name, i) => {
      const col = SVC[assign[i]][1], y = top + i * cell, x = lab + i * cell;
      const g = svg('g', { style: 'cursor:pointer', role: 'button', tabindex: 0, 'aria-label': name + ' is in service ' + SVC[assign[i]][0] + '. Activate to move it.' });
      g.append(svg('rect', { x: 2, y: y + 2, width: lab - 8, height: cell - 4, rx: 7, fill: 'var(--surface-2)', stroke: col, 'stroke-width': 2 }),
        svg('rect', { x: 2, y: y + 2, width: narrow ? 22 : 28, height: cell - 4, rx: 7, fill: col }),
        T(narrow ? 13 : 16, y + cell / 2 + f * 0.36, SVC[assign[i]][0], 'middle', 'var(--surface)', 800),
        T(narrow ? 30 : 38, y + cell / 2 + f * 0.36, name, 'start'));
      const move = () => { const before = crossShare(assign); assign[i] = (assign[i] + 1) % 3; draw(); say('Moved <b>' + name + '</b> to service ' + SVC[assign[i]][0] + '. Cross-service commits: ' + pct(before) + ' → <b>' + pct(crossShare(assign)) + '</b>.'); };
      g.addEventListener('click', move);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); move(); } });
      S.append(g);
      S.append(svg('circle', { cx: x + cell / 2, cy: top / 2 - 2, r: narrow ? 11 : 13, fill: col }), T(x + cell / 2, top / 2 - 2 + f * 0.36, String(i + 1), 'middle', 'var(--surface)', 800));
      MODS.forEach((_, j) => {
        const cx = lab + j * cell;
        if (i === j) { S.append(svg('rect', { x: cx + 1, y: y + 1, width: cell - 2, height: cell - 2, rx: 5, fill: 'var(--surface-2)' }), T(cx + cell / 2, y + cell / 2 + f * 0.36, String(i + 1), 'middle', 'var(--text-3)')); return; }
        const d = deg[i][j], shown = sh[i][j] >= MIN_SHARED, strong = shown && d >= MIN_DEGREE, same = assign[i] === assign[j];
        if (strong && !same && i < j) leaks++;
        S.append(svg('rect', { x: cx + 1, y: y + 1, width: cell - 2, height: cell - 2, rx: 5, fill: strong ? (same ? 'var(--ok)' : 'var(--err)') : 'var(--accent)', 'fill-opacity': strong ? 0.28 : Math.min(0.22, d / 250), stroke: strong ? (same ? 'var(--ok)' : 'var(--err)') : 'var(--border)', 'stroke-width': strong ? 2 : 1 }));
        S.append(T(cx + cell / 2, y + cell / 2 + f * 0.36, shown ? String(Math.round(d)) : '·', 'middle', shown ? 'var(--text)' : 'var(--text-3)', strong ? 800 : 500));
      });
    });
    const cross = crossShare(assign);
    stats.innerHTML = '';
    [['commits', commits.length], ['cross-service commits', pct(cross)], ['leaking pairs', leaks], ['sizes A/B/C', [0, 1, 2].map((k) => assign.filter((a) => a === k).length).join(' / ')]]
      .forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: k + ': <b>' + v + '</b>' })));
    lastCross = cross;
  }

  function build() {
    root.innerHTML = '';
    const b = (t, fn, primary) => { const x = el('button', { class: 'btn' + (primary ? ' primary' : ''), text: t }); x.onclick = fn; return x; };
    root.append(el('div', { class: 'w-controls' },
      b('Cluster by coupling', () => { const before = crossShare(assign); assign = cluster(); draw(); say('Grouped modules by average coupling degree into 3 services. Cross-service commits: ' + pct(before) + ' → <b>' + pct(lastCross) + '</b>. What remains is the cross-cutting work no cut removes.'); }, true),
      b('First guess', () => { assign = GUESS.slice(); draw(); say('Back to the first guess: modules dealt out with no look at the history.'); }),
      b('+40 commits', () => { addCommits(40); draw(); say('40 more commits. More history makes the pattern clearer; the hidden capabilities have not changed.'); }),
      b('New history', () => { seed++; newHistory(); draw(); say('A new, random commit history over the same modules.'); })));
    const stage = el('div', { class: 'w-stage' });
    S = svg('svg', { role: 'img', 'aria-label': 'Coupling degree between eight modules', style: 'max-width:' + (narrow ? 360 : 540) + 'px;margin:0 auto' });
    stage.append(S);
    stage.append(el('p', { class: 'muted', style: { margin: '8px 0 0', fontSize: '13px' }, html: 'Each cell is the <b>coupling degree</b> of two modules: shared commits ÷ average commits, in %. A dot means fewer than ' + MIN_SHARED + ' shared commits. <b style="color:var(--ok)">Green</b>: strongly coupled (≥ ' + MIN_DEGREE + ' %) and in the same service. <b style="color:var(--err)">Red</b>: strongly coupled but split across services, so the boundary leaks. Letters A, B, C are the three services.' }));
    stats = el('div', { class: 'w-stats' });
    log = el('div', { class: 'w-log', 'aria-live': 'polite' });
    root.append(stage, stats, log);
    draw();
    say('First guess: <b>' + pct(lastCross) + '</b> of commits touch more than one service. Tap a module on the left to move it, or press <b>Cluster by coupling</b>.');
  }
  newHistory();
  build();
  ctx.onResize((n) => { narrow = n; build(); });
});
