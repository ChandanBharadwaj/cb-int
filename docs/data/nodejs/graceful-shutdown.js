IA.register({
  track: 'nodejs',
  slug: 'graceful-shutdown',
  title: 'Graceful shutdown & containers',
  tagline: 'Every deploy kills your pods. Whether users notice depends on four details: does the <b>signal reach Node</b> (PID 1, shell-form <code>CMD</code>), does Node <b>stop accepting but finish</b> what’s in flight, does it wait for the <b>load balancer to stop routing</b> first, and does it <b>exit before SIGKILL</b>.',
  tldr: {
    problem: 'Rolling deploys cause a burst of 502s and reset connections, or each pod takes exactly 30 s to die. Both are shutdown bugs: the process either dies too abruptly or never hears that it should stop.',
    model: 'Kubernetes marks the pod Terminating and, <b>in parallel</b>, (a) removes it from Service endpoints, which takes a few seconds to propagate, and (b) runs <code>preStop</code>, then sends <b>SIGTERM</b> to PID 1, waits <code>terminationGracePeriodSeconds</code> (30 s) and sends <b>SIGKILL</b>. Your process should: keep serving briefly while routing catches up, <code>server.close()</code>, finish in-flight work, close pools and consumers, exit 0, with a hard deadline below the grace period.',
    hook: '“Why does <code>docker stop</code> take 10 s on our Node container?” Node is PID 1 with no SIGTERM handler. The kernel doesn’t apply default signal actions to PID 1, so SIGTERM is ignored until Docker gives up and sends SIGKILL.',
    facts: [
      { v: '30 s', l: 'default <code>terminationGracePeriodSeconds</code> in Kubernetes; <code>docker stop</code> waits 10 s by default before SIGKILL' },
      { v: '137 / 143', l: 'exit codes for death by SIGKILL (128+9) and by an unhandled SIGTERM (128+15)' },
      { v: 'PID 1', l: 'gets only the signals it installed handlers for (kill(2)). The Node Docker image docs warn that Node “was not designed to run as PID 1”' }
    ]
  },
  intro: {
    what: 'When a platform wants to stop your app (a deploy, a scale-down, a node drain), it doesn’t pull the plug straight away. It sends a polite <b>signal</b>, SIGTERM, and waits a while before forcing it with SIGKILL. <b>Graceful shutdown</b> is what your app does in between: stop taking new work, finish the work it has, release resources, and exit. In a container there’s a catch: your process may be <b>PID 1</b>, which plays by special signal rules.',
    analogy: { icon: '🍽️', title: 'Closing a restaurant for the night', text: 'First take the “Open” sign down (readiness / leave the load balancer), but keep the door unlocked for a minute: people already walking in from the street (requests already routed) should still be served. Then lock the door (<code>server.close()</code>), let seated guests finish (in-flight requests), clean the kitchen (close DB pools, commit Kafka offsets) and turn off the lights (exit 0). If the landlord’s deadline passes (SIGKILL), everyone is thrown out mid-meal.' },
    steps: [
      { t: 'Listen for SIGTERM', d: 'Installing a handler replaces the default “die now” behaviour.', code: "process.once('SIGTERM', shutdown);\nprocess.once('SIGINT', shutdown);   // Ctrl-C locally" },
      { t: 'Stop accepting, finish in-flight', d: '<code>server.close()</code> stops new connections; its callback fires when existing ones are done.' },
      { t: 'Release resources', d: 'Close DB pools, stop queue consumers, flush logs and telemetry.' },
      { t: 'Exit, with a deadline', d: 'Exit 0 when done, and force-exit before the platform’s SIGKILL.', code: "setTimeout(() => process.exit(1), 25_000).unref();" },
      { t: 'Make sure the signal arrives', d: 'Use exec-form <code>CMD ["node", "server.js"]</code>, and an init such as tini if Node would be PID 1.' }
    ],
    terms: [
      ['SIGTERM', 'The polite “please stop” signal. Can be handled.'],
      ['SIGKILL', 'The forced stop. Can’t be handled or ignored.'],
      ['PID 1', 'The first process in a container; the kernel gives it special signal rules.'],
      ['drain', 'Stop accepting new work while finishing work already started.'],
      ['readiness probe', 'Kubernetes’ “can this pod take traffic?” check.'],
      ['liveness probe', 'Kubernetes’ “is this process stuck? should I restart it?” check.']
    ]
  },
  visual: {
    title: 'A pod’s last 30 seconds',
    caption: 'Choose how the container starts, what the SIGTERM handler does, and whether there is a preStop delay. Press Play. Watch when SIGTERM arrives, what happens to requests still being routed in the first seconds, and whether the pod exits or gets SIGKILLed.'
  },
  gotchas: [
    { trap: 'Node as PID 1 without a handler ignores SIGTERM', code: `# Dockerfile
CMD ["node", "server.js"]      # node is PID 1, no SIGTERM handler → ignored`, why: 'For PID 1 the kernel skips default signal actions: a signal with no installed handler is simply dropped. The container keeps running until the grace period ends and SIGKILL arrives: slow rollouts and lost in-flight requests.', fix: 'Install SIGTERM/SIGINT handlers, and/or run an init as PID 1: <code>docker run --init</code>, or <code>tini</code> in the image (<code>ENTRYPOINT ["/sbin/tini", "--"]</code>). tini also reaps zombie processes, which Node doesn’t.' },
    { trap: 'Shell-form CMD or npm start as the entrypoint', code: `CMD node server.js          # really: /bin/sh -c "node server.js"
CMD ["npm", "start"]        # npm is PID 1, node is its child`, why: 'With the shell form, Docker’s docs note the shell becomes PID 1 and your app doesn’t receive the signals. npm adds another process in the middle whose signal forwarding you don’t control, plus extra memory.', fix: 'Use exec form and start node directly: <code>CMD ["node", "dist/server.js"]</code>, behind tini if you need an init.' },
    { trap: 'Closing the server the instant SIGTERM arrives', why: 'Endpoint removal and SIGTERM happen in parallel. For a few seconds, kube-proxy, the ingress or the cloud LB still send new requests to the pod. If it stopped listening, those requests fail with connection refused / 502.', fix: 'Delay: a <code>preStop</code> hook that sleeps a few seconds (native <code>sleep</code> action in K8s 1.30+, beta and on by default), or keep accepting for a few seconds inside the SIGTERM handler before <code>server.close()</code>.' },
    { trap: 'server.close() waits forever on keep-alive connections', code: `server.close(() => process.exit(0));   // callback never fires?`, why: 'The callback fires only when every connection has closed. Busy keep-alive connections and long-polling or SSE clients can keep the server open past the grace period. (Node 19+ closes <i>idle</i> keep-alive sockets on <code>close()</code>.)', fix: 'Track a deadline: after N seconds call <code>server.closeAllConnections()</code> (Node 18.2+), end SSE/WebSocket clients yourself, then exit. Libraries such as <code>close-with-grace</code> or <code>@godaddy/terminus</code> package this.' },
    { trap: 'Liveness probe that checks the database', code: `app.get('/healthz', async (req, res) => {
  await db.query('select 1');   // DB blip → every pod “dead” → mass restarts
  res.send('ok');
});`, why: 'If the database is slow or down, every pod fails liveness at once and Kubernetes restarts them all, turning a dependency outage into a full outage, and restart storms add load to the struggling database.', fix: 'Liveness: “is this process able to respond at all?” (no dependencies). Readiness: “should I get traffic?” (may check critical dependencies, with care). Use a <code>startupProbe</code> for slow boots instead of a long liveness delay.' },
    { trap: 'process.exit() in the middle of async work', code: `process.on('SIGTERM', async () => {
  server.close();
  process.exit(0);            // pool.end(), log flush, consumer commit: all cut off
});`, why: '<code>process.exit()</code> ends the process synchronously: pending promises, timers, and async log transports are abandoned.', fix: 'Await the cleanup, set <code>process.exitCode</code>, and let the event loop empty. Keep <code>process.exit(1)</code> only for the hard-deadline timer.' }
  ],
  scenarios: [
    { title: 'Each rolling deploy produces a burst of 502s',
      symptom: 'For about 2–5 s per replaced pod, the ingress logs 502s with “connection refused” upstream. The app has a SIGTERM handler that calls <code>server.close()</code>.',
      diagnose: `kubectl get events --field-selector reason=Killing
# compare pod termination timestamps with the 502 timestamps in ingress logs: they line up`,
      cause: 'SIGTERM and endpoint removal start at the same moment. The handler closed the listening socket immediately, while the ingress controller still had the pod in its upstream list for a few seconds.',
      fix: 'Add a short delay before closing: a preStop sleep, or a delay in the handler. Keep the grace period larger than delay + drain time.',
      fixCode: `# deployment.yaml (K8s 1.30+: native sleep action; older: exec ["sleep", "5"])
spec:
  terminationGracePeriodSeconds: 40
  containers:
    - name: api
      lifecycle:
        preStop:
          sleep: { seconds: 5 }`, lang: 'yaml', diagnoseLang: 'bash' },
    { title: 'Deploys take 30 s per pod and the app logs nothing on shutdown',
      symptom: 'Every pod stays in Terminating for exactly 30 s, then exits with code 137. No “shutting down” log line ever appears.',
      diagnose: `kubectl exec api-7d9 -- cat /proc/1/cmdline | tr '\\0' ' '    # /bin/sh -c node server.js
kubectl get pod api-7d9 -o jsonpath='{.status.containerStatuses[0].lastState.terminated.exitCode}'   # 137`,
      cause: 'The Dockerfile used the shell form of CMD. <code>/bin/sh</code> is PID 1, receives SIGTERM, and doesn’t pass it on; Node never knows. After 30 s the kubelet sends SIGKILL.',
      fix: 'Exec-form CMD with node directly, behind tini; verify locally with <code>docker stop</code>, which should finish in about a second.',
      fixCode: `FROM node:22-alpine
RUN apk add --no-cache tini
WORKDIR /app
COPY --chown=node:node . .
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]`, lang: 'docker', diagnoseLang: 'bash' },
    { title: 'All pods restarted at once during a 20-second database failover',
      symptom: 'A managed Postgres failover took 20 s. Instead of a short error spike, the whole API went down for several minutes.',
      cause: 'The liveness probe ran <code>SELECT 1</code>. During the failover every pod failed liveness, Kubernetes restarted all of them, and the cold starts plus reconnection storms prolonged the outage.',
      fix: 'Liveness checks only the process (event loop responsive). Readiness may reflect dependencies. Add connection retry with backoff and jitter.',
      fixCode: `app.get('/livez', (req, res) => res.send('ok'));                 // no I/O
app.get('/readyz', (req, res) => res.status(state.ready ? 200 : 503).send());` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Sending SIGTERM to ourselves with a handler installed. What prints?', code: `const http = require('node:http');
const server = http.createServer((req, res) => res.end('ok'));

process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  server.close(() => console.log('server closed'));
});
process.on('exit', (code) => console.log('exit', code));

server.listen(0, () => {
  console.log('listening');
  process.kill(process.pid, 'SIGTERM');
});`, options: ['listening (then killed by the signal)', 'listening, SIGTERM received, server closed, exit 0', 'listening, SIGTERM received, exit 143', 'SIGTERM received, listening, server closed, exit 0'], answer: 1, explain: 'With a listener installed, SIGTERM no longer terminates the process. The handler runs on the event loop, <code>server.close()</code> stops listening, and with no open connections its callback fires. The loop is then empty, so Node exits normally with code 0.', run: true, expect: 'listening\nSIGTERM received\nserver closed\nexit 0' },
    { kind: 'predict', q: '<code>exitCode</code> vs <code>exit()</code>. What prints?', code: `process.on('exit', (code) => console.log('exit', code));
process.exitCode = 3;
setTimeout(() => console.log('timer'), 10);
console.log('main');`, options: ['main, exit 3', 'main, timer, exit 3', 'exit 3', 'main, timer, exit 0'], answer: 1, explain: 'Setting <code>process.exitCode</code> only chooses the code used <i>when</i> the process exits; pending work still runs. That’s why shutdown code should set <code>exitCode</code> and let the loop drain instead of calling <code>process.exit()</code>.', run: true, expect: 'main\ntimer\nexit 3' },
    { kind: 'predict', q: 'A hard-deadline timer during shutdown. What prints?', code: `const force = setTimeout(() => {
  console.log('forced');
  process.exit(1);
}, 1000);
force.unref();

setTimeout(() => console.log('drained'), 50);   // pretend this is closing the DB pool
process.on('exit', (code) => console.log('exit', code));`, options: ['drained, forced, exit 1', 'drained, exit 0', 'forced, exit 1', 'drained (then waits 1 s), exit 0'], answer: 1, explain: 'An <code>unref()</code>ed timer doesn’t keep the event loop alive. When the real cleanup finishes, nothing else is pending, so the process exits at once with 0. The deadline only fires if cleanup hangs. That’s the standard pattern.', run: true, expect: 'drained\nexit 0' },
    { kind: 'predict', q: '<code>beforeExit</code> can schedule more work. What prints?', code: `let n = 0;
process.on('beforeExit', () => {
  if (n++ < 2) setTimeout(() => console.log('flush', n), 1);
});
process.on('exit', () => console.log('exit'));`, options: ['exit', 'flush 1, exit', 'flush 1, flush 2, exit', 'flush 1, flush 2, flush 3, exit'], answer: 2, explain: '<code>beforeExit</code> fires whenever the loop runs out of work. Scheduling a timer keeps the process alive, and the event fires again when that work is done. On the third call nothing is scheduled, so <code>exit</code> follows. It is <b>not</b> emitted for <code>process.exit()</code> or fatal signals.', run: true, expect: 'flush 1\nflush 2\nexit' },
    { kind: 'concept', q: 'Container started with <code>CMD ["node", "server.js"]</code>, no signal handlers in the app. You run <code>docker stop</code>. What happens?', options: ['Node exits immediately with 143', 'SIGTERM is ignored; after 10 s Docker sends SIGKILL (exit 137)', 'Node prints a warning and exits 0', 'Docker sends SIGINT instead'], answer: 1, explain: 'Node is PID 1. The kernel doesn’t apply the default “terminate” action to PID 1, and Node’s app code installed no handler, so SIGTERM does nothing. With <code>--init</code> (tini as PID 1) the same app would die at once with 143.' },
    { kind: 'concept', q: 'In what order does Kubernetes do things when a pod is deleted?', options: ['SIGTERM → wait → remove from endpoints → SIGKILL', 'Remove from endpoints, and at the same time: preStop → SIGTERM → wait up to the grace period → SIGKILL', 'preStop → remove from endpoints → SIGTERM → SIGKILL', 'SIGKILL immediately unless a PodDisruptionBudget exists'], answer: 1, explain: 'Endpoint removal is asynchronous and runs in parallel with the container stop sequence. That’s why a pod can still receive new requests a few seconds after SIGTERM. The grace period counts from the start, including <code>preStop</code>.' },
    { kind: 'concept', q: 'Your app spawns ImageMagick, which spawns helpers. Node is PID 1. Over days, <code>ps</code> shows hundreds of <code>&lt;defunct&gt;</code> processes. Why?', options: ['A memory leak in Node', 'Orphaned grandchildren are re-parented to PID 1, and Node never calls wait() on them, so the zombies are never reaped', 'ImageMagick bug', 'The container’s cgroup limit'], answer: 1, explain: 'An init process must reap orphans. Node only reaps its own direct children (through child_process). Run <code>tini</code>/<code>dumb-init</code> as PID 1, use <code>docker run --init</code>, or <code>shareProcessNamespace: true</code> so the pause container is PID 1.' }
  ],
  interview: [
    { q: 'Describe a production-grade graceful shutdown for a Node HTTP service on Kubernetes.', a: '<ol><li>Handle SIGTERM (and SIGINT) once.</li><li>Flip readiness to 503 and keep serving for a few seconds (or rely on a preStop sleep) while endpoint removal propagates.</li><li><code>server.close()</code> to stop accepting; close idle keep-alive sockets; tell long-lived clients (SSE/WebSocket) to reconnect.</li><li>Wait for in-flight requests; stop queue consumers and commit offsets.</li><li>Close DB pools, flush logs/traces.</li><li>Exit 0; an <code>unref</code>’d timer forces exit 1 before the grace period ends.</li></ol><p>Container: exec-form CMD, tini as PID 1, grace period &gt; delay + max drain time.</p>', lvl: 'core' },
    { q: 'Why is PID 1 special, and how do you deal with it in containers?', a: '<p>The kernel never applies default actions to signals sent to a namespace’s init: if PID 1 hasn’t installed a handler, SIGTERM and SIGINT are dropped (SIGKILL from outside still works). PID 1 also inherits orphaned processes and must reap them. Node does neither job like an init. Use <code>docker run --init</code> or tini/dumb-init in the image; in Kubernetes add tini, or enable <code>shareProcessNamespace</code>.</p>', lvl: 'deep' },
    { q: 'Liveness vs readiness vs startup probes: what should each check in a Node service?', a: '<ul><li><b>startup</b>: has the app finished booting (migrations, cache warm-up)? Liveness doesn’t start until it passes.</li><li><b>readiness</b>: should it receive traffic now? Fails during shutdown and when the pod is overloaded or can’t reach something it strictly needs.</li><li><b>liveness</b>: is the process wedged? A trivial handler; if the event loop is blocked it naturally times out. Never check shared dependencies here.</li></ul>', fu: 'What timeout would you give liveness? (Generous: a few seconds and several failures, so a GC pause or a burst doesn’t trigger restarts.)', lvl: 'core' },
    { q: 'What does server.close() actually do?', a: '<p>It stops the server from accepting new connections and emits <code>\'close\'</code> (and calls the callback) once all existing connections have ended. It doesn’t abort in-flight requests. Since Node 19 it also closes idle keep-alive connections. For connections that stay busy, use <code>server.closeIdleConnections()</code> / <code>closeAllConnections()</code> (Node 18.2+) after a deadline. Fastify’s <code>app.close()</code> wraps this and runs <code>onClose</code> hooks.</p>', lvl: 'core' },
    { q: 'Why can a pod still get requests after SIGTERM?', a: '<p>Endpoint removal is eventually consistent: the EndpointSlice is updated, then kube-proxy on every node, ingress controllers and cloud load balancers each pick up the change on their own schedule. The kubelet sends SIGTERM without waiting for any of them. So for a few seconds traffic keeps arriving. Keep listening briefly (a preStop sleep or a delay in the handler) before closing.</p>', lvl: 'core' },
    { q: 'How do you shut down a Kafka (or SQS, RabbitMQ) consumer cleanly?', a: '<p>Stop fetching new messages, let in-flight handlers finish (bounded by the deadline), commit offsets or acknowledge what completed, then disconnect so the group rebalances right away rather than waiting for the session timeout. Anything unfinished must be safe to redeliver, which means idempotent handlers.</p>', lvl: 'deep' },
    { q: 'What exit codes would you expect, and what do they tell you?', a: '<p>0: clean exit. 1: an uncaught exception or <code>process.exit(1)</code>. 137 (128+9): SIGKILL, from the grace period running out or the OOM killer (check <code>OOMKilled</code> in the pod status). 143 (128+15): terminated by SIGTERM without a handler (not PID 1). Kubernetes shows these as <code>lastState.terminated.exitCode</code>.</p>', lvl: 'core' },
    { q: 'How does this compare to Spring Boot?', a: '<p>Spring Boot (2.3+) has <code>server.shutdown=graceful</code> (the default since 3.4) with <code>spring.lifecycle.timeout-per-shutdown-phase</code>; the JVM runs shutdown hooks on SIGTERM, and Actuator exposes liveness/readiness groups (<code>/actuator/health/liveness</code>, <code>/readiness</code>). The container issues are the same: a Java process as PID 1 does handle SIGTERM (the JVM installs a handler), but shell-form entrypoints still swallow it.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Shutdown module', lang: 'ts', code: `import type { Server } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';

export function installShutdown(server: Server, deps: { db: { end(): Promise<void> }, consumer?: { stop(): Promise<void> } }, log = console) {
  let state: 'up' | 'draining' = 'up';
  const ready = () => state === 'up';

  async function shutdown(signal: string) {
    if (state !== 'up') return;
    state = 'draining';
    log.info({ signal }, 'shutdown: started');
    const force = setTimeout(() => { log.error('shutdown: deadline hit'); process.exit(1); }, 25_000);
    force.unref();

    await sleep(5_000);                                   // let LBs stop routing (or use preStop)
    await new Promise<void>((resolve) => {
      server.close(() => resolve());                      // stop accepting, wait for in-flight
      server.closeIdleConnections();
    });
    await deps.consumer?.stop();                          // commit offsets, leave the group
    await deps.db.end();                                  // close the pool
    log.info('shutdown: done');
    process.exitCode = 0;                                 // let the loop drain; no process.exit()
  }

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  return { ready };
}

// const health = installShutdown(server, { db: pool });
// app.get('/livez', (req, res) => res.send('ok'));
// app.get('/readyz', (req, res) => res.status(health.ready() ? 200 : 503).end());` },
    { title: 'Dockerfile and probes', lang: 'docker', code: `FROM node:22-alpine
RUN apk add --no-cache tini
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node dist ./dist
USER node
ENTRYPOINT ["/sbin/tini", "--"]          # PID 1: forwards signals, reaps zombies
CMD ["node", "dist/server.js"]           # exec form: no /bin/sh in between

# k8s (excerpt)
# terminationGracePeriodSeconds: 40       # > 5 s delay + 25 s drain deadline
# readinessProbe: { httpGet: { path: /readyz, port: 3000 }, periodSeconds: 5 }
# livenessProbe:  { httpGet: { path: /livez,  port: 3000 }, periodSeconds: 10, timeoutSeconds: 3, failureThreshold: 3 }` },
    { title: 'Spring Boot equivalent', lang: 'yaml', code: `server:
  shutdown: graceful            # default since Boot 3.4
spring:
  lifecycle:
    timeout-per-shutdown-phase: 25s
management:
  endpoint:
    health:
      probes:
        enabled: true           # /actuator/health/liveness and /readiness` }
  ]
});
