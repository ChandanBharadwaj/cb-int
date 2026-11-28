/* Shared dependency lab: the share-scope version negotiation used by Module Federation
   (normal sharing, singleton, strictVersion, static vs late-loaded remotes). */
SD.widget('micro-frontends', function (root, ctx) {
  const { el, svg } = ctx;
  const VERSIONS = ['17.0.2', '18.2.0', '18.3.1', '19.1.0'];
  const KB = 45; // illustrative gzipped size of one framework runtime copy
  const apps = [
    { id: 'shell', name: 'Shell', v: '18.2.0' },
    { id: 'cat', name: 'Catalog', v: '18.2.0' },
    { id: 'cart', name: 'Cart', v: '18.3.1' },
    { id: 'chk', name: 'Checkout', v: '19.1.0' }
  ];
  const opt = { singleton: false, strict: false, known: true };
  let gen = 0;

  // --- real semver helpers (caret ranges, as written by default in package.json) ---
  const parse = (v) => v.split('.').map(Number);
  const lt = (a, b) => { const x = parse(a), y = parse(b); for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] < y[i]; } return false; };
  const satisfies = (v, base) => parse(v)[0] === parse(base)[0] && !lt(v, base);   // v matches ^base

  // --- the negotiation ---
  function negotiate() {
    const scope = {};   // version -> { from, loaded }
    const reg = (a) => { if (!scope[a.v]) scope[a.v] = { from: a.name, loaded: false }; };
    if (opt.known) apps.forEach(reg);            // static remotes register before anything is consumed
    return apps.map((a) => {
      if (!opt.known) reg(a);                    // late remote: registers when it arrives
      const keys = Object.keys(scope);
      let pick, status = 'ok', why;
      if (opt.singleton) {
        // one version for everybody: an already loaded one wins, otherwise the highest
        pick = keys.reduce((x, y) => (!x || (!scope[x].loaded && lt(x, y)) ? y : x), '');
        if (!satisfies(pick, a.v)) {
          status = opt.strict ? 'err' : 'warn';
          why = opt.strict
            ? 'needs ^' + a.v + ' but the singleton is ' + pick + ': <b>throws</b>, the slice does not load'
            : 'needs ^' + a.v + ' but runs on the singleton ' + pick + ': console warning, may break at run time';
        } else why = 'singleton ' + pick + ' satisfies ^' + a.v;
      } else {
        // normal sharing: highest registered version inside my range, else my own copy
        pick = keys.reduce((x, y) => (!satisfies(y, a.v) ? x : !x || lt(x, y) ? y : x), '');
        why = pick === a.v && scope[pick].from === a.name ? 'nothing better in range ^' + a.v + ': uses its own copy' : 'highest version in range ^' + a.v + ' is ' + pick;
      }
      const src = scope[pick];
      if (status !== 'err') src.loaded = true;
      const extra = status === 'ok' && Object.keys(scope).filter((k) => scope[k].loaded).length > 1 && src.from === a.name && a.id !== 'shell';
      return { a, pick, from: src.from, status: status === 'ok' && extra ? 'dup' : status, why, seen: keys.length };
    });
  }

  function build(narrow) {
    const my = ++gen;
    root.innerHTML = '';
    const controls = el('div', { class: 'w-controls' });
    apps.forEach((a) => {
      const sel = el('select', { 'aria-label': a.name + ' framework version' });
      VERSIONS.forEach((v) => sel.append(el('option', { value: v, text: v })));
      sel.value = a.v;
      sel.addEventListener('change', () => { a.v = sel.value; paint(true); });
      controls.append(el('label', null, a.name + ' ', sel));
    });
    const toggle = (label, key) => {
      const b = el('button', { class: 'btn' });
      const sync = () => { b.textContent = label + ': ' + (opt[key] ? 'on' : 'off'); b.classList.toggle('primary', !!opt[key]); };
      b.onclick = () => { opt[key] = !opt[key]; sync(); paint(true); };
      sync(); return b;
    };
    const replay = el('button', { class: 'btn primary', text: '▶ Load page' });
    replay.onclick = () => paint(false);
    controls.append(toggle('singleton', 'singleton'), toggle('strictVersion', 'strict'), toggle('remotes known at startup', 'known'), replay);
    root.append(controls);

    const W = narrow ? 360 : 700, rowH = 84, colW = 168;
    const H = narrow ? apps.length * rowH + 70 : 236;
    const box = (i) => (narrow ? { x: 6, y: 4 + i * rowH, w: 348, h: rowH - 10 } : { x: 8 + i * (colW + 4), y: 6, w: colW, h: 150 });
    const stage = el('div', { class: 'w-stage' });
    const S = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Which framework copy each micro-frontend uses' });
    stage.append(S); root.append(stage);
    const stats = el('div', { class: 'w-stats' });
    const log = el('div', { class: 'w-log', 'aria-live': 'polite' });
    const vd = el('p', { style: { margin: '10px 0 0', fontSize: '14px' }, 'aria-live': 'polite' });
    root.append(stats, vd, log);

    const T = (x, y, t, f, w, fill, anchor) => svg('text', { x, y, text: t, 'text-anchor': anchor || 'start', fill: fill || 'var(--text)', style: 'font:' + (w || 600) + ' ' + f + 'px var(--sans)' });
    const R = apps.map((a, i) => {
      const b = box(i);
      const r = svg('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 10, fill: 'var(--surface)', stroke: 'var(--border)', 'stroke-width': 2 });
      const name = T(b.x + 12, b.y + 24, a.name, 15, 700);
      const chip = T(b.x + b.w - 12, b.y + 24, '', 13, 700, 'var(--text-3)', 'end');
      const l1 = T(b.x + 12, b.y + (narrow ? 44 : 52), '', 13, 500, 'var(--text-3)');
      const l2 = narrow ? null : T(b.x + 12, b.y + 72, '', 13, 500, 'var(--text-3)');
      const l3 = T(b.x + 12, b.y + (narrow ? 64 : 104), '', 14, 700);
      const l4 = narrow ? null : T(b.x + 12, b.y + 126, '', 13, 600, 'var(--text-3)');
      S.append(r, name, chip, l1, l3); if (l2) S.append(l2, l4);
      return { r, chip, l1, l2, l3, l4 };
    });
    const cy = narrow ? apps.length * rowH + 6 : 172;
    S.append(T(8, cy + 14, 'Framework copies the page downloads', 13, 600, 'var(--text-3)'));
    const copyG = svg('g'); S.append(copyG);

    const COL = { ok: 'var(--ok)', dup: 'var(--warn)', warn: 'var(--warn)', err: 'var(--err)' };
    const CHIP = { ok: 'shared', dup: 'own copy', warn: 'mismatch', err: 'failed' };

    function show(res, upTo) {
      res.forEach((x, i) => {
        const e = R[i], on = i <= upTo;
        const c = on ? COL[x.status] : 'var(--border)';
        e.r.setAttribute('stroke', c);
        e.chip.textContent = on ? (i === 0 && x.status === 'ok' ? 'host' : CHIP[x.status]) : '…';
        e.chip.setAttribute('fill', on ? c : 'var(--text-3)');
        if (narrow) e.l1.textContent = 'bundles ' + x.a.v + ' · needs ^' + x.a.v;
        else { e.l1.textContent = 'bundles ' + x.a.v; e.l2.textContent = 'needs ^' + x.a.v; }
        const run = !on ? 'waiting to load' : x.status === 'err' ? 'does not load' : 'runs on ' + x.pick;
        e.l3.textContent = narrow && on && x.status !== 'err' ? run + ' (from ' + x.from + ')' : run;
        e.l3.setAttribute('fill', on ? c : 'var(--text-3)');
        if (e.l4) e.l4.textContent = on && x.status !== 'err' ? 'copy from ' + x.from : '';
      });
      const used = []; res.forEach((x, i) => { if (i <= upTo && x.status !== 'err' && used.indexOf(x.pick) < 0) used.push(x.pick); });
      copyG.innerHTML = '';
      used.forEach((v, i) => {
        const w = narrow ? 82 : 120, x = 8 + i * (w + 6);
        copyG.append(svg('rect', { x, y: cy + 22, width: w, height: 30, rx: 8, fill: 'var(--surface-2)', stroke: i ? 'var(--warn)' : 'var(--ok)', 'stroke-width': 2 }));
        copyG.append(T(x + w / 2, cy + 42, narrow ? v : 'v' + v + ' · ' + KB + ' kB', 13, 700, 'var(--text)', 'middle'));
      });
      const failed = res.filter((x, i) => i <= upTo && x.status === 'err').length;
      const warns = res.filter((x, i) => i <= upTo && x.status === 'warn').length;
      stats.innerHTML = '';
      [['copies', used.length], ['framework JS', used.length * KB + ' kB'], ['version warnings', warns], ['slices failed', failed]]
        .forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: k + ': <b>' + v + '</b>' })));
    }

    function verdict(res) {
      const used = []; res.forEach((x) => { if (x.status !== 'err' && used.indexOf(x.pick) < 0) used.push(x.pick); });
      if (res[0].status === 'err') return '❌ The <b>shell itself</b> fails: a remote registered a higher version than the host was built for. Pin the range in a shared policy.';
      if (res.some((x) => x.status === 'err')) return '❌ strictVersion turned a silent mismatch into a <b>failed slice</b>. Better than a subtle bug, if the shell shows a fallback.';
      if (res.some((x) => x.status === 'warn')) return '⚠ One copy, but a slice runs on a <b>major version it was not built for</b>. It may work, or break in production.';
      if (used.length > 1) return '⚠ ' + used.length + ' framework copies on one page: ' + ((used.length - 1) * KB) + ' kB extra, and components cannot share context across copies.';
      return '✅ One copy, every range satisfied. This is what a shared dependency policy enforces.';
    }

    function paint(instant) {
      const g = ++gen, res = negotiate();
      log.innerHTML = ''; vd.innerHTML = '';
      const line = (x, i) => log.append(el('div', { html: '<b>' + x.a.name + '</b>: ' + x.why + (opt.known || i === 0 ? '' : ' <i>(versions registered so far: ' + x.seen + ')</i>') }));
      if (instant || ctx.reduced) { show(res, apps.length - 1); res.forEach(line); vd.innerHTML = verdict(res); return; }
      show(res, -1);
      let i = 0;
      (function next() {
        if (g !== gen) return;
        show(res, i); line(res[i], i); i++;
        if (i < res.length) setTimeout(next, 550); else vd.innerHTML = verdict(res);
      })();
    }
    if (my === gen) paint(true);
  }
  build(ctx.narrow);
  ctx.onResize(build);
});
