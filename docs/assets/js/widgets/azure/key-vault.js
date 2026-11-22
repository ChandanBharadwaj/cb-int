/* Key Vault: Spring Cloud Azure property source at startup, access policies vs Azure RBAC (privilege escalation), event-driven two-credential rotation, and envelope encryption with wrap/unwrap. */
IA.widget('key-vault', (root, ctx) => {
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
  let mode = 'spring';
  const stage = svg('svg', { viewBox: '0 0 640 320', role: 'img', 'aria-label': 'Key Vault flows: startup, permissions, rotation and key wrapping' });
  const segM = seg([['spring', 'Spring startup'], ['ap', 'Access policies'], ['rbac', 'Azure RBAC'], ['rotate', 'Rotation'], ['keys', 'Keys: wrap/unwrap']], mode, (v) => { mode = v; reset(); }, 'Flow');
  function build() {
    stage.innerHTML = ''; clearZ();
    const e = svg('g'); const g = svg('g');
    if (mode === 'spring') {
      node(g, 'boot', 10, 30, 180, 56, 'Spring Boot startup', 'property sources');
      node(g, 'cred', 10, 140, 180, 56, 'ManagedIdentityCredential', 'client-id = id-orders');
      node(g, 'entra', 10, 250, 180, 56, 'Microsoft Entra ID', 'token for vault.azure.net');
      node(g, 'env', 230, 30, 180, 56, 'Environment', 'shipping-api-key = ?');
      node(g, 'kv', 230, 140, 180, 56, 'kv-orders-prod', 'secrets');
      node(g, 'rb', 230, 250, 180, 56, 'Role assignment', 'Key Vault Secrets User');
      node(g, 'beans', 450, 30, 180, 56, 'Beans', 'ShippingClient(apiKey)');
      node(g, 'rot', 450, 140, 180, 56, 'New secret version', 'v2 written');
      node(g, 'ref', 450, 250, 180, 56, 'refresh-interval', '10m');
      link(e, 'e1', 'boot', 'cred'); link(e, 'e2', 'cred', 'entra'); hlink(e, 'e3', 'cred', 'kv'); link(e, 'e4', 'kv', 'rb');
      link(e, 'e5', 'env', 'kv'); hlink(e, 'e6', 'boot', 'env'); hlink(e, 'e7', 'env', 'beans'); hlink(e, 'e8', 'kv', 'rot'); link(e, 'e9', 'rot', 'ref');
    } else if (mode === 'ap' || mode === 'rbac') {
      const rb = mode === 'rbac';
      node(g, 'user', 10, 30, 190, 56, 'contractor@corp', 'Contributor on the RG');
      node(g, 'arm', 225, 30, 190, 56, 'ARM (control plane)', 'vaults/write');
      node(g, 'pol', 440, 30, 190, 56, rb ? 'Role assignments' : 'Access policies', rb ? 'needs roleAssignments/write' : 'part of the vault resource');
      node(g, 'app', 10, 190, 190, 56, 'payments-api (MI)', rb ? 'Key Vault Secrets User' : 'policy: get, list');
      node(g, 'dp', 225, 190, 190, 56, 'Data plane', 'GET /secrets/psp-key');
      node(g, 'sec', 440, 190, 190, 56, 'psp-key', 'payment provider key');
      hlink(e, 'e1', 'user', 'arm'); hlink(e, 'e2', 'arm', 'pol'); hlink(e, 'e3', 'app', 'dp'); hlink(e, 'e4', 'dp', 'sec');
      edge(e, 'e5', 'M120 86 C 120 140, 320 140, 320 190'); edge(e, 'e6', 'M535 86 C 535 140, 320 140, 320 190');
    } else if (mode === 'rotate') {
      node(g, 'kv', 230, 20, 180, 60, 'kv-orders-prod', 'db-password = v1 (user A)');
      node(g, 'eg', 450, 20, 180, 60, 'Event Grid', 'SecretNearExpiry');
      node(g, 'fn', 450, 140, 180, 60, 'Rotation Function', 'MI: Secrets Officer');
      node(g, 'pg', 450, 250, 180, 60, 'Postgres', 'A: active · B: standby');
      node(g, 'pods', 10, 140, 180, 60, 'orders-api ×20', 'Hikari, user A');
      node(g, 'ps', 10, 20, 180, 60, 'Property source', 'refresh every 10m');
      node(g, 'clock', 230, 250, 180, 60, 'Grace period', '> refresh interval');
      hlink(e, 'e1', 'kv', 'eg'); link(e, 'e2', 'eg', 'fn'); link(e, 'e3', 'fn', 'pg'); edge(e, 'e4', 'M450 170 C 420 170, 380 120, 320 80');
      hlink(e, 'e5', 'ps', 'kv'); link(e, 'e6', 'ps', 'pods'); edge(e, 'e7', 'M190 170 C 330 170, 330 280, 450 280');
    } else {
      node(g, 'app', 10, 20, 190, 56, 'docs-service', 'encrypts uploads');
      node(g, 'dek', 10, 130, 190, 56, 'DEK (AES-256)', 'random, local');
      node(g, 'blob', 10, 240, 190, 60, 'Blob storage', 'ciphertext + wrapped DEK');
      node(g, 'kv', 240, 130, 170, 56, 'kek-documents', 'RSA key, not exportable');
      node(g, 'rb', 450, 130, 180, 56, 'Role assignment', 'Key Vault Crypto User');
      node(g, 'rot', 450, 240, 180, 60, 'Rotation policy', 'new version every 180d');
      node(g, 'v2', 240, 240, 170, 60, 'kek-documents v2', '—');
      link(e, 'e1', 'app', 'dek'); hlink(e, 'e2', 'dek', 'kv'); link(e, 'e3', 'dek', 'blob'); hlink(e, 'e4', 'kv', 'rb'); hlink(e, 'e5', 'rot', 'v2'); link(e, 'e6', 'kv', 'v2');
    }
    stage.append(e, g, pkt);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'spring') {
      S.push({ ...A.set({ boot: 'hot', rot: 'dim', ref: 'dim', e8: 'dim', e9: 'dim' }), t: 'Before any bean exists, Spring Cloud Azure adds <code>kv-orders-prod</code> as a <b>property source</b>, so <code>${shipping-api-key}</code> can resolve.' });
      S.push({ fly: ['boot', 'cred', 'entra', 'cred'], ...A.set({ cred: 'ok', entra: 'ok', e1: 'ok', e2: 'ok' }), t: 'The configured credential, here the user-assigned managed identity, gets a token for <code>https://vault.azure.net</code>. No secret is needed to fetch secrets.', cls: 'ok' });
      S.push({ fly: ['cred', 'kv', 'rb'], ...A.set({ kv: 'ok', rb: 'ok', e3: 'ok', e4: 'ok' }), t: 'The property source lists and reads secrets (only the configured <code>secret-keys</code>, if set). Key Vault checks the token and the <b>Key Vault Secrets User</b> role on the vault.', cls: 'ok' });
      S.push({ fly: ['kv', 'env'], ...A.set({ env: 'ok', e5: 'ok', e6: 'ok' }, { env: 'shipping-api-key = ••••(v1)' }), t: 'Values become ordinary properties. Secret names use dashes; the property source maps them to property names.', cls: 'ok' });
      S.push({ fly: ['env', 'beans'], ...A.set({ beans: 'ok', e7: 'ok' }, { beans: 'ShippingClient(key v1)' }), t: 'Beans are built with the value. From now on the <b>bean</b> holds v1, not the vault.' });
      S.push({ fly: ['kv', 'rot'], ...A.set({ rot: 'warn', e8: 'warn', kv: 'warn' }, { kv: 'current: v2' }), t: 'Weeks later someone writes v2 of the secret. Versionless reads now return v2.', cls: 'warn' });
      S.push({ fly: ['rot', 'ref', 'env'], ...A.set({ ref: 'ok', e9: 'ok', env: 'ok' }, { env: 'shipping-api-key = ••••(v2)' }), t: 'On its <b>refresh interval</b> the property source re-reads the vault, and the Environment now holds v2…', cls: 'ok' });
      S.push({ ...A.set({ beans: 'bad' }, { beans: 'still using v1!' }), t: '…but <code>ShippingClient</code> was built with v1 and keeps it. Rebuild such beans on refresh (for example read the property per call, or use <code>@RefreshScope</code> with Spring Cloud), or rotate with overlapping credentials so v1 still works for a while.', cls: 'err' });
      return S;
    }
    if (mode === 'ap') {
      S.push({ fly: ['app', 'dp', 'sec'], ...A.set({ app: 'ok', dp: 'ok', sec: 'ok', e3: 'ok', e4: 'ok' }), t: '<b>Access-policy model</b>: payments-api has an access policy with <code>get, list</code> on secrets, so it reads <code>psp-key</code>.', cls: 'ok' });
      S.push({ fly: ['user', 'dp'], ...A.set({ user: 'hot', e5: 'bad', dp: 'bad' }), t: 'A contractor has <b>Contributor</b> on the resource group. They try to read the secret: denied, they’re not in any access policy.', cls: 'err' });
      S.push({ fly: ['user', 'arm', 'pol'], ...A.set({ arm: 'warn', pol: 'bad', e1: 'warn', e2: 'bad' }, { pol: '+ contractor: get, list' }), t: 'But access policies are a property of the vault <b>resource</b>. Contributor may write the vault, so they add an access policy for themselves. It is just an ARM update.', cls: 'err' });
      S.push({ fly: ['pol', 'dp', 'sec'], ...A.set({ e6: 'bad', dp: 'bad', sec: 'bad' }, { sec: 'read by contractor' }), t: 'Now the read succeeds. Anyone who can manage the vault can read its data: <b>privilege escalation by design</b>. This is the main reason to move to Azure RBAC.', cls: 'err' });
      return S;
    }
    if (mode === 'rbac') {
      S.push({ fly: ['app', 'dp', 'sec'], ...A.set({ app: 'ok', dp: 'ok', sec: 'ok', e3: 'ok', e4: 'ok' }), t: '<b>Azure RBAC model</b>: payments-api’s identity has a role assignment, <b>Key Vault Secrets User</b>, on the vault (or on this one secret).', cls: 'ok' });
      S.push({ fly: ['user', 'dp'], ...A.set({ user: 'hot', e5: 'bad', dp: 'bad' }), t: 'The contractor with Contributor tries to read the secret. Contributor has <code>Actions</code> but no <code>DataActions</code>: <b>403</b>.', cls: 'err' });
      S.push({ fly: ['user', 'arm', 'pol'], ...A.set({ arm: 'ok', e1: 'ok', pol: 'ok', e2: 'bad' }, { pol: 'denied: no roleAssignments/write' }), t: 'They try to grant themselves a role. Creating role assignments needs <code>Microsoft.Authorization/roleAssignments/write</code> (Owner, User Access Administrator, or RBAC Administrator). Contributor lacks it, so it is denied.', cls: 'ok' });
      S.push({ ...A.set({ sec: 'ok', dp: 'ok' }, { sec: 'only the app reads it' }), t: 'Managing the vault and reading its contents are now separate permissions. Add PIM for just-in-time <b>Key Vault Administrator</b>, and assign data roles at the narrowest scope.', cls: 'ok' });
      return S;
    }
    if (mode === 'rotate') {
      S.push({ ...A.set({ kv: 'warn', clock: 'dim', e7: 'dim' }, { kv: 'db-password v1 · exp in 30 d' }), t: 'The secret <code>db-password</code> (user A’s password) has an expiry date. 30 days before it, Key Vault publishes <code>SecretNearExpiry</code>.', cls: 'warn' });
      S.push({ fly: ['kv', 'eg', 'fn'], ...A.set({ eg: 'ok', fn: 'hot', e1: 'ok', e2: 'ok' }), t: 'Event Grid delivers the event to a rotation Function. Its managed identity has <b>Secrets Officer</b> on this vault and permission to manage the two app users in Postgres.' });
      S.push({ fly: ['fn', 'pg'], ...A.set({ pg: 'ok', e3: 'ok' }, { pg: 'B: new password set' }), t: 'The Function resets the password of the <b>standby</b> user B. User A is still valid, so nothing in production breaks.', cls: 'ok' });
      S.push({ fly: ['fn', 'kv'], ...A.set({ kv: 'ok', e4: 'ok' }, { kv: 'db-password v2 (user B)' }), t: 'It writes v2 of the secret (user B + its password, with a new expiry). <code>SecretNewVersionCreated</code> fires too, if anyone needs it.', cls: 'ok' });
      S.push({ fly: ['kv', 'ps', 'pods'], ...A.set({ ps: 'ok', e5: 'ok', e6: 'ok', pods: 'warn' }, { pods: 'new conns: user B; old: A' }), t: 'Pods pick up v2 on their refresh interval. New pooled connections use user B. Existing ones still use A until Hikari’s <code>maxLifetime</code> recycles them.', cls: 'warn' });
      S.push({ ...A.set({ clock: 'ok', pods: 'ok' }, { pods: 'all connections: user B' }), t: 'Wait a <b>grace period</b> longer than the refresh interval plus <code>maxLifetime</code>. Now every connection uses B.', cls: 'ok' });
      S.push({ fly: ['pods', 'pg'], ...A.set({ e7: 'ok', pg: 'ok' }, { pg: 'A: disabled · B: active' }), t: 'Only then is user A disabled. Next rotation swaps the roles. Simpler still: use Entra authentication with the app’s managed identity, and there is no password to rotate.', cls: 'ok' });
      return S;
    }
    S.push({ fly: ['app', 'dek'], ...A.set({ app: 'hot', dek: 'ok', e1: 'ok', v2: 'dim', rot: 'dim', e5: 'dim', e6: 'dim' }), t: 'docs-service generates a random 256-bit <b>data encryption key</b> (DEK) and encrypts the document locally with AES-GCM. Bulk encryption never goes to the vault.' });
    S.push({ fly: ['dek', 'kv'], ...A.set({ kv: 'hot', e2: 'hot' }), t: 'It sends only the 32-byte DEK to Key Vault: <code>wrapKey(RSA-OAEP-256)</code> with the key-encryption key <code>kek-documents</code>.' });
    S.push({ fly: ['kv', 'rb'], ...A.set({ rb: 'ok', e4: 'ok', kv: 'ok' }), t: 'Key Vault checks the <b>Key Vault Crypto User</b> role and wraps the DEK inside the vault. The RSA private key never leaves it.', cls: 'ok' });
    S.push({ fly: ['kv', 'dek', 'blob'], ...A.set({ blob: 'ok', e3: 'ok' }, { blob: 'ciphertext + wrapped DEK + kid' }), t: 'The app stores the ciphertext, the <b>wrapped</b> DEK and the key ID (with version) together, and forgets the plain DEK.', cls: 'ok' });
    S.push({ fly: ['rot', 'v2'], ...A.set({ rot: 'ok', v2: 'ok', e5: 'ok', e6: 'ok' }, { v2: 'current version' }), t: 'The key’s <b>rotation policy</b> creates a new version after 180 days. New DEKs are wrapped with v2.', cls: 'ok' });
    S.push({ fly: ['blob', 'kv', 'dek'], ...A.set({ dek: 'ok' }, { dek: 'unwrapped with v1' }), t: 'Old documents still decrypt: the stored key ID names v1, and old versions stay enabled for <code>unwrapKey</code>. Rotating a KEK means re-wrapping small DEKs, never re-encrypting terabytes. That is envelope encryption, as used by customer-managed keys.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ spring: 'Spring Boot loading secrets at startup. Press Play.', ap: 'A vault on the legacy access-policy model. Press Play.', rbac: 'The same vault on Azure RBAC. Press Play.', rotate: 'Two-credential rotation driven by Event Grid. Press Play.', keys: 'Envelope encryption with a vault key. Press Play.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr);
  const reset = makeStepper(plan, intro, build, 2800);
  reset();
});
