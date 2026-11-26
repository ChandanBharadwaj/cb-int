IA.register({
  track: 'spring',
  slug: 'spring-rest-basics',
  title: 'REST controller basics',
  tagline: 'A <code>@RestController</code> method maps an HTTP method + path to Java. Spring pulls values out of the <b>path</b>, <b>query string</b> and <b>JSON body</b>, calls your method, and Jackson turns the return value back into JSON with a <b>status code</b>.',
  tldr: {
    problem: 'Hand-parsing URLs and JSON is tedious and error-prone. Getting status codes wrong (200 for “not found”) confuses every client.',
    model: '<code>request → DispatcherServlet → matching @XxxMapping → bind @PathVariable / @RequestParam / @RequestBody → your method → Jackson → response</code>.',
    hook: '“@Controller vs @RestController?” <code>@RestController</code> = <code>@Controller</code> + <code>@ResponseBody</code>: return values are written as the body (JSON), not resolved as view names.',
    facts: [
      { v: '200', l: 'default status of a handler method that returns normally' },
      { v: '400', l: 'what Spring returns when a path variable or param cannot be converted, or a required param is missing' },
      { v: 'Jackson', l: 'the JSON library <code>spring-boot-starter-web</code> brings and auto-configures' }
    ]
  },
  intro: {
    what: 'A <b>REST API</b> lets other programs work with your data over HTTP. A URL names a thing (<code>/books/42</code>), the HTTP method says what to do (<b>GET</b> read, <b>POST</b> create, <b>PUT</b> replace, <b>DELETE</b> remove), and data travels as <b>JSON</b>. In Spring you write one Java method per operation and annotate it.',
    analogy: { icon: '📮', title: 'A post-office counter', text: 'The address on the envelope (path) says which counter. The form type (GET, POST) says what you want done. Notes on the envelope (query params) adjust it. The letter inside (JSON body) carries the details. The clerk stamps a reply code on the way back: 200 done, 201 created, 404 nobody by that name, 400 your form is filled in wrong.' },
    steps: [
      { t: 'Make a controller', d: 'Mark the class and give it a base path.', code: '@RestController\n@RequestMapping("/books")\nclass BookController { … }' },
      { t: 'Read with GET + path variable', d: 'Part of the path becomes a parameter.', code: '@GetMapping("/{id}")\nBook one(@PathVariable Long id) { … }      // GET /books/42' },
      { t: 'Filter with query params', d: 'Things after <code>?</code> in the URL.', code: '@GetMapping\nList<Book> search(@RequestParam(defaultValue = "") String q,\n                  @RequestParam(defaultValue = "0") int page) { … }  // GET /books?q=dune&page=1' },
      { t: 'Create with POST + JSON body', d: 'Jackson reads the body into a record.', code: 'record NewBook(String title, int year) {}\n\n@PostMapping\nResponseEntity<Book> create(@RequestBody NewBook body) { … }' },
      { t: 'Pick the right status', d: '<b>200</b> OK, <b>201</b> Created, <b>204</b> No Content, <b>400</b> bad input, <b>404</b> not found, <b>500</b> server bug. Use <code>ResponseEntity</code> or <code>@ResponseStatus</code>.' }
    ],
    terms: [
      ['endpoint', 'One HTTP method + path your API answers, e.g. <code>GET /books/{id}</code>.'],
      ['path variable', 'A value inside the path: the <code>42</code> in <code>/books/42</code>.'],
      ['query parameter', 'A key=value after <code>?</code>: <code>?q=dune&amp;page=1</code>.'],
      ['request body', 'Data sent with POST/PUT, usually JSON.'],
      ['Jackson', 'Library that converts Java objects to JSON and back.'],
      ['status code', 'Three-digit result of an HTTP call: 2xx success, 4xx client error, 5xx server error.']
    ]
  },
  visual: {
    title: 'Follow a request through Spring MVC',
    caption: 'Pick <b>GET with params</b>, <b>POST JSON</b>, <b>Not found → 404</b> or <b>Bad input → 400</b>, then Play or Step. The log shows the raw HTTP exchange.'
  },
  gotchas: [
    { trap: 'Returning <code>null</code> for “not found”', code: '@GetMapping("/{id}")\nBook one(@PathVariable Long id) { return repo.findById(id).orElse(null); }  // 200 + empty body', why: 'The client gets 200 OK with no body and cannot tell “missing” from “broken”.', fix: 'Throw <code>new ResponseStatusException(HttpStatus.NOT_FOUND)</code> or return <code>ResponseEntity.notFound().build()</code>.' },
    { trap: 'Forgetting <code>@RequestBody</code>', code: '@PostMapping\nBook create(NewBook body) { … }   // fields all null / 0', why: 'Without it, Spring binds the parameter from query/form parameters, not from the JSON body.', fix: 'Annotate the parameter: <code>@RequestBody NewBook body</code>, and send <code>Content-Type: application/json</code>.' },
    { trap: 'Using <code>@Controller</code> for a JSON API', why: 'A plain <code>@Controller</code> treats a returned <code>String</code> as a <b>view name</b> and looks for a template; you get an error instead of your text.', fix: 'Use <code>@RestController</code>, or add <code>@ResponseBody</code> to the method.' },
    { trap: 'Required query param missing → 400', code: '@GetMapping List<Book> search(@RequestParam String q)   // GET /books → 400', why: '<code>@RequestParam</code> is required by default.', fix: 'Add <code>defaultValue = "…"</code>, <code>required = false</code>, or use <code>Optional&lt;String&gt;</code>.' },
    { trap: 'Parameter names not available', why: '<code>@PathVariable Long id</code> relies on the compiler keeping parameter names. Boot’s Maven/Gradle plugins configure <code>-parameters</code>; a hand-made build may not, and Spring 6.1+ no longer guesses from debug info.', fix: 'Keep the Boot build plugin defaults, or name it explicitly: <code>@PathVariable("id") Long id</code>.' },
    { trap: 'Verbs in URLs', code: 'POST /createBook   GET /getBook?id=42', lang: 'text', why: 'The HTTP method already is the verb; mixing styles makes the API hard to guess.', fix: 'Nouns for resources, methods for actions: <code>POST /books</code>, <code>GET /books/42</code>.' }
  ],
  scenarios: [
    { title: 'Mobile app crashes on a “successful” lookup', symptom: 'The client parses an empty body after a 200 and crashes for deleted books.', diagnose: 'Access logs show <code>GET /books/913 → 200</code> with content length 0.', cause: 'The handler returned <code>null</code> from <code>orElse(null)</code>; Spring wrote 200 with no body.', fix: 'Return 404 for missing resources.', fixCode: '@GetMapping("/{id}")\nBook one(@PathVariable Long id) {\n  return repo.findById(id)\n      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "book " + id));\n}' },
    { title: 'Every POST creates an empty record', symptom: 'New rows appear with title NULL and year 0.', diagnose: 'Request is correct JSON; debugger shows the parameter object has default values.', cause: 'The <code>@RequestBody</code> annotation was lost in a refactor, so Spring bound from (absent) query params.', fix: 'Restore <code>@RequestBody</code> and add validation so empty input is rejected with 400.', fixCode: 'record NewBook(@NotBlank String title, @Min(0) int year) {}\n\n@PostMapping\nResponseEntity<Book> create(@Valid @RequestBody NewBook body) { … }' }
  ],
  puzzles: [
    { kind: 'concept', q: '<code>GET /books/42?lang=en</code>. Which annotations read 42 and en?', options: ['@RequestBody for both', '@PathVariable for 42, @RequestParam for en', '@RequestParam for 42, @PathVariable for en', '@RequestHeader for both'], answer: 1, explain: 'Path segments come from <code>@PathVariable</code> (matching <code>{id}</code>); query-string values come from <code>@RequestParam</code>.' },
    { kind: 'predict', q: 'What status does the client get?', code: '@GetMapping("/books/{id}")\nBook one(@PathVariable Long id) { … }\n\n// request: GET /books/abc', options: ['200', '404', '400', '500'], answer: 2, explain: '"abc" cannot be converted to <code>Long</code>; Spring rejects the request with 400 Bad Request before your method runs.' },
    { kind: 'concept', q: 'Best status for a successful <code>POST /books</code> that created a book?', options: ['200 OK', '201 Created (with a Location header)', '202 Accepted', '204 No Content'], answer: 1, explain: '201 signals a new resource; <code>ResponseEntity.created(uri)</code> also sets the <code>Location</code> header.' },
    { kind: 'concept', q: 'What converts your returned <code>Book</code> record into JSON?', options: ['Tomcat', 'Jackson, via Spring’s HTTP message converters', 'Hibernate', 'The browser'], answer: 1, explain: 'Spring MVC picks an <code>HttpMessageConverter</code>; for JSON that is the Jackson-based one, auto-configured by Boot.' },
    { kind: 'predict', q: 'A <code>@Controller</code> (not Rest) method returns <code>"hello"</code> with no <code>@ResponseBody</code>. What does Spring try to do?', options: ['Write "hello" as the body', 'Render a view/template named "hello"', 'Return 204', 'Serialize "hello" to JSON'], answer: 1, explain: 'In a plain <code>@Controller</code>, a String return is a view name. Without a matching template you get an error.' },
    { kind: 'concept', q: 'Which HTTP method is meant to be safe (no changes) and idempotent?', options: ['POST', 'GET', 'PATCH', 'None'], answer: 1, explain: 'GET should only read. PUT and DELETE are idempotent but not safe; POST is neither.' },
    { kind: 'predict', q: '<code>@RequestParam int page</code> and the request has no <code>page</code>. Result?', options: ['page = 0', '400 Bad Request', 'NullPointerException → 500', 'page = null'], answer: 1, explain: 'A <code>@RequestParam</code> is required unless you set <code>required = false</code> or a <code>defaultValue</code>. Missing → 400.' }
  ],
  interview: [
    { q: '@Controller vs @RestController?', a: '<p><code>@RestController</code> is <code>@Controller</code> + <code>@ResponseBody</code> on every method: return values are serialized into the response body. <code>@Controller</code> is for server-rendered views (Thymeleaf), where a String is a view name.</p>', lvl: 'core' },
    { q: '@PathVariable vs @RequestParam?', a: '<p>Path variables identify a resource (<code>/books/42</code>). Request params filter, sort or page (<code>?q=dune&amp;page=1</code>). Params are required by default; give a default or mark optional.</p>', lvl: 'core' },
    { q: 'How does a JSON body become a Java object?', a: '<p><code>@RequestBody</code> tells Spring to read the body with an <code>HttpMessageConverter</code> chosen by <code>Content-Type</code>. For JSON that converter uses Jackson’s <code>ObjectMapper</code>. Records and classes with a no-arg constructor + setters both work.</p>', lvl: 'core' },
    { q: 'Which status codes should a CRUD API return?', a: '<ul><li>GET found → 200; missing → 404</li><li>POST created → 201 + Location</li><li>PUT/PATCH → 200 (with body) or 204</li><li>DELETE → 204</li><li>Bad input → 400; conflict → 409; unexpected error → 500</li></ul>', lvl: 'core' },
    { q: 'How do you set a status other than 200?', a: '<p>Return <code>ResponseEntity</code> (<code>ResponseEntity.status(201).body(x)</code>), annotate the method with <code>@ResponseStatus(HttpStatus.CREATED)</code>, or throw <code>ResponseStatusException</code> for errors.</p>', lvl: 'core' },
    { q: 'What is the DispatcherServlet?', a: '<p>Spring MVC’s front controller: one servlet that receives every request, finds the handler via handler mappings, resolves arguments, invokes the method and writes the result. Deep dive: <a href="mvc-request-flow.html">MVC request flow</a>.</p>', lvl: 'core' },
    { q: 'What makes an API “RESTful”?', a: '<p>Resources named by URLs (nouns), standard HTTP methods with their meanings, stateless requests, meaningful status codes, and representations like JSON. In practice most “REST” APIs follow these conventions loosely.</p>', lvl: 'core' },
    { q: 'How do you handle errors consistently across controllers?', a: '<p>A <code>@RestControllerAdvice</code> with <code>@ExceptionHandler</code> methods maps exceptions to responses. Boot 3 supports RFC 9457 <code>ProblemDetail</code> bodies. See <a href="errors-validation.html">Errors &amp; validation</a>.</p>', lvl: 'deep' },
    { q: 'Is PUT idempotent? Is POST?', a: '<p>PUT is idempotent: sending the same full replacement twice leaves the same state. POST is not: two calls usually create two resources. That is why retries on POST need idempotency keys.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'A small CRUD controller', lang: 'java', code: `@RestController
@RequestMapping("/books")
class BookController {
  private final BookRepository repo;
  BookController(BookRepository repo) { this.repo = repo; }

  record NewBook(String title, String author, int year) {}

  @GetMapping                                   // GET /books?author=Herbert
  List<Book> list(@RequestParam(required = false) String author) {
    return author == null ? repo.findAll() : repo.findByAuthor(author);
  }

  @GetMapping("/{id}")                          // GET /books/42
  Book one(@PathVariable Long id) {
    return repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
  }

  @PostMapping                                  // POST /books  {json}
  ResponseEntity<Book> create(@RequestBody NewBook b) {
    Book saved = repo.save(new Book(b.title(), b.author(), b.year()));
    return ResponseEntity.created(URI.create("/books/" + saved.getId())).body(saved);
  }

  @DeleteMapping("/{id}")                       // DELETE /books/42 → 204
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(@PathVariable Long id) { repo.deleteById(id); }
}`, note: 'For a real API, return DTOs rather than entities and add <code>@Valid</code> (see <a href="errors-validation.html">Errors &amp; validation</a>).' },
    { title: 'Try it with curl', lang: 'bash', code: `curl -i localhost:8080/books/1
curl -i "localhost:8080/books?author=Herbert"
curl -i -X POST localhost:8080/books \\
     -H 'Content-Type: application/json' \\
     -d '{"title":"Dune","author":"Herbert","year":1965}'
curl -i -X DELETE localhost:8080/books/1` }
  ]
});
