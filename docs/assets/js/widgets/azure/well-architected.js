/* Well-Architected: a reliability simulator with retry policies during an outage, circuit-breaker states, and a regional failover timeline with RTO and RPO. */
IA.widget('well-architected', (root, ctx) => {
  /* ---- shared Azure widget kit (identical in every azure widget file) ---- */
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-az-style')) {
    document.head.append(el('style', { id: 'w-az-style', text: `
.w-az .nb rect { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .4s, stroke .4s; }
.w-az .nb { transition: opacity .45s; }
.w-az .nb text { fill: var(--text); font-size: 13px; font-family: var(--sans); }
.w-az .nb text.s { fill: var(--text-3); font-size: 10.5px; font-family: var(--mono); }
.w-az .nb.hot rect { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-az .nb.ok rect { stroke: var(--ok); stroke-width: 2.5; fill: color-mix(in srgb, var(--ok) 15%, var(--surface)); }
.w-az .nb.warn rect { stroke: var(--warn); stroke-width: 2.5; fill: color-mix(in srgb, var(--warn) 16%, var(--surface)); }
.w-az .nb.bad rect { stroke: var(--err); stroke-width: 2.5; fill: color-mix(in srgb, var(--err) 15%, var(--surface)); }
.w-az .nb.bad text.s, .w-az .nb.warn text.s, .w-az .nb.ok text.s, .w-az .nb.hot text.s { fill: var(--text-2); }
.w-az .nb.dim { opacity: .32; }
.w-az .nb.gone { opacity: .1; }
.w-az .eg { stroke: var(--border); stroke-width: 1.6; fill: none; transition: stroke .4s, opacity .4s; }
.w-az .eg.hot { stroke: var(--accent); stroke-width: 2.6; }
.w-az .eg.ok { stroke: var(--ok); stroke-width: 2.6; }
.w-az .eg.warn { stroke: var(--warn); stroke-width: 2.6; }
.w-az .eg.bad { stroke: var(--err); stroke-width: 2.6; stroke-dasharray: 6 4; }
.w-az .eg.dim { opacity: .25; }
.w-az .zn { fill: color-mix(in srgb, var(--surface-2) 70%, transparent); stroke: var(--border); stroke-dasharray: 6 5; transition: stroke .4s, fill .4s; }
.w-az .zn.bad { stroke: var(--err); fill: color-mix(in srgb, var(--err) 9%, transparent); }
.w-az .zn.hot { stroke: var(--accent); }
.w-az .lbl { fill: var(--text-2); font-size: 12px; font-family: var(--sans); }
.w-az .lbl.m { font-family: var(--mono); font-size: 11px; fill: var(--text-3); }
.w-az .pkt { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.w-az .bar { transition: width .6s ease, x .6s ease; }
.w-az.rm * { transition: none !important; animation: none !important; }
` }));
  }
  root.classList.add('w-az'); if (reduced) root.classList.add('rm');
  const Z = {};
  const clearZ = () => { for (const k in Z) delete Z[k]; };
  const seg = (opts, cur, on, label) => {
    const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' });
      b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); });
    return s;
  };
  const node = (g, id, x, y, w, h, t, s) => {
    const n = svg('g', { class: 'nb' });
    n.append(svg('rect', { x, y, width: w, height: h, rx: 8 }));
    n.append(svg('text', { x: x + w / 2, y: s != null ? y + h / 2 - 3 : y + h / 2 + 4, 'text-anchor': 'middle', text: t }));
    let se = null;
    if (s != null) { se = svg('text', { class: 's', x: x + w / 2, y: y + h / 2 + 12, 'text-anchor': 'middle', text: s }); n.append(se); }
    g.append(n); Z[id] = { n, base: 'nb', sub: se, sub0: s || '', x, y, w, h }; return n;
  };
  const edge = (g, id, d) => { const p = svg('path', { class: 'eg', d }); g.append(p); Z[id] = { n: p, base: 'eg' }; return p; };
  const link = (g, id, a, b) => {
    const A = Z[a]; const B = Z[b];
    const x1 = A.x + A.w / 2; const y1 = A.y + A.h; const x2 = B.x + B.w / 2; const y2 = B.y; const my = (y1 + y2) / 2;
    return edge(g, id, `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`);
  };
  const hlink = (g, id, a, b) => {
    const A = Z[a]; const B = Z[b]; const y1 = A.y + A.h / 2; const y2 = B.y + B.h / 2;
    const [x1, x2] = A.x < B.x ? [A.x + A.w, B.x] : [A.x, B.x + B.w]; const mx = (x1 + x2) / 2;
    return edge(g, id, `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
  };
  const mid = (id) => { const z = Z[id]; return [z.x + z.w / 2, z.y + z.h / 2]; };
  function paint(s) {
    for (const id in Z) { const z = Z[id]; const c = s && s.c && s.c[id];
      z.n.setAttribute('class', z.base + (c ? ' ' + c : ''));
      if (z.sub) z.sub.textContent = s && s.sub && s.sub[id] != null ? s.sub[id] : z.sub0; }
  }
  const cum = () => { let acc = {}; let sub = {};
    return { set(c, sb) { Object.assign(acc, c || {}); Object.assign(sub, sb || {}); return { c: { ...acc }, sub: { ...sub } }; }, clear() { acc = {}; sub = {}; } }; };
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const say = (n, h, cls) => { narr.className = 'caption' + (cls ? ' ' + cls : ''); narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: String(n) }), el('div', { class: 't', html: h })); };
  let gen = 0;
  const pkt = svg('circle', { r: 7, class: 'pkt', opacity: 0 });
  function fly(ids, ms) {
    const g = gen; const pts = ids.map((p) => (typeof p === 'string' ? mid(p) : p));
    return new Promise((res) => {
      if (reduced || pts.length < 2) return res();
      const L = []; let tot = 0;
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
      const dur = ms || 900; const t0 = performance.now(); pkt.setAttribute('opacity', 1);
      const fr = (t) => {
        if (g !== gen) { pkt.setAttribute('opacity', 0); return res(); }
        let d = Math.min(1, (t - t0) / dur) * tot; let i = 0;
        while (i < L.length - 1 && d > L[i]) { d -= L[i]; i++; }
        const f = L[i] ? Math.min(1, d / L[i]) : 1; const [x1, y1] = pts[i]; const [x2, y2] = pts[i + 1];
        pkt.setAttribute('cx', x1 + (x2 - x1) * f); pkt.setAttribute('cy', y1 + (y2 - y1) * f);
        if (t - t0 < dur) requestAnimationFrame(fr); else { pkt.setAttribute('opacity', 0); res(); }
      };
      requestAnimationFrame(fr);
    });
  }
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const controls = el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset);
  let steps = []; let k = 0; let running = false; let busy = false;
  function makeStepper(plan, intro, onReset, pause) {
    const reset = () => {
      gen++; running = false; busy = false; bPlay.textContent = '▶ Play'; k = 0;
      if (onReset) onReset(); steps = plan(); paint(null); say(0, intro()); bStep.disabled = false;
    };
    const step = async () => {
      if (busy || k >= steps.length) return false;
      busy = true; const g = gen; const s = steps[k++];
      if (s.pre) paint(s.pre);
      if (s.fly) await fly(s.fly, s.ms);
      if (g !== gen) return false;
      paint(s); if (s.run) s.run(); say(k, s.t, s.cls); busy = false;
      if (k >= steps.length) bStep.disabled = true;
      return true;
    };
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= steps.length) reset();
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && await step()) { if (k >= steps.length) break; await sleep(reduced ? 700 : (pause || 2600)); }
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    return reset;
  }
  /* ---- end kit ---- */
  let mode = 'retry';
  const stage = svg('svg', { viewBox: '0 0 640 340', role: 'img', 'aria-label': 'Reliability pattern simulator: retries during an outage, a circuit breaker, or a regional failover with RTO and RPO' });
  const segM = seg([['retry', 'Retries'], ['breaker', 'Circuit breaker'], ['dr', 'Regional failover']], mode, (v) => { mode = v; reset(); }, 'Pattern');
  const stats = el('div', { class: 'w-stats' });
  const stat = (h) => { stats.innerHTML = ''; h.forEach((x) => stats.append(el('span', { class: 'w-stat', html: x }))); };
  const zrect = (g, id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 10 }); g.append(r, svg('text', { class: 'lbl', x: x + 8, y: y + 17, text: label })); Z[id] = { n: r, base: 'zn' }; };
  /* ---------- retry simulator ---------- */
  const T = 36; const BASE = 100; const CAP = 150; const OUT = [6, 10];
  function simulate(policy) {
    const due = Array.from({ length: T + 20 }, () => [0, 0, 0, 0]);
    for (let t = 0; t < T; t++) due[t][0] += BASE;
    const rows = []; let gaveUp = 0; let attempts = 0; let fallback = 0; let openUntil = -1; let half = false;
    for (let t = 0; t < T; t++) {
      const cap = t >= OUT[0] && t <= OUT[1] ? 0 : CAP;
      let load = due[t].reduce((a, b) => a + b, 0);
      if (policy === 'breaker' && t < openUntil) { fallback += load; rows.push({ served: 0, failed: 0, fb: load, st: 'open' }); continue; }
      let sentRatio = 1; let st = 'closed';
      if (policy === 'breaker' && half) { st = 'half'; const trial = Math.min(load, 5); sentRatio = load ? trial / load : 1; fallback += load - trial; }
      const sent = load * sentRatio; attempts += sent;
      const served = Math.min(sent, cap); const fr = sent ? (sent - served) / sent : 0;
      for (let a = 0; a < 4; a++) {
        const f = due[t][a] * sentRatio * fr; if (!f) continue;
        if (policy === 'none' || a === 3) { gaveUp += f; continue; }
        if (policy === 'naive') due[t + 1][a + 1] += f;
        else { const hi = Math.pow(2, a + 1); for (let d = 1; d <= hi; d++) due[t + d][a + 1] += f / hi; }
      }
      if (policy === 'breaker') {
        if (fr > 0.5) { openUntil = t + 3; half = true; } else if (half) half = false;
      }
      rows.push({ served, failed: sent - served, fb: load - sent, st });
    }
    const peak = Math.max(...rows.map((r) => r.served + r.failed));
    const over = rows.filter((r, t) => t > OUT[1] && r.failed > 0.5).length;
    return { rows, peak, over, gaveUp, attempts, fallback, users: BASE * T };
  }
  const X0 = 46; const SL = 16.2; const BW = 11; const YB = 290; const K = 0.5;
  let chart = null;
  function drawSim(policy) {
    if (!chart) return; chart.innerHTML = '';
    const r = simulate(policy);
    chart.append(svg('rect', { x: X0 + OUT[0] * SL - 2, y: 40, width: (OUT[1] - OUT[0] + 1) * SL, height: YB - 40, fill: 'var(--err)', opacity: 0.08 }));
    chart.append(svg('text', { class: 'lbl m', x: X0 + OUT[0] * SL, y: 54, text: 'dependency down' }));
    r.rows.forEach((row, t) => {
      const x = X0 + t * SL; let y = YB;
      const put = (v, fill, op) => { if (v < 0.5) return; const h = Math.min(v * K, y - 30); y -= h; chart.append(svg('rect', { class: 'bar', x, y, width: BW, height: h, fill, opacity: op })); };
      put(row.served, 'var(--accent)', 0.85); put(row.failed, 'var(--err)', 0.85); put(row.fb, 'var(--text-3)', 0.35);
      if (row.st === 'open') chart.append(svg('text', { class: 'lbl m', x: x + BW / 2, y: YB + 12, 'text-anchor': 'middle', text: 'O' }));
      if (row.st === 'half') chart.append(svg('text', { class: 'lbl m', x: x + BW / 2, y: YB + 12, 'text-anchor': 'middle', text: 'H' }));
    });
    const cy = YB - CAP * K;
    chart.append(svg('line', { x1: X0 - 4, y1: cy, x2: 632, y2: cy, stroke: 'var(--ok)', 'stroke-dasharray': '6 4', 'stroke-width': 1.5 }));
    chart.append(svg('text', { class: 'lbl m', x: 630, y: cy - 5, 'text-anchor': 'end', text: 'capacity 150/tick' }));
    const amp = (r.attempts / r.users).toFixed(2);
    stat([`peak load <b>${Math.round(r.peak)}</b>/tick`, `overloaded after recovery <b>${r.over}</b> ticks`, `attempts per request <b>${amp}×</b>`, policy === 'breaker' ? `fallback (fast) <b>${Math.round(r.fallback)}</b>` : `users who saw an error <b>${Math.round(r.gaveUp)}</b>`]);
  }
  /* ---------- failover timeline ---------- */
  let tl = null; const TX0 = 40; const PXM = 32; // px per minute from 09:58
  const tx = (min) => TX0 + min * PXM;
  function mark(min, label, cls, row) {
    if (!tl) return; const x = tx(min); const y = 262 + (row || 0) * 22;
    tl.append(svg('line', { x1: x, y1: 250, x2: x, y2: y - 10, stroke: cls === 'bad' ? 'var(--err)' : cls === 'ok' ? 'var(--ok)' : 'var(--accent)', 'stroke-width': 2 }));
    tl.append(svg('text', { class: 'lbl m', x: Math.min(x + 3, 470), y, text: label }));
  }
  function bracket(a, b, label, color, y) {
    if (!tl) return;
    tl.append(svg('rect', { class: 'bar', x: tx(a), y: y - 8, width: Math.max(3, tx(b) - tx(a)), height: 8, rx: 3, fill: color, opacity: 0.75 }));
    tl.append(svg('text', { class: 'lbl', x: tx(b) + 6, y, text: label }));
  }
  function build() {
    stage.innerHTML = ''; clearZ(); chart = null; tl = null;
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    if (mode === 'retry') {
      const ax = svg('g');
      for (let v = 0; v <= 500; v += 100) { const y = YB - v * K; if (y < 30) break; ax.append(svg('line', { x1: X0 - 4, y1: y, x2: 632, y2: y, stroke: 'var(--border)', 'stroke-dasharray': v ? '3 4' : null }), svg('text', { class: 'lbl m', x: X0 - 8, y: y + 4, 'text-anchor': 'end', text: String(v) })); }
      ax.append(svg('text', { class: 'lbl m', x: X0, y: YB + 26, text: 'time (ticks) → · blue served · red failed · grey answered by fallback' }));
      chart = svg('g'); stage.append(ax, chart);
      stat([]); return;
    }
    if (mode === 'breaker') {
      node(g, 'app', 10, 40, 140, 56, 'orders-api', 'charge(order)');
      node(g, 'cl', 190, 40, 140, 56, 'CLOSED', 'failure rate 0%');
      node(g, 'op', 490, 40, 140, 56, 'OPEN', 'fail fast');
      node(g, 'ho', 340, 150, 150, 56, 'HALF-OPEN', '3 trial calls');
      node(g, 'dep', 10, 250, 160, 60, 'payments-api', 'healthy');
      node(g, 'fb', 470, 250, 160, 60, 'fallback', 'queue charge, reply 202');
      hlink(e, 'a', 'app', 'cl'); hlink(e, 'co', 'cl', 'op');
      edge(e, 'oh', 'M560 96 C 560 140, 530 178, 490 178'); edge(e, 'hc', 'M340 178 C 280 178, 260 140, 260 96');
      edge(e, 'ho2', 'M450 150 C 470 120, 500 110, 520 96');
      edge(e, 'cd', 'M230 96 C 230 200, 90 200, 90 250'); edge(e, 'of', 'M560 96 C 600 150, 600 200, 550 250');
      stage.append(bg, e, g, pkt); stat([]); return;
    }
    node(g, 'fd', 230, 8, 180, 48, 'Front Door', 'health probes');
    zrect(bg, 'ra', 10, 72, 300, 160, 'West Europe (primary)');
    zrect(bg, 'rb', 330, 72, 300, 160, 'North Europe (standby)');
    node(g, 'appA', 22, 100, 136, 52, 'orders app', '3 replicas');
    node(g, 'pgA', 22, 166, 136, 52, 'Postgres primary', 'writes');
    node(g, 'acrA', 168, 100, 130, 52, 'ACR', 'geo-replicated');
    node(g, 'kvA', 168, 166, 130, 52, 'Key Vault WEU', '');
    node(g, 'appB', 342, 100, 136, 52, 'orders app', 'warm: 1 replica');
    node(g, 'pgB', 342, 166, 136, 52, 'read replica', 'async, lag ~40 s');
    node(g, 'acrB', 488, 100, 130, 52, 'ACR replica', '');
    node(g, 'kvB', 488, 166, 130, 52, 'Key Vault NEU', '');
    edge(e, 'fa', 'M280 56 C 280 80, 90 70, 90 100'); edge(e, 'fb2', 'M360 56 C 360 80, 410 70, 410 100');
    hlink(e, 'rep', 'pgA', 'pgB');
    stage.append(svg('line', { x1: TX0, y1: 250, x2: 630, y2: 250, stroke: 'var(--border)', 'stroke-width': 1.5 }));
    [0, 2, 6, 10, 14, 18].forEach((m) => stage.append(svg('text', { class: 'lbl m', x: tx(m), y: 246, 'text-anchor': 'middle', text: String(9 + Math.floor((58 + m) / 60)).padStart(2, '0') + ':' + String((58 + m) % 60).padStart(2, '0') })));
    tl = svg('g');
    stage.append(bg, e, g, tl, pkt); stat([]);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'retry') {
      S.push({ run: () => drawSim('none'), t: 'A dependency goes down for 5 ticks. With <b>no retries</b>, every request in that window fails (red) and users see errors, but the dependency gets normal load the moment it is back.', cls: 'warn' });
      S.push({ run: () => drawSim('naive'), t: '<b>Immediate retries</b> (3 per request, no delay): each failure comes straight back next tick, on top of new traffic. Load climbs to several times normal and stays above capacity <i>after</i> the dependency recovers. A retry storm turns a blip into a longer outage.', cls: 'err' });
      S.push({ run: () => drawSim('backoff'), t: '<b>Exponential backoff with jitter</b>: retry 1 waits 1–2 ticks, retry 2 waits 1–4, retry 3 waits 1–8, spread randomly. The peak drops and far fewer users see an error, because most retries land after the dependency is back. Retries trickle in for longer, which is why a small attempt count and a retry budget still matter.', cls: 'ok' });
      S.push({ run: () => drawSim('breaker'), t: 'Add a <b>circuit breaker</b>: after the failure rate passes 50%, it opens (O) and answers from a fallback without calling the dependency, then sends a few trial calls half-open (H). The dependency gets almost no traffic while it is down, and users get a fast “we’ll confirm by email” instead of a timeout.', cls: 'ok' });
      return S;
    }
    if (mode === 'breaker') {
      S.push({ fly: ['app', 'cl', [230, 200], 'dep'], ...A.set({ a: 'ok', cl: 'ok', cd: 'ok', dep: 'ok' }), run: () => stat(['state <b>CLOSED</b>', 'window 20 calls', 'failures <b>0/20</b>']), t: '<b>Closed</b>: calls go through, and the breaker records each outcome in a sliding window (here the last 20 calls, with at least 10 before it judges).', cls: 'ok' });
      S.push({ fly: ['app', 'cl', [230, 200], 'dep'], ...A.set({ dep: 'bad', cd: 'bad', cl: 'warn' }, { dep: 'timeouts (3 s)', cl: 'failure rate 60%' }), run: () => stat(['failures <b>12/20</b>', 'threshold <b>50%</b>']), t: 'payments-api starts timing out. Each call holds a thread for the full timeout. The failure rate crosses the 50% threshold (slow calls can count too, with a slow-call threshold).', cls: 'err' });
      S.push({ fly: ['cl', 'op'], ...A.set({ co: 'bad', op: 'bad', cl: 'dim', cd: 'dim' }, { op: 'fail fast · 30 s' }), run: () => stat(['state <b>OPEN</b>', 'calls to dependency <b>0</b>']), t: '<b>Open</b>: for the wait duration (30 s) calls fail immediately with <code>CallNotPermittedException</code>, so no threads wait on a dead service and the dependency gets room to recover.', cls: 'err' });
      S.push({ fly: ['op', [600, 170], 'fb'], ...A.set({ of: 'warn', fb: 'warn' }, { fb: 'outbox · reply 202' }), t: 'The <b>fallback</b> records the charge in an outbox and replies “pending” (202). Degraded, but fast and honest. Not every call has a sensible fallback; sometimes failing fast is the fallback.', cls: 'warn' });
      S.push({ fly: ['op', [530, 178], 'ho'], ...A.set({ oh: 'hot', ho: 'warn', op: 'warn', ho2: 'bad' }, { ho: 'trial 1 failed', op: 'open again' }), run: () => stat(['state <b>HALF-OPEN</b> → OPEN']), t: 'After 30 s it goes <b>half-open</b> and lets 3 trial calls through. One fails above the threshold, so it opens again for another wait.', cls: 'warn' });
      S.push({ fly: ['ho', [260, 140], 'cl'], ...A.set({ ho: 'ok', hc: 'ok', cl: 'ok', cd: 'ok', dep: 'ok', op: 'dim', co: 'dim', of: 'dim', fb: 'dim' }, { ho: '3/3 trials ok', dep: 'recovered', cl: 'failure rate 0%' }), run: () => stat(['state <b>CLOSED</b>']), t: 'Next half-open: all trials succeed, so it <b>closes</b> and normal traffic resumes, gradually instead of all at once. Use one breaker per dependency, and keep the slow-call threshold below the caller’s timeout.', cls: 'ok' });
      return S;
    }
    S.push({ fly: ['fd', [90, 80], 'appA'], ...A.set({ fd: 'ok', fa: 'ok', appA: 'ok', pgA: 'ok', rep: 'hot', pgB: 'hot', appB: 'ok', acrA: 'ok', kvA: 'ok', acrB: 'ok', kvB: 'ok' }), run: () => { stat(['target <b>RTO 30 min</b>', 'target <b>RPO 5 min</b>']); }, t: 'Normal: Front Door sends traffic to West Europe. Postgres replicates <b>asynchronously</b> to a read replica in North Europe (lag about 40 s). The standby app runs with one replica, and the registry and Key Vault exist in <i>both</i> regions.' });
    S.push({ ...A.set({ ra: 'bad', appA: 'bad', pgA: 'bad', acrA: 'bad', kvA: 'bad', rep: 'bad', fa: 'bad' }), run: () => { mark(1.33, '09:59:20 last write replicated', 'hot', 1); mark(2, '10:00 region fails', 'bad', 0); bracket(1.33, 2, 'RPO ≈ 40 s', 'var(--err)', 312); stat(['writes lost: those after <b>09:59:20</b>']); }, t: 'At 10:00 the primary region fails. Writes from the last ~40 s never reached the replica: that is your <b>RPO</b>, set by replication lag, not by how fast you react.', cls: 'err' });
    S.push({ ...A.set({ fd: 'warn' }, { fd: 'probes failing' }), run: () => { mark(5, '10:03 alert + decision', 'hot', 2); }, t: 'Front Door probes and your alerts fire. Someone (or automation) confirms it is <b>regional</b>, not a bad deploy. Pre-agreed criteria for declaring a disaster save minutes here.', cls: 'warn' });
    S.push({ ...A.set({ pgB: 'ok' }, { pgB: 'promoted: read-write' }), run: () => { mark(10, '10:08 replica promoted', 'ok', 1); stat(['Postgres NEU: <b>primary</b>']); }, t: 'Promote the read replica to a standalone read-write server. Replication stops, so the old primary can’t simply rejoin later.', cls: 'ok' });
    S.push({ fly: ['fd', [410, 80], 'appB'], ...A.set({ fb2: 'ok', appB: 'ok', rb: 'ok', fd: 'ok' }, { appB: 'scaled to 3 replicas', fd: 'all traffic → NEU' }), run: () => { mark(14, '10:12 traffic restored', 'ok', 0); bracket(2, 14, 'RTO 12 min', 'var(--ok)', 334); stat(['RTO <b>12 min</b> ≤ 30', 'RPO <b>≈ 40 s</b> ≤ 5 min']); }, t: 'The standby app scales out, pulls images from the <b>local</b> registry replica and reads secrets from the <b>local</b> Key Vault, and Front Door moves traffic. Measured <b>RTO</b>: 12 minutes, inside the 30-minute target.', cls: 'ok' });
    S.push({ ...A.set({ acrB: 'hot', kvB: 'hot' }), t: 'What usually breaks a real failover: a secondary that still depends on the primary (registry, Key Vault, DNS zone, config), missing quota in the secondary region, and a runbook never rehearsed. Drill it, time every step, then plan the <b>failback</b>.', cls: 'warn' });
    return S;
  }
  const intro = () => ({ retry: 'Press Step to compare four policies against the same 5-tick outage. Watch peak load and attempts per request.', breaker: 'Press Play: the dependency fails, the breaker opens, tests and closes.', dr: 'Press Play: the primary region fails. Watch RPO and RTO appear on the timeline.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), stats, controls, narr);
  const reset = makeStepper(plan, intro, build, 3400);
  reset();
});
