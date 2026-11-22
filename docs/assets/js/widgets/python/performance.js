/* Performance: a sampling profiler builds a stack chart over time, the samples merge into a flame graph,
   and a cProfile table explains the wide bars. Toggle "after the fix" (batched query + str.join). Illustrative numbers. */
IA.widget('performance', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-py-base')) {
    document.head.append(el('style', { id: 'w-py-base', text: `
.wpy-code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.wpy-code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent}
.wpy-code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.wpy-out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.wpy-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.wpy-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:12px;align-items:start}
@media (max-width:720px){.wpy-grid{grid-template-columns:1fr}}
` }));
  }
  if (!document.getElementById('w-pypf-style')) {
    document.head.append(el('style', { id: 'w-pypf-style', text: `
.w-pypf .fr{stroke:var(--surface);stroke-width:1;transition:opacity .3s}
.w-pypf .f-root{fill:color-mix(in srgb,var(--k-external) 35%,var(--surface))}
.w-pypf .f-py{fill:color-mix(in srgb,var(--k-compute) 40%,var(--surface))}
.w-pypf .f-db{fill:color-mix(in srgb,var(--k-store) 45%,var(--surface))}
.w-pypf .f-str{fill:color-mix(in srgb,var(--k-queue) 40%,var(--surface))}
.w-pypf .fr.hot{stroke:var(--err);stroke-width:2.5}
.w-pypf .dim .fr{opacity:.35}
.w-pypf .dim .fr.hot{opacity:1}
.w-pypf table.pf{border-collapse:collapse;font-family:var(--mono);font-size:12px;width:100%}
.w-pypf table.pf th,.w-pypf table.pf td{padding:3px 8px;text-align:right;border-bottom:1px solid var(--border)}
.w-pypf table.pf th:last-child,.w-pypf table.pf td:last-child{text-align:left}
.w-pypf table.pf th{color:var(--text-3);font-weight:600}
.w-pypf table.pf tr.hot td{background:color-mix(in srgb,var(--err) 12%,transparent);font-weight:700}
` }));
  }
  const CODE = {
    before: ['def handle_request(body):', '    req = parse_json(body)', '    users = load_users(req["ids"])', '    return render(users)', '', 'def load_users(ids):', '    return [build_user(db_query(i)) for i in ids]   # N+1', '', 'def render(users):', '    return format_rows(users)   # html += "<tr>…" in a loop'],
    after: ['def handle_request(body):', '    req = parse_json(body)', '    users = load_users(req["ids"])', '    return render(users)', '', 'def load_users(ids):', '    rows = db_query(ids)        # one WHERE id = ANY(%s)', '    return [build_user(r) for r in rows]', 'def render(users):', '    return format_rows(users)   # "".join(parts)']
  };
  // frames: name, parent, class, calls, self samples (before / after)
  const FR = {
    before: { handle_request: [null, 'root', 1, 0], parse_json: ['handle_request', 'py', 1, 8], load_users: ['handle_request', 'py', 1, 0], db_query: ['load_users', 'db', 200, 53], build_user: ['load_users', 'py', 200, 5], render: ['handle_request', 'py', 1, 4], format_rows: ['render', 'str', 1, 30] },
    after: { handle_request: [null, 'root', 1, 0], parse_json: ['handle_request', 'py', 1, 8], load_users: ['handle_request', 'py', 1, 0], db_query: ['load_users', 'db', 1, 4], build_user: ['load_users', 'py', 200, 6], render: ['handle_request', 'py', 1, 4], format_rows: ['render', 'str', 1, 3] }
  };
  const LINE = { parse_json: 1, load_users: 2, db_query: 6, build_user: 6, render: 3, format_rows: 9, handle_request: 0 };
  function sequence(mode) {
    const s = []; const push = (n, c) => { for (let i = 0; i < c; i++) s.push(n); };
    push('parse_json', 8);
    if (mode === 'before') { for (let i = 0; i < 58; i++) s.push(i % 10 === 9 ? 'build_user' : 'db_query'); }
    else { push('db_query', 4); push('build_user', 6); }
    push('render', 2); push('format_rows', mode === 'before' ? 30 : 3); push('render', 2);
    return s;
  }
  const stackOf = (mode, leaf) => { const out = []; let n = leaf; while (n) { out.unshift(n); n = FR[mode][n][0]; } return out; };
  const incl = (mode, name) => sequence(mode).filter((l) => stackOf(mode, l).includes(name)).length;

  const STEPS = [
    { ph: 'code', cap: (m) => m === 'before' ? 'A request handler. Looks harmless: parse, load users, render. Press <b>Step</b> to profile it.' : 'The fixed version: one batched query instead of one per user, and <code>"".join</code> instead of <code>+=</code> in a loop.' },
    { ph: 'stack', f: 0.34, cap: () => 'A sampling profiler (py-spy) wakes up every 10 ms and copies the call stack. Each column is one sample; the x-axis here is <b>time</b>. This is a “stack chart”.' },
    { ph: 'stack', f: 0.7, cap: (m) => m === 'before' ? 'Inside <code>load_users</code> the stack flips between <code>db_query</code> and <code>build_user</code> 200 times: one query per user. Most samples land in <code>db_query</code>.' : 'Now <code>db_query</code> appears once, as one short block.' },
    { ph: 'stack', f: 1, cap: (m) => m === 'before' ? 'Then <code>render</code> → <code>format_rows</code>: a long block spent concatenating strings. 100 samples ≈ 1.0 s of CPU.' : 'Total: 25 samples ≈ 0.25 s, on the same scale as before.' },
    { ph: 'flame', cap: () => 'Merge identical stacks and sort children alphabetically: a <b>flame graph</b>. The x-axis is no longer time: <b>width = share of samples</b>. Callers at the bottom, callees above.' },
    { ph: 'flame', hot: 'db_query', cap: (m) => m === 'before' ? 'Look for wide bars with nothing on top (a wide <b>top edge</b>): time spent in the function itself. <code>db_query</code> is 53% of everything.' : '<code>db_query</code> shrank from 53 samples to 4: same data, one round trip.' },
    { ph: 'table', hot: 'db_query', cap: (m) => m === 'before' ? 'The flame graph can’t tell one slow call from many fast ones. cProfile can: <code>ncalls = 200</code>. That is an N+1 query: batch it with one <code>WHERE id = ANY(%s)</code>.' : '<code>ncalls</code> 200 → 1. <code>build_user</code> still runs 200 times, but it is cheap.' },
    { ph: 'table', hot: 'format_rows', cap: (m) => m === 'before' ? 'Second widest: <code>format_rows</code>, with a high <b>tottime</b> in a single call. The work is inside it: string building in a loop. Use <code>"".join(parts)</code>.' : '<code>format_rows</code>: 0.30 s → 0.03 s with <code>join</code>.' },
    { ph: 'table', cap: (m) => m === 'before' ? '<b>tottime</b> = time in the function itself; <b>cumtime</b> = including callees. Sort by cumtime to find the slow path, by tottime to find the work. Now flip to <b>after the fix</b>.' : 'From 1.00 s to 0.25 s. Keep the change only because the number moved, and remember cProfile’s own per-call overhead inflates call-heavy code such as the 200 queries.' }
  ];

  let mode = 'before', k = 0, gen = 0, running = false;
  const segM = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Before or after the fix' });
  [['before', 'before the fix'], ['after', 'after the fix']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...segM.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); segM.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 640 230', role: 'img', 'aria-label': 'Stack chart and flame graph of the request handler' });
  const codeHost = el('div', { class: 'wpy-code' });
  const tblHost = el('div');
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pypf');
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'wpy-grid' }, el('div', null, el('div', { class: 'wpy-lbl', text: 'code' }), codeHost), el('div', null, el('div', { class: 'wpy-lbl', text: 'cProfile (sort: cumtime)' }), tblHost)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const X0 = 20, W = 600, RH = 34, BASE = 190;
  const px = (n) => (n / 100) * W;      // scale: 100 samples = full width in both modes
  function label(g, x, y, w, name) { if (w < 34) return; const max = Math.floor(w / 7.2); g.append(svg('text', { x: x + 5, y: y + 21, 'font-size': 12, 'font-family': 'var(--mono)', fill: 'var(--text)', text: name.length > max ? name.slice(0, Math.max(1, max - 1)) + '…' : name })); }
  function drawStack(frac) {
    const seq = sequence(mode); const n = Math.round(seq.length * frac); const g = svg('g');
    for (let depth = 0; depth < 3; depth++) {
      let i = 0;
      while (i < n) {
        const st = stackOf(mode, seq[i]); const name = st[depth];
        let j = i; while (j < n && stackOf(mode, seq[j])[depth] === name) j++;
        if (name) { const x = X0 + px(i), w = px(j - i), y = BASE - (depth + 1) * RH; g.append(svg('rect', { class: 'fr f-' + FR[mode][name][1], x, y, width: w, height: RH - 2 })); label(g, x, y, w, name); }
        i = j;
      }
    }
    if (n < seq.length && !reduced) g.append(svg('line', { x1: X0 + px(n), y1: BASE - 3 * RH - 6, x2: X0 + px(n), y2: BASE + 4, stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-dasharray': '4 3' }));
    stage.append(g, svg('text', { x: X0, y: BASE + 22, 'font-size': 11.5, fill: 'var(--text-3)', text: 'time →   (one column per 10 ms sample)' }));
  }
  function drawFlame(hot) {
    const g = svg('g', { class: hot ? 'dim' : '' });
    const kids = (p) => Object.keys(FR[mode]).filter((n) => FR[mode][n][0] === p).sort();
    const lay = (name, x, depth) => {
      const w = px(incl(mode, name)); const y = BASE - (depth + 1) * RH;
      g.append(svg('rect', { class: 'fr f-' + FR[mode][name][1] + (hot === name ? ' hot' : ''), x, y, width: w, height: RH - 2 })); label(g, x, y, w, name);
      let cx = x; kids(name).forEach((c) => { lay(c, cx, depth + 1); cx += px(incl(mode, c)); });
    };
    lay('handle_request', X0, 0);
    stage.append(g, svg('text', { x: X0, y: BASE + 22, 'font-size': 11.5, fill: 'var(--text-3)', text: 'width = share of samples (children sorted A→Z, not by time)' }));
  }
  function render() {
    const cur = k ? STEPS[k - 1] : STEPS[0];
    stage.innerHTML = '';
    const total = sequence(mode).length;
    stage.append(svg('text', { x: X0, y: 20, 'font-size': 13, 'font-weight': 700, fill: 'var(--text)', text: cur.ph === 'code' ? 'profile not taken yet' : cur.ph === 'stack' ? 'stack chart (py-spy samples)' : 'flame graph' }),
      svg('text', { x: X0 + W, y: 20, 'text-anchor': 'end', 'font-size': 12, 'font-family': 'var(--mono)', fill: mode === 'before' ? 'var(--err)' : 'var(--ok)', text: k > 1 ? `${total} samples ≈ ${(total / 100).toFixed(2)} s` : '' }));
    if (k > 1) stage.append(svg('rect', { x: X0, y: BASE + 2, width: W, height: 3, fill: 'var(--border)' }));
    if (cur.ph === 'stack') drawStack(cur.f);
    else if (cur.ph === 'flame' || cur.ph === 'table') drawFlame(cur.hot);
    codeHost.innerHTML = '';
    CODE[mode].forEach((ln, i) => codeHost.append(el('div', { class: cur.hot && LINE[cur.hot] === i ? 'on' : '', html: ln ? IA.highlight(ln, 'python') : '&nbsp;' })));
    tblHost.innerHTML = '';
    if (cur.ph === 'table') {
      const rows = Object.keys(FR[mode]).map((n) => ({ n, calls: FR[mode][n][2], tot: FR[mode][n][3] / 100, cum: incl(mode, n) / 100 })).sort((a, b) => b.cum - a.cum || b.tot - a.tot);
      tblHost.append(el('table', { class: 'pf' }, el('thead', null, el('tr', null, ['ncalls', 'tottime', 'cumtime', 'function'].map((h) => el('th', { text: h })))),
        el('tbody', null, rows.map((r) => el('tr', { class: r.n === cur.hot ? 'hot' : '' }, el('td', { text: String(r.calls) }), el('td', { text: r.tot.toFixed(3) }), el('td', { text: r.cum.toFixed(3) }), el('td', { text: r.n }))))));
    } else tblHost.append(el('div', { class: 'tiny', text: 'appears at step 7' }));
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${STEPS.length}` }), el('div', { class: 't', html: k ? cur.cap(mode) : 'Press <b>Play</b> or <b>Step</b>.' }));
    bStep.disabled = k >= STEPS.length;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; render(); }
  function step() { if (k >= STEPS.length) return false; k++; render(); return k < STEPS.length; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= STEPS.length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2800); }
    if (g === gen) stop();
  });
  reset();
});
