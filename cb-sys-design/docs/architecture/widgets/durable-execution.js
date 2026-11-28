/* Replay lab: a tiny workflow interpreter with a real history cursor.
   Commands the code emits are matched against recorded events; a match returns the saved result (replay),
   a mismatch is a non-determinism error, and running past the end of the history issues a new command. */
SD.widget('durable-execution', function (root, ctx) {
  const { el, svg } = ctx;
  const PROGRAMS = {
    v1: [{ op: 'act', name: 'reserveStock' }, { op: 'act', name: 'chargeCard' }, { op: 'timer', name: '3 days' }, { op: 'act', name: 'shipOrder' }],
    v2: [{ op: 'act', name: 'reserveStock' }, { op: 'act', name: 'fraudCheck', isNew: true }, { op: 'act', name: 'chargeCard' }, { op: 'timer', name: '3 days' }, { op: 'act', name: 'shipOrder' }],
    v2p: [{ op: 'act', name: 'reserveStock' }, { op: 'act', name: 'fraudCheck', patch: 'fraud-check', isNew: true }, { op: 'act', name: 'chargeCard' }, { op: 'timer', name: '3 days' }, { op: 'act', name: 'shipOrder' }]
  };
  const lineText = (o) => (o.patch ? 'if patched(): ' : '') + (o.op === 'timer' ? 'sleep(' + o.name + ')' : o.name + '()');
  const opt = { ver: 'v1', idem: true, flaky: false };
  let history, fx, memory, view, gen = 0, busy = false, counters;

  function reset() {
    history = [{ k: 'start' }]; fx = { reserveStock: 0, fraudCheck: 0, chargeCard: 0, shipOrder: 0 };
    memory = 'fresh'; view = null; counters = { runs: 0, replayed: 0 };
  }
  // ---- the replay algorithm -------------------------------------------------
  // Walk the program with a cursor over the command events already in the history.
  function evaluate(ver, live) {
    const cmds = [];
    history.forEach((e, i) => {
      if (e.k === 'sched') cmds.push({ k: 'sched', name: e.name, done: history.some((x, j) => j > i && x.k === 'done' && x.name === e.name) });
      else if (e.k === 'tstart') cmds.push({ k: 'tstart', done: history.some((x) => x.k === 'tfire') });
      else if (e.k === 'marker') cmds.push({ k: 'marker', id: e.id, done: true });
    });
    let cur = 0; const trace = [];
    const prog = PROGRAMS[ver];
    for (let line = 0; line < prog.length; line++) {
      const op = prog[line];
      if (op.patch) {                                   // patched(id): true for new runs, false when replaying an old history
        let taken;
        if (cur < cmds.length) { taken = cmds[cur].k === 'marker' && cmds[cur].id === op.patch; if (taken) cur++; }
        else { taken = true; if (live) { history.push({ k: 'marker', id: op.patch }); } else return { next: { line, op }, trace }; cmds.push({ k: 'marker', id: op.patch, done: true }); cur++; }
        if (!taken) { trace[line] = 'skip'; continue; }
      }
      const wantK = op.op === 'act' ? 'sched' : 'tstart';
      if (cur < cmds.length) {
        const c = cmds[cur];
        if (c.k !== wantK || (wantK === 'sched' && c.name !== op.name)) return { error: { line, want: op, got: c, cursorIdx: cur }, trace };
        cur++;
        if (c.done) { trace[line] = 'done'; continue; }
        return { waiting: { line, op }, trace };
      }
      return { next: { line, op }, trace };
    }
    return { finished: true, trace };
  }
  const evName = (e) => ({ start: 'WorkflowStarted', sched: 'ActivityScheduled', done: 'ActivityCompleted', tstart: 'TimerStarted', tfire: 'TimerFired', marker: 'MarkerRecorded', end: 'WorkflowCompleted' })[e.k];
  const evArg = (e) => (e.name || e.id || (e.k === 'tstart' ? '3 days' : ''));

  function build(narrow) {
    const my = ++gen; busy = false;
    root.innerHTML = '';
    const W = narrow ? 360 : 700;
    const stepB = el('button', { class: 'btn primary', text: '▶ Step' });
    const crashB = el('button', { class: 'btn', text: '💥 Crash worker' });
    const resetB = el('button', { class: 'btn', text: 'Reset' });
    const verWrap = el('div', { class: 'w-seg', role: 'group', 'aria-label': 'Deployed code' });
    const verBtns = [['v1', 'v1'], ['v2', 'v2: add step'], ['v2p', 'v2 + patch']].map(([v, l]) => {
      const b = el('button', { class: 'btn', text: l }); b._v = v;
      b.onclick = () => { if (busy || opt.ver === v) return; opt.ver = v; syncCtl(); deploy(); };
      verWrap.append(b); return b;
    });
    const tog = (label, key) => { const b = el('button', { class: 'btn' }); b._sync = () => { b.textContent = label + ': ' + (opt[key] ? 'on' : 'off'); b.classList.toggle('primary', !!opt[key]); }; b.onclick = () => { opt[key] = !opt[key]; b._sync(); }; b._sync(); return b; };
    const idemB = tog('🛡 Idempotent activities', 'idem'), flakyB = tog('⚡ Next activity dies after its work', 'flaky');
    root.append(el('div', { class: 'w-controls' }, stepB, crashB,
      el('label', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } }, 'Deploy ', verWrap), flakyB, idemB, resetB));
    const stage = el('div', { class: 'w-stage' });
    const stats = el('div', { class: 'w-stats' });
    const log = el('div', { class: 'w-log', 'aria-live': 'polite' });
    root.append(stage, stats, log);
    const say = (t) => { if (my !== gen) return; log.prepend(el('div', { html: t })); while (log.children.length > 40) log.lastChild.remove(); };
    const wait = (ms) => new Promise((r) => setTimeout(r, ctx.reduced ? 0 : ms));
    function syncCtl() { verBtns.forEach((b) => b.classList.toggle('primary', b._v === opt.ver)); flakyB._sync(); idemB._sync(); }

    function draw(reveal) {
      // reveal: during an animated replay, only lines < reveal show their status
      const r = evaluate(opt.ver, false);
      const prog = PROGRAMS[opt.ver];
      const lh = 30, codeH = 34 + prog.length * lh + 8, evH = 22;
      const maxEv = 13;
      const histX = narrow ? 0 : 372, histY = narrow ? codeH + 14 : 0, colW = narrow ? W : 328;
      const H = narrow ? codeH + 14 + 34 + maxEv * evH + 8 : Math.max(codeH, 34 + maxEv * evH + 8);
      const S = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Workflow code and its event history' });
      const T = (x, y, t, f, w, fill, a, mono) => svg('text', { x, y, text: t, 'text-anchor': a || 'start', fill: fill || 'var(--text)', style: `font:${w || 600} ${f}px var(--${mono ? 'mono' : 'sans'})` });
      const cw = narrow ? W : 348;
      S.append(svg('rect', { x: 1, y: 1, width: cw - 2, height: codeH - 2, rx: 10, fill: 'var(--surface-2)', stroke: memory === 'lost' ? 'var(--err)' : 'var(--border)', 'stroke-width': 2 }));
      S.append(T(12, 23, 'Workflow code · ' + (opt.ver === 'v1' ? 'v1' : opt.ver === 'v2' ? 'v2 (no guard)' : 'v2 patched'), 14, 700, 'var(--text-3)'));
      prog.forEach((op, i) => {
        const y = 34 + i * lh;
        let st = r.trace[i] || '';
        const isErr = r.error && r.error.line === i, isCur = (r.next && r.next.line === i) || (r.waiting && r.waiting.line === i);
        if (memory === 'lost') st = '';
        const shown = reveal === undefined || i < reveal;
        let mark = '', col = 'var(--text-3)', bg = null;
        if (memory !== 'lost' && shown) {
          if (isErr) { mark = '✖'; col = 'var(--err)'; bg = 'var(--err)'; }
          else if (st === 'done') { mark = view === 'replayed' ? '↺' : '✓'; col = view === 'replayed' ? 'var(--accent)' : 'var(--ok)'; }
          else if (st === 'skip') { mark = '–'; col = 'var(--text-3)'; }
          else if (isCur) { mark = r.waiting ? '⏳' : '▶'; col = 'var(--warn)'; bg = 'var(--warn)'; }
        }
        if (reveal !== undefined && i === reveal) bg = 'var(--accent)';
        if (bg) S.append(svg('rect', { x: 6, y: y + 2, width: cw - 12, height: lh - 4, rx: 6, fill: bg, 'fill-opacity': 0.14 }));
        S.append(T(22, y + 21, mark, 14, 700, col, 'middle'));
        S.append(T(38, y + 21, lineText(op), 14, 600, op.isNew ? 'var(--accent)' : 'var(--text)', 'start', true));
        const tag = !shown || memory === 'lost' ? '' : isErr ? 'mismatch' : st === 'done' ? (view === 'replayed' ? 'from history' : 'done') : st === 'skip' ? 'old path' : isCur && r.waiting ? 'asleep' : '';
        if (tag) S.append(T(cw - 12, y + 21, tag, 13, 600, col, 'end'));
      });
      // history panel
      S.append(svg('rect', { x: histX + 1, y: histY + 1, width: colW - 2, height: 34 + maxEv * evH + 6, rx: 10, fill: 'var(--surface)', stroke: 'var(--border)', 'stroke-width': 2 }));
      S.append(T(histX + 12, histY + 23, 'Event history · append-only', 14, 700, 'var(--text-3)'));
      history.forEach((e, i) => {
        const y = histY + 34 + i * evH;
        const hit = r.error && e === history.filter((x) => x.k === 'sched' || x.k === 'tstart' || x.k === 'marker')[r.error.cursorIdx];
        S.append(T(histX + 28, y + 16, String(i + 1), 13, 600, 'var(--text-3)', 'end', true));
        S.append(T(histX + 36, y + 16, evName(e), 13, 600, hit ? 'var(--err)' : e.k === 'done' || e.k === 'tfire' || e.k === 'end' ? 'var(--ok)' : 'var(--text)', 'start', true));
        if (evArg(e)) S.append(T(histX + colW - 10, y + 16, evArg(e), 13, 600, e.k === 'marker' ? 'var(--accent)' : 'var(--text-3)', 'end', true));
      });
      stage.innerHTML = ''; stage.append(S);
      stats.innerHTML = '';
      const dupe = fx.chargeCard > 1 || fx.reserveStock > 1 || fx.shipOrder > 1 || fx.fraudCheck > 1;
      [['worker memory', memory === 'lost' ? '✖ lost' : memory === 'rebuilt' ? 'rebuilt by replay' : 'in RAM'],
        ['card charged', fx.chargeCard + '×' + (fx.chargeCard > 1 ? ' ⚠' : '')],
        ['stock reserved', fx.reserveStock + '×'], ['shipped', fx.shipOrder + '×'],
        ['activity runs', counters.runs], ['steps replayed', counters.replayed],
        ['status', r.error ? 'STUCK: non-determinism' : history.some((e) => e.k === 'end') ? (dupe ? 'DONE, with duplicates' : 'DONE') : r.waiting ? 'sleeping (no worker needed)' : 'running']
      ].forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: `${k}: <b>${v}</b>` })));
      const fin = history.some((e) => e.k === 'end');
      stepB.disabled = busy || fin || !!r.error || memory === 'lost';
      stepB.textContent = r.waiting ? '⏩ Skip 3 days' : '▶ Step';
      crashB.disabled = busy || fin;
      return r;
    }

    function runActivity(name) {
      const once = () => { counters.runs++; return true; };
      history.push({ k: 'sched', name });
      once(); fx[name]++;
      if (opt.flaky) {
        opt.flaky = false; syncCtl();
        say(`⚡ <code>${name}</code> did its work, then the activity worker died <b>before reporting</b>. The engine sees a timeout, not a result.`);
        once();
        if (opt.idem) say(`↻ Retry, attempt 2, with the same idempotency key <code>order-812:${name}</code>. The key is already stored, so <b>no second effect</b>.`);
        else { fx[name]++; say(`↻ Retry, attempt 2. No idempotency key, so the work happens <b>again</b>${name === 'chargeCard' ? ': the customer is charged twice' : ''}.`); }
      } else say(`▶ <code>${name}</code> scheduled, ran once, result recorded.`);
      history.push({ k: 'done', name });
    }
    function step() {
      if (busy) return;
      view = null; if (memory === 'rebuilt') memory = 'fresh';
      const r = evaluate(opt.ver, true);
      if (r.error || memory === 'lost') return draw();
      if (r.finished) { if (!history.some((e) => e.k === 'end')) { history.push({ k: 'end' }); say('✅ Workflow completed. ' + (fx.chargeCard > 1 ? 'But the card was charged <b>' + fx.chargeCard + ' times</b>.' : 'Every side effect happened exactly once.')); } return draw(); }
      if (r.waiting) { history.push({ k: 'tfire' }); say('⏰ Three days later the engine appends <b>TimerFired</b> and queues a workflow task. Any worker can pick it up.'); }
      else if (r.next.op.op === 'timer') { history.push({ k: 'tstart' }); say('😴 <code>sleep(3 days)</code>: the worker returns a <b>start timer</b> command and forgets the workflow. Nothing is held in memory.'); }
      else runActivity(r.next.op.name);
      const r2 = evaluate(opt.ver, false);
      if (r2.finished) { history.push({ k: 'end' }); say('✅ Workflow completed. ' + (fx.chargeCard > 1 ? 'But the card was charged <b>' + fx.chargeCard + ' times</b>: turn idempotency on and try again.' : 'Every side effect happened exactly once.')); }
      draw();
    }
    async function recover(why) {
      busy = true; memory = 'lost'; view = null; draw();
      say(why);
      await wait(700); if (my !== gen) return;
      memory = 'rebuilt'; view = 'replayed';
      const r = evaluate(opt.ver, false);
      const stop = r.error ? r.error.line : r.next ? r.next.line : r.waiting ? r.waiting.line : PROGRAMS[opt.ver].length;
      for (let i = 0; i <= stop; i++) {
        draw(i); await wait(420); if (my !== gen) return;
      }
      const n = r.trace.filter((x) => x === 'done').length; counters.replayed += n;
      busy = false; draw();
      if (r.error) say(`✖ <b>Non-determinism error.</b> The code asked for <code>${r.error.want.name}</code>, but the next command in the history is <code>${r.error.got.name || r.error.got.k}</code>. The workflow is stuck until the code matches its history again: deploy <b>v2 + patch</b> or go back to <b>v1</b>.`);
      else say(`↺ Replayed from line 1: <b>${n}</b> step${n === 1 ? '' : 's'} answered from the history, <b>0</b> activities re-run. The code is back on the same line.`);
    }
    function deploy() {
      const started = history.length > 1;
      if (!started) { say(`🚀 Deployed <b>${opt.ver}</b>. No workflow is running yet, so nothing to replay.`); return draw(); }
      recover(`🚀 Deployed <b>${opt.ver === 'v1' ? 'v1' : opt.ver === 'v2' ? 'v2 (adds fraudCheck, no guard)' : 'v2 with a patch guard'}</b>. Workers restart; the open workflow must replay against the new code.`);
    }
    stepB.onclick = step;
    crashB.onclick = () => { if (!busy) recover('💥 Workflow worker killed. Its memory (line number, local variables) is gone. A new worker receives the event history.'); };
    resetB.onclick = () => { opt.ver = 'v1'; opt.flaky = false; reset(); syncCtl(); log.innerHTML = ''; build(ctx.narrow); };
    syncCtl(); draw();
    say('Press <b>▶ Step</b> twice, then <b>💥 Crash worker</b>. Next: turn on <b>⚡</b> with idempotency off. Then, mid-run, deploy <b>v2: add step</b>.');
  }
  reset();
  build(ctx.narrow);
  ctx.onResize(build);
});
