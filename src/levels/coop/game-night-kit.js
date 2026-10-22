import * as THREE from 'three';
import { glowMaterial, plainMaterial, textTexture } from '../../engine/materials.js';

// Session 11 (Game Night) building blocks + the (pure) round planner. A giant board game: the Roller rolls, the Mover walks.

export const TILE_W = 6, TILE_D = 4;
export const tileZ = (zB0, i) => zB0 - TILE_D / 2 - TILE_D * i;
/** tile index under (x,z) of a board starting at zB0 with n tiles, or -1 */
export function tileAt(zB0, n, x, z, halfW = TILE_W / 2 + 0.1) {
  if (Math.abs(x) > halfW) return -1;
  const i = Math.floor((zB0 - z) / TILE_D);
  return i >= 0 && i < n ? i : -1;
}

/** Chance cards. `mod(r)` is how far the Mover ends up from start (the net advance d = f(r)). */
export const CARDS = {
  none: { name: 'NO CARD', text: 'No card this round.\nLand exactly on the roll.', adv: (r) => r, inv: (d) => d },
  f1: { name: 'FORWARD 1', text: 'CHANCE: FORWARD 1\nGo one tile further than the roll.', adv: (r) => r + 1, inv: (d) => d - 1 },
  f2: { name: 'FORWARD 2', text: 'CHANCE: FORWARD 2\nGo two tiles further than the roll.', adv: (r) => r + 2, inv: (d) => d - 2 },
  b1: { name: 'BACK 1', text: 'CHANCE: BACK 1\nStop one tile short of the roll.', adv: (r) => r - 1, inv: (d) => d + 1 },
  b2: { name: 'BACK 2', text: 'CHANCE: BACK 2\nStop two tiles short of the roll.', adv: (r) => r - 2, inv: (d) => d + 2 },
  dbl: { name: 'DOUBLE', text: 'CHANCE: DOUBLE\nThe roll counts twice.', adv: (r) => r * 2, inv: (d) => (d % 2 === 0 ? d / 2 : -1) },
};

const shuffle = (a, rand) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/**
 * Plan one round for the Roller/Mover boards. `rand` is a shared stream (same on both machines).
 * Returns { d, r, card, shown, t, base } where t = s + d is the Mover's true target, base = s + r the ring tile.
 */
export function planRound(rand, cfg, s, ri) {
  const left = cfg.R - ri, remaining = cfg.n - 1 - s;
  const fixed = cfg.fixed?.[ri];
  let d;
  if (fixed != null) d = fixed - s;
  else if (left === 1) d = remaining;
  else d = Math.max(cfg.minD || 1, Math.min(remaining - (left - 1) * (cfg.minD || 1), Math.round(remaining / left + (rand() - 0.5) * 1.6)));
  d = Math.max(1, d);
  let card = 'none', r = Math.min(6, d);
  for (const k of shuffle(cfg.cards.slice(), rand)) {
    const rr = CARDS[k].inv(d);
    if (rr >= 1 && rr <= 6 && s + rr <= cfg.n - 1) { card = k; r = rr; break; }
  }
  const shown = cfg.rigged ? Math.max(1, r - 1) : r;
  return { d, r, card, shown, t: s + d, base: s + r };
}

/** Trap halves between start and target: -1 none, 0 left half, 1 right half. Start, target and everything past it are clear. */
export function planTraps(rand, n, s, t, p) {
  const a = new Array(n).fill(-1);
  const mid = [];
  // two traps on neighbouring tiles always sit on the SAME half (opposite halves back to back cannot be walked)
  const put = (i) => { const h = rand() < 0.5 ? 0 : 1; a[i] = i > 0 && a[i - 1] >= 0 ? a[i - 1] : h; };
  for (let i = s + 1; i < t; i++) { mid.push(i); if (rand() < p) put(i); }
  if (mid.length && !mid.some((i) => a[i] >= 0)) put(mid[Math.floor(rand() * mid.length)]);
  for (let i = s + 2; i < t; i++) if (a[i] >= 0 && a[i - 1] >= 0 && a[i] !== a[i - 1]) a[i] = a[i - 1];
  return a;
}

/** A flat label lying on the floor (text or number). */
export function floorLabel(w, text, x, y, z, { size = 3, color = '#fff6dc', opacity = 0.9, tw = 256 } = {}) {
  const tex = textTexture(text, { w: tw, h: tw, color, size: Math.round(tw * 0.55), padding: 8 });
  w.ownTextures.push(tex);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.03, z); m.renderOrder = 2;
  w.add(m);
  return m;
}

/** A flat coloured rectangle on a floor (for trap halves, lane tints, stripes). */
export function floorRect(w, x, y, z, ww, dd, color, opacity = 0.5, glow = false) {
  const mat = glow ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false }) : new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, dd), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.025, z); m.renderOrder = 1;
  w.add(m);
  return m;
}

/** A flat ring that shrinks. */
export function timerRing(w, color = 0xffc83d) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.0, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 3; m.visible = false;
  w.add(m);
  return m;
}

/** A slowly turning giant die (set dressing). */
export function bigDie(w, x, y, z, s = 2.4, color = 0xf4efe6) {
  const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), plainMaterial(color, { roughness: 0.35 })); cube.castShadow = true; g.add(cube);
  const dot = glowMaterial(0x23232b, 0.1);
  const pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  const faces = [[0, 1], [1, 6], [2, 2], [3, 5], [4, 3], [5, 4]];
  const h = s / 2 + 0.01, q = s * 0.26;
  for (const [f, n] of faces) for (const [a, b] of pips[n]) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(s * 0.085, 14), dot);
    const u = a * q, v = b * q;
    if (f === 0) { p.position.set(u, v, h); }
    else if (f === 1) { p.position.set(u, v, -h); p.rotation.y = Math.PI; }
    else if (f === 2) { p.position.set(h, v, u); p.rotation.y = Math.PI / 2; }
    else if (f === 3) { p.position.set(-h, v, u); p.rotation.y = -Math.PI / 2; }
    else if (f === 4) { p.position.set(u, h, v); p.rotation.x = -Math.PI / 2; }
    else { p.position.set(u, -h, v); p.rotation.x = Math.PI / 2; }
    g.add(p);
  }
  g.rotation.set(0.4, 0.6, 0.2);
  w.updaters.push((dt) => { g.rotation.y += dt * 0.25; });
  return g;
}

/** A game pawn (set dressing). */
export function pawn(w, x, y, z, color = 0xff9a3d, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
  const m = plainMaterial(color, { roughness: 0.4 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * s, 0.9 * s, 0.5 * s, 20), m); base.position.y = 0.25 * s; g.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.6 * s, 1.8 * s, 20), m); body.position.y = 1.35 * s; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55 * s, 20, 16), m); head.position.y = 2.6 * s; g.add(head);
  return g;
}
