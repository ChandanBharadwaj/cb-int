/* Azure OpenAI: token-window rate limiting with 429 and retry-after, input/output content filters and Prompt Shields, and RAG through Azure AI Search hybrid retrieval. */
IA.widget('azure-openai', (root, ctx) => {
  /* ---- shared Azure widget kit (identical in every azure widget file) ---- */
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-az-style')) {
    document.head.append(el('style', { id: 'w-az-style', text: `
.w-az .nb rect { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .4s, stroke .4s; }
.w-az .nb { transition: opacity .45s; }
.w-az .nb text { fill: var(--text); font-size: 13px; font-family: var(--sans); }
.w-az .nb text.s { fill: var(--text-3); font-size: 10.5px; font-family: var(--mono); }
.w-az .nb.hot rect { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-az .nb.ok rect { stroke: var(--ok); stroke-width: 2.5; fill: color-mix(in srgb, var(--ok) 15%, var(--surface)); }
.w-az .nb.warn rect { stroke: var(--warn); stroke-width: 2.5; fill: color-mix(in srgb, var(--warn) 16%, var(--surface)); }
.w-az .nb.bad rect { stroke: var(--err); stroke-width: 2.5; fill: color-mix(in srgb, var(--err) 15%, var(--surface)); }
.w-az .nb.bad text.s, .w-az .nb.warn text.s, .w-az .nb.ok text.s, .w-az .nb.hot text.s { fill: var(--text-2); }
.w-az .nb.dim { opacity: .32; }
.w-az .nb.gone { opacity: .1; }
.w-az .eg { stroke: var(--border); stroke-width: 1.6; fill: none; transition: stroke .4s, opacity .4s; }
.w-az .eg.hot { stroke: var(--accent); stroke-width: 2.6; }
.w-az .eg.ok { stroke: var(--ok); stroke-width: 2.6; }
.w-az .eg.warn { stroke: var(--warn); stroke-width: 2.6; }
.w-az .eg.bad { stroke: var(--err); stroke-width: 2.6; stroke-dasharray: 6 4; }
.w-az .eg.dim { opacity: .25; }
.w-az .zn { fill: color-mix(in srgb, var(--surface-2) 70%, transparent); stroke: var(--border); stroke-dasharray: 6 5; transition: stroke .4s, fill .4s; }
.w-az .zn.bad { stroke: var(--err); fill: color-mix(in srgb, var(--err) 9%, transparent); }
.w-az .zn.hot { stroke: var(--accent); }
.w-az .lbl { fill: var(--text-2); font-size: 12px; font-family: var(--sans); }
.w-az .lbl.m { font-family: var(--mono); font-size: 11px; fill: var(--text-3); }
.w-az .pkt { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.w-az .bar { transition: width .6s ease, x .6s ease; }
.w-az.rm * { transition: none !important; animation: none !important; }
` }));
  }
  root.classList.add('w-az'); if (reduced) root.classList.add('rm');
  const Z = {};
  const clearZ = () => { for (const k in Z) delete Z[k]; };
  const seg = (opts, cur, on, label) => {
    const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' });
      b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); });
    return s;
  };
  const node = (g, id, x, y, w, h, t, s) => {
    const n = svg('g', { class: 'nb' });
    n.append(svg('rect', { x, y, width: w, height: h, rx: 8 }));
    n.append(svg('text', { x: x + w / 2, y: s != null ? y + h / 2 - 3 : y + h / 2 + 4, 'text-anchor': 'middle', text: t }));
    let se = null;
    if (s != null) { se = svg('text', { class: 's', x: x + w / 2, y: y + h / 2 + 12, 'text-anchor': 'middle', text: s }); n.append(se); }
    g.append(n); Z[id] = { n, base: 'nb', sub: se, sub0: s || '', x, y, w, h }; return n;
  };
  const edge = (g, id, d) => { const p = svg('path', { class: 'eg', d }); g.append(p); Z[id] = { n: p, base: 'eg' }; return p; };
  const link = (g, id, a, b) => {
    const A = Z[a]; const B = Z[b];
    const x1 = A.x + A.w / 2; const y1 = A.y + A.h; const x2 = B.x + B.w / 2; const y2 = B.y; const my = (y1 + y2) / 2;
    return edge(g, id, `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`);
  };
  const hlink = (g, id, a, b) => {
    const A = Z[a]; const B = Z[b]; const y1 = A.y + A.h / 2; const y2 = B.y + B.h / 2;
    const [x1, x2] = A.x < B.x ? [A.x + A.w, B.x] : [A.x, B.x + B.w]; const mx = (x1 + x2) / 2;
    return edge(g, id, `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
  };
  const mid = (id) => { const z = Z[id]; return [z.x + z.w / 2, z.y + z.h / 2]; };
  function paint(s) {
    for (const id in Z) { const z = Z[id]; const c = s && s.c && s.c[id];
      z.n.setAttribute('class', z.base + (c ? ' ' + c : ''));
      if (z.sub) z.sub.textContent = s && s.sub && s.sub[id] != null ? s.sub[id] : z.sub0; }
  }
  const cum = () => { let acc = {}; let sub = {};
    return { set(c, sb) { Object.assign(acc, c || {}); Object.assign(sub, sb || {}); return { c: { ...acc }, sub: { ...sub } }; }, clear() { acc = {}; sub = {}; } }; };
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const say = (n, h, cls) => { narr.className = 'caption' + (cls ? ' ' + cls : ''); narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: String(n) }), el('div', { class: 't', html: h })); };
  let gen = 0;
  const pkt = svg('circle', { r: 7, class: 'pkt', opacity: 0 });
  function fly(ids, ms) {
    const g = gen; const pts = ids.map((p) => (typeof p === 'string' ? mid(p) : p));
    return new Promise((res) => {
      if (reduced || pts.length < 2) return res();
      const L = []; let tot = 0;
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
      const dur = ms || 900; const t0 = performance.now(); pkt.setAttribute('opacity', 1);
      const fr = (t) => {
        if (g !== gen) { pkt.setAttribute('opacity', 0); return res(); }
        let d = Math.min(1, (t - t0) / dur) * tot; let i = 0;
        while (i < L.length - 1 && d > L[i]) { d -= L[i]; i++; }
        const f = L[i] ? Math.min(1, d / L[i]) : 1; const [x1, y1] = pts[i]; const [x2, y2] = pts[i + 1];
        pkt.setAttribute('cx', x1 + (x2 - x1) * f); pkt.setAttribute('cy', y1 + (y2 - y1) * f);
        if (t - t0 < dur) requestAnimationFrame(fr); else { pkt.setAttribute('opacity', 0); res(); }
      };
      requestAnimationFrame(fr);
    });
  }
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const controls = el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset);
  let steps = []; let k = 0; let running = false; let busy = false;
  function makeStepper(plan, intro, onReset, pause) {
    const reset = () => {
      gen++; running = false; busy = false; bPlay.textContent = '▶ Play'; k = 0;
      if (onReset) onReset(); steps = plan(); paint(null); say(0, intro()); bStep.disabled = false;
    };
    const step = async () => {
      if (busy || k >= steps.length) return false;
      busy = true; const g = gen; const s = steps[k++];
      if (s.pre) paint(s.pre);
      if (s.fly) await fly(s.fly, s.ms);
      if (g !== gen) return false;
      paint(s); if (s.run) s.run(); say(k, s.t, s.cls); busy = false;
      if (k >= steps.length) bStep.disabled = true;
      return true;
    };
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= steps.length) reset();
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && await step()) { if (k >= steps.length) break; await sleep(reduced ? 700 : (pause || 2600)); }
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    return reset;
  }
  /* ---- end kit ---- */
  if (!document.getElementById('w-az-aoai-style')) {
    document.head.append(el('style', { id: 'w-az-aoai-style', text: `
.w-az .ql { opacity: 0; fill: var(--text-2); font-family: var(--mono); font-size: 11px; transition: opacity .4s, fill .4s; }
.w-az .ql.ok { opacity: 1; fill: var(--ok); }
.w-az .ql.warn { opacity: 1; fill: var(--warn); }
.w-az .ql.bad { opacity: 1; fill: var(--err); }
.w-az .ql.mut { opacity: 1; fill: var(--text-3); }
` }));
  }
  let mode = 'quota';
  const stage = svg('svg', { viewBox: '0 0 640 340', role: 'img', 'aria-label': 'Azure OpenAI request path: token rate limiting with 429s, content filters, or retrieval from Azure AI Search' });
  const segM = seg([['quota', 'Quota & 429'], ['filter', 'Content filter'], ['rag', 'RAG with AI Search']], mode, (v) => { mode = v; reset(); }, 'Mechanism');
  const stats = el('div', { class: 'w-stats' });
  const stat = (h) => { stats.innerHTML = ''; h.forEach((x) => stats.append(el('span', { class: 'w-stat', html: x }))); };
  const zrect = (g, id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 10 }); g.append(r, svg('text', { class: 'lbl', x: x + 8, y: y + 17, text: label })); Z[id] = { n: r, base: 'zn' }; };
  const line = (g, id, x, y, t) => { const n = svg('text', { class: 'ql', x, y, text: t }); g.append(n); Z[id] = { n, base: 'ql', sub: n, sub0: t }; };
  /* token window (quota mode) */
  const WX = 190; const WW = 440; const CAP = 16000;
  let win = null;
  function fillWin(parts) {
    if (!win) return;
    win.innerHTML = ''; let x = WX;
    parts.forEach((p) => {
      const w = Math.min(WX + WW - x, (p.n / CAP) * WW); if (w <= 0) return;
      win.append(svg('rect', { class: 'bar', x: x + 1, y: 157, width: Math.max(0, w - 2), height: 26, rx: 4, fill: p.c === 'bad' ? 'var(--err)' : p.c === 'res' ? 'var(--warn)' : 'var(--accent)', opacity: p.c === 'used' ? 0.85 : 0.55 }));
      if (w > 40) win.append(svg('text', { class: 'lbl m', x: x + w / 2, y: 174, 'text-anchor': 'middle', text: p.l }));
      x += w;
    });
  }
  function build() {
    stage.innerHTML = ''; clearZ(); win = null;
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    if (mode === 'quota') {
      node(g, 'app', 10, 40, 140, 60, 'Spring AI app', 'max_tokens 4000');
      node(g, 'lim', 190, 40, 190, 60, 'rate limiter', 'deployment “chat”');
      node(g, 'mdl', 440, 40, 190, 60, 'model', 'generates tokens');
      hlink(e, 'e1', 'app', 'lim'); hlink(e, 'e2', 'lim', 'mdl');
      edge(e, 'back', 'M285 100 C 285 126, 80 126, 80 100');
      stage.append(svg('rect', { x: WX, y: 154, width: WW, height: 32, rx: 6, fill: 'none', stroke: 'var(--border)', 'stroke-width': 1.5 }));
      stage.append(svg('text', { class: 'lbl m', x: WX, y: 146, text: 'token window: estimated prompt + max_tokens (illustrative size)' }));
      win = svg('g');
      line(g, 'r1', 10, 222, 'A  prompt 500 + max 4000 = 4,500  → admitted');
      line(g, 'r2', 10, 242, 'B  prompt 500 + max 4000 = 4,500  → admitted');
      line(g, 'r3', 10, 262, 'C  prompt 500 + max 4000 = 4,500  → admitted');
      line(g, 'r4', 10, 282, 'D  prompt 500 + max 4000 = 4,500  → 429  retry-after-ms: 2400');
      line(g, 'r5', 10, 306, 'with max_tokens 600: 1,100 each → 14 requests fit in the same window');
      line(g, 'r6', 10, 328, 'x-ratelimit-remaining-tokens tells the client how much is left');
    } else if (mode === 'filter') {
      node(g, 'doc', 160, 20, 150, 56, 'retrieved document', 'from the index');
      node(g, 'app', 10, 120, 120, 60, 'app', '');
      node(g, 'fin', 160, 120, 150, 60, 'input filter', 'harm + Prompt Shields');
      node(g, 'mdl', 340, 120, 120, 60, 'model', '');
      node(g, 'fout', 490, 120, 140, 60, 'output filter', 'harm + protected');
      node(g, 'resp', 160, 250, 300, 64, 'response', '');
      hlink(e, 'e1', 'app', 'fin'); hlink(e, 'e2', 'fin', 'mdl'); hlink(e, 'e3', 'mdl', 'fout');
      link(e, 'ed', 'doc', 'fin');
      edge(e, 'r1', 'M560 180 C 560 282, 500 282, 460 282');
      edge(e, 'r0', 'M235 180 L 235 250');
      edge(e, 'r2', 'M160 282 C 70 282, 70 220, 70 180');
    } else {
      node(g, 'usr', 10, 24, 140, 56, 'user · contoso', '“AX-4410 warranty?”');
      node(g, 'app', 10, 136, 140, 56, 'Spring AI', 'ChatClient + advisor');
      node(g, 'emb', 180, 24, 170, 56, 'embedding deployment', 'question → vector');
      zrect(bg, 'srch', 180, 104, 270, 226, 'Azure AI Search · hybrid query');
      node(g, 'bm', 192, 132, 118, 52, 'BM25 keyword', '');
      node(g, 'vec', 320, 132, 118, 52, 'vector (HNSW)', '');
      node(g, 'rrf', 192, 196, 246, 52, 'RRF fusion', 'filter tenantId eq contoso');
      node(g, 'sem', 192, 262, 246, 56, 'semantic ranker', 're-ranks the fused top results');
      node(g, 'chat', 476, 136, 156, 56, 'chat deployment', 'grounded prompt');
      node(g, 'ans', 476, 252, 156, 66, 'answer', '');
      link(e, 'u', 'usr', 'app'); edge(e, 'ae', 'M150 150 C 165 150, 200 110, 265 80');
      edge(e, 'es', 'M265 80 L 265 104');
      link(e, 'b1', 'bm', 'rrf'); link(e, 'v1', 'vec', 'rrf'); link(e, 'rs', 'rrf', 'sem');
      edge(e, 'sc', 'M438 290 C 470 290, 470 192, 554 192');
      link(e, 'ca', 'chat', 'ans');
      edge(e, 'ac', 'M150 170 C 300 340, 460 330, 476 290');
    }
    stage.append(bg, e, g); if (win) stage.append(win); stage.append(pkt);
    stat([]);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'quota') {
      S.push({ fly: ['app', 'lim'], ...A.set({ e1: 'hot', lim: 'hot', r1: 'ok' }), run: () => { fillWin([{ n: 4500, l: 'A 4.5K', c: 'res' }]); stat(['window <b>28%</b> reserved']); }, t: 'Request A arrives with ~500 prompt tokens and <code>max_tokens: 4000</code>. The limiter doesn’t know how much the model will write, so it <b>reserves 4,500</b> in the deployment’s current token window.' });
      S.push({ fly: ['lim', 'mdl'], ...A.set({ e2: 'hot', mdl: 'hot', r2: 'ok', r3: 'ok' }), run: () => { fillWin([{ n: 4500, l: 'A', c: 'res' }, { n: 4500, l: 'B 4.5K', c: 'res' }, { n: 4500, l: 'C 4.5K', c: 'res' }]); stat(['window <b>84%</b> reserved', 'real output so far: <b>~300</b> each']); }, t: 'B and C arrive in the same second and are admitted. Each will only generate a few hundred tokens, but the window is already 84% reserved, mostly by <code>max_tokens</code> nobody will use.', cls: 'warn' });
      S.push({ fly: ['app', 'lim'], ...A.set({ lim: 'bad', r4: 'bad', back: 'bad' }), run: () => { fillWin([{ n: 4500, l: 'A', c: 'res' }, { n: 4500, l: 'B', c: 'res' }, { n: 4500, l: 'C', c: 'res' }, { n: 4500, l: 'D ✗', c: 'bad' }]); stat(['<b>429</b> Too Many Requests', 'retry-after-ms <b>2400</b>']); }, t: 'Request D doesn’t fit: <b>429</b> with <code>retry-after-ms</code>. The minute’s total TPM might never be reached; limits are enforced over <b>short windows</b>, so bursts are throttled.', cls: 'err' });
      S.push({ fly: ['lim', 'app'], ...A.set({ app: 'warn' }, { app: 'wait 2.4 s + jitter' }), run: () => { fillWin([{ n: 900, l: '', c: 'used' }]); stat(['client waits <b>2.4 s ± jitter</b>', 'retries <b>1/3</b>']); }, t: 'A good client waits the <code>retry-after</code> time plus jitter, inside a retry budget (the Azure and OpenAI SDKs do this). Meanwhile capacity frees up as the window moves on. Retrying immediately, from several layers, would keep it full.', cls: 'warn' });
      S.push({ fly: ['app', 'lim', 'mdl'], ...A.set({ lim: 'ok', app: 'ok', back: 'ok', r4: 'warn' }, { r4: 'D  retried after 2.4 s  → admitted', app: 'max_tokens 4000' }), run: () => { fillWin([{ n: 900, l: '', c: 'used' }, { n: 4500, l: 'D 4.5K', c: 'res' }]); stat(['D <b>200 OK</b>']); }, t: 'D is admitted on retry. It worked, but every user waited, and under real load the retries pile up.', cls: 'ok' });
      S.push({ ...A.set({ r5: 'ok', r6: 'mut', app: 'ok' }, { app: 'max_tokens 600' }), run: () => { fillWin(Array.from({ length: 14 }, (_, i) => ({ n: 1100, l: i < 2 ? '1.1K' : '', c: 'res' }))); stat(['<b>14</b> requests per window instead of 3', 'same quota']); }, t: 'The real fix: size <code>max_tokens</code> per use case (here 600). Each request now reserves 1,100, so <b>14</b> fit where 3 did. Then smooth bursts (concurrency limit, queue), and add deployments or regions behind a gateway when real demand needs more.', cls: 'ok' });
      return S;
    }
    if (mode === 'filter') {
      S.push({ fly: ['app', 'fin', 'mdl', 'fout', [560, 282], 'resp'], ...A.set({ e1: 'ok', e2: 'ok', e3: 'ok', r1: 'ok', fin: 'ok', mdl: 'ok', fout: 'ok', resp: 'ok' }, { resp: '200 · finish_reason: "stop"', fin: 'all categories: safe' }), run: () => stat(['prompt_filter_results: <b>safe</b>', 'content_filter_results: <b>safe</b>']), t: 'A normal question. The <b>input filter</b> scores the prompt (hate, sexual, violence, self-harm; Prompt Shields for jailbreaks), the model answers, the <b>output filter</b> scores the completion. Annotations come back in the response.', cls: 'ok' });
      S.push({ fly: ['app', 'fin'], pre: A.set({ e1: '', e2: '', e3: '', r1: '', fin: '', mdl: '', fout: '', resp: '' }), ...A.set({ e1: 'bad', fin: 'bad', mdl: 'dim', fout: 'dim', r0: 'bad', resp: 'bad' }, { fin: 'jailbreak detected', resp: '400 · error.code: content_filter' }), run: () => stat(['model <b>never called</b>', 'HTTP <b>400</b>']), t: '“Ignore your rules and…”: <b>Prompt Shields</b> flag a jailbreak and the request fails with <b>HTTP 400</b>, error code <code>content_filter</code>, with details of which filter triggered. Your code must catch this and show a safe message, not a stack trace.', cls: 'err' });
      S.push({ fly: ['app', 'fin', 'mdl', 'fout', [560, 282], 'resp'], pre: A.set({ e1: '', fin: '', mdl: '', fout: '', r0: '', resp: '' }), ...A.set({ e1: 'ok', e2: 'ok', fin: 'ok', mdl: 'ok', e3: 'warn', fout: 'bad', r1: 'warn', resp: 'warn' }, { fin: 'prompt: safe', resp: '200 · finish_reason: "content_filter"' }), run: () => stat(['HTTP <b>200</b>', 'content: partial or empty']), t: 'A harmless prompt, but the <b>completion</b> crosses a threshold. The call still returns <b>200</b>, with <code>finish_reason: "content_filter"</code>. Code that only checks the status code would show a truncated answer as if it were complete.', cls: 'warn' });
      S.push({ fly: ['doc', 'fin'], pre: A.set({ e1: '', e2: '', e3: '', fin: '', mdl: '', fout: '', r1: '', resp: '' }), ...A.set({ doc: 'bad', ed: 'bad', fin: 'warn', resp: 'warn' }, { doc: 'hidden instructions', fin: 'document attack flagged', resp: 'annotated / blocked by your policy' }), run: () => stat(['indirect prompt injection']), t: 'RAG adds a second channel: a retrieved document carrying instructions (<b>indirect injection</b>). Prompt Shields can detect document attacks when documents are marked as such. Still treat retrieved text as data, and limit what tools the model may call.', cls: 'warn' });
      S.push({ ...A.set({ doc: 'dim', ed: 'dim', fin: 'hot', fout: 'hot', resp: 'hot' }, { fin: 'per-deployment config', fout: 'custom config', resp: 'handle 400 and finish_reason' }), t: 'Filters are configured per <b>deployment</b> (the default blocks medium severity and above; some changes need approval). Log the categories and severities, not the user’s text, and alert on spikes: a sudden rise usually means an attack or a filter that is too strict for your domain.' });
      return S;
    }
    S.push({ fly: ['usr', 'app'], ...A.set({ usr: 'hot', u: 'hot', app: 'hot' }, { app: 'tenant from the token' }), run: () => stat(['question: <b>AX-4410 warranty?</b>']), t: 'The question arrives. The tenant and groups come from the <b>authenticated token</b>, never from the question text; they become the security filter.' });
    S.push({ fly: ['app', [265, 80]], ...A.set({ ae: 'hot', emb: 'hot' }, { emb: 'same model as index' }), t: 'The question is embedded with the <b>same embedding model</b> used for the index. Vectors from different models or dimensions can’t be compared.' });
    S.push({ fly: [[265, 80], [265, 104], 'vec'], ...A.set({ es: 'hot', srch: 'hot', bm: 'ok', vec: 'warn' }, { bm: 'AX-4410 exact → #1', vec: 'AX-4410 only #3' }), t: '<b>Hybrid query</b>: BM25 matches the exact code; vector search finds similar meaning but ranks a neighbouring product first. Either alone would be weaker.' });
    S.push({ ...A.set({ b1: 'ok', v1: 'ok', rrf: 'ok' }, { rrf: 'RRF · tenantId eq contoso' }), run: () => stat(['filter: <b>tenantId eq \'contoso\'</b>']), t: '<b>Reciprocal Rank Fusion</b> merges the two ranked lists, and the filter removes other tenants’ chunks. Without that filter, RAG leaks data between customers.', cls: 'ok' });
    S.push({ ...A.set({ rs: 'ok', sem: 'ok' }, { sem: 'top 5 chunks, re-ranked' }), t: 'The <b>semantic ranker</b> re-scores the fused top results with a language model trained for relevance, and the app keeps the top 5 chunks with their source titles.', cls: 'ok' });
    S.push({ fly: [[438, 290], [470, 192], 'chat'], ...A.set({ sc: 'hot', chat: 'hot' }, { chat: 'system + sources + q' }), run: () => stat(['prompt ≈ <b>5 chunks</b> + question']), t: 'The chat deployment gets a system prompt (“answer only from the sources, cite them”), the chunks as delimited data, and the question. Same quota and filters as any request.' });
    S.push({ fly: ['chat', 'ans'], ...A.set({ ca: 'ok', ans: 'ok', ac: 'ok' }, { ans: 'cites warranty.pdf §3' }), run: () => stat(['grounded · cited', 'evaluate retrieval first']), t: 'A grounded answer with citations. When answers are wrong, check <b>retrieval</b> before the prompt: log which chunk ids were used, and measure recall on a labelled question set.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ quota: 'Press Play: four bursty requests with a generous max_tokens meet the token window.', filter: 'Press Play: a normal call, a jailbreak, a filtered completion and an injected document.', rag: 'Press Play: from question to cited answer through embeddings and a hybrid search.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), stats, controls, narr);
  const reset = makeStepper(plan, intro, build);
  reset();
});
