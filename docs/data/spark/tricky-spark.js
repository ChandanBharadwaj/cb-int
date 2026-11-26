IA.register({
  track: 'spark',
  slug: 'tricky-spark',
  title: '★ Tricky Spark (timed)',
  tagline: 'Forty “what happens / why is it slow / which config” questions from all 18 Spark topics, against the clock. Each one is a trap that shows up in senior interviews or in production. Every miss links back to the page that explains it.',
  tldr: {
    problem: 'Spark interviews rarely ask you to write a job from scratch. They show a snippet or a symptom (“one task runs for an hour”, “the container was killed”) and ask what is going on.',
    model: 'Most tricks are one of five things: <b>laziness</b> (nothing runs until an action), <b>driver vs executor</b> (where code and data live), <b>shuffles</b> (wide operations, skew, partition counts), <b>memory layout</b> (heap vs overhead, spill) and <b>state and versions</b> (watermarks, checkpoints, the Delta log).',
    hook: '<code>df.cache(); df.show()</code> — how much of df is cached now? If you can answer in one sentence, start the drill.',
    facts: [
      { v: '40', l: 'concept questions across all 18 Spark topics, from basics to Delta and streaming' },
      { v: '60 s', l: 'per question by default. Slow (90 s) and Fast (30 s) modes too' },
      { v: '3.5 / 4.0', l: 'answers assume Spark 3.5+ defaults; where 4.0 differs (ANSI mode, Java 17), the question says so' }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short question or snippet, a timer and four answers (shuffled each time). Answer in your head, as in an interview, then read the explanation. At the end you get your score per topic and a review of every miss, each with a link to its topic page.',
    analogy: { icon: '⏱️', title: 'Flashcards with a clock', text: 'Reading about shuffles is not the same as spotting one in a snippet under pressure. Each card is a small “position” where the obvious Java-or-Postgres intuition is wrong for a Spark-specific reason.' },
    steps: [
      { t: 'Ask “does anything run yet?”', d: 'Transformations are lazy. Only actions (count, collect, show, write) start jobs.' },
      { t: 'Ask “where does this run?”', d: 'Your script runs on the driver. Lambdas and UDFs are serialized to executors. collect() brings data back to the driver.' },
      { t: 'Ask “is there a shuffle?”', d: 'groupBy, join (unless broadcast), distinct, repartition and windows with partitionBy shuffle. Shuffles create stages, and skew lives there.' },
      { t: 'Ask “which memory?”', d: 'Java OOM means heap. A killed container means overhead. Spill means execution memory is short.' },
      { t: 'Ask “what version?”', d: 'Spark 3.2 turned AQE on by default; Spark 4.0 turned ANSI mode on and requires Java 17+.' }
    ],
    terms: [
      ['action vs transformation', 'Actions run jobs; transformations only build the plan.'],
      ['narrow vs wide', 'Narrow: each output partition needs one input partition. Wide: needs many, so a shuffle.'],
      ['stage', 'A set of tasks that run without a shuffle in between.'],
      ['skew', 'A few keys hold most of the data, so a few tasks do most of the work.'],
      ['watermark', 'How long a streaming query waits for late data before finalising state.']
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a topic (or All), how many questions, and the time per question, then press Start. Skip counts as a miss. Misses are listed at the end with explanations and links to their topic pages.'
  },
  gotchas: [
    { trap: 'Answering with Postgres or Java intuitions', why: 'In Postgres a query runs when you send it; in Java a variable holds data. In Spark a DataFrame holds a plan, and code may run on a different machine.', fix: 'Say out loud where each line runs (driver or executor) and when (at definition or at the action).' },
    { trap: 'Forgetting version-specific defaults', why: 'AQE (on since 3.2), ANSI mode (on in 4.0), Java requirements (17+ in 4.0) and trigger options (availableNow in 3.3+) change answers.', fix: 'State the version you are assuming: “in Spark 3.5 with defaults…”.' },
    { trap: 'Guessing configs instead of reading the UI', why: 'Interviewers asking “how would you debug this?” want the method: Spark UI stages, task-time distribution, spill, GC, the SQL tab’s final plan.', fix: 'Describe what you would look at first, then the likely cause, then the fix.' },
    { trap: 'Treating every slowness as memory', why: 'Many slow jobs are data layout problems: skew, small files, a Python UDF, a missing filter or a forced broadcast.', fix: 'Check the slowest stage and its max vs median task time before changing memory settings.' }
  ],
  interview: [
    { q: 'How do you approach a “what happens when this runs?” Spark question?', a: '<p>Walk it in order: what is lazy and what triggers the job; where each piece runs (driver vs executor); where the shuffles are (stages); how much data each task gets (partitions, skew); what is kept between actions (cache) or batches (streaming state). Say the intermediate sizes out loud.</p>', lvl: 'core' },
    { q: 'A job is slow. What do you check first?', a: '<p>The Spark UI: the slowest stage, then its task summary (min/median/max duration and shuffle read). Max ≫ median: skew. All tasks slow with spill: too few partitions or not enough memory. High GC: crowded heaps. Then the SQL tab for the physical plan: join strategies, Exchanges, PushedFilters, Python evaluation nodes.</p>', lvl: 'core' },
    { q: 'Which Spark traps cause the most production incidents?', a: '<ol><li>Skewed keys in joins and aggregations.</li><li>Driver OOM from collect/toPandas or oversized broadcasts.</li><li>Container kills from too little memory overhead (PySpark, Arrow).</li><li>Streaming state growing without watermarks, and non-idempotent sinks.</li><li>Small files and over-partitioned tables.</li></ol>', lvl: 'deep' },
    { q: 'You don’t know the answer. What do you say?', a: '<p>Narrow it down and say how you would check: “It depends on whether the broadcast threshold applies to the estimated size; I believe it does, so sort-merge. I’d confirm with <code>explain()</code> and the SQL tab.” Showing how you would verify in two minutes is a strong senior answer.</p>', lvl: 'core' },
    { q: 'How do you check a Spark claim quickly?', a: '<p><code>pip install pyspark</code>, <code>local[*]</code>, a <code>spark.range()</code> or a small <code>createDataFrame</code>, then <code>explain(mode="formatted")</code> and the local Spark UI on port 4040. Toggle one config with <code>spark.conf.set</code> and compare.</p>', lvl: 'core' }
  ]
});
