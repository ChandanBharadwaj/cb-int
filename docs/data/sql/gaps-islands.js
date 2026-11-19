IA.register({
  track: 'sql',
  slug: 'gaps-islands',
  title: 'Gaps & islands',
  tagline: 'Streaks, sessions, missing ids, merged time ranges. They are all one pattern: <b>find where a sequence breaks</b>, then turn each unbroken run into a group key that GROUP BY can use.',
  tldr: {
    problem: 'Rows don’t know their neighbours. “Longest login streak”, “split clicks into sessions” or “which invoice numbers are missing” all need you to compare a row with the one before it.',
    model: 'Two recipes. <b>Difference trick</b>: <code>value − row_number()</code> is constant inside a run of consecutive values. <b>Flag + running sum</b>: <code>LAG</code> → “is this a break?” 0/1 → <code>SUM(flag) OVER (ORDER BY …)</code> = group id.',
    hook: 'Why does <code>day − row_number()</code> work? Inside a streak, both go up by exactly 1, so the difference never changes. A gap moves the day ahead faster than the counter.',
    facts: [
      { v: '1 sort', l: 'both recipes need one ordered pass (a WindowAgg), then a GROUP BY. No self-joins, no loops' },
      { v: 'PG14+', l: '<code>range_agg</code> and multiranges merge overlapping intervals in one aggregate' },
      { v: 'dense_rank', l: 'instead of row_number when the same day can appear twice, or DISTINCT first' }
    ]
  },
  intro: {
    what: 'An <b>island</b> is a run of consecutive values with no hole: logins on Mon, Tue, Wed. A <b>gap</b> is the hole between islands. Lots of real questions are island questions: login streaks, uptime periods, browsing sessions, “which order numbers were skipped?”.',
    analogy: { icon: '🏝️', title: 'Islands in a row of sea squares', text: 'Draw ten squares and colour the days you went to the gym. The coloured runs are islands, the white squares are gaps. Your eyes find them instantly; SQL needs a trick, because each row only knows about itself.' },
    steps: [
      { t: 'Put the rows in order', d: 'Islands only exist along an order: dates, timestamps, ids.' },
      { t: 'Compare each row to the previous one', d: '<code>LAG(day)</code> gives the previous row’s value. A difference bigger than 1 day means a gap started.', code: 'SELECT day, day - LAG(day) OVER (ORDER BY day) AS diff\nFROM logins WHERE user_id = 1;' },
      { t: 'Give each island a label', d: 'Subtract a counter from the date. Consecutive days produce the same result, so it works as a group label.', code: 'day - row_number() OVER (ORDER BY day)::int AS grp' },
      { t: 'Group by the label', d: 'One row per island: start, end, length.', code: 'SELECT min(day), max(day), count(*) FROM (…) s GROUP BY grp;' }
    ],
    widget: 'gaps-islands-intro',
    terms: [
      ['island', 'A maximal run of consecutive values (no holes).'],
      ['gap', 'Missing values between two islands.'],
      ['LAG(x)', 'Window function: x from the previous row in the window order.'],
      ['row_number()', 'Window function: 1, 2, 3… in the window order.'],
      ['generate_series', 'Produces a series of numbers or timestamps, e.g. every day in March.']
    ]
  },
  visual: {
    title: 'Watch date − row_number() group a streak',
    caption: 'Each login day minus its row number gives an “anchor” date. Same anchor = same island. Switch on the <b>duplicate login</b> and keep <code>row_number()</code> to see a real streak split in two, then fix it with <code>dense_rank()</code>.'
  },
  extras: [
    { id: 'gaps-islands-sessions', title: 'Sessionization: LAG + gap + running SUM', label: 'sessions', caption: 'Pick the inactivity threshold. Each event becomes “new session or not”, and a running SUM of that flag is the session id.' }
  ],
  playground: {
    setup: `
CREATE TABLE logins (user_id int, day date);
INSERT INTO logins VALUES (1,'2024-03-01'),(1,'2024-03-02'),(1,'2024-03-02'),(1,'2024-03-03'),
 (1,'2024-03-05'),(1,'2024-03-06'),(1,'2024-03-09'),(2,'2024-03-04'),(2,'2024-03-05');
CREATE TABLE events (user_id int, ts timestamp);
INSERT INTO events VALUES (1,'2024-03-01 09:00'),(1,'2024-03-01 09:12'),(1,'2024-03-01 09:40'),
 (1,'2024-03-01 10:25'),(1,'2024-03-01 10:31'),(1,'2024-03-01 11:05'),(1,'2024-03-01 11:50'),(2,'2024-03-01 09:05');
CREATE TABLE invoices (id int PRIMARY KEY);
INSERT INTO invoices SELECT g FROM generate_series(1,20) g WHERE g NOT IN (4,9,10,17);
CREATE TABLE bookings (room text, during tsrange);
INSERT INTO bookings VALUES ('A','[2024-03-01 09:00,2024-03-01 10:00)'),('A','[2024-03-01 09:30,2024-03-01 11:00)'),
 ('A','[2024-03-01 11:00,2024-03-01 12:00)'),('A','[2024-03-01 14:00,2024-03-01 15:00)'),('B','[2024-03-01 09:00,2024-03-01 09:30)');`,
    presets: [
      { label: 'LAG: see the breaks', sql: `SELECT user_id, day,\n  day - LAG(day) OVER (PARTITION BY user_id ORDER BY day) AS diff_days\nFROM logins ORDER BY user_id, day;`, note: 'diff 1 = streak continues, 0 = duplicate, &gt;1 = gap. NULL = first row of the user.' },
      { label: 'Streaks (window)', sql: `SELECT user_id, min(day) AS start, max(day) AS finish, count(DISTINCT day) AS days\nFROM (SELECT user_id, day,\n        day - dense_rank() OVER (PARTITION BY user_id ORDER BY day)::int AS grp\n      FROM logins) s\nGROUP BY user_id, grp\nORDER BY user_id, start;`, note: 'dense_rank tolerates the duplicate 03-02 login. Try row_number instead: user 1’s keys collide and Mar 1–2 merges with Mar 5–6.' },
      { label: 'Sessions (30 min)', sql: `SELECT user_id, sid, min(ts) AS started, max(ts) AS ended, count(*) AS events\nFROM (SELECT *, sum(is_new) OVER (PARTITION BY user_id ORDER BY ts) AS sid\n      FROM (SELECT *, CASE WHEN ts - LAG(ts) OVER (PARTITION BY user_id ORDER BY ts)\n                               <= interval '30 minutes' THEN 0 ELSE 1 END AS is_new\n            FROM events) a) b\nGROUP BY user_id, sid ORDER BY 1, 2;`, note: 'LAG is NULL on the first event, so the comparison is NULL and the CASE falls to ELSE 1: a new session.' },
      { label: 'Missing ids', sql: `-- gaps as ranges, no generator\nSELECT id + 1 AS gap_start, next_id - 1 AS gap_end\nFROM (SELECT id, LEAD(id) OVER (ORDER BY id) AS next_id FROM invoices) s\nWHERE next_id > id + 1;\n\n-- every missing id, with generate_series\nSELECT g AS missing\nFROM generate_series((SELECT min(id) FROM invoices), (SELECT max(id) FROM invoices)) g\nWHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = g);`, note: 'The LEAD version scales to billions of ids (one index-order scan). generate_series is clearer for small ranges.' },
      { label: 'Merge overlaps (PG14)', sql: `SELECT room, unnest(range_agg(during)) AS busy\nFROM bookings GROUP BY room ORDER BY 1, 2;`, note: '09:00–10:00 and 09:30–11:00 overlap, and 11:00–12:00 is adjacent (half-open ranges), so all three merge into 09:00–12:00.' },
      { label: 'Merge overlaps (classic)', sql: `SELECT room, min(lower(during)) AS s, max(upper(during)) AS e\nFROM (SELECT *, sum(is_new) OVER (PARTITION BY room ORDER BY lower(during)) AS grp\n      FROM (SELECT *, CASE WHEN lower(during) <= max(upper(during)) OVER (\n                     PARTITION BY room ORDER BY lower(during)\n                     ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)\n                 THEN 0 ELSE 1 END AS is_new FROM bookings) a) b\nGROUP BY room, grp ORDER BY 1, 2;`, note: 'Compare with the running <b>max</b> of all previous ends, not just LAG of the previous end: a long early booking can cover several later ones.' }
    ]
  },
  gotchas: [
    { trap: 'Duplicates break the row_number trick', code: `day - row_number() OVER (ORDER BY day)  -- 2 rows on 03-02`, why: 'The duplicate consumes a number, so the key shifts and a real streak splits in two.', fix: 'Use <code>dense_rank()</code>, or <code>SELECT DISTINCT</code> the days first.' },
    { trap: 'Timestamps instead of dates', why: '<code>ts - row_number()</code> is meaningless; consecutive “days” for a timestamp column means same calendar day, in some time zone.', fix: 'Convert first: <code>(ts AT TIME ZONE \'Europe/Berlin\')::date</code>. Decide the time zone explicitly; a UTC date gives users in Asia streaks that break at the wrong hour.' },
    { trap: 'Merging overlaps with LAG(end)', why: 'A booking 09:00–17:00 followed by 10:00–11:00 and 12:00–13:00: LAG(end) of the third row is 11:00, so it looks like a new island, but it is covered by the first.', fix: 'Compare with the running <code>max(upper)</code> over all previous rows, or use <code>range_agg</code> (PG14+).' },
    { trap: 'Inclusive vs half-open ranges', why: '<code>[09:00,10:00]</code> and <code>[10:00,11:00]</code> overlap in one instant; <code>[09:00,10:00)</code> and <code>[10:00,11:00)</code> are only adjacent. The choice decides whether a back-to-back meeting is a conflict.', fix: 'Use half-open <code>[)</code> ranges (the default for <code>tsrange(a,b)</code>). <code>range_agg</code> merges adjacent ranges too.' },
    { trap: 'generate_series over a huge id space', why: 'Finding gaps in 2 billion ids by generating 2 billion rows and anti-joining is slow and memory-hungry.', fix: 'Use <code>LEAD(id)</code> to emit gap ranges straight from the index order.' },
    { trap: 'Sequences always have gaps', why: 'Rolled-back inserts, cached sequence values and crashes all burn numbers. “Missing invoice ids” is normal for <code>serial</code> / identity columns.', fix: 'If legally gapless numbers are needed, allocate them from a counter row inside the same transaction (and accept serialized writes).' }
  ],
  scenarios: [
    { title: 'Streak badge awarded to users who skipped a day',
      symptom: 'The “7-day streak” job awarded badges to users whose calendar clearly showed a missed day.',
      diagnose: `SELECT user_id, day, count(*) FROM logins GROUP BY 1,2 HAVING count(*) > 1;\n-- and check the job’s time zone\nSHOW timezone;`,
      cause: 'The job computed <code>ts::date</code> in the server’s UTC session. For users in UTC−8, an evening login and the next morning’s login fell on the same UTC date, while a real missed local day looked consecutive.',
      fix: 'Compute local dates with the user’s time zone, DISTINCT them, then apply the difference trick.',
      fixCode: `SELECT DISTINCT l.user_id, (l.ts AT TIME ZONE u.tz)::date AS day\nFROM logins l JOIN users u ON u.id = l.user_id` },
    { title: 'Room double-booked despite the “no overlap” check',
      symptom: 'Two meetings in the same room at the same time. The app checked for overlaps before inserting.',
      diagnose: `SELECT a.id, b.id FROM bookings a JOIN bookings b\n  ON a.room = b.room AND a.id < b.id AND a.during && b.during;`,
      cause: 'Check-then-insert race under READ COMMITTED: two transactions both saw “no conflict”, then both inserted.',
      fix: 'Let the database enforce it with an exclusion constraint. No application lock needed.',
      fixCode: `CREATE EXTENSION IF NOT EXISTS btree_gist;\nALTER TABLE bookings ADD CONSTRAINT no_overlap\n  EXCLUDE USING gist (room WITH =, during WITH &&);` },
    { title: 'Analytics sessions count tripled after a mobile release',
      symptom: 'Sessions per user jumped 3× overnight; time on site dropped.',
      diagnose: `SELECT percentile_disc(ARRAY[.5,.9]) WITHIN GROUP (ORDER BY gap)\nFROM (SELECT ts - LAG(ts) OVER (PARTITION BY user_id ORDER BY ts) gap FROM events) s;`,
      cause: 'The new app sent events in batches every 45 minutes when backgrounded. With a 30-minute threshold, each batch became a new session.',
      fix: 'Sessionize on client event time (not ingestion time) and agree on the threshold with product. Store the threshold with the derived table so numbers are reproducible.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'How many streaks (islands) does user 1 have? (Days 1, 2, 2, 3, 5, 6, 9 of March.)', code: `SELECT count(DISTINCT grp) FROM (\n  SELECT day - dense_rank() OVER (ORDER BY day)::int AS grp\n  FROM logins WHERE user_id = 1) s;`, options: ['2', '3', '4', '7'], answer: 1, explain: 'Mar 1–3, Mar 5–6, Mar 9: <b>3</b>.' },
    { kind: 'bug', q: 'Same query but with <code>row_number()</code>. How many “islands” now?', code: `SELECT count(DISTINCT grp) FROM (\n  SELECT day - row_number() OVER (ORDER BY day)::int AS grp\n  FROM logins WHERE user_id = 1) s;`, options: ['3', '4', '5', '6'], answer: 0, explain: '<b>3</b>, which looks right but is wrong. Keys: Mar 1→0, Mar 2→0, Mar 2→−1, Mar 3→−1, Mar 5→0, Mar 6→0, Mar 9→2. The duplicate split Mar 1–3 into two keys, and key 0 now also <i>merges</i> Mar 1–2 with Mar 5–6. A count-only test would pass.' },
    { kind: 'predict', q: 'With a 30-minute threshold, how many sessions does user 1 have? (09:00, 09:12, 09:40, 10:25, 10:31, 11:05, 11:50)', code: `SELECT count(*) FILTER (WHERE is_new = 1) FROM (\n  SELECT CASE WHEN ts - LAG(ts) OVER (ORDER BY ts) <= interval '30 minutes'\n              THEN 0 ELSE 1 END AS is_new\n  FROM events WHERE user_id = 1) s;`, options: ['3', '4', '5', '2'], answer: 1, explain: 'Gaps: 12, 28, 45, 6, 34, 45. Breaks at 10:25, 11:05, 11:50, plus the first event: <b>4</b>.' },
    { kind: 'predict', q: 'How many missing ids does the LEAD query report as gap <i>ranges</i>?', code: `SELECT id + 1, next_id - 1 FROM (\n  SELECT id, LEAD(id) OVER (ORDER BY id) next_id FROM invoices) s\nWHERE next_id > id + 1;`, options: ['2', '3', '4', '5'], answer: 1, explain: 'Missing 4, 9–10, 17: <b>3</b> ranges (4 ids).' },
    { kind: 'predict', q: 'How many merged busy ranges for room A?', code: `SELECT unnest(range_agg(during)) FROM bookings WHERE room = 'A';`, options: ['1', '2', '3', '4'], answer: 1, explain: '09:00–12:00 (two overlapping plus one adjacent) and 14:00–15:00: <b>2</b>.' },
    { kind: 'concept', q: 'Why is <code>SUM(is_new) OVER (ORDER BY ts)</code> a valid session id?', options: ['It counts rows', 'It only increases at a break, so it is constant within a session and different across sessions', 'SUM over a window is unique per row', 'It equals row_number'], answer: 1, explain: 'A running sum of a 0/1 break flag is a step function: it steps up exactly at breaks.' }
  ],
  interview: [
    { q: 'Explain the row_number difference trick.', a: '<p>Order by the value, number the rows, subtract. Within a run of consecutive values both sides increase by 1, so the difference is constant; any gap makes the value increase faster, producing a new constant. Group by the difference. With duplicates use <code>dense_rank</code> or DISTINCT first.</p>', fu: 'What if the step isn’t 1 (e.g. ids every 10)? (Divide, or use the LAG-flag method.)', lvl: 'core' },
    { q: 'How do you sessionize clickstream data in SQL?', a: '<p><code>LAG(ts)</code> per user → flag <code>1</code> when the gap exceeds the threshold (or LAG is NULL) → <code>SUM(flag) OVER (PARTITION BY user ORDER BY ts)</code> = session number → GROUP BY it. One sort per user partition, linear after that.</p>', lvl: 'core' },
    { q: 'Difference-trick vs LAG-flag: when do you pick which?', a: '<p>The difference trick needs a discrete, evenly stepped domain (integers, dates). LAG-flag works with any “is this a break?” rule: time thresholds, value changes (status flips), overlapping ranges via running max.</p>', lvl: 'deep' },
    { q: 'How do you merge overlapping intervals?', a: '<p>PG14+: <code>range_agg(during)</code> returns a multirange; <code>unnest</code> it. Classic: order by start, flag a new group when start &gt; running <code>max(end)</code> of all previous rows (not just LAG), running sum, group.</p>', lvl: 'core' },
    { q: 'How do you find missing ids efficiently in a huge table?', a: '<p><code>LEAD(id) OVER (ORDER BY id)</code> and keep rows where <code>next - id &gt; 1</code>. That’s one pass, which can be an index-only scan. Avoid generating the full id space with generate_series when the range is large.</p>', lvl: 'core' },
    { q: 'How would you prevent overlapping bookings rather than detect them?', a: '<p>An exclusion constraint: <code>EXCLUDE USING gist (room WITH =, during WITH &amp;&amp;)</code> with <code>btree_gist</code>. It’s race-free under concurrency, unlike check-then-insert. PG16 doesn’t support WITHOUT OVERLAPS on primary keys yet; that arrives in PG18.</p>', lvl: 'deep' },
    { q: 'Longest streak per user, top 10 users?', a: '<p>Islands per user (difference trick), <code>count(*)</code> per island, then <code>max</code> per user, then ORDER BY … LIMIT 10. An index on <code>(user_id, day)</code> gives the window its order without a sort.</p>', lvl: 'core' },
    { q: 'Why can’t sequences guarantee gapless ids?', a: '<p><code>nextval</code> is non-transactional: rollbacks don’t return numbers, sessions cache values (<code>CACHE n</code>), and a crash can skip up to 32 pre-logged values. Gapless numbering needs a locked counter row, which serializes writers.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Exclusion constraint violation in Spring', lang: 'java', code: `try {
    bookingRepo.saveAndFlush(booking);
} catch (DataIntegrityViolationException e) {
    if (e.getMostSpecificCause() instanceof PSQLException p
        && "23P01".equals(p.getSQLState())) {      // exclusion_violation
        throw new RoomAlreadyBookedException(booking.getRoom());
    }
    throw e;
}`, note: 'Map <code>tsrange</code> with Hibernate 6 via a custom type or keep start/end columns and a generated range column.' },
    { title: 'Longest streak as a projection', lang: 'java', code: `public interface Streak { LocalDate getStart(); LocalDate getFinish(); long getDays(); }

@Query(value = """
  SELECT min(day) AS start, max(day) AS finish, count(*) AS days
  FROM (SELECT day, day - row_number() OVER (ORDER BY day)::int AS grp
        FROM (SELECT DISTINCT day FROM logins WHERE user_id = :uid) d) s
  GROUP BY grp
  ORDER BY days DESC, start DESC
  LIMIT 1""", nativeQuery = true)
Optional<Streak> longestStreak(@Param("uid") long uid);`, note: 'DISTINCT first, then row_number is safe. Index <code>(user_id, day)</code>.' }
  ]
});
