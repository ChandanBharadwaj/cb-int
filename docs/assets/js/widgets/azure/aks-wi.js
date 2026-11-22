/* AKS workload identity: projected service-account token → Entra token exchange via federated credential → Key Vault. */
IA.widget('aks-wi', (root, ctx) => {
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
  const stage = svg('svg', { viewBox: '0 0 640 330', role: 'img', 'aria-label': 'AKS workload identity token exchange' });
  const env = el('div', { class: 'codebox', style: { marginTop: '8px', display: 'none' } });
  const showEnv = (on) => { env.style.display = on ? '' : 'none'; env.innerHTML = '';
    if (on) env.append(el('pre', { html: IA.highlight(`# injected into the pod by the workload identity webhook\nAZURE_CLIENT_ID=<client id of id-orders>\nAZURE_TENANT_ID=<tenant id>\nAZURE_FEDERATED_TOKEN_FILE=/var/run/secrets/azure/tokens/azure-identity-token\nAZURE_AUTHORITY_HOST=https://login.microsoftonline.com/`, 'bash') })); };
  function build() {
    stage.innerHTML = ''; clearZ();
    const g = svg('g'); const e = svg('g');
    node(g, 'pod', 10, 20, 190, 56, 'pod orders-api', 'sa: orders-sa');
    node(g, 'wh', 10, 136, 190, 56, 'Mutating webhook', 'injects env + token volume');
    node(g, 'tok', 10, 252, 190, 56, 'Projected SA token', 'short-lived, auto-rotated');
    node(g, 'iss', 226, 20, 190, 56, 'Cluster OIDC issuer', 'OIDC discovery + keys');
    node(g, 'entra', 226, 136, 190, 56, 'Microsoft Entra ID', 'token exchange');
    node(g, 'fic', 226, 252, 190, 56, 'Federated credential', 'on MI id-orders');
    node(g, 'kv', 442, 136, 188, 56, 'Key Vault', 'Key Vault Secrets User');
    node(g, 'sa', 442, 20, 188, 56, 'ServiceAccount', 'annotation: client-id');
    node(g, 'imds', 442, 252, 188, 56, 'Node IMDS', 'kubelet identity (not yours)');
    link(e, 'e1', 'pod', 'wh'); link(e, 'e2', 'wh', 'tok'); hlink(e, 'e3', 'tok', 'fic'); link(e, 'e4', 'iss', 'entra'); link(e, 'e5', 'entra', 'fic');
    hlink(e, 'e6', 'entra', 'kv'); hlink(e, 'e7', 'pod', 'iss'); hlink(e, 'e8', 'iss', 'sa'); hlink(e, 'e9', 'fic', 'imds');
    stage.append(e, g, pkt); showEnv(false);
  }
  function plan() {
    const A = cum(); const S = [];
    S.push({ ...A.set({ sa: 'hot', pod: 'hot', imds: 'dim', e9: 'dim' }), t: 'Set-up: the cluster has <code>--enable-oidc-issuer --enable-workload-identity</code>. The ServiceAccount <code>orders-sa</code> is annotated with <code>azure.workload.identity/client-id</code>, and the pod is labelled <code>azure.workload.identity/use: "true"</code>.' });
    S.push({ ...A.set({ wh: 'ok', e1: 'ok' }), run: () => showEnv(true), t: 'At pod creation the <b>mutating webhook</b> injects env vars and a projected token volume. There are no secrets in the pod spec.' });
    S.push({ ...A.set({ tok: 'ok', e2: 'ok' }), t: 'The kubelet writes a short-lived <b>Kubernetes service-account token</b> to that file, signed by the cluster’s OIDC issuer, with <code>sub = system:serviceaccount:orders:orders-sa</code> and audience <code>api://AzureADTokenExchange</code>. It is rotated automatically.' });
    S.push({ fly: ['tok', 'entra'], ...A.set({ entra: 'hot' }), t: 'The Azure SDK (<code>WorkloadIdentityCredential</code>, or <code>DefaultAzureCredential</code>) sends that token to Entra as a <b>client assertion</b>: “I am this subject; give me a token for <code>id-orders</code>.”' });
    S.push({ fly: ['entra', 'iss'], ...A.set({ iss: 'ok', e4: 'ok', e7: 'ok' }), t: 'Entra fetches the issuer’s public signing keys from its <b>OIDC discovery</b> URL and verifies the token’s signature, issuer and expiry.' });
    S.push({ fly: ['entra', 'fic'], ...A.set({ fic: 'ok', e5: 'ok', e3: 'ok' }), t: 'Entra checks the <b>federated identity credential</b> on <code>id-orders</code>: issuer = this cluster’s URL, subject = <code>system:serviceaccount:orders:orders-sa</code>, audience matches. A different namespace or SA name is rejected.' });
    S.push({ fly: ['entra', 'kv'], ...A.set({ kv: 'ok', e6: 'ok', entra: 'ok' }), t: 'An Entra access token for <code>id-orders</code> comes back, and the pod calls Key Vault. RBAC is checked against the managed identity, just as on App Service.', cls: 'ok' });
    S.push({ ...A.set({ imds: 'warn', e9: 'warn' }), t: 'Why not just use IMDS? From a pod, IMDS returns the <b>node’s</b> (kubelet) identity, which every pod on that node could use. Workload identity gives <b>per-ServiceAccount</b> identities. It replaced the deprecated pod-managed identity add-on.', cls: 'warn' });
    return S;
  }
  root.append(el('div', { class: 'w-stage' }, stage), controls, narr, env);
  const reset = makeStepper(plan, () => 'Press Play to follow a pod’s Kubernetes token being exchanged for an Entra token.', build);
  reset();
});
