/* Storage extras: a lifecycle rule tiering a blob down over a year (with an archive rehydration), and account-key SAS vs user delegation SAS including revocation. */
IA.widget('storage-accounts-access', (root, ctx) => {
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
  let mode = 'life';
  const stage = svg('svg', { viewBox: '0 0 640 290', role: 'img', 'aria-label': 'Blob access tiers and SAS signing flows' });
  const segM = seg([['life', 'Lifecycle over a year'], ['key', 'Account-key SAS'], ['ud', 'User delegation SAS']], mode, (v) => { mode = v; reset(); }, 'Scenario');
  const stats = el('div', { class: 'w-stats' });
  const stat = (pairs) => { stats.innerHTML = ''; pairs.forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: `${k} <b>${v}</b>` }))); };
  function build() {
    stage.innerHTML = ''; clearZ();
    const e = svg('g'); const g = svg('g');
    if (mode === 'life') {
      [['hot', 'Hot', 'online · cheap reads'], ['cool', 'Cool', 'online · 30-day min'], ['cold', 'Cold', 'online · 90-day min'], ['arc', 'Archive', 'offline · 180-day min']]
        .forEach(([id, t, s], i) => node(g, id, 10 + i * 157, 40, 145, 70, t, s));
      hlink(e, 'e1', 'hot', 'cool'); hlink(e, 'e2', 'cool', 'cold'); hlink(e, 'e3', 'cold', 'arc');
      edge(e, 'eR', 'M553 110 C 553 175, 82 175, 82 110');
      g.append(svg('text', { class: 'lbl m', x: 318, y: 168, 'text-anchor': 'middle', text: 'rehydrate (copy or Set Blob Tier)' }));
      node(g, 'pol', 10, 205, 190, 56, 'Lifecycle policy', 'runs about once a day');
      node(g, 'app', 225, 205, 190, 56, 'invoice-api', 'GET invoice-0412.pdf');
      node(g, 'evt', 440, 205, 190, 56, 'Event Grid', 'BlobTierChanged');
      stat([['day', '0'], ['tier', 'Hot'], ['account', 'LRS (Archive allowed)']]);
    } else {
      node(g, 'api', 10, 20, 180, 52, 'orders-api', mode === 'ud' ? 'managed identity' : 'has the account key');
      node(g, 'key', 10, 120, 180, 52, mode === 'ud' ? 'User delegation key' : 'Account key', mode === 'ud' ? 'from Entra, ≤ 7 days' : 'key1: full access');
      node(g, 'entra', 10, 220, 180, 52, 'Microsoft Entra ID', 'issues token');
      node(g, 'client', 230, 120, 180, 52, 'Partner / browser', 'holds the SAS URL');
      node(g, 'leak', 230, 220, 180, 52, 'Public forum', 'leaked URL');
      node(g, 'blob', 450, 120, 180, 52, 'Blob storage', 'checks signature');
      node(g, 'rb', 450, 220, 180, 52, 'RBAC on container', 'Storage Blob Data Reader');
      node(g, 'others', 450, 20, 180, 52, 'Other apps', mode === 'ud' ? 'use their own MI' : 'also use key1');
      link(e, 'eK', 'api', 'key'); link(e, 'eE', 'key', 'entra'); hlink(e, 'eC', 'key', 'client'); hlink(e, 'eB', 'client', 'blob');
      link(e, 'eL', 'client', 'leak'); link(e, 'eR', 'blob', 'rb'); link(e, 'eO', 'others', 'blob');
      stat([['signed with', mode === 'ud' ? 'Entra-issued key' : 'account key'], ['revoke by', mode === 'ud' ? 'revoke delegation keys / role' : 'rotating the key']]);
    }
    stage.append(e, g, pkt);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'life') {
      const st = (d, t) => () => stat([['day', d], ['tier', t], ['account', 'LRS (Archive allowed)']]);
      S.push({ ...A.set({ hot: 'ok', eE: '', e2: 'dim', e3: 'dim', eR: 'dim', evt: 'dim' }, { hot: 'invoice-0412.pdf' }), run: st('0', 'Hot'), t: 'Day 0: the invoice is uploaded into the account’s default tier, <b>Hot</b>. It is read a few times in its first weeks, so Hot is right.' });
      S.push({ fly: ['pol', 'hot', 'cool'], ...A.set({ pol: 'hot', hot: '', cool: 'ok', e1: 'ok' }, { hot: 'online · cheap reads', cool: 'invoice-0412.pdf' }), run: st('31', 'Cool'), t: 'Day 31: the rule <code>tierToCool: daysAfterModificationGreaterThan 30</code> matches on the policy’s daily run. Storage gets cheaper; each read gets more expensive.' });
      S.push({ fly: ['cool', 'cold'], ...A.set({ cool: '', cold: 'ok', e2: 'ok', e1: '' }, { cool: 'online · 30-day min', cold: 'invoice-0412.pdf' }), run: st('91', 'Cold'), t: 'Day 91: <code>tierToCold</code> after 90 days. Cold is still <b>online</b>: a read returns immediately, just at a higher per-GB read price.' });
      S.push({ fly: ['cold', 'arc'], ...A.set({ cold: '', arc: 'warn', e3: 'warn', e2: '' }, { cold: 'online · 90-day min', arc: 'invoice-0412.pdf' }), run: st('181', 'Archive'), t: 'Day 181: <code>tierToArchive</code>. Archive is <b>offline</b>: the cheapest storage, but the blob can’t be read until it is rehydrated. (This works only because the account is LRS; ZRS-based accounts don’t offer Archive.)', cls: 'warn' });
      S.push({ fly: ['app', 'arc'], ...A.set({ pol: '', app: 'bad', arc: 'bad' }), run: st('200', 'Archive'), t: 'Day 200: a customer disputes the invoice. <code>GET</code> returns <b>409 BlobArchived</b>. The support agent is stuck.', cls: 'err' });
      S.push({ ...A.set({ app: 'warn', arc: 'warn', eR: 'warn' }, { arc: 'rehydrating…' }), t: 'The app calls <b>Set Blob Tier → Hot</b> (or copies the blob to a new Hot blob). At standard priority this can take up to 15 hours; high priority is faster for small blobs. Leaving Archive on day 200 also triggers an <b>early-deletion charge</b> for the rest of the 180 days.', cls: 'warn' });
      S.push({ fly: ['arc', 'hot'], ms: 1400, ...A.set({ arc: '', hot: 'ok', eR: 'ok', evt: 'ok', e3: '' }, { arc: 'offline · 180-day min', hot: 'invoice-0412.pdf' }), run: st('200 + hours', 'Hot'), t: 'Rehydration completes and Event Grid raises <code>BlobTierChanged</code>. A function notifies support. The lesson: archive only data that can wait hours, and design the “bring it back” path before you need it.', cls: 'ok' });
      S.push({ fly: ['evt', 'app'], ...A.set({ app: 'ok' }), t: 'The rule will tier the blob down again from its new modification date. Use <code>daysAfterLastAccessTimeGreaterThan</code> (with access tracking enabled) if you’d rather tier on real reads than on age.', cls: 'ok' });
      return S;
    }
    if (mode === 'key') {
      S.push({ fly: ['api', 'key'], ...A.set({ api: 'hot', key: 'warn', eK: 'hot', entra: 'dim', eE: 'dim', rb: 'dim', eR: 'dim' }), t: 'The backend builds a SAS string (permissions <code>sp=r</code>, expiry <code>se</code>, resource) and signs it with <b>HMAC-SHA256 using the account key</b>. Azure keeps no record that this token exists.', cls: 'warn' });
      S.push({ fly: ['key', 'client'], ...A.set({ client: 'hot', eC: 'hot' }), t: 'The signed URL goes to the partner. Anyone holding the URL has the access it describes, until it expires.' });
      S.push({ fly: ['client', 'blob'], ...A.set({ blob: 'ok', eB: 'ok', client: 'ok' }), t: 'Storage recomputes the HMAC with its copy of the key. The signatures match and the time window is valid, so the read succeeds. No identity is involved, so RBAC is never checked.', cls: 'ok' });
      S.push({ fly: ['client', 'leak'], ...A.set({ leak: 'bad', eL: 'bad' }), t: 'The URL gets pasted into a public forum. It is valid for months.', cls: 'err' });
      S.push({ ...A.set({ key: 'bad', others: 'bad', eO: 'bad' }, { key: 'rotating key1…', others: 'key1 broken!' }), t: 'The only way to revoke it is to <b>rotate key1</b>, which invalidates every SAS signed with it, and breaks every app still using that key in a connection string. (A service SAS tied to a <b>stored access policy</b> could be revoked by deleting the policy instead.)', cls: 'err' });
      S.push({ fly: ['leak', 'blob'], ...A.set({ blob: 'bad', eB: 'bad' }), t: 'After rotation the leaked URL fails with 403. So does everything else signed with key1. This is why you disable shared key access once nothing needs it.', cls: 'warn' });
      return S;
    }
    S.push({ fly: ['api', 'key', 'entra'], ...A.set({ api: 'hot', entra: 'ok', eK: 'hot', eE: 'ok' }), t: 'The backend authenticates with its <b>managed identity</b> and calls <code>Get User Delegation Key</code>. Storage returns a key valid for at most 7 days, bound to that identity.' });
    S.push({ ...A.set({ key: 'ok' }), t: 'The backend signs a SAS with that <b>user delegation key</b>. The token carries the key’s object ID (<code>skoid</code>) and tenant (<code>sktid</code>), so storage knows who delegated it.', cls: 'ok' });
    S.push({ fly: ['key', 'client'], ...A.set({ client: 'hot', eC: 'hot' }), t: 'The partner gets a short-lived, blob-scoped URL, for example read-only for 10 minutes.' });
    S.push({ fly: ['client', 'blob', 'rb'], ...A.set({ blob: 'ok', rb: 'ok', eB: 'ok', eR: 'ok', client: 'ok' }), t: 'Storage checks the signature, <b>and</b> that the delegating identity still has a data role that allows the operation. The SAS can never grant more than the identity has.', cls: 'ok' });
    S.push({ fly: ['client', 'leak'], ...A.set({ leak: 'bad', eL: 'bad' }), t: 'The URL leaks anyway.', cls: 'err' });
    S.push({ ...A.set({ key: 'bad', others: 'ok', eO: 'ok' }, { key: 'revoked' }), t: 'Revoke it with <code>az storage account revoke-delegation-keys</code>, or remove the identity’s role. Other apps use <b>their own managed identities</b> and RBAC, so nothing else breaks. With 10-minute expiries the leak may already be harmless.', cls: 'ok' });
    S.push({ fly: ['leak', 'blob'], ...A.set({ blob: 'bad', eB: 'bad' }, { blob: '403' }), t: 'The leaked URL now fails. Service-to-service calls inside Azure skip SAS entirely: they send an Entra token and RBAC decides. SAS is for callers that have no Azure identity.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ life: 'An invoice PDF with a tiering rule. Press Play to fast-forward a year.', key: 'A SAS signed with the account key. Press Play, then leak it.', ud: 'A SAS signed with a user delegation key. Press Play, then leak it.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr, stats);
  const reset = makeStepper(plan, intro, build, 2800);
  reset();
});
