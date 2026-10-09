import * as THREE from 'three';
import { glowMaterial } from '../../engine/materials.js';
import { gate, sign } from './kit.js';

// Helpers for session 3 (Communication Exercise): walled rooms, press-E consoles, boards that show different things to each
// player, and a bot script that can walk, wait for a condition, and press a console. No modals anywhere (bots can't use them).

/** A plane with a canvas texture; `draw(ctx, w, h)` paints it. Faces +Z before rotY (rotY -PI/2 faces -X, +PI/2 faces +X). */
export function canvasPlane(w, { x, y, z, width, height, rotY = 0, px = 512, draw }) {
  const cv = document.createElement('canvas');
  cv.width = px; cv.height = Math.max(16, Math.round((px * height) / width));
  const g = cv.getContext('2d');
  draw(g, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  w.ownTextures.push(tex);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.position.set(x, y, z); m.rotation.set(0, rotY, 0);
  w.add(m);
  m.redraw = (fn) => { fn(g, cv.width, cv.height); tex.needsUpdate = true; };
  return m;
}

/** A board whose picture depends on who is looking: draw = { p1, p2, all } (functions (ctx, W, H)). Call .update() to repaint. */
export function board(w, o) {
  const c = w.coop;
  const pick = () => o.draw[c.me] || o.draw.all;
  const bez = w.box({ x: o.x + Math.sin(o.rotY || 0) * -0.04, y: o.y, z: o.z + Math.cos(o.rotY || 0) * -0.04, w: o.width + 0.3, h: o.height + 0.3, d: 0.08, color: 0x1a1d26, rot: o.rotY || 0, shadow: false });
  void bez;
  const m = canvasPlane(w, { ...o, draw: pick() });
  m.update = () => m.redraw(pick());
  return m;
}

export const COLS = ['#ff5a5f', '#4aa3ff', '#3ddc97', '#ffd23f', '#f4f4f4', '#b36bff'];
export const COL_HEX = [0xff5a5f, 0x4aa3ff, 0x3ddc97, 0xffd23f, 0xf4f4f4, 0xb36bff];
export const COL_NAME = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'WHITE', 'PURPLE'];

/** Fill a canvas with a dark panel. */
export function panelBg(g, W, H, border = '#ffc83d', bg = '#14161f') {
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = border; g.lineWidth = 6; g.strokeRect(6, 6, W - 12, H - 12);
}
export function text(g, s, x, y, size, color = '#fff3d0', align = 'center', weight = '700') {
  g.fillStyle = color; g.font = `${weight} ${size}px "Archivo Black", Impact, Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(s, x, y);
}

/** Six symbols drawn with paths (no font dependence). */
export function glyph(g, k, cx, cy, r, color = '#fff') {
  g.fillStyle = color; g.strokeStyle = color; g.lineWidth = r * 0.28; g.lineJoin = 'round';
  g.beginPath();
  if (k === 0) g.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
  else if (k === 1) { g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.95, cy + r * 0.8); g.lineTo(cx - r * 0.95, cy + r * 0.8); g.closePath(); }
  else if (k === 2) g.rect(cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6);
  else if (k === 3) { g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.8, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r * 0.8, cy); g.closePath(); }
  else if (k === 4) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); }
  if (k <= 4) g.fill();
  else { g.moveTo(cx - r * 0.85, cy); g.lineTo(cx + r * 0.85, cy); g.moveTo(cx, cy - r * 0.85); g.lineTo(cx, cy + r * 0.85); g.stroke(); }
}

/**
 * A walled room: floor (covers the wall thickness too), four tall walls, doorways with optional gates.
 * z0 = south interior edge, z1 = north interior edge (more negative). doorsN / doorsS: [{ c, w, gate: bool }].
 * Walls are 7 m (you jump 1.4 m) so rooms cannot be walked around; there is no ceiling.
 */
export function room(w, o) {
  const { x0 = -10, x1 = 10, z0, z1, y = 0, H = 7, T = 1, doorsN = [], doorsS = [], path = true, wallColor = 0xd9c8a8, floorColor = 0xb98a55, gateH = 5 } = o;
  w.plat({ x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, w: x1 - x0 + 2 * T, d: z0 - z1 + 2 * T, h: 1, tex: 'wood', color: floorColor, path });
  const wall = (cx, cz, ww, dd, lo = y - 3, hi = y + H) => { if (ww > 0.01 && dd > 0.01 && hi - lo > 0.01) w.plat({ x: cx, y: hi, z: cz, w: ww, d: dd, h: hi - lo, tex: 'wood', color: wallColor, radius: 0.03 }); };
  wall(x0 - T / 2, (z0 + z1) / 2, T, z0 - z1 + 2 * T);
  wall(x1 + T / 2, (z0 + z1) / 2, T, z0 - z1 + 2 * T);
  const gates = { n: [], s: [] };
  const side = (zc, doors, key) => {
    let x = x0 - T;
    for (const d of [...doors].sort((a, b) => a.c - b.c)) {
      const a = d.c - d.w / 2, b = d.c + d.w / 2;
      wall((x + a) / 2, zc, a - x, T);
      wall(d.c, zc, d.w, T, y + gateH, y + H);
      if (d.gate) gates[key].push(gate(w, { x: d.c, y, z: zc, w: d.w, h: gateH, d: T, color: 0x8a6a45 }));
      else gates[key].push(null);
      x = b;
    }
    wall((x + x1 + T) / 2, zc, x1 + T - x, T);
  };
  side(z1 - T / 2, doorsN, 'n');
  side(z0 + T / 2, doorsS, 's');
  return { x0, x1, z0, z1, y, at: (k) => z0 - k, gatesN: gates.n, gatesS: gates.s };
}

/**
 * A console you press with E: pedestal + glowing cap + optional label. `onPress` runs on the machine of the player who pressed
 * (put shared effects through w.coop). Presses are rate-limited (`cool` s). Stand 1.4 m south of it ("stand").
 */
export function button(w, o) {
  const { x, z, label = null, color = 0xffc83d, onPress, cool = 0.3, enabled = null, range = 3.4 } = o;
  w.box({ x, y: 0.65 + (o.y ?? 0), z, w: 0.9, h: 1.3, d: 0.9, color: 0x2b2f3a, shadow: false });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.24, 0.74), glowMaterial(color, 1.3));
  cap.position.set(x, 1.42 + (o.y ?? 0), z); w.add(cap);
  const mats = new Map();
  const tint = (hex, k = 1.3) => { const key = hex + '|' + k; if (!mats.has(key)) mats.set(key, glowMaterial(hex, k)); cap.material = mats.get(key); };
  let last = -9, flashT = 0, base = color;
  if (label) sign(w, label, x, 2.35 + (o.y ?? 0), z, { w: 2.2, h: 0.55, tw: 320, size: 28, bg: 'rgba(20,16,12,0.6)', border: '#' + color.toString(16).padStart(6, '0') });
  const it = w.interactable({
    x, y: 1.3 + (o.y ?? 0), z, w: 1.0, h: 0.9, d: 1.0, range, enabled,
    label: typeof o.itLabel === 'function' ? o.itLabel : (o.itLabel || label || 'Press'),
    onUse: () => { if (w.t - last < cool) return; last = w.t; w.game.audio.click?.(); flashT = 0.18; tint(0xffffff, 2.4); onPress?.(); },
  });
  w.updaters.push((dt) => { if (flashT > 0) { flashT -= dt; if (flashT <= 0) tint(base); } });
  return {
    x, z, cap, it, stand: { x, z: z + 1.4 },
    recolor(hex) { base = hex; tint(hex); },
    flash(hex, sec = 0.6) { tint(hex, 2.2); flashT = sec; },
  };
}

/**
 * Bot script. byRole = { p1: [...], p2: [...] }. Steps:
 *   { x, z, r?, ok? }       walk there; done on arrival (and when ok() holds, if given: waits there until it does)
 *   { press: btn, until }   go to the console, face it, press it until `until()` is true (skipped if already true)
 *   { wait: fn, at?: {x,z} } stand (optionally at a spot) until fn() holds
 *   { follow: true, until } walk the path:true platforms (generic bot) until the condition holds
 * Without steps left the generic path-follower takes over.
 */
export function bots(w, byRole) {
  const g = w.game, steps = byRole[w.coop.me] || [];
  let i = 0;
  const val = (v, d) => (typeof v === 'function' ? v() : v ?? d);
  w.botPlan = () => {
    const p = g.player;
    for (let guard = 0; guard < 40 && i < steps.length; guard++) {
      const s = steps[i];
      if (s.follow) { if (s.until && s.until()) { i++; continue; } return null; }
      if (s.press) {
        if (s.until()) { i++; continue; }
        const b = s.press, d = Math.hypot(b.stand.x - p.x, b.stand.z - p.z);
        if (d > 0.45) return { x: b.stand.x, z: b.stand.z };
        if (s.hold && s.hold()) return { x: b.x, z: b.z, wait: true };
        g.useFocus();
        return { x: b.x, z: b.z, wait: true };
      }
      if (s.wait) {
        if (s.wait()) { i++; continue; }
        if (s.at && Math.hypot(s.at.x - p.x, s.at.z - p.z) > 0.6) return { x: s.at.x, z: s.at.z };
        return { x: p.x, z: p.z, wait: true };
      }
      const tx = val(s.x, p.x), tz = val(s.z, p.z);
      const arrived = Math.hypot(tx - p.x, tz - p.z) < (s.r ?? 0.7);
      if (arrived && (!s.ok || s.ok())) { i++; s.then?.(); continue; }
      return { x: tx, z: tz, wait: arrived, jump: s.jump || false };
    }
    return null;
  };
  w.botIndex = () => i;
  w.botSetIndex = (n) => { i = n; };
}
