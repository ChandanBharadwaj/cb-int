IA.register({
  track: 'python',
  slug: 'imports',
  title: 'Import system',
  tagline: '<code>import x</code> is a run-time statement. It checks the <b><code>sys.modules</code> cache</b>, otherwise asks finders to search <b><code>sys.path</code></b>, creates a module, <b>caches it before running it</b>, executes its top-level code once, and binds a name. Those five steps explain shadowed stdlib modules, circular-import errors and “why did my module run twice?”.',
  tldr: {
    problem: 'Import bugs show up as startup failures and heisenbugs: <code>ImportError: cannot import name … (most likely due to a circular import)</code>, a local <code>logging.py</code> breaking a library, code that works with <code>python -m</code> but not as a script, or a “singleton” that exists twice.',
    model: 'A module is an object in <code>sys.modules</code>, created by executing a file top to bottom. <b>Lookup order:</b> cache → <code>sys.meta_path</code> finders (built-in, frozen, then the path finder over <code>sys.path</code>, in order, first match wins). The new module goes into the cache <i>before</i> its code runs, so a re-entrant import gets the half-built module instead of recursing.',
    hook: '“Why does <code>from a import X</code> fail in a cycle when <code>import a</code> works?” Both get the partially initialised module from <code>sys.modules</code>. <code>from … import X</code> needs <code>X</code> to exist <i>right now</i>; <code>import a</code> only binds the module and looks up <code>a.X</code> later, when it’s finally defined.',
    facts: [
      { v: 'once', l: 'a module’s top-level code runs once per process (per <code>sys.modules</code> key). Every later import is a dictionary lookup' },
      { v: 'sys.path[0]', l: 'is the directory of the script you ran (<code>python tools/x.py</code> → <code>tools/</code>), or the current directory for <code>python -m</code>. 3.11+: <code>-P</code> / <code>PYTHONSAFEPATH</code> skips it' },
      { v: '__main__', l: 'the name of the module you ran. Imported again under its real name, the same file runs a second time as a separate module' }
    ]
  },
  intro: {
    what: 'A <b>module</b> is just a <code>.py</code> file; a <b>package</b> is a folder of modules (usually with an <code>__init__.py</code>). <code>import</code> finds the file, runs it to create the module’s variables, functions and classes, and gives you a name to reach them. Python remembers every module it has loaded, so importing it again elsewhere is instant and returns the very same object.',
    analogy: { icon: '📚', title: 'A library with a reading room', text: 'When you ask for a book, the librarian first checks the reading-room table: if someone already fetched it, you get that same copy. Otherwise they search the shelves in a fixed order (your own desk first, then the standard collection, then installed extras) and take the first match, even if it is the wrong book with the right title. They put it on the table the moment they find it, before anyone has finished reading it.' },
    steps: [
      { t: 'A file is a module', d: 'Running <code>import shop</code> executes <code>shop.py</code> once and gives you a module object.', code: '# shop.py\nTAX = 0.2\ndef total(x):\n    return x * (1 + TAX)\n\n# main.py\nimport shop\nprint(shop.total(100))' },
      { t: 'Python searches sys.path', d: 'A list of folders: the script’s folder first, then the standard library, then <code>site-packages</code> (installed packages). First match wins.', code: 'import sys\nprint(sys.path)' },
      { t: 'Loaded modules are cached', d: '<code>sys.modules</code> maps names to loaded modules. A second <code>import shop</code> just returns <code>sys.modules["shop"]</code>.' },
      { t: 'Packages group modules', d: 'A folder with <code>__init__.py</code>. <code>import shop.cart</code> runs <code>shop/__init__.py</code>, then <code>shop/cart.py</code>.' },
      { t: '__main__ is the script you ran', d: 'Code under <code>if __name__ == "__main__":</code> runs only when the file is executed directly, not when it is imported.', code: 'def main(): ...\n\nif __name__ == "__main__":\n    main()' }
    ],
    terms: [
      ['module', 'An object created by running a <code>.py</code> file (or a built-in / C extension). Its globals are its attributes.'],
      ['package', 'A module that can contain submodules: a directory, normally with <code>__init__.py</code>.'],
      ['sys.path', 'The ordered list of places the path finder searches.'],
      ['sys.modules', 'The cache of loaded modules: <code>dict[str, module]</code>.'],
      ['finder / loader', 'A finder locates a module and returns a <code>ModuleSpec</code>; a loader creates and executes it.'],
      ['__main__', 'The module name given to the program you started (<code>python app.py</code> or <code>python -m pkg</code>).']
    ]
  },
  visual: {
    title: 'Follow one import statement',
    caption: 'Pick a scenario and press <b>Play</b> or <b>Step</b>. Watch the cache check, the finders, the walk down <code>sys.path</code> (first match wins), the module being cached <i>before</i> it runs, and finally the name being bound. The shadowing and circular scenarios break exactly where real projects break.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'What import does', code: `import sys, tempfile, pathlib, importlib

tmp = pathlib.Path(tempfile.mkdtemp())
(tmp / "shop.py").write_text("""
print("  executing shop.py, __name__ =", __name__)
TAX = 0.2
""")
sys.path.insert(0, str(tmp))
importlib.invalidate_caches()

sys.modules.pop("shop", None)     # playground re-runs share one interpreter
print("cached before?", "shop" in sys.modules)
import shop
print("cached after? ", "shop" in sys.modules, sys.modules["shop"] is shop)
import shop                       # no second "executing" line
print("file:", pathlib.Path(shop.__file__).name)
print("spec:", shop.__spec__.name, "loaded by", type(shop.__spec__.loader).__name__)` },
      { label: 'Where Python looks', code: `import sys, importlib.util

print("sys.path (searched in this order):")
for p in sys.path:
    print("  ", p or "'' (current directory)")

print("\\nmeta path finders:")
for f in sys.meta_path:
    print("  ", getattr(f, "__name__", type(f).__name__))

for name in ("sys", "json", "decimal", "no_such_module"):
    spec = importlib.util.find_spec(name)
    print(f"{name:15} ->", spec.origin if spec else None)` },
      { label: 'Circular import', code: `import sys, tempfile, pathlib, importlib

for m in ("models", "services"):
    sys.modules.pop(m, None)      # playground re-runs share one interpreter

def project(files):
    tmp = pathlib.Path(tempfile.mkdtemp())
    for name, src in files.items():
        (tmp / name).write_text(src)
    sys.path.insert(0, str(tmp)); importlib.invalidate_caches()

project({
    "models.py": "from services import audit\\nclass User: ...\\n",
    "services.py": "from models import User\\ndef audit(u: 'User'): ...\\n",
})
try:
    import models
except ImportError as e:
    print("broken:", str(e).split(" (")[0])
print("cleaned up?", "models" not in sys.modules)

for m in ("models", "services"):
    sys.modules.pop(m, None)
sys.path.pop(0)

project({
    "models.py": "import services\\nclass User: ...\\n",
    "services.py": "import models\\ndef audit(u): return isinstance(u, models.User)\\n",
})
import models, services
print("fixed:", services.audit(models.User()))` },
      { label: '__main__ runs twice', code: `import runpy, sys, tempfile, pathlib, importlib
sys.modules.pop("app", None)                      # playground re-runs share one interpreter

tmp = pathlib.Path(tempfile.mkdtemp())
(tmp / "app.py").write_text("""
import sys
print("executing app.py as", __name__)
REGISTRY = []
import app                         # imports *itself* under its real name
print("  in", __name__, "- is app the running module?", app is sys.modules["__main__"])
""")
sys.path.insert(0, str(tmp)); importlib.invalidate_caches()

# what "python app.py" does: run the file under the name __main__
runpy.run_path(str(tmp / "app.py"), run_name="__main__")`, note: 'Two module objects from one file: two <code>REGISTRY</code> lists, two copies of every class.' },
      { label: 'sys.modules is a dict', code: `import sys, types

fake = types.ModuleType("feature_flags")
fake.ENABLED = {"new_planner": True}
sys.modules["feature_flags"] = fake          # what test doubles and plugins do

import feature_flags
print(feature_flags.ENABLED)

sys.modules["optional_dep"] = None            # None means "known to be missing"
try:
    import optional_dep
except ImportError as e:
    print(type(e).__name__, "-", e)` },
      { label: 'Shadowing the stdlib', code: `import sys, tempfile, pathlib, importlib

tmp = pathlib.Path(tempfile.mkdtemp())
(tmp / "calendar.py").write_text("# my helpers, unluckily named\\nWORKDAYS = 5\\n")
sys.path.insert(0, str(tmp)); importlib.invalidate_caches()
sys.modules.pop("calendar", None)

import calendar
print("got:", calendar.__file__)
try:
    calendar.isleap(2024)
except AttributeError as e:
    print("AttributeError:", e)
finally:
    sys.modules.pop("calendar", None)        # undo the damage for later runs
    sys.path.remove(str(tmp))`, note: 'Python 3.13 adds a hint to this error suggesting you rename the file that shadows a standard-library module.' }
    ]
  },
  gotchas: [
    { trap: 'Your file shadows a standard or installed module', code: `project/
  logging.py        # "just some helpers"
  main.py           # import logging → your file, not the stdlib`, lang: 'text', why: 'The script’s directory is <code>sys.path[0]</code>, searched before the standard library and <code>site-packages</code>. Any library that imports <code>logging</code> (or <code>random</code>, <code>json</code>, <code>email</code>…) gets your file too.', fix: 'Don’t name modules after stdlib or dependency modules. Use a package (<code>myapp/logging_utils.py</code>). Check with <code>python -c "import logging; print(logging.__file__)"</code>. 3.13 points this out in the error message.' },
    { trap: 'Running a package module as a script', code: `$ python myapp/jobs/reindex.py
ImportError: attempted relative import with no known parent package
$ python -m myapp.jobs.reindex      # works`, lang: 'bash', why: 'As a script, the file is <code>__main__</code> with no package, and <code>sys.path[0]</code> is <code>myapp/jobs/</code>, so neither <code>from . import x</code> nor <code>import myapp</code> resolves as intended.', fix: 'Run modules with <code>python -m package.module</code> from the project root, or expose them as console-script entry points in <code>pyproject.toml</code>.' },
    { trap: '<code>from x import name</code> inside an import cycle', code: `# models.py
from services import audit     # services is still half-built
# services.py
from models import User        # ImportError: partially initialized module 'models'`, why: 'Each module is in <code>sys.modules</code> before its body has run. <code>from … import name</code> needs the name to exist at that moment.', fix: 'Break the cycle: move shared types into a third module, import the module (<code>import models</code>) and access <code>models.User</code> at call time, or put annotation-only imports under <code>if TYPE_CHECKING:</code>.' },
    { trap: 'Doing real work at import time', code: `# settings.py
DB = psycopg.connect(os.environ["DATABASE_URL"])   # runs on first import
MODEL = load_model("/models/7b")                    # 40 s, even for --help`, why: 'Top-level code runs whenever anything imports the module: tests, CLI help, a type checker plugin, every forked worker. Failures become import errors with confusing tracebacks, and startup time balloons.', fix: 'Keep import side-effect free: define functions and classes, then create resources in <code>main()</code>, an app factory, or a cached getter (<code>functools.cache</code>).' },
    { trap: 'The entry-point module imported under two names', why: 'If <code>app.py</code> is run as <code>python app.py</code> (<code>__main__</code>) and another module does <code>import app</code>, the file executes twice. You get two module objects: duplicate registries, two copies of each class (so <code>isinstance</code> fails), double-registered signal handlers.', fix: 'Keep the entry point thin: <code>if __name__ == "__main__": from app.cli import main; main()</code>, and never import the entry script from elsewhere.' },
    { trap: 'Expecting <code>importlib.reload</code> to update everything', code: `from config import LEVEL
importlib.reload(config)    # config.LEVEL is new; LEVEL is still the old object`, why: 'Reload re-executes the module’s code into the <b>same</b> module object. Names other modules copied with <code>from … import</code>, and instances of old classes, still point at the old objects.', fix: 'Avoid reload in production. For configuration, read values through the module (<code>config.LEVEL</code>) or through a function.' },
    { trap: 'Forgetting <code>__init__.py</code> and getting a namespace package', why: 'Without it, a directory becomes a PEP 420 namespace package: it imports, but several directories with the same name merge, <code>__file__</code> is <code>None</code>, and some tools (test discovery, type checkers, packaging) treat it differently.', fix: 'Add <code>__init__.py</code> to every regular package; use namespace packages only on purpose (plugins split across distributions).' }
  ],
  scenarios: [
    { title: 'Container cold start went from 2 s to 14 s',
      symptom: 'After adding an “AI features” module, every pod (and every CLI invocation, even <code>--help</code>) takes 14 s to start. Readiness probes time out during deploys.',
      diagnose: `$ python -X importtime -c "import app.main" 2> import.log
$ sort -t'|' -k2 -n import.log | tail -5
import time:   1803211 | 11904877 | app.ai.embeddings      # cumulative µs`,
      diagnoseLang: 'bash',
      cause: '<code>app/ai/embeddings.py</code> imports a large ML stack and loads a model at module level, and <code>app/__init__.py</code> imports <code>app.ai</code> eagerly, so every entry point pays for it.',
      fix: 'Move the heavy import and the model load into a function that runs on first use, and stop re-exporting heavy submodules from package <code>__init__.py</code> files.',
      fixCode: `# app/ai/embeddings.py
from functools import cache

@cache
def _model():
    from sentence_transformers import SentenceTransformer   # imported on first call
    return SentenceTransformer("all-MiniLM-L6-v2")

def embed(texts: list[str]):
    return _model().encode(texts)` },
    { title: '<code>AttributeError: module \'random\' has no attribute \'choice\'</code> in a third-party library',
      symptom: 'A data-science notebook folder suddenly fails inside an HTTP client library that uses <code>random.choice</code> for retries. Nothing in the library changed.',
      diagnose: `$ python -c "import random; print(random.__file__)"
/home/dev/experiments/random.py`,
      diagnoseLang: 'bash',
      cause: 'Someone saved an experiment as <code>random.py</code> next to the notebook. That directory is first on <code>sys.path</code>, so <i>every</i> <code>import random</code> in the process, including the library’s, gets the local file.',
      fix: 'Rename the file (and delete its <code>__pycache__</code>). On 3.13 the error message names the shadowing file directly. Add a CI check that no module name collides with <code>sys.stdlib_module_names</code>.',
      fixCode: `import pathlib, sys
clashes = [p for p in pathlib.Path("src").rglob("*.py") if p.stem in sys.stdlib_module_names]
assert not clashes, f"rename these: {clashes}"` },
    { title: 'Startup fails after a “harmless” type-hint refactor',
      symptom: 'The API won’t start: <code>ImportError: cannot import name \'Order\' from partially initialized module \'app.models\' (most likely due to a circular import)</code>.',
      diagnose: `# app/models.py
from app.services.pricing import price_for      # new: for a helper method
class Order: ...
# app/services/pricing.py
from app.models import Order                    # only used in annotations`,
      cause: '<code>models</code> imports <code>pricing</code>, and <code>pricing</code> imports a name from <code>models</code> before <code>models</code> has defined it.',
      fix: 'Annotation-only imports go under <code>TYPE_CHECKING</code> (with string or postponed annotations), and the helper call imports lazily or moves to the service layer.',
      fixCode: `# app/services/pricing.py
from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.models import Order     # seen by type checkers, never executed

def price_for(order: Order) -> int: ...` },
    { title: 'Every background job runs twice',
      symptom: 'A worker started with <code>python worker.py</code> registers each job handler twice, so every job runs twice and sends duplicate emails.',
      diagnose: `print(__name__, id(sys.modules[__name__]))   # in worker.py: printed twice,
# once as "__main__" and once as "worker"`,
      cause: '<code>worker.py</code> defines the registry and handlers and is run as a script (<code>__main__</code>). A plugin module does <code>from worker import register</code>, which executes <code>worker.py</code> again as <code>worker</code>: a second registry, and the plugin registers into it as well.',
      fix: 'Move the registry and handlers into a package module, keep the script a thin entry point, and run it with <code>python -m</code> or a console-script entry point.',
      fixCode: `# jobs/registry.py  ← the only definition of REGISTRY
# jobs/__main__.py
from jobs.worker import main
main()
# run with:  python -m jobs` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `import sys, tempfile, pathlib
sys.dont_write_bytecode = True
tmp = pathlib.Path(tempfile.mkdtemp())
(tmp / "counter.py").write_text("""
print("loading counter")
n = 0
""")
sys.path.insert(0, str(tmp))

import counter
import counter
counter.n += 1
import counter as again
print(again.n, again is counter)`, options: ['loading counter<br>1 True', 'loading counter<br>loading counter<br>0 False', 'loading counter<br>loading counter<br>loading counter<br>1 True', 'loading counter<br>0 True'], answer: 0, run: true, expect: 'loading counter\n1 True', explain: 'The first import executes the file and caches the module in <code>sys.modules</code>. Later imports, under any alias, return the <b>same object</b>, so the mutation is visible and the print runs once.' },
    { kind: 'predict', q: 'Two modules import names from each other. What does this print?', code: `import sys, tempfile, pathlib
sys.dont_write_bytecode = True
tmp = pathlib.Path(tempfile.mkdtemp())
(tmp / "a.py").write_text("""
import b
X = 1
""")
(tmp / "b.py").write_text("""
from a import X
""")
sys.path.insert(0, str(tmp))

try:
    import a
except ImportError as e:
    print(type(e).__name__, "partially initialized" in str(e))
print("a" in sys.modules, "b" in sys.modules)`, options: ['Nothing is raised; prints True True', 'ImportError True<br>False False', 'ImportError True<br>True True', 'RecursionError'], answer: 1, run: true, expect: 'ImportError True\nFalse False', explain: '<code>a</code> is cached, starts running, imports <code>b</code>; <code>b</code> asks for <code>X</code> from the half-built <code>a</code>, which has no <code>X</code> yet. The error mentions a “partially initialized module”. When a module’s execution fails, the import system <b>removes it from <code>sys.modules</code></b>, so neither stays cached.' },
    { kind: 'predict', q: 'Same cycle, but <code>b</code> imports the module and reads the attribute later. What does this print?', code: `import sys, tempfile, pathlib
sys.dont_write_bytecode = True
tmp = pathlib.Path(tempfile.mkdtemp())
(tmp / "a.py").write_text("""
import b
X = 1
""")
(tmp / "b.py").write_text("""
import a
def get():
    return a.X
""")
sys.path.insert(0, str(tmp))

import a
import b
print(b.get())`, options: ['1', 'ImportError', 'AttributeError: partially initialized module', 'None'], answer: 0, run: true, expect: '1', explain: 'In <code>b</code>, <code>import a</code> just binds the (half-built) module object, which is fine. <code>a.X</code> is only looked up when <code>get()</code> is called, long after <code>a</code> finished running and defined <code>X</code>.' },
    { kind: 'predict', q: 'This simulates <code>python app.py</code> for a file that imports itself. What does it print?', code: `import runpy, sys, tempfile, pathlib
sys.dont_write_bytecode = True
tmp = pathlib.Path(tempfile.mkdtemp())
(tmp / "app.py").write_text("""
print("running as", __name__)
import app
""")
sys.path.insert(0, str(tmp))

runpy.run_path(str(tmp / "app.py"), run_name="__main__")`, options: ['running as __main__', 'running as __main__<br>running as app', 'running as app<br>running as __main__', 'An infinite loop of prints'], answer: 1, run: true, expect: 'running as __main__\nrunning as app', explain: 'The script runs as <code>__main__</code>. <code>import app</code> looks for <code>sys.modules["app"]</code>, finds nothing (the running module is cached as <code>__main__</code>), and executes the file <b>again</b> under the name <code>app</code>. Inside that second run, <code>import app</code> hits the cache, so there is no third.' },
    { kind: 'predict', q: 'What does this print?', code: `import sys, tempfile, pathlib
sys.dont_write_bytecode = True
tmp = pathlib.Path(tempfile.mkdtemp())
pkg = tmp / "shop"
pkg.mkdir()
(pkg / "__init__.py").write_text("""print("init shop")""")
(pkg / "cart.py").write_text("""print("init cart")""")
sys.path.insert(0, str(tmp))

import shop.cart
import shop.cart
print("shop" in dir(), "cart" in dir())`, options: ['init cart<br>False True', 'init shop<br>init cart<br>True False', 'init shop<br>init cart<br>init shop<br>init cart<br>True True', 'init shop<br>init cart<br>True True'], answer: 1, run: true, expect: 'init shop\ninit cart\nTrue False', explain: 'Importing a submodule first imports every parent package, so <code>shop/__init__.py</code> runs before <code>cart.py</code>, each once. <code>import shop.cart</code> binds only the top-level name <code>shop</code>; reach the submodule as <code>shop.cart</code>.' },
    { kind: 'predict', q: 'What does this print?', code: `import importlib, sys, tempfile, pathlib
sys.dont_write_bytecode = True
tmp = pathlib.Path(tempfile.mkdtemp())
(tmp / "cfg.py").write_text("""LEVEL = "info" """)
sys.path.insert(0, str(tmp))

import cfg
from cfg import LEVEL
(tmp / "cfg.py").write_text("""LEVEL = "debug" """)
importlib.reload(cfg)
print(cfg.LEVEL, LEVEL)`, options: ['debug debug', 'info info', 'debug info', 'info debug'], answer: 2, run: true, expect: 'debug info', explain: '<code>reload</code> re-executes the file into the same module object, so <code>cfg.LEVEL</code> is new. <code>from cfg import LEVEL</code> copied a reference into this namespace earlier, and nothing updates it.' },
    { kind: 'concept', q: 'From the repository root you run <code>python tools/report.py</code>. What is <code>sys.path[0]</code>?', options: ['The repository root (current directory)', 'The <code>tools/</code> directory (absolute path)', '<code>site-packages</code>', 'An empty string'], answer: 1, explain: 'For a script, Python prepends the script’s directory, not the working directory. That is why <code>import mypackage</code> from the repo root fails inside <code>tools/report.py</code>, and why <code>python -m tools.report</code> (which prepends the current directory) behaves differently.' },
    { kind: 'concept', q: 'Which statement about <code>if __name__ == "__main__":</code> is correct?', options: ['It makes the module load faster', 'Code under it runs when the file is executed directly, not when it is imported, which is also what the spawn start method of <code>multiprocessing</code> relies on', 'It is required for every module', 'It prevents the module from being imported twice'], answer: 1, explain: 'An imported module has <code>__name__</code> set to its dotted name. Process pools using <i>spawn</i> re-import your main module in each child, so unguarded top-level code would run again there. See <a href="threading-multiprocessing.html">Threads vs processes</a>.' }
  ],
  interview: [
    { q: 'Walk through what happens on <code>import requests</code>.', a: '<ol><li>Check <code>sys.modules["requests"]</code>; on a hit, bind the name and stop.</li><li>Ask each finder on <code>sys.meta_path</code> for a spec: built-in modules, frozen modules, then <code>PathFinder</code>.</li><li><code>PathFinder</code> walks <code>sys.path</code> in order; for each entry a path-entry finder (cached in <code>sys.path_importer_cache</code>) looks for a package directory, a <code>.py</code>, a compiled <code>.pyc</code> or an extension module. First match returns a <code>ModuleSpec</code>.</li><li>The loader creates the module object, which is inserted into <code>sys.modules</code>, then executes its code in the module’s namespace.</li><li>The name <code>requests</code> is bound in the importing namespace.</li></ol>', lvl: 'core' },
    { q: 'What is on <code>sys.path</code>, in what order?', a: '<p>The script’s directory (or the current directory for <code>-m</code>, or <code>\'\'</code> for an interactive session), then entries from <code>PYTHONPATH</code>, then the standard library (zip, directory, <code>lib-dynload</code>), then <code>site-packages</code> of the active environment, plus anything <code>.pth</code> files add. 3.11 added <code>-P</code> / <code>PYTHONSAFEPATH</code> to stop prepending the script directory.</p>', fu: 'Why would you want -P? (So a stray file in the working directory can’t shadow a stdlib or installed module.)', lvl: 'core' },
    { q: 'What are explicit lazy imports (Python 3.15)?', a: '<p>PEP 810 adds a soft keyword: <code>lazy import json</code> or <code>lazy from pathlib import Path</code>. The name is bound to a proxy, and the module is loaded on <b>first use</b>. That cuts start-up time for CLIs and big services without hiding imports inside functions. Rules: module scope only (not in a function, class body or <code>try</code>), and no <code>lazy from x import *</code>. The catch: an <code>ImportError</code> or an import side effect now happens at first use, not at start-up. <code>-X lazy_imports=all</code> or <code>PYTHON_LAZY_IMPORTS=all</code> turns it on globally for testing. On 3.14 and older, the usual tools are still a function-level import or <code>importlib.util.LazyLoader</code>.</p>', lvl: 'deep' },
    { q: 'Why does a circular import fail, and how do you fix one?', a: '<p>Modules are cached before they run, so a cycle doesn’t recurse forever: the second module just receives the half-initialised first one. It breaks only when something needs a name that isn’t defined yet, typically <code>from a import X</code> or a class inheriting from a class in the other module. Fixes, from best to worst: restructure (extract the shared piece into a third module); import the module and access attributes at call time; move annotation-only imports under <code>TYPE_CHECKING</code>; as a last resort import inside the function that needs it.</p>', lvl: 'core' },
    { q: 'What’s the difference between <code>python app/main.py</code> and <code>python -m app.main</code>?', a: '<p>Both run the code as <code>__main__</code>. As a script, <code>sys.path[0]</code> is <code>app/</code> and the module has no package, so relative imports fail. With <code>-m</code>, Python imports the parent package <code>app</code> first, sets <code>__package__</code>, puts the current directory on <code>sys.path</code>, and relative imports work. <code>python -m pkg</code> runs <code>pkg/__main__.py</code>.</p>', lvl: 'core' },
    { q: 'What does <code>if __name__ == "__main__":</code> do, and why is it needed?', a: '<p>Each module’s <code>__name__</code> is its import name; the program you start is named <code>"__main__"</code>. The guard runs code only when the file is the entry point, so the same file can also be imported (by tests, by other modules, by <code>multiprocessing</code>’s spawn workers, which re-import the main module) without side effects.</p>', lvl: 'core' },
    { q: 'Regular packages vs namespace packages?', a: '<p>A regular package is a directory with <code>__init__.py</code>, which runs on import and can define the package’s API. A namespace package (PEP 420, 3.3+) has no <code>__init__.py</code>; portions in several <code>sys.path</code> directories are merged into one package with a <code>__path__</code> that spans them. It’s meant for distributing one top-level name across several installs (company or plugin namespaces).</p>', lvl: 'deep' },
    { q: 'How do <code>.pyc</code> files work?', a: '<p>On import, source is compiled to bytecode and cached in <code>__pycache__/name.cpython-312.pyc</code> (PEP 3147). By default the cache is validated by the source file’s mtime and size stored in the header; PEP 552 (3.7) adds hash-based validation, useful for reproducible builds. Only imported modules are cached; the script you run directly is compiled each time.</p>', lvl: 'deep' },
    { q: 'How would you make an import hook or a plugin system?', a: '<p>For plugins, use <code>importlib.metadata.entry_points(group="myapp.plugins")</code> and <code>importlib.import_module(name)</code>. That is the standard, discoverable mechanism. For real hooks, put a finder on <code>sys.meta_path</code> that implements <code>find_spec</code> and returns a spec with a custom loader (<code>create_module</code>/<code>exec_module</code>). Tools use this for things like importing from a database, encrypted modules or source rewriting (pytest rewrites asserts this way).</p>', lvl: 'deep' },
    { q: 'Why are modules effectively singletons, and when does that break?', a: '<p>One <code>sys.modules</code> entry per name means module-level state is shared by every importer in the process, which is why a module is Python’s simplest singleton. It breaks when the same file is imported under two names (<code>__main__</code> and <code>app</code>, or two <code>sys.path</code> entries that make it reachable as both <code>pkg.mod</code> and <code>mod</code>), after <code>importlib.reload</code>, and across processes, where each worker has its own copy.</p>', lvl: 'core' },
    { q: 'How would you speed up a slow-starting Python service?', a: '<ul><li>Measure: <code>python -X importtime</code>, sorted by cumulative time.</li><li>Defer heavy optional dependencies to first use (function-level imports, <code>functools.cache</code>d getters).</li><li>Keep package <code>__init__.py</code> files light; don’t re-export heavy submodules.</li><li>Remove import-time I/O (network, model loading, reading big files).</li><li>Make sure <code>.pyc</code> files can be written or are pre-built in the image (<code>python -m compileall</code>).</li></ul>', lvl: 'core' },
    { q: 'Compare Python imports with Java class loading.', a: '<p>Java resolves classes lazily from the classpath via class loaders; a class’s static initialiser runs once, on first active use, and the same class name loaded by two class loaders is two different classes. Python resolves modules from <code>sys.path</code> when the <code>import</code> statement executes, and runs the whole module top to bottom then. The “loaded twice” bug is the Python analogue of the two-class-loaders problem. There is no compile-time check: a typo in an import fails only when that line runs.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Project layout with a real entry point', lang: 'python', code: `# Layout (src layout keeps the repo root off sys.path):
#   pyproject.toml
#   src/agentd/__init__.py      ← light: version, public names only
#   src/agentd/__main__.py      ← "python -m agentd"
#   src/agentd/cli.py
#   src/agentd/tools/search.py
#
# pyproject.toml
#   [project.scripts]
#   agentd = "agentd.cli:main"  ← console script, no __main__ ambiguity

# src/agentd/__main__.py
from agentd.cli import main

raise SystemExit(main())

# src/agentd/cli.py
import argparse

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="agentd")
    parser.add_argument("task")
    args = parser.parse_args(argv)
    from agentd.runtime import run      # heavy import only when we actually run
    return run(args.task)`, note: 'Tests call <code>main([...])</code> directly; nothing runs at import.' },
    { title: 'Breaking cycles: TYPE_CHECKING and module imports', lang: 'python', code: `# app/services/billing.py
from __future__ import annotations          # annotations are not evaluated at runtime (the default behaviour is lazy since 3.14)
from typing import TYPE_CHECKING

import app.models as models                 # bind the module; attributes read at call time

if TYPE_CHECKING:                           # False at runtime, True for mypy/pyright
    from app.models import Invoice

def total(invoice: Invoice) -> int:
    return sum(line.cents for line in invoice.lines)

def new_invoice(customer_id: int) -> Invoice:
    return models.Invoice(customer_id=customer_id, lines=[])` },
    { title: 'Java comparison: static init vs module body', lang: 'java', code: `// Java: the static initialiser runs once, on first active use of the class.
public final class Settings {
    static final Properties PROPS = load();          // ≈ module-level code in settings.py
    private static Properties load() { ... }
}
// Classpath order decides which Settings.class wins, like sys.path order.
// Two class loaders → two Settings classes (instanceof fails), the analogue of
// Python running app.py as both __main__ and app.

// Python equivalent of a lazy holder (initialise on first use, not at import):
// @functools.cache
// def settings() -> dict: return load()`, note: 'Python has no compile-time import check, so an import cycle or a typo surfaces only when that line executes.' }
  ]
});
