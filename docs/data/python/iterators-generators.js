IA.register({
  track: 'python',
  slug: 'iterators-generators',
  title: 'Iterators & generators',
  tagline: 'Every <code>for</code> loop is <code>iter()</code> then <code>next()</code> until <code>StopIteration</code>. A generator is a function whose frame <b>pauses at each <code>yield</code></b>, so a pipeline of them processes one item at a time, in constant memory, and only as far as the consumer asks. Java Streams are the nearest relative, but generators are just functions.',
  tldr: {
    problem: 'Loading a whole file, query result or API listing into a list works in tests and runs out of memory in production. The lazy alternative has its own traps: generators are single-use, and they run code later than you think.',
    model: '<b>Iterable</b>: has <code>__iter__</code> and can hand out iterators, again and again (list, dict, range). <b>Iterator</b>: has <code>__next__</code>, remembers its position, is used up once. A <b>generator</b> is an iterator written as a function; its body runs only when someone calls <code>next()</code>.',
    hook: '“Why did my second loop print nothing?” Because the function returned a generator, and the first loop (or a <code>len(list(...))</code> for logging) consumed it. Iterators don’t rewind.',
    facts: [
      { v: 'StopIteration', l: 'how every iterator signals the end. <code>for</code> catches it. Since 3.7 (PEP 479) one escaping <i>inside</i> a generator becomes <code>RuntimeError</code>' },
      { v: '3.12', l: 'added <code>itertools.batched(it, n)</code>, which yields tuples of up to n items. 3.13 adds <code>strict=True</code>' },
      { v: '1 pass', l: 'a generator, a file object, <code>map</code>, <code>filter</code> and <code>zip</code> results can each be iterated once' }
    ]
  },
  intro: {
    what: 'An <b>iterator</b> hands you items one at a time. A <b>generator</b> is the easy way to write one: a function that uses <code>yield</code> instead of <code>return</code>. Each <code>yield</code> hands back one value and pauses the function where it is; the next request resumes it from that spot. Nothing is computed until something asks.',
    analogy: { icon: '🍣', title: 'Conveyor-belt sushi vs a banquet', text: 'A list is a banquet: every dish is cooked and on the table before you sit down, whether you eat it or not. A generator is a sushi chef who makes the next plate only when you take one. Chain several chefs (slice → season → plate) and each works on one piece at a time. Stop eating and the kitchen stops cooking.' },
    steps: [
      { t: 'for is iter + next', d: 'A loop asks the object for an iterator, then calls <code>next()</code> until <code>StopIteration</code>.', code: 'it = iter([10, 20])\nnext(it)   # 10\nnext(it)   # 20\nnext(it)   # StopIteration' },
      { t: 'yield makes a generator', d: 'Calling the function runs nothing; it returns a generator object.', code: 'def countdown(n):\n    while n > 0:\n        yield n\n        n -= 1\n\nlist(countdown(3))   # [3, 2, 1]' },
      { t: 'Generator expressions', d: 'Like a list comprehension, with parentheses, and lazy.', code: 'total = sum(len(line) for line in open("big.log"))' },
      { t: 'Chain them into pipelines', d: 'Each stage pulls one item from the previous stage. Memory stays flat however large the input.' },
      { t: 'itertools is the toolbox', d: '<code>islice</code>, <code>chain</code>, <code>groupby</code>, <code>batched</code>, <code>pairwise</code>, <code>accumulate</code>… all lazy, all fast (written in C).' }
    ],
    terms: [
      ['iterable', 'Something you can loop over: has <code>__iter__</code> (or <code>__getitem__</code>). Lists, dicts, strings, files.'],
      ['iterator', 'An object with <code>__next__</code> that remembers its position. Single-use. Its <code>__iter__</code> returns itself.'],
      ['generator', 'An iterator created by calling a function containing <code>yield</code>.'],
      ['lazy', 'Computed on demand, item by item, rather than all up front.'],
      ['StopIteration', 'The exception <code>__next__</code> raises when there are no more items.'],
      ['yield from', 'Delegates to a sub-iterator: yields everything it yields and returns its return value.']
    ]
  },
  visual: {
    title: 'Pull, one item at a time',
    caption: 'Three modes. <b>Lazy</b> and <b>Eager</b> answer the same question (“first two even squares of 1…9”); compare the counters when they finish. <b>Generator frame</b> shows where a generator’s body pauses between <code>next()</code> calls. Press <b>Play</b> or <b>Step</b>.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Protocol by hand', code: `nums = [10, 20]
it = iter(nums)                 # list.__iter__ -> a list_iterator
print(type(it).__name__, iter(it) is it)
print(next(it), next(it))
try:
    next(it)
except StopIteration:
    print("StopIteration")

class Countdown:
    """Iterable: a fresh iterator on every __iter__ call."""
    def __init__(self, n): self.n = n
    def __iter__(self):
        n = self.n
        while n > 0:
            yield n
            n -= 1

c = Countdown(3)
print(list(c), list(c))        # re-iterable, unlike a generator` },
      { label: 'Laziness traced', code: `def source():
    for n in range(1, 10):
        print(f"  source -> {n}")
        yield n

def square(xs):
    for x in xs:
        yield x * x

evens = (s for s in square(source()) if s % 2 == 0)
print("pipeline built, nothing ran yet")

import itertools
print(list(itertools.islice(evens, 2)))`, note: 'Only 1…4 are produced. Change <code>islice(evens, 2)</code> to <code>list(evens)</code> and watch all nine.' },
      { label: 'yield from & send', code: `def inner():
    yield 1
    yield 2
    return "inner done"          # becomes StopIteration.value

def outer():
    result = yield from inner()  # re-yields 1, 2; captures the return
    yield f"got: {result}"

print(list(outer()))

def running_avg():
    total = count = 0
    avg = None
    while True:
        x = yield avg            # send() delivers x here
        total += x; count += 1
        avg = total / count

g = running_avg()
next(g)                          # prime it: run to the first yield
print(g.send(10), g.send(20), g.send(60))` },
      { label: 'itertools tour', code: `import itertools as it

print(list(it.islice(it.count(100, 5), 3)))           # [100, 105, 110]
print(list(it.chain([1, 2], (3, 4), "ab")))
print(list(it.pairwise([1, 4, 9, 16])))               # 3.10+
print(list(it.batched(range(7), 3)))                  # 3.12+
print(list(it.accumulate([3, 1, 4, 1, 5], max)))      # running max
print(list(it.takewhile(lambda x: x < 3, [1, 2, 5, 1])))

words = sorted(["apple", "avocado", "bean", "beet", "cherry"], key=lambda w: w[0])
for letter, group in it.groupby(words, key=lambda w: w[0]):
    print(letter, list(group))` },
      { label: 'Single-use trap', code: `def load_rows():
    for i in range(3):
        yield {"id": i}

rows = load_rows()
print("count for the log:", len(list(rows)))   # consumes it
print("rows processed:", [r["id"] for r in rows])  # nothing left

rows = list(load_rows())                        # materialise once if you need two passes
print("count:", len(rows), "| ids:", [r["id"] for r in rows])

import itertools
a, b = itertools.tee(load_rows())   # two independent iterators over one source
print(next(a), next(b))`, note: '<code>itertools.tee</code> buffers whatever one copy has seen and the other hasn’t. If one runs far ahead, that buffer is your whole data set.' },
      { label: 'Memory', code: `import sys

as_list = [n * n for n in range(1_000_000)]
as_gen = (n * n for n in range(1_000_000))
print("list object:", sys.getsizeof(as_list), "bytes (plus the int objects)")
print("generator:  ", sys.getsizeof(as_gen), "bytes")
print(sum(as_gen) == sum(as_list))` }
    ]
  },
  gotchas: [
    { trap: 'Iterating a generator twice', code: `users = (u for u in fetch_users() if u.active)
if not any(True for _ in users):     # consumes the first item (or all)
    return
send_emails(users)                     # missing users`, why: 'Generators, file objects and the results of <code>map</code>, <code>filter</code> and <code>zip</code> are iterators. They are used up once. Nothing warns you; the second loop just sees fewer items, or none.', fix: 'Materialise once (<code>list(...)</code>) if you need two passes and the data fits. Otherwise make a re-iterable class whose <code>__iter__</code> creates a new generator each time.' },
    { trap: 'Returning a generator from inside <code>with</code>', code: `def read_ids(path):
    with open(path) as f:
        return (line.strip() for line in f)   # file closes on return

list(read_ids("ids.txt"))   # ValueError: I/O operation on closed file`, why: 'The generator expression runs later, after <code>with</code> has already closed the file. The same happens with DB sessions and HTTP responses.', fix: 'Make the function itself a generator, with the <code>with</code> inside it: <code>with open(path) as f: yield from (l.strip() for l in f)</code>. The resource now lives exactly as long as the iteration.' },
    { trap: 'Only the first <code>for</code> in a genexp is evaluated immediately', code: `ids = [1, 2, 3]
g = (x for x in ids if x in allowed)
allowed = {2}            # used when g runs, not when g was built`, why: 'The outermost iterable is evaluated when the generator expression is created (so errors show up early). Every other name is looked up lazily, when items are produced.', fix: 'Don’t rebind names a pending generator uses. Pass values in explicitly, or materialise.' },
    { trap: 'Mutating a collection while iterating it', code: `for item in cart:
    if item.qty == 0:
        cart.remove(item)          # skips the next item

for k in d:
    if d[k] is None:
        del d[k]                   # RuntimeError: dictionary changed size during iteration`, why: 'A list iterator walks indexes. Removing shifts later items left, so one is skipped. Dicts and sets detect size changes and raise.', fix: 'Build a new collection (<code>cart = [i for i in cart if i.qty]</code>), or iterate over a snapshot (<code>for k in list(d):</code>).' },
    { trap: '<code>StopIteration</code> leaking out of a generator', code: `def first_words(lines):
    for line in lines:
        yield next(iter(line.split()))   # empty line -> StopIteration`, why: 'Before 3.7 that silently ended the generator early. Since PEP 479 it is converted to <code>RuntimeError: generator raised StopIteration</code>.', fix: 'Use <code>next(it, default)</code>, or catch <code>StopIteration</code> and <code>return</code>.' },
    { trap: '<code>groupby</code> on unsorted data', code: `groupby(["a", "b", "a"])   # three groups: a, b, a`, why: '<code>itertools.groupby</code> groups <i>consecutive</i> equal keys, like Unix <code>uniq</code>. It is not SQL GROUP BY. Each group is also invalidated as soon as you advance to the next one.', fix: 'Sort by the same key first, and turn each group into a list if you keep it. For true grouping, use a <code>defaultdict(list)</code>.' }
  ],
  scenarios: [
    { title: 'The nightly import was OOM-killed when the file reached 12 GB',
      symptom: 'A Kubernetes job importing a partner CSV started restarting with exit code 137 (OOMKilled) once the file grew. It ran fine for months.',
      diagnose: `rows = list(csv.DictReader(open(path)))      # whole file in memory
clean = [normalise(r) for r in rows]          # a second copy
db.bulk_insert(clean)                         # a third, as SQL params`,
      cause: 'Three full in-memory copies of the data. Memory grew linearly with the input, and the pod limit was eventually crossed.',
      fix: 'Stream it: a generator pipeline reading row by row, inserting in fixed-size batches. Memory is now bounded by the batch size, not the file size.',
      fixCode: `import csv, itertools

def rows(path):
    with open(path, newline="") as f:
        yield from csv.DictReader(f)

for batch in itertools.batched(map(normalise, rows(path)), 5_000):   # 3.12+
    db.bulk_insert(batch)` },
    { title: 'The report said 1,200 rows were exported. The file was empty.',
      symptom: 'An export endpoint logged the right row count, then wrote a CSV containing only the header.',
      diagnose: `rows = repo.stream_orders(since)      # returns a generator
log.info("exporting %d rows", sum(1 for _ in rows))
writer.writerows(rows)                 # already exhausted`,
      cause: 'Counting the rows for the log line consumed the generator. The second pass saw an exhausted iterator and wrote nothing. No error was raised.',
      fix: 'Count while writing, in the same single pass.',
      fixCode: `count = 0
for row in repo.stream_orders(since):
    writer.writerow(row)
    count += 1
log.info("exported %d rows", count)` },
    { title: 'A streaming endpoint failed with “I/O operation on closed file”',
      symptom: 'A FastAPI <code>StreamingResponse</code> for large downloads failed immediately with a ValueError, but only for files, not for the in-memory test fixture.',
      diagnose: `def download(path):
    with open(path, "rb") as f:
        chunks = iter(lambda: f.read(64 * 1024), b"")
    return StreamingResponse(chunks)   # f is closed before the first chunk`,
      cause: 'The iterator is consumed by the server <i>after</i> the handler returns, and the <code>with</code> block closed the file on return.',
      fix: 'Move the resource into a generator so it stays open for exactly as long as the stream is consumed, and is closed when the generator finishes or is closed.',
      fixCode: `def file_chunks(path, size=64 * 1024):
    with open(path, "rb") as f:
        while chunk := f.read(size):
            yield chunk

return StreamingResponse(file_chunks(path))` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `squares = (x * x for x in range(3))
print(sum(squares), sum(squares))`, options: ['5 5', '5 0', '0 5', 'TypeError'], answer: 1, run: true, expect: '5 0', explain: 'The first <code>sum</code> consumes the generator (0 + 1 + 4 = 5). The second gets an exhausted iterator and sums nothing: 0. No error is raised.' },
    { kind: 'predict', q: 'What does this print?', code: `it = iter([1, 2, 3, 4])
print(3 in it, list(it))`, options: ['True [1, 2, 3, 4]', 'True [4]', 'True []', 'False [4]'], answer: 1, run: true, expect: 'True [4]', explain: '<code>in</code> on an iterator advances it until it finds 3, consuming 1, 2 and 3. Only 4 is left.' },
    { kind: 'predict', q: 'What does this print?', code: `it = iter(range(6))
print(list(zip(it, it)))`, options: ['[(0, 0), (1, 1), (2, 2), (3, 3), (4, 4), (5, 5)]', '[(0, 1), (2, 3), (4, 5)]', '[(0, 1), (1, 2), (2, 3)]', '[]'], answer: 1, run: true, expect: '[(0, 1), (2, 3), (4, 5)]', explain: 'Both arguments are the <i>same</i> iterator. Each tuple takes one item from it, then the next. This is the classic “chunk into pairs” idiom; <code>itertools.batched</code> (3.12) is the readable version.' },
    { kind: 'predict', q: 'What does this print?', code: `array = [1, 8, 15]
g = (x for x in array if array.count(x) > 0)
array = [2, 8, 22]
print(list(g))`, options: ['[1, 8, 15]', '[2, 8, 22]', '[8]', '[]'], answer: 2, run: true, expect: '[8]', explain: 'The first <code>for</code> clause is evaluated immediately, so the generator loops over the <b>old</b> list [1, 8, 15]. The <code>if</code> clause runs lazily and sees the <b>new</b> list. Only 8 is in both.' },
    { kind: 'predict', q: 'What does this print?', code: `def inner():
    yield 1
    yield 2
    return "done"

def outer():
    result = yield from inner()
    yield result

print(list(outer()))`, options: ["[1, 2]", "[1, 2, 'done']", "['done']", "[1, 2, None]"], answer: 1, run: true, expect: "[1, 2, 'done']", explain: '<code>yield from</code> passes through everything <code>inner</code> yields. When <code>inner</code> returns, its return value (carried in <code>StopIteration.value</code>) becomes the value of the <code>yield from</code> expression, which <code>outer</code> then yields.' },
    { kind: 'predict', q: 'What does this print?', code: `def acc():
    total = 0
    while True:
        x = yield total
        total += x

g = acc()
print(next(g), g.send(5), g.send(10))`, options: ['0 5 15', '5 15 15', '0 0 5', 'TypeError'], answer: 0, run: true, expect: '0 5 15', explain: '<code>next(g)</code> runs to the first <code>yield total</code> and returns 0. <code>send(5)</code> resumes with <code>x = 5</code>, adds it and yields 5. <code>send(10)</code> → 15. Calling <code>send(5)</code> first, on a fresh generator, would raise TypeError: it must be primed.' },
    { kind: 'predict', q: 'In what order are the lines printed?', code: `def gen():
    print("A")
    yield 1
    print("B")
    yield 2

g = gen()
print("start")
for v in g:
    print(v)`, options: ['A start 1 B 2 (one per line)', 'start A 1 B 2 (one per line)', 'start A B 1 2 (one per line)', 'A B start 1 2 (one per line)'], answer: 1, run: true, expect: 'start\nA\n1\nB\n2', explain: 'Calling <code>gen()</code> runs nothing. The body starts on the first <code>next()</code> (from the <code>for</code>), runs to <code>yield 1</code>, and resumes after it only when the loop asks for the next item.' },
    { kind: 'predict', q: 'What does this print?', code: `from itertools import groupby

data = ["a", "b", "a"]
print([(k, len(list(g))) for k, g in groupby(data)])`, options: ["[('a', 2), ('b', 1)]", "[('a', 1), ('b', 1), ('a', 1)]", "[('b', 1), ('a', 2)]", "[('a', 2), ('b', 1), ('a', 0)]"], answer: 1, run: true, expect: "[('a', 1), ('b', 1), ('a', 1)]", explain: '<code>groupby</code> only groups <i>consecutive</i> equal keys. Sort by the key first if you want SQL-style grouping.' }
  ],
  interview: [
    { q: 'What is the difference between an iterable and an iterator?', a: '<p>An <b>iterable</b> can produce iterators: it has <code>__iter__</code> (list, dict, str, range). An <b>iterator</b> has <code>__next__</code>, keeps a position, and its <code>__iter__</code> returns itself, so it can be used in a <code>for</code> loop but only once. A list is iterable but not an iterator; <code>iter(list)</code> gives you one.</p>', fu: 'Is a file object an iterable or an iterator? (An iterator: iterating it twice gives nothing the second time unless you <code>seek(0)</code>.)', lvl: 'core' },
    { q: 'How does a generator work under the hood?', a: '<p>Calling a generator function creates a generator object that owns a <b>frame</b> (locals plus instruction pointer) but runs nothing. Each <code>next()</code> resumes the frame until the next <code>yield</code>, which returns a value and suspends it again. Returning raises <code>StopIteration</code> carrying the return value. State is visible via <code>inspect.getgeneratorstate</code>: CREATED, RUNNING, SUSPENDED, CLOSED.</p>', lvl: 'core' },
    { q: 'What does <code>yield from</code> do beyond a <code>for</code> loop with <code>yield</code>?', a: '<p>It delegates fully: values sent with <code>send()</code>, exceptions thrown with <code>throw()</code>, and <code>close()</code> are passed to the sub-generator, and the sub-generator’s <code>return</code> value becomes the value of the <code>yield from</code> expression. Historically it was the basis of pre-<code>async def</code> coroutines.</p>', lvl: 'deep' },
    { q: 'When would you use a generator instead of returning a list?', a: '<ul><li>The data is large or unbounded (files, DB cursors, paginated APIs, event streams).</li><li>The consumer may stop early (<code>any</code>, <code>next</code>, <code>islice</code>).</li><li>You want pipeline stages that compose.</li></ul><p>Return a list when callers need <code>len</code>, indexing or several passes, or when the data is small and an exception during iteration would be confusing.</p>', lvl: 'core' },
    { q: 'What happens to a generator that is abandoned half-way?', a: '<p>When it is garbage-collected (or you call <code>close()</code>), Python throws <code>GeneratorExit</code> into its frame at the paused <code>yield</code>. That runs its <code>finally</code> blocks and <code>with</code> exits, so resources get released. Don’t yield inside a <code>finally</code> in response, or you get <code>RuntimeError: generator ignored GeneratorExit</code>. Under CPython’s reference counting this is usually prompt; on other implementations it may be delayed, so use <code>contextlib.closing</code> when it matters.</p>', lvl: 'deep' },
    { q: 'What is PEP 479?', a: '<p>Since 3.7, a <code>StopIteration</code> raised inside a generator body is turned into <code>RuntimeError</code>. Before that, a stray <code>next()</code> on an empty iterator would silently end the generator early, hiding bugs.</p>', lvl: 'deep' },
    { q: 'Name the itertools functions you use most, and one pitfall.', a: '<p><code>islice</code> (take/skip), <code>chain.from_iterable</code> (flatten one level), <code>batched</code> (3.12, chunking), <code>pairwise</code> (3.10, sliding pairs), <code>groupby</code>, <code>accumulate</code>, <code>product</code>, <code>tee</code>. Pitfalls: <code>groupby</code> needs sorted input; <code>tee</code> can buffer unboundedly; <code>cycle</code> stores a copy of everything it has seen.</p>', lvl: 'core' },
    { q: 'How do Python generators compare to Java Streams?', a: '<p>Both are lazy and single-use, and both pull elements through a pipeline. Streams are a library API with fixed operations and optional parallelism. Generators are ordinary functions with arbitrary control flow, state and <code>try/finally</code>, and they are the building block for itertools, context managers (<code>@contextmanager</code>) and, historically, coroutines. Java has no <code>yield</code> for this; you write an <code>Iterator</code> class or a <code>Spliterator</code>.</p>', lvl: 'core' },
    { q: 'Why is <code>x in generator</code> dangerous?', a: '<p>It consumes items up to and including the first match, so the generator is partly used afterwards. It is also O(n) every time, and never terminates on an infinite iterator with no match.</p>', lvl: 'core' },
    { q: 'How do you make a class that can be iterated many times?', a: '<p>Implement <code>__iter__</code> as a generator method (or return a new iterator object each call). Don’t implement <code>__next__</code> on the container itself; that makes it its own iterator, and therefore single-use.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Paginated API as a generator', lang: 'python', code: `from collections.abc import Iterator
import httpx

def iter_invoices(client: httpx.Client, customer: str) -> Iterator[dict]:
    """Yield every invoice, fetching pages lazily. Callers can stop early."""
    cursor: str | None = None
    while True:
        resp = client.get("/invoices", params={"customer": customer, "cursor": cursor})
        resp.raise_for_status()
        body = resp.json()
        yield from body["data"]
        cursor = body.get("next_cursor")
        if not cursor:
            return

# first overdue invoice: stops fetching pages as soon as one is found
overdue = next((i for i in iter_invoices(client, "c_42") if i["status"] == "overdue"), None)`, note: 'The caller doesn’t know or care about pages. With <code>next(...)</code>, only the pages up to the first match are fetched.' },
    { title: 'Streaming ETL with batched inserts', lang: 'python', code: `import csv
import itertools
from collections.abc import Iterable, Iterator

def read_rows(path: str) -> Iterator[dict[str, str]]:
    with open(path, newline="", encoding="utf-8") as f:   # open for the life of the stream
        yield from csv.DictReader(f)

def clean(rows: Iterable[dict[str, str]]) -> Iterator[tuple[str, int]]:
    for r in rows:
        if r["email"]:
            yield r["email"].lower(), int(r["score"])

def load(path: str, conn) -> int:
    n = 0
    for batch in itertools.batched(clean(read_rows(path)), 5_000):   # 3.12+
        conn.executemany("INSERT INTO scores(email, score) VALUES (%s, %s)", batch)
        n += len(batch)
    return n`, note: 'Memory is bounded by the batch size. On 3.11 and earlier, write <code>batched</code> yourself with <code>islice</code>.' },
    { title: 'Java comparison', lang: 'java', code: `// Lazy + single-use, like a generator pipeline:
Stream<Integer> s = IntStream.rangeClosed(1, 9).boxed()
    .map(n -> n * n)
    .filter(x -> x % 2 == 0)
    .limit(2);                 // islice
List<Integer> first2 = s.toList();   // [4, 16]; only 4 squares computed
// s.toList() again -> IllegalStateException: stream has already been operated upon

// No yield in Java: a hand-written Iterator keeps state in fields
class Countdown implements Iterator<Integer> {
    private int n;
    Countdown(int n) { this.n = n; }
    public boolean hasNext() { return n > 0; }
    public Integer next() { return n--; }
}`, note: 'Java fails loudly on stream reuse. Python’s exhausted iterator just yields nothing, which is why the bug is easier to miss.' }
  ]
});
