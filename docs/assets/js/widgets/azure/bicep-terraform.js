/* Bicep & Terraform: compile Bicep to ARM, what-if change types and Complete mode; drift caught by Bicep what-if vs terraform plan. */
IA.widget('bicep-terraform', (root, ctx) => {
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
  if (!document.getElementById('w-az-iac-style')) {
    document.head.append(el('style', { id: 'w-az-iac-style', text: `
.w-az .dl { opacity: 0; fill: var(--text-2); font-family: var(--mono); font-size: 11.5px; transition: opacity .4s, fill .4s; }
.w-az .dl.ok { opacity: 1; fill: var(--ok); }
.w-az .dl.warn { opacity: 1; fill: var(--warn); }
.w-az .dl.bad { opacity: 1; fill: var(--err); }
.w-az .dl.hot { opacity: 1; fill: var(--accent); }
.w-az .dl.mut { opacity: 1; fill: var(--text-3); }
` }));
  }
  let mode = 'whatif';
  const stage = svg('svg', { viewBox: '0 0 640 340', role: 'img', 'aria-label': 'Bicep compiling to ARM JSON, what-if comparing with live resources, or drift detected by Bicep and Terraform' });
  const segM = seg([['whatif', 'Bicep → ARM → what-if'], ['drift', 'Drift: Bicep vs Terraform']], mode, (v) => { mode = v; reset(); }, 'Mechanism');
  const stats = el('div', { class: 'w-stats' });
  const stat = (h) => { stats.innerHTML = ''; h.forEach((x) => stats.append(el('span', { class: 'w-stat', html: x }))); };
  const zrect = (g, id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 10 }); g.append(r, svg('text', { class: 'lbl', x: x + 8, y: y + 17, text: label })); Z[id] = { n: r, base: 'zn' }; };
  const line = (g, id, x, y, t) => { const n = svg('text', { class: 'dl', x, y, text: t }); g.append(n); Z[id] = { n, base: 'dl', sub: n, sub0: t }; };
  function build() {
    stage.innerHTML = ''; clearZ();
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    if (mode === 'whatif') {
      node(g, 'src', 10, 20, 140, 66, 'main.bicep', 'modules + existing');
      node(g, 'cli', 172, 20, 130, 66, 'bicep build', 'compile time only');
      node(g, 'arm', 324, 20, 140, 66, 'ARM JSON', 'main.json');
      node(g, 'rm', 486, 20, 146, 66, 'Resource Manager', 'deployment engine');
      hlink(e, 'e1', 'src', 'cli'); hlink(e, 'e2', 'cli', 'arm'); hlink(e, 'e3', 'arm', 'rm');
      zrect(bg, 'diff', 10, 112, 456, 218, 'what-if: template vs live');
      line(g, 'l1', 22, 152, '+ Create   userAssignedIdentities  id-orders');
      line(g, 'l2', 22, 182, '~ Modify   sites  app-orders');
      line(g, 'l2b', 40, 202, 'siteConfig.minTlsVersion: "1.0" => "1.2"');
      line(g, 'l3', 22, 232, '= NoChange vaults  kv-orders (existing)');
      line(g, 'l4', 22, 262, '* Ignore   storageAccounts  st-legacy');
      line(g, 'l5', 22, 300, 'Resource changes: 1 to create, 1 to modify, 1 to ignore.');
      zrect(bg, 'live', 486, 112, 146, 218, 'rg-orders-prod (live)');
      node(g, 'Lid', 496, 138, 126, 40, 'id-orders', 'not yet');
      node(g, 'Lapp', 496, 186, 126, 40, 'app-orders', 'minTls 1.0');
      node(g, 'Lkv', 496, 234, 126, 40, 'kv-orders', 'unchanged');
      node(g, 'Lst', 496, 282, 126, 40, 'st-legacy', 'not in template');
      edge(e, 'cmp', 'M559 86 L 559 112');
    } else {
      node(g, 'bsrc', 10, 20, 190, 60, 'main.bicep', 'minTls 1.2 · no state');
      node(g, 'bwi', 10, 135, 190, 60, 'what-if', 'template vs live');
      node(g, 'bdep', 10, 255, 190, 60, 'deploy', '');
      node(g, 'live', 236, 20, 168, 60, 'app-orders (live)', 'minTls 1.2');
      node(g, 'portal', 236, 135, 168, 60, 'portal hotfix', '02:00, by hand');
      node(g, 'pol', 236, 255, 168, 60, 'Azure Policy (modify)', 'adds tag CostCenter');
      node(g, 'tsrc', 440, 20, 190, 60, 'main.tf + state', 'state: minTls 1.2');
      node(g, 'tplan', 440, 135, 190, 60, 'terraform plan', 'refresh → diff');
      node(g, 'tapp', 440, 255, 190, 60, 'apply', '');
      link(e, 'b1', 'bsrc', 'bwi'); link(e, 'b2', 'bwi', 'bdep'); link(e, 't1', 'tsrc', 'tplan'); link(e, 't2', 'tplan', 'tapp');
      link(e, 'p1', 'portal', 'live');
      edge(e, 'p2', 'M320 255 C 300 220, 300 130, 320 80');
      hlink(e, 'r1', 'live', 'bwi'); hlink(e, 'r2', 'live', 'tplan');
    }
    stage.append(bg, e, g, pkt);
    stat([]);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'whatif') {
      S.push({ ...A.set({ src: 'hot' }), t: '<code>main.bicep</code> declares an identity, updates the app’s TLS setting, references an <code>existing</code> Key Vault, and calls a module. Parameters come from <code>main.prod.bicepparam</code>.' });
      S.push({ fly: ['src', 'cli', 'arm'], ...A.set({ e1: 'hot', e2: 'hot', cli: 'ok', arm: 'hot' }, { arm: 'nested deployments' }), t: '<code>bicep build</code> transpiles to <b>ARM JSON</b>. Types, loops and modules are resolved here; modules become nested deployments. Resource Manager never sees Bicep, so there is no Bicep runtime and no state file.' });
      S.push({ fly: ['arm', 'rm', [559, 112]], ...A.set({ e3: 'hot', rm: 'hot', cmp: 'hot', live: 'hot' }), run: () => stat(['GET each resource', 'compare properties']), t: '<b>what-if</b>: Resource Manager expands the template, asks each resource provider for the current resource, and compares desired with actual. Nothing changes yet.' });
      S.push({ ...A.set({ diff: 'hot', l1: 'ok', Lid: 'hot' }, { Lid: 'would be created' }), t: '<code>+ Create</code>: the identity doesn’t exist yet.', cls: 'ok' });
      S.push({ ...A.set({ l2: 'warn', l2b: 'warn', Lapp: 'warn' }), t: '<code>~ Modify</code> lists the property diffs. Read them: a modify on a database SKU or a network rule matters far more than a tag. Some modifies are noise (casing, defaults the provider fills in).', cls: 'warn' });
      S.push({ ...A.set({ l3: 'mut', l4: 'mut', l5: 'mut', Lkv: 'ok', Lst: 'dim' }), run: () => stat(['create <b>1</b>', 'modify <b>1</b>', 'ignore <b>1</b>']), t: '<code>= NoChange</code> for the referenced vault. <code>* Ignore</code> for <code>st-legacy</code>: it is in the resource group but not in the template, and <b>Incremental</b> mode (the default) leaves it alone.' });
      S.push({ ...A.set({ Lid: 'ok', Lapp: 'ok', diff: '', l1: 'mut', l2: 'mut', l2b: 'mut' }, { Lid: 'created', Lapp: 'minTls 1.2' }), run: () => stat(['deployment <b>Succeeded</b>', 'mode <b>Incremental</b>']), t: 'Deploy: Resource Manager creates and updates in dependency order, in parallel where it can. <code>st-legacy</code> survives.', cls: 'ok' });
      S.push({ ...A.set({ l4: 'bad', Lst: 'bad', diff: 'bad' }, { l4: '- Delete   storageAccounts  st-legacy', Lst: 'DELETED (Complete)' }), run: () => stat(['mode <b>Complete</b>: deletes the unlisted']), t: 'With <code>--mode Complete</code>, the same preview would turn <code>* Ignore</code> into <code>- Delete</code>: anything not in the template is removed, even another team’s resource. Prefer a <b>deployment stack</b>, which deletes only what it created.', cls: 'err' });
      return S;
    }
    S.push({ ...A.set({ bsrc: 'ok', tsrc: 'ok', live: 'ok' }), run: () => stat(['code = live']), t: 'Both tools agree with the live app: TLS 1.2. Bicep keeps no record of the last deploy; Terraform keeps a <b>state file</b> with every managed attribute.' });
    S.push({ fly: ['portal', 'live'], ...A.set({ portal: 'bad', p1: 'bad', live: 'bad' }, { live: 'minTls 1.0 (drifted)' }), run: () => stat(['code ≠ live']), t: 'At 02:00 someone lowers TLS to 1.0 in the portal to unblock a legacy client. The live resource has <b>drifted</b>.', cls: 'err' });
    S.push({ fly: ['pol', [300, 170], 'live'], ...A.set({ pol: 'warn', p2: 'warn' }, { live: 'TLS 1.0 · +CostCenter tag' }), t: 'Separately, an Azure Policy with a <i>modify</i> effect adds a <code>CostCenter</code> tag. That is also a difference from the code, but an expected one.', cls: 'warn' });
    S.push({ fly: ['live', 'bwi'], ...A.set({ r1: 'warn', bwi: 'warn' }, { bwi: '~ minTlsVersion 1.0 => 1.2' }), t: '<b>Bicep what-if</b> compares the template with the live resource and shows <code>~ Modify</code> for the TLS property. Bicep only checks properties you declared; a tag you never declared is not reported.', cls: 'warn' });
    S.push({ fly: ['live', 'tplan'], ...A.set({ r2: 'warn', tplan: 'warn' }, { tplan: '~ TLS 1.2 · − tag CostCenter' }), run: () => stat(['plan exit code <b>2</b>']), t: '<b>terraform plan</b> first refreshes state from Azure, then diffs config against it: TLS back to 1.2, <i>and</i> remove the Policy tag. With <code>-detailed-exitcode</code> it exits 2, a drift alarm. Resources Terraform doesn’t manage are invisible to it.', cls: 'warn' });
    S.push({ ...A.set({ tapp: 'hot' }, { tapp: 'ignore_changes: CostCenter', tplan: '~ tls 1.0 → 1.2 only' }), t: 'Remove the expected noise: tell Terraform that Policy owns that tag (<code>ignore_changes</code>). Now a clean environment plans to zero, and any exit code 2 is real drift worth a page.' });
    S.push({ ...A.set({ bdep: 'ok', tapp: 'ok', live: 'ok', b2: 'ok', t2: 'ok', portal: 'dim', p1: 'dim' }, { bdep: 'reverts to 1.2', live: 'minTls 1.2 · tag kept' }), run: () => stat(['code = live']), t: 'The next deploy (either tool) <b>reverts the hotfix</b>. If the legacy client still needs TLS 1.0, that is now an outage. Rule: hotfixes go into code (or a PR right after the break-glass change), and humans get read-only access to production.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ whatif: 'Press Play: compile, preview each change type, deploy, then see what Complete mode would delete.', drift: 'Press Play: a portal change and a Policy tag make the live app drift. Watch what each tool reports.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), stats, controls, narr);
  const reset = makeStepper(plan, intro, build);
  reset();
});
