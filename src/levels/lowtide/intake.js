import { stalker } from './stalker.js';
import { scares } from './scare.js';
import { roles } from './roles.js';
import { horrorEnv, exitDoor, checkpoint, door, room, box, decal, bed, locker, curtain, gurney, wheelchair, pipes, desk, barWindow as wardWindow, stencil, note } from './kit.js';
import { makeHud, holdable, straps, cabinet, reader, consoleProp, trolley, grille, torchProp, screenText } from './intake-kit.js';
import { stage, botSteps } from '../coop/kit.js';
import { openKeypad } from '../../engine/keypad.js';
import { readModal } from '../hotel/escape-kit.js';

// Chapter 1 — INTAKE.
//   1  You wake strapped to beds, facing each other across a dark ward. One of you can work a strap loose, then free the other (hold E).
//   2  Wristbands carry your PARTNER's name and half of a dose code each. A torch tray. The dose cabinet (code = both halves) holds a key card.
//   3  The card opens the ward door, then the records office. The intake file (and a barred window onto the service corridor) is the first
//      sight of the Orderly. Reading the file opens the shutter north.
//   4  The Orderly's first patrol comes down the corridor: hide (stand still in a locker bay), learn his tells, knock a tray over to lure him.
//   5  A sealed bulkhead needs two consoles held at the same time, one in the dark west wing, one at the end of the lights-out service corridor.
//   6  The hall behind it: call the lift, survive 24 s while he comes for the noise, ride it to Ward B.
export default {
  id: 'lowtide1',
  name: 'Intake',
  music: 'l1',
  horror: true,
  deathRule: 'self',
  completeQuip: 'Intake complete. Please do not remove your wristband.',
  titleCam: { center: [0, 2, -28], radius: 22, height: 9 },

  build(w, game) {
    const H = horrorEnv(w, game);
    const c = w.coop, me = c.me, other = c.other, S = H.S;
    const partner = () => c.names[other] || 'the other patient';
    const say = (r, k, o = {}) => c.tell(r, k, { priority: 1, ...o, vars: { partner: partner(), you: c.names[me], ...(o.vars || {}) } });
    const sayMe = (k, o = {}) => say(me, k, o);
    const hud = makeHud(w, game);
    const rng = c.rng(31), first = rng() < 0.5 ? 'p1' : 'p2';
    const dA = 10 + Math.floor(rng() * 80), dB = 10 + Math.floor(rng() * 80), CODE = String(dA) + String(dB);

    // ============================================================ the geometry =======================================================
    // ---- WARD (the start) -----------------------------------------------------------------------------------------------------
    const BED = { p1: { x: -5.4, z: 0.4, s: 1, rot: Math.PI / 2 }, p2: { x: 5.4, z: 0.4, s: -1, rot: -Math.PI / 2 } };
    w.spawn = { x: BED[me].x, y: 0, z: 1.35, yaw: me === 'p1' ? -Math.PI / 2 : Math.PI / 2 };
    w.respawn = { ...w.spawn };
    room(w, { x: 0, z: -1, w: 14, d: 14, doors: { n: [{ c: 0, w: 1.8 }] } });
    for (const z of [-3.2, 4.0]) { bed(w, { x: -5.4, z, rot: Math.PI / 2 }); bed(w, { x: 5.4, z, rot: -Math.PI / 2 }); }
    const sets = {};
    for (const r of ['p1', 'p2']) { bed(w, { x: BED[r].x, z: BED[r].z, rot: BED[r].rot }); sets[r] = straps(w, { x: BED[r].x, z: BED[r].z, rot: BED[r].rot }); }
    curtain(w, { x: -4.3, z: -1.4, width: 3.0, rot: Math.PI / 2 }); curtain(w, { x: 4.2, z: 2.2, width: 3.0, rot: Math.PI / 2, open: 0.55 });
    wardWindow(w, { x: -6.84, y: 1.9, z: -3.2, rot: Math.PI / 2 }); wardWindow(w, { x: 6.84, y: 1.9, z: 3.8, rot: -Math.PI / 2 });
    const wardLamps = [H.lamp({ x: -2.4, y: 3.35, z: -2, mode: 'dead', rot: 0 }), H.lamp({ x: 2.6, y: 3.35, z: 3, mode: 'dying' }), H.lamp({ x: 0, y: 3.35, z: -6, mode: 'buzz', len: 1.6 }), H.lamp({ x: -5.4, y: 3.35, z: 3, mode: 'dead' })];
    decal(w, { kind: 'drag', seed: 3, x: 0, y: 0.02, z: -5.4, w: 3, h: 3, face: 'floor', rot: 1.4 });
    decal(w, { kind: 'puddle', seed: 2, x: 1.4, y: 0.025, z: 0.8, w: 2.4, h: 2.4 });
    decal(w, { kind: 'splat', seed: 11, x: -3.6, y: 0.02, z: 2.4, w: 1.8, h: 1.8 });
    decal(w, { kind: 'hand', seed: 5, x: -6.82, y: 1.3, z: -5.3, w: 0.5, h: 0.5, face: 'e' });
    decal(w, { kind: 'scratch', seed: 14, x: 6.82, y: 1.2, z: -2.2, w: 1.5, h: 1.5, face: 'w' });
    stencil(w, 'WARD B · NIGHT', { x: 0, y: 2.75, z: 5.82, rot: Math.PI, width: 3.4 });
    stencil(w, 'CHAPTER 1 · INTAKE', { x: -6.84, y: 2.55, z: 0.4, rot: Math.PI / 2, width: 3.8 });
    stencil(w, 'CHAPTER 1 · INTAKE', { x: 6.84, y: 2.55, z: 0.4, rot: -Math.PI / 2, width: 3.8 });
    wheelchair(w, { x: 2.4, z: -5.4, rot: 2.4 }); wheelchair(w, { x: -2.6, z: 4.6, rot: -0.7 });
    gurney(w, { x: 6.1, z: -5.3, rot: 0.1 });
    // the torch table
    box(w, { x: 0, y: 0.45, z: -3.4, w: 1.8, h: 0.9, d: 0.9, kind: 'wood', rough: 0.8 }); w.collider({ x: 0, y: 0.45, z: -3.4, w: 1.8, h: 0.9, d: 0.9 });
    box(w, { x: 0, y: 0.93, z: -3.4, w: 1.9, h: 0.05, d: 1.0, kind: 'rust', color: 0x7a8a86, rough: 0.5 });
    const torches = { p1: torchProp(w, { x: -0.35, y: 0.99, z: -3.4, rot: 0.25 }), p2: torchProp(w, { x: 0.35, y: 0.99, z: -3.4, rot: -0.2 }) };
    // the dose cabinet and the card reader on the north wall
    const cab = cabinet(w, { x: -4.0, z: -7.6 });
    const cardMesh = box(w, { x: -4.2, y: 1.28, z: -7.48, w: 0.2, h: 0.13, d: 0.02, kind: 'concrete', color: 0xd8dccf, shadow: false });
    const wardReader = reader(w, { x: 1.7, z: -7.82 });
    pipes(w, { x0: -6.6, z0: -7.4, x1: 6.6, z1: -7.4, y: 3.0, n: 2 });

    // ---- the CORRIDOR (z -7 .. -50) ------------------------------------------------------------------------------------------
    room(w, { x: 0, z: -28.5, w: 4.6, d: 43, h: 3.4, doors: { e: [{ c: 11.5, w: 1.6 }, { c: -2.5, w: 1.6 }], w: [{ c: 5.5, w: 1.6 }, { c: -14.5, w: 1.6 }] }, sides: { s: false, n: false } });
    const cl = [['buzz', -10], ['dying', -16.2], ['buzz', -22.4], ['steady', -27.5], ['dying', -33.8], ['buzz', -40], ['dead', -46]];
    const corLamps = cl.map(([mode, z]) => H.lamp({ x: 0, y: 3.35, z, mode, rot: Math.PI / 2, len: 1.4 }));
    pipes(w, { x0: -1.9, z0: -8, x1: -1.9, z1: -49, y: 2.9, n: 2 });
    decal(w, { kind: 'splat', seed: 7, x: 1.1, y: 0.02, z: -13, w: 2.4, h: 2.4 });
    decal(w, { kind: 'drag', seed: 9, x: 0, y: 0.02, z: -34, w: 3.4, h: 2.4, rot: 1.57 });
    decal(w, { kind: 'scratch', seed: 4, x: -2.14, y: 1.4, z: -27, w: 1.4, h: 1.4, face: 'e' });
    decal(w, { kind: 'hand', seed: 8, x: 2.14, y: 1.1, z: -12, w: 0.5, h: 0.5, face: 'w' });
    decal(w, { kind: 'hand', seed: 21, x: -2.14, y: 1.0, z: -38, w: 0.5, h: 0.5, face: 'e' });
    decal(w, { kind: 'puddle', seed: 6, x: -0.4, y: 0.025, z: -44, w: 2.6, h: 2.6 });
    gurney(w, { x: 1.55, z: -10.6, rot: 0.05, solid: true });
    wheelchair(w, { x: -1.5, z: -37, rot: 3.5 });
    box(w, { x: 1.7, y: 0.5, z: -45, w: 0.9, h: 1.0, d: 0.9, kind: 'rust', color: 0x66726c });                     // a crate of linen at the far end
    w.collider({ x: 1.7, y: 0.5, z: -45, w: 0.9, h: 1.0, d: 0.9 });
    stencil(w, 'WARD B', { x: -2.14, y: 2.6, z: -9, rot: Math.PI / 2, width: 2.4 });
    stencil(w, 'RECORDS', { x: 2.14, y: 2.65, z: -14.4, rot: -Math.PI / 2, width: 2.0 });
    stencil(w, 'LOCKERS', { x: -2.14, y: 2.65, z: -20.4, rot: Math.PI / 2, width: 2.0 });
    stencil(w, 'INFIRMARY', { x: -2.14, y: 2.6, z: -26, rot: Math.PI / 2, width: 2.4 });
    stencil(w, 'SERVICE', { x: 2.14, y: 2.65, z: -28.6, rot: -Math.PI / 2, width: 1.8 });
    stencil(w, 'LINEN', { x: -2.14, y: 2.65, z: -40.2, rot: Math.PI / 2, width: 1.6 });
    // the records door's reader (corridor east wall) and the shutter that closes the corridor
    const recReader = reader(w, { x: 2.1, z: -18.7, rot: -Math.PI / 2 });

    // ---- LOCKER ROOM (west, z -23): the hiding lesson ---------------------------------------------------------------------------
    room(w, { x: -6.2, z: -23, w: 8, d: 6, sides: { e: false }, doors: {}, path: false });
    for (let i = 0; i < 5; i++) locker(w, { x: -9.55, z: -25 + i * 0.64, rot: Math.PI / 2, ajar: i === 3 ? 0.7 : i === 0 ? 0.25 : 0 });
    for (let i = 0; i < 3; i++) locker(w, { x: -8.4 + i * 0.64, z: -25.65, rot: 0, ajar: i === 1 ? 0.5 : 0 });
    box(w, { x: -6.6, y: 0.25, z: -22, w: 2.4, h: 0.5, d: 0.5, kind: 'wood', rough: 0.8 });                          // a bench
    w.collider({ x: -6.6, y: 0.25, z: -22, w: 2.4, h: 0.5, d: 0.5 });
    H.lamp({ x: -6.2, y: 3.35, z: -23, mode: 'buzz' });
    decal(w, { kind: 'puddle', seed: 12, x: -6.4, y: 0.025, z: -24, w: 2.2, h: 2.2 });
    decal(w, { kind: 'splat', seed: 15, x: -9.84, y: 1.1, z: -23.4, w: 1.4, h: 1.4, face: 'e' });
    stencil(w, 'STAND STILL', { x: -9.88, y: 2.7, z: -21, rot: Math.PI / 2, width: 2.6, color: '#a8554a' });
    const T2 = trolley(w, { x: -7.7, z: -20.9, rot: 0.3 });

    // ---- RECORDS (east, z -17) with the barred window onto the service corridor -----------------------------------------------
    room(w, { x: 6.2, z: -17, w: 8, d: 6, sides: { w: false }, doors: { e: [{ c: 0, w: 2.0 }] }, path: false });
    desk(w, { x: 7.8, z: -18.6, rot: Math.PI / 2 }); desk(w, { x: 4.4, z: -19.0, rot: 0.15, papers: false });
    box(w, { x: 9.3, y: 1.1, z: -15.4, w: 0.9, h: 2.2, d: 0.6, kind: 'rust', color: 0x66726c, rough: 0.6 });
    w.collider({ x: 9.3, y: 1.1, z: -15.4, w: 0.9, h: 2.2, d: 0.6 });
    box(w, { x: 9.3, y: 1.1, z: -14.7, w: 0.9, h: 2.2, d: 0.6, kind: 'rust', color: 0x5d6b66, rough: 0.6 });
    w.collider({ x: 9.3, y: 1.1, z: -14.7, w: 0.9, h: 2.2, d: 0.6 });
    H.lamp({ x: 6.2, y: 3.35, z: -17, mode: 'dying' });
    decal(w, { kind: 'scratch', seed: 3, x: 6.2, y: 1.5, z: -19.84, w: 1.6, h: 1.6, face: 'n' });
    decal(w, { kind: 'drag', seed: 6, x: 5.6, y: 0.02, z: -16, w: 2.6, h: 2.0, rot: 0.5 });
    stencil(w, 'INTAKE RECORDS', { x: 6.2, y: 2.7, z: -14.18, rot: Math.PI, width: 3.0 });
    grille(w, { x: 10.3, z: -17, along: 'z', width: 2.0 });
    box(w, { x: 6.2, y: 1.45, z: -19.8, w: 1.3, h: 0.9, d: 0.05, kind: 'wood', color: 0x6a5a40, rough: 0.9, shadow: false });
    checkpoint(w, { x: 5.2, z: -16.4 });

    // ---- the PASSAGE (z -31) and the SERVICE CORRIDOR (x 10.6..18.6, z -42..-14): dark ------------------------------------------
    room(w, { x: 6.45, z: -31, w: 8.3, d: 3.2, sides: { w: false, e: false }, doors: {}, path: false });
    const pasLamp = H.lamp({ x: 6.4, y: 3.35, z: -31, mode: 'dying', len: 1.0 });
    room(w, { x: 14.6, z: -28, w: 8, d: 28, h: 3.4, doors: { w: [{ c: 11, w: 2.0 }, { c: -3, w: 1.8 }] }, floorKind: 'tile', wallKind: 'tile' });
    const scLamps = [-17.5, -23.5, -29.5, -35.5, -40].map((z, i) => H.lamp({ x: 14.6, y: 3.35, z, mode: ['steady', 'buzz', 'dying', 'buzz', 'dying'][i], rot: Math.PI / 2, len: 1.3 }));
    pipes(w, { x0: 17.6, z0: -15, x1: 17.6, z1: -41, y: 2.9, n: 3 });
    gurney(w, { x: 17.5, z: -20, rot: 0.1 }); gurney(w, { x: 17.4, z: -21.6, rot: -0.08 });
    for (let i = 0; i < 4; i++) locker(w, { x: 18.3, z: -33.4 - i * 0.64, rot: -Math.PI / 2, ajar: i === 2 ? 0.8 : 0 });
    wheelchair(w, { x: 12.3, z: -36, rot: 0.4 });
    decal(w, { kind: 'drag', seed: 17, x: 14.6, y: 0.02, z: -26, w: 3.2, h: 3.0, rot: 1.57 });
    decal(w, { kind: 'splat', seed: 18, x: 14, y: 0.02, z: -37, w: 2.6, h: 2.6 });
    decal(w, { kind: 'hand', seed: 19, x: 10.76, y: 1.2, z: -26, w: 0.5, h: 0.5, face: 'e' });
    decal(w, { kind: 'scratch', seed: 22, x: 18.44, y: 1.4, z: -27, w: 1.5, h: 1.5, face: 'w' });
    box(w, { x: 18.3, y: 1.5, z: -38.6, w: 0.3, h: 0.9, d: 0.8, kind: 'rust', color: 0x4d5a56, rough: 0.5 });
    const fuseLed = box(w, { x: 18.12, y: 1.8, z: -38.6, w: 0.03, h: 0.06, d: 0.3, kind: 'concrete', color: 0xff3a2a, shadow: false });
    stencil(w, 'SERVICE · STAFF ONLY', { x: 14.6, y: 2.7, z: -14.18, rot: Math.PI, width: 4.2 });
    const T3 = trolley(w, { x: 12.2, z: -24.6, rot: -0.2 });

    // ---- LINEN STORE (west, z -43): console A ------------------------------------------------------------------------------------
    room(w, { x: -6.2, z: -43, w: 8, d: 6, sides: { e: false }, doors: {}, path: false });
    for (let i = 0; i < 4; i++) locker(w, { x: -4.4 + i * 0.64, z: -40.4, rot: Math.PI, ajar: i === 1 ? 0.6 : 0 });
    H.lamp({ x: -6.2, y: 3.35, z: -43, mode: 'buzz' });
    for (let i = 0; i < 3; i++) { box(w, { x: -4.3, y: 0.3 + i * 0.6, z: -45.5, w: 1.6, h: 0.6, d: 0.8, kind: 'concrete', color: 0xb9bdb0, rough: 1, shadow: true }); }
    w.collider({ x: -4.3, y: 0.9, z: -45.5, w: 1.6, h: 1.8, d: 0.8 });
    decal(w, { kind: 'splat', seed: 23, x: -6.8, y: 0.02, z: -44, w: 2.2, h: 2.2 });
    decal(w, { kind: 'hand', seed: 24, x: -9.84, y: 1.0, z: -41.6, w: 0.5, h: 0.5, face: 'e' });
    stencil(w, 'LINEN · BULKHEAD 3', { x: -6.2, y: 2.7, z: -39.84, rot: Math.PI, width: 3.6 });
    box(w, { x: -7.4, y: 0.45, z: -45.3, w: 1.2, h: 0.9, d: 0.7, kind: 'wood', rough: 0.8 }); w.collider({ x: -7.4, y: 0.45, z: -45.3, w: 1.2, h: 0.9, d: 0.7 });
    const fuseMesh = box(w, { x: -7.4, y: 0.99, z: -45.3, w: 0.16, h: 0.1, d: 0.16, kind: 'rust', color: 0xc9a24a, rough: 0.4, shadow: false });
    const T1 = trolley(w, { x: 1.55, z: -35.6, rot: 0.1 });

    // ---- the HALL behind the bulkhead (z -50 .. -66) and the lift ----------------------------------------------------------------
    room(w, { x: 0, z: -58, w: 16, d: 16, doors: { s: [{ c: 0, w: 4.4 }] }, floorKind: 'tile', wallKind: 'tile' });
    const hallLamps = [H.lamp({ x: 0, y: 3.35, z: -57, mode: 'strobe', len: 2.2 }), H.lamp({ x: -5, y: 3.35, z: -54, mode: 'dead' }), H.lamp({ x: 5, y: 3.35, z: -62, mode: 'dying' }), H.lamp({ x: -5, y: 3.35, z: -61, mode: 'buzz' })];
    const hallBeds = [-5.6, -1.9, 1.9, 5.6];
    hallBeds.forEach((x, i) => { bed(w, { x, z: -63.6, rot: 0, strapped: i % 2 === 0 }); });
    curtain(w, { x: -3.8, z: -62, width: 3.4, rot: 0 }); curtain(w, { x: 3.8, z: -62, width: 3.4, rot: 0, open: 0.4 });
    wheelchair(w, { x: -6, z: -55, rot: 1.2 }); wheelchair(w, { x: 6.2, z: -53.4, rot: -2.0 }); gurney(w, { x: 6.4, z: -57, rot: 0.1 });
    pipes(w, { x0: -7.6, z0: -52, x1: -7.6, z1: -65, y: 3.0, n: 3 });
    decal(w, { kind: 'splat', seed: 31, x: 0, y: 0.02, z: -59, w: 3.4, h: 3.4 });
    decal(w, { kind: 'drag', seed: 32, x: -2, y: 0.02, z: -55, w: 3.4, h: 2.4, rot: 1.3 });
    decal(w, { kind: 'puddle', seed: 33, x: 3, y: 0.025, z: -60.4, w: 2.8, h: 2.8 });
    decal(w, { kind: 'hand', seed: 34, x: 7.84, y: 1.2, z: -58, w: 0.5, h: 0.5, face: 'w' });
    decal(w, { kind: 'scratch', seed: 35, x: -7.84, y: 1.3, z: -57, w: 1.5, h: 1.5, face: 'e' });
    wardWindow(w, { x: -7.84, y: 1.9, z: -60.4, rot: Math.PI / 2 }); wardWindow(w, { x: 7.84, y: 1.9, z: -60.4, rot: -Math.PI / 2 });
    stencil(w, 'LIFT · WARD B', { x: 0, y: 3.0, z: -65.82, rot: 0, width: 3.0 });
    stencil(w, 'DAY ROOM', { x: -3, y: 2.9, z: -50.18, rot: 0, width: 2.6 });
    exitDoor(w, { x: 0, z: -65.7, rot: 0 });
    const liftPanel = reader(w, { x: -3.7, y: 1.3, z: -65.82 });
    // the lift's inner doors stay shut until the car arrives
    const liftDoor = door(w, { x: 0, z: -64.3, along: 'x', width: 2.4, key: 'lift', locked: true, label: 'lift door' });
    checkpoint(w, { x: 6.2, z: -52.4, side: -1 });

    // ============================================================ the Orderly ========================================================
    const N = (id, x, z) => ({ id, x, z });
    const st = stalker(w, game, H, S, {
      nodes: [N('c1', -0.6, -20), N('cw1', -0.6, -23), N('c2', -0.6, -27), N('c3', -0.6, -33), N('cp', -0.6, -31), N('cw2', -0.6, -43), N('c4', -0.6, -47),
        N('w1', -6.2, -23), N('w2', -6.2, -43), N('pas', 6.4, -31), N('sc1', 14.6, -31), N('scn', 14.6, -38), N('scs', 14.0, -18.2),
        N('h0', 0, -53.5), N('h1', 0, -58.5)],
      route: ['c4'], start: 'c4', speed: 1.7, pause: 2.4, link: 20,
    });
    const LOOP = ['c2', 'cw1', 'w1', 'cw1', 'c1', 'c2', 'c3', 'cp', 'pas', 'sc1', 'scn', 'sc1', 'pas', 'cp', 'c3', 'cw2', 'w2', 'cw2', 'c4', 'c3'];
    st.hideSpot({ x: -8.5, z: -23.2, w: 3.2, d: 4.2 });          // the locker bay
    st.hideSpot({ x: 7.6, z: -15.0, w: 3.4, d: 2.2 });           // behind the filing cabinets in records
    st.hideSpot({ x: 5.2, z: -19.0, w: 3.0, d: 1.4 });
    st.hideSpot({ x: -3.6, z: -41.8, w: 3.4, d: 2.4 });          // the linen store lockers
    st.hideSpot({ x: 17.3, z: -35.0, w: 2.4, d: 3.6 });          // the service lockers
    st.hideSpot({ x: -3.8, z: -62.6, w: 5.6, d: 2.4 }); st.hideSpot({ x: 3.8, z: -62.6, w: 5.6, d: 2.4 });   // between the hall beds
    st.setActive(false);
    const Z = scares(w, game, H, S), R = roles(w, game);
    const orderlyOn = (id, route, idx = 0) => c.emit('ob:on', { id, route, idx });
    c.onEvent('ob:on', (a) => { const n = st.nodeAt(a.id); st.setActive(true); st.warp(n.x, n.z); st.setRoute(a.route, a.idx || 0); st.state = 'patrol'; });
    c.onEvent('ob:off', () => st.setActive(false));

    // ============================================================ shared state: doors, items ======================================
    const wardDoor = door(w, { x: 0, z: -8, along: 'x', width: 1.8, key: 'ward', locked: true, label: 'ward door' });
    const recDoor = door(w, { x: 2.3, z: -17, along: 'z', width: 1.6, key: 'rec', locked: true, label: 'records door' });
    const shutter = door(w, { x: 0, z: -28.7, along: 'x', width: 4.4, key: 'shutter', locked: true, label: 'infirmary shutter' });
    const bulk = door(w, { x: 0, z: -50, along: 'x', width: 4.4, key: 'bulk', locked: true, label: 'bulkhead' });
    checkpoint(w, { x: -1.1, z: -9.8 });
    const free = (r) => !!c.get('free:' + r, false);
    const hasCard = () => c.get('card', null);

    // ---- 1. straps -------------------------------------------------------------------------------------------------------------
    w.updaters.push(() => {
      if (!free(me) && game.state === 'playing') { const g = game.player; g.x = w.spawn.x; g.z = w.spawn.z; g.vx = g.vz = 0; if (g.y < 0.4) g.vy = 0; }
      for (const r of ['p1', 'p2']) sets[r].set(!free(r));
    });
    for (const r of ['p1', 'p2']) {
      const b = BED[r], fx = b.x + b.s * 0.55;
      holdable(w, game, hud, {
        x: fx, y: 1.1, z: b.z, w: 0.9, h: 1.2, d: 1.0, secs: r === me ? 7 : 6, bar: r === me ? 'WORKING THE BUCKLE' : 'UNDOING THE STRAPS',
        enabled: () => !free(r) && (r === me ? me === first : free(me)),
        label: () => (r === me ? 'Work your wrist free (hold E)' : `Undo ${partner()}'s straps (hold E)`),
        onDone: () => { c.set('free:' + r, true); S.door(0, 0.12); },
        tick: undefined,
      });
      // a little buckle sound while someone works the straps
    }
    let strapSnd = 0;
    w.updaters.push((dt) => { strapSnd -= dt; if (strapSnd <= 0 && game.focus && game.focus.label && hud.pressed()) { /* ticking handled by progress */ } });
    // wristband (your own bed, head end): your PARTNER's name and half of the dose code
    let bandRead = false;
    w.interactable({
      x: BED[me].x - BED[me].s * 0.62, y: 1.1, z: BED[me].z, w: 0.8, h: 1.2, d: 1.0, range: 3, pad: 0.1,
      label: () => 'Look at your wristband',
      onUse: () => {
        const half = me === 'p1' ? `<b style="font-size:26px;letter-spacing:.2em">${dA} ··</b><br>first half` : `<b style="font-size:26px;letter-spacing:.2em">·· ${dB}</b><br>second half`;
        readModal(game, { title: 'WRISTBAND', html: `<div style="text-align:center;line-height:1.7"><div style="letter-spacing:.3em;font-size:11px;color:#9fb0a8">LOWTIDE MEMORIAL · WARD B</div><div style="font-size:12px;margin-top:10px">PATIENT</div><div style="font-size:24px;font-weight:800;margin:2px 0 8px">${partner().toUpperCase()}</div><div style="font-size:12px">DOSE</div>${half}<div style="margin-top:12px;font-size:11px;color:#9fb0a8">IF FOUND, RETURN TO THE NIGHT DESK</div></div>` });
        if (!bandRead) { bandRead = true; w.after(0.8, () => sayMe('lt.c1.band')); }
      },
    });
    // wake-up lines
    w.after(2.2, () => { sayMe('lt.c1.wake', { priority: 2 }); });
    w.after(11, () => { if (!free(me)) say(me, me === first ? 'lt.c1.wake.first' : 'lt.c1.wake.wait'); });
    w.after(40, () => { if (!free(me) && me !== first) say(me, 'lt.c1.wake.wait2'); });
    let freedLine = false;
    c.on('free:' + me, (v) => { if (v && !freedLine) { freedLine = true; w.after(0.6, () => sayMe(me === first ? 'lt.c1.free.self' : 'lt.c1.free.other')); } });
    c.on('free:' + other, (v) => { if (v && me === first && !free(me + '')) { /* partner freed */ } });
    let both = false;
    w.updaters.push(() => { if (!both && free('p1') && free('p2')) { both = true; w.after(1.2, () => { Z.fire('blackoutWard'); say('all', 'lt.c1.free'); }); } });
    c.onEvent('sc:blackoutWard', () => { H.force(0); S.static(0.3, 0.1); setTimeout(() => H.force(null), 1700); });

    // ---- 2. torch, dose cabinet, key card --------------------------------------------------------------------------------------
    let torchLine = false;
    w.interactable({
      x: 0, y: 1.25, z: -3.4, w: 1.8, h: 0.9, d: 0.9, range: 3.2, pad: 0.1,
      label: () => 'Take your torch', enabled: () => free(me) && !c.get('torch:' + me, false),
      onUse: () => { c.set('torch:' + me, true); S.door(0, 0.06); S.step(0, 0.08); },
    });
    w.updaters.push(() => {
      H.torchOn = !!c.get('torch:' + me, false); H.theirOn = !!c.get('torch:' + other, false);
      torches.p1.visible = !c.get('torch:p1', false); torches.p2.visible = !c.get('torch:p2', false);
      if (H.torchOn && !torchLine) { torchLine = true; w.after(0.7, () => sayMe('lt.c1.torch')); }
    });
    let cabOpen = false;
    w.interactable({
      x: -4.0, y: 1.35, z: -6.85, w: 1.5, h: 1.6, d: 0.6, range: 3, pad: 0.1,
      label: () => (cabOpen ? 'Dose cabinet (open)' : 'Dose cabinet (keypad)'), enabled: () => free(me) && !cabOpen,
      onUse: () => {
        openKeypad(game, {
          title: 'DOSE CABINET', digits: 4, info: 'Each patient has half. First half, then second half.',
          onSubmit: (code, api) => { if (code === CODE) { api.close(); c.emit('cab-open'); } else { api.setMsg('WRONG DOSE', 'bad'); S.static(0.2, 0.05); api.lockout(3); } },
        });
      },
    });
    c.onEvent('cab-open', () => { if (cabOpen) return; cabOpen = true; cab.setOpen(true); S.door(0, 0.2); S.squeak(0, 0.06); say('all', 'lt.c1.cabinet', { priority: 1 }); });
    w.interactable({
      x: -4.1, y: 1.4, z: -6.95, w: 0.7, h: 0.9, d: 0.5, range: 3, pad: 0.1,
      label: () => 'Take the key card', enabled: () => cabOpen && !hasCard() && free(me),
      onUse: () => { c.set('card', me); },
    });
    c.on('card', (v) => { if (v) { cardMesh.visible = false; wardReader.led(0xffb040); recReader.led(0xffb040); if (v === me) w.after(0.4, () => sayMe('lt.c1.card')); } });
    const swipe = (id, ev) => ({
      label: () => (!hasCard() ? 'Card reader (no card)' : hasCard() === me ? 'Swipe the key card' : `${partner()} has the card`),
      enabled: () => !c.get(ev, false),
      onUse: () => { if (hasCard() === me) c.emit(ev); else { S.squeak(0, 0.05); say(me, hasCard() ? 'lt.c1.reader.theirs' : 'lt.c1.reader.no'); } },
    });
    w.interactable({ x: 1.7, y: 1.25, z: -7.2, w: 0.7, h: 0.8, d: 0.5, range: 3, pad: 0.1, ...swipe('ward', 'unlock:ward') });
    w.interactable({ x: 1.6, y: 1.25, z: -18.7, w: 0.5, h: 0.8, d: 0.7, range: 3, pad: 0.1, ...swipe('rec', 'unlock:rec'), enabled: () => !c.get('unlock:rec', false) && c.get('unlock:ward', false) });
    c.onEvent('unlock:ward', () => { c.set('unlock:ward', true); wardReader.led(0x3dff7a); wardDoor.unlock(); wardDoor.setOpen(true); S.door(0, 0.3); w.after(0.5, () => say('all', 'lt.c1.ward')); });
    c.onEvent('unlock:rec', () => { c.set('unlock:rec', true); recReader.led(0x3dff7a); recDoor.unlock(); recDoor.setOpen(true); S.door(0, 0.2); });

    // ---- 3. corridor, records, the window ---------------------------------------------------------------------------------------
    stage(w, 'corridor', { x: 0, y: 1, z: -12, w: 4.6, h: 3, d: 2.4 }, () => {
      R.whisper({ keyholder: 'lt.c1.whisper.k', subject: 'lt.c1.whisper.s' });
      w.after(6, () => Z.fire('behind', { kind: 'patient', role: hasCard() === 'p1' ? 'p2' : 'p1', dur: 14 }));
    });
    stage(w, 'records', { x: 6.2, y: 1, z: -17, w: 6, h: 3, d: 3.6 }, () => {
      say('all', 'lt.c1.records');
      w.after(10, () => { if (c.isHost) orderlyOn('scn', ['scs']); });
    });
    let lookT = -1;
    w.updaters.push((dt) => {
      if (!c.isHost || !st.on) return;
      const n = st.nodeAt('scs');
      if (c.get('winseen', false) === false && Math.hypot(st.x - n.x, st.z - n.z) < 1.3 && !c.get('ob:phase2', false)) {
        c.set('ob:phase2', true); lookT = 0; c.emit('win-look');
      }
      if (lookT >= 0) { lookT += dt; st.yaw += (Math.PI / 2 - st.yaw) * Math.min(1, dt * 3); if (lookT > 8) { lookT = -2; c.set('winseen', true); c.emit('ob:off'); } }
    });
    c.onEvent('win-look', () => { say('all', 'lt.c1.window'); w.after(1.2, () => Z.fire('knock', { n: 3 })); w.after(5, () => Z.fire('whisper', {})); });
    note(w, game, {
      x: 6.2, y: 1.45, z: -19.55, rot: 0, title: 'INTAKE FILE',
      html: {
        p1: '<b>ADMISSION</b><br>Two patients, one night, one ward.<br><br><b>Patient A</b> &mdash; restrained on arrival. Sedated. Memory: <i>unreliable</i>.<br><b>Patient B</b> &mdash; restrained on arrival. Sedated. Memory: <i>unreliable</i>.<br><br>Attending: <span style="color:#a8554a">[the name has been scratched out]</span><br><br><i>Do not let them compare bands.</i>',
        p2: '<b>ADMISSION</b><br>Two patients, one night, one ward.<br><br><b>Patient A</b> &mdash; restrained on arrival. Sedated. Memory: <i>unreliable</i>.<br><b>Patient B</b> &mdash; restrained on arrival. Sedated. Memory: <i>unreliable</i>.<br><br>Attending: <span style="color:#a8554a">present</span><br><br><i>One of them will try to help. Let them.</i>',
      },
      onRead: () => c.emit('filed'),
    });
    let filedDone = false;
    c.onEvent('filed', () => {
      if (filedDone) return; filedDone = true; c.set('filed', true);
      say('all', 'lt.c1.file', { priority: 2 }); S.intercom();
      const go = () => {
        if (!c.get('winseen', false)) { w.after(1, go); return; }                  // the window beat finishes first
        shutter.unlock(); shutter.setOpen(true); S.door(0, 0.3);
        w.after(2, () => { say('all', 'lt.c1.hide'); if (c.isHost) orderlyOn('c4', LOOP, 0); });
      };
      w.after(3, go);
    });

    // ---- 4. hide and lure -----------------------------------------------------------------------------------------------------
    for (const [T, it, x, z, i] of [[T1, 1, 1.55, -35.6, 'T1'], [T2, 2, -7.7, -20.9, 'T2'], [T3, 3, 12.2, -24.6, 'T3']]) {
      let cool = 0;
      c.onEvent('tray:' + i, (a) => { cool = w.t + 30; T.tip(); S.slam(0.4); S.scrape(0, 0.1); if (a.by === me) st.noise(x, z, 18); if (!c.get('traySaid', false)) { c.set('traySaid', true); w.after(1, () => say('all', 'lt.c1.tray')); } });
      w.interactable({ x, y: 1.1, z, w: 0.9, h: 0.5, d: 0.9, range: 3, pad: 0.1, label: () => 'Knock the tray over (noise)', enabled: () => w.t > cool && free(me) && !T.fallen, onUse: () => c.emit('tray:' + i, { by: me }) });
      w.updaters.push((dt) => T.update(dt));
      void it;
    }

    // ---- 5. the bulkhead: two consoles held at the same time -----------------------------------------------------------------
    w.interactable({ x: -7.4, y: 1.25, z: -45.3, w: 1.2, h: 0.9, d: 0.7, range: 3.2, pad: 0.1, label: () => 'Take the fuse', enabled: () => free(me) && !c.get('fuse', null),
      onUse: () => { c.set('fuse', me); S.step(0, 0.06); } });
    c.on('fuse', (v) => { if (v) fuseMesh.visible = false; if (v === me) w.after(0.5, () => sayMe('lt.c1.fuse')); });
    w.interactable({ x: 17.5, y: 1.5, z: -38.6, w: 0.9, h: 0.9, d: 0.9, range: 3, pad: 0.1,
      label: () => (c.get('fuse', null) === me ? 'Fit the fuse' : 'Fuse box (empty)'), enabled: () => !c.get('fuse-in', false) && free(me),
      onUse: () => { if (c.get('fuse', null) === me) c.emit('fuse-in'); else { S.squeak(0, 0.05); say(me, 'lt.c1.nofuse'); } } });
    c.onEvent('fuse-in', () => { c.set('fuse-in', true); fuseLed.material.color.setHex(0x3dff7a); S.door(0, 0.2); S.beat(0.6); say('all', 'lt.c1.fuse.in'); });
    let prog = 0, bulkDone = false, fired = { rush: false, dark: false, wrong: false };
    const heldOf = (id) => !!c.get('held:' + id, false);
    const consoles = {};
    const mk = (id, x, z, rot, cx, cz, label) => {
      const P = consoleProp(w, {
        x, z, rot, title: 'BULKHEAD 3',
        draw: (ctx, W, Hh) => {
          screenText(ctx, W, Hh, ['BULKHEAD 03', bulkDone ? 'STATUS  OPEN' : 'STATUS  SEALED', `KEY A  ${heldOf('A') ? '[ HELD ]' : '[  --  ]'}`, `KEY B  ${heldOf('B') ? '[ HELD ]' : '[  --  ]'}`, 'HOLD BOTH KEYS'], { color: bulkDone ? '#7dffb8' : heldOf(id) ? '#ffe08a' : '#ff8a7a', size: 20 });
          ctx.strokeStyle = '#7dffb8'; ctx.strokeRect(14, 150, 290, 22); ctx.fillStyle = '#7dffb8'; ctx.fillRect(16, 152, 286 * prog, 18);
        },
      });
      consoles[id] = P;
      let was = false;
      holdable(w, game, hud, {
        x: cx, y: 1.1, z: cz, w: 1.5, h: 1.3, d: 1.5, range: 3, secs: 9, noBar: true, bar: 'AUTHORISING',
        enabled: () => !bulkDone && free(me) && (id === 'A' || c.get('fuse-in', false)),
        label: () => (id === 'B' && !c.get('fuse-in', false) ? 'Console B has no power' : `Hold key ${id} (the other console must be held too)`),
        tick: (dt, s) => { if (s.held !== was) { was = s.held; c.set('held:' + id, s.held); if (s.held) c.set('holder:' + id, me); } s.k = prog; if (s.held) hud.show(heldOf(id === 'A' ? 'B' : 'A') ? 'AUTHORISING' : 'WAITING FOR THE OTHER KEY', prog); },
      });
      void label;
    };
    mk('A', -9.7, -43, Math.PI / 2, -8.6, -43, 'west');
    mk('B', 14.6, -41.35, 0, 14.6, -40.3, 'east');
    let scrT = 0;
    w.updaters.push((dt) => {
      if (bulkDone) return;
      const both2 = heldOf('A') && heldOf('B');
      prog = Math.max(0, Math.min(1, prog + (both2 ? dt / 12 : -dt / 2.5)));
      scrT -= dt; if (scrT <= 0) { scrT = 0.2; consoles.A.refresh(); consoles.B.refresh(); }
      if (both2 && prog > 0.42 && !fired.dark) { fired.dark = true; Z.fire('blackout', { sec: 2.6 }); Z.fire('wrong', { sec: 4.5 }); }
      if (prog >= 1) { bulkDone = true; c.emit('bulk-open'); }
    });
    let bulkOpened = false;
    c.onEvent('bulk-open', () => {
      if (bulkOpened) return; bulkOpened = true;
      bulkDone = true; prog = 1; consoles.A.refresh(); consoles.B.refresh();
      bulk.unlock(); bulk.setOpen(true); S.groan(0.25); S.door(0, 0.4);
      say('all', 'lt.c1.bulk', { priority: 2 });
    });
    // the service corridor goes dark the moment you step in, and the first console hold there is when it comes for you
    stage(w, 'sc', { x: 13.6, y: 1, z: -29, w: 6, h: 3, d: 5 }, () => {
      for (const L of scLamps) { L.mode = 'dead'; }
      Z.fire('blackout', { sec: 2.2 });
      w.after(1, () => say('all', 'lt.c1.dark'));
      w.after(7, () => R.whisper({ keyholder: 'lt.c1.sc.k', subject: 'lt.c1.sc.s' }));
      w.after(14, () => Z.stand('patient', 14.6, -39.4, { dur: 30 }));
    });
    let heldB = 0;
    w.updaters.push((dt) => {
      if (heldOf('B') && !heldOf('A')) heldB += dt; else heldB = Math.max(0, heldB - dt);
      if (heldB > 3.5 && !fired.rush && !bulkDone) { fired.rush = true; Z.fire('rush', { kind: 'patient', role: c.get('holder:B', 'p1'), dist: 9, dur: 1.1 }); }
    });
    stage(w, 'west', { x: -6, y: 1, z: -43, w: 6, h: 3, d: 5 }, () => { say('all', 'lt.c1.consoles'); });
    stage(w, 'bulkpre', { x: 0, y: 1, z: -46.5, w: 4.6, h: 3, d: 2.4 }, () => { if (!bulkDone) say('all', 'lt.c1.seal'); });

    // ---- 6. the hall, the lift --------------------------------------------------------------------------------------------------
    let called = false, liftOpen = false;
    stage(w, 'hall', { x: 0, y: 1, z: -55, w: 10, h: 3, d: 3 }, () => { say('all', 'lt.c1.hall'); R.whisper({ keyholder: 'lt.c1.hall.k', subject: 'lt.c1.hall.s' }); });
    w.interactable({
      x: -3.7, y: 1.3, z: -64.9, w: 0.8, h: 0.8, d: 0.6, range: 3, pad: 0.1,
      label: () => 'Call the lift', enabled: () => !c.get('lift-called', false) && bulkDone,
      onUse: () => c.emit('lift-call'),
    });
    c.onEvent('lift-call', () => {
      if (called) return; called = true; c.set('lift-called', true);
      liftPanel.led(0xffb040); S.groan(0.3); say('all', 'lt.c1.call', { priority: 2 });
      for (const L of hallLamps) L.mode = 'dying';
      if (c.isHost) { orderlyOn('c4', ['h0', 'h1', 'h0', 'c4'], 0); w.after(2, () => st.noise(0, -58.5, 24)); }
      w.after(8, () => say('all', 'lt.c1.callmid'));
      w.after(17, () => { Z.fire('whisper', {}); Z.fire('knock', { n: 2 }); });
      w.after(24, () => c.emit('lift-open'));
    });
    c.onEvent('lift-open', () => {
      if (liftOpen) return; liftOpen = true; liftDoor.unlock(); liftDoor.setOpen(true); S.door(0, 0.35); S.intercom();
      say(c.me, R.is('keyholder') ? 'lt.c1.lift.k' : 'lt.c1.lift.s', { priority: 2 });
      Z.fire('sting', { vol: 0.45 });
      Z.stand('patient', 0, -66.2, { dur: 3 });
      if (c.isHost) w.after(1, () => c.emit('ob:off'));
    });
    // if you die while he is hunting you in the hall, he gives up for a while (a respawn must never put you in his sight)
    let deaths = game.deaths || 0;
    w.updaters.push(() => { if ((game.deaths || 0) > deaths) { deaths = game.deaths; if (called && !liftOpen) { c.emit('ob:off'); w.after(10, () => { if (c.isHost && !liftOpen) orderlyOn('c4', ['h0', 'h1', 'c4'], 0); }); } } });

    // ============================================================ the bots ==========================================================
    const cardBot = me === 'p1';
    const foot = (r) => ({ x: BED[r].x + BED[r].s * 0.55, z: BED[r].z });
    const myFoot = foot(me), theirFoot = foot(other), amFirst = me === first;
    const steps = [];
    if (amFirst) {
      steps.push({ x: myFoot.x, z: myFoot.z, r: 1.3, use: true, until: () => free(me) });
      steps.push({ x: BED[other].x + BED[other].s * 1.5, z: theirFoot.z, r: 1.0, use: true, until: () => free(other) });
    } else steps.push({ until: () => free(me) });
    steps.push({ x: 0, z: -3.4, r: 1.7, use: true, until: () => c.get('torch:' + me, false) });
    if (cardBot) {
      steps.push({ x: -4.0, z: -6.2, r: 1.2, until: () => { if (!cabOpen) c.emit('cab-open'); return cabOpen; } });
      steps.push({ x: -4.1, z: -6.4, r: 1.2, use: true, until: () => !!hasCard() });
      steps.push({ x: 1.7, z: -7.2, r: 1.0, use: true, until: () => c.get('unlock:ward', false) });
    } else steps.push({ x: 2.5, z: -5.2, r: 1.0, until: () => c.get('unlock:ward', false) });
    steps.push({ x: 0, z: -9.5, r: 0.8 }, { x: 0, z: -17.4, r: 0.9 });
    if (cardBot) steps.push({ x: 1.6, z: -18.7, r: 0.8, use: true, until: () => c.get('unlock:rec', false) }); else steps.push({ x: 0, z: -17, r: 1.0, until: () => c.get('unlock:rec', false) });
    steps.push({ x: cardBot ? 5.2 : 8.0, z: cardBot ? -17 : -16.6, r: 0.9 });
    if (cardBot) steps.push({ x: 6.2, z: -19.55, r: 1.3, use: true, until: () => c.get('filed', false) }); else steps.push({ x: 8.0, z: -16.6, r: 0.9, until: () => c.get('filed', false) });
    steps.push({ x: 1.0, z: -17, r: 0.9 }, { x: 0, z: -17.2, r: 0.7 });
    steps.push({ x: 0, z: -27, r: 1.0, until: () => !shutter.locked && shutter.open });
    if (cardBot) {
      steps.push({ x: 0, z: -43, r: 1.0 }, { x: -7.4, z: -45.3, r: 1.5, use: true, until: () => c.get('fuse', null) === me }, { x: 0, z: -43, r: 1.0 });
      steps.push({ x: 0, z: -31, r: 0.9 }, { x: 6.4, z: -31, r: 0.9 }, { x: 14.6, z: -31, r: 0.9 }, { x: 17.5, z: -38.6, r: 1.0, use: true, until: () => c.get('fuse-in', false) });
      steps.push({ x: 14.6, z: -39.9, r: 1.2, use: true, until: () => bulkDone }, { x: 14.6, z: -31, r: 0.9 }, { x: 6.4, z: -31, r: 0.9 }, { x: 0, z: -31, r: 0.9 });
    } else {
      steps.push({ x: 0, z: -43, r: 1.0 }, { x: -8.4, z: -43, r: 1.2, use: true, until: () => bulkDone }, { x: 0, z: -43, r: 1.0 });
    }
    steps.push({ x: 0, z: -47, r: 1.0 }, { x: 0, z: -56, r: 1.2 });
    steps.push({ x: cardBot ? -3.7 : -2.9, z: cardBot ? -64.9 : -64.2, r: 1.3, use: cardBot, until: () => c.get('lift-called', false) });
    steps.push({ x: cardBot ? -1.0 : 1.0, z: -60, r: 1.0, until: () => liftOpen });
    steps.push({ x: 0, z: -65.2, r: 0.6 });
    botSteps(w, { [me]: steps });

    // a few details of the first minutes
    c.onEvent('ob:calm', () => {});
  },
};
