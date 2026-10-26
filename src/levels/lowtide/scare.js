import * as THREE from 'three';
import { figure } from './figure.js';

// Lowtide's scare toolkit. Everything is triggered through a shared event (Z.fire) so both machines agree on WHEN, but each machine renders its
// own version (per-role if you pass role). Big scares are rate-limited per chapter (Z.maxBig) so they stay frightening.
//
//   const Z = scares(w, game, H, S);
//   Z.on('door-slam', (arg) => { … });  Z.fire('door-slam', arg)
//   Z.rush('orderly', { role: 'p2' })    a figure appears at the edge of the torch and charges at you; sting + flash
//   Z.behind('patient', { dist: 3.5 })   footsteps; a figure stands behind you; it is gone when you look
//   Z.partnerWrong(4)                    your partner's avatar glitches, stretches and flickers; whispers
//   Z.blackout(2.5)                      every lamp and your torch die for a while
//   Z.sting()                            flash + loud sting + shake + glitch (counts as a big scare)

export function scares(w, game, H, S) {
  const c = w.coop, me = c.me;
  const Z = { big: 0, maxBig: 7, handlers: new Map() };
  const flashEl = document.getElementById('lt-flash');
  const given = () => (Z.big++ < Z.maxBig);

  Z.on = (id, fn) => { c.onEvent('sc:' + id, (a) => fn(a || {})); };
  Z.fire = (id, arg) => c.emit('sc:' + id, arg || {});
  const mine = (a) => !a.role || a.role === 'all' || a.role === me;

  Z.flash = (alpha = 0.85, ms = 110) => { if (!flashEl) return; flashEl.style.transition = 'none'; flashEl.style.opacity = alpha; requestAnimationFrame(() => { flashEl.style.transition = `opacity ${ms * 3}ms ease-out`; flashEl.style.opacity = 0; }); };
  Z.shake = (k = 1) => { game.shake = Math.max(game.shake || 0, k); };
  Z.sting = (vol = 0.5) => { if (!given()) return false; S.sting(vol); Z.flash(); Z.shake(1.2); H.stutter(0.9); game.fx.glitch = 1; setTimeout(() => { game.fx.glitch = 0; }, 260); return true; };

  // ---- a figure that charges at you ---------------------------------------------------------------------------------------
  const live = [];                                                                       // active figures animated each frame
  Z.rush = (kind = 'orderly', o = {}) => {
    if (!mine(o)) return;
    const cam = game.camera, ang = ((o.angle ?? (Math.random() - 0.5)) * 0.9), dist = o.dist ?? 11;
    const f = figure(w, { kind }); const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), game.yaw + ang);
    const start = new THREE.Vector3(cam.position.x + dir.x * dist, 0, cam.position.z + dir.z * dist);
    live.push({ f, t: 0, dur: o.dur ?? 0.55, start, kind: 'rush', dist, stung: false, then: o.then });
    S.step(0, 0.14, true);
  };
  /** A figure stands where you just were. It vanishes when you turn and look at it. */
  Z.behind = (kind = 'patient', o = {}) => {
    if (!mine(o)) return;
    const cam = game.camera, d = o.dist ?? 3.6, back = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), game.yaw);
    const f = figure(w, { kind }); f.set(cam.position.x + back.x * d, 0, cam.position.z + back.z * d);
    live.push({ f, t: 0, dur: o.dur ?? 12, kind: 'behind', seen: 0, dist: d });
    S.step(0.0, 0.1); setTimeout(() => S.step(0, 0.12), 380); S.breath(0, 0.09);
  };
  /** A figure that just stands in the dark, doing nothing, until you look away. */
  Z.stand = (kind, x, z, o = {}) => {
    if (!mine(o)) return;
    const f = figure(w, { kind }); f.set(x, o.y ?? 0, z);
    live.push({ f, t: 0, dur: o.dur ?? 20, kind: 'stand', x, z, seen: 0 });
  };
  Z.partnerWrong = (sec = 4, o = {}) => { if (mine(o)) Z._wrong = { t: sec, dur: sec }; S.whisper(Math.random() < 0.5 ? -0.8 : 0.8, 1.4); };
  Z.blackout = (sec = 2.5) => { H.force(0); H.torchOn = false; S.static(0.35, 0.1); setTimeout(() => { H.force(null); H.torchOn = true; S.static(0.25, 0.1); }, sec * 1000); };
  Z.whisper = (o = {}) => { if (mine(o)) S.whisper(o.pan ?? (Math.random() < 0.5 ? -0.9 : 0.9), 1.8); };
  Z.knock = (o = {}) => { if (!mine(o)) return; for (let i = 0; i < (o.n ?? 3); i++) setTimeout(() => S.slam(0.25), i * 420); };
  Z.heartbeat = (on, rate = 1.3) => S.heart(on, rate);

  Z.on('sting', (a) => { if (mine(a)) Z.sting(a.vol); });
  Z.on('rush', (a) => Z.rush(a.kind, a));
  Z.on('behind', (a) => Z.behind(a.kind, a));
  Z.on('wrong', (a) => Z.partnerWrong(a.sec, a));
  Z.on('blackout', (a) => Z.blackout(a.sec));
  Z.on('whisper', (a) => Z.whisper(a));
  Z.on('knock', (a) => Z.knock(a));

  // ---- per frame ------------------------------------------------------------------------------------------------------------
  const prev = w.hooks.frame, v = new THREE.Vector3();
  w.hooks.frame = (dt, g) => {
    prev?.(dt, g);
    const cam = g.camera; cam.getWorldDirection(v);
    for (let i = live.length - 1; i >= 0; i--) {
      const L = live[i]; L.t += dt; const pos = L.f.group.position;
      if (L.kind === 'rush') {
        const k = Math.min(1, L.t / L.dur), e = k * k;
        pos.set(L.start.x + (cam.position.x - L.start.x) * e, 0, L.start.z + (cam.position.z - L.start.z) * e);
        L.f.face(Math.atan2(cam.position.x - pos.x, cam.position.z - pos.z)); L.f.pose(L.t * 22, 1, 1, L.t);
        if (!L.stung && k > 0.82) { L.stung = true; Z.sting(0.55); }
        if (k >= 1) { L.f.group.visible = false; L.dead = true; L.then?.(); }
      } else {
        const dx = pos.x - cam.position.x, dz = pos.z - cam.position.z, d = Math.hypot(dx, dz) || 1;
        const facing = (v.x * dx + v.z * dz) / d;                                       // 1 = looking straight at it
        L.f.face(Math.atan2(-dx, -dz) + Math.PI); L.f.pose(0, 0, 0, L.t);
        if (facing > 0.55 && d < 14) L.seen += dt; else L.seen = Math.max(0, L.seen - dt * 0.5);
        if (L.kind === 'behind' && L.seen > 0.5) { S.whisper(0, 0.9, 0.1); S.static(0.2, 0.06); L.dead = true; }
        if (L.kind === 'stand' && L.seen > 1.6 && d > 5) L.hide = true;
        if (L.hide && facing < 0.2) L.dead = true;                                       // looked away: it is gone
        if (L.t > L.dur) L.dead = true;
      }
      if (L.dead) { w.scene.remove(L.f.group); live.splice(i, 1); }
    }
    // the wrong partner: stretch, jitter, flicker in and out, a lean that is not theirs
    const av = game.coop?.avatar;
    if (Z._wrong && av) {
      Z._wrong.t -= dt; const k = Math.max(0, Z._wrong.t / Z._wrong.dur), tt = w.t;
      const j = Math.floor(tt * 12); const r = (n) => { const s = Math.sin((j + n) * 91.7) * 4375.5; return s - Math.floor(s); };
      av.scale.set(1 + (r(1) - 0.5) * 0.5 * k, 1 + (r(2) - 0.3) * 0.7 * k, 1 + (r(3) - 0.5) * 0.5 * k);
      av.rotation.z = (r(4) - 0.5) * 0.5 * k; av.visible = r(5) > 0.12 * k;
      g.fx.glitch = Math.max(g.fx.glitch, 0.35 * k);
      if (Z._wrong.t <= 0) { Z._wrong = null; av.scale.set(1, 1, 1); av.rotation.z = 0; av.visible = true; g.fx.glitch = 0; }
    }
  };
  w.Z = Z;
  return Z;
}
