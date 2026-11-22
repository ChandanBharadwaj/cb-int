IA.register({
  track: 'python',
  slug: 'packaging',
  title: 'Packaging & environments',
  tagline: 'A virtual environment is just a folder with its own <code>site-packages</code> and a <code>pyvenv.cfg</code> that points back at a real interpreter. <code>pyproject.toml</code> says what you <b>accept</b> (ranges); a lockfile says what you <b>got</b> (exact versions and hashes). Most “works on my machine” bugs are the gap between those two.',
  tldr: {
    problem: 'Python has no single blessed build tool. Teams mix system Python, <code>pip</code>, <code>requirements.txt</code>, Poetry and uv, and then a Friday deploy installs a different version of a dependency than the one that passed tests.',
    model: 'Three layers. <b>Interpreter</b> (which <code>python</code> runs). <b>Environment</b> (which <code>site-packages</code> folder <code>import</code> searches, chosen by <code>sys.prefix</code>). <b>Resolution</b> (which exact versions fill it: ranges in <code>pyproject.toml</code> → resolver → lockfile → installer).',
    hook: '“Why did prod get a version nobody tested?” Because <code>pip install .</code> re-resolves the <i>ranges</i> on every build. Only a lockfile, installed with <code>uv sync --locked</code> (or pip with <code>--require-hashes</code>), makes the build reproducible.',
    facts: [
      { v: 'sys.prefix', l: 'differs from <code>sys.base_prefix</code> only inside a venv. That is how Python (and you) can tell it is in one' },
      { v: 'PEP 621', l: 'the standard <code>[project]</code> table in <code>pyproject.toml</code>, read by pip, uv, Hatch, setuptools and (since 2.0) Poetry' },
      { v: 'PEP 668', l: 'lets an OS mark its Python “externally managed”, so <code>pip install</code> into it fails with <code>externally-managed-environment</code> (Debian 12, Ubuntu 23.04+)' }
    ]
  },
  intro: {
    what: 'A Python program uses <b>packages</b>: code other people wrote, downloaded from PyPI (the Python Package Index). Different projects need different versions, so each project gets its own <b>virtual environment</b>: a private folder where its packages are installed. A project file, <code>pyproject.toml</code>, lists what the project needs, and a <b>lockfile</b> records the exact versions that were installed, so every machine gets the same ones.',
    analogy: { icon: '🧰', title: 'A toolbox per job', text: 'The system Python is the shared workshop wall: if every job hangs its tools there, two jobs that need different sizes of the same spanner fight. A venv is a toolbox per job. <code>pyproject.toml</code> is the shopping list (“a 10–12 mm spanner”), and the lockfile is the receipt (“bought: 11 mm, brand X, serial 4412”). Give someone the receipt and they can buy exactly the same thing.' },
    steps: [
      { t: 'Make a venv per project', d: 'A folder with its own <code>bin/python</code> and <code>site-packages</code>.', code: 'python3.12 -m venv .venv\nsource .venv/bin/activate      # Windows: .venv\\Scripts\\activate\npython -c "import sys; print(sys.prefix)"', lang: 'bash' },
      { t: 'Declare dependencies as ranges', d: 'In <code>pyproject.toml</code>, say which versions you are compatible with.', code: '[project]\nname = "orders-svc"\nrequires-python = ">=3.12"\ndependencies = ["httpx>=0.27,<0.29", "pydantic>=2.7,<3"]', lang: 'text' },
      { t: 'Resolve once, lock the result', d: 'A resolver picks one exact version per package and writes them, with hashes, to a lockfile you commit.', code: 'uv lock            # writes uv.lock\nuv sync --locked   # installs exactly what uv.lock says', lang: 'bash' },
      { t: 'Upgrade on purpose', d: 'Upgrades become a reviewed diff of the lockfile, not a surprise at build time.', code: 'uv lock --upgrade-package httpx', lang: 'bash' }
    ],
    terms: [
      ['PyPI', 'The public package index. <code>pip install httpx</code> downloads from it by default.'],
      ['wheel (.whl)', 'A pre-built package: a zip that is unpacked straight into <code>site-packages</code>. An <b>sdist</b> is source that must be built first.'],
      ['virtual environment (venv)', 'A folder with <code>pyvenv.cfg</code>, <code>bin/</code> and its own <code>site-packages</code>, linked to a base interpreter.'],
      ['site-packages', 'The folder where installed third-party packages live. It is one entry on <code>sys.path</code>.'],
      ['resolver', 'The algorithm that turns ranges (<code>&gt;=0.27</code>) into one compatible exact version per package.'],
      ['lockfile', 'The resolver’s output, saved: exact versions and hashes for every package, including transitive ones (<code>uv.lock</code>, <code>poetry.lock</code>, a hashed <code>requirements.txt</code>).']
    ]
  },
  visual: {
    title: 'Where does <code>import</code> find it, and which version is it?',
    caption: 'Pick a story. <b>venv & imports</b> follows <code>python</code> and <code>import httpx</code> from the shell to a file on disk. <b>Ranges vs lockfile</b> replays one week of a real dependency release with and without a lockfile: switch the lock toggle and play it again. Use <b>Play</b> or <b>Step</b>.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Where am I?', code: `import sys, sysconfig

print("executable :", sys.executable)
print("version    :", sys.version.split()[0])
print("prefix     :", sys.prefix)
print("base_prefix:", sys.base_prefix)
print("in a venv? :", sys.prefix != sys.base_prefix)
print("purelib    :", sysconfig.get_paths()["purelib"])   # where pip would install
print()
print("sys.path, in search order:")
for i, p in enumerate(sys.path):
    print(f"  {i}: {p or '(current directory)'}")`, note: 'This runs in Pyodide (Python compiled to WebAssembly), so the paths are virtual. Run the same lines inside your project’s venv and compare <code>prefix</code> with <code>base_prefix</code>.' },
      { label: 'Who provides this import?', code: `import importlib.util, sys

for name in ["json", "sys", "tomllib", "email.parser", "not_installed_pkg"]:
    spec = importlib.util.find_spec(name)
    if spec is None:
        print(f"{name:18} -> not found on sys.path (ModuleNotFoundError on import)")
    else:
        print(f"{name:18} -> {spec.origin}")

import json
print()
print("json cached in sys.modules:", "json" in sys.modules)
print("json.__file__:", json.__file__)`, note: '<code>built-in</code> means compiled into the interpreter. Everything else is a file found by walking <code>sys.path</code> in order: the first match wins.' },
      { label: 'Read a pyproject.toml', code: `import tomllib   # stdlib since 3.11 (read-only)

PYPROJECT = '''
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "orders-svc"
version = "1.4.0"
requires-python = ">=3.12"
dependencies = ["fastapi>=0.115", "httpx>=0.27,<0.29", "pydantic~=2.7"]

[project.optional-dependencies]
otel = ["opentelemetry-sdk>=1.25"]

[dependency-groups]
dev = ["pytest>=8", "ruff"]
'''

doc = tomllib.loads(PYPROJECT)
p = doc["project"]
print(p["name"], p["version"], "needs Python", p["requires-python"])
print("runtime deps:", p["dependencies"])
print("extras      :", list(p["optional-dependencies"]))   # pip install "orders-svc[otel]"
print("dev group   :", doc["dependency-groups"]["dev"])     # never shipped to users
print("backend     :", doc["build-system"]["build-backend"])`, note: 'Extras are part of the published package. Dependency groups (PEP 735) are local-only, for dev and CI.' },
      { label: 'Versions are not strings', code: `releases = ["1.9.2", "1.10.0", "1.2.0", "1.10.0rc1"]

print("as strings:", sorted(releases))        # wrong: "1.10" < "1.2"

def key(v):
    # tiny parser for N.N.N with an optional rcN suffix; real tools use packaging.version
    pre = None
    if "rc" in v:
        v, rc = v.split("rc")
        pre = int(rc)
    nums = tuple(int(x) for x in v.split("."))
    return nums + ((0, pre) if pre is not None else (1, 0))  # rc sorts before final

print("as versions:", sorted(releases, key=key))

def compatible(v, spec):
    # "~=2.7" means ">=2.7, ==2.*"   (PEP 440 compatible release)
    base = tuple(int(x) for x in spec.removeprefix("~=").split("."))
    have = key(v)[:len(base)]
    return have >= base and have[:-1] == base[:-1]

for v in ["2.6.4", "2.7.0", "2.11.3", "3.0.0"]:
    print(f"pydantic {v:7} satisfies ~=2.7 ?", compatible(v, "~=2.7"))`, note: 'Real tools use <code>packaging.version.Version</code>, which implements all of PEP 440 (epochs, post- and dev-releases).' },
      { label: 'Lockfile hashes', code: `import hashlib

wheel_bytes = b"pretend this is httpx-0.27.2-py3-none-any.whl"
locked = hashlib.sha256(wheel_bytes).hexdigest()
print("lockfile records: sha256:" + locked[:16] + "...")

# later, CI downloads the "same" file again
for label, data in [("identical file", wheel_bytes),
                    ("tampered/rebuilt file", wheel_bytes + b"!")]:
    ok = hashlib.sha256(data).hexdigest() == locked
    print(f"{label:22} -> {'install' if ok else 'REFUSE: hash mismatch'}")`, note: 'This is what <code>pip install --require-hashes -r requirements.txt</code> and <code>uv sync</code> do for every file: a changed artifact fails the build instead of running.' }
    ]
  },
  gotchas: [
    { trap: '<code>pip install</code> into the system Python', code: `$ pip install httpx
error: externally-managed-environment
× This environment is externally managed
$ sudo pip install --break-system-packages httpx   # please don't`, lang: 'bash', why: 'The OS (apt, dnf, Homebrew) owns that interpreter and its packages; its own tools depend on them. Since PEP 668 many distributions refuse, and <code>sudo pip</code> can break system tools.', fix: 'One venv per project (<code>python -m venv .venv</code> or <code>uv venv</code>). For CLI tools use <code>pipx install</code> or <code>uv tool install</code>, which give each tool its own venv.' },
    { trap: '<code>pip</code> and <code>python</code> are different interpreters', code: `$ pip install pydantic       # pip from /usr/local/bin (Python 3.11)
$ python app.py              # python from .venv (Python 3.12)
ModuleNotFoundError: No module named 'pydantic'`, lang: 'bash', why: 'Each <code>pip</code> script installs into the interpreter it belongs to. With several Pythons on <code>PATH</code>, <code>pip</code> and <code>python</code> can resolve to different ones.', fix: 'Always <code>python -m pip …</code> (or <code>uv pip</code> / <code>uv add</code>, which target the project venv). Check with <code>python -m pip --version</code>, which prints the interpreter path.' },
    { trap: 'Ranges in <code>pyproject.toml</code> are not a lock', code: `dependencies = ["httpx>=0.27"]   # Monday: 0.27.2. Next build: whatever is newest.`, lang: 'text', why: '<code>pip install .</code> re-resolves every time, including all transitive dependencies you never named. A new release on PyPI changes your build with no commit in your repo.', fix: 'Commit a lockfile (<code>uv.lock</code>, <code>poetry.lock</code>, or <code>pip-compile --generate-hashes</code> output) and install from it in CI and Docker: <code>uv sync --locked</code>, <code>poetry install</code> or <code>pip install --require-hashes -r requirements.txt</code>.' },
    { trap: 'Exact pins in a <i>library</i>', code: `# a shared internal library
dependencies = ["pydantic==2.7.1", "httpx==0.27.0"]`, lang: 'text', why: 'An application installs one version of each package. If your library demands <code>==2.7.1</code> and another needs <code>&gt;=2.8</code>, the resolver has no solution and every consumer is stuck.', fix: 'Libraries declare the widest range they really support (<code>pydantic&gt;=2.7,&lt;3</code>). Applications pin, through their lockfile. Same rule as a Maven library vs a Spring Boot app’s BOM.' },
    { trap: 'Copying or moving a venv', code: `# Dockerfile
RUN python -m venv /build/.venv && /build/.venv/bin/pip install .
...
COPY --from=build /build/.venv /app/.venv
# /app/.venv/bin/uvicorn: bad interpreter: /build/.venv/bin/python: no such file`, lang: 'docker', why: 'A venv stores absolute paths: in <code>pyvenv.cfg</code> and in the shebang line of every script in <code>bin/</code>. It is not relocatable, and it is tied to the base interpreter it was made from.', fix: 'Create the venv at the path it will run from (same path in the build and runtime stages, and the same base image). Never commit a venv; recreate it from the lockfile.' },
    { trap: '<code>uv sync</code> without <code>--locked</code> in CI', why: 'If <code>pyproject.toml</code> changed but nobody re-ran <code>uv lock</code>, a plain <code>uv sync</code> updates the lockfile on the fly, so CI tests versions that are not in the committed lock.', fix: 'Use <code>uv sync --locked</code> in CI: it fails if the lock is out of date. (<code>--frozen</code> installs the lock without checking it against <code>pyproject.toml</code>.)' },
    { trap: 'Tests pass only because the current directory is on <code>sys.path</code>', code: `orders_svc/__init__.py      # flat layout
tests/test_api.py           # "import orders_svc" works from the repo root
# ... but the built wheel forgot a subpackage, and prod fails to import it`, lang: 'text', why: 'In a flat layout, running from the repo root imports your source tree directly, so packaging mistakes (missing files, package data, a misnamed module) never show up in tests.', fix: 'Use the <code>src/</code> layout (<code>src/orders_svc/…</code>) and install the project into the venv (uv and Poetry do this by default). Tests then import the installed package.' }
  ],
  scenarios: [
    { title: 'Friday deploy: <code>unexpected keyword argument \'proxies\'</code>',
      symptom: 'A one-line config change was deployed. Every outbound call failed with <code>TypeError: Client.__init__() got an unexpected keyword argument \'proxies\'</code>, although the code using <code>httpx.Client(proxies=…)</code> had not changed in months.',
      diagnose: `# compare what is actually installed in the old and new images
docker run --rm orders:1.4.0 python -m pip freeze > old.txt
docker run --rm orders:1.4.1 python -m pip freeze > new.txt
diff old.txt new.txt
# < httpx==0.27.2
# > httpx==0.28.0`,
      lang: 'bash',
      cause: 'The Dockerfile ran <code>pip install .</code>, and <code>pyproject.toml</code> said <code>httpx&gt;=0.27</code>. httpx 0.28.0 had been released, and it removed the deprecated <code>proxies</code> argument. The rebuild resolved the range again and picked it up.',
      fix: 'Commit a lockfile and install from it, so the image gets exactly what passed CI. Cap ranges for 0.x libraries, where minor versions may break APIs. Upgrades become explicit PRs that run the tests.',
      fixCode: `# pyproject.toml
dependencies = ["httpx>=0.27,<0.28"]

# Dockerfile
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY src ./src
RUN uv sync --locked --no-dev --no-editable` },
    { title: 'Cron job: <code>ModuleNotFoundError</code>, but it works in my shell',
      symptom: 'A nightly export script failed every night with <code>No module named \'psycopg\'</code>. Run by hand over SSH, it worked.',
      diagnose: `# in the crontab, log which interpreter actually runs
* 2 * * * python3 -c "import sys; print(sys.executable, sys.prefix)" >> /tmp/which.log

# /usr/bin/python3 /usr          <- cron
# /opt/export/.venv/bin/python /opt/export/.venv   <- interactive shell`,
      lang: 'bash',
      cause: 'The interactive shell had activated the venv in <code>.bashrc</code>. Cron runs with a minimal <code>PATH</code> and no activation, so <code>python3</code> was the system interpreter, whose <code>site-packages</code> lacked the dependency.',
      fix: 'Activation only edits <code>PATH</code>. Call the venv’s interpreter (or its console script) by absolute path; that is all you need.',
      fixCode: `2 * * * * /opt/export/.venv/bin/python -m export_job --since yesterday
# or the entry point installed by [project.scripts]:
2 * * * * /opt/export/.venv/bin/export-job --since yesterday` },
    { title: 'Image build fails only in CI: “Failed to build wheel for …”',
      symptom: 'The team moved its base image to Alpine to save space. Builds started taking 15 minutes and then failing while compiling a dependency from source.',
      diagnose: `$ pip install -v orders-svc
...
Collecting orjson
  Downloading orjson-3.10.7.tar.gz     # an sdist, not a wheel
  Building wheel for orjson (pyproject.toml) ... error`,
      lang: 'bash',
      cause: 'Most compiled packages publish <code>manylinux</code> wheels (built against glibc). Alpine uses musl, so pip needs <code>musllinux</code> wheels. When a package or version doesn’t ship one, pip falls back to the sdist and needs a compiler toolchain (here, Rust).',
      fix: 'Use a glibc base image such as <code>python:3.12-slim</code> unless you have a strong reason not to. Add <code>--only-binary :all:</code> (pip) or <code>--no-build</code> (uv) in CI so a missing wheel fails fast instead of compiling.',
      fixCode: `FROM python:3.12-slim
RUN pip install --only-binary :all: --require-hashes -r requirements.lock` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `print("3.10" > "3.9", (3, 10) > (3, 9))`, options: ['True True', 'False True', 'True False', 'False False'], answer: 1, run: true, expect: 'False True', explain: 'Strings compare character by character: <code>"1"</code> &lt; <code>"9"</code>, so <code>"3.10"</code> is “smaller”. Tuples of ints compare numerically. This is why scripts that check <code>sys.version &gt;= "3.10"</code> break, and why you should compare <code>sys.version_info &gt;= (3, 10)</code>.' },
    { kind: 'predict', q: 'A naive “latest release” script. What does it print?', code: `releases = ["1.9.2", "1.10.0", "1.2.0"]
print(sorted(releases)[-1])`, options: ['1.10.0', '1.9.2', '1.2.0', 'TypeError'], answer: 1, run: true, expect: '1.9.2', explain: 'Lexicographic sort gives <code>[\'1.10.0\', \'1.2.0\', \'1.9.2\']</code>, so the “latest” is 1.9.2. Parse versions with <code>packaging.version.Version</code>, which implements PEP 440 ordering.' },
    { kind: 'predict', q: 'Which installed versions satisfy <code>pydantic~=2.7</code>?', options: ['Only 2.7.x', 'Any 2.x from 2.7 up, but not 3.0', 'Anything ≥ 2.7, including 3.0', 'Exactly 2.7.0'], answer: 1, explain: '<code>~=</code> is the PEP 440 “compatible release” operator. It drops the last component of the version you give: <code>~=2.7</code> means <code>&gt;=2.7, ==2.*</code>. To allow only patch releases, give three parts: <code>~=2.7.1</code> means <code>&gt;=2.7.1, ==2.7.*</code>.' },
    { kind: 'predict', q: 'What does this print?', code: `import tomllib

doc = tomllib.loads('''
[project]
name = "svc"
dependencies = ["httpx>=0.27", "pydantic~=2.7"]

[project.optional-dependencies]
otel = ["opentelemetry-sdk"]
test = ["pytest"]
''')
print(len(doc["project"]["dependencies"]), sorted(doc["project"]["optional-dependencies"]))`, options: ["2 ['otel', 'test']", "4 ['otel', 'test']", "2 []", 'KeyError'], answer: 0, run: true, expect: "2 ['otel', 'test']", explain: '<code>[project.optional-dependencies]</code> is a sub-table of <code>[project]</code>, so it appears as a nested dict. Extras are installed with <code>pip install "svc[otel]"</code>; plain <code>pip install svc</code> only gets the two runtime dependencies.' },
    { kind: 'concept', q: 'You changed <code>pyproject.toml</code> but forgot to run <code>uv lock</code>. What does <code>uv sync --locked</code> do in CI?', options: ['Silently updates uv.lock and installs', 'Fails, because the lockfile is out of date', 'Ignores pyproject.toml and installs the old lock', 'Installs only the new dependency'], answer: 1, explain: '<code>--locked</code> asserts the lockfile matches the project and errors if it would change. Plain <code>uv sync</code> would update the lock (the drift this flag exists to catch). <code>--frozen</code> installs the lock as-is without checking it, which is option C.' },
    { kind: 'concept', q: 'Inside a venv made without <code>--system-site-packages</code>, which of these is <b>not</b> on <code>sys.path</code>?', options: ['The standard library (<code>/usr/lib/python3.12</code>)', 'The venv’s own <code>site-packages</code>', 'The base interpreter’s global <code>site-packages</code>', 'The script’s directory'], answer: 2, explain: 'A venv reuses the base interpreter’s standard library (via <code>home</code> in <code>pyvenv.cfg</code>) but replaces the global <code>site-packages</code> with its own. That isolation is the whole point. <code>--system-site-packages</code> adds the global one back, after the venv’s.' },
    { kind: 'concept', q: 'Why does <code>source .venv/bin/activate</code> not matter to a Dockerfile or cron job?', options: ['Activation installs the packages', 'Activation only prepends <code>.venv/bin</code> to <code>PATH</code> (and sets <code>VIRTUAL_ENV</code>); running <code>.venv/bin/python</code> directly gives the same environment', 'Docker can’t run shell scripts', 'Activation is required for imports to work'], answer: 1, explain: 'The interpreter finds its environment from its own location: on startup it looks for <code>pyvenv.cfg</code> next to (or one level above) the executable and sets <code>sys.prefix</code>. So <code>/app/.venv/bin/python</code> “is” the venv. In Docker, set <code>ENV PATH="/app/.venv/bin:$PATH"</code>.' },
    { kind: 'concept', q: 'You maintain an internal SDK used by six services. How should it declare <code>pydantic</code>?', options: ['<code>pydantic==2.9.2</code>, so everyone is consistent', '<code>pydantic&gt;=2.7,&lt;3</code>, and each service’s lockfile pins the exact version', 'No dependency; let services install it', '<code>pydantic</code> with no version'], answer: 1, explain: 'A library states compatibility; the application decides the exact version. An exact pin in a library makes conflicts unsolvable as soon as two libraries disagree. An upper bound on the next major version is reasonable for a package that follows semver, like Pydantic.' }
  ],
  interview: [
    { q: 'What is a virtual environment, mechanically?', a: '<p>A directory with a <code>pyvenv.cfg</code> file (containing <code>home = …</code>, pointing at the base interpreter’s directory), a <code>bin/</code> (or <code>Scripts\\</code>) with a <code>python</code> link or copy, and its own <code>lib/python3.X/site-packages</code>. At startup, <code>site.py</code> finds <code>pyvenv.cfg</code> next to the executable, sets <code>sys.prefix</code> to the venv and puts its <code>site-packages</code> on <code>sys.path</code> instead of the global one. The standard library still comes from the base install. Activation only edits <code>PATH</code>.</p>', fu: 'How can code detect it is running in a venv? (<code>sys.prefix != sys.base_prefix</code>.)', lvl: 'core' },
    { q: 'pip vs pip-tools vs Poetry vs uv: when would you pick which?', a: '<ul><li><b>pip</b>: the installer. It resolves, but its only lock is a hand-made or <code>pip freeze</code> requirements file (pip 25.1 added an experimental <code>pip lock</code>).</li><li><b>pip-tools</b>: <code>pip-compile</code> turns loose inputs into a fully pinned, hashed <code>requirements.txt</code>; <code>pip-sync</code> makes a venv match it exactly.</li><li><b>Poetry</b>: an all-in-one project manager with <code>poetry.lock</code>, dependency groups and publishing. Poetry 2 reads the standard <code>[project]</code> table.</li><li><b>uv</b> (Astral, written in Rust): a very fast resolver/installer that also manages Python versions (<code>uv python install</code>), venvs, a cross-platform <code>uv.lock</code>, scripts and tools. It offers a pip-compatible interface (<code>uv pip</code>) too.</li></ul><p>For a new service, uv with a committed <code>uv.lock</code> is a strong default. In an existing Poetry codebase, keep Poetry unless there is a reason to move.</p>', lvl: 'core' },
    { q: 'What goes in <code>pyproject.toml</code>?', a: '<p><code>[build-system]</code> (PEP 517/518): which backend builds the wheel (hatchling, setuptools, flit-core, poetry-core…). <code>[project]</code> (PEP 621): name, version, <code>requires-python</code>, <code>dependencies</code>, <code>optional-dependencies</code> (extras), <code>scripts</code> (console entry points). <code>[dependency-groups]</code> (PEP 735): dev/test groups that are never published. <code>[tool.*]</code>: config for ruff, pytest, mypy, coverage, uv. It replaces <code>setup.py</code>, <code>setup.cfg</code> and most dotfiles.</p>', lvl: 'core' },
    { q: 'Why is <code>pip freeze &gt; requirements.txt</code> a weak lockfile?', a: '<p>It records whatever happens to be in your venv (including stray packages you installed by hand), has no hashes, doesn’t separate direct from transitive dependencies, and is specific to your platform and Python version. A real lock is produced by a resolver from declared inputs, includes hashes, and (for <code>uv.lock</code> or <code>poetry.lock</code>) covers several platforms with environment markers.</p>', lvl: 'core' },
    { q: 'How does a reproducible Python Docker build look?', a: '<p>Pin the base image (<code>python:3.12-slim</code>, ideally by digest). Copy only <code>pyproject.toml</code> and the lockfile first and install dependencies (<code>uv sync --locked --no-dev --no-install-project</code>), so that layer is cached until the lock changes. Then copy the source and install the project. Use a multi-stage build and copy the venv to the <b>same path</b> in the runtime stage. Run as a non-root user, and put <code>.venv/bin</code> on <code>PATH</code>.</p>', lvl: 'core' },
    { q: 'What is the difference between a wheel and an sdist, and why does it matter for ops?', a: '<p>A wheel is a pre-built archive tagged for a Python version, ABI and platform (<code>cp312-cp312-manylinux_2_17_x86_64</code>); installing it is just unpacking. An sdist is source and runs a build backend at install time, which may need compilers and headers and can run arbitrary code. Prefer wheel-only installs in CI (<code>--only-binary :all:</code>) and choose base images that have wheels available (glibc rather than musl).</p>', lvl: 'deep' },
    { q: 'How does the resolver handle a conflict, and how do you debug one?', a: '<p>pip (since 20.3) and uv use backtracking resolvers: they try the newest candidates, and when constraints conflict they back off to older versions until everything fits or no solution exists. To debug, read the error’s chain (“A needs X&lt;2, B needs X&gt;=2”), check <code>uv tree</code> / <code>pipdeptree</code> for who requires what, and loosen the over-tight pin. uv can also apply <code>override-dependencies</code> to force a version when an upstream bound is wrong.</p>', lvl: 'deep' },
    { q: 'What is an editable install?', a: '<p><code>pip install -e .</code> (PEP 660) installs your project so that <code>site-packages</code> points at your source tree (through a <code>.pth</code> file or an import hook) instead of a copy. Code edits take effect without reinstalling. Changes to metadata, such as new dependencies or entry points, still need a reinstall. uv installs the project editable by default in <code>uv sync</code>; use <code>--no-editable</code> for images.</p>', lvl: 'core' },
    { q: 'Is there a standard lockfile format?', a: '<p>Yes, since PEP 751 (accepted in 2025), which defines <code>pylock.toml</code>. Tool support is still arriving: uv can export it, and pip has experimental support. In practice teams still commit the tool’s native lock (<code>uv.lock</code>, <code>poetry.lock</code>) or a hashed <code>requirements.txt</code>.</p>', lvl: 'deep' },
    { q: 'How would you explain Python packaging to a Maven user?', a: '<p><code>pyproject.toml</code> ≈ <code>pom.xml</code>; PyPI ≈ Maven Central; a wheel ≈ a jar. Big differences: Python has <b>no per-application classpath</b>, only one <code>site-packages</code> per environment, so the venv plays the role of the classpath. There is <b>one version per package per environment</b> (no shading by default). And Maven’s “nearest wins” mediation doesn’t exist: the resolver must find versions that satisfy <i>every</i> constraint, or fail.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'pyproject.toml', lang: 'text', code: `[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "orders-svc"
version = "1.4.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "httpx>=0.27,<0.28",          # 0.x: minor releases may break APIs
  "pydantic>=2.7,<3",
  "uvicorn[standard]>=0.30",
]

[project.optional-dependencies]
otel = ["opentelemetry-sdk>=1.25"]

[project.scripts]
orders-admin = "orders_svc.cli:main"   # creates .venv/bin/orders-admin

[dependency-groups]
dev = ["pytest>=8", "pytest-cov>=5", "ruff>=0.6", "mypy>=1.11"]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra --strict-markers"

[tool.ruff]
line-length = 100`, note: 'Lives next to <code>src/orders_svc/</code> and <code>uv.lock</code>. Commit the lock; never commit <code>.venv</code>.' },
    { title: 'Dockerfile with uv', lang: 'docker', code: `FROM python:3.12-slim AS build
# pin an exact uv version in real builds
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

# 1) dependencies only: this layer is cached until uv.lock changes
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

# 2) the project itself, installed (not editable) into the same venv
COPY src ./src
RUN uv sync --locked --no-dev --no-editable

FROM python:3.12-slim
RUN useradd --create-home app
WORKDIR /app
# same path in both stages: a venv is not relocatable
COPY --from=build /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"
USER app
CMD ["uvicorn", "orders_svc.main:app", "--host", "0.0.0.0", "--port", "8000"]`, note: 'The runtime image has no uv, no compiler and no source tree: just the interpreter and a venv.' },
    { title: 'Daily commands', lang: 'bash', code: `uv init --package orders-svc     # new project with src/ layout
uv python install 3.13           # uv can download interpreters
uv add "httpx>=0.27,<0.28"       # edit pyproject + lock + install
uv add --dev pytest              # into [dependency-groups].dev
uv lock --upgrade-package httpx  # deliberate upgrade -> review the diff
uv sync --locked                 # CI: fail if the lock is stale
uv run pytest -q                 # run inside the project venv
uv tree                          # who depends on what

# plain pip equivalent
python -m venv .venv && . .venv/bin/activate
python -m pip install -e ".[otel]"
pip-compile --generate-hashes -o requirements.lock pyproject.toml   # pip-tools
python -m pip install --require-hashes -r requirements.lock` },
    { title: 'Maven ↔ Python map', lang: 'text', code: `Maven / Gradle                      Python
---------------------------------   -----------------------------------------
pom.xml / build.gradle              pyproject.toml ([project], [build-system])
Maven Central                       PyPI
jar                                 wheel (.whl); sdist = source tarball
~/.m2 + per-build classpath         one venv per project (its site-packages)
<dependencyManagement> / BOM        lockfile (uv.lock, poetry.lock)
nearest-wins mediation              resolver must satisfy ALL constraints or fail
<scope>test</scope>                 [dependency-groups] dev / test
classifiers, profiles               extras: pip install "pkg[otel]"
mvn package / deploy                uv build / uv publish (or python -m build + twine)
SDKMAN / toolchains                 uv python install, pyenv
exec-maven-plugin / Boot jar        [project.scripts] console entry points`, note: 'The concept that has no Java twin: one version of each package per environment. Two incompatible versions of the same library cannot coexist in one venv.' }
  ]
});
