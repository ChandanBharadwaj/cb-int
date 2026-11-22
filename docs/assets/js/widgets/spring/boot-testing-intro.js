/* Beginner intro: what each test annotation actually loads into the context. */
IA.widget('boot-testing-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const LAYERS = ['Controllers, @ControllerAdvice', 'Filters & SecurityFilterChain', 'Jackson ObjectMapper', '@Service beans', 'JPA repositories + entities', 'DataSource + Flyway', 'Real web server (port)'];
  // y = loaded, m = you supply a mock, n = not loaded
  const SLICES = {
    '@WebMvcTest': { v: ['y', 'y', 'y', 'm', 'n', 'n', 'n'], say: 'Only the web layer. The services your controller needs don’t exist, so you provide them with <code>@MockitoBean</code>. Requests go through MockMvc, with no port.' },
    '@DataJpaTest': { v: ['n', 'n', 'n', 'n', 'y', 'y', 'n'], say: 'Only JPA: entities, repositories, the DataSource and migrations. Each test runs in a transaction that rolls back at the end.' },
    '@JsonTest': { v: ['n', 'n', 'y', 'n', 'n', 'n', 'n'], say: 'Just Jackson, for checking that your DTOs serialize the way you expect.' },
    '@SpringBootTest': { v: ['y', 'y', 'y', 'y', 'y', 'y', 'n'], say: 'The whole application, in a mock servlet environment (the default <code>MOCK</code>). Slowest to start, best for wiring.' },
    '… (RANDOM_PORT)': { v: ['y', 'y', 'y', 'y', 'y', 'y', 'y'], say: 'Everything, plus a real Tomcat on a random port. Requests run on server threads, so a test transaction can’t roll them back.' }
  };
  let cur = '@WebMvcTest'; let gen = 0;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Test annotation', style: { justifyContent: 'center' } });
  const rows = LAYERS.map((l) => { const s = el('span', { class: 'pill', text: '' }); const r = el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '5px', background: 'var(--surface)', transition: reduced ? 'none' : 'all .35s' } }, el('span', { text: l, style: { fontSize: '14px' } }), s); r._s = s; return r; });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: '' }));
  Object.keys(SLICES).forEach((k) => { const b = el('button', { text: k, class: k === cur ? 'on' : '' }); b.addEventListener('click', () => { cur = k; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); paint(); }); seg.append(b); });
  root.append(el('div', { class: 'w-controls', style: { justifyContent: 'center' } }, seg), el('div', { style: { maxWidth: '520px', margin: '0 auto' } }, rows), cap);
  async function paint() {
    const g = ++gen; const S = SLICES[cur];
    cap.firstChild.innerHTML = S.say;
    for (let i = 0; i < rows.length; i++) {
      const v = S.v[i]; const r = rows[i];
      r.style.opacity = v === 'n' ? '.4' : '1';
      r.style.borderColor = v === 'y' ? 'var(--ok)' : v === 'm' ? 'var(--warn)' : 'var(--border)';
      r.style.background = v === 'y' ? 'var(--accent-soft)' : 'var(--surface)';
      r._s.textContent = v === 'y' ? 'loaded' : v === 'm' ? '@MockitoBean' : 'not loaded';
      if (!reduced) { await sleep(90); if (g !== gen) return; }
    }
  }
  paint();
});
