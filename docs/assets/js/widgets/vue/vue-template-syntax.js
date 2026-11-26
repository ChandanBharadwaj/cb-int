/* Template syntax: bindings, v-if vs v-show in the DOM, and why v-for needs a stable key. */
IA.widget('vue-template-syntax', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const W = 760;
  const T = (g, x, y, s, o = {}) => { const n = svg('text', { x, y, 'font-size': o.fs || 13, 'text-anchor': o.a || 'start', fill: o.c || 'var(--text)', 'font-family': o.mono ? 'var(--mono)' : null, 'font-weight': o.b ? 700 : null, text: s }); g.append(n); return n; };
  const B = (g, x, y, w, h, label, o = {}) => {
    const stroke = o.err ? 'var(--err)' : o.ok ? 'var(--ok)' : o.warn ? 'var(--warn)' : o.hot ? 'var(--accent)' : 'var(--border)';
    g.append(svg('rect', { x, y, width: w, height: h, rx: 8, fill: o.hot ? 'var(--accent-soft)' : (o.fill || 'var(--surface)'), stroke, 'stroke-width': (o.hot || o.err || o.ok || o.warn) ? 2.2 : 1.4, 'stroke-dasharray': o.dash ? '5 4' : null, opacity: o.dim ? 0.4 : 1 }));
    if (label != null) { const ls = String(label).split('\n'); ls.forEach((ln, i) => T(g, x + w / 2, y + h / 2 + 5 + (i - (ls.length - 1) / 2) * 17, ln, { a: 'middle', fs: o.fs, mono: o.mono, b: o.b, c: o.dim ? 'var(--text-3)' : o.err ? 'var(--err)' : o.ok ? 'var(--ok)' : 'var(--text)' })); }
  };
  const A = (g, x1, y1, x2, y2, o = {}) => {
    const c = o.err ? 'var(--err)' : o.ok ? 'var(--ok)' : o.hot ? 'var(--accent)' : 'var(--text-3)'; const ang = Math.atan2(y2 - y1, x2 - x1), L = 9;
    g.append(svg('line', { x1, y1, x2, y2, stroke: c, 'stroke-width': o.hot || o.err ? 2.4 : 1.6, 'stroke-dasharray': o.dash ? '5 4' : null }),
      svg('polygon', { points: `${x2},${y2} ${x2 - L * Math.cos(ang - 0.45)},${y2 - L * Math.sin(ang - 0.45)} ${x2 - L * Math.cos(ang + 0.45)},${y2 - L * Math.sin(ang + 0.45)}`, fill: c }));
    if (o.label) T(g, (x1 + x2) / 2 + (o.lx || 0), (y1 + y2) / 2 - 7 + (o.ly || 0), o.label, { a: 'middle', fs: 11, c });
  };
  function mount(cfg) {
    let mode = cfg.modes ? cfg.modes.opts[0][0] : null; let steps = []; let k = 0; let running = false; let gen = 0;
    const stage = svg('svg', { viewBox: `0 0 ${W} ${cfg.H}`, role: 'img', 'aria-label': cfg.aria });
    const num = el('span', { class: 'n', text: '1' }); const say = el('div', { class: 't' });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, num, say);
    const codeHost = el('div', { class: 'codebox', style: { marginTop: '10px' } });
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const top = [];
    if (cfg.modes) {
      const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': cfg.modes.label });
      cfg.modes.opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
      top.push(el('div', { class: 'w-controls' }, seg));
    }
    root.append(...top, el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, codeHost);
    function show(i) {
      const s = steps[i]; stage.innerHTML = ''; const g = svg('g'); stage.append(g); s.draw(g, mode);
      num.textContent = `${i + 1}/${steps.length}`; say.remove(); say.innerHTML = s.say; narr.append(say);
      narr.className = 'caption' + (s.tone ? ' ' + s.tone : '');
      codeHost.innerHTML = ''; codeHost.style.display = s.code ? '' : 'none';
      if (s.code) codeHost.append(el('pre', { html: IA.highlight(s.code, s.lang || 'ts') }));
      bStep.disabled = i >= steps.length - 1;
    }
    function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; steps = cfg.steps(mode); k = 0; show(0); }
    function step() { if (k >= steps.length - 1) return false; show(++k); return true; }
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= steps.length - 1) reset();
      if (reduced) { k = steps.length - 1; show(k); return; }
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && step()) await sleep(cfg.speed || 2600);
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    reset();
  }
  function bindSteps() {
    const S = [
      ['{{ msg }}', 'Text interpolation. The expression is evaluated and inserted as <b>text</b> (HTML is escaped, so it is XSS-safe).', 'text'],
      [':href="url"', '<code>v-bind</code> (short <code>:</code>) binds an <b>attribute or prop</b> to an expression. Without the colon it would be the literal string <code>"url"</code>.', 'attr'],
      ['@click="save"', '<code>v-on</code> (short <code>@</code>) attaches an <b>event listener</b>. <code>@click.prevent</code> adds <code>preventDefault()</code>.', 'ev'],
      ['state changes', 'Change <code>msg</code> or <code>url</code> in script: the text and the attribute update automatically. The click does not re-attach; listeners stay.', 'all']
    ];
    return S.map(([lab, say, k], i) => ({
      say, lang: 'text',
      code: '<p>{{ msg }}</p>\n<a :href="url">docs</a>\n<button @click="save">Save</button>',
      draw(g) {
        T(g, 30, 30, 'Template', { b: true }); T(g, 430, 30, 'Rendered DOM', { b: true });
        const rows = [['<p>{{ msg }}</p>', '<p>Hello</p>', 'text'], ['<a :href="url">', '<a href="/docs">', 'attr'], ['<button @click="save">', '<button> + listener', 'ev']];
        rows.forEach(([a, b, kk], j) => {
          const on = k === kk || k === 'all';
          B(g, 30, 50 + j * 70, 300, 48, a, { mono: true, hot: on, fs: 12 });
          B(g, 430, 50 + j * 70, 300, 48, k === 'all' && kk === 'text' ? '<p>Hi again</p>' : k === 'all' && kk === 'attr' ? '<a href="/v2/docs">' : b, { mono: true, ok: on, fs: 12 });
          A(g, 330, 74 + j * 70, 428, 74 + j * 70, { hot: on });
        });
        T(g, 380, 268, lab, { a: 'middle', mono: true, c: 'var(--accent)' });
      }
    }));
  }
  function ifSteps() {
    const S = [
      [true, 'Both start visible. <code>v-if</code> and <code>v-show</code> render the same DOM when the condition is true.'],
      [false, 'Set <code>open = false</code>. <code>v-if</code> <b>removes</b> the element (and unmounts any child component, destroying its state). <code>v-show</code> keeps it and sets <code>display: none</code>.'],
      [true, 'Back to <code>true</code>. <code>v-if</code> creates the element <b>again from scratch</b> (child state reset, <code>onMounted</code> runs again). <code>v-show</code> just flips CSS: cheap.'],
      [true, 'Rule of thumb: <code>v-show</code> for things toggled often (tabs, dropdowns); <code>v-if</code> for things rarely shown or expensive to render. <code>v-show</code> has no <code>v-else</code> and does not work on <code>&lt;template&gt;</code>.']
    ];
    return S.map(([open, say], i) => ({
      say, lang: 'text', code: `<Panel v-if="open" />    <!-- open = ${open} -->\n<Panel v-show="open" />`,
      draw(g) {
        T(g, 190, 30, 'v-if', { a: 'middle', b: true, mono: true }); T(g, 570, 30, 'v-show', { a: 'middle', b: true, mono: true });
        B(g, 40, 50, 300, 200, null); B(g, 420, 50, 300, 200, null);
        T(g, 60, 80, '<div class="page">', { mono: true, fs: 12 }); T(g, 440, 80, '<div class="page">', { mono: true, fs: 12 });
        if (open) B(g, 80, 100, 220, 60, i === 2 ? '<Panel> (new instance)\ncount = 0' : '<Panel>\ncount = 3', { mono: true, hot: i === 2, fs: 12 });
        else B(g, 80, 100, 220, 60, '<!--v-if-->\n(removed from DOM)', { mono: true, err: true, dash: true, fs: 12 });
        B(g, 460, 100, 220, 60, open ? '<Panel>\ncount = 3' : '<Panel style="display:none">\ncount = 3 (kept)', { mono: true, warn: !open, fs: 12 });
        T(g, 60, 190, '</div>', { mono: true, fs: 12 }); T(g, 440, 190, '</div>', { mono: true, fs: 12 });
        T(g, 190, 236, open ? (i === 2 ? 'cost: full mount' : 'mounted') : 'cost: unmount', { a: 'middle', fs: 12, c: 'var(--text-3)' });
        T(g, 570, 236, 'cost: one CSS change', { a: 'middle', fs: 12, c: 'var(--text-3)' });
      }
    }));
  }
  function keySteps(mode) {
    const S = [
      [['Ann', 'Bob', 'Cy'], 'A list of rows, each with an <code>&lt;input&gt;</code>. You type “note” into <b>Bob</b>’s input. That text lives in the DOM element, not in your data.', null],
      [['Ann', 'Bob', 'Cy'], 'Now the data becomes <code>[Cy, Ann, Bob]</code> (Cy moved to the top by a sort). Before Vue patches, the DOM still looks like this. Next: what each key strategy does.', 'move']
    ];
    const byIndex = 'With <code>:key="index"</code> (or no key) Vue reuses DOM <b>by position</b>. Labels change, but row 2’s input still holds “note”, so the note now sits next to <b>Ann</b>. A silent bug.';
    const byId = 'With <code>:key="user.id"</code> Vue <b>moves</b> the existing DOM nodes. Bob’s input travels with Bob, so the note stays with the right person.';
    return [...S, [['Cy', 'Ann', 'Bob'], null, 'done']].map(([names, say, ph], i) => ({
      say: ph === 'done' ? (mode === 'id' ? byId : byIndex) : say, lang: 'text',
      code: mode === 'id' ? '<li v-for="u in users" :key="u.id">{{ u.name }} <input /></li>' : '<li v-for="(u, i) in users" :key="i">{{ u.name }} <input /></li>',
      draw(g) {
        T(g, 30, 30, mode === 'id' ? 'key = user.id' : 'key = index', { b: true, mono: true });
        names.forEach((n, j) => {
          const y = 50 + j * 64; const k = mode === 'id' ? n : j;
          B(g, 60, y, 140, 48, n, { b: true, hot: i === 2 });
          T(g, 30, y + 29, String(k), { mono: true, fs: 11, c: 'var(--text-3)' });
          let note;
          if (i === 0) note = n === 'Bob';
          else if (i === 1) note = j === 1; // before patch: DOM unchanged
          else note = mode === 'id' ? n === 'Bob' : j === 1;
          const wrong = i === 2 && note && n !== 'Bob';
          B(g, 220, y, 200, 48, note ? '“note”' : '', { mono: true, err: wrong, ok: i === 2 && note && !wrong });
        });
        if (i === 1) T(g, 460, 120, 'data changed; DOM not patched yet', { fs: 12, c: 'var(--text-3)' });
        if (i === 2) T(g, 460, 120, mode === 'id' ? '✓ nodes moved with their key' : '✗ nodes reused by position', { fs: 13, b: true, c: mode === 'id' ? 'var(--ok)' : 'var(--err)' });
      }
    }));
  }
  mount({ aria: 'Template bindings, conditional rendering and keyed lists', H: 280,
    modes: { label: 'Concept', opts: [['bind', '{{ }} · : · @'], ['if', 'v-if vs v-show'], ['idx', 'v-for, key=index'], ['id', 'v-for, key=id']] },
    steps: (m) => (m === 'bind' ? bindSteps() : m === 'if' ? ifSteps() : keySteps(m)) });
});
