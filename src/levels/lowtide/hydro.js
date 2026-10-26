import * as THREE from 'three';
import { stalker } from './stalker.js';
import { scares } from './scare.js';
import { roles } from './roles.js';
import { horrorEnv, exitDoor, checkpoint, door, room, box, decal, locker, curtain, gurney, wheelchair, pipes, desk, barWindow, stencil, note, hp, wall } from './kit.js';
import { hydroEnv, tideCycle, stairs, slab, bench, tub, lifebuoy, board, numTag, bell, floater } from './hydro-kit.js';
import { stage, botSteps } from '../coop/kit.js';

// Chapter 4 — Hydrotherapy. The flooded wing. Seven beats:
//   1 Vestibule (learn the tide table)   2 Corridor C (a tide on the world clock; valve 1 needs one of you on the floor, one on a ledge)
//   3 Changing hall (two halves of one log, a locker combination, the night porter)   4 The pool hall (the Orderly wades the deck; valve 2 opens the
//   sea gate; the flood: climb)   5 The drowned corridor (torches only, a trench, a bridge that needs a hand on a crank at one end or the other)
//   6 The tide chamber (valve 3 from two ledges, the tide cycling under you, the Orderly under the ledges)   7 Out.
// Deep water is deadly but telegraphed: painted gauges with a glowing needle, a beacon, the Night Desk, and a 3 s breath bar before it kills.

const TARGET = ['14', '07', '22', '03'];                       // locker order (P1 knows places 1 and 3, P2 places 2 and 4)
const TAGS = ['03', '07', '11', '14', '19', '22', '26', '31'];
const FLOOD = { rise: 46, hold: 26, fall: 40, base: 0.35, peak: 4.6 };
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

export default {
  id: 'lowtide4',
  name: 'Hydrotherapy',
  music: 'l1',
  horror: true,
  deathRule: 'self',
  completeQuip: 'Hydrotherapy complete. Please towel off. Please do not look at the water.',
  titleCam: { center: [0, 2, -60], radius: 22, height: 10 },

  build(w, game) {
    const H = horrorEnv(w, game, { fogColor: 0x061110, density: 0.05, ambientSky: 0x2c4c52, ambient: 0.5 });
    const c = w.coop, me = c.me;
    const HY = hydroEnv(w, game, H);
    const R = roles(w, game);
    const Z = scares(w, game, H, H.S);
    w.spawn = { x: me === 'p1' ? -2.2 : 2.2, y: 0, z: 2.5, yaw: 0 };
    w.respawn = { ...w.spawn };
    const tell = (r, k, o) => c.tell(r, k, o);
    const done = (id) => () => c.get('v:' + id, false);
    const fireH = (id, arg) => { if (c.isHost) Z.fire(id, arg); };         // events go out once (from the host), every machine renders its own
    const tiled = { floorKind: 'tile', wallKind: 'tile' };

    // =========================================================================================================================
    // 1 · VESTIBULE
    // =========================================================================================================================
    room(w, { x: 0, z: -1, w: 12, d: 10, h: 4.8, doors: { n: [{ c: 0, w: 2.6 }] }, ...tiled });
    stencil(w, 'CHAPTER 4', { x: 0, y: 3.55, z: -5.83, rot: 0, size: 0.3, width: 3.4 });
    stencil(w, 'HYDROTHERAPY', { x: 0, y: 2.95, z: -5.83, rot: 0, size: 0.27, width: 4.2 });
    board(w, { x: -5.82, y: 1.95, z: -1.2, rot: Math.PI / 2, title: 'TIDE TABLE · C', lines: ['LOW ........ 28 s', 'RISING ..... 10 s', '!HIGH ........ 8 s', 'FALLING .... 10 s', '!NEVER AT HIGH WATER'] });
    bench(w, { x: -4.6, z: 2.2, rot: Math.PI / 2 }); bench(w, { x: 4.6, z: 0.4, rot: Math.PI / 2 });
    lifebuoy(w, { x: 5.82, y: 2.2, z: -3.4, rot: -Math.PI / 2 }); lifebuoy(w, { x: -5.82, y: 2.2, z: 3, rot: Math.PI / 2 });
    wheelchair(w, { x: 3.2, z: -3.2, rot: 2.6 });
    pipes(w, { x0: -5.4, z0: 3.8, x1: -5.4, z1: -5.5, y: 4.2, n: 2 });
    decal(w, { kind: 'puddle', seed: 4, x: -1.2, y: 0.025, z: -2.4, w: 2.8, h: 2.8 }); decal(w, { kind: 'drag', seed: 2, x: 0.6, y: 0.02, z: -4.6, w: 3, h: 2.4, face: 'floor', rot: 1.5 });
    decal(w, { kind: 'hand', seed: 9, x: 5.82, y: 1.0, z: 1.6, w: 0.5, h: 0.5, face: 'w' });
    H.lamp({ x: -2, y: 4.75, z: 0, mode: 'buzz', len: 1.3 }); H.lamp({ x: 2.5, y: 4.75, z: -3.5, mode: 'dying' });
    HY.drip(-5.3, 4.3, -0.5, 2.5); HY.drip(1.2, 4.7, 2.6, 4);
    checkpoint(w, { x: 0, z: -4.4 });

    // =========================================================================================================================
    // 2 · CORRIDOR C — the tide on the world clock
    // =========================================================================================================================
    room(w, { x: 0, z: -23, w: 6, d: 34, h: 4.8, sides: { s: false, n: false }, ...tiled });
    const W1 = HY.water({ x: 0, z: -23, w: 5.7, d: 33.7, level: (t) => tideCycle(t, { lo: 0.12, hi: 2.05, period: 56, off: 4 }), height: 4.8, flecks: 90 });
    for (const z of [-11, -19, -27, -35]) H.lamp({ x: 0, y: 4.75, z, mode: ['buzz', 'dead', 'dying', 'buzz'][(-z - 11) / 8], len: 1.5, rot: Math.PI / 2 });
    pipes(w, { x0: -2.2, z0: -7, x1: -2.2, z1: -39, y: 4.4, n: 2 });
    HY.gauge({ x: -2.85, z: -9, rot: Math.PI / 2, h: 3, water: W1 }); HY.gauge({ x: 2.85, z: -22, rot: -Math.PI / 2, h: 3, water: W1 }); HY.gauge({ x: -2.85, z: -30, rot: Math.PI / 2, h: 3, water: W1 });
    HY.beacon({ x: 0, y: 4.45, z: -7.5, water: W1 }); HY.beacon({ x: 0, y: 4.45, z: -36, water: W1 });
    for (const z of [-14, -26, -34]) stencil(w, 'DEEP · NO AIR', { x: -2.84, y: 2.05, z, rot: Math.PI / 2, color: '#a8342a', width: 2.2 });
    decal(w, { kind: 'scratch', seed: 3, x: 2.84, y: 3.0, z: -30, w: 1.4, h: 1.4, face: 'e' });
    decal(w, { kind: 'hand', seed: 6, x: -2.84, y: 3.3, z: -24, w: 0.5, h: 0.5, face: 'w' });
    // ledges (dry pockets above the highest tide) on the east wall
    stairs(w, { x: 1.95, z: -8.2, dir: '-z', y0: 0, y1: 2.4, width: 1.8 }); slab(w, { x: 1.95, z: -15.45, y: 2.4, w: 1.8, d: 7.1, h: 0.4 });
    stairs(w, { x: 1.95, z: -24, dir: '-z', y0: 0, y1: 2.4, width: 1.8 }); slab(w, { x: 1.95, z: -32.6, y: 2.4, w: 1.8, d: 9.8, h: 0.4 });
    for (const [z0, z1] of [[-12, -19], [-28, -37.5]]) for (let z = z0; z > z1; z -= 2.2) box(w, { x: 2.78, y: 3.0, z, w: 0.05, h: 0.9, d: 0.05, kind: 'rust', color: 0x55605c, shadow: false });   // rail posts (decor)
    const floaterGeo = new THREE.BoxGeometry(0.5, 0.06, 0.34);
    const clip = (x, z) => floater(w, W1, new THREE.Mesh(floaterGeo, new THREE.MeshStandardMaterial({ color: 0xcfc8b0, roughness: 0.9 })), { x, z, lo: 0.0 });
    clip(-1, -15); clip(0.8, -29);
    HY.drip(-1.0, 4.6, -16, 2.6); HY.drip(1.4, 4.6, -25, 3.4); HY.drip(-0.6, 4.6, -33, 2.2);

    const V1 = HY.valve({
      id: 'v1', secs: 10, hint: 'lt.c4.v1.one',
      a: { x: -1.6, y: 0, z: -35.5, text: 'VALVE 1 · FLOOR', rot: Math.PI / 2 },
      b: { x: 1.95, y: 2.4, z: -34.5, text: 'VALVE 1 · LEDGE', rot: -Math.PI / 2 },
      onDone: () => { D1.unlock(); w.after(0.8, () => D1.setOpen(true)); H.S.door(0, 0.3); tell('all', 'lt.c4.v1.done', { priority: 2 }); },
    });
    void V1;
    const D1 = door(w, { x: 0, z: -40, along: 'x', width: 2.4, h: 2.5, key: 'v1d', locked: true, label: 'bulkhead door' });

    // narration + the first sight of the sea under the glass
    let seenWarn = 0, wasWarn = 0;
    w.updaters.push(() => { if (W1.warn && !wasWarn) { seenWarn++; if (seenWarn <= 3) tell('all', seenWarn === 1 ? 'lt.c4.tide.warn' : 'lt.c4.tide.warn2', { priority: 1 }); } wasWarn = W1.warn; });
    let patient = false;
    w.updaters.push(() => { if (patient || W1.y < 1.9) return; const g = game.player, P = c.partner; if (!(g.z < -9 || (P.has && P.sz < -9))) return; patient = true; Z.stand('patient', -0.8, -26.5, { dur: 14 }); Z.knock({ n: 3 }); });
    stage(w, 'c-in', { x: 0, y: 1, z: -9, w: 6, h: 3, d: 1.4 }, () => tell('all', 'lt.c4.gauge', { priority: 1 }));
    stage(w, 'c-valve', { x: 0, y: 1, z: -31, w: 6, h: 3, d: 1.4 }, () => tell('all', 'lt.c4.v1.hold', { priority: 1 }));

    // =========================================================================================================================
    // 3 · CHANGING HALL — two halves of one log, a locker order, the night porter
    // =========================================================================================================================
    room(w, { x: 0, z: -52, w: 22, d: 24, h: 4.8, doors: { s: [{ c: 0, w: 2.4 }] }, sides: { n: false }, ...tiled });
    checkpoint(w, { x: -1.2, z: -42 });
    for (const [x, z, m] of [[-6, -46, 'buzz'], [5, -49, 'dying'], [-5, -57, 'dead'], [4, -59, 'buzz'], [0, -53, 'buzz']]) H.lamp({ x, y: 4.75, z, mode: m, len: 1.4 });
    pipes(w, { x0: -10.4, z0: -41, x1: -10.4, z1: -63, y: 4.3, n: 3 });
    // lockers on the east wall carry the combination tags
    const lockerZ = (i) => -43.5 - i * 1.35;
    const lockerState = { seq: [] };
    const D2 = door(w, { x: 0, z: -64, along: 'x', width: 2.6, h: 2.5, key: 'poold', locked: true, label: 'pool door' });
    for (let i = 0; i < 8; i++) {
      locker(w, { x: 10.55, z: lockerZ(i), rot: -Math.PI / 2, ajar: 0, color: [0x5d6b66, 0x566660, 0x66705f][i % 3] });
      numTag(w, { x: 10.255, z: lockerZ(i), rot: -Math.PI / 2, text: TAGS[i] });
      w.interactable({
        x: 9.95, y: 1.3, z: lockerZ(i), w: 0.5, h: 1.0, d: 1.1, range: 2.8, label: () => `Open locker ${TAGS[i]}`,
        onUse: () => {
          if (c.get('lk:ok', false)) return;
          const cur = c.get('lk', []), tag = TAGS[i];
          if (cur.includes(tag)) return;
          const nxt = [...cur, tag];
          if (nxt.every((v, k) => v === TARGET[k])) { c.set('lk', nxt); H.S.door(0.6, 0.12); if (nxt.length === TARGET.length) c.set('lk:ok', true); }
          else { c.set('lk', []); c.emit('lk:bad', { z: lockerZ(i) }); }
        },
      });
    }
    c.onEvent('lk:bad', (m) => { H.S.slam(0.35); H.stutter(0.8); tell('all', 'lt.c4.lk.bad', { priority: 2 }); st1.noise(10, m?.z ?? -48, 14); });
    c.on('lk', (v) => { lockerState.seq = v || []; });
    c.on('lk:ok', (v) => { if (!v) return; D2.unlock(); w.after(0.6, () => D2.setOpen(true)); H.S.door(0, 0.3); tell('all', 'lt.c4.lk.ok', { priority: 2 }); R.whisper({ keyholder: 'lt.c4.whisper.k1', subject: 'lt.c4.whisper.s1' }); });
    // the attendant's log, in two halves
    desk(w, { x: -8.4, z: -44.4, rot: Math.PI / 2 });
    note(w, game, {
      x: -8.4, y: 0.9, z: -44.4, rot: Math.PI / 2, title: 'ATTENDANT LOG', label: 'Read the log',
      html: {
        p1: '<p><b>ATTENDANT LOG · page 1 of 2</b></p><p>The plunge key is kept in the lockers by the east wall. It only comes out in the right order, and the order is written in two hands.</p><p>Press <b>FIRST</b> the locker tagged <b>14</b>.<br>Press <b>THIRD</b> the locker tagged <b>22</b>.</p><p><i>Your partner holds the other page. Read it aloud. The wrong locker wakes the night porter.</i></p>',
        p2: '<p><b>ATTENDANT LOG · page 2 of 2</b></p><p>The plunge key is kept in the lockers by the east wall. It only comes out in the right order, and the order is written in two hands.</p><p>Press <b>SECOND</b> the locker tagged <b>07</b>.<br>Press <b>LAST</b> the locker tagged <b>03</b>.</p><p><i>Your partner holds the other page. Read it aloud. The wrong locker wakes the night porter.</i></p>',
      },
      onRead: () => tell('all', 'lt.c4.notes', { priority: 1 }),
    });
    bench(w, { x: -3, z: -62, rot: 0, len: 2.4 });
    if (me === R.keyholder) note(w, game, { x: -3, y: 0.62, z: -62, rot: 0.2, title: 'STAFF MEMO', label: 'Read the staff memo', html: '<p><b>STAFF ONLY</b></p><p>Keep the patient away from the sluice. If they ask why the tide is higher each year, tell them it has always been this high. Do not let them read the wall.</p><p>You know which of you this is for.</p>' });
    else note(w, game, { x: 9.9, y: 1.2, z: -60.5, rot: -Math.PI / 2, title: 'SCRATCHED INTO THE TILE', label: 'Read the scratches', html: '<p>I counted the drips. They do not fall at the same speed on your side.</p><p>The one with the key says it is for my own good. The one with the key has my handwriting.</p>' });
    // tubs, benches, stalls
    tub(w, { x: -1.6, z: -53.5, rot: 0 }); tub(w, { x: 1.6, z: -55.5, rot: 0 });
    for (let i = 0; i < 3; i++) curtain(w, { x: -9.5, z: -56 - i * 2.9, width: 2.5, rot: 0, open: i === 1 ? 0.5 : 0 });
    box(w, { x: -9.6, y: 3.3, z: -59, w: 2.4, h: 0.05, d: 8.8, kind: 'rust', color: 0x70807a, shadow: false });
    gurney(w, { x: 7.2, z: -57, rot: 1.4 });
    curtain(w, { x: 9.3, z: -62, width: 2.6, rot: 0 }); curtain(w, { x: 8.0, z: -60.7, width: 2.6, rot: Math.PI / 2 });
    bench(w, { x: 4, z: -43, rot: 0, len: 2.6 });
    decal(w, { kind: 'puddle', seed: 7, x: 2, y: 0.025, z: -47, w: 3.2, h: 3.2 }); decal(w, { kind: 'drag', seed: 5, x: -2, y: 0.02, z: -58.4, w: 3.6, h: 2.6, face: 'floor', rot: 0.4 });
    decal(w, { kind: 'splat', seed: 2, x: 7, y: 0.02, z: -52, w: 2.4, h: 2.4 }); decal(w, { kind: 'hand', seed: 4, x: 10.85 - 0.05, y: 1.2, z: -57, w: 0.5, h: 0.5, face: 'e' });
    decal(w, { kind: 'scratch', seed: 8, x: -10.84, y: 1.6, z: -48, w: 1.5, h: 1.5, face: 'w' });
    stencil(w, 'CHANGING · MEN AND WOMEN', { x: -10.84, y: 3.3, z: -49, rot: Math.PI / 2, size: 0.17, width: 3.4 });
    barWindow(w, { x: -10.83, y: 2.3, z: -46.5, rot: Math.PI / 2 });
    HY.drip(-1.6, 4.6, -53.5, 2.4); HY.drip(5, 4.7, -45, 3.5);
    // the night porter
    const slow1 = () => 1;
    const st1 = stalker(w, game, H, H.S, {
      nodes: [{ id: 'a', x: -6, z: -47 }, { id: 'b', x: -6, z: -62 }, { id: 'c', x: 0, z: -62 }, { id: 'd', x: 6, z: -62 }, { id: 'e', x: 6, z: -49 }],
      route: ['a', 'b', 'c', 'd', 'e'], start: 'c', speed: 1.8, chaseSpeed: 5.6, sight: 13, fov: 0.85, slow: slow1, pause: 2.2,
    });
    st1.setActive(false);
    st1.hideSpot({ x: -9.7, z: -59.2, w: 2.4, d: 8.2 }); st1.hideSpot({ x: 9.2, z: -61.6, w: 2.6, d: 2.6 });
    const bucketPos = { x: 5.5, z: -44.5 };
    w.interactable({ x: bucketPos.x, y: 0.5, z: bucketPos.z, w: 0.6, h: 0.7, d: 0.6, range: 3, label: 'Kick the bucket', onUse: () => { H.S.slam(0.25); st1.noise(bucketPos.x, bucketPos.z, 16); } });
    box(w, { x: bucketPos.x, y: 0.22, z: bucketPos.z, w: 0.35, h: 0.45, d: 0.35, kind: 'rust', color: 0x6a736d });
    stage(w, 'hall-in', { x: 0, y: 1, z: -42, w: 22, h: 3, d: 2 }, () => { tell('all', 'lt.c4.hall', { priority: 1 }); w.after(70, () => fireH('behind', { kind: 'patient', role: 'all', dist: 3.4 })); });

    // =========================================================================================================================
    // 4 · THE POOL HALL — the Orderly on the deck, the sea gate, the flood
    // =========================================================================================================================
    const hall = room(w, { x: 0, z: -88, w: 36, d: 48, h: 9.5, doors: { s: [{ c: 0, w: 2.6 }] }, sides: { n: false }, ...tiled });
    hall.floor.body.enabled = false; hall.floor.group.visible = false;
    const deck = (x, z, ww, d) => hp(w, { x, z, y: 0, w: ww, d, h: 3.5, kind: 'tile', color: 0xb4c6be, rough: 0.8, bump: 1.2, path: false });
    deck(0, -71, 36, 14); deck(-13.5, -89, 9, 22); deck(13.5, -89, 9, 22); deck(0, -106, 36, 12);
    hp(w, { x: 0, z: -89, y: -2.6, w: 18, d: 22, h: 1.2, kind: 'tile', color: 0x5d706b, rough: 0.7, bump: 1.4, path: false });
    // the north wall: solid up to the gantry, a doorway above it
    wall(w, { x: 0, z: -112, w: 36, d: 0.3, y: 0, h: 5, kind: 'tile' });
    wall(w, { x: -9.65, z: -112, w: 16.7, d: 0.3, y: 5, h: 4.5, kind: 'tile' }); wall(w, { x: 9.65, z: -112, w: 16.7, d: 0.3, y: 5, h: 4.5, kind: 'tile' }); wall(w, { x: 0, z: -112, w: 2.6, d: 0.3, y: 7.6, h: 1.9, kind: 'tile' });
    box(w, { x: -1.4, y: 6.3, z: -111.85, w: 0.14, h: 2.6, d: 0.4, kind: 'rust', color: 0x7a8a86 }); box(w, { x: 1.4, y: 6.3, z: -111.85, w: 0.14, h: 2.6, d: 0.4, kind: 'rust', color: 0x7a8a86 });
    // pit stairs, the tower, the gantry, the east flight
    stairs(w, { x: -7.5, z: -78, dir: '-z', y0: 0, y1: -2.2, width: 3 }); stairs(w, { x: 7.5, z: -100, dir: '+z', y0: 0, y1: -2.2, width: 3 });
    stairs(w, { x: -16.8, z: -83, dir: '-z', y0: 0, y1: 3, width: 2.4 }); slab(w, { x: -15.93, z: -92, y: 3, w: 3.85, d: 8, h: 0.5 });
    stairs(w, { x: -16.8, z: -96, dir: '-z', y0: 3, y1: 5, width: 2.4 }); slab(w, { x: -15.93, z: -103.05, y: 5, w: 3.85, d: 7.9, h: 0.5 });
    slab(w, { x: 0, z: -109.5, y: 5, w: 35.7, d: 5, h: 0.5 });
    stairs(w, { x: 16.5, z: -90, dir: '-z', y0: 0, y1: 5, width: 2.4 }); slab(w, { x: 16.575, z: -102.5, y: 5, w: 2.55, d: 8.9, h: 0.5 });
    for (let x = -16; x <= 16; x += 2) box(w, { x, y: 5.55, z: -107.1, w: 0.06, h: 1.1, d: 0.06, kind: 'rust', color: 0x55605c, shadow: false });
    box(w, { x: 0, y: 6.05, z: -107.1, w: 35, h: 0.05, d: 0.05, kind: 'rust', color: 0x55605c, shadow: false });
    // rim stripes, pillars, gauges
    const pillar = (x, z) => hp(w, { x, z, y: 9.4, w: 1.1, d: 1.1, h: 10.4, kind: 'tile', color: 0xa8bab2, rough: 0.8, path: false });
    for (const z of [-74, -86, -98]) { pillar(-12.5, z); pillar(12.5, z); }
    for (const [x, z, col] of [[-9.15, -78.2], [9.15, -78.2], [-9.15, -99.8], [9.15, -99.8]]) { void col; box(w, { x, y: 0.02, z, w: 0.3, h: 0.04, d: 4, kind: 'rust', color: 0x9a2a22, shadow: false }); }
    box(w, { x: 0, y: 0.02, z: -78.15, w: 18.3, h: 0.04, d: 0.3, kind: 'rust', color: 0x9a2a22, shadow: false }); box(w, { x: 0, y: 0.02, z: -99.85, w: 18.3, h: 0.04, d: 0.3, kind: 'rust', color: 0x9a2a22, shadow: false });
    const W2 = HY.water({
      x: 0, z: -88, w: 35.7, d: 47.7, height: 9, flecks: 170, caustics: 2.0,
      level: (t) => {
        const f = c.get('flood', null);
        if (f == null || t < f) return { y: FLOOD.base + Math.sin(t * 0.5) * 0.015, warn: 0 };
        const u = t - f;
        if (u < FLOOD.rise) return { y: FLOOD.base + (FLOOD.peak - FLOOD.base) * smooth(u / FLOOD.rise), warn: 1 };
        if (u < FLOOD.rise + FLOOD.hold) return { y: FLOOD.peak, warn: 1 };
        const k = (u - FLOOD.rise - FLOOD.hold) / FLOOD.fall;
        return { y: FLOOD.peak - (FLOOD.peak - FLOOD.base) * smooth(k), warn: k < 1 ? 1 : 0 };
      },
    });
    for (const z of [-74, -86, -98]) { HY.gauge({ x: -11.95, z, rot: Math.PI / 2, h: 5.6, water: W2, lethal: 1.7 }); HY.gauge({ x: 11.95, z, rot: -Math.PI / 2, h: 5.6, water: W2, lethal: 1.7 }); }
    HY.gauge({ x: 0, z: -111.82, rot: 0, h: 5.4, water: W2, lethal: 1.7, floorY: 0 });
    for (const [x, z] of [[-12.5, -80], [12.5, -80], [-12.5, -92], [12.5, -92]]) HY.beacon({ x, y: 7.2, z, water: W2 });
    for (const [x, z] of [[-17.84, -74], [17.84, -74], [-17.84, -97], [17.84, -97]]) stencil(w, 'DEEP END · NO AIR', { x, y: 1.9, z, rot: x < 0 ? Math.PI / 2 : -Math.PI / 2, color: '#a8342a', width: 3.6 });
    stencil(w, 'POOL NO. 1', { x: 0, y: 6.5, z: -64.2, rot: 0, size: 0.3, width: 4 });
    for (const [x, z, m, sh] of [[-9, -70, 'buzz', false], [9, -72, 'dying', false], [0, -82, 'dead', false], [-8, -94, 'buzz', false], [8, -96, 'dying', false], [0, -104, 'dead', false], [-14, -104, 'buzz', false], [14, -108, 'dying', false]]) H.lamp({ x, y: 9.4, z, mode: m, len: 1.8, shaft: sh });
    H.lamp({ x: 0, y: 4.75, z: -66, mode: 'steady', len: 1.5, rot: Math.PI / 2 });
    tub(w, { x: -14.5, z: -72.5, rot: 0 }); tub(w, { x: 14.5, z: -72.5, rot: 0 }); gurney(w, { x: 11.5, z: -83, rot: 0.3 }); wheelchair(w, { x: -11.2, z: -81, rot: 1.8 });
    lifebuoy(w, { x: -17.8, y: 2.6, z: -80, rot: Math.PI / 2 }); lifebuoy(w, { x: 17.8, y: 2.6, z: -86, rot: -Math.PI / 2 });
    decal(w, { kind: 'drag', seed: 11, x: 5, y: 0.02, z: -73, w: 6, h: 3, face: 'floor', rot: 0.3 }); decal(w, { kind: 'splat', seed: 12, x: -3, y: 0.02, z: -104, w: 3, h: 3 });
    decal(w, { kind: 'hand', seed: 14, x: 17.84, y: 1.0, z: -90, w: 0.5, h: 0.5, face: 'e' });
    const hallClip = new THREE.BoxGeometry(0.5, 0.06, 0.34);
    for (const [x, z] of [[-4, -72], [6, -75], [12, -90], [-12, -100]]) floater(w, W2, new THREE.Mesh(hallClip, new THREE.MeshStandardMaterial({ color: 0xcfc8b0, roughness: 0.9 })), { x, z });
    for (const [x, z] of [[-6, -84], [6, -92], [0, -89], [-3, -95]]) HY.drip(x, 9.2, z, 2.4);
    checkpoint(w, { x: -3, z: -66.8 });
    // the stalker: wades the deck round the pit
    const pitBox = { x: 0, z: -89, hx: 9.2, hz: 11.2, hy: 2, top: 1, enabled: true };
    const st2 = stalker(w, game, H, H.S, {
      nodes: [{ id: 's0', x: 0, z: -76 }, { id: 'w0', x: -13.5, z: -75 }, { id: 'w1', x: -13.5, z: -84 }, { id: 'w2', x: -13.5, z: -97 }, { id: 'w3', x: -13.5, z: -106 }, { id: 'n0', x: 0, z: -106 }, { id: 'e3', x: 13.5, z: -106 }, { id: 'e2', x: 13.5, z: -97 }, { id: 'e1', x: 13.5, z: -84 }, { id: 'e0', x: 13.5, z: -75 }],
      route: ['s0', 'w0', 'w1', 'w2', 'w3', 'n0', 'e3', 'e2', 'e1', 'e0'], start: 'e1', speed: 2.0, chaseSpeed: 5.6, sight: 18, fov: 0.95, pause: 2.4, extra: [pitBox],
      slow: (x, z) => { void z; return 1 / (1 + Math.max(0, W2.y - 0) * 0.55); },
    });
    st2.setActive(false);
    st2.hideSpot({ x: -15.9, z: -92, w: 3.6, d: 7.6 }); st2.hideSpot({ x: 15.4, z: -78, w: 3, d: 3 });
    // the bells: he always answers a bell
    const ringBell = (g, x, z) => { g.userData.ring(); H.S.slam(0.28); H.S.squeak(0, 0.04); st2.noise(x, z, 20); st1.noise(x, z, 4); };
    const b1 = bell(w, { x: -17.3, y: 2.35, z: -70, label: 'Ring the pool bell', onRing: () => ringBell(b1, -14, -71) });
    const b2 = bell(w, { x: -17.3, y: 4.45, z: -95.2, label: 'Ring the tower bell', onRing: () => ringBell(b2, -14, -96) });
    box(w, { x: -17.6, y: 2.35, z: -70, w: 0.5, h: 0.08, d: 0.08, kind: 'rust', color: 0x55605c }); box(w, { x: -17.6, y: 4.5, z: -95.2, w: 0.5, h: 0.08, d: 0.08, kind: 'rust', color: 0x55605c });
    // valve 2: the deck is the exposed station, the tower the safe one
    const V2 = HY.valve({
      id: 'v2', secs: 12, hint: 'lt.c4.v2.one',
      a: { x: -15.9, y: 3, z: -92, text: 'SEA GATE · TOWER', rot: Math.PI / 2 },
      b: { x: 13.4, y: 0, z: -93, text: 'SEA GATE · DECK', rot: -Math.PI / 2 },
      onDone: () => {
        if (c.isHost && c.get('flood', null) == null) c.set('flood', w.t);
        w.respawn = { x: 0, y: 5.05, z: -108.5, yaw: 0 };
        R.flag('ch4-flood', true);
        fireH('sting', { vol: 0.6, role: 'all' }); H.S.groan(0.3); Z.knock({ n: 3 });
        tell('all', 'lt.c4.flood', { priority: 2 });
        st2.noise(13.4, -93, 40);
      },
    });
    void V2;
    // depth call-outs while the sea comes in
    const calls = [[1.0, 'lt.c4.depth1'], [2.2, 'lt.c4.depth2'], [3.4, 'lt.c4.depth3']]; let ci = 0;
    w.updaters.push(() => { if (c.get('flood', null) == null) return; while (ci < calls.length && W2.y >= calls[ci][0]) { tell('all', calls[ci][1], { priority: 2 }); ci++; } });
    stage(w, 'pool-in', { x: 0, y: 1, z: -66, w: 36, h: 3, d: 2 }, () => { tell('all', 'lt.c4.pool', { priority: 1 }); w.after(14, () => tell('all', 'lt.c4.bell', { priority: 1 })); });
    stage(w, 'pool-v2', { x: 0, y: 1, z: -84, w: 36, h: 3, d: 2 }, () => tell('all', 'lt.c4.v2.hold', { priority: 1 }));

    // =========================================================================================================================
    // 5 · THE TUNNEL AND THE DROWNED CORRIDOR — torches only
    // =========================================================================================================================
    room(w, { x: 0, z: -118, w: 5.2, d: 12, h: 8.4, sides: { s: false, n: false }, ...tiled });
    slab(w, { x: 0, z: -113.05, y: 5, w: 4.7, d: 2.1, h: 0.5 });
    stairs(w, { x: 0, z: -114.05, dir: '-z', y0: 5, y1: 0.4, width: 4.7, base: -1 });
    H.lamp({ x: 0, y: 8.35, z: -116, mode: 'dying', len: 1.2, shaft: false }); H.lamp({ x: 0, y: 8.35, z: -121, mode: 'dead', len: 1.2, shaft: false });
    pipes(w, { x0: -2, z0: -113, x1: -2, z1: -124, y: 7.6, n: 2 });
    decal(w, { kind: 'scratch', seed: 5, x: -2.44, y: 4.2, z: -118, w: 1.6, h: 1.6, face: 'w' });
    checkpoint(w, { x: 0, y: 5, z: -113.1 });
    stage(w, 'tunnel', { x: 0, y: 5.5, z: -116, w: 5, h: 3, d: 1.5 }, () => { R.whisper({ keyholder: 'lt.c4.whisper.k2', subject: 'lt.c4.whisper.s2' }); });

    const corridor = room(w, { x: 0, z: -147, w: 5.2, d: 46, h: 3.8, doors: { w: [{ c: 15, w: 2.4 }, { c: -17, w: 2.4 }], e: [{ c: 6, w: 2.4 }] }, sides: { s: false, n: false }, ...tiled });
    corridor.floor.body.enabled = false; corridor.floor.group.visible = false;
    const cdeck = (z, d) => hp(w, { x: 0, z, y: 0, w: 5.2, d, h: 3.5, kind: 'tile', color: 0x9db0a8, rough: 0.8, bump: 1.2, path: false });
    cdeck(-137, 26); cdeck(-163, 14);
    hp(w, { x: 0, z: -153, y: -3, w: 5.2, d: 6, h: 1.2, kind: 'tile', color: 0x44544f, rough: 0.7, path: false });
    stairs(w, { x: -1.65, z: -150, dir: '-z', y0: 0, y1: -2.6, width: 1.6 }); stairs(w, { x: 1.65, z: -156, dir: '+z', y0: 0, y1: -2.6, width: 1.6 });
    const W3 = HY.water({ x: 0, z: -147, w: 4.9, d: 45.7, height: 3.8, flecks: 80, caustics: 2.6, level: (t) => ({ y: 1.45 + Math.sin(t * 0.4) * 0.05 + Math.sin(t * 0.93) * 0.02, warn: 0 }) });
    // the pockets: dry ledges above the water cut into the corridor walls (air to breathe, a place to stand still in the dark)
    const pocket = (side, z) => {
      const xc = side * (2.45 + 1.7);
      slab(w, { x: xc, z, y: 1.6, w: 3.4, d: 2.6, h: 3.4, kind: 'tile', color: 0x8a9c94 });
      wall(w, { x: side * 6.0, z, w: 0.3, d: 3.0, y: 1.6, h: 2.2, kind: 'tile' });
      wall(w, { x: xc, z: z - 1.4, w: 3.4, d: 0.3, y: 1.6, h: 2.2, kind: 'tile' }); wall(w, { x: xc, z: z + 1.4, w: 3.4, d: 0.3, y: 1.6, h: 2.2, kind: 'tile' });
      box(w, { x: xc, y: 3.95, z, w: 3.8, h: 0.3, d: 3.2, kind: 'concrete', shadow: false });
      stairs(w, { x: side * 2.45, z, dir: side < 0 ? '+x' : '-x', y0: 1.6, y1: 0.4, width: 1.6, step: 0.4, run: 0.25, base: -1 });
      H.lamp({ x: xc, y: 3.75, z, mode: 'dead', len: 0.8, shaft: false });
    };
    // pockets: west at z=-132, east at z=-141, west at z=-164
    pocket(-1, -132); pocket(1, -141); pocket(-1, -164);
    // flotsam, torchlit gloom
    const flotGeo = new THREE.BoxGeometry(0.6, 0.12, 0.4);
    for (const [x, z] of [[-0.8, -128], [0.9, -135], [-0.5, -139], [0.6, -143], [0.3, -161], [-0.9, -167]]) floater(w, W3, new THREE.Mesh(flotGeo, new THREE.MeshStandardMaterial({ color: [0x8a8670, 0x5b3a30, 0x7a7e7a][((-z) | 0) % 3], roughness: 0.95 })), { x, z, bob: 0.05, lo: -0.02 });
    const chair = new THREE.Group(); { const m = new THREE.MeshStandardMaterial({ color: 0x2b1d16, roughness: 0.7 }); const s = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.45), m); s.position.y = 0.5; chair.add(s); const b = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.05), m); b.position.set(0, 0.8, -0.2); chair.add(b); }
    floater(w, W3, chair, { x: 0.4, z: -150.2, bob: 0.04, lo: -0.45 });
    HY.gauge({ x: -2.45, z: -126, rot: Math.PI / 2, h: 3, water: W3, lethal: 1.7 }); HY.gauge({ x: 2.45, z: -166, rot: -Math.PI / 2, h: 3, water: W3, lethal: 1.7 });
    for (let z = -128; z > -170; z -= 7) { HY.drip(-1.2 + (z % 3) * 0.3, 3.7, z, 2.2); }
    decal(w, { kind: 'hand', seed: 21, x: -2.44, y: 2.5, z: -128, w: 0.5, h: 0.5, face: 'w' }); decal(w, { kind: 'scratch', seed: 22, x: 2.44, y: 2.6, z: -146, w: 1.3, h: 1.3, face: 'e' });
    stencil(w, 'STAFF ONLY · NO LIGHTS', { x: 2.44, y: 2.7, z: -127, rot: -Math.PI / 2, size: 0.16, width: 3.2, color: '#a8342a' });
    H.lamp({ x: 0, y: 3.75, z: -169, mode: 'dying', len: 1.0, shaft: false, power: 0.8 });
    // the bridge: it extends while ANYONE holds a crank at either end
    const bridge = hp(w, { x: 0, z: -153, y: 0, w: 1.5, d: 6.1, h: 3.5, kind: 'rust', color: 0x5d6b66, rough: 0.6, bump: 1.6, path: false, moving: true });
    const edgeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 1.3), toneMapped: false });
    for (const sx of [-0.7, 0.7]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 6.0), edgeM); e.position.set(sx, 1.76, 0); bridge.group.add(e); }
    const crankN = HY.station({ x: -1.6, y: 0, z: -144.5, text: 'CRANK · NEAR', rot: Math.PI / 2 }), crankS = HY.station({ x: 1.6, y: 0, z: -161.5, text: 'CRANK · FAR', rot: -Math.PI / 2 });
    const BR = { k: 0, base: bridge.base.y };
    w.updaters.push((dt) => {
      const want = crankN.zone.active || crankS.zone.active;
      const was = BR.k;
      BR.k += Math.sign((want ? 1 : 0) - BR.k) * Math.min(Math.abs((want ? 1 : 0) - BR.k), dt / (want ? 1.3 : 2.6));
      bridge.setPos(0, BR.base - (1 - BR.k) * 3.05, -153); bridge.body.enabled = BR.k > 0.04;
      for (const s of [crankN, crankS]) { s.wheel.rotation.z += dt * (s.zone.active ? 2.4 : 0); s.padM.color.setHex(0xffb040).multiplyScalar(s.zone.active ? 1.8 : 0.8); s.setProg(BR.k); }
      if (Math.abs(BR.k - was) > 1e-4 && want) { BR.snd = (BR.snd || 0) - dt; if (BR.snd <= 0) { BR.snd = 0.9; H.S.groan(0.08); } }
    });
    stage(w, 'dc-in', { x: 0, y: 0, z: -127, w: 5, h: 3, d: 1.5 }, () => { tell('all', 'lt.c4.drowned', { priority: 1 }); });
    stage(w, 'dc-crank', { x: 0, y: 0, z: -142, w: 5, h: 3, d: 1.5 }, () => { tell('all', 'lt.c4.bridge', { priority: 1 }); });
    stage(w, 'dc-far', { x: 0, y: 0, z: -158.5, w: 5, h: 3, d: 1.5 }, () => { R.flag('ch4-crossed', true); w.after(16, () => { fireH('wrong', { sec: 4.5, role: 'all' }); w.after(20, () => fireH('behind', { kind: 'patient', role: 'all', dist: 3.2 })); }); });
    checkpoint(w, { x: -0.9, z: -162.5 });
    const trench = { x: 0, z: -153, hx: 2.7, hz: 3.1, hy: 2, top: 1, enabled: true };
    const st3 = stalker(w, game, H, H.S, {
      nodes: [{ id: 'a', x: 0, z: -128 }, { id: 'b', x: 0, z: -136 }, { id: 'c', x: 0, z: -144 }],
      route: ['a', 'b', 'c', 'b'], start: 'b', speed: 2.6, chaseSpeed: 5.8, sight: 12, fov: 0.9, hear: 8, pause: 2.8, extra: [trench],
      slow: () => 1 / (1 + 1.45 * 0.55),
    });
    st3.setActive(false);
    st3.hideSpot({ x: -4.4, z: -132, w: 2.8, d: 2.2 }); st3.hideSpot({ x: 4.4, z: -141, w: 2.8, d: 2.2 });
    c.zone({ x: 0, y: 1, z: -135, w: 5, h: 3, d: 8, need: 'any' }).onChange((zn) => { if (zn.active && !c.get('c3:rush', false)) { c.set('c3:rush', true); w.after(26, () => fireH('rush', { kind: 'orderly', role: R.subject })); } });

    // =========================================================================================================================
    // 6 · THE TIDE CHAMBER — two ledges, valve 3, the cycle under you
    // =========================================================================================================================
    room(w, { x: 0, z: -188, w: 16, d: 36, h: 6, doors: { s: [{ c: 0, w: 2.4 }], n: [{ c: 0, w: 2.6 }] }, ...tiled });
    const W4 = HY.water({ x: 0, z: -188, w: 15.7, d: 35.7, height: 6, flecks: 110, level: (t) => tideCycle(t, { lo: 0.15, hi: 2.15, period: 44, low: 0.48, rise: 0.2, high: 0.14, off: 9 }) });
    stairs(w, { x: -6.75, z: -171.2, dir: '-z', y0: 0, y1: 2.4, width: 2.2 }); slab(w, { x: -6.75, z: -182.4, y: 2.4, w: 2.2, d: 15.3, h: 0.4 });
    stairs(w, { x: -5.65, z: -188, dir: '+x', y0: 2.4, y1: 0.4, width: 2, base: -1 });
    stairs(w, { x: 6.75, z: -188, dir: '-z', y0: 0, y1: 2.4, width: 2.2 }); slab(w, { x: 6.75, z: -197.6, y: 2.4, w: 2.2, d: 11.8, h: 0.4 });
    stairs(w, { x: 5.65, z: -202, dir: '-x', y0: 2.4, y1: 0.4, width: 2, base: -1 });
    for (const [x, z] of [[-3.2, -179], [3.2, -179], [-3.2, -196], [3.2, -196]]) hp(w, { x, z, y: 5.9, w: 1.0, d: 1.0, h: 6.9, kind: 'tile', color: 0xa8bab2, path: false });
    for (const [x, z, m] of [[-4, -178, 'dying'], [4, -184, 'dead'], [-4, -190, 'buzz'], [4, -198, 'dying'], [0, -204, 'steady']]) H.lamp({ x, y: 5.95, z, mode: m, len: 1.5, shaft: false });
    HY.gauge({ x: -7.84, z: -176, rot: Math.PI / 2, h: 3.4, water: W4, floorY: 0 }); HY.gauge({ x: 7.84, z: -192, rot: -Math.PI / 2, h: 3.4, water: W4, floorY: 0 });
    HY.beacon({ x: 0, y: 5.5, z: -176, water: W4 }); HY.beacon({ x: 0, y: 5.5, z: -200, water: W4 });
    stencil(w, 'TIDE CHAMBER', { x: 0, y: 4.6, z: -170.2, rot: 0, size: 0.25, width: 4 });
    for (const [x, z, rot] of [[-7.84, -184, Math.PI / 2], [7.84, -180, -Math.PI / 2]]) stencil(w, 'HIGH WATER · NO AIR', { x, y: 3.7, z, rot, color: '#a8342a', width: 3.6, size: 0.2 });
    tub(w, { x: -3.2, z: -186, rot: Math.PI / 2 }); gurney(w, { x: 3.4, z: -191.5, rot: 1.3 });
    decal(w, { kind: 'splat', seed: 31, x: -7.84, y: 3.0, z: -197, w: 2.4, h: 2.4, face: 'w' }); decal(w, { kind: 'scratch', seed: 32, x: 7.84, y: 3.0, z: -184, w: 1.6, h: 1.6, face: 'e' });
    for (let i = 0; i < 4; i++) HY.drip(-2 + i * 1.4, 5.9, -176 - i * 7, 2.6);
    checkpoint(w, { x: -7.0, y: 2.4, z: -177.2 });
    const flot4 = new THREE.BoxGeometry(0.5, 0.06, 0.34);
    for (const [x, z] of [[-1, -182], [1.5, -192], [-0.5, -200]]) floater(w, W4, new THREE.Mesh(flot4, new THREE.MeshStandardMaterial({ color: 0xcfc8b0, roughness: 0.9 })), { x, z });
    const D3 = door(w, { x: 0, z: -206, along: 'x', width: 2.6, h: 2.5, key: 'exitd', locked: true, label: 'sluice door' });
    const V3 = HY.valve({
      id: 'v3', secs: 14, hint: 'lt.c4.v3.one',
      a: { x: -6.75, y: 2.4, z: -186.5, text: 'SLUICE · WEST', rot: Math.PI / 2 },
      b: { x: 6.75, y: 2.4, z: -200, text: 'SLUICE · EAST', rot: -Math.PI / 2 },
      onDone: () => { D3.unlock(); w.after(0.8, () => D3.setOpen(true)); H.S.groan(0.3); tell('all', 'lt.c4.v3.done', { priority: 2 }); R.flag('ch4-done', true); },
    });
    const b3 = bell(w, { x: -7.6, y: 3.7, z: -180, label: 'Ring the sluice bell', onRing: () => { b3.userData.ring(); H.S.slam(0.28); st4.noise(-6, -192, 24); } });
    const b4 = bell(w, { x: 7.6, y: 3.7, z: -194, label: 'Ring the sluice bell', onRing: () => { b4.userData.ring(); H.S.slam(0.28); st4.noise(5, -176, 24); } });
    const st4 = stalker(w, game, H, H.S, {
      nodes: [{ id: 'a', x: 0, z: -176 }, { id: 'b', x: 0, z: -186 }, { id: 'c', x: 0, z: -196 }, { id: 'd', x: 0, z: -202 }],
      route: ['a', 'b', 'c', 'd', 'c', 'b'], start: 'c', speed: 2.2, chaseSpeed: 5.6, sight: 18, fov: 1.0, pause: 2.6,
      slow: () => 1 / (1 + Math.max(0.1, W4.y) * 0.55),
    });
    st4.setActive(false);
    stage(w, 'tc-in', { x: 0, y: 1, z: -172, w: 15, h: 3, d: 1.6 }, () => { tell('all', 'lt.c4.chamber', { priority: 1 }); });
    let blacked = false;
    w.updaters.push(() => { if (blacked || V3.prog < V3.secs * 0.5 || V3.done) return; blacked = true; Z.blackout(2.6); R.whisper({ keyholder: 'lt.c4.whisper.k3', subject: 'lt.c4.whisper.s3' }); w.after(4, () => fireH('rush', { kind: 'orderly', role: R.keyholder })); });

    // =========================================================================================================================
    // 7 · OUT
    // =========================================================================================================================
    room(w, { x: 0, z: -212, w: 6, d: 12, h: 3.6, sides: { s: false }, ...tiled });
    H.lamp({ x: 0, y: 3.55, z: -211, mode: 'steady', len: 1.2 });
    exitDoor(w, { x: 0, z: -217.4, rot: 0 });
    stencil(w, 'THE TIDE IS LOW', { x: 0, y: 2.9, z: -217.85, rot: 0, size: 0.2, width: 3.4 });

    // =========================================================================================================================
    // area control: one Orderly at a time (shared, monotone), so the guest never sees a stale figure
    // =========================================================================================================================
    const sts = [st1, st2, st3, st4]; let area = 0;
    const enter = (k, at) => { if (k <= area) return; area = k; sts.forEach((s, i) => { if (i + 1 !== k) s.setActive(false); }); const s = sts[k - 1]; if (at) s.warp(at.x, at.z); setTimeout(() => s.setActive(true), 600); };
    c.onEvent('area', (m) => { if (m) enter(m.k, m.at); });
    const areaZone = (k, box, at) => c.zone({ ...box, need: 'any', shrink: 0 }).onChange((zn) => { if (zn.active && k > area) c.emit('area', { k, at }); });
    areaZone(1, { x: 0, y: 1, z: -43, w: 22, h: 3, d: 1.5 }, { x: 0, z: -62 });
    areaZone(2, { x: 0, y: 1, z: -66, w: 36, h: 3, d: 1.5 }, { x: 13.5, z: -97 });
    areaZone(3, { x: 0, y: 1, z: -125, w: 5, h: 8, d: 1.2 }, { x: 0, z: -136 });
    areaZone(4, { x: 0, y: 1, z: -172, w: 15, h: 3, d: 1.2 }, { x: 0, z: -198 });

    // =========================================================================================================================
    // bots (the harness): both mirror a first-time pair. They are never drowned or caught; they just have to be able to finish.
    // =========================================================================================================================
    const pz = () => c.partner.sz, bk = () => BR.k > 0.95;
    const seq = () => (c.get('lk', []) || []).length;
    const lz = (tag) => lockerZ(TAGS.indexOf(tag));
    botSteps(w, {
      p1: [
        { x: 0, z: -3, r: 1 }, { x: 0, z: -9, r: 1 }, { x: -1.6, z: -34, r: 0.8 }, { x: -1.6, z: -35.5, r: 0.45, until: done('v1') },
        { x: 0, z: -39, r: 0.8 }, { x: 0, z: -43, r: 1 },
        { x: 8.3, z: lz('14'), r: 0.3 }, { x: 10.4, z: lz('14'), r: 1.0, use: true, until: () => seq() >= 1 },
        { until: () => seq() >= 2 },
        { x: 8.3, z: lz('22'), r: 0.3 }, { x: 10.4, z: lz('22'), r: 1.0, use: true, until: () => seq() >= 3 },
        { until: () => c.get('lk:ok', false) },
        { x: 0, z: -62, r: 1 }, { x: 0, z: -68, r: 1 }, { x: -13, z: -76, r: 1 }, { x: -16.8, z: -82, r: 0.8 }, { x: -16.8, z: -86, r: 0.8 },
        { x: -15.9, z: -92, r: 0.4, until: done('v2') },
        { x: -16.8, z: -97, r: 0.8 }, { x: -16.8, z: -104, r: 0.8 }, { x: -10, z: -108.5, r: 1 }, { x: 0, z: -108.5, r: 1 }, { x: 0, z: -113, r: 0.8 }, { x: 0, z: -122, r: 1 },
        { x: -1.6, z: -144.5, r: 0.45, until: () => bk() && pz() < -158.5 },
        { x: 0, z: -149, r: 0.8 }, { x: 0, z: -160, r: 1 }, { x: 0, z: -168, r: 1 },
        { x: 0, z: -174, r: 1 }, { x: -6.75, z: -172.2, r: 0.8 }, { x: -6.75, z: -178, r: 0.8 },
        { x: -6.75, z: -186.5, r: 0.4, until: done('v3') },
        { x: -6.2, z: -188, r: 0.8 }, { x: -2, z: -188, r: 1 }, { x: 0, z: -195, r: 1.2 }, { x: 0, z: -205, r: 0.8 }, { x: 0, z: -216, r: 0.8 },
      ],
      p2: [
        { x: 0, z: -3, r: 1 }, { x: 0, z: -9, r: 1 }, { x: 0.5, z: -23, r: 1 }, { x: 1.95, z: -23, r: 0.8 }, { x: 1.95, z: -34.5, r: 0.45, until: done('v1') },
        { x: 0, z: -37, r: 1 }, { x: 0, z: -39, r: 0.8 }, { x: 3, z: -44, r: 1 },
        { until: () => seq() >= 1 },
        { x: 8.3, z: lz('07'), r: 0.3 }, { x: 10.4, z: lz('07'), r: 1.0, use: true, until: () => seq() >= 2 },
        { until: () => seq() >= 3 },
        { x: 8.3, z: lz('03'), r: 0.3 }, { x: 10.4, z: lz('03'), r: 1.0, use: true, until: () => c.get('lk:ok', false) },
        { x: 0, z: -62, r: 1 }, { x: 0, z: -68, r: 1 }, { x: 13, z: -76, r: 1 }, { x: 13.4, z: -93, r: 0.4, until: done('v2') },
        { x: 16.5, z: -88.5, r: 0.8 }, { x: 16.5, z: -100, r: 0.8 }, { x: 16.5, z: -105, r: 1 }, { x: 10, z: -108.5, r: 1 }, { x: 0, z: -108.5, r: 1 }, { x: 0, z: -113, r: 0.8 }, { x: 0, z: -122, r: 1 },
        { x: 0, z: -146, r: 0.6, until: bk },
        { x: 0, z: -153, r: 0.8 }, { x: 0, z: -158, r: 0.8 }, { x: 1.6, z: -161.5, r: 0.45, until: () => pz() < -157 },
        { x: 0, z: -168, r: 1 }, { x: 0, z: -175, r: 1 }, { x: 0, z: -186, r: 1 }, { x: 6.75, z: -187, r: 0.8 }, { x: 6.75, z: -192, r: 0.8 },
        { x: 6.75, z: -200, r: 0.4, until: done('v3') },
        { x: 6.2, z: -202, r: 0.8 }, { x: 2.5, z: -202, r: 1 }, { x: 0, z: -205, r: 0.8 }, { x: 0, z: -216, r: 0.8 },
      ],
    });

    w.hooks.onComplete = () => { R.flag('ch4-drowned-' + me, HY.drowned); };
    w.after(3, () => tell(me, 'lt.c4.intro', { priority: 2 }));
    void box; void gurney; void wheelchair; void barWindow; void HY; void bell;
  },
};
