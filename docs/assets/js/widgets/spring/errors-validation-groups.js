/* Validation groups: which constraints are in scope for the group passed to @Validated, and which fail for a given payload. */
IA.widget('errors-validation-groups', (root, ctx) => {
  const { el, sleep, reduced, codeBox } = ctx;
  const C = [
    { f: 'id', c: '@Null(groups = OnCreate.class)', g: 'OnCreate', test: (p) => p.id === null },
    { f: 'id', c: '@NotNull(groups = OnUpdate.class)', g: 'OnUpdate', test: (p) => p.id !== null },
    { f: 'name', c: '@NotBlank', g: 'Default', test: (p) => p.name.trim() !== '' },
    { f: 'email', c: '@Email', g: 'Default', test: (p) => /^[^@\s]+@[^@\s]+$/.test(p.email) }
  ];
  const GROUPS = {
    def: { l: '@Valid (Default)', inc: ['Default'] },
    cr: { l: '@Validated(OnCreate.class)', inc: ['OnCreate'] },
    up: { l: '@Validated(OnUpdate.class)', inc: ['OnUpdate'] },
    crd: { l: 'OnCreate extends Default', inc: ['OnCreate', 'Default'] },
    upd: { l: '@Validated({OnUpdate.class, Default.class})', inc: ['OnUpdate', 'Default'] }
  };
  const PAY = {
    create: { l: 'POST body: id null, name "", email "x"', p: { id: null, name: '', email: 'x' } },
    update: { l: 'PUT body: id 7, name "Asha", email "asha@example.com"', p: { id: 7, name: 'Asha', email: 'asha@example.com' } },
    sneaky: { l: 'POST body: id 7, name "Ben", email "ben@example.com"', p: { id: 7, name: 'Ben', email: 'ben@example.com' } }
  };
  let g = 'cr'; let pay = 'create'; let gen = 0;
  const mkSeg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segG = mkSeg(Object.keys(GROUPS).map((x) => [x, GROUPS[x].l]), g, (v) => { g = v; run(); }, 'Group');
  const segP = mkSeg(Object.keys(PAY).map((x) => [x, PAY[x].l]), pay, (v) => { pay = v; run(); }, 'Payload');
  const dto = codeBox(`public interface OnCreate {}          // or: extends Default (see buttons)\npublic interface OnUpdate {}\n\nrecord UserDto(\n  @Null(groups = OnCreate.class) @NotNull(groups = OnUpdate.class) Long id,\n  @NotBlank String name,               // group: Default\n  @Email String email) {}              // group: Default`, 'java');
  const tb = el('tbody');
  const out = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.append(dto, el('div', { class: 'w-controls', style: { marginTop: '10px' } }, segG), el('div', { class: 'w-controls' }, segP),
    el('div', { class: 'tscroll' }, el('table', { class: 't rg' }, el('thead', null, el('tr', null, ['field', 'constraint', 'group', 'in scope?', 'result'].map((h) => el('th', { text: h })))), tb)), out);
  async function run() {
    const my = ++gen; const G = GROUPS[g]; const P = PAY[pay].p; tb.innerHTML = ''; let fails = 0; const msgs = [];
    for (const c of C) {
      const inScope = G.inc.includes(c.g); const ok = c.test(P);
      const res = !inScope ? 'skipped' : ok ? '✓ pass' : '✗ violation';
      if (inScope && !ok) { fails++; msgs.push(c.f); }
      tb.append(el('tr', { style: { opacity: inScope ? '1' : '.45', animation: reduced ? 'none' : 'capin .3s ease both' } },
        el('td', { text: c.f }), el('td', { text: c.c }), el('td', { text: c.g }), el('td', { text: inScope ? 'yes' : 'no' }),
        el('td', { text: res, style: { color: !inScope ? 'var(--text-3)' : ok ? 'var(--ok)' : 'var(--err)', fontWeight: '700' } })));
      if (!reduced) { await sleep(260); if (my !== gen) return; }
    }
    out.className = 'caption ' + (fails ? 'warn' : 'ok');
    const skippedDefault = !G.inc.includes('Default') && (!P.name.trim() || !/^[^@\s]+@[^@\s]+$/.test(P.email));
    out.firstChild.innerHTML = fails ? `<b>400</b>: ${fails} violation(s) on ${msgs.join(', ')}.${skippedDefault ? ' Some broken Default constraints were never checked.' : ''}`
      : skippedDefault ? '<b>Passes</b>, even though <code>name</code> is blank and <code>email</code> is invalid: only the chosen group ran, and those constraints are in <code>Default</code>. Make the group extend <code>Default</code>.'
        : pay === 'sneaky' && !G.inc.includes('OnCreate') ? '<b>Passes</b>. Note that a POST with a client-chosen <code>id</code> is only rejected when <code>OnCreate</code> is validated.' : '<b>Passes</b>: every constraint in scope holds.';
  }
  run();
});
