/* XID wraparound: the 32-bit transaction counter as a circle; half is "past", half is "future"; freezing rescues old rows. */
IA.widget('mvcc-vacuum-xid', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'ok'; let gen = 0; let running = false; let speed = 2400; let k = 0;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['ok', 'autovacuum can freeze'], ['blocked', 'freezing is blocked (old snapshot / abandoned slot)']], () => mode, (v) => { mode = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 420; const cx = 210; const cy = 200; const R = 150;
  const st = svg('svg', { viewBox: `0 0 ${W} 400`, role: 'img', 'aria-label': 'Circle of 2^32 transaction IDs with the current xid and an old row' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage', style: { maxWidth: '440px' } }, st),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const M = 1e6; const TWO31 = 2147483648;
  const pt = (frac, r) => { const a = frac * 2 * Math.PI - Math.PI / 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const ROW = 0.0; // the old row's xmin sits at the top of the circle
  let age; let frozen;
  function draw() {
    st.innerHTML = '';
    const cur = (ROW + age / 4294967296) % 1;
    // "past" half (behind current) and "future" half (ahead)
    const arc = (f0, f1, color, w) => { const [x0, y0] = pt(f0, R); const [x1, y1] = pt(f1, R); return svg('path', { d: `M${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`, stroke: color, 'stroke-width': w, fill: 'none', opacity: 0.85 }); };
    st.append(arc(cur - 0.5 + 0.0001, cur, 'var(--ok)', 16), arc(cur, cur + 0.5 - 0.0001, 'var(--warn)', 16));
    const [lx, ly] = pt(cur - 0.25, R - 62); const [fx, fy] = pt(cur + 0.25, R - 62);
    st.append(svg('text', { x: lx, y: ly, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--ok)', 'font-weight': 700, text: 'past: visible' }),
      svg('text', { x: fx, y: fy, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--warn)', 'font-weight': 700, text: 'future: invisible' }));
    const [px, py] = pt(cur, R - 34);
    st.append(svg('line', { x1: cx, y1: cy, x2: px, y2: py, stroke: 'var(--accent)', 'stroke-width': 3 }), svg('circle', { cx, cy, r: 5, fill: 'var(--accent)' }),
      svg('text', { x: px, y: py + (py < cy ? -6 : 16), 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--accent)', 'font-weight': 700, text: 'next xid' }));
    const inFuture = !frozen && age >= TWO31;
    if (frozen) {
      st.append(svg('circle', { cx, cy: cy + 52, r: 12, fill: 'var(--accent-soft)', stroke: 'var(--accent)', 'stroke-width': 2 }),
        svg('text', { x: cx, y: cy + 82, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text)', text: 'row FROZEN: visible forever' }));
    } else {
      const [rx, ry] = pt(ROW, R);
      st.append(svg('circle', { cx: rx, cy: ry, r: 11, fill: inFuture ? 'var(--err)' : 'var(--surface)', stroke: inFuture ? 'var(--err)' : 'var(--text)', 'stroke-width': 2 }),
        svg('text', { x: rx, y: ry - 18, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text)', text: 'old row (xmin)' }));
    }
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `age(relfrozenxid) <b>${frozen ? 'reset' : (age / M).toLocaleString() + 'M'}</b>` }),
      el('span', { class: 'w-stat', html: `xids left before shutdown <b>${frozen ? '~2.1B' : Math.round(Math.max(0, (TWO31 - 3 * M - age) / M)).toLocaleString() + 'M'}</b>` }));
  }
  function plan() {
    const s = [
      { a: 50 * M, t: 'Every write transaction takes the next 32-bit xid. Visibility compares xids <b>modulo 2³²</b>: the 2.1 billion behind “next xid” are the past, the 2.1 billion ahead are the future.' },
      { a: 200 * M, t: 'The old row’s xmin is now 200M transactions old: <code>autovacuum_freeze_max_age</code> (default 200M). Autovacuum starts an <b>anti-wraparound</b> (“to prevent wraparound”) vacuum on the table, even if autovacuum is otherwise disabled for it.' }
    ];
    if (mode === 'ok') s.push({ a: 200 * M, freeze: true, t: 'VACUUM <b>freezes</b> the row: it sets a “frozen” flag in the tuple header, meaning “older than every xid”. Now the row is visible forever, wherever the counter goes, and <code>relfrozenxid</code> moves forward.' },
      { a: 3000 * M, freeze: true, t: 'The counter wraps past 2³² and starts again at 3. Nothing bad happens: frozen rows don’t compare xids. That is the whole job of freezing.' });
    else s.push({ a: 1000 * M, t: 'But the vacuum cannot freeze: an old snapshot (long transaction, abandoned replication slot, orphaned prepared transaction) still might need the original xid. Age keeps growing.' },
      { a: 1600 * M, t: '<code>vacuum_failsafe_age</code> (1.6B, PG14+): VACUUM enters failsafe mode. It skips index cleanup and ignores cost-based throttling to freeze as fast as it can. It still can’t remove what the old snapshot pins.' },
      { a: TWO31 - 40 * M, t: 'With 40M xids left the server logs <code>WARNING: database "app" must be vacuumed within … transactions</code> on every command.' },
      { a: TWO31 - 3 * M, t: 'With 3M left (PG14+) Postgres <b>refuses to assign new xids</b>: <code>ERROR: database is not accepting commands that assign new transaction IDs to avoid wraparound data loss</code>. Reads still work; every write fails. This is a full outage.' },
      { a: TWO31 + 10 * M, t: 'Why the hard stop? If the counter went past here, the old row’s xmin would land in the <b>future half</b> (red) and the row would suddenly become invisible: silent data loss. Fix: end the old transaction / drop the slot, then <code>VACUUM (FREEZE, VERBOSE)</code> the oldest tables.' });
    return s;
  }
  let steps = [];
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; age = 0; frozen = false; steps = plan(); bStep.disabled = false; draw(); say('An old row was written at the xid at the top of the circle. Press Play to burn through transaction IDs.'); }
  function step() { if (k >= steps.length) return false; const s = steps[k++]; age = s.a; frozen = !!s.freeze; draw(); say(s.t); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => { if (running) { running = false; bPlay.textContent = '▶ Play'; return; } if (k >= steps.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen; while (running && g === gen && step()) await sleep(reduced ? 700 : speed); if (g === gen) { running = false; bPlay.textContent = '▶ Play'; } });
  reset();
});
