// The home page's personality: a smug host who comments on everything, a few counters that are not real, and some mild ragebait.
// Pure presentation: it never touches game state, only the home screen's DOM.

const $ = (id) => document.getElementById(id);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);

const IDLE = [
  'Welcome! Everything here is perfectly safe.',
  'I have never lied to a contestant. Not once. Ask the contestants.',
  'Fun fact: 100% of winners trusted me.',
  'The tutorial is optional. (It is not.)',
  'Please keep your hands inside the game at all times.',
  'No, there is no secret button. Stop looking for the secret button.',
  'Nothing on this page is a trap. This sentence, however…',
  'You look like a winner. I say that to everyone.',
  'A fair and balanced experience. Balanced on a knife.',
  'Click Play. I will wait. I have nowhere to be. I am a website.',
  'Today\'s forecast: partly cloudy, with a chance of falling.',
  'Reviews say "unfair". Reviews are wrong. I wrote them.',
];
const HOVER = {
  play: ['Excellent choice!', 'Go on. What could possibly go wrong?', 'Brave. Or foolish. I get a cut either way.'],
  levels: ['Cherry-picking? I like it. I will judge you quietly.', 'Skipping ahead? Bold. The levels remember.'],
  skip: ['You cannot skip the tutorial. The tutorial IS the game. Wait…'],
  hotel: ['Hotel Trust-Me. Check in any time you like.', 'Five floors. One manager. Zero complaints. (Complaints are not accepted.)'],
  hotelTouch: ['Desktop only. The hotel has standards. And a doorman. Who is also me.'],
  soon: ['Campaign 3 is classified. Mostly because I have not made it yet.', 'I am told it is even fairer.'],
  settings: ['Turn the graphics down if you are scared.', 'Volume up. I insist. You will want to hear me.'],
};
const LOGO = ['Ow.', 'That is my logo. My face. Same thing.', 'Stop that.', 'Last warning.', 'WHEEEE. I hate this.'];
const LONG_IDLE = 'Hello? Still there? I get lonely. Click Play.';

export class HomeFX {
  constructor(game) {
    this.g = game;
    this.touch = game.touch;
    this.el = {
      home: $('scr-home'), host: $('host'), bubble: $('host-bubble'), text: $('host-text'), cap: $('bd-cap'), tag: $('bd-tag'), quip: $('bd-quip'),
      deaths: $('chip-deaths'), lies: $('chip-lies'), logo: $('logo'), cookie: $('cookie'), wrap: $('host-wrap'),
    };
    this.typing = null; this.hold = 0; this.idleN = 0; this.lastHover = 0; this.logoClicks = 0; this.quiet = 0; this.dodged = false; this.lastLine = '';
    this.deathsToday = 1_000_000 + Math.floor(((Date.now() / 1000) % 86400) * 14.7);
    this.lies = 99_999_000 + Math.floor(Math.random() * 900);
    this.pupil = { x: 0, y: 0 };
    this._bind();
    game.backdrop.onCaption = (tag, quip) => this.caption(tag, quip);
    setInterval(() => this._tick(), 250);
    setTimeout(() => this.say(pick(['Welcome to TRUST ME… the game show where you can trust me completely.', 'Ah, a contestant! Welcome. Make yourself uncomfortable.'])), 900);
    if (!this.touch && !sessionStorage.getItem('trustme.cookie')) setTimeout(() => { if (this._home()) this.el.cookie.classList.remove('hidden'); }, 3500);
  }

  _home() { return this.el.home.classList.contains('show') && !document.hidden; }

  // ---- the host talks ---------------------------------------------------------------------------------
  say(text, { mood = '', hold = 4.5 } = {}) {
    if (!this.el.text) return;
    clearInterval(this.typing);
    this.lastLine = text;
    const t = this.el.text; t.textContent = '';
    this.el.bubble.classList.add('show');
    this.mood(mood);
    let i = 0;
    this.typing = setInterval(() => {
      i += 1; t.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(this.typing); this.hold = hold; }
    }, 24);
    this.hold = 999;
  }

  mood(m) {
    const h = this.el.host; if (!h) return;
    h.classList.remove('m-wow', 'm-wink', 'm-grr');
    if (m) h.classList.add('m-' + m);
    if (m) setTimeout(() => h.classList.remove('m-' + m), 1800);
  }

  caption(tag, quip) {
    if (!this.el.cap) return;
    this.el.cap.classList.remove('go'); void this.el.cap.offsetWidth;
    this.el.tag.textContent = tag; this.el.quip.textContent = quip;
    this.el.cap.classList.add('go');
  }

  // ---- events -----------------------------------------------------------------------------------------------
  _bind() {
    const h = this.el.host;
    if (!this.touch) {
      window.addEventListener('pointermove', (e) => {
        this.quiet = 0;
        if (!h) return;
        const r = h.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * 0.42;
        const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260);
        this.pupil.x = (dx / d) * 6.5 * k; this.pupil.y = (dy / d) * 6 * k;
        for (const p of h.querySelectorAll('.pup')) p.style.transform = `translate(${this.pupil.x}px, ${this.pupil.y}px)`;
      });
    }
    window.addEventListener('pointerdown', () => { this.quiet = 0; });
    window.addEventListener('keydown', () => { this.quiet = 0; });
    // blinking
    const blink = () => { h?.classList.add('blink'); setTimeout(() => h?.classList.remove('blink'), 130); setTimeout(blink, rand(2600, 5600)); };
    setTimeout(blink, 2000);

    // hovering things the host has opinions about
    this.g.ui.el['campaigns'].addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-fx]'); if (!t) return;
      const now = performance.now(); if (now - this.lastHover < 1800) return;
      const k = t.dataset.fx;
      if (k === 'play' && !this.touch && !this.dodged) {                       // the first time, the Play button is shy
        this.dodged = true; this.lastHover = now;
        t.classList.add('dodge'); this.say('Kidding. Mostly.', { mood: 'wink', hold: 2.5 });
        setTimeout(() => t.classList.remove('dodge'), 1500);
        return;
      }
      const lines = HOVER[k === 'hotel' && this.touch ? 'hotelTouch' : k];
      if (lines) { this.lastHover = now; this.say(pick(lines), { mood: k === 'skip' ? 'wow' : '' }); }
    });
    this.g.ui.el['campaigns'].addEventListener('click', (e) => {
      const t = e.target.closest('[data-fx="skip"]'); if (!t) return;
      const card = t.closest('.card'); card?.classList.remove('shake'); void card?.offsetWidth; card?.classList.add('shake');
      this.say(pick(['Nope. The tutorial is five levels. It is the whole game. Nice try, though.', 'Skip it? Sure! Just kidding. Press Play.']), { mood: 'grr', hold: 5 });
    });
    $('btn-settings-home')?.addEventListener('pointerenter', () => { if (performance.now() - this.lastHover > 1800) { this.lastHover = performance.now(); this.say(pick(HOVER.settings)); } });
    this.el.logo?.addEventListener('click', () => {
      this.logoClicks += 1;
      const L = this.el.logo; L.classList.remove('poke'); void L.offsetWidth; L.classList.add('poke');
      this.say(LOGO[Math.min(this.logoClicks, LOGO.length) - 1], { mood: this.logoClicks >= 5 ? 'wow' : 'grr', hold: 3 });
      if (this.logoClicks >= 5) { this.logoClicks = 0; L.classList.add('flip'); setTimeout(() => L.classList.remove('flip'), 3200); }
    });
    // the cookie banner: both buttons are the same button
    const done = (e) => { sessionStorage.setItem('trustme.cookie', '1'); this.el.cookie.classList.add('hidden'); this.say(e === 'b' ? 'Accepted. Also. Twice. I am thrilled.' : 'Thank you. Your trust has been collected.', { mood: 'wink' }); };
    $('cookie-a')?.addEventListener('click', () => done('a'));
    $('cookie-b')?.addEventListener('click', () => done('b'));
  }

  // ---- the heartbeat ------------------------------------------------------------------------------------------
  _tick() {
    if (!this._home()) return;
    this.quiet += 0.25;
    if (this.hold < 900) this.hold -= 0.25;
    // idle chatter
    if (this.hold <= 0) {
      if (this.quiet > 28 && this.lastLine !== LONG_IDLE) {
        this.say(LONG_IDLE, { mood: 'wow', hold: 6 });
        const p = document.querySelector('.card.playable [data-fx="play"]'); p?.classList.add('nudge'); setTimeout(() => p?.classList.remove('nudge'), 2200);
      } else { let l; do { l = pick(IDLE); } while (l === this.lastLine); this.say(l); }
    }
    // counters that are not real
    this.deathsToday += Math.floor(rand(0, 4)); this.lies += Math.floor(rand(1, 9));
    if (this.el.deaths) this.el.deaths.textContent = this.deathsToday.toLocaleString('en-US');
    if (this.el.lies) this.el.lies.textContent = this.lies.toLocaleString('en-US');
  }
}
