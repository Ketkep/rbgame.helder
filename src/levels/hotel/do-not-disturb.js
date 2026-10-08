import * as THREE from 'three';
import { plainMaterial, softTexture } from '../../engine/materials.js';
import { roomShell, hotelHalo, GOLD } from './kit.js';
import { solveMaze } from './mazekit.js';
import { rayAABB } from '../../engine/physics.js';
import { onPlat } from '../common.js';
import { mazeSection, sectionHint, routeHint, cautiousSteer } from './mazestage.js';
import { fakeExit, fakeComplete, twistZone, loadingScreen, vanishAfter, stageTitle } from './trolls.js';

// Hotel level 12 — "Do Not Disturb" (Hard · Guest Rooms). Stealth. Two wings of the guest floor, two mazes (new ones every attempt),
// and the laundry between them. Housekeepers patrol the corridors on fixed rounds (out to the end of their corridor, a pause to look
// round, and back), they see in a cone (drawn on the floor, clipped by walls), and being in the cone for half a second is the end of you.
// Laundry carts in the side passages: E to hide, press anything to climb out. Rounds are exactly periodic: watch one and you know it.
// Six stages, a checkpoint for each:
//   1 Guest Wing     wing A, south half: two housekeepers on rounds
//   2 Linen Corridor wing A, north half (checkpoint in the middle cell): a DND sign you can hang on the right door (and one that does nothing)
//   3 The Laundry    the wash vat is the floor: machines, a trolley, an ironing board, mangles that slam, a bridge that leaves, a laggy jump
//   4 West Wing      the service lift (the checkpoint is IN the lift; "loading…"), wing B: two housekeepers and a third who is wax
//   5 Quiet Hours    wing B, north half (checkpoint in the middle cell): the lights go out for a moment and the mouse turns round; a decoy STAIRS
//   6 The Stairs     the STAIRS: LEVEL COMPLETE (or is it)
// Baby Mode: she needs longer to be sure (0.95 s), is slower, signs work on every door, the decoy is labelled, twists are short.

const NAMES = ['Guest Wing', 'Linen Corridor', 'The Laundry', 'West Wing', 'Quiet Hours', 'The Stairs'];
const C = 4.4, T = 0.8, WH = 3.6, H = 8;
const NA = 9, NB = 10;
const XW = 26;
const ZS = 14;
const ZA = 0, ZA1 = ZA - NA * C;
const ZB = ZA1 - 56, ZB1 = ZB - NB * C;
const ZE = ZB1 - 30;
const WATER_S = ZA1 - T / 2, WATER_N = ZB + T / 2;
const RANGE = 12, HALF = 0.62;     // vision: 12 m, ±36°
const RAYS = 26;
const rnd = (n) => Math.floor(Math.random() * n);

export default {
  id: 'hotel-12',
  name: 'Do Not Disturb',
  music: 'hotel_dark',
  completeQuip: 'Nobody saw you. Nobody ever does. It is the hotel industry\'s greatest strength.',

  build(w, game) {
    w.env({
      top: 0x0a0a14, horizon: 0x221a28, bottom: 0x08080c,
      fog: { color: 0x14101a, near: 40, far: 140 },
      sun: { color: 0xc0c8ff, intensity: 0.15, dir: [0.2, 0.9, 0.3], shadow: false },
      hemi: { sky: 0xffe2c0, ground: 0x7a6a70, intensity: 0.9 },
      exposure: 0.95, stars: 0,
      bloom: { strength: 0.4, radius: 0.6, threshold: 0.95 },
      motes: { color: 0xffe0b0, count: 120, size: 0.06, opacity: 0.4 },
      envMap: { top: 0xffe0c0, mid: 0x4a3a40, bottom: 0x100c10, intensity: 0.35, lights: [{ pos: [0, 8, 0], w: 14, h: 14, color: 0xffe2b0, intensity: 2.0 }] },
    });
    w.setTheme({ tex: 'carpet', color: 0xffffff, trim: null, edge: null, edgeOpacity: 0, roughness: 0.8, metalness: 0, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.killY = -30;
    const baby = () => game.baby;

    roomShell(w, { x0: -XW, x1: XW, z0: ZE, z1: ZS, yb: -4, H, wallTex: 'damask', wallColor: 0xffffff, pilasterEvery: 11, lamps: false });
    w.plat({ x: 0, y: -3.5, z: (ZS + ZE) / 2, w: 2 * XW, d: ZS - ZE, h: 1, tex: 'carpet', color: 0x200810, roughness: 0.9 });
    const carpet = (z0, z1, color) => w.plat({ x: 0, y: 0, z: (z0 + z1) / 2, w: 2 * XW, d: z0 - z1, h: 1.2, tex: 'carpet', color, roughness: 0.95 });
    carpet(ZS, WATER_S, 0x8a3040);
    carpet(WATER_N, ZE, 0x5a2a48);

    // ---- the two wings ------------------------------------------------------------------------------------------------
    let nb = w.bodies.length;
    const MA = mazeSection(w, { N: NA, C, T, WH, Z0: ZA, band: [52, 60], walls: { tex: 'damask', color: 0xffe8d8, roughness: 0.7, radius: 0.05, reach: [-XW, XW] } });
    const wallsA = w.bodies.slice(nb).filter((b) => b.solid);
    nb = w.bodies.length;
    const MB = mazeSection(w, { N: NB, C, T, WH, Z0: ZB, band: [66, 74], walls: { tex: 'damask', color: 0xe6d0d8, roughness: 0.7, radius: 0.05, reach: [-XW, XW] } });
    const wallsB = w.bodies.slice(nb).filter((b) => b.solid);
    const poolMatA = new THREE.MeshBasicMaterial({ map: softTexture('glow'), color: 0xffc880, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const poolMatB = poolMatA.clone(); poolMatB.color.set(0xd8a0c0); poolMatB.opacity = 0.12;
    const poolGeo = new THREE.PlaneGeometry(C * 1.5, C * 1.5);
    for (const [M, pm] of [[MA, poolMatA], [MB, poolMatB]]) {
      for (let i = 0; i < M.N; i++) for (let j = 0; j < M.N; j++) {
        const m = new THREE.Mesh(poolGeo, pm); m.rotation.x = -Math.PI / 2; m.position.set(M.cx(i), 0.02, M.cz(j)); m.matrixAutoUpdate = false; m.updateMatrix(); w.add(m);
        if ((i + j) % 3 === 0) w.box({ x: M.cx(i), y: 3.0, z: M.cz(j), w: 1.4, h: 0.1, d: 0.3, glow: 0xffe0b0, glowIntensity: 1.3, shadow: false });
      }
    }
    for (const [x, z] of [[-8, 4], [8, -14], [-8, -26], [8, -38], [0, -60], [-8, -90], [8, -102], [-8, -114], [8, -126]]) w.light(0xffe0b0, 12, 24, x, 5.4, z);
    // the little ornaments of a hotel corridor
    for (let i = 0; i < NA; i++) for (let j = 0; j < NA; j++) if ((i * 3 + j) % 5 === 0) wallLamp(w, MA, i, j);
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) if ((i * 3 + j) % 5 === 0) wallLamp(w, MB, i, j);

    // ---- entrance, signs ---------------------------------------------------------------------------------------------------
    w.spawn = { x: MA.cx(0), y: 0, z: ZA + 5, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.sign({ text: 'GUEST ROOMS · FLOOR 3 · EAST WING', x: MA.cx(0), y: 5.4, z: ZA + 0.5, w: 7, h: 0.9, color: '#f1d28a', double: true, tw: 1024, size: 50 });
    w.sign({ text: 'LAUNDRY · STAFF ONLY · WET FLOOR', x: MA.exit.x, y: 5.6, z: WATER_S - 0.2, w: 7, h: 0.9, color: '#ffd21f', bg: '#1a1420', double: true, tw: 1024, size: 44 });
    w.sign({ text: 'WEST WING', x: MB.cx(0), y: 5.4, z: ZB + 0.5, w: 4.2, h: 0.9, color: '#f1d28a', double: true, tw: 1024, size: 70 });

    // ---- the laundry: the wash vat is the floor -----------------------------------------------------------------------------------
    w.plat({ x: 0, y: -1.4, z: (WATER_S + WATER_N) / 2, w: 2 * XW, d: WATER_S - WATER_N, h: 0.6, tex: 'tile', color: 0x2a3a4a, roughness: 0.4 });
    const vat = w.hazard({ x: 0, y: -0.78, z: (WATER_S + WATER_N) / 2, w: 2 * XW, h: 1.3, d: WATER_S - WATER_N, color: 0x9ad8ff });
    vat.core.visible = false; vat.shell.visible = false;
    const vatMat = new THREE.MeshStandardMaterial({ color: 0x8ac4e0, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85, emissive: 0x2a5878, emissiveIntensity: 0.5 });
    const vatMesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * XW, WATER_S - WATER_N), vatMat);
    vatMesh.rotation.x = -Math.PI / 2; vatMesh.position.set(0, -0.15, (WATER_S + WATER_N) / 2); w.add(vatMesh);
    const suds = new THREE.MeshBasicMaterial({ map: softTexture('puff'), color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending });
    const sudsM = [];
    for (let k = 0; k < 18; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), suds); m.rotation.x = -Math.PI / 2; m.position.set(-XW + 3 + Math.random() * (2 * XW - 6), -0.13, WATER_N + 2 + Math.random() * (WATER_S - WATER_N - 4)); w.add(m); sudsM.push(m); }
    w.onUpdate((dt, t) => { sudsM.forEach((m, k) => { m.rotation.z += dt * (k % 2 ? 0.14 : -0.14); }); vatMat.emissiveIntensity = 0.45 + Math.sin(t * 1.1) * 0.1; });
    for (const z of [WATER_S - 9, WATER_S - 23, WATER_S - 37, WATER_S - 51]) {
      w.box({ x: 0, y: 6.6, z, w: 36, h: 0.9, d: 3.2, color: 0x9aa0aa, metal: 0.9, rough: 0.35, shadow: false });
      w.box({ x: 0, y: 6.1, z, w: 36, h: 0.12, d: 2.4, glow: 0xdff0ff, glowIntensity: 1.4, shadow: false });
    }

    const route = [];
    const mark = (p) => { p.o.path = true; route.push({ x: p.body.x, y: p.top, z: p.body.z }); return p; };
    const zu = (u) => WATER_S - u;
    const machine = (x, u, top, s = 2.4, d = s, color = 0xeef2f6) => {
      const p = w.plat({ x, y: top, z: zu(u), w: s, d, h: top + 1.4, tex: 'metal', color, roughness: 0.3, metalness: 0.7, radius: 0.08 });
      return p;
    };
    const L1 = mark(w.plat({ x: MA.exit.x, y: 0, z: WATER_S - 2.2, w: 5, d: 4.4, h: 1.4, tex: 'tile', color: 0xd8dde2, roughness: 0.45 }));
    mark(machine(14.4, 7.2, 0.35));
    const K2 = mark(machine(10.6, 10.5, 0.5));
    w.mover(K2, (t) => ({ x: 1.4 * Math.sin(t * 1.0) }));
    const K3 = mark(w.crumble(machine(6.8, 14.0, 0.6, 2.2, 2.2, 0xd8c8a8), { delay: 0.65, gone: 3 }));
    // the mangles: a long machine with two presses that slam down in turn (a head you can see coming)
    const PL = mark(machine(2.4, 22.5, 0.6, 3.0, 11));
    const presses = [-1, 1].map((sgn, k) => press(w, PL, sgn * 2.6, { ph: k * 1.7, period: 3.4 }));
    const K4 = mark(machine(1.2, 30.9, 0.7, 2.6));
    const K5 = mark(machine(-0.8, 34.9, 0.75));
    w.mover(K5, (t) => ({ x: 1.3 * Math.sin(t * 1.15 + 1.0) }));
    const K6 = mark(w.crumble(machine(-3.0, 38.9, 0.8, 2.2, 2.2, 0xd8c8a8), { delay: 0.65, gone: 3 }));
    const V = mark(w.plat({ x: -3.0, y: 0.85, z: zu(44.6), w: 1.8, d: 7.2, h: 0.3, tex: 'metal', color: 0xdfe3e8, roughness: 0.3, metalness: 0.8, radius: 0.1 }));
    vanishAfter(w, game, V, { axis: 'z', dir: -1, frac: 0.55, delay: 0.75, back: 3.2, say: 'hotel.l12.bridge' });
    twistZone(game, w, { x: -0.8, y: 2.4, z: zu(34.9), w: 3, h: 4, d: 3 }, 'lag', { sec: 4, say: 'hotel.l12.lag' });   // K5: the connection drops
    // the laundry trolley on its rail
    const L2X = MB.cx(0), L2Z = WATER_N + 3.3, L2W = 12, L2E = L2X + L2W / 2;
    const cartZ = WATER_N + 4.6, cart0 = -3.0, cartStop = L2E + 1.1;
    const cart = mark(w.plat({ x: cart0, y: 0.7, z: cartZ, w: 2.2, d: 1.6, h: 0.1, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.03 }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      cart.attach(w.box({ x: cart0 + sx * 1.0, y: 1.35, z: cartZ + sz * 0.7, w: 0.08, h: 1.2, d: 0.08, color: GOLD, metal: 1, rough: 0.28, static: false }));
      cart.attach(w.box({ x: cart0 + sx * 0.9, y: 0.46, z: cartZ + sz * 0.7, w: 0.22, h: 0.22, d: 0.12, color: 0x14141a, rough: 0.5, static: false }));
    }
    cart.attach(w.box({ x: cart0, y: 1.95, z: cartZ, w: 2.1, h: 0.06, d: 0.06, color: GOLD, metal: 1, rough: 0.3, static: false }));
    cart.attach(w.box({ x: cart0, y: 1.2, z: cartZ, w: 1.6, h: 0.9, d: 1.0, color: 0xf4f0e8, rough: 0.9, static: false, shadow: false }));
    for (const sz of [-0.55, 0.55]) w.box({ x: (cart0 + cartStop) / 2, y: 0.3, z: cartZ + sz, w: cartStop - cart0 + 3, h: 0.08, d: 0.1, color: 0x8a7a50, metal: 1, rough: 0.4, shadow: false });
    for (let x = cart0 + 1; x > cartStop - 2; x -= 2.2) w.box({ x, y: -0.5, z: cartZ, w: 0.25, h: 1.6, d: 1.3, color: 0x4a4a52, rough: 0.6, shadow: false });
    w.rollaway(cart, { dir: [-1, 0], dist: cart0 - cartStop, accel: 2.4, speed: 3.0, delay: 0.5, hold: 3.2, back: 1.6, onGo: () => game.say('hotel.l12.trolley', { priority: 1 }) });
    const L2 = mark(w.plat({ x: L2X, y: 0, z: L2Z, w: L2W, d: 6.6, h: 1.4, tex: 'tile', color: 0xd8dde2, roughness: 0.45 }));
    void K3; void K4; void K6;

    // ---- the service lift: the doors are the wing's gate ------------------------------------------------------------------------------
    const lift = { state: 'idle', front: null, back: null, panels: [], t: 0, ridden: false };
    {
      const metal = plainMaterial(0xc9ced6, { metalness: 0.9, roughness: 0.3 });
      const zN = ZB + 0.45, zF = ZB + 4.4, zc = (zN + zF) / 2;
      for (const sx of [-1, 1]) {
        w.collider({ x: L2X + sx * 2.15, y: 1.7, z: zc, w: 0.2, h: 3.4, d: zF - zN + 0.3 });
        w.box({ x: L2X + sx * 2.15, y: 1.7, z: zc, w: 0.24, h: 3.4, d: zF - zN + 0.3, color: 0xb9bfc9, metal: 0.8, rough: 0.35 });
      }
      w.box({ x: L2X, y: 3.5, z: zc, w: 4.5, h: 0.2, d: zF - zN + 0.3, color: 0xa8aeb8, metal: 0.8, rough: 0.35 });
      w.box({ x: L2X, y: 3.3, z: zc, w: 3.0, h: 0.1, d: 1.0, glow: 0xfff0d0, glowIntensity: 1.8, shadow: false });
      const door = (z, key) => {
        const body = w.collider({ x: L2X, y: 1.7, z, w: 3.9, h: 3.4, d: 0.5 });
        const g = new THREE.Group(); g.position.set(L2X, 0, z); w.add(g);
        const panels = [];
        for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.95, 3.3, 0.12), metal); m.position.set(s * 0.98, 1.65, 0); g.add(m); panels.push({ m, s }); }
        const o = { body, g, panels, open: key === 'front', p: key === 'front' ? 1 : 0 };
        body.enabled = !o.open; lift[key] = o; return o;
      };
      door(zF, 'front'); door(ZB + 0.1, 'back');
      w.sign({ text: 'SERVICE LIFT · WEST WING', x: L2X, y: 3.95, z: zF + 0.3, w: 4.2, h: 0.55, color: '#f1d28a', bg: '#1a1420', double: true, tw: 1024, size: 46 });
      w.onUpdate((dt) => {
        for (const o of [lift.front, lift.back]) {
          if (!o) continue;
          o.p += Math.max(-dt * 1.2, Math.min(dt * 1.2, (o.open ? 1 : 0) - o.p));
          for (const { m, s } of o.panels) { const k = 1 - 0.92 * o.p; m.scale.x = k; m.position.x = s * (1.95 - 1.95 * k / 2); }
          o.body.enabled = o.p < 0.6;
        }
      });
      w.trigger({
        x: L2X, y: 1.2, z: zc, w: 3.2, h: 2.4, d: 2.6, once: false,
        onEnter: () => {
          if (lift.ridden || game.state !== 'playing') return;
          lift.ridden = true; lift.state = 'loading'; lift.front.open = false;
          w.after(0.9, () => {
            loadingScreen(game, w, { sec: 2.4, say: 'hotel.l12.lift' });
            const iv = setInterval(() => {            // (the world is frozen while it "loads": watch in real time)
              if (game.frozen) return;
              clearInterval(iv); lift.state = 'done'; lift.back.open = true; lift.front.open = true; game.audio.chime?.(); game.say('hotel.l12.wingb', { priority: 1 });
            }, 100);
            w.onDispose(() => clearInterval(iv));
          });
        },
      });
      w.onRespawn(() => { if (lift.ridden) { lift.state = 'done'; } });
      lift.cx = L2X; lift.cz = zc;
    }

    // ---- the real exit and a decoy ---------------------------------------------------------------------------------------------------
    const exitX = MB.cx(NB - 1), exitZ = ZB1 - 9, bonusZ = ZB1 - 25;
    w.sign({ text: 'STAIRS', x: exitX, y: 4.4, z: ZB1 - 1.0, w: 4, h: 1.2, color: '#6cf0b2', double: true, tw: 512, size: 100, glow: true });
    for (let k = 0; k < 6; k++) w.box({ x: exitX - 6 + k * 2.4, y: 0.1 + k * 0.1, z: ZE + 1.5 + (5 - k) * 0.0, w: 2.2, h: 0.2, d: 2.0, color: 0x6a5a52, rough: 0.8, shadow: false });
    w.sign({ text: 'STAIRS ↓ · NO LIFT', x: exitX, y: 3.2, z: bonusZ - 3.2, w: 4.0, h: 0.7, color: '#6cf0b2', double: true, tw: 512, size: 70, glow: true });
    // the stairs: LEVEL COMPLETE — "just kidding", and the real stairs are further on
    const finalGoal = w.goal({ x: exitX, y: 0, z: bonusZ, color: GOLD, onReach: () => { game.say('hotel.l12.done', { priority: 2 }); game.completeLevel(); } });
    finalGoal.group.visible = false; finalGoal.trig.enabled = false;
    let bonusOn = false;
    const enableBonus = () => { bonusOn = true; finalGoal.group.visible = true; finalGoal.trig.enabled = true; w.goalObj = finalGoal; w.burst(new THREE.Vector3(finalGoal.x, 2, finalGoal.z), GOLD, 20, 4); game.say('hotel.l12.bonus', { priority: 2 }); };
    const firstGoal = w.goal({ x: exitX, y: 0, z: exitZ, color: 0x2dd4bf, onReach: () => { if (!fakeComplete(game, w, { title: 'LEVEL COMPLETE', say: 'hotel.l12.fakewin', then: enableBonus })) { game.say('hotel.l12.done', { priority: 2 }); game.completeLevel(); } } });
    w.goalObj = firstGoal;

    // ---- laundry carts: the hiding places ------------------------------------------------------------------------------------------------
    let hidden = false, hiddenIn = null, hideT = 0;
    const carts = [];
    const addCart = (M, c) => {
      if (carts.some((q) => q.M === M && q.cell[0] === c[0] && q.cell[1] === c[1])) return null;
      const x = M.cx(c[0]), z = M.cz(c[1]);
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const basket = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.0), plainMaterial(0xe8e4dc, { roughness: 0.8 })); basket.position.y = 0.95; basket.castShadow = true; g.add(basket);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.1), plainMaterial(0x8a8d95, { metalness: 0.9, roughness: 0.4 })); frame.position.y = 0.4; g.add(frame);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), plainMaterial(0x111111, { roughness: 0.6 })); wh.rotation.x = Math.PI / 2; wh.position.set(sx * 0.65, 0.15, sz * 0.4); g.add(wh); }
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.8), plainMaterial(0xffffff, { roughness: 0.9 })); sheet.position.y = 1.62; g.add(sheet);
      w.add(g);
      const body = w.collider({ x, y: 0.7, z, w: 1.5, h: 1.4, d: 1.0 });
      const cart = { M, cell: c.slice(), x, z, body, g };
      cart.it = w.interactable({ x, y: 1.0, z, w: 1.7, h: 1.4, d: 1.3, range: 3.4, pad: 0.1, label: () => (hidden ? 'Climb out' : 'Hide in the laundry cart'), onUse: (gm) => (hidden ? unhide(gm) : hide(gm, cart)) });
      carts.push(cart); return cart;
    };

    // ---- the housekeepers: exact rounds along a stretch of the solution path ---------------------------------------------------------------------------
    const maids = [];
    const blackM = plainMaterial(0x15151c, { roughness: 0.6 }), whiteM = plainMaterial(0xf6f6f2, { roughness: 0.7 });
    const waxM = plainMaterial(0xcfc6bd, { roughness: 0.35 });
    const bangTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#ff3a46'; g.font = '110px "Archivo Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 64, 70); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; w.ownTextures.push(t); return t; })();
    const maidMesh = (statue) => {
      const mesh = new THREE.Group(); w.add(mesh);
      const dark = statue ? waxM : blackM, light = statue ? waxM : whiteM;
      const legs = [];
      for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.24), dark); leg.position.set(sx * 0.16, 0.45, 0); leg.geometry.translate(0, -0.05, 0); mesh.add(leg); legs.push(leg); }
      const dress = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 1.0, 14), dark); dress.position.y = 1.35; dress.castShadow = true; mesh.add(dress);
      const apron = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.05), light); apron.position.set(0, 1.3, -0.4); mesh.add(apron);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), statue ? waxM : plainMaterial(0xe6c0a0, { roughness: 0.6 })); head.position.y = 2.0; mesh.add(head);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12), light); cap.position.y = 2.25; mesh.add(cap);
      if (!statue) { const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), plainMaterial(0x4a2a1a)); hair.position.set(0, 2.03, 0.04); mesh.add(hair); }
      const cart = new THREE.Group(); cart.position.set(0, 0, -1.2); mesh.add(cart);
      const cb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.8), plainMaterial(0xdcd8d0, { roughness: 0.8 })); cb.position.y = 0.8; cart.add(cb);
      const ctop = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.7), plainMaterial(0xffffff, { roughness: 0.9 })); ctop.position.y = 1.3; cart.add(ctop);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.9), dark); arm.position.set(0.3, 1.35, -0.55); mesh.add(arm); const arm2 = arm.clone(); arm2.position.x = -0.3; mesh.add(arm2);
      let bang = null;
      if (!statue) { bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex, transparent: true, depthTest: false })); bang.position.y = 3.2; bang.scale.set(1.2, 1.2, 1); bang.visible = false; mesh.add(bang); }
      return { mesh, legs, bang };
    };
    const makeCone = (statue) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(RAYS * 3 * 3); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: statue ? 0x6ab4ff : 0xff5a30, transparent: true, opacity: statue ? 0.14 : 0.2, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      cone.frustumCulled = false; w.add(cone);
      return { cone, geo, pos };
    };
    // distance to the first wall along a horizontal ray
    const rayWall = (walls, x, z, dx, dz, max) => {
      let best = max;
      for (const b of walls) {
        if (Math.abs(b.x - x) > b.hx + max || Math.abs(b.z - z) > b.hz + max) continue;
        const t = rayAABB(x, 1.2, z, dx, 0, dz, b, 0); if (t < best) best = t;
      }
      return best;
    };
    /** a round: out along `cells` and back, with a pause (and a turn) at each end */
    const makeRound = (M, cells, { speed, wait, phase }) => {
      const pts = cells.map((c) => [M.cx(c[0]), M.cz(c[1])]);
      const segs = []; let len = 0;
      for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push({ i, l, s0: len, yaw: Math.atan2(-(pts[i + 1][0] - pts[i][0]), -(pts[i + 1][1] - pts[i][1])) }); len += l; }
      const tLeg = len / speed, period = 2 * tLeg + 2 * wait;
      const turn = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };
      const at = (t) => {
        const s = (((t + phase) % period) + period) % period;
        const along = (d, rev) => {
          const dd = rev ? len - d : d;
          const sg = segs.find((q) => dd <= q.s0 + q.l + 1e-6) || segs[segs.length - 1];
          const u = Math.max(0, Math.min(1, (dd - sg.s0) / sg.l));
          const p0 = pts[sg.i], p1 = pts[sg.i + 1];
          return { x: p0[0] + (p1[0] - p0[0]) * u, z: p0[1] + (p1[1] - p0[1]) * u, yaw: rev ? sg.yaw + Math.PI : sg.yaw };
        };
        const fy = segs[0].yaw, ly = segs[segs.length - 1].yaw;
        if (s < tLeg) return { ...along(s * speed, false), moving: true };
        if (s < tLeg + wait) { const e = along(len, false); return { x: e.x, z: e.z, yaw: turn(ly, ly + Math.PI, Math.min(1, (s - tLeg) / 0.7)), moving: false }; }
        if (s < 2 * tLeg + wait) return { ...along((s - tLeg - wait) * speed, true), moving: true };
        const e = along(0, false); return { x: e.x, z: e.z, yaw: turn(fy + Math.PI, fy + 2 * Math.PI, Math.min(1, (s - 2 * tLeg - wait) / 0.7)), moving: false };
      };
      return { at, period, cells, len };
    };
    const seesAt = (walls, st, px, pz, margin = 0) => {
      const dx = px - st.x, dz = pz - st.z, d = Math.hypot(dx, dz);
      if (d > RANGE + margin) return false;
      if (d < 0.01) return true;
      const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw);
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d)));
      if (ang > HALF + margin * 0.12) return false;
      return d < rayWall(walls, st.x, st.z, dx / d, dz / d, RANGE + 1) + margin * 0.5;
    };

    // choose each round: a stretch of the solution path with a side passage near its start (a place to wait, or a cart)
    const midA = MA.path.length >> 1, midB = MB.path.length >> 1;
    const pick = (M, lo, hi, len, avoid) => {
      const ok = [], any = [];
      for (let k1 = lo; k1 + len <= hi; k1++) {
        const k2 = k1 + len;
        if (avoid.some((a) => a >= k1 - 2 && a <= k2 + 2)) continue;
        // a side passage (off the path) from cells k1-1 … k1+1
        let pocket = null;
        for (let j = k1 - 2; j <= k1 + 3 && !pocket; j++) { const c = M.path[j]; if (!c) continue; const n = M.maze.nbrs(c[0], c[1]).find((q) => !M.onPath(q)); if (n) pocket = { from: c, cell: n, j }; }
        (pocket ? ok : any).push({ k1, k2, pocket });
      }
      return ok.length ? ok[rnd(ok.length)] : any.length ? any[rnd(any.length)] : null;
    };
    const usedPockets = [];
    const addMaid = (M, walls, seg, o) => {
      const cells = M.path.slice(seg.k1, seg.k2 + 1);
      const round = makeRound(M, cells, o);
      const { mesh, legs, bang } = maidMesh(false), cn = makeCone(false);
      const m = { M, walls, round, mesh, legs, bang, ...cn, seen: 0, off: 0, offUntil: 0, fade: 1, seg, name: o.name, statue: false, st: round.at(0) };
      maids.push(m);
      if (seg.pocket) { usedPockets.push({ M, ...seg.pocket, maid: m }); addCart(M, seg.pocket.cell); }
      return m;
    };
    const lenA = baby() ? 5 : 6;
    const avoidA = [0, 1, 2, 3, midA, MA.path.length - 1, MA.path.length - 2];
    const avoidB = [0, 1, 2, 3, midB, MB.path.length - 1, MB.path.length - 2];
    const pickAny = (M, lo, hi, avoid, lens) => { for (const l of lens) { const r = pick(M, lo, hi, l, avoid); if (r && r.pocket) return r; } for (const l of lens) { const r = pick(M, lo, hi, l, avoid); if (r) return r; } return null; };
    const sA1 = pickAny(MA, 5, midA - 2, avoidA, [lenA, 5, 4]) || pickAny(MA, 4, midA, avoidA, [4]);
    const sA2 = pickAny(MA, midA + 4, MA.path.length - 4, avoidA, [lenA, 5, 4]) || pickAny(MA, midA + 3, MA.path.length - 2, avoidA, [4]);
    const sB1 = pickAny(MB, 5, midB - 2, avoidB, [lenA, 5, 4]) || pickAny(MB, 4, midB, avoidB, [4]);
    const sB2 = pickAny(MB, midB + 4, MB.path.length - 5, avoidB, [lenA + 1, lenA, 5, 4]) || pickAny(MB, midB + 3, MB.path.length - 2, avoidB, [4]);
    const spd = 2.4 * (baby() ? 0.85 : 1);
    const rA1 = addMaid(MA, wallsA, sA1, { speed: spd, wait: 1.8, phase: Math.random() * 30, name: 'Rosa' });
    const rA2 = addMaid(MA, wallsA, sA2, { speed: spd + 0.2, wait: 1.6, phase: Math.random() * 30, name: 'Dolores' });
    const rB1 = addMaid(MB, wallsB, sB1, { speed: spd, wait: 1.8, phase: Math.random() * 30, name: 'Ines' });
    const rB2 = addMaid(MB, wallsB, sB2, { speed: spd + 0.2, wait: 1.6, phase: Math.random() * 30, name: 'Pilar' });
    for (const M of [MA, MB]) {   // a few more carts in dead ends
      const des = M.deadEnds.filter((c) => !usedPockets.some((q) => q.M === M && q.cell[0] === c[0] && q.cell[1] === c[1])).sort(() => Math.random() - 0.5);
      for (const c of des.slice(0, 3)) addCart(M, c);
    }

    // the third housekeeper in the west wing is wax
    let statue = null;
    {
      const k = Math.min(MB.path.length - 8, midB + 6 + rnd(8));
      const c = MB.path[k], prev = MB.path[k - 1];
      const cx0 = MB.cx(c[0]), cz0 = MB.cz(c[1]);
      const ddx = MB.cx(prev[0]) - cx0, ddz = MB.cz(prev[1]) - cz0, dl = Math.hypot(ddx, ddz) || 1;
      const x = cx0 - (ddz / dl) * 1.1, z = cz0 + (ddx / dl) * 1.1;              // against the corridor wall: the way through stays clear
      const yaw = Math.atan2(-ddx, -ddz);                                          // she faces back along the way you came
      const { mesh, legs } = maidMesh(true); mesh.position.set(x, 0, z); mesh.rotation.y = yaw;
      w.collider({ x, y: 1.1, z, w: 0.9, h: 2.2, d: 0.9 });
      const cn = makeCone(true);
      const st = { x, z, yaw, moving: false };
      statue = { mesh, legs, ...cn, cell: c, k, x, z, yaw, st, walls: wallsB, said: false };
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      let o = 0;
      const pts = [];
      for (let r = 0; r <= RAYS; r++) { const a = -HALF + (2 * HALF * r) / RAYS, ca = Math.cos(a), sa = Math.sin(a); const dx = fx * ca - fz * sa, dz = fx * sa + fz * ca; const d = rayWall(wallsB, x, z, dx, dz, RANGE); pts.push([x + dx * d, z + dz * d]); }
      for (let r = 0; r < RAYS; r++) { cn.pos[o++] = x; cn.pos[o++] = 0.05; cn.pos[o++] = z; cn.pos[o++] = pts[r][0]; cn.pos[o++] = 0.05; cn.pos[o++] = pts[r][1]; cn.pos[o++] = pts[r + 1][0]; cn.pos[o++] = 0.05; cn.pos[o++] = pts[r + 1][1]; }
      cn.geo.attributes.position.needsUpdate = true;
    }
    const updateCone = (m, st) => {
      const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw);
      let o = 0; const pts = [];
      for (let r = 0; r <= RAYS; r++) {
        const a = -HALF + (2 * HALF * r) / RAYS, ca = Math.cos(a), sa = Math.sin(a);
        const dx = fx * ca - fz * sa, dz = fx * sa + fz * ca;
        const d = rayWall(m.walls, st.x, st.z, dx, dz, RANGE);
        pts.push([st.x + dx * d, st.z + dz * d]);
      }
      for (let r = 0; r < RAYS; r++) {
        m.pos[o++] = st.x; m.pos[o++] = 0.05; m.pos[o++] = st.z;
        m.pos[o++] = pts[r][0]; m.pos[o++] = 0.05; m.pos[o++] = pts[r][1];
        m.pos[o++] = pts[r + 1][0]; m.pos[o++] = 0.05; m.pos[o++] = pts[r + 1][1];
      }
      m.geo.attributes.position.needsUpdate = true;
    };

    // ---- DND doors: ROOM plates in the side passages --------------------------------------------------------------------------------------
    const doorsDND = [];
    const dndDoor = (u, real, label) => {
      const { M, cell, from } = u;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let dir = null;
      for (const d of dirs) {
        const n = [cell[0] + d[0], cell[1] + d[1]];
        if (n[0] >= 0 && n[1] >= 0 && n[0] < M.N && n[1] < M.N && M.maze.open(cell[0], cell[1], n[0], n[1])) continue;
        if (n[0] === from[0] && n[1] === from[1]) continue;
        dir = d; if (d[0] !== 0) break;
      }
      if (!dir) return null;
      const x = M.cx(cell[0]) + dir[0] * (C / 2 - T / 2 - 0.05), z = M.cz(cell[1]) - dir[1] * (C / 2 - T / 2 - 0.05);
      const rotY = dir[0] !== 0 ? (dir[0] > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir[1] > 0 ? 0 : Math.PI);
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; w.add(g);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 0.08), plainMaterial(0x5a3a22, { roughness: 0.5 })); slab.position.set(0, 1.3, 0.04); g.add(slab);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.8, 0.05), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); trim.position.set(0, 1.4, 0.01); g.add(trim);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); knob.position.set(0.55, 1.2, 0.1); g.add(knob);
      const num = 300 + Math.floor(Math.random() * 90);
      const plate = w.sign({ text: `ROOM ${num}`, x, y: 2.5, z, w: 0.95, h: 0.32, rotY, color: '#2a1a08', bg: '#d8a94a', double: false, tw: 256, size: 62 });
      plate.position.add(new THREE.Vector3(Math.sin(rotY) * 0.12, 0, Math.cos(rotY) * 0.12));
      const tag = w.sign({ text: real ? 'OCCUPIED' : 'VACANT', x, y: 2.15, z, w: 0.95, h: 0.26, rotY, color: real ? '#ffffff' : '#0b3d1f', bg: real ? '#8a1a22' : '#7de08a', double: false, tw: 256, size: 58 });
      tag.position.add(new THREE.Vector3(Math.sin(rotY) * 0.12, 0, Math.cos(rotY) * 0.12));
      const sign = w.sign({ text: 'DO NOT DISTURB', x, y: 1.5, z, w: 0.8, h: 0.5, rotY, color: '#ffffff', bg: '#c4202c', border: '#ffffff', double: false, tw: 256, size: 40 });
      sign.position.add(new THREE.Vector3(Math.sin(rotY) * 0.16, 0, Math.cos(rotY) * 0.16)); sign.visible = false;
      const d = { u, real, hung: false, sign, cell, M, num };
      d.it = w.interactable({
        x: M.cx(cell[0]), y: 1.2, z: M.cz(cell[1]), w: 2.2, h: 2.4, d: 2.2, range: 3.4, pad: 0.1, label: () => `Hang the DND sign on ROOM ${num}`,
        enabled: () => !d.hung,
        onUse: () => {
          if (d.hung) return;
          d.hung = true; sign.visible = true; game.audio.click();
          const mm = d.u.maid;
          if (real || baby()) { mm.offUntil = w.t + (baby() ? 60 : 38); game.ui.toast(`✔ ${mm.name} will not disturb ROOM ${num}`, 'good'); game.say('hotel.l12.signok', { priority: 1 }); }
          else { game.ui.toast('✔ DND sign hung. (It is a vacant room.)', ''); game.say('hotel.l12.signlie', { priority: 1 }); }
        },
      });
      w.onRespawn(() => { if (d.hung && !d.real && !baby()) return; });
      doorsDND.push(d); return d;
    };
    const dA1 = usedPockets.find((q) => q.maid === rA1), dA2 = usedPockets.find((q) => q.maid === rA2), dB1 = usedPockets.find((q) => q.maid === rB1), dB2 = usedPockets.find((q) => q.maid === rB2);
    if (dA1) dndDoor(dA1, true); if (dA2) dndDoor(dA2, false); if (dB1) dndDoor(dB1, true); if (dB2) dndDoor(dB2, false);

    // ---- hiding ---------------------------------------------------------------------------------------------------------------------------------
    const vig = document.createElement('div');
    vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:6;opacity:0;transition:opacity 150ms;';
    document.body.appendChild(vig);
    w.onDispose(() => vig.remove());
    const setVig = (css, op) => { vig.style.background = css; vig.style.opacity = String(op); };
    const SLIT = 'linear-gradient(#0a0608 0 44%, transparent 44% 56%, #0a0608 56% 100%)';
    function hide(g, cart) {
      hidden = true; hiddenIn = cart; hideT = 0;
      cart.body.enabled = false;
      g.player.teleport(cart.x, 0.0, cart.z); g.player.grounded = true;
      g.mods.noMove = true; g.audio.click(); g.say('hotel.l12.hide', { priority: 1 });
      setVig(SLIT, 1);
    }
    function unhide(g) {
      if (!hidden) return;
      hidden = false; g.mods.noMove = false; setVig('', 0);
      const c = hiddenIn; const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw);
      g.player.teleport(c.x + fx * 1.4, 0.001, c.z + fz * 1.4); c.body.enabled = true; hiddenIn = null;
    }
    w.onRespawn(() => {
      if (hidden) { hidden = false; game.mods.noMove = false; setVig('', 0); if (hiddenIn) hiddenIn.body.enabled = true; hiddenIn = null; }
      maids.forEach((m) => { m.seen = 0; });
      meter = 0;
    });

    // ---- sight ------------------------------------------------------------------------------------------------------------------------------------
    let meter = 0, blind = false, seenSaid = false;
    const wingOf = (p) => (p.z < ZB + 1.2 ? 'B' : 'A');
    w.onUpdate((dt, t) => {
      const p = game.player;
      let worst = 0;
      for (const m of maids) {
        const on = t >= m.offUntil;
        m.fade += Math.max(-dt * 1.4, Math.min(dt * 1.4, (on ? 1 : 0) - m.fade));
        const st = m.round.at(t); m.st = st;
        m.mesh.position.set(st.x, 0, st.z); m.mesh.rotation.y = st.yaw; m.mesh.visible = m.fade > 0.02; m.mesh.scale.setScalar(Math.max(0.01, m.fade));
        const sw = st.moving ? Math.sin(t * 8 + m.seg.k1) * 0.5 : 0; m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw;
        m.cone.visible = on;
        if (on) updateCone(m, st);
        const dx = p.x - st.x, dz = p.z - st.z, d = Math.hypot(dx, dz);
        const visible = on && !hidden && !blind && game.state === 'playing' && seesAt(m.walls, st, p.x, p.z);
        if (visible) m.seen = Math.min(1, m.seen + dt / (baby() ? 0.95 : 0.55)); else m.seen = Math.max(0, m.seen - dt / 1.4);
        m.bang.visible = m.seen > 0.05; m.bang.scale.setScalar(0.8 + m.seen * 1.2);
        worst = Math.max(worst, m.seen);
        if (m.seen >= 1 && game.state === 'playing') { game.say('hotel.l12.caught', { priority: 2 }); game.kill('seen'); }
        if (on && hidden && hiddenIn && Math.hypot(st.x - hiddenIn.x, st.z - hiddenIn.z) < 1.6 && game.state === 'playing') { game.say('hotel.l12.found', { priority: 2 }); game.kill('found'); }
        // rattling cart (a soft cue) when she is close
        if (on && d < 14) { m.cueT = (m.cueT ?? 0) - dt; if (m.cueT <= 0) { game.audio.step(); m.cueT = d < 7 ? 0.3 : 0.55; } }
      }
      meter = worst;
      if (!hidden) setVig(`radial-gradient(ellipse at center, transparent 40%, rgba(255,40,50,${(meter * 0.9).toFixed(2)}) 100%)`, meter > 0.02 ? 1 : 0);
      if (meter > 0.1 && !seenSaid) { seenSaid = true; game.say('hotel.l12.spotted', { priority: 1 }); }
      if (meter === 0) seenSaid = false;
      if (hidden) {
        hideT += dt;
        const k = game.keys;
        if (hideT > 0.35 && (k.has('KeyW') || k.has('KeyA') || k.has('KeyS') || k.has('KeyD') || k.has('KeyE') || k.has('Space'))) unhide(game);
      }
      // the wax one: step, nothing; she is looking right at you and nothing happens
      if (statue) {
        const s = statue;
        if (!s.said && game.state === 'playing' && seesAt(wallsB, s.st, p.x, p.z)) { s.said = true; w.after(1.6, () => game.say('hotel.l12.wax', { priority: 1 })); }
      }
    });

    // ---- lights out, and the mouse turns round: wing B, north half ---------------------------------------------------------------------------------
    const kMouse = Math.min(MB.path.length - 6, Math.floor(MB.path.length * 0.78));
    const cMouse = MB.path[kMouse];
    twistZone(game, w, { x: MB.cx(cMouse[0]), y: 1.2, z: MB.cz(cMouse[1]), w: C - 1.2, h: 2.4, d: C - 1.2 }, 'mouseX', { sec: 4, say: 'hotel.l12.mirror' });
    let lightsOut = 0;
    w.trigger({ x: MB.cx(cMouse[0]), y: 1.2, z: MB.cz(cMouse[1]), w: C - 1.2, h: 2.4, d: C - 1.2, once: true, resetOnRespawn: true, onEnter: () => { lightsOut = baby() ? 1.5 : 3.2; } });
    const fogOn = { c: new THREE.Color(0x14101a), near: 40, far: 140 };
    w.onUpdate((dt) => {
      lightsOut = Math.max(0, lightsOut - dt);
      const f = w.scene.fog; const k = lightsOut > 0 ? 1 : 0;
      f.near = fogOn.near + (3 - fogOn.near) * k; f.far = fogOn.far + (16 - fogOn.far) * k;
    });

    // ---- a decoy STAIRS in a dead end of the west wing ------------------------------------------------------------------------------------------------
    const distToPath = (M, c) => { const s = new Set([M.key(c)]); let fr = [c], d = 0; while (fr.length) { for (const q of fr) if (M.onPath(q)) return { d, k: M.pathIdx.get(M.key(q)) }; const nx = []; for (const q of fr) for (const r of M.maze.nbrs(q[0], q[1])) if (!s.has(M.key(r))) { s.add(M.key(r)); nx.push(r); } fr = nx; d++; } return { d: 99, k: -1 }; };
    let decoyC = null;
    for (const c of MB.deadEnds) {
      if (carts.some((q) => q.M === MB && q.cell[0] === c[0] && q.cell[1] === c[1])) continue;
      if (statue.cell[0] === c[0] && statue.cell[1] === c[1]) continue;
      const { d, k } = distToPath(MB, c);
      const score = (k >= midB ? 3 : 0) - Math.abs(d - 1.5) * 0.8 + Math.random() * 0.5;
      if (!decoyC || score > decoyC.score) decoyC = { c, score };
    }
    let decoy = null;
    if (decoyC) decoy = { cell: decoyC.c, x: MB.cx(decoyC.c[0]), z: MB.cz(decoyC.c[1]), g: fakeExit(w, game, { x: MB.cx(decoyC.c[0]), y: 0, z: MB.cz(decoyC.c[1]), kind: 'goal', label: 'STAIRS', color: 0x2dd4bf, say: 'hotel.l12.decoy', reason: 'decoy' }) };
    // and a fire door beside the lift that is a broom cupboard
    const closet = fakeExit(w, game, { x: -XW + 0.7, y: 0, z: WATER_N + 3.3, yaw: Math.PI / 2, kind: 'door', label: 'STAIRS', say: 'hotel.l12.closet', reason: 'fake' });
    void closet;

    // ---- checkpoints and stage banners -----------------------------------------------------------------------------------------------------------------------
    const cps = new Map();
    const cp = (i, x, z, y = 0) => { const c = w.checkpoint({ x, y, z, real: true }); cps.set(c, i); return c; };
    cp(1, MA.cx(MA.mid[0]), MA.cz(MA.mid[1]));
    cp(2, L1.body.x, L1.body.z);
    cp(3, lift.cx, lift.cz);
    cp(4, MB.cx(MB.mid[0]), MB.cz(MB.mid[1]));
    cp(5, exitX, ZB1 - 3.6);
    w.hooks.onCheckpoint = (c) => {
      const i = cps.get(c); if (i === undefined) return;
      stageTitle(game, w, i + 1, NAMES.length, NAMES[i]);
      const line = [null, 'hotel.l12.half', 'hotel.l12.laundry', null, 'hotel.l12.halfB', 'hotel.l12.stairs'][i];
      if (line) game.say(line, { priority: 1 });
    };

    // ---- the host ---------------------------------------------------------------------------------------------------------------------------------------------
    const lieA = new Set([5, Math.floor(MA.path.length * 0.45), Math.floor(MA.path.length * 0.75)]);
    const lieB = new Set([Math.floor(MB.path.length * 0.2), Math.floor(MB.path.length * 0.5), Math.floor(MB.path.length * 0.85)]);
    const said = new Set();
    let t0 = 0, intro = false, signSaid = false, decoySaid = false, closetSaid = false, cartSaid = false, lastDead = 0;
    const deadSet = new Set([...MA.deadEnds.map((c) => 'A' + MA.key(c)), ...MB.deadEnds.map((c) => 'B' + MB.key(c))]);
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l12.intro'); g.say('hotel.l12.intro2'); stageTitle(g, w, 1, NAMES.length, NAMES[0]); }
      const p = g.player;
      for (const [M, lies, tag] of [[MA, lieA, 'A'], [MB, lieB, 'B']]) {
        if (!M.inside(p)) continue;
        const [ci, cj] = M.cellOf(p);
        if (!M.grid.inside(ci, cj)) continue;
        const k = M.key([ci, cj]), sk = tag + k;
        if (said.has(sk)) continue;
        said.add(sk);
        const idx = M.pathIdx.get(k);
        if (idx !== undefined && lies.has(idx)) g.say(tag === 'A' ? 'hotel.l12.lie' : 'hotel.l12.lie2', { priority: 1 });
        else if (!cartSaid && carts.some((c) => c.M === M && c.cell[0] === ci && c.cell[1] === cj)) { cartSaid = true; g.say('hotel.l12.cart', { priority: 1 }); }
        else if (deadSet.has(sk) && g.time - lastDead > 30) { lastDead = g.time; g.say('hotel.l12.deadend', { priority: 1 }); }
      }
      if (!signSaid && doorsDND[0] && Math.hypot(p.x - doorsDND[0].M.cx(doorsDND[0].cell[0]), p.z - doorsDND[0].M.cz(doorsDND[0].cell[1])) < 8) { signSaid = true; g.say('hotel.l12.signhint', { priority: 1 }); }
      if (!closetSaid && p.z < WATER_N + 9 && p.z > WATER_N + 1) { closetSaid = true; g.say('hotel.l12.stairspoint', { priority: 1 }); }
      if (!decoySaid && decoy && Math.hypot(p.x - decoy.x, p.z - decoy.z) < 11) { decoySaid = true; g.say('hotel.l12.decoyseen', { priority: 1 }); }
    };
    onPlat(w, K3, () => game.say('hotel.l12.board', { priority: 1 }));
    onPlat(w, PL, () => game.say('hotel.l12.mangle', { priority: 1 }));
    w.hooks.onDeath = (info) => {
      const p = game.player;
      if (['decoy', 'fake', 'seen', 'found'].includes(info.reason)) return true;
      if (info.deaths % 6 === 0) { game.say('hotel.l12.count', { priority: 1, vars: { n: info.deaths } }); return true; }
      if (info.reason === 'hazard' && p.z < WATER_S && p.z > WATER_N) { game.say(presses.some((q) => q.low(w.t) && Math.abs(p.x - q.x) < 2.2 && Math.abs(p.z - q.z) < 2.2) ? 'hotel.l12.press' : 'hotel.l12.vat', { priority: 1 }); return true; }
      return false;
    };

    // ---- the hint: the way out of the wing you are in (honest: the housekeepers are on you, not the hint) -------------------------------------------------------
    sectionHint(w, [
      { zS: 1e9, zN: WATER_S, hint: (p) => MA.hint(p) },
      { zS: WATER_S, zN: ZB + 0.4, flat: false, hint: routeHint(route.slice(1, -1), { x: L2X, y: 0, z: L2Z }) },
      { zS: ZB + 0.4, zN: ZB1 - 0.4, hint: (p) => MB.hint(p) },
      { zS: ZB1 - 0.4, zN: -1e9, hint: (p) => { const e = bonusOn ? finalGoal : firstGoal; return [{ x: p.x, y: 0.2, z: p.z }, { x: e.x, y: 0.2, z: e.z }]; } },
    ]);

    // ---- the bot: it reads the rounds (they are exact), waits, backs off, and goes -----------------------------------------------------------------------------
    const seenBy = (M) => (x, z, t) => maids.some((m) => m.M === M && t >= m.offUntil && seesAt(m.walls, m.round.at(t), x, z, 0.35));
    const risk = (M, pts, speed) => {      // exposed seconds along a polyline (for tests)
      let x = pts[0].x, z = pts[0].z, seg = 1, bad = 0;
      const bd = seenBy(M);
      for (let tau = 0; tau < 4; tau += 0.1) {
        if (bd(x, z, w.t + tau)) bad += 0.1;
        let step = speed * 0.1;
        while (step > 0 && seg < pts.length) { const dx = pts[seg].x - x, dz = pts[seg].z - z, l = Math.hypot(dx, dz); if (l <= step) { x = pts[seg].x; z = pts[seg].z; step -= l; seg++; } else { x += dx / l * step; z += dz / l * step; step = 0; } }
      }
      return bad;
    };
    w.botPlan = (g) => {
      const p = g.player;
      if (g.mods.swapFwd || g.mods.jumpLag || g.mods.invertX) return { x: p.x, z: p.z, wait: true };
      if (p.grounded && p.ground === cart.body) return cart.body.x > cartStop + 0.15 ? { x: cart.body.x, z: cart.body.z, wait: true } : { x: L2X + 0.5, z: ZB + 4.7 };
      if (p.z <= WATER_S && p.z > ZB + 7.0) return null;
      let M = null;
      if (p.z > WATER_S) M = MA;
      else if (p.z < ZB - 0.2 && p.z > ZB1 - 0.4) M = MB;
      else if (p.z < ZB1 - 0.4) { const e = bonusOn ? finalGoal : firstGoal; return { x: e.x, z: e.z }; }
      else if (p.z <= ZB + 7.2) {
        // the lift lobby: walk into the lift, wait for the doors, go through
        if (!lift.ridden) return { x: lift.cx, z: lift.cz + 0.2 };
        if (game.frozen || lift.state === 'loading') return { x: p.x, z: p.z, wait: true };
        return MB.steer(p);
      }
      if (!M) return null;
      return cautiousSteer(M, p, seenBy(M), w.t);
    };

    // ---- test handles ---------------------------------------------------------------------------------------------------------------------------------------------
    w.dnd = {
      maids, carts, maze: MA.maze, path: MA.path, grid: MA.grid, walls: wallsA, MA, MB, statue, lift, doorsDND, presses, vat, firstGoal, finalGoal, decoy, closet, cps, L1, L2, NAMES, cart, cartStop,
      hide: (c) => hide(game, c), unhide: () => unhide(game), seesAt, rayWall, RANGE, HALF, risk,
      get hidden() { return hidden; }, get meter() { return meter; }, set blind(v) { blind = v; }, get blind() { return blind; }, get bonusOn() { return bonusOn; }, get lightsOut() { return lightsOut; }, enableBonus, WATER_S, WATER_N, ZB, ZB1, cMouse, wingOf,
    };
    void hotelHalo; void whiteM;
  },
};

function wallLamp(w, M, i, j) {
  const x = M.cx(i), z = M.cz(j);
  w.box({ x, y: 2.9, z: z + 0.6, w: 0.5, h: 0.22, d: 0.22, glow: 0xffe0b0, glowIntensity: 1.2, shadow: false });
}

// a mangle: a slab that slams down on the machine under it, on a beat. The head is lowering for half a second before it is low enough to matter.
function press(w, plat, dx, { ph = 0, period = 3.4 } = {}) {
  const b = plat.body, x = b.x + dx * 0 , z = b.z + dx;       // (dx runs along the machine)
  const top = plat.top, steel = plainMaterial(0xb8bcc6, { metalness: 0.9, roughness: 0.3 });
  const hz = w.hazard({ x, y: top + 1.3, z, w: 2.6, h: 1.4, d: 2.2, color: 0xff7a3a });
  hz.core.visible = false; hz.shell.visible = false;
  const head = new THREE.Group(); head.position.set(x, 0, z); w.add(head);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.6, 2.3), steel); slab.castShadow = true; head.add(slab);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.12, 2.32), plainMaterial(0xffd21f, { roughness: 0.5 })); stripe.position.y = -0.2; head.add(stripe);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 10), steel); rod.position.y = 2.2; head.add(rod);
  const phase = (t) => (((t + ph) % period) + period) % period;
  // head bottom height over the machine top: up, down (0.5 s), low, up (0.5 s)
  const bottom = (t) => {
    const u = phase(t);
    if (u < 1.5) return 3.0;
    if (u < 2.0) return 3.0 - (u - 1.5) / 0.5 * 2.3;       // lowering: 3.0 → 0.7
    if (u < 2.6) return 0.7;
    if (u < 3.1) return 0.7 + (u - 2.6) / 0.5 * 2.3;
    return 3.0;
  };
  const low = (t) => bottom(t) < 2.1;
  hz.predict = low;
  w.onUpdate((dt, t) => {
    const bt = bottom(t);
    head.position.y = top + bt + 0.3;
    hz.enabled = low(t);
  });
  return { hz, low, x, z };
}
