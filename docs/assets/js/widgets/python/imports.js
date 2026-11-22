/* Import system: one import statement, step by step. sys.modules cache → meta_path finders →
   PathFinder walking sys.path (first match wins) → module cached BEFORE it executes → name bound.
   Scenarios: first import, cached import, stdlib shadowing, circular import. */
IA.widget('imports', (root, ctx) => {
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
  if (!document.getElementById('w-pyimp-style')) {
    document.head.append(el('style', { id: 'w-pyimp-style', text: `
.w-pyimp .pn{fill:var(--surface-2);stroke:var(--border)}
.w-pyimp .bx{fill:var(--surface);stroke:var(--border);stroke-width:1.5;transition:all .3s}
.w-pyimp .bx.hot{stroke:var(--accent);stroke-width:3;fill:var(--accent-soft)}
.w-pyimp .bx.miss{stroke:var(--text-3);stroke-dasharray:4 3}
.w-pyimp .bx.hit{stroke:var(--ok);stroke-width:3;fill:color-mix(in srgb,var(--ok) 14%,var(--surface))}
.w-pyimp .bx.init{stroke:var(--warn);stroke-width:2.5;stroke-dasharray:6 3}
.w-pyimp .bx.err{stroke:var(--err);stroke-width:3;fill:color-mix(in srgb,var(--err) 12%,var(--surface))}
.w-pyimp .mono{font-family:var(--mono)}
.w-pyimp .out-err{color:var(--err)}
` }));
  }
  const PATHS = ['/app   (script dir = sys.path[0])', '/usr/lib/python312.zip', '/usr/lib/python3.12', '/usr/lib/python3.12/lib-dynload', '/app/.venv/lib/python3.12/site-packages'];
  const META = ['BuiltinImporter', 'FrozenImporter', 'PathFinder'];
  const BASE = [['sys', 'ok'], ['builtins', 'ok'], ['os', 'ok'], ['…', 'ok']];
  const SC = {
    first: { label: 'First import', code: ['import httpx', 'httpx.get(url)'], steps: [
      { line: 0, look: 'httpx', cap: 'Step 1 is always the cache: is <code>"httpx"</code> a key in <code>sys.modules</code>? No: this is the first import in the process.' },
      { line: 0, meta: { 0: 'miss' }, cap: 'Ask each finder on <code>sys.meta_path</code> in turn. <code>BuiltinImporter</code> knows modules compiled into the interpreter (<code>sys</code>, <code>builtins</code>…). Not this one.' },
      { line: 0, meta: { 0: 'miss', 1: 'miss' }, cap: '<code>FrozenImporter</code> handles modules frozen into the binary (part of startup, such as <code>importlib._bootstrap</code>). Not this one either.' },
      { line: 0, meta: { 0: 'miss', 1: 'miss', 2: 'hot' }, path: { 0: 'miss' }, cap: '<code>PathFinder</code> walks <code>sys.path</code> in order. First the script’s own directory: is there <code>/app/httpx/</code> or <code>/app/httpx.py</code>? No.' },
      { line: 0, meta: { 0: 'miss', 1: 'miss', 2: 'hot' }, path: { 0: 'miss', 1: 'miss', 2: 'miss', 3: 'miss' }, cap: 'Then the standard library: the zip, the source directory, the C extension directory. Each entry’s finder is cached in <code>sys.path_importer_cache</code>, so this is cheap.' },
      { line: 0, meta: { 0: 'miss', 1: 'miss', 2: 'hit' }, path: { 0: 'miss', 1: 'miss', 2: 'miss', 3: 'miss', 4: 'hit' }, cap: '<b>First match wins:</b> <code>site-packages/httpx/__init__.py</code>. The finder returns a <code>ModuleSpec</code> (name, origin, loader). Nothing has run yet.' },
      { line: 0, add: [['httpx', 'init']], obj: { name: 'httpx', st: 'init', txt: 'namespace: { __name__, __file__, __spec__ }' }, cap: 'The loader creates an empty module object and <b>inserts it into <code>sys.modules</code> before executing it</b> (dashed = still initialising). That is what stops import cycles from recursing forever.' },
      { line: 0, add: [['httpcore', 'ok'], ['anyio', 'ok'], ['certifi', 'ok'], ['httpx._client', 'ok']], obj: { name: 'httpx', st: 'init', txt: 'executing httpx/__init__.py top to bottom…' }, cap: 'Now <code>__init__.py</code> runs top to bottom. Its own imports (httpcore, anyio, certifi, submodules…) each repeat this whole process. Import time is mostly this step.' },
      { line: 0, set: [['httpx', 'ok']], obj: { name: 'httpx', st: 'ok', txt: 'namespace: { get, Client, AsyncClient, … }' }, bind: 'httpx', cap: 'Execution finished: the module is complete. Finally <code>import httpx</code> binds the name <code>httpx</code> in <i>your</i> module’s globals to that object.' },
      { line: 1, obj: { name: 'httpx', st: 'ok', txt: 'namespace: { get, Client, AsyncClient, … }' }, bind: 'httpx', out: '<Response [200 OK]>', cap: '<code>httpx.get</code> is an ordinary attribute lookup on the module object.' }
    ] },
    cached: { label: 'Second import', code: ['# any other module, later:', 'import httpx', 'from httpx import Client'], pre: [['httpx', 'ok']], steps: [
      { line: 1, look: 'httpx', hitCache: true, obj: { name: 'httpx', st: 'ok', txt: 'the same object every importer gets' }, cap: '<code>sys.modules["httpx"]</code> exists, so the import is a <b>dictionary lookup</b>. No finder runs, no file is opened, and the module’s code does <b>not</b> run again.' },
      { line: 1, obj: { name: 'httpx', st: 'ok', txt: 'the same object every importer gets' }, bind: 'httpx', cap: 'The name is bound to the very same module object. Module-level state is therefore shared by the whole process: this is why a module behaves like a singleton.' },
      { line: 2, obj: { name: 'httpx', st: 'ok', txt: 'Client copied out as a plain name' }, bind: 'Client', cap: '<code>from httpx import Client</code> imports (from cache) and then copies a <b>reference</b> to the attribute into your namespace. Rebinding <code>httpx.Client</code> later won’t change your <code>Client</code>.' }
    ] },
    shadow: { label: 'Shadowed stdlib', code: ['# /app/json.py exists: "my helpers"', 'import json', 'json.loads("{}")'], steps: [
      { line: 1, look: 'json', cap: '<code>json</code> is not in <code>sys.modules</code> yet. It is a stdlib <i>source</i> package, not a built-in or frozen module.' },
      { line: 1, meta: { 0: 'miss', 1: 'miss', 2: 'hot' }, cap: 'Built-in and frozen finders both decline, so it’s up to <code>PathFinder</code> and the order of <code>sys.path</code>.' },
      { line: 1, meta: { 0: 'miss', 1: 'miss', 2: 'hit' }, path: { 0: 'hit' }, err: [0], cap: '<code>sys.path[0]</code> is the script’s directory, and it contains <code>json.py</code>. <b>First match wins</b>: the real <code>/usr/lib/python3.12/json/</code> is never even looked at.' },
      { line: 1, add: [['json', 'err']], obj: { name: 'json', st: 'err', txt: '/app/json.py: { helper_a, helper_b }' }, bind: 'json', cap: 'Your helper file is executed and cached as <code>json</code>, for the whole process. Every library that imports <code>json</code> from now on gets it too.' },
      { line: 2, add: [], obj: { name: 'json', st: 'err', txt: '/app/json.py: { helper_a, helper_b }' }, bind: 'json', out: "AttributeError: module 'json' has no attribute 'loads'", outErr: true, cap: 'The failure appears far from the cause, often deep inside a dependency. 3.13 adds a hint to this error suggesting you rename the shadowing file. Fix: rename it, or use <code>python -P</code> / a src layout so the script directory isn’t first.' }
    ] },
    circular: { label: 'Circular import', code: ['# main.py', 'import models', '# models.py', 'from services import audit', 'class User: ...', '# services.py', 'from models import User'], steps: [
      { line: 1, look: 'models', meta: { 0: 'miss', 1: 'miss', 2: 'hit' }, path: { 0: 'hit' }, cap: '<code>import models</code>: cache miss, found as <code>/app/models.py</code>.' },
      { line: 1, add: [['models', 'init']], obj: { name: 'models', st: 'init', txt: 'namespace: { }  (User not defined yet)' }, cap: '<code>models</code> is cached as a <b>partially initialised</b> module and starts executing.' },
      { line: 3, look: 'services', meta: { 0: 'miss', 1: 'miss', 2: 'hit' }, path: { 0: 'hit' }, obj: { name: 'models', st: 'init', txt: 'namespace: { }  (paused on line 1)' }, cap: 'Its first line imports <code>services</code>. Cache miss, found next to it. <code>models</code> is paused right here.' },
      { line: 6, add: [['services', 'init']], look: 'models', hitCache: true, obj: { name: 'services', st: 'init', txt: 'executing: from models import User' }, cap: '<code>services</code> is cached and runs <code>from models import User</code>. The cache <b>hits</b>: it finds the half-built <code>models</code> instead of loading it again, so there is no infinite recursion.' },
      { line: 6, set: [['models', 'err'], ['services', 'err']], obj: { name: 'models', st: 'err', txt: 'namespace: { }  ← no User' }, out: "ImportError: cannot import name 'User' from partially initialized module 'models' (most likely due to a circular import)", outErr: true, cap: '<code>from … import User</code> needs <code>User</code> <b>now</b>, but line 4 of <code>models</code> hasn’t run. ImportError.' },
      { line: 6, del: ['models', 'services'], obj: null, out: "ImportError: cannot import name 'User' from partially initialized module 'models' (most likely due to a circular import)", outErr: true, cap: 'Both failed modules are <b>removed from <code>sys.modules</code></b>. Fixes: move shared code to a third module; or write <code>import models</code> and use <code>models.User</code> at call time; or put annotation-only imports under <code>if TYPE_CHECKING:</code>.' }
    ] }
  };
  let sc = 'first', k = 0, gen = 0, running = false, STATES = [];
  function build() {
    const S = SC[sc]; let mods = BASE.concat(S.pre || []).map((m) => m.slice());
    return S.steps.map((s) => {
      (s.add || []).forEach((m) => mods.push(m.slice()));
      (s.set || []).forEach(([n, st]) => { const m = mods.find((x) => x[0] === n); if (m) m[1] = st; });
      if (s.del) mods = mods.filter((m) => !s.del.includes(m[0]));
      return Object.assign({}, s, { mods: mods.map((m) => m.slice()) });
    });
  }
  const segS = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  Object.entries(SC).forEach(([v, d]) => { const b = el('button', { text: d.label, class: v === sc ? 'on' : '' }); b.addEventListener('click', () => { sc = v; [...segS.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); segS.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'wpy-code' });
  const out = el('div', { class: 'wpy-out' });
  const stage = svg('svg', { viewBox: '0 0 640 360', role: 'img', 'aria-label': 'sys.modules cache, meta path finders, sys.path entries and the resulting module object' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pyimp');
  root.append(el('div', { class: 'w-controls' }, segS),
    el('div', { class: 'wpy-grid' },
      el('div', null, el('div', { class: 'wpy-lbl', text: 'code' }), codeHost, el('div', { class: 'wpy-lbl', text: 'output' }), out),
      el('div', null, el('div', { class: 'wpy-lbl', text: 'import machinery' }), el('div', { class: 'w-stage' }, stage))),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const T = (x, y, text, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text }, o || {}));
  function render() {
    const S = SC[sc]; const cur = k ? STATES[k - 1] : null;
    codeHost.innerHTML = '';
    S.code.forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: IA.highlight(ln, 'python') })));
    out.innerHTML = ''; out.append(el('span', { class: cur && cur.outErr ? 'out-err' : '', text: cur && cur.out ? cur.out : ' ' }));
    stage.innerHTML = '';
    // sys.modules
    const mods = cur ? cur.mods : BASE.concat(S.pre || []);
    stage.append(svg('rect', { class: 'pn', x: 8, y: 8, width: 218, height: 344, rx: 10 }), T(20, 28, 'sys.modules  (cache)', { 'font-weight': 700, 'font-size': 13 }));
    mods.forEach(([n, st], i) => {
      const y = 40 + i * 30; const look = cur && cur.look === n;
      const cls = 'bx' + (st === 'init' ? ' init' : st === 'err' ? ' err' : '') + (look && cur.hitCache ? ' hit' : look ? ' hot' : '');
      stage.append(svg('rect', { class: cls, x: 18, y, width: 198, height: 24, rx: 6 }), T(28, y + 16, `'${n}'`, { class: 'mono', 'font-size': 12 }),
        T(206, y + 16, st === 'init' ? 'initialising' : st === 'err' ? 'broken' : n === '…' ? '' : 'module', { 'text-anchor': 'end', 'font-size': 10, fill: 'var(--text-3)' }));
    });
    if (cur && cur.look && !mods.some((m) => m[0] === cur.look)) {
      const y = 40 + mods.length * 30;
      stage.append(svg('rect', { class: 'bx miss', x: 18, y, width: 198, height: 24, rx: 6 }), T(28, y + 16, `'${cur.look}' ?  → miss`, { class: 'mono', 'font-size': 12, fill: 'var(--text-3)' }));
    }
    // meta path
    stage.append(T(240, 22, 'sys.meta_path  (finders, in order)', { 'font-weight': 700, 'font-size': 13 }));
    META.forEach((m, i) => {
      const r = cur && cur.meta ? cur.meta[i] : null; const x = 240 + i * 132;
      stage.append(svg('rect', { class: 'bx' + (r ? ' ' + r : ''), x, y: 32, width: 124, height: 32, rx: 7 }), T(x + 62, 53, m, { 'text-anchor': 'middle', 'font-size': 11.5 }));
    });
    // sys.path
    stage.append(T(240, 90, 'sys.path  (PathFinder searches top → bottom)', { 'font-weight': 700, 'font-size': 13 }));
    PATHS.forEach((p, i) => {
      const r = cur && cur.path ? cur.path[i] : null; const y = 100 + i * 28;
      const bad = cur && cur.err && cur.err.includes(i);
      stage.append(svg('rect', { class: 'bx' + (bad ? ' err' : r ? ' ' + r : ''), x: 240, y, width: 392, height: 24, rx: 6 }), T(250, y + 16, p, { class: 'mono', 'font-size': 11 }),
        T(624, y + 16, r === 'hit' ? (bad ? 'json.py ✗' : 'found ✓') : r === 'miss' ? 'miss' : '', { 'text-anchor': 'end', 'font-size': 11, 'font-weight': 700, fill: r === 'hit' ? (bad ? 'var(--err)' : 'var(--ok)') : 'var(--text-3)' }));
    });
    // module object + binding
    stage.append(T(240, 262, 'module object', { 'font-weight': 700, 'font-size': 13 }));
    const o = cur && cur.obj;
    stage.append(svg('rect', { class: 'bx' + (o ? (o.st === 'init' ? ' init' : o.st === 'err' ? ' err' : ' hit') : ' miss'), x: 240, y: 270, width: 392, height: 40, rx: 8 }),
      T(252, 287, o ? `<module '${o.name}'>` : '—', { class: 'mono', 'font-size': 12, 'font-weight': 700 }), T(252, 302, o ? o.txt : '', { 'font-size': 11, fill: 'var(--text-2)' }));
    stage.append(svg('rect', { class: 'bx' + (cur && cur.bind ? ' hot' : ' miss'), x: 240, y: 318, width: 392, height: 32, rx: 8 }),
      T(252, 339, cur && cur.bind ? `your globals:  ${cur.bind} → <module '${o ? o.name : ''}'>${cur.bind === 'Client' ? '.Client' : ''}` : 'your globals: name not bound yet', { class: 'mono', 'font-size': 12 }));
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${STATES.length}` }), el('div', { class: 't', html: cur ? cur.cap : 'Press <b>Play</b> or <b>Step</b> to follow the statement through the import machinery.' }));
    bStep.disabled = k >= STATES.length;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); STATES = build(); k = 0; render(); }
  function step() { if (k >= STATES.length) return false; k++; render(); return k < STATES.length; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= STATES.length) { k = 0; render(); }
    if (reduced) { k = STATES.length; render(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(2700); }
    if (g === gen) stop();
  });
  reset();
});
