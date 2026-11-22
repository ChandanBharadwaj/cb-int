/* Namespaces, quotas & cost: Pod creations in a namespace pass LimitRange defaulting and validation, then ResourceQuota admission, which counts requests and limits, not usage. */
IA.widget('multi-tenancy-cost', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8mt-style')) {
    document.head.append(el('style', { id: 'w-k8mt-style', text: `
.k8mt svg text { font-family: var(--sans); }
.k8mt .st { fill: var(--surface); stroke: var(--border); stroke-width: 1.4; transition: all .3s; }
.k8mt .st.ok { stroke: var(--ok); stroke-width: 2.6; fill: color-mix(in srgb, var(--ok) 12%, var(--surface)); }
.k8mt .st.mut { stroke: var(--accent); stroke-width: 2.6; fill: var(--accent-soft); }
.k8mt .st.bad { stroke: var(--err); stroke-width: 2.8; fill: color-mix(in srgb, var(--err) 13%, var(--surface)); }
.k8mt .st.off { stroke-dasharray: 5 4; opacity: .45; }
.k8mt .sl { font-size: 11.5px; font-weight: 700; fill: var(--text); }
.k8mt .ss { font-size: 9.8px; fill: var(--text-2); font-family: var(--mono); }
.k8mt .gl { font-size: 11.5px; fill: var(--text); font-family: var(--mono); }
.k8mt .gv { font-size: 11.5px; fill: var(--text); font-family: var(--mono); font-weight: 700; }
.k8mt .gt { fill: var(--surface-2); stroke: var(--border); }
.k8mt .gu { fill: var(--accent); opacity: .8; transition: width .5s ease; }
.k8mt .gn { fill: var(--ok); opacity: .6; }
.k8mt .gn.over { fill: var(--err); opacity: .65; }
.k8mt .gx { stroke: var(--err); stroke-width: 2; }
.k8mt .cap { font-size: 10.5px; fill: var(--text-3); font-family: var(--mono); }
.k8mt .w-log .ok { color: var(--ok); } .k8mt .w-log .bad { color: var(--err); } .k8mt .w-log .mu { color: var(--text-3); } .k8mt .w-log .mt { color: var(--accent); }
` }));
  }
  const HARD = { cpu: 8, mem: 16, lmem: 24, pods: 10 };
  const LR = { defReqCpu: 0.25, defReqMem: 0.5, defLimMem: 1, maxMem: 4 };
  const REQS = [
    { n: 'api-1', cpu: 2, mem: 4, lmem: 4, what: 'requests 2 CPU / 4Gi, limit 4Gi' },
    { n: 'debug', what: 'no resources set' },
    { n: 'etl', cpu: 1, mem: 6, lmem: 8, what: 'requests 1 CPU / 6Gi, limit 8Gi' },
    ...[1, 2, 3, 4, 5, 6].map((i) => ({ n: 'worker-' + i, cpu: 1, mem: 2, lmem: 2, what: 'requests 1 CPU / 2Gi, limit 2Gi', rs: true }))
  ];
  let lrOn = true; let k = 0; let gen = 0; let running = false; let speed = 2400; let snaps = [];
  const fmtG = (v) => (v < 1 ? Math.round(v * 1024) + 'Mi' : (Math.round(v * 100) / 100) + 'Gi');
  const fmtC = (v) => (v % 1 ? Math.round(v * 1000) + 'm' : String(v));
  function simulate() {
    const used = { cpu: 0, mem: 0, lmem: 0, pods: 0 }; const S = []; const lines = [];
    const snap = (o) => S.push(Object.assign({ used: Object.assign({}, used), lines: lines.slice() }, o));
    snap({ st: [], say: `Namespace <code>team-a</code> has a <b>ResourceQuota</b> (requests.cpu 8, requests.memory 16Gi, limits.memory 24Gi, pods 10)${lrOn ? ' and a <b>LimitRange</b> (default request 250m / 512Mi, default memory limit 1Gi, max 4Gi per container)' : ', and <b>no LimitRange</b>'}. Press Play to send Pod creations through admission.` });
    REQS.forEach((r0) => {
      const r = Object.assign({}, r0); const st = ['ok']; let say = ''; let tone = ''; const mut = [];
      lines.push(['mu', `${r.rs ? 'replicaset/worker-7d9: ' : ''}POST pods ${r.n} (${r.what})`]);
      // 1. LimitRanger mutating: fill defaults
      if (lrOn) {
        if (r.cpu == null) { r.cpu = LR.defReqCpu; mut.push('requests.cpu=250m'); }
        if (r.mem == null) { r.mem = LR.defReqMem; mut.push('requests.memory=512Mi'); }
        if (r.lmem == null) { r.lmem = LR.defLimMem; mut.push('limits.memory=1Gi'); }
        st.push(mut.length ? 'mut' : 'ok');
        if (mut.length) lines.push(['mt', `  LimitRanger set ${mut.join(', ')}`]);
      } else st.push('off');
      // 2. LimitRange validate
      if (lrOn && r.lmem > LR.maxMem) {
        st.push('bad');
        lines.push(['bad', `  Error: pods "${r.n}" is forbidden: maximum memory usage per Container is 4Gi, but limit is 8Gi`]);
        snap({ st, req: r, say: `<b>${r.n}</b>: rejected by the <b>LimitRange</b> before quota is even checked: its 8Gi limit exceeds the 4Gi per-container maximum. LimitRange guards the size of each container; quota guards the namespace total.`, tone: 'err' });
        return;
      }
      st.push(lrOn ? 'ok' : 'off');
      // 3. quota
      if (r.cpu == null || r.mem == null || r.lmem == null) {
        st.push('bad');
        lines.push(['bad', `  Error: pods "${r.n}" is forbidden: failed quota: team-a-quota: must specify limits.memory for: app; requests.cpu for: app; requests.memory for: app`]);
        snap({ st, req: r, say: `<b>${r.n}</b>: rejected by <b>ResourceQuota</b>. When a quota tracks requests.cpu, requests.memory or limits.memory, every new Pod must declare them, and without a LimitRange nothing fills them in. This is why quotas and LimitRanges come in pairs.`, tone: 'err' });
        return;
      }
      const after = { cpu: used.cpu + r.cpu, mem: used.mem + r.mem, lmem: used.lmem + r.lmem, pods: used.pods + 1 };
      const over = Object.keys(after).filter((x) => after[x] > HARD[x] + 1e-9);
      if (over.length) {
        st.push('bad');
        const x = over[0]; const nm = { cpu: 'requests.cpu', mem: 'requests.memory', lmem: 'limits.memory', pods: 'pods' }[x]; const f = x === 'cpu' ? fmtC : x === 'pods' ? String : fmtG;
        lines.push(['bad', `  Error: pods "${r.n}" is forbidden: exceeded quota: team-a-quota, requested: ${nm}=${f(r[x === 'pods' ? 'pods' : x] || 1)}, used: ${nm}=${f(used[x])}, limited: ${nm}=${f(HARD[x])}`]);
        snap({ st, req: r, over, say: `<b>${r.n}</b>: <b>exceeded quota</b> on ${nm}: ${f(used[x])} used + ${f(x === 'pods' ? 1 : r[x])} requested > ${f(HARD[x])}. ${r.rs ? 'The ReplicaSet records <code>FailedCreate</code> and keeps retrying; the Deployment shows fewer ready replicas than desired. ' : ''}Quota counts what Pods <i>reserve</i>, not what they use: these workers may idle at 50m CPU.`, tone: 'err' });
        return;
      }
      Object.assign(used, after); st.push('ok'); st.push('ok');
      lines.push(['ok', `  pod/${r.n} created`]);
      snap({ st, req: r, say: `<b>${r.n}</b>${mut.length ? `: LimitRanger filled in <code>${mut.join(', ')}</code> (it mutates, and runs before quota)` : ''}. Quota check: every tracked total stays within its hard limit, so the Pod is admitted and the quota’s <code>status.used</code> goes up immediately, before the Pod is even scheduled.`, tone: 'ok' });
    });
    snap({ st: [], done: true, say: `Final: requests.cpu ${fmtC(used.cpu)}/8, requests.memory ${fmtG(used.mem)}/16Gi, pods ${used.pods}/10. ${lrOn ? 'With the LimitRange, the Pod without resources got small defaults and the oversized one was stopped early.' : 'Without a LimitRange, the Pod without resources was rejected and the 6Gi ETL Pod consumed memory quota the workers needed.'} Toggle the LimitRange and run it again. Right-sizing requests is what actually frees quota and node capacity.`, tone: 'ok' });
    return S;
  }
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 760; const H = 268;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Admission pipeline and quota gauges for namespace team-a' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-log', 'aria-label': 'API server responses' });
  root.classList.add('k8mt');
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'namespace team-a' }), seg([[true, 'with LimitRange'], [false, 'no LimitRange']], lrOn, (v) => { lrOn = v; reset(); }, 'LimitRange')),
    el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[3400, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed')), narr, log);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const STG = [['Pod create', 'request'], ['LimitRanger', 'mutating: defaults'], ['LimitRange', 'validating: min/max'], ['ResourceQuota', 'validating: totals'], ['etcd', 'stored']];
  function draw(s) {
    stage.innerHTML = '';
    STG.forEach(([t, sub], i) => {
      const x = 8 + i * 150; const cls = s.st[i] || '';
      stage.append(svg('rect', { class: 'st ' + cls, x, y: 8, width: 138, height: 50, rx: 9 }), svg('text', { class: 'sl', x: x + 69, y: 28, 'text-anchor': 'middle', text: i === 0 && s.req ? s.req.n : t }),
        svg('text', { class: 'ss', x: x + 69, y: 45, 'text-anchor': 'middle', text: cls === 'bad' ? '✗ 403 Forbidden' : cls === 'off' ? 'not configured' : i === 0 && s.req ? (s.req.cpu != null ? `${fmtC(s.req.cpu)} CPU · ${fmtG(s.req.mem)}` : 'no resources') : sub }));
      if (i < 4) stage.append(svg('path', { d: `M${x + 140} 33 l7 0 m-3 -3 l3 3 l-3 3`, stroke: 'var(--text-3)', fill: 'none', 'stroke-width': 1.4 }));
    });
    stage.append(svg('text', { class: 'cap', x: 8, y: 84, text: 'RESOURCEQUOTA team-a-quota   status.used / spec.hard   (counts requests and limits, not usage)' }));
    const G = [['requests.cpu', 'cpu', fmtC, ''], ['requests.memory', 'mem', fmtG, ''], ['limits.memory', 'lmem', fmtG, ''], ['pods', 'pods', String, '']];
    const GX = 170; const GW = 460;
    G.forEach(([label, key, f], i) => {
      const y = 98 + i * 40; const hard = HARD[key]; const u = s.used[key];
      const add = s.req && s.req.cpu != null ? (key === 'pods' ? 1 : s.req[key]) : 0;
      const showAdd = s.req && (s.st[3] === 'bad' || s.st[3] === 'ok') && s.st[4] !== 'ok' && add;
      stage.append(svg('text', { class: 'gl', x: 8, y: y + 17, text: label }), svg('rect', { class: 'gt', x: GX, y, width: GW, height: 24, rx: 5 }),
        svg('rect', { class: 'gu', x: GX, y, width: (Math.min(u, hard) / hard) * GW, height: 24, rx: 5 }));
      if (showAdd) {
        const over = u + add > hard + 1e-9; const w = (Math.min(add, hard * 1.15 - u) / hard) * GW;
        stage.append(svg('rect', { class: 'gn' + (over ? ' over' : ''), x: GX + (u / hard) * GW, y: y + 3, width: Math.max(2, w), height: 18, rx: 3 }));
      }
      stage.append(svg('line', { class: 'gx', x1: GX + GW, y1: y - 3, x2: GX + GW, y2: y + 27 }),
        svg('text', { class: 'gv', x: GX + GW + 12, y: y + 17, text: `${f(u)} / ${f(hard)}` }));
    });
  }
  function renderLog(lines) { log.innerHTML = ''; lines.forEach(([c, t]) => log.append(el('div', { class: c, text: t }))); log.scrollTop = log.scrollHeight; }
  function show(s) { draw(s); say(s.say, s.tone); renderLog(s.lines); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; snaps = simulate(); k = 0; bStep.disabled = false; show(snaps[k++]); }
  function step() { if (k >= snaps.length) return false; show(snaps[k++]); if (k >= snaps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= snaps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && step()); } else while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
