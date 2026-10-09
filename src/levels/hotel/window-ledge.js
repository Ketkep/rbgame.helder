import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture, textTexture } from '../../engine/materials.js';
import { hotelHalo, GOLD } from './kit.js';
import { onPlat } from '../common.js';
import { twist, twistZone, trollCheckpoint, fakeComplete, vanishAfter, stageTitle, stageHint } from './trolls.js';

// Hotel level 15 — "Window Ledge" (Hard · Guest Rooms). Outside the hotel, eleven floors up (and climbing), in a thunderstorm. Five windows,
// five stages, a checkpoint at every window:
//   1 Sill Walk          wide sills, a cornice, AC units. The gusts start: a pennant stiffens a second before each one (lean into the wall: D)
//   2 AC Alley           more AC units, a sill that gives way once you are half over (it shimmers), a pipe, crumbling sills, and a lovely
//                        window with an EXIT sign that is painted on (paint can, WET PAINT sign). Its checkpoint EXPIRES after 30 s*
//   3 The Cleaner's Lift a window-cleaner's lift (the tag says OUT OF ORDER; it is lying), a cornice, a swinging gondola
//   4 Gargoyle Row       perches, a sill that vanishes, a cornice in a gale: a gust slams you the moment your mouse flips (mouseX)
//   5 The Top Floor      a ladder of sills (input lag at one rung), a cornice, crumbling sills, then window 1502: LEVEL COMPLETE...
//                        wrong floor. A bonus climb to the real staff window
// The storm: rain, and lightning that WHITES THE SCREEN OUT. It never does it without warning (the sky flickers three times first) and never
// while you are in the air or on a narrow ledge: it waits until you are standing on something wide. Thunder as quiet as ever.
// Baby Mode: half the gust, short twists and a short crash, an expiring checkpoint that keeps, the decoy window says so, the flash is dim.

const Y0 = 14;
const NAMES = ['Sill Walk', 'AC Alley', 'The Cleaner\'s Lift', 'Gargoyle Row', 'The Top Floor'];
const rnd = (n) => Math.floor(Math.random() * n);
const DEP = { sill: 1.8, cornice: 0.95, ac: 1.5, crumble: 1.3, vanish: 1.7, pipe: 0.6, perch: 1.2, rung: 1.5 };
const HT = { sill: 0.5, cornice: 0.5, ac: 1.2, crumble: 0.5, vanish: 0.5, pipe: 0.6, perch: 0.8, rung: 0.4 };
const MAT = {
  sill: { tex: 'stone', color: 0xd6cfc0 }, cornice: { tex: 'stone', color: 0xc8c0b0 }, ac: { tex: 'metal', color: 0xbfc6d0 },
  crumble: { tex: 'stone', color: 0x8c7a66 }, vanish: { tex: 'stone', color: 0xd2cabb }, pipe: { tex: 'metal', color: 0x8a8d95 },
  perch: { tex: 'stone', color: 0x9a9488 }, rung: { tex: 'metal', color: 0xb9a15a },
};

export default {
  id: 'hotel-15',
  name: 'Window Ledge',
  music: 'hotel_storm',
  completeQuip: 'You climbed through the open window. The room is the housekeeping closet. Somebody is going to be furious. Not at you. At the weather.',

  build(w, game) {
    w.env({
      top: 0x04050e, horizon: 0x1c2438, bottom: 0x06070d,
      fog: { color: 0x141a2a, near: 40, far: 230 },
      sun: { color: 0x9db4ff, intensity: 0.5, dir: [-0.4, 0.8, 0.5], shadow: false },
      hemi: { sky: 0x8aa0d8, ground: 0x3a3a50, intensity: 0.7 },
      exposure: 0.95, stars: 0.2,
      clouds: { count: 30, color: 0x3a4258, y: [10, 90], radius: [60, 300], opacity: 0.55, size: [40, 110] },
      bloom: { strength: 0.5, radius: 0.7, threshold: 0.95 },
      motes: { color: 0xaec4ff, count: 100, size: 0.06, opacity: 0.35 },
    });
    w.setTheme({ tex: 'stone', color: 0xd6cfc0, trim: null, edge: null, edgeOpacity: 0, roughness: 0.75, metalness: 0, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.spawn = { x: 0, y: Y0, z: -0.9, yaw: -Math.PI / 2 };
    w.respawn = { ...w.spawn };
    w.killY = Y0 - 46;
    const timers = new Set();
    const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); if (game.world === w) fn(); }, ms); timers.add(id); };
    w.onDispose(() => { for (const id of timers) clearTimeout(id); timers.clear(); });

    // ================================================================================================================================
    //  The route, stage by stage (platforms are created in route order: the bot and the hint walk them in that order)
    // ================================================================================================================================
    const stages = NAMES.map(() => ({ at: null, route: [] }));
    const route = [], ledges = [], gusts = [], lifts = [], cps = new Map();
    const dressing = [];                      // [x0, x1, y] spans of the facade that carry our own windows
    let X = -3, Y = Y0, S = 0;

    // a windsock on the wall: it hangs limp, stiffens a second before a gust and streams out while it blows
    const sock = (x, y) => {
      const hinge = new THREE.Group(); hinge.position.set(x, y, -0.3); w.add(hinge);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.4), new THREE.MeshBasicMaterial({ color: 0xff7a2a, side: THREE.DoubleSide, toneMapped: false }));
      cloth.rotation.y = Math.PI / 2; cloth.position.z = -0.47; hinge.add(cloth);
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false }));
      stripe.rotation.y = Math.PI / 2; stripe.position.set(0.004, 0, -0.5); hinge.add(stripe);
      w.box({ x, y: y + 0.0, z: -0.12, w: 0.1, h: 0.1, d: 0.26, color: 0x8a8d95, metal: 0.8, rough: 0.4, shadow: false });
      return hinge;
    };
    const WARN = 1.1;
    const gust = (xa, xb, y, strength, { period = 5.6, on = 2.0, phase = 0 } = {}) => {
      const wi = w.wind({ x: (xa + xb) / 2, y: y + 1.2, z: -0.8, w: xb - xa + 1, h: 3.2, d: 4, dx: 0, dz: -1, strength, period, on, phase });
      const g = { wi, base: strength, period, on, phase, xa, xb, y, sock: sock(xa - 0.5, y + 2.6), forced: 0, k: 0 };
      gusts.push(g);
      return g;
    };
    const gustLevel = (g, t) => {
      if (g.forced > t) return 1;
      const u = ((t + g.phase) % g.period + g.period) % g.period;
      return u < g.on ? 1 : u > g.period - WARN ? (u - (g.period - WARN)) / WARN * 0.7 : 0;
    };

    const stoneDressing = (l) => {
      if (l.type === 'sill' || l.type === 'vanish') { w.box({ x: l.x, y: l.y - 0.62, z: -0.1, w: l.len - 0.2, h: 0.22, d: 0.3, color: 0xc8c0b0, rough: 0.8, shadow: false }); }
      if (l.type === 'ac') {
        for (let k = 0; k < 3; k++) w.box({ x: l.x - 0.5 + k * 0.5, y: l.y - 0.2, z: l.zc - 0.77, w: 0.06, h: 0.7, d: 0.05, color: 0x222a34, rough: 0.5, shadow: false });
        w.box({ x: l.x, y: l.y + 0.05, z: l.zc - 0.77, w: 1.5, h: 0.1, d: 0.03, glow: 0x6cf0b2, glowIntensity: 0.9, shadow: false });
      }
      if (l.type === 'perch') {
        const stone = plainMaterial(0x6a6458, { roughness: 0.9, flatShading: true });
        const gar = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 6), stone); gar.position.set(l.x, l.y + 0.65, l.zc + 0.2); w.add(gar);
        const hd = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), stone); hd.position.set(l.x, l.y + 1.5, l.zc - 0.1); w.add(hd);
        for (const sx of [-1, 1]) { const wing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), stone); wing.position.set(l.x + sx * 0.7, l.y + 1.2, l.zc + 0.3); wing.rotation.z = sx * 0.6; w.add(wing); }
        for (const sx of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), glowMaterial(0xff6a3a, 1.8)); eye.position.set(l.x + sx * 0.12, l.y + 1.55, l.zc - 0.34); w.add(eye); }
      }
      if (l.type === 'pipe') for (const px of [l.x - l.len / 2 + 0.3, l.x + l.len / 2 - 0.3]) w.box({ x: px, y: l.y - 0.45, z: -0.25, w: 0.12, h: 0.9, d: 0.5, color: 0x6a6e78, metal: 0.8, rough: 0.4, shadow: false });
      if (l.type === 'cornice') w.box({ x: l.x, y: l.y - 0.62, z: -0.05, w: l.len, h: 0.3, d: 0.2, color: 0xb8b0a0, rough: 0.8, shadow: false });
    };

    const L = (type, len, gap, rise, o = {}) => {
      X += gap; Y += rise;
      const dep = o.dep ?? DEP[type], h = HT[type], m = MAT[type], cx = X + len / 2, zc = -dep / 2;
      const pl = w.plat({ x: cx, y: Y, z: zc, w: len, d: dep, h, tex: m.tex, color: m.color, roughness: type === 'pipe' ? 0.3 : 0.75, metalness: type === 'pipe' || type === 'ac' || type === 'rung' ? 0.6 : 0, radius: type === 'pipe' ? 0.25 : 0.05, trim: type === 'pipe' || type === 'sill' || type === 'rung' ? undefined : 0x8aa4d0 });
      pl.o.path = true; pl.kind = type;
      const l = { i: ledges.length, type, pl, x: cx, y: Y, len, dep, zc, stage: S, x0: X, x1: X + len };
      pl.ledge = l;
      if (type === 'crumble') w.crumble(pl, { delay: 0.5, gone: 3.2 });
      if (type === 'vanish') vanishAfter(w, game, pl, { axis: 'x', dir: 1, frac: 0.45, delay: 0.7, back: 3.4, say: o.say || null });
      ledges.push(l); route.push(pl); stages[S].route.push({ x: cx, y: Y, z: zc });
      stoneDressing(l);
      if ((type === 'sill' || type === 'cornice') && !o.noWin) { dressing.push([X - 0.3, X + len + 0.3, Y]); if (len >= 4) w.box({ x: cx, y: Y + 1.7, z: 0.0, w: Math.min(2.4, len - 0.6), h: 2.6, d: 0.12, glow: Math.random() < 0.5 ? 0xffc878 : 0x16202e, glowIntensity: 0.9, shadow: false }); }
      if (o.noWin) dressing.push([X - 0.3, X + len + 0.3, Y]);
      X += len;
      return l;
    };
    // a lit window behind a sill: the frame, the light, a curtain
    const windowAt = (x, y, big = false, sign = null) => {
      const ww = big ? 2.6 : 1.5, hh = big ? 3.2 : 2.3;
      w.box({ x, y: y + 0.2 + hh / 2, z: 0.02, w: ww, h: hh, d: 0.1, color: 0xffd890, glow: 0xffe0a0, glowIntensity: big ? 1.5 : 1.1, shadow: false });
      w.box({ x, y: y + 0.2 + hh / 2, z: -0.1, w: ww + 0.35, h: hh + 0.3, d: 0.04, color: 0xe8e0d0, rough: 0.7, shadow: false });
      w.box({ x: x - ww / 2 + 0.25, y: y + 0.2 + hh / 2, z: -0.1, w: 0.4, h: hh - 0.1, d: 0.05, color: 0x8a2a3a, rough: 0.9, shadow: false });
      w.box({ x, y: y + 0.2 + hh / 2, z: -0.13, w: 0.07, h: hh, d: 0.03, color: 0xe8e0d0, rough: 0.7, shadow: false });
      if (big) hotelHalo(w, x, y + 1.8, -1.4, 7, 0xffc880, 0.5);
      if (sign) w.sign({ text: sign, x, y: y + hh + 0.75, z: -0.14, w: 3.4, h: 0.55, rotY: Math.PI, color: '#ffd21f', double: false, tw: 512, size: 56, glow: true });
    };
    // the checkpoint on the last sill of a stage
    const endStage = (l, n, mode = 'real', extra = {}) => {
      windowAt(l.x, l.y, true, `WINDOW ${n}`);
      const at = { x: l.x, y: l.y, z: l.zc };
      stages[n].at = at;
      const cp = mode === 'expire'
        ? trollCheckpoint(w, game, { ...at, mode: 'expire', ttl: 30, say: extra.say })
        : w.checkpoint({ ...at, real: true });
      cps.set(cp, n - 1);
      S = n;
      return cp;
    };

    // a window-cleaner's lift: a platform on rails that rises H metres, rests, and comes back down (the tag says OUT OF ORDER; it is lying).
    const LW = 4.4, LD = 2.4;
    const smooth = (t, T, ph) => Math.min(1, Math.max(0, 0.5 + 0.78 * Math.sin((t + ph) * Math.PI * 2 / T)));
    const lift = (H, T, ph = 4, tagText = 'OUT OF ORDER') => {
      const low = ledges[ledges.length - 1];
      const lx = X + 0.6 + LW / 2, ly = Y;
      const pl = w.plat({ x: lx, y: ly, z: -1.7, w: LW, d: LD, h: 0.3, tex: 'metal', color: 0xd8dce4, roughness: 0.3, metalness: 0.8, radius: 0.04 });
      pl.o.path = true; pl.kind = 'lift'; pl.ledge = { i: ledges.length, type: 'lift', pl, x: lx, y: ly, len: LW, dep: LD, zc: -1.7, stage: S };
      w.mover(pl, (t) => ({ y: H * smooth(t, T, ph) }));
      ledges.push(pl.ledge); route.push(pl); stages[S].route.push({ x: lx, y: ly, z: -1.7 });
      for (const sx of [-1, 1]) pl.attach(w.box({ x: lx + sx * 2.0, y: ly + H / 2 + 8, z: -1.7, w: 0.06, h: H + 16, d: 0.06, color: 0x2a2a30, metal: 0.8, rough: 0.5, static: false }));
      pl.attach(w.box({ x: lx, y: ly + 0.55, z: -2.8, w: LW, h: 0.07, d: 0.07, color: 0xffd21f, rough: 0.5, static: false }));
      for (const sx of [-1, 1]) pl.attach(w.box({ x: lx + sx * 2.15, y: ly + 0.55, z: -1.7, w: 0.07, h: 0.07, d: LD, color: 0xffd21f, rough: 0.5, static: false }));
      pl.attach(w.sign({ text: tagText, x: lx, y: ly + 0.95, z: -2.84, w: 2.4, h: 0.5, rotY: Math.PI, color: '#ffffff', bg: '#a01828', double: true, tw: 512, size: 56 }));
      w.box({ x: lx, y: ly + H + 16, z: -1.7, w: 7, h: 0.5, d: 0.6, color: 0x3a3a44, metal: 0.8, rough: 0.5, shadow: false });
      for (const sx of [-1, 1]) w.box({ x: lx + sx * 2.0, y: ly + H / 2 - 0.2, z: -0.45, w: 0.14, h: H + 1, d: 0.14, color: 0x8a8d95, metal: 0.8, rough: 0.4, shadow: false });
      X = lx + LW / 2 + 0.6;
      lifts.push({ pl, low, H, T, ph });
      return pl;
    };
    // a window-cleaner's tram: a platform that rides a rail along the wall across a gap too wide to jump, resting at each end
    const trams = [];
    const tram = (travel, T = 22, ph = 0) => {
      const cx0 = X + 0.6 + LW / 2, ty = Y;
      const pl = w.plat({ x: cx0, y: ty, z: -1.7, w: LW, d: LD, h: 0.3, tex: 'metal', color: 0xd8dce4, roughness: 0.3, metalness: 0.8, radius: 0.04 });
      pl.o.path = true; pl.kind = 'tram'; pl.ledge = { i: ledges.length, type: 'tram', pl, x: cx0, y: ty, len: LW, dep: LD, zc: -1.7, stage: S };
      w.mover(pl, (t) => ({ x: travel * smooth(t, T, ph) }));
      ledges.push(pl.ledge); route.push(pl); stages[S].route.push({ x: cx0 + travel / 2, y: ty, z: -1.7 });
      for (const sx of [-1, 1]) pl.attach(w.box({ x: cx0 + sx * 2.0, y: ty + 3.1, z: -1.7, w: 0.06, h: 6.2, d: 0.06, color: 0x2a2a30, metal: 0.8, rough: 0.5, static: false }));
      pl.attach(w.box({ x: cx0, y: ty + 0.55, z: -2.8, w: LW, h: 0.07, d: 0.07, color: 0xffd21f, rough: 0.5, static: false }));
      for (const sx of [-1, 1]) pl.attach(w.box({ x: cx0 + sx * 2.15, y: ty + 0.55, z: -1.7, w: 0.07, h: 0.07, d: LD, color: 0xffd21f, rough: 0.5, static: false }));
      w.box({ x: cx0 + travel / 2, y: ty + 6.3, z: -1.7, w: travel + LW + 1, h: 0.4, d: 0.5, color: 0x3a3a44, metal: 0.8, rough: 0.5, shadow: false });
      w.box({ x: cx0 + travel / 2, y: ty - 0.5, z: -0.5, w: travel + LW, h: 0.12, d: 0.12, color: 0x8a8d95, metal: 0.8, rough: 0.4, shadow: false });
      X = cx0 + LW / 2 + travel + 0.6;
      trams.push({ pl, travel, T, ph });
      return pl;
    };
    // a gale gate: a head-on gust across the middle of a long sill. It out-pushes you (you are shoved back out of it, never off the ledge),
    // so you wait in the lee for the lull: the pennant stiffens a second before it blows and goes limp when it is over
    const gates = [];
    const gate = (len, gap, rise, o = {}) => {
      const l = L('sill', len, gap, rise, o);
      const xa = l.x0 + 3.2, xb = l.x1 - 3.2;
      const wi = w.wind({ x: (xa + xb) / 2, y: l.y + 1.2, z: l.zc, w: xb - xa, h: 3.2, d: l.dep + 1.2, dx: -1, dz: 0, strength: 40, period: 10, on: 4.8, phase: o.phase ?? 0 });
      const g = { wi, base: 40, period: 10, on: 4.8, phase: o.phase ?? 0, xa, xb, y: l.y, sock: sock(xa + 0.2, l.y + 2.6), forced: 0, k: 0, gate: true, ledge: l };
      w.sign({ text: 'GALE GATE\nwait for the lull', x: xa - 1.6, y: l.y + 1.9, z: -0.14, w: 2.6, h: 1.0, rotY: Math.PI, color: '#111', bg: '#ffd21f', double: false, tw: 512, size: 40 });
      gusts.push(g); gates.push(g);
      return l;
    };

    // ---------------- stage 1 · sill walk ---------------------------------------------------------------------------------------
    stages[0].at = { x: 0, y: Y0, z: -0.9 };
    const sp = L('sill', 7, 0, 0); w.sign({ text: 'WINDOW 1 ▸', x: sp.x + 1, y: Y0 + 0.02, z: -0.9, w: 3, h: 0.7, rotX: -Math.PI / 2, rotY: Math.PI / 2, color: '#f1d28a', double: false, tw: 512, size: 56 });
    L('sill', 4, 2.6, 0);
    L('sill', 4.5, 2.8, 0.4);
    const c1 = L('cornice', 10, 2.4, 0); gust(c1.x0, c1.x1, c1.y, 15, { period: 5.6, on: 1.8, phase: 0.5 });
    L('sill', 4, 2.7, 0.4);
    L('ac', 1.7, 2.9, 0.9); L('ac', 1.7, 2.7, 0.9);
    L('sill', 5, 2.7, 0.4);
    const c2 = L('cornice', 12, 2.4, 0); gust(c2.x0, c2.x1, c2.y, 17, { period: 5.2, on: 1.9, phase: 2.2 });
    L('sill', 4, 2.6, 0.4);
    const c2b = L('cornice', 8, 2.4, 0); gust(c2b.x0, c2b.x1, c2b.y, 17, { period: 5.0, on: 1.9, phase: 0.3 });
    const e1 = L('sill', 6, 2.6, 0.4, { noWin: true });
    endStage(e1, 1);

    // ---------------- stage 2 · AC alley -----------------------------------------------------------------------------------------
    L('ac', 1.7, 2.9, 0.9); L('ac', 1.7, 2.7, 0.9); L('ac', 1.7, 2.7, 0.9);
    L('sill', 5, 2.6, 0.8);
    const vs1 = L('vanish', 6, 2.5, 0, { say: 'hotel.l15.vanish' });
    const pp = L('pipe', 9, 2.7, 0); gust(pp.x0, pp.x1, pp.y, 18, { period: 5.4, on: 1.8, phase: 1.6 });
    L('sill', 4.5, 2.6, 0.4);
    tram(16, 18, 3);
    L('sill', 5, 0, 0);
    const cr1 = [L('crumble', 1.9, 2.5, 0.5), L('crumble', 1.9, 2.5, 0.5), L('crumble', 1.9, 2.5, 0.5)];
    const paintSill = L('sill', 7, 2.5, 0.5, { noWin: true });
    const e2 = L('sill', 6, 2.8, 0.4, { noWin: true });
    endStage(e2, 2, 'expire', { say: 'hotel.l15.expired' });

    // ---------------- stage 3 · the cleaner's lift -------------------------------------------------------------------------------
    const lowSill = L('sill', 5, 2.6, 0.4);
    lift(10, 20);
    const upSill = L('sill', 6, 0, 10);
    const c3 = L('cornice', 8, 2.5, 0.4); gust(c3.x0, c3.x1, c3.y, 17, { period: 5.4, on: 1.9, phase: 3.0 });
    const preG = L('sill', 4, 2.6, 0);
    // the gondola: swings between two sills across a wide gap
    const GP = 9.6, gcx = X + GP / 2, gy = Y;
    const gond = w.plat({ x: gcx, y: gy, z: -1.7, w: 4.4, d: 2.4, h: 0.3, tex: 'metal', color: 0xd8dce4, roughness: 0.3, metalness: 0.8, radius: 0.04 });
    gond.o.path = true; gond.kind = 'gondola'; gond.ledge = { i: ledges.length, type: 'gondola', pl: gond, x: gcx, y: gy, len: 4.4, dep: 2.4, zc: -1.7, stage: S };
    const GA = (GP - 4.4) / 2 - 0.6;
    w.mover(gond, (t) => ({ x: Math.sin(t * 1.15) * GA }));
    for (const sx of [-1, 1]) gond.attach(w.box({ x: gcx + sx * 2.0, y: gy + 14, z: -1.7, w: 0.06, h: 28, d: 0.06, color: 0x2a2a30, metal: 0.8, rough: 0.5, static: false }));
    gond.attach(w.box({ x: gcx, y: gy + 0.55, z: -2.8, w: 4.4, h: 0.07, d: 0.07, color: 0xffd21f, rough: 0.5, static: false }));
    for (const sx of [-1, 1]) gond.attach(w.box({ x: gcx + sx * 2.15, y: gy + 0.55, z: -1.7, w: 0.07, h: 0.07, d: 2.4, color: 0xffd21f, rough: 0.5, static: false }));
    w.box({ x: gcx, y: gy + 28.5, z: -1.7, w: GP + 8, h: 0.5, d: 0.5, color: 0x3a3a44, metal: 0.8, rough: 0.5, shadow: false });
    ledges.push(gond.ledge); route.push(gond); stages[S].route.push({ x: gcx, y: gy, z: -1.7 });
    X += GP;
    L('sill', 5, 0, 0);
    gate(18, 2.5, 0.4, { phase: 0 });
    L('crumble', 1.9, 2.5, 0.5); L('crumble', 1.9, 2.5, 0.5);
    const e3 = L('sill', 6, 2.5, 0.5, { noWin: true });
    endStage(e3, 3);

    // ---------------- stage 4 · gargoyle row ---------------------------------------------------------------------------------------
    const gar1 = L('perch', 1.3, 3.0, 0.4); L('perch', 1.3, 3.1, 0.4); L('perch', 1.3, 3.1, 0.4);
    const twSill = L('sill', 4.5, 3.0, 0.4);
    const gale = L('cornice', 14, 2.4, 0); const gD = gust(gale.x0, gale.x1, gale.y, 22, { period: 6.0, on: 2.4, phase: 4.4 });
    const vs2 = L('vanish', 5, 2.5, 0, { say: null });
    L('perch', 1.3, 3.0, 0.4); L('perch', 1.3, 3.1, 0.4);
    L('sill', 4, 3.0, 0.4);
    tram(14, 18, 9);
    L('sill', 5, 0, 0);
    const e4 = L('sill', 6, 2.6, 0.4, { noWin: true });
    endStage(e4, 4);

    // ---------------- stage 5 · the top floor --------------------------------------------------------------------------------------
    const rung1 = L('rung', 3, 2.6, 1.0); const rung2 = L('rung', 3, 2.6, 1.0); L('rung', 3, 2.6, 1.0); L('rung', 3, 2.6, 1.0); L('rung', 3, 2.6, 1.0);
    const c5 = L('cornice', 9, 2.5, 0.4); gust(c5.x0, c5.x1, c5.y, 19, { period: 5.2, on: 2.0, phase: 0.9 });
    L('sill', 4, 2.5, 0.4);
    lift(8, 16, 7, 'HOIST · RIDE AT OWN RISK');
    L('sill', 4, 0, 8);
    L('cornice', 6, 2.5, 0.5);
    gate(18, 2.5, 0.4, { phase: 5 });
    const last = L('sill', 8, 2.6, 0.5, { noWin: true });
    windowAt(last.x, last.y, true, 'ROOM 1502');
    stages[4].route.push({ x: last.x, y: last.y, z: last.zc });

    // ================================================================================================================================
    //  The bonus: the real window, a few more hops up (it only exists once the "level complete" has been taken back)
    // ================================================================================================================================
    const bonus = [];
    let bx = X, by = Y;
    for (const [gap, rise, len] of [[2.7, 0.8, 2.4], [2.8, 0.9, 2.2], [2.6, 0.9, 2.2], [2.8, 0.8, 2.2], [2.7, 0.8, 6]]) {
      bx += gap; by += rise;
      const m = MAT.rung, dep = len > 5 ? 1.8 : 1.3;
      const pl = w.plat({ x: bx + len / 2, y: by, z: -dep / 2, w: len, d: dep, h: 0.4, tex: m.tex, color: len > 5 ? 0xd6cfc0 : m.color, roughness: 0.7, metalness: len > 5 ? 0 : 0.5, radius: 0.05 });
      pl.o.path = true; pl.kind = 'bonus'; pl.setEnabled(false); bonus.push(pl);
      bx += len;
    }
    const finalSill = bonus[bonus.length - 1];
    const closetWin = { x: finalSill.body.x, y: finalSill.top };
    const realGoal = w.goal({ x: closetWin.x, y: closetWin.y, z: -0.95, color: GOLD, onReach: () => { game.say('hotel.l15.done', { priority: 2 }); game.completeLevel(); } });
    realGoal.group.visible = false; realGoal.trig.enabled = false;
    const bonusDress = [];
    { // the real window (a bit too small for a person, and open)
      const bw = w.box({ x: closetWin.x, y: closetWin.y + 1.7, z: 0.02, w: 2.4, h: 3.0, d: 0.1, color: 0xffd890, glow: 0xffe0a0, glowIntensity: 1.3, shadow: false });
      const sg = w.sign({ text: 'STAFF CLOSET', x: closetWin.x, y: closetWin.y + 3.9, z: -0.1, w: 3.4, h: 0.6, rotY: Math.PI, color: '#ffd21f', double: false, tw: 512, size: 60, glow: true });
      bonusDress.push(bw, sg);
      const halo = hotelHalo(w, closetWin.x, closetWin.y + 1.8, -1.2, 7, 0xffc880, 0.5);
      if (halo) bonusDress.push(halo);
      for (const o of bonusDress) o.visible = false;
    }
    // the fake goal at the last sill (a window with a plate: ROOM 1502)
    let bonusOn = false;
    const enableBonus = () => {
      bonusOn = true;
      for (const p of bonus) { p.setEnabled(true); w.burst(new THREE.Vector3(p.body.x, p.top + 0.3, p.body.z), GOLD, 10, 3); }
      for (const o of bonusDress) o.visible = true;
      realGoal.group.visible = true; realGoal.trig.enabled = true; w.goalObj = realGoal;
      w.respawn = { x: last.x, y: last.y, z: last.zc, yaw: -Math.PI / 2 };       // the bonus is its own checkpoint
    };
    const fakeGoal = w.goal({ x: last.x + 1.0, y: last.y, z: last.zc, color: GOLD, onReach: () => {
      if (!fakeComplete(game, w, { title: 'LEVEL COMPLETE', sub: 'Window Ledge · ROOM 1502 · you have arrived', say: 'hotel.l15.fakewin', sayAfter: 'hotel.l15.bonus', then: enableBonus })) game.completeLevel();
    } });
    w.goalObj = fakeGoal;
    stages[4].route.push({ x: fakeGoal.x, y: fakeGoal.y, z: fakeGoal.z });

    // ================================================================================================================================
    //  The painted window (stage 2): an EXIT you can "open". It is paint
    // ================================================================================================================================
    const paint = (() => {
      const x = paintSill.x, y = paintSill.y;
      const c = document.createElement('canvas'); c.width = 256; c.height = 340; const g = c.getContext('2d');
      g.fillStyle = '#d8d2c0'; g.fillRect(0, 0, 256, 340);
      g.fillStyle = '#f4efe0'; g.fillRect(14, 14, 228, 312);
      g.fillStyle = '#ffe9b0'; g.fillRect(34, 34, 188, 272);
      g.strokeStyle = 'rgba(160,120,60,0.5)'; g.lineWidth = 3; for (let k = 0; k < 14; k++) { g.beginPath(); g.moveTo(34, 40 + k * 19 + (k % 3)); g.lineTo(222, 36 + k * 19 - (k % 2) * 3); g.stroke(); }   // brush strokes
      g.fillStyle = '#b02a3a'; g.fillRect(34, 34, 40, 272); g.fillRect(34, 34, 188, 24);        // a painted curtain
      g.fillStyle = '#f4efe0'; g.fillRect(124, 34, 5, 272); g.fillRect(34, 150, 188, 5);
      g.fillStyle = '#ffe9b0'; for (const dx of [60, 150, 196]) { g.beginPath(); g.ellipse(dx, 306, 4, 12, 0, 0, 7); g.fill(); }   // drips
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; w.ownTextures.push(tex);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.45), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      win.position.set(x, y + 2.0, -0.04); w.add(win);
      w.sign({ text: game.baby ? 'EXIT (decoy)' : 'EXIT ➜', x, y: y + 4.2, z: -0.12, w: 3.2, h: 0.8, rotY: Math.PI, color: '#6cf0b2', double: false, tw: 512, size: 82, glow: true });
      hotelHalo(w, x, y + 3, -1.2, 6, 0x6cf0b2, 0.28);
      // the tell: a bucket, a brush and a WET PAINT sign on the sill
      w.box({ x: x + 1.9, y: y + 0.28, z: -0.8, w: 0.5, h: 0.55, d: 0.5, color: 0xd8d2c0, rough: 0.5, shadow: false });
      w.box({ x: x + 1.9, y: y + 0.6, z: -0.8, w: 0.44, h: 0.06, d: 0.44, color: 0xffe9b0, rough: 0.3, shadow: false });
      const brush = w.box({ x: x + 1.55, y: y + 0.3, z: -1.1, w: 0.9, h: 0.06, d: 0.1, color: 0x7a5a3a, rough: 0.7, shadow: false }); brush.rotation.y = 0.5;
      w.sign({ text: 'WET\nPAINT', x: x - 1.8, y: y + 0.62, z: -1.05, w: 0.9, h: 0.85, rotY: Math.PI, color: '#111', bg: '#ffd21f', double: true, tw: 256, size: 70 });
      let used = false;
      const it = w.interactable({ x, y: y + 1.9, z: -0.7, w: 2.8, h: 3.4, d: 2.2, range: 4.2, label: () => (game.baby ? 'Climb out of the EXIT window (decoy)' : 'Climb out of the EXIT window'), enabled: () => !used,
        onUse: () => {
          if (used || game.state !== 'playing') return; used = true; game.audio.click();
          game.say('hotel.l15.paint', { priority: 2 });
          later(900, () => { if (game.state === 'playing') game.kill('fake'); });
        } });
      void it;
      w.onRespawn(() => { used = false; });
      onPlat(w, paintSill.pl, () => game.say('hotel.l15.paint.near', { priority: 1 }));
      return { x, y };
    })();

    // ================================================================================================================================
    //  The facade: the wall, every other window, the skyline
    // ================================================================================================================================
    const X0 = -26, X1 = X + 46, WALLH = 124;
    w.plat({ x: (X0 + X1) / 2, y: Y0 + 70, z: 3.5, w: X1 - X0, d: 7, h: WALLH, tex: 'stone', color: 0xe8e0d0, roughness: 0.8 });
    {
      const winGeo = new THREE.BoxGeometry(1.5, 2.3, 0.12);
      const cols = Math.floor((X1 - X0) / 4.4), rows = 24;
      const litM = new THREE.InstancedMesh(winGeo, glowMaterial(0xffc878, 1.1), cols * rows), darkM = new THREE.InstancedMesh(winGeo, plainMaterial(0x16202e, { roughness: 0.15, metalness: 0.4 }), cols * rows);
      const m4 = new THREE.Matrix4(); let li = 0, di = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = X0 + 3 + c * 4.4, y = Y0 - 36 + r * 4.6;
        if (dressing.some(([a, b, yy]) => x + 0.9 > a && x - 0.9 < b && y + 1.2 > yy - 1.0 && y - 1.2 < yy + 3.9)) continue;
        if (lifts.some((l) => Math.abs(x - l.pl.body.x) < 5.5 && y > l.pl.base.y - 1.5 && y < l.pl.base.y + l.H + 4)) continue;
        if (x > paint.x - 4 && x < paint.x + 4 && Math.abs(y - paint.y) < 6) continue;
        m4.makeTranslation(x, y, -0.04);
        if (Math.random() < 0.34) litM.setMatrixAt(li++, m4); else darkM.setMatrixAt(di++, m4);
      }
      litM.count = li; darkM.count = di; litM.instanceMatrix.needsUpdate = darkM.instanceMatrix.needsUpdate = true; w.add(litM); w.add(darkM);
    }
    for (let y = Y0 - 36; y < Y0 + 62; y += 4.6) w.box({ x: (X0 + X1) / 2, y: y - 1.9, z: -0.08, w: X1 - X0, h: 0.22, d: 0.2, color: 0xcfc6b4, rough: 0.8, shadow: false });
    // the start window
    w.box({ x: -2.6, y: Y0 + 1.7, z: 0.02, w: 2.4, h: 3.0, d: 0.1, color: 0xffd890, glow: 0xffe0a0, glowIntensity: 1.0, shadow: false });
    // our own skyline, all along the street in front of the facade
    {
      const geo = new THREE.BoxGeometry(1, 1, 1), N = 130;
      const bm = new THREE.InstancedMesh(geo, plainMaterial(0x14102a, { roughness: 0.9 }), N);
      const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), glowMaterial(0xffc070, 1.5), N * 3), cm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), glowMaterial(0x7aa8ff, 1.3), N * 2);
      let s = 11; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
      let wi = 0, ci = 0;
      for (let i = 0; i < N; i++) {
        const x = X0 - 60 + r() * (X1 - X0 + 120), z = -75 - r() * 170, h = 30 + r() * 110, ww = 9 + r() * 18;
        m.compose(ps.set(x, h / 2 - 40, z), q, sc.set(ww, h, ww)); bm.setMatrixAt(i, m);
        for (let k = 0; k < 3; k++) { m.compose(ps.set(x, -40 + h * (0.2 + r() * 0.75), z + ww / 2 + 0.05), q, sc.set(ww * 0.9, 0.5, 0.1)); const target = r() < 0.7 ? wm : cm; if (target === wm) wm.setMatrixAt(wi++, m); else cm.setMatrixAt(ci++, m); }
      }
      wm.count = wi; cm.count = ci; for (const o of [bm, wm, cm]) { o.instanceMatrix.needsUpdate = true; o.frustumCulled = false; w.add(o); }
    }

    // ================================================================================================================================
    //  The storm: rain, the gust flags, lightning that whites the screen out (always warned, never while you are in the air)
    // ================================================================================================================================
    const RN = 220, rpos = new Float32Array(RN * 6), rseed = [];
    for (let i = 0; i < RN; i++) rseed.push([Math.random() * 30 - 15, Math.random() * 24, Math.random() * 16 - 12]);
    const rgeo = new THREE.BufferGeometry(); rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
    const rain = new THREE.LineSegments(rgeo, new THREE.LineBasicMaterial({ color: 0xaec4ff, transparent: true, opacity: 0.35 })); rain.frustumCulled = false; w.add(rain);
    const flash = document.createElement('div');
    flash.id = 'stormflash';
    flash.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:4';
    document.getElementById('app').appendChild(flash);
    w.onDispose(() => flash.remove());
    const boltGeo = new THREE.BufferGeometry(); boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
    const bolt = new THREE.Line(boltGeo, new THREE.LineBasicMaterial({ color: 0xe8f0ff, toneMapped: false })); bolt.frustumCulled = false; bolt.visible = false; w.add(bolt);
    const storm = { next: 7, warnAt: [], strikeAt: -1, flickA: 0, flashA: 0, thunderAt: -1, strikes: 0, flickers: 0, said: false };
    const hemiBase = w.hemi.intensity;
    const safeSpot = (p) => p.grounded && p.ground && p.ground.hx * 2 >= 3.4 && p.ground.hz * 2 >= 1.5;
    const setFlash = () => { flash.style.opacity = String(Math.max(0, Math.min(1, Math.max(storm.flickA, storm.flashA * (game.baby ? 0.4 : 0.94))))); };
    w.onRespawn(() => { flash.style.opacity = '0'; storm.flickA = storm.flashA = 0; });

    let windScale = 1, t0 = 0, intro = false;
    w.onUpdate((dt, t) => {
      const p = game.player;
      // rain
      for (let i = 0; i < RN; i++) {
        const [sx, sy, sz] = rseed[i];
        const rx = p.x + sx, rz = p.z + sz * 0.5 - 4, ry = p.y + 12 - ((sy + t * 18) % 24);
        rpos[i * 6] = rx; rpos[i * 6 + 1] = ry; rpos[i * 6 + 2] = rz;
        rpos[i * 6 + 3] = rx - 0.12; rpos[i * 6 + 4] = ry - 0.8; rpos[i * 6 + 5] = rz - 0.35;
      }
      rgeo.attributes.position.needsUpdate = true;
      // gusts: strength (half in Baby Mode), the windsocks, the ambient howl
      let howl = 0.1;
      for (const g of gusts) {
        g.wi.strength = g.base * windScale * (game.baby ? 0.5 : 1);
        if (g.forced && g.forced <= t) { g.forced = 0; g.wi.period = g.period; }
        const k = gustLevel(g, t); g.k = k;
        g.sock.rotation.x = -(1 - Math.min(1, k * 1.15)) * 1.35 + Math.sin(t * 17 + g.xa) * 0.09 * k;
        if (Math.abs(p.x - (g.xa + g.xb) / 2) < (g.xb - g.xa) / 2 + 12) howl = Math.max(howl, 0.1 + k * 0.35);
      }
      w.windLevel = howl;
      w.killY = Math.min(Y0 - 46, w.respawn.y - 46);
      // lightning
      if (game.state === 'playing' && !game.frozen) {
        if (storm.strikeAt < 0 && t > storm.next) { storm.strikeAt = t + 1.7; storm.warnAt = [t + 0.2, t + 0.8, t + 1.35]; }
        if (storm.strikeAt >= 0) {
          while (storm.warnAt.length && t >= storm.warnAt[0]) { storm.warnAt.shift(); storm.flickA = storm.warnAt.length ? 0.2 : 0.32; storm.flickers++; if (!storm.said) { storm.said = true; game.say('hotel.l15.flicker', { priority: 1 }); } }
          if (t >= storm.strikeAt) {
            if (safeSpot(p)) {
              storm.flashA = 1; storm.strikes++; storm.next = t + 12 + Math.random() * 6; storm.strikeAt = -1; storm.thunderAt = t + 0.6 + Math.random() * 1.0;
              const bx = p.x + (Math.random() - 0.5) * 80;
              const pa = boltGeo.attributes.position; let bxx = bx, byy = p.y + 60;
              for (let i = 0; i < 8; i++) { pa.setXYZ(i, bxx, byy, -90 - i * 0.3); bxx += (Math.random() - 0.5) * 7; byy -= 14; }
              pa.needsUpdate = true; bolt.visible = true;
            } else { storm.strikeAt = t + 0.4; w.hemi.intensity = hemiBase + 0.5; }        // waiting for you to stand on something wide (the sky stays bright)
          }
        }
      }
      storm.flickA = Math.max(0, storm.flickA - dt * 3.2);
      if (storm.flashA > 0) { storm.flashA = Math.max(0, storm.flashA - dt * (storm.flashA > 0.7 ? 2.0 : 1.5)); if (storm.flashA < 0.7) bolt.visible = false; }
      if (storm.strikeAt < 0 || safeSpot(p)) w.hemi.intensity = hemiBase + (storm.flashA > 0 ? storm.flashA * 3.2 : storm.flickA * 1.4);
      setFlash();
      if (storm.thunderAt > 0 && t > storm.thunderAt) { storm.thunderAt = -1; game.audio.rumble(1.6); }
    });

    // ================================================================================================================================
    //  Troll beats
    // ================================================================================================================================
    // stage 4: your mouse flips just as the gale comes (and the gale is forced on: that is the tell, the pennant is already stiff)
    twistZone(game, w, { x: twSill.x, y: twSill.y + 1.5, z: twSill.zc, w: twSill.len, h: 3.2, d: 3 }, 'mouseX', { sec: 7, say: 'hotel.l15.mirror' });
    w.trigger({ x: twSill.x, y: twSill.y + 1.5, z: twSill.zc, w: twSill.len, h: 3.2, d: 3, once: true, resetOnRespawn: true, onEnter: () => { gD.forced = w.t + 6; gD.wi.period = 0; } });
    w.onRespawn(() => { for (const g of gusts) if (g.forced) { g.forced = 0; g.wi.period = g.period; } });
    // stage 5: a lagging jump on the ladder
    twistZone(game, w, { x: rung2.x, y: rung2.y + 1.5, z: rung2.zc, w: rung2.len, h: 3.2, d: 3 }, 'lag', { sec: 6, say: 'hotel.l15.lag' });

    // ---- the host --------------------------------------------------------------------------------------------------------------------
    const once = (k, pl) => onPlat(w, pl, () => game.say(`hotel.l15.${k}`, { priority: 1 }));
    once('wind', ledges.find((l) => l.type === 'cornice').pl);
    once('ac', ledges.find((l) => l.type === 'ac').pl);
    once('crumble', cr1[0].pl);
    once('pipe', pp.pl);
    once('lift', lowSill.pl);
    once('gondola', preG.pl);
    once('gargoyle', gar1.pl);
    once('top', rung1.pl);
    once('gale', gale.pl);
    onPlat(w, vs2.pl, () => game.say('hotel.l15.vanish2', { priority: 1 }));
    w.hooks.onCheckpoint = (c) => {
      const i = cps.get(c);
      if (i === undefined) return;
      stageTitle(game, w, i + 2, NAMES.length, NAMES[i + 1]);
      game.say(`hotel.l15.w${i + 1}`, { priority: 1 });
    };
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l15.intro'); g.say('hotel.l15.intro2'); stageTitle(g, w, 1, NAMES.length, NAMES[0]); }
    };
    w.hooks.onDeath = (info) => {
      const p = game.player;
      if (info.reason === 'fake') return true;
      if (Math.random() < 0.3) {
        const gg = gusts.find((q) => q.k > 0.5 && p.x > q.xa - 2 && p.x < q.xb + 2);
        if (gg) { game.say('hotel.l15.gustdeath', { priority: 1 }); return true; }
      }
      if (Math.random() < 0.7) { game.say('hotel.l15.fall', { priority: 1, vars: { n: game.deaths } }); return true; }
      return false;
    };

    // ---- the hint: honest, the next stage only ---------------------------------------------------------------------------------------
    stageHint(w, stages, { flat: false });
    const base = w.hintFn;
    w.hintFn = (g) => {
      if (bonusOn) { const p = g.player; return [{ x: p.x, y: p.y + 0.15, z: p.z }, ...bonus.map((b) => ({ x: b.body.x, y: b.top + 0.15, z: b.body.z })).filter((q) => q.x > p.x - 1)]; }
      return base(g);
    };

    // ---- the bot: a guest who knows the lift's rhythm ------------------------------------------------------------------------------------
    w.botPlan = (g) => {
      const p = g.player;
      if (g.frozen || w.completed) return { x: p.x, z: p.z, wait: true };
      if (!p.grounded) return null;
      if (g.mods && g.mods.jumpLag > 0) return { x: p.x, z: p.z, wait: true };       // input lag: a careful guest waits it out
      for (const gt of gates) {                                                         // gale gates: wait in the lee for the lull
        if (p.x < gt.xa && p.x > gt.xa - 7 && Math.abs(p.y - gt.y) < 1.5) {
          const u = ((w.t + gt.phase) % gt.period + gt.period) % gt.period, lull = u >= gt.on ? gt.period - u : 0, need = (gt.xb - p.x) / 5.6 + 0.7;
          if (lull < need) return { x: p.x, z: p.z, wait: true };
        }
      }
      const k = route.findIndex((q) => q.body === p.ground);
      if (k < 0) return null;
      const here = route[k], next = route[k + 1];
      const atEnd = here === route[route.length - 1];
      if (atEnd && !bonusOn) return { x: fakeGoal.x, z: fakeGoal.z };
      if (!next) return null;
      const hb = here.body, nb = next.body;
      const level = (a, b) => Math.abs(a - b) < 0.3;
      if (next.kind === 'lift') return level(nb.top, hb.top) ? { body: nb } : { x: p.x, z: p.z, wait: true };
      if (here.kind === 'lift') return level(hb.top, nb.top) ? { body: nb } : { x: p.x, z: p.z, wait: true };
      const NEARGAP = (a, b) => Math.abs(Math.max(a.x - a.hx, b.x - b.hx) - Math.min(a.x + a.hx, b.x + b.hx)) < 1.5;
      if (next.kind === 'gondola' || next.kind === 'tram') return NEARGAP(hb, nb) ? { body: nb } : { x: p.x, z: p.z, wait: true };
      if (here.kind === 'gondola' || here.kind === 'tram') return NEARGAP(hb, nb) ? { body: nb } : { x: p.x, z: p.z, wait: true };
      if (!nb.enabled) return { x: p.x, z: p.z, wait: true };
      return null;
    };

    w.ledge = { ledges, winds: gusts.map((g) => g.wi), gusts, gondolas: [gond], lifts, trams, gates, stages, cps, route, bonus, fakeGoal, realGoal, storm, Y0, paint, flash,
      get bonusOn() { return bonusOn; }, set windScale(v) { windScale = v; } };
    void rnd; void softTexture; void textTexture; void vs1; void gar1; void upSill;
  },
};
