import * as THREE from 'three';
import { stalker } from './stalker.js';
import { scares } from './scare.js';
import { roles } from './roles.js';
import { horrorEnv, checkpoint, door, room, box, decal, locker, curtain, gurney, wheelchair, pipes, desk, barWindow, stencil, note, hp, wall, bed } from './kit.js';
import { hydroEnv, stairs, slab, bench, lifebuoy, board, bell, tub } from './hydro-kit.js';
import { crankBridge, shutter, dialPad, timerHud, cardOverlay, pier, smooth } from './finale-kit.js';
import { stage, botSteps } from '../coop/kit.js';

// Chapter 8 — LOWTIDE. The tide comes in over the whole asylum and you climb out of it. Seven beats, then the choice:
//   1 The ward (two bolts, one at each end)        2 The nurses' hall (one rings, one holds the flood gate; the Orderly in full light)
//   3 The flooded stair (two cranked bridges, the water on a timer)    4 The records stacks (a lever each opens the other's file; a four-dial door)
//   5 The theatre gallery (winches across the pit, two reels, the film that explains him)    6 The long run (he hunts you down a shuttered corridor)
//   7 The sea door: a private lever each, 90 seconds, three endings:  together · alone · tide.
// Floors rise as you go (the ward y=0, the stair climbs to y=5, everything after is on y=5). Flags from earlier chapters colour small things.

const PI = Math.PI;
const CODE = [7, 3, 1, 9];
const SEA = { secs: 90, t0: 'ch8:t0' };
const tiled = { floorKind: 'tile', wallKind: 'tile' };
const Y = 5;

export default {
  id: 'lowtide8',
  name: 'Lowtide',
  music: 'l1',
  horror: true,
  deathRule: 'self',
  completeQuip: 'The tide goes out. Whatever you decided stays decided.',
  titleCam: { center: [0, 6, -170], radius: 60, height: 40 },

  build(w, game) {
    const H = horrorEnv(w, game, { fogColor: 0x061110, density: 0.05, ambientSky: 0x2c4c52, ambient: 0.55 });
    const c = w.coop, me = c.me, other = c.other, S = H.S;
    const HY = hydroEnv(w, game, H);
    const R = roles(w, game);
    const Z = scares(w, game, H, S);
    w.spawn = { x: me === 'p1' ? -2.2 : 2.2, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    const tell = (r, k, o) => c.tell(r, k, o);
    const done = (id) => () => c.get('v:' + id, false);
    const fireH = (id, arg) => { if (c.isHost) Z.fire(id, arg); };
    const mine = R.mine, iAmK = mine === 'keyholder';
    const flag = (k) => !!R.get(k);
    const trusted = (role) => { const t = R.get('trusted-' + role) ?? R.get('trusted'); return t && typeof t === 'object' ? !!t[role] : !!t; };
    const P = () => c.partner;
    const lockedIn = flag('locked-in'), tookKey = flag('took-key'), heardTape = flag('heard-tape');
    const nm = (role) => c.names[role] || role;
    const once = (name, fn) => { let d = false; c.onEvent('c8:' + name, (a) => { if (d) return; d = true; fn(a || {}); }); return (a) => c.emit('c8:' + name, a || {}); };
    const lampRow = (list, y, extra = {}) => list.forEach(([x, z, mode, len = 1.4, rot = 0]) => H.lamp({ x, y, z, mode, len, rot, ...extra }));
    const decals = (list) => list.forEach(([kind, seed, x, y, z, ww, hh, face, rot]) => decal(w, { kind, seed, x, y, z, w: ww, h: hh, face: face || 'floor', rot: rot || 0 }));
    const lerp = (a, b, k) => a + (b - a) * k;

    // =========================================================================================================================
    // 1 · THE WARD — the same ward as the first night, with the tide at the door
    // =========================================================================================================================
    room(w, { x: 0, z: -9, w: 14, d: 30, h: 3.6, sides: { n: false }, ...tiled });
    stencil(w, 'CHAPTER 8', { x: -6.83, y: 2.75, z: -1, rot: PI / 2, size: 0.26, width: 3.2 });
    stencil(w, 'LOWTIDE', { x: -6.83, y: 2.2, z: -1, rot: PI / 2, size: 0.34, width: 3.6 });
    for (const z of [2.2, -0.6, -3.4, -6.2]) { bed(w, { x: -5.6, z, rot: 0, messy: z > 0 }); bed(w, { x: 5.6, z: z - 1.2, rot: 0, messy: z < 0 }); }
    curtain(w, { x: -4.3, z: -2, width: 2.6, rot: PI / 2, open: 0.5 }); curtain(w, { x: 4.3, z: -6, width: 2.6, rot: PI / 2, open: 0 });
    wheelchair(w, { x: 2.2, z: -13, rot: 3.3 }); gurney(w, { x: -2.8, z: -17, rot: 0.2 }); pipes(w, { x0: 6.3, z0: 5, x1: 6.3, z1: -23, y: 3.2, n: 2 });
    board(w, { x: -6.83, y: 1.9, z: -9.5, rot: PI / 2, title: 'WARD · NIGHT', lines: ['LOW WATER .. 03:12', 'THE DOOR IS BOLTED', '!FROM THE CORRIDOR SIDE', 'NO ONE IS TO LEAVE'] });
    barWindow(w, { x: 6.83, z: -3, rot: -PI / 2 }); barWindow(w, { x: 6.83, z: -14, rot: -PI / 2 });
    lampRow([[-2.5, 1, 'buzz'], [3, -5, 'dying'], [-3, -12, 'dead'], [2, -19, 'buzz']], 3.55);
    decals([['puddle', 3, -1, 0.025, -3, 3, 3], ['drag', 5, 1.5, 0.02, -10, 3, 2.4, 'floor', 1.2], ['hand', 8, 6.84, 1.0, -9, 0.5, 0.5, 'e'], ['scratch', 2, -6.84, 1.6, -15, 1.4, 1.4, 'w'], ['splat', 4, 3.2, 0.02, -16.5, 2.4, 2.4]]);
    // the ward floods slowly: ankle-deep by the time you leave
    const W1 = HY.water({ x: 0, z: -9, w: 13.7, d: 29.7, level: (t) => ({ y: -0.4 + 0.75 * smooth((t - 40) / 260), warn: 0 }), height: 3.6, flecks: 60, caustics: 1.2 });
    HY.drip(-3, 3.5, -4, 3); HY.drip(3, 3.5, -14, 2.4);
    checkpoint(w, { x: 0, z: -2 });
    // the bolts: top and bottom of the room (the door is bolted from both ends and one pair of hands is not enough)
    const BOLT = HY.valve({
      id: 'bolt', secs: 7, hint: 'lt.c8.bolt.one',
      a: { x: -5.6, y: 0, z: -19, text: 'BOLT · NORTH', rot: PI / 2 },
      b: { x: 5.6, y: 0, z: 5.3, text: 'BOLT · SOUTH', rot: -PI / 2 },
      onDone: () => { D1.unlock(); w.after(0.8, () => D1.setOpen(true)); S.door(0, 0.3); tell('all', 'lt.c8.bolt.done', { priority: 2 }); },
    });
    void BOLT;
    const D1 = door(w, { x: 0, z: -24, along: 'x', width: 2.4, h: 2.5, key: 'd1', locked: true, label: 'ward door', game });
    // the Subject's own hidden stash (only if the Keyholder locked them in, in chapter 7)
    if (lockedIn) {
      w.interactable({
        x: -5.6, y: 0.5, z: -8.6, w: 1.2, h: 0.9, d: 0.8, range: 3, label: () => (c.get('ch8:stash', false) ? 'Your stash (empty)' : 'Look under the mattress'),
        enabled: () => me === R.subject,
        onUse: async () => {
          if (c.get('ch8:stash', false)) return; c.set('ch8:stash', true); S.step(0, 0.08);
          const { readModal } = await import('../hotel/escape-kit.js');
          readModal(game, { title: 'UNDER THE MATTRESS', html: '<p>A strip torn from a bedsheet, knotted around three things: a brass tag marked <b>7 3</b>, a pencil stub, and a note in your own handwriting.</p><p><i>"If they lock me in again: the first two numbers are 7 and 3. I have been through this door before. Do not let the one with the key walk you to the stairs."</i></p>' });
          tell(me, 'lt.c8.stash', { priority: 2 });
        },
      });
    }
    // the first sight of him: lit, standing at the end of the hall, perfectly still
    stage(w, 'z1-open', { x: 0, y: 1, z: -22, w: 4, h: 3, d: 2 }, () => {
      Z.stand('orderly', 0, -60, { dur: 16 }); S.step(0, 0.1, true); w.after(1.5, () => S.squeak(0, 0.06));
      tell('all', 'lt.c8.see1', { priority: 2 });
    });
    stage(w, 'z1-in', { x: 0, y: 1, z: 2, w: 14, h: 3, d: 3 }, () => { w.after(4, () => tell('all', 'lt.c8.intro', { priority: 2 })); w.after(15, () => R.whisper({ keyholder: tookKey ? 'lt.c8.k.key' : 'lt.c8.k.nokey', subject: lockedIn ? 'lt.c8.s.locked' : 'lt.c8.s.free' })); w.after(34, () => tell('all', 'lt.c8.bolt.hint', { priority: 1 })); });

    // =========================================================================================================================
    // 2 · THE NURSES' HALL — you can see him. That is worse. (one rings the call bell, one holds the flood gate; he answers the bell)
    // =========================================================================================================================
    room(w, { x: 0, z: -44, w: 30, d: 40, h: 4, doors: { s: [{ c: 0, w: 2.4 }], n: [{ c: 0, w: 2.4 }] }, ...tiled });
    stencil(w, 'NURSES · NIGHT STATION', { x: 0, y: 3.2, z: -63.83, rot: 0, size: 0.17, width: 4.4 });
    box(w, { x: 0, y: 1.2, z: -47, w: 10, h: 2.4, d: 5, kind: 'wood', color: 0x4a4038 }); w.collider({ x: 0, y: 1.2, z: -47, w: 10, h: 2.4, d: 5 });
    desk(w, { x: -2.5, z: -43.4, rot: 0 }); desk(w, { x: 2.5, z: -43.4, rot: 0 });
    for (let i = 0; i < 6; i++) locker(w, { x: -14.55, z: -30 - i * 0.7 - (i > 2 ? 4 : 0), rot: PI / 2, ajar: i === 4 ? 0.7 : 0, color: [0x5d6b66, 0x566660, 0x66705f][i % 3] });
    for (let i = 0; i < 4; i++) curtain(w, { x: 13.2, z: -32 - i * 3.1, width: 2.6, rot: PI / 2, open: i === 2 ? 0.6 : 0 });
    gurney(w, { x: 8.5, z: -33, rot: 1.4 }); wheelchair(w, { x: -9.5, z: -58.5, rot: 0.6 }); gurney(w, { x: -12, z: -52, rot: 0.2 });
    pipes(w, { x0: -14.3, z0: -25, x1: -14.3, z1: -63, y: 3.5, n: 3 });
    lampRow([[-9, -30, 'steady', 1.8], [9, -30, 'steady', 1.8], [0, -38, 'buzz'], [-9, -57, 'buzz', 1.6], [9, -57, 'dying', 1.6], [0, -55, 'steady', 1.4]], 3.95);
    decals([['puddle', 12, 3, 0.025, -38, 4, 4], ['drag', 15, -6, 0.02, -53, 5, 3, 'floor', 0.4], ['splat', 6, 10, 0.02, -49, 3, 3], ['hand', 13, 14.84, 1.1, -49, 0.5, 0.5, 'e'], ['scratch', 14, -14.84, 1.6, -45, 1.5, 1.5, 'w'], ['hand', 17, -14.84, 1.0, -55, 0.5, 0.5, 'w']]);
    barWindow(w, { x: 14.83, z: -41, rot: -PI / 2 }); barWindow(w, { x: 14.83, z: -56, rot: -PI / 2 });
    const W2 = HY.water({ x: 0, z: -44, w: 29.7, d: 39.7, level: (t) => ({ y: -0.3 + 0.8 * smooth((t - 90) / 300), warn: 0 }), height: 4, flecks: 100, caustics: 1.2 });
    void W2;
    checkpoint(w, { x: 0, z: -26.5 });
    const D2 = door(w, { x: 0, z: -64, along: 'x', width: 2.4, h: 2.5, key: 'd2', locked: true, label: 'flood door', game });
    const st1 = stalker(w, game, H, S, {
      nodes: [{ id: 'a', x: -9, z: -37 }, { id: 'b', x: 9, z: -37 }, { id: 'c', x: 9, z: -56 }, { id: 'd', x: -9, z: -56 }, { id: 'e', x: 0, z: -33 }, { id: 'f', x: 0, z: -60 }, { id: 'g', x: -12, z: -60 }, { id: 'h', x: 12, z: -33 }],
      route: ['a', 'e', 'b', 'h', 'b', 'c', 'f', 'd', 'g', 'd'], start: 'd', speed: 2.1, chaseSpeed: 5.5, sight: 14, fov: 0.9, pause: 2.2, home: 'a',
    });
    st1.setActive(false);
    st1.hideSpot({ x: -14, z: -32, w: 2.2, d: 4.4 }); st1.hideSpot({ x: -14, z: -38.5, w: 2.2, d: 3 }); st1.hideSpot({ x: 13.2, z: -35, w: 2.4, d: 9 }); st1.hideSpot({ x: -10, z: -59, w: 3, d: 3 });
    // the call bell on the west wall rings on the far SW call board: he answers it (the ringer is nowhere near what he walks to)
    let bells = 0;
    c.onEvent('c8:bell', () => { bells++; });
    const bellG = bell(w, { x: -14.5, y: 1.95, z: -27.5, label: 'Ring the call bell', onRing: () => { bellG.userData.ring(); S.slam(0.28); c.emit('c8:bell'); st1.noise(-11, -60, 30); } });
    const padS = HY.station({ x: 13.3, y: 0, z: -58, text: 'FLOOD GATE · HOLD', rot: -PI / 2 });
    let pad = 0; const PAD_SECS = 11;
    w.updaters.push((dt) => {
      if (c.get('ch8:padok', false)) return;
      pad = padS.zone.active ? Math.min(PAD_SECS, pad + dt) : Math.max(0, pad - dt * 0.5);
      padS.setProg(pad / PAD_SECS); padS.wheel.rotation.z += dt * (padS.zone.active ? 2.2 : 0); padS.padM.color.setHex(0xffb040).multiplyScalar(padS.zone.active ? 1.8 : 0.8);
      if (pad >= PAD_SECS) c.set('ch8:padok', true);
    });
    c.on('ch8:padok', (v) => {
      if (!v) return; padS.padM.color.setRGB(0.3, 1.6, 0.7); padS.barM.color.setRGB(0.3, 1.6, 0.7); padS.setProg(1);
      D2.unlock(); w.after(0.7, () => D2.setOpen(true)); S.groan(0.3); tell('all', 'lt.c8.gate.done', { priority: 2 });
      w.after(1.5, () => st1.noise(13, -58, 40)); w.after(2, () => fireH('rush', { kind: 'orderly', role: R.subject }));
    });
    let sawHim = false;
    w.updaters.push(() => { if (!sawHim && st1.on && st1.myDist < 11) { sawHim = true; tell('all', 'lt.c8.see2', { priority: 2 }); } });
    stage(w, 'z2-in', { x: 0, y: 1, z: -28, w: 30, h: 3, d: 2 }, () => { tell('all', 'lt.c8.hall', { priority: 1 }); w.after(18, () => tell('all', 'lt.c8.hall.bell', { priority: 1 })); w.after(50, () => { if (!c.get('ch8:padok', false)) tell('all', 'lt.c8.hall.pad', { priority: 1 }); }); });
    stage(w, 'z2-pad', { x: 0, y: 1, z: -50, w: 30, h: 3, d: 2 }, () => { tell('all', 'lt.c8.hall.hold', { priority: 1 }); });

    // =========================================================================================================================
    // 3 · THE FLOODED STAIR — the sea comes up the shaft; two bridges, each needs a hand on the crank at one end
    // =========================================================================================================================
    room(w, { x: 0, z: -82, w: 16, d: 36, h: 9, sides: { s: false, n: false }, ...tiled });
    wall(w, { x: 0, z: -64, w: 16, d: 0.3, y: 4, h: 5, kind: 'tile' });
    wall(w, { x: 0, z: -100, w: 16, d: 0.3, y: 0, h: Y, kind: 'tile' });
    stencil(w, 'STAIR · EAST SERVICE', { x: -7.83, y: 3.0, z: -70, rot: PI / 2, size: 0.17, width: 3.4 });
    stencil(w, 'DO NOT USE AT HIGH WATER', { x: 7.83, y: 6.0, z: -92, rot: -PI / 2, size: 0.15, width: 3.6, color: '#a8342a' });
    const s1 = stairs(w, { x: -5.5, z: -66, dir: '-z', y0: 0, y1: 2.4, width: 2.8 });
    slab(w, { x: -5.5, z: (s1.z + -76) / 2, y: 2.4, w: 4, d: Math.abs(s1.z + 76), h: 0.5 });                               // L1
    slab(w, { x: 5.5, z: (s1.z + -76) / 2, y: 2.4, w: 4, d: Math.abs(s1.z + 76), h: 0.5 });                                // L2
    const s2 = stairs(w, { x: 5.5, z: -76, dir: '-z', y0: 2.4, y1: Y, width: 2.8 });
    const z3 = (s2.z + -86.6) / 2;
    slab(w, { x: 5.5, z: z3, y: Y, w: 4, d: Math.abs(s2.z + 86.6), h: 0.5 });                                              // L3
    slab(w, { x: -5.5, z: z3, y: Y, w: 4, d: Math.abs(s2.z + 86.6), h: 0.5 });                                             // L4
    slab(w, { x: -5.5, z: (-86.6 + -100) / 2, y: Y, w: 4, d: 13.4, h: 0.5 });                                              // the walkway to the door
    const zb1 = (s1.z + -76) / 2;
    const B1 = crankBridge(w, HY, H, { x: 0, y: 2.4, z: zb1, len: 7.4, axis: 'x', stations: [{ x: -6.0, y: 2.4, z: -74.8, text: 'CRANK · WEST', rot: PI / 2 }, { x: 6.0, y: 2.4, z: -74.8, text: 'CRANK · EAST', rot: -PI / 2 }] });
    const B2 = crankBridge(w, HY, H, { x: 0, y: Y, z: z3, len: 7.4, axis: 'x', stations: [{ x: 6.0, y: Y, z: -85.2, text: 'CRANK · EAST', rot: -PI / 2 }, { x: -6.0, y: Y, z: -85.2, text: 'CRANK · WEST', rot: PI / 2 }] });
    for (const [x, z] of [[-5.5, -72], [5.5, -72], [5.5, z3], [-5.5, z3]]) { void x; void z; }
    lampRow([[-5.5, -80, 'dead', 1.2, PI / 2], [5.5, -92, 'dying', 1.2, PI / 2]], 8.95);
    H.lamp({ x: -5.5, y: 5.9, z: -73, color: 0xff6a50, mode: 'buzz', len: 1.0, power: 0.7, shaft: false });
    H.lamp({ x: 5.5, y: 8.3, z: z3, color: 0xff6a50, mode: 'steady', len: 1.0, power: 0.5, shaft: false });
    H.lamp({ x: -5.5, y: 8.6, z: -94, color: 0xff6a50, mode: 'dying', len: 1.0, power: 0.7, shaft: false });
    pipes(w, { x0: 7.5, z0: -65, x1: 7.5, z1: -99, y: 8.2, n: 3 });
    decals([['hand', 21, -7.84, 4.3, -78, 0.5, 0.5, 'w'], ['scratch', 22, 7.84, 6.8, -90, 1.4, 1.4, 'e'], ['splat', 23, -5.5, 2.43, -73, 2.2, 2.2], ['puddle', 24, 5.5, 5.03, -83, 2.4, 2.4]]);
    for (const z of [-70, -83, -92]) HY.drip(z % 2 ? -2 : 2, 8.9, z, 2.6);
    const SP = { rate: 0.0175, lo: -0.4, peak: 5.8 };
    const W3 = HY.water({
      x: 0, z: -82, w: 15.7, d: 35.7, floorY: 0, height: 9, flecks: 130, caustics: 2.0,
      level: (t) => { const s = c.get('ch8:s3', null); if (s == null) return { y: SP.lo, warn: 0 }; const u = Math.max(0, t - s); return { y: Math.min(SP.peak, SP.lo + SP.rate * u), warn: u < 320 ? 1 : 0 }; },
    });
    for (const [x, z, rot] of [[-7.84, -72, PI / 2], [7.84, -80, -PI / 2], [-7.84, -90, PI / 2]]) HY.gauge({ x, z, rot, h: 8, water: W3, lethal: 1.7 });
    HY.beacon({ x: 0, y: 8.7, z: -70, water: W3 }); HY.beacon({ x: 0, y: 8.7, z: -92, water: W3 });
    checkpoint(w, { x: -5.5, z: -65 });
    let z3on = false, z3done = false;
    w.updaters.push(() => {
      if (!z3on || z3done) return;
      const y = W3.y;
      w.respawn = y > 3.4 ? { x: 5.5, y: Y, z: z3, yaw: 0 } : y > 0.5 ? { x: -5.5, y: 2.4, z: zb1 + 1.5, yaw: 0 } : w.respawn;
    });
    stage(w, 'z3-in', { x: 0, y: 1, z: -65.6, w: 16, h: 3, d: 1.6 }, () => {
      z3on = true; if (c.isHost && c.get('ch8:s3', null) == null) c.set('ch8:s3', w.t);
      tell('all', 'lt.c8.stair', { priority: 2 }); w.after(20, () => tell('all', 'lt.c8.stair.crank', { priority: 1 })); S.groan(0.3);
      w.after(12, () => R.whisper({ keyholder: 'lt.c8.k.stair', subject: 'lt.c8.s.stair' }));
    });
    stage(w, 'z3-l1', { x: -5.5, y: 3.4, z: zb1, w: 4, h: 3, d: 6 }, () => { Z.stand('patient', 5.5, zb1 - 1.5, { y: 2.4, dur: 14 }); Z.knock({ n: 2 }); });
    stage(w, 'z3-l3', { x: 5.5, y: 6, z: z3, w: 4, h: 3, d: 6 }, () => { tell('all', 'lt.c8.stair.top', { priority: 1 }); w.after(9, () => fireH('rush', { kind: 'orderly', role: R.keyholder })); });
    stage(w, 'z3-out', { x: -5.5, y: 6, z: -97.5, w: 4, h: 3, d: 2 }, () => { z3done = true; S.groan(0.2); tell('all', 'lt.c8.stair.out', { priority: 2 }); });
    let wl = 0; const wlc = [[0.9, 'lt.c8.wl1'], [2.5, 'lt.c8.wl2'], [4.1, 'lt.c8.wl3']];
    w.updaters.push(() => { if (c.get('ch8:s3', null) == null || z3done) return; while (wl < wlc.length && W3.y >= wlc[wl][0]) { tell('all', wlc[wl][1], { priority: 2 }); wl++; } });

    // =========================================================================================================================
    // 4 · THE RECORDS STACKS (y=5) — a lever in each wing opens the OTHER wing's file; the door wants four numbers
    // =========================================================================================================================
    room(w, { x: 0, z: -123, w: 26, d: 46, y: Y, h: 4.4, doors: { s: [{ c: -5.5, w: 2.4 }], n: [{ c: 0, w: 2.4 }] }, floorKind: 'concrete', wallKind: 'plaster', ceilKind: 'concrete' });
    stencil(w, 'RECORDS · LOWER STACKS', { x: 0, y: Y + 3.3, z: -100.83, rot: 0, size: 0.17, width: 4.6 });
    const D3 = door(w, { x: -5.5, y: Y, z: -100, along: 'x', width: 2.4, h: 2.5, key: 'd3', label: 'stack door', game });
    wall(w, { x: 0, z: -126, w: 0.3, d: 32, y: Y, h: 4.4, kind: 'plaster' });
    const shelf = (x, z0, z1) => { const zc = (z0 + z1) / 2, len = Math.abs(z1 - z0); box(w, { x, y: Y + 1.3, z: zc, w: 1.0, h: 2.6, d: len, kind: 'wood', color: 0x3d3128 }); w.collider({ x, y: Y + 1.3, z: zc, w: 1.0, h: 2.6, d: len }); for (let k = 0; k < 4; k++) box(w, { x, y: Y + 0.6 + k * 0.6, z: zc, w: 1.05, h: 0.05, d: len + 0.05, kind: 'rust', color: 0x2a2018, shadow: false }); };
    for (const [x, a, b] of [[-10.5, -112, -128], [-6.5, -118, -134], [-2.5, -112, -128]]) shelf(x, a, b);
    for (const [x, a, b] of [[10.5, -118, -134], [6.5, -112, -128], [2.5, -118, -134]]) shelf(x, a, b);
    // fallen files, spilled drawers, a crooked lamp
    for (const [x, z, r] of [[-8.5, -121, 0.4], [-4.5, -115, 1.2], [8.5, -124, 0.9], [4.5, -131, 2.1], [-12.2, -118, 0.3], [12.2, -126, 1.5]]) box(w, { x, y: Y + 0.03, z, w: 0.9, h: 0.04, d: 0.6, kind: 'wood', color: 0xa8a090, rot: r, shadow: false });
    lampRow([[-8.5, -107, 'buzz'], [8.5, -107, 'dying'], [0, -115, 'dead'], [-8.5, -122, 'dead'], [8.5, -132, 'buzz'], [-4.5, -137, 'dying'], [4.5, -137, 'buzz'], [0, -144, 'steady']], Y + 4.35);
    decals([['puddle', 31, 0, Y + 0.025, -104, 4, 4], ['drag', 32, -9, Y + 0.02, -123, 3, 5, 'floor', 1.57], ['hand', 33, -12.84, Y + 1.2, -131, 0.5, 0.5, 'w'], ['scratch', 34, 12.84, Y + 1.5, -118, 1.5, 1.5, 'e'], ['splat', 35, 3, Y + 0.02, -140, 3, 3]]);
    curtain(w, { x: 8, z: -104, width: 3, rot: 0 }); gurney(w, { x: 9, z: -105, rot: 1.6 });
    checkpoint(w, { x: -5.5, y: Y, z: -102.5 });
    // gates: sliding shelves that close the file alcoves
    const gate = (key, x, dir) => {
      const p = hp(w, { x, z: -139.1, y: Y + 2.6, w: 6.2, d: 0.9, h: 2.6, kind: 'wood', color: 0x3d3128, path: false, moving: true }); let k = 0;
      w.updaters.push((dt) => { const open = c.get(key, false); k += Math.sign((open ? 1 : 0) - k) * Math.min(Math.abs((open ? 1 : 0) - k), dt / 2.4); p.setPos(p.base.x + dir * k * 6.1, p.base.y, p.base.z); p.body.enabled = k < 0.92; });
      return p;
    };
    gate('ch8:gA', -7, -1); gate('ch8:gB', 7, 1);
    const fileCab = (x, key, digits, html) => {
      box(w, { x, y: Y + 0.95, z: -141.5, w: 3.0, h: 1.9, d: 0.7, kind: 'rust', color: 0x56635e }); w.collider({ x, y: Y + 0.95, z: -141.5, w: 3.0, h: 1.9, d: 0.7 });
      note(w, game, { x, y: Y + 1.25, z: -140.3, rot: 0, title: 'FILE · ' + key, label: 'Open the file drawer', html, onRead: () => { tell('all', key === 'A' ? 'lt.c8.file.a' : 'lt.c8.file.b', { priority: 1 }); } });
      void digits;
    };
    const hist = (role) => role === 'keyholder'
      ? '<p><b>STAFF FILE · HALE, E. · ORDERLY</b></p><p>Duty: hold the ward doors on the night of the high tide. Instruction countersigned by the attending physician, who also held the only key to the sea door. Attending physician: <i>you.</i></p>'
      : '<p><b>PATIENT FILE · ADMITTED 03:12</b></p><p>Patient is cooperative with the attending physician and fond of the night orderly. Patient believes there is a way out. There is one door to the sea. There is one key. It is not held by the patient.</p>';
    fileCab(-7, 'A', [7, 3], { keyholder: hist('keyholder') + '<p>Margin, in pencil: <b>FIRST TWO NUMBERS · 7 3</b></p><p>You wrote this down so you would not have to remember it.</p>', subject: hist('subject') + '<p>Margin, in pencil: <b>FIRST TWO NUMBERS · 7 3</b></p><p>This is your handwriting. You do not remember writing it.</p>' });
    fileCab(7, 'B', [1, 9], { keyholder: hist('keyholder') + '<p>Margin, in pencil: <b>LAST TWO NUMBERS · 1 9</b></p><p>The year of the first flood. They keep coming back.</p>', subject: hist('subject') + '<p>Margin, in pencil: <b>LAST TWO NUMBERS · 1 9</b></p><p>The year you were admitted. They keep telling you it was a different year.</p>' });
    // the levers: each is in the wing that opens the other
    const pull = (o) => {
      const g = new THREE.Group(); g.position.set(o.x, o.y, o.z); g.rotation.y = o.rot || 0; w.add(g);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.2), new THREE.MeshStandardMaterial({ color: 0x2c3330, roughness: 0.5, metalness: 0.8 })); base.position.set(0, 0.55, 0); g.add(base);
      const arm = new THREE.Group(); arm.position.set(0, 0.8, 0.12); g.add(arm);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0xaab4b0, roughness: 0.3, metalness: 0.9 })); rod.position.y = 0.35; arm.add(rod);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(o.color ?? 0xffb040).multiplyScalar(1.8), toneMapped: false })); knob.position.y = 0.72; arm.add(knob);
      let k = 0;
      w.updaters.push((dt) => { const on = o.isOn(); k += ((on ? 1 : 0) - k) * Math.min(1, dt * 6); arm.rotation.x = -0.7 + k * 1.4; });
      const sx = Math.sin(o.rot || 0), cz = Math.cos(o.rot || 0);
      w.interactable({ x: o.x + sx * 0.45, y: o.y + 1.0, z: o.z + cz * 0.45, w: 0.9, h: 1.3, d: 0.9, range: 3, label: () => (o.isOn() ? o.done : o.label), enabled: () => (o.enabled ? o.enabled() : !o.isOn()), onUse: () => { S.slam(0.12); o.onPull(); } });
      return g;
    };
    pull({ x: -12.6, y: Y, z: -124, rot: PI / 2, label: 'Pull the lever · opens the EAST wing file', done: 'The east file is open', isOn: () => c.get('ch8:gB', false), onPull: () => { c.set('ch8:gB', true); tell('all', 'lt.c8.lever', { priority: 1 }); } });
    pull({ x: 12.6, y: Y, z: -124, rot: -PI / 2, label: 'Pull the lever · opens the WEST wing file', done: 'The west file is open', isOn: () => c.get('ch8:gA', false), onPull: () => { c.set('ch8:gA', true); tell('all', 'lt.c8.lever', { priority: 1 }); } });
    const D4 = door(w, { x: 0, y: Y, z: -146, along: 'x', width: 2.4, h: 2.5, key: 'd4', locked: true, label: 'stack exit', game });
    dialPad(w, game, { x: 3.4, y: Y + 1.5, z: -145.75, rot: 0, code: CODE, onSolved: () => { D4.unlock(); w.after(0.5, () => D4.setOpen(true)); S.door(0, 0.3); tell('all', 'lt.c8.dial.ok', { priority: 2 }); fireH('whisper', { role: 'all' }); } });
    stencil(w, 'FOUR NUMBERS · TWO FILES', { x: -3.4, y: Y + 1.6, z: -145.83, rot: 0, size: 0.1, width: 2.6, color: '#a8342a' });
    const st2 = stalker(w, game, H, S, {
      y: Y,
      nodes: [{ id: 'rec', x: 0, z: -105 }, { id: 'wS', x: -12.2, z: -110 }, { id: 'wN', x: -12.2, z: -136 }, { id: 'wC', x: -8.5, z: -136 }, { id: 'wD', x: -4.5, z: -136 }, { id: 'wE', x: -1.2, z: -136 }, { id: 'wn', x: -1.5, z: -144 },
        { id: 'eS', x: 12.2, z: -110 }, { id: 'eN', x: 12.2, z: -136 }, { id: 'eC', x: 8.5, z: -136 }, { id: 'eD', x: 4.5, z: -136 }, { id: 'eE', x: 1.2, z: -136 }, { id: 'en', x: 1.5, z: -144 }, { id: 'wm', x: -8.5, z: -115 }, { id: 'em', x: 8.5, z: -115 }],
      route: ['rec', 'wS', 'wN', 'wC', 'wD', 'wE', 'wn', 'en', 'eE', 'eD', 'eC', 'eN', 'eS', 'rec'], start: 'rec', speed: 2.0, chaseSpeed: 5.5, sight: 15, fov: 0.95, pause: 2.0, home: 'rec',
    });
    st2.setActive(false);
    for (const h of [{ x: -12.2, z: -121, w: 1.8, d: 6 }, { x: 12.2, z: -121, w: 1.8, d: 6 }, { x: -4.5, z: -122, w: 2.6, d: 7 }, { x: 4.5, z: -125, w: 2.6, d: 7 }, { x: -8.5, z: -123, w: 2.6, d: 7 }, { x: 8.5, z: -120, w: 2.6, d: 7 }]) st2.hideSpot(h);
    // knock the book trolley over to draw him off the reception
    w.interactable({ x: 0, y: Y + 0.6, z: -107.6, w: 1.2, h: 1, d: 0.8, range: 3, label: 'Tip the book cart', onUse: () => { S.slam(0.3); st2.noise(-12, -132, 30); } });
    box(w, { x: 0, y: Y + 0.45, z: -108.5, w: 1.0, h: 0.9, d: 0.5, kind: 'wood', color: 0x5a4a3a });
    stage(w, 'z4-in', { x: -5.5, y: Y + 1, z: -103, w: 6, h: 3, d: 2 }, () => {
      tell('all', 'lt.c8.stacks', { priority: 1 }); w.after(16, () => tell('all', 'lt.c8.stacks.lever', { priority: 1 })); w.after(60, () => { if (!c.get('ch8:gA', false) && !c.get('ch8:gB', false)) tell('all', 'lt.c8.stacks.hint', { priority: 1 }); });
      w.after(30, () => R.whisper({ keyholder: 'lt.c8.k.stacks', subject: 'lt.c8.s.stacks' }));
    });
    stage(w, 'z4-north', { x: 0, y: Y + 1, z: -137, w: 26, h: 3, d: 2 }, () => { tell('all', 'lt.c8.stacks.dial', { priority: 1 }); w.after(12, () => fireH('behind', { kind: 'patient', role: R.subject, dist: 3.2 })); });

    // =========================================================================================================================
    // 5 · THE THEATRE GALLERY (y=5) — winches across the pit, two reels, the film
    // =========================================================================================================================
    const th = room(w, { x: 0, z: -172, w: 26, d: 52, y: Y, h: 10, doors: { n: [{ c: 0, w: 2.4 }] }, sides: { s: false }, floorKind: 'concrete', wallKind: 'plaster' });
    th.floor.body.enabled = false; th.floor.group.visible = false;
    const sl = (x, z0, z1, wd) => slab(w, { x, z: (z0 + z1) / 2, y: Y, w: wd, d: Math.abs(z1 - z0), h: 0.6 });
    sl(0, -146, -156, 26);                                                    // the foyer
    sl(-11.5, -156, -171, 3); sl(-11.5, -177, -192, 3); sl(11.5, -156, -173, 3); sl(11.5, -179, -192, 3);       // the galleries (gaps in each)
    sl(0, -192, -198, 26);                                                    // the back of the house: projector booth
    hp(w, { x: 0, z: -174, y: 2.4, w: 20, d: 36, h: 1, kind: 'lino', color: 0x3a3d3a, path: false });             // the pit
    stairs(w, { x: 0, z: -156, dir: '-z', y0: Y, y1: 2.4, width: 3 });
    for (const rail of [-10, 10]) for (let z = -157; z > -192; z -= 3.5) box(w, { x: rail, y: Y + 0.55, z, w: 0.06, h: 1.1, d: 0.06, kind: 'rust', color: 0x55605c, shadow: false });
    for (const rail of [-10, 10]) box(w, { x: rail, y: Y + 1.1, z: -174, w: 0.05, h: 0.05, d: 36, kind: 'rust', color: 0x55605c, shadow: false });
    // drowned stalls in the pit and a stage curtain at the far end
    for (let r = 0; r < 5; r++) for (let s = -3; s <= 3; s++) if (s !== 0) box(w, { x: s * 2.4, y: 2.4 + 0.3, z: -168 - r * 4.2, w: 1.5, h: 0.6, d: 0.9, kind: 'wood', color: 0x3a2a24, rot: (r + s) * 0.03 * ((r * 7 + s) % 3 - 1), shadow: false });
    curtain(w, { x: -4, z: -192.3, width: 7, rot: 0, h: 5 }); curtain(w, { x: 4, z: -192.3, width: 7, rot: 0, h: 5 });
    stencil(w, 'THE THEATRE · GALLERY', { x: 0, y: Y + 3.2, z: -146.17, rot: PI, size: 0.17, width: 4.4 });
    const W5 = HY.water({ x: 0, z: -174, w: 19.7, d: 35.7, floorY: 2.4, height: 7, flecks: 90, caustics: 2.2, level: (t) => ({ y: 2.55 + 1.15 * smooth((t - 120) / 520), warn: 0 }) });
    void W5;
    lampRow([[-8, -150, 'buzz', 1.6], [8, -150, 'dying', 1.6], [-11.5, -163, 'steady', 1.2], [11.5, -165, 'dying', 1.2], [-11.5, -185, 'buzz', 1.2], [11.5, -185, 'steady', 1.2], [0, -195, 'dead'], [0, -175, 'dead', 2.4]], Y + 9.9);
    for (let x = -9; x <= 9; x += 6) H.lamp({ x, y: 4.7, z: -156.6, mode: 'dying', len: 0.6, power: 0.15, color: 0xffb070, shaft: false });
    decals([['hand', 41, -12.84, Y + 1.0, -165, 0.5, 0.5, 'w'], ['scratch', 42, 12.84, Y + 1.7, -184, 1.6, 1.6, 'e'], ['splat', 43, -11.5, Y + 0.02, -188, 2.4, 2.4], ['drag', 44, 0, Y + 0.02, -150, 5, 3, 'floor', 0.2]]);
    wheelchair(w, { x: 5, z: -152, rot: 1 }); gurney(w, { x: -6, z: -149, rot: 0.4 });
    checkpoint(w, { x: 0, y: Y, z: -147.5 });
    // the winches: each one extends the bridge on the OTHER gallery (the cables run across the pit)
    const BW = crankBridge(w, HY, H, { x: -11.5, y: Y, z: -174, len: 6.4, axis: 'z', stations: [{ x: 11.4, y: Y, z: -186, text: 'WINCH · EAST', rot: -PI / 2 }] });
    const BE = crankBridge(w, HY, H, { x: 11.5, y: Y, z: -176, len: 6.4, axis: 'z', stations: [{ x: -11.4, y: Y, z: -161, text: 'WINCH · WEST', rot: PI / 2 }] });
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x1b2024 });
    for (const [x0, z0, x1, z1] of [[-11.4, -161, 11.5, -176], [11.4, -186, -11.5, -174]]) {
      const len = Math.hypot(x1 - x0, z1 - z0), m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 5), cableMat);
      m.position.set((x0 + x1) / 2, Y + 3.5, (z0 + z1) / 2); m.rotation.z = PI / 2; m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); w.add(m);
    }
    // the pit's keeper: he walks the pit and follows you from below. fall in and he is waiting.
    const st3 = stalker(w, game, H, S, {
      y: 2.4,
      nodes: [{ id: 'a', x: 0, z: -162 }, { id: 'b', x: -6, z: -170 }, { id: 'c', x: 6, z: -170 }, { id: 'd', x: -6, z: -186 }, { id: 'e', x: 6, z: -186 }, { id: 'f', x: 0, z: -190 }, { id: 'g', x: 0, z: -176 }],
      route: ['a', 'b', 'd', 'f', 'e', 'c', 'g'], start: 'g', speed: 1.7, chaseSpeed: 4.0, sight: 16, fov: 1.2, pause: 3, home: 'a', slow: () => 0.75,
    });
    st3.setActive(false);
    // the reels, the projector and the film
    const reel = (id, x, z, label) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 18), new THREE.MeshStandardMaterial({ color: 0x7a7e7a, roughness: 0.4, metalness: 0.8 })); m.position.set(x, Y + 0.9, z); m.rotation.x = PI / 2; w.add(m);
      const held = { v: false };
      w.interactable({ x, y: Y + 1.3, z, w: 0.8, h: 0.9, d: 0.8, range: 3, label: () => (held.v ? 'You are carrying the reel' : label), enabled: () => !held.v && !c.get('ch8:l' + id, false), onUse: () => { held.v = true; m.visible = false; S.step(0, 0.08); tell(me, 'lt.c8.reel', { priority: 1 }); } });
      return held;
    };
    const reelA = reel('a', -11.5, -188.5, 'Take reel A'), reelB = reel('b', 11.5, -190, 'Take reel B');
    box(w, { x: 0, y: Y + 1.3, z: -196, w: 1.6, h: 1.0, d: 1.0, kind: 'rust', color: 0x3c4742 }); w.collider({ x: 0, y: Y + 1.0, z: -196, w: 1.6, h: 2.0, d: 1.0 });
    box(w, { x: 0, y: Y + 2.0, z: -196, w: 0.5, h: 0.4, d: 0.7, kind: 'rust', color: 0x1f2528 });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0c8).multiplyScalar(2), toneMapped: false })); lens.position.set(0, Y + 2.0, -195.6); lens.rotation.y = PI; w.add(lens);
    for (const [id, x, held, lab] of [['a', -0.55, reelA, 'Load reel A'], ['b', 0.55, reelB, 'Load reel B']]) {
      w.interactable({ x, y: Y + 1.4, z: -194.9, w: 0.7, h: 0.8, d: 0.6, range: 3, label: () => (c.get('ch8:l' + id, false) ? 'Reel ' + id.toUpperCase() + ' loaded' : held.v ? lab : 'Needs reel ' + id.toUpperCase()), enabled: () => held.v && !c.get('ch8:l' + id, false), onUse: () => { held.v = false; c.set('ch8:l' + id, true); S.door(0, 0.1); } });
    }
    // the screen is on the foyer wall (turn round)
    const cv = document.createElement('canvas'); cv.width = 768; cv.height = 336; const g2 = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(11, 4.8), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.2, 1.2, 1.2) })); screen.position.set(0, Y + 5.8, -146.25); screen.rotation.y = PI; w.add(screen);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(5.4, 48, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.85, 0.7), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
    beam.position.set(0, Y + 3.3, -172); beam.rotation.x = -PI / 2; w.add(beam);                                  // apex at the projector, opening toward the screen
    const FILM = 30;
    const frames = [
      [0, 'LOWTIDE MEMORIAL HOSPITAL', 'Staff film · reel 1 of 2'],
      [5, 'E. HALE · ORDERLY', 'forty-one years of nights'],
      [10, 'THE NIGHT OF THE HIGH TIDE', 'the ward doors were bolted from the corridor'],
      [15, 'HE WAS TOLD TO HOLD THE DOORS', 'the attending physician held the only key'],
      [20, 'HE HELD THEM', 'the water did not ask him to stop'],
      [25, 'HE IS STILL HOLDING THEM', 'who are you holding them for?'],
    ];
    const drawFilm = (u) => {
      g2.fillStyle = '#0a0c0a'; g2.fillRect(0, 0, 768, 336);
      const i = frames.reduce((a, f, k) => (u >= f[0] ? k : a), 0), f = frames[i];
      const n = Math.sin(u * 40 + i) * 0.5 + 0.5;
      g2.fillStyle = `rgba(230,225,200,${0.85 - 0.25 * n})`; g2.font = '700 44px "Courier New", monospace'; g2.textAlign = 'center'; g2.fillText(f[1], 384, 150);
      g2.font = '24px "Courier New", monospace'; g2.fillStyle = 'rgba(200,196,170,0.8)'; g2.fillText(f[2], 384, 200);
      for (let k = 0; k < 90; k++) { g2.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`; g2.fillRect(Math.random() * 768, Math.random() * 336, 1 + Math.random() * 3, 1 + Math.random() * 30); }
      if (u > 22) { g2.fillStyle = `rgba(0,0,0,${(u - 22) / 10})`; g2.beginPath(); g2.arc(384 + Math.sin(u * 3) * 6, 170, 90 + (u - 22) * 8, 0, 7); g2.fill(); }
      if (u > 26) { g2.fillStyle = 'rgba(210,205,190,0.9)'; g2.beginPath(); g2.ellipse(384, 170, 52, 72, 0, 0, 7); g2.fill(); g2.fillStyle = '#050505'; g2.beginPath(); g2.ellipse(364, 160, 8, 12, 0, 0, 7); g2.ellipse(404, 160, 8, 12, 0, 0, 7); g2.fill(); g2.fillRect(366, 205, 38, 3); }
      g2.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < 336; y += 4) g2.fillRect(0, y, 768, 1);
      tex.needsUpdate = true;
    };
    drawFilm(0);
    let filmOn = false, filmEnded = false, filmLines = 0;
    const filmSay = [[1, 'lt.c8.film.1'], [6, 'lt.c8.film.2'], [11, 'lt.c8.film.3'], [16, 'lt.c8.film.4'], [21, 'lt.c8.film.5'], [26, 'lt.c8.film.6']];
    const D5 = door(w, { x: 0, y: Y, z: -198, along: 'x', width: 2.4, h: 2.5, key: 'd5', locked: true, label: 'house door', game });
    w.updaters.push(() => {
      if (!c.isHost || c.get('ch8:film', null) != null) return;
      if (c.get('ch8:la', false) && c.get('ch8:lb', false)) c.set('ch8:film', w.t);
    });
    c.on('ch8:film', (v) => { if (v != null && !filmOn) { filmOn = true; tell('all', 'lt.c8.film.start', { priority: 2 }); S.door(0, 0.3); } });
    w.updaters.push(() => {
      const f0 = c.get('ch8:film', null); if (f0 == null || filmEnded) return;
      const u = w.t - f0; drawFilm(Math.min(FILM, Math.max(0, u)));
      beam.material.opacity = 0.05 + 0.025 * Math.sin(w.t * 30);
      while (filmLines < filmSay.length && u >= filmSay[filmLines][0]) { tell('all', filmSay[filmLines][1] + (heardTape ? '.b' : ''), { priority: 2 }); filmLines++; }
      if (u >= FILM) {
        filmEnded = true; beam.material.opacity = 0; drawFilm(27);
        Z.blackout(2.2); S.sting(0.5); st3.setActive(false);
        D5.unlock(); w.after(1.0, () => D5.setOpen(true));
        w.after(0.2, () => { st4.warp(-9.5, -190); st4.setActive(true); st4.hunt = true; });
        w.after(1.4, () => tell('all', 'lt.c8.film.end', { priority: 2 }));
        if (c.isHost && c.get('ch8:run', null) == null) c.set('ch8:run', w.t);
      }
    });
    stage(w, 'z5-in', { x: 0, y: Y + 1, z: -149, w: 26, h: 3, d: 2 }, () => { tell('all', 'lt.c8.theatre', { priority: 1 }); w.after(18, () => tell('all', 'lt.c8.winch', { priority: 1 })); w.after(55, () => R.whisper({ keyholder: 'lt.c8.k.theatre', subject: 'lt.c8.s.theatre' })); });
    stage(w, 'z5-back', { x: 0, y: Y + 1, z: -193, w: 26, h: 3, d: 2 }, () => { tell('all', 'lt.c8.booth', { priority: 1 }); });

    // =========================================================================================================================
    // 6 · THE LONG RUN (y=5) — a hundred metres of corridor, three shutters, and the Orderly behind you
    // =========================================================================================================================
    room(w, { x: 0, z: -248, w: 6, d: 100, y: Y, h: 3.8, sides: { s: false }, doors: { n: [{ c: 0, w: 2.4 }] }, floorKind: 'tile', wallKind: 'tile' });
    stencil(w, 'EAST SERVICE · TO THE SEA GATE', { x: -2.83, y: Y + 2.9, z: -206, rot: PI / 2, size: 0.15, width: 3.4 });
    const W6 = HY.water({ x: 0, z: -248, w: 5.7, d: 99.7, floorY: Y, height: 3.8, flecks: 90, caustics: 1.6, level: (t) => { const r = c.get('ch8:run', null); if (r == null) return { y: Y - 0.5, warn: 0 }; return { y: Y - 0.3 + 1.0 * smooth((t - r) / 110), warn: 1 }; } });
    void W6;
    lampRow([[0, -205, 'steady', 1.4, PI / 2], [0, -214, 'dying', 1.4, PI / 2], [0, -231, 'buzz', 1.4, PI / 2], [0, -240, 'dead', 1.4, PI / 2], [0, -257, 'strobe', 1.2, PI / 2], [0, -266, 'buzz', 1.4, PI / 2], [0, -283, 'dying', 1.4, PI / 2], [0, -292, 'steady', 1.4, PI / 2]], Y + 3.75);
    pipes(w, { x0: -2.3, z0: -199, x1: -2.3, z1: -297, y: Y + 3.3, n: 2 });
    for (const [z, k] of [[-208, 1], [-220, -1], [-236, 1], [-245, -1], [-262, 1], [-271, -1], [-286, 1]]) {
      decal(w, { kind: ['hand', 'scratch', 'splat', 'hand', 'drag', 'scratch', 'hand'][(-z) % 7], seed: -z, x: k * 2.84, y: Y + 1.4, z, w: 1.2, h: 1.2, face: k > 0 ? 'e' : 'w' });
    }
    wheelchair(w, { x: 1.7, z: -210, rot: 0.4 }); gurney(w, { x: -1.5, z: -240, rot: 1.58 });
    locker(w, { x: -2.55, z: -216, rot: PI / 2 }); locker(w, { x: 2.55, z: -255, rot: -PI / 2 }); locker(w, { x: -2.55, z: -279, rot: PI / 2 });
    const SH = [-225, -250, -275].map((z, i) => shutter(w, game, HY, H, { y: Y, z, key: 'sh' + i, near: { x: -1.9, y: Y, z: z + 3.6, text: 'SHUTTER · SOUTH', rot: PI / 2 }, far: { x: 1.9, y: Y, z: z - 3.6, text: 'SHUTTER · NORTH', rot: -PI / 2 } }));
    checkpoint(w, { x: 0, y: Y, z: -201.5 }); checkpoint(w, { x: 0, y: Y, z: -230 }); checkpoint(w, { x: 0, y: Y, z: -255 }); checkpoint(w, { x: 0, y: Y, z: -280 });
    const nodes4 = [-205, -216, -233, -244, -258, -269, -283, -292].map((z, i) => ({ id: 'n' + i, x: 0, z }));
    const closedAt = (z) => SH.some((D) => Math.abs(z - D.z) < 0.7 && D.k < 0.6);
    const st4 = stalker(w, game, H, S, {
      y: Y, nodes: nodes4, route: ['n0', 'n1'], start: 'n0', speed: 2.0, chaseSpeed: 5.0, sight: 40, fov: 1.3, hear: 12, home: 'n0', slow: (x, z) => (closedAt(z) ? 0 : 1),
    });
    st4.setActive(false);
    for (const [a, b, i] of [['n1', 'n2', 0], ['n3', 'n4', 1], ['n5', 'n6', 2]]) st4.link(a, b, () => SH[i].k > 0.6);
    st4.hideSpot({ x: -2.55, z: -216, w: 1.4, d: 1.4 }); st4.hideSpot({ x: 2.55, z: -255, w: 1.4, d: 1.4 }); st4.hideSpot({ x: -2.55, z: -279, w: 1.4, d: 1.4 });
    // he bangs on a shut shutter and, after a few seconds, takes it by force
    const stuck = [0, 0, 0]; let bang = 0;
    w.updaters.push((dt) => {
      if (!st4.on || !st4.hunt) return;
      SH.forEach((D, i) => {
        const near = Math.abs(st4.z - D.z) < 3.4 && st4.z > D.z && D.k < 0.6;
        stuck[i] = near ? stuck[i] + dt : Math.max(0, stuck[i] - dt);
        if (near && st4.state !== 'idle') { bang -= dt; if (bang <= 0) { bang = 1.1; S.slam(0.22 * Math.max(0.2, 1 - st4.myDist / 40)); } }
        if (stuck[i] > 6.5 && c.isHost) { stuck[i] = 0; D.forced = 2.5; }
      });
    });
    // narration along the run
    stage(w, 'z6-start', { x: 0, y: Y + 1, z: -201, w: 6, h: 3, d: 2 }, () => { tell('all', 'lt.c8.run', { priority: 2 }); S.groan(0.3); });
    stage(w, 'z6-s1', { x: 0, y: Y + 1, z: -228, w: 6, h: 3, d: 1.5 }, () => tell('all', 'lt.c8.run.shutter', { priority: 2 }));
    stage(w, 'z6-mid', { x: 0, y: Y + 1, z: -254, w: 6, h: 3, d: 1.5 }, () => { w.after(2, () => fireH('behind', { kind: 'patient', role: 'all', dist: 3 })); tell('all', 'lt.c8.run.mid', { priority: 2 }); });
    stage(w, 'z6-s3', { x: 0, y: Y + 1, z: -279, w: 6, h: 3, d: 1.5 }, () => tell('all', 'lt.c8.run.last', { priority: 2 }));

    // =========================================================================================================================
    // 7 · THE SEA DOOR (y=5) — a lever each, in private, ninety seconds
    // =========================================================================================================================
    const sea = room(w, { x: 0, z: -318, w: 26, d: 40, y: Y, h: 11, doors: { s: [{ c: 0, w: 2.4 }], n: [{ c: 0, w: 5 }] }, floorKind: 'concrete', wallKind: 'tile', ceilKind: 'concrete' });
    void sea;
    const D6 = door(w, { x: 0, y: Y, z: -298, along: 'x', width: 2.4, h: 2.5, key: 'd6', label: 'corridor door', game });
    const SD = door(w, { x: 0, y: Y, z: -338, along: 'x', width: 5, h: 4, key: 'sea', locked: true, label: 'sea door', game });
    box(w, { x: 0, y: Y + 4.5, z: -338, w: 5.4, h: 1.0, d: 0.5, kind: 'rust', color: 0x4a5752 });
    for (const sx of [-1, 1]) box(w, { x: sx * 2.75, y: Y + 2, z: -337.9, w: 0.3, h: 4, d: 0.5, kind: 'rust', color: 0x4a5752 });
    stencil(w, 'THE SEA DOOR', { x: 0, y: Y + 6.2, z: -337.83, rot: 0, size: 0.3, width: 5.6 });
    stencil(w, 'ONE KEY · ONE DOOR', { x: 0, y: Y + 7.4, z: -337.83, rot: 0, size: 0.14, width: 3.6, color: '#a8342a' });
    lampRow([[-6, -308, 'dying', 1.8], [6, -308, 'buzz', 1.8], [-6, -326, 'buzz', 1.8], [6, -326, 'dying', 1.8], [0, -318, 'dead', 2.6]], Y + 10.9);
    H.lamp({ x: 0, y: Y + 4.9, z: -336, mode: 'steady', len: 2.4, color: 0xffd8a0, power: 0.9 });
    pipes(w, { x0: -12.4, z0: -300, x1: -12.4, z1: -336, y: Y + 9, n: 3 }); pipes(w, { x0: 12.4, z0: -300, x1: 12.4, z1: -336, y: Y + 9, n: 3 });
    decals([['puddle', 51, 0, Y + 0.025, -312, 6, 6], ['drag', 52, 0, Y + 0.02, -326, 3, 8, 'floor', 1.57], ['hand', 53, -12.84, Y + 2, -322, 0.6, 0.6, 'w'], ['hand', 54, 12.84, Y + 2, -322, 0.6, 0.6, 'e']]);
    const t0 = () => c.get(SEA.t0, null);
    const endV = () => c.get('ch8:end', null);
    const seaY = (t) => {
      const e = endV(), s = t0();
      if (s == null) return Y - 0.6;
      const rise = (tt) => Y - 0.6 + 3.2 * smooth((tt - s) / SEA.secs);
      if (!e) return rise(t);
      const yEnd = rise(e.at);
      if (e.name === 'together' || e.name === 'alone') return Math.max(Y + 0.1, yEnd - (t - e.at) * (e.name === 'together' ? 0.9 : -0.15));
      return Math.min(Y + 12, yEnd + (t - e.at) * 0.9);                                // the tide: it keeps coming
    };
    const W7 = HY.water({ x: 0, z: -318, w: 25.7, d: 39.7, floorY: Y, height: 11, flecks: 130, caustics: 2.2, level: (t) => ({ y: seaY(t), warn: t0() != null && !endV() ? 1 : 0 }) });
    for (const [x, z, rot] of [[-12.84, -306, PI / 2], [12.84, -306, -PI / 2], [-12.84, -330, PI / 2], [12.84, -330, -PI / 2]]) HY.gauge({ x, z, rot, floorY: Y, h: 7, water: W7, lethal: 1.7 });
    HY.beacon({ x: -3, y: Y + 10.5, z: -300, water: W7 }); HY.beacon({ x: 3, y: Y + 10.5, z: -300, water: W7 });
    // booths: p1 on the west side, p2 on the east; stairs up from the chamber floor
    const booth = (side, owner) => {
      const x = side * 10.5, sx = side * 10.2;
      const st = stairs(w, { x: sx, z: -306, dir: '-z', y0: Y, y1: Y + 3.2, width: 2.4 });
      const bz = (st.z + -318) / 2;
      slab(w, { x, z: bz, y: Y + 3.2, w: 5, d: Math.abs(st.z + 318), h: 0.5 });
      wall(w, { x: side * 8.0, z: bz, w: 0.3, d: Math.abs(st.z + 318), y: Y + 3.2, h: 1.1, kind: 'tile' });
      wall(w, { x: side * 10.5, z: -318.2, w: 5, d: 0.3, y: Y + 3.2, h: 3.4, kind: 'tile' });
      wall(w, { x: side * 12.9, z: bz, w: 0.2, d: Math.abs(st.z + 318), y: Y + 3.2, h: 3.4, kind: 'tile' });
      box(w, { x: side * 12.7, y: Y + 3.2 + 1.9, z: bz, w: 0.1, h: 2.2, d: 4.2, kind: 'rust', color: 0x2c3330 });
      H.lamp({ x, y: Y + 6.5, z: bz, mode: 'buzz', len: 1.0, power: 0.6, color: owner === 'p1' ? 0xffb070 : 0x80e0d0, shaft: false });
      const grp = new THREE.Group(); w.add(grp); grp.visible = me === owner;
      const plateCv = document.createElement('canvas'); plateCv.width = 512; plateCv.height = 256; const pg = plateCv.getContext('2d');
      const ptx = new THREE.CanvasTexture(plateCv); ptx.colorSpace = THREE.SRGBColorSpace;
      const drawPlate = () => {
        const pick = c.get('ch8:pick:' + owner, null);
        pg.fillStyle = '#0a0f0d'; pg.fillRect(0, 0, 512, 256); pg.strokeStyle = '#7aa89a'; pg.lineWidth = 4; pg.strokeRect(6, 6, 500, 244);
        pg.textAlign = 'center'; pg.fillStyle = '#cfe4de'; pg.font = '700 30px Impact, sans-serif';
        pg.fillText(pick ? 'CHOICE MADE' : 'YOURS ALONE', 256, 56);
        pg.font = '700 22px "Courier New", monospace'; pg.fillStyle = '#7fb4a2';
        pg.fillText(pick ? 'it cannot be changed' : 'your partner cannot see this', 256, 96);
        if (!pick) { pg.fillStyle = '#58f0a0'; pg.fillText('LEFT · OPEN THE DOOR FOR BOTH', 256, 160); pg.fillStyle = '#ff6a58'; pg.fillText(owner === R.keyholder ? 'RIGHT · TAKE THE ONLY KEY AND GO' : 'RIGHT · TURN AWAY AND LEAVE', 256, 205); }
        ptx.needsUpdate = true;
      };
      drawPlate(); c.on('ch8:pick:' + owner, drawPlate);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: ptx, toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.1) })); plate.position.set(side * 12.62, Y + 3.2 + 2.9, bz); plate.rotation.y = side > 0 ? -PI / 2 : PI / 2; grp.add(plate);
      const rot = side > 0 ? -PI / 2 : PI / 2;
      for (const [dz, kind] of [[-side * 1.05, 'open'], [side * 1.05, 'go']]) {
        const lv = pull({
          x: side * 12.5, y: Y + 3.2, z: bz + dz, rot, color: kind === 'open' ? 0x58f0a0 : 0xff5a48, isOn: () => c.get('ch8:pick:' + owner, null) === kind, enabled: () => me === owner && !c.get('ch8:pick:' + owner, null) && !endV(),
          label: kind === 'open' ? 'Pull · OPEN THE DOOR FOR BOTH' : (owner === R.keyholder ? 'Pull · TAKE THE ONLY KEY AND GO' : 'Pull · TURN AWAY AND LEAVE'), done: 'It is done',
          onPull: () => { c.set('ch8:pick:' + owner, kind); tell('all', 'lt.c8.chosen', { priority: 2 }); },
        });
        lv.visible = me === owner;
      }
      return { bz };
    };
    booth(-1, 'p1'); booth(1, 'p2');
    const T = timerHud(w);
    const cards = cardOverlay(w);
    stage(w, 'z7-in', { x: 0, y: Y + 1, z: -303, w: 26, h: 3, d: 2.5 }, () => {
      if (c.isHost && t0() == null) c.set(SEA.t0, w.t);
      S.slam(0.4); Z.knock({ n: 4 }); H.stutter(1.4);
      tell('all', 'lt.c8.sea', { priority: 2 });
      w.after(9, () => tell('all', 'lt.c8.sea.2', { priority: 1 }));
      w.after(18, () => R.whisper({ keyholder: tookKey ? 'lt.c8.k.sea.key' : 'lt.c8.k.sea', subject: lockedIn ? 'lt.c8.s.sea.locked' : 'lt.c8.s.sea' }));
      w.after(34, () => tell(R.subject, trusted(R.subject) ? 'lt.c8.s.sea.trust' : 'lt.c8.s.sea.doubt', { priority: 1 }));
      w.after(46, () => tell('all', 'lt.c8.sea.3', { priority: 1 }));
    });
    // both through the corridor door: it shuts behind you and he stands on the other side
    c.zone({ x: 0, y: Y + 1.5, z: -304, w: 24, h: 3, d: 5, need: 'both', shrink: 0 }).onChange((zn) => {
      if (zn.active && !c.get('ch8:d6', false)) { c.set('ch8:d6', true); D6.setOpen(false); D6.lock(); S.slam(0.55); st4.hunt = false; w.after(3, () => st4.setActive(false)); Z.knock({ n: 3 }); }
    });
    let warned = 0;
    w.updaters.push((dt) => {
      const s = t0(), e = endV();
      if (s == null || e) { if (e) T.hide(); return; }
      const left = SEA.secs - (w.t - s);
      T.set('THE SEA DOOR', Math.max(0, left), left < 20);
      if (left < 60 && warned < 1) { warned = 1; tell('all', 'lt.c8.sea.60', { priority: 2 }); }
      if (left < 30 && warned < 2) { warned = 2; tell('all', 'lt.c8.sea.30', { priority: 2 }); S.alarm(0.08); }
      if (left < 10 && warned < 3) { warned = 3; tell('all', 'lt.c8.sea.10', { priority: 2 }); S.alarm(0.12); }
      if (c.isHost) {                                                                      // the host decides (one authority, both machines follow)
        const pk = c.get('ch8:pick:' + R.keyholder, null), ps = c.get('ch8:pick:' + R.subject, null);
        if ((pk && ps) || left <= 0) {
          let name = 'tide';
          if (pk === 'go' && ps !== 'go') name = 'alone';
          else if (pk === 'open' && ps === 'open') name = 'together';
          c.set('ch8:end', { name, at: w.t, k: pk || 'none', s: ps || 'none' });
        }
      }
      void dt;
    });
    let pickLine = 0;
    for (const role of ['p1', 'p2']) c.on('ch8:pick:' + role, (v) => { if (v && ++pickLine === 1 && role !== me) tell(me, 'lt.c8.theirs', { priority: 2 }); });

    // ---- the endings -------------------------------------------------------------------------------------------------------
    const pierG = pier(w, { z0: -338.4, len: 48 });
    const dawn = { k: 0, on: false };
    for (const o of [pierG.sea, pierG.sky, pierG.sun]) o.visible = false;
    const fog = w.scene.fog, fogBase = { c: fog.color.clone(), d: fog.density }, fogDawn = new THREE.Color(0xb59a86);
    const prevF = w.hooks.frame;
    w.hooks.frame = (dt, g) => {
      prevF?.(dt, g);
      dawn.k += ((dawn.on ? 1 : 0) - dawn.k) * Math.min(1, dt * 0.5);
      if (dawn.on && !pierG.sky.visible) for (const o of [pierG.sea, pierG.sky, pierG.sun]) o.visible = true;
      if (dawn.k > 0.01) { fog.color.lerpColors(fogBase.c, fogDawn, dawn.k); fog.density = lerp(fogBase.d, 0.012, dawn.k); pierG.light.intensity = 1.6 * dawn.k; w.scene.background = new THREE.Color(0x020406).lerp(new THREE.Color(0xe8c9a0), dawn.k); g.fx.tint = [1 + 0.08 * dawn.k, 1, 1 - 0.1 * dawn.k]; }
    };
    const recordEnding = (name) => { const cs = game.cs('lowtide'); cs.endings = { ...(cs.endings || {}), [name]: true }; cs.lastEnding = name; };
    const completeSoon = () => { const go = () => { if (game.state === 'playing') game.completeLevel(); else setTimeout(go, 400); }; go(); };
    const ENDINGS = { together: 'OUT TOGETHER', alone: 'OUT ALONE', tide: 'THE TIDE TAKES THE WARD' };
    let ended = null;
    w.hooks.endScreen = () => {
      if (!ended) return null;
      const cs = game.cs('lowtide'), n = Object.keys(cs.endings || {}).length;
      return { eyebrow: 'LOWTIDE · ENDING ' + (['together', 'alone', 'tide'].indexOf(ended) + 1) + ' OF 3', title: ENDINGS[ended], next: ({
        together: 'You walked out into the dawn together. The Night Desk has nothing left to say.',
        alone: 'One of you walked out. The other is still down there, and the intercom knows your name.',
        tide: 'The ward is dry. The wristbands are on. Somebody is waking up.' })[ended] + `  (${n} of 3 endings found)` };
    };
    game.level.completeQuip = 'The tide goes out. Whatever you decided stays decided.';
    c.on('ch8:end', async (e) => {
      if (!e || ended) return;
      ended = e.name; HY.bot = true; T.hide();
      recordEnding(e.name);
      if (e.s === 'open' || e.name === 'together') R.flag('forgave', e.name === 'together');
      R.flag('ch8-ending', e.name);
      const K = nm(R.keyholder), Sj = nm(R.subject);
      if (e.name === 'together') {
        SD.unlock(); w.after(0.4, () => SD.setOpen(true)); S.groan(0.4); S.door(0, 0.4); dawn.on = true; H.force(null);
        tell('all', 'lt.c8.end.t1', { priority: 2 });
        w.after(9, () => tell('all', 'lt.c8.end.t2', { priority: 2 })); w.after(19, () => tell('all', 'lt.c8.end.t3', { priority: 1 }));
        // the pier: when both of you reach the end, the cards run
        c.zone({ x: 0, y: Y + 1.5, z: -372, w: 10, h: 3, d: 6, need: 'both', shrink: 0 }).onChange((zn) => { if (zn.active && c.isHost) c.emit('ch8:fin', e); });
      } else if (e.name === 'alone') {
        S.groan(0.4); w.after(1.0, () => { SD.unlock(); SD.setOpen(true); });
        tell('all', 'lt.c8.end.a1', { priority: 2 });
        w.after(4.5, () => {
          if (me === R.keyholder) { const g = game.player; g.x = 0; g.y = Y + 0.05; g.z = -346; g.vx = g.vy = g.vz = 0; game.yaw = 0; dawn.on = true; }
          w.after(1.2, () => { SD.setOpen(false); SD.lock(); S.slam(0.9); Z.shake(2); });
        });
        w.after(7.5, () => c.emit('ch8:fin', e));
      } else {
        H.force(0); H.torchOn = false; S.groan(0.5); Z.shake(1.5); tell('all', 'lt.c8.end.d1', { priority: 2 });
        w.after(3, () => { H.force(null); H.stutter(5); S.sting(0.5); });
        w.after(8, () => c.emit('ch8:fin', e));
      }
      void K; void Sj;
    });
    c.onEvent('ch8:fin', async (e) => {
      if (!e) return; const K = nm(R.keyholder), Sj = nm(R.subject);
      let seq = [];
      const sub = (t, ms = 4600, o = {}) => ({ t, ms, who: 'THE SUBJECT', ...o }), key = (t, ms = 4600, o = {}) => ({ t, ms, who: 'THE KEYHOLDER', ...o });
      if (e.name === 'together') {
        seq = [
          { t: '', ms: 300, bg: 0.0 },
          { t: 'The air is cold and it smells of salt and tar.', ms: 4600, who: 'DAWN', bg: 0.55 },
          { t: lockedIn ? `${K} locked a door on ${Sj} once. ${Sj} opened this one anyway.` : `${Sj} and ${K} stand on the pier and do not say anything for a long time.`, ms: 5200, who: 'DAWN' },
          { t: heardTape ? 'You still hear the tape, very quietly, behind the gulls. It is finished now.' : 'There is a gull. It is the first living thing either of you has seen in years.', ms: 5200, who: 'DAWN' },
          { t: 'On the intercom, far behind you, the Night Desk says nothing. Then: <i>Goodnight.</i>', ms: 5200, who: 'THE NIGHT DESK' },
          { t: '<b>OUT TOGETHER</b>', ms: 4200, bg: 0.96, color: '#e8d9b8' },
        ];
      } else if (e.name === 'alone') {
        seq = [
          sub(`The sea door is closing. ${K}’s face is in the gap, and it does not change.`, 5200, { bg: 0.92 }),
          sub('You put both hands on the steel. It is very cold. It does not move.', 4600),
          sub(lockedIn ? 'It is the same sound the lock made in the Director’s office. You were right. You were right every time.' : 'There is a wristband on your arm with someone else’s name on it. You read it again.', 5600),
          sub('The water is at your knees. It is almost gentle.', 4200),
          sub('Behind you, in the dark, wheels. Slowly. Then he stands beside you and, for once, he is not looking at you. He is looking at the door.', 6400),
          { t: '', ms: 1200, bg: 1 },
          key('Gulls. A grey and gold sea. The pier is wet under your shoes.', 4800, { bg: 0.55 }),
          key(tookKey ? 'The key is still in your hand. It was always going to be in your hand.' : 'The key is in your hand. You do not remember picking it up.', 5200),
          key(`The intercom, behind you, soft as a hand on the back of the neck: <i>Good morning, ${K}.</i>`, 5800, { color: '#e8d9b8' }),
          key('<i>You did very well. Nobody else came out.</i>', 5200, { color: '#e8d9b8' }),
          { t: '<b>OUT ALONE</b>', ms: 4200, bg: 0.97, color: '#b8a890' },
        ];
      } else {
        seq = [
          { t: 'The ward goes dark in order, bed by bed.', ms: 4200, who: 'THE TIDE', bg: 0.9 },
          { t: 'Nobody chose. That is also a choice. The Night Desk will tell you so, later, kindly.', ms: 5200, who: 'THE TIDE' },
          { t: '…', ms: 2200, bg: 1 },
          { t: `You wake in a bed. A strap across your chest. A wristband on your arm.`, ms: 4600, who: 'INTAKE' },
          { t: `The name on it is ${me === R.keyholder ? Sj : K}. It is not yours.`, ms: 4800, who: 'INTAKE' },
          { t: `<i>"Good evening,"</i> says the intercom, tired and kind. <i>"Please do not be alarmed."</i>`, ms: 5200, who: 'THE NIGHT DESK', color: '#e8d9b8' },
          { t: '<b>THE TIDE TAKES THE WARD</b>', ms: 4200, bg: 0.97, color: '#9ab8b0' },
        ];
      }
      await cards.play(seq);
      completeSoon();
    });

    // =========================================================================================================================
    // area control: one Orderly at a time
    // =========================================================================================================================
    const sts = [st1, st2, st3, st4]; let area = 0;
    const enter = (k, at) => { if (k <= area) return; area = k; sts.forEach((s, i) => { if (i + 1 !== k && i + 1 !== 4) s.setActive(false); }); const s = sts[k - 1]; if (at) s.warp(at.x, at.z); if (k !== 4) setTimeout(() => s.setActive(true), 600); };
    c.onEvent('area', (m) => { if (m) enter(m.k, m.at); });
    const areaZone = (k, box_, at) => c.zone({ ...box_, need: 'any', shrink: 0 }).onChange((zn) => { if (zn.active && k > area) c.emit('area', { k, at }); });
    areaZone(1, { x: 0, y: 1, z: -26, w: 14, h: 3, d: 1.5 }, { x: -9, z: -56 });
    areaZone(2, { x: -5.5, y: Y + 1, z: -102, w: 6, h: 3, d: 1.5 }, { x: 0, z: -105 });
    areaZone(3, { x: 0, y: Y + 1, z: -148, w: 26, h: 3, d: 1.5 }, { x: 0, z: -176 });

    // =========================================================================================================================
    // bots (the harness): the 'together' path. The Orderly never catches them; they just have to be able to do every beat.
    // =========================================================================================================================
    const pp = () => c.partner;
    const bridgeOut = (B) => () => B.out();
    const partnerAt = (px, pz, r = 1.6) => () => Math.hypot(pp().sx - px, pp().sz - pz) < r;
    botSteps(w, {
      p1: [
        { x: -5.6, z: -17, r: 1.2 }, { x: -5.6, z: -19, r: 0.4, until: done('bolt') },
        { x: 0, z: -26, r: 1 },
        { x: -13.2, z: -27.5, r: 0.5, use: true, until: () => bells >= 1 },
        { until: () => c.get('ch8:padok', false) },
        { x: 0, z: -62, r: 1 }, { x: 0, z: -68, r: 1 },
        // stair: p1 holds the west crank while p2 crosses, then crosses while p2 holds the east crank
        { x: -5.5, z: -67, r: 1 }, { x: -5.5, z: -72, r: 1 },
        { x: -6.0, z: -74.8, r: 0.45, until: () => pp().sx > 5 && Math.abs(pp().sz + 74.8) < 1.6 },
        { x: 4.8, z: zb1, r: 1.2 },
        { x: 5.5, z: -78, r: 1 }, { x: 5.5, z: -81, r: 1 },
        { x: 6.0, y: Y, z: -85.2, r: 0.45, until: () => pp().sx < -5 && pp().sy > 4.5 && Math.abs(pp().sz + 85.2) < 1.6 },
        { x: 4.8, z: z3, r: 1.2 }, { x: -4.8, z: z3, r: 1 }, { x: -5.5, z: -90, r: 1 }, { x: -5.5, z: -98, r: 1 },
        // stacks: p1 = the west wing
        { x: -5.5, z: -103, r: 1 }, { x: -8.5, z: -109, r: 1 }, { x: -12.2, z: -112, r: 0.9 }, { x: -11.6, z: -124, r: 0.8, use: true, until: () => c.get('ch8:gB', false) },
        { x: -12.2, z: -135, r: 1 }, { x: -7, z: -136.5, r: 1 }, { until: () => c.get('ch8:gA', false) },
        { x: -7, z: -139.3, r: 0.5, use: true, until: () => true },
        { x: -3, z: -143, r: 1 },
        { x: 3.0, z: -143.8, r: 1, until: () => dialDone() },
        // theatre: p1 holds the west winch while p2 crosses the east gap; then crosses the west gap while p2 holds the east winch
        { x: 0, z: -150, r: 1 }, { x: -11.4, z: -158, r: 1 }, { x: -11.4, z: -161, r: 0.45, until: () => pp().sx > 8 && pp().sz < -176 },
        { x: -11.5, z: -170, r: 1 }, { x: -11.5, z: -172, r: 1 }, { x: -11.5, z: -176, r: 1.2, until: () => true }, { x: -11.5, z: -186, r: 1 },
        { x: -11.5, z: -188.5, r: 0.9, use: true, until: () => reelA.v }, { x: -11.5, z: -190.5, r: 1 }, { x: -11.5, z: -194, r: 1 }, { x: -3, z: -194, r: 1.2 }, { x: -0.55, z: -193, r: 0.5 }, { x: -0.55, z: -194.9, r: 0.8, use: true, until: () => c.get('ch8:la', false) },
        { until: () => c.get('ch8:film', null) != null && w.t - c.get('ch8:film', 0) > 30 },
        // run
        { x: -2, z: -195.5, r: 0.8 }, { x: -2, z: -197.3, r: 0.6 }, { x: 0, z: -197.3, r: 0.6 }, { x: 0, z: -201, r: 1 },
        { x: -1.9, z: -228.6, r: 0.5, until: () => pp().sz < -226.5 && Math.abs(pp().sx - 1.9) < 1.5 && Math.abs(pp().sz + 228.4) < 1.6 }, { x: 0, z: -224, r: 1 }, { x: 0, z: -229, r: 1 },
        { x: -1.9, z: -253.6, r: 0.5, until: () => pp().sz < -251.5 && Math.abs(pp().sz + 253.4) < 1.6 }, { x: 0, z: -249, r: 1 }, { x: 0, z: -254, r: 1 },
        { x: -1.9, z: -278.6, r: 0.5, until: () => pp().sz < -276.5 && Math.abs(pp().sz + 278.4) < 1.6 }, { x: 0, z: -274, r: 1 }, { x: 0, z: -280, r: 1 },
        { x: 0, z: -296, r: 1 }, { x: 0, z: -304, r: 1 },
        // the sea door: west booth, left lever (open for both)
        { x: -10.2, z: -303, r: 1 }, { x: -10.2, z: -310.5, r: 0.9 }, { x: -11.2, z: -313.43, r: 0.4, use: true, until: () => c.get('ch8:pick:p1', null) != null },
        { until: () => c.get('ch8:end', null) != null },
        { x: 0, z: -330, r: 1.5 }, { x: 0, z: -345, r: 1.5 }, { x: 0, z: -372, r: 1.5 },
      ],
      p2: [
        { x: 5.6, z: 5.3, r: 0.45, until: done('bolt') },
        { x: 0, z: -26, r: 1 },
        { x: 13.3, z: -56, r: 1.2 }, { x: 13.3, z: -58, r: 0.4, until: () => c.get('ch8:padok', false) },
        { x: 0, z: -62, r: 1 }, { x: 0, z: -68, r: 1 },
        { x: -5.5, z: -67, r: 1 }, { x: -5.5, z: -72, r: 1 },
        { x: -4.8, z: zb1, r: 1, until: bridgeOut(B1) }, { x: 4.8, z: zb1, r: 1.2 },
        { x: 6.0, z: -74.8, r: 0.45, until: () => pp().sx > 3.5 && pp().sy > 2 && pp().sz < -73 && false || Math.hypot(pp().sx - 4.8, pp().sz - zb1) < 1.6 },
        { x: 5.5, z: -78, r: 1 }, { x: 5.5, z: -81, r: 1 },
        { x: 4.8, z: z3, r: 1, until: bridgeOut(B2) }, { x: -4.8, z: z3, r: 1.2 },
        { x: -6.0, y: Y, z: -85.2, r: 0.45, until: () => pp().sx < -3.5 && pp().sy > 4.5 && Math.abs(pp().sz - z3) < 3 && pp().sx < -4.2 },
        { x: -5.5, z: -90, r: 1 }, { x: -5.5, z: -98, r: 1 },
        // stacks: p2 = the east wing
        { x: -5.5, z: -103, r: 1 }, { x: 8.5, z: -108, r: 1 }, { x: 12.2, z: -112, r: 0.9 }, { x: 11.6, z: -124, r: 0.8, use: true, until: () => c.get('ch8:gA', false) },
        { x: 12.2, z: -135, r: 1 }, { x: 7, z: -136.5, r: 1 }, { until: () => c.get('ch8:gB', false) },
        { x: 7, z: -139.3, r: 0.5, use: true, until: () => true },
        { x: 3, z: -143, r: 1 },
        { x: 3.4, z: -143.8, r: 1, until: () => dialDone() },
        { x: 0, z: -150, r: 1 }, { x: 11.4, z: -158, r: 1 }, { x: 11.5, z: -164, r: 1 }, { x: 11.5, z: -171, r: 1, until: bridgeOut(BE) }, { x: 11.5, z: -178, r: 1.2 },
        { x: 11.4, z: -186, r: 0.45, until: () => pp().sx < -8 && pp().sz < -176 },
        { x: 11.5, z: -190, r: 0.9, use: true, until: () => reelB.v }, { x: 11.5, z: -194, r: 1 }, { x: 3, z: -194, r: 1.2 }, { x: 0.55, z: -193, r: 0.5 }, { x: 0.55, z: -194.9, r: 0.8, use: true, until: () => c.get('ch8:lb', false) },
        { until: () => c.get('ch8:film', null) != null && w.t - c.get('ch8:film', 0) > 30 },
        { x: -2, z: -195.5, r: 0.8 }, { x: -2, z: -197.3, r: 0.6 }, { x: 0, z: -197.3, r: 0.6 }, { x: 0, z: -201, r: 1 },
        { x: 0, z: -224.4, r: 1, until: () => SH[0].k > 0.9 }, { x: 0, z: -228, r: 1 }, { x: 1.9, z: -228.4, r: 0.5, until: () => pp().sz < -226.5 }, { x: 0, z: -229, r: 1 },
        { x: 0, z: -249.4, r: 1, until: () => SH[1].k > 0.9 }, { x: 0, z: -253, r: 1 }, { x: 1.9, z: -253.4, r: 0.5, until: () => pp().sz < -251.5 }, { x: 0, z: -254, r: 1 },
        { x: 0, z: -274.4, r: 1, until: () => SH[2].k > 0.9 }, { x: 0, z: -278, r: 1 }, { x: 1.9, z: -278.4, r: 0.5, until: () => pp().sz < -276.5 }, { x: 0, z: -280, r: 1 },
        { x: 0, z: -296, r: 1 }, { x: 0, z: -304, r: 1 },
        { x: 10.2, z: -303, r: 1 }, { x: 10.2, z: -310.5, r: 0.9 }, { x: 11.2, z: -315.53, r: 0.4, use: true, until: () => c.get('ch8:pick:p2', null) != null },
        { until: () => c.get('ch8:end', null) != null },
        { x: 0, z: -330, r: 1.5 }, { x: 0, z: -345, r: 1.5 }, { x: 0, z: -372, r: 1.5 },
      ],
    });
    const dialDone = () => { const v = c.get('ch8:code', null); return !!v && v.every((d, i) => d === CODE[i]); };
    w.after(3, () => tell(me, 'lt.c8.start', { priority: 2 }));
    void other; void lockerUnused; void tub; void bench; void lifebuoy; void hp; void iAmK; void P;
  },
};
const lockerUnused = null;
