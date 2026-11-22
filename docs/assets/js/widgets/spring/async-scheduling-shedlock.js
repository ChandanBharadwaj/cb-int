/* @Scheduled on three pods: no lock (runs everywhere), ShedLock (one runs), a crashed lock holder (lockAtMostFor) and clock skew with a fast job (lockAtLeastFor). */
IA.widget('async-scheduling-shedlock', (root, ctx) => {
  const { el, svg, sleep } = ctx;
  const PODS = ['pod-a', 'pod-b', 'pod-c'];
  const SC = {
    none: { label: 'no lock', unit: 'min', max: 12, intro: '<code>@Scheduled(cron = "0 0 6 * * *")</code> on 3 replicas. The job takes about 4 minutes.',
      steps: [
        { now: 0, marks: [[0, 0, 'fire'], [1, 0, 'fire'], [2, 0, 'fire']], say: '06:00:00. Each JVM has its own scheduler, and each fires on time.' },
        { now: 4, bars: [[0, 0, 4, 'bad'], [1, 0, 4.2, 'bad'], [2, 0, 3.9, 'bad']], tone: 'err', say: 'All three run the whole job: three batches of invoice emails. Scheduling is per JVM; nothing in Spring coordinates instances.' }] },
    lock: { label: 'ShedLock', unit: 'min', max: 12, intro: 'Same job with <code>@SchedulerLock(name = "sendInvoices", lockAtMostFor = "PT20M", lockAtLeastFor = "PT1M")</code> and a JDBC lock table.',
      steps: [
        { now: 0, marks: [[0, 0, 'fire'], [1, 0, 'fire'], [2, 0, 'fire']], lock: ['06:00 (free)', '—'], say: 'All three fire. Before running, each tries to take the lock in one statement.' },
        { now: 0.1, marks: [[0, 0, '✓ lock'], [1, 0, 'skip'], [2, 0, 'skip']], lock: ['06:20 (now + lockAtMostFor)', 'pod-a'], sql: "UPDATE shedlock SET lock_until = now() + '20 min', locked_by = 'pod-a' WHERE name = 'sendInvoices' AND lock_until <= now()", say: 'Only one <code>UPDATE … WHERE lock_until &lt;= now()</code> can match the row. pod-a gets 1 row updated and runs; pod-b and pod-c get 0 rows and <b>skip</b> this run (they don’t wait or retry).' },
        { now: 4, bars: [[0, 0, 4, 'ok']], marks: [[1, 0, 'skip'], [2, 0, 'skip']], lock: ['06:04 (released)', 'pod-a'], tone: 'ok', say: 'pod-a finishes after 4 min and releases the lock: <code>lock_until</code> becomes max(now, locked_at + lockAtLeastFor). One run in the cluster.' }] },
    crash: { label: 'holder crashes', unit: 'min', max: 32, intro: 'Cron every 10 minutes, <code>lockAtMostFor = "PT15M"</code>. pod-a is killed 2 minutes into a run.',
      steps: [
        { now: 0.1, marks: [[0, 0, '✓ lock'], [1, 0, 'skip'], [2, 0, 'skip']], lock: ['06:15', 'pod-a'], say: '06:00: pod-a takes the lock until 06:15.' },
        { now: 2, bars: [[0, 0, 2, 'bad']], marks: [[0, 2, '✗ killed'], [1, 0, 'skip'], [2, 0, 'skip']], lock: ['06:15 (holder dead)', 'pod-a'], tone: 'err', say: 'pod-a dies (OOM, node drain). It never releases the lock; the row still says 06:15.' },
        { now: 10.1, bars: [[0, 0, 2, 'bad']], marks: [[0, 2, '✗ killed'], [1, 0, 'skip'], [2, 0, 'skip'], [1, 10, 'skip'], [2, 10, 'skip']], lock: ['06:15 (holder dead)', 'pod-a'], tone: 'warn', say: '06:10: pod-b and pod-c fire, but the lock is still held: this run is <b>skipped</b>. That is the price of a long <code>lockAtMostFor</code>.' },
        { now: 24, bars: [[0, 0, 2, 'bad'], [1, 20, 24, 'ok']], marks: [[0, 2, '✗ killed'], [1, 0, 'skip'], [2, 0, 'skip'], [1, 10, 'skip'], [2, 10, 'skip'], [1, 20, '✓ lock'], [2, 20, 'skip']], lock: ['06:24 (released)', 'pod-b'], tone: 'ok', say: '06:20: the lock expired at 06:15, so pod-b takes it and runs. Rule of thumb: <code>lockAtMostFor</code> well above the longest normal run (or a second instance may start while the first is still working), short enough that a dead holder doesn’t block for long.' }] },
    skew: { label: 'fast job + clock skew', unit: 's', max: 70, intro: 'The job takes 200 ms. pod-c’s clock is 2 s behind. First without <code>lockAtLeastFor</code>.',
      steps: [
        { now: 0.3, bars: [[0, 0, 0.2, 'ok']], marks: [[0, 0, '✓ lock'], [1, 0, 'skip']], lock: ['06:00:00.2 (released)', 'pod-a'], say: 'pod-a and pod-b fire at 06:00:00. pod-a wins, runs for 200 ms and releases the lock at 06:00:00.2.' },
        { now: 2.2, bars: [[0, 0, 0.2, 'ok'], [2, 2, 2.2, 'bad']], marks: [[0, 0, '✓ lock'], [1, 0, 'skip'], [2, 2, '✓ lock (again!)']], lock: ['06:00:02.2 (released)', 'pod-c'], tone: 'err', say: 'pod-c’s scheduler fires at <i>its</i> 06:00:00, which is 06:00:02 in real time. The lock is free again, so the job runs a <b>second</b> time.' },
        { now: 60, bars: [[0, 0, 0.2, 'ok']], marks: [[0, 0, '✓ lock'], [1, 0, 'skip'], [2, 2, 'skip']], lock: ['06:01:00 (lockAtLeastFor)', 'pod-a'], tone: 'ok', say: 'With <code>lockAtLeastFor = "PT1M"</code>, releasing sets <code>lock_until</code> to 06:01:00, so pod-c finds it held and skips. <code>usingDbTime()</code> makes all instances compare against the database clock too.' }] }
  };
  let sc = 'none'; let k = 0; let gen = 0; let running = false; let st = {};
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(SC).map((x) => [x, SC[x].label]), sc, (v) => { sc = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 760 250', role: 'img', 'aria-label': 'Timeline of a scheduled job on three pods and the ShedLock table row' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const sqlBox = el('div', { class: 'w-log' });
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, sqlBox);
  function render() {
    const S = SC[sc]; stage.innerHTML = '';
    const X0 = 80; const W = 660; const tx = (t) => X0 + (t / S.max) * W; const ry = (i) => 30 + i * 46;
    PODS.forEach((p, i) => { stage.append(svg('text', { x: 12, y: ry(i) + 20, 'font-size': 12, 'font-weight': 700, 'font-family': 'var(--mono)', fill: 'var(--text)', text: p }), svg('path', { d: `M${X0} ${ry(i) + 16} L${X0 + W} ${ry(i) + 16}`, stroke: 'var(--border)', 'stroke-dasharray': '3 4' })); });
    const step = S.unit === 'min' ? (S.max > 20 ? 10 : 2) : 10;
    for (let t = 0; t <= S.max; t += step) stage.append(svg('text', { x: tx(t), y: 160, 'font-size': 10, 'text-anchor': 'middle', 'font-family': 'var(--mono)', fill: 'var(--text-3)', text: S.unit === 'min' ? `06:${String(t).padStart(2, '0')}` : `+${t}s` }));
    (st.bars || []).forEach(([i, a, b, c]) => stage.append(svg('rect', { x: tx(a), y: ry(i) + 6, width: Math.max(4, tx(b) - tx(a)), height: 20, rx: 4, fill: c === 'bad' ? 'var(--err)' : 'var(--ok)', opacity: 0.8 })));
    (st.marks || []).forEach(([i, t, txt]) => stage.append(svg('text', { x: tx(t) + 4, y: ry(i) + 40, 'font-size': 10.5, 'font-family': 'var(--mono)', fill: txt.startsWith('skip') ? 'var(--text-3)' : txt.startsWith('✗') || txt.includes('again') ? 'var(--err)' : txt.startsWith('✓') ? 'var(--ok)' : 'var(--accent)', text: txt })));
    if (st.now != null) { const x = tx(st.now); stage.append(svg('path', { d: `M${x} 22 L${x} 150`, stroke: 'var(--accent)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' })); }
    stage.append(svg('rect', { x: 80, y: 176, width: 660, height: 62, rx: 9, fill: 'var(--surface-2)', stroke: 'var(--border)' }));
    const cols = [92, 196, 340, 610]; const T = (x, y, t, o) => stage.append(svg('text', Object.assign({ x, y, 'font-size': 11, 'font-family': 'var(--mono)', fill: 'var(--text-3)', text: t }, o || {})));
    if (sc === 'none') T(92, 212, 'no shedlock table: nothing coordinates the pods');
    else {
      ['table shedlock', 'name', 'lock_until', 'locked_by'].forEach((h, j) => T(cols[j], 196, h));
      const vals = st.lock ? ['', 'sendInvoices', st.lock[0], st.lock[1]] : ['', 'sendInvoices', '(no row yet)', ''];
      vals.forEach((v, j) => T(cols[j], 222, v, { 'font-size': 12, 'font-weight': 700, fill: 'var(--text)' }));
    }
    sqlBox.textContent = st.sql || '';
    sqlBox.style.display = st.sql ? '' : 'none';
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${SC[sc].steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; st = {}; render(); say(SC[sc].intro); bStep.disabled = false; }
  function step() { const steps = SC[sc].steps; if (k >= steps.length) return false; st = steps[k++]; render(); say(st.say, st.tone); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= SC[sc].steps.length) reset();
    if (ctx.reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(2800);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
