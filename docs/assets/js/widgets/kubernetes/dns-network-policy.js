/* DNS & NetworkPolicy (main): one getaddrinfo() walking the resolv.conf search list under different ndots values. */
IA.widget('dns-network-policy', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8s-dns-style')) {
    document.head.append(el('style', { id: 'w-k8s-dns-style', text: `
.w-dns .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: all .25s; }
.w-dns .bx.hot { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-dns .bx.ok { stroke: var(--ok); stroke-width: 2.5; }
.w-dns .bx.err { stroke: var(--err); stroke-width: 2.5; }
.w-dns .ttl { font: 600 13px var(--sans); fill: var(--text); }
.w-dns .sub { font: 500 10.5px var(--mono); fill: var(--text-3); }
.w-dns .wire { stroke: var(--border); stroke-width: 1.5; fill: none; stroke-dasharray: 4 4; }
.w-dns .ql { font-family: var(--mono); font-size: 12px; display: grid; gap: 4px; margin-top: 10px; }
.w-dns .ql div { display: flex; gap: 8px; flex-wrap: wrap; padding: 4px 8px; border-radius: 7px; background: var(--surface-2); border: 1px solid var(--border); }
.w-dns .ql div.cur { border-color: var(--accent); background: var(--accent-soft); }
.w-dns .ql .nx { color: var(--err); font-weight: 700; } .w-dns .ql .ans { color: var(--ok); font-weight: 700; } .w-dns .ql .pend { color: var(--text-3); }
.w-dns .ql .nm { overflow-wrap: anywhere; }
` }));
  }
  const RECORDS = { 'orders.shop.svc.cluster.local': '10.96.12.34', 'orders.payments.svc.cluster.local': '10.96.40.7', 'api.stripe.com': '203.0.113.50' };
  const NAMES = ['orders', 'orders.payments', 'api.stripe.com', 'api.stripe.com.'];
  let name = 'api.stripe.com'; let ndots = 5; let cloud = false;
  let gen = 0; let running = false; let k = 0; let steps = []; let speed = 2200; let rows = []; let cnt = { q: 0, nx: 0, up: 0 };

  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segName = seg(NAMES.map((n) => [n, n]), name, (v) => { name = v; reset(); }, 'Name to resolve');
  const segNd = seg([[5, 'ndots:5 (default)'], [2, 'ndots:2'], [1, 'ndots:1']], ndots, (v) => { ndots = v; reset(); }, 'ndots');
  const segCl = seg([[false, 'no node search domain'], [true, '+ node adds ec2.internal']], cloud, (v) => { cloud = v; reset(); }, 'Node search domain');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3400, 'Slow'], [2200, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const conf = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const W = 760; const H = 220;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Pod resolver, CoreDNS and the upstream resolver' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const ql = el('div', { class: 'ql', 'aria-label': 'Queries sent' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-dns');
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'resolve' }), segName), el('div', { class: 'w-controls' }, segNd, segCl), conf,
    el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, ql, stats);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };

  const search = () => ['shop.svc.cluster.local', 'svc.cluster.local', 'cluster.local'].concat(cloud ? ['ec2.internal'] : []);
  function candidates() {
    if (name.endsWith('.')) return [name.slice(0, -1)];
    const dots = (name.match(/\./g) || []).length;
    const withS = search().map((s) => name + '.' + s);
    return dots >= ndots ? [name, ...withS] : [...withS, name];
  }
  const B = { pod: { x: 20, y: 60, w: 190, h: 90 }, dns: { x: 290, y: 60, w: 190, h: 90 }, up: { x: 560, y: 60, w: 180, h: 90 } };
  let layer;
  const box = (b, cls) => svg('rect', { class: 'bx ' + (cls || ''), x: b.x, y: b.y, width: b.w, height: b.h, rx: 10 });
  const txt = (x, y, t, cls) => svg('text', { x, y, class: cls || 'ttl', 'text-anchor': 'middle', text: t });
  function draw(st) {
    st = st || {}; stage.innerHTML = '';
    stage.append(svg('path', { class: 'wire', d: 'M210 105 L290 105 M480 105 L560 105' }));
    stage.append(box(B.pod, st.pod), txt(115, 92, 'orders pod (ns shop)', 'ttl'), txt(115, 112, 'JVM → glibc getaddrinfo', 'sub'), txt(115, 130, 'A + AAAA per name', 'sub'));
    stage.append(box(B.dns, st.dns), txt(385, 92, 'CoreDNS 10.96.0.10', 'ttl'), txt(385, 112, 'kubernetes plugin:', 'sub'), txt(385, 128, 'authoritative for cluster.local', 'sub'));
    stage.append(box(B.up, st.up), txt(650, 92, 'upstream resolver', 'ttl'), txt(650, 112, 'forward . /etc/resolv.conf', 'sub'), txt(650, 128, '(VPC / node DNS)', 'sub'));
    if (st.q) stage.append(txt(380, 36, st.q, 'sub'));
    layer = svg('g'); stage.append(layer);
  }
  function fly(pts, color) {
    return new Promise((res) => {
      const c = color || 'var(--accent)';
      const dot = svg('circle', { r: 7, fill: c, class: 'packet', style: `color:${c}` }); layer.append(dot);
      const end = pts[pts.length - 1];
      if (reduced) { dot.setAttribute('cx', end.x); dot.setAttribute('cy', end.y); res(); return; }
      const segs = []; let tot = 0;
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(d); tot += d; }
      const dur = Math.min(1500, speed * 0.55); const t0 = performance.now();
      const tick = (t) => { let f = Math.min(1, (t - t0) / dur) * tot; let i = 0;
        while (i < segs.length - 1 && f > segs[i]) { f -= segs[i]; i++; }
        const a = pts[i]; const b = pts[i + 1]; const r = segs[i] ? Math.min(1, f / segs[i]) : 1;
        dot.setAttribute('cx', a.x + (b.x - a.x) * r); dot.setAttribute('cy', a.y + (b.y - a.y) * r);
        if (t - t0 < dur) requestAnimationFrame(tick); else res(); };
      requestAnimationFrame(tick);
    });
  }
  function plan() {
    const S = []; const cs = candidates(); const dots = (name.replace(/\.$/, '').match(/\./g) || []).length;
    const why = name.endsWith('.') ? 'The trailing dot marks it as fully qualified, so the search list is skipped.'
      : dots >= ndots ? `${dots} dot${dots === 1 ? '' : 's'} ≥ ndots:${ndots}, so the name is tried <b>as-is first</b>, then the search list.`
      : `${dots} dot${dots === 1 ? '' : 's'} &lt; ndots:${ndots}, so the resolver walks the <b>search list first</b> and tries the name as-is last.`;
    S.push({ st: { pod: 'hot' }, say: `Resolve <code>${name}</code>. ${why} Candidate order: ${cs.map((c) => `<code>${c}</code>`).join(' → ')}.` });
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i]; const inCluster = /cluster\.local$/.test(c); const hit = RECORDS[c];
      const P = [{ x: 210, y: 98 }, { x: 290, y: 98 }];
      const back = [{ x: 290, y: 114 }, { x: 210, y: 114 }];
      const pts = inCluster ? P : [...P, { x: 480, y: 98 }, { x: 560, y: 98 }, { x: 480, y: 114 }, { x: 290, y: 114 }];
      S.push({ row: i, st: { pod: 'hot', dns: 'hot', up: inCluster ? '' : 'hot', q: `A? AAAA? ${c}` }, fly: pts, up: !inCluster,
        say: inCluster ? `Query ${2 * i + 1}–${2 * i + 2}: <code>${c}</code> (A and AAAA). It is inside <code>cluster.local</code>, so CoreDNS answers from its own watch of Services. No upstream hop.`
          : `Query ${2 * i + 1}–${2 * i + 2}: <code>${c}</code> is <b>not</b> in cluster.local. CoreDNS forwards it upstream (and caches the answer for up to 30 s with the default <code>cache 30</code>).` });
      S.push({ row: i, res: hit ? 'ans' : 'nx', st: { pod: hit ? 'ok' : 'err', dns: inCluster ? (hit ? 'ok' : 'err') : '', up: inCluster ? '' : (hit ? 'ok' : 'err') }, fly: back, color: hit ? 'var(--ok)' : 'var(--err)',
        say: hit ? `Answer: <code>${c}</code> → <b>${hit}</b>${/svc\.cluster\.local$/.test(c) ? ' (the Service’s ClusterIP; AAAA comes back empty on an IPv4-only cluster)' : ''}. The resolver stops here.`
          : `<b>NXDOMAIN</b> for <code>${c}</code>. Try the next candidate.`, tone: hit ? 'ok' : '' });
      if (hit) break;
    }
    S.push({ final: true, st: { pod: 'ok' }, say: '', tone: 'ok' });
    return S;
  }
  function renderRows(cur) {
    ql.innerHTML = '';
    rows.forEach((r, i) => ql.append(el('div', { class: i === cur ? 'cur' : '' }, el('span', { text: `#${2 * i + 1}-${2 * i + 2}` }), el('span', { class: 'nm', text: r.c }),
      el('span', { class: r.res || 'pend', text: r.res === 'ans' ? '→ ' + RECORDS[r.c] : r.res === 'nx' ? 'NXDOMAIN' : r.sent ? 'waiting…' : 'not sent' }), r.up ? el('span', { class: 'pend', text: '(upstream)' }) : null)));
  }
  function renderStats() {
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `queries sent <b>${cnt.q}</b>` }), el('span', { class: 'w-stat', html: `NXDOMAIN answers <b>${cnt.nx}</b>` }), el('span', { class: 'w-stat', html: `upstream round-trips <b>${cnt.up}</b>` }));
  }
  function renderConf() {
    conf.innerHTML = '';
    conf.append(el('div', { class: 'ch', text: '/etc/resolv.conf (written by the kubelet)' }), el('pre', { html: IA.highlight(`search ${search().join(' ')}\nnameserver 10.96.0.10\noptions ndots:${ndots}`, 'text') }));
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; cnt = { q: 0, nx: 0, up: 0 };
    rows = candidates().map((c) => ({ c })); renderConf(); draw(); steps = plan(); renderRows(-1); renderStats(); bStep.disabled = false;
    say('Press Play to resolve the name the way a pod does it.');
  }
  async function step() {
    if (k >= steps.length) return false;
    const s = steps[k++]; const g = gen;
    if (s.row != null) {
      const r = rows[s.row];
      if (!s.res) { r.sent = true; r.up = s.up; cnt.q += 2; if (s.up) cnt.up += 2; }
      else { r.res = s.res; if (s.res === 'nx') cnt.nx += 2; }
    }
    if (s.final) {
      const used = rows.filter((r) => r.sent).length;
      s.say = `Done: <b>${cnt.q} queries</b> (${cnt.nx} NXDOMAIN, ${cnt.up} through upstream) for one lookup. ${cnt.q > 2 ? 'Fixes: a trailing dot, a lower ndots, or NodeLocal DNSCache. ' : 'That is the minimum: one A and one AAAA. '}Java then caches the answer for 30 s (<code>networkaddress.cache.ttl</code>), and a failure for 10 s.${used < rows.length ? ` ${rows.length - used} later candidate${rows.length - used === 1 ? ' was' : 's were'} never needed.` : ''}`;
    }
    draw(s.st); say(s.say, s.tone); renderRows(s.row != null ? s.row : -1); renderStats();
    if (s.fly) await fly(s.fly, s.color);
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
    else while (running && g === gen && await step()) { if (k < steps.length) await sleep(speed * 0.45); }
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
