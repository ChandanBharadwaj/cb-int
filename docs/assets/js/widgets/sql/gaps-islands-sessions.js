/* Sessionization: LAG → gap → is_new flag → running SUM = session id. Threshold is a user choice. */
IA.widget('gaps-islands-sessions', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const PAL = ['var(--accent)', 'var(--ok)', 'var(--warn)', 'var(--err)', 'var(--text-2)', 'var(--accent)'];
  const T = [[9, 0], [9, 12], [9, 40], [10, 25], [10, 31], [11, 5], [11, 50]].map(([h, m]) => h * 60 + m);
  const hm = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  let thr = 30; let gen = 0; let running = false; let k = 0;
  const seg = el('div', { class: 'seg', 'aria-label': 'Gap threshold' });
  [15, 30, 60].forEach((v) => { const b = el('button', { text: v + ' min gap', class: v === thr ? 'on' : '' }); b.addEventListener('click', () => { thr = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const tb = el('tbody');
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: '' }));
  root.append(el('div', { class: 'w-controls' }, seg, bPlay, bReset), el('div', { class: 'tscroll' }, el('table', { class: 't rg' }, el('thead', null, el('tr', null, ['ts', 'LAG(ts)', 'gap', 'is_new', 'SUM(is_new)'].map((h) => el('th', { text: h })))), tb)), narr);
  function render() {
    tb.innerHTML = ''; let s = 0;
    T.forEach((t, i) => { const on = i < k; const prev = i ? T[i - 1] : null; const gap = prev == null ? null : t - prev; const nw = gap == null || gap > thr ? 1 : 0; s += nw;
      tb.append(el('tr', { style: { background: i === k - 1 ? 'var(--accent-soft)' : '' } }, el('td', { text: hm(t) }), el('td', { class: on && prev == null ? 'null' : '', text: on ? (prev == null ? 'NULL' : hm(prev)) : '·' }),
        el('td', { text: on ? (gap == null ? 'NULL' : gap + ' min') : '·' }), el('td', { text: on ? String(nw) : '·', style: { color: on && nw ? 'var(--warn)' : '' } }),
        el('td', null, on ? el('b', { style: { color: PAL[(s - 1) % PAL.length] }, text: 'session ' + s }) : '·'))); });
    return s;
  }
  function step() {
    if (k >= T.length) return false; k++; const n = render();
    const i = k - 1; const gap = i ? T[i] - T[i - 1] : null;
    narr.firstChild.textContent = gap == null ? 'First event: LAG is NULL, so treat it as a new session (CASE … WHEN lag IS NULL THEN 1).'
      : gap > thr ? `${gap} min since the previous event > ${thr}: is_new = 1. The running SUM bumps to ${n}.` : `${gap} min ≤ ${thr}: is_new = 0, the running SUM stays ${n}: same session.`;
    if (k === T.length) narr.firstChild.textContent += ` Done: ${n} sessions. GROUP BY that running sum to get start, end and event count.`;
    return true;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; render(); narr.firstChild.textContent = `Threshold ${thr} min. Press Play: three window steps (LAG, CASE, running SUM) turn a stream into session ids.`; }
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= T.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : 1800);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
