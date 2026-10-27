import * as THREE from 'three';
import { hp, box } from './kit.js';
import { horrorSurface } from './materials.js';
import { softTexture } from '../../engine/materials.js';

// Props for chapter 7 (The Director): the grand office wing. Wainscoting, oil portraits with plaques, a chandelier, rugs, a wall safe, a bank of
// deposit boxes, a maintenance panel (screws, three plug sockets), a mirror that shows only you, a reel projector, a private HUD timer.
// Everything solid goes through w.collider / hp like the rest of the Lowtide kit.

const PI = Math.PI;
const rotOf = (nx, nz) => Math.atan2(nx, nz);
const cv = (cw, ch) => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; return [c, c.getContext('2d')]; };
const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const rnd = (s) => { let a = (s | 0) + 0x6d2b79f5; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const dark = () => horrorSurface('rust', { color: 0x3c4542, roughness: 0.55, metalness: 0.7, bump: 1.2 });
const metal = (c = 0x1b2024) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.7 });
const glowMat = (color, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });
/** world point for local (lx, ly) on a wall fixture at (x,z) facing (nx,nz) */
export const onWall = (x, z, nx, nz, lx, off = 0) => { const ry = rotOf(nx, nz); return { x: x + Math.cos(ry) * lx + nx * off, z: z - Math.sin(ry) * lx + nz * off }; };

// ------------------------------------------------------------------------------------------------------------ dressing -----
/** Dark wood panelling along the foot of a wall. along 'x': the wall runs along x at z; side +1 = the room is on the +z side. */
export function wainscot(w, { x, z, len, along = 'x', side = 1, h = 1.15, color = 0x4d3828 }) {
  const off = side * 0.2;
  if (along === 'x') { box(w, { x, y: h / 2, z: z + off, w: len, h, d: 0.1, kind: 'wood', color, shadow: false }); box(w, { x, y: h + 0.03, z: z + off, w: len, h: 0.07, d: 0.15, kind: 'wood', color: 0x2c1e14, shadow: false }); }
  else { box(w, { x: x + off, y: h / 2, z, w: 0.1, h, d: len, kind: 'wood', color, shadow: false }); box(w, { x: x + off, y: h + 0.03, z, w: 0.15, h: 0.07, d: len, kind: 'wood', color: 0x2c1e14, shadow: false }); }
}
/** A flat rug (decor). */
export function rug(w, { x, z, w: ww, d, color = 0x5a1c22, rot = 0 }) {
  box(w, { x, y: 0.02, z, w: ww, h: 0.04, d, kind: 'padded', color, rough: 1, shadow: false, rot });
  box(w, { x, y: 0.045, z, w: ww - 0.5, h: 0.01, d: d - 0.5, kind: 'padded', color: new THREE.Color(color).multiplyScalar(0.7).getHex(), rough: 1, shadow: false, rot });
}
/** A heavy oil portrait on a wall with a brass plaque. empty: a bare canvas in the frame. */
export function portrait(w, { x, y = 2.0, z, nx = 0, nz = 1, seed = 1, width = 1.0, height = 1.35, plaque = '', empty = false, onPlaque }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotOf(nx, nz); w.add(g);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.28, height + 0.28, 0.1), horrorSurface('wood', { color: 0x6a5230, roughness: 0.5, metalness: 0.3 })); frame.position.z = 0.05; frame.castShadow = true; g.add(frame);
  const [c, q] = cv(256, 340), R = rnd(seed * 31 + 5);
  const grad = q.createLinearGradient(0, 0, 0, 340); grad.addColorStop(0, empty ? '#1a1814' : '#2a2418'); grad.addColorStop(1, empty ? '#0e0d0b' : '#0f1210'); q.fillStyle = grad; q.fillRect(0, 0, 256, 340);
  if (!empty) {
    const cx = 128 + (R() - 0.5) * 10;
    q.fillStyle = '#0b0c0d'; q.beginPath(); q.ellipse(cx, 340, 112, 120, 0, 0, 7); q.fill();                       // coat
    q.fillStyle = '#b8b2a0'; q.beginPath(); q.moveTo(cx - 30, 232); q.lineTo(cx, 262); q.lineTo(cx + 30, 232); q.lineTo(cx + 22, 222); q.lineTo(cx - 22, 222); q.fill();   // collar
    const sk = q.createRadialGradient(cx - 10, 150, 6, cx, 160, 72); sk.addColorStop(0, '#a89a82'); sk.addColorStop(1, '#40382c');
    q.fillStyle = sk; q.beginPath(); q.ellipse(cx, 160, 46 + R() * 8, 62 + R() * 8, 0, 0, 7); q.fill();
    q.fillStyle = '#17120e'; q.beginPath(); q.ellipse(cx, 112, 50, 30, 0, PI, 0); q.fill();                         // hair
    q.fillStyle = '#050505'; for (const ex of [-18, 18]) { q.beginPath(); q.ellipse(cx + ex, 152, 8, 5 + R() * 2, 0, 0, 7); q.fill(); }
    q.strokeStyle = '#2a1c14'; q.lineWidth = 3; q.beginPath(); q.moveTo(cx - 14, 196); q.quadraticCurveTo(cx, 196 + (R() - 0.5) * 8, cx + 14, 196); q.stroke();
  }
  q.globalAlpha = 0.5; q.fillStyle = '#000'; for (let i = 0; i < 160; i++) q.fillRect(R() * 256, R() * 340, 1 + R() * 20, 1);   // cracked varnish
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.55 })); pic.position.z = 0.105; g.add(pic);
  if (plaque !== null) {
    const [pc, pq] = cv(256, 64); const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.155), new THREE.MeshStandardMaterial({ map: tex(pc), roughness: 0.4, metalness: 0.6 })); plate.position.set(0, -height / 2 - 0.3, 0.07); g.add(plate);
    const draw = (txt) => { pq.fillStyle = '#6b5a2c'; pq.fillRect(0, 0, 256, 64); pq.fillStyle = '#1c1608'; pq.font = '700 15px Georgia, serif'; pq.textAlign = 'center'; pq.textBaseline = 'middle'; const lines = String(txt).split('\n'); lines.forEach((l, i) => pq.fillText(l, 128, 32 + (i - (lines.length - 1) / 2) * 20)); plate.material.map.needsUpdate = true; };
    draw(plaque); g.userData.draw = draw; void onPlaque;
  }
  return g;
}
/** A chandelier (decor, sways a little). */
export function chandelier(w, { x, y = 4.2, z, r = 0.9 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 24), metal(0x4a3a1c)); ring.rotation.x = PI / 2; g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.55, 0.03, 6, 20), metal(0x4a3a1c)); ring2.rotation.x = PI / 2; ring2.position.y = 0.2; g.add(ring2);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), metal(0x2a2a22)); chain.position.y = 0.7; g.add(chain);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glowMat(0xffd89a, 1.6)); b.position.set(Math.cos(a) * r, 0.08, Math.sin(a) * r); g.add(b); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 6), metal(0x6a6050)); st.position.set(Math.cos(a) * r, -0.02, Math.sin(a) * r); g.add(st); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xffc47a, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.scale.setScalar(2.0); g.add(halo);
  w.updaters.push(() => { g.rotation.z = Math.sin(w.t * 0.5 + x) * 0.012; g.rotation.x = Math.cos(w.t * 0.4 + z) * 0.01; halo.material.opacity = 0.18 + Math.sin(w.t * 9 + x) * 0.03; });
  return g;
}
/** A wall clock stopped at a time. */
export function wallClock(w, { x, y = 3.0, z, nx = 0, nz = 1, hh = 3, mm = 7, r = 0.3 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotOf(nx, nz); w.add(g);
  const [c, q] = cv(128, 128); q.fillStyle = '#b9b49c'; q.beginPath(); q.arc(64, 64, 62, 0, 7); q.fill(); q.strokeStyle = '#1b1a14'; q.lineWidth = 4; q.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; q.beginPath(); q.moveTo(64 + Math.sin(a) * 52, 64 - Math.cos(a) * 52); q.lineTo(64 + Math.sin(a) * 58, 64 - Math.cos(a) * 58); q.stroke(); }
  const hand = (ang, len, wd) => { q.lineWidth = wd; q.beginPath(); q.moveTo(64, 64); q.lineTo(64 + Math.sin(ang) * len, 64 - Math.cos(ang) * len); q.stroke(); };
  hand(((hh % 12) + mm / 60) / 12 * PI * 2, 30, 5); hand(mm / 60 * PI * 2, 46, 3);
  const face = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.8 })); face.position.z = 0.04; g.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 6, 24), metal(0x3a3020)); rim.position.z = 0.04; g.add(rim);
}
/** A plain lectern / pedestal (solid) with a flat top at y. */
export function pedestal(w, { x, z, h = 1.0, s = 0.5, color = 0x4d3828 }) {
  box(w, { x, y: h / 2, z, w: s, h, d: s, kind: 'wood', color }); w.collider({ x, y: h / 2, z, w: s, h, d: s });
  box(w, { x, y: h + 0.02, z, w: s + 0.1, h: 0.05, d: s + 0.1, kind: 'wood', color: 0x2c1e14 });
}
/** A round pillar (solid). */
export function column(w, { x, z, h = 3.4, r = 0.42 }) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 14), horrorSurface('concrete', { color: 0xb8b5a8, roughness: 0.8 })); m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; w.add(m);
  box(w, { x, y: 0.15, z, w: r * 2.5, h: 0.3, d: r * 2.5, kind: 'concrete', color: 0x8c8a80 }); box(w, { x, y: h - 0.15, z, w: r * 2.5, h: 0.3, d: r * 2.5, kind: 'concrete', color: 0x8c8a80 });
  w.collider({ x, y: h / 2, z, w: r * 2, h, d: r * 2 });
}
/** A chair (decor, no collider) */
export function chair(w, { x, z, rot = 0, y = 0 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const wood = horrorSurface('wood', { color: 0x5a4332, roughness: 0.7 });
  const add = (geo, px, py, pz) => { const o = new THREE.Mesh(geo, wood); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(0.46, 0.05, 0.46), 0, 0.46, 0); add(new THREE.BoxGeometry(0.46, 0.56, 0.05), 0, 0.76, -0.22);
  for (const [px, pz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) add(new THREE.BoxGeometry(0.04, 0.46, 0.04), px, 0.23, pz);
  return g;
}
/** The long boardroom table (solid). */
export function longTable(w, { x, z, len = 8, wd = 2.6 }) {
  box(w, { x, y: 0.76, z, w: len, h: 0.1, d: wd, kind: 'wood', color: 0x4a3526 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(w, { x: x + sx * (len / 2 - 0.4), y: 0.38, z: z + sz * (wd / 2 - 0.3), w: 0.22, h: 0.76, d: 0.22, kind: 'wood', color: 0x2c1e14 });
  w.collider({ x, y: 0.4, z, w: len, h: 0.8, d: wd });
}

// ------------------------------------------------------------------------------------------------------------ the safe -----
/** A wall safe with four numbered dials. Returns { dial(i) -> world point, setDial(i, v), open(k) }. */
export function safeBox(w, { x, z, nx = 0, nz = 1 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotOf(nx, nz); w.add(g);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 0.8), horrorSurface('rust', { color: 0x2a3234, roughness: 0.45, metalness: 0.85, bump: 1.4 })); body.position.set(0, 0.9, 0.4); body.castShadow = true; body.receiveShadow = true; g.add(body);
  w.collider({ x: x + nx * 0.4, y: 0.9, z: z + nz * 0.4, w: Math.abs(nz) > 0.5 ? 1.5 : 0.8, h: 1.8, d: Math.abs(nz) > 0.5 ? 0.8 : 1.5 });
  const hinge = new THREE.Group(); hinge.position.set(-0.68, 0.9, 0.82); g.add(hinge);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.36, 1.6, 0.08), horrorSurface('rust', { color: 0x3d4a4c, roughness: 0.4, metalness: 0.9, bump: 1.4 })); door.position.x = 0.68; door.castShadow = true; hinge.add(door);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 18), metal(0x9aa3a0)); wheel.position.set(0.68, -0.38, 0.07); hinge.add(wheel);
  const cavity = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.5), new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 1 })); cavity.position.set(0, 0.9, 0.801); g.add(cavity);
  const keyG = new THREE.Group(); keyG.position.set(0, 1.0, 0.7); keyG.visible = false; g.add(keyG);
  const brass = new THREE.MeshStandardMaterial({ color: 0xb59a4a, roughness: 0.3, metalness: 0.9, emissive: 0x2a2208, emissiveIntensity: 0.7 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 18), brass); ring.rotation.x = PI / 2; ring.position.z = 0.16; keyG.add(ring);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.34), brass); shaft.position.z = -0.04; keyG.add(shaft);
  for (const k of [0, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.07 + k * 0.02), brass); t.position.set(0, -0.035, -0.16 + k * 0.08); keyG.add(t); }
  const glint = new THREE.PointLight(0xffd27a, 0, 3.5, 2); glint.position.set(0, 1.0, 1.1); g.add(glint);
  const dials = [], plates = [];
  for (let i = 0; i < 4; i++) {
    const [c, q] = cv(64, 96); const t = tex(c); dials.push({ c, q, t });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.33), new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) })); pl.position.set(-0.78 + 0.0, 0, 0); plates.push(pl);
    pl.position.set(0.68 - 0.54 + i * 0.36, 0.28, 0.07); hinge.add(pl);
  }
  const S = {
    group: g, keyG, glint, k: 0,
    dial: (i) => ({ ...onWall(x, z, nx, nz, -0.54 + 0.36 * i, 1.05), y: 1.2 }),
    setDial: (i, v) => { const d = dials[i]; d.q.fillStyle = '#071a14'; d.q.fillRect(0, 0, 64, 96); d.q.fillStyle = '#6dffb4'; d.q.font = '700 70px "Courier New", monospace'; d.q.textAlign = 'center'; d.q.textBaseline = 'middle'; d.q.fillText(String(v), 32, 52); d.q.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < 96; y += 3) d.q.fillRect(0, y, 64, 1); d.t.needsUpdate = true; },
    swing: (k) => { S.k = k; hinge.rotation.y = -k * 1.9; keyG.visible = k > 0.4 && S.keyHere; },
    keyHere: true,
  };
  for (let i = 0; i < 4; i++) S.setDial(i, 0);
  return S;
}

// ------------------------------------------------------------------------------------------------------------ deposit boxes -----
/** A row of numbered steel deposit boxes on a wall. Returns [{ n, x, z, door(group), swing(k), at }] */
export function depositBoxes(w, { x0, z, n = 8, spacing = 1.2, y = 1.35, nx = 0, nz = 1, rows = 2 }) {
  const out = [], ry = rotOf(nx, nz);
  const g = new THREE.Group(); g.position.set(0, 0, 0); w.add(g);
  const mat = horrorSurface('rust', { color: 0x59655f, roughness: 0.45, metalness: 0.85, bump: 1.5 });
  let num = 1;
  for (let r = 0; r < rows; r++) for (let i = 0; i < n / rows; i++) {
    const lx = i * spacing, by = y + (rows - 1 - r) * 0.62 - (rows - 1) * 0.31;
    const px = x0 + Math.cos(ry) * lx, pz = z - Math.sin(ry) * lx;
    const grp = new THREE.Group(); grp.position.set(px, by, pz); grp.rotation.y = ry; w.add(grp);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.56, 0.5), mat); cab.position.z = 0.25; cab.castShadow = true; grp.add(cab);
    const hinge = new THREE.Group(); hinge.position.set(-0.46, 0, 0.52); grp.add(hinge);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.5, 0.04), horrorSurface('rust', { color: 0x6d7a74, roughness: 0.4, metalness: 0.85, bump: 1.4 })); door.position.x = 0.46; door.castShadow = true; hinge.add(door);
    const [c, q] = cv(128, 64); q.fillStyle = '#c9c2a0'; q.font = '800 40px "Courier New", monospace'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(String(num), 64, 34);
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, color: 0x8a876e })); nm.position.set(0.3, 0.14, 0.025); door.add(nm);
    const kh = new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), new THREE.MeshBasicMaterial({ color: 0x000000 })); kh.position.set(0.7, -0.05, 0.025); door.add(kh);
    const cavity = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.46), new THREE.MeshStandardMaterial({ color: 0x040505, roughness: 1 })); cavity.position.z = 0.505; grp.add(cavity);
    const o = { n: num, x: px + nx * 0.9, z: pz + nz * 0.9, y: by, swing: (k) => { hinge.rotation.y = -k * 1.7; }, k: 0 };
    out.push(o); num++;
  }
  return out;
}

// ------------------------------------------------------------------------------------------------------------ maintenance panel -----
export const WIRE = [{ n: 'RED', c: 0xd8321e }, { n: 'BLUE', c: 0x2a6bff }, { n: 'YELLOW', c: 0xe8c81e }, { n: 'GREEN', c: 0x2cc064 }];
/** The lock-relay panel: a steel cover held by four screws; behind it three plug sockets (BELL / EARTH / BED) and an arming lamp. */
export function maintPanel(w, { x, y = 1.5, z, nx = 0, nz = -1 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotOf(nx, nz); w.add(g);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.12), metal(0x14181a)); back.position.z = 0.04; g.add(back);
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshStandardMaterial({ color: 0x0a0d0e, roughness: 0.8 })); inner.position.z = 0.105; g.add(inner);
  const cover = new THREE.Group(); cover.position.z = 0.14; g.add(cover);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.04), horrorSurface('rust', { color: 0x59655f, roughness: 0.5, metalness: 0.8, bump: 1.6 })); plate.castShadow = true; cover.add(plate);
  const [lc, lq] = cv(256, 64); lq.fillStyle = '#d9d2b0'; lq.font = '800 26px "Courier New", monospace'; lq.textAlign = 'center'; lq.textBaseline = 'middle'; lq.fillText('LOCK RELAY · NO ENTRY', 128, 32);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: tex(lc), transparent: true, color: 0x8a876e })); lab.position.set(0, 0.2, 0.025); cover.add(lab);
  const screws = [];
  for (const [sx, sy] of [[-0.65, 0.4], [0.65, 0.4], [-0.65, -0.4], [0.65, -0.4]]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10), metal(0x9aa3a0)); s.rotation.x = PI / 2; s.position.set(sx, sy, 0.035); cover.add(s);
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.01), metal(0x050505)); sl.position.set(sx, sy, 0.058); sl.rotation.z = 0.5; cover.add(sl);
    screws.push({ mesh: s, sl, lx: sx, ly: sy });
  }
  const sockets = [];
  for (let i = 0; i < 3; i++) {
    const lx = -0.4 + i * 0.4;
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12), metal(0x050607)); hole.rotation.x = PI / 2; hole.position.set(lx, 0.1, 0.12); g.add(hole);
    const plug = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: WIRE[0].c, roughness: 0.5, emissive: WIRE[0].c, emissiveIntensity: 0.35 })); plug.position.set(lx, 0.1, 0.17); g.add(plug);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6), plug.material); cable.position.set(lx, -0.12, 0.15); g.add(cable);
    const [tc, tq] = cv(128, 40); tq.fillStyle = '#d9d2b0'; tq.font = '800 24px "Courier New", monospace'; tq.textAlign = 'center'; tq.textBaseline = 'middle'; tq.fillText(['BELL', 'EARTH', 'BED'][i], 64, 22);
    const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.09), new THREE.MeshBasicMaterial({ map: tex(tc), transparent: true, color: 0x8a876e })); tl.position.set(lx, -0.28, 0.108); g.add(tl);
    sockets.push({ plug, cable, lx, ly: 0.1 });
  }
  const lampMat = glowMat(0xff2a1a, 1.4); const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), lampMat); lamp.position.set(0.55, 0.38, 0.11); g.add(lamp);
  const spark = new THREE.PointLight(0x8ac8ff, 0, 6, 2); spark.position.set(0, 0.1, 0.5); g.add(spark);
  const P = {
    group: g, spark, lampMat, screws, sockets,
    at: (lx, ly) => ({ ...onWall(x, z, nx, nz, lx, 0.9), y: y + ly }),
    setScrew: (i, out) => { const s = screws[i]; s.mesh.visible = !out; s.sl.visible = !out; if (out) { const sc = new THREE.Mesh(s.mesh.geometry, s.mesh.material); sc.rotation.x = PI / 2; sc.position.set(s.lx, -0.5 - i * 0.02, 0.25 + i * 0.05); sc.rotation.z = i; g.add(sc); } },
    setCover: (off) => { cover.visible = !off; },
    setWire: (i, ci) => { const m = sockets[i].plug.material; m.color.setHex(WIRE[ci].c); m.emissive.setHex(WIRE[ci].c); },
    setArmed: (on) => { lampMat.color.copy(new THREE.Color(on ? 0x2aff7a : 0xff2a1a).multiplyScalar(on ? 2 : 1.4)); },
  };
  return P;
}

// ------------------------------------------------------------------------------------------------------------ projector & mirror -----
/** A reel projector on a stand, with a faint beam toward -z (decor). Returns { beam }. */
export function projector(w, { x, z, y = 1.5, len = 12 }) {
  box(w, { x, y: 0.55, z, w: 0.5, h: 1.1, d: 0.5, kind: 'rust', color: 0x23292b }); w.collider({ x, y: 0.55, z, w: 0.5, h: 1.1, d: 0.5 });
  box(w, { x, y: 1.3, z, w: 0.7, h: 0.4, d: 0.5, kind: 'rust', color: 0x2c3234 });
  for (const sx of [-0.2, 0.2]) { const reel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 20), metal(0x5a6460)); reel.position.set(x + sx, 1.68, z + 0.05); w.add(reel); }
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.3, 12), metal(0x0a0c0d)); lens.rotation.x = PI / 2; lens.position.set(x, 1.3, z - 0.35); w.add(lens);
  const beamGeo = new THREE.ConeGeometry(2.7, len, 20, 1, true); beamGeo.translate(0, -len / 2, 0); beamGeo.rotateX(-PI / 2);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xcfe4f0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); beam.position.set(x, 1.3, z - 0.5); beam.scale.set(1, 0.7, 1); w.add(beam);
  return { beam };
}
/** A big mirror (a window onto a dark alcove behind it). The glass is a transparent canvas the level draws on (fog writing, cracks). */
export function mirrorGlass(w, { x, y = 1.75, z, nx = -1, nz = 0, width = 6.2, height = 2.7 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotOf(nx, nz); w.add(g);
  const fm = horrorSurface('wood', { color: 0x6a5230, roughness: 0.5, metalness: 0.3 });
  for (const [bw, bh, px, py] of [[width + 0.4, 0.2, 0, height / 2 + 0.1], [width + 0.4, 0.2, 0, -height / 2 - 0.1], [0.2, height, -width / 2 - 0.1, 0], [0.2, height, width / 2 + 0.1, 0]]) { const fr = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.16), fm); fr.position.set(px, py, 0.02); g.add(fr); }
  const [c, q] = cv(1024, 440); const t = tex(c);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.05, metalness: 0.2, depthWrite: false })); glass.position.z = 0.04; glass.renderOrder = 4; g.add(glass);
  const M = { canvas: c, ctx: q, tex: t, width, height, glass };
  M.clear = () => { q.clearRect(0, 0, 1024, 440); q.fillStyle = 'rgba(160,190,200,0.07)'; q.fillRect(0, 0, 1024, 440); q.fillStyle = 'rgba(255,255,255,0.05)'; q.beginPath(); q.moveTo(0, 0); q.lineTo(300, 0); q.lineTo(120, 440); q.lineTo(0, 440); q.fill(); t.needsUpdate = true; };
  M.fog = (lines, a = 0.8) => { M.clear(); q.fillStyle = `rgba(225,235,235,${a})`; q.font = '700 70px "Courier New", monospace'; q.textAlign = 'center'; q.textBaseline = 'middle'; lines.forEach((l, i) => q.fillText(l, 512, 170 + i * 100 + Math.sin(i) * 6)); t.needsUpdate = true; };
  M.crack = (seed = 3) => { const R = rnd(seed); q.strokeStyle = 'rgba(235,245,245,0.8)'; q.lineWidth = 3; for (let i = 0; i < 9; i++) { let px = 512 + (R() - 0.5) * 120, py = 220 + (R() - 0.5) * 80, a = R() * 6.28; q.beginPath(); q.moveTo(px, py); for (let k = 0; k < 14; k++) { a += (R() - 0.5) * 0.8; px += Math.cos(a) * 40; py += Math.sin(a) * 40; q.lineTo(px, py); } q.stroke(); } t.needsUpdate = true; };
  M.clear();
  return M;
}

// ------------------------------------------------------------------------------------------------------------ private HUD -----
/** A HUD element on THIS player's screen only: a title, a big timer and a sub-line. */
export function privateHud(w) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:50%;top:78px;transform:translateX(-50%);z-index:30;pointer-events:none;font:700 12px/1.3 "Archivo Black",Impact,sans-serif;letter-spacing:.2em;color:#e8c9c4;text-align:center;opacity:0;transition:opacity .5s;text-shadow:0 0 8px #000;padding:10px 22px;border:1px solid rgba(190,40,40,.55);background:rgba(18,4,4,.55)';
  el.innerHTML = '<div id="c7-t" style="font-size:11px;opacity:.85"></div><div id="c7-n" style="font-size:30px;letter-spacing:.25em;margin:4px 0"></div><div id="c7-s" style="font-size:10px;opacity:.7;letter-spacing:.16em"></div>';
  document.body.appendChild(el); w.disposers.push(() => el.remove());
  const q = (s) => el.querySelector(s);
  const H = { on: false };
  H.show = (title, sub = '') => { H.on = true; q('#c7-t').textContent = title; q('#c7-s').textContent = sub; el.style.opacity = '0.95'; };
  H.time = (secs) => { const s = Math.max(0, Math.ceil(secs)); q('#c7-n').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); el.style.borderColor = secs < 15 ? 'rgba(255,60,60,.95)' : 'rgba(190,40,40,.55)'; };
  H.text = (t) => { q('#c7-n').textContent = t; };
  H.hide = () => { H.on = false; el.style.opacity = '0'; };
  return H;
}

/** A bare decor floor-standing lamp-pool: a soft glow sprite (no real light). */
export function glowSpot(w, { x, y, z, color = 0xffc47a, size = 2.4, opacity = 0.25 }) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); s.position.set(x, y, z); s.scale.setScalar(size); w.add(s); return s;
}
void hp;
