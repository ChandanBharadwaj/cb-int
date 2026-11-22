IA.register({
  track: 'python',
  slug: 'dict-internals',
  title: 'Dict & set internals',
  tagline: 'A CPython <code>dict</code> is an <b>open-addressing hash table</b> split in two: a small sparse array of <b>indices</b> and a dense, insertion-ordered array of <b>entries</b>. That split is why dicts are compact, why they remember insertion order, and why a bad <code>__hash__</code> or a mutated key quietly breaks them.',
  tldr: {
    problem: 'Dicts are everywhere in Python (namespaces, kwargs, JSON, instance attributes), so their edge cases leak into everything: a key that can’t be found after it was mutated, <code>{1: …, True: …}</code> collapsing to one entry, flaky tests from set ordering, or a lookup that degrades to a linear scan.',
    model: 'Lookup: compute <code>hash(key)</code>, start at slot <code>hash &amp; mask</code> in the indices array, and follow a fixed probe sequence until you hit an empty slot. Each occupied slot points into the entries array, where the stored hash is compared first, then identity (<code>is</code>), then <code>==</code>. Deletions leave a <b>dummy</b> marker so later probes keep going. When the table is ⅔ full it is rebuilt bigger.',
    hook: '“Why does a dict keep insertion order?” Because since 3.6 the entries live in a dense array appended in insertion order; the hash table only stores small integers pointing into it. Iteration just walks the entries array. 3.7 made the order a language guarantee.',
    facts: [
      { v: '⅔', l: 'maximum fill: a table with 8 index slots holds at most 5 entries before it is resized. 8 slots is the minimum size' },
      { v: '3.7', l: 'insertion order became a language guarantee. In 3.6 it was an implementation detail of CPython’s compact dict' },
      { v: 'hash(-1) == -2', l: '−1 is the C-level error code for hash functions, so CPython maps it to −2. Small ints otherwise hash to themselves' }
    ]
  },
  intro: {
    what: 'A <b>dictionary</b> maps keys to values: <code>{"asha": 31, "ben": 27}</code>. Looking up a key is fast, about the same speed whether the dict has 10 entries or 10 million, because Python doesn’t search through the keys. It turns the key into a number (its <b>hash</b>) and uses that number to jump almost directly to the right place. A <b>set</b> is the same idea with keys only.',
    analogy: { icon: '🧥', title: 'A cloakroom with numbered hooks', text: 'You hand over a coat and the attendant computes a hook number from your name. If that hook is taken, they follow a fixed rule to try other hooks until one is free, and the same rule finds your coat later. Your ticket stub also goes into a ledger in the order coats arrived. When the hooks are two-thirds full, the attendant moves to a bigger room and re-hangs everything.' },
    steps: [
      { t: 'Keys are hashed', d: '<code>hash()</code> turns a key into an int. Equal keys must have equal hashes.', code: 'hash(42)        # 42\nhash("asha")    # a big int, different on every run\nhash((1, 2))    # tuples of hashables are hashable' },
      { t: 'The hash picks a slot', d: 'The low bits of the hash choose a slot in a table whose size is a power of two. <code>hash &amp; (size - 1)</code>.' },
      { t: 'Collisions probe onward', d: 'If two keys want the same slot, the second tries a sequence of other slots, determined by its hash, until it finds an empty one.' },
      { t: 'Entries stay in order', d: 'The key and value go into a separate list in arrival order. That list is what you see when you loop over the dict.' },
      { t: 'Only hashable keys', d: 'Lists, dicts and sets can change, so their hash could change too. Python refuses to use them as keys.', code: '{[1, 2]: "x"}   # TypeError: unhashable type: \'list\'\n{(1, 2): "x"}   # fine' }
    ],
    terms: [
      ['hash', 'An int computed from a key by <code>__hash__</code>. Equal objects must have equal hashes.'],
      ['hashable', 'Has a hash that never changes during its lifetime: ints, strs, tuples of hashables, frozensets, frozen dataclasses.'],
      ['collision', 'Two different keys whose hashes pick the same slot.'],
      ['open addressing', 'Resolving collisions by trying other slots in the same array, instead of chaining lists per bucket (Java’s <code>HashMap</code>).'],
      ['dummy', 'A marker left in a slot after deletion, so probe sequences that passed through it still work.'],
      ['load factor', 'How full the table is. CPython resizes dicts at ⅔.']
    ]
  },
  visual: {
    title: 'Inside a compact dict: indices + entries',
    caption: 'Press <b>Play</b> or <b>Step</b>. The keys are small ints so <code>hash(k) == k</code> and you can check the arithmetic. Watch 18 collide with 10, the probe formula pick the next slot, a deletion leave a <b>dummy</b>, a lookup walk past it, and the sixth insert trigger a resize that compacts the entries.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Build the table by hand', code: `PERTURB_SHIFT = 5
EMPTY, DUMMY = None, "D"

class ToyDict:
    """CPython's compact dict layout, simplified (non-negative int keys)."""
    def __init__(self, size=8):
        self.size, self.indices, self.entries = size, [EMPTY] * size, []
        self.usable = size * 2 // 3                  # resize at 2/3 full

    def _probe(self, h):
        mask, i, perturb = self.size - 1, h & (self.size - 1), h
        while True:
            yield i
            perturb >>= PERTURB_SHIFT
            i = (i * 5 + perturb + 1) & mask

    def _find(self, key):
        h = hash(key)
        for i in self._probe(h):
            ix = self.indices[i]
            if ix is EMPTY:
                return None
            if ix != DUMMY and self.entries[ix][1] == key:
                return i, ix

    def __setitem__(self, key, value):
        if (hit := self._find(key)):
            self.entries[hit[1]][2] = value; return
        if self.usable == 0:
            self._resize()
        for i in self._probe(hash(key)):
            if self.indices[i] in (EMPTY, DUMMY):
                break
        self.indices[i] = len(self.entries)
        self.entries.append([hash(key), key, value])
        self.usable -= 1

    def __delitem__(self, key):
        i, ix = self._find(key)
        self.indices[i], self.entries[ix] = DUMMY, None

    def _resize(self):
        live = [e for e in self.entries if e]
        new = 8
        while new < len(live) * 3:                   # GROWTH_RATE = used * 3
            new *= 2
        self.__init__(new)
        for h, k, v in live:
            self[k] = v

    def show(self, label):
        print(f"{label:<12} size={self.size} usable={self.usable}")
        print("   indices:", ["." if x is EMPTY else x for x in self.indices])
        print("   entries:", [e and (e[1], e[2]) for e in self.entries])

d = ToyDict()
for k, v in [(10, "a"), (18, "b"), (3, "c"), (7, "d")]:
    d[k] = v
d.show("4 inserts")
del d[18]
d.show("del 18")
d[42] = "e"
d.show("insert 42")
d[5] = "f"
d.show("insert 5")`, note: 'Same keys as the animation above. Try inserting 26 or 34: they also start at slot 2.' },
      { label: 'Key rules', code: `from dataclasses import dataclass

print({True: "a", 1: "b", 1.0: "c"})        # equal keys: first key kept, last value wins
print(hash(1) == hash(1.0) == hash(True))

nan = float("nan")
d = {nan: "found"}
print(nan in d, float("nan") in d)          # identity is checked before ==

for bad in ([1, 2], {"a": 1}, {1, 2}):
    try:
        {bad: 1}
    except TypeError as e:
        print("TypeError:", e)

@dataclass(frozen=True)
class Point:
    x: int
    y: int

@dataclass
class MutablePoint:
    x: int
    y: int

print({Point(1, 2): "ok"})
print(MutablePoint.__hash__)                 # eq=True without frozen -> unhashable` },
      { label: 'Insertion order', code: `d = {"b": 1, "a": 2, "c": 3}
d["a"] = 20                 # updating a value keeps its position
print(list(d))

del d["b"]
d["b"] = 1                  # delete + re-insert moves it to the end
print(list(d))

print(list(reversed(d)))    # 3.8+: dicts and their views are reversible
print(d | {"z": 0, "a": 0}) # 3.9+: merge, right side wins, new keys appended

print({"x": 1, "y": 2} == {"y": 2, "x": 1})       # dict equality ignores order
from collections import OrderedDict
print(OrderedDict(x=1, y=2) == OrderedDict(y=2, x=1))   # OrderedDict compares order
s = {3, 1, 2}
print(s, "<- small-int sets often look sorted; never rely on set order")` },
      { label: 'Collisions get slow', code: `import time

class Good:
    __slots__ = ("v",)
    def __init__(self, v): self.v = v
    def __eq__(self, o): return self.v == o.v
    def __hash__(self): return hash(self.v)

class Bad(Good):
    __slots__ = ()
    def __hash__(self): return 42          # every key collides

for cls in (Good, Bad):
    keys = [cls(i) for i in range(2000)]
    t0 = time.perf_counter()
    d = {k: True for k in keys}
    hit = all(k in d for k in keys)
    print(f"{cls.__name__:4}: {time.perf_counter() - t0:.4f} s for 2000 inserts + lookups ({hit})")`, note: 'With one shared hash, every insert and lookup walks the whole probe chain comparing with <code>==</code>: O(n) each, O(n²) total.' },
      { label: 'Growth steps', code: `import sys

d, last = {}, sys.getsizeof({})
print(f"empty dict: {last} bytes")
for i in range(50):
    d[i] = i
    size = sys.getsizeof(d)
    if size != last:
        print(f"after {len(d):2} items: {size:5} bytes  (resized)")
        last = size

for i in range(45):
    del d[i]
print(f"5 items left after deletes: {sys.getsizeof(d)} bytes (no shrink)")
print(f"rebuilt with dict(d): {sys.getsizeof(dict(d))} bytes")`, note: 'Exact byte counts vary by version and platform. The pattern doesn’t: resizes at ⅔ full, and no shrinking on delete.' }
    ]
  },
  gotchas: [
    { trap: 'Mutating an object after using it as a key', code: `@dataclass(unsafe_hash=True)
class Key:
    tenant: str
    id: int
k = Key("t1", 1); cache = {k: "v"}
k.id = 2
k in cache            # False: looked up under the new hash
Key("t1", 1) in cache # False: right slot, but == fails`, why: 'The entry is stored at a slot chosen by the hash at insertion time. After mutation, lookups probe from the wrong slot, and an equal-looking new key no longer compares equal to the stored object.', fix: 'Keys must be immutable in every field used by <code>__eq__</code>/<code>__hash__</code>: <code>@dataclass(frozen=True)</code>, tuples, <code>NamedTuple</code>. Avoid <code>unsafe_hash=True</code>.' },
    { trap: 'Defining <code>__eq__</code> makes the class unhashable', code: `class Money:
    def __init__(self, cents): self.cents = cents
    def __eq__(self, o): return self.cents == o.cents
{Money(1)}   # TypeError: unhashable type: 'Money'`, why: 'If you override <code>__eq__</code> without <code>__hash__</code>, Python sets <code>__hash__ = None</code>, because the inherited identity hash would break the rule “equal objects have equal hashes”. <code>@dataclass</code> (eq=True, not frozen) does the same.', fix: 'Define <code>__hash__</code> over exactly the fields <code>__eq__</code> compares, e.g. <code>return hash((self.cents,))</code>, or use a frozen dataclass.' },
    { trap: 'Changing a dict’s size while iterating it', code: `for k in d:
    if expired(k):
        del d[k]      # RuntimeError: dictionary changed size during iteration`, why: 'The iterator walks the entries array by position and checks the dict’s size on each step. Insertions and deletions could make it skip or repeat entries, so CPython raises instead. Assigning to an existing key is allowed.', fix: 'Iterate over a snapshot (<code>for k in list(d):</code>) or build a new dict: <code>d = {k: v for k, v in d.items() if not expired(k)}</code>.' },
    { trap: '<code>1</code>, <code>1.0</code> and <code>True</code> are the same key', code: `{1: "int", 1.0: "float", True: "bool"}   # {1: 'bool'}`, why: 'They compare equal and hash the same, so they are one key. The first key object is kept and the last value wins.', fix: 'Don’t mix numeric types (or bools) as keys of one dict. Normalise keys at the boundary, e.g. always <code>str</code> ids.' },
    { trap: 'Relying on set (or string-hash) order', code: `print({"b", "a", "c"})   # order can differ on the next run`, why: 'String and bytes hashes are randomised per process (PEP 456, <code>PYTHONHASHSEED</code>) to resist hash-flooding attacks. Sets are ordered by slot, so their iteration order changes between runs. Dicts are fine: they iterate in insertion order.', fix: 'Sort before printing, serialising or comparing: <code>sorted(s)</code>. In tests, compare sets as sets.' },
    { trap: 'A <code>__hash__</code> that ignores most fields', code: `def __hash__(self): return hash(self.tenant_id)   # 1 big tenant = 1 hash`, why: 'Valid (equal objects still hash equal), but every key of the same tenant collides, so lookups degrade toward a linear scan with an <code>__eq__</code> call per probe.', fix: 'Hash a tuple of all the fields that <code>__eq__</code> compares: <code>hash((self.tenant_id, self.id))</code>.' },
    { trap: 'Expecting a dict to shrink after mass deletion', why: 'Deletes only leave dummies. The table is rebuilt only when an insert runs out of usable slots, so a dict that once held 10M entries keeps its big table even with 10 left.', fix: 'Rebuild it (<code>d = dict(d)</code>) or <code>d.clear()</code> when you want the memory back. Better, bound such caches in the first place.' }
  ],
  scenarios: [
    { title: 'p99 latency explodes for the biggest tenant',
      symptom: 'An in-process permission cache keyed by a <code>Grant</code> object is fast for small tenants, but requests for the largest tenant (400k grants) take hundreds of milliseconds.',
      diagnose: `import collections
hashes = collections.Counter(hash(k) for k in CACHE)
print(hashes.most_common(3))       # [(8812..., 400000), ...]: one hash for 400k keys`,
      cause: '<code>Grant.__hash__</code> returned <code>hash(self.tenant_id)</code>. All of the tenant’s keys share one hash, so every lookup probes a long chain and calls <code>__eq__</code> at each step.',
      fix: 'Hash the same fields that equality uses. A frozen dataclass generates a consistent <code>__eq__</code> and <code>__hash__</code> for you.',
      fixCode: `@dataclass(frozen=True, slots=True)
class Grant:
    tenant_id: str
    principal: str
    action: str          # __eq__ and __hash__ both use all three fields` },
    { title: 'Snapshot tests fail on one CI run in five',
      symptom: 'A test compares an API response against a stored JSON file. It passes locally, and fails intermittently in CI with the same tags in a different order.',
      diagnose: `$ for i in 1 2 3; do python -c 'print({"llm", "rag", "agent"})'; done
{'rag', 'agent', 'llm'}
{'llm', 'rag', 'agent'}
{'agent', 'llm', 'rag'}`,
      diagnoseLang: 'bash',
      cause: 'The handler builds <code>tags</code> as a <code>set[str]</code> and serialises it with <code>list(tags)</code>. String hashing is randomised per process, so the slot order, and therefore the list order, changes between runs.',
      fix: 'Make the output order explicit. Sorting is the simplest; keep a dict (insertion-ordered) if the original order matters.',
      fixCode: `return {"tags": sorted(tags)}
# or, to keep first-seen order while de-duplicating:
return {"tags": list(dict.fromkeys(raw_tags))}` },
    { title: 'Cache entries “disappear” after an update',
      symptom: 'An LLM response cache keyed by a request object returns misses for requests that were definitely cached, and the cache keeps growing with duplicates.',
      diagnose: `key = RequestKey(model="m1", prompt=p)
cache[key] = resp
key.temperature = 0.2          # mutated by a later code path
print(key in cache, len(cache))  # False, and the next put adds a duplicate`,
      cause: 'The key class used <code>@dataclass(unsafe_hash=True)</code> and stayed mutable. A later code path changed a field, so the stored entry now sits under a slot that no longer matches the key’s hash.',
      fix: 'Freeze key types, and derive a new key with <code>dataclasses.replace</code> instead of mutating.',
      fixCode: `@dataclass(frozen=True)
class RequestKey:
    model: str
    prompt: str
    temperature: float = 0.0

key2 = dataclasses.replace(key, temperature=0.2)   # a new, separate key` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `d = {True: "a", 1: "b", 1.0: "c"}
print(d)`, options: ["{True: 'a', 1: 'b', 1.0: 'c'}", "{True: 'c'}", "{1.0: 'c'}", "{1: 'c'}"], answer: 1, run: true, expect: "{True: 'c'}", explain: '<code>True == 1 == 1.0</code> and they hash alike, so all three are one key. Re-assigning an existing key updates the <b>value</b> but keeps the <b>original key object</b> (<code>True</code>) in its original position.' },
    { kind: 'predict', q: 'What does this print?', code: `d = {"a": 1, "b": 2, "c": 3}
del d["a"]
d["a"] = 1
d["b"] = 20
print(list(d))`, options: ["['a', 'b', 'c']", "['b', 'c', 'a']", "['c', 'a', 'b']", "['b', 'a', 'c']"], answer: 1, run: true, expect: "['b', 'c', 'a']", explain: 'Deleting removes the entry; inserting <code>"a"</code> again appends a <b>new</b> entry at the end. Updating <code>"b"</code> changes its value in place, so its position doesn’t move.' },
    { kind: 'predict', q: 'What does this print?', code: `d = {"a": 1, "b": 2}
try:
    for k in d:
        d[k + "!"] = 0
except RuntimeError as e:
    print(e)`, options: ['Nothing: the loop finishes', 'dictionary changed size during iteration', 'dictionary keys changed during iteration', 'It loops forever'], answer: 1, run: true, expect: 'dictionary changed size during iteration', explain: 'The first iteration adds <code>"a!"</code>. On the next step the iterator sees the size changed and raises <code>RuntimeError</code>. Updating the value of an existing key would have been fine.' },
    { kind: 'predict', q: 'The key object is mutated after insertion. What does this print?', code: `class K:
    def __init__(self, v):
        self.v = v
    def __hash__(self):
        return hash(self.v)
    def __eq__(self, other):
        return self.v == other.v

k = K(1)
d = {k: "x"}
k.v = 2
print(k in d, K(1) in d, len(d))`, options: ['True True 1', 'True False 1', 'False False 1', 'False True 1'], answer: 2, run: true, expect: 'False False 1', explain: '<code>k in d</code> now hashes to 2 and probes slot 2, which is empty: not found. <code>K(1)</code> hashes to 1 and reaches the right entry, but equality compares <code>1 == 2</code> (the stored key was mutated): not found either. The entry is still there, unreachable by any lookup.' },
    { kind: 'predict', q: 'What does this print?', code: `nan = float("nan")
d = {nan: 1}
print(nan in d, float("nan") in d)`, options: ['True True', 'False False', 'True False', 'False True'], answer: 2, run: true, expect: 'True False', explain: 'NaN is not equal to itself, but dict lookups check <b>identity first</b> (<code>is</code>), then <code>==</code>. The same NaN object is found; a different NaN object fails <code>==</code>, so it isn’t.' },
    { kind: 'predict', q: 'What does this print?', code: `class P:
    def __init__(self, x):
        self.x = x
    def __eq__(self, other):
        return self.x == other.x

try:
    s = {P(1)}
    print(len(s))
except TypeError as e:
    print(e)`, options: ['1', "unhashable type: 'P'", "P object has no attribute '__hash__'", '0'], answer: 1, run: true, expect: "unhashable type: 'P'", explain: 'Defining <code>__eq__</code> without <code>__hash__</code> sets <code>P.__hash__ = None</code>, which makes instances unhashable. Without the <code>__eq__</code>, instances would hash by identity and the set would work.' },
    { kind: 'concept', q: 'An empty dict has 8 index slots (mask 7). You insert 10, then 18 (ints hash to themselves). Using CPython’s probe <code>i = (5*i + perturb + 1) &amp; mask</code> with <code>perturb</code> shifted right by 5 first, which slot does 18 land in?', options: ['2', '3', '4', '7'], answer: 1, explain: '18 &amp; 7 = 2, already taken by 10. <code>perturb = 18 &gt;&gt; 5 = 0</code>, so the next slot is <code>(5·2 + 0 + 1) &amp; 7 = 11 &amp; 7 = 3</code>. That slot is empty, so the index array gets <code>[3] = 1</code> (entry #1). The animation shows exactly this step.' },
    { kind: 'concept', q: 'A service prints <code>list(set_of_tag_strings)</code>. Why can the order differ between two runs of the same code with the same input?', options: ['Sets are sorted by insertion time', 'String hashes are randomised per process, so the slots, and therefore the set’s iteration order, change', 'The garbage collector reorders sets', 'Set order only changes on Windows'], answer: 1, explain: 'Hash randomisation (PEP 456) protects against hash-flooding DoS. Sets iterate in slot order, which depends on the hashes. Dicts iterate in insertion order, so they are unaffected. Set <code>PYTHONHASHSEED=0</code> only for debugging.' }
  ],
  interview: [
    { q: 'How is a Python dict implemented?', a: '<p>An open-addressing hash table in two parts. A sparse <b>indices</b> array whose size is a power of two holds small ints (1 byte each for tables up to 128 slots, growing to 2, 4 or 8 bytes). They point into a dense <b>entries</b> array of <code>(hash, key, value)</code> in insertion order. A lookup hashes the key, starts at <code>hash &amp; mask</code>, follows the perturbation probe sequence, and for each candidate compares the stored hash, then identity, then <code>==</code>.</p>', fu: 'Why the split? (Memory: only the tiny indices array is sparse, while the much bigger entries have no holes; iteration is a tight loop over a dense array. Since 3.11, dicts whose keys are all <code>str</code> use smaller entries without a stored hash, because each str caches its own.)', lvl: 'core' },
    { q: 'Why does a dict preserve insertion order?', a: '<p>Because entries are appended to a dense array, and iteration walks that array. It started as a side effect of the compact layout in CPython 3.6 and became a language guarantee in 3.7. A deleted entry leaves a hole that iteration skips; re-inserting the key appends at the end.</p>', lvl: 'core' },
    { q: 'What does the probe sequence look like, and why not linear probing?', a: '<p><code>i = (5*i + 1 + perturb) mod 2**k</code>, where <code>perturb</code> starts as the full hash and is shifted right 5 bits each step. The recurrence <code>5i + 1</code> alone visits every slot of a power-of-two table; mixing in <code>perturb</code> makes the higher hash bits matter, so keys that share low bits (common with ints) spread out instead of clustering. Sets do a few linear probes first, for cache locality, then jump.</p>', lvl: 'deep' },
    { q: 'What happens on delete?', a: '<p>The index slot becomes a <b>dummy</b> and the entry is cleared. The slot can’t simply be marked empty: other keys may have probed past it, and an empty slot would end their lookups early. Dummies count against the fill, so heavy insert/delete churn leads to a rebuild, which drops them and compacts the entries.</p>', lvl: 'deep' },
    { q: 'When does a dict resize, and to what size?', a: '<p>When an insert finds no usable entries left. The table holds ⅔ of its slots (5 of 8). The new size is the smallest power of two at least 3 × the number of live items, so a dict with 5 live items goes from 8 to 16 slots. Resizing rehashes nothing (hashes are stored) but re-inserts every live entry. It is O(n) occasionally, O(1) amortised per insert. Deletes never shrink the table.</p>', lvl: 'deep' },
    { q: 'What makes an object a valid dict key?', a: '<p>It must be hashable: <code>__hash__</code> returns an int that never changes during the object’s lifetime, and <code>a == b</code> implies <code>hash(a) == hash(b)</code>. Built-in immutables qualify; tuples and frozensets qualify if their contents do. Mutable built-ins (<code>list</code>, <code>dict</code>, <code>set</code>) are unhashable. Defining <code>__eq__</code> without <code>__hash__</code> makes a class unhashable.</p>', fu: 'Is a tuple containing a list hashable? (No: <code>hash((1, [2]))</code> raises TypeError.)', lvl: 'core' },
    { q: 'Why are string hashes randomised?', a: '<p>To defeat hash-flooding attacks, where a client sends many keys crafted to collide (for example as form fields or JSON keys) and turns dict building into O(n²). Since 3.3 str and bytes hashes are salted per process; PEP 456 (3.4) switched the algorithm to SipHash. Ints are not randomised: <code>hash(n) == n</code> for small ints.</p>', lvl: 'core' },
    { q: 'How do sets differ from dicts internally?', a: '<p>Sets keep the classic single-array layout: one table of <code>(hash, key)</code> slots, no separate entries array. So they don’t remember insertion order, and iteration order depends on hashes and table history. They resize at a lower fill (about 60%), and probe a few neighbouring slots linearly before jumping.</p>', lvl: 'deep' },
    { q: 'What are key-sharing dictionaries?', a: '<p>PEP 412 (3.3): instances of the same class can share a single keys table for their <code>__dict__</code> and store only their values, because they usually have the same attribute names in the same order. Recent versions go further and store instance values inline in the object. Adding attributes in different orders or outside <code>__init__</code> can make an instance fall back to a normal dict. <code>__slots__</code> avoids the dict altogether.</p>', lvl: 'deep' },
    { q: 'Compare Python’s dict with Java’s HashMap.', a: '<p><code>HashMap</code> uses separate chaining: an array of buckets, each a linked list that turns into a red-black tree when a bucket grows past 8 entries (Java 8+), resized at load factor 0.75, with no ordering guarantee (<code>LinkedHashMap</code> adds one). Python’s dict uses open addressing in one indices array, resizes at ⅔, and is always insertion-ordered. Both require consistent <code>equals</code>/<code>hashCode</code> or <code>__eq__</code>/<code>__hash__</code>, and both break when a key is mutated.</p>', fu: 'What does Python have instead of tree bins to resist collisions? (Hash randomisation for str/bytes.)', lvl: 'core' },
    { q: 'Does <code>OrderedDict</code> still matter?', a: '<p>Less than before, but yes: its <code>==</code> compares order (a plain dict’s doesn’t), it has <code>move_to_end</code> and <code>popitem(last=False)</code> for LRU-style use, and its intent is explicit to readers. Plain dicts are smaller and faster for everything else.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Correct value-object keys', lang: 'python', code: `from dataclasses import dataclass, replace
from typing import NamedTuple

@dataclass(frozen=True, slots=True)
class CacheKey:
    model: str
    prompt_sha: str
    temperature: float = 0.0
    # frozen=True + eq=True → __hash__ over all fields, consistent with __eq__

class Coord(NamedTuple):      # tuples are hashable when their items are
    lat: float
    lon: float

cache: dict[CacheKey, str] = {}
k = CacheKey("m-large", "9f2c…")
cache[k] = "answer"
k_hot = replace(k, temperature=0.7)   # derive, never mutate
assert k in cache and k_hot not in cache` },
    { title: 'Order-preserving de-dup and grouping', lang: 'python', code: `from collections import defaultdict

def dedupe(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))        # keeps first-seen order, O(n)

def group_by_tenant(events: list[dict]) -> dict[str, list[dict]]:
    groups: defaultdict[str, list[dict]] = defaultdict(list)
    for e in events:
        groups[e["tenant"]].append(e)        # one hash per event, no "if k in d"
    return dict(groups)

def prune(d: dict[str, float], cutoff: float) -> dict[str, float]:
    return {k: v for k, v in d.items() if v >= cutoff}   # never delete while iterating

assert dedupe(["b", "a", "b", "c"]) == ["b", "a", "c"]`, note: 'Prefer building a new dict to deleting from a big one in place: it is also compact afterwards.' },
    { title: 'Java comparison: equals/hashCode', lang: 'java', code: `// Java record: immutable, equals/hashCode over all components (≈ frozen dataclass)
record CacheKey(String model, String promptSha, double temperature) {}

Map<CacheKey, String> cache = new HashMap<>();        // chaining + tree bins, no order
Map<CacheKey, String> ordered = new LinkedHashMap<>(); // ≈ Python dict ordering

// The same bug exists in both languages:
class Key { int id; public int hashCode() { return id; } /* equals on id */ }
Key k = new Key(); k.id = 1; cache2.put(k, "v");
k.id = 2;
cache2.containsKey(k);   // false: bucket chosen by the old hashCode`, note: 'Python’s rule “define <code>__hash__</code> whenever you define <code>__eq__</code>” is the same contract as Java’s <code>equals</code>/<code>hashCode</code>.' }
  ]
});
