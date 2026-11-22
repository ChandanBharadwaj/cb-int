IA.register({
  track: 'python',
  slug: 'memory-gc',
  title: 'Memory & garbage collection',
  tagline: 'CPython frees most objects <b>the moment their reference count reaches zero</b>. A separate, generational <b>cycle collector</b> exists only for objects that point at each other. Once you know which of the two freed your object (or didn’t), <code>__del__</code> timing, <code>weakref</code> and most “leaks” stop being mysterious.',
  tldr: {
    problem: 'A Python service’s memory climbs for days, latency spikes every few seconds, or a pre-forked worker pool uses 8× the RAM you expected. Python “has a GC”, so people assume leaks can’t happen. They can: anything still <i>reachable</i> is kept forever, and cycles wait for a collector that may be disabled or too slow.',
    model: 'Two mechanisms. <b>Reference counting</b>: every object header has <code>ob_refcnt</code>; each new reference increments it, each dropped reference decrements it, and at 0 the object is freed immediately (deterministic, like a scope exit). <b>Cyclic GC</b>: container objects are tracked in generations; a collection finds groups whose only references come from <i>inside the group</i> and frees them.',
    hook: '“If CPython has reference counting, why does it need a garbage collector at all?” Because <code>a.peer = b; b.peer = a</code> keeps both counts at 1 forever after the names are gone. Refcounting alone can never free a cycle.',
    facts: [
      { v: 'ob_refcnt', l: 'every CPython object header carries a reference count. At 0 the object is deallocated immediately, inside the instruction that dropped the last reference' },
      { v: '(700, 10, 10)', l: 'default <code>gc.get_threshold()</code> in 3.12 and 3.13: gen 0 is collected after 700 net allocations of tracked objects; each older generation after 10 collections of the one below' },
      { v: 'PEP 683', l: '3.12+: <code>None</code>, <code>True</code>/<code>False</code>, small ints and some other objects are <b>immortal</b>. Their refcount is fixed and never written' }
    ]
  },
  intro: {
    what: 'Every value in Python is an object living in memory (“the heap”). Python has to decide when an object is no longer needed so it can reuse its memory. CPython, the standard interpreter, mostly does this by <b>counting references</b>: how many names, list slots, attributes and so on point at the object. When the count drops to zero, nobody can reach it any more, so it is freed straight away. A second helper, the <b>garbage collector</b>, cleans up groups of objects that only point at each other.',
    analogy: { icon: '🎈', title: 'Balloons on strings', text: 'Each object is a balloon. Every reference is a string tied to it, held by someone (a variable, a list, another balloon). Cut the last string and the balloon floats away at once: that’s reference counting. But two balloons tied only to each other, with nobody on the ground holding either, still have one string each. They drift around forever until the cleaner (the cycle collector) walks by, notices nobody on the ground holds them, and pops both.' },
    steps: [
      { t: 'Names hold references', d: 'Assignment never copies an object. It adds a reference to it.', code: 'a = [1, 2, 3]   # list refcount: 1\nb = a           # refcount: 2 (two names)\ndel a           # refcount: 1\nb = None        # refcount: 0 → freed now' },
      { t: 'Freed means freed now', d: 'In CPython the object is gone the moment its count hits zero. A file object’s finalizer closes the file right there (but use <code>with</code>, which closes it even on PyPy and on errors).' },
      { t: 'Cycles break counting', d: 'Two objects pointing at each other keep each other’s count above zero, even when your code can no longer reach either.', code: 'a = Node(); b = Node()\na.peer = b; b.peer = a\ndel a, b        # both still at refcount 1' },
      { t: 'The cycle collector cleans up', d: 'Every so often (after about 700 new container objects) the <code>gc</code> module scans recent objects, finds groups that are only referenced from inside the group, and frees them.' },
      { t: 'Weak references don’t count', d: 'A <code>weakref</code> lets you point at an object without keeping it alive. Caches and observer lists use them so they don’t become leaks.' }
    ],
    terms: [
      ['reference count', 'How many references point at an object. Stored in its header (<code>ob_refcnt</code>).'],
      ['reference cycle', 'Objects that reference each other, directly or via a chain: <code>a → b → a</code>.'],
      ['cyclic GC', 'The <code>gc</code> module’s collector. It only looks at container objects (lists, dicts, class instances…) and only to break cycles.'],
      ['generation', 'A bucket of tracked objects grouped by age. New objects start in gen 0; survivors move to gen 1, then gen 2.'],
      ['weak reference', 'A reference that does not increase the refcount. It returns <code>None</code> once the object is gone.'],
      ['finalizer', 'Code run when an object dies: <code>__del__</code> or a <code>weakref.finalize</code> callback.']
    ]
  },
  visual: {
    title: 'Refcounts first, then the cycle collector',
    caption: 'Press <b>Play</b> or <b>Step</b>. Names are on the left, heap objects on the right with their refcount badge. Watch <code>c</code> die the instant its count hits 0, then watch the A↔B cycle survive <code>del</code> until <code>gc.collect()</code> runs its three passes. Switch <b>b.peer</b> to a weakref to see the cycle never form.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Refcounts move', code: `import sys

x = []
# getrefcount reports one extra: its own argument is a temporary reference
print("fresh list:", sys.getrefcount(x))

y = x
holder = {"k": x}
print("after y = x and a dict slot:", sys.getrefcount(x))

del y
holder.clear()
print("after del + clear:", sys.getrefcount(x))

# 3.12+: immortal objects report a huge fixed count that never changes
print("None is immortal-sized:", sys.getrefcount(None) > 1_000_000)`, note: 'Exact numbers are an implementation detail; watch how they move, not the values.' },
      { label: 'Freed at zero', code: `class Res:
    def __init__(self, name):
        self.name = name
        print("open ", name)
    def __del__(self):
        print("close", self.name)

def handler():
    r = Res("per-request")
    print("  working")
    # r's last reference disappears when the frame returns

handler()
print("after handler()")

a = Res("shared")
b = a
del a
print("del a: still referenced by b")
b = None
print("end of script")`, note: 'CPython runs <code>__del__</code> right away. PyPy and other runtimes may not, which is why production code uses <code>with</code>.' },
      { label: 'Cycles need the GC', code: `import gc, weakref

class Node:
    def __init__(self, name):
        self.name = name
        self.peer = None

gc.disable()                      # only the cycle collector is off; refcounting still works
a, b = Node("a"), Node("b")
a.peer, b.peer = b, a             # a <-> b
probe = weakref.ref(a)            # watch a without keeping it alive

del a, b
print("names gone, a still alive?", probe() is not None)

found = gc.collect()              # explicit full collection
print("gc.collect() found unreachable objects:", found > 0)
print("a still alive?", probe() is not None)

# without a cycle, no collector is needed
c = Node("c")
probe_c = weakref.ref(c)
del c
print("acyclic c alive after del?", probe_c() is not None)
gc.enable()` },
      { label: 'Generations & thresholds', code: `import gc

print("thresholds:", gc.get_threshold())
print("counts now:", gc.get_count())

events = []
def on_gc(phase, info):
    if phase == "stop":
        events.append((info["generation"], info["collected"]))

gc.callbacks.append(on_gc)
junk = []
for i in range(5000):
    d = {"i": i}
    d["self"] = d                 # a tiny cycle each time
    junk.append(d) if i % 1000 == 0 else None
gc.callbacks.remove(on_gc)

print("collections triggered:", len(events))
print("first few (generation, collected):", events[:4])
print("counts after:", gc.get_count())`, note: 'Each gen-0 collection is triggered automatically by allocation pressure. Nothing here called <code>gc.collect()</code>.' },
      { label: 'weakref toolbox', code: `import weakref

class Model:
    def __init__(self, name): self.name = name
    def on_event(self, e): print(f"  {self.name} got {e}")

# 1) a cache that never keeps values alive
cache = weakref.WeakValueDictionary()
m = Model("gpt-small")
cache["small"] = m
print("cached:", list(cache))
del m
print("after del m:", list(cache))

# 2) bound methods are temporary objects: use WeakMethod
listener = Model("ui")
plain = weakref.ref(listener.on_event)
safe = weakref.WeakMethod(listener.on_event)
print("plain ref to bound method alive?", plain() is not None)
print("WeakMethod alive?", safe() is not None)
safe()("ping")

# 3) run cleanup when an object dies, without __del__
conn = Model("db-conn")
weakref.finalize(conn, print, "  finalize: closing db-conn")
del conn
print("done")` },
      { label: 'Find a leak (tracemalloc)', code: `import tracemalloc

SESSIONS = {}                     # module-level: lives forever

def handle(session_id, prompt):
    history = SESSIONS.setdefault(session_id, [])
    history.append(prompt * 50)   # never evicted
    return len(history)

tracemalloc.start()
before = tracemalloc.take_snapshot()
for i in range(20_000):
    handle(f"s{i % 500}", "token ")
after = tracemalloc.take_snapshot()

for stat in after.compare_to(before, "lineno")[:3]:
    print(stat)
current, peak = tracemalloc.get_traced_memory()
print(f"traced now {current/1e6:.1f} MB, peak {peak/1e6:.1f} MB")
tracemalloc.stop()`, note: 'The top line points at <code>history.append</code>: the growth is a reachable dict, not a GC bug.' }
    ]
  },
  gotchas: [
    { trap: 'Treating <code>__del__</code> as a destructor you can rely on', code: `class Conn:
    def __del__(self):
        self.sock.close()   # when? maybe never
        raise_if_flaky()    # exceptions here are printed, then ignored`, why: 'It runs when the refcount hits zero in CPython, later (or never) on other runtimes, after a cycle collection if the object is in a cycle, and possibly during interpreter shutdown when module globals are already gone. Exceptions inside it are reported as “Exception ignored in …” and swallowed.', fix: 'Use <code>with</code> / <code>contextlib.closing</code> for anything that must be released. For “clean up when this object dies”, use <code>weakref.finalize</code>, which also runs at exit.' },
    { trap: '<code>@lru_cache</code> on a method keeps every instance alive', code: `class Repo:
    @functools.lru_cache(maxsize=None)
    def load(self, key): ...
# the cache key includes self → every Repo ever created stays reachable`, why: 'The cache lives on the function (shared by the class) and stores <code>self</code> in each key. With <code>maxsize=None</code> it never evicts, so instances and everything they reference are never freed.', fix: 'Use <code>functools.cached_property</code> for per-instance values, a per-instance dict, or a module-level cached function keyed by a plain id. Always bound <code>maxsize</code>.' },
    { trap: 'Saving exceptions saves whole stack frames', code: `errors = []
for doc in docs:
    try:
        process(doc)            # locals include a 200 MB DataFrame
    except Exception as e:
        errors.append(e)        # e.__traceback__ → frames → locals`, why: 'A traceback references every frame it passed through, and each frame references its locals. That is also why Python deletes the <code>as e</code> name at the end of the <code>except</code> block.', fix: 'Store what you need: <code>repr(e)</code> or <code>traceback.format_exception(e)</code>. If you must keep the exception, drop the frames with <code>e.with_traceback(None)</code>.' },
    { trap: 'Thinking <code>gc.disable()</code> turns memory management off', why: 'It only disables the <b>cycle</b> collector. Refcounting keeps freeing acyclic objects. Cycles then accumulate forever, and the leak is slow enough to miss in tests.', fix: 'If GC pauses hurt, call <code>gc.freeze()</code> after startup (3.7+) so long-lived objects are skipped, or tune <code>gc.set_threshold</code> and measure. Keep <code>gc.collect()</code> available for diagnostics.' },
    { trap: '<code>weakref.ref(obj.method)</code> is dead on arrival', code: `r = weakref.ref(listener.on_event)
r() is None   # True: the bound method object was a temporary`, why: '<code>obj.method</code> builds a new bound-method object each time it is accessed. Nothing else holds that object, so its refcount drops to 0 right away.', fix: 'Use <code>weakref.WeakMethod(obj.method)</code>, which weakly references the instance and the function separately.' },
    { trap: 'Expecting RSS to drop after <code>del big</code>', why: 'Small objects (≤ 512 bytes) come from pymalloc pools inside larger arenas. An arena goes back to the OS only when <i>every</i> object in it is free, so a few survivors pin it. Freed memory is reused by Python, but the process size often stays high.', fix: 'Stream instead of loading everything; do big one-off jobs in a child process; recycle workers (<code>max_requests</code> in gunicorn, <code>max_tasks_per_child</code> for process pools).' },
    { trap: '<code>sys.getsizeof</code> is shallow', code: `sys.getsizeof([b"x" * 10_000_000])   # ~64 bytes: just the list`, why: 'It reports the object’s own allocation, not what it references. Containers look tiny.', fix: 'Use <code>tracemalloc</code> (attributes allocations to source lines) or a memory profiler such as memray to measure real usage.' }
  ],
  scenarios: [
    { title: 'Agent service grows 300 MB a day until the pod is OOM-killed',
      symptom: 'A FastAPI service that wraps an LLM agent restarts every couple of days with exit code 137. Memory climbs linearly with traffic and never comes down at night.',
      diagnose: `import tracemalloc
tracemalloc.start(25)
snap1 = tracemalloc.take_snapshot()
# ... an hour of traffic ...
snap2 = tracemalloc.take_snapshot()
for s in snap2.compare_to(snap1, "traceback")[:5]:
    print(s); print("\\n".join(s.traceback.format()))`,
      cause: 'Conversation history is kept in a module-level <code>dict[session_id, list[Message]]</code> and nothing ever evicts finished sessions. Everything is reachable, so neither refcounting nor the cycle collector may free it. This is a cache without a policy, not a GC bug.',
      fix: 'Bound it: an LRU/TTL structure with a maximum size, or move session state to Redis with an expiry. Add a memory-per-request dashboard and an alert on slope, not just on the limit.',
      fixCode: `from collections import OrderedDict

class LRU(OrderedDict):
    def __init__(self, maxsize: int):
        super().__init__(); self.maxsize = maxsize
    def __setitem__(self, k, v):
        super().__setitem__(k, v); self.move_to_end(k)
        if len(self) > self.maxsize:
            self.popitem(last=False)

SESSIONS: LRU = LRU(maxsize=10_000)` },
    { title: 'Pre-forked workers use 8× the memory of the master',
      symptom: 'A gunicorn app with <code>--preload</code> loads a 1.5 GB model and reference data, then forks 8 workers. Right after start total RSS is ~2 GB; an hour later each worker has its own ~1.5 GB.',
      diagnoseLang: 'bash',
      diagnose: `# per process: shared vs private pages
grep -E 'Shared|Private' /proc/<pid>/smaps_rollup`,
      cause: 'Fork shares pages copy-on-write. But merely <i>reading</i> a Python object writes its refcount, and every cyclic collection writes GC header fields on every tracked object it scans, so shared pages get dirtied and copied into each worker. (3.12’s immortal objects avoid this only for objects that are immortal.)',
      fix: 'Call <code>gc.freeze()</code> in the master just before forking, so the collector never touches the startup objects again; keep large numeric data in NumPy arrays or <code>mmap</code>/shared memory, whose buffers are not per-element Python objects.',
      fixCode: `# gunicorn.conf.py
import gc

def when_ready(server):  # runs in the master after the app is loaded, before workers fork
    gc.collect()
    gc.freeze()          # move every tracked object to the permanent generation

preload_app = True` },
    { title: 'p99 latency spikes every few seconds in a parsing service',
      symptom: 'A service that turns large JSON payloads into object graphs shows 50–200 ms stalls at a regular rhythm. CPU profiles blame no single function.',
      diagnose: `import gc, time
def timer(phase, info, _t=[0.0]):
    if phase == "start": _t[0] = time.perf_counter()
    else:
        ms = (time.perf_counter() - _t[0]) * 1000
        if ms > 10: log.warning("gc gen%s %.1f ms, collected %s", info["generation"], ms, info["collected"])
gc.callbacks.append(timer)`,
      cause: 'Allocating millions of dicts and lists keeps triggering collections, and the survivors pile into generation 2. Each full collection has to traverse all of them, so the stall grows with the size of the long-lived heap.',
      fix: 'Freeze static data after startup, avoid building cyclic structures (parent pointers as <code>weakref</code>), and if measurements justify it raise the gen-0 threshold. Re-measure: tuning thresholds trades latency for memory.',
      fixCode: `load_reference_data()
gc.collect()
gc.freeze()                         # 3.7+: exclude startup objects from future scans
gc.set_threshold(10_000, 20, 20)    # only after measuring` },
    { title: 'Closed WebSocket sessions are never freed',
      symptom: 'Memory grows with the number of connections ever opened, not with the number currently open.',
      diagnose: `import gc
leaked = [o for o in gc.get_objects() if type(o).__name__ == "Session" and o.closed]
print(len(leaked))
print([type(r).__name__ for r in gc.get_referrers(leaked[0])])   # → list, method`,
      cause: 'Each session subscribes <code>self.on_message</code> to a process-wide event bus that stores strong references. The bound method holds the session, so a closed session stays reachable for as long as the bus lives.',
      fix: 'Store <code>weakref.WeakMethod</code> handlers in the bus and drop dead ones on publish, and also unsubscribe explicitly in the session’s close path.',
      fixCode: `class Bus:
    def __init__(self): self._subs: list[weakref.WeakMethod] = []
    def subscribe(self, bound_method):
        self._subs.append(weakref.WeakMethod(bound_method))
    def publish(self, event):
        alive = []
        for ref in self._subs:
            if (fn := ref()) is not None:
                fn(event); alive.append(ref)
        self._subs = alive` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print in CPython?', code: `class R:
    def __init__(self, n):
        self.n = n
    def __del__(self):
        print("del", self.n)

a = R(1)
b = a
del a
print("after del a")
b = None
print("end")`, options: ['del 1<br>after del a<br>end', 'after del a<br>del 1<br>end', 'after del a<br>end<br>del 1', 'after del a<br>end'], answer: 1, run: true, expect: 'after del a\ndel 1\nend', explain: '<code>del a</code> removes one name; <code>b</code> still references the object, so its refcount is 1. <code>b = None</code> drops the last reference and CPython runs <code>__del__</code> <b>immediately</b>, before the next statement.' },
    { kind: 'predict', q: 'The cycle collector is disabled. What does this print?', code: `import gc, weakref

class Node:
    pass

gc.disable()
a = Node()
b = Node()
a.other = b
b.other = a
probe = weakref.ref(a)
del a, b
print(probe() is None)
gc.collect()
print(probe() is None)`, options: ['True<br>True', 'False<br>True', 'False<br>False', 'True<br>False'], answer: 1, run: true, expect: 'False\nTrue', explain: 'After <code>del</code> each object is still referenced once by the other, so refcounting can’t free them: the probe still sees <code>a</code>. <code>gc.disable()</code> only stops <i>automatic</i> collections; an explicit <code>gc.collect()</code> still runs, finds the unreachable cycle and frees it.' },
    { kind: 'predict', q: 'What does this print?', code: `import weakref

class User:
    def __init__(self, name):
        self.name = name

cache = weakref.WeakValueDictionary()
u = User("asha")
cache["asha"] = u
print(len(cache))
del u
print(len(cache))`, options: ['1<br>1', '1<br>0', '0<br>0', 'TypeError'], answer: 1, run: true, expect: '1\n0', explain: 'The dictionary holds the value weakly. When the last strong reference (<code>u</code>) goes, the refcount hits 0, the object is freed and the weakref callback removes the entry at once.' },
    { kind: 'predict', q: 'Which lines print?', code: `import weakref

try:
    weakref.ref(42)
except TypeError:
    print("int: no")

class Slotted:
    __slots__ = ("x",)

try:
    weakref.ref(Slotted())
except TypeError:
    print("slots: no")

class Plain:
    pass

print("plain:", weakref.ref(Plain())() is None)`, options: ['int: no<br>plain: True', 'int: no<br>slots: no<br>plain: True', 'int: no<br>slots: no<br>plain: False', 'slots: no<br>plain: False'], answer: 1, run: true, expect: 'int: no\nslots: no\nplain: True', explain: 'Built-ins like <code>int</code>, <code>str</code>, <code>tuple</code>, <code>list</code> and <code>dict</code> can’t be weakly referenced. A class with <code>__slots__</code> has no <code>__weakref__</code> slot unless you list it. A plain instance can, but <code>Plain()</code> is a temporary: it dies as soon as the call returns, so the weakref is already dead.' },
    { kind: 'predict', q: 'What does this print?', code: `import weakref

class Conn:
    pass

c = Conn()
weakref.finalize(c, print, "closed")
print("before")
del c
print("after")`, options: ['before<br>after<br>closed', 'before<br>closed<br>after', 'closed<br>before<br>after', 'before<br>after'], answer: 1, run: true, expect: 'before\nclosed\nafter', explain: '<code>finalize</code> registers a callback on a weak reference and keeps itself alive in a registry. <code>del c</code> drops the only strong reference, so the callback runs right away. If the object were still alive at exit, <code>finalize</code> would run it then (by default).' },
    { kind: 'predict', q: 'What does this print?', code: `try:
    1 / 0
except ZeroDivisionError as e:
    pass

print("e" in globals())`, options: ['True', 'False', 'NameError', 'ZeroDivisionError'], answer: 1, run: true, expect: 'False', explain: 'Python implicitly runs <code>del e</code> at the end of the <code>except</code> block. The exception’s traceback references the current frame, and the frame references <code>e</code>: keeping the name would create a reference cycle that holds every local alive until the next collection.' },
    { kind: 'concept', q: 'A worker calls <code>gc.disable()</code> at startup “for performance” and never re-enables it. What happens to objects without cycles?', options: ['They leak: nothing frees memory any more', 'They are still freed immediately by reference counting', 'They are freed at interpreter exit only', 'They are freed at the next <code>gc.collect()</code> only'], answer: 1, explain: 'Reference counting is not part of the <code>gc</code> module and can’t be turned off. Only cycles accumulate, which makes the leak slow and easy to miss. <code>gc.freeze()</code> after startup is usually the better latency fix.' },
    { kind: 'concept', q: 'During a collection, CPython copies each tracked object’s refcount into a scratch field, then subtracts every reference that comes from another object in the same generation. What does a result greater than zero mean?', options: ['The object is garbage', 'Something outside the generation (a name, an older object, C code) references it, so it is a root that must survive', 'The object has a <code>__del__</code> method', 'The object is immortal'], answer: 1, explain: 'After subtracting internal references, whatever is left must come from outside the set being scanned. Those objects are roots; everything reachable from them survives. Objects left at zero and not reachable from a root are unreachable cycles.' }
  ],
  interview: [
    { q: 'How does CPython manage memory?', a: '<p>Three layers. <b>Reference counting</b> frees an object as soon as its count drops to zero. The <b>cyclic garbage collector</b> (<code>gc</code>) periodically finds and frees reference cycles among container objects. Underneath, the <b>pymalloc</b> allocator serves small objects (≤ 512 bytes) from pools inside arenas; larger ones go to the system allocator.</p>', fu: 'Which objects does the cycle collector track? (Containers that can reference other objects: lists, dicts, sets, instances, frames. Ints and strings aren’t tracked.)', lvl: 'core' },
    { q: 'Why does Python need a garbage collector if it has reference counting?', a: '<p>Refcounting can’t free cycles: in <code>a.peer = b; b.peer = a</code> each object keeps the other at refcount ≥ 1 after the program loses both. Cycles are common (parent ↔ child pointers, exceptions ↔ frames, closures referencing themselves), so the cycle collector exists only to find those groups.</p>', lvl: 'core' },
    { q: 'Explain the generations and thresholds.', a: '<p>Tracked objects start in generation 0. When allocations minus deallocations of tracked objects exceed threshold 0 (700 by default in 3.12/3.13), gen 0 is collected; survivors move to gen 1. Every 10 gen-0 collections, gen 1 is collected too, and every 10 of those, gen 2, the oldest. A full gen-2 collection is additionally skipped unless the objects that survived since the last full one exceed 25% of the long-lived total, so huge heaps aren’t rescanned constantly. The idea is the generational hypothesis: most objects die young.</p>', fu: 'What changed in 3.14? (The collector became incremental, with a young and an old generation instead of three; check your version’s docs before tuning.)', lvl: 'deep' },
    { q: 'How does the collector decide an object is unreachable?', a: '<ol><li>Copy each object’s refcount into a scratch field (<code>gc_refs</code>).</li><li>For every object in the generation, visit its referents (<code>tp_traverse</code>) and decrement their <code>gc_refs</code> if they are in the same generation.</li><li>Objects with <code>gc_refs &gt; 0</code> are referenced from outside: they are roots. Mark everything reachable from them.</li><li>The rest are unreachable: run finalizers and weakref callbacks, then clear their references (<code>tp_clear</code>) so refcounting frees them.</li></ol><p>No stack scanning is needed, which is why C extensions must implement <code>tp_traverse</code> correctly.</p>', lvl: 'deep' },
    { q: 'What happens to a cycle whose objects define <code>__del__</code>?', a: '<p>Since 3.4 (PEP 442) they are collected normally: finalizers run once, in no guaranteed order, and an object resurrected by its finalizer is simply kept. Before 3.4 such cycles were moved to <code>gc.garbage</code> and leaked. Today <code>gc.garbage</code> mostly holds objects from old C extensions, or everything when you set <code>gc.DEBUG_SAVEALL</code>.</p>', lvl: 'deep' },
    { q: 'What is a weak reference, and where would you use one?', a: '<p>A reference that does not increment the refcount; calling it returns the object or <code>None</code> once it’s gone. Use it for caches (<code>WeakValueDictionary</code>), metadata attached to objects you don’t own (<code>WeakKeyDictionary</code>), observers (<code>WeakSet</code>, <code>WeakMethod</code>), back-pointers that would otherwise form cycles (child → parent), and cleanup hooks (<code>weakref.finalize</code>). Not every type supports it: <code>int</code>, <code>str</code>, <code>tuple</code>, <code>list</code>, <code>dict</code> don’t, and <code>__slots__</code> classes need a <code>__weakref__</code> slot.</p>', lvl: 'core' },
    { q: 'How would you find a memory leak in a production Python service?', a: '<ul><li>Confirm the slope (RSS over time per worker) and rule out bounded growth.</li><li><code>tracemalloc</code>: take two snapshots some time apart and <code>compare_to</code> by line or traceback.</li><li>Count live objects by type (<code>gc.get_objects()</code>, or objgraph) and walk back with <code>gc.get_referrers</code> to the root that holds them.</li><li>For native memory (C extensions, buffers), use a native-aware profiler such as memray.</li></ul><p>The usual culprits are unbounded caches, global registries, stored tracebacks and callbacks holding <code>self</code>.</p>', lvl: 'core' },
    { q: 'What are immortal objects (3.12), and why do they matter?', a: '<p>PEP 683 marks objects such as <code>None</code>, booleans, small ints and interned strings as immortal: their refcount is a fixed sentinel and increments/decrements leave it alone. That removes refcount writes to these shared objects, which helps copy-on-write after <code>fork</code>, multiple interpreters (each with its own GIL in 3.12) and the free-threaded build, where contended refcount updates would otherwise be expensive.</p>', lvl: 'deep' },
    { q: 'How does reference counting work in the free-threaded build (3.13t)?', a: '<p>PEP 703 uses <b>biased reference counting</b>: each object has an owning thread that updates a local count without atomic instructions, while other threads update a separate shared count atomically. Many common objects are immortal, and some are given deferred refcounting. The cycle collector in that build stops all threads while it runs and is not generational. See <a href="gil.html">The GIL &amp; free-threading</a>.</p>', lvl: 'deep' },
    { q: 'Compare CPython’s memory management with the JVM’s.', a: '<p>The JVM uses tracing collectors only (G1, ZGC…): objects die “at some later point”, and finalization is deprecated in favour of <code>Cleaner</code> and try-with-resources. CPython frees most objects deterministically at refcount zero, with a tracing collector only for cycles, and it never moves objects (so <code>id()</code> is stable and C extensions can hold raw pointers). The price is a refcount write on every reference change and no compaction, so fragmentation can keep RSS high.</p>', fu: 'Why doesn’t CPython compact the heap? (C extensions hold raw <code>PyObject*</code> pointers, so objects can’t move.)', lvl: 'core' },
    { q: 'What does <code>gc.freeze()</code> do, and when would you call it?', a: '<p>Added in 3.7, it moves every currently tracked object into a permanent generation that future collections ignore. Call it in a pre-fork server after loading the app and just before forking: collections in the workers then don’t touch (and copy) the shared pages, and full collections get cheaper because they skip startup objects.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Leak hunt: tracemalloc diff endpoint', lang: 'python', code: `import gc
import tracemalloc
from fastapi import FastAPI

app = FastAPI()
_baseline: tracemalloc.Snapshot | None = None

@app.post("/debug/mem/baseline")
def baseline() -> dict:
    global _baseline
    if not tracemalloc.is_tracing():
        tracemalloc.start(15)            # keep 15 frames per allocation
    gc.collect()
    _baseline = tracemalloc.take_snapshot()
    return {"ok": True}

@app.get("/debug/mem/diff")
def diff(limit: int = 10) -> list[str]:
    if _baseline is None:
        return ["call /debug/mem/baseline first"]
    gc.collect()                          # don't blame garbage that is just uncollected
    snap = tracemalloc.take_snapshot().filter_traces(
        [tracemalloc.Filter(False, tracemalloc.__file__)])
    return [str(s) for s in snap.compare_to(_baseline, "traceback")[:limit]]`, note: 'Guard these routes (internal network or admin auth). <code>tracemalloc</code> costs CPU and memory while it is on.' },
    { title: 'Weak back-pointers instead of cycles', lang: 'python', code: `from __future__ import annotations
import weakref
from dataclasses import dataclass, field

@dataclass(eq=False)
class TreeNode:
    name: str
    children: list[TreeNode] = field(default_factory=list)
    _parent: weakref.ref[TreeNode] | None = field(default=None, repr=False)

    @property
    def parent(self) -> TreeNode | None:
        return self._parent() if self._parent else None

    def add(self, child: TreeNode) -> TreeNode:
        child._parent = weakref.ref(self)   # child → parent does not keep parent alive
        self.children.append(child)
        return child

root = TreeNode("root")
leaf = root.add(TreeNode("leaf"))
assert leaf.parent is root
del root                                    # freed by refcounting, no cycle collection needed
assert leaf.parent is None`, note: 'Strong references point down the tree, weak ones point up. The whole tree is freed deterministically when the root goes.' },
    { title: 'Java comparison: resources and weak maps', lang: 'java', code: `// Java: no refcounting. Release resources explicitly, let the GC handle memory.
try (var conn = dataSource.getConnection()) {        // ≈ Python: with pool.connection() as conn:
    run(conn);
}

// WeakHashMap ≈ weakref.WeakKeyDictionary (weak KEYS, strong values)
Map<Session, Metrics> perSession = new WeakHashMap<>();

// Cleaner ≈ weakref.finalize: a callback after the object becomes unreachable
private static final Cleaner CLEANER = Cleaner.create();
CLEANER.register(buffer, () -> nativeFree(address)); // must not capture 'buffer' itself

// What has no Java equivalent: CPython frees an acyclic object *immediately*
// when its last reference goes. Don't rely on it, though: PyPy doesn't.`, note: 'The Python rule matches the Java one: deterministic cleanup comes from <code>with</code>/try-with-resources, never from finalizers.' }
  ]
});
