/* App Service: plan scale-out (every app on every instance), slot swap with sticky settings and warm-up, and health-check instance removal. */
IA.widget('app-service', (root, ctx) => {
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
  let mode = 'scale';
  const stage = svg('svg', { viewBox: '0 0 640 330', role: 'img', 'aria-label': 'App Service plan instances, deployment slots or health check' });
  const segM = seg([['scale', 'Plan scale-out'], ['slots', 'Slot swap'], ['health', 'Health check']], mode, (v) => { mode = v; reset(); }, 'Mechanism');
  const stats = el('div', { class: 'w-stats' });
  const stat = (h) => { stats.innerHTML = ''; h.forEach((x) => stats.append(el('span', { class: 'w-stat', html: x }))); };
  const zrect = (g, id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 10 }); g.append(r, svg('text', { class: 'lbl', x: x + 8, y: y + 17, text: label })); Z[id] = { n: r, base: 'zn' }; };
  function build() {
    stage.innerHTML = ''; clearZ();
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    if (mode === 'scale' || mode === 'health') {
      node(g, 'fe', 10, 130, 140, 56, 'Front ends', mode === 'health' ? 'pings /health' : 'ARR load balancer');
      zrect(bg, 'plan', 166, 30, 466, 286, mode === 'scale' ? 'asp-orders-prod (P1v3): both apps run on every instance' : 'asp-orders-prod: app-orders on 3 instances');
      const n = mode === 'scale' ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const x = 178 + i * 113;
        zrect(bg, 'i' + i, x, 52, 103, 250, 'instance ' + (i + 1));
        node(g, 'o' + i, x + 8, 86, 87, 54, 'orders', mode === 'health' ? 'healthy' : 'JVM 1.2 GB');
        if (mode === 'scale') node(g, 'a' + i, x + 8, 160, 87, 54, 'admin', 'JVM 0.6 GB');
        hlink(e, 'l' + i, 'fe', 'o' + i);
      }
    } else {
      node(g, 'users', 10, 118, 130, 56, 'Users', 'prod hostname');
      node(g, 'qa', 10, 238, 130, 56, 'QA / smoke tests', 'staging hostname');
      node(g, 'prod', 200, 100, 200, 74, 'production slot', 'v1.4');
      node(g, 'stg', 200, 220, 200, 74, 'staging slot', 'empty');
      node(g, 'sP', 440, 100, 190, 74, 'slot setting (sticky)', 'DB_URL = prod');
      node(g, 'sS', 440, 220, 190, 74, 'slot setting (sticky)', 'DB_URL = staging');
      hlink(e, 'u', 'users', 'prod'); hlink(e, 'q', 'qa', 'stg'); hlink(e, 'k1', 'prod', 'sP'); hlink(e, 'k2', 'stg', 'sS');
      edge(e, 'u2', 'M140 146 C 170 146, 170 257, 200 257');
      edge(e, 'x', 'M400 240 C 420 200, 420 175, 440 150');
    }
    stage.append(bg, e, g, pkt);
    stat([]);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'scale') {
      const base = { i2: 'gone', i3: 'gone', o2: 'gone', o3: 'gone', a2: 'gone', a3: 'gone', l2: 'gone', l3: 'gone' };
      S.push({ ...A.set({ ...base, o0: 'ok', o1: 'ok', a0: 'ok', a1: 'ok', l0: 'ok', l1: 'ok' }), run: () => stat(['instances <b>2</b>', 'CPU <b>45%</b>']), t: 'The <b>plan</b> is the compute: a set of VM instances of one SKU (here P1v3). <b>Every app in the plan runs on every instance</b>, so <code>orders</code> and <code>admin</code> both use each one.' });
      S.push({ fly: ['fe', 'o0'], ...A.set({ o0: 'warn', o1: 'warn' }), run: () => stat(['instances <b>2</b>', 'CPU <b>82%</b> for 10 min']), t: 'Traffic grows. An autoscale rule (“CPU &gt; 70% averaged over 10 min → +1 instance”) fires. Scale <b>out</b> adds instances; scale <b>up</b> means moving to a bigger SKU.', cls: 'warn' });
      S.push({ ...A.set({ i2: 'hot', o2: 'hot', a2: 'hot', l2: 'dim' }, { o2: 'starting…', a2: 'starting…' }), run: () => stat(['instances <b>3</b>', 'warming up']), t: 'Instance 3 joins, and <b>both</b> apps start on it, including <code>admin</code>, which didn’t need more capacity. The front ends route to it once the app answers (or once the warm-up/health check passes).' });
      S.push({ fly: ['fe', 'o2'], ...A.set({ o2: 'ok', a2: 'ok', l2: 'ok', o0: 'ok', o1: 'ok' }, { o2: 'JVM 1.2 GB', a2: 'JVM 0.6 GB' }), run: () => stat(['instances <b>3</b>', 'CPU <b>58%</b>']), t: 'Load spreads. With <b>ARR affinity</b> (on by default) existing users stay pinned to their old instance by cookie, so new instances fill slowly. Turn affinity off for stateless Spring APIs.', cls: 'ok' });
      S.push({ ...A.set({ i3: 'hot', o3: 'ok', a3: 'ok', l3: 'ok' }), run: () => stat(['instances <b>4</b>', 'max for this rule']), t: 'Another rule step adds instance 4, up to the rule’s maximum (and the SKU’s limit). Always pair scale-out rules with <b>scale-in</b> rules and a cool-down, or you pay for the peak all night.' });
      S.push({ ...A.set({ i3: 'gone', o3: 'gone', a3: 'gone', l3: 'gone', i2: '', o2: 'ok' }), run: () => stat(['instances <b>3</b>', 'scale-in after cool-down']), t: 'Load drops, and the scale-in rule removes an instance after the cool-down. For noisy or memory-hungry neighbours, use a separate plan, or <b>per-app scaling</b> to cap how many instances an app runs on.', cls: 'ok' });
      return S;
    }
    if (mode === 'slots') {
      S.push({ ...A.set({ prod: 'ok', u: 'ok', sP: 'hot', sS: 'hot', k1: 'hot', k2: 'hot' }), t: 'Production serves v1.4. A <b>staging slot</b> is a second live app with its own hostname, and it shares the plan’s instances. Settings marked <b>deployment slot setting</b> stick to their slot; others travel with the code.' });
      S.push({ ...A.set({ stg: 'hot' }, { stg: 'v1.5 deployed' }), t: 'CI deploys v1.5 to <b>staging</b>, not to production. Users don’t see it.' });
      S.push({ fly: ['qa', 'stg'], ...A.set({ qa: 'ok', q: 'ok', stg: 'ok' }), t: 'Smoke tests hit <code>…-staging.azurewebsites.net</code>. Careful: until the swap, staging runs with <i>staging’s</i> sticky settings.' });
      S.push({ ...A.set({ stg: 'warn', x: 'warn', sP: 'warn' }, { stg: 'v1.5 + prod settings, restart' }), t: '<b>Swap, phase 1</b>: App Service applies the <i>production</i> slot’s sticky settings to the staging instances and restarts them. If v1.5 can’t start with the production config, the swap stops here, and users never saw it.', cls: 'warn' });
      S.push({ ...A.set({ stg: 'warn' }, { stg: 'warming up /actuator/health' }), t: '<b>Warm-up</b>: the platform sends requests to each instance (the root path, or the <code>applicationInitialization</code> paths you configure) and waits for them to respond. JVM JIT and connection pools get warm before real traffic.', cls: 'warn' });
      S.push({ fly: ['users', 'stg'], ...A.set({ u: 'dim', u2: 'ok', stg: 'ok', prod: 'hot', x: '' }, { stg: 'v1.5 ← now production', prod: 'v1.4 ← now staging' }), t: '<b>Phase 2</b>: routing flips. Production traffic goes to the warm v1.5 instances without a restart, so there is zero downtime. v1.4 now sits in the staging slot.', cls: 'ok' });
      S.push({ ...A.set({ prod: 'ok' }), t: '<b>Rollback</b> = swap again: v1.4 is still warm in the other slot. Database migrations must be backward-compatible (expand, then contract), or rollback breaks.', cls: 'ok' });
      return S;
    }
    S.push({ ...A.set({ o0: 'ok', o1: 'ok', o2: 'ok', l0: 'ok', l1: 'ok', l2: 'ok' }), run: () => stat(['healthy <b>3/3</b>']), t: 'With <b>Health check</b> enabled (path <code>/actuator/health/readiness</code>), the platform pings every instance about once a minute. A 2xx response means healthy.' });
    S.push({ ...A.set({ o1: 'warn' }, { o1: 'fail 1' }), run: () => stat(['healthy <b>2/3</b>?', 'instance 2: <b>1</b> failure']), t: 'Instance 2’s JVM is stuck in a GC death spiral and its health call times out. One failure isn’t enough to act on.', cls: 'warn' });
    S.push({ ...A.set({ o1: 'bad', l1: 'bad' }, { o1: 'fail ×N' }), run: () => stat(['instance 2: failures ≥ threshold']), t: 'After the configured number of consecutive failures (the load-balancing threshold, 2–10 pings), the instance is <b>removed from the load balancer</b>. Microsoft Learn notes it won’t take out more than about half the instances.', cls: 'err' });
    S.push({ fly: ['fe', 'o2'], ...A.set({}), run: () => stat(['serving on <b>2</b> instances']), t: 'Users are served by instances 1 and 3. The sick one keeps being pinged, and if it recovers it rejoins.', cls: 'warn' });
    S.push({ ...A.set({ i1: 'hot', o1: 'ok', l1: 'ok' }, { o1: 'replaced' }), run: () => stat(['healthy <b>3/3</b>']), t: 'If it stays unhealthy (Microsoft Learn documents about an hour), the instance is <b>replaced</b>. This needs <b>2+ instances</b> to matter. Keep the endpoint cheap, and don’t fail it just because a downstream service is slow, or one dependency blip drains the whole app.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ scale: 'Press Play: CPU rises and the plan scales out. Watch every app land on every instance.', slots: 'Press Play: deploy to staging, test, then swap with warm-up.', health: 'Press Play: one instance goes bad and the health check takes it out of rotation.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), stats, controls, narr);
  const reset = makeStepper(plan, intro, build);
  reset();
});
