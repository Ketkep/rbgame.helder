import * as THREE from 'three';
import { figure } from './figure.js';

// "The Orderly": a stalker you cannot fight. The HOST runs his brain and streams his state at 10 Hz (c.set); the guest just follows it, so both
// of you see him in the same place. A catch is decided on each machine for its own player (death rule 'self' in the chapter).
// He patrols a waypoint graph, hears running and noise events, sees you in a cone with a clear line, loses you if you hide and stay still, and
// ALWAYS gives a tell: his wheels squeak, his steps carry, the torch flickers when he is near, the lamps dim, a heartbeat starts.
//
//   const st = stalker(w, game, H, S, { nodes: [{ id: 'a', x, z }, …], route: ['a','b','c'], start: 'a' });
//   st.noise(x, z, r)        make a sound he investigates      st.setActive(false)  hold him still / hidden
//   st.state                 'patrol' | 'investigate' | 'chase' | 'search'      st.dist   metres to the nearer player
//   st.hideSpot({x,z,w,d})   a zone where standing still makes you unseeable (lockers, under beds, behind curtains)

const RAD = 0.4;
const segHitsBox = (x0, z0, x1, z1, b) => {                     // 2D slab test of a segment against a box (expanded by RAD)
  const minx = b.x - b.hx - RAD, maxx = b.x + b.hx + RAD, minz = b.z - b.hz - RAD, maxz = b.z + b.hz + RAD;
  let t0 = 0, t1 = 1; const dx = x1 - x0, dz = z1 - z0;
  for (const [p, q, mn, mx] of [[x0, dx, minx, maxx], [z0, dz, minz, maxz]]) {
    if (Math.abs(q) < 1e-9) { if (p < mn || p > mx) return false; continue; }
    let a = (mn - p) / q, c = (mx - p) / q; if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return false;
  }
  return true;
};

export function stalker(w, game, H, S, o) {
  const c = w.coop, me = c.me, host = c.isHost;
  const nodes = o.nodes.map((n, i) => ({ ...n, i, adj: [] }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const solids = () => (o.extra || []).concat(w.bodies).filter((b) => b.enabled && b.solid !== false && b.tag !== 'partner' && b.top - b.hy * 2 < 1.4 && b.top > 0.6 && b.hy * 2 > 0.7);
  const clear = (x0, z0, x1, z1, list = solids()) => !list.some((b) => segHitsBox(x0, z0, x1, z1, b));
  const list0 = solids();
  for (const a of nodes) for (const b of nodes) if (a !== b && Math.hypot(a.x - b.x, a.z - b.z) < (o.link ?? 18) && clear(a.x, a.z, b.x, b.z, list0)) a.adj.push(b);

  const path = (fx, fz, tx, tz) => {                              // Dijkstra over the node graph; returns a list of {x,z}
    const near = (x, z) => nodes.reduce((m, n) => { const d = Math.hypot(n.x - x, n.z - z) + (clear(x, z, n.x, n.z) ? 0 : 40); return d < m.d ? { d, n } : m; }, { d: 1e9, n: null }).n;
    const s = near(fx, fz), e = near(tx, tz); if (!s || !e) return [{ x: tx, z: tz }];
    const dist = new Map([[s, 0]]), prev = new Map(), open = new Set([s]);
    while (open.size) {
      let u = null; for (const n of open) if (u === null || dist.get(n) < dist.get(u)) u = n;
      open.delete(u); if (u === e) break;
      for (const v of u.adj) { const gt = u.gates && u.gates.get(v); if (gt && !gt()) continue; const nd = dist.get(u) + Math.hypot(u.x - v.x, u.z - v.z); if (nd < (dist.get(v) ?? 1e9)) { dist.set(v, nd); prev.set(v, u); open.add(v); } }
    }
    const out = []; for (let n = e; n; n = prev.get(n)) out.unshift({ x: n.x, z: n.z });
    if (out.length === 0 || clear(out[out.length - 1].x, out[out.length - 1].z, tx, tz)) out.push({ x: tx, z: tz }); return out;
  };

  const start = byId.get(o.start || o.route[0]);
  const S0 = { x: start.x, z: start.z, yaw: 0, st: 'patrol', tx: start.x, tz: start.z, on: true, who: null };
  const st = { x: S0.x, z: S0.z, yaw: 0, state: 'patrol', on: true, dist: 99, who: null, nodes, byId, spot: [], bot: !!window.__noRender };
  let wp = [], wi = 0, route = o.route.map((id) => byId.get(id)), ri = 0, wait = 0, search = 0, lost = 0, target = null, sendT = 0, phase = 0, squeakT = 0, stepT = 0, inv = null;
  const fig = figure(w, { kind: 'orderly' });
  fig.set(st.x, 0, st.z);
  const sight = o.sight ?? 17, fov = o.fov ?? 0.95, hear = o.hear ?? 7.5;
  st.speed = o.speed ?? 1.7; st.chaseSpeed = o.chaseSpeed ?? 6.1; st.home = o.home || null; st.hunt = false;       // tunable at run time by a chapter

  // ---- state sync -----------------------------------------------------------------------------------------------------------
  let net = null;
  c.on('orderly', (v) => { if (!host && v) net = v; });
  c.onEvent('noise', (m) => { if (host && m) investigate(m.x, m.z, m.r); });
  const investigate = (x, z, r = 8) => {
    if (!host || !st.on || st.state === 'chase') return;
    const d = Math.hypot(st.x - x, st.z - z); if (d > Math.max(r, 6) * 3.2) return;
    st.state = 'investigate'; inv = { x, z }; wp = path(st.x, st.z, x, z); wi = 0; search = 0;
  };
  st.noise = (x, z, r = 8) => c.emit('noise', { x, z, r });
  st.setActive = (v) => { st.on = !!v; fig.group.visible = !!v; };
  st.warp = (x, z) => { st.x = x; st.z = z; fig.set(x, 0, z); wp = []; };
  st.hideSpot = (b) => { st.spot.push(b); };
  /** Replace the patrol (node ids) and restart it at index `idx`; he drops whatever he was doing and walks to the first node. */
  st.setRoute = (ids, idx = 0) => { route = ids.map((id) => byId.get(id)); ri = idx; wp = []; wi = 0; wait = 0; search = 0; if (st.state !== 'chase') st.state = 'patrol'; };
  /** A patrol node by id. */
  st.nodeAt = (id) => byId.get(id);
  const hiddenNow = (p) => !!p && st.spot.some((b) => Math.abs(p.x - b.x) < b.w / 2 && Math.abs(p.z - b.z) < b.d / 2) && (p.speed ?? 9) < 0.5;
  c.on('hid:p1', () => {}); c.on('hid:p2', () => {});

  /** Extra graph edges that exist only while pred() is true (a door that is open). */
  st.link = (a, b, pred) => { const A = byId.get(a), B = byId.get(b); if (!A || !B) return; for (const [p, q] of [[A, B], [B, A]]) { if (!p.adj.includes(q)) p.adj.push(q); (p.gates ||= new Map()).set(q, pred); } };
  st.setRoute = (ids) => { route = ids.map((id) => byId.get(id)).filter(Boolean); ri = 0; wp = []; wait = 0; };
  st.alert = (role) => { if (!host) return; st.state = 'chase'; target = role; lost = 0; };
  st.reset = (id) => { if (!host) return; const n = byId.get(id || st.home); if (n) st.warp(n.x, n.z); st.state = 'search'; search = 6; wp = []; };
  c.onEvent('orderly-caught', () => { if (host && st.home) { st.reset(st.home); if (st.hunt) st.huntHold = 7; } });   // a catch sends him home so a respawn is never in his sight
  const lit = (role, x, z) => c.get('torch:' + role, false) === true && Math.hypot(x - st.x, z - st.z) < 5;           // a torch left on gives a hider away when he is close
  st.lit = lit;

  let myHid = false;
  w.updaters.push(() => {                                                               // am I standing still inside a hiding place? tell everyone (the host's brain reads it)
    const g = game.player, still = Math.hypot(g.vx, g.vz) < 0.5;
    const inside = st.spot.some((b) => Math.abs(g.x - b.x) < b.w / 2 && Math.abs(g.z - b.z) < b.d / 2) && still;
    if (inside !== myHid) { myHid = inside; c.set('hid:' + me, inside); }
    st.hidden = myHid;
  });
  const players = () => {
    const P = c.partner, g = game.player, out = [];
    if (game.state === 'playing') out.push({ role: me, x: g.x, y: g.y, z: g.z, speed: Math.hypot(g.vx, g.vz), lit: lit(me, g.x, g.z), hidden: c.get('hid:' + me, false) && !lit(me, g.x, g.z) });
    if (P.has && !P.dead) out.push({ role: c.other, x: P.sx, y: P.sy, z: P.sz, speed: Math.hypot(P.vx || 0, P.vz || 0), lit: lit(c.other, P.sx, P.sz), hidden: c.get('hid:' + c.other, false) && !lit(c.other, P.sx, P.sz) });
    return out;
  };

  // ---- the brain (host) -----------------------------------------------------------------------------------------------------
  const think = (dt) => {
    const ps = players(); let best = null;
    for (const p of ps) {
      const dx = p.x - st.x, dz = p.z - st.z, d = Math.hypot(dx, dz);
      p.d = d;
      if (!best || d < best.d) best = p;
      if (p.hidden || (p.speed < 0.5 && !p.lit && hiddenNow({ x: p.x, z: p.z, speed: p.speed }))) continue;
      const ang = Math.abs(((Math.atan2(-dx, -dz) - st.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const inCone = d < sight && ang < fov;
      const bump = d < 3.2;                                                              // close enough to be noticed even from behind
      if ((inCone || bump) && clear(st.x, st.z, p.x, p.z)) { if (st.state !== 'chase') { game.narrator?.say; } st.state = 'chase'; target = p.role; lost = 0; }
      else if (p.speed > 5.4 && d < hear + 2 && clear(st.x, st.z, p.x, p.z, list0)) investigate(p.x, p.z, 8);
      else if (p.speed > 5.4 && d < hear * 0.7) investigate(p.x, p.z, 8);
    }
    st.dist = best ? best.d : 99;
    if (st.huntHold > 0) { st.huntHold -= dt; if (st.state === 'chase') st.state = 'search'; }
    if (st.hunt && !(st.huntHold > 0)) {                                                    // scripted relentless pursuit of the nearest player who is not hiding
      const cand = ps.filter((p) => !p.hidden && !(st.skip && st.skip(p.role))).sort((a, b) => a.d - b.d)[0];
      if (cand) { st.state = 'chase'; target = cand.role; lost = 0; if (clear(st.x, st.z, cand.x, cand.z)) { wp = [{ x: cand.x, z: cand.z }]; wi = 0; } else if (!wp.length || wi >= wp.length || Math.floor(game.time * 3) !== Math.floor((game.time - dt) * 3)) { wp = path(st.x, st.z, cand.x, cand.z); wi = 0; } }
      else if (st.state === 'chase') { st.state = 'search'; search = 3; }
      if (st.state === 'chase') return;
    }
    if (st.state === 'chase') {
      const p = ps.find((q) => q.role === target) || best; if (!p) { st.state = 'search'; search = 3; return; }
      const seen = !p.hidden && clear(st.x, st.z, p.x, p.z);
      if (seen) { lost = 0; wp = [{ x: p.x, z: p.z }]; wi = 0; } else { lost += dt; if (!wp.length || wi >= wp.length || lost < 0.2) { wp = path(st.x, st.z, p.x, p.z); wi = 0; } if (lost > 5) { st.state = 'search'; search = 4; } }
    } else if (st.state === 'search') { search -= dt; st.yaw += dt * 1.6; if (search <= 0) { st.state = 'patrol'; wp = []; } }
    else if (st.state === 'investigate') { if (wi >= wp.length) { st.state = 'search'; search = 4.5; } }
    else {                                                                                // patrol
      if (wait > 0) { wait -= dt; st.yaw += Math.sin(game.time * 2) * dt * 0.8; return; }
      if (!wp.length || wi >= wp.length) { const n = route[ri % route.length]; ri++; wp = path(st.x, st.z, n.x, n.z); wi = 0; wait = o.pause ?? 1.8; }
    }
  };
  const move = (dt) => {
    if (st.state === 'search' || wait > 0 || wi >= wp.length) return false;
    const t = wp[wi], dx = t.x - st.x, dz = t.z - st.z, d = Math.hypot(dx, dz);
    const v = (st.state === 'chase' ? st.chaseSpeed : st.state === 'investigate' ? st.speed * 1.9 : st.speed) * (o.slow ? o.slow(st.x, st.z) : 1);
    if (d < 0.25) { wi++; return true; }
    const step = Math.min(d, v * dt); st.x += (dx / d) * step; st.z += (dz / d) * step;
    const ty = Math.atan2(-dx, -dz); let dy = ((ty - st.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; st.yaw += dy * Math.min(1, dt * (st.state === 'chase' ? 12 : 5));
    return true;
  };

  w.updaters.push((dt) => {
    if (!st.on) return;
    if (host) {
      think(dt); const moving = move(dt);
      sendT -= dt; if (sendT <= 0) { sendT = 0.1; c.set('orderly', { x: st.x, z: st.z, yaw: st.yaw, st: st.state, mv: moving ? 1 : 0, t: w.t }); }
      st.moving = moving;
    } else if (net) {
      const k = Math.min(1, dt * 12); st.x += (net.x - st.x) * k; st.z += (net.z - st.z) * k;
      let dy = ((net.yaw - st.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; st.yaw += dy * k; st.state = net.st; st.moving = !!net.mv;
    }
    // everyone: dist to me, cues, catching me
    const g = game.player, dme = Math.hypot(g.x - st.x, g.z - st.z); st.dist = Math.min(st.dist, dme);
    st.myDist = dme;
    const chase = st.state === 'chase';
    if (!st.bot && game.state === 'playing' && dme < 1.0 && Math.abs(g.y - 0) < 2.2 && chase && !(c.get('hid:' + me, false) && !lit(me, g.x, g.z))) { c.emit('orderly-caught', { role: me }); game.kill('The Orderly'); }
  });

  // ---- visuals and cues (per frame, both machines) -------------------------------------------------------------------------
  const prev = w.hooks.frame;
  w.hooks.frame = (dt, g) => {
    prev?.(dt, g);
    if (!st.on) return;
    const spd = st.moving ? (st.state === 'chase' ? 1 : 0.35) : 0;
    phase += dt * (st.state === 'chase' ? 12 : 5.5) * (st.moving ? 1 : 0.2);
    fig.set(st.x, 0, st.z); fig.face(st.yaw + Math.PI); fig.pose(phase, spd, st.state === 'chase' ? 1 : 0.2, w.t); fig.twitch = st.state === 'search' ? 1 : 0;
    const d = st.myDist ?? 99;
    // the tells: wheels and steps carry; the torch dims near him; a heartbeat starts as he closes in
    const rel = Math.atan2(st.x - g.camera.position.x, st.z - g.camera.position.z) - g.yaw; const pan = Math.max(-1, Math.min(1, Math.sin(rel + Math.PI) * 0.9));
    const near = Math.max(0, 1 - d / 22);
    if (st.moving) {
      stepT -= dt; if (stepT <= 0) { stepT = st.state === 'chase' ? 0.3 : 0.85; S.step(pan, Math.min(0.28, 0.02 + near * 0.34), true); }
      squeakT -= dt; if (squeakT <= 0) { squeakT = 0.7 + Math.random() * 0.8; if (d < 26) S.squeak(pan, 0.02 + near * 0.08); }
    }
    const heartOn = d < 15 || st.state === 'chase';
    S.heart(heartOn, st.state === 'chase' ? 1.9 : 1 + Math.max(0, (15 - d) / 15));
    game.fx.pulse = Math.max(game.fx.pulse * 0.95, heartOn ? 0.15 + 0.6 * Math.max(0, 1 - d / 15) : 0);
    if (d < 7 && st.on) H.stutter(0.06);
    S.dread(Math.max(near, st.state === 'chase' ? 1 : 0));
    g.fx.desat = st.hidden ? 0.5 : 0.12; g.fx.vig = st.hidden ? 0.85 : 0.5;
  };
  w.stalker = st;
  void THREE; void S0; void inv;
  return st;
}
