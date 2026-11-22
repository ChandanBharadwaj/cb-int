IA.register({
  track: 'kubernetes',
  slug: 'containers-vs-vms',
  title: 'Containers vs VMs',
  tagline: 'A container is not a small VM. It is an <b>ordinary Linux process</b> with a private view (namespaces), a budget (cgroups) and a root filesystem unpacked from a stack of read-only <b>image layers</b>. Everything Kubernetes does builds on those three facts.',
  tldr: {
    problem: 'Teams treat containers as lightweight VMs and get surprised. The JVM sizes itself from the host, files vanish on restart, a kernel CVE reaches every pod on the node, and nothing restarts a container when its host dies.',
    model: 'VM = virtual hardware + its <b>own kernel</b>. Container = the <b>host kernel</b> + namespaces (what the process can see) + cgroups (what it may use) + an overlay filesystem built from image layers. Orchestration adds the rest: where it runs, keeping it running, and how to reach it.',
    hook: '“What actually isolates a container?” Namespaces and cgroups, hardened by seccomp, dropped capabilities and AppArmor/SELinux. Not a hypervisor. One kernel bug can cross the boundary.',
    facts: [
      { v: '1 kernel', l: 'shared by every container on a node. <code>uname -r</code> inside any pod prints the node’s kernel version' },
      { v: '8', l: 'Linux namespace types: mnt, pid, net, uts, ipc, user, cgroup and time (time since kernel 5.6)' },
      { v: 'sha256', l: 'OCI image layers are addressed by digest, so images built on the same base share those bytes on disk and in the registry' }
    ]
  },
  intro: {
    what: 'A <b>virtual machine</b> pretends to be a whole computer: virtual CPU, disk and network card, with its own operating system kernel booted inside. A <b>container</b> skips all that. It is a normal program running on the host’s kernel, but the kernel is told to <b>hide the rest of the machine</b> from it and to <b>cap how much CPU and memory</b> it may use. Its files come from an <b>image</b>: a zipped-up filesystem made of stacked layers. Kubernetes is the system that decides which machine runs which container and keeps them running.',
    analogy: { icon: '🏢', title: 'Detached houses vs flats', text: 'A VM is a detached house: its own foundations, plumbing and boiler (its own kernel). Safe from the neighbours, but expensive and slow to build. Containers are flats in one building: they share the foundations and water mains (the kernel), but each has its own front door and lock (namespaces) and its own electricity meter with a fuse (cgroups). A burst main floods every flat at once.' },
    steps: [
      { t: 'A container is just a process', d: 'The runtime (containerd → runc) starts your program with a few extra kernel flags. On the node it shows up in <code>ps</code> like any other process.', code: '# on the node\nps -eo pid,user,cmd | grep java\n4211 1000  java -jar /app/app.jar', lang: 'bash' },
      { t: 'Namespaces hide the rest of the machine', d: 'In its own PID namespace the process thinks it is PID 1. In its own network namespace it has its own <code>eth0</code> and IP. In its own mount namespace it sees only the image’s files.', code: 'ls -l /proc/4211/ns   # pid, net, mnt, uts, ipc, user, cgroup…', lang: 'bash' },
      { t: 'cgroups cap what it may use', d: 'A control group sets limits the kernel enforces: CPU time per 100 ms period, maximum memory. Go over the memory limit and the kernel kills the process.', code: 'cat /sys/fs/cgroup/<pod-cgroup>/cpu.max     # 50000 100000  = 0.5 CPU\ncat /sys/fs/cgroup/<pod-cgroup>/memory.max  # 536870912     = 512Mi', lang: 'bash' },
      { t: 'The files come from image layers', d: 'Each Dockerfile instruction adds a read-only layer. At start the runtime stacks them with overlayfs and adds one thin writable layer on top. That writable layer is thrown away with the container.' },
      { t: 'Many machines need a manager', d: 'One host is easy. Fifty hosts, hundreds of containers, failures and deploys need something that places, restarts and connects them. That is orchestration, and Kubernetes is the common choice.' }
    ],
    terms: [
      ['namespace', 'A kernel feature that gives a process its own view of one resource: process IDs, network, mounts, hostname…'],
      ['cgroup', 'Control group: a kernel feature that limits and measures CPU, memory and I/O for a group of processes.'],
      ['image', 'A read-only bundle of filesystem layers plus config (entrypoint, env, user), identified by a digest.'],
      ['OCI', 'Open Container Initiative: the open specs for the image format, the runtime and registry distribution.'],
      ['container runtime', 'containerd or CRI-O receive requests from the kubelet over CRI and use a low-level runtime (runc) to create the process.'],
      ['overlayfs', 'The Linux filesystem that stacks read-only layers under a writable one and shows the merged result.']
    ]
  },
  visual: {
    title: 'From hardware to a running container',
    caption: 'Press Play, or Step through it. On the left, VMs each boot a kernel. On the right, containers share one kernel and get their isolation from <b>namespaces</b> (purple dashes) and <b>cgroups</b> (orange). The panel below shows the image layers and the copy-on-write layer.'
  },
  gotchas: [
    { trap: 'The JVM sizes itself from the host, not the container', why: 'Before container support (JDK 8u191 / JDK 10), the JVM read <code>/proc/meminfo</code> and saw the whole node. cgroup <b>v2</b> support came later: JDK 15, backported to 11.0.16 and 8u372. An old JDK on a cgroup v2 node (Kubernetes cgroup v2 support is GA since 1.25, and most current distros default to it) silently falls back to host memory and CPU count.', fix: 'Use JDK 17 or 21 base images. Verify inside the pod with <code>java -XshowSettings:system -version</code>. Set the heap as a fraction of the limit: <code>-XX:MaxRAMPercentage=75</code>. See <a href="resources-qos.html">Requests, limits & QoS</a>.' },
    { trap: 'Shell-form ENTRYPOINT swallows SIGTERM', code: `# shell form: PID 1 is /bin/sh, java is its child
ENTRYPOINT java -jar /app/app.jar
# exec form: PID 1 is java and receives SIGTERM
ENTRYPOINT ["java", "-jar", "/app/app.jar"]`, lang: 'docker', why: 'On pod deletion the kubelet sends SIGTERM to PID 1. <code>/bin/sh -c</code> does not forward it, so Spring never starts its graceful shutdown. After <code>terminationGracePeriodSeconds</code> (default 30 s) the process is SIGKILLed mid-request.', fix: 'Use exec form, or <code>exec java …</code> inside a wrapper script. With a real init need, use <code>tini</code>.' },
    { trap: 'Files written inside the container vanish', why: 'A restarted container is a <b>new</b> container with a fresh writable layer, even in the same pod. Large writes also count against the node’s ephemeral storage and can get the pod evicted.', fix: 'Write caches to an <code>emptyDir</code> (survives container restarts, not pod deletion) and real data to a PVC. Set <code>readOnlyRootFilesystem: true</code> to catch accidental writes early.' },
    { trap: '<code>rm</code> in a later layer does not shrink the image', code: `RUN curl -o /tmp/jdk.tgz https://…   # +190 MB layer
RUN tar xf /tmp/jdk.tgz && rm /tmp/jdk.tgz   # adds a "whiteout", the 190 MB stays`, lang: 'docker', why: 'Layers are immutable. A delete in a higher layer only hides the file in the merged view; the bytes still ship in the lower layer.', fix: 'Download, use and delete in the same <code>RUN</code>, or better, use a multi-stage build and copy only the result.' },
    { trap: '“Root in the container is not real root”', why: 'Without user namespaces, UID 0 inside the container <i>is</i> UID 0 on the host kernel, just with fewer capabilities. A container escape (kernel bug, a hostPath mount, a privileged pod) lands as host root.', fix: 'Run as non-root (<code>runAsNonRoot: true</code>), drop all capabilities, use <code>seccompProfile: RuntimeDefault</code>. Pod user namespaces (<code>hostUsers: false</code>) are beta since 1.30; check your runtime and version before relying on them. Need a hard boundary for untrusted code? Use gVisor or Kata Containers.' },
    { trap: 'Mutable tags make “the same image” differ per node', why: 'Nodes cache images. With <code>:latest</code> (pull policy defaults to <code>Always</code>) or a re-pushed tag with <code>IfNotPresent</code>, two pods of one Deployment can run different bytes.', fix: 'Deploy immutable tags (git SHA) or pin the digest: <code>image: repo/app@sha256:…</code>.' }
  ],
  scenarios: [
    { title: 'Pods OOMKilled after a node OS upgrade, with no code change',
      symptom: 'The day the node pool moved to a newer OS image, a JDK 11 service started dying with <code>OOMKilled</code> (exit 137) a few minutes after start. Same image, same limits.',
      diagnoseLang: 'bash',
      diagnose: `stat -fc %T /sys/fs/cgroup          # cgroup2fs → nodes are now cgroup v2
kubectl exec deploy/billing -- java -XshowSettings:system -version
#   Operating System Metrics: ... (no container limits found)
kubectl exec deploy/billing -- java -XX:+PrintFlagsFinal -version | grep MaxHeapSize
#   MaxHeapSize = 16 GB on a 1Gi container`,
      cause: 'The base image had JDK 11.0.12, which only understands cgroup v1. On cgroup v2 it could not find its limits and sized the default heap (¼ of RAM) from the 64 GB node. The heap grew past the 1Gi memory limit and the kernel killed it.',
      fix: 'Move to a current JDK (11.0.16+, ideally 17 or 21), and make the heap explicit relative to the limit, so a detection failure cannot go unnoticed.',
      fixCode: `FROM eclipse-temurin:21-jre
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"`, lang: 'docker' },
    { title: 'Every deploy drops in-flight requests and takes 30 s per pod',
      symptom: 'Rollouts are slow and each one produces a burst of 502s. Logs never show Spring’s “Commencing graceful shutdown” line.',
      diagnoseLang: 'bash',
      diagnose: `kubectl exec pod/orders-7d9f -- ps -o pid,args
#   PID ARGS
#     1 /bin/sh -c java -jar /app/app.jar
#     7 java -jar /app/app.jar`,
      cause: 'Shell-form <code>ENTRYPOINT</code>. SIGTERM went to <code>/bin/sh</code> (PID 1), which ignored it. The kubelet waited the full 30 s grace period, then SIGKILLed everything mid-request.',
      fix: 'Use exec form so Java is PID 1 and receives SIGTERM. Enable graceful shutdown (default from Spring Boot 3.4) and add a short preStop sleep so endpoints are removed first. See <a href="pods.html">Pods</a>.',
      fixCode: `ENTRYPOINT ["java", "-jar", "/app/app.jar"]`, lang: 'docker' },
    { title: 'Scale-out takes minutes because every image is new',
      symptom: 'During a traffic spike, new nodes take over a minute to pull the image before pods can start. Each release pushes ~300 MB.',
      diagnoseLang: 'bash',
      diagnose: `docker history registry/app:abc123
#   COPY target/app.jar /app/app.jar   280MB   ← fat jar: deps + code in one layer`,
      cause: 'The fat jar puts dependencies and application classes into one layer. Any code change produces a new 280 MB layer, so no node cache or registry dedup helps.',
      fix: 'Split the jar into layers (dependencies change rarely, application code often), order them from least to most volatile, and use a slim JRE base.',
      fixCode: `FROM eclipse-temurin:21-jre AS build
WORKDIR /w
COPY target/app.jar app.jar
RUN java -Djarmode=tools -jar app.jar extract --layers --launcher --destination out

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /w/out/dependencies/ ./
COPY --from=build /w/out/spring-boot-loader/ ./
COPY --from=build /w/out/snapshot-dependencies/ ./
COPY --from=build /w/out/application/ ./
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]`, lang: 'docker' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'Inside a pod, <code>ps</code> shows <code>java</code> as PID 1. You SSH to the node and run <code>ps -ef | grep java</code>. What do you see?', options: ['PID 1 as well: the container’s PID is the real PID', 'A normal host PID such as 4211', 'Nothing: container processes are hidden from the host', 'Only the containerd process, never java'], answer: 1, explain: 'A PID namespace is a <b>view</b>. The process exists once, in the host’s PID table, with an ordinary PID. Inside its namespace it is numbered 1. The host (the root namespace) sees every container process.' },
    { kind: 'scenario', q: 'A container writes a 2 GB cache to <code>/tmp</code>, then crashes and the kubelet restarts it in the same pod. Is the cache still there?', options: ['Yes, the pod is the same', 'Yes, unless the node rebooted', 'No: the restarted container gets a fresh writable layer', 'Only if the image declares <code>VOLUME /tmp</code>'], answer: 2, explain: 'A container restart creates a <b>new container</b> from the image, with a new empty writable layer. Use an <code>emptyDir</code> volume to keep data across container restarts within a pod. (A <code>VOLUME</code> line in the Dockerfile is ignored by Kubernetes; only the pod spec’s volumes count.)' },
    { kind: 'predict', q: 'Roughly how big is the final image layer set?', code: `FROM eclipse-temurin:21-jre          # ~200 MB
RUN curl -o /tmp/data.bin https://…   # 500 MB file
RUN rm /tmp/data.bin`, lang: 'docker', options: ['~200 MB', '~700 MB', '~1.2 GB', '~200 MB, but only after docker image prune'], answer: 1, explain: 'The second layer contains the 500 MB file forever. The third layer only records a <b>whiteout</b> that hides it. Delete in the same <code>RUN</code>, or copy the result out of a build stage.' },
    { kind: 'scenario', q: 'A pod has <code>resources.requests.cpu: 2</code> and <b>no CPU limit</b>, on a 64-core node, running JDK 21. What does <code>Runtime.getRuntime().availableProcessors()</code> return?', options: ['2: the JVM reads the request', '64: requests (cpu.shares / cpu.weight) are ignored for this', '1: the default for containers', 'It throws inside a container'], answer: 1, explain: 'Since JDK 19 (backported to 17.0.5 and 11.0.17) the JVM no longer derives its CPU count from CPU shares, only from the CFS <b>quota</b>, which only a limit sets. Without a limit it sees 64 CPUs and sizes GC and ForkJoin pools for 64. Pin it with <code>-XX:ActiveProcessorCount=2</code> if you run without limits.' },
    { kind: 'predict', q: 'On an Ubuntu node running kernel 6.8, what does <code>uname -r</code> print inside an <code>alpine:3.20</code> container?', options: ['An Alpine kernel version', '6.8.x, the node’s kernel', 'Nothing: containers have no kernel', 'The kernel version baked into the image layers'], answer: 1, explain: 'Images contain <b>user-space</b> files only. Every container calls into the one host kernel, so it reports the node’s version. That is also why a kernel CVE affects every container on the node.' },
    { kind: 'scenario', q: 'Your Dockerfile ends with <code>ENTRYPOINT java -jar app.jar</code>. You run <code>kubectl delete pod</code>. What happens to the Spring app?', options: ['Graceful shutdown starts at once', 'It ignores SIGTERM, then is SIGKILLed after the 30 s grace period', 'It is SIGKILLed immediately', 'The pod is deleted but the process keeps running on the node'], answer: 1, explain: 'Shell form makes <code>/bin/sh -c</code> PID 1. A shell running as PID 1 does not forward SIGTERM to its child, and the kernel ignores signals that PID 1 has no handler for. After <code>terminationGracePeriodSeconds</code> the runtime SIGKILLs the whole container.' },
    { kind: 'scenario', q: 'Two Deployments on the same node use <code>app-a:1.4</code> and <code>app-b:2.0</code>. Both are built <code>FROM eclipse-temurin:21-jre</code> with the same base digest. How many copies of the JRE layer are on the node’s disk?', options: ['One: layers are stored by digest and shared', 'Two: one per image', 'One per running container', 'Zero: layers are streamed from the registry'], answer: 0, explain: 'The runtime’s content store is keyed by layer digest. Identical layers are pulled and stored once and mounted read-only into every container that needs them. Only each container’s writable layer is separate.' }
  ],
  interview: [
    { q: 'What is the difference between a container and a VM?', a: '<p>A VM virtualises <b>hardware</b>: a hypervisor gives each guest virtual CPUs, memory and devices, and each guest boots its own kernel. A container virtualises the <b>operating system view</b>: it is a host process whose kernel namespaces and cgroups restrict what it sees and uses. Containers start in milliseconds and share memory pages, but they share one kernel, so the isolation boundary is weaker.</p>', fu: 'When would you still choose VMs? (Untrusted multi-tenant code, a different kernel or OS, strict compliance boundaries. Or use sandboxed runtimes such as gVisor or Kata.)', lvl: 'core' },
    { q: 'Which Linux namespaces does a container use, and what does each isolate?', a: '<ul><li><b>pid</b>: process IDs (the app can be PID 1)</li><li><b>net</b>: interfaces, IPs, routes, ports</li><li><b>mnt</b>: the mount table, so the root filesystem is the image</li><li><b>uts</b>: hostname</li><li><b>ipc</b>: SysV IPC and POSIX message queues</li><li><b>user</b>: UID/GID mapping (often not used by default)</li><li><b>cgroup</b>: the view of the cgroup tree</li><li><b>time</b>: clock offsets (rarely used)</li></ul><p>In a Kubernetes pod, containers <b>share</b> the net, ipc and uts namespaces, which is why they can talk over <code>localhost</code>.</p>', lvl: 'core' },
    { q: 'What do cgroups do, and what changed with cgroup v2?', a: '<p>cgroups account for and limit resources for a group of processes: CPU (<code>cpu.max</code> quota/period, <code>cpu.weight</code>), memory (<code>memory.max</code>, then the OOM killer), I/O and PIDs. v2 uses a single unified hierarchy, has better memory accounting (page cache, kernel memory) and supports pressure metrics (PSI). Kubernetes supports v2 as GA since 1.25, and cgroup v1 support has been in maintenance mode since 1.31.</p>', fu: 'Why do old JVMs break on v2? (They only parse v1 files. Support came in JDK 15, 11.0.16 and 8u372.)', lvl: 'deep' },
    { q: 'How are image layers stored and combined at runtime?', a: '<p>An OCI image is a <b>manifest</b> listing a config blob and ordered layer blobs (tar archives), each identified by its sha256 digest. The runtime unpacks each layer once into its content store, then overlayfs mounts them as <code>lowerdir</code> (read-only) with a per-container <code>upperdir</code> (writable). Modifying a lower file triggers <b>copy-up</b> into the upper layer; deleting creates a whiteout.</p>', lvl: 'deep' },
    { q: 'What is OCI, and where do Docker, containerd and runc fit?', a: '<p>OCI defines three specs: the <b>image</b> format, the <b>runtime</b> bundle (config.json + rootfs) and <b>distribution</b> (the registry API). Docker is a developer tool that builds images and drives containerd. containerd and CRI-O are high-level runtimes: they pull images and manage containers. runc is the low-level OCI runtime that does the namespace and cgroup syscalls. The kubelet talks to containerd or CRI-O over <b>CRI</b>. The dockershim was removed in Kubernetes 1.24, but Docker-built images still run because they are OCI images.</p>', lvl: 'core' },
    { q: 'Why do we need an orchestrator at all?', a: '<p>A runtime starts containers on one host. Production needs: <b>placement</b> across many hosts by available resources, <b>self-healing</b> (restart crashed containers, replace pods on a dead node), <b>service discovery and load balancing</b> across changing IPs, <b>rolling updates and rollbacks</b>, config and secret injection, storage attachment and autoscaling. Kubernetes does all of this by reconciling declared desired state. See <a href="desired-state.html">Desired state</a>.</p>', lvl: 'core' },
    { q: 'Is a container a security boundary?', a: '<p>Partially. Isolation comes from namespaces, cgroups, dropped capabilities, seccomp and LSMs, all enforced by one shared kernel. A kernel exploit, a privileged pod, <code>hostPath</code> or <code>hostPID</code>, or a mounted container-runtime socket breaks it. Treat a container as a <b>defence-in-depth layer</b>; use separate nodes, gVisor or Kata (a VM per pod) for untrusted workloads.</p>', lvl: 'deep' },
    { q: 'How does a JVM know how much memory and CPU it has in a container?', a: '<p>Since JDK 10 (and 8u191) the JVM reads cgroup files: <code>memory.max</code> for RAM and the CFS quota (<code>cpu.max</code>) for CPUs. <code>MaxRAMPercentage</code> (default 25) then sizes the heap from the limit. Since JDK 19 / 17.0.5 / 11.0.17, CPU shares no longer affect <code>availableProcessors()</code>, so a pod with requests but no CPU limit sees every host core.</p>', fu: 'What else sits outside the heap? (Metaspace, thread stacks, code cache, direct buffers, GC structures. Leave headroom of 25% or more.)', lvl: 'deep' },
    { q: 'Why make images small, and how do you build a good Spring Boot image?', a: '<p>Smaller and more cacheable images mean faster pulls during scale-out and a smaller attack surface. For Spring Boot: a multi-stage build, a JRE-only base, layered jar extraction (dependencies → loader → snapshot deps → application, least to most volatile), exec-form entrypoint and a non-root user. Or skip the Dockerfile and use Jib or Cloud Native Buildpacks (<code>spring-boot:build-image</code>), which layer this way for you.</p>', lvl: 'core' },
    { q: 'What happens, in kernel terms, when runc starts a container?', a: '<p>runc reads the OCI bundle and calls <code>clone()</code>/<code>unshare()</code> with the namespace flags, joins or creates the cgroup and writes the limits, sets up the mounts and <code>pivot_root</code>s into the overlay rootfs, applies capabilities, seccomp and the LSM profile, switches to the configured user and finally <code>execve()</code>s the entrypoint. After that it is an ordinary process; runc exits and a small shim process stays as its parent.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Layered Spring Boot image', lang: 'docker', code: `# Spring Boot 3.3+ layer extraction; Java 21 runtime
FROM eclipse-temurin:21-jre AS build
WORKDIR /w
COPY target/app.jar app.jar
RUN java -Djarmode=tools -jar app.jar extract --layers --launcher --destination out

FROM eclipse-temurin:21-jre
RUN useradd --uid 10001 app
USER 10001
WORKDIR /app
# least to most volatile: a code change only rebuilds the last layer
COPY --from=build /w/out/dependencies/ ./
COPY --from=build /w/out/spring-boot-loader/ ./
COPY --from=build /w/out/snapshot-dependencies/ ./
COPY --from=build /w/out/application/ ./
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]`, note: 'Alternatives without a Dockerfile: <code>./mvnw spring-boot:build-image</code> (buildpacks) or Jib.' },
    { title: 'See namespaces and cgroups on a node', lang: 'bash', code: `# find the container's host PID (containerd via crictl)
CID=$(crictl ps --name orders -q)
PID=$(crictl inspect "$CID" | jq .info.pid)

ls -l /proc/$PID/ns                # one link per namespace
lsns -p $PID                       # which namespaces it is in
cat /proc/$PID/cgroup              # its cgroup path (v2: one line)
cat /sys/fs/cgroup$(cut -d: -f3 /proc/$PID/cgroup)/cpu.max      # e.g. 50000 100000
cat /sys/fs/cgroup$(cut -d: -f3 /proc/$PID/cgroup)/memory.max   # e.g. 536870912

nsenter -t $PID -n ip addr         # run a host tool inside its network namespace` },
    { title: 'Check what the JVM detected', lang: 'bash', code: `kubectl exec deploy/orders -- java -XshowSettings:system -version
# Operating System Metrics:
#     Provider: cgroupv2
#     Effective CPU Count: 2
#     Memory Limit: 1.00G

kubectl exec deploy/orders -- java -XX:+PrintFlagsFinal -version \\
  | grep -E 'MaxHeapSize|ActiveProcessorCount|UseContainerSupport'` }
  ]
});
