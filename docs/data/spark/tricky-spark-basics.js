IA.register({
  track: 'spark',
  slug: 'tricky-spark-basics',
  title: 'Basics drill (timed)',
  tagline: "Thirty beginner concept questions from the 5 Spark Basics topics, against the clock: what Spark is for, driver vs executors, lazy RDDs, DataFrame basics and getting PySpark running.",
  tldr: {
    problem: "First Spark interviews check that you have the mental model: where code runs, when work actually happens, and why you do not loop over rows.",
    model: "Most beginner questions are one of four things: <b>where it runs</b> (driver plans, executors do the work), <b>when it runs</b> (transformations are lazy; actions start jobs), <b>immutability</b> (every transformation returns a new DataFrame or RDD), and <b>right tool</b> (Spark is for data that does not fit one machine).",
    hook: "<code>rdd.map(f)</code> with a broken <code>f</code> does not fail. If you can say why in one sentence, start the drill.",
    facts: [{"v":"30","l":"concept questions across the 5 Basics topics, 6 per topic"},{"v":"60 s","l":"per question by default. Slow (90 s) and Fast (30 s) modes too"},{"v":"Spark 3.5/4.x","l":"is the baseline; version-specific facts (such as Java requirements) are called out"}]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short snippet or question, a timer and four answers. Answer in your head, as you would in a first interview, then read the explanation. At the end you see your score per topic and a review of every miss, each with a link back to the Basics page that teaches it.',
    analogy: { icon: '⏱️', title: 'Flashcards with a stopwatch', text: "Reading about laziness is not the same as spotting, in five seconds, that nothing has run yet. Speed comes from having seen the question before." },
    steps: [{"t":"Ask “driver or executor?”","d":"Top-level code and collect() results live on the driver; functions you pass to Spark run on executors."},{"t":"Ask “has anything run yet?”","d":"Transformations build a plan; only actions such as count, show, collect or write start a job."},{"t":"Ask “was the result kept?”","d":"DataFrames are immutable: assign the result of withColumn or filter."},{"t":"Ask “is Spark the right tool?”","d":"Small data fits on one machine; Spark pays off when it does not."}],
    terms: [["driver","The process that runs your program and plans the job."],["executor","A worker process that runs tasks and caches data."],["transformation","A lazy operation that returns a new RDD or DataFrame."],["action","An operation that returns a result or writes output, and starts a job."],["lineage","The recorded chain of transformations used to recompute data."]]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a topic (or All), 10, 20 or all 30 questions, and the time per question, then press Start. Skip counts as a miss. At the end, your misses are listed with explanations and links to the topic pages.'
  },
  gotchas: [{"trap":"Mixing up driver and executor","why":"Many “why does this fail?” questions hinge on code running somewhere other than where you think.","fix":"For each line, say where it runs before answering."},{"trap":"Forgetting laziness","why":"Errors, timings and file reads happen at the action, not at the transformation.","fix":"Find the first action; that is where work starts."},{"trap":"Answering with version-free facts","why":"Spark 4 changed requirements (Java 17+) and defaults (ANSI mode).","fix":"Say which version you mean when it matters."}],
  interview: [{"q":"How do you explain Spark in one minute?","a":"<p>A distributed compute engine: the driver turns your DataFrame or SQL code into a plan of stages and tasks, and executors run those tasks in parallel on partitions of the data, reading from and writing to external storage.</p>","lvl":"core"},{"q":"What is the difference between a transformation and an action?","a":"<p>A transformation (<code>select</code>, <code>filter</code>, <code>map</code>) is lazy and returns a new dataset. An action (<code>count</code>, <code>collect</code>, <code>show</code>, a write) triggers a job that executes the plan.</p>","lvl":"core"},{"q":"How do you try something quickly?","a":"<p>Run PySpark in local mode (<code>master(\"local[*]\")</code>) on a small sample, or use a Databricks notebook where <code>spark</code> already exists.</p>","lvl":"core"}]
});
