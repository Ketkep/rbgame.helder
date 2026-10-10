import * as THREE from 'three';
import { glowMaterial, plainMaterial } from '../../engine/materials.js';
import { COL } from './kit.js';

// Session 4 helpers: the belay (rope lift), telegraphed rock drops, a gust lamp, the per-stage rope table and the far mountains.

/** Distant snowy peaks for scale. Purely decorative. */
export function peaks(w, { count = 26, seed = 4 } = {}) {
  let s = seed * 7919 + 13;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const rock = plainMaterial(0x6d7790, { roughness: 0.95 }), snow = plainMaterial(0xf2f6ff, { roughness: 0.8 });
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1, x = side * (70 + rnd() * 160), z = 40 - rnd() * 700, hgt = 70 + rnd() * 120, r = 30 + rnd() * 40, y0 = -60;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(r, hgt, 6), rock); body.position.y = hgt / 2; g.add(body);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.36, hgt * 0.3, 6), snow); cap.position.y = hgt * 0.85; g.add(cap);
    g.position.set(x, y0, z); g.rotation.y = rnd() * 3; g.matrixAutoUpdate = false; g.updateMatrix(); w.add(g);
  }
}

/**
 * The belay: a rope lift up a cliff. While your PARTNER stands on a belay plate (`base` or `top` zone) and you are in the haul
 * volume in front of the wall, holding Space winds you up the rope at 5 m/s; letting go makes you hang in place. It is only a
 * local effect on your own body driven by shared zones, so both machines agree. Returns { active } (is the rope holding me).
 */
export function haulWall(w, { x = 0, face, y0, h, wide = 10, depth = 2.6, base, top }) {
  const g = w.game, st = { active: false, hauled: false };
  const yMax = y0 + h + 1.1, UP = 5.0;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(wide, h + 1.1), new THREE.MeshBasicMaterial({ color: 0x9fd6ff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  sheet.position.set(x, y0 + (h + 1.1) / 2, face + 0.08); w.add(sheet);
  const cords = [];                                            // a few hanging ropes down the face
  for (let i = 0; i < 4; i++) {
    const cx = x - wide / 2 + (i + 0.5) * wide / 4;
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h + 0.6, 6), plainMaterial(0xffe9a8, { roughness: 0.9 }));
    rope.position.set(cx, y0 + (h + 0.6) / 2 + 0.2, face + 0.12); w.add(rope); cords.push(rope);
  }
  w.updaters.push((dt) => {
    const p = g.player;
    const inV = g.state === 'playing' && Math.abs(p.x - x) < wide / 2 && p.z > face - 0.2 && p.z < face + depth && p.y > y0 - 0.3 && p.y < yMax;
    st.active = (base.theirs || top.theirs) ? true : false;
    st.hauled = inV && st.active;
    if (st.hauled) {
      const up = g.keys.has('Space');
      const grav = 26 * (up ? 1 : 1);
      const target = up ? UP : 0;
      p.vy += Math.max(-80 * dt, Math.min(80 * dt, (target + grav * dt) - p.vy));
    }
  });
  w.updaters.push((dt) => {                                    // the sheet and ropes glow while the rope is held for me
    const on = st.active, k = Math.min(1, dt * 6);
    sheet.material.opacity += ((on ? 0.2 : 0.05) - sheet.material.opacity) * k;
    for (const r of cords) r.material.color.setHex(on ? 0xfff6d8 : 0xb9a679);
  });
  return st;
}

/**
 * A telegraphed rock drop. Cycle `period`: (dark) -> `warn` s of an amber ring on the floor while the rock falls from the roof
 * -> `strike` s where the footprint kills -> dark again. predict(t) is true during the strike (bots read it).
 */
export function rockDrop(w, { x, y, z, size = 3.2, period = 5, ph = 0, warn = 1.2, strike = 0.5, height = 9 }) {
  const hz = w.hazard({ x, y: y + 1.5, z, w: size - 0.3, h: 3, d: size - 0.3 });
  hz.core.visible = false; hz.shell.visible = false;
  const u = (t) => (((t + ph) % period) + period) % period;
  hz.predict = (t) => u(t) < strike;
  const ring = new THREE.Mesh(new THREE.RingGeometry(size * 0.38, size * 0.52, 28), new THREE.MeshBasicMaterial({ color: 0x5a5f6e, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.03, z); w.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(size * 0.5, 28), new THREE.MeshBasicMaterial({ color: 0xff7a30, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.set(x, y + 0.025, z); w.add(disc);
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(size * 0.36, 0), plainMaterial(0x6a6d78, { roughness: 1, flatShading: true }));
  rock.castShadow = true; w.add(rock); rock.visible = false;
  w.updaters.push(() => {
    const t = u(w.t);
    const inWarn = t >= period - warn, inStrike = t < strike;
    hz.enabled = inStrike;
    const f = inWarn ? (t - (period - warn)) / warn : 0;
    ring.material.color.setHex(inStrike ? 0xff3a46 : inWarn ? 0xffb02e : 0x5a5f6e);
    ring.material.opacity = inStrike ? 1 : inWarn ? 0.7 + 0.3 * Math.sin(w.t * 18) : 0.5;
    disc.material.opacity = inStrike ? 0.7 : inWarn ? 0.12 + 0.35 * f : 0;
    rock.visible = inWarn || inStrike;
    rock.position.set(x, y + size * 0.3 + (inWarn ? (1 - f * f) * height : 0), z);
    rock.rotation.set(t * 3, t * 2, 0);
  });
  return hz;
}

/** A lamp on a pole that goes amber ~warn s before each gust and red during it. Same phase maths as w.wind. */
export function gustLamp(w, x, y, z, { period, on, phase = 0, warn = 1.5 }) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 8), plainMaterial(0x3a3f4c, { roughness: 0.7 })); pole.position.set(x, y + 1.3, z); pole.castShadow = true; w.add(pole);
  const mat = glowMaterial(0x3ddc97, 1.8);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), mat); bulb.position.set(x, y + 2.8, z); w.add(bulb);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false }));
  flag.position.set(x + 0.6, y + 2.3, z); w.add(flag);
  w.updaters.push(() => {
    const u = (w.t + phase) % period;
    const gust = u < on, warnNow = u >= period - warn;
    const c = gust ? COL.danger : warnNow ? 0xffb02e : COL.good;
    mat.color.setHex(c); flag.material.color.setHex(c);
    flag.rotation.y = gust ? Math.sin(w.t * 25) * 0.5 : warnNow ? Math.sin(w.t * 12) * 0.25 : 0;
  });
}

/**
 * Per-stage rope: `table` = [{ z, max, k, on }] ordered from the start (z decreasing). The stage is chosen by the REAR player
 * (largest z), so the rope only changes once both of you have crossed the line, and a respawn goes back to the old rope.
 */
export function ropeStages(w, table) {
  const c = w.coop, g = w.game;
  let cur = -1;
  const apply = (i) => {
    cur = i; const s = table[i];
    if (s.on === false) c.tether({ on: false });
    else c.tether({ max: s.max, k: s.k ?? 8, rope: true, on: true });
    s.onEnter?.(i);
  };
  apply(0);
  w.updaters.push(() => {
    const P = c.partner, p = g.player;
    const rear = P.has ? Math.max(p.z, P.sz) : p.z;
    let i = 0;
    for (let j = 0; j < table.length; j++) if (rear <= table[j].z) i = j;
    if (i !== cur) apply(i);
  });
  return { get index() { return cur; } };
}
