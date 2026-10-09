import * as THREE from 'three';
import { chain } from '../common.js';
import { glowMaterial } from '../../engine/materials.js';
import { retreatEnv, deck, plate, gate, riser, lever, sign, lantern, lake, stage, setDeathRule, botSteps, beacon, COL } from './kit.js';

// Session 1 — Icebreakers. The tutorial for being two people: your own coloured plate, leapfrogging bridges, standing on a
// partner's head, a rope, a lever you pull for them, and a gate that only stays open for five seconds.
// Dusk over the lake. First-time pairs: 8–10 minutes.

export default {
  id: 'coop1',
  name: 'Icebreakers',
  music: 'l1',
  deathRule: 'self',
  completeQuip: 'Seven exercises. Zero hugs. The counsellor is not worried.',
  titleCam: { center: [0, 2, -60], radius: 30, height: 12 },

  build(w, game) {
    retreatEnv(w, { mood: 'dusk' });
    lake(w, -30);
    const c = w.coop, me = c.me, N = c.names;
    w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    const tell = (r, k, o) => c.tell(r, k, o);

    // ============================================================ 1. the pavilion: your plate, their plate =====
    deck(w, { x: 0, y: 0, z: -12, w: 22, d: 36, path: true });                       // z +6 … -30
    sign(w, 'SERENITY FALLS · COUPLES RETREAT', 0, 5.2, 4, { w: 12, h: 1.6 });
    sign(w, 'SESSION 1: ICEBREAKERS', 0, 3.6, 4, { w: 8, h: 1, border: '#39d7c9' });
    for (const lx of [-9, 9]) { lantern(w, lx, 0, 2); lantern(w, lx, 0, -22); }
    const g1 = gate(w, { x: 0, z: -26, w: 22, h: 5 });
    sign(w, 'STAND ON YOUR OWN COLOUR · TOGETHER', 0, 6.4, -25.5, { w: 11, h: 1.2 });
    const door = { t: 0 };
    const pa = plate(w, { x: -6, y: 0, z: -12, need: 'p1', label: N.p1 });
    const pb = plate(w, { x: 6, y: 0, z: -12, need: 'p2', label: N.p2 });
    w.updaters.push((dt) => {
      door.t = pa.pressed && pb.pressed ? 9 : Math.max(0, door.t - dt);
      g1.set(door.t > 0);
    });
    stage(w, 'welcome', { x: 0, y: 1, z: 2, w: 30, h: 4, d: 8 }, () => { tell('p1', 'coop.l1.intro.p1', { priority: 2 }); tell('p2', 'coop.l1.intro.p2', { priority: 2 }); });
    stage(w, 'plates', { x: 0, y: 1, z: -9, w: 22, h: 4, d: 5 }, () => tell('all', 'coop.l1.plates'));
    c.onEvent('stage:through', () => tell('all', 'coop.l1.door'));
    stage(w, 'through', { x: 0, y: 1, z: -29, w: 22, h: 4, d: 2 }, () => {});
    w.checkpoint({ x: 0, y: 0, z: -34, real: true });

    // ============================================================ 2. the islands: hold it up, then swap ===========
    const C = [-34, -50, -66, -82];
    C.forEach((z) => deck(w, { x: 0, y: 0, z, w: 10, d: 8, path: true }));
    const holder = (k) => (k % 2 ? 'p1' : 'p2'), crosser = (k) => (k % 2 ? 'p2' : 'p1');
    const F = {}, B = {}, R = {};
    for (let k = 1; k <= 3; k++) {
      R[k] = riser(w, { x: 0, y: 0, z: (C[k - 1] + C[k]) / 2, w: 3.6, d: 8, h: 0.6, drop: 7, color: 0xcdb48a, speed: 7 });
      F[k] = plate(w, { x: 2.5, y: 0, z: C[k - 1] - 2.2, need: holder(k), label: `${N[holder(k)]}: HOLD` });
      B[k + 1] = plate(w, { x: -2.5, y: 0, z: C[k] + 2.2, need: crosser(k), label: `${N[crosser(k)]}: KEEP IT UP` });
    }
    w.updaters.push(() => { for (let k = 1; k <= 3; k++) R[k].set(F[k].pressed || B[k + 1].pressed); });
    stage(w, 'islands', { x: 0, y: 1, z: -32, w: 12, h: 4, d: 4 }, () => tell('all', 'coop.l1.islands'));
    stage(w, 'islandsdone', { x: 0, y: 1, z: -82, w: 12, h: 4, d: 4 }, () => tell('all', 'coop.l1.islandsdone'));
    w.checkpoint({ x: 0, y: 0, z: C[2], real: true });

    // ============================================================ 3. the wall: stand on their head ==================
    deck(w, { x: 0, y: 0, z: -95, w: 16, d: 14, path: true });                       // z -88 … -102
    const U = deck(w, { x: 0, y: 3.0, z: -109, w: 16, d: 14, h: 3.0, path: true });   // z -102 … -116, top at 3.0
    const crate = w.plat({ x: 1.75, y: 1.2, z: -100.75, w: 2.5, d: 2.5, h: 1.2, tex: 'wood', color: 0xb98a55 });
    sign(w, 'THIS WALL IS 3 M. YOUR JUMP IS 1.4 M.', 0, 6.4, -101.4, { w: 11, h: 1.2 });
    const lift = riser(w, { x: 5.5, y: 3.0, z: -98, w: 3.2, d: 3.2, h: 0.6, drop: 3.0, always: true, speed: 4.2, color: 0xe9d9b0, trim: COL.good });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.4, 10), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8 })); col.position.set(5.5, 1.2, -96.0); w.add(col);
    const px = plate(w, { x: 0, y: 3.0, z: -112, need: 'any', label: 'LIFT: STAND HERE' });
    w.updaters.push(() => lift.set(px.pressed));
    sign(w, 'STAND ON THE LIFT. THE OTHER ONE STANDS ON THE PLATE.', 5.5, 6.0, -97.2, { w: 6.4, h: 1.6, size: 34 });
    stage(w, 'wall', { x: 0, y: 1, z: -92, w: 16, h: 4, d: 4 }, () => tell('all', 'coop.l1.wall'));
    stage(w, 'up', { x: 0, y: 4, z: -108, w: 16, h: 3, d: 6 }, () => tell('all', 'coop.l1.up'));
    w.checkpoint({ x: 0, y: 3.0, z: -108, real: true });

    // ============================================================ 4. the rope: close, closer, closest ===============
    const s1 = chain(w, { x: 0, y: 3.0, z: -116 }, [
      { gap: 2.2, d: 6, w: 7 },                 // 0
      { gap: 2.6, d: 4, w: 5, dy: 0.6 },        // 1  crumbles
      { gap: 2.8, d: 4, w: 5 },                 // 2
      { gap: 3.0, d: 6, w: 6, dy: -0.5 },       // 3  checkpoint
      { gap: 2.4, d: 4, w: 4, dy: 0.8 },        // 4  crumbles
      { gap: 2.8, d: 7, w: 7 },                 // 5  checkpoint, then the ferry
    ]);
    w.crumble(s1[1], { delay: 1.3, gone: 3.5 }); w.crumble(s1[4], { delay: 1.3, gone: 3.5 });
    w.checkpoint({ x: 0, y: s1[3].top, z: s1[3].body.z, real: true });
    w.checkpoint({ x: 0, y: s1[5].top, z: s1[5].body.z, real: true });
    const y1 = s1.endY, z1 = s1.endZ;
    const ferry = w.plat({ x: 0, y: y1, z: z1 - 5.5, w: 5.4, d: 5, h: 0.7, moving: true, path: true, tex: 'wood', color: 0xd9c9a0 });
    w.mover(ferry, (t) => ({ z: -Math.sin((t / 9) * Math.PI * 2) * 3 }));
    const s2 = chain(w, { x: 0, y: y1, z: z1 }, [
      { gap: 11, d: 6, w: 7 },
      { gap: 2.4, d: 4, w: 5, dy: 0.5 },
      { gap: 2.8, d: 4, w: 5 },
      { gap: 3.0, d: 5, w: 6, dy: 0.6 },
    ]);
    w.crumble(s2[2], { delay: 1.3, gone: 3.5 });
    w.checkpoint({ x: 0, y: s2[0].top, z: s2[0].body.z, real: true });
    const y2 = s2.endY, z2 = s2.endZ;
    const elev = w.plat({ x: 0, y: y2, z: z2 - 1 - 2.5, w: 5, d: 5, h: 0.7, moving: true, path: true, tex: 'wood', color: 0xd9c9a0 });
    w.mover(elev, (t) => ({ y: 2 + 2 * Math.sin((t / 7) * Math.PI * 2 - Math.PI / 2) }));      // y2 … y2+4
    const y3 = y2 + 4;
    const E = deck(w, { x: 0, y: y3, z: z2 - 1 - 5 - 1 - 7, w: 10, d: 14, path: true });
    const zE0 = z2 - 7, zE1 = zE0 - 14;
    w.checkpoint({ x: 0, y: y3, z: zE0 - 3, real: true });
    stage(w, 'rope', { x: 0, y: s1[0].top + 1, z: s1[0].body.z, w: 8, h: 4, d: 6 }, () => { c.tether({ max: 8.5, k: 14, rope: true, on: true }); setDeathRule(w, 'both'); tell('all', 'coop.l1.rope'); });
    stage(w, 'ferry', { x: 0, y: y1 + 1, z: s1[5].body.z, w: 8, h: 4, d: 6 }, () => tell('all', 'coop.l1.ferry'));
    stage(w, 'unrope', { x: 0, y: y3 + 1, z: zE0 - 4, w: 10, h: 4, d: 4 }, () => { c.tether({ on: false }); setDeathRule(w, 'self'); tell('all', 'coop.l1.unrope'); });

    // ============================================================ 5. the lever and the five-second gate =============
    const Y = y3;
    const H0 = zE1;                                                                   // hall starts where deck E ends
    deck(w, { x: 0, y: Y, z: H0 - 29, w: 12, d: 58, path: true });                    // hall z H0 … H0-58
    const GZ = H0 - 54;
    const g2 = gate(w, { x: 0, y: Y, z: GZ, w: 12, h: 5 });
    const open2 = { t: 0 };
    const mkLever = (key, x, z) => lever(w, { x, y: Y, z, key, label: 'Pull the lever', toggle: false }, (on) => { if (on) { open2.t = 5; w.game.audio.confirm?.(); } });
    // levers are momentary: each pull re-arms the gate for five seconds; the lever springs back
    const LA = mkLever('leverA', -4, H0 - 3);
    const K = deck(w, { x: 0, y: Y, z: GZ - 8, w: 12, d: 14, path: true });          // pocket beyond the gate
    const LB = mkLever('leverB', 4, GZ - 4);
    w.updaters.push((dt) => {
      open2.t = Math.max(0, open2.t - dt);
      g2.set(open2.t > 0);
      for (const k of ['leverA', 'leverB']) if (c.get(k) === true && open2.t <= 0) c.set(k, false);        // spring back
    });
    sign(w, 'THE GATE STAYS OPEN FIVE SECONDS. THE HALL IS 50 METRES.', 0, 7.5, GZ + 1.5, { w: 10, h: 1.8, size: 34 });
    sign(w, 'LEVER → GATE', -4, 4.2, H0 - 3.5, { w: 3.6, h: 0.8 });
    sign(w, 'LEVER → GATE', 4, 4.2, GZ - 4.5, { w: 3.6, h: 0.8 });
    stage(w, 'dash', { x: 0, y: Y + 1, z: H0 - 6, w: 12, h: 4, d: 6 }, () => tell('all', 'coop.l1.dash'));
    stage(w, 'dashdone', { x: 0, y: Y + 1, z: GZ - 4, w: 12, h: 4, d: 4 }, () => tell('all', 'coop.l1.dashdone'));
    w.checkpoint({ x: 0, y: Y, z: GZ - 8, real: true });

    // a very convincing finish line that is not one
    const fz = GZ - 13;
    const fake = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 12, 48), glowMaterial(0x3ddc97, 2));
    fake.position.set(0, Y + 1.9, fz + 1); w.add(fake);
    sign(w, 'FINISH', 0, Y + 4.4, fz + 1, { w: 4, h: 1, border: '#3ddc97' });
    const fakeZ = c.zone({ x: 0, y: Y + 1.9, z: fz + 1, w: 3, h: 3.4, d: 3, need: 'both', shrink: 0 });
    let fakeDone = false;
    fakeZ.onChange((z) => { if (z.active && !fakeDone) { fakeDone = true; tell('all', 'coop.l1.fake'); fake.visible = false; } });

    // ============================================================ 6. the stairs up to the circle =====================
    const st = chain(w, { x: 0, y: Y, z: fz - 2 }, Array.from({ length: 9 }, (_, i) => ({ gap: i === 0 ? 1.8 : 1.6, d: 4, w: 6 - (i % 3), dy: 1.3 })));
    w.crumble(st[4], { delay: 0.9, gone: 3 });
    w.checkpoint({ x: 0, y: st[3].top, z: st[3].body.z, real: true });
    const top = deck(w, { x: 0, y: st.endY + 1.0, z: st.endZ - 1.8 - 7, w: 14, d: 14, path: true });
    const gy = st.endY + 1.0, gz = st.endZ - 1.8 - 7;
    w.goal({ x: 0, y: gy, z: gz });
    sign(w, 'BOTH OF YOU. IN THE CIRCLE. AT THE SAME TIME.', 0, gy + 5.2, gz - 5, { w: 10, h: 1.6 });
    beacon(w, 0, gy, gz, 0xffe9a8, 20);
    for (const lx of [-5, 5]) lantern(w, lx, gy, gz + 2);
    stage(w, 'circle', { x: 0, y: gy + 1, z: gz + 4, w: 14, h: 4, d: 6 }, () => tell('all', 'coop.l1.circle'));

    // partner falling: the counsellor has opinions
    w.hooks.onPartnerDeath = () => { tell('all', 'coop.l1.partnerdown'); return true; };

    // ============================================================ scripted bot (tools/coop-bot.mjs) =====================
    const P = c.partner;
    const crosserSteps = (k) => [
      { x: 0, z: C[k - 1] - 3.2, r: 1.2, until: () => R[k].up },                          // wait at the near edge until the bridge is up
      { x: -2.5, z: C[k] + 2.2, until: () => P.has && P.sz < C[k] + 1 },                  // stand on the keep-it-up plate until the partner is across
    ];
    const holderSteps = (k) => [
      { x: 2.5, z: C[k - 1] - 2.2, until: () => B[k + 1].pressed },                       // hold the bridge until the crosser is on the far plate
      { x: 0, z: C[k], r: 1.5 },                                                           // then cross
    ];
    const bridges = (role) => [1, 2, 3].flatMap((k) => (holder(k) === role ? holderSteps(k) : crosserSteps(k)));
    const ownPlate = (role) => ({ x: role === 'p1' ? -6 : 6, z: -12, until: () => g1.passable });
    // p2 is the booster (stands against the wall), p1 the climber
    const court = {
      p2: [
        { x: 0, z: -101.5, r: 0.25, until: () => P.has && P.sy > 2.7 },                  // stand still against the wall while the partner climbs over
        { x: 5.5, z: -98, until: () => game.player.y > 2.7 },                              // then ride the lift up
      ],
      p1: [
        { x: 1.8, z: -100.9, r: 0.2, until: () => game.player.y > 1.1 && game.player.grounded },   // onto the crate
        { x: () => P.sx, z: () => P.sz, jump: 1.3, until: () => game.player.y > 1.6 && game.player.grounded },   // hop onto their head
        { x: 0, z: -106, jump: 3, until: () => game.player.y > 2.8 && game.player.grounded },                    // and over the edge
        { x: 0, z: -112, until: () => P.has && P.sy > 2.7 },                                // stand on the lift plate until they're up
      ],
    };
    const dash = {
      p1: [
        { x: -4, z: H0 - 3, until: () => P.has && P.sz < GZ + 6 },                          // wait at lever A until the partner is at the gate
        { x: -4, z: H0 - 3, use: true, until: () => open2.t > 0 },
        { x: 0, z: GZ + 3, r: 1.5 },
        { x: 0, z: GZ - 6, r: 2 },
      ],
      p2: [
        { x: 0, z: GZ + 3, until: () => g2.passable },
        { x: 4, z: GZ - 4, r: 1.5 },
        { x: 4, z: GZ - 4, until: () => P.has && P.sz < GZ + 30 },
        { x: 4, z: GZ - 4, use: true, until: () => open2.t > 3 },
      ],
    };
    const afterChain = () => game.player.z < zE0 - 6 && game.player.y > y3 - 1;
    botSteps(w, {
      p1: [ownPlate('p1'), { x: 0, z: -33 }, ...bridges('p1'), ...court.p1, { follow: true, until: afterChain }, ...dash.p1, { follow: true }],
      p2: [ownPlate('p2'), { x: 0, z: -33 }, ...bridges('p2'), ...court.p2, { follow: true, until: afterChain }, ...dash.p2, { follow: true }],
    });
  },
};
