import * as THREE from 'three';
import { glowMaterial, plainMaterial, softTexture } from '../../engine/materials.js';
import { COL, plate } from './kit.js';

// Session 14 (The Campsite) building kit: ONE LANTERN in the dark.
//
//   light      the lantern. `holder` is a shared value (c.set): 'p1' | 'p2' | 'post:<id>' (hanging on a post).
//              In 'two' mode (the summit) both of you carry one.
//   plat       a platform that only EXISTS near a light. Drawn + solid within `r` metres of a source (the source is the HOLDER's synced
//              position, c.partner for the other machine), solid for a further 1 m margin and for 0.5 s after it goes dark, so a 100 ms
//              lag can never drop anyone. Outside the light you see a faint ghost outline: that is a platform you cannot trust.
//              Options: `who` ('p1'|'p2': only that player's light counts), `cond()` (0 no, 1 solid only, 2 shown+solid: extra rules such
//              as "within 6 m of your partner" or "drawbridge is down"), `post` (id: only that hanging lantern counts), `always`.
//   post       lantern post: E = take / hang / hand over (stand together). Throw pad for the long toss.
//   bridge     a drawbridge (lit platform that sinks away); `down()` decides.
//   fire       a campfire that grows while it is stoked.

export const R_LIT = 10, R_POST = 18, R_TWO = 8, MARGIN = 1, GRACE = 0.5;
const TINT = { p1: 0xffa24a, p2: 0x5fe0d0, post: 0xffd9a0 };
const GHOST = { any: 0x8aa2e8, p1: 0xff9a3d, p2: 0x39d7c9, post: 0xffd9a0 };

const boxDist = (b, x, y, z) => {                       // distance from a point to a box (x/z centre + half sizes, y range)
  const dx = Math.max(0, Math.abs(x - b.x) - b.hx), dz = Math.max(0, Math.abs(z - b.z) - b.hz);
  const dy = y < b.y0 ? b.y0 - y : y > b.y1 ? y - b.y1 : 0;
  return Math.hypot(dx, dy, dz);
};

export function makeLight(w, { posts = {} } = {}) {
  const c = w.coop, g = w.game, P = c.partner, me = c.me, other = c.other;
  const L = { posts, plats: [], mode: 'one', src: [], lit: true };
  L.holder = () => c.get('holder', 'post:0');
  L.pair = () => (P.has ? Math.hypot(P.sx - g.player.x, P.sz - g.player.z, (P.sy - g.player.y) * 0.6) : 99);
  L.pos = (who) => (who === me ? { x: g.player.x, y: g.player.y, z: g.player.z } : { x: P.sx, y: P.sy, z: P.sz });
  L.setMode = (m) => { L.mode = m; };
  c.on('lmode', (v) => { L.mode = v || 'one'; });
  L.nearPartner = (x, z, r = 4.6) => P.has && !P.dead && Math.hypot(P.sx - x, P.sz - z) < r;

  // ---- the lamp meshes (+ the only two real point lights) ----
  const lamps = [0, 1].map(() => {
    const grp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), glowMaterial(0xffd9a0, 2.4)); grp.add(core);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x3a2c20, wireframe: true })); grp.add(cage);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xffc880, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(1.4, 1.4, 1); grp.add(halo);
    const light = new THREE.PointLight(0xffc880, 0, 30, 1.5);
    grp.add(light);
    grp.visible = false; w.add(grp);
    return { grp, core, halo, light, on: 0 };
  });
  const setLamp = (l, x, y, z, color, on) => {
    l.grp.visible = on > 0.01; l.grp.position.set(x, y, z);
    l.core.material.color.setHex(color).multiplyScalar(2.4); l.halo.material.color.setHex(color); l.light.color.setHex(color);
    l.light.intensity = 38 * on;
  };

  // ---- one pass per frame: where the light is, then every platform ----
  const evalSources = () => {
    const out = [], h = L.holder();
    const add = (who, p, r, id) => out.push({ who, x: p.x, y: p.y + 1.0, z: p.z, r, id });
    if (L.mode === 'two') { add('p1', L.pos('p1'), R_TWO); add('p2', L.pos('p2'), R_TWO); }
    else if (h === 'p1' || h === 'p2') add(h, L.pos(h), R_LIT);
    else if (h && h.startsWith('post:')) { const p = posts[h.slice(5)]; if (p) add('post', { x: p.x, y: p.y + 2.4 - 1.0, z: p.z }, R_POST, h.slice(5)); }
    L.src = out;
  };
  let tAcc = 0;
  w.updaters.push((dt, t) => {
    tAcc = t;
    if (!L.lit) { L.src = [{ who: 'any', x: 0, y: 0, z: 0, r: 9999 }]; } else evalSources();
    // lamps
    const h = L.holder();
    const place = (who, l) => {
      const q = who === me ? g.player : { x: P.sx, y: P.sy, z: P.sz, yaw: P.yaw };
      const yaw = who === me ? g.yaw : P.yaw || 0;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      setLamp(l, q.x + fx * 0.6 + rx * 0.45, q.y + (who === me ? 1.05 : 1.15) + Math.sin(tAcc * 5 + (who === 'p1' ? 0 : 2)) * 0.02, q.z + fz * 0.6 + rz * 0.45, TINT[who], 1);
    };
    lamps[0].grp.visible = lamps[1].grp.visible = false; lamps[0].light.intensity = lamps[1].light.intensity = 0;
    if (L.mode === 'two') { place('p1', lamps[0]); place('p2', lamps[1]); }
    else if (h === 'p1' || h === 'p2') place(h, lamps[0]);
    else if (h && h.startsWith('post:')) { const p = posts[h.slice(5)]; if (p) setLamp(lamps[0], p.x, p.y + 2.4, p.z, TINT.post, 1.5); }
    // platforms
    const pulse = 0.5 + Math.sin(t * 2.2) * 0.5;
    for (const o of L.plats) {
      const b = o.box; if (o.moving) { /* the rest box is what the light sees */ }
      let vis = o.always, sol = o.always;
      if (!vis) {
        let best = Infinity;
        for (const s of L.src) {
          if (o.who && s.who !== o.who) continue;
          if (o.post && s.id !== o.post) continue;
          best = Math.min(best, boxDist(b, s.x, s.y, s.z) - s.r);
        }
        vis = best < 0; sol = best < MARGIN;
      }
      if (o.cond) { const k = o.cond(); vis = vis && k >= 2; sol = sol && k >= 1; }
      if (sol) o.t = GRACE; else o.t = Math.max(0, o.t - dt);
      const solid = sol || o.t > 0;
      const shown = (vis && solid) || (o.shown && o.t > 0 && solid);
      o.shown = shown;
      o.plat.body.enabled = solid;
      o.plat.group.visible = shown;
      o.ghost.visible = !shown;
      o.lineMat.opacity = (o.ghostA ?? 0.4) + pulse * 0.2;
      o.dim = solid && !shown;
    }
  });

  /** A lit platform. Same options as w.plat, plus who / cond / post / always / ghostA. */
  L.plat = (o) => {
    const plat = w.plat({ tex: 'wood', ...o });
    const wd = o.w ?? 4, dd = o.d ?? 4, hh = o.h ?? 1, y = o.y ?? 0;
    const box = { x: o.x ?? 0, z: o.z ?? 0, hx: wd / 2, hz: dd / 2, y0: y - hh, y1: y };
    const kind = o.who || (o.post ? 'post' : 'any');
    const col = GHOST[kind];
    const ghost = new THREE.Group(); ghost.position.set(box.x, y - hh / 2, box.z);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(wd, hh, dd)), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false }));
    const fill = new THREE.Mesh(new THREE.BoxGeometry(wd - 0.05, hh, dd - 0.05), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, depthWrite: false, toneMapped: false }));
    ghost.add(edges, fill); w.add(ghost);
    const rec = { plat, box, who: o.who || null, post: o.post || null, cond: o.cond || null, always: !!o.always, ghost, lineMat: edges.material, t: 0, shown: false, moving: !!o.moving, ghostA: o.ghostA };
    L.plats.push(rec);
    plat.lit = rec;
    return plat;
  };

  /** Lit stepping stones along -Z. cur = {x,y,z} (z = far edge so far); specs: {gap,d,w,dy,x|dx,...}; `common` extra plat options. Mutates cur. */
  L.trail = (cur, specs, common = {}) => {
    const out = [];
    for (const s of specs) {
      const d = s.d ?? 4, wd = s.w ?? 4.4, gap = s.gap ?? 2.4;
      cur.z -= gap; cur.y += s.dy ?? 0;
      if (s.x !== undefined) cur.x = s.x; else if (s.dx) cur.x += s.dx;
      out.push(L.plat({ ...common, ...(s.o || {}), x: cur.x, y: cur.y, z: cur.z - d / 2, w: wd, d, h: s.h ?? 1, path: common.path ?? true }));
      cur.z -= d;
    }
    return out;
  };

  /** Hang-the-lantern posts, stand-together handover, optional throw. Returns {id,x,y,z}. */
  L.post = (id, x, y, z, label = '') => {
    const post = { id, x, y, z };
    posts[id] = post;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.5, 8), plainMaterial(0x3a2c20, { roughness: 0.8 })); pole.position.set(x, y + 1.25, z); pole.castShadow = true; w.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), plainMaterial(0x3a2c20)); arm.position.set(x, y + 2.5, z); w.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), glowMaterial(0xffd9a0, 2.6)); bulb.position.set(x, y + 2.4, z); w.add(bulb);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), glowMaterial(0x7a4a2a, 0.9)); ember.position.set(x, y + 2.4, z); w.add(ember);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xffd9a0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); halo.position.set(x, y + 2.4, z); halo.scale.set(3.4, 3.4, 1); w.add(halo);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.75, 40), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.04, z); w.add(ring);
    w.updaters.push(() => {
      const on = L.holder() === 'post:' + id && L.mode === 'one';
      bulb.visible = halo.visible = on; ember.visible = !on;
    });
    const near = () => L.nearPartner(x, z);
    const act = () => {
      const h = L.holder();
      if (h === 'post:' + id) return { kind: 'take', text: 'Take the lantern' };
      if (h === me) return near() ? { kind: 'give', text: `Hand the lantern to ${c.names[other]}` } : { kind: 'hang', text: 'Hang the lantern here (to hand it over, stand together)' };
      return null;
    };
    let cool = 0;
    w.updaters.push((dt) => { cool = Math.max(0, cool - dt); });
    w.interactable({
      x, y: y + 1.5, z, w: 1.6, h: 3.2, d: 1.6, range: 4,
      enabled: () => !!act() && L.mode === 'one',
      label: () => { const a = act(); return a ? `${a.text}${label ? ' · ' + label : ''}` : ''; },
      onUse: () => {
        const a = act(); if (!a || cool > 0) return; cool = 0.8;
        c.set('holder', a.kind === 'take' ? me : a.kind === 'give' ? other : 'post:' + id);
        w.game.audio.confirm?.();
      },
    });
    return post;
  };

  // when I fall while carrying the lantern, my partner catches it (so the pair is not both left in the dark)
  let deaths = g.deaths || 0;
  w.updaters.push(() => {
    if ((g.deaths || 0) !== deaths) {
      deaths = g.deaths || 0;
      if (L.holder() === me && L.mode === 'one' && P.has) c.set('holder', other);
    }
  });
  return L;
}

/** A drawbridge: a lit platform (rest position = walkable) that sinks away. `down()` -> bool. */
export function bridge(w, L, o, down) {
  const { drop = 9, speed = 7 } = o;
  const st = { k: 0, plat: null };
  const plat = L.plat({ ...o, moving: true, cond: () => (st.k > 0.9 ? 2 : st.k > 0.05 ? 1 : 0), tex: 'wood', color: o.color ?? 0xb98a55 });
  st.plat = plat;
  w.updaters.push((dt) => {
    const t = down() ? 1 : 0;
    st.k += Math.sign(t - st.k) * Math.min(Math.abs(t - st.k), dt * speed / drop);
    plat.setPos(plat.base.x, plat.base.y - (1 - st.k) * drop, plat.base.z);
  });
  Object.defineProperty(st, 'up', { get: () => st.k > 0.95 });
  return st;
}

/** Campfire visual that grows with `level()` (0..1). */
export function fire(w, x, y, z, level) {
  const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.3, 6), plainMaterial(0x4a3326, { roughness: 0.9 }));
    log.position.set(Math.cos(a) * 0.45, 0.12, Math.sin(a) * 0.45); log.rotation.set(Math.PI / 2 - 0.2, 0, a + Math.PI / 2); g.add(log);
  }
  const flames = [0xff7a2a, 0xffb347, 0xffe08a].map((col, i) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.42 - i * 0.1, 1.5 - i * 0.2, 8), glowMaterial(col, 1.8, 0.9));
    m.position.y = 0.8; g.add(m); return m;
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xff9a4a, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 1.0; g.add(halo);
  w.updaters.push((dt, t) => {
    const v = level();
    flames.forEach((m, i) => { const s = 0.35 + v * (0.9 + 0.1 * Math.sin(t * 9 + i * 2)); m.scale.set(s, 0.3 + v * 0.9 + Math.sin(t * 7 + i) * 0.06, s); m.position.y = 0.2 + (0.6 + 0.2 * v) * m.scale.y; });
    halo.scale.setScalar(2.2 + v * 4.5); halo.material.opacity = 0.25 + v * 0.4;
  });
  return g;
}

/** Fire pad for one role. Pressed only while that role stands on it and does NOT hold the lantern (hands full). */
export function firePad(w, L, o) {
  const c = w.coop;
  const zn = plate(w, { x: o.x, y: o.y, z: o.z, size: o.size ?? 2.6, need: o.role, label: o.label, hold: 0 });
  const st = { zn, v: 0 };
  Object.defineProperty(st, 'pressed', { get: () => !!zn.active && L.holder() !== o.role });
  return st;
}
