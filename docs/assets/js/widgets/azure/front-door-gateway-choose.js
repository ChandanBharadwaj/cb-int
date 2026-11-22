/* Load balancer chooser: scope × protocol × (WAF / private backends) → Front Door, Application Gateway, Traffic Manager, Load Balancer or a combination. */
IA.widget('front-door-gateway-choose', (root, ctx) => {
  const { el } = ctx;
  const st = { scope: 'global', proto: 'http', priv: 'no' };
  const mk = (key, opts, label) => {
    const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === st[key] ? 'on' : '' });
      b.addEventListener('click', () => { st[key] = v; [...s.children].forEach((x) => x.classList.toggle('on', x === b)); paint(); }); s.append(b); });
    return el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: label }), s);
  };
  const out = el('div', { class: 'card', style: { marginTop: '6px' }, 'aria-live': 'polite' });
  const R = {
    'global|http|no': ['Front Door Standard', 'Anycast edge, TLS offload, caching, routing to the closest healthy origin, per-request failover. Add a WAF policy (managed rule sets need Premium).', ['Users', 'Front Door', 'Origins in 2+ regions']],
    'global|http|yes': ['Front Door Premium (Private Link origins)', 'Managed WAF rules and bot protection at the edge, and origins with no public access. Add Application Gateway in each region only if you also need regional L7 features in the VNet.', ['Users', 'Front Door Premium + WAF', 'Private Link', 'Private origins']],
    'global|l4|no': ['Traffic Manager or cross-region Load Balancer', 'Non-HTTP traffic can’t go through Front Door. Traffic Manager steers by DNS (failover waits for TTLs); the cross-region tier of Azure Load Balancer gives a global anycast IP in front of regional Standard Load Balancers.', ['Clients', 'Traffic Manager (DNS) / cross-region LB', 'Regional Load Balancers']],
    'global|l4|yes': ['Traffic Manager + regional internal/public Load Balancers', 'Keep backends private behind regional Load Balancers, expose only what must be public, and fail over with DNS. Consider Azure Firewall DNAT where you need inspection.', ['Clients', 'Traffic Manager', 'Regional LB', 'Private VMs / AKS']],
    'regional|http|no': ['Application Gateway v2 (or the platform’s own ingress)', 'Path- and host-based routing, TLS, rewrites, WAF_v2, autoscaling and zones. For a single App Service or Container App, its built-in ingress may be enough.', ['Clients', 'Application Gateway', 'Backend pools']],
    'regional|http|yes': ['Application Gateway v2 with WAF, private backends', 'Gateway in its own subnet, backends on private IPs or private endpoints, a WAF policy in Prevention mode. Internal-only frontends are possible for private APIs (e.g. in front of internal APIM).', ['Clients / Front Door', 'App Gateway + WAF', 'VNet', 'Private backends']],
    'regional|l4|no': ['Azure Load Balancer (Standard)', 'Layer 4, very low latency, zone-redundant frontends, health probes, HA ports. No TLS termination, no WAF, no path routing.', ['Clients', 'Standard Load Balancer', 'VMs / VMSS']],
    'regional|l4|yes': ['Internal Standard Load Balancer', 'A private frontend IP inside the VNet for TCP/UDP services, reached from peered VNets or on-premises.', ['Internal clients', 'Internal Load Balancer', 'Private backends']]
  };
  function paint() {
    const [name, why, chain] = R[`${st.scope}|${st.proto}|${st.priv}`];
    out.innerHTML = '';
    out.append(el('div', { class: 'pill accent', text: 'Recommendation' }), el('h4', { text: name, style: { margin: '8px 0 6px' } }), el('p', { html: why, style: { margin: '0 0 8px' } }),
      el('div', { class: 'tiny', text: chain.join('  →  ') }));
  }
  root.append(mk('scope', [['global', 'Global / multi-region'], ['regional', 'One region']], 'Scope'),
    mk('proto', [['http', 'HTTP(S)'], ['l4', 'TCP / UDP']], 'Traffic'),
    mk('priv', [['no', 'Public backends OK'], ['yes', 'Private backends / WAF required']], 'Constraints'), out);
  paint();
});
