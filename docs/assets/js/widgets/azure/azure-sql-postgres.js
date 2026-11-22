/* Postgres Flexible Server: zone-redundant HA failover, async read replica lag, PgBouncer multiplexing, and point-in-time restore to a new server. */
IA.widget('azure-sql-postgres', (root, ctx) => {
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
  let mode = 'ha';
  const stage = svg('svg', { viewBox: '0 0 640 340', role: 'img', 'aria-label': 'Postgres Flexible Server primary, standby, replica, PgBouncer and backups' });
  const segM = seg([['ha', 'HA failover'], ['rep', 'Read replica'], ['pool', 'PgBouncer'], ['pitr', 'PITR']], mode, (v) => { mode = v; reset(); }, 'Mechanism');
  const stats = el('div', { class: 'w-stats' });
  const stat = (pairs) => { stats.innerHTML = ''; pairs.forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: `${k} <b>${v}</b>` }))); };
  function build() {
    stage.innerHTML = ''; clearZ();
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    const reg = (id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 12 }); bg.append(r, svg('text', { class: 'lbl', x: x + 10, y: y + 18, text: label })); Z[id] = { n: r, base: 'zn' }; };
    if (mode === 'ha' || mode === 'rep') {
      reg('z1', 10, 140, 300, 192, mode === 'ha' ? 'Zone 1' : 'Primary region');
      reg('z2', 330, 140, 300, 192, mode === 'ha' ? 'Zone 2' : 'Replica (same or other region)');
      node(g, 'app', 10, 12, 200, 52, 'orders-api', 'HikariCP pool');
      node(g, 'dns', 225, 12, 200, 52, 'pg-orders-prod', '…postgres.database.azure.com');
      if (mode === 'rep') node(g, 'dns2', 440, 12, 190, 52, 'pg-orders-ro', 'replica hostname');
      node(g, 'p', 30, 176, 260, 54, 'Primary', 'read-write');
      node(g, 'pd', 30, 256, 260, 50, 'data + WAL', 'managed disk');
      node(g, 's', 350, 176, 260, 54, mode === 'ha' ? 'Standby' : 'Read replica', mode === 'ha' ? 'not readable' : 'read-only, async');
      node(g, 'sd', 350, 256, 260, 50, 'data + WAL', 'managed disk');
      hlink(e, 'eA', 'app', 'dns'); link(e, 'eP', 'dns', 'p'); link(e, 'eP2', 'p', 'pd'); link(e, 'eS2', 's', 'sd'); hlink(e, 'eR', 'p', 's');
      if (mode === 'ha') link(e, 'eS', 'dns', 's'); else { link(e, 'eS', 'dns2', 's'); edge(e, 'eA2', 'M110 64 C 110 112, 535 112, 535 64'); }
      stat(mode === 'ha' ? [['replication', 'synchronous'], ['RPO', '0 (zone failure)'], ['standby', 'hidden']] : [['replication', 'asynchronous'], ['lag', '0 s'], ['promote', 'manual']]);
    } else if (mode === 'pool') {
      [0, 1, 2, 3].forEach((i) => node(g, 'a' + i, 10, 14 + i * 80, 170, 58, 'orders-api pod ' + (i + 1), 'Hikari: 20'));
      node(g, 'pgb', 250, 130, 160, 70, 'PgBouncer :6432', 'transaction mode');
      node(g, 'pg', 470, 130, 160, 70, 'Postgres :5432', 'max_connections');
      [0, 1, 2, 3].forEach((i) => { hlink(e, 'b' + i, 'a' + i, 'pgb'); edge(e, 'd' + i, `M180 ${43 + i * 80} C 330 ${43 + i * 80}, 380 ${300 - i * 4}, 550 200`); });
      hlink(e, 'eB', 'pgb', 'pg');
      stat([['client connections', '80'], ['server connections', '80'], ['pool mode', 'none']]);
    } else {
      node(g, 'p', 10, 14, 200, 54, 'pg-orders-prod', 'production server');
      node(g, 'ops', 225, 14, 190, 54, 'You', 'az … restore');
      node(g, 'app', 440, 14, 190, 54, 'orders-api', 'connection string');
      node(g, 'snap', 10, 120, 200, 54, 'Daily snapshot', 'backup storage');
      node(g, 'wal', 225, 120, 190, 54, 'WAL archive', 'continuous');
      node(g, 'new', 440, 120, 190, 54, 'pg-orders-pitr', 'NEW server');
      link(e, 'eS', 'p', 'snap'); edge(e, 'eW', 'M110 68 C 110 95, 320 95, 320 120'); hlink(e, 'eN', 'wal', 'new'); edge(e, 'eSN', 'M110 174 C 110 210, 535 210, 535 174');
      link(e, 'eO', 'ops', 'wal'); hlink(e, 'eC', 'new', 'app');
      const tl = svg('g'); const y = 280;
      tl.append(svg('line', { x1: 20, y1: y, x2: 620, y2: y, stroke: 'var(--border)', 'stroke-width': 3 }));
      [[30, '00:00', 'snapshot'], [400, '09:14', 'restore target'], [440, '09:15', 'DELETE'], [600, '09:40', 'now']].forEach(([x, t, s], i) => {
        tl.append(svg('circle', { cx: x, cy: y, r: 6, fill: i === 2 ? 'var(--err)' : i === 1 ? 'var(--ok)' : 'var(--accent)' }),
          svg('text', { class: 'lbl m', x, y: y - 14, 'text-anchor': 'middle', text: t }), svg('text', { class: 'lbl', x, y: y + 24, 'text-anchor': 'middle', text: s }));
      });
      tl.append(svg('text', { class: 'lbl m', x: 215, y: y - 14, 'text-anchor': 'middle', text: 'WAL replayed →' }));
      g.append(tl);
      stat([['retention', '14 days'], ['restore creates', 'a new server']]);
    }
    stage.append(bg, e, g, pkt);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'ha') {
      S.push({ ...A.set({ eS: 'dim', p: 'ok', s: 'hot', eR: 'hot' }, { p: 'primary (zone 1)', s: 'standby (zone 2)' }), t: '<b>Zone-redundant HA</b>: a primary in zone 1 and a hidden standby in zone 2. The app only knows one hostname.' });
      S.push({ fly: ['app', 'dns', 'p'], ...A.set({ app: 'hot', eA: 'hot', eP: 'hot' }), t: 'The app runs <code>INSERT … ; COMMIT</code>. DNS resolves the server name to the primary.' });
      S.push({ fly: ['p', 's'], ...A.set({ eR: 'ok', s: 'ok', sd: 'ok', pd: 'ok' }), t: 'The primary streams the commit’s WAL to the standby <b>synchronously</b>. The commit is acknowledged only once the standby has it. That costs a little write latency and buys RPO 0.' });
      S.push({ fly: ['p', 'dns', 'app'], ...A.set({ app: 'ok', eA: 'ok', eP: 'ok' }), t: '<b>COMMIT</b> returns. Two zones now hold the transaction.', cls: 'ok' });
      S.push({ ...A.set({ z1: 'bad', p: 'bad', pd: 'bad', eP: 'bad', eR: 'bad', app: 'warn' }, { p: 'zone down' }), t: 'Zone 1 fails. Every open connection in Hikari’s pool now points at a dead server. In-flight transactions roll back, and the app gets I/O errors.', cls: 'err' });
      S.push({ ...A.set({ s: 'warn' }, { s: 'promoting…' }), t: 'The platform detects the failure and <b>promotes the standby</b>. Per Microsoft Learn this typically takes 60–120 seconds. New connections fail during this window, so the app needs retry with backoff.', cls: 'warn' });
      S.push({ fly: ['app', 'dns', 's'], ...A.set({ s: 'ok', eS: 'ok', app: 'ok' }, { s: 'new primary', dns: '→ zone 2' }), t: 'DNS for the <b>same hostname</b> now points to zone 2. Hikari evicts the broken connections and opens new ones. No config change, and no committed data lost.', cls: 'ok' });
      S.push({ ...A.set({ z1: '', p: 'dim', pd: 'dim' }, { p: 'rebuilding as standby' }), t: 'When zone 1 recovers, a new standby is built there. Until then you are running <b>without HA</b>. The roles have swapped, so the primary is now in zone 2.', cls: 'warn' });
      return S;
    }
    if (mode === 'rep') {
      const lag = (v) => () => stat([['replication', 'asynchronous'], ['lag', v], ['promote', 'manual']]);
      S.push({ ...A.set({ p: 'ok', s: 'hot', eR: 'hot' }), t: 'A <b>read replica</b> is a separate server with its own hostname. It replays the primary’s WAL <b>asynchronously</b> and accepts read-only queries.' });
      S.push({ fly: ['app', 'dns', 'p'], ...A.set({ app: 'hot', eA: 'hot', eP: 'hot' }, { p: 'name = “Ana”' }), run: lag('0 s'), t: 'A user renames themselves to “Ana”. The write goes to the primary and commits <b>immediately</b>, without waiting for the replica.' });
      S.push({ ...A.set({ eR: 'warn', s: 'warn' }, { s: 'name = “Anna” (old)' }), run: lag('4.2 s'), t: 'Under load, or behind a long-running query on the replica, replay falls behind. Here the replica is 4 seconds behind.', cls: 'warn' });
      S.push({ fly: ['app', 'dns2', 's'], ...A.set({ eA2: 'bad', eS: 'bad', s: 'bad', app: 'bad' }), t: 'The redirect page is <code>@Transactional(readOnly = true)</code>, so the router sends it to the replica. The user sees the <b>old name</b>: read-your-writes is broken.', cls: 'err' });
      S.push({ fly: ['p', 's'], ...A.set({ eR: 'ok', s: 'ok', eA2: '', eS: '', app: 'ok' }, { s: 'name = “Ana”' }), run: lag('0.1 s'), t: 'Seconds later the replica catches up. Fix: send read-after-write paths to the primary, and use replicas for reports, search and dashboards.', cls: 'ok' });
      S.push({ ...A.set({ z1: 'bad', p: 'bad', pd: 'bad', eP: 'bad', eR: 'bad' }), t: 'Disaster in the primary region. The replica is <b>not</b> promoted automatically.', cls: 'err' });
      S.push({ ...A.set({ s: 'ok', z2: 'hot' }, { s: 'promoted: read-write' }), run: lag('n/a (standalone)'), t: 'You promote the replica. It becomes a standalone read-write server. Anything it hadn’t replayed is lost (RPO = the lag), and the app must be re-pointed, for example through virtual endpoints or a config switch.', cls: 'warn' });
      return S;
    }
    if (mode === 'pool') {
      const pc = (c, s, m) => () => stat([['client connections', c], ['server connections', s], ['pool mode', m]]);
      const dir = {}; [0, 1, 2, 3].forEach((i) => { dir['d' + i] = 'warn'; dir['b' + i] = 'dim'; dir['a' + i] = 'hot'; });
      S.push({ ...A.set({ ...dir, pgb: 'dim', eB: 'dim' }), run: pc('80', '80', 'none (direct)'), t: 'Four pods with Hikari <code>maximumPoolSize=20</code> connect straight to port 5432: up to <b>80 server connections</b>, each a Postgres backend process using memory.' });
      S.push({ ...A.set({ pg: 'warn' }, { pg: '80 / max_connections' }), t: 'Autoscaling to 12 pods would mean 240 connections. Most of them are idle most of the time, but they still count against <code>max_connections</code>.', cls: 'warn' });
      const via = {}; [0, 1, 2, 3].forEach((i) => { via['d' + i] = 'gone'; via['b' + i] = 'hot'; });
      S.push({ ...A.set({ ...via, pgb: 'hot', eB: 'ok', pg: 'ok' }, { pg: 'a few busy backends' }), run: pc('80', '≤ default_pool_size', 'transaction'), t: 'Enable the built-in <b>PgBouncer</b> (<code>pgbouncer.enabled=true</code>) and point the JDBC URL at <b>:6432</b>. Clients keep their 80 connections to PgBouncer, which keeps only a small pool of server connections.' });
      S.push({ fly: ['a0', 'pgb', 'pg'], ...A.set({ a0: 'ok' }), t: 'In <b>transaction mode</b>, pod 1 borrows a server connection for one transaction, then gives it back…' });
      S.push({ fly: ['a2', 'pgb', 'pg'], ...A.set({ a2: 'ok' }), t: '…and pod 3’s next transaction can run on that very same server connection. Idle clients cost almost nothing.', cls: 'ok' });
      S.push({ ...A.set({ a2: 'bad', b2: 'bad' }, { a2: 'S_1 does not exist' }), t: 'The catch: session state doesn’t follow you. PgJDBC’s named prepared statements (after 5 executions), <code>SET</code>, session advisory locks and <code>LISTEN</code> may land on a different server connection. Use <code>prepareThreshold=0</code> unless your PgBouncer tracks prepared statements.', cls: 'err' });
      return S;
    }
    S.push({ ...A.set({ p: 'ok', snap: 'ok', wal: 'ok', eS: 'ok', eW: 'ok', new: 'dim', eN: 'dim', eSN: 'dim', eC: 'dim', eO: 'dim', ops: 'dim' }), t: 'Backups run on their own: a <b>daily snapshot</b> of the data files and <b>continuous WAL archiving</b>. Together they cover every second of the retention window (7 days by default, up to 35).' });
    S.push({ ...A.set({ p: 'bad', app: 'bad' }, { p: 'order_items empty!' }), t: '09:15: a migration runs <code>DELETE FROM order_items</code> without its WHERE clause. The HA standby and any replicas apply it too: they are copies, not backups.', cls: 'err' });
    S.push({ fly: ['ops', 'wal'], ...A.set({ ops: 'hot', eO: 'hot' }), t: 'You run <code>az postgres flexible-server restore --restore-time 09:14</code>. You can’t rewind the existing server; the restore always creates a <b>new server</b>.' });
    S.push({ fly: ['snap', 'new'], ms: 1300, ...A.set({ new: 'warn', eSN: 'warn' }, { new: 'restoring snapshot…' }), t: 'Azure restores the nearest snapshot before 09:14 onto a new server…', cls: 'warn' });
    S.push({ fly: ['wal', 'new'], ...A.set({ eN: 'ok', new: 'ok' }, { new: 'consistent at 09:14' }), t: '…then <b>replays WAL</b> up to exactly 09:14:00. The more WAL since the snapshot, the longer this takes, so restores have an RTO you should measure.', cls: 'ok' });
    S.push({ fly: ['new', 'app'], ...A.set({ eC: 'warn', app: 'warn' }), t: 'Choose: copy the lost rows back into production (keeping later orders), or switch the app to the new server (losing writes after 09:14). Either way, private endpoints, firewall rules, Entra admins and parameters must be set on the new server, which is why they belong in IaC.', cls: 'warn' });
    return S;
  }
  const intro = () => ({ ha: 'Zone-redundant HA. Press Play to commit a write, then lose zone 1.', rep: 'A read replica behind a routing DataSource. Press Play.', pool: 'Four pods, direct connections. Press Play to add PgBouncer.', pitr: 'Backups and WAL. Press Play to undo a bad DELETE.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr, stats);
  const reset = makeStepper(plan, intro, build, 2800);
  reset();
});
