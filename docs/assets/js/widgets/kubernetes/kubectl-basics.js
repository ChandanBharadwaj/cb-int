/* kubectl-basics: beginner step-through diagram (Play / Step / Reset, scenarios). */
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
 "aria": "kubectl request path",
 "vb": [
  720,
  300
 ],
 "intro": "Pick a command family and press <b>Play</b>. Watch which components each kubectl command actually touches.",
 "nodes": {
  "you": [
   16,
   120,
   130,
   60,
   "kubectl",
   "your terminal"
  ],
  "api": [
   200,
   120,
   150,
   60,
   "API server",
   "the only door"
  ],
  "etcd": [
   200,
   230,
   150,
   54,
   "etcd",
   "stored objects"
  ],
  "ctrl": [
   200,
   16,
   150,
   54,
   "controllers",
   "make it so"
  ],
  "kl": [
   410,
   120,
   130,
   60,
   "kubelet",
   "on the node"
  ],
  "pod": [
   580,
   110,
   126,
   80,
   "Pod orders-7d…",
   "Spring Boot"
  ]
 },
 "edges": [
  [
   "a",
   "you",
   "api",
   "HTTPS"
  ],
  [
   "b",
   "api",
   "etcd",
   ""
  ],
  [
   "c",
   "api",
   "ctrl",
   "watch"
  ],
  [
   "d",
   "api",
   "kl",
   ""
  ],
  [
   "f",
   "kl",
   "pod",
   ""
  ]
 ],
 "scenes": {
  "read": {
   "label": "get / describe",
   "steps": [
    {
     "on": [
      "you",
      "api"
     ],
     "e": [
      "a"
     ],
     "lab": {
      "you": "kubectl get pods"
     },
     "cap": "<code>kubectl get pods</code> is just an HTTPS GET to the API server, for the namespace in your context (often <code>default</code>)."
    },
    {
     "on": [
      "api",
      "etcd"
     ],
     "e": [
      "a",
      "b"
     ],
     "cap": "The API server reads the stored objects (from etcd, or its watch cache) and returns them. kubectl prints a short table."
    },
    {
     "on": [
      "you"
     ],
     "lab": {
      "you": "-o yaml / -o wide"
     },
     "cap": "<code>-o wide</code> adds node and IP columns. <code>-o yaml</code> prints the <b>whole object</b>, including the server-filled <code>status</code>."
    },
    {
     "on": [
      "you",
      "api"
     ],
     "e": [
      "a"
     ],
     "lab": {
      "you": "kubectl describe pod"
     },
     "cap": "<code>describe</code> combines the object with its recent <b>Events</b> (“Pulled image”, “Back-off restarting”). It is the first thing to run when a pod looks wrong."
    }
   ]
  },
  "node": {
   "label": "logs / exec",
   "steps": [
    {
     "on": [
      "you",
      "api"
     ],
     "e": [
      "a"
     ],
     "lab": {
      "you": "kubectl logs pod/…"
     },
     "cap": "<code>kubectl logs</code> goes to the API server too…"
    },
    {
     "on": [
      "api",
      "kl",
      "pod"
     ],
     "e": [
      "a",
      "d",
      "f"
     ],
     "cap": "…which proxies to the <b>kubelet</b> on that pod’s node. The kubelet reads the container’s stdout/stderr. That’s why Spring Boot should log to the console, not a file."
    },
    {
     "on": [
      "pod"
     ],
     "warn": [
      "pod"
     ],
     "lab": {
      "you": "logs --previous",
      "pod": "restarted 3×"
     },
     "cap": "After a crash, <code>--previous</code> shows the logs of the <b>last dead</b> container, where the stack trace is."
    },
    {
     "ok": [
      "pod"
     ],
     "e": [
      "a",
      "d",
      "f"
     ],
     "lab": {
      "you": "exec -it … -- sh",
      "pod": "shell inside"
     },
     "tone": "ok",
     "cap": "<code>kubectl exec -it pod/x -- sh</code> runs a new process inside the running container. Good for a look around; never for fixing things by hand."
    }
   ]
  },
  "write": {
   "label": "apply vs create",
   "steps": [
    {
     "on": [
      "you",
      "api"
     ],
     "e": [
      "a"
     ],
     "lab": {
      "you": "create -f app.yaml"
     },
     "cap": "<code>kubectl create -f</code> says “make this new object”. Run it twice and the second time fails with <b>AlreadyExists</b>."
    },
    {
     "on": [
      "you",
      "api",
      "etcd"
     ],
     "e": [
      "a",
      "b"
     ],
     "lab": {
      "you": "apply -f app.yaml"
     },
     "cap": "<code>kubectl apply -f</code> says “make it look like this file”: it creates the object if missing and patches it if not. Run it 100 times and you get the same result."
    },
    {
     "on": [
      "ctrl"
     ],
     "e": [
      "c"
     ],
     "cap": "Writing the object is all kubectl does. <b>Controllers</b> watch the API server and react: create pods, schedule them…"
    },
    {
     "ok": [
      "kl",
      "pod"
     ],
     "e": [
      "d",
      "f"
     ],
     "tone": "ok",
     "lab": {
      "pod": "Running"
     },
     "cap": "…and the kubelet starts containers. kubectl returned long ago. That is <a href=\"desired-state.html\">desired state</a> in action."
    }
   ]
  }
 }
};
IA.widget('kubectl-basics', (root, ctx) => k8bFlow(root, ctx, SPEC));
})();
