IA.register({
  track: 'azure',
  slug: 'cosmos-db',
  title: 'Cosmos DB',
  tagline: 'Cosmos DB is a <b>hash-partitioned</b> document store with a throughput budget. Every item lives in one logical partition chosen by its <b>partition key</b>. Logical partitions are packed into physical partitions, and your provisioned <b>RU/s</b> are split evenly across those physical partitions. Pick the key badly and you pay for capacity you can’t use.',
  lang: 'java',
  tldr: {
    problem: 'Teams model Cosmos DB like a relational table, pick a partition key such as <code>/tenantId</code> or <code>/date</code>, and then see 429s on one partition while the account is mostly idle. Or they run cross-partition queries for every page view and the RU bill explodes.',
    model: 'Cost is measured in <b>Request Units</b>: a 1 KB point read by id and partition key costs about 1 RU, and everything else is priced relative to that. Throughput is divided across physical partitions, so a <b>hot key</b> caps you at one partition’s share. <b>Consistency</b> is a dial from Strong to Eventual that trades latency and RU cost against freshness. The <b>change feed</b> is the ordered stream of changes per partition key.',
    hook: '“We provisioned 40,000 RU/s and still get 429s at 12,000.” One key gets most of the traffic, so it lands in one physical partition, which gets only a quarter of the 40,000.',
    facts: [
      { v: '≈ 1 RU', l: 'cost of a point read of a 1 KB item by id + partition key, the cheapest operation Cosmos DB has' },
      { v: '20 GB', l: 'maximum size of one logical partition (all items with the same key value) per Microsoft Learn; hierarchical keys lift this per tenant' },
      { v: '5', l: 'consistency levels: Strong, Bounded staleness, Session (the default), Consistent prefix and Eventual' }
    ]
  },
  intro: {
    what: '<b>Azure Cosmos DB</b> is a globally distributed database that stores JSON documents (the “NoSQL API”, plus APIs compatible with MongoDB, Cassandra and others). You create a <b>container</b> and choose a <b>partition key</b>: a property such as <code>/customerId</code>. Cosmos DB hashes that value to decide where each item lives, which lets it scale out to many machines. You pay in <b>Request Units</b> (RUs), a single currency for CPU, memory and IO.',
    analogy: { icon: '🗄️', title: 'A filing room with metered clerks', text: 'Every folder goes in a drawer chosen by the first letter of the customer’s name (the partition key). Each cabinet has one clerk, and you pay for a fixed number of clerk-minutes per second, shared equally between cabinets. If half your customers are named “Smith”, one clerk is swamped while the others read magazines, and you still pay for all of them.' },
    steps: [
      { t: 'Choose the partition key first', d: 'Pick a property with many distinct values that spreads both storage and traffic, and that most queries filter on. You can’t change it later without copying the data to a new container.', code: 'az cosmosdb sql container create -g rg-orders-prod -a cosmos-orders -d shop -n orders \\\n  --partition-key-path /customerId --throughput 4000', lang: 'bash' },
      { t: 'Read by id and partition key whenever you can', d: 'That is a point read: one partition, about 1 RU per KB. A query without the key fans out to every partition.', code: 'CosmosItemResponse<Order> r = container.readItem(orderId, new PartitionKey(customerId), Order.class);\ndouble ru = r.getRequestCharge();' },
      { t: 'Pick a consistency level', d: 'Session is the default: you always see your own writes. Stronger levels cost more latency and RUs.' },
      { t: 'React to changes with the change feed', d: 'Every insert and update appears in the change feed in order per partition key. Use it to update projections, search indexes or other services.' }
    ],
    terms: [
      ['Request Unit (RU)', 'A normalised cost for one operation. Provisioned as RU/s per container or database, or billed per request in serverless.'],
      ['logical partition', 'All items with the same partition key value. It must stay within 20 GB.'],
      ['physical partition', 'A replica set that hosts many logical partitions and gets an equal share of the RU/s. Cosmos DB splits them as data or throughput grows.'],
      ['hot partition', 'A physical partition that receives a disproportionate share of requests and gets throttled (HTTP 429) while others are idle.'],
      ['consistency level', 'The guarantee about how fresh and how ordered reads are, from Strong to Eventual.'],
      ['change feed', 'A persistent, ordered (per partition key) log of item inserts and updates in a container.']
    ]
  },
  visual: {
    title: 'Partition keys spread RUs, or don’t',
    caption: 'Pick a partition key and press Play. Requests are hashed to four physical partitions, each with an equal share of 20,000 RU/s (the dashed line). Watch a hot tenant cause 429s, a high-cardinality key spread load evenly, a hierarchical key fix both, and the change feed drive a projection.'
  },
  extras: [
    { id: 'cosmos-db-consistency', title: 'The consistency dial', label: 'Consistency', caption: 'Drag the slider to a consistency level and press Play. A client in West Europe writes v1, v2, v3, and readers in East US read while replication is in flight. See which values each level allows, and what it costs in latency and read RUs.' }
  ],
  gotchas: [
    { trap: 'A low-cardinality or skewed partition key', code: `/tenantId   → one big tenant = one hot logical partition (and a 20 GB ceiling)
/status     → 4 values, so at most 4 logical partitions
/createdDate → every write today hits the same key`, why: 'All requests for one key value go to one physical partition, which gets only its share of the RU/s. Adding throughput adds partitions, not capacity for that key.', fix: 'Choose a high-cardinality key that your hot queries filter on (<code>/customerId</code>, <code>/deviceId</code>). For multi-tenant data with big tenants, use a <b>hierarchical partition key</b> such as <code>/tenantId</code> + <code>/userId</code>, or a synthetic key.' },
    { trap: 'Cross-partition queries on hot paths', code: `SELECT * FROM o WHERE o.status = 'OPEN'        -- no partition key: fans out to every partition
SELECT * FROM o WHERE o.customerId = @c AND o.status = 'OPEN'   -- one partition`, lang: 'sql', why: 'A query without the partition key in its filter is sent to every physical partition. The RU charge and latency grow with the number of partitions, which grows with your data.', fix: 'Design containers per access pattern (duplicate data if needed, kept in sync through the change feed). Check <code>getRequestCharge()</code> in tests, and use point reads for lookups by id.' },
    { trap: 'Assuming Session consistency spans your whole service', why: 'Session guarantees read-your-writes <b>within one session token</b>. A Java <code>CosmosClient</code> tracks tokens per client instance, so a write handled by pod A followed by a read on pod B may not see the write if the read goes to a lagging replica.', fix: 'For read-after-write across instances, pass the session token from the write response to the read (<code>setSessionToken</code>), route the follow-up read to the same instance, or read from the write region with a stronger level for that call.' },
    { trap: 'Expecting the change feed to show deletes', why: 'In the default <b>latest version</b> mode, the change feed contains inserts and updates only, and only the latest version of an item. Deletes don’t appear at all.', fix: 'Soft-delete: set <code>deleted: true</code> and a <code>ttl</code>, so the update flows through the feed and TTL removes the item later. Or use the <b>all versions and deletes</b> mode, which requires continuous backup (check its current status on Microsoft Learn).' },
    { trap: 'Creating a CosmosClient per request', why: 'The client holds connection pools, address caches and session tokens. Creating one per request causes slow first calls, socket exhaustion and lost session consistency.', fix: 'Use one <code>CosmosClient</code> (or <code>CosmosAsyncClient</code>) per account per application as a singleton bean, which Spring Cloud Azure does for you.' },
    { trap: 'Indexing everything by default', why: 'The default indexing policy indexes every property. Large documents with many properties cost more RUs on every write.', fix: 'Exclude paths you never filter or sort on (<code>"excludedPaths": [{"path": "/payload/*"}]</code>), and add composite indexes for multi-property <code>ORDER BY</code>.' },
    { trap: 'Treating 429 as an outage', why: 'HTTP 429 means “rate limited, retry after <code>x-ms-retry-after-ms</code>”. The SDK already retries throttled requests (the Java SDK defaults to 9 retries within 30 s). A small percentage of 429s at peak is normal with right-sized throughput.', fix: 'Alert on sustained 429 rate or on the <b>normalized RU consumption</b> per partition key range, not on single 429s. Fix hot partitions before adding RU/s, and consider autoscale for spiky load.' }
  ],
  scenarios: [
    { title: '429s at 30% of provisioned throughput',
      symptom: 'Black-Friday morning: the orders container is provisioned at 40,000 RU/s, total consumption is about 12,000 RU/s, yet one in five writes is throttled.',
      diagnose: `// Azure Monitor → Insights → Throughput: “Normalized RU Consumption” by PartitionKeyRangeId
// one range at 100%, the others at ~10%
CDBPartitionKeyRUConsumption
| where TimeGenerated > ago(1h)
| summarize ru = sum(RequestCharge) by PartitionKey
| top 5 by ru`,
      cause: 'The key was <code>/tenantId</code>, and one enterprise tenant generates most orders. Its logical partition sits in one physical partition with 10,000 RU/s, so throughput elsewhere is wasted.',
      fix: 'Move to a new container with a hierarchical key (<code>/tenantId</code>, <code>/orderId</code>) or <code>/customerId</code>, copy the data with the change feed or a container copy job, then switch reads and writes.',
      fixCode: `CosmosContainerProperties props = new CosmosContainerProperties("orders-v2",
    new PartitionKeyDefinition()
        .setPaths(List.of("/tenantId", "/customerId"))
        .setKind(PartitionKind.MULTI_HASH)
        .setVersion(PartitionKeyDefinitionVersion.V2));
database.createContainerIfNotExists(props, ThroughputProperties.createAutoscaledThroughput(40000));`, lang: 'java' },
    { title: 'Search index still shows deleted products',
      symptom: 'Products deleted in the admin UI keep appearing in search results for weeks.',
      diagnose: `// the change-feed processor that updates the search index only handles upserts;
// it never receives a delete event`,
      cause: 'The change feed in latest-version mode doesn’t contain deletes. The admin UI called <code>deleteItem</code>.',
      fix: 'Switch to a soft delete: patch <code>deleted=true</code> and <code>ttl=86400</code>. The processor removes the document from the index when it sees <code>deleted</code>, and TTL cleans up the item a day later.',
      fixCode: `container.patchItem(id, new PartitionKey(categoryId),
    CosmosPatchOperations.create().set("/deleted", true).set("/ttl", 86400),
    Product.class);`, lang: 'java' },
    { title: '“I just saved it and it’s gone”, but only sometimes',
      symptom: 'With two regions and Session consistency, users occasionally see stale data right after an update, only when their requests hit different pods.',
      diagnose: `// write on pod A returns sessionToken "0:1#4712"; the read on pod B uses its own token "0:1#4690"
log.info("session={}", response.getSessionToken());`,
      cause: 'Session tokens live in each pod’s <code>CosmosClient</code>. Pod B had no token for the new write, so a replica that hadn’t caught up could serve the read.',
      fix: 'Return the session token to the caller (for example in a response header), and send it back on the follow-up read with <code>CosmosItemRequestOptions.setSessionToken</code>. Or make the request sticky for read-after-write flows.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'A container has 20,000 RU/s and four physical partitions. All traffic uses one partition key value. Roughly what throughput can that traffic reach before 429s?', options: ['20,000 RU/s', '10,000 RU/s', '5,000 RU/s', 'Unlimited with autoscale'], answer: 2, explain: 'Provisioned throughput is split evenly across physical partitions: 20,000 / 4 = <b>5,000 RU/s</b>. One key value lives in exactly one physical partition.' },
    { kind: 'scenario', q: 'Which partition key is best for an orders container where the hot query is “orders for customer X” and some tenants have millions of customers?', options: ['/status', '/orderDate', '/tenantId', '/customerId (or hierarchical /tenantId + /customerId)'], answer: 3, explain: '<code>/customerId</code> has high cardinality and matches the hot query. A hierarchical key keeps tenant-level queries targeted to a subset of partitions as well.' },
    { kind: 'scenario', q: 'An account has multi-region writes enabled. Which consistency level is NOT available?', options: ['Session', 'Bounded staleness', 'Strong', 'Eventual'], answer: 2, explain: 'Strong consistency requires a single write region, because every write must be committed in all regions before it is acknowledged.' },
    { kind: 'scenario', q: 'Which levels guarantee that a reader never sees writes out of order (e.g. v3 then v1)?', options: ['Only Strong', 'Strong, Bounded staleness, Session and Consistent prefix', 'All five', 'Only Eventual'], answer: 1, explain: 'Every level except <b>Eventual</b> preserves order. Consistent prefix may lag, but it never shows a later write before an earlier one.' },
    { kind: 'scenario', q: 'Compared with Session, what happens to the RU charge of a read under Strong or Bounded staleness?', options: ['It is the same', 'It roughly doubles, because the read is served from a quorum of replicas', 'It halves', 'Reads are free under Strong'], answer: 1, explain: 'Strong and Bounded staleness read from two replicas (a minority quorum) of the four in the replica set, so reads cost about <b>2×</b> the RUs.' },
    { kind: 'scenario', q: 'A change-feed processor with two instances is updating a search index. Instance B crashes mid-batch. What happens to its partitions?', options: ['Changes are lost', 'Instance A acquires B’s leases and continues from B’s last checkpoint, so some changes may be processed twice', 'The feed pauses until B returns', 'Cosmos DB replays the whole container'], answer: 1, explain: 'Leases expire and are taken over. Processing resumes from the last checkpointed continuation, which is <b>at-least-once</b>, so handlers must be idempotent.' },
    { kind: 'scenario', q: 'You need the order of changes to be guaranteed. Over what scope does the change feed guarantee order?', options: ['The whole container', 'Each logical partition key value', 'Each region', 'No ordering at all'], answer: 1, explain: 'The change feed is ordered within a <b>partition key value</b>. Across keys, changes can be read in any order, and in parallel.' },
    { kind: 'scenario', q: 'Your hot path needs “get order 42 for customer 7”. Which call is cheapest?', options: ['SELECT * FROM c WHERE c.id = "42"', 'readItem("42", new PartitionKey("7"), Order.class)', 'A stored procedure', 'queryItems with enableCrossPartitionQuery'], answer: 1, explain: 'A <b>point read</b> with id and partition key goes straight to one item: about 1 RU for 1 KB. The query without a key fans out to every partition.' }
  ],
  interview: [
    { q: 'How do you choose a partition key?', a: '<ul><li>High cardinality, so there are many logical partitions.</li><li>Even distribution of <b>both</b> storage and request volume.</li><li>Present in the filter of the most frequent queries, so they hit one partition.</li><li>Each value must stay under 20 GB.</li></ul><p>For multi-tenant data with very uneven tenants, use hierarchical keys (up to three levels). Write-heavy time-series data often needs a synthetic key such as <code>deviceId</code>, or <code>deviceId-yyyymm</code>.</p>', lvl: 'core' },
    { q: 'What is a Request Unit, and how do you estimate cost?', a: '<p>A normalised measure of CPU, memory and IO: a 1 KB point read is about 1 RU. Writes, larger items, more indexed properties and queries cost more. Measure in tests with <code>getRequestCharge()</code>, multiply by peak operations per second, and add headroom. Then choose provisioned (manual), <b>autoscale</b> (scales between 10% and the max you set), or <b>serverless</b> for spiky or low traffic.</p>', lvl: 'core' },
    { q: 'Explain the five consistency levels.', a: '<ul><li><b>Strong</b>: linearizable; reads see the latest committed write. Single write region only; highest latency.</li><li><b>Bounded staleness</b>: reads lag by at most K versions or T time, and are ordered.</li><li><b>Session</b> (default): read-your-writes, monotonic reads and writes within a session token.</li><li><b>Consistent prefix</b>: no out-of-order reads, but they may be stale.</li><li><b>Eventual</b>: no ordering guarantee; cheapest and fastest.</li></ul>', fu: 'Which ones double read RUs? (Strong and Bounded staleness.)', lvl: 'core' },
    { q: 'What happens physically when you increase RU/s or data grows?', a: '<p>Cosmos DB adds physical partitions by <b>splitting</b> existing ones, moving logical partitions between them. It never splits a logical partition, which is why a single key value is limited to one physical partition’s throughput and 20 GB. Throughput is redistributed evenly. Splits are online, but reducing RU/s later doesn’t merge partitions back automatically.</p>', lvl: 'deep' },
    { q: 'How does the change feed processor scale and handle failures?', a: '<p>It stores one lease per feed range in a <b>lease container</b>. Instances sharing a processor name balance leases between themselves, so adding instances spreads the work, up to the number of leases. Each instance reads its ranges in batches, calls your handler, then checkpoints. On a crash the lease expires and another instance takes over from the last checkpoint, so delivery is at-least-once and handlers must be idempotent. The Azure Functions Cosmos DB trigger uses the same mechanism.</p>', lvl: 'deep' },
    { q: 'How would you implement an event-driven projection or outbox with Cosmos DB?', a: '<p>Write the domain document (and, if you need it, an event document in the same logical partition, using a transactional batch). The change feed then publishes to Service Bus or updates read models. Ordering holds per partition key, so key by aggregate ID. Add a version field so consumers can drop stale updates.</p>', lvl: 'deep' },
    { q: 'Spring Data for Cosmos DB: what changes compared with Spring Data JPA?', a: '<p>Entities use <code>@Container</code>, <code>@Id</code> and <code>@PartitionKey</code>, and repositories extend <code>CosmosRepository</code>. There are no joins, so you model aggregates as documents. Derived queries that omit the partition key become cross-partition. Use <code>findById(id, new PartitionKey(pk))</code> for point reads, and <code>@Version</code> maps to the <code>_etag</code> for optimistic concurrency.</p>', lvl: 'core' },
    { q: 'How do you secure a Cosmos DB account?', a: '<p>Disable key auth (<code>disableLocalAuth: true</code>) and use Entra with the data-plane RBAC roles (for example <b>Cosmos DB Built-in Data Contributor</b>), assigned with <code>az cosmosdb sql role assignment create</code>. Note that these data-plane roles are separate from Azure RBAC on the account. Add private endpoints with the <code>privatelink.documents.azure.com</code> zone and disable public network access.</p>', lvl: 'core' },
    { q: 'When would you not use Cosmos DB?', a: '<p>When the workload is relational and join-heavy, needs ad-hoc analytical queries over everything, or needs multi-document transactions across partitions. A transactional batch only works within one logical partition. For a typical Spring CRUD service with complex reporting, Postgres Flexible Server is often simpler and cheaper. Cosmos DB shines for high-scale key-based access, global distribution, and multi-region writes.</p>', lvl: 'core' },
    { q: 'How would you store conversation memory for an AI agent in Cosmos DB?', a: '<p>Use <code>/userId</code> or a hierarchical key (<code>/tenantId</code>, <code>/userId</code>, <code>/sessionId</code>), with one document per message or per turn, and a TTL for expiry. Reads of a session are single-partition queries. Cosmos DB for NoSQL also supports vector indexing, so embeddings for semantic recall can live in the same container; check the current feature status and limits on Microsoft Learn.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Spring Data Cosmos (Spring Cloud Azure 5.x)', lang: 'java', code: `// dependency: com.azure.spring:spring-cloud-azure-starter-data-cosmos
@Container(containerName = "orders")
public class Order {
  @Id private String id;
  @PartitionKey private String customerId;
  private String status;
  private BigDecimal total;
  @Version private String _etag;          // optimistic concurrency
}

public interface OrderRepository extends CosmosRepository<Order, String> {
  List<Order> findByCustomerIdAndStatus(String customerId, String status);   // single-partition
  List<Order> findByStatus(String status);                                   // cross-partition: careful
}

// point read: ~1 RU per KB
orders.findById(orderId, new PartitionKey(customerId));`, note: 'Configure <code>spring.cloud.azure.cosmos.endpoint</code> and <code>database</code>; with a managed identity and data-plane RBAC no key is needed.' },
    { title: 'Change feed processor', lang: 'java', code: `ChangeFeedProcessor processor = new ChangeFeedProcessorBuilder()
    .hostName(System.getenv("HOSTNAME"))           // unique per instance
    .feedContainer(ordersContainer)
    .leaseContainer(leasesContainer)               // partition key /id
    .options(new ChangeFeedProcessorOptions().setMaxItemCount(100))
    .handleChanges((List<JsonNode> docs) -> {
        for (JsonNode d : docs) {
            if (d.path("deleted").asBoolean()) search.delete(d.get("id").asText());
            else search.upsert(d);                 // idempotent: safe to repeat
        }
    })
    .buildChangeFeedProcessor();

processor.start().block();`, note: 'The handler runs at least once per change. Checkpoints are written after each successful batch.' },
    { title: 'CLI: account, RBAC and hierarchical key', lang: 'bash', code: `az cosmosdb create -g rg-orders-prod -n cosmos-orders \\
  --default-consistency-level Session \\
  --locations regionName=westeurope failoverPriority=0 isZoneRedundant=true \\
  --locations regionName=northeurope failoverPriority=1 isZoneRedundant=false \\
  --disable-local-auth true

# data-plane RBAC: built-in Data Contributor
az cosmosdb sql role assignment create -g rg-orders-prod -a cosmos-orders \\
  --role-definition-id 00000000-0000-0000-0000-000000000002 \\
  --principal-id $APP_PRINCIPAL_ID --scope "/"

az cosmosdb sql container create -g rg-orders-prod -a cosmos-orders -d shop -n orders \\
  --partition-key-path /customerId --max-throughput 40000      # autoscale
# hierarchical (MultiHash) keys: create them from the SDK (see the scenario) or Bicep` },
    { title: 'Indexing policy (exclude big payloads)', lang: 'json', code: `{
  "indexingMode": "consistent",
  "includedPaths": [{ "path": "/*" }],
  "excludedPaths": [
    { "path": "/payload/*" },
    { "path": "/\\"_etag\\"/?" }
  ],
  "compositeIndexes": [[
    { "path": "/customerId", "order": "ascending" },
    { "path": "/createdAt",  "order": "descending" }
  ]]
}` }
  ]
});
