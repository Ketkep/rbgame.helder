import * as THREE from 'three';
import { glowMaterial, plainMaterial, softTexture, textTexture } from '../../engine/materials.js';
import { MOVE } from '../../engine/physics.js';
import { deck } from './kit.js';

// Session 8 (Secret Santa) building blocks: snowy decks, live signs, pedestals, presents, retractable bridges, stompers, snowballs.

export const SNOW = 0xdce8f5;
export const snowdeck = (w, o) => deck(w, { color: SNOW, edge: 0x7f95b5, ...o });

/** A sign whose text can change. `.set(text)` redraws only when the text differs. */
export function liveSign(w, x, y, z, { w: ww = 6, h = 1.6, tw = 640, border = '#ffc83d', rotY = 0, size = 0, color = '#fff3d0', text = '' } = {}) {
  const th = Math.round((tw * h) / ww);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ww, h), mat);
  mesh.position.set(x, y, z); mesh.rotation.y = rotY; w.scene.add(mesh);
  let last = null;
  const set = (t) => {
    if (t === last) return; last = t;
    const tex = textTexture(t, { w: tw, h: th, color, bg: 'rgba(20,16,12,0.78)', border, size });
    mat.map?.dispose(); mat.map = tex; mat.needsUpdate = true;
  };
  w.disposers.push(() => { mat.map?.dispose(); });
  set(text);
  return { mesh, set };
}

/** A little pedestal with a glowing button and an interactable. `show:false` builds only the (invisible) interactable. */
export function pedestal(w, { x, y, z, color = 0xff4d5e, label, onUse, enabled = null, show = true, height = 0.9 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.visible = show; w.add(g);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, height, 14), plainMaterial(0x2b2f3a, { metalness: 0.4, roughness: 0.5 })); post.position.y = height / 2; g.add(post);
  const knobMat = glowMaterial(color, 1.6);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 16), knobMat); knob.position.y = height + 0.07; g.add(knob);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); halo.position.y = height + 0.3; halo.scale.set(2.2, 2.2, 1); g.add(halo);
  const it = w.interactable({ x, y: y + 1.0, z, w: 1.4, h: 2.0, d: 1.4, label, onUse, enabled: () => show && (!enabled || enabled()) });
  w.updaters.push(() => { const on = !enabled || enabled(); knobMat.color.setHex(color).multiplyScalar(on ? 1.6 : 0.25); halo.material.opacity = on ? 0.35 + Math.sin(w.t * 3 + x) * 0.12 : 0.05; knob.position.y = height + (on ? 0.07 : 0.02); });
  return { group: g, it };
}

/** A gift box with a ribbon. Returns the group. */
export function present(w, x, y, z, color, s = 1.1) {
  const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
  const box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), plainMaterial(color, { roughness: 0.5 })); box.position.y = s / 2; box.castShadow = true; g.add(box);
  const rib = plainMaterial(0xfff1c8, { roughness: 0.4 });
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(s * 0.2, s * 1.02, s * 1.02), rib); r1.position.y = s / 2; g.add(r1);
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(s * 1.02, s * 1.02, s * 0.2), rib); r2.position.y = s / 2; g.add(r2);
  const bow = new THREE.Mesh(new THREE.TorusKnotGeometry(s * 0.14, s * 0.05, 40, 8), rib); bow.position.y = s + 0.1; g.add(bow);
  return g;
}

/** A snowdrift: a few flattened white lumps over a rectangle. */
export function drift(w, x, y, z, ww, dd, seed = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
  const mat = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.95 });
  let s = seed * 9301 + 7;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const n = Math.round((ww * dd) / 5);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat);
    m.scale.set(1.2 + rnd() * 1.2, 0.35 + rnd() * 0.25, 1.2 + rnd() * 1.2);
    m.position.set((rnd() - 0.5) * (ww - 1.5), 0, (rnd() - 0.5) * (dd - 1.5)); g.add(m);
  }
  g.visible = false;
  return g;
}

/**
 * A bridge that a PRANK can retract. State is one shared key `pk.<id>` = world time of the prank.
 *   warn  (WARN s)  : the bridge flashes and ticks quietly, still solid
 *   gone  (GONE s)  : invisible, not solid (a faint outline stays so you know where it comes back)
 *   back  (BACK s)  : flashes again, solid
 */
export const PRANK = { WARN: 1.3, GONE: 3.0, BACK: 0.9 };
export function retractBridge(w, { x, y, z, wd = 4, d = 9, id, path = true }) {
  const c = w.coop;
  const plat = w.plat({ x, y, z, w: wd, d, h: 0.5, tex: 'wood', color: 0xc9a26a, trim: 0xffe9a8, moving: true, path });
  const ghost = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(wd, 0.5, d)), new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.5 }));
  ghost.position.set(x, y - 0.25, z); ghost.visible = false; w.add(ghost);
  const st = { plat, t0: -999, phase: 'up' };
  c.on('pk.' + id, (v) => { st.t0 = v; });
  let tickT = 0;
  w.updaters.push((dt) => {
    const e = w.t - st.t0, W = PRANK.WARN, G = PRANK.GONE, B = PRANK.BACK;
    st.phase = e < 0 || e > W + G + B ? 'up' : e < W ? 'warn' : e < W + G ? 'gone' : 'back';
    const flash = st.phase === 'warn' ? Math.sin(w.t * 44) > 0 : st.phase === 'back' ? Math.sin(w.t * 70) > 0 : true;
    plat.group.visible = st.phase === 'gone' ? false : st.phase === 'up' ? true : flash;
    plat.body.enabled = st.phase !== 'gone';
    ghost.visible = st.phase === 'gone' || st.phase === 'warn';
    if (st.phase === 'warn') { tickT -= dt; if (tickT <= 0) { tickT = 0.22; w.game.audio.tick?.(); } } else tickT = 0;
  });
  return st;
}

/** Coal / press: a block that telegraphs (a red marker, then it drops) and only hurts for ACT seconds. `paused()` freezes it. */
export function stomper(w, { x, y, z, size = 2.8, period = 4.2, offset = 0, paused = null, coal = true }) {
  const WARN = 1.2, ACT = 0.45, TOP = 7;
  const cyc = (t) => (((t + offset) % period) + period) % period;
  const isActive = (t) => (!paused || !paused()) && cyc(t) >= period - ACT;
  const hz = w.hazard({ x, y: y + 0.8, z, w: size, h: 1.6, d: size });
  hz.group.visible = false; hz.enabled = false; hz.predict = isActive;
  const marker = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: 0xff4d5e, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  marker.rotation.x = -Math.PI / 2; marker.position.set(x, y + 0.03, z); w.add(marker);
  const blk = new THREE.Mesh(new THREE.BoxGeometry(size - 0.1, 1.6, size - 0.1), plainMaterial(coal ? 0x1d1d22 : 0x6a7283, { roughness: 0.6, metalness: coal ? 0.1 : 0.6 }));
  const glow = new THREE.Mesh(new THREE.BoxGeometry(size, 0.12, size), glowMaterial(0xff7b3d, 1.3)); glow.position.y = -0.8; blk.add(glow);
  blk.position.set(x, y + TOP, z); w.add(blk);
  w.updaters.push(() => {
    const p = cyc(w.t), pz = paused && paused();
    const warnStart = period - WARN - ACT;
    let k = 0;                                           // 0 up .. 1 down
    if (p >= warnStart && p < period - ACT) k = ((p - warnStart) / WARN) ** 2;
    else if (p >= period - ACT) k = 1;
    else if (p < 0.6) k = 1 - p / 0.6;
    if (pz) k = Math.min(k, 0.15);
    blk.position.y = y + 0.8 + (1 - k) * TOP;
    const warn = !pz && p >= warnStart && p < period - ACT;
    marker.material.opacity = warn ? 0.22 + 0.2 * (Math.sin(w.t * 16) > 0 ? 1 : 0) : 0;
    hz.enabled = isActive(w.t);
  });
  return hz;
}

/**
 * Snowballs. A throw is shared as an event so both worlds fly the same ball. Only the VICTIM's machine decides whether it hit
 * them (a knock-back, never a death) and only the THROWER's machine decides whether it hit a target.
 */
export function snowballs(w, { targets = [], onTarget, active = () => true, speed = 18 }) {
  const c = w.coop, g = w.game;
  const balls = [], G = 14;
  const geo = new THREE.SphereGeometry(0.2, 10, 8), mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9fb4ff, emissiveIntensity: 0.35 });
  let cool = 0;
  c.onEvent('sb', (a) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(a.x, a.y, a.z); w.add(m);
    balls.push({ m, x: a.x, y: a.y, z: a.z, vx: a.vx, vy: a.vy, vz: a.vz, mine: a.by === c.me, age: 0 });
  });
  const kill = (b, col = 0xffffff) => { b.dead = true; w.scene.remove(b.m); w.burst?.(new THREE.Vector3(b.x, b.y, b.z), col, 8, 2); };
  const throwVel = (vx, vy, vz) => {
    const p = g.player;
    if (cool > 0 || g.state !== 'playing') return false;
    cool = 0.45;
    const l = Math.hypot(vx, vy, vz) || 1;
    c.emit('sb', { by: c.me, x: +(p.x + (vx / l) * 0.6).toFixed(2), y: +(p.y + 1.45 + (vy / l) * 0.6).toFixed(2), z: +(p.z + (vz / l) * 0.6).toFixed(2), vx: +vx.toFixed(2), vy: +vy.toFixed(2), vz: +vz.toFixed(2) });
    g.audio.tick?.();
    return true;
  };
  const throwView = () => {
    const cp = Math.cos(g.pitch);
    return throwVel(-Math.sin(g.yaw) * cp * speed, Math.sin(g.pitch) * speed + 2.0, -Math.cos(g.yaw) * cp * speed);
  };
  /** Aim at a (possibly moving) target: fn(t) -> {x,y,z}. Used by the bots. */
  const throwAt = (fn) => {
    const p = g.player, ox = p.x, oy = p.y + 1.45, oz = p.z;
    let T = 0.8, q = fn(w.t + T);
    for (let i = 0; i < 4; i++) { q = fn(w.t + T); T = Math.hypot(q.x - ox, q.z - oz) / speed + 0.02; }
    q = fn(w.t + T);
    return throwVel((q.x - ox) / T, (q.y - oy + 0.5 * G * T * T) / T, (q.z - oz) / T);
  };
  const onKey = (e) => { if (e.code === 'KeyF' && !e.repeat && active()) throwView(); };
  const onMouse = (e) => { if (e.button === 0 && g.locked && !g.focus && active()) throwView(); };
  document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onMouse);
  w.disposers.push(() => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onMouse); balls.forEach((b) => w.scene.remove(b.m)); });
  w.updaters.push((dt) => {
    cool = Math.max(0, cool - dt);
    const p = g.player;
    for (const b of balls) {
      if (b.dead) continue;
      b.age += dt; b.vy -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.m.position.set(b.x, b.y, b.z);
      if (b.age > 4 || b.y < -5) { kill(b); continue; }
      let hitSolid = false;
      for (const s of w.bodies) {
        if (!s.enabled || !s.solid || s.tag === 'partner') continue;
        if (b.x > s.x - s.hx && b.x < s.x + s.hx && b.y > s.y - s.hy && b.y < s.y + s.hy && b.z > s.z - s.hz && b.z < s.z + s.hz) { hitSolid = true; break; }
      }
      if (hitSolid) { kill(b); continue; }
      if (b.mine) {
        for (let i = 0; i < targets.length; i++) {
          const q = targets[i]; if (q.hit) continue;
          const tp = q.pos(w.t);
          if (Math.hypot(b.x - tp.x, b.z - tp.z) < 1.0 && b.y > tp.y - 0.1 && b.y < tp.y + 2.6) { kill(b, 0xffffff); onTarget?.(i); break; }
        }
      } else if (g.state === 'playing' && Math.abs(b.x - p.x) < 0.6 && Math.abs(b.z - p.z) < 0.6 && b.y > p.y && b.y < p.y + MOVE.height) {
        const l = Math.hypot(b.vx, b.vz) || 1;
        p.vx += (b.vx / l) * 8; p.vz += (b.vz / l) * 8; p.vy = Math.max(p.vy, 2.5); p.grounded = false; p.ground = null;
        g.ui.toast(`${c.names[c.other]} got you with a snowball`, '');
        kill(b);
      }
    }
    for (let i = balls.length - 1; i >= 0; i--) if (balls[i].dead) balls.splice(i, 1);
  });
  return { throwView, throwAt, throwVel };
}

/** A snowman target; pos(t) -> {x,y,z}. Falls over when hit. */
export function snowman(w, pos) {
  const g = new THREE.Group(); w.add(g);
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f9ff, roughness: 0.9 });
  const a = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), white); a.position.y = 0.8; g.add(a);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), white); b.position.y = 1.95; g.add(b);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.5, 12), plainMaterial(0x23232b)); hat.position.y = 2.75; g.add(hat);
  const target = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 24), glowMaterial(0xff4d5e, 1.8)); target.position.set(0, 1.4, 0.82); g.add(target);
  const st = { hit: false, pos, g, fall: 0 };
  w.updaters.push((dt) => {
    const p = pos(w.t); g.position.set(p.x, p.y, p.z);
    st.fall += ((st.hit ? 1 : 0) - st.fall) * Math.min(1, dt * 8);
    g.rotation.x = st.fall * 1.4;
    target.visible = !st.hit;
  });
  return st;
}
