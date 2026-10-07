/** All DOM-side presentation: HUD, subtitles, menus and the fourth-wall gags. */
const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'lvl-chip', 'deaths', 'deaths-n', 'baby-badge', 'timer', 'ping', 'ping-n', 'altimeter', 'alt-fill', 'alt-rec', 'alt-n',
      'prompt', 'interact', 'interact-label', 'hint-chip', 'hint-label', 'panel', 'panel-title', 'panel-body', 'panel-foot', 'toasts', 'achievements', 'baby-offer', 'stamp', 'subs', 'sub-shown', 'sub-rest', 'flash', 'fade', 'ov-loading', 'ld-fill', 'ld-tip',
      'ov-ad', 'ad-sec', 'ov-bars', 'ov-credits', 'credits-roll', 'ov-glitch', 'pause-quip', 'btn-resume', 'btn-restart', 'btn-mercy', 'btn-quit',
      'campaigns', 'home-tag', 'home-stats', 'btn-settings-home', 'btn-settings', 'btn-settings-back', 'btn-levels-back', 'btn-reset', 'levels-grid', 'levels-eyebrow', 'levels-title', 'btn-home', 'btn-lobby', 'btn-lobby-pause', 'end-eyebrow', 'end-next', 'btn-next', 'btn-share', 'btn-again', 'set-sens', 'set-vol', 'set-music', 'set-gfx',
      'bd-cut', 'cmp-eyebrow', 'cmp-title', 'cmp-deaths', 'cmp-time', 'cmp-total', 'cmp-quip', 'end-title', 'end-deaths', 'end-time', 'end-baby', 'end-share']) {
      this.el[id] = $(id);
    }
    this.screens = {
      home: $('scr-home'), levels: $('scr-levels'), settings: $('scr-settings'), pause: $('scr-pause'), click: $('scr-click'), complete: $('scr-complete'), end: $('scr-end'),
    };
    this._subHideT = null;
    this._creditsY = 0; this._creditsSpeed = 0; this._creditsOn = false;
  }

  // ---- screens ---------------------------------------------------------------------------
  showScreen(name) {
    for (const [k, s] of Object.entries(this.screens)) s.classList.toggle('show', k === name);
  }
  hideScreens() { for (const s of Object.values(this.screens)) s.classList.remove('show'); }
  get anyScreen() { return Object.values(this.screens).some((s) => s.classList.contains('show')); }

  // ---- HUD -------------------------------------------------------------------------------
  hud(on) { this.el.hud.classList.toggle('hidden', !on); }
  setLevelChip(text) { this.el['lvl-chip'].textContent = text; }
  setDeaths(text, bump = false) {
    this.el['deaths-n'].textContent = text;
    if (bump) { const d = this.el.deaths; d.classList.remove('bump'); void d.offsetWidth; d.classList.add('bump'); }
  }
  setTimer(sec) {
    const m = Math.floor(sec / 60), s = sec - m * 60;
    this.el.timer.textContent = `${m}:${s.toFixed(1).padStart(4, '0')}`;
  }
  /** Shows "[E] label" under the crosshair (null hides it). */
  setInteract(label) {
    const el = this.el.interact;
    if (!label) { el.classList.add('hidden'); this._interactShown = null; return; }
    if (this._interactShown !== label) { this.el['interact-label'].textContent = label; this._interactShown = label; }
    el.classList.remove('hidden');
  }
  /** In a hub (no deaths/timer) hide those counters. */
  setHubMode(on) { this.el.hud.classList.toggle('hubmode', !!on); }
  setBaby(on) { this.el['baby-badge'].classList.toggle('hidden', !on); }
  babyOffer(on) { this.el['baby-offer'].classList.toggle('hidden', !on); }
  setAltimeter(on, y = 0, max = 50, rec = 0) {
    this.el.altimeter.classList.toggle('hidden', !on);
    if (!on) return;
    const k = (v) => Math.max(0, Math.min(100, (v / max) * 100));
    this.el['alt-fill'].style.height = k(y) + '%';
    this.el['alt-rec'].style.bottom = k(rec) + '%';
    this.el['alt-n'].textContent = Math.max(0, Math.round(y));
  }
  setPing(on, ms = 24, bad = false) {
    this.el.ping.classList.toggle('hidden', !on);
    this.el.ping.classList.toggle('bad', bad);
    this.el['ping-n'].textContent = Math.round(ms);
  }

  toast(text, kind = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind; t.textContent = text;
    this.el.toasts.appendChild(t);
    setTimeout(() => t.remove(), 3200);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
  }
  achievement(title, desc = '') {
    const a = document.createElement('div');
    a.className = 'ach';
    a.innerHTML = `<div style="font-size:26px">🏆</div><div><b></b><span></span></div>`;
    a.querySelector('b').textContent = 'Achievement unlocked: ' + title;
    a.querySelector('span').textContent = desc;
    this.el.achievements.appendChild(a);
    setTimeout(() => a.remove(), 4000);
  }
  stamp(text) {
    const s = this.el.stamp;
    s.textContent = text; s.classList.remove('go'); void s.offsetWidth; s.classList.add('go');
  }
  flash() { const f = this.el.flash; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  /** A burst of TV static: the home page's backdrop cuts between channels behind it. */
  cutFlash(on, ms = 160) {
    const f = this.el['bd-cut']; if (!f) return;
    f.style.transition = `opacity ${ms}ms`;
    f.classList.toggle('on', !!on);
  }
  fade(on, ms = 350) { const f = this.el.fade; f.style.transition = `opacity ${ms}ms`; f.style.opacity = on ? '1' : '0'; }

  // ---- tutorial prompt -------------------------------------------------------------------
  prompt(keys, label) {
    if (this.touch) {                       // the tutorial speaks keyboard; say the touch version instead
      const first = keys[0]?.label;
      if (first === 'MOUSE') { keys = [{ label: 'DRAG' }]; label = 'on the right side to look around'; }
      else if (first === 'W') { keys = [{ label: 'STICK' }]; label = 'on the left side to move'; }
      else if (first === 'SPACE') { keys = [{ label: 'JUMP' }]; label = 'to jump (tap = hop, hold = full jump)'; }
    }
    const p = this.el.prompt;
    p.classList.remove('hidden', 'done');
    p.innerHTML = '<span class="caps"></span><span class="lbl"></span>';
    const caps = p.querySelector('.caps');
    for (const k of keys) {
      const kb = document.createElement('kbd');
      kb.textContent = k.label; kb.dataset.code = k.code || '';
      caps.appendChild(kb);
    }
    p.querySelector('.lbl').textContent = label;
  }
  promptDone() {
    const p = this.el.prompt; p.classList.add('done');
    setTimeout(() => { if (p.classList.contains('done')) p.classList.add('hidden'); }, 400);
  }
  promptClear() { this.el.prompt.classList.add('hidden'); }
  markKey(code, down) {
    for (const k of this.el.prompt.querySelectorAll('kbd')) if (k.dataset.code === code) k.classList.toggle('on', down);
  }

  // ---- subtitles -------------------------------------------------------------------------
  setSubtitle(text, n) {
    clearTimeout(this._subHideT);
    const s = this.el.subs;
    s.classList.remove('hidden', 'fading');
    this.el['sub-shown'].textContent = text.slice(0, n);
    this.el['sub-rest'].textContent = text.slice(n);
  }
  hideSubtitle() {
    const s = this.el.subs;
    s.classList.add('fading');
    this._subHideT = setTimeout(() => s.classList.add('hidden'), 380);
  }

  /** A little critter crawling across the screen to distract you mid-jump. */
  bug(emoji = '🐝', ms = 4200) {
    const b = document.createElement('div');
    b.className = 'bug'; b.textContent = emoji;
    const fromLeft = Math.random() < 0.5;
    b.style.setProperty('--y0', 20 + Math.random() * 50 + 'vh');
    b.style.setProperty('--y1', 15 + Math.random() * 60 + 'vh');
    b.style.setProperty('--x0', fromLeft ? '-10vw' : '110vw');
    b.style.setProperty('--x1', fromLeft ? '110vw' : '-10vw');
    b.style.animationDuration = ms + 'ms';
    document.getElementById('app').appendChild(b);
    setTimeout(() => b.remove(), ms + 100);
  }

  // ---- gags --------------------------------------------------------------------------------
  loading(on) { this.el['ov-loading'].classList.toggle('hidden', !on); }
  setLoading(p, tip) { this.el['ld-fill'].style.width = Math.max(0, Math.min(100, p)) + '%'; if (tip) this.el['ld-tip'].textContent = tip; }
  ad(on) { this.el['ov-ad'].classList.toggle('hidden', !on); }
  setAdSeconds(n) { this.el['ad-sec'].textContent = n; }
  bars(on) { this.el['ov-bars'].classList.toggle('hidden', !on); }
  glitch(on) { this.el['ov-glitch'].classList.toggle('hidden', !on); }
  creditsStart(rows, speed = 70) {
    const roll = this.el['credits-roll'];
    roll.innerHTML = '';
    rows.forEach(([a, b], i) => {
      const r = document.createElement('div');
      r.className = 'row' + (i === 0 ? ' big' : '');
      r.innerHTML = '<small></small><b></b>';
      r.querySelector('small').textContent = i === 0 ? '' : a;
      r.querySelector('b').textContent = i === 0 ? a : b;
      roll.appendChild(r);
    });
    const end = document.createElement('div'); end.className = 'end'; end.textContent = 'THE END'; roll.appendChild(end);
    this.el['ov-credits'].classList.remove('hidden');
    this._creditsY = window.innerHeight; this._creditsSpeed = speed; this._creditsOn = true;
    roll.style.top = this._creditsY + 'px';
  }
  creditsUpdate(dt) {
    if (!this._creditsOn) return false;
    this._creditsY -= this._creditsSpeed * dt;
    const roll = this.el['credits-roll'];
    roll.style.top = this._creditsY + 'px';
    // finished when "THE END" has scrolled to the middle of the screen
    const end = roll.querySelector('.end');
    const r = end.getBoundingClientRect();
    return r.top + r.height / 2 < window.innerHeight * 0.5;
  }
  creditsStop() { this._creditsOn = false; this.el['ov-credits'].classList.add('hidden'); }
}
