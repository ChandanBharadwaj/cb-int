/* Data types that bite: timestamptz vs timestamp. Write a wall-clock time in one zone, read it in another. */
IA.widget('data-types-that-bite', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const Z = { ny: ['America/New_York', -300, 'EST −05:00'], ber: ['Europe/Berlin', 60, 'CET +01:00'], kol: ['Asia/Kolkata', 330, 'IST +05:30'], utc: ['UTC', 0, 'UTC ±00:00'] };
  let wz = 'ny'; let rz = 'kol'; let gen = 0; let k = 0; let running = false; let speed = 2400; let steps = [];
  const seg = (opts, cur, on) => { const s = el('div', { class: 'seg' }); opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const zopts = Object.entries(Z).map(([key, z]) => [key, z[0].split('/').pop().replace('_', ' ')]);
  const segW = seg(zopts, wz, (v) => { wz = v; reset(); });
  const segR = seg(zopts, rz, (v) => { rz = v; reset(); });
  const W = 760, H = 270;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'A time value travelling from a writer session to disk to a reader session, for timestamptz and timestamp columns' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const num = el('span', { class: 'n', text: '0' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, num, el('div', { class: 't' }));
  const say = (h) => cap.replaceChild(el('div', { class: 't', html: h }), cap.lastChild);
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'writer session TimeZone' }), segW),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'reader session TimeZone' }), segR),
    el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), cap);
  // minutes since 2026-01-15 00:00 → "2026-01-15 09:00"
  const fmt = (m) => { const d = new Date(Date.UTC(2026, 0, 15, 0, m)); const p = (n) => String(n).padStart(2, '0'); return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`; };
  const off = (m) => { const s = m < 0 ? '-' : '+'; const a = Math.abs(m); return s + String(Math.floor(a / 60)).padStart(2, '0') + (a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''); };
  const WALL = 9 * 60;
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 13, fill: 'var(--text)', text: t, 'text-anchor': 'middle' }, o || {}));
  const box = (x, y, w, h) => svg('rect', { x, y, width: w, height: h, rx: 8, fill: 'var(--surface)', stroke: 'var(--border)' });
  const V = {};
  function draw() {
    stage.innerHTML = '';
    const cols = [[110, 'writer: ' + Z[wz][0]], [380, 'stored on disk'], [650, 'reader: ' + Z[rz][0]]];
    cols.forEach(([x, t]) => stage.append(T(x, 20, t, { 'font-size': 12, fill: 'var(--text-3)' })));
    [[60, 'timestamptz'], [170, 'timestamp']].forEach(([y, name], li) => {
      stage.append(svg('text', { x: 6, y: y - 12, 'font-size': 12, 'font-weight': 700, fill: li ? 'var(--warn)' : 'var(--accent)', text: name + (li ? '  (without time zone)' : '  (with time zone)') }));
      cols.forEach(([x], ci) => { const r = box(x - 115, y, 230, 54); stage.append(r); const t1 = T(x, y + 24, '', { 'font-family': 'var(--mono)', 'font-size': 14 }); const t2 = T(x, y + 43, '', { 'font-size': 11, fill: 'var(--text-3)' }); stage.append(t1, t2); V[li + '' + ci] = { r, t1, t2 }; });
      stage.append(svg('path', { d: `M ${225} ${y + 27} L ${265} ${y + 27} M ${495} ${y + 27} L ${535} ${y + 27}`, stroke: 'var(--border)', 'stroke-width': 2 }));
    });
    V.dot0 = svg('circle', { cx: 110, cy: 87, r: 6, fill: 'var(--accent)', opacity: 0 }); V.dot1 = svg('circle', { cx: 110, cy: 197, r: 6, fill: 'var(--warn)', opacity: 0 });
    V.verdict = T(380, 258, '', { 'font-size': 13, 'font-weight': 700 });
    stage.append(V.dot0, V.dot1, V.verdict);
  }
  const set = (key, a, b, hot) => { const v = V[key]; v.t1.textContent = a; v.t2.textContent = b || ''; v.r.setAttribute('stroke', hot ? 'var(--accent)' : 'var(--border)'); v.r.setAttribute('stroke-width', hot ? 2 : 1); };
  const move = (dot, x) => { const d = V[dot]; d.setAttribute('opacity', 1); if (!reduced) d.style.transition = 'cx .9s ease'; d.setAttribute('cx', x); };
  function plan() {
    const wo = Z[wz][1], ro = Z[rz][1]; const utc = WALL - wo; const readTz = utc + ro;
    const diff = ro - wo;
    return [
      { cap: `The app runs <code>SET TimeZone = '${Z[wz][0]}'</code> and inserts the literal <code>'2026-01-15 09:00'</code> (no offset) into both columns.`, run: () => { set('00', '09:00', fmt(WALL).slice(0, 10) + ' · ' + Z[wz][2], true); set('10', '09:00', fmt(WALL).slice(0, 10) + ' · ' + Z[wz][2], true); } },
      { cap: `<b>timestamptz</b> reads the literal in the session zone (${off(wo)}) and converts it to UTC: <code>${fmt(utc)}</code>. Postgres stores <b>only that instant</b> (8 bytes); the zone name is not saved.`, run: () => { move('dot0', 380); set('01', fmt(utc).slice(11) + ' UTC', 'an absolute instant', true); } },
      { cap: '<b>timestamp</b> (without time zone) ignores the session zone and stores the wall-clock reading <code>09:00</code> as-is. It is a picture of a clock with no idea where the clock hung.', run: () => { move('dot1', 380); set('11', '09:00', 'wall clock, no zone', true); } },
      { cap: `A reader with <code>TimeZone = '${Z[rz][0]}'</code> selects the timestamptz: Postgres converts the instant to ${off(ro)} → <code>${fmt(readTz)}${off(ro)}</code>. Same moment, shown in the reader’s local time.`, run: () => { move('dot0', 650); set('02', fmt(readTz).slice(11) + ' ' + off(ro), fmt(readTz).slice(0, 10), true); } },
      { cap: `The timestamp comes back as <code>09:00</code> regardless. ${diff ? `If the reader treats it as local time, they are <b>${Math.abs(diff / 60)} h ${diff > 0 ? 'early' : 'late'}</b>, i.e. off by the zone difference.` : 'Same zone here, so it happens to look right. Change a zone to see it break.'}`, run: () => { move('dot1', 650); set('12', '09:00', diff ? 'meaning depends on reader' : 'looks fine (same zone)', true); V.verdict.textContent = diff ? `timestamptz: correct instant · timestamp: off by ${Math.abs(diff / 60)} h` : 'Both look identical, until zones differ'; V.verdict.setAttribute('fill', diff ? 'var(--err)' : 'var(--text-3)'); } },
      { cap: 'Rule: store moments (orders, logins, events) as <b>timestamptz</b>, and set the zone on the session or in the literal. Use <code>timestamp</code> only for “wall-clock” values like a store’s opening time, and <code>AT TIME ZONE</code> to convert explicitly.', run: () => {} }
    ];
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan(); draw();
    num.textContent = '0/' + steps.length; bStep.disabled = false;
    say('Pick the writer’s and reader’s session time zones, then press Play to send one 09:00 value through both column types.');
  }
  function step() { if (k >= steps.length) return false; const s = steps[k++]; s.run(); say(s.cap); num.textContent = k + '/' + steps.length; if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
