/* Event-sourced cart + CQRS read model. Write model = fold(events). Appends use an expected version (optimistic concurrency).
   A projector applies events to the read model after a lag and keeps a checkpoint; rebuild = reset checkpoint and replay. */
SD.widget('ms-data', function (root, ctx) {
  const { el, svg } = ctx;
  const PRICE = { tea: 4, mug: 9 }, SNAP = 5, ROWS = 6;
  const opt = { lag: 2000, paused: false };
  let gen = 0, loopH = null;
  let events, view, cp, rebuilding, nextReplay, st, now = 0;

  const empty = () => ({ items: 0, total: 0, status: 'OPEN', version: 0 });
  // The fold: (state, event) -> state. Used by the write model, the projector and replay alike.
  function apply(s, e) {
    const n = { items: s.items, total: s.total, status: s.status, version: e.v };
    if (e.type === 'ItemAdded') { n.items++; n.total += PRICE[e.sku]; }
    else if (e.type === 'ItemRemoved') { n.items--; n.total -= PRICE[e.sku]; }
    else if (e.type === 'CheckedOut') n.status = 'CHECKED OUT';
    return n;
  }
  const fold = (upTo) => events.slice(0, upTo).reduce(apply, empty());
  function reset() { events = []; view = empty(); cp = 0; rebuilding = false; st = { rejected: 0, replayed: '—', stale: 0 }; }

  function build(narrow) {
    const my = ++gen;
    if (loopH) loopH.stop();
    root.innerHTML = '';
    const W = narrow ? 360 : 560, F = narrow ? 13.5 : 14, RH = 30, TOP = 24, PH = 112;
    const H = TOP + ROWS * RH + 12 + PH + 4;

    const stats = el('div', { class: 'w-stats' });
    const log = el('div', { class: 'w-log', 'aria-live': 'polite' });
    const say = (h) => { if (my !== gen) return; log.prepend(el('div', { html: h })); while (log.children.length > 40) log.lastChild.remove(); };

    // Command side: load (snapshot + tail), check the rule, append at expected version.
    function load() {
      const v = events.length, snapV = Math.floor(v / SNAP) * SNAP;
      st.replayed = snapV ? 'snapshot v' + snapV + ' + ' + (v - snapV) : v + ' events';
      return fold(v);
    }
    function append(expected, ev) {
      if (events.length !== expected) return false;           // someone else wrote first
      events.push(Object.assign({ v: expected + 1, at: now }, ev));
      return true;
    }
    function decide(state, cmd) {
      if (state.status !== 'OPEN') return { err: 'cart is already checked out' };
      if (cmd === 'remove') {
        const last = events.slice().reverse().find((e) => e.type === 'ItemAdded' && !events.some((r) => r.type === 'ItemRemoved' && r.of === e.v));
        return last ? { ev: { type: 'ItemRemoved', sku: last.sku, of: last.v } } : { err: 'cart is empty' };
      }
      if (cmd === 'checkout') return state.items ? { ev: { type: 'CheckedOut' } } : { err: 'cannot check out an empty cart' };
      return { ev: { type: 'ItemAdded', sku: cmd } };
    }
    function command(cmd, who) {
      const state = load(), d = decide(state, cmd);
      if (d.err) { say('✖ ' + (who || 'Command') + ' rejected by the <b>write model</b>: ' + d.err + '. No event stored.'); return; }
      append(state.version, d.ev);
      say('✔ ' + (who || 'Command') + ': appended <b>v' + events.length + ' ' + d.ev.type + (d.ev.sku ? ' ' + d.ev.sku : '') + '</b> (expected v' + state.version + ').');
    }
    function twoWriters() {
      const a = load(), b = load();                             // both read the same version
      if (a.status !== 'OPEN') { say('✖ Cart is checked out: both writers are rejected by the business rule.'); return; }
      append(a.version, { type: 'ItemAdded', sku: 'tea' });
      say('Writer A and writer B both loaded <b>v' + a.version + '</b>. A appends v' + events.length + ' ✔.');
      if (!append(b.version, { type: 'ItemAdded', sku: 'mug' })) {
        st.rejected++;
        say('✖ Writer B appends with expected v' + b.version + ', but the stream is at v' + events.length + ': <b>version conflict</b>. Nothing was overwritten.');
        command('mug', 'Writer B (reloaded, retried)');
      }
    }
    function readView() {
      const behind = events.length - cp;
      if (behind) st.stale++;
      say('🔎 Query the <b>read model</b>: ' + view.items + ' items, $' + view.total + ', ' + view.status + ' (as of v' + view.version + '). ' + (behind ? '⚠ <b>Stale</b>: the write model is at v' + events.length + ', ' + behind + ' event(s) not projected yet.' : 'Up to date with the write model.'));
    }
    function rebuild() {
      view = empty(); cp = 0; rebuilding = true; nextReplay = now;
      say('♻ Read model dropped. Checkpoint reset to 0: <b>replaying all ' + events.length + ' events</b> to rebuild it.');
    }

    const btn = (text, fn, primary) => { const b = el('button', { class: 'btn' + (primary ? ' primary' : ''), text }); b.onclick = () => { fn(); paint(); }; return b; };
    const lagSel = el('select', { 'aria-label': 'Projection lag' });
    [['300', '0.3 s'], ['2000', '2 s'], ['5000', '5 s']].forEach(([v, t]) => lagSel.append(el('option', { value: v, text: t })));
    lagSel.value = String(opt.lag);
    lagSel.addEventListener('change', () => { opt.lag = +lagSel.value; });
    const pauseB = el('button', { class: 'btn' });
    const syncP = () => { pauseB.textContent = opt.paused ? '▶ Resume projector' : '⏸ Pause projector'; pauseB.classList.toggle('primary', opt.paused); };
    pauseB.onclick = () => { opt.paused = !opt.paused; syncP(); say(opt.paused ? '⏸ Projector stopped (crash or deploy). Writes still succeed; the read model falls behind.' : '▶ Projector resumed from checkpoint v' + cp + '. It catches up; nothing is lost.'); paint(); };
    root.append(el('div', { class: 'w-controls' },
      btn('+ tea $4', () => command('tea'), true), btn('+ mug $9', () => command('mug'), true), btn('− remove last', () => command('remove')), btn('Checkout', () => command('checkout')),
      btn('⚔ Two writers', twoWriters), btn('🔎 Read view', readView),
      el('label', null, 'Lag ', lagSel), pauseB, btn('♻ Rebuild view', rebuild),
      btn('Reset', () => { reset(); log.innerHTML = ''; hint(); })));

    const stage = el('div', { class: 'w-stage' });
    const S = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Event stream, write model and read model', style: narrow ? '' : 'max-width:780px;display:block;margin:0 auto' });
    stage.append(S);
    root.append(stage, stats, log);
    const hint = () => say('Add a few items, then press <b>Read view</b> before the projector catches up. Try <b>Two writers</b>, then pause the projector and <b>Rebuild</b>.');

    const T = (x, y, s, a, fill, w) => svg('text', { x, y, text: s, 'text-anchor': a || 'start', fill: fill || 'var(--text)', style: 'font:' + (w || 600) + ' ' + F + 'px var(--sans)' });
    function panel(x, w, title, s, tone, foot) {
      const y = TOP + ROWS * RH + 12, col = tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : 'var(--accent)';
      S.append(svg('rect', { x, y, width: w, height: PH, rx: 10, fill: 'var(--surface-2)', stroke: col, 'stroke-width': 2 }));
      S.append(T(x + 10, y + 21, title, 'start', col, 700));
      [s.items + ' items · $' + s.total, s.status, foot].forEach((line, i) => S.append(T(x + 10, y + 46 + i * 24, line, 'start', i === 2 ? 'var(--text-3)' : 'var(--text)', i === 2 ? 500 : 600)));
    }
    function paint() {
      if (my !== gen) return;
      S.innerHTML = '';
      S.append(T(4, 15, 'Event stream cart-42 (append-only)', 'start', 'var(--text-3)', 600));
      const first = Math.max(0, events.length - ROWS);
      for (let r = 0; r < ROWS; r++) {
        const e = events[first + r], y = TOP + r * RH;
        if (!e) { S.append(svg('rect', { x: 4, y, width: W - 8, height: RH - 5, rx: 6, fill: 'none', stroke: 'var(--border)', 'stroke-dasharray': '4 4' })); continue; }
        const done = e.v <= cp, col = done ? 'var(--ok)' : 'var(--warn)';
        S.append(svg('rect', { x: 4, y, width: W - 8, height: RH - 5, rx: 6, fill: 'var(--surface-2)', stroke: col, 'stroke-width': done ? 1.5 : 2 }));
        S.append(T(12, y + 17, 'v' + e.v, 'start', 'var(--text-3)', 700));
        S.append(T(narrow ? 46 : 56, y + 17, e.type + (e.sku ? ' ' + e.sku : '')));
        S.append(T(W - 12, y + 17, done ? 'projected' : 'pending', 'end', col, 600));
      }
      const half = (W - 12) / 2, w = fold(events.length), behind = events.length - cp;
      panel(4, half, 'Write model', w, 'info', 'fold of v' + w.version);
      panel(8 + half, half, 'Read model', view, behind ? 'warn' : 'ok', behind ? 'at v' + cp + ' · ' + behind + ' behind' : 'at v' + cp + ' · current');
      stats.innerHTML = '';
      [['events', events.length], ['projector checkpoint', 'v' + cp + (opt.paused ? ' (paused)' : rebuilding ? ' (replaying)' : '')], ['last load replayed', st.replayed], ['version conflicts', st.rejected], ['stale reads served', st.stale]]
        .forEach(([a, b]) => stats.append(el('span', { class: 'w-stat', html: a + ': <b>' + b + '</b>' })));
    }
    // Query side: apply events in order, one at a time, once they are older than the lag. Checkpoint moves with the view.
    loopH = ctx.loop((dt) => {
      now += dt;
      let changed = false;
      while (!opt.paused && cp < events.length) {
        const e = events[cp];
        if (rebuilding ? now < nextReplay : now < e.at + opt.lag) break;
        view = apply(view, e); cp++; changed = true;
        if (rebuilding) { nextReplay = now + 150; if (cp === events.length) { rebuilding = false; say('♻ Rebuild finished at v' + cp + ': the read model equals the fold of the stream again.'); } break; }
      }
      if (rebuilding && cp >= events.length) rebuilding = false;
      if (changed) paint();
    });
    syncP(); paint();
    if (!log.children.length) hint();
  }
  reset();
  build(ctx.narrow);
  ctx.onResize(build);
});
