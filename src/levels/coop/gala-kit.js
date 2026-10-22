import * as THREE from 'three';
import { glowMaterial, plainMaterial, softTexture } from '../../engine/materials.js';
import { COL, riser } from './kit.js';
import { ROLES } from '../../net/coop.js';

// Session 15 (Anniversary Gala) helpers: witnesses (silent applauding silhouettes), the mirror (a ghost of your partner reflected left-right
// and lanes whose tiles are linked), glass pillars, chandeliers, and the musical-chairs plates.

/** Silent silhouettes in evening dress along a gallery. Purely visual: they watch the route and applaud (bob, no sound). */
export function witnesses(w, { x, y = 0, z0, z1, n = 10, face = 0, seed = 1, tall = 1 }) {
  const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.34, 0.9, 4, 10), plainMaterial(0x16192b, { roughness: 0.8 }), n);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 12, 10), plainMaterial(0x1d2036, { roughness: 0.7 }), n);
  const glint = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffe9b8, toneMapped: false }), n);   // a champagne flute, held up
  let s = seed * 7919 + 13;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const it = [];
  for (let i = 0; i < n; i++) it.push({ px: x + (rnd() - 0.5) * 1.4, pz: z0 + (z1 - z0) * ((i + 0.5 + (rnd() - 0.5) * 0.6) / n), k: (0.9 + rnd() * 0.3) * tall, ph: rnd() * 6.28, sp: 2.4 + rnd() * 1.4 });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const place = () => {
    for (let i = 0; i < n; i++) {
      const a = it[i], clap = Math.max(0, Math.sin(w.t * a.sp + a.ph)), up = clap * 0.06;
      e.set(0, face, 0); q.setFromEuler(e);
      v.set(a.px, y + 0.85 * a.k + up, a.pz); sc.set(1, a.k, 1); m.compose(v, q, sc); body.setMatrixAt(i, m);
      v.set(a.px, y + 1.85 * a.k + up, a.pz); sc.set(1, 1, 1); m.compose(v, q, sc); head.setMatrixAt(i, m);
      v.set(a.px + Math.cos(face) * 0.35, y + (1.45 + clap * 0.55) * a.k, a.pz - Math.sin(face) * 0.35); m.compose(v, q, sc); glint.setMatrixAt(i, m);
    }
    body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = glint.instanceMatrix.needsUpdate = true;
  };
  place(); w.add(body); w.add(head); w.add(glint);
  let acc = 0;
  w.updaters.push((dt) => { acc += dt; if (acc > 0.05) { acc = 0; place(); } });
  return body;
}

/** A tall translucent glass pillar with a soft glow band. */
export function glassPillar(w, x, y, z, { h = 16, r = 0.55, color = 0xbfe6ff } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), new THREE.MeshStandardMaterial({ color, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, emissive: color, emissiveIntensity: 0.12, depthWrite: false }));
  m.position.set(x, y + h / 2, z); w.add(m);
  return m;
}

/** A chandelier: ring, hanging crystals and a glow. Visual only. */
export function chandelier(w, x, y, z, { r = 1.6, color = 0xffe3a8 } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 8, 36), glowMaterial(color, 1.6)); ring.rotation.x = Math.PI / 2; g.add(ring);
  const cm = new THREE.MeshStandardMaterial({ color: 0xe8f6ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.75, emissive: 0xbfe6ff, emissiveIntensity: 0.35 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), cm); c.scale.y = 1.8;
    c.position.set(Math.cos(a) * r, -0.35, Math.sin(a) * r); g.add(c);
  }
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6, 6), plainMaterial(0x8a7a50)); chain.position.y = 3; g.add(chain);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.scale.set(r * 4, r * 4, 1); g.add(sp);
  w.updaters.push(() => { g.rotation.y = w.t * 0.2; });
  return g;
}

/**
 * The reflection: while `active()` is true your partner is drawn mirrored left-right (about x = 0) as a glassy ghost instead of
 * their real avatar. Visual only: their solid body and every zone still use their real position.
 */
export function mirrorGhost(w, active) {
  const c = w.coop, P = c.partner, av = w.game.coop.avatar, col = ROLES[c.other].color;
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.62, emissive: col, emissiveIntensity: 0.5, depthWrite: false });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.8, 6, 14), mat); body.position.y = 0.85; g.add(body);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.17, 0.3), new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.8 })); visor.position.set(0, 1.28, -0.2); g.add(visor);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: col, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(2.6, 2.6, 1); halo.position.y = 1.0; g.add(halo);
  g.visible = false; w.add(g);
  // hide the real avatar while mirrored (coop.update sets .visible every frame, so intercept the property)
  let real = av.visible, on = false;
  Object.defineProperty(av, 'visible', { get: () => (on ? false : real), set: (v) => { real = v; }, configurable: true });
  let ry = 0;
  const shown = () => on;
  w.updaters.push((dt) => {
    on = !!P.has && !!active();
    g.visible = on;
    if (!on) return;
    g.position.set(-P.sx, P.sy, P.sz);
    const sp = Math.hypot(P.vx, P.vz);
    const ty = sp > 0.5 ? Math.atan2(P.vx, -P.vz) : -P.yaw;          // reflected heading
    let d = (ty - ry) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    ry += d * Math.min(1, dt * 10); g.rotation.y = ry;
    body.scale.y = P.dead ? 0.35 : 1;
  });
  return { shown, group: g };
}

const OTHER = { p1: 'p2', p2: 'p1' };
const colOther = { in: 'out', out: 'in' };

/**
 * Two lanes of linked tiles (p1's lane on the left, p2's on the right). Tile (lane, row, col) is solid while ANY of:
 *  - you are standing on it,
 *  - your partner is standing on the tile that raises it (row k-1, same column; on a `cross` row the other column),
 *  - your partner is standing on its mirror tile (same row, same column) – the way back when somebody got ahead,
 * and for `hold` seconds after the last of those. Row 0 is an ordinary deck (the entry pads are zones on it).
 * o: { y, z0 (centre z of row 1), pitch, rows, cross: [row numbers], xs: {out, in}, tw, td, hold }
 */
export function mirrorLanes(w, o) {
  const c = w.coop;
  const { y = 0, z0, pitch = 5.4, rows = 6, cross = [], xs = { out: 7.0, in: 3.6 }, tw = 3.0, td = 3.0, hold = 2.5, restAfter = 0, restLen = 8 } = o;
  const zNat = (k) => z0 - (k - 1) * pitch;
  const rest = restAfter ? { near: zNat(restAfter) - td / 2 - 2.4 } : null;
  if (rest) { rest.far = rest.near - restLen; rest.zc = (rest.near + rest.far) / 2; rest.pad = rest.far + 1.8; rest.d = restLen; }
  const zRow = (k) => (rest && k > restAfter ? rest.far - 2.4 - td / 2 - (k - restAfter - 1) * pitch : zNat(k));
  const T = {}, Z = {};
  const key = (r, k, col) => `${r}:${k}:${col}`;
  const X = (r, col) => (r === 'p1' ? -1 : 1) * xs[col];
  for (const r of ['p1', 'p2']) for (const col of ['out', 'in']) {
    Z[key(r, 0, col)] = c.zone({ x: X(r, col), y: y + 1, z: zNat(0), w: tw - 0.3, h: 2, d: td + 1.0, need: 'any' });
    if (rest) Z[key(r, 'R', col)] = c.zone({ x: X(r, col), y: y + 1, z: rest.pad, w: tw - 0.3, h: 2, d: 3.4, need: 'any' });
    for (let k = 1; k <= rows; k++) {
      const x = X(r, col), crossed = cross.includes(k);
      const tint = crossed ? 0xff9ad5 : 0xcfe6ff;
      const rs = riser(w, { x, y, z: zRow(k), w: tw, d: td, h: 0.6, drop: 6, speed: 7, color: tint, trim: crossed ? 0xff6ec7 : COL[r], tex: 'metal', path: false });
      T[key(r, k, col)] = { r, k, col, rs, t: 0, x, z: zRow(k), crossed };
      Z[key(r, k, col)] = c.zone({ x, y: y + 1, z: zRow(k), w: tw - 0.3, h: 2, d: td - 0.3, need: 'any' });
    }
  }
  const occ = (r, k, col) => !!Z[key(r, k, col)]?.[r];
  w.updaters.push((dt) => {
    for (const t of Object.values(T)) {
      const q = OTHER[t.r];
      const srcCol = t.crossed ? colOther[t.col] : t.col;
      const srcRow = rest && t.k === restAfter + 1 ? 'R' : t.k - 1;
      const on = occ(t.r, t.k, t.col) || occ(q, srcRow, srcCol) || occ(q, t.k, t.col);
      t.t = on ? hold : Math.max(0, t.t - dt);
      t.rs.set(t.t > 0);
    }
  });
  // bots: both stay on the outer column (stepping across on the pink rows), reset on the rest deck
  const colAt = (k) => { let col = 'out'; for (let j = 1; j <= k; j++) { if (rest && j === restAfter + 1) col = 'out'; if (cross.includes(j)) col = colOther[col]; } return col; };
  const up = (r, k, col) => T[key(r, k, col)].rs.k > 0.97;
  const botSteps = (me, near) => {
    const seq = [{ k: 0, z: zNat(0) }];
    for (let k = 1; k <= rows; k++) { seq.push({ k, z: zRow(k) }); if (rest && k === restAfter) seq.push({ k: 'R', z: rest.pad }); }
    const out = [];
    seq.forEach((e, i) => {
      const prevTile = e.k === 'R' ? restAfter : e.k;
      const col = e.k === 'R' || e.k === 0 ? 'out' : colAt(e.k), x = X(me, col), nx = seq[i + 1];
      const ready = !nx ? () => true : nx.k === 'R' ? () => true : () => up(me, nx.k, colAt(nx.k));
      void prevTile;
      out.push({ x, z: e.z, r: 0.7, until: () => near(x, e.z, 0.9) && ready() });
    });
    return out;
  };
  return { T, Z, zRow, X, colAt, up, key, rows, pitch, rest, botSteps };
}

/**
 * Musical chairs: two pads, each needs "its" role, but the colours swap every `beat` seconds (time-driven, so both machines agree).
 * A flicker warns for the last second. onChange(bothPressed) fires on flips. Returns { pressed, who(padIdx), warn }.
 */
export function chairPlates(w, { pads, y = 0, size = 3.0, beat = 8, hold = 0.6 }) {
  const c = w.coop;
  const roleAt = (i, t) => ((Math.floor(t / beat) + i) % 2 === 0 ? 'p1' : 'p2');
  const st = { pads: [], pressed: false, roleAt: (i, t = w.t) => roleAt(i, t), left: () => beat - (w.t % beat) };
  const mats = [];
  pads.forEach((p, i) => {
    const g = new THREE.Group(); g.position.set(p.x, y, p.z); w.add(g);
    const base = new THREE.Mesh(new THREE.BoxGeometry(size + 0.3, 0.1, size + 0.3), plainMaterial(0x262b36, { metalness: 0.6, roughness: 0.4 })); base.position.y = 0.05; g.add(base);
    const mat = glowMaterial(COL.p1, 0.9);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(size, 0.16, size), mat); pad.position.y = 0.1; g.add(pad);
    const zn = c.zone({ x: p.x, y: y + 1, z: p.z, w: size - 0.3, h: 2, d: size - 0.3, need: 'any' });
    st.pads.push({ zn, mat, pad, i });
  });
  let heldT = 0;
  w.updaters.push((dt) => {
    const t = w.t, warn = beat - (t % beat) < 1.0;
    let all = true;
    for (const p of st.pads) {
      const role = roleAt(p.i, t);
      const ok = !!p.zn[role];
      all = all && ok;
      p.mat.color.setHex(COL[role]).multiplyScalar(ok ? 2.2 : warn ? (Math.sin(t * 22) > 0 ? 1.6 : 0.4) : 0.9);
      p.pad.position.y += ((ok ? 0.03 : 0.1) - p.pad.position.y) * Math.min(1, dt * 12);
    }
    heldT = all ? hold : Math.max(0, heldT - dt);
    st.pressed = heldT > 0;
  });
  return st;
}

/**
 * Bot planner (tools/coop-bot.mjs). Steps as in kit.botSteps / dinnerBots: { x, z, r, until, use, face:[x,z], jump, stop, follow }.
 * Extra: after a death the plan rewinds to the earlier step whose target is nearest the respawn point, so a dumb bot redoes its section.
 */
export function galaBots(w, byRole) {
  const g = w.game, steps = (byRole[w.coop.me] || []).slice();
  let i = 0, deaths = g.deaths, rewind = false;
  const val = (v, d) => (typeof v === 'function' ? v() : v ?? d);
  w.botPlan = () => {
    const p = g.player;
    if (g.deaths !== deaths) { deaths = g.deaths; rewind = true; }
    if (rewind) {
      rewind = false;
      let best = -1, bd = 1e9;
      for (let j = 0; j < steps.length; j++) {
        const s = steps[j];
        if (s.x === undefined || s.follow) continue;
        const d = Math.hypot(val(s.x, p.x) - p.x, val(s.z, p.z) - p.z);
        if (d < bd - 0.5) { bd = d; best = j; }
      }
      if (best >= 0 && bd < 10) i = best;
    }
    for (let guard = 0; guard < 40 && i < steps.length; guard++) {
      const s = steps[i];
      if (s.follow) { if (s.until && s.until()) { i++; s.then?.(); continue; } return null; }
      const tx = val(s.x, p.x), tz = val(s.z, p.z);
      const arrived = Math.hypot(tx - p.x, tz - p.z) < (s.r ?? 1.0);
      const done = s.until ? s.until() : arrived;
      if (done) { i++; s.then?.(); continue; }
      if (arrived && s.use) g.useFocus();
      if (arrived && s.face) return { x: val(s.face[0], 0), z: val(s.face[1], 0), wait: true };
      const stand = s.until && (arrived || s.x === undefined);
      return { x: tx, z: tz, wait: !!stand, jump: s.jump || false, stop: s.stop };
    }
    return null;
  };
  w.botIndex = () => i;
  w.botSetIndex = (n) => { i = n; };
}
