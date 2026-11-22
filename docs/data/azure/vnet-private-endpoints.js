IA.register({
  track: 'azure',
  slug: 'vnet-private-endpoints',
  title: 'VNets & private endpoints',
  tagline: 'A VNet is your private address space in a region, cut into <b>subnets</b> and guarded by <b>NSGs</b>. A <b>private endpoint</b> puts a PaaS resource (a storage account, Postgres, Key Vault) onto one of those subnets as a private IP. The hard part isn’t the IP. It’s <b>DNS</b>: the public name must resolve to that private IP from every network that needs it.',
  lang: 'bash',
  tldr: {
    problem: 'Teams create a private endpoint, disable public access, and the app breaks with timeouts or 403s. The name still resolves to the public IP because the private DNS zone isn’t linked to the VNet the app runs in, or on-premises DNS never forwards to Azure.',
    model: 'Creating a private endpoint for <code>stordersprod.blob.core.windows.net</code> makes Azure’s public DNS answer with a <b>CNAME</b> to <code>stordersprod.privatelink.blob.core.windows.net</code>. Inside a VNet linked to the <b>private DNS zone</b> <code>privatelink.blob.core.windows.net</code>, that CNAME resolves to the endpoint’s <b>private IP</b>. Outside, it keeps resolving to the public IP. Same name, same TLS certificate, different answer.',
    hook: '“Private endpoint vs service endpoint?” A <b>service endpoint</b> keeps the service on its public IP and lets it recognise your subnet as the source. A <b>private endpoint</b> gives one specific resource a private IP in your VNet, reachable from peered VNets and on-premises.',
    facts: [
      { v: '168.63.129.16', l: 'Azure’s virtual IP for the built-in DNS resolver (and platform health probes) in every VNet' },
      { v: '5', l: 'IP addresses Azure reserves in every subnet: the network address, the first three host addresses and the broadcast address' },
      { v: '65500', l: 'priority of the default DenyAllInBound and DenyAllOutBound NSG rules; your rules use 100–4096 and lower numbers win' }
    ]
  },
  intro: {
    what: 'A <b>virtual network (VNet)</b> is a private network in one Azure region with an address range you choose, such as <code>10.1.0.0/16</code>. You split it into <b>subnets</b> for different tiers (apps, databases, endpoints) and attach <b>network security groups</b> (NSGs), which are stateful allow/deny rules. Azure PaaS services normally live on public endpoints. A <b>private endpoint</b> brings one of them into your subnet as a network interface with a private IP, so traffic never needs the internet and you can switch off public access.',
    analogy: { icon: '🏢', title: 'An internal phone extension for an outside supplier', text: 'Your company (VNet) has internal extensions. A supplier (Key Vault) normally has a public number. A private endpoint gives the supplier an <b>internal extension</b> in your building. The trick is the <b>phone book</b> (DNS): staff still look up the supplier by name, so your internal phone book must list the internal extension, and branch offices (on-premises, other VNets) must use that phone book too.' },
    steps: [
      { t: 'Plan the address space and subnets', d: 'Non-overlapping ranges across VNets and on-premises. Give each tier, and each delegated service, its own subnet.', code: 'az network vnet create -g rg-net-spoke1 -n vnet-orders --address-prefixes 10.1.0.0/16 \\\n  --subnet-name snet-apps --subnet-prefixes 10.1.0.0/24\naz network vnet subnet create -g rg-net-spoke1 --vnet-name vnet-orders -n snet-pe --address-prefixes 10.1.2.0/27' },
      { t: 'Create the private endpoint', d: 'Pick the resource and its sub-resource (<code>blob</code>, <code>vault</code>, <code>postgresqlServer</code>…).', code: 'az network private-endpoint create -g rg-net-spoke1 -n pe-stordersprod-blob \\\n  --vnet-name vnet-orders --subnet snet-pe \\\n  --private-connection-resource-id $ST_ID --group-id blob --connection-name stordersprod-blob' },
      { t: 'Wire DNS', d: 'Create (or reuse) the private DNS zone, link it to the VNets that resolve the name, and attach a zone group so the A record is managed for you.', code: 'az network private-endpoint dns-zone-group create -g rg-net-spoke1 \\\n  --endpoint-name pe-stordersprod-blob -n default \\\n  --private-dns-zone $ZONE_ID --zone-name blob' },
      { t: 'Turn off public access and test from inside', d: '<code>nslookup stordersprod.blob.core.windows.net</code> from the app’s network must return a <code>10.x</code> address.' }
    ],
    terms: [
      ['subnet', 'A range inside the VNet. Resources get IPs from it; NSGs and route tables attach to it.'],
      ['NSG', 'Network security group: stateful rules (priority, source, destination, port, allow/deny) on a subnet or NIC.'],
      ['private endpoint', 'A NIC with a private IP in your subnet that maps to one specific PaaS resource (and sub-resource).'],
      ['service endpoint', 'A subnet setting that sends traffic to a PaaS service over the backbone with the subnet’s identity, so the service firewall can allow that subnet. The service keeps its public IP.'],
      ['private DNS zone', 'An Azure DNS zone (e.g. <code>privatelink.blob.core.windows.net</code>) visible only to VNets linked to it.'],
      ['hub-spoke', 'A topology where a central hub VNet holds shared services (firewall, VPN/ExpressRoute gateway, DNS) and workload spokes peer with it.']
    ]
  },
  visual: {
    title: 'How the name becomes a private IP',
    caption: 'Pick a case and press Play. Watch <code>stordersprod.blob.core.windows.net</code> resolve: public DNS returns a <code>privatelink</code> CNAME, and the linked private zone returns <code>10.1.2.5</code>. Then break it (no zone link), compare a service endpoint, and resolve from on-premises.'
  },
  extras: [
    { id: 'vnet-private-endpoints-net', title: 'NSG evaluation and hub-spoke routing', label: 'NSGs & hub-spoke', caption: '<b>NSG</b>: step through rule priorities for an inbound and an outbound flow, including the default rules. <b>Hub-spoke</b>: see why peering isn’t transitive, and how a firewall in the hub plus a route table connects spokes and on-premises.' }
  ],
  gotchas: [
    { trap: 'Private DNS zone not linked to the VNet that resolves', code: `# from the app's subnet
nslookup stordersprod.blob.core.windows.net
# → stordersprod.privatelink.blob.core.windows.net → 20.60.x.x   (public!)`, why: 'The zone exists and has the A record, but it is linked only to the hub, or to a different spoke. The VNet’s resolver never consults it, so the CNAME chain continues to the public IP, which is blocked once public access is disabled.', fix: 'Link every resolving VNet to the zone (or centralise DNS in the hub with Azure DNS Private Resolver and point spokes’ DNS servers to it). Check with <code>nslookup</code> from the actual workload, not from your laptop.' },
    { trap: 'Connecting to the privatelink name directly', why: 'Using <code>stordersprod.privatelink.blob.core.windows.net</code> in a connection string looks explicit, but TLS certificates are issued for the public name, and some services reject or mis-route requests to that host name.', fix: 'Always use the normal public FQDN. The CNAME chain is what makes it private. That way the same config works inside and outside.' },
    { trap: 'On-premises DNS forwards the wrong zone', why: 'Conditional forwarders for <code>privatelink.blob.core.windows.net</code> only help clients that query that name directly. Clients ask for <code>stordersprod.blob.core.windows.net</code>, which on-premises DNS resolves through the internet, ending at the public IP.', fix: 'Forward the <b>public</b> zone (<code>blob.core.windows.net</code>, <code>vault.azure.net</code>, …) to an Azure DNS Private Resolver inbound endpoint (or a DNS forwarder VM) in the hub, which then resolves through the linked private zones.' },
    { trap: 'Service endpoints are not a data-exfiltration control', why: 'A storage service endpoint lets the subnet reach <b>any</b> storage account over the backbone, including an attacker’s, unless you add service endpoint policies. It also doesn’t work from on-premises or peered networks.', fix: 'Use private endpoints per resource for sensitive data, with public access disabled. If you use service endpoints for storage, add a service endpoint policy that lists the allowed accounts.' },
    { trap: 'Subnets sized for today', why: 'Delegated subnets (App Service VNet integration, Container Apps environments, Postgres flexible server private access, AKS with flat CNI) can’t be resized freely once in use, and Azure keeps 5 IPs in every subnet. Scale-out, upgrades and new endpoints need addresses.', fix: 'Plan generous, non-overlapping ranges per spoke, a dedicated subnet per delegated service sized for its documented minimum and growth, and a separate subnet for private endpoints.' },
    { trap: 'Assuming peering is transitive', why: 'Spoke A ↔ hub and hub ↔ spoke B does <b>not</b> let A reach B. Peering only connects the two VNets in the pair.', fix: 'Route spoke-to-spoke traffic through a hub firewall or NVA with user-defined routes (<code>0.0.0.0/0</code> or the spoke ranges → firewall IP), or use Azure Virtual WAN. Use gateway transit for on-premises connectivity.' },
    { trap: 'Picking Postgres networking mode at creation without thinking', why: 'Azure Database for PostgreSQL flexible server has two models: <b>public access</b> (firewall rules, optionally with private endpoints) and <b>private access</b> (VNet integration into a delegated subnet). The choice is made when the server is created.', fix: 'Decide per environment before creating the server. Private endpoints fit hub-spoke setups with central DNS; VNet integration needs a delegated subnet and its own private DNS zone.' }
  ],
  scenarios: [
    { title: 'App gets 403 from storage right after “locking it down”',
      symptom: 'The platform team disabled public network access on <code>stordersprod</code> after creating a private endpoint. The orders app in spoke 1 now fails with <code>403 AuthorizationFailure: This request is not authorized to perform this operation</code>.',
      diagnose: `# from a container in the app's subnet
nslookup stordersprod.blob.core.windows.net
#   canonical name = stordersprod.privatelink.blob.core.windows.net
#   Address: 20.60.144.4            ← public IP
az network private-dns link vnet list -g rg-dns -z privatelink.blob.core.windows.net -o table
#   only vnet-hub is linked`,
      cause: 'The private DNS zone was linked only to the hub VNet. The app’s spoke used Azure-provided DNS, which couldn’t see the zone, so it resolved to the public endpoint, where access was now denied.',
      fix: 'Link the zone to the spoke (or set the spoke’s DNS servers to the hub’s DNS Private Resolver inbound endpoint). Retest resolution from the workload.',
      fixCode: `az network private-dns link vnet create -g rg-dns -z privatelink.blob.core.windows.net \\
  -n link-vnet-orders --virtual-network $SPOKE1_VNET_ID --registration-enabled false` },
    { title: 'Developers on VPN can’t reach Key Vault; the app can',
      symptom: 'Pipelines and apps in Azure read secrets fine. Engineers on the corporate VPN time out connecting to <code>kv-orders.vault.azure.net</code>.',
      diagnose: `# on a laptop on VPN
Resolve-DnsName kv-orders.vault.azure.net    # → public IP; the vault denies public access
# corporate DNS has a forwarder for privatelink.vaultcore.azure.net only`,
      cause: 'On-premises DNS forwarded the <code>privatelink</code> zone, but clients query <code>vault.azure.net</code>, which was resolved on the internet.',
      fix: 'Add conditional forwarders for <code>vault.azure.net</code> (and the other public service zones in use) to the DNS Private Resolver inbound endpoint in the hub.',
      fixCode: `az dns-resolver inbound-endpoint create -g rg-hub --dns-resolver-name dnspr-hub -n inbound \\
  --ip-configurations '[{"private-ip-allocation-method":"Dynamic","id":"'$HUB_SNET_INBOUND_ID'"}]'
# on-prem DNS: forward vault.azure.net, blob.core.windows.net, postgres.database.azure.com → inbound endpoint IP` },
    { title: 'Spoke-to-spoke calls time out after a “simple” peering',
      symptom: 'The orders spoke calls the payments spoke’s internal API. Both are peered to the hub. Calls time out.',
      diagnose: `az network vnet peering list -g rg-net-spoke1 --vnet-name vnet-orders -o table   # only → hub
az network nic show-effective-route-table -g rg-orders -n nic-orders-vm -o table
# no route for 10.2.0.0/16 (payments)`,
      cause: 'Peering isn’t transitive, and no route sent spoke 1 → spoke 2 traffic through the hub firewall.',
      fix: 'Add a route table on spoke subnets that sends the other spokes’ ranges (or 0.0.0.0/0) to the Azure Firewall private IP, and allow the flow in the firewall policy.',
      fixCode: `az network route-table route create -g rg-net-spoke1 --route-table-name rt-spoke1 -n to-spokes \\
  --address-prefix 10.0.0.0/8 --next-hop-type VirtualAppliance --next-hop-ip-address 10.0.1.4` }
  ],
  puzzles: [
    { kind: 'predict', q: 'A VM in a VNet linked to <code>privatelink.blob.core.windows.net</code> resolves <code>stordersprod.blob.core.windows.net</code>, which has a private endpoint at 10.1.2.5. What answer does it get?', options: ['The public IP', 'NXDOMAIN', 'A CNAME to stordersprod.privatelink.blob.core.windows.net, then 10.1.2.5', '10.1.2.5 directly, with no CNAME'], answer: 2, explain: 'Public DNS answers with the <code>privatelink</code> CNAME. The VNet’s resolver finds that name in the linked private zone and returns the A record, <b>10.1.2.5</b>.' },
    { kind: 'scenario', q: 'On-premises clients must reach a private endpoint. Which conditional forwarder do you add on corporate DNS?', options: ['privatelink.blob.core.windows.net → 8.8.8.8', 'blob.core.windows.net → the DNS Private Resolver inbound endpoint in Azure', 'blob.core.windows.net → 168.63.129.16 directly', 'No forwarder; use the hosts file'], answer: 1, explain: 'Clients ask for the public name, so forward the public zone. 168.63.129.16 is only reachable from inside Azure VNets, so on-premises needs an inbound endpoint (or a forwarder VM) to reach it.' },
    { kind: 'scenario', q: 'Which statement about service endpoints is true?', options: ['They give the service a private IP in your subnet', 'They work from on-premises over ExpressRoute', 'The service keeps its public IP, and its firewall can allow your subnet as the source', 'They are per resource, like private endpoints'], answer: 2, explain: 'A service endpoint changes the route and the source identity for traffic from your subnet. The destination stays public, and the setting applies to the whole service, not one resource.' },
    { kind: 'predict', q: 'An NSG has rules: 100 Allow TCP 443 from VirtualNetwork, 200 Deny TCP 443 from 10.1.5.0/24, and the defaults. A packet arrives from 10.1.5.20 (inside the VNet) on 443. Result?', options: ['Denied by rule 200', 'Allowed by rule 100', 'Denied by DenyAllInBound', 'Allowed by AllowVnetInBound only'], answer: 1, explain: 'Rules are evaluated in priority order and the first match wins. 10.1.5.20 is in the VirtualNetwork tag, so rule <b>100</b> allows it before 200 is considered. Put the more specific deny at a lower number.' },
    { kind: 'scenario', q: 'Spokes A and B are both peered to the hub. A calls B. What is needed?', options: ['Nothing: peering is transitive', 'A direct A↔B peering, or a hub firewall/NVA with UDRs on both spokes', 'A service endpoint', 'A private DNS zone'], answer: 1, explain: 'Peering isn’t transitive. Either peer the spokes directly, or route through a hub firewall (the usual choice, because it gives you inspection and central policy) or Virtual WAN.' },
    { kind: 'scenario', q: 'How many usable IPs does a /28 subnet give you in Azure?', options: ['16', '14', '11', '8'], answer: 2, explain: 'A /28 has 16 addresses. Azure reserves 5 (network, the first three hosts for the gateway and DNS, and broadcast), leaving <b>11</b>.' },
    { kind: 'scenario', q: 'An App Service app has VNet integration into snet-apps. Can a VM in the VNet now call the app privately?', options: ['Yes, VNet integration makes the app private', 'No: VNet integration is outbound only; for private inbound access add a private endpoint for the app', 'Only on port 80', 'Only with a service endpoint'], answer: 1, explain: 'Regional VNet integration lets the app <i>reach into</i> the VNet. Inbound private access is a separate feature: a private endpoint for the web app (plus its DNS zone, <code>privatelink.azurewebsites.net</code>).' }
  ],
  interview: [
    { q: 'Walk me through private endpoint DNS resolution.', a: '<ol><li>The client asks for <code>stordersprod.blob.core.windows.net</code>.</li><li>Because a private endpoint exists, Azure public DNS returns a CNAME to <code>stordersprod.privatelink.blob.core.windows.net</code>.</li><li>In a VNet linked to the private zone <code>privatelink.blob.core.windows.net</code>, Azure DNS (168.63.129.16) finds the A record: <code>10.1.2.5</code>.</li><li>Outside, public DNS continues the chain to the public IP.</li></ol><p>The client uses the normal name, and TLS validates against it.</p>', lvl: 'core' },
    { q: 'Private endpoint vs service endpoint: when do you use which?', a: '<p><b>Private endpoint</b>: a private IP for one resource; reachable from peered VNets and on-premises; lets you disable public access; costs per endpoint and needs DNS work. <b>Service endpoint</b>: free, simple, a subnet-level route plus source identity to a whole service; the service stays on its public IP; no on-premises access. Prefer private endpoints for production data services; service endpoints are fine for simpler cases or where private endpoints aren’t supported.</p>', lvl: 'core' },
    { q: 'How do NSGs evaluate traffic?', a: '<p>Rules have a priority (100–4096; lower is evaluated first), source, destination, port, protocol and allow/deny. The first matching rule wins. NSGs are stateful, so return traffic is allowed automatically. Default rules at 65000+ allow VNet-to-VNet and Azure Load Balancer probes inbound, allow internet outbound, and deny everything else. For inbound traffic the subnet NSG is evaluated, then the NIC NSG; outbound in reverse. Use service tags and application security groups instead of IP lists.</p>', lvl: 'core' },
    { q: 'Design DNS for private endpoints in a hub-spoke landing zone.', a: '<ul><li>Central private DNS zones (one per service, e.g. <code>privatelink.vaultcore.azure.net</code>) in the connectivity subscription.</li><li>Link them to the hub and every spoke, or set spokes to use a <b>DNS Private Resolver</b> in the hub.</li><li>On-premises conditional forwarders for the public service zones → resolver inbound endpoint.</li><li>Azure Policy to create the zone-group records automatically when teams create private endpoints, and to deny private zones created ad hoc in spokes.</li></ul>', lvl: 'deep' },
    { q: 'What is hub-spoke, and why is it common?', a: '<p>A hub VNet hosts shared connectivity: Azure Firewall, VPN or ExpressRoute gateways, Bastion and DNS. Each workload gets a spoke VNet peered to the hub, owned by its team. Spokes use the hub gateway (gateway transit) and route egress and spoke-to-spoke traffic through the firewall with UDRs. It centralises security and cost while isolating workloads. Azure Virtual WAN is the managed alternative at larger scale.</p>', lvl: 'core' },
    { q: 'How does a Spring Boot app on Container Apps reach Postgres, Key Vault and Storage privately?', a: '<p>Deploy the Container Apps environment into a spoke subnet (workload-profiles environments need a delegated subnet). Create private endpoints for Key Vault, Storage and Postgres in a PE subnet, with DNS zones linked to the spoke. Disable public access on each service. The app uses normal FQDNs and managed identity. Outbound internet goes through the hub firewall via a UDR, so egress is controlled too.</p>', lvl: 'deep' },
    { q: 'What do UDRs and the 0.0.0.0/0 route do, and what can go wrong?', a: '<p>User-defined routes override system routes. Sending <code>0.0.0.0/0</code> to a firewall forces all egress through inspection. Pitfalls: asymmetric routing when return traffic bypasses the firewall, breaking platform dependencies (some services need outbound access to Azure endpoints, so allow the right service tags or FQDNs in the firewall), and forgetting that more specific routes, such as peering routes, can win.</p>', lvl: 'deep' },
    { q: 'How do you troubleshoot “it works from my laptop but not from the app”?', a: '<ol><li>Resolve the name <b>from the workload</b> (Kudu console, <code>kubectl exec</code>, Container Apps console): is it a private IP?</li><li>Check the zone links and the VNet’s DNS server setting.</li><li>Check effective NSG rules and effective routes on the NIC.</li><li>Use Network Watcher’s connection troubleshoot and IP flow verify.</li><li>Check the service firewall: is public access disabled, and is the PE connection approved?</li></ol>', lvl: 'core' },
    { q: 'What is the difference between VNet injection, VNet integration and private endpoints for PaaS?', a: '<p><b>VNet injection</b>: the service’s instances are deployed into your subnet (APIM Premium internal mode, AKS, Container Apps environments, Postgres private access). <b>VNet integration</b> (App Service, Functions): outbound traffic from the app enters your VNet. <b>Private endpoint</b>: inbound access to a service through a private IP. Many architectures combine integration for outbound and private endpoints for inbound.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Bicep: private endpoint with DNS zone group', lang: 'bicep', code: `param stId string
param peSubnetId string
param vnetIds array      // every VNet that must resolve the name

resource zone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.blob.\${environment().suffixes.storage}'   // privatelink.blob.core.windows.net
  location: 'global'
}

resource links 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = [for (id, i) in vnetIds: {
  parent: zone
  name: 'link-\${i}'
  location: 'global'
  properties: { virtualNetwork: { id: id }, registrationEnabled: false }
}]

resource pe 'Microsoft.Network/privateEndpoints@2023-09-01' = {
  name: 'pe-stordersprod-blob'
  location: resourceGroup().location
  properties: {
    subnet: { id: peSubnetId }
    privateLinkServiceConnections: [{
      name: 'blob'
      properties: { privateLinkServiceId: stId, groupIds: ['blob'] }
    }]
  }
}

resource zg 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = {
  parent: pe
  name: 'default'
  properties: { privateDnsZoneConfigs: [{ name: 'blob', properties: { privateDnsZoneId: zone.id } }] }
}`, note: 'The zone group keeps the A record in sync with the endpoint’s IP, so you never edit it by hand.' },
    { title: 'Common privatelink zones', lang: 'text', code: `Blob Storage              privatelink.blob.core.windows.net
Data Lake (dfs)           privatelink.dfs.core.windows.net
Key Vault                 privatelink.vaultcore.azure.net
Postgres flexible server  privatelink.postgres.database.azure.com
Azure SQL Database        privatelink.database.windows.net
Cosmos DB (NoSQL)         privatelink.documents.azure.com
Service Bus / Event Hubs  privatelink.servicebus.windows.net
Azure Cache for Redis     privatelink.redis.cache.windows.net
App Service / Functions   privatelink.azurewebsites.net
Azure OpenAI / AI         privatelink.openai.azure.com, privatelink.cognitiveservices.azure.com`, note: 'Check Microsoft Learn’s “Private endpoint DNS zone values” page for your service and cloud; some services need more than one zone.' },
    { title: 'Troubleshooting from the workload', lang: 'bash', code: `# resolution as the app sees it (Container Apps)
az containerapp exec -g rg-orders -n orders-api --command "nslookup stordersprod.blob.core.windows.net"

# effective NSG rules and routes on a NIC
az network nic list-effective-nsg -g rg-orders -n nic-orders-vm -o table
az network nic show-effective-route-table -g rg-orders -n nic-orders-vm -o table

# is the private endpoint connection approved?
az network private-endpoint-connection list --id $ST_ID \\
  --query "[].{name:name, status:properties.privateLinkServiceConnectionState.status}" -o table

# Network Watcher: can this VM reach the endpoint on 443?
az network watcher test-connectivity -g rg-orders --source-resource vm-jump \\
  --dest-address stordersprod.blob.core.windows.net --dest-port 443` }
  ]
});
