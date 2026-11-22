IA.register({
  track: 'nodejs',
  slug: 'http-internals',
  title: 'HTTP internals: sockets, agents & timeouts',
  tagline: 'Under every <code>fetch</code> and every Express route there is a <b>TCP socket</b> that is opened, reused, left idle and eventually closed by <i>someone</i>. Most “random” 502s, <code>ECONNRESET</code>s and <code>socket hang up</code>s come from two sides disagreeing about who closes an idle socket, and when.',
  tldr: {
    problem: 'A Node service behind a load balancer returns a trickle of 502s that nobody can reproduce locally. An outbound client exhausts ports or leaks sockets. A slow upload ties up the server. These are socket-lifecycle bugs, not code bugs.',
    model: '<b>Client side</b>: an <code>http.Agent</code> (or undici for <code>fetch</code>) keeps a pool of sockets per origin; a finished request returns its socket to the free list for reuse. <b>Server side</b>: Node closes an idle keep-alive socket after <code>keepAliveTimeout</code> (5 s), gives a client <code>headersTimeout</code> (60 s) to send headers and <code>requestTimeout</code> (300 s) for the whole request. <b>Rule</b>: the side that closes idle sockets must be the one that <i>doesn’t</i> send the next request, so the upstream’s idle timeout must be longer than the downstream’s.',
    hook: '“Our ALB returns sporadic 502s from a healthy Node service. Why?” The ALB keeps idle connections for 60 s, Node closes them after 5 s, and occasionally the ALB sends a request on a socket Node is closing at that moment. Fix: <code>server.keepAliveTimeout</code> &gt; the LB idle timeout.',
    facts: [
      { v: '5 s', l: 'Node’s default <code>server.keepAliveTimeout</code>. AWS ALB’s default idle timeout is 60 s' },
      { v: 'Node 19', l: 'made <code>http.globalAgent</code> use keep-alive by default (earlier versions opened a new connection per request)' },
      { v: 'Node 21', l: 'marked the global <code>fetch</code> (built on undici) stable; it was enabled by default as experimental since Node 18' }
    ]
  },
  intro: {
    what: 'HTTP/1.1 sends one request at a time over a TCP connection (a <b>socket</b>). Opening a socket costs a network round trip, plus more for TLS, so clients <b>keep it alive</b> and reuse it for the next request. An <b>agent</b> is the client-side pool that manages those sockets. Because an idle socket uses memory on both ends, both sides also have <b>timeouts</b> that close it. HTTP/2 goes further and runs many requests at once over a single connection.',
    analogy: { icon: '🚕', title: 'A taxi rank', text: 'Your app is a hotel; the agent is its taxi rank. Instead of ordering a new taxi (TCP + TLS handshake) for every guest, a taxi that drops someone off comes back to the rank. Each driver goes home after waiting idle for a while (keep-alive timeout). The trouble starts when the doorman puts a guest into a taxi at the exact moment its driver decides to go home.' },
    steps: [
      { t: 'One request, one socket at a time', d: 'In HTTP/1.1 a socket carries one request/response exchange at a time. Parallel requests need parallel sockets.' },
      { t: 'Keep-alive reuses sockets', d: 'The response says <code>Connection: keep-alive</code> and the socket goes back to the agent’s free list.', code: "import { Agent } from 'node:http';\nconst agent = new Agent({ keepAlive: true, maxSockets: 50 });" },
      { t: 'Both sides time out idle sockets', d: 'Node’s server closes idle sockets after <code>keepAliveTimeout</code>. Load balancers and clients have their own idle timeouts.' },
      { t: 'fetch uses its own pool', d: '<code>fetch</code> in Node is undici. It ignores <code>http.Agent</code>; configure it with an undici <code>Agent</code> dispatcher, and always set a timeout.', code: "const res = await fetch(url, { signal: AbortSignal.timeout(2000) });" }
    ],
    terms: [
      ['socket', 'One TCP connection between a client and a server.'],
      ['keep-alive', 'Reusing a socket for several requests instead of closing it after one.'],
      ['agent / dispatcher', 'The client-side pool that opens, reuses and closes sockets per origin.'],
      ['idle timeout', 'How long a side keeps an unused socket open before closing it.'],
      ['ECONNRESET / socket hang up', 'The other side closed or reset the socket while you were using it.'],
      ['HTTP/2 stream', 'One request/response inside a shared HTTP/2 connection; many can run at once.']
    ]
  },
  visual: {
    title: 'Socket timelines',
    caption: 'Pick a scenario and press Play or Step. Each row is a socket over time: <b>hatched</b> = handshake, <b>solid</b> = a request in flight, <b>pale</b> = idle in a pool, red marks = closes and errors. Compare “Node closes first” with “LB closes first”.'
  },
  gotchas: [
    { trap: 'keepAliveTimeout shorter than the load balancer’s idle timeout', code: `const server = app.listen(3000);
// default server.keepAliveTimeout = 5000; ALB idle timeout = 60 s → sporadic 502s`, why: 'The LB reuses an idle connection Node is closing at the same instant. The request lands on a socket that gets a FIN/RST, and the LB answers the client with 502. It’s rare per request and constant at scale.', fix: 'Make Node’s idle timeout longer than the LB’s: <code>server.keepAliveTimeout = 65_000</code>. Older advice also sets <code>headersTimeout</code> a little above it; keep <code>headersTimeout ≤ requestTimeout</code>.' },
    { trap: 'Thinking keepAliveMsecs is the idle timeout', code: `new http.Agent({ keepAlive: true, keepAliveMsecs: 30_000 })   // not what it looks like`, why: '<code>keepAliveMsecs</code> is the initial delay for <b>TCP keep-alive probes</b> (SO_KEEPALIVE) on the socket. It doesn’t decide how long an idle socket stays in the pool.', fix: 'Use the agent’s <code>timeout</code> option (socket inactivity) and keep the client’s idle time below the server’s <code>keepAliveTimeout</code> so the client retires sockets first.' },
    { trap: 'Unbounded agents', why: '<code>maxSockets</code> defaults to <code>Infinity</code>. A burst of 5,000 concurrent calls opens 5,000 sockets to one upstream: ephemeral port exhaustion, TIME_WAIT piles, or a melted dependency.', fix: 'Set <code>maxSockets</code> (or undici <code>connections</code>) per upstream, and put a concurrency limit in front of slow dependencies.' },
    { trap: 'fetch without a timeout, or without reading the body', code: `const res = await fetch(url);          // undici default: 300 s headers / body timeouts
if (!res.ok) throw new Error(res.status);   // body never read`, why: 'An unread body keeps the connection busy until garbage collection gets to it, so the pool runs dry under load. And a hung upstream holds your request for minutes.', fix: '<code>fetch(url, { signal: AbortSignal.timeout(2000) })</code>, and on every path either consume the body or <code>await res.body?.cancel()</code>. Note that <code>fetch</code> doesn’t reject on 4xx/5xx.' },
    { trap: 'Setting http.Agent options and expecting fetch to use them', why: 'Global <code>fetch</code> is undici and never looks at <code>http.globalAgent</code>. Proxies, pool sizes and keep-alive settings for <code>http.request</code> don’t apply to it.', fix: 'Install the <code>undici</code> package and call <code>setGlobalDispatcher(new Agent({ … }))</code>, or pass <code>dispatcher</code> per call.' },
    { trap: 'requestTimeout = 0 to “support big uploads”', why: 'Since Node 18 the server defaults protect against slowloris: 60 s to receive headers, 300 s for the whole request. Setting them to 0 removes that protection for every route.', fix: 'Stream uploads straight to storage, and if one route needs longer, raise the limit at the proxy and server deliberately, not to 0. The checks run every <code>connectionsCheckingInterval</code> (30 s), so they are approximate.' }
  ],
  scenarios: [
    { title: '0.1% 502s from the ALB, no errors in the app logs',
      symptom: 'ALB metrics show <code>HTTPCode_ELB_502_Count</code> spikes that track traffic. The Node app never logs those requests.',
      diagnose: `# ALB access logs: the 502s have target_status_code "-" (the target never answered)
# and the target connection was idle just over 5 s before the request
node -e "console.log(require('http').createServer().keepAliveTimeout)"   # 5000`,
      cause: 'The ALB’s idle timeout is 60 s; Node’s keep-alive timeout is 5 s. Node closes idle connections that the ALB still considers reusable. When the ALB picks one in the closing instant, it gets a reset and reports 502.',
      fix: 'Set Node’s timeout above the LB’s, so the LB always closes first.',
      fixCode: `const server = app.listen(3000);
server.keepAliveTimeout = 65_000;   // > ALB idle timeout (60 s)
server.headersTimeout = 66_000;     // older advice; must stay <= requestTimeout (300 s)` },
    { title: 'Intermittent “socket hang up” calling an internal API',
      symptom: 'About one call in a few thousand to an internal Node API fails with <code>ECONNRESET</code>, mostly after quiet periods. Retrying succeeds immediately.',
      diagnose: `// client: http.Agent({ keepAlive: true }) — no timeout, sockets idle indefinitely
// server: Node default keepAliveTimeout 5 s`,
      cause: 'The mirror image of the 502 case: now the <b>client</b> reuses an idle socket at the moment the <b>server</b> closes it. The client is the one sending, so its idle limit has to be the shorter one.',
      fix: 'Give the client an idle timeout below the server’s (or use undici, which also honours the server’s <code>Keep-Alive: timeout=</code> hint), and retry idempotent requests once on <code>ECONNRESET</code>.',
      fixCode: `import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new Agent({
  keepAliveTimeout: 4_000,        // below the server's 5 s
  connections: 50,                // per origin
  headersTimeout: 5_000, bodyTimeout: 10_000
}));` },
    { title: 'Event loop is fine, yet latency climbs under load',
      symptom: 'p99 latency to a payment provider rises with traffic; CPU and event-loop lag stay normal.',
      diagnose: `// count queued vs active requests in the agent
setInterval(() => {
  const q = Object.values(agent.requests).reduce((n, a) => n + a.length, 0);
  const s = Object.values(agent.sockets).reduce((n, a) => n + a.length, 0);
  log.info({ queued: q, active: s }, 'agent');
}, 5000).unref();`,
      cause: 'Someone set <code>maxSockets: 10</code> years ago. At peak, requests wait in <code>agent.requests</code> for a free socket, which looks like the provider being slow.',
      fix: 'Size the pool from measured concurrency (Little’s law: rate × latency), export queue depth as a metric, and alert on it.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Node 22 server defaults. What prints?', code: `const http = require('node:http');
const s = http.createServer();
console.log(s.keepAliveTimeout, s.headersTimeout, s.requestTimeout, s.timeout);`, options: ['5000 60000 300000 0', '5000 40000 0 120000', '60000 60000 300000 0', '5000 60000 0 0'], answer: 0, explain: 'Node 18 changed <code>requestTimeout</code> to 300 s and <code>headersTimeout</code> to 60 s (slowloris protection). <code>server.timeout</code> (socket inactivity) has been 0, meaning none, since Node 13. <code>keepAliveTimeout</code> is still 5 s.', run: true, expect: '5000 60000 300000 0' },
    { kind: 'predict', q: 'The global agent in Node 22. What prints?', code: `const http = require('node:http');
const a = http.globalAgent;
console.log(a.keepAlive, a.maxSockets, a.maxFreeSockets, a.scheduling);`, options: ['false Infinity 256 fifo', 'true Infinity 256 lifo', 'true 10 256 lifo', 'false 5 5 fifo'], answer: 1, explain: 'Since Node 19 the global agents use keep-alive. <code>maxSockets</code> is unbounded by default, up to 256 idle sockets per origin are kept, and the most recently used free socket is reused first (<code>lifo</code>), which lets surplus sockets age out.', run: true, expect: 'true Infinity 256 lifo' },
    { kind: 'predict', q: 'What does the server advertise?', code: `const http = require('node:http');
const server = http.createServer((req, res) => res.end('ok'));
server.keepAliveTimeout = 7000;

server.listen(0, () => {
  const agent = new http.Agent({ keepAlive: true });
  http.get({ port: server.address().port, agent }, (res) => {
    console.log(res.headers.connection, res.headers['keep-alive']);
    res.resume();
    res.on('end', () => { agent.destroy(); server.close(); });
  });
});`, options: ['keep-alive timeout=7', 'keep-alive undefined', 'close undefined', 'keep-alive timeout=7000'], answer: 0, explain: 'For a keep-alive request Node replies <code>Connection: keep-alive</code> and a <code>Keep-Alive: timeout=N</code> hint in <b>seconds</b>. Clients such as undici use the hint to retire the socket before the server closes it.', run: true, expect: 'keep-alive timeout=7' },
    { kind: 'predict', q: 'Three sequential requests, two agents. How many TCP connections does the server see?', code: `const http = require('node:http');
const server = http.createServer((req, res) => res.end('ok'));
let conns = 0;
server.on('connection', () => conns++);

const get = (port, agent) => new Promise((resolve) =>
  http.get({ port, agent }, (res) => { res.resume(); res.on('end', resolve); }));
const pause = () => new Promise((r) => setImmediate(r));

server.listen(0, async () => {
  const port = server.address().port;
  const ka = new http.Agent({ keepAlive: true });
  for (let i = 0; i < 3; i++) { await get(port, ka); await pause(); }
  console.log('keep-alive agent:', conns);
  conns = 0;
  for (let i = 0; i < 3; i++) { await get(port, false); await pause(); }
  console.log('agent false:', conns);
  ka.destroy(); server.close();
});`, options: ['3 and 3', '1 and 3', '1 and 1', '3 and 1'], answer: 1, explain: 'With a keep-alive agent the socket returns to the free list after each response and is reused: <b>1</b> connection. <code>agent: false</code> sends <code>Connection: close</code>, so every request pays a new TCP handshake: <b>3</b>. With TLS the difference is much larger.', run: true, expect: 'keep-alive agent: 1\nagent false: 3' },
    { kind: 'predict', q: '<code>fetch</code> and a 404. What prints?', code: `const http = require('node:http');
const server = http.createServer((req, res) => { res.statusCode = 404; res.end('not found'); });

server.listen(0, async () => {
  try {
    const r = await fetch(\`http://127.0.0.1:\${server.address().port}/x\`);
    console.log(r.ok, r.status, await r.text());
  } catch (e) {
    console.log('rejected', e.message);
  } finally {
    server.close();
  }
});`, options: ['rejected Not Found', 'false 404 not found', 'true 404 not found', 'rejected fetch failed'], answer: 1, explain: '<code>fetch</code> only rejects on network errors, aborts and timeouts. An HTTP error status resolves normally with <code>ok: false</code>. Reading the body (<code>text()</code>) also releases the connection back to undici’s pool.', run: true, expect: 'false 404 not found' },
    { kind: 'concept', q: 'Node <code>keepAliveTimeout</code> = 65 s, ALB idle timeout = 60 s. Who closes an idle connection, and is there a race?', options: ['Node, at 65 s; races are possible', 'The ALB, at 60 s; it never sends on a socket it’s closing itself, so no race', 'Both at 60 s', 'Nobody: keep-alive sockets never close'], answer: 1, explain: 'The side that sends the next request must be the side that closes idle sockets. With the ALB’s timeout shorter, it retires the socket itself and never reuses one Node is closing. The same rule applies to any client/server pair.' },
    { kind: 'concept', q: 'An HTTP/2 connection carries 50 concurrent streams. One TCP packet is lost. What happens?', options: ['Only the stream that owned the packet waits', 'All streams on that connection wait for the retransmission (TCP head-of-line blocking)', 'The connection falls back to HTTP/1.1', 'Nothing: HTTP/2 has its own retransmission'], answer: 1, explain: 'HTTP/2 removes HTTP-level head-of-line blocking (no waiting behind a slow <i>response</i>), but TCP delivers bytes in order, so a lost packet stalls every stream. HTTP/3 over QUIC fixes this; Node 22 has no built-in HTTP/3.' }
  ],
  interview: [
    { q: 'Explain the keep-alive race behind sporadic 502s.', a: '<p>An idle keep-alive socket can be closed by either side. If the server closes it at the same moment the client (an LB, a proxy, an agent) sends a new request on it, the request hits a socket that’s being torn down and gets an RST: the LB reports 502, a Node client reports <code>ECONNRESET</code>. Fix it with ordering: the downstream (server) idle timeout must be longer than the upstream (client) one, so the client always retires the socket first. Retry idempotent requests once.</p>', fu: 'Why does it get worse with more pods? (More connections, more idle closes per second, more chances to collide.)', lvl: 'core' },
    { q: 'What are Node’s HTTP server timeouts, and what does each protect against?', a: '<ul><li><code>headersTimeout</code> (60 s): time to receive the full request headers. Slowloris protection.</li><li><code>requestTimeout</code> (300 s, Node 18+): time to receive the whole request, body included.</li><li><code>keepAliveTimeout</code> (5 s): how long an idle keep-alive socket waits for the next request.</li><li><code>timeout</code> (0 = off): socket inactivity at any point.</li><li><code>maxRequestsPerSocket</code> (0 = unlimited): close a socket after N requests, which helps rebalance long-lived connections.</li></ul><p>The header and request checks run every <code>connectionsCheckingInterval</code> (30 s), so they fire late rather than exactly on time. None of them limits how long <i>your handler</i> takes; that’s your job (timeouts, AbortSignal).</p>', lvl: 'deep' },
    { q: 'What does http.Agent do, and which options matter?', a: '<p>It pools sockets per origin (host:port plus TLS options). <code>keepAlive</code> keeps finished sockets in a free list; <code>maxSockets</code> caps active sockets per origin (default Infinity), extra requests queue in <code>agent.requests</code>; <code>maxFreeSockets</code> (256) caps idle ones; <code>timeout</code> destroys inactive sockets; <code>scheduling</code> (<code>lifo</code> by default) picks the most recently used free socket. <code>keepAliveMsecs</code> is only the TCP keep-alive probe delay.</p>', lvl: 'core' },
    { q: 'How is fetch in Node different from http.request?', a: '<p><code>fetch</code> is implemented by undici, a separate HTTP/1.1 client written from scratch, with its own connection pools (dispatchers). It doesn’t use <code>http.Agent</code>, returns web-standard <code>Response</code> and streams, resolves on any HTTP status, and has default headers/body timeouts of 300 s. For hot paths undici’s own <code>request()</code> API has less overhead than <code>fetch</code>.</p>', fu: 'How do you set a proxy for fetch? (Pass an undici <code>ProxyAgent</code> as the dispatcher.)', lvl: 'core' },
    { q: 'How do you put timeouts on an outbound call properly?', a: '<p>Use an overall deadline with <code>AbortSignal.timeout(ms)</code> (combine with the caller’s signal through <code>AbortSignal.any([…])</code>), plus connect/headers/body timeouts on the dispatcher. On abort, undici destroys the request, so the work really stops. Propagate the remaining budget to downstream calls instead of a fixed timeout per hop. See <a href="async-errors.html">Async error handling</a>.</p>', lvl: 'core' },
    { q: 'What does HTTP/2 change, and when would you use it from Node?', a: '<p>One TCP connection carries many concurrent streams, with binary framing, HPACK header compression and per-stream flow control. It avoids opening many sockets and avoids HTTP-level head-of-line blocking. In Node use <code>node:http2</code> (Fastify supports <code>http2: true</code>; Express doesn’t support it natively). Browsers only speak h2 over TLS (negotiated with ALPN). Typical server-side uses: gRPC, and a single multiplexed connection to an upstream. Behind most load balancers, the LB-to-pod leg is still HTTP/1.1.</p>', lvl: 'deep' },
    { q: 'What was HTTP/2 “Rapid Reset”?', a: '<p>CVE-2023-44487 (October 2023): clients open streams and immediately cancel them with RST_STREAM, so the server does work for requests that never count against the concurrent-stream limit. Many servers were affected, Node included, and Node shipped patched releases. Lesson: an exposed HTTP/2 endpoint needs current patches and stream rate limits, usually at the edge.</p>', lvl: 'deep' },
    { q: 'How do long-lived keep-alive connections affect load balancing in Kubernetes?', a: '<p>A connection is balanced once, when it opens. With keep-alive (and even more with HTTP/2), a client sticks to the pods it connected to first; new pods from a scale-up get little traffic. Mitigations: <code>maxRequestsPerSocket</code> or a max connection age on the server, an L7 proxy or service mesh that balances per request, or client-side balancing for gRPC.</p>', lvl: 'deep' },
    { q: 'Java comparison: what are the equivalents in Spring?', a: '<p>Tomcat’s <code>keepAliveTimeout</code> and <code>connectionTimeout</code> (Spring Boot: <code>server.tomcat.keep-alive-timeout</code>, <code>server.tomcat.connection-timeout</code>) play the roles of <code>keepAliveTimeout</code> and <code>headersTimeout</code>. On the client, Apache HttpClient’s <code>PoolingHttpClientConnectionManager</code> (max per route, evict idle connections) is the http.Agent. The same LB rule applies to Java services.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Server timeouts behind a load balancer', lang: 'ts', code: `import { createServer } from 'node:http';

const server = createServer(app);
server.keepAliveTimeout = 65_000;   // > LB idle timeout (ALB default 60 s)
server.headersTimeout = 66_000;     // keep <= requestTimeout
server.requestTimeout = 120_000;    // whole request; default 300 s
server.maxRequestsPerSocket = 1000; // spread long-lived clients over new pods

server.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');` },
    { title: 'Outbound calls with undici', lang: 'ts', code: `import { Agent, setGlobalDispatcher, request } from 'undici';

setGlobalDispatcher(new Agent({
  connections: 64,            // per origin
  keepAliveTimeout: 4_000,    // shorter than the upstream's keep-alive timeout
  connect: { timeout: 2_000 },
  headersTimeout: 5_000,
  bodyTimeout: 10_000,
}));

export async function getQuote(id: string, signal?: AbortSignal) {
  const res = await fetch(\`https://pricing.internal/quotes/\${id}\`, {
    signal: AbortSignal.any([AbortSignal.timeout(3_000), ...(signal ? [signal] : [])]),
  });
  if (!res.ok) { await res.body?.cancel(); throw new Error(\`pricing \${res.status}\`); }
  return res.json();
}

// hot path: undici.request has less overhead than fetch
const { statusCode, body } = await request('http://inventory.internal/stock/42');
const stock = await body.json();` },
    { title: 'Spring Boot equivalents', lang: 'yaml', code: `# application.yml — the same rule: the app's idle timeout > the LB's
server:
  tomcat:
    keep-alive-timeout: 65s
    connection-timeout: 20s       # time to receive the request line/headers
    max-keep-alive-requests: 1000
# outbound: RestClient/WebClient with a pooled connection manager,
# max connections per route and idle eviction below the upstream's timeout` }
  ]
});
