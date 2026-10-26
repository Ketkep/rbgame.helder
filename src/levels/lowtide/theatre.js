import * as THREE from 'three';
import { stalker } from './stalker.js';
import { scares } from './scare.js';
import { roles } from './roles.js';
import { botSteps } from '../coop/kit.js';
import { horrorEnv, exitDoor, checkpoint, door, room, hp, box, decal, bed, locker, curtain, gurney, wheelchair, pipes, desk, barWindow, stencil, note } from './kit.js';
import { makeHud, holdable, reader, trolley, grille } from './intake-kit.js';
import * as K from './night-rounds-kit.js';
import { stairs } from './hydro-kit.js';
import * as T from './theatre-kit.js';
import { figure } from './figure.js';

// Chapter 5 — THE THEATRE. Beats:
//   1 Scrub room (two basins, one each)  2 Pre-op: the anaesthetist is on rounds; a roller-shutter cage holds the key card (one holds the winch, one fetches),
//   two readers open the theatre  3 Phase A: one of you is strapped upright to the tilt-table, the other runs the machine from the gallery; the patient sees
//   a colour sequence only they can see, the operator presses it; the gallery fills with watchers whenever you look away  4 The swap: the anaesthetist
//   wakes; klaxons lure him; stations are exchanged  5 Phase B: the Orderly stands at the table and sedates the patient; lure him away, hold the machine
//   stages (the last needs the patient's grip too)  6 The surgeons' lounge: two lockers, two halves of a photograph, a tape you may play (heard-tape)
//   7 The recovery ward: the Orderly hunts; both call buttons held together raise the lift.
const PI = Math.PI;
const COLS = ['RED', 'GREEN', 'BLUE', 'AMBER'];
const COLHEX = ['#ff3a3a', '#3dff7a', '#4a9bff', '#ffb02a'];
const POST = { x: 1.35, z: -32.2 };
const DAIS = { x: 0, z: -32 };
const GAL = 3.2;
const SECS = [8, 10, 12];
const WATCH = [3, 7, 11, 15];

export default {
  id: 'lowtide5',
  name: 'The Theatre',
  music: 'l1',
  horror: true,
  deathRule: 'self',
  completeQuip: 'Procedure complete. Please remain seated. Please do not look at the gallery.',
  titleCam: { center: [0, 2, -40], radius: 46, height: 36 },

  build(w, game) {
    const H = horrorEnv(w, game, { density: 0.05 });
    const S = H.S, c = w.coop, me = c.me, other = c.other;
    w.spawn = { x: me === 'p1' ? -2.2 : 2.2, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    const tell = (r, k, o) => c.tell(r, k, o);
    const Z = scares(w, game, H, S), R = roles(w, game);
    const UI = K.hud(w), HOLD = makeHud(w, game);
    const nm = (r) => c.names[r] || (r === 'p1' ? 'Patient' : 'Patient');
    const pp = () => game.player;
    const nearP = (x, z, r) => Math.hypot(pp().x - x, pp().z - z) < r;
    const once = (name, fn) => { let done = false; c.onEvent('c5:' + name, (a) => { if (done) return; done = true; fn(a || {}); }); return (a) => c.emit('c5:' + name, a || {}); };
    const enter = (name, b, fn, need = 'any') => { const fire = once(name, fn); const zn = c.zone({ ...b, need, shrink: 0 }); zn.onChange((z) => { if (z.active) fire(); }); return zn; };
    const panTo = (x, z) => { const cam = game.camera.position, rel = Math.atan2(x - cam.x, z - cam.z) - game.yaw; return Math.max(-1, Math.min(1, Math.sin(rel + PI) * 0.9)); };

    // who is the patient first (shared, seeded)
    const TB1 = c.rng(5)() < 0.5 ? 'p1' : 'p2', OP1 = TB1 === 'p1' ? 'p2' : 'p1';
    let TB = TB1, OP = OP1, phase = 'scrub';
    const SEQ = (() => { const r = c.rng(55); return [3, 4, 5, 6].map((n) => Array.from({ length: n }, () => Math.floor(r() * 4))); })();

    // =============================================================================================================================
    //  THE BUILDING
    // =============================================================================================================================
    room(w, { x: 0, z: 2, w: 12, d: 16, sides: { n: false }, floorKind: 'tile', wallKind: 'tile' });                      // scrub room
    room(w, { x: 0, z: -14, w: 26, d: 16, sides: { n: false }, doors: { s: [{ c: 0, w: 1.8 }], w: [{ c: 0, w: 1.6 }], e: [{ c: 0, w: 1.6 }] } });   // pre-op
    room(w, { x: -19.5, z: -14, w: 13, d: 16, sides: { e: false }, doors: {}, floorKind: 'tile' });                         // changing room
    room(w, { x: 19.5, z: -14, w: 13, d: 16, sides: { w: false }, floorKind: 'concrete', wallKind: 'tile' });               // store
    // the theatre (tall) with two windows onto pre-op, a door to pre-op and a door to the lounge
    room(w, { x: 0, z: -34, w: 26, d: 24, h: 6.4, doors: { s: [{ c: 0, w: 2.6 }, { c: -8, w: 3 }, { c: 8, w: 3 }], w: [{ c: 0, w: 1.6 }] }, floorKind: 'tile', wallKind: 'tile' });
    for (const wx of [-8, 8]) {                                                                                                // window sill + glass + solid pane
      box(w, { x: wx, y: 0.5, z: -22, w: 3, h: 1.0, d: 0.3, kind: 'tile', color: 0x8a9490 });
      w.collider({ x: wx, y: 1.6, z: -22, w: 3, h: 3.2, d: 0.3 });
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), new THREE.MeshStandardMaterial({ color: 0x4a6a74, roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.16 })); glass.position.set(wx, 1.75, -22); w.add(glass);
    }
    // the surgeons' lounge (west of the theatre) and the recovery ward (north of the lounge) with the lift cab
    room(w, { x: -19.5, z: -37.5, w: 13, d: 21, sides: { e: false }, doors: { n: [{ c: 0, w: 1.6 }] }, floorKind: 'lino', wallKind: 'plaster' });
    hp(w, { x: -13, z: -47, y: 0, w: 0.3, d: 2.2, h: 3.4, kind: 'plaster', path: false });
    room(w, { x: -19.5, z: -62, w: 13, d: 28, sides: { s: false }, doors: { n: [{ c: 0, w: 2.4 }] }, floorKind: 'lino', wallKind: 'tile' });
    room(w, { x: -19.5, z: -78.6, w: 5, d: 5.2, sides: { s: false }, floorKind: 'concrete', wallKind: 'tile' });
    // gallery: slab, stairs on both sides, rails, supports
    hp(w, { x: 0, y: GAL, z: -43, w: 25.6, d: 6, h: 0.4, kind: 'concrete', color: 0x7e8680, path: false });
    const stairE = stairs(w, { x: 11.6, z: -35.1, dir: '-z', y0: 0, y1: GAL, width: 2, step: 0.4, run: 0.62 });
    const stairW = stairs(w, { x: -11.6, z: -35.1, dir: '-z', y0: 0, y1: GAL, width: 2, step: 0.4, run: 0.62 });
    void stairE; void stairW;
    T.rail(w, { x0: -10.4, x1: 10.4, z: -40.15, y: GAL });
    for (const [px, pz] of [[-6.5, -26], [6.5, -26], [-6.5, -40.3], [6.5, -40.3], [-6.5, -33], [6.5, -33]]) T.pillar(w, { x: px, z: pz });

    // ---- doors ---------------------------------------------------------------------------------------------------------------
    const D = {
      scrub: door(w, { x: 0, z: -6, along: 'x', width: 1.8, key: 'c5scrub', locked: true, label: 'scrub room door' }),
      west: door(w, { x: -13, z: -14, along: 'z', width: 1.6, key: 'c5west', label: 'door' }),
      store: door(w, { x: 13, z: -14, along: 'z', width: 1.6, key: 'c5store', label: 'store door' }),
      theatre: door(w, { x: 0, z: -22, along: 'x', width: 2.6, key: 'c5theatre', locked: true, label: 'theatre doors' }),
      lounge: door(w, { x: -13, z: -34, along: 'z', width: 1.6, key: 'c5lounge', locked: true, label: 'lounge door' }),
      ward: door(w, { x: -19.5, z: -48, along: 'x', width: 1.6, key: 'c5ward', locked: true, label: 'ward door' }),
      lift: door(w, { x: -19.5, z: -76, along: 'x', width: 2.4, key: 'c5lift', locked: true, label: 'lift gate' }),
    };

    // =============================================================================================================================
    //  THE ORDERLY (the anaesthetist)
    // =============================================================================================================================
    const NODES = [
      ['pa', -10, -9], ['pb', -10, -19], ['pc', 0, -18.5], ['pd', 10, -19], ['pe', 10, -9], ['pf', 0, -9], ['pw', -11.8, -14], ['pst', 11.8, -14],
      ['cw', -15, -14], ['c1', -20, -9], ['c2', -22, -19], ['sw', 15.5, -14], ['s1', 22, -9], ['s2', 22, -14], ['s3', 18, -18],
      ['tc', 0, -26], ['bw', -11, -27], ['be', 11, -27], ['th', POST.x, POST.z], ['tw', -9, -36], ['te', 9, -36], ['tg', 0, -38.5], ['tl', -11, -34],
      ['ld', -15, -34], ['l1', -17, -30], ['l2', -22, -31], ['l3', -22, -40], ['l4', -17, -44], ['ln', -19.5, -45.8],
      ['wd', -19.5, -50], ['w1', -19.5, -54], ['w2', -23, -59], ['w3', -16, -59], ['w4', -19.5, -64], ['w5', -23, -70], ['w6', -16, -70], ['w7', -19.5, -73],
    ];
    const st = stalker(w, game, H, S, {
      nodes: NODES.map(([id, x, z]) => ({ id, x, z })), route: ['pa', 'pb', 'pc', 'pd', 'pe', 'pf'], start: 'pe', speed: 1.7, chaseSpeed: 5.2, link: 22, home: 'pf', ignoreHigh: 1.8, pause: 2.2,
    });
    st.setActive(false);
    st.link('pa', 'pw', () => true); st.link('pw', 'cw', () => D.west.open); st.link('pe', 'pst', () => true); st.link('pst', 'sw', () => D.store.open);
    st.link('pc', 'tc', () => D.theatre.open); st.link('tl', 'ld', () => D.lounge.open); st.link('ln', 'wd', () => D.ward.open); st.link('l4', 'ln', () => true);
    for (const h of [
      { x: -12, z: -21, w: 3, d: 1.5 }, { x: 12, z: -21, w: 3, d: 1.5 }, { x: -3.2, z: -7, w: 2.6, d: 1.5 }, { x: 3.2, z: -7, w: 2.6, d: 1.5 }, { x: 0, z: -13, w: 2.6, d: 1.4 },
      { x: -25, z: -9.5, w: 1.8, d: 3.4 }, { x: -25, z: -18.5, w: 1.8, d: 3.4 }, { x: 25, z: -8, w: 1.8, d: 3 }, { x: 18, z: -9.6, w: 4, d: 1.4 }, { x: 23.5, z: -19.5, w: 4, d: 4 },
      DAIS.x === 0 ? { x: 0, z: -32, w: 1.6, d: 1.6 } : null,
      { x: -11.6, z: -26.2, w: 1.8, d: 2.2 }, { x: 11.6, z: -26.2, w: 1.8, d: 2.2 }, { x: -3, z: -45, w: 5, d: 1.4 }, { x: 8, z: -45, w: 4, d: 1.4 }, { x: -9.8, z: -37.5, w: 2.2, d: 2 }, { x: 9.8, z: -37.5, w: 2.2, d: 2 },
      { x: -25, z: -30, w: 1.8, d: 2.4 }, { x: -22, z: -45, w: 4, d: 1.6 },
      { x: -25, z: -52, w: 1.8, d: 3 }, { x: -25, z: -62, w: 1.8, d: 3 }, { x: -14, z: -57, w: 1.8, d: 3 }, { x: -14, z: -66, w: 1.8, d: 3 }, { x: -25, z: -68, w: 1.8, d: 3 },
    ]) if (h) st.hideSpot(h);

    // =============================================================================================================================
    //  DRESSING
    // =============================================================================================================================
    const L = (x, z, mode, o = {}) => H.lamp({ x, y: 3.35, z, mode, power: 0.62, ...o });
    const LT = (x, z, mode, o = {}) => H.lamp({ x, y: 6.35, z, mode, power: 0.8, shaft: false, ...o });
    // ---- scrub room
    L(-2.5, 0, 'buzz'); L(3, 5, 'dying'); L(0, -3, 'steady', { color: 0xdfeee6, len: 1.6 });
    stencil(w, 'CHAPTER 5 · THE THEATRE', { x: 0, y: 2.7, z: 9.8, rot: PI, width: 4.6, size: 0.3 });
    stencil(w, 'SCRUB · 5 MINUTES', { x: -3.6, y: 2.6, z: -5.8, rot: 0, width: 3.2, size: 0.3 });
    box(w, { x: 0, y: 1.25, z: 9.75, w: 2.8, h: 2.5, d: 0.2, kind: 'rust', color: 0x59645f, rough: 0.5 });
    box(w, { x: 0, y: 2.78, z: 9.62, w: 0.5, h: 0.14, d: 0.05, color: 0x33140f, kind: 'rust' });
    const sinks = [T.sink(w, { x: -5.82, z: 1.6, rot: PI / 2 }), T.sink(w, { x: 5.82, z: 1.6, rot: -PI / 2 })];
    for (let i = 0; i < 3; i++) box(w, { x: 0 + (i - 1) * 1.1, y: 1.2, z: 9.6, w: 0.5, h: 1.6, d: 0.1, kind: 'padded', color: 0x9aa39a, shadow: false });   // gowns on hooks
    wheelchair(w, { x: 3.8, z: 6.5, rot: -2.4 });
    decal(w, { kind: 'puddle', seed: 4, x: -4.2, y: 0.025, z: 1.6, w: 2.2, h: 2.2 }); decal(w, { kind: 'puddle', seed: 6, x: 4.2, y: 0.025, z: 1.6, w: 2.2, h: 2.2 });
    decal(w, { kind: 'drag', seed: 12, x: 0, y: 0.02, z: -2, w: 3.6, h: 3, rot: 1.57 });
    decal(w, { kind: 'hand', seed: 7, x: -5.82, y: 1.3, z: -2.5, w: 0.5, h: 0.5, face: 'w' }); decal(w, { kind: 'scratch', seed: 9, x: 5.82, y: 1.5, z: -2, w: 1.3, h: 1.3, face: 'e' });
    barWindow(w, { x: 0, y: 1.9, z: -5.84, rot: 0, width: 1.2 });
    // ---- pre-op
    [-9, 0, 9].forEach((x, i) => { L(x, -9, ['buzz', 'steady', 'dying'][i], { len: 1.4 }); L(x, -19, ['dying', 'buzz', 'buzz'][i], { len: 1.4 }); });
    stencil(w, 'PRE-OP · SILENCE', { x: -8, y: 2.7, z: -6.16, rot: PI, width: 3.4, size: 0.3 });
    stencil(w, 'THEATRE 1', { x: 0, y: 3.0, z: -21.8, rot: 0, width: 2.6 });
    for (const [gx, gz, gr] of [[-9, -11, 0.1], [-9, -14, -0.1], [9, -11, 3.0], [9, -17, 0.05]]) gurney(w, { x: gx, z: gz, rot: gr + PI / 2 });
    const tr = trolley(w, { x: -8, z: -8 }); w.updaters.push((dt) => tr.update(dt));
    wheelchair(w, { x: 3, z: -17.4, rot: 0.5 }); desk(w, { x: -4, z: -16.5, rot: 0 }); desk(w, { x: 5.2, z: -7.4, rot: 0, papers: false });
    for (const [cx, cz] of [[-12, -21], [12, -21]]) { curtain(w, { x: cx, z: cz + 0.5, width: 3 }); }
    curtain(w, { x: -3.2, z: -6.7, width: 2.8 }); curtain(w, { x: 3.2, z: -6.7, width: 2.8 });
    pipes(w, { x0: -12, z0: -8, x1: 12, z1: -8, y: 2.95, n: 2 });
    decal(w, { kind: 'drag', seed: 21, x: 3, y: 0.02, z: -15, w: 8, h: 3, rot: 0 }); decal(w, { kind: 'splat', seed: 8, x: -6, y: 0.02, z: -18, w: 2.6, h: 2.6 }); decal(w, { kind: 'hand', seed: 14, x: 12.84, y: 1.2, z: -10, w: 0.5, h: 0.5, face: 'w' });
    decal(w, { kind: 'puddle', seed: 3, x: 1, y: 0.025, z: -13, w: 3, h: 2.4 });
    T.xrayBox(w, { x: -12.84, y: 1.9, z: -14 + 3.5, rot: PI / 2 });
    // pre-op readers
    const rd = [reader(w, { x: -2.2, z: -21.8 }), reader(w, { x: 2.2, z: -21.8 })];
    // ---- changing room
    L(-19, -12, 'buzz'); L(-22, -17, 'dying', { rot: PI / 2 });
    stencil(w, 'STAFF · CHANGING', { x: -19.5, y: 2.7, z: -6.16, rot: PI, width: 3.4, size: 0.3 });
    for (let i = 0; i < 6; i++) locker(w, { x: -25.5, z: -18 + i * 0.64, rot: PI / 2, ajar: i === 3 ? 0.8 : 0 });
    for (let i = 0; i < 5; i++) locker(w, { x: -25.5, z: -10.5 + i * 0.64, rot: PI / 2, ajar: i === 1 ? 0.6 : 0 });
    T.coatRack(w, { x: -17, z: -17.5, rot: 0.4, names: [nm('p1'), nm('p2')] });
    box(w, { x: -20, y: 0.25, z: -12, w: 2.6, h: 0.5, d: 0.5, kind: 'wood', rot: 0 });
    decal(w, { kind: 'scratch', seed: 22, x: -19.5, y: 1.5, z: -21.84, w: 1.5, h: 1.5, face: 'n' }); decal(w, { kind: 'splat', seed: 24, x: -21, y: 0.02, z: -15, w: 2.4, h: 2.4 });
    barWindow(w, { x: -26.16, y: 1.9, z: -14, rot: PI / 2 });
    // ---- store + the cage
    L(17, -9, 'dying'); L(23, -14, 'buzz'); L(20, -19, 'dead');
    stencil(w, 'STERILE STORE', { x: 19.5, y: 2.7, z: -6.16, rot: PI, width: 3.4, size: 0.3 });
    K.shelf(w, { x: 16.5, z: -21.4, rot: 0, len: 3, tiers: 4 }); K.shelf(w, { x: 25.4, z: -9, rot: -PI / 2, len: 3, tiers: 4 }); K.shelf(w, { x: 25.4, z: -13, rot: -PI / 2, len: 3, tiers: 4 });
    K.bin(w, { x: 15, z: -8, rot: 0 }); K.bin(w, { x: 21, z: -7.4, rot: 0 });
    grille(w, { x: 21, z: -19.5, along: 'z', width: 5, h: 2.6 });
    const shutter = hp(w, { x: 23.5, y: 2.6, z: -17, w: 5, d: 0.2, h: 2.6, kind: 'rust', color: 0x445049, rough: 0.5, bump: 1.6, path: false, moving: true });
    const shut = { k: 0 };
    const cageZone = c.zone({ x: 23.5, y: 1, z: -19.5, w: 4.6, h: 3, d: 4.6, need: 'any', shrink: 0 });
    w.updaters.push((dt) => {
      let want = c.get('c5.winch', false) === true; if (!want && cageZone.active && shut.k > 0.05) want = true;
      shut.k += Math.sign((want ? 1 : 0) - shut.k) * Math.min(Math.abs((want ? 1 : 0) - shut.k), dt / 2.2);
      shutter.setPos(23.5, 1.3 + shut.k * 2.55, -17); shutter.body.enabled = shut.k < 0.9;
    });
    const winchG = new THREE.Group(); winchG.position.set(18, 1.2, -6.4); w.add(winchG);
    { const wh = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 20), K.mat('steel')); winchG.add(wh); for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.04), K.mat('steel')); sp.rotation.z = i * PI / 4; winchG.add(sp); } const bx = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.2), K.mat('casing')); bx.position.z = -0.12; winchG.add(bx); w.updaters.push((dt) => { if (c.get('c5.winch', false)) winchG.children[0].rotation.z += dt * 3; }); }
    const cardMesh = T.keyCard(w, { x: 25, y: 0.92, z: -21.2, rot: 0.4 }); box(w, { x: 25, y: 0.45, z: -21.2, w: 1.0, h: 0.9, d: 0.6, kind: 'rust', color: 0x4d5a56 });
    decal(w, { kind: 'splat', seed: 41, x: 22.5, y: 0.02, z: -19, w: 2.4, h: 2.4 }); decal(w, { kind: 'hand', seed: 42, x: 26.16 - 0.3, y: 1.1, z: -16, w: 0.5, h: 0.5, face: 'w' });
    // ---- the theatre
    LT(-6, -27, 'buzz', { len: 1.6 }); LT(6, -27, 'dying', { len: 1.6 }); LT(-8, -36, 'steady', { len: 1.6, color: 0xcfe8dc }); LT(8, -36, 'buzz', { len: 1.6 }); LT(0, -24, 'dead', { len: 1.6 });
    LT(-5, -43, 'dying', { len: 1.2 }); LT(5, -43, 'buzz', { len: 1.2 });
    H.lamp({ x: -5, y: 2.75, z: -43, mode: 'dying', power: 0.5, shaft: false }); H.lamp({ x: 5, y: 2.75, z: -43, mode: 'dead', power: 0.5, shaft: false });
    const table = T.tiltTable(w, DAIS);
    const lamp = T.surgicalLamp(w, { x: DAIS.x - 1.05, y: 5.6, z: DAIS.z, tx: DAIS.x, tz: DAIS.z - 0.2 });
    T.instrumentTable(w, { x: 3.6, z: -28.4, rot: 0.2 }); T.instrumentTable(w, { x: -3.4, z: -35.8, rot: -0.3 }); T.instrumentTable(w, { x: 4.2, z: -36.4, rot: 1.2, blood: false });
    T.anaesCart(w, { x: 2.0, z: -30.6, rot: 0.6 });
    T.xrayBox(w, { x: 12.84, y: 2.0, z: -29, rot: -PI / 2 }); T.xrayBox(w, { x: -12.84, y: 2.0, z: -27, rot: PI / 2, width: 1.2, height: 0.8 });
    curtain(w, { x: -11.6, z: -26.2, width: 2.6 }); curtain(w, { x: 11.6, z: -26.2, width: 2.6 });
    curtain(w, { x: -9.8, z: -37.5, width: 2.4, rot: PI / 2 }); curtain(w, { x: 9.8, z: -37.5, width: 2.4, rot: PI / 2 });
    for (let i = 0; i < 4; i++) locker(w, { x: -4 + i * 0.64, z: -45.5, rot: 0, ajar: i === 2 ? 0.7 : 0, color: 0x4d5a56 });
    gurney(w, { x: 8, z: -44.6, rot: 0.05 }); wheelchair(w, { x: -9, z: -44.4, rot: 0.3 });
    pipes(w, { x0: -12, z0: -24, x1: 12, z1: -24, y: 6.0, n: 3 }); pipes(w, { x0: -12, z0: -45, x1: 12, z1: -45, y: 2.55, n: 2 });
    stencil(w, 'THEATRE ONE · NO ENTRY', { x: 0, y: 4.6, z: -22.16, rot: PI, width: 5, size: 0.3 });
    stencil(w, 'OBSERVATION', { x: -9, y: 5.4, z: -45.8, rot: 0, width: 3, size: 0.3 });
    decal(w, { kind: 'drag', seed: 51, x: 0, y: 0.02, z: -27, w: 8, h: 3, rot: 1.57 }); decal(w, { kind: 'splat', seed: 52, x: -3, y: 0.02, z: -31, w: 3.2, h: 3.2 }); decal(w, { kind: 'puddle', seed: 53, x: 3, y: 0.025, z: -34, w: 3.6, h: 3 });
    decal(w, { kind: 'splat', seed: 54, x: 8, y: 0.02, z: -32, w: 2.4, h: 2.4 }); decal(w, { kind: 'hand', seed: 55, x: 12.84, y: 1.2, z: -35, w: 0.5, h: 0.5, face: 'w' }); decal(w, { kind: 'scratch', seed: 56, x: -12.84, y: 1.5, z: -31, w: 1.5, h: 1.5, face: 'e' });
    decal(w, { kind: 'splat', seed: 57, x: 0, y: GAL + 0.02, z: -41.4, w: 2.2, h: 2.2 });
    // the gallery
    const SLOTS = []; for (const x of [-10.5, -7.5, -4.5, -1.5, 1.5, 4.5, 7.5, 10.5]) SLOTS.push({ x, y: GAL, z: -43.7 });
    for (const x of [-9, -6, -3, 0, 3, 6, 9]) SLOTS.push({ x, y: GAL, z: -45.3 });
    for (const x of [-10.5, -6, -1.5, 3, 7.5]) T.bench(w, { x, y: GAL, z: -44.5, len: 2.6, rot: PI });
    for (const x of [-9, -4.5, 0, 4.5, 9]) T.bench(w, { x, y: GAL, z: -45.7, len: 2.6, rot: PI });
    for (let i = 0; i < SLOTS.length; i++) if (i % 3 === 1) { /* seat shapes only */ }
    const Wt = T.watchers(w, game, S, SLOTS);
    decal(w, { kind: 'scratch', seed: 58, x: 6, y: GAL + 1.5, z: -45.84, w: 1.8, h: 1.8, face: 'n' });
    // the surgeons' lounge
    L(-19.5, -32, 'buzz'); L(-19.5, -42, 'dying'); L(-23, -37, 'dead', { rot: PI / 2 });
    stencil(w, 'SURGEONS', { x: -16.5, y: 2.8, z: -27.16, rot: PI, width: 2.6, size: 0.3 });
    desk(w, { x: -21, z: -33, rot: 0 }); box(w, { x: -22.6, y: 0.25, z: -31.4, w: 0.5, h: 0.5, d: 0.5, kind: 'padded', color: 0x4d5a52 }); box(w, { x: -19.4, y: 0.25, z: -34.6, w: 0.5, h: 0.5, d: 0.5, kind: 'padded', color: 0x4d5a52, rot: 0.6 });
    for (let i = 0; i < 3; i++) box(w, { x: -22 + i * 0.3, y: 0.83, z: -33.5, w: 0.1, h: 0.1, d: 0.1, kind: 'wood', color: 0xb8b0a0, shadow: false });
    T.coatRack(w, { x: -24.6, z: -40, rot: 0.2, names: [nm('p1'), nm('p2')] });
    for (let i = 0; i < 6; i++) locker(w, { x: -25.5, z: -43.5 + i * 0.64, rot: PI / 2, ajar: i === 4 ? 0.6 : 0, color: 0x4d5a56 });
    barWindow(w, { x: -26.16, y: 1.9, z: -36, rot: PI / 2 });
    decal(w, { kind: 'splat', seed: 61, x: -17, y: 0.02, z: -39, w: 2.6, h: 2.6 }); decal(w, { kind: 'drag', seed: 62, x: -19.5, y: 0.02, z: -44, w: 3, h: 4, rot: 1.57 }); decal(w, { kind: 'hand', seed: 63, x: -25.84, y: 1.2, z: -32, w: 0.5, h: 0.5, face: 'e' });
    pipes(w, { x0: -26, z0: -28, x1: -26, z1: -47, y: 3.0, n: 2 });
    const recorder = T.tapeRecorder(w, { x: -21.6, y: 0.8, z: -33.2, rot: 0.2 });
    // lockers with names (halves of the photograph)
    const halfL = { p1: { x: -25.5, z: -26.4 }, p2: { x: -25.5, z: -26.4 } };
    void halfL;
    const lockP1 = locker(w, { x: -25.5, z: -29.2, rot: PI / 2, color: 0x5d6b66 }), lockP2 = locker(w, { x: -25.5, z: -30.2, rot: PI / 2, color: 0x5d6b66 });
    void lockP1; void lockP2;
    T.tagPlane(w, { x: -25.17, y: 1.55, z: -29.2, rot: PI / 2, lines: ['STAFF', nm('p1')] }); T.tagPlane(w, { x: -25.17, y: 1.55, z: -30.2, rot: PI / 2, lines: ['STAFF', nm('p2')] });
    // the recovery ward
    [-52, -60, -68].forEach((z, i) => { L(-19.5, z, ['dying', 'buzz', 'dead'][i], { len: 1.4, shaft: false }); });
    stencil(w, 'RECOVERY', { x: -19.5, y: 2.9, z: -48.16, rot: PI, width: 3, size: 0.32 }); stencil(w, 'LIFT 2 · SERVICE ONLY', { x: -19.5, y: 3.0, z: -75.84, rot: PI, width: 3.6, size: 0.28 });
    for (const z of [-53, -58, -63, -68]) { bed(w, { x: -25, z, rot: PI / 2, strapped: z === -58 || z === -68 }); bed(w, { x: -14, z: z - 0.5, rot: PI / 2, strapped: z === -63 }); }
    for (const z of [-53, -63]) curtain(w, { x: -23.4, z: z + 2.5, width: 3, rot: PI / 2 });
    curtain(w, { x: -15.6, z: -60.5, width: 3, rot: PI / 2 });
    decal(w, { kind: 'drag', seed: 71, x: -19.5, y: 0.02, z: -60, w: 3, h: 14, rot: 1.57 }); decal(w, { kind: 'splat', seed: 72, x: -21, y: 0.02, z: -66, w: 3, h: 3 }); decal(w, { kind: 'puddle', seed: 73, x: -18, y: 0.025, z: -55, w: 3, h: 3 });
    decal(w, { kind: 'hand', seed: 74, x: -13.16, y: 1.2, z: -72, w: 0.5, h: 0.5, face: 'w' }); decal(w, { kind: 'scratch', seed: 75, x: -25.84, y: 1.5, z: -57, w: 1.5, h: 1.5, face: 'e' });
    barWindow(w, { x: -25.84, y: 1.9, z: -50, rot: PI / 2 }); barWindow(w, { x: -13.16, y: 1.9, z: -55, rot: -PI / 2 });
    const liftBtn = [T.wallButton(w, { x: -25.8, y: 1.4, z: -72, rot: PI / 2 }), T.wallButton(w, { x: -13.2, y: 1.4, z: -72, rot: -PI / 2 })];
    L(-19.5, -78, 'steady', { color: 0xcfe8ee, len: 1.0, shaft: false });
    exitDoor(w, { x: -19.5, z: -80.7, rot: 0 });
    checkpoint(w, { x: 0, z: -9, side: 1 }); checkpoint(w, { x: 0, z: -26, side: -1 }); checkpoint(w, { x: -19.5, z: -31, side: 1 }); checkpoint(w, { x: -19.5, z: -50.5, side: 1 });

    // =============================================================================================================================
    //  HUD / panel / torch
    // =============================================================================================================================
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;left:18px;top:16px;z-index:30;pointer-events:none;font:600 12px/1.5 "Archivo Black",Impact,sans-serif;letter-spacing:.16em;color:#c9d3cc;text-shadow:0 0 6px #000;opacity:0;transition:opacity .4s;min-width:190px';
    panel.innerHTML = '<div id="c5-role"></div><div id="c5-task" style="color:#9aa39c;font-size:11px"></div><div style="margin-top:6px;width:170px;height:7px;border:1px solid #5d6b66;background:rgba(0,0,0,.55);display:none" id="c5-bw"><div id="c5-bar" style="height:100%;width:0;background:#a8171f"></div></div>';
    document.body.appendChild(panel); w.disposers.push(() => panel.remove());
    const q = (s) => panel.querySelector(s);
    const setPanel = (role, task, bar = null, color = '#a8171f') => { panel.style.opacity = role ? '0.92' : '0'; q('#c5-role').textContent = role || ''; q('#c5-task').textContent = task || ''; const bw = q('#c5-bw'); bw.style.display = bar === null ? 'none' : 'block'; if (bar !== null) { q('#c5-bar').style.width = Math.round(Math.max(0, Math.min(1, bar)) * 100) + '%'; q('#c5-bar').style.background = color; } };
    const onKey = (e) => { if (e.code === 'KeyF' && !e.repeat && game.state === 'playing' && !game.modal) { H.torchOn = !H.torchOn; c.set('tv:' + me, H.torchOn); } };
    document.addEventListener('keydown', onKey); w.disposers.push(() => document.removeEventListener('keydown', onKey));
    c.set('tv:' + me, true); c.set('torch:' + me, false); c.on('tv:' + other, (v) => { H.theirOn = v !== false; });

    // =============================================================================================================================
    //  BEAT 1 — SCRUB IN
    // =============================================================================================================================
    const scrubbed = [false, false];
    const sinkH = [-1, 1].map((sd, i) => holdable(w, game, HOLD, {
      x: sd * 5.0, y: 1.1, z: 1.6, w: 1.4, h: 1.2, d: 1.3, range: 3, secs: 5, bar: 'SCRUBBING IN',
      label: () => (scrubbed[i] ? 'Scrubbed' : 'Scrub in (hold)'), enabled: () => !scrubbed[i] && me === (i === 0 ? 'p1' : 'p2'),
      onDone: () => c.emit('c5:scrubbed', { i }),
    }));
    w.updaters.push(() => { for (let i = 0; i < 2; i++) { const s = sinkH[i]; if (!scrubbed[i]) sinks[i].set(s.held, s.k > 0.5); } });
    c.onEvent('c5:scrubbed', (a) => {
      if (scrubbed[a.i]) return; scrubbed[a.i] = true; sinks[a.i].set(false); S.bell(0, 0.1);
      if (scrubbed[0] && scrubbed[1]) { D.scrub.unlock(); D.scrub.setOpen(true); phase = 'preop'; tell('all', 'lt.c5.scrubbed', { priority: 2 }); S.groan(0.14); H.stutter(1.5); w.after(7, () => tell('all', 'lt.c5.preop')); }
      else tell(me, a.i === (me === 'p1' ? 0 : 1) ? 'lt.c5.scrub.wait' : 'lt.c5.scrub.theirs', { priority: 1 });
    });
    w.after(2.5, () => tell('all', 'lt.c5.arrive', { priority: 2 }));
    w.after(14, () => { if (!scrubbed[0] || !scrubbed[1]) tell('all', 'lt.c5.scrub.hint', { priority: 1 }); });
    // the theatre list: tells each of you what the first half holds for you
    note(w, game, {
      x: 0, y: 1.2, z: 8.6, rot: PI, title: 'THEATRE LIST · TONIGHT', label: 'Read the list',
      html: { p1: `<p><b>FIRST HALF</b></p><p>${TB1 === 'p1' ? '<b>PATIENT</b> — you. Upright, strapped. Watch the lamp.' : '<b>OPERATOR</b> — you. The gallery. The console.'}</p><p>${TB1 === 'p1' ? 'OPERATOR' : 'PATIENT'} — ${nm('p2')}</p><p style="color:#8a8"><i>Stations are exchanged at the interval. Do not discuss the interval.</i></p>`,
        p2: `<p><b>FIRST HALF</b></p><p>${TB1 === 'p2' ? '<b>PATIENT</b> — you. Upright, strapped. Watch the lamp.' : '<b>OPERATOR</b> — you. The gallery. The console.'}</p><p>${TB1 === 'p2' ? 'OPERATOR' : 'PATIENT'} — ${nm('p1')}</p><p style="color:#8a8"><i>Stations are exchanged at the interval. Do not discuss the interval.</i></p>` },
    });

    // =============================================================================================================================
    //  BEAT 2 — PRE-OP
    // =============================================================================================================================
    enter('preop', { x: 0, y: 1, z: -9.5, w: 8, h: 3, d: 3 }, () => {
      st.setActive(true); if (c.isHost) st.warp(10, -9);
      tell('all', 'lt.c5.rounds', { priority: 2 }); w.after(9, () => tell('all', 'lt.c5.hide'));
      Z.stand('patient', 11.5, -19.5, { dur: 30 });
    });
    enter('window', { x: 0, y: 1, z: -20.3, w: 22, h: 3, d: 2 }, () => {
      lamp.set(1); S.slam(0.25); H.stutter(0.8); Z.knock({ n: 2 });
      w.after(1.4, () => tell('all', 'lt.c5.window', { priority: 2 })); w.after(9, () => tell('all', 'lt.c5.cage'));
    });
    // a trolley to knock over: lures him
    const trollyIt = w.interactable({ x: -8, y: 0.9, z: -8, w: 1.2, h: 1.0, d: 1.0, range: 3, label: () => (tr.fallen ? 'Knocked over' : 'Tip the trolley'), enabled: () => !tr.fallen, onUse: () => c.emit('c5:tip') });
    void trollyIt;
    c.onEvent('c5:tip', () => { if (tr.fallen) return; tr.tip(); S.slam(0.3); S.scrape(panTo(-8, -8), 0.15); if (c.isHost) st.noise(-8, -8, 22); });
    // the winch (hold) + the card (fetch)
    let winchHeld = false;
    const winch = holdable(w, game, HOLD, {
      x: 18, y: 1.2, z: -7.4, w: 1.6, h: 1.4, d: 1.2, range: 3, label: 'Hold the winch', bar: 'HOLDING THE WINCH', noBar: true,
      enabled: () => cardLeft(),
      tick: (dt, s) => {
        if (s.held !== winchHeld) { winchHeld = s.held; c.set('c5.winch', winchHeld); if (winchHeld) S.scrape(panTo(18, -7), 0.14); }
        if (s.held) HOLD.show('HOLDING THE WINCH', Math.min(1, shut.k));
      },
    });
    let winchNoise = 0;
    w.updaters.push((dt) => { if (!c.isHost) return; if (c.get('c5.winch', false) && phase === 'preop') { winchNoise -= dt; if (winchNoise <= 0) { winchNoise = 22; w.after(5, () => st.noise(18, -9, 10)); } } });
    let cardTaken = false; const cardLeft = () => !cardTaken;
    const cardIt = w.interactable({ x: 25, y: 1.0, z: -20.4, w: 1.2, h: 0.8, d: 1.0, range: 3, label: () => (shut.k > 0.85 ? 'Take the key card' : 'The shutter is down'), enabled: () => !cardTaken && shut.k > 0.85, onUse: () => c.emit('c5:card') });
    c.onEvent('c5:card', () => {
      if (cardTaken) return; cardTaken = true; cardMesh.visible = false; S.bell(0, 0.1); tell('all', 'lt.c5.card', { priority: 2 }); w.after(8, () => tell('all', 'lt.c5.readers'));
    });
    const rdDone = [false, false]; let theatreOpen = false;
    const rdH = [0, 1].map((i) => holdable(w, game, HOLD, {
      x: i ? 2.2 : -2.2, y: 1.2, z: -20.9, w: 1.4, h: 1.2, d: 1.4, range: 3, secs: 3, bar: 'KEY CARD',
      label: () => (rdDone[i] ? 'Accepted' : cardTaken ? 'Hold the card to the reader' : 'No card'), enabled: () => cardTaken && !rdDone[i], onDone: () => c.emit('c5:rd', { i }),
    }));
    c.onEvent('c5:rd', (a) => {
      if (rdDone[a.i]) return; rdDone[a.i] = true; rd[a.i].led(0x3dff7a); S.bell(a.i ? 0.4 : -0.4, 0.12);
      if (rdDone[0] && rdDone[1] && !theatreOpen) { theatreOpen = true; D.theatre.unlock(); D.theatre.setOpen(true); st.setActive(false); phase = 'enter'; tell('all', 'lt.c5.open', { priority: 2 }); S.door(0, 0.3); }
      else tell(me, 'lt.c5.reader.one', { priority: 1 });
    });
    // the changing room (foreshadowing)
    enter('changing', { x: -19.5, y: 1, z: -14, w: 10, h: 3, d: 12 }, () => { tell('all', 'lt.c5.changing', { priority: 1 }); w.after(6, () => Z.fire('behind', { kind: 'patient', role: 'all', dist: 4 })); });
    enter('store', { x: 19.5, y: 1, z: -14, w: 10, h: 3, d: 12 }, () => { tell('all', 'lt.c5.store', { priority: 1 }); });

    // =============================================================================================================================
    //  BEAT 3 — THE THEATRE, FIRST HALF
    // =============================================================================================================================
    let anF = figure(w, { kind: 'orderly' }); anF.set(2.4, 0, -32.4); anF.face(Math.atan2(-2.4, 0.3)); anF.group.visible = false; anF.pose(0, 0, 0, 0);
    let aErr = 0, aRound = 0, aIn = 0, aOn = false, strapOn = false, anShow = false;
    const roundWait = () => (aRound < 4 && !aOn);
    enter('theatre', { x: 0, y: 1, z: -34, w: 24, h: 3, d: 22 }, () => {
      D.theatre.setOpen(false); w.after(0.9, () => { D.theatre.lock(); S.slam(0.55); Z.shake(0.8); }); phase = 'assign'; lamp.set(1);
      tell('all', 'lt.c5.theatre', { priority: 2 }); w.after(8, () => { tell(TB1, 'lt.c5.patient', { priority: 2 }); tell(OP1, 'lt.c5.operator', { priority: 2 }); });
    }, 'both');
    const conZone = c.zone({ x: 0, y: GAL + 1, z: -42.2, w: 6, h: 3, d: 3, need: 'any', shrink: 0 });
    let opReady = false, ptReady = false;
    let startedA = false;
    const tryStartA = () => { if (phase === 'assign' && opReady && ptReady && !startedA) { startedA = true; w.after(3, () => c.emit('c5:startA')); } };
    w.updaters.push(() => { if (phase === 'assign' && !opReady && conZone[OP1]) { opReady = true; c.isHost && c.emit('c5:opready'); } });
    c.onEvent('c5:opready', () => { opReady = true; tell('all', 'lt.c5.opready', { priority: 1 }); tryStartA(); });
    const buckle = holdable(w, game, HOLD, {
      x: 0, y: 1.2, z: -30.4, w: 1.6, h: 1.4, d: 1.3, range: 3.2, secs: 4.5, bar: 'FASTENING THE STRAPS',
      label: 'Step up and fasten the straps (hold)', enabled: () => me === TB && !strapOn && (phase === 'assign' || phase === 'swap2'),
      onDone: () => c.emit('c5:strapin', { role: me }),
    });
    c.onEvent('c5:strapin', (a) => {
      if (a.role === me) { strapOn = true; game.yaw = 0; const g = pp(); g.x = DAIS.x; g.z = DAIS.z; g.y = 0.35; g.vx = g.vz = 0; }
      S.door(0, 0.2); S.squeak(0, 0.08);
      if (phase === 'assign') { ptReady = true; table.set(0); tell('all', 'lt.c5.strapped', { priority: 2 }); tryStartA(); }
      else if (phase === 'swap2') { startB(); }
    });
    // ---- the machine console
    const conDraw = (g, W, Hh) => {
      g.fillStyle = '#03100c'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#7cffc0'; g.font = `700 ${Math.floor(Hh * 0.1)}px monospace`; g.textAlign = 'left';
      g.fillText('THEATRE 1 // MACHINE', 10, Hh * 0.13);
      if (phase === 'A') {
        g.fillStyle = '#d6c27a'; g.fillText(`ROUND ${Math.min(4, aRound + 1)} / 4`, 10, Hh * 0.3); g.fillStyle = '#7cffc0'; g.fillText('ENTER THE PATIENT\'S SEQUENCE', 10, Hh * 0.46);
        const n = SEQ[Math.min(3, aRound)].length; for (let i = 0; i < n; i++) { g.fillStyle = i < aIn ? '#7cffc0' : '#1c3d33'; g.fillRect(10 + i * 38, Hh * 0.56, 30, 22); }
        g.fillStyle = aErr ? '#e0242e' : '#2f6b55'; g.fillText(`DISCHARGES: ${aErr}`, 10, Hh * 0.9);
      } else if (phase === 'B') {
        const sed = c.get('c5.sed', 0), bk = c.get('c5.bk', 0);
        g.fillStyle = '#d6c27a'; g.fillText(`STAGE ${Math.min(3, bStage + 1)} / 3`, 10, Hh * 0.3);
        g.strokeStyle = '#2f8f6a'; g.strokeRect(10, Hh * 0.38, W - 20, 22); g.fillStyle = '#7cffc0'; g.fillRect(12, Hh * 0.38 + 2, (W - 24) * bk, 18);
        g.fillStyle = '#e0242e'; g.fillText('SEDATION', 10, Hh * 0.68); g.strokeStyle = '#8f2f3a'; g.strokeRect(10, Hh * 0.74, W - 20, 18); g.fillRect(12, Hh * 0.74 + 2, (W - 24) * sed, 14);
        g.fillStyle = Math.hypot(st.x - POST.x, st.z - POST.z) < 3 ? '#e0242e' : '#7cffc0'; g.font = `700 ${Math.floor(Hh * 0.075)}px monospace`; g.fillText(Math.hypot(st.x - POST.x, st.z - POST.z) < 3 ? 'ANAESTHETIST: AT TABLE' : 'ANAESTHETIST: AWAY', 10, Hh * 0.95);
      } else if (phase === 'swap1' || phase === 'swap2') { g.fillStyle = '#e0242e'; g.fillText('PROCEDURE PAUSED', 10, Hh * 0.35); g.fillStyle = '#7cffc0'; g.fillText('EXCHANGE STATIONS', 10, Hh * 0.55); g.fillText(Math.hypot(st.x - POST.x, st.z - POST.z) < 3 ? 'ANAESTHETIST: AT TABLE' : 'ANAESTHETIST: AWAY', 10, Hh * 0.8); }
      else { g.fillStyle = '#2f6b55'; g.fillText(phase === 'assign' ? 'AWAITING PATIENT' : 'STANDBY', 10, Hh * 0.4); }
    };
    const CON = T.machineConsole(w, { x: 0, y: GAL, z: -40.9, rot: PI, draw: conDraw });
    w.collider({ x: 0, y: GAL + 0.5, z: -40.9, w: 3.9, h: 1.0, d: 0.95 });
    const bw = (lx, ly = 1.15) => T.worldOf(CON.group, lx, ly, 0.38);
    const btnIt = [0, 1, 2, 3].map((i) => {
      const p = bw(CON.btn[i].lx);
      return w.interactable({ x: p.x, y: p.y, z: p.z + 0.1, w: 0.46, h: 0.4, d: 0.5, range: 3.5, pad: 0.04, label: () => `Press ${COLS[i]}`, enabled: () => me === OP && phase === 'A' && aOn, onUse: () => c.emit('c5:btn', { b: i, who: me }) });
    });
    const kp = bw(1.55), lp0 = bw(-1.55);
    let klaxCd = 0; const KLX = [{ x: -11, z: -27 }, { x: 11, z: -27 }];
    const klaxWho = () => (phase === 'swap1' ? me === OP1 : phase === 'swap2' || phase === 'B' ? me === OP : false);
    w.interactable({ x: kp.x, y: kp.y, z: kp.z + 0.1, w: 0.6, h: 0.5, d: 0.6, range: 3.5, pad: 0.04, label: () => (klaxCd > w.t ? 'The klaxon is cooling' : 'Sound the klaxon'), enabled: () => klaxWho() && klaxCd <= w.t, onUse: () => { klaxCd = w.t + 11; c.emit('c5:klax', { i: Math.floor(w.t) % 2 }); } });
    c.onEvent('c5:klax', (a) => { const k = KLX[a.i]; S.alarm(0.09); CON.klaxon(true); w.after(2.5, () => CON.klaxon(false)); S.slam(0.2); if (c.isHost) st.noise(k.x, k.z, 24); });
    // the patient's buzzer (phase B)
    let buzzCd = 0;
    w.interactable({ x: 0.7, y: 1.3, z: -31.0, w: 0.8, h: 0.6, d: 0.8, range: 3.2, label: () => (buzzCd > w.t ? 'The buzzer is cooling' : 'Press the nurse buzzer'), enabled: () => phase === 'B' && me === TB && strapOn && buzzCd <= w.t, onUse: () => { buzzCd = w.t + 11; c.emit('c5:buzz'); } });
    c.onEvent('c5:buzz', () => { S.bell(0.5, 0.12); S.alarm(0.06); if (c.isHost) st.noise(KLX[1].x, KLX[1].z, 24); });

    // ---- the patient's monitor (faces the patient; only the patient's machine draws the sequence)
    const monDraw = (g, W, Hh, t) => {
      g.fillStyle = '#02070a'; g.fillRect(0, 0, W, Hh);
      if (phase === 'A' && me === TB && aOn) {
        const seq = SEQ[Math.min(3, aRound)], cyc = seq.length * 1.2 + 3.2, tt = t % cyc, idx = Math.floor(tt / 1.2), on = idx < seq.length && (tt % 1.2) < 0.85;
        g.fillStyle = '#7cffc0'; g.font = `700 ${Math.floor(Hh * 0.09)}px monospace`; g.textAlign = 'left'; g.fillText(`SEQUENCE ${aRound + 1}/4`, 8, Hh * 0.11);
        for (let i = 0; i < 4; i++) { g.fillStyle = on && seq[idx] === i ? COLHEX[i] : '#14201c'; g.fillRect(14 + i * 62, Hh * 0.3, 52, Hh * 0.4); }
        g.fillStyle = '#4c6a60'; g.fillText(idx < seq.length ? 'WATCH' : 'REPEATING...', 8, Hh * 0.92);
      } else if (phase === 'B') {
        const sed = c.get('c5.sed', 0); g.strokeStyle = '#3dff7a'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x < W; x += 3) { const ph = ((x / W) * 3 + t * (1 + sed * 1.4)) % 1; const y = Hh * 0.38 + (ph < 0.08 ? -Hh * 0.22 * Math.sin(ph * 40) : Math.sin(x * 0.2) * 1.2); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
        g.fillStyle = '#e0242e'; g.font = `700 ${Math.floor(Hh * 0.09)}px monospace`; g.fillText('SEDATION', 8, Hh * 0.72); g.strokeStyle = '#8f2f3a'; g.strokeRect(8, Hh * 0.78, W - 16, 16); g.fillRect(10, Hh * 0.78 + 2, (W - 20) * sed, 12);
      } else { g.fillStyle = '#16302a'; g.font = `700 ${Math.floor(Hh * 0.1)}px monospace`; g.textAlign = 'left'; g.fillText('PT 114 · A', 10, Hh * 0.5); g.fillRect(10, Hh * 0.62, 60 + Math.sin(t) * 20, 4); }
    };
    K.screen(w, { x: DAIS.x, y: 1.75, z: -34.2, rot: 0, width: 1.1, height: 0.7, px: 256, draw: monDraw, rate: 8, tint: 1.35 });
    box(w, { x: DAIS.x, y: 0.9, z: -34.25, w: 0.1, h: 1.8, d: 0.1, kind: 'rust', color: 0x333a37 });

    // ---- phase A
    const discharge = () => {
      aErr++; aIn = 0; S.static(0.5, 0.16); Z.shake(0.5); H.stutter(1); lamp.pulse(0.6); game.fx.glitch = 1; setTimeout(() => { game.fx.glitch = 0; }, 300);
      if (anF) { const k = Math.min(1, aErr / 7); anF.set(2.4 - 1.05 * k, 0, -32.4 + 0.1 * k); }
      if (aErr === 1) tell('all', 'lt.c5.err1', { priority: 2 }); else if (aErr === 4) tell('all', 'lt.c5.err2', { priority: 2 });
    };
    c.onEvent('c5:btn', (a) => {
      if (phase !== 'A' || !aOn) return; CON.flash(a.b); S.bell((a.b - 1.5) * 0.2, 0.08 + a.b * 0.02);
      const seq = SEQ[aRound];
      if (a.b === seq[aIn]) { aIn++; if (aIn >= seq.length) roundDone(); } else discharge();
    });
    const roundDone = () => {
      aOn = false; aRound++; aIn = 0; table.set(aRound); Wt.setLevel(WATCH[aRound - 1]); S.bell(0, 0.2); S.groan(0.1);
      if (aRound >= 4) { w.after(2.2, () => c.emit('c5:swap')); tell('all', 'lt.c5.r4', { priority: 2 }); return; }
      tell('all', `lt.c5.r${aRound}`, { priority: 2 });
      w.after(6, () => { aOn = true; tell(TB, `lt.c5.again${aRound}`, { priority: 1 }); });
      if (aRound === 2) w.after(16, () => Z.blackout(2.4));
      if (aRound === 3) w.after(13, () => { Z.fire('wrong', { sec: 4, role: 'all' }); });
      if (aRound === 1) w.after(20, () => Z.fire('whisper', { role: OP1 }));
    };
    c.onEvent('c5:startA', () => {
      if (phase !== 'assign') return; phase = 'A'; aOn = true; lamp.set(1); anShow = true; if (anF) { anF.group.visible = true; }
      tell('all', 'lt.c5.startA', { priority: 2 }); w.after(7, () => tell(TB1, 'lt.c5.seehint', { priority: 1 })); w.after(9, () => tell(OP1, 'lt.c5.pressthem', { priority: 1 }));
      Wt.setLevel(1);
    });
    // per-frame: the anaesthetist's head follows the patient; clamp; watchers; panel
    const FADE = { t: 0 };
    w.updaters.push((dt) => {
      const g = pp();
      if (strapOn) { if (Math.hypot(g.x - DAIS.x, g.z - DAIS.z) > 0.04) { g.x = DAIS.x; g.z = DAIS.z; } g.vx = 0; g.vz = 0; }
      if (phase === 'swap1' && me === TB1 && strapOn && Math.hypot(st.x - POST.x, st.z - POST.z) > 7) { strapOn = false; tell(me, 'lt.c5.free', { priority: 2 }); }
      if (FADE.t > 0) { FADE.t -= dt; game.fx.fade = Math.min(0.97, FADE.t > 2.2 ? (3 - FADE.t) * 1.2 : FADE.t * 0.4); } else if (game.fx.fade > 0.001 && FADE.on) { game.fx.fade *= 0.9; }
      // panel text
      let role = null, task = '', bar = null, colr;
      if (phase === 'A') { role = me === TB ? 'PATIENT' : 'OPERATOR'; task = me === TB ? 'Read the monitor. Say it aloud.' : 'Press what they tell you.'; bar = aRound / 4 + (aOn ? aIn / SEQ[Math.min(3, aRound)].length / 4 : 0); colr = '#3a8f6a'; }
      else if (phase === 'swap1' || phase === 'swap2') { role = 'THE INTERVAL'; task = 'Exchange stations.'; }
      else if (phase === 'B') { role = me === TB ? 'PATIENT' : 'OPERATOR'; task = `Stage ${Math.min(3, bStage + 1)} / 3 · sedation`; bar = c.get('c5.sed', 0); }
      else if (phase === 'ward') { role = 'THE LIFT'; task = 'Hold both call buttons.'; bar = c.get('c5.lp', 0); colr = '#3a8f6a'; }
      if (window.__noRender) return;
      setPanel(role, task, bar, colr);
    });
    // the anaesthetist's idle head turn toward the patient
    w.hooks.frame = ((prev) => (dt, g) => { prev?.(dt, g); if (anF && anShow && phase === 'A') anF.pose(0, 0, 0.1, w.t); lamp.group.visible = true; })(w.hooks.frame);

    // =============================================================================================================================
    //  BEAT 4 — THE INTERVAL (swap)
    // =============================================================================================================================
    c.onEvent('c5:swap', () => {
      if (phase === 'swap1' || phase === 'swap2') return;
      phase = 'swap1'; aOn = false; anShow = false; if (anF) anF.group.visible = false;
      Z.blackout(3); H.stutter(2); lamp.pulse(2); Z.sting(0.5);
      st.setActive(true); if (c.isHost) { st.warp(POST.x, POST.z); st.setRoute(['th']); st.speed = 1.5; st.home = 'tc'; }
      w.after(3.2, () => { tell('all', 'lt.c5.swap', { priority: 2 }); Z.rush('orderly', { role: TB1, dist: 7, dur: 0.9 }); });
      w.after(10, () => { tell(OP1, 'lt.c5.klax1', { priority: 2 }); tell(TB1, 'lt.c5.stillT', { priority: 2 }); });
    });
    w.updaters.push(() => {
      if (phase === 'swap1' && conZone[TB1] && !strapOn) c.isHost && c.emit('c5:swap2');
    });
    c.onEvent('c5:swap2', () => {
      if (phase !== 'swap1') return; phase = 'swap2'; TB = OP1; OP = TB1;
      tell(OP, 'lt.c5.up', { priority: 2 }); w.after(3, () => tell(TB, 'lt.c5.down', { priority: 2 })); w.after(14, () => tell(OP, 'lt.c5.klax2', { priority: 1 }));
    });
    // =============================================================================================================================
    //  BEAT 5 — SECOND HALF
    // =============================================================================================================================
    let bStage = 0, bk = 0, bSend = 0, gripHeld = false, sed = 0, sedSend = 0, bDone = false;
    const startB = () => {
      phase = 'B'; bStage = 0; bk = 0; lamp.set(1);
      tell('all', 'lt.c5.B', { priority: 2 }); w.after(8, () => tell(OP, 'lt.c5.Bop', { priority: 1 })); w.after(11, () => tell(TB, 'lt.c5.Bpt', { priority: 1 }));
      Wt.setLevel(11);
    };
    const lever = holdable(w, game, HOLD, {
      x: lp0.x, y: lp0.y, z: lp0.z + 0.1, w: 0.7, h: 0.8, d: 0.6, range: 3.5, label: () => `Hold the lever (stage ${bStage + 1})`,
      enabled: () => phase === 'B' && me === OP && bStage < 3, noBar: true,
      tick: (dt, s) => {
        const ok = s.held && (bStage < 2 || c.get('c5.grip', false) === true);
        bk = Math.max(0, Math.min(1, bk + (ok ? dt / SECS[bStage] : -dt / SECS[bStage] * 0.5)));
        CON.lever(s.held ? 1 : 0);
        if (s.held) HOLD.show(bStage === 2 && !ok ? 'WAITING FOR THEIR GRIP' : `MACHINE · STAGE ${bStage + 1}`, bk);
        bSend -= dt; if (bSend <= 0) { bSend = 0.2; c.set('c5.bk', bk); }
        if (bk >= 1) { bk = 0; c.set('c5.bk', 0); c.emit('c5:stage', { n: bStage }); }
      },
    });
    void lever;
    w.interactable({ x: 0, y: 1.0, z: -31.0, w: 0.01, h: 0.01, d: 0.01, range: 0.1, enabled: () => false });
    const grip = holdable(w, game, HOLD, {
      x: -0.75, y: 1.2, z: -31.7, w: 0.8, h: 0.6, d: 0.8, range: 3.2, label: 'Squeeze the grip (hold)', noBar: true,
      enabled: () => phase === 'B' && me === TB && strapOn && bStage === 2,
      tick: (dt, s) => { if (s.held !== gripHeld) { gripHeld = s.held; c.set('c5.grip', gripHeld); } if (s.held) HOLD.show('SQUEEZING', 1); },
    });
    void grip;
    c.onEvent('c5:stage', (a) => {
      if (a.n !== bStage || phase !== 'B') return; bStage++; S.bell(0, 0.2); S.groan(0.08); H.stutter(1.2); lamp.pulse(0.7); bk = 0;
      Wt.setLevel(11 + bStage * 2);
      if (bStage >= 3) { c.isHost && c.emit('c5:done'); return; }
      tell('all', `lt.c5.stage${bStage}`, { priority: 2 }); if (bStage === 2) w.after(6, () => tell(TB, 'lt.c5.gripHint', { priority: 1 }));
      if (bStage === 1) w.after(14, () => Z.fire('whisper', { role: TB }));
    });
    // sedation (host decides)
    w.updaters.push((dt) => {
      if (phase !== 'B' || !c.isHost || bDone) return;
      const at = Math.hypot(st.x - POST.x, st.z - POST.z) < 2.6;
      sed = Math.max(0, Math.min(1.2, sed + (at ? dt / [10, 8, 6.5][Math.min(2, bStage)] : -dt / 4)));
      sedSend -= dt; if (sedSend <= 0) { sedSend = 0.2; c.set('c5.sed', Math.min(1, sed)); }
      if (sed >= 1) { sed = 0.35; c.emit('c5:sedated'); }
    });
    c.onEvent('c5:sedated', () => {
      if (phase !== 'B') return; bk = 0; FADE.t = 3; FADE.on = true; S.static(1.2, 0.2); S.groan(0.2); lamp.pulse(1.4);
      tell('all', 'lt.c5.sedated', { priority: 2 });
      if (c.isHost) { st.noise(KLX[0].x, KLX[0].z, 24); sed = 0.3; c.set('c5.sed', 0.3); }
    });
    c.onEvent('c5:done', () => {
      if (bDone) return; bDone = true; phase = 'lounge'; strapOn = false; table.set(4); st.setActive(false); Wt.setLevel(15); Wt.all(); Wt.attention = 1;
      D.lounge.unlock(); D.lounge.setOpen(true); lamp.set(0.25); H.allLamps('dying'); Z.blackout(2.5); w.after(2.6, () => { Z.sting(0.5); S.wail(0.12); });
      tell('all', 'lt.c5.Bdone', { priority: 2 }); w.after(9, () => tell('all', 'lt.c5.lounge.go')); w.after(12, () => Z.fire('behind', { kind: 'patient', role: OP, dist: 3.4 }));
    });

    // =============================================================================================================================
    //  BEAT 6 — THE SURGEONS' LOUNGE: the photograph and the tape
    // =============================================================================================================================
    enter('lounge', { x: -19.5, y: 1, z: -37, w: 11, h: 3, d: 16 }, () => { tell('all', 'lt.c5.lounge', { priority: 2 }); w.after(8, () => tell('all', 'lt.c5.lockers')); });
    const halves = { p1: false, p2: false }; let photoDone = false;
    const showHalf = async (role) => { const { readModal } = await import('../hotel/escape-kit.js'); readModal(game, { title: 'HALF A PHOTOGRAPH', html: `<img src="${T.photoURL({ a: nm('p1'), b: nm('p2') }, { half: role === 'p1' ? 1 : -1 })}" style="width:100%;border:1px solid #333"><p><i>The other half is somewhere else.</i></p>` }); };
    for (const [role, z] of [['p1', -29.2], ['p2', -30.2]]) {
      w.interactable({ x: -24.5, y: 1.1, z, w: 0.8, h: 1.8, d: 0.62, range: 2.8, pad: 0.05, label: () => (halves[role] ? 'Look again' : `Open the locker (${nm(role)})`), enabled: () => me === role, onUse: () => { if (!halves[role]) c.emit('c5:half', { role }); else showHalf(role); } });
    }
    c.onEvent('c5:half', (a) => {
      if (halves[a.role]) return; halves[a.role] = true; S.door(0, 0.2); S.squeak(0, 0.06);
      if (a.role === me) { showHalf(me); tell(me, 'lt.c5.half', { priority: 2 }); } else tell(me, 'lt.c5.half.their', { priority: 1 });
      if (halves.p1 && halves.p2) w.after(6, () => tell('all', 'lt.c5.join'));
    });
    const tableZone = c.zone({ x: -21, y: 1, z: -33.2, w: 4.6, h: 2.5, d: 3.6, need: 'any', shrink: 0 });
    const join = holdable(w, game, HOLD, {
      x: -21, y: 1.0, z: -32.4, w: 1.8, h: 0.9, d: 0.9, range: 3, secs: 3, bar: 'FITTING THE HALVES',
      label: () => (photoDone ? 'The photograph' : tableZone.p1 && tableZone.p2 ? 'Lay the halves together (hold)' : 'Both of you must be at the table'),
      enabled: () => !photoDone && halves.p1 && halves.p2 && tableZone.p1 && tableZone.p2, onDone: () => c.emit('c5:photo'),
    });
    void join;
    c.onEvent('c5:photo', async () => {
      if (photoDone) return; photoDone = true; S.static(0.5, 0.12); H.stutter(1.2);
      const { readModal } = await import('../hotel/escape-kit.js');
      readModal(game, { title: 'STAFF · NIGHT SHIFT', html: `<img src="${T.photoURL({ a: nm('p1'), b: nm('p2') })}" style="width:100%;border:1px solid #333"><p>Two people in white coats. Lanyards. One of them is holding keys, the other a clipboard.</p><p><i>Somebody has scratched out your faces. They did it from the inside.</i></p>` });
      R.flag('ch5-photo', true); D.ward.unlock(); D.ward.setOpen(true);
      tell('all', 'lt.c5.photo', { priority: 2 });
      w.after(6, () => { R.whisper({ keyholder: 'lt.c5.whisper.k1', subject: 'lt.c5.whisper.s1' }); }); w.after(12, () => Z.partnerWrong(4)); w.after(16, () => tell('all', 'lt.c5.tapehint'));
    });
    // the tape
    let tapeChosen = false;
    const tapeIt = (label, play, x) => w.interactable({ x, y: 1.0, z: -32.6, w: 0.5, h: 0.4, d: 0.6, range: 3, pad: 0.04, label: () => (tapeChosen ? 'The recorder is still' : label), enabled: () => !tapeChosen && phase === 'lounge', onUse: () => c.emit('c5:tape', { play, who: me }) });
    tapeIt('Press PLAY on the tape', true, -22.0); tapeIt('Wipe the tape', false, -21.1);
    c.onEvent('c5:tape', (a) => {
      if (tapeChosen) return; tapeChosen = true;
      if (!a.play) { R.flag('heard-tape', false); R.flag('ch5-erased', true); S.static(1, 0.16); tell('all', 'lt.c5.erase', { priority: 2 }); w.after(7, () => tell('all', 'lt.c5.erase2')); return; }
      R.flag('heard-tape', true); recorder.setPlaying(true); S.static(0.8, 0.12); H.stutter(2);
      const lines = ['lt.c5.tape1', 'lt.c5.tape2', 'lt.c5.tape3', 'lt.c5.tape4', 'lt.c5.tape5'];
      lines.forEach((k, i) => w.after(1.5 + i * 6, () => { tell('all', k, { priority: 2 }); if (i === 2) { Z.partnerWrong(3); S.whisper(-0.8, 1.6); } if (i === 4) H.stutter(1.5); }));
      w.after(1.5 + lines.length * 6, () => { recorder.setPlaying(false); S.static(0.6, 0.14); tell('all', 'lt.c5.tape.deny', { priority: 2 }); });
      w.after(2 + lines.length * 6 + 7, () => { tell(OP1, 'lt.c5.tape.w1', { priority: 2 }); tell(TB1, 'lt.c5.tape.w2', { priority: 2 }); });
    });
    // =============================================================================================================================
    //  BEAT 7 — THE RECOVERY WARD (the hunt) AND THE LIFT
    // =============================================================================================================================
    const hunt = { on: false };
    const startHunt = () => {
      if (hunt.on) return; hunt.on = true; Z.sting(0.5); tell('all', 'lt.c5.hunt', { priority: 2 });
      if (c.isHost) { st.setActive(true); st.warp(-11, -34); st.hunt = true; st.chaseSpeed = 4.8; st.home = 'ld'; st.speed = 2.0; }
      else st.setActive(true);
    };
    enter('ward', { x: -19.5, y: 1, z: -55, w: 11, h: 3, d: 10 }, () => {
      phase = 'ward'; tell('all', 'lt.c5.ward', { priority: 2 }); w.after(8, () => tell('all', 'lt.c5.buttons')); w.after(30, startHunt); Z.stand('patient', -19.5, -69, { dur: 25 });
    });
    const held = [false, false];
    for (let i = 0; i < 2; i++) {
      holdable(w, game, HOLD, {
        x: i ? -14.0 : -25.0, y: 1.4, z: -72, w: 1.4, h: 1.2, d: 1.4, range: 3, label: 'Hold the lift call', noBar: true, enabled: () => phase === 'ward' && !liftOn,
        tick: (dt, s) => { if (s.held !== held[i]) { held[i] = s.held; c.set(`c5.hb${i}.${me}`, s.held); } if (s.held) { HOLD.show('CALLING THE LIFT', c.get('c5.lp', 0)); if (!hunt.on) startHunt(); } },
      });
    }
    let lp = 0, lpSend = 0, liftOn = false;
    const isHeld = (i) => c.get(`c5.hb${i}.p1`, false) === true || c.get(`c5.hb${i}.p2`, false) === true;
    w.updaters.push((dt) => {
      const both = phase === 'ward' && isHeld(0) && isHeld(1); liftBtn[0].lamp(isHeld(0) ? 0x3dff7a : 0xff3a2a); liftBtn[1].lamp(isHeld(1) ? 0x3dff7a : 0xff3a2a);
      if (!c.isHost || liftOn || phase !== 'ward') return;
      lp = Math.max(0, Math.min(1, lp + (both ? dt / 8 : -dt * 0.1))); lpSend -= dt; if (lpSend <= 0) { lpSend = 0.2; c.set('c5.lp', lp); }
      if (lp >= 1) c.emit('c5:lift');
    });
    c.onEvent('c5:lift', () => {
      if (liftOn) return; liftOn = true; D.lift.unlock(); D.lift.setOpen(true); st.hunt = false; st.setActive(false); S.bell(0, 0.22); S.door(0, 0.4);
      tell('all', 'lt.c5.lift', { priority: 2 }); w.after(7, () => tell('all', 'lt.c5.out'));
    });

    // =============================================================================================================================
    //  HUD + CHECKS
    // =============================================================================================================================
    w.updaters.push(() => {
      const d = st.myDist ?? 99, near = st.on ? Math.max(0, 1 - d / 22) : 0;
      UI.show(st.on && d < 26); UI.set({ prox: st.state === 'chase' ? 1 : near, hidden: !!st.hidden, torch: H.torchOn, timer: null, warn: st.state === 'chase' });
    });
    w.hooks.onComplete = () => { R.flag('ch5-done', true); };

    // =============================================================================================================================
    //  BOTS
    // =============================================================================================================================
    if (window.__noRender) {
      const hold = (hs, x, z, done, r = 1.6) => () => { if (done()) return true; if (nearP(x, z, r)) hs.it.onUse(); return false; };
      const sc = (i) => scrubbed[i];
      const gal = [{ x: 10, z: -30 }, { x: 11.6, z: -34.2, r: 0.6 }, { x: 11.6, z: -39, r: 0.6 }, { x: 11.6, z: -41.6, r: 0.6 }, { x: 4, z: -42.2 }];
      const down = [{ x: 11.6, z: -41.6, r: 0.6 }, { x: 11.6, z: -39, r: 0.6 }, { x: 11.6, z: -34.2, r: 0.6 }, { x: 9, z: -31 }];
      const downW = [{ x: -11.6, z: -41.6, r: 0.6 }, { x: -11.6, z: -39, r: 0.6 }, { x: -11.6, z: -34.2, r: 0.6 }, { x: -9, z: -31 }];
      const upW = [{ x: -10, z: -30 }, { x: -11.6, z: -34.2, r: 0.6 }, { x: -11.6, z: -39, r: 0.6 }, { x: -11.6, z: -41.6, r: 0.6 }, { x: -4, z: -42.2 }];
      const press = (b) => () => { if (!(phase === 'A' && aOn) || w.t < pressT) return false; return false; };
      void press;
      // the operator's bot answers the shared sequence (the patient's bot just waits)
      let pressT = 0;
      w.updaters.push(() => { if (me !== OP1 || phase !== 'A' || !aOn || w.t < pressT || !nearP(0, -42.2, 4)) return; pressT = w.t + 0.7; c.emit('c5:btn', { b: SEQ[aRound][aIn], who: me }); });
      let kt = 0;
      w.updaters.push(() => {
        if (w.t < kt) return;
        if (phase === 'swap1' && me === OP1 && klaxCd <= w.t && nearP(0, -42.2, 5)) { kt = w.t + 1; klaxCd = w.t + 11; c.emit('c5:klax', { i: 0 }); }
        if (phase === 'swap2' && me === OP && klaxCd <= w.t && nearP(0, -42.2, 5)) { kt = w.t + 1; klaxCd = w.t + 11; c.emit('c5:klax', { i: 0 }); }
      });
      const common = (isP1) => {
        const myScrub = isP1 ? 0 : 1;
        return [{ x: isP1 ? -4.6 : 4.6, z: 1.6, r: 0.6, until: hold(sinkH[myScrub], isP1 ? -5 : 5, 1.6, () => sc(myScrub)) }, { x: 0, z: -4 }, { x: 0, z: -9 }];
      };
      const winchRole = 'p1', fetchRole = 'p2';
      const pre = (role) => (role === winchRole
        ? [{ x: 8, z: -9 }, { x: 16.5, z: -9 }, { x: 18, z: -8.2, r: 0.7, until: () => { if (cardTaken) return true; winch.it.onUse(); return false; } }, { x: 12, z: -9.5 }]
        : [{ x: 10, z: -12 }, { x: 14, z: -14, r: 0.7 }, { x: 18, z: -14 }, { x: 23.5, z: -15.5, r: 0.8 }, { x: 23.5, z: -19, r: 0.8, until: () => { if (cardTaken) return true; if (shut.k > 0.85) cardIt.onUse(); return false; } }, { x: 18, z: -14 }, { x: 12, z: -11 }]);
      const readers = (isP1) => [{ x: isP1 ? -2.2 : 2.2, z: -20.5, r: 0.8, until: hold(rdH[isP1 ? 0 : 1], isP1 ? -2.2 : 2.2, -20.9, () => rdDone[isP1 ? 0 : 1], 1.8) }, { x: 0, z: -24, until: () => phase !== 'enter' }];
      const patientA = [{ x: 0, z: -28, r: 0.8 }, { x: 0, z: -31.2, r: 0.5, until: hold(buckle, 0, -31, () => strapOn && phase !== 'assign', 3) }, { until: () => phase === 'swap1' }, { until: () => phase === 'swap2' || !strapOn }];
      const operatorA = [{ x: 0, z: -28, r: 0.8 }, ...gal, { x: 0, z: -42.2, r: 0.7, until: () => phase === 'A' || phase === 'swap1' }];
      void upW; void downW;
      const swapPatient = [{ x: -9, z: -30, r: 0.8, until: () => !strapOn }, ...upW, { x: 0, z: -42.2, r: 0.7, until: () => phase === 'swap2' || phase === 'B' || phase === 'lounge' }];
      const swapOp = [{ x: 0, z: -42.2, r: 0.7, until: () => phase === 'swap2' }, ...down, { x: 1, z: -29.8, r: 0.6 }, { x: 0, z: -31.2, r: 0.5, until: hold(buckle, 0, -31, () => strapOn && phase === 'B', 3) }];
      const bPatient = [{ until: () => phase === 'lounge' || phase === 'ward' || bDone }];
      const bOp = [{ x: 0, z: -42.2, r: 0.7, until: () => bDone }];
      const gripBot = [];
      void gripBot;
      let bt = 0;
      w.updaters.push(() => {
        if (phase !== 'B' || bDone) return; if (w.t < bt) return; bt = w.t + 0.1;
        if (me === OP && nearP(0, -42.2, 4)) { if (bStage === 2) { /* grip is held by the patient bot below */ } lever.it.onUse(); }
        if (me === TB && bStage === 2) grip.it.onUse();
      });
      const lounge = (role) => [{ x: -11, z: -34, r: 1.0 }, { x: -15, z: -34 }, { x: -22, z: role === 'p1' ? -29.6 : -30.8, r: 0.5, until: () => { if (halves[role]) return true; if (!halves[role]) c.emit('c5:half', { role }); return halves[role]; } }, { x: -21, z: -34.6, r: 0.7, until: hold(join, -21, -32.4, () => photoDone, 2.5) }];
      const ward = (isP1) => [{ x: -19.5, z: -41 }, { x: -19.5, z: -46 }, { x: -19.5, z: -52 }, { x: -19.5, z: -62 }, { x: isP1 ? -24 : -15, z: -70.5 }, { x: isP1 ? -24.6 : -14.4, z: -71.4, r: 0.5, until: () => liftOn }, { x: -19.5, z: -75 }, { x: -19.5, z: -79.4, r: 0.6, until: () => false }];
      const tapeStep = [{ x: -21.5, z: -34.2, r: 0.7, until: () => { if (!tapeChosen && photoDone && me === 'p1') { c.emit('c5:tape', { play: true, who: me }); } return photoDone; } }];
      const role = (r) => (r === TB1 ? 'T' : 'O');
      const mk = (r) => {
        const isP1 = r === 'p1', first = role(r);
        return [
          ...common(isP1), ...(r === winchRole ? pre(r) : pre(r)), ...readers(isP1),
          ...(first === 'T' ? patientA : operatorA),
          ...(first === 'T' ? swapPatient : swapOp),
          ...(first === 'T' ? [{ x: 0, z: -42.2, r: 0.7, until: () => bDone }] : bPatient),
          ...lounge(r), ...tapeStep, ...ward(isP1),
        ];
      };
      void bOp;
      botSteps(w, { p1: mk('p1'), p2: mk('p2') });
    }
    w.after(1, () => { void 0; });
  },
};
