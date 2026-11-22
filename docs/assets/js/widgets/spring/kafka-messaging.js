/* Kafka with Spring: one partition as offset cells, fetch position and committed offset; batch commit + crash duplicates, blocking retry → DLT, retry topic reordering, max.poll.interval rebalance. */
IA.widget('kafka-messaging', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-km-style')) {
    document.head.append(el('style', { id: 'w-km-style', text: `
.w-km svg text { font-family: var(--mono); }
.w-km .cell { stroke: var(--border); stroke-width: 1.4; fill: var(--surface); transition: fill .3s, stroke .3s; }
.w-km .cell.f { fill: color-mix(in srgb, var(--accent) 14%, var(--surface)); stroke: var(--accent); }
.w-km .cell.p { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2.6; }
.w-km .cell.d { fill: color-mix(in srgb, var(--ok) 16%, var(--surface)); stroke: var(--ok); }
.w-km .cell.x { fill: color-mix(in srgb, var(--err) 16%, var(--surface)); stroke: var(--err); stroke-width: 2.4; }
.w-km .cell.D { fill: color-mix(in srgb, var(--err) 8%, var(--surface)); stroke: var(--err); stroke-dasharray: 4 3; }
.w-km .cell.r { fill: color-mix(in srgb, var(--warn) 10%, var(--surface)); stroke: var(--warn); stroke-dasharray: 4 3; }
.w-km .cell.R { fill: color-mix(in srgb, var(--warn) 22%, var(--surface)); stroke: var(--warn); }
.w-km .cell.U { fill: color-mix(in srgb, var(--warn) 26%, var(--surface)); stroke: var(--warn); stroke-width: 2.4; }
.w-km .con { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.4; }
.w-km .con.hot { stroke: var(--accent); stroke-width: 2.2; } .w-km .con.bad { stroke: var(--err); stroke-width: 2.2; } .w-km .con.dim { opacity: .4; }
` }));
  }
  const NC = 12; const X0 = 50; const CW = 56; const Y = 70;
  const cx = (o) => X0 + o * CW;
  // s: 12-char cell string · pos: fetch position · com: committed offset · con: [{name, text, cls}] · dlt / rt: offsets in side topics
  const SC = {
    batch: { label: 'batch commit + crash', intro: '<code>AckMode.BATCH</code> (the default). Consumer A owns partition 0; the committed offset is 0.',
      steps: [
        { s: 'fffff.......', pos: 5, com: 0, con: [{ n: 'consumer A', t: 'poll() → 0..4', c: 'hot' }], log: 'poll: 5 records (max.poll.records caps this; default 500)', say: '<code>poll()</code> returns records 0–4 and the fetch position moves to 5. The committed offset is still 0: nothing is durable yet.' },
        { s: 'ddpff.......', pos: 5, com: 0, con: [{ n: 'consumer A', t: 'listener(record 2)', c: 'hot' }], say: 'The container calls your <code>@KafkaListener</code> once per record, in order, on the consumer thread.' },
        { s: 'ddddd.......', pos: 5, com: 0, con: [{ n: 'consumer A', t: 'batch done', c: 'hot' }], say: 'All five returned without throwing…' },
        { s: 'ddddd.......', pos: 5, com: 5, con: [{ n: 'consumer A', t: 'commitSync {p0: 5}', c: 'hot' }], log: 'commit offset 5 (= next record to read)', logc: 'o', tone: 'ok', say: '…so the container commits <b>5</b>: the offset of the <i>next</i> record to read, not of the last one processed.' },
        { s: 'dddddddpf...', pos: 9, com: 5, con: [{ n: 'consumer A', t: 'listener(record 7)', c: 'hot' }], say: 'Next poll: 5–8. Records 5 and 6 are done, 7 is in progress…' },
        { s: 'dddddddff...', pos: 9, com: 5, con: [{ n: 'consumer A', t: 'SIGKILL (OOM / deploy)', c: 'bad' }], log: 'pod A killed before the batch commit', logc: 'e', tone: 'err', say: 'The pod is killed. The batch commit never happened: the broker still has <b>5</b> for this group.' },
        { s: 'dddddUUp....', pos: 9, com: 5, con: [{ n: 'consumer A', t: '(gone)', c: 'dim' }, { n: 'consumer B', t: 'assigned p0 → seek 5', c: 'hot' }], log: 'rebalance: p0 → consumer B, starting at committed offset 5', logc: 'e', tone: 'warn', say: 'After the rebalance, consumer B starts at the committed offset. Records <b>5 and 6 run a second time</b>. This is at-least-once delivery, and it is why listeners must be idempotent.' },
        { s: 'ddddddddd...', pos: 9, com: 9, con: [{ n: 'consumer A', t: '(gone)', c: 'dim' }, { n: 'consumer B', t: 'commit {p0: 9}', c: 'hot' }], log: 'commit offset 9', logc: 'o', tone: 'ok', say: 'With a dedupe table keyed by event id, the replays of 5 and 6 are no-ops. <code>AckMode.RECORD</code> would shrink the replay window to at most one record, at the cost of a commit per record.' }] },
    dlt: { label: 'blocking retry → DLT', intro: '<code>DefaultErrorHandler</code> with <code>FixedBackOff(1000, 2)</code> (3 attempts) and a <code>DeadLetterPublishingRecoverer</code>. Record 3 will always throw.',
      steps: [
        { s: 'ffffff......', pos: 6, com: 0, con: [{ n: 'consumer A', t: 'poll() → 0..5', c: 'hot' }], say: 'A poll returns 0–5.' },
        { s: 'dddxff......', pos: 6, com: 0, con: [{ n: 'consumer A', t: 'record 3 threw (attempt 1)', c: 'bad' }], log: 'ListenerExecutionFailedException at offset 3 (attempt 1/3)', logc: 'e', tone: 'err', say: '0–2 succeed. Record 3 throws.' },
        { s: 'dddx........', pos: 3, com: 3, con: [{ n: 'consumer A', t: 'seek(p0, 3) · back off 1 s', c: 'bad' }], log: 'commit 3 (records 0–2) · seek p0 → 3 · discard 4, 5', say: 'The error handler keeps what succeeded (offset 3 committed), <b>seeks</b> the partition back to 3 and drops the rest of the batch from memory. Then it waits for the back-off, on the consumer thread.' },
        { s: 'dddxff......', pos: 6, com: 3, con: [{ n: 'consumer A', t: 'record 3 threw (attempt 2)', c: 'bad' }], log: 'redelivered 3 → fails (attempt 2/3)', logc: 'e', tone: 'err', say: 'The next poll returns 3, 4, 5 again. Record 3 fails again. Records 4 and 5 are <b>blocked</b> behind it: partition order is preserved.' },
        { s: 'dddxff......', pos: 6, com: 3, con: [{ n: 'consumer A', t: 'record 3 threw (attempt 3)', c: 'bad' }], log: 'attempt 3/3 fails → back-off exhausted', logc: 'e', tone: 'err', say: 'Third and last attempt fails. Total blocking time must stay well under <code>max.poll.interval.ms</code>, or the consumer would be evicted.' },
        { s: 'dddDff......', pos: 6, com: 4, dlt: [3], con: [{ n: 'consumer A', t: 'recoverer → orders.DLT', c: 'hot' }], log: 'DeadLetterPublishingRecoverer → orders.DLT partition 0 (+ exception headers) · commit 4', logc: 'o', tone: 'warn', say: 'The recoverer publishes record 3 to <code>orders.DLT</code> (same partition number), with headers holding the exception class, message and original offset. Then offset <b>4</b> is committed: the bad record is “handled”.' },
        { s: 'dddDdd......', pos: 6, com: 6, dlt: [3], con: [{ n: 'consumer A', t: 'commit {p0: 6}', c: 'hot' }], log: 'records 4, 5 processed · commit 6', logc: 'o', tone: 'ok', say: 'The partition moves on. Someone must watch the DLT: alert on it, fix the cause and replay. Without a recoverer the default just <b>logs</b> the record and skips it.' }] },
    rt: { label: 'retry topic (non-blocking)', intro: '<code>@RetryableTopic(attempts = "3", backoff = @Backoff(2000))</code>. Record 3 fails once because a downstream is briefly down. All records have the same key.',
      steps: [
        { s: 'ffffff......', pos: 6, com: 0, con: [{ n: 'main consumer', t: 'poll() → 0..5', c: 'hot' }, { n: 'retry consumer', t: 'idle', c: 'dim' }], say: 'Same poll.' },
        { s: 'dddxff......', pos: 6, com: 0, con: [{ n: 'main consumer', t: 'record 3 threw', c: 'bad' }, { n: 'retry consumer', t: 'idle', c: 'dim' }], log: 'record 3 failed (attempt 1/3)', logc: 'e', tone: 'err', say: 'Record 3 throws.' },
        { s: 'dddrff......', pos: 6, com: 0, rt: [3], con: [{ n: 'main consumer', t: 'forward 3 → retry topic', c: 'hot' }, { n: 'retry consumer', t: 'holds 3 until +2 s', c: 'hot' }], log: 'forwarded to orders-retry (header: backoff due at t+2 s)', say: 'Instead of blocking, the record is <b>forwarded</b> to a retry topic with a “not before” timestamp header. For the main topic it counts as handled.' },
        { s: 'dddrdd......', pos: 6, com: 6, rt: [3], con: [{ n: 'main consumer', t: 'commit {p0: 6}', c: 'hot' }, { n: 'retry consumer', t: 'paused until due', c: 'hot' }], log: 'main: 4, 5 processed · commit 6', logc: 'o', say: 'Records 4 and 5 are processed right away. Throughput is unaffected…' },
        { s: 'dddRdd......', pos: 6, com: 6, rt: [3], con: [{ n: 'main consumer', t: 'polling', c: 'hot' }, { n: 'retry consumer', t: 'record 3 ✓ (attempt 2)', c: 'hot' }], log: 'retry: record 3 succeeded after 4 and 5', logc: 'o', tone: 'warn', say: '…but record 3 succeeds <b>after</b> 4 and 5. If 3 was <code>OrderPlaced</code> and 5 was <code>OrderCancelled</code> for the same order, the cancel was applied to an order that didn’t exist yet. Non-blocking retry trades ordering for throughput.' }] },
    slow: { label: 'slow listener → rebalance', intro: 'Each record calls a slow API. <code>max.poll.interval.ms</code> = 300 000 (5 min, default). Consumer B is in the group too, owning other partitions.',
      steps: [
        { s: 'fffff.......', pos: 5, com: 0, con: [{ n: 'consumer A', t: 'poll() → 0..4', c: 'hot' }, { n: 'consumer B', t: 'owns p1', c: '' }], say: 'Consumer A polls 0–4. The clock for <code>max.poll.interval.ms</code> starts now.' },
        { s: 'ddpff.......', pos: 5, com: 0, con: [{ n: 'consumer A', t: 'record 2: API call…', c: 'hot' }, { n: 'consumer B', t: 'owns p1', c: '' }], say: 'Each record waits on a downstream API that has slowed to over a minute per call, with no client timeout.' },
        { s: 'ddpff.......', pos: 5, com: 0, con: [{ n: 'consumer A', t: 'no poll for 5 min', c: 'bad' }, { n: 'consumer B', t: 'rebalance!', c: 'hot' }], log: 'consumer poll timeout has expired … leaving group', logc: 'e', tone: 'err', say: 'Heartbeats still flow (a background thread sends them), but A hasn’t called <code>poll()</code> for 5 minutes. The client leaves the group and a <b>rebalance</b> starts.' },
        { s: 'UUpff.......', pos: 5, com: 0, con: [{ n: 'consumer A', t: 'still in record 2', c: 'bad' }, { n: 'consumer B', t: 'owns p0 → seek 0', c: 'hot' }], log: 'p0 → consumer B, committed offset 0', logc: 'e', tone: 'warn', say: 'B gets partition 0 and starts at the committed offset, <b>0</b>. Records 0 and 1 are processed again, while A is still working on 2: now two consumers handle the same partition at once.' },
        { s: 'ddddd.......', pos: 5, com: 5, con: [{ n: 'consumer A', t: 'CommitFailedException', c: 'bad' }, { n: 'consumer B', t: 'commit {p0: 5}', c: 'hot' }], log: 'A: CommitFailedException (not part of the group any more)', logc: 'e', tone: 'err', say: 'A finally finishes and tries to commit, but it no longer owns the partition: <code>CommitFailedException</code>. Fix: client timeouts, fewer <code>max.poll.records</code>, a larger interval, and idempotent processing.' }] }
  };
  let sc = 'batch'; let k = 0; let gen = 0; let running = false; let speed = 2300; let st;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(SC).map((x) => [x, SC[x].label]), sc, (v) => { sc = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3400, 'Slow'], [2300, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 300', role: 'img', 'aria-label': 'Partition 0 of the orders topic as offset cells, with fetch position, committed offset, consumers and side topics' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-log', 'aria-label': 'Consumer log' });
  const legend = el('div', { class: 'legend', style: { marginTop: '6px' } });
  [['in memory', 'var(--accent)'], ['done', 'var(--ok)'], ['failing / DLT', 'var(--err)'], ['duplicate / retry', 'var(--warn)']].forEach(([t, c]) => legend.append(el('span', {}, el('i', { style: { background: c } }), t)));
  root.classList.add('w-km');
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage), legend,
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, log);
  const SYM = { d: '✓', x: '✗', D: '→DLT', r: '→retry', R: '✓ late', U: '✓ ×2', p: '…' };
  function render() {
    stage.innerHTML = '';
    stage.append(svg('text', { x: X0, y: 22, 'font-size': 12.5, 'font-weight': 700, fill: 'var(--text)', text: 'topic orders · partition 0' }),
      svg('text', { x: X0 + NC * CW - 4, y: 22, 'font-size': 11, fill: 'var(--text-3)', 'text-anchor': 'end', text: 'group billing' }));
    for (let o = 0; o < NC; o++) {
      const ch = st.s[o]; const cls = ch === '.' ? '' : ch;
      stage.append(svg('rect', { class: 'cell ' + cls, x: cx(o) + 2, y: Y, width: CW - 4, height: 44, rx: 6 }),
        svg('text', { x: cx(o) + CW / 2, y: Y - 6, 'font-size': 10.5, fill: 'var(--text-3)', 'text-anchor': 'middle', text: String(o) }));
      if (SYM[ch]) stage.append(svg('text', { x: cx(o) + CW / 2, y: Y + 27, 'font-size': ch.length && SYM[ch].length > 2 ? 10 : 14, 'font-weight': 700, 'text-anchor': 'middle', fill: ch === 'd' ? 'var(--ok)' : ch === 'x' || ch === 'D' ? 'var(--err)' : ch === 'p' ? 'var(--accent)' : 'var(--warn)', text: SYM[ch] }));
    }
    // fetch position (arrow above) & committed offset (flag below)
    const px = cx(st.pos);
    stage.append(svg('path', { d: `M${px} ${Y - 34} L${px} ${Y - 18} M${px - 5} ${Y - 23} L${px} ${Y - 16} L${px + 5} ${Y - 23}`, stroke: 'var(--accent)', 'stroke-width': 2, fill: 'none' }),
      svg('text', { x: px + 6, y: Y - 26, 'font-size': 10.5, fill: 'var(--accent)', text: 'position ' + st.pos }));
    const fx = cx(st.com);
    stage.append(svg('path', { d: `M${fx} ${Y + 48} L${fx} ${Y + 76} M${fx} ${Y + 52} L${fx + 14} ${Y + 57} L${fx} ${Y + 62}`, stroke: 'var(--ok)', 'stroke-width': 2.2, fill: 'var(--ok)' }),
      svg('text', { x: fx + 18, y: Y + 70, 'font-size': 10.5, fill: 'var(--ok)', 'font-weight': 700, text: 'committed ' + st.com }));
    // consumers
    (st.con || []).forEach((c, j) => { const x = 50 + j * 340;
      stage.append(svg('rect', { class: 'con ' + (c.c || ''), x, y: 166, width: 320, height: 46, rx: 9 }),
        svg('text', { x: x + 12, y: 185, 'font-size': 12, 'font-weight': 700, fill: 'var(--text)', text: c.n }),
        svg('text', { x: x + 12, y: 203, 'font-size': 11.5, fill: c.c === 'bad' ? 'var(--err)' : 'var(--text-2)', text: c.t })); });
    // side topics
    const side = (y, name, list, col) => { stage.append(svg('text', { x: 50, y: y + 19, 'font-size': 11.5, fill: 'var(--text-3)', text: name }));
      for (let j = 0; j < 6; j++) { const x = 190 + j * 46; const v = list && list[j];
        stage.append(svg('rect', { x, y, width: 40, height: 28, rx: 5, fill: v != null ? `color-mix(in srgb, ${col} 14%, var(--surface))` : 'var(--surface)', stroke: v != null ? col : 'var(--border)', 'stroke-width': 1.3 }));
        if (v != null) stage.append(svg('text', { x: x + 20, y: y + 18, 'font-size': 11, 'text-anchor': 'middle', fill: col, 'font-weight': 700, text: '#' + v })); } };
    side(226, 'orders.DLT', st.dlt, 'var(--err)');
    side(262, 'retry topic', st.rt, 'var(--warn)');
    log.innerHTML = ''; st.log.forEach(([t, cl]) => log.append(el('div', { text: t, style: { color: cl === 'e' ? 'var(--err)' : cl === 'o' ? 'var(--ok)' : '' } }))); log.scrollTop = log.scrollHeight;
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${SC[sc].steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; st = { s: '............', pos: 0, com: 0, con: [{ n: 'consumer A', t: 'assigned p0', c: '' }], log: [] }; render(); say(SC[sc].intro); bStep.disabled = false; }
  function step() {
    const steps = SC[sc].steps; if (k >= steps.length) return false; const s = steps[k++];
    const logs = st.log; st = Object.assign({}, s, { log: logs });
    if (s.log) logs.push([s.log, s.logc]);
    render(); say(s.say, s.tone);
    if (k >= steps.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= SC[sc].steps.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
