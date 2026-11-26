IA.register({
  "track": "azure",
  "slug": "tricky-azure-basics",
  "title": "Basics drill (timed)",
  "tagline": "Thirty first-interview questions from the six Azure Basics topics, against the clock: service models, subscriptions and resource groups, the core services, storage, networking and your first App Service deploy.",
  "tldr": {
    "problem": "Entry-level Azure interviews check that you know the vocabulary and the default choices: which layer you manage, where resources live, what to pick for a database or a queue, and how not to leak keys or money.",
    "model": "Almost every basic question is one of four ideas: <b>who manages which layer</b> (IaaS, PaaS, SaaS), <b>the hierarchy</b> (tenant → subscription → resource group → resource, all through Resource Manager), <b>the default service per job</b>, and <b>access and cost</b> (prefer Entra identities over keys; anything that exists can bill).",
    "hook": "An NSG has a Deny at priority 100 and an Allow at 200 for the same port. If you know which one wins and why, start the drill.",
    "facts": [
      {
        "v": "30",
        "l": "questions across the 6 Basics topics"
      },
      {
        "v": "60 s",
        "l": "per question by default. Slow (90 s) and Fast (30 s) modes too"
      },
      {
        "v": "az + Bicep",
        "l": "are the tools used in the examples"
      }
    ]
  },
  "intro": {
    "what": "This page is a <b>drill</b>, not a lesson. You get a short question or situation, a timer and four answers. Answer in your head, as you would in a first Azure interview, then read the explanation. At the end you see your score per topic and a review of every miss, each with a link back to the topic page.",
    "analogy": {
      "icon": "⏱️",
      "title": "Flashcards with a stopwatch",
      "text": "Reading a topic once is not the same as answering in ten seconds while someone watches. Speed and calm come from having answered the question before."
    },
    "steps": [
      {
        "t": "Ask “which layer is mine?”",
        "d": "IaaS: OS and up. PaaS: app and data. SaaS: data and users. Data and access are always yours."
      },
      {
        "t": "Ask “where does it live?”",
        "d": "Which subscription, which resource group, which region."
      },
      {
        "t": "Ask “what is the default pick?”",
        "d": "App Service / Container Apps, PostgreSQL Flexible Server, Blob Storage, Service Bus, Entra ID, VNet + NSG."
      },
      {
        "t": "Ask “who can get in, and who pays?”",
        "d": "Managed identity over keys; short SAS over public access; delete the resource group when done."
      }
    ],
    "terms": [
      [
        "ARM",
        "Azure Resource Manager: the one API behind portal, CLI and Bicep."
      ],
      [
        "resource group",
        "A lifecycle container for resources."
      ],
      [
        "NSG",
        "Network security group: prioritised allow/deny rules."
      ],
      [
        "SAS",
        "Shared access signature: a signed, expiring storage URL."
      ]
    ]
  },
  "visual": {
    "title": "The drill",
    "caption": "Pick a topic (or All), how many questions (10, 20 or all 30), and the time per question, then press Start. Skip counts as a miss. At the end, your misses are listed with explanations and links to the topic pages."
  },
  "gotchas": [
    {
      "trap": "Mixing up subscription and resource group",
      "why": "Subscriptions are billing and access boundaries; resource groups are lifecycle folders inside them.",
      "fix": "Say the hierarchy out loud: tenant → subscription → resource group → resource."
    },
    {
      "trap": "Quoting prices or limits from memory",
      "why": "Prices and limits vary by region and change often.",
      "fix": "Say “I would check the pricing calculator / Microsoft Learn” and explain the cost driver instead."
    },
    {
      "trap": "Reaching for account keys",
      "why": "An account key can do everything to a storage account and is easy to leak.",
      "fix": "Default to managed identity + RBAC; use a short, narrow SAS for sharing."
    }
  ],
  "interview": [
    {
      "q": "IaaS vs PaaS for a Spring Boot app?",
      "a": "<p>PaaS (App Service or Container Apps) by default: no OS patching, built-in scaling and deployment slots. A VM only if you need OS-level control.</p>",
      "lvl": "core"
    },
    {
      "q": "How do you keep a lab from costing money?",
      "a": "<p>Create everything in one resource group, then <code>az group delete</code> it. A stopped web app still sits on a plan that bills.</p>",
      "lvl": "core"
    },
    {
      "q": "You do not know the answer. What do you say?",
      "a": "<p>Reason from the model: “NSG rules are evaluated by priority and the first match wins, so I expect the Deny at 100 to block it. I would confirm with the effective security rules view.”</p>",
      "lvl": "core"
    }
  ]
});
