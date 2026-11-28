/* Contract diff: apply changes to a data product's output port, diff against contract v1,
   classify each change (breaking / compatible), find affected consumers, apply the enforcement mode. */
SD.widget('data-mesh', function (root, ctx) {
  const { el, svg } = ctx;
  const V1 = {
    fields: [
      { name: 'order_id', type: 'int4', required: true },
      { name: 'customer_id', type: 'uuid', required: true },
      { name: 'total', type: 'numeric', required: true },
      { name: 'coupon', type: 'text', required: false },
      { name: 'email', type: 'text', required: true }
    ],
    freshnessH: 1
  };
  const CONSUMERS = [
    { name: 'Finance report', reads: ['order_id', 'total'], needH: 24 },
    { name: 'Fraud model', reads: ['order_id', 'customer_id', 'total', 'email'], needH: 1 },
    { name: 'Marketing', reads: ['customer_id', 'coupon'], needH: 24 }
  ];
  const WIDENING = { 'int4>int8': 1, 'float4>float8': 1, 'varchar>text': 1 };
  const CHANGES = [
    { id: 'add', label: '+ channel', apply: (c) => c.fields.push({ name: 'channel', type: 'text', required: false }) },
    { id: 'rename', label: 'total → amount', apply: (c) => { c.fields.find((f) => f.name === 'total').name = 'amount'; } },
    { id: 'drop', label: 'drop coupon', apply: (c) => { c.fields = c.fields.filter((f) => f.name !== 'coupon'); } },
    { id: 'widen', label: 'order_id → int8', apply: (c) => { c.fields.find((f) => f.name === 'order_id').type = 'int8'; } },
    { id: 'null', label: 'email nullable', apply: (c) => { c.fields.find((f) => f.name === 'email').required = false; } },
    { id: 'sla', label: 'freshness 1 h → 6 h', apply: (c) => { c.freshnessH = 6; } }
  ];
  const on = {}; let mode = 'none';

  // ---- the diff: knows nothing about which buttons were pressed, only old vs new ----
  function diff(oldC, newC) {
    const out = [], newBy = {};
    newC.fields.forEach((f) => { newBy[f.name] = f; });
    const readers = (name) => CONSUMERS.filter((c) => c.reads.indexOf(name) >= 0).map((c) => c.name);
    oldC.fields.forEach((o) => {
      const n = newBy[o.name];
      if (!n) { out.push({ field: o.name, tag: 'removed', breaking: true, hit: readers(o.name), why: '<code>' + o.name + '</code> removed or renamed: every reader of it fails' }); return; }
      if (n.type !== o.type) {
        const wide = !!WIDENING[o.type + '>' + n.type];
        out.push({ field: o.name, tag: wide ? 'widened' : 'retyped', breaking: !wide, hit: wide ? [] : readers(o.name), why: '<code>' + o.name + '</code> ' + o.type + ' → ' + n.type + (wide ? ': widening, old values still fit' : ': incompatible type') });
      }
      if (o.required && !n.required) out.push({ field: o.name, tag: 'nullable', breaking: true, hit: readers(o.name), why: '<code>' + o.name + '</code> was NOT NULL, may now be NULL: readers that never expected NULL compute wrong results' });
    });
    newC.fields.forEach((n) => { if (!oldC.fields.some((o) => o.name === n.name)) out.push({ field: n.name, tag: 'added', breaking: false, hit: [], why: '<code>' + n.name + '</code> added: readers that select named columns are unaffected' }); });
    if (newC.freshnessH > oldC.freshnessH) out.push({ field: '@sla', tag: 'weaker', breaking: true, hit: CONSUMERS.filter((c) => c.needH < newC.freshnessH).map((c) => c.name), why: 'freshness guarantee ' + oldC.freshnessH + ' h → ' + newC.freshnessH + ' h: weaker promise, breaks consumers that need fresher data' });
    return out;
  }
  function compute() {
    const next = { fields: V1.fields.map((f) => Object.assign({}, f)), freshnessH: V1.freshnessH };
    CHANGES.forEach((c) => { if (on[c.id]) c.apply(next); });
    const d = diff(V1, next);
    const breaking = d.filter((x) => x.breaking), compat = d.filter((x) => !x.breaking);
    const hit = {}; breaking.forEach((x) => x.hit.forEach((n) => { (hit[n] = hit[n] || []).push(x.field === '@sla' ? 'freshness' : x.field); }));
    const version = breaking.length ? '2.0.0' : compat.length ? '1.1.0' : '1.0.0';
    return { next, d, breaking, compat, hit, version };
  }

  function build(narrow) {
    root.innerHTML = '';
    const controls = el('div', { class: 'w-controls' });
    CHANGES.forEach((c) => {
      const b = el('button', { class: 'btn', text: c.label });
      b.classList.toggle('primary', !!on[c.id]);
      b.onclick = () => { on[c.id] = !on[c.id]; b.classList.toggle('primary', !!on[c.id]); paint(); };
      controls.append(b);
    });
    const seg = el('div', { class: 'w-seg', role: 'group', 'aria-label': 'Enforcement' });
    const mb = [['none', 'No contract'], ['ci', 'CI gate'], ['v2', 'CI gate + v2 side by side']].map(([v, l]) => {
      const b = el('button', { class: 'btn', text: l });
      b.onclick = () => { mode = v; sync(); paint(); };
      b._v = v; seg.append(b); return b;
    });
    const sync = () => mb.forEach((b) => b.classList.toggle('primary', b._v === mode));
    sync();
    root.append(controls, el('div', { class: 'w-controls' }, el('label', null, 'Enforcement '), seg));

    const W = narrow ? 360 : 700, rowH = 27, cH = 66;
    const fx = 6, fw = narrow ? 348 : 330, fy = 30;
    const cx = narrow ? 6 : 360, cw = narrow ? 348 : 334;
    const H = narrow ? fy + 8 * rowH + 34 + 3 * (cH + 8) : fy + 8 * rowH + 10;
    let cTop = narrow ? fy + 8 * rowH + 34 : 30;
    const stage = el('div', { class: 'w-stage' });
    const S = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Data contract fields and the consumers that read them' });
    stage.append(S); root.append(stage);
    const stats = el('div', { class: 'w-stats' });
    const vd = el('p', { style: { margin: '10px 0 0', fontSize: '14px' }, 'aria-live': 'polite' });
    const log = el('div', { class: 'w-log' });
    root.append(stats, vd, log);
    const T = (x, y, t, f, w, fill, anchor, mono) => svg('text', { x, y, text: t, 'text-anchor': anchor || 'start', fill: fill || 'var(--text)', style: 'font:' + (w || 600) + ' ' + f + 'px var(--' + (mono ? 'mono' : 'sans') + ')' });
    const COL = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', info: 'var(--accent)' };

    function paint() {
      const r = compute();
      S.innerHTML = '';
      const blocked = mode === 'ci' && r.breaking.length > 0;
      // ---- contract panel ----
      S.append(T(fx + 2, 18, 'orders output port · contract ' + (blocked ? '1.0.0 (change blocked)' : mode === 'v2' && r.breaking.length ? '1.0.0 + 2.0.0' : r.version), 14, 700));
      const rows = [];
      V1.fields.forEach((o) => {
        const ds = r.d.filter((x) => x.field === o.name);
        const n = r.next.fields.find((f) => f.name === o.name);
        const tag = ds.length ? ds[ds.length - 1] : null;
        rows.push({ key: o.name, name: o.name, type: (n || o).type + ((n || o).required ? ' NOT NULL' : ' NULL'), tag });
      });
      r.d.filter((x) => x.tag === 'added').forEach((x) => { const n = r.next.fields.find((f) => f.name === x.field); rows.push({ key: x.field, name: x.field, type: n.type + (n.required ? ' NOT NULL' : ' NULL'), tag: x }); });
      const sla = r.d.find((x) => x.field === '@sla');
      rows.push({ key: '@sla', name: 'freshness', type: '≤ ' + r.next.freshnessH + ' h', tag: sla || null });
      if (narrow) { cTop = fy + rows.length * rowH + 34; S.setAttribute('viewBox', '0 0 ' + W + ' ' + (cTop + 3 * (cH + 8))); }
      const rowY = {};
      rows.forEach((row, i) => {
        const y = fy + i * rowH; rowY[row.key] = y + rowH / 2;
        const c = row.tag ? (row.tag.breaking ? COL.err : COL.ok) : 'var(--border)';
        S.append(svg('rect', { x: fx, y: y + 2, width: fw, height: rowH - 4, rx: 6, fill: 'var(--surface)', stroke: c, 'stroke-width': row.tag ? 2 : 1 }));
        const gone = row.tag && row.tag.tag === 'removed';
        S.append(T(fx + 8, y + 18, row.name, 13, 700, gone ? 'var(--text-3)' : 'var(--text)', 'start', true));
        S.append(T(fx + 112, y + 18, gone ? '' : row.type, 13, 500, 'var(--text-3)'));
        if (row.tag) S.append(T(fx + fw - 8, y + 18, row.tag.tag, 13, 700, c, 'end'));
      });
      // ---- consumers ----
      if (!narrow) S.append(T(cx + 2, 18, 'Subscribed consumers', 14, 700));
      else S.append(T(cx + 2, cTop - 10, 'Subscribed consumers', 14, 700));
      let affected = 0;
      CONSUMERS.forEach((c, i) => {
        const y = cTop + i * (cH + 8);
        const hits = r.hit[c.name];
        let tone = 'ok', status = 'ok';
        if (hits) {
          affected++;
          if (mode === 'none') { tone = 'err'; status = 'breaks in production'; }
          else if (mode === 'ci') { tone = 'ok'; status = 'protected'; }
          else { tone = 'warn'; status = 'stays on v1, migrates'; }
        }
        S.append(svg('rect', { x: cx, y, width: cw, height: cH, rx: 10, fill: 'var(--surface)', stroke: hits ? COL[tone] : 'var(--border)', 'stroke-width': 2 }));
        S.append(T(cx + 12, y + 22, c.name, 15, 700));
        S.append(T(cx + cw - 12, y + 22, status, 13, 700, hits ? COL[tone] : 'var(--text-3)', 'end'));
        S.append(T(cx + 12, y + 41, 'reads ' + (narrow && c.reads.length > 3 ? c.reads.slice(0, 3).join(', ') + ' +' + (c.reads.length - 3) : c.reads.join(', ')), 13, 500, 'var(--text-3)'));
        S.append(T(cx + 12, y + 58, hits ? 'affected by: ' + hits.join(', ') : 'needs data ≤ ' + c.needH + ' h old', 13, 600, hits ? COL[tone] : 'var(--text-3)'));
        if (!narrow) c.reads.concat(['@sla']).forEach((f) => {
          if (rowY[f] === undefined) return;
          const bad = hits && hits.indexOf(f === '@sla' ? 'freshness' : f) >= 0;
          if (f === '@sla' && !bad) return;
          S.insertBefore(svg('line', { x1: fx + fw, y1: rowY[f], x2: cx, y2: y + cH / 2, stroke: bad ? COL[mode === 'none' ? 'err' : mode === 'ci' ? 'ok' : 'warn'] : 'var(--border)', 'stroke-width': bad ? 2.5 : 1.2, 'stroke-dasharray': bad ? '' : '3 4' }), S.firstChild);
        });
      });
      // ---- outcome ----
      const outcome = !r.d.length ? 'no change' : blocked ? 'build blocked' : mode === 'v2' && r.breaking.length ? 'v1 kept + v2 published' : 'deployed as ' + r.version;
      stats.innerHTML = '';
      [['breaking', r.breaking.length], ['compatible', r.compat.length], ['consumers affected', affected + ' / ' + CONSUMERS.length], ['outcome', outcome]]
        .forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: k + ': <b>' + v + '</b>' })));
      vd.innerHTML = !r.d.length ? 'Toggle a change above. Try <b>total → amount</b> with <b>No contract</b>, then switch the enforcement mode.'
        : !r.breaking.length ? '✅ Only compatible changes: a <b>minor</b> version (' + r.version + '). No consumer needs to act.'
        : mode === 'none' ? '❌ The change ships. <b>' + affected + ' consumer' + (affected === 1 ? '' : 's') + '</b> break' + (affected === 1 ? 's' : '') + ' in production and the producer hears about it from an incident.'
        : mode === 'ci' ? '⚠ The producer\'s build fails and lists the affected consumers. Nothing breaks, but the change cannot ship until it becomes a new major version.'
        : '✅ v1 stays as it is; <b>v2</b> is published next to it with a sunset date. ' + affected + ' consumer' + (affected === 1 ? '' : 's') + ' migrate' + (affected === 1 ? 's' : '') + ' on a schedule. Cost: two ports to run until v1 is retired.';
      log.innerHTML = '';
      r.d.forEach((x) => log.append(el('div', { html: (x.breaking ? '<b style="color:var(--err)">BREAKING</b> ' : '<b style="color:var(--ok)">compatible</b> ') + x.why + (x.hit.length ? ' → ' + x.hit.join(', ') : '') })));
      if (!r.d.length) log.append(el('div', { html: 'Contract 1.0.0: 5 fields, freshness ≤ 1 h, 3 subscribed consumers.' }));
    }
    paint();
  }
  build(ctx.narrow);
  ctx.onResize(build);
});
