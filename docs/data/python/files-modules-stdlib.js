IA.register({
  track: 'python',
  slug: 'files-modules-stdlib',
  title: 'Files, modules & stdlib',
  tagline: 'Every <code>.py</code> file is a <b>module</b>; <code>import</code> runs it once and caches it. Files are opened with <code>with open(…)</code> so they always close, paths are built with <code>pathlib</code>, and the standard library already has JSON, CSV and much more. Third-party packages go into a per-project <b>venv</b> with <code>pip</code>.',
  tldr: {
    problem: 'Java developers expect a build tool, a classpath and a JDK to sort this out. In Python a script that works on your laptop fails elsewhere because of a missing package, the wrong interpreter, a file named <code>json.py</code>, an unclosed file, or a locale-dependent encoding.',
    model: '<code>import x</code> looks in <code>sys.modules</code> (the cache), else searches <code>sys.path</code> (script folder → stdlib → site-packages), runs the file top to bottom once, and binds the name. <code>with open(path, mode, encoding="utf-8") as f:</code> guarantees <code>close()</code>. A <b>venv</b> is a folder with its own <code>site-packages</code>; <code>pip</code> installs into whichever Python runs it.',
    hook: '“What does <code>if __name__ == "__main__":</code> do?” It runs that block only when the file is executed directly, not when it is imported: Python’s <code>public static void main</code>.',
    facts: [
      { v: 'once', l: 'a module’s top-level code runs once per process; later imports reuse the object in <code>sys.modules</code>' },
      { v: 'str', l: 'is what <code>csv</code> gives you for every field, and JSON object keys are always strings: <code>{1: "a"}</code> round-trips to <code>{"1": "a"}</code>' },
      { v: 'locale', l: 'decides <code>open()</code>’s default text encoding (often not UTF-8 on Windows) until UTF-8 mode becomes the default, planned for Python 3.15 (PEP 686). Pass <code>encoding=</code> explicitly' }
    ]
  },
  intro: {
    what: 'Real programs read and write files, split code across several files, and reuse code other people wrote. In Python, reading a file is two lines with <code>open</code>; any <code>.py</code> file can be imported by another one; a big <b>standard library</b> ships with Python (JSON, CSV, dates, paths, HTTP…); and extra packages come from PyPI via <code>pip</code>, installed into a <b>virtual environment</b> so each project has its own versions.',
    analogy: { icon: '📚', title: 'A library with a reading room', text: 'The standard library is the books already on the shelves. <code>pip</code> orders new books, and a venv is your own shelf so your project’s books don’t mix with anyone else’s. <code>import</code> is checking a book out: the first time the librarian fetches it, after that it is already on your desk. <code>with open(…)</code> is borrowing a reference book that must go back on the shelf when you leave the room, however you leave.' },
    steps: [
      { t: 'Read and write a text file', d: '<code>with</code> closes the file for you, even on errors. Java: try-with-resources.', code: 'with open("notes.txt", "w", encoding="utf-8") as f:\n    f.write("hello\\n")\n\nwith open("notes.txt", encoding="utf-8") as f:\n    for line in f:            # one line at a time\n        print(line.strip())' },
      { t: 'Use pathlib for paths', d: '<code>/</code> joins path parts on every OS.', code: 'from pathlib import Path\n\np = Path("data") / "users.json"\nprint(p.name, p.suffix, p.exists())\ntext = p.read_text(encoding="utf-8")' },
      { t: 'JSON and CSV from the stdlib', d: 'No dependency needed.', code: 'import json, csv\n\ndata = json.loads(\'{"id": 7}\')     # str -> dict\nout = json.dumps(data, indent=2)   # dict -> str\n\nwith open("people.csv", newline="", encoding="utf-8") as f:\n    for row in csv.DictReader(f):\n        print(row["name"])' },
      { t: 'Split code into modules', d: 'Another file in the same folder is importable by its name.', code: '# helpers.py\ndef slugify(s):\n    return s.lower().replace(" ", "-")\n\n# main.py\nfrom helpers import slugify\n\nif __name__ == "__main__":\n    print(slugify("Hello World"))' },
      { t: 'Install packages in a venv', d: 'One venv per project, like a per-project <code>~/.m2</code>.', code: 'python3 -m venv .venv\nsource .venv/bin/activate\npip install requests\npip freeze > requirements.txt', lang: 'bash' }
    ],
    terms: [
      ['module', 'One <code>.py</code> file. Its name is the file name without <code>.py</code>.'],
      ['package', 'A folder of modules, usually with an <code>__init__.py</code>. Imported with dots: <code>app.db.models</code>.'],
      ['standard library', 'The modules that ship with Python: <code>json</code>, <code>csv</code>, <code>pathlib</code>, <code>datetime</code>, <code>collections</code>, <code>re</code>, <code>logging</code>…'],
      ['pip / PyPI', 'The package installer and the public package index it downloads from (Maven Central’s role).'],
      ['venv', 'A folder with its own interpreter link and <code>site-packages</code>, isolating one project’s packages.'],
      ['__name__', '<code>"__main__"</code> when the file is run directly; the module’s name when it is imported.']
    ]
  },
  visual: {
    title: 'import, with open, and venv step by step',
    caption: 'Pick a mechanism and press <b>Play</b> or <b>Step</b>. <b>import</b> shows the module cache and the search path; <b>with open</b> shows a write sitting in a buffer until the file is closed; <b>venv &amp; pip</b> shows where packages land and why the right <code>python</code> matters.'
  },
  playground: {
    kind: 'python',
    setup: `import os, tempfile
os.chdir(tempfile.mkdtemp())   # each run starts in a fresh, empty folder`,
    presets: [
      { label: 'Write & read text', code: `from pathlib import Path

# write: "w" creates or TRUNCATES, "a" appends
with open("log.txt", "w", encoding="utf-8") as f:
    f.write("first line\\n")
    print("inside with, closed?", f.closed)
print("after with, closed? ", f.closed)

with open("log.txt", "a", encoding="utf-8") as f:
    print("second line", file=f)          # print can target a file

# read: iterate lines lazily (constant memory for big files)
with open("log.txt", encoding="utf-8") as f:
    for n, line in enumerate(f, start=1):
        print(n, repr(line))              # lines keep their "\\n"

print(Path("log.txt").read_text(encoding="utf-8").splitlines())`, note: 'The playground runs in an in-memory file system, so files vanish after the run.' },
      { label: 'pathlib', code: `from pathlib import Path, PurePosixPath

base = Path("project")
(base / "data" / "raw").mkdir(parents=True, exist_ok=True)
for name in ["a.csv", "b.csv", "notes.md"]:
    (base / "data" / "raw" / name).write_text("x\\n", encoding="utf-8")

print(sorted(p.name for p in base.rglob("*.csv")))   # recursive glob

p = PurePosixPath("/srv/reports/2026/q3.final.csv")
print(p.name, "|", p.stem, "|", p.suffix, "|", p.parent)
print(p.with_suffix(".json"))
print(Path("data/raw/a.csv").exists(), (base / "data/raw/a.csv").exists())`, note: '<code>Path</code> is OS-aware; <code>PurePosixPath</code> is used here only to get the same output everywhere.' },
      { label: 'JSON', code: `import json

order = {"id": 7, "items": ("apple", "pear"), "paid": True, "note": None, 1: "x"}
text = json.dumps(order)
print(text)                       # tuple -> array, True -> true, None -> null, 1 -> "1"
back = json.loads(text)
print(back, back == order)

# pretty file round trip
with open("order.json", "w", encoding="utf-8") as f:
    json.dump(back, f, indent=2)
with open("order.json", encoding="utf-8") as f:
    print(json.load(f)["items"])

# non-JSON types need help
from datetime import date
print(json.dumps({"day": date(2026, 1, 31)}, default=str))
try:
    json.dumps({"day": date(2026, 1, 31)})
except TypeError as e:
    print("TypeError:", e)`, note: '<code>dumps</code>/<code>loads</code> work on strings; <code>dump</code>/<code>load</code> on files.' },
      { label: 'CSV (+ io.StringIO)', code: `import csv, io

rows = [{"name": "Asha", "age": 31}, {"name": "Ben, Jr.", "age": 28}]

with open("people.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["name", "age"])
    w.writeheader()
    w.writerows(rows)

print(open("people.csv", encoding="utf-8").read())   # note the quoted comma

with open("people.csv", newline="", encoding="utf-8") as f:
    people = list(csv.DictReader(f))
print(people)
print(sum(int(p["age"]) for p in people))           # every field is a str!

# no file needed: StringIO is an in-memory text file
buf = io.StringIO("sku,qty\\nA1,3\\nB2,5\\n")
print({r["sku"]: int(r["qty"]) for r in csv.DictReader(buf)})`, note: 'Open CSV files with <code>newline=""</code> so the csv module controls line endings.' },
      { label: 'Your own module', code: `import sys
from pathlib import Path

# write a module file, then import it (works the same on disk)
Path("greet.py").write_text('''
print("loading greet (runs once)")
DEFAULT = "world"

def hello(name=DEFAULT):
    return f"hello, {name}"

if __name__ == "__main__":
    print("run directly, not imported")
''', encoding="utf-8")
sys.path.insert(0, ".")

import greet                 # runs the file
import greet                 # cached: prints nothing
from greet import hello      # binds one name
print(hello(), "|", greet.hello("Asha"))
print(greet.__name__, "greet" in sys.modules)`, note: 'The <code>__main__</code> block didn’t run, because the file was imported.' },
      { label: 'Stdlib tour', code: `from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
import itertools, random, re, statistics

words = "the cat and the hat and the bat".split()
print(Counter(words).most_common(2))

groups = defaultdict(list)
for w in words:
    groups[len(w)].append(w)
print(dict(groups))

now = datetime(2026, 11, 26, 9, 30, tzinfo=timezone.utc)
print((now + timedelta(days=7)).isoformat())

print(re.findall(r"\\b\\w*at\\b", " ".join(words)))
print(list(itertools.pairwise([1, 2, 3, 4])))           # 3.10+
print(statistics.median([3, 1, 4, 1, 5]))
random.seed(42); print(random.randint(1, 6))`, note: 'Before adding a dependency, check the stdlib: it covers a lot.' }
    ]
  },
  gotchas: [
    { trap: 'Naming your file after a stdlib module', code: `# your project folder
json.py        # your experiment
main.py        # import json  -> imports YOUR json.py
# AttributeError: module 'json' has no attribute 'loads'`, why: 'The script’s own folder is first on <code>sys.path</code>, so local files shadow standard modules. Common victims: <code>json.py</code>, <code>random.py</code>, <code>email.py</code>, <code>test.py</code>, <code>logging.py</code>.', fix: 'Rename the file (and delete any stale <code>__pycache__</code>). Check with <code>print(json.__file__)</code>.' },
    { trap: 'Not closing files, or not using with', code: `f = open("out.txt", "w")
f.write("data")
# crash or early return here → data may never reach disk`, why: 'Writes are buffered. Data is flushed on <code>close()</code>; without it you rely on garbage collection and can lose output or leak handles (“Too many open files”).', fix: 'Always <code>with open(...) as f:</code>, or the one-shot helpers <code>Path.read_text</code>/<code>write_text</code>.' },
    { trap: 'Relying on the default encoding', code: `open("names.txt").read()      # works on Linux/macOS
# Windows: UnicodeDecodeError: 'charmap' codec can't decode byte 0x81`, why: 'Without <code>encoding=</code>, text mode uses the locale’s preferred encoding, which is often a legacy code page on Windows.', fix: 'Pass <code>encoding="utf-8"</code> on every text <code>open</code>, <code>read_text</code> and <code>write_text</code>. Or run with UTF-8 mode (<code>python -X utf8</code> / <code>PYTHONUTF8=1</code>).' },
    { trap: '"w" truncates immediately', code: `with open("config.json", "w") as f:     # file is now EMPTY
    json.dump(build_config(), f)          # if this raises, the old config is gone`, why: 'Opening in <code>"w"</code> mode wipes the file before you write anything.', fix: 'Use <code>"a"</code> to append, <code>"x"</code> to fail if it exists, or write to a temp file and <code>os.replace(tmp, path)</code> for an atomic swap.' },
    { trap: 'pip installs into a different Python than you run', code: `pip install requests
python app.py          # ModuleNotFoundError: No module named 'requests'`, why: 'With several Pythons installed, <code>pip</code> on your PATH may belong to another interpreter than <code>python</code>.', fix: 'Use a venv, and run pip through the interpreter: <code>python -m pip install requests</code>. Check with <code>python -m pip --version</code>.', lang: 'bash' },
    { trap: 'Module-level side effects on import', code: `# settings.py
conn = psycopg.connect(DB_URL)   # runs on every import... once per process
print("connected")`, why: 'Importing executes the whole file. Tests, tools and other modules that merely import it now open a database connection.', fix: 'Keep module top level to definitions and constants. Put work in functions and under <code>if __name__ == "__main__":</code>.' }
  ],
  scenarios: [
    { title: 'Works on my machine, fails in CI with ModuleNotFoundError',
      symptom: 'A script runs locally but the CI job fails at <code>import httpx</code>. Locally, nobody remembers installing it.',
      diagnose: `python -c "import httpx, sys; print(httpx.__file__, sys.prefix)"
# /usr/lib/python3/dist-packages/httpx/...  /usr      <- installed globally, long ago
pip freeze | grep httpx    # missing from requirements.txt`,
      cause: 'Packages were installed into the system Python, not a project venv, so the dependency was never recorded.',
      fix: 'Use a venv per project and declare every dependency in <code>pyproject.toml</code> (or a pinned <code>requirements.txt</code>). CI builds a fresh venv from that file.',
      fixCode: `python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt   # or: pip install -e .
python -m pytest`, lang: 'bash' },
    { title: 'Nightly export has garbled names and blank lines',
      symptom: 'Customer names with accents show as <code>Ã©</code> in Excel, and on Windows every other row of the CSV is empty.',
      diagnose: `with open("export.csv", "w") as f:          # no encoding, no newline=""
    w = csv.writer(f)
    w.writerows(rows)`,
      cause: 'The file was written with the platform default encoding, and on Windows the csv module’s <code>\\r\\n</code> plus text-mode newline translation produced <code>\\r\\r\\n</code>, which shows as blank rows.',
      fix: 'Open CSV files with <code>newline=""</code> and an explicit encoding. For Excel, <code>utf-8-sig</code> adds a BOM that Excel uses to detect UTF-8.',
      fixCode: `with open("export.csv", "w", newline="", encoding="utf-8-sig") as f:
    csv.writer(f).writerows(rows)` }
  ],
  puzzles: [
    { kind: 'output', q: 'JSON round trip of a tuple:', code: `import json

print(json.loads(json.dumps({"a": (1, 2)})))`, options: ["{'a': [1, 2]}", "{'a': (1, 2)}", '{"a": [1, 2]}', 'TypeError'], answer: 0, run: true, expect: "{'a': [1, 2]}", explain: 'JSON has arrays, not tuples, so a tuple is written as an array and read back as a list. Printing a dict shows Python’s repr with single quotes.' },
    { kind: 'output', q: 'JSON round trip of an int key:', code: `import json

d = {1: "x"}
back = json.loads(json.dumps(d))
print(back, back == d)`, options: ["{'1': 'x'} False", "{1: 'x'} True", "{'1': 'x'} True", 'TypeError: keys must be str'], answer: 0, run: true, expect: "{'1': 'x'} False", explain: 'JSON object keys are always strings. <code>dumps</code> converts the int key to <code>"1"</code>, and <code>loads</code> doesn’t convert it back.' },
    { kind: 'output', q: 'Path pieces:', code: `from pathlib import PurePosixPath

p = PurePosixPath("/data/reports/q3.final.csv")
print(p.name, p.stem, p.suffix, p.parent)`, options: ['q3.final.csv q3.final .csv /data/reports', 'q3.final.csv q3 .final.csv /data/reports', 'q3.final.csv q3.final csv /data/reports/', '/data/reports/q3.final.csv q3 .csv /data'], answer: 0, run: true, expect: 'q3.final.csv q3.final .csv /data/reports', explain: '<code>suffix</code> is only the last extension (<code>.csv</code>, with the dot); <code>stem</code> is the name without it. <code>p.suffixes</code> would give <code>[\'.final\', \'.csv\']</code>.' },
    { kind: 'output', q: 'Adding two CSV fields:', code: `import csv, io

buf = io.StringIO("name,age\\nAsha,31\\nBen,28\\n")
rows = list(csv.DictReader(buf))
print(rows[0]["age"] + rows[1]["age"])`, options: ['3128', '59', "['31', '28']", 'TypeError'], answer: 0, run: true, expect: '3128', explain: 'The csv module never converts types: every field is a <code>str</code>, and <code>+</code> on strings concatenates. Convert explicitly with <code>int(...)</code>.' },
    { kind: 'output', q: 'Write, then "w" again, then "a":', code: `import tempfile
from pathlib import Path

p = Path(tempfile.mkdtemp()) / "log.txt"
p.write_text("one\\n")
with open(p, "w") as f:
    f.write("two\\n")
with open(p, "a") as f:
    f.write("three\\n")
print(p.read_text().splitlines())`, options: ["['two', 'three']", "['one', 'two', 'three']", "['three']", "['one', 'three']"], answer: 0, run: true, expect: "['two', 'three']", explain: '<code>"w"</code> truncates the file when it opens, so <code>one</code> is gone. <code>"a"</code> appends after what is there.' },
    { kind: 'output', q: 'Importing the same module twice:', code: `import sys, tempfile
from pathlib import Path

d = tempfile.mkdtemp()
(Path(d) / "greet.py").write_text('print("loading greet")\\nNAME = "atlas"\\n')
sys.path.insert(0, d)

import greet
import greet
print(greet.NAME)`, options: ['loading greet\natlas', 'loading greet\nloading greet\natlas', 'atlas', 'ModuleNotFoundError'], answer: 0, run: true, expect: 'loading greet\natlas', explain: 'The first import runs the file and stores the module in <code>sys.modules</code>. The second import finds it there and runs nothing.' },
    { kind: 'concept', q: 'A file <code>tools.py</code> ends with <code>if __name__ == "__main__": main()</code>. Another file does <code>import tools</code>. What happens?', options: ['tools.py runs top to bottom, defining everything, but main() is not called', 'main() is called once on import', 'Nothing runs until a function from tools is called', 'ImportError: tools has a main block'], answer: 0, explain: 'Importing executes the module, but <code>__name__</code> is <code>"tools"</code>, not <code>"__main__"</code>, so the guarded block is skipped. Run directly (<code>python tools.py</code>), <code>__name__</code> is <code>"__main__"</code>.' },
    { kind: 'concept', q: 'What does <code>python -m venv .venv</code> create?', options: ['A folder with its own python link/launcher, pip and an empty site-packages for this project', 'A full copy of the Python source code', 'A Docker-like isolated OS environment', 'A lock file listing exact dependency versions'], answer: 0, explain: 'A venv isolates <i>packages</i>, not the OS. It reuses the base interpreter and gives you a separate <code>site-packages</code>. Pinning versions is the job of <code>requirements.txt</code> or a lock file.' }
  ],
  interview: [
    { q: 'Why use <code>with open(...)</code> instead of <code>open()</code> and <code>close()</code>?', a: '<p>The <code>with</code> block calls <code>close()</code> however it exits, including exceptions and early returns, which also flushes buffered writes. It is Java’s try-with-resources. Without it, a crash between open and close can lose data and leak file handles.</p>', lvl: 'core' },
    { q: 'What file modes do you need to know?', a: '<p><code>"r"</code> read (default), <code>"w"</code> write and <b>truncate</b>, <code>"a"</code> append, <code>"x"</code> create, failing if the file exists. Add <code>"b"</code> for bytes (<code>"rb"</code>, <code>"wb"</code>); without it you get <code>str</code> and should pass <code>encoding="utf-8"</code>. <code>"+"</code> adds the other direction (<code>"r+"</code>).</p>', lvl: 'core' },
    { q: 'How do you read a 10 GB file?', a: '<p>Iterate the file object: <code>for line in f:</code> reads one line at a time with constant memory. Avoid <code>f.read()</code> and <code>f.readlines()</code>, which load everything. For binary data, read fixed-size chunks: <code>while chunk := f.read(1 &lt;&lt; 20):</code>.</p>', lvl: 'core' },
    { q: 'What happens when you <code>import</code> a module?', a: '<ol><li>Check <code>sys.modules</code>; if present, just bind the name.</li><li>Otherwise search <code>sys.path</code> (script folder, <code>PYTHONPATH</code>, stdlib, site-packages).</li><li>Create the module object, put it in <code>sys.modules</code>, and execute its code once.</li><li>Bind the name in the importing namespace.</li></ol><p>See <a href="imports.html">Imports</a> for the deep version.</p>', lvl: 'core' },
    { q: '<code>import x</code> vs <code>from x import y</code> vs <code>import x as z</code>?', a: '<p>All three load the whole module. <code>import x</code> binds <code>x</code>; <code>from x import y</code> binds only <code>y</code> (a reference to the object at import time); <code>as</code> renames, e.g. <code>import numpy as np</code>. Avoid <code>from x import *</code>: it hides where names come from.</p>', lvl: 'core' },
    { q: 'What is <code>if __name__ == "__main__":</code> for?', a: '<p>Every module has <code>__name__</code>. It is <code>"__main__"</code> when the file is run as a script and the module’s name when imported. Guarding the entry point lets one file be both a reusable module and a runnable program, and keeps imports free of side effects.</p>', lvl: 'core' },
    { q: 'What are a venv and pip, in Java terms?', a: '<p><code>pip</code> is the installer that downloads packages from PyPI (Maven Central). A <b>venv</b> is a per-project install location, roughly a per-project <code>~/.m2</code> plus a pinned interpreter. Dependencies are declared in <code>pyproject.toml</code> (like <code>pom.xml</code>) or <code>requirements.txt</code>. Run <code>python -m pip</code> so pip matches the interpreter. Tools like uv and Poetry add lock files. See <a href="packaging.html">Packaging</a>.</p>', lvl: 'core' },
    { q: 'JSON in Python: what maps to what, and what are the traps?', a: '<p><code>dict</code>↔object, <code>list</code>/<code>tuple</code>→array, <code>str</code>, <code>int</code>/<code>float</code>, <code>True</code>/<code>False</code>↔<code>true</code>/<code>false</code>, <code>None</code>↔<code>null</code>. Traps: tuples come back as lists, non-string keys become strings, and <code>datetime</code>, <code>Decimal</code>, sets and custom objects raise <code>TypeError</code> unless you pass <code>default=</code>.</p>', lvl: 'core' },
    { q: 'Why <code>pathlib</code> over <code>os.path</code>?', a: '<p><code>Path</code> objects join with <code>/</code>, expose <code>.name</code>, <code>.suffix</code>, <code>.parent</code>, and have methods like <code>.exists()</code>, <code>.glob()</code>, <code>.read_text()</code> and <code>.mkdir(parents=True, exist_ok=True)</code>. It is like <code>java.nio.file.Path</code> and <code>Files</code> combined. Most stdlib functions accept <code>Path</code> objects directly.</p>', lvl: 'core' },
    { q: 'How do you write a file so readers never see it half-written?', a: '<p>Write to a temporary file in the <b>same directory</b>, flush and optionally <code>os.fsync</code>, then <code>os.replace(tmp, target)</code>. <code>os.replace</code> is an atomic rename on POSIX file systems when both paths are on the same file system, so readers see either the old or the new file.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Java: read JSON config, write CSV', lang: 'java', code: `// Java 21 + Jackson
Path cfgPath = Path.of("config", "app.json");
ObjectMapper om = new ObjectMapper();
Map<String, Object> cfg = om.readValue(Files.readString(cfgPath), new TypeReference<>() {});

try (BufferedWriter w = Files.newBufferedWriter(Path.of("out.csv"), StandardCharsets.UTF_8)) {
    w.write("name,age\\n");
    for (User u : users) w.write(u.name() + "," + u.age() + "\\n");   // no quoting!
}`, note: 'JSON needs a library; CSV is usually hand-rolled or needs another library.' },
    { title: 'Python: same task, stdlib only', lang: 'python', code: `import csv
import json
from pathlib import Path

cfg_path = Path("config") / "app.json"
cfg = json.loads(cfg_path.read_text(encoding="utf-8"))

with open("out.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["name", "age"])
    w.writerows((u.name, u.age) for u in users)   # handles commas and quotes`, note: 'Both modules ship with Python, and <code>csv</code> quotes fields properly.' },
    { title: 'Project layout & entry point', lang: 'python', code: `# my_agent/
#   pyproject.toml        <- dependencies (like pom.xml)
#   .venv/                <- not committed
#   src/my_agent/__init__.py
#   src/my_agent/tools.py
#   src/my_agent/__main__.py   <- python -m my_agent

# src/my_agent/__main__.py
import json
import sys
from pathlib import Path

from my_agent.tools import load_tools      # absolute import from the package


def main(argv: list[str]) -> int:
    cfg = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    tools = load_tools(cfg["tools"])
    print(f"loaded {len(tools)} tools")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))`, note: 'A <code>__main__.py</code> in a package makes <code>python -m my_agent config.json</code> work; the guard keeps imports side-effect free.' }
  ]
});
