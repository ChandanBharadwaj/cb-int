/* Node security: step through a recursive merge of an attacker's JSON and see which key path reaches
   Object.prototype, and which defence (key blocklist, null-prototype target, strict schema) stops it. */
IA.widget('security', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-sec-style')) {
    document.head.append(el('style', { id: 'w-sec-style', text: `
.w-sec-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; margin-top: 10px; }
.w-sec-b { border: 1.5px solid var(--border); border-radius: 10px; padding: 7px 9px; background: var(--surface); min-width: 0; transition: border-color .3s, background .3s; }
.w-sec-b .h { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: .04em; }
.w-sec-b .n { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
.w-sec-b .ln { font-family: var(--mono); font-size: 12px; color: var(--text-2); overflow-wrap: anywhere; padding: 1px 0; }
.w-sec-b .ln.new { animation: capin .35s ease both; color: var(--text); }
.w-sec-b .ln.bad { color: var(--err); font-weight: 700; }
.w-sec-b .ln.ok { color: var(--ok); }
.w-sec-b.cur { border-color: var(--warn); background: color-mix(in srgb, var(--warn) 12%, var(--surface)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--warn) 25%, transparent); }
.w-sec-b.hit { border-color: var(--err); background: color-mix(in srgb, var(--err) 10%, var(--surface)); }
.w-sec-path { font-family: var(--mono); font-size: 12.5px; margin-top: 8px; color: var(--text-2); overflow-wrap: anywhere; }
.w-sec-path b { color: var(--warn); }
.w-sec-v { display: inline-block; font-weight: 700; border-radius: 999px; padding: 4px 12px; margin-top: 10px; border: 1px solid var(--border); }
.w-sec-v.ok { color: var(--ok); border-color: var(--ok); } .w-sec-v.bad { color: var(--err); border-color: var(--err); }
` }));
  }
  const PAY = {
    proto: { label: '"__proto__"', json: '{"name":"eve","__proto__":{"isAdmin":true}}', path: ['__proto__', 'isAdmin'], extra: 'name' },
    ctor: { label: '"constructor.prototype"', json: '{"name":"eve","constructor":{"prototype":{"isAdmin":true}}}', path: ['constructor', 'prototype', 'isAdmin'], extra: 'name' },
    nested: { label: 'nested "__proto__"', json: '{"prefs":{"__proto__":{"isAdmin":true}}}', path: ['prefs', '__proto__', 'isAdmin'] }
  };
  const DEF = {
    none: { label: 'no defence', code: `for (const key in src) {\n  if (typeof src[key] === 'object') {\n    if (!target[key]) target[key] = {};\n    merge(target[key], src[key]);\n  } else target[key] = src[key];\n}` },
    one: { label: 'block "__proto__" only', code: `for (const key in src) {\n  if (key === '__proto__') continue;\n  …same recursive merge…\n}` },
    three: { label: 'block 3 keys', code: `const BAD = new Set(['__proto__', 'constructor', 'prototype']);\nfor (const key of Object.keys(src)) {\n  if (BAD.has(key)) continue;\n  …same recursive merge…\n}` },
    nullp: { label: 'target = Object.create(null)', code: `const target = Object.create(null);   // no prototype at the top level\nmerge(target, body);                  // nested objects are still {}` },
    schema: { label: 'strict schema', code: `const Body = z.object({ name: z.string() }).strict();\nconst data = Body.parse(JSON.parse(raw));   // throws on unknown keys` }
  };
  let pay = 'proto'; let def = 'none'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const e = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...e.children].forEach((x) => x.classList.toggle('on', x === b)); }); e.append(b); }); return e; };
  const segP = seg(Object.entries(PAY).map(([key, v]) => [key, v.label]), () => pay, (v) => { pay = v; reset(); }, 'Payload');
  const segD = seg(Object.entries(DEF).map(([key, v]) => [key, v.label]), () => def, (v) => { def = v; reset(); }, 'Defence');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const codeHost = el('div'); const grid = el('div', { class: 'w-sec-grid' }); const pathEl = el('div', { class: 'w-sec-path' }); const verdict = el('div');
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'payload' }), segP), el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'defence' }), segD),
    codeHost, grid, pathEl, verdict, el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const BOX = { payload: ['request body', 'JSON.parse(raw)'], target: ['merge target', 'settings'], obj: ['built-in', 'Object (function)'], proto: ['shared by all objects', 'Object.prototype'], user: ['later, another request', 'const user = {}'] };
  // build the step list by simulating the merge along the payload's key path
  function plan() {
    const P = PAY[pay]; const st = [];
    const base = { payload: [P.json], target: [def === 'nullp' ? '[[Prototype]]: null' : '[[Prototype]]: Object.prototype'], obj: ['.prototype → Object.prototype'], proto: ['toString()', 'hasOwnProperty()', '…'], user: ['user.isAdmin → ?'] };
    st.push({ cur: 'payload', add: {}, path: 'JSON.parse', x: `<code>JSON.parse</code> turns <code>${ctx.esc(P.json)}</code> into an object. Keys like <code>"${P.path[0]}"</code> become ordinary <b>own</b> properties: nothing is polluted yet.` });
    if (def === 'schema') {
      const bad = P.path[0] === 'prefs' ? 'prefs' : P.path[0];
      st.push({ cur: 'payload', add: {}, path: 'Body.parse → ZodError', end: 'ok', x: `The strict schema allows only <code>name</code>. It rejects the unknown key <code>"${bad}"</code> and the endpoint answers <b>400</b>. The merge never runs. Allow-listing the shape blocks every key path at once.` });
      st.push(finalStep(false)); return { st, base };
    }
    if (P.extra) st.push({ cur: 'target', add: { target: [{ t: 'name: "eve"' }] }, path: 'target.name', x: '<code>name</code> is a string, so it is copied: <code>target.name = "eve"</code>.' });
    // cursor kinds: 'target' (plain or null-proto), 'own' (an object the merge created with {}), 'obj', 'proto'
    let cur = 'target'; let trail = 'target'; let polluted = false;
    for (let i = 0; i < P.path.length; i++) {
      const key = P.path[i]; const last = i === P.path.length - 1;
      const blocked = (def === 'one' && key === '__proto__') || (def === 'three' && ['__proto__', 'constructor', 'prototype'].includes(key));
      if (blocked) { st.push({ cur: cur === 'own' ? 'target' : cur, add: {}, path: trail + ` · skip "${key}"`, end: 'ok', x: `The guard sees <code>"${key}"</code> and skips it. The dangerous sub-tree is never merged.` }); st.push(finalStep(false)); return { st, base }; }
      if (last) {
        if (cur === 'proto') { polluted = true; st.push({ cur: 'proto', hit: true, add: { proto: [{ t: 'isAdmin: true', c: 'bad' }] }, path: trail + '.isAdmin = true', x: '<code>isAdmin</code> is not an object, so it is assigned… onto <b>Object.prototype</b>. Every object in this process now inherits it.' }); }
        else st.push({ cur: cur === 'own' ? 'target' : cur, add: { target: [{ t: `${trail.replace(/^target\.?/, '') || '(own)'}.isAdmin: true`, c: 'ok' }] }, path: trail + '.isAdmin = true', x: 'The value lands on an object the merge created itself: an ordinary own property. Harmless.' });
        break;
      }
      const nullTop = def === 'nullp' && cur === 'target';
      if (key === '__proto__' && !nullTop && (cur === 'target' || cur === 'own')) {
        st.push({ cur: 'proto', add: {}, path: (trail += '["__proto__"]') + ' → Object.prototype', x: `<code>${cur === 'own' ? 'target.prefs' : 'target'}["__proto__"]</code> calls the inherited <code>__proto__</code> <b>getter</b> and returns <code>Object.prototype</code>. It is truthy, so <code>if (!target[key])</code> doesn’t create a new object, and the merge recurses <b>into the shared prototype</b>.` + (pay === 'nested' && def === 'nullp' ? ' The null-prototype target didn’t help: <code>target.prefs</code> was created with <code>{}</code>.' : '') });
        cur = 'proto';
      } else if (key === 'constructor' && !nullTop && (cur === 'target' || cur === 'own')) {
        st.push({ cur: 'obj', add: {}, path: (trail += '.constructor') + ' → Object', x: '<code>target.constructor</code> is the inherited <code>Object</code> function. It’s truthy, so the merge recurses into it. A <code>"__proto__"</code>-only blocklist doesn’t see this path.' });
        cur = 'obj';
      } else if (key === 'prototype' && cur === 'obj') {
        st.push({ cur: 'proto', add: {}, path: (trail += '.prototype') + ' → Object.prototype', x: '<code>Object.prototype</code>: the same shared object, reached through the constructor.' });
        cur = 'proto';
      } else {
        const label = key === '__proto__' ? '__proto__: { } (own key)' : `${key}: { }`;
        st.push({ cur: 'target', add: { target: [{ t: label, c: key === '__proto__' || key === 'constructor' ? 'ok' : '' }] }, path: (trail += '.' + key), x: nullTop ? `The target has <b>no prototype</b>, so there is no inherited <code>${key}</code> to find. <code>target["${key}"]</code> is undefined and the merge creates an ordinary own property.` : `<code>target.${key}</code> doesn’t exist, so the merge creates <code>{}</code> and recurses into it. Note: that new <code>{}</code> has the normal prototype.` });
        cur = 'own';
      }
    }
    st.push(finalStep(polluted));
    return { st, base };
  }
  function finalStep(p) {
    return { cur: 'user', hit: p, add: { user: [{ t: p ? 'user.isAdmin === true  (inherited!)' : 'user.isAdmin === undefined', c: p ? 'bad' : 'ok' }] }, path: p ? 'user → [[Prototype]] → Object.prototype.isAdmin' : 'user.isAdmin → not found', end: p ? 'bad' : 'ok',
      x: p ? 'Minutes later a different request creates <code>const user = {}</code>. <code>if (user.isAdmin)</code> walks the prototype chain and finds <b>true</b>. It stays that way until the process restarts.' : 'A later <code>const user = {}</code> has no <code>isAdmin</code>: <code>Object.prototype</code> is untouched.' };
  }
  let base = {};
  function render() {
    grid.innerHTML = ''; const s = steps[k - 1];
    const added = {}; steps.slice(0, k).forEach((x, i) => Object.entries(x.add).forEach(([b, ls]) => { (added[b] = added[b] || []).push(...ls.map((l) => ({ ...l, fresh: i === k - 1 }))); }));
    const hitProto = steps.slice(0, k).some((x) => x.cur === 'proto' && x.hit);
    Object.entries(BOX).forEach(([id, [h, n]]) => {
      const cls = 'w-sec-b' + (s && s.cur === id ? ' cur' : '') + ((id === 'proto' && hitProto) || (id === 'user' && s && s.end === 'bad' && s.cur === 'user') ? ' hit' : '');
      grid.append(el('div', { class: cls }, el('div', { class: 'h', text: h }), el('div', { class: 'n', text: n }),
        (base[id] || []).map((t) => el('div', { class: 'ln', text: t })), (added[id] || []).map((l) => el('div', { class: 'ln' + (l.c ? ' ' + l.c : '') + (l.fresh && !reduced ? ' new' : ''), text: l.t }))));
    });
    pathEl.innerHTML = s ? `path: <b>${ctx.esc(s.path)}</b>` : 'path: –';
    verdict.innerHTML = '';
    const endS = steps.slice(0, k).find((x) => x.end);
    if (endS && k === steps.length) verdict.append(el('span', { class: 'w-sec-v ' + endS.end, text: endS.end === 'bad' ? '✗ Object.prototype polluted' : '✓ prototype untouched' }));
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    const p = plan(); steps = p.st; base = p.base; bStep.disabled = false;
    codeHost.innerHTML = ''; codeHost.append(ctx.codeBox(`// body: ${PAY[pay].json}\n` + DEF[def].code, 'js'));
    render(); say('Pick a payload and a defence, then press Play. The merge walks the payload’s keys one level at a time.');
  }
  function step() { if (k >= steps.length) return false; k++; render(); say(steps[k - 1].x); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { while (step()); return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
