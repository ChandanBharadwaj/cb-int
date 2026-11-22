/* Functions: cold start from zero bar by bar, and scale-out on Consumption vs Flex Consumption (always ready) vs Premium (pre-warmed). */
IA.widget('functions', (root, ctx) => {
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
  let mode = 'cons';
  const stage = svg('svg', { viewBox: '0 0 640 336', role: 'img', 'aria-label': 'Function cold start timeline and scale-out by hosting plan' });
  const segM = seg([['cons', 'Consumption (scale from zero)'], ['flex', 'Flex Consumption + always ready'], ['prem', 'Premium (pre-warmed)']], mode, (v) => { mode = v; reset(); }, 'Plan');
  const stats = el('div', { class: 'w-stats' });
  const stat = (h) => { stats.innerHTML = ''; h.forEach((x) => stats.append(el('span', { class: 'w-stat', html: x }))); };
  const PH = [['b0', 'allocate', 84], ['b1', 'host start', 92], ['b2', 'JVM + JAR load', 150], ['b3', 'app init', 104], ['b4', 'run', 70]];
  function build() {
    stage.innerHTML = ''; clearZ();
    const g = svg('g'); const e = svg('g'); const bg = svg('g');
    node(g, 'src', 10, 18, 160, 54, 'Event', 'HTTP / queue message');
    node(g, 'sc', 210, 18, 190, 54, 'Scale controller', 'watches trigger load');
    const sub0 = { cons: ['scaled to zero', '—', '—'], flex: ['always ready (baseline)', 'on demand', 'on demand'], prem: ['minimum instance', 'pre-warmed buffer', '—'] }[mode];
    for (let i = 0; i < 3; i++) node(g, 'i' + i, 440, 10 + i * 66, 190, 54, 'instance ' + (i + 1), sub0[i]);
    hlink(e, 'es', 'src', 'sc'); for (let i = 0; i < 3; i++) hlink(e, 'ei' + i, 'sc', 'i' + i);
    bg.append(svg('text', { class: 'lbl', x: 10, y: 230, text: 'first request on a new instance (illustrative proportions, not measurements)' }));
    let x = 10; PH.forEach(([id, t, w]) => { node(g, id, x, 244, w - 4, 40, t); x += w; });
    node(g, 'warm', 10, 292, 66, 36, 'run'); bg.append(svg('text', { class: 'lbl', x: 86, y: 315, text: '← a warm instance only pays this' }));
    stage.append(bg, e, g, pkt); stat([]);
  }
  function plan() {
    const A = cum(); const S = [];
    const hideBars = { b0: 'gone', b1: 'gone', b2: 'gone', b3: 'gone', b4: 'gone', warm: 'dim' };
    if (mode === 'cons') {
      S.push({ ...A.set({ ...hideBars, i0: 'dim', i1: 'gone', i2: 'gone', ei0: 'dim', ei1: 'gone', ei2: 'gone' }), run: () => stat(['instances <b>0</b>', 'cost while idle: <b>none</b>']), t: 'After a period with no events, the app is <b>scaled to zero</b>. That is the appeal of Consumption: no events, no compute bill.' });
      S.push({ fly: ['src', 'sc'], ...A.set({ src: 'hot', sc: 'hot', es: 'hot' }), t: 'An HTTP request arrives. The <b>scale controller</b> sees work and no instance to run it.' });
      S.push({ fly: ['sc', 'i0'], ...A.set({ i0: 'warn', ei0: 'warn', b0: 'warn' }, { i0: 'allocating…' }), t: '<b>Cold start, phase 1</b>: allocate a worker and mount your app package.', cls: 'warn' });
      S.push({ ...A.set({ b1: 'warn' }, { i0: 'host starting' }), t: 'The Functions <b>host</b> starts and loads binding extensions (Service Bus, Blob…).', cls: 'warn' });
      S.push({ ...A.set({ b2: 'warn' }, { i0: 'JVM starting' }), t: 'For Java, a separate <b>language worker</b> process starts the JVM and loads your JAR and dependencies. Big fat JARs and classpath scanning make this the longest bar.', cls: 'warn' });
      S.push({ ...A.set({ b3: 'warn', b4: 'ok', i0: 'ok', ei0: 'ok' }, { i0: 'warm' }), run: () => stat(['first request: <b>seconds</b>', 'next requests: <b>ms</b>']), t: 'Static initialisers and your own init (DI container, clients, connection pools) run, then the function executes. Later requests on this instance only pay the last bar.', cls: 'ok' });
      S.push({ fly: ['sc', 'i1'], ...A.set({ i1: 'warn', i2: 'warn', ei1: 'warn', ei2: 'warn' }, { i1: 'cold start', i2: 'cold start' }), run: () => stat(['instances <b>3</b>', '2 of them cold']), t: 'A burst of queue messages: the controller scales <b>out</b>, and <i>each new instance</i> pays its own cold start. A queue trigger hides this (messages wait); an HTTP user feels it.', cls: 'warn' });
      return S;
    }
    if (mode === 'flex') {
      S.push({ ...A.set({ ...hideBars, i0: 'ok', i1: 'gone', i2: 'gone', ei1: 'gone', ei2: 'gone' }), run: () => stat(['always-ready <b>1</b>', 'baseline billed']), t: '<b>Flex Consumption</b> (Linux) scales per function group, can scale to zero, supports VNet integration, and lets you keep <b>always-ready instances</b> for chosen functions or groups (for example, HTTP).' });
      S.push({ fly: ['src', 'sc', 'i0'], ...A.set({ src: 'hot', sc: 'hot', es: 'hot', ei0: 'ok', warm: 'ok' }), run: () => stat(['first request: <b>warm</b>']), t: 'The request lands on the always-ready instance, which is already loaded: no cold start. You pay a baseline for keeping it ready.', cls: 'ok' });
      S.push({ fly: ['sc', 'i1'], ...A.set({ i1: 'warn', ei1: 'warn', b0: 'warn', b1: 'warn', b2: 'warn', b3: 'warn', b4: 'warn' }, { i1: 'on demand: cold' }), run: () => stat(['instances <b>2</b>', 'the extra one is cold']), t: 'Load beyond what always-ready instances can absorb (Flex also lets you set per-instance HTTP concurrency) scales out with <b>on-demand</b> instances, and those still cold start.', cls: 'warn' });
      S.push({ fly: ['sc', 'i2'], ...A.set({ i1: 'ok', i2: 'ok', ei1: 'ok', ei2: 'ok' }, { i1: 'warm', i2: 'warm' }), run: () => stat(['instances <b>3</b>', 'scale-out is fast']), t: 'Scale-out is fast, and the instance memory size (for example 2 GB or 4 GB) is chosen per app. When the burst ends, on-demand instances go away; always-ready stays.', cls: 'ok' });
      return S;
    }
    S.push({ ...A.set({ ...hideBars, i0: 'ok', i1: 'hot', i2: 'gone', ei2: 'gone', ei1: 'hot' }), run: () => stat(['minimum <b>1</b>', 'pre-warmed <b>1</b>']), t: '<b>Premium (Elastic Premium)</b> always runs at least one instance, plus <b>pre-warmed</b> instances that are loaded and waiting. There is no scale-to-zero: you pay for the minimum around the clock.' });
    S.push({ fly: ['src', 'sc', 'i0'], ...A.set({ src: 'hot', sc: 'hot', es: 'hot', ei0: 'ok', warm: 'ok' }), run: () => stat(['first request: <b>warm</b>']), t: 'Requests hit the running instance, with no cold start.', cls: 'ok' });
    S.push({ fly: ['sc', 'i1'], ...A.set({ i1: 'ok', ei1: 'ok' }, { i1: 'serving (was pre-warmed)' }), run: () => stat(['instances <b>2</b>', 'no cold start on scale-out']), t: 'A burst: the <b>pre-warmed</b> instance takes traffic immediately…', cls: 'ok' });
    S.push({ ...A.set({ i2: 'warn', ei2: 'warn' }, { i2: 'warming in background' }), run: () => stat(['instances <b>3</b>', 'new buffer warming']), t: '…while the platform warms a new buffer instance in the background. Premium also gives VNet integration, bigger instances and longer timeouts. It suits steady, latency-sensitive Java functions.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ cons: 'Consumption: press Play to watch a cold start from zero, bar by bar, then a burst.', flex: 'Flex Consumption with one always-ready instance: press Play.', prem: 'Premium with a minimum and a pre-warmed instance: press Play.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), stats, controls, narr);
  const reset = makeStepper(plan, intro, build);
  reset();
});
