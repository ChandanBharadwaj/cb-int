/* Beginner intro: one master address book, copies kept in sync by replaying a change log (and skipping repeats). */
IA.widget('polyglot-persistence-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const mk = (icon, name) => { const v = el('div', { style: { fontFamily: 'var(--mono)', fontSize: '13px', marginTop: '4px' } }); const n = el('div', { class: 'card', style: { padding: '10px', textAlign: 'center', minWidth: '0', transition: 'all .3s' } }, el('div', { text: icon, style: { fontSize: '24px' } }), el('b', { text: name, style: { fontSize: '13px' } }), v); n._v = v; return n; };
  const H = mk('🏠', 'Master (Postgres)'), C = mk('🚗', 'Copy: cache'), W = mk('🏢', 'Copy: search');
  const logEl = el('div', { class: 'w-log', style: { minHeight: '40px' } });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press “Show me”: Dina moves from Pune to Oslo.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '8px' } }, H, C, W), el('div', { class: 'kicker', text: 'change log', style: { marginTop: '10px' } }), logEl,
    el('div', { class: 'w-controls', style: { marginTop: '10px', justifyContent: 'center' } }, btn), cap);
  const set = (n, t, c) => { n._v.textContent = t; n.style.borderColor = c ? `var(--${c})` : ''; };
  let gen = 0;
  btn.addEventListener('click', async () => {
    const g = ++gen; logEl.innerHTML = ''; [H, C, W].forEach((n) => set(n, 'Dina: Pune')); const w = () => sleep(reduced ? 300 : 2000);
    const S = [
      () => { set(H, 'Dina: Oslo', 'ok'); logEl.append(el('div', { text: '#7 Dina → Oslo' })); cap.firstChild.textContent = 'Update the master and, in the same step, write entry #7 in the change log.'; },
      () => { set(C, 'Dina: Pune', 'err'); set(W, 'Dina: Pune', 'err'); cap.firstChild.textContent = 'For a moment the copies are behind. That is normal: they are derived, and will catch up.'; },
      () => { set(C, 'Dina: Oslo ✓#7', 'ok'); cap.firstChild.textContent = 'The cache replays #7.'; },
      () => { set(W, 'Dina: Oslo ✓#7', 'ok'); cap.firstChild.textContent = 'Search replays #7.'; },
      () => { logEl.append(el('div', { text: '#7 Dina → Oslo (delivered again)', style: { color: 'var(--warn)' } })); cap.firstChild.textContent = 'The log is delivered again after a hiccup. Each copy sees it already applied #7 and skips it. All copies agree.'; }
    ];
    for (const f of S) { if (g !== gen) return; f(); await w(); }
  });
});
