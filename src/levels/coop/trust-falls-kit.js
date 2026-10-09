import * as THREE from 'three';
import { glowMaterial, plainMaterial, softTexture } from '../../engine/materials.js';
import { COL, deck, stone, plate, sign, stage } from './kit.js';

// Session 2 helpers: invisible-to-one-player stepping stones guided from a lookout, drifting dust that says "this blindness is on purpose",
// and the "sacrifice pad" (a door that only opens for someone willing to be downed).

/** Dim drifting dust over a box, drawn only for `who` ('p1' | 'p2' | 'all'). It marks the stretch where you cannot see the footing. */
export function dust(w, { who, x0, x1, y0, y1, z0, z1, count = 420, color = 0xd5deef, size = 0.55, opacity = 0.32 }) {
  if (who !== 'all' && who !== w.coop.me) return null;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { pos[i * 3] = x0 + Math.random() * (x1 - x0); pos[i * 3 + 1] = y0 + Math.random() * (y1 - y0); pos[i * 3 + 2] = z0 + Math.random() * (z1 - z0); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color, size, map: softTexture('glow'), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; w.add(pts);
  w.updaters.push(() => { pts.position.y = Math.sin(w.t * 0.5) * 0.35; pts.position.x = Math.sin(w.t * 0.23) * 0.6; m.opacity = opacity * (0.85 + 0.15 * Math.sin(w.t * 1.3)); });
  return pts;
}

/** Positions of stones from a move list. Start stone at (x0,z0); moves like [['N',3],['E',2]] (N = -z). */
export function stonePath(x0, z0, moves, step = 4.4) {
  const out = [{ x: x0, z: z0 }];
  let x = x0, z = z0;
  for (const [d, n] of moves) for (let i = 0; i < n; i++) { if (d === 'N') z -= step; else if (d === 'E') x += step; else if (d === 'W') x -= step; out.push({ x, z }); }
  return out;
}

/**
 * A chasm crossed on invisible stones. One player (`blind`) cannot see them; the other (`sighted`) can, from a lookout (stairs + deck with a
 * SPOTTER plate). The stones are only solid while the spotter stands on the plate (or after the blind player has made it across).
 * Near hub spans z0 .. z0+14 (x -8..8); the far hub is returned (it is the next section's near hub).
 */
export function crossing(w, { key, z0, blind, moves, hubY = 0, hubStairs = true, ruleOn = null }) {
  const c = w.coop, N = c.names;
  const sighted = blind === 'p1' ? 'p2' : 'p1';
  const iSee = c.me === sighted;
  // lookout: four steps up the west side of the near hub, then the deck with the spotter plate
  const stepsTop = [];
  for (let k = 1; k <= 4; k++) { const y = hubY + 1.2 * k; deck(w, { x: -10, y, z: z0 + 11 - (k - 1) * 2.8, w: 4, d: 2.8, h: 1, color: 0xcdb48a }); stepsTop.push(y); }
  const lkY = hubY + 4.8;
  deck(w, { x: -10, y: lkY, z: z0 - 3.2, w: 8, d: 8, h: 1, color: 0xe3d3ac, trim: COL[sighted] });
  const spot = plate(w, { x: -10, y: lkY, z: z0 - 2.2, need: sighted, size: 2.4, label: `${N[sighted]}: SPOTTER` });
  // stones
  const pts = stonePath(0, z0 - 3.0, moves);
  const last = pts[pts.length - 1];
  const stones = pts.map((p) => {
    const s = stone(w, { x: p.x, y: hubY, z: p.z, w: 2.4, d: 2.4, h: 0.8, color: 0xb9c2d4, trim: 0xffffff });
    s.group.visible = iSee; s.body.enabled = false; return s;
  });
  // far hub (also the next near hub)
  const farZ0 = last.z - 3.0 - 14;
  const far = deck(w, { x: 0, y: hubY, z: farZ0 + 7, w: 16, d: 14, path: true });
  let done = false, grace = 0;
  const live = () => done || grace > 0;
  w.updaters.push((dt) => {
    grace = spot.pressed ? 1.2 : Math.max(0, grace - dt);
    const on = live();
    for (const s of stones) {
      s.body.enabled = on;
      s.group.visible = iSee && (on || Math.floor(w.t * 3) % 2 === 0);      // off = blinking ghosts for the one who can see them
    }
  });
  c.onEvent('tf:' + key + ':done', () => { done = true; });
  const z = c.zone({ x: 0, y: hubY + 1.5, z: farZ0 + 10, w: 14, h: 4, d: 6, need: blind, shrink: 0 });
  z.onChange((zn) => { if (zn.active && !done) c.emit('tf:' + key + ':done'); });
  return { key, z0, blind, sighted, spot, stones: pts, last, farZ0, far, lkY, live, get done() { return done; }, lookoutDeckZ: z0 - 3.2 };
}

/**
 * The sacrifice pad: stand on it for `charge` seconds and a (telegraphed) beam downs you; that opens `door` for good. Pull-up required.
 * `role` is the one who has to volunteer. `key` is the shared flag that latches the door.
 */
export function sacrificePad(w, { x, y = 0, z, role, key, size = 3, charge = 3.0, label }) {
  const c = w.coop, col = COL[role];
  const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.62, size * 0.68, 0.14, 28), plainMaterial(0x262b36, { metalness: 0.6, roughness: 0.4 })); base.position.y = 0.07; g.add(base);
  const padMat = glowMaterial(col, 0.9);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.5, size * 0.5, 0.12, 28), padMat); pad.position.y = 0.16; g.add(pad);
  const ringMat = new THREE.MeshBasicMaterial({ color: COL.danger, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(new THREE.RingGeometry(size * 0.55, size * 0.7, 40), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25; g.add(ring);
  const beamMat = new THREE.MeshBasicMaterial({ color: COL.danger, transparent: true, opacity: 0.0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.38, size * 0.38, 18, 20, 1, true), beamMat); beam.position.y = 9; g.add(beam);
  if (label) sign(w, label, x, y + 2.6, z, { w: 5.4, h: 0.9, size: 30, tw: 640, border: '#' + col.toString(16).padStart(6, '0') });
  const zn = c.zone({ x, y: y + 1, z, w: size - 0.4, h: 2, d: size - 0.4, need: role });
  const hz = w.hazard({ x, y: y + 1.0, z, w: size - 0.9, h: 2, d: size - 0.9, color: COL.danger });
  hz.enabled = false; hz.group.visible = false;
  let ch = 0, flash = 0, latched = false;
  c.on(key, (v) => { if (v) latched = true; });
  const st = { zone: zn, hz, get latched() { return latched; }, get charge() { return ch; }, get flashing() { return flash > 0; } };
  w.updaters.push((dt) => {
    if (flash > 0) {
      flash -= dt;
      hz.enabled = zn.mine && flash > 0; hz.group.visible = flash > 0;
      beamMat.opacity = Math.max(0, flash / 0.5) * 0.7; ringMat.opacity = 0.0;
      if (flash <= 0) { hz.enabled = false; hz.group.visible = false; beamMat.opacity = 0; }
      return;
    }
    if (latched) {
      ch = 0; ringMat.opacity = 0; beamMat.opacity = 0; hz.enabled = false;
      padMat.color.setHex(COL.good).multiplyScalar(0.7); return;
    }
    if (zn.active) {
      ch += dt;
      if (ch >= charge) { ch = 0; flash = 0.5; c.set(key, true); return; }
    } else ch = Math.max(0, ch - dt * 2);
    const f = ch / charge;
    ringMat.opacity = f > 0 ? 0.25 + 0.55 * f : 0.0;
    ring.scale.setScalar(1.35 - 0.35 * f + (f > 0.6 ? Math.sin(w.t * 22) * 0.05 : 0));
    beamMat.opacity = f * 0.25;
    padMat.color.setHex(col).multiplyScalar(0.9 + f * 2.2 + (zn.active ? 0.3 : 0));
  });
  return st;
}
