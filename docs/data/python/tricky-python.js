IA.register({
  track: 'python',
  slug: 'tricky-python',
  title: '★ Tricky Python (timed)',
  tagline: 'Forty-six “what does this print?” and “what happens?” questions from every topic on the Python track, against the clock. Each one is a trap that has caused a real bug: aliasing, late binding, one-shot generators, swallowed exceptions, blocked event loops, mocks patched in the wrong place.',
  tldr: {
    problem: 'Senior Python interviews rarely ask you to write a program from scratch. They show you eight lines and ask what they print, or why a service stalls, and the obvious answer is wrong for one specific reason.',
    model: 'Almost every trick is one of six things: <b>names vs objects</b> (aliasing, mutation, shared defaults), <b>when code runs</b> (definition time vs call time, lazy generators, unawaited coroutines), <b>lookup rules</b> (LEGB, MRO, <code>sys.path</code>, where <code>patch</code> looks), <b>protocols</b> (<code>__eq__</code>/<code>__hash__</code>, <code>__bool__</code>/<code>__len__</code>, <code>__exit__</code>), <b>error flow</b> (chaining, groups, <code>finally</code>), and <b>who holds the thread</b> (GIL, event loop, threadpool).',
    hook: '<code>[lambda: i for i in range(3)]</code> returns three functions that all return 2. If you can explain why in one sentence, start the drill.',
    facts: [
      { v: '46', l: 'questions covering all 21 topics of the track: language core, internals, concurrency and practice' },
      { v: '33', l: 'are complete programs whose answer is their exact output under CPython 3.12' },
      { v: '60 s', l: 'per question by default, with Slow (90 s) and Fast (30 s) modes. Skips and timeouts count as misses' }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short program or situation, a timer and four answers. Answer in your head, as you would in an interview, then read the explanation. At the end you get your score per topic, weakest first, and a review of every miss with a link back to the topic page that explains it.',
    analogy: { icon: '⏱️', title: 'Chess puzzles for Python', text: 'Chess players get better by solving positions quickly, not by re-reading opening theory. Each question here is a “position”: a few lines where the obvious reading is wrong for one specific reason. Spotting that reason fast is the skill interviewers test.' },
    steps: [
      { t: 'Track names, not values', d: 'Draw arrows from names to objects. Ask: does this line <b>rebind</b> a name, or <b>mutate</b> an object others share?', code: 'a = [1]; b = a\na += [2]     # mutates: b sees it\na = a + [3]  # rebinds: b does not' },
      { t: 'Ask “when does this run?”', d: 'Default arguments and decorators: at <code>def</code> time. Generator bodies: on <code>next()</code>. Coroutines: only when awaited or scheduled. Closures: look up variables when called.' },
      { t: 'Follow the lookup', d: 'Names: local → enclosing → global → builtins (decided at compile time). Attributes: instance, then class and its MRO. Imports: <code>sys.modules</code>, then <code>sys.path</code> in order.' },
      { t: 'For async and threads, ask who holds the thread', d: 'An <code>await</code> that yields lets others run; a blocking call doesn’t. With the GIL, one thread runs bytecode at a time, but <code>+=</code> is still not atomic.' }
    ],
    terms: [
      ['aliasing', 'Two names bound to the same mutable object; a change through one is visible through the other.'],
      ['late binding', 'A closure reads a variable’s value when it runs, not when it was created.'],
      ['one-shot iterator', 'Generators and most iterators can be consumed only once.'],
      ['implicit chaining', 'An exception raised inside <code>except</code> records the one being handled in <code>__context__</code>.'],
      ['propagation', 'A log record passed up the logger tree to every ancestor’s handlers.']
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a module (or All), how many questions and the time per question, then press <b>Start</b>. Answers show each printed line on its own line. <b>Skip</b> counts as a miss. At the end: a per-topic breakdown, weakest first, and every miss with its explanation and a link to the topic page.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Names vs objects', code: `a = [1, 2, 3]
b = a
a += [4]          # list.__iadd__: in place
print("after +=      ", a, b, a is b)
a = a + [5]       # new list, rebinds a only
print("after a = a+[5]", a, b, a is b)

t = ([1],)
try:
    t[0] += [2]
except TypeError as e:
    print("TypeError:", e, "| but t is now", t)

grid = [[0] * 3] * 2      # the inner list is shared
grid[0][0] = 9
print(grid)` },
      { label: 'When code runs', code: `def tag(name):
    print(f"  tag({name!r}) evaluated")
    def deco(fn):
        print(f"  applying {name}")
        return fn
    return deco

print("defining f:")
@tag("outer")
@tag("inner")
def f(x, seen=print("  default evaluated") or []):
    return x

print("calling f twice:")
f(1); f(2)

def gen():
    print("  generator body starts")
    yield 1

print("making a generator:")
g = gen()
print("first next():")
next(g)` },
      { label: 'Late binding', code: `fs = [lambda: i for i in range(3)]
print("late binding:   ", [f() for f in fs])

fs = [lambda i=i: i for i in range(3)]
print("default capture:", [f() for f in fs])

from functools import partial
fs = [partial(lambda i: i, i) for i in range(3)]
print("partial:        ", [f() for f in fs])` },
      { label: 'Event-loop ordering', code: `import asyncio

async def job(n):
    print("start", n)
    await asyncio.sleep(0)      # yield to the loop once
    print("end", n)

async def main():
    t = asyncio.create_task(job(1))
    print("created")
    await job(2)                # runs inline, no new task
    await t

await main()     # top-level await works in this playground; in a script: asyncio.run(main())` },
      { label: 'Equality, hashing, keys', code: `print({1: "a", 1.0: "b", True: "c"})        # one key

class P:
    def __init__(self, x): self.x = x
    def __eq__(self, o): return isinstance(o, P) and self.x == o.x

print("hash is None:", P.__hash__ is None)
try:
    {P(1)}
except TypeError as e:
    print("TypeError:", e)

from dataclasses import dataclass
@dataclass(frozen=True)
class Q:
    x: int
print(len({Q(1), Q(1)}), Q(1) == Q(1), Q(1) is Q(1))` }
    ]
  },
  gotchas: [
    { trap: 'Answering from Java (or JavaScript) rules', why: '<code>-7 // 2</code> is −4, not −3; <code>==</code> is value equality; there is no integer overflow; <code>round(2.5)</code> is 2. Rules from other languages produce confident wrong answers.', fix: 'Say “in CPython 3.12” and reason from Python’s rules. If you know the Java behaviour, mention the contrast: interviewers like that.' },
    { trap: 'Forgetting that <code>print</code> evaluates all its arguments first', code: `def add(x, acc=[]):
    acc.append(x); return acc
print(add(1), add(2))      # [1, 2] [1, 2], not [1] [1, 2]`, why: 'Both calls run before anything is printed, so both arguments show the final state of the shared object.', fix: 'When objects are shared, finish evaluating every argument, then print.' },
    { trap: 'Relying on behaviour that isn’t guaranteed', why: '<code>id()</code> values, small-int and string interning (<code>is</code> on equal strings), set ordering of strings across runs (hash randomisation) and thread timing vary by build and run. Good interview questions avoid them, and so does this drill.', fix: 'If a question depends on them, say so: “that is a CPython implementation detail; the language doesn’t promise it”.' },
    { trap: 'Missing stderr vs stdout', why: 'Warnings (“coroutine … was never awaited”), tracebacks and logging’s default “last resort” handler go to <b>stderr</b>. A question about what is printed on stdout may exclude them.', fix: 'Read the question: “on stdout”, “what is printed”, or “what happens”.' }
  ],
  interview: [
    { q: 'How do you approach a “what does this print?” question?', a: '<p>Out loud, line by line: which objects exist and which names point at them (draw arrows), when each piece of code actually runs (definition, import, call, <code>next()</code>, <code>await</code>), and how each name is looked up. Write the output as you go and check it against the question’s exact wording (stdout only? the last line?). If it hinges on an implementation detail, say so.</p>', lvl: 'core' },
    { q: 'You don’t know the answer. What do you say?', a: '<p>Narrow it down and say how you would check it: “Either the default is evaluated once or per call. I’m fairly sure it’s once, at <code>def</code> time, so the list is shared and both prints show [1, 2]. I’d confirm in a REPL in ten seconds.” Reasoning plus a quick verification plan is a strong senior answer.</p>', lvl: 'core' },
    { q: 'Which trick categories cause the most production bugs in Python services?', a: '<p>1) Shared mutable state: default arguments, class attributes, module globals per worker. 2) Async misuse: blocking calls in <code>async def</code>, unawaited coroutines, sequential awaits that should be concurrent. 3) Error handling: broad <code>except</code> blocks, lost tracebacks, groups not matched by plain <code>except</code>. 4) Tests that test mocks: patching the wrong namespace, <code>MagicMock</code> accepting anything.</p>', lvl: 'deep' },
    { q: 'How do you verify a tricky claim quickly during a real code review?', a: '<p>A five-line script or <code>python -c</code>, using <code>dis.dis</code> to see bytecode, <code>sys.getrefcount</code> or <code>weakref</code> for lifetimes, and <code>PYTHONASYNCIODEBUG=1</code> for event-loop stalls. For packaging and imports, <code>python -v</code> or <code>python -X importtime</code> show what is imported from where. For concurrency, <code>py-spy dump</code> shows what each thread is doing right now.</p>', lvl: 'core' },
    { q: 'Which Python versions matter for these questions?', a: '<p>The drill assumes CPython 3.12. Version-sensitive points: <code>ExceptionGroup</code>, <code>except*</code>, <code>add_note</code> and <code>TaskGroup</code> need 3.11+; comprehensions are inlined in 3.12 (PEP 709), though their scoping semantics don’t change; type-parameter syntax (<code>def f[T]</code>) needs 3.12; the free-threaded build is an optional, experimental build in 3.13; and 3.14 warns about <code>return</code> in <code>finally</code> (PEP 765).</p>', lvl: 'deep' }
  ]
});
