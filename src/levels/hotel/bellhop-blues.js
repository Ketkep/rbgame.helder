import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture } from '../../engine/materials.js';
import { hotelEnv, hotelHalo, GOLD } from './kit.js';
import { onPlat } from '../common.js';
import { fakeComplete, fakeExit, twistZone, trollCheckpoint, stageTitle, stageHint } from './trolls.js';

// Hotel level 5 — "Bellhop Blues" (Easy · Mezzanine). A chase through the back of house: a gigantic brass service bell rolls
// after you. Five stages, each ending in a fire shutter that slams behind you; the bell waits behind it a few seconds, then
// bursts through (that is the checkpoint rhythm: every stage starts the same way, so the checkpoints are fair).
//   1 Service Corridor  laundry bags, a crossing cart, two belts (the EXPRESS one lies: read the chevrons), wet marble, trolleys
//   2 The Laundry        down the laundry chute; washers over the suds, a FAKE checkpoint (crooked pole), a sweeping sheet, the press
//   3 Kitchen Pass       W/S swapped while the bell waits, a STAFF EXIT that is a closet, carts, the fryer, heat lamps, the mop
//   4 Service Stairs     a flight, a flight under renovation, the luggage gondola, the freight elevator: LEVEL COMPLETE… OUT OF ORDER
//   5 Sub-Basement       the elevator went down; catwalks over the boiler, steam, a painted EXIT, and the dumbwaiter (the real one)
// Baby Mode: the bell is slower and waits longer at every shutter, the fake checkpoint counts, the twist is short, the decoys are labelled.

const NAMES = ['Service Corridor', 'The Laundry', 'Kitchen Pass', 'Service Stairs', 'Sub-Basement'];
const HW = 4;                                      // corridor half-width (inside the walls)
const BELL = { across: 7.4, along: 3.0, h: 3.6 };   // the bell's kill box (it fills the corridor: there is no way round it)
const MAXGAP = 16, CATCHUP = 7.5;                   // it never falls further behind than this (it hurries to catch up)
const Y5 = -21.2;                                   // the sub-basement floor
const Z = { start: 16.5, chute0: -61, chute1: -65, d2: -138.5, d3: -215.5, shaftS: -263.5, shaftN: -268.5, end: -330.5 };

export default {
  id: 'hotel-5',
  name: 'Bellhop Blues',
  music: 'hotel2',
  completeQuip: 'The bell is still outside. It is not angry. It is patient. There is a difference. It is worse.',

  build(w, game) {
    hotelEnv(w);
    w.scene.fog.near = 28; w.scene.fog.far = 130;                // a back of house is not a lobby: you see one stage at a time
    w.setTheme({ tex: 'tile', color: 0xffffff, trim: null, edge: null, edgeOpacity: 0, roughness: 0.55, metalness: 0, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.spawn = { x: 0, y: 0, z: 12.5, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -40;
    const baby = () => game.baby;

    // ---- building pieces ---------------------------------------------------------------------------------------
    const walls = (zs, zn, y0, y1, tex, color) => { for (const s of [-1, 1]) w.plat({ x: s * (HW + 0.5), y: y1, z: (zs + zn) / 2, w: 1, d: zs - zn, h: y1 - y0, tex, color, roughness: 0.6 }); };
    const ceil = (zs, zn, y, color = 0xd9ddd6) => w.plat({ x: 0, y: y + 0.6, z: (zs + zn) / 2, w: 2 * HW + 2, d: zs - zn, h: 0.6, tex: 'coffer', color, roughness: 0.8 });
    const wallAcross = (z, y0, y1, tex, color) => w.plat({ x: 0, y: y1, z, w: 2 * HW + 2, d: 1, h: y1 - y0, tex, color, roughness: 0.6 });
    const floor = (zs, zn, y, o = {}) => w.plat({ x: o.x ?? 0, y, z: (zs + zn) / 2, w: o.w ?? 2 * HW, d: zs - zn, h: o.h ?? 2.4, tex: o.tex ?? 'tile', color: o.color ?? 0xe9eee9, roughness: o.rough ?? 0.5, radius: 0.04, slippery: o.slippery ?? 0 });
    const stripe = (z, y, ww = 7.6) => w.box({ x: 0, y: y + 0.012, z, w: ww, h: 0.02, d: 0.16, color: 0xffd21f, shadow: false });

    // a liquid you must not touch: bleach, suds, fryer oil, wet cement, the boiler (a wide kill slab under a visible surface)
    const LIQ = {
      bleach: { color: 0x9fe8c8, emissive: 0x1d6a4a, opacity: 0.86 },
      suds: { color: 0xd8ecff, emissive: 0x3a5a80, opacity: 0.92 },
      oil: { color: 0xd88a20, emissive: 0x6a2a00, opacity: 0.9 },
      cement: { color: 0x8a8a86, emissive: 0x111111, opacity: 1 },
      boiler: { color: 0x4aa0c8, emissive: 0x1a4a6a, opacity: 0.85 },
    };
    const liquids = [];
    const pool = (zs, zn, top, kind) => {
      const d = zs - zn, zc = (zs + zn) / 2, L = LIQ[kind];
      const hz = w.hazard({ x: 0, y: top - 0.35, z: zc, w: 2 * HW + 0.4, h: 0.7, d, color: L.color });
      hz.core.visible = false; hz.shell.visible = false; hz.liquid = kind;
      w.box({ x: 0, y: top - 1.3, z: zc, w: 2 * HW, h: 1.2, d, color: 0x16181c, rough: 0.9, shadow: false });     // the basin
      const mat = new THREE.MeshStandardMaterial({ color: L.color, emissive: L.emissive, emissiveIntensity: 0.55, roughness: kind === 'cement' ? 0.95 : 0.08, metalness: 0.1, transparent: L.opacity < 1, opacity: L.opacity });
      const surf = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW, d), mat); surf.rotation.x = -Math.PI / 2; surf.position.set(0, top, zc); w.add(surf);
      liquids.push({ mat, kind, base: 0.55 });
      return hz;
    };
    w.onUpdate((dt, t) => { for (const l of liquids) l.mat.emissiveIntensity = l.base + 0.12 * Math.sin(t * (l.kind === 'boiler' ? 3.1 : 1.4)); });

    // a full-width fire shutter (slams down behind you; the bell bursts through it a few seconds later)
    const shutter = (z, y, { label = 'FIRE SHUTTER', axis = 'y', width = 2 * HW, height = 4.2 } = {}) => {
      const g = new THREE.Group(); g.position.set(0, y, z); w.add(g);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? width : width, axis === 'x' ? 0.3 : height, axis === 'x' ? 4 : 0.3), plainMaterial(0x7a808c, { metalness: 0.7, roughness: 0.4 }));
      slab.position.y = axis === 'x' ? -0.15 : height / 2; slab.castShadow = true; g.add(slab);
      if (axis === 'y') {
        for (let k = 0; k < 7; k++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, 0.36), plainMaterial(0x5a606c, { metalness: 0.7, roughness: 0.4 })); rib.position.y = 0.4 + k * 0.6; g.add(rib); }
        for (let k = 0; k < 8; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(width / 8, 0.22, 0.34), plainMaterial(k % 2 ? 0x111111 : 0xffd21f, { roughness: 0.5 })); st.position.set(-width / 2 + width / 16 + k * width / 8, 0.12, 0); g.add(st); }
        const sg = w.sign({ text: label, x: 0, y: 0, z: 0, w: 3.6, h: 0.6, color: '#ffd21f', double: true, tw: 512, size: 70 });
        w.scene.remove(sg); sg.position.set(0, height - 0.6, 0.17); g.add(sg);
      }
      const body = axis === 'x' ? w.collider({ x: 0, y: y - 0.15, z, w: width, h: 0.3, d: 4 }) : w.collider({ x: 0, y: y + height / 2, z, w: width, h: height, d: 0.3 });
      const s = { closed: true, k: 1, target: 1, shake: 0, g, body };
      const place = () => {
        if (axis === 'y') g.position.y = y + (1 - s.k) * (height + 0.2);
        else g.position.x = (1 - s.k) * (width + 1.5);
        g.visible = s.k > 0.02;
        g.position.z = z + (s.shake > 0 ? (Math.random() - 0.5) * 0.06 : 0);
      };
      s.set = (closed, instant = false) => { s.closed = closed; s.target = closed ? 1 : 0; body.enabled = closed; if (instant) { s.k = s.target; place(); } };
      s.update = (dt) => {
        if (s.k !== s.target) { s.k = s.target > s.k ? Math.min(1, s.k + dt * 7) : Math.max(0, s.k - dt * 2.2); place(); }
        if (s.shake > 0) { s.shake -= dt; place(); }
      };
      return s;
    };

    // ---- the route: stages[i].at = the stage's checkpoint, .route = what the hint follows (never past the next stage) -------
    const stages = NAMES.map(() => ({ at: null, route: [] }));
    const path = (i, p, pts) => { p.o.path = true; for (const q of pts || [{ x: p.body.x, y: p.top, z: p.body.z }]) stages[i].route.push(q); return p; };
    const cps = new Map();
    const stageCp = (i, x, y, z) => {
      const c = w.checkpoint({ x, y, z, real: true });
      cps.set(c, i); stages[i].at = { x, y, z };
      // the flag is in the middle of a wide corridor: the whole width counts, so nobody runs past it
      w.trigger({ x: 0, y: y + 1.6, z, w: 2 * HW, h: 3.4, d: 2.4, once: false, onEnter: () => { if (c.used) return; c.used = true; w.burst(new THREE.Vector3(x, y + 0.4, z), 0xffc83d, 24); game.onCheckpoint(c); } });
      return c;
    };
    stages[0].at = { x: 0, y: 0, z: 12.5 };
    const legs = (x, z, top, ww, dd, bottom) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) w.box({ x: x + sx * (ww / 2 - 0.12), y: (top - 0.1 + bottom) / 2, z: z + sz * (dd / 2 - 0.12), w: 0.1, h: top - 0.1 - bottom, d: 0.1, color: GOLD, metal: 1, rough: 0.3, shadow: false }); };

    // ============================ stage 1 · service corridor (y 0) ==============================================
    walls(23, -66, -3, 6, 'tile', 0xcfe0d6);
    ceil(23, -66, 6);
    wallAcross(23.5, -3, 6, 'tile', 0xcfe0d6);                    // the back of the bell's garage
    wallAcross(Z.start, 4.2, 6, 'tile', 0xcfe0d6);                  // lintel over the start shutter
    wallAcross(-65.5, -3, 6, 'tile', 0xcfe0d6);                     // the end of the corridor (the way on is down)
    floor(23, Z.start, 0, { color: 0x9aa59e });                     // the garage (where the bell lives)
    const F0 = path(0, floor(Z.start, 5, 0, { tex: 'carpet', color: 0xffffff, rough: 0.9 }));
    w.sign({ text: 'STAFF ONLY', x: 0, y: 0.02, z: 13.5, w: 3.4, h: 0.9, rotX: -Math.PI / 2, color: '#ffd21f', double: false, tw: 512, size: 80 });
    const F1 = path(0, floor(5, -8, 0));
    // a wall of laundry bags (hop it)
    w.plat({ x: 0, y: 0.85, z: 2.5, w: 2 * HW, d: 0.9, h: 0.85, tex: 'curtain', color: 0xf2eee4, roughness: 0.95, radius: 0.3 });
    // a room-service cart that crosses the corridor (low: hop it)
    const cart = (z, y, A, om, ph) => {
      const hz = w.hazard({ x: 0, y: y + 0.5, z, w: 1.5, h: 1.0, d: 1.1, color: 0xff3a46, move: (t) => ({ x: A * Math.sin(t * om + ph) }) });
      hz.core.visible = false; hz.shell.visible = false; hz.jumpable = true;
      cartVisual(hz.group);
      return hz;
    };
    cart(-3.2, 0, 2.6, 1.7, 0);
    // two belts. The gold EXPRESS one runs backwards (the chevrons say so); the plain STAFF one carries you
    const beltL = w.plat({ x: -2.05, y: 0, z: -15, w: 3.9, d: 14, h: 1.0, tex: 'metal', color: 0x4a5160, roughness: 0.5, metalness: 0.5, radius: 0.03 });
    w.conveyor(beltL, { vz: 5.0, color: 0x3a2a12 });
    const beltR = path(0, w.plat({ x: 2.05, y: 0, z: -15, w: 3.9, d: 14, h: 1.0, tex: 'metal', color: 0x4a5160, roughness: 0.5, metalness: 0.5, radius: 0.03 }), [{ x: 2, y: 0, z: -9 }, { x: 2, y: 0, z: -20 }]);
    w.conveyor(beltR, { vz: -3.5 });
    w.box({ x: 0, y: 0.03, z: -15, w: 0.2, h: 0.06, d: 14, color: GOLD, metal: 1, rough: 0.3, shadow: false });
    const expressSign = w.sign({ text: '▲ EXPRESS ▲', x: -2.05, y: 0.03, z: -7.2, w: 3.6, h: 1.0, rotX: -Math.PI / 2, color: '#ffd23f', double: false, tw: 512, size: 92, glow: true });
    w.sign({ text: 'STAFF', x: 2.05, y: 0.03, z: -7.2, w: 2.6, h: 0.8, rotX: -Math.PI / 2, color: '#9aa0a8', double: false, tw: 512, size: 92 });
    for (const sx of [-1, 1]) w.box({ x: -2.05 + sx * 1.6, y: 5.25, z: -6.9, w: 0.05, h: 1.5, d: 0.05, color: 0x8a8a96, metal: 0.8, rough: 0.3, shadow: false });
    w.sign({ text: '▲ EXPRESS LANE ▲  (complimentary)', x: -2.05, y: 4.2, z: -6.9, w: 3.8, h: 0.7, color: '#ffd23f', double: true, tw: 1024, size: 60, glow: true });
    if (game.baby) w.sign({ text: '(it runs backwards)', x: -2.05, y: 3.6, z: -6.9, w: 3.6, h: 0.5, color: '#ffb48a', double: true, tw: 1024, size: 56 });
    const F2 = path(0, floor(-22, -26, 0));
    // wet marble over a bleach pit: three slabs, a slalom
    pool(-26, -41, -2.2, 'bleach');
    const marble = (x, zs, zn) => path(0, floor(zs, zn, 0, { x, w: 3.6, tex: 'marble', color: 0xd0d0dc, rough: 0.14, slippery: 0.88, h: 0.5 }));
    const M1 = marble(-2.2, -26, -31), M2 = marble(2.2, -31, -36), M3 = marble(-2.2, -36, -41);      // no straight line through: zig, zag, zig
    for (const [x, z] of [[-2.2, -28.5], [2.2, -33.5], [-2.2, -38.5]]) w.box({ x, y: -1.35, z, w: 0.5, h: 1.7, d: 0.5, color: 0x8a8a96, rough: 0.4, shadow: false });
    const F3 = path(0, floor(-41, -45, 0));
    // the trolley bridge (the third one has wheels. It uses them)
    pool(-45, -56.8, -2.2, 'bleach');
    const trolley = (x, z, top, ww = 2.0, dd = 1.8) => { const p = w.plat({ x, y: top, z, w: ww, d: dd, h: 0.12, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.03 }); legs(x, z, top, ww, dd, -2.6); return p; };
    const Tr1 = path(0, trolley(-2.0, -47.0, 0.6));
    const Tr2 = path(0, trolley(1.2, -50.2, 0.9));
    const Tr3 = path(0, w.plat({ x: -1.4, y: 0.9, z: -53.6, w: 2.2, d: 2.0, h: 0.12, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.03 }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) Tr3.attach(w.box({ x: -1.4 + sx * 0.95, y: 3.15, z: -53.6 + sz * 0.85, w: 0.08, h: 4.5, d: 0.08, color: GOLD, metal: 1, rough: 0.28, static: false }));
    Tr3.attach(w.box({ x: -1.4, y: 5.55, z: -53.6, w: 2.4, h: 0.3, d: 1.2, color: 0x3a3f4a, metal: 0.8, rough: 0.35, static: false }));
    w.box({ x: 0, y: 5.85, z: -53.6, w: 2 * HW, h: 0.3, d: 0.4, color: 0x4a5160, metal: 0.8, rough: 0.4, shadow: false });     // the ceiling rail it hangs from
    w.rollaway(Tr3, { dir: [1, 0], dist: 3.6, accel: 3.5, speed: 5.0, delay: 0.75, hold: 2.6, back: 1.8, onGo: () => game.say('hotel.l5.trolley', { priority: 1 }) });
    const F4 = path(0, floor(-56.8, Z.chute0, 0));
    // the laundry chute: the floor stops. The way on is down
    w.sign({ text: 'LAUNDRY ▼', x: 0, y: 4.6, z: -64.95, w: 3.4, h: 0.9, color: '#bfe4ff', double: false, tw: 512, size: 92, glow: true });
    for (const sx of [-1, 1]) w.box({ x: sx * 3.9, y: 0.6, z: -63, w: 0.1, h: 1.2, d: 4, color: 0xffd21f, metal: 0.3, rough: 0.4, shadow: false });
    stripe(Z.chute0 + 0.1, 0); stripe(-56.6, 0); stripe(-41.2, 0); stripe(-25.8, 0); stripe(-44.8, 0); stripe(-22.2, 0);
    void F0; void F1; void F2; void F3; void F4; void M1; void M2; void M3; void Tr1; void Tr2;

    // ============================ stage 2 · the laundry (y -9) ==================================================
    const Y2 = -9;
    walls(-60, -139, -11.5, -3, 'tile', 0xc8dcef);
    ceil(-66, -139, -3);
    wallAcross(-60.5, -11.5, -2.4, 'tile', 0xc8dcef);                    // (the chute's south face, under the corridor floor)
    const pile = path(1, floor(Z.chute0, -66, -8.85, { tex: 'curtain', color: 0xf4f1ea, rough: 0.95, h: 2.6 }));
    for (const [x, z, r] of [[-2.6, -61.8, 0.7], [2.8, -64.6, 0.9], [-3.2, -64.9, 0.6], [1.9, -61.6, 0.5]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), plainMaterial(0xf6f1e8, { roughness: 1 })); m.scale.y = 0.55; m.position.set(x, -8.85 + r * 0.3, z); w.add(m); }
    const F5 = path(1, floor(-66, -71, Y2, { color: 0xdfe9f2 }));
    stageCp(1, 0, Y2, -68.5);
    pool(-71, -119.5, -9.6, 'suds');
    const washer = (x, z, top, o = {}) => {
      const p = w.plat({ x, y: top, z, w: o.w ?? 1.8, d: o.d ?? 1.8, h: top + 10.6, tex: 'metal', color: o.color ?? 0xf2f4f6, roughness: 0.3, metalness: 0.4, radius: 0.08 });
      const door = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 10, 28), plainMaterial(0xb8c0c8, { metalness: 0.9, roughness: 0.2 })); door.position.set(x, top - 0.7, z + (o.d ?? 1.8) / 2 + 0.03);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), plainMaterial(0x6aa8d8, { roughness: 0.05, metalness: 0.2 })); glass.position.copy(door.position); glass.position.z += 0.01;
      if (o.spin) { p.attach(door); p.attach(glass); } else { w.add(door); w.add(glass); }
      return p;
    };
    const W1 = path(1, washer(-2.5, -73.4, -8.0));
    const W2 = path(1, washer(-2.5, -76.6, -8.0));
    const W3 = path(1, w.crumble(washer(0.2, -79.6, -8.0, { color: 0xe8eef4, spin: true }), { delay: 0.6, gone: 3 }));      // the spin cycle
    const W4 = path(1, washer(2.6, -82.6, -8.0));
    const table = path(1, w.plat({ x: 0.4, y: -8.0, z: -89, w: 2.6, d: 8, h: 0.25, tex: 'wood', color: 0xd9c6a4, roughness: 0.7, radius: 0.04 }), [{ x: 0.4, y: -8, z: -86 }, { x: 0.4, y: -8, z: -92 }]);
    for (const sx of [-1, 1]) for (const z of [-85.4, -89, -92.6]) w.box({ x: 0.4 + sx * 1.1, y: -9.05, z, w: 0.12, h: 1.9, d: 0.12, color: 0x8a8a96, metal: 0.6, rough: 0.4, shadow: false });
    trollCheckpoint(w, game, { x: 0.4, y: -8.0, z: -87.6, mode: 'fake' });                // the crooked pole: freshly laundered, not saved
    // a sheet on the overhead rail sweeps across the table
    const sheet = w.hazard({ x: 0.4, y: -6.4, z: -90.9, w: 1.5, h: 2.3, d: 0.2, color: 0xffffff, move: (t) => ({ x: 3.0 * Math.sin(t * 1.3) }) });
    sheet.core.visible = false; sheet.shell.visible = false;
    { const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.3, 6, 6), plainMaterial(0xfdfbf6, { roughness: 1 })); sm.material.side = THREE.DoubleSide; sheet.group.add(sm);
      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.5, 0.08), plainMaterial(0x8a8a96, { metalness: 0.8, roughness: 0.3 })); hook.position.y = 2.4; sheet.group.add(hook);
      w.box({ x: 0, y: -3.4, z: -90.9, w: 2 * HW, h: 0.14, d: 0.14, color: 0x8a8a96, metal: 0.8, rough: 0.3, shadow: false }); }
    // the steam press: it comes down on a beat (the lamp goes amber first)
    const press = path(1, w.plat({ x: 0.4, y: -8.0, z: -96.2, w: 2.6, d: 2.4, h: 2.4, tex: 'metal', color: 0xc8ccd4, roughness: 0.3, metalness: 0.6 }));
    const PRESS_P = 2.6, PRESS_ON = 0.9;
    const pressUp = (t) => { const u = ((t % PRESS_P) + PRESS_P) % PRESS_P; return u >= PRESS_ON; };
    const plate = w.hazard({ x: 0.4, y: -7.2, z: -96.2, w: 2.5, h: 1.4, d: 2.3, color: 0xffffff });
    plate.core.visible = false; plate.shell.visible = false; plate.predict = (t) => !pressUp(t);
    const plateMesh = w.box({ x: 0.4, y: -7.75, z: -96.2, w: 2.5, h: 0.5, d: 2.3, color: 0x9aa0aa, metal: 0.8, rough: 0.35, static: false });
    const pressLamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glowMaterial(0x40ff88, 1.6)); pressLamp.position.set(0.4, -3.6, -95.62); w.add(pressLamp);
    w.box({ x: 0.4, y: -3.6, z: -96.2, w: 1.0, h: 1.2, d: 1.0, color: 0x5a606c, metal: 0.8, rough: 0.35, shadow: false });
    const lampM = { go: glowMaterial(0x40ff88, 1.6), warn: glowMaterial(0xffc040, 1.8), stop: glowMaterial(0xff3a46, 2.0) };
    w.onUpdate((dt, t) => {
      const u = ((t % PRESS_P) + PRESS_P) % PRESS_P, down = u < PRESS_ON;
      plate.enabled = down;
      const k = down ? 1 : u < PRESS_ON + 0.35 ? 1 - (u - PRESS_ON) / 0.35 : u > PRESS_P - 0.15 ? (u - (PRESS_P - 0.15)) / 0.15 : 0;
      plateMesh.position.y = -7.75 + (1 - k) * 3.3;
      pressLamp.material = down ? lampM.stop : u > PRESS_P - 0.7 ? lampM.warn : lampM.go;
    });
    const towels = path(1, w.plat({ x: 0.4, y: -8.0, z: -103.4, w: 2.4, d: 10, h: 2.6, tex: 'metal', color: 0x4a5160, roughness: 0.5, metalness: 0.5, radius: 0.03 }), [{ x: 0.4, y: -8, z: -99.5 }, { x: 0.4, y: -8, z: -107.5 }]);
    w.conveyor(towels, { vz: -3.0 });
    for (const z of [-100.5, -104.5]) w.box({ x: 0.4, y: -7.75, z, w: 0.9, h: 0.5, d: 0.6, color: 0x9fd0ff, rough: 1, shadow: false });
    const D1 = path(1, washer(2.4, -110.8, -7.4, { w: 2, d: 2, color: 0xdde4ea }));
    const D2 = path(1, washer(-0.2, -113.8, -6.8, { w: 2, d: 2, color: 0xdde4ea }));
    const D3 = path(1, washer(-2.4, -117.0, -7.4, { w: 2, d: 2, color: 0xdde4ea }));
    const F6 = path(1, floor(-119.5, Z.d2, Y2, { color: 0xdfe9f2 }), [{ x: 0, y: Y2, z: -122 }, { x: 0, y: Y2, z: -134 }]);
    w.plat({ x: 0, y: Y2 + 0.85, z: -125, w: 2 * HW, d: 0.9, h: 0.85, tex: 'curtain', color: 0xe8f0f8, roughness: 0.95, radius: 0.3 });
    cart(-132.5, Y2, 2.4, 1.5, 1.2);
    wallAcross(Z.d2, Y2 + 4.2, -3, 'tile', 0xc8dcef);
    stripe(-119.7, Y2); stripe(Z.d2 + 0.6, Y2);
    void F5; void W1; void W2; void W3; void W4; void table; void press; void D1; void D2; void D3; void F6; void pile;

    // ============================ stage 3 · kitchen pass (y -9) =================================================
    walls(-139, -216, -11.5, -3, 'tile', 0xf0d8c8);
    ceil(-139, -216, -3, 0xe8ddd0);
    const F7 = path(2, floor(Z.d2, -168, Y2, { color: 0xb04a3a, rough: 0.7 }), [{ x: 0, y: Y2, z: -146 }, { x: 0, y: Y2, z: -156 }, { x: 0, y: Y2, z: -166 }]);
    stageCp(2, 0, Y2, -142);
    // while the bell waits behind the shutter: a "patch" (W and S swapped for a few seconds)
    twistZone(game, w, { x: 0, y: Y2 + 1.6, z: -145.5, w: 2 * HW, h: 3.4, d: 2.0 }, 'fwd', { sec: 4.5, say: 'hotel.l5.twist' });
    // the STAFF EXIT (press E): a closet with no floor. The real way on is the corridor
    fakeExit(w, game, { x: HW - 0.25, y: Y2, z: -149.5, yaw: -Math.PI / 2, kind: 'door', label: 'STAFF EXIT', say: 'hotel.l5.staffexit' });
    cart(-154.5, Y2, 2.8, 1.9, 0.4); cart(-159.5, Y2, 2.8, 1.6, 2.3); cart(-164.5, Y2, 2.8, 2.1, 4.1);
    // the fryer: two trays slide over it, then the pass counter under the heat lamps
    pool(-168, -187.4, -9.6, 'oil');
    const tray = (z, ph) => { const p = w.plat({ x: 0, y: -8.6, z, w: 2.4, d: 2.2, h: 0.14, tex: 'metal', color: 0xe0e4ea, roughness: 0.2, metalness: 0.9, radius: 0.04 }); w.mover(p, (t) => ({ x: 2.2 * Math.sin(t * Math.PI * 2 / 3.2 + ph) })); return p; };
    const T1 = path(2, tray(-170.2, 0)), T2 = path(2, tray(-173.8, Math.PI));
    for (const z of [-170.2, -173.8]) for (const dz of [-0.75, 0.75]) w.box({ x: 0, y: -8.73, z: z + dz, w: 2 * HW, h: 0.06, d: 0.08, color: 0x8a8a96, metal: 0.8, rough: 0.3, shadow: false });   // the rails they slide on
    const counter = path(2, w.plat({ x: -2.6, y: -8.0, z: -182, w: 1.6, d: 10.8, h: 2.6, tex: 'metal', color: 0xd8dde4, roughness: 0.25, metalness: 0.8, radius: 0.04 }), [{ x: -2.6, y: -8, z: -177.5 }, { x: -2.6, y: -8, z: -186.5 }]);
    const LAMP_P = 2.8, LAMP_ON = 1.0;
    const lamps = [-179.8, -184.2].map((z, k) => {
      const ph = -k * 0.3;                                       // a wave: the far lamp follows the near one (a 1.5 s gap every cycle)
      const on = (t) => (((t + ph) % LAMP_P) + LAMP_P) % LAMP_P < LAMP_ON;
      const hz = w.hazard({ x: -2.6, y: -7.25, z, w: 1.7, h: 1.5, d: 1.1, color: 0xff7a30 });
      hz.core.visible = false; hz.shell.visible = false; hz.predict = on;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xff8a40, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.set(-2.6, -6.8, z); w.add(cone);
      const housing = w.box({ x: -2.6, y: -5.45, z, w: 0.9, h: 0.5, d: 0.7, color: 0x2c2d33, metal: 0.8, rough: 0.35 });
      w.box({ x: -2.6, y: -4.1, z, w: 0.06, h: 2.2, d: 0.06, color: 0x8a8a96, metal: 0.9, rough: 0.3, shadow: false });
      const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 16), glowMaterial(0x7a2010, 1.0)); bulb.position.set(-2.6, -5.72, z); w.add(bulb);
      void housing;
      return { hz, cone, bulb, on, ph };
    });
    const bulbM = { off: glowMaterial(0x7a2010, 1.0), warn: glowMaterial(0xff7a30, 1.6), on: glowMaterial(0xffe8c0, 2.6) };
    w.onUpdate((dt, t) => {
      for (const L of lamps) {
        const u = (((t + L.ph) % LAMP_P) + LAMP_P) % LAMP_P, on = u < LAMP_ON, warn = u > LAMP_P - 0.6;
        L.hz.enabled = on; L.cone.visible = on;
        L.bulb.material = on ? bulbM.on : warn ? bulbM.warn : bulbM.off;
      }
    });
    const F9 = path(2, floor(-187.4, -201, Y2, { color: 0xb04a3a, rough: 0.7 }));
    for (const z of [-191.5, -197]) w.plat({ x: 0, y: Y2 + 0.9, z, w: 2 * HW, d: 0.8, h: 0.9, tex: 'metal', color: 0xb8c0c8, roughness: 0.3, metalness: 0.7, radius: 0.05 });
    const mop = path(2, floor(-201, -211, Y2, { tex: 'marble', color: 0xd0d0dc, rough: 0.14, slippery: 0.8 }));
    w.sign({ text: 'CAUTION · JUST MOPPED', x: 0, y: Y2 + 0.02, z: -201.6, w: 4.6, h: 0.7, rotX: -Math.PI / 2, color: '#ffd21f', double: false, tw: 1024, size: 70 });
    cart(-206, Y2, 2.6, 1.8, 0.8);
    const F10 = path(2, floor(-211, Z.d3, Y2, { color: 0xb04a3a, rough: 0.7 }));
    wallAcross(Z.d3, Y2 + 4.2, 6.8, 'tile', 0xf0d8c8);
    stripe(-168.2, Y2); stripe(-187.6, Y2); stripe(Z.d3 + 0.6, Y2);
    void F7; void T1; void T2; void counter; void F9; void mop; void F10;

    // ============================ stage 4 · service stairs (y -9 → +0.8) ===========================================
    walls(-216, Z.shaftS, -11.5, 6.8, 'stone', 0xd8d0c0);
    ceil(-216, Z.shaftS, 6.8, 0xc8c0b0);
    const F11 = path(3, floor(Z.d3, -222, Y2, { tex: 'stone', color: 0xe4d8c0 }));
    stageCp(3, 0, Y2, -219);
    for (let k = 1; k <= 8; k++) {
      const top = Y2 + 0.6 * k, zs = -222 - 1.5 * (k - 1);
      path(3, w.plat({ x: 0, y: top, z: zs - 0.75, w: 2 * HW, d: 1.5, h: top + 11.5, tex: 'stone', color: 0xe4d8c0, roughness: 0.6, radius: 0.03 }));
      w.box({ x: 0, y: top + 0.008, z: zs - 0.12, w: 2 * HW - 0.2, h: 0.016, d: 0.16, color: 0xffd21f, shadow: false });
    }
    const L1 = path(3, w.plat({ x: 0, y: -4.2, z: -236, w: 2 * HW, d: 4, h: 7.3, tex: 'stone', color: 0xe4d8c0, roughness: 0.6, radius: 0.03 }));
    pool(-238, -259, -7.5, 'cement');
    w.sign({ text: 'UNDER RENOVATION · MIND THE GAPS', x: 0, y: 3.4, z: -238.5, w: 6, h: 0.7, color: '#ffd21f', double: true, tw: 1024, size: 56 });
    for (let j = 1; j <= 4; j++) {
      const top = -4.2 + j, zc = -239.9 - 2.6 * (j - 1);
      path(3, w.plat({ x: 0, y: top, z: zc, w: 5, d: 1.4, h: top + 8.6, tex: 'stone', color: 0xe4d8c0, roughness: 0.6, radius: 0.03 }));
      w.box({ x: 0, y: top + 0.008, z: zc + 0.58, w: 4.8, h: 0.016, d: 0.16, color: 0xffd21f, shadow: false });
    }
    const L2a = path(3, w.plat({ x: 0, y: 0.8, z: -251.55, w: 2 * HW, d: 3.9, h: 9.4, tex: 'stone', color: 0xe4d8c0, roughness: 0.6, radius: 0.03 }));
    // the luggage gondola on its ceiling rail (it has wheels; it uses them)
    const gond = path(3, w.plat({ x: -1.8, y: 1.2, z: -256.25, w: 3.0, d: 2.6, h: 0.12, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.03 }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) gond.attach(w.box({ x: -1.8 + sx * 1.35, y: 3.9, z: -256.25 + sz * 1.15, w: 0.08, h: 5.4, d: 0.08, color: GOLD, metal: 1, rough: 0.28, static: false }));
    gond.attach(w.box({ x: -1.8, y: 6.45, z: -256.25, w: 3.2, h: 0.3, d: 1.4, color: 0x3a3f4a, metal: 0.8, rough: 0.35, static: false }));
    w.box({ x: 0, y: 6.7, z: -256.25, w: 2 * HW, h: 0.2, d: 0.4, color: 0x4a5160, metal: 0.8, rough: 0.4, shadow: false });
    w.rollaway(gond, { dir: [1, 0], dist: 4.0, accel: 3.5, speed: 5.0, delay: 0.8, hold: 2.6, back: 2.0, onGo: () => game.say('hotel.l5.gondola', { priority: 1 }) });
    const L2b = path(3, w.plat({ x: 0, y: 0.8, z: -261.25, w: 2 * HW, d: 4.5, h: 12.3, tex: 'stone', color: 0xe4d8c0, roughness: 0.6, radius: 0.03 }));
    w.sign({ text: 'FREIGHT ELEVATOR ▸ STAFF', x: 0, y: 5.6, z: -262.95, w: 5.6, h: 0.8, color: '#ffd21f', double: false, tw: 1024, size: 64, glow: true });
    void F11; void L1; void L2a; void L2b;

    // ============================ the freight elevator (it goes the wrong way) ====================================
    const SZ = (Z.shaftS + Z.shaftN) / 2;
    for (const s of [-1, 1]) w.plat({ x: s * (HW + 0.5), y: 6.8, z: SZ, w: 1, d: Z.shaftS - Z.shaftN, h: 6.8 + 24, tex: 'metal', color: 0x6a707c, roughness: 0.5 });
    ceil(Z.shaftS, Z.shaftN, 6.8, 0x8a8f99);
    w.plat({ x: 0, y: 6.8, z: Z.shaftS + 0.5, w: 2 * HW + 2, d: 1, h: 1.8, tex: 'metal', color: 0x6a707c });           // lintel over the top gate
    w.plat({ x: 0, y: -11.5, z: Z.shaftS + 0.5, w: 2 * HW + 2, d: 1, h: 12.5, tex: 'metal', color: 0x6a707c });       // the shaft under the landing
    w.plat({ x: 0, y: 6.8, z: Z.shaftN - 0.5, w: 2 * HW + 2, d: 1, h: 6.8 - (Y5 + 4.2), tex: 'metal', color: 0x6a707c }); // above the bottom gate
    w.plat({ x: 0, y: Y5 - 0.4, z: SZ, w: 2 * HW, d: Z.shaftS - Z.shaftN, h: 2.4, tex: 'metal', color: 0x3a3e46 });   // the pit floor
    const car = path(3, w.plat({ x: 0, y: 0.8, z: SZ, w: 2 * HW - 0.05, d: Z.shaftS - Z.shaftN - 0.05, h: 0.4, tex: 'metal', color: 0x9aa0aa, roughness: 0.35, metalness: 0.8, moving: true }));
    const carRoof = w.box({ x: 0, y: 5.2, z: SZ, w: 2 * HW - 0.1, h: 0.2, d: Z.shaftS - Z.shaftN - 0.1, color: 0x6a707c, metal: 0.7, rough: 0.4, static: false });
    car.attach(carRoof);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) car.attach(w.box({ x: sx * 3.85, y: 3.0, z: SZ + sz * 2.35, w: 0.14, h: 4.2, d: 0.14, color: 0xffd21f, metal: 0.3, rough: 0.4, static: false }));
    const carLamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.5), glowMaterial(0xfff2d0, 1.6)); carLamp.position.set(0, 5.05, SZ); car.group.add(carLamp); carLamp.position.sub(car.group.position);
    const gateS = shutter(Z.shaftS + 0.2, 0.8, { label: 'FREIGHT · 2000 kg' });
    const gateN = shutter(Z.shaftN - 0.2, Y5, { label: 'SUB-BASEMENT' });
    const elev = { phase: 'top', t: 0, y: 0.8, fake: false };
    const carTo = (y) => { elev.y = y; car.setPos(0, y - 0.2, SZ); };
    const resetCar = (bottom) => {
      elev.phase = bottom ? 'bottom' : 'top'; elev.t = 0; carTo(bottom ? Y5 : 0.8);
      gateS.set(!!bottom, true); gateN.set(!bottom, true);
    };
    resetCar(false);

    // ============================ stage 5 · sub-basement (y -21.2) ===============================================
    walls(Z.shaftN - 1, -331, Y5 - 3, Y5 + 6, 'stone', 0x6a5a50);
    ceil(Z.shaftN - 1, -331, Y5 + 6, 0x5a524a);
    wallAcross(Z.end, Y5 - 3, Y5 + 6, 'stone', 0x6a5a50);
    // the gap between the shaft wall and the sub-basement walls (z -268.5 .. -269.5): side pieces + a ceiling
    for (const s of [-1, 1]) w.plat({ x: s * (HW + 0.5), y: Y5 + 4.2, z: Z.shaftN - 0.5, w: 1, d: 1, h: 7.2, tex: 'metal', color: 0x6a707c });
    const F12 = path(4, floor(Z.shaftN, -275, Y5, { tex: 'metal', color: 0x6a6f7a, rough: 0.5 }));
    stageCp(4, 0, Y5, -272);
    pool(-275, -311, Y5 - 0.6, 'boiler');
    const grate = (x, zs, zn, ww) => {
      const p = w.plat({ x, y: Y5, z: (zs + zn) / 2, w: ww, d: zs - zn, h: 0.3, tex: 'metal', color: 0xb9a15a, roughness: 0.35, metalness: 0.7, radius: 0.03 });
      for (let z = zs - 1; z > zn + 0.5; z -= 3) w.box({ x, y: Y5 - 1.0, z, w: 0.2, h: 1.6, d: 0.2, color: 0x4a4f5a, metal: 0.8, rough: 0.4, shadow: false });
      return p;
    };
    const K1 = path(4, grate(-2.6, -275, -283.2, 1.4));
    const K2 = path(4, grate(0, -283.2, -284.8, 6.6));
    const K3 = path(4, grate(2.6, -284.8, -292.6, 1.4));
    const K4 = path(4, w.crumble(grate(2.6, -292.6, -295.0, 1.4), { delay: 0.5, gone: 3 }));
    const K5 = path(4, grate(2.6, -295.0, -300.4, 1.4));
    const K6 = path(4, grate(0, -300.4, -302.0, 6.6));
    const K7 = path(4, grate(-2.6, -302.0, -311, 1.4));
    // steam jets across the catwalks (the lamp on the pipe goes amber, then red)
    const STEAM_P = 2.6, STEAM_ON = 1.0;
    const jets = [[-2.6, -279.2, -1, 0], [2.6, -297.8, 1, 0.9], [-2.6, -306.6, -1, 1.7]].map(([x, z, side, ph]) => {
      const on = (t) => (((t + ph) % STEAM_P) + STEAM_P) % STEAM_P < STEAM_ON;
      const hz = w.hazard({ x: x - side * 0.1, y: Y5 + 0.95, z, w: 2.6, h: 1.9, d: 0.9, color: 0xdde8ff });
      hz.core.visible = false; hz.shell.visible = false; hz.predict = on;
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.8, 2.8, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xeef4ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      cone.rotation.z = -side * Math.PI / 2; cone.position.set(side * (HW - 1.4), Y5 + 1.0, z); w.add(cone);
      const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('puff'), color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })); puff.scale.set(2.4, 2.4, 1); puff.position.set(x, Y5 + 1.2, z); w.add(puff);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.0, 10), plainMaterial(0xb87333, { metalness: 0.9, roughness: 0.35 })); pipe.rotation.z = Math.PI / 2; pipe.position.set(side * (HW - 0.4), Y5 + 1.0, z); w.add(pipe);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glowMaterial(0x40ff88, 1.6)); lamp.position.set(side * (HW - 0.12), Y5 + 1.7, z); w.add(lamp);
      return { hz, cone, puff, lamp, on, ph };
    });
    w.onUpdate((dt, t) => {
      for (const j of jets) {
        const u = (((t + j.ph) % STEAM_P) + STEAM_P) % STEAM_P, on = u < STEAM_ON, warn = u > STEAM_P - 0.6;
        j.hz.enabled = on; j.cone.visible = on; j.puff.visible = on;
        j.lamp.material = on ? lampM.stop : warn ? lampM.warn : lampM.go;
        if (on) j.puff.material.opacity = 0.35 + 0.2 * Math.sin(t * 17);
      }
    });
    const F13 = path(4, floor(-311, Z.end + 0.5, Y5, { tex: 'metal', color: 0x6a6f7a, rough: 0.5 }), [{ x: -2.4, y: Y5, z: -313.5 }]);
    // the dumbwaiter (real) is up the crates on the west wall; the EXIT straight ahead is painted on
    const Cr1 = path(4, w.plat({ x: -2.7, y: Y5 + 0.8, z: -315.6, w: 1.9, d: 1.9, h: 0.8, tex: 'wood', color: 0xc8a070, roughness: 0.8, radius: 0.04 }));
    const Cr2 = path(4, w.plat({ x: -2.7, y: Y5 + 1.6, z: -318.4, w: 1.9, d: 1.9, h: 1.6, tex: 'wood', color: 0xb89060, roughness: 0.8, radius: 0.04 }));
    const Cr3 = path(4, w.plat({ x: -2.7, y: Y5 + 2.4, z: -321.6, w: 2.4, d: 2.6, h: 2.4, tex: 'metal', color: 0x8a8f99, roughness: 0.4, metalness: 0.7, radius: 0.04 }));
    w.box({ x: -3.95, y: Y5 + 4.4, z: -321.6, w: 0.1, h: 2.0, d: 2.0, color: 0x14141a, rough: 0.8 });
    for (const s of [-1, 1]) w.box({ x: -3.9, y: Y5 + 4.4, z: -321.6 + s * 1.05, w: 0.2, h: 2.2, d: 0.12, color: GOLD, metal: 1, rough: 0.3 });
    w.box({ x: -3.9, y: Y5 + 5.5, z: -321.6, w: 0.2, h: 0.12, d: 2.2, color: GOLD, metal: 1, rough: 0.3 });
    w.sign({ text: 'DUMBWAITER', x: -3.88, y: Y5 + 5.9, z: -321.6, w: 2.4, h: 0.5, rotY: Math.PI / 2, color: '#f1d28a', double: false, tw: 512, size: 70 });
    // the painted EXIT on the end wall (a picture of a door, with a very convincing ring in front of it)
    w.box({ x: 1.8, y: Y5 + 2.1, z: Z.end + 0.52, w: 2.6, h: 4.2, d: 0.04, color: 0x2a6a4a, rough: 0.5 });
    w.box({ x: 1.8, y: Y5 + 2.1, z: Z.end + 0.56, w: 0.05, h: 4.0, d: 0.04, color: 0x123a26, rough: 0.5 });
    fakeExit(w, game, { x: 1.8, y: Y5, z: Z.end + 2.4, kind: 'goal', label: 'EXIT', say: 'hotel.l5.painted', reason: 'painted' });
    const goal = w.goal({ x: -2.7, y: Y5 + 2.4, z: -321.6, yaw: Math.PI / 2, color: GOLD, onReach: () => { game.say('hotel.l5.done', { priority: 2 }); game.completeLevel(); } });
    void F12; void K1; void K2; void K3; void K4; void K5; void K6; void K7; void F13; void Cr1; void Cr2; void Cr3; void goal;

    // ---- lights + the look -------------------------------------------------------------------------------------------
    const alarmMat = glowMaterial(0xff2a3a, 1.0);
    const strips = [[20, -64, 0, 6], [-60, -137, -9, -3], [-140, -214, -9, -3], [-217, -262, -9, 6.8], [-270, -329, Y5, Y5 + 6]];
    for (const [zs, zn, y0, y1] of strips) {
      for (let z = zs - 2; z > zn; z -= 8) for (const sx of [-1, 1]) w.box({ x: sx * 3.92, y: y1 - 1.0, z, w: 0.14, h: 0.14, d: 3.0, color: 0xffffff, shadow: false }).material = alarmMat;
      for (let z = zs - 4; z > zn; z -= 12) { w.box({ x: 0, y: y1 - 0.05, z, w: 3.0, h: 0.1, d: 0.3, glow: 0xdff4ff, glowIntensity: 1.3, shadow: false }); hotelHalo(w, 0, y1 - 0.6, z, 5.5, 0xcfe8ff, 0.1); }
      void y0;
    }
    w.light(0xfff0d0, 14, 34, 0, 5, -20); w.light(0xd0e8ff, 14, 34, 0, -4.5, -95); w.light(0xffd8b0, 14, 34, 0, -4.5, -175);
    w.light(0xfff0d0, 14, 40, 0, 5, -245); w.light(0xff9a60, 16, 40, 0, Y5 + 5, -300);
    w.sign({ text: 'STAFF ONLY · BACK OF HOUSE', x: 0, y: 5.0, z: Z.start - 0.52, w: 7, h: 0.8, color: '#ffd21f', double: false, tw: 1024, size: 54, rotY: Math.PI });
    w.sign({ text: 'KITCHEN ▸', x: 0, y: Y2 + 5.0, z: Z.d2 + 0.52, w: 3.6, h: 0.7, color: '#ffd21f', double: false, tw: 512, size: 70 });
    w.sign({ text: 'SERVICE STAIRS ▸', x: 0, y: Y2 + 5.0, z: Z.d3 + 0.52, w: 4.6, h: 0.7, color: '#ffd21f', double: false, tw: 1024, size: 70 });
    w.sign({ text: 'BOILERS · NO GUESTS', x: 0, y: Y5 + 5.2, z: -275.2, w: 4.6, h: 0.6, color: '#ff9a60', double: true, tw: 1024, size: 60 });
    for (let z = -278; z > -310; z -= 6) for (const sx of [-1, 1]) w.box({ x: sx * 3.84, y: Y5 + 3.6, z, w: 0.3, h: 0.3, d: 5.6, color: 0xb87333, metal: 0.9, rough: 0.35, shadow: false });

    // ---- the doors between stages ------------------------------------------------------------------------------------
    const lid = shutter(-63, 0, { axis: 'x', width: 2 * HW });
    const doors = [shutter(Z.start, 0, { label: 'STAFF ONLY' }), lid, shutter(Z.d2, Y2, { label: 'FIRE SHUTTER' }), shutter(Z.d3, Y2, { label: 'FIRE SHUTTER' })];
    w.onUpdate((dt) => { for (const d of doors) d.update(dt); gateS.update(dt); gateN.update(dt); });

    // ============================ the bell ============================================================================
    const stairY = (z) => {
      if (z > -222) return Y2;
      if (z > -234) return Y2 + ((-222 - z) / 12) * 4.8;
      if (z > -238) return -4.2;
      if (z > -249.6) return -4.2 + ((-238 - z) / 11.6) * 5.0;
      return 0.8;
    };
    // per stage: where the bell comes in, the furthest it may go, its floor, its pace, and how long it waits behind the shutter
    const BS = [
      { enter: 19.5, stop: -63, floor: () => 0, v: 4.2, wait: 2.6 },
      { enter: -63, stop: Z.d2 + 1.75, floor: () => Y2, v: 3.7, wait: 3.5, drop: 0 },
      { enter: Z.d2 + 1.75, stop: Z.d3 + 1.75, floor: () => Y2, v: 3.9, wait: 7.5 },
      { enter: Z.d3 + 1.75, stop: Z.shaftS + 1.75, floor: stairY, v: 3.5, wait: 3.0 },
      { enter: SZ, stop: Z.end + 3.5, floor: () => Y5, v: 3.9, wait: 3.0, drop: Y5 + 13 },
    ];
    const bell = { k: 0, z: BS[0].enter, y: 0, vy: 0, mode: 'hold', pending: null, reached: 0, bang: 0 };
    const hz = w.hazard({ x: 0, y: BELL.h / 2, z: BS[0].enter, w: BELL.across, h: BELL.h, d: BELL.along, color: 0xff3a46, move: () => ({ y: bell.y, z: bell.z - BS[0].enter }) });
    hz.core.visible = false; hz.shell.visible = false; hz.bell = true;
    const bellRoot = bellVisual(hz.group, BELL.h); bellRoot.scale.setScalar(1.04);
    const babyK = () => (baby() ? 0.78 : 1);
    const release = (k) => {
      const s = BS[k];
      bell.k = k; bell.z = s.enter; bell.pending = null;
      if (s.drop !== undefined) { bell.mode = 'drop'; bell.y = s.drop; bell.vy = 0; } else { bell.mode = 'run'; bell.y = s.floor(bell.z); }
      if (k === 1) lid.set(false);
      else if (k === 0 || k === 2 || k === 3) doors[k].set(false);
      game.audio.bell();
      game.say(k === 0 ? 'hotel.l5.go' : k === 1 ? 'hotel.l5.chutebell' : k === 4 ? 'hotel.l5.shaftbell' : 'hotel.l5.burst', { priority: 1 });
    };
    const stageOf = (x, y, z) => {
      if (z > -66 && y > -4.5) return 0;
      if (z > -139.2) return 1;
      if (z > -216.2) return 2;
      if (z > Z.shaftN - 0.3) return 3;
      return 4;
    };
    const resetBell = (r) => {
      bell.reached = r; bell.vy = 0; bell.bang = 0;
      if (r === 0) { bell.k = 0; bell.z = BS[0].enter; bell.y = 0; bell.mode = 'hold'; bell.pending = { k: 0, at: w.t + BS[0].wait + (baby() ? 1.5 : 0) }; }
      else { bell.k = r - 1; bell.z = BS[r - 1].stop; bell.y = BS[r - 1].floor(bell.z); bell.mode = 'hold'; bell.pending = { k: r, at: w.t + BS[r].wait + (baby() ? 1.5 : 0) }; }
      doors[0].set(true, true); lid.set(r >= 1, true); doors[2].set(r >= 2, true); doors[3].set(r >= 3, true);
      if (r <= 3) resetCar(false); else resetCar(true);
    };
    resetBell(0);
    let dingT = 0, warned = false;
    w.onUpdate((dt, t) => {
      const p = game.player, playing = game.state === 'playing';
      // the player went through a shutter (or down the chute, or out of the lift): it slams, the bell is told to wait
      const ps = stageOf(p.x, p.y, p.z);
      if (playing && ps > bell.reached) {
        for (let k = bell.reached + 1; k <= ps; k++) {
          if (k === 1) lid.set(true); else if (k === 2 || k === 3) doors[k].set(true);
        }
        bell.reached = ps;
        bell.pending = { k: ps, at: w.t + BS[ps].wait + (baby() ? 1.5 : 0) };
        warned = false;
        if (ps === 1 || ps === 2 || ps === 3) game.say('hotel.l5.slam', { priority: 1 });
      }
      if (bell.pending && w.t >= bell.pending.at) release(bell.pending.k);
      // the bell behind a shutter: it rattles it (that is the tell: it is coming through in a moment)
      if (bell.pending && bell.pending.k > 0 && playing) {
        const left = bell.pending.at - w.t;
        const d = bell.pending.k === 1 ? lid : bell.pending.k <= 3 ? doors[bell.pending.k] : null;
        if (d && left < 2.2) d.shake = 0.1;
        if (!warned && left < 1.6) { warned = true; game.say(bell.pending.k === 4 ? 'hotel.l5.above' : 'hotel.l5.coming', { priority: 1 }); }
      }
      const s = BS[bell.k];
      if (bell.mode === 'drop') {
        bell.vy -= 26 * dt; bell.y += bell.vy * dt;
        const fy = s.floor(bell.z);
        if (bell.y <= fy) { bell.y = fy; bell.vy = 0; bell.mode = 'run'; }
      } else if (bell.mode === 'run' && !(bell.k === 3 && elev.phase !== 'top' && elev.phase !== 'closing')) {
        const gap = bell.z - p.z;
        const v = gap > MAXGAP && bell.reached === bell.k ? CATCHUP : s.v * babyK();
        bell.z = Math.max(s.stop, bell.z - v * dt);
        bell.y = s.floor(bell.z);
      }
      // visuals: wobble, hop, the alarm strips, the dings
      bellRoot.rotation.z = Math.sin(t * 9) * 0.045;
      bellRoot.position.y = -BELL.h / 2 + (bell.mode === 'run' ? Math.abs(Math.sin(t * 5.5)) * 0.22 : 0);
      const gap = p.z - bell.z;
      const near = bell.mode === 'hold' ? 0 : Math.max(0, Math.min(1, 1 - (-gap - 4) / 30));
      alarmMat.color.setRGB(1.0, 0.16, 0.22).multiplyScalar(0.5 + near * 3.0 * (0.55 + 0.45 * Math.sin(t * (4 + near * 10))));
      if (playing && bell.mode !== 'hold') {
        dingT -= dt;
        if (dingT <= 0 && -gap < 34) { game.audio.bell(); dingT = -gap < 9 ? 0.3 : -gap < 18 ? 0.5 : 0.85; }
      }
    });

    // the elevator: step in, the gate shuts, LEVEL COMPLETE… OUT OF ORDER, and down it goes (the wrong way)
    w.onUpdate((dt) => {
      const p = game.player;
      if (elev.phase === 'top') {
        if (game.state === 'playing' && p.grounded && p.ground === car.body && p.z < Z.shaftS - 1.0) {
          elev.phase = 'closing'; elev.t = 0; gateS.set(true);
          const played = fakeComplete(game, w, { title: 'LEVEL COMPLETE', jk: '…OUT OF ORDER', say: 'hotel.l5.fakewin', sayAfter: 'hotel.l5.outoforder' });
          if (!played) game.say('hotel.l5.again', { priority: 1 });
        }
      } else if (elev.phase === 'closing') {
        elev.t += dt; if (elev.t > 0.7) { elev.phase = 'down'; elev.t = 0; }
      } else if (elev.phase === 'down') {
        elev.t += dt;
        const k = Math.min(1, elev.t / 3.6), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        carTo(0.8 + (Y5 - 0.8) * e);
        if (k >= 1) { elev.phase = 'opening'; elev.t = 0; gateN.set(false); game.say('hotel.l5.basement', { priority: 2 }); }
      } else if (elev.phase === 'opening') {
        elev.t += dt; if (elev.t > 0.5) elev.phase = 'bottom';
      }
    });

    // ---- banners, the host, the hint, the bot ------------------------------------------------------------------------
    w.hooks.onCheckpoint = (c) => {
      const i = cps.get(c);
      if (i !== undefined) { stageTitle(game, w, i + 1, NAMES.length, NAMES[i]); game.say(i === 2 ? 'hotel.l5.cp2' : 'hotel.l5.cp', { priority: 1 }); }
    };
    w.onRespawn(() => { resetBell(stageOf(w.respawn.x, w.respawn.y, w.respawn.z)); dingT = 0.6; warned = false; });
    let intro = false, t0 = 0;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 0.6) { intro = true; g.say('hotel.l5.intro'); g.say('hotel.l5.intro2'); stageTitle(g, w, 1, NAMES.length, NAMES[0]); }
    };
    onPlat(w, F1, () => game.say('hotel.l5.bags'));
    onPlat(w, F2, () => game.say('hotel.l5.belts2'));
    w.trigger({ x: 0, y: 1.6, z: -6.5, w: 2 * HW, h: 3.4, d: 1.4, once: true, onEnter: () => game.say('hotel.l5.express', { priority: 1 }) });
    onPlat(w, F3, () => game.say('hotel.l5.marble'));
    onPlat(w, F4, () => game.say('hotel.l5.chute', { priority: 1 }));
    onPlat(w, W1, () => game.say('hotel.l5.laundry'));
    onPlat(w, table, () => game.say('hotel.l5.fakecp', { priority: 1 }));
    onPlat(w, towels, () => game.say('hotel.l5.press'));
    onPlat(w, T1, () => game.say('hotel.l5.fryer'));
    onPlat(w, counter, () => game.say('hotel.l5.lamps'));
    onPlat(w, mop, () => game.say('hotel.l5.mop'));
    onPlat(w, L1, () => game.say('hotel.l5.reno'));
    onPlat(w, L2b, () => game.say('hotel.l5.elevator', { priority: 1 }));
    onPlat(w, K1, () => game.say('hotel.l5.steam'));
    onPlat(w, F13, () => game.say('hotel.l5.exit', { priority: 1 }));
    w.hooks.onDeath = (info) => {
      const p = game.player;
      if (info.reason === 'painted') return true;                                       // (the fake exit already said its piece)
      if (info.reason === 'hazard' && Math.abs(p.z - bell.z) < BELL.along / 2 + 1.2 && Math.abs(p.y - bell.y) < 4) { game.say('hotel.l5.caught', { priority: 2, vars: { n: game.deaths } }); return true; }
      if (info.reason === 'hazard' && p.z > -27 && p.z < -6 && p.x < 0) { game.say('hotel.l5.expressdeath', { priority: 2 }); return true; }
      if (info.reason === 'hazard' || info.reason === 'void') { if (Math.random() < 0.6) { game.say('hotel.l5.splash', { priority: 1 }); return true; } }
      return false;
    };
    stageHint(w, stages, { flat: false });
    w.botPlan = (g) => {
      const p = g.player;
      if (g.mods.swapFwd) return { x: p.x, z: p.z, wait: true };                                                   // a human presses S; the bot stands still (the bell waits long enough)
      if (p.y > -5 && p.z < -57.5 && p.z > -66) return { x: p.x, z: -64.2 };                                       // down the chute: aim for the middle of the hole
      if (elev.phase !== 'top' && elev.phase !== 'bottom' && p.z > Z.shaftN) return { x: 0, z: SZ, wait: true };   // ride the lift down
      return null;
    };
    w.chase = { bell, BS, hz, doors, lid, elev, car, gateS, gateN, stages, stageOf, cps, release, Z, beltL, beltR, sheet, plate, lamps, jets, expressSign };
  },
};

// the bellhop: a gigantic brass service bell with a plunger on top and a very bad attitude
function bellVisual(group, bh) {
  const brass = new THREE.MeshStandardMaterial({ color: 0xe0b04a, metalness: 1, roughness: 0.22, emissive: 0x3a2200, emissiveIntensity: 0.5 });
  const root = new THREE.Group(); root.position.y = -bh / 2; group.add(root);
  const pts = [[3.55, 0.0], [3.5, 0.18], [3.3, 0.8], [2.8, 1.7], [2.0, 2.5], [1.1, 3.0], [0.45, 3.2], [0.0, 3.25]].map(([x, y]) => new THREE.Vector2(x, y));
  const dome = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), brass); dome.castShadow = true; root.add(dome);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.52, 0.17, 10, 48), brass); ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; root.add(ring);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.35, 12), brass); stem.position.y = 3.35; root.add(stem);
  const btn = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), brass); btn.position.y = 3.65; root.add(btn);
  // face on the north side (-z): angry eyes
  const white = plainMaterial(0xffffff, { roughness: 0.3 }), black = plainMaterial(0x0a0a0a, { roughness: 0.4 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), white); eye.position.set(sx * 1.05, 2.0, -2.35); eye.scale.set(1, 1.15, 0.6); root.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), black); pupil.position.set(sx * 1.05 - sx * 0.05, 1.95, -2.6); root.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.18), black); brow.position.set(sx * 1.05, 2.78, -2.2); brow.rotation.z = sx * 0.4; root.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.15), black); mouth.position.set(0, 1.0, -3.0); root.add(mouth);
  return root;
}

// a room-service cart: a steel trolley with a white cloth and a cloche
function cartVisual(group) {
  const steel = plainMaterial(0xc8ccd4, { metalness: 0.8, roughness: 0.3 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.1), steel); top.position.y = 0.36; group.add(top);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.3, 1.12), plainMaterial(0xf6f2ea, { roughness: 0.95 })); cloth.position.y = 0.22; group.add(cloth);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 1.0), steel); shelf.position.y = -0.25; group.add(shelf);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6), steel); leg.position.set(sx * 0.68, -0.05, sz * 0.48); group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), plainMaterial(0x111111, { roughness: 0.6 })); wheel.rotation.x = Math.PI / 2; wheel.position.set(sx * 0.68, -0.45, sz * 0.48); group.add(wheel);
  }
  const cloche = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), plainMaterial(0xe0e4ea, { metalness: 0.95, roughness: 0.15 })); cloche.position.y = 0.4; group.add(cloche);
}
