/* Type hints: the same code seen by a static type checker (before running) and by CPython (while running).
   Scenarios: hints aren't enforced, Protocols, 3.12 generics + `type`, TypedDict, narrowing. */
IA.widget('typing', (root, ctx) => {
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
  if (!document.getElementById('w-pyty-style')) {
    document.head.append(el('style', { id: 'w-pyty-style', text: `
.w-pyty .lanes{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
@media (max-width:520px){.w-pyty .lanes{grid-template-columns:1fr}}
.w-pyty .lane{border:1px solid var(--border);border-radius:10px;background:var(--surface);padding:8px 10px;min-height:150px}
.w-pyty .lane h5{margin:0 0 6px;font-size:12.5px;color:var(--text-2)}
.w-pyty .lane .m{font-family:var(--mono);font-size:12px;padding:4px 6px;border-radius:6px;margin:3px 0;border-left:3px solid var(--border);overflow-wrap:anywhere;animation:capin .3s ease both}
.w-pyty .lane .m.noanim{animation:none}
.w-pyty .lane .m.ok{border-left-color:var(--ok)} .w-pyty .lane .m.err{border-left-color:var(--err);color:var(--err)} .w-pyty .lane .m.info{border-left-color:var(--accent-2)}
.w-pyty .lane .m.cur{background:var(--accent-soft)}
.w-pyty .lane .m .ln{color:var(--text-3);margin-right:6px}
` }));
  }
  // step: line, chk [cls, msg] (static checker), rt [cls, msg] (runtime), cap
  const S = [
    { label: 'Hints aren’t enforced', code: ['def add(a: int, b: int) -> int:', '    return a + b', '', 'add(2, 3)', 'add("x", "y")', 'print(add.__annotations__)'],
      steps: [
        { line: 0, chk: ['info', 'add: (a: int, b: int) -> int'], rt: ['info', 'function created; annotations stored in add.__annotations__'], cap: 'Both readers see the <code>def</code>. The checker records a signature. CPython builds a function object and stores the annotations as data. It does nothing else with them.' },
        { line: 3, chk: ['ok', 'OK'], rt: ['ok', '→ 5'], cap: 'A correct call. Both are happy.' },
        { line: 4, chk: ['err', 'error: Argument 1 to "add" has incompatible type "str"; expected "int"'], rt: ['ok', '→ "xy"  (no error!)'], cap: 'The checker rejects it <b>before the program runs</b>. CPython runs it anyway: <code>str + str</code> works, so you get <code>"xy"</code>. Hints are <b>not</b> runtime checks.' },
        { line: 5, chk: ['ok', 'OK'], rt: ['info', "{'a': <class 'int'>, 'b': <class 'int'>, 'return': <class 'int'>}"], cap: 'At run time annotations are just a dict that libraries (Pydantic, FastAPI, dataclasses) can read and act on. Since 3.14 they are lazily evaluated (PEP 649/749).' }
      ] },
    { label: 'Protocol', code: ['class SupportsClose(Protocol):', '    def close(self) -> None: ...', '', 'class Upload:                 # no base class', '    def close(self) -> None: ...', '', 'def shutdown(r: SupportsClose) -> None:', '    r.close()', '', 'shutdown(Upload())', 'shutdown(42)', 'isinstance(Upload(), SupportsClose)'],
      steps: [
        { line: 0, chk: ['info', 'SupportsClose: anything with close(self) -> None'], rt: ['info', 'class created (a Protocol subclass)'], cap: 'A <code>Protocol</code> describes a <b>shape</b>: which methods and attributes something must have. It is structural typing, like Go interfaces: checked duck typing.' },
        { line: 3, chk: ['info', 'Upload: has close(self) -> None'], rt: ['info', 'ordinary class'], cap: '<code>Upload</code> never mentions the protocol. No <code>implements</code>, no inheritance.' },
        { line: 9, chk: ['ok', 'OK: Upload is structurally compatible'], rt: ['ok', 'calls Upload.close()'], cap: 'The checker compares members, not ancestry. Third-party classes you can’t modify can satisfy your protocols.' },
        { line: 10, chk: ['err', 'error: Argument 1 has incompatible type "int"; expected "SupportsClose"'], rt: ['err', "AttributeError: 'int' object has no attribute 'close'"], cap: 'Caught statically. At run time it fails only when <code>close</code> is actually called, maybe deep inside a code path tests never hit.' },
        { line: 11, chk: ['err', 'error: Only @runtime_checkable protocols can be used with instance and class checks'], rt: ['err', 'TypeError: Instance and class checks can only be used with @runtime_checkable protocols'], cap: 'Add <code>@runtime_checkable</code> to allow <code>isinstance</code>. Even then it only checks that the methods <b>exist</b>, not their signatures.' }
      ] },
    { label: 'Generics (3.12)', code: ['def first[T](xs: list[T]) -> T:', '    return xs[0]', '', 'n = first([1, 2, 3])', 'first(["a"]).upper()', 'first([1]).upper()', '', 'type Pair[T] = tuple[T, T]', 'p: Pair[str] = ("a", "b")'],
      steps: [
        { line: 0, chk: ['info', 'first: [T](xs: list[T]) -> T'], rt: ['info', 'first.__type_params__ == (T,)'], cap: '3.12 syntax (PEP 695): type parameters in brackets. No more <code>T = TypeVar("T")</code> at module level. At run time <code>T</code> is still a <code>TypeVar</code> object, created for you and scoped to the function.' },
        { line: 3, chk: ['ok', 'T = int, so n: int'], rt: ['ok', 'n = 1'], cap: 'The checker <b>solves</b> T from the argument: <code>list[int]</code> → T is int → the result is int.' },
        { line: 4, chk: ['ok', 'T = str → str.upper exists'], rt: ['ok', '"A"'], cap: 'Different call, different T.' },
        { line: 5, chk: ['err', 'error: "int" has no attribute "upper"'], rt: ['err', "AttributeError: 'int' object has no attribute 'upper'"], cap: 'Generics let the checker carry the element type through the call. With <code>list[Any]</code> this error would be invisible until run time.' },
        { line: 7, chk: ['info', 'Pair[T] is an alias for tuple[T, T]'], rt: ['info', 'Pair is a TypeAliasType; its value is evaluated lazily'], cap: 'The <code>type</code> statement (3.12) declares an alias explicitly. Its right-hand side is evaluated only when needed, so forward references just work.' },
        { line: 8, chk: ['ok', 'OK: tuple[str, str]'], rt: ['ok', 'p = ("a", "b"); recorded in __annotations__, never checked'], cap: 'Again: the annotation guides the checker. CPython records module- and class-level variable annotations in <code>__annotations__</code> and doesn’t even evaluate them for local variables. It checks neither.' }
      ] },
    { label: 'TypedDict', code: ['class User(TypedDict):', '    id: int', '    name: str', '    email: NotRequired[str]', '', 'ok: User = {"id": 1, "name": "Asha"}', 'bad: User = {"id": "1", "name": "Ben"}', 'print(type(ok), ok["email"])'],
      steps: [
        { line: 0, chk: ['info', 'User: dict with keys id: int, name: str, email?: str'], rt: ['info', 'User is a class whose instances are plain dicts'], cap: '<code>TypedDict</code> types the <b>shape of a dict</b>: JSON payloads, kwargs, config. Keys are required unless marked <code>NotRequired</code> (3.11+) or the class uses <code>total=False</code>.' },
        { line: 5, chk: ['ok', 'OK (email is optional)'], rt: ['ok', 'a normal dict'], cap: 'A literal that matches the shape.' },
        { line: 6, chk: ['err', 'error: Incompatible types (expression has type "str", TypedDict item "id" has type "int")'], rt: ['ok', 'a normal dict, id = "1"'], cap: 'The checker catches the wrong value type. At run time nothing validates it: <code>bad["id"]</code> really is the string <code>"1"</code>.' },
        { line: 7, chk: ['info', 'ok["email"]: str (NotRequired: may be missing)'], rt: ['err', "KeyError: 'email'  (type(ok) is dict)"], cap: 'At run time it is just a <code>dict</code>. For data from outside (HTTP, queues, files) you need <b>runtime validation</b>: Pydantic, or a hand-written parser. See <a href="dataclasses-pydantic.html">Dataclasses & Pydantic</a>.' }
      ] },
    { label: 'Narrowing', code: ['def label(x: int | str | None) -> str:', '    if x is None:', '        return "none"', '    if isinstance(x, int):', '        return f"#{x}"', '    return x.upper()'],
      steps: [
        { line: 0, chk: ['info', 'x: int | str | None'], rt: ['info', 'function created'], cap: '<code>X | Y</code> union syntax is 3.10+. <code>None</code> must be spelled out: <code>Optional[str]</code> is just <code>str | None</code>.' },
        { line: 1, chk: ['info', 'inside: x: None'], rt: ['info', 'x is None → identity check runs'], cap: 'Checkers <b>narrow</b> the type inside branches using the same tests your code runs: <code>is None</code>, <code>isinstance</code>, <code>==</code> on literals, <code>TypeIs</code>/<code>TypeGuard</code> functions.' },
        { line: 3, chk: ['info', 'after the return: x: int | str; inside: x: int'], rt: ['info', 'isinstance(x, int) runs'], cap: 'After the early return, <code>None</code> is gone from the union.' },
        { line: 5, chk: ['ok', 'x: str → .upper() OK'], rt: ['ok', 'x.upper()'], cap: 'Only <code>str</code> is left, so <code>.upper()</code> type-checks. Remove the <code>is None</code> test and the checker reports <code>Item "None" of "str | None" has no attribute "upper"</code>.' },
        { line: 5, chk: ['info', 'mypy and pyright agree here; they can differ on harder inference'], rt: ['info', 'the checks are ordinary Python'], cap: 'Narrowing is where static typing pays off in everyday code: <code>None</code> handling becomes something the tool checks, like Kotlin’s nullable types or Java with NullAway.' }
      ] }
  ];
  let si = 0, k = 0, gen = 0, running = false;
  const segS = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  S.forEach((s, i) => { const b = el('button', { text: s.label, class: i === si ? 'on' : '' }); b.addEventListener('click', () => { si = i; [...segS.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); segS.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'wpy-code' });
  const chk = el('div', { class: 'lane' }); const rt = el('div', { class: 'lane' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pyty');
  root.append(el('div', { class: 'w-controls' }, segS),
    el('div', { class: 'wpy-grid' },
      el('div', null, el('div', { class: 'wpy-lbl', text: 'code' }), codeHost),
      el('div', null, el('div', { class: 'wpy-lbl', text: 'two readers of the same file' }), el('div', { class: 'lanes' }, chk, rt))),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  function lane(host, title, key) {
    const sc = S[si];
    host.innerHTML = ''; host.append(el('h5', { text: title }));
    sc.steps.slice(0, k).forEach((s, i) => {
      if (!s[key]) return;
      host.append(el('div', { class: 'm ' + s[key][0] + (i === k - 1 ? ' cur' : ' noanim') + (reduced ? ' noanim' : '') }, el('span', { class: 'ln', text: 'L' + (s.line + 1) }), s[key][1]));
    });
    if (!k) host.append(el('div', { class: 'tiny', text: key === 'chk' ? 'reads the whole file without running it' : 'runs it top to bottom' }));
  }
  function render() {
    const sc = S[si]; const n = sc.steps.length; const cur = k ? sc.steps[k - 1] : null;
    codeHost.innerHTML = '';
    sc.code.forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: ln ? IA.highlight(ln, 'python') : '&nbsp;' })));
    lane(chk, '🔍 mypy / pyright (static, before running)', 'chk');
    lane(rt, '▶ CPython 3.12 (at run time)', 'rt');
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${n}` }), el('div', { class: 't', html: cur ? cur.cap : 'Pick a scenario and press <b>Play</b> or <b>Step</b>. The left lane is what a type checker reports without running anything; the right lane is what actually happens when Python runs the line.' }));
    bStep.disabled = k >= n;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; render(); }
  function step() { const n = S[si].steps.length; if (k >= n) return false; k++; render(); return k < n; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= S[si].steps.length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2600); }
    if (g === gen) stop();
  });
  reset();
});
