// A modal keypad: type digits, Enter to submit, Backspace to delete, E / Esc to step away.
// While it is open the game ignores movement keys (game.modal). Mouse buttons work too once the cursor is free.

export function openKeypad(game, { title = 'KEYPAD', digits = 4, onSubmit, info = null }) {
  const el = game.ui.el;
  let code = '', lockTimer = null, locked = false, closed = false;
  const body = el['panel-body'];
  el['panel-title'].textContent = title;
  body.innerHTML = '<div class="kp-display"></div><div class="kp-msg"></div><div class="kp-pad"></div>' + (info ? '<div class="kp-info"></div>' : '');
  if (info) body.querySelector('.kp-info').textContent = typeof info === 'function' ? info() : info;
  el['panel-foot'].innerHTML = '<kbd>0–9</kbd> type &nbsp; <kbd>Enter</kbd> submit &nbsp; <kbd>⌫</kbd> delete &nbsp; <kbd>E</kbd> leave';
  const disp = body.querySelector('.kp-display'), msg = body.querySelector('.kp-msg'), pad = body.querySelector('.kp-pad');
  const render = () => {
    disp.innerHTML = '';
    for (let i = 0; i < digits; i++) {
      const d = document.createElement('div'); d.className = 'kp-digit' + (i < code.length ? '' : ' empty'); d.textContent = i < code.length ? code[i] : '·'; disp.appendChild(d);
    }
  };
  const setMsg = (text, kind = '') => { msg.textContent = text || ''; msg.className = 'kp-msg ' + kind; };
  const api = {
    setMsg,
    get code() { return code; },
    clear() { code = ''; render(); },
    close() { close(); },
    lockout(sec) {
      locked = true; let left = Math.ceil(sec);
      setMsg(`LOCKED · ${left}s`, 'bad');
      lockTimer = setInterval(() => { left--; if (left <= 0) { clearInterval(lockTimer); locked = false; setMsg(''); } else setMsg(`LOCKED · ${left}s`, 'bad'); }, 1000);
    },
  };
  const add = (d) => { if (locked || code.length >= digits) return; code += d; game.audio.click(); setMsg(''); render(); };
  const del = () => { if (locked) return; code = code.slice(0, -1); render(); };
  const submit = () => {
    if (locked) return;
    if (code.length < digits) { setMsg(`${digits} digits, please`, 'bad'); return; }
    onSubmit(code, api);
  };
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '↵']) {
    const b = document.createElement('button'); b.textContent = k;
    b.addEventListener('click', () => (k === '⌫' ? del() : k === '↵' ? submit() : add(k)));
    pad.appendChild(b);
  }
  function close() {
    if (closed) return; closed = true;
    clearInterval(lockTimer);
    el.panel.classList.add('hidden');
    if (game.modal === modal) game.modal = null;
  }
  const modal = {
    key(e) {
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
      if (m) add(m[1]);
      else if (e.code === 'Backspace') del();
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') submit();
      else if (e.code === 'KeyE' || e.code === 'KeyQ' || e.code === 'Escape') close();
    },
    close,
  };
  render(); setMsg('');
  game.keys.clear();
  game.modal = modal;
  el.panel.classList.remove('hidden');
  return api;
}
