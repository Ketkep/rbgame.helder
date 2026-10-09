import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, hotelHalo, GOLD } from './kit.js';
import { onPlat } from '../common.js';
import { trollCheckpoint, evasiveGoal, fakeComplete, twistZone, vanishAfter, stageTitle, stageHint } from './trolls.js';

// Hotel level 16 — "Chandelier" (Impossible · Penthouse). FIRST PASS: the penthouse ballroom, forty metres up, no floor. The only
// things to stand on are chandeliers. Four stages: still ones, swinging ones, crystals that let go, and a dark finish where the
// goal is shy and the first LEVEL COMPLETE is a lie.

const NAMES = ['The Foyer', 'The Swing Set', 'The Carousel', 'Crystal Drop', 'Follow the Left', 'Lights Out'];

export default {
  id: 'hotel-16',
  name: 'Chandelier',
  music: 'hotel',
  completeQuip: 'You crossed the ballroom on the lighting. The lighting is very proud. The lighting wants a raise.',

  build(w, game) {
    hotelEnv(w);
    w.killY = -45;
    const H = 34, Z1 = 20, Z0 = -170;
    roomShell(w, { x0: -16, x1: 16, z0: Z0, z1: Z1, yb: -60, H, wallTex: 'damask', pilasterEvery: 14, lamps: false });
    w.spawn = { x: 0, y: 0, z: 14, yaw: 0 };
    w.respawn = { ...w.spawn };

    const stages = NAMES.map(() => ({ at: null, route: [] }));
    const cps = new Map();
    const mark = (p) => { p.o.path = true; return p; };
    const hop = (i, p) => { mark(p); stages[i].route.push({ x: p.body.x, y: p.top, z: p.body.z }); return p; };
    const start = (i, p) => { mark(p); stages[i].at = { x: p.body.x, y: p.top, z: p.body.z }; return p; };
    const cp = (i, x, y, z) => { cps.set(w.checkpoint({ x, y, z, real: true }), i); };
    const pad = (x, y, z, ww = 4.4, dd = 3.6) => w.plat({ x, y, z, w: ww, d: dd, h: 0.5, tex: 'marble', color: 0xffffff, roughness: 0.2 });
    // a chandelier you can stand on: a brass ring with a glowing crystal drop, hung from the ceiling on a chain
    const lamp = (x, y, z, s = 2.4, o = {}) => {
      const p = w.plat({ x, y, z, w: s, d: s, h: 0.3, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.1, ...o });
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), glowMaterial(o.crystal ?? 0xcfe6ff, 1.8)); crystal.position.set(0, -0.55, 0); p.group.add(crystal);
      if (!o.moving) { const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, H - y, 6), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); chain.position.set(0, (H - y) / 2 + 0.15, 0); p.group.add(chain); }
      return p;
    };
    const glow = (x, y, z) => hotelHalo(w, x, y, z, 5, 0xffd9a0, 0.18);

    // ===== 1 · the foyer: still chandeliers, long gaps
    start(0, w.plat({ x: 0, y: 0, z: 14, w: 5, d: 4, h: 0.6, tex: 'marble', color: 0xffffff, roughness: 0.2 }));
    [[0, 0.3, 9.2], [-2.0, 0.6, 5.0], [2.0, 0.9, 0.8], [-2.0, 1.2, -3.4], [2.0, 1.5, -7.6], [0, 1.8, -11.8], [-1.6, 2.1, -16.0]].forEach(([x, y, z]) => { hop(0, lamp(x, y, z, 2.1)); glow(x, y + 1, z); });
    const E1 = start(1, pad(0, 2.4, -20.6)); cp(1, 0, 2.4, -20.6);

    // ===== 2 · the swing set: they sway, out of step with each other
    [[2.8, 0.9], [-2.8, 1.1], [3.0, 0.8], [-3.0, 1.05], [2.8, 0.95], [-2.8, 0.85]].forEach(([a, sp], i) => {
      const z = -25.6 - i * 4.8, y = 2.6 + i * 0.12;
      const p = hop(1, lamp(0, y, z, 2.2, { moving: true })); w.mover(p, (t) => ({ x: a * Math.sin(t * sp + i * 1.3) })); glow(0, y + 1, z);
    });
    const E2 = start(2, pad(0, 3.4, -55.2)); cp(2, 0, 3.4, -55.2);
    twistZone(game, w, { x: 0, y: 6, z: -35.2, w: 7, h: 4, d: 3 }, 'swap', { sec: 5, say: 'hotel.l16.swap' });

    // ===== 3 · the carousel: a ring of chandeliers turns slowly; ride one across (the expiring checkpoint is at the far side)
    const ZC = -64.4, R = 4.6, OM = 0.42, ring = [];
    for (let k = 0; k < 3; k++) {
      const ph = (k / 3) * Math.PI * 2;
      const p = lamp(Math.sin(ph) * R, 3.6, ZC + Math.cos(ph) * R, 2.3, { moving: true });
      w.mover(p, (t) => ({ x: Math.sin(ph + OM * t) * R - Math.sin(ph) * R, z: Math.cos(ph + OM * t) * R - Math.cos(ph) * R }));
      ring.push(p);
    }
    const E3 = start(3, pad(0, 3.6, -73.6));
    trollCheckpoint(w, game, { x: 0, y: 3.6, z: -73.6, mode: 'expire', ttl: 30, say: 'hotel.l16.expired' });
    stages[2].route.push({ x: 0, y: 3.6, z: ZC });
    w.sign({ text: 'CAROUSEL ▸', x: 0, y: 3.62, z: -58.4, w: 3.2, h: 0.8, rotX: -Math.PI / 2, color: '#ffd9a0', double: false, tw: 512, size: 70 });

    // ===== 4 · crystal drop: a fake checkpoint, chandeliers that let go, a brass bar that leaves
    hop(3, w.plat({ x: 0, y: 3.8, z: -79.0, w: 3.4, d: 3.0, h: 0.4, tex: 'marble', color: 0xffffff, roughness: 0.2 }));
    trollCheckpoint(w, game, { x: 0, y: 3.8, z: -79.0, mode: 'fake' });
    [[-1.6, 3.9, -83.6], [1.6, 4.1, -87.6], [-1.6, 4.3, -91.6], [1.6, 4.5, -95.6], [0, 4.7, -99.6]].forEach(([x, y, z]) => { hop(3, w.crumble(lamp(x, y, z, 1.9), { delay: 0.45, gone: 3.2 })); glow(x, y + 1, z); });
    const bar = hop(3, w.plat({ x: 0, y: 4.9, z: -106.4, w: 2.2, d: 7.5, h: 0.3, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9 }));
    vanishAfter(w, game, bar, { axis: 'z', dir: -1, frac: 0.5, delay: 0.7, back: 3.2, say: 'hotel.l16.bar' });
    const E4 = start(4, pad(0, 5.1, -113.4)); cp(4, 0, 5.1, -113.4);

    // ===== 5 · "follow the left ones": the host says left, always. One side of each pair lets go (a red glint in the crystal says which)
    const doomed = [], safeRoute = [];
    for (let i = 0; i < 7; i++) {
      const z = -118.8 - i * 3.6, y = 5.3 + i * 0.1, bad = Math.random() < 0.5 ? -1 : 1;
      for (const sx of [-1, 1]) {
        const isBad = sx === bad;
        const p = lamp(sx * 1.5, y, z, 1.8, { crystal: isBad ? 0xff6a5a : 0xcfe6ff });
        if (isBad) { w.crumble(p, { delay: 0.18, gone: 3.0 }); doomed.push(p); } else { hop(4, p); safeRoute.push(p); }
      }
    }
    const E5 = start(5, pad(0, 5.9, -143.4)); cp(5, 0, 5.9, -143.4);

    // ===== 6 · lights out: the room blinks dark, the goal runs, the first LEVEL COMPLETE is a lie
    [[-2.0, 6.1, -147.0], [2.0, 6.3, -151.0], [0, 6.5, -155.0], [-2.2, 6.7, -158.8]].forEach(([x, y, z]) => hop(5, lamp(x, y, z, 1.9)));
    const fin = mark(w.plat({ x: 0, y: 6.9, z: -164.4, w: 6, d: 10, h: 0.6, tex: 'marble', color: 0xffffff, roughness: 0.2 }));
    stages[5].route.push({ x: 0, y: 6.9, z: -164.4 });
    let dark = false;
    w.onUpdate((dt, t) => {
      const on = game.player.z < -143.4 && ((t * 0.4) % 1) < 0.35;
      if (on !== dark) { dark = on; w.hemi.intensity = on ? 0.05 : 0.4; }
    });
    w.onRespawn(() => { dark = false; w.hemi.intensity = 0.4; });
    const runner = evasiveGoal(w, game, {
      spots: [{ x: 0, y: 6.9, z: -167.4 }, { x: 0, y: 6.9, z: -161.4 }], radius: 5, color: GOLD, say: 'hotel.l16.hop',
      onReach: () => { if (!fakeComplete(game, w, { title: 'LEVEL COMPLETE', say: 'hotel.l16.fakewin', then: () => { w.goalObj = real; game.say('hotel.l16.again', { priority: 2 }); } })) game.completeLevel(); },
    });
    const real = w.goal({ x: 0, y: 6.9, z: -159.4, color: GOLD, onReach: () => { game.say('hotel.l16.done', { priority: 2 }); game.completeLevel(); } });
    w.goalObj = runner;   // (the bot and the hint chase the runner until the fake win has played)
    void E1; void E4; void E5; void fin; void doomed;

    w.hooks.onCheckpoint = (c) => { const i = cps.get(c); if (i !== undefined) stageTitle(game, w, i + 1, NAMES.length, NAMES[i]); };
    let t0 = 0, intro = false;
    w.hooks.frame = (dt, g) => { if (g.state !== 'playing') return; t0 += dt; if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l16.intro'); stageTitle(g, w, 1, NAMES.length, NAMES[0]); } };
    onPlat(w, E1, () => game.say('hotel.l16.swing'));
    onPlat(w, E2, () => game.say('hotel.l16.carousel'));
    onPlat(w, E3, () => game.say('hotel.l16.crystal'));
    onPlat(w, E4, () => game.say('hotel.l16.left'));
    onPlat(w, E5, () => game.say('hotel.l16.dark'));
    w.hooks.onDeath = () => { if (Math.random() < 0.6) { game.say('hotel.l16.fall', { priority: 1 }); return true; } return false; };
    stageHint(w, stages);
    // the bot rides the carousel: step on when a chandelier swings past the entry, step off when one swings past the exit
    w.botPlan = (g) => {
      const p = g.player;
      if (p.z > ZC + 8 || p.z < ZC - 8.5) return null;
      const near = (q, x, z) => Math.hypot(q.body.x - x, q.body.z - z) < 1.3;
      if (p.ground === E2.body) { const q = ring.find((r) => near(r, 0, ZC + R)); return q ? { body: q.body } : { x: p.x, z: p.z, wait: true }; }
      const on = ring.find((r) => p.ground === r.body);
      if (on) return near(on, 0, ZC - R) ? { body: E3.body } : { x: on.body.x, z: on.body.z, wait: true };
      return null;
    };
    w.chand = { ring, doomed, safeRoute };
  },
};
