/* Coupling lab: a small service graph. Runtime coupling = reachability over blocking calls; release coupling = groups
   joined by a shared database or a shared domain library. All meters are computed from the graph the user edits. */
SD.widget('ms-antipatterns-migration', function (root, ctx) {
  const { el, svg } = ctx;
  const SVC = { O: 'Orders', P: 'Payments', I: 'Inventory', N: 'Notify', S: 'Shipping' };
  const LIB = ['O', 'P', 'I', 'S'];                       // services that import common-domain
  const A = 0.999, OWN = 30, HOP = 5;                     // per-service availability, ms of own work, ms per network hop
  let E, down, sharedDb, sharedLib, narrow = ctx.narrow;
  function reset() {
    E = [{ a: 'O', b: 'P', sync: true }, { a: 'O', b: 'I', sync: true }, { a: 'O', b: 'N', sync: true }, { a: 'I', b: 'S', sync: true }];
    down = new Set(); sharedDb = true; sharedLib = true;
  }
  // everything checkout (Orders) must wait for: transitive closure over blocking calls
  function waits(from) { const seen = new Set([from]); const go = (x) => E.forEach((e) => { if (e.sync && e.a === x && !seen.has(e.b)) { seen.add(e.b); go(e.b); } }); go(from); return seen; }
  // sequential blocking calls: own work + (hop + callee latency) for each blocking callee
  const latency = (x) => OWN + E.filter((e) => e.sync && e.a === x).reduce((s, e) => s + HOP + latency(e.b), 0);
  // a service fails if it is down, the shared DB is down, or something it blocks on has failed
  function failed() {
    const f = new Set(down.has('DB') && sharedDb ? Object.keys(SVC) : [...down].filter((k) => k !== 'DB'));
    let grew = true;
    while (grew) { grew = false; E.forEach((e) => { if (e.sync && f.has(e.b) && !f.has(e.a)) { f.add(e.a); grew = true; } }); }
    return f;
  }
  // services that must be released together
  function lockstep() { return sharedDb ? Object.keys(SVC) : sharedLib ? LIB : []; }

  const dbBtn = el('button', { class: 'btn' }), libBtn = el('button', { class: 'btn' });
  const sync = () => {
    dbBtn.textContent = 'Shared database: ' + (sharedDb ? 'on' : 'off'); dbBtn.classList.toggle('primary', sharedDb);
    libBtn.textContent = 'Shared domain library: ' + (sharedLib ? 'on' : 'off'); libBtn.classList.toggle('primary', sharedLib);
  };
  dbBtn.onclick = () => { sharedDb = !sharedDb; down.delete('DB'); say(sharedDb ? 'All five services use one schema again: a column change is a joint release, and one database outage stops everything.' : 'Each service now owns its database. Schema changes stay inside one service.'); render(); };
  libBtn.onclick = () => { sharedLib = !sharedLib; say(sharedLib ? 'Orders, Payments, Inventory and Shipping exchange classes from <code>common-domain</code>: a new version means upgrading all four together.' : 'Each service defines its own types and maps at its boundary. The library no longer ties releases together.'); render(); };
  const fix = el('button', { class: 'btn', text: '✓ Decouple all' });
  fix.onclick = () => { sharedDb = false; sharedLib = false; down.clear(); E.forEach((e) => { e.sync = e.a === 'O' && e.b === 'I'; }); say('Own data, no shared domain library, and only the stock check stays a blocking call. Now take Payments down.'); render(); };
  const heal = el('button', { class: 'btn', text: 'Heal all' });
  heal.onclick = () => { down.clear(); render(); };
  const rs = el('button', { class: 'btn', text: '↺ Reset' });
  rs.onclick = () => { reset(); log.innerHTML = ''; say('Back to the distributed monolith: every call blocks, one database, one domain library.'); render(); };
  root.append(el('div', { class: 'w-controls' }, dbBtn, libBtn, fix, heal, rs));
  const stage = el('div', { class: 'w-stage' });
  const verdict = el('p', { style: { margin: '8px 0 0', fontSize: '14px' } });
  const stats = el('div', { class: 'w-stats' });
  const log = el('div', { class: 'w-log', 'aria-live': 'polite' });
  root.append(stage, verdict, stats, log);
  function say(t) { log.prepend(el('div', { html: t })); while (log.children.length > 30) log.lastChild.remove(); }

  function render() {
    sync();
    const W = narrow ? 360 : 700, H = narrow ? 300 : 262, bw = narrow ? 108 : 150, bh = 46;
    const X = narrow ? [62, 180, 298] : [130, 350, 570], Y = narrow ? [32, 142, 252] : [30, 126, 222];
    const pos = { O: [X[1], Y[0]], P: [X[0], Y[1]], I: [X[1], Y[1]], N: [X[2], Y[1]], S: [X[1], Y[2]], DB: [X[0], Y[2]] };
    const V = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Service dependency graph' });
    const T = (x, y, t, size, weight, fill, extra) => svg('text', Object.assign({ x, y, text: t, 'text-anchor': 'middle', fill: fill || 'var(--text)', style: 'font:' + (weight || 600) + ' ' + size + 'px var(--sans)' }, extra));
    const f = failed(), w = waits('O'), lock = lockstep();

    E.forEach((e) => {
      const a = pos[e.a], b = pos[e.b], dx = b[0] - a[0];
      const x1 = a[0] + Math.sign(dx) * (bw / 2 - 22), y1 = a[1] + bh / 2, x2 = b[0], y2 = b[1] - bh / 2;
      const broken = e.sync && f.has(e.b), col = broken ? 'var(--err)' : e.sync ? 'var(--accent)' : 'var(--text-3)';
      V.append(svg('line', { x1, y1, x2, y2, stroke: col, 'stroke-width': e.sync ? 3.5 : 2.5, 'stroke-dasharray': e.sync ? 'none' : '6 5' }));
      V.append(svg('circle', { cx: x2, cy: y2, r: 5, fill: col }));
      const mx = (x1 + x2) / 2 + (dx === 0 ? 28 : dx < 0 ? -16 : 16), my = (y1 + y2) / 2 + 5;
      V.append(T(mx, my, e.sync ? 'blocks' : 'event', 13, 700, col, { style: 'font:700 13px var(--sans);paint-order:stroke;stroke:var(--surface);stroke-width:5px' }));
      const hit = svg('line', { x1, y1, x2, y2, stroke: 'transparent', 'stroke-width': 30, style: 'cursor:pointer' });
      hit.addEventListener('click', () => {
        e.sync = !e.sync;
        say(e.sync ? '<b>' + SVC[e.a] + ' → ' + SVC[e.b] + '</b> is a blocking call again: ' + SVC[e.a] + ' is only up and fast when ' + SVC[e.b] + ' is.' : '<b>' + SVC[e.a] + ' → ' + SVC[e.b] + '</b> is now an event: ' + SVC[e.a] + ' publishes and moves on. If ' + SVC[e.b] + ' is down, its work queues up.');
        render();
      });
      V.append(hit);
    });
    const node = (k, name, sub, tone, fill) => {
      const p = pos[k], col = tone ? 'var(--' + tone + ')' : 'var(--border)';
      const g = svg('g', { style: 'cursor:pointer' });
      g.append(svg('rect', { x: p[0] - bw / 2, y: p[1] - bh / 2, width: bw, height: bh, rx: 10, fill: fill ? col : 'var(--surface)', 'fill-opacity': fill ? 0.18 : 1, stroke: col, 'stroke-width': tone ? 3 : 2 }));
      g.append(T(p[0], p[1] - 3, name, 15, 700));
      g.append(T(p[0], p[1] + 15, sub, 13, 600, tone ? col : 'var(--text-3)'));
      g.addEventListener('click', () => {
        if (down.has(k)) down.delete(k); else { down.add(k); const ff = failed(); say('💥 <b>' + name + '</b> is down. Failing with it: ' + ([...ff].filter((x) => x !== k).map((x) => SVC[x]).join(', ') || 'nothing else') + '. Checkout is <b>' + (ff.has('O') ? 'down' : 'still up') + '</b>.'); }
        render();
      });
      V.append(g);
    };
    Object.keys(SVC).forEach((k) => {
      const isDown = down.has(k), fails = f.has(k);
      const sub = isDown ? 'DOWN' : fails ? 'failing' : (sharedDb ? 'shared DB' : 'own DB') + (sharedLib && LIB.includes(k) ? ' · lib' : '');
      node(k, SVC[k], sub, isDown || fails ? 'err' : lock.includes(k) ? 'warn' : 'ok', isDown);
    });
    if (sharedDb) node('DB', 'Shared DB', down.has('DB') ? 'DOWN' : 'all 5 write here', down.has('DB') ? 'err' : 'warn', down.has('DB'));
    stage.innerHTML = ''; stage.append(V);

    const n = w.size, avail = Math.pow(A, n), up = !f.has('O');
    stats.innerHTML = '';
    [['checkout now', '<b style="color:var(--' + (up ? 'ok' : 'err') + ')">' + (up ? 'UP' : 'DOWN') + '</b>'],
      ['checkout waits on', '<b>' + n + '</b> service' + (n > 1 ? 's' : '')],
      ['availability', '<b>' + (avail * 100).toFixed(2) + '%</b> ≈ ' + Math.round((1 - avail) * 43200) + ' min down / month'],
      ['time waiting', '<b>' + latency('O') + ' ms</b>'],
      ['released together', '<b style="color:var(--' + (lock.length > 1 ? 'err' : 'ok') + ')">' + Math.max(1, lock.length) + '</b>']]
      .forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: k + ': ' + v })));
    verdict.innerHTML = lock.length > 1
      ? '❌ <b>Distributed monolith:</b> ' + lock.length + ' services must be changed and released together (' + (sharedDb ? 'shared database' : 'shared domain library') + ').'
      : n >= 4 ? '⚠ <b>Deployable alone, fragile at run time:</b> checkout blocks on ' + n + ' services. Tap an arrow to turn a call into an event.'
        : '✅ <b>Loosely coupled:</b> each service releases alone and checkout waits on ' + n + '.';
  }

  reset(); render();
  say('Tap <b>Shipping</b>: it is two calls away from checkout, yet checkout goes down. Then tap the arrows and the two toggles until the verdict turns green.');
  ctx.onResize((nw) => { narrow = nw; render(); });
});
