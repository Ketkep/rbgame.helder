import * as THREE from 'three';
import { cursor, onPlat, spot, orbs, pulseLaser } from './common.js';
import { glowMaterial, plainMaterial } from '../engine/materials.js';
import { CREDITS } from '../script.js';

// Level 5 — The Real Ending. Fake credits, a rising curtain, a recap gauntlet of every trick in the
// game, and a final choice: the host says LEFT. The real exit is RIGHT.

export default {
  id: 'l5',
  name: 'The Real Ending',
  music: 'l5',
  completeQuip: '',
  titleCam: { center: [0, 0, -16], radius: 22, height: 7 },

  build(w, game) {
    w.env({
      top: 0x07050d, horizon: 0x3a1236, bottom: 0x0a050c,
      fog: { color: 0x14081a, near: 50, far: 340 },
      sun: { color: 0xffe2b0, intensity: 2.4, dir: [0.2, 0.9, 0.5] },
      hemi: { sky: 0xa070c0, ground: 0x6a3040, intensity: 1.2 },
      exposure: 1.1,
      stars: 0.7,
      bloom: { strength: 0.8, radius: 0.65, threshold: 0.95 },
      clouds: { count: 22, color: 0x8a3a6a, y: [-45, -15], radius: [30, 260], opacity: 0.3, size: [60, 130] },
      motes: { color: 0xffd58a, count: 260, size: 0.1, opacity: 0.8 },
    });
    w.setTheme({ tex: 'stage', color: 0xffffff, trim: 0xffc83d, edge: 0xffc83d, edgeOpacity: 0.2, accent: 0xff4d5e, danger: 0xff2d4d, roughness: 0.35, metalness: 0.3 });
    w.spawn = { x: 0, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -40;

    // ---- the stage + the curtain -------------------------------------------------------------
    w.plat({ x: 0, y: 0, z: 0, w: 20, d: 17, h: 1.4, path: true });
    const curtain = w.plat({ x: 0, y: 14, z: -8.9, w: 22, d: 0.8, h: 16, tex: 'curtain', color: 0xffffff, trim: null, edge: null, moving: true });
    curtain.group.matrixAutoUpdate = true;
    // drapes at the sides (decor)
    for (const sx of [-12.5, 12.5]) for (let i = 0; i < 5; i++) w.box({ x: sx + (i % 2) * 0.4 * Math.sign(sx), y: 8, z: -2 + i * 2.4 - 6, w: 1.3, h: 17, d: 1.3, tex: 'curtain', color: 0xffffff, rough: 0.8, shadow: false });
    // marquee bulbs along the front edge
    const bulbs = [];
    for (let i = 0; i < 17; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd36a).multiplyScalar(2.2), toneMapped: false }));
      b.position.set(-8 + i, 0.25, 8.7); w.add(b); bulbs.push(b);
    }
    w.onUpdate((dt, t) => bulbs.forEach((b, i) => { b.scale.setScalar(0.6 + 0.6 * Math.max(0, Math.sin(t * 4 - i * 0.5))); }));
    w.sign({ text: 'THE REAL ENDING', x: 0, y: 11, z: 9.5, w: 16, h: 2.8, color: '#ffe6a8', glow: 1.3, glowColor: '#ffc83d', tw: 1024, rotY: Math.PI });
    w.sign({ text: 'THE REAL ENDING', x: 0, y: 16.5, z: -9.6, w: 20, h: 3.4, color: '#ffe6a8', glow: 1.3, glowColor: '#ffc83d', tw: 1024 });

    // ---- the gauntlet --------------------------------------------------------------------------
    const C = cursor(w, { y: 0, z: -9.3 });
    // G1 — the tutorial, but meaner
    let safe = null;
    [{ gap: 2.2, d: 5, wd: 5 }, { gap: 2.6, d: 5, wd: 5 }, { gap: 3.0, d: 4, wd: 5 }].forEach((s, i) => { const p = C.place(s); if (i === 2) { safe = p; w.crumble(p, { delay: 0.7, gone: 3 }); } });
    w.sign({ text: 'SAFE ✔', x: 0, y: 0.03, z: safe.body.z, w: 4, h: 1.4, rotX: -Math.PI / 2, color: '#44e08a', stroke: '#0c4a2a', double: false, tw: 512 });
    const cp1 = C.place({ gap: 2.4, d: 8, wd: 8 });
    w.checkpoint({ x: 0, y: 0, z: cp1.body.z, real: true });

    // G2 — crumble run into movers
    [0, 2.0, -1.0, -2.2, 0.4, 2.0].forEach((x, i) => {
      const p = C.place({ gap: i === 0 ? 2.2 : 2.5, d: 3, wd: 3, x }); w.crumble(p, { delay: 0.55, gone: 3.5 });
    });
    for (let i = 0; i < 3; i++) {
      const p = C.place({ gap: 2.7, d: 3.2, wd: 3.2, h: 0.6, moving: true });
      const ph = i * 2.1; w.mover(p, (t) => ({ x: Math.sin(t * 1.25 + ph) * 3.0 }));
    }
    const cp2 = C.place({ gap: 2.6, d: 8, wd: 8 });
    w.checkpoint({ x: 0, y: 0, z: cp2.body.z, real: true });

    // G3 — lasers, then lag
    const lz = C.place({ gap: 2.4, d: 28, wd: 6.4 });
    for (let i = 0; i < 3; i++) pulseLaser(w, { x: 0, y: C.y + 0.5, z: lz.body.z + 14 - 7 - i * 7.5, width: 6.4, period: 3.0, on: 1.15, offset: i * 1.0 });
    const lagStart = C.place({ gap: 0, d: 4, wd: 6 });
    const lagPlats = [];
    for (let i = 0; i < 3; i++) lagPlats.push(C.place({ gap: 2.6, d: 6.5, wd: 5, x: [1.2, -1.2, 0][i] }));
    const cp3 = C.place({ gap: 2.6, d: 8, wd: 8 });
    w.checkpoint({ x: 0, y: 0, z: cp3.body.z, real: true });

    // G4 — the climb, with gusts
    const stepsBase = C.y;
    let stepsFirst = null;
    for (let i = 0; i < 7; i++) { const p = C.place({ gap: 2.4, d: 2.4, wd: 2.4, dy: 1.1, x: (i % 2 ? 1.1 : -1.1) }); if (i === 0) stepsFirst = p; }
    w.wind({ x: 0, y: stepsBase + 6, z: stepsFirst.body.z - 8, w: 8, h: 14, d: 26, dx: 1, dz: 0, strength: 15, period: 3.8, on: 1.7 });
    const cp4 = C.place({ gap: 2.4, d: 7, wd: 7, dy: 0.5 });
    w.checkpoint({ x: 0, y: C.y, z: cp4.body.z, real: true });

    // G5 — two last leaps, then the podium
    C.place({ gap: 3.2, d: 2.2, wd: 2.4, dy: 0.3, x: 0 });
    C.place({ gap: 3.6, d: 2.2, wd: 2.4, dy: 0.3, x: 0 });
    const podium = C.place({ gap: 3.6, d: 12, wd: 22, dy: 0.3 });
    const py = C.y, pz = podium.body.z;
    const frame = (x, z) => {
      for (const sx of [-2.1, 2.1]) w.box({ x: x + sx, y: py + 3, z, w: 0.7, h: 6, d: 0.9, color: 0xf4f0e6, rough: 0.35, radius: 0.08 });
      w.box({ x, y: py + 6.2, z, w: 5, h: 0.7, d: 0.9, color: 0xf4f0e6, rough: 0.35, radius: 0.08 });
    };
    frame(-6, pz - 3.5); frame(6, pz - 3.5);
    w.sign({ text: 'EXIT', x: -6, y: py + 7.4, z: pz - 3.5, w: 4.4, h: 1.3, bg: '#12131c', color: '#ffc83d', border: '#ffc83d', size: 90, tw: 512 });
    w.sign({ text: 'EXIT', x: 6, y: py + 7.4, z: pz - 3.5, w: 4.4, h: 1.3, bg: '#12131c', color: '#ffc83d', border: '#ffc83d', size: 90, tw: 512 });
    const left = w.goal({ x: -6, y: py, z: pz - 3, color: 0x2dd4bf, onReach: () => { game.say('l5.win.wrong', { priority: 2 }); game.kill('trap'); } });
    w.goal({ x: 6, y: py, z: pz - 3, color: 0x2dd4bf, onReach: () => { game.say('l5.win.right', { priority: 2 }); game.completeLevel(); } });
    w.onRespawn(() => { left.trig.fired = false; });
    w.light(0x2dd4bf, 14, 26, 0, py + 4, pz);

    // ---- set dressing --------------------------------------------------------------------------
    const cols = [0xffd9a0, 0xffb3d9, 0xa8e8ff, 0xffd9a0];
    for (let i = 0; i < 14; i++) {
      const z = 6 - i * 20, side = i % 2 ? 1 : -1;
      spot(w, { x: side * 16, y: 24, z, tx: 0, ty: 0, tz: z - 6, color: cols[i % cols.length], r: 4.5, opacity: 0.09 });
    }
    orbs(w, { count: 50, x: [-24, 24], y: [0, 20], z: [10, -330], color: 0xffd58a, size: 0.14, intensity: 2.4 });

    // ---- the show ------------------------------------------------------------------------------
    const s = { stage: 'wait', t: 0, curtainT: -1, lag: false, lagT: 0, spiked: false, fadeWait: -1 };
    const beginCurtain = () => { s.curtainT = 0; game.audio.whoosh(); game.say('l5.curtain', { priority: 2 }); w.after(4, () => game.say('l5.gauntlet')); };
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing' || g.frozen) return;
      s.t += dt;
      if (s.stage === 'wait' && s.t > 1.4) {
        s.stage = 'credits'; g.say('l5.intro');
        g.ui.creditsStart(CREDITS, g.cs().completed ? 420 : 78);
      }
      if (s.stage === 'curtainWait') {
        s.fadeWait -= dt;
        if (s.fadeWait < 2.0 && s.fadeWait > 1.9) { /* hold black */ }
        if (s.fadeWait <= 0) { s.stage = 'show'; g.ui.fade(false, 900); beginCurtain(); }
      }
      if (s.curtainT >= 0) {
        s.curtainT += dt;
        const k = Math.min(1, s.curtainT / 3.2), e = k * k * (3 - 2 * k);
        curtain.setPos(0, 14 + e * 20, -8.9);
        if (k >= 1) { curtain.setEnabled(false); s.curtainT = -1; }
      }
      if (s.lag) {
        s.lagT += dt;
        const ph = s.lagT % 5;
        if (ph < 3.3) { g.ui.setPing(true, 22 + Math.random() * 36, false); s.spiked = false; }
        else if (ph < 4.3) g.ui.setPing(true, 80 + (ph - 3.3) * 900, true);
        else { g.ui.setPing(true, 999, true); if (!s.spiked) { s.spiked = true; g.rewind(0.9); } }
      }
    };
    w.hooks.onCreditsEnd = () => {
      const g = game;
      g.ui.creditsStop();
      s.stage = 'curtainWait';
      g.say('l5.credits.end', { priority: 2 });
      g.ui.fade(true, 700);
      s.fadeWait = 4.2;
      w.after(2.4, () => g.say('l5.credits.after', { priority: 2, hold: 1.2 }));
    };
    w.onRespawn(() => { s.lag = false; game.ui.setPing(false); });
    onPlat(w, cp1, () => game.say('l5.cp'));
    onPlat(w, lagStart, () => { s.lag = true; s.lagT = 0; s.spiked = false; game.say('l5.lag'); }, { once: false });
    w.trigger({ x: 0, y: 1.5, z: cp3.body.z, w: 8, h: 4, d: 6, once: false, onEnter: () => { s.lag = false; game.ui.setPing(false); } });
    onPlat(w, podium, () => game.say('l5.final', { priority: 2 }));
    // The curtain is already open (and credits already seen) if you respawn past them.
    w.hooks.onComplete = () => null;
    void lagPlats; void glowMaterial; void plainMaterial;
  },
};
