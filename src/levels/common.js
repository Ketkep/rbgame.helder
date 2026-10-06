import * as THREE from 'three';
import { glowMaterial, plainMaterial } from '../engine/materials.js';

let _gradTex = null;
function fadeTexture() {
  if (_gradTex) return _gradTex;
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#fff'); g.addColorStop(1, '#000'); // bright at the lamp (cone top), fading toward the floor
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 64);
  _gradTex = new THREE.CanvasTexture(c);
  return _gradTex;
}

/** Studio spotlight: a lamp can + a soft additive cone pointing at a target. */
export function spot(w, { x, y, z, tx, ty, tz, color = 0xfff0cc, len = null, r = 3.4, opacity = 0.09, lamp = true }) {
  const from = new THREE.Vector3(x, y, z), to = new THREE.Vector3(tx, ty, tz);
  const dir = to.clone().sub(from);
  const L = len ?? dir.length();
  dir.normalize();
  const geo = new THREE.CylinderGeometry(0.2, r, L, 28, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, alphaMap: fadeTexture(), blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(geo, mat);
  cone.position.copy(from).addScaledVector(dir, L / 2);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  cone.matrixAutoUpdate = false; cone.updateMatrix();
  w.add(cone);
  if (lamp) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 0.9, 16), plainMaterial(0x23242f, { metalness: 0.6, roughness: 0.35 }));
    can.position.copy(from); can.quaternion.copy(cone.quaternion); can.castShadow = true;
    can.matrixAutoUpdate = false; can.updateMatrix();
    w.add(can);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.33, 16), glowMaterial(color, 3));
    lens.position.copy(from).addScaledVector(dir, 0.46); lens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    lens.matrixAutoUpdate = false; lens.updateMatrix();
    w.add(lens);
  }
  return cone;
}

/** Slowly rotating floating shapes for set dressing / depth. */
export function floaters(w, { count = 14, x = [-70, 70], y = [4, 40], z = [-20, -170], colors = [0xff4d5e, 0x2dd4bf, 0xffc83d, 0x8b6cff], size = [1.5, 4], avoid = null, seed = 1 }) {
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const geos = [new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1.1, 0), new THREE.TorusGeometry(1, 0.32, 10, 24), new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.TetrahedronGeometry(1.3, 0)];
  const items = [];
  for (let i = 0; i < count; i++) {
    const col = colors[Math.floor(rnd() * colors.length)];
    const m = new THREE.Mesh(geos[Math.floor(rnd() * geos.length)], new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.1, emissive: col, emissiveIntensity: 0.18, flatShading: true }));
    const k = size[0] + rnd() * (size[1] - size[0]);
    let px = x[0] + rnd() * (x[1] - x[0]), pz = z[0] + rnd() * (z[1] - z[0]);
    if (avoid && Math.abs(px) < avoid) px += Math.sign(px || 1) * avoid;
    m.position.set(px, y[0] + rnd() * (y[1] - y[0]), pz);
    m.scale.setScalar(k);
    m.castShadow = true;
    m.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
    items.push({ m, sx: (rnd() - 0.5) * 0.5, sy: (rnd() - 0.5) * 0.6, bob: rnd() * 6, y0: m.position.y });
    w.add(m);
  }
  w.onUpdate((dt, t) => { for (const it of items) { it.m.rotation.x += it.sx * dt; it.m.rotation.y += it.sy * dt; it.m.position.y = it.y0 + Math.sin(t * 0.4 + it.bob) * 0.8; } });
  return items;
}

/** A "gate" you can move: two pillars, a lintel and a banner. Returns { group, setZ }. */
export function makeGate(w, { x = 0, y = 0, z = 0, width = 6, label = 'FINISH', color = 0x2dd4bf }) {
  const g = new THREE.Group();
  const pm = plainMaterial(0xf4f2ee, { roughness: 0.4 });
  const pl = (px) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), pm); m.position.set(px, 2.5, 0); m.castShadow = true; g.add(m); };
  pl(-width / 2 - 0.25); pl(width / 2 + 0.25);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + 1.2, 0.5, 0.6), pm); lintel.position.y = 5.1; lintel.castShadow = true; g.add(lintel);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(width + 0.9, 0.12, 0.64), glowMaterial(color, 2)); strip.position.y = 4.8; g.add(strip);
  // banner is built by the caller with w.sign() then parented here
  const banner = w.sign({ text: label, x: 0, y: 6.1, z: 0, w: width + 1, h: 1.5, bg: '#12131c', color: '#ffffff', border: '#' + new THREE.Color(color).getHexString(), size: 90 });
  w.scene.remove(banner); g.add(banner); banner.position.set(0, 6.1, 0);
  // checkered line on the floor
  g.position.set(x, y, z);
  w.add(g);
  return { group: g, setZ(nz) { g.position.z = nz; } };
}

export function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

/** Sequential platform builder along -Z. Returns the list of created plats. */
export function chain(w, { x = 0, y = 0, z = 0 }, specs) {
  let cz = z; // current trailing edge (the far edge of the last platform), moving toward -Z
  let cy = y;
  const out = [];
  for (const s of specs) {
    const d = s.d ?? 5, wd = s.w ?? 5, gap = s.gap ?? 2;
    cz -= gap; cy += s.dy ?? 0;
    const p = w.plat({ x: s.x ?? x, y: cy, z: cz - d / 2, w: wd, d, h: s.h ?? 1, style: s.style, tex: s.tex, color: s.color, trim: s.trim, path: true });
    out.push(p);
    cz -= d;
  }
  out.endZ = cz; out.endY = cy;
  return out;
}

/**
 * A cursor that lays platforms end to end along -Z. `gap` is the empty distance (metres) between the
 * previous platform's far edge and this one's near edge; dy raises/lowers the top surface.
 */
export function cursor(w, { y = 0, z = 0 } = {}) {
  const c = { y, z };
  c.place = (o = {}) => {
    const { gap = 2.4, d = 4, wd = 4, dy = 0, x = 0, h = 1 } = o;
    c.z -= gap; c.y += dy;
    const p = w.plat({ ...o, x, y: c.y, z: c.z - d / 2, w: wd, d, h, path: true });
    c.z -= d;
    return p;
  };
  return c;
}

/** Trigger volume sitting on top of a platform (for narrator beats). */
export function onPlat(w, plat, fn, { once = true, h = 2.6 } = {}) {
  return w.trigger({ x: plat.body.x, y: plat.top + h / 2, z: plat.body.z, w: Math.max(1, plat.o.w - 0.6), h, d: Math.max(1, plat.o.d - 0.6), once, onEnter: fn });
}

/** Distant floating islands for depth. */
export function farIslands(w, { count = 14, x = [-180, 180], y = [-40, 30], z = [40, -320], avoid = 30, seed = 5, top = 0x86b38c, rock = 0x6e5a6a } = {}) {
  let s = seed * 7919 + 13;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const topMat = new THREE.MeshStandardMaterial({ color: top, roughness: 0.9, flatShading: true });
  const rockMat = new THREE.MeshStandardMaterial({ color: rock, roughness: 0.95, flatShading: true });
  for (let i = 0; i < count; i++) {
    const r = 6 + rnd() * 16;
    let px = x[0] + rnd() * (x[1] - x[0]);
    if (Math.abs(px) < avoid) px += Math.sign(px || 1) * avoid;
    const g = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 1.6, 8), topMat); cap.castShadow = true;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 0.92, r * 1.6, 8), rockMat); cone.rotation.x = Math.PI; cone.position.y = -0.8 - r * 0.8;
    g.add(cap, cone);
    g.position.set(px, y[0] + rnd() * (y[1] - y[0]), z[0] + rnd() * (z[1] - z[0]));
    g.rotation.y = rnd() * 6;
    w.add(g);
  }
}

/** Glowing floating orbs (lanterns, fireflies, data motes…). */
export function orbs(w, { count = 20, x = [-30, 30], y = [0, 14], z = [0, -250], color = 0xffd58a, size = 0.22, intensity = 2.2 } = {}) {
  const items = [];
  const mat = glowMaterial(color, intensity);
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 10), mat);
    m.position.set(x[0] + Math.random() * (x[1] - x[0]), y[0] + Math.random() * (y[1] - y[0]), z[0] + Math.random() * (z[1] - z[0]));
    items.push({ m, y0: m.position.y, ph: Math.random() * 6 });
    w.add(m);
  }
  w.onUpdate((dt, t) => { for (const it of items) it.m.position.y = it.y0 + Math.sin(t * 0.7 + it.ph) * 0.6; });
}

/** On/off pulsing laser across a path. `warn` seconds of flicker before it fires. Returns the hazard. */
export function pulseLaser(w, { x, y, z, width, depth = 0.14, period = 3, on = 1.1, offset = 0, warn = 0.55, color = 0xff2d4d, axis = 'x' }) {
  const hz = w.hazard({ x, y, z, w: axis === 'x' ? width : depth, h: 0.16, d: axis === 'x' ? depth : width, color });
  // emitter posts
  const posts = [-1, 1].map((s) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.9, 10), plainMaterial(0x2a2b36, { metalness: 0.6, roughness: 0.3 }));
    m.position.set(axis === 'x' ? x + s * (width / 2 + 0.2) : x, y - 0.1, axis === 'x' ? z : z + s * (width / 2 + 0.2));
    w.add(m); return m;
  });
  const lamp = (m) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), glowMaterial(color, 2.2)); l.position.copy(m.position); l.position.y += 0.55; w.add(l); return l; };
  const lamps = posts.map(lamp);
  w.onUpdate((dt, t) => {
    const ph = (t + offset) % period;
    const live = ph < on;
    const warning = !live && ph > period - warn;
    hz.enabled = live;
    hz.group.visible = live || (warning && Math.floor(t * 18) % 2 === 0);
    hz.core.material.opacity = live ? 0.9 : 0.3;
    for (const l of lamps) l.scale.setScalar(live ? 1.5 : warning ? 1.2 : 0.7);
  });
  return hz;
}
