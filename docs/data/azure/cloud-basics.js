IA.register({
  track: 'azure',
  slug: 'cloud-basics',
  title: 'Cloud basics',
  tagline: 'The cloud is <b>someone else’s datacenter, rented by the minute through an API</b>. The service model (IaaS, PaaS, SaaS) decides which layers you still manage. Your data and access settings are always yours.',
  tldr: {
    problem: 'Developers new to cloud treat it like a remote server: they pick VMs for everything, leave resources running, and assume “Microsoft handles security”. The result is more ops work, surprise bills and open storage.',
    model: 'Picture your app as a <b>stack of layers</b>: building, hardware, VM, OS, runtime, app, data. Each service model moves the line between “Microsoft runs it” and “you run it”. Every resource has a <b>meter</b>; you pay while it exists or runs, in a <b>region</b> you choose.',
    hook: '“Who patches the OS on App Service?” Microsoft does: it is PaaS. On a VM (IaaS) you do. In both, misconfigured access to your data is your problem.',
    facts: [
      { v: '3', l: 'classic service models: IaaS (e.g. VMs), PaaS (e.g. App Service), SaaS (e.g. Microsoft 365)' },
      { v: 'Always yours', l: 'data, endpoints, accounts and access management, in every model, per Microsoft’s shared responsibility guidance' },
      { v: 'stop ≠ deallocate', l: 'a VM stopped from inside the OS or with <code>az vm stop</code> still bills compute; <code>az vm deallocate</code> releases it' }
    ]
  },
  intro: {
    what: 'Instead of buying servers, you <b>rent</b> computing power, storage and managed services from a provider like Azure. You create them on demand from a web portal, a CLI or code, use them for minutes or years, and pay for what you use. Azure runs datacenters in many <b>regions</b> around the world; you pick where each resource lives.',
    analogy: { icon: '🍕', title: 'Pizza as a service', text: 'Make pizza at home: you buy the oven, flour and gas (on-prem). Take-and-bake: the shop makes the dough, you bake it (IaaS). Delivery: you just set the table (PaaS). Dining out: you just eat (SaaS). In each case you still decide who gets a slice: that is your data and access.' },
    steps: [
      { t: 'Pick a service model', d: '<b>IaaS</b> gives you a VM to manage. <b>PaaS</b> runs your jar or container and patches everything under it. <b>SaaS</b> is finished software you configure.' },
      { t: 'Know your half of the deal', d: 'Under <b>shared responsibility</b>, the provider secures the physical layers. You secure what you control: data, identities, network rules, and with IaaS, the OS.' },
      { t: 'Pay as you go', d: 'No up-front purchase. Each resource has meters (per hour, per GB, per request). Delete it and the meter stops.', code: 'az group delete --name rg-demo --yes --no-wait', lang: 'bash' },
      { t: 'Choose a region', d: 'A region is a set of datacenters in one geography, e.g. <code>westeurope</code>. Choose it for latency to users, data residency rules and service availability. See <a href="regions-zones.html">Regions & zones</a>.' }
    ],
    terms: [
      ['IaaS', 'Infrastructure as a Service: rented VMs, disks and networks. You manage the OS and up.'],
      ['PaaS', 'Platform as a Service: you bring code; the platform runs and patches the servers.'],
      ['SaaS', 'Software as a Service: complete applications used over the internet.'],
      ['shared responsibility', 'The split of security duties between the cloud provider and you.'],
      ['region', 'A geographic area with one or more datacenters, such as <code>westeurope</code> or <code>eastus</code>.'],
      ['elasticity', 'Adding or removing capacity quickly as load changes, and paying only for what you use.']
    ]
  },
  visual: {
    title: 'Who manages which layer, and which meter is running',
    caption: 'Choose a view. <b>Who manages what</b> steps from on-prem to SaaS and colours each layer by owner. <b>Pay as you go</b> follows a VM through stop, deallocate and delete. Press Play or Step.'
  },
  gotchas: [
    { trap: '“It’s in the cloud, so Microsoft secures it”', why: 'The provider secures the datacenter and the platform. Who can read your blob container or reach your database is configuration you own.', fix: 'Learn the shared responsibility split for each service you use. Start with identity: <a href="entra-managed-identity.html">Entra & managed identities</a>.' },
    { trap: 'Lift-and-shift everything onto VMs', why: 'A VM keeps all the patching, JDK upgrades and scaling work you had on-prem, so you pay cloud prices for on-prem effort.', fix: 'For a Spring Boot web app, start with PaaS (App Service or Container Apps). Use VMs when you need OS-level control. See <a href="compute-choice.html">Choosing compute</a>.' },
    { trap: 'Stopping a VM from inside the OS', code: 'sudo shutdown now     # VM is stopped but still allocated: compute bills\naz vm deallocate -g rg-demo -n vm1   # compute meter stops', lang: 'bash', why: 'Only a <i>deallocated</i> VM stops billing compute. Disks and public IPs bill either way.', fix: 'Deallocate (the portal’s Stop button does this), or delete the resource group when finished.' },
    { trap: 'Forgetting resources after a tutorial', why: 'Pay-as-you-go means a forgotten database or App Service plan bills every hour, even with zero traffic.', fix: 'Put every experiment in its own resource group and delete the group. Set a budget alert. See <a href="cost-management.html">Cost management</a>.' },
    { trap: 'Picking a region at random', why: 'Not every service or VM size is offered in every region, latency grows with distance, and some data must legally stay in a country.', fix: 'Pick one region near your users that offers the services you need, and keep related resources together in it.' }
  ],
  scenarios: [
    { title: 'Monthly bill doubles for a “dead” proof of concept',
      symptom: 'A demo built three months ago gets no traffic, yet the subscription bill keeps rising.',
      diagnose: 'az resource list --query "[].{name:name, type:type, rg:resourceGroup}" -o table',
      cause: 'The demo’s VMs were shut down from inside the OS (still allocated), and a database server and App Service plan were never deleted.',
      fix: 'Delete the demo resource groups. Use one resource group per experiment, tag owners, and add a budget alert.',
      fixCode: 'az group delete -n rg-poc-search --yes --no-wait\naz group list --query "[?tags.owner==null].name" -o tsv', lang: 'bash' },
    { title: 'Customer data readable by anyone with the URL',
      symptom: 'A security scan finds invoice PDFs downloadable without signing in.',
      diagnose: 'az storage account show -n stinvoices --query allowBlobPublicAccess',
      cause: 'A container was made public for a quick test. The team assumed the cloud provider would stop it. Under shared responsibility, access settings are the customer’s job.',
      fix: 'Disable public blob access on the account, rotate any shared links, and use Entra RBAC or short-lived SAS for downloads.',
      fixCode: 'az storage account update -n stinvoices -g rg-billing --allow-blob-public-access false', lang: 'bash' }
  ],
  puzzles: [
    { kind: 'concept', q: 'You deploy a Spring Boot jar to App Service. Who installs security patches for the Linux OS underneath?', options: ['You, over SSH', 'Microsoft, because App Service is PaaS', 'Nobody; containers don’t need patches', 'Your Java framework'], answer: 1, explain: 'In PaaS the platform owns the OS and runtime. You still own the app’s dependencies (e.g. a vulnerable library in your jar) and its configuration.' },
    { kind: 'concept', q: 'Which responsibility stays with you in <b>all</b> service models, including SaaS?', options: ['Physical datacenter security', 'Hypervisor patching', 'Your data and who can access it', 'Network cabling'], answer: 2, explain: 'Data, accounts and access management are always the customer’s. The physical layers are always the provider’s.' },
    { kind: 'concept', q: 'You run <code>sudo shutdown now</code> on an Azure VM. What happens to billing?', options: ['All billing stops', 'Compute keeps billing because the VM is still allocated', 'Only the disk stops billing', 'The VM is deleted'], answer: 1, explain: 'Shutting down inside the guest leaves the VM “Stopped” but allocated. Deallocate it to stop compute charges. Disks still bill.' },
    { kind: 'concept', q: 'Which is an example of IaaS?', options: ['Azure Virtual Machines', 'Microsoft 365', 'Azure App Service', 'Azure Functions'], answer: 0, explain: 'VMs give you raw infrastructure. App Service and Functions are PaaS (Functions is often called serverless). Microsoft 365 is SaaS.' },
    { kind: 'concept', q: 'Why might you choose <code>westeurope</code> over <code>eastus</code> for a German retailer’s app?', options: ['It is always cheaper', 'Lower latency to users and data-residency requirements', 'Only westeurope supports Java', 'Regions don’t matter'], answer: 1, explain: 'Region choice is about latency, compliance and which services are available. Prices vary by region, but not in a fixed direction.' },
    { kind: 'concept', q: 'What does “elasticity” mean in cloud computing?', options: ['Resources stretch to any size for free', 'Capacity can be added and removed quickly to follow demand, billed for what is used', 'Data is copied to every region', 'VMs restart automatically'], answer: 1, explain: 'Elasticity is scaling out and back in with load. Paired with pay-as-you-go, you stop paying for capacity you release.' }
  ],
  interview: [
    { q: 'Explain IaaS, PaaS and SaaS with an Azure example of each.', a: '<p><b>IaaS</b>: Azure VMs; you manage OS and up. <b>PaaS</b>: App Service or Azure Database for PostgreSQL; you bring code or schema, the platform patches and runs it. <b>SaaS</b>: Microsoft 365; you only configure and use it.</p>', fu: 'Where does Kubernetes (AKS) fit?', lvl: 'core' },
    { q: 'What is the shared responsibility model?', a: '<p>Security duties are split. The provider always owns the physical layers. The customer always owns data, identities and access. The middle (OS, network controls, apps) shifts toward the provider as you go from IaaS to SaaS.</p>', lvl: 'core' },
    { q: 'What does pay-as-you-go mean and what are its risks?', a: '<p>You pay per use (hours, GB, requests) with no up-front purchase. Risks: forgotten resources, runaway autoscale, and egress or log ingestion growing silently. Mitigate with budgets, tags and one resource group per workload.</p>', lvl: 'core' },
    { q: 'How do you choose a region?', a: '<ul><li>Latency to users and dependencies</li><li>Data residency and compliance</li><li>Service and VM-size availability</li><li>Availability zones support and price</li></ul><p>Keep chatty components in the same region.</p>', fu: 'What are availability zones?', lvl: 'core' },
    { q: 'Why might a team move a Spring Boot app from VMs to PaaS?', a: '<p>To stop managing OS patches, JDK installs and load balancers, and to get built-in scaling, deployment slots and HTTPS. The trade-off is less control over the host.</p>', lvl: 'core' },
    { q: 'What is the difference between scaling up and scaling out?', a: '<p><b>Up</b> (vertical): a bigger machine. <b>Out</b> (horizontal): more instances behind a load balancer. Cloud favours out, which requires stateless app instances (sessions in Redis or a DB, files in Blob).</p>', lvl: 'core' },
    { q: 'CapEx vs OpEx: what changes with cloud?', a: '<p>On-prem is capital expense: buy servers up front and depreciate them. Cloud is operating expense: pay monthly for consumption. Reserved capacity or savings plans trade some flexibility for a lower rate.</p>', lvl: 'core' },
    { q: 'An IaaS VM is compromised through an unpatched OS package. Whose fault is it under shared responsibility?', a: '<p>The customer’s. On IaaS the guest OS is yours to patch. Tools like Azure Update Manager help, but you must use them.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Your first look around', lang: 'bash', code: '# which regions can this subscription use?\naz account list-locations --query "[].name" -o tsv\n\n# a throwaway group for experiments\naz group create --name rg-sandbox --location westeurope --tags owner=me purpose=learning\n\n# ...try things...\n\n# stop every meter in one go\naz group delete --name rg-sandbox --yes --no-wait', note: 'One resource group per experiment makes cleanup a single command.' },
    { title: 'IaaS vs PaaS for the same jar', lang: 'bash', code: '# IaaS: you own the OS\naz vm create -g rg-sandbox -n vm-app --image Ubuntu2204 --admin-username azureuser --generate-ssh-keys\n# ...then ssh in, install a JDK, copy the jar, write a systemd unit, patch forever\n\n# PaaS: you own the jar\naz webapp up --name app-hello-$RANDOM --runtime "JAVA:21-java21" --os-type linux', note: 'Runtime strings change over time; list current ones with <code>az webapp list-runtimes --os-type linux</code>.' }
  ]
});
