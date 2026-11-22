IA.register({
  track: 'kubernetes',
  slug: 'observability',
  title: 'Observability',
  tagline: 'Three signals with three different pipelines. <b>Metrics</b> are pulled (Prometheus scrapes your Pods), <b>logs</b> are tailed from the node’s files, <b>traces</b> are pushed over OTLP. And <code>metrics-server</code> is a fourth, tiny pipeline that only feeds autoscaling.',
  tldr: {
    problem: 'Teams install a stack, then find in the first incident that p99 is averaged across Pods, the crashed Pod’s logs are gone, traces stop at the first hand-written HTTP client, and Prometheus fell over because someone tagged a metric with a customer ID.',
    model: 'Instrument once in the app (Micrometer, OpenTelemetry, JSON to stdout); collect with cluster-level agents (Prometheus via service discovery, a log DaemonSet, an OTel Collector); correlate with shared labels (service, version, Pod) and the <b>trace ID</b>. Alert on <b>golden signals</b>: latency, traffic, errors, saturation.',
    hook: '“Is metrics-server your monitoring?” No. It keeps only the latest CPU and memory values for the HPA and <code>kubectl top</code>. No history, no app metrics, no alerts.',
    facts: [
      { v: '4', l: 'golden signals (Google SRE book): latency, traffic, errors, saturation' },
      { v: 'pull vs push', l: 'Prometheus scrapes <code>/actuator/prometheus</code>; traces and OTLP metrics are pushed to a collector' },
      { v: '1 line = 1 event', l: 'log to stdout as JSON. Multi-line stack traces in plain text are split into many events by line-based agents' }
    ]
  },
  intro: {
    what: '<b>Observability</b> is being able to answer “what is wrong and why?” from the outside. <b>Metrics</b> are numbers over time (requests per second, p99 latency, memory). <b>Logs</b> are individual events with details. <b>Traces</b> follow one request through all the services it touches. In Kubernetes, Pods come and go, so all three must leave the Pod and be stored elsewhere, labelled with where they came from.',
    analogy: { icon: '🚗', title: 'A car’s dashboard, trip log and dashcam', text: 'The dashboard (metrics) shows speed and temperature at a glance and warns you. The trip log (logs) records what happened, line by line. The dashcam (traces) replays one specific journey end to end. You need the warning light to know <i>when</i>, and the recordings to know <i>why</i>.' },
    steps: [
      { t: 'Expose metrics from Spring Boot', d: 'Actuator + Micrometer + the Prometheus registry.', code: '# build.gradle: io.micrometer:micrometer-registry-prometheus\nmanagement:\n  endpoints.web.exposure.include: health,prometheus\n  metrics.tags.application: orders' },
      { t: 'Let Prometheus find the Pods', d: 'With the Prometheus Operator, a ServiceMonitor selects Services by label and scrapes each endpoint.', code: 'kind: ServiceMonitor\nspec:\n  selector: { matchLabels: { app: orders } }\n  endpoints: [{ port: management, path: /actuator/prometheus }]' },
      { t: 'Log to stdout, as JSON', d: 'A node agent collects every container’s output. Spring Boot 3.4+ has structured logging built in.', code: 'logging:\n  structured:\n    format:\n      console: ecs      # or logstash, gelf' },
      { t: 'Add tracing', d: 'The OpenTelemetry Java agent instruments common libraries without code changes and sends spans to a collector.', code: 'JAVA_TOOL_OPTIONS=-javaagent:/otel/opentelemetry-javaagent.jar\nOTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318\nOTEL_SERVICE_NAME=orders', lang: 'bash' }
    ],
    terms: [
      ['metrics-server', 'A small cluster add-on that serves current CPU/memory per Pod and node via the Metrics API, for HPA and <code>kubectl top</code>.'],
      ['Prometheus', 'A time-series database that scrapes (pulls) metrics endpoints and evaluates alert rules.'],
      ['kube-state-metrics', 'Exports the state of Kubernetes objects (replicas, restarts, Pod phases) as metrics.'],
      ['OpenTelemetry (OTel)', 'A vendor-neutral standard and SDKs for traces, metrics and logs, with the OTLP protocol and a Collector.'],
      ['trace ID / span', 'A trace is one request’s journey; each span is one operation in it. The trace ID ties them, and logs, together.'],
      ['cardinality', 'The number of distinct label combinations of a metric. Each one is a separate time series in memory.']
    ]
  },
  visual: {
    title: 'Three pipelines from one Pod',
    caption: 'Pick a signal and press Play (or Step) to follow it from the Pod to where it is stored and used. Moving dashes show data flowing. “Incident” walks through a p99 alert using all three signals together.'
  },
  gotchas: [
    { trap: 'A user ID in a metric tag', code: `// every customer becomes a new time series
Timer.builder("checkout.duration")
     .tag("customerId", customer.id())      // ✗ unbounded
     .register(registry);`, lang: 'java', why: 'Each distinct label set is a separate series held in Prometheus memory and in the app’s registry. A tag with millions of values (user IDs, order IDs, raw URLs, exception messages) can take down Prometheus and bloat the JVM heap.', fix: 'Tags must have a small, bounded set of values (status, method, URI <i>template</i>, outcome). Put IDs in logs and traces. Guard with a <code>MeterFilter</code> (e.g. <code>maximumAllowableTags</code>) and a Prometheus <code>sample_limit</code> per scrape.' },
    { trap: 'Averaging per-Pod p99s', code: `avg(http_server_requests_seconds{quantile="0.99"})   # ✗ meaningless
histogram_quantile(0.99,
  sum by (le) (rate(http_server_requests_seconds_bucket[5m])))   # ✓`, lang: 'text', why: 'Client-side percentiles (Micrometer <code>percentiles: 0.99</code>) are computed inside each Pod and can’t be combined: the average of ten p99s is not the p99 of all requests. One slow Pod disappears in the average.', fix: 'Publish histograms (<code>management.metrics.distribution.percentiles-histogram.http.server.requests: true</code>) and compute quantiles server-side with <code>histogram_quantile</code> over summed buckets.' },
    { trap: 'Treating <code>kubectl top</code> as monitoring', why: 'metrics-server keeps one recent sample per container in memory. It can’t show yesterday, a spike between samples, or app metrics; and its memory figure is the cgroup <i>working set</i>, which includes active page cache, so it differs from the JVM’s own view.', fix: 'Use Prometheus (cAdvisor + kube-state-metrics + app metrics) for dashboards and alerts. Use metrics-server for HPA, VPA and quick checks only.' },
    { trap: '<code>rate()</code> over a window shorter than two scrapes', why: '<code>rate(x[30s])</code> with a 30 s scrape interval often contains only one sample, so it returns nothing and graphs have gaps; alerts flap.', fix: 'Use a range of at least 4× the scrape interval (<code>[2m]</code> for 30 s), or <code>$__rate_interval</code> in Grafana.' },
    { trap: 'Plain-text multi-line stack traces', why: 'Node agents read log files line by line. A 60-line Java stack trace becomes 60 separate events, out of order with other Pods, and impossible to search as one error.', fix: 'Log JSON, one object per line (the stack trace is a field). Spring Boot 3.4+ structured logging or a Logback JSON encoder does this. Add <code>traceId</code> and <code>spanId</code> to every line.' },
    { trap: 'Head sampling throws away the traces you need', why: 'Sampling 5% at the first service is decided before anyone knows whether the request will fail or be slow, so 95% of error traces are dropped.', fix: 'Tail sampling in a gateway OTel Collector: keep 100% of errors and slow traces, a small percentage of the rest. Route spans by trace ID (the load-balancing exporter) so each trace’s spans reach the same collector replica.' },
    { trap: 'Actuator metrics exposed through the public Ingress', why: '<code>/actuator/prometheus</code> and <code>/actuator/env</code> leak internals (versions, hostnames, sometimes configuration) if the app’s only port is routed to the internet.', fix: 'Serve Actuator on a separate <code>management.server.port</code> that only the in-cluster scraper reaches (a NetworkPolicy helps), and expose only <code>health</code> and <code>prometheus</code>.' }
  ],
  scenarios: [
    { title: 'Prometheus ran out of memory the day after a release',
      symptom: 'Prometheus restarts every few minutes with OOMKilled; dashboards and alerts are blind. Its head series count went from 1.2 M to 9 M overnight.',
      diagnoseLang: 'text',
      diagnose: `# Prometheus UI → Status → TSDB Status: top metrics by series count
topk(10, count by (__name__) ({__name__=~".+"}))
#  checkout_duration_seconds_bucket   7,400,000
count(count by (customerId) (checkout_duration_seconds_bucket))
#  310,000 distinct values`,
      cause: 'A developer added <code>customerId</code> as a tag on a timer with a histogram. 310 k customers × ~25 buckets × several Pods and status values = millions of series.',
      fix: 'Remove the tag (put the ID on the span instead), drop the label at scrape time until the app is fixed, and add <code>sample_limit</code> so one target can’t take down Prometheus again.',
      fixCode: `# ServiceMonitor endpoint: protect Prometheus now
endpoints:
- port: management
  path: /actuator/prometheus
  metricRelabelings:
  - action: labeldrop
    regex: customerId
---
# Prometheus CR: fail one scrape instead of the whole server
spec:
  enforcedSampleLimit: 50000` },
    { title: '“p99 is fine” while customers time out',
      symptom: 'Support reports checkout timeouts. The dashboard p99 panel stays at 400 ms. One of twelve Pods runs on a noisy node.',
      diagnoseLang: 'text',
      diagnose: `# panel query
avg(http_server_requests_seconds{uri="/checkout",quantile="0.99"})   # 0.4
# per Pod
max by (pod) (http_server_requests_seconds{uri="/checkout",quantile="0.99"})
#  orders-7c9-x2k   3.8   ← the noisy node
#  (others)         0.15–0.3`,
      cause: 'The app published client-side percentiles, and the panel averaged them across Pods. One Pod’s 3.8 s p99 was diluted into 0.4 s.',
      fix: 'Publish histogram buckets and compute the quantile over the sum. Also alert on per-Pod outliers and on SLO burn rate rather than a single percentile.',
      fixCode: `# application.yaml
management:
  metrics:
    distribution:
      percentiles-histogram:
        http.server.requests: true
      slo:
        http.server.requests: 200ms,500ms,1s,2s
# PromQL
# histogram_quantile(0.99, sum by (le) (rate(http_server_requests_seconds_bucket{uri="/checkout"}[5m])))` },
    { title: 'The logs from the crash are missing',
      symptom: 'A Pod crashed after a burst of errors. <code>kubectl logs --previous</code> shows only the last few seconds, and the log backend has a 4-minute gap right before the crash.',
      diagnoseLang: 'bash',
      diagnose: `kubectl logs orders-7c9-x2k --previous | head -1      # starts mid-burst
# log agent metrics: fluentbit_input_files_rotated_total spiking,
# dropped records > 0 on node-4
# app was logging every failed request at DEBUG with full payloads (~40 MB/min)`,
      cause: 'The container logged far more than usual. The kubelet rotates each container’s log at <code>containerLogMaxSize</code> (10 MiB by default) and keeps <code>containerLogMaxFiles</code> (5); files rotated away before the agent caught up were lost, and the agent’s buffer overflowed.',
      fix: 'Rate-limit or sample repetitive error logs in the app, never log payloads at high volume, and size the agent’s buffer (filesystem buffering) for bursts. Raise the kubelet rotation size only if node disk allows.',
      fixCode: `# logback-spring.xml idea: one summary line per minute instead of one per failure,
# or Spring Boot: logging.level.com.example.client=INFO in production
# Fluent Bit: buffer to disk during bursts
[SERVICE]
    storage.path    /var/fluent-bit/state
[INPUT]
    Name            tail
    Path            /var/log/containers/*.log
    storage.type    filesystem
    Mem_Buf_Limit   50MB`,
      fixLang: 'text' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'An HPA on CPU shows <code>TARGETS &lt;unknown&gt;/70%</code>. metrics-server is healthy and <code>kubectl top pods</code> works. What is the most likely cause?', options: ['The containers have no CPU request, so utilisation can’t be computed', 'Prometheus is down', 'The HPA needs a ServiceMonitor', 'metrics-server keeps no history'], answer: 0, explain: 'Utilisation targets are a percentage of the <b>request</b>. Without a CPU request on every container of the Pod, the HPA reports “missing request for cpu” in its events.' },
    { kind: 'concept', q: 'Ten Pods each report their own p99 latency. Is the average of the ten the service’s p99?', options: ['Yes, if traffic is balanced', 'Yes, with max() instead of avg()', 'No: percentiles can’t be averaged; aggregate histogram buckets and compute the quantile from the sum', 'Only for gauges'], answer: 2, explain: 'Percentiles aren’t additive. Even <code>max()</code> of per-Pod p99s is only a bound. Histograms are additive: sum the buckets, then <code>histogram_quantile</code>.' },
    { kind: 'predict', q: 'The scrape interval is 30 s. What does <code>rate(http_server_requests_seconds_count[30s])</code> usually return?', options: ['A smooth per-second rate', 'The total count', 'An error', 'Often no data: a 30 s window frequently holds fewer than two samples'], answer: 3, explain: '<code>rate()</code> needs at least two samples in the window. Use a window of about 4× the scrape interval.' },
    { kind: 'scenario', q: 'An app writes its logs to <code>/app/logs/orders.log</code> inside the container. Where can you read them?', options: ['<code>kubectl logs</code>', 'Only inside the container (exec/debug), and they vanish with the Pod, unless you add a sidecar or log to stdout', 'The node agent ships them automatically', 'In the Events'], answer: 1, explain: '<code>kubectl logs</code> and node agents read the stdout/stderr files the runtime writes. A file inside the container’s filesystem is invisible to both and also counts against ephemeral storage.' },
    { kind: 'concept', q: 'Which golden signal is <code>hikaricp_connections_pending</code>?', options: ['Latency', 'Traffic', 'Errors', 'Saturation'], answer: 3, explain: 'Saturation is “how full is the most constrained resource”: queue depth, pool usage, CPU throttling. Pending connection requests mean the pool is the bottleneck.' },
    { kind: 'scenario', q: 'You run tail sampling on three OTel Collector replicas behind a normal ClusterIP Service. Error traces are kept only partially. Why?', options: ['Spans of one trace are spread across replicas, so each replica decides on an incomplete trace', 'Tail sampling can’t detect errors', 'OTLP drops spans over gRPC', 'The Java agent samples errors out'], answer: 0, explain: 'Tail sampling must see the whole trace. Put a first tier of collectors with the load-balancing exporter (routing by trace ID) in front of the sampling tier.' },
    { kind: 'concept', q: 'A Pod restarts and its <code>http_server_requests_seconds_count</code> counter starts again from 0. What does <code>rate()</code> do?', options: ['Shows a huge negative spike', 'Returns no data for an hour', 'Double-counts', 'Detects the reset and treats the drop as a restart, so the rate stays correct'], answer: 3, explain: 'Counter functions (<code>rate</code>, <code>increase</code>) assume any decrease is a reset. That is why you publish counters, not pre-computed rates.' }
  ],
  interview: [
    { q: 'What are metrics-server and Prometheus for, and how do they differ?', a: '<p><b>metrics-server</b> scrapes the kubelet’s resource metrics (CPU, memory) roughly every 15 s and serves the latest values through the <code>metrics.k8s.io</code> aggregated API. The HPA, VPA and <code>kubectl top</code> use it. <b>Prometheus</b> is a full time-series database: it scrapes app, cAdvisor, kube-state-metrics and node metrics, stores history and evaluates alert rules. For HPA on custom metrics you add an adapter (Prometheus Adapter or KEDA) that serves <code>custom.metrics.k8s.io</code> / <code>external.metrics.k8s.io</code>.</p>', lvl: 'core' },
    { q: 'What are the golden signals, and which metrics would you use for a Spring Boot service?', a: '<ul><li><b>Latency</b>: <code>http_server_requests_seconds</code> histogram → p50/p99, split successes from errors.</li><li><b>Traffic</b>: <code>rate(http_server_requests_seconds_count[5m])</code>.</li><li><b>Errors</b>: share of <code>status=~"5.."</code> (and business failures).</li><li><b>Saturation</b>: Hikari pending connections, Tomcat busy threads, CPU throttling, heap after GC, Kafka consumer lag.</li></ul><p>RED (rate, errors, duration) for services and USE (utilisation, saturation, errors) for resources are related checklists.</p>', lvl: 'core' },
    { q: 'Describe logging architectures on Kubernetes.', a: '<p><b>Node agent</b> (most common): apps log to stdout, a DaemonSet tails <code>/var/log/pods</code>, enriches with metadata and ships to the backend. <b>Sidecar</b>: a log shipper (or a streaming sidecar that tails a file to its own stdout) next to apps that can only write files; costs a container per Pod. <b>Direct push</b> from the app via an appender: no node agent, but the app blocks or loses logs when the backend is slow. Control-plane and node logs (kubelet, runtime) are collected separately, often from journald.</p>', lvl: 'core' },
    { q: 'How does distributed tracing work across services?', a: '<p>The first service starts a trace (trace ID) and a root span. Each outgoing call carries the context in the W3C <code>traceparent</code> header; the next service continues it with child spans. Spans are exported asynchronously (OTLP) to a collector and assembled by trace ID in the backend. It breaks when a hop doesn’t propagate the header: a custom client, a message queue without header propagation, or async code that loses context.</p>', fu: 'How do you trace through Kafka? (Instrumentation puts the context in record headers; consumers continue or link to the producer’s span.)', lvl: 'core' },
    { q: 'Why is high cardinality dangerous, and how do you prevent it?', a: '<p>Every unique label combination is a separate time series in Prometheus’s head block, roughly a few KB of memory each, plus index entries. Unbounded labels (user IDs, raw paths, error messages) grow series without limit. Prevent it in code review, with Micrometer <code>MeterFilter</code>s, <code>sample_limit</code> per scrape, and by watching <code>prometheus_tsdb_head_series</code>. High-cardinality detail belongs in logs and traces.</p>', lvl: 'deep' },
    { q: 'How do you correlate metrics, logs and traces?', a: '<p>Consistent resource attributes (<code>service.name</code>, version, namespace, Pod) on all three signals; <code>traceId</code>/<code>spanId</code> in every log line via the MDC (Micrometer Tracing and the OTel agent do this); and <b>exemplars</b>: a histogram bucket sample carries a trace ID, so a latency spike on a dashboard links to an example trace.</p>', lvl: 'deep' },
    { q: 'How do you alert well?', a: '<p>Alert on symptoms users feel (error rate, latency against an SLO, availability), preferably with multi-window <b>burn-rate</b> alerts on an error budget. Use cause-based metrics (CPU, restarts, pool usage) on dashboards and for tickets, not pages. Every page should be actionable and link to a runbook.</p>', lvl: 'deep' },
    { q: 'Which container metrics matter for a JVM, and what are the traps?', a: '<p><code>container_memory_working_set_bytes</code> (what the kubelet uses for eviction decisions; includes active page cache) against the limit; <code>container_cpu_cfs_throttled_periods_total</code> / <code>…_periods_total</code> for throttling; restarts and OOM kills from kube-state-metrics. The JVM view comes from Micrometer: <code>jvm_memory_used_bytes</code> by area, GC pause times, threads. The two views don’t match one-to-one: the container also counts native memory and page cache. See <a href="jvm-on-k8s.html">Java/Spring on Kubernetes</a>.</p>', lvl: 'deep' },
    { q: 'How does Prometheus discover targets in Kubernetes?', a: '<p>Kubernetes service discovery: it watches the API for Pods, Services, Endpoints/EndpointSlices or nodes, and relabeling rules turn their metadata into targets and labels. The Prometheus Operator generates that config from <code>ServiceMonitor</code> and <code>PodMonitor</code> resources. Each Pod is scraped individually; scraping through a Service’s virtual IP would hit a random Pod each time.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Spring Boot observability config', lang: 'yaml', code: `# application.yaml (Spring Boot 3.4+)
management:
  server:
    port: 8081                      # not routed by the Ingress
  endpoints:
    web:
      exposure:
        include: health,prometheus
  metrics:
    tags:
      application: \${spring.application.name}
    distribution:
      percentiles-histogram:
        http.server.requests: true  # aggregatable latency
  tracing:
    sampling:
      probability: 1.0              # sample everything; let the collector tail-sample
  otlp:
    tracing:
      endpoint: http://otel-collector.observability:4318/v1/traces
logging:
  structured:
    format:
      console: ecs                  # JSON lines with traceId/spanId from the MDC` },
    { title: 'ServiceMonitor and Service', lang: 'yaml', code: `apiVersion: v1
kind: Service
metadata:
  name: orders
  labels: { app: orders }
spec:
  selector: { app: orders }
  ports:
  - { name: http, port: 80, targetPort: 8080 }
  - { name: management, port: 8081, targetPort: 8081 }
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: orders
  labels: { release: kube-prometheus-stack }   # must match the Prometheus selector
spec:
  selector: { matchLabels: { app: orders } }
  endpoints:
  - port: management
    path: /actuator/prometheus
    interval: 30s` },
    { title: 'Golden-signal PromQL', lang: 'text', code: `# traffic (requests per second)
sum(rate(http_server_requests_seconds_count{application="orders"}[2m]))

# errors (share of 5xx)
sum(rate(http_server_requests_seconds_count{application="orders",status=~"5.."}[5m]))
  / sum(rate(http_server_requests_seconds_count{application="orders"}[5m]))

# latency (p99 from histogram buckets)
histogram_quantile(0.99,
  sum by (le) (rate(http_server_requests_seconds_bucket{application="orders"}[5m])))

# saturation: DB pool and CPU throttling
max by (pod) (hikaricp_connections_pending{application="orders"})
sum by (pod) (rate(container_cpu_cfs_throttled_periods_total{container="app"}[5m]))
  / sum by (pod) (rate(container_cpu_cfs_periods_total{container="app"}[5m]))` },
    { title: 'Low-cardinality custom metrics', lang: 'java', code: `@Component
class CheckoutMetrics {
    private final MeterRegistry registry;
    CheckoutMetrics(MeterRegistry registry) { this.registry = registry; }

    void record(Duration d, PaymentMethod method, Outcome outcome) {
        Timer.builder("checkout.duration")
             .tag("method", method.name())        // ~5 values
             .tag("outcome", outcome.name())      // success|declined|error
             .publishPercentileHistogram()
             .register(registry)
             .record(d);
        // customer id → on the current span / in the log line, never a tag
        Span.current().setAttribute("customer.id", CurrentCustomer.id());
    }
}

@Bean
MeterFilter capUriTags() {   // safety net against path explosions
    return MeterFilter.maximumAllowableTags("http.server.requests", "uri", 200, MeterFilter.deny());
}` }
  ]
});
