/* CAP / PACELC explorer: cut the link, pick CP or AP, write on either side; then compare the no-partition latency trade-off. */
IA.widget('distributed-sql-pacelc', (root, ctx) => {
  const { el, svg } = ctx;
  let part = false, sys = 'cp', val = { A1: 100, A2: 100, B: 100 }, ver = 0;
  const mkSeg = (label, items, cur, on) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const pic = svg('svg', { viewBox: '0 0 440 230', role: 'img', 'aria-label': 'Two replicas on the left side, one on the right, with a link between', style: { width: '100%', height: 'auto' } });
  const log = el('div', { class: 'w-log', 'aria-live': 'polite', style: { minHeight: '60px' } });
  log.append(el('div', { class: 'tiny', text: 'Events appear here.' }));
  const box = el('div', { class: 'caption' }, el('div', { class: 't' }));
  const wL = el('button', { class: 'btn primary', text: 'Write balance=80 on the left' }), wR = el('button', { class: 'btn primary', text: 'Write balance=50 on the right' });
  const rR = el('button', { class: 'btn', text: 'Read on the right' }), rs = el('button', { class: 'btn', text: '↺ Reset values' });
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'network' }), mkSeg('Network', [[false, 'Healthy'], [true, 'Partitioned ✂']], part, (v) => { part = v; paint(); })),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'system' }), mkSeg('System type', [['cp', 'CP / EC (distributed SQL)'], ['ap', 'AP / EL (Dynamo-style)']], sys, (v) => { sys = v; paint(); })),
    el('div', { class: 'w-stage' }, pic), el('div', { class: 'w-controls' }, wL, wR, rR, rs), log, box);
  const add = (t, c) => { log.prepend(el('div', { html: t, style: { color: c ? `var(--${c})` : null } })); while (log.children.length > 5) log.lastChild.remove(); };
  function paint() {
    pic.innerHTML = '';
    const N = { A1: [20, 85], A2: [20, 175], B: [300, 130] };
    pic.append(svg('rect', { x: 10, y: 10, width: 150, height: 215, rx: 14, fill: 'none', stroke: 'var(--border)', 'stroke-dasharray': '4 4' }), svg('text', { x: 20, y: 32, 'font-size': 15, fill: 'var(--text-3)', text: 'side L: 2 of 3' }),
      svg('rect', { x: 280, y: 10, width: 150, height: 215, rx: 14, fill: 'none', stroke: 'var(--border)', 'stroke-dasharray': '4 4' }), svg('text', { x: 290, y: 32, 'font-size': 15, fill: 'var(--text-3)', text: 'side R: 1 of 3' }),
      svg('line', { x1: 160, y1: 130, x2: 280, y2: 130, stroke: part ? 'var(--err)' : 'var(--ok)', 'stroke-width': 3, 'stroke-dasharray': part ? '6 6' : null }),
      svg('text', { x: 220, y: 120, 'text-anchor': 'middle', 'font-size': 26, text: part ? '✂' : '' }));
    Object.entries(N).forEach(([n, [x, y]]) => pic.append(svg('circle', { cx: x + 60, cy: y, r: 34, fill: 'var(--surface)', stroke: 'var(--accent)', 'stroke-width': 2 }),
      svg('text', { x: x + 60, y: y - 4, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: 'var(--text)', text: n }), svg('text', { x: x + 60, y: y + 16, 'text-anchor': 'middle', 'font-size': 15, 'font-family': 'var(--mono)', fill: 'var(--accent)', text: String(val[n]) })));
    box.firstChild.innerHTML = part
      ? (sys === 'cp' ? '<b>P → C</b>: during a partition, only the side with a majority accepts writes. The minority refuses, so there is never a conflicting value. Availability is lost on side R.' : '<b>P → A</b>: both sides keep accepting writes. Values diverge and are reconciled when the link heals, often last-writer-wins: one write is silently lost.')
      : (sys === 'cp' ? '<b>E → C</b> (else, consistency): no partition, but every write still waits for a quorum round trip. You pay latency every day for consistency.' : '<b>E → L</b> (else, latency): writes are acknowledged by the local replica and copied asynchronously. Fast, but a read on another replica can be stale for a while.');
  }
  wL.addEventListener('click', () => {
    if (!part) { val = { A1: 80, A2: 80, B: 80 }; add(sys === 'cp' ? 'Left write: quorum reached across the link → committed everywhere (+1 RTT).' : 'Left write: acked locally at once; copied to R shortly after.', 'ok'); }
    else if (sys === 'cp') { val.A1 = val.A2 = 80; add('Left write: L has 2 of 3 replicas → majority → committed. R is behind until the link heals.', 'ok'); }
    else { val.A1 = val.A2 = 80; add('Left write: accepted on L. R does not know yet.', 'warn'); }
    paint();
  });
  wR.addEventListener('click', () => {
    if (!part) { val = { A1: 50, A2: 50, B: 50 }; add(sys === 'cp' ? 'Right write: forwarded to the leader, quorum reached → committed.' : 'Right write: acked locally; replicated asynchronously.', 'ok'); }
    else if (sys === 'cp') add('Right write: <b>rejected</b>. R cannot reach a majority (1 of 3). The client gets an error or a timeout.', 'err');
    else { val.B = 50; add('Right write: accepted on R. L and R now <b>disagree</b> (80 vs 50). After healing, last-writer-wins keeps one.', 'warn'); }
    paint();
  });
  rR.addEventListener('click', () => {
    if (part && sys === 'cp') add('Read on R: a consistent read needs the leader / a majority → <b>unavailable</b> (a stale follower read is possible if you explicitly allow it).', 'err');
    else if (sys === 'ap' && (part || val.B !== val.A1)) add(`Read on R: returns <b>${val.B}</b>, which may be stale.`, 'warn');
    else add(`Read on R: <b>${val.B}</b> (consistent).`, 'ok');
  });
  rs.addEventListener('click', () => { val = { A1: 100, A2: 100, B: 100 }; log.innerHTML = ''; paint(); });
  paint();
});
