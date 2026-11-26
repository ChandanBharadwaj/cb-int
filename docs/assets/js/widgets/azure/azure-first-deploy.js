/* azure-first-deploy: step-through visual for the Azure Basics module. */
IA.widget('azure-first-deploy', (root, ctx) => {
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
  scene({ label: 'Deploying a Spring Boot jar to App Service: build, deploy, app settings, logs and cleanup', W: 760, H: 360,
    modes: [{ id: 'dep', name: 'jar → App Service',
      zones: [['rg', 260, 20, 480, 320, 'resource group rg-hello-dev']],
      nodes: [['dev', 20, 40, 190, 46, 'mvn package', 'target/app.jar'], ['cli', 20, 150, 190, 46, 'az webapp deploy', '--type jar'], ['you', 20, 270, 190, 46, 'Your terminal', 'az webapp log tail'],
        ['plan', 290, 60, 200, 46, 'App Service plan', 'Linux · size B1'], ['web', 290, 160, 200, 46, 'Web app', 'Java SE 21 stack'], ['set', 530, 60, 190, 46, 'App settings', 'env vars'],
        ['url', 530, 160, 190, 46, 'https://…', '.azurewebsites.net'], ['log', 290, 260, 200, 46, 'Log stream', 'stdout of the JVM']],
      edges: [['e1', 'dev', 'cli', 'v'], ['e2', 'cli', 'web', 'h'], ['e3', 'plan', 'web', 'v'], ['e4', 'set', 'web', 'h'], ['e5', 'web', 'url', 'h'], ['e6', 'web', 'log', 'v'], ['e7', 'log', 'you', 'h']],
      steps: [
        { c: { dev: 'hot' }, t: 'Build a normal executable Spring Boot jar: <code>./mvnw package</code>. Nothing Azure-specific yet.' },
        { c: { rg: 'hot', plan: 'ok' }, t: 'Create a resource group and an <b>App Service plan</b>: the VMs you pay for. One plan can host several apps.' },
        { c: { web: 'ok', e3: 'ok' }, t: 'Create the <b>web app</b> on that plan with the Java SE runtime. It gets a default <code>*.azurewebsites.net</code> hostname.' },
        { c: { e1: 'hot', cli: 'hot', e2: 'hot' }, fly: ['dev', 'cli', 'web'], t: '<code>az webapp deploy --type jar</code> uploads the jar. App Service runs it with <code>java -jar</code>.' },
        { c: { set: 'hot', e4: 'hot' }, fly: ['set', 'web'], t: '<b>App settings</b> become environment variables: <code>SPRING_PROFILES_ACTIVE=azure</code> overrides <code>application.yml</code> by Spring’s relaxed binding. Changing them restarts the app.' },
        { c: { e5: 'ok', url: 'ok' }, fly: ['web', 'url'], t: 'Open the URL. HTTPS on the default domain is provided for you.' },
        { c: { e6: 'hot', log: 'hot', e7: 'hot', you: 'hot' }, fly: ['web', 'log', 'you'], t: 'Enable logging, then <code>az webapp log tail</code> streams the JVM’s stdout. First stop when it won’t start.' },
        { c: { rg: 'bad', plan: 'bad', web: 'bad', set: 'bad', url: 'bad', log: 'bad', e3: 'bad' }, t: 'Done experimenting? <code>az group delete -n rg-hello-dev</code>. The plan bills while it exists, even with no traffic.', cls: 'warn' }
      ] }] });
});
