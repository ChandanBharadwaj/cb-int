/* Java habits that hurt in Python: clickable cards (habit → why it hurts → do this instead), with a progress count. */
IA.widget('python-for-java-devs-habits', (root, ctx) => {
  const { el, reduced } = ctx;
  if (!document.getElementById('w-pyhb-style')) {
    document.head.append(el('style', { id: 'w-pyhb-style', text: `
.w-pyhb .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.w-pyhb .hb{border:1px solid var(--border);border-radius:12px;background:var(--surface);padding:12px;text-align:left;cursor:pointer;color:var(--text);font:inherit;transition:border-color .25s,background .25s}
.w-pyhb .hb:hover{border-color:var(--accent)}
.w-pyhb .hb .h{font-weight:700;font-size:14px;display:flex;gap:8px;align-items:baseline}
.w-pyhb .hb .h .i{color:var(--warn)}
.w-pyhb .hb .j{font-family:var(--mono);font-size:12px;color:var(--text-3);margin-top:6px;white-space:pre-wrap}
.w-pyhb .hb .b{display:none;margin-top:8px;font-size:13.5px;color:var(--text-2)}
.w-pyhb .hb .b .fix{margin-top:6px;color:var(--text)}
.w-pyhb .hb .b code{font-size:12px}
.w-pyhb .hb.open{border-color:var(--ok);background:color-mix(in srgb,var(--ok) 6%,var(--surface))}
.w-pyhb .hb.open .b{display:block;animation:capin .3s ease both}
.w-pyhb .hb.open .h .i{color:var(--ok)}
` }));
  }
  const H = [
    ['Getters and setters', 'getBalance() / setBalance(v)', 'No access control exists, so they protect nothing and double the API surface.', 'Plain attributes; add <code>@property</code> later without changing callers.'],
    ['Field declarations in the class body', 'class Cart:\n    items = []', 'Creates one <b>class</b> attribute shared by every instance, like a <code>static</code> field.', 'Set instance state in <code>__init__</code>, or <code>@dataclass</code> with <code>field(default_factory=list)</code>.'],
    ['Mutable default arguments', 'def f(x, acc=[])', 'The default is built once at <code>def</code> time and reused by every call.', 'Default to <code>None</code> and create the list inside.'],
    ['Thread pools for CPU work', 'ThreadPoolExecutor(cores)', 'The GIL runs one thread of bytecode at a time on the default build.', '<code>ProcessPoolExecutor</code>, NumPy, or C extensions that release the GIL.'],
    ['Type hints as runtime checks', 'def charge(amount: int)', 'The interpreter ignores annotations; <code>charge("100")</code> runs.', 'mypy/pyright in CI; Pydantic for untrusted input.'],
    ['One class per file, deep packages', 'service/impl/OrderServiceImpl.py', 'Long imports, circular-import errors at startup, indirection with no benefit.', 'Shallow packages by feature; several related classes per module.'],
    ['Factories and DI containers', 'OrderServiceFactory.create()', 'A function or class is already a factory; containers hide wiring.', 'Pass dependencies as parameters; wire them in one composition root.'],
    ['Index-based loops', 'for i in range(len(xs)):', 'Noisy and error-prone; slower than iterating directly.', '<code>for x in xs</code>, <code>enumerate</code>, <code>zip</code>, comprehensions.'],
    ['== for identity, equals() for values', 'if status is "paid":', '<code>is</code> is identity; <code>==</code> is value equality. Swapping them works by accident, sometimes.', '<code>==</code> for values, <code>is</code> only for <code>None</code> and sentinels.'],
    ['Catching Exception and moving on', 'except Exception: pass', 'Hides bugs; with a bare <code>except:</code> it even swallows Ctrl-C and <code>sys.exit()</code>.', 'Catch narrow types; at boundaries, <code>log.exception</code> and re-raise or count.'],
    ['Overloading by signature', 'def f(a) / def f(a, b)', 'The second <code>def</code> silently replaces the first.', 'Defaults, keyword-only args, <code>@classmethod</code> constructors, <code>singledispatch</code>.'],
    ['Utility classes of static methods', 'class StringUtils:\n    @staticmethod …', 'A class used as a namespace adds nothing: modules already are namespaces.', 'Module-level functions: <code>from app.text import slugify</code>.'],
    ['Checked-exception thinking', 'throws IOException', 'Nothing forces handling, so “it compiles” says nothing about error paths.', 'A small domain hierarchy, <code>raise … from e</code>, tests for failure paths.'],
    ['Long-lived mutable singletons', 'static Map<String, X> CACHE', 'Module globals are per <b>process</b>: with 4 workers you get 4 caches; tests leak state.', 'Explicit objects passed in; Redis for shared state; <code>lru_cache</code> with a bound.']
  ];
  const opened = new Set();
  const stat = el('span', { class: 'w-stat' });
  const bAll = el('button', { class: 'btn', text: 'Open all' });
  const bNone = el('button', { class: 'btn', text: '↺ Reset' });
  const grid = el('div', { class: 'grid' });
  const cards = H.map(([t, j, why, fix], i) => {
    const c = el('button', { class: 'hb', 'aria-expanded': 'false' },
      el('div', { class: 'h' }, el('span', { class: 'i', text: '⚠' }), el('span', { text: t })),
      el('div', { class: 'j', text: j }),
      el('div', { class: 'b' }, el('div', { html: '<b>Why it hurts:</b> ' + why }), el('div', { class: 'fix', html: '<b>Instead:</b> ' + fix })));
    c.addEventListener('click', () => { const on = !c.classList.contains('open'); c.classList.toggle('open', on); c.setAttribute('aria-expanded', String(on)); if (on) opened.add(i); paint(); });
    grid.append(c); return c;
  });
  function paint() { stat.innerHTML = `reviewed <b>${opened.size}</b> / ${H.length}`; }
  bAll.addEventListener('click', () => { cards.forEach((c, i) => { c.classList.add('open'); c.setAttribute('aria-expanded', 'true'); opened.add(i); }); paint(); });
  bNone.addEventListener('click', () => { cards.forEach((c) => { c.classList.remove('open'); c.setAttribute('aria-expanded', 'false'); }); opened.clear(); paint(); });
  root.classList.add('w-pyhb');
  root.append(el('div', { class: 'w-controls' }, bAll, bNone, stat), grid);
  if (reduced) cards.forEach((c) => { c.style.transition = 'none'; });
  paint();
});
