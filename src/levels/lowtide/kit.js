import * as THREE from 'three';
import { boxGeometry, softTexture } from '../../engine/materials.js';
import { horrorSurface, decalTexture } from './materials.js';
import { horrorEnv } from './horror.js';

// Lowtide building blocks: grimy rooms, doors, props and decals. Everything solid goes through w.plat / w.collider (so the co-op physics and
// bots work exactly as in 2 Player Mode); everything decorative is a plain mesh. Units are metres; walls are 3.4 m high, 0.3 m thick.

export { horrorEnv };

const M = {
  steel: () => new THREE.MeshStandardMaterial({ color: 0x8e9996, roughness: 0.42, metalness: 0.85 }),
  darkSteel: () => new THREE.MeshStandardMaterial({ color: 0x2a3034, roughness: 0.5, metalness: 0.8 }),
  mattress: () => new THREE.MeshStandardMaterial({ color: 0x9aa39a, roughness: 0.95, metalness: 0 }),
  leather: () => new THREE.MeshStandardMaterial({ color: 0x2b1d16, roughness: 0.6, metalness: 0.1 }),
  sheet: () => new THREE.MeshStandardMaterial({ color: 0xb9bdb0, roughness: 1, metalness: 0 }),
  cloth: () => new THREE.MeshStandardMaterial({ color: 0x56655e, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
  glassDark: () => new THREE.MeshStandardMaterial({ color: 0x07121a, roughness: 0.08, metalness: 0.9 }),
  paper: () => new THREE.MeshStandardMaterial({ color: 0xcfc8b0, roughness: 0.95 }),
};
const memo = new Map();
const mat = (k) => { if (!memo.has(k)) memo.set(k, M[k]()); return memo.get(k); };

/** A decorative box (no collision) with a Lowtide surface. */
export function box(w, { x, y, z, w: ww, h, d, kind = 'concrete', color = 0xffffff, rough = 0.9, rot = 0, shadow = true, bump = 1 }) {
  const m = new THREE.Mesh(boxGeometry(ww, h, d, Math.min(0.03, h / 4)), horrorSurface(kind, { color, roughness: rough, bump }));
  m.position.set(x, y, z); m.rotation.y = rot; m.castShadow = shadow; m.receiveShadow = true; w.add(m); return m;
}
const mesh = (w, geo, material, x, y, z, rot = 0, shadow = true) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.rotation.y = rot; m.castShadow = shadow; m.receiveShadow = true; w.add(m); return m; };

/** A solid platform wearing a Lowtide surface. `y` is the TOP. */
export function hp(w, o) {
  const { kind = 'lino', color = 0xffffff, rough = 0.85, bump = 1.2, ...rest } = o;
  const p = w.plat({ h: 1, ...rest, trim: null, edge: null });
  const body = p.group.children[0]; body.material = horrorSurface(kind, { color, roughness: rough, bump });
  for (let i = p.group.children.length - 1; i > 0; i--) { const c = p.group.children[i]; if (c.isLineSegments || c.material?.type === 'MeshBasicMaterial') p.group.remove(c); }
  return p;
}
export const floor = (w, o) => hp(w, { kind: 'lino', y: 0, h: 1, path: true, ...o });
export const wall = (w, o) => hp(w, { kind: 'plaster', y: 0, ...o, h: o.h ?? 3.4, y: (o.y ?? 0) + (o.h ?? 3.4), rough: 0.95 });

/**
 * A room: floor, ceiling, four walls with door gaps and door frames.
 *   doors: { n: [{ c, w }], s: [], e: [], w: [] }  (c = centre offset along that wall, w = gap width; n = -z side, s = +z side)
 *   sides: set a side to false to leave it open (no wall at all), e.g. when it is a shared wall someone else builds.
 */
export function room(w, o) {
  const { x, z, w: W, d: D, h = 3.4, y = 0, doors = {}, floorKind = 'lino', wallKind = 'plaster', ceilKind = 'concrete', sides = {}, ceil = true, t = 0.3, path = true } = o;
  const out = { x, z, w: W, d: D, h, y, floor: hp(w, { x, y, z, w: W, d: D, h: 1, kind: floorKind, path }), walls: [] };
  const seg = (cx, cz, sw, sd, kind = wallKind) => { if (sw < 0.05 || sd < 0.05) return; out.walls.push(wall(w, { x: cx, z: cz, w: sw, d: sd, y, h, kind })); };
  const frame = (cx, cz, along, gap, axis) => {                                              // jambs + lintel around a doorway
    const dh = Math.min(2.5, h - 0.2);
    const j = 0.14;
    if (axis === 'x') { box(w, { x: cx - gap / 2 - j / 2, y: y + dh / 2, z: cz, w: j, h: dh, d: t + 0.12, kind: 'rust', color: 0x7a8a86 }); box(w, { x: cx + gap / 2 + j / 2, y: y + dh / 2, z: cz, w: j, h: dh, d: t + 0.12, kind: 'rust', color: 0x7a8a86 }); box(w, { x: cx, y: y + dh + 0.07, z: cz, w: gap + j * 2, h: 0.14, d: t + 0.12, kind: 'rust', color: 0x7a8a86 }); }
    else { box(w, { x: cx, y: y + dh / 2, z: cz - gap / 2 - j / 2, w: t + 0.12, h: dh, d: j, kind: 'rust', color: 0x7a8a86 }); box(w, { x: cx, y: y + dh / 2, z: cz + gap / 2 + j / 2, w: t + 0.12, h: dh, d: j, kind: 'rust', color: 0x7a8a86 }); box(w, { x: cx, y: y + dh + 0.07, z: cz, w: t + 0.12, h: 0.14, d: gap + j * 2, kind: 'rust', color: 0x7a8a86 }); }
    void along;
  };
  const side = (name, axis, cx, cz, len) => {          // axis 'x': wall runs along x at z=cz; 'z': along z at x=cx
    if (sides[name] === false) return;
    const gaps = (doors[name] || []).slice().sort((a, b) => a.c - b.c);
    let cur = -len / 2;
    for (const g of gaps) {
      const a = g.c - g.w / 2, b = g.c + g.w / 2;
      const dh = Math.min(2.5, h - 0.2);
      if (axis === 'x') { seg(cx + (cur + a) / 2, cz, a - cur, t); box(w, { x: cx + g.c, y: y + dh + (h - dh) / 2, z: cz, w: g.w, h: h - dh, d: t, kind: wallKind, shadow: true }); frame(cx + g.c, cz, 'x', g.w, 'x'); }
      else { seg(cx, cz + (cur + a) / 2, t, a - cur); box(w, { x: cx, y: y + dh + (h - dh) / 2, z: cz + g.c, w: t, h: h - dh, d: g.w, kind: wallKind }); frame(cx, cz + g.c, 'z', g.w, 'z'); }
      cur = b;
    }
    if (axis === 'x') seg(cx + (cur + len / 2) / 2, cz, len / 2 - cur, t); else seg(cx, cz + (cur + len / 2) / 2, t, len / 2 - cur);
  };
  side('n', 'x', x, z - D / 2, W); side('s', 'x', x, z + D / 2, W); side('w', 'z', x - W / 2, z, D); side('e', 'z', x + W / 2, z, D);
  if (ceil) box(w, { x, y: y + h + 0.25, z, w: W + 0.6, h: 0.5, d: D + 0.6, kind: ceilKind, shadow: false });
  // skirting boards
  if (sides.n !== false) box(w, { x, y: y + 0.09, z: z - D / 2 + t / 2 + 0.03, w: W - t, h: 0.18, d: 0.05, kind: 'concrete', color: 0x555c58, shadow: false });
  if (sides.s !== false) box(w, { x, y: y + 0.09, z: z + D / 2 - t / 2 - 0.03, w: W - t, h: 0.18, d: 0.05, kind: 'concrete', color: 0x555c58, shadow: false });
  return out;
}

/** A flat decal (blood, scratches, a handprint, a puddle) laid on a wall or floor. */
export function decal(w, { kind = 'splat', seed = 1, x, y, z, w: ww = 1, h = 1, face = 'floor', rot = 0, opacity = 0.9, color = 0xffffff }) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, h), new THREE.MeshStandardMaterial({ map: decalTexture(kind, seed), transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: kind === 'puddle' ? 0.05 : 0.5, metalness: kind === 'puddle' ? 0.9 : 0.1, color }));
  m.position.set(x, y, z);
  if (face === 'floor') { m.rotation.x = -Math.PI / 2; m.rotation.z = rot; }
  else { m.rotation.y = { n: 0, s: Math.PI, e: -Math.PI / 2, w: Math.PI / 2 }[face] ?? rot; }          // 'n' = on a wall facing +z
  m.renderOrder = 2; w.add(m); return m;
}

// ------------------------------------------------------------------ props -----------------------------------------------------
/** A hospital bed. strapped: leather restraints across the body and wrists. */
export function bed(w, { x, y = 0, z, rot = 0, strapped = false, messy = true, solid = true }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  const steel = mat('steel');
  for (const [px, pz] of [[-0.42, -0.95], [0.42, -0.95], [-0.42, 0.95], [0.42, 0.95]]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), steel, px, 0.25, pz);
  add(new THREE.BoxGeometry(0.92, 0.05, 2.0), steel, 0, 0.5, 0);
  add(new THREE.BoxGeometry(0.88, 0.16, 1.9), mat('mattress'), 0, 0.61, 0);
  add(new THREE.BoxGeometry(0.55, 0.1, 0.34), mat('sheet'), 0, 0.74, -0.7);
  for (const px of [-0.45, 0.45]) add(new THREE.BoxGeometry(0.04, 0.5, 0.04), steel, px, 0.9, -1.0);
  add(new THREE.BoxGeometry(0.94, 0.06, 0.05), steel, 0, 1.1, -1.0);
  add(new THREE.BoxGeometry(0.94, 0.05, 0.05), steel, 0, 0.9, 1.0);
  if (messy) { const s = add(new THREE.BoxGeometry(0.9, 0.06, 1.2), mat('sheet'), 0.05, 0.72, 0.35); s.rotation.z = 0.09; s.rotation.x = -0.05; }
  if (strapped) {
    for (const pz of [-0.3, 0.45]) add(new THREE.BoxGeometry(1.0, 0.04, 0.12), mat('leather'), 0, 0.73, pz);
    for (const px of [-0.46, 0.46]) { add(new THREE.BoxGeometry(0.1, 0.045, 0.2), mat('leather'), px, 0.7, -0.6); add(new THREE.BoxGeometry(0.1, 0.045, 0.2), mat('leather'), px, 0.7, 0.8); }
  }
  if (solid) w.collider({ x, y: y + 0.4, z, w: Math.abs(Math.cos(rot)) > 0.7 ? 0.95 : 2.05, h: 0.8, d: Math.abs(Math.cos(rot)) > 0.7 ? 2.05 : 0.95 });
  return g;
}

/** A locker (hiding spot candidate). door: 0 closed .. 1 ajar. Returns the group. */
export function locker(w, { x, y = 0, z, rot = 0, ajar = 0, solid = true, color = 0x5d6b66 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.9, 0.5), horrorSurface('rust', { color, roughness: 0.55, metalness: 0.7, bump: 1.6 })); body.position.y = 0.95; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const door = new THREE.Group(); door.position.set(-0.3, 0, 0.26); door.rotation.y = -ajar * 1.2; g.add(door);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.86, 0.03), horrorSurface('rust', { color: new THREE.Color(color).multiplyScalar(1.05).getHex(), roughness: 0.5, metalness: 0.7, bump: 1.6 })); leaf.position.set(0.3, 0.95, 0.015); leaf.castShadow = true; door.add(leaf);
  for (let i = 0; i < 5; i++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.04), mat('darkSteel')); v.position.set(0.3, 1.5 + i * 0.07, 0.04); door.add(v); }
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.04), mat('darkSteel')); h.position.set(0.5, 1.0, 0.05); door.add(h);
  if (solid) w.collider({ x, y: y + 0.95, z, w: Math.abs(Math.cos(rot)) > 0.7 ? 0.6 : 0.5, h: 1.9, d: Math.abs(Math.cos(rot)) > 0.7 ? 0.5 : 0.6 });
  g.userData.door = door;
  return g;
}

/** A hanging hospital curtain on a ceiling track (soft, non-solid, slightly translucent-looking). */
export function curtain(w, { x, y = 0, z, width = 2.6, rot = 0, h = 2.3, open = 0 }) {
  const geo = new THREE.PlaneGeometry(width * (1 - open * 0.7), h, 18, 1);
  const pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin((pa.getX(i) / width) * Math.PI * 9) * 0.07);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat('cloth')); m.position.set(x - (open * width * 0.35), y + 3.1 - h / 2, z); m.rotation.y = rot; m.castShadow = true; w.add(m);
  box(w, { x, y: y + 3.2, z, w: width + 0.1, h: 0.04, d: 0.05, kind: 'rust', color: 0x888899, shadow: false, rot });
  return m;
}

/** A wheeled gurney / trolley. */
export function gurney(w, { x, y = 0, z, rot = 0, solid = true }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(0.7, 0.05, 1.9), mat('steel'), 0, 0.85, 0);
  add(new THREE.BoxGeometry(0.64, 0.08, 1.8), mat('mattress'), 0, 0.92, 0);
  for (const [px, pz] of [[-0.3, -0.8], [0.3, -0.8], [-0.3, 0.8], [0.3, 0.8]]) { add(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 6), mat('steel'), px, 0.45, pz); add(new THREE.SphereGeometry(0.05, 8, 6), mat('darkSteel'), px, 0.05, pz); }
  add(new THREE.BoxGeometry(0.6, 0.03, 1.5), mat('steel'), 0, 0.4, 0);
  const sheet = add(new THREE.BoxGeometry(0.66, 0.05, 1.0), mat('sheet'), 0, 0.99, 0.2); sheet.rotation.z = 0.05;
  if (solid) w.collider({ x, y: y + 0.5, z, w: Math.abs(Math.cos(rot)) > 0.7 ? 0.75 : 1.95, h: 1.0, d: Math.abs(Math.cos(rot)) > 0.7 ? 1.95 : 0.75 });
  return g;
}

/** A wheelchair, turned to face something. */
export function wheelchair(w, { x, y = 0, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const add = (geo, m, px, py, pz, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.rotation.x = rx; o.castShadow = true; g.add(o); return o; };
  for (const px of [-0.27, 0.27]) { const t = add(new THREE.TorusGeometry(0.3, 0.02, 6, 20), mat('darkSteel'), px, 0.32, 0.05); t.rotation.y = Math.PI / 2; }
  add(new THREE.BoxGeometry(0.46, 0.05, 0.44), mat('leather'), 0, 0.52, 0);
  add(new THREE.BoxGeometry(0.46, 0.5, 0.05), mat('leather'), 0, 0.8, -0.22);
  for (const px of [-0.24, 0.24]) add(new THREE.BoxGeometry(0.03, 0.03, 0.4), mat('steel'), px, 0.62, 0);
  w.collider({ x, y: y + 0.45, z, w: 0.7, h: 0.9, d: 0.8 });
  return g;
}

/** A ceiling pipe run with a few valves (decor). */
export function pipes(w, { x0, z0, x1, z1, y = 3.0, n = 2 }) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
  for (let i = 0; i < n; i++) {
    const r = 0.06 + i * 0.03;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), horrorSurface('rust', { roughness: 0.55, metalness: 0.8 }));
    m.rotation.x = Math.PI / 2; const grp = new THREE.Group(); grp.add(m); grp.position.set((x0 + x1) / 2 + Math.cos(ang) * (i - 0.5) * 0.28, y + 0.15 - i * 0.1, (z0 + z1) / 2 - Math.sin(ang) * (i - 0.5) * 0.28); grp.rotation.y = ang; w.add(grp);
    for (let k = 1; k < 4; k++) { const j = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.4, r * 1.4, 0.12, 10), mat('darkSteel')); j.rotation.x = Math.PI / 2; j.position.set(0, 0, -len / 2 + (len * k) / 4); grp.add(j); }
  }
}

/** A desk with papers, for records and the nurses' station. Solid. */
export function desk(w, { x, y = 0, z, rot = 0, papers = true }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.8), horrorSurface('wood', { roughness: 0.7, bump: 1 })); top.position.y = 0.76; top.castShadow = true; top.receiveShadow = true; g.add(top);
  for (const [px, pz] of [[-0.74, -0.34], [0.74, -0.34], [-0.74, 0.34], [0.74, 0.34]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.76, 0.06), mat('darkSteel')); l.position.set(px, 0.38, pz); g.add(l); }
  const dr = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.7), horrorSurface('wood', { roughness: 0.8, bump: 1 })); dr.position.set(0.5, 0.45, 0); g.add(dr);
  if (papers) for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.005, 0.3), mat('paper')); p.position.set(-0.5 + i * 0.16, 0.795 + i * 0.004, -0.1 + (i % 2) * 0.12); p.rotation.y = (i - 2) * 0.35; g.add(p); }
  w.collider({ x, y: y + 0.4, z, w: Math.abs(Math.cos(rot)) > 0.7 ? 1.65 : 0.85, h: 0.8, d: Math.abs(Math.cos(rot)) > 0.7 ? 0.85 : 1.65 });
  return g;
}

/** A barred, wire-glass window with the dark tide behind it (a faint moonlit shimmer). */
export function window(w, { x, y = 1.7, z, rot = 0, width = 1.6, height = 1.1, glow = 0x1a3a46 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: new THREE.Color(glow).multiplyScalar(1.4), toneMapped: false })); pane.position.z = 0.01; g.add(pane);
  for (let i = -2; i <= 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, height + 0.1, 0.04), mat('darkSteel')); b.position.set(i * width / 5, 0, 0.05); g.add(b); }
  for (let j = -1; j <= 1; j++) { const b = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.025, 0.03), mat('darkSteel')); b.position.set(0, j * height / 3, 0.04); g.add(b); }
  const fr = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, height + 0.2, 0.08), mat('darkSteel')); fr.position.z = -0.03; g.add(fr);
  return g;
}

/** A painted stencil on a wall ("WARD B", "DO NOT"…). */
export function stencil(w, text, { x, y = 2.2, z, rot = 0, size = 0.5, color = '#c9d3cc', width = 4 }) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  g.font = `700 ${Math.floor(256 * size * 1.5)}px "Archivo Black", Impact, sans-serif`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = 0.75; g.fillText(text, 512, 128);
  g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.7})`; g.fillRect(Math.random() * 1024, Math.random() * 256, 2 + Math.random() * 12, 1 + Math.random() * 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, color: 0x9aa8a0 }));
  m.position.set(x, y, z); m.rotation.y = rot; w.add(m); return m;
}

/** The way out: a steel door left slightly open on a cold white room, a dim green EXIT lamp, and the (invisible) goal both of you must stand in. */
export function exitDoor(w, { x, y = 0, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const add = (geo, m, px, py, pz, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.rotation.y = ry; o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(2.4, 2.6, 0.3), horrorSurface('rust', { color: 0x4d5a56, roughness: 0.6, metalness: 0.7 }), 0, 1.3, -0.2);
  add(new THREE.PlaneGeometry(1.7, 2.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xcfe8ee).multiplyScalar(1.6), toneMapped: false }), 0, 1.2, -0.05);
  add(new THREE.BoxGeometry(0.9, 2.3, 0.06), horrorSurface('rust', { color: 0x5d6b66, roughness: 0.55, metalness: 0.7 }), -0.6, 1.2, 0.02, 0.9);
  add(new THREE.BoxGeometry(0.5, 0.18, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3dff7a).multiplyScalar(1.6), toneMapped: false }), 0, 2.8, 0.0);
  const L = new THREE.PointLight(0xcfe8ee, 14, 12, 1.8); L.position.set(0, 1.4, 0.6); g.add(L);
  w.goal({ x, y, z: z + Math.cos(rot) * 0.6, hidden: true });
  return g;
}

/** A safe-point: a small emergency lamp on a stand. Amber until one of you walks past it, then green (and your spawn moves here). */
export function checkpoint(w, { x, y = 0, z, side = 1 }) {
  const cp = w.checkpoint({ x, y, z, real: true, hidden: true });
  const g = new THREE.Group(); g.position.set(x + side * 1.1, y, z); w.add(g);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.2, 8), mat('darkSteel')); post.position.y = 0.6; post.castShadow = true; g.add(post);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), mat('darkSteel')); head.position.y = 1.3; g.add(head);
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a2a).multiplyScalar(2.4), toneMapped: false });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), bulbMat); bulb.position.set(0, 1.3, 0.1); g.add(bulb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xff8a2a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.position.set(0, 1.3, 0.12); halo.scale.setScalar(1.3); g.add(halo);
  let was = false;
  w.updaters.push(() => {
    if (cp.used && !was) { was = true; bulbMat.color.copy(new THREE.Color(0x3dff7a).multiplyScalar(2.2)); halo.material.color.setHex(0x3dff7a); }
    halo.material.opacity = (was ? 0.4 : 0.5) + Math.sin(w.t * (was ? 1.4 : 3.2) + x) * 0.12;
  });
  return cp;
}
