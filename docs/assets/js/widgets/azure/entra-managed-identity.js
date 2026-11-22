/* Managed identity token flow: DefaultAzureCredential chain → platform identity endpoint → Entra ID → Key Vault RBAC, for system-assigned, user-assigned and local dev. */
IA.widget('entra-managed-identity', (root, ctx) => {
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
  let mode = 'sys';
  const stage = svg('svg', { viewBox: '0 0 640 340', role: 'img', 'aria-label': 'Token flow from app through the identity endpoint and Entra ID to Key Vault' });
  const segM = seg([['sys', 'System-assigned MI'], ['uami', 'User-assigned MI'], ['local', 'Local dev (Azure CLI)']], mode, (v) => { mode = v; reset(); }, 'Identity');
  const tok = el('div', { class: 'codebox', style: { marginTop: '8px' } });
  const showTok = (on) => {
    tok.innerHTML = ''; if (!on) { tok.style.display = 'none'; return; } tok.style.display = '';
    const who = mode === 'local' ? '"upn": "dev@corp.com",  // you, via az login' : mode === 'uami' ? '"oid": "<principal id of id-orders>",  // user-assigned MI' : '"oid": "<principal id of app-orders>",  // system-assigned MI';
    tok.append(el('pre', { html: IA.highlight(`// access token (JWT) payload, abridged\n{\n  "aud": "https://vault.azure.net",\n  "iss": "https://sts.windows.net/<tenant-id>/",\n  ${who}\n  "exp": 1764000000\n}`, 'js') }));
  };
  function build() {
    stage.innerHTML = ''; clearZ();
    const g = svg('g'); const e = svg('g');
    stage.append(svg('text', { class: 'lbl', x: 14, y: 22, text: 'DefaultAzureCredential tries, in order:' }));
    [['cEnv', 'Environment', 'secret / cert env vars'], ['cWi', 'Workload Identity', 'federated token file'], ['cMi', 'Managed Identity', 'platform endpoint'], ['cCli', 'Dev tools', 'Azure CLI, azd, IntelliJ…']]
      .forEach(([id, t, s], i) => node(g, id, 10, 34 + i * 62, 170, 50, t, s));
    node(g, 'app', 226, 34, 176, 50, 'orders-api', mode === 'local' ? 'laptop: spring-boot:run' : mode === 'uami' ? 'Container Apps' : 'App Service');
    node(g, 'ep', 226, 150, 176, 50, mode === 'local' ? 'az CLI token cache' : 'Identity endpoint', mode === 'local' ? 'az login session' : 'host-local, no secret');
    node(g, 'id', 226, 270, 176, 50, mode === 'local' ? 'Your user account' : 'Managed identity', mode === 'local' ? 'dev@corp.com' : mode === 'uami' ? 'id-orders (user-assigned)' : 'system-assigned');
    node(g, 'kv', 454, 34, 176, 50, 'Key Vault', 'kv-orders.vault.azure.net');
    node(g, 'entra', 454, 150, 176, 50, 'Microsoft Entra ID', 'issues the token');
    node(g, 'rb', 454, 270, 176, 50, 'Role assignment', 'Key Vault Secrets User');
    link(e, 'e1', 'app', 'ep'); hlink(e, 'e2', 'ep', 'entra'); hlink(e, 'e3', 'app', 'kv'); link(e, 'e4', 'kv', 'rb');
    link(e, 'e5', 'ep', 'id'); hlink(e, 'e6', 'id', 'rb');
    edge(e, 'e7', 'M180 180 L 226 175');
    stage.append(e, g, pkt);
    showTok(false);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'local') {
      S.push({ ...A.set({ app: 'hot', cEnv: 'dim' }), t: 'The <b>same code</b> runs on your laptop. <code>EnvironmentCredential</code> finds no <code>AZURE_CLIENT_SECRET</code> or certificate variables, so it is skipped.' });
      S.push({ ...A.set({ cWi: 'dim' }), t: '<code>WorkloadIdentityCredential</code> finds no federated token file (<code>AZURE_FEDERATED_TOKEN_FILE</code>), so it is skipped.' });
      S.push({ ...A.set({ cMi: 'bad' }), t: '<code>ManagedIdentityCredential</code> probes for a platform identity endpoint. There isn’t one on a laptop, so it fails and the chain moves on. (This probe is why the first token can be slow locally.)', cls: 'warn' });
      S.push({ ...A.set({ cCli: 'ok', ep: 'hot', e7: 'ok', e1: 'hot' }), t: 'A developer-tool credential such as <code>AzureCliCredential</code> works: it asks the Azure CLI for a token using your <code>az login</code> session.' });
      S.push({ fly: ['ep', 'entra'], ...A.set({ entra: 'ok', e2: 'ok' }), t: 'Entra issues a token for <b>your user</b> with audience <code>https://vault.azure.net</code>.' });
      S.push({ fly: ['entra', 'ep', 'app'], ...A.set({}), run: () => showTok(true), t: 'The token comes back to the SDK, which caches it. Notice who it names: you, not the app.' });
      S.push({ fly: ['app', 'kv'], ...A.set({ kv: 'hot', e3: 'hot' }), t: '<code>SecretClient.getSecret("db-password")</code> sends <code>Authorization: Bearer …</code> to the vault.' });
      S.push({ fly: ['kv', 'rb'], ...A.set({ rb: 'ok', id: 'ok', kv: 'ok', e4: 'ok', e6: 'ok' }), t: 'It works only if <b>your user</b> (or a group you’re in) has a data role on the vault. Give developers roles on <i>dev</i> vaults only. Production should be reachable only by its managed identity.', cls: 'ok' });
      return S;
    }
    S.push({ ...A.set({ app: 'hot', cEnv: 'dim', cWi: 'dim' }), t: mode === 'uami' ? 'In Container Apps there are no secret env vars and no federated token file, so the first two credentials are skipped. With a <b>user-assigned</b> identity, set <code>AZURE_CLIENT_ID</code> (or <code>managedIdentityClientId</code>) so the SDK knows which identity to use when several are attached.' : 'In App Service, <code>DefaultAzureCredential</code> skips the environment and workload-identity credentials: there are no client secrets and no federated token file.' });
    S.push({ ...A.set({ cMi: 'ok', ep: 'hot', e1: 'hot', e7: 'ok' }), fly: ['app', 'ep'], t: '<code>ManagedIdentityCredential</code> calls the platform’s <b>local identity endpoint</b>. App Service, Functions and Container Apps inject <code>IDENTITY_ENDPOINT</code> and <code>IDENTITY_HEADER</code>. VMs and AKS nodes use IMDS at <code>169.254.169.254</code>. Your code holds no secret.' });
    S.push({ ...A.set({ id: 'hot', e5: 'hot' }), t: mode === 'uami' ? 'The identity is <b>its own Azure resource</b> (<code>id-orders</code>). You can attach it to several apps and create it, and its role assignments, before the apps exist.' : 'A <b>system-assigned</b> identity is created with the app and deleted with it. Its service principal has the app’s name.' });
    S.push({ fly: ['ep', 'entra'], ...A.set({ entra: 'ok', e2: 'ok' }), t: 'The platform authenticates to Entra as that identity’s <b>service principal</b>, using credentials Azure manages and rotates for you, and asks for a token for the resource <code>https://vault.azure.net</code>.' });
    S.push({ fly: ['entra', 'ep', 'app'], ...A.set({}), run: () => showTok(true), t: 'A JWT comes back. <code>aud</code> = Key Vault, and <code>oid</code> = the identity’s principal ID. Managed-identity tokens are long-lived, and the SDK caches them, so most calls never go back to Entra.' });
    S.push({ fly: ['app', 'kv'], ...A.set({ kv: 'hot', e3: 'hot' }), t: 'The app calls the <b>data plane</b> <code>https://kv-orders.vault.azure.net/secrets/db-password</code> with <code>Authorization: Bearer &lt;token&gt;</code>.' });
    S.push({ fly: ['kv', 'rb'], ...A.set({ rb: 'ok', e4: 'ok', e6: 'ok', id: 'ok' }), t: 'Key Vault validates the token (signature, issuer, audience) and checks Azure RBAC: does this principal have <code>secrets/getSecret/action</code> at the vault scope or above? <b>Key Vault Secrets User</b> grants it.' });
    S.push({ fly: ['rb', 'kv', 'app'], ...A.set({ kv: 'ok', app: 'ok', e3: 'ok' }), t: mode === 'uami' ? '<b>Secret returned.</b> If you delete and recreate the app, <code>id-orders</code> and its role assignment survive, so there is no window in which the new app has no access.' : '<b>Secret returned.</b> But if you delete and recreate this app, a <i>new</i> principal ID is created and its role assignments are gone. That is a classic outage after re-deploying from IaC.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ sys: 'System-assigned managed identity on App Service. Press Play to follow the token.', uami: 'A user-assigned identity shared by Container Apps. Press Play to follow the token.', local: 'The same code on a developer laptop. Press Play to watch DefaultAzureCredential fall through its chain.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr, tok);
  const reset = makeStepper(plan, intro, build);
  reset();
});
