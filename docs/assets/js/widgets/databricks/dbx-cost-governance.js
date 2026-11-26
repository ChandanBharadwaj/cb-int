/* Cost & governance: a 24-hour compute timeline before and after policies (auto-termination, max workers, job compute), then tags flowing into system.billing.usage. Node-hours are illustrative; no prices. */
IA.widget('dbx-cost-governance', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const W = 760, H = 340;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Timeline of a day showing when each compute resource runs, with node-hours per resource and a breakdown by tag' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  root.append(el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  // resources: name, type, tag, nodes, segments [from,to) in hours
  const BEFORE = [
    { n: 'ana-dev', t: 'all-purpose', tag: '(none)', nodes: 8, s: [[9, 24]] },
    { n: 'nightly_orders', t: 'all-purpose ✗', tag: '(none)', nodes: 8, s: [[0, 24]] },
    { n: 'bi_wh', t: 'SQL warehouse', tag: 'finance', nodes: 4, s: [[0, 24]] },
    { n: 'ml-gpu', t: 'all-purpose', tag: '(none)', nodes: 4, s: [[10, 24]] }
  ];
  const AFTER = [
    { n: 'ana-dev', t: 'all-purpose (policy)', tag: 'data-eng', nodes: 4, s: [[9, 12.5], [13.5, 18]] },
    { n: 'nightly_orders', t: 'job compute', tag: 'data-eng', nodes: 8, s: [[2, 3]] },
    { n: 'bi_wh', t: 'SQL warehouse', tag: 'finance', nodes: 4, s: [[8, 18.5]] },
    { n: 'ml-gpu', t: 'all-purpose (policy)', tag: 'ml', nodes: 4, s: [[10, 12], [14, 16]] }
  ];
  const FR = [
    { d: BEFORE, show: 1, tags: false, c: 'One day of compute in a team workspace. Each bar is a period when that resource is running. Start with an interactive cluster someone forgot to shut down: it runs until midnight.' },
    { d: BEFORE, show: 2, tags: false, c: 'A nightly job is attached to an <b>always-on all-purpose cluster</b> “so it starts fast”. It works for 1 hour and idles for 23.', tone: 'err' },
    { d: BEFORE, show: 4, tags: false, c: 'A SQL warehouse with auto-stop off, and a GPU cluster with no auto-termination. Untagged resources make it impossible to say who spends what.', tone: 'err' },
    { d: AFTER, show: 2, tags: false, c: 'A <b>compute policy</b> caps workers, forces auto-termination (here 30 min) and requires a <code>team</code> tag. The nightly job moves to <b>job compute</b>: it exists only while it runs.', tone: 'ok' },
    { d: AFTER, show: 4, tags: false, c: 'The warehouse gets a short auto-stop, so it sleeps outside office hours. The GPU cluster stops between sessions.', tone: 'ok' },
    { d: AFTER, show: 4, tags: true, c: 'Tags flow into <code>system.billing.usage</code> (<code>custom_tags</code>), so finance can group usage by team. Multiply DBUs by your <b>own</b> price list, never by numbers from a blog.', tone: 'ok' }
  ];
  const X0 = 210, X1 = 740, hx = (h) => X0 + (X1 - X0) * h / 24;
  const hours = (r) => r.s.reduce((a, [f, t]) => a + (t - f), 0) * r.nodes;
  let k = 0, gen = 0, playing = false;
  const t = (x, y, s, o) => stage.append(svg('text', Object.assign({ x, y, 'font-size': 11.5, fill: 'var(--text-2)', text: s }, o || {})));
  function draw(f) {
    t(12, 22, f.d === BEFORE ? 'Before: no policies, no tags' : 'After: policies, job compute, auto-stop, tags', { 'font-size': 14, 'font-weight': 700, fill: 'var(--text)' });
    [0, 6, 12, 18, 24].forEach((h) => { stage.append(svg('line', { x1: hx(h), y1: 40, x2: hx(h), y2: 222, stroke: 'var(--line, var(--border))', 'stroke-width': 1, 'stroke-dasharray': '2 4' })); t(hx(h), 238, `${String(h).padStart(2, '0')}:00`, { 'text-anchor': 'middle', 'font-size': 10.5, fill: 'var(--text-3)' }); });
    let total = 0;
    f.d.forEach((r, i) => {
      const y = 46 + i * 44; const vis = i < f.show;
      t(12, y + 15, r.n, { 'font-weight': 600, fill: vis ? 'var(--text)' : 'var(--text-3)' });
      t(12, y + 31, `${r.t} · ${r.nodes} nodes`, { 'font-size': 10.5, fill: 'var(--text-3)' });
      stage.append(svg('rect', { x: X0, y: y + 6, width: X1 - X0, height: 24, rx: 5, fill: 'var(--surface-2)', stroke: 'var(--border)' }));
      if (!vis) return;
      const bad = f.d === BEFORE;
      r.s.forEach(([a, b]) => stage.append(svg('rect', { x: hx(a), y: y + 8, width: Math.max(3, hx(b) - hx(a)), height: 20, rx: 4, fill: bad ? 'var(--err)' : 'var(--accent)', opacity: 0.75 })));
      const nh = hours(r); total += nh;
      t(X1 - 6, y + 23, `${nh} node-h`, { 'text-anchor': 'end', 'font-size': 11, 'font-weight': 700, fill: 'var(--text)' });
    });
    t(12, 262, `total shown: ${total} node-hours`, { 'font-size': 13, 'font-weight': 700, fill: f.d === BEFORE ? 'var(--err)' : 'var(--ok)' });
    if (f.tags) {
      const by = {}; f.d.forEach((r) => { by[r.tag] = (by[r.tag] || 0) + hours(r); });
      const max = Math.max(...Object.values(by)); let x = 250;
      t(250, 262, 'GROUP BY custom_tags.team:', { 'font-size': 11.5, 'font-family': 'var(--mono)', fill: 'var(--text-2)' });
      Object.entries(by).forEach(([tag, v]) => {
        const w = 120 * v / max;
        stage.append(svg('rect', { x, y: 272, width: w, height: 18, rx: 4, fill: 'var(--accent)', opacity: 0.7 }));
        t(x, 304, `${tag}: ${v}`, { 'font-size': 11 });
        x += 165;
      });
    }
    t(12, H - 10, 'Illustrative node-hours. DBUs per node-hour depend on instance type, compute type and tier; prices depend on your cloud and contract.', { 'font-size': 10.5, fill: 'var(--text-3)' });
  }
  function render() {
    const f = FR[k]; stage.innerHTML = ''; draw(f);
    narr.innerHTML = ''; narr.className = 'caption' + (f.tone ? ' ' + f.tone : '');
    narr.append(el('div', { class: 'n', text: `${k + 1}/${FR.length}` }), el('div', { class: 't', html: f.c }));
    bStep.disabled = k >= FR.length - 1;
  }
  const stop = () => { gen++; playing = false; bPlay.textContent = '▶ Play'; };
  async function play() {
    if (playing) { stop(); return; }
    if (k >= FR.length - 1) k = 0;
    if (reduced) { k = FR.length - 1; render(); return; }
    playing = true; const g = ++gen; bPlay.textContent = '❚❚ Pause'; render();
    while (g === gen && k < FR.length - 1) { await sleep(2800); if (g !== gen) return; k++; render(); }
    playing = false; bPlay.textContent = '▶ Play';
  }
  bPlay.addEventListener('click', play);
  bStep.addEventListener('click', () => { stop(); if (k < FR.length - 1) { k++; render(); } });
  bReset.addEventListener('click', () => { stop(); k = 0; render(); });
  render();
});
