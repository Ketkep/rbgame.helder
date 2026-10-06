import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture } from '../../engine/materials.js';
import { hotelHalo, GOLD } from './kit.js';

// Hotel level 14 — "Hallway Loop" (Hard · Guest Rooms). One corridor. Walk it. If everything is normal, keep going to the end. If
// ANYTHING is different, turn around and walk back to the start. Get it right six times in a row and the way out appears.
// Get it wrong and the count goes back to zero. The host's opinion about whether it looks normal is for entertainment only.

const L = 28, Wd = 4.4, Ht = 3.5;       // corridor length, width, height (z from 0 (south) to -L (north))
const NEED = 6;
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];

function numberPlate(w, text, x, y, z, rotY, color = '#d8a94a') {
  return w.sign({ text, x, y, z, w: 0.55, h: 0.28, rotY, color, double: false, tw: 128, size: 56 });
}

export default {
  id: 'hotel-14',
  name: 'Hallway Loop',
  music: 'hotel',
  completeQuip: 'You found the exit. The hallway is still there, looping, for the next guest. It has a lot of patience. And a lot of paintings.',

  build(w, game) {
    w.env({
      top: 0x0a0a14, horizon: 0x1c1826, bottom: 0x08080c,
      fog: { color: 0x120e16, near: 18, far: 60 },
      sun: { color: 0xc0c8ff, intensity: 0.1, dir: [0.2, 0.9, 0.3], shadow: false },
      hemi: { sky: 0xffe2c0, ground: 0x7a6a70, intensity: 0.85 },
      exposure: 0.95, stars: 0,
      bloom: { strength: 0.35, radius: 0.6, threshold: 0.95 },
      motes: { color: 0xffe0b0, count: 40, size: 0.05, opacity: 0.3 },
      envMap: { top: 0xffe0c0, mid: 0x4a3a40, bottom: 0x100c10, intensity: 0.3, lights: [{ pos: [0, 4, 0], w: 8, h: 8, color: 0xffe2b0, intensity: 1.8 }] },
    });
    w.setTheme({ tex: 'carpet', color: 0xffffff, trim: null, edge: null, edgeOpacity: 0, roughness: 0.8, metalness: 0, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.killY = -30;
    w.spawn = { x: 0, y: 0, z: -3.0, yaw: 0 };
    w.respawn = { ...w.spawn };
    const X = Wd / 2;

    // ---- the shell ------------------------------------------------------------------------------------------------------------------------
    w.plat({ x: 0, y: 0, z: -L / 2, w: Wd, d: L + 6, h: 1.4, tex: 'carpet', color: 0x7a2a3a, roughness: 0.95 });
    w.plat({ x: 0, y: Ht + 1, z: -L / 2, w: Wd + 2, d: L + 8, h: 1, tex: 'coffer', color: 0xdcd0c0, roughness: 0.8 });
    for (const sx of [-1, 1]) w.plat({ x: sx * (X + 0.5), y: Ht + 1, z: -L / 2, w: 1, d: L + 8, h: Ht + 1.4, tex: 'damask', color: 0xffe8d8, roughness: 0.7 });
    // end walls with a doorway each (a short dark alcove behind it)
    const AW = 3.0;
    let northBack = null;
    for (const [z, sgn] of [[0.5, 1], [-L - 0.5, -1]]) {
      for (const sx of [-1, 1]) w.plat({ x: sx * (AW / 2 + (X - AW / 2) / 2 + 0.0), y: Ht + 1, z, w: X - AW / 2 + 0.5, d: 1, h: Ht + 1.4, tex: 'damask', color: 0xffe8d8, roughness: 0.7 });
      w.plat({ x: 0, y: Ht + 1, z, w: AW, d: 1, h: Ht + 1 - 2.7, tex: 'damask', color: 0xffe8d8, roughness: 0.7 });
      // alcove: a dark closet two metres deep
      w.plat({ x: 0, y: 0, z: z + sgn * 2.4, w: AW + 0.6, d: 3.6, h: 1.4, tex: 'carpet', color: 0x2a1018, roughness: 0.95 });
      for (const sx of [-1, 1]) w.plat({ x: sx * (AW / 2 + 0.5), y: Ht + 1, z: z + sgn * 2.4, w: 1, d: 3.6, h: Ht + 1.4, tex: 'damask', color: 0x201018, roughness: 0.8 });
      const back = w.plat({ x: 0, y: Ht + 1, z: z + sgn * 4.2, w: AW + 2, d: 1, h: Ht + 1.4, tex: 'damask', color: 0x201018, roughness: 0.8 });
      if (sgn < 0) northBack = back;
    }
    // ---- normal furniture of the corridor (and their variants) -----------------------------------------------------------------------
    const variants = [];       // { name, hint, set(on) }
    const reg = (name, hint, normal, alt) => variants.push({ name, hint, set: (on) => { for (const o of normal) o.visible = !on; for (const o of alt) o.visible = on; } });
    const mk = (o) => o;
    const hide = (o) => { o.visible = false; return o; };
    // doors on both walls
    const doorMat = plainMaterial(0x5a3a24, { roughness: 0.5 });
    const doorZ = [-4, -9, -14, -19, -24];
    doorZ.forEach((z, i) => {
      for (const sx of [-1, 1]) {
        const d = w.box({ x: sx * (X - 0.04), y: 1.1, z, w: 0.1, h: 2.2, d: 1.1, color: 0x5a3a24, rough: 0.5, shadow: false });
        void d; void doorMat;
        w.box({ x: sx * (X - 0.06), y: 1.1, z, w: 0.14, h: 2.3, d: 1.25, color: GOLD, metal: 1, rough: 0.4, shadow: false }).scale.set(1, 1, 1.0);
        numberPlate(w, `3${(i * 2 + (sx > 0 ? 2 : 1)).toString().padStart(2, '0')}`, sx * (X - 0.12), 1.95, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
    });
    // lamps
    const lampZ = [-2.5, -7, -11.5, -16, -20.5, -25];
    const lamps = lampZ.map((z) => {
      const grp = [];
      for (const sx of [-1, 1]) {
        grp.push(w.box({ x: sx * (X - 0.2), y: 2.5, z, w: 0.2, h: 0.5, d: 0.28, glow: 0xffe0b0, glowIntensity: 1.5, shadow: false }));
        const h = hotelHalo(w, sx * (X - 0.35), 2.55, z, 2.2, 0xffc070, 0.3); grp.push(h);
      }
      return grp;
    });
    for (const z of [-3, -10, -17, -24]) w.light(0xffe0b0, 6, 11, 0, 2.9, z);
    // paintings
    const paintCols = [0x2a3a5a, 0x5a3a2a, 0x2a5a3a];
    const paintings = [[-1, -6.5, 0], [1, -12.5, 1], [-1, -21.5, 2]].map(([sx, z, ci]) => {
      const g = new THREE.Group(); g.position.set(sx * (X - 0.08), 1.9, z); g.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.06), plainMaterial(GOLD, { metalness: 1, roughness: 0.4 })); g.add(fr);
      const cv = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.65, 0.04), plainMaterial(paintCols[ci], { roughness: 0.6 })); cv.position.z = 0.03; g.add(cv);
      w.add(g); return { g, cv };
    });
    // a fire extinguisher, an umbrella stand, a plant
    const ext = new THREE.Group(); ext.position.set(X - 0.25, 0.9, -15.4);
    { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 10), plainMaterial(0xc0202a, { roughness: 0.4 })); ext.add(b); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), plainMaterial(0x222222)); t.position.y = 0.3; ext.add(t); const box = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.4), plainMaterial(0xdddddd, { roughness: 0.5 })); box.position.set(0.14, 0, 0); ext.add(box); w.add(ext); }
    const plant = new THREE.Group(); plant.position.set(-X + 0.5, 0, -18.4);
    { const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.5, 12), plainMaterial(0x6a3a28, { roughness: 0.6 })); pot.position.y = 0.25; plant.add(pot); for (let k = 0; k < 7; k++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), plainMaterial(0x2a6a3a, { roughness: 0.7 })); lf.position.set(Math.cos(k) * 0.2, 0.8 + (k % 3) * 0.2, Math.sin(k) * 0.2); lf.scale.y = 1.4; plant.add(lf); } w.add(plant); }
    // the clock at the north arch
    const clockC = document.createElement('canvas'); clockC.width = 256; clockC.height = 128; const cg = clockC.getContext('2d');
    const clockTex = new THREE.CanvasTexture(clockC); clockTex.colorSpace = THREE.SRGBColorSpace; w.ownTextures.push(clockTex);
    const drawClock = (txt) => { cg.fillStyle = '#0c0810'; cg.fillRect(0, 0, 256, 128); cg.strokeStyle = '#d8a94a'; cg.lineWidth = 8; cg.strokeRect(4, 4, 248, 120); cg.fillStyle = '#ff6a5a'; cg.font = '84px "Archivo Black", Impact, sans-serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.fillText(txt, 128, 70); clockTex.needsUpdate = true; };
    drawClock('3:03');
    const clock = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: clockTex, toneMapped: false })); clock.position.set(0, 3.0, -L + 0.45); clock.rotation.y = 0; w.add(clock);
    // the lap counter above the south arch
    const cC = document.createElement('canvas'); cC.width = 512; cC.height = 160; const cc = cC.getContext('2d');
    const cTex = new THREE.CanvasTexture(cC); cTex.colorSpace = THREE.SRGBColorSpace; w.ownTextures.push(cTex);
    const drawCount = (n) => { cc.fillStyle = '#0c0810'; cc.fillRect(0, 0, 512, 160); cc.strokeStyle = '#d8a94a'; cc.lineWidth = 8; cc.strokeRect(4, 4, 504, 152); cc.fillStyle = '#d8a94a'; cc.font = '34px "Archivo Black", Impact, sans-serif'; cc.textAlign = 'center'; cc.fillText('HALLWAY · IN A ROW', 256, 50); cc.fillStyle = '#ffe0a0'; cc.font = '80px "Archivo Black", Impact, sans-serif'; cc.fillText(`${n} / ${NEED}`, 256, 128); cTex.needsUpdate = true; };
    drawCount(0);
    const counter = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.56), new THREE.MeshBasicMaterial({ map: cTex, toneMapped: false })); counter.position.set(0, 3.0, -0.45); counter.rotation.y = Math.PI; w.add(counter);
    const counter2 = counter.clone(); counter2.position.set(0, 3.0, -L + 0.5 + 0.0); counter2.rotation.y = 0; counter2.position.y = 2.45; w.add(counter2);
    // the arches' signs
    w.sign({ text: '↑ KEEP GOING', x: 0, y: 2.9, z: -L - 0.02, w: 2.6, h: 0.4, color: '#6cf0b2', double: false, tw: 512, size: 56, glow: true });
    w.sign({ text: '↓ TURN BACK', x: 0, y: 2.9, z: 0.02, w: 2.6, h: 0.4, rotY: Math.PI, color: '#ffb35a', double: false, tw: 512, size: 56, glow: true });
    // variant objects (hidden by default)
    const extraDoor = w.box({ x: -(X - 0.04), y: 1.1, z: -16.6, w: 0.1, h: 2.2, d: 1.1, color: 0x2a2a30, rough: 0.5, shadow: false }); extraDoor.visible = false;
    const badNumber = numberPlate(w, '3O3', -(X - 0.12), 1.95, -9, Math.PI / 2, '#ff5a5a'); badNumber.visible = false;
    const redLamps = [0, 1].map((i) => { const z = lampZ[3]; const m = w.box({ x: (i ? 1 : -1) * (X - 0.2), y: 2.5, z, w: 0.2, h: 0.5, d: 0.28, glow: 0xff2a2a, glowIntensity: 1.8, shadow: false }); m.visible = false; return m; });
    const figure = new THREE.Group(); figure.position.set(0.5, 0, -L + 2.4); figure.visible = false;
    { const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.2, 10), plainMaterial(0x08080a, { roughness: 0.9 })); bd.position.y = 1.1; figure.add(bd); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), plainMaterial(0x08080a)); hd.position.y = 1.95; figure.add(hd); w.add(figure); }
    const stain = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ color: 0x0a0408, transparent: true, opacity: 0.85 })); stain.rotation.x = Math.PI / 2; stain.position.set(0.4, Ht - 0.01, -8); stain.visible = false; w.add(stain);
    const blueStrip = new THREE.Mesh(new THREE.PlaneGeometry(Wd - 0.4, 1.0), plainMaterial(0x2a4aa0, { roughness: 0.9 })); blueStrip.rotation.x = -Math.PI / 2; blueStrip.position.set(0, 0.012, -13.2); blueStrip.visible = false; w.add(blueStrip);
    const ajar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 1.0), plainMaterial(0x5a3a24, { roughness: 0.5 })); ajar.position.set(X - 0.5, 1.1, -19.4); ajar.rotation.y = -0.9; ajar.visible = false; w.add(ajar);
    const ajarLight = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.2), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); ajarLight.position.set(X - 0.08, 1.1, -19); ajarLight.rotation.y = -Math.PI / 2; ajarLight.visible = false; w.add(ajarLight);
    const eyesCv = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.65, 0.04), glowMaterial(0xffe0a0, 1.2)); eyesCv.visible = false;
    paintings[1].g.add(eyesCv); eyesCv.position.z = 0.05;
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), plainMaterial(0x080808)); eyeL.position.set(-0.2, 0.05, 0.08); const eyeR = eyeL.clone(); eyeR.position.x = 0.2; eyesCv.add(eyeL, eyeR);

    // each anomaly flips some objects on and some off
    reg('a crooked painting', 'Look at the paintings.', [], []);
    const A = [];
    A.push({ name: 'crooked painting', hint: 'Look at the paintings.', on: () => { paintings[0].g.rotation.z = 0.24; }, off: () => { paintings[0].g.rotation.z = 0; } });
    A.push({ name: 'wrong door number', hint: 'Look at the door numbers.', on: () => { badNumber.visible = true; }, off: () => { badNumber.visible = false; } });
    A.push({ name: 'extra door', hint: 'Count the doors.', on: () => { extraDoor.visible = true; }, off: () => { extraDoor.visible = false; } });
    A.push({ name: 'red lamps', hint: 'Look at the lamps.', on: () => { redLamps.forEach((m) => { m.visible = true; }); lamps[3].forEach((m) => { m.visible = false; }); }, off: () => { redLamps.forEach((m) => { m.visible = false; }); lamps[3].forEach((m) => { m.visible = true; }); } });
    A.push({ name: 'missing lamp', hint: 'Look at the lamps.', on: () => { lamps[1].forEach((m) => { m.visible = false; }); }, off: () => { lamps[1].forEach((m) => { m.visible = true; }); } });
    A.push({ name: 'a figure', hint: 'Look at the far end.', on: () => { figure.visible = true; }, off: () => { figure.visible = false; } });
    A.push({ name: 'ceiling stain', hint: 'Look up.', on: () => { stain.visible = true; }, off: () => { stain.visible = false; } });
    A.push({ name: 'blue carpet strip', hint: 'Look at the floor.', on: () => { blueStrip.visible = true; }, off: () => { blueStrip.visible = false; } });
    A.push({ name: 'door ajar', hint: 'Look at the doors.', on: () => { ajar.visible = true; ajarLight.visible = true; }, off: () => { ajar.visible = false; ajarLight.visible = false; } });
    A.push({ name: 'missing extinguisher', hint: 'Look at the right-hand wall.', on: () => { ext.visible = false; }, off: () => { ext.visible = true; } });
    A.push({ name: 'wrong time', hint: 'Look at the clock at the end.', on: () => { drawClock(pick(['3:33', '12:00', '4:04', '3:30'])); }, off: () => { drawClock('3:03'); } });
    A.push({ name: 'the painting is looking', hint: 'Look at the paintings.', on: () => { eyesCv.visible = true; }, off: () => { eyesCv.visible = false; } });
    A.push({ name: 'missing plant', hint: 'Look at the left wall.', on: () => { plant.visible = false; }, off: () => { plant.visible = true; } });
    variants.length = 0;

    // ---- the loop ----------------------------------------------------------------------------------------------------------------------------
    let streak = 0, current = null, lap = 0, resetting = false, done = false;
    let lapSaid = false;
    const nextLap = (g, first = false) => {
      for (const a of A) a.off();
      current = null; lap++;
      if (!first && Math.random() < 0.6) { current = pick(A); current.on(); }
      lapSaid = false;
    };
    const reset = (g) => {
      resetting = true;
      g.ui.fade(true, 120);
      setTimeout(() => { if (g.world !== w) return; g.player.teleport(0, 0.001, -3.0); g.yaw = 0; g.pitch = 0; g.ui.fade(false, 350); resetting = false; }, 160);
      // in headless/manual mode the timeout may not matter: also move immediately
      g.player.teleport(0, 0.001, -3.0); g.yaw = 0; g.pitch = 0;
    };
    const decide = (g, forward) => {
      if (done || g.state !== 'playing') return;
      const anomalous = !!current;
      const right = forward ? !anomalous : anomalous;
      if (right) {
        streak++; drawCount(streak); g.audio.ding();
        g.ui.toast(`✔ Correct · ${streak} / ${NEED}`, 'gold');
        g.say(streak >= NEED ? 'hotel.l14.last' : streak === 1 ? 'hotel.l14.first' : 'hotel.l14.right', { priority: 2 });
      } else {
        const was = streak; streak = 0; drawCount(0); g.audio.buzzer();
        g.ui.toast(anomalous ? `✘ There was: ${current.name}` : '✘ There was nothing', '');
        g.say(anomalous ? 'hotel.l14.missed' : 'hotel.l14.paranoid', { priority: 2, vars: { n: was } });
      }
      if (streak >= NEED) {
        done = true; openExit(g); return;
      }
      nextLap(g);
      reset(g);
    };
    nextLap(null, true);
    // the arches decide
    w.trigger({ x: 0, y: 1.2, z: -L - 1.6, w: 3, h: 3, d: 1.6, once: false, onEnter: () => { if (!done) decide(game, true); } });
    w.trigger({ x: 0, y: 1.2, z: 1.6, w: 3, h: 3, d: 1.6, once: false, onEnter: () => decide(game, false) });
    // the real exit: after enough right answers the north arch becomes a stairwell
    function openExit(g) {
      g.say('hotel.l14.open', { priority: 2 });
      northBack.setEnabled(false);
      w.plat({ x: 0, y: 0, z: -L - 6.5, w: AW + 3, d: 6, h: 1.4, tex: 'stone', color: 0xd8d0c0, roughness: 0.6 });
      w.box({ x: 0, y: 1.6, z: -L - 2.4, w: AW, h: 3.2, d: 0.3, glow: 0x6cf0b2, glowIntensity: 0.9, shadow: false });
      w.sign({ text: 'STAIRS · EXIT', x: 0, y: 3.4, z: -L - 3.0, w: 3.6, h: 0.7, color: '#6cf0b2', double: false, tw: 512, size: 70, glow: true });
      w.goal({ x: 0, y: 0, z: -L - 7, color: GOLD, onReach: () => { g.say('hotel.l14.done', { priority: 2 }); g.completeLevel(); } });
      g.audio.door();
    }

    // ---- the host (for entertainment only) -----------------------------------------------------------------------------------------
    let t0 = 0, intro = false;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing' || done) return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l14.intro'); g.say('hotel.l14.intro2', { vars: { need: NEED } }); }
      // a confident opinion about each lap (right 40% of the time)
      if (!lapSaid && g.player.z < -9 && !resetting && intro) {
        lapSaid = true;
        const truth = !!current;
        const says = Math.random() < 0.4 ? truth : !truth;   // "there is something" vs "it is all normal"
        g.say(says ? 'hotel.l14.host.diff' : 'hotel.l14.host.same', { priority: 0 });
      }
    };
    w.hooks.onDeath = () => false;
    // ---- hints: honest, for once ------------------------------------------------------------------------------------------------------
    let hintLap = -1, hintStage = 0;
    w.hintAction = (g) => {
      if (hintLap !== lap) { hintLap = lap; hintStage = 0; }
      hintStage++;
      if (!current) g.say('hotel.l14.hint.none', { priority: 1 });
      else if (hintStage === 1) g.say('hotel.l14.hint.some', { priority: 1 });
      else g.say('hotel.l14.hint.where', { priority: 1, vars: { where: current.hint } });
      return true;
    };
    w.hallway = { A, get streak() { return streak; }, get current() { return current; }, get lap() { return lap; }, get done() { return done; }, decide: (f) => decide(game, f), NEED };
    w.botPlan = (g) => {
      const p = g.player;
      if (done) return { x: 0, z: -L - 7 };
      // the bot knows the answer: walk forward if normal, walk back if there is something
      return current ? { x: 0, z: 3 } : { x: 0, z: -L - 3 };
    };
    void softTexture; void mk; void hide; void reg; void variants;
  },
};
