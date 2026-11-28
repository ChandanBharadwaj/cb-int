/* Discovery lab: lease-based registry + caller-side cache. Instances heartbeat every H seconds; the registry evicts an
   entry after 3 missed heartbeats; the caller refreshes its cached list every R seconds (0 = pushed) and round-robins over it. */
SD.widget('ms-discovery-config-security', function (root, ctx) {
  const { el, svg } = ctx;
  const N = 4, MISS = 3, DRAIN = 10, RATE = 4, SPEED = 2.5;      // 4 requests per sim-second; 1 real s = 2.5 sim s
  const opt = { hb: 5, refresh: 10, retry: false, running: !ctx.reduced };
  let gen = 0, loopH = null;
  let t, inst, cache, nextRefresh, nextReq, rr, st;

  function reset() {
    t = 0; rr = 0; nextReq = 0; nextRefresh = opt.refresh;
    inst = []; cache = [];
    for (let i = 0; i < N; i++) { inst.push({ alive: true, draining: false, drainUntil: 0, reg: true, lastSeen: 0, nextHb: opt.hb * (i + 1) / N, ok: 0, fail: 0, goneAt: null, flash: 0, flashTone: 'ok' }); cache.push(true); }
    st = { sent: 0, failed: 0, retried: 0, lastWindow: null };
  }

  function build(narrow) {
    const my = ++gen;
    if (loopH) loopH.stop();
    root.innerHTML = '';
    const W = narrow ? 360 : 560, k = W / 360, F = narrow ? 13.5 : 14, RH = 46, TOP = 26;
    const COL = [[4, 100], [108, 100], [212, 84], [300, 56]].map(([x, w]) => [x * k, w * k]);
    const H = TOP + N * RH + 4;

    const sel = (label, key, options, after) => {
      const s = el('select', { 'aria-label': label });
      options.forEach(([v, txt]) => s.append(el('option', { value: v, text: txt })));
      s.value = String(opt[key]);
      s.addEventListener('change', () => { opt[key] = +s.value; after(); paint(); });
      return el('label', null, label + ' ', s);
    };
    const btn = (text, fn, primary) => { const b = el('button', { class: 'btn' + (primary ? ' primary' : ''), text }); b.onclick = () => { fn(); paint(); }; return b; };
    const retryB = el('button', { class: 'btn' });
    const playB = el('button', { class: 'btn' });
    const syncB = () => {
      retryB.textContent = '↻ Retry on another: ' + (opt.retry ? 'on' : 'off'); retryB.classList.toggle('primary', opt.retry);
      playB.textContent = opt.running ? '⏸ Pause' : '▶ Run';
    };
    retryB.onclick = () => { opt.retry = !opt.retry; syncB(); };
    playB.onclick = () => { opt.running = !opt.running; syncB(); };
    root.append(el('div', { class: 'w-controls' },
      sel('Heartbeat', 'hb', [['2', 'every 2 s'], ['5', 'every 5 s'], ['10', 'every 10 s']], () => inst.forEach((x, i) => { x.nextHb = t + opt.hb * (i + 1) / N; })),
      sel('Caller cache', 'refresh', [['0', 'pushed (0 s)'], ['10', 'refresh 10 s'], ['30', 'refresh 30 s']], () => { nextRefresh = t + opt.refresh; }),
      retryB,
      btn('💥 Crash a pod', crash, true), btn('Graceful stop', graceful), btn('＋ Start a pod', start),
      playB, btn('Step +5 s', () => advance(5)), btn('Reset', () => { reset(); log.innerHTML = ''; hint(); })));

    const stage = el('div', { class: 'w-stage' });
    const S = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Pods, registry entries and the caller cache', style: narrow ? '' : 'max-width:780px;display:block;margin:0 auto' });
    stage.append(S);
    const legend = el('p', { class: 'muted', style: { margin: '6px 0 0', fontSize: '13px' } });
    stage.append(legend);
    const stats = el('div', { class: 'w-stats' });
    const log = el('div', { class: 'w-log', 'aria-live': 'polite' });
    root.append(stage, stats, log);
    const say = (h) => { if (my !== gen) return; log.prepend(el('div', { html: '<b>t=' + t.toFixed(0) + ' s</b> ' + h })); while (log.children.length > 40) log.lastChild.remove(); };
    const hint = () => say('Crash a pod and compare the three columns. The registry needs <b>' + MISS + ' missed heartbeats</b>; the caller then needs its next refresh.');

    function crash() {
      const i = inst.findIndex((x) => x.alive && !x.draining); if (i < 0) return;
      inst[i].alive = false; inst[i].goneAt = t;
      say('💥 <b>pay-' + (i + 1) + '</b> crashed. No goodbye was sent: the registry and the caller still list it.');
    }
    function graceful() {
      const i = inst.findIndex((x) => x.alive && !x.draining); if (i < 0) return;
      const x = inst[i]; x.draining = true; x.drainUntil = t + DRAIN; x.reg = false; x.goneAt = t;
      say('<b>pay-' + (i + 1) + '</b> stops gracefully: it <b>deregisters first</b>, then keeps serving for ' + DRAIN + ' s while callers catch up.');
    }
    function start() {
      const i = inst.findIndex((x) => !x.alive); if (i < 0) return;
      const x = inst[i]; x.alive = true; x.draining = false; x.reg = true; x.lastSeen = t; x.nextHb = t + opt.hb; x.goneAt = null;
      say('＋ <b>pay-' + (i + 1) + '</b> started and registered. The caller sees it after its next refresh.');
    }
    function request() {
      st.sent++;
      const listed = []; for (let i = 0; i < N; i++) if (cache[i]) listed.push(i);
      if (!listed.length) { st.failed++; return; }
      let i = listed[rr++ % listed.length];
      const up = (j) => inst[j].alive;                      // a draining pod still serves
      if (!up(i)) {
        inst[i].fail++; inst[i].flash = 0.5; inst[i].flashTone = 'err';
        const alt = opt.retry ? listed.find((j) => j !== i && up(j)) : undefined;
        if (alt === undefined) { st.failed++; return; }
        st.retried++; i = alt;
      }
      inst[i].ok++; inst[i].flash = 0.3; inst[i].flashTone = 'ok';
    }
    function stepOnce(h) {
      t += h;
      const ttl = opt.hb * MISS;
      inst.forEach((x, i) => {
        x.flash = Math.max(0, x.flash - h);
        if (x.draining && t >= x.drainUntil) { x.draining = false; x.alive = false; say('<b>pay-' + (i + 1) + '</b> finished draining and exited.'); }
        if (x.alive && !x.draining && t >= x.nextHb) { x.lastSeen = t; x.reg = true; x.nextHb += opt.hb; }
        if (x.reg && t - x.lastSeen > ttl) { x.reg = false; say('Registry: lease of <b>pay-' + (i + 1) + '</b> expired after ' + ttl + ' s without a heartbeat. Entry removed.'); }
      });
      if (opt.refresh === 0 || t >= nextRefresh) {
        inst.forEach((x, i) => { cache[i] = x.reg; });
        if (opt.refresh > 0) nextRefresh += opt.refresh;
      }
      inst.forEach((x, i) => {
        if (x.goneAt !== null && !cache[i]) {
          st.lastWindow = t - x.goneAt; x.goneAt = null;
          say('Caller cache dropped <b>pay-' + (i + 1) + '</b> after <b>' + st.lastWindow.toFixed(0) + ' s</b>. ' + (x.fail ? x.fail + ' requests hit it while it was dead' + (opt.retry ? ', each retried on another pod.' : '.') : 'No request failed.'));
        }
      });
      while (t >= nextReq) { request(); nextReq += 1 / RATE; }
    }
    function advance(ds) { let rem = ds; while (rem > 1e-9) { const h = Math.min(0.05, rem); rem -= h; stepOnce(h); } }

    const T = (x, y, s, a, fill, w) => svg('text', { x, y, text: s, 'text-anchor': a || 'start', fill: fill || 'var(--text)', style: 'font:' + (w || 600) + ' ' + F + 'px var(--sans)' });
    function cell(c, row, text, tone, extra) {
      const [x, w] = COL[c], y = TOP + row * RH + 3, col = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', off: 'var(--border)' }[tone];
      S.append(svg('rect', { x, y, width: w, height: RH - 8, rx: 8, fill: 'var(--surface-2)', stroke: col, 'stroke-width': tone === 'off' ? 1 : 2 }));
      S.append(T(x + w / 2, y + (extra === undefined ? 24 : 20), text, 'middle', tone === 'off' ? 'var(--text-3)' : col, 700));
      if (extra !== undefined) {      // lease bar: time left before the registry gives up on this entry
        S.append(svg('rect', { x: x + 10, y: y + 27, width: w - 20, height: 5, rx: 2, fill: 'var(--border)' }));
        S.append(svg('rect', { x: x + 10, y: y + 27, width: Math.max(0, (w - 20) * extra), height: 5, rx: 2, fill: col }));
      }
    }
    function paint() {
      if (my !== gen) return;
      S.innerHTML = '';
      ['Pod (truth)', 'Registry', 'Caller', 'ok/fail'].forEach((h, c) => S.append(T(COL[c][0] + COL[c][1] / 2, 16, h, 'middle', 'var(--text-3)', 600)));
      const ttl = opt.hb * MISS;
      inst.forEach((x, i) => {
        const up = x.alive;
        cell(0, i, 'pay-' + (i + 1) + (x.draining ? ' drain' : up ? ' up' : ' dead'), x.draining ? 'warn' : up ? 'ok' : 'err');
        if (x.reg) cell(1, i, up ? 'listed' : 'stale', up ? 'ok' : 'warn', Math.max(0, 1 - (t - x.lastSeen) / ttl)); else cell(1, i, '—', 'off');
        if (cache[i]) cell(2, i, up ? 'listed' : 'stale', up ? 'ok' : 'err'); else cell(2, i, '—', 'off');
        const [cx, cw] = COL[3], y = TOP + i * RH + 3;
        if (x.flash > 0) S.append(svg('rect', { x: cx, y, width: cw, height: RH - 8, rx: 8, fill: x.flashTone === 'ok' ? 'var(--ok)' : 'var(--err)', opacity: 0.22 }));
        S.append(T(cx + cw / 2, y + 24, x.ok + '/' + x.fail, 'middle', x.fail ? 'var(--err)' : 'var(--text)', 600));
      });
      legend.innerHTML = 'Lease = ' + MISS + ' × ' + opt.hb + ' s = <b>' + ttl + ' s</b> (the bar under each registry entry). Caller ' + (opt.refresh ? 'refreshes in <b>' + Math.max(0, nextRefresh - t).toFixed(0) + ' s</b>.' : 'gets changes <b>pushed</b>.') + ' Worst case for a crash: <b>' + (ttl + opt.refresh) + ' s</b>.';
      stats.innerHTML = '';
      [['time', t.toFixed(0) + ' s'], ['sent', st.sent], ['failed', st.failed + (st.sent ? ' (' + (st.failed / st.sent * 100).toFixed(1) + '%)' : '')], ['saved by retry', st.retried], ['last removal took', st.lastWindow === null ? '—' : st.lastWindow.toFixed(0) + ' s']]
        .forEach(([a, b]) => stats.append(el('span', { class: 'w-stat', html: a + ': <b>' + b + '</b>' })));
    }
    loopH = ctx.loop((dt) => {
      if (!opt.running || ctx.reduced) return;
      advance(Math.min(dt, 100) / 1000 * SPEED);
      paint();
    });
    syncB(); paint();
    if (!log.children.length) hint();
    if (ctx.reduced) say('Animation is off (reduced motion). Use <b>Step +5 s</b> to move time forward.');
  }
  reset();
  build(ctx.narrow);
  ctx.onResize(build);
});
