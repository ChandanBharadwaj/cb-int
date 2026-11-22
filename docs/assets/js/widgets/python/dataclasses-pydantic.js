/* Dataclasses & Pydantic: what @dataclass generates (fields, __init__, __repr__, __eq__, order, frozen, slots),
   and how Pydantic v2 validates an untrusted payload field by field. */
IA.widget('dataclasses-pydantic', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
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
  if (!document.getElementById('w-pydc-style')) {
    document.head.append(el('style', { id: 'w-pydc-style', text: `
.w-pydc .gen{display:flex;flex-direction:column;gap:6px}
.w-pydc .gm{border:1px solid var(--border);border-radius:10px;background:var(--surface);overflow:hidden;animation:capin .35s ease both}
.w-pydc .gm.noanim{animation:none}
.w-pydc .gm.cur{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.w-pydc .gm h6{margin:0;padding:5px 10px;font-size:12px;color:var(--text-2);background:var(--surface-2);border-bottom:1px solid var(--border)}
.w-pydc .gm pre{margin:0;padding:6px 10px;font-size:12px;line-height:1.5;overflow-x:auto}
.w-pydc .vt{width:100%;border-collapse:collapse;font-size:12.5px}
.w-pydc .vt th,.w-pydc .vt td{border-bottom:1px solid var(--border);padding:6px 6px;text-align:left;vertical-align:top}
.w-pydc .vt th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);background:var(--surface-2)}
.w-pydc .vt td{font-family:var(--mono);overflow-wrap:anywhere}
.w-pydc .vt tr.cur td{background:var(--accent-soft)}
.w-pydc .pl{display:inline-block;font-size:11px;padding:1px 7px;border-radius:999px;border:1px solid var(--border);margin:1px 3px 1px 0;font-family:var(--sans)}
.w-pydc .pl.ok{border-color:var(--ok);color:var(--ok)} .w-pydc .pl.err{border-color:var(--err);color:var(--err)} .w-pydc .pl.mod{border-color:var(--warn);color:var(--warn)}
.w-pydc .res{font-family:var(--mono);font-size:12.5px;border-radius:10px;padding:8px 12px;margin-top:8px;border:1.5px solid var(--border);white-space:pre-wrap}
.w-pydc .res.ok{border-color:var(--ok)} .w-pydc .res.err{border-color:var(--err)}
` }));
  }
  /* ---------- @dataclass mode ---------- */
  const DC_CODE = ['@dataclass(order=True, frozen=True, slots=True)', 'class Money:', '    amount: int', '    currency: str = "EUR"', '    tags: list[str] = field(default_factory=list, compare=False)', '    RATE: ClassVar[float] = 1.0', '', 'm = Money(5)', 'm.amount = 6'];
  const DC = [
    { line: 2, title: 'fields()', code: "(Field('amount'), Field('currency'), Field('tags'))", cap: 'The decorator reads the class <code>__annotations__</code>, in order. Every annotated name becomes a field. <code>ClassVar</code> annotations are skipped, and so are plain class attributes without an annotation.' },
    { line: 3, title: '__init__', code: 'def __init__(self, amount: int, currency: str = "EUR",\n             tags: list[str] = <factory>):\n    object.__setattr__(self, "amount", amount)\n    object.__setattr__(self, "currency", currency)\n    object.__setattr__(self, "tags", list() if tags is <factory> else tags)', cap: 'An <code>__init__</code> with one parameter per field, in declaration order, defaults included. Fields with defaults must come after those without (or use <code>kw_only=True</code>). Because the class is frozen, it assigns through <code>object.__setattr__</code>.' },
    { line: 4, title: 'default_factory', code: '# tags: list[str] = []   ->  ValueError: mutable default <class \'list\'>\n#                             for field tags is not allowed: use default_factory', cap: 'A plain <code>= []</code> default is rejected (any unhashable default, since 3.11). <code>default_factory=list</code> builds a fresh list per instance, avoiding the shared-mutable-default bug.' },
    { line: 0, title: '__repr__', code: "def __repr__(self):\n    return f\"Money(amount={self.amount!r}, currency={self.currency!r}, tags={self.tags!r})\"", cap: 'A readable repr with every field (unless <code>field(repr=False)</code>). Great in logs; dangerous for secrets.' },
    { line: 0, title: '__eq__', code: 'def __eq__(self, other):\n    if other.__class__ is self.__class__:\n        return (self.amount, self.currency) == (other.amount, other.currency)\n    return NotImplemented', cap: 'Field-by-field equality, <b>same class only</b>. <code>tags</code> is left out because of <code>compare=False</code>.' },
    { line: 0, title: '__lt__, __le__, __gt__, __ge__  (order=True)', code: 'def __lt__(self, other):\n    if other.__class__ is self.__class__:\n        return (self.amount, self.currency) < (other.amount, other.currency)\n    return NotImplemented', cap: '<code>order=True</code> compares the fields as a tuple, in declaration order. Reorder the fields and you change the sort order.' },
    { line: 0, title: '__setattr__ / __delattr__ + __hash__  (frozen=True)', code: 'def __setattr__(self, name, value):\n    raise FrozenInstanceError(f"cannot assign to field {name!r}")\n\ndef __hash__(self):\n    return hash((self.amount, self.currency))', cap: '<code>frozen=True</code> blocks assignment after <code>__init__</code>, and with <code>eq=True</code> it also generates <code>__hash__</code> from the compared fields, so instances work as dict keys. Frozen is shallow: <code>m.tags.append(…)</code> still works.' },
    { line: 0, title: '__slots__  (slots=True, 3.10+)', code: "__slots__ = ('amount', 'currency', 'tags')\n# the decorator returns a NEW class object with these slots", cap: '<code>slots=True</code> builds a replacement class with <code>__slots__</code>: smaller instances, no <code>__dict__</code>, typo-proof attributes. Because it is a new class, methods that use zero-argument <code>super()</code> can fail with a TypeError: they still point at the original class.' },
    { line: 7, title: 'result', code: "Money(amount=5, currency='EUR', tags=[])", cap: 'Construction uses the generated <code>__init__</code> and the defaults.' },
    { line: 8, title: 'm.amount = 6', code: "dataclasses.FrozenInstanceError: cannot assign to field 'amount'", err: true, cap: 'Immutability enforced at run time. Use <code>dataclasses.replace(m, amount=6)</code> (or <code>copy.replace</code> in 3.13) to get a modified copy. Note what is <b>not</b> generated: no type checks. <code>Money("five")</code> works fine.' }
  ];
  /* ---------- Pydantic mode ---------- */
  const PY_CODE = ['class User(BaseModel):', '    id: int', '    email: str', '    tags: list[str] = []', '    age: int = Field(ge=0)', '', '    @field_validator("email")', '    @classmethod', '    def norm(cls, v: str) -> str:', '        return v.strip().lower()', '', '    @field_validator("tags", mode="before")', '    @classmethod', '    def split(cls, v):', '        return v.split(",") if isinstance(v, str) else v', '', 'User.model_validate_json(body)'];
  const INPUT = { id: '"42"', email: '" A@X.COM "', tags: '"a,b"', age: '-3' };
  const FIELDS = ['id', 'email', 'tags', 'age'];
  // each step: field, line, pills to append [cls, text], value (current), cap
  const PY = [
    { field: null, line: 16, cap: 'The body is parsed as JSON, then validated against the schema that Pydantic compiled (in Rust, <code>pydantic-core</code>) when the class was defined. Input: <code>{"id": "42", "email": " A@X.COM ", "tags": "a,b", "age": -3}</code>.' },
    { field: 'id', line: 1, pill: ['mod', 'lax: str → int'], val: '42', cap: '<code>id: int</code> receives the string <code>"42"</code>. In the default <b>lax</b> mode Pydantic coerces numeric strings to int. In <b>strict</b> mode (<code>strict=True</code>) this would be an error.' },
    { field: 'email', line: 2, pill: ['ok', 'str ✓'], val: '" A@X.COM "', cap: 'Core validation first: it is a string.' },
    { field: 'email', line: 9, pill: ['mod', 'after validator'], val: '"a@x.com"', cap: 'Then the <code>field_validator</code> (default <code>mode="after"</code>) runs on the already-validated value and returns a normalised one.' },
    { field: 'tags', line: 14, pill: ['mod', 'before validator'], val: '["a", "b"]', cap: 'A <code>mode="before"</code> validator runs on the <b>raw</b> input, before type validation. It turns <code>"a,b"</code> into a list.' },
    { field: 'tags', line: 3, pill: ['ok', 'list[str] ✓'], val: '["a", "b"]', cap: 'Now the core validator checks <code>list[str]</code>. A mutable default like <code>[]</code> is safe here: Pydantic copies defaults per instance (unlike plain function defaults).' },
    { field: 'age', line: 4, pill: ['ok', 'int ✓'], val: '-3', cap: 'It is an int…' },
    { field: 'age', line: 4, pill: ['err', 'ge=0 ✗'], val: '-3', err: true, cap: '…but fails the <code>ge=0</code> constraint. Pydantic doesn’t stop at the first problem: it validates <b>every</b> field and collects all errors.' },
    { field: null, line: 16, result: 'err', cap: 'One <code>ValidationError</code> listing every failure with its location, type and input: exactly what an API should return as a 422. FastAPI does this for you.' },
    { field: null, line: 16, result: 'ok', cap: 'With <code>"age": 30</code> the same payload validates to a real <code>User</code> instance, with normalised, correctly typed values. <code>model_dump()</code> / <code>model_dump_json()</code> serialise it back.' }
  ];

  let mode = 'dc', k = 0, gen = 0, running = false;
  const segM = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Mode' });
  [['dc', 'What @dataclass generates'], ['pd', 'Pydantic v2 validation']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...segM.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); segM.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'wpy-code' });
  const lbl = el('div', { class: 'wpy-lbl' });
  const right = el('div');
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pydc');
  root.append(el('div', { class: 'w-controls' }, segM),
    el('div', { class: 'wpy-grid' }, el('div', null, el('div', { class: 'wpy-lbl', text: 'you write' }), codeHost), el('div', null, lbl, right)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const steps = () => (mode === 'dc' ? DC : PY);
  function renderDc(cur) {
    lbl.textContent = 'what the decorator generates';
    const g = el('div', { class: 'gen' });
    DC.slice(0, k).forEach((s, i) => {
      const pre = el('pre', { html: IA.highlight(s.code, 'python') });
      if (s.err) pre.style.color = 'var(--err)';
      g.append(el('div', { class: 'gm' + (i === k - 1 ? ' cur' : ' noanim') + (reduced ? ' noanim' : '') }, el('h6', { text: s.title }), pre));
    });
    if (!k) g.append(el('div', { class: 'tiny', text: 'Nothing generated yet. A plain class with these annotations would have no __init__ and an unhelpful repr.' }));
    right.append(g);
  }
  function renderPd(cur) {
    lbl.textContent = 'validation, field by field';
    const state = {}; FIELDS.forEach((f) => { state[f] = { pills: [], val: '' }; });
    PY.slice(0, k).forEach((s) => { if (s.field) { if (s.pill) state[s.field].pills.push(s.pill); state[s.field].val = s.val; } });
    const tb = el('tbody');
    FIELDS.forEach((f) => tb.append(el('tr', { class: cur && cur.field === f ? 'cur' : '' }, el('td', { text: f }), el('td', { text: INPUT[f] }),
      el('td', null, state[f].pills.map(([c, t]) => el('span', { class: 'pl ' + c, text: t }))), el('td', { text: state[f].val }))));
    right.append(el('div', { class: 'tscroll' }, el('table', { class: 'vt' }, el('thead', null, el('tr', null, ['field', 'input', 'steps', 'value'].map((h) => el('th', { text: h })))), tb)));
    if (cur && cur.result === 'err') right.append(el('div', { class: 'res err', text: 'pydantic_core.ValidationError: 1 validation error for User\nage\n  Input should be greater than or equal to 0 [type=greater_than_equal, input_value=-3, input_type=int]' }));
    if (cur && cur.result === 'ok') right.append(el('div', { class: 'res ok', text: "User(id=42, email='a@x.com', tags=['a', 'b'], age=30)" }));
  }
  function render() {
    const S = steps(); const n = S.length; const cur = k ? S[k - 1] : null;
    codeHost.innerHTML = '';
    (mode === 'dc' ? DC_CODE : PY_CODE).forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: ln ? IA.highlight(ln, 'python') : '&nbsp;' })));
    right.innerHTML = '';
    if (mode === 'dc') renderDc(cur); else renderPd(cur);
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${n}` }), el('div', { class: 't', html: cur ? cur.cap : (mode === 'dc' ? 'Press <b>Play</b> or <b>Step</b> to see, one piece at a time, the code <code>@dataclass</code> writes for you at class-creation time.' : 'Press <b>Play</b> or <b>Step</b> to push an untrusted JSON payload through a Pydantic v2 model.') }));
    bStep.disabled = k >= n;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; render(); }
  function step() { const n = steps().length; if (k >= n) return false; k++; render(); return k < n; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= steps().length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2600); }
    if (g === gen) stop();
  });
  reset();
});
