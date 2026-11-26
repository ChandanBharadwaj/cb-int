IA.register({
  "track": "databricks",
  "slug": "tricky-databricks-basics",
  "title": "Basics drill (timed)",
  "tagline": "Thirty first-interview questions from the five Databricks Basics topics, against the clock: the lakehouse idea, workspace and compute, notebooks and Git folders, Unity Catalog and Delta tables.",
  "tldr": {
    "problem": "Entry-level Databricks interviews check that you can explain the platform in plain words and avoid the classic beginner mistakes: the wrong compute, missing USE privileges, and VACUUM eating your time travel.",
    "model": "Almost every basic question is one of four ideas: <b>open files + catalog + engines</b> (the lakehouse), <b>the right compute for the job</b> (humans, jobs, SQL), <b>three-level names and inherited grants</b> (Unity Catalog), and <b>commits in a log</b> (Delta: nothing is edited in place).",
    "hook": "A user has <code>SELECT</code> on a table and still gets permission denied. If you can name what is missing, start the drill.",
    "facts": [
      {
        "v": "30",
        "l": "questions across the 5 Basics topics"
      },
      {
        "v": "60 s",
        "l": "per question by default. Slow (90 s) and Fast (30 s) modes too"
      },
      {
        "v": "UC + Delta",
        "l": "Unity Catalog and Delta are assumed (late 2025 features)"
      }
    ]
  },
  "intro": {
    "what": "This page is a <b>drill</b>, not a lesson. You get a short question or situation, a timer and four answers. Answer in your head, as you would in a first Databricks interview, then read the explanation. At the end you see your score per topic and a review of every miss, each with a link back to the topic page.",
    "analogy": {
      "icon": "⏱️",
      "title": "Flashcards with a stopwatch",
      "text": "Reading a topic once is not the same as answering in ten seconds while someone watches. Speed and calm come from having answered the question before."
    },
    "steps": [
      {
        "t": "Ask “where is the data?”",
        "d": "Open Delta files in your cloud storage; compute is separate and disposable."
      },
      {
        "t": "Ask “who is running this?”",
        "d": "A human → all-purpose with auto-termination. A schedule → job compute or serverless. BI → SQL warehouse."
      },
      {
        "t": "Ask “which privileges?”",
        "d": "USE CATALOG + USE SCHEMA + SELECT; grants inherit downward; grant to groups."
      },
      {
        "t": "Ask “which version?”",
        "d": "Every Delta write is a commit; time travel works until VACUUM removes old files."
      }
    ],
    "terms": [
      [
        "DBU",
        "Databricks Unit: the billing unit for compute."
      ],
      [
        "Git folder",
        "A workspace folder synced with a Git repo (formerly Repos)."
      ],
      [
        "volume",
        "A UC object that governs non-tabular files."
      ],
      [
        "VACUUM",
        "Removes data files no longer needed, after the retention period."
      ]
    ]
  },
  "visual": {
    "title": "The drill",
    "caption": "Pick a topic (or All), how many questions (10, 20 or all 30), and the time per question, then press Start. Skip counts as a miss. At the end, your misses are listed with explanations and links to the topic pages."
  },
  "gotchas": [
    {
      "trap": "Calling Databricks “just hosted Spark”",
      "why": "It misses Delta, Unity Catalog and the managed compute options that interviewers care about.",
      "fix": "Say “Spark plus Delta tables plus Unity Catalog governance, on your own cloud storage.”"
    },
    {
      "trap": "Running jobs on all-purpose clusters",
      "why": "More expensive per DBU, shared with humans, and dependent on someone’s cluster.",
      "fix": "Name job compute or serverless jobs for anything scheduled."
    },
    {
      "trap": "Quoting DBU prices",
      "why": "Prices differ by cloud, region, tier and compute type.",
      "fix": "Explain the cost drivers (compute type, size, uptime) instead of a number."
    }
  ],
  "interview": [
    {
      "q": "Managed vs external table?",
      "a": "<p>Managed: Unity Catalog owns the files and deletes them on DROP. External: the files live at a path you own; DROP removes only the metadata.</p>",
      "lvl": "core"
    },
    {
      "q": "What happens when you write to a Delta table?",
      "a": "<p>New Parquet files are written, then a commit in <code>_delta_log</code> atomically adds them (and removes replaced ones). Readers see either the old or the new version, never half.</p>",
      "lvl": "core"
    },
    {
      "q": "You do not know the answer. What do you say?",
      "a": "<p>Reason from the model: “Privileges inherit downward, so SELECT on the schema covers its tables, but the user still needs USE CATALOG and USE SCHEMA. I would check with <code>SHOW GRANTS</code>.”</p>",
      "lvl": "core"
    }
  ]
});
