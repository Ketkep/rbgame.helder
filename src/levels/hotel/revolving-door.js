import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture } from '../../engine/materials.js';
import { hotelHalo, citySkyline, GOLD } from './kit.js';
import { palm } from './props.js';
import { generateMaze, solveMaze, mazeGrid, buildMazeWalls, edgeKey as edgeKeyN } from './mazekit.js';

// Hotel level 4 — "Revolving Door" (Easy · Mezzanine). The rooftop garden maze: a fresh random hedge maze every
// attempt. Revolving doors block some passages on a schedule (green lamp = go), housekeeping carts patrol the corridors
// (hop over them), and the host gives very confident directions.

const N = 7;                 // maze is N x N cells
const C = 4.4;               // cell size
const T = 0.8;               // hedge thickness
const WH = 3.6;              // hedge height
const Z0 = 8;                // south-west corner of the maze
const grid = mazeGrid({ N, C, T, WH, Z0 });
const { X0, cx, cz } = grid;
const rnd = (n) => Math.floor(Math.random() * n);

export default {
  id: 'hotel-4',
  name: 'Revolving Door',
  music: 'hotel',
  completeQuip: 'You found the exit. It was at the end. They always are. Mostly.',

  build(w, game) {
    w.env({
      top: 0x050824, horizon: 0x2a2250, bottom: 0x08080f,
      fog: { color: 0x15102c, near: 60, far: 300 },
      sun: { color: 0xa9c0ff, intensity: 1.5, dir: [-0.45, 0.8, 0.5] },
      hemi: { sky: 0xa8bcff, ground: 0x587058, intensity: 0.95 },
      exposure: 0.95, stars: 1.0,
      bloom: { strength: 0.5, radius: 0.7, threshold: 0.95 },
      motes: { color: 0xffe0a0, count: 160, size: 0.07, opacity: 0.5 },
    });
    w.setTheme({ tex: 'stone', color: 0xffffff, trim: null, edge: null, edgeOpacity: 0, roughness: 0.8, metalness: 0, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.killY = -30;
    w.stepHeight = 0;
    citySkyline(w);

    const maze = generateMaze(N);
    const solve = (nbrs, from) => solveMaze(maze, from);
    const path = solve(maze.nbrs, [0, 0]);
    const pathIdx = new Map(path.map((c, k) => [c[0] * N + c[1], k]));

    // ---- the terrace ---------------------------------------------------------------------------------
    const zFar = Z0 - N * C - 12, zNear = Z0 + 11;
    const tzc = (zFar + zNear) / 2, tD = zNear - zFar, tW = N * C + 20;
    w.plat({ x: 0, y: 0, z: tzc, w: tW, d: tD, h: 1.4, tex: 'stone', color: 0xd9cdb5, roughness: 0.55 });
    const parapet = (x, z, ww, dd) => {
      w.plat({ x, y: 1.1, z, w: ww, d: dd, h: 1.1, tex: 'stone', color: 0xe4d8c0, roughness: 0.5 });
      w.box({ x, y: 1.2, z, w: ww + 0.1, h: 0.14, d: dd + 0.1, color: GOLD, metal: 1, rough: 0.35, shadow: false });
    };
    parapet(-tW / 2, tzc, 0.6, tD); parapet(tW / 2, tzc, 0.6, tD); parapet(0, zNear, tW, 0.6); parapet(0, zFar, tW, 0.6);
    for (const [x, z] of [[-tW / 2, zNear], [tW / 2, zNear], [-tW / 2, zFar], [tW / 2, zFar]]) {
      w.box({ x, y: 1.6, z, w: 0.9, h: 3.2, d: 0.9, color: 0xe4d8c0, rough: 0.4 });
      w.box({ x, y: 3.45, z, w: 0.34, h: 0.34, d: 0.34, glow: 0xffd8a0, glowIntensity: 1.7, shadow: false });
      hotelHalo(w, x, 3.5, z, 5, 0xffc070, 0.22);
    }

    // ---- walls (merged into long hedge runs) ---------------------------------------------------------
    buildMazeWalls(w, maze, grid, { tex: 'hedge', color: 0xffffff, roughness: 0.95, radius: 0.1, reach: [-tW / 2, tW / 2] });
    // little lanterns on the hedge corners + a warm pool of light in every cell
    for (let i = 0; i <= N; i += 1) for (let j = 0; j <= N; j += 1) if ((i + j) % 2 === 0) {
      w.box({ x: X0 + i * C, y: WH + 0.35, z: Z0 - j * C, w: 0.22, h: 0.5, d: 0.22, glow: 0xffd8a0, glowIntensity: 1.6, shadow: false });
    }
    const poolMat = new THREE.MeshBasicMaterial({ map: softTexture('glow'), color: 0xffc880, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(C * 1.7, C * 1.7), poolMat);
      m.rotation.x = -Math.PI / 2; m.position.set(cx(i), 0.02, cz(j)); m.matrixAutoUpdate = false; m.updateMatrix(); w.add(m);
    }

    // ---- entrance + exit ------------------------------------------------------------------------------
    w.spawn = { x: cx(0), y: 0, z: Z0 + 5, yaw: 0 };
    w.respawn = { ...w.spawn };
    for (const sx of [-1, 1]) w.box({ x: cx(0) + sx * 2.3, y: 2.2, z: Z0 + 0.6, w: 0.35, h: 4.4, d: 0.35, color: 0xe4d8c0, rough: 0.4 });
    w.box({ x: cx(0), y: 4.5, z: Z0 + 0.6, w: 5.4, h: 0.5, d: 0.5, color: GOLD, metal: 1, rough: 0.35 });
    w.sign({ text: 'ROOFTOP GARDEN', x: cx(0), y: 5.5, z: Z0 + 0.65, w: 6, h: 1.1, color: '#f1d28a', double: true, tw: 1024, size: 80 });
    palm(w, cx(0) - 6, Z0 + 5, 1.1); palm(w, cx(0) + 6, Z0 + 5, 1.1); palm(w, cx(N - 1) - 6, Z0 - N * C - 5, 1.1); palm(w, cx(N - 1) + 6, Z0 - N * C - 5, 1.1);
    const exitX = cx(N - 1), exitZ = Z0 - N * C - 5;
    w.sign({ text: 'EXIT', x: exitX, y: 4.2, z: Z0 - N * C - 1.0, w: 4, h: 1.2, color: '#6cf0b2', double: true, tw: 512, size: 100, glow: true });
    w.goal({ x: exitX, y: 0, z: exitZ, color: GOLD, onReach: () => { game.say('hotel.l4.done', { priority: 2 }); game.completeLevel(); } });

    // ---- revolving doors -----------------------------------------------------------------------------
    const doors = [];
    const doorAt = (a, b, decoy = false) => {
      const mx = (cx(a[0]) + cx(b[0])) / 2, mz = (cz(a[1]) + cz(b[1])) / 2, ew = a[0] !== b[0];
      const body = w.collider({ x: mx, y: WH / 2, z: mz, w: ew ? T * 0.9 : C - T + 0.2, h: WH, d: ew ? C - T + 0.2 : T * 0.9 });
      const g = new THREE.Group(); g.position.set(mx, 0, mz);
      const brass = plainMaterial(GOLD, { metalness: 1, roughness: 0.3 });
      const glass = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.12, 28), brass); base.position.y = 0.06; g.add(base);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.3, 28), brass); cap.position.y = WH - 0.15; g.add(cap);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, WH, 12), brass); pole.position.y = WH / 2; g.add(pole);
      const wings = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const wing = new THREE.Group(); wing.rotation.y = (k * Math.PI) / 2;
        const pane = new THREE.Mesh(new THREE.BoxGeometry(1.65, WH - 0.5, 0.05), glass); pane.position.set(0.9, WH / 2, 0); wing.add(pane);
        for (const yy of [0.3, WH - 0.3]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.1, 0.1), brass); bar.position.set(0.9, yy, 0); wing.add(bar); }
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.08, WH - 0.5, 0.08), brass); edge.position.set(1.72, WH / 2, 0); wing.add(edge);
        wings.add(wing);
      }
      g.add(wings);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), glowMaterial(0xff3a46, 1.8)); lamp.position.y = WH + 0.55; g.add(lamp);
      const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), brass); lampPost.position.y = WH + 0.25; g.add(lampPost);
      w.add(g);
      const d = { a, b, body, wings, lamp, phase: Math.random() * 3, open: false, mx, mz, decoy };
      doors.push(d);
      return d;
    };
    const P = 3.4;   // seconds per quarter turn
    const LAMP = { go: glowMaterial(0x40ff88, 1.8), stop: glowMaterial(0xff3a46, 1.8) };
    const isDoorOpen = (t, d) => { const u = (((t + d.phase) % P) + P) % P / P; return u > 0.28 && u < 0.72; };
    // 4 on the way out, 2-3 on the way to nowhere
    const edgeKey = (a, b) => edgeKeyN(N, a, b);
    const onPath = new Set(); for (let k = 0; k < path.length - 1; k++) onPath.add(edgeKey(path[k], path[k + 1]));
    const doorEdges = new Set();
    for (const f of [0.2, 0.4, 0.6, 0.8]) {
      const k = Math.max(2, Math.min(path.length - 4, Math.round(f * (path.length - 1))));
      if (!doorEdges.has(edgeKey(path[k], path[k + 1]))) { doorEdges.add(edgeKey(path[k], path[k + 1])); doorAt(path[k], path[k + 1]); }
    }
    const offEdges = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (const [a, b] of [[i + 1, j], [i, j + 1]]) if (a < N && b < N && maze.open(i, j, a, b) && !onPath.has(edgeKey([i, j], [a, b]))) offEdges.push([[i, j], [a, b]]);
    for (let n = 0; n < 3 && offEdges.length; n++) { const [a, b] = offEdges.splice(rnd(offEdges.length), 1)[0]; doorAt(a, b, true); doorEdges.add(edgeKey(a, b)); }
    w.onUpdate((dt, t) => {
      for (const d of doors) {
        const u = (((t + d.phase) % P) + P) % P / P;
        d.wings.rotation.y = (t + d.phase) / P * (Math.PI / 2);
        const op = u > 0.28 && u < 0.72;
        if (op !== d.open) { d.open = op; d.body.enabled = !op; d.lamp.material = op ? LAMP.go : LAMP.stop; }
      }
    });
    void isDoorOpen;

    // ---- housekeeping carts: low, wide, and in the way (hop over them) ------------------------------------
    const runs = [];
    for (let k = 0; k < path.length - 1;) {
      const dir = [path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]];
      let e = k + 1;
      while (e + 1 < path.length && path[e + 1][0] - path[e][0] === dir[0] && path[e + 1][1] - path[e][1] === dir[1]) e++;
      let clean = true; for (let m = k; m < e; m++) if (doorEdges.has(edgeKey(path[m], path[m + 1]))) clean = false;
      if (clean && e - k >= 2 && k > 0) runs.push({ from: path[k], to: path[e], dir });
      k = e;
    }
    const carts = [];
    for (const run of runs.sort(() => Math.random() - 0.5).slice(0, 2)) {
      const mx = (cx(run.from[0]) + cx(run.to[0])) / 2, mz = (cz(run.from[1]) + cz(run.to[1])) / 2;
      const alongX = run.dir[0] !== 0, L = (Math.abs(run.to[0] - run.from[0]) + Math.abs(run.to[1] - run.from[1])) * C, A = L / 2 - 0.2;
      const len = 1.5, wid = 3.2, ph = Math.random() * 6;
      const hz = w.hazard({ x: mx, y: 0.4, z: mz, w: alongX ? len : wid, h: 0.8, d: alongX ? wid : len, color: 0xff3a46, move: (t) => (alongX ? { x: A * Math.sin(t * 0.55 + ph) } : { z: A * Math.sin(t * 0.55 + ph) }) });
      hz.core.visible = false; hz.shell.visible = false; hz.jumpable = true;
      cartVisual(hz.group, alongX, len, wid);
      carts.push({ hz, alongX });
    }

    // ---- the host -----------------------------------------------------------------------------------
    const cellOf = (p) => [Math.floor((p.x - X0) / C), Math.floor((Z0 - p.z) / C)];
    const lieAt = new Set([3, Math.floor(path.length * 0.45), Math.floor(path.length * 0.75)]);
    const said = new Set();
    let t0 = 0, intro = false, lastDead = 0, doorSaid = false;
    const deadEnds = new Set();
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (maze.nbrs(i, j).length === 1 && !(i === 0 && j === 0) && !(i === N - 1 && j === N - 1)) deadEnds.add(i * N + j);
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l4.intro'); g.say('hotel.l4.intro2'); }
      const [ci, cj] = cellOf(g.player);
      if (ci < 0 || cj < 0 || ci >= N || cj >= N) return;
      const k = ci * N + cj;
      if (!said.has(k)) {
        said.add(k);
        const idx = pathIdx.get(k);
        if (idx !== undefined && lieAt.has(idx)) g.say('hotel.l4.lie', { priority: 1 });
        else if (deadEnds.has(k) && g.time - lastDead > 25) { lastDead = g.time; g.say('hotel.l4.deadend', { priority: 1 }); }
        else if (idx === Math.floor(path.length / 2)) g.say('hotel.l4.half', { priority: 1 });
      }
      if (!doorSaid) for (const d of doors) if (Math.hypot(g.player.x - d.mx, g.player.z - d.mz) < 7) { doorSaid = true; g.say('hotel.l4.door', { priority: 1 }); break; }
    };
    w.hooks.onDeath = (info) => {
      if (info.reason === 'hazard' && Math.random() < 0.7) { game.say('hotel.l4.cart', { priority: 1 }); return true; }
      return false;
    };

    // ---- hint: the way out, from where you stand ------------------------------------------------------------
    w.hintFlat = true;
    w.hintFn = (g) => {
      const p = g.player; let [ci, cj] = cellOf(p);
      const out = [{ x: p.x, y: 0.25, z: p.z }];
      if (cj < 0) { out.push({ x: cx(0), y: 0.25, z: cz(0) }); ci = 0; cj = 0; }
      if (cj >= N) return null;
      if (ci < 0 || ci >= N) return null;
      const sol = solve(maze.nbrs, [ci, cj]);
      for (const c of sol.slice(1)) out.push({ x: cx(c[0]), y: 0.25, z: cz(c[1]) });
      out.push({ x: exitX, y: 0.25, z: exitZ });
      return out;
    };
    w.maze = { path, N, C, X0, Z0, cx, cz, doors, carts, nbrs: maze.nbrs, solve: (c) => solve(maze.nbrs, c), cellOf };
    w.botPlan = (g) => {
      const p = g.player, [ci, cj] = cellOf(p);
      if (cj < 0) return { x: cx(0), z: cz(0) };
      if (cj >= N) return { x: exitX, z: exitZ };
      const sol = solve(maze.nbrs, [ci, cj]);
      if (!sol[1]) return { x: exitX, z: exitZ };
      const nxt = sol[1];
      const ex = Math.sign(nxt[0] - ci), ez = -Math.sign(nxt[1] - cj);       // move direction in world axes (+j is -z)
      // stay on the corridor's centre line: if we are off it, slide back while advancing a little
      const lat = ex !== 0 ? p.z - cz(cj) : p.x - cx(ci);
      if (Math.abs(lat) > 0.7) return ex !== 0 ? { x: p.x + ex * 0.6, z: cz(cj) } : { x: cx(ci), z: p.z + ez * 0.6 };
      return { x: cx(nxt[0]), z: cz(nxt[1]) };
    };
  },
};

// a brass luggage-cart train: deck, four posts, a couple of suitcases, a rotating red lamp
function cartVisual(group, alongX, len, wid) {
  const brass = plainMaterial(GOLD, { metalness: 1, roughness: 0.3 });
  const wx = alongX ? len : wid, wz = alongX ? wid : len;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(wx, 0.12, wz), brass); deck.position.y = -0.12; deck.castShadow = true; group.add(deck);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), brass); post.position.set(sx * (wx / 2 - 0.08), 0.0, sz * (wz / 2 - 0.08)); group.add(post);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), plainMaterial(0x111111, { roughness: 0.6 })); wheel.rotation.z = Math.PI / 2; wheel.position.set(sx * (wx / 2 - 0.1), -0.34, sz * (wz / 2 - 0.1)); group.add(wheel);
  }
  const cols = [0x6a3a22, 0x1a2a4a, 0x7a1f2a, 0x2f5d3a];
  for (let k = 0; k < 4; k++) {
    const sc = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.6 : 0.8, 0.5, alongX ? 0.8 : 0.6), plainMaterial(cols[k], { roughness: 0.5 }));
    const t = (k - 1.5) / 2;
    sc.position.set(alongX ? 0 : t * (wid - 0.9), -0.05 + (k % 2) * 0.12, alongX ? t * (wid - 0.9) : 0); sc.castShadow = true; group.add(sc);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glowMaterial(0xff3a46, 2.2)); lamp.position.set(0, 0.62, 0); group.add(lamp);
}
