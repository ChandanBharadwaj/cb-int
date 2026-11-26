/* configmaps-secrets-basics: beginner step-through diagram (Play / Step / Reset, scenarios). */
(() => {
/* generic step-through box-and-arrow stepper; inlined into each widget */
function k8bFlow(root, ctx, S) {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8b-style')) {
    document.head.append(el('style', { id: 'w-k8b-style', text: `
.k8b svg text { font-family: var(--sans); }
.k8b .nb { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.5; transition: fill .3s, stroke .3s, opacity .3s; }
.k8b .g-dim { opacity: .38; }
.k8b .g-on .nb { fill: color-mix(in srgb, var(--accent) 20%, var(--surface)); stroke: var(--accent); stroke-width: 2.2; }
.k8b .g-ok .nb { fill: color-mix(in srgb, var(--ok) 22%, var(--surface)); stroke: var(--ok); stroke-width: 2.2; }
.k8b .g-bad .nb { fill: color-mix(in srgb, var(--err) 20%, var(--surface)); stroke: var(--err); stroke-width: 2.2; }
.k8b .g-warn .nb { fill: color-mix(in srgb, var(--warn) 22%, var(--surface)); stroke: var(--warn); stroke-width: 2.2; }
.k8b .nl { fill: var(--text); font-size: 12.5px; font-weight: 650; }
.k8b .ns { fill: var(--text-2); font-size: 10.5px; font-family: var(--mono); }
.k8b .zone { fill: none; stroke: var(--text-3); stroke-dasharray: 5 4; }
.k8b .zl { fill: var(--text-3); font-size: 11px; font-weight: 600; }
.k8b .ed { stroke: var(--edge); stroke-width: 1.5; fill: none; opacity: .35; }
.k8b .ed.on { stroke: var(--edge-active); stroke-width: 2.4; opacity: 1; stroke-dasharray: 6 4; animation: k8bdash 1s linear infinite; }
.k8b .ed.bad { stroke: var(--err); stroke-width: 2.4; opacity: 1; }
.k8b .el { fill: var(--text-2); font-size: 10.5px; font-family: var(--mono); }
.k8b .el.on { fill: var(--text); font-weight: 600; }
@keyframes k8bdash { to { stroke-dashoffset: -20; } }
@media (prefers-reduced-motion: reduce) { .k8b .ed.on { animation: none; } }
` }));
  }
  const [VW, VH] = S.vb;
  const names = Object.keys(S.scenes);
  let sc = names[0], k = -1, gen = 0, running = false;
  const seg = el('div', { class: 'seg' });
  const segBtns = names.map((n) => { const b = el('button', { text: S.scenes[n].label }); b.addEventListener('click', () => { sc = n; reset(); }); seg.append(b); return [n, b]; });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ▸' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: `0 0 ${VW} ${VH}`, width: '100%', role: 'img', 'aria-label': S.aria || 'diagram' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stat = el('div', { class: 'tiny', style: { marginTop: '6px', color: 'var(--text-3)' } });
  root.classList.add('k8b');
  root.append(el('div', { class: 'w-controls' }, names.length > 1 ? seg : null, bPlay, bStep, bReset), stage, stat, narr);
  const defs = svg('defs', null,
    svg('marker', { id: 'k8b-ar', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--edge-active)' })));
  const clip = (b, tx, ty) => { const [x, y, w, h] = b; const cx = x + w / 2, cy = y + h / 2; const dx = tx - cx, dy = ty - cy;
    const s = 1 / Math.max(Math.abs(dx) / (w / 2 + 4) || 0, Math.abs(dy) / (h / 2 + 4) || 0, 1e-9); return [cx + dx * Math.min(s, 1), cy + dy * Math.min(s, 1)]; };
  function draw() {
    const steps = S.scenes[sc].steps; const st = k >= 0 ? steps[k] : null;
    const on = new Set(st ? st.on || [] : []), ok = new Set(st ? st.ok || [] : []), bad = new Set(st ? st.bad || [] : []), warn = new Set(st ? st.warn || [] : []);
    const hide = new Set(st ? st.hide || [] : S.hide0 || []);
    const eon = new Set(st ? st.e || [] : []), ebad = new Set(st ? st.eb || [] : []);
    const lab = Object.assign({}, S.labels0 || {}); steps.slice(0, k + 1).forEach((s) => Object.assign(lab, s.lab || {}));
    stage.innerHTML = ''; stage.append(defs);
    (S.zones || []).forEach(([x, y, w, h, t]) => stage.append(svg('rect', { class: 'zone', x, y, width: w, height: h, rx: 12 }), svg('text', { class: 'zl', x: x + 10, y: y + 16, text: t })));
    (S.edges || []).forEach(([id, a, b, t]) => { if (hide.has(a) || hide.has(b)) return; const A = S.nodes[a], B = S.nodes[b];
      const [x1, y1] = clip(A, B[0] + B[2] / 2, B[1] + B[3] / 2); const [x2, y2] = clip(B, A[0] + A[2] / 2, A[1] + A[3] / 2);
      const c = eon.has(id) ? 'ed on' : ebad.has(id) ? 'ed bad' : 'ed';
      stage.append(svg('line', { class: c, x1, y1, x2, y2, 'marker-end': c !== 'ed' ? 'url(#k8b-ar)' : null }));
      const tt = lab['e:' + id] != null ? lab['e:' + id] : t;
      if (tt) stage.append(svg('text', { class: 'el' + (c !== 'ed' ? ' on' : ''), x: (x1 + x2) / 2 + 5, y: (y1 + y2) / 2 - 5, text: tt })); });
    Object.entries(S.nodes).forEach(([id, [x, y, w, h, t, s]]) => { if (hide.has(id)) return;
      const cls = ok.has(id) ? 'g-ok' : bad.has(id) ? 'g-bad' : warn.has(id) ? 'g-warn' : on.has(id) ? 'g-on' : (st && st.dimRest ? 'g-dim' : '');
      const sub = lab[id] != null ? lab[id] : s;
      stage.append(svg('g', { class: cls }, svg('rect', { class: 'nb', x, y, width: w, height: h, rx: 9 }),
        svg('text', { class: 'nl', x: x + w / 2, y: y + (sub ? h / 2 - 3 : h / 2 + 4), 'text-anchor': 'middle', text: lab['t:' + id] || t }),
        sub ? svg('text', { class: 'ns', x: x + w / 2, y: y + h / 2 + 13, 'text-anchor': 'middle', text: sub }) : null)); });
    stat.textContent = `${S.scenes[sc].label} · step ${Math.max(0, k + 1)} / ${steps.length}`;
    narr.innerHTML = '';
    if (st) narr.append(el('span', { class: 'n', text: String(k + 1) }));
    narr.append(el('div', { class: 't', html: st ? st.cap : (S.scenes[sc].intro || S.intro) }));
    narr.className = 'caption' + (st && st.tone ? ' ' + st.tone : '');
    bStep.disabled = k >= steps.length - 1;
    segBtns.forEach(([n, b]) => b.classList.toggle('on', n === sc));
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = -1; draw(); }
  function step() { if (k >= S.scenes[sc].steps.length - 1) return false; k++; draw(); return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= S.scenes[sc].steps.length - 1) reset();
    if (reduced) { k = S.scenes[sc].steps.length - 1; draw(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(S.speed || 2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
}

const SPEC = {
 "aria": "ConfigMap and Secret consumed as env vars or files",
 "vb": [
  720,
  310
 ],
 "intro": "Pick a scenario and press <b>Play</b>. Watch config travel from objects into the Spring Boot container.",
 "nodes": {
  "cm": [
   16,
   30,
   190,
   64,
   "ConfigMap app-config",
   "LOG_LEVEL=INFO"
  ],
  "sec": [
   16,
   190,
   190,
   64,
   "Secret db-cred",
   "password: czNjcjN0"
  ],
  "env": [
   270,
   30,
   180,
   64,
   "env vars",
   "set at start"
  ],
  "vol": [
   270,
   190,
   180,
   64,
   "files",
   "/etc/config/…"
  ],
  "app": [
   520,
   100,
   186,
   90,
   "Spring Boot",
   "container"
  ],
  "dec": [
   270,
   116,
   180,
   48,
   "base64 -d",
   "s3cr3t"
  ]
 },
 "edges": [
  [
   "a",
   "cm",
   "env",
   "envFrom"
  ],
  [
   "b",
   "sec",
   "env",
   "secretKeyRef"
  ],
  [
   "c",
   "cm",
   "vol",
   "volume"
  ],
  [
   "d",
   "sec",
   "vol",
   "volume"
  ],
  [
   "e",
   "env",
   "app",
   "System.getenv"
  ],
  [
   "f",
   "vol",
   "app",
   "read file"
  ]
 ],
 "hide0": [
  "dec"
 ],
 "scenes": {
  "env": {
   "label": "As env vars",
   "steps": [
    {
     "on": [
      "cm"
     ],
     "hide": [
      "dec"
     ],
     "cap": "A <b>ConfigMap</b> holds plain key/value settings, kept outside the image so one image runs in dev and prod."
    },
    {
     "on": [
      "cm",
      "env"
     ],
     "e": [
      "a"
     ],
     "hide": [
      "dec"
     ],
     "cap": "<code>envFrom: configMapRef</code> turns every key into an environment variable. Spring Boot maps <code>LOGGING_LEVEL_ROOT</code> to <code>logging.level.root</code>."
    },
    {
     "on": [
      "sec",
      "env"
     ],
     "e": [
      "b"
     ],
     "hide": [
      "dec"
     ],
     "lab": {
      "env": "SPRING_DATASOURCE_PASSWORD"
     },
     "cap": "A <b>Secret</b> value is injected the same way, with <code>valueFrom.secretKeyRef</code>. The container sees the <b>decoded</b> value."
    },
    {
     "ok": [
      "app"
     ],
     "e": [
      "e"
     ],
     "hide": [
      "dec"
     ],
     "lab": {
      "app": "started with env"
     },
     "cap": "Env vars are read <b>once</b>, when the container starts."
    },
    {
     "warn": [
      "cm",
      "app"
     ],
     "hide": [
      "dec"
     ],
     "lab": {
      "cm": "LOG_LEVEL=DEBUG (edited)",
      "app": "still INFO"
     },
     "tone": "warn",
     "cap": "Edit the ConfigMap and… nothing. Running containers keep their old env. Restart them: <code>kubectl rollout restart deploy/orders</code>."
    }
   ]
  },
  "files": {
   "label": "As mounted files",
   "steps": [
    {
     "on": [
      "cm",
      "vol"
     ],
     "e": [
      "c"
     ],
     "hide": [
      "dec"
     ],
     "lab": {
      "vol": "/etc/config/application.yaml"
     },
     "cap": "Mount the ConfigMap as a <b>volume</b>: each key becomes a file. A whole <code>application.yaml</code> can be one key."
    },
    {
     "on": [
      "sec",
      "vol"
     ],
     "e": [
      "d"
     ],
     "hide": [
      "dec"
     ],
     "lab": {
      "vol": "/etc/secrets/password"
     },
     "cap": "Secrets mount the same way. Files can be read again later, and are kept off the process environment."
    },
    {
     "ok": [
      "app"
     ],
     "e": [
      "f"
     ],
     "hide": [
      "dec"
     ],
     "cap": "Point Spring at them: <code>SPRING_CONFIG_IMPORT=optional:configtree:/etc/secrets/</code> or <code>spring.config.additional-location</code>."
    },
    {
     "warn": [
      "vol"
     ],
     "hide": [
      "dec"
     ],
     "lab": {
      "cm": "edited",
      "vol": "updated ~1 min later"
     },
     "cap": "Edit the ConfigMap: mounted files <b>do</b> update, after a delay (kubelet sync). Exception: a <code>subPath</code> mount never updates. Your app still has to re-read the file."
    }
   ]
  },
  "b64": {
   "label": "base64 ≠ encryption",
   "steps": [
    {
     "on": [
      "sec"
     ],
     "cap": "This is how a Secret looks in <code>kubectl get secret db-cred -o yaml</code>. The value looks scrambled…"
    },
    {
     "bad": [
      "sec",
      "dec"
     ],
     "lab": {
      "dec": "s3cr3t"
     },
     "tone": "err",
     "cap": "…but it is only <b>base64</b>. <code>echo czNjcjN0 | base64 -d</code> prints <code>s3cr3t</code>. Anyone who can read the Secret can read the password."
    },
    {
     "ok": [
      "sec"
     ],
     "lab": {
      "sec": "RBAC + encryption at rest"
     },
     "tone": "ok",
     "cap": "Real protection: restrict <code>get secrets</code> with RBAC, turn on encryption at rest for etcd, never commit Secret YAML to Git. See <a href=\"configmaps-secrets.html\">ConfigMaps & Secrets</a> for external secret stores."
    }
   ]
  }
 }
};
IA.widget('configmaps-secrets-basics', (root, ctx) => k8bFlow(root, ctx, SPEC));
})();
