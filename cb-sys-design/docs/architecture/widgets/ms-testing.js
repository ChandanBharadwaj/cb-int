/* Contract lab: one provider, two consumers. Edit the next version of any app, then run the real can-i-deploy rule:
   a version may deploy only if it is verified against the versions of its partners that are live in production. */
SD.widget('ms-testing', function (root, ctx) {
  const { el, svg } = ctx;
  const FIELDS = ['id', 'status', 'total', 'amount', 'currency', 'legacyStatus'];
  let A, gate = true, incidents = 0, narrow = ctx.narrow;

  function reset() {
    A = {
      api: { name: 'orders-api', role: 'provider', v: 1, live: new Set(['id', 'status', 'total', 'legacyStatus']) },
      web: { name: 'orders-web', role: 'consumer', v: 1, live: new Set(['id', 'status', 'total']) },
      bill: { name: 'billing', role: 'consumer', v: 1, live: new Set(['id', 'total', 'legacyStatus']) }
    };
    Object.values(A).forEach((a) => { a.next = new Set(a.live); });
    incidents = 0;
  }
  const consumers = () => [A.web, A.bill];
  const same = (a) => a.live.size === a.next.size && [...a.live].every((f) => a.next.has(f));
  // Verification of one pact: every field the consumer reads must be in the provider's response. Extra fields are fine.
  const missing = (reads, provides) => [...reads].filter((f) => !provides.has(f));
  // can-i-deploy <app next> --to-environment production
  function check(app) {
    const fails = [];
    if (app.role === 'provider') consumers().forEach((c) => { const m = missing(c.live, app.next); if (m.length) fails.push({ other: c, m }); });
    else { const m = missing(app.next, A.api.live); if (m.length) fails.push({ other: A.api, m }); }
    return fails;
  }
  const brokenLive = () => consumers().map((c) => ({ c, m: missing(c.live, A.api.live) })).filter((x) => x.m.length);

  // ---- static shell
  const gateBtn = el('button', { class: 'btn primary' });
  const syncGate = () => { gateBtn.textContent = 'Gate: ' + (gate ? 'on' : 'off'); gateBtn.classList.toggle('primary', gate); };
  gateBtn.onclick = () => { gate = !gate; syncGate(); say(gate ? '🛡 Gate on: every deploy asks the broker first.' : '⚠ Gate off: deploys go straight to production, as with unverified mocks.'); };
  const dep = (key, label) => { const b = el('button', { class: 'btn', text: label }); b.onclick = () => deploy(A[key]); return b; };
  const preset = el('button', { class: 'btn', text: 'Try: rename total → amount' });
  preset.onclick = () => { A.api.next.delete('total'); A.api.next.add('amount'); say('Provider <b>next</b> version now sends <code>amount</code> instead of <code>total</code>. Ask can-i-deploy for orders-api.'); render(); };
  const resetBtn = el('button', { class: 'btn', text: '↺ Reset' });
  resetBtn.onclick = () => { reset(); log.innerHTML = ''; say('Reset. Tap a field to change the <b>next</b> version of an app.'); render(); };
  root.append(el('div', { class: 'w-controls' }, dep('api', '▶ can-i-deploy orders-api'), dep('web', '▶ orders-web'), dep('bill', '▶ billing'), gateBtn, preset, resetBtn));
  const stage = el('div', { class: 'w-stage' });
  const legend = el('p', { class: 'muted', style: { margin: '6px 0 0', fontSize: '13px' }, html: '● in live and next &nbsp; <b style="color:var(--ok)">+</b> added in next &nbsp; <b style="color:var(--warn)">−</b> removed in next &nbsp; ○ not used &nbsp; <b style="color:var(--err)">red</b> = blocks the deploy' });
  const stats = el('div', { class: 'w-stats' });
  const log = el('div', { class: 'w-log', 'aria-live': 'polite' });
  root.append(stage, legend, stats, log);
  function say(t) { log.prepend(el('div', { html: t })); while (log.children.length > 30) log.lastChild.remove(); }

  function deploy(app) {
    if (same(app)) { say('<b>' + app.name + '</b>: next equals live, nothing to deploy. Tap a field in its box first.'); return; }
    const fails = check(app), nv = app.v + 1;
    const why = fails.map((f) => app.role === 'provider'
      ? f.other.name + ' v' + f.other.v + ' (live) reads <code>' + f.m.join(', ') + '</code>, which v' + nv + ' does not send'
      : 'it reads <code>' + f.m.join(', ') + '</code>, which orders-api v' + A.api.v + ' (live) does not send').join('; ');
    if (fails.length && gate) {
      say('✖ can-i-deploy ' + app.name + ' v' + nv + ' → production: <b>NO</b>. ' + why + '.' + (app.role === 'consumer' ? ' Deploy the provider change first.' : ' Keep the field until those consumers stop reading it.'));
      render(); return;
    }
    app.live = new Set(app.next); app.v = nv;
    if (fails.length) { incidents++; say('💥 Deployed ' + app.name + ' v' + nv + ' with no gate: ' + why + '. <b>Production is broken.</b>'); }
    else say('✔ can-i-deploy ' + app.name + ' v' + nv + ' → production: <b>YES</b>. Verified against every live partner. Deployed and recorded.');
    render();
  }

  function render() {
    const W = narrow ? 360 : 700, fs = narrow ? 14 : 15, pad = 6;
    const pc = narrow ? 2 : 3, prh = 26, cc = narrow ? 1 : 2, crh = narrow ? 23 : 26;
    const pb = { x: pad, y: pad, w: W - 2 * pad, h: 36 + (6 / pc) * prh + 6 };
    const cw = (W - 2 * pad - 8) / 2, cy = pb.y + pb.h + 30, chh = 36 + (6 / cc) * crh + 6;
    const H = cy + chh + pad;
    const S = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Provider and two consumers with the fields they send and read' });
    const T = (x, y, t, size, weight, fill, anchor) => svg('text', { x, y, text: t, 'text-anchor': anchor || 'start', fill: fill || 'var(--text)', style: 'font:' + (weight || 600) + ' ' + size + 'px var(--sans)' });
    const bad = brokenLive();

    function box(app, b, cols, rh) {
      const blocked = check(app), blockF = new Set();
      blocked.forEach((f) => f.m.forEach((x) => blockF.add(x)));
      const liveBad = app.role === 'consumer' ? (bad.find((x) => x.c === app) || { m: [] }).m : [];
      const tone = liveBad.length ? 'var(--err)' : !same(app) ? (blocked.length ? 'var(--err)' : 'var(--ok)') : 'var(--border)';
      S.append(svg('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 10, fill: 'var(--surface)', stroke: tone, 'stroke-width': 2 }));
      S.append(T(b.x + 10, b.y + 23, app.name, fs, 700));
      S.append(T(b.x + b.w - 10, b.y + 23, same(app) ? 'live v' + app.v : 'v' + app.v + ' → v' + (app.v + 1), 13, 600, 'var(--text-3)', 'end'));
      const cellW = (b.w - 12) / cols;
      FIELDS.forEach((f, i) => {
        const x = b.x + 6 + (i % cols) * cellW, y = b.y + 34 + Math.floor(i / cols) * rh;
        const L = app.live.has(f), N = app.next.has(f);
        let mark = L && N ? '●' : N ? '+' : L ? '−' : '○';
        let fill = L && N ? 'var(--text)' : N ? 'var(--ok)' : L ? 'var(--warn)' : 'var(--text-3)';
        // red when this field is what blocks the deploy, or what is broken in production right now
        if ((app.role === 'provider' && L && !N && blockF.has(f)) || (app.role === 'consumer' && N && blockF.has(f))) fill = 'var(--err)';
        if (liveBad.includes(f)) { fill = 'var(--err)'; mark = '✖'; }
        S.append(T(x + 6, y + rh - 8, mark + ' ' + f, fs, L || N ? 600 : 500, fill));
        const hit = svg('rect', { x, y, width: cellW, height: rh, fill: 'transparent', style: 'cursor:pointer' });
        hit.addEventListener('click', () => { if (N) app.next.delete(f); else app.next.add(f); render(); });
        S.append(hit);
      });
    }
    // links consumer -> provider, coloured by what is live right now
    consumers().forEach((c, i) => {
      const x = pad + i * (cw + 8) + cw / 2, isBad = bad.some((b) => b.c === c), col = isBad ? 'var(--err)' : 'var(--ok)';
      S.append(svg('line', { x1: x, y1: cy, x2: x, y2: pb.y + pb.h, stroke: col, 'stroke-width': 3, 'stroke-dasharray': isBad ? '5 4' : 'none' }));
      S.append(T(x + 8, cy - 9, isBad ? 'live: broken' : 'live: ok', 13, 600, col));
    });
    box(A.api, pb, pc, prh);
    consumers().forEach((c, i) => box(c, { x: pad + i * (cw + 8), y: cy, w: cw, h: chh }, cc, crh));
    stage.innerHTML = ''; stage.append(S);

    // the slice of the broker matrix that can-i-deploy reads
    stats.innerHTML = '';
    const cell = (k, okk) => stats.append(el('span', { class: 'w-stat', html: k + ': <b style="color:var(--' + (okk ? 'ok' : 'err') + ')">' + (okk ? '✓' : '✖') + '</b>' }));
    consumers().forEach((c) => cell(c.name + ' live × api next', !missing(c.live, A.api.next).length));
    consumers().forEach((c) => cell(c.name + ' next × api live', !missing(c.next, A.api.live).length));
    stats.append(el('span', { class: 'w-stat', html: 'production: <b style="color:var(--' + (bad.length ? 'err' : 'ok') + ')">' + (bad.length ? 'broken' : 'healthy') + '</b>' }));
    stats.append(el('span', { class: 'w-stat', html: 'incidents: <b>' + incidents + '</b>' }));
  }

  reset(); syncGate(); render();
  say('Tap <code>total</code> in orders-api to remove it from the next version, then press ▶ can-i-deploy orders-api. Fields a consumer does not read (try <code>status</code> for billing) are free to change.');
  ctx.onResize((n) => { narrow = n; render(); });
});
