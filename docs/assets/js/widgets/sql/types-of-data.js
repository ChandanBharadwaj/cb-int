/* Types of data: sort six real samples into structured / semi-structured / unstructured, and show where Postgres keeps each. */
IA.widget('types-of-data', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-tod-css')) document.head.append(el('style', { id: 'w-tod-css', text: `
.w-tod-tray{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;min-height:40px;margin:8px 0}
.w-tod-card{border:1px solid var(--border);background:var(--surface);border-radius:8px;padding:5px 8px;font-size:12.5px;font-family:var(--mono);color:var(--text);max-width:100%;overflow-wrap:anywhere;transition:all .35s}
.w-tod-card.hot{border-color:var(--accent);background:var(--accent-soft);transform:scale(1.04)}
.w-tod-bins{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.w-tod-bin{border:1px dashed var(--border);border-radius:10px;padding:8px;min-height:120px;background:var(--surface-2);min-width:0}
.w-tod-bin h5{margin:0 0 2px;font-size:13px;color:var(--text)}
.w-tod-bin .tiny{display:block;margin-bottom:6px}
.w-tod-bin .w-tod-card{display:block;margin-bottom:5px}
.w-tod-pg{font-size:11.5px;color:var(--ok);margin-top:3px;font-family:var(--mono)}` }));
  const S = [
    { id: 'row', show: "order 42 | Asha | 19.99 | PAID", bin: 0, pg: 'orders table: typed columns', why: 'A fixed set of fields with known types. The schema is declared <b>before</b> the data is written (schema-on-write), so bad values are rejected at INSERT.' },
    { id: 'csv', show: 'sku,qty\\nTEA,2', bin: 0, pg: 'COPY into a table', why: 'A CSV export has columns and rows, so it is structured. <code>COPY</code> loads it straight into a table.' },
    { id: 'api', show: '{"carrier":"DHL","eta":"..","extra":{..}}', bin: 1, pg: 'jsonb column + GIN index', why: 'JSON carries its own field names but no enforced schema. Each payload can differ. You interpret it when reading (schema-on-read).' },
    { id: 'log', show: 'ts=09:30 level=WARN user=42 msg="slow"', bin: 1, pg: 'jsonb, or parsed into columns', why: 'A key=value log line has some structure, but fields come and go. It is semi-structured until you parse it into columns.' },
    { id: 'pdf', show: 'invoice-42.pdf (180 KB)', bin: 2, pg: 'object storage + a row with its key', why: 'A PDF is a blob of bytes. The database can’t see fields inside it. Store the file in object storage (S3) and keep a <b>row with metadata</b> pointing to it.' },
    { id: 'txt', show: '"Mug arrived chipped, please help"', bin: 2, pg: 'text column + full-text search', why: 'Free text has no fields. Postgres can still search it with <code>tsvector</code> full-text search, or bring in extracted fields later.' },
    { id: 'img', show: 'photo.jpg (2.4 MB)', bin: 2, pg: 'object storage (bytea only if small)', why: 'Images are large and opaque. <code>bytea</code> works for small files, but big blobs bloat backups and WAL. Keep them in object storage.' }
  ];
  const BINS = [
    ['Structured', 'fixed columns · schema-on-write · SQL'],
    ['Semi-structured', 'self-describing keys · schema-on-read · JSON paths'],
    ['Unstructured', 'no fields · search / ML · bytes']
  ];
  let lens = 'ex'; let gen = 0; let k = 0; let running = false; let speed = 2400;
  const seg = (opts, cur, on) => { const s = el('div', { class: 'seg' }); opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segL = seg([['ex', 'lens: what it looks like'], ['pg', 'lens: where Postgres keeps it']], lens, (v) => { lens = v; reset(); });
  const tray = el('div', { class: 'w-tod-tray' });
  const bins = BINS.map(([t, d]) => { const body = el('div'); return { body, node: el('div', { class: 'w-tod-bin' }, el('h5', { text: t }), el('span', { class: 'tiny', text: d }), body) }; });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const num = el('span', { class: 'n', text: '0' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, num, el('div', { class: 't' }));
  const say = (h) => cap.replaceChild(el('div', { class: 't', html: h }), cap.lastChild);
  root.append(el('div', { class: 'w-controls' }, segL), tray, el('div', { class: 'w-tod-bins' }, bins.map((b) => b.node)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), cap);
  let cards = [];
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; tray.innerHTML = ''; bins.forEach((b) => { b.body.innerHTML = ''; });
    cards = S.map((s) => { const c = el('div', { class: 'w-tod-card', text: s.show.replace('\\n', ' ⏎ ') }); tray.append(c); return c; });
    num.textContent = '0/' + (S.length + 1); bStep.disabled = false;
    say(lens === 'ex' ? 'Seven pieces of data from one shop. Press Play to sort them by how much structure they carry.' : 'Same seven samples. This time each one also shows how Postgres would store it.');
  }
  function step() {
    if (k > S.length) return false;
    cards.forEach((c) => c.classList.remove('hot'));
    if (k === S.length) {
      say(lens === 'pg' ? 'Postgres covers all three: <b>columns</b> for structured, <b>jsonb</b> for semi-structured, <b>text/bytea</b> or a row pointing to object storage for unstructured.' : 'Structure is a spectrum. The more you know about the shape up front, the more the database can check, index and optimize for you.');
      k++; num.textContent = k + '/' + (S.length + 1); bStep.disabled = true; return true;
    }
    const s = S[k]; const c = cards[k];
    bins[s.bin].body.append(c); c.classList.add('hot');
    if (lens === 'pg') c.append(el('div', { class: 'w-tod-pg', text: '→ ' + s.pg }));
    say(s.why); k++; num.textContent = k + '/' + (S.length + 1); return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k > S.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
