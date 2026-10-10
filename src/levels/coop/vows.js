import * as THREE from 'three';
import { chain } from '../common.js';
import { glowMaterial } from '../../engine/materials.js';
import { retreatEnv, deck, plate, gate, riser, lever, sign, roleSign, lantern, lake, stage, setDeathRule, beacon, COL } from './kit.js';
import { leapfrog, pedestal, liveSign } from './newlywed-kit.js';
import { button, board, panelBg, text } from './communication-kit.js';
import { dust } from './trust-falls-kit.js';
import { gustLamp } from './tethered-trek-kit.js';
import { vbots, decoy, strip, pews, arch, window3, laserRow, ringKit, sweeper } from './vows-kit.js';

// Session 10 — The Vows. The finale: a lakeside wedding chapel gauntlet that remixes everything. Ten stages:
// 1 processional (colour plates, leapfrog bridge, lever relay), 2 something old (two walls: stand on a head, then swap), 3 something new
// (one of you cannot see the path; decoys for the blind; ferry + elevator; swap), 4 something borrowed (split-information keypad, the
// counsellor lies to both), 5 something blue (rope over a flooded nave with gusts), 6 the vows (choose privately, guess the other; a wrong guess
// opens the scenic route), 7 the ring bearer (carry the ring down a laser aisle while the other switches the beams off from a side lane),
// 8 the counsellor (he sweeps the hall; hide in the bays and open the doors together), 9 a fake "I do" (lying counsellor, decoy exits),
// 10 the real one: a rope, crumbling steps and the circle. Death rule changes per stage: self -> revive -> self -> both -> self -> both.
// Dusk to night over the lake. First-time pairs: 11-13 minutes.

export default {
  id: 'coop10',
  name: 'The Vows',
  music: 'l1',
  deathRule: 'self',
  completeQuip: 'Ten sessions. Two of you. One counsellor, billing you for all of it. I now pronounce you: adequate.',
  titleCam: { center: [0, 2, -60], radius: 30, height: 12 },

  build(w, game) {
    retreatEnv(w, { mood: 'dusk' });
    lake(w, -30);
    const c = w.coop, me = c.me, N = c.names, P = c.partner;
    const tell = (r, k, o) => c.tell(r, k, o);
    const gp = () => game.player;
    w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    const B = { p1: [], p2: [] };                                        // bot plans, stage after stage
    const both = (...s) => { B.p1.push(...s.map((o) => ({ ...o }))); B.p2.push(...s.map((o) => ({ ...o }))); };
    const rule = (r) => () => setDeathRule(w, r);

    // ============================================================ 1. the processional ================================
    deck(w, { x: 0, y: 0, z: -12, w: 22, d: 36, path: true });                       // z +6 … -30
    sign(w, 'SERENITY FALLS · THE CHAPEL', 0, 5.2, 4, { w: 12, h: 1.6 });
    sign(w, 'SESSION 10: THE VOWS', 0, 3.6, 4, { w: 8, h: 1, border: '#ff9fb8' });
    for (const lx of [-9, 9]) { lantern(w, lx, 0, 2); lantern(w, lx, 0, -22); }
    pews(w, { x: -8.5, y: 0, z: -2, count: 3, gap: 3, len: 4 }); pews(w, { x: 8.5, y: 0, z: -2, count: 3, gap: 3, len: 4 });
    const g1 = gate(w, { x: 0, z: -26, w: 22, h: 5 });
    sign(w, 'STAND ON YOUR OWN COLOUR · THE AISLE OPENS', 0, 6.4, -25.5, { w: 11, h: 1.2 });
    const door = { t: 0 };
    const pa = plate(w, { x: -6, y: 0, z: -12, need: 'p1', label: N.p1 });
    const pb = plate(w, { x: 6, y: 0, z: -12, need: 'p2', label: N.p2 });
    w.updaters.push((dt) => { door.t = pa.pressed && pb.pressed ? 9 : Math.max(0, door.t - dt); g1.set(door.t > 0); });
    stage(w, 'welcome', { x: 0, y: 1, z: 2, w: 30, h: 4, d: 8 }, () => { tell('p1', 'coop.l10.intro.p1', { priority: 2 }); tell('p2', 'coop.l10.intro.p2', { priority: 2 }); });
    stage(w, 'plates', { x: 0, y: 1, z: -9, w: 22, h: 4, d: 5 }, () => tell('all', 'coop.l10.plates'));
    w.checkpoint({ x: 0, y: 0, z: -29, real: true });
    // the bridge to the aisle: one holds, one crosses, swap
    const lf = leapfrog(w, { ox: 0, ys: 0, islands: [-34, -50], first: 'p1', iw: 10, id: 8, path: true });
    stage(w, 'bridge', { x: 0, y: 1, z: -34, w: 10, h: 4, d: 6 }, () => tell('all', 'coop.l10.bridge'));
    w.checkpoint({ x: 0, y: 0, z: -50, real: true });
    // the aisle door: a long hall, a lever at each end, and five seconds
    const H0 = -54, GZ = -94;
    deck(w, { x: 0, y: 0, z: -74, w: 12, d: 40, path: true });
    for (let k = 0; k < 4; k++) { lantern(w, -5.5, 0, -60 - k * 9); lantern(w, 5.5, 0, -60 - k * 9); }
    const g2 = gate(w, { x: 0, z: GZ, w: 12, h: 5 });
    const open2 = { t: 0 };
    const mk = (key, x, z) => lever(w, { x, y: 0, z, key, label: 'Pull the lever', toggle: false }, (on) => { if (on) { open2.t = 5; w.game.audio.confirm?.(); } });
    mk('leverA', -4, H0 - 3);
    mk('leverB', 4, GZ - 4);
    w.updaters.push((dt) => {
      open2.t = Math.max(0, open2.t - dt); g2.set(open2.t > 0);
      for (const k of ['leverA', 'leverB']) if (c.get(k) === true && open2.t <= 0) c.set(k, false);
    });
    sign(w, 'THE AISLE DOOR STAYS OPEN FIVE SECONDS. THE AISLE IS 40 METRES. THE LEVERS ARE AT EACH END.', 0, 7.2, GZ + 1.5, { w: 11, h: 2, size: 30 });
    stage(w, 'dash', { x: 0, y: 1, z: H0 - 6, w: 12, h: 4, d: 6 }, () => tell('all', 'coop.l10.dash'));
    deck(w, { x: 0, y: 0, z: -101, w: 12, d: 14, path: true });                       // z -94 … -108
    stage(w, 'dashdone', { x: 0, y: 1, z: GZ - 5, w: 12, h: 4, d: 4 }, () => tell('all', 'coop.l10.dashdone'));
    w.checkpoint({ x: 0, y: 0, z: -102, real: true });
    both({ x: 0, z: -33, r: 1.5 });
    B.p1.splice(0, 0, { x: -6, z: -12, r: 0.8, until: () => g1.passable });
    B.p2.splice(0, 0, { x: 6, z: -12, r: 0.8, until: () => g1.passable });
    B.p1.push(...lf.steps('p1')); B.p2.push(...lf.steps('p2'));
    B.p1.push({ x: -4, z: H0 - 3, r: 0.8, until: () => P.has && P.sz < GZ + 6 }, { x: -4, z: H0 - 3, r: 0.8, use: true, until: () => open2.t > 0 }, { x: 0, z: GZ + 3, r: 1.5 }, { x: 0, z: GZ - 6, r: 2 });
    B.p2.push({ x: 0, z: GZ + 3, r: 1, until: () => g2.passable }, { x: 4, z: GZ - 4, r: 1.5 }, { x: 4, z: GZ - 4, r: 1.5, until: () => P.has && P.sz < GZ + 20 }, { x: 4, z: GZ - 4, r: 1.5, use: true, until: () => open2.t > 3 });

    // ============================================================ 2. something old: two walls, then swap ==============
    // wall 1 (3 m): p2 is the step, p1 climbs; wall 2 (3 m more): p1 is the step, p2 climbs. Each wall has a lift for the one who was the step.
    const climb = (zf, y0, booster) => {
      const climber = booster === 'p1' ? 'p2' : 'p1';
      deck(w, { x: 0, y: y0 + 3, z: zf - 7, w: 16, d: 14, h: 3, path: true });
      w.plat({ x: 1.75, y: y0 + 1.2, z: zf + 1.25, w: 2.5, d: 2.5, h: 1.2, tex: 'wood', color: 0xb98a55 });
      const lift = riser(w, { x: 5.5, y: y0 + 3, z: zf + 4, w: 3.2, d: 3.2, h: 0.6, drop: 3, always: true, speed: 4.2, color: 0xe9d9b0, trim: COL.good });
      const px = plate(w, { x: -4, y: y0 + 3, z: zf - 4, need: 'any', label: 'LIFT: STAND HERE' });
      w.updaters.push(() => lift.set(px.pressed));
      sign(w, `${N[booster]}: BE THE STEP · ${N[climber]}: CLIMB`, 0, y0 + 6.6, zf + 0.3, { w: 11, h: 1.2, size: 32 });
      sign(w, 'THE LIFT WORKS FROM THE PLATE', 5.5, y0 + 5.6, zf + 4, { w: 5.4, h: 1.0, size: 30 });
      const ready = () => P.has && Math.abs(P.sx) < 0.8 && Math.abs(P.sz - (zf + 0.5)) < 0.8 && P.g;
      return {
        boost: [{ x: 0, z: zf + 0.5, r: 0.25, until: () => P.has && P.sy > y0 + 2.7 }, { x: 5.5, z: zf + 4, r: 1, until: () => gp().y > y0 + 2.7 }],
        climb: [
          { x: 1.8, z: zf + 4.5, r: 0.8 },
          { wait: ready },
          { x: 1.8, z: zf + 1.1, r: 0.2, until: () => gp().y > y0 + 1.1 && gp().grounded },
          { x: () => P.sx, z: () => P.sz, jump: 1.3, stop: 0.4, r: 0.08, until: () => gp().y > y0 + 1.6 && gp().grounded },
          { x: 0, z: zf - 4, jump: 3, until: () => gp().y > y0 + 2.8 && gp().grounded },
          { x: -4, z: zf - 4, r: 0.6, until: () => P.has && P.sy > y0 + 2.7 },
        ],
      };
    };
    const W1 = climb(-108, 0, 'p2'), W2 = climb(-122, 3, 'p1');
    stage(w, 'wall1', { x: 0, y: 1, z: -104, w: 12, h: 4, d: 4 }, () => tell('all', 'coop.l10.wall1'));
    stage(w, 'wall2', { x: 0, y: 4, z: -118, w: 16, h: 4, d: 4 }, () => tell('all', 'coop.l10.wall2'));
    w.checkpoint({ x: 0, y: 3, z: -114, real: true });
    B.p1.push(...W1.climb, ...W2.boost);
    B.p2.push(...W1.boost, ...W2.climb);
    both({ follow: true, until: () => gp().z < -125 && gp().y > 5.5 });
    w.checkpoint({ x: 0, y: 6, z: -130, real: true });

    // ============================================================ 3. something new: the invisible path ================
    const Y2 = 6;
    const zV = -136;                                                                  // V ends here
    const fade = (role, arr) => arr.forEach((pl) => { pl.group.visible = me !== role; });         // `role` cannot see these (they are still solid)
    const lies = (role, arr, x = 5.4) => arr.forEach((pl) => decoy(w, role, { x: pl.body.x + x, y: pl.body.top, z: pl.body.z, w: pl.body.hx * 2, d: pl.body.hz * 2, h: 1, tex: 'wood', color: 0xe3d3ac }));
    stage(w, 's3', { x: 0, y: 7, z: -130, w: 16, h: 4, d: 8 }, () => { setDeathRule(w, 'revive'); tell('p1', 'coop.l10.new1.p1', { priority: 2 }); tell('p2', 'coop.l10.new1.p2', { priority: 2 }); });
    // stretch A: p2 cannot see (p1 guides)
    const A1 = chain(w, { x: 0, y: Y2, z: zV }, [{ gap: 2.4, d: 4, w: 4.5 }, { gap: 2.8, d: 4, w: 4.5, dy: 0.5 }, { gap: 3.0, d: 4, w: 4.5, dy: -0.4 }, { gap: 2.6, d: 4, w: 4.5 }]);
    const fA = w.plat({ x: 0, y: A1.endY, z: A1.endZ - 5.5, w: 4.5, d: 5, h: 0.7, moving: true, path: true, tex: 'wood', color: 0xd9c9a0 });
    w.mover(fA, (t) => ({ z: -Math.sin((t / 9) * Math.PI * 2) * 3 }));
    const A2 = chain(w, { x: 0, y: A1.endY, z: A1.endZ }, [{ gap: 11, d: 4, w: 4.5 }, { gap: 2.6, d: 4, w: 4.5, dy: 0.4 }, { gap: 2.8, d: 4, w: 4.5 }]);
    const hubA = deck(w, { x: 0, y: A2.endY, z: A2.endZ - 2.6 - 4, w: 12, d: 8, path: true });
    const hubAz = A2.endZ - 2.6 - 4, yA = A2.endY;
    const stonesA = [...A1, fA, ...A2];
    fade('p2', stonesA);
    lies('p2', [...A1, ...A2]);
    dust(w, { who: 'p2', x0: -12, x1: 12, y0: Y2 - 3, y1: Y2 + 3.5, z0: hubAz, z1: zV, count: 420 });
    roleSign(w, 'p2', 'YOU CAN\'T SEE THE PATH. THE PRETTY ONES ARE LIES.', 0, Y2 + 4.2, zV - 1, { w: 9, h: 1.5, size: 32 });
    roleSign(w, 'p1', 'YOU SEE THE PATH. THEY SEE DECOYS. GUIDE THEM.', 0, Y2 + 4.2, zV - 1, { w: 9, h: 1.5, size: 32 });
    w.checkpoint({ x: 0, y: yA, z: hubAz, real: true });
    stage(w, 's3mid', { x: 0, y: Y2 + 2, z: fA.base.z, w: 12, h: 5, d: 8 }, () => tell('all', 'coop.l10.newmid'));
    // stretch B: p1 cannot see (p2 guides), with an elevator
    stage(w, 's3b', { x: 0, y: yA + 1, z: hubAz, w: 12, h: 4, d: 8 }, () => { tell('p2', 'coop.l10.new2.p2', { priority: 2 }); tell('p1', 'coop.l10.new2.p1', { priority: 2 }); });
    const B1 = chain(w, { x: 0, y: yA, z: hubAz - 4 }, [{ gap: 2.4, d: 4, w: 4.5 }, { gap: 2.8, d: 4, w: 4.5, dy: -0.4 }, { gap: 2.6, d: 4, w: 4.5, dy: 0.4 }]);
    const elev = w.plat({ x: 0, y: B1.endY, z: B1.endZ - 1 - 2.5, w: 4.5, d: 5, h: 0.7, moving: true, path: true, tex: 'wood', color: 0xd9c9a0 });
    w.mover(elev, (t) => ({ y: 1.5 + 1.5 * Math.sin((t / 7) * Math.PI * 2 - Math.PI / 2) }));        // y … y+3
    const yE = B1.endY + 3;
    const B2 = chain(w, { x: 0, y: yE, z: B1.endZ - 6.5 }, [{ gap: 1, d: 4, w: 4.5 }, { gap: 2.6, d: 4, w: 4.5, dy: 0.4 }, { gap: 2.8, d: 4, w: 4.5, dy: -0.3 }]);
    const stonesB = [...B1, elev, ...B2];
    fade('p1', stonesB);
    lies('p1', [...B1, ...B2]);
    const Y3 = B2.endY;
    const hubBz = B2.endZ - 2.6 - 5;
    deck(w, { x: 0, y: Y3, z: hubBz, w: 14, d: 10, path: true });
    dust(w, { who: 'p1', x0: -12, x1: 12, y0: yA - 3, y1: Y3 + 3.5, z0: hubBz, z1: hubAz - 4, count: 420 });
    roleSign(w, 'p1', 'YOUR TURN TO BE BLIND. IT IS CALLED GROWTH.', 0, yA + 4.2, hubAz - 5, { w: 9, h: 1.5, size: 32 });
    roleSign(w, 'p2', 'YOUR TURN TO SEE. IT IS CALLED POWER.', 0, yA + 4.2, hubAz - 5, { w: 9, h: 1.5, size: 32 });
    w.checkpoint({ x: 0, y: Y3, z: hubBz, real: true });
    stage(w, 's3done', { x: 0, y: Y3 + 1, z: hubBz, w: 14, h: 4, d: 8 }, () => tell('all', 'coop.l10.newdone'));
    // bots: both just walk the path (they have the coordinates, being bots)
    both({ follow: true, until: () => gp().z < hubBz + 3 && gp().y > Y3 - 1 });
    void hubA;

    // ============================================================ 4. something borrowed: the lying keypad ==============
    const K0 = hubBz - 5;                                                             // keypad deck starts here
    deck(w, { x: 0, y: Y3, z: K0 - 16, w: 22, d: 32, path: true });                    // K0 … K0-32
    pews(w, { x: -9, y: Y3, z: K0 - 3, count: 2, gap: 3, len: 4 }); pews(w, { x: 9, y: Y3, z: K0 - 3, count: 2, gap: 3, len: 4 });
    const rc = c.rng(10);
    const digit = () => 1 + Math.floor(rc() * 5);
    const code = [digit(), digit(), digit()];
    const bump = (d) => (d % 5) + 1;
    const lieA = [code[0], bump(code[1]), code[2]], lieB = [bump(code[0]), code[1], code[2]];      // what the counsellor says to p1 / p2
    const hex = (v) => '#' + v.toString(16).padStart(6, '0');
    const half = (who, lines, title) => (see) => (g, W, H) => {
      if (!see) { panelBg(g, W, H, '#555a66', '#101219'); text(g, 'SEALED', W / 2, H * 0.36, Math.min(H * 0.24, 54), '#6b7080'); text(g, 'FOR ' + (who === 'p1' ? 'ORANGE' : 'TEAL') + ' ONLY', W / 2, H * 0.7, Math.min(H * 0.12, 24), '#6b7080'); return; }
      panelBg(g, W, H, hex(COL[who]));
      text(g, title, W / 2, H * 0.17, Math.min(H * 0.1, 26), '#ffe9b8');
      lines.forEach((l, i) => text(g, l, W / 2, H * (0.42 + i * 0.26), Math.min(H * 0.17, 40)));
    };
    const bd = (x, who, lines, title) => board(w, { x, y: Y3 + 3.6, z: K0 - 2, width: 6, height: 3, px: 600, rotY: 0, draw: { all: half(who, lines, title)(me === who) } });
    bd(-5.5, 'p1', [`FIRST DIGIT: ${code[0]}`, `THIRD DIGIT: ${code[2]}`], 'THE BINDER · ORANGE PAGE');
    bd(5.5, 'p2', [`SECOND DIGIT: ${code[1]}`], 'THE BINDER · TEAL PAGE');
    sign(w, 'THE COUNSELLOR ALSO HAS A CODE FOR YOU. IT IS A LOVELY CODE.', 0, Y3 + 7.2, K0 - 2, { w: 11, h: 1.4, size: 30 });
    const kp = { lock: 0 };
    const gK = gate(w, { x: 0, y: Y3, z: K0 - 31, w: 22, h: 5 });
    const KB = [1, 2, 3, 4, 5].map((d, i) => button(w, { x: -6 + i * 3, y: Y3, z: K0 - 18, label: String(d), color: 0xfff3d0, onPress: () => {
      if (kp.lock > 0 || c.get('kp:n', 0) >= 3) return;
      const n = c.get('kp:n', 0);
      if (d === code[n]) c.set('kp:n', n + 1);
      else { c.set('kp:n', 0); c.set('kp:bad', c.get('kp:bad', 0) + 1); }
    } }));
    c.on('kp:n', (v) => { if (v >= 3) { gK.set(true); tell('all', 'coop.l10.kp.ok'); } else if (v > 0) KB.forEach((b) => b.flash(0x3ddc97, 0.4)); });
    c.on('kp:bad', () => { kp.lock = 3; KB.forEach((b) => b.flash(0xff4d5e, 2.5)); tell('all', 'coop.l10.kp.bad'); });
    w.updaters.push((dt) => { if (kp.lock > 0) kp.lock -= dt; });
    stage(w, 'borrowed', { x: 0, y: Y3 + 1, z: K0 - 6, w: 22, h: 4, d: 6 }, () => {
      rule('self')();
      tell('p1', 'coop.l10.borrowed.p1', { priority: 2, vars: { code: lieA.join('-') } });
      tell('p2', 'coop.l10.borrowed.p2', { priority: 2, vars: { code: lieB.join('-') } });
    });
    w.checkpoint({ x: 0, y: Y3, z: K0 - 8, real: true });
    B.p1.push(...[0, 1, 2].map((k) => ({ press: true, x: () => KB[code[k] - 1].stand.x, z: () => KB[code[k] - 1].stand.z, r: 0.45, face: { get x() { return KB[code[k] - 1].x; }, get z() { return KB[code[k] - 1].z; } }, until: () => c.get('kp:n', 0) > k })));
    B.p2.push({ x: 0, z: K0 - 12, r: 1.5, until: () => gK.passable });
    both({ x: 0, z: K0 - 34, r: 2 });

    // ============================================================ 5. something blue: the flooded nave =================
    const N0 = K0 - 44;                                                               // first hub: z K0-32 … N0
    deck(w, { x: 0, y: Y3, z: N0 + 6, w: 14, d: 12, path: true });
    const NY = Y3;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(70, 110), new THREE.MeshStandardMaterial({ color: 0x4a8fb0, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.8 }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, NY - 2.2, N0 - 56); w.add(water);
    for (let k = 0; k < 5; k++) { for (const sx of [-1, 1]) w.box({ x: sx * 15, y: NY + 2.5, z: N0 - 12 - k * 20, w: 1.4, h: 5, d: 1.4, color: 0xe8dcc2, shadow: false }); }
    for (let k = 0; k < 3; k++) window3(w, -17, NY + 1.5, N0 - 20 - k * 25, Math.PI / 2, 6), window3(w, 17, NY + 1.5, N0 - 20 - k * 25, -Math.PI / 2, 6);
    stage(w, 'blue', { x: 0, y: NY + 1, z: N0 + 4, w: 14, h: 4, d: 6 }, () => { c.tether({ max: 9, k: 12, rope: true, on: true }); rule('both')(); tell('all', 'coop.l10.blue'); });
    const GUST = { period: 6, on: 1.8, warn: 1.5 };
    let rz = N0;
    const pewSpec = [{ d: 6, wd: 8 }, { d: 6, wd: 8 }, { d: 6, wd: 7 }, { d: 10, wd: 4.2 }, { d: 6, wd: 7 }, { d: 6, wd: 6 }, { d: 10, wd: 4.2 }, { d: 6, wd: 8 }];
    pewSpec.forEach((s, i) => {
      const gap = 2.8, near = rz; rz -= gap;
      const zc = rz - s.d / 2;
      const pl = w.plat({ x: 0, y: NY, z: zc, w: s.wd, d: s.d, h: 1, tex: 'wood', color: 0x9a6b40, path: true });
      void pl;
      if (i >= 1 && i <= 6) {
        const ph = i * 2.1;
        w.wind({ x: 0, y: NY + 1.6, z: near - (gap + s.d) / 2, w: s.wd + 6, h: 4, d: gap + s.d, dx: i % 2 ? 1 : -1, dz: 0, strength: s.wd < 5 ? 3.0 : 2.4, period: GUST.period, on: GUST.on, phase: ph });
        gustLamp(w, -(s.wd / 2 - 0.2), NY, zc + s.d / 2 - 0.8, { period: GUST.period, on: GUST.on, phase: ph, warn: GUST.warn });
      }
      if (i === 3) w.checkpoint({ x: 0, y: NY, z: zc, real: true });
      rz -= s.d;
    });
    const nz1 = rz;
    deck(w, { x: 0, y: NY, z: nz1 - 2.8 - 5, w: 14, d: 10, path: true });
    const nzEnd = nz1 - 12.8;
    w.checkpoint({ x: 0, y: NY, z: nz1 - 2.8 - 5, real: true });
    stage(w, 'bluemid', { x: 0, y: NY + 1, z: N0 - 36, w: 12, h: 4, d: 6 }, () => tell('all', 'coop.l10.gust'));
    stage(w, 'bluedone', { x: 0, y: NY + 1, z: nz1 - 7, w: 14, h: 4, d: 6 }, () => { c.tether({ on: false }); rule('self')(); tell('all', 'coop.l10.bluedone'); });
    both({ follow: true, until: () => gp().z < nz1 - 4 && gp().y > NY - 1 });

    // ============================================================ 6. the vows ===========================================
    const V0 = nzEnd;                                                                  // deck z V0 … V0-26, x ±14
    const VY = NY;
    deck(w, { x: 0, y: VY, z: V0 - 13, w: 28, d: 26, path: true });
    arch(w, 0, VY, V0 - 25, { wide: 8, tall: 6 });
    pews(w, { x: 0, y: VY, z: V0 - 4, count: 1, gap: 2, len: 6 });
    const VOWS = ['HONESTY', 'SNACKS', 'THE REMOTE'];
    const vz = [V0 - 7, V0 - 13, V0 - 19];
    const info = liveSign(w, { x: 0, y: VY + 4.6, z: V0 - 13, w: 11, h: 2.6, tw: 760, border: '#ff9fb8' });
    const res = { done: false, alt: false };
    const phase = () => (c.get('vow:p1') === undefined || c.get('vow:p2') === undefined ? 'choose' : c.get('guess:p1') === undefined || c.get('guess:p2') === undefined ? 'guess' : 'done');
    const peds = {};
    for (const role of ['p1', 'p2']) {
      const x = role === 'p1' ? -10 : 10;
      peds[role] = VOWS.map((v, i) => pedestal(w, { x, y: VY, z: vz[i], role, label: v, color: COL[role], signW: 2.6, onPress: () => {
        const ph = phase();
        if (ph === 'choose') c.set('vow:' + role, i);
        else if (ph === 'guess' && c.get('guess:' + role) === undefined) c.set('guess:' + role, i);
      } }));
    }
    const refresh = () => {
      const ph = phase();
      for (const role of ['p1', 'p2']) peds[role].forEach((p, i) => {
        p.label(ph === 'guess' && role === me ? 'GUESS: ' + VOWS[i] : VOWS[i]);
        p.lit(ph === 'choose' ? c.get('vow:' + role) === i : ph === 'guess' ? c.get('guess:' + role) === i : false);
      });
      if (res.done) return;
      if (ph === 'choose') info.set(`PICK YOUR VOW. IN SECRET.\n(The buttons on YOUR side. Say nothing.)`);
      else if (ph === 'guess') info.set(`NOW GUESS THEIRS.\n(Talk. Lie. Whatever helps.)`);
    };
    const gV = gate(w, { x: 0, y: VY, z: V0 - 26, w: 28, h: 6, color: 0xe8dcc2, glow: 0xff9fb8 });
    const altX = 18, altZ = [V0 - 6, V0 - 12.4, V0 - 18.8, V0 - 25.2], altDy = [0, 0.5, 0.9, 0.3];
    const alt = altZ.map((z, i) => riser(w, { x: altX, y: VY + altDy[i], z, w: 3.4, d: 3.4, h: 0.8, drop: 6, speed: 7, color: 0xcdb48a, trim: 0xff9fb8 }));
    deck(w, { x: 0, y: VY, z: V0 - 34, w: 28, d: 16, path: true });                   // z V0-26 … V0-42
    const resolve = () => {
      if (res.done || phase() !== 'done') return;
      res.done = true;
      const ok1 = c.get('guess:p1') === c.get('vow:p2'), ok2 = c.get('guess:p2') === c.get('vow:p1');
      res.alt = !(ok1 && ok2);
      const vv = (r) => VOWS[c.get('vow:' + r)];
      info.set(`ORANGE VOWED: ${vv('p1')}\nTEAL VOWED: ${vv('p2')}\n${res.alt ? (ok1 || ok2 ? 'ONE OF YOU WAS WRONG.' : 'BOTH OF YOU WERE WRONG.') : 'BOTH RIGHT. SHOCKING.'}`, { color: res.alt ? '#ffb02e' : '#3ddc97', border: res.alt ? '#ffb02e' : '#3ddc97' });
      if (!res.alt) { gV.set(true); tell('all', 'coop.l10.vows.right'); }
      else { alt.forEach((a) => a.set(true)); tell(ok1 ? 'p2' : 'p1', 'coop.l10.vows.wrong.you'); tell(ok1 ? 'p1' : 'p2', 'coop.l10.vows.wrong.they'); if (!ok1 && !ok2) tell('all', 'coop.l10.vows.both'); }
    };
    for (const k of ['vow:p1', 'vow:p2', 'guess:p1', 'guess:p2']) c.on(k, () => { refresh(); resolve(); });
    refresh();
    sign(w, 'A WRONG GUESS OPENS THE SCENIC ROUTE. IT IS FOR PEOPLE WHO LIKE VIEWS.', 0, VY + 7.5, V0 - 25.4, { w: 11, h: 1.6, size: 28 });
    stage(w, 'vows', { x: 0, y: VY + 1, z: V0 - 3, w: 28, h: 4, d: 6 }, () => { tell('p1', 'coop.l10.vows.intro.p1', { priority: 2 }); tell('p2', 'coop.l10.vows.intro.p2', { priority: 2 }); });
    w.checkpoint({ x: 0, y: VY, z: V0 - 5, real: true });
    const guessRight = c.rng(77)() < 0.5;                                              // the bots flip a coin so both routes get exercised
    const pedStand = (role, i) => ({ x: role === 'p1' ? -8.4 : 8.4, z: vz[i] });
    const pickStep = (role, i, until) => { const s = pedStand(role, i); return { press: true, x: s.x, z: s.z, r: 0.5, face: { x: role === 'p1' ? -10 : 10, z: vz[i] }, until }; };
    B.p1.push(pickStep('p1', 0, () => c.get('vow:p1') !== undefined));
    B.p2.push(pickStep('p2', 1, () => c.get('vow:p2') !== undefined));
    B.p1.push({ wait: () => phase() !== 'choose' });
    B.p2.push({ wait: () => phase() !== 'choose' });
    B.p1.push({ choose: () => [pickStep('p1', guessRight ? 1 : 2, () => c.get('guess:p1') !== undefined)] });          // p2 vowed #1
    B.p2.push({ choose: () => [pickStep('p2', guessRight ? 0 : 1, () => c.get('guess:p2') !== undefined)] });          // p1 vowed #0
    both({ wait: () => res.done });
    const route = () => (res.alt
      ? [{ x: 12, z: altZ[0], r: 0.9 }, ...altZ.map((z, i) => ({ x: altX, z, r: 1.0 })), { x: 8, z: V0 - 30, r: 2 }]
      : [{ x: 0, z: V0 - 24, r: 1.5, until: () => gV.passable }, { x: 0, z: V0 - 30, r: 2 }]);
    both({ choose: route });
    both({ follow: true, until: () => gp().z < V0 - 31 });

    // ============================================================ 7. the ring bearer =====================================
    const R0 = V0 - 42;                                                                // deck z R0 … R0-10 (both lanes)
    const RY = VY;
    deck(w, { x: 0, y: RY, z: R0 - 5, w: 32, d: 10, path: true });
    const ring = ringKit(w, { key: 'ring', x: 0, y: RY, z: R0 - 5 });
    sign(w, 'THE RING GOES IN YOUR HANDS. THE WAY GOES IN THEIRS.', 0, RY + 5.6, R0 - 1, { w: 11, h: 1.4, size: 30 });
    deck(w, { x: 0, y: RY, z: R0 - 30, w: 8, d: 40, path: true });                    // the aisle R0-10 … R0-50
    deck(w, { x: 13, y: RY, z: R0 - 30, w: 6, d: 40 });                                 // the side lane (nothing can cross the gap)
    sign(w, 'THE BEARER WALKS HERE', 0, RY + 4.2, R0 - 12, { w: 5, h: 0.9, size: 28 });
    sign(w, 'THE OTHER WALKS HERE', 13, RY + 4.2, R0 - 12, { w: 5, h: 0.9, size: 28 });
    for (let k = 0; k < 8; k++) { w.box({ x: 4.2, y: RY + 0.6, z: R0 - 14 - k * 5, w: 0.3, h: 1.2, d: 0.3, color: 0xe8dcc2, shadow: false }); w.box({ x: -4.2, y: RY + 0.6, z: R0 - 14 - k * 5, w: 0.3, h: 1.2, d: 0.3, color: 0xe8dcc2, shadow: false }); }
    const rowZ = [R0 - 20, R0 - 32, R0 - 44];
    const rp = rowZ.map((z, i) => plate(w, { x: 13, y: RY, z, size: 3, need: 'any', hold: 3.4, label: 'HOLD THE BEAMS OFF' }));
    const rows = rowZ.map((z, i) => laserRow(w, { x: 0, y: RY, z, width: 8, period: i === 2 ? 4 : 3, on: i === 2 ? 1.1 : 3, warn: i === 2 ? 1 : 0, offset: i * 1.3, off: () => rp[i].pressed }));
    const RZ1 = R0 - 50;
    deck(w, { x: 0, y: RY, z: RZ1 - 7, w: 32, d: 14, path: true });                    // R0-50 … R0-64
    const gR = gate(w, { x: 0, y: RY, z: RZ1 - 13, w: 32, h: 6, color: 0xe8dcc2, glow: 0xffe27a });
    ring.altar(0, RY, RZ1 - 8, () => { gR.set(true); tell('all', 'coop.l10.ring.placed'); });
    arch(w, 0, RY, RZ1 - 11, { wide: 7, tall: 5 });
    w.checkpoint({ x: 0, y: RY, z: R0 - 12, real: true });
    w.checkpoint({ x: 0, y: RY, z: RZ1 - 3, real: true });
    deck(w, { x: 0, y: RY, z: RZ1 - 20, w: 32, d: 12, path: true });                   // RZ1-14 … RZ1-26
    c.on('ring', (v) => {
      if (v === 'start' || v === 'placed') return;
      tell(v, 'coop.l10.ring.bearer'); tell(v === 'p1' ? 'p2' : 'p1', 'coop.l10.ring.clear');
    });
    stage(w, 'ring', { x: 0, y: RY + 1, z: R0 - 3, w: 30, h: 4, d: 4 }, () => { tell('all', 'coop.l10.ring.intro'); });
    B.p1.push({ press: true, x: 0, z: R0 - 7.5, r: 0.5, face: { x: 0, z: R0 - 5 }, until: () => ring.holder === 'p1' });
    B.p2.push({ x: 13, z: R0 - 9, r: 1.2, until: () => ring.holder === 'p1' });
    for (let i = 0; i < 3; i++) {
      B.p2.push({ x: 13, z: rowZ[i], r: 0.6, until: () => P.has && P.sz < rowZ[i] - 3 });
      B.p1.push({ x: 0, z: rowZ[i] + 3, r: 1.0, until: () => rp[i].pressed });
      B.p1.push({ x: 0, z: rowZ[i] - 3, r: 0.8 });
    }
    B.p2.push({ x: 13, z: RZ1 - 1, r: 1.2 }, { x: 4, z: RZ1 - 4, r: 1.5 });
    B.p1.push({ x: 0, z: RZ1 - 4, r: 1.0 });
    B.p1.push({ press: true, x: 0, z: RZ1 - 6.4, r: 0.5, face: { x: 0, z: RZ1 - 8 }, until: () => ring.placed });
    both({ x: 0, z: RZ1 - 11, r: 1.5, until: () => gR.passable }, { x: 0, z: RZ1 - 15, r: 2 });

    // ============================================================ 8. the counsellor ===================================
    const S0 = RZ1 - 26;                                                               // hall start: the lane begins where the vestibule ends
    const HY = RY;
    const segN = 24;
    const lane = deck(w, { x: 0, y: HY, z: S0 - 39, w: 14, d: 78, path: true });         // lane S0 … S0-78
    void lane;
    for (let k = 0; k < 3; k++) {
      pews(w, { x: -3.5, y: HY, z: S0 - 8 - k * segN, count: 1, len: 3 }); pews(w, { x: 3.5, y: HY, z: S0 - 8 - k * segN, count: 1, len: 3 });
    }
    const sw = [
      sweeper(w, { y: HY, zNear: S0 - 4, zFar: S0 - 25, half: 7, speed: 5, period: 10, phase: 0 }),
      sweeper(w, { y: HY, zNear: S0 - 28, zFar: S0 - 49, half: 7, speed: 5, period: 12, phase: 3, toward: true }),
      sweeper(w, { y: HY, zNear: S0 - 52, zFar: S0 - 73, half: 7, speed: 5.5, period: 9.5, phase: 6 }),
    ];
    // bays (safe pillars) beside the lane: near and far in each segment
    const bayZ = (k, far) => S0 - 4 - k * segN - (far ? 18 : 3);
    const bay = (sx, z) => { deck(w, { x: sx * 10.5, y: HY, z, w: 7, d: 7, h: 1, tex: 'wood', color: 0xe3d3ac }); w.box({ x: sx * 13.8, y: HY + 1.4, z, w: 0.7, h: 2.8, d: 0.7, color: 0xe8dcc2, shadow: false }); lantern(w, sx * 13, HY, z + 2.5); };
    for (let k = 0; k < 3; k++) for (const far of [false, true]) for (const sx of [-1, 1]) bay(sx, bayZ(k, far));
    const GZs = [S0 - 27, S0 - 51, S0 - 75];
    const G = GZs.map((z) => gate(w, { x: 0, y: HY, z, w: 14, h: 6, color: 0x6b4a2e, glow: 0xff9fb8 }));
    sign(w, 'THE COUNSELLOR WALKS THE LANE AT A STEADY 5 M/S. THE BAYS ARE SAFE. ALL OF THEM.', 0, HY + 6.5, S0 - 1, { w: 11, h: 1.8, size: 28 });
    // doors: segment 1 and 2 need two plates (held together) at opposite ends; segment 3 needs both far plates
    const mkP = (k, role, sx, far, hold) => plate(w, { x: sx * 10.5, y: HY, z: bayZ(k, far), size: 3, need: role, hold, label: N[role] });
    const D1 = { a: mkP(0, 'p1', -1, false, 9), b: mkP(0, 'p2', 1, true, 9) };
    const D2 = { a: mkP(1, 'p2', 1, false, 9), b: mkP(1, 'p1', -1, true, 9) };
    const D3 = { a: mkP(2, 'p1', -1, true, 0), b: mkP(2, 'p2', 1, true, 0) };
    const door3 = { t: 0 };
    w.updaters.push((dt) => {
      G[0].set(D1.a.pressed && D1.b.pressed);
      G[1].set(D2.a.pressed && D2.b.pressed);
      door3.t = D3.a.pressed && D3.b.pressed ? 9 : Math.max(0, door3.t - dt);
      G[2].set(door3.t > 0);
    });
    stage(w, 'boss', { x: 0, y: HY + 1, z: S0 - 1, w: 14, h: 4, d: 4 }, () => { tell('p1', 'coop.l10.boss.p1', { priority: 2 }); tell('p2', 'coop.l10.boss.p2', { priority: 2 }); });
    stage(w, 'boss2', { x: 0, y: HY + 1, z: S0 - 29, w: 14, h: 4, d: 4 }, () => tell('all', 'coop.l10.boss2'));
    stage(w, 'boss3', { x: 0, y: HY + 1, z: S0 - 53, w: 14, h: 4, d: 4 }, () => tell('all', 'coop.l10.boss3'));
    w.checkpoint({ x: 0, y: HY, z: S0 - 1, real: true });
    w.checkpoint({ x: 0, y: HY, z: S0 - 27 + 2.5, real: true });
    w.checkpoint({ x: 0, y: HY, z: S0 - 51 + 2.5, real: true });
    const outZ = S0 - 78;
    deck(w, { x: 0, y: HY, z: outZ - 8, w: 22, d: 16, path: true });                   // the vestibule S0-78 … S0-94
    w.checkpoint({ x: 0, y: HY, z: outZ - 3, real: true });
    stage(w, 'bossdone', { x: 0, y: HY + 1, z: outZ - 3, w: 20, h: 4, d: 4 }, () => tell('all', 'coop.l10.bossdone'));
    // bot plans: wait in the bay, cross when the figure is far enough away, stand on the far plate
    const cross = (s) => () => s.safeToCross();
    const bz = (k, far) => bayZ(k, far);
    B.p1.push({ x: -10.5, z: bz(0, false), r: 0.7, until: () => D1.b.pressed },                                                       // p1 sits on its plate; p2 runs first
      { x: -10.5, z: bz(0, false), r: 0.7, until: () => G[0].passable && cross(sw[0])() }, { x: 0, z: S0 - 29, r: 1.5 },
      { x: -10.5, z: bz(1, false), r: 0.7, until: () => cross(sw[1])() && D2.a.pressed },                                               // seg 2 (toward): p1 runs first
      { x: -10.5, z: bz(1, true), r: 0.7, until: () => P.has && P.sz < S0 - 52 },
      { x: -10.5, z: bz(2, false), r: 0.7, until: () => cross(sw[2])() }, { x: -10.5, z: bz(2, true), r: 0.7, until: () => G[2].passable });
    B.p2.push({ x: 10.5, z: bz(0, false), r: 0.7, until: () => cross(sw[0])() }, { x: 10.5, z: bz(0, true), r: 0.7, until: () => P.has && P.sz < S0 - 28 },
      { x: 10.5, z: bz(1, false), r: 0.7, until: () => G[1].passable && cross(sw[1])() }, { x: 0, z: S0 - 53, r: 1.5 },
      { x: 10.5, z: bz(2, false), r: 0.7, until: () => cross(sw[2])() }, { x: 10.5, z: bz(2, true), r: 0.7, until: () => G[2].passable });
    both({ x: 0, z: outZ - 6, r: 2 });

    // ============================================================ 9. the fake "I do" ===================================
    const F0 = outZ - 16;                                                              // altar deck F0 … F0-18
    const FY = HY;
    deck(w, { x: 0, y: FY, z: F0 - 9, w: 24, d: 18, path: true });
    arch(w, 0, FY, F0 - 13, { wide: 7, tall: 6 });
    pews(w, { x: -8, y: FY, z: F0 - 3, count: 3, gap: 3, len: 5 }); pews(w, { x: 8, y: FY, z: F0 - 3, count: 3, gap: 3, len: 5 });
    const fake = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.13, 12, 48), glowMaterial(0xffc2d4, 2.2));
    fake.position.set(0, FY + 2.0, F0 - 13); w.add(fake);
    sign(w, 'I DO', 0, FY + 5.4, F0 - 13, { w: 3.6, h: 1.1, border: '#ff9fb8' });
    sign(w, 'EXIT', -9, FY + 4.4, F0 - 17.4, { w: 3, h: 0.9, border: '#3ddc97' });
    sign(w, 'EXIT', 9, FY + 4.4, F0 - 17.4, { w: 3, h: 0.9, border: '#3ddc97' });
    for (const sx of [-1, 1]) w.plat({ x: sx * 9, y: FY + 5, z: F0 - 17.4, w: 3.4, d: 0.6, h: 5, tex: 'wood', color: 0x6b4a2e, trim: null });      // the "exits" are painted on a wall
    const fakeZ = c.zone({ x: 0, y: FY + 2.0, z: F0 - 13, w: 3.6, h: 3.6, d: 3.4, need: 'both', shrink: 0 });
    let idoDone = false, idoT = 0;
    const stairs = [];
    for (let i = 0; i < 6; i++) stairs.push(riser(w, { x: 0, y: FY + 1.3 * (i + 1), z: F0 - 18 - 2.4 - i * 3.0, w: 5, d: 2.8, h: 0.8, drop: 8, speed: 9, color: 0xfff0d6, trim: 0xff9fb8 }));
    c.onEvent('ido', () => { if (idoDone) return; idoDone = true; stairs.forEach((s) => s.set(true)); fake.material.color.setHex(0x8892a8); tell('all', 'coop.l10.fake.ido'); w.burst(new THREE.Vector3(0, FY + 1, F0 - 13), 0xff9fb8, 40, 6); });
    w.updaters.push((dt) => {
      idoT = fakeZ.active && !idoDone ? idoT + dt : 0;
      if (idoT > 1.6 && !idoDone) c.emit('ido');
      fake.rotation.z += dt * 0.6;
      if (!idoDone) fake.scale.setScalar(1 + Math.sin(w.t * 3) * 0.04);
    });
    stage(w, 'fake', { x: 0, y: FY + 1, z: F0 - 3, w: 24, h: 4, d: 4 }, () => { tell('p1', 'coop.l10.fake.p1', { priority: 2 }); tell('p2', 'coop.l10.fake.p2', { priority: 2 }); });
    w.checkpoint({ x: 0, y: FY, z: F0 - 5, real: true });
    B.p1.push({ x: -0.8, z: F0 - 12.8, r: 0.5, until: () => idoDone }); B.p2.push({ x: 0.8, z: F0 - 12.8, r: 0.5, until: () => idoDone });
    // the real way on: stairs up
    const topY = FY + 1.3 * 6;
    const T0 = F0 - 18 - 2.4 - 5 * 3.0 - 1.4;                                          // end of the staircase
    deck(w, { x: 0, y: topY, z: T0 - 6, w: 16, d: 10, path: true });
    w.checkpoint({ x: 0, y: topY, z: T0 - 4, real: true });
    both({ x: 0, z: F0 - 17, r: 1.5 }, ...stairs.map((s, i) => ({ x: 0, z: F0 - 20.4 - i * 3, r: 1.0 })), { follow: true, until: () => gp().y > topY - 0.5 && gp().z < T0 - 1 });

    // ============================================================ 10. the real one ====================================
    stage(w, 'last', { x: 0, y: topY + 1, z: T0 - 5, w: 16, h: 4, d: 6 }, () => { c.tether({ max: 8.5, k: 14, rope: true, on: true }); rule('both')(); tell('all', 'coop.l10.last'); });
    const L = chain(w, { x: 0, y: topY, z: T0 - 11 }, [
      { gap: 2.2, d: 4, w: 6 }, { gap: 2.6, d: 4, w: 5, dy: 0.5 }, { gap: 2.8, d: 4, w: 5 }, { gap: 3.0, d: 5, w: 6, dy: 0.5 },
      { gap: 2.6, d: 4, w: 5, dy: 0.6 }, { gap: 2.8, d: 4, w: 5 }, { gap: 3.0, d: 5, w: 6, dy: -0.3 },
    ]);
    w.crumble(L[1], { delay: 1.4, gone: 3.5 }); w.crumble(L[4], { delay: 1.4, gone: 3.5 });
    w.checkpoint({ x: 0, y: L[3].top, z: L[3].body.z, real: true });
    const gy = L.endY + 0.5, gz = L.endZ - 2.4 - 8;
    deck(w, { x: 0, y: gy, z: gz, w: 16, d: 16, path: true });
    arch(w, 0, gy, gz - 5, { wide: 8, tall: 6 });
    window3(w, -7.5, gy + 1, gz, Math.PI / 2, 6); window3(w, 7.5, gy + 1, gz, -Math.PI / 2, 6);
    w.goal({ x: 0, y: gy, z: gz - 2 });
    beacon(w, 0, gy, gz - 2, 0xffe9a8, 26);
    for (const lx of [-6, 6]) lantern(w, lx, gy, gz + 3);
    sign(w, 'BOTH OF YOU. IN THE RING. AT THE SAME TIME. NO, THIS ONE IS REAL.', 0, gy + 7.6, gz - 6, { w: 11, h: 1.6, size: 30, border: '#ff9fb8' });
    stage(w, 'circle', { x: 0, y: gy + 1, z: gz + 2, w: 16, h: 4, d: 6 }, () => tell('all', 'coop.l10.circle'));
    both({ follow: true });

    w.hooks.onPartnerDeath = () => { tell('all', 'coop.l10.partnerdown'); return true; };
    vbots(w, B);
  },
};
