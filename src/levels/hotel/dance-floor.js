import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, hotelHalo, GOLD } from './kit.js';
import { onPlat } from '../common.js';
import { fakeComplete, fakeExit, twist, vanishAfter, stageTitle, stageHint } from './trolls.js';

// Hotel level 10 — "Dance Floor" (Medium · Ballroom). The disco. The DJ is the host. The floor is the song.
// Five sets, a booth (checkpoint) after each, and then an encore the host swears does not exist:
//   1 Warm-Up           tiles blink on the beat; the DJ calls FREEZE (real: every light goes red, any step kills)
//   2 Second Set        faster tiles, smaller; a BLUFF FREEZE (the strobes keep going, the tiles keep blinking: do not stand still) and a
//                       gold pad where the DJ drops the beat (the rhythm after it is half a beat late)
//   3 Conga Line        a snake of platforms sliding side to side; mirror mode (mouse X) under the strobes
//   4 Spotlight         a big floor, three SPOTLIGHT calls: get into the circle before it counts down (red floor = not in the circle)
//   5 Mirror Ball       a bridge of tiles that give way once you are half over (they shimmer: keep running) to the DJ booth,
//                       a VIP LOUNGE that is a hole, LEVEL COMPLETE… and the encore: fast tiles, one more FREEZE
// Baby Mode: tiles stay lit longer, the bluff holds the tiles (so it is only a joke), the beat is never dropped, spotlight is longer,
// the decoy is labelled, mirror mode is short.

const NAMES = ['Warm-Up', 'Second Set', 'Conga Line', 'Spotlight', 'Mirror Ball Bridge'];
const BPM = 128, BEAT = 60 / BPM;
const NEON = [0xff3fa4, 0x3fd0ff, 0xffd23f, 0x7dff6a, 0xb06cff];
const XS = [0, 1.8, -0.8, 1.6, -1.2, 0.8, -1.6, 1.4, -0.4, 1.2, -1.0, 0.6];
const WARN = 1.6, FREEZE_LEN = 1.9;
const mod = (a, b) => ((a % b) + b) % b;

export default {
  id: 'hotel-10',
  name: 'Dance Floor',
  music: 'hotel_dance',
  completeQuip: 'You danced. Technically. A judge would call it "falling with rhythm".',

  build(w, game) {
    w.env({
      top: 0x07041a, horizon: 0x2a1450, bottom: 0x06040c,
      fog: { color: 0x120a28, near: 40, far: 170 },
      sun: { color: 0x9db4ff, intensity: 0.2, dir: [0.2, 0.9, 0.3], shadow: false },
      hemi: { sky: 0x9a8cff, ground: 0x3a2050, intensity: 0.6 },
      exposure: 0.95, stars: 0.4,
      bloom: { strength: 0.7, radius: 0.8, threshold: 0.8 },
      motes: { color: 0xffa0ff, count: 220, size: 0.1, opacity: 0.6 },
      envMap: { top: 0xb0a0ff, mid: 0x4a2a6a, bottom: 0x120a1a, intensity: 0.5, lights: [{ pos: [0, 10, 0], w: 14, h: 14, color: 0xff80ff, intensity: 2.0 }, { pos: [-14, 3, 0], w: 6, h: 8, color: 0x60d0ff, intensity: 1.8 }] },
    });
    w.setTheme({ tex: 'grid', color: 0xffffff, trim: null, edge: null, edgeOpacity: 0, roughness: 0.3, metalness: 0.2, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.spawn = { x: 0, y: 0, z: 9, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -8;
    const baby = () => game.baby;

    const stages = NAMES.map(() => ({ at: null, route: [] }));
    const cps = new Map();
    const path = (p) => { p.o.path = true; return p; };
    const tiles = [], booths = [];
    const sets = [
      { P: 2.8, ON: 1.8, STEP: 0.8, size: 2.7, shift: 0 },
      { P: 2.5, ON: 1.55, STEP: 0.7, size: 2.4, shift: 0 },
    ];
    let z = 9, tileN = 0;
    path(w.plat({ x: 0, y: 0, z: 9, w: 12, d: 10, h: 1.4, tex: 'stage', color: 0x4a2a7a, roughness: 0.3, radius: 0.05, trim: 0xff3fa4 }));
    stages[0].at = { x: 0, y: 0, z: 9 };
    z = 5.35 + 5.0;   // (the first tile is placed 5.0 beyond z, as ever)

    const addTile = (si, x, n = tileN) => {
      const set = sets[si], size = set.size;
      z -= 5.0;
      const col = NEON[tileN % NEON.length];
      const pl = path(w.plat({ x, y: 0, z, w: size, d: size, h: 0.5, tex: 'grid', color: col, roughness: 0.25, radius: 0.08 }));
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(size - 0.2, size - 0.2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0.26, 0); pl.group.add(glow);
      const ghost = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      ghost.rotation.x = -Math.PI / 2; ghost.position.set(x, 0.02, z); w.add(ghost);
      pl.o.moving = true; pl.group.matrixAutoUpdate = true;
      const tl = { pl, glow, ghost, col, phase: -n * set.STEP, idx: tileN++, si, x, z, state: 'on', active: true, after: false };
      tiles.push(tl); stages[si].route.push({ x, y: 0, z });
      return tl;
    };
    const addBooth = (si, { cpDx = 0 } = {}) => {
      z -= 5.95;
      const b = path(w.plat({ x: 0, y: 0, z, w: 9, d: 5.2, h: 1.4, tex: 'stage', color: 0x3a2a6a, roughness: 0.25, radius: 0.05, trim: 0xffd23f }));
      booths.push({ pl: b, z, sct: si });
      const c = w.checkpoint({ x: cpDx, y: 0, z, real: true }); cps.set(c, si);
      w.trigger({ x: 0, y: 1.6, z, w: 9, h: 3.4, d: 2.4, once: false, onEnter: () => { if (c.used) return; c.used = true; w.burst(new THREE.Vector3(cpDx, 0.4, z), 0xffc83d, 24); game.onCheckpoint(c); } });
      if (stages[si + 1]) stages[si + 1].at = { x: cpDx, y: 0, z };
      z -= 0.95;
      return b;
    };
    const zone = (zc, fn, o = {}) => w.trigger({ x: 0, y: 1.6, z: zc, w: 34, h: 4, d: 1.4, once: true, resetOnRespawn: true, onEnter: fn, ...o });

    // ---- set 1 · warm-up -----------------------------------------------------------------------------------------------
    for (let k = 0; k < 7; k++) addTile(0, XS[k]);
    const freezeZ1 = tiles[3].z - 1;
    addBooth(0);
    // ---- set 2 · second set ------------------------------------------------------------------------------------------
    const s2tiles = [];
    let pad = null, padZ = null;
    for (let k = 0; k < 9; k++) {
      if (k === 4) {
        // the gold pad: always lit. The DJ drops the beat when you step on it
        z -= 5.0;
        pad = path(w.plat({ x: 0.4, y: 0, z, w: 3.0, d: 3.0, h: 0.5, tex: 'grid', color: GOLD, roughness: 0.2, metalness: 0.6, radius: 0.08, trim: GOLD }));
        pad.o.pad = true; stages[1].route.push({ x: 0.4, y: 0, z });
        w.sign({ text: '◆', x: 0.4, y: 0.27, z, w: 1.6, h: 1.6, rotX: -Math.PI / 2, color: '#ffd23f', double: false, tw: 256, size: 180 });
        padZ = z;
        continue;
      }
      const t = addTile(1, XS[(k + 3) % XS.length], tileN); s2tiles.push(t);
      if (padZ !== null) t.after = true;
    }
    const bluffZ = s2tiles[6].z - 1;
    addBooth(1);
    // ---- set 3 · conga line --------------------------------------------------------------------------------------------
    const conga = [];
    for (let k = 0; k < 8; k++) {
      z -= 4.6;
      const col = NEON[(k + 2) % NEON.length];
      const p = path(w.plat({ x: 0, y: 0, z, w: 2.8, d: 2.6, h: 0.5, tex: 'grid', color: col, roughness: 0.25, radius: 0.08, trim: col }));
      w.mover(p, (t) => ({ x: 3.4 * Math.sin(t * 1.5 - k * 0.8) }));
      conga.push(p); stages[2].route.push({ x: 0, y: 0, z });
    }
    const mirrorZ = conga[3].body.z - 1;
    addBooth(2);
    // ---- set 4 · spotlight ---------------------------------------------------------------------------------------------
    const floors = [];
    const FZ0 = z - 3.25;
    for (let k = 0; k < 3; k++) {
      const p = path(w.plat({ x: 0, y: 0, z: FZ0 - 4.5 - k * 9, w: 16, d: 9, h: 1.4, tex: 'stage', color: 0x2e2060, roughness: 0.3, radius: 0.05, trim: k % 2 ? 0x3fd0ff : 0xff3fa4 }));
      floors.push(p); stages[3].route.push({ x: 0, y: 0, z: FZ0 - 4.5 - k * 9 });
    }
    const FZ1 = FZ0 - 27;
    z = FZ1 + 1.75;                       // (the booth below starts 5.95 beyond z)
    addBooth(3);
    // ---- set 5 · mirror ball bridge -------------------------------------------------------------------------------------
    const longs = [];
    for (let k = 0; k < 4; k++) {
      z -= k === 0 ? 5.55 : 6.3;
      const p = path(w.plat({ x: (k % 2 ? 0.4 : -0.4), y: 0, z, w: 2.4, d: 4.6, h: 0.4, tex: 'grid', color: NEON[(k + 1) % NEON.length], roughness: 0.2, radius: 0.08, trim: NEON[(k + 1) % NEON.length] }));
      vanishAfter(w, game, p, { axis: 'z', dir: -1, frac: 0.5, delay: 0.7, back: 3.4, say: k === 0 ? 'hotel.l10.bridge' : null });
      longs.push(p); stages[4].route.push({ x: p.body.x, y: 0, z });
    }
    // the DJ booth
    const djZ = longs[3].body.z - 8.0;
    const dj = path(w.plat({ x: 0, y: 0, z: djZ, w: 14, d: 8, h: 1.4, tex: 'stage', color: 0x2a1a5a, roughness: 0.25, radius: 0.05, trim: 0xff3fa4 }));
    const djCp = w.checkpoint({ x: 3.2, y: 0, z: djZ + 2.6, real: true }); cps.set(djCp, 4);
    w.trigger({ x: 0, y: 1.6, z: djZ + 2.6, w: 14, h: 3.4, d: 2.4, once: false, onEnter: () => { if (djCp.used) return; djCp.used = true; game.onCheckpoint(djCp); } });
    stages[5] = { at: { x: 3.2, y: 0, z: djZ + 2.6 }, route: [] };
    w.box({ x: 0, y: 1.3, z: djZ - 2.2, w: 6, h: 1.2, d: 1.4, color: 0x14101e, metal: 0.4, rough: 0.4 });
    w.box({ x: -1.4, y: 1.95, z: djZ - 2.2, w: 1.4, h: 0.1, d: 1.0, glow: 0x3fd0ff, glowIntensity: 1.6, shadow: false });
    w.box({ x: 1.4, y: 1.95, z: djZ - 2.2, w: 1.4, h: 0.1, d: 1.0, glow: 0xff3fa4, glowIntensity: 1.6, shadow: false });
    w.sign({ text: 'DJ HOST', x: 0, y: 5.4, z: djZ - 3.8, w: 6, h: 1.4, color: '#ffd23f', double: true, tw: 1024, size: 130, glow: true });
    // the VIP LOUNGE: a landing off the booth's west side, with a ring in front of a hole
    const vip = w.plat({ x: -10.4, y: 0, z: djZ + 0.4, w: 3.2, d: 3.4, h: 1.4, tex: 'stage', color: 0x3a2a6a, roughness: 0.3, radius: 0.05, trim: 0xffd23f });
    fakeExit(w, game, { x: -10.4, y: 0, z: djZ + 0.4, kind: 'goal', label: 'VIP LOUNGE', say: 'hotel.l10.vipdeath', reason: 'vip' });
    w.trigger({ x: -4, y: 2, z: djZ + 2, w: 8, h: 4, d: 6, once: true, onEnter: () => game.say('hotel.l10.vip', { priority: 1 }) });
    void vip;
    // the hatch (not the real one)
    const fakeGoal = w.goal({ x: 0, y: 0, z: djZ - 0.2, color: GOLD, onReach: () => { if (!fakeComplete(game, w, { title: 'LEVEL COMPLETE', jk: '…ENCORE!', say: 'hotel.l10.fakewin', sayAfter: null, then: enableEncore })) { game.say('hotel.l10.done', { priority: 2 }); game.completeLevel(); } } });
    // the encore: only there once the DJ has been rude
    const enc = [];
    let zz = djZ - 1.85;
    for (let k = 0; k < 6; k++) {
      zz -= 5.0;
      const col = NEON[(k + 3) % NEON.length], size = 2.3, x = XS[(k + 5) % XS.length];
      const pl = path(w.plat({ x, y: 0, z: zz, w: size, d: size, h: 0.5, tex: 'grid', color: col, roughness: 0.25, radius: 0.08 }));
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(size - 0.2, size - 0.2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0.26, 0); pl.group.add(glow);
      const ghost = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      ghost.rotation.x = -Math.PI / 2; ghost.position.set(x, 0.02, zz); w.add(ghost);
      pl.o.moving = true; pl.group.matrixAutoUpdate = true;
      const tl = { pl, glow, ghost, col, phase: -k * 0.65, idx: tileN++, si: 2, x, z: zz, state: 'on', active: false, enc: true };
      tiles.push(tl); enc.push(tl); stages[5].route.push({ x, y: 0, z: zz });
      pl.body.enabled = false; pl.group.visible = false; ghost.visible = false;
    }
    sets.push({ P: 2.2, ON: 1.4, STEP: 0.65, size: 2.3, shift: 0 });
    zz -= 6.0;
    const finalPl = path(w.plat({ x: 0, y: 0, z: zz, w: 8, d: 6, h: 1.4, tex: 'stage', color: 0x4a2a7a, roughness: 0.3, radius: 0.05, trim: 0xffd23f }));
    finalPl.setEnabled(false);
    const finalGoal = w.goal({ x: 0, y: 0, z: zz, color: GOLD, onReach: () => { game.say('hotel.l10.done', { priority: 2 }); game.completeLevel(); } });
    finalGoal.group.visible = false; finalGoal.trig.enabled = false;
    const encFreezeZ = enc[3].z - 1;
    w.goalObj = fakeGoal;
    let encoreOn = false;
    const enableEncore = () => {
      encoreOn = true;
      for (const t of enc) { t.active = true; t.ghost.visible = true; w.burst(new THREE.Vector3(t.x, 0.5, t.z), t.col, 10, 3); }
      finalPl.setEnabled(true); finalGoal.group.visible = true; finalGoal.trig.enabled = true; w.goalObj = finalGoal;
      fakeGoal.group.visible = false; fakeGoal.trig.enabled = false;
      game.say('hotel.l10.encore', { priority: 2 });
    };
    const zEnd = zz - 8;

    // ---- the room, the disco ------------------------------------------------------------------------------------------
    roomShell(w, { x0: -17, x1: 17, z0: zEnd, z1: 17, yb: -10, H: 16, wallTex: 'curtain', wallColor: 0x8a5ac8, pilasterEvery: 14, lamps: false });
    w.plat({ x: 0, y: -9.5, z: (zEnd + 17) / 2, w: 34, d: 17 - zEnd, h: 1, tex: 'grid', color: 0x2a1a44, roughness: 0.6 });
    w.sign({ text: 'DANCE FLOOR · NO STANDING', x: 0, y: 6.0, z: 16.4, w: 9, h: 1.0, color: '#ff3fa4', double: false, tw: 1024, size: 66, rotY: Math.PI, glow: true });
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 2), new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 1, roughness: 0.05, flatShading: true, emissive: 0x222244 }));
    ball.position.set(0, 12.5, longs[1].body.z); w.add(ball);
    const beams = [];
    const nb = Math.min(14, Math.round((17 - zEnd) / 22));
    for (let k = 0; k < nb; k++) {
      const col = NEON[k % NEON.length];
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.8, 18, 16, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const pivot = new THREE.Group(); pivot.position.set((k % 2 ? 1 : -1) * 15, 15.5, 6 - k * 22); cone.position.y = -9; pivot.add(cone); w.add(pivot);
      beams.push({ pivot, cone, ph: k * 1.3 });
    }
    for (let zq = 6; zq > zEnd + 10; zq -= 45) for (const sx of [-1, 1]) {
      w.box({ x: sx * 15.6, y: 2.2, z: zq, w: 1.6, h: 4.4, d: 2.4, color: 0x14101e, metal: 0.3, rough: 0.6, shadow: false });
      for (const yy of [1.2, 3.2]) { const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.12, 20), plainMaterial(0x222233, { roughness: 0.4 })); cone.rotation.z = Math.PI / 2; cone.position.set(sx * 14.7, yy, zq); w.add(cone); }
    }
    const lc = [0xff60c0, 0x60c0ff, 0xffd060];
    for (let k = 0, zl = -6; zl > zEnd + 10; zl -= 60, k++) w.light(lc[k % 3], 20, 44, k % 2 ? 8 : -8, 8, zl);
    w.light(0xff60c0, 20, 40, 0, 8, 12);
    const neonMats = NEON.map((c) => glowMaterial(c, 1.3));
    for (let zq = 14; zq > zEnd + 4; zq -= 6) for (const sx of [-1, 1]) { const strip = w.box({ x: sx * 16.7, y: 8, z: zq, w: 0.12, h: 6, d: 0.12, color: 0xffffff, shadow: false }); strip.material = neonMats[Math.abs(Math.round(zq / 6)) % NEON.length]; }

    // ---- the DJ: FREEZE (real and bluff), the beat, the spotlight -------------------------------------------------------
    const D = { phase: 'play', kind: 'real', t0: 0, held: new Map(), strobeUntil: 0 };
    const callFreeze = (kind) => {
      if (D.phase !== 'play') return;
      D.phase = 'warn'; D.kind = kind; D.t0 = w.t;
      game.ui.stamp('FREEZE!'); game.say(kind === 'bluff' ? 'hotel.l10.bluffwarn' : 'hotel.l10.warn', { priority: 2 });
    };
    // spotlight: a circle you must be in when the countdown ends
    const SP = { phase: 'off', t0: 0, x: 0, z: 0, R: 2.5, n: 0 };
    const floorCols = [-3.0, 3.0, 0.5];
    const discGeo = new THREE.CircleGeometry(1, 40);
    const spotDisc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
    spotDisc.rotation.x = -Math.PI / 2; spotDisc.position.y = 0.72; spotDisc.scale.setScalar(SP.R); spotDisc.visible = false; w.add(spotDisc);
    const spotRing = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 }));
    spotRing.rotation.x = -Math.PI / 2; spotRing.position.y = 0.73; spotRing.scale.setScalar(SP.R); spotRing.visible = false; w.add(spotRing);
    const redFloors = floors.map((f) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.72, f.body.z); w.add(m); return m; });
    const SP_WARN = () => (baby() ? 2.2 : 1.6), SP_ON = () => (baby() ? 3.4 : 2.6);
    const callSpot = (n) => {
      if (SP.phase !== 'off') return;
      const p = game.player;
      SP.n = n; SP.phase = 'warn'; SP.t0 = w.t;
      SP.x = Math.max(-5.5, Math.min(5.5, p.x + floorCols[n % 3] * (n % 2 ? -1 : 1))); SP.z = p.z - 4.2;
      spotDisc.position.set(SP.x, 0.72, SP.z); spotRing.position.set(SP.x, 0.73, SP.z); spotDisc.visible = true; spotRing.visible = true;
      game.ui.stamp('SPOTLIGHT!'); game.say(n === 0 ? 'hotel.l10.spot1' : 'hotel.l10.spot2', { priority: 2 });
    };
    zone(freezeZ1, () => callFreeze('real'));
    zone(bluffZ, () => callFreeze('bluff'));
    zone(encFreezeZ, () => { if (encoreOn) callFreeze('real'); }, { once: false, resetOnRespawn: false });
    floors.forEach((f, k) => zone(f.body.z + 2.0, () => callSpot(k)));
    // the mirror mode under the strobes (conga line)
    w.trigger({ x: 0, y: 1.6, z: mirrorZ, w: 34, h: 4, d: 1.4, once: true, resetOnRespawn: true, onEnter: () => { D.strobeUntil = w.t + 6; twist(game, w, 'mouseX', { sec: 6, say: 'hotel.l10.mirror' }); } });
    // the beat drops on the gold pad (the rhythm after it is half a beat late)
    const dropBeat = () => {
      if (baby() || sets[1].shift) return;
      game.ui.stamp('THE BEAT DROPS'); game.say('hotel.l10.skip', { priority: 2 });
      w.after(1.0, () => { sets[1].shift = sets[1].P / 2; });
    };
    onPlat(w, pad, dropBeat, { once: false });
    w.onRespawn(() => { sets[1].shift = 0; D.phase = 'play'; SP.phase = 'off'; spotDisc.visible = false; spotRing.visible = false; for (const m of redFloors) m.material.opacity = 0; D.strobeUntil = 0; });

    // ---- tile logic ------------------------------------------------------------------------------------------------------
    const setOf = (tl) => sets[tl.enc ? 2 : tl.si];
    const ONs = (tl) => setOf(tl).ON + (baby() ? 0.5 : 0);
    const ph = (tl) => tl.phase + (tl.after ? setOf(tl).shift : 0);
    const isOn = (tl, t) => mod(t + ph(tl), setOf(tl).P) < ONs(tl);
    const warnOff = (tl, t) => { const u = mod(t + ph(tl), setOf(tl).P); return u > ONs(tl) - 0.45 && u < ONs(tl); };
    const warnOn = (tl, t) => mod(t + ph(tl), setOf(tl).P) > setOf(tl).P - 0.4;
    let lastBeat = -1, frozenReal = false;
    w.onUpdate((dt, t) => {
      const beat = Math.floor(t / BEAT), pulse = 0.5 + 0.5 * Math.cos(((t / BEAT) % 1) * Math.PI * 2);
      if (beat !== lastBeat) { lastBeat = beat; if (game.state === 'playing') { if (beat % 2 === 0) game.audio.kick(); else game.audio.hat(); } }
      // the DJ's state machine
      if (D.phase === 'warn' && t - D.t0 >= WARN) { D.phase = 'freeze'; D.t0 = t; if (D.kind === 'real' || baby()) for (const tl of tiles) D.held.set(tl, tl.state === 'on' || tl.state === 'warnoff'); if (D.kind === 'real') game.say('hotel.l10.freeze', { priority: 1 }); }
      if (D.phase === 'freeze' && t - D.t0 >= (baby() ? FREEZE_LEN - 0.4 : FREEZE_LEN)) { const wasBluff = D.kind === 'bluff'; D.phase = 'play'; if (wasBluff) game.say('hotel.l10.bluffend', { priority: 1 }); }
      frozenReal = D.phase === 'freeze' && D.kind === 'real';
      const holding = D.phase === 'freeze' && (D.kind === 'real' || baby());
      const strobe = t < D.strobeUntil;
      ball.rotation.y += dt * 0.7;
      for (const b of beams) { b.pivot.rotation.z = frozenReal ? b.pivot.rotation.z : Math.sin(t * 0.9 + b.ph) * 0.6; b.pivot.rotation.x = frozenReal ? b.pivot.rotation.x : Math.cos(t * 0.7 + b.ph) * 0.4; b.cone.material.opacity = frozenReal ? 0.03 : strobe ? 0.1 + 0.1 * (Math.sin(t * 9 + b.ph) > 0 ? 1 : 0) : 0.1; }
      for (const tl of tiles) {
        if (!tl.active && tl.enc) { tl.pl.body.enabled = false; continue; }
        let on, st;
        if (holding) { on = D.held.get(tl) ?? true; st = on ? 'on' : 'off'; }
        else { on = isOn(tl, t); st = on ? (warnOff(tl, t) ? 'warnoff' : 'on') : (warnOn(tl, t) ? 'warnon' : 'off'); }
        tl.state = st;
        if (tl.pl.body.enabled !== on) { tl.pl.body.enabled = on; tl.pl.group.visible = on; }
        if (on) tl.glow.material.opacity = st === 'warnoff' ? (Math.floor(t * 12) % 2 ? 0.8 : 0.0) : 0.15 + pulse * 0.35;
        tl.ghost.material.opacity = on ? 0.05 : st === 'warnon' ? 0.55 + 0.3 * Math.sin(t * 30) : 0.16;
        if (frozenReal) { tl.glow.material.color.setHex(0xff3040); tl.ghost.material.color.setHex(0xff3040); } else { tl.glow.material.color.setHex(tl.col); tl.ghost.material.color.setHex(tl.col); }
      }
      // FREEZE (real): any movement is fatal
      if (frozenReal && game.state === 'playing' && t - D.t0 > 0.3) {
        const p = game.player;
        if (p.grounded && Math.hypot(p.vx, p.vz) > 1.3) { game.say('hotel.l10.moved', { priority: 2 }); game.kill('moved'); }
      }
      // spotlight
      if (SP.phase !== 'off') {
        const u = t - SP.t0, p = game.player;
        const pulseS = 0.5 + 0.5 * Math.sin(t * 14);
        if (SP.phase === 'warn') {
          spotDisc.material.opacity = 0.18 + 0.1 * pulseS; spotRing.material.color.setHex(0xffe9a0);
          for (const m of redFloors) m.material.opacity = 0.05 * pulseS;
          if (u >= SP_WARN()) { SP.phase = 'on'; SP.t0 = t; }
        } else {
          spotDisc.material.opacity = 0.55; spotRing.material.color.setHex(0xffffff);
          for (const m of redFloors) m.material.opacity = 0.16 + 0.1 * pulseS;
          const inFloor = p.z < FZ0 + 0.5 && p.z > FZ1 - 0.5 && p.y < 2.5 && p.y > -0.5;
          if (u > 0.35 && game.state === 'playing' && inFloor && p.grounded && Math.hypot(p.x - SP.x, p.z - SP.z) > SP.R + 0.1) { game.say('hotel.l10.spotdeath', { priority: 2 }); game.kill('spot'); }
          if (u >= SP_ON()) { SP.phase = 'off'; spotDisc.visible = false; spotRing.visible = false; for (const m of redFloors) m.material.opacity = 0; }
        }
      }
    });

    // ---- the host --------------------------------------------------------------------------------------------------------------
    let t0 = 0, intro = false; const said = {};
    const once = (k, key) => { if (said[k]) return; said[k] = 1; game.say(key, { priority: 1 }); };
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l10.intro'); g.say('hotel.l10.intro2'); stageTitle(g, w, 1, NAMES.length, NAMES[0]); }
    };
    w.hooks.onCheckpoint = (c) => {
      const i = cps.get(c);
      if (i === undefined) return;
      if (i < 4) { stageTitle(game, w, i + 2, NAMES.length, NAMES[i + 1]); game.say('hotel.l10.s' + (i + 2), { priority: 1 }); }
      else game.say('hotel.l10.djcp', { priority: 1 });
    };
    onPlat(w, tiles[1].pl, () => once('t1', 'hotel.l10.tiles'));
    onPlat(w, s2tiles[0].pl, () => once('t2', 'hotel.l10.faster'));
    onPlat(w, conga[0], () => once('cg', 'hotel.l10.conga'));
    onPlat(w, floors[0], () => once('fl', 'hotel.l10.floor'));
    onPlat(w, longs[0], () => once('lg', 'hotel.l10.bridgesee'));
    onPlat(w, dj, () => once('dj', 'hotel.l10.dj'));
    w.hooks.onDeath = (info) => {
      if (info.reason === 'vip' || info.reason === 'moved' || info.reason === 'spot') return true;
      if (Math.random() < 0.6) { game.say('hotel.l10.fall', { priority: 1 }); return true; }
      return false;
    };
    stageHint(w, stages, { flat: false });
    const baseHint = w.hintFn;
    w.hintFn = (g) => {
      const p = g.player;
      if (!encoreOn && p.z < djZ + 4 && p.z > djZ - 5) return [{ x: p.x, y: p.y + 0.15, z: p.z }, { x: fakeGoal.x, y: fakeGoal.y + 0.15, z: fakeGoal.z }];
      return baseHint(g);
    };
    // bot: hold still during a real freeze; wait for the next tile to be lit; stand in the spotlight; chase the booth hatch
    w.botPlan = (g) => {
      const p = g.player, t = w.t;
      const still = { wait: true, x: p.x, z: p.z };
      if (D.kind === 'real' && (D.phase === 'freeze' || (D.phase === 'warn' && t - D.t0 > WARN - 0.4 && p.grounded))) return still;
      if (SP.phase !== 'off' && p.z < FZ0 + 0.5 && p.z > FZ1 - 0.5) return { x: SP.x, z: SP.z };
      if (!encoreOn && p.grounded && p.z < djZ + 4 && p.z > djZ - 5) return { x: fakeGoal.x, z: fakeGoal.z };
      if (!p.grounded) return null;
      const nt = tiles.find((tl) => tl.active && tl.z < p.z - 1);
      const nb = booths.find((b) => b.z < p.z - 1);
      if (nt && Math.abs(nt.z - p.z) < 6.5 && !(nb && nb.z > nt.z) && !(isOn(nt, t + 0.12) && mod(t + 0.12 + ph(nt), setOf(nt).P) < ONs(nt) - 0.6)) return still;
      return null;
    };
    w.dance = { tiles, booths, isOn, D, SP, sets, conga, floors, longs, stages, cps, enc, finalGoal, fakeGoal, callFreeze, callSpot, get frozen() { return frozenReal; }, get encoreOn() { return encoreOn; }, phaseOf: () => D.phase };
    void hotelEnv; void hotelHalo;
  },
};
