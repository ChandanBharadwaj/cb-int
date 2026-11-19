/* Beginner intro: the bouncer checks a guest list. EXISTS stops at the first hit; NOT IN chokes on a smudged (NULL) entry. */
IA.widget('semi-anti-joins-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const LIST = ['Asha', 'Ben', 'Asha', null];
  const trs = LIST.map((n, i) => el('tr', null, el('td', { text: String(i + 1) }), el('td', { class: n == null ? 'null' : '', text: n == null ? 'NULL (smudged)' : n })));
  const verdict = el('div', { class: 'w-stat', style: { fontSize: '14px', textAlign: 'center' }, text: '…' });
  const who = el('div', { style: { fontFamily: 'var(--mono)', fontSize: '15px', fontWeight: '700', textAlign: 'center' }, text: '?' });
  const list = el('div', { class: 'mt' }, el('h5', { text: 'orders.customer (the list)' }), el('table', null, el('thead', null, el('tr', null, el('th', { text: '#' }), el('th', { text: 'name' }))), el('tbody', null, trs)));
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press “Show me”: three questions at the door.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(el('div', { class: 'mini-tables' }, el('div', { class: 'mt' }, el('h5', { text: 'at the door' }), who, verdict), el('span', { class: 'mini-arrow', text: '⇄' }), list),
    el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  let gen = 0;
  const T = (ms) => sleep(reduced ? 500 : ms);
  const say = (t) => { cap.firstChild.textContent = t; };
  const clear = () => trs.forEach((t) => { t.classList.remove('hl'); t.style.opacity = ''; });
  btn.addEventListener('click', async () => {
    const g = ++gen;
    const runs = [
      { q: 'Asha: EXISTS?', who: 'Asha', test: (n) => n === 'Asha', stopOnHit: true },
      { q: 'Chen: NOT EXISTS?', who: 'Chen', test: (n) => n === 'Chen', stopOnHit: true, neg: true },
      { q: 'Chen: NOT IN?', who: 'Chen', notIn: true }
    ];
    for (const r of runs) {
      clear(); who.textContent = r.q; verdict.textContent = '…'; say(`${r.q} Read the list top to bottom.`);
      await T(1800); if (g !== gen) return;
      let hit = false; let unk = false;
      for (let i = 0; i < LIST.length; i++) {
        trs[i].classList.add('hl'); const n = LIST[i];
        if (r.notIn) { if (n == null) { unk = true; say(`Is Chen ≠ ${'NULL'}? Can’t tell: UNKNOWN.`); } else say(`Is Chen ≠ ${n}? Yes.`); }
        else if (r.test(n)) { hit = true; say(`Row ${i + 1} is ${n}. Found! Stop reading: the rest of the list is skipped.`); }
        else say(n == null ? `Row ${i + 1} is unreadable. It can’t be a match.` : `Row ${i + 1} is ${n}. Not a match, keep reading.`);
        await T(1700); if (g !== gen) return;
        trs[i].classList.remove('hl');
        if (hit) { for (let j = i + 1; j < LIST.length; j++) trs[j].style.opacity = '.3'; break; }
      }
      if (r.notIn) { verdict.textContent = '? unknown → turned away'; say('“Not on the list” is only true if every check says yes. One UNKNOWN spoils it, so Chen is turned away even though he never ordered. That is the NOT IN trap.'); }
      else if (r.neg) { verdict.textContent = hit ? '✗ out' : '✓ in'; say('Nobody on the list is Chen, and the smudged line can’t match. NOT EXISTS keeps him.'); }
      else { verdict.textContent = hit ? '✓ in (once)' : '✗ out'; say('Asha is let in once, even though she is on the list twice. That’s a semi join.'); }
      await T(3200); if (g !== gen) return;
    }
    clear(); who.textContent = 'Done'; verdict.textContent = 'Use NOT EXISTS'; say('EXISTS stops at the first hit. NOT EXISTS is NULL-safe. NOT IN breaks on a single NULL.');
  });
});
