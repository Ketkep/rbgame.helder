import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, lobbyShell, GOLD } from './kit.js';
import { sofa, coffeeTable, elevatorBank } from './props.js';
import { onPlat } from '../common.js';
import { trollCheckpoint, fakeExit, evasiveGoal, fakeComplete, twistZone, vanishAfter, adBreak, stageTitle, stageHint } from './trolls.js';

// Hotel level 1 — "Wet Floor" (Easy · Mezzanine). The cleaning staff mopped the lobby. All of it. The floor is lethal.
// Six stages, one checkpoint each (and one liar):
//   1 Furniture Hop   sofas, an ottoman and a coffee table to the piano · a "DRY" tile that is not
//   2 Rolling Stock   a trolley that rolls away with you on it (mind the column)
//   3 Mop-Bot Lane    a slippery runway, a mop robot (hop it), a FAKE checkpoint (crooked pole), cocktail tables up the east wall
//   4 Service Gantry  swinging trays, a crumbling plate, A/D swapped for a few seconds, a bridge that gives way once you are half over
//   5 The Climb       up the west wall to the mezzanine
//   6 Mezzanine       a fake EXIT door (a broom closet), a goal that runs away twice, a fake LEVEL COMPLETE, and a bonus climb
// Baby Mode: the fake checkpoint counts, the swap is short, the bridge waits longer, the decoy door is labelled, the goal hops once.

const NAMES = ['Furniture Hop', 'Rolling Stock', 'Mop-Bot Lane', 'Service Gantry', 'The Climb', 'Mezzanine'];

export default {
  id: 'hotel-1',
  name: 'Wet Floor',
  music: 'hotel',
  completeQuip: 'The marble is very proud of you. I\'m... fine.',

  build(w, game) {
    hotelEnv(w);
    lobbyShell(w);
    elevatorBank(w, game.campaign.tiers, { cars: false });
    w.spawn = { x: 0, y: 0.3, z: 12.5, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -30;

    // ---- the floor is (very) wet ---------------------------------------------------------------
    const slip = w.hazard({ x: 0, y: 0.1, z: -4, w: 43.5, h: 0.2, d: 39.5, color: 0x3a6aa8 });
    slip.core.material.opacity = 0.16; slip.shell.visible = false;
    const sheen = new THREE.Mesh(new THREE.PlaneGeometry(43, 39), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7ab8ff).multiplyScalar(0.9), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
    sheen.rotation.x = -Math.PI / 2; sheen.position.set(0, 0.045, -4); w.add(sheen);
    w.onUpdate((dt, t) => { sheen.material.opacity = 0.09 + Math.sin(t * 1.3) * 0.025; });
    for (const [x, z, r] of [[-6, 8, 0.6], [6, 6, -0.4], [-8, -3, 0.2], [8, -6, 2.4], [-5, -13, -0.7], [6, -16, 1.1], [-12, 10, 0.3], [12, 2, 3.8], [-9, -9, 1.7], [10, -12, 0.9]]) wetSign(w, x, z, r);
    // the "DRY" tile: a decal. The floor is the floor.
    const DRY = { x: 7, z: 9.5 };
    w.sign({ text: 'DRY ✔', x: DRY.x, y: 0.05, z: DRY.z, w: 2.6, h: 1.4, rotX: -Math.PI / 2, color: '#0b3d1f', bg: '#7de08a', border: '#0b3d1f', double: false, tw: 512, size: 150 });

    // ---- the route ----------------------------------------------------------------------------
    // stages[i].at = where you respawn once you are in it; .route = the platforms to hop (the hint follows these, never past the next stage)
    const stages = NAMES.map(() => ({ at: null, route: [] }));
    const mark = (p) => { p.o.path = true; return p; };
    const hop = (i, p) => { mark(p); stages[i].route.push({ x: p.body.x, y: p.top, z: p.body.z }); return p; };
    const start = (i, p) => { mark(p); stages[i].at = { x: p.body.x, y: p.top, z: p.body.z }; return p; };
    const pole = (x, z, top, ww, dd) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) w.box({ x: x + sx * (ww / 2 - 0.15), y: (top - 0.1) / 2, z: z + sz * (dd / 2 - 0.15), w: 0.1, h: top - 0.1, d: 0.1, color: GOLD, metal: 1, rough: 0.28, shadow: true }); };
    const marble = (o) => w.plat({ tex: 'marble', color: 0xc4c4cf, roughness: 0.14, radius: 0.05, ...o });
    // nothing floats: low slabs stand on a plinth, high ones hang from the ceiling beams on gold rods
    const plinth = (p) => w.box({ x: p.body.x, y: (p.top - p.o.h) / 2, z: p.body.z, w: p.o.w - 0.5, h: p.top - p.o.h, d: p.o.d - 0.5, tex: 'marble', color: 0x9a9aa8, rough: 0.3, shadow: false });
    const hang = (p, n = 2) => { for (let k = 0; k < n; k++) { const sx = n === 4 ? (k % 2 ? 1 : -1) : (k ? 1 : -1), sz = n === 4 ? (k < 2 ? -1 : 1) : 0, hw = Math.min(p.o.w / 2 - 0.2, 3.6); w.box({ x: p.body.x + sx * hw, y: (p.top + 12.3) / 2, z: p.body.z + sz * (p.o.d / 2 - 0.2), w: 0.07, h: 12.3 - p.top, d: 0.07, color: GOLD, metal: 1, rough: 0.3, shadow: false }); } };
    const cps = new Map();
    const cp = (i, x, y, z) => { const c = w.checkpoint({ x, y, z, real: true }); cps.set(c, i); return c; };

    // ===== stage 1 · furniture hop =====================================================================
    const P0 = start(0, w.plat({ x: 0, y: 0.3, z: 12.5, w: 4, d: 3, h: 0.3, tex: 'carpet', color: 0xffffff, roughness: 0.9, radius: 0.04 }));
    w.sign({ text: 'WELCOME', x: 0, y: 0.32, z: 12.5, w: 3.2, h: 0.9, rotX: -Math.PI / 2, color: '#f1d28a', double: false, tw: 512, size: 70 });
    w.plat({ x: -2.8, y: 0.5, z: 9.4, w: 1.9, d: 1.4, h: 0.5, tex: 'leather', color: 0x4a2a1a, roughness: 0.5, radius: 0.08 });
    hop(0, w.plat({ x: -2.8, y: 0.9, z: 9.4, w: 1.6, d: 1.2, h: 0.4, tex: 'leather', color: 0x1a2a4a, roughness: 0.5, radius: 0.08 }));
    const ottoman = hop(0, w.plat({ x: -0.6, y: 0.45, z: 6.4, w: 1.5, d: 1.5, h: 0.4, tex: 'leather', color: 0x7a1030, roughness: 0.45, radius: 0.15 }));
    pole(-0.6, 6.4, 0.45, 1.5, 1.5);
    hop(0, sofa(w, 2.6, 3.4, 0, { color: 0x10342b, len: 3.2 }).seat);
    hop(0, coffeeTable(w, -0.6, 0.6, { w: 1.8, d: 1.0, h: 0.6 }));
    // ...then a detour west across the lounge (all flat tops: no armchair arms to bump into)
    hop(0, w.plat({ x: -4.4, y: 0.4, z: 1.9, w: 1.5, d: 1.5, h: 0.4, tex: 'leather', color: 0x1a2a4a, roughness: 0.45, radius: 0.15 }));
    hop(0, w.plat({ x: -7.7, y: 0.75, z: -0.3, w: 1.1, d: 1.1, h: 0.75, tex: 'wood', color: 0xffffff, roughness: 0.3, radius: 0.05 }));   // a bar stool
    hop(0, w.plat({ x: -7.6, y: 0.55, z: -3.7, w: 1.6, d: 1.0, h: 0.1, tex: 'marble', color: 0xffffff, roughness: 0.1 }));                // a side table
    for (const sx of [-1, 1]) w.box({ x: -7.6 + sx * 0.65, y: 0.27, z: -3.7, w: 0.08, h: 0.54, d: 0.8, color: GOLD, metal: 1, rough: 0.3 });
    const trolley = (x, z, top, ww, dd) => {
      const deck = hop(0, w.plat({ x, y: top, z, w: ww, d: dd, h: 0.1, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.03 }));
      pole(x, z, top, ww, dd);
      w.plat({ x, y: 0.3, z, w: ww - 0.1, d: dd - 0.1, h: 0.06, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.02, collide: false });
      return deck;
    };
    trolley(-4.0, -2.4, 1.0, 1.5, 1.5);
    const piano = start(1, w.plat({ x: -0.2, y: 1.2, z: -5.4, w: 2.8, d: 1.7, h: 0.18, tex: 'wood', color: 0x15151a, roughness: 0.08, radius: 0.08, slippery: true }));
    for (const [sx, sz] of [[-1, -0.55], [1, -0.55], [0, 0.65]]) w.box({ x: -0.2 + sx, y: 0.55, z: -5.4 + sz, w: 0.14, h: 1.1, d: 0.14, color: 0x0b0b10, rough: 0.1 });
    cp(1, -0.2, 1.2, -5.4);

    // ===== stage 2 · rolling stock =====================================================================
    // (this trolley has wheels. It uses them.)
    const roll = hop(1, w.plat({ x: 3.4, y: 1.5, z: -4.4, w: 1.8, d: 1.2, h: 0.1, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.03 }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      roll.attach(w.box({ x: 3.4 + sx * 0.75, y: 0.75, z: -4.4 + sz * 0.45, w: 0.1, h: 1.35, d: 0.1, color: GOLD, metal: 1, rough: 0.28, static: false }));
      roll.attach(w.box({ x: 3.4 + sx * 0.75, y: 0.12, z: -4.4 + sz * 0.45, w: 0.14, h: 0.24, d: 0.14, color: 0x14141a, rough: 0.5, static: false }));
    }
    roll.attach(w.box({ x: 3.4, y: 0.4, z: -4.4, w: 1.7, h: 0.06, d: 1.1, color: GOLD, metal: 1, rough: 0.3, static: false }));
    w.rollaway(roll, { dir: [1, 0], dist: 6, accel: 3.5, speed: 5.5, delay: 0.7, hold: 2.6, back: 1.8, onGo: () => game.say('hotel.l1.roll', { priority: 1 }) });
    const R1 = start(2, marble({ x: 12.8, y: 1.5, z: -5.2, w: 3.2, d: 3.2, h: 0.3 }));
    cp(2, 12.8, 1.5, -5.2);
    plinth(R1);

    // ===== stage 3 · mop-bot lane ======================================================================
    const LX = 16.6, LZ0 = -5.6, LZ1 = -20.6;
    const lane = marble({ x: LX, y: 1.5, z: (LZ0 + LZ1) / 2, w: 3.4, d: LZ0 - LZ1, h: 0.3, slippery: true });
    mark(lane);
    for (const z of [-8, -13, -18]) stages[2].route.push({ x: LX, y: 1.5, z });   // (the lane itself is one platform: route points only)
    w.sign({ text: 'MOP LANE ▸', x: LX, y: 1.52, z: LZ0 + 0.2, w: 3, h: 0.8, rotX: -Math.PI / 2, rotY: 0, color: '#ffd21f', double: false, tw: 512, size: 70 });
    plinth(lane);
    const mopA = w.hazard({ x: LX, y: 1.9, z: -9.5, w: 3.1, h: 0.8, d: 1.3, color: 0xffd21f, move: (t) => ({ z: 3.4 * Math.sin(t * 0.95) }) });
    const mopB = w.hazard({ x: LX, y: 1.9, z: -17.1, w: 3.1, h: 0.8, d: 1.3, color: 0xffd21f, move: (t) => ({ z: 3.4 * Math.sin(t * 0.8 + 2.2) }) });
    for (const m of [mopA, mopB]) { m.core.visible = false; m.shell.visible = false; m.jumpable = true; mopBot(m.group); }
    const mop = mopA;
    const E1 = mark(marble({ x: LX, y: 1.5, z: -22.3, w: 3.4, d: 2.3, h: 0.3 }));
    plinth(E1);
    trollCheckpoint(w, game, { x: LX, y: 1.5, z: -22.3, mode: 'fake' });                            // crooked pole: the second one is real
    const table = (x, z, top, o = {}) => {
      const t = marble({ x, y: top, z, w: 1.7, d: 1.7, h: 0.12, ...o });
      w.box({ x, y: (top - 0.12) / 2, z, w: 0.18, h: top - 0.12, d: 0.18, color: GOLD, metal: 1, rough: 0.28 });
      w.box({ x, y: 0.05, z, w: 1.0, h: 0.1, d: 1.0, color: GOLD, metal: 1, rough: 0.3 });
      return t;
    };
    const T1 = hop(2, table(19.4, -19.0, 2.5));
    const T2 = hop(2, w.crumble(table(16.6, -16.4, 3.5), { delay: 0.7, gone: 3 }));
    const T3 = hop(2, table(19.4, -13.8, 4.5));
    const T4 = hop(2, table(16.6, -11.2, 5.5));
    w.mover(T4, (t) => ({ z: 1.5 * Math.sin(t * 1.15) }));
    const TA = start(3, marble({ x: 18.4, y: 5.5, z: -7.0, w: 3.6, d: 3.4, h: 0.3 }));
    cp(3, 18.4, 5.5, -7.0);
    plinth(TA);

    // ===== stage 4 · service gantry ====================================================================
    const grate = (o) => w.plat({ tex: 'metal', color: 0xb9a15a, roughness: 0.35, metalness: 0.7, radius: 0.04, ...o });
    const G0 = hop(3, grate({ x: 13.2, y: 5.9, z: -4.4, w: 2.4, d: 2.4, h: 0.3 }));
    const G1 = hop(3, grate({ x: 9.9, y: 6.2, z: -4.2, w: 2.4, d: 2.4, h: 0.3 }));
    const GD = hop(3, grate({ x: 6.4, y: 6.4, z: -4.2, w: 3, d: 3, h: 0.3 }));
    const duster = w.hazard({ x: 6.4, y: 6.4 + 0.3, z: -4.2, w: 3.0, h: 0.5, d: 0.45, color: 0xb98a3c, move: (t) => ({ z: 1.15 * Math.sin(t * 2.1) }) });
    duster.core.visible = false; duster.shell.visible = false; duster.jumpable = true; featherDuster(duster.group);
    const G2 = hop(3, grate({ x: 2.6, y: 6.5, z: -4.2, w: 2.4, d: 2.4, h: 0.3 }));
    w.mover(G2, (t) => ({ x: 1.2 * Math.sin(t * 1.1) }));
    const G3 = hop(3, w.crumble(grate({ x: -1.2, y: 6.5, z: -4.2, w: 2.4, d: 2.4, h: 0.3 }), { delay: 0.6, gone: 3 }));
    const G4 = hop(3, marble({ x: -8.0, y: 6.5, z: -4.2, w: 8, d: 2.4, h: 0.3 }));
    vanishAfter(w, game, G4, { axis: 'x', dir: -1, frac: 0.5, delay: 0.7, back: 3.2, say: 'hotel.l1.bridge' });
    const G5 = hop(3, grate({ x: -15.0, y: 6.5, z: -4.2, w: 3, d: 3, h: 0.3 }));
    const G6 = start(4, marble({ x: -19.0, y: 6.7, z: -4.6, w: 4, d: 4, h: 0.3 }));
    cp(4, -19.0, 6.7, -4.6);
    twistZone(game, w, { x: 9.9, y: 8, z: -4.2, w: 3, h: 4, d: 3 }, 'swap', { sec: 6, say: 'hotel.l1.swap' });   // G1: A and D swap, then wear off on their own
    for (const p of [G0, G1, GD, G3, G5]) hang(p, 2);
    hang(G4, 4); hang(G6, 4);
    // gold rails + a banner along the gantry, so it reads as a gantry
    for (const x of [13, 6, -1, -8, -15]) w.box({ x, y: 7.7, z: -2.7, w: 0.12, h: 2.4, d: 0.12, color: GOLD, metal: 1, rough: 0.3 });
    w.box({ x: 0, y: 8.9, z: -2.7, w: 30, h: 0.1, d: 0.1, color: GOLD, metal: 1, rough: 0.3, shadow: false });

    // ===== stage 5 · the climb =========================================================================
    const H1 = hop(4, marble({ x: -18.2, y: 6.9, z: -8.6, w: 2.2, d: 2.2, h: 0.14 }));
    for (const p of [H1]) hang(p, 2);
    const H2 = hop(4, marble({ x: -15.2, y: 7.3, z: -11.8, w: 2.2, d: 2.2, h: 0.14 }));
    const H3 = hop(4, marble({ x: -18.0, y: 7.5, z: -15.0, w: 2.2, d: 2.2, h: 0.14 }));
    w.mover(H3, (t) => ({ z: 1.5 * Math.sin(t * 1.0) }));
    const H4 = hop(4, marble({ x: -15.6, y: 7.5, z: -18.4, w: 2.2, d: 2.2, h: 0.14 }));
    const H5 = hop(4, marble({ x: -14.0, y: 7.5, z: -22.4, w: 2.4, d: 2.4, h: 0.14 }));
    for (const p of [H2, H4, H5]) hang(p, 2);

    // ===== stage 6 · mezzanine =========================================================================
    const balc = mark(w.plat({ x: 0, y: 7.5, z: -22.9, w: 24, d: 1.8, h: 0.6, tex: 'marble', color: 0xffffff, roughness: 0.15, radius: 0.05 }));
    stages[5].at = { x: -10.4, y: 7.5, z: -22.9 };
    for (const x of [-12, -6, 0, 6, 12]) w.box({ x, y: 3.6, z: -22.9, w: 0.5, h: 7.2, d: 0.5, color: 0xece3cf, rough: 0.3 });
    w.box({ x: 0, y: 8.05, z: -22.1, w: 24, h: 0.08, d: 0.08, color: GOLD, metal: 1, rough: 0.28, shadow: false });
    w.box({ x: 0, y: 7.7, z: -22.1, w: 24, h: 0.08, d: 0.08, color: GOLD, metal: 1, rough: 0.28, shadow: false });
    w.sign({ text: 'MEZZANINE · STAFF ONLY', x: 0, y: 7.52, z: -22.0, w: 5, h: 0.5, rotX: -Math.PI / 2, color: '#f1d28a', double: false, tw: 1024, size: 50 });
    cp(5, -10.4, 7.5, -22.9);
    // the bonus climb: only there once the host has been rude (the level pretends it is over first)
    const bonus = [[7, 8.4, -19.8, 2.0], [3.6, 9.1, -20.1, 2.0], [0.2, 9.7, -20.3, 2.0], [-3.4, 10.2, -20.5, 2.0], [-7.2, 10.6, -20.4, 3.4]].map(([x, y, z, s]) => {
      const p = marble({ x, y, z, w: s, d: s, h: 0.2 }); p.setEnabled(false); mark(p); return p;
    });
    const finalGoal = w.goal({ x: -7.2, y: 10.6, z: -20.4, color: GOLD, onReach: () => { game.say('hotel.l1.done', { priority: 2 }); game.completeLevel(); } });
    finalGoal.group.visible = false; finalGoal.trig.enabled = false;
    let bonusOn = false;
    const enableBonus = () => {
      bonusOn = true;
      for (const p of bonus) { p.setEnabled(true); w.burst(new THREE.Vector3(p.body.x, p.top + 0.3, p.body.z), GOLD, 12, 3); }
      finalGoal.group.visible = true; finalGoal.trig.enabled = true; w.goalObj = finalGoal;
      game.say('hotel.l1.bonus', { priority: 2 });
    };
    // the broom closet
    fakeExit(w, game, { x: -5, y: 7.5, z: -23.35, kind: 'door', say: 'hotel.l1.closet' });
    // the goal that runs away (twice), then a LEVEL COMPLETE that is not
    const runner = evasiveGoal(w, game, {
      spots: [{ x: 10, y: 7.5, z: -22.9 }, { x: -3, y: 7.5, z: -22.9 }, { x: 6, y: 7.5, z: -22.9 }], radius: 6, color: GOLD, say: ['hotel.l1.hop1', 'hotel.l1.hop2'],
      onReach: () => { if (!fakeComplete(game, w, { title: 'LEVEL COMPLETE', say: 'hotel.l1.fakewin', sayAfter: null, then: enableBonus })) game.completeLevel(); },
    });
    w.goalObj = runner;   // (the bot and the hint chase the runner until the bonus exists)

    // ---- stage banners, the host, the hint ---------------------------------------------------------
    w.hooks.onCheckpoint = (c) => { const i = cps.get(c); if (i !== undefined) stageTitle(game, w, i + 1, NAMES.length, NAMES[i]); };
    let intro = false, t = 0;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t += dt;
      if (!intro && t > 1.3) { intro = true; g.say('hotel.l1.intro'); g.say('hotel.l1.intro2'); stageTitle(g, w, 1, NAMES.length, NAMES[0]); }
    };
    onPlat(w, ottoman, () => game.say('hotel.l1.1'));
    onPlat(w, piano, () => game.say('hotel.l1.mid'));
    onPlat(w, R1, () => game.say('hotel.l1.mop'));
    onPlat(w, E1, () => game.say('hotel.l1.fakecp'));
    onPlat(w, T1, () => game.say('hotel.l1.up'));
    onPlat(w, T3, () => game.say('hotel.l1.glide'));
    onPlat(w, TA, () => { game.say('hotel.l1.gantry'); });
    onPlat(w, TA, () => adBreak(game, w, { sec: 5, say: 'hotel.l1.ad', sayAfter: 'hotel.l1.ad.after' }));   // a sponsor's message, on a pad wide enough to wait it out
    onPlat(w, GD, () => game.say('hotel.l1.duster'));
    onPlat(w, G6, () => game.say('hotel.l1.near'));
    onPlat(w, H3, () => game.say('hotel.l1.climb'));
    onPlat(w, balc, () => game.say('hotel.l1.balcony'));
    w.hooks.onDeath = () => {
      const p = game.player;
      if (Math.hypot(p.x - DRY.x, p.z - DRY.z) < 2.4 && p.y < 1) { game.say('hotel.l1.dry', { priority: 1 }); return true; }
      if (Math.random() < 0.6) { game.say('hotel.l1.slip', { priority: 1 }); return true; }
      return false;
    };
    stageHint(w, stages, { flat: false });
    const base = w.hintFn;
    w.hintFn = (g) => {
      if (!bonusOn) {
        if (g.player.y > 7 && g.player.z < -21) return [{ x: g.player.x, y: g.player.y + 0.15, z: g.player.z }, { x: runner.x, y: runner.y + 0.15, z: runner.z }];
        return base(g);
      }
      const p = g.player;
      return [{ x: p.x, y: p.y + 0.15, z: p.z }, ...bonus.map((b) => ({ x: b.body.x, y: b.top + 0.15, z: b.body.z }))];
    };
    // test hooks / the bot: chase the runner until the bonus exists
    w.botPlan = (g) => {
      const p = g.player;
      if (p.grounded && p.ground === roll.body && roll.body.x < 9.2) return { x: roll.body.x, z: roll.body.z, wait: true };   // ride the trolley to the far end
      if (bonusOn || p.z > -21 || p.y < 7) return null;
      return { x: runner.x, z: runner.z };
    };
    w.wet = { stages, mop, mopA, mopB, duster, lane, runner, finalGoal, bonus, G4, cps, get bonusOn() { return bonusOn; } };
    void P0; void T2; void T4; void G2; void H3;
  },
};

// a yellow A-frame "WET FLOOR" sign lying on the (lethal) floor
function wetSign(w, x, z, rot) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 384; const g = c.getContext('2d');
  g.fillStyle = '#ffd21f'; g.fillRect(0, 0, 256, 384);
  g.fillStyle = '#111'; g.font = '700 54px Arial Black, Impact, sans-serif'; g.textAlign = 'center';
  g.fillText('CAUTION', 128, 80); g.font = '700 70px Arial Black, Impact, sans-serif'; g.fillText('WET', 128, 190); g.fillText('FLOOR', 128, 270);
  g.beginPath(); g.moveTo(128, 296); g.lineTo(168, 368); g.lineTo(88, 368); g.closePath(); g.fillStyle = '#111'; g.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, side: THREE.DoubleSide });
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = rot;
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.7), mat); p.position.set(0, 0.35, s * 0.17); p.rotation.x = s * -0.32; p.castShadow = true; grp.add(p); }
  w.add(grp);
}

// the mop robot: a fat yellow puck with a rotating mop skirt and a flashing amber lamp (it is low enough to hop)
function mopBot(group) {
  const yellow = plainMaterial(0xffd21f, { roughness: 0.4 }), dark = plainMaterial(0x1b1b22, { roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.55, 28), yellow); body.position.y = -0.05; body.castShadow = true; group.add(body);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.18, 28), plainMaterial(0xeeeeee, { roughness: 0.9 })); skirt.position.y = -0.34; group.add(skirt);
  for (const sx of [-0.7, 0.7]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), glowMaterial(0xff3a46, 1.8)); eye.position.set(sx, 0.18, -1.0); group.add(eye); }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.07), dark); bar.position.set(0, 0.26, 0.2); group.add(bar);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glowMaterial(0xffa21f, 2.4)); lamp.position.set(0, 0.46, 0.2); group.add(lamp);
}

// a feather duster as long as the pad is wide (it sweeps across: hop it)
function featherDuster(group) {
  const wood = plainMaterial(0x6a3a22, { roughness: 0.6 });
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.1, 8), wood); stick.rotation.z = Math.PI / 2; group.add(stick);
  const cols = [0xe8e0d0, 0xb98a3c, 0xcc4a3a, 0x3a7a5a];
  for (let i = 0; i < 14; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 6), plainMaterial(cols[i % 4], { roughness: 0.9 }));
    f.position.set(-1.4 + i * 0.215, 0.06, 0); f.rotation.x = Math.PI; group.add(f);
  }
}
