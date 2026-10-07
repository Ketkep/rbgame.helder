// The home page's live background: a little TV channel that keeps cutting between the game's levels.
// Each shot builds one level (nothing in it can hurt anyone: only platforms and hazards move), then runs a few camera moves
// (a dolly down the course, an orbit) with a TV-static cut between them and between levels. The host captions every shot with a stat
// he made up.

import { CAMPAIGNS, getCampaign } from './campaigns.js';

const orbit = (center, radius, height, { speed = 0.07, a0 = 0, dur = 12, look = 1 } = {}) => ({ kind: 'orbit', center, radius, height, speed, a0, dur, look });
const dolly = (p0, l0, p1, l1, dur = 12) => ({ kind: 'dolly', p0, l0, p1, l1, dur });

/**
 * `tag` is the caption's headline, `quips` the made-up stats. `animate: 'updaters'` lets a level run its own update hooks in the
 * background (only for levels whose hooks are pure visuals); `desktopOnly` shots are skipped on phones (heavier, and the hotel is
 * not on touch yet).
 */
export const SHOTS = [
  {
    id: 'l1', campaign: 'pilot', level: 0, tag: 'LEVEL 1 · THE TUTORIAL',
    quips: ['Average deaths: 2. In the tutorial. Be proud.', 'The finish gate is right there. Probably.', '97% of players trust the first sign. The other 3% are lying.'],
    cuts: [
      dolly([4, 3.4, 14], [0, 1.6, -30], [4, 5, -70], [0, 1.4, -112], 13),
      orbit([0, 1, -34], 20, 7, { a0: 0.5 }),
    ],
  },
  {
    id: 'l3', campaign: 'pilot', level: 2, tag: 'LEVEL 3 · THE TOWER',
    quips: ['Altitude: yes. Deaths: also yes.', 'Recommended footwear: none. Recommended hobby: falling.', 'Climb it in under a minute and the host will lie about it.'],
    cuts: [
      orbit([0, 20, 0], 62, 22, { speed: 0.05, a0: 0.4, dur: 13 }),
      orbit([0, 14, 0], 32, 6, { speed: 0.09, a0: 2, dur: 11 }),
    ],
  },
  {
    id: 'l2', campaign: 'pilot', level: 1, tag: 'LEVEL 2 · CHECKPOINT ISLAND',
    quips: ['41% of players quit here. The other 59% haven\'t found the exit either.', 'Checkpoints are sacred. Do not look at them funny.', 'Every island is stable. Statistically.'],
    cuts: [
      orbit([0, 0, -30], 24, 9, { a0: 0.8 }),
      dolly([6, 5, 8], [0, 0, -40], [6, 7, -96], [0, 0, -150], 13),
    ],
  },
  {
    id: 'lobby', campaign: 'hotel', level: -1, desktopOnly: true, animate: 'updaters', tag: 'HOTEL TRUST-ME · THE LOBBY',
    quips: ['Check-in: 24 hours. Check-out: see management.', 'Five-star reviews* (*written by the management).', 'Our elevators go exactly where you press. Not you. Them.'],
    cuts: [
      dolly([0, 2.5, 12.5], [0, 4.6, -20], [0, 2.9, -9], [0, 4, -24], 14),
      dolly([-15, 2.6, 8], [-22, 5.8, -3], [-15, 2.6, -14], [-22, 5.8, -22], 12),
    ],
  },
  {
    id: 'l4', campaign: 'pilot', level: 3, tag: 'LEVEL 4 · TECHNICAL DIFFICULTIES',
    quips: ['We are experiencing technical difficulties. Please keep standing by.', 'Your ping is fine. Your decisions, less so.', 'This level is brought to you by a sponsor you cannot skip.'],
    cuts: [
      orbit([0, 0, -30], 22, 8, { a0: 1.2 }),
      dolly([3, 3.2, 10], [0, 0, -40], [3, 3.6, -80], [0, 0, -120], 12),
    ],
  },
  {
    id: 'ledge', campaign: 'hotel', level: 14, desktopOnly: true, tag: 'HOTEL TRUST-ME · THE WINDOW LEDGE',
    quips: ['Eleven floors up, in a thunderstorm. Totally fair.', 'The gondola is perfectly safe. Please do not look at the cable.', 'Housekeeping says the window is open. Housekeeping lies.'],
    cuts: [
      dolly([6, 17, -26], [34, 15, 3], [54, 19, -26], [84, 15, 3], 13),
      dolly([0, 15.7, -1], [40, 15.4, -1], [40, 15.7, -1], [82, 14.8, -1], 12),
    ],
  },
  {
    id: 'l5', campaign: 'pilot', level: 4, tag: 'LEVEL 5 · THE REAL ENDING',
    quips: ['Spoiler: there is an ending. It is just rude about it.', 'The credits roll. You do not get to keep them.', 'Almost everyone who gets here has already stopped trusting me. Good.'],
    cuts: [
      orbit([0, 0, -22], 24, 8, { a0: 3.9, speed: 0.05, dur: 10 }),
      dolly([-4, 4.5, -30], [0, 1, -62], [5, 6, -72], [0, 1, -108], 13),
    ],
  },
];

const ease = (t) => t * t * (3 - 2 * t);
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** Camera position + look-at for a cut, `t` seconds in. */
export function cutCamera(cut, t) {
  if (cut.kind === 'dolly') {
    const k = ease(Math.min(1, t / cut.dur));
    return { pos: lerp3(cut.p0, cut.p1, k), look: lerp3(cut.l0, cut.l1, k) };
  }
  const a = cut.a0 + t * cut.speed, c = cut.center;
  return {
    pos: [c[0] + Math.sin(a) * cut.radius, c[1] + cut.height, c[2] + Math.cos(a) * cut.radius],
    look: [c[0], c[1] + cut.look, c[2] - 8],
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Backdrop {
  constructor(game) {
    this.g = game;
    this.i = -1; this.cut = 0; this.t = 0;
    this.busy = false; this.tok = 0; this.hold = false;
    this.mx = 0; this.my = 0; this.px = 0; this.py = 0;       // pointer parallax
    this.onCaption = null;                                      // (tag, quip) => void, set by the home page
    if (!game.touch) {
      window.addEventListener('pointermove', (e) => { this.mx = e.clientX / window.innerWidth - 0.5; this.my = e.clientY / window.innerHeight - 0.5; });
    }
  }

  get list() { return SHOTS.filter((s) => !(this.g.touch && s.desktopOnly)); }
  get shot() { return this.list[this.i]; }

  /** Show the home screen's backdrop: the first shot is the tutorial the first time, a random one after that. */
  async enter({ first = false } = {}) {
    const n = this.list.length;
    let i = 0;
    if (!first && n > 1) do { i = Math.floor(Math.random() * n); } while (i === this.i);
    return this.load(i, !first && this.i >= 0);
  }

  /** Build shot `i`; with `transition` it hides the swap behind a burst of TV static. */
  async load(i, transition = true) {
    const g = this.g, shot = this.list[i];
    if (!shot) return false;
    const tok = ++this.tok;
    this.busy = true;
    if (transition) { g.ui.cutFlash(true); await sleep(240); }
    if (tok !== this.tok || g.state !== 'title') { g.ui.cutFlash(false); this.busy = false; return false; }
    const camp = getCampaign(shot.campaign);
    const level = shot.level < 0 ? camp.hub : camp.levels[shot.level];
    g.campaign = camp;                                           // the hotel's build code reads the campaign
    let ok = false;
    try { ok = await g._loadLevelObj(level, shot.level, { backdrop: true }); } finally { if (tok === this.tok) g.campaign = CAMPAIGNS[0]; }   // unless a real level took over meanwhile (it set its own campaign)
    this.busy = false;
    if (!ok || tok !== this.tok || g.state !== 'title') { g.ui.cutFlash(false); return false; }
    this.i = i; this.cut = 0; this.t = 0;
    this._caption(shot);
    if (transition) await sleep(80);
    g.ui.cutFlash(false);
    return true;
  }

  /** A real level is being loaded: the backdrop steps aside. */
  stop() { this.tok++; this.i = -1; this.busy = false; this.g.ui.cutFlash(false); }

  _caption(shot) { this.onCaption?.(shot.tag, pick(shot.quips)); }

  /** Called every frame while the home screen is up. Moves the camera and decides when to cut. */
  frame(dt, cam) {
    const g = this.g, w = g.world, shot = this.shot;
    if (!w || !shot) return;
    w.stepVisual(dt, shot.animate === 'updaters');
    if (!document.hidden && !this.hold) this.t += dt;
    const cut = shot.cuts[this.cut];
    if (this.t > cut.dur && !this.busy && !this.hold) {
      if (this.cut + 1 < shot.cuts.length) { this.cut++; this.t = 0; g.ui.cutFlash(true, 140); setTimeout(() => g.ui.cutFlash(false), 140); }
      else this.enter();
    }
    const { pos, look } = cutCamera(shot.cuts[this.cut], this.t);
    this.px += (this.mx - this.px) * Math.min(1, dt * 3); this.py += (this.my - this.py) * Math.min(1, dt * 3);
    const sway = Math.sin(performance.now() / 1900) * 0.12;
    cam.position.set(pos[0] + this.px * 1.6, pos[1] - this.py * 0.8 + sway, pos[2]);
    cam.lookAt(look[0] + this.px * 3, look[1] - this.py * 1.5, look[2]);
    cam.fov = 66; cam.updateProjectionMatrix();
    g.fakePlayer = { x: look[0], y: look[1], z: look[2] };
    w.frame(dt, g.fakePlayer, cam);
  }

  /** Test hook: jump straight to shot `id`, cut `cut`, `t` seconds in (the cut timer is frozen until `resume()`). */
  async preview(id, cut = 0, t = 0) {
    const i = this.list.findIndex((s) => s.id === id);
    if (i < 0) return false;
    const ok = await this.load(i, false);
    this.cut = cut; this.t = t;
    return ok;
  }
}
