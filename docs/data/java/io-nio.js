IA.register({
  track: 'java',
  slug: 'io-nio',
  title: 'I/O & NIO',
  tagline: '<code>java.io</code> is <b>streams and blocking</b>: one thread waits per connection. NIO is <b>buffers, channels and selectors</b>: one thread can watch thousands of connections and ask “who is ready?”. Underneath both sits the OS page cache, which explains memory-mapped files and zero-copy <code>transferTo</code>. Java 21’s virtual threads bring back the simple blocking style at NIO-like cost.',
  tldr: {
    problem: 'I/O bugs look like other bugs: “Too many open files”, <code>OutOfMemoryError: Direct buffer memory</code>, an event loop frozen by one blocking call, a buffer that writes zeros because nobody called <code>flip()</code>, a 4 GB file read into a byte array.',
    model: 'A <code>ByteBuffer</code> is an array plus three indexes: <b>position</b> (next slot), <b>limit</b> (end of the usable part) and <b>capacity</b>. Write into it, <code>flip()</code> to read what you wrote, <code>clear()</code> or <code>compact()</code> to write again. A <b>channel</b> moves bytes between a buffer and a file or socket. A <b>selector</b> multiplexes many non-blocking channels on one thread (epoll on Linux).',
    hook: '“How does Netty serve 50,000 connections with 16 threads?” Each event-loop thread owns a Selector; it sleeps in <code>select()</code> until the kernel reports ready sockets, handles them without blocking, and goes back. Block that thread once and every connection on it stalls.',
    facts: [
      { v: 'Java 1.4', l: 'introduced NIO (JSR 51): buffers, channels, selectors. Java 7 added NIO.2 (JSR 203): <code>Path</code>, <code>Files</code>, async channels, <code>WatchService</code>' },
      { v: '3 indexes', l: '<code>0 ≤ position ≤ limit ≤ capacity</code>. <code>flip()</code>: limit = position, position = 0. <code>clear()</code>: position = 0, limit = capacity. Neither erases data' },
      { v: 'JDK 13', l: 'reimplemented the classic <code>Socket</code>/<code>ServerSocket</code> on NIO internals (JEP 353), which later let virtual threads park on blocking socket calls instead of holding a carrier' }
    ]
  },
  intro: {
    what: 'Programs read and write files and network connections. The classic way, <b>streams</b> (<code>InputStream</code>, <code>Reader</code>), is simple: you call <code>read()</code> and your thread waits until data arrives. With 10,000 slow connections that means 10,000 waiting threads. <b>NIO</b> lets one thread put many connections in non-blocking mode and ask the operating system which ones have data, then read exactly those. Data moves through <b>buffers</b>, fixed-size boxes of bytes with a cursor, which you must manage yourself.',
    analogy: { icon: '📬', title: 'Waiting by each mailbox vs. a porter', text: 'Blocking I/O is hiring one person per mailbox to stand there until a letter arrives. NIO is one porter who sleeps until the building bell rings, checks the board of lit-up mailboxes (the selector), empties only those, and goes back to sleep. Fast, as long as the porter never stops to read a long letter on the spot.' },
    steps: [
      { t: 'Files: use <code>java.nio.file.Files</code>', d: 'It handles charsets, buffering and closing for the common cases.', code: 'String cfg = Files.readString(Path.of("app.yml"));              // small files\ntry (Stream<String> lines = Files.lines(Path.of("big.log"))) {  // large: lazy, must close\n    long errors = lines.filter(l -> l.contains("ERROR")).count();\n}' },
      { t: 'Buffers: write, flip, read', d: 'After putting bytes in, <code>flip()</code> so the reader sees exactly those bytes.', code: 'ByteBuffer buf = ByteBuffer.allocate(4096);\nint n = channel.read(buf);   // fills from position\nbuf.flip();                  // limit = position, position = 0\nout.write(buf);              // drains position → limit\nbuf.clear();                 // ready to fill again' },
      { t: 'Many sockets, one thread: a Selector', d: 'Register non-blocking channels; <code>select()</code> returns when some are ready.' },
      { t: 'Or just block, on virtual threads (Java 21)', d: 'Plain blocking socket code on a virtual thread parks instead of holding an OS thread. Frameworks like Netty still use selectors directly.' }
    ],
    terms: [
      ['stream', '<code>java.io</code> byte (<code>InputStream</code>) or char (<code>Reader</code>) sequence; reads block.'],
      ['ByteBuffer', 'A container of bytes with position, limit and capacity. Heap (backed by a <code>byte[]</code>) or direct (off-heap).'],
      ['channel', 'A connection to a file or socket that reads into and writes from buffers: <code>FileChannel</code>, <code>SocketChannel</code>.'],
      ['selector', 'Multiplexer that reports which registered channels are ready to accept, connect, read or write.'],
      ['memory-mapped file', 'A file region mapped into the process’s address space: reading memory reads the file, via the page cache.'],
      ['page cache', 'The kernel’s cache of file contents in RAM. Most “disk reads” are served from it.']
    ]
  },
  visual: {
    title: 'Watch a ByteBuffer’s indexes, a Selector loop, and where bytes get copied',
    caption: 'Pick a view and press Play or Step. <b>ByteBuffer</b> shows position (P), limit (L) and capacity through <code>put</code>, <code>flip</code>, <code>get</code>, <code>compact</code> and <code>clear</code>. <b>blocking vs selector</b> runs the same four connections both ways. <b>copies</b> counts the bytes copied by read/write, by a memory-mapped file, and by zero-copy <code>transferTo</code>.'
  },
  gotchas: [
    { trap: 'Forgetting <code>flip()</code>', code: `ByteBuffer b = ByteBuffer.allocate(16);
b.put("hi".getBytes(US_ASCII));
channel.write(b);   // writes bytes 2..15: fourteen zeros, not "hi"`, why: 'Writes and reads always work from position to limit. After <code>put</code>, position is after your data and limit is the capacity, so the “remaining” part is the empty space.', fix: '<code>flip()</code> before draining a buffer you filled. After draining, <code>clear()</code> (discard) or <code>compact()</code> (keep unread bytes) before filling again.' },
    { trap: 'Not closing <code>Files.lines</code>, <code>Files.list</code>, <code>Files.walk</code>', code: `long n = Files.list(dir).count();   // DirectoryStream left open`, why: 'These streams hold an open file handle until closed; the GC doesn’t close them promptly. A loop leaks descriptors until <code>IOException: Too many open files</code>.', fix: 'Always <code>try (Stream&lt;Path&gt; s = Files.list(dir)) { … }</code>. Same for <code>Files.newDirectoryStream</code>, channels, sockets and <code>RandomAccessFile</code>.' },
    { trap: 'Reading a huge file into memory', code: `byte[] all = Files.readAllBytes(dump);         // 6 GB → OutOfMemoryError
List<String> lines = Files.readAllLines(log);   // fine for config, not for logs`, why: 'Arrays are limited to about 2³¹ elements, and the heap rarely has room for multi-GB copies.', fix: 'Stream it: <code>Files.lines</code>, <code>BufferedReader</code>, <code>InputStream.transferTo(out)</code> (Java 9), or <code>FileChannel.transferTo</code>.' },
    { trap: '<code>OutOfMemoryError: Direct buffer memory</code>', why: 'Direct buffers live outside the heap and are freed only when their small <code>ByteBuffer</code> object is garbage-collected. Allocating them per request (or leaking Netty <code>ByteBuf</code>s) exhausts <code>-XX:MaxDirectMemorySize</code> (which defaults to roughly the max heap size) while the heap looks fine.', fix: 'Allocate direct buffers once and reuse or pool them; release reference-counted buffers. Watch them with <code>BufferPoolMXBean</code> (<code>direct</code> pool) or Native Memory Tracking.' },
    { trap: 'Heap buffers on channels allocate hidden direct buffers', why: 'The OS can only do I/O from native memory, so writing a heap <code>ByteBuffer</code> to a channel makes the JDK copy it into a temporary direct buffer, cached per thread. With many threads and large writes, these caches add up.', fix: 'Use direct buffers for long-lived channel I/O, keep writes reasonably sized, and consider <code>-Djdk.nio.maxCachedBufferSize</code> to stop very large temporary buffers being cached.' },
    { trap: 'Blocking the selector (event-loop) thread', code: `// inside a Netty handler / WebFlux operator, on reactor-http-nio-3
User u = jdbcTemplate.queryForObject(sql, mapper, id);   // blocks the event loop`, why: 'One event-loop thread serves many connections. While it waits for the database, none of them are read or written.', fix: 'Offload blocking work (<code>Schedulers.boundedElastic()</code>, a separate executor) or use non-blocking drivers. Detect it in tests with BlockHound.' },
    { trap: 'Expecting a MappedByteBuffer to unmap when you are done', why: 'There is no public unmap: the mapping is released when the buffer is garbage-collected. On Windows the file can’t be deleted or truncated meanwhile, and a single <code>MappedByteBuffer</code> is limited to 2 GB (int indexes).', fix: 'Map in chunks, keep mappings long-lived, and on Java 22+ use the FFM API (<code>FileChannel.map(mode, offset, size, arena)</code> returning a <code>MemorySegment</code>), whose <code>Arena.close()</code> unmaps deterministically.' }
  ],
  scenarios: [
    { title: '“Too many open files” every few days',
      symptom: 'A service that scans an upload directory every 10 seconds starts failing with <code>FileSystemException: Too many open files</code> after a few days. A restart fixes it.',
      diagnose: `ls /proc/$(pgrep -f app.jar)/fd | wc -l      # 65,201 and climbing (ulimit -n 65536)
ls -l /proc/$(pgrep -f app.jar)/fd | grep -c uploads   # most point at the uploads directory
# code:
Files.list(uploads).filter(this::isNew).forEach(this::ingest);   // stream never closed`,
      cause: '<code>Files.list</code> returns a stream backed by an open <code>DirectoryStream</code>. Without closing, each scan leaked one descriptor until the per-process limit.',
      fix: 'Close it with try-with-resources. Add a metric for open descriptors (Micrometer’s <code>process.files.open</code>) and alert well below the limit.',
      fixCode: `try (Stream<Path> files = Files.list(uploads)) {
    files.filter(this::isNew).forEach(this::ingest);
}` },
    { title: 'Pods die with “Direct buffer memory” while the heap is half empty',
      symptom: 'An API gateway crashes under load with <code>OutOfMemoryError: Direct buffer memory</code>. Heap usage is at 40%.',
      diagnose: `// expose direct memory
ManagementFactory.getPlatformMXBeans(BufferPoolMXBean.class)
    .forEach(p -> log.info("{} count={} used={}", p.getName(), p.getCount(), p.getMemoryUsed()));
// direct count=48,210 used=1.9 GB   ← grows with traffic, never shrinks
# or: java -XX:NativeMemoryTracking=summary … ; jcmd <pid> VM.native_memory summary`,
      cause: 'A response-compression filter allocated a 64 KB <code>ByteBuffer.allocateDirect</code> per request. Direct memory is only returned when those small heap objects are collected, and with a quiet young generation that happened too rarely. The direct-memory limit was hit first.',
      fix: 'Reuse buffers (a per-thread or pooled buffer), or use heap buffers for short-lived work. Size <code>-XX:MaxDirectMemorySize</code> explicitly and include it in the container memory budget.',
      fixCode: `// one reusable direct buffer per worker, not per request
private static final ThreadLocal<ByteBuffer> BUF =
        ThreadLocal.withInitial(() -> ByteBuffer.allocateDirect(64 * 1024));
// (with virtual threads, prefer a small bounded pool instead of a ThreadLocal)` },
    { title: 'A WebFlux service stalls whenever one query is slow',
      symptom: 'p99 latency of <i>all</i> endpoints jumps to seconds whenever the reporting query is slow, though the reporting endpoint gets little traffic.',
      diagnose: `jcmd <pid> Thread.print | grep -A8 'reactor-http-nio'
# "reactor-http-nio-2" RUNNABLE
#   at sun.nio.ch.SocketDispatcher.read0
#   at org.postgresql.core.PGStream.receive ...      ← blocking JDBC on an event loop
#   at ReportHandler.lambda$handle$0`,
      cause: 'The handler called a blocking JDBC repository directly inside a reactive pipeline. That event-loop thread owns hundreds of connections; while it waited on Postgres, none of them progressed.',
      fix: 'Move blocking calls off the event loop, or switch the endpoint to R2DBC. On Java 21, a plain Spring MVC endpoint on virtual threads is often the simpler choice for blocking JDBC.',
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
}`, options: ['3 8 5 / 0 3 3 / 2 8', '3 8 5 / 0 8 8 / 0 8', '3 3 0 / 0 3 3 / 1 3', '0 8 8 / 0 3 3 / 2 3'], answer: 0, run: true, expect: '3 8 5\n0 3 3\n2 8', explain: 'After three puts, position is 3 and limit is the capacity, 8: <b>5</b> bytes of free space remain. <code>flip()</code> sets limit = 3, position = 0: <b>3</b> bytes to read. One <code>get()</code> reads the first byte; <code>compact()</code> moves the two unread bytes to the front and sets position = 2, limit = 8, ready to append more.' },
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
}`, options: ['0 2 2', '2 2 4', '14 2 16', '16 2 18'], answer: 2, run: true, expect: '14 2 16', explain: 'Without <code>flip()</code>, the channel writes from position 2 to limit 16: <b>14 zero bytes</b>, not “hi”. With the flip it writes exactly the <b>2</b> bytes. The output now holds 16 bytes of which only the last two are what you meant. This is one of the most common NIO bugs.' },
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
}`, options: ['true true 0 false', 'true false 9 false', 'true false 0 false', 'false false 9 true'], answer: 1, run: true, expect: 'true false 9 false', explain: 'A heap buffer is backed by an accessible <code>byte[]</code> (<b>true</b>); a direct buffer lives off-heap and has no array (<b>false</b>). <code>wrap</code> doesn’t copy: buffer and array share storage, so the write to <code>arr[0]</code> shows up as <b>9</b>. The absolute <code>get(0)</code> doesn’t move the position.' },
    { kind: 'predict', q: 'Byte order. Output?', code: `import java.nio.*;
import java.util.Arrays;

public class Main {
    public static void main(String[] a) {
        byte[] big = ByteBuffer.allocate(4).putInt(1).array();
        byte[] little = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(1).array();
        System.out.println(Arrays.toString(big) + " " + Arrays.toString(little));
    }
}`, options: ['[1, 0, 0, 0] [0, 0, 0, 1]', '[0, 0, 0, 1] [1, 0, 0, 0]', '[0, 0, 0, 1] [0, 0, 0, 1]', 'Depends on the CPU'], answer: 1, run: true, expect: '[0, 0, 0, 1] [1, 0, 0, 0]', explain: 'A new <code>ByteBuffer</code> is always <b>big-endian</b> (network order), whatever the CPU. Little-endian must be requested with <code>order()</code>. Binary formats from x86 programs or many file formats are little-endian, which is a classic parsing bug.' },
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
}`, options: ['2 3', '3 4', '2 2', '3 3'], answer: 0, run: true, expect: '2 3', explain: 'A line terminator ends a line; it doesn’t start a new one. So <code>"a\\nb\\n"</code> is <b>2</b> lines, and an extra blank line makes <b>3</b> (the last one empty). <code>Files.writeString</code> and <code>readAllLines</code> default to UTF-8.' },
    { kind: 'concept', q: 'In a Selector loop you process <code>selector.selectedKeys()</code> but never remove the keys. What happens?', options: ['Nothing; select() clears the set', 'Keys stay in the selected set, so already-handled channels are processed again on the next loop', 'The selector throws CancelledKeyException', 'The channels are closed'], answer: 1, explain: '<code>select()</code> adds ready keys to the selected-key set but never removes them. You must call <code>iterator.remove()</code> (or <code>clear()</code> the set) after handling each one. Otherwise you re-handle stale keys, and a non-blocking read returning 0 bytes looks like a busy loop. Since Java 11, <code>select(Consumer&lt;SelectionKey&gt;)</code> avoids this by design.' },
    { kind: 'concept', q: 'Why does <code>FileChannel.transferTo(socket)</code> often beat a read/write loop for serving files?', options: ['It compresses the data', 'On Linux it can use sendfile: bytes go from the page cache to the socket without being copied into the JVM', 'It skips the page cache and reads the disk directly', 'It runs on a separate thread pool'], answer: 1, explain: 'A read/write loop copies kernel → user buffer → kernel. <code>transferTo</code> lets the OS move data from the page cache to the socket buffer (zero-copy from the application’s view), saving CPU and memory bandwidth. Kafka uses this to serve log segments to consumers.' },
    { kind: 'concept', q: 'Java 21. You need to handle 20,000 mostly idle socket connections with simple request/response logic. Which is the simplest approach that scales?', options: ['A thread per connection with platform threads', 'A hand-written Selector loop', 'A thread per connection with virtual threads', 'One thread reading all sockets in turn with blocking reads'], answer: 2, explain: 'Virtual threads make blocking socket calls park instead of holding an OS thread, so thread-per-connection code scales to tens of thousands of connections. Selectors (or Netty) still win when you need precise control over buffers and back-pressure, but they are harder to write. 20,000 platform threads would need gigabytes of reserved stack and heavy scheduling.' }
  ],
  interview: [
    { q: 'Compare <code>java.io</code> and NIO.', a: '<p><code>java.io</code>: stream-oriented, blocking, one byte or char sequence per stream, simple decorators (<code>BufferedInputStream</code>, <code>InputStreamReader</code>). NIO: buffer-oriented, channels can be non-blocking, a <code>Selector</code> multiplexes many channels on one thread, plus memory-mapped files, scatter/gather and file locks. NIO.2 (Java 7) added <code>Path</code>/<code>Files</code>, which replaced <code>java.io.File</code> for most file work, and asynchronous channels.</p>', lvl: 'core' },
    { q: 'Explain position, limit, capacity, and <code>flip</code> / <code>clear</code> / <code>compact</code> / <code>rewind</code>.', a: '<p>Capacity is fixed. Position is where the next get or put happens. Limit is the first index you may not touch. <code>flip()</code>: limit = position, position = 0 (switch from filling to draining). <code>clear()</code>: position = 0, limit = capacity (forget everything). <code>compact()</code>: copy the unread bytes to the start, position after them, limit = capacity (keep a partial message). <code>rewind()</code>: position = 0, limit unchanged (re-read). None of them erase data.</p>', lvl: 'core' },
    { q: 'Heap vs direct ByteBuffer?', a: '<p>Heap buffers wrap a <code>byte[]</code>: cheap to allocate, GC-managed, but channel I/O copies them into a temporary native buffer. Direct buffers live in native memory: no extra copy for I/O, but expensive to allocate, freed only when the owning object is collected (via a Cleaner), and capped by <code>-XX:MaxDirectMemorySize</code>. Rule: direct for long-lived, pooled I/O buffers (Netty’s pooled allocator); heap for short-lived processing.</p>', lvl: 'core' },
    { q: 'How does a Selector work?', a: '<p>You put channels in non-blocking mode and <code>register</code> them with interest ops (<code>OP_ACCEPT</code>, <code>OP_CONNECT</code>, <code>OP_READ</code>, <code>OP_WRITE</code>). <code>select()</code> blocks until at least one is ready (backed by epoll on Linux, kqueue on macOS), then you iterate <code>selectedKeys()</code>, handle each with non-blocking reads and writes, and remove it from the set. <code>wakeup()</code> interrupts a blocked select, for example to register a channel from another thread. Only register <code>OP_WRITE</code> while you actually have pending output, or you spin.</p>', lvl: 'deep' },
    { q: 'What is a memory-mapped file and when is it useful?', a: '<p><code>FileChannel.map</code> maps a file region into virtual memory; reading the buffer triggers page faults that load pages from the page cache, and writes dirty those pages, which the OS writes back (or you <code>force()</code> them). Benefits: no read/write syscalls or user-space copies, random access to huge files, sharing between processes. Costs: page faults are not free, no deterministic unmap before the FFM API, 2 GB per <code>MappedByteBuffer</code>, and I/O errors surface as odd exceptions on access. Used by databases, Lucene, Chronicle Queue.</p>', lvl: 'deep' },
    { q: 'What is zero-copy, and how do you get it in Java?', a: '<p>Avoiding copies between kernel and user space. <code>FileChannel.transferTo/transferFrom</code> can use <code>sendfile</code>/<code>splice</code> on Linux to move file data to a socket inside the kernel. Memory-mapped files avoid copies into user buffers. Direct buffers avoid the JDK’s extra heap-to-native copy. Note TLS breaks sendfile-style zero-copy, since data must be encrypted in user space (unless kernel TLS is used).</p>', lvl: 'deep' },
    { q: 'How do Netty and Reactor relate to NIO?', a: '<p>Netty wraps NIO (or native epoll/io_uring transports) in an event-loop model: each event-loop thread owns a selector and a set of channels; handlers run on that thread and must not block. Pooled, reference-counted <code>ByteBuf</code>s replace <code>ByteBuffer</code>. Spring WebFlux runs on Reactor Netty by default. That is why one blocking call in a handler hurts so much.</p>', lvl: 'core' },
    { q: 'Does blocking I/O still make sense with Java 21?', a: '<p>Yes, more than before. Virtual threads park on blocking socket operations (since JDK 13 the classic socket API is implemented on NIO, JEP 353), so thread-per-request blocking code scales to many concurrent connections without callbacks. File I/O is different: many file operations still block an OS thread, and the JDK compensates by temporarily adding carrier threads. Selectors and Netty remain the tool for extreme connection counts, custom protocols and fine-grained buffer control.</p>', lvl: 'deep' },
    { q: 'How do you read a large file efficiently?', a: '<ul><li>Line by line: <code>Files.lines(path)</code> or <code>Files.newBufferedReader(path, cs)</code>, inside try-with-resources.</li><li>Binary, sequential: a <code>BufferedInputStream</code> or a <code>FileChannel</code> with a reused 64 KB+ buffer.</li><li>Copying: <code>Files.copy</code>, <code>InputStream.transferTo</code> (Java 9) or <code>FileChannel.transferTo</code>.</li><li>Random access to huge files: memory-map in chunks.</li></ul><p>Never <code>readAllBytes</code> on files whose size you don’t control.</p>', lvl: 'core' },
    { q: 'What is the difference between <code>Files.lines</code> and <code>Files.readAllLines</code>?', a: '<p><code>readAllLines</code> reads everything eagerly into a <code>List&lt;String&gt;</code> and closes the file. <code>lines</code> returns a lazy <code>Stream</code> that reads as you consume it and holds the file open until the stream is closed. Use <code>lines</code> for big files, always inside try-with-resources. Both decode as UTF-8 by default and throw <code>MalformedInputException</code> (or <code>UncheckedIOException</code> for the stream) on invalid bytes.</p>', lvl: 'core' }
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
}`, note: '<code>transferTo</code> uses sendfile only when the target is a real socket or file channel; through a servlet output stream wrapper it falls back to copying, but still in chunks.' },
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
}`, note: 'A real server also registers <code>OP_WRITE</code> when output is pending and handles partial writes and back-pressure. That is the work Netty does for you.' },
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
}   // arena.close() unmaps here`, note: 'On Java 21 the FFM API is still a preview; the <code>MemorySegment</code> variant needs <code>--enable-preview</code> there.' }
  ]
});
