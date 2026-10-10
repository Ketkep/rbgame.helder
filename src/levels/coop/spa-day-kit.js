import * as THREE from 'three';
import { glowMaterial, plainMaterial, softTexture } from '../../engine/materials.js';
import { canvasPlane } from '../hotel/escape-kit.js';
import { deck, sign, gate } from './kit.js';

// Session 5 (Spa Day) building blocks: glass control rooms with a live map console, steam vents, mud, conveyors, ice tiles.

const glassMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
const frameMat = () => plainMaterial(0x39424f, { metalness: 0.6, roughness: 0.4 });

/** A glass pane (visual only) from (x,z) with length `len` along z (axis 'z') or x (axis 'x'). */
function glass(w, { x, y, z, len, h = 3.6, axis }) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), glassMat);
  m.position.set(x, y + h / 2, z);
  if (axis === 'z') m.rotation.y = Math.PI / 2;
  w.add(m);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(axis === 'z' ? 0.12 : len, 0.12, axis === 'z' ? len : 0.12), frameMat());
  bar.position.set(x, y + h, z); w.add(bar);
  for (let k = 0; k <= Math.max(1, Math.round(len / 4)); k++) {
    const f = -len / 2 + (len / Math.max(1, Math.round(len / 4))) * k;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, h, 0.14), frameMat());
    post.position.set(axis === 'z' ? x : x + f, y + h / 2, axis === 'z' ? z + f : z); w.add(post);
  }
}
/** Invisible solid wall (collider) between two points on one axis. */
const wallBody = (w, { x, y, z, len, h = 3.6, axis, t = 0.4 }) => w.collider({ x, y: y + h / 2, z, w: axis === 'z' ? t : len, h, d: axis === 'z' ? len : t });

/**
 * A glass-walled control room. side +1 = east of the route (x 20..36), -1 = west (x -36..-20).
 * Doorway on the inner wall at z in [dz1, dz0]; an exit gate in the outer wall at z=exitZ.
 * Returns { exit (gate), screen (canvas plane), bz (button z), standZ, floorY, bx(i) }
 */
export function controlRoom(w, { side, z0, z1, y = 3, dz0, dz1, exitZ, title }) {
  const xi = side * 20, xo = side * 36, xc = side * 28, mid = (z0 + z1) / 2, len = z0 - z1;
  deck(w, { x: xc, y, z: mid, w: 16, d: len, h: 1, color: 0xd8c4a0 });
  // outer wall (with the exit doorway), north + south walls, inner wall (with the entry doorway)
  const ex0 = exitZ + 2, ex1 = exitZ - 2;
  for (const [a, b] of [[z0, ex0], [ex1, z1]]) if (a - b > 0.1) { wallBody(w, { x: xo, y, z: (a + b) / 2, len: a - b, axis: 'z' }); glass(w, { x: xo, y, z: (a + b) / 2, len: a - b, axis: 'z' }); }
  wallBody(w, { x: xc, y, z: z0, len: 16, axis: 'x' }); glass(w, { x: xc, y, z: z0, len: 16, axis: 'x' });
  wallBody(w, { x: xc, y, z: z1, len: 16, axis: 'x' }); glass(w, { x: xc, y, z: z1, len: 16, axis: 'x' });
  for (const [a, b] of [[z0, dz0], [dz1, z1]]) if (a - b > 0.1) { wallBody(w, { x: xi, y, z: (a + b) / 2, len: a - b, axis: 'z' }); glass(w, { x: xi, y, z: (a + b) / 2, len: a - b, axis: 'z' }); }
  const exit = gate(w, { x: xo, y, z: exitZ, w: 0.5, d: 4, h: 3.6, color: 0x39424f, tex: 'metal', glow: 0xff4d5e });
  sign(w, title, xc, y + 4.9, z0 - 0.3, { w: 9, h: 1.1, size: 40 });
  // desk + screen on the south wall
  const bz = z1 + 1.0;
  w.box({ x: xc, y: y + 0.5, z: bz + 0.05, w: 15.2, h: 1.0, d: 1.1, color: 0x2b2f3a, rough: 0.5 });
  w.box({ x: xc, y: y + 1.04, z: bz + 0.05, w: 15.2, h: 0.08, d: 1.2, color: 0x4a5160, rough: 0.4 });
  w.box({ x: xc, y: y + 3.95, z: z1 + 0.28, w: 14.4, h: 3.2, d: 0.14, color: 0x14171f, rough: 0.5 });
  const draw = { fn: null };
  const screen = canvasPlane(w, { x: xc, y: y + 3.95, z: z1 + 0.39, width: 14, height: 2.9, px: 1792, draw: (g, cw, ch) => idleScreen(g, cw, ch, title) });
  const room = { exit, screen, bz, standZ: bz + 1.7, floorY: y, xc, side, z0, z1, draw, bx: (i) => side * (22.2 + i * 1.5) };
  return room;
}

function idleScreen(g, cw, ch, title) {
  g.fillStyle = '#0a1018'; g.fillRect(0, 0, cw, ch);
  g.fillStyle = '#1f6f6a'; g.font = '700 54px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(title, cw / 2, ch / 2 - 24);
  g.fillStyle = '#3b4a5a'; g.font = '500 34px Inter, system-ui, sans-serif'; g.fillText('NO SIGNAL — CONSOLE LOCKED', cw / 2, ch / 2 + 40);
}

/** Live console screen: only the controller's machine redraws it (hz times a second). */
export function liveScreen(w, room, enabled, fn, hz = 8) {
  if (!enabled) return;
  let acc = 0;
  w.updaters.push((dt) => {
    acc += dt; if (acc < 1 / hz) return; acc = 0;
    room.screen.redraw((g, cw, ch) => { g.fillStyle = '#0a1018'; g.fillRect(0, 0, cw, ch); fn(g, cw, ch); });
  });
}

/**
 * A console button/lever. `onPress()` runs locally on the presser; the level turns it into shared state.
 * `lit()` says whether it glows (state shown on the cap). Returns { index, x, z, y }.
 */
export function consoleButton(w, room, i, { label, color = 0xffc83d, onPress, lit = () => false, enabled = true }) {
  const x = room.bx(i), z = room.bz, y = room.floorY + 1.08;
  const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.22, 20), plainMaterial(0x1b1e27, { metalness: 0.6, roughness: 0.4 })); base.position.y = 0.11; g.add(base);
  const mat = glowMaterial(color, 1.0);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.16, 20), mat); cap.position.y = 0.3; g.add(cap);
  sign(w, label, x, room.floorY + 2.1, z + 0.35, { w: 1.4, h: 0.5, size: 26, tw: 320, bg: 'rgba(10,12,18,0.7)', border: '#' + color.toString(16).padStart(6, '0') });
  w.updaters.push((dt) => {
    const on = lit();
    const target = on ? 0.26 : 0.34, k = Math.min(1, dt * 12);
    cap.position.y += (target - cap.position.y) * k;
    mat.color.setHex(color).multiplyScalar(on ? 2.6 : 0.8);
  });
  if (enabled) w.interactable({ x, y: room.floorY + 1.6, z, w: 1.1, h: 1.6, d: 1.0, range: 3.4, label: () => label, onUse: () => { onPress(); w.game.audio.confirm?.(); } });
  return { x, z, y };
}

/** Low railing along a walkway (collider + a faint visual). */
export function rail(w, { x, y, z, len, axis = 'z', h = 1.1 }) {
  w.collider({ x, y: y + h / 2, z, w: axis === 'z' ? 0.2 : len, h, d: axis === 'z' ? len : 0.2 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(axis === 'z' ? 0.08 : len, 0.08, axis === 'z' ? len : 0.08), glowMaterial(0xcfeaf2, 0.8, 0.55));
  m.position.set(x, y + h, z); w.add(m);
}

const puffTex = () => softTexture('glow');

/**
 * Steam vent row across the corridor. States: 0 off, 1 warning (hiss, orange grate), 2 scalding.
 * `venting(t)` (optional) returns seconds of manual venting left at world time t: while > 0 the row is off, and for a stuck row it warns
 * during its last second. `stuck` rows never cycle on their own.
 */
export function vent(w, o) {
  const { x = 0, z, y = 0, wd = 10, dp = 1.6, h = 2.6, period = 4.6, warn = 1.0, on = 1.5, offset = 0, stuck = false, venting = () => 0 } = o;
  const state = o.state || ((t) => {
    const r = venting(t);
    if (stuck) return r > 1 ? 0 : r > 0 ? 1 : 2;
    if (r > 0) return 0;
    const ph = (((t + offset) % period) + period) % period, off = period - warn - on;
    return ph < off ? 0 : ph < off + warn ? 1 : 2;
  });
  const hz = w.hazard({ x, y: y + h / 2, z, w: wd, h, d: dp });
  hz.core.material = new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.5, depthWrite: false });
  hz.shell.visible = false;
  hz.predict = (t) => state(t) === 2;
  // grate on the floor + rising puffs
  const grateMat = glowMaterial(0x5b6470, 1);
  const grate = new THREE.Mesh(new THREE.BoxGeometry(wd, 0.06, dp * 0.9), grateMat); grate.position.set(x, y + 0.03, z); w.add(grate);
  const puffs = [];
  const n = Math.max(4, Math.round(wd / 1.6));
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    s.scale.set(2.4, 2.4, 1); w.add(s); puffs.push(s);
  }
  const st = { hz, state, get s() { return cur; } };
  let cur = 0;
  w.updaters.push((dt, t) => {
    cur = state(t);
    hz.enabled = cur === 2;
    hz.group.visible = cur === 2;
    grateMat.color.setHex(cur === 2 ? 0xff5a3c : cur === 1 ? 0xffa23c : 0x5b6470).multiplyScalar(cur === 1 ? 1.2 + Math.sin(t * 16) * 0.8 : cur === 2 ? 2 : 0.7);
    for (let i = 0; i < n; i++) {
      const u = (t * 0.85 + i * 0.37) % 1;
      const s = puffs[i];
      s.position.set(x - wd / 2 + (i + 0.5) * (wd / n), y + 0.3 + u * h, z + Math.sin(i * 7 + t) * 0.2);
      s.material.opacity = cur === 2 ? 0.55 * (1 - u * 0.5) : cur === 1 ? 0.22 * (1 - u) : 0;
    }
  });
  return st;
}

/** Mud: slows whoever stands on it (each machine slows its own player). */
export function mud(w, o) {
  const p = w.plat({ tex: 'wood', color: 0x5a3d28, trim: null, ...o });
  const body = p.body;
  w.updaters.push(() => {
    const q = w.game.player;
    if (q.grounded && q.ground === body) { const sp = Math.hypot(q.vx, q.vz); if (sp > 2.3) { const k = 2.3 / sp; q.vx *= k; q.vz *= k; } }
  });
  // glossy bubbles
  const bm = new THREE.MeshStandardMaterial({ color: 0x7a5535, roughness: 0.2, metalness: 0.1 });
  const bubbles = [];
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bm);
    b.scale.y = 0.45; w.add(b); bubbles.push([b, (i * 0.618) % 1, (((i * 5.3) % 1) - 0.5) * (o.w - 1), (((i * 3.7) % 1) - 0.5) * (o.d - 1)]);
  }
  w.updaters.push((dt, t) => { for (const [b, ph, dx, dz] of bubbles) { b.position.set(o.x + dx, o.y + 0.05, o.z + dz); b.scale.setScalar(0.3 + 0.7 * Math.abs(Math.sin(t * 1.3 + ph * 6))); b.scale.y *= 0.5; } });
  return p;
}

/** A conveyor whose speed the level can change: `st.v` is the current signed belt speed (m/s along z). */
export function belt(w, o, speed) {
  const p = w.plat({ tex: 'metal', color: 0x2a2d3a, ...o });
  const n0 = w.updaters.length;
  w.conveyor(p, { vz: speed });
  w.updaters.length = n0;                                    // replace the built-in scroller with one that follows the real speed
  const mesh = p.group.children[p.group.children.length - 1], tex = mesh.material.map;
  const along = o.d, cycle = along / tex.repeat.y;
  const st = { plat: p, v: speed, target: speed };
  w.updaters.push((dt) => {
    st.v += Math.sign(st.target - st.v) * Math.min(Math.abs(st.target - st.v), dt * 14);
    p.body.conv[1] = st.v;
    tex.offset.y -= (st.v * dt) / cycle;
  });
  return st;
}

/** Cold-plunge tile: surfaces on a schedule driven by `tp()` (seconds since the pump started, or -1). */
export function iceTile(w, o) {
  const { x = 0, z, y = 0, wd = 6, d = 3.4, drop = 2.6, start, len = 3.4, tp } = o;
  const p = w.plat({ x, y, z, w: wd, d, h: 0.7, tex: 'metal', color: 0xbfeaf5, trim: 0x66e0ff, moving: true });
  const st = { plat: p, level: 0, get solid() { return st.level > 0.8; } };
  const trimMat = p.group.children[1]?.material;
  w.updaters.push(() => {
    const t = tp();
    let lv = 0, flash = 0;
    if (t >= 0) { lv = Math.min(1, Math.max(0, (t - (start - 0.6)) / 0.6), 1 - Math.min(1, Math.max(0, (t - (start + len)) / 0.6))); flash = t > start + len - 0.9 && t < start + len ? 1 : 0; }
    st.level = lv;
    p.setPos(p.base.x, p.base.y - (1 - lv) * drop, p.base.z);
    p.group.visible = lv > 0.02;
    p.body.enabled = lv > 0.8;
    if (trimMat) trimMat.color.setHex(flash ? 0xff8a5c : 0x66e0ff).multiplyScalar(flash ? 1.5 + Math.sin(w.t * 30) : 1.5);
  });
  return st;
}

/** Big water surface (set dressing) with a kill volume just under it. */
export function pool(w, { x, z, wd, dp, y = -1.2, color = 0x3aa6c8, hot = false }) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, dp), new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.8, emissive: hot ? 0x6a1a10 : 0x0a3040, emissiveIntensity: 0.6 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); w.add(m);
  const hz = w.hazard({ x, y: y - 0.9, z, w: wd, h: 1.8, d: dp, color: hot ? 0xff5a3c : 0x39b9e0 });
  hz.group.visible = false; hz.predict = () => false;
  return hz;
}

export { deck, sign, gate };
