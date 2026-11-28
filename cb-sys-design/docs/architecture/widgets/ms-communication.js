/* Call lab: per-attempt timeouts, retries with full-jitter backoff, a request deadline, and server-side idempotency keys. */
SD.widget('ms-communication', function (root, ctx) {
  const { el, svg } = ctx;
  const DEADLINE = 2000, SPAN = 2200, BASE = 100, CAP = 1000;   // ms
  const opt = { server: 'slow', timeout: 300, retries: 0, backoff: 'none', key: false };
  let seed = 3, narrow = ctx.narrow, S, stats, log, loopH, now = Infinity, rows = [];

  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // The real mechanism for one request. The server keeps working after the client times out.
  function simulate(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = rng(seed * 1000 + i * 17 + 1);                   // same traffic for every setting
      const draws = [0, 1, 2, 3].map(() => ({ u: r(), flaky: r(), jit: r() }));
      const req = { attempts: [], charges: [], ok: false, end: 0 };
      let t = 0, firstCommit = null;
      for (let a = 0; a <= opt.retries; a++) {
        const d = draws[a];
        if (a > 0) {                                             // full jitter: sleep = random(0, min(cap, base * 2^attempt))
          const sleep = opt.backoff === 'exp' ? d.jit * Math.min(CAP, BASE * Math.pow(2, a - 1)) : 0;
          if (t + sleep >= DEADLINE) break;
          t += sleep;
        }
        const start = t, limit = Math.min(opt.timeout, DEADLINE - start);
        if (limit <= 0) break;
        if (opt.server === 'flaky' && d.flaky < 0.35) {          // fails fast, no side effect
          req.attempts.push({ start, end: start + 30, kind: 'err' }); t = start + 30; continue;
        }
        const lat = opt.server === 'slow' ? 150 + 1400 * d.u * d.u : 50 + 250 * d.u * d.u;
        let serverEnd;
        if (opt.key && firstCommit !== null) serverEnd = Math.max(start + 10, firstCommit);   // repeat: wait for / replay the first result
        else { serverEnd = start + lat; req.charges.push(serverEnd); if (firstCommit === null) firstCommit = serverEnd; }
        if (serverEnd - start <= limit) { req.attempts.push({ start, end: serverEnd, kind: 'ok' }); req.ok = true; t = serverEnd; break; }
        req.attempts.push({ start, end: start + limit, kind: 'timeout', serverEnd }); t = start + limit;
      }
      req.end = t; req.charges.sort((x, y) => x - y); out.push(req);
    }
    return out;
  }

  function draw() {
    const W = narrow ? 360 : 640, f = narrow ? 13 : 14, rowH = narrow ? 27 : 26, x0 = narrow ? 34 : 44, top = 8;
    const H = top + rows.length * rowH + 30, k = (W - x0 - 8) / SPAN, X = (ms) => x0 + ms * k;
    S.setAttribute('viewBox', '0 0 ' + W + ' ' + H); S.innerHTML = '';
    const T = (x, y, t, a, fill, w) => svg('text', { x, y, text: t, 'text-anchor': a || 'start', fill: fill || 'var(--text-3)', style: 'font:' + (w || 500) + ' ' + f + 'px var(--sans)' });
    const base = top + rows.length * rowH;
    (narrow ? [0, 500, 1000, 2000] : [0, 500, 1000, 1500, 2000]).forEach((ms) => {
      S.append(svg('line', { x1: X(ms), y1: top, x2: X(ms), y2: base + 4, stroke: ms === DEADLINE ? 'var(--err)' : 'var(--border)', 'stroke-width': ms === DEADLINE ? 2 : 1, 'stroke-dasharray': ms === DEADLINE ? '5 4' : '2 4' }));
      S.append(T(X(ms), base + 20, ms === 0 ? '0' : ms === DEADLINE ? '2 s deadline' : ms / 1000 + ' s', ms === DEADLINE ? 'end' : ms === 0 ? 'start' : 'middle', ms === DEADLINE ? 'var(--err)' : 'var(--text-3)', ms === DEADLINE ? 700 : 500));
    });
    rows.forEach((q, i) => {
      const y = top + i * rowH, cy = y + rowH / 2;
      S.append(T(4, cy + f * 0.36, '#' + (i + 1), 'start', 'var(--text-2)', 600));
      S.append(svg('line', { x1: x0, y1: cy, x2: X(Math.min(now, q.end)), y2: cy, stroke: 'var(--border)', 'stroke-width': 1 }));
      q.attempts.forEach((a) => {
        if (a.start > now) return;
        const col = a.kind === 'ok' ? 'var(--ok)' : a.kind === 'timeout' ? 'var(--warn)' : 'var(--err)';
        if (a.kind === 'timeout' && a.serverEnd > a.end) S.append(svg('rect', { x: X(a.start), y: cy - 4, width: Math.max(0, X(Math.min(now, a.serverEnd, SPAN)) - X(a.start)), height: 8, rx: 3, fill: 'var(--text-3)', opacity: 0.35 }));
        S.append(svg('rect', { x: X(a.start), y: cy - 8, width: Math.max(2, X(Math.min(now, a.end)) - X(a.start)), height: 16, rx: 4, fill: col }));
      });
      q.charges.forEach((c, n) => { if (c <= now && c <= SPAN) S.append(svg('circle', { cx: X(c), cy, r: 6, fill: n ? 'var(--err)' : 'var(--surface)', stroke: n ? 'var(--err)' : 'var(--text)', 'stroke-width': 2.5 })); });
    });
  }
  function summarise(quiet) {
    const n = rows.length, ok = rows.filter((q) => q.ok).length, att = rows.reduce((s, q) => s + q.attempts.length, 0);
    const dup = rows.reduce((s, q) => s + Math.max(0, q.charges.length - 1), 0), ghost = rows.filter((q) => !q.ok && q.charges.length).length;
    const slow = Math.round(Math.max.apply(null, rows.map((q) => q.end)));
    stats.innerHTML = '';
    [['client saw success', ok + ' / ' + n], ['attempts sent', att + ' (×' + (att / n).toFixed(1) + ')'], ['duplicate charges', dup], ['"failed" but charged', ghost], ['slowest answer', slow + ' ms']]
      .forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: k + ': <b>' + v + '</b>' })));
    if (quiet) return;
    let msg = 'Server <b>' + opt.server + '</b>, timeout ' + opt.timeout + ' ms, ' + opt.retries + ' retries' + (opt.retries ? ' (' + (opt.backoff === 'exp' ? 'backoff + jitter' : 'no backoff') + ')' : '') + ', key ' + (opt.key ? 'on' : 'off') + ': ';
    if (dup) msg += '<b>' + dup + ' duplicate charge' + (dup > 1 ? 's' : '') + '</b>. The client timed out, but the server finished the first attempt anyway, and the retry charged again.';
    else if (ghost) msg += ghost + ' request' + (ghost > 1 ? 's' : '') + ' reported as failed although the card <b>was charged</b>. A timeout means "unknown", not "failed".';
    else if (ok < n) msg += (n - ok) + ' failed cleanly, with no charge.' + (opt.retries ? ' Retries are bounded, so some requests still fail.' : ' A retry would help here.');
    else if (opt.key && att > n) msg += 'every request succeeded and each card was charged <b>once</b>: repeats got the stored result.';
    else msg += 'all succeeded on the first attempt.';
    log.prepend(el('div', { html: msg })); while (log.children.length > 30) log.lastChild.remove();
  }
  function run(quiet) {
    rows = simulate(narrow ? 8 : 12);
    now = ctx.reduced ? Infinity : 0;
    draw(); summarise(quiet);
  }

  function build() {
    if (loopH) loopH.stop();
    root.innerHTML = '';
    const seg = (label, key, options) => {
      const wrap = el('div', { class: 'w-seg', role: 'group', 'aria-label': label });
      const btns = options.map(([v, l]) => { const b = el('button', { class: 'btn', text: l }); b.onclick = () => { opt[key] = v; sync(); run(); }; b._v = v; wrap.append(b); return b; });
      const sync = () => btns.forEach((b) => b.classList.toggle('primary', opt[key] === b._v));
      sync(); return el('label', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } }, label + ' ', wrap);
    };
    const tOut = el('b', { text: opt.timeout + ' ms' });
    const range = el('input', { type: 'range', min: 100, max: 1500, step: 50, value: opt.timeout, 'aria-label': 'Timeout per attempt', style: { width: '120px' } });
    range.addEventListener('input', () => { opt.timeout = +range.value; tOut.textContent = opt.timeout + ' ms'; run(true); now = Infinity; draw(); });
    range.addEventListener('change', () => run());
    const keyBtn = el('button', { class: 'btn' });
    const syncKey = () => { keyBtn.textContent = '🔑 Idempotency key: ' + (opt.key ? 'on' : 'off'); keyBtn.classList.toggle('primary', opt.key); };
    keyBtn.onclick = () => { opt.key = !opt.key; syncKey(); run(); }; syncKey();
    const fresh = el('button', { class: 'btn', text: 'New traffic' }); fresh.onclick = () => { seed++; run(); };
    root.append(el('div', { class: 'w-controls' },
      seg('Server', 'server', [['healthy', 'Healthy'], ['slow', 'Slow'], ['flaky', 'Flaky']]),
      el('label', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, 'Timeout ', range, tOut),
      seg('Retries', 'retries', [[0, '0'], [1, '1'], [2, '2'], [3, '3']]),
      seg('Backoff', 'backoff', [['none', 'None'], ['exp', 'Exp + jitter']]),
      keyBtn, fresh));
    const stage = el('div', { class: 'w-stage' });
    S = svg('svg', { role: 'img', 'aria-label': 'Timeline of attempts for each request' });
    stage.append(S, el('p', { class: 'muted', style: { margin: '8px 0 0', fontSize: '13px' }, html: 'Bars are attempts as the <b>client</b> sees them: <b style="color:var(--ok)">green</b> answered in time, <b style="color:var(--warn)">orange</b> timed out, <b style="color:var(--err)">red</b> failed fast. The thin grey bar is the <b>server</b> still working after the client gave up. ○ the card is charged; <b style="color:var(--err)">●</b> it is charged <b>again</b>.' }));
    stats = el('div', { class: 'w-stats' });
    log = el('div', { class: 'w-log', 'aria-live': 'polite' });
    root.append(stage, stats, log);
    run(true);
    log.prepend(el('div', { html: 'The server is slow and the client waits 300 ms. Set <b>Retries</b> to 2 and count the duplicate charges. Then switch the <b>idempotency key</b> on.' }));
    loopH = ctx.loop((dt) => { if (now >= SPAN) return; now += dt * 0.9; if (now >= SPAN) now = Infinity; draw(); });
  }
  build();
  ctx.onResize((n) => { narrow = n; build(); });
});
