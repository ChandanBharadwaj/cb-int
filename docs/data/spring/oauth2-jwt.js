IA.register({
  track: 'spring',
  slug: 'oauth2-jwt',
  title: 'OAuth2, OIDC & JWT',
  tagline: 'An <b>authorization server</b> issues tokens; your Spring service is a <b>resource server</b> that checks them. With JWTs, the check is local: verify the signature against the issuer’s public keys (the <b>JWKS</b>), then the claims (<code>exp</code>, <code>iss</code>, <code>aud</code>). Services that call other services get their own tokens with <b>client credentials</b>, or pass the user’s token along (<b>token relay</b>).',
  tldr: {
    problem: 'Every service must answer “who is calling and may they do this?” without a shared session. Get it wrong and you either accept tokens meant for another service, or 401 every request the morning the IdP rotates its keys.',
    model: 'A JWT is <code>header.payload.signature</code>, base64url-encoded and signed, not encrypted. The resource server finds the key by the header’s <code>kid</code> in a cached JWKS (refetching on an unknown <code>kid</code>), verifies the signature, then runs validators: timestamps, issuer and, if you configure it, audience. Scopes become <code>SCOPE_…</code> authorities.',
    hook: '“Does Spring validate the audience of a JWT by default?” No. With only <code>issuer-uri</code>, it checks signature, <code>exp</code>/<code>nbf</code> and <code>iss</code>. A token issued for another API of the same IdP is accepted unless you add an audience check.',
    facts: [
      { v: '60 s', l: 'default clock skew tolerated by <code>JwtTimestampValidator</code> when checking <code>exp</code> and <code>nbf</code>' },
      { v: 'SCOPE_', l: 'prefix the default <code>JwtGrantedAuthoritiesConverter</code> puts on each value of the <code>scope</code>/<code>scp</code> claim' },
      { v: 'RS256', l: 'the algorithm a JWK-set decoder expects unless you configure others (<code>jws-algorithms</code>)' }
    ]
  },
  intro: {
    what: 'OAuth2 is a way to give an application a <b>token</b> instead of a password. A central <b>authorization server</b> (Keycloak, Entra ID, Okta, Auth0, Spring Authorization Server) logs users in and issues tokens. Your API receives the token in the <code>Authorization: Bearer …</code> header and checks it. <b>OIDC</b> adds a standard way to say who the user is (the ID token and user info). A <b>JWT</b> is a token format that carries its claims inside and is signed, so the API can check it without calling anyone.',
    analogy: { icon: '🎫', title: 'A festival wristband', text: 'The box office (authorization server) checks your ID once and gives you a wristband with a hologram. Each stage’s security (resource server) doesn’t phone the box office. They check the hologram against the sample they were given this morning (the JWKS), the date printed on it (exp), and that it is a wristband for <i>this</i> festival (aud).' },
    steps: [
      { t: 'Get a token', d: 'A user logs in (authorization code flow with PKCE), or a service authenticates as itself (client credentials). The authorization server returns an access token.' },
      { t: 'Send it', d: 'Every API call carries <code>Authorization: Bearer &lt;token&gt;</code>.' },
      { t: 'Find the key', d: 'The JWT header names a key id (<code>kid</code>). The resource server looks it up in the issuer’s public key set (JWKS), fetched once and cached.', code: '{"alg":"RS256","kid":"2024-11-a","typ":"JWT"}' },
      { t: 'Verify, then validate', d: 'Check the signature. Then check claims: not expired, right issuer, meant for this API (audience).' },
      { t: 'Map to authorities', d: 'Scopes become <code>SCOPE_orders.read</code>, which your <code>hasAuthority</code> rules and <code>@PreAuthorize</code> use.' }
    ],
    terms: [
      ['access token', 'What an API accepts. Often a JWT, sometimes an opaque string the API must introspect.'],
      ['ID token', 'An OIDC JWT that tells the <i>client</i> who logged in. Not meant to be sent to APIs.'],
      ['JWKS', 'JSON Web Key Set: the issuer’s public keys, published at a URL like <code>/.well-known/jwks.json</code> or <code>/protocol/openid-connect/certs</code>.'],
      ['claims', 'Fields in the payload: <code>iss</code> (issuer), <code>sub</code> (subject), <code>aud</code> (audience), <code>exp</code> (expiry), <code>scope</code>.'],
      ['client credentials', 'A grant where a service exchanges its own client id and secret (or a signed assertion) for a token. No user involved.'],
      ['token relay', 'Forwarding the caller’s token to a downstream service, typically from a gateway.']
    ]
  },
  visual: {
    title: 'Follow a token from issue to validation',
    caption: 'Pick a flow and press Play. The dot is the message on the wire; the card at the bottom is the decoded JWT, with each validation check ticking or failing; the resource server shows its JWKS cache. Try <b>key rotation</b> and <b>wrong audience</b> to see why “it worked yesterday” happens.'
  },
  gotchas: [
    { trap: 'No audience check', code: `spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://idp.example/realms/shop
          # aud is NOT validated: any token from this realm is accepted`, lang: 'yaml', why: 'The default validators check timestamps and, with <code>issuer-uri</code>, the issuer. A token the same IdP issued for the reporting API is accepted by the payments API.', fix: 'Set <code>spring.security.oauth2.resourceserver.jwt.audiences</code> (Boot 3.x), or add a <code>JwtClaimValidator&lt;List&lt;String&gt;&gt;("aud", aud -> aud.contains("payments-api"))</code> combined with <code>JwtValidators.createDefaultWithIssuer(…)</code>.' },
    { trap: 'Expecting <code>hasRole</code> to work with JWT roles', why: 'The default converter only reads <code>scope</code>/<code>scp</code> and prefixes <code>SCOPE_</code>. Keycloak puts roles in <code>realm_access.roles</code>, Entra ID in <code>roles</code>. Nothing maps them, so <code>hasRole("ADMIN")</code> is always 403.', fix: 'Register a <code>JwtAuthenticationConverter</code> with a custom authorities converter that reads your IdP’s claim and adds the <code>ROLE_</code> prefix, and keep the scope authorities too.' },
    { trap: 'IdP signs with ES256 (or rotates to it)', code: `Signed JWT rejected: Another algorithm expected, or no matching key(s) found`, lang: 'text', why: 'A decoder built from a JWK set URI expects RS256 unless told otherwise. A token signed with another algorithm is rejected even though the key is in the JWKS.', fix: 'Set <code>spring.security.oauth2.resourceserver.jwt.jws-algorithms: RS256, ES256</code> or call <code>.jwsAlgorithm(SignatureAlgorithm.ES256)</code> on the builder.' },
    { trap: 'Sending the ID token to APIs', why: 'The ID token’s audience is the client application, and it describes a login event. APIs that accept it are accepting tokens not issued for them, and you lose scopes.', fix: 'Clients call APIs with the <b>access token</b>. With <code>oauth2Login</code>, get it from <code>OAuth2AuthorizedClient.getAccessToken()</code>, not from <code>OidcUser.getIdToken()</code>.' },
    { trap: 'Client credentials in a scheduled job fail with “HttpServletRequest required”', code: `@Scheduled(fixedRate = 60_000)
void sync() { restClient.get().uri("/stock").retrieve()… }   // no request in scope`, why: '<code>DefaultOAuth2AuthorizedClientManager</code> stores authorized clients per request/session, so it needs a current HTTP request. A scheduled thread has none.', fix: 'For service-to-service calls, build an <code>AuthorizedClientServiceOAuth2AuthorizedClientManager</code>. It keeps tokens in an <code>OAuth2AuthorizedClientService</code> and works on any thread.' },
    { trap: 'Fetching a new client-credentials token per call', why: 'Hand-written code that POSTs to <code>/token</code> before every request multiplies load on the IdP, adds latency, and gets you rate-limited exactly when traffic spikes.', fix: 'Use the authorized client manager: it caches the token and only requests a new one when it is about to expire (with a clock skew, 60 s by default).' },
    { trap: 'Treating a JWT as revocable', why: 'The resource server never asks the IdP about a JWT. A token stays valid until <code>exp</code>, even after logout or after the user is disabled.', fix: 'Keep access tokens short-lived (minutes) and refresh them. If you need instant revocation, use opaque tokens with introspection (one IdP call per request, usually cached) for the sensitive APIs.' }
  ],
  scenarios: [
    { title: 'All services return 401 at 09:00, then recover by themselves',
      symptom: 'Right after the IdP’s scheduled key rotation, a share of requests fail with 401 <code>invalid_token</code> for a few minutes. Some pods are affected, others not.',
      diagnose: `WWW-Authenticate: Bearer error="invalid_token", error_description="An error occurred while attempting to decode the Jwt: Signed JWT rejected: Another algorithm expected, or no matching key(s) found"

# token header
{"alg":"RS256","kid":"2025-03-b"}
# JWKS served by a caching reverse proxy in front of the IdP
{"keys":[{"kid":"2025-03-a",…}]}       ← stale copy`,
      cause: 'The IdP started signing with the new key before the JWKS everyone fetched contained it. A corporate proxy cached the JWKS response for 10 minutes, so pods that refetched on the unknown <code>kid</code> got the old key set again.',
      fix: 'Rotation has to publish the new key in the JWKS <b>before</b> signing with it (and keep the old one until old tokens expire). Don’t put a long-lived cache between services and the JWKS endpoint; the decoder already caches.',
      fixCode: `# rotation runbook (IdP side)
1. add new key K2 to JWKS (not active)        T0
2. wait > JWKS cache lifetime of all clients   T0 + 15 min
3. start signing with K2                      T1
4. keep K1 in JWKS until max token lifetime passes
5. remove K1` },
    { title: 'A reporting token can move money',
      symptom: 'A pen test shows that an access token obtained for the read-only reporting API is accepted by <code>POST /payments</code>.',
      diagnose: `# token payload
{"iss":"https://idp.example/realms/shop","aud":["reporting-api"],"scope":"payments.write reports.read", …}
# payments service: issuer-uri set, no audience validation;
# the reporting client had been granted payments.write by mistake`,
      cause: 'Two problems combined: the payments service did not check <code>aud</code>, and a client had a scope it should not have. Either check alone would have stopped it.',
      fix: 'Validate the audience in every resource server, and review client scopes in the IdP. Put the expected audience in config so tests can assert it.',
      fixCode: `@Bean
JwtDecoder jwtDecoder(OAuth2ResourceServerProperties props) {
  String issuer = props.getJwt().getIssuerUri();
  NimbusJwtDecoder decoder = JwtDecoders.fromIssuerLocation(issuer);
  OAuth2TokenValidator<Jwt> audience =
      new JwtClaimValidator<List<String>>("aud", aud -> aud != null && aud.contains("payments-api"));
  decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
      JwtValidators.createDefaultWithIssuer(issuer), audience));
  return decoder;
}` },
    { title: 'IdP rate-limits the order service',
      symptom: 'Under load the order service’s calls to the inventory service fail with <code>429</code> from the IdP’s token endpoint. Latency to inventory doubled before that.',
      diagnose: `# metrics: http.client.requests uri=/realms/shop/protocol/openid-connect/token  ≈ same rate as calls to inventory
# code
String token = tokenClient.fetch(clientId, secret);   // per call
restClient.get().header("Authorization", "Bearer " + token)…`,
      cause: 'A hand-written helper fetched a client-credentials token for every outbound call. Each request cost one extra round trip, and the IdP throttled the client.',
      fix: 'Use Spring Security’s OAuth2 client support. The manager caches the token per registration and refreshes it shortly before expiry.',
      fixCode: `@Bean
OAuth2AuthorizedClientManager clientManager(ClientRegistrationRepository regs,
                                           OAuth2AuthorizedClientService service) {
  var m = new AuthorizedClientServiceOAuth2AuthorizedClientManager(regs, service);
  m.setAuthorizedClientProvider(OAuth2AuthorizedClientProviderBuilder.builder().clientCredentials().build());
  return m;
}

@Bean
RestClient inventoryClient(RestClient.Builder b, OAuth2AuthorizedClientManager m) {
  var oauth = new OAuth2ClientHttpRequestInterceptor(m);         // Spring Security 6.4+
  oauth.setClientRegistrationIdResolver(req -> "inventory");
  return b.baseUrl("https://inventory.internal").requestInterceptor(oauth).build();
}` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Only <code>issuer-uri</code> is configured. Which of these does the resource server check by default?', options: ['Signature, exp/nbf, iss and aud', 'Only the signature', 'Signature, exp/nbf and iss', 'It calls the IdP to introspect each token'], answer: 2, explain: 'The default validators are the timestamp validator and, with an issuer, the issuer validator. Audience is not checked unless you configure it.' },
    { kind: 'predict', q: 'A JWT has <code>"scope": "orders.read orders.write"</code>. Which authorities does the default converter produce?', options: ['SCOPE_orders.read, SCOPE_orders.write', 'ROLE_orders.read, ROLE_orders.write', 'orders.read, orders.write', 'SCOPE_orders.read orders.write (one authority)'], answer: 0, explain: 'The scope string is split on spaces and each value is prefixed with <code>SCOPE_</code>. So <code>hasAuthority("SCOPE_orders.read")</code> works and <code>hasRole</code> does not.' },
    { kind: 'predict', q: 'A token has <code>exp</code> 30 seconds in the past. Default Spring Security settings. Result?', options: ['401 invalid_token', '403', 'Accepted until the JWKS cache expires', 'Accepted: within the 60 s clock skew'], answer: 3, explain: '<code>JwtTimestampValidator</code> allows 60 seconds of clock skew by default. At 61 seconds past <code>exp</code> it would be rejected with 401.' },
    { kind: 'predict', q: 'The IdP starts signing with a new key whose <code>kid</code> the resource server has never seen, and it is already in the JWKS. What happens on the first request?', options: ['401 until the service restarts', 'The decoder refetches the JWK set, finds the key and accepts the token', 'It accepts the token without verifying', 'It falls back to the old key'], answer: 1, explain: 'An unknown <code>kid</code> triggers a refresh of the cached JWK set (rate-limited), so normal rotation is transparent. It fails only if the JWKS the service fetches doesn’t contain the key yet.' },
    { kind: 'concept', q: 'A nightly <code>@Scheduled</code> job calls another service with client credentials. Which manager do you use?', options: ['DefaultOAuth2AuthorizedClientManager', 'OAuth2AuthorizedClientRepository directly', 'AuthorizedClientServiceOAuth2AuthorizedClientManager', 'No manager: put the client secret in the header'], answer: 2, explain: 'The default manager is designed for request scope and needs an <code>HttpServletRequest</code>. The service-based manager works on any thread and caches tokens in an <code>OAuth2AuthorizedClientService</code>.' },
    { kind: 'concept', q: 'What does a resource server need from the IdP at runtime to validate JWTs?', options: ['A call per request to the introspection endpoint', 'The user’s password hash', 'The client secret', 'The public keys (JWKS), fetched and cached; nothing per request'], answer: 3, explain: 'JWT validation is local: signature with cached public keys plus claim checks. Opaque tokens are different: they need an introspection call (usually cached) to learn anything about the token.' },
    { kind: 'concept', q: 'A gateway receives a user request with a session (oauth2Login) and forwards it to the orders API. How should the orders API learn who the user is?', options: ['The gateway relays the user’s access token as a bearer token (TokenRelay)', 'The gateway adds an X-User header', 'The gateway forwards the session cookie', 'The orders API calls the gateway back'], answer: 0, explain: 'Token relay forwards a token the orders API can verify itself. A plain header can be forged by anything that can reach the API. If the downstream needs a different audience, use token exchange (RFC 8693, supported by Spring Security 6.3+) instead of relaying as-is.' }
  ],
  interview: [
    { q: 'How does a Spring resource server validate a JWT?', a: '<p><code>BearerTokenAuthenticationFilter</code> extracts the token and calls the <code>JwtAuthenticationProvider</code>, which uses a <code>JwtDecoder</code> (Nimbus). It parses the header, finds the key by <code>kid</code> in a cached JWK set (refetching on an unknown kid), checks the algorithm is allowed and verifies the signature. Then the <code>OAuth2TokenValidator</code>s run: timestamps (<code>exp</code>, <code>nbf</code>, 60 s skew), issuer, and any you add (audience). Finally a <code>JwtAuthenticationConverter</code> turns claims into a <code>JwtAuthenticationToken</code> with authorities.</p>', lvl: 'core' },
    { q: 'issuer-uri vs jwk-set-uri?', a: '<p><code>issuer-uri</code> uses OIDC discovery (<code>/.well-known/openid-configuration</code>) to find the JWKS URI and also validates <code>iss</code>. Boot defers the discovery call until a token needs decoding, so startup doesn’t depend on the IdP. <code>jwk-set-uri</code> points straight at the keys and skips discovery; set both if you want no discovery call but still want the issuer checked.</p>', lvl: 'core' },
    { q: 'JWT vs opaque tokens?', a: '<p>JWTs are self-contained: validation is local and fast, but you can’t revoke them before <code>exp</code>, and their claims are visible to anyone who holds them (they are signed, not encrypted). Opaque tokens are random strings: the API must call the introspection endpoint, which costs latency and couples availability to the IdP, but revocation is immediate. Common choice: short-lived JWTs plus refresh tokens.</p>', lvl: 'core' },
    { q: 'Explain the OAuth2 flows you would use in a Spring system.', a: '<ul><li><b>Authorization code + PKCE</b> for users, in the browser app or BFF (<code>oauth2Login</code>).</li><li><b>Client credentials</b> for service-to-service calls with no user.</li><li><b>Refresh token</b> to renew user access tokens.</li><li><b>Token exchange</b> (RFC 8693) to swap a user token for one aimed at a downstream audience.</li></ul><p>The implicit and password grants are deprecated by OAuth 2.1 drafts and should not be used in new systems.</p>', lvl: 'core' },
    { q: 'What is the difference between OAuth2 and OIDC?', a: '<p>OAuth2 is about <b>authorization</b>: a client gets an access token to call an API. OIDC is an identity layer on top: it adds the <b>ID token</b> (a JWT describing the authenticated user, for the client), the <code>openid</code> scope, the userinfo endpoint and discovery. In Spring, <code>oauth2Login</code> with an OIDC provider gives you an <code>OidcUser</code>.</p>', lvl: 'core' },
    { q: 'How do you map IdP roles to Spring authorities?', a: '<p>Provide a <code>JwtAuthenticationConverter</code> whose authorities converter reads the IdP’s claim (<code>realm_access.roles</code> in Keycloak, <code>roles</code> in Entra ID), adds <code>ROLE_</code>, and merges with the default scope authorities. You can also change the principal claim (<code>preferred_username</code> instead of <code>sub</code>). Expose it as a bean or pass it to <code>oauth2ResourceServer(o -> o.jwt(j -> j.jwtAuthenticationConverter(…)))</code>.</p>', lvl: 'deep' },
    { q: 'How does key rotation work without downtime?', a: '<p>The IdP publishes the new key in the JWKS first, waits longer than clients’ JWKS cache lifetime, then signs with it, and keeps the old key published until all tokens signed with it have expired. On the resource server, an unknown <code>kid</code> triggers a JWKS refresh, so no restart is needed. Problems come from extra caches in between or from rotating straight to signing.</p>', lvl: 'deep' },
    { q: 'Token relay vs token exchange vs client credentials for downstream calls?', a: '<p><b>Relay</b> forwards the user’s token: simple, keeps user identity, but the downstream must accept that audience, and the token’s scopes travel further than intended. <b>Exchange</b> gets a new token for the downstream audience, still bound to the user. <b>Client credentials</b> call as the service itself: right for work not done on behalf of a user, but the downstream loses who the user was.</p>', fu: 'Where does relay usually happen? In Spring Cloud Gateway, with the <code>TokenRelay</code> filter, after <code>oauth2Login</code>.', lvl: 'deep' },
    { q: 'Where do you store tokens in a browser app?', a: '<p>Preferably not in the browser at all: a backend-for-frontend (Spring with <code>oauth2Login</code>, or a gateway) keeps tokens server-side and gives the browser an HttpOnly session cookie, with CSRF protection. Tokens in <code>localStorage</code> are readable by any injected script.</p>', lvl: 'core' },
    { q: 'How do you test endpoints secured by JWT?', a: '<p>In MockMvc, use <code>.with(jwt().jwt(j -> j.claim("scope", "orders.read")))</code> or <code>.authorities(…)</code>; no IdP or real signature is involved. For integration tests, run the IdP in Testcontainers (e.g. Keycloak) or create a local key pair, sign tokens in the test and point <code>jwk-set-uri</code> at a stub.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Resource server configuration', lang: 'yaml', code: `spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://idp.example/realms/shop     # discovery + iss validation
          audiences: payments-api                          # Boot 3.x: adds an aud validator
          jws-algorithms: RS256, ES256                     # default is RS256 only` },
    { title: 'Mapping Keycloak roles to authorities', lang: 'java', code: `@Bean
JwtAuthenticationConverter jwtAuthenticationConverter() {
  var scopes = new JwtGrantedAuthoritiesConverter();            // SCOPE_… from "scope"
  var converter = new JwtAuthenticationConverter();
  converter.setPrincipalClaimName("preferred_username");
  converter.setJwtGrantedAuthoritiesConverter(jwt -> {
    Collection<GrantedAuthority> out = new ArrayList<>(scopes.convert(jwt));
    Map<String, Object> realm = jwt.getClaimAsMap("realm_access");
    if (realm != null && realm.get("roles") instanceof List<?> roles)
      roles.forEach(r -> out.add(new SimpleGrantedAuthority("ROLE_" + r)));
    return out;
  });
  return converter;
}` },
    { title: 'Client credentials registration', lang: 'yaml', code: `spring:
  security:
    oauth2:
      client:
        registration:
          inventory:
            provider: shop-idp
            client-id: order-service
            client-secret: \${INVENTORY_CLIENT_SECRET}
            authorization-grant-type: client_credentials
            scope: inventory.read
        provider:
          shop-idp:
            token-uri: https://idp.example/realms/shop/protocol/openid-connect/token`, note: 'Pair it with the <code>AuthorizedClientServiceOAuth2AuthorizedClientManager</code> and <code>OAuth2ClientHttpRequestInterceptor</code> shown in the rate-limit incident above.' },
    { title: 'Relaying the caller’s token by hand', lang: 'java', code: `// In a resource server that calls a downstream API on behalf of the same user
ClientHttpRequestInterceptor relay = (req, body, exec) -> {
  if (SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken jwt)
    req.getHeaders().setBearerAuth(jwt.getToken().getTokenValue());
  return exec.execute(req, body);
};
RestClient downstream = RestClient.builder().baseUrl("https://shipping.internal").requestInterceptor(relay).build();
// Reads a ThreadLocal: on @Async or virtual-thread hand-offs, propagate the SecurityContext first.` }
  ]
});
