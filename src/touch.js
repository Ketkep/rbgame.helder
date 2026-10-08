// Touch controls: a thumb stick on the left, a look-drag area on the right, and a few buttons.
// Everything feeds the same state the keyboard and mouse do (game.keys, game.yaw/pitch, game.touchMove), so the levels never
// know the difference. Desktop is untouched: this is only created on a touch-only device (or with ?touch for testing).

const STICK_R = 54;          // px of thumb travel for full speed
const DEAD = 0.14;           // dead zone, as a fraction of STICK_R
const LOOK = 0.0046;         // radians per px of drag at sensitivity 1

/** A phone or tablet with no mouse. `?touch` forces it on (for testing on a desktop), `?notouch` forces it off. */
export function detectTouch() {
  const q = new URLSearchParams(location.search);
  if (q.has('touch')) return true;
  if (q.has('notouch')) return false;
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
}

function mk(tag, id, cls, html) {
  const n = document.createElement(tag);
  if (id) n.id = id;
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

export class TouchControls {
  constructor(game) {
    this.g = game;
    game.touchMove = { x: 0, y: 0 };
    this.shown = false;
    this.stickId = null; this.lookId = null;
    this.ox = 0; this.oy = 0;

    const root = (this.root = mk('div', 'touch'));
    const look = mk('div', 't-look');
    const stick = mk('div', 't-stick');
    this.ring = mk('div', 't-ring', '', '<i id="t-knob"></i>');
    stick.appendChild(this.ring);
    this.knob = this.ring.querySelector('#t-knob');
    this.btnJump = mk('button', 't-jump', 't-btn', 'JUMP');
    this.btnReset = mk('button', 't-reset', 't-btn small', '↺');
    this.btnUse = mk('button', 't-use', 't-btn hidden', 'USE');
    this.btnPause = mk('button', 't-pause', 't-btn small', '❚❚');
    this.btnReset.setAttribute('aria-label', 'Respawn at the last checkpoint');
    this.btnPause.setAttribute('aria-label', 'Pause');
    root.append(look, stick, this.btnJump, this.btnReset, this.btnUse, this.btnPause);
    document.getElementById('app').appendChild(root);

    this._bindLook(look);
    this._bindStick(stick);
    this._bindButtons();
    this._retext();
    // block the browser's own gestures (pinch zoom, long-press menu, swipe-to-navigate)
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---- look: drag anywhere on the right ------------------------------------------------------
  _bindLook(el) {
    let lx = 0, ly = 0;
    el.addEventListener('pointerdown', (e) => {
      if (this.lookId !== null) return;
      this.lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      this.look(dx, dy);
      e.preventDefault();
    });
    const end = (e) => { if (e.pointerId === this.lookId) this.lookId = null; };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, end);
  }

  look(dx, dy) {
    const g = this.g;
    if (g.state !== 'playing' || g.frozen) return;
    const s = LOOK * g.sens;
    g.yaw -= dx * s * (g.mods.invertX ? -1 : 1);
    g.pitch -= dy * s * (g.mods.invertY ? -1 : 1);
    g.pitch = Math.max(-1.5, Math.min(1.5, g.pitch));
    g.idleT = 0;
  }

  // ---- stick: floating, appears wherever the left thumb lands ----------------------------------
  _bindStick(el) {
    el.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      this.stickId = e.pointerId; this.ox = e.clientX; this.oy = e.clientY;
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      this.ring.classList.add('on');
      this._ringAt(this.ox, this.oy, el);
      this._stick(e.clientX, e.clientY);
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      this._stick(e.clientX, e.clientY);
      e.preventDefault();
    });
    const end = (e) => { if (e.pointerId === this.stickId) this._stickRelease(); };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, end);
  }

  _ringAt(x, y, zone) {
    const r = zone.getBoundingClientRect();
    this.ring.style.left = (x - r.left) + 'px'; this.ring.style.top = (y - r.top) + 'px';
    this.ring.style.right = 'auto'; this.ring.style.bottom = 'auto';
  }

  _stick(x, y) {
    let dx = x - this.ox, dy = y - this.oy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) {                      // the stick follows the thumb, so you never run off its edge
      const f = (len - STICK_R) / len;
      this.ox += dx * f; this.oy += dy * f;
      dx = x - this.ox; dy = y - this.oy;
      this._ringAt(this.ox, this.oy, this.ring.parentElement);
    }
    const l = Math.min(1, Math.hypot(dx, dy) / STICK_R);
    const m = l < DEAD ? 0 : (l - DEAD) / (1 - DEAD);
    const n = Math.hypot(dx, dy) || 1;
    this.g.touchMove.x = (dx / n) * m;
    this.g.touchMove.y = (-dy / n) * m;
    this.knob.style.transform = `translate(${dx / n * l * STICK_R}px, ${dy / n * l * STICK_R}px)`;
  }

  _stickRelease() {
    this.stickId = null;
    this.g.touchMove.x = 0; this.g.touchMove.y = 0;
    this.ring.classList.remove('on');
    this.ring.style.left = ''; this.ring.style.top = ''; this.ring.style.right = ''; this.ring.style.bottom = '';
    this.knob.style.transform = '';
  }

  // ---- buttons ------------------------------------------------------------------------------------
  _hold(btn, down, up) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      btn.classList.add('on'); down();
    });
    const rel = () => { if (btn.classList.contains('on')) { btn.classList.remove('on'); up(); } };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, rel);
  }

  _bindButtons() {
    const g = this.g;
    this._hold(this.btnJump,
      () => { g.audio.init(); g.keys.add('Space'); g.jumpEdge = true; g.idleT = 0; g.ui.markKey('Space', true); },
      () => { g.keys.delete('Space'); g.ui.markKey('Space', false); });
    this._hold(this.btnReset, () => g.manualReset(), () => {});
    this._hold(this.btnUse, () => g.useFocus(), () => {});
    this._hold(this.btnPause, () => g.pause(), () => {});
  }

  /** Swap the keyboard wording in the shared HUD for touch wording. */
  _retext() {
    const g = this.g, el = g.ui.el;
    const k = document.querySelector('#interact kbd'); if (k) k.textContent = 'USE';
    const offer = el['baby-offer'];
    if (offer) {
      offer.innerHTML = '<b>TAP</b> to accept Baby Mode <small>or keep suffering</small>';
      offer.addEventListener('pointerdown', (e) => { e.preventDefault(); g.acceptBaby(); });
    }
    const keys = document.querySelector('.home .keys');
    if (keys) keys.innerHTML = '<span>Left thumb: <b>move</b></span><span>Right thumb: <b>look</b></span><span><b>JUMP</b>: tap for a hop, hold for the full jump</span><span><b>❚❚</b> pause · <b>↺</b> respawn</span>';
    const foot = document.querySelector('.home-foot span');
    if (foot) foot.textContent = 'A Helder Labs game · touch controls (beta, The Tutorial) · best on a computer · contains falling, lying, and brief flashing glitch effects';
    const sens = el['set-sens']?.parentElement;
    if (sens && sens.firstChild && sens.firstChild.nodeType === 3) sens.firstChild.textContent = 'Look sensitivity ';
    document.querySelector('#scr-settings .hint')?.classList.add('hidden');
  }

  /** Called every frame: show the controls only while a run is on, and let go of everything when it is not. */
  sync() {
    const g = this.g;
    const show = (g.state === 'playing' || g.state === 'dead') && !g.ui.anyScreen;
    if (show !== this.shown) {
      this.shown = show;
      this.root.classList.toggle('show', show);
      if (!show) this.reset();
    }
    if (!show) return;
    const useOn = !!g.focus && !g.modal;
    if (useOn === this.btnUse.classList.contains('hidden')) this.btnUse.classList.toggle('hidden', !useOn);
  }

  reset() {
    this.lookId = null;
    this._stickRelease();
    if (this.g.keys.has('Space')) { this.g.keys.delete('Space'); this.g.ui.markKey('Space', false); }
    for (const b of [this.btnJump, this.btnReset, this.btnUse, this.btnPause]) b.classList.remove('on');
  }

  /** Full screen + landscape where the browser allows it (Android Chrome). iPhones cannot, which is what "Add to Home Screen" is for. */
  immersive() {
    const d = document.documentElement;
    if (document.fullscreenElement || !d.requestFullscreen) return;
    d.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock?.('landscape').catch(() => {}))
      .catch(() => {});
  }
}
