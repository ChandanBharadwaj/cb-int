/* azure-storage-basics: step-through visual for the Azure Basics module. */
IA.widget('azure-storage-basics', (root, ctx) => {
  /* ---- Azure basics step-through kit (same in each azure basics widget) ---- */
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-azb-style')) {
    document.head.append(el('style', { id: 'w-azb-style', text: `
.w-azb .nb rect { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .4s, stroke .4s; }
.w-azb .nb { transition: opacity .45s; }
.w-azb .nb text { fill: var(--text); font-size: 13px; font-family: var(--sans); }
.w-azb .nb text.s { fill: var(--text-3); font-size: 10.5px; font-family: var(--mono); }
.w-azb .nb.hot rect { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-azb .nb.ok rect { stroke: var(--ok); stroke-width: 2.5; fill: color-mix(in srgb, var(--ok) 15%, var(--surface)); }
.w-azb .nb.warn rect { stroke: var(--warn); stroke-width: 2.5; fill: color-mix(in srgb, var(--warn) 16%, var(--surface)); }
.w-azb .nb.bad rect { stroke: var(--err); stroke-width: 2.5; fill: color-mix(in srgb, var(--err) 15%, var(--surface)); }
.w-azb .nb.dim { opacity: .3; }
.w-azb .nb.gone { opacity: .08; }
.w-azb .zn { fill: color-mix(in srgb, var(--surface-2) 70%, transparent); stroke: var(--border); stroke-dasharray: 6 5; transition: stroke .4s, opacity .4s; }
.w-azb .zn.hot { stroke: var(--accent); }
.w-azb .zn.bad { stroke: var(--err); }
.w-azb .zn.dim { opacity: .3; }
.w-azb .zt { fill: var(--text-3); font-size: 11px; font-family: var(--mono); }
.w-azb .eg { stroke: var(--border); stroke-width: 1.6; fill: none; transition: stroke .4s, opacity .4s; }
.w-azb .eg.hot { stroke: var(--accent); stroke-width: 2.6; }
.w-azb .eg.ok { stroke: var(--ok); stroke-width: 2.6; }
.w-azb .eg.bad { stroke: var(--err); stroke-width: 2.6; stroke-dasharray: 6 4; }
.w-azb .eg.dim { opacity: .2; }
.w-azb .pkt { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.w-azb.rm * { transition: none !important; animation: none !important; }
` }));
  }
  root.classList.add('w-azb'); if (reduced) root.classList.add('rm');
  /* spec: { label, W, H, modes: [{ id, name, zones:[[id,x,y,w,h,label]], nodes:[[id,x,y,w,h,title,sub]], edges:[[id,a,b,'v'|'h']], steps:[{ c:{id:cls}, sub:{id:text}, fly:[ids], t:'html', cls }] }] } */
  function scene(spec) {
    let mode = spec.modes[0]; let k = 0; let running = false; let gen = 0; const Z = {};
    const stage = svg('svg', { viewBox: `0 0 ${spec.W} ${spec.H}`, role: 'img', 'aria-label': spec.label });
    const pkt = svg('circle', { r: 7, class: 'pkt', opacity: 0 });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
    const say = (n, h, cls) => { narr.className = 'caption' + (cls ? ' ' + cls : ''); narr.innerHTML = '';
      narr.append(el('div', { class: 'n', text: String(n) }), el('div', { class: 't', html: h })); };
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const prog = el('span', { class: 'tiny' });
    const top = el('div', { class: 'w-controls' });
    if (spec.modes.length > 1) {
      const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': spec.modeLabel || 'Scenario' });
      spec.modes.forEach((m) => { const b = el('button', { text: m.name, class: m === mode ? 'on' : '' });
        b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); mode = m; reset(); }); s.append(b); });
      top.append(s);
    }
    root.append(top, el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, prog), narr);
    const mid = (id) => { const z = Z[id]; return [z.x + z.w / 2, z.y + z.h / 2]; };
    function draw() {
      stage.innerHTML = ''; for (const id in Z) delete Z[id];
      const gz = svg('g'); const ge = svg('g'); const gn = svg('g'); stage.append(gz, ge, gn, pkt);
      (mode.zones || []).forEach(([id, x, y, w, h, t]) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 12 });
        gz.append(r, svg('text', { class: 'zt', x: x + 10, y: y + 16, text: t })); Z[id] = { n: r, base: 'zn', x, y, w, h }; });
      (mode.nodes || []).forEach(([id, x, y, w, h, t, s]) => {
        const n = svg('g', { class: 'nb' }); n.append(svg('rect', { x, y, width: w, height: h, rx: 8 }));
        n.append(svg('text', { x: x + w / 2, y: s != null ? y + h / 2 - 3 : y + h / 2 + 4, 'text-anchor': 'middle', text: t }));
        let se = null; if (s != null) { se = svg('text', { class: 's', x: x + w / 2, y: y + h / 2 + 12, 'text-anchor': 'middle', text: s }); n.append(se); }
        gn.append(n); Z[id] = { n, base: 'nb', sub: se, sub0: s || '', x, y, w, h }; });
      (mode.edges || []).forEach(([id, a, b, dir]) => { const A = Z[a]; const B = Z[b]; let d;
        if (dir === 'h') { const y1 = A.y + A.h / 2; const y2 = B.y + B.h / 2; const [x1, x2] = A.x < B.x ? [A.x + A.w, B.x] : [A.x, B.x + B.w]; const mx = (x1 + x2) / 2; d = `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`; }
        else { const x1 = A.x + A.w / 2; const x2 = B.x + B.w / 2; const [y1, y2] = A.y < B.y ? [A.y + A.h, B.y] : [A.y, B.y + B.h]; const my = (y1 + y2) / 2; d = `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`; }
        const p = svg('path', { class: 'eg', d }); ge.append(p); Z[id] = { n: p, base: 'eg' }; });
    }
    function paint(i) {
      const c = {}; const sub = {};
      for (let j = 0; j <= i; j++) { const s = mode.steps[j]; if (s.reset) { for (const x in c) delete c[x]; } Object.assign(c, s.c || {}); Object.assign(sub, s.sub || {}); }
      for (const id in Z) { const z = Z[id]; z.n.setAttribute('class', z.base + (i >= 0 && c[id] ? ' ' + c[id] : ''));
        if (z.sub) z.sub.textContent = i >= 0 && sub[id] != null ? sub[id] : z.sub0; }
    }
    function fly(ids, ms) {
      const g = gen; const pts = ids.map((p) => mid(p));
      return new Promise((res) => {
        if (reduced || pts.length < 2) return res();
        const L = []; let tot = 0;
        for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
        const t0 = performance.now(); pkt.setAttribute('opacity', 1);
        const tick = (t) => { if (g !== gen) { pkt.setAttribute('opacity', 0); return res(); }
          let f = Math.min(1, (t - t0) / ms) * tot; let i = 0; while (i < L.length - 1 && f > L[i]) { f -= L[i]; i++; }
          const r = L[i] ? Math.min(1, f / L[i]) : 1; const [x1, y1] = pts[i]; const [x2, y2] = pts[i + 1];
          pkt.setAttribute('cx', x1 + (x2 - x1) * r); pkt.setAttribute('cy', y1 + (y2 - y1) * r);
          if (t - t0 < ms) requestAnimationFrame(tick); else { pkt.setAttribute('opacity', 0); res(); } };
        requestAnimationFrame(tick);
      });
    }
    async function apply(i) {
      const s = mode.steps[i]; paint(i); say(i + 1, s.t, s.cls); prog.textContent = `step ${i + 1} / ${mode.steps.length}`;
      if (s.fly) await fly(s.fly, 900);
    }
    function reset() { gen++; running = false; k = 0; bPlay.textContent = '▶ Play'; bStep.disabled = false; draw();
      if (reduced) { paint(mode.steps.length - 1); say('✓', mode.steps[mode.steps.length - 1].t); prog.textContent = 'end state (reduced motion)'; k = mode.steps.length; bStep.disabled = true; return; }
      paint(-1); say('·', mode.intro || 'Press Play, or Step through one stage at a time.'); prog.textContent = `0 / ${mode.steps.length}`; }
    async function step() { if (k >= mode.steps.length) return false; await apply(k++); if (k >= mode.steps.length) bStep.disabled = true; return true; }
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= mode.steps.length) { reset(); if (reduced) return; }
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && await step()) await sleep(2200);
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    reset();
  }
  /* ---- end kit ---- */
  scene({ label: 'A storage account with blob, queue, table and file services; access tiers; SAS flow', W: 760, H: 360, modeLabel: 'View',
    modes: [
      { id: 'svc', name: 'Four services', intro: 'One storage account, four services, four endpoints.',
        zones: [['acct', 230, 20, 510, 320, 'storage account: stordersdev']],
        nodes: [['app', 20, 150, 170, 46, 'Spring app', 'SDK / REST'],
          ['blob', 250, 50, 220, 46, 'Blob', '.blob.core.windows.net'], ['q', 250, 120, 220, 46, 'Queue', '.queue.core.windows.net'],
          ['t', 250, 190, 220, 46, 'Table', '.table.core.windows.net'], ['f', 250, 260, 220, 46, 'Files', '.file.core.windows.net'],
          ['c1', 500, 50, 220, 46, 'container: invoices', 'inv-1001.pdf'], ['c2', 500, 120, 220, 46, 'queue: thumbnails', 'msg ≤ 64 KiB'],
          ['c3', 500, 190, 220, 46, 'table: audit', 'PartitionKey + RowKey'], ['c4', 500, 260, 220, 46, 'share: reports', 'mount over SMB/NFS']],
        edges: [['e1', 'app', 'blob', 'h'], ['e2', 'app', 'q', 'h'], ['e3', 'app', 't', 'h'], ['e4', 'app', 'f', 'h'], ['b1', 'blob', 'c1', 'h'], ['b2', 'q', 'c2', 'h'], ['b3', 't', 'c3', 'h'], ['b4', 'f', 'c4', 'h']],
        steps: [
          { c: { acct: 'hot' }, t: 'A <b>storage account</b> has a globally unique name (3–24 lowercase letters and digits). It becomes part of every URL.' },
          { c: { e1: 'hot', blob: 'ok', b1: 'ok', c1: 'ok' }, fly: ['app', 'blob', 'c1'], t: '<b>Blob</b>: objects (files) inside <i>containers</i>. PDFs, images, backups, exports. The one you will use most.' },
          { c: { e2: 'hot', q: 'ok', b2: 'ok', c2: 'ok' }, fly: ['app', 'q', 'c2'], t: '<b>Queue</b>: simple message queue. Small messages (up to 64 KiB) for background work. For richer messaging use Service Bus.' },
          { c: { e3: 'hot', t: 'ok', b3: 'ok', c3: 'ok' }, fly: ['app', 't', 'c3'], t: '<b>Table</b>: a cheap key-value / NoSQL store addressed by PartitionKey + RowKey. No joins, no SQL.' },
          { c: { e4: 'hot', f: 'ok', b4: 'ok', c4: 'ok' }, fly: ['app', 'f', 'c4'], t: '<b>Files</b>: a managed file share you can mount like a network drive (SMB or NFS).' }
        ] },
      { id: 'tier', name: 'Access tiers', intro: 'A blob moves to cheaper storage as it gets colder.',
        nodes: [['hot', 30, 140, 150, 56, 'Hot', 'read often'], ['cool', 210, 140, 150, 56, 'Cool', 'min 30 days'], ['cold', 390, 140, 150, 56, 'Cold', 'min 90 days'], ['arch', 570, 140, 160, 56, 'Archive', 'offline, min 180 d'], ['rule', 210, 40, 330, 46, 'Lifecycle rule', 'e.g. move after N days'], ['rd', 300, 260, 260, 46, 'Rehydrate', 'hours, not ms']],
        edges: [['e1', 'hot', 'cool', 'h'], ['e2', 'cool', 'cold', 'h'], ['e3', 'cold', 'arch', 'h'], ['e4', 'arch', 'rd', 'v']],
        steps: [
          { c: { hot: 'hot' }, t: 'New invoice PDFs land in <b>Hot</b>: highest storage price, cheapest reads.' },
          { c: { rule: 'ok', e1: 'hot', cool: 'hot' }, fly: ['hot', 'cool'], t: 'A <b>lifecycle rule</b> moves blobs nobody reads to <b>Cool</b>: cheaper to store, more per read. Deleting early still bills the minimum days.' },
          { c: { e2: 'hot', cold: 'hot' }, fly: ['cool', 'cold'], t: '<b>Cold</b>: cheaper again for data read rarely, still online.' },
          { c: { e3: 'hot', arch: 'warn' }, fly: ['cold', 'arch'], t: '<b>Archive</b>: cheapest storage, but <b>offline</b>. You cannot read the blob directly.' },
          { c: { e4: 'bad', rd: 'warn' }, t: 'To read an archived blob you <b>rehydrate</b> it to an online tier first, which can take hours (up to ~15 h at standard priority).', cls: 'warn' }
        ] },
      { id: 'sas', name: 'SAS link', intro: 'Let a browser upload directly, without sharing keys.',
        nodes: [['br', 20, 60, 170, 46, 'Browser', 'user'], ['app', 300, 60, 170, 46, 'Spring app', 'signs SAS'], ['blob', 560, 160, 170, 46, 'Blob', 'invoices/x.pdf'], ['url', 230, 240, 310, 46, 'SAS URL', '…/x.pdf?sp=cw&se=+15min&sig=…']],
        edges: [['e1', 'br', 'app', 'h'], ['e2', 'app', 'url', 'v'], ['e3', 'br', 'blob', 'h']],
        steps: [
          { c: { br: 'hot', e1: 'hot', app: 'hot' }, fly: ['br', 'app'], t: 'The browser asks your app: “may I upload x.pdf?” The app checks the user.' },
          { c: { e2: 'hot', url: 'ok' }, t: 'The app creates a <b>SAS</b>: a URL with permissions (create/write), an expiry and a signature. Prefer a <i>user delegation</i> SAS signed via Entra.' },
          { c: { e3: 'ok', blob: 'ok' }, fly: ['br', 'blob'], t: 'The browser uploads straight to Blob Storage. Your app never streams the file.' },
          { c: { e3: 'bad', blob: 'bad', url: 'bad' }, sub: { url: 'expired → 403' }, t: 'After the expiry the same URL fails with 403. Short lifetimes limit the damage if a link leaks.', cls: 'warn' }
        ] }
    ] });
});
