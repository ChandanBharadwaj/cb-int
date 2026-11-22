/* Container memory budget: heap share vs metaspace, code cache, thread stacks, direct buffers and native overhead against the cgroup limit. Estimates are illustrative. */
IA.widget('startup-performance-memory', (root, ctx) => {
  const { el, svg } = ctx;
  let limit = 1024; let pct = 25; let threads = 200; let direct = 64;
  const range = (label, min, max, stepv, get, set, fmt) => { const out = el('b', { text: fmt(get()) });
    const inp = el('input', { type: 'range', min, max, step: stepv, value: get(), 'aria-label': label });
    inp.addEventListener('input', () => { set(+inp.value); out.textContent = fmt(get()); render(); });
    return el('label', {}, label + ' ', inp, out); };
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); render(); }); s.append(b); }); return s; };
  const stage = svg('svg', { viewBox: '0 0 760 190', role: 'img', 'aria-label': 'Stacked memory bar against the container limit' });
  const stats = el('div', { class: 'w-stats' }); const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, range('limit', 512, 4096, 128, () => limit, (v) => { limit = v; }, (v) => v + ' MiB'), range('MaxRAMPercentage', 25, 90, 5, () => pct, (v) => { pct = v; }, (v) => v + '%')),
    el('div', { class: 'w-controls' }, range('threads', 50, 800, 25, () => threads, (v) => { threads = v; }, (v) => String(v)), el('span', { class: 'tiny', text: 'direct buffers' }), seg([[32, '32 MiB'], [64, '64 MiB'], [256, '256 MiB (Netty-heavy)']], direct, (v) => { direct = v; }, 'Direct memory')),
    el('div', { class: 'w-stage' }, stage), stats, narr);
  function render() {
    const heap = limit * pct / 100;
    const parts = [['heap (max)', heap, 'var(--accent)'], ['metaspace', 140, 'var(--k-ml)'], ['code cache', 70, 'var(--k-compute)'], ['thread stacks', threads * 0.5, 'var(--warn)'], ['direct buffers', direct, 'var(--k-queue)'], ['GC + other native', 40 + heap * 0.05, 'var(--text-3)']];
    const total = parts.reduce((s, p) => s + p[1], 0); const scale = Math.max(limit, total) * 1.06; const W = 720; const x0 = 20;
    stage.innerHTML = '';
    let x = x0;
    parts.forEach(([n, v, c], i) => { const w = (v / scale) * W;
      stage.append(svg('rect', { x, y: 40, width: Math.max(1, w - 1), height: 56, fill: `color-mix(in srgb, ${c} 45%, var(--surface))`, stroke: c, 'stroke-width': 1.2 }));
      if (w > 54) stage.append(svg('text', { x: x + 5, y: 64, 'font-size': 10.5, 'font-family': 'var(--mono)', fill: 'var(--text)', text: n }), svg('text', { x: x + 5, y: 82, 'font-size': 10.5, 'font-weight': 700, 'font-family': 'var(--mono)', fill: 'var(--text)', text: Math.round(v) + ' MiB' }));
      stage.append(svg('rect', { x: x0 + (i % 3) * 240, y: 130 + Math.floor(i / 3) * 20, width: 10, height: 10, rx: 2, fill: c }), svg('text', { x: x0 + 16 + (i % 3) * 240, y: 139 + Math.floor(i / 3) * 20, 'font-size': 10.5, 'font-family': 'var(--mono)', fill: 'var(--text-2)', text: `${n}: ${Math.round(v)} MiB` }));
      x += w; });
    const lx = x0 + (limit / scale) * W; const over = total > limit;
    stage.append(svg('path', { d: `M${lx} 22 L${lx} 112`, stroke: 'var(--err)', 'stroke-width': 2.4, 'stroke-dasharray': '6 3' }),
      svg('text', { x: Math.min(lx, 730), y: 16, 'font-size': 11, 'font-weight': 700, 'text-anchor': 'end', 'font-family': 'var(--mono)', fill: 'var(--err)', text: `cgroup limit ${limit} MiB` }));
    if (over) stage.append(svg('rect', { x: lx, y: 36, width: x0 + (total / scale) * W - lx, height: 64, fill: 'none', stroke: 'var(--err)', 'stroke-width': 2.4 }), svg('text', { x: lx + 4, y: 116, 'font-size': 11, 'font-weight': 700, 'font-family': 'var(--mono)', fill: 'var(--err)', text: 'OOMKilled' }));
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `-Xmx ≈ <b>${Math.round(heap)} MiB</b>` }), el('span', { class: 'w-stat', html: `worst-case RSS ≈ <b>${Math.round(total)} MiB</b>` }), el('span', { class: 'w-stat', html: `headroom <b style="color:${over ? 'var(--err)' : 'var(--ok)'}">${Math.round(limit - total)} MiB</b>` }));
    narr.className = 'caption' + (over ? ' err' : pct <= 30 ? ' warn' : ' ok'); narr.innerHTML = '';
    narr.append(el('div', { class: 't', html: over ? `If the heap fills up to its maximum, the process needs about ${Math.round(total)} MiB, more than the ${limit} MiB limit: the kernel kills it (exit 137) with <b>no Java OutOfMemoryError</b>. Lower the heap share, cap direct memory or threads, or raise the limit.`
      : pct <= 30 ? `This is close to the JVM default (25%). The heap is small and most of the container sits unused; expect frequent GC. Typical services run 60–75% if threads and direct buffers are modest.`
      : `Fits, with ${Math.round(limit - total)} MiB headroom. Verify with Native Memory Tracking under real load: metaspace, code cache and thread numbers here are typical estimates, not your app’s.` }));
  }
  render();
});
