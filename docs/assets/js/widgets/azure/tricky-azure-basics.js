/* Azure basics drill: a timed drill of 30 beginner / first-interview concept questions across the 6 Azure Basics topics, from cloud models to your first App Service deploy. Misses link back to the topic pages. */
IA.widget('tricky-azure-basics', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- Cloud basics ----------
    { t: 'Cloud basics', s: 'cloud-basics', q: 'Which service model leaves you managing the OS and its patches?', o: ['SaaS', 'PaaS', 'IaaS (e.g. a virtual machine)', 'None of them'], a: 2, x: 'With IaaS you rent the VM and run everything on it. PaaS (App Service) moves the OS and runtime to Microsoft.' },
    { t: 'Cloud basics', s: 'cloud-basics', q: 'Under shared responsibility, what is <b>always</b> your job, whatever the service model?', o: ['Physical security of the datacenter', 'Your data, and who has access to it (identities and permissions)', 'Patching the hypervisor', 'Replacing failed disks'], a: 1, x: 'Microsoft runs more layers as you move to PaaS and SaaS, but data, accounts and access settings stay yours.' },
    { t: 'Cloud basics', s: 'cloud-basics', q: 'You stop testing and forget a resource. How does pay-as-you-go treat it?', o: ['It is free when nobody uses it', 'It keeps billing while it exists or runs, per its meter, until you stop or delete it', 'Azure deletes it after a day', 'It bills only at the end of the year'], a: 1, x: 'This is why you put experiments in one resource group and delete the group when you are done.' },
    { t: 'Cloud basics', s: 'cloud-basics', q: 'Why does choosing a <b>region</b> matter?', o: ['It does not; all regions are identical', 'It affects latency to users, data residency rules, service availability and price', 'It only changes the portal language', 'It sets your password policy'], a: 1, x: 'Put resources that talk to each other in the same region, near your users, where the services you need exist.' },
    { t: 'Cloud basics', s: 'cloud-basics', q: 'Microsoft 365 email is an example of which model?', o: ['IaaS', 'PaaS', 'SaaS', 'On-premises'], a: 2, x: 'SaaS: you just use the finished application and manage users and data.' },
    // ---------- Portal & CLI ----------
    { t: 'Portal & CLI', s: 'azure-portal-cli', q: 'The portal, <code>az</code> CLI and Bicep all talk to which API?', o: ['Microsoft Graph only', 'Azure Resource Manager (ARM)', 'Each has its own private API', 'The Kubernetes API'], a: 1, x: 'One control plane, many front doors. That is why something created in the portal shows up in the CLI.' },
    { t: 'Portal & CLI', s: 'azure-portal-cli', q: 'You have two subscriptions. Before creating resources from the CLI, what should you check?', o: ['<code>az --version</code>', 'Which subscription is active (<code>az account show</code>, change with <code>az account set</code>)', 'Your browser cookies', 'Nothing; the CLI asks every time'], a: 1, x: 'The CLI uses the current subscription silently. Creating in the wrong one bills the wrong team or lands in production.' },
    { t: 'Portal & CLI', s: 'azure-portal-cli', q: 'What is a resource group?', o: ['A billing account', 'A container for resources that share a lifecycle; deleting it deletes everything inside', 'A network', 'A group of users'], a: 1, x: 'Group things you create and delete together. A resource lives in exactly one resource group.' },
    { t: 'Portal & CLI', s: 'azure-portal-cli', q: 'What is a subscription mainly?', o: ['A Microsoft 365 licence', 'A billing and access boundary that holds resource groups', 'A region', 'A virtual machine size'], a: 1, x: 'Tenant (identities) → subscriptions (billing + access) → resource groups → resources.' },
    { t: 'Portal & CLI', s: 'azure-portal-cli', q: 'What does this do?', code: 'az group delete --name rg-demo --yes --no-wait', lang: 'bash', o: ['Deletes only the group, keeping its resources', 'Deletes the group and every resource in it, without asking or waiting', 'Stops the resources but keeps billing', 'Moves the group to another region'], a: 1, x: 'The fastest cleanup after a lab, and the most dangerous command to run in the wrong subscription.' },
    // ---------- Services tour ----------
    { t: 'Services tour', s: 'azure-services-tour', q: 'A team wants to run a Spring Boot jar without managing VMs. The default first pick?', o: ['A virtual machine', 'App Service (or Container Apps if it ships as a container image)', 'Azure Functions only', 'Blob Storage'], a: 1, x: 'Both are PaaS. Move to AKS only when you need Kubernetes itself.' },
    { t: 'Services tour', s: 'azure-services-tour', q: 'Which service replaces a JMS / RabbitMQ broker for reliable business messages?', o: ['Blob Storage', 'Azure Service Bus', 'Azure DNS', 'Entra ID'], a: 1, x: 'Service Bus gives queues and topics with sessions, dead-lettering and transactions. Event Hubs is for high-volume event streams.' },
    { t: 'Services tour', s: 'azure-services-tour', q: 'Where do you store user-uploaded files such as PDFs and images?', o: ['In the App Service file system', 'Blob Storage', 'In a VNet', 'In Key Vault'], a: 1, x: 'Object storage is cheap and durable. Local app disk is not shared between instances.' },
    { t: 'Services tour', s: 'azure-services-tour', q: 'What does Microsoft Entra ID provide?', o: ['Relational databases', 'Identity: users, groups, app registrations, sign-in (OAuth/OIDC) and managed identities', 'Virtual networks', 'Monitoring dashboards'], a: 1, x: 'Formerly Azure Active Directory. It is the LDAP/OAuth box in the on-prem mapping.' },
    { t: 'Services tour', s: 'azure-services-tour', q: 'Your app uses PostgreSQL today. The managed Azure default?', o: ['Cosmos DB only', 'Azure Database for PostgreSQL Flexible Server', 'Table Storage', 'Install Postgres on Blob Storage'], a: 1, x: 'Managed backups, patching and high-availability options, with the same Postgres your JDBC driver already speaks.' },
    // ---------- Storage ----------
    { t: 'Storage', s: 'azure-storage-basics', q: 'Which four data services live in one storage account?', o: ['SQL, Cosmos, Redis, Search', 'Blob, Queue, Table, Files', 'VM, Disk, NIC, IP', 'Hot, Cool, Cold, Archive'], a: 1, x: 'Each has its own endpoint URL. Hot/Cool/Cold/Archive are blob access tiers, not services.' },
    { t: 'Storage', s: 'azure-storage-basics', q: 'What is the catch with the Archive tier?', o: ['Data is deleted after 30 days', 'Blobs are offline: you must rehydrate them before reading, which can take hours', 'It cannot store files over 1 MB', 'It is the most expensive tier to store data'], a: 1, x: 'Cheapest to store, slowest and costliest to read. Good for compliance copies, not for anything an app reads.' },
    { t: 'Storage', s: 'azure-storage-basics', q: 'What is a SAS?', o: ['A storage account backup', 'A signed, expiring URL or token granting limited access to specific storage resources', 'A type of blob', 'A firewall rule'], a: 1, x: 'Share one blob for an hour without handing over keys. Keep the expiry short and the permissions narrow.' },
    { t: 'Storage', s: 'azure-storage-basics', q: 'Which way for your app to access storage is preferred?', o: ['The account key in application.properties', 'Entra ID RBAC, e.g. a managed identity with a Storage Blob Data role', 'A SAS that never expires', 'Making the container public'], a: 1, x: 'No secret to leak or rotate. The account key can do everything to the whole account.' },
    { t: 'Storage', s: 'azure-storage-basics', q: 'Storage account names must be…', o: ['Unique within your resource group', 'Globally unique, 3–24 lowercase letters and digits, because they become part of a public URL', 'Any string with dashes', 'Unique within the region only'], a: 1, x: 'The name forms <code>&lt;name&gt;.blob.core.windows.net</code>, so it must be unique across all of Azure.' },
    // ---------- Networking ----------
    { t: 'Networking', s: 'azure-networking-basics', q: 'What is a VNet?', o: ['A VPN client', 'Your private network in one region, with an address space split into subnets', 'A global DNS service', 'A load balancer'], a: 1, x: 'Resources in a VNet get private IPs from their subnet’s range.' },
    { t: 'Networking', s: 'azure-networking-basics', q: 'An NSG has: priority 100 Deny port 22 from Any; priority 200 Allow port 22 from your IP. Can you SSH in?', o: ['Yes, the Allow rule is more specific', 'No: rules are checked by priority, lowest number first, and the first match wins', 'Yes, Allow always beats Deny', 'Only on weekdays'], a: 1, x: 'Priority 100 is checked before 200 and matches, so traffic is denied. Specificity does not matter.' },
    { t: 'Networking', s: 'azure-networking-basics', q: 'A VM has only a private IP. Can someone on the internet connect to it directly?', o: ['Yes, through its private IP', 'No; it needs a public IP, a load balancer or another entry point (e.g. Bastion) to be reachable from outside', 'Yes, if DNS is set', 'Only over HTTPS'], a: 1, x: 'Private addresses are not routed on the internet. A public IP or public endpoint is the door.' },
    { t: 'Networking', s: 'azure-networking-basics', q: 'Your VNet is <code>10.0.0.0/16</code>. Which subnet fits inside it?', o: ['<code>10.1.0.0/24</code>', '<code>10.0.1.0/24</code>', '<code>192.168.0.0/24</code>', '<code>10.0.0.0/8</code>'], a: 1, x: 'A subnet must be inside the VNet’s address space; /8 is bigger than the VNet itself.' },
    { t: 'Networking', s: 'azure-networking-basics', q: 'What does DNS do in this picture?', o: ['Encrypts traffic', 'Turns names such as <code>myapp.azurewebsites.net</code> into IP addresses', 'Filters ports', 'Assigns VM sizes'], a: 1, x: 'The street sign that points at the door. Private DNS zones do the same for private IPs inside VNets.' },
    // ---------- First deploy ----------
    { t: 'First deploy', s: 'azure-first-deploy', q: 'In App Service, what do you pay for?', o: ['Each web app separately, always', 'The App Service plan (its VM size and instance count); several apps can share one plan', 'Only the requests', 'Nothing on any tier'], a: 1, x: 'The plan is the compute. A web app on an existing plan does not add VMs.' },
    { t: 'First deploy', s: 'azure-first-deploy', q: 'You add app setting <code>SPRING_DATASOURCE_URL</code>. How does Spring Boot see it?', o: ['It does not; you must edit application.yml', 'As an environment variable; relaxed binding maps it to <code>spring.datasource.url</code>', 'Only after a redeploy of the jar', 'As a JVM system property only'], a: 1, x: 'App settings are injected as env vars. Changing them restarts the app.' },
    { t: 'First deploy', s: 'azure-first-deploy', q: 'The app returns 503 right after deploy. Where do you look first?', o: ['The billing page', 'The log stream / application logs, to see the startup error', 'The DNS zone', 'Delete and recreate the plan'], a: 1, x: 'Usually a startup failure: wrong Java version, wrong port, or a missing setting such as a datasource URL.' },
    { t: 'First deploy', s: 'azure-first-deploy', q: 'Which runtime stack do you pick to run a Spring Boot executable jar?', o: ['Node', 'Java SE (with the matching Java version)', 'Python', '.NET'], a: 1, x: 'Java SE runs <code>java -jar</code>. Tomcat stacks are for WAR files.' },
    { t: 'First deploy', s: 'azure-first-deploy', q: 'You finished the lab. How do you make sure it stops costing money?', o: ['Close the portal tab', 'Delete the resource group that holds the plan and the app', 'Stop the web app only', 'Log out of the CLI'], a: 1, x: 'A stopped web app still sits on a plan you pay for. Deleting the group removes everything.' }
  ];
  /*Q-END*/
  const TOPICS = ['All', ...[...new Set(Q.map((q) => q.t))]];
  const slugOf = {}; Q.forEach((q) => { slugOf[q.t] = q.s; });
  if (!document.getElementById('w-tv-style')) {
    document.head.append(el('style', { id: 'w-tv-style', text: `
.w-tv-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tv-bar div { height: 100%; background: var(--accent); }
.w-tv-bar div.low { background: var(--err); }
.w-tv-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tv-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-tv-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tv-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tv-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tv-opts button:disabled { cursor: default; }
.w-tv-q { font-size: 16px; margin: 6px 0 8px; }
.w-tv-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tv-rev:first-child { border-top: 0; }
` }));
  }
  let topic = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segT = seg(TOPICS.map((t) => [t, t]), () => topic, (v) => { topic = v; reset(); }, 'Topic');
  const segN = seg([[10, '10 questions'], [20, '20'], [30, 'all 30']], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-tv-bar' }, bar);
    const opts = el('div', { class: 'w-tv-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tv-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, q.lang || 'bash'));
    q.o.forEach((o, j) => { const b = el('button', { html: `<b>${'ABCD'[j]}.</b> ${o}` }); b.addEventListener('click', () => answer(j)); opts.append(b); });
    card.append(opts);
    const paint = () => { bar.style.width = (left / secs) * 100 + '%'; bar.className = left <= 10 ? 'low' : ''; if (!reduced) bar.style.transition = 'width 1s linear'; };
    paint(); renderStats(); say('Pick an answer before the bar runs out. Skip counts as a miss.');
    stopTimer(); const g = gen;
    tick = setInterval(() => { if (g !== gen || answered) { stopTimer(); return; } left--; paint(); renderStats(); if (left <= 0) answer(-1); }, 1000);
    card.opts = opts;
  }
  function answer(j) {
    if (answered || !started) return; answered = true; stopTimer();
    const q = deck[i]; const ok = j === q.a;
    if (ok) score++; else misses.push({ q, j });
    [...card.opts.children].forEach((b, m) => { b.disabled = true; if (m === q.a) b.classList.add('ok'); else if (m === j) b.classList.add('bad'); });
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x }));
    bStep.textContent = i + 1 < deck.length ? 'Next ›' : 'Finish ›'; renderStats();
    say(ok ? 'Correct. Press Next.' : 'Read the explanation, then press Next.');
  }
  function next() {
    if (!started) return;
    if (!answered) { answer(-2); return; }
    i++; bStep.textContent = 'Skip ›';
    if (i >= deck.length) return finish();
    show();
  }
  function finish() {
    started = false; stopTimer(); bStep.disabled = true; bPlay.textContent = '▶ Again'; card.innerHTML = '';
    const by = {}; deck.forEach((q) => { by[q.t] = by[q.t] || [0, 0]; by[q.t][1]++; }); deck.forEach((q) => { if (!misses.some((m) => m.q === q)) by[q.t][0]++; });
    card.append(el('h3', { text: `Score: ${score} / ${deck.length}`, style: { margin: '0 0 8px' } }),
      el('div', { class: 'w-stats' }, Object.entries(by).map(([t, [a, n]]) => el('span', { class: 'w-stat', html: `<a href="${slugOf[t]}.html">${t}</a> <b>${a}/${n}</b>` }))));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tv-rev' }, el('div', { html: `<span class="pill">${q.t}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, q.lang || 'bash'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : q.o[j]} · Correct: <b>${q.o[q.a]}</b>` }), el('div', { class: 'pz-exp', html: q.x + ` <a href="${q.s}.html">Review the topic →</a>` }));
        card.append(r); });
    } else card.append(el('p', { text: 'No misses. Try “all 30” on Fast.' }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above with explanations.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => topic === 'All' || q.t === topic); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${topic === 'All' ? 'all topics' : topic}), <b>${secs} s</b> each. No running code: answer in your head, like in a first interview.`, style: { margin: 0 } }));
    renderStats(); say('Choose a topic, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});
