IA.register({
  track: 'azure',
  slug: 'azure-networking-basics',
  title: 'Networking basics',
  tagline: 'A <b>VNet</b> is your private network in a region, cut into <b>subnets</b>. <b>NSGs</b> are allow/deny lists on those subnets. Only resources with a <b>public IP</b> (or a public endpoint) are reachable from the internet, and <b>DNS</b> turns names into those addresses.',
  tldr: {
    problem: 'Beginners give every VM and database a public IP “to make it work”, open port 22 or 5432 to the whole internet, and then can’t explain why the app can’t reach its database once someone tightens things.',
    model: 'Address space (<code>10.0.0.0/16</code>) → subnets (<code>10.0.1.0/24</code>) → resources with <b>private IPs</b>. An NSG on a subnet or NIC filters traffic by priority, first match wins. A public IP or load balancer is the door from outside. DNS is the street sign pointing at the door.',
    hook: '“Why is my /29 subnet full after three VMs?” Azure reserves <b>5 addresses</b> in every subnet.',
    facts: [
      { v: '5', l: 'IP addresses Azure reserves in every subnet (network, gateway, two for DNS, broadcast)' },
      { v: '100–4096', l: 'priority range for your own NSG rules; lower numbers are checked first and the first match wins' },
      { v: '168.63.129.16', l: 'the Azure-provided virtual IP that answers DNS for resources in a VNet by default' }
    ]
  },
  intro: {
    what: 'A <b>virtual network (VNet)</b> is a private network you define in an Azure region. You split it into <b>subnets</b> and place resources such as VMs in them; each gets a <b>private IP</b>. Resources in the same VNet can talk to each other. A <b>network security group (NSG)</b> is a firewall rule list. A <b>public IP</b> makes something reachable from the internet. <b>DNS</b> maps names to IPs.',
    analogy: { icon: '🏘️', title: 'A gated neighbourhood', text: 'The VNet is the estate, subnets are streets, private IPs are house numbers. The NSG is the guard with a list: “deliveries on port 443 allowed, everyone else turned away”. A public IP is the single front gate with an address outsiders can find. DNS is the map app that turns “Orders Ltd” into that gate’s address.' },
    steps: [
      { t: 'Plan an address space', d: 'Pick a private range that won’t clash with your office or other VNets, e.g. <code>10.20.0.0/16</code> (65,536 addresses).', code: 'az network vnet create -g rg-net -n vnet-orders --address-prefixes 10.20.0.0/16', lang: 'bash' },
      { t: 'Cut subnets by role', d: 'One for the app tier, one for data, one for private endpoints. Each subnet loses 5 addresses to Azure.', code: 'az network vnet subnet create -g rg-net --vnet-name vnet-orders -n snet-app --address-prefixes 10.20.1.0/24', lang: 'bash' },
      { t: 'Add an NSG', d: 'Default rules allow traffic inside the VNet and deny inbound from the internet. Add only what you need, e.g. 443 inbound to the app subnet.' },
      { t: 'Public vs private', d: 'Give a public IP only to the entry point (a load balancer, gateway or one web VM). Databases stay private. PaaS services reach VNets through <b>private endpoints</b>; see <a href="vnet-private-endpoints.html">VNets & private endpoints</a>.' },
      { t: 'Names, not numbers', d: 'Public names live in a public DNS zone (Azure DNS or your registrar). Inside a VNet, Azure DNS resolves VM names and <b>private DNS zones</b> resolve private endpoints.' }
    ],
    terms: [
      ['VNet', 'A private network in one region with one or more address ranges.'],
      ['subnet', 'A slice of a VNet’s range. NSGs and route tables attach here.'],
      ['CIDR', 'Range notation: <code>/16</code> = 65,536 addresses, <code>/24</code> = 256.'],
      ['NSG', 'Network security group: ordered allow/deny rules by source, destination, port and protocol.'],
      ['public IP', 'An internet-routable address resource you attach to a VM NIC, load balancer or gateway.'],
      ['private DNS zone', 'A DNS zone visible only to linked VNets, e.g. for <code>privatelink</code> names.']
    ]
  },
  visual: {
    title: 'Follow a packet into a VNet',
    caption: '<b>Internet → app</b> follows a request through DNS, a public IP and an NSG to a VM, then privately to the database. <b>Internet → database</b> shows why the database is unreachable from outside. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Opening SSH/RDP or 5432 to “Any”', code: 'az network nsg rule create ... --source-address-prefixes "*" --destination-port-ranges 22   # don’t', lang: 'bash', why: 'Internet scanners find open management and database ports within minutes.', fix: 'Keep these ports closed to the internet. Use Azure Bastion or a VPN for admin access, and allow 5432 only from the app subnet.' },
    { trap: 'Overlapping address spaces', why: 'Two VNets (or a VNet and your office network) using <code>10.0.0.0/16</code> can’t be peered or connected by VPN later.', fix: 'Agree an IP plan early, with a distinct range per VNet and environment.' },
    { trap: 'Subnets too small', why: 'A /29 has 8 addresses minus 5 reserved = 3 usable. Some services (e.g. App Service VNet integration, AKS, Container Apps) need dedicated subnets with room to scale.', fix: 'Size subnets generously; check each service’s documented minimum before creating them.' },
    { trap: 'Rule priority surprises', why: 'NSG rules run from lowest priority number upward and stop at the first match. A broad deny at 100 hides an allow at 200.', fix: 'Leave gaps (100, 200, 300…), keep allow rules specific, and use “Effective security rules” on a NIC to see the combined result.' },
    { trap: 'Expecting a PaaS service to be private because the app is in a VNet', why: 'Postgres Flexible Server, Storage and Key Vault have public endpoints by default. Your VNet doesn’t change that.', fix: 'Use private access / private endpoints and disable public network access. See <a href="vnet-private-endpoints.html">Private endpoints</a>.' }
  ],
  scenarios: [
    { title: 'App can’t reach the database after a “security hardening” change',
      symptom: 'Spring Boot fails at startup with <code>Connection timed out</code> to <code>10.20.2.4:5432</code>.',
      diagnose: 'az network nic list-effective-nsg -g rg-orders -n vm-app-nic -o table\naz network watcher test-ip-flow -g rg-orders --vm vm-app --direction Outbound --protocol TCP --local 10.20.1.4:50000 --remote 10.20.2.4:5432',
      cause: 'A new rule “Deny VirtualNetwork inbound” at priority 100 on the db subnet NSG beat the allow-5432 rule at priority 300.',
      fix: 'Put the specific allow at a lower number than the broad deny.',
      fixCode: 'az network nsg rule create -g rg-orders --nsg-name nsg-db -n allow-pg-from-app --priority 90 \\\n  --direction Inbound --access Allow --protocol Tcp \\\n  --source-address-prefixes 10.20.1.0/24 --destination-port-ranges 5432', lang: 'bash' },
    { title: 'Brute-force alerts on a dev VM',
      symptom: 'Thousands of failed SSH logins per hour on a test VM.',
      diagnose: 'az network nsg rule list -g rg-dev --nsg-name vm-dev-nsg --query "[?destinationPortRange==\'22\']" -o table',
      cause: 'The quick-create wizard added a public IP and an NSG rule allowing SSH from any source.',
      fix: 'Remove the public IP or restrict SSH to your own IP; better, use Azure Bastion or <code>az ssh</code> with Entra login.',
      fixCode: 'az network nsg rule update -g rg-dev --nsg-name vm-dev-nsg -n default-allow-ssh --source-address-prefixes 203.0.113.10/32', lang: 'bash' }
  ],
  puzzles: [
    { kind: 'concept', q: 'How many usable addresses does a <code>/28</code> subnet give you in Azure?', options: ['16', '14', '11', '8'], answer: 2, explain: 'A /28 has 16 addresses; Azure reserves 5 (first four and last), leaving 11.' },
    { kind: 'concept', q: 'An NSG has <i>Allow 443</i> at priority 300 and <i>Deny all inbound from Internet</i> at priority 200. Does HTTPS from the internet get in?', options: ['Yes, allows win', 'No, 200 is evaluated first and matches', 'Yes, the higher number wins', 'Only on weekdays'], answer: 1, explain: 'Lower numbers are processed first and processing stops at the first match.' },
    { kind: 'concept', q: 'Two VMs in different subnets of the same VNet, default NSG rules. Can they talk?', options: ['No, subnets are isolated', 'Yes, the default AllowVnetInBound rule permits it', 'Only with peering', 'Only through a public IP'], answer: 1, explain: 'Azure routes between subnets of a VNet automatically and the default rules allow VirtualNetwork traffic.' },
    { kind: 'concept', q: 'Which resource should usually have a public IP?', options: ['The Postgres VM', 'Every VM, for easy SSH', 'The internet-facing entry point (e.g. load balancer or gateway)', 'None, ever'], answer: 2, explain: 'Expose only the front door. Everything behind it uses private IPs.' },
    { kind: 'concept', q: 'What does DNS do in this picture?', options: ['Encrypts traffic', 'Maps names like <code>orders.example.com</code> to IP addresses', 'Filters ports', 'Assigns subnets'], answer: 1, explain: 'DNS only resolves names. Filtering is the NSG’s job, encryption is TLS.' },
    { kind: 'concept', q: 'You plan VNets for dev and prod that you may later connect with peering. Which is right?', options: ['Both 10.0.0.0/16', 'dev 10.10.0.0/16, prod 10.20.0.0/16', 'Use public ranges', 'It doesn’t matter'], answer: 1, explain: 'Peered or VPN-connected networks must not overlap.' }
  ],
  interview: [
    { q: 'What is a VNet and a subnet?', a: '<p>A VNet is an isolated private network in one region with one or more CIDR ranges. Subnets divide it; resources get private IPs from a subnet, and NSGs and route tables attach to subnets.</p>', lvl: 'core' },
    { q: 'How does an NSG evaluate rules?', a: '<p>Separate inbound and outbound lists, processed by priority from low to high; the first match decides allow or deny. Default rules (65000+) allow VNet and load-balancer traffic and deny other inbound. NSGs are stateful: return traffic is allowed automatically.</p>', fu: 'NSG on the subnet and the NIC: how do they combine?', lvl: 'core' },
    { q: 'Public IP vs private IP?', a: '<p>Private IPs come from your VNet range and are reachable only inside it (or via peering/VPN). A public IP is a separate resource that is routable from the internet. Keep databases private.</p>', lvl: 'core' },
    { q: 'Why does Azure reserve 5 addresses per subnet?', a: '<p>The network address, the default gateway, two addresses used for Azure DNS mapping, and the broadcast address. Plan sizes with this in mind.</p>', lvl: 'core' },
    { q: 'How does name resolution work inside a VNet?', a: '<p>By default, Azure-provided DNS (at 168.63.129.16) resolves public names and VM host names. Private DNS zones linked to the VNet resolve private names, e.g. private endpoint records. You can also point the VNet at custom DNS servers.</p>', lvl: 'core' },
    { q: 'How would you let admins reach a VM without a public IP?', a: '<p>Azure Bastion, a VPN or ExpressRoute connection, or a jump host in a locked-down subnet. Avoid opening 22/3389 to the internet.</p>', lvl: 'core' },
    { q: 'What is VNet peering?', a: '<p>A private, low-latency connection between two VNets (same or different regions). Address spaces must not overlap, and peering is not transitive by default.</p>', lvl: 'deep' },
    { q: 'How does a PaaS service like Postgres Flexible Server join your network?', a: '<p>Either VNet integration (private access, deployed into a delegated subnet) or a private endpoint, plus a private DNS zone so its hostname resolves to the private IP. Then disable public access.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'A two-tier network with the CLI', lang: 'bash', code: 'RG=rg-net-dev; LOC=westeurope\naz group create -n $RG -l $LOC\naz network vnet create -g $RG -n vnet-orders --address-prefixes 10.20.0.0/16 \\\n  --subnet-name snet-app --subnet-prefixes 10.20.1.0/24\naz network vnet subnet create -g $RG --vnet-name vnet-orders -n snet-db --address-prefixes 10.20.2.0/24\n\naz network nsg create -g $RG -n nsg-db\naz network nsg rule create -g $RG --nsg-name nsg-db -n allow-pg-from-app --priority 100 \\\n  --direction Inbound --access Allow --protocol Tcp \\\n  --source-address-prefixes 10.20.1.0/24 --destination-port-ranges 5432\naz network vnet subnet update -g $RG --vnet-name vnet-orders -n snet-db --network-security-group nsg-db' },
    { title: 'Same thing in Bicep', lang: 'bicep', code: 'resource nsgDb \'Microsoft.Network/networkSecurityGroups@2023-11-01\' = {\n  name: \'nsg-db\'\n  location: resourceGroup().location\n  properties: { securityRules: [ {\n    name: \'allow-pg-from-app\'\n    properties: {\n      priority: 100\n      direction: \'Inbound\'\n      access: \'Allow\'\n      protocol: \'Tcp\'\n      sourceAddressPrefix: \'10.20.1.0/24\'\n      sourcePortRange: \'*\'\n      destinationAddressPrefix: \'*\'\n      destinationPortRange: \'5432\'\n    }\n  } ] }\n}\n\nresource vnet \'Microsoft.Network/virtualNetworks@2023-11-01\' = {\n  name: \'vnet-orders\'\n  location: resourceGroup().location\n  properties: {\n    addressSpace: { addressPrefixes: [ \'10.20.0.0/16\' ] }\n    subnets: [\n      { name: \'snet-app\', properties: { addressPrefix: \'10.20.1.0/24\' } }\n      { name: \'snet-db\', properties: { addressPrefix: \'10.20.2.0/24\', networkSecurityGroup: { id: nsgDb.id } } }\n    ]\n  }\n}' }
  ]
});
