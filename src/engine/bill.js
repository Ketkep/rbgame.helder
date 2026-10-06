// A bill you cannot argue with: itemised lines, a total, and tip buttons that start at 18%.
// Keys: 1/2/3 pick a tip, Enter pays, E leaves. (No tip is not on the menu.)

const money = (n) => '$' + n.toFixed(2);

export function openBill(game, { title = 'YOUR BILL', lines = [], tips = [18, 20, 25], onPay, strings = {} }) {
  const el = game.ui.el;
  let pick = -1, closed = false;
  const subtotal = lines.reduce((a, [, v]) => a + v, 0);
  const body = el['panel-body'];
  el['panel-title'].textContent = title;
  body.innerHTML = '<div class="bill-lines"></div><div class="bill-tips"></div><div class="kp-msg"></div>';
  el['panel-foot'].innerHTML = '<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> tip &nbsp; <kbd>Enter</kbd> pay &nbsp; <kbd>E</kbd> leave';
  const L = body.querySelector('.bill-lines'), TIP = body.querySelector('.bill-tips'), msg = body.querySelector('.kp-msg');
  const row = (a, b, cls = '') => { const r = document.createElement('div'); r.className = 'bill-row ' + cls; r.innerHTML = `<span></span><b></b>`; r.children[0].textContent = a; r.children[1].textContent = b; L.appendChild(r); return r; };
  for (const [a, v] of lines) row(a, v < 0 ? '−' + money(-v) : money(v));
  row('Subtotal', money(subtotal), 'bill-sub');
  const tipRow = row('Tip (required)', '—');
  const totalRow = row('TOTAL DUE', money(subtotal), 'bill-total');
  const setMsg = (t, kind = '') => { msg.textContent = t || ''; msg.className = 'kp-msg ' + kind; };
  const total = () => subtotal * (1 + (pick >= 0 ? tips[pick] / 100 : 0));
  const render = () => {
    TIP.innerHTML = '';
    tips.forEach((p, i) => { const b = document.createElement('button'); b.className = 'bill-tip' + (i === pick ? ' on' : ''); b.textContent = `${i + 1} · ${p}%`; b.addEventListener('click', () => choose(i)); TIP.appendChild(b); });
    tipRow.children[1].textContent = pick >= 0 ? money(subtotal * tips[pick] / 100) : '—';
    totalRow.children[1].textContent = money(total());
  };
  const choose = (i) => { pick = i; game.audio.click(); setMsg(''); render(); };
  const pay = () => {
    if (pick < 0) { game.audio.buzzer(); setMsg(strings.noTip || 'Please select a tip.', 'bad'); return; }
    game.audio.confirm(); setMsg(strings.paid || 'Paid. Thank you!', 'good');
    setTimeout(() => { close(); onPay?.(pick, total()); }, 700);
  };
  function close() { if (closed) return; closed = true; el.panel.classList.add('hidden'); if (game.modal === modal) game.modal = null; }
  const modal = {
    key(e) {
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
      if (m) { const n = +m[1]; if (n >= 1 && n <= tips.length) choose(n - 1); else if (n === 0) { game.audio.buzzer(); setMsg(strings.zero || 'A tip of zero is not a tip. It is a lifestyle choice.', 'bad'); } }
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') pay();
      else if (e.code === 'KeyE' || e.code === 'KeyQ' || e.code === 'Escape') close();
    },
    close,
  };
  render(); setMsg('');
  game.keys.clear(); game.modal = modal;
  el.panel.classList.remove('hidden');
  return { choose, pay, close, get total() { return total(); }, get subtotal() { return subtotal; } };
}
