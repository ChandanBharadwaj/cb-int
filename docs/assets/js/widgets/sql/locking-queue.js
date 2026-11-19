/* Job queue: three workers claim jobs with FOR UPDATE, FOR UPDATE NOWAIT, or FOR UPDATE SKIP LOCKED. */
IA.widget('locking-queue', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'skip'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['plain', 'FOR UPDATE'], ['nowait', 'FOR UPDATE NOWAIT'], ['skip', 'FOR UPDATE SKIP LOCKED']], () => mode, (v) => { mode = v; reset(); }, 'Claim query');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const code = el('div'); const st = svg('svg', { viewBox: '0 0 520 250', role: 'img', 'aria-label': 'Three workers on the left, six jobs on the right' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), code, el('div', { class: 'w-stage' }, st), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const COL = ['var(--accent)', 'var(--ok)', 'var(--warn)'];
  let jobs; let W; let done;
  function draw() {
    st.innerHTML = '';
    W.forEach((w, i) => { const y = 30 + i * 75;
      st.append(svg('rect', { x: 10, y, width: 150, height: 52, rx: 9, fill: 'var(--surface-2)', stroke: COL[i], 'stroke-width': 2 }),
        svg('text', { x: 22, y: y + 21, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: 'worker ' + (i + 1) }),
        svg('text', { x: 22, y: y + 40, 'font-size': 12, fill: w.st === 'ERROR' ? 'var(--err)' : w.st === 'waiting' ? 'var(--warn)' : 'var(--text-2)', text: w.st }));
      if (w.job != null) { const jy = 20 + w.job * 37 + 14; st.append(svg('path', { d: `M160 ${y + 26} C 240 ${y + 26}, 260 ${jy}, 330 ${jy}`, fill: 'none', stroke: COL[i], 'stroke-width': 2, 'stroke-dasharray': w.st === 'waiting' ? '5 4' : '' })); } });
    jobs.forEach((j, i) => { const y = 20 + i * 37;
      st.append(svg('rect', { x: 330, y, width: 180, height: 28, rx: 7, fill: j.done ? 'var(--surface)' : j.by != null ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: j.by != null ? COL[j.by] : 'var(--border)', 'stroke-width': j.by != null ? 2 : 1, opacity: j.done ? 0.45 : 1 }),
        svg('text', { x: 342, y: y + 19, 'font-size': 12.5, fill: 'var(--text)', text: `job ${i + 1} · ${j.done ? 'done' : j.by != null ? 'locked by w' + (j.by + 1) : 'ready'}` })); });
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `jobs done <b>${done}</b>/6` }), el('span', { class: 'w-stat', html: `workers busy <b>${W.filter((w) => w.st.startsWith('processing')).length}</b>/3` }));
  }
  function plan() {
    const s = [];
    const claim = (wi, label) => ({ run: () => {
      const w = W[wi]; const free = jobs.findIndex((j) => !j.done && j.by == null); const first = jobs.findIndex((j) => !j.done);
      if (mode === 'skip') { if (free < 0) { w.st = 'idle (0 rows)'; w.job = null; return; } jobs[free].by = wi; w.job = free; w.st = 'processing job ' + (free + 1); w.msg = `skips locked rows and claims job ${free + 1}`; return; }
      // plain/nowait: ORDER BY id LIMIT 1 always targets the first not-done job
      if (jobs[first].by == null) { jobs[first].by = wi; w.job = first; w.st = 'processing job ' + (first + 1); w.msg = `claims job ${first + 1}`; return; }
      w.job = first; if (mode === 'nowait') { w.st = 'ERROR'; w.msg = `hits job ${first + 1}, which is locked: <code>ERROR: could not obtain lock on row in relation "jobs"</code>. The worker must catch it and retry`; } else { w.st = 'waiting'; w.msg = `also picks job ${first + 1} (the same ORDER BY id LIMIT 1) and <b>blocks</b> until worker ${jobs[first].by + 1} commits`; }
    }, t: () => `Worker ${wi + 1} ${W[wi].msg || 'finds nothing'}.` + (label || '') });
    s.push(claim(0)); s.push(claim(1)); s.push(claim(2));
    s.push({ run: () => { const w = W[0]; jobs[w.job].done = true; jobs[w.job].by = null; done++; w.st = 'COMMIT'; w.job = null;
      if (mode === 'plain') { W.forEach((o) => { if (o.st === 'waiting') { o.st = 'rechecks: row is done → 0 rows'; o.job = null; } }); } },
      t: () => mode === 'plain' ? 'Worker 1 commits. The waiters wake up, re-check the WHERE clause on the new row version (status is now done) and get <b>0 rows</b>, so they have to loop and try again. Three workers, one at a time: a convoy.' : mode === 'nowait' ? 'Worker 1 commits. Workers 2 and 3 are in their retry back-off. NOWAIT is right when you want to fail fast (e.g. a user clicking “edit”), not for a queue.' : 'Worker 1 commits job 1 while workers 2 and 3 are still busy. Throughput scales with the number of workers.' });
    if (mode === 'skip') s.push({ run: () => { W.forEach((w, i) => { if (w.job != null) { jobs[w.job].done = true; jobs[w.job].by = null; done++; w.job = null; w.st = 'COMMIT'; } }); [0, 1, 2].forEach((i) => { const f = jobs.findIndex((j) => !j.done && j.by == null); if (f >= 0) { jobs[f].by = i; W[i].job = f; W[i].st = 'processing job ' + (f + 1); } }); }, t: 'Next round: all three claim jobs 4, 5 and 6 in parallel. SKIP LOCKED gives an inconsistent view on purpose: fine for queues, wrong for reports.' });
    else s.push({ run: () => { W.forEach((w, i) => { w.job = null; w.st = 'retrying'; }); const f = jobs.findIndex((j) => !j.done); jobs[f].by = 1; W[1].job = f; W[1].st = 'processing job ' + (f + 1); }, t: 'On retry, only one worker wins job 2 and the others collide again. Switch to SKIP LOCKED to see the fix.' });
    return s;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; done = 0; jobs = Array.from({ length: 6 }, () => ({ by: null, done: false })); W = [0, 1, 2].map(() => ({ st: 'idle', job: null })); steps = plan(); bStep.disabled = false;
    code.innerHTML = ''; code.append(ctx.codeBox(`BEGIN;\nSELECT id FROM jobs WHERE status = 'ready'\nORDER BY id LIMIT 1\n${mode === 'plain' ? 'FOR UPDATE' : mode === 'nowait' ? 'FOR UPDATE NOWAIT' : 'FOR UPDATE SKIP LOCKED'};\n-- process, then UPDATE jobs SET status = 'done' …; COMMIT;`, 'sql'));
    draw(); say('Three workers poll the same jobs table. Pick the claim query and press Play.'); }
  function step() { if (k >= steps.length) return false; const x = steps[k++]; x.run(); draw(); say(typeof x.t === 'function' ? x.t() : x.t); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => { if (running) { running = false; bPlay.textContent = '▶ Play'; return; } if (k >= steps.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen; while (running && g === gen && step()) await sleep(reduced ? 700 : speed); if (g === gen) { running = false; bPlay.textContent = '▶ Play'; } });
  reset();
});
