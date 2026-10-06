import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture } from '../../engine/materials.js';
import { roomShell, hotelHalo, GOLD } from './kit.js';
import { generateMaze, solveMaze, mazeGrid, buildMazeWalls, Walker } from './mazekit.js';

// Hotel level 9 — "Kitchen Maze" (Medium · Restaurant). A maze of walk-in freezers (icy floors), one-way swing doors and a
// chef who hunts you through it. A new random maze every attempt. He starts at the entrance after a head start and is
// slower than you; dead ends are where chefs get their reputation.

const N = 8, C = 4.4, T = 0.8, WH = 3.6, Z0 = 8, H = 10;
const grid = mazeGrid({ N, C, T, WH, Z0 });
const { cx, cz } = grid;
const rnd = (n) => Math.floor(Math.random() * n);

export default {
  id: 'hotel-9',
  name: 'Kitchen Maze',
  music: 'hotel',
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

    const maze = generateMaze(N);
    const path = solveMaze(maze, [0, 0]);
    const pathIdx = new Map(path.map((c, k) => [c[0] * N + c[1], k]));
    const W = N * C + 14, zNear = Z0 + 14, zFar = Z0 - N * C - 16;
    roomShell(w, { x0: -W / 2, x1: W / 2, z0: zFar, z1: zNear, yb: -4, H, wallTex: 'tile', wallColor: 0xe9eef2, pilasterEvery: 11, lamps: false });
    w.plat({ x: 0, y: -3.5, z: (zNear + zFar) / 2, w: W, d: zNear - zFar, h: 1, tex: 'tile', color: 0x2c3036, roughness: 0.9 });

    // ---- floor: one tile per cell; about a third are freezers (ice) ---------------------------------------------------
    const ice = new Set();
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (!(i === 0 && j === 0) && !(i === N - 1 && j === N - 1) && Math.random() < 0.32) ice.add(i * N + j);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const isIce = ice.has(i * N + j);
      w.plat({ x: cx(i), y: 0, z: cz(j), w: C, d: C, h: 1.2, tex: isIce ? 'marble' : 'tile', color: isIce ? 0xbfe2ff : 0xd8dde2, roughness: isIce ? 0.06 : 0.45, radius: 0.0, slippery: isIce ? 0.88 : 0 });
    }
    // the rest of the floor (entrance yard + loading dock)
    w.plat({ x: 0, y: 0, z: (zNear + Z0 - 0.4) / 2, w: W, d: zNear - Z0 + 0.4, h: 1.2, tex: 'tile', color: 0xd8dde2, roughness: 0.45 });
    w.plat({ x: 0, y: 0, z: (zFar + (Z0 - N * C + 0.4)) / 2, w: W, d: (Z0 - N * C + 0.4) - zFar, h: 1.2, tex: 'tile', color: 0xd8dde2, roughness: 0.45 });
    for (const sx of [-1, 1]) {   // side strips so nothing is a cliff
      w.plat({ x: sx * ((W / 2 + N * C / 2) / 2), y: 0, z: Z0 - (N * C) / 2, w: W / 2 - N * C / 2, d: N * C, h: 1.2, tex: 'tile', color: 0xd8dde2, roughness: 0.45 });
    }
    buildMazeWalls(w, maze, grid, { tex: 'tile', color: 0xf4f8ff, roughness: 0.4, radius: 0.06 });
    // steel cap on the walls + stainless trim
    // lights: strips above the maze + a pool of light per cell
    const poolMat = new THREE.MeshBasicMaterial({ map: softTexture('glow'), color: 0xdfeaff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const icePool = new THREE.MeshBasicMaterial({ map: softTexture('glow'), color: 0x8cc8ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(C * 1.6, C * 1.6), ice.has(i * N + j) ? icePool : poolMat);
      m.rotation.x = -Math.PI / 2; m.position.set(cx(i), 0.02, cz(j)); m.matrixAutoUpdate = false; m.updateMatrix(); w.add(m);
      if ((i + j) % 2 === 0) { w.box({ x: cx(i), y: WH + 0.2, z: cz(j), w: 1.6, h: 0.1, d: 0.3, glow: 0xdff4ff, glowIntensity: 1.6, shadow: false }); }
    }
    for (const [x, z] of [[-8, 2], [8, -10], [-8, -18], [8, -26]]) w.light(0xe8f0ff, 14, 26, x, 7, z);
    // dressing: freezer signs + frost over the ice cells, hanging pot racks over some of the others
    const frost = new THREE.SpriteMaterial({ map: softTexture('puff'), color: 0xbfe6ff, transparent: true, opacity: 0.22, depthWrite: false });
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = cx(i), z = cz(j);
      if (ice.has(i * N + j)) {
        w.box({ x, y: 3.0, z, w: 1.6, h: 0.45, d: 0.1, glow: 0x9fd8ff, glowIntensity: 1.4, shadow: false });
        w.sign({ text: 'FREEZER -18°C', x, y: 3.0, z: z + 0.07, w: 1.5, h: 0.4, color: '#06243a', double: true, tw: 512, size: 62 });
        for (let k = 0; k < 2; k++) { const sp = new THREE.Sprite(frost); sp.position.set(x + (k ? 1.0 : -1.0), 0.5, z + (k ? -0.8 : 0.8)); sp.scale.set(3.4, 1.6, 1); w.add(sp); }
      } else if (Math.random() < 0.35) {
        w.box({ x, y: 3.25, z, w: 2.4, h: 0.07, d: 0.07, color: 0x8a8d95, metal: 0.9, rough: 0.4, shadow: false });
        for (let k = 0; k < 3; k++) { const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.07, 12), plainMaterial(0x30323a, { metalness: 0.9, roughness: 0.35 })); pan.rotation.x = Math.PI / 2; pan.position.set(x - 0.8 + k * 0.8, 2.9, z); w.add(pan); }
      }
    }

    // ---- entrance, exit ----------------------------------------------------------------------------------------------------
    w.spawn = { x: cx(0), y: 0, z: Z0 + 5, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.sign({ text: 'WALK-IN FREEZERS · STAFF ONLY', x: cx(0), y: 5.4, z: Z0 + 0.5, w: 6.5, h: 0.9, color: '#cfe9ff', double: true, tw: 1024, size: 54 });
    const exitX = cx(N - 1), exitZ = Z0 - N * C - 6;
    w.sign({ text: 'EXIT', x: exitX, y: 4.4, z: Z0 - N * C - 1.0, w: 4, h: 1.2, color: '#6cf0b2', double: true, tw: 512, size: 100, glow: true });
    w.sign({ text: 'LOADING DOCK', x: exitX, y: 6.0, z: zFar + 1.2, w: 8, h: 1.2, color: '#ffd21f', double: false, tw: 1024, size: 100 });
    w.goal({ x: exitX, y: 0, z: exitZ, color: GOLD, onReach: () => { game.say('hotel.l9.done', { priority: 2 }); game.completeLevel(); } });

    // ---- one-way swing doors (on the way out, so there is no going back) ------------------------------------------------
    const doors = [];
    const doorAt = (a, b) => {
      const mx = (cx(a[0]) + cx(b[0])) / 2, mz = (cz(a[1]) + cz(b[1])) / 2, ew = a[0] !== b[0];
      const dirx = Math.sign(cx(b[0]) - cx(a[0])), dirz = Math.sign(cz(b[1]) - cz(a[1]));
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
      const arrow = w.sign({ text: 'ONE WAY', x: mx, y: 3.0, z: mz, w: 1.8, h: 0.5, rotY: ew ? Math.PI / 2 : 0, color: '#ffd21f', double: true, tw: 256, size: 50 });
      void arrow;
      const d = { a, b, body, mx, mz, dirx, dirz };
      doors.push(d); return d;
    };
    for (const f of [0.25, 0.5, 0.75]) {
      const k = Math.max(2, Math.min(path.length - 3, Math.round(f * (path.length - 1))));
      if (!doors.some((d) => d.a === path[k])) doorAt(path[k], path[k + 1]);
    }
    w.onUpdate(() => {
      const p = game.player;
      for (const d of doors) {
        const along = (p.x - d.mx) * d.dirx + (p.z - d.mz) * d.dirz;   // >0: on the far side
        d.body.enabled = along > 1.0;
      }
    });

    // ---- the chef ---------------------------------------------------------------------------------------------------------
    const chef = new Walker(maze, grid, { speed: 3.3, mode: 'chase', start: [0, 0] });
    const chefMesh = new THREE.Group(); w.add(chefMesh);
    const white = plainMaterial(0xf6f6f2, { roughness: 0.6 }), dark = plainMaterial(0x23232b, { roughness: 0.5 });
    const legs = [];
    for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 0.32), dark); leg.position.set(sx * 0.22, 0.48, 0); leg.geometry.translate(0, -0.1, 0); chefMesh.add(leg); legs.push(leg); }
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 1.1, 16), white); torso.position.y = 1.55; torso.castShadow = true; chefMesh.add(torso);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.06), plainMaterial(0xdadad0, { roughness: 0.8 })); apron.position.set(0, 1.4, -0.52); chefMesh.add(apron);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), plainMaterial(0xe6c0a0, { roughness: 0.6 })); head.position.y = 2.38; chefMesh.add(head);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.55, 14), white); hat.position.y = 2.88; chefMesh.add(hat);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), white); puff.position.y = 3.2; puff.scale.y = 0.7; chefMesh.add(puff);
    const stache = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.07), dark); stache.position.set(0, 2.3, -0.3); chefMesh.add(stache);
    for (const sx of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), plainMaterial(0x111111)); eye.position.set(sx * 0.12, 2.45, -0.29); chefMesh.add(eye); const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), dark); brow.position.set(sx * 0.12, 2.55, -0.28); brow.rotation.z = sx * 0.4; chefMesh.add(brow); }
    const armR = new THREE.Group(); armR.position.set(0.62, 1.95, 0); chefMesh.add(armR);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), white); arm.position.y = -0.35; armR.add(arm);
    const cleaver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.5), plainMaterial(0xd8dce4, { metalness: 1, roughness: 0.2 })); cleaver.position.set(0, -1.0, -0.2); armR.add(cleaver);
    armR.rotation.x = -1.1;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), white); armL.position.set(-0.62, 1.6, 0); chefMesh.add(armL);
    chefMesh.scale.setScalar(1.05);
    let startT = 0, delay = 9, stepT = 0, near = false, spotted = false;
    const resetChef = (d) => { chef.teleport([0, 0]); startT = w.t; delay = d; near = false; spotted = false; chef.speed = 3.3; };
    resetChef(9);
    w.onRespawn(() => resetChef(6));
    w.onUpdate((dt, t) => {
      const p = game.player;
      const running = t - startT > delay && game.state === 'playing';
      if (running) {
        chef.speed = Math.min(4.7, 3.3 + (t - startT - delay) * 0.02) * (game.baby ? 0.82 : 1);
        chef.update(dt, p);
        if (!spotted) { spotted = true; game.say('hotel.l9.go', { priority: 1 }); }
        const d = Math.hypot(chef.x - p.x, chef.z - p.z);
        if (d < 0.95 && Math.abs(p.y) < 2.0) { game.say('hotel.l9.caught', { priority: 2 }); game.kill('chef'); }
        if (!near && d < 9) { near = true; game.say('hotel.l9.near', { priority: 1 }); }
        if (d > 14) near = false;
        if (d < 16) { stepT -= dt; if (stepT <= 0) { game.audio.step(); stepT = d < 7 ? 0.28 : 0.45; } }
      }
      chefMesh.visible = running || t - startT > delay - 2;
      chefMesh.position.set(chef.x, 0, chef.z); chefMesh.rotation.y = chef.yaw;
      const sw = chef.moving ? Math.sin(t * 9) * 0.6 : 0;
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw; armL.rotation.x = -sw * 0.6; armR.rotation.x = -1.1 + sw * 0.2;
    });

    // ---- the host ------------------------------------------------------------------------------------------------------------
    const cellOf = (p) => grid.cellOf(p);
    const said = new Set(); let t0 = 0, intro = false, oneSaid = false, iceSaid = false;
    const lieAt = new Set([4, Math.floor(path.length * 0.4), Math.floor(path.length * 0.7)]);
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l9.intro'); g.say('hotel.l9.intro2'); }
      const [ci, cj] = cellOf(g.player);
      if (!grid.inside(ci, cj)) return;
      const k = ci * N + cj;
      if (!said.has(k)) {
        said.add(k);
        const idx = pathIdx.get(k);
        if (idx !== undefined && lieAt.has(idx)) g.say('hotel.l9.lie', { priority: 1 });
        else if (ice.has(k) && !iceSaid) { iceSaid = true; g.say('hotel.l9.ice', { priority: 1 }); }
      }
      if (!oneSaid) for (const d of doors) if (Math.hypot(g.player.x - d.mx, g.player.z - d.mz) < 6) { oneSaid = true; g.say('hotel.l9.oneway', { priority: 1 }); break; }
    };
    w.hooks.onDeath = () => false;

    // ---- hint: the way out, from where you stand --------------------------------------------------------------------------------
    w.hintFlat = true;
    w.hintFn = (g) => {
      const p = g.player; let [ci, cj] = cellOf(p);
      const out = [{ x: p.x, y: 0.25, z: p.z }];
      if (cj < 0) { out.push({ x: cx(0), y: 0.25, z: cz(0) }); ci = 0; cj = 0; }
      if (cj >= N || ci < 0 || ci >= N) return null;
      for (const c of solveMaze(maze, [ci, cj]).slice(1)) out.push({ x: cx(c[0]), y: 0.25, z: cz(c[1]) });
      out.push({ x: exitX, y: 0.25, z: exitZ });
      return out;
    };
    w.maze = { path, N, C, grid, cx, cz, doors, ice, chef, maze, solve: (c) => solveMaze(maze, c), cellOf, get chefDelay() { return delay; }, get startT() { return startT; } };
    w.botPlan = (g) => {
      const p = g.player, [ci, cj] = cellOf(p);
      if (cj < 0) return { x: cx(0), z: cz(0) };
      if (cj >= N) return { x: exitX, z: exitZ };
      const sol = solveMaze(maze, [ci, cj]);
      if (!sol[1]) return { x: exitX, z: exitZ };
      const nxt = sol[1];
      const ex = Math.sign(nxt[0] - ci), ez = -Math.sign(nxt[1] - cj);
      const lat = ex !== 0 ? p.z - cz(cj) : p.x - cx(ci);
      if (Math.abs(lat) > 0.7) return ex !== 0 ? { x: p.x + ex * 0.6, z: cz(cj) } : { x: cx(ci), z: p.z + ez * 0.6 };
      return { x: cx(nxt[0]), z: cz(nxt[1]) };
    };
    void rnd; void glowMaterial; void hotelHalo;
  },
};
