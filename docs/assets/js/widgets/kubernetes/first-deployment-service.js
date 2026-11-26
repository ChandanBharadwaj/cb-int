/* first-deployment-service: beginner step-through diagram (Play / Step / Reset, scenarios). */
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
 "aria": "Deployment, ReplicaSet, Pods and a Service",
 "vb": [
  720,
  320
 ],
 "intro": "Press <b>Play</b> to deploy a Spring Boot app, scale it, expose it and reach it from your laptop.",
 "hide0": [
  "p2",
  "p3",
  "svc",
  "pf"
 ],
 "nodes": {
  "dep": [
   16,
   20,
   170,
   56,
   "Deployment",
   "orders · replicas 1"
  ],
  "rs": [
   16,
   130,
   170,
   56,
   "ReplicaSet",
   "orders-7d9f"
  ],
  "p1": [
   250,
   40,
   150,
   56,
   "Pod 1",
   "10.244.0.5"
  ],
  "p2": [
   250,
   130,
   150,
   56,
   "Pod 2",
   "10.244.0.6"
  ],
  "p3": [
   250,
   220,
   150,
   56,
   "Pod 3",
   "10.244.0.7"
  ],
  "svc": [
   470,
   120,
   140,
   66,
   "Service",
   "orders:80 → 8080"
  ],
  "pf": [
   470,
   250,
   230,
   54,
   "your laptop",
   "localhost:8080"
  ],
  "cl": [
   600,
   20,
   110,
   56,
   "other pod",
   "curl orders"
  ]
 },
 "edges": [
  [
   "a",
   "dep",
   "rs",
   "owns"
  ],
  [
   "b1",
   "rs",
   "p1",
   ""
  ],
  [
   "b2",
   "rs",
   "p2",
   ""
  ],
  [
   "b3",
   "rs",
   "p3",
   ""
  ],
  [
   "s1",
   "svc",
   "p1",
   ""
  ],
  [
   "s2",
   "svc",
   "p2",
   ""
  ],
  [
   "s3",
   "svc",
   "p3",
   ""
  ],
  [
   "f",
   "pf",
   "svc",
   "port-forward"
  ],
  [
   "c",
   "cl",
   "svc",
   "DNS"
  ]
 ],
 "scenes": {
  "main": {
   "label": "Deploy → scale → expose",
   "steps": [
    {
     "on": [
      "dep"
     ],
     "hide": [
      "rs",
      "p1",
      "p2",
      "p3",
      "svc",
      "pf",
      "cl"
     ],
     "cap": "<code>kubectl apply -f deployment.yaml</code> stores a <b>Deployment</b>: “I want 1 copy of <code>orders:1.0</code>”."
    },
    {
     "on": [
      "dep",
      "rs"
     ],
     "e": [
      "a"
     ],
     "hide": [
      "p1",
      "p2",
      "p3",
      "svc",
      "pf",
      "cl"
     ],
     "cap": "The Deployment controller creates a <b>ReplicaSet</b> for this version of the pod template."
    },
    {
     "on": [
      "p1"
     ],
     "e": [
      "b1"
     ],
     "hide": [
      "p2",
      "p3",
      "svc",
      "pf",
      "cl"
     ],
     "lab": {
      "p1": "Running · Ready"
     },
     "cap": "The ReplicaSet creates a <b>Pod</b>. It is scheduled to a node and the container starts. Its IP is real, but it changes whenever the pod is replaced."
    },
    {
     "ok": [
      "p1",
      "p2",
      "p3"
     ],
     "e": [
      "b1",
      "b2",
      "b3"
     ],
     "hide": [
      "svc",
      "pf",
      "cl"
     ],
     "lab": {
      "dep": "orders · replicas 3"
     },
     "cap": "<code>kubectl scale deploy/orders --replicas=3</code> (or edit <code>replicas</code> and re-apply). Two more pods appear, each with its own IP."
    },
    {
     "on": [
      "svc"
     ],
     "ok": [
      "p1",
      "p2",
      "p3"
     ],
     "e": [
      "s1",
      "s2",
      "s3"
     ],
     "hide": [
      "pf",
      "cl"
     ],
     "cap": "A <b>Service</b> gives the set one stable name and virtual IP. It selects pods by label <code>app=orders</code> and spreads connections across them."
    },
    {
     "on": [
      "cl",
      "svc"
     ],
     "e": [
      "c",
      "s2"
     ],
     "hide": [
      "pf"
     ],
     "cap": "Other pods call <code>http://orders</code> (DNS). They never need a pod IP."
    },
    {
     "bad": [
      "p2"
     ],
     "ok": [
      "p1",
      "p3"
     ],
     "e": [
      "s1",
      "s3"
     ],
     "eb": [
      "s2"
     ],
     "hide": [
      "pf"
     ],
     "lab": {
      "p2": "deleted"
     },
     "tone": "err",
     "cap": "Delete Pod 2 (or let it crash). The Service drops it from its endpoints right away…"
    },
    {
     "ok": [
      "p1",
      "p2",
      "p3"
     ],
     "e": [
      "b2",
      "s1",
      "s2",
      "s3"
     ],
     "hide": [
      "pf"
     ],
     "lab": {
      "p2": "10.244.0.9 (new)"
     },
     "tone": "ok",
     "cap": "…and the ReplicaSet sees 2 ≠ 3 and creates a replacement, with a <b>new name and IP</b>. Callers never noticed."
    },
    {
     "on": [
      "pf",
      "svc"
     ],
     "e": [
      "f",
      "s1"
     ],
     "cap": "From your laptop: <code>kubectl port-forward svc/orders 8080:80</code>, then open <code>localhost:8080</code>. It tunnels through the API server to <b>one</b> pod: a dev tool, not load balancing."
    }
   ]
  }
 }
};
IA.widget('first-deployment-service', (root, ctx) => k8bFlow(root, ctx, SPEC));
})();
