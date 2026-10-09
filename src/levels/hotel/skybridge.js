import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { citySkyline, GOLD } from './kit.js';
import { onPlat } from '../common.js';
import { trollCheckpoint, fakeExit, evasiveGoal, fakeComplete, twistZone, vanishAfter, stageTitle, stageHint } from './trolls.js';

// Hotel level 19 — "Skybridge" (Impossible · Penthouse). FIRST FULL PASS. The hotel's rooftop, in a storm, with no sensible way across.
//   1 The Roof       air-conditioning units to hop, a gust to lean into
//   2 The Beam       a 36 m beam in a crosswind (a pennant tells you which way it blows, and it changes half way)
//   3 Cable Cars     five cars on cables; wait for them to line up
//   4 Lightning Rods crumbling rods, a fake checkpoint, a mirrored mouse, a rod that gives way once you are half over
//   5 The Helipad    a decoy "EXIT" helipad ring, a goal that runs away twice, and an A+ that is not
// Lightning: three flickers of warning, then a white-out. Only ever while you stand on something wide. Thunder is no louder than before.

const NAMES = ['The Roof', 'The Beam', 'Cable Cars', 'Lightning Rods', 'The Helipad'];

export default {
  id: 'hotel-19',
  name: 'Skybridge',
  music: 'hotel_storm',
  completeQuip: 'You crossed the roof in a thunderstorm. The roof asked for an apology. It will not get one.',

  build(w, game) {
    w.env({
      top: 0x04050e, horizon: 0x1c2438, bottom: 0x06070d,
      fog: { color: 0x141a2a, near: 40, far: 230 },
      sun: { color: 0x9db4ff, intensity: 0.5, dir: [-0.4, 0.8, 0.5], shadow: false },
      hemi: { sky: 0x8aa0d8, ground: 0x3a3a50, intensity: 0.7 },
      exposure: 0.95, stars: 0.2,
      clouds: { count: 30, color: 0x3a4258, y: [-10, 40], radius: [60, 260], opacity: 0.55, size: [40, 110] },
      bloom: { strength: 0.5, radius: 0.7, threshold: 0.95 },
      motes: { color: 0xaec4ff, count: 100, size: 0.06, opacity: 0.35 },
    });
    w.setTheme({ tex: 'stone', color: 0xd6cfc0, trim: null, edge: null, edgeOpacity: 0, roughness: 0.75, metalness: 0, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.spawn = { x: 0, y: 0, z: 10, yaw: 0 }; w.respawn = { ...w.spawn };
    w.killY = -42;
    citySkyline(w);
    w.windLevel = 0.3;

    const stages = NAMES.map(() => ({ at: null, route: [] }));
    const cps = new Map();
    const mark = (p) => { p.o.path = true; return p; };
    const hop = (i, p) => { mark(p); stages[i].route.push({ x: p.body.x, y: p.top, z: p.body.z }); return p; };
    const start = (i, p) => { mark(p); stages[i].at = { x: p.body.x, y: p.top, z: p.body.z }; return p; };
    const cp = (i, x, y, z) => { cps.set(w.checkpoint({ x, y, z, real: true }), i); };
    const roof = (x, z, ww, dd, y = 0) => w.plat({ x, y, z, w: ww, d: dd, h: 1.2, tex: 'stone', color: 0xcfc6b2, roughness: 0.8 });
    const slab = (x, y, z, ww, dd, o = {}) => w.plat({ x, y, z, w: ww, d: dd, h: o.h ?? 0.5, tex: o.tex ?? 'stone', color: o.color ?? 0xb8b0a0, roughness: 0.8, ...o });
    const tower = (p) => w.box({ x: p.body.x, y: -20, z: p.body.z, w: Math.max(1, p.o.w - 0.4), h: 40, d: Math.max(1, p.o.d - 0.4), color: 0x2a2f3c, rough: 0.9, shadow: false });

    // ===== 1 · the roof
    start(0, roof(0, 8, 14, 12)); w.box({ x: 0, y: -22, z: 8, w: 13, h: 44, d: 11, color: 0x2a2f3c, rough: 0.9, shadow: false });
    hop(0, slab(-2.2, 1.1, 3.0, 2.4, 2.4, { h: 1.1, tex: 'metal', color: 0x9aa0aa }));
    hop(0, slab(2.0, 1.4, -1.2, 2.4, 2.4, { h: 1.5, tex: 'metal', color: 0x9aa0aa }));
    const B1 = start(1, roof(0, -7.5, 8, 6)); tower(B1); cp(1, 0, 0, -7.5);

    // ===== 2 · the beam: 36 m, one rail, a crosswind that turns around (the pennant says which way)
    const BZ0 = -11, BZ1 = -47;
    const beam = hop(1, slab(0, 0, (BZ0 + BZ1) / 2, 1.5, BZ0 - BZ1, { h: 0.5, tex: 'metal', color: 0x8a8d95 }));
    w.box({ x: -0.95, y: 0.9, z: (BZ0 + BZ1) / 2, w: 0.06, h: 0.06, d: BZ0 - BZ1, color: 0xb9a15a, metal: 1, rough: 0.3, shadow: false });
    w.box({ x: -0.95, y: 0.4, z: (BZ0 + BZ1) / 2, w: 0.06, h: 0.7, d: BZ0 - BZ1, color: 0x2a2f3c, shadow: false });   // (a rail only on the west side)
    const wx1 = w.wind({ x: 0, y: 1.2, z: -20, w: 8, h: 4, d: 14, dx: -1, dz: 0, strength: 9, period: 6.5, on: 2.4, phase: 0 });
    const wx2 = w.wind({ x: 0, y: 1.2, z: -38, w: 8, h: 4, d: 14, dx: 1, dz: 0, strength: 9, period: 6.5, on: 2.4, phase: 3.2 });
    const pennant = (z, dirx) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.04), glowMaterial(0xffd9a0, 1.2)); m.position.set(1.6, 2.4, z); w.add(m); const pole = w.box({ x: 1.6, y: 1.2, z, w: 0.06, h: 2.4, d: 0.06, color: GOLD, metal: 1, shadow: false }); void pole; return m; };
    const pn1 = pennant(-14, -1), pn2 = pennant(-32, 1);
    const flag = (m, wi, dirx, t) => { const k = wi.period ? (((t + wi.phase) % wi.period) / wi.period) : 0; const warn = ((t + wi.phase + 0.9) % wi.period) < wi.on; m.rotation.z = (wi.active ? 1.0 : warn ? 0.45 : 0.05) * -dirx; m.position.x = 1.6 + (wi.active ? dirx * 0.3 : 0); void k; };
    w.onUpdate((dt, t) => { flag(pn1, wx1, -1, t); flag(pn2, wx2, 1, t); });
    w.sign({ text: 'CROSSWIND ▸ WATCH THE FLAG', x: 0, y: 3.4, z: -10.4, w: 7, h: 0.9, color: '#ffd9a0', double: false, tw: 1024, size: 56, glow: true });
    const C1 = start(2, roof(0, -52, 8, 6)); tower(C1); cp(2, 0, 0, -52);

    // ===== 3 · cable cars
    const cars = [];
    for (let i = 0; i < 6; i++) {
      const z = -61.0 - i * 7.2, ph = i * 1.4;
      const car = hop(2, slab(0, 0, z, 3.2, 3.2, { h: 0.5, tex: 'metal', color: 0xb9a15a, moving: true }));
      w.mover(car, (t) => ({ z: 2.4 * Math.sin(t * 0.9 + ph) }));
      const cable = w.box({ x: 0, y: 4.5, z, w: 0.06, h: 0.06, d: 12, color: 0x20242e, shadow: false }); void cable;
      cars.push(car);
    }
    const D1 = start(3, roof(0, -104, 8, 6)); tower(D1);
    trollCheckpoint(w, game, { x: 0, y: 0, z: -104, mode: 'expire', ttl: 30, say: 'hotel.l19.expired' });

    // ===== 4 · lightning rods
    trollCheckpoint(w, game, { x: 0, y: 0, z: -107.4, mode: 'fake' });
    [[-1.2, -112], [1.2, -116.2], [-1.2, -120.4], [1.2, -124.6], [0, -128.8]].forEach(([x, z]) => { hop(3, w.crumble(slab(x, 0, z, 2.0, 2.0, { h: 0.4 }), { delay: 0.45, gone: 3.2 })); });
    const rod = hop(3, slab(0, 0, -137, 1.6, 8, { h: 0.4, tex: 'metal', color: 0x8a8d95 }));
    vanishAfter(w, game, rod, { axis: 'z', dir: -1, frac: 0.5, delay: 0.7, back: 3.2, say: 'hotel.l19.rod' });
    const E1 = start(4, roof(0, -146, 8, 6)); tower(E1); cp(4, 0, 0, -146);
    twistZone(game, w, { x: 0, y: 2, z: -116.2, w: 5, h: 4, d: 3 }, 'mouseX', { sec: 6, say: 'hotel.l19.mirror' });

    // ===== 5 · the helipad
    const HP = roof(0, -165, 16, 24); tower(HP); mark(HP);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.12, 8, 48), glowMaterial(0xffd9a0, 1.0)); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.07, -165); w.add(ring);
    w.sign({ text: 'H', x: 0, y: 0.06, z: -165, w: 5, h: 5, rotX: -Math.PI / 2, color: '#ffd9a0', double: false, tw: 256, size: 220 });
    fakeExit(w, game, { x: 5.5, y: 0, z: -158, kind: 'goal', label: 'EXIT', say: 'hotel.l19.decoy' });
    const runner = evasiveGoal(w, game, {
      spots: [{ x: 0, y: 0, z: -172 }, { x: -5, y: 0, z: -160 }, { x: 4, y: 0, z: -170 }], radius: 5, color: GOLD, say: ['hotel.l19.hop1', 'hotel.l19.hop2'],
      onReach: () => { if (!fakeComplete(game, w, { title: 'ROOF CLEARED', say: 'hotel.l19.fakewin', then: () => { w.goalObj = real; real.group.visible = true; real.trig.enabled = true; game.say('hotel.l19.again', { priority: 2 }); } })) game.completeLevel(); },
    });
    const real = w.goal({ x: -6, y: 0, z: -174, color: GOLD, onReach: () => { game.say('hotel.l19.done', { priority: 2 }); game.completeLevel(); } });
    real.group.visible = false; real.trig.enabled = false;
    w.goalObj = runner;

    // ---- the storm: rain, and lightning that whites the screen only while you stand on something wide ---------------------------------
    const flash = document.createElement('div'); flash.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:4';
    document.getElementById('app').appendChild(flash); w.onDispose(() => flash.remove());
    const st = { next: 14, warn: [], strike: -1, flick: 0, flashA: 0 };
    const hemiBase = w.hemi.intensity;
    const wide = (p) => p.grounded && p.ground && p.ground.hx * 2 >= 6 && p.ground.hz * 2 >= 4;
    w.onRespawn(() => { flash.style.opacity = '0'; st.flick = st.flashA = 0; });
    w.onUpdate((dt, t) => {
      const p = game.player;
      if (game.state === 'playing' && !game.frozen && p.z < -50) {
        if (st.strike < 0 && t > st.next) { st.strike = t + 1.7; st.warn = [t + 0.2, t + 0.8, t + 1.35]; game.say('hotel.l19.flicker', { priority: 0 }); }
        if (st.strike >= 0) {
          while (st.warn.length && t >= st.warn[0]) { st.warn.shift(); st.flick = 0.3; }
          if (t >= st.strike) { if (wide(p)) { st.flashA = 1; st.next = t + 14 + Math.random() * 6; st.strike = -1; setTimeout(() => game.audio.rumble?.(1.6), 800); } else st.strike = t + 0.4; }
        }
      }
      st.flick = Math.max(0, st.flick - dt * 3); st.flashA = Math.max(0, st.flashA - dt * 1.6);
      flash.style.opacity = String(Math.max(st.flick * 0.6, st.flashA * (game.baby ? 0.4 : 0.9)));
      w.hemi.intensity = hemiBase + st.flashA * 2 + st.flick;
    });

    // ---- host, hint, bot ------------------------------------------------------------------------------------------------------------
    w.hooks.onCheckpoint = (c) => { const i = cps.get(c); if (i !== undefined) stageTitle(game, w, i + 1, NAMES.length, NAMES[i]); };
    let t0 = 0, intro = false;
    w.hooks.frame = (dt, g) => { if (g.state !== 'playing') return; t0 += dt; if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l19.intro'); stageTitle(g, w, 1, NAMES.length, NAMES[0]); } };
    onPlat(w, B1, () => game.say('hotel.l19.beam'));
    onPlat(w, C1, () => game.say('hotel.l19.cars'));
    onPlat(w, D1, () => game.say('hotel.l19.rods'));
    onPlat(w, E1, () => game.say('hotel.l19.pad'));
    w.hooks.onDeath = () => { if (Math.random() < 0.6) { game.say('hotel.l19.fall', { priority: 1 }); return true; } return false; };
    stageHint(w, stages);
    // the bot: waits in the lee until a gust is over, and rides the cars when two line up
    w.botPlan = (g) => {
      const p = g.player;
      if (p.z < -9 && p.z > -48 && p.y < 1) {                       // the beam: wait for the gust to pass (including the warning)
        for (const wi of [wx1, wx2]) { const ph = (w.t + wi.phase) % wi.period; const inz = Math.abs(p.z - wi.body.z) < 9; if (inz && (ph < wi.on + 0.4 || ph > wi.period - 1.0)) return { x: p.x, z: p.z, wait: true }; }
        return { x: 0, z: -52 };
      }
      const on = cars.findIndex((c) => p.ground === c.body);
      if (on >= 0 || (p.ground === C1.body && p.z < -50.5)) {
        const next = on < 0 ? cars[0] : cars[on + 1] || D1;
        const cur = on < 0 ? C1.body : cars[on].body;
        const gapEdge = Math.abs(next.body.z - cur.z) - next.body.hz - cur.hz;
        if (gapEdge < 2.6 && p.grounded) return { body: next.body };
        return { x: p.x, z: p.z, wait: true };
      }
      return null;
    };
    w.skybridge = { cars, wx1, wx2, runner, real, get cp() { return cps; } };
    void beam;
  },
};
