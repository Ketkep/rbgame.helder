import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture } from '../../engine/materials.js';
import { roomShell, hotelHalo, GOLD } from './kit.js';
import { generateMaze, solveMaze, mazeGrid, buildMazeWalls, Walker } from './mazekit.js';
import { rayAABB } from '../../engine/physics.js';

// Hotel level 12 — "Do Not Disturb" (Hard · Guest Rooms). Stealth. The hotel floor is a maze of corridors, and two housekeepers
// patrol it, pushing carts. They see in a cone (the cones are drawn on the floor, and stop at walls). Be seen for half a second and
// it is over. Dead ends have laundry carts: press E to hide inside, press anything to climb out. A new maze every attempt.

const N = 8, C = 4.4, T = 0.8, WH = 3.6, Z0 = 8, H = 8;
const grid = mazeGrid({ N, C, T, WH, Z0 });
const { cx, cz } = grid;
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

    const maze = generateMaze(N);
    const path = solveMaze(maze, [0, 0]);
    const pathIdx = new Map(path.map((c, k) => [c[0] * N + c[1], k]));
    const W = N * C + 14, zNear = Z0 + 14, zFar = Z0 - N * C - 16;
    roomShell(w, { x0: -W / 2, x1: W / 2, z0: zFar, z1: zNear, yb: -4, H, wallTex: 'damask', wallColor: 0xffffff, pilasterEvery: 11, lamps: false });
    w.plat({ x: 0, y: -3.5, z: (zNear + zFar) / 2, w: W, d: zNear - zFar, h: 1, tex: 'carpet', color: 0x200810, roughness: 0.9 });
    // the hotel corridor carpet
    w.plat({ x: 0, y: 0, z: (zNear + zFar) / 2, w: W, d: zNear - zFar, h: 1.2, tex: 'carpet', color: 0x8a3040, roughness: 0.95 });
    const nb = w.bodies.length;
    buildMazeWalls(w, maze, grid, { tex: 'damask', color: 0xffe8d8, roughness: 0.7, radius: 0.05 });
    const walls = w.bodies.slice(nb).filter((b) => b.solid);
    // little decorations: numbered doors with Do Not Disturb signs, wall lamps
    const plate = (x, y, z, rotY, text, color = '#d8a94a') => w.sign({ text, x, y, z, w: 0.9, h: 0.4, rotY, color, double: false, tw: 256, size: 70 });
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      if ((i + j) % 3 === 0) { const x = cx(i), z = cz(j); w.box({ x, y: 3.0, z, w: 1.4, h: 0.1, d: 0.3, glow: 0xffe0b0, glowIntensity: 1.3, shadow: false }); }
    }
    for (const [x, z] of [[-8, 4], [8, -6], [-8, -16], [8, -26], [0, 8], [0, -24]]) w.light(0xffe0b0, 12, 24, x, 5.4, z);
    const poolMat = new THREE.MeshBasicMaterial({ map: softTexture('glow'), color: 0xffc880, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(C * 1.5, C * 1.5), poolMat); m.rotation.x = -Math.PI / 2; m.position.set(cx(i), 0.02, cz(j)); m.matrixAutoUpdate = false; m.updateMatrix(); w.add(m);
    }
    void plate;

    // ---- entrance, exit ----------------------------------------------------------------------------------------------------
    w.spawn = { x: cx(0), y: 0, z: Z0 + 5, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.sign({ text: 'GUEST ROOMS · FLOOR 3', x: cx(0), y: 5.4, z: Z0 + 0.5, w: 6.5, h: 0.9, color: '#f1d28a', double: true, tw: 1024, size: 54 });
    const exitX = cx(N - 1), exitZ = Z0 - N * C - 6;
    w.sign({ text: 'STAIRS', x: exitX, y: 4.4, z: Z0 - N * C - 1.0, w: 4, h: 1.2, color: '#6cf0b2', double: true, tw: 512, size: 100, glow: true });
    w.goal({ x: exitX, y: 0, z: exitZ, color: GOLD, onReach: () => { game.say('hotel.l12.done', { priority: 2 }); game.completeLevel(); } });

    // ---- hiding places: laundry carts in some dead ends ------------------------------------------------------------------------
    const deadEnds = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (maze.nbrs(i, j).length === 1 && !(i === 0 && j === 0) && !(i === N - 1 && j === N - 1)) deadEnds.push([i, j]);
    const cartCells = deadEnds.sort(() => Math.random() - 0.5).slice(0, Math.min(8, deadEnds.length));
    const carts = [];
    for (const [i, j] of cartCells) {
      const x = cx(i), z = cz(j);
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const basket = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.0), plainMaterial(0xe8e4dc, { roughness: 0.8 })); basket.position.y = 0.95; basket.castShadow = true; g.add(basket);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.1), plainMaterial(0x8a8d95, { metalness: 0.9, roughness: 0.4 })); frame.position.y = 0.4; g.add(frame);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), plainMaterial(0x111111, { roughness: 0.6 })); wh.rotation.x = Math.PI / 2; wh.position.set(sx * 0.65, 0.15, sz * 0.4); g.add(wh); }
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.8), plainMaterial(0xffffff, { roughness: 0.9 })); sheet.position.y = 1.62; g.add(sheet);
      w.add(g);
      const body = w.collider({ x, y: 0.7, z, w: 1.5, h: 1.4, d: 1.0 });
      const cart = { cell: [i, j], x, z, body, g };
      cart.it = w.interactable({ x, y: 1.0, z, w: 1.7, h: 1.4, d: 1.3, range: 3.4, pad: 0.1, label: () => (hidden ? 'Climb out' : 'Hide in the laundry cart'), onUse: (gm) => (hidden ? unhide(gm) : hide(gm, cart)) });
      carts.push(cart);
    }

    // ---- the housekeepers ---------------------------------------------------------------------------------------------------------
    const maids = [];
    const farCells = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (solveMaze(maze, [0, 0], [i, j]).length > 11) farCells.push([i, j]);
    const starts = farCells.sort(() => Math.random() - 0.5).slice(0, 2);
    const black = plainMaterial(0x15151c, { roughness: 0.6 }), white = plainMaterial(0xf6f6f2, { roughness: 0.7 });
    starts.forEach((s, k) => {
      const wk = new Walker(maze, grid, { speed: 2.5 + k * 0.2, mode: 'patrol', start: s, pause: 1.0 });
      const mesh = new THREE.Group(); w.add(mesh);
      const legs = [];
      for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.24), black); leg.position.set(sx * 0.16, 0.45, 0); leg.geometry.translate(0, -0.05, 0); mesh.add(leg); legs.push(leg); }
      const dress = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 1.0, 14), black); dress.position.y = 1.35; dress.castShadow = true; mesh.add(dress);
      const apron = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.05), white); apron.position.set(0, 1.3, -0.4); mesh.add(apron);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), plainMaterial(0xe6c0a0, { roughness: 0.6 })); head.position.y = 2.0; mesh.add(head);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12), white); cap.position.y = 2.25; mesh.add(cap);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), plainMaterial(0x4a2a1a)); hair.position.set(0, 2.03, 0.04); mesh.add(hair);
      // the cart she pushes in front of her
      const cart = new THREE.Group(); cart.position.set(0, 0, -1.2); mesh.add(cart);
      const cb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.8), plainMaterial(0xdcd8d0, { roughness: 0.8 })); cb.position.y = 0.8; cart.add(cb);
      const ctop = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.7), plainMaterial(0xffffff, { roughness: 0.9 })); ctop.position.y = 1.3; cart.add(ctop);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.9), black); arm.position.set(0.3, 1.35, -0.55); mesh.add(arm); const arm2 = arm.clone(); arm2.position.x = -0.3; mesh.add(arm2);
      // "!" over her head
      const bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#ff3a46'; g.font = '110px "Archivo Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 64, 70); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; w.ownTextures.push(t); return t; })(), transparent: true, depthTest: false })); bang.position.y = 3.2; bang.scale.set(1.2, 1.2, 1); bang.visible = false; mesh.add(bang);
      // the vision cone on the floor, clipped by walls
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array((RAYS + 1) * 3 * 3); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff5a30, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      cone.frustumCulled = false; w.add(cone);
      maids.push({ wk, mesh, legs, cone, geo, pos, bang, start: s.slice(), seen: 0, k });
    });
    // distance to the first wall along a horizontal ray from (x, z) in direction (dx, dz)
    const rayWall = (x, z, dx, dz, max) => {
      let best = max;
      for (const b of walls) { const t = rayAABB(x, 1.2, z, dx, 0, dz, b, 0); if (t < best) best = t; }
      return best;
    };
    const updateCone = (m) => {
      const { wk, pos } = m;
      const fx = -Math.sin(wk.yaw), fz = -Math.cos(wk.yaw);
      let o = 0;
      const pts = [];
      for (let r = 0; r <= RAYS; r++) {
        const a = -HALF + (2 * HALF * r) / RAYS, ca = Math.cos(a), sa = Math.sin(a);
        const dx = fx * ca - fz * sa, dz = fx * sa + fz * ca;
        const d = rayWall(wk.x, wk.z, dx, dz, RANGE);
        pts.push([wk.x + dx * d, wk.z + dz * d]);
      }
      for (let r = 0; r < RAYS; r++) {
        pos[o++] = wk.x; pos[o++] = 0.05; pos[o++] = wk.z;
        pos[o++] = pts[r][0]; pos[o++] = 0.05; pos[o++] = pts[r][1];
        pos[o++] = pts[r + 1][0]; pos[o++] = 0.05; pos[o++] = pts[r + 1][1];
      }
      m.geo.attributes.position.needsUpdate = true;
    };

    // ---- hiding ------------------------------------------------------------------------------------------------------------------
    let hidden = false, hiddenIn = null, hideT = 0;
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
      maids.forEach((m) => { m.wk.teleport(m.start); m.seen = 0; });
      meter = 0;
    });

    // ---- sight ---------------------------------------------------------------------------------------------------------------------
    let meter = 0, blind = false, seenSaid = false, vacSaid = false, near = false;
    w.onUpdate((dt, t) => {
      const p = game.player;
      let worst = 0;
      for (const m of maids) {
        m.wk.update(dt);
        m.mesh.position.set(m.wk.x, 0, m.wk.z); m.mesh.rotation.y = m.wk.yaw;
        const sw = m.wk.moving ? Math.sin(t * 8 + m.k) * 0.5 : 0; m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw;
        updateCone(m);
        // can she see you?
        const dx = p.x - m.wk.x, dz = p.z - m.wk.z, d = Math.hypot(dx, dz);
        let visible = false;
        if (!hidden && !blind && game.state === 'playing' && d < RANGE) {
          const fx = -Math.sin(m.wk.yaw), fz = -Math.cos(m.wk.yaw);
          const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / (d || 1))));
          if (ang < HALF && d < rayWall(m.wk.x, m.wk.z, dx / (d || 1), dz / (d || 1), RANGE + 1)) visible = true;
        }
        if (visible) m.seen = Math.min(1, m.seen + dt / (game.baby ? 0.95 : 0.55)); else m.seen = Math.max(0, m.seen - dt / 1.4);
        m.bang.visible = m.seen > 0.05; m.bang.scale.setScalar(0.8 + m.seen * 1.2);
        worst = Math.max(worst, m.seen);
        if (m.seen >= 1 && game.state === 'playing') { game.say('hotel.l12.caught', { priority: 2 }); game.kill('seen'); }
        // she found your cart
        if (hidden && hiddenIn && Math.hypot(m.wk.x - hiddenIn.x, m.wk.z - hiddenIn.z) < 1.6 && game.state === 'playing') { game.say('hotel.l12.found', { priority: 2 }); game.kill('found'); }
        // rattling cart (audio cue) when she is close but you cannot see her
        if (d < 14 && !m.cueT) m.cueT = 0;
        if (d < 14) { m.cueT -= dt; if (m.cueT <= 0) { game.audio.step(); m.cueT = d < 7 ? 0.3 : 0.55; } }
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
    });
    void blind; void near; void vacSaid;

    // ---- the host ------------------------------------------------------------------------------------------------------------------
    const said = new Set(); let t0 = 0, intro = false;
    const lieAt = new Set([5, Math.floor(path.length * 0.45), Math.floor(path.length * 0.75)]);
    const cellOf = (p) => grid.cellOf(p);
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l12.intro'); g.say('hotel.l12.intro2'); }
      const [ci, cj] = cellOf(g.player);
      if (!grid.inside(ci, cj)) return;
      const k = ci * N + cj;
      if (!said.has(k)) { said.add(k); const idx = pathIdx.get(k); if (idx !== undefined && lieAt.has(idx)) g.say('hotel.l12.lie', { priority: 1 }); else if (carts.some((c) => c.cell[0] === ci && c.cell[1] === cj)) g.say('hotel.l12.cart', { priority: 1 }); }
    };
    w.hooks.onDeath = () => false;

    // ---- hint: the way out (and, for once, honest about the housekeepers) -----------------------------------------------------------
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
    w.dnd = { maids, carts, maze, path, grid, walls, hide: (c) => hide(game, c), unhide: () => unhide(game), get hidden() { return hidden; }, get meter() { return meter; }, set blind(v) { blind = v; }, get blind() { return blind; }, rayWall, RANGE, HALF };
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
