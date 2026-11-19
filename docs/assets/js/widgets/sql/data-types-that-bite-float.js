/* numeric vs float8: add 0.10 N times and watch the binary float drift away from the exact decimal. */
IA.widget('data-types-that-bite-float', (root, ctx) => {
  const { el } = ctx;
  let n = 3; let step = '0.1';
  const seg = (opts, cur, on) => { const s = el('div', { class: 'seg' }); opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const range = el('input', { type: 'range', min: 1, max: 1000, value: n, style: { width: '100%' }, 'aria-label': 'number of additions' });
  const out = el('div');
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'add' }), seg([['0.1', '0.1'], ['0.01', '0.01'], ['1.1', '1.1']], step, (v) => { step = v; paint(); })),
    el('div', { class: 'slider-row' }, el('span', { class: 'tiny', text: 'times' }), range), out);
  range.addEventListener('input', () => { n = +range.value; paint(); });
  function paint() {
    let f = 0; for (let i = 0; i < n; i++) f += +step;            // JS number = IEEE 754 double = Postgres float8
    const dec = step.split('.')[1].length; const exactInt = BigInt(step.replace('.', '')) * BigInt(n);
    const s = exactInt.toString().padStart(dec + 1, '0'); const exact = s.slice(0, -dec) + '.' + s.slice(-dec);
    const eq = String(f) === String(+exact);
    out.innerHTML = '';
    out.append(el('div', { class: 'tscroll' }, el('table', { class: 't rg' },
      el('thead', null, el('tr', null, el('th', { text: 'type' }), el('th', { text: `sum of ${step} × ${n}` }), el('th', { text: `= ${exact}?` }))),
      el('tbody', null,
        el('tr', null, el('td', { html: '<code>numeric</code>' }), el('td', { text: exact, style: { fontFamily: 'var(--mono)' } }), el('td', { text: 'true', style: { color: 'var(--ok)' } })),
        el('tr', null, el('td', { html: '<code>float8 / double</code>' }), el('td', { text: String(f), style: { fontFamily: 'var(--mono)', color: eq ? 'var(--text)' : 'var(--err)' } }), el('td', { text: String(eq), style: { color: eq ? 'var(--ok)' : 'var(--err)' } }))))),
      el('div', { class: 'tiny', html: `Error: <b>${Math.abs(f - +exact).toExponential(2)}</b>. 0.1 has no exact binary representation, so each addition rounds. Postgres prints float8 with the shortest round-trip form (PG12+), which is why you see the noise.`, style: { marginTop: '6px' } }));
  }
  paint();
});
