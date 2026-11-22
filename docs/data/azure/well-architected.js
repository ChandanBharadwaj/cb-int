IA.register({
  track: 'azure',
  slug: 'well-architected',
  title: 'Well-Architected & reliability',
  tagline: 'The Azure Well-Architected Framework names <b>five pillars</b>: Reliability, Security, Cost Optimization, Operational Excellence and Performance Efficiency. Every design decision trades between them. Reliability in practice is a handful of patterns (<b>timeouts, retries with backoff and jitter, circuit breakers, bulkheads, idempotency</b>) plus a disaster-recovery plan with explicit <b>RTO</b> and <b>RPO</b> that you have actually tested.',
  tldr: {
    problem: 'A 30-second database blip that becomes a 20-minute outage because every layer retries at once; a DR plan that fails because the backup region can’t pull container images; duplicate orders after a timeout; and “five nines” promised on top of components that add up to less.',
    model: '<b>Fail fast</b> (timeouts) → <b>retry a little</b> (backoff + jitter, idempotent operations only, one layer) → <b>stop calling</b> a sick dependency (circuit breaker, with a fallback) → <b>isolate</b> it (bulkhead) → <b>survive a zone</b> (zone redundancy) → <b>survive a region</b> (failover with a known RTO and RPO).',
    hook: '“How would you make this service survive a regional outage?” State the RTO and RPO the business needs first, then choose the pattern that meets them (backup-restore, pilot light, warm standby, active-active), and explain how you would test it.',
    facts: [
      { v: '5 pillars', l: 'Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency. Most design reviews are about trade-offs between them' },
      { v: 'RTO / RPO', l: 'RTO = how long you may be down; RPO = how much recent data you may lose. Asynchronous replication means RPO &gt; 0' },
      { v: '(1+r)ⁿ', l: 'attempts reach the bottom of n stacked layers that each retry r times: 3 layers × 3 retries = 4³ = 64 calls for one user request' }
    ]
  },
  intro: {
    what: 'The <b>Well-Architected Framework</b> (WAF) is Microsoft’s checklist and vocabulary for good cloud design. Its <b>reliability</b> pillar asks: what happens when something fails? Some failures are small and short (a slow database for 30 seconds), some are big (a zone or a region down). You handle small ones in code with patterns, and big ones with redundancy and a <b>disaster-recovery</b> plan measured by <b>RTO</b> (time to recover) and <b>RPO</b> (data you can afford to lose).',
    analogy: { icon: '⚡', title: 'Fuses, spare tyres and an evacuation plan', text: 'A timeout is a fuse: it blows quickly instead of letting the wire melt. A circuit breaker is the breaker panel that cuts a faulty circuit until someone checks it. Zone redundancy is a spare tyre. Disaster recovery is the evacuation plan: useless unless you run the drill.' },
    steps: [
      { t: 'Name the targets', d: 'Per business flow: availability target, RTO and RPO. “Checkout: 99.9%, RTO 1 hour, RPO 5 minutes” drives very different choices from “reporting: RTO 1 day”.' },
      { t: 'Handle transient faults in code', d: 'Timeouts on every call, retries with exponential backoff and jitter for idempotent operations, a circuit breaker per dependency.' },
      { t: 'Remove single points of failure', d: 'Zone-redundant compute and data (App Service, Container Apps, AKS, Postgres HA, ZRS storage). See <a href="regions-zones.html">Regions & zones</a>.' },
      { t: 'Plan and test regional recovery', d: 'Replicas or backups in a second region, IaC that can rebuild everything, a traffic switch (Front Door), and a scheduled drill.' }
    ],
    terms: [
      ['RTO', 'Recovery time objective: the maximum acceptable time to restore service after a disaster.'],
      ['RPO', 'Recovery point objective: the maximum acceptable data loss, measured in time before the failure.'],
      ['circuit breaker', 'Stops calling a failing dependency for a while (open), then tests it with a few calls (half-open) before resuming (closed).'],
      ['bulkhead', 'Separate pools (threads, connections) per dependency, so one slow dependency can’t use up everything.'],
      ['idempotent', 'Safe to repeat: doing it twice has the same effect as once.'],
      ['composite SLA', 'The availability of a chain of components, roughly the product of their SLAs.']
    ]
  },
  visual: {
    title: 'Reliability patterns, simulated',
    caption: '<b>Retries</b>: a dependency goes down for a few seconds. Compare no retries, immediate retries (a retry storm), and backoff with jitter. Bars show attempts per tick; red is failed. <b>Circuit breaker</b>: watch closed → open → half-open → closed. <b>Regional failover</b>: see RPO (lost writes) and RTO (downtime) appear on the timeline. Numbers are illustrative.'
  },
  gotchas: [
    { trap: 'Retries at every layer', why: 'The browser retries, the gateway retries, the Spring service retries with Resilience4j, and the Azure SDK retries underneath. Each layer multiplies the next: three layers of three retries is up to 64 calls for one click, exactly when the dependency is weakest.', fix: 'Retry in <b>one</b> layer (usually the one closest to the failing call), with a small attempt count, exponential backoff and jitter, and a retry budget. Configure SDK retry options deliberately instead of stacking more.' },
    { trap: 'Retrying writes that aren’t idempotent', code: `// ✗ timeout after the payment provider charged the card → retry charges again
paymentClient.charge(order.total());

// ✓ an idempotency key the provider (or your own table) deduplicates on
paymentClient.charge(order.total(), "order-" + order.id());`, lang: 'java', why: 'A timeout tells you nothing about whether the other side did the work. Retrying a POST can create a second order or a second charge.', fix: 'Use idempotency keys (a unique constraint in Postgres on <code>request_id</code>, or the provider’s idempotency header), and only auto-retry operations that are safe to repeat.' },
    { trap: 'No timeout means waiting forever', why: 'Several HTTP and JDBC clients default to no read timeout or a very long one. A slow dependency then holds threads and pool connections until the service itself stops answering, and failure spreads upstream.', fix: 'Set connect and read timeouts on every client (Hikari <code>connectionTimeout</code>, JDBC socket timeout, <code>RestClient</code> request factory timeouts), shorter than the caller’s timeout, and make the end-to-end budget explicit.' },
    { trap: 'Zone redundancy treated as disaster recovery', why: 'Zones protect against a datacenter failure inside one region. They don’t protect against a regional outage, a bad deployment, or data corruption, which replicate to every zone instantly.', fix: 'Combine zone redundancy (high availability) with backups and point-in-time restore (corruption), and a second region where the RTO/RPO requires it.' },
    { trap: 'A DR region that depends on the primary', why: 'The standby app pulls images from a registry in the primary region, reads secrets from a Key Vault there, or uses a private DNS zone linked only to the primary VNet. When the primary is down, so is the “backup”.', fix: 'List every dependency of the secondary and make each one regional or replicated: geo-replicated ACR, a Key Vault per region, DNS zones linked to both VNets, IaC that deploys the secondary from scratch.' },
    { trap: 'RPO assumed to be zero', why: 'Cross-region replication for Postgres read replicas, geo-redundant storage and most databases is <b>asynchronous</b>. Anything written in the last seconds or minutes before a regional failure may be lost on failover.', fix: 'Measure replication lag (and alert on it), state the real RPO, and design the business process for it: reconcile from payment-provider records or an event log after failover.' },
    { trap: 'A DR plan that has never run', why: 'Untested runbooks fail on details: expired credentials, quotas in the secondary region, a manual step nobody remembers, DNS TTLs longer than the RTO.', fix: 'Run a failover drill on a schedule (game days), measure the real RTO and RPO, use Azure Chaos Studio for fault injection, and fix what the drill finds.' }
  ],
  scenarios: [
    { title: 'A 30-second database blip became a 20-minute outage',
      symptom: 'Postgres had a 30-second failover during maintenance. The orders API stayed at 100% errors for 20 minutes after the database was back.',
      diagnose: `AppDependencies
| where TimeGenerated between (datetime(2026-03-04 02:00) .. 30m) and AppRoleName == "orders-api"
| summarize attempts = sum(ItemCount), failed = sumif(ItemCount, Success == false) by bin(TimeGenerated, 1m), Type
| render timechart`,
      diagnoseLang: 'kql',
      cause: 'Every layer retried immediately: the SPA, the API gateway, a Spring Retry template and the JDBC driver’s reconnect. When the database returned, it received several times its normal load, connection storms exhausted <code>max_connections</code>, and the retries kept it saturated (a metastable failure).',
      fix: 'Remove retries from all but one layer, add exponential backoff with jitter and a retry budget, put a circuit breaker around the database-backed calls, cap Hikari’s pool size, and use PgBouncer. Test with a forced failover.',
      fixCode: `resilience4j.circuitbreaker.instances.orders-db.failure-rate-threshold=50
resilience4j.circuitbreaker.instances.orders-db.wait-duration-in-open-state=20s
resilience4j.retry.instances.orders-db.max-attempts=3
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.connection-timeout=3000`,
      fixLang: 'text' },
    { title: 'Regional failover drill: the standby never started',
      symptom: 'During the first DR drill, the standby Container App in the secondary region stayed in “Provisioning” and then failed. RTO target 1 hour; actual 5 hours.',
      diagnose: `az containerapp revision list -g rg-orders-dr -n orders \\
  --query "[].{rev:name, state:properties.runningState, health:properties.healthState}" -o table
az containerapp logs show -g rg-orders-dr -n orders --type system --tail 50
# ImagePullBackOff: acrorders.azurecr.io (primary region only) unreachable
# Key Vault reference failed: kv-orders-weu (primary region)`,
      cause: 'The secondary depended on the primary region: the container registry wasn’t geo-replicated and secrets lived in a single Key Vault in the primary region.',
      fix: 'Geo-replicate the registry (Premium tier) or push to a registry in each region, deploy a Key Vault per region from the same IaC, link private DNS zones to both regions’ VNets, and repeat the drill until the measured RTO meets the target.',
      fixCode: `az acr replication create -r acrorders -l northeurope
az keyvault create -g rg-orders-dr -n kv-orders-neu -l northeurope --enable-rbac-authorization true` },
    { title: 'Duplicate orders after a payment timeout',
      symptom: 'Some customers were charged twice during a period of high latency at the payment provider.',
      diagnose: `SELECT customer_id, total, count(*)
FROM orders
WHERE created_at > now() - interval '1 day'
GROUP BY customer_id, total, date_trunc('minute', created_at)
HAVING count(*) > 1;`,
      diagnoseLang: 'sql',
      cause: 'The client timed out after 2 seconds, but the provider completed the charge after 3. A retry policy on the <code>POST /charge</code> call then charged again.',
      fix: 'Send an idempotency key the provider deduplicates on, record the request id with a unique constraint before calling, and on timeout <i>query</i> the outcome instead of blindly retrying.',
      fixCode: `CREATE TABLE payment_requests (
  request_id uuid PRIMARY KEY,           -- idempotency key, generated once per order attempt
  order_id   bigint NOT NULL,
  status     text   NOT NULL DEFAULT 'pending'
);`,
      fixLang: 'sql' }
  ],
  puzzles: [
    { kind: 'calc', q: 'A request path depends on an App Service app (SLA 99.95%) and a database (SLA 99.99%), both required, no redundancy. What is the approximate composite availability?', options: ['99.99%', '99.95%', '≈99.94%', '99.97%'], answer: 2, explain: 'For serial dependencies, multiply: 0.9995 × 0.9999 ≈ 0.9994, about <b>99.94%</b>. A chain is always less available than its weakest link. (Check current SLA figures on Microsoft Learn; the method is what matters.)' },
    { kind: 'calc', q: 'Three layers (gateway, API, SDK) each make 1 attempt plus up to 3 retries. The database is down. How many database calls can one user request cause?', options: ['4', '9', '12', '64'], answer: 3, explain: 'Each layer makes up to 4 attempts, and each attempt of an upper layer triggers the full retry sequence of the lower one: 4 × 4 × 4 = <b>64</b>. Retry in one layer only.' },
    { kind: 'scenario', q: 'Postgres has an asynchronous read replica in another region with about 30 seconds of replication lag. The primary region fails and you promote the replica. What is the realistic RPO?', options: ['0: replicas are copies', 'About the replication lag (≈30 s of recent writes may be lost)', 'The backup retention period', 'The time to promote the replica'], answer: 1, explain: 'With async replication, writes committed on the primary but not yet shipped are lost on failover, so RPO ≈ <b>lag at the moment of failure</b>. The time to promote is part of the RTO, not the RPO.' },
    { kind: 'predict', q: 'A Resilience4j circuit breaker is OPEN. Its <code>wait-duration-in-open-state</code> passes. What happens next?', options: ['It closes and all traffic resumes', 'It moves to HALF-OPEN and lets a few trial calls through', 'It stays open until restarted', 'It retries every failed call'], answer: 1, explain: 'After the wait it goes <b>HALF-OPEN</b> and permits a configured number of calls. If they succeed (below the failure threshold) it closes; if not, it opens again.' },
    { kind: 'scenario', q: 'Ranked by typical RTO, fastest first?', options: ['Backup & restore → pilot light → warm standby → active-active', 'Active-active → warm standby → pilot light → backup & restore', 'Warm standby → active-active → backup & restore → pilot light', 'They all have the same RTO'], answer: 1, explain: '<b>Active-active</b> already serves traffic in both regions (near-zero RTO); <b>warm standby</b> runs a scaled-down copy; <b>pilot light</b> keeps data replicated but compute off; <b>backup & restore</b> rebuilds everything. Cost goes the opposite way.' },
    { kind: 'scenario', q: 'Your app is zone-redundant (App Service across zones, Postgres zone-redundant HA). Which failure does this <b>not</b> protect you from?', options: ['One datacenter in the region losing power', 'A host failure under the database primary', 'A bad migration that deletes a column’s data', 'A zonal network fault'], answer: 2, explain: 'Zone redundancy replicates every write, including the bad ones, to all zones. Logical corruption needs <b>backups and point-in-time restore</b>, and expand/contract migrations.' },
    { kind: 'scenario', q: 'A reviewer proposes active-active across two regions for an internal reporting tool with an RTO of 24 hours. Which pillar argument applies most?', options: ['Reliability: always add regions', 'Cost Optimization: the RTO allows backup-and-restore or pilot light at a fraction of the cost', 'Performance Efficiency: active-active is faster', 'Security: two regions are safer'], answer: 1, explain: 'Well-Architected is about <b>trade-offs against requirements</b>. A 24-hour RTO doesn’t justify doubling the compute and adding cross-region replication; IaC plus geo-redundant backups meets it.' }
  ],
  interview: [
    { q: 'Name the five pillars of the Well-Architected Framework and a typical trade-off.', a: '<p>Reliability, Security, Cost Optimization, Operational Excellence and Performance Efficiency. Typical trade-offs: a second region raises reliability and cost; private networking raises security and operational complexity; caching raises performance but adds a consistency question; aggressive autoscale-in saves cost but adds cold-start latency. The framework’s point is to make these trade-offs explicit and tied to requirements.</p>', lvl: 'core' },
    { q: 'Define RTO and RPO and how they drive architecture.', a: '<p><b>RTO</b>: how long the business can be without the service. <b>RPO</b>: how much data, measured in time, it can lose. A small RTO needs pre-provisioned capacity elsewhere (warm standby, active-active) and an automated traffic switch; a small RPO needs frequent or synchronous replication. RPO of zero across regions usually means synchronous writes and their latency, or an application-level design (event log, reconciliation).</p>', lvl: 'core' },
    { q: 'How do you implement retries correctly?', a: '<ul><li>Only for transient errors (timeouts, 429, 503, connection resets), never for 400s.</li><li>Only for idempotent operations, or with an idempotency key.</li><li>Exponential backoff with <b>jitter</b>, a small attempt count, and a total time budget.</li><li>Honour <code>Retry-After</code>.</li><li>One layer only; configure or disable the SDK’s own retries accordingly.</li><li>Combine with a circuit breaker so that a dead dependency isn’t retried forever.</li></ul>', lvl: 'core' },
    { q: 'Explain the circuit breaker states and how you would tune one.', a: '<p><b>Closed</b>: calls pass, outcomes are recorded in a sliding window. When the failure rate (or slow-call rate) exceeds a threshold, with a minimum number of calls, it goes <b>open</b>: calls fail immediately (or use a fallback). After a wait it goes <b>half-open</b> and allows a few trial calls; success closes it, failure re-opens it. Tune the window to traffic volume, set the slow-call threshold below the caller’s timeout, and give each dependency its own breaker.</p>', fu: 'In Resilience4j, what is the default aspect order? (Retry wraps CircuitBreaker, which wraps RateLimiter, TimeLimiter and Bulkhead; so each retry attempt is counted by the breaker.)', lvl: 'deep' },
    { q: 'What is a bulkhead and when do you need one?', a: '<p>Isolating resources per dependency so a slow one can’t take everything: a separate thread pool or semaphore per downstream call, separate connection pools, or separate deployments and queues for critical and non-critical work. Classic example: a slow recommendations service exhausting the Tomcat threads that checkout also needs.</p>', lvl: 'core' },
    { q: 'Walk me through DR patterns from cheapest to fastest.', a: '<ol><li><b>Backup & restore</b>: geo-redundant backups and IaC; RTO of hours, RPO up to the backup or geo-replication interval.</li><li><b>Pilot light</b>: data replicated continuously to the second region, minimal or no compute; scale out on failover.</li><li><b>Warm standby</b>: a scaled-down but running copy; scale up and switch traffic.</li><li><b>Active-active</b>: both regions serve traffic; failover is a routing change, but data consistency across regions becomes the hard part.</li></ol>', lvl: 'core' },
    { q: 'How would you fail over a Spring Boot + Postgres Flexible Server app to another region?', a: '<p>Keep a cross-region read replica of Postgres, the app deployed (warm or cold) in the secondary from the same IaC, a geo-replicated registry and a Key Vault per region, and Front Door with health probes in front. On failure: confirm it is regional, promote the replica (accepting the replication lag as data loss), point the secondary app at it (a regional config value, or a DNS name you switch), scale it up, and let Front Door shift traffic. Afterwards, rebuild a replica back in the primary and plan the failback.</p>', lvl: 'deep' },
    { q: 'How do you test reliability before production finds the gaps?', a: '<p>Load tests with realistic traffic shapes, fault injection (Azure Chaos Studio: VM shutdown, zone-down simulations for supported resources, network latency, AKS chaos), forced database failovers in staging, game days with the on-call team, and measuring RTO/RPO in drills rather than assuming them. Track findings like bugs.</p>', lvl: 'core' },
    { q: 'What is a health endpoint and what should it check?', a: '<p>Separate <b>liveness</b> (is the process alive; restart if not), <b>readiness</b> (can this instance take traffic now) and a deeper <b>dependency status</b> for dashboards. Liveness and readiness shouldn’t fail because a shared dependency is down, or the platform will restart or drain every instance at once. Spring Boot Actuator health groups map cleanly onto this.</p>', lvl: 'core' },
    { q: 'How do you avoid a retry storm after an outage recovers?', a: '<p>Jittered backoff so clients don’t retry in sync, retry budgets (retries limited to a fraction of normal traffic), circuit breakers that recover gradually (half-open trial calls), load shedding and rate limiting at the edge (API Management, Front Door), queues to absorb bursts, and connection pools capped below the database’s limits.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Resilience4j (Spring Boot 3): breaker, timeout, jittered retry', lang: 'yaml', code: `# io.github.resilience4j:resilience4j-spring-boot3 + spring-boot-starter-aop
resilience4j:
  circuitbreaker:
    instances:
      payments:
        sliding-window-type: COUNT_BASED
        sliding-window-size: 20
        minimum-number-of-calls: 10
        failure-rate-threshold: 50
        slow-call-duration-threshold: 2s
        slow-call-rate-threshold: 50
        wait-duration-in-open-state: 30s
        permitted-number-of-calls-in-half-open-state: 3
  timelimiter:
    instances:
      payments:
        timeout-duration: 3s
  retry:
    instances:
      payments:
        max-attempts: 3                 # 1 call + 2 retries
        retry-exceptions:
          - java.io.IOException
          - java.util.concurrent.TimeoutException
  bulkhead:
    instances:
      payments:
        max-concurrent-calls: 20` },
    { title: 'Java: jitter, fallback, idempotency key', lang: 'java', code: `@Configuration
class ResilienceConfig {
  @Bean   // exponential backoff with jitter: 200 ms, ×2, ±50%
  RetryConfigCustomizer paymentsRetry() {
    return RetryConfigCustomizer.of("payments", b -> b.intervalFunction(
        IntervalFunction.ofExponentialRandomBackoff(Duration.ofMillis(200), 2.0, 0.5)));
  }
}

@Service
class PaymentGateway {
  @Retry(name = "payments")                     // outermost: each attempt is seen by the breaker
  @CircuitBreaker(name = "payments", fallbackMethod = "deferred")
  @Bulkhead(name = "payments")
  public PaymentResult charge(Order o) {
    return client.charge(o.total(), "order-" + o.id());   // idempotency key: safe to retry
  }

  PaymentResult deferred(Order o, Throwable t) {          // breaker open or retries exhausted
    outbox.enqueue(new ChargeRequested(o.id()));          // settle asynchronously
    return PaymentResult.pending();
  }
}` },
    { title: 'Azure SDK retries and a regional failover runbook', code: `# Java: configure SDK retries once, instead of stacking another retry layer on top
#   new BlobServiceClientBuilder().endpoint(url).credential(cred)
#       .retryOptions(new RetryOptions(new ExponentialBackoffOptions()
#           .setMaxRetries(3).setBaseDelay(Duration.ofMillis(500)).setMaxDelay(Duration.ofSeconds(8))))

# Postgres Flexible Server: cross-region read replica (set up in advance)
az postgres flexible-server replica create -g rg-orders-dr \\
  --replica-name pg-orders-neu --source-server $PRIMARY_ID --location northeurope

# During a regional outage: promote the replica to a standalone server (accept the lag as data loss)
az postgres flexible-server replica promote -g rg-orders-dr -n pg-orders-neu \\
  --promote-mode standalone --promote-option forced

# Scale the warm standby and let Front Door health probes move traffic
az containerapp update -g rg-orders-dr -n orders --min-replicas 3`, note: 'Rehearse this in a drill and time each step: the sum is your real RTO. Check the current CLI options on Microsoft Learn; replica promotion options have changed over time.' }
  ]
});
