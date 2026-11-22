/* Global "All tracks" + search widget.
   Injected into every page of the deployed site by tools/site/build.cjs.
   Everything renders inside a Shadow DOM, so it never touches a track's own CSS. */
(function () {
  if (window.__cbGlobalNav) return; window.__cbGlobalNav = true;
  var SCRIPT = document.currentScript;
  var ROOT = new URL('../', SCRIPT.src).href;            // site root (…/cb-int/)
  var INDEX_URL = new URL('search-index.json', SCRIPT.src).href;
  var TRACKS = {
    'sql-atlas': 'SQL & Postgres', 'cb-ml': 'AI/ML & GenAI', 'cb-ml-transformers': 'Transformers',
    'cb-sys-design': 'System Design', 'dsa-interview': 'DSA'
  };
  var here = location.href.split('#')[0].split('?')[0];
  var onHome = here === ROOT || here === ROOT + 'index.html';
  var rel = here.indexOf(ROOT) === 0 ? here.slice(ROOT.length) : '';
  var currentTrack = rel.split('/')[0];
  // System Design already owns Ctrl/Cmd+K and "/" for its own search; leave those to it there.
  var ownsK = currentTrack !== 'cb-sys-design';
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');

  function isDark() {
    function lum(c) { var m = (c || '').match(/\d+(\.\d+)?/g); if (!m || (m.length > 3 && +m[3] === 0)) return null; return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255; }
    var l = lum(getComputedStyle(document.body).backgroundColor);
    if (l === null) l = lum(getComputedStyle(document.documentElement).backgroundColor);
    if (l === null) return matchMedia('(prefers-color-scheme: dark)').matches;
    return l < 0.5;
  }

  var CSS = '\
:host{all:initial}\
*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif}\
.wrap{--bg:#fff;--ink:#14171f;--mute:#5b6372;--line:#dfe3ec;--hi:#eef0ff;--accent:#4f46e5;--mark:#fde68a;--markink:#14171f;--shadow:0 6px 24px rgba(15,20,40,.16)}\
.wrap.dark{--bg:#161b26;--ink:#e8ebf2;--mute:#9aa3b5;--line:#2a3242;--hi:#232a3b;--accent:#8b85ff;--mark:#5b4b12;--markink:#fff3c4;--shadow:0 6px 24px rgba(0,0,0,.5)}\
.pill{position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:999px;box-shadow:var(--shadow);overflow:hidden}\
.pill a,.pill button{all:unset;cursor:pointer;display:flex;align-items:center;gap:6px;padding:9px 14px;font-size:13px;font-weight:600;color:var(--ink)}\
.pill a:hover,.pill button:hover,.pill a:focus-visible,.pill button:focus-visible{background:var(--hi)}\
.pill .sep{width:1px;background:var(--line)}\
.kbd{font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--mute);border:1px solid var(--line);border-radius:5px;padding:1px 5px}\
@media (max-width:640px){.pill .lbl,.pill .kbd{display:none}.pill a,.pill button{padding:11px 14px;font-size:16px}}\
.back{position:fixed;inset:0;z-index:2147483001;background:rgba(8,10,20,.5);display:flex;justify-content:center;align-items:flex-start;padding:8vh 16px 16px}\
.back[hidden]{display:none}\
.dlg{width:min(720px,100%);max-height:84vh;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);overflow:hidden}\
.top{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line)}\
.top input{all:unset;flex:1;font-size:17px;color:var(--ink);min-width:0}\
.top input::placeholder{color:var(--mute)}\
.top button{all:unset;cursor:pointer;color:var(--mute);font-size:13px;padding:4px 8px;border:1px solid var(--line);border-radius:6px}\
.chips{display:flex;gap:6px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--line)}\
.chip{all:unset;cursor:pointer;font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--line);color:var(--mute)}\
.chip.on{background:var(--accent);border-color:var(--accent);color:#fff}\
.res{overflow:auto;padding:6px}\
.r{display:block;text-decoration:none;color:var(--ink);padding:10px 12px;border-radius:10px}\
.r.sel,.r:hover{background:var(--hi)}\
.rt{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}\
.tt{font-weight:650;font-size:15px}\
.tk{font-size:11px;color:var(--accent);border:1px solid var(--line);border-radius:999px;padding:1px 8px;white-space:nowrap}\
.hd{font-size:13px;color:var(--mute);margin-top:2px}\
.sn{font-size:13px;color:var(--mute);margin-top:4px;line-height:1.45}\
mark{background:var(--mark);color:var(--markink);border-radius:3px;padding:0 1px}\
.msg{padding:22px 14px;color:var(--mute);font-size:14px;text-align:center}\
.foot{padding:8px 14px;border-top:1px solid var(--line);font-size:12px;color:var(--mute);display:flex;gap:14px;flex-wrap:wrap}';

  var host = document.createElement('div');
  host.id = 'cb-global-nav';
  var shadow = host.attachShadow({ mode: 'open' });
  var hint = (isMac ? '⌘' : 'Ctrl ') + 'K';
  shadow.innerHTML = '<style>' + CSS + '</style><div class="wrap">' +
    '<div class="pill" role="navigation" aria-label="All tracks">' +
      (onHome ? '' : '<a href="' + ROOT + '" title="All tracks"><span aria-hidden="true">⌂</span><span class="lbl">All tracks</span></a><span class="sep"></span>') +
      '<button type="button" class="open" title="Search all tracks"><span aria-hidden="true">⌕</span><span class="lbl">Search</span>' + (ownsK ? '<span class="kbd">' + hint + '</span>' : '') + '</button>' +
    '</div>' +
    '<div class="back" hidden><div class="dlg" role="dialog" aria-modal="true" aria-label="Search all tracks">' +
      '<div class="top"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search every track…" autocomplete="off" spellcheck="false" aria-label="Search all tracks"><button type="button" class="x">Esc</button></div>' +
      '<div class="chips"></div><div class="res" role="listbox"></div>' +
      '<div class="foot"><span>↑ ↓ to move</span><span>Enter to open</span><span>Esc to close</span></div>' +
    '</div></div></div>';

  var $ = function (s) { return shadow.querySelector(s); };
  var wrap = $('.wrap'), back = $('.back'), input = $('input'), res = $('.res'), chips = $('.chips');
  var data = null, loading = null, filter = '', sel = 0, items = [], lastFocus = null;

  var chipDefs = [['', 'All']].concat(Object.keys(TRACKS).map(function (k) { return [k, TRACKS[k]]; }));
  chips.innerHTML = chipDefs.map(function (c) { return '<button type="button" class="chip' + (c[0] === '' ? ' on' : '') + '" data-k="' + c[0] + '">' + c[1] + '</button>'; }).join('');
  chips.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    filter = b.getAttribute('data-k');
    chips.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c === b); });
    run(); input.focus();
  });

  function load() {
    if (data) return Promise.resolve(data);
    if (!loading) loading = fetch(INDEX_URL).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      data = j.pages.map(function (p) {
        return { u: p.u, t: p.t, k: p.k, h: p.h, x: p.x, tl: p.t.toLowerCase(), hl: p.h.map(function (h) { return h[0].toLowerCase(); }), xl: p.x.toLowerCase() };
      });
      return data;
    }).catch(function (e) { loading = null; throw e; });
    return loading;
  }

  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function hilite(s, toks) {
    var out = esc(s);
    if (!toks.length) return out;
    var re = new RegExp('(' + toks.map(function (t) { return reEsc(esc(t)); }).sort(function (a, b) { return b.length - a.length; }).join('|') + ')', 'gi');
    return out.replace(re, '<mark>$1</mark>');
  }
  function count(hay, needle, cap) { var n = 0, i = 0; while (n < cap && (i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; } return n; }

  function search(q) {
    var phrase = q.trim().toLowerCase();
    var toks = phrase.split(/\s+/).filter(Boolean);
    if (!toks.length) return { toks: toks, list: [] };
    var list = [];
    data.forEach(function (p) {
      if (filter && p.k !== filter) return;
      var score = 0;
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i], s = 0;
        if (p.tl.indexOf(t) !== -1) s += 15;
        for (var j = 0; j < p.hl.length; j++) if (p.hl[j].indexOf(t) !== -1) { s += 6; break; }
        var c = count(p.xl, t, 20);
        if (c) s += 2 + c / 2;                // pages that keep coming back to a word rank higher
        if (!s) return;                       // every word must match somewhere
        score += s;
      }
      if (toks.length > 1) {                  // the exact phrase beats scattered words
        if (p.tl.indexOf(phrase) !== -1) score += 40;
        for (var g = 0; g < p.hl.length; g++) if (p.hl[g].indexOf(phrase) !== -1) { score += 20; break; }
        score += 3 * count(p.xl, phrase, 10);
      }
      // best section heading: the one matching the most words
      var best = -1, bestN = 0;
      for (var h = 0; h < p.hl.length; h++) {
        var n = 0; for (var k = 0; k < toks.length; k++) if (p.hl[h].indexOf(toks[k]) !== -1) n++;
        if (n > bestN) { bestN = n; best = h; }
      }
      list.push({ p: p, score: score, h: best });
    });
    list.sort(function (a, b) { return b.score - a.score; });
    return { toks: toks, list: list.slice(0, 40), total: list.length };
  }

  function snippet(p, toks) {
    var at = -1, phrase = toks.join(' ');
    at = p.xl.indexOf(phrase);
    if (at === -1) { var longest = toks.slice().sort(function (a, b) { return b.length - a.length; })[0]; at = p.xl.indexOf(longest); }
    if (at === -1) return p.x.slice(0, 150);
    var s = Math.max(0, at - 70), e = Math.min(p.x.length, at + 130);
    return (s > 0 ? '…' : '') + p.x.slice(s, e).trim() + (e < p.x.length ? '…' : '');
  }

  function run() {
    if (!data) return;
    var q = input.value, r = search(q);
    sel = 0;
    if (!q.trim()) { items = []; res.innerHTML = '<div class="msg">Search ' + data.length + ' pages across all five tracks.</div>'; return; }
    if (!r.list.length) { items = []; res.innerHTML = '<div class="msg">No matches for “' + esc(q.trim()) + '”.</div>'; return; }
    res.innerHTML = r.list.map(function (m, i) {
      var p = m.p, h = m.h >= 0 ? p.h[m.h] : null;
      if (h && h[0].toLowerCase() === p.tl) h = null;   // the page title itself: just open the page
      // jump to the section: its id if it has one, otherwise a text fragment (#:~:text=)
      var href = ROOT + p.u + (h ? (h[1] ? '#' + encodeURIComponent(h[1]) : '#:~:text=' + encodeURIComponent(h[0]).replace(/-/g, '%2D')) : '');
      return '<a class="r' + (i === 0 ? ' sel' : '') + '" role="option" href="' + esc(href) + '">' +
        '<div class="rt"><span class="tt">' + hilite(p.t, r.toks) + '</span><span class="tk">' + esc(TRACKS[p.k] || p.k) + '</span></div>' +
        (h ? '<div class="hd">› ' + hilite(h[0], r.toks) + '</div>' : '') +
        '<div class="sn">' + hilite(snippet(p, r.toks), r.toks) + '</div></a>';
    }).join('') + (r.total > r.list.length ? '<div class="msg">Showing the top ' + r.list.length + ' of ' + r.total + '. Add a word to narrow it down.</div>' : '');
    items = Array.prototype.slice.call(res.querySelectorAll('.r'));
  }
  function move(d) {
    if (!items.length) return;
    items[sel].classList.remove('sel');
    sel = (sel + d + items.length) % items.length;
    items[sel].classList.add('sel');
    items[sel].scrollIntoView({ block: 'nearest' });
  }

  function open() {
    if (!back.hidden) return;
    lastFocus = document.activeElement;
    wrap.classList.toggle('dark', isDark());
    back.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    input.focus(); input.select();
    if (!data) res.innerHTML = '<div class="msg">Loading the search index…</div>';
    load().then(run, function () { res.innerHTML = '<div class="msg">The search index could not be loaded.</div>'; });
  }
  function close() {
    if (back.hidden) return;
    back.hidden = true;
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  var t = null;
  input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(run, 60); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); var a = items[sel]; close(); location.href = a.href; }
  });
  shadow.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  back.addEventListener('click', function (e) { if (e.target === back) close(); });
  res.addEventListener('click', function () { close(); });   // same-page #anchors still need the dialog closed
  $('.x').addEventListener('click', close);
  $('.open').addEventListener('click', open);
  document.addEventListener('keydown', function (e) {
    if (ownsK && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault(); back.hidden ? open() : close();
    }
  });
  document.addEventListener('cb:search', open);              // the landing page's search box
  window.CBGlobalSearch = { open: open, close: close };

  (document.body || document.documentElement).appendChild(host);

  // Match the page's light/dark look, and follow the track's own theme toggle.
  function syncTheme() { wrap.classList.toggle('dark', isDark()); }
  syncTheme();
  var mo = new MutationObserver(function () { requestAnimationFrame(syncTheme); });
  [document.documentElement, document.body].forEach(function (n) { mo.observe(n, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] }); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);
})();
