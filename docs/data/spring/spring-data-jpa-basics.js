IA.register({
  track: 'spring',
  slug: 'spring-data-jpa-basics',
  title: 'Data JPA basics',
  tagline: 'Mark a class <code>@Entity</code>, give it an <code>@Id</code>, declare <code>interface BookRepository extends JpaRepository&lt;Book, Long&gt;</code>, and you can save, find and delete rows without writing SQL. Method names like <code>findByAuthor</code> become queries.',
  tldr: {
    problem: 'Writing JDBC by hand for every table means pages of SQL strings, result-set loops and mapping code.',
    model: '<b>Entity</b> = a Java class mapped to a table. <b>Hibernate</b> (the JPA provider) turns object operations into SQL. <b>Spring Data</b> generates the repository implementation, including queries derived from method names.',
    hook: '“How does <code>findByEmail</code> work with no implementation?” Spring Data parses the method name at startup and builds a query; an unknown property in the name fails startup.',
    facts: [
      { v: 'JpaRepository', l: 'gives <code>save</code>, <code>findById</code>, <code>findAll</code>, <code>deleteById</code>, <code>count</code>, paging and sorting for free' },
      { v: 'create-drop', l: 'Boot’s default <code>ddl-auto</code> for an embedded DB (H2) when no Flyway/Liquibase is used; otherwise <code>none</code>' },
      { v: 'jakarta.persistence', l: 'package of <code>@Entity</code>, <code>@Id</code> in Boot 3 (was <code>javax.persistence</code>)' }
    ]
  },
  intro: {
    what: 'Your app stores books in a database table. <b>JPA</b> is the Java standard for mapping objects to tables, and <b>Hibernate</b> is the library that implements it. <b>Spring Data JPA</b> adds the easy part: you declare an interface, and Spring writes the code behind it. You add the <code>spring-boot-starter-data-jpa</code> starter plus a database driver (H2 to start, Postgres for real work).',
    analogy: { icon: '🗂️', title: 'A librarian with a card catalog', text: 'You hand the librarian (repository) a book and say “file this” (save). Later you ask “all books by Herbert” (findByAuthor). You never touch the shelves (tables) yourself. The librarian knows the shelving system (SQL) and converts your request into it.' },
    steps: [
      { t: 'Add dependencies', d: '<code>spring-boot-starter-data-jpa</code> + a driver: <code>com.h2database:h2</code> (in-memory, zero setup) or <code>org.postgresql:postgresql</code>.' },
      { t: 'Write an entity', d: 'One class = one table, one field = one column.', code: '@Entity\npublic class Book {\n  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)\n  private Long id;\n  private String title;\n  private String author;\n  protected Book() {}               // JPA needs a no-arg constructor\n  public Book(String title, String author) { this.title = title; this.author = author; }\n  // getters …\n}' },
      { t: 'Declare a repository', d: 'Interface only. Type params: entity and id type.', code: 'public interface BookRepository extends JpaRepository<Book, Long> {\n  List<Book> findByAuthor(String author);\n  List<Book> findByTitleContainingIgnoreCase(String part);\n  Optional<Book> findFirstByOrderByIdDesc();\n}' },
      { t: 'Use it from a service', d: 'Inject it like any bean.', code: 'Book saved = books.save(new Book("Dune", "Herbert"));\nList<Book> herbert = books.findByAuthor("Herbert");' },
      { t: 'Point at a database', d: 'H2 needs nothing. For Postgres set the URL; let a migration tool create tables.', code: 'spring.datasource.url=jdbc:postgresql://localhost:5432/library\nspring.datasource.username=app\nspring.datasource.password=${DB_PASSWORD}\nspring.jpa.hibernate.ddl-auto=validate', lang: 'text' }
    ],
    terms: [
      ['JPA', 'Jakarta Persistence API: the standard annotations and interfaces for object–relational mapping.'],
      ['Hibernate', 'The JPA implementation Boot uses by default.'],
      ['entity', 'A class annotated <code>@Entity</code>, mapped to a table.'],
      ['primary key / @Id', 'The column that uniquely identifies each row.'],
      ['derived query', 'A repository method whose query is generated from its name.'],
      ['ddl-auto', 'Whether Hibernate creates/updates/validates the schema from your entities.']
    ]
  },
  visual: {
    title: 'From a method name to SQL',
    caption: 'Choose <b>Derived query</b>, <b>save()</b> or <b>ddl-auto: H2 vs Postgres</b>, then Play or Step. The log shows the SQL Hibernate would send.'
  },
  gotchas: [
    { trap: '<code>ddl-auto=create</code> or <code>create-drop</code> against a real database', why: 'Hibernate drops and recreates tables at startup: all data is gone.', fix: 'For Postgres use Flyway or Liquibase for schema changes and <code>ddl-auto=validate</code> (or <code>none</code>).' },
    { trap: 'Typo in a derived query name', code: 'List<Book> findByAuther(String a);\n// startup: No property \'auther\' found for type \'Book\'', why: 'The name is parsed against entity <b>property</b> names (fields), not column names.', fix: 'Match the Java field name exactly. Good news: it fails at startup, not in production traffic.' },
    { trap: 'No no-arg constructor or no <code>@Id</code>', why: 'JPA instantiates entities reflectively and needs an identifier. Missing either fails startup.', fix: 'Add a <code>protected</code> no-arg constructor and an <code>@Id</code> field. Java records cannot be entities (they are fine as DTOs and projections).' },
    { trap: 'Ignoring the value returned by <code>save</code>', code: 'repo.save(book);\nreturn book.getId();   // may be fine… or not', why: 'For a new entity Hibernate usually fills the id in place, but for a detached entity <code>save</code> merges and returns a <b>different</b> instance.', fix: 'Always use the returned object: <code>book = repo.save(book);</code>' },
    { trap: 'H2 passes, Postgres fails', why: 'H2 is a different database: SQL dialect, types, case rules and constraint behaviour differ. Native queries are the usual victims.', fix: 'Run integration tests against real Postgres with Testcontainers. See <a href="boot-testing.html">Testing Boot apps</a>.' },
    { trap: 'Very long derived method names', code: 'findByAuthorAndYearGreaterThanAndTitleContainingIgnoreCaseOrderByYearDesc(…)', why: 'Hard to read and review.', fix: 'Switch to <code>@Query("select b from Book b where …")</code> once a name stops being obvious.' }
  ],
  scenarios: [
    { title: 'All data gone after a restart', symptom: 'A staging database is empty after every deploy.', diagnose: 'Startup log shows <code>drop table if exists book cascade</code>, then <code>create table book …</code>.', cause: '<code>spring.jpa.hibernate.ddl-auto=create</code> was copied from a tutorial into the shared config.', fix: 'Manage the schema with migrations; let Hibernate only validate.', fixCode: '# application.properties\nspring.jpa.hibernate.ddl-auto=validate\n# src/main/resources/db/migration/V1__create_book.sql (Flyway)\n# create table book (id bigserial primary key, title text not null, author text not null);', lang: 'text' },
    { title: 'App will not start after renaming a field', symptom: 'Startup fails: “No property \'writer\' found for type \'Book\'” after renaming <code>writer</code> to <code>author</code>.', diagnose: 'The repository still declares <code>findByWriter(String w)</code>.', cause: 'Derived queries are bound to entity property names and are checked at startup.', fix: 'Rename the method too (IDEs with Spring Data support do it for you).', fixCode: 'List<Book> findByAuthor(String author);' }
  ],
  puzzles: [
    { kind: 'concept', q: 'What do you have to write for <code>findByAuthor</code> to work?', code: 'interface BookRepository extends JpaRepository<Book, Long> {\n  List<Book> findByAuthor(String author);\n}', options: ['A class implementing BookRepository', 'An @Query annotation', 'Nothing more: Spring Data derives the query from the name', 'A SQL file named findByAuthor.sql'], answer: 2, explain: 'Spring Data creates the implementation at startup and derives <code>where b.author = ?1</code> from the name.' },
    { kind: 'concept', q: 'In <code>JpaRepository&lt;Book, Long&gt;</code>, what is <code>Long</code>?', options: ['The number of rows', 'The type of the entity’s @Id', 'The table name', 'The version column'], answer: 1, explain: 'The second type parameter is the id type, used by <code>findById(Long)</code>, <code>deleteById(Long)</code>.' },
    { kind: 'predict', q: 'New <code>Book</code> with <code>id == null</code>, <code>@GeneratedValue(strategy = IDENTITY)</code>. What does <code>repo.save(book)</code> do?', options: ['UPDATE book … where id = null', 'INSERT; the returned entity has the generated id', 'Throws: id required', 'Nothing until the app shuts down'], answer: 1, explain: 'A null id means “new”, so Spring Data calls <code>persist</code>; with IDENTITY the INSERT runs and the database assigns the id.' },
    { kind: 'concept', q: 'Recommended <code>ddl-auto</code> for a production Postgres with Flyway?', options: ['create', 'create-drop', 'update', 'validate (or none)'], answer: 3, explain: 'Flyway owns the schema; Hibernate just checks that entities match it (validate) or does nothing (none).' },
    { kind: 'concept', q: 'You add H2 and the JPA starter with no datasource properties. What happens?', options: ['Startup fails: no URL', 'Boot configures an in-memory H2 database and creates tables (create-drop)', 'Boot connects to localhost Postgres', 'JPA is disabled'], answer: 1, explain: 'With an embedded database on the classpath and no URL, Boot auto-configures it. With no migration tool, ddl-auto defaults to create-drop.' },
    { kind: 'predict', q: 'Which query does this method name produce?', code: 'List<Book> findByYearGreaterThanOrderByTitleAsc(int year);', options: ['where year > ?1 order by title asc', 'where year >= ?1 order by title', 'where year > ?1 order by year', 'Startup error: too many keywords'], answer: 0, explain: '<code>GreaterThan</code> is strict (&gt;); <code>GreaterThanEqual</code> would be &gt;=. <code>OrderByTitleAsc</code> adds the sort.' },
    { kind: 'concept', q: 'What does <code>findById</code> return?', options: ['Book or null', 'Optional&lt;Book&gt;', 'List&lt;Book&gt;', 'It throws if missing'], answer: 1, explain: 'An <code>Optional</code>, so you decide: <code>orElseThrow</code> (→ 404 in a controller) or a default.' }
  ],
  interview: [
    { q: 'JPA vs Hibernate vs Spring Data JPA?', a: '<ul><li><b>JPA</b>: the specification (annotations, <code>EntityManager</code>).</li><li><b>Hibernate</b>: an implementation of JPA that generates SQL.</li><li><b>Spring Data JPA</b>: repository abstraction on top, generating DAO code and queries.</li></ul>', lvl: 'core' },
    { q: 'What is required for a class to be an entity?', a: '<p><code>@Entity</code>, an <code>@Id</code>, a no-arg constructor (public or protected), and it must not be final in ways that prevent proxying (Hibernate proxies lazy entities). Records cannot be entities.</p>', lvl: 'core' },
    { q: 'How do derived queries work?', a: '<p>At startup Spring Data parses names like <code>findByAuthorAndYear</code> into subject (<code>find…By</code>) and predicate (<code>Author</code>, <code>And</code>, <code>Year</code>), checks the properties exist, and builds a JPQL/criteria query. Keywords include <code>And</code>, <code>Or</code>, <code>Between</code>, <code>LessThan</code>, <code>Like</code>, <code>Containing</code>, <code>IgnoreCase</code>, <code>OrderBy</code>. More: <a href="spring-data.html">Spring Data repositories</a>.</p>', lvl: 'core' },
    { q: 'CrudRepository vs JpaRepository?', a: '<p><code>JpaRepository</code> extends the CRUD and paging/sorting repositories and adds JPA-specific methods like <code>flush</code>, <code>saveAndFlush</code> and batch deletes. Most apps simply use <code>JpaRepository</code>.</p>', lvl: 'core' },
    { q: 'What does ddl-auto do and what are its values?', a: '<p><code>none</code>, <code>validate</code>, <code>update</code>, <code>create</code>, <code>create-drop</code>. It controls schema generation from entities. Use <code>create-drop</code> for demos and tests, migrations + <code>validate</code> for real databases.</p>', lvl: 'core' },
    { q: 'H2 or Postgres for development?', a: '<p>H2 starts instantly with no install, great for learning. But it is not Postgres; for anything you will deploy, run Postgres locally (Docker) or in tests via Testcontainers so you test the real dialect.</p>', lvl: 'core' },
    { q: 'When would you use @Query instead of a derived method?', a: '<p>When the name gets long or unclear, when you need joins, aggregates or projections, or a native SQL query. <code>@Query("select b from Book b where b.year &gt; :y")</code> uses JPQL (entity names, not table names) by default.</p>', lvl: 'core' },
    { q: 'What is the N+1 problem?', a: '<p>Loading a list of N entities, then lazily loading a relation for each one, costs 1 + N queries. Fix with fetch joins or entity graphs. See <a href="jpa-n-plus-1.html">N+1 &amp; OSIV</a>.</p>', lvl: 'deep' },
    { q: 'Does save() always run SQL immediately?', a: '<p>Not necessarily. Inside a transaction, changes are held in the persistence context and flushed at commit (or before a query that needs them). With IDENTITY ids, the INSERT runs right away because the id is needed.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Entity + repository + service', lang: 'java', code: `@Entity
@Table(name = "book")
public class Book {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;
  @Column(nullable = false) private String title;
  @Column(nullable = false) private String author;
  private int year;

  protected Book() {}
  public Book(String title, String author, int year) { this.title = title; this.author = author; this.year = year; }
  public Long getId() { return id; }
  public String getTitle() { return title; }
  public String getAuthor() { return author; }
  public int getYear() { return year; }
}

public interface BookRepository extends JpaRepository<Book, Long> {
  List<Book> findByAuthor(String author);
  List<Book> findByYearBetween(int from, int to);
  boolean existsByTitleIgnoreCase(String title);

  @Query("select b from Book b where lower(b.title) like lower(concat('%', :q, '%'))")
  List<Book> search(@Param("q") String q);
}

@Service
class BookService {
  private final BookRepository books;
  BookService(BookRepository books) { this.books = books; }

  @Transactional
  public Book add(String title, String author, int year) {
    if (books.existsByTitleIgnoreCase(title)) throw new IllegalStateException("duplicate");
    return books.save(new Book(title, author, year));
  }
}` },
    { title: 'H2 for learning, Postgres for real', lang: 'yaml', code: `# application.yml  (H2 on the classpath, nothing else needed)
spring:
  jpa:
    show-sql: true            # print SQL while learning
  h2:
    console:
      enabled: true           # browse at /h2-console
---
spring:
  config:
    activate:
      on-profile: postgres
  datasource:
    url: jdbc:postgresql://localhost:5432/library
    username: app
    password: \${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate      # Flyway creates the tables`, note: 'Add <code>org.flywaydb:flyway-core</code> (plus <code>flyway-database-postgresql</code> for recent Flyway versions) and put SQL files in <code>db/migration</code>. Connection pooling: <a href="hikari-pooling.html">HikariCP</a>.' }
  ]
});
