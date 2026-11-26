IA.register({
  track: 'spark',
  slug: 'pyspark-setup',
  title: 'Setting up PySpark',
  tagline: '<code>pip install pyspark</code> gives you all of Spark for one machine, <b>except Java</b>. Get the Java version right, pin the Spark version, and the same code later runs on a cluster or Databricks.',
  tldr: {
    problem: 'First contact usually fails on the environment, not the code: “Java gateway process exited before sending its port number”, a Python version PySpark doesn’t support, or a notebook using a different Python from the one you installed into.',
    model: 'PySpark = a Python library that launches and talks to a <b>JVM</b> (via Py4J). Locally, <code>master("local[*]")</code> runs driver and executors in that one JVM, one task thread per core. On Databricks or another platform, the cluster and <code>spark</code> already exist.',
    hook: '“Do I need Hadoop to run Spark?” No. Locally you need Java and the pyspark package. Hadoop libraries are bundled for file-system access; a cluster can use YARN, Kubernetes or Spark Standalone.',
    facts: [
      { v: 'Java 17/21', l: 'required by Spark 4.x. Spark 3.5 supports Java 8, 11 and 17' },
      { v: 'Python 3.9+', l: 'minimum for PySpark 4.0 (3.5 accepted 3.8+). Check the release docs for the newest supported Python' },
      { v: 'local[*]', l: 'run locally with one worker thread per logical core; <code>local[4]</code> = 4 threads' }
    ]
  },
  intro: {
    what: 'To try Spark on your own computer you need three things: Python, Java, and the <code>pyspark</code> package. PySpark is a Python wrapper around Spark’s real engine, which is written in Scala and runs on the Java Virtual Machine (JVM). Your Python code describes the work; the JVM does it.',
    analogy: { icon: '🎮', title: 'A game controller', text: 'Python is the controller in your hand; the JVM is the console doing the real work. Without the console (Java), pressing buttons does nothing; you get the “Java gateway” error.' },
    steps: [
      { t: 'Install Java', d: 'Spark 4.x: JDK 17 or 21. Point <code>JAVA_HOME</code> at it. You likely already have one from Spring work; check the version.', code: 'java -version\n# macOS (Homebrew):  brew install openjdk@17\n# Ubuntu:            sudo apt install openjdk-17-jdk-headless\nexport JAVA_HOME=$(/usr/libexec/java_home -v 17)   # macOS example', lang: 'bash' },
      { t: 'Create a virtual environment', d: 'Like a per-project Maven repo for Python: packages go in <code>.venv</code>, not system-wide.', code: 'python3 -m venv .venv\nsource .venv/bin/activate        # Windows: .venv\\Scripts\\activate\npip install "pyspark[sql]==4.0.1"   # [sql] adds pandas + pyarrow', lang: 'bash' },
      { t: 'Hello, Spark', d: 'Create a session and run something.', code: 'from pyspark.sql import SparkSession\nspark = SparkSession.builder.master("local[*]").appName("hello").getOrCreate()\nspark.range(5).show()\nprint(spark.version)' },
      { t: 'Open the UI', d: 'While the session is alive, visit <code>http://localhost:4040</code> to see jobs, stages and the SQL plan.' },
      { t: 'Notebooks and Databricks', d: 'In Jupyter, install the kernel in the same venv. In Databricks the <code>spark</code> variable is predefined: don’t build your own session or set <code>master</code>.' }
    ],
    terms: [
      ['JVM', 'Java Virtual Machine: where Spark’s engine runs, even when you write Python.'],
      ['Py4J', 'The bridge library PySpark uses to call JVM objects from Python.'],
      ['venv', 'An isolated Python environment for one project, like a project-local dependency folder.'],
      ['local mode', '<code>local[*]</code>: everything in one JVM on your machine. Same API as a cluster.'],
      ['spark-submit', 'The CLI that launches Spark applications (pip installs it too).'],
      ['Databricks Runtime', 'A managed Spark distribution; its version decides your Spark and Python versions.']
    ]
  },
  visual: {
    title: 'What actually starts on your laptop',
    caption: 'Step through the local setup to see the Python process, the Py4J bridge, the driver JVM and its task threads. The second scene shows the notebook / Databricks case where the session already exists.'
  },
  gotchas: [
    { trap: '“Java gateway process exited before sending its port number”', code: `$ python app.py
pyspark.errors.exceptions.base.PySparkRuntimeError: [JAVA_GATEWAY_EXITED] Java gateway process exited before sending its port number.`, lang: 'text', why: 'PySpark couldn’t start the JVM: Java missing, <code>JAVA_HOME</code> pointing at a removed JDK, or a Java version this Spark doesn’t support (e.g. Java 11 with Spark 4).', fix: 'Install a supported JDK, set <code>JAVA_HOME</code>, and check <code>java -version</code> in the same shell or notebook kernel that runs Python.' },
    { trap: 'Notebook uses a different Python than your venv', code: `import sys; print(sys.executable)   # /usr/bin/python3 ?!`, why: 'Jupyter kernels are tied to an interpreter. <code>pip install</code> went into one environment; the notebook runs another, so <code>import pyspark</code> fails or picks an old version.', fix: 'Install a kernel from the venv: <code>pip install ipykernel &amp;&amp; python -m ipykernel install --user --name myproj</code>, then pick it in the notebook.' },
    { trap: 'Setting driver memory in the builder too late', code: `spark = (SparkSession.builder
         .config("spark.driver.memory", "8g")   # ignored if a JVM is already running
         .getOrCreate())`, why: 'Driver memory is the JVM heap. Once the JVM has started (e.g. a session already exists in the notebook) it can’t be changed.', fix: 'Set it before the first session in a fresh process, or with <code>spark-submit --driver-memory 8g</code> / <code>PYSPARK_SUBMIT_ARGS</code>. Default is 1g, which is small for local experiments.' },
    { trap: 'Mismatched Python on driver and executors', why: 'On a cluster, executors run Python workers too. If they use a different Python minor version, PySpark fails with a version-mismatch error.', fix: 'Set <code>PYSPARK_PYTHON</code> to the same interpreter everywhere (or use the platform’s managed environment / container image).' },
    { trap: 'Unpinned pyspark version', why: 'A fresh <code>pip install pyspark</code> may pull a new major version (3.5 → 4.x) with ANSI mode on, Java 17+ and removed APIs, while your cluster runs another version.', fix: 'Pin to the cluster’s version in <code>requirements.txt</code> / <code>pyproject.toml</code>, e.g. <code>pyspark==3.5.*</code> for a 3.5 cluster.' },
    { trap: 'Creating your own SparkSession on Databricks', why: 'The notebook already has <code>spark</code>; setting <code>master</code> or cluster configs from code is ignored or conflicts with the cluster’s settings.', fix: 'Use the predefined <code>spark</code>. In shared library code, call <code>SparkSession.getActiveSession()</code> or <code>builder.getOrCreate()</code> without a master.' },
    { trap: 'Windows: winutils / HADOOP_HOME errors when writing files', why: 'Hadoop’s local file system code on Windows needs native helpers (<code>winutils.exe</code>, <code>hadoop.dll</code>).', fix: 'Easiest: use WSL2 or a Docker image. Otherwise install the helpers matching the bundled Hadoop version and set <code>HADOOP_HOME</code>.' }
  ],
  scenarios: [
    { title: 'Works on my machine, fails in CI', symptom: 'Unit tests using a local SparkSession pass on laptops but fail in CI with <code>JAVA_GATEWAY_EXITED</code>.', diagnose: 'CI image: python:3.12-slim  (no JDK)\nlocal: Temurin 17 via sdkman', cause: 'The slim Python image has no Java, so PySpark can’t start its JVM.', fix: 'Use an image with a JDK, or install one in the CI step, and pin pyspark.', fixCode: `# .github/workflows/test.yml (excerpt)
- uses: actions/setup-java@v4
  with: { distribution: temurin, java-version: '17' }
- uses: actions/setup-python@v5
  with: { python-version: '3.12' }
- run: pip install "pyspark==4.0.1" pytest && pytest -q`, lang: 'yaml' },
    { title: 'Local job grinds and dies with heap errors', symptom: 'Exploring a 6 GB Parquet sample in a notebook, <code>toPandas()</code> or a big join fails with <code>OutOfMemoryError: Java heap space</code>, even though the laptop has 32 GB.', diagnose: 'spark.sparkContext.getConf().get("spark.driver.memory")   # None → default 1g\nSpark UI → Executors: "driver" storage memory ~430 MB', cause: 'In local mode the driver JVM is also the executor, and it got the default 1 GB heap.', fix: 'Start a fresh kernel and give the JVM more memory before the first session.', fixCode: `spark = (SparkSession.builder.master("local[*]")
         .config("spark.driver.memory", "12g")      # works in a FRESH process
         .config("spark.sql.shuffle.partitions", "16")
         .getOrCreate())` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which Java version can run Spark 4.0?', options: ['Java 8', 'Java 11', 'Java 17', 'Any Java'], answer: 2, explain: 'Spark 4.0 requires Java 17 or 21. Java 8 and 11 support was dropped (3.5 still supported 8/11/17).' },
    { kind: 'concept', q: 'What does <code>pip install pyspark</code> NOT include?', options: ['The Spark jars', 'spark-submit', 'A Java runtime', 'The Python API'], answer: 2, explain: 'The package bundles Spark’s jars and scripts but expects a JDK on the machine.' },
    { kind: 'concept', q: 'What does <code>master("local[*]")</code> mean?', options: ['Connect to a cluster named local', 'Run locally with as many worker threads as logical cores', 'Run with one thread', 'Use all machines on the network'], answer: 1, explain: '<code>local</code> = 1 thread, <code>local[4]</code> = 4 threads, <code>local[*]</code> = one per logical core. All inside one JVM.' },
    { kind: 'concept', q: 'You get “Java gateway process exited before sending its port number”. Most likely cause?', options: ['A typo in your DataFrame code', 'PySpark couldn’t start the JVM: Java is missing, JAVA_HOME is wrong or the Java version is unsupported', 'The cluster is full', 'Parquet file is corrupt'], answer: 1, explain: 'The error happens before any of your Spark code runs: the Python side waited for a JVM that never started.' },
    { kind: 'concept', q: 'In a Databricks notebook, how should you get a SparkSession?', options: ['SparkSession.builder.master("local[*]").getOrCreate()', 'Use the predefined <code>spark</code> variable', 'pip install pyspark in the notebook first', 'Start a JVM manually'], answer: 1, explain: 'The runtime creates <code>spark</code> for you, connected to the attached cluster. Setting a master would be wrong there.' },
    { kind: 'concept', q: 'Why might <code>.config("spark.driver.memory", "8g")</code> have no effect in a notebook?', options: ['The key is misspelled', 'A JVM (session) was already running; heap size is fixed at JVM start', 'Driver memory can only be 1g', 'It only works on Windows'], answer: 1, explain: 'JVM heap is set at launch. Restart the kernel and set it before the first <code>getOrCreate()</code>, or pass it to spark-submit.' }
  ],
  interview: [
    { q: 'What do you need to run PySpark locally?', a: '<p>A supported JDK (17/21 for Spark 4.x), a supported Python, and <code>pip install pyspark</code> (pinned). Then <code>SparkSession.builder.master("local[*]").getOrCreate()</code>. No Hadoop installation or cluster is needed.</p>', lvl: 'core' },
    { q: 'How does PySpark communicate with Spark?', a: '<p>Classic mode: the Python driver starts a JVM and controls it through <b>Py4J</b> (a socket-based bridge). DataFrame calls become JVM method calls building the plan. Spark Connect mode (3.4+): the Python client sends protobuf plans over gRPC to a remote server, with no local JVM.</p>', lvl: 'core' },
    { q: 'What are the pyspark package extras?', a: '<p><code>pyspark[sql]</code> adds pandas and pyarrow (for <code>toPandas</code>, pandas UDFs), <code>pyspark[pandas_on_spark]</code> for the pandas API on Spark, <code>pyspark[connect]</code> for Spark Connect client deps. Spark 4.0 also publishes a slim, pure-Python <code>pyspark-client</code> for Connect-only use.</p>', lvl: 'deep' },
    { q: 'How do you write unit tests for PySpark code?', a: '<p>A session-scoped pytest fixture creating a <code>local[2]</code> session with few shuffle partitions; small DataFrames built with <code>createDataFrame</code>; compare results with <code>pyspark.testing.assertDataFrameEqual</code> (3.5+). Keep transformations as functions <code>DataFrame -&gt; DataFrame</code> so they’re testable.</p>', fu: 'How do you make tests fast? One shared session, <code>spark.sql.shuffle.partitions=2</code>, disable the UI (<code>spark.ui.enabled=false</code>).', lvl: 'core' },
    { q: 'Local mode vs cluster: what does not translate?', a: '<ul><li>Everything shares one JVM, so driver/executor memory limits look different.</li><li>No real network shuffle, so data skew and shuffle costs are hidden.</li><li>Local file paths work locally but not on a cluster; use shared storage (S3/ADLS/HDFS).</li><li>Python dependencies must also be present on cluster executors.</li></ul>', lvl: 'deep' },
    { q: 'How do you ship Python dependencies to a cluster?', a: '<p>Options: bake them into the container image (Kubernetes), use a packed venv/conda archive via <code>--archives</code> and <code>PYSPARK_PYTHON</code>, <code>--py-files</code> for zipped pure-Python modules, or the platform’s mechanism (Databricks cluster libraries / <code>%pip</code>).</p>', lvl: 'deep' },
    { q: 'What decides the Spark version on Databricks?', a: '<p>The Databricks Runtime (DBR) chosen for the cluster or job; each DBR maps to a Spark version, Python version and library set. Databricks also adds proprietary features (Photon engine, Unity Catalog), so not every behaviour matches open-source Spark exactly.</p>', lvl: 'core' },
    { q: 'How do you run Spark in Docker for local development?', a: '<p>Use an image with a JDK and Python (e.g. the official <code>apache/spark</code> or <code>spark:…-python3</code> images), mount your code and data, and run <code>spark-submit</code> or Jupyter inside. It avoids Java/winutils issues on laptops and matches Kubernetes deployments.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'pyproject + pytest fixture', lang: 'python', code: `# pyproject.toml
# [project]
# dependencies = ["pyspark[sql]==4.0.1"]   # match your cluster's version

# conftest.py
import pytest
from pyspark.sql import SparkSession

@pytest.fixture(scope="session")
def spark():
    s = (SparkSession.builder.master("local[2]")
         .appName("tests")
         .config("spark.sql.shuffle.partitions", "2")
         .config("spark.ui.enabled", "false")
         .getOrCreate())
    yield s
    s.stop()

# test_orders.py
from pyspark.testing import assertDataFrameEqual   # 3.5+
def test_big_orders(spark):
    df = spark.createDataFrame([(1, 50.0), (2, 150.0)], "id INT, amount DOUBLE")
    assertDataFrameEqual(df.filter("amount > 100"),
                         spark.createDataFrame([(2, 150.0)], "id INT, amount DOUBLE"))` },
    { title: 'spark-submit a local script', lang: 'bash', code: `# pip puts spark-submit on PATH inside the venv
spark-submit --master "local[*]" --driver-memory 8g \\
  --conf spark.sql.shuffle.partitions=16 \\
  jobs/daily_orders.py --date 2026-11-25` },
    { title: 'Spark Connect client (3.4+)', lang: 'python', code: `# pip install "pyspark[connect]==4.0.1"   (or the slim "pyspark-client" in 4.x)
from pyspark.sql import SparkSession
spark = SparkSession.builder.remote("sc://localhost:15002").getOrCreate()
spark.range(10).selectExpr("sum(id)").show()

# server side (from a Spark distribution):
#   ./sbin/start-connect-server.sh` },
    { title: 'Java/Maven equivalent', lang: 'java', code: `// pom.xml: org.apache.spark:spark-sql_2.13:4.0.1 (scope "provided" when deploying to a cluster)
SparkSession spark = SparkSession.builder()
    .master("local[*]")
    .appName("hello")
    .getOrCreate();
spark.range(5).show();`, note: 'Java on JDK 17+ may need <code>--add-opens</code> JVM flags in some setups; <code>spark-submit</code> adds the needed ones for you.' }
  ]
});
