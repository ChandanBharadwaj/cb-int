IA.register({
  track: 'nodejs',
  slug: 'streams-backpressure',
  title: 'Streams & backpressure',
  tagline: 'A stream moves data in <b>chunks</b> through a small buffer. <b>Backpressure</b> is the signal that says “slow down, my buffer is full”: <code>write()</code> returns <code>false</code>, and you wait for <code>\'drain\'</code>. Ignore it and a slow client turns your service into a memory balloon.',
  tldr: {
    problem: 'An export endpoint that works in tests and gets OOM-killed in production when one slow client downloads a big file. Sockets and file descriptors that leak when a client disconnects mid-stream. Both come from moving data without listening to backpressure.',
    model: 'Every stream has an internal buffer with a soft limit, the <b>highWaterMark</b>. <code>writable.write()</code> always accepts the chunk, but returns <code>false</code> once the buffer reaches the limit. The producer must stop and wait for <code>\'drain\'</code>. <code>pipeline()</code> and <code>for await</code> do this for you, and <code>pipeline()</code> also destroys every stream if one fails.',
    hook: '“What does it mean when <code>write()</code> returns false?” The chunk <i>was</i> accepted, but the buffer is at or above highWaterMark. Stop writing until <code>\'drain\'</code>. Then: “why use <code>pipeline</code> instead of <code>.pipe()</code>?” Because <code>.pipe()</code> doesn’t forward errors or clean up.',
    facts: [
      { v: '64 KiB', l: 'default highWaterMark for byte streams since <b>Node 22</b> (it was 16 KiB before). Object-mode streams count <b>16 objects</b>' },
      { v: '4', l: 'stream types: Readable, Writable, Duplex (both, independent) and Transform (a Duplex whose output is computed from its input)' },
      { v: 'Node 15', l: '<code>stream/promises</code> added <code>pipeline</code> and <code>finished</code> as promise APIs' }
    ]
  },
  intro: {
    what: 'Reading a 2 GB file into one string needs 2 GB of memory. A <b>stream</b> reads it a small piece at a time, passes each piece on, and forgets it. Files, HTTP requests and responses, sockets, gzip and stdin/stdout are all streams in Node. The hard part is speed: when the reader is faster than the writer, the pieces pile up somewhere. <b>Backpressure</b> is how the slow side tells the fast side to wait.',
    analogy: { icon: '🚰', title: 'A bucket with a fill line', text: 'You pour water (data) into a bucket (the buffer) that drains through a small hole (the slow client). The bucket has a line painted on it: the <b>highWaterMark</b>. You can pour past the line (nothing stops you), but the bucket tells you “I’m above the line” (<code>write()</code> returns false). A polite pourer stops and waits until the bucket is empty again (<code>\'drain\'</code>). A rude one keeps pouring, and the floor floods (your heap).' },
    steps: [
      { t: 'Readable: a source of chunks', d: 'A file, a request body, a database cursor. You read it with <code>for await</code>, a <code>\'data\'</code> listener, or by piping it somewhere.', code: "const fs = require('node:fs');\nfor await (const chunk of fs.createReadStream('big.log')) {\n  // chunk is a Buffer, up to 64 KiB here\n}" },
      { t: 'Writable: a destination', d: '<code>write(chunk)</code> buffers the chunk and returns <code>true</code> while there is room, <code>false</code> once the buffer reaches highWaterMark.' },
      { t: 'Transform: a step in the middle', d: 'Takes chunks in, pushes changed chunks out: gzip, CSV parsing, upper-casing. It is both writable and readable.' },
      { t: 'pipeline joins them safely', d: 'It wires the streams together, respects backpressure at every hop, and destroys all of them if any one fails.', code: "const { pipeline } = require('node:stream/promises');\nconst zlib = require('node:zlib');\nawait pipeline(fs.createReadStream('big.log'), zlib.createGzip(), fs.createWriteStream('big.log.gz'));" }
    ],
    terms: [
      ['chunk', 'One piece of data in a stream: a Buffer, a string, or any value in object mode.'],
      ['highWaterMark', 'The buffer size (bytes, or objects in object mode) at which a stream says “full”. A threshold, not a hard limit.'],
      ['backpressure', 'The “slow down” signal from a full buffer back to whoever is feeding it.'],
      ['\'drain\'', 'The event a Writable emits when a full buffer has emptied, so writing can resume.'],
      ['object mode', 'A stream that carries JS values instead of bytes. highWaterMark then counts items.'],
      ['flowing / paused', 'A Readable either pushes data at you (\'data\' events) or waits for you to <code>read()</code>.']
    ]
  },
  visual: {
    title: 'Fill a buffer to highWaterMark, then watch it drain',
    caption: 'Pick a mode and press Play or Step. Each square is a 16 KiB chunk; the dashed line is the 64 KiB highWaterMark. <b>Respect false</b> stops at the line and waits for <code>\'drain\'</code>. <b>Ignore false</b> keeps writing and the heap grows. <b>pipeline()</b> shows the pressure travelling upstream until the file read itself pauses.'
  },
  gotchas: [
    { trap: 'Ignoring the return value of write()', code: `for (const row of rows) {\n  res.write(toCsv(row));   // returns false after ~64 KiB… and we keep going\n}\nres.end();`, why: '<code>write()</code> never refuses a chunk. Past highWaterMark it just buffers it in memory and returns <code>false</code>. With a fast loop and a slow client, the whole result set ends up in your heap.', fix: 'Use <code>pipeline(Readable.from(rows), toCsvTransform, res)</code>. If you must write by hand: <code>if (!res.write(chunk)) await once(res, \'drain\')</code>.' },
    { trap: 'Using .pipe() and expecting errors to propagate', code: `fs.createReadStream(path).pipe(gzip).pipe(res);\n// a read error or a client abort: no cleanup, the fd stays open`, why: '<code>.pipe()</code> handles backpressure but not errors. An error on one stream is not forwarded, and the other streams are not destroyed. An error with no listener also crashes the process.', fix: 'Use <code>stream.pipeline()</code> (callback) or <code>require(\'node:stream/promises\').pipeline</code>. It destroys every stream on error or premature close and reports one error.' },
    { trap: 'An async \'data\' handler has no backpressure', code: `readable.on('data', async (row) => {\n  await db.insert(row);   // 'data' doesn't wait for this\n});`, why: 'The stream emits the next chunk as soon as your handler <i>returns</i>, and an async function returns at its first <code>await</code>. Thousands of inserts start at once and the pool is exhausted.', fix: 'Use <code>for await (const row of readable) { await db.insert(row); }</code>. The loop only pulls the next chunk after the body finishes.' },
    { trap: 'Forgetting that object mode counts items, not bytes', code: `new Transform({ objectMode: true, highWaterMark: 16, … })\n// 16 rows, whether each row is 50 bytes or 5 MB`, why: 'In object mode the buffer limit is a <b>count</b>. Sixteen 5 MB objects is 80 MB per buffer, and a pipeline has one buffer on each side of every Transform.', fix: 'Pick a small highWaterMark for big objects, or batch rows into arrays deliberately and size the batch.' },
    { trap: 'Mixing consumption styles on one Readable', why: 'A <code>\'data\'</code> listener switches the stream to flowing mode; <code>for await</code> uses <code>\'readable\'</code> and <code>read()</code>. Using both, or calling <code>.pipe()</code> as well, makes chunks go to one consumer and not the other.', fix: 'Pick one consumer per stream. To send the same data to two places, use two pipelines from a <code>PassThrough</code> per target, and accept that the slowest one sets the pace.' },
    { trap: 'Confusing \'end\', \'finish\' and \'close\'', why: 'A Readable emits <code>\'end\'</code> when it has no more data. A Writable emits <code>\'finish\'</code> after <code>end()</code> once all data is flushed to the underlying layer. <code>\'close\'</code> means the resource is released, and it can come after an error with no <code>\'end\'</code> at all.', fix: 'Use <code>await finished(stream)</code> from <code>node:stream/promises</code>. It resolves on success and rejects on error or premature close.' }
  ],
  scenarios: [
    { title: 'CSV export gets the pod OOM-killed',
      symptom: 'The <code>/export</code> endpoint works for internal users. When a partner downloads 3 M rows over a slow link, memory rises to the container limit and Kubernetes kills the pod (exit code 137).',
      diagnose: `// heap snapshot during the export: one huge array of Buffers\n// retained by: res → _writableState → buffered\nconsole.log(res.writableLength, res.writableNeedDrain);\n// 1.9e9 true`,
      cause: 'The handler loops over a DB cursor and calls <code>res.write()</code> for each row without checking the result. The database is fast and the client is slow, so the rows pile up in the response’s write buffer.',
      fix: 'Turn the cursor into a Readable and use <code>pipeline</code>. Backpressure then reaches the cursor: when the socket is full, the pipeline stops reading rows.',
      fixCode: `import { pipeline } from 'node:stream/promises';\nimport { Readable, Transform } from 'node:stream';\n\napp.get('/export', async (req, res) => {\n  res.setHeader('content-type', 'text/csv');\n  const rows = Readable.from(db.cursor('SELECT * FROM orders'));   // async iterable\n  const toCsv = new Transform({\n    writableObjectMode: true,\n    transform(row, _enc, cb) { cb(null, csvLine(row)); }\n  });\n  await pipeline(rows, toCsv, res);   // stops pulling rows while res is full\n});`, lang: 'ts' },
    { title: 'File descriptors run out after a few days',
      symptom: 'After some days the service fails with <code>EMFILE: too many open files</code>. <code>ls /proc/&lt;pid&gt;/fd | wc -l</code> grows steadily.',
      diagnose: `// the download route\nfs.createReadStream(file).pipe(res);\n// lsof shows thousands of handles on files under /data/reports`,
      cause: 'When a client aborts a download, <code>res</code> is destroyed but <code>.pipe()</code> doesn’t destroy the source. Each abandoned download leaves an open file descriptor.',
      fix: 'Use <code>pipeline</code>, which destroys the file stream when the response closes early, and log the error unless it is <code>ERR_STREAM_PREMATURE_CLOSE</code>.',
      fixCode: `import { pipeline } from 'node:stream';\n\npipeline(fs.createReadStream(file), res, (err) => {\n  if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') log.error(err);\n});`, lang: 'ts' },
    { title: 'An import job exhausts the connection pool',
      symptom: 'A nightly NDJSON import throws <code>timeout acquiring a connection</code> within seconds. The pool has 10 connections, and the database shows them all busy.',
      diagnose: `rl.on('line', async (line) => {\n  await repo.insert(JSON.parse(line));\n});\n// pool.waitingCount: 48 000`,
      cause: 'The <code>\'line\'</code> event doesn’t wait for the async handler. Every line of the file becomes a pending insert at once.',
      fix: 'Pull lines with <code>for await</code> and insert in batches. The file is read only as fast as the inserts complete.',
      fixCode: `import readline from 'node:readline';\n\nconst rl = readline.createInterface({ input: fs.createReadStream(path), crlfDelay: Infinity });\nlet batch: Row[] = [];\nfor await (const line of rl) {\n  batch.push(JSON.parse(line));\n  if (batch.length === 500) { await repo.insertMany(batch); batch = []; }\n}\nif (batch.length) await repo.insertMany(batch);`, lang: 'ts' }
  ],
  puzzles: [
    { kind: 'predict', q: 'A Writable with <code>highWaterMark: 3</code> (bytes) whose sink completes each write asynchronously. What prints?', code: `const { Writable } = require('stream');\nconst w = new Writable({\n  highWaterMark: 3,\n  write(chunk, enc, cb) { setImmediate(cb); }\n});\nconsole.log(w.write('a'));\nconsole.log(w.write('b'));\nconsole.log(w.write('c'));\nconsole.log(w.write('d'));\nw.on('drain', () => console.log('drain'));`, options: ['true, true, true, false, drain', 'true, true, false, false, drain', 'true, true, false, then write(\'d\') throws', 'true, true, false, false (no drain)'], answer: 1, explain: 'After each write Node checks <code>buffered length &lt; highWaterMark</code>. After \'c\' the length is 3, which is not below 3, so it returns false. \'d\' is still accepted (length 4) and also returns false. Once the buffer empties, <code>\'drain\'</code> fires once.', run: true, expect: 'true\ntrue\nfalse\nfalse\ndrain' },
    { kind: 'predict', q: 'Adding a <code>\'data\'</code> listener to a Readable that already has data. What prints?', code: `const { Readable } = require('stream');\nconst r = new Readable({ read() {} });\nr.push('a');\nr.push('b');\nr.push(null);\nr.on('data', (c) => console.log('data', c.toString()));\nr.on('end', () => console.log('end'));\nconsole.log('sync done');`, options: ['data a, data b, end, sync done', 'sync done, data a, data b, end', 'sync done, data ab, end', 'data a, data b, sync done, end'], answer: 1, explain: 'A <code>\'data\'</code> listener calls <code>resume()</code>, but flowing starts on a later tick, so the synchronous log comes first. In flowing mode each buffered chunk is emitted separately, then <code>\'end\'</code>.', run: true, expect: 'sync done\ndata a\ndata b\nend' },
    { kind: 'predict', q: 'Breaking out of <code>for await</code> over a Readable. What prints?', code: `const { Readable } = require('stream');\nconst r = Readable.from(['x', 'y', 'z']);\nr.on('close', () => console.log('closed'));\n(async () => {\n  for await (const c of r) {\n    console.log(c);\n    if (c === 'y') break;\n  }\n  console.log('after loop', r.destroyed);\n})();`, options: ['x, y, after loop false', 'x, y, after loop true, closed', 'x, y, z, after loop true, closed', 'x, y, closed, after loop false'], answer: 1, explain: '<code>break</code> calls the iterator’s <code>return()</code>, which <b>destroys</b> the stream (the default; <code>r.iterator({ destroyOnReturn: false })</code> opts out). <code>destroyed</code> is set at once; the <code>\'close\'</code> event is emitted on a later tick.', run: true, expect: 'x\ny\nafter loop true\nclosed' },
    { kind: 'predict', q: 'A Transform with a <code>flush</code>, in a promise pipeline whose last step is an async function. What prints?', code: `const { Transform, Readable } = require('stream');\nconst { pipeline } = require('stream/promises');\nconst upper = new Transform({\n  transform(chunk, enc, cb) { cb(null, chunk.toString().toUpperCase()); },\n  flush(cb) { this.push('!'); cb(); }\n});\n(async () => {\n  let out = '';\n  await pipeline(Readable.from(['he', 'llo']), upper, async function (source) {\n    for await (const c of source) out += c;\n  });\n  console.log(out);\n})();`, options: ['HELLO', 'HELLO!', 'hello!', '!HELLO'], answer: 1, explain: '<code>flush</code> runs once after the writable side has ended and the last chunk is transformed, so it can emit trailing data (a footer, a final partial line). An async function is a valid last stage of <code>pipeline</code>: it receives the previous stream as an async iterable.', run: true, expect: 'HELLO!' },
    { kind: 'predict', q: 'One step of a <code>pipeline</code> fails. What prints?', code: `const { pipeline, Readable, Transform, Writable } = require('stream');\nconst src = Readable.from(['a', 'b', 'c']);\nconst t = new Transform({\n  objectMode: true,\n  transform(chunk, enc, cb) {\n    if (chunk === 'b') return cb(new Error('bad b'));\n    cb(null, chunk.toUpperCase());\n  }\n});\nconst sink = new Writable({ objectMode: true, write(c, e, cb) { cb(); } });\npipeline(src, t, sink, (err) => {\n  console.log(err ? err.message : 'ok');\n  console.log(src.destroyed, sink.destroyed);\n});`, options: ['bad b, then false false', 'bad b, then true true', 'ok, then true true', 'The process crashes with an unhandled \'error\''], answer: 1, explain: '<code>pipeline</code> attaches error handlers to every stream, so nothing crashes. On the first error it destroys <b>all</b> the streams and calls the callback once with that error. With <code>.pipe()</code> the source and sink would stay open.', run: true, expect: 'bad b\ntrue true' },
    { kind: 'concept', q: '<code>res.write(chunk)</code> just returned <code>false</code>. What happened to <code>chunk</code>?', options: ['It was dropped; you must write it again after \'drain\'', 'It was buffered; you should stop writing until \'drain\'', 'It is retried automatically after a timeout', 'An error is emitted on the stream'], answer: 1, explain: '<code>false</code> is advice, not refusal. The chunk is in the buffer. Writing again later would send it twice. The only thing the false means is: the buffer is at or above highWaterMark, so wait.' },
    { kind: 'concept', q: 'What is the default highWaterMark of a new byte-mode <code>Writable</code> in Node 22?', options: ['16 bytes', '16 KiB', '64 KiB', 'Unlimited'], answer: 2, explain: 'Node 22 raised the default from 16 KiB to 64 KiB. Object-mode streams still default to 16 items. You can read or set it with <code>stream.getDefaultHighWaterMark()</code> / <code>setDefaultHighWaterMark()</code>. (<code>fs.createReadStream</code> has used 64 KiB for a long time.)' },
    { kind: 'concept', q: 'You need to process each line of a 10 GB file and <code>await</code> an HTTP call per line, keeping memory flat. Which consumer gives you backpressure for free?', options: ['<code>rl.on(\'line\', async (l) => { await call(l) })</code>', '<code>for await (const l of rl) { await call(l) }</code>', '<code>fs.readFile</code> then split on <code>\\n</code>', '<code>stream.on(\'data\')</code> with <code>setImmediate</code>'], answer: 1, explain: 'Async iteration pulls the next item only when the loop body finishes, so reading slows to the speed of your calls. Event handlers don’t wait for promises. <code>readFile</code> loads all 10 GB (and fails: a string can’t be that long).' }
  ],
  interview: [
    { q: 'What is backpressure, and how does Node implement it?', a: '<p>Backpressure is a slow consumer telling a fast producer to wait. In Node, each stream has a buffer and a <b>highWaterMark</b>. <code>writable.write()</code> returns <code>false</code> when the buffer reaches it; the producer should stop until <code>\'drain\'</code>. On the read side, <code>push()</code> returns <code>false</code> and Node stops calling <code>_read()</code> until the consumer takes data. <code>pipe</code>, <code>pipeline</code> and async iteration wire these two signals together.</p>', lvl: 'core' },
    { q: 'Explain the four stream types.', a: '<ul><li><b>Readable</b>: a source (<code>fs.createReadStream</code>, <code>req</code>, <code>process.stdin</code>).</li><li><b>Writable</b>: a sink (<code>res</code>, <code>fs.createWriteStream</code>).</li><li><b>Duplex</b>: both, independent sides (a TCP socket).</li><li><b>Transform</b>: a Duplex whose output is computed from its input (<code>zlib.createGzip()</code>, a CSV parser).</li></ul>', lvl: 'core' },
    { q: 'pipe() vs pipeline(): what is the difference?', a: '<p>Both handle backpressure. <code>.pipe()</code> doesn’t forward errors and doesn’t destroy the other streams when one fails or closes early, so you leak file descriptors and sockets and may crash on an unhandled <code>\'error\'</code>. <code>pipeline()</code> destroys every stream on error or premature close and gives you one callback or promise. It also accepts async generator functions as stages.</p>', fu: 'How do you cancel a pipeline? (Pass <code>{ signal }</code> from an AbortController to the promise version.)', lvl: 'core' },
    { q: 'What exactly does highWaterMark limit?', a: '<p>Nothing, strictly. It is a threshold for the <i>signal</i>. A Writable keeps accepting chunks beyond it; a Readable’s <code>push()</code> keeps buffering. It is measured in bytes for byte streams (default 64 KiB in Node 22) and in items for object mode (default 16). A single chunk larger than the mark is accepted whole.</p>', lvl: 'deep' },
    { q: 'Flowing vs paused mode for a Readable?', a: '<p>Paused (the start state): data sits in the buffer until you call <code>read()</code>, usually inside a <code>\'readable\'</code> handler. Flowing: Node emits <code>\'data\'</code> as fast as it can. Adding a <code>\'data\'</code> listener, calling <code>resume()</code> or <code>pipe()</code> switches to flowing; <code>pause()</code> or removing pipe destinations switches back. Async iteration uses the paused, pull-based style.</p>', lvl: 'deep' },
    { q: 'How would you write a Transform today?', a: '<p>Often as an async generator in a pipeline:</p><pre>await pipeline(src, async function* (source) {\n  for await (const chunk of source) yield transform(chunk);\n}, dest);</pre><p>Or subclass/construct a <code>Transform</code> with <code>transform(chunk, enc, cb)</code> and an optional <code>flush(cb)</code> for trailing output. Use <code>readableObjectMode</code>/<code>writableObjectMode</code> when one side carries objects and the other bytes.</p>', lvl: 'core' },
    { q: 'Why does an async \'data\' handler break backpressure?', a: '<p>Event emitters don’t await listeners. The stream emits the next <code>\'data\'</code> as soon as your function returns, which for an async function is at its first <code>await</code>. Work piles up as unresolved promises. Use <code>for await</code>, or <code>pause()</code> before the await and <code>resume()</code> after.</p>', lvl: 'core' },
    { q: 'What happens when you break out of for await over a stream?', a: '<p>The iterator’s <code>return()</code> runs and, by default, destroys the stream, which releases the file descriptor or socket. Use <code>stream.iterator({ destroyOnReturn: false })</code> if you want to keep reading later. An error thrown in the loop body also destroys the stream.</p>', lvl: 'deep' },
    { q: 'How do Node streams relate to Web Streams?', a: '<p>Node also ships the WHATWG <code>ReadableStream</code>/<code>WritableStream</code>/<code>TransformStream</code> (global since Node 18) used by <code>fetch</code>. Their backpressure is promise-based (<code>desiredSize</code>, <code>ready</code>). <code>Readable.fromWeb()</code> / <code>Readable.toWeb()</code> convert between the two. Most Node APIs and libraries still speak Node streams.</p>', lvl: 'deep' },
    { q: 'Compare Node streams with Java’s approach.', a: '<p><code>InputStream</code>/<code>OutputStream</code> get backpressure for free by <b>blocking</b> the thread: <code>write()</code> doesn’t return until the socket buffer has room. Node can’t block its one thread, so it uses a return value and an event instead. Reactive Streams (Reactor, RxJava) are the closer match: the consumer says <code>request(n)</code>, which is a pull model like async iteration.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Stream a query to HTTP with pipeline', lang: 'ts', code: `import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import type { ServerResponse } from 'node:http';

// an async generator is a valid pipeline stage: backpressure included
async function* toNdjson(rows: AsyncIterable<Order>) {
  for await (const row of rows) yield JSON.stringify(row) + '\\n';
}

export async function exportOrders(res: ServerResponse, signal: AbortSignal) {
  res.setHeader('content-type', 'application/x-ndjson');
  res.setHeader('content-encoding', 'gzip');
  await pipeline(
    db.streamOrders(),        // AsyncIterable<Order> from a server-side cursor
    toNdjson,
    createGzip(),
    res,
    { signal }                // client gone or shutdown → everything is destroyed
  );
}`, note: 'If the client reads slowly, gzip’s buffer fills, the generator is suspended at <code>yield</code>, and the cursor stops fetching.' },
    { title: 'Respecting write() by hand', lang: 'ts', code: `import { once } from 'node:events';
import type { Writable } from 'node:stream';

export async function writeAll(out: Writable, chunks: Iterable<string>) {
  for (const chunk of chunks) {
    if (!out.write(chunk)) {
      await once(out, 'drain');     // buffer reached highWaterMark: wait
    }
  }
  out.end();
  // await finished(out) from node:stream/promises to wait for 'finish' or an error
}`, note: '<code>once()</code> also rejects if the stream emits <code>\'error\'</code> while you wait.' },
    { title: 'Java comparison: blocking I/O and Reactor', lang: 'java', code: `// Blocking: write() simply waits when the socket buffer is full.
try (InputStream in = Files.newInputStream(path);
     OutputStream out = response.getOutputStream()) {
    in.transferTo(out);                       // backpressure = a parked thread
}

// Reactive (WebFlux): the subscriber pulls with request(n).
Flux<DataBuffer> body = DataBufferUtils.read(path, bufferFactory, 64 * 1024);
return ServerResponse.ok().body(BodyInserters.fromDataBuffers(body));
// Netty only requests more buffers once it has flushed the previous ones.`, note: 'Node’s <code>write() → false → \'drain\'</code> is the event-loop version of a thread blocking in <code>OutputStream.write</code>.' }
  ]
});
