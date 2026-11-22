/* Dual write vs transactional outbox: a crash between DB commit and Kafka send loses the event; the outbox relay may publish twice and the idempotent consumer dedupes. */
IA.widget('kafka-messaging-outbox', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-kmo-style')) {
    document.head.append(el('style', { id: 'w-kmo-style', text: `
.w-kmo svg text { font-family: var(--mono); }
.w-kmo .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.6; transition: fill .3s, stroke .3s; }
.w-kmo .bx.hot { stroke: var(--accent); stroke-width: 2.6; fill: var(--accent-soft); }
.w-kmo .bx.ok { stroke: var(--ok); stroke-width: 2.2; fill: color-mix(in srgb, var(--ok) 10%, var(--surface)); }
.w-kmo .bx.bad { stroke: var(--err); stroke-width: 2.4; fill: color-mix(in srgb, var(--err) 11%, var(--surface)); }
.w-kmo .bx.dim { opacity: .35; }
.w-kmo .tok { fill: var(--accent); stroke: var(--surface); stroke-width: 3; }
.w-kmo .tok.bad { fill: var(--err); }
` }));
  }
  const N = { svc: [14, 100, 170, 60], db: [236, 24, 240, 150], relay: [236, 196, 240, 50], kafka: [536, 70, 210, 60], con: [536, 176, 210, 70] };
  const c = (id) => { const [x, y, w, h] = N[id]; return [x + w / 2, y + h / 2]; };
  const SC = {
    dual: { label: 'dual write', intro: 'The service saves the order, commits, then calls <code>kafkaTemplate.send()</code>. Two systems, two separate writes.',
      steps: [
        { at: 'db', hi: { svc: 'hot', db: 'hot' }, db: { o: 'tx' }, log: 'BEGIN; INSERT INTO orders …', say: '<code>@Transactional place()</code> inserts the order. Not committed yet.' },
        { at: 'db', hi: { db: 'ok' }, db: { o: 'ok' }, log: 'COMMIT', logc: 'o', say: 'The transaction commits. The order exists.' },
        { at: 'svc', hi: { svc: 'bad', db: 'ok' }, bad: true, db: { o: 'ok' }, log: 'pod killed before kafka.send()', logc: 'e', tone: 'err', say: 'The pod is killed (deploy, OOM) right after the commit, before the send.' },
        { at: 'svc', hi: { db: 'ok', kafka: 'dim', con: 'bad' }, bad: true, db: { o: 'ok' }, tone: 'err', say: 'The order is saved, but <b>no event was ever published</b>: billing never invoices it. Nothing will retry, because nothing remembers that a send was owed. Sending <i>before</i> the commit has the opposite failure: an event for an order that was rolled back.' }] },
    outbox: { label: 'outbox', intro: 'The service writes the order <b>and</b> an outbox row in one transaction. A relay publishes outbox rows to Kafka.',
      steps: [
        { at: 'db', hi: { svc: 'hot', db: 'hot' }, db: { o: 'tx', ob: 'tx' }, log: 'BEGIN; INSERT INTO orders …; INSERT INTO outbox (event_id=e-91, topic=orders, payload) …', say: 'Both rows are written in the <b>same local transaction</b>. No Kafka call in the request path.' },
        { at: 'db', hi: { db: 'ok' }, db: { o: 'ok', ob: 'pending' }, log: 'COMMIT', logc: 'o', say: 'Commit: either both rows exist or neither does. Even if the pod dies now, the obligation to publish is stored.' },
        { at: 'relay', hi: { db: 'ok', relay: 'hot' }, db: { o: 'ok', ob: 'pending' }, log: 'relay: SELECT … WHERE sent_at IS NULL FOR UPDATE SKIP LOCKED', say: 'The relay (a <code>@Scheduled</code> poller here; Debezium CDC is the alternative) picks up unsent rows. <code>SKIP LOCKED</code> lets several instances share the work.' },
        { at: 'kafka', hi: { relay: 'hot', kafka: 'ok' }, db: { o: 'ok', ob: 'pending' }, k: 1, log: 'send orders key=order-91 (event_id e-91) → ack', logc: 'o', say: 'It publishes and waits for the broker’s acknowledgement (<code>acks=all</code>).' },
        { at: 'relay', hi: { relay: 'ok', db: 'ok', kafka: 'ok' }, db: { o: 'ok', ob: 'sent' }, k: 1, log: 'UPDATE outbox SET sent_at = now() WHERE id = …; COMMIT', logc: 'o', say: 'Only then is the row marked sent.' },
        { at: 'con', hi: { kafka: 'ok', con: 'ok' }, db: { o: 'ok', ob: 'sent' }, k: 1, applied: 1, tone: 'ok', log: 'billing: INSERT processed_events(e-91) ✓ · invoice created', logc: 'o', say: 'Billing consumes it and creates the invoice. One order, one event, one invoice.' }] },
    crash: { label: 'outbox + relay crash', intro: 'Same outbox design. This time the relay crashes between the Kafka ack and marking the row sent.',
      steps: [
        { at: 'db', hi: { svc: 'ok', db: 'ok' }, db: { o: 'ok', ob: 'pending' }, log: 'order + outbox row committed', logc: 'o', say: 'Order and outbox row are committed.' },
        { at: 'kafka', hi: { relay: 'hot', kafka: 'ok' }, db: { o: 'ok', ob: 'pending' }, k: 1, log: 'relay: send e-91 → ack', logc: 'o', say: 'The relay publishes e-91 and gets the ack…' },
        { at: 'relay', hi: { relay: 'bad', kafka: 'ok' }, bad: true, db: { o: 'ok', ob: 'pending' }, k: 1, log: 'relay killed before UPDATE … COMMIT (row lock released)', logc: 'e', tone: 'err', say: '…and dies before its transaction commits. The row is still unsent.' },
        { at: 'kafka', hi: { relay: 'hot', kafka: 'hot' }, db: { o: 'ok', ob: 'sent' }, k: 2, log: 'relay (restarted): send e-91 again → ack · mark sent', tone: 'warn', say: 'On restart the relay sees the row and publishes it <b>again</b>. The outbox guarantees at-least-once publishing, not exactly-once.' },
        { at: 'con', hi: { con: 'ok' }, db: { o: 'ok', ob: 'sent' }, k: 2, applied: 1, log: 'billing: e-91 → INSERT processed_events ✓ · invoice', logc: 'o', say: 'Billing processes the first copy and records <code>e-91</code> in <code>processed_events</code> in the same DB transaction as the invoice.' },
        { at: 'con', hi: { con: 'ok' }, db: { o: 'ok', ob: 'sent' }, k: 2, applied: 1, dup: true, tone: 'ok', log: 'billing: e-91 again → ON CONFLICT DO NOTHING → skip', logc: 'o', say: 'The second copy hits the unique constraint and is skipped. <b>Outbox + idempotent consumer</b> is the practical form of “exactly-once” across a database and Kafka.' }] }
  };
  let sc = 'dual'; let k = 0; let gen = 0; let running = false; let speed = 2300; let st;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(SC).map((x) => [x, SC[x].label]), sc, (v) => { sc = v; reset(); }, 'Design');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 760 262', role: 'img', 'aria-label': 'Order service, Postgres with orders and outbox tables, relay, Kafka topic and billing consumer' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-log', 'aria-label': 'Log' });
  root.classList.add('w-kmo');
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, log);
  let tok;
  function render() {
    const hi = st.hi || {}; const S = SC[sc]; const db = st.db || {};
    stage.innerHTML = '';
    const box = (id, a, b) => { const [x, y, w, h] = N[id]; stage.append(svg('rect', { class: 'bx ' + (hi[id] || ''), x, y, width: w, height: h, rx: 9 }), svg('text', { x: x + 10, y: y + 20, 'font-size': 12.5, 'font-weight': 700, fill: 'var(--text)', text: a }));
      if (b) stage.append(svg('text', { x: x + 10, y: y + 38, 'font-size': 11, fill: 'var(--text-3)', text: b })); };
    box('svc', 'OrderService', '@Transactional place()');
    box('db', 'Postgres', '');
    const row = (y, name, state) => { const col = state === 'ok' || state === 'sent' ? 'var(--ok)' : state === 'pending' ? 'var(--warn)' : state === 'tx' ? 'var(--accent)' : 'var(--border)';
      stage.append(svg('rect', { x: 248, y, width: 216, height: 34, rx: 6, fill: 'var(--surface-2)', stroke: col, 'stroke-width': 1.4 }),
        svg('text', { x: 258, y: y + 21, 'font-size': 11.5, fill: 'var(--text)', text: name }),
        svg('text', { x: 456, y: y + 21, 'font-size': 11, fill: col, 'text-anchor': 'end', 'font-weight': 700, text: state === 'ok' ? 'order-91 ✓' : state === 'tx' ? 'uncommitted' : state === 'pending' ? 'e-91 unsent' : state === 'sent' ? 'e-91 sent' : '—' })); };
    row(56, 'orders', db.o);
    if (sc !== 'dual') row(100, 'outbox', db.ob);
    else stage.append(svg('text', { x: 258, y: 120, 'font-size': 11, fill: 'var(--text-3)', text: '(no outbox table)' }));
    if (sc !== 'dual') box('relay', 'Outbox relay', 'poller / Debezium CDC');
    box('kafka', 'Kafka · orders', '');
    for (let j = 0; j < 3; j++) { const has = (st.k || 0) > j;
      stage.append(svg('rect', { x: 546 + j * 62, y: 102, width: 56, height: 20, rx: 4, fill: has ? 'color-mix(in srgb, var(--ok) 14%, var(--surface))' : 'var(--surface-2)', stroke: has ? (j > 0 ? 'var(--warn)' : 'var(--ok)') : 'var(--border)' }));
      if (has) stage.append(svg('text', { x: 574 + j * 62, y: 116, 'font-size': 10.5, 'text-anchor': 'middle', fill: j > 0 ? 'var(--warn)' : 'var(--ok)', text: 'e-91' })); }
    box('con', 'billing consumer', 'dedupe: processed_events');
    stage.append(svg('text', { x: 546, y: 236, 'font-size': 11, fill: st.dup ? 'var(--ok)' : 'var(--text-2)', text: `invoices: ${st.applied || 0}${st.dup ? ' (duplicate skipped)' : ''}` }));
    tok = svg('circle', { class: 'tok' + (st.bad ? ' bad' : ''), r: 9, cx: 0, cy: 0 });
    const [tx, ty] = st.tok;
    tok.style.transform = `translate(${st.prev ? st.prev[0] : tx}px, ${st.prev ? st.prev[1] : ty}px)`;
    if (!reduced) tok.style.transition = 'transform .7s ease';
    stage.append(tok);
    if (st.prev) requestAnimationFrame(() => requestAnimationFrame(() => { tok.style.transform = `translate(${tx}px, ${ty}px)`; }));
    log.innerHTML = ''; st.log.forEach(([t, cl]) => log.append(el('div', { text: t, style: { color: cl === 'e' ? 'var(--err)' : cl === 'o' ? 'var(--ok)' : '' } }))); log.scrollTop = log.scrollHeight;
    void S;
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${SC[sc].steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; st = { hi: {}, log: [], tok: c('svc') }; render(); say(SC[sc].intro); bStep.disabled = false; }
  function step() {
    const steps = SC[sc].steps; if (k >= steps.length) return false; const s = steps[k++];
    const prev = st.tok; const logs = st.log;
    st = Object.assign({}, s, { tok: c(s.at), prev: reduced ? null : prev, log: logs });
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
