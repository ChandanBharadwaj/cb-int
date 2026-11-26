IA.register({
  track: 'databricks',
  slug: 'tricky-databricks',
  title: '★ Tricky Databricks (timed)',
  tagline: 'Forty “what happens / which knob / who pays” questions from all 15 Databricks topics, against the clock. Each one is a trap that shows up in senior interviews or on a bill. Every miss links back to the page that explains it.',
  tldr: {
    problem: 'Databricks interviews rarely ask you to recite features. They describe a job, a stream, a warehouse or a bill and ask what goes wrong and what you would change.',
    model: 'Most tricks are one of five things: <b>state lives somewhere</b> (checkpoints, Delta log, bundle state), <b>reruns must be idempotent</b>, <b>compute type decides price and isolation</b>, <b>Unity Catalog needs the whole grant chain</b>, and <b>files and layout decide speed</b> (skipping, clustering, small files).',
    hook: 'You restart a Kafka stream with a new <code>startingOffsets</code> and nothing changes. If you can say why in one sentence (the checkpoint wins), start the drill.',
    facts: [
      { v: '40', l: 'questions across all 15 Databricks topics, from basics to cost and CI/CD' },
      { v: '60 s', l: 'per question by default. Slow (90 s) and Fast (30 s) modes too' },
      { v: 'as of 2025', l: 'product names move fast (Lakeflow Jobs, Declarative Pipelines, serverless). Check your workspace' }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short situation, a timer and four answers (shuffled each time). Answer in your head, as you would in an interview, then read the explanation. At the end you see your score per topic and a review of every miss, each with a link back to its topic page.',
    analogy: { icon: '⏱️', title: 'Flash cards with a clock', text: 'An interviewer gives you a situation and waits. The clock is there so you practise deciding quickly, then explaining why. Speed comes from having seen the trap before.' },
    steps: [
      { t: 'Ask “where is the state?”', d: 'Streams keep offsets in the checkpoint. Delta keeps history in <code>_delta_log</code>. Bundles keep what they deployed in deployment state. Most “why didn’t my change apply?” answers start here.' },
      { t: 'Ask “what if this runs twice?”', d: 'Job retries, repair runs and stream replays all re-execute code. Appends duplicate; MERGE on a key or REPLACE WHERE does not.' },
      { t: 'Ask “which compute, and who pays?”', d: 'All-purpose vs job vs serverless vs SQL warehouse changes isolation, startup time and DBU rate.' },
      { t: 'Ask “what does the planner skip?”', d: 'Data skipping, clustering and file sizes decide how much is read. Photon decides how fast it is processed.' }
    ],
    terms: [
      ['DBU', 'Databricks Unit: the unit Databricks bills compute in. The rate per hour depends on compute type, tier and cloud.'],
      ['checkpoint', 'Folder where a stream stores offsets and state so it can resume exactly where it stopped.'],
      ['idempotent', 'Running it twice gives the same result as running it once.'],
      ['service principal', 'A non-human identity for jobs and CI.'],
      ['Unity Catalog', 'Databricks’ governance layer: <code>catalog.schema.table</code>, grants, lineage.']
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a topic (or All), how many questions and the time per question, then press Start. Skip counts as a miss. Your misses are listed at the end with explanations and links to the topic pages.'
  },
  gotchas: [
    { trap: 'Answering with last year’s product names only', why: 'Databricks renames often: Workflows → Lakeflow Jobs, DLT → Lakeflow Declarative Pipelines, access modes “single user/shared” → “dedicated/standard”. Interviewers may use either.', fix: 'Name both: “Lakeflow Jobs, formerly Workflows”. Then answer the mechanism, which changes far less than the name.' },
    { trap: 'Quoting prices from memory', why: 'DBU rates differ by cloud, region, tier, compute type and contract, and they change.', fix: 'Say “job compute is typically cheaper per DBU than all-purpose; check the price list or <code>system.billing.list_prices</code>”.' },
    { trap: 'Treating Databricks as “just Spark”', why: 'Many answers depend on Databricks-only pieces: Unity Catalog grants, Photon, Auto Loader, predictive optimization, bundles.', fix: 'Start from the Spark mechanism (see the <a href="../spark/index.html">Spark track</a>), then add what Databricks layers on top.' }
  ],
  interview: [
    { q: 'How do you approach a “what goes wrong?” Databricks question?', a: '<p>Walk the path of the data and the run: where it is read from, which compute runs it, where state is kept, what is written and whether a rerun duplicates it. Then name the cheapest fix and how you would verify it (query profile, system tables, a test run in a dev target).</p>', lvl: 'core' },
    { q: 'Which three Databricks mistakes cost the most money in practice?', a: '<p>1) Interactive (all-purpose) clusters left running or used for scheduled jobs. 2) Oversized or always-on warehouses and clusters without auto-stop. 3) Inefficient layouts (tiny files, over-partitioning) that make every query read too much. All three show up in <code>system.billing.usage</code> once you tag resources.</p>', lvl: 'core' },
    { q: 'You don’t know the current product name. What do you say?', a: '<p>Describe the mechanism and give the name you know with a caveat: “the declarative pipeline product, DLT, now called Lakeflow Declarative Pipelines as of 2025, I would check the docs for the latest naming.” That is honest and shows you track the platform.</p>', lvl: 'core' },
    { q: 'How would you verify a claim about Databricks behaviour quickly?', a: '<p>A tiny notebook on a small cluster or serverless: create a table with a few rows, run the operation, check <code>DESCRIBE HISTORY</code>, the query profile or the stream’s progress JSON. For cost and usage questions, query the system tables rather than guessing.</p>', lvl: 'deep' }
  ]
});
