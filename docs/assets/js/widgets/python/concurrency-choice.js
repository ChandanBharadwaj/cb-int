/* Concurrency choice: a walkable decision tree. Play/Step walks a preset workload's path node by
   node; "Decide yourself" lets the reader answer each question. Leaves show the why and the code shape. */
IA.widget('concurrency-choice', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-pycc-style')) {
    document.head.append(el('style', { id: 'w-pycc-style', text: `
.w-pycc .nd{fill:var(--surface);stroke:var(--border);stroke-width:1.5;transition:all .3s}
.w-pycc .nd.q{fill:var(--surface-2)}
.w-pycc .nd.on{stroke:var(--accent);stroke-width:3;fill:var(--accent-soft)}
.w-pycc .nd.cur{stroke:var(--warn);stroke-width:3.5}
.w-pycc .nd.leaf.on{stroke:var(--ok);fill:color-mix(in srgb,var(--ok) 16%,var(--surface))}
.w-pycc .eg{fill:none;stroke:var(--border);stroke-width:1.5;transition:all .3s}
.w-pycc .eg.on{stroke:var(--accent);stroke-width:3}
.w-pycc .el{font-size:9.5px;fill:var(--text-3)} .w-pycc .el.on{fill:var(--accent);font-weight:700}
.w-pycc .opts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
.w-pycc .leafcard{border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface-2);margin-top:10px}
.w-pycc .leafcard h4{margin:0 0 6px;font-size:15px}
.w-pycc .leafcard p{margin:0 0 8px;font-size:14px;color:var(--text-2)}
` }));
  }
  const N = {
    q1: { x: 320, y: 30, q: true, t: ['Where does the', 'time go?'], ask: 'Where does the time go: waiting on something external, or computing in Python?', opts: [['qio', 'Waiting (network, DB, disk)'], ['qcpu', 'Computing in Python / native code'], ['mixed', 'Both, inside one service']] },
    qio: { x: 120, y: 108, q: true, t: ['How many at once?', 'Async libs?'], ask: 'How many operations in flight at once, and do async libraries exist for what you call?', opts: [['thr', 'Tens; sync libraries or a sync framework'], ['aio', 'Hundreds to thousands; async clients available']] },
    qcpu: { x: 380, y: 108, q: true, t: ['Where is the', 'hot loop?'], ask: 'Where is the hot loop?', opts: [['qpure', 'Pure Python (parsing, loops, dict work)'], ['native', 'NumPy / PyTorch / native code that releases the GIL'], ['dist', 'Hours of work, needs retries or many machines']] },
    mixed: { x: 580, y: 108, leaf: true, t: ['asyncio edge +', 'bridges'] },
    thr: { x: 55, y: 190, leaf: true, t: ['ThreadPool', 'Executor'] },
    aio: { x: 175, y: 190, leaf: true, t: ['asyncio', 'TaskGroup'] },
    qpure: { x: 300, y: 190, q: true, t: ['Free-threaded', 'build usable?'], ask: 'Can you run a free-threaded build (3.13t+) with every dependency supporting it?', opts: [['ft', 'Yes, and we accept “experimental”'], ['proc', 'No / not yet (the usual answer)']] },
    native: { x: 420, y: 190, leaf: true, t: ['Threads /', 'library pools'] },
    dist: { x: 545, y: 190, leaf: true, t: ['Job queue /', 'distributed'] },
    ft: { x: 245, y: 268, leaf: true, t: ['Threads on', '3.13t'] },
    proc: { x: 365, y: 268, leaf: true, t: ['ProcessPool', 'Executor'] }
  };
  const EDGE_LABEL = { qio: 'waiting', qcpu: 'computing', mixed: 'both', thr: 'tens', aio: '100s+', qpure: 'pure Py', native: 'native', dist: 'big jobs', ft: 'yes', proc: 'no' };
  const LEAF = {
    thr: { title: 'ThreadPoolExecutor', why: 'Blocking I/O releases the GIL, so threads overlap their waits. Works with any sync library, no async rewrite. Keep the pool bounded and protect shared state with locks or queues.', code: 'with ThreadPoolExecutor(max_workers=16) as ex:\n    pages = list(ex.map(fetch_page, urls))', link: ['threading-multiprocessing.html', 'Threads vs processes'] },
    aio: { title: 'asyncio with TaskGroup + Semaphore', why: 'One thread handles thousands of sockets; tasks are cheap, cancellation and timeouts are built in. Requires async libraries all the way down and a loop that never blocks.', code: 'sem = asyncio.Semaphore(32)\nasync def one(x):\n    async with sem:\n        return await client.call(x)\n\nasync with asyncio.TaskGroup() as tg:\n    tasks = [tg.create_task(one(x)) for x in items]', link: ['asyncio.html', 'asyncio event loop'] },
    mixed: { title: 'asyncio at the edge, bridges for the rest', why: 'Serve requests on the loop; push blocking calls to threads and CPU work to processes, and await both so the loop stays free.', code: 'data = await asyncio.to_thread(legacy.fetch, key)\nloop = asyncio.get_running_loop()\nresult = await loop.run_in_executor(cpu_pool, analyze, data)', link: ['asyncio.html', 'asyncio event loop'] },
    native: { title: 'Threads (or the library’s own parallelism)', why: 'NumPy, BLAS, PyTorch and many native libraries release the GIL inside heavy operations, so threads run them in parallel without pickling. Often the library already parallelises internally: check before adding more workers.', code: 'model = load_model()            # one copy, shared\nwith ThreadPoolExecutor(4) as ex:\n    vecs = list(ex.map(model.encode, batches))', link: ['gil.html', 'The GIL & free-threading'] },
    dist: { title: 'A job queue or a distributed runtime', why: 'When work must survive restarts, be retried, scheduled or spread over machines, in-process pools aren’t enough. Use a broker-backed queue (Celery, RQ, Arq) or a cluster runtime (Ray, Dask), each worker using the right local model.', code: '@app.task(bind=True, max_retries=5, acks_late=True)\ndef embed_document(self, doc_id: str) -> None:\n    ...', link: ['threading-multiprocessing.html', 'Threads vs processes'] },
    ft: { title: 'Threads on a free-threaded build', why: 'PEP 703 builds run Python bytecode in parallel across threads: shared memory, no pickling. Experimental in 3.13, officially supported since 3.14; verify <code>sys._is_gil_enabled()</code> is False after importing your dependencies, and expect slower single-threaded code.', code: 'import sys\nassert not sys._is_gil_enabled()\nwith ThreadPoolExecutor(os.cpu_count()) as ex:\n    out = list(ex.map(parse_chunk, chunks))', link: ['gil.html', 'The GIL & free-threading'] },
    proc: { title: 'ProcessPoolExecutor', why: 'Each process has its own interpreter and GIL, so pure-Python CPU work scales across cores. Send small inputs (ids, paths), batch with <code>chunksize</code>, load big state once per worker with <code>initializer</code>, and guard the entry point.', code: 'if __name__ == "__main__":\n    with ProcessPoolExecutor() as ex:\n        counts = list(ex.map(parse_file, paths, chunksize=4))', link: ['threading-multiprocessing.html', 'Threads vs processes'] }
  };
  const PRESETS = {
    agent: { label: 'Agent: 300 tool calls', path: ['q1', 'qio', 'aio'], notes: ['An agent run fans out to search, retrieval and LLM APIs. Almost all of it is <b>waiting</b> on the network.', '300 concurrent calls, and the HTTP and LLM SDKs ship async clients.', 'asyncio: a TaskGroup for structure, a Semaphore for the provider’s rate limit, a timeout for the whole run.'] },
    cli: { label: 'CLI: fetch 20 URLs', path: ['q1', 'qio', 'thr'], notes: ['A command-line tool downloads 20 reports. It waits on the network.', 'Twenty requests with the sync <code>requests</code> library: no reason to colour the whole tool async.', 'A small thread pool gives the overlap with three lines of code.'] },
    logs: { label: 'Parse 2M log lines', path: ['q1', 'qcpu', 'qpure', 'proc'], notes: ['Regexes and dict updates over millions of lines: the CPU is the limit.', 'All of it is pure-Python bytecode, so the GIL serialises threads.', 'The production fleet runs the standard build.', 'A process pool, one file or chunk per task: real parallelism, small pickles.'] },
    embed: { label: 'Embed 1M chunks locally', path: ['q1', 'qcpu', 'native'], notes: ['Running a local embedding model is heavy computation.', 'But the hot loop is inside PyTorch/NumPy kernels, which release the GIL.', 'Threads (or simply bigger batches) share one model copy in memory; processes would load one copy each.'] },
    api: { label: 'FastAPI + sync SDK + PDFs', path: ['q1', 'mixed'], notes: ['An async API that also calls a legacy sync SDK and parses uploaded PDFs.', 'asyncio for serving; <code>to_thread</code> for the sync SDK; a process pool for parsing. Nothing heavy runs on the loop.'] },
    you: { label: 'Decide yourself', path: null }
  };
  let preset = 'agent', path = ['q1'], k = 1, gen = 0, running = false;
  const segP = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Workload' });
  Object.entries(PRESETS).forEach(([v, p]) => { const b = el('button', { text: p.label, class: v === preset ? 'on' : '' }); b.addEventListener('click', () => { preset = v; [...segP.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); segP.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 640 300', role: 'img', 'aria-label': 'Decision tree for choosing threads, processes or asyncio' });
  const opts = el('div', { class: 'opts' });
  const card = el('div');
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pycc');
  root.append(el('div', { class: 'w-controls' }, segP), el('div', { class: 'w-stage' }, stage), opts, card,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const W = 108, H = 40;
  const parentOf = {}; Object.entries(N).forEach(([id, n]) => (n.opts || []).forEach(([c]) => { parentOf[c] = id; }));
  function render() {
    const shown = path.slice(0, k); const curId = shown[shown.length - 1];
    stage.innerHTML = '';
    Object.keys(parentOf).forEach((c) => {
      const p = parentOf[c]; const a = N[p], b = N[c]; const on = shown.includes(c) && shown.includes(p);
      const x1 = a.x, y1 = a.y + H / 2, x2 = b.x, y2 = b.y - H / 2;
      stage.append(svg('path', { class: 'eg' + (on ? ' on' : ''), d: `M${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}` }),
        svg('text', { class: 'el' + (on ? ' on' : ''), x: (x1 + x2) / 2 + (x2 < x1 ? -4 : 4), y: (y1 + y2) / 2 + 3, 'text-anchor': x2 < x1 ? 'end' : x2 > x1 ? 'start' : 'middle', text: EDGE_LABEL[c] }));
    });
    Object.entries(N).forEach(([id, n]) => {
      const on = shown.includes(id);
      const cls = 'nd' + (n.q ? ' q' : ' leaf') + (on ? ' on' : '') + (id === curId && n.q ? ' cur' : '');
      stage.append(svg('rect', { class: cls, x: n.x - W / 2, y: n.y - H / 2, width: W, height: H, rx: n.q ? 8 : 18 }));
      n.t.forEach((line, i) => stage.append(svg('text', { x: n.x, y: n.y - 3 + i * 13, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': n.leaf ? 700 : 500, fill: 'var(--text)', text: line })));
    });
    stage.append(svg('text', { x: 8, y: 296, 'font-size': 10, fill: 'var(--text-3)', text: 'rounded = recommendation · square = question' }));
    // options for "decide yourself"
    opts.innerHTML = '';
    const node = N[curId];
    if (preset === 'you' && node.q) {
      opts.append(el('div', { class: 'tiny', style: { width: '100%' }, text: node.ask }));
      node.opts.forEach(([c, l]) => { const b = el('button', { class: 'btn', text: l }); b.addEventListener('click', () => { path = path.slice(0, k).concat([c]); k = path.length; render(); }); opts.append(b); });
    }
    card.innerHTML = '';
    if (node.leaf) {
      const L = LEAF[curId];
      card.append(el('div', { class: 'leafcard' }, el('h4', { html: '✓ ' + L.title }), el('p', { html: L.why }), ctx.codeBox ? ctx.codeBox(L.code, 'python') : el('pre', { text: L.code }),
        el('p', { style: { marginTop: '8px' }, html: `More: <a href="${L.link[0]}">${L.link[1]}</a>` })));
    }
    narr.innerHTML = '';
    const P = PRESETS[preset];
    const txt = P.path ? P.notes[k - 1] : node.q ? `<b>${node.ask}</b> Click an answer above.` : 'Done. Press <b>Reset</b> to try another path.';
    narr.append(el('div', { class: 'n', text: P.path ? `${k}/${P.path.length}` : `${k}` }), el('div', { class: 't', html: txt }));
    bStep.disabled = !P.path || k >= P.path.length;
    bPlay.disabled = !P.path;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); const P = PRESETS[preset]; path = P.path ? P.path.slice() : ['q1']; k = 1; render(); }
  function step() { const P = PRESETS[preset]; if (!P.path || k >= P.path.length) return false; k++; render(); return k < P.path.length; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    const P = PRESETS[preset]; if (!P.path) return;
    if (k >= P.path.length) { k = 1; render(); }
    if (reduced) { k = P.path.length; render(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    await sleep(1200);
    while (running && g === gen) { if (!step()) break; await sleep(2600); }
    if (g === gen) stop();
  });
  reset();
});
