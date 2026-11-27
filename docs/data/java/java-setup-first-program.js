IA.register({
  track: 'java',
  slug: 'java-setup-first-program',
  title: 'Running Java',
  tagline: 'You write Java, <code>javac</code> turns it into bytecode, and <code>java</code> runs it. Here you learn what the JDK is, why every program starts at <code>public static void main</code>, and two quick shortcuts: <code>java Main.java</code> and JShell.',
  tldr: {
    problem: 'You install Java and write <code>Main.java</code>. Then you hit “could not find or load main class” or “should be declared in a file named X.java”. Once you know the steps, these errors make sense.',
    model: '<b>Source</b> (<code>.java</code>) → <code>javac</code> → <b>bytecode</b> (<code>.class</code>) → <code>java</code> starts a <b>JVM</b> → JVM calls <code>main(String[] args)</code>. The JDK has both the compiler and the JVM. A runtime alone can only run.',
    hook: '“Why is <code>main</code> static?” The JVM calls it before any object exists. So it needs a method that belongs to the class itself.',
    facts: [
      { v: 'Java 11', l: 'added <code>java Main.java</code>: it compiles in memory and runs, in one step' },
      { v: 'Java 9', l: 'added JShell, the interactive Java REPL (JEP 222)' },
      { v: '.class', l: 'bytecode is platform-independent: the same <code>Main.class</code> runs on any OS with a compatible JVM' }
    ]
  },
  intro: {
    what: 'To run Java you need a <b>JDK</b> (Java Development Kit). You write code in a text file ending in <code>.java</code>. The compiler <code>javac</code> turns it into a <code>.class</code> file of <b>bytecode</b>. The <code>java</code> command starts the <b>JVM</b> (Java Virtual Machine). It loads that class and runs its <code>main</code> method. Every Java program starts at <code>main</code>.',
    analogy: { icon: '📜', title: 'A recipe, translated once', text: 'Your <code>.java</code> file is a recipe in English. <code>javac</code> translates it once into a universal kitchen language (bytecode). Any kitchen with a JVM “chef” can cook from it: Windows, macOS or Linux. The chef always starts at the step labelled <code>main</code>.' },
    steps: [
      { t: 'Install a JDK', d: 'Install a JDK 21 (an LTS release) from a vendor such as Eclipse Temurin or Oracle. Check it worked.', code: 'java -version\njavac -version', lang: 'bash' },
      { t: 'Write Main.java', d: 'The <code>public class</code> name must match the file name exactly, including capital letters.', code: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Java!");\n    }\n}' },
      { t: 'Compile, then run', d: '<code>javac</code> writes <code>Main.class</code>. <code>java</code> takes the <b>class name</b>, without <code>.class</code>.', code: 'javac Main.java\njava Main', lang: 'bash' },
      { t: 'Or do both in one step', d: 'Java 11+ can run a single source file directly. Nothing is written to disk.', code: 'java Main.java', lang: 'bash' },
      { t: 'Experiment in JShell', d: 'Type Java lines and see results immediately. No class or <code>main</code> needed.', code: 'jshell\njshell> 2 + 3\n$1 ==> 5', lang: 'bash' }
    ],
    terms: [
      ['JDK', 'Java Development Kit: compiler (<code>javac</code>), runtime (<code>java</code>), JShell and other tools. Developers install this.'],
      ['JRE', 'Java Runtime Environment: enough to <i>run</i> programs. Since Java 11 most vendors ship only the JDK. <code>jlink</code> builds slim runtimes instead.'],
      ['JVM', 'The program that runs bytecode. It also frees unused memory (garbage collection) and turns busy code into machine code (JIT).'],
      ['bytecode', 'The portable instruction format inside <code>.class</code> files.'],
      ['<code>main</code>', '<code>public static void main(String[] args)</code>: the entry point the JVM calls.'],
      ['JShell', 'Java’s interactive REPL (read-eval-print loop), Java 9+.']
    ]
  },
  visual: {
    title: 'From Main.java to “Hello, Java!”',
    caption: 'Choose <b>javac + java</b>, <b>java Main.java</b>, <b>JShell</b> or <b>Compile error</b>, then press <b>Play</b> or <b>Step</b>. Watch which file or tool is active at each moment, and what appears in the terminal.'
  },
  gotchas: [
    { trap: 'File name doesn’t match the public class', code: `// file: hello.java
public class Hello { }   // error: class Hello is public, should be
                         // declared in a file named Hello.java`, why: 'A <code>public</code> top-level class must live in a file with exactly its name. Java is case-sensitive, and so is the rule.', fix: 'Rename the file to <code>Hello.java</code>. Keep one public top-level class per file.' },
    { trap: '<code>java Main.class</code> or running from the wrong folder', code: `$ java Main.class
Error: Could not find or load main class Main.class
$ java Main          # correct: class name, from the folder with Main.class`, lang: 'bash', why: '<code>java</code> wants a <b>class name</b>. It searches the folders on the <b>classpath</b> (by default, the current folder). It reads <code>Main.class</code> as a class named <code>class</code> in a package <code>Main</code>.', fix: 'Run <code>java Main</code> from the directory that holds <code>Main.class</code>, or pass <code>-cp path/to/classes</code>. If the class has a <code>package</code>, use its full name, e.g. <code>java com.acme.Main</code> from the root folder.' },
    { trap: 'A <code>main</code> with the wrong signature', code: `public class Main {
    public void main(String[] args) { }        // not static
    static void main(String args) { }          // not String[]
}
// java 17: "Main method not found in class Main"`, why: 'The JVM only calls <code>public static void main(String[] args)</code>. Any other <code>main</code> is an ordinary method. Java 21 has a <i>preview</i> of simpler <code>main</code> methods, but it is off unless you pass <code>--enable-preview</code>.', fix: 'Use the standard signature exactly. <code>String... args</code> also works, since varargs is an array.' },
    { trap: 'Mixing JDK versions', code: `$ javac -version
javac 21.0.2
$ java -version
openjdk version "17.0.9"
$ java Main
UnsupportedClassVersionError: Main has been compiled by a more recent
version of the Java Runtime (class file version 65.0) ...`, lang: 'bash', why: 'Each Java release has a class-file version (Java 17 = 61, Java 21 = 65). An older JVM refuses newer bytecode. Two JDKs on your <code>PATH</code> often cause this.', fix: 'Point <code>JAVA_HOME</code> and <code>PATH</code> at one JDK, or compile for the older target with <code>javac --release 17</code>.' },
    { trap: 'Single-file mode with two files', code: `$ java Main.java        # Main uses Helper from Helper.java
error: cannot find symbol  Helper`, lang: 'bash', why: 'In Java 11–21, <code>java Main.java</code> compiles <b>only that one file</b>. Classes in other files are not found. (Java 22 lifts this limit.)', fix: 'Put helper classes in the same file (only one may be <code>public</code>), or compile with <code>javac *.java</code>, or use Maven/Gradle.' },
    { trap: 'Forgetting that <code>println</code> and <code>print</code> differ', code: `System.out.print("a");
System.out.print("b");
System.out.println("c");   // prints: abc  then a newline`, why: '<code>print</code> writes text with no line break; <code>println</code> adds one at the end.', fix: 'Use <code>println</code> for whole lines, <code>print</code> to build a line in pieces, and <code>printf</code>/<code>formatted</code> for formatted output.' }
  ],
  scenarios: [
    { title: 'Works on my laptop, crashes on the server', symptom: 'A small tool runs locally. On the build server it fails at start-up with <code>UnsupportedClassVersionError … class file version 65.0 … only recognizes up to 61.0</code>.', diagnose: '$ java -version      # on the server\nopenjdk version "17.0.10"\n$ javap -v Main.class | grep major\n  major version: 65', cause: 'The developer compiled with JDK 21 (version 65). The server runs Java 17 (version 61). An older JVM can’t run newer bytecode.', fix: 'Either install JDK 21 on the server, or compile for the older release. In Maven, set <code>maven.compiler.release</code>, which also checks you only use Java 17 APIs.', fixCode: `<properties>
  <maven.compiler.release>17</maven.compiler.release>
</properties>`, lang: 'text' },
    { title: '“Could not find or load main class” in a container', symptom: 'A Docker image built from a hand-written <code>Dockerfile</code> exits immediately with <code>Error: Could not find or load main class Main</code>.', diagnose: 'docker run --rm --entrypoint ls app /app\n# shows: com/  (Main is in package com.acme)', cause: '<code>Main</code> declares <code>package com.acme;</code>, so its full name is <code>com.acme.Main</code> and it lives at <code>com/acme/Main.class</code>. The command ran <code>java Main</code>.', fix: 'Use the fully qualified class name and set the classpath to the root of the package tree. Better still, build a JAR with a <code>Main-Class</code> manifest entry and run <code>java -jar</code>.', fixCode: `ENTRYPOINT ["java", "-cp", "/app", "com.acme.Main"]
# or, with a runnable JAR:
ENTRYPOINT ["java", "-jar", "/app/app.jar"]`, lang: 'docker' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Run with <code>java Main.java</code> and no extra arguments. What prints?', code: `public class Main {
    public static void main(String[] args) {
        System.out.println(args.length);
    }
}`, options: ['0', 'null', 'NullPointerException', '1 (the file name)'], answer: 0, run: true, expect: '0', explain: 'With no arguments, the JVM passes an <b>empty</b> array, never null. The program or file name is not included in <code>args</code> (unlike C’s <code>argv[0]</code>).' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        System.out.print("A");
        System.out.println("B");
        System.out.print("C");
    }
}`, options: ['A B C on three lines', 'AB, then C on the next line', 'ABC', 'A, then BC on the next line'], answer: 1, run: true, expect: 'AB\nC', explain: '<code>print</code> adds no newline, so A and B share a line. <code>println("B")</code> ends that line, and C starts a new one.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        System.out.println("1+2=" + 1 + 2);
        System.out.println(1 + 2 + "=3");
    }
}`, options: ['1+2=3 and 3=3', '1+2=12 and 3=3', '1+2=12 and 12=3', '1+2=3 and 12=3'], answer: 1, run: true, expect: '1+2=12\n3=3', explain: '<code>+</code> runs left to right. Once one side is a String, <code>+</code> joins text: <code>"1+2=" + 1</code> is <code>"1+2=1"</code>, then <code>+ 2</code> gives <code>"1+2=12"</code>. In the second line <code>1 + 2</code> is numeric addition (3) before the String appears.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    static {
        System.out.println("loading");
    }

    public static void main(String[] args) {
        System.out.println("main");
    }
}`, options: ['main', 'loading then main', 'main then loading', 'Compile error: code outside a method'], answer: 1, run: true, expect: 'loading\nmain', explain: 'A <code>static { }</code> block runs once when the JVM initialises the class, which happens before it can call <code>main</code>.' },
    { kind: 'concept', q: 'Which tool turns <code>Main.java</code> into <code>Main.class</code>?', options: ['java', 'javac', 'jshell', 'the JVM’s JIT compiler'], answer: 1, explain: '<code>javac</code> compiles source to bytecode. The JIT runs later, inside the JVM, turning hot <i>bytecode</i> into machine code while the program runs.' },
    { kind: 'concept', q: 'Why must <code>main</code> be <code>static</code>?', options: ['So it runs faster', 'So the JVM can call it without first creating an object of the class', 'So it can’t be overridden', 'Because static methods are public by default'], answer: 1, explain: 'At start-up no <code>Main</code> object exists. A static method belongs to the class itself, so the JVM can call <code>Main.main(args)</code> directly.' },
    { kind: 'concept', q: 'You deploy a server app. What do you need on the machine?', options: ['Only the source files and a text editor', 'A Java runtime (a JDK, or a slim runtime built with jlink) of the right version', 'javac only', 'JShell'], answer: 1, explain: 'To run, you need a JVM at least as new as the compile target. You don’t need the compiler. Container images often use a runtime-only or <code>jlink</code> image to stay small.' }
  ],
  interview: [
    { q: 'What is the difference between the JDK, the JRE and the JVM?', a: '<p>The <b>JVM</b> runs bytecode. The <b>JRE</b> is the JVM plus the standard class libraries: enough to run programs. The <b>JDK</b> is the JRE plus developer tools: <code>javac</code>, <code>jshell</code>, <code>jar</code>, <code>javadoc</code>, <code>jlink</code>, debuggers and profilers.</p><p>Since Java 11, most vendors ship no separate JRE. You install the JDK, or build a small runtime with <code>jlink</code>.</p>', lvl: 'core' },
    { q: 'Walk me through what happens when you run <code>javac Main.java</code> then <code>java Main</code>.', a: '<ol><li><code>javac</code> parses and type-checks the source and writes <code>Main.class</code> (bytecode).</li><li><code>java</code> starts a JVM. It loads <code>Main</code> from the classpath, checks the bytecode and runs static initialisers.</li><li>The JVM calls <code>main(String[] args)</code>. Code is interpreted at first. Busy methods get JIT-compiled to machine code.</li><li>When <code>main</code> returns and no non-daemon threads remain, the JVM exits.</li></ol>', fu: 'What is the classpath? (The list of directories and JARs where the JVM looks for classes; default is the current directory.)', lvl: 'core' },
    { q: 'Explain each word in <code>public static void main(String[] args)</code>.', a: '<ul><li><b>public</b>: callable from outside the class (by the JVM).</li><li><b>static</b>: belongs to the class; no object is needed.</li><li><b>void</b>: returns nothing. Exit codes are set with <code>System.exit(n)</code>.</li><li><b>main</b>: the name the launcher looks for.</li><li><b>String[] args</b>: command-line arguments, an empty array if none.</li></ul>', lvl: 'core' },
    { q: 'What does “write once, run anywhere” mean?', a: '<p><code>javac</code> makes bytecode, not machine code. Each OS and CPU has its own JVM that runs the same <code>.class</code> files. Native libraries, file paths and the JVM version still matter.</p>', lvl: 'core' },
    { q: 'What is single-file source-code mode?', a: '<p>Since Java 11 you can run <code>java Main.java</code>. It compiles the file in memory and runs the first class’s <code>main</code>. No <code>.class</code> file is written. In Java 11–21 it handles only one source file. On Unix you can even add a shebang line (<code>#!/usr/bin/java --source 21</code>) to a file without a <code>.java</code> extension and run it as a script.</p>', fu: 'Java 22 extended this to multi-file programs (JEP 458).', lvl: 'core' },
    { q: 'What is JShell good for?', a: '<p>Quick experiments: checking an API, a regex or an operator rule without creating a project. It keeps state between lines, auto-imports common packages (like <code>java.util.*</code>) and has commands such as <code>/vars</code>, <code>/methods</code>, <code>/imports</code> and <code>/open file.jsh</code>.</p>', lvl: 'core' },
    { q: 'How do you return an exit code from a Java program?', a: '<p><code>main</code> is <code>void</code>, so call <code>System.exit(code)</code>. Returning normally from <code>main</code> gives exit code 0 (if no other non-daemon threads keep the JVM alive). An uncaught exception in <code>main</code> prints a stack trace and exits with 1.</p>', lvl: 'core' },
    { q: 'What does <code>UnsupportedClassVersionError</code> mean?', a: '<p>The class was compiled for a newer Java version than the JVM running it. Each release has a class-file major version (Java 17 = 61, Java 21 = 65). Fix it by running a newer JVM or compiling with <code>--release N</code> for the older target.</p>', lvl: 'core' },
    { q: 'Is Java compiled or interpreted?', a: '<p>Both. Source is compiled ahead of time to bytecode. The JVM interprets that bytecode. Busy methods get compiled to machine code <b>at run time</b> (the JIT). Tools like GraalVM Native Image can also compile a whole app ahead of time to a native executable.</p>', lvl: 'deep' },
    { q: 'What changed about <code>main</code> in recent Java versions?', a: '<p>Java 21 previewed a simpler start: a beginner can write <code>void main() { … }</code>. It needs <code>--enable-preview</code> in Java 21 and kept changing later. On Java 21, use the classic signature.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Arguments and exit codes', lang: 'java', code: `public class Main {
    public static void main(String[] args) {
        if (args.length == 0) {
            System.err.println("usage: java Main.java <name>");
            System.exit(2);                 // non-zero = failure
        }
        System.out.println("Hello, " + args[0] + "!");
    }
}
// $ java Main.java Ada   ->  Hello, Ada!`, note: 'Errors go to <code>System.err</code>, results to <code>System.out</code>, so shell pipelines can separate them.' },
    { title: 'Packages and JARs', lang: 'bash', code: `# src/com/acme/Main.java starts with: package com.acme;
javac -d out src/com/acme/Main.java     # writes out/com/acme/Main.class
java -cp out com.acme.Main              # full class name
jar --create --file app.jar --main-class com.acme.Main -C out .
java -jar app.jar`, note: 'This is what Maven and Gradle do for you. <code>-d</code> chooses the output folder; <code>-cp</code> sets the classpath.' },
    { title: 'Java script with a shebang (Java 11+)', lang: 'bash', code: `$ cat hello
#!/usr/bin/env -S java --source 21
public class Hello {
    public static void main(String[] args) {
        System.out.println("hi from a script");
    }
}
$ chmod +x hello && ./hello
hi from a script`, note: 'The file must <b>not</b> end in <code>.java</code> when it has a shebang line. Handy for small ops scripts where Java is already installed.' }
  ]
});
