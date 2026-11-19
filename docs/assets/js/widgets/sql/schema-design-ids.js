/* Primary key choice: where do new keys land in the B-tree? Sequential (bigserial / UUIDv7 / Snowflake) vs random (UUIDv4). */
IA.widget('schema-design-ids', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let kind = 'v4'; let gen = 0; let running = false; let speed = 2400; let k = 0;
  const INFO = {
    serial: { l: 'bigserial / identity', size: 8, seq: true, note: '8 bytes, strictly increasing per sequence. Guessable, and generated only by the DB (one round trip, harder to merge across databases).' },
    v4: { l: 'UUIDv4 (gen_random_uuid())', size: 16, seq: false, note: '16 bytes, fully random. Every insert lands on a random leaf page: poor cache locality, page splits everywhere, more WAL (full-page writes after each checkpoint).' },
    v7: { l: 'UUIDv7 (uuidv7(), PG18+)', size: 16, seq: true, note: '16 bytes with a 48-bit millisecond timestamp first, so new keys land on the rightmost leaf like a sequence. Built-in <code>uuidv7()</code> since PG18; on PG16/17 generate it in the app (e.g. a Java library) or an extension.' },
    snow: { l: 'Snowflake-style bigint', size: 8, seq: true, note: '8 bytes: timestamp + machine id + counter, generated in the app. Roughly time-ordered, no coordination. You must manage the machine ids and clock skew yourself.' }
  };
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segK = seg(Object.entries(INFO).map(([v, o]) => [v, o.l]), () => kind, (v) => { kind = v; reset(); }, 'Key type');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const st = svg('svg', { viewBox: '0 0 520 190', role: 'img', 'aria-label': 'Eight B-tree leaf pages; inserts light up the page they land on' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segK), el('div', { class: 'w-stage' }, st), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const P = 8; const CAP = 6; let fill; let touched; let last; let n; let splits; let rnd;
  function draw() {
    st.innerHTML = '';
    st.append(svg('rect', { x: 210, y: 8, width: 100, height: 30, rx: 7, fill: 'var(--surface-2)', stroke: 'var(--border)' }), svg('text', { x: 260, y: 28, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--text-2)', text: 'root' }));
    for (let i = 0; i < P; i++) { const x = 8 + i * 64; const hot = i === last;
      st.append(svg('line', { x1: 260, y1: 38, x2: x + 28, y2: 80, stroke: 'var(--border)' }),
        svg('rect', { x, y: 80, width: 56, height: 84, rx: 7, fill: hot ? 'var(--accent-soft)' : touched.has(i) ? 'var(--surface-2)' : 'var(--surface)', stroke: hot ? 'var(--accent)' : 'var(--border)', 'stroke-width': hot ? 3 : 1 }),
        svg('rect', { x: x + 4, y: 160 - Math.min(1, fill[i] / CAP) * 76, width: 48, height: Math.min(1, fill[i] / CAP) * 76, rx: 4, fill: 'var(--accent)', opacity: 0.35 }),
        svg('text', { x: x + 28, y: 182, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-3)', text: 'leaf ' + (i + 1) })); }
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `inserts <b>${n}</b>` }), el('span', { class: 'w-stat', html: `distinct leaf pages dirtied <b>${touched.size}</b>` }), el('span', { class: 'w-stat', html: `page splits <b>${splits}</b>` }), el('span', { class: 'w-stat', html: `key size <b>${INFO[kind].size} B</b>` }));
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; n = 0; splits = 0; last = -1; touched = new Set(); rnd = 7;
    fill = INFO[kind].seq ? [6, 6, 6, 6, 6, 6, 6, 2] : [4, 4, 4, 4, 4, 4, 4, 4]; bStep.disabled = false; draw(); say(INFO[kind].note + ' Press Play to insert 12 rows.'); }
  const rand = () => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd; };
  function step() {
    if (n >= 12) return false; n++;
    let i; if (INFO[kind].seq) { i = P - 1; } else { i = (rand() >> 16) % P; }
    fill[i]++; if (fill[i] > CAP) { splits++; fill[i] = INFO[kind].seq ? 1 : CAP / 2 + 1; }
    touched.add(i); last = i; draw();
    say(INFO[kind].seq ? `Insert #${n}: the new key is larger than every existing key, so it goes to the <b>rightmost leaf</b>. ` + (fill[i] === 1 ? 'That page was full, so Postgres starts a new one (a cheap “rightmost split” that leaves full pages behind).' : 'One hot page, always in cache.')
      : `Insert #${n}: random key → leaf ${i + 1}. ` + (touched.size > 5 ? 'Nearly every page is being dirtied. On a real table the leaf pages don’t fit in shared_buffers, so many inserts need a disk read, and splits leave pages half-empty.' : 'Each random insert dirties a different page.'));
    if (n >= 12) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => { if (running) { running = false; bPlay.textContent = '▶ Play'; return; } if (n >= 12) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen; while (running && g === gen && step()) await sleep(reduced ? 500 : speed / 2); if (g === gen) { running = false; bPlay.textContent = '▶ Play'; } });
  reset();
});
