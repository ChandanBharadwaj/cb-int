/* Version skew lab: a producer and a consumer service roll out independently, one pod at a time, while messages flow.
   Writer v1 sends {amount}, v2 sends {amount,total}, v3 sends {total}. Reader v1 needs amount, v2 takes either, v3 needs total.
   A message fails when the reader's version cannot read what the writer's version wrote. */
SD.widget('ms-operations', function (root, ctx) {
  const { el, svg } = ctx;
  const N = 4, WR = ['', 'amount', 'both', 'total'], RD = ['', 'amount', 'either', 'total'];
  const compat = (w, r) => r === 2 || (r === 1 && w <= 2) || (r === 3 && w >= 2);
  const S = { P: [1, 1, 1, 1], C: [1, 1, 1, 1], pT: 1, cT: 1, ok: 0, bad: 0 };
  let pClock = 0, cClock = 0, spawn = 0, loopH = null, ui = null;
  const frac = (arr, v) => arr.filter((x) => x === v).length / N;
  function errRate() { let e = 0; for (let w = 1; w <= 3; w++) for (let r = 1; r <= 3; r++) if (!compat(w, r)) e += frac(S.P, w) * frac(S.C, r); return e; }
  function hint() {
    if (errRate() > 0) return '⚠ Some live writer/reader pairs cannot talk (red cells with traffic). Roll back, or finish the rollout to see where it ends.';
    const pmin = Math.min(...S.P), pmax = Math.max(...S.P), cmin = Math.min(...S.C), cmax = Math.max(...S.C);
    if (pmax === 1 && cmax === 1) return 'Step 1, <b>expand</b>: roll the producer to v2. It writes both fields, so old readers keep working.';
    if (pmin === 2 && pmax === 2 && cmin === 1) return 'Step 2, <b>migrate</b>: roll the consumer to v2 (reads <code>total</code>, falls back to <code>amount</code>).';
    if (pmin === 2 && pmax === 2 && cmin >= 2) return 'Step 3, <b>contract</b>: no reader needs <code>amount</code> any more. Roll the producer to v3.';
    if (pmin === 3 && cmin >= 2) return '✅ Rename done. Every step was compatible with the version before it, so rollback was possible at each point.';
    return 'Old and new pods are serving together. This overlap happens in every rolling deploy.';
  }

  function build(narrow) {
    if (loopH) loopH.stop();
    root.innerHTML = '';
    const mk = (label, key, arrKey) => {
      const wrap = el('div', { class: 'w-seg', role: 'group', 'aria-label': label });
      const btns = [1, 2, 3].map((v) => {
        const b = el('button', { class: 'btn', text: 'v' + v });
        b.onclick = () => {
          if (S[key] === v && S[arrKey].every((x) => x === v)) return;
          S[key] = v; sync();
          say('▶ Rolling <b>' + label.toLowerCase() + '</b> to v' + v + ' (' + (arrKey === 'P' ? 'writes ' + WR[v] : 'reads ' + RD[v]) + '), one pod at a time. The other service is not touched.');
        };
        wrap.append(b); return b;
      });
      const sync = () => btns.forEach((b, i) => b.classList.toggle('primary', S[key] === i + 1));
      sync();
      return { node: el('label', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } }, label + ' → ', wrap), sync };
    };
    const pc = mk('Producer', 'pT', 'P'), cc = mk('Consumer', 'cT', 'C');
    const rs = el('button', { class: 'btn', text: '↺ Reset' });
    rs.onclick = () => { S.P = [1, 1, 1, 1]; S.C = [1, 1, 1, 1]; S.pT = 1; S.cT = 1; S.ok = 0; S.bad = 0; pc.sync(); cc.sync(); log.innerHTML = ''; say('Reset: producer v1 writes <code>amount</code>, consumer v1 reads <code>amount</code>.'); };
    root.append(el('div', { class: 'w-controls' }, pc.node, cc.node, rs));

    const W = narrow ? 360 : 700, pw = 78, ph = 46, gap = 8;
    const px = (i) => 8 + i * (pw + gap), pyP = 26, pyC = 190;
    const mx = narrow ? 20 : 392, my = narrow ? 274 : 44, cw = narrow ? 80 : 74, chh = 28;
    const H = narrow ? my + 22 + 3 * chh + 8 : 250;
    const stage = el('div', { class: 'w-stage' });
    const V = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Producer pods, consumer pods and the writer by reader compatibility matrix' });
    stage.append(V);
    const hintP = el('p', { class: 'muted', style: { margin: '6px 0 0', fontSize: '13px' } });
    const stats = el('div', { class: 'w-stats' });
    const log = el('div', { class: 'w-log', 'aria-live': 'polite' });
    stage.append(hintP); root.append(stage, stats, log);
    function say(t) { log.prepend(el('div', { html: t })); while (log.children.length > 30) log.lastChild.remove(); }
    const T = (x, y, t, size, weight, fill, anchor) => svg('text', { x, y, text: t, 'text-anchor': anchor || 'start', fill: fill || 'var(--text)', style: 'font:' + (weight || 600) + ' ' + size + 'px var(--sans)' });

    V.append(T(8, 17, 'Producer pods (orders): what each writes', 13, 600, 'var(--text-3)'));
    V.append(T(8, pyC - 9, 'Consumer pods (billing): what each reads', 13, 600, 'var(--text-3)'));
    const pods = (y, sub) => [0, 1, 2, 3].map((i) => {
      const r = svg('rect', { x: px(i), y, width: pw, height: ph, rx: 9, fill: 'var(--surface)', stroke: 'var(--border)', 'stroke-width': 2 });
      const t = T(px(i) + pw / 2, y + 20, 'v1', 15, 700, 'var(--text)', 'middle');
      const s = T(px(i) + pw / 2, y + 38, sub, 13, 600, 'var(--text-3)', 'middle');
      V.append(r, t, s); return { r, t, s, flash: 0 };
    });
    const podP = pods(pyP, 'amount'), podC = pods(pyC, 'amount');
    // matrix
    V.append(T(mx, my - 8, 'Can reader vR read what writer vW wrote?', 13, 600, 'var(--text-3)'));
    const cells = {};
    for (let r = 1; r <= 3; r++) V.append(T(mx + 78 + (r - 1) * cw + cw / 2, my + 15, 'reads v' + r, 13, 600, 'var(--text-2)', 'middle'));
    for (let w = 1; w <= 3; w++) {
      V.append(T(mx, my + 22 + (w - 1) * chh + 19, 'writes v' + w, 13, 600, 'var(--text-2)'));
      for (let r = 1; r <= 3; r++) {
        const good = compat(w, r), col = good ? 'var(--ok)' : 'var(--err)';
        const x = mx + 78 + (r - 1) * cw, y = my + 22 + (w - 1) * chh;
        const rect = svg('rect', { x: x + 2, y: y + 2, width: cw - 4, height: chh - 4, rx: 6, fill: col, 'fill-opacity': 0.1, stroke: col, 'stroke-width': 1 });
        V.append(rect, T(x + cw / 2, y + 19, good ? '✓' : '✖', 14, 700, 'var(--text)', 'middle'));
        cells[w + '-' + r] = rect;
      }
    }
    const dots = [];
    for (let i = 0; i < 10; i++) { const c = svg('circle', { r: 6, opacity: 0 }); V.append(c); dots.push({ c, live: false }); }

    function paint() {
      const upd = (arr, vs, sub) => arr.forEach((p, i) => {
        p.t.textContent = 'v' + vs[i]; p.s.textContent = sub[vs[i]];
        p.r.setAttribute('stroke', p.flash > 0 ? 'var(--err)' : vs[i] === 1 ? 'var(--border)' : 'var(--accent)');
      });
      upd(podP, S.P, WR); upd(podC, S.C, RD);
      for (let w = 1; w <= 3; w++) for (let r = 1; r <= 3; r++) {
        const m = frac(S.P, w) * frac(S.C, r);
        cells[w + '-' + r].setAttribute('fill-opacity', m > 0 ? 0.25 + 0.6 * Math.sqrt(m) : 0.06);
        cells[w + '-' + r].setAttribute('stroke-width', m > 0 ? 2.5 : 1);
      }
      const e = errRate(), tot = S.ok + S.bad;
      stats.innerHTML = '';
      [['failing right now', '<b style="color:var(--' + (e > 0 ? 'err' : 'ok') + ')">' + Math.round(e * 100) + '%</b> of messages'],
        ['delivered', '<b>' + S.ok + '</b>'], ['failed', '<b style="color:var(--' + (S.bad ? 'err' : 'ok') + ')">' + S.bad + '</b>'],
        ['failed overall', '<b>' + (tot ? (100 * S.bad / tot).toFixed(1) : '0.0') + '%</b>']]
        .forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: k + ': ' + v })));
      hintP.innerHTML = hint();
    }
    function stepRoll(arr, target, who) {
      const i = arr.findIndex((x) => x !== target);
      if (i < 0) return;
      arr[i] = target;
      if (arr.every((x) => x === target)) {
        const e = errRate();
        say((e > 0 ? '✖ ' : '✔ ') + who + ' rollout finished: all pods on v' + target + '. ' + (e > 0 ? '<b>' + Math.round(e * 100) + '% of messages now fail</b> and will keep failing until one side changes.' : 'No incompatible pair is live.'));
      }
    }
    let acc = 0;
    loopH = ctx.loop((dt) => {
      dt = Math.min(dt, 100);
      if (S.P.some((x) => x !== S.pT)) { pClock += dt; if (pClock > 900) { pClock = 0; stepRoll(S.P, S.pT, 'Producer'); } } else pClock = 0;
      if (S.C.some((x) => x !== S.cT)) { cClock += dt; if (cClock > 900) { cClock = 0; stepRoll(S.C, S.cT, 'Consumer'); } } else cClock = 0;
      spawn += dt;
      if (spawn > 150) {           // one message: random writer pod -> random reader pod (load balancing)
        spawn = 0;
        const a = Math.floor(Math.random() * N), b = Math.floor(Math.random() * N), good = compat(S.P[a], S.C[b]);
        if (good) S.ok++; else { S.bad++; podC[b].flash = 500; }
        const d = dots.find((x) => !x.live);
        if (d && !ctx.reduced) { d.live = true; d.t = 0; d.a = a; d.b = b; d.c.setAttribute('fill', good ? 'var(--ok)' : 'var(--err)'); }
      }
      dots.forEach((d) => {
        if (!d.live) return;
        d.t += dt / 650; const k = Math.min(1, d.t);
        d.c.setAttribute('cx', px(d.a) + pw / 2 + (px(d.b) - px(d.a)) * k);
        d.c.setAttribute('cy', pyP + ph + (pyC - pyP - ph) * k);
        d.c.setAttribute('opacity', k < 1 ? 1 : 0);
        if (k >= 1) d.live = false;
      });
      podC.forEach((p) => { if (p.flash > 0) p.flash -= dt; });
      acc += dt; if (acc > 120) { acc = 0; paint(); }
    });
    ui = { say };
    paint();
    say('Both services are on v1. Try <b>Producer → v3</b> first to see a one-step rename fail during and after the rollout. Then reset and follow the hints.');
  }
  build(ctx.narrow);
  ctx.onResize(build);
});
