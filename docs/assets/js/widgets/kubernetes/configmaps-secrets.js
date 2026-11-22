/* ConfigMaps & Secrets: one edit, four consumers (env, volume, subPath, Spring configtree) over time; plus base64 vs etcd encryption. */
IA.widget('configmaps-secrets', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8s-cm-style')) {
    document.head.append(el('style', { id: 'w-k8s-cm-style', text: `
.w-cm .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: all .3s; }
.w-cm .bx.hot { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-cm .bx.ok { stroke: var(--ok); stroke-width: 2.5; }
.w-cm .bx.err { stroke: var(--err); stroke-width: 2.5; }
.w-cm .bx.warn { stroke: var(--warn); stroke-width: 2.5; }
.w-cm .ttl { font: 600 13px var(--sans); fill: var(--text); }
.w-cm .sub { font: 500 10.5px var(--mono); fill: var(--text-3); }
.w-cm .val { font: 700 13px var(--mono); }
.w-cm .wire { stroke: var(--border); stroke-width: 1.5; fill: none; stroke-dasharray: 4 4; }
.w-cm .clock { font: 700 15px var(--mono); fill: var(--accent); }
.w-cm .sec { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; margin-top: 12px; }
@media (max-width: 620px) { .w-cm .sec { grid-template-columns: 1fr; } }
.w-cm .sec pre { margin: 0; padding: 10px 12px; font-size: 12px; overflow-x: auto; }
` }));
  }
  const LANES = [
    { id: 'env', t: 'A · envFrom: app-config', how: 'env var, set at container start' },
    { id: 'vol', t: 'B · volume /etc/config', how: 'files via ..data symlink' },
    { id: 'sub', t: 'C · subPath application.yaml', how: 'bind mount of one file' },
    { id: 'spr', t: 'D · Spring configtree (volume)', how: 'file new? app reads at start' }];
  let immutable = false; let gen = 0; let running = false; let k = 0; let steps = []; let speed = 2600;
  let enc = 'none';

  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segImm = seg([[false, 'immutable: false'], [true, 'immutable: true']], immutable, (v) => { immutable = v; reset(); }, 'Immutable');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const W = 760; const H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'ConfigMap and kubelet on the left, four containers consuming it on the right' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const segEnc = seg([['none', 'etcd: no encryption config'], ['kms', 'etcd: KMS v2 encryption']], enc, (v) => { enc = v; renderSecret(); }, 'Encryption at rest');
  const secL = el('div', { class: 'codebox' }); const secR = el('div', { class: 'codebox' });
  root.classList.add('w-cm');
  root.append(el('div', { class: 'w-controls' }, segImm), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr,
    el('h3', { class: 'sub-h', text: 'And a Secret: what is actually protected?', style: { fontSize: '14px', margin: '14px 0 6px' } }), el('div', { class: 'w-controls' }, segEnc), el('div', { class: 'sec' }, secL, secR));
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };

  let layer;
  const LX = 330; const LW = 410; const LY = (i) => 16 + i * 78; const LH = 64;
  const box = (x, y, w, h, cls) => svg('rect', { class: 'bx ' + (cls || ''), x, y, width: w, height: h, rx: 10 });
  const txt = (x, y, t, cls, a, fill) => svg('text', { x, y, class: cls || 'ttl', 'text-anchor': a || 'start', fill, text: t });
  function draw(st) {
    stage.innerHTML = '';
    stage.append(box(16, 16, 230, 96, st.cm), txt(30, 40, `ConfigMap app-config${immutable ? ' 🔒' : ''}`), txt(30, 62, `resourceVersion ${st.rv}`, 'sub'), txt(30, 90, 'FEATURE_X:', 'sub'), txt(110, 91, st.cmv, 'val', 'start', st.cmv === 'on' ? 'var(--ok)' : 'var(--text-2)'));
    stage.append(box(16, 150, 230, 96, st.kl), txt(30, 174, 'kubelet (node-1)'), txt(30, 196, 'syncFrequency 1m (default)', 'sub'), txt(30, 214, st.klNote || 'watch-based cache', 'sub'));
    stage.append(svg('path', { class: 'wire', d: 'M131 112 L131 150' }));
    stage.append(txt(30, 290, st.t, 'clock'), txt(30, 310, 'time since kubectl apply', 'sub'));
    LANES.forEach((l, i) => {
      const y = LY(i); const v = st.lanes[l.id];
      stage.append(svg('path', { class: 'wire', d: `M246 198 C 290 198, 290 ${y + LH / 2}, ${LX} ${y + LH / 2}` }));
      stage.append(box(LX, y, LW, LH, v.cls), txt(LX + 12, y + 22, l.t), txt(LX + 12, y + 42, v.note || l.how, 'sub'),
        txt(LX + LW - 14, y + 30, v.v, 'val', 'end', v.v === 'on' ? 'var(--ok)' : 'var(--text-2)'), txt(LX + LW - 14, y + 48, 'app sees', 'sub', 'end'));
    });
    layer = svg('g'); stage.append(layer);
  }
  function fly(from, to, color) {
    return new Promise((res) => {
      const c = color || 'var(--accent)';
      const dot = svg('circle', { r: 6, fill: c, class: 'packet', style: `color:${c}` }); layer.append(dot);
      if (reduced) { dot.setAttribute('cx', to.x); dot.setAttribute('cy', to.y); res(); return; }
      const dur = Math.min(1200, speed * 0.4); const t0 = performance.now();
      const tick = (t) => { const r = Math.min(1, (t - t0) / dur); dot.setAttribute('cx', from.x + (to.x - from.x) * r); dot.setAttribute('cy', from.y + (to.y - from.y) * r); if (r < 1) requestAnimationFrame(tick); else res(); };
      requestAnimationFrame(tick);
    });
  }
  const lane = (v, cls, note) => ({ v, cls: cls || '', note });
  function plan() {
    const off = () => ({ env: lane('off'), vol: lane('off'), sub: lane('off'), spr: lane('off') });
    const S = [];
    const base = { cm: '', kl: '', cmv: 'off', rv: 41870, t: 't = 0 s', lanes: off() };
    S.push({ st: Object.assign({}, base, { cm: 'hot' }), fly: [{ x: 131, y: 0 }, { x: 131, y: 40 }], say: '<code>kubectl apply</code> sets <code>FEATURE_X: "on"</code>.' });
    if (immutable) {
      S.push({ st: Object.assign({}, base, { cm: 'err' }), say: 'Rejected: the API server refuses changes to <code>data</code> of an immutable ConfigMap (<i>field is immutable</i>). The only ways forward are delete-and-recreate or, better, a <b>new name</b>.', tone: 'err' });
      S.push({ st: Object.assign({}, base, { cm: 'hot', cmv: 'on', rv: 'new', t: 't = 0 s', lanes: off(), klNote: 'immutable: no watch needed' }), say: 'Create <code>app-config-v2</code> and point the Deployment at it. Because the pod template changed, this <b>is</b> a rolling update: readiness-gated, with rollback. The kubelet never has to watch immutable objects, which saves API server load at scale.' });
      const on = { env: lane('on', 'ok', 'new pod, new env'), vol: lane('on', 'ok', 'new pod'), sub: lane('on', 'ok', 'new pod'), spr: lane('on', 'ok', 'new pod, read at start') };
      S.push({ st: Object.assign({}, base, { cm: 'ok', cmv: 'on', rv: 'new', t: 't ≈ rollout', lanes: on, klNote: 'immutable: no watch needed' }), say: 'All four consumers switch together, replica by replica, at a moment you chose. That is why versioned, immutable config (Kustomize adds a hash suffix automatically) is the calm option.', tone: 'ok' });
      return S;
    }
    const s1 = Object.assign({}, base, { cm: 'ok', cmv: 'on', rv: 41923 });
    S.push({ st: Object.assign({}, s1, { kl: 'hot', klNote: 'cache updated via watch' }), fly: [{ x: 131, y: 112 }, { x: 131, y: 150 }], say: 'Stored in etcd with a new <code>resourceVersion</code>. The kubelet’s cache hears about it through its watch quickly, but it only rewrites a pod’s volumes when it next <b>syncs</b> that pod. Running containers have seen nothing yet.' });
    const t2 = { env: lane('off', 'warn', 'snapshot from start, never updates'), vol: lane('off', '', 'waiting for the next pod sync'), sub: lane('off', '', 'bound to the original file'), spr: lane('off', '', 'waiting for the next pod sync') };
    S.push({ st: Object.assign({}, s1, { t: 't = 20 s', lanes: t2 }), say: 'Lane A will never change: env vars are resolved once, when the container is created. Lanes B and D are waiting for the kubelet’s periodic sync (up to the sync period plus the cache delay).' });
    const t3 = { env: lane('off', 'warn', 'snapshot from start, never updates'), vol: lane('on', 'ok', '..data → ..2026_11_22_09_15 (atomic swap)'), sub: lane('off', 'warn', 'subPath: never sees the swap'), spr: lane('off', 'warn', 'file says on, @Value still off') };
    S.push({ st: Object.assign({}, s1, { t: 't ≈ 60–90 s', kl: 'hot', klNote: 'pod sync: re-project volumes', lanes: t3 }), flyMany: [1, 3], say: 'The kubelet writes a new timestamped directory and swaps the <code>..data</code> symlink <b>atomically</b>. B sees <code>on</code>. D’s file is new too, but Spring bound the value at start-up, so the app still says <code>off</code>. C’s subPath bind mount points at the old file forever.', tone: 'warn' });
    S.push({ st: Object.assign({}, s1, { t: 't ≈ 60–90 s', lanes: t3 }), say: 'Result: one edit, four answers. Lanes A, C and D need a <b>restart</b> (or, for D, a Spring Cloud refresh with <code>@RefreshScope</code>). Replicas that happen to crash-restart pick it up early, so the fleet drifts.' });
    const on = { env: lane('on', 'ok', 'new container, new env'), vol: lane('on', 'ok', 'new pod'), sub: lane('on', 'ok', 'new pod, fresh bind mount'), spr: lane('on', 'ok', 'read at start') };
    S.push({ st: Object.assign({}, s1, { t: 'rollout restart', lanes: on }), say: '<code>kubectl rollout restart</code> (or a checksum annotation, or Reloader) replaces the pods. Every lane now agrees, and the switch went through readiness gates.', tone: 'ok' });
    return S;
  }
  function renderSecret() {
    secL.innerHTML = ''; secR.innerHTML = '';
    secL.append(el('div', { class: 'ch', text: 'kubectl get secret db -o yaml (any reader of Secrets)' }), el('pre', { html: IA.highlight('apiVersion: v1\nkind: Secret\nmetadata: { name: db, namespace: shop }\ntype: Opaque\ndata:\n  password: aHVudGVyMg==\n# $ echo aHVudGVyMg== | base64 -d\n# hunter2', 'yaml') }));
    secR.append(el('div', { class: 'ch', text: 'etcdctl get /registry/secrets/shop/db (disk, backups)' }), el('pre', { html: IA.highlight(enc === 'none'
      ? '/registry/secrets/shop/db\nk8s·v1·Secret·db·shop ...\npassword·hunter2   ← plaintext in etcd\n# anyone with an etcd snapshot reads it'
      : '/registry/secrets/shop/db\nk8s:enc:kms:v2:shop-kms:\n·x9§ó£Ø... (ciphertext)\n# data key wrapped by an external KMS key\n# API readers still get the plain value!', 'text') }),
    el('div', { class: 'note', html: enc === 'none' ? 'Without an <code>EncryptionConfiguration</code>, the API server writes Secrets to etcd as-is. base64 only exists in the API/YAML representation.' : 'Encryption at rest protects etcd files and backups. It does nothing against users with <code>get secrets</code> or anyone who can create a pod that mounts it.' }));
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan(); bStep.disabled = false;
    draw({ cm: '', kl: '', cmv: 'off', rv: 41870, t: 't = 0 s', lanes: { env: lane('off'), vol: lane('off'), sub: lane('off'), spr: lane('off') } });
    say(immutable ? 'This ConfigMap is <code>immutable: true</code>. Press Play to try editing it.' : 'All four containers start with <code>FEATURE_X=off</code>. Press Play to edit the ConfigMap.');
  }
  async function step() {
    if (k >= steps.length) return false;
    const s = steps[k++]; const g = gen;
    draw(s.st); say(s.say, s.tone);
    if (s.fly) await fly(s.fly[0], s.fly[1]);
    if (s.flyMany) await Promise.all(s.flyMany.map((i) => fly({ x: 246, y: 198 }, { x: LX, y: LY(i) + LH / 2 }, 'var(--ok)')));
    if (g !== gen) return false;
    if (k >= steps.length) bStep.disabled = true;
    return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && k < steps.length) await step(); }
    else while (running && g === gen && await step()) { if (k < steps.length) await sleep(speed * 0.6); }
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  renderSecret(); reset();
});
