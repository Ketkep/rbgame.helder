import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture, getTexture, textTexture } from '../../engine/materials.js';
import { lobbyCity } from './city.js';

// The Hotel Trust-Me building kit: a luxe art-deco lobby at night. Used by the hub and by levels set in the lobby.
// Axes: +X east, -Z north (the elevator bank is on the north wall, the entrance on the south wall).

export const L = { x0: -22, x1: 22, z0: -24, z1: 16, H: 13 };   // interior bounds + ceiling height
export const ELEV_X = [-12, -6, 0, 6, 12];
export const GOLD = 0xd8a94a;
export const WALL_ROUGH = 0.5;   // the damask is satin, not matt

const gold = (rough = 0.28) => plainMaterial(GOLD, { metalness: 1, roughness: rough });
const cream = () => plainMaterial(0xece3cf, { roughness: 0.22 });
const black = () => plainMaterial(0x0c0c10, { roughness: 0.1, metalness: 0.25 });

function add(w, geo, mat, x, y, z, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  if (o.sx) m.scale.set(o.sx, o.sy ?? o.sx, o.sz ?? o.sx);
  m.castShadow = o.cast ?? true; m.receiveShadow = o.recv ?? true;
  if (o.static !== false) { m.matrixAutoUpdate = false; m.updateMatrix(); }
  w.add(m);
  return m;
}
const halo = (w, x, y, z, size, color = 0xffc880, opacity = 0.5) => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.position.set(x, y, z); sp.scale.set(size, size, 1); w.add(sp); return sp;
};

// ================================================================================================
//  Environment (night sky outside, warm interior fill, reflections)
// ================================================================================================
export function hotelEnv(w, { mood = 'night' } = {}) {
  w.env({
    top: 0x04061c, horizon: mood === 'night' ? 0x2e2250 : 0x3a1a1a, bottom: 0x07070f,
    fog: { color: 0x120d28, near: 70, far: 340 },
    sun: { color: 0x9db4ff, intensity: 0.5, dir: [-0.35, 0.7, 0.6], shadow: false },
    hemi: { sky: 0xffe2b8, ground: 0x80604a, intensity: 0.4 },
    exposure: 0.8, stars: 0.9,
    bloom: { strength: 0.45, radius: 0.7, threshold: 1.0 },
    motes: { color: 0xffd9a0, count: 240, size: 0.07, opacity: 0.55 },
    envMap: {
      top: 0xffe3b8, mid: 0x5a3a2a, bottom: 0x120c0a, intensity: 0.45,
      lights: [
        { pos: [0, 10, 0], w: 16, h: 16, color: 0xffe2b0, intensity: 2.5 },
        { pos: [-14, 3, 0], w: 6, h: 8, color: 0xffd29a, intensity: 1.5 },
        { pos: [14, 3, 0], w: 6, h: 8, color: 0xffd29a, intensity: 1.5 },
        { pos: [0, 4, -14], w: 12, h: 6, color: 0xfff0d0, intensity: 1.4 },
        { pos: [0, 4, 14], w: 8, h: 6, color: 0x9db4ff, intensity: 1.2 },
      ],
    },
  });
  w.setTheme({ tex: 'marble', color: 0xffffff, trim: null, edge: null, edgeOpacity: 0, roughness: 0.35, metalness: 0, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
}

// ================================================================================================
//  Wall helper: work in wall-local coordinates (u along the wall, n inward from the inner face)
// ================================================================================================
const WALLS = {
  west:  { pos: (u, n) => [L.x0 + n, u], dim: (len, th) => [th, len] },
  east:  { pos: (u, n) => [L.x1 - n, u], dim: (len, th) => [th, len] },
  south: { pos: (u, n) => [u, L.z1 - n], dim: (len, th) => [len, th] },
  north: { pos: (u, n) => [u, L.z0 + n], dim: (len, th) => [len, th] },
};

/** [from, to] stretches of a wall that are left once a `half`-wide gap is cut around each centre in `centres`. */
function doorwayRuns(from, to, centres, half) {
  const runs = [];
  let x = from;
  for (const c of centres) { if (c - half > x) runs.push([x, c - half]); x = c + half; }
  if (to > x) runs.push([x, to]);
  return runs;
}

/** The wall base: polished verde marble with a gold cap. */
function plinth(w, side, u, len) {
  wbox(w, side, u, 0.17, 0.3, len, 0.34, 0.6, { tex: 'verde', color: 0xffffff, rough: 0.14, shadow: false });
  wbox(w, side, u, 0.19, 0.63, len, 0.38, 0.07, { color: GOLD, metal: 1, rough: 0.28, shadow: false });
}

/** A decorative (non-colliding) box attached to a wall. */
function wbox(w, side, u, n, y, len, th, h, o = {}) {
  const W = WALLS[side], [x, z] = W.pos(u, n), [bw, bd] = W.dim(len, th);
  return w.box({ x, y, z, w: bw, h, d: bd, ...o });
}

// ================================================================================================
//  The lobby shell
// ================================================================================================
export function lobbyShell(w) {
  const H = L.H;
  // ---- floor + ceiling ---------------------------------------------------------------------
  w.plat({ x: 0, y: 0, z: -4, w: 44, d: 40, h: 2, tex: 'marble', color: 0xffffff, roughness: 0.16, path: true });
  w.plat({ x: 0, y: H + 1, z: -4, w: 46, d: 42, h: 1, tex: 'coffer', color: 0xffffff, roughness: 0.8 });
  for (const z of [-16, -8, 0, 8]) w.box({ x: 0, y: H - 0.5, z, w: 44, h: 0.9, d: 1.4, color: 0xe3d7bd, rough: 0.5, shadow: false });
  for (const z of [-16, -8, 0, 8]) w.box({ x: 0, y: H - 1.0, z, w: 44, h: 0.12, d: 1.5, color: GOLD, metal: 1, rough: 0.3, shadow: false });

  // ---- walls (with window bays) --------------------------------------------------------------
  const T = 1;
  const slab = (x, y0, y1, z, wd, dd, tex, color = 0xffffff) => w.plat({ x, y: y1, z, w: wd, d: dd, h: y1 - y0, tex, color, roughness: WALL_ROUGH });
  const winZ = [-17, -9, -1, 7], WW = 3.8, WY0 = 3.4, WY1 = 10.6;
  for (const sx of [-1, 1]) {
    const X = sx * (22 + T / 2);
    let z = -25;
    for (const c of winZ) {
      slab(X, 0, H, (z + c - WW / 2) / 2, T, c - WW / 2 - z, 'damask');
      slab(X, 0, WY0, c, T, WW, 'damask');
      slab(X, WY1, H, c, T, WW, 'damask');
      z = c + WW / 2;
    }
    slab(X, 0, H, (z + 17) / 2, T, 17 - z, 'damask');
  }
  // south wall: entrance + windows
  southWall(w, T, WW, WY0, WY1, H);
  // north wall (elevator bank) is built by elevatorBank()

  // invisible "glass" so nobody climbs out of a window
  for (const c of winZ) { w.collider({ x: -22.2, y: 7, z: c, w: 0.3, h: 7.4, d: WW }); w.collider({ x: 22.2, y: 7, z: c, w: 0.3, h: 7.4, d: WW }); }
  for (const c of [-16, -9, 9, 16]) w.collider({ x: c, y: 7, z: 15.8, w: WW, h: 7.4, d: 0.3 });

  // ---- wainscot, chair rail, cornice ---------------------------------------------------------
  for (const side of ['west', 'east']) {
    wbox(w, side, -4, 0.12, 1.6, 40, 0.24, 2.0, { tex: 'panel', color: 0xffffff, shadow: false });                    // panels: exactly one texture tile high
    wbox(w, side, -4, 0.2, 2.7, 40, 0.34, 0.12, { color: GOLD, metal: 1, rough: 0.3, shadow: false });               // chair rail
    plinth(w, side, -4, 40);
    wbox(w, side, -4, 0.35, H - 0.35, 40, 0.8, 0.7, { color: 0xece3cf, rough: 0.35, shadow: false });
    wbox(w, side, -4, 0.62, H - 0.72, 40, 0.14, 0.16, { color: GOLD, metal: 1, rough: 0.3, shadow: false });
  }
  for (const side of ['south', 'north']) {
    // the panelling stops at each doorway (elevators in the north, the entrance in the south), otherwise it paints over the doors
    const runs = side === 'north' ? doorwayRuns(-22, 22, ELEV_X, 1.85) : doorwayRuns(-22, 22, [0], 3.1);
    for (const [a, b] of runs) {
      wbox(w, side, (a + b) / 2, 0.12, 1.6, b - a, 0.24, 2.0, { tex: 'panel', color: 0xffffff, shadow: false });
      wbox(w, side, (a + b) / 2, 0.2, 2.7, b - a, 0.34, 0.12, { color: GOLD, metal: 1, rough: 0.3, shadow: false });
      plinth(w, side, (a + b) / 2, b - a);
    }
    wbox(w, side, 0, 0.35, H - 0.35, 44, 0.8, 0.7, { color: 0xece3cf, rough: 0.35, shadow: false });
  }

  // ---- windows: frames, curtains, valances, moonlight shafts ---------------------------------
  const windowDecor = (side, c) => {
    const f = (u, y, len, h) => wbox(w, side, u, 0.1, y, len, 0.2, h, { color: GOLD, metal: 1, rough: 0.3, shadow: false });
    f(c - WW / 2, (WY0 + WY1) / 2, 0.2, WY1 - WY0); f(c + WW / 2, (WY0 + WY1) / 2, 0.2, WY1 - WY0);
    f(c, WY1, WW, 0.2); f(c, WY0, WW, 0.2);
    f(c, (WY0 + WY1) / 2, 0.1, WY1 - WY0); f(c, (WY0 + WY1) / 2 + 1.2, WW, 0.08); f(c, (WY0 + WY1) / 2 - 1.4, WW, 0.08);
    for (const sgn of [-1, 1]) {
      wbox(w, side, c + sgn * (WW / 2 + 0.55), 0.45, 6.7, 1.1, 0.8, 9.4, { tex: 'curtain', color: 0xffffff, rough: 0.9, shadow: false });
      wbox(w, side, c + sgn * (WW / 2 + 0.1), 0.5, 11.2, 0.3, 0.5, 0.5, { color: GOLD, metal: 1, rough: 0.3, shadow: false });
    }
    wbox(w, side, c, 0.45, 11.2, WW + 3, 0.9, 0.9, { tex: 'curtain', color: 0xd8c8c0, rough: 0.9, shadow: false });
    wbox(w, side, c, 0.45, 10.7, WW + 3, 0.95, 0.12, { color: GOLD, metal: 1, rough: 0.3, shadow: false });
  };
  for (const c of winZ) { windowDecor('west', c); windowDecor('east', c); }
  for (const c of [-16, -9, 9, 16]) windowDecor('south', c);

  // ---- pilasters between windows --------------------------------------------------------------
  for (const side of ['west', 'east']) for (const u of [-21, -13, -5, 3, 12.5]) {
    wbox(w, side, u, 0.35, 6.5, 1.0, 0.7, 12.4, { color: 0xece3cf, rough: 0.25, shadow: false });
    wbox(w, side, u, 0.4, 0.4, 1.3, 0.8, 0.5, { color: GOLD, metal: 1, rough: 0.3, shadow: false });
    wbox(w, side, u, 0.4, 12.2, 1.3, 0.8, 0.5, { color: GOLD, metal: 1, rough: 0.3, shadow: false });
  }

  // ---- columns --------------------------------------------------------------------------------
  for (const x of [-10.5, 10.5]) for (const z of [8, 0, -8, -16]) column(w, x, z);

  // ---- lights ---------------------------------------------------------------------------------
  chandelier(w, 0, 10.4, -4, 1.0);
  chandelier(w, 0, 10.9, 7.5, 0.6);
  chandelier(w, 0, 10.9, -15.5, 0.6);
  w.spotLight({ color: 0xffe9c8, intensity: 90, x: 0, y: 12.6, z: -4, tx: 0, ty: 0, tz: -4, angle: 1.3, penumbra: 0.75, shadow: true, mapSize: 2048, far: 40 });
  for (const [x, z, side] of [[-21.5, -13, 'west'], [-21.5, 3, 'west'], [21.5, -13, 'east'], [21.5, 3, 'east']]) sconce(w, x, 4.6, z, side, true);
  for (const [x, z, side] of [[-21.5, -5, 'west'], [-21.5, 11, 'west'], [21.5, -5, 'east'], [21.5, 11, 'east']]) sconce(w, x, 4.6, z, side, false);

  // ---- floor dressing -------------------------------------------------------------------------
  carpetRunner(w);
  medallion(w, 0, -4);
  stanchions(w);

  // ---- outside ---------------------------------------------------------------------------------
  w.city = lobbyCity(w);
  // moonlight through the side windows, as bright panes on the floor
  const patch = windowPatchMaterial();
  w.onDispose(() => { patch.map.dispose(); patch.dispose(); });
  for (const c of winZ) for (const sx of [-1, 1]) windowPatch(w, patch, sx, c, WW, WY0, WY1);
  ceilingMural(w);
  return {};
}

function southWall(w, T, WW, WY0, WY1, H) {
  const Z = 16 + T / 2;
  const edges = [{ c: -16, k: 'win' }, { c: -9, k: 'win' }, { c: 0, k: 'door' }, { c: 9, k: 'win' }, { c: 16, k: 'win' }];
  const seg = (x0, x1) => { if (x1 - x0 > 0.01) w.plat({ x: (x0 + x1) / 2, y: H, z: Z, w: x1 - x0, d: T, h: H, tex: 'damask', color: 0xffffff, roughness: WALL_ROUGH }); };
  let x = -23;
  for (const e of edges) {
    const half = e.k === 'door' ? 3 : WW / 2;
    seg(x, e.c - half);
    if (e.k === 'win') {
      w.plat({ x: e.c, y: WY0, z: Z, w: WW, d: T, h: WY0, tex: 'damask', color: 0xffffff, roughness: WALL_ROUGH });
      w.plat({ x: e.c, y: H, z: Z, w: WW, d: T, h: H - WY1, tex: 'damask', color: 0xffffff, roughness: WALL_ROUGH });
    } else w.plat({ x: e.c, y: H, z: Z, w: 6, d: T, h: H - 6.2, tex: 'damask', color: 0xffffff, roughness: WALL_ROUGH });
    x = e.c + half;
  }
  seg(x, 23);
}

export function column(w, x, z) {
  const h = 12.4;
  add(w, new THREE.CylinderGeometry(0.72, 0.78, h, 28), cream(), x, h / 2 + 0.25, z);
  add(w, new THREE.BoxGeometry(1.8, 0.5, 1.8), cream(), x, 0.25, z);
  add(w, new THREE.BoxGeometry(1.5, 0.16, 1.5), gold(), x, 0.58, z);
  add(w, new THREE.CylinderGeometry(0.86, 0.72, 0.5, 28), gold(), x, h + 0.2, z);
  add(w, new THREE.BoxGeometry(1.9, 0.5, 1.9), cream(), x, h + 0.6, z);
  for (let i = 0; i < 12; i++) {                      // fluting
    const a = (i / 12) * Math.PI * 2;
    add(w, new THREE.BoxGeometry(0.06, h - 1.4, 0.1), plainMaterial(0xcfc4ad, { roughness: 0.3 }), x + Math.cos(a) * 0.73, h / 2 + 0.25, z + Math.sin(a) * 0.73, { ry: -a, cast: false });
  }
  w.collider({ x, y: h / 2, z, w: 1.5, h, d: 1.5 });
}

export function chandelier(w, x, y, z, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const goldM = gold(0.25);
  const chainLen = L.H - y + 0.4;
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, chainLen, 8), goldM); chain.position.y = chainLen / 2; g.add(chain);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.5 * s, 20, 14), goldM); g.add(hub);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.7 * s, 0.5 * s, 18), goldM); bowl.position.y = -0.55 * s; g.add(bowl);
  const tiers = [{ R: 1.3 * s, yy: -0.5 * s, n: 10 }, { R: 2.2 * s, yy: -1.1 * s, n: 16 }, { R: 3.1 * s, yy: -1.8 * s, n: 22 }];
  const bulbGeo = new THREE.SphereGeometry(0.11 * s, 10, 8), bulbMat = glowMaterial(0xffdca0, 3.4);
  const crysGeo = new THREE.OctahedronGeometry(0.1 * s, 0), crysMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.1, emissive: 0xfff0d8, emissiveIntensity: 0.55 });
  const total = tiers.reduce((a, t) => a + t.n, 0);
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, total), crys = new THREE.InstancedMesh(crysGeo, crysMat, total * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  let bi = 0, ci = 0;
  for (const t of tiers) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(t.R, 0.06 * s, 8, 48), goldM); ring.rotation.x = Math.PI / 2; ring.position.y = t.yy; g.add(ring);
    for (let i = 0; i < 6; i++) {                                   // spokes
      const a = (i / 6) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, t.R, 6), goldM);
      spoke.position.set(Math.cos(a) * t.R / 2, t.yy * 0.5 - 0.1 * s, Math.sin(a) * t.R / 2);
      spoke.rotation.z = Math.PI / 2; spoke.rotation.y = -a; spoke.rotation.x = 0; g.add(spoke);
    }
    for (let i = 0; i < t.n; i++) {
      const a = (i / t.n) * Math.PI * 2, px = Math.cos(a) * t.R, pz = Math.sin(a) * t.R;
      m4.compose(new THREE.Vector3(px, t.yy + 0.16 * s, pz), q, sc); bulbs.setMatrixAt(bi++, m4);
      for (let k = 0; k < 2; k++) {
        sc.set(1, 2.3 + k * 1.1, 1);
        m4.compose(new THREE.Vector3(px, t.yy - (0.22 + k * 0.32) * s, pz), q, sc); crys.setMatrixAt(ci++, m4);
        sc.set(1, 1, 1);
      }
    }
  }
  g.add(bulbs, crys);
  g.traverse((o) => { o.matrixAutoUpdate = false; o.updateMatrix(); });
  g.matrixAutoUpdate = false; g.updateMatrix();
  w.add(g);
  halo(w, x, y - 1.2 * s, z, 9 * s, 0xffc880, 0.22);
  w.light(0xffd9a0, 28 * s, 30, x, y - 1.2 * s, z);
  return g;
}

export function sconce(w, x, y, z, side, withLight = false) {
  const dir = side === 'west' ? 1 : -1;
  add(w, new THREE.BoxGeometry(0.14, 0.9, 0.4), gold(), x - dir * 0.0, y, z, { cast: false });
  add(w, new THREE.CylinderGeometry(0.13, 0.26, 0.55, 14), glowMaterial(0xffd8a0, 1.5), x + dir * 0.35, y + 0.25, z, { cast: false });
  add(w, new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), gold(), x + dir * 0.18, y - 0.05, z, { rz: Math.PI / 2, cast: false });
  halo(w, x + dir * 0.5, y + 0.25, z, 2.0, 0xffc070, 0.16);
  if (withLight) w.light(0xffcf8a, 9, 12, x + dir * 1.2, y + 0.3, z);
}

// ---- floor dressing ------------------------------------------------------------------------------
function carpetRunner(w) {
  const tex = getTexture('carpet').clone();
  tex.repeat.set(5.4 / 2, 38.5 / 2); tex.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 38.5), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0.014, -4.2); m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); w.add(m);
  for (const sx of [-1, 1]) {
    add(w, new THREE.BoxGeometry(0.14, 0.03, 38.5), gold(), sx * 2.78, 0.02, -4.2, { cast: false });
    add(w, new THREE.BoxGeometry(0.06, 0.03, 38.5), gold(), sx * 2.5, 0.02, -4.2, { cast: false });
  }
}

function medallion(w, x, z) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), R = S / 2;
  const grad = g.createRadialGradient(R, R, 10, R, R, R); grad.addColorStop(0, '#1a1018'); grad.addColorStop(0.75, '#2a1424'); grad.addColorStop(1, '#0c0810');
  g.fillStyle = grad; g.beginPath(); g.arc(R, R, R - 4, 0, 7); g.fill();
  g.strokeStyle = '#d8a94a'; g.lineWidth = 10; for (const r of [R - 12, R - 50, R - 130]) { g.beginPath(); g.arc(R, R, r, 0, 7); g.stroke(); }
  g.lineWidth = 3; g.beginPath(); g.arc(R, R, R - 80, 0, 7); g.stroke();
  g.fillStyle = '#d8a94a'; g.beginPath();
  for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? R * 0.34 : R * 0.7; g.lineTo(R + Math.cos(a) * r, R + Math.sin(a) * r); }
  g.closePath(); g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
  g.fillStyle = '#1a0f16'; g.beginPath(); g.arc(R, R, R * 0.3, 0, 7); g.fill();
  g.strokeStyle = '#d8a94a'; g.lineWidth = 6; g.beginPath(); g.arc(R, R, R * 0.3, 0, 7); g.stroke();
  g.fillStyle = '#f1d28a'; g.font = `700 ${R * 0.34}px Georgia, "Times New Roman", serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TM', R, R + 6);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.2, transparent: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); w.add(m);
}

function stanchions(w) {
  const postGeo = new THREE.CylinderGeometry(0.05, 0.06, 1.0, 10), baseGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.06, 16), capGeo = new THREE.SphereGeometry(0.09, 10, 8);
  const rope = plainMaterial(0x7a0f26, { roughness: 0.7 });
  const zs = [12, 8, 4, 0, -4, -8, -12, -16, -20];
  for (const sx of [-1, 1]) {
    const x = sx * 3.15;
    zs.forEach((z, i) => {
      add(w, postGeo, gold(), x, 0.55, z); add(w, baseGeo, gold(), x, 0.05, z); add(w, capGeo, gold(), x, 1.08, z);
      if (i > 0) {
        const p0 = new THREE.Vector3(x, 0.98, zs[i - 1]), p1 = new THREE.Vector3(x, 0.98, z), mid = p0.clone().lerp(p1, 0.5); mid.y -= 0.22;
        const curve = new THREE.CatmullRomCurve3([p0, mid, p1]);
        add(w, new THREE.TubeGeometry(curve, 12, 0.035, 6), rope, 0, 0, 0, { cast: false });
      }
    });
  }
}

// ---- outside the windows ---------------------------------------------------------------------------
export function citySkyline(w) {
  const mat = plainMaterial(0x14102a, { roughness: 0.9 });
  const ledMats = [glowMaterial(0xffc070, 1.6), glowMaterial(0x7aa8ff, 1.4), glowMaterial(0xffe6b0, 1.5)];
  let s = 7;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, r = 70 + rnd() * 170, h = 25 + rnd() * 95, ww = 8 + rnd() * 18;
    const x = Math.cos(a) * r, z = -4 + Math.sin(a) * r;
    add(w, new THREE.BoxGeometry(ww, h, ww), mat, x, h / 2 - 25, z, { cast: false, recv: false });
    const rows = 3 + Math.floor(rnd() * 5);
    for (let k = 0; k < rows; k++) add(w, new THREE.BoxGeometry(ww + 0.2, 0.55, ww + 0.2), ledMats[Math.floor(rnd() * 3)], x, -25 + h * (0.2 + rnd() * 0.75), z, { cast: false, recv: false });
  }
}

// ---- moonlight on the floor ------------------------------------------------------------------------
// The window's panes projected onto the floor along a fixed moon direction (additive, so it brightens whatever it falls on).
function windowPatchMaterial() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#fff'; g.fillRect(6, 6, 116, 244);
  g.fillStyle = '#000';
  g.fillRect(62, 0, 4, 256);                                    // the central mullion
  for (const f of [(5.6 - 3.4) / 7.2, (8.2 - 3.4) / 7.2]) g.fillRect(0, f * 256 - 3, 128, 6);   // the two transoms
  const fade = g.createLinearGradient(0, 0, 0, 256); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.7, 'rgba(0,0,0,0.25)'); fade.addColorStop(1, 'rgba(0,0,0,0.85)');
  g.fillStyle = fade; g.fillRect(0, 0, 128, 256);
  g.filter = 'blur(2px)'; g.drawImage(c, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: t, color: 0x6f8cff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
}

function windowPatch(w, mat, sx, c, WW, y0, y1) {
  const kx = 1.25, kz = 0.28;                                     // metres inward / sideways per metre of height
  const at = (y, dz) => [sx * (22 - y * kx), 0.055, c + dz + y * kz];
  const P = [at(y0, -WW / 2), at(y0, WW / 2), at(y1, WW / 2), at(y1, -WW / 2)];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex(sx < 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
  const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; m.renderOrder = 2; w.add(m);
}

// ---- the ceiling mural: a gold sunburst, ringed with the hotel's motto -----------------------------------
function ceilingMural(w) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), R = S / 2;
  const bg = g.createRadialGradient(R, R, 20, R, R, R); bg.addColorStop(0, '#2c2470'); bg.addColorStop(0.6, '#151b50'); bg.addColorStop(1, '#0a0f2c');
  g.fillStyle = bg; g.beginPath(); g.arc(R, R, R - 4, 0, 7); g.fill();
  g.save(); g.translate(R, R);
  for (let i = 0; i < 48; i++) { const a0 = (i / 48) * Math.PI * 2; g.fillStyle = i % 2 ? 'rgba(216,169,74,0.5)' : 'rgba(216,169,74,0.16)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R * 0.6, a0, a0 + Math.PI / 48); g.closePath(); g.fill(); }
  g.restore();
  g.strokeStyle = '#d8a94a';
  for (const [r, lw] of [[R - 10, 10], [R - 56, 4], [R * 0.66, 5], [R * 0.6, 3], [R * 0.3, 8]]) { g.lineWidth = lw; g.beginPath(); g.arc(R, R, r, 0, 7); g.stroke(); }
  g.fillStyle = '#0e0c26'; g.beginPath(); g.arc(R, R, R * 0.3 - 4, 0, 7); g.fill();
  g.fillStyle = '#f1d28a'; g.font = '700 150px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TM', R, R + 8);
  // the motto, set round the ring
  const text = 'TRUST ME  ✦  IT WILL BE FINE  ✦  TRUST ME  ✦  NOTHING CAN GO WRONG  ✦  ';
  g.font = '700 54px Georgia, serif'; g.fillStyle = '#e8c673';
  const ringR = R * 0.84, step = (Math.PI * 2) / text.length;
  for (let i = 0; i < text.length; i++) { g.save(); g.translate(R, R); g.rotate(i * step); g.translate(0, -ringR); g.fillText(text[i], 0, 0); g.restore(); }
  const rnd = (() => { let q = 3; return () => { q = (q * 9301 + 49297) % 233280; return q / 233280; }; })();
  g.fillStyle = 'rgba(255,240,200,0.8)';
  for (let i = 0; i < 70; i++) { const a = rnd() * 7, d = R * (0.64 + rnd() * 0.14); g.beginPath(); g.arc(R + Math.cos(a) * d, R + Math.sin(a) * d, 1.5 + rnd() * 2.2, 0, 7); g.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.82, 0.82, 0.82), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  w.onDispose(() => { tex.dispose(); mat.dispose(); });
  const m = new THREE.Mesh(new THREE.CircleGeometry(10, 64), mat);
  m.rotation.x = Math.PI / 2; m.rotation.z = Math.PI; m.position.set(0, L.H - 0.03, -4); m.matrixAutoUpdate = false; m.updateMatrix(); w.add(m);
}

// ================================================================================================
//  A generic grand hall (used by the level rooms): walls with a wainscot + cornice, coffered ceiling,
//  gold-capped pilasters and ceiling beams. Everything inside is up to the level.
// ================================================================================================
export function roomShell(w, o = {}) {
  const { x0 = -14, x1 = 14, z0 = -40, z1 = 14, yb = -10, H = L.H, wallTex = 'damask', wallColor = 0xffffff, ceilColor = 0xffffff, beamEvery = 8, pilasterEvery = 10, lamps = true } = o;
  const T = 1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0, hh = H - yb;
  const wallMat = { tex: wallTex, color: wallColor, roughness: 0.65 };
  w.plat({ x: x0 - T / 2, y: H, z: cz, w: T, d: D + 2 * T, h: hh, ...wallMat });
  w.plat({ x: x1 + T / 2, y: H, z: cz, w: T, d: D + 2 * T, h: hh, ...wallMat });
  w.plat({ x: cx, y: H, z: z0 - T / 2, w: W + 2 * T, d: T, h: hh, ...wallMat });
  w.plat({ x: cx, y: H, z: z1 + T / 2, w: W + 2 * T, d: T, h: hh, ...wallMat });
  w.plat({ x: cx, y: H + 1, z: cz, w: W + 2 * T, d: D + 2 * T, h: 1, tex: 'coffer', color: ceilColor, roughness: 0.8 });
  const sideBox = (side, u, n, y, len, th, h, op = {}) => {   // box hugging a side wall
    const x = side < 0 ? x0 + n : x1 - n;
    return w.box({ x, y, z: u, w: th, h, d: len, ...op });
  };
  for (const s of [-1, 1]) {
    sideBox(s, cz, 0.12, 1.3, D, 0.24, 2.6, { tex: 'panel', color: 0xffffff, shadow: false });
    sideBox(s, cz, 0.2, 2.7, D, 0.34, 0.12, { color: GOLD, metal: 1, rough: 0.3, shadow: false });
    sideBox(s, cz, 0.2, 0.14, D, 0.34, 0.28, { color: 0xece3cf, rough: 0.3, shadow: false });
    sideBox(s, cz, 0.35, H - 0.35, D, 0.8, 0.7, { color: 0xece3cf, rough: 0.35, shadow: false });
    sideBox(s, cz, 0.62, H - 0.72, D, 0.14, 0.16, { color: GOLD, metal: 1, rough: 0.3, shadow: false });
    for (let z = z1 - 4; z > z0 + 3; z -= pilasterEvery) {
      sideBox(s, z, 0.35, H / 2, 1.0, 0.7, H - 0.4, { color: 0xece3cf, rough: 0.25, shadow: false });
      sideBox(s, z, 0.4, 0.4, 1.3, 0.8, 0.5, { color: GOLD, metal: 1, rough: 0.3, shadow: false });
      sideBox(s, z, 0.4, H - 1.2, 1.3, 0.8, 0.5, { color: GOLD, metal: 1, rough: 0.3, shadow: false });
      if (lamps) {   // a sconce on every pilaster, but only the glow (no lights)
        const x = s < 0 ? x0 + 0.95 : x1 - 0.95;
        w.box({ x, y: 4.6, z, w: 0.3, h: 0.7, d: 0.3, glow: 0xffd8a0, glowIntensity: 1.5, shadow: false });
        halo(w, x, 4.7, z, 2.4, 0xffc070, 0.18);
      }
    }
  }
  for (const z of [z0, z1]) {
    const n = z === z0 ? 0.12 : -0.12;
    w.box({ x: cx, y: 1.3, z: z - n, w: W, h: 2.6, d: 0.24, tex: 'panel', color: 0xffffff, shadow: false });
    w.box({ x: cx, y: 2.7, z: z - n * 1.6, w: W, h: 0.12, d: 0.34, color: GOLD, metal: 1, rough: 0.3, shadow: false });
    w.box({ x: cx, y: H - 0.35, z: z - n * 3, w: W, h: 0.7, d: 0.8, color: 0xece3cf, rough: 0.35, shadow: false });
  }
  for (let z = z1 - 2; z > z0 + 1; z -= beamEvery) {
    w.box({ x: cx, y: H - 0.5, z, w: W, h: 0.9, d: 1.4, color: 0xe3d7bd, rough: 0.5, shadow: false });
    w.box({ x: cx, y: H - 1.0, z, w: W, h: 0.12, d: 1.5, color: GOLD, metal: 1, rough: 0.3, shadow: false });
  }
  return { cx, cz, W, D };
}
export { halo as hotelHalo };
