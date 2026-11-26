IA.register({
  track: 'python',
  slug: 'py-setup-first-program',
  title: 'Running Python',
  tagline: 'No <code>public static void main</code>, no compile step, no braces. A Python file is a <b>script that runs top to bottom</b>, and <b>indentation is the syntax</b> for blocks. Install a 3.12+ interpreter, learn the REPL and <code>print</code>, and you can run real code in minutes.',
  tldr: {
    problem: 'Java habits mislead you on day one: you look for a <code>main</code> method, a class to put it in, a build tool and braces. Python has none of those, and a stray indent changes what your program does.',
    model: '<code>python3 file.py</code> compiles the file to bytecode and immediately runs every top-level statement in order. <code>def</code> and <code>class</code> are statements that <i>create</i> objects when they run. A colon opens a block; the indented lines below it <i>are</i> the block.',
    hook: '“Where is <code>main</code>?” There isn’t one. The idiom <code>if __name__ == "__main__":</code> runs code only when the file is executed directly, not when it is imported.',
    facts: [
      { v: '2020-01-01', l: 'Python 2 reached end of life. Always use Python 3; on many systems the command is <code>python3</code>, and on Windows the <code>py</code> launcher' },
      { v: '4 spaces', l: 'per indentation level, as recommended by PEP 8. Mixing tabs and spaces inconsistently raises <code>TabError</code> in Python 3' },
      { v: '3.13', l: 'the version that shipped a new interactive REPL with colour and multi-line editing. The language itself is the same' }
    ]
  },
  intro: {
    what: 'Python is an <b>interpreted</b> language: you write a text file ending in <code>.py</code> and hand it to the <code>python3</code> program, which runs it straight away. There is no separate compile-and-package step like <code>javac</code> + <code>java</code>. You can also start <code>python3</code> with no file to get an interactive prompt (the <b>REPL</b>) and try lines one at a time.',
    analogy: { icon: '📜', title: 'A recipe card, read aloud', text: 'A Java program is a building plan: the compiler checks the whole thing, then the JVM enters through the one front door, <code>main</code>. A Python script is a recipe card read aloud from the top. Each line is done as it is read. A <code>def</code> line just writes a sub-recipe on a sticky note for later. Indentation shows which steps belong under “if the oven is hot”.' },
    steps: [
      { t: 'Install Python 3.12+', d: 'From python.org, your OS package manager (<code>brew install python</code>, <code>apt install python3</code>) or a version manager like <code>pyenv</code> or <code>uv</code>. Check with <code>python3 --version</code>.', code: '$ python3 --version\nPython 3.12.7', lang: 'bash' },
      { t: 'Try the REPL', d: 'Type <code>python3</code> alone. The <code>&gt;&gt;&gt;</code> prompt evaluates each line and echoes the result. Exit with <code>exit()</code> or Ctrl-D (Ctrl-Z then Enter on Windows).', code: '>>> 2 + 3\n5\n>>> print("hi")\nhi' },
      { t: 'Write a script', d: 'Save a file and run it. Every top-level line runs in order. A bare expression like <code>2 + 3</code> prints nothing in a script; use <code>print</code>.', code: '# hello.py\nprint("Hello, world")' },
      { t: 'Indent to make blocks', d: 'A line ending in <code>:</code> (if, for, while, def, class) must be followed by an indented block. Use 4 spaces.', code: 'if 3 > 2:\n    print("yes")\nprint("done")' },
      { t: 'Add a main guard', d: 'Put the “run me” code under the guard so the file can also be imported as a module without side effects.', code: 'def main():\n    print("running")\n\nif __name__ == "__main__":\n    main()' }
    ],
    terms: [
      ['interpreter', 'The <code>python3</code> program (CPython, written in C). It compiles source to bytecode in memory and executes it.'],
      ['REPL', 'Read–Eval–Print Loop: the interactive <code>&gt;&gt;&gt;</code> prompt. Echoes the <code>repr</code> of each expression.'],
      ['script', 'A <code>.py</code> file run with <code>python3 file.py</code>. Statements run top to bottom.'],
      ['block', 'A group of statements that belong together, marked by indentation after a line ending in <code>:</code>.'],
      ['comment', 'Text after <code>#</code> to the end of the line. Ignored by Python.'],
      ['<code>__name__</code>', 'A module-level variable: <code>"__main__"</code> when the file is run directly, the module name when imported.']
    ]
  },
  visual: {
    title: 'How Python runs your file',
    caption: 'Pick a scenario, then press <b>Play</b> or <b>Step</b>. The highlighted line is the one running; the output box shows stdout; the right panel shows the names that exist so far. Notice that <code>def</code> creates a function but does not run its body, and that indentation alone decides what is inside the <code>if</code>.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Hello, print()', code: `print("Hello, world")
print("several", "args", 42)          # space-separated
print("a", "b", "c", sep="-")         # custom separator
print("no newline", end="")
print(" ...continued")
print()                               # empty line
print("done")`, note: '<code>print</code> takes any number of arguments. <code>sep</code> and <code>end</code> are keyword arguments.' },
      { label: 'Top to bottom', code: `print("1. start")

def greet(who):
    print("3. inside greet, who =", who)

print("2. greet exists but has not run")
greet("Ada")
print("4. end")`, note: 'A <code>def</code> is executed like any statement: it creates the function. The body runs only when called.' },
      { label: 'Indentation', code: `x = 3
if x > 5:
    print("big")
    print("this line is inside the if too")
print("this always runs")

for i in range(3):
    print("loop", i)
print("after the loop")`, note: 'Try indenting the last line by 4 spaces and run again.' },
      { label: 'Comments & docstrings', code: `# A comment runs to the end of the line.
x = 10  # inline comment

def area(r):
    """Return the area of a circle of radius r.

    The first string in a function is its docstring.
    """
    return 3.14159 * r * r

print(area(2))
print(area.__doc__.splitlines()[0])   # docstrings are kept at run time`, note: 'Python has no <code>/* */</code>. Use <code>#</code> on each line; a triple-quoted string is a docstring when it is the first statement.' },
      { label: 'Main guard', code: `def main():
    print("main() ran")

print("__name__ is", repr(__name__))

if __name__ == "__main__":
    main()`, note: 'Here the playground runs the code as the main module, so the guard is true. When imported, <code>__name__</code> would be the module name.' },
      { label: 'Errors are tracebacks', code: `print("before")
try:
    print(undefined_name)
except NameError as e:
    print("NameError:", e)

try:
    exec("if True:\\nprint('x')")     # body not indented
except IndentationError as e:
    print("IndentationError:", e.msg)`, note: 'A misspelled name is only found when that line <i>runs</i>. Syntax and indentation errors are found before anything runs.' },
      { label: 'Which Python?', code: `import sys, platform
print(sys.version_info[:3])
print(platform.python_implementation())
print(sys.version_info >= (3, 12))`, note: 'In the browser this is Pyodide (CPython compiled to WebAssembly).' }
    ]
  },
  gotchas: [
    { trap: 'Looking for <code>main</code>: code at the top level runs on import too', code: `# utils.py
def helper(): ...
print("loading utils")     # runs every time someone imports utils
start_server()             # oops: importing this module starts a server`, why: 'Importing a module executes it top to bottom, once per process. Anything at top level is a side effect of <code>import</code>.', fix: 'Keep top level to definitions and constants. Put “run me” code inside <code>def main()</code> and call it under <code>if __name__ == "__main__":</code>.' },
    { trap: 'An indentation slip silently changes logic', code: `for order in orders:
    if order.paid:
        ship(order)
    notify(order)      # meant to be inside the if: now runs for every order`, why: 'Indentation <i>is</i> the block structure. There are no braces to disagree with it, so the program is valid and just does something else.', fix: 'Use an editor that shows indentation guides and auto-formats (Black or Ruff format). Review diffs for indentation, not just text.' },
    { trap: 'Mixing tabs and spaces', why: 'Python 3 raises <code>TabError</code> when tabs and spaces are mixed in a way that makes the meaning depend on tab width. Copy-pasting from the web is a common source.', fix: 'Configure the editor to insert 4 spaces for Tab in <code>.py</code> files. A formatter normalises existing files.' },
    { trap: '<code>python</code> is not always Python 3', code: `$ python --version     # may be missing, or an old 2.7 on legacy systems
$ python3 --version    # explicit
$ py -3.12 --version   # Windows launcher`, lang: 'bash', why: 'Different OSes map the <code>python</code> command differently. Inside an activated virtual environment, <code>python</code> is the venv’s interpreter.', fix: 'Use <code>python3</code> (or <code>py</code> on Windows) outside a venv, and always work inside a virtual environment for projects.' },
    { trap: 'Bare expressions print in the REPL but not in a script', code: `# script.py
total = 2 + 3
total            # prints 5 in the REPL, nothing in a script`, why: 'Only the REPL echoes expression values. A script discards them.', fix: 'Use <code>print(total)</code>. For debugging, <code>print(f"{total=}")</code> (3.8+) prints <code>total=5</code>.' },
    { trap: 'Naming your file after a library module', code: `# random.py   <- your file
import random
random.randint(1, 6)   # AttributeError: module 'random' has no attribute 'randint'`, why: 'The directory of the script comes first on <code>sys.path</code>, so <code>import random</code> imports <i>your</i> file instead of the standard library one.', fix: 'Don’t name scripts <code>random.py</code>, <code>json.py</code>, <code>email.py</code>, <code>test.py</code> and so on. Rename, and delete any stale <code>__pycache__</code>.' }
  ],
  scenarios: [
    { title: 'A cron job sends every email twice', symptom: 'After a refactor, the nightly report job sends each email twice. The job runs <code>python3 send_report.py</code> once.', diagnose: 'A new module <code>report_tasks.py</code> does <code>from send_report import build</code>. Adding a <code>print</code> at the top of <code>send_report.py</code> shows it executing twice per run.', cause: '<code>send_report.py</code> called <code>send_all()</code> at the top level. Running it as a script executed it once as <code>__main__</code>; the import from <code>report_tasks</code> loaded the same file a second time under the name <code>send_report</code>, executing the top-level call again.', fix: 'Move the side effect under a main guard so importing has no effects.', fixCode: `def send_all():
    ...

if __name__ == "__main__":
    send_all()` },
    { title: 'Discounts applied to everyone', symptom: 'A promotional discount shows up on every order, not just orders with a promo code. No exception, tests on the happy path pass.', diagnose: 'Git blame shows a merge that re-indented a block. The <code>apply_discount</code> call moved one level left, out of the <code>if</code>.', cause: 'Indentation is the block structure. A merge tool resolved whitespace changes and dedented one line. The program was still valid Python.', fix: 'Restore the indentation, add a test for the no-code path, and run a formatter plus linter in CI so whitespace-only merges are visible.', fixCode: `for order in orders:
    if order.promo_code:
        apply_discount(order)   # inside the if again
    total += order.amount` },
    { title: '“ModuleNotFoundError” only on the server', symptom: 'A script works on a laptop but fails in the container with <code>ModuleNotFoundError: No module named \'requests\'</code>.', diagnose: '<code>which python3</code> and <code>python3 -c "import sys; print(sys.executable)"</code> on both machines show different interpreters. The laptop runs inside an activated venv.', cause: 'Packages are installed per interpreter / virtual environment. The container used the system <code>python3</code>, which never had <code>requests</code> installed.', fix: 'Create a venv in the image and install dependencies into it, or install with the same interpreter that runs the code (<code>python3 -m pip install …</code>).', fixCode: `python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
python app.py`, lang: 'bash' }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this script print?', code: `print("a", "b", sep="-")
print("c", end="")
print("d")`, options: ['a b<br>c<br>d', 'a-b<br>cd', 'a-b<br>c d', 'ab-<br>cd'], answer: 1, run: true, expect: 'a-b\ncd', explain: '<code>sep</code> replaces the default single space between arguments. <code>end=""</code> replaces the default newline, so the next <code>print</code> continues on the same line.' },
    { kind: 'predict', q: 'What does this script print?', code: `def greet():
    print("hi")

print("start")
greet()`, options: ['hi<br>start', 'start<br>hi', 'start', 'hi<br>start<br>hi'], answer: 1, run: true, expect: 'start\nhi', explain: 'Running <code>def</code> only creates the function object. Its body runs when <code>greet()</code> is called, after <code>start</code> is printed.' },
    { kind: 'predict', q: 'What does this print?', code: `x = 2
if x > 5:
    print("big")
print("small")
print("end")`, options: ['big<br>end', 'small<br>end', 'end', 'big<br>small<br>end'], answer: 1, run: true, expect: 'small\nend', explain: 'Only <code>print("big")</code> is indented under the <code>if</code>. The <code>print("small")</code> line is at column 0, so it always runs, whatever <code>x</code> is.' },
    { kind: 'predict', q: 'Run as <code>python3 main.py</code>. What does it print?', code: `print(__name__)`, options: ['main', 'main.py', '__main__', 'None'], answer: 2, run: true, expect: '__main__', explain: 'The file you run directly becomes the module <code>__main__</code>. If the same file were imported, <code>__name__</code> would be <code>"main"</code>.' },
    { kind: 'predict', q: 'What does this print?', code: `print(1, 2)
print("1" + "2")
print(1 + 2)`, options: ['1 2<br>12<br>3', '12<br>12<br>3', '1 2<br>3<br>3', '(1, 2)<br>12<br>3'], answer: 0, run: true, expect: '1 2\n12\n3', explain: 'Two arguments are printed with a space between them. <code>+</code> on strings concatenates; on ints it adds.' },
    { kind: 'predict', q: 'What does this print?', code: `"""This string is not assigned to anything."""
x = 1  # x = 2
print(x)  # print(99)`, options: ['1', '2', '99', 'This string is not assigned to anything.<br>1'], answer: 0, run: true, expect: '1', explain: 'Everything after <code>#</code> is a comment. A lone string expression is evaluated and discarded; in a script nothing is echoed.' },
    { kind: 'concept', q: 'What happens when you run this file?', code: `print("one")
if True:
print("two")`, options: ['Prints one, then two', 'Prints one, then raises IndentationError', 'Raises IndentationError before printing anything', 'Prints one and two, with a warning'], answer: 2, explain: 'Python compiles the whole file before running it. A missing indented block is a syntax-level error (<code>IndentationError: expected an indented block after \'if\' statement</code>), so not even the first line runs. A <code>NameError</code>, by contrast, only appears when its line executes.' },
    { kind: 'concept', q: 'You have a Java background. Which statement about running Python is true?', options: ['Every .py file needs a function called main', 'python3 file.py first writes a .class-like file, then you run it separately', 'Top-level statements in the file run in order when the file is executed or first imported', 'Indentation is only a style convention, like in Java'], answer: 2, explain: 'A module is executed top to bottom when run or first imported. CPython does compile to bytecode (cached in <code>__pycache__</code> for imported modules), but that is automatic. Indentation is part of the grammar.' }
  ],
  interview: [
    { q: 'How does running a Python program differ from running a Java program?', a: '<p>Java: <code>javac</code> compiles to <code>.class</code> files, then the JVM loads a class and calls <code>main</code>. Python: <code>python3 app.py</code> compiles the source to bytecode in memory and immediately executes the module top to bottom. There is no required entry function or class.</p>', fu: 'Where does CPython cache bytecode? (<code>__pycache__/*.pyc</code> for imported modules, not for the main script.)', lvl: 'core' },
    { q: 'What does <code>if __name__ == "__main__":</code> do and why use it?', a: '<p>Each module has a <code>__name__</code>. It is <code>"__main__"</code> for the file being run and the module’s import name otherwise. The guard runs code only when the file is executed directly, so the same file can be imported (by tests, other modules) without side effects.</p>', lvl: 'core' },
    { q: 'Why is indentation significant in Python?', a: '<p>Python uses indentation instead of braces to delimit blocks. A line ending in <code>:</code> must be followed by an indented block; the block ends when indentation returns. It is part of the grammar, so a wrong indent either fails to compile (<code>IndentationError</code>) or silently changes which block a line belongs to.</p>', fu: 'What is <code>pass</code> for? (An empty block, since you cannot leave one blank.)', lvl: 'core' },
    { q: 'What is the REPL and how does its output differ from a script?', a: '<p>The interactive prompt evaluates each input and echoes the <code>repr()</code> of any expression result (except <code>None</code>). A script prints only what you pass to <code>print</code>. That is why <code>"hi"</code> shows <code>\'hi\'</code> with quotes in the REPL and <code>print("hi")</code> shows <code>hi</code>.</p>', lvl: 'core' },
    { q: 'What does <code>print</code> return, and what are <code>sep</code> and <code>end</code>?', a: '<p><code>print</code> returns <code>None</code>. <code>sep</code> (default <code>" "</code>) goes between arguments; <code>end</code> (default <code>"\\n"</code>) goes after the last one. <code>file=</code> redirects (for example to <code>sys.stderr</code>) and <code>flush=True</code> forces the write.</p>', lvl: 'core' },
    { q: 'How do you write comments and documentation in Python?', a: '<p><code>#</code> starts a comment to the end of the line; there is no block comment syntax. A string literal as the first statement of a module, function or class is its <b>docstring</b>, kept at run time in <code>__doc__</code> and shown by <code>help()</code>, like Javadoc that you can read from code.</p>', lvl: 'core' },
    { q: 'How do you make sure a script runs on the right Python version and packages?', a: '<ul><li>Create a virtual environment per project: <code>python3 -m venv .venv</code>, then activate it.</li><li>Install with <code>python -m pip</code> so pip matches the interpreter.</li><li>Pin the version (for example <code>requires-python = ">=3.12"</code> in <code>pyproject.toml</code>) and check <code>sys.version_info</code> if needed.</li></ul>', lvl: 'core' },
    { q: 'Is Python compiled or interpreted?', a: '<p>Both, loosely. CPython compiles source to bytecode, then a virtual machine interprets that bytecode. There is no ahead-of-time native compilation by default. CPython 3.13 added an experimental JIT that is off by default; the classic JVM-style JIT is not how CPython normally runs.</p>', lvl: 'deep' },
    { q: 'When are errors detected: before running, or while running?', a: '<p>Syntax errors (including indentation errors) are found when the file is compiled, before any line runs. Almost everything else (misspelled names, wrong types, missing attributes) is found only when that line executes. So untested branches can hide simple bugs; linters (Ruff, Pyflakes) and type checkers (mypy, pyright) catch many of them earlier.</p>', lvl: 'deep' },
    { q: 'Why can naming your script <code>json.py</code> break your program?', a: '<p>When you run a script, its directory is put first on <code>sys.path</code>. <code>import json</code> then finds your file before the standard library module, shadowing it. Rename the file and remove stale <code>__pycache__</code>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Hello world: Java vs Python', lang: 'python', code: `# hello.py  (run: python3 hello.py)
def main() -> None:
    name = "Ada"
    print(f"Hello, {name}!")


if __name__ == "__main__":
    main()`, note: 'Java equivalent is in the next tab. No class, no static, no semicolons, no build step.' },
    { title: 'The Java you already know', lang: 'java', code: `// Hello.java  (run: java Hello.java, JDK 11+ single-file launch)
public class Hello {
    public static void main(String[] args) {
        String name = "Ada";
        System.out.println("Hello, " + name + "!");
    }
}`, note: 'Braces delimit blocks in Java; in Python, the indentation does.' },
    { title: 'A small real CLI script', lang: 'python', code: `#!/usr/bin/env python3
"""Count lines in the files given on the command line."""
import sys
from pathlib import Path


def count_lines(path: Path) -> int:
    with path.open(encoding="utf-8") as f:
        return sum(1 for _ in f)


def main(argv: list[str]) -> int:
    if not argv:
        print("usage: count.py FILE...", file=sys.stderr)
        return 2
    for name in argv:
        print(f"{count_lines(Path(name)):>8}  {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))`, note: 'The shebang line lets you run <code>./count.py</code> after <code>chmod +x</code> on Unix. <code>sys.exit(main(...))</code> passes the exit status to the shell.' }
  ]
});
