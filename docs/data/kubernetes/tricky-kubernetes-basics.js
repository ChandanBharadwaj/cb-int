IA.register({
  "track": "kubernetes",
  "slug": "tricky-kubernetes-basics",
  "title": "Basics drill (timed)",
  "tagline": "Thirty first-interview questions from the six Kubernetes Basics topics, against the clock: images and containers, local clusters, kubectl, manifests, Deployments and Services, ConfigMaps and Secrets.",
  "tldr": {
    "problem": "Junior and first-round Kubernetes interviews check that you can explain the building blocks in plain words: what an image is, how a Service finds pods, why a Secret is not really secret.",
    "model": "Almost every basic question is one of four ideas: <b>image vs container</b> (a recipe vs a running process), <b>desired vs actual state</b> (you write spec, controllers fix reality), <b>labels and selectors</b> (how objects find each other), and <b>context and namespace</b> (which cluster and which folder kubectl is pointed at).",
    "hook": "<code>kubectl get pods</code> shows nothing, but the app is running. If you know the two most likely reasons, start the drill.",
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
        "v": "1.30+",
        "l": "Kubernetes baseline; Docker CLI for images"
      }
    ]
  },
  "intro": {
    "what": "This page is a <b>drill</b>, not a lesson. You get a short question or situation, a timer and four answers. Answer in your head, as you would in a first Kubernetes interview, then read the explanation. At the end you see your score per topic and a review of every miss, each with a link back to the topic page.",
    "analogy": {
      "icon": "⏱️",
      "title": "Flashcards with a stopwatch",
      "text": "Reading a topic once is not the same as answering in ten seconds while someone watches. Speed and calm come from having answered the question before."
    },
    "steps": [
      {
        "t": "Ask “image or container?”",
        "d": "Built and stored → image. Running, with logs and a writable layer → container (in a pod)."
      },
      {
        "t": "Ask “who fixes it?”",
        "d": "You declare <code>spec</code>; a controller (ReplicaSet, Deployment) keeps reality matching it."
      },
      {
        "t": "Ask “how is it found?”",
        "d": "Services and Deployments select pods by <b>labels</b>, never by name or IP."
      },
      {
        "t": "Ask “where is kubectl pointed?”",
        "d": "Current context (cluster + user) and namespace decide what every command sees and changes."
      }
    ],
    "terms": [
      [
        "context",
        "Cluster + user + default namespace in kubeconfig."
      ],
      [
        "ReplicaSet",
        "Keeps N identical pods running; owned by a Deployment."
      ],
      [
        "ClusterIP",
        "Default Service type, reachable only inside the cluster."
      ],
      [
        "base64",
        "An encoding, not encryption: how Secret values are stored."
      ]
    ]
  },
  "visual": {
    "title": "The drill",
    "caption": "Pick a topic (or All), how many questions (10, 20 or all 30), and the time per question, then press Start. Skip counts as a miss. At the end, your misses are listed with explanations and links to the topic pages."
  },
  "gotchas": [
    {
      "trap": "Explaining Kubernetes with Docker commands only",
      "why": "Interviewers want to hear that Kubernetes schedules pods and controllers reconcile state, not that it “runs docker run on servers”.",
      "fix": "Say “I declare the desired state in YAML; controllers make it so and keep it so.”"
    },
    {
      "trap": "Saying Secrets are encrypted",
      "why": "By default they are base64 in etcd. Encryption at rest and RBAC are extra cluster setup.",
      "fix": "Say “base64-encoded; protected by RBAC, and encrypted at rest if the cluster enables it.”"
    },
    {
      "trap": "Guessing instead of naming the command",
      "why": "“I would run <code>kubectl describe</code> and read Events” beats a vague answer.",
      "fix": "For any “why is it broken?” question, name the command you would run first."
    }
  ],
  "interview": [
    {
      "q": "How do you debug a pod that will not start?",
      "a": "<p><code>kubectl get pods</code> for the status, <code>kubectl describe pod</code> for Events (image pull, scheduling, missing ConfigMap), then <code>kubectl logs --previous</code> if it started and crashed.</p>",
      "lvl": "core"
    },
    {
      "q": "Explain Deployment, ReplicaSet, Pod and Service in one breath.",
      "a": "<p>A Deployment owns a ReplicaSet, which keeps N Pods running from one template. A Service selects those pods by label and gives them a stable name and virtual IP.</p>",
      "lvl": "core"
    },
    {
      "q": "You do not know the answer. What do you say?",
      "a": "<p>Reason from the model: “Env vars are copied in at container start, so I expect the old value until the pod restarts. I would check with <code>kubectl exec … env</code>.”</p>",
      "lvl": "core"
    }
  ]
});
