import * as THREE from 'three';
import { chain, pulseLaser } from '../common.js';
import { glowMaterial } from '../../engine/materials.js';
import { retreatEnv, deck, plate, gate, riser, sign, roleSign, lantern, lake, stage, setDeathRule, botSteps, beacon, COL } from './kit.js';
import { dust, crossing, stonePath, sacrificePad } from './trust-falls-kit.js';

// Session 2 — Trust Falls. One of you cannot see the platforms; the other can. Blind stepping stones guided from a lookout (and swapped),
// a bridge where each of you sees every other stone, a real trust fall onto a net only your partner can steer, a door that only opens for
// someone willing to be downed (the other has to pull them up), a lying sign, and a lift you cannot see.
// Night over the lake. First-time pairs: ~10 minutes.

export default {
  id: 'coop2',
  name: 'Trust Falls',
  music: 'l2',
  deathRule: 'revive',
  completeQuip: 'Eight exercises. One of you fell for it. The other one fell for the other one.',
  titleCam: { center: [0, 2, -40], radius: 30, height: 12 },

  build(w, game) {
    retreatEnv(w, { mood: 'night' });
    lake(w, -34, 700, 0x1e4f6a);
    const c = w.coop, me = c.me, N = c.names, P = c.partner;
    w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    const tell = (r, k, o) => c.tell(r, k, o);
    const gp = () => game.player;
    const walk = (pts, r = 0.75) => pts.map((p) => ({ x: p.x, z: p.z, r }));
    const botP1 = [], botP2 = [];
    const both = (...s) => { botP1.push(...s.map((o) => ({ ...o }))); botP2.push(...s.map((o) => ({ ...o }))); };

    // ============================================================ 1. the welcome deck + a safe taster ==================
    deck(w, { x: 0, y: 0, z: -12, w: 22, d: 36, path: true });                       // z +6 … -30
    sign(w, 'SERENITY FALLS · COUPLES RETREAT', 0, 5.2, 4, { w: 12, h: 1.6 });
    sign(w, 'SESSION 2: TRUST FALLS', 0, 3.6, 4, { w: 8, h: 1, border: '#39d7c9' });
    for (const lx of [-9, 9]) { lantern(w, lx, 0, 2); lantern(w, lx, 0, -22); }
    const g1 = gate(w, { x: 0, z: -26, w: 22, h: 5 });
    const pl1 = plate(w, { x: 0, y: 0, z: -18, size: 3, need: 'both', hold: 6, label: 'STAND HERE · BOTH OF YOU' });
    w.updaters.push(() => g1.set(pl1.pressed));
    sign(w, 'WARM-UP: A DOOR. TRUST ME.', 0, 6.4, -25.5, { w: 9, h: 1.2 });
    stage(w, 'welcome', { x: 0, y: 1, z: 2, w: 30, h: 4, d: 8 }, () => { setDeathRule(w, 'self'); tell('p1', 'coop.l2.intro.p1', { priority: 2 }); tell('p2', 'coop.l2.intro.p2', { priority: 2 }); });
    stage(w, 'plate', { x: 0, y: 1, z: -14, w: 22, h: 4, d: 5 }, () => tell('all', 'coop.l2.plate'));
    w.checkpoint({ x: 0, y: 0, z: -29, real: true });
    const s1 = chain(w, { x: 0, y: 0, z: -30 }, [{ gap: 2.4, d: 5, w: 7 }, { gap: 2.6, d: 4, w: 6 }, { gap: 2.8, d: 5, w: 7 }]);
    stage(w, 'hops', { x: 0, y: 1, z: s1[0].body.z, w: 8, h: 4, d: 6 }, () => tell('all', 'coop.l2.hops'));
    const z0A = s1.endZ - 2.2 - 14;                                                    // near hub of the first chasm: z0A … z0A+14
    deck(w, { x: 0, y: 0, z: z0A + 7, w: 16, d: 14, path: true });
    w.checkpoint({ x: 0, y: 0, z: z0A + 7, real: true });
    both({ x: 0, z: -18, r: 0.5, until: () => g1.passable }, { follow: true, until: () => gp().z < z0A + 11 });
    // the two bots must not stand on the same spot of the plate
    botP1[0].x = -0.7; botP2[0].x = 0.7;

    // ============================================================ 2. lead me blind (P1 blind, P2 spots) ================
    const A = crossing(w, { key: 'A', z0: z0A, blind: 'p1', moves: [['N', 3], ['E', 3], ['N', 2], ['W', 4], ['N', 2], ['E', 1], ['N', 3]] });
    dust(w, { who: 'p1', x0: -18, x1: 18, y0: -4, y1: 3.5, z0: A.last.z - 4, z1: z0A + 1, count: 520 });
    roleSign(w, 'p1', 'YOU CAN\'T SEE THE STONES. THAT\'S ON PURPOSE.', 0, 4.4, z0A + 2.5, { w: 9, h: 1.5, size: 34 });
    roleSign(w, 'p2', 'YOU SEE THE STONES. STAND ON THE SPOTTER PLATE AND TALK.', -10, 8.4, A.z0 - 1.5, { w: 9, h: 1.5, size: 32 });
    stage(w, 'A', { x: 0, y: 1, z: z0A + 7, w: 16, h: 4, d: 10 }, () => { tell('p1', 'coop.l2.blindA', { priority: 2 }); tell('p2', 'coop.l2.guideA', { priority: 2 }); });
    c.onEvent('tf:A:done', () => tell('all', 'coop.l2.crossedA'));
    const stoneWalk = (cr) => walk(cr.stones);
    const lookoutUp = (z0) => [{ x: -6, z: z0 + 11, r: 1.4 }, { x: -10, z: z0 + 11, r: 0.9 }, { x: -10, z: z0 + 8.2, r: 0.9 }, { x: -10, z: z0 + 5.4, r: 0.9 }, { x: -10, z: z0 + 2.6, r: 0.9 }];
    const lookoutDown = (z0) => [{ x: -10, z: z0 + 2.6, r: 1.2 }, { x: -10, z: z0 + 6, r: 1.2 }, { x: -10, z: z0 + 10, r: 1.2 }, { x: -5, z: z0 + 11, r: 1.4 }, { x: -1, z: z0 + 4, r: 1.2 }];
    const blindSteps = (cr) => [{ x: 0, z: cr.z0 + 5, r: 1.2, until: () => cr.live() }, ...stoneWalk(cr), { x: 0, z: cr.farZ0 + 7, r: 3.5 }];
    const spotSteps = (cr) => [...lookoutUp(cr.z0), { x: -10, z: cr.z0 - 2.2, r: 0.5, until: () => cr.done }, ...lookoutDown(cr.z0), ...stoneWalk(cr), { x: 0, z: cr.farZ0 + 7, r: 3.5 }];
    botP1.push(...blindSteps(A)); botP2.push(...spotSteps(A));

    // ============================================================ 3. swap (P2 blind, P1 spots) ==========================
    const B = crossing(w, { key: 'B', z0: A.farZ0, blind: 'p2', moves: [['N', 2], ['W', 3], ['N', 2], ['E', 5], ['N', 2], ['W', 2], ['N', 3]] });
    dust(w, { who: 'p2', x0: -18, x1: 18, y0: -4, y1: 3.5, z0: B.last.z - 4, z1: A.farZ0 + 1, count: 520 });
    roleSign(w, 'p2', 'NOW IT\'S YOUR TURN. YOU CAN\'T SEE THE STONES EITHER.', 0, 4.4, A.farZ0 + 2.5, { w: 9, h: 1.5, size: 32 });
    roleSign(w, 'p1', 'YOUR TURN TO SEE. SPOTTER PLATE UP THE STAIRS.', -10, 8.4, B.z0 - 1.5, { w: 9, h: 1.5, size: 32 });
    stage(w, 'B', { x: 0, y: 1, z: A.farZ0 + 7, w: 16, h: 4, d: 10 }, () => { tell('p2', 'coop.l2.blindB', { priority: 2 }); tell('p1', 'coop.l2.guideB', { priority: 2 }); });
    c.onEvent('tf:B:done', () => tell('all', 'coop.l2.crossedB'));
    botP1.push(...spotSteps(B)); botP2.push(...blindSteps(B));

    // ============================================================ 4. the half-and-half bridge ===========================
    const z0C = B.farZ0;
    const hy = stonePath(0, z0C - 3.0, [['N', 2], ['E', 2], ['N', 1], ['W', 4], ['N', 1], ['E', 2], ['N', 2]]);
    hy.forEach((p, i) => {
      const s = deck(w, { x: p.x, y: 0, z: p.z, w: 2.4, d: 2.4, h: 0.8, color: i % 2 ? COL.p2 : COL.p1, tex: 'metal' });
      s.group.visible = (i % 2 === 0 ? 'p1' : 'p2') === me;
    });
    const hl = hy[hy.length - 1];
    const z0D = hl.z - 3.0 - 14;
    dust(w, { who: 'all', x0: -16, x1: 16, y0: -3, y1: 3, z0: hl.z - 2, z1: z0C, count: 360, opacity: 0.25 });
    deck(w, { x: 0, y: 0, z: z0D + 7, w: 16, d: 14, path: true });
    roleSign(w, 'p1', 'YOU SEE THE ORANGE STONES. THEY SEE THE OTHERS.', 0, 4.4, z0C + 2.5, { w: 9, h: 1.5, size: 32 });
    roleSign(w, 'p2', 'YOU SEE THE TEAL STONES. THEY SEE THE OTHERS.', 0, 4.4, z0C + 2.5, { w: 9, h: 1.5, size: 32 });
    stage(w, 'hybrid', { x: 0, y: 1, z: z0C + 7, w: 16, h: 4, d: 10 }, () => { tell('p1', 'coop.l2.hybrid.p1', { priority: 2 }); tell('p2', 'coop.l2.hybrid.p2', { priority: 2 }); });
    stage(w, 'hybridMid', { x: 0, y: 1, z: hy[7].z, w: 20, h: 4, d: 6 }, () => tell('all', 'coop.l2.hybridMid'));
    stage(w, 'hybridDone', { x: 0, y: 1, z: z0D + 7, w: 16, h: 4, d: 8 }, () => tell('all', 'coop.l2.hybridDone'));
    w.checkpoint({ x: 0, y: 0, z: z0D + 7, real: true });
    botP1.push(...walk(hy), { x: 0, z: z0D + 7, r: 3.5 });
    botP2.push({ x: 5, z: z0C + 7, r: 1.0, until: () => P.has && P.sz < z0C - 14 }, ...walk(hy), { x: 0, z: z0D + 7, r: 3.5 });

    // ============================================================ 5. the real trust fall ================================
    // tower on the hub: eight steps up (-z), then a long ledge. Below the ledge a net hangs on three positions; P2 steers it from a deck on the side.
    const tower = [];
    for (let k = 1; k <= 8; k++) tower.push(deck(w, { x: 0, y: 1.2 * k, z: z0D - 1.6 - (k - 1) * 2.9, w: 4, d: 2.6, h: 1, color: 0xcdb48a }));
    const LY = 9.6, ledgeZ0 = z0D - 23.2, zF = ledgeZ0 - 14;
    deck(w, { x: 6, y: LY, z: ledgeZ0 - 7, w: 32, d: 14, h: 1.2, color: 0xe3d3ac, trim: COL.p1 });
    w.checkpoint({ x: 6, y: LY, z: ledgeZ0 - 3, real: true });
    const NX = [-6, 6, 19], netZ = zF - 8;
    // P2's side: a connector from the hub, then a long deck that runs along the net
    deck(w, { x: 22, y: 0, z: z0D + 7, w: 28, d: 10, path: true });
    const zEnd = zF - 18;
    const deckTop = z0D + 12;
    deck(w, { x: 29, y: 0, z: (deckTop + zEnd) / 2, w: 8, d: deckTop - zEnd, path: true });
    const PL = [zF - 3, zF - 8, zF - 13];
    const plates = PL.map((z, i) => plate(w, { x: 29, y: 0, z, size: 2.4, need: 'p2', label: ['NET LEFT', 'NET MIDDLE', 'NET RIGHT'][i] }));
    const net = w.plat({ x: NX[1], y: 0, z: netZ, w: 8, d: 14, h: 0.7, tex: 'wood', color: 0xe0d2a8, trim: COL.good, moving: true });
    const ns = { x: NX[1], target: NX[1], still: 0 };
    w.updaters.push((dt) => {
      const t = plates[0].pressed ? NX[0] : plates[1].pressed ? NX[1] : plates[2].pressed ? NX[2] : ns.target;
      ns.target = t;
      const d = t - ns.x;
      ns.x += Math.sign(d) * Math.min(Math.abs(d), 5 * dt);
      ns.still = Math.abs(t - ns.x) < 0.02 ? ns.still + dt : 0;
      net.setPos(ns.x, net.base.y, netZ);
    });
    const settledAt = (i) => Math.abs(ns.x - NX[i]) < 0.05 && ns.still > 0.5;
    // lamps along the ledge's front edge: green = the net is settled under you, amber = it is moving, red = it is not here
    const lamps = NX.map((x, i) => {
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xff4d5e, toneMapped: false });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 14), bulbMat); bulb.position.set(x, LY + 1.4, zF + 0.4); w.add(bulb);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x3a2c20 })); post.position.set(x, LY + 0.6, zF + 0.4); w.add(post);
      return bulbMat;
    });
    w.updaters.push(() => {
      lamps.forEach((m, i) => {
        const near = Math.abs(ns.x - NX[i]);
        m.color.setHex(settledAt(i) ? 0x3ddc97 : near < 0.5 ? 0xffc83d : 0xff4d5e);
      });
    });
    sign(w, 'GREEN = THE NET IS UNDER YOU. RED = IT IS NOT. JUMP ON GREEN.', 6, LY + 4.2, zF + 0.6, { w: 12, h: 1.4, size: 34 });
    // the mist that hides the net from the one who falls
    if (me === 'p1') {
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ map: null, color: 0xaebbd8, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending }));
      mist.rotation.x = -Math.PI / 2; mist.position.set(6, 2.4, netZ); w.add(mist);
    }
    roleSign(w, 'p2', 'YOU STEER THE NET. THEY CAN\'T SEE WHERE IT IS.', 29, 4.2, zF + 8, { w: 8, h: 1.5, size: 32, rotY: 0 });
    stage(w, 'tower', { x: 0, y: 1, z: z0D + 7, w: 16, h: 4, d: 10 }, () => { tell('p1', 'coop.l2.tower.p1', { priority: 2 }); tell('p2', 'coop.l2.tower.p2', { priority: 2 }); });
    stage(w, 'ledge', { x: 6, y: LY + 1, z: ledgeZ0 - 7, w: 32, h: 4, d: 14 }, () => { tell('p1', 'coop.l2.ledge.p1'); tell('p2', 'coop.l2.ledge.p2'); });
    stage(w, 'landed', { x: 6, y: 1.8, z: netZ, w: 30, h: 3.4, d: 14 }, () => tell('all', 'coop.l2.landed'));
    const FZ = zEnd;
    botP1.push(
      ...Array.from({ length: 8 }, (_, i) => ({ x: 0, z: z0D - 1.6 - i * 2.9, r: 0.8 })),
      { x: 6, z: ledgeZ0 - 4, r: 1.2 },
      { x: 6, z: ledgeZ0 - 4, r: 1.2, until: () => settledAt(1) },
      { x: 6, z: zF - 3, r: 1.0, jump: false },
      { x: 6, z: zF - 5, r: 3, until: () => gp().y < 2.4 && gp().grounded },
      { until: () => settledAt(2) },
      { x: 29, z: netZ, r: 1.2 },
    );
    botP2.push(
      { x: 8, z: z0D + 7, r: 1.5 }, { x: 29, z: z0D + 7, r: 1.5 }, { x: 29, z: PL[1], r: 0.4 },
      { x: 29, z: PL[1], r: 0.4, until: () => P.has && P.sy < 2.6 && P.sz < zF - 2 && P.g },
      { x: 29, z: PL[2], r: 0.4, until: () => P.has && P.sx > 24.5 },
    );

    // ============================================================ 6. the pull-up: two doors that bite =================
    deck(w, { x: 29, y: 0, z: FZ - 31, w: 14, d: 62 });                                // FZ … FZ-62
    for (const lx of [23, 35]) { lantern(w, lx, 0, FZ - 2); lantern(w, lx, 0, FZ - 36); }
    w.checkpoint({ x: 29, y: 0, z: FZ - 4, real: true });
    const mkLaser = (z, offset) => {
      const hz = pulseLaser(w, { x: 29, y: 0.5, z, width: 14, period: 4.5, on: 1.0, warn: 0.9, offset, axis: 'x' });
      hz.predict = (t) => ((t + offset) % 4.5) < 1.0;
      return hz;
    };
    mkLaser(FZ - 11, 0); mkLaser(FZ - 17, 2.25);
    const padA = sacrificePad(w, { x: 29, z: FZ - 26, role: 'p1', key: 'tf.door1', label: `${N.p1}: THE PAD BITES · 3 s` });
    const door1 = gate(w, { x: 29, z: FZ - 34, w: 14, h: 5 });
    sign(w, 'THE PAD OPENS THE DOOR. THE PAD ALSO BITES.', 29, 7.2, FZ - 33.6, { w: 11, h: 1.4, size: 34 });
    w.checkpoint({ x: 29, y: 0, z: FZ - 38, real: true });
    mkLaser(FZ - 41, 1.1);
    const padB = sacrificePad(w, { x: 29, z: FZ - 47, role: 'p2', key: 'tf.door2', label: `${N.p2}: YOUR TURN · 3 s` });
    const door2 = gate(w, { x: 29, z: FZ - 55, w: 14, h: 5 });
    sign(w, 'SAME DOOR. SAME PAD. DIFFERENT VOLUNTEER.', 29, 7.2, FZ - 54.6, { w: 11, h: 1.4, size: 34 });
    w.updaters.push(() => { door1.set(padA.latched); door2.set(padB.latched); });
    w._tf = { padA, padB, FZ, zEnd };
    roleSign(w, 'p1', 'THE ORANGE PAD IS YOURS. STAND ON IT. YOUR PARTNER WILL PULL YOU UP.', 24, 3.6, FZ - 22, { w: 8, h: 1.6, size: 30 });
    roleSign(w, 'p2', 'THE ORANGE PAD IS THEIRS. WHEN THEY GO DOWN, STAND NEXT TO THEM.', 24, 3.6, FZ - 22, { w: 8, h: 1.6, size: 30 });
    stage(w, 'field', { x: 29, y: 1, z: FZ - 6, w: 14, h: 4, d: 6 }, () => { setDeathRule(w, 'revive'); tell('all', 'coop.l2.field'); });
    stage(w, 'pad1', { x: 29, y: 1, z: FZ - 22, w: 14, h: 4, d: 4 }, () => { tell('p1', 'coop.l2.pad1.p1'); tell('p2', 'coop.l2.pad1.p2'); });
    stage(w, 'pad2', { x: 29, y: 1, z: FZ - 43, w: 14, h: 4, d: 4 }, () => { tell('p2', 'coop.l2.pad2.p2'); tell('p1', 'coop.l2.pad2.p1'); });
    c.on('tf.door1', (v) => { if (v) tell('all', 'coop.l2.door1'); });
    c.on('tf.door2', (v) => { if (v) tell('all', 'coop.l2.door2'); });
    w.hooks.onPartnerDeath = () => { tell('all', 'coop.l2.down'); return true; };
    // bots: wait out the lasers (hazard.predict), the volunteer stands on the pad, the other stays close and pulls them up
    const reviveWatch = (pad) => [{ x: 33, z: pad.zone.body.z + 5, r: 1.0, until: () => P.dead }, { x: () => P.x + 1.3, z: () => P.z + 1.3, r: 0.4, until: () => !P.dead && pad.latched }];
    const volunteer = (pad) => [{ x: 29, z: pad.zone.body.z, r: 0.35, until: () => pad.latched }];
    botP1.push({ x: 29, z: FZ - 4, r: 1.5 }, { x: 29, z: FZ - 14, r: 1.5 }, { x: 29, z: FZ - 21, r: 1.2 }, ...volunteer(padA),
      { x: 29, z: FZ - 44, r: 1.2 }, ...reviveWatch(padB), { x: 29, z: FZ - 58, r: 1.5 });
    botP2.push({ x: 29, z: FZ - 4, r: 1.5 }, { x: 29, z: FZ - 14, r: 1.5 }, { x: 29, z: FZ - 21, r: 1.2 }, ...reviveWatch(padA),
      { x: 29, z: FZ - 44, r: 1.2 }, ...volunteer(padB), { x: 29, z: FZ - 58, r: 1.5 });

    // ============================================================ 7. the fake finish + the lying sign ===================
    const FH0 = FZ - 62;
    deck(w, { x: 29, y: 0, z: FH0 - 7, w: 14, d: 14, path: true });
    w.checkpoint({ x: 29, y: 0, z: FH0 - 7, real: true });
    deck(w, { x: 18, y: 0, z: FH0 - 7, w: 8, d: 4 });                                  // the bridge to the "finish"
    deck(w, { x: 7, y: 0, z: FH0 - 7, w: 14, d: 18 });
    const fake = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 12, 48), glowMaterial(0x3ddc97, 2));
    fake.position.set(7, 1.9, FH0 - 7); w.add(fake);
    sign(w, 'FINISH', 7, 4.6, FH0 - 7, { w: 4, h: 1, border: '#3ddc97' });
    lantern(w, 2, 0, FH0 - 2); lantern(w, 12, 0, FH0 - 12);
    roleSign(w, 'p1', 'FINISH ← THIS WAY. DEFINITELY.', 29, 4.4, FH0 - 1.6, { w: 8, h: 1.4, size: 36 });
    roleSign(w, 'p2', 'FINISH ↑ STRAIGHT ON.', 29, 4.4, FH0 - 1.6, { w: 8, h: 1.4, size: 36 });
    stage(w, 'fork', { x: 29, y: 1, z: FH0 - 7, w: 14, h: 4, d: 10 }, () => { setDeathRule(w, 'self'); tell('p1', 'coop.l2.fork.p1', { priority: 2 }); tell('p2', 'coop.l2.fork.p2', { priority: 2 }); });
    const fakeZ = c.zone({ x: 7, y: 1.9, z: FH0 - 7, w: 3, h: 3.4, d: 3, need: 'any', shrink: 0 });
    c.onEvent('tf:fake', () => { fake.visible = false; tell('all', 'coop.l2.fake'); });
    let fakeDone = false;
    fakeZ.onChange((zn) => { if (zn.active && !fakeDone) { fakeDone = true; c.emit('tf:fake'); } });
    const s2 = chain(w, { x: 29, y: 0, z: FH0 - 14 }, [{ gap: 2.4, d: 4, w: 6 }, { gap: 2.7, d: 4, w: 6 }, { gap: 2.7, d: 4, w: 6 }]);
    w.checkpoint({ x: 29, y: 0, z: s2[1].body.z, real: true });

    // ============================================================ 8. the last exercise: a lift only one of you can see ==
    const fa0 = s2.endZ - 2.2, faZ1 = fa0 - 18;
    deck(w, { x: 29, y: 0, z: fa0 - 9, w: 16, d: 18, path: true });
    w.checkpoint({ x: 29, y: 0, z: fa0 - 4, real: true });
    deck(w, { x: 29, y: 4.2, z: faZ1 - 7, w: 16, d: 14, h: 4.2, color: 0xe3d3ac });
    const lz = faZ1 + 2;
    const L1 = riser(w, { x: 24, y: 4.2, z: lz, w: 3.2, d: 3.2, h: 0.6, drop: 4.2, always: true, speed: 3.2, color: 0xe9d9b0, trim: COL.good });
    L1.plat.group.visible = me === 'p2';
    dust(w, { who: 'p1', x0: 22, x1: 26, y0: 0, y1: 4.5, z0: lz - 1.8, z1: lz + 1.8, count: 120, opacity: 0.35, size: 0.4 });
    const L2 = riser(w, { x: 34, y: 4.2, z: lz, w: 3.2, d: 3.2, h: 0.6, drop: 4.2, always: true, speed: 3.2, color: 0xe9d9b0, trim: COL.good });
    const lp = plate(w, { x: 24, y: 0, z: faZ1 + 11, size: 2.6, need: 'p2', label: `${N.p2}: LIFT` });
    w.updaters.push(() => L1.set(lp.pressed));
    const tp = plate(w, { x: 29, y: 4.2, z: faZ1 - 3, size: 2.6, need: 'p1', label: `${N.p1}: LIFT` });
    w.updaters.push(() => L2.set(tp.pressed));
    roleSign(w, 'p1', 'THERE IS A LIFT HERE. YOU CAN\'T SEE IT. THEY CAN.', 24, 4.4, lz + 6, { w: 8, h: 1.5, size: 32 });
    roleSign(w, 'p2', 'THEY CAN\'T SEE THE LIFT. TELL THEM WHERE TO STAND.', 24, 4.4, lz + 6, { w: 8, h: 1.5, size: 32 });
    sign(w, 'THE OTHER LIFT IS FOR THE ONE LEFT BEHIND. IT RUNS WHILE YOUR PARTNER STANDS ON THE TOP PLATE.', 34, 4.4, lz + 6, { w: 9, h: 2, size: 28 });
    w._tf2 = { L1, L2, lp, tp, faZ1, lz };
    const gy = 4.2, gz = faZ1 - 10;
    w.goal({ x: 29, y: gy, z: gz });
    sign(w, 'BOTH OF YOU. IN THE CIRCLE. EYES OPEN IS OPTIONAL.', 29, gy + 5.2, gz - 5, { w: 10, h: 1.6 });
    beacon(w, 29, gy, gz, 0xffe9a8, 20);
    for (const lx of [24, 34]) lantern(w, lx, gy, gz + 2);
    stage(w, 'final', { x: 29, y: 1, z: fa0 - 6, w: 16, h: 4, d: 8 }, () => { tell('p1', 'coop.l2.final.p1', { priority: 2 }); tell('p2', 'coop.l2.final.p2', { priority: 2 }); });
    stage(w, 'top', { x: 29, y: gy + 1, z: faZ1 - 7, w: 16, h: 3, d: 8 }, () => tell('all', 'coop.l2.top'));

    // bots: P1 stands on the (invisible) lift where P2 says; P2 on its plate. Then P1 holds the top plate for P2's lift.
    botP1.push({ x: 29, z: fa0 - 6, r: 1.5 }, { x: 24, z: lz + 5, r: 1.0 }, { x: 24, z: lz, r: 0.6, until: () => gp().y > 4.0 && gp().grounded },
      { x: 27, z: faZ1 - 6, r: 1.0, until: () => P.has && Math.hypot(P.sx - 34, P.sz - lz) < 1.0 },
      { x: 29, z: faZ1 - 3, r: 0.4, until: () => P.has && P.sy > 3.6 && P.g && P.sz < faZ1 - 0.8 }, { x: 29, z: gz, r: 1.0 });
    botP2.push({ x: 29, z: fa0 - 6, r: 1.5 }, { x: 29, z: fa0 - 6, r: 1.5, until: () => P.has && Math.hypot(P.sx - 24, P.sz - lz) < 1.2 }, { x: 24, z: faZ1 + 11, r: 0.4, until: () => P.has && P.sy > 3.6 && P.g && P.sz < faZ1 - 0.8 },
      { x: 34, z: lz + 5, r: 1.0 }, { x: 34, z: lz, r: 0.6, until: () => gp().y > 4.0 && gp().grounded }, { x: 29, z: gz, r: 1.0 });

    botSteps(w, { p1: botP1, p2: botP2 });
  },
};
