import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, hotelHalo, GOLD } from './kit.js';
import { onPlat } from '../common.js';
import { trollCheckpoint, evasiveGoal, fakeComplete, twistZone, vanishAfter, stageTitle, stageHint } from './trolls.js';

// Hotel level 16 — "Chandelier" (Impossible · Penthouse). FIRST PASS: the penthouse ballroom, forty metres up, no floor. The only
// things to stand on are chandeliers. Four stages: still ones, swinging ones, crystals that let go, and a dark finish where the
// goal is shy and the first LEVEL COMPLETE is a lie.

const NAMES = ['The Foyer', 'The Swing Set', 'Crystal Drop', 'Lights Out'];

export default {
  id: 'hotel-16',
  name: 'Chandelier',
  music: 'hotel',
  completeQuip: 'You crossed the ballroom on the lighting. The lighting is very proud. The lighting wants a raise.',

  build(w, game) {
    hotelEnv(w);
    w.killY = -45;
    const H = 30, Z1 = 20, Z0 = -112;
    roomShell(w, { x0: -16, x1: 16, z0: Z0, z1: Z1, yb: -60, H, wallTex: 'damask', pilasterEvery: 14, lamps: false });
    w.spawn = { x: 0, y: 0, z: 14, yaw: 0 };
    w.respawn = { ...w.spawn };

    const stages = NAMES.map(() => ({ at: null, route: [] }));
    const cps = new Map();
    const mark = (p) => { p.o.path = true; return p; };
    const hop = (i, p) => { mark(p); stages[i].route.push({ x: p.body.x, y: p.top, z: p.body.z }); return p; };
    const start = (i, p) => { mark(p); stages[i].at = { x: p.body.x, y: p.top, z: p.body.z }; return p; };
    const cp = (i, x, y, z) => { cps.set(w.checkpoint({ x, y, z, real: true }), i); };
    // a chandelier you can stand on: a brass ring with a glowing crystal drop, hung from the ceiling on a chain
    const lamp = (x, y, z, s = 2.4, o = {}) => {
      const p = w.plat({ x, y, z, w: s, d: s, h: 0.3, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.1, ...o });
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), glowMaterial(0xcfe6ff, 1.8)); crystal.position.set(0, -0.55, 0); p.group.add(crystal);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, H - y, 6), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); chain.position.set(0, (H - y) / 2 + 0.15, 0); p.group.add(chain);
      if (o.moving) p.o.moving = true;
      return p;
    };
    const glow = (x, y, z) => hotelHalo(w, x, y, z, 5, 0xffd9a0, 0.18);

    // stage 1 · the foyer: eight still chandeliers across a long gap
    const P0 = start(0, w.plat({ x: 0, y: 0, z: 14, w: 5, d: 4, h: 0.6, tex: 'marble', color: 0xffffff, roughness: 0.2 }));
    const f = [[0, 0.3, 8.6], [-2.2, 0.8, 4.8], [2.2, 1.3, 1.0], [-2.0, 1.6, -2.8], [2.2, 1.9, -6.6], [0, 2.2, -10.4], [-2.4, 2.4, -14.2]];
    f.forEach(([x, y, z]) => { hop(0, lamp(x, y, z, 2.2)); glow(x, y + 1, z); });
    const E1 = start(1, w.plat({ x: 0, y: 2.6, z: -18.8, w: 4.4, d: 3.6, h: 0.5, tex: 'marble', color: 0xffffff, roughness: 0.2 }));
    cp(1, 0, 2.6, -18.8);

    // stage 2 · the swing set: they sway, and the gaps are wider
    const sw = [[0, 2.8, -23.6, 2.5, 0.9], [0, 3.0, -28.2, -2.5, 1.0], [0, 3.2, -32.8, 2.5, 1.1], [0, 3.4, -37.4, -2.5, 0.95], [0, 3.6, -42.0, 2.5, 1.05], [0, 3.8, -46.6, -2.5, 0.9]];
    sw.forEach(([x, y, z, a, sp], i) => {
      const p = hop(1, lamp(x, y, z, 2.0, { moving: true }));
      w.mover(p, (t) => ({ x: a * Math.sin(t * sp + i) }));
      glow(x, y + 1, z);
    });
    const E2 = start(2, w.plat({ x: 0, y: 4.0, z: -51.4, w: 4.4, d: 3.6, h: 0.5, tex: 'marble', color: 0xffffff, roughness: 0.2 }));
    twistZone(game, w, { x: 0, y: 6, z: -32.8, w: 6, h: 4, d: 2.6 }, 'swap', { sec: 5, say: 'hotel.l16.swap' });
    cp(2, 0, 4.0, -51.4);

    // stage 3 · crystal drop: a fake checkpoint, then chandeliers that let go
    trollCheckpoint(w, game, { x: 0, y: 4.0, z: -54.6, mode: 'fake' });
    const cr = [[-2.0, 4.2, -57.0], [2.0, 4.4, -60.4], [-2.0, 4.6, -63.8], [2.0, 4.8, -67.2]];
    cr.forEach(([x, y, z]) => { hop(2, w.crumble(lamp(x, y, z, 2.0), { delay: 0.45, gone: 3.2 })); glow(x, y + 1, z); });
    const bar = hop(2, w.plat({ x: 0, y: 5.0, z: -73.2, w: 2.2, d: 7, h: 0.3, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9 }));
    vanishAfter(w, game, bar, { axis: 'z', dir: -1, frac: 0.5, delay: 0.7, back: 3.2, say: 'hotel.l16.bar' });
    const E3 = start(3, w.plat({ x: 0, y: 5.2, z: -79.4, w: 4.4, d: 3.6, h: 0.5, tex: 'marble', color: 0xffffff, roughness: 0.2 }));
    cp(3, 0, 5.2, -79.4);

    // stage 4 · lights out: the room dims, then the goal runs, then a fake LEVEL COMPLETE
    const d4 = [[-2.0, 5.4, -83.4], [2.0, 5.6, -86.8], [0, 5.8, -90.2], [-2.2, 6.0, -93.6], [2.2, 6.4, -97.0]];
    d4.forEach(([x, y, z]) => { hop(3, lamp(x, y, z, 2.0)); });
    const fin = mark(w.plat({ x: 0, y: 6.4, z: -104, w: 6, d: 11, h: 0.6, tex: 'marble', color: 0xffffff, roughness: 0.2 }));
    stages[3].route.push({ x: 0, y: 6.4, z: -102 });
    let dark = false;
    w.onUpdate((dt, t) => {
      const on = game.player.z < -80 && ((t * 0.4) % 1) < 0.35;
      if (on !== dark) { dark = on; w.hemi.intensity = on ? 0.05 : 0.4; }
    });
    w.onRespawn(() => { dark = false; w.hemi.intensity = 0.4; });
    const runner = evasiveGoal(w, game, {
      spots: [{ x: 0, y: 6.4, z: -106 }, { x: 0, y: 6.4, z: -99.5 }], radius: 5, color: GOLD, say: 'hotel.l16.hop',
      onReach: () => { if (!fakeComplete(game, w, { title: 'LEVEL COMPLETE', say: 'hotel.l16.fakewin', then: () => { w.goalObj = real; game.say('hotel.l16.again', { priority: 2 }); } })) game.completeLevel(); },
    });
    const real = w.goal({ x: 0, y: 6.4, z: -108.4, color: GOLD, onReach: () => { game.say('hotel.l16.done', { priority: 2 }); game.completeLevel(); } });
    w.goalObj = runner;   // (the bot and the hint chase the runner until the fake win has played)

    w.hooks.onCheckpoint = (c) => { const i = cps.get(c); if (i !== undefined) stageTitle(game, w, i + 1, NAMES.length, NAMES[i]); };
    let t0 = 0, intro = false;
    w.hooks.frame = (dt, g) => { if (g.state !== 'playing') return; t0 += dt; if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l16.intro'); stageTitle(g, w, 1, NAMES.length, NAMES[0]); } };
    onPlat(w, E1, () => game.say('hotel.l16.swing'));
    onPlat(w, E2, () => game.say('hotel.l16.crystal'));
    onPlat(w, E3, () => game.say('hotel.l16.dark'));
    w.hooks.onDeath = () => { if (Math.random() < 0.6) { game.say('hotel.l16.fall', { priority: 1 }); return true; } return false; };
    stageHint(w, stages);
    void P0; void fin;
  },
};
