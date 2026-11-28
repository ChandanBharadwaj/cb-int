/* Scale-to-zero lab: a small discrete-time autoscaler.
   Poisson arrivals -> each request needs a free slot on a warm instance, else a new instance is started
   (cold start) -> idle instances are reaped -> every instance needs database connections, directly or via a pooler. */
SD.widget('serverless-architecture', function (root, ctx) {
  const { el, svg } = ctx;
  const SERVICE = 0.25, IDLE = 6, MAXDB = 20, POOL = 12;       // seconds, seconds, connections, pooled connections
  const opt = { rate: 3, cold: 4, conc: 1, min: 0, pool: false };
  let sim, loopH = null;

  function fresh() { sim = { t: 0, inst: [], reqs: [], lat: [], done: 0, cold: 0, err: 0, thr: 0, dbBusy: 0, paid: 0, burst: 0, nextId: 1 }; }
  function poisson(mean) { const L = Math.exp(-mean); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
  const connsPer = () => (opt.conc === 1 ? 1 : 3);            // a function holds 1 connection, a container a small pool
  const directConns = () => sim.inst.reduce((a, i) => a + (i.conns || 0), 0);

  function tick(dt, MAX, say) {
    sim.t += dt;
    let n = poisson(opt.rate * dt) + sim.burst; sim.burst = 0;
    while (n-- > 0) {
      const r = { t0: sim.t, cold: false, state: 'ready' };
      let i = sim.inst.find((x) => x.state === 'warm' && x.active < opt.conc);
      if (!i) { i = sim.inst.find((x) => x.state === 'starting' && x.active < opt.conc); if (i) { r.cold = true; r.state = 'queued'; } }
      if (!i) {
        if (sim.inst.length >= MAX) { sim.thr++; continue; }   // concurrency limit reached: throttled (429)
        i = { id: sim.nextId++, state: 'starting', born: sim.t, readyAt: sim.t + opt.cold, active: 0, conns: 0, idleSince: sim.t };
        sim.inst.push(i); r.cold = true; r.state = 'queued';
      }
      i.active++; r.inst = i; sim.reqs.push(r);
    }
    // instances finish starting and connect to the database
    sim.inst.forEach((i) => {
      if (i.state !== 'starting' || sim.t < i.readyAt) return;
      if (!opt.pool && directConns() + connsPer() > MAXDB) { i.state = 'err'; i.until = sim.t + 1.5; if (say) say(); return; }
      i.conns = opt.pool ? 0 : connsPer(); i.state = 'warm'; i.idleSince = sim.t;
    });
    // requests run
    sim.reqs = sim.reqs.filter((r) => {
      const i = r.inst;
      if (i.state === 'err') { sim.err++; i.active--; return false; }
      if (r.state === 'queued' && i.state === 'warm') r.state = 'ready';
      if (r.state === 'ready') {
        if (opt.pool) { if (sim.dbBusy >= POOL) return true; sim.dbBusy++; }   // wait for a pooled connection
        r.state = 'run'; r.end = sim.t + SERVICE;
      }
      if (r.state === 'run' && sim.t >= r.end) {
        if (opt.pool) sim.dbBusy--;
        i.active--; i.idleSince = sim.t; sim.done++; if (r.cold) sim.cold++;
        sim.lat.push(sim.t - r.t0); if (sim.lat.length > 300) sim.lat.shift();
        return false;
      }
      return true;
    });
    // billing: busy or starting instances, plus idle ones you chose to keep warm
    const alive = sim.inst.filter((i) => i.state !== 'err');
    sim.paid += dt * (alive.filter((i) => i.active > 0 || i.state === 'starting').length + Math.min(opt.min, alive.filter((i) => i.active === 0 && i.state === 'warm').length));
    // reap idle instances above the minimum; clear failed ones
    let keep = alive.length;
    sim.inst = sim.inst.filter((i) => {
      if (i.state === 'err') return sim.t < i.until;
      if (i.state === 'warm' && i.active === 0 && sim.t - i.idleSince > IDLE && keep > opt.min) { keep--; return false; }
      return true;
    });
    while (sim.inst.filter((i) => i.state !== 'err').length < opt.min && sim.inst.length < MAX) sim.inst.push({ id: sim.nextId++, state: 'starting', born: sim.t, readyAt: sim.t + opt.cold, active: 0, conns: 0, idleSince: sim.t });
  }

  function seg(label, key, options, after) {
    const wrap = el('div', { class: 'w-seg', role: 'group', 'aria-label': label });
    const btns = options.map(([v, l]) => { const b = el('button', { class: 'btn', text: l }); b._v = v; b.onclick = () => { opt[key] = v; sync(); if (after) after(); }; wrap.append(b); return b; });
    const sync = () => btns.forEach((b) => b.classList.toggle('primary', opt[key] === b._v));
    sync(); return el('label', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } }, label + ' ', wrap);
  }

  function build(narrow) {
    if (loopH) loopH.stop();
    root.innerHTML = '';
    fresh();
    const W = narrow ? 360 : 700, per = narrow ? 8 : 16, rows = narrow ? 4 : 3, MAX = per * rows;
    const cw = (W - 12) / per, ch = narrow ? 44 : 40;
    const rateOut = el('b', { text: opt.rate + ' req/s' });
    const rate = el('input', { type: 'range', min: 0, max: 40, step: 1, value: opt.rate, 'aria-label': 'Requests per second', style: { width: '130px' } });
    rate.addEventListener('input', () => { opt.rate = +rate.value; rateOut.textContent = opt.rate + ' req/s'; });
    const burst = el('button', { class: 'btn primary', text: '⚡ Burst of 40' });
    const log = el('div', { class: 'w-log', 'aria-live': 'polite' });
    const say = (t) => { log.prepend(el('div', { html: t })); while (log.children.length > 25) log.lastChild.remove(); };
    burst.onclick = () => { sim.burst += 40; say('⚡ 40 requests arrive in the same instant.'); if (ctx.reduced) advance(); };
    const restart = () => { const keepRate = opt.rate; fresh(); opt.rate = keepRate; log.innerHTML = ''; say(describe()); paint(); };
    const reset = el('button', { class: 'btn', text: 'Reset' }); reset.onclick = restart;
    const stepB = el('button', { class: 'btn', text: '⏭ Advance 2 s' });
    function advance() { for (let k = 0; k < 40; k++) tick(0.05, MAX, onDbFull); paint(); }
    stepB.onclick = advance;
    const describe = () => `${opt.conc === 1 ? '<b>Function</b>: 1 request per instance' : '<b>Container</b>: 10 requests per instance'}, cold start <b>${opt.cold} s</b>, ${opt.min} kept warm, database ${opt.pool ? 'behind a <b>pooler</b> (' + POOL + ' real connections)' : '<b>direct</b> (limit ' + MAXDB + ')'}.`;
    root.append(el('div', { class: 'w-controls' },
      el('label', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } }, 'Traffic ', rate, rateOut), burst,
      seg('Unit', 'conc', [[1, 'Function'], [10, 'Container']], restart),
      seg('Cold start', 'cold', [[4, 'JVM 4 s'], [0.4, 'Snapshot 0.4 s'], [0.15, 'Native 0.15 s']], () => say(describe())),
      seg('Keep warm', 'min', [[0, '0'], [3, '3']], () => say(describe())),
      seg('Database', 'pool', [[false, 'Direct'], [true, 'Pooler']], restart),
      ctx.reduced ? stepB : null, reset));

    const stage = el('div', { class: 'w-stage' });
    const top = 26, gridH = rows * (ch + 6), dbY = top + gridH + 28, H = dbY + 34;
    const S = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Instances and database connections' });
    const T = (x, y, t, f, w, fill, a) => svg('text', { x, y, text: t, 'text-anchor': a || 'start', fill: fill || 'var(--text)', style: `font:${w || 600} ${f}px var(--sans)` });
    const head = T(6, 16, '', 14, 700, 'var(--text-3)');
    S.append(head);
    const cells = [];
    for (let k = 0; k < MAX; k++) {
      const x = 6 + (k % per) * cw, y = top + Math.floor(k / per) * (ch + 6);
      const bg = svg('rect', { x: x + 2, y, width: cw - 5, height: ch, rx: 6, fill: 'none', stroke: 'var(--border)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4' });
      const fill = svg('rect', { x: x + 2, y, width: 0, height: ch, rx: 6, fill: 'var(--warn)', 'fill-opacity': 0.35 });
      const tx = T(x + cw / 2 - 0.5, y + ch / 2 + 5, '', narrow ? 13 : 14, 700, 'var(--text)', 'middle');
      S.append(bg, fill, tx); cells.push({ bg, fill, tx, w: cw - 5 });
    }
    const dbLabel = T(6, dbY - 8, '', 14, 700, 'var(--text-3)');
    const dbBg = svg('rect', { x: 6, y: dbY, width: W - 12, height: 20, rx: 6, fill: 'var(--surface-2)', stroke: 'var(--border)', 'stroke-width': 1.5 });
    const dbBar = svg('rect', { x: 6, y: dbY, width: 0, height: 20, rx: 6, fill: 'var(--ok)' });
    S.append(dbLabel, dbBg, dbBar);
    stage.append(S);
    const legend = el('p', { class: 'muted', style: { margin: '6px 0 0', fontSize: '13px' }, html: '<b style="color:var(--warn)">▧</b> starting (cold) &nbsp; <b style="color:var(--accent)">■</b> busy &nbsp; <b style="color:var(--ok)">□</b> warm and idle &nbsp; <b style="color:var(--err)">■</b> could not connect &nbsp; dashed = no instance. The number is requests in flight. Idle instances are removed after ' + IDLE + ' s here; real platforms keep them for minutes.' });
    stage.append(legend);
    const stats = el('div', { class: 'w-stats' });
    root.append(stage, stats, log);

    let lastErrSay = -10;
    function onDbFull() { if (sim.t - lastErrSay > 3) { lastErrSay = sim.t; say(`✖ A new instance tried to open a connection: <b>${MAXDB} / ${MAXDB}</b> already in use. <code>too many clients already</code>. Its requests fail. Try the <b>Pooler</b>.`); } }
    const q = (p) => { if (!sim.lat.length) return '—'; const a = sim.lat.slice().sort((x, y) => x - y); const v = a[Math.min(a.length - 1, Math.floor(p * a.length))]; return v >= 1 ? v.toFixed(1) + ' s' : Math.round(v * 1000) + ' ms'; };
    function paint() {
      const alive = sim.inst.filter((i) => i.state !== 'err');
      head.textContent = 'Instances: ' + alive.length + (alive.length === 0 ? '  (scaled to zero)' : '') + ' · limit ' + MAX;
      cells.forEach((c, k) => {
        const i = sim.inst[k];
        if (!i) { c.bg.setAttribute('stroke', 'var(--border)'); c.bg.setAttribute('stroke-dasharray', '3 4'); c.bg.setAttribute('fill', 'none'); c.fill.setAttribute('width', 0); c.tx.textContent = ''; return; }
        c.bg.setAttribute('stroke-dasharray', 'none');
        if (i.state === 'starting') {
          c.bg.setAttribute('stroke', 'var(--warn)'); c.bg.setAttribute('fill', 'none');
          c.fill.setAttribute('width', c.w * Math.min(1, (sim.t - i.born) / Math.max(0.01, i.readyAt - i.born)));
          c.tx.textContent = i.active ? String(i.active) : ''; c.tx.setAttribute('fill', 'var(--warn)');
        } else if (i.state === 'err') {
          c.bg.setAttribute('stroke', 'var(--err)'); c.bg.setAttribute('fill', 'var(--err)'); c.fill.setAttribute('width', 0); c.tx.textContent = '✖'; c.tx.setAttribute('fill', 'var(--surface)');
        } else {
          const busy = i.active > 0;
          c.bg.setAttribute('stroke', busy ? 'var(--accent)' : 'var(--ok)'); c.bg.setAttribute('fill', busy ? 'var(--accent)' : 'none'); c.fill.setAttribute('width', 0);
          c.tx.textContent = busy ? String(i.active) : ''; c.tx.setAttribute('fill', 'var(--surface)');
        }
      });
      const used = opt.pool ? sim.dbBusy : directConns(), cap = opt.pool ? POOL : MAXDB;
      dbLabel.textContent = (opt.pool ? 'Pooled DB connections: ' : 'DB connections: ') + used + ' / ' + cap + (opt.pool ? '  (limit ' + MAXDB + ')' : '');
      dbBar.setAttribute('width', (W - 12) * Math.min(1, used / MAXDB));
      dbBar.setAttribute('fill', used >= cap ? (opt.pool ? 'var(--warn)' : 'var(--err)') : used >= cap * 0.7 ? 'var(--warn)' : 'var(--ok)');
      stats.innerHTML = '';
      [['served', sim.done], ['cold-start share', sim.done ? Math.round(sim.cold / sim.done * 100) + '%' : '—'], ['latency p50', q(0.5)], ['p99', q(0.99)],
        ['DB errors', sim.err + (sim.err ? ' ⚠' : '')], ['throttled (429)', sim.thr],
        ['avg instances paid for', sim.t > 0.5 ? (sim.paid / sim.t).toFixed(1) : '—']
      ].forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: `${k}: <b>${v}</b>` })));
    }
    say(describe() + ' Press <b>⚡ Burst</b>, then stop the traffic and watch it scale to zero.');
    paint();
    if (!ctx.reduced) {
      loopH = ctx.loop((dt) => {
        let left = Math.min(0.25, dt / 1000);                  // never jump more than 250 ms after a pause
        while (left > 0) { const d = Math.min(0.05, left); tick(d, MAX, onDbFull); left -= d; }
        paint();
      });
    }
  }
  build(ctx.narrow);
  ctx.onResize(build);
});
