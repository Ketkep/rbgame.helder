import * as THREE from 'three';
import { chain } from '../common.js';
import { glowMaterial } from '../../engine/materials.js';
import { retreatEnv, deck, stone, plate, gate, riser, sign, lantern, stage, botSteps, beacon, COL } from './kit.js';
import { peaks, haulWall, rockDrop, gustLamp, ropeStages } from './tethered-trek-kit.js';

// Session 4 — Tethered Trek. A mountain climb with the two of you tied together the whole way. Eight stages, each with a
// different rope: forest bridges, the belay wall (a rope lift: one of you holds, the other climbs), an ice ridge with gusts,
// a falling-rock cave with a gate that needs a plate held, a short-rope ledge, a human-ladder chimney, a fake summit, the real one.
// Death rule: 'both' (you fall together). The rope is a nuisance, never a killer: it only drags, and it turns red first.

export default {
  id: 'coop4',
  name: 'Tethered Trek',
  music: 'l3',
  deathRule: 'both',
  completeQuip: 'Eight stages. One rope. Nobody cut it. I am as surprised as you are.',
  titleCam: { center: [0, 6, -60], radius: 34, height: 16 },

  build(w, game) {
    retreatEnv(w, { mood: 'dawn' });
    peaks(w);
    const c = w.coop, me = c.me, N = c.names;
    w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    const tell = (r, k, o) => c.tell(r, k, o);
    const P = c.partner, pl = game.player;
    const rope = [{ z: Infinity, max: 9, k: 8 }];                      // the per-stage rope table (see ropeStages)
    const told = new Set();
    const once = (k, role = 'all') => { if (told.has(k)) return; told.add(k); tell(role, k); };
    const rockTex = { tex: 'metal', color: 0x98a2b6 };
    const ledge = (o) => w.plat({ ...rockTex, path: true, ...o });

    // ============================================================ 1. the forest: rope bridges =====================
    deck(w, { x: 0, y: 0, z: 0, w: 16, d: 16, path: true });                                    // z +8 … -8
    sign(w, 'SERENITY FALLS · COUPLES RETREAT', 0, 5.4, 4, { w: 12, h: 1.6 });
    sign(w, 'SESSION 4: TETHERED TREK', 0, 3.8, 4, { w: 8, h: 1, border: '#39d7c9' });
    for (const lx of [-7, 7]) lantern(w, lx, 0, 3);
    w.checkpoint({ x: 0, y: 0, z: -4, real: true });
    stage(w, 'welcome', { x: 0, y: 1, z: 3, w: 18, h: 4, d: 8 }, () => { tell('p1', 'coop.l4.intro.p1', { priority: 2 }); tell('p2', 'coop.l4.intro.p2', { priority: 2 }); });
    stage(w, 'rope', { x: 0, y: 1, z: -6, w: 18, h: 4, d: 4 }, () => tell('all', 'coop.l4.rope'));
    deck(w, { x: 0, y: 0, z: -17.4, w: 2.8, d: 14, path: true });                               // bridge A  z -10.4 … -24.4
    deck(w, { x: 0, y: 0, z: -31.8, w: 9, d: 10, path: true });                                 // island    z -26.8 … -36.8
    for (const lx of [-3, 3]) lantern(w, lx, 0, -30);
    w.checkpoint({ x: 0, y: 0, z: -31.8, real: true });
    stage(w, 'planks', { x: 0, y: 1, z: -35, w: 9, h: 4, d: 3 }, () => tell('all', 'coop.l4.planks'));
    let zc = -36.8;
    for (let k = 0; k < 6; k++) {                                                                // bridge B: loose planks
      zc -= 1.5;
      const pk = deck(w, { x: 0, y: 0, z: zc - 1.2, w: 2.8, d: 2.4, h: 0.6, path: true, color: 0xc9a46c });
      if (k === 1 || k === 3 || k === 4) w.crumble(pk, { delay: 1.1, gone: 3.5 });
      zc -= 2.4;
    }
    const Z_LODGE = zc - 1.8;                                                                     // -62
    rope.push({ z: Z_LODGE + 2.5, max: 14, k: 8 });
    const lodge = deck(w, { x: 0, y: 0, z: Z_LODGE - 9, w: 18, d: 18, path: true });             // z -62 … -80
    for (const lx of [-8, 8]) lantern(w, lx, 0, Z_LODGE - 3);
    w.checkpoint({ x: 0, y: 0, z: Z_LODGE - 5, real: true });
    stage(w, 'lodge', { x: 0, y: 1, z: Z_LODGE - 4, w: 18, h: 4, d: 4 }, () => tell('all', 'coop.l4.lodge'));

    // ============================================================ 2. the belay wall: hold the rope, then swap ======
    // wall 1 (6 m): p2 belays from the teal plate, p1 climbs; then p1 stands on the top plate and hauls p2 up.
    const F1 = Z_LODGE - 18;                                                                      // wall-1 face (z -80)
    const L1 = ledge({ x: 0, y: 6, z: F1 - 13, w: 18, d: 26, h: 6 });                           // z -80 … -106
    const B1 = plate(w, { x: -5, y: 0, z: F1 + 8, need: 'p2', label: `${N.p2}: BELAY` });
    const T1 = plate(w, { x: 5, y: 6, z: F1 - 10, need: 'p1', label: `${N.p1}: BELAY` });
    const hw1 = haulWall(w, { x: 0, face: F1, y0: 0, h: 6, base: B1, top: T1 });
    sign(w, 'THE ROPE HOLDS WHILE YOUR PARTNER STANDS ON THEIR PLATE', 0, 8.6, F1 + 0.3, { w: 12, h: 1.6, size: 34 });
    sign(w, 'HOLD JUMP TO CLIMB', 0, 7.2, F1 + 0.3, { w: 6, h: 0.9, border: '#39d7c9' });
    stage(w, 'wall1', { x: 0, y: 1, z: F1 + 5, w: 18, h: 4, d: 6 }, () => { tell('p1', 'coop.l4.wall1.p1'); tell('p2', 'coop.l4.wall1.p2'); });
    stage(w, 'up1', { x: 0, y: 7, z: F1 - 8, w: 18, h: 4, d: 10 }, () => tell('all', 'coop.l4.up1'));
    w.checkpoint({ x: 0, y: 6, z: F1 - 15, real: true });
    // wall 2 (7 m): the other way round
    const F2 = F1 - 26;                                                                           // z -106
    const L2 = ledge({ x: 0, y: 13, z: F2 - 12, w: 18, d: 24, h: 7 });                          // z -106 … -130
    const B2 = plate(w, { x: -5, y: 6, z: F2 + 8, need: 'p1', label: `${N.p1}: BELAY` });
    const T2 = plate(w, { x: 5, y: 13, z: F2 - 10, need: 'p2', label: `${N.p2}: BELAY` });
    const hw2 = haulWall(w, { x: 0, face: F2, y0: 6, h: 7, base: B2, top: T2 });
    sign(w, 'SEVEN METRES. SWAP JOBS. IT IS CALLED GROWTH.', 0, 15.6, F2 + 0.3, { w: 12, h: 1.4, size: 34 });
    stage(w, 'wall2', { x: 0, y: 7, z: F2 + 5, w: 18, h: 4, d: 6 }, () => { tell('p1', 'coop.l4.wall2.p1'); tell('p2', 'coop.l4.wall2.p2'); });
    w.checkpoint({ x: 0, y: 13, z: F2 - 17, real: true });
    for (const lx of [-8, 8]) lantern(w, lx, 13, F2 - 4);

    // ============================================================ 3. the ice ridge: slippery, with gusts ===========
    const Y3 = 13;
    let rz = F2 - 24;                                                                             // -130
    rope.push({ z: rz, max: 7.5, k: 8 });
    const ridge = [{ d: 7 }, { d: 7 }, { d: 7 }, { d: 12, w: 4.8 }, { d: 7 }, { d: 7 }, { d: 7 }];
    const GUST = { period: 6, on: 1.8, warn: 1.5 };
    ridge.forEach((s, i) => {
      const wd = s.w ?? 6.4, gap = 2.8, near = rz;
      rz -= gap;
      const zc2 = rz - s.d / 2;
      w.plat({ x: 0, y: Y3, z: zc2, w: wd, d: s.d, h: 1, tex: 'metal', color: 0xbfd9f2, slippery: true, path: true });
      for (const sx of [-1, 1]) w.plat({ x: sx * (wd / 2 - 0.15), y: Y3 + 2.4, z: zc2, w: 0.3, d: s.d, h: 2.4, tex: 'metal', color: 0xdff0ff, trim: null });   // ice rails
      const ph = i * 2.1;
      w.wind({ x: 0, y: Y3 + 1.6, z: near - (gap + s.d) / 2, w: wd + 6, h: 4, d: gap + s.d, dx: i % 2 ? 1 : -1, dz: 0, strength: 6, period: GUST.period, on: GUST.on, phase: ph });
      gustLamp(w, -(wd / 2 - 0.15), Y3 + 2.4, zc2 + s.d / 2 - 0.8, { period: GUST.period, on: GUST.on, phase: ph, warn: GUST.warn });
      rz -= s.d;
      if (i === 2) w.checkpoint({ x: 0, y: Y3, z: zc2, real: true });
    });
    stage(w, 'ice', { x: 0, y: Y3 + 1, z: F2 - 20, w: 18, h: 4, d: 6 }, () => tell('all', 'coop.l4.ice'));
    stage(w, 'icedone', { x: 0, y: Y3 + 1, z: rz + 5, w: 8, h: 4, d: 6 }, () => tell('all', 'coop.l4.icedone'));

    // ============================================================ 4. the falling-rock cave ==========================
    const mz = rz - 2.8 - 5;                                                                      // mouth centre
    rope.push({ z: mz + 5, on: false, onEnter: () => once('coop.l4.untie') });
    stone(w, { x: 0, y: Y3, z: mz, w: 14, d: 10, path: true });
    const alc = stone(w, { x: 10.5, y: Y3, z: mz, w: 7, d: 8 });
    w.checkpoint({ x: 0, y: Y3, z: mz, real: true });
    const gz = mz - 5 - 0.4;
    const G1 = gate(w, { x: 0, y: Y3, z: gz, w: 14.2, h: 6, color: 0x6a6f7c, tex: 'metal', glow: COL.danger });
    const PA = plate(w, { x: 10.5, y: Y3, z: mz, need: 'any', hold: 3, label: 'HOLD THE GATE' });
    sign(w, 'THE GATE STAYS OPEN WHILE SOMEONE STANDS HERE', 10.5, Y3 + 4.4, mz - 3.6, { w: 6.4, h: 1.4, size: 32, border: '#ffc83d' });
    sign(w, 'ROCKFALL AHEAD. THE ROPE IS OFF. THE ROCKS ARE ON.', 0, Y3 + 7.2, gz + 1, { w: 11, h: 1.6, size: 34, border: '#ff4d5e' });
    const CL = 60, CZ0 = mz - 5;                                                                  // corridor z CZ0 … CZ0-60
    stone(w, { x: 0, y: Y3, z: CZ0 - CL / 2, w: 14, d: CL, path: true });
    for (const sx of [-1, 1]) w.plat({ x: sx * 7.15, y: Y3 + 6, z: CZ0 - (CL + 12) / 2, w: 0.3, d: CL + 12, h: 6, tex: 'metal', color: 0x6a6f7c, trim: null });
    for (let k = 0; k < 8; k++) w.box({ x: 0, y: Y3 + 6.3, z: CZ0 - 4 - k * 8, w: 15, h: 0.6, d: 1.4, color: 0x4a4e5a, shadow: false });      // roof beams (set dressing)
    for (let i = 0; i < 6; i++) for (let L = -1; L <= 1; L++) rockDrop(w, { x: L * 4.4, y: Y3, z: CZ0 - 10 - i * 8, ph: i * 1.3 + (L + 1) * 1.7 });
    w.checkpoint({ x: 0, y: Y3, z: CZ0 - 10 - 2 * 8 - 4, real: true });                           // half way, between two rows
    const exitZ = CZ0 - CL;
    stone(w, { x: 0, y: Y3, z: exitZ - 6, w: 14, d: 12, path: true });
    const PO = plate(w, { x: 0, y: Y3, z: exitZ - 6, need: 'any', hold: 3.5, label: 'HOLD IT FOR THEM' });
    w.checkpoint({ x: 0, y: Y3, z: exitZ - 2.5, real: true });
    lantern(w, -6, Y3, exitZ - 2); lantern(w, 6, Y3, exitZ - 2);
    w.updaters.push(() => G1.set(PA.pressed || PO.pressed));
    stage(w, 'cave', { x: 0, y: Y3 + 1, z: mz + 1, w: 14, h: 4, d: 6 }, () => tell('all', 'coop.l4.cave'));
    let sawPA = false, sawPO = false;
    PA.onChange((z) => { if (!z.active || sawPA) return; sawPA = true; tell(me, z.mine ? 'coop.l4.cave.holder' : 'coop.l4.cave.runner'); });
    PO.onChange((z) => { if (!z.active || sawPO) return; sawPO = true; tell(me, z.mine ? 'coop.l4.cave.exit.runner' : 'coop.l4.cave.exit.holder'); });
    stage(w, 'cavedone', { x: 0, y: Y3 + 1, z: exitZ - 9, w: 14, h: 4, d: 3 }, () => tell('all', 'coop.l4.cavedone'));

    // ============================================================ 5. the ledge: short rope, lockstep ================
    const pocketEnd = exitZ - 12;
    rope.push({ z: pocketEnd + 1, max: 5.2, k: 7, onEnter: () => once('coop.l4.ledge') });
    const s5 = chain(w, { x: 0, y: Y3, z: pocketEnd }, [
      { gap: 2.2, d: 4.5, w: 3.2, x: 0 },
      { gap: 2.4, d: 4, w: 3, x: 1.6 },
      { gap: 2.4, d: 4, w: 3, x: 3.2, dy: 1 },          // 2 crumbles
      { gap: 2.2, d: 5, w: 3.2, x: 1.6 },
      { gap: 2.6, d: 4, w: 3, x: 0 },
      { gap: 2.4, d: 4, w: 3, x: -1.6, dy: -1 },
      { gap: 2.4, d: 4.5, w: 3.2, x: -3.2 },            // 6 crumbles
      { gap: 2.4, d: 4, w: 3, x: -1.6, dy: 1 },
      { gap: 2.2, d: 5, w: 3.2, x: 0 },
      { gap: 2.6, d: 4, w: 3, x: 1.6 },                 // 9 crumbles
      { gap: 2.4, d: 4, w: 3, x: 0, dy: 1 },
      { gap: 2.2, d: 6, w: 5, x: 0 },
    ]);
    for (const k of [2, 6, 9]) w.crumble(s5[k], { delay: 1.8, gone: 3.5 });
    w.checkpoint({ x: 0, y: s5[4].top, z: s5[4].body.z, real: true });
    w.checkpoint({ x: 0, y: s5[11].top, z: s5[11].body.z, real: true });
    sign(w, 'THE ROPE IS 5 METRES. IT IS RED WHEN IT IS ANGRY.', 0, Y3 + 3.4, pocketEnd - 6, { w: 7.5, h: 1.4, size: 32 });
    stage(w, 'ledgemid', { x: 0, y: s5[5].top + 1, z: s5[5].body.z, w: 8, h: 4, d: 4 }, () => tell('all', 'coop.l4.ledgemid'));

    // ============================================================ 6. the chimney: a human ladder, taller ============
    const Y6 = s5.endY;
    rope.push({ z: s5.endZ - 1, max: 9, k: 8, onEnter: () => once('coop.l4.chim') });
    const base6 = deck(w, { x: 0, y: Y6, z: s5.endZ - 2.4 - 8, w: 16, d: 16, path: true });
    const zf1 = s5.endZ - 2.4 - 16;
    const Yl1 = Y6 + 3.0, Yl2 = Yl1 + 4.2;
    const U1 = ledge({ x: 0, y: Yl1, z: zf1 - 7, w: 16, d: 14, h: 3.0, tex: 'wood', color: 0xffffff });
    w.plat({ x: 1.75, y: Y6 + 1.2, z: zf1 + 1.25, w: 2.5, d: 2.5, h: 1.2, tex: 'wood', color: 0xb98a55 });
    const lift1 = riser(w, { x: 5.5, y: Yl1, z: zf1 + 4, w: 3.2, d: 3.2, h: 0.6, drop: 3.0, always: true, speed: 4.2, color: 0xe9d9b0, trim: COL.good });
    const col1 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.4, 10), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8 })); col1.position.set(5.5, Y6 + 1.2, zf1 + 6); w.add(col1);
    const px1 = plate(w, { x: 0, y: Yl1, z: zf1 - 10, need: 'any', label: 'LIFT: STAND HERE' });
    w.updaters.push(() => lift1.set(px1.pressed));
    sign(w, 'THIS WALL IS 3 M. THE NEXT IS 4.2. DO NOT ASK.', 0, Y6 + 6.6, zf1 + 0.4, { w: 11, h: 1.2, size: 34 });
    stage(w, 'chim1', { x: 0, y: Y6 + 1, z: zf1 + 4, w: 16, h: 4, d: 4 }, () => tell('all', 'coop.l4.chim1'));
    w.checkpoint({ x: 0, y: Yl1, z: zf1 - 5, real: true });
    // tier two: two steps up to a taller wall – the booster stands on the low crate, the climber on the high one
    const zf2 = zf1 - 14;
    const U2 = ledge({ x: 0, y: Yl2, z: zf2 - 7, w: 16, d: 14, h: 4.2, tex: 'wood', color: 0xffffff });
    const crate = (x, top, color) => w.plat({ x, y: Yl1 + top, z: zf2 + 1.25, w: 2.5, d: 2.5, h: top, tex: 'wood', color });
    crate(0, 1.2, 0xb98a55); crate(2.5, 2.2, 0xa8784a); crate(5, 1.2, 0xb98a55);
    const lift2 = riser(w, { x: -5.5, y: Yl2, z: zf2 + 4, w: 3.2, d: 3.2, h: 0.6, drop: 4.2, always: true, speed: 4.6, color: 0xe9d9b0, trim: COL.good });
    const col2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.6, 10), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8 })); col2.position.set(-5.5, Yl1 + 1.8, zf2 + 6); w.add(col2);
    const px2 = plate(w, { x: 0, y: Yl2, z: zf2 - 10, need: 'any', label: 'LIFT: STAND HERE' });
    w.updaters.push(() => lift2.set(px2.pressed));
    sign(w, 'LOW STEP: STAND. HIGH STEP: HOP. YES, ON THEIR HEAD.', 0, Yl1 + 6.4, zf2 + 0.4, { w: 11, h: 1.2, size: 32 });
    stage(w, 'chim2', { x: 0, y: Yl1 + 1, z: zf2 + 4, w: 16, h: 4, d: 4 }, () => tell('all', 'coop.l4.chim2'));
    w.checkpoint({ x: 0, y: Yl2, z: zf2 - 5, real: true });
    for (const lx of [-7, 7]) lantern(w, lx, Yl2, zf2 - 3);

    // ============================================================ 7. the summit (it is not) ==========================
    const Z7 = zf2 - 14;
    rope.push({ z: Z7, max: 8, k: 8 });
    const s7 = chain(w, { x: 0, y: Yl2, z: Z7 }, [
      { gap: 2.4, d: 5, w: 7, dy: 1 },
      { gap: 2.6, d: 4, w: 6, dy: 1 },
      { gap: 2.6, d: 4, w: 6, dy: 1 },
      { gap: 2.8, d: 5, w: 7, dy: 0 },
    ]);
    w.crumble(s7[1], { delay: 1.1, gone: 3.5 });
    w.checkpoint({ x: 0, y: s7[3].top, z: s7[3].body.z, real: true });
    const Yf = s7.endY, fz = s7.endZ - 2.4 - 8;
    deck(w, { x: 0, y: Yf, z: fz, w: 16, d: 16, path: true });                                   // the fake summit
    deck(w, { x: 11, y: Yf, z: fz, w: 6, d: 8 });                                                // a spur with a "checkpoint"
    const fcp = w.checkpoint({ x: 11, y: Yf, z: fz, real: false });
    sign(w, 'CHECKPOINT ↑ (REAL)', 11, Yf + 4.4, fz - 3, { w: 5, h: 1, border: '#ffc83d' });
    w.trigger({ x: 11, y: Yf + 1.2, z: fz, w: 2.4, h: 3.2, d: 2.4, once: true, onEnter: () => once('coop.l4.fakecp', me) });
    const fake = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 12, 48), glowMaterial(0x3ddc97, 2));
    fake.position.set(0, Yf + 1.9, fz - 1); w.add(fake);
    sign(w, 'THE SUMMIT · 4,812 M · (MEASURED BY ME)', 0, Yf + 5.4, fz - 1, { w: 9, h: 1.4, border: '#3ddc97' });
    for (const lx of [-6, 6]) lantern(w, lx, Yf, fz + 4);
    stage(w, 'fakeland', { x: 0, y: Yf + 1, z: fz + 5, w: 16, h: 4, d: 4 }, () => tell('all', 'coop.l4.summit'));
    const fakeZ = c.zone({ x: 0, y: Yf + 1.9, z: fz - 1, w: 3, h: 3.4, d: 3, need: 'both', shrink: 0 });
    let fakeDone = false;
    fakeZ.onChange((z) => { if (z.active && !fakeDone) { fakeDone = true; tell('all', 'coop.l4.fake'); fake.visible = false; } });

    // ============================================================ 8. the real summit =================================
    const Z8 = fz - 8;
    rope.push({ z: Z8, max: 6.5, k: 7 });
    const s8 = chain(w, { x: 0, y: Yf, z: Z8 }, [
      { gap: 2.4, d: 5, w: 6, dy: 1 },
      { gap: 2.6, d: 4, w: 5, dy: 1, x: 1 },
      { gap: 2.6, d: 4, w: 5, dy: 1, x: -1 },
      { gap: 2.8, d: 5, w: 6, dy: 1 },
      { gap: 2.6, d: 4, w: 5, dy: 1, x: 1 },
      { gap: 2.6, d: 4, w: 5, dy: 0, x: 0 },
      { gap: 2.8, d: 5, w: 6, dy: 1 },
    ]);
    for (const k of [1, 4]) w.crumble(s8[k], { delay: 1.1, gone: 3.5 });
    w.checkpoint({ x: 0, y: s8[0].top, z: s8[0].body.z, real: true });
    w.checkpoint({ x: 0, y: s8[3].top, z: s8[3].body.z, real: true });
    const gy = s8.endY, gzz = s8.endZ - 2.8 - 8;
    deck(w, { x: 0, y: gy, z: gzz, w: 16, d: 16, path: true });
    w.goal({ x: 0, y: gy, z: gzz - 2 });
    sign(w, 'THE ACTUAL SUMMIT. BOTH OF YOU. IN THE RING.', 0, gy + 5.4, gzz - 6, { w: 10, h: 1.4 });
    beacon(w, 0, gy, gzz - 2, 0xffe9a8, 24);
    for (const lx of [-6, 6]) lantern(w, lx, gy, gzz + 2);
    stage(w, 'real', { x: 0, y: s8[3].top + 1, z: s8[3].body.z, w: 8, h: 4, d: 4 }, () => tell('all', 'coop.l4.real'));
    stage(w, 'top', { x: 0, y: gy + 1, z: gzz + 4, w: 16, h: 4, d: 5 }, () => tell('all', 'coop.l4.top'));

    w.hooks.onPartnerDeath = () => { tell('all', 'coop.l4.partnerdown'); return true; };

    // the rope for each stage (chosen by the rear climber)
    ropeStages(w, rope);

    // ============================================================ scripted bots (tools/coop-bot.mjs) ====================
    const onTop = (y) => () => game.player.y > y - 0.3 && game.player.grounded;
    const onDeck = (d) => () => pl.grounded && pl.ground === d.body;
    const away = (y, face) => () => P.has && P.g && P.sy > y - 0.5 && P.sz < face - 0.3;           // partner is up on the ledge
    // a belay: climber waits at the wall until the partner is on a plate, climbs, then waits on the top plate
    const climbSteps = (W) => [
      { x: 0, z: W.face + 1.4, r: 0.5, until: () => W.base.theirs },
      { x: 0, z: W.face - 3, r: 0.5, until: onTop(W.y0 + W.h) },
      { x: W.top.x, z: W.top.z, r: 0.4, until: away(W.y0 + W.h, W.face) },
    ];
    const beleaySteps = (W) => [
      { x: W.base.x, z: W.base.z, r: 0.4, until: away(W.y0 + W.h, W.face) },
      { x: 0, z: W.face + 1.4, r: 0.5, until: () => W.top.theirs },
      { x: 0, z: W.face - 3, r: 0.5, until: onTop(W.y0 + W.h) },
    ];
    const mkW = (face, y0, h, base, top, bx, tx) => ({ face, y0, h, base: { x: bx[0], z: bx[1], get theirs() { return base.theirs; } }, top: { x: tx[0], z: tx[1], get theirs() { return top.theirs; } } });
    const W1 = mkW(F1, 0, 6, B1, T1, [-5, F1 + 8], [5, F1 - 10]);
    const W2 = mkW(F2, 6, 7, B2, T2, [-5, F2 + 8], [5, F2 - 10]);
    // cave: p1 runs first, p2 holds the gate; then p2 runs while p1 keeps the exit plate down
    const caveHolder = [
      { x: 10.5, z: mz, r: 0.5, until: () => PO.theirs },
      { follow: true, until: () => pl.z < exitZ - 3 },
    ];
    const caveRunner = [
      { x: 0, z: gz + 2.5, r: 0.8, until: () => G1.passable },
      { follow: true, until: () => PO.mine },
      { x: 0, z: exitZ - 6, r: 0.4, until: () => P.has && P.sz < gz - 1.5 },
    ];
    // chimney, tier one (p2 boosts, p1 climbs) and tier two (p1 boosts, p2 climbs)
    const tier1 = {
      p2: [
        { x: 0, z: zf1 + 0.5, r: 0.2, until: () => P.has && P.g && P.sy > Yl1 - 0.3 && P.sz < zf1 - 0.8 },
        { x: 5.5, z: zf1 + 4, until: () => pl.y > Yl1 - 0.3 },
      ],
      p1: [
        { x: 1.75, z: zf1 + 1.1, r: 0.2, until: () => pl.y > Y6 + 1.1 && pl.grounded },
        { x: 1.85, z: zf1 + 1.1, r: 0.1, until: () => P.has && P.g && Math.abs(P.sx) < 0.2 && Math.abs(P.sz - (zf1 + 0.5)) < 0.3 && Math.hypot(pl.x - 1.85, pl.z - (zf1 + 1.1)) < 0.2 && Math.hypot(pl.vx, pl.vz) < 0.3 },
        { x: () => P.sx, z: () => P.sz, jump: 1.3, stop: 0.5, r: 0.05, until: () => pl.y > Y6 + 1.6 && pl.grounded },
        { x: 0, z: zf1 - 2.4, jump: 3, until: () => pl.y > Yl1 - 0.2 && pl.grounded },
        { x: 0, z: zf1 - 10, until: () => P.has && P.g && P.sy > Yl1 - 0.3 },
      ],
    };
    const tier2 = {
      p1: [
        { x: 0.75, z: zf2 + 0.6, r: 0.2, until: () => P.has && P.g && P.sy > Yl2 - 0.3 && P.sz < zf2 - 0.8 },
        { x: -5.5, z: zf2 + 4, until: () => pl.y > Yl2 - 0.3 },
      ],
      p2: [
        { x: 5, z: zf2 + 1.25, r: 0.3, until: () => pl.y > Yl1 + 1.1 && pl.grounded },
        { x: 2.5, z: zf2 + 1.1, r: 0.3, until: () => pl.y > Yl1 + 2.1 && pl.grounded },
        { x: 2.5, z: zf2 + 0.9, r: 0.1, until: () => P.has && P.g && P.sy > Yl1 + 1.0 && Math.abs(P.sx - 0.75) < 0.2 && Math.abs(P.sz - (zf2 + 0.6)) < 0.3 && Math.hypot(pl.x - 2.5, pl.z - (zf2 + 0.9)) < 0.2 && Math.hypot(pl.vx, pl.vz) < 0.3 },
        { x: () => P.sx, z: () => P.sz, jump: 1.3, stop: 0.5, r: 0.05, until: () => pl.y > Yl1 + 2.8 && pl.grounded },
        { x: 0, z: zf2 - 2.4, jump: 3, until: () => pl.y > Yl2 - 0.2 && pl.grounded },
        { x: 0, z: zf2 - 10, until: () => P.has && P.g && P.sy > Yl2 - 0.3 },
      ],
    };
    const plan = (role) => [
      { follow: true, until: onDeck(lodge) },
      ...(role === 'p1' ? climbSteps(W1) : beleaySteps(W1)),
      ...(role === 'p1' ? beleaySteps(W2) : climbSteps(W2)),
      { follow: true, until: () => pl.z < mz + 3 && pl.y > Y3 - 0.2 && pl.grounded },
      ...(role === 'p1' ? caveRunner : caveHolder),
      { follow: true, until: onDeck(base6) },
      ...tier1[role], ...tier2[role],
      { follow: true },
    ];
    botSteps(w, { p1: plan('p1'), p2: plan('p2') });
  },
};
