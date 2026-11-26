/* Frontend security: an XSS payload and CSP, a CORS preflight, and CSRF with SameSite cookies. */
IA.widget('fe-security', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  // Scene format: nodes [id, x, y, w, h, label, sub?]; edges [id, from, to, label?]; steps { hot, ok, err, dim, txt: {id: label}, cap }
  const SCENES = {
  'XSS & CSP': {
    h: 270, intro: 'An attacker posts a comment containing HTML. Press Play to watch it run, then get stopped.',
    nodes: [['att', 20, 20, 200, 56, 'Attacker comment', '<img src=x onerror=steal()>'], ['api', 280, 20, 180, 56, 'API stores it', 'as plain text'],
      ['dom', 520, 20, 220, 56, 'el.innerHTML = c.text', 'parsed as HTML!'], ['run', 520, 120, 220, 56, 'onerror runs', 'reads localStorage token'],
      ['csp', 280, 120, 180, 56, 'CSP header', "script-src 'nonce-…'"], ['safe', 20, 200, 440, 50, 'Defence in depth', '']],
    edges: [['e1', 'att', 'api'], ['e2', 'api', 'dom'], ['e3', 'dom', 'run'], ['e4', 'csp', 'run', 'blocks']],
    steps: [
      { hot: ['att', 'api', 'e1'], cap: 'Storing the string is fine. XSS happens when it is <b>rendered as code</b>.' },
      { err: ['dom', 'e2'], cap: 'The UI writes it with <code>innerHTML</code> (or React <code>dangerouslySetInnerHTML</code>, Vue <code>v-html</code>). The browser creates a real <code>&lt;img&gt;</code> element with an event handler.' },
      { err: ['run', 'e3'], cap: 'The image fails to load, <code>onerror</code> runs <b>in your origin</b>: it can read non-HttpOnly cookies and localStorage and call your APIs as the user.' },
      { ok: ['csp', 'e4'], cap: 'A strict <b>Content Security Policy</b> without <code>\'unsafe-inline\'</code> blocks inline handlers and scripts without the right nonce. CSP is the safety net, not the fix.' },
      { ok: ['safe'], txt: { safe: 'Escape by default (textContent, {}, {{ }}), sanitise rich HTML (DOMPurify)' }, sub: { safe: '+ strict CSP + Trusted Types + HttpOnly cookies' }, cap: 'The fix is output encoding: frameworks escape <code>{value}</code> automatically. Only sanitise when you truly must render HTML.' }
    ]
  },
  'CORS preflight': {
    h: 260, intro: 'app.example.com calls api.example.com with JSON and a cookie. Press Play.',
    nodes: [['js', 20, 30, 190, 56, 'fetch() on app.example.com', "credentials: 'include'"], ['br', 280, 30, 180, 56, 'Browser', 'enforces CORS'],
      ['api', 560, 30, 180, 56, 'api.example.com', 'Spring Boot'], ['pre', 280, 150, 460, 56, 'OPTIONS preflight', 'Origin, Access-Control-Request-Method: PUT']],
    edges: [['e1', 'js', 'br'], ['e2', 'br', 'pre'], ['e3', 'pre', 'api'], ['e4', 'br', 'api', 'real PUT'], ['e5', 'api', 'br', 'response']],
    steps: [
      { hot: ['js', 'br', 'e1'], cap: 'Different origin (scheme + host + port). A <code>PUT</code> with <code>Content-Type: application/json</code> is not a “simple” request.' },
      { hot: ['pre', 'api', 'e2', 'e3'], cap: 'So the browser first sends an <code>OPTIONS</code> preflight asking: may this origin send PUT with these headers?' },
      { ok: ['api'], txt: { pre: 'Allow-Origin: https://app.example.com' }, sub: { pre: 'Allow-Methods: PUT · Allow-Credentials: true · Max-Age: 600' }, cap: 'The server answers with <code>Access-Control-Allow-*</code> headers. With credentials, <code>Allow-Origin</code> must be the exact origin, never <code>*</code>.' },
      { ok: ['br', 'api', 'e4', 'e5'], cap: 'Only then does the real request go out. If headers were missing, the browser would <b>hide the response</b> from JS. Note: for simple requests the server still processed it. CORS protects the user’s browser, not your server.' }
    ]
  },
  'CSRF & SameSite': {
    h: 260, intro: 'The user is logged in to bank.example (session cookie). They visit evil.example. Press Play.',
    nodes: [['evil', 20, 30, 200, 56, 'evil.example', 'auto-submitting <form>'], ['br', 290, 30, 180, 56, 'Browser', 'attaches cookies?'],
      ['bank', 560, 30, 180, 56, 'bank.example', 'POST /transfer'], ['ck', 290, 150, 450, 70, 'Cookie: SESSION=…', '']],
    edges: [['e1', 'evil', 'br', 'POST'], ['e2', 'br', 'bank'], ['e3', 'ck', 'br']],
    steps: [
      { hot: ['evil', 'br', 'e1'], cap: 'A hidden form on the attacker’s site POSTs to the bank. The attacker can’t read the response, but it doesn’t need to.' },
      { err: ['ck', 'bank', 'e2', 'e3'], txt: { ck: 'SameSite=None: cookie sent' }, sub: { ck: 'the bank sees a valid session and moves money' }, cap: 'Classic <b>CSRF</b>: the browser attaches the bank’s cookie to any request to the bank, whoever started it.' },
      { ok: ['ck'], dim: ['e2'], txt: { ck: 'SameSite=Lax: not sent on cross-site POST' }, sub: { ck: 'sent only on top-level GET navigations from other sites' }, cap: '<code>SameSite=Lax</code> (Chrome’s default when unset) or <code>Strict</code> stops this. Not all browsers default to Lax, so set it explicitly.' },
      { ok: ['bank'], txt: { ck: 'plus a CSRF token or Origin check' }, sub: { ck: 'Spring Security CSRF protection; same-site ≠ same-origin' }, cap: 'Keep a CSRF token (or verify <code>Origin</code> / <code>Sec-Fetch-Site</code>) as well: SameSite doesn’t protect against attacks from sibling subdomains on the same site.' }
    ]
  }
};
  const W = 760; let mode = Object.keys(SCENES)[0]; let k = 0; let running = false; let gen = 0;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  Object.keys(SCENES).forEach((m) => { const b = el('button', { text: m, class: m === mode ? 'on' : '' });
    b.addEventListener('click', () => { mode = m; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { role: 'img', 'aria-label': 'Boxes for attacker, browser and server with arrows showing requests and where they are blocked' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: '' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, seg), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  const S = () => SCENES[mode];
  const has = (arr, id) => (arr || []).indexOf(id) >= 0;
  function anchor(n, tx, ty) {
    const cx = n[1] + n[3] / 2, cy = n[2] + n[4] / 2; const dx = tx - cx, dy = ty - cy;
    const s = Math.min(dx ? (n[3] / 2 + 4) / Math.abs(dx) : 1e9, dy ? (n[4] / 2 + 4) / Math.abs(dy) : 1e9);
    return [cx + dx * s, cy + dy * s];
  }
  function draw() {
    const sc = S(); const st = k ? sc.steps[k - 1] : (sc.start || {}); const H = sc.h || 300;
    stage.setAttribute('viewBox', `0 0 ${W} ${H}`); stage.innerHTML = '';
    const defs = svg('defs'); ['m-n', 'm-h'].forEach((id, i) => defs.append(svg('marker', { id: id + '-fe-security', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M0 0L10 5L0 10z', style: `fill:${i ? 'var(--accent)' : 'var(--text-3)'}` })))); stage.append(defs);
    const byId = {}; sc.nodes.forEach((n) => { byId[n[0]] = n; });
    (sc.edges || []).forEach((e) => {
      const a = byId[e[1]], b = byId[e[2]]; if (!a || !b) return;
      const hot = has(st.hot, e[0]), err = has(st.err, e[0]), ok = has(st.ok, e[0]), dim = has(st.dim, e[0]) || (sc.hideEdges && !hot && !err && !ok);
      const [x1, y1] = anchor(a, b[1] + b[3] / 2, b[2] + b[4] / 2); const [x2, y2] = anchor(b, a[1] + a[3] / 2, a[2] + a[4] / 2);
      const col = err ? 'var(--err)' : ok ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)';
      const ln = svg('line', { x1, y1, x2, y2, 'marker-end': `url(#${hot || ok || err ? 'm-h' : 'm-n'}-fe-security)`, style: `stroke:${col};stroke-width:${hot || ok || err ? 2.4 : 1.4};opacity:${dim ? 0.15 : 1}` });
      if ((hot || ok || err) && !reduced) { ln.style.strokeDasharray = '6 5'; ln.animate && ln.animate([{ strokeDashoffset: 22 }, { strokeDashoffset: 0 }], { duration: 700, iterations: Infinity }); }
      stage.append(ln);
      const lab = (st.etxt || {})[e[0]] != null ? st.etxt[e[0]] : e[3];
      if (lab && !dim) stage.append(svg('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 5, 'text-anchor': 'middle', 'font-size': 11, style: `fill:${hot || ok || err ? col : 'var(--text-3)'}`, text: lab }));
    });
    sc.nodes.forEach((n) => {
      const id = n[0]; const hot = has(st.hot, id), ok = has(st.ok, id), err = has(st.err, id), dim = has(st.dim, id);
      const col = err ? 'var(--err)' : ok ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)';
      const g = svg('g', { style: `opacity:${dim ? 0.3 : 1};transition:opacity .4s` });
      g.append(svg('rect', { x: n[1], y: n[2], width: n[3], height: n[4], rx: 8, style: `fill:${hot || ok || err ? 'var(--accent-soft)' : 'var(--surface-2)'};stroke:${col};stroke-width:${hot || ok || err ? 2.2 : 1.2};transition:all .4s` }));
      const label = (st.txt || {})[id] != null ? st.txt[id] : n[5]; const sub = (st.sub || {})[id] != null ? st.sub[id] : n[6];
      const cx = n[1] + n[3] / 2; const lines = String(label).split('\n');
      const base = n[2] + n[4] / 2 - (lines.length - 1) * 7 - (sub ? 6 : 0) + 5;
      lines.forEach((t, i) => g.append(svg('text', { x: cx, y: base + i * 14, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, style: `fill:${err ? 'var(--err)' : 'var(--text)'}`, text: t })));
      if (sub) g.append(svg('text', { x: cx, y: base + (lines.length - 1) * 14 + 15, 'text-anchor': 'middle', 'font-size': 10.5, style: 'fill:var(--text-3)', text: sub }));
      stage.append(g);
    });
    narr.firstChild.textContent = String(k); narr.lastChild.innerHTML = st.cap || sc.intro || 'Press Play or Step.';
    narr.className = 'caption' + (st.err && st.err.length ? ' err' : st.ok && st.ok.length ? ' ok' : '');
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `step <b>${k}</b>/${sc.steps.length}` }));
    (st.stats || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
    bStep.disabled = k >= sc.steps.length;
  }
  function step() { if (k >= S().steps.length) return false; k++; draw(); return true; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; draw(); }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= S().steps.length) reset();
    if (reduced) { k = S().steps.length; draw(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
