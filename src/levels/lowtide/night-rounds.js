import { stalker } from './stalker.js';
import { scares } from './scare.js';
import { roles } from './roles.js';
import { botSteps } from '../coop/kit.js';
import { horrorEnv, exitDoor, checkpoint, door, room, hp, box, decal, bed, locker, curtain, gurney, wheelchair, pipes, desk, barWindow, stencil, note } from './kit.js';
import * as K from './night-rounds-kit.js';

// Chapter 2 — NIGHT ROUNDS. Ward B at night: a ring corridor round a nurses' station, a laundry to the east, a dormitory to the west, a stairwell
// to the north. The Orderly walks the ring. Beats:
//   1 lobby sign-in (two far mats)  2 the first round (hide)  3 the hack (one holds the terminal, the other rings call bells to pull him away)
//   4 pharmacy + laundry (dryer interlock, he comes to the noise, you hide in the sheets)  5 the dormitory door code (halves in two rooms)
//   6 lights out: 2 minutes of hide and seek with a heartbeat meter, torch off  7 the vent crawl (plates + grille, leapfrog)
//   8 the fuses: the alarm, he hunts, you run the ring (two fuses at the far corners, one door to reach).
const PI = Math.PI;
const RING = ['a5', 'a6', 'a7', 'a8', 'a1', 'a2', 's1', 's2', 's1', 'a2', 'a3', 'a4'];

export default {
  id: 'lowtide2',
  name: 'Night Rounds',
  music: 'l1',
  horror: true,
  deathRule: 'self',
  completeQuip: 'Rounds complete. The Orderly will see you at the next one.',
  titleCam: { center: [0, 2, -36], radius: 34, height: 26 },

  build(w, game) {
    const H = horrorEnv(w, game, { density: 0.056 });
    const S = H.S, c = w.coop, me = c.me, other = c.other;
    w.spawn = { x: me === 'p1' ? -2.2 : 2.2, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    const tell = (r, k, o) => c.tell(r, k, o);
    const Z = scares(w, game, H, S), R = roles(w, game);
    const UI = K.hud(w);
    const pp = () => game.player;
    const partnerPos = () => { const P = c.partner; return P.has ? { x: P.sx, z: P.sz } : null; };
    const panTo = (x, z) => { const cam = game.camera.position, rel = Math.atan2(x - cam.x, z - cam.z) - game.yaw; return Math.max(-1, Math.min(1, Math.sin(rel + PI) * 0.9)); };

    // ---- one-shot events that fire once on both machines -------------------------------------------------------------------
    const once = (name, fn) => { let done = false; c.onEvent('c2:' + name, (a) => { if (done) return; done = true; fn(a || {}); }); return (a) => c.emit('c2:' + name, a || {}); };
    const enter = (name, b, fn, need = 'any') => { const fire = once(name, fn); const zn = c.zone({ ...b, need, shrink: 0 }); zn.onChange((z) => { if (z.active) fire(); }); return zn; };
    const flag = (k, d = false) => c.get('c2.' + k, d);

    // =============================================================================================================================
    //  THE BUILDING
    // =============================================================================================================================
    // ---- lobby (the lift you came up in is behind you) ---------------------------------------------------------------------
    room(w, { x: 0, z: 2, w: 12, d: 16, doors: { n: [{ c: 0, w: 1.8 }] } });
    // ---- connector corridor -------------------------------------------------------------------------------------------------
    room(w, { x: 0, z: -9.5, w: 3, d: 7, sides: { s: false, n: false }, doors: {}, path: false });
    // ---- the ring: outer shell (its floor is replaced by four strips so the middle block can have its own floor) ------------
    const outer = room(w, { x: 0, z: -36, w: 34, d: 46, doors: { s: [{ c: 0, w: 1.8 }], n: [{ c: 0, w: 2.4 }], w: [{ c: 0, w: 2.2 }], e: [{ c: 0, w: 2.2 }] }, path: false });
    outer.floor.body.enabled = false; outer.floor.group.visible = false;
    for (const f of [{ x: 0, z: -15, w: 34, d: 4 }, { x: 0, z: -57, w: 34, d: 4 }, { x: -14.75, z: -36, w: 4.5, d: 38 }, { x: 14.75, z: -36, w: 4.5, d: 38 }]) hp(w, { ...f, y: 0, h: 1, kind: 'lino', path: false });
    // ---- the middle block: nurses' station (south) and the pharmacy store (north) -----------------------------------------
    room(w, { x: 0, z: -27, w: 25, d: 20, doors: { s: [{ c: 0, w: 3.6 }], n: [{ c: 8, w: 1.8 }] }, floorKind: 'tile', wallKind: 'tile', path: false });
    room(w, { x: 0, z: -46, w: 25, d: 18, sides: { s: false }, doors: {}, floorKind: 'concrete', path: false });
    // ---- laundry (east), dormitory (west) -------------------------------------------------------------------------------------
    room(w, { x: 25, z: -36, w: 16, d: 24, sides: { w: false }, doors: {}, floorKind: 'concrete', wallKind: 'tile', path: false });
    room(w, { x: -25, z: -36, w: 16, d: 24, sides: { e: false }, doors: { n: [{ c: -5, w: 1.4 }] }, path: false });
    // ---- stairwell (north) with a power door in front of the lift ---------------------------------------------------------
    room(w, { x: 0, z: -65.5, w: 10, d: 13, sides: { s: false }, doors: { w: [{ c: -0.5, w: 1.4 }] }, floorKind: 'concrete', wallKind: 'tile', path: false });
    for (const sx of [-2.95, 2.95]) hp(w, { x: sx, z: -69, y: 0, w: 4.1, d: 0.3, h: 3.4, kind: 'plaster', path: false });
    box(w, { x: 0, y: 3.05, z: -69, w: 1.8, h: 0.7, d: 0.3, kind: 'plaster' });
    // ---- the duct (outside the ring): dormitory -> stairwell ----------------------------------------------------------------
    K.ductFloor(w, { x0: -30, z0: -48.1, x1: -30, z1: -66.8, width: 1.6 }); K.ductFloor(w, { x0: -29.2, z0: -66, x1: -5, z1: -66, width: 1.6 });
    K.ductWall(w, { x0: -30.8, z0: -66.8, x1: -30.8, z1: -48.1 }); K.ductWall(w, { x0: -29.2, z0: -65.2, x1: -29.2, z1: -48.1 });
    K.ductWall(w, { x0: -30.8, z0: -66.8, x1: -5, z1: -66.8 }); K.ductWall(w, { x0: -29.2, z0: -65.2, x1: -5, z1: -65.2 });
    K.ductCeil(w, { x0: -30.8, z0: -66.8, x1: -29.2, z1: -48.1 }); K.ductCeil(w, { x0: -29.2, z0: -66.8, x1: -5, z1: -65.2 });

    // ---- doors ---------------------------------------------------------------------------------------------------------------
    const D = {
      signin: door(w, { x: 0, z: -6, along: 'x', width: 1.8, key: 'c2signin', locked: true, label: 'ward door' }),
      laundry: door(w, { x: 17, z: -36, along: 'z', width: 2.2, key: 'c2laundry', locked: true, label: 'laundry door' }),
      dorm: door(w, { x: -17, z: -36, along: 'z', width: 2.2, key: 'c2dorm', locked: true, label: 'dormitory door' }),
      vault: door(w, { x: 8, z: -37, along: 'x', width: 1.8, key: 'c2vault', locked: true, label: 'pharmacy door' }),
      vent: door(w, { x: -30, z: -48, along: 'x', width: 1.4, key: 'c2vent', locked: true, label: 'vent hatch' }),
      duct: door(w, { x: -30, z: -56, along: 'x', width: 1.4, key: 'c2duct', locked: true, label: 'duct grille' }),
      stair: door(w, { x: 0, z: -59, along: 'x', width: 2.4, key: 'c2stair', locked: true, label: 'stairwell door' }),
      exit: door(w, { x: 0, z: -69, along: 'x', width: 1.8, key: 'c2exit', locked: true, label: 'power door' }),
    };

    // =============================================================================================================================
    //  THE ORDERLY
    // =============================================================================================================================
    const NODES = [
      ['a1', -14.75, -15], ['a2', 0, -15], ['a3', 14.75, -15], ['a4', 14.75, -36], ['a5', 14.75, -57], ['a6', 0, -57], ['a7', -14.75, -57], ['a8', -14.75, -36],
      ['cn', 0, -9.5], ['s1', 0, -21], ['s2', 0, -31], ['s3', 7.5, -34], ['v1', 8, -41], ['v2', -6, -47], ['v3', 8, -51],
      ['ld0', 19.5, -36], ['ld1', 24, -28.5], ['ld2', 24, -43], ['ld3', 30, -37],
      ['dd', -19.2, -36], ['A1', -27.9, -27], ['A2', -27.9, -33], ['A3', -27.9, -39], ['A4', -27.9, -45], ['B1', -21.9, -27], ['B2', -21.9, -32], ['B3', -21.9, -36], ['B4', -21.9, -42], ['B5', -21.9, -46], ['E1', -25, -25.6], ['E2', -25, -46.6],
    ];
    const st = stalker(w, game, H, S, {
      nodes: NODES.map(([id, x, z]) => ({ id, x, z })), route: RING, start: 'a4', speed: 2.0, chaseSpeed: 5.9, link: 24, home: 'a3',
    });
    st.setActive(false);
    st.link('a4', 'ld0', () => D.laundry.open); st.link('a8', 'dd', () => D.dorm.open); st.link('s3', 'v1', () => D.vault.open);
    st.link('s2', 's3', () => true);
    // hiding places (stand still inside one)
    const HS = [
      { x: -8, z: -14.8, w: 3.4, d: 1.6 }, { x: 8, z: -57.8, w: 3.4, d: 1.6 }, { x: -15.9, z: -23.5, w: 1.6, d: 3.4 }, { x: 15.9, z: -46, w: 1.6, d: 3.4 },
      { x: -11.3, z: -29.5, w: 1.8, d: 3.4 }, { x: -6.5, z: -27.5, w: 3.6, d: 1.6 }, { x: -9, z: -44, w: 4, d: 1.8 },
      { x: 18.4, z: -42.5, w: 1.8, d: 3.6 }, { x: 25, z: -34.6, w: 7, d: 1.5 }, { x: 22, z: -43.2, w: 3, d: 1.6 },
      { x: -30.7, z: -28.75, w: 2.0, d: 1.4 }, { x: -30.7, z: -32.25, w: 2.0, d: 1.4 }, { x: -30.7, z: -42.75, w: 2.0, d: 1.4 }, { x: -19.3, z: -28.75, w: 2.0, d: 1.4 }, { x: -19.3, z: -42.75, w: 2.0, d: 1.4 },
      { x: -25, z: -32.25, w: 2.0, d: 1.4 }, { x: -25, z: -39.25, w: 2.0, d: 1.4 }, { x: -25.9, z: -46.4, w: 3.4, d: 1.4 },
    ];
    for (const h of HS) st.hideSpot(h);

    // =============================================================================================================================
    //  DRESSING
    // =============================================================================================================================
    const L = (x, z, mode, o = {}) => H.lamp({ x, y: 3.35, z, mode, power: 0.62, ...o });
    // ---- lobby ---------------------------------------------------------------------------------------------------------------
    L(-2.5, 0, 'buzz'); L(3, 5, 'dying'); L(0, -3.4, 'steady', { color: 0xcfe8dc, len: 1.6 });
    stencil(w, 'CHAPTER 2 · NIGHT ROUNDS', { x: -3.4, y: 2.5, z: -5.8, rot: 0, width: 4.6, size: 0.3 });
    stencil(w, 'WARD B · STAFF ONLY', { x: 0, y: 2.7, z: 9.8, rot: PI, width: 3.4, size: 0.34 });
    // the arrival lift behind you: shut, with a dead indicator
    box(w, { x: 0, y: 1.25, z: 9.75, w: 2.8, h: 2.5, d: 0.2, kind: 'rust', color: 0x59645f, rough: 0.5 });
    box(w, { x: -0.7, y: 1.2, z: 9.62, w: 1.3, h: 2.3, d: 0.06, kind: 'rust', color: 0x7a8682, rough: 0.35 }); box(w, { x: 0.7, y: 1.2, z: 9.62, w: 1.3, h: 2.3, d: 0.06, kind: 'rust', color: 0x7a8682, rough: 0.35 });
    box(w, { x: 0, y: 2.78, z: 9.62, w: 0.5, h: 0.14, d: 0.05, color: 0x33140f, kind: 'rust' });
    desk(w, { x: 3.4, z: -2.6, rot: 0 }); desk(w, { x: -3.6, z: -2.6, rot: 0, papers: false });
    for (let i = 0; i < 4; i++) box(w, { x: -4.9, y: 0.25, z: 3 + i * 1.3, w: 0.7, h: 0.5, d: 0.7, kind: 'padded', color: 0x4d5a52, rot: 0.1 * i });
    wheelchair(w, { x: 4.6, z: 4.4, rot: -2.2 });
    decal(w, { kind: 'puddle', seed: 4, x: 1.4, y: 0.025, z: 1.5, w: 2.4, h: 2.4 });
    decal(w, { kind: 'drag', seed: 11, x: 0, y: 0.02, z: -2, w: 3.6, h: 3, face: 'floor', rot: 1.57 });
    decal(w, { kind: 'scratch', seed: 3, x: 5.8, y: 1.4, z: 2, w: 1.3, h: 1.3, face: 'w' }); decal(w, { kind: 'hand', seed: 6, x: -5.82, y: 1.2, z: -3.4, w: 0.5, h: 0.5, face: 'w' });
    barWindow(w, { x: -5.82, y: 1.9, z: 4, rot: PI / 2 }); barWindow(w, { x: 5.82, y: 1.9, z: 2, rot: -PI / 2 });
    // ---- connector --------------------------------------------------------------------------------------------------------------
    L(0, -9.5, 'dying', { rot: PI / 2, len: 1.0 });
    decal(w, { kind: 'drag', seed: 5, x: 0, y: 0.02, z: -10, w: 1.8, h: 4, face: 'floor', rot: 1.57 }); decal(w, { kind: 'hand', seed: 2, x: 1.36, y: 1.1, z: -8, w: 0.5, h: 0.5, face: 'e' });
    // ---- the ring ---------------------------------------------------------------------------------------------------------------
    [-12, -4, 4, 12].forEach((x, i) => { L(x, -15, ['buzz', 'dying', 'steady', 'buzz'][i], { len: 1.4, shaft: false }); L(x, -57, ['dying', 'buzz', 'dead', 'buzz'][i], { len: 1.4, shaft: false }); });
    [-23, -31, -39, -47, -52].forEach((z, i) => { L(-14.75, z, ['buzz', 'steady', 'dying', 'buzz', 'dead'][i], { rot: PI / 2, len: 1.4, shaft: false }); L(14.75, z, ['dying', 'buzz', 'steady', 'dead', 'buzz'][i], { rot: PI / 2, len: 1.4, shaft: false }); });
    pipes(w, { x0: -16.2, z0: -17, x1: -16.2, z1: -55, y: 2.95, n: 2 }); pipes(w, { x0: 16.2, z0: -17, x1: 16.2, z1: -55, y: 2.95, n: 2 }); pipes(w, { x0: -16, z0: -14, x1: 16, z1: -14, y: 2.95, n: 2 }); pipes(w, { x0: -16, z0: -58, x1: 16, z1: -58, y: 2.95, n: 1 });
    // lockers = hiding places
    for (let i = 0; i < 5; i++) locker(w, { x: -9.6 + i * 0.64, z: -13.5, rot: PI, ajar: i === 2 ? 0.7 : 0 });
    for (let i = 0; i < 5; i++) locker(w, { x: 6.8 + i * 0.64, z: -58.55, rot: 0, ajar: i === 3 ? 0.6 : 0 });
    for (let i = 0; i < 5; i++) locker(w, { x: -16.55, z: -25 + i * 0.64, rot: PI / 2, ajar: i === 1 ? 0.8 : 0 });
    for (let i = 0; i < 5; i++) locker(w, { x: 16.55, z: -44 + i * 0.64, rot: -PI / 2, ajar: i === 3 ? 0.7 : 0 });
    // windows onto the tide
    for (const z of [-22, -50]) { barWindow(w, { x: -16.84, y: 1.9, z, rot: PI / 2 }); barWindow(w, { x: 16.84, y: 1.9, z: z - 2, rot: -PI / 2 }); }
    for (const x of [-9, 9]) barWindow(w, { x, y: 1.9, z: -58.84, rot: 0 });
    // clutter that leaves the middle of the corridor free
    gurney(w, { x: -11.6, z: -17.9, rot: PI / 2, solid: true }); wheelchair(w, { x: 16.2, z: -28, rot: -1.4 }); gurney(w, { x: -16.0, z: -48, rot: 0.1, solid: true });
    wheelchair(w, { x: 12.2, z: -55.6, rot: 2.9 }); gurney(w, { x: 15.9, z: -20.5, rot: 0.15, solid: true });
    // blood, damp, hands
    decal(w, { kind: 'drag', seed: 21, x: 4, y: 0.02, z: -15.6, w: 6, h: 3, rot: 0 });
    decal(w, { kind: 'splat', seed: 8, x: 14.5, y: 0.02, z: -33, w: 2.6, h: 2.6 }); decal(w, { kind: 'drag', seed: 23, x: -14.75, y: 0.02, z: -42, w: 3, h: 5, rot: 1.57 });
    decal(w, { kind: 'puddle', seed: 9, x: 0, y: 0.025, z: -57, w: 3, h: 2.4 }); decal(w, { kind: 'splat', seed: 12, x: -14, y: 0.02, z: -56, w: 2.6, h: 2.6 });
    decal(w, { kind: 'hand', seed: 14, x: -12.64, y: 1.2, z: -33, w: 0.5, h: 0.5, face: 'e' }); decal(w, { kind: 'hand', seed: 15, x: -12.64, y: 1.0, z: -33.4, w: 0.5, h: 0.5, face: 'e' });
    decal(w, { kind: 'scratch', seed: 17, x: 12.64, y: 1.4, z: -22, w: 1.4, h: 1.4, face: 'w' }); decal(w, { kind: 'hand', seed: 18, x: 16.84, y: 1.2, z: -33, w: 0.5, h: 0.5, face: 'e' });
    decal(w, { kind: 'scratch', seed: 20, x: 0, y: 1.5, z: -55.16, w: 1.6, h: 1.6, face: 's' });
    stencil(w, 'WARD B · WEST', { x: -12.64, y: 2.5, z: -45, rot: -PI / 2, width: 2.6, size: 0.3 }); stencil(w, 'WARD B · EAST', { x: 12.64, y: 2.5, z: -28, rot: PI / 2, width: 2.6, size: 0.3 });
    stencil(w, 'NURSES', { x: -6, y: 2.6, z: -16.84, rot: 0, width: 2.4 }); stencil(w, 'NO RUNNING', { x: 6, y: 2.6, z: -55.16, rot: PI, width: 2.4, size: 0.3 });
    stencil(w, 'LAUNDRY', { x: 16.84, y: 2.65, z: -39, rot: -PI / 2, width: 2.0, size: 0.3 }); stencil(w, 'DORMITORY', { x: -16.84, y: 2.65, z: -39, rot: PI / 2, width: 2.2, size: 0.3 });
    // ---- the nurses' station -------------------------------------------------------------------------------------------------
    L(-6, -22, 'buzz', { color: 0xffe6c0 }); L(6, -22, 'steady', { color: 0xffe6c0, power: 0.7 }); L(-5, -32, 'dying', { color: 0xffe6c0 }); L(5, -32, 'buzz', { color: 0xffe6c0 }); L(0, -28, 'steady', { color: 0xdfffe6, power: 0.6 });
    for (const x of [-7.2, -5.6, -4.0, -2.4, 2.4, 4.0, 5.6, 7.2]) desk(w, { x, z: -26, rot: 0, papers: x < 0 });
    desk(w, { x: -9, z: -34.6, rot: PI / 2 }); desk(w, { x: 10.6, z: -34.6, rot: PI / 2 });
    for (let i = 0; i < 4; i++) locker(w, { x: -11.9, z: -31 + i * 0.64, rot: PI / 2, ajar: i === 2 ? 0.8 : 0, color: 0x66736e });
    gurney(w, { x: 9.5, z: -21.8, rot: 1.2, solid: true });
    pipes(w, { x0: -12, z0: -19, x1: 12, z1: -19, y: 2.9, n: 2 });
    decal(w, { kind: 'splat', seed: 31, x: -5, y: 0.02, z: -24.2, w: 2.8, h: 2.8 }); decal(w, { kind: 'drag', seed: 32, x: 1, y: 0.02, z: -22, w: 2.4, h: 5, rot: 1.57 }); decal(w, { kind: 'hand', seed: 33, x: 12.34, y: 1.1, z: -30, w: 0.5, h: 0.5, face: 'w' });
    decal(w, { kind: 'scratch', seed: 34, x: -12.34, y: 1.5, z: -24, w: 1.5, h: 1.5, face: 'e' }); decal(w, { kind: 'puddle', seed: 35, x: -3, y: 0.025, z: -30, w: 2.6, h: 2.6 });
    stencil(w, 'NURSES\' STATION', { x: 0, y: 2.75, z: -36.84, rot: 0, width: 4.4, size: 0.3 });
    // ---- the pharmacy store -----------------------------------------------------------------------------------------------------
    L(-6, -42, 'dying', { color: 0xc8f0e0 }); L(6, -46, 'buzz', { color: 0xc8f0e0 }); L(-2, -51, 'dead');
    K.shelf(w, { x: -6, z: -40.4, len: 4 }); K.shelf(w, { x: 4, z: -43, len: 4.4 }); K.shelf(w, { x: -8, z: -45, len: 3.4 }); K.shelf(w, { x: 3, z: -48.5, len: 5 }); K.shelf(w, { x: -3, z: -53.6, len: 3 });
    desk(w, { x: -9.5, z: -52.6, rot: 0 }); box(w, { x: 10.6, y: 1.0, z: -52.2, w: 1.7, h: 2.0, d: 1.2, kind: 'rust', color: 0x727e7a, rough: 0.5 });
    decal(w, { kind: 'drag', seed: 41, x: 2, y: 0.02, z: -44, w: 3, h: 6, rot: 1.57 }); decal(w, { kind: 'splat', seed: 42, x: -9, y: 0.02, z: -49, w: 2.8, h: 2.8 }); decal(w, { kind: 'scratch', seed: 43, x: 12.34, y: 1.4, z: -46, w: 1.4, h: 1.4, face: 'w' });
    stencil(w, 'PHARMACY · SIGN FOR EVERY DOSE', { x: 0, y: 2.7, z: -54.84, rot: 0, width: 5.2, size: 0.3 });
    // ---- the laundry -------------------------------------------------------------------------------------------------------------
    L(21, -30, 'buzz', { color: 0xffd9a0 }); L(28, -30, 'dying', { color: 0xffd9a0 }); L(22, -42, 'dying', { color: 0xffd9a0 }); L(29, -42, 'dead');
    for (const x of [19.4, 21.7, 24.0]) K.washer(w, { x, z: -47.2, rot: 0 });
    const dryA = K.dryer(w, { x: 27.3, z: -47.1, rot: 0 }), dryB = K.dryer(w, { x: 30.3, z: -47.1, rot: 0 });
    dryA.set(false); dryB.set(false);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) curtain(w, { x: 21.2 + i * 2.1 + (r % 2) * 0.5, z: -32 - r * 3, width: 1.9, rot: 0, h: 2.6 });
    K.bin(w, { x: 20.8, z: -44.4, rot: 0.2 }); K.bin(w, { x: 22.4, z: -44.9, rot: -0.1 }); K.bin(w, { x: 31.6, z: -26.3, rot: 1.2 }); K.bin(w, { x: 27, z: -26.2, rot: -0.2, linen: false });
    for (let i = 0; i < 5; i++) locker(w, { x: 17.7, z: -44 + i * 0.64, rot: PI / 2, ajar: i === 2 ? 0.7 : 0, color: 0x6a7873 });
    pipes(w, { x0: 18, z0: -46, x1: 32, z1: -46, y: 2.95, n: 3 }); pipes(w, { x0: 32.3, z0: -26, x1: 32.3, z1: -46, y: 2.9, n: 2 });
    decal(w, { kind: 'puddle', seed: 51, x: 25, y: 0.025, z: -36, w: 3.4, h: 3.4 }); decal(w, { kind: 'splat', seed: 52, x: 29, y: 0.02, z: -44.4, w: 2.8, h: 2.8 }); decal(w, { kind: 'drag', seed: 53, x: 26, y: 0.02, z: -40, w: 3, h: 6, rot: 1.57 });
    decal(w, { kind: 'hand', seed: 54, x: 32.84, y: 1.2, z: -40, w: 0.5, h: 0.5, face: 'e' }); decal(w, { kind: 'scratch', seed: 55, x: 25, y: 1.5, z: -47.84, w: 1.5, h: 1.5, face: 'n' });
    stencil(w, 'LAUNDRY · WASH YOUR OWN', { x: 25, y: 2.8, z: -24.16, rot: PI, width: 5.4, size: 0.3 });
    barWindow(w, { x: 32.84, y: 1.9, z: -31, rot: -PI / 2 }); barWindow(w, { x: 32.84, y: 1.9, z: -43, rot: -PI / 2 });
    // ---- the dormitory -------------------------------------------------------------------------------------------------------------
    L(-29, -30, 'dying', { color: 0xb8d0ff, power: 0.8, rot: PI / 2 }); L(-22, -31, 'buzz', { color: 0xb8d0ff, power: 0.8, rot: PI / 2 }); L(-29, -41, 'buzz', { color: 0xb8d0ff, power: 0.8, rot: PI / 2 });
    L(-22, -42, 'dead'); L(-25, -26, 'dying', { color: 0xb8d0ff, power: 0.7 }); L(-25, -46, 'buzz', { color: 0xb8d0ff, power: 0.7 });
    const ROWS = [-27, -30.5, -34, -37.5, -41, -44.5];
    ROWS.forEach((z, i) => { bed(w, { x: -30.7, z, rot: PI / 2, strapped: i === 3 || i === 5 }); });
    ROWS.slice(1, 5).forEach((z, i) => bed(w, { x: -25, z, rot: -PI / 2, strapped: i === 0 }));
    ROWS.forEach((z, i) => { if (z === -34 || z === -37.5) return; bed(w, { x: -19.3, z, rot: -PI / 2, strapped: i === 1 }); });
    for (const z of [-28.75, -32.25, -35.75, -39.25, -42.75]) curtain(w, { x: -30.7, z, width: 2.1, rot: 0, open: z === -35.75 ? 0.6 : 0 });
    for (const z of [-32.25, -35.75, -39.25]) curtain(w, { x: -25, z, width: 2.1, rot: 0 });
    for (const z of [-28.75, -42.75]) curtain(w, { x: -19.3, z, width: 2.1, rot: 0, open: 0.4 });
    for (let i = 0; i < 5; i++) locker(w, { x: -27.5 + i * 0.64, z: -47.5, rot: 0, ajar: i === 1 ? 0.7 : 0 });
    wheelchair(w, { x: -32, z: -25.3, rot: 0.5 }); gurney(w, { x: -21.5, z: -25.6, rot: 0.1, solid: true });
    pipes(w, { x0: -32, z0: -25, x1: -18, z1: -25, y: 2.95, n: 2 });
    decal(w, { kind: 'splat', seed: 61, x: -28, y: 0.02, z: -36, w: 3, h: 3 }); decal(w, { kind: 'drag', seed: 62, x: -22, y: 0.02, z: -35, w: 3, h: 7, rot: 1.57 }); decal(w, { kind: 'puddle', seed: 63, x: -24, y: 0.025, z: -44, w: 3, h: 3 });
    decal(w, { kind: 'hand', seed: 64, x: -32.84, y: 1.2, z: -36, w: 0.5, h: 0.5, face: 'w' }); decal(w, { kind: 'scratch', seed: 65, x: -32.84, y: 1.5, z: -29, w: 1.5, h: 1.5, face: 'w' }); decal(w, { kind: 'scratch', seed: 66, x: -25, y: 1.4, z: -24.16, w: 1.5, h: 1.5, face: 'n' });
    barWindow(w, { x: -32.84, y: 1.9, z: -31, rot: PI / 2 }); barWindow(w, { x: -32.84, y: 1.9, z: -42, rot: PI / 2 });
    stencil(w, 'DORMITORY · LIGHTS OUT 22:00', { x: -25, y: 2.8, z: -24.16, rot: PI, width: 5.6, size: 0.3 });
    // ---- the duct ---------------------------------------------------------------------------------------------------------------------
    for (const z of [-52, -58, -64]) L(-30, z, ['dying', 'buzz', 'dying'][[-52, -58, -64].indexOf(z)], { color: 0xff6a4a, power: 0.7, rot: PI / 2, len: 0.7, shaft: false });
    for (const x of [-24, -17, -10]) L(x, -66, ['buzz', 'dying', 'dead'][[-24, -17, -10].indexOf(x)], { color: 0xff6a4a, power: 0.7, len: 0.7, shaft: false });
    decal(w, { kind: 'drag', seed: 71, x: -30, y: 0.02, z: -54, w: 1.4, h: 5, rot: 1.57 }); decal(w, { kind: 'hand', seed: 72, x: -30.7, y: 1.0, z: -60, w: 0.5, h: 0.5, face: 'w' }); decal(w, { kind: 'hand', seed: 73, x: -29.3, y: 0.8, z: -62, w: 0.5, h: 0.5, face: 'e' }); decal(w, { kind: 'scratch', seed: 74, x: -20, y: 1.2, z: -66.7, w: 1.4, h: 1.4, face: 'n' });
    // ---- the stairwell ------------------------------------------------------------------------------------------------------------------
    L(0, -63, 'dying', { color: 0xdfffe6 }); L(0, -67.5, 'buzz', { color: 0xdfffe6, power: 0.8 });
    decal(w, { kind: 'splat', seed: 81, x: 0, y: 0.02, z: -65, w: 3.2, h: 3.2 }); decal(w, { kind: 'scratch', seed: 82, x: -4.84, y: 1.4, z: -62, w: 1.5, h: 1.5, face: 'w' }); decal(w, { kind: 'hand', seed: 83, x: 4.84, y: 1.2, z: -63, w: 0.5, h: 0.5, face: 'e' });
    stencil(w, 'STAIRS · LIFT TO WARD C', { x: 0, y: 2.9, z: -68.84, rot: 0, width: 3.6, size: 0.3 });
    gurney(w, { x: 3.4, z: -65.6, rot: PI / 2, solid: true }); wheelchair(w, { x: -3.4, z: -63.6, rot: 0.8 });
    exitDoor(w, { x: 0, z: -71.7, rot: 0 });

    // =============================================================================================================================
    //  CHECKPOINTS
    // =============================================================================================================================
    checkpoint(w, { x: 0, z: -2 }); checkpoint(w, { x: -6.5, z: -22, side: -1 }); checkpoint(w, { x: 23.5, z: -27 }); checkpoint(w, { x: -27.9, z: -29 }); checkpoint(w, { x: -3, z: -62.5 });

    // =============================================================================================================================
    //  BEAT 1 — SIGN IN (two mats, two far walls)
    // =============================================================================================================================
    const matA = K.pad(w, { x: -4.4, z: 3.2, size: 1.5, color: 0xffd36a }), matB = K.pad(w, { x: 4.4, z: -1.0, size: 1.5, color: 0xffd36a });
    const signDraw = (side) => (g, W, Hh) => {
      g.fillStyle = '#04120d'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#7cffc0'; g.font = `700 ${Math.floor(Hh * 0.12)}px monospace`; g.textAlign = 'center';
      const on = side === 'A' ? matA.active : matB.active, both = matA.active && matB.active && ((matA.p1 && matB.p2) || (matA.p2 && matB.p1));
      g.fillText('WARD B · STAFF ROSTER', W / 2, Hh * 0.2); g.fillText(`DESK ${side}`, W / 2, Hh * 0.38);
      g.fillStyle = on ? '#7cffc0' : '#2b6b55'; g.fillText(both ? 'SIGNING...' : on ? 'HOLD. WAIT FOR DESK ' + (side === 'A' ? 'B' : 'A') : 'STAND ON THE PLATE', W / 2, Hh * 0.62);
      g.fillStyle = '#d6c27a'; g.fillText('TWO SIGNATURES REQUIRED', W / 2, Hh * 0.86);
    };
    K.terminal(w, { x: -5.45, z: 3.2, rot: PI / 2, draw: signDraw('A'), rate: 4 }); K.terminal(w, { x: 5.45, z: -1.0, rot: -PI / 2, draw: signDraw('B'), rate: 4 });
    let signT = 0;
    w.updaters.push((dt) => {
      const both = matA.active && matB.active && ((matA.p1 && matB.p2) || (matA.p2 && matB.p1));
      signT = both ? signT + dt : Math.max(0, signT - dt * 2);
      if (signT > 1.6 && !flag('signed')) { signT = -99; fireSigned(); }
    });
    const fireSigned = once('signed', () => { c.set('c2.signed', true); S.bell(0, 0.14); D.signin.unlock(); D.signin.setOpen(true); tell('all', 'lt.c2.signed', { priority: 2 }); });
    // the roster is per-player: your partner's name sits next to the bed number
    note(w, game, {
      x: 3.2, y: 0.98, z: -2.6, rot: 0, title: 'WARD B · NIGHT ROSTER', label: 'Read the roster',
      html: { p1: `<p><b>BED 7</b> — ${c.names.p2 || 'Patient'}</p><p><b>ATTENDING</b> — ${c.names.p1 || 'Patient'}</p><p>Rounds: 22:00, 00:00, 02:00 … 02:00 … 02:00.</p><p>Call bells summon the Orderly. Staff are required to respond.</p>`, p2: `<p><b>BED 7</b> — ${c.names.p1 || 'Patient'}</p><p><b>ATTENDING</b> — ${c.names.p2 || 'Patient'}</p><p>Rounds: 22:00, 00:00, 02:00 … 02:00 … 02:00.</p><p>Call bells summon the Orderly. Staff are required to respond.</p>` },
    });
    w.after(2.5, () => tell('all', 'lt.c2.arrive', { priority: 2 }));

    // =============================================================================================================================
    //  BEAT 2 — THE FIRST ROUND
    // =============================================================================================================================
    enter('ring', { x: 0, y: 1, z: -13.5, w: 3, h: 3, d: 2 }, () => {
      st.setActive(true); if (c.isHost) st.warp(14.75, -36);
      tell('all', 'lt.c2.ring', { priority: 2 });
      Z.stand('patient', 13.5, -57.4, { dur: 40 }); w.after(9, () => tell('all', 'lt.c2.hide'));
    });
    let hidTold = false;
    w.updaters.push(() => { if (!hidTold && st.hidden) { hidTold = true; tell(me, 'lt.c2.hidden', { priority: 1 }); } });

    // =============================================================================================================================
    //  BEAT 3 — THE HACK (one at the terminal, one on the bells)
    // =============================================================================================================================
    enter('station', { x: 0, y: 1, z: -19.5, w: 6, h: 3, d: 3 }, () => { tell('all', 'lt.c2.station', { priority: 2 }); w.after(7, () => tell('all', 'lt.c2.bells')); });
    const hackZone = c.zone({ x: 0, y: 1, z: -32.6, w: 2.6, h: 2, d: 1.8, need: 'any' });
    let hack = 0, hackSend = 0, traced = [false, false, false], hackDone = false;
    c.on('c2.hack', (v) => { hack = Math.max(hack, v || 0); });
    const hackDraw = (g, W, Hh) => {
      g.fillStyle = '#03100c'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#7cffc0'; g.font = `700 ${Math.floor(Hh * 0.095)}px monospace`; g.textAlign = 'left';
      g.fillText('NIGHT DESK // ADMIN', 12, Hh * 0.14); g.fillStyle = hackDone ? '#7cffc0' : '#d6c27a'; g.fillText(hackDone ? 'ACCESS GRANTED' : hackZone.active ? 'INTRUDING...' : 'STAND AT THE DESK', 12, Hh * 0.3);
      g.strokeStyle = '#2f8f6a'; g.strokeRect(12, Hh * 0.4, W - 24, Hh * 0.16); g.fillStyle = '#7cffc0'; g.fillRect(14, Hh * 0.4 + 2, (W - 28) * Math.min(1, hack / 100), Hh * 0.16 - 4);
      g.fillStyle = '#7cffc0'; g.fillText(Math.floor(hack) + '%', 12, Hh * 0.74);
      g.fillStyle = hack > 20 && !hackDone ? '#e0242e' : '#2f6b55'; g.fillText(hackDone ? 'TRACE CLOSED' : 'TRACE: ' + (traced[2] ? 'IMMINENT' : traced[1] ? 'HIGH' : traced[0] ? 'RISING' : 'NONE'), 12, Hh * 0.9);
    };
    K.terminal(w, { x: 0, z: -34.6, rot: 0, draw: hackDraw, rate: 6, width: 1.0 });
    const mapDraw = (g, W, Hh, t) => {
      g.fillStyle = '#02130f'; g.fillRect(0, 0, W, Hh);
      const X = (x) => ((x + 36) / 72) * W, Zc = (z) => ((12 - z) / 82) * Hh;
      g.strokeStyle = '#2f8f6a'; g.lineWidth = 1.6;
      for (const [x0, z0, x1, z1] of [[-6, 10, 6, -6], [-17, -13, 17, -59], [-12.5, -17, 12.5, -55], [-33, -24, -17, -48], [17, -24, 33, -48], [-5, -59, 5, -72]]) g.strokeRect(X(x0), Zc(z0), X(x1) - X(x0), Zc(z1) - Zc(z0));
      g.strokeStyle = '#1b5e49'; g.beginPath(); g.moveTo(X(-30), Zc(-48)); g.lineTo(X(-30), Zc(-66)); g.lineTo(X(-5), Zc(-66)); g.stroke();
      g.fillStyle = '#d6c27a'; for (const b of BELLS) { g.fillRect(X(b.x) - 3, Zc(b.z) - 3, 6, 6); }
      const dots = [[pp(), me === 'p1' ? '#ffffff' : '#7ee8ff', '1'], [partnerPos(), me === 'p1' ? '#7ee8ff' : '#ffffff', '2']];
      for (const [p, col] of dots) if (p) { g.fillStyle = col; g.beginPath(); g.arc(X(p.x), Zc(p.z), 3.2, 0, 7); g.fill(); }
      if (st.on) { const k = 4 + Math.sin(t * 6) * 1.4; g.fillStyle = st.state === 'chase' ? '#ff2a2a' : '#c4242c'; g.beginPath(); g.arc(X(st.x), Zc(st.z), k, 0, 7); g.fill(); g.strokeStyle = '#ff5a5a'; g.beginPath(); g.arc(X(st.x), Zc(st.z), k + 5, 0, 7); g.stroke(); }
      g.fillStyle = '#7cffc0'; g.font = '700 11px monospace'; g.textAlign = 'left'; g.fillText('CAM 4 · WARD B', 6, 14); g.fillStyle = '#c4242c'; g.fillText(st.on ? (st.state === 'chase' ? 'ORDERLY: RUNNING' : st.state === 'investigate' ? 'ORDERLY: RESPONDING' : 'ORDERLY: ROUNDS') : 'NO SIGNAL', 6, Hh - 6);
    };
    K.screen(w, { x: -4.6, y: 1.95, z: -36.7, rot: 0, width: 1.5, height: 1.64, px: 256, draw: mapDraw, rate: 8, tint: 1.3 });
    K.screen(w, { x: 4.6, y: 1.95, z: -36.7, rot: 0, width: 1.5, height: 1.64, px: 256, draw: mapDraw, rate: 8, tint: 1.3 });
    w.updaters.push((dt) => {
      if (!c.isHost || hackDone || !hackZone.active || !flag('signed')) return;
      hack = Math.min(100, hack + dt * (100 / 42)); hackSend -= dt;
      if (hackSend <= 0) { hackSend = 0.25; c.set('c2.hack', hack); }
      [22, 50, 78].forEach((lv, i) => { if (hack >= lv && !traced[i]) c.emit('c2:trace', { i }); });
      if (hack >= 100 && !hackDone) c.emit('c2:hackdone');
    });
    c.onEvent('c2:trace', (a) => {
      if (traced[a.i]) return; traced[a.i] = true;
      tell('all', ['lt.c2.trace1', 'lt.c2.trace2', 'lt.c2.trace3'][a.i], { priority: 2 });
      if (c.isHost) st.noise(0, -21, 18);                     // the terminal pings the Orderly
      if (a.i === 1) Z.blackout(2.2);
      if (a.i === 2) { Z.whisper({}); S.static(0.5, 0.12); }
    });
    c.onEvent('c2:hackdone', () => {
      if (hackDone) return; hackDone = true; hack = 100; D.laundry.unlock(); D.vault.unlock();
      tell('all', 'lt.c2.hackdone', { priority: 2 }); S.bell(0, 0.12); w.after(6, () => tell('all', 'lt.c2.where'));
    });
    // call bells: lure him (cooldown, shared)
    const BELLS = [{ x: -12.65, z: -28, rot: -PI / 2, n: 'west' }, { x: 12.65, z: -44, rot: PI / 2, n: 'east' }, { x: 6, z: -55.15, rot: PI, n: 'north' }, { x: -7, z: -16.85, rot: 0, n: 'south' }];
    const bellCd = [0, 0, 0, 0];
    BELLS.forEach((b, i) => {
      const it = K.bellPanel(w, { x: b.x, z: b.z, rot: b.rot, label: () => (w.t < bellCd[i] ? 'The bell is still ringing' : 'Ring the call bell (' + b.n + ')'), onUse: () => { if (w.t < bellCd[i]) return; c.emit('c2:bell', { i }); st.noise(b.x + Math.sin(b.rot) * 1.4, b.z + Math.cos(b.rot) * 1.4, 18); } });
      b.it = it;
    });
    c.onEvent('c2:bell', (a) => { const b = BELLS[a.i]; if (!b) return; bellCd[a.i] = w.t + 16; S.bell(panTo(b.x, b.z), 0.2); });
    w.updaters.push(() => { BELLS.forEach((b, i) => { b.it.lamp.material.color.setHex(0xff3a2a).multiplyScalar(w.t < bellCd[i] ? 2.8 + Math.sin(w.t * 18) * 1.4 : 0.7); }); });

    // =============================================================================================================================
    //  BEAT 4 — THE PHARMACY (a note, half a code) and THE LAUNDRY (dryer interlock)
    // =============================================================================================================================
    const rr = c.rng(77), CODE = [0, 0, 0, 0].map(() => Math.floor(rr() * 10));
    note(w, game, {
      x: -9.5, y: 0.92, z: -52.6, rot: 0, title: 'PHARMACY · NIGHT LOG', label: 'Read the night log',
      html: { all: `<p>The dormitory lock was changed again. <b>Staff only.</b></p><p>First half of the number: <b style="font-size:26px;letter-spacing:6px">${CODE[0]} ${CODE[1]} _ _</b></p><p>The second half is printed on the dryer ticket. Do not lose the ticket. Do not wash the ticket.</p><p style="color:#a8171f">Do not answer when the bed calls you by the other name.</p>` },
      onRead: () => Z.behind('patient', { dist: 3.4 }),
    });
    enter('vault', { x: 0, y: 1, z: -44, w: 22, h: 3, d: 14 }, () => tell('all', 'lt.c2.vault', { priority: 1 }));
    const mat1 = K.pad(w, { x: 20.5, z: -26.4, size: 1.5, color: 0xffd36a });
    let dry = { s: 0, t0: 0 };
    const startDry = once('dry', () => {
      dry = { s: 1, t0: w.t }; dryA.set(true); dryB.set(true); D.laundry.unlock(); D.laundry.setOpen(true); S.groan(0.18); S.static(0.4, 0.1);
      tell('all', 'lt.c2.dry', { priority: 2 }); w.after(10, () => tell('all', 'lt.c2.dryhide'));
      if (c.isHost) { st.setRoute(['ld0', 'ld1', 'ld3', 'ld2', 'ld1']); st.noise(24, -36, 24); st.speed = 2.1; }
    });
    const dryPanel = K.bellPanel(w, { x: 32.84, y: 1.4, z: -34, rot: -PI / 2, label: () => (dry.s ? 'The cycle is running' : mat1.active ? 'Start the drying cycle' : 'Start the cycle (the interlock plate must be held)'), enabled: () => dry.s === 0, onUse: () => { if (!mat1.active) { tell(me, 'lt.c2.interlock', { priority: 2 }); S.door(0, 0.08); return; } startDry(); } });
    dryPanel.lamp.material.color.setHex(0x3dff7a).multiplyScalar(1.6);
    w.updaters.push(() => {
      if (!c.isHost || dry.s !== 1) return;
      if (w.t - dry.t0 > 34) c.emit('c2:drydone');
    });
    const sheetT = [0];
    w.updaters.push((dt) => { if (dry.s === 1) { sheetT[0] -= dt; if (sheetT[0] <= 0) { sheetT[0] = 2.2; S.step(panTo(27, -47), 0.05, true); S.groan(0.05); } } });
    c.onEvent('c2:drydone', () => {
      if (dry.s !== 1) return; dry.s = 2; dryA.set(false); dryB.set(false); S.bell(panTo(30, -47), 0.18);
      tell('all', 'lt.c2.drydone', { priority: 2 });
      if (c.isHost) { st.setRoute(['ld0'].concat(RING)); st.speed = 2.0; }
    });
    let ticket = false;
    w.interactable({
      x: 30.3, y: 1.2, z: -45.75, w: 1.3, h: 1.4, d: 0.7, range: 3, pad: 0.05,
      label: () => (dry.s === 2 ? (ticket ? 'Read the ticket again' : 'Open the drum') : dry.s === 1 ? 'The drum is spinning' : 'Dryer B (empty)'), enabled: () => dry.s !== 0,
      onUse: async (g) => {
        if (dry.s !== 2) { g.say?.('It is turning. Not yet.', { priority: 1 }); return; }
        const { readModal } = await import('../hotel/escape-kit.js');
        readModal(g, { title: 'DRYER TICKET · 02:00', html: `<p>Second half of the number: <b style="font-size:26px;letter-spacing:6px">_ _ ${CODE[2]} ${CODE[3]}</b></p><p>Cycle complete. Remove all items. All items are accounted for.</p><p style="color:#a8171f">The drum was not empty.</p>` });
        if (!ticket) { ticket = true; w.after(1.5, () => Z.rush('orderly', { dist: 11 })); }
      },
    });
    enter('laundry', { x: 25, y: 1, z: -36, w: 14, h: 3, d: 20 }, () => tell('all', 'lt.c2.laundry', { priority: 1 }));
    // ---- the dial lock on the dormitory door ------------------------------------------------------------------------------------
    const dial = [0, 0, 0, 0];
    const dialDraw = (g, W, Hh) => { g.fillStyle = '#03100c'; g.fillRect(0, 0, W, Hh); g.fillStyle = D.dorm.locked ? '#d6c27a' : '#7cffc0'; g.font = `700 ${Math.floor(Hh * 0.62)}px monospace`; g.textAlign = 'center'; g.fillText(dial.join(' '), W / 2, Hh * 0.74); };
    K.screen(w, { x: -16.83, y: 2.0, z: -33.1, rot: PI / 2, width: 0.9, height: 0.4, px: 256, draw: dialDraw, rate: 5, glow: 0xd6c27a });
    box(w, { x: -16.8, y: 1.28, z: -33.1, w: 0.12, h: 0.42, d: 0.92, kind: 'rust', color: 0x333a3c });
    for (let i = 0; i < 4; i++) {
      c.on('c2.dial' + i, (v) => { dial[i] = v | 0; if (dial.every((d, k) => d === CODE[k]) && D.dorm.locked && c.isHost) c.emit('c2:code'); });
      box(w, { x: -16.7, y: 1.28, z: -33.4 + i * 0.22, w: 0.1, h: 0.3, d: 0.16, kind: 'rust', color: 0x6a7873 });
      w.interactable({ x: -16.45, y: 1.28, z: -33.4 + i * 0.22, w: 0.4, h: 1.5, d: 0.2, range: 3, pad: 0.03, label: () => 'Turn dial ' + (i + 1) + ' (' + dial[i] + ')', enabled: () => D.dorm.locked, onUse: () => { c.set('c2.dial' + i, (dial[i] + 1) % 10); S.door(0, 0.05); S.squeak(0, 0.05); } });
    }
    c.onEvent('c2:code', () => { if (!D.dorm.locked) return; D.dorm.unlock(); D.dorm.setOpen(true); S.bell(panTo(-17, -36), 0.16); tell('all', 'lt.c2.code', { priority: 2 }); });

    // =============================================================================================================================
    //  BEAT 5/6 — THE DORMITORY and the two-minute hide and seek
    // =============================================================================================================================
    const dormZone = c.zone({ x: -25, y: 1, z: -36, w: 14, h: 3, d: 20, need: 'both', shrink: 0.2 });
    enter('dorm', { x: -25, y: 1, z: -36, w: 14, h: 3, d: 20 }, () => { tell('all', 'lt.c2.dorm', { priority: 1 }); });
    let hs = null;                                          // { t0, done }
    let dark = false;
    const HIDE_TIME = 120;
    w.interactable({
      x: -30.2, y: 1.0, z: -37.5, w: 1.6, h: 0.9, d: 1.4, range: 3, pad: 0.05,
      label: () => (hs ? 'Bed 7' : dormZone.active ? 'Read the file on bed 7' : 'Bed 7 (your partner should be with you)'),
      enabled: () => !hs,
      onUse: async (g) => {
        if (!dormZone.active) { tell(me, 'lt.c2.bedwait', { priority: 2 }); return; }
        const { readModal } = await import('../hotel/escape-kit.js');
        readModal(g, { title: 'BED 7 · CLINICAL FILE', html: `<p><b>Patient:</b> ${c.names[other] || 'unknown'}</p><p><b>Attending:</b> ${c.names[me] || 'unknown'}</p><p>Compliant at night. Restless at two. Does not remember the wristband.</p><p style="color:#a8171f">If the patient asks who is writing this, say nobody is.</p>` });
        c.emit('c2:lightsout');
      },
    });
    c.onEvent('c2:lightsout', () => {
      if (hs) return; hs = { t0: w.t, done: false, next: 0 }; dark = true;
      H.force(0); Z.knock({ n: 3 }); S.slam(0.45); D.dorm.setOpen(false); w.after(0.3, () => D.dorm.lock());
      tell('all', 'lt.c2.lights', { priority: 2 }); w.after(7, () => tell('all', 'lt.c2.torch', { priority: 2 }));
      w.after(18, () => R.whisper({ keyholder: 'lt.c2.whisper.k', subject: 'lt.c2.whisper.s' }));
      st.home = 'E2';
      w.after(6, () => { D.dorm.unlock(); D.dorm.setOpen(true); S.door(panTo(-17, -36), 0.35); if (c.isHost) { st.setActive(true); st.warp(-14.75, -36); st.setRoute(['dd', 'B3', 'B2', 'A2', 'A3', 'A4', 'E2', 'B5', 'B4', 'B3', 'B2', 'B1', 'E1', 'A1', 'A2', 'A3']); st.speed = 2.15; st.chaseSpeed = 5.9; } });
    });
    // host inspections: he comes to check where somebody is hiding (so standing still is not the end of the story)
    w.updaters.push(() => {
      if (!hs || hs.done || !c.isHost) return;
      const el = w.t - hs.t0, marks = [28, 58, 88];
      if (hs.next < marks.length && el > marks[hs.next]) {
        hs.next++;
        const cand = [{ role: me, p: pp() }, { role: other, p: partnerPos() }].filter((q) => q.p && c.get('hid:' + q.role, false));
        const q = cand.length ? cand[hs.next % cand.length] : null;
        if (q) st.noise(q.p.x, q.p.z, 24); else st.noise(-25, -36, 24);
        c.emit('c2:checking');
      }
      if (el > HIDE_TIME) c.emit('c2:dawn');
    });
    c.onEvent('c2:checking', () => { S.step(0, 0.1, true); S.breath(0, 0.08); });
    c.onEvent('c2:dawn', () => {
      if (!hs || hs.done) return; hs.done = true; dark = false; H.force(null); H.torchOn = true; S.bell(0, 0.22); S.wail(0.12);
      tell('all', 'lt.c2.dawn', { priority: 2 }); st.home = 'a3';
      D.vent.unlock(); D.vent.setOpen(true); w.after(5, () => tell('all', 'lt.c2.vent'));
      if (c.isHost) { st.setRoute(['dd'].concat(RING)); st.speed = 2.0; }
    });

    // =============================================================================================================================
    //  BEAT 7 — THE DUCT
    // =============================================================================================================================
    const plate1 = K.pad(w, { x: -30, z: -52.6, size: 1.2, color: 0xffa63a });
    let ductWant = false, ductPerm = false;
    w.updaters.push(() => {
      if (!c.isHost) return;
      const want = ductPerm || plate1.active;
      if (want !== ductWant) { ductWant = want; if (want) { D.duct.unlock(); D.duct.setOpen(true); } else D.duct.lock(); }
    });
    // beyond the grille: a wheel that winds it open for good (so the one who stood on the plate can follow)
    K.bellPanel(w, { x: -30.8, y: 1.3, z: -58.5, rot: PI / 2, label: () => (ductPerm ? 'The grille is wound open' : 'Wind the grille open'), enabled: () => !ductPerm, onUse: () => c.emit('c2:ductopen') });
    c.onEvent('c2:ductopen', () => { if (ductPerm) return; ductPerm = true; S.door(0, 0.3); S.scrape(0, 0.1); tell(me, 'lt.c2.ductopen', { priority: 1 }); });
    enter('duct', { x: -30, y: 1, z: -50, w: 2, h: 3, d: 3 }, () => { tell('all', 'lt.c2.duct', { priority: 1 }); w.after(5, () => tell('all', 'lt.c2.ductgate')); });
    enter('duct2', { x: -30, y: 1, z: -63, w: 2, h: 3, d: 2 }, () => { Z.blackout(2.4); w.after(0.4, () => Z.knock({ n: 4 })); });
    enter('duct3', { x: -22, y: 1, z: -66, w: 2, h: 3, d: 2 }, () => { Z.partnerWrong(4.5); tell('all', 'lt.c2.ductwrong', { priority: 1 }); });
    enter('duct4', { x: -12, y: 1, z: -66, w: 2, h: 3, d: 2 }, () => { Z.behind('patient', { dist: 3 }); S.step(0.6, 0.12, true); });

    // =============================================================================================================================
    //  BEAT 8 — STAIRWELL, FUSES, THE RUN
    // =============================================================================================================================
    enter('stairs', { x: 0, y: 1, z: -64, w: 8, h: 3, d: 6 }, () => { tell('all', 'lt.c2.stair', { priority: 2 }); w.after(8, () => tell('all', 'lt.c2.fuses')); });
    K.bellPanel(w, { x: 3, y: 1.4, z: -59.15, rot: PI, label: 'Emergency release (stairwell door)', enabled: () => D.stair.locked, onUse: () => { c.emit('c2:release'); } });
    c.onEvent('c2:release', () => { if (!D.stair.locked) return; D.stair.unlock(); D.stair.setOpen(true); S.bell(0, 0.14); });
    const fuses = [false, false];
    const FUSE = [{ x: -16.84, z: -17.5, rot: PI / 2, name: 'west' }, { x: 16.84, z: -17.5, rot: -PI / 2, name: 'east' }];
    const alarm = { on: false, t: 0 };
    const fb = FUSE.map((f, i) => K.fuseBox(w, { x: f.x, z: f.z, rot: f.rot, label: () => (fuses[i] ? 'The fuse is out' : 'Pull the fuse (' + f.name + ')'), enabled: () => !fuses[i], onUse: () => { c.emit('c2:fuse', { i, who: me }); } }));
    c.onEvent('c2:fuse', (a) => {
      if (fuses[a.i]) return; fuses[a.i] = true; fb[a.i].set(true); S.door(panTo(FUSE[a.i].x, FUSE[a.i].z), 0.4);
      const first = !fuses[1 - a.i];
      if (first) {
        alarm.on = true; H.allLamps('dying'); tell('all', 'lt.c2.fuse1', { priority: 2 }); S.alarm(0.12);
        Z.rush('orderly', { role: a.who, dist: 10 });
        if (c.isHost) { st.setActive(true); st.hunt = true; st.chaseSpeed = 5.7; st.home = 'a2'; st.warp(0, -57); }
      } else { tell('all', 'lt.c2.fuse2', { priority: 2 }); D.exit.unlock(); D.exit.setOpen(true); S.bell(0, 0.18); w.after(1.2, () => tell('all', 'lt.c2.power')); }
    });
    w.updaters.push((dt) => { if (!alarm.on) return; alarm.t -= dt; if (alarm.t <= 0) { alarm.t = 2.6; S.alarm(0.07); } });

    // =============================================================================================================================
    //  PER-FRAME: HUD, torch key, torch sharing
    // =============================================================================================================================
    H.ownF = true;
    const onKey = (e) => { if (e.code === 'KeyF' && !e.repeat && game.state === 'playing' && !game.modal) { H.torchOn = !H.torchOn; c.set('tv:' + me, H.torchOn); c.set('torch:' + me, dark && H.torchOn); } };
    document.addEventListener('keydown', onKey);
    w.disposers.push(() => document.removeEventListener('keydown', onKey));
    c.set('tv:' + me, true); c.set('torch:' + me, false);
    c.on('tv:' + other, (v) => { H.theirOn = v !== false; });
    w.updaters.push(() => {
      c.get('torch:' + me, false) !== (dark && H.torchOn) && c.set('torch:' + me, dark && H.torchOn);
      const d = st.myDist ?? 99, near = st.on ? Math.max(0, 1 - d / 22) : 0;
      const remain = hs && !hs.done ? HIDE_TIME - (w.t - hs.t0) : null;
      UI.show(st.on && (d < 26 || remain !== null || alarm.on));
      UI.set({ prox: st.state === 'chase' ? 1 : near, hidden: !!st.hidden, torch: H.torchOn, timer: remain, warn: st.state === 'chase' });
    });

    // =============================================================================================================================
    //  BOTS (the harness cannot press E: steps call the same handlers the interactables do)
    // =============================================================================================================================
    if (window.__noRender) {
      const pzf = () => (partnerPos() || { z: 0 }).z;
      const ringBell = (i) => { const b = BELLS[i]; if (w.t >= bellCd[i]) { c.emit('c2:bell', { i }); st.noise(b.x + Math.sin(b.rot) * 1.4, b.z + Math.cos(b.rot) * 1.4, 18); } };
      if (me === 'p2') { let nb = 0, k = 0; w.updaters.push(() => { if (!hackDone && hackZone.active && w.t > nb) { nb = w.t + 17; ringBell([3, 0, 1, 2][k++ % 4]); } }); }
      const toDorm = [{ x: 14.75, z: -30 }, { x: 14.75, z: -15, r: 1.2 }, { x: -14.75, z: -15, r: 1.2 }, { x: -14.75, z: -30 }];
      const toDuct = [{ x: -27.9, z: -45.8 }, { x: -30, z: -46.6, r: 0.5 }, { x: -30, z: -49.5, r: 0.5 }];
      const afterDuct = [{ x: -30, z: -65, r: 0.8 }, { x: -24, z: -66 }, { x: -10, z: -66 }, { x: -4, z: -66, r: 0.8 }];
      const P1 = [
        { x: -4.4, z: 3.2, r: 0.5, until: () => !D.signin.locked },
        { x: 0, z: -4 }, { x: 0, z: -11 }, { x: 0, z: -15.5 }, { x: 0, z: -22 }, { x: 0, z: -32.4, r: 0.5, until: () => hackDone },
        // pharmacy
        { x: 6, z: -34 }, { x: 8, z: -36.5 }, { x: 8, z: -41 }, { x: 8, z: -50 }, { x: -2, z: -51 }, { x: -7.5, z: -51.2, r: 0.8 },
        { x: -2, z: -51 }, { x: 8, z: -50 }, { x: 8, z: -41 }, { x: 8, z: -36.5 }, { x: 4, z: -33 }, { x: 0, z: -29 }, { x: 0, z: -19 }, { x: 0, z: -15.5 },
        // laundry: hold the interlock plate, then hide among the sheets, then take the ticket
        { x: 14.75, z: -15, r: 1.2 }, { x: 14.75, z: -30 }, { x: 15, z: -36, r: 0.7 }, { x: 19.5, z: -36 },
        { x: 20.5, z: -26.6, r: 0.4, until: () => dry.s >= 1 },
        { x: 18.7, z: -42.5, r: 0.4, until: () => dry.s >= 2 },
        { x: 24, z: -38 }, { x: 30.3, z: -44.8, r: 0.9, then: () => { ticket = true; } },
        { x: 24, z: -38 }, { x: 19.5, z: -36 }, { x: 15, z: -36, r: 0.8 },
        // the dial lock (p1 turns the dials)
        ...toDorm, { x: -14.5, z: -33.2, r: 0.6, then: () => CODE.forEach((v, i) => c.set('c2.dial' + i, v)) },
        { x: -14.75, z: -35.5, r: 0.7, until: () => !D.dorm.locked },
        // dormitory
        { x: -19.2, z: -36 }, { x: -21.9, z: -36 }, { x: -27.9, z: -36.6 }, { x: -28.2, z: -37.5, r: 0.5, until: () => dormZone.active, then: () => c.emit('c2:lightsout') },
        { x: -27.9, z: -41 }, { x: -27.9, z: -42.75 }, { x: -30.7, z: -42.75, r: 0.35, until: () => !!(hs && hs.done) },
        { x: -27.9, z: -42.75 }, ...toDuct,
        // duct: p1 goes first, p2 stands on the plate, p1 winds the grille open
        { x: -30, z: -55, r: 0.5, until: () => D.duct.open && D.duct.k > 0.95 }, { x: -30, z: -58.5, r: 0.6, then: () => c.emit('c2:ductopen') },
        ...afterDuct, { x: -1.5, z: -63.5, r: 0.8 }, { x: -1.5, z: -62.5, r: 0.6, until: () => !D.stair.locked },
        // fuses: p1 takes the west one
        { x: 0, z: -61 }, { x: 0, z: -57 }, { x: -14.75, z: -57, r: 1.2 }, { x: -14.75, z: -30 }, { x: -14.6, z: -17.8, r: 0.6, then: () => c.emit('c2:fuse', { i: 0, who: me }) },
        { x: -14.6, z: -17.8, r: 0.6, until: () => fuses[0] && fuses[1] },
        { x: -14.75, z: -30 }, { x: -14.75, z: -56, r: 1.0 }, { x: -2, z: -57.2 }, { x: 0, z: -61 }, { x: 0, z: -66 }, { x: -0.7, z: -70.3, r: 0.4, until: () => false },
      ];
      const P2 = [
        { x: 4.4, z: -1.0, r: 0.5, until: () => !D.signin.locked },
        { x: 0, z: -4 }, { x: 0, z: -11 }, { x: 0, z: -15.5 }, { x: 0, z: -22 }, { x: 0, z: -29 }, { x: -3, z: -32.4, r: 0.8, until: () => hackDone },
        { x: 0, z: -29 }, { x: 0, z: -19 }, { x: 0, z: -15.5 },
        { x: 14.75, z: -15, r: 1.2 }, { x: 14.75, z: -30 }, { x: 15, z: -36, r: 0.7 }, { x: 19.5, z: -36 },
        { x: 31.4, z: -34, r: 0.8, until: () => mat1.active, then: () => startDry() },
        { x: 25, z: -34.6, r: 0.4, until: () => dry.s >= 2 },
        { x: 19.5, z: -36 }, { x: 15, z: -36, r: 0.8 },
        ...toDorm, { x: -14.75, z: -35.5, r: 0.7, until: () => !D.dorm.locked },
        { x: -19.2, z: -36 }, { x: -21.9, z: -36 }, { x: -21.9, z: -42.75 }, { x: -19.3, z: -42.75, r: 0.35, until: () => !!(hs && hs.done) },
        { x: -21.9, z: -42.75 }, { x: -21.9, z: -45.8 }, ...toDuct,
        { x: -30, z: -46.6, r: 0.5, until: () => pzf() < -53.5 },
        { x: -30, z: -52.6, r: 0.4, until: () => ductPerm },
        { x: -30, z: -58.5, r: 0.8 }, ...afterDuct, { x: -1.5, z: -63.5, r: 0.8 },
        { x: 3, z: -60.4, r: 0.6, then: () => c.emit('c2:release') }, { x: 3, z: -60.4, r: 0.6, until: () => !D.stair.locked },
        // fuses: p2 takes the east one
        { x: 0, z: -61 }, { x: 0, z: -57 }, { x: 14.75, z: -57, r: 1.2 }, { x: 14.75, z: -30 }, { x: 14.6, z: -17.8, r: 0.6, then: () => c.emit('c2:fuse', { i: 1, who: me }) },
        { x: 14.6, z: -17.8, r: 0.6, until: () => fuses[0] && fuses[1] },
        { x: 14.75, z: -30 }, { x: 14.75, z: -56, r: 1.0 }, { x: 2, z: -57.2 }, { x: 0, z: -61 }, { x: 0, z: -66 }, { x: 0.7, z: -70.3, r: 0.4, until: () => false },
      ];
      botSteps(w, { p1: P1, p2: P2 });
    }
  },
};
