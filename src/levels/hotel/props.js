import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture, textTexture } from '../../engine/materials.js';
import { L, ELEV_X, GOLD } from './kit.js';

// Furniture and dressing for the lobby. Anything you could plausibly jump on is a real platform
// (so the hub is explorable and the "Wet Floor" level can use it).

const gold = (rough = 0.28) => plainMaterial(GOLD, { metalness: 1, roughness: rough });
function add(w, geo, mat, x, y, z, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
  m.castShadow = o.cast ?? true; m.receiveShadow = o.recv ?? true;
  if (o.static !== false) { m.matrixAutoUpdate = false; m.updateMatrix(); }
  w.add(m);
  return m;
}

/** Sofa. quarter 0 faces -Z (north), 1 faces +X, 2 faces +Z, 3 faces -X. Returns its platforms. */
export function sofa(w, x, z, quarter = 0, { color = 0x7a1030, len = 3.4 } = {}) {
  const even = quarter % 2 === 0;
  const sw = even ? len : 1.1, sd = even ? 1.1 : len;
  const facing = [[0, -1], [1, 0], [0, 1], [-1, 0]][quarter % 4];
  const bk = [-facing[0], -facing[1]];
  const plat = (o) => w.plat({ tex: 'leather', color, roughness: 0.45, radius: 0.1, ...o });
  const seat = plat({ x, y: 0.45, z, w: sw, d: sd, h: 0.45 });
  const back = plat({ x: x + bk[0] * (0.55 - 0.125), y: 1.1, z: z + bk[1] * (0.55 - 0.125), w: even ? sw : 0.25, d: even ? 0.25 : sd, h: 0.65 });
  for (const e of [-1, 1]) {
    const ax = even ? x + e * (sw / 2 - 0.15) : x, az = even ? z : z + e * (sd / 2 - 0.15);
    plat({ x: ax, y: 0.8, z: az, w: even ? 0.3 : sw, d: even ? sd : 0.3, h: 0.5 });
  }
  for (const fx of [-1, 1]) for (const fz of [-1, 1]) add(w, new THREE.CylinderGeometry(0.05, 0.035, 0.18, 8), gold(), x + fx * (sw / 2 - 0.12), 0.09, z + fz * (sd / 2 - 0.12));
  return { seat, back };
}

export function armchair(w, x, z, quarter = 0, { color = 0x10342b } = {}) {
  return sofa(w, x, z, quarter, { color, len: 1.5 });
}

export function coffeeTable(w, x, z, { w: tw = 1.8, d: td = 1.0, h = 0.55 } = {}) {
  const top = w.plat({ x, y: h, z, w: tw, d: td, h: 0.08, tex: 'marble', color: 0xffffff, roughness: 0.1 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(w, new THREE.CylinderGeometry(0.04, 0.04, h - 0.05, 8), gold(), x + sx * (tw / 2 - 0.12), (h - 0.05) / 2, z + sz * (td / 2 - 0.12));
  // a little lamp
  add(w, new THREE.CylinderGeometry(0.05, 0.08, 0.2, 10), gold(), x, h + 0.14, z);
  add(w, new THREE.SphereGeometry(0.11, 12, 10), glowMaterial(0xffd8a0, 2.2), x, h + 0.34, z, { cast: false });
  return top;
}

export function rug(w, x, z, rw, rd, color = 0x6b0f24) {
  const tex = require_tex(w, color);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd), tex);
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); w.add(m);
}
function require_tex(w, color) {
  w._rugMat = w._rugMat || {};
  if (!w._rugMat[color]) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(220,175,80,0.85)'; g.lineWidth = 8; g.strokeRect(12, 12, 232, 232);
    g.lineWidth = 3; g.strokeRect(30, 30, 196, 196);
    g.fillStyle = 'rgba(220,175,80,0.6)'; g.beginPath(); g.moveTo(128, 70); g.lineTo(186, 128); g.lineTo(128, 186); g.lineTo(70, 128); g.closePath(); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    w._rugMat[color] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  }
  return w._rugMat[color];
}

export function palm(w, x, z, s = 1) {
  const pot = new THREE.Group(); pot.position.set(x, 0, z);
  const potMat = plainMaterial(0x1a1a22, { roughness: 0.3, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * s, 0.4 * s, 0.9 * s, 20), potMat); body.position.y = 0.45 * s; body.castShadow = true; pot.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55 * s, 0.05 * s, 8, 24), gold()); rim.rotation.x = Math.PI / 2; rim.position.y = 0.9 * s; pot.add(rim);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.5 * s, 0.05, 16), plainMaterial(0x2a1a10, { roughness: 1 })); soil.position.y = 0.88 * s; pot.add(soil);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.55, flatShading: true, side: THREE.DoubleSide });
  const trunkMat = plainMaterial(0x5a4a30, { roughness: 0.9 });
  for (let t = 0; t < 3; t++) {
    const a = t * 2.1, lean = 0.12 + t * 0.06, h = (2.6 + t * 0.5) * s;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.1 * s, h, 8), trunkMat);
    trunk.position.set(Math.cos(a) * 0.25 * s, 0.9 * s + h / 2, Math.sin(a) * 0.25 * s); trunk.rotation.z = Math.cos(a) * lean; trunk.rotation.x = Math.sin(a) * lean; trunk.castShadow = true; pot.add(trunk);
    const top = new THREE.Vector3(Math.cos(a) * (0.25 + h * lean * 0.5) * s, 0.9 * s + h, Math.sin(a) * (0.25 + h * lean * 0.5) * s);
    for (let f = 0; f < 9; f++) {
      const fa = (f / 9) * Math.PI * 2 + t;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.2 * s, 2.3 * s, 4, 1), leafMat);
      leaf.scale.set(1, 1, 0.18);
      leaf.position.copy(top).add(new THREE.Vector3(Math.cos(fa) * 0.7 * s, -0.25 * s, Math.sin(fa) * 0.7 * s));
      leaf.rotation.set(0, -fa, 0); leaf.rotateZ(-Math.PI / 2 + 0.55); leaf.castShadow = true;
      pot.add(leaf);
    }
  }
  pot.traverse((o) => { o.matrixAutoUpdate = false; o.updateMatrix(); }); pot.matrixAutoUpdate = false; pot.updateMatrix();
  w.add(pot);
  w.collider({ x, y: 0.45 * s, z, w: 1.0 * s, h: 0.9 * s, d: 1.0 * s });
}

// ---- grand piano -----------------------------------------------------------------------------------
export function piano(w, x, z, game) {
  const black = plainMaterial(0x0b0b10, { roughness: 0.08, metalness: 0.3 });
  const body = w.plat({ x, y: 1.0, z, w: 1.6, d: 2.6, h: 0.5, tex: 'wood', color: 0x15151a, roughness: 0.08, radius: 0.15 });   // body (top at 1.0)
  add(w, new THREE.BoxGeometry(1.5, 0.08, 2.4), black, x, 1.04, z);
  for (const [sx, sz] of [[-0.65, -1.0], [0.65, -1.0], [0, 1.05]]) add(w, new THREE.CylinderGeometry(0.07, 0.05, 0.75, 10), black, x + sx, 0.37, z + sz);
  add(w, new THREE.BoxGeometry(1.4, 0.05, 0.06), gold(), x, 1.12, z - 1.18, { cast: false });
  // keys on the -Z side? (the player-facing side is +x): lay the keyboard on the east face
  const kx = x + 0.82;
  add(w, new THREE.BoxGeometry(0.34, 0.07, 1.3), plainMaterial(0xf4f0e6, { roughness: 0.3 }), kx, 0.98, z - 0.3);
  for (let i = 0; i < 9; i++) add(w, new THREE.BoxGeometry(0.2, 0.06, 0.07), black, kx - 0.05, 1.04, z - 0.3 - 0.52 + i * 0.13, { cast: false });
  w.plat({ x: x + 1.7, y: 0.5, z: z - 0.3, w: 0.55, d: 1.1, h: 0.12, tex: 'leather', color: 0x2a1a14, radius: 0.05 });              // bench
  for (const sz of [-0.45, 0.45]) add(w, new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), gold(), x + 1.7, 0.21, z - 0.3 + sz);
  let n = 0; const notes = [0, 4, 7, 12, 9, 5, 2, 11, 14, 7];
  w.interactable({
    x: kx, y: 1.0, z: z - 0.3, w: 0.8, h: 0.6, d: 1.5, label: 'Play the piano',
    onUse: (g) => {
      g.audio.piano(notes[n % notes.length]); n++;
      if (n === 6) g.say('hotel.piano1', { priority: 1 });
      if (n === 14) g.say('hotel.piano2', { priority: 1 });
    },
  });
  return body;
}

// ---- reception ---------------------------------------------------------------------------------------
export function reception(w, game) {
  const x = -17.2, z0 = -8, z1 = 4;                  // desk runs along the west wall, facing east
  const len = z1 - z0, zc = (z0 + z1) / 2;
  w.plat({ x, y: 1.1, z: zc, w: 1.1, d: len, h: 1.1, tex: 'wood', color: 0xffffff, roughness: 0.3, radius: 0.06 });
  w.plat({ x: x + 0.1, y: 1.17, z: zc, w: 1.5, d: len + 0.3, h: 0.1, tex: 'marble', color: 0xffffff, roughness: 0.08, radius: 0.04 });
  for (let i = 0; i < 6; i++) { // gold panel inlays on the front
    const pz = z0 + 1 + i * (len - 2) / 5;
    add(w, new THREE.BoxGeometry(0.06, 0.7, 1.4), gold(0.35), x + 0.58, 0.6, pz, { cast: false });
  }
  // return desk
  w.plat({ x: x + 1.6, y: 1.1, z: z1 + 0.3, w: 2.4, d: 1.0, h: 1.1, tex: 'wood', color: 0xffffff, roughness: 0.3, radius: 0.06 });
  w.plat({ x: x + 1.65, y: 1.17, z: z1 + 0.3, w: 2.7, d: 1.3, h: 0.1, tex: 'marble', color: 0xffffff, roughness: 0.08, radius: 0.04 });
  // key wall (pigeonholes): two boards on the wall pillars between the windows
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#2a1810'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 8; j++) {
    const cx = 14 + i * 80.5, cy = 14 + j * 61;
    g.fillStyle = '#0d0806'; g.fillRect(cx, cy, 70, 52);
    g.fillStyle = 'rgba(255,200,120,0.07)'; g.fillRect(cx, cy, 70, 6);
    if (Math.random() < 0.82) { g.fillStyle = '#d8a94a'; g.beginPath(); g.arc(cx + 35, cy + 24, 8, 0, 7); g.fill(); g.fillRect(cx + 33, cy + 28, 4, 16); g.fillStyle = '#7a1030'; g.fillRect(cx + 22, cy + 36, 26, 10); }
  }
  g.strokeStyle = '#d8a94a'; g.lineWidth = 6; g.strokeRect(3, 3, 506, 506);
  const kt = new THREE.CanvasTexture(c); kt.colorSpace = THREE.SRGBColorSpace; kt.anisotropy = 8;
  for (const kz of [-5, 3]) {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.4), new THREE.MeshStandardMaterial({ map: kt, roughness: 0.6 }));
    board.rotation.y = Math.PI / 2; board.position.set(L.x0 + 0.62, 4.6, kz); board.matrixAutoUpdate = false; board.updateMatrix(); w.add(board);
  }
  // a brass plaque hanging over the desk on chains
  w.box({ x: -15.6, y: 8.2, z: zc - 2, w: 0.2, h: 1.3, d: 5.6, color: 0x14100c, rough: 0.4 });
  w.box({ x: -15.6, y: 8.88, z: zc - 2, w: 0.26, h: 0.08, d: 5.7, color: GOLD, metal: 1, rough: 0.28, shadow: false });
  w.box({ x: -15.6, y: 7.52, z: zc - 2, w: 0.26, h: 0.08, d: 5.7, color: GOLD, metal: 1, rough: 0.28, shadow: false });
  for (const dz of [-2.5, 2.5]) w.box({ x: -15.6, y: 11.0, z: zc - 2 + dz, w: 0.06, h: 4.3, d: 0.06, color: GOLD, metal: 1, rough: 0.28, shadow: false });
  w.sign({ text: 'RECEPTION', x: -15.47, y: 8.2, z: zc - 2, w: 5.2, h: 1.0, rotY: Math.PI / 2, color: '#ffe3a0', glow: 1.3, glowColor: '#d8a94a', tw: 1024 });
  w.sign({ text: 'Check-in 24h · Check-out: see management', x: -15.47, y: 7.62, z: zc - 2, w: 5.2, h: 0.3, rotY: Math.PI / 2, color: '#d8c090', glow: 1.0, tw: 1024, size: 30 });
  // desk bell
  const bx = x + 0.3, bz = zc + 2.2;
  add(w, new THREE.CylinderGeometry(0.17, 0.2, 0.05, 16), gold(0.2), bx, 1.25, bz);
  add(w, new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold(0.15), bx, 1.27, bz);
  add(w, new THREE.SphereGeometry(0.03, 8, 8), gold(0.15), bx, 1.43, bz);
  let rings = 0;
  w.interactable({
    x: bx, y: 1.35, z: bz, w: 0.7, h: 0.5, d: 0.7, label: 'Ring the bell',
    onUse: (gm) => { gm.audio.bell(); rings++; gm.say(rings % 5 === 0 ? 'hotel.bell.many' : 'hotel.bell', { priority: 1 }); },
  });
  // guest book on a lectern near the entrance
  const lx = 6.5, lz = 12;
  w.plat({ x: lx, y: 1.15, z: lz, w: 0.9, d: 0.7, h: 1.15, tex: 'wood', color: 0xffffff, roughness: 0.3, radius: 0.05 });
  add(w, new THREE.BoxGeometry(0.7, 0.06, 0.5), plainMaterial(0xf4f0e6, { roughness: 0.6 }), lx, 1.2, lz);
  w.interactable({ x: lx, y: 1.3, z: lz, w: 1.0, h: 0.6, d: 0.9, label: 'Sign the guest book', onUse: (gm) => { gm.audio.chime(); gm.say('hotel.guestbook', { priority: 1 }); } });
}

// ---- luggage ---------------------------------------------------------------------------------------
export function luggageCart(w, x, z, quarter = 0) {
  const along = quarter % 2 === 0;
  const dw = along ? 1.2 : 2.0, dd = along ? 2.0 : 1.2;
  const base = w.plat({ x, y: 0.5, z, w: dw, d: dd, h: 0.1, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.04 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(w, new THREE.CylinderGeometry(0.07, 0.07, 0.1, 10), plainMaterial(0x111111, { roughness: 0.6 }), x + sx * (dw / 2 - 0.1), 0.06, z + sz * (dd / 2 - 0.1), { rz: Math.PI / 2 * (along ? 0 : 1) });
  const rail = (px, pz, rw, rd) => w.plat({ x: px, y: 2.0, z: pz, w: rw, d: rd, h: 1.5, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.02, collide: false });
  if (along) { rail(x - dw / 2, z, 0.06, dd); rail(x + dw / 2, z, 0.06, dd); } else { rail(x, z - dd / 2, dw, 0.06); rail(x, z + dd / 2, dw, 0.06); }
  const cols = [0x6a3a22, 0x1a2a4a, 0x4a1a22];
  const cases = [];
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 0.62;
    cases.push(w.plat({ x: along ? x : x + off, y: 1.1 + (i === 1 ? 0.35 : 0), z: along ? z + off : z, w: along ? 0.8 : 0.55, d: along ? 0.55 : 0.8, h: 0.5 + (i === 1 ? 0.35 : 0), tex: 'leather', color: cols[i], roughness: 0.5, radius: 0.08 }));
  }
  return { base, cases };
}

// ---- elevator bank (north wall) -------------------------------------------------------------------
/**
 * Builds the north wall, the five elevator door frames and (optionally) the cars behind them.
 * Returns one record per elevator: { x, leafL, leafR, lamp } so the hub can animate doors.
 */
export function elevatorBank(w, tiers, { cars = true } = {}) {
  const Z = L.z0 - 0.5, H = L.H;
  const plate = (x0, x1, y0, y1, tex = 'damask') => { if (x1 - x0 > 0.01) w.plat({ x: (x0 + x1) / 2, y: y1, z: Z, w: x1 - x0, d: 1, h: y1 - y0, tex, color: 0xffffff, roughness: 0.65 }); };
  let x = -23;
  for (const ex of ELEV_X) { plate(x, ex - 1.6, 0, H); plate(ex - 1.6, ex + 1.6, 3.9, H); x = ex + 1.6; }
  plate(x, 23, 0, H);
  const out = [];
  ELEV_X.forEach((ex, i) => {
    const t = tiers[i];
    // frame
    for (const sx of [-1, 1]) w.box({ x: ex + sx * 1.7, y: 2.0, z: L.z0 + 0.12, w: 0.24, h: 4.0, d: 0.3, color: GOLD, metal: 1, rough: 0.3, shadow: false });
    w.box({ x: ex, y: 4.0, z: L.z0 + 0.12, w: 3.6, h: 0.24, d: 0.3, color: GOLD, metal: 1, rough: 0.3, shadow: false });
    // door leaves
    const leaf = (sx) => w.plat({ x: ex + sx * 0.8, y: 3.85, z: L.z0 - 0.05, w: 1.6, d: 0.28, h: 3.85, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.85, radius: 0.03, moving: true });
    const leafL = leaf(-1), leafR = leaf(1);
    // indicator plate above the doors
    w.sign({ text: `${t.floor}`, x: ex, y: 5.3, z: L.z0 + 0.18, w: 1.2, h: 0.9, bg: '#0c0c10', color: '#ffe3a0', border: '#d8a94a', size: 70, tw: 256 });
    w.sign({ text: t.short, x: ex, y: 6.15, z: L.z0 + 0.18, w: 3.0, h: 0.55, bg: '#0c0c10', color: '#' + t.color.toString(16).padStart(6, '0'), border: '#d8a94a', size: 40, tw: 512 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), glowMaterial(0xff4040, 2.6)); lamp.position.set(ex + 2.3, 1.4, L.z0 + 0.42); w.add(lamp);
    // arch of little lights
    for (let k = 0; k < 7; k++) {
      const a = Math.PI * (0.15 + k / 6 * 0.7);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), glowMaterial(0xffd890, 2.2)); b.position.set(ex + Math.cos(a) * 1.5, 4.3 + Math.sin(a) * 0.7, L.z0 + 0.2); w.add(b);
    }
    // call panel
    w.box({ x: ex + 2.3, y: 1.5, z: L.z0 + 0.32, w: 0.34, h: 0.7, d: 0.1, color: GOLD, metal: 1, rough: 0.3, shadow: false });
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 14), glowMaterial(0xffd890, 2.4)); btn.rotation.x = Math.PI / 2; btn.position.set(ex + 2.3, 1.62, L.z0 + 0.4); w.add(btn);
    out.push({ x: ex, leafL, leafR, lamp, lampMat: lamp.material, tier: t, car: null });
  });
  // without cars, a dark slab behind the doors stands in for the shaft (with cars it would hide their insides)
  if (!cars) {
    const cz0 = L.z0 - 1, cz1 = L.z0 - 5.2;
    w.plat({ x: 0, y: 5, z: (cz0 + cz1) / 2 - 0.4, w: 46, d: 5.2, h: 6, tex: 'panel', color: 0x444444, roughness: 0.8, collide: false });
  }
  if (cars) out.forEach((e) => { e.car = buildCar(w, e.x, tiers[out.indexOf(e)]); });
  return out;
}

function buildCar(w, ex, t) {
  const zf = L.z0 - 1.0, zb = L.z0 - 5.0, zc = (zf + zb) / 2, wid = 3.2, hgt = 3.9;
  // the car floor runs all the way out to the lobby floor (z0), so the doorway has no gap to drop into
  const zFloorF = L.z0, zFloorB = zb - 0.2;
  w.plat({ x: ex, y: 0, z: (zFloorF + zFloorB) / 2, w: wid + 0.6, d: zFloorF - zFloorB, h: 2, tex: 'marble', color: 0xffffff, roughness: 0.12 });
  w.box({ x: ex, y: 0.012, z: L.z0 - 0.5, w: wid, h: 0.024, d: 0.16, color: GOLD, metal: 1, rough: 0.3, shadow: false });
  for (const sx of [-1, 1]) w.plat({ x: ex + sx * (wid / 2 + 0.15), y: hgt + 0.4, z: zc, w: 0.3, d: zf - zb + 0.4, h: hgt + 0.4, tex: 'wood', color: 0xffffff, roughness: 0.35 });
  w.plat({ x: ex, y: hgt + 0.4, z: zb - 0.15, w: wid + 0.6, d: 0.3, h: hgt + 0.4, tex: 'wood', color: 0xffffff, roughness: 0.35 });
  w.plat({ x: ex, y: hgt + 0.5, z: zc, w: wid + 0.6, d: zf - zb + 0.4, h: 0.5, tex: 'wood', color: 0xffffff, roughness: 0.35 });
  // brass trim, ceiling light, mirror-ish back panel
  w.box({ x: ex, y: hgt - 0.05, z: zc, w: wid, h: 0.08, d: zf - zb, glow: 0xffe2b0, glowIntensity: 1.25, shadow: false });
  w.box({ x: ex, y: 1.0, z: zb + 0.05, w: wid - 0.2, h: 0.1, d: 0.06, color: GOLD, metal: 1, rough: 0.3, shadow: false });
  w.light(0xffe0b0, 6, 8, ex, hgt - 0.6, zc);
  return { x: ex, zFront: zf, zBack: zb, zc, hgt };
}
