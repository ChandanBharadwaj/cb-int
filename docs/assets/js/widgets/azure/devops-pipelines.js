/* CI/CD pipelines: GitHub Actions OIDC token exchange with Entra ID, a subject-claim mismatch, and environments with approval gates and digest promotion. */
IA.widget('devops-pipelines', (root, ctx) => {
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
  if (!document.getElementById('w-az-cicd-style')) {
    document.head.append(el('style', { id: 'w-az-cicd-style', text: `
.w-az .cl { opacity: 0; fill: var(--text-2); font-family: var(--mono); font-size: 11px; transition: opacity .4s, fill .4s; }
.w-az .cl.ok { opacity: 1; fill: var(--ok); }
.w-az .cl.warn { opacity: 1; fill: var(--warn); }
.w-az .cl.bad { opacity: 1; fill: var(--err); }
.w-az .cl.hot { opacity: 1; fill: var(--accent); }
.w-az .cl.mut { opacity: 1; fill: var(--text-2); }
` }));
  }
  let mode = 'oidc';
  const stage = svg('svg', { viewBox: '0 0 640 340', role: 'img', 'aria-label': 'GitHub Actions OIDC token exchange with Entra ID, a subject mismatch, or environments with approval gates' });
  const segM = seg([['oidc', 'Token exchange'], ['miss', 'Subject mismatch'], ['gates', 'Environments']], mode, (v) => { mode = v; reset(); }, 'Mechanism');
  const stats = el('div', { class: 'w-stats' });
  const stat = (h) => { stats.innerHTML = ''; h.forEach((x) => stats.append(el('span', { class: 'w-stat', html: x }))); };
  const zrect = (g, id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 10 }); g.append(r, svg('text', { class: 'lbl', x: x + 8, y: y + 17, text: label })); Z[id] = { n: r, base: 'zn' }; };
  const line = (g, id, x, y, t) => { const n = svg('text', { class: 'cl', x, y, text: t }); g.append(n); Z[id] = { n, base: 'cl', sub: n, sub0: t }; };
  function build() {
    stage.innerHTML = ''; clearZ();
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    if (mode === 'oidc' || mode === 'miss') {
      node(g, 'run', 10, 24, 160, 60, 'GitHub runner', mode === 'miss' ? 'environment: production' : 'job deploy-prod');
      node(g, 'gh', 10, 150, 160, 60, 'GitHub OIDC provider', 'token.actions.github…');
      zrect(bg, 'jwt', 188, 108, 262, 142, 'ID token (signed JWT)');
      line(g, 'c1', 198, 146, 'iss  https://token.actions.git…');
      line(g, 'c2', 198, 172, 'sub  …orders:environment:production');
      line(g, 'c3', 198, 198, 'aud  api://AzureADTokenExchange');
      line(g, 'c4', 198, 224, 'exp  a few minutes from now');
      node(g, 'ent', 470, 24, 162, 60, 'Entra ID', 'token endpoint');
      node(g, 'fic', 470, 150, 162, 60, 'federated credential', mode === 'miss' ? '…:ref:refs/heads/main' : '…:environment:production');
      node(g, 'arm', 470, 268, 162, 60, 'Azure Resource Manager', 'rg-orders-prod');
      node(g, 'sec', 10, 268, 160, 60, 'repo secrets', 'no Azure secret stored');
      link(e, 'e1', 'run', 'gh'); hlink(e, 'e2', 'run', 'ent'); link(e, 'e3', 'ent', 'fic'); edge(e, 'e4', 'M551 210 L 551 268');
      edge(e, 'e5', 'M170 54 C 330 54, 330 300, 470 298');
    } else {
      node(g, 'bld', 10, 30, 140, 60, 'build', 'mvn -B verify');
      node(g, 'dev', 170, 30, 140, 60, 'dev', 'auto deploy');
      node(g, 'stg', 330, 30, 140, 60, 'staging', 'smoke + load');
      node(g, 'gate', 490, 30, 142, 60, 'approval', 'required reviewers');
      node(g, 'prod', 490, 150, 142, 60, 'production', 'canary → 100%');
      node(g, 'img', 10, 150, 300, 60, 'acrorders/orders@sha256:9f2c…', 'built once, promoted by digest');
      node(g, 'idd', 170, 260, 140, 60, 'id-deploy-dev', 'env: dev');
      node(g, 'ids', 330, 260, 140, 60, 'id-deploy-stg', 'env: staging');
      node(g, 'idp', 490, 260, 142, 60, 'id-deploy-prod', 'env: production');
      node(g, 'q', 330, 150, 140, 60, 'run #42', 'concurrency: orders-prod');
      hlink(e, 'g1', 'bld', 'dev'); hlink(e, 'g2', 'dev', 'stg'); hlink(e, 'g3', 'stg', 'gate'); link(e, 'g4', 'gate', 'prod');
      link(e, 'g5', 'bld', 'img');
      edge(e, 'i1', 'M240 260 L 240 90'); edge(e, 'i2', 'M400 260 L 400 210'); edge(e, 'i3', 'M561 260 L 561 210');
    }
    stage.append(bg, e, g, pkt);
    stat([]);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'oidc' || mode === 'miss') {
      const miss = mode === 'miss';
      S.push({ ...A.set({ run: 'hot', sec: 'ok' }), run: () => stat(['secrets for Azure: <b>0</b>', '<code>id-token: write</code>']), t: miss ? 'The team added <code>environment: production</code> to the deploy job. The identity’s only federated credential was created earlier, for pushes to <code>main</code>.' : 'The job has <code>permissions: id-token: write</code>. The repo stores only the client, tenant and subscription <b>IDs</b>, which are not secrets. There is no password to leak or rotate.' });
      S.push({ fly: ['run', 'gh'], ...A.set({ e1: 'hot', gh: 'hot' }), t: '<code>azure/login</code> asks GitHub’s OIDC provider for an ID token with audience <code>api://AzureADTokenExchange</code>, using a request URL and token that only exist inside this running job.' });
      S.push({ fly: ['gh', [319, 180]], ...A.set({ jwt: 'hot', c1: 'mut', c2: miss ? 'warn' : 'hot', c3: 'mut', c4: 'mut' }), t: miss ? 'Because the job targets an environment, the subject is now <code>repo:contoso/orders:<b>environment:production</b></code>, not <code>ref:refs/heads/main</code>.' : 'GitHub signs a short-lived JWT. The <b>subject</b> describes the context: repo plus environment (or branch ref, or <code>pull_request</code>). It expires within minutes.', cls: miss ? 'warn' : '' });
      S.push({ fly: ['run', 'ent'], ...A.set({ e2: 'hot', ent: 'hot' }), t: 'The runner posts the JWT to Entra ID’s token endpoint as a <b>client assertion</b> (<code>client_assertion_type=…jwt-bearer</code>) for the deploy identity’s client ID. No secret travels.' });
      if (miss) {
        S.push({ fly: ['ent', 'fic'], ...A.set({ e3: 'bad', fic: 'bad', c2: 'bad' }), run: () => stat(['login <b>failed</b>']), t: 'Entra validates the signature with GitHub’s published keys, then compares claims. <code>iss</code> and <code>aud</code> match, but the <code>sub</code> doesn’t equal any federated credential: “<b>No matching federated identity record found</b> for presented assertion subject”.', cls: 'err' });
        S.push({ ...A.set({ fic: 'ok', e3: 'ok', c2: 'ok' }, { fic: '…:environment:production' }), run: () => stat(['credentials on identity: <b>2</b>']), t: 'Fix: add a federated credential for <code>repo:contoso/orders:environment:production</code> (copy the subject from the error). Keep the branch rule in the environment’s deployment branch policy.', cls: 'ok' });
        S.push({ fly: ['fic', 'ent', 'run'], ...A.set({ ent: 'ok', run: 'ok', e2: 'ok' }), run: () => stat(['login <b>ok</b>']), t: 'The next run matches, and the job gets its Azure token. Now only jobs that passed the production environment’s reviewers can present this subject.', cls: 'ok' });
        return S;
      }
      S.push({ fly: ['ent', 'fic'], ...A.set({ e3: 'ok', fic: 'ok', c1: 'ok', c2: 'ok', c3: 'ok' }), run: () => stat(['iss ✓', 'sub ✓', 'aud ✓']), t: 'Entra checks the signature against the issuer’s OIDC keys, then requires an <b>exact match</b> of <code>iss</code>, <code>sub</code> and <code>aud</code> with one of the identity’s federated credentials.', cls: 'ok' });
      S.push({ fly: ['fic', 'ent', 'run'], ...A.set({ ent: 'ok', e2: 'ok', run: 'ok' }), run: () => stat(['Azure access token: <b>short-lived</b>']), t: 'Entra returns an access token for the identity. <code>az</code> and the Azure SDKs in later steps use it. Nothing long-lived was created or stored.', cls: 'ok' });
      S.push({ fly: ['run', [330, 54], [330, 298], 'arm'], ...A.set({ e5: 'ok', arm: 'ok' }), run: () => stat(['role: Contributor on <b>rg-orders-prod</b> only']), t: 'The deploy calls Resource Manager. What it may do is decided by <b>RBAC</b> on the identity: here Contributor on one resource group, so a compromised job can’t touch other environments.', cls: 'ok' });
      return S;
    }
    S.push({ fly: ['bld', 'img'], ...A.set({ bld: 'ok', g5: 'ok', img: 'hot' }), run: () => stat(['image digest <b>sha256:9f2c…</b>']), t: 'Main is merged. The build job runs tests and builds the image <b>once</b>, then pushes it and records its <b>digest</b>. Every later stage deploys these exact bytes.' });
    S.push({ fly: ['bld', 'dev'], ...A.set({ g1: 'ok', dev: 'ok', idd: 'hot', i1: 'hot' }), t: 'Dev deploys automatically. The job targets the <code>dev</code> environment, so its token subject is <code>…:environment:dev</code>, trusted only by <code>id-deploy-dev</code>, which can only touch dev.', cls: 'ok' });
    S.push({ fly: ['dev', 'stg'], ...A.set({ g2: 'ok', stg: 'ok', ids: 'hot', i2: 'hot', q: 'hot' }), run: () => stat(['run #43 <b>pending</b> (same group)']), t: 'Staging gets the same digest and runs smoke and load checks. Meanwhile a second merge started run #43. The <b>concurrency group</b> keeps it pending, so two production deploys can’t interleave.' });
    S.push({ fly: ['stg', 'gate'], ...A.set({ g3: 'warn', gate: 'warn' }, { gate: 'waiting · 0/1 approvals' }), run: () => stat(['environment: <b>production</b>', 'branch policy: <b>main</b>']), t: 'The production job targets the <code>production</code> environment, so it <b>waits</b>: required reviewers (self-review prevented), allowed branch <code>main</code>. Its secrets and its OIDC subject aren’t available until it passes.', cls: 'warn' });
    S.push({ ...A.set({ gate: 'ok', g3: 'ok' }, { gate: 'approved by a reviewer' }), t: 'A reviewer approves. In Azure DevOps the equivalent is an <b>approval check</b> on the environment or service connection, enforced no matter which YAML uses it.', cls: 'ok' });
    S.push({ fly: ['gate', 'prod'], ...A.set({ g4: 'ok', prod: 'ok', idp: 'ok', i3: 'ok' }, { prod: 'sha256:9f2c… · 10% → 100%' }), run: () => stat(['prod = staging = <b>sha256:9f2c…</b>']), t: 'Production deploys the <b>same digest</b> with <code>id-deploy-prod</code>, as a canary (Container Apps traffic split or an App Service slot), watching SLO alerts. Rollback = redeploy the previous digest.', cls: 'ok' });
    S.push({ ...A.set({ q: 'ok' }, { q: 'run #43 starts now' }), run: () => stat(['one deploy at a time']), t: 'Only now does run #43 continue into its own gates. Gates on resources, one identity per environment and digest promotion together make production changes reviewable and repeatable.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ oidc: 'Press Play: a job gets an Azure token without any stored secret.', miss: 'Press Play: one added line (<code>environment: production</code>) changes the token subject and breaks login. Then fix it.', gates: 'Press Play: one image digest promoted through dev and staging, an approval, and production.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), stats, controls, narr);
  const reset = makeStepper(plan, intro, build);
  reset();
});
