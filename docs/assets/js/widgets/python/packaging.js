/* Packaging: (1) how `python` and `import` resolve inside a venv (PATH → bin/python → pyvenv.cfg → sys.prefix → sys.path),
   (2) one week of a dependency release with ranges only vs a lockfile. */
IA.widget('packaging', (root, ctx) => {
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
  if (!document.getElementById('w-pypk-style')) {
    document.head.append(el('style', { id: 'w-pypk-style', text: `
.w-pypk .ln{display:flex;gap:10px;padding:1px 12px;white-space:pre;border-left:3px solid transparent;font-family:var(--mono);font-size:12px;transition:background .3s}
.w-pypk .ln .c{color:var(--text-3)}
.w-pypk .ln.on{background:var(--accent-soft);border-left-color:var(--accent)}
.w-pypk .ln.hit{background:color-mix(in srgb,var(--ok) 16%,transparent);border-left-color:var(--ok)}
.w-pypk .ln.miss{opacity:.55}
.w-pypk .ln.miss .p::after{content:'  ✗';color:var(--err)}
.w-pypk .ln.hit .p::after{content:'  ✓ found';color:var(--ok)}
.w-pypk .ln.off{text-decoration:line-through;opacity:.45}
.w-pypk .ln.bad{background:color-mix(in srgb,var(--err) 14%,transparent);border-left-color:var(--err)}
.w-pypk .box{fill:var(--surface);stroke:var(--border);stroke-width:1.5;transition:stroke .3s,fill .3s}
.w-pypk .box.on{stroke:var(--accent);stroke-width:2.5;fill:var(--accent-soft)}
.w-pypk .box.ok{stroke:var(--ok);stroke-width:2.5}
.w-pypk .box.err{stroke:var(--err);stroke-width:2.5;fill:color-mix(in srgb,var(--err) 10%,transparent)}
.w-pypk .ar{fill:none;stroke:var(--edge);stroke-width:2}
.w-pypk .ar.on{stroke:var(--accent)}
.w-pypk .term{font-family:var(--mono);font-size:12.5px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:8px 12px;min-height:3em;white-space:pre-wrap}
.w-pypk .term .cmd{color:var(--accent)}
.w-pypk .kv{font-family:var(--mono);font-size:12px;display:grid;grid-template-columns:auto 1fr;gap:2px 10px}
.w-pypk .kv .v{color:var(--text);overflow-wrap:anywhere}
` }));
  }

  /* ---------- story A: venv & imports ---------- */
  const FS = [
    ['/usr/local/bin/python3.12', 'base interpreter'],
    ['/usr/local/lib/python3.12/', 'stdlib: json, asyncio, …'],
    ['/usr/local/lib/python3.12/site-packages/', 'global packages'],
    ['~/app/.venv/pyvenv.cfg', 'home = /usr/local/bin'],
    ['~/app/.venv/bin/python', '→ /usr/local/bin/python3.12 (symlink)'],
    ['~/app/.venv/bin/pip, uvicorn', '#!/home/me/app/.venv/bin/python'],
    ['~/app/.venv/lib/python3.12/site-packages/', 'httpx/, pydantic/ …'],
    ['~/app/main.py', 'your script'],
    ['~/app/httpx.py', 'a scratch file (!)']
  ];
  const SP = [
    ['/home/me/app', 'script directory'],
    ['/usr/local/lib/python312.zip', 'stdlib (zipped, usually absent)'],
    ['/usr/local/lib/python3.12', 'stdlib'],
    ['/usr/local/lib/python3.12/lib-dynload', 'stdlib C extensions'],
    ['/usr/local/lib/python3.12/site-packages', 'global: left out'],
    ['/home/me/app/.venv/lib/python3.12/site-packages', 'the venv’s packages']
  ];
  const A = [
    { term: '$ python3.12 -m venv .venv', fs: { 3: 'on', 4: 'on', 5: 'on', 6: 'on' }, cap: 'Creating a venv writes three things: <code>pyvenv.cfg</code>, a <code>bin/</code> with a link to the base interpreter, and an <b>empty</b> <code>site-packages</code>. Nothing from the standard library is copied.' },
    { term: '$ source .venv/bin/activate', kv: { PATH: '/home/me/app/.venv/bin:/usr/local/bin:…', VIRTUAL_ENV: '/home/me/app/.venv' }, cap: 'Activation is a shell script that <b>prepends <code>.venv/bin</code> to PATH</b> and sets <code>VIRTUAL_ENV</code>. That is all it does.' },
    { term: '(.venv) $ pip install httpx', fs: { 5: 'on', 6: 'hit' }, kv: { PATH: '/home/me/app/.venv/bin:/usr/local/bin:…', 'pip →': '.venv/bin/pip' }, cap: 'The shell finds <code>pip</code> in <code>.venv/bin</code> first. That pip belongs to the venv’s interpreter, so it installs into the venv’s <code>site-packages</code>.' },
    { term: '(.venv) $ python main.py', fs: { 4: 'on', 0: 'on' }, kv: { 'python →': '.venv/bin/python → /usr/local/bin/python3.12' }, cap: 'The same lookup finds <code>.venv/bin/python</code>, which is a link to the real interpreter. The binary is the base one; what changes is <i>where it thinks it lives</i>.' },
    { term: '(.venv) $ python main.py', fs: { 3: 'on' }, kv: { 'sys.executable': '/home/me/app/.venv/bin/python', 'sys.prefix': '/home/me/app/.venv', 'sys.base_prefix': '/usr/local' }, cap: 'At startup the interpreter looks for <code>pyvenv.cfg</code> next to its executable (or one level up). Found: <code>sys.prefix</code> becomes the venv, and <code>home</code> tells it where the standard library is.' },
    { term: '(.venv) $ python main.py', sp: { 0: 'on', 1: 'on', 2: 'on', 3: 'on', 4: 'off', 5: 'on' }, fs: { 2: 'off' }, cap: '<code>sys.path</code> is built: script directory, the base standard library, then the <b>venv’s</b> <code>site-packages</code>. The global one is left out (unless the venv was made with <code>--system-site-packages</code>).' },
    { term: '>>> import json', sp: { 0: 'miss', 1: 'miss', 2: 'hit', 4: 'off' }, fs: { 1: 'hit' }, cap: '<code>import</code> walks <code>sys.path</code> <b>in order</b> and takes the first match. <code>json</code> is found in the standard library, shared with the base install.' },
    { term: '>>> import httpx', sp: { 0: 'miss', 1: 'miss', 2: 'miss', 3: 'miss', 4: 'off', 5: 'hit' }, fs: { 6: 'hit' }, cap: '<code>httpx</code> is only in the venv’s <code>site-packages</code>, the last entry. Another project’s venv could hold a different version, and neither sees the other.' },
    { term: '$ touch httpx.py   # a quick experiment\n>>> import httpx\nAttributeError: module \'httpx\' has no attribute \'Client\'', shadow: true, sp: { 0: 'hit', 4: 'off' }, fs: { 8: 'bad' }, cap: 'Shadowing: the script’s directory is <b>first</b> on <code>sys.path</code>, so a local <code>httpx.py</code> (or <code>random.py</code>, <code>logging.py</code>) wins over the real package. Never name files after modules you import.' },
    { term: '$ /home/me/app/.venv/bin/python main.py    # cron, Docker, systemd', fs: { 4: 'on', 3: 'on' }, sp: { 0: 'on', 2: 'on', 3: 'on', 4: 'off', 5: 'on' }, kv: { 'sys.prefix': '/home/me/app/.venv', PATH: 'unchanged (no activation)' }, cap: 'Calling the venv’s interpreter by absolute path gives exactly the same environment, because it is the location of the executable that matters. This is how cron jobs and containers should run Python.' }
  ];

  /* ---------- story B: ranges vs lockfile ---------- */
  const B = [
    { day: 0, cap: (L) => 'Monday. <code>pyproject.toml</code> says <code>httpx&gt;=0.27</code>. The resolver picks the newest matching release, <b>0.27.2</b>, and the tests pass on the dev laptop.' + (L ? '' : ' Nothing records that choice.') },
    { day: 0, lockStep: true, cap: (L) => L ? '<code>uv lock</code> writes <code>uv.lock</code>: httpx <b>==0.27.2</b> plus every transitive package (httpcore, h11, anyio…), each with its sha256 hash. The lock is committed with the code.' : 'No lockfile. The only record of “what we tested” is the range <code>&gt;=0.27</code>, which also matches every future release.' },
    { day: 3, release: true, cap: () => 'Thursday. <b>httpx 0.28.0</b> is published on PyPI. Its changelog removes the deprecated <code>proxies=</code> argument, which our client still uses. No one on the team changes anything.' },
    { day: 4, ci: true, cap: (L) => L ? 'Friday, a one-line config change triggers a build. <code>uv sync --locked</code> installs exactly what the lock says: <b>0.27.2</b>, and checks each file’s hash.' : 'Friday, a one-line config change triggers a build. <code>pip install .</code> resolves the range <b>again</b>, and today the newest match is <b>0.28.0</b>.' },
    { day: 4, ci: true, prod: true, cap: (L) => L ? 'Deploy: prod runs the same bytes that passed CI. Green.' : 'Deploy: every outbound call fails with <code>TypeError: Client.__init__() got an unexpected keyword argument \'proxies\'</code>. Rollback, incident, postmortem.' },
    { day: 4, ci: true, prod: true, upgrade: true, cap: (L) => L ? 'Upgrades become deliberate: <code>uv lock --upgrade-package httpx</code> produces a reviewed lockfile diff (0.27.2 → 0.28.1). CI fails <b>in the PR</b>, someone renames <code>proxies=</code> to <code>proxy=</code>, and it merges.' : 'The fix: commit a lockfile and install from it with <code>--locked</code>. For 0.x libraries also cap the range (<code>&lt;0.28</code>), since minor releases may break APIs. Switch the toggle to <b>uv.lock</b> and play again.' }
  ];

  let story = 'A', lock = false, k = 0, gen = 0, running = false;
  const seg = (opts, cur, on) => { const s = el('div', { class: 'seg', role: 'radiogroup' }); opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segStory = seg([['A', 'venv & imports'], ['B', 'Ranges vs lockfile']], story, (v) => { story = v; segLock.style.display = v === 'B' ? '' : 'none'; reset(); });
  const segLock = seg([[false, 'no lockfile'], [true, 'uv.lock']], lock, (v) => { lock = v; reset(); });
  segLock.style.display = 'none';
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const host = el('div');
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pypk');
  root.append(el('div', { class: 'w-controls' }, segStory, segLock), host, el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const steps = () => (story === 'A' ? A : B);

  function renderA(cur) {
    host.innerHTML = '';
    const term = el('div', { class: 'term' });
    const lines = cur ? cur.term.split('\n') : ['$ cd ~/app'];
    lines.forEach((t, i) => term.append(el('div', { class: i === 0 ? 'cmd' : '', text: t })));
    const fs = el('div', { class: 'wpy-code' });
    FS.forEach(([p, c], i) => { if (i === 8 && !(cur && cur.shadow)) return; const st = cur && cur.fs ? cur.fs[i] || '' : ''; fs.append(el('div', { class: 'ln ' + st }, el('span', { class: 'p', text: p }), el('span', { class: 'c', text: c }))); });
    const sp = el('div', { class: 'wpy-code' });
    const showSp = cur && cur.sp;
    SP.forEach(([p, c], i) => { const st = showSp ? cur.sp[i] || '' : 'miss0'; sp.append(el('div', { class: 'ln ' + (st === 'miss0' ? '' : st), style: { opacity: showSp ? null : '.35' } }, el('span', { class: 'p', text: `${i}  ${p}` }), el('span', { class: 'c', text: c }))); });
    const kv = el('div', { class: 'kv' });
    const vals = cur && cur.kv ? cur.kv : { PATH: '/usr/local/bin:/usr/bin:…' };
    Object.entries(vals).forEach(([a, b]) => kv.append(el('span', { text: a }), el('span', { class: 'v', text: b })));
    host.append(el('div', { class: 'wpy-lbl', text: 'terminal' }), term,
      el('div', { class: 'wpy-grid', style: { gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' } },
        el('div', null, el('div', { class: 'wpy-lbl', text: 'files on disk' }), fs, el('div', { class: 'wpy-lbl', text: 'process state' }), kv),
        el('div', null, el('div', { class: 'wpy-lbl', text: 'sys.path (searched top to bottom)' }), sp)));
  }

  function renderB(cur, idx) {
    host.innerHTML = '';
    const st = svg('svg', { viewBox: '0 0 640 300', role: 'img', 'aria-label': 'Timeline of httpx releases and what dev, the lockfile, CI and prod have installed' });
    const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12.5, fill: 'var(--text)', text: t }, o || {}));
    // timeline
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    st.append(T(16, 22, 'PyPI: httpx releases', { 'font-weight': 700, 'font-size': 13 }), svg('line', { x1: 40, y1: 56, x2: 610, y2: 56, stroke: 'var(--border)', 'stroke-width': 2 }));
    days.forEach((d, i) => { const x = 110 + i * 120; st.append(svg('line', { x1: x, y1: 50, x2: x, y2: 62, stroke: 'var(--border)', 'stroke-width': 2 }), T(x, 78, d, { 'text-anchor': 'middle', fill: cur && cur.day === i ? 'var(--accent)' : 'var(--text-3)', 'font-weight': cur && cur.day === i ? 700 : 400 })); });
    st.append(svg('circle', { cx: 60, cy: 56, r: 7, fill: 'var(--ok)' }), T(60, 42, '0.27.2', { 'text-anchor': 'middle', 'font-family': 'var(--mono)', 'font-size': 11.5 }));
    const released = steps().slice(0, idx).some((s) => s.release);
    if (released) {
      const g = svg('g'); g.append(svg('circle', { cx: 470, cy: 56, r: 8, fill: 'var(--err)' }), T(470, 40, '0.28.0: removes proxies=', { 'text-anchor': 'middle', 'font-family': 'var(--mono)', 'font-size': 11.5, fill: 'var(--err)' }));
      if (!reduced && cur && cur.release) { g.style.opacity = '0'; g.style.transition = 'opacity .8s'; requestAnimationFrame(() => requestAnimationFrame(() => { g.style.opacity = '1'; })); }
      st.append(g);
    }
    // boxes
    const seen = (f) => steps().slice(0, idx).some((s) => s[f]);
    const boxes = [
      { x: 16, t: 'dev laptop (Mon)', l1: idx ? 'httpx 0.27.2' : '…', l2: idx ? 'tests ✓' : '', cls: cur && idx === 1 ? 'on' : idx ? 'ok' : '' },
      { x: 172, t: lock ? 'uv.lock (committed)' : 'lockfile', l1: seen('lockStep') ? (lock ? 'httpx==0.27.2' : '(none)') : '…', l2: seen('lockStep') ? (lock ? 'sha256:9b3c…' : 'only ">=0.27"') : '', cls: cur && cur.lockStep ? 'on' : seen('lockStep') ? (lock ? 'ok' : 'err') : '' },
      { x: 328, t: 'CI image (Fri)', l1: seen('ci') ? (lock ? 'httpx 0.27.2' : 'httpx 0.28.0') : '…', l2: seen('ci') ? (lock ? 'uv sync --locked' : 'pip install .') : '', cls: seen('ci') ? (cur && cur.ci && !cur.prod ? 'on' : lock ? 'ok' : 'err') : '' },
      { x: 484, t: 'prod', l1: seen('prod') ? (lock ? 'same bytes as CI' : 'TypeError: proxies') : '…', l2: seen('prod') ? (lock ? 'healthy ✓' : '5xx on every call') : '', cls: seen('prod') ? (lock ? 'ok' : 'err') : '' }
    ];
    boxes.forEach((b, i) => {
      st.append(svg('rect', { class: 'box ' + b.cls, x: b.x, y: 110, width: 140, height: 92, rx: 12 }),
        T(b.x + 10, 132, b.t, { 'font-weight': 700, 'font-size': 12 }),
        T(b.x + 10, 158, b.l1, { 'font-family': 'var(--mono)', 'font-size': 11.5, fill: b.cls === 'err' ? 'var(--err)' : 'var(--text)' }),
        T(b.x + 10, 180, b.l2, { 'font-family': 'var(--mono)', 'font-size': 11, fill: 'var(--text-3)' }));
      if (i < 3) st.append(svg('path', { class: 'ar' + (b.cls ? ' on' : ''), d: `M${b.x + 142} 156 L ${b.x + 154} 156` }), svg('polygon', { points: `${b.x + 156},156 ${b.x + 150},152 ${b.x + 150},160`, fill: 'var(--edge)' }));
    });
    // pyproject + upgrade line
    st.append(T(16, 232, 'pyproject.toml:', { 'font-weight': 700, 'font-size': 12 }), T(122, 232, 'dependencies = ["httpx>=0.27"]', { 'font-family': 'var(--mono)', 'font-size': 12 }));
    if (cur && cur.upgrade) st.append(T(16, 262, lock ? 'PR #812: uv.lock  httpx 0.27.2 → 0.28.1   CI ✗ → fix proxies= → proxy= → CI ✓ → merge' : 'fix: commit a lock, install with --locked, cap 0.x ranges: "httpx>=0.27,<0.28"', { 'font-family': 'var(--mono)', 'font-size': 11.5, fill: lock ? 'var(--ok)' : 'var(--warn)' }));
    host.append(el('div', { class: 'w-stage' }, st));
  }

  function render() {
    const S = steps(); const cur = k ? S[k - 1] : null;
    if (story === 'A') renderA(cur); else renderB(cur, k);
    narr.innerHTML = '';
    const cap = cur ? (typeof cur.cap === 'function' ? cur.cap(lock) : cur.cap) : (story === 'A' ? 'A fresh shell in <code>~/app</code>. Press <b>Play</b> or <b>Step</b> to create a venv and follow <code>python</code> and <code>import</code> to the files they use.' : `Lock mode: <b>${lock ? 'uv.lock' : 'no lockfile'}</b>. Press <b>Play</b> to replay the week.`);
    narr.append(el('div', { class: 'n', text: `${k}/${S.length}` }), el('div', { class: 't', html: cap }));
    narr.className = 'caption' + (story === 'B' && cur && cur.prod ? (lock ? ' ok' : ' err') : '');
    bStep.disabled = k >= S.length;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; render(); }
  function step() { if (k >= steps().length) return false; k++; render(); return k < steps().length; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= steps().length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 3000); }
    if (g === gen) stop();
  });
  reset();
});
