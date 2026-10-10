import * as THREE from 'three';
import { glowMaterial, plainMaterial, softTexture } from '../../engine/materials.js';
import { COL, deck, sign } from './kit.js';

// Session 10 (The Vows) helpers: a bot planner that can press consoles, a laser row the partner can switch off, the ring carry,
// the counsellor's sweep (a telegraphed, time-driven figure), a decoy platform and the wedding furniture (pews, arch, flowers).

/**
 * Bot planner (tools/coop-bot.mjs). Like kit.botSteps plus: { press: it-position {x,z,stand?}, until } to use a console,
 * { choose: () => [steps] } (splice steps in when reached), { id, retry:{when,to} }, { wait: fn, at? }.
 * Step fields: x, z (numbers or fns), r (arrival radius), until, jump (true|radius), stop, use (press E on arrival), follow.
 */
export function vbots(w, byRole) {
  const g = w.game, steps = (byRole[w.coop.me] || []).slice();
  let i = 0;
  const val = (v, d) => (typeof v === 'function' ? v() : v ?? d);
  w.botPlan = () => {
    const p = g.player;
    for (let guard = 0; guard < 40 && i < steps.length; guard++) {
      const s = steps[i];
      if (s.choose) { steps.splice(i, 1, ...s.choose()); continue; }
      if (s.retry && s.retry.when()) { const j = steps.findIndex((q) => q.id === s.retry.to); if (j >= 0 && j < i) { i = j; continue; } }
      if (s.follow) { if (s.until && s.until()) { i++; continue; } return null; }
      if (s.wait) {
        if (s.wait()) { i++; continue; }
        if (s.at && Math.hypot(s.at.x - p.x, s.at.z - p.z) > 0.6) return { x: s.at.x, z: s.at.z };
        return { x: p.x, z: p.z, wait: true };
      }
      const tx = val(s.x, p.x), tz = val(s.z, p.z);
      const arrived = Math.hypot(tx - p.x, tz - p.z) < (s.r ?? 1.0);
      if (s.press) {                                       // press a console until the condition holds
        if (s.until()) { i++; s.then?.(); continue; }
        if (!arrived) return { x: tx, z: tz };
        g.useFocus();
        return { x: s.face?.x ?? tx, z: s.face?.z ?? tz - 1, wait: true };
      }
      const done = s.until ? s.until() : arrived;
      if (done) { i++; s.then?.(); continue; }
      const stand = s.until && (arrived || s.x === undefined);
      if (s.use && arrived) g.useFocus();
      return { x: tx, z: tz, wait: !!stand, jump: s.jump || false, stop: s.stop };
    }
    return null;
  };
  w.botIndex = () => i;
  w.botSetIndex = (n) => { i = n; };
}

/** A platform drawn only for `who` and NOT solid (a pretty lie for the one who can't see the real path). */
export function decoy(w, who, o) {
  const p = w.plat({ ...o, collide: false, path: false });
  p.group.visible = who === 'all' || who === w.coop.me;
  return p;
}

/** Floor lane marking (decoration): a flat glowing strip. */
export function strip(w, { x, y, z, width, depth, color = 0x7a1f2b, opacity = 0.55 }) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.03, z); w.add(m);
  return m;
}

/** A pew (set dressing, non-solid) row. */
export function pews(w, { x, y, z, count = 4, gap = 2, side = 1, len = 5 }) {
  for (let i = 0; i < count; i++) {
    w.box({ x: x, y: y + 0.45, z: z - i * gap, w: len, h: 0.9, d: 0.8, color: 0x7a5232, tex: 'wood', shadow: false });
    w.box({ x: x + side * len / 2 * 0.0, y: y + 1.15, z: z - i * gap - 0.3, w: len, h: 0.7, d: 0.15, color: 0x6b4426, shadow: false });
  }
}

/** A wedding arch of two posts and a ring of flowers (decoration). */
export function arch(w, x, y, z, { color = 0xfff0d6, wide = 6, tall = 5 } = {}) {
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, tall, 10), plainMaterial(0xe8dcc2, { roughness: 0.6 }));
    post.position.set(x + s * wide / 2, y + tall / 2, z); post.castShadow = true; w.add(post);
  }
  const top = new THREE.Mesh(new THREE.TorusGeometry(wide / 2, 0.14, 8, 40, Math.PI), glowMaterial(color, 1.2));
  top.position.set(x, y + tall, z); w.add(top);
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), glowMaterial(i % 2 ? 0xff9fb8 : 0xffffff, 0.9));
    b.position.set(x + Math.cos(a) * wide / 2, y + tall + Math.sin(a) * wide / 2, z); w.add(b);
  }
}

/** A glowing stained-glass window (decoration). */
export function window3(w, x, y, z, rotY = 0, h = 5) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; w.add(g);
  const cols = [0xff6b8a, 0x6bb8ff, 0xffd86b, 0x8aff9f];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, h * 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(cols[i]).multiplyScalar(0.8), transparent: true, opacity: 0.8, toneMapped: false, side: THREE.DoubleSide }));
    m.position.set((i - 1.5) * 1.1, h / 2, 0); g.add(m);
  }
}

/**
 * A row of lasers across a lane the partner can switch off. `off()` returns true while a partner plate is held.
 * Cycle: `warn` s of an amber floor strip -> `on` s of live beam. predict(t) lets bots read it (ignoring `off`).
 */
export function laserRow(w, { x, y, z, width, period = 4, on = 1.0, warn = 1.0, offset = 0, off = () => false }) {
  const hz = w.hazard({ x, y: y + 0.5, z, w: width, h: 0.4, d: 0.5, color: 0xff2d4d });
  const u = (t) => (((t + offset) % period) + period) % period;
  hz.predict = (t) => !off() && u(t) < on;
  const strip1 = strip(w, { x, y, z, width, depth: 1.2, color: 0xffb02e, opacity: 0 });
  const posts = [-1, 1].map((s) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.2, 10), plainMaterial(0x2a2b36, { metalness: 0.6, roughness: 0.3 }));
    m.position.set(x + s * (width / 2 + 0.25), y + 0.6, z); w.add(m);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), glowMaterial(0xff2d4d, 2.2)); l.position.set(m.position.x, y + 1.3, z); w.add(l); return l;
  });
  w.updaters.push(() => {
    const dis = off();
    const ph = u(w.t), live = ph < on && !dis, warning = !dis && ph >= period - warn;
    hz.enabled = live;
    hz.group.visible = live || (warning && Math.floor(w.t * 14) % 2 === 0);
    hz.core.material.opacity = live ? 0.9 : 0.3;
    strip1.material.opacity = dis ? 0 : warning ? 0.35 + 0.2 * Math.sin(w.t * 12) : 0.07;
    strip1.material.color.setHex(dis ? 0x3ddc97 : 0xffb02e);
    for (const l of posts) { l.scale.setScalar(dis ? 0.4 : live ? 1.5 : warning ? 1.1 : 0.7); l.material.color.setHex(dis ? 0x3ddc97 : 0xff2d4d); }
  });
  return hz;
}

/**
 * The ring. One pedestal; whoever uses it becomes the bearer (shared key `key` = 'start' | 'p1' | 'p2' | 'placed').
 * A hit (any local death) sends it back to the pedestal. The ring floats over the bearer's head (also on the partner's screen).
 * `altar(x,y,z)` returns a pedestal where the bearer places it (sets 'placed').
 */
export function ringKit(w, { key = 'ring', x, y, z }) {
  const c = w.coop, g = w.game;
  const mat = glowMaterial(0xffe27a, 2.2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 10, 28), mat);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), glowMaterial(0xbfefff, 2.4)); gem.position.y = 0.34; ring.add(gem);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xffe27a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(1.6, 1.6, 1); ring.add(halo);
  w.add(ring);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.9, 16), plainMaterial(0x2b2f3a, { metalness: 0.5, roughness: 0.4 }));
  ped.position.set(x, y + 0.45, z); w.add(ped);
  const st = { get holder() { return c.get(key, 'start'); }, get mine() { return c.get(key, 'start') === c.me; }, get placed() { return c.get(key, 'start') === 'placed'; } };
  w.interactable({ x, y: y + 1.2, z, w: 1.4, h: 2, d: 1.4, label: 'Take the ring', range: 3.6, enabled: () => st.holder === 'start', onUse: () => { c.set(key, c.me); g.audio.confirm?.(); } });
  w.updaters.push((dt) => {
    if (g.state === 'dead' && c.get(key, 'start') === c.me) c.set(key, 'start');                   // a hit returns the ring to the pedestal
    const h = st.holder;
    let px = x, py = y + 1.35, pz = z;
    if (h === 'placed') { ring.visible = false; return; }
    ring.visible = true;
    if (h === c.me) { px = g.player.x; py = g.player.y + 2.5; pz = g.player.z; }
    else if (h === c.other && c.partner.has) { px = c.partner.sx; py = c.partner.sy + 2.5; pz = c.partner.sz; }
    ring.position.set(px, py + Math.sin(w.t * 2.4) * 0.06, pz);
    ring.rotation.y += dt * 1.6;
  });
  st.altar = (ax, ay, az, onPlace) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.1, 16), plainMaterial(0xe8dcc2, { roughness: 0.5 }));
    p.position.set(ax, ay + 0.55, az); w.add(p);
    w.interactable({ x: ax, y: ay + 1.3, z: az, w: 1.5, h: 2, d: 1.5, label: 'Place the ring', range: 3.6, enabled: () => st.holder === c.me, onUse: () => { c.set(key, 'placed'); g.audio.confirm?.(); } });
    c.on(key, (v) => { if (v === 'placed') onPlace?.(); });
  };
  return st;
}

/** A tall suited figure (the counsellor): body, head, a clipboard. Returns the group. */
export function counsellorFigure(w, color = 0x3a3350) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 2.2, 14), plainMaterial(color, { roughness: 0.6 })); body.position.y = 1.1; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 14), plainMaterial(0xf0d7c0, { roughness: 0.7 })); head.position.y = 2.6; g.add(head);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.08), glowMaterial(0xfff3d0, 0.9)); board.position.set(0.8, 1.7, 0.5); board.rotation.z = -0.2; g.add(board);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xff7a5e, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(4.5, 4.5, 1); halo.position.y = 1.6; g.add(halo);
  return g;
}

/**
 * The counsellor's sweep along a lane of a hall. dir = -1: walks from `zNear` toward `zFar` (away from where you came in, so he
 * chases you); dir = +1: he starts at `zFar` and walks at you. Cycle `period` s: he walks the lane in `len/speed` s, then is gone.
 * The last `warn` s before he appears the lane glows amber and a shadow shows where he will start. The kill volume is lane-wide and
 * 2.4 m deep. `lane` half-width = `half` (alcoves outside it are safe). time-driven only (functions of w.t), so both machines agree.
 */
export function sweeper(w, { y, zNear, zFar, half = 6.5, speed = 5, period = 10, phase = 0, toward = false, warn = 2.2 }) {
  const len = zNear - zFar, dur = len / speed;
  const u = (t) => (((t + phase) % period) + period) % period;
  const zAt = (t) => { const f = Math.min(1, u(t) / dur); return toward ? zFar + f * len : zNear - f * len; };
  const here = (t) => u(t) < dur;
  const fig = counsellorFigure(w); w.add(fig);
  const hz = w.hazard({ x: 0, y: y + 1.5, z: zNear, w: half * 2, h: 3, d: 2.4, color: 0xaa2235 });
  hz.core.visible = false; hz.shell.material.opacity = 0.12;
  const lane = strip(w, { x: 0, y, z: (zNear + zFar) / 2, width: half * 2, depth: len, color: 0x8a1f2e, opacity: 0.12 });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 2.4), new THREE.MeshBasicMaterial({ color: 0xff4d5e, transparent: true, opacity: 0.0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  shadow.rotation.x = -Math.PI / 2; w.add(shadow);
  const st = { zAt, here, u, dur, period, len, hz };
  hz.predict = (t) => here(t);
  w.updaters.push(() => {
    const t = w.t, uu = u(t), on = uu < dur, warning = !on && uu >= period - warn;
    const z = zAt(t);
    hz.enabled = on;
    hz.body.setCenter(0, y + 1.5, z); hz.group.position.set(0, y + 1.5, z);
    fig.visible = on || warning;
    const zf = on ? z : toward ? zFar : zNear;
    fig.position.set(0, y, zf);
    fig.rotation.y = toward ? 0 : Math.PI;
    fig.scale.setScalar(on ? 1 : 0.9 + 0.1 * Math.sin(w.t * 10));
    shadow.position.set(0, y + 0.04, toward ? zFar : zNear);
    shadow.material.opacity = on ? 0 : warning ? 0.35 + 0.2 * Math.sin(w.t * 10) : 0;
    lane.material.opacity = on ? 0.4 : warning ? 0.28 + 0.12 * Math.sin(w.t * 9) : 0.1;
    lane.material.color.setHex(on ? 0xff2d4d : warning ? 0xffb02e : 0x8a1f2e);
  });
  // bots: a time window in which crossing the whole lane is safe (he is well ahead of me, or has gone, and I am across before he returns)
  st.safeToCross = () => {
    const uu = u(w.t), cross = len / 6.0 + 0.5;
    return toward ? uu > dur + 0.3 && uu < period - cross - 0.5 : uu > 2.2 && uu < period - cross - 0.3;
  };
  return st;
}

export { COL, deck, sign };
