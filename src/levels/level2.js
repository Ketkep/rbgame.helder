import * as THREE from 'three';
import { cursor, onPlat, farIslands, orbs, pulseLaser } from './common.js';
import { glowMaterial, plainMaterial } from '../engine/materials.js';

// Level 2 — Checkpoint Island. Five checkpoints, every one of them trustworthy. Mostly.
// CP1 real · CP2 real · CP3 FAKE · CP4 real · CP5 FAKE (the pole is built a few degrees crooked).

export default {
  id: 'l2',
  name: 'Checkpoint Island',
  music: 'l2',
  completeQuip: 'I\'m genuinely not sure how you did that. Good for you.',
  titleCam: { center: [0, 0, -30], radius: 24, height: 9 },

  build(w, game) {
    w.env({
      top: 0x2a1a6e, horizon: 0xff8a5c, bottom: 0x8a3f6a,
      fog: { color: 0xf0866a, near: 70, far: 440 },
      sun: { color: 0xffc58a, intensity: 2.3, dir: [-0.6, 0.32, -0.7] },
      hemi: { sky: 0xffb48a, ground: 0x6a3a7a, intensity: 0.85 },
      exposure: 1.0,
      bloom: { strength: 0.6, radius: 0.65, threshold: 1.0 },
      clouds: { count: 70, color: 0xffb490, y: [-75, -22], radius: [25, 340], opacity: 0.6, size: [60, 140] },
      motes: { color: 0xffe0b0, count: 180, size: 0.1, opacity: 0.6 },
    });
    w.setTheme({ tex: 'stone', color: 0xfff1e2, trim: 0xffc83d, edge: 0x6a4a5a, edgeOpacity: 0.22, accent: 0xffc83d, danger: 0xff4d5e, rock: 0x6e5a6a, roughness: 0.85 });
    w.spawn = { x: 0, y: 0, z: 3, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -45;

    const C = cursor(w, { y: 0, z: -6 });
    w.plat({ x: 0, y: 0, z: 0, w: 12, d: 12, rock: true, path: true });

    // ---- A: warm-up stepping stones --------------------------------------------------------
    [
      { gap: 2.2, d: 3.6, wd: 3.6, x: 0 }, { gap: 2.6, d: 3.4, wd: 3.4, x: 1.6 }, { gap: 2.8, d: 3.2, wd: 3.2, x: -1.2, dy: 0.3 },
      { gap: 3.0, d: 3, wd: 3, x: 0.5, dy: 0.3 }, { gap: 3.0, d: 3, wd: 3, x: -1.5 }, { gap: 2.8, d: 3.2, wd: 3.2, x: 1.4, dy: 0.3 },
      { gap: 3.1, d: 3, wd: 3, x: 0, dy: -0.3 },
    ].forEach((s) => C.place({ ...s, rock: true }));

    // CP1 — real
    const cp1 = C.place({ gap: 2.6, d: 9, wd: 9, rock: true });
    w.checkpoint({ x: 0, y: C.y, z: cp1.body.z, real: true });

    // ---- B: moving platforms ---------------------------------------------------------------
    const movers = [];
    for (let i = 0; i < 4; i++) {
      const p = C.place({ gap: 2.6, d: 3.2, wd: 3.2, h: 0.6, rock: true, moving: true });
      const sp = 1.15 + i * 0.12, ph = i * 1.9;
      w.mover(p, (t) => ({ x: Math.sin(t * sp + ph) * 3.0 }));
      movers.push(p);
    }
    const cp2 = C.place({ gap: 2.6, d: 9, wd: 9, rock: true });
    w.checkpoint({ x: 0, y: C.y, z: cp2.body.z, real: true });

    // ---- C: crumbling run ------------------------------------------------------------------
    const crumbs = [];
    [0, 2.0, -0.5, -2.4, 0, 2.3, 0.4, -1].forEach((x, i) => {
      const p = C.place({ gap: i === 0 ? 2.2 : 2.5, d: 3, wd: 3, x, rock: true, moving: true });
      w.crumble(p, { delay: 0.55, gone: 3.5 });
      crumbs.push(p);
    });
    // CP3 — FAKE
    const cp3 = C.place({ gap: 2.4, d: 9, wd: 9, rock: true });
    w.checkpoint({ x: 0, y: C.y, z: cp3.body.z, real: false });

    // ---- D: precision stairs ---------------------------------------------------------------
    let stairs0 = null;
    for (let i = 0; i < 6; i++) {
      const p = C.place({ gap: 2.4, d: 2.6, wd: 2.6, dy: 1.1, x: (i % 2 ? 1 : -1) * 1.0, rock: true });
      if (i === 0) stairs0 = p;
    }

    // ---- E: laser corridor -----------------------------------------------------------------
    const e = C.place({ gap: 2.4, d: 44, wd: 6.4 });
    const ez0 = e.body.z + 22; // near edge
    for (let i = 0; i < 5; i++) {
      pulseLaser(w, { x: 0, y: C.y + 0.5, z: ez0 - 8 - i * 7.5, width: 6.4, period: 3.0, on: 1.15, offset: [0, 1.0, 2.0, 0.5, 1.5][i] });
    }
    const cp4p = C.place({ gap: 0, d: 8, wd: 8 });
    w.checkpoint({ x: 0, y: C.y, z: cp4p.body.z, real: true });

    // ---- F: the long way up ----------------------------------------------------------------
    [
      { gap: 3.0, d: 2.4, wd: 2.4, dy: 0.4, x: 0 }, { gap: 3.2, d: 2.2, wd: 2.2, dy: 0.4, x: 1.4 },
      { gap: 3.3, d: 2.2, wd: 2.2, dy: 0.4, x: -1.2 }, { gap: 3.4, d: 2.0, wd: 2.0, dy: 0.2, x: 0 },
    ].forEach((s) => C.place({ ...s, rock: true }));
    // CP5 — FAKE, right before the last jumps
    const cp5 = C.place({ gap: 3.0, d: 7, wd: 7, dy: 0.4, rock: true });
    w.checkpoint({ x: 0, y: C.y, z: cp5.body.z, real: false });
    C.place({ gap: 3.4, d: 2.2, wd: 2.2, dy: 0.3, x: 0, rock: true });
    const top = C.place({ gap: 3.6, d: 10, wd: 10, dy: 0.3, rock: true });
    w.goal({ x: 0, y: C.y, z: top.body.z - 1, color: 0xffc83d,
      onReach: () => { game.say('l2.complete', { priority: 2 }); game.completeLevel(); } });
    w.light(0xffc83d, 12, 22, 0, C.y + 3, top.body.z + 1);

    // spire under the goal island
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 5, 140, 10), plainMaterial(0x4a3a5a, { metalness: 0.4, roughness: 0.5 }));
    spire.position.set(0, C.y - 71, top.body.z); spire.castShadow = true; w.add(spire);
    for (let k = 0; k < 6; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3 + k * 0.28, 0.12, 8, 28), glowMaterial(0xffc83d, 1.6));
      ring.rotation.x = Math.PI / 2; ring.position.set(0, C.y - 6 - k * 9, top.body.z); w.add(ring);
    }

    // ---- set dressing ----------------------------------------------------------------------
    farIslands(w, { count: 22, seed: 4, y: [-45, 40], z: [60, -330] });
    orbs(w, { count: 36, x: [-26, 26], y: [-1, 16], z: [4, -250], color: 0xffd58a });
    w.sign({ text: 'CHECKPOINT ISLAND', x: 0, y: 9, z: -4, w: 15, h: 3, color: '#fff3d6', glow: 1.15, glowColor: '#ff8a3d', tw: 1024 });
    w.sign({ text: '5 CHECKPOINTS · ALL TRUSTWORTHY*', x: 0, y: 6.1, z: -4, w: 11, h: 1.0, color: '#ffe0a8', glow: 1.0, tw: 1024, size: 54 });
    w.sign({ text: '*MOSTLY', x: 0, y: 4.9, z: -4, w: 3, h: 0.7, color: '#ff9a6a', glow: 1.0, tw: 256, size: 44 });

    // ---- narrator beats --------------------------------------------------------------------
    const st = { t: 0, said: false };
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      st.t += dt;
      if (!st.said && st.t > 1.2) { st.said = true; g.say('l2.intro'); g.say('l2.tower'); }
    };
    onPlat(w, cp1, () => game.say('l2.mover'));
    onPlat(w, cp2, () => game.say('l2.crumble'));
    onPlat(w, e, () => game.say('l2.sweep'));
    onPlat(w, cp5, () => game.say('l2.last'));
    w.hooks.onCheckpoint = (cp) => {
      if (cp.real) { if (Math.random() < 0.6) game.say('l2.cp.real', { priority: 1 }); }
      else game.say('l2.cp.fake', { priority: 1 });
    };
    void movers; void crumbs;
  },
};
