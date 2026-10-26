import * as THREE from 'three';
import { softTexture } from '../../engine/materials.js';
import { horrorSurface } from './materials.js';
import { box, hp, decal } from './kit.js';
import { figure } from './figure.js';
import { mat, screen } from './night-rounds-kit.js';

// Props and helpers for chapter 5 "The Theatre": a tilt-table with straps that open one by one, a surgical lamp that really lights the table, a
// gallery of seats whose watchers appear when you look away, the operator's console, instrument tables, an anaesthesia cart, an X-ray box, a
// reel-to-reel tape recorder, scrub sinks, name tags and a photograph. Everything is procedural.

const glow = (hex, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });
const put = (parent, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const LEATHER = new THREE.MeshStandardMaterial({ color: 0x2b1d16, roughness: 0.6, metalness: 0.1 });
const BLOOD = new THREE.MeshStandardMaterial({ color: 0x4a0709, roughness: 0.25, metalness: 0.2, emissive: 0x1a0203, emissiveIntensity: 0.6 });

/** World position of a local point on a group. */
export function worldOf(g, lx, ly, lz) { g.updateMatrixWorld(true); return g.localToWorld(new THREE.Vector3(lx, ly, lz)); }

/**
 * The tilt-table: an upright padded board on a low dais; the patient stands on the dais with their back to the board and four straps across
 * them. Faces -z (the gallery). `set(n)` opens the first n straps. Returns { dais: {x,y,z}, set, open }.
 */
export function tiltTable(w, { x, z }) {
  hp(w, { x, y: 0.3, z, w: 1.7, d: 1.7, h: 0.3, kind: 'rust', color: 0x56615d, rough: 0.5, bump: 1.4, path: false });
  const g = new THREE.Group(); g.position.set(x, 0, z); w.add(g);
  const board = put(g, new THREE.BoxGeometry(1.0, 2.1, 0.14), horrorSurface('padded', { color: 0x3b4640, roughness: 0.7 }), 0, 1.35, 0.62); board.rotation.x = -0.04;
  put(g, new THREE.BoxGeometry(0.26, 0.36, 0.22), mat('casing'), 0, 2.55, 0.66);                            // headrest bracket
  put(g, new THREE.BoxGeometry(0.1, 2.3, 0.1), mat('steel'), -0.58, 1.3, 0.7); put(g, new THREE.BoxGeometry(0.1, 2.3, 0.1), mat('steel'), 0.58, 1.3, 0.7);
  put(g, new THREE.BoxGeometry(1.5, 0.12, 0.2), mat('steel'), 0, 0.36, 0.7);
  const straps = [];
  const bar = (len, y, pz) => {                                                                              // a strap bar with a hinge at its left end
    const pivot = new THREE.Group(); pivot.position.set(-len / 2, y, pz); g.add(pivot);
    put(pivot, new THREE.BoxGeometry(len, 0.075, 0.05), LEATHER, len / 2, 0, 0);
    put(pivot, new THREE.BoxGeometry(0.08, 0.09, 0.08), mat('steel'), len, 0, 0);
    return pivot;
  };
  const wrist = (side) => { const p = new THREE.Group(); p.position.set(side * 0.62, 1.3, 0.1); g.add(p); const b = put(p, new THREE.BoxGeometry(0.3, 0.09, 0.09), LEATHER, -side * 0.15, 0, 0); put(p, new THREE.BoxGeometry(0.06, 0.1, 0.1), mat('steel'), -side * 0.3, 0, 0); void b; return p; };
  const ankle = bar(0.9, 0.62, 0.22), waist = bar(1.0, 1.1, 0.34), chest = bar(1.0, 1.75, 0.3);
  const wl = wrist(-1), wr = wrist(1);
  straps.push({ ps: [ankle], dir: -1.55 }, { ps: [wl, wr], dir: 0, drop: true }, { ps: [waist], dir: -1.55 }, { ps: [chest], dir: -1.55 });
  const S = { dais: { x, y: 0.3, z }, n: 0, cur: straps.map(() => 0), group: g };
  S.set = (n) => { S.n = n; };
  w.updaters.push((dt) => {
    straps.forEach((st, i) => {
      const t = i < S.n ? 1 : 0; S.cur[i] += (t - S.cur[i]) * Math.min(1, dt * 3);
      for (const p of st.ps) { if (st.drop) p.rotation.z = (p.position.x < 0 ? 1 : -1) * S.cur[i] * 1.2; else p.rotation.y = st.dir * S.cur[i]; }
    });
  });
  // old blood on the board, a handprint where somebody pulled
  decal(w, { kind: 'splat', seed: 31, x, y: 1.45, z: z + 0.545, w: 1.1, h: 1.1, face: 'n' });
  decal(w, { kind: 'hand', seed: 33, x: x - 0.22, y: 1.55, z: z + 0.546, w: 0.5, h: 0.5, face: 'n' });
  decal(w, { kind: 'drag', seed: 35, x, y: 0.015, z: z - 0.2, w: 2.2, h: 1.6, face: 'floor', rot: 1.57 });
  w.collider({ x, y: 1.3, z: z + 0.7, w: 1.5, h: 2.6, d: 0.3 });
  return S;
}

/** The surgical lamp: a big flat head on a jointed arm with a ring of bulbs and a real spotlight pointing at (tx, tz). `set(k)` 0..1; `pulse(s)` surges. */
export function surgicalLamp(w, { x, y = 5.2, z, tx = x, tz = z, power = 150 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
  put(g, new THREE.CylinderGeometry(0.22, 0.28, 0.2, 14), mat('casing'), 0, 1.12, 0);
  const arm1 = put(g, new THREE.BoxGeometry(0.1, 1.2, 0.1), mat('steel'), 0, 0.55, 0);
  const arm2 = put(g, new THREE.BoxGeometry(1.1, 0.09, 0.09), mat('steel'), 0.5, 0.0, 0); void arm1; void arm2;
  const head = new THREE.Group(); head.position.set(1.05, -0.05, 0); g.add(head);
  put(head, new THREE.CylinderGeometry(0.62, 0.7, 0.14, 24), mat('white'), 0, -0.1, 0);
  put(head, new THREE.CylinderGeometry(0.12, 0.12, 0.3, 10), mat('steel'), 0, 0.1, 0);
  const bulbs = []; const bm = glow(0xfff2d8, 0);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283, r = i < 8 ? 0.46 : 0.18; const aa = i < 8 ? a : a * 2; const b = put(head, new THREE.SphereGeometry(0.075, 8, 6), bm, Math.cos(aa) * r, -0.2, Math.sin(aa) * r); b.castShadow = false; bulbs.push(b); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xfff0d0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.set(3, 3, 1); halo.position.set(0, -0.35, 0); head.add(halo);
  const spot = new THREE.SpotLight(0xfff0dc, 0, 15, 0.6, 0.65, 1.3); spot.castShadow = false; head.add(spot); head.add(spot.target);
  spot.position.set(0, -0.3, 0);
  const L = { group: g, head, k: 0, surge: 0, base: 0 };
  L.set = (k) => { L.base = k; };
  L.pulse = (s = 0.5) => { L.surge = Math.max(L.surge, s); };
  const tmp = new THREE.Vector3();
  w.updaters.push((dt) => {
    L.surge = Math.max(0, L.surge - dt);
    const f = L.surge > 0 ? (hash(Math.floor(w.t * 25)) > 0.5 ? 1.8 : 0.1) : 1 + Math.sin(w.t * 90) * 0.02;
    L.k = L.base * f;
    bm.color.setScalar(L.k * 2.6); halo.material.opacity = Math.min(0.5, L.k * 0.4); spot.intensity = power * L.k;
    g.rotation.y = Math.sin(w.t * 0.35) * 0.05;
    head.updateMatrixWorld(true); tmp.set(tx, 0.9, tz); const lp = head.worldToLocal(tmp.clone()); spot.target.position.copy(lp);
  });
  return L;
}

/** A bench for the gallery. */
export function bench(w, { x, y, z, len = 2.6, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const wood = horrorSurface('wood', { roughness: 0.75, bump: 1 });
  put(g, new THREE.BoxGeometry(len, 0.07, 0.5), wood, 0, 0.45, 0);
  put(g, new THREE.BoxGeometry(len, 0.5, 0.06), wood, 0, 0.78, 0.26);
  for (const sx of [-len / 2 + 0.1, len / 2 - 0.1]) put(g, new THREE.BoxGeometry(0.07, 0.45, 0.45), mat('casing'), sx, 0.22, 0);
  return g;
}

/** A railing along x at z, with a collider (so nobody walks off). */
export function rail(w, { x0, x1, z, y = 0, h = 1.1 }) {
  const len = x1 - x0, cx = (x0 + x1) / 2, g = new THREE.Group(); w.add(g);
  put(g, new THREE.BoxGeometry(len, 0.07, 0.08), mat('steel'), cx, y + h, z); put(g, new THREE.BoxGeometry(len, 0.04, 0.05), mat('steel'), cx, y + h * 0.55, z);
  const n = Math.max(1, Math.round(len / 1.6));
  for (let i = 0; i <= n; i++) put(g, new THREE.CylinderGeometry(0.03, 0.03, h, 6), mat('steel'), x0 + (len * i) / n, y + h / 2, z);
  w.collider({ x: cx, y: y + h / 2, z, w: len, h, d: 0.2 });
}

/** The people in the gallery. `level` (set from outside) says how many are allowed to be there; each one appears only while you are NOT looking at its seat. */
export function watchers(w, game, S, slots) {
  const W = { level: 0, shown: 0, attention: 0, figs: [], target: { x: 0, z: -32 } };
  slots.forEach((s, i) => {
    const f = figure(w, { kind: i % 5 === 3 ? 'wrong' : 'patient' }); f.set(s.x, s.y, s.z); f.group.visible = false; f.pose(0, 0, 0, i);
    W.figs.push({ f, s, on: false, seen: 0, ord: hash(i + 11), ph: hash(i + 40) * 6 });
  });
  const order = W.figs.slice().sort((a, b) => a.ord - b.ord);
  let cd = 0; const v = new THREE.Vector3(); const prev = w.hooks.frame;
  w.hooks.frame = (dt, g) => {
    prev?.(dt, g);
    const cam = g.camera; cam.getWorldDirection(v); cd -= dt;
    let shown = 0;
    for (const F of W.figs) {
      if (!F.on) continue; shown++;
      const dx = F.s.x - cam.position.x, dz = F.s.z - cam.position.z, d = Math.hypot(dx, dz) || 1;
      const tx = W.attention ? cam.position.x : W.target.x, tz = W.attention ? cam.position.z : W.target.z;
      F.f.face(Math.atan2(tx - F.s.x, tz - F.s.z));
      F.f.pose(0, 0, 0, w.t + F.ph); F.f.twitch = W.attention ? 0.3 : 0;
      void d; void dx; void dz;
    }
    W.shown = shown;
    if (shown < W.level && cd <= 0) {
      for (const F of order) {
        if (F.on) continue;
        const dx = F.s.x - cam.position.x, dz = F.s.z - cam.position.z, d = Math.hypot(dx, dz) || 1;
        const facing = (v.x * dx + v.z * dz) / d;
        if (facing < 0.1 || d > 38) { F.on = true; F.f.group.visible = true; cd = 1.4 + hash(shown + w.t) * 2.2; S.breath(Math.max(-1, Math.min(1, -dx / 14)), 0.035); break; }
      }
    }
  };
  W.setLevel = (n) => { W.level = n; };
  W.all = () => { for (const F of W.figs) { F.on = true; F.f.group.visible = true; } };
  return W;
}

/** The operator's desk: 4 colour buttons, a hold-lever, a klaxon, a screen. Faces +z at rot 0. Returns handles and local positions (use worldOf). */
export function machineConsole(w, { x, y = 0, z, rot = 0, draw }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  put(g, new THREE.BoxGeometry(3.8, 1.0, 0.9), horrorSurface('rust', { color: 0x38433e, roughness: 0.55, metalness: 0.75, bump: 1.5 }), 0, 0.5, 0);
  put(g, new THREE.BoxGeometry(3.7, 0.06, 0.86), mat('dark'), 0, 1.03, 0);
  put(g, new THREE.BoxGeometry(3.4, 0.1, 0.5), mat('casing'), 0, 1.15, -0.3).rotation.x = 0.35;
  const cols = [0xff3a3a, 0x3dff7a, 0x4a9bff, 0xffb02a];
  const btn = cols.map((c, i) => {
    const m = glow(c, 0.5);
    const lx = -0.9 + i * 0.6; put(g, new THREE.CylinderGeometry(0.17, 0.2, 0.05, 18), mat('casing'), lx, 1.09, 0.2);
    const b = put(g, new THREE.CylinderGeometry(0.13, 0.13, 0.09, 18), m, lx, 1.14, 0.2);
    return { mesh: b, mat: m, col: c, lx, lz: 0.2 };
  });
  const arm = new THREE.Group(); arm.position.set(-1.55, 1.08, 0.2); g.add(arm);
  put(g, new THREE.CylinderGeometry(0.1, 0.12, 0.08, 14), mat('steel'), -1.55, 1.07, 0.2);
  put(arm, new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), mat('steel'), 0, 0.25, 0); put(arm, new THREE.SphereGeometry(0.08, 10, 8), mat('red'), 0, 0.52, 0);
  const kl = put(g, new THREE.CylinderGeometry(0.15, 0.17, 0.12, 18), mat('red'), 1.55, 1.12, 0.2);
  const klLamp = glow(0xff3a2a, 0.4); put(g, new THREE.CylinderGeometry(0.2, 0.2, 0.03, 18), klLamp, 1.55, 1.08, 0.2);
  for (let i = 0; i < 6; i++) put(g, new THREE.BoxGeometry(0.2, 0.05, 0.14), glow(i % 2 ? 0xffb040 : 0x60e0a0, 0.7), -0.7 + i * 0.28, 1.2, -0.3 + 0.02);
  const scr = screen(w, { x: 0, y: 0, z: 0, width: 2.6, height: 1.3, px: 320, draw, rate: 6, tint: 1.4, glow: 0x7cffc0 });
  scr.group.removeFromParent(); g.add(scr.group); scr.group.position.set(0, 2.05, -0.33); scr.group.rotation.x = -0.12;
  put(g, new THREE.BoxGeometry(0.1, 0.9, 0.1), mat('casing'), -1.3, 1.45, -0.33); put(g, new THREE.BoxGeometry(0.1, 0.9, 0.1), mat('casing'), 1.3, 1.45, -0.33);
  const L = { group: g, btn, arm, klLamp, screen: scr, kl };
  L.flash = (i, k = 2.8) => { btn[i].mat.color.setHex(btn[i].col).multiplyScalar(k); btn[i].t = 0.35; };
  w.updaters.push((dt) => { for (const b of btn) { if (b.t > 0) { b.t -= dt; if (b.t <= 0) b.mat.color.setHex(b.col).multiplyScalar(0.5); } } });
  L.lever = (k) => { arm.rotation.x = k * 0.9; };
  L.klaxon = (on) => { klLamp.color.setHex(0xff3a2a).multiplyScalar(on ? 2.2 : 0.4); };
  return L;
}

/** A steel instrument table with spread instruments, a bowl and blood. Solid. */
export function instrumentTable(w, { x, z, rot = 0, blood = true }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  put(g, new THREE.BoxGeometry(1.0, 0.04, 0.6), mat('steel'), 0, 0.88, 0);
  for (const [px, pz] of [[-0.45, -0.25], [0.45, -0.25], [-0.45, 0.25], [0.45, 0.25]]) { put(g, new THREE.CylinderGeometry(0.02, 0.02, 0.88, 6), mat('steel'), px, 0.44, pz); put(g, new THREE.SphereGeometry(0.04, 8, 6), mat('dark'), px, 0.04, pz); }
  put(g, new THREE.BoxGeometry(0.9, 0.025, 0.5), mat('steel'), 0, 0.3, 0);
  const tray = mat('steel');
  for (let i = 0; i < 7; i++) {
    const s = put(g, new THREE.BoxGeometry(0.014, 0.012, 0.16 + (i % 3) * 0.05), tray, -0.38 + i * 0.1, 0.915, -0.1 + (i % 2) * 0.12); s.rotation.y = (i - 3) * 0.28;
    if (i % 3 === 0) put(g, new THREE.BoxGeometry(0.05, 0.012, 0.03), BLOOD, -0.38 + i * 0.1, 0.92, -0.04 + (i % 2) * 0.12);
  }
  const saw = put(g, new THREE.BoxGeometry(0.34, 0.02, 0.05), tray, 0.25, 0.92, 0.18); saw.rotation.y = 0.5;
  for (let i = 0; i < 9; i++) put(g, new THREE.BoxGeometry(0.014, 0.014, 0.014), mat('dark'), 0.13 + i * 0.03, 0.93, 0.2 - i * 0.012);
  put(g, new THREE.CylinderGeometry(0.1, 0.07, 0.07, 14), mat('white'), -0.3, 0.945, 0.15);
  put(g, new THREE.CylinderGeometry(0.085, 0.085, 0.01, 14), BLOOD, -0.3, 0.975, 0.15);
  if (blood) decal(w, { kind: 'splat', seed: 50 + Math.floor(x * 3), x, y: 0.02, z: z + 0.5, w: 1.3, h: 1.3 });
  w.collider({ x, y: 0.45, z, w: Math.abs(Math.cos(rot)) > 0.7 ? 1.05 : 0.65, h: 0.9, d: Math.abs(Math.cos(rot)) > 0.7 ? 0.65 : 1.05 });
  return g;
}

/** An anaesthesia cart: gas cylinders, bellows, a green display, tubing and a mask on a hook. Solid. */
export function anaesCart(w, { x, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  put(g, new THREE.BoxGeometry(0.75, 1.1, 0.6), horrorSurface('rust', { color: 0x4a5753, roughness: 0.5, metalness: 0.7 }), 0, 0.65, 0);
  put(g, new THREE.BoxGeometry(0.8, 0.05, 0.65), mat('white'), 0, 1.22, 0);
  put(g, new THREE.BoxGeometry(0.5, 0.32, 0.06), glow(0x6dffb0, 0.8), 0, 1.5, 0.15);
  put(g, new THREE.BoxGeometry(0.58, 0.4, 0.1), mat('dark'), 0, 1.5, 0.1);
  for (const [px, c] of [[-0.42, 0x2a6f9a], [0.42, 0x3f8f4a]]) { put(g, new THREE.CylinderGeometry(0.075, 0.075, 0.8, 12), new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.7 }), px, 0.5, -0.1); put(g, new THREE.SphereGeometry(0.075, 10, 8), mat('steel'), px, 0.9, -0.1); }
  const bell = put(g, new THREE.CylinderGeometry(0.11, 0.11, 0.3, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x9aa39a, roughness: 0.5, transparent: true, opacity: 0.6, side: THREE.DoubleSide }), 0.15, 1.45, -0.2); void bell;
  const tube = put(g, new THREE.TorusGeometry(0.28, 0.018, 6, 24, 4.4), new THREE.MeshStandardMaterial({ color: 0x1c2224, roughness: 0.8 }), -0.45, 1.0, 0.3); tube.rotation.y = Math.PI / 2;
  put(g, new THREE.ConeGeometry(0.09, 0.14, 12), mat('white'), -0.5, 0.7, 0.45).rotation.x = Math.PI;
  w.collider({ x, y: 0.7, z, w: Math.abs(Math.cos(rot)) > 0.7 ? 0.8 : 0.65, h: 1.4, d: Math.abs(Math.cos(rot)) > 0.7 ? 0.65 : 0.8 });
  return g;
}

/** An X-ray lightbox on a wall (faces +z at rot 0) with two skulls that are one too many. */
export function xrayBox(w, { x, y = 1.9, z, rot = 0, width = 1.5, height = 1.0 }) {
  const cv = document.createElement('canvas'); cv.width = 384; cv.height = 256; const c = cv.getContext('2d');
  c.fillStyle = '#6f93a8'; c.fillRect(0, 0, 384, 256);
  const grad = c.createRadialGradient(192, 128, 10, 192, 128, 200); grad.addColorStop(0, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(0,0,0,0.5)'); c.fillStyle = grad; c.fillRect(0, 0, 384, 256);
  const skull = (cx, cy, r) => { c.fillStyle = 'rgba(230,240,245,0.85)'; c.beginPath(); c.ellipse(cx, cy, r, r * 1.15, 0, 0, 7); c.fill(); c.fillStyle = '#2a4252'; c.beginPath(); c.ellipse(cx - r * 0.38, cy + 2, r * 0.22, r * 0.28, 0, 0, 7); c.ellipse(cx + r * 0.38, cy + 2, r * 0.22, r * 0.28, 0, 0, 7); c.fill(); c.fillRect(cx - 3, cy + r * 0.4, 6, r * 0.4); c.fillStyle = 'rgba(230,240,245,0.8)'; c.fillRect(cx - r * 0.5, cy + r * 0.85, r, r * 0.35); };
  skull(110, 100, 46); skull(262, 112, 46);
  c.strokeStyle = 'rgba(230,240,245,0.55)'; c.lineWidth = 5; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(190, 250, 70 + i * 14, 3.4, 6.0); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,0.8)'; c.font = '16px monospace'; c.fillText('PT 114 / A', 12, 24); c.fillText('PT 114 / B', 290, 24);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(0.9, 1, 1.1) });
  put(g, new THREE.PlaneGeometry(width, height), m, 0, 0, 0.05);
  put(g, new THREE.BoxGeometry(width + 0.12, height + 0.12, 0.08), mat('casing'), 0, 0, 0);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0x8fc4e0, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.scale.set(width * 2.3, height * 2.3, 1); halo.position.z = 0.2; g.add(halo);
  return g;
}

/** A reel-to-reel tape recorder on a table; reels turn while it plays. */
export function tapeRecorder(w, { x, y, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  put(g, new THREE.BoxGeometry(0.62, 0.2, 0.42), horrorSurface('rust', { color: 0x3a423e, roughness: 0.5, metalness: 0.7, bump: 1.2 }), 0, 0.1, 0);
  put(g, new THREE.BoxGeometry(0.6, 0.02, 0.4), mat('dark'), 0, 0.205, 0);
  const reels = [];
  for (const sx of [-0.16, 0.16]) {
    const r = new THREE.Group(); r.position.set(sx, 0.255, -0.02); g.add(r);
    put(r, new THREE.CylinderGeometry(0.13, 0.13, 0.012, 22), mat('steel'), 0, 0, 0);
    put(r, new THREE.CylinderGeometry(0.1, 0.1, 0.03, 22), new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.5 }), 0, 0.016, 0);
    for (let i = 0; i < 3; i++) { const sp = put(r, new THREE.BoxGeometry(0.2, 0.014, 0.02), mat('dark'), 0, 0.034, 0); sp.rotation.y = i * 1.047; }
    reels.push(r);
  }
  const vu = new THREE.Group(); vu.position.set(0, 0.16, 0.215); g.add(vu);
  put(vu, new THREE.BoxGeometry(0.2, 0.08, 0.01), glow(0xffd88a, 0.5), 0, 0, 0);
  const needle = put(vu, new THREE.BoxGeometry(0.004, 0.06, 0.012), mat('dark'), 0, 0, 0.008);
  put(g, new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), mat('steel'), 0.24, 0.35, 0.1).rotation.z = 0.5;
  const R = { group: g, playing: false, lamp: null };
  const lampM = glow(0xff3a2a, 0.3); put(g, new THREE.SphereGeometry(0.02, 8, 6), lampM, -0.26, 0.18, 0.215);
  R.setPlaying = (on) => { R.playing = !!on; lampM.color.setHex(on ? 0x3dff7a : 0xff3a2a).multiplyScalar(on ? 2.4 : 0.3); };
  w.updaters.push((dt) => { if (R.playing) { reels[0].rotation.y += dt * 2.6; reels[1].rotation.y += dt * 3.4; needle.rotation.z = Math.sin(w.t * 9) * 0.6 * (0.5 + 0.5 * Math.sin(w.t * 2.3)); } });
  return R;
}

/** A wall basin with a tap and a mirror. Faces +z at rot 0. `set(on, red)` runs the water (clear or blood-tinged). */
export function sink(w, { x, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  put(g, new THREE.BoxGeometry(0.8, 0.22, 0.5), mat('white'), 0, 0.95, 0.2);
  put(g, new THREE.BoxGeometry(0.64, 0.05, 0.4), mat('dark'), 0, 1.06, 0.2);
  put(g, new THREE.BoxGeometry(0.06, 0.9, 0.06), mat('steel'), 0, 0.45, 0.4); put(g, new THREE.BoxGeometry(0.5, 0.06, 0.4), mat('steel'), 0, 0.3, 0.2);
  put(g, new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), mat('steel'), 0, 1.25, 0.04); put(g, new THREE.BoxGeometry(0.03, 0.03, 0.2), mat('steel'), 0, 1.4, 0.12);
  const mir = put(g, new THREE.PlaneGeometry(0.8, 0.9), new THREE.MeshStandardMaterial({ color: 0x0b1316, roughness: 0.04, metalness: 0.95 }), 0, 1.95, 0.02);
  put(g, new THREE.BoxGeometry(0.88, 0.98, 0.04), mat('casing'), 0, 1.95, -0.01); void mir;
  const wm = new THREE.MeshBasicMaterial({ color: 0x9fd0dc, transparent: true, opacity: 0.0, toneMapped: false });
  const stream = put(g, new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), wm, 0, 1.25, 0.2);
  stream.position.set(0, 1.23, 0.23); stream.castShadow = false;
  const S = { group: g, on: false, red: false };
  S.set = (on, red = false) => { S.on = on; S.red = red; wm.color.setHex(red ? 0x8a1218 : 0x9fd0dc); };
  w.updaters.push((dt) => { wm.opacity += ((S.on ? 0.55 : 0) - wm.opacity) * Math.min(1, dt * 6); });
  w.collider({ x, y: 0.5, z: z + Math.cos(rot) * 0.2, w: Math.abs(Math.cos(rot)) > 0.7 ? 0.85 : 0.5, h: 1.2, d: Math.abs(Math.cos(rot)) > 0.7 ? 0.5 : 0.85 });
  return S;
}

/** A canvas name tag texture. */
export function tagTexture(lines, { w: W = 256, h: H = 128, bg = '#cfc8b0' } = {}) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, W, H); c.strokeStyle = '#3a342a'; c.lineWidth = 4; c.strokeRect(4, 4, W - 8, H - 8);
  c.fillStyle = '#2a251d'; c.textAlign = 'center'; c.textBaseline = 'middle';
  lines.forEach((l, i) => { c.font = `700 ${i === 0 ? 20 : 30}px monospace`; c.fillText(l, W / 2, H * (0.3 + i * 0.4)); });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function tagPlane(w, { x, y, z, rot = 0, lines, width = 0.3, height = 0.15 }) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: tagTexture(lines), roughness: 0.9, emissive: 0x201c10, emissiveIntensity: 0.3 }));
  m.position.set(x, y, z); m.rotation.y = rot; w.add(m); return m;
}

/** Two white coats on a rack. */
export function coatRack(w, { x, z, rot = 0, names = ['', ''] }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  put(g, new THREE.CylinderGeometry(0.03, 0.04, 1.9, 8), mat('steel'), 0, 0.95, 0); put(g, new THREE.CylinderGeometry(0.16, 0.2, 0.05, 12), mat('dark'), 0, 0.03, 0);
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI;
    const coat = put(g, new THREE.CylinderGeometry(0.2, 0.3, 1.0, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xb9bdb0, roughness: 1, side: THREE.DoubleSide }), Math.cos(a) * 0.19, 1.3, Math.sin(a) * 0.19);
    coat.scale.set(1, 1, 0.7); coat.rotation.y = a;
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshStandardMaterial({ map: tagTexture(['STAFF', names[i]], { w: 200, h: 100 }), roughness: 0.9, emissive: 0x201c10, emissiveIntensity: 0.3 }));
    tag.position.set(Math.cos(a) * 0.39, 1.55, Math.sin(a) * 0.39); tag.rotation.y = Math.PI / 2 - a; g.add(tag);
    put(g, new THREE.BoxGeometry(0.1, 0.12, 0.02), BLOOD, Math.cos(a) * 0.4, 1.2, Math.sin(a) * 0.4).rotation.y = Math.PI / 2 - a;
  }
  w.collider({ x, y: 0.95, z, w: 0.7, h: 1.9, d: 0.7 });
  return g;
}

/** A square concrete pillar (solid) with a lamp bracket. */
export function pillar(w, { x, z, h = 6.4, s = 0.7 }) {
  hp(w, { x, y: h, z, w: s, d: s, h, kind: 'concrete', color: 0x6c746f, rough: 0.9, bump: 1.6, path: false });
  box(w, { x, y: 0.4, z, w: s + 0.12, h: 0.8, d: s + 0.12, kind: 'concrete', color: 0x4d5450, shadow: false });
}

/** A round glowing wall button (hold target). Faces +z at rot 0. Returns { lamp(hex, k) }. */
export function wallButton(w, { x, y = 1.3, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  put(g, new THREE.BoxGeometry(0.44, 0.6, 0.1), mat('casing'), 0, 0, 0.05);
  const m = glow(0xff3a2a, 0.5);
  const b = put(g, new THREE.CylinderGeometry(0.13, 0.14, 0.08, 20), m, 0, 0.05, 0.13); b.rotation.x = Math.PI / 2;
  put(g, new THREE.BoxGeometry(0.3, 0.06, 0.02), glow(0x7cffc0, 0.5), 0, -0.2, 0.105);
  return { group: g, lamp(hex, k = 1.6) { m.color.setHex(hex).multiplyScalar(k); } };
}

/** A key card lying on a shelf (hidden when taken). */
export function keyCard(w, { x, y, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(0, rot, 0); w.add(g);
  const c = put(g, new THREE.BoxGeometry(0.2, 0.01, 0.13), new THREE.MeshStandardMaterial({ color: 0xc9c2a0, roughness: 0.6 }), 0, 0, 0);
  put(g, new THREE.BoxGeometry(0.2, 0.012, 0.03), glow(0xff3a2a, 0.9), 0, 0.002, 0.04); void c;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xffd8a0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.scale.setScalar(0.6); halo.position.y = 0.05; g.add(halo);
  return g;
}

/** Draw the photograph into a data URL. `who` is { a, b } display names. */
export function photoURL({ a = 'A', b = 'B' } = {}, { half = 0 } = {}) {
  const W = 640, H = 440, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6e6a58'); g.addColorStop(0.55, '#8d8668'); g.addColorStop(1, '#3d3a2e'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#4d4a3c'; c.fillRect(0, 150, W, 200);                                       // the front of the hospital
  c.fillStyle = '#2b2a22'; for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) c.fillRect(24 + i * 70, 170 + r * 56, 36, 34);
  c.fillStyle = '#e8d9a0'; c.fillRect(24 + 5 * 70, 170 + 56, 36, 34);
  c.fillStyle = '#1f1e18'; c.fillRect(290, 300, 60, 52);
  c.fillStyle = '#a9a28a'; c.font = '700 14px monospace'; c.textAlign = 'center'; c.fillText('LOWTIDE MEMORIAL', 320, 140);
  const person = (cx, tag, tool) => {                                                       // a figure in a white coat with a lanyard
    c.fillStyle = '#d6d2c0'; c.beginPath(); c.moveTo(cx - 46, 440); c.lineTo(cx - 34, 250); c.quadraticCurveTo(cx, 230, cx + 34, 250); c.lineTo(cx + 46, 440); c.fill();
    c.fillStyle = '#a9a28a'; c.fillRect(cx - 2, 255, 4, 120);
    c.fillStyle = '#8a8470'; c.beginPath(); c.ellipse(cx, 222, 25, 31, 0, 0, 7); c.fill();
    c.strokeStyle = '#1b1a14'; c.lineWidth = 4; for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(cx - 24 + i * 3, 205 + i * 2); c.lineTo(cx + 22 - i * 2, 240 - i * 3); c.stroke(); }        // the face scratched out
    c.fillStyle = '#cfc8b0'; c.fillRect(cx + 8, 290, 34, 20); c.fillStyle = '#2a251d'; c.font = '700 9px monospace'; c.textAlign = 'center'; c.fillText(tag, cx + 25, 303);
    if (tool === 'keys') { c.strokeStyle = '#b8a45a'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(cx - 52 + i * 5, 350 + i * 4, 6, 0, 7); c.stroke(); } }
    if (tool === 'board') { c.fillStyle = '#5a4630'; c.fillRect(cx - 76, 320, 38, 54); c.fillStyle = '#cfc8b0'; c.fillRect(cx - 72, 326, 30, 42); }
  };
  person(240, String(a).slice(0, 9).toUpperCase(), 'keys'); person(400, String(b).slice(0, 9).toUpperCase(), 'board');
  c.fillStyle = 'rgba(14,12,8,0.7)'; c.beginPath(); c.moveTo(560, 162); c.lineTo(572, 162); c.lineTo(572, 196); c.lineTo(560, 196); c.fill();        // somebody in a window, very tall
  c.fillStyle = '#ddd'; c.fillRect(562, 168, 3, 3); c.fillRect(567, 168, 3, 3);
  for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${i % 2 ? 20 : 220},${i % 2 ? 18 : 214},${i % 2 ? 10 : 190},${Math.random() * 0.18})`; c.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1 + Math.random() * 20); }
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 14; c.strokeRect(0, 0, W, H);
  c.fillStyle = 'rgba(230,224,200,0.9)'; c.fillRect(0, H - 34, W, 34); c.fillStyle = '#2a251d'; c.font = '700 15px monospace'; c.textAlign = 'left'; c.fillText(`NIGHT STAFF · ${String(a).toUpperCase()} & ${String(b).toUpperCase()} · "WE CAN START"`, 14, H - 12);
  if (half) {                                                                                  // a torn half: the other side is missing
    c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.moveTo(half > 0 ? W / 2 : W / 2 + 20, 0); const ys = 14; let px = W / 2;
    for (let y = 0; y <= H; y += ys) { px = W / 2 + (Math.sin(y * 0.11) * 14) + ((y * 7919) % 11) - 5; c.lineTo(px, y); }
    c.lineTo(half > 0 ? W : 0, H); c.lineTo(half > 0 ? W : 0, 0); c.closePath(); c.fill(); c.globalCompositeOperation = 'source-over';
  }
  return cv.toDataURL('image/png');
}
