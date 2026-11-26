IA.register({
  track: 'nodejs',
  slug: 'node-setup-first-script',
  title: 'Running Node',
  tagline: 'Node is a program that <b>runs JavaScript files outside the browser</b>. Install it with nvm, poke at it in the REPL, run a script with <code>node file.js</code>, and name your commands in <code>package.json</code>.',
  tldr: {
    problem: 'Coming from Java you expect a JDK, a build tool, a <code>main</code> method and a compile step. Node has none of that ceremony, and that is exactly what makes the first hour confusing.',
    model: '<code>node file.js</code> reads the file and runs it top to bottom. No class, no <code>main</code>, no compile. <b>npm</b> is the package manager and task runner; <b>package.json</b> is its config, like a tiny <code>pom.xml</code>.',
    hook: '“How do you pin the Node version for a project?” <code>.nvmrc</code> for developers, <code>engines</code> in package.json as a warning, and a fixed base image (e.g. <code>node:22-slim</code>) in CI and Docker.',
    facts: [
      { v: 'node file.js', l: 'is the whole run step. Top-level code executes immediately, in order' },
      { v: 'argv[2]', l: 'is your first CLI argument: <code>process.argv</code> starts with the node path and the script path' },
      { v: 'npm run x', l: 'runs <code>scripts.x</code> from package.json; <code>start</code> and <code>test</code> also work without <code>run</code>' }
    ]
  },
  intro: {
    what: '<b>Node.js</b> is a runtime: Google’s V8 JavaScript engine (the one in Chrome) plus a library for files, network and processes. It lets JavaScript do what Java does on a server. <b>npm</b> ships with Node. It downloads libraries and runs project commands.',
    analogy: { icon: '☕', title: 'The Java map', text: '<code>nvm</code> ≈ SDKMAN!, <code>node</code> ≈ <code>java</code>, the REPL ≈ <code>jshell</code>, <code>npm</code> ≈ Maven, <code>package.json</code> ≈ <code>pom.xml</code>, <code>node_modules/</code> ≈ your <code>~/.m2</code> repository, but per project.' },
    steps: [
      { t: 'Install with nvm', d: 'nvm installs Node versions in your home folder and switches between them per shell. On Windows use nvm-windows or the official installer.', code: 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash\nnvm install 22\nnode -v   # v22.x', lang: 'bash' },
      { t: 'Try the REPL', d: 'Run <code>node</code> with no file. Type expressions and see their values. <code>.help</code> lists commands; <code>.exit</code> leaves.', code: '$ node\n> 2 ** 10\n1024\n> [1, 2, 3].map(x => x * 2)\n[ 2, 4, 6 ]', lang: 'bash' },
      { t: 'Write and run a script', d: 'Any file works. There is no class and no <code>main</code>.', code: "// hello.js\nconst who = process.argv[2] ?? 'world';\nconsole.log(`Hello, ${who}!`);\n\n// $ node hello.js Ada  →  Hello, Ada!" },
      { t: 'Make it a project', d: '<code>npm init -y</code> creates package.json. Add a <code>scripts</code> entry and run it with <code>npm run</code>.', code: 'npm init -y\nnpm pkg set scripts.start="node hello.js"\nnpm start', lang: 'bash' }
    ],
    terms: [
      ['runtime', 'The program that executes your code: V8 + Node’s built-in modules. Like the JVM plus the JDK library.'],
      ['REPL', 'Read–Eval–Print Loop. An interactive prompt, like <code>jshell</code>.'],
      ['npm', 'Node’s package manager and script runner. Installed together with Node.'],
      ['package.json', 'Project file: name, version, <code>scripts</code>, <code>dependencies</code>, <code>type</code>.'],
      ['node_modules', 'Folder where npm installs dependencies for this project. Never commit it.'],
      ['LTS', 'Long-Term Support. Even-numbered lines (20, 22, 24) become LTS; use one in production.']
    ]
  },
  visual: {
    title: 'A first session, line by line',
    caption: 'Pick a session and press Play or Step. The highlighted line is the command being typed. The terminal shows its output and the right panel shows which files exist so far.'
  },
  gotchas: [
    { trap: 'Installing Node with sudo or an old OS package', why: 'Distro packages are often several major versions behind, and global installs then need <code>sudo npm i -g</code>, which writes root-owned files into your home folder.', fix: 'Use nvm (or fnm/Volta). Global tools then install into your user folder, and switching versions per project is one command.' },
    { trap: 'Custom scripts without <code>run</code>', code: 'npm build        # “Unknown command” in npm 10\nnpm run build    # ✓ runs scripts.build', lang: 'bash', why: 'Only a few lifecycle names (<code>start</code>, <code>test</code>, <code>stop</code>, <code>restart</code>) have shortcuts. Everything else is <code>npm run &lt;name&gt;</code>.', fix: 'Always type <code>npm run</code> for your own scripts. <code>npm run</code> on its own lists them.' },
    { trap: 'Arguments swallowed by npm', code: 'npm run start --port 8080     # npm eats --port\nnpm run start -- --port 8080  # ✓ reaches your script', lang: 'bash', why: 'Flags before <code>--</code> are parsed by npm itself.', fix: 'Put <code>--</code> between npm’s arguments and your script’s arguments.' },
    { trap: '<code>process.argv[0]</code> is not your first argument', code: "// node app.js hi\nprocess.argv  // ['/…/bin/node', '/…/app.js', 'hi']", why: 'Unlike Java’s <code>String[] args</code>, argv also contains the node binary and the script path.', fix: 'Use <code>process.argv.slice(2)</code>, or <code>util.parseArgs</code> (stable since Node 20) for flags.' },
    { trap: 'Committing node_modules, or not committing the lockfile', why: 'node_modules is large and platform-specific. The lockfile (<code>package-lock.json</code>) is what makes installs reproducible.', fix: 'Add <code>node_modules/</code> to .gitignore, commit <code>package-lock.json</code>, and use <code>npm ci</code> in CI. More in <a href="npm-dependencies.html">npm & dependencies</a>.' }
  ],
  scenarios: [
    { title: '“Works on my machine”: SyntaxError in CI', symptom: 'The build passes locally. In CI it fails with <code>SyntaxError: Unexpected token</code> on a line using <code>?.</code> or <code>??</code>.', diagnose: 'Print <code>node -v</code> in the CI log: it shows an old Node (e.g. 12) from the runner image.', cause: 'Nobody pinned the Node version. Optional chaining needs Node 14+.', fix: 'Pin the version in one place and make every environment read it.', fixCode: '# .nvmrc\n22\n\n# package.json\n"engines": { "node": ">=22" }\n\n# GitHub Actions\n- uses: actions/setup-node@v4\n  with: { node-version-file: .nvmrc }', lang: 'bash' },
    { title: 'Container starts, then ignores SIGTERM', symptom: 'Kubernetes waits the full 30 s grace period on every deploy, then kills the pod.', diagnose: 'The Dockerfile ends with <code>CMD ["npm", "start"]</code>. Inside the container npm is PID 1, and signal forwarding to your node process isn’t something to rely on.', cause: 'Running through npm adds a process between the signal and your code.', fix: 'Run node directly in production images and handle SIGTERM. See <a href="graceful-shutdown.html">Graceful shutdown</a>.', fixCode: 'CMD ["node", "server.js"]', lang: 'docker' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Run with plain <code>node main.js</code> (no arguments). What prints?', code: "console.log(process.argv.length);\nconsole.log(process.argv.slice(2));", options: ['0 and []', '1 and []', '2 and []', '2 and undefined'], answer: 2, explain: 'argv always holds the node binary and the script path, so its length is <b>2</b> with no arguments. <code>slice(2)</code> is an empty array, printed as <code>[]</code>.', run: true, expect: '2\n[]' },
    { kind: 'predict', q: 'What does <code>console.log</code> print for mixed values?', code: "console.log('n =', 42, true, [1, 2], { a: 1 });", options: ["n = 42 true 1,2 [object Object]", "n = 42 true [ 1, 2 ] { a: 1 }", "'n =' 42 true [1, 2] {a: 1}", 'n =42true[1,2]{a:1}'], answer: 1, explain: 'console.log joins its arguments with spaces. Strings print raw; arrays and objects are formatted by <code>util.inspect</code> with spaces inside the brackets. String concatenation (<code>\'\' + [1,2]</code>) would give <code>1,2</code> instead.', run: true, expect: 'n = 42 true [ 1, 2 ] { a: 1 }' },
    { kind: 'predict', q: 'In a CommonJS script (a plain <code>.js</code> file with no <code>"type": "module"</code>), what prints?', code: "console.log(typeof require, typeof module, require.main === module);", options: ['undefined undefined false', 'function object true', 'function object false', 'object object true'], answer: 1, explain: 'Node wraps each CommonJS file in a function that receives <code>require</code>, <code>module</code>, <code>exports</code>, <code>__filename</code> and <code>__dirname</code>. <code>require.main === module</code> is true for the file you started, like asking “is this the class whose main() was launched?”.', run: true, expect: 'function object true' },
    { kind: 'predict', q: 'Top-level code order. What prints?', code: "console.log('a');\nfunction later() { console.log('b'); }\nconsole.log('c');\nlater();", options: ['a b c', 'a c b', 'b a c', 'a c'], answer: 1, explain: 'A script runs top to bottom. Declaring <code>later</code> doesn’t call it; the last line does.', run: true, expect: 'a\nc\nb' },
    { kind: 'concept', q: 'package.json has <code>"scripts": { "start": "node app.js", "lint": "eslint ." }</code>. Which command fails?', options: ['npm start', 'npm run start', 'npm run lint', 'npm lint'], answer: 3, explain: 'Only lifecycle scripts like <code>start</code> and <code>test</code> have shortcuts. A custom name needs <code>npm run lint</code>.' },
    { kind: 'concept', q: 'Which file should you <b>not</b> commit?', options: ['package.json', 'package-lock.json', 'node_modules/', '.nvmrc'], answer: 2, explain: 'node_modules is rebuilt from package.json + the lockfile with <code>npm ci</code>. It can contain platform-specific binaries.' }
  ],
  interview: [
    { q: 'What is Node.js, in one sentence for a Java developer?', a: '<p>A JavaScript runtime built on V8 (the engine) and libuv (the event loop and async I/O), with a standard library for files, sockets and processes. Where Java gives you threads, Node gives you one main thread plus non-blocking I/O. See <a href="node-architecture.html">Node architecture</a>.</p>', lvl: 'core' },
    { q: 'How do you run a JavaScript file, and what is the REPL for?', a: '<p><code>node file.js</code> runs it top to bottom. <code>node</code> alone opens the REPL for quick experiments, like <code>jshell</code>. <code>node -e "code"</code> runs a one-liner, and <code>node -p</code> also prints the result.</p>', lvl: 'core' },
    { q: 'Why use nvm rather than a system package?', a: '<p>Different projects need different major versions, and system packages lag behind. nvm installs versions per user, switches per shell, and reads <code>.nvmrc</code>. No <code>sudo</code> is needed for global tools.</p>', fu: 'How would CI pick the same version? (setup-node reading .nvmrc, or a pinned Docker base image.)', lvl: 'core' },
    { q: 'What goes in package.json?', a: '<ul><li><code>name</code>, <code>version</code></li><li><code>scripts</code>: named commands</li><li><code>dependencies</code> / <code>devDependencies</code> with semver ranges</li><li><code>type</code>: <code>"module"</code> for ESM or <code>"commonjs"</code> (default)</li><li><code>engines</code>: supported Node versions</li></ul>', lvl: 'core' },
    { q: 'package.json vs package-lock.json?', a: '<p>package.json states <i>ranges</i> you accept (<code>^4.19.0</code>). The lockfile records the <i>exact</i> resolved tree. <code>npm ci</code> installs exactly the lockfile and fails if the two disagree. Details in <a href="npm-dependencies.html">npm & dependencies</a>.</p>', lvl: 'core' },
    { q: 'What are npm scripts for, and why prefer them over a README of commands?', a: '<p>They give a project a standard interface: <code>npm test</code>, <code>npm run build</code>, <code>npm run lint</code>. They run with <code>node_modules/.bin</code> on the PATH, so locally installed tools work without global installs. Pre/post hooks (<code>pretest</code>) run automatically.</p>', lvl: 'core' },
    { q: 'What is npx?', a: '<p>It runs a package’s binary: from <code>node_modules/.bin</code> if installed locally, otherwise it downloads it temporarily. Example: <code>npx eslint .</code>. Be careful running unknown packages, since it executes downloaded code.</p>', lvl: 'core' },
    { q: 'How do you restart on file changes and load a .env file without extra packages?', a: '<p>Node 22 has <code>node --watch app.js</code> built in, and <code>node --env-file=.env app.js</code> (added in Node 20.6) loads environment variables. Older projects used nodemon and dotenv for the same jobs.</p>', lvl: 'core' },
    { q: 'How does a Node script report failure to the shell?', a: '<p>Through the exit code. An uncaught exception exits with 1. Set <code>process.exitCode = 2</code> to exit non-zero once work finishes; <code>process.exit(2)</code> exits immediately and can cut off pending writes.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'package.json', lang: 'json', code: `{
  "name": "hello",
  "version": "1.0.0",
  "type": "commonjs",
  "engines": { "node": ">=22" },
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch --env-file=.env index.js",
    "test": "node --test"
  },
  "dependencies": {}
}`, note: '<code>npm run dev</code> restarts on save and loads <code>.env</code>, with no extra packages (Node 22).' },
    { title: 'index.js', lang: 'js', code: `const args = process.argv.slice(2);          // like String[] args
const who = args[0] ?? 'world';

console.log(\`Hello, \${who}!\`);
if (args.length > 1) {
  console.error('too many arguments');      // goes to stderr
  process.exitCode = 1;                      // non-zero exit, like System.exit(1) at the end
}` },
    { title: 'Java equivalent', lang: 'java', code: `// Main.java  (Java 21: run directly with  java Main.java Ada)
public class Main {
    public static void main(String[] args) {
        String who = args.length > 0 ? args[0] : "world";
        System.out.println("Hello, " + who + "!");
        if (args.length > 1) {
            System.err.println("too many arguments");
            System.exit(1);
        }
    }
}`, note: 'Java’s <code>args[0]</code> is Node’s <code>process.argv[2]</code>.' }
  ]
});
