import * as THREE from 'three';
import { glowMaterial, plainMaterial, softTexture } from '../../engine/materials.js';
import { ROLES } from '../../net/coop.js';

// Campaign 3 building kit: the lakeside "Serenity Falls" couples retreat and the pieces that make a level take two.
// Everything here is built on `w.coop` (src/net/coop.js). Axes: the first player faces -Z; yaw 0 looks down -Z.

export const COL = { p1: ROLES.p1.color, p2: ROLES.p2.color, any: 0xfff3d0, both: 0xffc83d, danger: 0xff4d5e, good: 0x3ddc97 };
const colorOf = (need) => COL[need] ?? COL.any;

/** Dusk over a lake: warm sky, soft fog, wood and stone. `mood`: dusk | night | dawn | storm */
export function retreatEnv(w, { mood = 'dusk' } = {}) {
  const M = {
    dusk:  { top: 0x3b4a8f, horizon: 0xffb27a, bottom: 0x3a2f55, fogc: 0xe7a98a, sun: 0xffd2a1, hemi: [0xffd6b0, 0x4a5a78], exp: 0.95 },
    night: { top: 0x070b24, horizon: 0x2b3d73, bottom: 0x0a0d1f, fogc: 0x1a2447, sun: 0x9db4ff, hemi: [0x9fb4ff, 0x1c2036], exp: 0.85 },
    dawn:  { top: 0x6d8fd6, horizon: 0xffd6c2, bottom: 0x7a8fb8, fogc: 0xf4cdb8, sun: 0xfff0d6, hemi: [0xffe9d0, 0x6a7a9a], exp: 1.0 },
    storm: { top: 0x1d2433, horizon: 0x5a6682, bottom: 0x1a1f2b, fogc: 0x445068, sun: 0xaab8d8, hemi: [0x9aa8c8, 0x2a3040], exp: 0.85 },
  }[mood];
  w.env({
    top: M.top, horizon: M.horizon, bottom: M.bottom,
    fog: { color: M.fogc, near: 40, far: 300 },
    sun: { color: M.sun, intensity: mood === 'night' ? 0.6 : 2.0, dir: mood === 'dawn' ? [0.6, 0.45, 0.5] : [-0.5, 0.55, 0.55] },
    hemi: { sky: M.hemi[0], ground: M.hemi[1], intensity: 0.75 },
    exposure: M.exp, stars: mood === 'night' ? 0.9 : 0,
    bloom: { strength: 0.4, radius: 0.65, threshold: 1.0 },
    clouds: mood === 'night' ? null : { count: 16, color: 0xffe0c8, y: [-30, -10], radius: [40, 260], opacity: 0.4, size: [60, 140] },
    motes: { color: 0xffe9b8, count: 160, size: 0.08, opacity: 0.5 },
  });
  w.setTheme({ tex: 'wood', color: 0xffffff, trim: null, edge: 0x6b4a2e, edgeOpacity: 0.22, accent: 0xffc83d, danger: COL.danger, roughness: 0.7 });
  w.killY = -40;
}

/** A solid deck. Same as w.plat, but wooden by default. Pass `path:true` for platforms on the intended route (hints, bots). */
export const deck = (w, o) => w.plat({ tex: 'wood', ...o });
/** Stone/dark platform variant. */
export const stone = (w, o) => w.plat({ tex: 'metal', color: 0x8d97a8, ...o });

/** Platform that is solid for everyone but only DRAWN for the given role(s). Asymmetric-vision tricks. */
export function seenBy(w, who, o) {
  const p = w.plat(o);
  const show = who === 'all' || who === w.coop.me || (Array.isArray(who) && who.includes(w.coop.me));
  p.group.visible = show;
  return p;
}

/** Floating text / sign. */
export const sign = (w, text, x, y, z, o = {}) => w.sign({ text, x, y, z, w: o.w ?? 6, h: o.h ?? 1.4, rotY: o.rotY ?? 0, glow: o.glow ?? true, color: o.color ?? '#fff3d0', bg: o.bg ?? 'rgba(20,16,12,0.7)', border: o.border ?? '#ffc83d', size: o.size ?? 0, tw: o.tw ?? 640 });

/** A tall light shaft that marks a spot. */
export function beacon(w, x, y, z, color = 0xffe9a8, h = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, h, 18, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(x, y + h / 2, z); w.add(m); return m;
}

/**
 * Pressure plate. `need`: 'any' | 'both' | 'p1' | 'p2' — who has to be standing on it for it to count as pressed.
 * Returns the zone ({active, p1, p2, mine, theirs}). onChange(active) fires on both machines when its state flips.
 * `hold` (s) keeps it counted as pressed for a while after the last foot leaves (timed doors).
 */
export function plate(w, o, onChange) {
  const { x, y, z, size = 2.2, need = 'any', hold = 0, label = null, w: ww = size, d: dd = size } = o;
  const c = w.coop, col = colorOf(need);
  const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
  const base = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.3, 0.1, dd + 0.3), plainMaterial(0x262b36, { metalness: 0.6, roughness: 0.4 })); base.position.y = 0.05; base.receiveShadow = true; g.add(base);
  const padMat = glowMaterial(col, 0.9);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.16, dd), padMat); pad.position.y = 0.1; g.add(pad);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(ww * 1.7, dd * 1.7), new THREE.MeshBasicMaterial({ map: softTexture('glow'), color: col, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.2; g.add(halo);
  if (label) { const s = sign(w, label, x, y + 2.2, z, { w: Math.max(3.2, ww * 1.4), h: 0.7, tw: 512, size: 30, bg: 'rgba(20,16,12,0.55)', border: '#' + col.toString(16).padStart(6, '0') }); s.userData.plate = true; }
  const zn = c.zone({ x, y: y + 1.0, z, w: ww - 0.2, h: 2.0, d: dd - 0.2, need });
  let held = 0, on = false;
  const set = (v) => { if (v === on) return; on = v; zn.pressed = v; onChange?.(v, zn); };
  zn.pressed = false;
  w.updaters.push((dt) => {
    held = zn.active ? hold : Math.max(0, held - dt);
    set(zn.active || held > 0);
    const target = on ? -0.07 : 0, k = Math.min(1, dt * 14);
    pad.position.y += ((0.1 + target) - pad.position.y) * k;
    padMat.color.setHex(col).multiplyScalar(on ? 2.3 : 0.9);
    halo.material.opacity += ((on ? 0.55 : 0.18 + Math.sin(w.t * 3) * 0.05) - halo.material.opacity) * k;
  });
  return zn;
}

/** A wall/door that slides up when `open(true)` is called. Solid for both players while closed. */
export function gate(w, o) {
  const { x, y = 0, z, w: ww = 6, h = 5, d = 0.8, color = 0x6b4a2e, tex = 'wood', speed = 7, glow = null } = o;
  const p = w.plat({ x, y: y + h, z, w: ww, d, h, tex, color, trim: glow, moving: true });
  const st = { plat: p, open: false, k: 0 };
  w.updaters.push((dt) => {
    const target = st.open ? 1 : 0;
    st.k += Math.sign(target - st.k) * Math.min(Math.abs(target - st.k), dt * speed / h);
    p.setPos(p.base.x, p.base.y + st.k * (h + 0.15), p.base.z);
    p.body.enabled = st.k < 0.98;
  });
  st.set = (v) => { st.open = !!v; };
  Object.defineProperty(st, 'passable', { get: () => st.k > 0.98 });      // physically out of the way (for bots and timers)
  return st;
}

/** A platform that rises/lowers: raised = standing (solid), lowered = sunk out of the way. */
export function riser(w, o) {
  const { x, y, z, w: ww = 4, d = 4, h = 1, drop = 6, tex = 'wood', start = false, speed = 5, always = false } = o;
  const p = w.plat({ x, y, z, w: ww, d, h, tex, moving: true, path: !!o.path, color: o.color, trim: o.trim });
  const st = { plat: p, up: !!start, k: start ? 1 : 0 };
  w.updaters.push((dt) => {
    const t = st.up ? 1 : 0;
    st.k += Math.sign(t - st.k) * Math.min(Math.abs(t - st.k), dt * speed / drop);
    p.setPos(p.base.x, p.base.y - (1 - st.k) * drop, p.base.z);
    p.body.enabled = always || st.k > 0.04;
  });
  st.set = (v) => { st.up = !!v; };
  return st;
}

/** Shared lever: press E near it; the state is synced via the coop store. */
export function lever(w, o, onChange) {
  const { x, y, z, key, label = 'Pull the lever', rotY = 0, toggle = true, color = 0xffc83d } = o;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; w.add(g);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.5), plainMaterial(0x2b2f3a, { metalness: 0.5, roughness: 0.4 })); post.position.y = 0.55; g.add(post);
  const arm = new THREE.Group(); arm.position.y = 1.1; g.add(arm);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 10), plainMaterial(0xcfd3dc, { metalness: 0.8, roughness: 0.25 })); rod.position.y = 0.5; arm.add(rod);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 14), glowMaterial(color, 1.8)); knob.position.y = 1.02; arm.add(knob);
  const c = w.coop;
  let val = false;
  const apply = (v) => { val = !!v; onChange?.(val); };
  c.on(key, (v) => apply(v));
  w.updaters.push((dt) => { const t = val ? -0.9 : 0.9; arm.rotation.z += (t - arm.rotation.z) * Math.min(1, dt * 10); });
  w.interactable({ x, y: y + 1.1, z, w: 1.2, h: 2.2, d: 1.2, label: () => `${label} (${val ? 'on' : 'off'})`, onUse: () => { c.set(key, toggle ? !val : true); w.game.audio.confirm?.(); } });
  return { get on() { return val; } };
}

/** Colour-coded role banner: show a one-liner only to one player (HUD toast + sign visible to that role). */
export function roleSign(w, who, text, x, y, z, o = {}) {
  if (who !== 'all' && who !== w.coop.me) return null;
  return sign(w, text, x, y, z, { border: who === 'all' ? '#ffc83d' : '#' + COL[who].toString(16).padStart(6, '0'), ...o });
}

/** Lantern post (set dressing + a bit of light). */
export function lantern(w, x, y, z, color = 0xffc880) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 8), plainMaterial(0x3a2c20, { roughness: 0.8 })); post.position.set(x, y + 1.3, z); post.castShadow = true; w.add(post);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), glowMaterial(color, 2.2)); bulb.position.set(x, y + 2.7, z); w.add(bulb);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.set(x, y + 2.7, z); sp.scale.set(3.2, 3.2, 1); w.add(sp);
}

/** Lake plane far below (set dressing – the kill plane is w.killY). */
export function lake(w, y = -28, size = 600, color = 0x2a6f8f) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.5, transparent: true, opacity: 0.92 }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; w.add(m);
  w.updaters.push(() => { const p = w.game.player; m.position.x = p.x; m.position.z = p.z; });
  return m;
}

/** Fire a one-shot checkpoint for the PAIR (either of you touching it saves it for both). */
export function pairCheckpoint(w, x, y, z, label = 'CHECKPOINT') { return w.checkpoint({ x, y, z, real: true, label }); }

/** Narrator line for one role after a delay. */
export function tellLater(w, sec, role, key, opts) { w.after(sec, () => w.coop.tell(role, key, opts)); }

/**
 * A one-shot beat for the pair: the first time EITHER of you enters the box, `fn(c)` runs once on both machines.
 * (Use it for narrator lines, switching the death rule, turning the rope on, …)
 */
export function stage(w, name, box, fn) {
  const c = w.coop;
  let fired = false;
  c.onEvent('stage:' + name, () => { if (fired) return; fired = true; fn(c); });
  const z = c.zone({ ...box, need: 'any', shrink: 0 });
  z.onChange((zn) => { if (zn.active && !fired) c.emit('stage:' + name); });
  return z;
}

/** Rule for who respawns when. 'self' | 'both' | 'revive'. Call from a stage() so both machines switch together. */
export function setDeathRule(w, rule) { w.coopRules.deathRule = rule; }

/**
 * Scripted bot support (tools/coop-bot.mjs). `byRole` = { p1: [step…], p2: [step…] }.
 * step: { x, z }                    walk to (x,z) (numbers or functions), done on arrival (r metres, default 1)
 *       { x, z, until: () => bool } walk there, then stand still until the condition is true
 *       { until }                   just stand still until true
 *       { jump: true|radius, stop }       jump while moving toward the target (boosts, hops) once within `radius` metres (default 2.2)
 *       { …, id, retry: { when, to: id } } if `when()` holds on this step, jump back to the step with that id
 *       { follow: true, until }     walk the path:true platforms until the condition holds
 * Without a plan the bot follows `path:true` platforms in order.
 */
export function botSteps(w, byRole) {
  const g = w.game, steps = byRole[w.coop.me] || [];
  let i = 0;
  const val = (v, d) => (typeof v === 'function' ? v() : v ?? d);
  w.botPlan = () => {
    const p = g.player;
    for (let guard = 0; guard < 30 && i < steps.length; guard++) {
      const s = steps[i];
      if (s.retry && s.retry.when()) { const j = steps.findIndex((q) => q.id === s.retry.to); if (j >= 0 && j < i) { i = j; continue; } }   // fell off: go back to an earlier step
      if (s.follow) {                                    // let the bot walk the path:true platforms until the condition holds
        if (s.until && s.until()) { i++; continue; }
        return null;
      }
      const tx = val(s.x, p.x), tz = val(s.z, p.z);
      const arrived = Math.hypot(tx - p.x, tz - p.z) < (s.r ?? 1.0);
      const done = s.until ? s.until() : arrived;
      if (done) { i++; s.then?.(); continue; }
      const stand = s.until && (arrived || s.x === undefined);
      if (s.use && arrived) g.useFocus();
      return { x: tx, z: tz, wait: !!stand, jump: s.jump || false, stop: s.stop };
    }
    return null;                                        // out of steps: follow the path again
  };
  w.botIndex = () => i;
  w.botCur = () => steps[i];
  w.botList = steps;
  w.botSetIndex = (n) => { i = n; };
}
