(function () {
  // Rough event counts in the style of Temporal's history: an activity adds about 6 events
  // (scheduled, started, completed + the workflow task that reacts), a timer or signal about 5.
  const evPerWf = (v) => 5 + 6 * Math.round(v.acts) + 5 * Math.round(v.waits);
  const big = (x) => (x >= 1e9 ? (x / 1e9).toFixed(1) + ' B' : x >= 1e6 ? (x / 1e6).toFixed(1) + ' M' : x >= 1e4 ? Math.round(x / 1e3) + ' k' : Math.round(x).toLocaleString('en-US'));
  const bytes = (b) => (b >= 1e12 ? (b / 1e12).toFixed(1) + ' TB' : b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' kB');

  SD.register({
    slug: 'durable-execution',
    domain: 4,
    title: 'Durable Execution & Workflow Engines',
    examples: 'Temporal, AWS Step Functions, Uber Cadence',
    tagline: 'Write a long-running business process as <b>ordinary code</b>. The engine records every step in an <b>event history</b>, so after a crash it <b>replays</b> the code and continues exactly where it stopped, even if that is thirty days later.',
    tldr: {
      problem: 'A process such as "reserve stock, charge the card, wait three days for approval, ship" outlives any one request, pod or deploy. Kept in memory it dies with the process. Hand-built with queues, status columns and cron jobs it turns into scattered code nobody can follow.',
      idea: 'Split the code in two. A <b>workflow</b> is deterministic code that only decides what to do next. <b>Activities</b> do the real work (calls, writes). The engine stores each result in an append-only <b>event history</b>. To recover, it runs the workflow code again from the top and feeds it the recorded results instead of repeating the work.',
      insight: 'The engine does not save your variables; it <b>rebuilds them by replay</b>. That is why workflow code must be <b>deterministic</b>, why changing the code of a running workflow needs <b>versioning</b>, and why activities, which run <b>at least once</b>, must be <b>idempotent</b>.',
      numbers: [
        { v: '51,200', l: 'events before Temporal terminates a workflow; warns at 10,240 (Temporal docs)' },
        { v: '1 year', l: 'maximum run time of a Step Functions Standard execution; 25,000 events (AWS docs)' },
        { v: '≥ 1', l: 'times an activity runs when retries are on: at-least-once, never exactly-once' }
      ]
    },

    intro: {
      what: '<b>Durable execution</b> means a function keeps its progress even when the machine running it dies. You write the business process as normal code, called a <b>workflow</b>. A <b>workflow engine</b> records each completed step in a log. If the process crashes, another machine reads the log and carries on from the same line, with the same variables.',
      analogy: {
        icon: '🎮',
        title: 'A game that saves after every move',
        text: 'Picture a board game app that writes down every move. If your phone dies, the app replays the list of moves on a fresh board and you are back in the same position. A workflow engine does this for code: it writes down the result of every step and rebuilds the state by replaying them. The comparison has one catch. Replay only works if the rules give the same result each time, so workflow code must not read the clock or roll dice on its own.'
      },
      problem: 'An order service charges a card and then sleeps for three days waiting for a manager to approve a large order. On day two the service is redeployed. The sleeping thread is gone, and so is the knowledge that this order was half done. The question this page answers is <b>how do you run a process that takes days and many steps when no single machine lives that long?</b>',
      story: [
        {
          stage: 'naive',
          title: 'Keep the process in memory',
          text: 'One method runs the whole process: call stock, call payments, <code>sleep</code>, call shipping. The state lives in local variables on one pod. It reads well and passes every test.',
          scene: {
            nodes: [
              { id: 'svc', label: 'Order service', sub: 'one long method', kind: 'service', at: [210, 0] },
              { id: 'pay', label: 'Payments', sub: 'charge card', kind: 'external', at: [70, 110] },
              { id: 'ship', label: 'Shipping', sub: 'after 3 days', kind: 'external', at: [350, 110] }
            ],
            edges: [{ from: 'svc', to: 'pay' }, { from: 'svc', to: 'ship' }],
            flow: ['svc>pay', 'svc>ship'],
            badges: { svc: ['state in RAM', 'info'] }
          }
        },
        {
          stage: 'breaks',
          title: 'The pod restarts on day two',
          text: 'A deploy or a crash kills the pod. The card was charged, the three-day wait is lost and shipping is never called. Teams patch this with status columns, queues and cron sweepers until the process is spread over ten places.',
          scene: {
            nodes: [
              { id: 'svc', label: 'Order service', sub: 'restarted', kind: 'service', at: [210, 0] },
              { id: 'pay', label: 'Payments', sub: 'charged $40', kind: 'external', at: [70, 110] },
              { id: 'ship', label: 'Shipping', sub: 'never called', kind: 'external', at: [350, 110] }
            ],
            edges: [{ from: 'svc', to: 'pay' }, { from: 'svc', to: 'ship', dashed: true }],
            flow: ['svc>pay'],
            err: ['svc'], warn: ['pay'],
            badges: { svc: ['progress lost', 'err'], pay: ['money taken', 'warn'] }
          }
        },
        {
          stage: 'fix',
          title: 'Record every step, replay to resume',
          text: 'The engine writes each step\'s result to an <b>event history</b>. A new worker runs the same code from the top. Steps already in the history return their saved result at once; the code reaches the same line and continues.',
          scene: {
            nodes: [
              { id: 'svc', label: 'Workflow code', sub: 'new worker, replay', kind: 'service', at: [70, 0] },
              { id: 'eng', label: 'Workflow engine', sub: 'event history', kind: 'store', at: [350, 0] },
              { id: 'pay', label: 'Payments', sub: 'not called again', kind: 'external', at: [70, 110] },
              { id: 'ship', label: 'Shipping', sub: 'called on day 3', kind: 'external', at: [350, 110] }
            ],
            edges: [{ from: 'svc', to: 'eng', bidi: true }, { from: 'svc', to: 'pay', dashed: true }, { from: 'svc', to: 'ship' }],
            flow: ['eng>svc', 'svc>eng', 'svc>ship'],
            ok: ['svc', 'eng', 'ship'],
            badges: { eng: ['charge: done', 'ok'], svc: ['resumed', 'ok'] }
          }
        }
      ],
      usedBy: ['Uber (built Cadence)', 'Temporal (fork of Cadence)', 'AWS Step Functions', 'Azure Durable Functions', 'Restate', 'AWS Lambda durable functions'],
      whenToUse: [
        'A process has <b>many steps across services</b> and must finish or be undone, such as an order, an onboarding or a money transfer',
        'It <b>waits</b>: for a timer of hours or months, for a person, or for a callback from another system',
        'You need to <b>see and fix</b> each running instance: where it is, why it is stuck, retry from there'
      ],
      whenNot: [
        'One step with retries: a queue and an idempotent consumer are enough. See <a href="../../system-design/systems/message-queue.html">message queue</a>',
        'A fixed-time batch job ("run at 02:00"): that is a <a href="../../system-design/systems/job-scheduler.html">job scheduler</a>',
        'Very high rate, sub-millisecond logic, or large data moving between steps: use a stream processor and keep the engine for control flow. For the cross-service consistency pattern itself, see <a href="event-driven-sagas.html">sagas</a>'
      ],
      glossary: [
        { term: 'Workflow', def: 'Deterministic code that describes the order of steps; it decides what to do next and performs no side effects itself.' },
        { term: 'Activity', def: 'One unit of real work, such as an HTTP call or a database write, which may fail and is retried by the engine.' },
        { term: 'Event history', def: 'The append-only log of everything that happened to one workflow run: steps scheduled, results, timers, signals.' },
        { term: 'Replay', def: 'Running the workflow code again from the start and answering each step from the history, to rebuild its state.' },
        { term: 'Deterministic', def: 'Given the same history, the code issues the same steps in the same order every time.' },
        { term: 'Durable timer', def: 'A sleep stored in the engine, not in a thread, so it survives restarts and can last months.' },
        { term: 'Signal', def: 'A message delivered to a running workflow from outside, such as "manager approved".' },
        { term: 'Idempotent', def: 'Safe to run twice: the second run has no extra effect.' }
      ]
    },

    requirements: {
      functional: [
        '<b>Workflow code is deterministic</b>: no wall clock, random numbers, threads or I/O; use the engine\'s versions of each',
        '<b>All side effects live in activities</b>, each with a timeout and a retry policy',
        '<b>Activities are idempotent</b>: they run at least once, so a repeat must be harmless',
        '<b>Waiting is done with durable timers and signals</b>, never with a thread that sleeps',
        '<b>Every change to workflow code is versioned</b> so that runs already in flight still replay',
        '<b>History stays bounded</b>: long or endless workflows restart with a fresh history (continue-as-new)'
      ],
      nonFunctional: [
        'No lost progress: a worker crash delays a workflow by seconds, never loses a completed step',
        'Zero duplicate business effects under activity retry tests (charges, emails, shipments)',
        'Workflow task latency p99 &lt; 200 ms on warm workers (<em>example target</em>)',
        'Every run inspectable: current step, full history, failure reason, in one UI',
        'Replay test in CI: recorded production histories must replay against the new build',
        'History per run well under the engine limit, e.g. &lt; 20% of it (<em>rule of thumb</em>)'
      ],
      outOfScope: [
        '<b>Side effects in workflow code</b>: an HTTP call or DB write there repeats on every replay',
        '<b>Non-idempotent activities</b> with retries on: double charges after a timeout',
        '<b>Deploying changed workflow code with no versioning</b>: running workflows fail to replay',
        '<b>Megabyte payloads in the history</b>: pass a reference to object storage instead',
        '<b>An engine for everything</b>: a two-step flow does not need a workflow cluster'
      ]
    },

    calculator: {
      inputs: [
        { id: 'starts', label: 'Workflows started per day', min: 100, max: 100000000, value: 200000, log: true, fmt: 'num' },
        { id: 'acts', label: 'Activities per workflow', min: 1, max: 2000, value: 8, log: true },
        { id: 'waits', label: 'Timers + signals per workflow', min: 0, max: 500, value: 2 },
        { id: 'ev', label: 'Average event size (inputs + results)', min: 200, max: 200000, value: 1500, log: true, fmt: 'bytes' },
        { id: 'life', label: 'How long a workflow stays open', min: 0.01, max: 365, value: 3, step: 0.01, unit: 'days', log: true },
        { id: 'keep', label: 'History kept after completion', min: 1, max: 90, value: 7, unit: 'days' }
      ],
      outputs: [
        { label: 'Events per workflow (estimate)', fmt: 'raw', f: (v) => big(evPerWf(v)) + ' events · ' + bytes(evPerWf(v) * v.ev) },
        { label: 'Share of history limit: Temporal 51,200 · Step Functions 25,000', fmt: 'raw', f: (v) => { const e = evPerWf(v); const a = e / 51200 * 100, b = e / 25000 * 100; const f = (x) => (x < 1 ? x.toFixed(2) : Math.round(x)) + '%'; return f(a) + ' · ' + f(b) + (e > 10240 ? ' ⚠ split the workflow' : ''); } },
        { label: 'Workflows open at the same time', fmt: 'raw', f: (v) => big(v.starts * v.life) },
        { label: 'Events written per second (engine load)', fmt: 'raw', f: (v) => big(v.starts * evPerWf(v) / 86400) + ' / s' },
        { label: 'History storage: open + retained runs', fmt: 'raw', f: (v) => bytes(v.starts * (v.life / 2 + v.keep) * evPerWf(v) * v.ev) },
        { label: 'Events re-read when a cold worker replays one run (average)', fmt: 'raw', f: (v) => big(evPerWf(v) / 2) + ' events · ' + bytes(evPerWf(v) / 2 * v.ev) }
      ],
      note: 'Event counts are an <em>estimate</em> in the style of Temporal: about 6 history events per activity (scheduled, started, completed, plus the workflow task that reacts to it) and about 5 per timer or signal. Step Functions counts differently but lands in the same range per state. Open runs are assumed to be half way through on average. The limits are from vendor documentation: Temporal terminates a run at 51,200 events or 50 MB and warns at 10,240; Step Functions Standard fails an execution at 25,000 events. Slide <b>Activities</b> to 2,000 to see why a loop over many items needs child workflows or continue-as-new.'
    },

    api: [
      { m: 'RPC', p: 'StartWorkflow(workflowId, type, input)', d: 'The <b>workflow ID is a business key</b> (<code>order-812</code>). The engine allows one open run per ID, so a client that retries the start cannot create two workflows. This is idempotency at the front door.' },
      { m: 'RPC', p: 'Signal(workflowId, name, payload)', d: 'Delivers an outside event such as <code>approve</code> to a running workflow. It is appended to the history and wakes the workflow. <b>Query</b> reads state without changing it.' },
      { m: 'DOC', p: 'Activity contract', d: 'For each activity: input, result, <b>idempotency key</b>, start-to-close timeout, retry policy (initial interval, backoff, max attempts) and which errors are <b>not</b> retried (card declined).' },
      { m: 'POLICY', p: 'Workflow change policy', d: 'Any change that adds, removes or reorders steps needs a version guard or a new worker version. CI replays a sample of recorded histories against the new build and blocks the merge on a mismatch.' },
      { m: 'YAML', p: 'State machine definition (Step Functions ASL)', d: 'The alternative to workflow-as-code: states, <code>Retry</code> and <code>Catch</code> blocks, <code>Wait</code> states and task tokens for callbacks, written as JSON or YAML and versioned with the infrastructure.' },
      { m: 'SLO', p: 'Workflow health', d: '99.9% of order workflows finish within 4 days; schedule-to-start latency of the task queue p99 &lt; 1 s; zero workflows stuck on a non-determinism error for more than 15 minutes.' }
    ],
    dataModel: [
      { name: 'history_event', store: 'Engine store (Cassandra, Postgres, MySQL…)', fields: [['workflow_id', 'text', 'pk'], ['run_id', 'uuid', 'pk'], ['event_id', 'bigint', 'sk'], ['type', 'ActivityTaskScheduled|…Completed|TimerFired|SignalReceived|MarkerRecorded'], ['payload', 'bytes'], ['ts', 'timestamptz']], note: 'Append-only, ordered per run. This is the source of truth; workflow state is whatever the code computes when it replays these rows.' },
      { name: 'task_queue', store: 'Engine (matching service)', fields: [['queue', 'text', 'pk'], ['task_id', 'bigint', 'sk'], ['kind', 'WORKFLOW|ACTIVITY'], ['workflow_id', 'text'], ['visible_at', 'timestamptz', 'idx']], note: 'Workers long-poll their queue. A workflow task says "new events arrived, decide what is next"; an activity task says "do this piece of work".' },
      { name: 'timer', store: 'Engine', fields: [['fire_at', 'timestamptz', 'pk'], ['workflow_id', 'text', 'pk'], ['timer_id', 'text'], ['run_id', 'uuid']], note: 'A sleeping workflow is one row here and nothing in any worker\'s memory. When it fires, the engine appends TimerFired and queues a workflow task.' },
      { name: 'payment_attempt (your service)', store: 'Postgres', fields: [['idem_key', 'text', 'pk'], ['order_id', 'uuid', 'idx'], ['status', 'STARTED|DONE|FAILED'], ['charge_id', 'text'], ['created_at', 'timestamptz']], note: 'The activity\'s own dedupe table. Key = workflow ID + activity ID, which is the same on every retry of that activity.' }
    ],

    architecture: {
      title: 'Engine, event history, task queues, and your workers',
      nodes: [
        { id: 'client', label: 'Starter', sub: 'your API / service', kind: 'client', wide: [90, 170], tall: [70, 0], tip: 'Starts a workflow with a business ID such as order-812 and returns at once. Starting the same ID twice does not create a second run.' },
        { id: 'sig', label: 'Signal source', sub: 'human · webhook', kind: 'external', wide: [90, 300], tall: [350, 0], tip: 'Anything outside that the workflow waits for: an approval click, a payment provider callback, another workflow.' },
        { id: 'api', label: 'Engine API', sub: 'start · signal · query', kind: 'edge', wide: [290, 170], tall: [210, 0], tip: 'The engine\'s front door. Every request becomes an event appended to one workflow\'s history.' },
        { id: 'ui', label: 'Web UI / search', sub: 'every run, every step', kind: 'service', wide: [290, 40], tall: [70, 105], tip: 'Lists running and closed workflows and shows the full history of each. This visibility is half the reason to use an engine.' },
        { id: 'hist', label: 'Event history', sub: 'append-only, per run', kind: 'store', wide: [500, 40], tall: [210, 105], tip: 'The durable record. One ordered list of events per workflow run. Writes are transactional with task creation, so an event and its follow-up task cannot get out of step.' },
        { id: 'tq', label: 'Task queues', sub: 'workflow + activity', kind: 'queue', wide: [500, 170], tall: [210, 210], tip: 'Workers long-poll these. The engine never calls your code; your workers pull tasks, which is why they can sit in a private network.' },
        { id: 'timer', label: 'Durable timers', sub: 'fire in 1 s … 1 year', kind: 'store', wide: [500, 300], tall: [350, 105], tip: 'Sleeps and timeouts are rows with a fire time. A million sleeping workflows cost storage, not threads.' },
        { id: 'wf', label: 'Workflow worker', sub: 'your code · replay', kind: 'compute', wide: [710, 40], tall: [70, 210], tip: 'Runs your deterministic workflow code. It receives the history, replays it to rebuild state, and returns commands: schedule activity, start timer, complete.' },
        { id: 'act', label: 'Activity worker', sub: 'your code · I/O', kind: 'compute', wide: [710, 300], tall: [350, 210], tip: 'Runs the real work. May crash at any point, so the engine retries it: at-least-once execution.' },
        { id: 'db', label: 'Your database', sub: 'idempotency keys', kind: 'store', wide: [910, 170], tall: [210, 315], tip: 'Business data plus a dedupe table, so an activity that runs twice has one effect.' },
        { id: 'ext', label: 'Payment API', sub: 'external system', kind: 'external', wide: [910, 300], tall: [350, 315], tip: 'Any outside system. Pass it an idempotency key derived from the workflow and activity IDs.' }
      ],
      edges: [
        { from: 'client', to: 'api' },
        { from: 'sig', to: 'api' },
        { from: 'api', to: 'hist' },
        { from: 'hist', to: 'ui', dashed: true },
        { from: 'hist', to: 'tq' },
        { from: 'timer', to: 'tq' },
        { from: 'tq', to: 'wf', bidi: true },
        { from: 'wf', to: 'hist', dashed: true, label: 'commands' },
        { from: 'tq', to: 'act', bidi: true },
        { from: 'act', to: 'db' },
        { from: 'act', to: 'ext' }
      ]
    },

    scenarios: [
      {
        id: 'happy', title: 'One step, end to end', tone: 'ok',
        steps: [
          { text: 'The order service starts workflow <code>order-812</code>. The engine appends <b>WorkflowStarted</b> to a new history and puts a <b>workflow task</b> on the queue. The caller gets an answer straight away.', flow: ['client>api', 'api>hist', 'hist>tq'], badges: { hist: '1 event' } },
          { text: 'A workflow worker picks up the task and runs your code. The code reaches <code>chargeCard()</code>. The worker does <b>not</b> call anything; it returns a command: "schedule activity chargeCard".', flow: ['tq>wf', 'wf>hist'], badges: { wf: ['command: schedule', 'info'] } },
          { text: 'The engine appends <b>ActivityTaskScheduled</b> and queues an activity task. An activity worker takes it and calls the payment API.', flow: ['hist>tq', 'tq>act', 'act>ext'], badges: { act: 'attempt 1' } },
          { text: 'The activity returns. The engine appends <b>ActivityTaskCompleted</b> with the result and queues a new workflow task. The result is now durable.', flow: ['act>tq', 'tq>hist'], ok: ['act', 'hist'], badges: { hist: ['result saved', 'ok'] } },
          { text: 'The workflow worker continues from <code>chargeCard()</code> with the saved result and issues the next command. Each step is this same loop: <b>decide, record, do, record</b>.', flow: ['hist>tq', 'tq>wf'], ok: ['wf'], tone: 'ok' }
        ]
      },
      {
        id: 'crash', title: 'Worker crashes: replay', tone: 'err',
        steps: [
          { text: 'Three activities are done and recorded. The workflow worker pod is killed by a deploy. Its memory, including the workflow\'s local variables, is gone.', nodes: ['wf', 'hist'], err: ['wf'], badges: { wf: ['pod killed', 'err'], hist: '3 results stored' }, tone: 'err' },
          { text: 'Nothing is lost. The workflow task times out and goes back on the queue. Another worker picks it up and receives the <b>full event history</b>.', flow: ['hist>tq', 'tq>wf'], warn: ['wf'], badges: { wf: ['new worker', 'info'] } },
          { text: 'It runs the workflow code <b>from the first line</b>. At each activity call the SDK finds the matching event in the history and returns the saved result at once. <b>No activity runs again.</b>', flow: ['hist>wf'], nodes: ['wf'], ok: ['wf'], badges: { wf: ['replaying…', 'info'], act: ['not called', 'ok'] } },
          { text: 'After the third call the history is exhausted. The code is now at the same line with the same variables as before the crash, and issues the fourth command as if nothing happened.', flow: ['wf>hist', 'hist>tq', 'tq>act'], ok: ['wf', 'hist'], badges: { wf: ['resumed', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'dup', title: 'Activity runs twice', tone: 'warn',
        steps: [
          { text: 'The activity worker calls the payment API. The charge <b>succeeds</b>. Before the worker can report back, it crashes.', flow: ['tq>act', 'act>ext'], err: ['act'], ok: ['ext'], badges: { ext: ['charged', 'ok'], act: ['died before ack', 'err'] }, tone: 'err' },
          { text: 'The engine cannot tell "never ran" from "ran, but the answer was lost". After the start-to-close timeout it <b>retries</b> the activity. This is at-least-once execution, and no engine can avoid it.', flow: ['timer>tq', 'tq>act'], warn: ['act'], badges: { act: ['attempt 2', 'warn'] }, tone: 'warn' },
          { text: 'Without protection the card is charged twice. With an <b>idempotency key</b> (workflow ID + activity ID, identical on every attempt) the activity finds its earlier row, and the payment API recognises the key.', flow: ['act>db', 'act>ext'], ok: ['db', 'ext'], badges: { db: ['key seen', 'ok'], ext: ['same charge returned', 'ok'] }, tone: 'ok' },
          { text: 'The completion is recorded once. What to say in an interview: the engine gives <b>exactly-once recording of the result</b>, and at-least-once execution of the work.', flow: ['act>tq', 'tq>hist'], ok: ['hist'], badges: { hist: ['1 completion', 'ok'] } }
        ]
      },
      {
        id: 'version', title: 'Code change breaks replay', tone: 'err',
        steps: [
          { text: 'Thousands of order workflows are sleeping for three days. A developer adds a <code>fraudCheck()</code> activity before <code>chargeCard()</code> and deploys.', nodes: ['wf', 'timer'], badges: { timer: 'runs asleep', wf: ['new code v2', 'info'] } },
          { text: 'A timer fires. The new worker replays an old history. The code asks for <b>fraudCheck</b>; the history says the next step was <b>chargeCard</b>. The SDK raises a <b>non-determinism error</b>.', flow: ['timer>tq', 'tq>wf', 'hist>wf'], err: ['wf'], badges: { wf: ['history ≠ code', 'err'] }, tone: 'err' },
          { text: 'The workflow cannot make progress. Every old run hits the same wall as it wakes up. Nothing is corrupted, but they are stuck until the code can replay them again.', nodes: ['wf', 'ui'], err: ['wf'], warn: ['ui'], badges: { ui: ['stuck runs ↑', 'warn'] }, tone: 'err' },
          { text: 'Fix 1, <b>patching</b>: guard the new step with a version check. Old runs have no marker in their history and take the old branch; new runs record a marker and take the new one.', flow: ['hist>wf', 'wf>hist'], ok: ['wf'], badges: { wf: ['if version ≥ 1', 'ok'] }, tone: 'ok' },
          { text: 'Fix 2, <b>worker versioning</b>: keep v1 workers running for old runs and send new runs to v2 workers. Simpler code, but old workers must live as long as the longest workflow.', flow: [['tq>wf', 'tq>act']], ok: ['wf', 'tq'], badges: { tq: ['v1 + v2 pinned', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'scale', title: 'A million sleepers and a huge history', tone: 'warn',
        steps: [
          { text: 'A subscription workflow sleeps 30 days between charges. One million subscribers means one million open workflows. They use <b>no threads and no worker memory</b>: each is a timer row and a stored history.', nodes: ['timer', 'hist'], hot: ['timer'], badges: { timer: ['1M timers', 'info'] } },
          { text: 'On the first of the month many timers fire together. Workflow tasks pile up on the queue. <b>Schedule-to-start latency</b> rises: this is the signal to add workers.', flow: ['timer>tq', ['tq>wf', 'tq>act']], hot: ['tq'], warn: ['tq'], badges: { tq: ['backlog', 'warn'] }, tone: 'warn' },
          { text: 'Activity workers hammer the payment API. Protect it with a rate limit on the task queue and a cap on concurrent activities, not by hoping retries sort it out.', flow: ['act>ext'], warn: ['ext'], badges: { act: ['max 50 concurrent', 'info'] } },
          { text: 'After years the same workflow has a very long history. Each replay gets slower and the engine\'s limit approaches. The workflow calls <b>continue-as-new</b>: it ends this run and starts a fresh one with the same ID and a compact state.', flow: ['wf>hist'], ok: ['hist', 'wf'], badges: { hist: ['fresh history', 'ok'] }, tone: 'ok' }
        ]
      }
    ],

    knobs: {
      intro: 'Each control is a real choice for a multi-step business process. Meter values are <em>illustrative</em> judgements, not benchmarks.',
      controls: [
        { id: 'how', label: 'How the process is run', type: 'seg', value: 'code', options: [
          { v: 'queue', l: 'Queue + status column' }, { v: 'sm', l: 'Managed state machine' }, { v: 'code', l: 'Workflow-as-code engine' }] },
        { id: 'len', label: 'Process shape', type: 'seg', value: 'long', options: [
          { v: 'short', l: 'Seconds, 2–3 steps' }, { v: 'long', l: 'Days, waits, many steps' }] },
        { id: 'idem', label: 'Activities', type: 'seg', value: 'keys', options: [
          { v: 'none', l: 'Not idempotent' }, { v: 'keys', l: 'Idempotency keys' }] },
        { id: 'chg', label: 'Changing a running process', type: 'seg', value: 'patch', options: [
          { v: 'deploy', l: 'Just deploy' }, { v: 'patch', l: 'Version guard in code' }, { v: 'pin', l: 'Pin runs to a version' }] }
      ],
      evaluate(s) {
        const clamp = (x) => Math.max(0.03, Math.min(0.97, x));
        const H = s.how, L = s.len === 'long', I = s.idem === 'keys', C = s.chg;
        const rec = { queue: L ? 0.3 : 0.6, sm: 0.86, code: 0.92 }[H];
        const dup = I ? 0.9 : 0.15;
        const vis = { queue: L ? 0.2 : 0.4, sm: 0.9, code: 0.85 }[H];
        let chg, chgV;
        if (H === 'queue') {
          chg = { deploy: L ? 0.35 : 0.6, patch: 0.7, pin: 0.62 }[C];
          chgV = { deploy: 'old rows may sit in states the new code dropped', patch: 'version column on each row', pin: 'route old rows to an old consumer' }[C];
        } else if (H === 'sm') {
          chg = { deploy: 0.8, patch: 0.74, pin: 0.88 }[C];
          chgV = { deploy: 'running executions keep their definition', patch: 'Choice state on a version field', pin: 'versions + aliases per release' }[C];
        } else {
          chg = { deploy: L ? 0.08 : 0.45, patch: 0.78, pin: L ? 0.66 : 0.9 }[C];
          chgV = { deploy: L ? 'replay fails: non-determinism error' : 'risky: only safe once old runs drain', patch: 'old runs take the old branch', pin: L ? 'old workers must run for months' : 'old workers drain in minutes' }[C];
        }
        const wait = { queue: L ? 0.2 : 0.7, sm: 0.85, code: 0.93 }[H];
        const cost = { queue: L ? 0.3 : 0.9, sm: L ? 0.72 : 0.6, code: L ? 0.6 : 0.35 }[H];
        const metrics = [
          { k: 'Crash recovery', v: rec >= 0.8 ? 'resumes at the same step' : rec >= 0.5 ? 'redelivery re-runs the step' : 'sweepers and manual repair', s: rec },
          { k: 'Duplicate side effects', v: I ? 'retries are harmless' : 'double charge after a timeout', s: dup },
          { k: 'Visibility of each run', v: vis >= 0.8 ? 'full history per run' : vis >= 0.35 ? 'one status column' : 'grep logs across services', s: vis },
          { k: 'Changing code safely', v: chgV, s: clamp(chg) },
          { k: 'Long waits and timers', v: wait >= 0.8 ? 'built in, months are fine' : wait >= 0.5 ? 'delay queue is enough' : 'cron + due-date column, hand-built', s: wait },
          { k: 'Build & run cost', v: cost >= 0.8 ? 'a table and a queue' : cost >= 0.55 ? 'moderate: engine or per-step fees' : 'high for what you get', s: cost, hint: 'lower bar = more cost' }
        ];
        const notes = [];
        if (H === 'queue' && L) notes.push('Timers, retries with backoff, timeouts, "where is order 812?", compensation: you will build each one. That is a workflow engine, written by accident and without a replay test.');
        if (H === 'queue' && !L) notes.push('For a short flow, a <code>status</code> column, <code>SELECT … FOR UPDATE SKIP LOCKED</code> and an idempotent consumer are easy to reason about and have no new moving parts.');
        if (H === 'sm') notes.push('A managed state machine (Step Functions Standard) keeps the definition as data. Running executions continue on the definition they started with, so there is no replay problem, but complex branching in JSON gets hard to read and test.');
        if (H === 'code') notes.push('Workflow-as-code gives loops, functions and unit tests, at the price of the <b>determinism rules</b> and an engine to run or pay for.');
        if (!I) notes.push('Every option here runs steps <b>at least once</b>. Without idempotency keys a timeout followed by a retry repeats the side effect.');
        if (H === 'code' && C === 'deploy' && L) notes.push('Adding, removing or reordering steps changes the commands the code emits. Old histories no longer match, and every sleeping run fails when it wakes.');
        if (H === 'code' && C === 'pin' && L) notes.push('Pinning is the cleanest code, but a 90-day workflow needs v1 workers for 90 days. Combine it with patching or upgrade at continue-as-new.');
        if (H === 'code' && !L) notes.push('For a flow that ends in seconds, old runs drain before the next deploy, so versioning matters much less. So does the engine.');
        let verdict;
        if (!I) verdict = '❌ <b>Duplicate effects are a matter of time.</b> Make every activity idempotent before choosing anything else.';
        else if (H === 'code' && C === 'deploy' && L) verdict = '❌ <b>The next deploy strands every running workflow.</b> Guard the change with a version, or pin old runs to old workers.';
        else if (H === 'queue' && L) verdict = '⚠ <b>You are building a workflow engine by hand.</b> Long waits, many steps and repair tooling are exactly what an engine provides.';
        else if (H === 'queue') verdict = '✅ <b>A queue and a state machine are enough here.</b> Do not add an engine for a two-step flow.';
        else if (H === 'code' && !L) verdict = '👍 <b>Works, but heavy for the job.</b> Sensible only if the team already runs the engine for bigger workflows.';
        else if (H === 'sm' && L) verdict = '✅ <b>Good fit for integration-heavy flows</b> on one cloud: waits, retries and visibility with nothing to operate. Watch the JSON grow.';
        else if (H === 'sm') verdict = '👍 <b>Fine.</b> Per-transition pricing and a second language for logic are the costs to weigh for a short flow.';
        else verdict = '✅ <b>Durable execution used as intended:</b> long-lived code, idempotent activities and a versioning plan for in-flight runs.';
        const q = H === 'queue';
        const labels = {
          api: q ? { label: 'Your service', sub: 'status column + outbox' } : H === 'sm' ? { label: 'State machine API', sub: 'StartExecution' } : { label: 'Engine API', sub: 'start · signal · query' },
          wf: q ? { label: 'Consumer', sub: 'reads status, does next' } : H === 'sm' ? { label: 'State definition', sub: 'JSON, run by the service' } : { label: 'Workflow worker', sub: 'your code · replay' },
          tq: q ? { label: 'Message queue', sub: 'at-least-once' } : { label: 'Task queues', sub: 'workflow + activity' },
          act: H === 'sm' ? { label: 'Functions / tasks', sub: 'your code · I/O' } : { label: 'Activity worker', sub: 'your code · I/O' },
          db: { label: 'Your database', sub: I ? 'idempotency keys' : 'no dedupe' }
        };
        const hide = q ? ['hist', 'ui'].concat(L ? [] : ['timer', 'sig']) : (L ? [] : ['timer', 'sig']);
        const badges = {};
        if (!I) badges.ext = ['charged twice?', 'err'];
        if (H === 'code' && C === 'deploy' && L) badges.wf = ['replay mismatch', 'err'];
        if (q && L) badges.timer = ['cron sweeper', 'warn'];
        if (!q) badges.hist = ['every step recorded', 'ok'];
        const flow = q ? ['client>api', 'api>tq', 'tq>wf', 'tq>act', 'act>db', 'act>ext'] : ['client>api', 'api>hist', 'hist>tq', 'tq>wf', 'wf>hist', 'tq>act', 'act>db', 'act>ext'];
        if (q) labels.timer = { label: 'Cron sweeper', sub: 'finds overdue rows' };
        return {
          metrics, verdict, notes: notes.slice(0, 4), labels, hide, flow, badges,
          err: (!I ? ['ext'] : []).concat(H === 'code' && C === 'deploy' && L ? ['wf'] : []),
          warn: q && L ? ['timer', 'wf'] : [],
          ok: I ? ['db'] : [],
          hot: []
        };
      }
    },

    widget: {
      title: 'Replay lab: crash a worker, retry an activity, deploy new code',
      caption: 'A four-step order workflow and its event history. <b>Step</b> through it, then <b>crash the worker</b> and watch the code replay from line 1 without repeating any side effect. Make an activity die after doing its work to see <b>at-least-once</b> execution, with and without idempotency. Then <b>deploy v2</b> mid-run to trigger a non-determinism error, and fix it with a patch.'
    },

    realWorld: {
      intro: 'Workflow engines are old; what is newer is writing the workflow as ordinary code and recovering it by replay. The line runs from Amazon\'s and Microsoft\'s internal systems through Uber\'s Cadence to today\'s engines.',
      timeline: [
        { when: '2017', who: 'Uber', title: 'Cadence open-sourced', text: 'Uber built Cadence as an orchestration engine for its microservices and open-sourced it in 2017. Its design is the template for this page: front end, history and matching services over a Cassandra store, with developers writing <b>workflows</b> that combine <b>activities</b>.', src: 0 },
        { when: '2019', who: 'Temporal', title: 'Cadence\'s creators fork it', text: 'Maxim Fateev and Samar Abbas, who had worked on Amazon SWF, Azure\'s Durable Task Framework and then Cadence, founded Temporal to continue the work as a fork. The term <b>durable execution</b> comes mostly from this group.', src: 1 },
        { when: 'docs', who: 'Microsoft', title: 'Durable Functions: orchestrator code constraints', text: 'Azure Durable Functions uses the same replay model. Microsoft\'s documentation states it plainly: an orchestrator function is replayed multiple times and must produce the same result each time, so current time, random numbers and I/O are not allowed in it.', src: 2 },
        { when: 'docs', who: 'AWS', title: 'Step Functions: Standard vs Express', text: 'Step Functions takes the other route: a state machine defined as data. <b>Standard</b> workflows run up to one year with an exactly-once model per step and a 25,000-event history limit. <b>Express</b> workflows run up to five minutes and are at-least-once when asynchronous, so their steps should be idempotent.', src: 3 },
        { when: 'docs', who: 'Temporal', title: 'History limits and continue-as-new', text: 'Temporal terminates a workflow whose history passes <b>51,200 events</b> (or 50 MB) and logs a warning after 10,240. The documented answer for long-lived workflows is <b>continue-as-new</b>: finish this run and atomically start a new one with the same workflow ID and a fresh history.', src: 5 },
        { when: 'docs', who: 'Temporal', title: 'Activities are at-least-once', text: 'Temporal\'s activity documentation recommends idempotent activities: with retries on, an activity is observed as completed once but may execute several times, for example when a worker finishes the work and crashes before reporting it.', src: 7 },
        { when: 'recent', who: 'Temporal', title: 'Worker Versioning generally available', text: 'Temporal announced general availability of <b>Worker Versioning</b>, which pins running workflows to the worker build they started on, and now recommends it over in-code patching where teams can run versioned deployments. "Upgrade on continue-as-new" was announced as a public preview at the same time.', src: 8 },
        { when: 'Dec 2025', who: 'AWS', title: 'Lambda durable functions', text: 'AWS announced durable functions for Lambda: checkpointed multi-step code that resumes after failures and can suspend for long waits. Durable execution is now a built-in feature of a mainstream function platform, not only of dedicated engines.', src: 10 },
        { when: 'today', who: 'Restate', title: 'A journal instead of a history service', text: 'Restate records each step of a handler in a <b>journal</b>. On failure the server re-invokes the handler with the journal attached and completed steps are skipped. Same idea, packaged as a single lightweight server in front of ordinary services.', src: 11 }
      ],
      lessons: [
        'The engine stores <b>results, not variables</b>. State is rebuilt by replay, so workflow code must be deterministic.',
        '<b>At-least-once</b> is the only honest guarantee for side effects. Idempotency is your job.',
        'Plan <b>versioning</b> before the first long-running workflow ships, and replay real histories in CI.',
        'Keep histories small: references not blobs, child workflows for fan-out, <b>continue-as-new</b> for loops.',
        'If a queue and a status column describe the whole process, <b>you do not need an engine</b>.'
      ],
      sources: [
        { title: 'Conducting Better Business with Uber\'s Open Source Orchestration Tool, Cadence', url: 'https://www.uber.com/blog/open-source-orchestration-tool-cadence-overview', pub: 'Uber Engineering, 2019' },
        { title: 'Building resilient Workflows: from Azure to Cadence to Temporal', url: 'https://temporal.io/blog/building-resilient-workflows-from-azure-to-cadence-to-temporal', pub: 'Temporal blog' },
        { title: 'Orchestrator function code constraints', url: 'https://learn.microsoft.com/azure/azure-functions/durable/durable-functions-code-constraints', pub: 'Microsoft Learn, Azure Durable Functions' },
        { title: 'Choosing workflow type in Step Functions', url: 'https://docs.aws.amazon.com/step-functions/latest/dg/choosing-workflow-type.html', pub: 'AWS Step Functions Developer Guide' },
        { title: 'Step Functions service quotas', url: 'https://docs.aws.amazon.com/step-functions/latest/dg/limits.html', pub: 'AWS Step Functions Developer Guide' },
        { title: 'Events and Event History', url: 'https://docs.temporal.io/workflow-execution/event', pub: 'Temporal documentation' },
        { title: 'Managing very long-running Workflows', url: 'https://temporal.io/blog/very-long-running-workflows', pub: 'Temporal blog' },
        { title: 'Activity Definition', url: 'https://docs.temporal.io/activity-definition', pub: 'Temporal documentation' },
        { title: 'Announcing GA for Worker Versioning and Public Preview for Upgrade on Continue-as-New', url: 'https://temporal.io/blog/ga-worker-versioning-public-preview-upgrade-on-continue-as-new', pub: 'Temporal blog' },
        { title: 'Patching', url: 'https://docs.temporal.io/patching', pub: 'Temporal documentation' },
        { title: 'AWS Lambda announces durable functions for multi-step applications and AI workflows', url: 'https://aws.amazon.com/about-aws/whats-new/2025/12/lambda-durable-multi-step-applications-ai-workflows', pub: 'AWS What\'s New, December 2025' },
        { title: 'Durable Execution', url: 'https://docs.restate.dev/concepts/durable_execution', pub: 'Restate documentation' },
        { title: 'What is idempotency? And why it matters for durable systems', url: 'https://temporal.io/blog/idempotency-and-durable-execution', pub: 'Temporal blog' },
        { title: 'Durable orchestrations', url: 'https://learn.microsoft.com/azure/azure-functions/durable/durable-functions-orchestrations', pub: 'Microsoft Learn, Azure Durable Functions' }
      ]
    },

    tradeoffs: {
      headers: ['Decision', 'Option A', 'Option B', 'Pick when…'],
      rows: [
        ['Build or adopt', '<b>Queue + state machine</b>: status column, consumer, cron sweeper', '<b>Workflow engine</b>: history, timers, retries and UI built in', 'Queue for a few steps that finish in seconds. Engine once there are long waits, many steps, or people asking "where is it stuck?"'],
        ['Definition style', '<b>Workflow as code</b> (Temporal, Cadence, Durable Functions, Restate)', '<b>State machine as data</b> (Step Functions ASL, BPMN)', 'Code for complex logic, loops and unit tests. Data when the flow is mostly service integrations or non-developers must read it'],
        ['Run it yourself', '<b>Self-hosted engine</b>: cluster + database to operate', '<b>Managed</b>: cloud service or vendor cloud, pay per action', 'Managed unless you have a platform team and a reason (cost at scale, data location)'],
        ['Changing live code', '<b>Patch / version guard</b>: both paths in one code base', '<b>Worker versioning</b>: old runs stay on old workers', 'Versioning for short-lived workflows. Patching, or upgrade at continue-as-new, when runs last weeks'],
        ['Step granularity', '<b>Few large activities</b>: small history, coarse retries', '<b>Many small activities</b>: fine retries, large history', 'One activity per external side effect. Split when a retry would repeat something expensive'],
        ['Passing data', '<b>Payload in history</b>: simple, visible in the UI', '<b>Reference to object storage</b>: small history, extra hop', 'Reference for anything beyond a few kilobytes or anything sensitive']
      ]
    },
    failures: [
      { f: 'Non-determinism error after a deploy', detect: 'Workflow tasks fail repeatedly with a history mismatch; count of stuck runs climbs as timers fire', fix: 'Roll back the worker; add a version guard or pin old runs; add a CI step that replays recorded histories against every build.' },
      { f: 'Duplicate side effect from activity retry', detect: 'Two charges or emails with the same workflow and activity ID; activity attempt &gt; 1 in the history', fix: 'Idempotency key = workflow ID + activity ID, stored in your DB and passed to external APIs; mark business rejections as non-retryable.' },
      { f: 'History grows without bound', detect: 'Event count warning; replay time and workflow task latency rising for old runs', fix: 'Continue-as-new at a safe point; child workflows for fan-out; references instead of large payloads.' },
      { f: 'Side effect inside workflow code', detect: 'The same HTTP call or log line appears once per replay; behaviour differs after a worker restart', fix: 'Move it into an activity. Use the SDK\'s time, random and UUID functions, and a replay-aware logger.' },
      { f: 'Activity hangs forever', detect: 'Runs stuck on one activity with no timeout; schedule-to-close unlimited', fix: 'Always set start-to-close; add heartbeats for long activities so a dead worker is noticed in seconds, not hours.' },
      { f: 'Retry storm on a downstream system', detect: 'Payment API rate-limits; thousands of activities in backoff at once', fix: 'Exponential backoff with a cap; task-queue rate limit; limit concurrent activities per worker; circuit-break at the client.' },
      { f: 'Worker backlog', detect: 'Schedule-to-start latency grows while workers show spare CPU or are too few', fix: 'Scale workers on schedule-to-start latency; separate task queues for slow and fast activities.' }
    ],

    interview: [
      { q: 'What is durable execution?', a: '<p>It is a guarantee that a function <b>runs to completion despite process crashes, restarts and deploys</b>, keeping its position and local state. You write a long-running process as normal sequential code. The platform records the result of every step in a durable log and, after a failure, restores the function to where it was.</p><p>It is not magic checkpointing of memory. Most engines restore state by <b>replaying</b> the code against the recorded results. That mechanism explains every rule that follows: deterministic workflow code, idempotent activities, and versioning.</p>', lvl: 'core' },
      { q: 'Explain the difference between a workflow and an activity.', a: '<p>A <b>workflow</b> is the orchestration logic: the order of steps, branches, loops, waits. It must be <b>deterministic</b> and does no I/O. Its output is a list of commands such as "schedule this activity" or "start this timer".</p><p>An <b>activity</b> is a normal function that does the real work: call an API, write to a database. It can fail, time out and be retried. Its result is stored in the history.</p><p>The split exists so that the workflow can be replayed safely any number of times while side effects happen only in activities.</p>', lvl: 'core' },
      { q: 'How does replay work? Walk me through a crash.', a: '<ol><li>The workflow has run three activities. The history holds, for each, a "scheduled" and a "completed" event with the result.</li><li>The worker dies. The engine notices the workflow task timed out and gives it to another worker with the full history.</li><li>That worker runs the workflow function <b>from its first line</b>. When the code calls an activity, the SDK looks at the next event in the history. It matches, so the SDK returns the recorded result immediately and does not schedule anything.</li><li>After the third call there is no more history. The code is now at the same line with the same variables. The next call is new, so the SDK sends a real command.</li></ol><p>Workers also cache running workflows in memory, so replay is the recovery path, not the normal path.</p>', lvl: 'core' },
      { q: 'Why must workflow code be deterministic, and what breaks it?', a: '<p>Replay compares the commands the code emits with the events in the history, in order. If the code takes a different path on replay, the two disagree and the workflow cannot continue.</p><p>Things that break it:</p><ul><li>reading the system clock, random numbers or UUIDs directly,</li><li>network or database calls in workflow code,</li><li>iterating over an unordered map, using threads, reading environment variables or mutable config,</li><li><b>changing the code</b>: adding, removing or reordering steps.</li></ul><p>Each SDK offers replacements: workflow time, a seeded random, side-effect or activity calls whose results are recorded.</p>', lvl: 'core' },
      { q: 'Does the engine give me exactly-once execution?', a: '<p><b>No.</b> It gives exactly-once <b>recording</b> of each step\'s result, and <b>at-least-once execution</b> of activities when retries are enabled.</p><p>The gap is the case where the activity did its work and the worker died before reporting. The engine cannot distinguish that from "never ran", so it retries. You close the gap yourself with <b>idempotency</b>: a key built from the workflow ID and activity ID, stored with the effect in your database and sent to external APIs.</p><p>If a step truly must not repeat, set max attempts to 1 and accept at-most-once: it may then not run at all, and the workflow must handle that.</p>', fu: 'Step Functions Standard says "exactly-once". What does that mean?', lvl: 'core' },
      { q: 'How do timers and signals work, and why are they cheap?', a: '<p>A <b>durable timer</b> is a record in the engine with a fire time. When the workflow calls sleep for 30 days, the worker returns a "start timer" command and <b>forgets the workflow</b>. No thread or memory is held. When the time comes the engine appends a "timer fired" event and queues a task; any worker replays and continues.</p><p>A <b>signal</b> is an external message appended to the history, which wakes the workflow the same way. Waiting for a human approval with a three-day timeout is a wait on "signal or timer, whichever is first".</p><p>So a million sleeping workflows cost storage and nothing else.</p>', lvl: 'core' },
      { q: 'You need to add a step to a workflow that has 50,000 running instances. How?', a: '<p>Three options, by how long runs live:</p><ul><li><b>Patch / version guard</b>: wrap the new step in a version check. Runs whose history has no marker take the old path on replay; new runs record a marker and take the new path. Remove the old branch once those runs are gone.</li><li><b>Worker versioning</b>: deploy v2 workers alongside v1. Running workflows stay pinned to v1; new ones go to v2. Clean code, but v1 must run until its last workflow ends.</li><li><b>New workflow type</b> for a big redesign; let the old type drain.</li></ul><p>In all cases I would add a CI check that replays recorded histories against the new build. For very long runs I would upgrade at a continue-as-new boundary.</p>', lvl: 'deep' },
      { q: 'What is continue-as-new and when do you need it?', a: '<p>Every event stays in the history, so an endless loop or a multi-year workflow grows without bound. Replay gets slower and engines enforce a limit; Temporal documents 51,200 events or 50 MB.</p><p><b>Continue-as-new</b> ends the current run and atomically starts a new run of the same workflow with the same ID, passing only the state that still matters. The history starts empty.</p><p>Use it for subscription loops, entity-style workflows that live as long as a customer, and polling loops. For large fan-out, use child workflows, each with its own history.</p>', lvl: 'deep' },
      { q: 'When is a queue plus a state machine enough?', a: '<p>When the process has <b>few steps, no long waits, and one owner</b>. A <code>status</code> column, a queue, an idempotent consumer and a retry policy cover that well, and everyone already understands them.</p><p>Signs you have outgrown it:</p><ul><li>cron jobs that look for rows stuck in a state,</li><li>timeouts and reminders stored as due-date columns,</li><li>several services each holding a piece of the flow,</li><li>support asking why a specific order is stuck and nobody can answer quickly.</li></ul><p>At that point you are maintaining a private workflow engine without history, replay tests or a UI.</p>', lvl: 'core' },
      { q: 'Compare Temporal-style engines with AWS Step Functions.', a: '<ul><li><b>Definition</b>: Temporal, Cadence, Durable Functions and Restate use code in a general language. Step Functions uses a JSON state language.</li><li><b>Recovery</b>: code engines replay a history, which brings determinism and versioning rules. Step Functions stores the current state and its data; a running execution keeps the definition it started with.</li><li><b>Limits</b> (from the vendors\' docs): Step Functions Standard runs up to one year and 25,000 events; Temporal has no time limit but 51,200 events per run.</li><li><b>Operations</b>: Step Functions is fully managed and tied to AWS. Temporal can be self-hosted or bought as a cloud service and is portable.</li></ul><p>I pick Step Functions for integration-heavy flows on AWS, and a code engine when the logic is complex or must be portable and unit tested.</p>', lvl: 'deep' },
      { q: 'How does this relate to sagas?', a: '<p>A <b>saga</b> is a consistency pattern: a sequence of local transactions with a compensating action for each. <b>Durable execution</b> is an implementation tool: it makes sure the code that runs the saga itself survives failures.</p><p>An orchestrated saga in a workflow engine is a try block with compensations registered as it goes; on failure they run in reverse, and the engine guarantees the compensation code runs to the end even across crashes. Without an engine you would store the saga state yourself.</p><p>The engine does not remove the saga\'s properties: there is still no isolation between sagas, and compensations must still be idempotent.</p>', lvl: 'deep' },
      { q: 'How would you convince a team that prefers "just Kafka and a status column" to adopt an engine?', a: '<p>I would not argue from technology. I would pick <b>one painful process</b> and measure it: how many rows get stuck per week, how long support takes to explain one, how many cron sweepers exist, how many incidents came from a timeout plus a retry.</p><p>Then I would run a time-boxed trial of that one process on an engine, with idempotent activities and a replay test, and compare: lines of code, stuck instances, time to answer "where is order X". I would be explicit about the costs: determinism rules, versioning discipline, and another system to operate or pay for.</p><p>If the simple approach wins on those numbers, we keep it. Often the long-running process moves and the short ones stay on the queue.</p>', lvl: 'core' }
    ],

    code: [
      {
        title: 'Spring Boot + Temporal: workflow with a signal, a durable timer and a version guard', lang: 'java',
        code: `// Java 21, Spring Boot 3.x, io.temporal:temporal-spring-boot-starter
@WorkflowInterface
public interface OrderWorkflow {
  @WorkflowMethod String run(String orderId);
  @SignalMethod void approve(String approver);
}

@WorkflowImpl(taskQueues = "orders")      // the starter registers it on a worker
public class OrderWorkflowImpl implements OrderWorkflow {
  private final OrderActivities act = Workflow.newActivityStub(OrderActivities.class,
      ActivityOptions.newBuilder()
          .setStartToCloseTimeout(Duration.ofSeconds(30))
          .setRetryOptions(RetryOptions.newBuilder()
              .setInitialInterval(Duration.ofSeconds(1))
              .setBackoffCoefficient(2.0)
              .setDoNotRetry(CardDeclinedException.class.getName())
              .build())
          .build());

  private String approver;                // a plain field: rebuilt by replay after a crash

  @Override public void approve(String who) { this.approver = who; }

  @Override public String run(String orderId) {
    act.reserveStock(orderId);

    // Added later. Runs that started before the change replay the old branch.
    int v = Workflow.getVersion("fraud-check", Workflow.DEFAULT_VERSION, 1);
    if (v >= 1) act.fraudCheck(orderId);

    // Durable wait for a signal, with a timeout. No thread is held for three days.
    boolean approved = Workflow.await(Duration.ofDays(3), () -> approver != null);
    if (!approved) { act.releaseStock(orderId); return "EXPIRED"; }

    String paymentId = Workflow.randomUUID().toString();  // recorded, same on replay
    act.chargeCard(orderId, paymentId);                   // paymentId = idempotency key
    Workflow.sleep(Duration.ofHours(24));                 // durable timer
    act.sendReviewRequest(orderId);
    return "DONE";
  }
}`,
        note: 'Everything in <code>run</code> is deterministic: time, UUIDs and waits go through <code>Workflow.*</code>, and all I/O is behind the activity stub. <code>UUID.randomUUID()</code>, <code>Instant.now()</code> or <code>Thread.sleep()</code> here would break replay.'
      },
      {
        title: 'Python: an idempotent activity (Temporal SDK + Postgres)', lang: 'python',
        code: `# Python 3.11+, temporalio, psycopg 3.  Table: payment_attempt(idem_key PRIMARY KEY, ...)
import psycopg
from temporalio import activity
from temporalio.exceptions import ApplicationError

@activity.defn
async def charge_card(order_id: str, amount_cents: int) -> str:
    info = activity.info()
    # Identical on every retry of this activity, different for any other step.
    key = f"{info.workflow_id}:{info.activity_id}"

    async with await psycopg.AsyncConnection.connect(DSN, autocommit=True) as conn:
        await conn.execute(
            """INSERT INTO payment_attempt (idem_key, order_id, status)
               VALUES (%s, %s, 'STARTED') ON CONFLICT (idem_key) DO NOTHING""",
            (key, order_id))
        cur = await conn.execute(
            "SELECT status, charge_id FROM payment_attempt WHERE idem_key = %s", (key,))
        status, charge_id = await cur.fetchone()
        if status == "DONE":            # an earlier attempt finished: do nothing more
            return charge_id

        try:
            # The provider dedupes on the same key, so a retry after a lost
            # response returns the first charge instead of making a second one.
            charge_id = await psp.charge(order_id, amount_cents, idempotency_key=key)
        except psp.CardDeclined as e:
            # A business "no": tell the engine not to retry.
            raise ApplicationError(str(e), type="CardDeclined", non_retryable=True)

        await conn.execute(
            "UPDATE payment_attempt SET status = 'DONE', charge_id = %s WHERE idem_key = %s",
            (charge_id, key))
        return charge_id`,
        note: '<code>psp</code> and <code>DSN</code> stand for your payment client and connection string. Two layers protect the customer: your own table answers quickly on a retry, and the provider\'s idempotency key covers the window where the charge succeeded but the <code>UPDATE</code> did not happen.'
      },
      {
        title: 'SQL: when a queue and a state machine are enough (Postgres)', lang: 'sql',
        code: `-- A three-step process without an engine. Postgres 15+.
CREATE TABLE order_process (
  order_id    uuid PRIMARY KEY,
  state       text NOT NULL DEFAULT 'NEW'
              CHECK (state IN ('NEW','RESERVED','CHARGED','DONE','FAILED')),
  attempts    int  NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),   -- also serves as retry backoff
  last_error  text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_process_due ON order_process (next_run_at)
  WHERE state NOT IN ('DONE','FAILED');

-- Each worker claims a batch. SKIP LOCKED lets many workers run without blocking.
BEGIN;
SELECT order_id, state FROM order_process
 WHERE state NOT IN ('DONE','FAILED') AND next_run_at <= now()
 ORDER BY next_run_at
 LIMIT 20
 FOR UPDATE SKIP LOCKED;

-- The worker performs the ONE step for the current state (idempotently), then:
UPDATE order_process
   SET state = 'CHARGED', attempts = 0, updated_at = now()
 WHERE order_id = $1 AND state = 'RESERVED';        -- guard: only the expected transition
COMMIT;

-- On a transient failure: back off instead of advancing.
UPDATE order_process
   SET attempts = attempts + 1, last_error = $2,
       next_run_at = now() + make_interval(secs => least(300, 2 ^ attempts)),
       state = CASE WHEN attempts >= 8 THEN 'FAILED' ELSE state END
 WHERE order_id = $1;`,
        note: 'This is fine for a short process. Holding the row lock while calling an external system limits how long a step may take; for slow steps, claim with a lease column instead. When you start adding timers, signals and a UI on top of this table, you have reached the point where an engine pays for itself.'
      }
    ],

    related: ['event-driven-sagas', 'resiliency-patterns', 'ms-communication', 'serverless-architecture', 'agentic-architecture', 'sd:job-scheduler', 'sd:message-queue']
  });
})();
