/* ==========================================================================
   Interview Atlas — page engine (helpers adapted from cb-sys-design)
   A data file calls IA.register({...}); an optional widget file calls
   IA.widget(slug, fn). On DOMContentLoaded the engine renders the page.
   ========================================================================== */
(function () {
  'use strict';

  const IA = (window.IA = window.IA || {});
  IA.widgets = IA.widgets || {};
  IA.register = (d) => { IA.data = d; };
  IA.widget = (id, fn) => { IA.widgets[id] = fn; };

  const NS = 'http://www.w3.org/2000/svg';
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  IA.reduced = reduced;

  /* ---------------- helpers ---------------- */
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  }
  function svg(tag, attrs, ...kids) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.setAttribute('class', v);
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c);
    return n;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  function fmtNum(n, digits) {
    if (typeof n !== 'number' || !isFinite(n)) return String(n);
    const a = Math.abs(n);
    const d = digits == null ? (a >= 100 ? 0 : a >= 10 ? 1 : 2) : digits;
    const units = [[1e15, 'Q'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (const [v, u] of units) if (a >= v) { const x = n / v; return trim(x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2)) + u; }
    return trim(n.toFixed(a >= 100 ? 0 : d));
  }
  function trim(s) { return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s; }
  function fmtBytes(n) {
    if (!isFinite(n)) return String(n);
    const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB'];
    let i = 0; let x = Math.abs(n);
    while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; }
    return trim(x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2)) + ' ' + u[i];
  }
  function fmtBits(n) {
    if (!isFinite(n)) return String(n);
    const u = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps', 'Pbps'];
    let i = 0; let x = Math.abs(n);
    while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; }
    return trim(x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2)) + ' ' + u[i];
  }
  function fmtDur(ms) {
    if (!isFinite(ms)) return String(ms);
    if (ms < 1) return trim((ms * 1000).toFixed(0)) + ' µs';
    if (ms < 1000) return trim(ms.toFixed(ms < 10 ? 1 : 0)) + ' ms';
    const s = ms / 1000; if (s < 120) return trim(s.toFixed(1)) + ' s';
    const m = s / 60; if (m < 120) return trim(m.toFixed(1)) + ' min';
    const h = m / 60; if (h < 48) return trim(h.toFixed(1)) + ' h';
    const d = h / 24; if (d < 730) return trim(d.toFixed(0)) + ' days';
    return trim((d / 365).toFixed(1)) + ' years';
  }
  function fmt(v, kind, unit) {
    if (typeof v === 'string') return v;
    let s;
    switch (kind) {
      case 'bytes': s = fmtBytes(v); break;
      case 'bytesps': s = fmtBytes(v) + '/s'; break;
      case 'bits': s = fmtBits(v); break;
      case 'ms': s = fmtDur(v); break;
      case 'pct': s = trim((v * 100).toFixed(v < 0.01 ? 3 : 1)) + '%'; break;
      case 'raw': s = String(v); break;
      default: s = fmtNum(v);
    }
    return unit ? s + ' ' + unit : s;
  }
  IA.fmt = { num: fmtNum, bytes: fmtBytes, bits: fmtBits, dur: fmtDur, any: fmt };
  IA.h = { el, svg, esc, clamp, sleep, cssVar, store };

  /* ---------------- theme ---------------- */
  // preference: 'light' (default) | 'dark' | 'auto' (follow the OS)
  function themePref() {
    const t = store.get('ia-theme', 'light');
    return t === 'dark' || t === 'auto' ? t : 'light';
  }
  function applyTheme(p) {
    if (p === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', p);
  }
  function themeButton() {
    const opts = [['light', '☀', 'Light'], ['dark', '☾', 'Dark'], ['auto', '◎', 'Auto']];
    const seg = el('div', { class: 'theme-switch', role: 'radiogroup', 'aria-label': 'Colour theme' });
    const paint = () => {
      const p = themePref();
      [...seg.children].forEach((b) => { const on = b.dataset.v === p; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    };
    opts.forEach(([v, icon, label]) => {
      const b = el('button', { role: 'radio', 'data-v': v, 'aria-label': label + ' theme', title: label + (v === 'auto' ? ' (follow device)' : '') },
        el('span', { class: 'ti', text: icon }), el('span', { class: 'tl', text: label }));
      b.addEventListener('click', () => {
        store.set('ia-theme', v); applyTheme(v); paint();
        document.dispatchEvent(new CustomEvent('ia-theme'));
      });
      seg.append(b);
    });
    paint();
    return seg;
  }
  IA.themeButton = themeButton;
  applyTheme(themePref());

  /* ---------------- visibility helpers ---------------- */
  function onVisible(node, cb, opts) {
    if (!('IntersectionObserver' in window)) { cb(true); return () => {}; }
    const io = new IntersectionObserver((ents) => ents.forEach((e) => cb(e.isIntersecting)), opts || { threshold: 0.15 });
    io.observe(node);
    return () => io.disconnect();
  }
  function revealAll(root) {
    const items = root.querySelectorAll('.reveal');
    if (reduced || !('IntersectionObserver' in window)) { items.forEach((i) => i.classList.add('in')); return; }
    const io = new IntersectionObserver((ents) => ents.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    items.forEach((i) => io.observe(i));
  }
  // frame loop that only runs while `node` is on-screen
  function makeLoop(node, cb) {
    let visible = false; let raf = 0; let last = 0; let stopped = false;
    const tick = (t) => {
      if (stopped || !visible) { raf = 0; return; }
      const dt = last ? Math.min(64, t - last) : 16; last = t;
      cb(dt, t);
      raf = requestAnimationFrame(tick);
    };
    const off = onVisible(node, (v) => {
      visible = v;
      if (v && !raf && !stopped) { last = 0; raf = requestAnimationFrame(tick); }
    }, { threshold: 0.05 });
    return { stop() { stopped = true; off(); if (raf) cancelAnimationFrame(raf); } };
  }
  IA.onVisible = onVisible;
  /* ======================================================================
     Code highlighting (tiny, dependency-free)
     ====================================================================== */
  const KW = {
    java: 'abstract boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch synchronized this throw throws try void volatile while var record true false',
    python: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield',
    sql: 'full right cross outer lateral natural distinct union all intersect except null true false between like ilike desc asc offset fetch first rows only filter window range preceding following unbounded current row row_number dense_rank lag lead explain analyze vacuum select from where insert into values update set delete create table index primary key references not null unique default on conflict do nothing returning begin commit rollback for skip locked limit order by group having as and or in is join left inner using with alter add constraint check bigint int integer text varchar numeric timestamptz timestamp boolean uuid serial bigserial jsonb sequence function language plpgsql returns declare end if then else case when exists interval now coalesce count sum over partition rank',
    lua: 'local function end if then else elseif return and or not nil true false for do while in',
    yaml: 'true false null',
    js: 'const let var function return if else for while new class extends import from export default async await true false null undefined this',
    go: 'func package import return if else for range go chan select defer type struct interface map var const nil true false',
    bash: 'if then fi for do done echo export',
    bicep: 'param var resource module output targetScope existing for if in true false null',
    docker: 'FROM RUN COPY ADD CMD ENTRYPOINT ENV ARG WORKDIR EXPOSE USER LABEL VOLUME HEALTHCHECK AS',
    kql: 'where project summarize by extend join on take top order asc desc count sum avg ago bin let render and or not contains has',
    text: ''
  };
  const LANG_ALIAS = { ts: 'js', typescript: 'js', javascript: 'js', json: 'js', node: 'js', py: 'python', yml: 'yaml', sh: 'bash', shell: 'bash', dockerfile: 'docker', kotlin: 'java' };
  function highlight(code, lang) {
    lang = LANG_ALIAS[lang] || lang;
    const kw = new Set((KW[lang] != null ? KW[lang] : KW.java).split(' '));
    const ci = lang === 'sql';
    const cm = lang === 'python' || lang === 'yaml' || lang === 'bash' || lang === 'docker' ? '#[^\\n]*' : lang === 'sql' || lang === 'lua' ? '--[^\\n]*' : lang === 'text' ? '(?!)' : '\\/\\/[^\\n]*';
    const re = new RegExp(`(\\/\\*[\\s\\S]*?\\*\\/|${cm})|("(?:[^"\\\\\\n]|\\\\.)*"|'(?:[^'\\\\\\n]|\\\\.)*')|(\\b\\d+(?:\\.\\d+)?[LlFf]?\\b)|(@[A-Za-z_]\\w*)|([A-Za-z_]\\w*)`, 'g');
    let out = ''; let last = 0; let m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      const [t] = m;
      if (m[1]) out += `<span class="tok-c">${esc(t)}</span>`;
      else if (m[2]) out += `<span class="tok-s">${esc(t)}</span>`;
      else if (m[3]) out += `<span class="tok-n">${esc(t)}</span>`;
      else if (m[4]) out += `<span class="tok-a">${esc(t)}</span>`;
      else out += kw.has(ci ? t.toLowerCase() : t) ? `<span class="tok-k">${esc(t)}</span>` : esc(t);
      last = m.index + t.length;
    }
    return out + esc(code.slice(last));
  }

  /* ======================================================================
     Topic page builder
     ====================================================================== */
  IA.widgets = IA.widgets || {};
  IA.register = (d) => { IA.data = d; };
  IA.widget = (id, fn) => { IA.widgets[id] = fn; };
  IA.highlight = highlight;

  function section(id, num, title, sub) {
    const s = el('section', { class: 'section', id });
    s.append(el('div', { class: 'section-head' },
      el('span', { class: 'section-num', text: String(num).padStart(2, '0') }),
      el('h2', { text: title }), sub ? el('div', { class: 'section-sub', html: sub }) : null));
    return s;
  }
  let defaultLang = 'sql';   // set per page from the track (catalog `lang`)
  function codeBox(code, lang, title) {
    const pre = el('pre'); pre.innerHTML = highlight(code.replace(/^\n/, ''), lang || defaultLang);
    return el('div', { class: 'codebox' }, title ? el('div', { class: 'ch' }, el('span', { text: title })) : null, pre);
  }
  IA.codeBox = codeBox;

  function flatTopics(track) {
    const out = [];
    (track.modules || []).forEach((m) => m.topics.forEach((t) => out.push(Object.assign({ module: m }, t))));
    return out;
  }
  IA.flatTopics = flatTopics;

  /* ---------- playground (PGlite = real Postgres in WASM, loaded lazily) ---------- */
  const PGLITE = 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.12/dist/index.js';
  let dbPromise = null;
  function getDb(setup) {
    if (!dbPromise) {
      dbPromise = import(PGLITE).then(async (m) => {
        const db = new m.PGlite();
        if (setup) await db.exec(setup);
        return db;
      });
    }
    return dbPromise;
  }
  IA.getDb = getDb;
  function resultGrid(res) {
    if (!res || !res.fields || !res.fields.length) return el('div', { class: 'tiny', text: 'OK' + (res && res.affectedRows != null ? ' · ' + res.affectedRows + ' rows affected' : '') });
    const fmtCell = (v) => v === null ? el('td', { class: 'null', text: 'NULL' }) : el('td', { text: v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v) });
    return el('div', { class: 'tscroll' }, el('table', { class: 't rg' },
      el('thead', null, el('tr', null, res.fields.map((f) => el('th', { text: f.name })))),
      el('tbody', null, res.rows.map((r) => el('tr', null, res.fields.map((f) => fmtCell(r[f.name])))))),
      el('div', { class: 'tiny', text: res.rows.length + ' row' + (res.rows.length === 1 ? '' : 's') }));
  }
  IA.resultGrid = resultGrid;
  /* ---------- Python playground (Pyodide = CPython in WASM, loaded lazily) ---------- */
  const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  let pyPromise = null;
  function getPy() {
    if (!pyPromise) {
      pyPromise = new Promise((ok, fail) => {
        const sc = document.createElement('script'); sc.src = PYODIDE + 'pyodide.js';
        sc.onload = () => window.loadPyodide({ indexURL: PYODIDE }).then(ok, fail);
        sc.onerror = () => fail(new Error('Could not load Python (pyodide).'));
        document.head.append(sc);
      }).catch((e) => { pyPromise = null; throw e; });
    }
    return pyPromise;
  }
  async function runPython(code) {
    const py = await getPy();
    const lines = [];
    py.setStdout({ batched: (t) => lines.push({ t, k: 'out' }) });
    py.setStderr({ batched: (t) => lines.push({ t, k: 'err' }) });
    // fresh globals per run so presets don't leak into each other
    const ns = py.globals.get('dict')();
    try { await py.runPythonAsync(code, { globals: ns }); }
    catch (e) { lines.push({ t: String(e.message || e).trim().split('\n').slice(-6).join('\n'), k: 'err' }); }
    finally { ns.destroy(); }
    return lines;
  }

  /* ---------- JS playground (sandboxed Web Worker; browser JS engine, no Node APIs) ---------- */
  const WORKER_SRC = `
    const send = (k, a) => postMessage({ k, t: a.map((x) => { try { return typeof x === 'string' ? x : x instanceof Error ? (x.name + ': ' + x.message) : JSON.stringify(x, null, 0) ?? String(x); } catch (e) { return String(x); } }).join(' ') });
    console.log = (...a) => send('out', a); console.info = console.log; console.debug = console.log;
    console.warn = (...a) => send('warn', a); console.error = (...a) => send('err', a);
    self.onunhandledrejection = (e) => send('err', ['Uncaught (in promise) ' + (e.reason && e.reason.message ? e.reason.name + ': ' + e.reason.message : String(e.reason))]);
    self.onerror = (m) => { send('err', ['Uncaught ' + m]); };
    onmessage = async (m) => {
      if (m.data === '__ping') { postMessage({ k: 'pong' }); return; }   // answered only when the event loop is free
      try { await (new (Object.getPrototypeOf(async function () {}).constructor)(m.data))(); }
      catch (e) { send('err', ['Uncaught ' + (e && e.name ? e.name + ': ' + e.message : String(e))]); }
      postMessage({ k: 'done' });
    };`;
  function runJs(code) {
    return new Promise((ok) => {
      const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
      const w = new Worker(url); const lines = []; let pinger = null; let quiet = 0;
      const finish = (why) => { clearTimeout(hard); clearInterval(pinger); w.terminate(); URL.revokeObjectURL(url); if (why) lines.push({ t: why, k: 'warn' }); ok(lines); };
      const hard = setTimeout(() => finish('Stopped after 5 s.'), 5000);
      // After the code returns, ping the worker. A busy worker (long microtask chains, CPU loops) can't answer,
      // so we stop only after ~1 s in which the worker was responsive and printed nothing (pending timers get to fire).
      w.onmessage = (m) => {
        const k = m.data.k;
        if (k === 'done') { pinger = setInterval(() => w.postMessage('__ping'), 100); return; }
        if (k === 'pong') { if (++quiet >= 10) finish(); return; }
        lines.push(m.data); quiet = 0;
      };
      w.onerror = (e) => { lines.push({ t: e.message, k: 'err' }); e.preventDefault(); };
      w.postMessage(code);
    });
  }
  function consoleOut(lines, ms) {
    const box = el('pre', { class: 'pg-console' });
    if (!lines.length) box.append(el('span', { class: 'tiny', text: '(no output)' }));
    lines.forEach((l) => box.append(el('span', { class: 'pc-' + l.k, text: l.t + '\n' })));
    return el('div', null, box, el('div', { class: 'tiny', text: ms + ' ms' }));
  }

  function playground(host, P) {
    if (P.kind === 'python' || P.kind === 'js') return codePlayground(host, P);
    const card = el('div', { class: 'card pg' });
    const ta = el('textarea', { class: 'pg-ed', spellcheck: 'false', 'aria-label': 'SQL editor' });
    const out = el('div', { class: 'pg-out' }, el('div', { class: 'tiny', text: 'Press Run (Ctrl+Enter). The first run loads Postgres in your browser (~3 MB).' }));
    const run = el('button', { class: 'btn primary', text: '▶ Run' });
    const reset = el('button', { class: 'btn', text: '↺ Reset DB' });
    const presets = el('div', { class: 'seg' });
    const note = el('div', { class: 'pg-note tiny' });
    (P.presets || []).forEach((p, i) => {
      const b = el('button', { text: p.label });
      b.addEventListener('click', () => { [...presets.children].forEach((x) => x.classList.toggle('on', x === b)); ta.value = p.sql.trim(); note.innerHTML = p.note || ''; });
      presets.append(b);
      if (i === 0) { b.classList.add('on'); ta.value = p.sql.trim(); note.innerHTML = p.note || ''; }
    });
    const schema = el('details', { class: 'pg-schema' }, el('summary', { text: 'Seed schema' }), codeBox(P.setup || '', 'sql'));
    card.append(presets, ta, note, el('div', { class: 'w-controls', style: { marginTop: '8px' } }, run, reset), out, schema);
    host.append(card);
    async function go() {
      run.disabled = true; out.innerHTML = ''; out.append(el('div', { class: 'tiny', text: 'Running…' }));
      try {
        const db = await getDb(P.setup);
        const t0 = performance.now();
        const results = await db.exec(ta.value);
        const ms = (performance.now() - t0).toFixed(1);
        out.innerHTML = '';
        results.filter((r) => r.fields && r.fields.length).slice(-3).forEach((r) => out.append(resultGrid(r)));
        if (!out.children.length) out.append(resultGrid(results[results.length - 1]));
        out.append(el('div', { class: 'tiny', text: ms + ' ms' }));
      } catch (e) {
        out.innerHTML = ''; out.append(el('div', { class: 'pg-err', text: (e && e.message) || String(e) }));
        if (String(e).includes('import') || String(e).includes('fetch')) dbPromise = null;
      }
      run.disabled = false;
    }
    run.addEventListener('click', go);
    ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); go(); } });
    reset.addEventListener('click', async () => { dbPromise = null; out.innerHTML = ''; out.append(el('div', { class: 'tiny', text: 'Database will be recreated on next run.' })); });
  }
  function codePlayground(host, P) {
    const py = P.kind === 'python';
    const card = el('div', { class: 'card pg' });
    const ta = el('textarea', { class: 'pg-ed', spellcheck: 'false', 'aria-label': py ? 'Python editor' : 'JavaScript editor' });
    const out = el('div', { class: 'pg-out' }, el('div', { class: 'tiny', text: py ? 'Press Run (Ctrl+Enter). The first run loads Python in your browser (~10 MB, cached after that).' : 'Press Run (Ctrl+Enter). Runs in a sandboxed worker using your browser’s JS engine (V8 in Chrome). Node-only APIs such as process.nextTick, setImmediate and require are not available here.' }));
    const run = el('button', { class: 'btn primary', text: '▶ Run' });
    const presets = el('div', { class: 'seg' });
    const note = el('div', { class: 'pg-note tiny' });
    const pick = (p) => { ta.value = (p.code || p.sql || '').trim(); note.innerHTML = p.note || ''; };
    (P.presets || []).forEach((p, i) => {
      const b = el('button', { text: p.label });
      b.addEventListener('click', () => { [...presets.children].forEach((x) => x.classList.toggle('on', x === b)); pick(p); });
      presets.append(b);
      if (i === 0) { b.classList.add('on'); pick(p); }
    });
    card.append(presets, ta, note, el('div', { class: 'w-controls', style: { marginTop: '8px' } }, run), out);
    host.append(card);
    async function go() {
      run.disabled = true; out.innerHTML = ''; out.append(el('div', { class: 'tiny', text: py ? 'Running… (loading Python the first time)' : 'Running…' }));
      const t0 = performance.now();
      try {
        const lines = py ? await runPython((P.setup ? P.setup + '\n' : '') + ta.value) : await runJs(ta.value);
        out.innerHTML = ''; out.append(consoleOut(lines, (performance.now() - t0).toFixed(0)));
      } catch (e) { out.innerHTML = ''; out.append(el('div', { class: 'pg-err', text: (e && e.message) || String(e) })); }
      run.disabled = false;
    }
    run.addEventListener('click', go);
    ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); go(); } });
  }
  IA.runJs = runJs; IA.runPython = runPython;

  /* ---------- puzzles: predict / pick, scored ---------- */
  function puzzles(host, list, slug) {
    let score = 0; let answered = 0;
    const bar = el('div', { class: 'qa-bar' });
    const sc = el('span', { class: 'pill accent', text: 'Score 0 / ' + list.length });
    bar.append(sc);
    host.append(bar);
    const grid = el('div', { class: 'pz-list' });
    list.forEach((p, i) => {
      const c = el('div', { class: 'card pz reveal' });
      c.append(el('div', { class: 'pz-h' }, el('span', { class: 'qn', text: 'P' + (i + 1) }), el('span', { class: 'pill', text: p.kind || 'predict' }), el('span', { html: p.q })));
      if (p.code) c.append(codeBox(p.code, p.lang));
      const exp = el('div', { class: 'pz-exp', hidden: true, html: '<b>Why:</b> ' + p.explain });
      const opts = el('div', { class: 'pz-opts' });
      let done = false;
      (p.options || []).forEach((o, j) => {
        const b = el('button', { class: 'btn pz-o', html: o });
        b.addEventListener('click', () => {
          if (done) return; done = true; answered++;
          const ok = j === p.answer; if (ok) score++;
          [...opts.children].forEach((x, k) => x.classList.add(k === p.answer ? 'right' : k === j ? 'wrong' : 'dim'));
          exp.hidden = false; sc.textContent = 'Score ' + score + ' / ' + list.length;
          if (answered === list.length) store.set('ia-pz-' + slug, score);
        });
        opts.append(b);
      });
      c.append(opts, exp);
      grid.append(c);
    });
    host.append(grid);
  }

  function topbar(rootRel, crumbs) {
    return el('header', { class: 'topbar' },
      el('a', { class: 'brand', href: rootRel + 'index.html' }, el('span', { class: 'brand-mark', text: '◇' }), el('span', { class: 'brand-t', text: 'Interview Atlas' })),
      el('nav', { class: 'crumb', 'aria-label': 'Breadcrumb' }, crumbs.map((c, i) => [i ? el('span', { class: 'cr-sep', text: '›' }) : null,
        c.href ? el('a', { href: c.href, text: c.t }) : el('span', { class: 'cr-title', 'aria-current': 'page', text: c.t })]).flat()),
      el('span', { class: 'spacer' }), themeButton());
  }
  IA.topbar = topbar;

  function trackTree(track, current, onPage) {
    const box = el('div', { class: 'tnav' });
    if (onPage) box.append(el('div', { class: 'toc-h', text: 'On this page' }), onPage);
    box.append(el('div', { class: 'toc-h toc-h2' }, el('a', { href: 'index.html', text: track.name + ' · all topics' })));
    (track.modules || []).forEach((m) => {
      const here = m.topics.some((t) => t.slug === current);
      const d = el('details', { class: 'tn-mod', open: here || null },
        el('summary', null, el('span', { class: 'tn-id', text: m.id }), el('span', { text: m.name })));
      m.topics.forEach((t) => d.append(t.slug === current ? el('span', { class: 'tn-t current', 'aria-current': 'page', text: t.n + ' · ' + t.title })
        : t.status === 'done' ? el('a', { class: 'tn-t', href: t.slug + '.html', text: t.n + ' · ' + t.title })
        : el('span', { class: 'tn-t soon', title: 'coming soon', text: t.n + ' · ' + t.title })));
      box.append(d);
    });
    return box;
  }
  function drawerButton(track, current) {
    const b = el('button', { class: 'icon-btn tn-btn', 'aria-label': 'All topics', text: '☰ Topics' });
    const back = el('div', { class: 'tn-backdrop', hidden: true });
    const panel = el('div', { class: 'tn-panel', role: 'dialog', 'aria-label': 'All topics' }, trackTree(track, current));
    back.append(panel);
    const close = () => { back.hidden = true; document.body.style.overflow = ''; };
    b.addEventListener('click', () => { back.hidden = false; document.body.style.overflow = 'hidden'; });
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    document.body.append(back);
    return b;
  }
  IA.trackTree = trackTree;

  function buildPage(D) {
    const tracks = (window.IA_CATALOG || { tracks: [] }).tracks;
    const track = tracks.find((t) => t.id === D.track) || { modules: [] };
    const all = flatTopics(track);
    const pos = all.findIndex((t) => t.slug === D.slug);
    const meta = all[pos] || {};
    defaultLang = D.lang || track.lang || 'sql';
    const L = defaultLang;
    const TX = Object.assign({
      gotchaSub: 'The traps that separate “knows SQL” from “has been paged for SQL”.',
      codeTitle: 'In your stack', codeLabel: 'Java / Spring', codeSub: 'Where this shows up in JPA, JDBC and Spring.',
      footer: 'Interview Atlas · Postgres 16+ semantics unless noted.'
    }, track.text || {});
    const PG_TITLE = { sql: 'Try it: real Postgres in your browser', python: 'Try it: real Python in your browser', js: 'Try it: JavaScript in your browser' };
    document.title = `${D.title} · ${track.name || ''} · Interview Atlas`;
    const vk = 'ia-visited-' + D.track; const visited = store.get(vk, []);
    if (!visited.includes(D.slug)) { visited.push(D.slug); store.set(vk, visited); }
    const live = all.filter((t) => t.status === 'done');
    const lpos = live.findIndex((t) => t.slug === D.slug);
    const prev = lpos > 0 ? live[lpos - 1] : null; const next = lpos >= 0 && lpos < live.length - 1 ? live[lpos + 1] : null;

    const app = document.getElementById('app'); app.innerHTML = '';
    const nav = el('nav', { class: 'secnav', 'aria-label': 'Sections' }); const navInner = el('div', { class: 'secnav-inner' }); nav.append(navInner);
    const main = el('main', { class: 'wrap' });
    const onPage = el('div', { class: 'tn-onpage' });
    const toc = el('aside', { class: 'toc', 'aria-label': 'Navigation' }, trackTree(track, D.slug, onPage));
    const tb = topbar('../', [{ t: 'Home', href: '../index.html' }, { t: track.name, href: 'index.html' }, { t: D.title }]);
    tb.insertBefore(drawerButton(track, D.slug), tb.children[1]);
    app.append(tb, nav, el('div', { class: 'layout' }, toc, main));
    const secs = []; let num = 0;
    const add = (id, title, label, sub) => { const s = section(id, ++num, title, sub); secs.push([id, label]); main.append(s); return s; };

    /* hero */
    const hero = el('section', { class: 'hero', id: 'overview' }); secs.push(['overview', 'Overview']);
    hero.append(el('div', { class: 'eyebrow' },
      meta.module ? el('span', { class: 'pill accent', text: meta.module.id + ' · ' + meta.module.name }) : null,
      meta.depth ? el('span', { class: 'pill depth-' + meta.depth, text: { F: 'Fundamentals', D: 'Deep', X: 'Internals + edge cases' }[meta.depth] || meta.depth }) : null));
    hero.append(el('h1', { text: D.title }));
    if (D.tagline) hero.append(el('p', { class: 'tagline', html: D.tagline }));
    if (D.tldr) {
      const t = D.tldr;
      const box = el('div', { class: 'card tldr-box' },
        el('div', { class: 'tldr-item' }, el('span', { class: 'ic', text: '?' }), el('div', null, el('b', { text: 'Problem' }), el('span', { html: t.problem }))),
        el('div', { class: 'tldr-item' }, el('span', { class: 'ic', text: '!' }), el('div', null, el('b', { text: 'Mental model' }), el('span', { html: t.model }))),
        t.hook ? el('div', { class: 'tldr-item' }, el('span', { class: 'ic', text: '★' }), el('div', null, el('b', { text: 'Interview hook' }), el('span', { html: t.hook }))) : null);
      const stats = el('div', { class: 'stats' }, (t.facts || []).map((n) => el('div', { class: 'stat' }, el('div', { class: 'v', html: n.v }), el('div', { class: 'l', html: n.l }))));
      hero.append(el('div', { class: 'tldr' }, box, stats));
    }
    main.append(hero);

    /* start here (beginner-friendly) */
    if (D.intro) {
      const I = D.intro;
      const s = add('start', 'Start here', 'Start here', 'New to this? Read this first. Already comfortable? Jump to <a href="#visual">the visual</a>.');
      const top = el('div', { class: 'intro-top' }, el('div', { class: 'card intro-what reveal' }, el('div', { class: 'kicker', text: 'In plain words' }), el('p', { class: 'lead', html: I.what })));
      if (I.analogy) top.append(el('div', { class: 'card analogy reveal' }, el('div', { class: 'an-ic', text: I.analogy.icon || '💡' }),
        el('div', null, el('div', { class: 'kicker', text: 'Think of it like…' }), el('h3', { html: I.analogy.title }), el('p', { html: I.analogy.text }))));
      s.append(top);
      if (I.steps) s.append(el('div', { class: 'ib-steps reveal' }, I.steps.map((x, i) => el('div', { class: 'card ib-step' },
        el('div', { class: 'ib-n', text: String(i + 1) }), el('h4', { html: x.t }), el('p', { html: x.d }), x.code ? codeBox(x.code, x.lang || L) : null))));
      if (I.widget && IA.widgets[I.widget]) { const body = el('div', { class: 'card widget-card reveal', style: { marginTop: '14px' } }); const wb = el('div', { class: 'widget-body' }); body.append(wb); s.append(body);
        try { IA.widgets[I.widget](wb, { el, svg, esc, reduced, sleep, clamp, codeBox }); } catch (e) { console.error(e); } }
      if (I.terms) s.append(el('div', { class: 'card reveal ib-terms', style: { marginTop: '14px' } }, el('div', { class: 'kicker', text: 'Words you will see' }),
        el('dl', null, I.terms.map(([k, v]) => [el('dt', { html: k }), el('dd', { html: v })]).flat())));
    }

    /* visual */
    if (D.visual && IA.widgets[D.slug]) {
      const s = add('visual', D.visual.title || 'See it move', 'Visual', D.visual.caption);
      const card = el('div', { class: 'card widget-card' }); const body = el('div', { class: 'widget-body' }); card.append(body); s.append(card);
      try {
        IA.widgets[D.slug](body, { el, svg, esc, reduced, css: cssVar, sleep, clamp, loop: (cb) => makeLoop(body, cb), onVisible: (cb) => onVisible(body, cb), codeBox, getDb, resultGrid });
      } catch (e) { console.error(e); body.append(el('p', { class: 'muted', text: 'Visual failed to load.' })); }
    }
    /* extra widgets */
    (D.extras || []).forEach((x) => {
      if (!IA.widgets[x.id]) return;
      const s = add(x.id, x.title, x.label || x.title, x.caption);
      const card = el('div', { class: 'card widget-card' }); const body = el('div', { class: 'widget-body' }); card.append(body); s.append(card);
      try { IA.widgets[x.id](body, { el, svg, esc, reduced, css: cssVar, sleep, clamp, codeBox, getDb, resultGrid }); } catch (e) { console.error(e); }
    });

    if (D.playground) playground(add('playground', PG_TITLE[D.playground.kind || 'sql'] || 'Try it', 'Playground', 'Pick a preset, edit and run. Nothing leaves your browser.'), D.playground);

    if (D.gotchas && D.gotchas.length) {
      const s = add('gotchas', 'Nuances & gotchas', 'Gotchas', TX.gotchaSub);
      s.append(el('div', { class: 'fm-cards reveal' }, D.gotchas.map((g) => el('div', { class: 'fm gt' },
        el('h4', { html: '⚠ ' + g.trap }), g.code ? codeBox(g.code, g.lang || L) : null,
        el('dl', null, el('dt', { text: 'Why' }), el('dd', { html: g.why }), el('dt', { text: 'Fix' }), el('dd', { html: g.fix }))))));
    }

    if (D.scenarios && D.scenarios.length) {
      const s = add('real-world', 'Real-world scenarios', 'Real world', 'Production incidents, laid out as symptom → diagnosis → fix.');
      D.scenarios.forEach((c) => s.append(el('div', { class: 'card rw reveal' },
        el('h3', { html: c.title }),
        el('div', { class: 'rw-flow' },
          el('div', { class: 'rw-step s-err' }, el('div', { class: 'kicker', text: '① Symptom' }), el('p', { html: c.symptom })),
          el('div', { class: 'rw-step s-warn' }, el('div', { class: 'kicker', text: '② Diagnose' }), c.diagnose ? codeBox(c.diagnose, c.diagnoseLang || c.lang || L) : null, c.cause ? el('p', { html: c.cause }) : null),
          el('div', { class: 'rw-step s-ok' }, el('div', { class: 'kicker', text: '③ Fix' }), el('p', { html: c.fix }), c.fixCode ? codeBox(c.fixCode, c.fixLang || c.lang || L) : null)))));
    }

    if (D.puzzles && D.puzzles.length) puzzles(add('puzzles', 'Tricky puzzles', 'Puzzles', 'Commit to an answer before you click. Scored.'), D.puzzles, D.slug);

    if (D.interview && D.interview.length) {
      const s = add('interview', 'Interview questions', 'Interview', 'Answer out loud first. Quiz mode blurs the answers.');
      const list = el('div');
      const quizBtn = el('button', { class: 'btn', text: '◐ Quiz mode: off' }); let quiz = false;
      quizBtn.addEventListener('click', () => { quiz = !quiz; list.classList.toggle('quiz', quiz); quizBtn.textContent = '◐ Quiz mode: ' + (quiz ? 'on' : 'off'); list.querySelectorAll('.qa').forEach((q) => q.classList.remove('revealed')); });
      s.append(el('div', { class: 'qa-bar' }, quizBtn, el('span', { class: 'tiny', text: D.interview.length + ' questions' })));
      D.interview.forEach((q, i) => {
        const ans = el('div', { class: 'ans', html: q.a + (q.fu ? `<div class="fu"><b>Follow-up:</b> ${q.fu}</div>` : '') });
        ans.addEventListener('click', () => ans.parentElement.classList.add('revealed'));
        list.append(el('details', { class: 'qa' }, el('summary', null, el('span', { class: 'chev', text: '▸' }), el('span', { class: 'qn', text: 'Q' + (i + 1) }), el('span', { html: q.q }),
          el('span', { class: 'lvl ' + (q.lvl || 'core'), text: q.lvl === 'deep' ? 'deep dive' : (q.lvl || 'core') })), ans));
      });
      s.append(list);
    }

    if (D.code && D.code.length) {
      const s = add('code', TX.codeTitle, TX.codeLabel, TX.codeSub);
      const tabs = el('div', { class: 'code-tabs' }); const box = el('div');
      const show = (i) => { [...tabs.children].forEach((t, j) => t.classList.toggle('active', i === j)); const c = D.code[i]; box.innerHTML = ''; box.append(codeBox(c.code, c.lang, c.title + ' · ' + c.lang)); if (c.note) box.append(el('div', { class: 'tiny', html: c.note, style: { marginTop: '6px' } })); };
      D.code.forEach((c, i) => { const t = el('button', { class: 'tab', text: c.title }); t.addEventListener('click', () => show(i)); tabs.append(t); });
      s.append(tabs, box); show(0);
    }

    main.append(el('div', { class: 'pager' },
      prev ? el('a', { href: prev.slug + '.html' }, el('div', { class: 'dir', text: '← Previous' }), prev.title) : el('span'),
      next ? el('a', { class: 'next', href: next.slug + '.html' }, el('div', { class: 'dir', text: 'Next →' }), next.title) : null));
    main.append(el('footer', { class: 'foot', html: TX.footer }));

    const links = {}; const tocLinks = {};
    secs.forEach(([id, label]) => { const a = el('a', { href: '#' + id, text: label }); links[id] = a; navInner.append(a); const t = el('a', { href: '#' + id, text: label }); tocLinks[id] = t; onPage.append(t); });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) {
        Object.values(links).forEach((a) => a.classList.remove('active'));
        Object.values(tocLinks).forEach((a) => a.classList.toggle('active', a === tocLinks[e.target.id]));
        const a = links[e.target.id]; if (a) { a.classList.add('active'); if (nav.offsetParent) navInner.scrollTo({ left: a.offsetLeft - navInner.clientWidth / 2 + a.offsetWidth / 2 }); }
      } }), { rootMargin: '-45% 0px -50% 0px' });
      secs.forEach(([id]) => { const n = document.getElementById(id); if (n) io.observe(n); });
    }
    revealAll(main);
  }
  IA.revealAll = revealAll;

  document.addEventListener('DOMContentLoaded', () => {
    if (IA.data && document.getElementById('app')) { try { buildPage(IA.data); } catch (e) { console.error(e); } }
  });
})();
