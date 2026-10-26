import * as THREE from 'three';
import { softTexture } from '../../engine/materials.js';
import { box, hp } from './kit.js';
import { horrorSurface } from './materials.js';

// Props and helpers for chapter 2 "Night Rounds": glowing canvas screens, terminals, call-bell panels, laundry machines, fuse boxes, floor
// plates and the small HUD (heartbeat meter, torch, hold-your-breath, staff-change timer).

const M = {
  casing: () => new THREE.MeshStandardMaterial({ color: 0x232a2d, roughness: 0.55, metalness: 0.75 }),
  steel: () => new THREE.MeshStandardMaterial({ color: 0x8e9996, roughness: 0.4, metalness: 0.85 }),
  white: () => new THREE.MeshStandardMaterial({ color: 0x9aa39c, roughness: 0.45, metalness: 0.5 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x07090a, roughness: 0.25, metalness: 0.6 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x15191a, roughness: 0.9 }),
  cloth: () => new THREE.MeshStandardMaterial({ color: 0xb7b8a8, roughness: 1 }),
  red: () => new THREE.MeshStandardMaterial({ color: 0x5a0d10, roughness: 0.6, emissive: 0x330406, emissiveIntensity: 0.8 }),
};
const memo = new Map();
export const mat = (k) => { if (!memo.has(k)) memo.set(k, M[k]()); return memo.get(k); };
const glowMat = (hex, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });

/** An axis-aligned solid from a rotated footprint (rot is a multiple of 90 degrees in practice). */
export function solid(w, { x, y = 0, z, rot = 0, w: ww, d, h }) {
  const sw = Math.abs(Math.cos(rot)) > 0.7;
  return w.collider({ x, y: y + h / 2, z, w: sw ? ww : d, h, d: sw ? d : ww });
}

/** A glowing canvas screen. draw(ctx, W, H, t) is called `rate` times a second (never in the headless bot harness). */
export function screen(w, { x, y, z, rot = 0, tilt = 0, width = 0.9, height = 0.56, px = 256, draw, rate = 6, tint = 1.5, frame = true, glow = 0x7cffc0 }) {
  const cv = document.createElement('canvas'); cv.width = px; cv.height = Math.round((px * height) / width);
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.set(0, rot, 0); w.add(grp);
  const tl = new THREE.Group(); tl.rotation.x = tilt; grp.add(tl);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(tint, tint, tint) }));
  face.position.z = 0.012; tl.add(face);
  if (frame) { const f = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, height + 0.1, 0.06), mat('casing')); f.position.z = -0.02; tl.add(f); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: glow, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.set(width * 2.4, height * 2.4, 1); halo.position.z = 0.15; tl.add(halo);
  const S = { group: grp, canvas: cv, ctx: g, tex, redraw: () => { draw?.(g, cv.width, cv.height, w.t); tex.needsUpdate = true; } };
  let acc = 1;
  w.updaters.push((dt) => { if (window.__noRender) return; acc += dt; if (acc >= 1 / rate) { acc = 0; S.redraw(); } });
  return S;
}

/** A desk-top terminal: casing, tilted screen, keyboard. Solid. Returns { screen, x, z, nx, nz } (n = the way it faces). */
export function terminal(w, { x, y = 0, z, rot = 0, draw, rate = 5, glow = 0x7cffc0, width = 0.86 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(1.3, 0.86, 0.7), mat('casing'), 0, 0.43, 0);
  add(new THREE.BoxGeometry(1.34, 0.05, 0.74), mat('white'), 0, 0.88, 0);
  add(new THREE.BoxGeometry(0.5, 0.025, 0.18), mat('rubber'), 0, 0.915, 0.2);
  add(new THREE.CylinderGeometry(0.05, 0.08, 0.3, 8), mat('casing'), 0, 1.05, -0.12);
  const nx = Math.sin(rot), nz = Math.cos(rot);
  const scr = screen(w, { x: x - nx * 0.12, y: y + 1.32, z: z - nz * 0.12, rot, tilt: -0.18, width, height: width * 0.62, draw, rate, glow });
  solid(w, { x, z, rot, w: 1.3, d: 0.7, h: 0.9 });
  return { screen: scr, x, z, nx, nz };
}

/** A call-bell panel on a wall. `rot` is the way it faces (0 = +z). Returns the interactable. */
export function bellPanel(w, { x, y = 1.4, z, rot = 0, label = 'Ring the call bell', onUse, enabled }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(0.36, 0.5, 0.1), mat('casing'), 0, 0, 0.05);
  add(new THREE.CylinderGeometry(0.095, 0.11, 0.07, 18), mat('red'), 0, 0.03, 0.13).rotation.x = Math.PI / 2;
  const lamp = add(new THREE.SphereGeometry(0.03, 8, 6), glowMat(0xff3a2a, 1.8), 0.12, 0.2, 0.11);
  add(new THREE.BoxGeometry(0.26, 0.07, 0.01), mat('steel'), 0, -0.19, 0.105);
  const nx = Math.sin(rot), nz = Math.cos(rot);
  const it = w.interactable({ x: x + nx * 0.35, y: 1.25, z: z + nz * 0.35, w: Math.abs(nz) > 0.5 ? 0.9 : 0.5, h: 1.5, d: Math.abs(nz) > 0.5 ? 0.5 : 0.9, range: 3, pad: 0.05, label, enabled, onUse });
  it.lamp = lamp;
  return it;
}

/** A washing machine (front-loader). */
export function washer(w, { x, z, rot = 0, big = false, off = false }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  const sc = big ? 1.25 : 1;
  const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(1.1 * sc, 1.45 * sc, 0.95), horrorSurface('rust', { color: 0x7d8884, roughness: 0.5, metalness: 0.7, bump: 1.2 }), 0, 0.725 * sc, 0);
  const ring = add(new THREE.TorusGeometry(0.34 * sc, 0.05, 8, 24), mat('steel'), 0, 0.85 * sc, 0.49); ring.scale.z = 1.2;
  add(new THREE.CircleGeometry(0.32 * sc, 24), mat('dark'), 0, 0.85 * sc, 0.485);
  add(new THREE.BoxGeometry(0.8 * sc, 0.16, 0.04), mat('casing'), 0, 1.33 * sc, 0.49);
  if (!off) add(new THREE.SphereGeometry(0.018, 6, 6), glowMat(0xff7a2a, 1.6), 0.3 * sc, 1.33 * sc, 0.515);
  solid(w, { x, z, rot, w: 1.1 * sc, d: 0.95, h: 1.45 * sc });
  return g;
}

/** An industrial dryer whose drum door is an interactable. Returns { group, drum, door, lamp, shake(on) }. */
export function dryer(w, { x, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  const body = new THREE.Group(); g.add(body);
  const add = (p, geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; p.add(o); return o; };
  add(body, new THREE.BoxGeometry(1.5, 1.9, 1.3), horrorSurface('rust', { color: 0x6f7a76, roughness: 0.5, metalness: 0.7, bump: 1.3 }), 0, 0.95, 0);
  add(body, new THREE.TorusGeometry(0.46, 0.07, 8, 28), mat('steel'), 0, 1.0, 0.66).scale.z = 1.3;
  const glass = add(body, new THREE.CircleGeometry(0.44, 28), new THREE.MeshStandardMaterial({ color: 0x1a2a2c, roughness: 0.1, metalness: 0.9, emissive: 0x050a0b }), 0, 1.0, 0.655);
  add(body, new THREE.BoxGeometry(1.2, 0.2, 0.04), mat('casing'), 0, 1.78, 0.66);
  const lamp = add(body, new THREE.SphereGeometry(0.03, 8, 6), glowMat(0xff7a2a, 0.6), -0.45, 1.78, 0.69);
  const drum = new THREE.Group(); drum.position.set(0, 1.0, 0.63); body.add(drum);
  for (let i = 0; i < 7; i++) { const s = add(drum, new THREE.BoxGeometry(0.2 + (i % 3) * 0.06, 0.05, 0.12), mat('cloth'), Math.cos(i) * 0.22, Math.sin(i * 1.9) * 0.2, 0); s.rotation.z = i; }
  solid(w, { x, z, rot, w: 1.5, d: 1.3, h: 1.9 });
  const nx = Math.sin(rot), nz = Math.cos(rot);
  const S = { group: g, body, drum, lamp, glass, nx, nz, x, z, running: false };
  S.set = (on) => { S.running = on; lamp.material.color.copy(new THREE.Color(on ? 0xff5a1a : 0x3dff7a).multiplyScalar(on ? 2.2 : 1.6)); };
  w.updaters.push(() => { if (S.running) { body.position.x = Math.sin(w.t * 60) * 0.008; body.position.y = Math.abs(Math.sin(w.t * 31)) * 0.006; drum.rotation.z += 0.12; } else { body.position.set(0, 0, 0); } });
  return S;
}

/** A fuse box on a wall: a big lever that drops when pulled. Returns { set(on), it }. */
export function fuseBox(w, { x, y = 1.35, z, rot = 0, label = 'Pull the fuse', onUse, enabled }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(0.8, 1.05, 0.2), horrorSurface('rust', { color: 0x58625f, roughness: 0.55, metalness: 0.7, bump: 1.4 }), 0, 0, 0.1);
  add(new THREE.BoxGeometry(0.62, 0.7, 0.04), mat('dark'), 0, 0.05, 0.21);
  add(new THREE.BoxGeometry(0.5, 0.06, 0.03), mat('steel'), 0, 0.35, 0.235);
  const arm = new THREE.Group(); arm.position.set(0, 0.2, 0.25); g.add(arm);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), mat('steel')); rod.position.y = -0.25; arm.add(rod);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), mat('red')); knob.position.y = -0.52; arm.add(knob);
  const lampM = glowMat(0xff3a2a, 1.8); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), lampM); lamp.position.set(0.28, 0.4, 0.235); g.add(lamp);
  let on = false;
  const S = { arm, lamp };
  S.set = (v) => { on = !!v; lampM.color.copy(new THREE.Color(on ? 0x3dff7a : 0xff3a2a).multiplyScalar(1.8)); };
  w.updaters.push((dt) => { const t = on ? 0.0 : 1.2; arm.rotation.x += (t - arm.rotation.x) * Math.min(1, dt * 8); });
  arm.rotation.x = 1.2;
  const nx = Math.sin(rot), nz = Math.cos(rot);
  S.it = w.interactable({ x: x + nx * 0.4, y: 1.25, z: z + nz * 0.4, w: Math.abs(nz) > 0.5 ? 1.1 : 0.5, h: 1.5, d: Math.abs(nz) > 0.5 ? 0.5 : 1.1, range: 3, pad: 0.05, label, enabled, onUse });
  return S;
}

/** A dim floor plate (a hold-down pad). Returns the co-op zone; `zn.on` mirrors zn.active. */
export function pad(w, { x, z, size = 1.2, color = 0xffa63a, need = 'any' }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); w.add(g);
  const base = new THREE.Mesh(new THREE.BoxGeometry(size + 0.2, 0.05, size + 0.2), mat('casing')); base.position.y = 0.025; g.add(base);
  const m = glowMat(color, 0.6); const top = new THREE.Mesh(new THREE.BoxGeometry(size, 0.04, size), m); top.position.y = 0.06; g.add(top);
  const zn = w.coop.zone({ x, y: 1, z, w: size, h: 2, d: size, need });
  w.updaters.push((dt) => { const k = zn.active ? 2.4 : 0.55 + Math.sin(w.t * 3 + x) * 0.15; m.color.setHex(color).multiplyScalar(k); void dt; });
  return zn;
}

/** A hanging sheet (a long curtain from a ceiling rail): wide, grey, a little torn. */
export function sheetRow(w, curtain, { x, z, n = 4, gap = 1.6, rot = 0, width = 1.5, along = 'x' }) {
  for (let i = 0; i < n; i++) curtain(w, { x: x + (along === 'x' ? i * gap : 0), z: z + (along === 'z' ? i * gap : 0), width, rot, h: 2.6 });
}

/** A dim shelf unit with boxes (for the store room). Solid. */
export function shelf(w, { x, z, rot = 0, len = 3, tiers = 4 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  const steel = mat('steel');
  for (const sx of [-len / 2, len / 2]) for (const sz of [-0.3, 0.3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.3, 0.05), steel); p.position.set(sx, 1.15, sz); g.add(p); }
  for (let t = 0; t < tiers; t++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.66), steel); b.position.set(0, 0.25 + t * 0.62, 0); g.add(b);
    for (let i = 0; i < Math.floor(len / 0.55); i++) if (Math.sin(i * 12.9 + t * 7.1 + x) > -0.4) {
      const h = 0.25 + ((Math.sin(i * 3.3 + t) + 1) * 0.12);
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, 0.4), horrorSurface('padded', { color: 0x8a8670, roughness: 0.9, bump: 0.6 })); c.position.set(-len / 2 + 0.35 + i * 0.55, 0.27 + t * 0.62 + h / 2, 0); c.rotation.y = Math.sin(i * 5.1 + t) * 0.15; g.add(c);
    }
  }
  solid(w, { x, z, rot, w: len, d: 0.7, h: 2.3 });
  return g;
}

/** A laundry cart / bin: a wire box full of grey linen. Solid. */
export function bin(w, { x, z, rot = 0, linen = true }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(1.1, 0.06, 0.8), mat('steel'), 0, 0.22, 0);
  for (const [sx, sz, lw, ld] of [[0, 0.4, 1.1, 0.03], [0, -0.4, 1.1, 0.03], [0.55, 0, 0.03, 0.8], [-0.55, 0, 0.03, 0.8]]) add(new THREE.BoxGeometry(lw, 0.8, ld), horrorSurface('rust', { color: 0x6d7773, roughness: 0.6, metalness: 0.7 }), sx, 0.65, sz).material.transparent = false;
  for (const [sx, sz] of [[-0.5, -0.35], [0.5, -0.35], [-0.5, 0.35], [0.5, 0.35]]) add(new THREE.SphereGeometry(0.06, 8, 6), mat('rubber'), sx, 0.07, sz);
  if (linen) { const l = add(new THREE.SphereGeometry(0.5, 12, 8), mat('cloth'), 0, 1.0, 0); l.scale.set(1.0, 0.45, 0.7); l.rotation.y = 0.4; }
  solid(w, { x, z, rot, w: 1.1, d: 0.8, h: 1.1 });
  return g;
}

/** A duct run (square sheet-metal tunnel) from (x0,z0) to (x1,z1), axis aligned. Walls are solid; the ceiling is decorative. */
export function ductFloor(w, { x0, z0, x1, z1, width = 1.6 }) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, lx = Math.abs(x1 - x0) + (x0 === x1 ? width : 0), lz = Math.abs(z1 - z0) + (z0 === z1 ? width : 0);
  return hp(w, { x: cx, y: 0, z: cz, w: lx, d: lz, h: 1, kind: 'rust', color: 0x6b6f66, path: false, rough: 0.5 });
}
export function ductWall(w, { x0, z0, x1, z1, h = 2.4 }) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, lx = Math.abs(x1 - x0), lz = Math.abs(z1 - z0);
  return hp(w, { x: cx, y: 0, z: cz, w: Math.max(0.2, lx), d: Math.max(0.2, lz), h, kind: 'rust', color: 0x7b7e70, path: false, rough: 0.5 });
}
export function ductCeil(w, { x0, z0, x1, z1, y = 2.4 }) {
  return box(w, { x: (x0 + x1) / 2, y: y + 0.1, z: (z0 + z1) / 2, w: Math.abs(x1 - x0) + 0.4, h: 0.2, d: Math.abs(z1 - z0) + 0.4, kind: 'rust', color: 0x5f6258, shadow: false });
}

// ---------------------------------------------------------------------------------------------------- HUD ------------------------------
/** The corner HUD: a heartbeat bar (how close he is), HIDDEN/EXPOSED, torch state, and an optional countdown. */
export function hud(w) {
  const el = document.createElement('div');
  el.id = 'lt-c2-hud';
  el.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:30;pointer-events:none;font:600 12px/1.2 "Archivo Black",Impact,sans-serif;letter-spacing:.18em;color:#c9d3cc;text-align:center;opacity:0;transition:opacity .4s;text-shadow:0 0 6px #000';
  el.innerHTML = '<div id="c2-timer" style="font-size:22px;letter-spacing:.22em;margin-bottom:6px;display:none"></div><div style="display:flex;gap:10px;align-items:center;justify-content:center"><span id="c2-state" style="min-width:74px;text-align:right">EXPOSED</span><div style="width:150px;height:8px;border:1px solid #5d6b66;background:rgba(0,0,0,.55)"><div id="c2-bar" style="height:100%;width:0%;background:#a8171f"></div></div><span id="c2-torch" style="min-width:74px;text-align:left">TORCH ON</span></div>';
  document.body.appendChild(el);
  w.disposers.push(() => el.remove());
  const q = (s) => el.querySelector(s);
  const H = { el, on: false };
  H.show = (v) => { H.on = v; el.style.opacity = v ? '0.92' : '0'; };
  H.set = ({ prox = 0, hidden = false, torch = true, timer = null, warn = false }) => {
    q('#c2-bar').style.width = Math.round(Math.max(0, Math.min(1, prox)) * 100) + '%';
    q('#c2-bar').style.background = prox > 0.7 ? '#e0242e' : '#a8171f';
    const s = q('#c2-state'); s.textContent = hidden ? 'HIDDEN' : 'EXPOSED'; s.style.color = hidden ? '#7fd6b0' : warn ? '#e0242e' : '#c9d3cc';
    q('#c2-torch').textContent = torch ? 'TORCH ON  [F]' : 'TORCH OFF [F]';
    const t = q('#c2-timer'); if (timer === null) t.style.display = 'none'; else { t.style.display = 'block'; const s2 = Math.max(0, Math.ceil(timer)); t.textContent = 'STAFF CHANGE ' + Math.floor(s2 / 60) + ':' + String(s2 % 60).padStart(2, '0'); }
  };
  return H;
}
