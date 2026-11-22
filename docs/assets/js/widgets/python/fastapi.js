/* FastAPI: one request through uvicorn → middleware → router → Depends() → Pydantic → endpoint → response_model,
   with the event-loop thread and the AnyIO threadpool shown as lanes, and a second request (GET /health) arriving midway. */
IA.widget('fastapi', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-py-base')) {
    document.head.append(el('style', { id: 'w-py-base', text: `
.wpy-code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.wpy-code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent}
.wpy-code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.wpy-out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.wpy-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.wpy-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:12px;align-items:start}
@media (max-width:720px){.wpy-grid{grid-template-columns:1fr}}
` }));
  }
  if (!document.getElementById('w-pyfa-style')) {
    document.head.append(el('style', { id: 'w-pyfa-style', text: `
.w-pyfa .stg{fill:var(--surface);stroke:var(--border);stroke-width:1.5;transition:all .3s}
.w-pyfa .stg.done{stroke:var(--accent);stroke-opacity:.45}
.w-pyfa .stg.on{stroke:var(--accent);stroke-width:3;fill:var(--accent-soft)}
.w-pyfa .stg.err{stroke:var(--err);stroke-width:3;fill:color-mix(in srgb,var(--err) 12%,transparent)}
.w-pyfa .lane{fill:var(--surface-2);stroke:var(--border)}
.w-pyfa .bar.a{fill:color-mix(in srgb,var(--accent) 30%,var(--surface))}
.w-pyfa .bar.b{fill:color-mix(in srgb,var(--ok) 30%,var(--surface))}
.w-pyfa .bar.blk{fill:color-mix(in srgb,var(--err) 30%,var(--surface));stroke:var(--err);stroke-width:2}
.w-pyfa .bar.wait{fill:none;stroke:var(--warn);stroke-width:2;stroke-dasharray:5 4}
.w-pyfa .tok{transition:transform .6s ease}
.w-pyfa .wpy-out.err{border-color:var(--err)}
` }));
  }
  const ST = [['client', 'POST /orders'], ['uvicorn', 'HTTP → ASGI'], ['middleware', 'CORS, req-id'], ['router', 'match path'], ['Depends()', 'resolve graph'], ['Pydantic', 'validate'], ['endpoint', 'your function'], ['response', 'model → JSON']];
  const SIG = { async: 'async def create_order(body: OrderIn, s: SessionDep) -> OrderOut', sync: 'def create_order(body: OrderIn, s: SyncSessionDep) -> OrderOut', block: 'async def create_order(body: OrderIn, s: SessionDep) -> OrderOut' };
  const BODY = { valid: '{"sku": "A1", "quantity": "3"}', invalid: '{"sku": "", "quantity": 0}' };
  function plan(kind, valid) {
    const S = [];
    S.push({ st: 0, panel: `POST /orders HTTP/1.1\ncontent-type: application/json\n\n${BODY[valid ? 'valid' : 'invalid']}`, cap: 'Client A sends a request. One uvicorn worker process, one event loop thread, one AnyIO threadpool (40 threads by default).' });
    S.push({ st: 1, loop: 'A: parse HTTP', panel: 'scope = {"type": "http", "method": "POST",\n         "path": "/orders", "headers": [...]}\nawait app(scope, receive, send)', cap: 'Uvicorn reads bytes on the <b>event loop</b>, parses HTTP and calls the ASGI app with a <code>scope</code> dict plus <code>receive</code>/<code>send</code> callables.' });
    S.push({ st: 2, loop: 'A: middleware', panel: 'RequestIdMiddleware → CORSMiddleware → app', cap: 'Middleware wraps the whole call, outermost first: request IDs, CORS, timing, GZip. It sees the request before routing and the response after.' });
    S.push({ st: 3, loop: 'A: routing', panel: 'routes tried in declaration order:\n  GET  /orders/{order_id}   ✗ method\n  POST /orders              ✓ create_order', cap: 'The router walks routes <b>in declaration order</b> and takes the first match on path and method.' });
    S.push({ st: 4, loop: 'A: Depends()', panel: 'create_order(body, s)\n └─ s = Depends(get_session)      → opens session#1 (runs to yield)\n    (requested again by current_user → same session#1, cached)', cap: 'FastAPI resolves the dependency graph from the signature. Each dependency runs <b>once per request</b>; a <code>yield</code> dependency pauses at <code>yield</code> and will clean up later.' + (kind === 'sync' ? ' Sync dependencies would also go to the threadpool.' : '') });
    if (!valid) {
      S.push({ st: 5, err: true, loop: 'A: validate', panel: 'HTTP 422 Unprocessable Entity\n{"detail": [\n  {"type": "string_too_short", "loc": ["body", "sku"], "msg": "String should have at least 1 character"},\n  {"type": "greater_than", "loc": ["body", "quantity"], "msg": "Input should be greater than 0"}\n]}', cap: 'Pydantic validates the body against <code>OrderIn</code> and collects <b>every</b> error, not just the first. Your function is never called.' });
      S.push({ st: 7, err: true, loop: 'A: send 422', panel: '422 sent. Teardown: get_session resumes after yield → session#1 closed.', cap: 'FastAPI sends the 422. The <code>yield</code> dependency still gets its teardown, so the session goes back to the pool.' });
      S.push({ st: 7, err: true, b: 'served', loop: 'B: /health', panel: 'GET /health → 200 {"status": "ok"}  (2 ms)', cap: 'Request B arrives and is served immediately: the loop was never blocked. Switch the body to <b>valid</b> to follow the full path.' });
      return S;
    }
    S.push({ st: 5, loop: 'A: validate', panel: 'OrderIn(sku="A1", quantity=3)\n# "3" → 3: lax mode coerces numeric strings\n# extra fields → rejected (extra="forbid")', cap: 'The JSON body becomes a typed <code>OrderIn</code>. Pydantic v2 is lax by default: the string <code>"3"</code> becomes the int 3. <code>strict=True</code> would reject it.' });
    if (kind === 'async') {
      S.push({ st: 6, loop: 'A: create_order …', aw: true, panel: SIG.async + '\n    session.add(order)\n    await session.commit()     # ← yields to the loop', cap: '<code>async def</code> runs <b>on the event loop</b>. At <code>await session.commit()</code> it suspends while the DB works, and the loop is free.' });
      S.push({ st: 6, loop: 'A: awaiting DB', aw: true, b: 'served', panel: 'GET /health → 200 (2 ms)   served while A waits', cap: 'Request B arrives while A is waiting on Postgres. The loop runs B straight away. This is how one thread serves thousands of concurrent waits.' });
      S.push({ st: 6, loop: 'A: resumes', b: 'served', panel: 'commit done → return order', cap: 'The DB replies, the loop resumes A where it left off, and the function returns.' });
    } else if (kind === 'sync') {
      S.push({ st: 6, thread: 'thread 1/40: create_order()', loop: '(free)', panel: SIG.sync + '\n    session.add(order); session.commit()   # blocking driver', cap: 'A plain <code>def</code> is sent to the <b>threadpool</b> (<code>run_in_threadpool</code>). The blocking DB call ties up a worker thread, not the loop.' });
      S.push({ st: 6, thread: 'thread 1/40: create_order()', b: 'served', loop: 'B: /health', panel: 'GET /health → 200 (2 ms)   loop was free', cap: 'Request B is served on the loop meanwhile. The catch: only <b>40</b> sync calls run at once by default. Request 41 queues for a thread.' });
      S.push({ st: 6, thread: 'thread 1/40: returns', b: 'served', loop: 'A: back on loop', panel: 'thread returns the result to the loop', cap: 'The thread finishes and hands the result back to the event loop.' });
    } else {
      S.push({ st: 6, err: true, blk: true, loop: 'A: requests.post(LLM) BLOCKING', panel: SIG.block + '\n    r = requests.post(LLM_URL, json=...)   # sync HTTP inside async def\n    ...', cap: '<code>async def</code>, but the code calls a <b>blocking</b> library. The event loop thread is stuck inside <code>requests.post</code> for 3 s.' });
      S.push({ st: 6, err: true, blk: true, b: 'wait', loop: 'A: still blocking', panel: 'GET /health … waiting (no one is running the loop)', cap: 'Request B arrives. Its bytes sit in the socket: the loop can’t even parse them. A Kubernetes liveness probe on <code>/health</code> would time out here.' });
      S.push({ st: 6, b: 'late', loop: 'A: done → B: /health', panel: 'GET /health → 200 after 3,002 ms', cap: 'Only when A finishes does the loop get to B. Fix: <code>await httpx.AsyncClient().post(...)</code>, or make the endpoint a plain <code>def</code> so it runs in the threadpool.' });
    }
    S.push({ st: 7, loop: 'A: serialise', b: kind === 'block' ? 'late' : 'served', panel: 'return value: Order(id=17, sku="A1", quantity=3, status="new",\n                   owner_id=9, internal_note="vip")\nresponse (OrderOut): {"id": 17, "sku": "A1", "quantity": 3, "status": "new"}', cap: 'The return value is validated and <b>filtered</b> through the response model (<code>-&gt; OrderOut</code>): <code>owner_id</code> and <code>internal_note</code> are dropped. Then it is serialised to JSON.' });
    S.push({ st: 7, loop: 'A: teardown', b: kind === 'block' ? 'late' : 'served', panel: '201 Created sent\nget_session resumes after yield → session#1 closed', cap: 'The request ends: code after <code>yield</code> in <code>get_session</code> runs and the connection returns to the pool. (Exactly when, relative to sending the response, has changed between FastAPI versions.)' });
    return S;
  }
  let kind = 'async', valid = true, k = 0, gen = 0, running = false, S = plan(kind, valid);
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }); opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segK = seg([['async', 'async def + await'], ['sync', 'def (threadpool)'], ['block', 'async def + blocking call']], kind, (v) => { kind = v; reset(); }, 'Endpoint style');
  const segV = seg([[true, 'valid body'], [false, 'invalid body']], valid, (v) => { valid = v; reset(); }, 'Request body');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 640 270', role: 'img', 'aria-label': 'Request pipeline stages, with the event loop and threadpool lanes underneath' });
  const panel = el('div', { class: 'wpy-out' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pyfa');
  root.append(el('div', { class: 'w-controls' }, segK), el('div', { class: 'w-controls' }, segV), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'wpy-lbl', text: 'what FastAPI is holding right now' }), panel,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const BX = (i) => 8 + i * 79, BW = 72;
  // static layer: stage boxes and lanes, drawn once; dynamic layer redrawn per step; token persists so it can glide
  const boxes = [];
  ST.forEach(([t, sub], i) => {
    const r = svg('rect', { class: 'stg', x: BX(i), y: 18, width: BW, height: 56, rx: 10 }); boxes.push(r);
    stage.append(r, svg('text', { x: BX(i) + BW / 2, y: 42, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: 'var(--text)', text: t }),
      svg('text', { x: BX(i) + BW / 2, y: 60, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-3)', text: sub }));
    if (i < ST.length - 1) stage.append(svg('path', { d: `M${BX(i) + BW + 1} 46 l6 0`, stroke: 'var(--edge)', 'stroke-width': 2 }));
  });
  stage.append(svg('rect', { class: 'lane', x: 8, y: 118, width: 624, height: 58, rx: 10 }), svg('text', { x: 18, y: 136, 'font-size': 11.5, 'font-weight': 700, fill: 'var(--text-3)', text: 'event loop (1 thread per worker)' }),
    svg('rect', { class: 'lane', x: 8, y: 190, width: 624, height: 58, rx: 10 }), svg('text', { x: 18, y: 208, 'font-size': 11.5, 'font-weight': 700, fill: 'var(--text-3)', text: 'AnyIO threadpool (40 tokens) for sync def' }));
  const dyn = svg('g'); stage.append(dyn);
  const tokC = svg('circle', { cx: 0, cy: 0, r: 11, fill: 'var(--accent)' });
  const tok = svg('g', { class: 'tok' }, tokC, svg('text', { x: 0, y: 4, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: 'var(--surface)', text: 'A' }));
  if (reduced) tok.style.transition = 'none';
  stage.append(tok);
  function render() {
    const cur = k ? S[k - 1] : null;
    boxes.forEach((r, i) => { let cls = 'stg'; if (cur && i < cur.st) cls += ' done'; if (cur && i === cur.st) cls += cur.err ? ' err' : ' on'; r.setAttribute('class', cls); });
    tok.style.display = cur ? '' : 'none';
    if (cur) { tok.style.transform = `translate(${BX(cur.st) + BW / 2}px, 92px)`; tokC.setAttribute('fill', cur.err ? 'var(--err)' : 'var(--accent)'); }
    dyn.innerHTML = '';
    if (cur && cur.loop) {
      const cls = cur.blk ? 'bar blk' : cur.loop.startsWith('B') ? 'bar b' : cur.loop === '(free)' ? '' : 'bar a';
      if (cls) dyn.append(svg('rect', { class: cls, x: 18, y: 144, width: 300, height: 24, rx: 7 }));
      dyn.append(svg('text', { x: 28, y: 161, 'font-size': 12, 'font-family': 'var(--mono)', fill: cur.blk ? 'var(--err)' : 'var(--text)', text: cur.loop === '(free)' ? 'free: can serve other requests' : cur.loop }));
      if (cur.aw && !cur.b) dyn.append(svg('text', { x: 330, y: 161, 'font-size': 11.5, fill: 'var(--text-3)', text: '(at await: loop is free)' }));
    }
    if (cur && cur.b) {
      const map = { served: ['bar b', 'B: GET /health → 200 ✓'], wait: ['bar wait', 'B: GET /health … queued'], late: ['bar b', 'B: GET /health → 200 (3 s late)'] };
      const [c, t] = map[cur.b];
      dyn.append(svg('rect', { class: c, x: 330, y: 144, width: 292, height: 24, rx: 7 }), svg('text', { x: 340, y: 161, 'font-size': 12, 'font-family': 'var(--mono)', fill: cur.b === 'wait' ? 'var(--warn)' : 'var(--text)', text: t }));
    }
    if (cur && cur.thread) dyn.append(svg('rect', { class: 'bar a', x: 18, y: 216, width: 300, height: 24, rx: 7 }), svg('text', { x: 28, y: 233, 'font-size': 12, 'font-family': 'var(--mono)', fill: 'var(--text)', text: cur.thread }));
    else dyn.append(svg('text', { x: 28, y: 233, 'font-size': 11.5, fill: 'var(--text-3)', text: kind === 'sync' ? 'idle' : 'unused: this endpoint is async def' }));
    panel.textContent = cur ? cur.panel : `${SIG[kind]}\n\nbody: ${BODY[valid ? 'valid' : 'invalid']}`;
    panel.classList.toggle('err', !!(cur && cur.err));
    narr.innerHTML = '';
    narr.className = 'caption' + (cur && cur.err ? ' err' : '');
    narr.append(el('div', { class: 'n', text: `${k}/${S.length}` }), el('div', { class: 't', html: cur ? cur.cap : 'Pick an endpoint style and a body, then press <b>Play</b> or <b>Step</b>.' }));
    bStep.disabled = k >= S.length;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); S = plan(kind, valid); k = 0; render(); }
  function step() { if (k >= S.length) return false; k++; render(); return k < S.length; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= S.length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2800); }
    if (g === gen) stop();
  });
  reset();
});
