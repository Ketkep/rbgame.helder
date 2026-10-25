import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hp, box } from './kit.js';
import { horrorSurface } from './materials.js';

// Props for chapter 3 (Records Room): sigils scratched on locker doors, benches, filing cabinets, archive shelving (static and sliding), a lever
// console and a plan monitor (a canvas that the level redraws). Everything solid goes through w.collider / hp like the rest of the Lowtide kit.

const rnd = (s) => { let a = (s | 0) + 0x6d2b79f5; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const rotOf = (nx, nz) => Math.atan2(nx, nz);                                  // yaw that turns a +z-facing thing to face (nx,nz)
const axisBox = (nx, nz, along, depth) => (Math.abs(nz) > 0.5 ? { w: along, d: depth } : { w: depth, d: along });

// ------------------------------------------------------------------------------------------------------------------ sigils -----
const symCache = new Map();
/** A pin-scratched symbol on a transparent canvas. kinds: moonR (crescent open to the right, with a dot), moonL, moonRplain, eye, spiral, star. */
export function symbolTexture(kind) {
  if (symCache.has(kind)) return symCache.get(kind);
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.strokeStyle = '#ddd5b6'; g.fillStyle = '#ddd5b6'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
  const R = rnd(kind.length * 977 + kind.charCodeAt(0));
  const wob = () => (R() - 0.5) * 2.2;
  const crescent = (flip) => {
    g.save(); if (flip) { g.translate(128, 0); g.scale(-1, 1); }
    g.beginPath(); g.arc(64, 64, 40, 0.75, Math.PI * 2 - 0.75); g.stroke();
    g.beginPath(); g.arc(78, 64, 31, Math.PI * 2 - 0.95, 0.95, true); g.stroke();
    g.restore();
  };
  if (kind === 'moonR' || kind === 'moonL' || kind === 'moonRplain') {
    crescent(kind === 'moonL');
    if (kind !== 'moonRplain') { g.beginPath(); g.arc(kind === 'moonL' ? 54 : 74, 64 + wob(), 6, 0, 7); g.fill(); }
  } else if (kind === 'eye') {
    g.beginPath(); g.moveTo(14, 64); g.quadraticCurveTo(64, 14, 114, 64); g.quadraticCurveTo(64, 114, 14, 64); g.stroke();
    g.beginPath(); g.arc(64, 64, 13, 0, 7); g.fill();
  } else if (kind === 'spiral') {
    g.beginPath(); for (let a = 0; a < 17; a += 0.15) { const r = 3 + a * 3.1; const px = 64 + Math.cos(a) * r, py = 64 + Math.sin(a) * r; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.stroke();
  } else if (kind === 'star') {
    g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 0.8; const px = 64 + Math.cos(a) * 46, py = 66 + Math.sin(a) * 46; if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.closePath(); g.stroke();
  }
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.9})`; g.fillRect(R() * 128, R() * 128, 1 + R() * 7, 1 + R() * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; symCache.set(kind, t); return t;
}
/** A symbol plane at (x,y,z) facing the unit vector (nx,nz). */
export function sigil(w, kind, { x, y, z, nx = 0, nz = 1, size = 0.3, opacity = 0.95 }) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: symbolTexture(kind), transparent: true, opacity, depthWrite: false, color: 0xa9a48c, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  m.position.set(x, y, z); m.rotation.y = rotOf(nx, nz); m.renderOrder = 3; w.add(m); return m;
}

// ------------------------------------------------------------------------------------------------------------------ furniture -----
const dark = () => horrorSurface('rust', { color: 0x4a5450, roughness: 0.55, metalness: 0.7, bump: 1.2 });
/** A waiting-room bench (solid). */
export function bench(w, { x, z, rot = 0, len = 2.0 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  const wood = horrorSurface('wood', { color: 0x6a5546, roughness: 0.8 });
  const add = (geo, mat, px, py, pz) => { const o = new THREE.Mesh(geo, mat); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(len, 0.07, 0.5), wood, 0, 0.46, 0); add(new THREE.BoxGeometry(len, 0.4, 0.06), wood, 0, 0.78, -0.22).rotation.x = -0.12;
  for (const px of [-len / 2 + 0.12, len / 2 - 0.12]) add(new THREE.BoxGeometry(0.06, 0.46, 0.46), dark(), px, 0.23, 0);
  const a = axisBox(Math.sin(rot), Math.cos(rot), len, 0.55); w.collider({ x, y: 0.4, z, w: a.w, h: 0.8, d: a.d });
  return g;
}
/** A grey filing cabinet with drawers, one hanging open if `open` is a drawer index. */
export function cabinet(w, { x, z, rot = 0, drawers = 4, open = -1, color = 0x6e7873 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  const mat = horrorSurface('rust', { color, roughness: 0.5, metalness: 0.75, bump: 1.5 });
  const H = 0.38 * drawers + 0.1;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, H, 0.62), mat); body.position.y = H / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
  for (let i = 0; i < drawers; i++) {
    const y = 0.07 + 0.38 * i + 0.19, out = i === open ? 0.34 : 0;
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.04), mat); f.position.set(0, y, 0.33 + out); f.castShadow = true; g.add(f);
    const hd = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.04), new THREE.MeshStandardMaterial({ color: 0x1c2224, metalness: 0.8, roughness: 0.4 })); hd.position.set(0, y + 0.07, 0.37 + out); g.add(hd);
    const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.06), new THREE.MeshStandardMaterial({ color: 0xc7bf9f, roughness: 1 })); lb.position.set(0, y - 0.02, 0.356 + out); g.add(lb);
    if (i === open) { const tray = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a403d, roughness: 0.7 })); tray.position.set(0, y - 0.05, 0.1 + out / 2); g.add(tray); for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.015), new THREE.MeshStandardMaterial({ color: 0xcfc8b0, roughness: 1 })); p.position.set(-0.17 + k * 0.11, y + 0.1, 0.05 + out * 0.5); p.rotation.z = (k - 1.5) * 0.12; g.add(p); } }
  }
  const a = axisBox(Math.sin(rot), Math.cos(rot), 0.58, 0.66); w.collider({ x, y: H / 2, z, w: a.w, h: H, d: a.d });
  return g;
}
/** A brass key lying somewhere (returns the group; hide it with .visible). */
export function keyMesh(w, { x, y, z, rot = 0, scale = 1 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; g.scale.setScalar(scale); w.add(g);
  const brass = new THREE.MeshStandardMaterial({ color: 0xb59a4a, roughness: 0.3, metalness: 0.9, emissive: 0x2a2208, emissiveIntensity: 0.6 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 18), brass); ring.rotation.x = Math.PI / 2; ring.position.z = 0.1; g.add(ring);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.016, 0.2), brass); shaft.position.z = -0.02; g.add(shaft);
  for (const k of [0, 1]) { const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.016, 0.04 + k * 0.01), brass); tooth.position.set(0, -0.022, -0.1 + k * 0.045); g.add(tooth); }
  return g;
}

// ------------------------------------------------------------------------------------------------------------------ shelving -----
const geoCache = new Map();
const PALETTE = [0x8a7d5c, 0x6b6a5e, 0x7d4b3d, 0x4d5a52, 0x9a9484, 0x5c4a3a, 0x3f4a56];
function shelfGeometry(len, H, seed) {
  const key = [len, H, seed].join('|'); if (geoCache.has(key)) return geoCache.get(key);
  const parts = [], R = rnd(seed * 131 + 7);
  const add = (gw, gh, gd, px, py, pz, color, rx = 0, rz = 0) => {
    const g = new THREE.BoxGeometry(gw, gh, gd); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(px, py, pz);
    const col = new THREE.Color(color).multiplyScalar(0.8 + R() * 0.3), n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); parts.push(g);
  };
  add(len - 0.06, H, 0.12, 0, 0, 0, 0x2a2119);
  for (const px of [-len / 2 + 0.06, 0, len / 2 - 0.06]) add(0.1, H, 0.64, px, 0, 0, 0x3b2d21);
  const levels = 5;
  for (let k = 0; k < levels; k++) {
    const y = -H / 2 + 0.28 + k * ((H - 0.4) / (levels - 1));
    add(len - 0.2, 0.05, 0.64, 0, y, 0, 0x4b3b2c);
    for (const sd of [-1, 1]) {
      let px = -len / 2 + 0.22;
      while (px < len / 2 - 0.3) {
        if (R() < 0.12) { px += 0.16 + R() * 0.2; continue; }                                  // a gap
        const bw = 0.07 + R() * 0.15, bh = 0.2 + R() * 0.2, lean = R() < 0.1 ? (R() - 0.5) * 0.6 : 0;
        add(bw, bh, 0.3, px + bw / 2, y + 0.025 + bh / 2, sd * 0.2, PALETTE[Math.floor(R() * PALETTE.length)], 0, lean);
        px += bw + 0.005 + R() * 0.03;
      }
    }
  }
  const g = mergeGeometries(parts, false); parts.forEach((p) => p.dispose()); geoCache.set(key, g); return g;
}
let shelfMat = null;
/**
 * A stack of archive shelving (solid, 0.7 thick). along: 'x' (the wall runs along x) or 'z'. `sliding` shelves are moving platforms: move them with
 * `.setCentre(x,z)`; static ones are just walls. Returns { plat, x, z, along, len }.
 */
export function shelf(w, { x, z, len = 3.8, along = 'x', H = 2.9, seed = 1, sliding = false }) {
  const horiz = along === 'x';
  const p = hp(w, { x, y: H, z, w: horiz ? len : 0.7, d: horiz ? 0.7 : len, h: H, kind: 'wood', path: false, moving: !!sliding });
  p.group.children[0].visible = false;
  shelfMat ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 });
  const m = new THREE.Mesh(shelfGeometry(len, H, seed), shelfMat); m.castShadow = true; m.receiveShadow = true; m.rotation.y = horiz ? 0 : Math.PI / 2; p.group.add(m);
  const S = { plat: p, x, z, along, len, H, setCentre: (cx, cz) => { S.x = cx; S.z = cz; p.setPos(cx, H / 2, cz); } };
  return S;
}
/** A thin pillar where archive walls meet (solid). */
export function pillar(w, { x, z, H = 2.95, s = 0.5 }) {
  box(w, { x, y: H / 2, z, w: s, h: H, d: s, kind: 'wood', color: 0x3b2d21 });
  w.collider({ x, y: H / 2, z, w: s, h: H, d: s });
}
/** A rail post with a lamp that is red when closed and green when open (feedback for the shelf it guards). */
export function railPost(w, { x, z, label = '' }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); w.add(g);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.0, 8), dark()); post.position.y = 1.5; post.castShadow = true; g.add(post);
  const hd = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), new THREE.MeshStandardMaterial({ color: 0x1b2024, roughness: 0.6, metalness: 0.6 })); hd.position.y = 2.7; g.add(hd);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false });
  for (const [px, pz] of [[0, 0.17], [0, -0.17], [0.17, 0], [-0.17, 0]]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), mat); b.position.set(px, 2.7, pz); b.rotation.y = Math.atan2(px, pz); g.add(b); }
  if (label) { const c = document.createElement('canvas'); c.width = c.height = 64; const q = c.getContext('2d'); q.fillStyle = '#e6dcb0'; q.font = '900 46px Impact, sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(label, 32, 34); const t = new THREE.CanvasTexture(c); const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); for (const [px, pz] of [[0, 0.171], [0, -0.171], [0.171, 0], [-0.171, 0]]) { const pp = pl.clone(); pp.position.set(px, 2.38, pz); pp.rotation.y = Math.atan2(px, pz); g.add(pp); } }
  return { set(open) { mat.color.setHex(open ? 0x2aff7a : 0xff2a1a); } };
}
void railPost;

// ------------------------------------------------------------------------------------------------------------------ console + monitor -----
/** A control console against a wall: returns { origin, lever(i) -> { x, z } world position in front of lever i, set(i, on) }. */
export function leverConsole(w, { x, z, nx = 0, nz = 1, n = 3, spacing = 1.3, labels = ['A', 'B', 'C'] }) {
  const len = n * spacing + 0.8, ry = rotOf(nx, nz);
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; w.add(g);
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.7), dark()); body.position.y = 0.45; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(len + 0.06, 0.06, 0.78), new THREE.MeshStandardMaterial({ color: 0x1b2124, roughness: 0.45, metalness: 0.7 })); top.position.y = 0.93; g.add(top);
  const a = axisBox(nx, nz, len, 0.72); w.collider({ x, y: 0.5, z, w: a.w, h: 1.0, d: a.d });
  const levers = [], out = { levers, origin: { x, z } };
  for (let i = 0; i < n; i++) {
    const lx = (i - (n - 1) / 2) * spacing;
    const pivot = new THREE.Group(); pivot.position.set(lx, 0.98, 0.12); g.add(pivot);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0x0f1315, metalness: 0.8, roughness: 0.4 })); base.position.y = -0.02; g.add(base); base.position.set(lx, 0.98, 0.12);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0x9aa3a0, metalness: 0.9, roughness: 0.3 })); rod.position.y = 0.3; pivot.add(rod);
    const knobMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), knobMat); knob.position.y = 0.62; pivot.add(knob);
    pivot.rotation.x = 0.7;
    const c = document.createElement('canvas'); c.width = c.height = 64; const q = c.getContext('2d'); q.fillStyle = '#e6dcb0'; q.font = '900 50px Impact, sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(labels[i] || String(i + 1), 32, 34);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, color: 0xb9b49a })); pl.rotation.x = -Math.PI / 2; pl.position.set(lx, 0.965, 0.3); g.add(pl);
    levers.push({ pivot, knobMat, x: x + Math.cos(ry) * lx + Math.sin(ry) * 0.62, z: z - Math.sin(ry) * lx + Math.cos(ry) * 0.62, on: false });   // x,z: a point just in front of the lever
  }
  out.set = (i, on) => { levers[i].on = !!on; levers[i].knobMat.color.setHex(on ? 0x2aff7a : 0xff2a1a); };
  out.tick = (dt) => { for (const l of levers) { const t = l.on ? -0.7 : 0.7; l.pivot.rotation.x += (t - l.pivot.rotation.x) * Math.min(1, dt * 9); } };
  return out;
}

/** A glowing canvas screen on a wall. draw(ctx, w, h, t) is called by redraw(); it is not drawn at all in the bot harness. */
export function monitor(w, { x, y, z, nx = 0, nz = 1, width = 3.4, height = 2.4, cw = 544, ch = 384, draw }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotOf(nx, nz); w.add(g);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, height + 0.3, 0.14), new THREE.MeshStandardMaterial({ color: 0x14181a, roughness: 0.5, metalness: 0.8 })); frame.position.z = -0.02; frame.castShadow = true; g.add(frame);
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) })); scr.position.z = 0.06; g.add(scr);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.5, height * 1.5), new THREE.MeshBasicMaterial({ color: 0x1a6a5a, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); glow.position.z = 0.08; g.add(glow);
  const M = { canvas: cv, ctx, tex, redraw: (t = 0) => { if (window.__noRender) return; draw(ctx, cw, ch, t); tex.needsUpdate = true; } };
  M.redraw(0);
  return M;
}
