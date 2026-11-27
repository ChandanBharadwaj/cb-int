IA.register({
  track: 'java',
  slug: 'io-nio',
  title: 'I/O & NIO',
  tagline: '<code>java.io</code> means <b>streams that block</b>: one thread waits per connection. NIO means <b>buffers, channels and selectors</b>: one thread watches thousands of connections and asks “who is ready?”. Under both sits the OS file cache. That explains memory-mapped files and zero-copy <code>transferTo</code>. Java 21’s virtual threads bring back simple blocking code at NIO-like cost.',
  tldr: {
    problem: 'I/O bugs look like other bugs. “Too many open files”. <code>OutOfMemoryError: Direct buffer memory</code>. An event loop frozen by one blocking call. A buffer that writes zeros because nobody called <code>flip()</code>. A 4 GB file read into a byte array.',
    model: 'A <code>ByteBuffer</code> is an array plus three indexes. <b>position</b> is the next slot. <b>limit</b> is the end of the usable part. <b>capacity</b> is the size. Write into it, <code>flip()</code> to read what you wrote, then <code>clear()</code> or <code>compact()</code> to write again. A <b>channel</b> moves bytes between a buffer and a file or socket. A <b>selector</b> lets one thread watch many non-blocking channels (epoll on Linux).',
    hook: '“How does Netty serve 50,000 connections with 16 threads?” Each event-loop thread owns a Selector. It sleeps in <code>select()</code> until the kernel reports ready sockets. It handles them without blocking, then goes back. Block that thread once and every connection on it stalls.',
    facts: [
      { v: 'Java 1.4', l: 'introduced NIO: buffers, channels, selectors. Java 7 added NIO.2: <code>Path</code>, <code>Files</code>, async channels, <code>WatchService</code>' },
      { v: '3 indexes', l: '<code>0 ≤ position ≤ limit ≤ capacity</code>. <code>flip()</code>: limit = position, position = 0. <code>clear()</code>: position = 0, limit = capacity. Neither erases data' },
      { v: 'JDK 13', l: 'rebuilt the classic <code>Socket</code>/<code>ServerSocket</code> on NIO. Later, that let virtual threads park on blocking socket calls instead of holding an OS thread' }
    ]
  },
  intro: {
    what: 'Programs read and write files and network connections. The classic way, <b>streams</b> (<code>InputStream</code>, <code>Reader</code>), is simple. You call <code>read()</code> and your thread waits for data. With 10,000 slow connections, that’s 10,000 waiting threads. <b>NIO</b> lets one thread set many connections to non-blocking. It asks the OS which ones have data, then reads only those. Data moves through <b>buffers</b>: fixed-size boxes of bytes with a cursor, which you manage yourself.',
    analogy: { icon: '📬', title: 'Waiting by each mailbox vs. a porter', text: 'Blocking I/O hires one person per mailbox to stand there until a letter arrives. NIO has one porter who sleeps until the bell rings. He checks the board of lit-up mailboxes (the selector), empties only those, and sleeps again. Fast, as long as he never stops to read a long letter on the spot.' },
    steps: [
      { t: 'Files: use <code>java.nio.file.Files</code>', d: 'It handles charsets, buffering and closing for common cases.', code: 'String cfg = Files.readString(Path.of("app.yml"));              // small files\ntry (Stream<String> lines = Files.lines(Path.of("big.log"))) {  // large: lazy, must close\n    long errors = lines.filter(l -> l.contains("ERROR")).count();\n}' },
      { t: 'Buffers: write, flip, read', d: 'After putting bytes in, call <code>flip()</code> so the reader sees exactly those bytes.', code: 'ByteBuffer buf = ByteBuffer.allocate(4096);\nint n = channel.read(buf);   // fills from position\nbuf.flip();                  // limit = position, position = 0\nout.write(buf);              // drains position → limit\nbuf.clear();                 // ready to fill again' },
      { t: 'Many sockets, one thread: a Selector', d: 'Register non-blocking channels. <code>select()</code> returns when some are ready.' },
      { t: 'Or just block, on virtual threads (Java 21)', d: 'Plain blocking socket code on a virtual thread parks instead of holding an OS thread. Frameworks like Netty still use selectors directly.' }
    ],
    terms: [
      ['stream', 'A <code>java.io</code> sequence of bytes (<code>InputStream</code>) or chars (<code>Reader</code>). Reads block.'],
      ['ByteBuffer', 'A box of bytes with position, limit and capacity. On the heap (backed by a <code>byte[]</code>) or direct (off-heap).'],
      ['channel', 'A link to a file or socket that reads into and writes from buffers: <code>FileChannel</code>, <code>SocketChannel</code>.'],
      ['selector', 'Reports which registered channels are ready to accept, connect, read or write.'],
      ['memory-mapped file', 'A file region mapped into the process’s memory. Reading that memory reads the file, through the page cache.'],
      ['page cache', 'The kernel’s copy of file contents in RAM (the <i>page cache</i>). Most “disk reads” come from it.']
    ]
  },
  visual: {
    title: 'Watch a ByteBuffer’s indexes, a Selector loop, and where bytes get copied',
    caption: 'Pick a view and press Play or Step. <b>ByteBuffer</b> shows position (P), limit (L) and capacity through <code>put</code>, <code>flip</code>, <code>get</code>, <code>compact</code> and <code>clear</code>. <b>blocking vs selector</b> runs four connections both ways. <b>copies</b> counts bytes copied by read/write, by a mapped file, and by zero-copy <code>transferTo</code>.'
  },
  gotchas: [
    { trap: 'Forgetting <code>flip()</code>', code: `ByteBuffer b = ByteBuffer.allocate(16);
b.put("hi".getBytes(US_ASCII));
channel.write(b);   // writes bytes 2..15: fourteen zeros, not "hi"`, why: 'Reads and writes always go from position to limit. After <code>put</code>, position sits after your data and limit is the capacity. So the “remaining” part is the empty space.', fix: 'Call <code>flip()</code> before draining a buffer you filled. After draining, call <code>clear()</code> (discard) or <code>compact()</code> (keep unread bytes) before filling again.' },
    { trap: 'Not closing <code>Files.lines</code>, <code>Files.list</code>, <code>Files.walk</code>', code: `long n = Files.list(dir).count();   // DirectoryStream left open`, why: 'These streams hold an open file handle until closed. The GC won’t close them in time. A loop leaks handles until <code>IOException: Too many open files</code>.', fix: 'Always write <code>try (Stream&lt;Path&gt; s = Files.list(dir)) { … }</code>. Same for <code>Files.newDirectoryStream</code>, channels, sockets and <code>RandomAccessFile</code>.' },
    { trap: 'Reading a huge file into memory', code: `byte[] all = Files.readAllBytes(dump);         // 6 GB → OutOfMemoryError
List<String> lines = Files.readAllLines(log);   // fine for config, not for logs`, why: 'Arrays max out at about 2³¹ elements. The heap rarely has room for multi-GB copies anyway.', fix: 'Stream it: <code>Files.lines</code>, <code>BufferedReader</code>, <code>InputStream.transferTo(out)</code> (Java 9), or <code>FileChannel.transferTo</code>.' },
    { trap: '<code>OutOfMemoryError: Direct buffer memory</code>', why: 'Direct buffers live outside the heap. They are freed only when their small <code>ByteBuffer</code> object is collected. Allocating them per request, or leaking Netty <code>ByteBuf</code>s, uses up <code>-XX:MaxDirectMemorySize</code> (default ≈ max heap). Meanwhile the heap looks fine.', fix: 'Allocate direct buffers once, then reuse or pool them. Release reference-counted buffers. Watch them with <code>BufferPoolMXBean</code> (<code>direct</code> pool) or Native Memory Tracking.' },
    { trap: 'Heap buffers on channels allocate hidden direct buffers', why: 'The OS can only do I/O from native memory. So writing a heap <code>ByteBuffer</code> to a channel makes the JDK copy it into a temporary direct buffer. That buffer is cached per thread. With many threads and large writes, these caches add up.', fix: 'Use direct buffers for long-lived channel I/O. Keep writes a sensible size. Consider <code>-Djdk.nio.maxCachedBufferSize</code> so huge temporary buffers aren’t cached.' },
    { trap: 'Blocking the selector (event-loop) thread', code: `// inside a Netty handler / WebFlux operator, on reactor-http-nio-3
User u = jdbcTemplate.queryForObject(sql, mapper, id);   // blocks the event loop`, why: 'One event-loop thread serves many connections. While it waits for the database, none of them move.', fix: 'Move blocking work elsewhere (<code>Schedulers.boundedElastic()</code>, a separate executor), or use non-blocking drivers. Catch it in tests with BlockHound.' },
    { trap: 'Expecting a MappedByteBuffer to unmap when you are done', why: 'There is no public unmap. The mapping goes away when the buffer is garbage-collected. On Windows you can’t delete or truncate the file meanwhile. One <code>MappedByteBuffer</code> holds at most 2 GB (int indexes).', fix: 'Map in chunks and keep mappings long-lived. On Java 22+, use the FFM API (<code>FileChannel.map(mode, offset, size, arena)</code> returns a <code>MemorySegment</code>). Its <code>Arena.close()</code> unmaps right away.' }
  ],
  scenarios: [
    { title: '“Too many open files” every few days',
      symptom: 'A service scans an upload folder every 10 seconds. After a few days it fails with <code>FileSystemException: Too many open files</code>. A restart fixes it.',
      diagnose: `ls /proc/$(pgrep -f app.jar)/fd | wc -l      # 65,201 and climbing (ulimit -n 65536)
ls -l /proc/$(pgrep -f app.jar)/fd | grep -c uploads   # most point at the uploads directory
# code:
Files.list(uploads).filter(this::isNew).forEach(this::ingest);   // stream never closed`,
      cause: '<code>Files.list</code> returns a stream backed by an open <code>DirectoryStream</code>. Nobody closed it, so each scan leaked one file handle until the limit.',
      fix: 'Close it with try-with-resources. Add a metric for open files (Micrometer’s <code>process.files.open</code>) and alert well below the limit.',
      fixCode: `try (Stream<Path> files = Files.list(uploads)) {
    files.filter(this::isNew).forEach(this::ingest);
}` },
    { title: 'Pods die with “Direct buffer memory” while the heap is half empty',
      symptom: 'An API gateway crashes under load with <code>OutOfMemoryError: Direct buffer memory</code>. Heap use is 40%.',
      diagnose: `// expose direct memory
ManagementFactory.getPlatformMXBeans(BufferPoolMXBean.class)
    .forEach(p -> log.info("{} count={} used={}", p.getName(), p.getCount(), p.getMemoryUsed()));
// direct count=48,210 used=1.9 GB   ← grows with traffic, never shrinks
# or: java -XX:NativeMemoryTracking=summary … ; jcmd <pid> VM.native_memory summary`,
      cause: 'A compression filter allocated a 64 KB <code>ByteBuffer.allocateDirect</code> per request. Direct memory comes back only when those small heap objects are collected. With a quiet young generation, that happened too rarely. The direct-memory limit ran out first.',
      fix: 'Reuse buffers (per thread or pooled), or use heap buffers for short-lived work. Set <code>-XX:MaxDirectMemorySize</code> explicitly and count it in the container memory budget.',
      fixCode: `// one reusable direct buffer per worker, not per request
private static final ThreadLocal<ByteBuffer> BUF =
        ThreadLocal.withInitial(() -> ByteBuffer.allocateDirect(64 * 1024));
// (with virtual threads, prefer a small bounded pool instead of a ThreadLocal)` },
    { title: 'A WebFlux service stalls whenever one query is slow',
      symptom: 'p99 latency of <i>all</i> endpoints jumps to seconds whenever the reporting query is slow. Yet the reporting endpoint gets little traffic.',
      diagnose: `jcmd <pid> Thread.print | grep -A8 'reactor-http-nio'
# "reactor-http-nio-2" RUNNABLE
#   at sun.nio.ch.SocketDispatcher.read0
#   at org.postgresql.core.PGStream.receive ...      ← blocking JDBC on an event loop
#   at ReportHandler.lambda$handle$0`,
      cause: 'The handler called a blocking JDBC repository inside a reactive pipeline. That event-loop thread owns hundreds of connections. While it waited on Postgres, none of them moved.',
      fix: 'Move blocking calls off the event loop, or switch the endpoint to R2DBC. On Java 21, a plain Spring MVC endpoint on virtual threads is often simpler for blocking JDBC.',
      fixCode: `Mono<Report> report(long id) {
    return Mono.fromCallable(() -> reportRepository.load(id))   // blocking JDBC
               .subscribeOn(Schedulers.boundedElastic());         // not on reactor-http-nio
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Follow the three indexes. What does this print?', code: `import java.nio.*;

public class Main {
    public static void main(String[] a) {
        ByteBuffer b = ByteBuffer.allocate(8);
        b.put((byte) 1).put((byte) 2).put((byte) 3);
        System.out.println(b.position() + " " + b.limit() + " " + b.remaining());
        b.flip();
        System.out.println(b.position() + " " + b.limit() + " " + b.remaining());
        b.get();
        b.compact();
        System.out.println(b.position() + " " + b.limit());
    }
}`, options: ['3 8 5 / 0 3 3 / 2 8', '3 8 5 / 0 8 8 / 0 8', '3 3 0 / 0 3 3 / 1 3', '0 8 8 / 0 3 3 / 2 3'], answer: 0, run: true, expect: '3 8 5\n0 3 3\n2 8', explain: 'After three puts, position is 3 and limit is the capacity, 8. So <b>5</b> bytes of space remain. <code>flip()</code> sets limit = 3, position = 0: <b>3</b> bytes to read. One <code>get()</code> reads the first byte. <code>compact()</code> moves the two unread bytes to the front and sets position = 2, limit = 8. It’s ready to append more.' },
    { kind: 'predict', q: 'The missing <code>flip()</code>. Output?', code: `import java.io.*;
import java.nio.*;
import java.nio.channels.*;
import java.nio.charset.StandardCharsets;

public class Main {
    public static void main(String[] a) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        WritableByteChannel ch = Channels.newChannel(out);
        ByteBuffer b = ByteBuffer.allocate(16);
        b.put("hi".getBytes(StandardCharsets.US_ASCII));
        int n1 = ch.write(b);            // no flip
        b.clear();
        b.put("hi".getBytes(StandardCharsets.US_ASCII));
        b.flip();
        int n2 = ch.write(b);
        System.out.println(n1 + " " + n2 + " " + out.size());
    }
}`, options: ['0 2 2', '2 2 4', '14 2 16', '16 2 18'], answer: 2, run: true, expect: '14 2 16', explain: 'Without <code>flip()</code>, the channel writes from position 2 to limit 16: <b>14 zero bytes</b>, not “hi”. With the flip it writes exactly <b>2</b> bytes. The output now holds 16 bytes, and only the last two are what you meant. This is one of the most common NIO bugs.' },
    { kind: 'predict', q: 'Heap, direct and wrapped buffers. What does this print?', code: `import java.nio.*;

public class Main {
    public static void main(String[] a) {
        byte[] arr = new byte[4];
        ByteBuffer wrapped = ByteBuffer.wrap(arr);
        arr[0] = 9;
        System.out.println(ByteBuffer.allocate(4).hasArray() + " "
                + ByteBuffer.allocateDirect(4).hasArray() + " "
                + wrapped.get(0) + " " + wrapped.isDirect());
    }
}`, options: ['true true 0 false', 'true false 9 false', 'true false 0 false', 'false false 9 true'], answer: 1, run: true, expect: 'true false 9 false', explain: 'A heap buffer has a <code>byte[]</code> you can reach (<b>true</b>). A direct buffer lives off-heap and has no array (<b>false</b>). <code>wrap</code> doesn’t copy: buffer and array share storage. So the write to <code>arr[0]</code> shows up as <b>9</b>. The absolute <code>get(0)</code> doesn’t move the position.' },
    { kind: 'predict', q: 'Byte order. Output?', code: `import java.nio.*;
import java.util.Arrays;

public class Main {
    public static void main(String[] a) {
        byte[] big = ByteBuffer.allocate(4).putInt(1).array();
        byte[] little = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(1).array();
        System.out.println(Arrays.toString(big) + " " + Arrays.toString(little));
    }
}`, options: ['[1, 0, 0, 0] [0, 0, 0, 1]', '[0, 0, 0, 1] [1, 0, 0, 0]', '[0, 0, 0, 1] [0, 0, 0, 1]', 'Depends on the CPU'], answer: 1, run: true, expect: '[0, 0, 0, 1] [1, 0, 0, 0]', explain: 'A new <code>ByteBuffer</code> is always <b>big-endian</b> (network order), whatever the CPU. Ask for little-endian with <code>order()</code>. Many file formats and x86 programs use little-endian. Forgetting this is a classic parsing bug.' },
    { kind: 'predict', q: 'Trailing newlines and <code>readAllLines</code>. Output?', code: `import java.nio.file.*;

public class Main {
    public static void main(String[] a) throws Exception {
        Path p = Files.createTempFile("t", ".txt");
        Files.writeString(p, "a\\nb\\n");
        int x = Files.readAllLines(p).size();
        Files.writeString(p, "a\\nb\\n\\n");
        int y = Files.readAllLines(p).size();
        Files.delete(p);
        System.out.println(x + " " + y);
    }
}`, options: ['2 3', '3 4', '2 2', '3 3'], answer: 0, run: true, expect: '2 3', explain: 'A line ending ends a line. It doesn’t start a new one. So <code>"a\\nb\\n"</code> is <b>2</b> lines, and an extra blank line makes <b>3</b> (the last one empty). <code>Files.writeString</code> and <code>readAllLines</code> use UTF-8 by default.' },
    { kind: 'concept', q: 'In a Selector loop you process <code>selector.selectedKeys()</code> but never remove the keys. What happens?', options: ['Nothing; select() clears the set', 'Keys stay in the selected set, so already-handled channels are processed again on the next loop', 'The selector throws CancelledKeyException', 'The channels are closed'], answer: 1, explain: '<code>select()</code> adds ready keys to the selected set but never removes them. Call <code>iterator.remove()</code> (or <code>clear()</code> the set) after handling each one. Otherwise you handle stale keys again. A non-blocking read returning 0 bytes then looks like a busy loop. Since Java 11, <code>select(Consumer&lt;SelectionKey&gt;)</code> avoids this.' },
    { kind: 'concept', q: 'Why does <code>FileChannel.transferTo(socket)</code> often beat a read/write loop for serving files?', options: ['It compresses the data', 'On Linux it can use sendfile: bytes go from the page cache to the socket without being copied into the JVM', 'It skips the page cache and reads the disk directly', 'It runs on a separate thread pool'], answer: 1, explain: 'A read/write loop copies kernel → your buffer → kernel. <code>transferTo</code> lets the OS move data from the page cache to the socket directly. Your app copies nothing (<i>zero-copy</i>). That saves CPU and memory bandwidth. Kafka serves log segments this way.' },
    { kind: 'concept', q: 'Java 21. You need to handle 20,000 mostly idle socket connections with simple request/response logic. Which is the simplest approach that scales?', options: ['A thread per connection with platform threads', 'A hand-written Selector loop', 'A thread per connection with virtual threads', 'One thread reading all sockets in turn with blocking reads'], answer: 2, explain: 'On virtual threads, a blocking socket call parks instead of holding an OS thread. So thread-per-connection code scales to tens of thousands of connections. Selectors (or Netty) still win when you need fine control over buffers and back-pressure. But they are harder to write. 20,000 platform threads would need gigabytes of stack and heavy scheduling.' }
  ],
  interview: [
    { q: 'Compare <code>java.io</code> and NIO.', a: '<p><code>java.io</code> works with streams. It blocks, has one byte or char sequence per stream, and simple wrappers (<code>BufferedInputStream</code>, <code>InputStreamReader</code>). NIO works with buffers. Channels can be non-blocking, and a <code>Selector</code> lets one thread watch many channels. It also has memory-mapped files, scatter/gather and file locks. NIO.2 (Java 7) added <code>Path</code>/<code>Files</code>, which replaced <code>java.io.File</code> for most file work, plus async channels.</p>', lvl: 'core' },
    { q: 'Explain position, limit, capacity, and <code>flip</code> / <code>clear</code> / <code>compact</code> / <code>rewind</code>.', a: '<p>Capacity is fixed. Position is where the next get or put happens. Limit is the first index you may not touch. <code>flip()</code>: limit = position, position = 0 (switch from filling to draining). <code>clear()</code>: position = 0, limit = capacity (start over). <code>compact()</code>: move unread bytes to the start, position after them, limit = capacity (keep a partial message). <code>rewind()</code>: position = 0, limit unchanged (read again). None of them erase data.</p>', lvl: 'core' },
    { q: 'Heap vs direct ByteBuffer?', a: '<p>Heap buffers wrap a <code>byte[]</code>. They are cheap to make and the GC manages them. But channel I/O copies them into a temporary native buffer. Direct buffers live in native memory, so I/O needs no extra copy. But they are slow to allocate and freed only when their owner object is collected. <code>-XX:MaxDirectMemorySize</code> caps them. Rule: direct for long-lived, pooled I/O buffers (as Netty does), heap for short-lived work.</p>', lvl: 'core' },
    { q: 'How does a Selector work?', a: '<p>You set channels to non-blocking and <code>register</code> them with what you care about (<code>OP_ACCEPT</code>, <code>OP_CONNECT</code>, <code>OP_READ</code>, <code>OP_WRITE</code>). <code>select()</code> blocks until at least one is ready (epoll on Linux, kqueue on macOS). Then you loop over <code>selectedKeys()</code>, handle each without blocking, and remove it from the set. <code>wakeup()</code> breaks a blocked select, e.g. to register a channel from another thread. Register <code>OP_WRITE</code> only while you have output waiting, or you spin.</p>', lvl: 'deep' },
    { q: 'What is a memory-mapped file and when is it useful?', a: '<p><code>FileChannel.map</code> maps part of a file into memory. Reading the buffer pulls pages in from the page cache. Writes mark pages dirty, and the OS writes them back (or you call <code>force()</code>). You avoid read/write calls and copies. You get random access to huge files and sharing between processes. But page faults cost something. You can’t unmap on demand before the FFM API. Each <code>MappedByteBuffer</code> holds 2 GB max. I/O errors show up as odd exceptions on access. Databases, Lucene and Chronicle Queue use it.</p>', lvl: 'deep' },
    { q: 'What is zero-copy, and how do you get it in Java?', a: '<p>Avoiding copies between the kernel and your program. <code>FileChannel.transferTo/transferFrom</code> can use <code>sendfile</code>/<code>splice</code> on Linux, so file data reaches a socket inside the kernel. Memory-mapped files skip copies into your buffers. Direct buffers skip the JDK’s extra heap-to-native copy. TLS breaks sendfile-style zero-copy, because data must be encrypted in your process (unless kernel TLS is used).</p>', lvl: 'deep' },
    { q: 'How do Netty and Reactor relate to NIO?', a: '<p>Netty wraps NIO (or native epoll/io_uring) in an event-loop model. Each event-loop thread owns a selector and a set of channels. Handlers run on that thread and must not block. Pooled, reference-counted <code>ByteBuf</code>s replace <code>ByteBuffer</code>. Spring WebFlux runs on Reactor Netty by default. That’s why one blocking call in a handler hurts so much.</p>', lvl: 'core' },
    { q: 'Does blocking I/O still make sense with Java 21?', a: '<p>Yes, more than before. Since JDK 13 the classic socket API runs on NIO. So virtual threads park on blocking socket calls, and thread-per-request code scales to many connections without callbacks. File I/O differs: many file calls still block an OS thread. The JDK makes up for it by adding carrier threads for a while. Selectors and Netty remain the tool for huge connection counts, custom protocols and fine buffer control.</p>', lvl: 'deep' },
    { q: 'How do you read a large file efficiently?', a: '<ul><li>Line by line: <code>Files.lines(path)</code> or <code>Files.newBufferedReader(path, cs)</code>, in try-with-resources.</li><li>Binary, in order: a <code>BufferedInputStream</code>, or a <code>FileChannel</code> with a reused 64 KB+ buffer.</li><li>Copying: <code>Files.copy</code>, <code>InputStream.transferTo</code> (Java 9) or <code>FileChannel.transferTo</code>.</li><li>Random access to huge files: memory-map in chunks.</li></ul><p>Never <code>readAllBytes</code> a file whose size you don’t control.</p>', lvl: 'core' },
    { q: 'What is the difference between <code>Files.lines</code> and <code>Files.readAllLines</code>?', a: '<p><code>readAllLines</code> reads everything into a <code>List&lt;String&gt;</code> at once and closes the file. <code>lines</code> returns a lazy <code>Stream</code>. It reads as you go and keeps the file open until you close the stream. Use <code>lines</code> for big files, always in try-with-resources. Both use UTF-8 by default. Both throw on invalid bytes (<code>MalformedInputException</code>, or <code>UncheckedIOException</code> for the stream).</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Streaming files the right way', lang: 'java', code: `// count matching lines in a multi-GB log without loading it
long errors;
try (Stream<String> lines = Files.lines(logPath, StandardCharsets.UTF_8)) {
    errors = lines.filter(l -> l.contains(" ERROR ")).count();
}

// copy a file to an HTTP response with zero-copy where the OS supports it
try (FileChannel in = FileChannel.open(file, StandardOpenOption.READ);
     WritableByteChannel out = Channels.newChannel(response.getOutputStream())) {
    long pos = 0, size = in.size();
    while (pos < size) pos += in.transferTo(pos, size - pos, out);   // may transfer less than asked
}

// Spring MVC: stream a large export without buffering it in memory
@GetMapping("/exports/{id}")
ResponseEntity<StreamingResponseBody> export(@PathVariable long id) {
    StreamingResponseBody body = out -> exporter.writeCsv(id, out);   // runs on an async thread
    return ResponseEntity.ok().contentType(MediaType.TEXT_PLAIN).body(body);
}`, note: '<code>transferTo</code> uses sendfile only when the target is a real socket or file channel. Through a servlet stream wrapper it falls back to copying, still in chunks.' },
    { title: 'A minimal Selector echo server', lang: 'java', code: `try (Selector sel = Selector.open();
     ServerSocketChannel server = ServerSocketChannel.open()) {
    server.bind(new InetSocketAddress(9000));
    server.configureBlocking(false);
    server.register(sel, SelectionKey.OP_ACCEPT);

    while (true) {
        sel.select();                                         // sleep until something is ready
        Iterator<SelectionKey> it = sel.selectedKeys().iterator();
        while (it.hasNext()) {
            SelectionKey key = it.next();
            it.remove();                                      // must remove handled keys
            if (key.isAcceptable()) {
                SocketChannel c = server.accept();
                c.configureBlocking(false);
                c.register(sel, SelectionKey.OP_READ, ByteBuffer.allocate(4096));
            } else if (key.isReadable()) {
                SocketChannel c = (SocketChannel) key.channel();
                ByteBuffer buf = (ByteBuffer) key.attachment();
                int n = c.read(buf);                          // non-blocking: may be 0
                if (n < 0) { key.cancel(); c.close(); continue; }
                buf.flip();
                c.write(buf);                                 // may write partially…
                buf.compact();                                // …so keep what is left
            }
        }
    }
}`, note: 'A real server also registers <code>OP_WRITE</code> when output is waiting, and handles partial writes and back-pressure. Netty does that work for you.' },
    { title: 'Memory-mapped reads (and the Java 22 way)', lang: 'java', code: `// classic NIO: map up to 2 GB per buffer
try (FileChannel ch = FileChannel.open(index, StandardOpenOption.READ)) {
    MappedByteBuffer map = ch.map(FileChannel.MapMode.READ_ONLY, 0, ch.size());
    map.order(ByteOrder.LITTLE_ENDIAN);           // match the file format
    int entries = map.getInt(0);
    long firstOffset = map.getLong(8);
    // unmapped only when 'map' is garbage-collected
}

// Java 22+ (FFM API final): deterministic unmap, 64-bit offsets
try (Arena arena = Arena.ofConfined();
     FileChannel ch = FileChannel.open(index, StandardOpenOption.READ)) {
    MemorySegment seg = ch.map(FileChannel.MapMode.READ_ONLY, 0, ch.size(), arena);
    int entries = seg.get(ValueLayout.JAVA_INT_UNALIGNED.withOrder(ByteOrder.LITTLE_ENDIAN), 0);
}   // arena.close() unmaps here`, note: 'On Java 21 the FFM API is still a preview. The <code>MemorySegment</code> version needs <code>--enable-preview</code> there.' }
  ]
});
