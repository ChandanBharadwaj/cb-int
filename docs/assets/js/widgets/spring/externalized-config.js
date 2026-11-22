/* Externalized config: resolve one property by scanning property sources from highest to lowest precedence, then bind and validate it. */
IA.widget('externalized-config', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-ext-style')) {
    document.head.append(el('style', { id: 'w-ext-style', text: `
.w-ext-stack { display: grid; gap: 5px; }
.w-ext-row { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 8px; align-items: center; border: 1px solid var(--border); border-radius: 9px; padding: 6px 10px; background: var(--surface); cursor: pointer; text-align: left; font: inherit; color: inherit; transition: background .3s, border-color .3s, opacity .3s; }
.w-ext-row:hover { border-color: var(--accent); }
.w-ext-row .p { font-family: var(--mono); font-size: 11px; color: var(--text-3); }
.w-ext-row .nm { font-size: 13px; min-width: 0; }
.w-ext-row .nm code { font-size: 12px; overflow-wrap: anywhere; }
.w-ext-row .st { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-3); white-space: nowrap; }
.w-ext-row.off { opacity: .5; }
.w-ext-row.off .nm code { text-decoration: line-through; }
.w-ext-row.scan { border-color: var(--warn); background: color-mix(in srgb, var(--warn) 12%, var(--surface)); }
.w-ext-row.win { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 13%, var(--surface)); }
.w-ext-row.win .st { color: var(--ok); border-color: var(--ok); }
.w-ext-row.shadow { opacity: .55; }
.w-ext-row.shadow .st { color: var(--text-3); }
.w-ext-out { font-family: var(--mono); font-size: 12px; line-height: 1.55; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-2); margin-top: 10px; min-height: 40px; }
.w-ext-out.err { color: var(--err); border-color: var(--err); }
.w-ext-out.ok { color: var(--text); border-color: var(--ok); }
` }));
  }
  const S = [
    { id: 'cmd', n: 'Command-line arguments', v: '1', show: '--app.pricing.max-retries=1', on: false, origin: '"app.pricing.max-retries" from property source "commandLineArgs"' },
    { id: 'json', n: 'SPRING_APPLICATION_JSON', v: '8', show: '{"app":{"pricing":{"max-retries":8}}}', on: false, origin: '"app.pricing.max-retries" from property source "spring.application.json"' },
    { id: 'sys', n: 'Java system properties', v: '2', show: '-Dapp.pricing.max-retries=2', on: false, origin: 'System property "app.pricing.max-retries"' },
    { id: 'env', n: 'OS environment variables', v: null, show: null, on: true, origin: 'System Environment Property "APP_PRICING_MAXRETRIES"' },
    { id: 'extp', n: 'Profile file outside the jar', v: '6', show: './config/application-prod.yml → 6', on: false, prof: true, origin: 'URL [file:./config/application-prod.yml] - 4:18' },
    { id: 'ext', n: 'File outside the jar', v: '7', show: './config/application.yml → 7', on: false, origin: 'URL [file:./config/application.yml] - 4:18' },
    { id: 'jarp', n: 'Profile file in the jar', v: '5', show: 'classpath:application-prod.yml → 5', on: true, prof: true, origin: 'class path resource [application-prod.yml] - 3:18' },
    { id: 'jar', n: 'File in the jar', v: '3', show: 'classpath:application.yml → 3', on: true, origin: 'class path resource [application.yml] - 5:18' }
  ];
  let prod = true; let envV = '20'; let k = 0; let gen = 0; let running = false; let speed = 1700; let plan = []; let result = null;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segP = seg([[true, 'profile prod active'], [false, 'no profile']], prod, (v) => { prod = v; reset(); }, 'Active profile');
  const segE = seg([['4', 'APP_PRICING_MAXRETRIES=4'], ['20', 'APP_PRICING_MAXRETRIES=20']], envV, (v) => { envV = v; reset(); }, 'Environment variable value');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stack = el('div', { class: 'w-ext-stack', role: 'list' });
  const out = el('div', { class: 'w-ext-out', 'aria-live': 'polite' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const codeHost = el('div', { style: { marginTop: '10px' } });
  root.append(el('div', { class: 'w-controls' }, segP, segE),
    el('div', { class: 'tiny', text: '↑ highest precedence (click a row to add or remove that source)', style: { marginBottom: '4px' } }), stack,
    el('div', { class: 'tiny', text: '↓ lowest precedence', style: { marginTop: '4px' } }),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr, out, codeHost);
  codeHost.append(ctx.codeBox(`@ConfigurationProperties("app.pricing")
@Validated
public record PricingProps(
    @Min(0) @Max(10) int maxRetries,           // app.pricing.max-retries
    @DefaultValue("2s") Duration timeout) {}`, 'java'));
  const active = (s) => s.on && (!s.prof || prod);
  const val = (s) => (s.id === 'env' ? envV : s.v);
  const shown = (s) => (s.id === 'env' ? `APP_PRICING_MAXRETRIES=${envV}` : s.show);
  function build() {
    plan = []; result = null;
    for (const s of S) { plan.push({ scan: s.id }); if (active(s)) { result = s; break; } }
    plan.push({ bind: true }); plan.push({ validate: true });
  }
  function render() {
    const cur = plan[k - 1];
    const scanned = plan.slice(0, k).filter((p) => p.scan).map((p) => p.scan);
    const decided = k > 0 && plan.slice(0, k).some((p) => p.scan && result && p.scan === result.id);
    stack.innerHTML = '';
    S.forEach((s, i) => {
      let cls = active(s) ? '' : 'off'; let st = !s.on ? 'not set' : s.prof && !prod ? 'profile inactive' : 'defines it';
      if (cur && cur.scan === s.id) { cls = result && result.id === s.id ? 'win' : 'scan'; st = result && result.id === s.id ? 'WINS' : 'not here →'; }
      else if (decided && result && result.id === s.id) { cls = 'win'; st = 'WINS'; }
      else if (decided && active(s) && !scanned.includes(s.id)) { cls = 'shadow'; st = 'shadowed'; }
      else if (scanned.includes(s.id) && !(result && result.id === s.id)) st = 'skipped';
      const b = el('button', { class: 'w-ext-row ' + cls, role: 'listitem', type: 'button', 'aria-pressed': String(s.on) },
        el('span', { class: 'p', text: String(i + 1) }), el('span', { class: 'nm', html: `${s.n}<br><code>${shown(s)}</code>` }), el('span', { class: 'st', text: st }));
      b.addEventListener('click', () => { s.on = !s.on; reset(); });
      stack.append(b);
    });
    out.className = 'w-ext-out'; out.textContent = '';
    if (cur && cur.bind) out.textContent = result ? `Binder: "${val(result)}" → int maxRetries = ${val(result)}\nOrigin: ${result.origin}` : 'No source defines it → maxRetries = 0 (int default)';
    if (cur && cur.validate) {
      const v = result ? Number(val(result)) : 0;
      if (v > 10) { out.className = 'w-ext-out err'; out.textContent = `APPLICATION FAILED TO START\n\nBinding to target com.shop.PricingProps failed:\n\n    Property: app.pricing.max-retries\n    Value: "${v}"\n    Origin: ${result.origin}\n    Reason: must be less than or equal to 10`; }
      else { out.className = 'w-ext-out ok'; out.textContent = `PricingProps[maxRetries=${v}, timeout=PT2S]   ✓ valid\n${result ? 'Origin: ' + result.origin : ''}`; }
    }
  }
  function msg() {
    const cur = plan[k - 1];
    if (!cur) return 'Which value does <code>app.pricing.max-retries</code> get? Click rows to change which sources define it, then press Play or Step. Boot checks sources from the top.';
    if (cur.scan) {
      const s = S.find((x) => x.id === cur.scan);
      if (result && result.id === s.id) return `<b>${s.n}</b> defines it: <code>${shown(s)}</code>. First match wins; nothing below is even consulted.${s.id === 'env' ? ' Relaxed binding maps <code>APP_PRICING_MAXRETRIES</code> to <code>app.pricing.max-retries</code>: dots become underscores, dashes are dropped, uppercase.' : ''}${s.prof ? ' Profile-specific files beat the plain file at the same location.' : ''}`;
      return `<b>${s.n}</b>: ${!s.on ? 'doesn’t define the key' : 'only applies when profile <code>prod</code> is active'}. Keep looking.`;
    }
    if (cur.bind) return 'The <code>Binder</code> converts the string to the field type (<code>int</code> here; <code>"2s"</code> → <code>Duration</code>, <code>"10MB"</code> → <code>DataSize</code>) and keeps the <b>origin</b>, which <code>/actuator/env</code> and error messages show.';
    const v = result ? Number(val(result)) : 0;
    return v > 10 ? '<code>@Validated</code> runs Bean Validation on the bound record. <code>@Max(10)</code> fails, so startup stops, naming the property, value and origin. Failing at startup beats a retry storm at 3 a.m.' : '<code>@Validated</code> runs Bean Validation on the bound record: the value passes, and the immutable record is a bean you can inject.';
  }
  function say(tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${plan.length}` }), el('div', { class: 't', html: msg() })); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; build(); render(); say(); bStep.disabled = false; }
  function step() {
    if (k >= plan.length) return false; k++; render();
    const cur = plan[k - 1]; let tone = '';
    if (cur.scan && result && cur.scan === result.id) tone = 'ok';
    if (cur.validate) tone = (result && Number(val(result)) > 10) ? 'err' : 'ok';
    say(tone); if (k >= plan.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= plan.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
