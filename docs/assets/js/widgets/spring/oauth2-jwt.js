/* OAuth2 & JWT: client credentials, JWKS lookup and claim validation, key rotation, expiry, wrong audience and token relay on one diagram. */
IA.widget('oauth2-jwt', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-oj-style')) {
    document.head.append(el('style', { id: 'w-oj-style', text: `
.w-oj svg text { font-family: var(--mono); }
.w-oj .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.6; transition: fill .3s, stroke .3s, opacity .3s; }
.w-oj .bx.hot { stroke: var(--accent); stroke-width: 2.6; fill: var(--accent-soft); }
.w-oj .bx.ok { stroke: var(--ok); stroke-width: 2.2; fill: color-mix(in srgb, var(--ok) 10%, var(--surface)); }
.w-oj .bx.bad { stroke: var(--err); stroke-width: 2.4; fill: color-mix(in srgb, var(--err) 11%, var(--surface)); }
.w-oj .bx.dim { opacity: .35; }
.w-oj .ln { stroke: var(--edge); stroke-width: 1.6; stroke-dasharray: 5 4; fill: none; }
.w-oj .card { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.2; }
.w-oj .tok { fill: var(--accent); stroke: var(--surface); stroke-width: 3; }
.w-oj .tok.bad { fill: var(--err); } .w-oj .tok.ok { fill: var(--ok); }
` }));
  }
  const N = { usr: [16, 14, 150, 50], cli: [16, 116, 150, 62], as: [292, 14, 196, 62], rs: [560, 96, 192, 62], dec: [560, 166, 192, 30], jw: [560, 202, 192, 30] };
  const c = (id) => { const [x, y, w, h] = N[id]; return [x + w / 2, y + h / 2]; };
  const ctr = { cli: c('cli'), as: c('as'), rs: c('rs'), dec: c('dec'), jw: c('jw'), usr: c('usr'), wire: [360, 140], asj: [480, 70] };
  const T = (o) => Object.assign({ alg: 'RS256', kid: 'k1', iss: 'https://idp/realms/shop', aud: 'inventory-api', sub: 'order-service', scope: 'inventory.read', exp: 'now + 5 min' }, o || {});
  const SC = {
    cc: { label: 'client credentials', cliName: ['order-service', 'OAuth2 client'], rsName: ['inventory-api', 'resource server'], intro: '<code>order-service</code> must call <code>inventory-api</code>. No user is involved, so it authenticates as itself with <b>client credentials</b>.',
      steps: [
        { at: 'cli', hi: { cli: 'hot' }, cache: [], say: 'The <code>OAuth2AuthorizedClientManager</code> has no cached token for registration <code>inventory</code> yet.' },
        { at: 'as', hi: { cli: 'ok', as: 'hot' }, cache: [], log: 'POST /token grant_type=client_credentials client_id=order-service scope=inventory.read', say: 'It POSTs to the token endpoint with its client id and secret (or a signed JWT assertion).' },
        { at: 'cli', hi: { as: 'ok', cli: 'hot' }, card: T(), cache: [], log: '200 {access_token: eyJ…, expires_in: 300}', say: 'The IdP returns a signed JWT. The manager <b>caches</b> it and reuses it until shortly before <code>exp</code>: one token call per ~5 minutes, not per request.' },
        { at: 'rs', hi: { cli: 'ok', rs: 'hot' }, card: T(), cache: [], log: 'GET /stock/42  Authorization: Bearer eyJ…', say: 'The call carries the token in the <code>Authorization</code> header. <code>BearerTokenAuthenticationFilter</code> picks it up.' },
        { at: 'jw', hi: { rs: 'hot', dec: 'hot', jw: 'bad' }, card: T(), cache: [], chk: { kid: '?' }, say: 'The <code>JwtDecoder</code> reads the header: <code>kid=k1</code>. The JWKS cache is empty (first request since start), so it must fetch the keys.' },
        { at: 'asj', hi: { as: 'hot', jw: 'hot' }, card: T(), cache: [], chk: { kid: '?' }, log: 'GET /protocol/openid-connect/certs (JWKS)', say: 'One HTTP call to the JWKS URI (found through OIDC discovery from <code>issuer-uri</code>). This happens on a cache miss, not on every request.' },
        { at: 'jw', hi: { jw: 'ok' }, card: T(), cache: ['k1'], chk: { kid: 'ok' }, say: 'Key set cached: <code>k1</code>. The public key for <code>kid=k1</code> is found.' },
        { at: 'dec', hi: { dec: 'hot', jw: 'ok' }, card: T(), cache: ['k1'], chk: { kid: 'ok', sig: 'ok', exp: 'ok', iss: 'ok', aud: 'ok' }, log: 'signature ✓ · exp ✓ (60 s skew) · iss ✓ · aud ✓ (configured)', logc: 'o', say: 'Signature verified with RS256. Then the validators: <code>exp</code>/<code>nbf</code> with 60 s skew, <code>iss</code> equals the issuer, and <code>aud</code> contains <code>inventory-api</code> because we configured an audience check.' },
        { at: 'rs', hi: { rs: 'ok', dec: 'ok', jw: 'ok' }, card: T(), cache: ['k1'], chk: { kid: 'ok', sig: 'ok', exp: 'ok', iss: 'ok', aud: 'ok' }, auth: 'SCOPE_inventory.read', tone: 'ok', log: '200 OK', logc: 'o', say: 'A <code>JwtAuthenticationToken</code> with authority <code>SCOPE_inventory.read</code> goes into the security context. The next request with the same <code>kid</code> needs no network call at all.' }] },
    rot: { label: 'key rotation', cliName: ['order-service', 'OAuth2 client'], rsName: ['inventory-api', 'resource server'], intro: 'The IdP has rotated keys: new tokens are signed with <code>k2</code>. The resource server cached <code>k1</code> an hour ago.',
      steps: [
        { at: 'rs', hi: { cli: 'ok', rs: 'hot' }, card: T({ kid: 'k2' }), cache: ['k1'], log: 'GET /stock/42  Bearer eyJ…(kid=k2)', say: 'A fresh token arrives, header <code>kid=k2</code>.' },
        { at: 'jw', hi: { dec: 'hot', jw: 'bad' }, card: T({ kid: 'k2' }), cache: ['k1'], chk: { kid: '?' }, tone: 'warn', say: 'Cache has only <code>k1</code>. An unknown <code>kid</code> is the signal that keys may have rotated…' },
        { at: 'asj', hi: { as: 'hot', jw: 'hot' }, card: T({ kid: 'k2' }), cache: ['k1'], chk: { kid: '?' }, log: 'unknown kid → refetch JWKS', say: '…so the decoder refetches the JWK set (rate-limited, so a flood of bad tokens can’t hammer the IdP).' },
        { at: 'dec', hi: { dec: 'ok', jw: 'ok' }, card: T({ kid: 'k2' }), cache: ['k1', 'k2'], chk: { kid: 'ok', sig: 'ok', exp: 'ok', iss: 'ok', aud: 'ok' }, tone: 'ok', log: 'JWKS now {k1, k2} · signature ✓', logc: 'o', say: 'The JWKS now lists both keys (the IdP keeps <code>k1</code> until old tokens expire). Verified. No restart needed.' },
        { at: 'rs', hi: { rs: 'bad' }, card: T({ kid: 'k2' }), cache: ['k1'], chk: { kid: 'bad' }, tone: 'err', log: 'if the JWKS still had only k1: 401 invalid_token (no matching key)', logc: 'e', say: 'It breaks only when the fetched JWKS doesn’t contain <code>k2</code> yet: the IdP signed before publishing, or a proxy served a stale copy. Then every <code>k2</code> token is a 401 until the next successful refresh.' }] },
    exp: { label: 'expired token', cliName: ['order-service', 'own token cache'], rsName: ['inventory-api', 'resource server'], intro: 'A hand-rolled client cached the token without looking at <code>expires_in</code>. Now it is 2 minutes past <code>exp</code>.',
      steps: [
        { at: 'rs', hi: { cli: 'hot', rs: 'hot' }, card: T({ exp: 'now − 2 min' }), cache: ['k1'], log: 'GET /stock/42  Bearer eyJ…', say: 'The request carries the old token.' },
        { at: 'dec', hi: { dec: 'hot', jw: 'ok' }, card: T({ exp: 'now − 2 min' }), cache: ['k1'], chk: { kid: 'ok', sig: 'ok' }, say: 'Key found, signature valid: the token is <b>genuine</b>…' },
        { at: 'dec', hi: { dec: 'bad' }, bad: true, card: T({ exp: 'now − 2 min' }), cache: ['k1'], chk: { kid: 'ok', sig: 'ok', exp: 'bad' }, tone: 'err', log: '401 WWW-Authenticate: Bearer error="invalid_token", error_description="Jwt expired at …"', logc: 'e', say: '…but <code>JwtTimestampValidator</code> rejects it: expired by more than the 60 s skew. 401 <code>invalid_token</code>. The JWT can’t be “refreshed” by the API; the client must get a new one.' },
        { at: 'cli', hi: { cli: 'ok' }, card: T(), cache: ['k1'], tone: 'ok', say: 'Spring’s authorized client manager avoids this: it requests a new token when the cached one is within the clock skew of expiry.' }] },
    aud: { label: 'wrong audience', cliName: ['reporting-ui', 'has a token'], rsName: ['payments-api', 'resource server'], intro: 'A token issued for <code>reporting-api</code> is sent to <code>payments-api</code>. Same IdP, same realm, same keys.',
      steps: [
        { at: 'rs', hi: { cli: 'hot', rs: 'hot' }, card: T({ aud: 'reporting-api', sub: 'reporting-ui', scope: 'reports.read' }), cache: ['k1'], log: 'POST /payments  Bearer eyJ… (aud=reporting-api)', say: 'The token is perfectly valid, just not for this API.' },
        { at: 'dec', hi: { dec: 'hot' }, card: T({ aud: 'reporting-api', sub: 'reporting-ui', scope: 'reports.read' }), cache: ['k1'], chk: { kid: 'ok', sig: 'ok', exp: 'ok', iss: 'ok', aud: 'skip' }, tone: 'warn', log: 'defaults: signature ✓ exp ✓ iss ✓ — aud not checked', say: 'With only <code>issuer-uri</code>, these are <b>all</b> the checks. Signature, time and issuer pass, so authentication succeeds. Only your authorization rules (scopes) stand between this token and the endpoint.' },
        { at: 'dec', hi: { dec: 'bad' }, bad: true, card: T({ aud: 'reporting-api', sub: 'reporting-ui', scope: 'reports.read' }), cache: ['k1'], chk: { kid: 'ok', sig: 'ok', exp: 'ok', iss: 'ok', aud: 'bad' }, tone: 'err', log: 'with audiences=payments-api: 401 invalid_token (aud)', logc: 'e', say: 'With <code>spring.security.oauth2.resourceserver.jwt.audiences: payments-api</code> (or a <code>JwtClaimValidator</code> on <code>aud</code>), the token is rejected at authentication: 401.' }] },
    relay: { label: 'token relay', cliName: ['gateway', 'TokenRelay filter'], rsName: ['orders-api', 'resource server'], user: true, intro: 'A browser talks to a gateway (backend-for-frontend). The browser only has an HttpOnly session cookie; tokens stay on the server.',
      steps: [
        { at: 'usr', hi: { usr: 'hot' }, cache: ['k1'], log: 'GET /orders  Cookie: SESSION=…', say: 'The user is logged in at the gateway via <code>oauth2Login</code> (authorization code + PKCE). The session holds the <code>OAuth2AuthorizedClient</code>.' },
        { at: 'cli', hi: { usr: 'ok', cli: 'hot' }, card: T({ sub: 'alice', aud: 'orders-api', scope: 'orders.read' }), cache: ['k1'], say: 'The <code>TokenRelay</code> filter (Spring Cloud Gateway) looks up alice’s <b>access token</b> (not the ID token), refreshing it if it is about to expire.' },
        { at: 'rs', hi: { cli: 'ok', rs: 'hot' }, card: T({ sub: 'alice', aud: 'orders-api', scope: 'orders.read' }), cache: ['k1'], log: 'GET /orders  Authorization: Bearer eyJ…(sub=alice)', say: 'The downstream request now carries <code>Authorization: Bearer …</code>. The session cookie is not forwarded.' },
        { at: 'dec', hi: { rs: 'ok', dec: 'ok', jw: 'ok' }, card: T({ sub: 'alice', aud: 'orders-api', scope: 'orders.read' }), cache: ['k1'], chk: { kid: 'ok', sig: 'ok', exp: 'ok', iss: 'ok', aud: 'ok' }, auth: 'sub=alice · SCOPE_orders.read', tone: 'ok', log: '200 OK (principal alice)', logc: 'o', say: '<code>orders-api</code> validates it like any other JWT and sees the <b>user</b>, alice. If it must call a further service with another audience, token exchange (Security 6.3+) beats relaying the same token deeper.' }] }
  };
  let sc = 'cc'; let k = 0; let gen = 0; let running = false; let speed = 2300; let st;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(SC).map((x) => [x, SC[x].label]), sc, (v) => { sc = v; reset(); }, 'Flow');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3400, 'Slow'], [2300, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 352', role: 'img', 'aria-label': 'Client, authorization server and resource server with JWKS cache; a decoded JWT card with validation checks' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-log', 'aria-label': 'Wire log' });
  root.classList.add('w-oj');
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, log);
  let tok;
  const box = (id, a, b, cls) => { const [x, y, w, h] = N[id];
    stage.append(svg('rect', { class: 'bx ' + (cls || ''), x, y, width: w, height: h, rx: 9 }), svg('text', { x: x + 10, y: y + (h > 40 ? 22 : 19), 'font-size': 12.5, 'font-weight': 700, fill: 'var(--text)', text: a }));
    if (b) stage.append(svg('text', { x: x + 10, y: y + 40, 'font-size': 11, fill: 'var(--text-3)', text: b })); };
  function render() {
    const S = SC[sc]; const hi = st.hi || {};
    stage.innerHTML = '';
    [['cli', 'as'], ['cli', 'rs'], ['as', 'jw']].forEach(([a, b]) => { const [x1, y1] = c(a); const [x2, y2] = c(b); stage.append(svg('path', { class: 'ln', d: `M${x1} ${y1} L${x2} ${y2}` })); });
    if (S.user) { const [x1, y1] = c('usr'); const [x2, y2] = c('cli'); stage.append(svg('path', { class: 'ln', d: `M${x1} ${y1} L${x2} ${y2}` })); }
    if (S.user) box('usr', 'Browser (alice)', '', hi.usr);
    box('cli', S.cliName[0], S.cliName[1], hi.cli);
    box('as', 'Authorization server', '/token · /certs (JWKS)', hi.as);
    stage.append(svg('rect', { x: 552, y: 88, width: 208, height: 152, rx: 12, fill: 'none', stroke: 'var(--border)', 'stroke-dasharray': '6 4' }));
    box('rs', S.rsName[0], S.rsName[1], hi.rs); box('dec', 'JwtDecoder + validators', '', hi.dec);
    box('jw', 'JWKS cache: ' + (st.cache && st.cache.length ? st.cache.join(', ') : '(empty)'), '', hi.jw);
    if (st.auth) stage.append(svg('text', { x: 560, y: 256, 'font-size': 11, fill: 'var(--ok)', 'font-weight': 700, text: '→ ' + st.auth }));
    // JWT card
    stage.append(svg('rect', { class: 'card', x: 8, y: 196, width: 536, height: 150, rx: 10 }), svg('text', { x: 20, y: 216, 'font-size': 11.5, 'font-weight': 700, fill: 'var(--text-3)', text: 'DECODED JWT' }));
    const t = st.card; const chk = st.chk || {};
    if (!t) stage.append(svg('text', { x: 20, y: 246, 'font-size': 12, fill: 'var(--text-3)', text: '(no token yet)' }));
    else {
      const mk = (v) => v === 'ok' ? ['✓', 'var(--ok)'] : v === 'bad' ? ['✗', 'var(--err)'] : v === 'skip' ? ['– not checked', 'var(--warn)'] : v === '?' ? ['?', 'var(--warn)'] : ['', 'var(--text-3)'];
      const rows = [['header', `{"alg":"${t.alg}","kid":"${t.kid}"}`, chk.kid, 'kid → key'], ['signature', 'RSASSA over header.payload', chk.sig, 'sig'], ['iss', t.iss, chk.iss, 'iss'], ['aud', t.aud, chk.aud, 'aud'], ['exp', t.exp, chk.exp, 'exp/nbf'], ['sub · scope', t.sub + ' · ' + t.scope, null, '']];
      rows.forEach(([kk, v, ck, nm], j) => { const y = 236 + j * 18; const [m, col] = mk(ck);
        stage.append(svg('text', { x: 20, y, 'font-size': 11.5, fill: 'var(--text-3)', text: kk }), svg('text', { x: 116, y, 'font-size': 11.5, fill: 'var(--text)', text: v }));
        if (m) stage.append(svg('text', { x: 534, y, 'font-size': 12, 'font-weight': 700, fill: col, 'text-anchor': 'end', text: m === '✓' || m === '✗' || m === '?' ? `${nm} ${m}` : m })); });
    }
    tok = svg('circle', { class: 'tok' + (st.bad ? ' bad' : st.tone === 'ok' ? ' ok' : ''), r: 9, cx: 0, cy: 0 });
    const [tx, ty] = st.tok;
    tok.style.transform = `translate(${st.prev ? st.prev[0] : tx}px, ${st.prev ? st.prev[1] : ty}px)`;
    if (!reduced) tok.style.transition = 'transform .7s ease';
    stage.append(tok);
    if (st.prev) requestAnimationFrame(() => requestAnimationFrame(() => { tok.style.transform = `translate(${tx}px, ${ty}px)`; }));
    log.innerHTML = ''; st.log.forEach(([tt, cl]) => log.append(el('div', { text: tt, style: { color: cl === 'e' ? 'var(--err)' : cl === 'o' ? 'var(--ok)' : '' } }))); log.scrollTop = log.scrollHeight;
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${SC[sc].steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; const S = SC[sc]; st = { hi: {}, log: [], tok: S.user ? ctr.usr : ctr.cli, cache: S.steps[0].cache }; render(); say(S.intro); bStep.disabled = false; }
  function step() {
    const steps = SC[sc].steps; if (k >= steps.length) return false; const s = steps[k++];
    const prev = st.tok; const logs = st.log;
    st = Object.assign({}, s, { tok: ctr[s.at], prev: reduced ? null : prev, log: logs });
    if (s.log) logs.push([s.log, s.logc]);
    render(); say(s.say, s.tone);
    if (k >= steps.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= SC[sc].steps.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});
