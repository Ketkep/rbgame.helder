import * as THREE from 'three';
import { glowMaterial } from '../../engine/materials.js';
import { MOVE } from '../../engine/physics.js';
import { COL } from './kit.js';

// Session 7 (Dinner Date) building kit: a CARRY mechanic for two.
//
//   items     things you can carry (a plate, a bowl of soup, a crate of herbs …). One per hand, one hand each.
//   stations  places an item can rest (counters, hatches, the pass). E on a station: pick its item up, or put yours down.
//   hand-over E while facing your partner: they take what you hold.
//   strain    a carried item can break (china: a jump; soufflé: a jump or a fall; soup: sloshes, jumps and sudden stops spill it).
//             Always telegraphed: the bar on screen fills, the item shakes and glows red; a broken item goes back to its home counter.
//
// State is shared through w.coop: ONE key per item, `it:<id>` = { h: holder, a: aux }.
//   h = 'p1' | 'p2'  carried      'sNAME' resting at station NAME      'bNAME' travelling on belt NAME (a = {t0, by})
// The player who acts is the authority for that change; the partner only reads. Strain and spill are tracked by the CARRIER's
// machine and travel with the item in `a` when it changes hands.

const ang = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });   // not cached: item materials glow individually

/** What each kind of item is: how it looks, how it breaks. jump/land are strain per jump / per hard landing (1.0 = breaks). */
export const KINDS = {
  china:   { name: 'Fine china',   jump: 0.62, land: 1.0, decay: 0.45, rest: 0.05, col: 0xfff6e6 },     // a jump breaks it (landing finishes it)
  plate:   { name: 'Plate',        jump: 0.28, land: 0.5, decay: 0.5, rest: 0.05, col: 0xfff6e6 },      // two quick jumps break it
  tray:    { name: 'Canape tray',  jump: 0.3, land: 0.6, decay: 0.5, rest: 0.05, col: 0xd9dde6 },
  soup:    { name: 'Bowl of soup', spill: true, accel: 0.0075, jump: 0.09, land: 0.6, rest: 0.1, col: 0xe8a23c },
  crate:   { name: 'Ingredient',   jump: 0.22, land: 0.4, decay: 0.6, rest: 0.22, col: 0xc9553d },
  dish:    { name: 'Main course',  jump: 0.5, land: 1.0, decay: 0.4, rest: 0.05, col: 0xfff6e6 },
  dessert: { name: 'Souffle',      jump: 0.52, land: 1.0, decay: 0.35, rest: 0.05, col: 0xf2c46b },     // glass: jumps, falls and lift jolts all count
  bill:    { name: 'The bill',     jump: 0, land: 0, decay: 1, rest: 0.05, col: 0xf5f0e0 },              // paper: nothing hurts it
};

function buildMesh(kind, color) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body); g.userData.body = body;
  const mats = [];
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; body.add(m); return m; };
  const gold = M(0xe3b341, { metalness: 0.7, roughness: 0.3 });
  if (kind === 'china' || kind === 'plate' || kind === 'dish') {
    const mat = M(0xfff6e6, { roughness: 0.25 }); mats.push(mat);
    add(new THREE.CylinderGeometry(0.34, 0.26, 0.05, 28), mat, 0, 0.03, 0);
    add(new THREE.TorusGeometry(0.33, 0.015, 6, 28), gold, 0, 0.055, 0).rotation.x = Math.PI / 2;
    if (kind === 'dish') {
      add(new THREE.SphereGeometry(0.2, 14, 10), M(0xb5703a), 0, 0.14, 0).scale.y = 0.55;
      add(new THREE.SphereGeometry(0.08, 10, 8), M(0x4caf50), 0.17, 0.1, 0.05);
      add(new THREE.SphereGeometry(0.07, 10, 8), M(0xe84a4a), -0.15, 0.1, -0.1);
    } else if (kind === 'china') {
      add(new THREE.SphereGeometry(0.1, 10, 8), M(0xe84a4a), 0, 0.11, 0);
    } else {
      add(new THREE.SphereGeometry(0.1, 10, 8), M(0xe9c46a), 0.06, 0.11, 0.03);
    }
  } else if (kind === 'tray') {
    mats.push(M(0xd9dde6, { metalness: 0.6, roughness: 0.3 }));
    add(new THREE.BoxGeometry(0.78, 0.05, 0.5), mats[0], 0, 0.03, 0);
    for (const [x, c] of [[-0.24, 0xe9a23c], [0, 0xd95d39], [0.24, 0x7bbf6a]]) add(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(c), x, 0.06, 0);
  } else if (kind === 'soup') {
    const bowl = M(0xf3efe6, { roughness: 0.3 }); mats.push(bowl);
    add(new THREE.CylinderGeometry(0.3, 0.17, 0.2, 24, 1, true), bowl, 0, 0.12, 0).material.side = THREE.DoubleSide;
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 20), bowl, 0, 0.03, 0);
    const liq = add(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 24), M(color || 0xe8a23c, { emissive: 0x442200, emissiveIntensity: 0.5 }), 0, 0.2, 0);
    g.userData.liquid = liq;
  } else if (kind === 'crate') {
    const m = M(color || 0xc9553d); mats.push(m);
    add(new THREE.BoxGeometry(0.42, 0.34, 0.42), M(0x8d6a45), 0, 0.17, 0);
    add(new THREE.SphereGeometry(0.17, 12, 10), m, -0.08, 0.38, 0.05);
    add(new THREE.SphereGeometry(0.15, 12, 10), m, 0.1, 0.36, -0.06);
  } else if (kind === 'dessert') {
    mats.push(M(0xf2c46b, { roughness: 0.6 }));
    add(new THREE.CylinderGeometry(0.2, 0.17, 0.2, 18), M(0xf8f1e4, { roughness: 0.3 }), 0, 0.12, 0);
    add(new THREE.SphereGeometry(0.22, 16, 12), mats[0], 0, 0.3, 0).scale.y = 0.75;
    add(new THREE.SphereGeometry(0.05, 8, 6), M(0xd1344a), 0, 0.5, 0);
  } else if (kind === 'bill') {
    mats.push(M(0xf5f0e0));
    add(new THREE.BoxGeometry(0.5, 0.03, 0.3), M(0x2a2118), 0, 0.03, 0);
    add(new THREE.BoxGeometry(0.46, 0.025, 0.26), mats[0], 0, 0.05, 0);
  }
  g.userData.mats = mats;
  return g;
}

export function carryKit(w, opts = {}) {
  const c = w.coop, g = w.game, me = c.me, other = c.other, P = c.partner, N = c.names;
  const items = new Map(), stations = new Map(), belts = new Map();
  const K = { items, stations, belts, onBreak: null, onPut: null, lock: false };
  const key = (id) => 'it:' + id;
  const state = (it) => c.get(key(it.id)) || it.init;
  const tmp = new THREE.Vector3();

  // ------------------------------------------------------------------ HUD bars ---------------
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:50%;top:84px;transform:translateX(-50%);display:flex;flex-direction:column;gap:5px;z-index:30;pointer-events:none;align-items:center;font:700 12px Inter,system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000;letter-spacing:.04em';
  document.body.appendChild(hud);
  w.disposers.push(() => hud.remove());
  const bars = new Map();
  K.bar = (id, { label = '', color = '#ffc83d' } = {}) => {
    if (bars.has(id)) return bars.get(id);
    const row = document.createElement('div'); row.style.cssText = 'display:none;flex-direction:column;align-items:center;gap:2px';
    const txt = document.createElement('div'); txt.textContent = label;
    const track = document.createElement('div'); track.style.cssText = 'width:230px;height:9px;border-radius:6px;background:rgba(10,10,16,.7);border:1px solid rgba(255,255,255,.35);overflow:hidden';
    const fill = document.createElement('div'); fill.style.cssText = `height:100%;width:100%;background:${color};transform-origin:left`;
    track.appendChild(fill); row.append(txt, track); hud.appendChild(row);
    const b = { row, txt, fill, color, shown: false,
      set(v, text, col) { fill.style.transform = `scaleX(${Math.max(0, Math.min(1, v))})`; fill.style.background = col || color; if (text !== undefined && txt.textContent !== text) txt.textContent = text; },
      show(on) { if (b.shown !== on) { b.shown = on; row.style.display = on ? 'flex' : 'none'; } } };
    bars.set(id, b); return b;
  };
  const carryBar = K.bar('carry', { label: '' });

  // ------------------------------------------------------------------ items ----------------
  /** K.item(id, kind, homeStation, {color, name, jump, land, accel, …}) */
  K.item = (id, kind, home, o = {}) => {
    const def = { ...KINDS[kind], ...o };
    const mesh = buildMesh(kind, o.color);
    mesh.visible = false; w.add(mesh);
    const it = { id, kind, def, home, mesh, strain: 0, sp: 1, airT: 0, init: { h: 's' + home }, snapped: false, name: o.name || def.name, shake: 0 };
    items.set(id, it);
    c.on(key(id), (v) => {
      if (v && v.h === me) { it.strain = 0; it.sp = v.a?.sp ?? 1; it.airT = 0; }
    });
    return it;
  };
  K.holder = (id) => state(items.get(id)).h;
  K.held = (role = me) => { for (const it of items.values()) if (state(it).h === role) return it.id; return null; };
  K.heldKind = (role = me) => { const id = K.held(role); return id ? items.get(id).kind : null; };
  K.at = (stn) => { const h = 's' + stn; for (const it of items.values()) if (state(it).h === h) return it.id; return null; };
  K.move = (id, h, a) => c.set(key(id), { h, a });
  K.home = (id) => { const it = items.get(id); K.move(id, 's' + it.home, { sp: 1 }); };
  K.sp = (id) => items.get(id).sp;

  // ------------------------------------------------------------------ stations -------------
  /**
   * K.station(id, {x,y,z (centre of the resting spot, y = surface), plat, dx,dy,dz (follow a moving platform),
   *   label, accept (array of kinds | fn(item) | ids), takeable(item) -> bool, onPut(itemId, role), onTake(itemId, role),
   *   belt (name of a belt: putting an item here sends it on its way), approach:[x,z] (for the bots), color, pad})
   */
  K.station = (id, o) => {
    const st = { id, o, x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? 0, label: o.label || 'counter', approach: o.approach || null, accept: o.accept ?? null };
    stations.set(id, st);
    const pos = () => {
      if (o.plat) { const b = o.plat.body; st.x = b.x + (o.dx || 0); st.y = b.top + (o.dy || 0); st.z = b.z + (o.dz || 0); }
      else if (o.fn) { const q = o.fn(w.t); st.x = q.x; st.y = q.y; st.z = q.z; }
    };
    st.pos = pos; pos();
    st.accepts = (it) => {
      const a = st.accept; if (!a) return true;
      if (typeof a === 'function') return !!a(it);
      return a.includes(it.kind) || a.includes(it.id);
    };
    if (o.pad !== false) {
      const col = o.color ?? 0xffc83d;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.025, 28), glowMaterial(col, 0.8, 0.9));
      pad.position.set(st.x, st.y + 0.014, st.z); w.add(pad); st.padMesh = pad;
    }
    const body = w.interactable({
      x: st.x, y: st.y + 0.9, z: st.z, w: o.w ?? 1.5, h: 2.0, d: o.d ?? 1.5, range: o.range ?? 3.4, pad: 0.1,
      label: () => {
        const mine = K.held(), there = K.at(id);
        if (mine) return `Put down ${items.get(mine).name}`;
        if (there) return `Pick up ${items.get(there).name}`;
        return st.label;
      },
      enabled: () => {
        if (K.lock) return false;
        const mine = K.held(), there = K.at(id);
        if (mine) return !there && st.accepts(items.get(mine)) && (!o.canPut || o.canPut(items.get(mine)));
        return !!there && (!o.takeable || o.takeable(items.get(there)));
      },
      onUse: () => {
        const mine = K.held(), there = K.at(id);
        if (mine) {
          const it = items.get(mine);
          if (there || !st.accepts(it)) return;
          if (o.belt) K.move(mine, 'b' + o.belt, { t0: w.t, by: me, sp: it.sp });
          else K.move(mine, 's' + id, { sp: it.sp });
          g.audio.confirm?.();
          o.onPut?.(mine, me); K.onPut?.(id, mine, me);
        } else if (there) {
          const it = items.get(there);
          K.move(there, me, { sp: o.refill ? 1 : (state(it).a?.sp ?? it.sp) });
          g.audio.click?.();
          o.onTake?.(there, me);
        }
      },
    });
    st.it = body;
    return st;
  };

  // ------------------------------------------------------------------ hand-over ------------
  const hand = w.interactable({
    x: 0, y: -999, z: 0, w: 1.0, h: 2.1, d: 1.0, range: 4.6, pad: 0.4,
    label: () => `Hand it to ${N[other]}`,
    enabled: () => !K.lock && !!K.held() && !K.held(other) && P.has && !P.dead,
    onUse: () => {
      const id = K.held(); if (!id || K.held(other) || !P.has) return;
      K.move(id, other, { sp: items.get(id).sp });
      g.audio.confirm?.();
    },
  });

  // ------------------------------------------------------------------ belts ----------------
  /** K.belt(name, {a:[x,y,z], b:[x,y,z], speed, end: stationId, doors:[{d, open:(t)=>bool}]}) — items put on the station `name` travel a→b. */
  K.belt = (name, o) => {
    const A = new THREE.Vector3(...o.a), B = new THREE.Vector3(...o.b);
    const belt = { name, A, B, len: A.distanceTo(B), speed: o.speed ?? 2, end: o.end, doors: o.doors || [] };
    belts.set(name, belt); return belt;
  };
  const beltPos = (belt, a, out) => {
    const d = Math.max(0, Math.min(belt.len, belt.speed * (w.t - (a?.t0 ?? w.t))));
    return out.copy(belt.A).lerp(belt.B, belt.len ? d / belt.len : 0);
  };

  // ------------------------------------------------------------------ breaking -------------
  K.breakItem = (it, why = 'smash') => {
    const p = it.mesh.position;
    if (typeof window !== 'undefined' && window.__bot) window.__bot.log.push(`break ${it.id} ${why} strain=${it.strain.toFixed(2)} sp=${it.sp.toFixed(2)} at ${g.player.x.toFixed(1)},${g.player.y.toFixed(1)},${g.player.z.toFixed(1)} grounded=${g.player.grounded}`);
    w.burst(new THREE.Vector3(p.x, p.y + 0.2, p.z), it.kind === 'soup' ? 0xe8a23c : 0xfff6e6, 22, 4);
    K.home(it.id);
    it.strain = 0; it.sp = 1;
    g.ui.toast(why === 'spill' ? `${it.name} spilled - back to the pot` : why === 'crush' ? `${it.name} got crushed - back to the counter` : `${it.name} smashed - back to the counter`, 'bad');
    K.onBreak?.(it, why);
  };

  // ------------------------------------------------------------------ per-substep rules ----
  let lvx = 0, lvz = 0, lastLand = 0;
  w.updaters.push((h) => {
    const p = g.player, id = K.held();
    if (!id || g.state !== 'playing') { lvx = p.vx; lvz = p.vz; return; }
    const it = items.get(id), d = it.def;
    const dv = Math.hypot(p.vx - lvx, p.vz - lvz); lvx = p.vx; lvz = p.vz;
    if (d.spill) {
      it.sp -= (d.accel || 0.0075) * dv;
      const gv = K.slosh?.(); if (gv) it.sp -= gv * h;
    }
    if (p.justJumped) { if (d.spill) it.sp -= d.jump; else it.strain += d.jump; }
    if (p.justLanded) {
      const k = Math.max(0, Math.min(2, (p.justLanded - 5) / 8));
      if (d.spill) it.sp -= d.land * k * 0.5; else it.strain += d.land * k;
    }
    if (!d.spill) {
      if (p.grounded) { it.airT = 0; it.strain = Math.max(0, it.strain - d.decay * h); } else it.airT += h;
      if (K.jolt) it.strain += K.jolt(it) * h;       // lifts that jerk
      if (it.strain >= 1) K.breakItem(it, 'smash');
    } else if (it.sp <= 0) K.breakItem(it, 'spill');
  });

  // belt authority: whoever put the item on the belt decides what happens to it
  w.updaters.push(() => {
    for (const it of items.values()) {
      const s = state(it);
      if (typeof s.h !== 'string' || s.h[0] !== 'b' || s.a?.by !== me) continue;
      const belt = belts.get(s.h.slice(1)); if (!belt) continue;
      const prev = it.beltD ?? 0, dist = belt.speed * (w.t - s.a.t0); it.beltD = dist;
      for (const dr of belt.doors) if (prev < dr.d && dist >= dr.d && !dr.open(w.t)) { it.beltD = 0; K.breakItem(it, 'crush'); break; }
      if (state(it).h !== s.h) continue;
      if (dist >= belt.len) {
        it.beltD = 0;
        if (belt.end && !K.at(belt.end)) K.move(it.id, 's' + belt.end, { sp: it.sp });
        else { it.beltD = 0; K.breakItem(it, 'crush'); }
      }
    }
  });

  // ------------------------------------------------------------------ per-frame visuals ----
  const frame = (dt) => {
    const p = g.player;
    // a dead carrier drops the lot back at its counter
    if (g.state === 'dead') drop();
    // partner hand-over target
    hand.body.setCenter(P.sx, P.sy + 1.0, P.sz);
    if (!P.has) hand.body.setCenter(0, -999, 0);
    const mineId = K.held();
    let nearly = 0;
    for (const it of items.values()) {
      const s = state(it), h = s.h, m = it.mesh;
      m.visible = true;
      let rot = 0, wob = 0;
      if (h === me) {
        const cy = Math.cos(g.yaw), sy = Math.sin(g.yaw);
        const bob = Math.sin(w.t * 6) * 0.012 * Math.min(1, Math.hypot(p.vx, p.vz) / 4);
        tmp.set(p.x - sy * 0.85 + cy * 0.3, p.y + MOVE.eye - 0.62 + bob, p.z - cy * 0.85 - sy * 0.3); rot = g.yaw;
        const lvl = it.def.spill ? 1 - it.sp : it.strain; nearly = it.def.spill ? 1 - it.sp : it.strain;
        wob = lvl > 0.45 ? (lvl - 0.45) * 0.09 : 0;
      } else if (h === other) {
        const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
        tmp.set(P.sx - sy * 0.6, P.sy + 1.0, P.sz - cy * 0.6); rot = P.yaw;
      } else if (h[0] === 's') {
        const st = stations.get(h.slice(1));
        if (!st) { m.visible = false; continue; }
        st.pos(); tmp.set(st.x, st.y + it.def.rest, st.z);
      } else if (h[0] === 'b') {
        const belt = belts.get(h.slice(1)); if (!belt) { m.visible = false; continue; }
        beltPos(belt, s.a, tmp); tmp.y += it.def.rest;
      } else { m.visible = false; continue; }
      if (!it.snapped || m.position.distanceTo(tmp) > 7) { m.position.copy(tmp); it.snapped = true; }
      else m.position.lerp(tmp, 1 - Math.exp(-dt * (h[0] === 'b' ? 40 : 22)));
      m.rotation.y = rot;
      const body = m.userData.body;
      body.position.set((Math.random() - 0.5) * wob, 0, (Math.random() - 0.5) * wob);
      const lvl = h === me ? nearly : 0;
      for (const mat of m.userData.mats) { if (mat.emissive) mat.emissive.setRGB(lvl > 0.45 ? 0.6 * (lvl - 0.4) * (0.5 + 0.5 * Math.sin(w.t * 22)) : 0, 0, 0); }
      if (m.userData.liquid) { const lq = m.userData.liquid; lq.scale.y = 1; lq.position.y = 0.08 + 0.12 * Math.max(0, h === me ? it.sp : 1); lq.visible = (h === me ? it.sp : 1) > 0.03; }
    }
    // station pads follow movers
    for (const st of stations.values()) {
      if (st.o.plat || st.o.fn) { st.pos(); st.it.body.setCenter(st.x, st.y + 0.9, st.z); if (st.padMesh) st.padMesh.position.set(st.x, st.y + 0.014, st.z); }
      if (st.padMesh) st.padMesh.visible = !K.at(st.id);
    }
    // HUD
    if (mineId) {
      const it = items.get(mineId), d = it.def;
      const lvl = d.spill ? it.sp : 1 - it.strain;
      carryBar.show(true);
      carryBar.set(lvl, `${it.name}${d.spill ? '' : ' - fragile'}`, lvl < 0.3 ? '#ff4d5e' : lvl < 0.6 ? '#ffb43d' : '#3ddc97');
    } else carryBar.show(false);
  };
  const drop = () => { const id = K.held(); if (id) { K.home(id); items.get(id).sp = 1; items.get(id).strain = 0; } };
  w.hooks.onDeath = (e) => { drop(); return K.deathLine ? K.deathLine(e) : false; };
  const prevFrame = w.hooks.frame;
  w.hooks.frame = (dt, gg) => { prevFrame?.(dt, gg); frame(dt); };
  K.frame = frame;
  return K;
}

// =================================================================================================================================
//  The grumpy chef
// =================================================================================================================================
/**
 * A patrolling chef with a vision cone drawn on the floor. Everything about him is a function of the world clock (plus the bell
 * rings, which both machines receive), so both worlds see the same chef. Seen for ~0.9 s in his cone = caught.
 * o: { y, path:[{x,z,wait,look:[dx,dz]}], speed, len, half, bells:[{x,z,face:[dx,dz],wait}], bellSpeed, occluders:[{x0,x1,z0,z1}], onSpot }
 */
export function chef(w, o) {
  const c = w.coop, g = w.game;
  const speed = o.speed ?? 2.2, len = o.len ?? 7, half = o.half ?? 0.6, y = o.y ?? 0, TURN = 0.55;
  const hd = (dx, dz) => Math.atan2(-dx, -dz);
  // --- the patrol timeline
  const path = o.path, n = path.length, segs = [];
  let T = 0;
  for (let i = 0; i < n; i++) {
    const a = path[i], b = path[(i + 1) % n], c2 = path[(i + 2) % n];
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), h1 = hd(dx, dz);
    segs.push({ t0: T, t1: T + L / speed, type: 'walk', a, b, h: h1 }); T += L / speed;
    const h2 = hd(c2.x - b.x, c2.z - b.z);
    let hc = h1;
    if (b.look) { const hl = hd(b.look[0], b.look[1]); segs.push({ t0: T, t1: T + TURN, type: 'turn', a: b, h0: hc, h1: hl }); T += TURN; hc = hl; }
    if (b.wait) { segs.push({ t0: T, t1: T + b.wait, type: 'turn', a: b, h0: hc, h1: hc }); T += b.wait; }
    if (Math.abs(ang(hc, h2)) > 0.01) { segs.push({ t0: T, t1: T + TURN, type: 'turn', a: b, h0: hc, h1: hc + ang(hc, h2) }); T += TURN; }
  }
  const CYC = T;
  const patrol = (tt, out) => {
    tt = ((tt % CYC) + CYC) % CYC;
    for (const s of segs) if (tt < s.t1) {
      const u = (tt - s.t0) / (s.t1 - s.t0 || 1);
      if (s.type === 'walk') { out.x = s.a.x + (s.b.x - s.a.x) * u; out.z = s.a.z + (s.b.z - s.a.z) * u; out.h = s.h; out.walk = true; }
      else { out.x = s.a.x; out.z = s.a.z; out.h = s.h0 + (s.h1 - s.h0) * Math.min(1, u * 1.0); out.walk = false; }
      return out;
    }
    const s = segs[segs.length - 1]; out.x = s.a.x; out.z = s.a.z; out.h = s.h1; out.walk = false; return out;
  };
  // --- bell interludes
  const rings = [], bs = o.bellSpeed ?? 3.6;
  const interlude = (r, e, out) => {
    const bell = r.bell, d1 = r.d1;
    if (e < d1 / bs) { const u = e * bs / d1; out.x = r.x0 + (bell.x - r.x0) * u; out.z = r.z0 + (bell.z - r.z0) * u; out.h = hd(bell.x - r.x0, bell.z - r.z0); out.walk = true; out.mode = 'go'; }
    else if (e < d1 / bs + r.W) { out.x = bell.x; out.z = bell.z; out.h = bell.face ? hd(bell.face[0], bell.face[1]) : hd(bell.x - r.x0, bell.z - r.z0); out.walk = false; out.mode = 'at'; }
    else { const u = (e - d1 / bs - r.W) * bs / d1; out.x = bell.x + (r.x0 - bell.x) * u; out.z = bell.z + (r.z0 - bell.z) * u; out.h = hd(r.x0 - bell.x, r.z0 - bell.z); out.walk = true; out.mode = 'back'; }
    return out;
  };
  const stateAt = (t, out) => {
    let shift = 0; out.mode = 'patrol';
    for (const r of rings) {
      if (t < r.t0) break;
      if (t < r.t0 + r.I) return interlude(r, t - r.t0, out);
      shift += r.I;
    }
    return patrol(t - shift, out);
  };
  const busy = (t) => { const r = rings[rings.length - 1]; return !!r && t < r.t0 + r.I + 0.5; };
  c.onEvent('chef:bell', (a) => {
    if (busy(a.t - 0.01) || rings.some((r) => r.t0 === a.t)) return;
    if (a.t > w.t + 3) return;
    const p0 = stateAt(a.t, {}), bell = o.bells[a.i], W = bell.wait ?? 8;
    const d1 = Math.hypot(bell.x - p0.x, bell.z - p0.z);
    rings.push({ t0: a.t, bell, W, d1, x0: p0.x, z0: p0.z, I: 2 * d1 / bs + W });
  });
  // --- look
  const grp = new THREE.Group(); w.add(grp);
  const mWhite = M(0xf6f4ee, { roughness: 0.7 });
  const bodyM = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.85, 6, 14), mWhite); bodyM.position.y = 0.95; bodyM.castShadow = true; grp.add(bodyM);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.12), M(0x2b3a67)); apron.position.set(0, 0.9, -0.34); grp.add(apron);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), M(0xe6a68a)); head.position.y = 1.78; grp.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.55, 16), mWhite); hat.position.y = 2.2; grp.add(hat);
  const hatTop = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), mWhite); hatTop.position.y = 2.5; grp.add(hatTop);
  for (const sx of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), M(0x2a1a14)); brow.position.set(sx * 0.12, 1.88, -0.27); brow.rotation.z = sx * -0.45; grp.add(brow);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), M(0x111111)); eye.position.set(sx * 0.11, 1.8, -0.27); grp.add(eye);
  }
  const stache = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.07), M(0x3a2a20)); stache.position.set(0, 1.68, -0.28); grp.add(stache);
  const ladle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), M(0x9aa0a8, { metalness: 0.7 })); ladle.position.set(0.5, 1.1, -0.35); ladle.rotation.x = -0.5; grp.add(ladle);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xffb43d, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5, toneMapped: false });
  const cone = new THREE.Mesh(new THREE.CircleGeometry(len, 28, Math.PI / 2 - half, half * 2), coneMat);
  cone.rotation.x = -Math.PI / 2; cone.position.y = 0.04; grp.add(cone);
  const coneEdge = new THREE.Mesh(new THREE.RingGeometry(len - 0.12, len, 28, 1, Math.PI / 2 - half, half * 2), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  coneEdge.rotation.x = -Math.PI / 2; coneEdge.position.y = 0.05; grp.add(coneEdge);
  // --- state
  const S = { x: o.path[0].x, z: o.path[0].z, h: 0, mode: 'patrol', walk: false, see: 0, exposure: 0, busy: false, seeing: false, get busyNow() { return busy(w.t); } };
  const occ = o.occluders || [];
  const blocked = (ax, az, bx, bz) => {
    for (const q of occ) {
      let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
      for (const [p, d, lo, hi] of [[ax, dx, q.x0, q.x1], [az, dz, q.z0, q.z1]]) {
        if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { t0 = 2; break; } continue; }
        let a = (lo - p) / d, b = (hi - p) / d; if (a > b) { const t = a; a = b; b = t; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      }
      if (t0 <= t1) return true;
    }
    return false;
  };
  const bar = o.bar;
  const tmpS = {};
  w.updaters.push((dt) => {
    stateAt(w.t, tmpS);
    S.x = tmpS.x; S.z = tmpS.z; S.walk = tmpS.walk; S.mode = tmpS.mode;
    // heading smoothing (the timeline snaps at the end of a bell trip)
    const dh = ang(S.h, tmpS.h); S.h += Math.abs(dh) > 2.5 ? dh : dh * Math.min(1, dt * 10);
    // the cone
    const p = g.player;
    S.seeing = false;
    if (g.state === 'playing' && Math.abs(p.y - y) < 2.6) {
      const dx = p.x - S.x, dz = p.z - S.z, d = Math.hypot(dx, dz);
      if (d < 1.0) S.seeing = true;
      else if (d < len && Math.abs(ang(S.h, hd(dx, dz))) < half && !blocked(S.x, S.z, p.x, p.z)) S.seeing = true;
    }
    S.exposure = Math.max(0, Math.min(1, S.exposure + (S.seeing ? dt / 0.9 : -dt / 1.6)));
    if (S.exposure >= 1 && g.state === 'playing') { S.exposure = 0; o.onSpot?.(); g.kill('chef'); }
  });
  w.hooks.frame = ((prev) => (dt, gg) => {
    prev?.(dt, gg);
    grp.position.set(S.x, y, S.z); grp.rotation.y = S.h;
    const bob = S.walk ? Math.sin(w.t * 9) * 0.05 : 0; bodyM.position.y = 0.95 + bob; head.position.y = 1.78 + bob; hat.position.y = 2.2 + bob; hatTop.position.y = 2.5 + bob;
    const ex = S.exposure;
    coneMat.color.setRGB(1, 0.71 - ex * 0.5, 0.24 - ex * 0.2); coneMat.opacity = 0.17 + ex * 0.4 + (S.mode === 'at' ? -0.08 : 0);
    if (bar) { bar.show(ex > 0.02); bar.set(ex, 'SPOTTED!', '#ff4d5e'); }
  })(w.hooks.frame);
  S.ring = (i) => c.emit('chef:bell', { i, t: +w.t.toFixed(3) });
  S.at = (t) => stateAt(t, {});
  return S;
}

// =================================================================================================================================
//  Bots
// =================================================================================================================================
/**
 * Like kit.botSteps but with carry-aware steps. A step is { x, z, r, face:[x,z], use, until, jump, then } (see kit.js) plus
 *   face: [x,z]  once arrived, look at that point (so E hits the station/partner), and
 * helpers: S.take(id) S.put(id) S.give() S.get(itemId) (wait until you hold it)
 */
export function dinnerBots(w, K, byRole) {
  const g = w.game, me = w.coop.me, P = w.coop.partner, steps = byRole[me] || [];
  let i = 0;
  const val = (v, d) => (typeof v === 'function' ? v() : v ?? d);
  w.botPlan = () => {
    const p = g.player;
    for (let guard = 0; guard < 40 && i < steps.length; guard++) {
      const s = steps[i];
      if (s.follow) { if (s.until && s.until()) { i++; s.then?.(); continue; } return null; }
      const tx = val(s.x, p.x), tz = val(s.z, p.z);
      const arrived = Math.hypot(tx - p.x, tz - p.z) < (s.r ?? 1.0);
      const done = s.until ? s.until() : arrived;
      if (done) { i++; s.then?.(); continue; }
      if (arrived && s.use) g.useFocus();
      if (arrived && s.face) { const fx = val(s.face[0], 0), fz = val(s.face[1], 0); return { x: fx, z: fz, wait: true }; }
      const stand = s.until && (arrived || s.x === undefined);
      return { x: tx, z: tz, wait: !!stand, jump: s.jump || false };
    }
    return null;
  };
  w.botIndex = () => i;
  w.botSetIndex = (n) => { i = n; };
}

/** Step builders for dinnerBots (each returns one step). */
export function stepsFor(w, K) {
  const me = w.coop.me, P = w.coop.partner;
  const st = (id) => K.stations.get(id);
  return {
    // walk next to a station and press E until you hold something (any item, or a given id)
    take: (id, item, r = 0.9) => { const s = st(id); const ap = s.approach || [s.x, s.z + 1.6]; return { x: ap[0], z: ap[1], r, face: [() => (st(id).pos(), st(id).x), () => st(id).z], use: true, until: () => (item ? K.held() === item : !!K.held()) }; },
    put: (id, r = 0.9) => { const s = st(id); const ap = s.approach || [s.x, s.z + 1.6]; return { x: ap[0], z: ap[1], r, face: [() => (st(id).pos(), st(id).x), () => st(id).z], use: true, until: () => !K.held() }; },
    // walk up to the partner and press E
    give: (r = 1.9) => ({ x: () => P.sx, z: () => P.sz, r, face: [() => P.sx, () => P.sz], use: true, until: () => !K.held() }),
    // stand still until you hold something
    get: (item) => ({ until: () => (item ? K.held() === item : !!K.held()) }),
    // wait for a station to hold an item
    waitAt: (id) => ({ until: () => !!K.at(id) }),
  };
}
