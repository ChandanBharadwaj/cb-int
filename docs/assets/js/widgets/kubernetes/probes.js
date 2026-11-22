/* Probes: a second-by-second simulation of startup, liveness and readiness probes against a Spring Boot pod with a 60 s boot, under five configurations. */
IA.widget('probes', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8pr-style')) {
    document.head.append(el('style', { id: 'w-k8pr-style', text: `
.k8pr svg text { font-family: var(--sans); }
.k8pr .ln { fill: var(--text); font-size: 11.5px; font-weight: 600; }
.k8pr .ln2 { fill: var(--text-3); font-size: 10px; font-family: var(--mono); }
.k8pr .track { fill: var(--surface-2); stroke: var(--border); }
.k8pr .boot { fill: color-mix(in srgb, var(--accent) 30%, var(--surface)); }
.k8pr .up { fill: var(--accent); opacity: .85; }
.k8pr .rdy { fill: var(--ok); opacity: .8; }
.k8pr .env { fill: color-mix(in srgb, var(--err) 30%, var(--surface)); stroke: var(--err); }
.k8pr .envw { fill: color-mix(in srgb, var(--warn) 30%, var(--surface)); stroke: var(--warn); }
.k8pr .ok { fill: var(--ok); } .k8pr .bad { fill: var(--err); }
.k8pr .kill { fill: var(--err); font-size: 13px; font-weight: 800; }
.k8pr .vl { stroke: var(--err); stroke-width: 1.5; stroke-dasharray: 3 3; }
.k8pr .cur { stroke: var(--text); stroke-width: 1.5; }
.k8pr .ax { fill: var(--text-3); font-size: 10px; font-family: var(--mono); }
.k8pr .cfg { font-family: var(--mono); font-size: 12px; }
` }));
  }
  const PRE = {
    naive: { label: 'liveness only, delay 10 s', T: 240, boot: 60,
      liveness: { delay: 10, period: 10, timeout: 1, fail: 3 }, readiness: { delay: 10, period: 10, timeout: 1, fail: 3 },
      cfg: 'livenessProbe: initialDelaySeconds 10, period 10, threshold 3 · no startupProbe',
      end: 'The pod never becomes Ready. Each restart begins the 60 s boot from zero, but liveness gives it only 10 + 3 × 10 = 40 s. Back-off grows (10, 20, 40, 80 s…), so this is CrashLoopBackOff with a clean app log. Fix: a startupProbe.' },
    startup: { label: 'startup + liveness + readiness', T: 280, boot: 60, hang: 170,
      startup: { delay: 0, period: 5, timeout: 1, fail: 24 }, liveness: { delay: 0, period: 10, timeout: 3, fail: 3 }, readiness: { delay: 0, period: 5, timeout: 1, fail: 3 },
      cfg: 'startupProbe 5 s × 24 (120 s budget) · liveness 10 s / timeout 3 · readiness 5 s',
      end: 'This is the healthy pattern. Startup absorbed the slow boot; readiness took the hung pod out of the Service ~10 s before liveness restarted it; the restart actually fixed the problem (a deadlock is exactly what liveness is for).' },
    liveDB: { label: 'liveness includes DB', T: 300, boot: 60, db: [110, 150], dbIn: ['liveness', 'readiness'],
      startup: { delay: 0, period: 5, timeout: 1, fail: 24 }, liveness: { delay: 0, period: 10, timeout: 3, fail: 3 }, readiness: { delay: 0, period: 5, timeout: 1, fail: 3 },
      cfg: 'same probes, but health group liveness.include=* (db included)',
      end: 'The DB was down for 40 s; this pod served nothing for much longer, because it was restarted and had to boot cold after the DB was already back. Multiply by every replica restarting at once, stampeding the DB with fresh connection pools.' },
    readyDB: { label: 'readiness includes DB', T: 240, boot: 60, db: [110, 150], dbIn: ['readiness'],
      startup: { delay: 0, period: 5, timeout: 1, fail: 24 }, liveness: { delay: 0, period: 10, timeout: 3, fail: 3 }, readiness: { delay: 0, period: 5, timeout: 1, fail: 3 },
      cfg: 'liveness = livenessState only · readiness.include=readinessState,db',
      end: 'No restart: the pod went unready during the outage and was back within one readiness period of the DB recovering. But note: <b>every</b> replica goes unready together, so the Service has 0 endpoints and clients see 503s, even for endpoints that don’t need the DB.' },
    throttle: { label: 'load spike, timeout 1 s', T: 260, boot: 60, load: [100, 160, 1.6],
      startup: { delay: 0, period: 5, timeout: 1, fail: 24 }, liveness: { delay: 0, period: 10, timeout: 1, fail: 3 }, readiness: { delay: 0, period: 5, timeout: 1, fail: 3 },
      cfg: 'liveness timeoutSeconds 1 · CPU limit throttles the JVM under load → health takes 1.6 s',
      end: 'A healthy but busy pod was killed at peak load and spent the rest of the spike booting. Its traffic moved to the other replicas, which then slow down too: a restart cascade. Fix: liveness timeout 3–5 s, higher threshold, no (or a larger) CPU limit.' }
  };
  let pre = 'naive'; let gen = 0; let running = false; let speed = 2600; let k = 0; let now = 0; let SIM; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segP = seg(Object.keys(PRE).map((x) => [x, PRE[x].label]), () => pre, (v) => { pre = v; reset(); }, 'Probe configuration');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Next event ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const cfgLine = el('div', { class: 'tiny cfg', style: { margin: '4px 0 8px' } });
  const stage = svg('svg', { viewBox: '0 0 760 270', role: 'img', 'aria-label': 'Timeline of container state, three probe lanes, service membership and environment' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('k8pr');
  root.append(el('div', { class: 'w-controls' }, segP), cfgLine, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  function simulate(P) {
    const ev = []; const dots = { startup: [], liveness: [], readiness: [] }; const cont = []; const rdy = []; const kills = [];
    let startAt = 0, restarts = 0, started = !P.startup, down = false, nextStart = 0, cnt = {}, ready = false, readyFrom = 0, rFail = 0;
    ev.push({ t: 0, type: 'boot', n: 0 });
    const check = (kind, t, age) => {
      if (age < P.boot) return { ok: false, why: 'connection refused (Tomcat not listening yet)' };
      if (P.hang && t >= P.hang && startAt < P.hang && kind !== 'startup') return { ok: false, why: 'timeout: the app is deadlocked' };
      const lat = P.load && t >= P.load[0] && t < P.load[1] ? P.load[2] : 0.05;
      if (lat > P[kind].timeout) return { ok: false, why: `timeout: answered in ${lat} s > timeoutSeconds ${P[kind].timeout}` };
      if (P.db && t >= P.db[0] && t < P.db[1] && P.dbIn.includes(kind)) return { ok: false, why: '503: db health indicator DOWN' };
      return { ok: true };
    };
    const kill = (t, kind) => { restarts++; cont.push([startAt, t]); kills.push(t);
      if (ready) { rdy.push([readyFrom, t]); ready = false; }
      const bo = Math.min(300, 10 * Math.pow(2, restarts - 1)); down = true; nextStart = t + bo;
      ev.push({ t, type: 'kill', kind, bo, n: restarts }); };
    for (let t = 0; t <= P.T; t++) {
      if (down) { if (t >= nextStart) { down = false; startAt = t; started = !P.startup; cnt = {}; rFail = 0; ev.push({ t, type: 'boot', n: restarts }); } else continue; }
      const age = t - startAt;
      const probe = (kind) => { const c = P[kind]; if (!c) return null; const base = kind === 'startup' ? 0 : (P.startup ? cnt.startedAge : 0) + (c.delay || 0);
        if (age < base || (age - base) % c.period) return null; const r = check(kind, t, age); dots[kind].push([t, r.ok]); return r; };
      if (P.startup && !started) {
        const r = probe('startup');
        if (r) { if (r.ok) { started = true; cnt.startedAge = age; ev.push({ t, type: 'started' }); } else { cnt.s = (cnt.s || 0) + 1; if (cnt.s === 1) ev.push({ t, type: 'fail', kind: 'startup', why: r.why }); if (cnt.s >= P.startup.fail) kill(t, 'startup'); } }
        if (!started) continue;
      }
      const l = probe('liveness');
      if (l) { if (l.ok) cnt.l = 0; else { cnt.l = (cnt.l || 0) + 1; if (cnt.l === 1) ev.push({ t, type: 'fail', kind: 'liveness', why: l.why }); if (cnt.l >= P.liveness.fail) { kill(t, 'liveness'); continue; } } }
      const r = probe('readiness');
      if (r) { if (r.ok) { rFail = 0; if (!ready) { ready = true; readyFrom = t; ev.push({ t, type: 'ready' }); } }
        else { rFail++; if (ready && rFail === 1) ev.push({ t, type: 'fail', kind: 'readiness', why: r.why }); if (ready && rFail >= P.readiness.fail) { ready = false; rdy.push([readyFrom, t]); ev.push({ t, type: 'unready' }); } } }
    }
    if (!down) cont.push([startAt, P.T]); if (ready) rdy.push([readyFrom, P.T]);
    if (P.db) { ev.push({ t: P.db[0], type: 'env', txt: 'The database goes down (a failover).' }); ev.push({ t: P.db[1], type: 'env', txt: 'The database is back.' }); }
    if (P.load) { ev.push({ t: P.load[0], type: 'env', txt: `Traffic spike. The JVM hits its CPU limit and is throttled; the health endpoint now takes ${P.load[2]} s.` }); ev.push({ t: P.load[1], type: 'env', txt: 'The spike is over.' }); }
    if (P.hang) ev.push({ t: P.hang, type: 'env', txt: 'A bug deadlocks the request threads. The process is alive but will never recover by itself.' });
    ev.sort((a, b) => a.t - b.t || (a.type === 'env' ? -1 : 0));
    return { ev, dots, cont, rdy, kills, restarts };
  }
  const NAME = { startup: 'startupProbe', liveness: 'livenessProbe', readiness: 'readinessProbe' };
  function text(e, P) {
    switch (e.type) {
      case 'boot': return e.n ? `Container restarted (restartCount ${e.n}). The JVM boots again from zero: ${P.boot} s of class loading and Spring context.` : `Container starts. Spring Boot needs about ${P.boot} s before Tomcat listens.` + (P.startup ? ' The startupProbe runs every 5 s; liveness and readiness are on hold.' : ' There is no startupProbe, so liveness begins after its 10 s initial delay.');
      case 'fail': return `<b>${NAME[e.kind]}</b> fails: ${e.why}.` + (e.kind === 'startup' ? ` Fine: it may fail up to ${P.startup.fail} times.` : e.kind === 'readiness' ? ` ${P.readiness.fail} in a row and the pod leaves the Service.` : ` ${P.liveness.fail} in a row and the kubelet restarts the container.`);
      case 'kill': return `<b>${NAME[e.kind]} failed ${P[e.kind].fail}× in a row → kubelet kills the container</b> (SIGTERM, then SIGKILL after the grace period). Next start after a ${e.bo} s back-off.`;
      case 'started': return '<b>startupProbe succeeded.</b> From now on liveness and readiness run on their own schedules.';
      case 'ready': return '<b>readinessProbe passes: Ready=True.</b> The pod IP joins the Service’s EndpointSlice and gets traffic.';
      case 'unready': return `<b>Ready=False.</b> The pod is removed from endpoints. It is <i>not</i> restarted by readiness.`;
      default: return e.txt;
    }
  }
  function buildSteps() {
    const P = PRE[pre]; const out = []; const merged = {};
    SIM.ev.forEach((e) => { if (merged[e.t]) merged[e.t].push(e); else { merged[e.t] = [e]; out.push(e.t); } });
    const L = out.map((t) => ({ t, txt: merged[t].map((e) => text(e, P)).join(' ') }));
    L.push({ t: P.T, txt: P.end }); return L;
  }
  const LANES = [['container', ''], ['startupProbe', ''], ['livenessProbe', ''], ['readinessProbe', ''], ['in Service', 'Ready'], ['environment', '']];
  function draw() {
    const P = PRE[pre]; const X0 = 130, XW = 615; const x = (t) => X0 + Math.min(t, P.T) / P.T * XW; const LY = (i) => 10 + i * 38; stage.innerHTML = '';
    LANES.forEach(([n, d], i) => { const y = LY(i); stage.append(svg('text', { class: 'ln', x: 6, y: y + 15, text: n }), svg('rect', { class: 'track', x: X0, y, width: XW, height: 24, rx: 5 })); if (n.endsWith('Probe') && !P[n.replace('Probe', '')]) stage.append(svg('text', { class: 'ln2', x: X0 + 8, y: y + 16, text: 'not configured' })); });
    SIM.cont.forEach(([a, b]) => { if (now <= a) return; const e = Math.min(b, now); const bootEnd = Math.min(a + P.boot, e);
      stage.append(svg('rect', { class: 'boot', x: x(a), y: LY(0) + 3, width: Math.max(1, x(bootEnd) - x(a)), height: 18, rx: 3 }));
      if (e > a + P.boot) stage.append(svg('rect', { class: 'up', x: x(a + P.boot), y: LY(0) + 3, width: x(e) - x(a + P.boot), height: 18, rx: 3 })); });
    SIM.kills.forEach((t) => { if (now < t) return; stage.append(svg('line', { class: 'vl', x1: x(t), x2: x(t), y1: LY(0) - 4, y2: LY(5) + 26 }), svg('text', { class: 'kill', x: x(t) - 4, y: LY(0) + 17, text: '✕' })); });
    ['startup', 'liveness', 'readiness'].forEach((kd, i) => SIM.dots[kd].forEach(([t, ok]) => { if (t <= now) stage.append(svg('circle', { class: ok ? 'ok' : 'bad', cx: x(t), cy: LY(i + 1) + 12, r: 3.6 })); }));
    SIM.rdy.forEach(([a, b]) => { if (now <= a) return; stage.append(svg('rect', { class: 'rdy', x: x(a), y: LY(4) + 3, width: x(Math.min(b, now)) - x(a), height: 18, rx: 3 })); });
    const env = P.db ? [P.db, 'env', 'DB down'] : P.load ? [P.load, 'envw', 'load spike'] : P.hang ? [[P.hang, SIM.kills.find((t) => t >= P.hang) || P.T], 'env', 'deadlocked'] : null;
    if (env && now > env[0][0]) { const [a, b] = env[0]; stage.append(svg('rect', { class: env[1], x: x(a), y: LY(5) + 3, width: x(Math.min(b, now)) - x(a), height: 18, rx: 3 }), svg('text', { class: 'ln2', x: x(a) + 4, y: LY(5) + 16, text: env[2] })); }
    for (let t = 0; t <= P.T; t += 40) stage.append(svg('text', { class: 'ax', x: x(t) - 8, y: LY(6) + 4, text: t + 's' }));
    stage.append(svg('line', { class: 'cur', x1: x(now), x2: x(now), y1: 4, y2: LY(6) - 8 }));
    const served = SIM.rdy.reduce((s, [a, b]) => s + Math.max(0, Math.min(b, now) - a), 0);
    stats.innerHTML = ''; const st = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    st(`t = <b>${Math.round(now)} s</b>`); st(`restarts <b>${SIM.kills.filter((t) => t <= now).length}</b>`); st(`time in Service <b>${Math.round(served)} s</b> of ${Math.round(now)}`);
  }
  async function animTo(t) {
    const g = gen; const from = now; if (reduced || t <= from) { now = t; draw(); return; }
    const dur = Math.min(speed * 0.8, 250 + (t - from) / PRE[pre].T * speed * 3); const t0 = performance.now();
    await new Promise((res) => { const f = (ts) => { if (g !== gen) return res(); const u = Math.min(1, (ts - t0) / dur); now = from + (t - from) * u; draw(); if (u < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  }
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; now = 0; SIM = simulate(PRE[pre]); steps = buildSteps(); cfgLine.textContent = PRE[pre].cfg; draw(); bStep.disabled = false; say('Press Play, or Next event to jump from one probe decision to the next.'); }
  async function step() { if (k >= steps.length) return false; const s = steps[k++]; const g = gen; say(`<b>t=${s.t}s</b> · ` + s.txt); await animTo(s.t); if (g !== gen) return false; if (k >= steps.length) bStep.disabled = true; return true; }
  let busy = false;
  bStep.addEventListener('click', async () => { running = false; bPlay.textContent = '▶ Play'; if (busy) return; busy = true; await step(); busy = false; });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    if (reduced) { while (await step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && await step()) await sleep(speed * 0.7);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
