/* Auto-configuration: candidates from AutoConfiguration.imports evaluated in order against the classpath, your beans and properties; builds the condition evaluation report. */
IA.widget('auto-configuration', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-auto-style')) {
    document.head.append(el('style', { id: 'w-auto-style', text: `
.w-auto-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 12px; align-items: start; }
@media (max-width: 680px) { .w-auto-grid { grid-template-columns: 1fr; } }
.w-auto-c { border: 1px solid var(--border); border-radius: 10px; padding: 7px 10px; margin-bottom: 6px; background: var(--surface); transition: background .3s, border-color .3s, opacity .3s; min-width: 0; }
.w-auto-c.pend { opacity: .45; }
.w-auto-c.now { border-color: var(--accent); background: var(--accent-soft); opacity: 1; }
.w-auto-c.pos { border-color: color-mix(in srgb, var(--ok) 55%, var(--border)); }
.w-auto-c.neg { opacity: .6; border-style: dashed; }
.w-auto-c h5 { margin: 0 0 4px; font-family: var(--mono); font-size: 13px; display: flex; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
.w-auto-c h5 .tag { font-family: var(--sans); font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-3); }
.w-auto-c.pos h5 .tag { color: var(--ok); border-color: var(--ok); } .w-auto-c.neg h5 .tag { color: var(--text-3); }
.w-auto-cd { font-family: var(--mono); font-size: 11.5px; color: var(--text-2); padding: 1px 0; overflow-wrap: anywhere; }
.w-auto-cd .y { color: var(--ok); font-weight: 700; } .w-auto-cd .n { color: var(--err); font-weight: 700; } .w-auto-cd .q { color: var(--text-3); }
.w-auto-cd.bean { padding-left: 14px; }
.w-auto-reg { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--surface-2); font-family: var(--mono); font-size: 12px; min-width: 0; }
.w-auto-reg div { padding: 3px 6px; border-radius: 6px; margin: 3px 0; background: var(--surface); border: 1px solid var(--border); overflow-wrap: anywhere; }
.w-auto-reg div.u { border-color: var(--k-client); } .w-auto-reg div.a { border-color: var(--ok); }
.w-auto-reg div.fresh { animation: capin .35s ease both; outline: 2px solid var(--accent); }
.w-auto-reg small { color: var(--text-3); }
.w-auto-rep { font-family: var(--mono); font-size: 11.5px; line-height: 1.5; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; max-height: 210px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-2); margin-top: 10px; }
` }));
  }
  const E = { jdbc: true, redis: false, ds: 0, audit: true };
  const dsCount = () => E.ds || (E.jdbc ? 1 : 0);
  const C = [
    { n: 'DataSourceAutoConfiguration', cls: [() => [E.jdbc, '@ConditionalOnClass(DataSource, EmbeddedDatabaseType)', E.jdbc ? 'found required classes' : 'did not find required class \'org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseType\'']],
      beans: [{ b: 'dataSource (HikariDataSource)', c: () => [E.ds === 0, '@ConditionalOnMissingBean(DataSource)', E.ds === 0 ? 'did not find any beans' : `found beans of type DataSource: ${E.ds === 1 ? 'myDataSource' : 'primaryDs, reportingDs'}`] }] },
    { n: 'JdbcTemplateAutoConfiguration', after: 'DataSourceAutoConfiguration', cls: [() => [E.jdbc, '@ConditionalOnClass(DataSource, JdbcTemplate)', E.jdbc ? 'found required classes' : 'did not find required class \'org.springframework.jdbc.core.JdbcTemplate\''], () => [dsCount() === 1, '@ConditionalOnSingleCandidate(DataSource)', dsCount() === 1 ? 'found a single bean' : dsCount() === 0 ? 'did not find any beans' : 'found 2 candidates and none is @Primary']],
      beans: [{ b: 'jdbcTemplate', c: () => [true, '@ConditionalOnMissingBean(JdbcOperations)', 'did not find any beans'] }] },
    { n: 'DataSourceTransactionManagerAutoConfiguration', after: 'DataSourceAutoConfiguration', cls: [() => [E.jdbc, '@ConditionalOnClass(JdbcTemplate, TransactionManager)', E.jdbc ? 'found required classes' : 'did not find required class \'org.springframework.jdbc.core.JdbcTemplate\''], () => [dsCount() === 1, '@ConditionalOnSingleCandidate(DataSource)', dsCount() === 1 ? 'found a single bean' : dsCount() === 0 ? 'did not find any beans' : 'found 2 candidates and none is @Primary']],
      beans: [{ b: 'transactionManager', c: () => [true, '@ConditionalOnMissingBean(TransactionManager)', 'did not find any beans'] }] },
    { n: 'JacksonAutoConfiguration', cls: [() => [true, '@ConditionalOnClass(ObjectMapper)', 'found required class']],
      beans: [{ b: 'jacksonObjectMapper', c: () => [true, '@ConditionalOnMissingBean(ObjectMapper)', 'did not find any beans'] }] },
    { n: 'RedisAutoConfiguration', cls: [() => [E.redis, '@ConditionalOnClass(RedisOperations)', E.redis ? 'found required class' : 'did not find required class \'org.springframework.data.redis.core.RedisOperations\'']],
      beans: [{ b: 'redisTemplate', c: () => [true, '@ConditionalOnMissingBean(name = "redisTemplate")', 'did not find any beans'] }, { b: 'stringRedisTemplate', c: () => [true, '@ConditionalOnMissingBean', 'did not find any beans'] }] },
    { n: 'AcmeAuditAutoConfiguration (yours)', after: 'DataSourceAutoConfiguration', cls: [() => [E.audit, '@ConditionalOnProperty(acme.audit.enabled, matchIfMissing = true)', E.audit ? 'property not set: matchIfMissing' : 'found different value in property \'acme.audit.enabled\''], () => [dsCount() >= 1, '@ConditionalOnBean(DataSource)', dsCount() >= 1 ? 'found beans of type DataSource' : 'did not find any beans of type DataSource']],
      beans: [{ b: 'auditWriter', c: () => [true, '@ConditionalOnMissingBean(AuditWriter)', 'did not find any beans'] }] }
  ];
  let k = 0; let gen = 0; let running = false; let speed = 2200; let res = [];
  const tog = (label, get, set, opts) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: get() === v ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); s.append(b); }); return s; };
  const tJ = tog('JDBC starter', () => E.jdbc, (v) => { E.jdbc = v; }, [[true, '+ starter-jdbc'], [false, 'no JDBC']]);
  const tR = tog('Redis starter', () => E.redis, (v) => { E.redis = v; }, [[false, 'no Redis'], [true, '+ starter-data-redis']]);
  const tD = tog('Your DataSource beans', () => E.ds, (v) => { E.ds = v; }, [[0, 'no own DataSource'], [1, 'your @Bean DataSource'], [2, '2 DataSources, no @Primary']]);
  const tA = tog('acme.audit.enabled', () => E.audit, (v) => { E.audit = v; }, [[true, 'acme.audit.enabled unset'], [false, 'acme.audit.enabled=false']]);
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const list = el('div'); const reg = el('div', { class: 'w-auto-reg' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const rep = el('div', { class: 'w-auto-rep', 'aria-label': 'Condition evaluation report' });
  root.append(el('div', { class: 'w-controls' }, tJ, tR), el('div', { class: 'w-controls' }, tD, tA),
    el('div', { class: 'w-auto-grid' }, list, el('div', null, el('div', { class: 'tiny', text: 'bean definitions registered', style: { marginBottom: '4px' } }), reg)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr, rep);
  const total = () => C.length + 4;
  function evalAll() {
    return C.map((c) => {
      const cls = c.cls.map((f) => f()); const ok = cls.every((x) => x[0]);
      const beans = ok ? c.beans.map((b) => ({ b: b.b, r: b.c() })) : [];
      return { cls, ok, beans };
    });
  }
  function userBeans() { const u = ['orderService', 'orderController']; if (E.ds === 1) u.push('myDataSource'); if (E.ds === 2) u.push('primaryDs', 'reportingDs'); return u; }
  function render() {
    list.innerHTML = '';
    C.forEach((c, i) => {
      const idx = i + 3; const done = k > idx; const now = k === idx + 1; const r = res[i];
      const state = k <= 0 ? 'pend' : (!done && !now) ? 'pend' : r.ok ? 'pos' : 'neg';
      const card = el('div', { class: 'w-auto-c ' + state + (now ? ' now' : '') },
        el('h5', null, el('span', { text: c.n }), el('span', { class: 'tag', text: state === 'pend' ? (k >= 3 ? 'waiting' : 'candidate') : r.ok ? 'positive match' : 'negative match' })));
      if (c.after && k >= 3) card.append(el('div', { class: 'w-auto-cd q', text: `@AutoConfiguration(after = ${c.after})` }));
      c.cls.forEach((_, j) => { const x = r.cls[j]; const shown = done || now; card.append(el('div', { class: 'w-auto-cd', html: `<span class="${shown ? (x[0] ? 'y' : 'n') : 'q'}">${shown ? (x[0] ? '✓' : '✗') : '·'}</span> ${x[1]}` })); });
      c.beans.forEach((b, j) => { const x = r.beans[j]; const shown = (done || now) && x; card.append(el('div', { class: 'w-auto-cd bean', html: `<span class="${shown ? (x.r[0] ? 'y' : 'n') : 'q'}">${shown ? (x.r[0] ? '✓' : '✗') : '·'}</span> @Bean ${b.b} · ${b.c()[1]}` })); });
      list.append(card);
    });
    reg.innerHTML = '';
    if (k >= 2) userBeans().forEach((b) => reg.append(el('div', { class: 'u' + (k === 2 ? ' fresh' : ''), html: `${b} <small>· your config</small>` })));
    C.forEach((c, i) => { if (k > i + 3 || k === i + 4) res[i].beans.filter((x) => x.r[0]).forEach((x) => reg.append(el('div', { class: 'a' + (k === i + 4 ? ' fresh' : ''), html: `${x.b} <small>· ${c.n.replace(' (yours)', '')}</small>` }))); });
    if (!reg.children.length) reg.append(el('small', { text: '(nothing yet)' }));
    const pos = []; const neg = [];
    C.forEach((c, i) => {
      if (k < i + 4) return; const r = res[i];
      if (r.ok) { pos.push(`   ${c.n} matched:`); r.cls.forEach((x) => pos.push(`      - ${x[1].split('(')[0]} ${x[2]}`)); r.beans.forEach((x) => (x.r[0] ? pos : neg).push(x.r[0] ? `   ${c.n}#${x.b.split(' ')[0]} matched:\n      - ${x.r[1].split('(')[0]} ${x.r[2]}` : `   ${c.n}#${x.b.split(' ')[0]}:\n      Did not match:\n         - ${x.r[1].split('(')[0]} ${x.r[2]}`)); }
      else { neg.push(`   ${c.n}:\n      Did not match:`); r.cls.filter((x) => !x[0]).forEach((x) => neg.push(`         - ${x[1].split('(')[0]} ${x[2]}`)); }
    });
    rep.textContent = k < 4 ? '# start with --debug (or debug=true) to print this report\n# or GET /actuator/conditions' : `============================\nCONDITIONS EVALUATION REPORT\n============================\n\nPositive matches:\n-----------------\n${pos.join('\n') || '   (none)'}\n\nNegative matches:\n-----------------\n${neg.join('\n') || '   (none)'}`;
    rep.scrollTop = rep.scrollHeight;
  }
  function msgFor() {
    if (k === 1) return 'Boot reads every <code>META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports</code> on the classpath (one class name per line). Boot 2.7 introduced this file; <b>3.0 dropped</b> auto-configuration registration via <code>spring.factories</code>. A metadata pre-filter skips candidates whose classes are obviously missing, without loading them.';
    if (k === 2) return 'Auto-configuration is imported by a <code>DeferredImportSelector</code>, so <b>your</b> configuration and component scan were processed first. Your beans (blue) are already registered when the first condition is checked. That is how “back off” works.';
    if (k === 3) return 'Candidates are sorted: <code>@AutoConfiguration(after = …, before = …)</code>, then <code>@AutoConfigureOrder</code>, then name. Conditions are evaluated in that order, one class at a time.';
    if (k >= 4 && k <= C.length + 3) {
      const i = k - 4; const c = C[i]; const r = res[i];
      if (!r.ok) { const f = r.cls.find((x) => !x[0]); return `<b>${c.n}</b>: ${f[1]} fails (${f[2]}). The whole class is skipped, nothing inside it is even looked at. This line goes into the <b>negative matches</b>.`; }
      const nb = r.beans.filter((x) => !x.r[0]);
      if (nb.length) return `<b>${c.n}</b> matches, but its <code>@Bean</code> method backs off: ${nb[0].r[1]} ${nb[0].r[2]}. Your bean wins, and Boot doesn’t create its own.`;
      return `<b>${c.n}</b>: every condition passes, so its beans are registered (green). ${c.n.includes('yours') ? 'Your own auto-configuration follows the same rules, which is why it is ordered <code>after</code> DataSourceAutoConfiguration: <code>@ConditionalOnBean</code> only sees beans registered before it.' : ''}`;
    }
    const n = res.filter((r) => r.ok).length;
    return `Done: ${n} of ${C.length} auto-configurations matched. Toggle the classpath, your DataSource beans or the property, and replay. The report below is what <code>--debug</code> or <code>/actuator/conditions</code> shows.`;
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${total()}` }), el('div', { class: 't', html: h })); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; res = evalAll(); render(); say('Set up the classpath, your beans and a property, then press Play or Step. Conditions shown are simplified from the real Boot 3.x classes.'); bStep.disabled = false; }
  function step() {
    if (k >= total()) return false; k++; render();
    const i = k - 4; const tone = k === total() ? 'ok' : (i >= 0 && i < C.length && !res[i].ok) ? 'warn' : '';
    say(msgFor(), tone); if (k >= total()) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= total()) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
