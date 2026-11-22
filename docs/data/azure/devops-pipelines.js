IA.register({
  track: 'azure',
  slug: 'devops-pipelines',
  title: 'CI/CD pipelines',
  tagline: 'A modern Azure pipeline stores <b>no cloud secret</b>. The runner asks its CI platform for a short-lived <b>OIDC token</b>, Entra ID swaps it for an Azure token because a <b>federated credential</b> says “trust tokens with exactly this issuer, subject and audience”, and the deploy runs with a narrowly scoped identity. <b>Environments</b> add approvals and checks in front of production.',
  tldr: {
    problem: 'Client secrets copied into CI that expire on a Friday or leak in a log, one all-powerful service principal deploying every environment, and production deploys that nobody approved or that ran twice in parallel.',
    model: '<b>OIDC federation</b>: CI issues a signed JWT (<code>iss</code>, <code>sub</code>, <code>aud</code>) → <code>azure/login</code> sends it to Entra ID as a client assertion → Entra matches it against the identity’s <b>federated credential</b> → returns an access token. <b>Environments</b> (GitHub) or <b>environments + checks</b> (Azure DevOps) gate the jobs that target them.',
    hook: '“How do you deploy to Azure from GitHub Actions without secrets?” A user-assigned managed identity per environment, a federated credential whose subject is <code>repo:org/repo:environment:production</code>, <code>permissions: id-token: write</code>, <code>azure/login@v2</code>, and required reviewers on the production environment.',
    facts: [
      { v: '0 secrets', l: 'with workload identity federation: only the client, tenant and subscription IDs are configured, and none of them is a secret' },
      { v: 'iss · sub · aud', l: 'must all match the federated credential exactly. For GitHub the audience is <code>api://AzureADTokenExchange</code>' },
      { v: 'environment:', l: 'once a job names an environment, its GitHub token subject becomes <code>repo:ORG/REPO:environment:NAME</code> instead of the branch ref' }
    ]
  },
  intro: {
    what: 'A <b>CI/CD pipeline</b> builds, tests and deploys your app automatically when code changes. On Azure the two common platforms are <b>GitHub Actions</b> and <b>Azure Pipelines</b> (part of Azure DevOps). To deploy, the pipeline needs to sign in to Azure. The old way was a stored password (a client secret). The current way is <b>federation</b>: the pipeline proves who it is with a short-lived token that its CI platform signs, and Entra ID trusts that token for one specific identity.',
    analogy: { icon: '🎫', title: 'A visitor badge, not a master key', text: 'Instead of giving the contractor a copy of the building key (a secret that works forever, for anyone who holds it), reception checks a signed letter from their company that names this person, this job and today’s date, and hands out a badge that expires tonight. The federated credential is reception’s list of which letters to accept.' },
    steps: [
      { t: 'Create a deploy identity per environment', d: 'A user-assigned managed identity (or app registration), with a role only on that environment’s resource group.', code: 'az identity create -g rg-identity -n id-deploy-prod\naz role assignment create --assignee-object-id $(az identity show -g rg-identity -n id-deploy-prod --query principalId -o tsv) \\\n  --assignee-principal-type ServicePrincipal --role Contributor \\\n  --scope /subscriptions/$SUB/resourceGroups/rg-orders-prod' },
      { t: 'Trust exactly one workflow context', d: 'The federated credential names the issuer, the subject (repo + environment) and the audience.', code: 'az identity federated-credential create -g rg-identity --identity-name id-deploy-prod -n gh-orders-prod \\\n  --issuer https://token.actions.githubusercontent.com \\\n  --subject repo:contoso/orders:environment:production \\\n  --audiences api://AzureADTokenExchange' },
      { t: 'Let the job request a token', d: 'Grant <code>id-token: write</code> and log in with the three IDs.', code: 'permissions:\n  id-token: write\n  contents: read\n# ...\n- uses: azure/login@v2\n  with:\n    client-id: ${{ vars.AZURE_CLIENT_ID }}\n    tenant-id: ${{ vars.AZURE_TENANT_ID }}\n    subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}', lang: 'yaml' },
      { t: 'Gate production', d: 'Put required reviewers and a branch policy on the <code>production</code> environment, and build the artifact once for every stage.' }
    ],
    terms: [
      ['OIDC token (ID token)', 'A signed JWT that the CI platform issues to a running job, describing the repo, branch or environment.'],
      ['federated identity credential', 'A setting on a managed identity or app registration: “accept tokens from this issuer with this subject and audience”.'],
      ['subject (<code>sub</code>)', 'The claim that says which workflow context is asking, e.g. <code>repo:contoso/orders:environment:production</code>.'],
      ['service connection', 'Azure DevOps’ stored link to Azure. Use the workload identity federation type, not a secret.'],
      ['environment', 'A named deployment target (dev, staging, production) with its own protection rules, approvals and secrets.'],
      ['build once, deploy many', 'Build one artifact (an image digest or JAR), then promote the same bytes through every stage.']
    ]
  },
  visual: {
    title: 'OIDC token exchange and approval gates',
    caption: '<b>Token exchange</b>: follow the JWT from GitHub to Entra ID and the Azure token back, with no secret anywhere. <b>Subject mismatch</b>: adding <code>environment: production</code> changes the <code>sub</code> claim, and the login fails until a matching credential exists. <b>Environments</b>: one image digest promoted through dev and staging to an approval gate and production. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Adding <code>environment:</code> breaks a working login', code: `jobs:
  deploy:
    environment: production       # sub: repo:contoso/orders:environment:production
    # credential was created for:  repo:contoso/orders:ref:refs/heads/main  ✗`, lang: 'yaml', why: 'GitHub builds the <code>sub</code> claim from the context: <code>ref:refs/heads/main</code> for a branch push, <code>environment:NAME</code> when the job targets an environment, <code>pull_request</code> for PRs. Entra matches it exactly, so the login fails with “No matching federated identity record found”.', fix: 'Create a credential per subject you actually use (one per environment is the common pattern). Read the claim from the error message, and match the environment name exactly.' },
    { trap: 'Forgetting <code>id-token: write</code>', why: 'Without it, the job’s <code>GITHUB_TOKEN</code> can’t request an OIDC token, and <code>azure/login</code> fails before reaching Entra. Setting <code>permissions</code> at the job level also replaces the workflow-level block for that job.', fix: 'Grant <code>id-token: write</code> (and <code>contents: read</code>) on exactly the jobs that log in to Azure, and keep everything else read-only.' },
    { trap: 'One identity, Owner on the subscription, for every stage', why: 'A test job or a compromised third-party action in a dev workflow then has full control of production.', fix: 'One identity per environment, trusted only for that environment’s subject, with a role scoped to that environment’s resource groups. If it must assign roles, use a constrained role-assignment role, not Owner.' },
    { trap: '<code>pull_request_target</code> + checkout of the PR head', why: 'It runs in the context of the base repository, with its secrets and write token, while the checked-out code comes from an untrusted fork. A malicious PR can then exfiltrate secrets or tokens.', fix: 'Use <code>pull_request</code> for untrusted code; fork PRs get a read-only token and no secrets. Keep deploy jobs on <code>push</code> to protected branches, and pin third-party actions to a commit SHA.' },
    { trap: 'Rebuilding the artifact for each environment', why: 'A rebuild picks up a new base image or dependency, so what you tested in staging is not what reaches production.', fix: 'Build once, push the image, and deploy by <b>digest</b> (<code>orders@sha256:…</code>), not by a moving tag like <code>latest</code>.' },
    { trap: 'Two production deploys at once', why: 'Two merges a minute apart start two pipelines. They interleave migrations and slot swaps, and the older build can finish last.', fix: 'GitHub: <code>concurrency: { group: orders-prod, cancel-in-progress: false }</code>. Azure DevOps: the <b>exclusive lock</b> check on the environment.' },
    { trap: 'Approvals in YAML that the YAML author can remove', why: 'A gate written as a step in the pipeline file can be deleted in the same PR that changes the deploy.', fix: 'Put gates on the <b>resource</b>: GitHub environment protection rules (required reviewers, prevent self-review, deployment branches), or Azure DevOps approvals and checks on the environment or service connection.' }
  ],
  scenarios: [
    { title: 'Monday morning: every deploy fails with “client secret expired”',
      symptom: 'All pipelines in the organisation fail at the Azure login step with <code>AADSTS7000222</code> (the client secret has expired).',
      diagnose: `az ad app credential list --id $APP_ID --query "[].{hint:hint, end:endDateTime}" -o table
az ad app federated-credential list --id $APP_ID -o table    # empty: never migrated`,
      cause: 'One app registration with a two-year client secret was shared by every pipeline. Nobody owned its rotation.',
      fix: 'Short term: add a new secret. Then move each pipeline to workload identity federation: GitHub with a federated credential per repo/environment, Azure DevOps by converting the service connection to workload identity federation. Delete the secret when the last pipeline has moved.',
      fixCode: `az ad app federated-credential create --id $APP_ID --parameters '{
  "name": "gh-orders-prod",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:contoso/orders:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}'
az ad app credential delete --id $APP_ID --key-id $OLD_KEY_ID` },
    { title: 'Login works on main, fails in the new production job',
      symptom: 'A team split its workflow into build and deploy jobs and added <code>environment: production</code> to the deploy job. The deploy job’s <code>azure/login</code> now fails; the build job still logs in.',
      diagnoseLang: 'text',
      diagnose: 'Error: AADSTS… No matching federated identity record found for presented assertion subject\n  \'repo:contoso/orders:environment:production\'. Check your federated identity credential Subject, Audience and Issuer.',
      cause: 'The only federated credential trusted <code>repo:contoso/orders:ref:refs/heads/main</code>. A job that targets an environment presents an <code>environment:</code> subject instead.',
      fix: 'Add a federated credential for the environment subject on the production identity (and, better, use separate identities for build and production). Keep the branch restriction in the environment’s deployment branch policy.',
      fixCode: `az identity federated-credential create -g rg-identity --identity-name id-deploy-prod \\
  -n gh-orders-env-production \\
  --issuer https://token.actions.githubusercontent.com \\
  --subject repo:contoso/orders:environment:production \\
  --audiences api://AzureADTokenExchange` },
    { title: 'Staging passed; production broke with a library nobody upgraded',
      symptom: 'Production started throwing <code>NoSuchMethodError</code> from a JSON library right after a deploy whose staging run was clean.',
      diagnose: `az containerapp revision list -g rg-orders-prod -n orders --query "[].properties.template.containers[0].image"
az containerapp revision list -g rg-orders-stg  -n orders --query "[].properties.template.containers[0].image"
# prod: orders:1.8.0 (rebuilt in the prod stage) · stg: a different image digest`,
      cause: 'Each stage ran <code>mvn package</code> and built its own image. A transitive dependency range resolved differently a few hours later, so production ran untested bytes.',
      fix: 'Build once in CI, push by digest, and promote the digest. Pin dependency versions (Maven BOMs, no version ranges), and verify the digest in each stage.',
      fixCode: `- id: push
  run: |
    az acr build -r acrorders -t orders:\${{ github.sha }} .
    d=$(az acr repository show -n acrorders --image orders:\${{ github.sha }} --query digest -o tsv)
    echo "image=acrorders.azurecr.io/orders@$d" >> "$GITHUB_OUTPUT"`,
      fixLang: 'yaml' }
  ],
  puzzles: [
    { kind: 'predict', q: 'A workflow runs on a push to <code>main</code> in <code>contoso/orders</code>. The job declares <code>environment: production</code>. What is the <code>sub</code> claim of its OIDC token (default claim template)?', options: ['<code>repo:contoso/orders:ref:refs/heads/main</code>', '<code>contoso/orders@main</code>', '<code>repo:contoso/orders:job:deploy</code>', '<code>repo:contoso/orders:environment:production</code>'], answer: 3, explain: 'When a job targets an environment, the environment wins: <code>repo:ORG/REPO:environment:NAME</code>. Without one, a branch push gives <code>ref:refs/heads/main</code>, and PRs give <code>pull_request</code>.' },
    { kind: 'scenario', q: 'Which of these values must be stored as a <b>secret</b> for OIDC login with <code>azure/login@v2</code>?', options: ['The client ID', 'None of them', 'The subscription ID', 'The tenant ID'], answer: 1, explain: 'They are identifiers, not credentials. Knowing them doesn’t let anyone sign in; only a token signed by GitHub with the right subject does. Store them as variables (many teams still use secrets to keep them out of logs, which is harmless).' },
    { kind: 'scenario', q: 'A pull request from a fork triggers a <code>pull_request</code> workflow whose job tries <code>azure/login</code> with OIDC. What happens?', options: ['It can’t request an OIDC token (id-token: write isn’t granted to fork PRs), so login fails', 'It logs in with the base repo’s identity', 'It logs in as the fork owner', 'It logs in, but read-only'], answer: 0, explain: 'For fork PRs GitHub doesn’t grant <code>id-token: write</code>, the <code>GITHUB_TOKEN</code> is read-only and secrets aren’t passed, which keeps untrusted code away from your cloud. Don’t “fix” this with <code>pull_request_target</code>; run cloud steps after merge.' },
    { kind: 'scenario', q: 'In Azure DevOps, where should the “two approvers before production” rule live so that a pipeline author can’t bypass it in a PR?', options: ['As a <code>ManualValidation</code> step in the YAML', 'In a branch name convention', 'As an approval check on the <code>orders-prod</code> environment (or the production service connection)', 'In the pipeline’s variables'], answer: 2, explain: 'Checks on <b>protected resources</b> (environments, service connections, agent pools, variable groups) are enforced by the platform whenever any pipeline uses the resource, and they are managed by the resource’s owners, not by the YAML.' },
    { kind: 'scenario', q: 'Federated login fails with “No matching federated identity record found”. The credential’s subject is <code>repo:contoso/orders:environment:Production</code> and the job uses <code>environment: production</code>. Most likely fix?', options: ['Add <code>id-token: write</code>', 'Wait for Entra replication', 'Switch the audience to <code>https://management.azure.com</code>', 'Make the subject match the environment name exactly (<code>production</code>)'], answer: 3, explain: 'The subject is compared as an exact string. Treat it as case-sensitive and copy the subject from the error message. The GitHub audience stays <code>api://AzureADTokenExchange</code>.' },
    { kind: 'scenario', q: 'Why deploy <code>acrorders.azurecr.io/orders@sha256:9f2…</code> to production instead of <code>orders:latest</code>?', options: ['Digests download faster', 'A digest is immutable, so production runs exactly the bytes staging tested, and a rollback names a precise image', 'Tags aren’t supported by Container Apps', 'Digests skip vulnerability scanning'], answer: 1, explain: 'Tags can be moved or overwritten; a digest identifies content. Promoting the digest is the core of “build once, deploy many”.' },
    { kind: 'scenario', q: 'Two merges to <code>main</code> 40 seconds apart. Both pipelines reach the production job. Which GitHub setting makes them run one after the other, without cancelling the running one?', options: ['<code>needs: build</code>', '<code>timeout-minutes: 30</code>', '<code>concurrency: { group: orders-prod, cancel-in-progress: false }</code>', 'A required reviewer'], answer: 2, explain: 'A concurrency group allows one running job (plus one pending) per group; with <code>cancel-in-progress: false</code> the running deploy finishes first. Note that a newer pending run replaces an older pending one, which is usually what you want.' }
  ],
  interview: [
    { q: 'Walk me through what happens during an OIDC login from GitHub Actions to Azure.', a: '<ol><li>The job has <code>id-token: write</code>, so it can ask GitHub’s OIDC provider for a JWT with audience <code>api://AzureADTokenExchange</code>.</li><li><code>azure/login</code> sends that JWT to Entra ID’s token endpoint as a <b>client assertion</b> for the identity’s client ID.</li><li>Entra validates the signature using GitHub’s published keys (OIDC discovery on the issuer) and checks <code>iss</code>, <code>sub</code> and <code>aud</code> against the identity’s federated credentials.</li><li>On a match it returns a short-lived Azure access token, and the job calls ARM with whatever RBAC roles that identity has.</li></ol>', lvl: 'core' },
    { q: 'Azure DevOps or GitHub Actions for a new Spring Boot service on Azure?', a: '<p>If the code already lives in GitHub, <b>GitHub Actions</b>: one place for PRs, checks, environments, OIDC, Dependabot and code scanning. <b>Azure Pipelines</b> is strong where Azure DevOps is the organisation’s standard: Boards and Repos integration, rich approvals and checks on shared resources, templates with <code>extends</code> for enforced pipeline structure, and self-hosted or Managed DevOps Pools. Both support workload identity federation. Choose by where the code and the governance already are, not by features alone.</p>', lvl: 'core' },
    { q: 'How do you design identities for dev, staging and production pipelines?', a: '<p>One identity per environment, each with a federated credential for that environment’s subject only, and RBAC scoped to that environment’s resource groups. Build jobs get an identity that can push to ACR (<code>AcrPush</code>) but not deploy. Production’s identity is usable only by jobs that passed the production environment’s protection rules. No identity has Owner; role assignment rights, if needed, are constrained.</p>', lvl: 'core' },
    { q: 'What are GitHub environment protection rules, and what do they protect?', a: '<p>Rules on a named environment that a job must pass before it starts: <b>required reviewers</b> (optionally preventing self-review), a <b>wait timer</b>, <b>deployment branch and tag</b> policies, and custom protection rules (for example a change-management app). Environment secrets and variables are only released to jobs that pass. Combined with a federated subject of <code>environment:production</code>, the cloud credential itself becomes unreachable without approval. Availability for private repositories depends on the GitHub plan.</p>', lvl: 'deep' },
    { q: 'What checks can Azure DevOps put on an environment?', a: '<p>Approvals, branch control, business hours, required template (the pipeline must extend an approved template), invoke an Azure Function or REST API, query Azure Monitor alerts, and <b>exclusive lock</b> (one run at a time). They apply to any pipeline using the resource, which makes them a governance tool rather than pipeline code.</p>', lvl: 'deep' },
    { q: 'Can you restrict which workflow file is allowed to deploy?', a: '<p>Yes. Customise the OIDC subject claim template for the repository or organisation (GitHub’s OIDC customisation API) to include claims such as <code>job_workflow_ref</code>, then put that in the federated credential subject. Then only a specific reusable workflow, on a specific ref, can obtain the production identity.</p>', lvl: 'deep' },
    { q: 'How do you handle database migrations in a pipeline?', a: '<p>Make them backward compatible (expand, then contract) so the old and new app versions both work during the rollout and a rollback doesn’t need a down-migration. Run Flyway or Liquibase as a separate gated step (or a job) before switching traffic, with its own identity that has DDL rights, and keep the app’s runtime identity DML-only.</p>', lvl: 'core' },
    { q: 'What does a good Java pipeline for Azure look like, stage by stage?', a: '<ol><li><b>PR</b>: <code>mvn -B verify</code> with Testcontainers, static analysis, dependency and secret scanning, IaC what-if/plan posted as a comment.</li><li><b>Main</b>: build the image once, scan it, push by digest, sign or attest it.</li><li><b>Dev</b>: deploy automatically, smoke test.</li><li><b>Staging</b>: deploy the same digest, run integration and load checks.</li><li><b>Production</b>: approval, deploy with a canary (Container Apps traffic split or App Service slots), watch SLO alerts, automatic rollback by redeploying the previous digest.</li></ol>', lvl: 'core' },
    { q: 'Federated credentials have limits. What are they, and how do you live with them?', a: '<p>Each identity holds a limited number of federated credentials (20 per Microsoft Learn at the time of writing), and subjects are exact strings (flexible matching is limited). For many repositories, use one identity per environment <i>per system</i> rather than per repo, a customised subject claim (for example per reusable workflow), or Azure DevOps service connections shared through checks.</p>', lvl: 'deep' },
    { q: 'How do you keep third-party actions from becoming a supply-chain risk?', a: '<p>Pin actions to a full commit SHA (Dependabot can update them), allow-list actions at the organisation level, give each job the minimum <code>permissions</code>, and keep deploy credentials in protected environments so a compromised lint action in a PR job can’t reach them.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'GitHub Actions: build once, deploy with OIDC', lang: 'yaml', code: `name: orders
on:
  push: { branches: [main] }
permissions:
  contents: read
concurrency: { group: orders-prod, cancel-in-progress: false }

jobs:
  build:
    runs-on: ubuntu-latest
    permissions: { contents: read, id-token: write }
    outputs: { image: \${{ steps.push.outputs.image }} }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '21', cache: maven }
      - run: mvn -B verify
      - uses: azure/login@v2            # sub: repo:contoso/orders:ref:refs/heads/main
        with:
          client-id: \${{ vars.AZURE_CLIENT_ID_BUILD }}     # AcrPush only
          tenant-id: \${{ vars.AZURE_TENANT_ID }}
          subscription-id: \${{ vars.AZURE_SUBSCRIPTION_ID }}
      - id: push
        run: |
          az acr build -r acrorders -t orders:\${{ github.sha }} .
          d=$(az acr repository show -n acrorders --image orders:\${{ github.sha }} --query digest -o tsv)
          echo "image=acrorders.azurecr.io/orders@$d" >> "$GITHUB_OUTPUT"

  deploy-prod:
    needs: build
    runs-on: ubuntu-latest
    environment: production             # reviewers + branch policy; sub: ...:environment:production
    permissions: { contents: read, id-token: write }
    steps:
      - uses: azure/login@v2
        with:
          client-id: \${{ vars.AZURE_CLIENT_ID_PROD }}      # Contributor on rg-orders-prod only
          tenant-id: \${{ vars.AZURE_TENANT_ID }}
          subscription-id: \${{ vars.AZURE_SUBSCRIPTION_ID }}
      - run: az containerapp update -g rg-orders-prod -n orders --image "\${{ needs.build.outputs.image }}"`, note: 'Pin <code>actions/*</code> and <code>azure/login</code> to commit SHAs in real repositories.' },
    { title: 'Bicep: deploy identity with a federated credential', lang: 'bicep', code: `resource deployId 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-deploy-prod'
  location: location
}

resource ghProd 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deployId
  name: 'gh-orders-production'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:contoso/orders:environment:production'
    audiences: [ 'api://AzureADTokenExchange' ]
  }
}

output clientId string = deployId.properties.clientId`, note: 'Assign its role in the target resource group’s template with <code>principalType: \'ServicePrincipal\'</code>.' },
    { title: 'Azure Pipelines: multi-stage with an environment', lang: 'yaml', code: `trigger: { branches: { include: [ main ] } }

stages:
- stage: Build
  jobs:
  - job: build
    pool: { vmImage: ubuntu-latest }
    steps:
    - script: mvn -B verify
    - task: AzureCLI@2
      inputs:
        azureSubscription: sc-orders-build        # workload identity federation
        scriptType: bash
        scriptLocation: inlineScript
        inlineScript: az acr build -r acrorders -t orders:$(Build.BuildId) .

- stage: Prod
  dependsOn: Build
  jobs:
  - deployment: deploy
    environment: orders-prod                    # approvals, branch control, exclusive lock
    pool: { vmImage: ubuntu-latest }
    strategy:
      runOnce:
        deploy:
          steps:
          - task: AzureCLI@2
            inputs:
              azureSubscription: sc-orders-prod
              scriptType: bash
              scriptLocation: inlineScript
              inlineScript: |
                az containerapp update -g rg-orders-prod -n orders \\
                  --image acrorders.azurecr.io/orders:$(Build.BuildId)`, note: 'Approvals and checks are configured on the <code>orders-prod</code> environment and the <code>sc-orders-prod</code> service connection, not in this file. In production, promote by digest as in the GitHub example.' }
  ]
});
