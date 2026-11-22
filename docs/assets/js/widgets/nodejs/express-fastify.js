/* Express & Fastify: follow one request through an Express middleware chain (with error middleware,
   Express 4 vs 5 async errors) or through Fastify's hook lifecycle (schema validation, serialization). */
IA.widget('express-fastify', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-ef-style')) {
    document.head.append(el('style', { id: 'w-ef-style', text: `
.w-ef-pipe { display: flex; flex-wrap: wrap; align-items: stretch; gap: 6px; margin: 10px 0 4px; }
.w-ef-n { border: 1.5px solid var(--border); background: var(--surface); border-radius: 9px; padding: 6px 9px; min-width: 92px; transition: background .3s, border-color .3s, opacity .3s; }
.w-ef-n .l { font-family: var(--mono); font-size: 12.5px; font-weight: 700; color: var(--text); }
.w-ef-n .s { font-size: 11px; color: var(--text-3); }
.w-ef-n.done { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 10%, var(--surface)); }
.w-ef-n.skip { opacity: .4; border-style: dashed; }
.w-ef-n.err { border-color: var(--err); background: color-mix(in srgb, var(--err) 14%, var(--surface)); }
.w-ef-n.cur { border-color: var(--accent); background: var(--accent-soft); box-shadow: 0 0 0 3px var(--accent-soft); }
.w-ef-n.errh { border-color: var(--warn); }
.w-ef-ar { align-self: center; color: var(--text-3); font-size: 13px; }
.w-ef-lane { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: .04em; margin-top: 8px; }
.w-ef-res { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--surface-2); font-size: 13px; min-height: 40px; }
.w-ef-res .code { font-family: var(--mono); font-weight: 700; border-radius: 999px; padding: 2px 10px; border: 1px solid var(--border); }
.w-ef-res .code.ok { color: var(--ok); border-color: var(--ok); } .w-ef-res .code.bad { color: var(--err); border-color: var(--err); } .w-ef-res .code.warn { color: var(--warn); border-color: var(--warn); }
.w-ef-res .body { font-family: var(--mono); font-size: 12px; color: var(--text-2); overflow-wrap: anywhere; }
` }));
  }
  // node catalogs: id → [label, sub, isErrorHandler]
  const EXN = {
    helmet: ['helmet()', 'security headers'], json: ['express.json()', 'parse JSON body'], auth: ['auth', 'sets req.user'],
    route: ['router', 'match path'], handler: ['handler', 'your code'], err: ['onError', '(err, req, res, next)', 1]
  };
  const FAN = {
    routing: ['routing', 'find-my-way'], onRequest: ['onRequest', 'auth (no body)'], preParsing: ['preParsing', 'raw stream'],
    parse: ['parse', 'content-type parser'], preValidation: ['preValidation', 'hook'], validate: ['validate', 'Ajv: body schema'],
    preHandler: ['preHandler', 'hook'], handler: ['handler', 'async (req, reply)'], preSerialization: ['preSerialization', 'hook'],
    serialize: ['serialize', 'response schema'], onSend: ['onSend', 'final payload'], onResponse: ['onResponse', 'metrics / logs'],
    errh: ['setErrorHandler', 'error → reply', 1]
  };
  const EXO = ['helmet', 'json', 'auth', 'route', 'handler', 'err'];
  const FAO = ['routing', 'onRequest', 'preParsing', 'parse', 'preValidation', 'validate', 'preHandler', 'handler', 'preSerialization', 'serialize', 'onSend', 'onResponse', 'errh'];
  const S = {
    express: {
      ok: { label: 'happy path', code: `app.use(helmet());\napp.use(express.json());\napp.use(auth);\napp.get('/orders/:id', async (req, res) => {\n  res.json(await db.find(req.params.id));\n});\napp.use(onError);   // (err, req, res, next)`,
        steps: () => [
          ['helmet', 'done', 'Request <code>GET /orders/42</code> arrives. <code>helmet()</code> sets security headers and calls <code>next()</code>.'],
          ['json', 'done', '<code>express.json()</code> sees no JSON content-type (it’s a GET), so it does nothing and calls <code>next()</code>.'],
          ['auth', 'done', '<code>auth</code> verifies the bearer token, sets <code>req.user</code>, calls <code>next()</code>.'],
          ['route', 'done', 'The router matches <code>/orders/:id</code> and sets <code>req.params.id = \'42\'</code>.'],
          ['handler', 'done', 'The handler awaits the database and calls <code>res.json(order)</code>. It never calls <code>next()</code>, so the chain stops here.', { c: 200, k: 'ok', b: '{"id":"42","total":250}' }],
          ['err', 'skip', 'No error, so the error middleware never runs. Registration order = execution order.']
        ] },
      sync: { label: 'sync throw', code: `app.get('/orders/:id', (req, res) => {\n  const o = cache.get(req.params.id);\n  res.json(o.toDto());   // o is undefined → TypeError\n});\napp.use(onError);`,
        steps: () => [
          ['helmet', 'done', '<code>helmet()</code> → <code>next()</code>.'], ['json', 'done', '<code>express.json()</code> → <code>next()</code>.'], ['auth', 'done', '<code>auth</code> → <code>next()</code>.'], ['route', 'done', 'Route matches.'],
          ['handler', 'err', 'The handler throws a <b>synchronous</b> TypeError. Express calls every layer inside a try/catch, so it catches it (Express 4 and 5) and switches to error mode.'],
          ['err', 'done', 'Error mode skips normal middleware and runs the next <b>4-parameter</b> function: <code>onError</code>. It logs and responds 500.', { c: 500, k: 'bad', b: '{"code":"INTERNAL"}' }]
        ] },
      async: { label: 'async rejection', code: `app.get('/orders/:id', async (req, res) => {\n  const o = await db.find(req.params.id);   // rejects: timeout\n  res.json(o);\n});\napp.use(onError);`,
        steps: (v) => [
          ['helmet', 'done', '<code>helmet()</code> → <code>next()</code>.'], ['json', 'done', '<code>express.json()</code> → <code>next()</code>.'], ['auth', 'done', '<code>auth</code> → <code>next()</code>.'], ['route', 'done', 'Route matches.'],
          ['handler', 'err', 'The handler hits <code>await</code>, returns a pending promise, and later the query <b>rejects</b>. Nothing was thrown synchronously, so the try/catch around the call saw nothing.'],
          v === 4
            ? ['err', 'skip', '<b>Express 4</b> ignores the returned promise. Nobody calls <code>next(err)</code> and nobody responds: the request <b>hangs</b> until the client or LB times out. Since Node 15 the unhandled rejection also <b>crashes the process</b> (exit 1), killing every other in-flight request.', { c: 'hang', k: 'warn', b: 'no response… then process exit 1 (unhandled rejection)' }]
            : ['err', 'done', '<b>Express 5</b> attaches a rejection handler to the returned promise and calls <code>next(err)</code>. The error middleware responds 500 and the process stays up.', { c: 500, k: 'bad', b: '{"code":"INTERNAL"}' }]
        ] },
      auth: { label: 'auth: next(err)', code: `function auth(req, res, next) {\n  if (!valid(req.headers.authorization))\n    return next(createError(401, 'bad token'));\n  next();\n}`,
        steps: () => [
          ['helmet', 'done', '<code>helmet()</code> → <code>next()</code>.'], ['json', 'done', '<code>express.json()</code> → <code>next()</code>.'],
          ['auth', 'err', '<code>auth</code> calls <code>next(err)</code> with a 401 error. Passing <b>anything</b> except <code>\'route\'</code> or <code>\'router\'</code> to <code>next</code> means “error”.'],
          ['route', 'skip', 'Error mode: the router and the handler are skipped.'], ['handler', 'skip', 'Skipped.'],
          ['err', 'done', '<code>onError</code> reads <code>err.status</code> (401) and responds.', { c: 401, k: 'bad', b: '{"code":"UNAUTHORIZED"}' }]
        ] },
      order: { label: 'router before json()', order: ['helmet', 'route', 'handler', 'json', 'err'], code: `app.use(helmet());\napp.post('/orders', (req, res) => {\n  res.status(201).json(create(req.body.sku));   // req.body?\n});\napp.use(express.json());   // too late\napp.use(onError);`,
        steps: () => [
          ['helmet', 'done', '<code>POST /orders</code> with a JSON body. <code>helmet()</code> → <code>next()</code>.'],
          ['route', 'done', 'The route is registered <b>before</b> the parser, so it matches first.'],
          ['handler', 'err', '<code>req.body</code> is <code>undefined</code>: the body is still an unread stream. <code>req.body.sku</code> throws a TypeError, caught by Express.'],
          ['json', 'skip', '<code>express.json()</code> is normal middleware, so error mode skips it. It would have been too late anyway.'],
          ['err', 'done', '500, for a perfectly valid request. Fix: register parsers before routers.', { c: 500, k: 'bad', b: '{"code":"INTERNAL"}' }]
        ] }
    },
    fastify: {
      ok: { label: 'happy path', code: `app.post('/admin/orders', {\n  schema: { body: OrderIn, response: { 201: OrderOut } }\n}, async (req, reply) => {\n  const o = await orders.create(req.body);   // { id, sku, qty, internalNote }\n  return reply.code(201).send(o);\n});`,
        steps: () => [
          ['routing', 'done', '<code>POST /admin/orders</code>: the radix-tree router finds the route and its compiled schema functions.'],
          ['onRequest', 'done', '<code>onRequest</code> runs the auth hook. The body hasn’t been read yet, so auth can reject cheaply.'],
          ['preParsing', 'done', '<code>preParsing</code> could wrap the raw stream (decompression, size checks).'],
          ['parse', 'done', 'The JSON content-type parser reads the body (up to <code>bodyLimit</code>, 1 MiB by default).'],
          ['preValidation', 'done', '<code>preValidation</code> hook.'],
          ['validate', 'done', 'The body is checked by the Ajv function compiled once at startup from <code>OrderIn</code>: valid.'],
          ['preHandler', 'done', '<code>preHandler</code>: the place for permission checks that need the parsed body.'],
          ['handler', 'done', 'The handler creates the order and sends it. The object also has an <code>internalNote</code> field.'],
          ['preSerialization', 'done', '<code>preSerialization</code> can still change the object.'],
          ['serialize', 'done', 'The 201 response schema was compiled to a <b>fast-json-stringify</b> function that writes only <code>id</code>, <code>sku</code>, <code>qty</code>. <code>internalNote</code> is dropped.'],
          ['onSend', 'done', '<code>onSend</code> sees the final string payload (e.g. to add an ETag).', { c: 201, k: 'ok', b: '{"id":"o_9","sku":"A1","qty":2}' }],
          ['onResponse', 'done', '<code>onResponse</code> runs after the response is sent: record latency and status here.'],
          ['errh', 'skip', 'No error: the error handler is not used.']
        ] },
      invalid: { label: 'schema fails', code: `// body: { "sku": "A1", "qty": 0 }\nconst OrderIn = Type.Object({\n  sku: Type.String(),\n  qty: Type.Integer({ minimum: 1 })\n});`,
        steps: () => [
          ['routing', 'done', 'Route found.'], ['onRequest', 'done', 'Auth passes.'], ['preParsing', 'done', 'Raw stream.'], ['parse', 'done', 'JSON parsed: <code>{"sku":"A1","qty":0}</code>.'], ['preValidation', 'done', '<code>preValidation</code> hook.'],
          ['validate', 'err', 'Ajv: <code>qty</code> must be ≥ 1. Validation fails <b>before</b> any of your route code runs.'],
          ['preHandler', 'skip', 'Skipped.'], ['handler', 'skip', 'The handler never runs: no half-validated input reaches business logic.'], ['preSerialization', 'skip', 'Skipped.'], ['serialize', 'skip', 'Skipped.'],
          ['errh', 'done', 'The error (code <code>FST_ERR_VALIDATION</code>, <code>err.validation</code> holds the details) goes to <code>setErrorHandler</code>, which replies 400.'],
          ['onSend', 'done', 'Error replies still go through <code>onSend</code>…', { c: 400, k: 'bad', b: '{"code":"INVALID","details":[{"instancePath":"/qty",…}]}' }],
          ['onResponse', 'done', '…and <code>onResponse</code>, so your metrics count 400s too.']
        ] },
      throw: { label: 'handler rejects', code: `app.get('/orders/:id', async (req) => {\n  return await orders.get(req.params.id);   // rejects: db timeout\n});\napp.setErrorHandler((err, req, reply) => { … });`,
        steps: () => [
          ['routing', 'done', 'Route found.'], ['onRequest', 'done', 'Auth passes.'], ['preParsing', 'done', '<code>preParsing</code> hook (there is no body on this GET).'], ['parse', 'skip', 'No body to parse.'], ['preValidation', 'done', '<code>preValidation</code>.'], ['validate', 'done', 'Params/querystring schema passes.'], ['preHandler', 'done', '<code>preHandler</code>.'],
          ['handler', 'err', 'The async handler rejects. Fastify awaits the handler’s promise, so the rejection is caught like a throw.'],
          ['preSerialization', 'skip', 'Skipped.'], ['serialize', 'skip', 'The success serializer is skipped.'],
          ['errh', 'done', '<code>setErrorHandler</code> logs it and replies 500. Without one, Fastify’s default handler replies with <code>{ statusCode, error, message }</code>.'],
          ['onSend', 'done', '<code>onSend</code>.', { c: 500, k: 'bad', b: '{"code":"INTERNAL"}' }],
          ['onResponse', 'done', '<code>onResponse</code>: the process stays up.']
        ] },
      early: { label: 'onRequest replies 401', code: `app.addHook('onRequest', async (req, reply) => {\n  if (!req.headers.authorization)\n    return reply.code(401).send({ code: 'UNAUTHORIZED' });\n});`,
        steps: () => [
          ['routing', 'done', 'Route found.'],
          ['onRequest', 'err', 'The hook replies 401 itself. Replying from a hook <b>ends the request lifecycle</b>.'],
          ['preParsing', 'skip', 'The body is never read: an unauthenticated 50 MB upload costs nothing.'], ['parse', 'skip', 'Skipped.'], ['preValidation', 'skip', 'Skipped.'], ['validate', 'skip', 'Skipped.'], ['preHandler', 'skip', 'Skipped.'], ['handler', 'skip', 'Skipped.'], ['preSerialization', 'skip', 'Skipped.'], ['serialize', 'skip', 'Skipped.'],
          ['onSend', 'done', '<code>onSend</code> still runs for the reply.', { c: 401, k: 'bad', b: '{"code":"UNAUTHORIZED"}' }],
          ['onResponse', 'done', '<code>onResponse</code> runs.'], ['errh', 'skip', 'Not an error: the hook replied normally.']
        ] }
    }
  };
  let fw = 'express'; let sc = 'ok'; let ver = 5; let gen = 0; let running = false; let speed = 2200; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    const paint = () => [...s.children].forEach((x) => x.classList.toggle('on', x.dataset.v === String(get())));
    opts.forEach(([v, l]) => { const b = el('button', { text: l, 'data-v': String(v) }); b.addEventListener('click', () => { set(v); paint(); }); s.append(b); }); paint(); s.paint = paint; return s; };
  const segF = seg([['express', 'Express'], ['fastify', 'Fastify 5']], () => fw, (v) => { fw = v; sc = 'ok'; buildScen(); reset(); }, 'Framework');
  const segV = seg([[4, 'Express 4'], [5, 'Express 5']], () => ver, (v) => { ver = v; reset(); }, 'Express version');
  const scenHost = el('div');
  let segSc = null;
  function buildScen() {
    segSc = seg(Object.entries(S[fw]).map(([key, v]) => [key, v.label]), () => sc, (v) => { sc = v; reset(); }, 'Scenario');
    scenHost.innerHTML = ''; scenHost.append(segSc);
    segV.style.display = fw === 'express' ? '' : 'none';
  }
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3400, 'Slow'], [2200, 'Normal'], [1000, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const codeHost = el('div');
  const pipe = el('div', { class: 'w-ef-pipe' });
  const errLane = el('div', { class: 'w-ef-pipe' });
  const res = el('div', { class: 'w-ef-res' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, segF, segV), el('div', { class: 'w-controls' }, scenHost), codeHost,
    el('div', { class: 'w-ef-lane', text: 'request path' }), pipe, el('div', { class: 'w-ef-lane', text: 'error path' }), errLane, res,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  let nodes = {};
  function draw() {
    const cat = fw === 'express' ? EXN : FAN; const cur = S[fw][sc];
    const order = cur.order || (fw === 'express' ? EXO : FAO);
    pipe.innerHTML = ''; errLane.innerHTML = ''; nodes = {};
    const main = order.filter((id) => !cat[id][2]); const errs = order.filter((id) => cat[id][2]);
    main.forEach((id, i) => { if (i) pipe.append(el('span', { class: 'w-ef-ar', text: '→' }));
      nodes[id] = el('div', { class: 'w-ef-n' }, el('div', { class: 'l', text: cat[id][0] }), el('div', { class: 's', text: cat[id][1] })); pipe.append(nodes[id]); });
    errs.forEach((id) => { nodes[id] = el('div', { class: 'w-ef-n errh' }, el('div', { class: 'l', text: cat[id][0] }), el('div', { class: 's', text: cat[id][1] })); errLane.append(nodes[id]); });
    codeHost.innerHTML = ''; codeHost.append(ctx.codeBox(cur.code, 'js'));
  }
  function paintRes(r) {
    res.innerHTML = '';
    if (!r) { res.append(el('span', { class: 'tiny', text: 'response: not sent yet' })); return; }
    res.append(el('span', { class: 'tiny', text: 'response' }), el('span', { class: 'code ' + r.k, text: String(r.c) }), el('span', { class: 'body', text: r.b }));
  }
  function apply(upto) {
    Object.values(nodes).forEach((n) => n.classList.remove('done', 'skip', 'err', 'cur'));
    let r = null;
    for (let j = 0; j < upto; j++) { const [id, st, , rr] = steps[j]; const n = nodes[id]; if (n) n.classList.add(st); if (rr) r = rr; }
    if (upto > 0) { const n = nodes[steps[upto - 1][0]]; if (n) n.classList.add('cur'); say(steps[upto - 1][2]); }
    paintRes(r);
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    steps = S[fw][sc].steps(ver); draw(); apply(0); bStep.disabled = false;
    say(fw === 'express' ? `Express ${ver}. Middleware run top to bottom in registration order. Press Play or Step.` : 'Fastify 5: every request passes the same hook stages. The schema is compiled once at startup. Press Play or Step.');
  }
  function step() { if (k >= steps.length) return false; k++; apply(k); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { k = steps.length; apply(k); bStep.disabled = true; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  buildScen(); reset();
});
