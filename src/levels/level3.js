import * as THREE from 'three';
import { pulseLaser, spot } from './common.js';
import { glowMaterial, plainMaterial } from '../engine/materials.js';

// Level 3 — The Tower. A square spiral climbed around a central core. Falling doesn't kill you
// (you land on whatever ledge gravity picks), it just erases your progress. Lasers are the only killers.

const H = 10;                                        // ring half-extent (centre line of the path)
const CS = 4.4;                                      // corner platform size
const SUMMIT = 8;
const DIR = [[1, 0], [0, -1], [-1, 0], [0, 1]];      // E, N, W, S
const OUT = [[0, 1], [1, 0], [0, -1], [-1, 0]];      // outward normal for each heading
const CORNER = [[H, H], [H, -H], [-H, -H], [-H, H]]; // corner reached at the END of each heading

// One entry per side of the spiral (4 sides per loop). `rise` is the height gained along the side;
// beams and laser platforms are single long ledges, so they climb very little (a single hop can
// only rise ~1.3 m) and the neighbouring sides pick up the slack. Each loop totals 12 m.
const SIDES = [
  // loop 1 — warm-up, wide ledges
  { l: 3.6, wid: 3.4, g: 2.2, rise: 3.0 }, { l: 3.6, wid: 3.4, g: 2.2, rise: 3.0 }, { l: 3.4, wid: 3.2, g: 2.3, rise: 3.0 }, { l: 3.4, wid: 3.0, g: 2.4, rise: 3.0 },
  // loop 2 — narrower, a beam, first wind
  { l: 2.8, wid: 2.4, g: 2.5, rise: 3.6 }, { kind: 'beam', wid: 0.95, rise: 0.8 }, { l: 2.6, wid: 2.2, g: 2.6, wind: true, rise: 3.8 }, { l: 2.4, wid: 2.0, g: 2.7, cp: 'A', rise: 3.8 },
  // loop 3 — crumbling, moving, gusty
  { l: 2.6, wid: 2.4, g: 2.4, crumble: true, rise: 3.6 }, { l: 2.8, wid: 2.6, g: 2.3, mover: true, rise: 3.6 }, { l: 2.2, wid: 1.8, g: 2.7, wind: true, rise: 3.8 }, { kind: 'beam', wid: 0.9, wind: true, cp: 'B', rise: 1.0 },
  // loop 4 — lasers, then tiny precision ledges
  { kind: 'laser', wid: 3.4, rise: 0.8 }, { l: 1.8, wid: 1.8, g: 2.8, n: 3, rise: 3.8 }, { l: 2.0, wid: 1.8, g: 2.6, crumble: true, n: 3, rise: 3.8 }, { l: 1.5, wid: 1.6, g: 2.9, n: 3, wind: true, rise: 3.6 },
];

export default {
  id: 'l3',
  name: 'The Tower',
  music: 'l3',
  completeQuip: 'Impossible. I mean — congratulations!',
  titleCam: { center: [0, 14, 0], radius: 32, height: 6 },

  build(w, game) {
    w.env({
      top: 0x070a26, horizon: 0xff6a3a, bottom: 0x160a24,
      fog: { color: 0x2a1738, near: 45, far: 360 },
      sun: { color: 0xc8d4ff, intensity: 2.2, dir: [0.4, 0.65, 0.5] },
      hemi: { sky: 0x8a94ff, ground: 0x6a5688, intensity: 1.15 },
      exposure: 1.1,
      stars: 0.95,
      bloom: { strength: 0.75, radius: 0.7, threshold: 0.95 },
      clouds: { count: 50, color: 0x8a62a8, y: [-45, -12], radius: [25, 300], opacity: 0.5, size: [60, 140] },
      motes: { color: 0xffb070, count: 160, size: 0.09, opacity: 0.5 },
    });
    w.setTheme({ tex: 'metal', color: 0xc4ccdc, trim: 0xff8a3d, edge: 0xff8a3d, edgeOpacity: 0.18, accent: 0xff8a3d, danger: 0xff2d4d, roughness: 0.55, metalness: 0.35 });
    w.spawn = { x: -10, y: 0, z: 17, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -35;
    w.altimeter = { max: 50, record: 0 };
    w.windLevel = 0.12;

    // ---- base + core --------------------------------------------------------------------
    w.plat({ x: 0, y: 0, z: 0, w: 64, d: 64, h: 3, path: false });
    w.box({ x: 0, y: 26, z: 0, w: 10, h: 60, d: 10, tex: 'metal', color: 0x7a8294, rough: 0.5, metal: 0.3 });
    for (let y = 3; y < 56; y += 6) w.box({ x: 0, y, z: 0, w: 10.35, h: 0.32, d: 10.35, glow: 0xff8a3d, glowIntensity: 1.4, shadow: false });
    // beacon + light shaft marking the summit
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 16), glowMaterial(0xffc07a, 2.6)); beacon.position.set(0, 58.5, 0); w.add(beacon);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 2.6, 220, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    shaft.position.set(0, 168, 0); w.add(shaft);
    w.light(0xffa860, 22, 40, 0, 56, 0);
    w.sign({ text: 'THE TOWER', x: 0, y: 7, z: 5.15, w: 8.5, h: 2.2, color: '#ffd9b0', glow: 1.15, glowColor: '#ff8a3d', tw: 1024 });
    w.sign({ text: 'DON\'T LOOK DOWN', x: 0, y: 4.2, z: 5.15, w: 7, h: 0.9, color: '#ff9a7a', glow: 1.0, tw: 1024, size: 56 });

    // ---- the spiral ----------------------------------------------------------------------
    const platsByCP = {};
    const plats = [];
    const strut = (cx, y, cz, k, wid) => {
      const o = OUT[k % 4];
      const len = H - wid / 2 - 5;
      if (len < 0.5) return;
      const mid = (5 + H - wid / 2) / 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(o[0] ? len : 0.32, 0.38, o[1] ? len : 0.32), plainMaterial(0x4a505e, { metalness: 0.5, roughness: 0.45 }));
      m.position.set(o[0] ? Math.sign(o[0]) * mid : cx, y - 0.95, o[1] ? Math.sign(o[1]) * mid : cz);
      m.matrixAutoUpdate = false; m.updateMatrix();
      w.add(m);
    };

    let prev = { x: -H, z: H, cs: CS };
    let y = 0.6;
    const addCorner = (c, label) => {
      const p = w.plat({ x: c.x, y, z: c.z, w: c.cs, d: c.cs, h: 1.1, path: true });
      if (label !== undefined) w.sign({ text: label, x: c.x, y: y + 0.03, z: c.z, w: c.cs - 0.8, h: 1.3, rotX: -Math.PI / 2, color: '#ffb070', double: false, tw: 512, size: 90 });
      return p;
    };
    addCorner(prev, '0 m');
    for (let k = 0; k < SIDES.length; k++) {
      const cfg = SIDES[k], d = DIR[k % 4], o = OUT[k % 4];
      const last = k === SIDES.length - 1;
      const tgt = { x: CORNER[k % 4][0], z: CORNER[k % 4][1], cs: last ? SUMMIT : CS };
      const E = { x: prev.x + d[0] * prev.cs / 2, z: prev.z + d[1] * prev.cs / 2 };
      const D = (tgt.x - E.x) * d[0] + (tgt.z - E.z) * d[1] - tgt.cs / 2;
      let n, l, g;
      if (cfg.kind === 'beam') { n = 1; g = 2.3; l = D - 2 * g; }
      else if (cfg.kind === 'laser') { n = 1; g = 2.4; l = D - 2 * g; }
      else {
        l = cfg.l;
        if (cfg.n) n = cfg.n;
        else { n = 1; while (n < 9 && (D - n * l) / (n + 1) > cfg.g + 0.3) n++; } // fewest ledges whose gaps stay near the target
        g = (D - n * l) / (n + 1);
      }
      const dyH = cfg.rise / (n + 1);
      const sideStartY = y;
      const sideLen = D;
      for (let i = 0; i < n; i++) {
        E.x += d[0] * g; E.z += d[1] * g; y += dyH;
        const cx = E.x + d[0] * l / 2, cz = E.z + d[1] * l / 2;
        const p = w.plat({
          x: cx, y, z: cz, w: d[0] ? l : cfg.wid, d: d[1] ? l : cfg.wid, h: cfg.kind === 'beam' ? 0.6 : 0.8, path: true,
          moving: !!(cfg.crumble || cfg.mover), style: cfg.crumble ? 'floor' : 'floor',
        });
        if (cfg.crumble) w.crumble(p, { delay: 0.6, gone: 3.5 });
        if (cfg.mover) { const ph = i * 1.7 + k; w.mover(p, (t) => ({ x: o[0] ? 0 : Math.sin(t * 1.1 + ph) * 1.3, z: o[1] ? 0 : Math.sin(t * 1.1 + ph) * 1.3 })); }
        strut(cx, y, cz, k, cfg.wid);
        plats.push(p);
        if (cfg.kind === 'laser') {
          for (let q = 0; q < 3; q++) {
            const lz = (q + 1) / 4;
            const px = E.x + d[0] * l * lz, pz = E.z + d[1] * l * lz;
            pulseLaser(w, { x: px, y: y + 0.55, z: pz, width: cfg.wid, axis: d[0] ? 'z' : 'x', period: 3.2, on: 1.2, offset: q * 1.1 });
          }
        }
        E.x += d[0] * l; E.z += d[1] * l;
      }
      E.x += d[0] * g; E.z += d[1] * g; y += dyH;
      const cLabel = last ? undefined : `${Math.round(y)} m`;
      const cp = addCorner(tgt, cLabel);
      if (cfg.wind) {
        const cx = E.x - d[0] * (sideLen / 2), cz = E.z - d[1] * (sideLen / 2);
        w.wind({ x: cx, y: sideStartY + 4, z: cz, w: d[0] ? sideLen : 7, h: 12, d: d[1] ? sideLen : 7, dx: o[0], dz: o[1], strength: 16, period: 4.6, on: 2.1, phase: k * 1.3 });
      }
      if (cfg.cp) {
        w.checkpoint({ x: tgt.x, y, z: tgt.z, real: true, label: 'CHECKPOINT' });
        platsByCP[cfg.cp] = cp;
      }
      prev = tgt;
    }
    // summit goal
    w.goal({ x: -H, y, z: H, color: 0xffb070,
      onReach: () => { game.say('l3.complete', { priority: 2 }); game.completeLevel(); } });
    w.light(0xffb070, 14, 24, -H, y + 3, H);

    // ---- set dressing ----------------------------------------------------------------------
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, r = 36;
      spot(w, { x: Math.cos(a) * r, y: 1.2, z: Math.sin(a) * r, tx: 0, ty: 54, tz: 0, len: 70, r: 6.5, color: 0xffb070, opacity: 0.07 });
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 5, 8), plainMaterial(0x2a2b36, { metalness: 0.6, roughness: 0.4 }));
      post.position.set(Math.cos(a) * 28, 2.5, Math.sin(a) * 28); w.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10), glowMaterial(0xffa860, 2.4)); lamp.position.set(Math.cos(a) * 28, 5.2, Math.sin(a) * 28); w.add(lamp);
    }
    // distant skyline
    const skyMat = plainMaterial(0x181430, { roughness: 0.9 });
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, r = 140 + Math.random() * 120, h = 30 + Math.random() * 110, ww = 8 + Math.random() * 16;
      const b = new THREE.Mesh(new THREE.BoxGeometry(ww, h, ww), skyMat);
      b.position.set(Math.cos(a) * r, h / 2 - 70 + Math.random() * 10, Math.sin(a) * r);
      w.add(b);
      if (Math.random() < 0.8) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.2, 0.7, ww + 0.2), glowMaterial(Math.random() < 0.5 ? 0xffa860 : 0x7aa0ff, 1.5));
        strip.position.set(b.position.x, b.position.y + (Math.random() - 0.3) * h * 0.4, b.position.z); w.add(strip);
      }
    }

    // ---- narrator beats --------------------------------------------------------------------
    const st = { said: new Set(), lastLook: -99, t: 0, bigFall: 0 };
    const once = (id, cond, fn) => { if (!st.said.has(id) && cond) { st.said.add(id); fn(); } };
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      st.t += dt;
      const y0 = g.player.y;
      if (y0 > w.altimeter.record) w.altimeter.record = y0;
      once('intro', st.t > 1.2, () => g.say('l3.intro'));
      once('dl1', y0 > 6, () => g.say('l3.dontlook'));
      once('bee', y0 > 22 && g.player.grounded, () => { g.say('l3.bee', { priority: 2 }); g.ui.bug('🐝'); });
      once('nocp', y0 > 38, () => g.say('l3.nocp'));
      once('spider', y0 > 41 && g.player.grounded, () => { g.say('l3.spider', { priority: 2 }); g.ui.bug('🕷️', 5000); });
      once('near', y0 > 45, () => g.say('l3.near'));
      once('last', y0 > 47, () => g.say('l3.last'));
      if (g.pitch < -0.85 && y0 > 8 && st.t - st.lastLook > 45) { st.lastLook = st.t; g.say('l3.dontlook2', { priority: 2 }); }
    };
    w.hooks.onLand = ({ fall }) => {
      if (fall > 10) {
        if (fall > 30 && fall > st.bigFall) { st.bigFall = fall; game.say('l3.fall.big', { priority: 2 }); }
        else game.say('l3.fall', { priority: 1, vars: { m: Math.round(fall) } });
      }
    };
    w.hooks.onCheckpoint = (cp) => { game.say('l3.checkpoint', { priority: 1 }); void cp; };
    w.windLevel = 0.1;
    void platsByCP; void plats;
  },
};
