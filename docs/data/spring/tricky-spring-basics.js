IA.register({
  track: "spring",
  slug: "tricky-spring-basics",
  title: 'Basics drill (timed)',
  tagline: "Thirty first-interview Spring Boot questions from the Basics module, against the clock: what Boot does for you, how layers and beans are wired, how a REST endpoint reads a request, where config comes from and what a repository gives you for free.",
  tldr: {
    problem: "A first Spring interview checks that you know what the framework does for you: which annotation creates a bean, why a service is not found, which status code a controller returns, which property wins.",
    model: "Most beginner questions are one of four things: <b>the container</b> (beans, scanning, singleton scope, injection), <b>conventions</b> (starters, auto-configuration, default port, default status), <b>request mapping</b> (path vs query vs body, Jackson), and <b>configuration order</b> (env vars beat the file; profiles add on top).",
    hook: "A <code>@Service</code> in a sibling package of the main class is never found. If you can say why in one sentence, start the drill.",
    facts: [
      { v: '30', l: "questions across all 6 Basics topics, from what Boot is to Data JPA" },
      { v: '60 s', l: 'per question by default. Slow (90 s) and Fast (30 s) modes too' },
      { v: "Boot 3.x", l: "(Spring Framework 6, Java 17+) is the baseline; version-specific behaviour is called out" }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short snippet or situation, a timer and four answers. Answer in your head, as you would in an interview, then read the explanation. At the end you see your score per topic and a review of every miss, each with a link back to the topic page.',
    analogy: { icon: '⏱️', title: 'Flashcards with a stopwatch', text: "Reading the Spring Boot basics is not the same as answering in ten seconds with someone watching. Speed comes from having seen the question before." },
    steps: [
      { t: "Ask “is it a bean?”", d: "Only classes the container creates (scanned stereotypes or <code>@Bean</code> methods) get injection and proxies." },
      { t: "Ask “what is the convention?”", d: "Port 8080, status 200, singleton scope, scan from the main class package: know the defaults." },
      { t: "Ask “where does this value come from?”", d: "Path variable, query parameter, JSON body, header, property or environment variable." },
      { t: "Say the rule, then answer", d: "“Scanning starts at the main class package, so…” is what the interviewer wants to hear." }
    ],
    terms: [
      ["bean", "An object created and managed by the Spring container."],
      ["IoC / DI", "The container builds objects and hands them their dependencies."],
      ["starter", "A dependency bundle for one feature, with managed versions."],
      ["auto-configuration", "Beans Boot creates from the classpath and properties, unless you define your own."],
      ["derived query", "A Spring Data query generated from a repository method name."]
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a topic (or All), how many questions (10, 20 or all 30), and the time per question, then press Start. Skip counts as a miss. At the end, your misses are listed with explanations and links to the topic pages.'
  },
  gotchas: [
    { trap: "Mixing up Spring and Boot", why: "Spring is the framework; Boot is the auto-configured way to start and run it.", fix: "Say which one gives the feature: “DI is Spring; the embedded Tomcat and starters are Boot”." },
    { trap: "Forgetting the Boot 3 baseline", why: "Boot 3 needs Java 17+ and uses <code>jakarta.*</code> instead of <code>javax.*</code>.", fix: "Name the version when it matters." },
    { trap: "Guessing instead of reasoning out loud", why: "“It is not scanned, so there is no bean” beats a lucky letter.", fix: "State the rule, apply it to the situation, then answer." }
  ],
  interview: [
    { q: "What happens when a Boot app starts?", a: "<p><code>SpringApplication.run</code> creates the container, scans components from the main class package, applies auto-configuration based on the classpath and properties, creates singleton beans, and starts the embedded server.</p>", lvl: 'core' },
    { q: "Why constructor injection?", a: "<p>Dependencies are explicit and final, the class can be tested with <code>new</code>, and missing beans fail at startup.</p>", lvl: 'core' },
    { q: "How does a request reach your method?", a: "<p>Tomcat hands it to Spring MVC’s DispatcherServlet, which finds the matching <code>@GetMapping</code>, converts path variables, query parameters and the JSON body, calls the method and writes the return value as JSON with Jackson.</p>", lvl: 'core' },
    { q: "How do you verify a claim quickly?", a: "<p>Generate a project on start.spring.io, add the endpoint, run it and call it with curl; <code>/actuator/beans</code> and <code>--debug</code> (the conditions report) show which beans exist and why.</p>", lvl: 'core' }
  ]
});
