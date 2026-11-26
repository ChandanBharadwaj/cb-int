/* docker-basics: beginner step-through diagram (Play / Step / Reset, scenarios). */
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
 "aria": "Docker build, run and push flow",
 "vb": [
  720,
  300
 ],
 "intro": "Press <b>Play</b> or <b>Step</b> to follow a Spring Boot app from source code to a running container. Switch scenarios above.",
 "zones": [
  [
   8,
   8,
   330,
   284,
   "your laptop (build)"
  ],
  [
   350,
   8,
   362,
   284,
   "anywhere with Docker (run)"
  ]
 ],
 "nodes": {
  "src": [
   24,
   36,
   140,
   54,
   "Spring Boot code",
   "pom.xml + src/"
  ],
  "jar": [
   184,
   36,
   140,
   54,
   "app.jar",
   "mvn package"
  ],
  "df": [
   24,
   130,
   140,
   54,
   "Dockerfile",
   "FROM / COPY / CMD"
  ],
  "img": [
   184,
   130,
   140,
   70,
   "Image",
   "orders:1.0"
  ],
  "reg": [
   380,
   36,
   170,
   54,
   "Registry",
   "ghcr.io/acme/orders"
  ],
  "c1": [
   380,
   150,
   150,
   54,
   "Container A",
   "stopped"
  ],
  "c2": [
   550,
   150,
   150,
   54,
   "Container B",
   "stopped"
  ],
  "host": [
   450,
   236,
   180,
   44,
   "localhost:8080",
   "host port"
  ]
 },
 "edges": [
  [
   "e1",
   "src",
   "jar",
   ""
  ],
  [
   "e2",
   "jar",
   "img",
   "COPY"
  ],
  [
   "e3",
   "df",
   "img",
   "docker build"
  ],
  [
   "e4",
   "img",
   "reg",
   "push"
  ],
  [
   "e5",
   "reg",
   "c1",
   "pull"
  ],
  [
   "e6",
   "img",
   "c1",
   "run"
  ],
  [
   "e7",
   "img",
   "c2",
   "run"
  ],
  [
   "e8",
   "host",
   "c1",
   "-p 8080:8080"
  ]
 ],
 "scenes": {
  "build": {
   "label": "Build & run",
   "steps": [
    {
     "on": [
      "src",
      "jar"
     ],
     "e": [
      "e1"
     ],
     "cap": "<code>./mvnw package</code> turns your code into one runnable fat JAR. So far this is plain Java, with no Docker yet."
    },
    {
     "on": [
      "df"
     ],
     "cap": "A <b>Dockerfile</b> is a recipe: start from a base image that already has a JRE, copy the JAR in, and say which command starts it."
    },
    {
     "on": [
      "img"
     ],
     "e": [
      "e2",
      "e3"
     ],
     "lab": {
      "img": "orders:1.0 · 3 layers"
     },
     "cap": "<code>docker build -t orders:1.0 .</code> runs the recipe. Each instruction adds a read-only <b>layer</b>. The result is an <b>image</b>: a frozen, shareable package. Nothing is running yet."
    },
    {
     "ok": [
      "c1"
     ],
     "on": [
      "img"
     ],
     "e": [
      "e6"
     ],
     "lab": {
      "c1": "running · PID 1 = java"
     },
     "cap": "<code>docker run orders:1.0</code> starts a <b>container</b>: a running process made from the image, with its own filesystem view and network."
    },
    {
     "ok": [
      "c1",
      "c2"
     ],
     "on": [
      "img"
     ],
     "e": [
      "e6",
      "e7"
     ],
     "lab": {
      "c2": "running"
     },
     "cap": "Run it again and you get a <b>second container</b> from the same image. Image is to container what a class is to an object."
    },
    {
     "bad": [
      "host"
     ],
     "ok": [
      "c1"
     ],
     "eb": [
      "e8"
     ],
     "lab": {
      "e:e8": "no -p",
      "host": "connection refused"
     },
     "cap": "Your browser can’t reach it! A container’s port 8080 is <b>not</b> published to your laptop by default."
    },
    {
     "ok": [
      "c1",
      "host"
     ],
     "e": [
      "e8"
     ],
     "lab": {
      "e:e8": "-p 8080:8080",
      "host": "curl works"
     },
     "tone": "ok",
     "cap": "<code>docker run -p 8080:8080 orders:1.0</code> maps <b>host:container</b>. Now <code>curl localhost:8080/actuator/health</code> answers."
    }
   ]
  },
  "ship": {
   "label": "Push & pull",
   "steps": [
    {
     "on": [
      "img"
     ],
     "lab": {
      "img": "orders:1.0 (local only)"
     },
     "cap": "The image exists only in your laptop’s Docker. A Kubernetes cluster can’t see it."
    },
    {
     "on": [
      "img",
      "reg"
     ],
     "e": [
      "e4"
     ],
     "lab": {
      "img": "ghcr.io/acme/orders:1.0"
     },
     "cap": "<code>docker tag</code> gives it a full name (<i>registry/repo:tag</i>), then <code>docker push</code> uploads its layers to a <b>registry</b>."
    },
    {
     "on": [
      "reg"
     ],
     "ok": [
      "c1"
     ],
     "e": [
      "e5"
     ],
     "lab": {
      "c1": "pulled + running"
     },
     "cap": "Any machine (a CI runner, a Kubernetes node) can now <code>docker pull</code> that name and run the exact same bytes."
    },
    {
     "on": [
      "reg"
     ],
     "warn": [
      "c1"
     ],
     "lab": {
      "reg": "only layers that changed"
     },
     "cap": "Change one line of code and rebuild: only the JAR layer changes. Push and pull send just that layer, because the JRE base layer is already there."
    }
   ]
  }
 }
};
IA.widget('docker-basics', (root, ctx) => k8bFlow(root, ctx, SPEC));
})();
