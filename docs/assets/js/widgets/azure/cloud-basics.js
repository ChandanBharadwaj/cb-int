/* cloud-basics: step-through visual for the Azure Basics module. */
IA.widget('cloud-basics', (root, ctx) => {
  /* ---- Azure basics step-through kit (same in each azure basics widget) ---- */
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-azb-style')) {
    document.head.append(el('style', { id: 'w-azb-style', text: `
.w-azb .nb rect { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .4s, stroke .4s; }
.w-azb .nb { transition: opacity .45s; }
.w-azb .nb text { fill: var(--text); font-size: 13px; font-family: var(--sans); }
.w-azb .nb text.s { fill: var(--text-3); font-size: 10.5px; font-family: var(--mono); }
.w-azb .nb.hot rect { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-azb .nb.ok rect { stroke: var(--ok); stroke-width: 2.5; fill: color-mix(in srgb, var(--ok) 15%, var(--surface)); }
.w-azb .nb.warn rect { stroke: var(--warn); stroke-width: 2.5; fill: color-mix(in srgb, var(--warn) 16%, var(--surface)); }
.w-azb .nb.bad rect { stroke: var(--err); stroke-width: 2.5; fill: color-mix(in srgb, var(--err) 15%, var(--surface)); }
.w-azb .nb.dim { opacity: .3; }
.w-azb .nb.gone { opacity: .08; }
.w-azb .zn { fill: color-mix(in srgb, var(--surface-2) 70%, transparent); stroke: var(--border); stroke-dasharray: 6 5; transition: stroke .4s, opacity .4s; }
.w-azb .zn.hot { stroke: var(--accent); }
.w-azb .zn.bad { stroke: var(--err); }
.w-azb .zn.dim { opacity: .3; }
.w-azb .zt { fill: var(--text-3); font-size: 11px; font-family: var(--mono); }
.w-azb .eg { stroke: var(--border); stroke-width: 1.6; fill: none; transition: stroke .4s, opacity .4s; }
.w-azb .eg.hot { stroke: var(--accent); stroke-width: 2.6; }
.w-azb .eg.ok { stroke: var(--ok); stroke-width: 2.6; }
.w-azb .eg.bad { stroke: var(--err); stroke-width: 2.6; stroke-dasharray: 6 4; }
.w-azb .eg.dim { opacity: .2; }
.w-azb .pkt { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.w-azb.rm * { transition: none !important; animation: none !important; }
` }));
  }
  root.classList.add('w-azb'); if (reduced) root.classList.add('rm');
  /* spec: { label, W, H, modes: [{ id, name, zones:[[id,x,y,w,h,label]], nodes:[[id,x,y,w,h,title,sub]], edges:[[id,a,b,'v'|'h']], steps:[{ c:{id:cls}, sub:{id:text}, fly:[ids], t:'html', cls }] }] } */
  function scene(spec) {
    let mode = spec.modes[0]; let k = 0; let running = false; let gen = 0; const Z = {};
    const stage = svg('svg', { viewBox: `0 0 ${spec.W} ${spec.H}`, role: 'img', 'aria-label': spec.label });
    const pkt = svg('circle', { r: 7, class: 'pkt', opacity: 0 });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
    const say = (n, h, cls) => { narr.className = 'caption' + (cls ? ' ' + cls : ''); narr.innerHTML = '';
      narr.append(el('div', { class: 'n', text: String(n) }), el('div', { class: 't', html: h })); };
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const prog = el('span', { class: 'tiny' });
    const top = el('div', { class: 'w-controls' });
    if (spec.modes.length > 1) {
      const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': spec.modeLabel || 'Scenario' });
      spec.modes.forEach((m) => { const b = el('button', { text: m.name, class: m === mode ? 'on' : '' });
        b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); mode = m; reset(); }); s.append(b); });
      top.append(s);
    }
    root.append(top, el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, prog), narr);
    const mid = (id) => { const z = Z[id]; return [z.x + z.w / 2, z.y + z.h / 2]; };
    function draw() {
      stage.innerHTML = ''; for (const id in Z) delete Z[id];
      const gz = svg('g'); const ge = svg('g'); const gn = svg('g'); stage.append(gz, ge, gn, pkt);
      (mode.zones || []).forEach(([id, x, y, w, h, t]) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 12 });
        gz.append(r, svg('text', { class: 'zt', x: x + 10, y: y + 16, text: t })); Z[id] = { n: r, base: 'zn', x, y, w, h }; });
      (mode.nodes || []).forEach(([id, x, y, w, h, t, s]) => {
        const n = svg('g', { class: 'nb' }); n.append(svg('rect', { x, y, width: w, height: h, rx: 8 }));
        n.append(svg('text', { x: x + w / 2, y: s != null ? y + h / 2 - 3 : y + h / 2 + 4, 'text-anchor': 'middle', text: t }));
        let se = null; if (s != null) { se = svg('text', { class: 's', x: x + w / 2, y: y + h / 2 + 12, 'text-anchor': 'middle', text: s }); n.append(se); }
        gn.append(n); Z[id] = { n, base: 'nb', sub: se, sub0: s || '', x, y, w, h }; });
      (mode.edges || []).forEach(([id, a, b, dir]) => { const A = Z[a]; const B = Z[b]; let d;
        if (dir === 'h') { const y1 = A.y + A.h / 2; const y2 = B.y + B.h / 2; const [x1, x2] = A.x < B.x ? [A.x + A.w, B.x] : [A.x, B.x + B.w]; const mx = (x1 + x2) / 2; d = `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`; }
        else { const x1 = A.x + A.w / 2; const x2 = B.x + B.w / 2; const [y1, y2] = A.y < B.y ? [A.y + A.h, B.y] : [A.y, B.y + B.h]; const my = (y1 + y2) / 2; d = `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`; }
        const p = svg('path', { class: 'eg', d }); ge.append(p); Z[id] = { n: p, base: 'eg' }; });
    }
    function paint(i) {
      const c = {}; const sub = {};
      for (let j = 0; j <= i; j++) { const s = mode.steps[j]; if (s.reset) { for (const x in c) delete c[x]; } Object.assign(c, s.c || {}); Object.assign(sub, s.sub || {}); }
      for (const id in Z) { const z = Z[id]; z.n.setAttribute('class', z.base + (i >= 0 && c[id] ? ' ' + c[id] : ''));
        if (z.sub) z.sub.textContent = i >= 0 && sub[id] != null ? sub[id] : z.sub0; }
    }
    function fly(ids, ms) {
      const g = gen; const pts = ids.map((p) => mid(p));
      return new Promise((res) => {
        if (reduced || pts.length < 2) return res();
        const L = []; let tot = 0;
        for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
        const t0 = performance.now(); pkt.setAttribute('opacity', 1);
        const tick = (t) => { if (g !== gen) { pkt.setAttribute('opacity', 0); return res(); }
          let f = Math.min(1, (t - t0) / ms) * tot; let i = 0; while (i < L.length - 1 && f > L[i]) { f -= L[i]; i++; }
          const r = L[i] ? Math.min(1, f / L[i]) : 1; const [x1, y1] = pts[i]; const [x2, y2] = pts[i + 1];
          pkt.setAttribute('cx', x1 + (x2 - x1) * r); pkt.setAttribute('cy', y1 + (y2 - y1) * r);
          if (t - t0 < ms) requestAnimationFrame(tick); else { pkt.setAttribute('opacity', 0); res(); } };
        requestAnimationFrame(tick);
      });
    }
    async function apply(i) {
      const s = mode.steps[i]; paint(i); say(i + 1, s.t, s.cls); prog.textContent = `step ${i + 1} / ${mode.steps.length}`;
      if (s.fly) await fly(s.fly, 900);
    }
    function reset() { gen++; running = false; k = 0; bPlay.textContent = '▶ Play'; bStep.disabled = false; draw();
      if (reduced) { paint(mode.steps.length - 1); say('✓', mode.steps[mode.steps.length - 1].t); prog.textContent = 'end state (reduced motion)'; k = mode.steps.length; bStep.disabled = true; return; }
      paint(-1); say('·', mode.intro || 'Press Play, or Step through one stage at a time.'); prog.textContent = `0 / ${mode.steps.length}`; }
    async function step() { if (k >= mode.steps.length) return false; await apply(k++); if (k >= mode.steps.length) bStep.disabled = true; return true; }
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= mode.steps.length) { reset(); if (reduced) return; }
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && await step()) await sleep(2200);
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    reset();
  }
  /* ---- end kit ---- */
  const L = (id, y, t, s) => [id, 150, y, 300, 40, t, s];
  const layers = [L('data', 40, 'Your data & users', 'accounts, access, data'), L('app', 88, 'Your Spring Boot app', 'app.jar'), L('rt', 136, 'Runtime', 'JVM, Tomcat'), L('os', 184, 'Operating system', 'Linux patches'), L('vm', 232, 'Virtual machine', 'hypervisor'), L('hw', 280, 'Servers, network, building', 'datacenter')];
  const who = (yours) => { const c = {}; ['data', 'app', 'rt', 'os', 'vm', 'hw'].forEach((id, i) => { c[id] = i < yours ? 'warn' : 'ok'; }); return c; };
  scene({ label: 'Stack of layers from data down to datacenter, coloured by who manages each', W: 760, H: 340, modeLabel: 'View',
    modes: [
      { id: 'resp', name: 'Who manages what', intro: 'Amber = you manage it. Green = the cloud provider manages it. Step from on-prem to SaaS.',
        zones: [['z', 130, 12, 340, 320, 'one Java web app, top to bottom']],
        nodes: [...layers, ['you', 520, 70, 200, 46, 'You', 'amber layers'], ['ms', 520, 230, 200, 46, 'Microsoft', 'green layers']],
        steps: [
          { c: who(6), sub: { you: 'everything', ms: 'nothing' }, t: '<b>On-premises</b>: you buy servers, rack them, patch the OS, install the JVM and deploy the jar. Every layer is yours.' },
          { c: who(4), sub: { you: 'OS and up', ms: 'VM, hardware, DC' }, t: '<b>IaaS</b> (an Azure VM): Microsoft runs the building, hardware and hypervisor. You still patch Linux, install Java and run the app.' },
          { c: who(2), sub: { you: 'app + data', ms: 'runtime and below' }, t: '<b>PaaS</b> (App Service, Container Apps, Postgres Flexible Server): you hand over a jar or image. The platform patches the OS and runtime.' },
          { c: who(1), sub: { you: 'data + access', ms: 'the whole app' }, t: '<b>SaaS</b> (e.g. Microsoft 365, GitHub): you only configure it and own your data and who can sign in.' },
          { c: { data: 'bad' }, t: 'Shared responsibility: in <b>every</b> model your data, accounts and access settings stay yours. A public storage container is your mistake, not Microsoft’s.' }
        ] },
      { id: 'meter', name: 'Pay as you go', intro: 'Follow a VM through its life and watch which meters run.',
        zones: [['rg', 40, 20, 680, 300, 'resource group rg-demo · region westeurope']],
        nodes: [['vm', 80, 70, 180, 50, 'VM compute', 'meter: per second/hour'], ['disk', 80, 170, 180, 50, 'OS disk', 'meter: per GB-month'], ['ip', 80, 250, 180, 50, 'Public IP', 'meter: per hour'], ['bill', 480, 150, 200, 60, 'Your bill', '']],
        edges: [['e1', 'vm', 'bill', 'h'], ['e2', 'disk', 'bill', 'h'], ['e3', 'ip', 'bill', 'h']],
        steps: [
          { c: { vm: 'hot', disk: 'hot', ip: 'hot', e1: 'hot', e2: 'hot', e3: 'hot', bill: 'warn' }, sub: { bill: 'all meters running' }, fly: ['vm', 'bill'], t: 'Create a VM. Nothing is bought up front: each resource has its own <b>meter</b> and you pay for what runs.' },
          { c: { vm: 'warn', e1: 'hot' }, sub: { vm: 'stopped (allocated)', bill: 'compute still billed' }, t: '<code>az vm stop</code> powers off the OS but keeps the hardware reserved, so compute <b>keeps billing</b>.' },
          { c: { vm: 'dim', e1: 'dim' }, sub: { vm: 'deallocated', bill: 'disk + IP still billed' }, t: '<code>az vm deallocate</code> (or Stop in the portal) releases the hardware: the compute meter stops. Disk and IP keep billing.' },
          { c: { vm: 'gone', disk: 'gone', ip: 'gone', e1: 'gone', e2: 'gone', e3: 'gone', bill: 'ok', rg: 'dim' }, sub: { bill: 'nothing running' }, t: 'Delete the <b>resource group</b>: everything inside goes and every meter stops. Cleanup is one command.' }
        ] }
    ] });
});
