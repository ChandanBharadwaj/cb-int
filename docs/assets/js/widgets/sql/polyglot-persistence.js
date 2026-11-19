/* Polyglot persistence: keep a second store in sync. Dual write (fails), transactional outbox, CDC; inject a failure and watch the stores drift or converge. */
IA.widget('polyglot-persistence', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-pp-style')) document.head.append(el('style', { id: 'w-pp-style', html: `
.w-pp-lanes { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.w-pp-lane { border: 1px solid var(--border); border-radius: 12px; padding: 8px; background: var(--surface-2); min-width: 0; min-height: 90px; }
.w-pp-lane h5 { margin: 0 0 6px; font-size: 12.5px; font-family: var(--mono); }
.w-pp-it { border: 1px solid var(--border); background: var(--surface); border-radius: 8px; padding: 5px 7px; font-family: var(--mono); font-size: 11.5px; margin-bottom: 5px; word-break: break-word; animation: capin .35s ease both; }
.w-pp-it.ok { border-color: var(--ok); } .w-pp-it.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 12%, var(--surface)); }
.w-pp-it.warn { border-color: var(--warn); } .w-pp-it.dim { opacity: .45; text-decoration: line-through; }
.w-pp-lane.hot { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.w-pp-verdict { margin-top: 8px; font-weight: 700; font-size: 14px; min-height: 20px; }
` }));
  let pat = 'dual', fail = 'crash', gen = 0, k = 0, frames = [], running = false, speed = 2400;
  const mkSeg = (label, items, cur, on) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const stage = el('div', { class: 'w-pp-lanes' });
  const verdict = el('div', { class: 'w-pp-verdict' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'pattern' }), mkSeg('Pattern', [['dual', 'Dual write'], ['outbox', 'Transactional outbox'], ['cdc', 'CDC (Debezium)']], pat, (v) => { pat = v; reset(); })),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'failure' }), mkSeg('Failure', [['none', 'No failure'], ['crash', 'Crash after DB commit'], ['dup', 'Redelivery (duplicate)']], fail, (v) => { fail = v; reset(); })),
    el('div', { class: 'w-stage' }, stage, verdict),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), mkSeg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], 2400, (v) => { speed = v; })), cap);
  const L = {};
  function lanes(list) { stage.innerHTML = ''; list.forEach(([id, t]) => { L[id] = el('div', { class: 'w-pp-lane' }, el('h5', { text: t })); stage.append(L[id]); }); }
  const put = (id, txt, cls) => { const n = el('div', { class: 'w-pp-it ' + (cls || ''), text: txt }); L[id].append(n); return n; };
  const hot = (...ids) => Object.entries(L).forEach(([id, n]) => n.classList.toggle('hot', ids.includes(id)));
  const end = (ok, t) => { verdict.textContent = t; verdict.style.color = ok ? 'var(--ok)' : 'var(--err)'; };
  function build() {
    verdict.textContent = ''; const F = [];
    if (pat === 'dual') {
      lanes([['app', 'order-service'], ['pg', 'Postgres: orders'], ['bus', 'Kafka'], ['es', 'search index']]);
      F.push(['The service handles “place order 42”. It plans two separate writes: Postgres, then Kafka. There is no transaction spanning both.', () => { hot('app'); put('app', 'placeOrder(42)'); }]);
      F.push(['Write 1: INSERT into Postgres and COMMIT. The order now exists in the source of truth.', () => { hot('pg'); put('pg', 'order 42 ✓', 'ok'); }]);
      if (fail === 'crash') {
        F.push(['💥 The pod is killed (deploy, OOM) <b>after</b> the commit and <b>before</b> the publish. Nothing will ever retry it: the intent lived only in memory.', () => { hot('app'); put('app', '💥 crashed', 'bad'); }]);
        F.push(['The search index never hears about order 42. Postgres and search now disagree, silently and permanently.', () => { hot('es'); put('es', '(no order 42)', 'bad'); end(false, '✗ Drift: the stores disagree. Dual writes cannot be made atomic.'); }]);
        F.push(['Reversing the order (publish first, then commit) just flips the bug: if the DB commit fails, consumers see an order that doesn’t exist. Retrying both in a loop still leaves windows where they differ.', () => {}]);
      } else {
        F.push(['Write 2: publish OrderPlaced to Kafka.', () => { hot('bus'); put('bus', 'OrderPlaced 42'); }]);
        F.push([fail === 'dup' ? 'The producer times out waiting for the ack and retries: Kafka now has the event twice.' : 'The consumer updates the search index.', () => { if (fail === 'dup') { put('bus', 'OrderPlaced 42 (retry)', 'warn'); } hot('es'); put('es', 'order 42', 'ok'); if (fail === 'dup') put('es', 'order 42 (again)', 'warn'); }]);
        F.push([fail === 'dup' ? 'Duplicates are survivable if the consumer is idempotent (upsert by id). The bigger problem remains: with no failure, dual write works; with a crash, it drifts. Try “Crash after DB commit”.' : 'It works on a sunny day. That is the trap: dual writes pass every test and fail during deploys and outages. Try “Crash after DB commit”.',
          () => end(true, fail === 'dup' ? '≈ OK here, only because the consumer upserts by id.' : '✓ Consistent… this time.')]);
      }
    } else if (pat === 'outbox') {
      lanes([['app', 'order-service'], ['pg', 'Postgres: orders + outbox'], ['relay', 'relay / poller'], ['bus', 'Kafka'], ['es', 'search (idempotent)']]);
      F.push(['One local transaction writes the order <b>and</b> an outbox row describing the event. Both commit or neither does.', () => { hot('app', 'pg'); put('app', 'BEGIN; INSERT order; INSERT outbox; COMMIT'); put('pg', 'order 42 ✓', 'ok'); put('pg', 'outbox #901 OrderPlaced 42 (unsent)', 'warn'); }]);
      if (fail === 'crash') F.push(['💥 The service crashes right after COMMIT. That’s fine: the event is durable in the outbox table, not in memory.', () => { hot('app'); put('app', '💥 crashed', 'bad'); }]);
      F.push(['A relay picks unsent outbox rows (<code>FOR UPDATE SKIP LOCKED</code>, or CDC on the outbox table) and publishes them.', () => { hot('relay', 'bus'); put('relay', 'publish #901'); put('bus', 'OrderPlaced 42 (id #901)'); }]);
      if (fail === 'dup') F.push(['The relay crashes after publishing but before marking #901 as sent. On restart it publishes #901 again: <b>at-least-once</b> delivery.', () => { hot('relay', 'bus'); put('relay', '💥 restart → publish #901 again', 'warn'); put('bus', 'OrderPlaced 42 (id #901) dup', 'warn'); }]);
      F.push(['The consumer records processed event ids (<code>INSERT … ON CONFLICT DO NOTHING</code>) in the same transaction as its update, so a duplicate is a no-op.', () => { hot('es'); put('es', 'apply #901 → order 42', 'ok'); if (fail === 'dup') put('es', 'skip #901 (already processed)', 'dim'); }]);
      F.push(['The relay marks #901 sent (or deletes it). Every committed order produces its event, at least once; idempotency turns that into effectively-once.', () => { hot('pg'); put('pg', 'outbox #901 sent', 'ok'); end(true, '✓ Converged: atomic intent + at-least-once delivery + idempotent consumer.'); }]);
    } else {
      lanes([['app', 'order-service'], ['pg', 'Postgres + WAL'], ['dbz', 'Debezium (slot)'], ['bus', 'Kafka'], ['es', 'search (idempotent)']]);
      F.push(['The service only writes to Postgres. No second write, no outbox code in the request path.', () => { hot('app', 'pg'); put('app', 'INSERT order 42; COMMIT'); put('pg', 'order 42 ✓', 'ok'); put('pg', 'WAL LSN 0/5A1 INSERT orders', 'warn'); }]);
      if (fail === 'crash') F.push(['💥 The service crashes after COMMIT. Irrelevant: the change is in the WAL, and the replication slot keeps it until Debezium confirms.', () => { hot('app'); put('app', '💥 crashed', 'bad'); }]);
      F.push(['Debezium decodes committed changes from the slot (pgoutput) in commit order and publishes them, keyed by primary key.', () => { hot('dbz', 'bus'); put('dbz', 'read LSN 0/5A1'); put('bus', 'orders key=42 op=c lsn=0/5A1'); }]);
      if (fail === 'dup') F.push(['The connector restarts before its offset was flushed. It resumes from the last confirmed LSN and re-emits the change: a duplicate.', () => { hot('dbz', 'bus'); put('dbz', 'restart → resume at 0/59F', 'warn'); put('bus', 'orders key=42 op=c lsn=0/5A1 dup', 'warn'); }]);
      F.push(['The consumer upserts by key and ignores events with an LSN/version not newer than what it stored. Duplicates and replays are harmless.', () => { hot('es'); put('es', 'upsert 42 @0/5A1', 'ok'); if (fail === 'dup') put('es', 'ignore 42 @0/5A1 (not newer)', 'dim'); }]);
      F.push(['Converged. Costs: a connector to run, schema changes flow through, events expose table structure (often combined with an outbox table to publish domain events), and a stuck slot retains WAL on the primary.', () => end(true, '✓ Converged: the log is the single source of change.')]);
    }
    return F;
  }
  const say = (t) => { cap.firstChild.innerHTML = t; };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; frames = build(); hot();
    say(pat === 'dual' ? 'Dual write: the service writes to two systems one after the other. Pick a failure and press Play.' : 'Press Play. Try each failure: the result should stay consistent.'); }
  function step() { if (k >= frames.length) return false; const [t, f] = frames[k++]; f(); say(t); if (k >= frames.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= frames.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
