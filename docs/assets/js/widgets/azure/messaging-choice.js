/* Messaging flows: Service Bus queue (peek-lock, DLQ, lock loss), sessions, topic filters, Event Hubs partitions + consumer groups, Event Grid push + retry + dead-letter. */
IA.widget('messaging-choice', (root, ctx) => {
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
  let mode = 'queue';
  const stage = svg('svg', { viewBox: '0 0 640 330', role: 'img', 'aria-label': 'Message flows through Service Bus, Event Hubs and Event Grid' });
  const segM = seg([['queue', 'Queue + DLQ'], ['sess', 'Sessions'], ['topic', 'Topic'], ['eh', 'Event Hubs'], ['eg', 'Event Grid']], mode, (v) => { mode = v; reset(); }, 'Flow');
  const stats = el('div', { class: 'w-stats' });
  const stat = (pairs) => { stats.innerHTML = ''; pairs.forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: `${k} <b>${v}</b>` }))); };
  const PROFILE = {
    queue: [['model', 'broker, one owner per message'], ['retry', 'DeliveryCount → DLQ'], ['ordering', 'none without sessions']],
    sess: [['model', 'broker, per-session lock'], ['ordering', 'FIFO per SessionId'], ['parallelism', 'across sessions']],
    topic: [['model', 'publish/subscribe broker'], ['copies', 'one per matching subscription'], ['filters', 'SQL / correlation']],
    eh: [['model', 'partitioned log'], ['retention', 'time-based, events not deleted on read'], ['ordering', 'per partition']],
    eg: [['model', 'push notifications'], ['retry', 'backoff, default up to 24 h'], ['dead-letter', 'Blob, if configured']]
  };
  function build() {
    stage.innerHTML = ''; clearZ();
    const e = svg('g'); const g = svg('g');
    if (mode === 'queue' || mode === 'sess') {
      node(g, 'prod', 10, 135, 140, 60, 'checkout-api', 'sender');
      node(g, 'q', 190, 135, 200, 60, mode === 'sess' ? 'payments (sessions)' : 'orders (queue)', '—');
      node(g, 'c1', 440, 30, 190, 60, mode === 'sess' ? 'receiver #1' : 'consumer #1', 'peek-lock');
      node(g, 'c2', 440, 135, 190, 60, mode === 'sess' ? 'receiver #2' : 'consumer #2', 'peek-lock');
      node(g, 'dlq', 440, 250, 190, 60, mode === 'sess' ? 'receiver #3' : 'orders/$deadletterqueue', mode === 'sess' ? 'waiting for a session' : '—');
      hlink(e, 'eP', 'prod', 'q'); hlink(e, 'e1', 'q', 'c1'); hlink(e, 'e2', 'q', 'c2'); hlink(e, 'e3', 'q', 'dlq');
    } else if (mode === 'topic') {
      node(g, 'prod', 10, 135, 130, 60, 'orders-api', 'publish');
      node(g, 'q', 170, 135, 170, 60, 'order-events', 'topic');
      [['s1', 'billing', 'rule: 1=1 (all)'], ['s2', 'shipping', "region = 'EU'"], ['s3', 'analytics', "type = 'OrderPlaced'"]].forEach(([id, t, s], i) => {
        node(g, id, 375, 30 + i * 105, 140, 60, 'sub: ' + t, s);
        node(g, 'c' + (i + 1), 540, 30 + i * 105, 90, 60, t + '-svc', '—');
        hlink(e, 'e' + id, 'q', id); hlink(e, 'ec' + (i + 1), id, 'c' + (i + 1));
      });
      hlink(e, 'eP', 'prod', 'q');
    } else if (mode === 'eh') {
      node(g, 'prod', 10, 135, 140, 60, 'telemetry-gw', 'key = deviceId');
      [0, 1, 2, 3].forEach((i) => { node(g, 'p' + i, 190, 12 + i * 80, 210, 64, 'partition ' + i, '…'); hlink(e, 'ep' + i, 'prod', 'p' + i); });
      node(g, 'cgA', 440, 30, 190, 64, 'CG: fraud-detector', 'reads live');
      node(g, 'cgB', 440, 140, 190, 64, 'CG: nightly-batch', 'replays');
      node(g, 'ck', 440, 250, 190, 60, 'Blob checkpoint store', 'offset per CG + partition');
      edge(e, 'eA', 'M400 204 C 420 204, 420 62, 440 62'); edge(e, 'eB', 'M400 124 C 420 124, 420 172, 440 172'); link(e, 'eK', 'cgB', 'ck');
    } else {
      node(g, 'src', 10, 135, 150, 60, 'Blob storage', 'uploads/');
      node(g, 'q', 200, 135, 170, 60, 'Event Grid', 'system topic');
      node(g, 'h1', 420, 30, 210, 60, 'Function: thumbnails', 'push, filter: .jpg');
      node(g, 'h2', 420, 135, 210, 60, 'Service Bus queue', 'filter: .pdf');
      node(g, 'dl', 420, 250, 210, 60, 'Dead-letter container', 'Blob');
      hlink(e, 'eS', 'src', 'q'); hlink(e, 'e1', 'q', 'h1'); hlink(e, 'e2', 'q', 'h2'); hlink(e, 'e3', 'q', 'dl');
    }
    stage.append(e, g, pkt); stat(PROFILE[mode]);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'queue') {
      S.push({ fly: ['prod', 'q'], ...A.set({ prod: 'hot', eP: 'hot', q: 'hot', dlq: 'dim', e3: 'dim' }, { q: 'm1 m2 m3' }), t: 'checkout-api sends three “fulfil order” commands. They are stored durably in the queue until someone takes them.' });
      S.push({ fly: ['q', 'c1'], ...A.set({ c1: 'hot', e1: 'hot' }, { c1: 'm1 locked (60 s)', q: 'm1🔒 m2 m3' }), t: '<b>Peek-lock</b>: consumer #1 receives m1. It stays in the queue but is invisible to others until the lock expires.' });
      S.push({ ...A.set({ c1: 'ok', e1: 'ok' }, { c1: 'complete(m1)', q: 'm2 m3' }), t: 'Processing succeeds and the consumer calls <code>complete</code>. Only now is m1 removed. A crash before this point would have made m1 visible again.', cls: 'ok' });
      S.push({ fly: ['q', 'c2'], ...A.set({ c2: 'bad', e2: 'bad' }, { c2: 'm2 → exception → abandon', q: 'm2 (delivery 1) m3' }), t: 'Consumer #2 takes m2, which has a bad payload. The handler throws and the message is abandoned. <code>DeliveryCount</code> goes up.', cls: 'err' });
      S.push({ ...A.set({ q: 'warn' }, { q: 'm2 delivery 2 … 10' }), t: 'm2 is redelivered again and again, competing consumers each failing in turn, until <code>DeliveryCount</code> exceeds <code>MaxDeliveryCount</code> (10 by default).', cls: 'warn' });
      S.push({ fly: ['q', 'dlq'], ...A.set({ dlq: 'warn', e3: 'warn', q: '' }, { dlq: 'm2: MaxDeliveryCountExceeded', q: 'm3' }), t: 'm2 moves to the <b>dead-letter subqueue</b>, so it no longer blocks the queue. Nothing happens to it there unless someone alerts on and processes the DLQ.', cls: 'warn' });
      S.push({ fly: ['q', 'c1'], ...A.set({ c1: 'warn', e1: 'warn', dlq: '' }, { c1: 'm3: slow… lock expired', q: 'm3 visible again' }), t: 'Consumer #1 takes m3 but a slow downstream call takes 90 s. The 60 s lock expires and m3 becomes visible again.', cls: 'warn' });
      S.push({ fly: ['q', 'c2'], ...A.set({ c2: 'ok', e2: 'ok', c1: 'bad' }, { c2: 'm3 processed', c1: 'complete → MessageLockLost' }), t: 'Consumer #2 processes m3 too, so it happens <b>twice</b>. Consumer #1’s <code>complete</code> fails with <code>MessageLockLost</code>. Fix: auto lock renewal plus idempotent handlers.', cls: 'err' });
      return S;
    }
    if (mode === 'sess') {
      S.push({ fly: ['prod', 'q'], ...A.set({ prod: 'hot', eP: 'hot', q: 'hot' }, { q: 'A1 B1 A2 C1 A3 B2' }), t: 'Payments are sent with <code>SessionId</code> = customer ID: A, B and C. The queue has <code>requiresSession = true</code>.' });
      S.push({ fly: ['q', 'c1'], ...A.set({ c1: 'hot', e1: 'hot' }, { c1: 'session A locked' }), t: 'Receiver #1 accepts the next available session, A, and gets a <b>session lock</b>. No other receiver can take A’s messages now.' });
      S.push({ fly: ['q', 'c2'], ...A.set({ c2: 'hot', e2: 'hot' }, { c2: 'session B locked' }), t: 'Receiver #2 accepts session B. Different sessions are processed in <b>parallel</b>.' });
      S.push({ fly: ['q', 'c1'], ...A.set({ c1: 'ok' }, { c1: 'A1 → A2 → A3, in order', q: 'B1 C1 B2' }), t: 'Receiver #1 gets A1, A2, A3 <b>in order</b>, even though they were interleaved with B and C. “Authorise” is always handled before “capture”.', cls: 'ok' });
      S.push({ fly: ['q', 'dlq'], ...A.set({ dlq: 'ok', e3: 'ok' }, { dlq: 'session C locked', q: 'B1 B2' }), t: 'Receiver #3 takes session C. Parallelism is the number of active sessions, capped by your receivers’ concurrency.', cls: 'ok' });
      S.push({ ...A.set({ c2: 'warn' }, { c2: 'B1 → B2 (customer B is hot)' }), t: 'One busy customer is still a single ordered lane on one receiver. Choose the session key as fine-grained as your ordering really needs (per order rather than per merchant, for example).', cls: 'warn' });
      return S;
    }
    if (mode === 'topic') {
      S.push({ fly: ['prod', 'q'], ...A.set({ prod: 'hot', eP: 'hot', q: 'hot' }, { q: 'OrderPlaced, region = US' }), t: 'orders-api publishes <code>OrderPlaced</code> with application properties <code>type</code> and <code>region = US</code> to the <b>topic</b>. The publisher doesn’t know who listens.' });
      S.push({ fly: ['q', 's1'], ...A.set({ s1: 'ok', es1: 'ok' }), t: 'billing’s rule is the default <code>1=1</code>: it matches, so billing’s subscription gets its own copy.', cls: 'ok' });
      S.push({ ...A.set({ s2: 'dim', es2: 'dim', c2: 'dim', ec2: 'dim' }), t: 'shipping’s SQL filter <code>region = \'EU\'</code> doesn’t match, so <b>no copy</b> is made for shipping.' });
      S.push({ fly: ['q', 's3'], ...A.set({ s3: 'ok', es3: 'ok' }), t: 'analytics’ correlation filter on <code>type = OrderPlaced</code> matches, so it gets a copy too.', cls: 'ok' });
      S.push({ fly: ['s1', 'c1'], ...A.set({ c1: 'ok', ec1: 'ok', c3: 'warn', ec3: 'warn' }, { c1: 'invoiced', c3: 'down for deploy' }), t: 'Each subscription behaves like its own queue, with its own locks, DeliveryCount and DLQ. billing processes now. analytics is mid-deploy, so its copy simply waits.', cls: 'ok' });
      S.push({ fly: ['s3', 'c3'], ...A.set({ c3: 'ok' }, { c3: 'caught up' }), t: 'When analytics comes back it drains its subscription. Adding a new consumer later means adding a subscription; it only receives messages published <b>after</b> it was created.', cls: 'ok' });
      return S;
    }
    if (mode === 'eh') {
      S.push({ fly: ['prod', 'p1'], ...A.set({ prod: 'hot', ep1: 'hot', p1: 'ok' }, { p1: 'dev-7: 0 1 2 3 4 5' }), t: 'Events with partition key <code>dev-7</code> always hash to partition 1, so they keep their order there. Events are <b>appended</b>; reading doesn’t delete them.' });
      S.push({ fly: ['prod', 'p0', 'p2', 'p3'], ms: 1300, ...A.set({ p0: 'ok', p2: 'ok', p3: 'ok', ep0: 'hot', ep2: 'hot', ep3: 'hot' }, { p0: '0 1 2 3', p2: '0 1 2 3 4', p3: '0 1 2' }), t: 'Other devices spread over the other partitions. Partitions are the unit of <b>ordering</b> and of <b>parallelism</b>.' });
      S.push({ fly: ['p3', 'cgA'], ...A.set({ cgA: 'ok', eA: 'ok' }, { cgA: 'P3 @ offset 2 (live)' }), t: 'Consumer group <b>fraud-detector</b> reads every partition near the head, with one active reader per partition. Its position is its own.', cls: 'ok' });
      S.push({ fly: ['p1', 'cgB'], ...A.set({ cgB: 'hot', eB: 'hot' }, { cgB: 'P1 @ offset 0 (replay)' }), t: 'Consumer group <b>nightly-batch</b> reads the same events from offset 0. Independent consumer groups never interfere: that is replay, which a broker queue can’t give you.' });
      S.push({ fly: ['cgB', 'ck'], ...A.set({ ck: 'ok', eK: 'ok' }, { ck: 'nightly-batch / P1 = 3' }), t: 'After processing a batch, the consumer writes a <b>checkpoint</b> (offset 3 for P1) to Blob Storage.', cls: 'ok' });
      S.push({ ...A.set({ cgB: 'bad' }, { cgB: 'crash at offset 5' }), t: 'The batch job crashes after handling offsets 4 and 5, before checkpointing again.', cls: 'err' });
      S.push({ fly: ['ck', 'cgB', 'p1'], ...A.set({ cgB: 'warn' }, { cgB: 'resume P1 @ 4 (4, 5 again)' }), t: 'On restart it resumes from the checkpoint, so 4 and 5 are <b>processed again</b>. There are no locks, retries or DLQ per event: a poison event is your consumer’s problem to park and skip.', cls: 'warn' });
      return S;
    }
    S.push({ fly: ['src', 'q'], ...A.set({ src: 'hot', eS: 'hot', q: 'hot', dl: 'dim', e3: 'dim' }, { src: 'BlobCreated: cat.jpg' }), t: 'A blob is uploaded. Storage publishes a <code>Microsoft.Storage.BlobCreated</code> event (a small JSON notification with the URL, not the file) to its Event Grid <b>system topic</b>.' });
    S.push({ fly: ['q', 'h1'], ...A.set({ h1: 'ok', e1: 'ok', h2: 'dim', e2: 'dim' }, { h1: '200 OK' }), t: 'Event Grid evaluates every subscription’s filters. The <code>.jpg</code> subscription matches, so Event Grid <b>pushes</b> the event to the Function. The <code>.pdf</code> one doesn’t.', cls: 'ok' });
    S.push({ fly: ['src', 'q', 'h1'], ...A.set({ src: 'hot', h1: 'bad', e1: 'bad', h2: '' }, { src: 'BlobCreated: dog.jpg', h1: '503 (deploying)' }), t: 'The next upload arrives while the Function is being deployed and returns 503.', cls: 'err' });
    S.push({ ...A.set({ q: 'warn' }, { q: 'retry with backoff…' }), t: 'Event Grid <b>retries</b> with exponential backoff, by default for up to 24 hours or 30 attempts. Some errors (such as 400 or 413) aren’t retried.', cls: 'warn' });
    S.push({ fly: ['q', 'dl'], ...A.set({ dl: 'warn', e3: 'warn' }, { dl: 'dog.jpg event parked' }), t: 'Retries exhausted: with a dead-letter destination configured, the event is written to a Blob container. Without one, it is <b>dropped</b>.', cls: 'warn' });
    S.push({ fly: ['q', 'h2'], ...A.set({ h2: 'ok', e2: 'ok', q: 'ok' }, { h2: 'durable queue + DLQ' }), t: 'For important work, route events to a <b>Service Bus queue</b> (or Event Hubs) and process from there: Event Grid for routing, Service Bus for reliable processing.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ queue: 'A Service Bus queue with two competing consumers. Press Play.', sess: 'A session-enabled queue. Press Play.', topic: 'A topic with three filtered subscriptions. Press Play.', eh: 'An event hub with four partitions and two consumer groups. Press Play.', eg: 'Blob events routed by Event Grid. Press Play.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr, stats);
  const reset = makeStepper(plan, intro, build, 2800);
  reset();
});
