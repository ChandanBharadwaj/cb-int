/* Files, modules & stdlib: step through what import does (sys.modules, sys.path), a with-open write/flush/read cycle, and a venv + pip install. */
(function () {
  /* Shared step-through shell for the Python Basics widgets.
     S = [{ label, lang?, code: [lines], intro?, steps: [{ line: n | [n], cap, out?, st }] }]
     renderState(st, scenario) returns an HTML string for the state panel. */
  function pybStepper(root, ctx, S, renderState, opt) {
    const { el, sleep, reduced } = ctx;
    opt = opt || {};
    if (!document.getElementById('w-pyb-base')) {
      document.head.append(el('style', { id: 'w-pyb-base', text: `
.pyb .code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.pyb .code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent;min-height:1.55em}
.pyb .code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.pyb .out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.pyb .out .err{color:var(--err)}
.pyb .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.pyb .grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:12px;align-items:start}
@media (max-width:720px){.pyb .grid{grid-template-columns:1fr}}
.pyb .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:2px 0}
.pyb .cell{font-family:var(--mono);font-size:12.5px;padding:3px 9px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)}
.pyb .cell.hot{border-color:var(--accent);background:var(--accent-soft)}
.pyb .cell.ok{border-color:var(--ok)}
.pyb .cell.bad{border-color:var(--err);color:var(--err)}
.pyb .cell.dim{opacity:.45}
.pyb .cell.new{animation:capin .35s ease both}
.pyb .box{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface-2);margin-bottom:8px}
.pyb .box.hot{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.pyb .box.miss{border-style:dashed;opacity:.75}
.pyb .box.bad{border-color:var(--err)}
.pyb .box h5{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)}
.pyb .kv{font-family:var(--mono);font-size:12.5px;color:var(--text);padding:1px 0}
.pyb .kv b{color:var(--accent)}
.pyb .kv.hot{background:var(--accent-soft);border-radius:4px}
.pyb .note{font-size:12.5px;color:var(--text-2)}
.pyb .pillx{display:inline-block;font-family:var(--mono);font-size:12px;padding:2px 10px;border-radius:999px;border:1px solid var(--border);color:var(--text-3)}
.pyb .pillx.live{border-color:var(--err);color:var(--err);background:color-mix(in srgb,var(--err) 10%,transparent)}
.pyb .pillx.ok{border-color:var(--ok);color:var(--ok)}
.pyb .arrow{color:var(--text-3);font-family:var(--mono)}
` }));
    }
    root.classList.add('pyb');
    let si = 0; let k = 0; let running = false; let gen = 0;
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': opt.segLabel || 'Scenario' });
    S.forEach((s, i) => { const b = el('button', { text: s.label, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { si = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); seg.append(b); });
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const counter = el('span', { class: 'tiny' });
    const codeHost = el('div', { class: 'code' });
    const stateHost = el('div');
    const outHost = el('div', { class: 'out', 'aria-live': 'polite' });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
    root.append(el('div', { class: 'w-controls' }, seg),
      el('div', { class: 'grid' },
        el('div', null, el('div', { class: 'lbl', text: 'code' }), codeHost, el('div', { class: 'lbl', text: 'output (stdout)' }), outHost),
        el('div', null, el('div', { class: 'lbl', text: opt.stateLabel || 'what Python holds' }), stateHost)),
      el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, counter), narr);
    function render() {
      const s = S[si]; const st = k ? s.steps[k - 1] : null;
      const on = st ? [].concat(st.line == null ? [] : st.line) : [];
      codeHost.innerHTML = '';
      s.code.forEach((ln, i) => codeHost.append(el('div', { class: on.includes(i) ? 'on' : '', html: ln ? IA.highlight(ln, s.lang || 'python') : ' ' })));
      const outs = []; for (let i = 0; i < k; i++) if (s.steps[i].out != null) outs.push(s.steps[i]);
      outHost.innerHTML = outs.map((o) => o.err ? '<span class="err">' + ctx.esc(o.out) + '</span>' : ctx.esc(o.out)).join('\n');
      stateHost.innerHTML = renderState(st ? st.st : (s.init || {}), s, k);
      narr.firstChild.innerHTML = st ? st.cap : (s.intro || 'Press <b>Play</b> or <b>Step</b> to run the code one line at a time.');
      counter.textContent = `step ${k} / ${s.steps.length}`;
      bStep.disabled = k >= s.steps.length;
    }
    function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; render(); }
    function step() { if (k >= S[si].steps.length) return false; k++; render(); return true; }
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (reduced) { k = S[si].steps.length; render(); return; }
      if (k >= S[si].steps.length) reset();
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && step()) await sleep(1900);
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    reset();
  }
  IA.widget('files-modules-stdlib', (root, ctx) => {
    const e = ctx.esc;
    const S = [
      { label: 'import', code: ['import json                  # first time in this process', 'import json                  # again: cached, nothing re-runs', 'from pathlib import Path     # bind one name from a module', 'import helpers               # your own helpers.py', '', 'print(json.dumps({"ok": True}))'],
        steps: [
          { line: 0, cap: '<code>import json</code> first checks <code>sys.modules</code>, the process-wide cache of loaded modules. Not there yet.', st: { mods: ['sys', 'builtins', '…'], look: 'json', glob: [], phase: 'cache miss' } },
          { line: 0, cap: 'Python searches <code>sys.path</code> in order: the script’s folder, then the standard library, then <code>site-packages</code> (where pip installs). It finds the stdlib <code>json</code> package.', st: { mods: ['sys', 'builtins', '…'], look: 'json', path: 1, glob: [], phase: 'search sys.path' } },
          { line: 0, cap: 'It <b>runs the module’s code</b> once, top to bottom, stores the module object in <code>sys.modules</code> and binds the name <code>json</code> in <i>your</i> namespace.', st: { mods: ['sys', 'builtins', '…', 'json'], hotMod: 'json', glob: ['json'], phase: 'execute + cache + bind' } },
          { line: 1, cap: 'The second import is a dictionary lookup: found in the cache, nothing runs again. Module top-level code runs <b>once per process</b>, a bit like a Java static initialiser.', st: { mods: ['sys', 'builtins', '…', 'json'], hotMod: 'json', glob: ['json'], phase: 'cache hit' } },
          { line: 2, cap: '<code>from pathlib import Path</code> still loads the whole <code>pathlib</code> module, but binds only the name <code>Path</code> in your namespace. Closest to Java’s <code>import java.nio.file.Path;</code>.', st: { mods: ['sys', 'builtins', '…', 'json', 'pathlib'], hotMod: 'pathlib', glob: ['json', 'Path'], phase: 'bind one name' } },
          { line: 3, cap: 'Your own file <code>helpers.py</code> next to the script is a module too, found via <code>sys.path[0]</code>. Naming your file <code>json.py</code> would <b>shadow</b> the stdlib one: a classic beginner trap.', st: { mods: ['sys', 'builtins', '…', 'json', 'pathlib', 'helpers'], hotMod: 'helpers', path: 0, glob: ['json', 'Path', 'helpers'], phase: 'found in script folder' } },
          { line: 5, cap: 'Use the module through its name: <code>json.dumps</code>. Python’s <code>True</code> becomes JSON’s <code>true</code>.', out: '{"ok": true}', st: { mods: ['sys', 'builtins', '…', 'json', 'pathlib', 'helpers'], glob: ['json', 'Path', 'helpers'], phase: 'use it' } }
        ] },
      { label: 'with open', code: ['import json', 'from pathlib import Path', '', 'p = Path("out") / "order.json"', 'p.parent.mkdir(parents=True, exist_ok=True)', 'with open(p, "w", encoding="utf-8") as f:', '    json.dump({"id": 7, "qty": 2}, f)', '# f is closed here, even if dump raised', 'data = json.loads(p.read_text(encoding="utf-8"))', 'print(data["qty"] * 2)'],
        steps: [
          { line: 3, cap: '<code>Path("out") / "order.json"</code>: pathlib overloads <code>/</code> to join paths. It is <code>Path.of("out").resolve("order.json")</code> in Java.', st: { path: 'out/order.json', disk: null, handle: 'none', buf: '' } },
          { line: 4, cap: 'Create the folder if missing; <code>exist_ok=True</code> means “don’t fail if it’s already there”.', st: { path: 'out/order.json', disk: '', dir: true, handle: 'none', buf: '' } },
          { line: 5, cap: '<code>open(p, "w")</code> opens for writing and <b>truncates</b> the file to empty. Always pass <code>encoding="utf-8"</code>: the default depends on the OS locale.', st: { path: 'out/order.json', disk: '', dir: true, handle: 'open (w)', buf: '' } },
          { line: 6, cap: '<code>json.dump</code> writes text into the file object. It sits in an in-memory <b>buffer</b> first; the file on disk may still be empty.', st: { path: 'out/order.json', disk: '', dir: true, handle: 'open (w)', buf: '{"id": 7, "qty": 2}' } },
          { line: 7, cap: 'Leaving the <code>with</code> block calls <code>f.close()</code>, which <b>flushes</b> the buffer to disk. Same guarantee as Java’s try-with-resources.', st: { path: 'out/order.json', disk: '{"id": 7, "qty": 2}', dir: true, handle: 'closed', buf: '', flushed: true } },
          { line: 8, cap: '<code>read_text</code> opens, reads and closes in one call. <code>json.loads</code> turns the string into a Python <code>dict</code>.', st: { path: 'out/order.json', disk: '{"id": 7, "qty": 2}', dir: true, handle: 'closed', buf: '', data: "{'id': 7, 'qty': 2}" } },
          { line: 9, cap: 'Numbers come back as <code>int</code>. (CSV is different: every field comes back as a string.)', out: '4', st: { path: 'out/order.json', disk: '{"id": 7, "qty": 2}', dir: true, handle: 'closed', buf: '', data: "{'id': 7, 'qty': 2}" } }
        ] },
      { label: 'venv & pip', lang: 'bash', code: ['python3 -m venv .venv          # create an isolated env', 'source .venv/bin/activate      # Windows: .venv\\Scripts\\activate', 'pip install requests           # goes into .venv only', 'python -c "import requests"     # found', 'deactivate'],
        steps: [
          { line: 0, cap: '<code>venv</code> creates a folder with its own <code>python</code> (a link to the base interpreter) and an empty <code>site-packages</code>. Think: a per-project <code>~/.m2</code>.', st: { env: 'created', active: false, pkgs: [] } },
          { line: 1, cap: 'Activating puts <code>.venv/bin</code> first on <code>PATH</code>, so <code>python</code> and <code>pip</code> now mean the venv’s. (You can skip activation and call <code>.venv/bin/python</code> directly.)', st: { env: 'created', active: true, pkgs: [] } },
          { line: 2, cap: '<code>pip install</code> downloads from PyPI and unpacks into the venv’s <code>site-packages</code>. The system Python is untouched.', st: { env: 'created', active: true, pkgs: ['requests', 'urllib3', 'idna', 'certifi', 'charset-normalizer'], fresh: true } },
          { line: 3, cap: '<code>import requests</code> works because the venv’s <code>site-packages</code> is on this interpreter’s <code>sys.path</code>. Record versions in <code>requirements.txt</code> or <code>pyproject.toml</code> so others can rebuild the same env.', st: { env: 'created', active: true, pkgs: ['requests', 'urllib3', 'idna', 'certifi', 'charset-normalizer'] } },
          { line: 4, cap: '<code>deactivate</code> restores <code>PATH</code>. The packages stay in <code>.venv</code>; add <code>.venv/</code> to <code>.gitignore</code>.', st: { env: 'created', active: false, pkgs: ['requests', 'urllib3', 'idna', 'certifi', 'charset-normalizer'] } }
        ] }
    ];
    function renderState(st, s) {
      let h = '';
      if (s.label === 'import') {
        h += `<div class="box"><h5>sys.modules (cache)</h5><div class="row">${(st.mods || ['sys', 'builtins', '…']).map((m) => `<span class="cell ${m === st.hotMod ? 'hot new' : ''}">${e(m)}</span>`).join('')}</div>${st.look ? `<div class="note">looking for <code>${e(st.look)}</code></div>` : ''}</div>`;
        h += `<div class="box"><h5>sys.path (search order)</h5>${['[0] script folder', '[1] stdlib (…/lib/python3.12)', '[2] site-packages (pip)'].map((p, i) => `<div class="kv ${st.path === i ? 'hot' : ''}">${e(p)}</div>`).join('')}</div>`;
        h += `<div class="box hot"><h5>your module’s names</h5><div class="row">${(st.glob || []).length ? st.glob.map((g) => `<span class="cell ok">${e(g)}</span>`).join('') : '<span class="note">(none yet)</span>'}</div></div>`;
        if (st.phase) h += `<div class="note">step: <b>${e(st.phase)}</b></div>`;
      } else if (s.label === 'with open') {
        h += `<div class="box ${st.handle && st.handle.startsWith('open') ? 'hot' : ''}"><h5>file object f</h5><span class="pillx ${st.handle && st.handle.startsWith('open') ? 'live' : st.handle === 'closed' ? 'ok' : ''}">${e(st.handle || 'none')}</span><div class="kv">buffer: <b>${st.buf ? e(st.buf) : '(empty)'}</b></div></div>`;
        h += `<div class="box ${st.flushed ? 'hot' : ''}"><h5>disk: ${e(st.path || '')}</h5><div class="kv">${st.dir ? 'out/ exists' : 'out/ missing'}</div><div class="kv">${st.disk == null ? '(no file)' : st.disk === '' ? '(empty file)' : '<b>' + e(st.disk) + '</b>'}</div>${st.flushed ? '<div class="note">flushed on close</div>' : ''}</div>`;
        if (st.data) h += `<div class="box"><h5>data (dict)</h5><div class="kv">${e(st.data)}</div></div>`;
      } else {
        h += `<div class="box"><h5>PATH</h5><div class="kv ${st.active ? 'hot' : ''}">${st.active ? '<b>./.venv/bin</b>:' : ''}/usr/local/bin:/usr/bin</div><div class="note">python → ${st.active ? '.venv/bin/python' : 'system python3'}</div></div>`;
        h += `<div class="box"><h5>system site-packages</h5><div class="note">(untouched)</div></div>`;
        h += `<div class="box ${st.active ? 'hot' : ''}"><h5>.venv/lib/python3.12/site-packages</h5><div class="row">${(st.pkgs || []).length ? st.pkgs.map((p, i) => `<span class="cell ${i === 0 ? 'ok' : 'dim'} ${st.fresh ? 'new' : ''}">${e(p)}</span>`).join('') : '<span class="note">(empty)</span>'}</div>${(st.pkgs || []).length ? '<div class="note">requests plus its dependencies</div>' : ''}</div>`;
      }
      return h;
    }
    pybStepper(root, ctx, S, renderState, { segLabel: 'Mechanism' });
  });
})();
