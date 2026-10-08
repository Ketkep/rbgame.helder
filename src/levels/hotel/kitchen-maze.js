import * as THREE from 'three';
import { plainMaterial, softTexture } from '../../engine/materials.js';
import { roomShell, hotelHalo, GOLD } from './kit.js';
import { Walker } from './mazekit.js';
import { onPlat } from '../common.js';
import { mazeSection, sectionHint, routeHint } from './mazestage.js';
import { fakeExit, trollCheckpoint, twistZone, crash, vanishAfter, stageTitle } from './trolls.js';

// Hotel level 9 — "Kitchen Maze" (Medium · Restaurant). Two kitchens, two mazes (a new random one of each every attempt), a chef after you
// in each, and the pass between them. Both mazes are sealed rooms: the walls run on into the kitchen's side walls.
// Six stages, a checkpoint for each:
//   1 The Freezers   maze A, south half: ice floors, one-way doors, and the chef, who is late (he walks in after a head start)
//   2 Cold Storage   maze A, north half (checkpoint in the middle cell): W and S swap for a moment on the ice
//   3 The Pass       the serving line is a pit of hot oil: counters, a sliding tray, a cutting board, a dish belt that runs the wrong way,
//                    a bridge that gives way, and a trolley that rolls you to the far side
//   4 The Pantry     (the checkpoint on the landing runs out) maze B, dark, the lights flicker, TWO chefs, a "technical difficulty" mid-chase
//   5 Last Orders    maze B, north half: a decoy LOADING DOCK ring in a dead end
//   6 Loading Dock   the real one
// Tricks: the host's confident wrong directions · one-way doors · W/S swap on the ice · the oil that is "shallow" · a belt that runs backwards ·
//   a bridge that leaves · a fake LOADING DOCK door next to the real way in · an expiring checkpoint · crash mid-chase (the chefs wait) ·
//   a decoy exit in the maze · the host cheering for the chef.
// Baby Mode: the chefs are slower and start later, the swap and the expiry are gone, the decoys are labelled, the bridge waits.

const NAMES = ['The Freezers', 'Cold Storage', 'The Pass', 'The Pantry', 'Last Orders', 'Loading Dock'];
const C = 4.4, T = 0.8, WH = 3.6, H = 10;
const NA = 7, NB = 8;
const XW = 25;                       // inner faces of the kitchen's side walls
const ZS = 14;                       // south wall of the kitchen
const ZA = 0, ZA1 = ZA - NA * C;     // maze A: south / north wall lines (-30.8)
const ZB = ZA1 - 44, ZB1 = ZB - NB * C;   // maze B (-74.8 … -110)
const ZE = ZB1 - 16;                 // north wall (the loading dock)
const WATER_S = ZA1 - T / 2, WATER_N = ZB + T / 2;   // the pass: a pit of oil, wall to wall
const rnd = (n) => Math.floor(Math.random() * n);

export default {
  id: 'hotel-9',
  name: 'Kitchen Maze',
  music: 'hotel_kitchen',
  completeQuip: 'You escaped the kitchen. The chef is not angry. He is disappointed, and hungry.',

  build(w, game) {
    w.env({
      top: 0x120a08, horizon: 0x2c2420, bottom: 0x0b0806,
      fog: { color: 0x1c1816, near: 60, far: 200 },
      sun: { color: 0xdde8ff, intensity: 0.3, dir: [0.2, 0.9, 0.3], shadow: false },
      hemi: { sky: 0xe8f0ff, ground: 0x7a6a60, intensity: 1.0 },
      exposure: 0.95, stars: 0,
      bloom: { strength: 0.4, radius: 0.6, threshold: 0.95 },
      motes: { color: 0xdfeaff, count: 140, size: 0.07, opacity: 0.4 },
      envMap: { top: 0xe8f0ff, mid: 0x5a5058, bottom: 0x161214, intensity: 0.4, lights: [{ pos: [0, 10, 0], w: 18, h: 18, color: 0xe8f0ff, intensity: 2.2 }] },
    });
    w.setTheme({ tex: 'tile', color: 0xffffff, trim: null, edge: null, edgeOpacity: 0, roughness: 0.4, metalness: 0, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.killY = -30;
    const baby = () => game.baby;

    roomShell(w, { x0: -XW, x1: XW, z0: ZE, z1: ZS, yb: -4, H, wallTex: 'tile', wallColor: 0xe9eef2, pilasterEvery: 11, lamps: false });
    w.plat({ x: 0, y: -3.5, z: (ZS + ZE) / 2, w: 2 * XW, d: ZS - ZE, h: 1, tex: 'tile', color: 0x2c3036, roughness: 0.9 });

    // ---- the two mazes ----------------------------------------------------------------------------------------------
    const walls = { tex: 'tile', color: 0xf4f8ff, roughness: 0.4, radius: 0.06, reach: [-XW, XW] };
    const MA = mazeSection(w, { N: NA, C, T, WH, Z0: ZA, band: [27, 33], walls });
    const MB = mazeSection(w, { N: NB, C, T, WH, Z0: ZB, band: [37, 43], walls: { ...walls, color: 0xd9e0e8 } });

    // ---- floors: one tile per cell (a third of maze A is freezer ice), the rest plain -----------------------------------
    const iceA = new Set();
    const iceCell = (M, set, i, j) => !(i === 0 && j === 0) && !(i === M.N - 1 && j === M.N - 1) && !set.has(i * M.N + j);
    for (let i = 0; i < NA; i++) for (let j = 0; j < NA; j++) if (iceCell(MA, iceA, i, j) && Math.random() < 0.34) iceA.add(i * NA + j);
    // the swap zone sits on an icy corridor cell on the way out (in the north half)
    const swapK = Math.min(MA.path.length - 4, Math.floor(MA.path.length * 0.72));
    iceA.add(MA.key(MA.path[swapK]));
    const iceB = new Set();
    const plain = (x, z, ww, dd, color = 0xd8dde2) => w.plat({ x, y: 0, z, w: ww, d: dd, h: 1.2, tex: 'tile', color, roughness: 0.45 });
    const cells = (M, set, iceColor) => {
      for (let i = 0; i < M.N; i++) for (let j = 0; j < M.N; j++) {
        const ice = set.has(i * M.N + j);
        w.plat({ x: M.cx(i), y: 0, z: M.cz(j), w: C, d: C, h: 1.2, tex: ice ? 'marble' : 'tile', color: ice ? iceColor : 0xd8dde2, roughness: ice ? 0.06 : 0.45, radius: 0.0, slippery: ice ? 0.88 : 0 });
      }
      const ww = (2 * XW - M.N * C) / 2;
      for (const sx of [-1, 1]) plain(sx * (XW - ww / 2), M.Z0 - (M.N * C) / 2, ww, M.N * C);
    };
    cells(MA, iceA, 0xbfe2ff); cells(MB, iceB, 0xbfe2ff);
    plain(0, (ZS + ZA) / 2, 2 * XW, ZS - ZA);                        // the start yard
    plain(0, (WATER_N + ZE) / 2, 2 * XW, WATER_N - ZE, 0xcfd5db);    // maze B and the loading dock (the maze cells sit on it)
    w.plat({ x: 0, y: -1.4, z: (WATER_S + WATER_N) / 2, w: 2 * XW, d: WATER_S - WATER_N, h: 0.6, tex: 'tile', color: 0x2a1a0a, roughness: 0.4 });   // the fryer's bottom

    // lights: a pool per cell; the lamps over the pass
    const poolMat = new THREE.MeshBasicMaterial({ map: softTexture('glow'), color: 0xdfeaff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const icePool = poolMat.clone(); icePool.color.set(0x8cc8ff); icePool.opacity = 0.22;
    const darkPool = poolMat.clone(); darkPool.color.set(0xffd8a0); darkPool.opacity = 0.18;
    const poolGeo = new THREE.PlaneGeometry(C * 1.6, C * 1.6);
    for (const [M, set, pm] of [[MA, iceA, poolMat], [MB, iceB, darkPool]]) {
      for (let i = 0; i < M.N; i++) for (let j = 0; j < M.N; j++) {
        const m = new THREE.Mesh(poolGeo, set.has(i * M.N + j) ? icePool : pm);
        m.rotation.x = -Math.PI / 2; m.position.set(M.cx(i), 0.02, M.cz(j)); m.matrixAutoUpdate = false; m.updateMatrix(); w.add(m);
        if ((i + j) % 2 === 0) w.box({ x: M.cx(i), y: WH + 0.2, z: M.cz(j), w: 1.6, h: 0.1, d: 0.3, glow: M === MA ? 0xdff4ff : 0xffe0b0, glowIntensity: 1.6, shadow: false });
      }
    }
    for (const [x, z] of [[-8, 4], [8, -12], [-8, -22], [0, -52], [-8, -90], [8, -100]]) w.light(0xe8f0ff, 14, 26, x, 7, z);
    // dressing: freezer signs + frost over the ice, pot racks over some of the others
    const frost = new THREE.SpriteMaterial({ map: softTexture('puff'), color: 0xbfe6ff, transparent: true, opacity: 0.22, depthWrite: false });
    for (let i = 0; i < NA; i++) for (let j = 0; j < NA; j++) {
      const x = MA.cx(i), z = MA.cz(j);
      if (iceA.has(i * NA + j)) {
        w.box({ x, y: 3.0, z, w: 1.6, h: 0.45, d: 0.1, glow: 0x9fd8ff, glowIntensity: 1.4, shadow: false });
        w.sign({ text: 'FREEZER -18°C', x, y: 3.0, z: z + 0.07, w: 1.5, h: 0.4, color: '#06243a', double: true, tw: 512, size: 62 });
        for (let k = 0; k < 2; k++) { const sp = new THREE.Sprite(frost); sp.position.set(x + (k ? 1.0 : -1.0), 0.5, z + (k ? -0.8 : 0.8)); sp.scale.set(3.4, 1.6, 1); w.add(sp); }
      } else if (Math.random() < 0.3) potRack(w, x, z);
    }
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
      const x = MB.cx(i), z = MB.cz(j);
      if (Math.random() < 0.4) potRack(w, x, z);
      else if (Math.random() < 0.3) w.sign({ text: ['FLOUR', 'SUGAR', 'RICE', 'SALT', 'OATS', 'LARD'][rnd(6)], x, y: 2.6, z: z + 0.07, w: 1.3, h: 0.4, color: '#3a2a1a', bg: '#e8d8b8', double: true, tw: 256, size: 70 });
    }

    // ---- entrance, signs ----------------------------------------------------------------------------------------------------
    w.spawn = { x: MA.cx(0), y: 0, z: ZA + 5, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.sign({ text: 'WALK-IN FREEZERS · STAFF ONLY', x: MA.cx(0), y: 5.4, z: ZA + 0.5, w: 6.5, h: 0.9, color: '#cfe9ff', double: true, tw: 1024, size: 54 });
    w.sign({ text: 'THE PASS · HOT OIL · NO RUNNING (RUN)', x: MA.exit.x, y: 5.6, z: WATER_S - 0.2, w: 7, h: 0.9, color: '#ffd21f', bg: '#1a1420', double: true, tw: 1024, size: 44 });
    w.sign({ text: 'DRY STORE · PANTRY', x: MB.cx(0), y: 5.4, z: ZB + 0.5, w: 6.0, h: 0.9, color: '#ffe0b0', double: true, tw: 1024, size: 54 });

    // the pass: a pit of fryer oil wall to wall
    const oil = w.hazard({ x: 0, y: -0.78, z: (WATER_S + WATER_N) / 2, w: 2 * XW, h: 1.3, d: WATER_S - WATER_N, color: 0xc88a2a });
    oil.core.visible = false; oil.shell.visible = false;
    const oilMat = new THREE.MeshStandardMaterial({ color: 0x6a3d0a, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.9, emissive: 0x4a2400, emissiveIntensity: 0.55 });
    const oilMesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * XW, WATER_S - WATER_N), oilMat);
    oilMesh.rotation.x = -Math.PI / 2; oilMesh.position.set(0, -0.15, (WATER_S + WATER_N) / 2); w.add(oilMesh);
    const bubble = new THREE.MeshBasicMaterial({ map: softTexture('puff'), color: 0xffc060, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending });
    const bubbles = [];
    for (let k = 0; k < 16; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), bubble); m.rotation.x = -Math.PI / 2; m.position.set(-XW + 3 + Math.random() * (2 * XW - 6), -0.13, WATER_N + 2 + Math.random() * (WATER_S - WATER_N - 4)); w.add(m); bubbles.push(m); }
    w.onUpdate((dt, t) => { bubbles.forEach((m, k) => { m.rotation.z += dt * (k % 2 ? 0.12 : -0.12); }); oilMat.emissiveIntensity = 0.5 + Math.sin(t * 1.3) * 0.1; });
    // exhaust hoods over the pass
    for (const z of [WATER_S - 9, WATER_S - 21, WATER_S - 33]) {
      w.box({ x: 0, y: 6.4, z, w: 36, h: 0.9, d: 3.4, color: 0x9aa0aa, metal: 0.9, rough: 0.35, shadow: false });
      w.box({ x: 0, y: 5.9, z, w: 36, h: 0.12, d: 2.6, glow: 0xffd8a0, glowIntensity: 1.5, shadow: false });
    }

    // ---- the real exit, and a decoy at the pass -------------------------------------------------------------------------------
    const exitX = MB.cx(NB - 1), exitZ = ZB1 - 9;
    w.sign({ text: 'EXIT', x: exitX, y: 4.4, z: ZB1 - 1.0, w: 4, h: 1.2, color: '#6cf0b2', double: true, tw: 512, size: 100, glow: true });
    w.sign({ text: 'LOADING DOCK', x: exitX, y: 6.4, z: ZE + 1.2, w: 8, h: 1.2, color: '#ffd21f', double: false, tw: 1024, size: 100 });
    for (let k = 0; k < 4; k++) w.box({ x: exitX - 6 + k * 4, y: 2.6, z: ZE + 0.3, w: 3.6, h: 5.2, d: 0.2, color: 0x9aa0aa, metal: 0.8, rough: 0.4 });   // roll-up shutters
    const goal = w.goal({ x: exitX, y: 0, z: exitZ, color: GOLD, onReach: () => { game.say('hotel.l9.done', { priority: 2 }); game.completeLevel(); } });

    // ---- one-way swing doors (maze A, on the way out: no going back) ---------------------------------------------------------------
    const doors = [];
    const doorAt = (M, a, b) => {
      const mx = (M.cx(a[0]) + M.cx(b[0])) / 2, mz = (M.cz(a[1]) + M.cz(b[1])) / 2, ew = a[0] !== b[0];
      const dirx = Math.sign(M.cx(b[0]) - M.cx(a[0])), dirz = Math.sign(M.cz(b[1]) - M.cz(a[1]));
      const body = w.collider({ x: mx, y: WH / 2, z: mz, w: ew ? T * 0.9 : C - T + 0.2, h: WH, d: ew ? C - T + 0.2 : T * 0.9 });
      body.enabled = false;
      const g = new THREE.Group(); g.position.set(mx, 0, mz); g.rotation.y = ew ? Math.PI / 2 : 0;
      const steel = plainMaterial(0xc9ced6, { metalness: 0.9, roughness: 0.3 });
      for (const sx of [-1, 1]) {
        const flap = new THREE.Mesh(new THREE.BoxGeometry((C - T) / 2 - 0.05, 2.6, 0.08), steel); flap.position.set(sx * ((C - T) / 4), 1.5, 0); flap.castShadow = true; g.add(flap);
        const win = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), plainMaterial(0x1a2a3a, { roughness: 0.1, metalness: 0.5 })); win.position.set(sx * ((C - T) / 4), 1.9, 0.045); g.add(win);
        const win2 = win.clone(); win2.position.z = -0.045; win2.rotation.y = Math.PI; g.add(win2);
      }
      w.add(g);
      w.sign({ text: 'ONE WAY', x: mx, y: 3.0, z: mz, w: 1.8, h: 0.5, rotY: ew ? Math.PI / 2 : 0, color: '#ffd21f', double: true, tw: 256, size: 50 });
      const d = { a, b, body, mx, mz, dirx, dirz };
      doors.push(d); return d;
    };
    const midA = MA.path.length >> 1;
    for (const f of [0.18, 0.4, 0.82]) {
      const k = Math.max(2, Math.min(MA.path.length - 3, Math.round(f * (MA.path.length - 1))));
      if (Math.abs(k - midA) > 1 && k !== swapK && !doors.some((d) => d.a === MA.path[k])) doorAt(MA, MA.path[k], MA.path[k + 1]);
    }
    while (doors.length < 3) { const k = 2 + rnd(MA.path.length - 5); if (Math.abs(k - midA) > 1 && k !== swapK && !doors.some((d) => d.a === MA.path[k])) doorAt(MA, MA.path[k], MA.path[k + 1]); }
    w.onUpdate(() => {
      const p = game.player;
      for (const d of doors) { const along = (p.x - d.mx) * d.dirx + (p.z - d.mz) * d.dirz; d.body.enabled = along > 1.0; }
    });
    // the swap zone (W and S trade places for a few seconds, on the ice)
    const sc = MA.path[swapK];
    twistZone(game, w, { x: MA.cx(sc[0]), y: 1.2, z: MA.cz(sc[1]), w: C - 1.2, h: 2.4, d: C - 1.2 }, 'fwd', { sec: 3.2, say: 'hotel.l9.fwd' });

    // ---- the pass: counters over the oil (the bot follows these in order) -------------------------------------------------------
    const route = [];
    const mark = (p) => { p.o.path = true; route.push({ x: p.body.x, y: p.top, z: p.body.z }); return p; };
    const zu = (u) => WATER_S - u;
    const counter = (x, u, top, s = 2.4, d = s) => {
      const p = w.plat({ x, y: top, z: zu(u), w: s, d, h: top + 1.4, tex: 'metal', color: 0xc9ced6, roughness: 0.3, metalness: 0.8, radius: 0.06 });
      return p;
    };
    const L1 = mark(w.plat({ x: MA.exit.x, y: 0, z: WATER_S - 2.2, w: 5, d: 4.4, h: 1.4, tex: 'tile', color: 0xd8dde2, roughness: 0.45 }));
    mark(counter(9.6, 7.2, 0.35));
    const K2 = mark(counter(6.0, 10.5, 0.5, 2.4));
    w.mover(K2, (t) => ({ x: 1.4 * Math.sin(t * 1.0) }));
    const K3 = mark(w.crumble(counter(2.6, 14.0, 0.6, 2.2), { delay: 0.65, gone: 3 }));
    const belt = mark(counter(-0.4, 20.5, 0.6, 2.6, 7.5));
    w.conveyor(belt, { vz: 2.2 });          // toward the start: against you (the arrows say so)
    const K4 = mark(counter(-3.8, 27.0, 0.7, 2.4));
    const V = mark(w.plat({ x: -6.6, y: 0.7, z: zu(33), w: 1.8, d: 7.2, h: 0.3, tex: 'metal', color: 0xdfe3e8, roughness: 0.3, metalness: 0.8, radius: 0.1 }));
    vanishAfter(w, game, V, { axis: 'z', dir: -1, frac: 0.55, delay: 0.75, back: 3.2, say: 'hotel.l9.bridge' });
    // the trolley on a rail: rolls to the landing with you on it
    const L2X = -18.9, L2Z = WATER_N + 2.4, L2W = 12, L2E = L2X + L2W / 2;
    const cartZ = WATER_N + 4.2, cart0 = -6.6, cartStop = L2E + 1.1;
    const cart = mark(w.plat({ x: cart0, y: 0.7, z: cartZ, w: 2.2, d: 1.6, h: 0.1, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.03 }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      cart.attach(w.box({ x: cart0 + sx * 1.0, y: 1.35, z: cartZ + sz * 0.7, w: 0.08, h: 1.2, d: 0.08, color: GOLD, metal: 1, rough: 0.28, static: false }));
      cart.attach(w.box({ x: cart0 + sx * 0.9, y: 0.46, z: cartZ + sz * 0.7, w: 0.22, h: 0.22, d: 0.12, color: 0x14141a, rough: 0.5, static: false }));
    }
    cart.attach(w.box({ x: cart0, y: 1.95, z: cartZ, w: 2.1, h: 0.06, d: 0.06, color: GOLD, metal: 1, rough: 0.3, static: false }));
    for (const sz of [-0.55, 0.55]) w.box({ x: (cart0 + cartStop) / 2, y: 0.3, z: cartZ + sz, w: cartStop - cart0 + 3, h: 0.08, d: 0.1, color: 0x8a7a50, metal: 1, rough: 0.4, shadow: false });
    for (let x = cart0 + 1; x > cartStop - 2; x -= 2.2) w.box({ x, y: -0.5, z: cartZ, w: 0.25, h: 1.6, d: 1.3, color: 0x4a4a52, rough: 0.6, shadow: false });
    w.rollaway(cart, { dir: [-1, 0], dist: cart0 - cartStop, accel: 2.4, speed: 3.0, delay: 0.5, hold: 3.2, back: 1.6, onGo: () => game.say('hotel.l9.trolley', { priority: 1 }) });
    const L2 = mark(w.plat({ x: L2X, y: 0, z: L2Z, w: L2W, d: 4.8, h: 1.4, tex: 'tile', color: 0xd8dde2, roughness: 0.45 }));
    // the fake LOADING DOCK: a shutter door beside the landing. It is a closet. With no floor.
    const dockDoor = fakeExit(w, game, { x: -22.6, y: 0, z: WATER_N + 0.9, kind: 'door', label: 'LOADING DOCK', say: 'hotel.l9.docklie', reason: 'fake' });
    void dockDoor;
    void K4; void K3; void belt;

    // ---- the chefs ----------------------------------------------------------------------------------------------------------------
    const vig = document.createElement('div');
    vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:6;opacity:0;transition:opacity 120ms;background:radial-gradient(ellipse at center, transparent 45%, rgba(255,40,50,0.8) 100%)';
    document.body.appendChild(vig);
    w.onDispose(() => vig.remove());
    const chefs = [];
    const makeChef = (M, { speed, ramp = 0.02, max = 4.7, delay, redelay, zone, scale = 1.05, apron = 0xdadad0, hat = 0xf6f6f2, label }) => {
      const mesh = chefMesh(scale, apron, hat); w.add(mesh.group);
      const c = { M, wk: new Walker(M.maze, M.grid, { speed, mode: 'chase', start: [0, 0] }), mesh, speed, ramp, max, delay, redelay, zone, t0: null, running: false, near: false, spotted: false, step: 0, label, d: 99 };
      chefs.push(c); return c;
    };
    const chefA = makeChef(MA, { speed: 3.3, delay: 9, redelay: 6, zone: (p) => p.z > ZA1 - 3 && p.z < ZS, label: 'A' });
    const chefB = makeChef(MB, { speed: 3.3, delay: 7, redelay: 5, zone: (p) => p.z < ZB + 1.2 && p.z > ZB1 - 3, scale: 0.95, apron: 0xe6b8c8, hat: 0xf4e6ee, label: 'B' });
    const chefC = makeChef(MB, { speed: 3.0, delay: 24, redelay: 18, zone: (p) => p.z < ZB + 1.2 && p.z > ZB1 - 3, scale: 1.15, apron: 0x6a7a8a, hat: 0xe0e4ea, label: 'C' });
    let secondSaid = false;
    const resetChefs = (re) => {
      for (const c of chefs) { c.wk.teleport([0, 0]); c.t0 = null; c.running = false; c.near = false; c.spotted = false; c.dly = re ? c.redelay : c.delay; c.wk.speed = c.speed; }
    };
    resetChefs(false);
    w.onRespawn(() => { resetChefs(true); vig.style.opacity = '0'; });
    w.onUpdate((dt, t) => {
      const p = game.player;
      let worst = 99;
      for (const c of chefs) {
        const inZone = game.state === 'playing' && c.zone(p);
        if (inZone && c.t0 === null) c.t0 = t;
        c.running = inZone && t - c.t0 > (c.dly ?? c.delay);
        c.mesh.group.visible = (c.running || (inZone && t - c.t0 > (c.dly ?? c.delay) - 2)) && c.zone(p);
        if (c.running) {
          c.wk.speed = Math.min(c.max, c.speed + (t - c.t0 - (c.dly ?? c.delay)) * c.ramp) * (baby() ? 0.8 : 1);
          c.wk.update(dt, p);
          if (!c.spotted) { c.spotted = true; game.say(c.label === 'C' ? 'hotel.l9.second' : 'hotel.l9.go', { priority: 1 }); if (c.label === 'C') secondSaid = true; }
          const d = Math.hypot(c.wk.x - p.x, c.wk.z - p.z); c.d = d;
          if (d < 0.95 && Math.abs(p.y) < 2.0) { game.say('hotel.l9.caught', { priority: 2 }); game.kill('chef'); }
          if (!c.near && d < 9) { c.near = true; game.say(Math.random() < 0.4 ? 'hotel.l9.cheer' : 'hotel.l9.near', { priority: 1 }); }
          if (d > 14) c.near = false;
          if (d < 16) { c.step -= dt; if (c.step <= 0) { game.audio.step(); c.step = d < 7 ? 0.28 : 0.45; } }
          worst = Math.min(worst, d);
        } else c.d = 99;
        const m = c.mesh;
        m.group.position.set(c.wk.x, 0, c.wk.z); m.group.rotation.y = c.wk.yaw;
        const sw = c.wk.moving ? Math.sin(t * 9) * 0.6 : 0;
        m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw; m.armL.rotation.x = -sw * 0.6; m.armR.rotation.x = -1.1 + sw * 0.2;
      }
      vig.style.opacity = worst < 9 ? String(Math.min(0.75, (9 - worst) / 9)) : '0';   // the tell: the edges of the screen go red when a chef is close
    });
    void secondSaid;

    // ---- the pantry: dark, and the lights flicker ------------------------------------------------------------------------------------
    const fogN = { c: new THREE.Color(0x1c1816), near: 60, far: 200 }, fogD = { c: new THREE.Color(0x120d0a), near: 4, far: 30 };
    let dusk = 0, flick = 0, nextFlick = 6 + Math.random() * 4;
    w.onUpdate((dt, t) => {
      const want = game.player.z < ZB + 6 && game.player.z > ZB1 - 2 ? 1 : 0;
      dusk += Math.max(-dt * 0.6, Math.min(dt * 0.6, want - dusk));
      nextFlick -= dt * (dusk > 0.5 ? 1 : 0);
      if (nextFlick <= 0) { flick = 0.55; nextFlick = 7 + Math.random() * 5; }
      flick = Math.max(0, flick - dt);
      const dip = flick > 0 ? 0.35 + 0.65 * Math.abs(Math.sin(flick * 22)) : 1;
      const f = w.scene.fog; f.near = fogN.near + (fogD.near - fogN.near) * dusk; f.far = (fogN.far + (fogD.far - fogN.far) * dusk) * (1 - dusk + dusk * dip); f.color.copy(fogN.c).lerp(fogD.c, dusk);
      w.scene.background.copy(f.color);
      darkPool.opacity = 0.18 * dip;
    });

    // ---- the pantry's "technical difficulty": the world freezes (chefs too), then carries on ------------------------------------------------------
    const crashK = Math.max(3, Math.min(MB.path.length - 4, Math.floor(MB.path.length * 0.3)));
    const crashC = MB.path[crashK === (MB.path.length >> 1) ? crashK - 1 : crashK];
    w.trigger({ x: MB.cx(crashC[0]), y: 1.2, z: MB.cz(crashC[1]), w: C - 1.4, h: 2.4, d: C - 1.4, once: true, onEnter: () => crash(game, w, { sec: 3, say: 'hotel.l9.crash', sayAfter: 'hotel.l9.crashback' }) });

    // ---- maze B tricks: the decoy LOADING DOCK in a dead end -----------------------------------------------------------------------------------
    const distToPath = (M, c) => { const s = new Set([M.key(c)]); let fr = [c], d = 0; while (fr.length) { for (const q of fr) if (M.onPath(q)) return { d, k: M.pathIdx.get(M.key(q)) }; const nx = []; for (const q of fr) for (const r of M.maze.nbrs(q[0], q[1])) if (!s.has(M.key(r))) { s.add(M.key(r)); nx.push(r); } fr = nx; d++; } return { d: 99, k: -1 }; };
    const midB = MB.path.length >> 1;
    let decoyC = null;
    for (const c of MB.deadEnds) {
      const { d, k } = distToPath(MB, c);
      const score = (k >= midB ? 3 : 0) - Math.abs(d - 1.5) * 0.8 + Math.random() * 0.5;
      if (!decoyC || score > decoyC.score) decoyC = { c, score };
    }
    let decoy = null;
    if (decoyC) decoy = { cell: decoyC.c, x: MB.cx(decoyC.c[0]), z: MB.cz(decoyC.c[1]), g: fakeExit(w, game, { x: MB.cx(decoyC.c[0]), y: 0, z: MB.cz(decoyC.c[1]), kind: 'goal', label: 'LOADING DOCK', color: 0x2dd4bf, say: 'hotel.l9.decoy', reason: 'decoy' }) };

    // ---- checkpoints and stage banners -------------------------------------------------------------------------------------------------------------
    const cps = new Map();
    const cp = (i, x, z, y = 0) => { const c = w.checkpoint({ x, y, z, real: true }); cps.set(c, i); return c; };
    cp(1, MA.cx(MA.mid[0]), MA.cz(MA.mid[1]));
    cp(2, L1.body.x, L1.body.z);
    const cp3 = trollCheckpoint(w, game, { x: -14.2, y: 0, z: L2Z, mode: 'expire', ttl: 35, say: 'hotel.l9.cpexp' });
    cps.set(cp3, 3);
    cp(4, MB.cx(MB.mid[0]), MB.cz(MB.mid[1]));
    cp(5, exitX, ZB1 - 3.6);
    w.hooks.onCheckpoint = (c) => {
      const i = cps.get(c); if (i === undefined) return;
      stageTitle(game, w, i + 1, NAMES.length, NAMES[i]);
      const line = [null, 'hotel.l9.half', 'hotel.l9.pass', 'hotel.l9.pantry', 'hotel.l9.halfB', 'hotel.l9.last'][i];
      if (line) game.say(line, { priority: 1 });
    };

    // ---- the host ------------------------------------------------------------------------------------------------------------------------------------
    const lieA = new Set([4, Math.floor(MA.path.length * 0.4), Math.floor(MA.path.length * 0.7)]);
    const lieB = new Set([Math.floor(MB.path.length * 0.25), Math.floor(MB.path.length * 0.6), Math.floor(MB.path.length * 0.85)]);
    const said = new Set();
    let t0 = 0, intro = false, oneSaid = false, iceSaid = false, decoySaid = false, dockSaid = false, darkSaid = false, lastDead = 0;
    const deadB = new Set(MB.deadEnds.map(MB.key));
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l9.intro'); g.say('hotel.l9.intro2'); stageTitle(g, w, 1, NAMES.length, NAMES[0]); }
      const p = g.player;
      for (const [M, lies, tag, ice] of [[MA, lieA, 'A', iceA], [MB, lieB, 'B', iceB]]) {
        if (!M.inside(p)) continue;
        const [ci, cj] = M.cellOf(p);
        if (!M.grid.inside(ci, cj)) continue;
        const k = M.key([ci, cj]), sk = tag + k;
        if (said.has(sk)) continue;
        said.add(sk);
        const idx = M.pathIdx.get(k);
        if (idx !== undefined && lies.has(idx)) g.say(tag === 'A' ? 'hotel.l9.lie' : 'hotel.l9.lie2', { priority: 1 });
        else if (ice.has(k) && !iceSaid) { iceSaid = true; g.say('hotel.l9.ice', { priority: 1 }); }
        else if (tag === 'B' && deadB.has(k) && g.time - lastDead > 25) { lastDead = g.time; g.say('hotel.l9.deadend', { priority: 1 }); }
      }
      if (!oneSaid) for (const d of doors) if (Math.hypot(p.x - d.mx, p.z - d.mz) < 6) { oneSaid = true; g.say('hotel.l9.oneway', { priority: 1 }); break; }
      if (!dockSaid && p.z < WATER_N + 6 && p.z > WATER_N - 1) { dockSaid = true; g.say('hotel.l9.dock', { priority: 1 }); }
      if (!darkSaid && p.z < ZB - 3 && p.z > ZB - 12) { darkSaid = true; g.say('hotel.l9.dark', { priority: 1 }); }
      if (!decoySaid && decoy && Math.hypot(p.x - decoy.x, p.z - decoy.z) < 11) { decoySaid = true; g.say('hotel.l9.decoyseen', { priority: 1 }); }
    };
    onPlat(w, K3, () => game.say('hotel.l9.board', { priority: 1 }));
    onPlat(w, belt, () => game.say('hotel.l9.belt', { priority: 1 }));
    w.hooks.onDeath = (info) => {
      const p = game.player;
      if (info.reason === 'decoy' || info.reason === 'fake' || info.reason === 'chef') return true;   // (they already said their piece)
      if (info.deaths % 6 === 0) { game.say('hotel.l9.count', { priority: 1, vars: { n: info.deaths } }); return true; }
      if (p.z < WATER_S && p.z > WATER_N && p.y < 0.5) { game.say('hotel.l9.oil', { priority: 1 }); return true; }
      return false;
    };

    // ---- hint: the way out of the maze you are in, or along the pass --------------------------------------------------------------------------------------
    sectionHint(w, [
      { zS: 1e9, zN: WATER_S, hint: (p) => MA.hint(p) },
      { zS: WATER_S, zN: ZB + 0.4, flat: false, hint: routeHint(route.slice(1, -1), { x: -18.9, y: 0, z: L2Z }) },
      { zS: ZB + 0.4, zN: ZB1 - 0.4, hint: (p) => MB.hint(p) },
      { zS: ZB1 - 0.4, zN: -1e9, hint: routeHint([{ x: exitX, y: 0.1, z: ZB1 - 3 }], { x: exitX, y: 0.1, z: exitZ }) },
    ]);

    // ---- the bot: maze steering, the pass's platforms (the default), the trolley, and standing still while the controls are swapped ------------------------------
    w.botPlan = (g) => {
      const p = g.player;
      if (g.mods.swapFwd) return { x: p.x, z: p.z, wait: true };
      if (p.z > WATER_S) return MA.steer(p);
      if (p.grounded && p.ground === cart.body) return cart.body.x > cartStop + 0.15 ? { x: cart.body.x, z: cart.body.z, wait: true } : { x: L2X, z: L2Z };
      if (p.z > L2Z + 2.4 || (p.x > L2E && p.z > WATER_N)) return null;
      if (p.z < ZB1 - 0.4) return { x: exitX, z: exitZ };
      return MB.steer(p);
    };

    // ---- test handles (tools/test-floors.mjs) ----------------------------------------------------------------------------------------------------------------
    w.maze = { path: MA.path, N: NA, C, X0: MA.X0, Z0: ZA, grid: MA.grid, cx: MA.cx, cz: MA.cz, doors, ice: iceA, chef: chefA.wk, maze: MA.maze, solve: MA.solve, cellOf: MA.cellOf };
    w.l9 = { MA, MB, chefs, chefA, chefB, chefC, doors, iceA, iceB, oil, cart, cartStop, route, cps, goal, L1, L2, NAMES, decoy, dockDoor, swapK, crashC, belt, WATER_S, WATER_N, cp3, fogD, get dusk() { return dusk; } };
    void hotelHalo;
  },
};

function potRack(w, x, z) {
  w.box({ x, y: 3.25, z, w: 2.4, h: 0.07, d: 0.07, color: 0x8a8d95, metal: 0.9, rough: 0.4, shadow: false });
  for (let k = 0; k < 3; k++) { const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.07, 12), plainMaterial(0x30323a, { metalness: 0.9, roughness: 0.35 })); pan.rotation.x = Math.PI / 2; pan.position.set(x - 0.8 + k * 0.8, 2.9, z); w.add(pan); }
}

// a chef: whites, a tall hat, a big knife
function chefMesh(scale, apronColor, hatColor) {
  const group = new THREE.Group();
  const white = plainMaterial(0xf6f6f2, { roughness: 0.6 }), dark = plainMaterial(0x23232b, { roughness: 0.5 });
  const legs = [];
  for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 0.32), dark); leg.position.set(sx * 0.22, 0.48, 0); leg.geometry.translate(0, -0.1, 0); group.add(leg); legs.push(leg); }
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 1.1, 16), white); torso.position.y = 1.55; torso.castShadow = true; group.add(torso);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.06), plainMaterial(apronColor, { roughness: 0.8 })); apron.position.set(0, 1.4, -0.52); group.add(apron);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), plainMaterial(0xe6c0a0, { roughness: 0.6 })); head.position.y = 2.38; group.add(head);
  const hatM = plainMaterial(hatColor, { roughness: 0.6 });
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.55, 14), hatM); hat.position.y = 2.88; group.add(hat);
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), hatM); puff.position.y = 3.2; puff.scale.y = 0.7; group.add(puff);
  const stache = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.07), dark); stache.position.set(0, 2.3, -0.3); group.add(stache);
  for (const sx of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), plainMaterial(0x111111)); eye.position.set(sx * 0.12, 2.45, -0.29); group.add(eye); const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), dark); brow.position.set(sx * 0.12, 2.55, -0.28); brow.rotation.z = sx * 0.4; group.add(brow); }
  const armR = new THREE.Group(); armR.position.set(0.62, 1.95, 0); group.add(armR);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), white); arm.position.y = -0.35; armR.add(arm);
  const cleaver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.5), plainMaterial(0xd8dce4, { metalness: 1, roughness: 0.2 })); cleaver.position.set(0, -1.0, -0.2); armR.add(cleaver);
  armR.rotation.x = -1.1;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), white); armL.position.set(-0.62, 1.6, 0); group.add(armL);
  group.scale.setScalar(scale);
  group.visible = false;
  return { group, legs, armL, armR };
}
