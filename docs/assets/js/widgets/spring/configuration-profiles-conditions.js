/* Profiles & conditions: toggle active profiles, a property and the classpath; see which @Bean / @Configuration definitions get registered and why. */
IA.widget('configuration-profiles-conditions', (root, ctx) => {
  const { el } = ctx;
  if (!document.getElementById('w-cnd-style')) {
    document.head.append(el('style', { id: 'w-cnd-style', text: `
.w-cnd td.y { color: var(--ok); font-weight: 700; } .w-cnd td.n { color: var(--text-3); font-weight: 700; } .w-cnd td.w { color: var(--warn); font-weight: 700; }
.w-cnd tr.flip td { animation: capin .35s ease both; background: var(--accent-soft); }
.w-cnd td.why { font-family: var(--sans); font-size: 12.5px; color: var(--text-2); }
.w-cnd .grp { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.w-cnd .grp > span { font-size: 12.5px; color: var(--text-2); margin-right: 2px; }
` }));
  }
  const P = { dev: false, test: false, prod: false, cloud: false }; let prop = 'unset'; let redis = true; let last = {};
  const has = (p) => P[p];
  const none = () => !Object.values(P).some(Boolean);
  const ROWS = [
    { c: '@Profile("dev")', b: 'H2ConsoleConfig', f: () => [has('dev'), has('dev') ? '“dev” is active.' : '“dev” is not active.'] },
    { c: '@Profile("!prod")', b: 'FakePaymentGateway', f: () => [!has('prod'), has('prod') ? '“prod” is active, so the negation fails.' : 'Matches whenever “prod” is not active, including with no profile at all. Easy to ship a fake to staging.'] },
    { c: '@Profile("prod & cloud")', b: 'CloudKmsSecrets', f: () => [has('prod') && has('cloud'), 'Profile expressions (Spring 5.1+) support <code>&amp;</code>, <code>|</code>, <code>!</code> and parentheses. Both must be active.'] },
    { c: '@Profile({"dev", "test"})', b: 'SeedDataLoader', f: () => [has('dev') || has('test'), 'An array means OR: any listed profile is enough.'] },
    { c: '@Profile("default")', b: 'LocalDefaults', f: () => [none(), none() ? 'No profile is active, so the <b>default</b> profile is. It switches off as soon as any profile is activated.' : 'A profile is active, so “default” is not.'] },
    { c: '@ConditionalOnProperty(name = "feature.audit.enabled", havingValue = "true")', b: 'AuditListener', f: () => [prop === 'true', prop === 'unset' ? 'Property missing and <code>matchIfMissing</code> defaults to false.' : `Value is “${prop}”.`] },
    { c: '@ConditionalOnProperty(name = "feature.audit.enabled", matchIfMissing = true)', b: 'AuditMetrics', f: () => [prop !== 'false', prop === 'unset' ? 'Missing, and <code>matchIfMissing = true</code>.' : prop === 'true' ? 'Without <code>havingValue</code>, any value except “false” matches.' : 'The value “false” never matches when havingValue is not set.'] },
    { c: '@ConditionalOnClass(name = "io.lettuce.core.RedisClient")', b: 'RedisCacheConfig', f: () => [redis, redis ? 'The class is on the classpath (spring-boot-starter-data-redis).' : 'The class is missing. Using <code>name = "…"</code> (a string) avoids loading the class to check.'] },
    { c: '@ConditionalOnBean(DataSource.class)  // in YOUR config', b: 'ReportingConfig', f: () => ['w', 'Order-dependent. Your configuration classes are processed <b>before</b> auto-configuration, so Boot’s DataSource isn’t registered yet and this usually doesn’t match. Use <code>@ConditionalOnBean</code> only in auto-configuration classes, ordered with <code>@AutoConfiguration(after = …)</code>.'] }
  ];
  const btn = (label, get, set) => { const b = el('button', { text: label }); const paint = () => b.classList.toggle('on', get()); b.addEventListener('click', () => { set(); paint(); render(); }); paint(); return b; };
  const pg = el('div', { class: 'grp seg', role: 'group', 'aria-label': 'Active profiles' }, el('span', { text: 'profiles' }), Object.keys(P).map((p) => btn(p, () => P[p], () => { P[p] = !P[p]; })));
  const propSeg = el('div', { class: 'grp seg', role: 'radiogroup', 'aria-label': 'feature.audit.enabled' }, el('span', { text: 'feature.audit.enabled' }));
  ['unset', 'true', 'false'].forEach((v) => propSeg.append(btn(v, () => prop === v, () => { prop = v; [...propSeg.querySelectorAll('button')].forEach((x) => x.classList.toggle('on', x.textContent === v)); })));
  const cp = el('div', { class: 'grp seg', role: 'group', 'aria-label': 'Classpath' }, el('span', { text: 'classpath' }), btn('Lettuce (Redis client)', () => redis, () => { redis = !redis; }));
  const line = el('div', { class: 'codebox', style: { margin: '6px 0 10px' } });
  const host = el('div', { class: 'tscroll' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-cnd');
  root.append(el('div', { class: 'w-controls' }, pg), el('div', { class: 'w-controls' }, propSeg), el('div', { class: 'w-controls' }, cp), line, host, stats);
  function render() {
    const act = Object.keys(P).filter((p) => P[p]);
    line.innerHTML = ''; line.append(el('pre', { html: IA.highlight(`# application.yml (or SPRING_PROFILES_ACTIVE)\nspring.profiles.active: ${act.length ? act.join(',') : '   # none, so "default" is active'}\n${prop === 'unset' ? '# feature.audit.enabled not set' : 'feature.audit.enabled: ' + prop}`, 'yaml') }));
    const tb = el('tbody'); let n = 0;
    ROWS.forEach((r, i) => {
      const [ok, why] = r.f(); const key = String(ok);
      const tr = el('tr', { class: last[i] != null && last[i] !== key ? 'flip' : '' },
        el('td', { class: ok === 'w' ? 'w' : ok ? 'y' : 'n', text: ok === 'w' ? '⚠' : ok ? '✓' : '✗' }), el('td', { html: `<code>${r.c}</code>` }), el('td', { html: `<b>${r.b}</b>` }), el('td', { class: 'why', html: why }));
      last[i] = key; if (ok === true) n++; tb.append(tr);
    });
    host.innerHTML = ''; host.append(el('table', { class: 't' }, el('thead', null, el('tr', null, ['', 'condition', 'definition', 'why'].map((h) => el('th', { text: h })))), tb));
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `registered <b>${n}</b> / ${ROWS.length}` }), el('span', { class: 'w-stat', html: 'evaluated when the definition is <b>registered</b>, before any bean is created' }));
  }
  render();
});
