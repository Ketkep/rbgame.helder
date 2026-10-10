import * as THREE from 'three';
import { glowMaterial, plainMaterial, softTexture } from '../../engine/materials.js';

// Helpers for session 9 "Shared Baggage": route frames (a stage runs along +s, which is -Z or +Z depending on the stage),
// tower scenery (giant luggage, clouds), a stoppable conveyor, ropes that follow moving platforms, partner-position tests.

/**
 * A route frame. Local coordinates: x across, s along the route (s = 0 at the previous stage's far edge, increasing).
 * dz = +1: s runs toward -Z; dz = -1: s runs toward +Z (every stage turns back over the last one, so the climb stacks up).
 */
export function frame(cur) {
  const F = { ...cur };
  F.X = (x) => cur.x + x;
  F.Z = (s) => cur.z - cur.dz * s;
  F.S = (z) => (cur.z - z) / cur.dz;
  F.nextX = cur.x === 0 ? LANE : 0;
  /** Platform spanning s0..s1 (any order) with its top at y. o.x = local centre offset. */
  F.plat = (w, s0, s1, y, o = {}) => {
    const { x = 0, ...rest } = o;
    return w.plat({ tex: 'wood', x: cur.x + x, y, z: F.Z((s0 + s1) / 2), w: 16, h: 0.8, ...rest, d: Math.abs(s1 - s0) });
  };
  /** The wide deck at the end of a stage: it reaches across to the next stage's lane. Returns its length. */
  F.transfer = (w, s, y, len = 12) => {
    const dx = F.nextX - cur.x;
    F.plat(w, s, s + len, y, { x: dx / 2, w: 16 + Math.abs(dx), h: 0.8, path: true, color: 0xe9d9b0 });
    return len;
  };
  return F;
}
export const LANE = 26;

/** Next frame: starts where this stage's transfer deck ends and turns back over it, one lane across. */
export function nextFrame(F, s, y, lastLen) { return frame({ x: F.nextX, z: F.Z(s), y, dz: -F.dz, skip: lastLen }); }

/** Is the partner standing (grounded) near local (x, s) within r metres, at a height in [yLo, yHi]? */
export function partnerAt(P, F, x, s, yLo, yHi, r = 2.2) {
  return !!(P.has && !P.dead && P.sy >= yLo && P.sy <= yHi && Math.hypot(P.sx - F.X(x), P.sz - F.Z(s)) < r);
}

let _rng = 7;
const rnd = () => { _rng = (_rng * 16807) % 2147483647; return _rng / 2147483647; };

/** Giant stacked luggage (instanced, no collision) beside a span of the route. */
export function luggageStacks(w, F, { s0, s1, y0, y1, count = 22, inner = 17, outer = 32, below = 40 }) {
  const cols = [0x8c4a2f, 0x2e5d7a, 0xc2873c, 0x6b3f66, 0x3d7a5c, 0xb0413e, 0x44474f, 0xa07a4a, 0x2a3a5a];
  const boxes = [];
  for (let i = 0; i < count; i++) {
    const side = F.x === 0 ? -1 : 1;
    const x = F.x + side * (inner + rnd() * (outer - inner));
    const s = s0 + rnd() * (s1 - s0);
    const wd = 5 + rnd() * 9, dd = 4 + rnd() * 8;
    let y = y0 - below + rnd() * 6;
    const top = y1 + 6 + rnd() * 14;
    while (y < top) {
      const h = 2 + rnd() * 4;
      boxes.push({ x: x + (rnd() - 0.5) * 2, y: y + h / 2, z: F.Z(s) + (rnd() - 0.5) * 2, w: wd * (0.85 + rnd() * 0.3), h, d: dd * (0.85 + rnd() * 0.3), c: cols[Math.floor(rnd() * cols.length)], r: (rnd() - 0.5) * 0.35 });
      y += h;
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05 });
  const im = new THREE.InstancedMesh(geo, mat, boxes.length);
  const strapMat = new THREE.MeshStandardMaterial({ color: 0xd8c9a0, roughness: 0.6 });
  const sm = new THREE.InstancedMesh(geo, strapMat, boxes.length * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  boxes.forEach((b, i) => {
    q.setFromEuler(e.set(0, b.r, 0));
    im.setMatrixAt(i, m4.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.w, b.h, b.d)));
    im.setColorAt(i, col.setHex(b.c));
    for (let k = 0; k < 2; k++) {
      const off = (k ? 0.25 : -0.25) * b.w;
      const v = new THREE.Vector3(Math.cos(b.r) * off, 0, -Math.sin(b.r) * off);
      sm.setMatrixAt(i * 2 + k, m4.compose(new THREE.Vector3(b.x + v.x, b.y, b.z + v.z), q, new THREE.Vector3(0.35, b.h + 0.06, b.d + 0.06)));
    }
  });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; sm.instanceMatrix.needsUpdate = true;
  im.frustumCulled = false; sm.frustumCulled = false;
  w.add(im); w.add(sm);
  w.onDispose?.(() => { geo.dispose(); mat.dispose(); strapMat.dispose(); });
  return boxes;
}

/** A soft cloud bank around a height. */
export function cloudBank(w, y, { n = 10, spread = 110, cz = -40, opacity = 0.5 } = {}) {
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('puff'), color: 0xffe9d6, transparent: true, opacity, depthWrite: false, fog: false }));
    const a = rnd() * Math.PI * 2, r = 35 + rnd() * spread;
    sp.position.set(Math.cos(a) * r, y + (rnd() - 0.5) * 6, cz + Math.sin(a) * r);
    const k = 50 + rnd() * 70; sp.scale.set(k, k * 0.45, 1);
    w.add(sp);
  }
}

/** Big painted label on the side of a crate (decoration). */
export function crateTag(w, text, x, y, z, rotY = 0, wd = 9) {
  return w.sign({ text, x, y, z, w: wd, h: wd * 0.26, rotY, glow: false, color: '#f4e7c8', bg: 'rgba(60,30,20,0.78)', border: '#d8c9a0', tw: 640 });
}

/**
 * A conveyor whose speed can be scaled at runtime (0 = stopped). `v` is the nominal speed along Z (signed).
 * Returns { plat, rate } – set `rate` between 0 and 1.
 */
export function beltPlat(w, o, vz) {
  const plat = w.plat({ tex: 'metal', color: 0x3a3d4a, ...o });
  w.conveyor(plat, { vz });
  const tex = w.ownTextures[w.ownTextures.length - 1];
  w.updaters.pop();                                                           // replace the built-in scroller with one that can stop
  const sp = Math.abs(vz), along = plat.o.d, cycle = along / tex.repeat.y;
  const st = { plat, rate: 1, v: vz };
  w.updaters.push((dt) => {
    plat.body.conv = st.rate > 0.02 ? [0, vz * st.rate] : null;
    tex.offset.y -= (sp * st.rate * dt) / cycle;
  });
  return st;
}

/** A rope (line) from a fixed anchor to two points on a moving platform. Updates every frame. */
export function hangRope(w, plat, anchorY, spread = 1.2, color = 0xd8c9a0) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  const ln = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }));
  ln.frustumCulled = false; w.add(ln);
  const ax = plat.base.x, az = plat.base.z;
  w.updaters.push(() => {
    const b = plat.body, p = geo.attributes.position, ty = b.y + b.hy;
    p.setXYZ(0, ax, anchorY, az - spread); p.setXYZ(1, b.x, ty, b.z - spread);
    p.setXYZ(2, ax, anchorY, az + spread); p.setXYZ(3, b.x, ty, b.z + spread);
    p.needsUpdate = true;
  });
  return ln;
}

/** A pole with a pennant that shows the wind. `state()` returns { dir: -1|0|1 (blowing now), warn: bool, wdir: -1|1 (coming next) }. */
export function pennant(w, x, y, z, state) {
  const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.0, 8), plainMaterial(0xdddddd, { metalness: 0.6, roughness: 0.3 })); pole.position.y = 1.5; g.add(pole);
  const arm = new THREE.Group(); arm.position.y = 2.8; g.add(arm);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.04), glowMaterial(0xff7b3a, 1.1)); flag.position.x = 0.75; arm.add(flag);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), glowMaterial(0xffc83d, 0.3)); lamp.position.y = 3.2; g.add(lamp);
  let face = 1;
  w.updaters.push((dt) => {
    const st = state();
    if (st.dir !== 0) face = st.dir; else if (st.warn) face = st.wdir;
    const lift = st.dir !== 0 ? 0.05 + Math.sin(w.t * 22) * 0.06 : st.warn ? 0.55 + Math.sin(w.t * 14) * 0.12 : 1.35;      // radians below horizontal
    arm.scale.x = face;
    arm.rotation.z += (-lift * face - arm.rotation.z) * Math.min(1, dt * 8);
    lamp.material.color.setHex(0xffc83d).multiplyScalar(st.warn ? 0.8 + 1.8 * (Math.sin(w.t * 16) * 0.5 + 0.5) : st.dir !== 0 ? 2.2 : 0.3);
  });
  return g;
}
