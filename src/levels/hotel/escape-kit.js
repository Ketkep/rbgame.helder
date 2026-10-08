import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { inView } from '../../engine/view.js';
import { stageTitle } from './trolls.js';
import { GOLD } from './kit.js';

// Shared pieces for the hotel's escape-room levels (3 Lost Luggage, 8 Dinner Is Served, 11 Room 404):
//   walls with doorways, sliding doors, wall keypads, a stage manager (banner + an honest clue ladder that only ever
//   talks about the room you are in), a darkness layer that leaves the HUD readable, mirrors that really reflect, and a
//   small modal panel for puzzles that are not keypads.

export const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
export const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = (a) => a[Math.floor(Math.random() * a.length)];

/** A plane with a canvas texture drawn by `draw(ctx, cw, ch)`. Faces +Z before `rotY`. */
export function canvasPlane(w, { x, y, z, width, height, rotY = 0, rotX = 0, px = 512, draw, basic = true, glow = 0, transparent = false, double = false, opacity = 1 }) {
  const c = document.createElement('canvas');
  c.width = px; c.height = Math.max(16, Math.round(px * height / width));
  const g = c.getContext('2d');
  draw(g, c.width, c.height);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  w.ownTextures.push(tex);
  const mat = basic
    ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent, opacity, side: double ? THREE.DoubleSide : THREE.FrontSide, depthWrite: !transparent })
    : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, transparent, opacity, side: double ? THREE.DoubleSide : THREE.FrontSide });
  if (glow) mat.color.setScalar(glow);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  m.position.set(x, y, z); m.rotation.set(rotX, rotY, 0, 'YXZ');
  w.add(m);
  m.userData.canvas = c; m.userData.ctx = g; m.userData.tex = tex;
  m.redraw = (fn) => { fn(g, c.width, c.height); tex.needsUpdate = true; };
  return m;
}

// ================================================================================================
//  Walls with doorways
// ================================================================================================
/**
 * A wall across X (constant z) from x0 to x1, solid from y0 to y1, with doorway gaps [{ c, w, h, y = floorY }].
 * `mat` = { tex, color, roughness }. Returns the plats.
 */
export function wallZ(w, { z, x0, x1, y0 = -2, y1 = 7, d = 0.8, gaps = [], mat = {}, floorY = 0 }) {
  const out = [];
  const m = { tex: 'panel', color: 0xffffff, roughness: 0.7, ...mat };
  const seg = (a, b, lo, hi) => { if (b - a > 0.01 && hi - lo > 0.01) out.push(w.plat({ x: (a + b) / 2, y: hi, z, w: b - a, d, h: hi - lo, radius: 0.02, ...m })); };
  let x = x0;
  for (const gp of [...gaps].sort((p, q) => p.c - q.c)) {
    const a = gp.c - gp.w / 2, b = gp.c + gp.w / 2, fy = gp.y ?? floorY;
    seg(x, a, y0, y1);
    seg(a, b, fy + gp.h, y1);
    if (fy > y0) seg(a, b, y0, fy);
    x = b;
  }
  seg(x, x1, y0, y1);
  return out;
}
/** A wall along Z (constant x) from z0 (north) to z1 (south). Gaps: [{ c (z centre), w, h }]. */
export function wallX(w, { x, z0, z1, y0 = -2, y1 = 7, d = 0.8, gaps = [], mat = {}, floorY = 0 }) {
  const out = [];
  const m = { tex: 'panel', color: 0xffffff, roughness: 0.7, ...mat };
  const seg = (a, b, lo, hi) => { if (b - a > 0.01 && hi - lo > 0.01) out.push(w.plat({ x, y: hi, z: (a + b) / 2, w: d, d: b - a, h: hi - lo, radius: 0.02, ...m })); };
  let z = Math.min(z0, z1);
  const zEnd = Math.max(z0, z1);
  for (const gp of [...gaps].sort((p, q) => p.c - q.c)) {
    const a = gp.c - gp.w / 2, b = gp.c + gp.w / 2, fy = gp.y ?? floorY;
    seg(z, a, y0, y1);
    seg(a, b, fy + gp.h, y1);
    if (fy > y0) seg(a, b, y0, fy);
    z = b;
  }
  seg(z, zEnd, y0, y1);
  return out;
}

/** A plain box room: floor slab, ceiling slab and (optionally) walls. Coordinates: z0 north (more negative), z1 south. */
export function roomBox(w, { x0, x1, z0, z1, y = 0, H = 6, floor = null, ceil = { tex: 'coffer', color: 0xffffff }, walls = {}, wallMat = {}, yb = -2, floorH = 1 }) {
  if (floor) w.plat({ x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: floorH, roughness: 0.8, radius: 0.02, ...floor });
  if (ceil) w.plat({ x: (x0 + x1) / 2, y: y + H + 0.5, z: (z0 + z1) / 2, w: x1 - x0 + 1.6, d: z1 - z0 + 1.6, h: 0.5, roughness: 0.85, radius: 0.02, ...ceil });
  const T = 0.8, out = {};
  if (walls.n) out.n = wallZ(w, { z: z0 - T / 2, x0: x0 - T, x1: x1 + T, y0: yb, y1: y + H, gaps: walls.n === true ? [] : walls.n, mat: wallMat, floorY: y });
  if (walls.s) out.s = wallZ(w, { z: z1 + T / 2, x0: x0 - T, x1: x1 + T, y0: yb, y1: y + H, gaps: walls.s === true ? [] : walls.s, mat: wallMat, floorY: y });
  if (walls.w) out.w = wallX(w, { x: x0 - T / 2, z0, z1, y0: yb, y1: y + H, gaps: walls.w === true ? [] : walls.w, mat: wallMat, floorY: y });
  if (walls.e) out.e = wallX(w, { x: x1 + T / 2, z0, z1, y0: yb, y1: y + H, gaps: walls.e === true ? [] : walls.e, mat: wallMat, floorY: y });
  return out;
}

// ================================================================================================
//  Doors
// ================================================================================================
/**
 * A door leaf filling a doorway that slides up into the wall when opened (and stays open).
 * `along` 'x' = the doorway is in a wall across X (constant z); 'z' = in a wall along Z (constant x).
 */
export function slideDoor(w, game, { x, z, along = 'x', width = 4, height = 4.4, y = 0, thick = 0.5, tex = 'metal', color = 0x8a95a6, speed = 0.9, stripes = null, onOpened = null }) {
  const leaf = w.plat({ x, y: y + height, z, w: along === 'x' ? width : thick, d: along === 'x' ? thick : width, h: height, tex, color, roughness: 0.45, metalness: tex === 'metal' ? 0.6 : 0.05, radius: 0.03, moving: true });
  if (stripes) {
    for (let i = 0; i < 4; i++) {
      const s = w.box({ x: 0, y: 0, z: 0, w: along === 'x' ? width - 0.24 : 0.04, h: 0.14, d: along === 'x' ? 0.04 : width - 0.24, color: stripes, shadow: false, static: false });
      s.position.set(x + (along === 'x' ? 0 : thick / 2 + 0.02), y + 0.8 + i * 0.95, z + (along === 'x' ? thick / 2 + 0.02 : 0));
      leaf.attach(s);
      const s2 = s.clone(); s2.position.set(x - (along === 'x' ? 0 : thick / 2 + 0.02), y + 0.8 + i * 0.95, z - (along === 'x' ? thick / 2 + 0.02 : 0)); w.add(s2); leaf.attach(s2);
    }
  }
  const st = { open: false, t: 0, leaf };
  w.onUpdate((dt) => {
    if (!st.open || st.t >= 1) return;
    st.t = Math.min(1, st.t + dt * speed);
    leaf.setPos(x, y + height / 2 + st.t * (height + 0.2), z);
    if (st.t >= 1) { leaf.setEnabled(false); onOpened?.(); }
  });
  st.openDoor = () => { if (st.open) return; st.open = true; game.audio.door(); };
  st.close = () => { st.open = false; st.t = 0; leaf.setEnabled(true); leaf.setPos(x, y + height / 2, z); };
  st.jolt = (lift = 0.25) => {   // the door twitches up and slams back down (a keypad that lies)
    let k = 0;
    const id = setInterval(() => { k += 0.08; const u = k < 0.5 ? k * 2 : Math.max(0, 2 - k * 2); leaf.setPos(x, y + height / 2 + u * lift, z); if (k >= 1) { clearInterval(id); leaf.setPos(x, y + height / 2, z); game.audio.land?.(8); } }, 30);
    w.onDispose(() => clearInterval(id));
  };
  return st;
}

/** Gold door frame (two posts + lintel) on the face of a wall. `face` = the direction the room it faces lies in. */
export function doorFrame(w, { x, z, along = 'x', width = 4, height = 4.4, y = 0, off = 0.42, color = GOLD }) {
  const n = along === 'x' ? [0, 1] : [1, 0];
  for (const s of [-1, 1]) for (const side of [-1, 1]) {
    if (along === 'x') w.box({ x: x + s * (width / 2 + 0.12), y: y + height / 2, z: z + side * off, w: 0.24, h: height, d: 0.08, color, metal: 1, rough: 0.3, shadow: false });
    else w.box({ x: x + side * off, y: y + height / 2, z: z + s * (width / 2 + 0.12), w: 0.08, h: height, d: 0.24, color, metal: 1, rough: 0.3, shadow: false });
  }
  for (const side of [-1, 1]) {
    if (along === 'x') w.box({ x, y: y + height + 0.12, z: z + side * off, w: width + 0.48, h: 0.24, d: 0.08, color, metal: 1, rough: 0.3, shadow: false });
    else w.box({ x: x + side * off, y: y + height + 0.12, z, w: 0.08, h: 0.24, d: width + 0.48, color, metal: 1, rough: 0.3, shadow: false });
  }
  void n;
}

// ================================================================================================
//  Wall keypads
// ================================================================================================
const FACE = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
/**
 * The physical keypad: a dark box on a wall (its front points `face`), a status LED, little keys, and an interactable.
 * `use(g)` is called on E. Returns { setLed(hex), standAt: {x,z}, it }.
 */
export function keypadBox(w, game, { x, y = 1.4, z, face = 's', label = 'Use keypad', use, enabled = null }) {
  const [nx, nz] = FACE[face];
  const alongX = nz !== 0;
  const bw = 0.62, bh = 0.9, bd = 0.14;
  w.box({ x, y, z, w: alongX ? bw : bd, h: bh, d: alongX ? bd : bw, color: 0x1c2028, metal: 0.4, rough: 0.4 });
  const fx = x + nx * (bd / 2 + 0.01), fz = z + nz * (bd / 2 + 0.01);
  const led = w.box({ x: fx, y: y + 0.3, z: fz, w: alongX ? 0.44 : 0.02, h: 0.16, d: alongX ? 0.02 : 0.44, glow: 0xff3a46, glowIntensity: 1.6, shadow: false, static: false });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    const o = -0.16 + c * 0.16;
    w.box({ x: fx + (alongX ? o : 0), y: y + 0.1 - r * 0.15, z: fz + (alongX ? 0 : o), w: alongX ? 0.1 : 0.02, h: 0.1, d: alongX ? 0.02 : 0.1, color: 0xcfd6e0, shadow: false });
  }
  const it = w.interactable({ x: x + nx * 0.25, y, z: z + nz * 0.25, w: alongX ? 0.9 : 0.6, h: 1.1, d: alongX ? 0.6 : 0.9, label, onUse: (g) => use(g), enabled });
  const mats = new Map();
  const setLed = (hex) => { if (!mats.has(hex)) mats.set(hex, glowMaterial(hex, 1.6)); led.material = mats.get(hex); };
  return { setLed, it, standAt: { x: x + nx * 1.25, z: z + nz * 1.25 }, x, z };
}

// ================================================================================================
//  Stage manager: banners, and an honest clue ladder that only concerns the room you are in
// ================================================================================================
/**
 * defs[i] = { name, at: {x,y,z} (where this stage starts), clues: ['hotel.lN.key', ...] (honest, room-only; the last one may
 * give the answer), vars: () => ({...}), solved: () => bool, trail: [{x,y,z}…] | () => [...] (the way through once solved,
 * or for a platforming stage; it ends at the next stage's `at`), end: {x,y,z} (last stage: where the trail ends) }.
 * H says the next clue of the current stage while its puzzle is unsolved, otherwise draws the trail to the next stage only.
 */
export function escapeStages(w, game, defs) {
  const S = { cur: 0, seen: new Set([0]), clue: defs.map(() => 0), defs, said: [] };
  S.enter = (i) => {
    if (i <= S.cur && S.seen.has(i)) return;
    S.cur = Math.max(S.cur, i);
    if (!S.seen.has(i)) { S.seen.add(i); stageTitle(game, w, i + 1, defs.length, defs[i].name); }
  };
  S.banner = () => stageTitle(game, w, S.cur + 1, defs.length, defs[S.cur].name);
  S.trailPoints = (g) => {
    const p = g.player, d = defs[S.cur];
    const route = [...((typeof d.trail === 'function' ? d.trail() : d.trail) || [])];
    const next = defs[S.cur + 1]?.at || (typeof d.end === 'function' ? d.end() : d.end) || (w.goalObj ? { x: w.goalObj.x, y: w.goalObj.y, z: w.goalObj.z } : null);
    if (next) route.push(next);
    if (!route.length) return null;
    let bi = 0, bd = Infinity;
    route.forEach((q, i) => { const dd = Math.hypot(q.x - p.x, q.z - p.z) + Math.abs(q.y - p.y) * 0.6; if (dd < bd) { bd = dd; bi = i; } });
    // never trail backwards: start from the nearest point that is not behind us along the route
    const out = [{ x: p.x, y: p.y + 0.15, z: p.z }];
    for (let k = bi + (bd < 1.2 ? 1 : 0); k < route.length && out.length < 7; k++) out.push({ x: route[k].x, y: route[k].y + 0.15, z: route[k].z });
    return out.length >= 2 ? out : null;
  };
  S.clueKey = () => {
    const d = defs[S.cur];
    if (!d.clues || (d.solved && d.solved())) return null;
    return d.clues[Math.min(S.clue[S.cur], d.clues.length - 1)];
  };
  w.hintAction = (g) => {
    const d = defs[S.cur];
    const k = S.clueKey();
    if (k) {
      S.clue[S.cur]++;
      S.said.push(k);
      g.say(k, { priority: 2, vars: d.vars ? d.vars() : {} });
      return true;
    }
    return 'trail';
  };
  w.hintFn = (g) => S.trailPoints(g);
  w.hintFlat = false;
  return S;
}

// ================================================================================================
//  Darkness (a black layer under the HUD, so the subtitles, crosshair and keypads stay readable)
// ================================================================================================
export function darkLayer(w) {
  const d = document.createElement('div');
  d.className = 'esc-dark';
  Object.assign(d.style, { position: 'absolute', inset: '0', background: '#020205', opacity: '0', pointerEvents: 'none', transition: 'opacity 200ms' });
  const app = document.getElementById('app'), hud = document.getElementById('hud');
  app.insertBefore(d, hud);
  w.onDispose(() => d.remove());
  let cur = 0;
  return {
    el: d,
    set(a, ms = 200) { if (a === cur) return; cur = a; d.style.transition = `opacity ${ms}ms`; d.style.opacity = String(a); },
    get value() { return cur; },
  };
}

// ================================================================================================
//  Mirrors (flat; they really reflect). `sees(x,y,z)` = is that point visible in the mirror from the player's eye right now?
// ================================================================================================
export function mirror(w, game, { x, y, z, width, height, face = 's', res = 512, frame = GOLD, tint = 0xb8c0c8 }) {
  const [nx, nz] = FACE[face];
  const geo = new THREE.PlaneGeometry(width, height);
  const r = new Reflector(geo, { clipBias: 0.003, textureWidth: res, textureHeight: Math.round(res * height / width), color: tint, multisample: 0 });
  r.position.set(x, y, z);
  r.rotation.y = Math.atan2(nx, nz);
  w.add(r);
  w.onDispose(() => { r.dispose(); });
  if (frame !== null) {
    const fm = plainMaterial(frame, { metalness: 1, roughness: 0.3 });
    const alongX = nz !== 0, t = 0.12, back = 0.03;
    const add = (dx, dy, ww, hh) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(alongX ? ww : t, hh, alongX ? t : ww), fm);
      m.position.set(x + (alongX ? dx : 0) - nx * back, y + dy, z + (alongX ? 0 : dx) - nz * back);
      w.add(m);
    };
    add(0, height / 2 + 0.06, width + 0.24, 0.12); add(0, -height / 2 - 0.06, width + 0.24, 0.12);
    add(-width / 2 - 0.06, 0, 0.12, height); add(width / 2 + 0.06, 0, 0.12, height);
  }
  const n = new THREE.Vector3(nx, 0, nz);
  const P = new THREE.Vector3(x, y, z);
  /** Is the point visible in this mirror (from the player's eye, inside the mirror's rectangle, and the mirror on screen)? */
  const sees = (px, py, pz, margin = 0.05) => {
    const p = game.player;
    const eye = new THREE.Vector3(p.x, p.y + 1.62, p.z);
    const dEye = eye.clone().sub(P).dot(n);
    if (dEye <= 0.05) return false;                                           // we are behind the mirror
    const X = new THREE.Vector3(px, py, pz);
    const dX = X.clone().sub(P).dot(n);
    if (dX <= 0) return false;                                                // the thing is behind the mirror
    const Xr = X.clone().addScaledVector(n, -2 * dX);                         // its reflection
    const t = dEye / (dEye + dX);                                             // where eye→reflection crosses the mirror plane
    const hit = eye.clone().lerp(Xr, t);
    const u = alongXOf(nx, nz) ? hit.x - x : hit.z - z;
    if (Math.abs(u) > width / 2 + margin || Math.abs(hit.y - y) > height / 2 + margin) return false;
    return inView(game, hit.x, hit.y, hit.z, 0.02);
  };
  return { r, sees, x, y, z, width, height, n };
}
const alongXOf = (nx, nz) => nz !== 0 && nx === 0;

// ================================================================================================
//  A small modal panel (same look as the keypad). `key(e)` gets the keys; returns { close, setBody(html), setFoot(html) }.
// ================================================================================================
export function panelModal(game, { title, body = '', foot = '', key, onClose = null }) {
  const el = game.ui.el;
  el['panel-title'].textContent = title;
  el['panel-body'].innerHTML = body;
  el['panel-foot'].innerHTML = foot;
  game.keys.clear();
  let closed = false;
  const close = () => { if (closed) return; closed = true; el.panel.classList.add('hidden'); if (game.modal === modal) game.modal = null; onClose?.(); };
  const modal = { key: (e) => key(e, api), close };
  const api = { close, setBody: (h) => { el['panel-body'].innerHTML = h; }, setFoot: (h) => { el['panel-foot'].innerHTML = h; }, body: el['panel-body'], get closed() { return closed; } };
  game.modal = modal;
  el.panel.classList.remove('hidden');
  return api;
}

/** A readable document (a report, a menu…) in the panel. E / Esc closes it. */
export function readModal(game, { title, html }) {
  return panelModal(game, {
    title, body: `<div class="kp-msg" style="font-size:15px;line-height:1.55;color:#f1e6c8;text-align:left;max-width:420px;margin:0 auto">${html}</div>`,
    foot: '<kbd>E</kbd> / <kbd>Esc</kbd> put it down',
    key: (e, api) => { if (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'KeyQ' || e.code === 'Enter') api.close(); },
  });
}

/** Ceiling strip light + halo (no real light: add a few w.light() per room yourself). */
export function stripLight(w, x, y, z, { len = 2.6, color = 0xdff4ff, along = 'x' } = {}) {
  w.box({ x, y, z, w: along === 'x' ? len : 0.3, h: 0.1, d: along === 'x' ? 0.3 : len, glow: color, glowIntensity: 1.5, shadow: false });
}
