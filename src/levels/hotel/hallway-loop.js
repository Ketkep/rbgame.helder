import * as THREE from 'three';
import { plainMaterial, glowMaterial, getTexture, textTexture, softTexture } from '../../engine/materials.js';
import { HintTrail } from '../../engine/hint.js';
import { GOLD } from './kit.js';
import { twist, crash, fakeComplete, stageTitle, ghostPlat } from './trolls.js';

// Hotel level 14 — "Hallway Loop" (Hard · Guest Rooms). One corridor on the third floor. Walk it. If everything is normal, keep going
// through the far door. If ANYTHING is different, turn round and walk back out the way you came. Eight rounds, in four acts; the
// corridor gets worse every act, and the host's opinion is worth exactly nothing.
//
//   Act I   Night Shift        rounds 1–2  the plain corridor: learn it (round 1 is always normal)
//   Act II  Mind the Gap       rounds 3–4  the carpet is up: gaps, a stack of carpet rolls, a joist, two carpet dollies on rails.
//                                          One of the two rounds is a MIRRORED corridor (and mirrors your mouse, too)
//   Act III Turndown Service   rounds 5–6  four laundry chutes that open on a cycle (amber light blinks first), a towel trolley to hop,
//                                          a cart that bursts out of 309 (the door opens first). A painting hangs upside down in one round
//                                          (and so does your mouse). Round 6's counter EXPIRES if you dawdle: it drops back to 5
//   Act IV  Reality Unstable   rounds 7–8  a floor that does not render (its rim glows), crumbling carpet, a floor that blinks in and out
//                                          (it flickers first), an invisible dolly, a bridge that gives way. Round 7: the screen crashes,
//                                          and when it comes back a lovely glowing EXIT door has appeared. It is new. New is an anomaly
//   Encore  Round 9 of 8       after the stairs and a LEVEL COMPLETE that is not: the counter says 9/8. That is different. Turn back:
//                                          the way out was behind you, up four broken flights of fire stairs.
// A wrong call sends you back to the first round of the act (the act is the checkpoint). Baby Mode: a wrong call only repeats the round,
// nothing expires, the decoy EXIT says so, the twists and the crash are short.

const LC = 64, X = 2.4, H = 4.4, PIT = -7;              // corridor length (z 0 → -LC), half width, ceiling, pit floor
const NEED = 8;
const ACTS = ['Night Shift', 'Mind the Gap', 'Turndown Service', 'Reality Unstable', 'Encore · Round 9 of 8'];
const ACT_OF = [0, 0, 0, 1, 1, 2, 2, 3, 3];               // round -> act
const FIRST_OF = [1, 3, 5, 7];                            // act -> its first round
const DOOR_Z = [-6, -14, -22, -30, -38, -46, -54];
const EXPIRE = 45;                                        // round 6: the round-5 point is valid for this long
const rnd = (n) => Math.floor(Math.random() * n);

export default {
  id: 'hotel-14',
  name: 'Hallway Loop',
  music: 'hotel_dark',
  completeQuip: 'You found the exit. The hallway is still there, looping, for the next guest. It has a lot of patience. And a lot of paintings.',

  build(w, game) {
    w.env({
      top: 0x0a0a14, horizon: 0x1c1826, bottom: 0x08080c,
      fog: { color: 0x120e16, near: 22, far: 75 },
      sun: { color: 0xc0c8ff, intensity: 0.1, dir: [0.2, 0.9, 0.3], shadow: false },
      hemi: { sky: 0xffe2c0, ground: 0x7a6a70, intensity: 0.9 },
      exposure: 0.95, stars: 0,
      bloom: { strength: 0.35, radius: 0.6, threshold: 0.95 },
      motes: { color: 0xffe0b0, count: 40, size: 0.05, opacity: 0.3 },
      envMap: { top: 0xffe0c0, mid: 0x4a3a40, bottom: 0x100c10, intensity: 0.3, lights: [{ pos: [0, 4, 0], w: 8, h: 8, color: 0xffe2b0, intensity: 1.8 }] },
    });
    w.setTheme({ tex: 'carpet', color: 0xffffff, trim: null, edge: null, edgeOpacity: 0, roughness: 0.8, metalness: 0, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.killY = -3.2;
    w.spawn = { x: 0, y: 0, z: -2, yaw: 0 };
    w.respawn = { ...w.spawn };
    const timers = new Set();
    const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); if (game.world === w) fn(); }, ms); timers.add(id); };
    w.onDispose(() => { for (const id of timers) clearTimeout(id); timers.clear(); game.ui.fade(false, 0); });

    // ================================================================================================================================
    //  The shell (walls, ceiling, the two end doorways and their vestibules, the pit under the floor)
    // ================================================================================================================================
    const wallM = { tex: 'damask', color: 0xffe8d8, roughness: 0.7 };
    for (const sx of [-1, 1]) w.plat({ x: sx * (X + 0.5), y: H + 1, z: -LC / 2, w: 1, d: LC + 0.8, h: H + 1 - PIT, ...wallM });
    w.plat({ x: 0, y: H + 1, z: -LC / 2, w: 2 * X + 2, d: LC + 2, h: 1, tex: 'coffer', color: 0xdcd0c0, roughness: 0.8 });
    // the pit (only ever seen through gaps): a dark subfloor with old joists
    w.plat({ x: 0, y: PIT, z: -LC / 2, w: 2 * X, d: LC, h: 0.4, tex: 'wood', color: 0x2a1c16, roughness: 0.9 });
    for (let z = -2; z > -LC; z -= 2.2) w.box({ x: 0, y: -2.6, z, w: 2 * X, h: 0.22, d: 0.18, color: 0x3a281c, rough: 0.9, shadow: false });
    // wainscot + chair rail (cut at every door) + cornice along both walls (symmetric, so they stay out of the mirror group)
    for (const sx of [-1, 1]) {
      let z = 0;
      for (const dz of [...DOOR_Z, -LC]) {
        const z1 = dz === -LC ? -LC : dz + 0.76, len = z - z1;
        if (len > 0.05) {
          w.box({ x: sx * (X - 0.06), y: 0.55, z: (z + z1) / 2, w: 0.12, h: 1.1, d: len, tex: 'panel', color: 0xfff4e8, shadow: false, radius: 0.02 });
          w.box({ x: sx * (X - 0.09), y: 1.14, z: (z + z1) / 2, w: 0.18, h: 0.08, d: len, color: GOLD, metal: 1, rough: 0.3, shadow: false, radius: 0.02 });
        }
        z = dz - 0.76;
      }
      w.box({ x: sx * (X - 0.15), y: H - 0.2, z: -LC / 2, w: 0.3, h: 0.4, d: LC, color: 0xece3cf, rough: 0.4, shadow: false });
    }
    // end walls (a doorway each) and the vestibules behind them
    const DW = 2.2, DH = 2.8, VW = 1.8;
    const endWall = (z) => {
      for (const sx of [-1, 1]) w.plat({ x: sx * (DW / 2 + (X - DW / 2) / 2), y: H, z, w: X - DW / 2, d: 0.4, h: H - PIT, ...wallM });
      w.plat({ x: 0, y: H, z, w: DW, d: 0.4, h: H - DH, ...wallM });
      w.box({ x: 0, y: DH + 0.08, z: z + (z < -1 ? 0.22 : -0.22), w: DW + 0.3, h: 0.16, d: 0.06, color: GOLD, metal: 1, rough: 0.3, shadow: false });
      for (const sx of [-1, 1]) w.box({ x: sx * (DW / 2 + 0.08), y: DH / 2, z: z + (z < -1 ? 0.22 : -0.22), w: 0.16, h: DH, d: 0.06, color: GOLD, metal: 1, rough: 0.3, shadow: false });
    };
    endWall(0.2); endWall(-LC - 0.2);
    const vest = (z0, z1, back) => {          // a short dim passage behind each doorway
      const zc = (z0 + z1) / 2, d = Math.abs(z1 - z0);
      w.plat({ x: 0, y: 0, z: zc, w: 2 * VW, d, h: 0.5, tex: 'carpet', color: 0x3a1420, roughness: 0.95 });
      for (const sx of [-1, 1]) w.plat({ x: sx * (VW + 0.3), y: DH + 0.6, z: zc, w: 0.6, d, h: DH + 0.6 - PIT, ...wallM, color: 0x6a5048 });
      w.plat({ x: 0, y: DH + 1.2, z: zc, w: 2 * VW + 1.2, d, h: 0.6, tex: 'coffer', color: 0x8a8070 });
      return back ? w.plat({ x: 0, y: DH + 0.6, z: back, w: 2 * VW + 1.2, d: 0.5, h: DH + 0.6 - PIT, ...wallM, color: 0x6a5048 }) : null;
    };
    const southBack = vest(0.4, 4.5, 4.75);
    vest(-LC - 0.4, -LC - 4.6, -LC - 4.85);
    // light: a few real lights down the middle (symmetric) + the sconces' glow
    const lights = [-6, -20, -34, -48].map((z) => w.light(0xffd8a8, 7, 16, 0, H - 0.5, z));
    w.light(0xffc890, 3, 7, 0, DH, 2.5); w.light(0xffc890, 3, 7, 0, DH, -LC - 2.5);

    // ================================================================================================================================
    //  The decor — all of it in one group, so the corridor can be mirrored in one go
    // ================================================================================================================================
    const deco = new THREE.Group(); w.add(deco);
    const M = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; m.castShadow = !!o.cast; m.receiveShadow = true; (o.to || deco).add(m); return m; };
    const BX = (w_, h_, d_) => new THREE.BoxGeometry(w_, h_, d_);
    // a group on a wall: local +z points into the corridor, local +x runs along the wall
    const onWall = (side, z, parent = deco) => { const g = new THREE.Group(); g.position.set(side * X, 0, z); g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; parent.add(g); return g; };
    const goldM = plainMaterial(GOLD, { metalness: 1, roughness: 0.32 });
    const woodM = plainMaterial(0x5a3422, { roughness: 0.45 });
    const darkM = plainMaterial(0x14100e, { roughness: 0.8 });
    const plateTex = (n, col = '#e8c673') => { const t = textTexture(n, { w: 256, h: 128, color: col, bg: '#1a120e', border: '#d8a94a', size: 72 }); return t; };

    // ---- doors: 301-311 on the left (west), 302-312 on the right (east) -------------------------------------------------------------
    const doors = {};
    const makeDoor = (side, z, num, parent = deco) => {
      const g = onWall(side, z, parent);
      const frameT = M(BX(1.36, 0.12, 0.1), goldM, 0, 2.46, 0.05, { to: g });
      const frameL = M(BX(0.1, 2.46, 0.1), goldM, -0.63, 1.23, 0.05, { to: g }), frameR = M(BX(0.1, 2.46, 0.1), goldM, 0.63, 1.23, 0.05, { to: g });
      const hinge = new THREE.Group(); hinge.position.set(-0.56, 0, 0.05); g.add(hinge);
      const leaf = M(BX(1.12, 2.38, 0.06), woodM, 0.56, 1.19, 0, { to: hinge });
      for (const [py, ph] of [[1.75, 0.9], [0.62, 0.9]]) M(BX(0.8, ph, 0.02), plainMaterial(0x6a4028, { roughness: 0.4 }), 0.56, py, 0.04, { to: hinge });
      M(BX(0.12, 0.05, 0.08), goldM, 1.0, 1.05, 0.06, { to: hinge });
      const pmat = new THREE.MeshBasicMaterial({ map: plateTex(String(num)), toneMapped: false });
      const plate = M(new THREE.PlaneGeometry(0.42, 0.21), pmat, 0.56, 1.6, 0.058, { to: hinge });
      const glow = M(BX(1.0, 0.025, 0.02), glowMaterial(0xffc070, 1.2), 0, 0.02, 0.02, { to: g });    // light under the door
      const spill = M(new THREE.PlaneGeometry(1.12, 2.38), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }), 0, 1.19, 0.012, { to: g }); spill.visible = false;
      const d = { g, hinge, leaf, plate, pmat, glow, spill, side, z, num, frame: [frameT, frameL, frameR] };
      doors[num] = d;
      return d;
    };
    DOOR_Z.forEach((z, i) => { makeDoor(-1, z, 301 + i * 2); makeDoor(1, z, 302 + i * 2); });
    const dnd = (d) => { const s = M(new THREE.PlaneGeometry(0.16, 0.38), new THREE.MeshBasicMaterial({ map: textTexture('DO NOT\nDISTURB', { w: 128, h: 300, color: '#fff', bg: '#a01828', size: 30 }), toneMapped: false }), 1.0, 0.86, 0.075, { to: d.hinge }); return s; };
    const dnd304 = dnd(doors[304]), dnd303 = dnd(doors[303]); dnd303.visible = false;

    // ---- paintings ---------------------------------------------------------------------------------------------------------------------
    const PT = paintingTextures(); w.ownTextures.push(...Object.values(PT));
    const paintings = {};
    const painting = (key, side, z, tex) => {
      const g = onWall(side, z); const inner = new THREE.Group(); inner.position.set(0, 1.78, 0.04); g.add(inner);
      M(BX(1.34, 0.98, 0.06), goldM, 0, 0, 0, { to: inner });
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
      M(new THREE.PlaneGeometry(1.12, 0.78), mat, 0, 0, 0.036, { to: inner });
      paintings[key] = { g, inner, mat, tex, side, z };
    };
    painting('portrait', -1, -10, PT.portrait);
    painting('ship', 1, -18, PT.ship);
    painting('hotel', -1, -26, PT.hotel);
    painting('fruit', 1, -34, PT.fruit);
    painting('moon', -1, -42, PT.moon);
    painting('lighthouse', 1, -50, PT.lighthouse);
    // the evacuation plan (YOU ARE HERE, on floor 3, in a corridor shaped like a loop)
    const planG = onWall(-1, -50);
    M(BX(1.0, 0.72, 0.03), plainMaterial(0xe8e4d8, { roughness: 0.6 }), 0, 1.78, 0.03, { to: planG });
    const planMat = new THREE.MeshBasicMaterial({ map: PT.plan3, toneMapped: false });
    M(new THREE.PlaneGeometry(0.92, 0.64), planMat, 0, 1.78, 0.05, { to: planG });

    // ---- sconces: a pair at every gap between doors ------------------------------------------------------------------------------------
    const sconces = [];
    for (const z of [-10, -18, -26, -34, -42, -50, -62]) for (const side of [-1, 1]) {
      const g = onWall(side, z);
      M(BX(0.16, 0.34, 0.05), goldM, 0, 2.95, 0.03, { to: g });
      const mat = glowMaterial(0xffd8a0, 1.6);
      const shade = M(new THREE.CylinderGeometry(0.1, 0.17, 0.26, 12), mat, 0, 3.05, 0.22, { to: g });
      const off = M(new THREE.CylinderGeometry(0.1, 0.17, 0.26, 12), plainMaterial(0x3a3028, { roughness: 0.7 }), 0, 3.05, 0.22, { to: g }); off.visible = false;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xffc070, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.set(0, 3.0, 0.35); halo.scale.set(1.9, 1.9, 1); g.add(halo);
      sconces.push({ side, z, mat, shade, off, halo, base: mat.color.clone() });
    }
    const sconceAt = (side, z) => sconces.find((s) => s.side === side && s.z === z);
    const setSconce = (s, on, color = null) => { s.shade.visible = on; s.halo.visible = on; s.off.visible = !on; if (color !== null) s.mat.color.copy(color); };

    // ---- the furniture of a hotel corridor (wall-mounted, so the floor can come and go) --------------------------------------------------
    // (all of it sits above the chair rail at 1.18 m, so nothing pokes through the panelling)
    const extinguisher = (z) => { const g = onWall(-1, z); M(BX(0.5, 0.86, 0.18), plainMaterial(0xd8d4cc, { roughness: 0.5 }), 0, 1.68, 0.09, { to: g }); M(new THREE.CylinderGeometry(0.1, 0.1, 0.58, 12), plainMaterial(0xc0202a, { roughness: 0.35 }), 0, 1.64, 0.21, { to: g, cast: true }); M(new THREE.PlaneGeometry(0.4, 0.12), new THREE.MeshBasicMaterial({ map: textTexture('FIRE', { w: 128, h: 40, color: '#fff', bg: '#b0101c', size: 30 }), toneMapped: false }), 0, 2.24, 0.19, { to: g }); return g; };
    const ext1 = extinguisher(-18), ext2 = extinguisher(-20.4); ext2.visible = false;
    const vaseShelf = onWall(1, -10); M(BX(0.9, 0.05, 0.3), goldM, 0, 1.36, 0.15, { to: vaseShelf });
    const vase = new THREE.Group(); vaseShelf.add(vase);
    M(new THREE.CylinderGeometry(0.09, 0.13, 0.4, 14), plainMaterial(0x2a4aa0, { roughness: 0.2, metalness: 0.2 }), 0, 1.59, 0.15, { to: vase });
    for (let k = 0; k < 5; k++) M(new THREE.SphereGeometry(0.07, 8, 6), plainMaterial([0xffe0e8, 0xff5a7a, 0xffffff][k % 3], { roughness: 0.6 }), Math.cos(k * 1.3) * 0.12, 1.88 + (k % 2) * 0.08, 0.15 + Math.sin(k * 1.3) * 0.08, { to: vase });
    const planter = onWall(1, -26); M(BX(0.8, 0.32, 0.3), plainMaterial(0x3a2a20, { roughness: 0.6 }), 0, 1.42, 0.16, { to: planter });
    for (let k = 0; k < 9; k++) { const lf = M(new THREE.SphereGeometry(0.17, 8, 6), plainMaterial(0x2a6a3a, { roughness: 0.7 }), -0.3 + (k % 5) * 0.15, 1.72 + (k % 3) * 0.16, 0.16 + ((k * 7) % 3 - 1) * 0.05, { to: planter }); lf.scale.y = 1.5; }
    const phoneG = onWall(-1, -34); M(BX(0.5, 0.05, 0.26), goldM, 0, 1.32, 0.13, { to: phoneG });
    const phone = new THREE.Group(); phone.position.y = 0.32; phoneG.add(phone);
    M(BX(0.3, 0.12, 0.22), plainMaterial(0xe8dcc0, { roughness: 0.4 }), 0, 1.09, 0.13, { to: phone });
    const handset = M(BX(0.34, 0.06, 0.08), plainMaterial(0xe8dcc0, { roughness: 0.4 }), 0, 1.18, 0.13, { to: phone });
    const alarm = onWall(1, -42); M(BX(0.22, 0.28, 0.08), plainMaterial(0xc81a24, { roughness: 0.4 }), 0, 1.45, 0.04, { to: alarm }); M(new THREE.PlaneGeometry(0.18, 0.07), new THREE.MeshBasicMaterial({ map: textTexture('FIRE', { w: 128, h: 50, color: '#fff', size: 36 }), toneMapped: false, transparent: true }), 0, 1.53, 0.085, { to: alarm });
    const tray = (x, z) => { const g = new THREE.Group(); g.position.set(x, 0, z); deco.add(g); M(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 20), plainMaterial(0xd8dce4, { metalness: 0.9, roughness: 0.2 }), 0, 0.03, 0, { to: g }); M(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), plainMaterial(0xd8dce4, { metalness: 0.9, roughness: 0.2 }), 0, 0.04, 0, { to: g }); return g; };
    const tray1 = tray(1.85, -57.2), tray2 = tray(1.85, -56.4); tray2.visible = false;     // outside 314, at the far end
    // the ceiling speaker (it plays the music; a green light says so)
    const speaker = M(new THREE.CircleGeometry(0.22, 18), plainMaterial(0x2a2a2a, { roughness: 0.6 }), 0, H - 0.012, -4.2, { rx: Math.PI / 2 });
    void speaker;
    const led = M(new THREE.SphereGeometry(0.03, 8, 6), glowMaterial(0x6cf0b2, 2), 0.27, H - 0.03, -4.2);
    // carpet arrows ("this way"): two gold arrows at the start
    const arrowTex = textTexture('▲', { w: 128, h: 128, color: '#e8c673', size: 110 });
    const arrows = [-4.6, -7.0].map((z) => M(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), 0, 0.012, z, { rx: -Math.PI / 2 }));
    // wet footprints from the far door into 314 (an anomaly) and a stain on the ceiling (another)
    const prints = new THREE.Group(); deco.add(prints); prints.visible = false;
    const printMat = new THREE.MeshBasicMaterial({ color: 0x0c0608, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    for (let k = 0; k < 8; k++) { const u = k / 7; M(new THREE.CircleGeometry(0.09, 10), printMat, -0.2 + u * 1.9 + (k % 2) * 0.16, 0.013, -62.6 + u * 6.4, { rx: -Math.PI / 2, to: prints }).scale.set(1, 1.8, 1); }
    const stain = M(new THREE.PlaneGeometry(1.6, 1.3), new THREE.MeshBasicMaterial({ map: softTexture('shadow'), transparent: true, depthWrite: false, color: 0x301008 }), 0.5, H - 0.015, -24, { rx: Math.PI / 2 }); stain.visible = false;
    // a figure at the far end (an anomaly; it just stands there)
    const figure = new THREE.Group(); figure.position.set(0.8, 0, -61.6); deco.add(figure); figure.visible = false;
    { const fm = plainMaterial(0x08080a, { roughness: 0.9 }); M(new THREE.CylinderGeometry(0.2, 0.26, 1.25, 10), fm, 0, 0.9, 0, { to: figure }); M(new THREE.SphereGeometry(0.17, 10, 8), fm, 0, 1.72, 0, { to: figure }); M(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 10), plainMaterial(0x5a0a14), 0, 1.86, 0, { to: figure }); }
    // an extra door where there is none (an anomaly)
    const extraDoor = makeDoor(1, -59, 315); extraDoor.g.visible = false; extraDoor.g.position.x -= 0.13;   // (stands proud of the panelling)
    // the clock and the round counter on the north wall; a second counter over the south door (you see it when you turn back)
    const clockC = document.createElement('canvas'); clockC.width = 256; clockC.height = 128; const cg = clockC.getContext('2d');
    const clockTex = new THREE.CanvasTexture(clockC); clockTex.colorSpace = THREE.SRGBColorSpace; w.ownTextures.push(clockTex);
    const drawClock = (txt) => { cg.fillStyle = '#0c0810'; cg.fillRect(0, 0, 256, 128); cg.strokeStyle = '#d8a94a'; cg.lineWidth = 8; cg.strokeRect(4, 4, 248, 120); cg.fillStyle = '#ff6a5a'; cg.font = '84px "Archivo Black", Impact, sans-serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.fillText(txt, 128, 70); clockTex.needsUpdate = true; };
    drawClock('3:03');
    M(new THREE.PlaneGeometry(0.86, 0.43), new THREE.MeshBasicMaterial({ map: clockTex, toneMapped: false }), 1.76, 2.3, -LC + 0.02);
    const cC = document.createElement('canvas'); cC.width = 512; cC.height = 192; const cc = cC.getContext('2d');
    const cTex = new THREE.CanvasTexture(cC); cTex.colorSpace = THREE.SRGBColorSpace; w.ownTextures.push(cTex);
    M(new THREE.PlaneGeometry(2.1, 0.79), new THREE.MeshBasicMaterial({ map: cTex, toneMapped: false }), 0, 3.5, -LC + 0.02);
    M(new THREE.PlaneGeometry(2.1, 0.79), new THREE.MeshBasicMaterial({ map: cTex, toneMapped: false }), 0, 3.5, -0.02, { ry: Math.PI });
    M(new THREE.PlaneGeometry(2.6, 0.32), new THREE.MeshBasicMaterial({ map: textTexture('ALL NORMAL? KEEP GOING ↑', { w: 768, h: 96, color: '#6cf0b2', size: 50 }), transparent: true, toneMapped: false }), 0, 4.1, -LC + 0.03);
    M(new THREE.PlaneGeometry(2.6, 0.32), new THREE.MeshBasicMaterial({ map: textTexture('ANYTHING DIFFERENT? BACK ↓', { w: 768, h: 96, color: '#ffb35a', size: 50 }), transparent: true, toneMapped: false }), 0, 4.1, -0.03, { ry: Math.PI });

    // ================================================================================================================================
    //  The floor, act by act (each act its own set of platforms; route[] runs south → north, the bot and the hint follow it)
    // ================================================================================================================================
    const carpetMat = new THREE.MeshStandardMaterial({ map: getTexture('carpet'), color: 0x9a3040, roughness: 0.95 });
    const crackMat = new THREE.MeshStandardMaterial({ map: getTexture('carpet'), color: 0x5a2028, roughness: 1 });
    const route = [[], [], [], []], extras = [[], [], [], []];
    const floor = (act, z0, z1, o = {}) => {
      const p = w.plat({ x: o.x ?? 0, y: o.y ?? 0, z: (z0 + z1) / 2, w: o.w ?? 2 * X, d: z0 - z1, h: o.h ?? 0.5, tex: 'carpet', color: 0xffffff, roughness: 0.95, radius: 0.03 });
      p.group.children[0].material = o.mat || carpetMat;
      p.kind = o.kind || 'floor'; p.act = act;
      route[act].push(p);
      return p;
    };
    // a carpet dolly riding rails across a gap (the bot and the hint call it a ferry); `ghost`: it does not render (its rim glows)
    const ferries = [];
    const ferryAcross = (act, zNear, zFar, phase, ghost = false) => {
      const D = 2.4, zc = (zNear + zFar) / 2, A = (zNear - zFar - D) / 2 - 0.45;
      const o = { x: 0, y: 0, z: zc, w: 3.4, d: D, h: 0.3 };
      const p = ghost ? ghostPlat(w, { ...o, color: 0xb9a15a }) : w.plat({ ...o, tex: 'metal', color: 0xb9a15a, roughness: 0.35, metalness: 0.7, radius: 0.04 });
      p.kind = 'ferry'; p.act = act; route[act].push(p);
      w.mover(p, (t) => ({ z: A * Math.sin(t * 0.62 + phase) }));
      for (const sx of [-1, 1]) { const r = w.box({ x: sx * 1.2, y: -0.9, z: zc, w: 0.12, h: 0.12, d: zNear - zFar + 0.6, color: 0x8a8d95, metal: 0.8, rough: 0.4, shadow: false }); extras[act].push((on) => { r.visible = on; }); }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const leg = w.box({ x: sx * 1.2, y: -0.55, z: zc + sz * 0.9, w: 0.1, h: 0.4, d: 0.1, color: 0x2a2a30, static: false }); p.attach(leg); if (ghost) leg.visible = false; }
      ferries.push(p);
      return p;
    };
    // a stretch of floor that blinks in and out of existence (it flickers for the last 0.6 s before it goes)
    const blinks = [];
    const BL = { P: 4.6, ON: 3.2 };
    const blinkOn = (b, t) => ((t + b.off) % BL.P + BL.P) % BL.P < BL.ON;
    const blinker = (act, z0, z1, off) => { const p = floor(act, z0, z1, { kind: 'blink', mat: crackMat }); const b = { p, off, on: true }; p.blink = b; blinks.push(b); return b; };
    // ---- Act I: the plain corridor
    floor(0, 0.2, -LC - 0.2);
    // ---- Act II: Mind the Gap (renovation: the carpet is up)
    floor(1, 0.2, -8);
    floor(1, -10.8, -14);
    const rolls = floor(1, -15.4, -17.4, { y: 0.7, h: 0.3, kind: 'rolls' });
    { const g = new THREE.Group(); rolls.group.add(g); g.position.y = -0.15; const rm = plainMaterial(0x8a2a38, { roughness: 0.9 }); for (const [dz, dy] of [[-0.5, -0.2], [0.5, -0.2], [0, 0.2]]) for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.3, 16), rm); c.rotation.z = Math.PI / 2; c.position.set(sx * 1.2, dy - 0.25, dz * 1.6); g.add(c); } rolls.group.children[0].visible = false; }
    floor(1, -19.8, -22.4);
    ferryAcross(1, -22.4, -30.4, 0);
    floor(1, -30.4, -33);
    floor(1, -33, -39, { x: -0.9, w: 0.7, h: 0.3, kind: 'beam', mat: plainMaterial(0x7a5434, { roughness: 0.8 }) });
    floor(1, -39, -41.4);
    ferryAcross(1, -41.4, -49.4, 2.4);
    floor(1, -49.4, -52);
    floor(1, -54.6, -LC - 0.2);
    // ---- Act III: Turndown Service (laundry chutes, a towel trolley, a cart that bursts out of 309)
    floor(2, 0.2, -10);
    const chutes = [];
    const chute = (z0, z1, phase) => {
      const p = floor(2, z0, z1, { kind: 'chute' });
      const zc = (z0 + z1) / 2, d = z0 - z1;
      const strip = [];
      for (const sz of [z0 - 0.06, z1 + 0.06]) strip.push(w.box({ x: 0, y: 0.012, z: sz, w: 2 * X - 0.1, h: 0.02, d: 0.1, glow: 0xffa21f, glowIntensity: 1.6, shadow: false }));
      const leaves = [];
      for (const sx of [-1, 1]) { const hg = new THREE.Group(); hg.position.set(sx * (X - 0.02), -0.05, zc); w.add(hg); const lf = new THREE.Mesh(new THREE.BoxGeometry(X - 0.04, 0.08, d - 0.1), plainMaterial(0x6a5040, { roughness: 0.7 })); lf.position.x = -sx * (X - 0.04) / 2; hg.add(lf); hg.visible = false; leaves.push({ hg, sx }); }
      const c = { p, z0, z1, phase, strip, leaves, open: false };
      chutes.push(c);
      return c;
    };
    const CH = { P: 6.0, OPEN: 2.6, WARN: 1.0 };
    chute(-10, -15, 0.0);
    floor(2, -15, -27);
    chute(-27, -32, 2.1);
    floor(2, -32, -40);
    chute(-40, -45, 4.2);
    floor(2, -45, -50);
    chute(-50, -55, 1.0);
    floor(2, -55, -LC - 0.2);
    const chuteState = (c, t) => { const u = ((t + c.phase) % CH.P + CH.P) % CH.P; return u < CH.OPEN ? 'open' : u > CH.P - CH.WARN ? 'warn' : 'shut'; };
    const chuteOpenSoon = (c, t, ahead) => { for (let k = 0; k <= 8; k++) if (chuteState(c, t + (ahead * k) / 8) === 'open') return true; return false; };
    // the towel trolley: low enough to hop, wide enough that you have to
    const trolley = w.hazard({ x: 0, y: 0.38, z: -22, w: 4.2, h: 0.72, d: 1.1, color: 0xffffff, move: (t) => ({ z: 3.6 * Math.sin(t * 0.8) }) });
    trolley.core.visible = false; trolley.shell.visible = false; trolley.jumpable = true;
    towelTrolley(trolley.group);
    // the cart from 309: the door opens (that is the tell), a laundry cart shoots across the corridor and back
    const CART = { P: 5.0, OPEN: 0.9, OUT: 1.0 };
    const cartPhase = (t) => ((t % CART.P) + CART.P) % CART.P;
    const cartX = (t) => { const u = cartPhase(t); if (u < CART.OPEN) return null; const k = (u - CART.OPEN) / CART.OUT; if (k >= 2) return null; const e = k < 1 ? k : 2 - k; return -X + 0.2 + e * (2 * X - 1.0); };
    const cart = w.hazard({ x: -X + 0.6, y: 0.6, z: -38, w: 1.0, h: 1.2, d: 1.15, color: 0xffffff });
    cart.core.visible = false; cart.shell.visible = false;
    laundryCart(cart.group);
    cart.move = (t) => { const x = cartX(t); return { x: (x ?? -X - 1) - cart.base.x }; };
    cart.predict = (t) => actNow === 2 && cartX(t) !== null;
    // ---- Act IV: Reality Unstable (a floor that does not render, crumbling carpet, a floor that blinks, an invisible dolly, a bridge)
    floor(3, 0.2, -8);
    const ghost = ghostPlat(w, { x: 0, y: 0, z: -11, w: 2 * X, d: 6, h: 0.5, color: 0x9a3040 });
    ghost.kind = 'ghost'; ghost.act = 3; route[3].push(ghost);
    for (let k = 0; k < 4; k++) { const p = floor(3, -14 - k * 2.5, -16.5 - k * 2.5, { kind: 'crumble', mat: crackMat }); w.crumble(p, { delay: 0.55, gone: 2.6 }); }
    floor(3, -24, -27);
    blinker(3, -27.6, -30.6, 0); blinker(3, -31.2, -34.2, 4.6 - 0.45); blinker(3, -34.8, -37.8, 4.6 - 0.9);
    floor(3, -38.4, -40.6);
    ferryAcross(3, -40.6, -48, 1.2, true);
    floor(3, -48, -50.2);
    const bridge = floor(3, -52.8, -56.1, { w: 2.2, kind: 'crumble', mat: crackMat });
    w.crumble(bridge, { delay: 1.0, gone: 2.4 });
    floor(3, -56.1, -LC - 0.2);
    // (the crumbling carpet is darker and threadbare: that is the tell; the ghost floor and the ghost dolly glow at the rim)

    let actNow = -1;
    const showAct = (a) => {
      actNow = a;
      for (let k = 0; k < 4; k++) { for (const p of route[k]) p.setEnabled(k === a); for (const f of extras[k]) f(k === a); }
      trolley.enabled = a === 2; trolley.group.visible = a === 2;
      if (a !== 2) { cart.enabled = false; cart.group.visible = false; }
      for (const c of chutes) { c.open = false; for (const s of c.strip) s.visible = a === 2; for (const l of c.leaves) l.hg.visible = false; }
      if (a !== 3) for (const s of sconces) setSconce(s, lampOn(s));
      dark = 1; for (const l of lights) l.intensity = 7;
    };
    const lampOn = (s) => !(cur && ((cur.id === 'lampOut' && s.z === -34)));

    // ================================================================================================================================
    //  The anomalies. seeZ: where a sharp-eyed guest notices it (the bot turns back there); hint: the honest version
    // ================================================================================================================================
    const A = {};
    const def = (id, name, hint, seeZ, on, off, pool) => { A[id] = { id, name, hint, seeZ, on, off, pool }; };
    const swapMaps = (a, b) => { const t = paintings[a].mat.map; paintings[a].mat.map = paintings[b].mat.map; paintings[b].mat.map = t; };
    const doorByNum = (n) => doors[n];
    def('swap', 'two paintings swapped places', 'Look at the paintings on the left wall.', -7, () => swapMaps('portrait', 'moon'), () => swapMaps('portrait', 'moon'), 1);
    def('crooked', 'a crooked painting', 'Look at the paintings on the right wall.', -14, () => { paintings.ship.inner.rotation.z = 0.24; }, () => { paintings.ship.inner.rotation.z = 0; }, 1);
    def('portraitBack', 'the portrait turned its back on you', 'Look at the portrait. The man in it. Me.', -7, () => { paintings.portrait.mat.map = PT.portraitBack; }, () => { paintings.portrait.mat.map = PT.portrait; }, 1);
    def('redLamp', 'a red lamp', 'Look at the wall lamps.', -22, () => setSconce(sconceAt(-1, -26), true, new THREE.Color(0xff2a2a).multiplyScalar(1.8)), () => { const s = sconceAt(-1, -26); setSconce(s, true, s.base); }, 1);
    def('lampOut', 'two lamps out', 'Look at the wall lamps.', -30, () => { setSconce(sconceAt(-1, -34), false); setSconce(sconceAt(1, -34), false); }, () => { setSconce(sconceAt(-1, -34), true); setSconce(sconceAt(1, -34), true); }, 1);
    def('noExt', 'the fire extinguisher is gone', 'Look along the left wall.', -14, () => { ext1.visible = false; }, () => { ext1.visible = true; }, 1);
    def('figure', 'somebody standing at the end', 'Look at the far end. Something is standing there.', -30, () => { figure.visible = true; }, () => { figure.visible = false; }, 1);
    def('ajar', 'room 306 was open', 'Look at the doors on the right.', -18, () => { doors[306].hinge.rotation.y = -0.9; doors[306].spill.visible = true; }, () => { doors[306].hinge.rotation.y = 0; doors[306].spill.visible = false; }, 1);
    def('extraDoor', 'a thirteenth door', 'Count the doors on the right.', -44, () => { extraDoor.g.visible = true; }, () => { extraDoor.g.visible = false; }, 1);
    def('blueCarpet', 'the carpet was blue', 'Look down. At the carpet.', -2.5, () => { carpetMat.color.set(0x2a4aa0); }, () => { carpetMat.color.set(0x9a3040); }, 1);
    def('stain', 'a stain on the ceiling', 'Look up.', -20, () => { stain.visible = true; }, () => { stain.visible = false; }, 1);
    def('number', 'room 305 was room 350', 'Read the door numbers on the left.', -20, () => { doorByNum(305).pmat.map = PT.n350; }, () => { doorByNum(305).pmat.map = doorByNum(305).pmatBase; }, 2);
    def('clock', 'the clock said 3:30', 'Read the clock at the far end.', -44, () => drawClock('3:30'), () => drawClock('3:03'), 2);
    def('clockRun', 'the clock was running backwards', 'Watch the clock at the far end for a few seconds.', -44, () => { clockRun = 1; }, () => { clockRun = 0; drawClock('3:03'); }, 2);
    def('tinyDoor', 'room 310 had a very small door', 'Look at the doors on the right. All of them.', -33, () => { doors[310].g.scale.set(0.62, 0.62, 1); }, () => { doors[310].g.scale.set(1, 1, 1); }, 2);
    def('noVase', 'the flowers were gone', 'Look along the right wall, near the start.', -6, () => { vase.visible = false; }, () => { vase.visible = true; }, 2);
    def('noPlant', 'the plant was gone', 'Look along the right wall.', -22, () => { planter.visible = false; }, () => { planter.visible = true; }, 2);
    def('noTray', 'the room-service tray was gone', 'Look at the floor by the first door.', -2.5, () => { tray1.visible = false; }, () => { tray1.visible = true; }, 2);
    def('twoTrays', 'two room-service trays', 'Look at the floor by the first door.', -2.5, () => { tray2.visible = true; }, () => { tray2.visible = false; }, 2);
    def('twoPaint', 'the same painting twice', 'Look at the paintings on the right wall.', -30, () => { paintings.fruit.mat.map = PT.ship; }, () => { paintings.fruit.mat.map = PT.fruit; }, 2);
    def('twoExt', 'two fire extinguishers', 'Look along the left wall.', -14, () => { ext2.visible = true; }, () => { ext2.visible = false; }, 2);
    def('flicker', 'the lamps were flickering', 'Look at the wall lamps, about a third of the way down.', -14, () => { flick = true; }, () => { flick = false; for (const s of sconces) if (s.z === -18) setSconce(s, true); }, 2);
    def('arrows', 'the carpet arrows pointed back', 'Look down at the arrows on the carpet.', -2.5, () => { for (const a of arrows) a.rotation.z = Math.PI; }, () => { for (const a of arrows) a.rotation.z = 0; }, 2);
    def('prints', 'wet footprints into 301', 'Look at the carpet by the first door.', -2.5, () => { prints.visible = true; }, () => { prints.visible = false; }, 2);
    def('dnd', 'the Do Not Disturb sign moved', 'Look at the door handles of 303 and 304.', -10, () => { dnd304.visible = false; dnd303.visible = true; }, () => { dnd304.visible = true; dnd303.visible = false; }, 2);
    def('noAlarm', 'the fire alarm was gone', 'Look along the right wall, near the end.', -38, () => { alarm.visible = false; }, () => { alarm.visible = true; }, 2);
    def('knock', 'somebody knocking in 307', 'Listen. Walk past room 307 on the left.', -29, () => { snd = 'knock'; }, () => { snd = null; doors[307].hinge.rotation.y = 0; }, 3);
    def('phone', 'the phone was ringing', 'Listen. The house phone on the left wall.', -31, () => { snd = 'phone'; }, () => { snd = null; phone.rotation.z = 0; handset.position.y = 1.18; }, 3);
    def('music', 'the music stopped', 'Listen. And look at the little green light on the ceiling.', -3, () => { led.visible = false; game.audio.stopMusic(); }, () => { led.visible = true; if (game.world === w && game.state !== 'title') game.audio.playMusic('hotel_dark'); }, 3);
    // the scripted ones
    def('mirror', 'the whole corridor was mirrored', 'Read the door numbers. They are backwards. So is everything else.', -14, () => { deco.scale.x = -1; }, () => { deco.scale.x = 1; }, 0);
    def('upside', 'a painting hung upside down', 'Look at the paintings on the left wall.', -19, () => { paintings.hotel.inner.rotation.z = Math.PI; }, () => { paintings.hotel.inner.rotation.z = 0; }, 0);
    def('exitDoor', 'an EXIT door that is never there', 'The glowing EXIT door on the left. It is new. New is different.', -24, () => { exitDoor.show(true); }, () => { exitDoor.show(false); }, 0);
    def('counter98', 'the counter said 9 of 8', 'Look at the round counter over the far door. Nine. Of eight.', -1.5, () => {}, () => {}, 0);
    for (const n of Object.keys(doors)) doors[n].pmatBase = doors[n].pmat.map;
    let clockRun = 0, flick = false, snd = null;

    // ---- the "way out" (round 7): an EXIT door that is not one (it is new, so it is an anomaly; behind it is a closet with no floor)
    const exitDoor = (() => {
      const z = -51, g = onWall(-1, z, w.scene);
      g.position.x += 0.13;                                     // (it stands proud of the panelling: it was not built with the wall)
      const frame = plainMaterial(GOLD, { metalness: 1, roughness: 0.3 });
      for (const sx of [-1, 1]) M(BX(0.14, 2.7, 0.14), frame, sx * 0.72, 1.35, 0.07, { to: g });
      M(BX(1.58, 0.14, 0.14), frame, 0, 2.7, 0.07, { to: g });
      const black = M(new THREE.PlaneGeometry(1.3, 2.6), plainMaterial(0x020203, { roughness: 1 }), 0, 1.3, 0.015, { to: g });
      const hinge = new THREE.Group(); hinge.position.set(-0.65, 0, 0.06); g.add(hinge);
      M(BX(1.3, 2.6, 0.06), plainMaterial(game.baby ? 0x6b3a2a : 0x2a6a4a, { roughness: 0.4 }), 0.65, 1.3, 0, { to: hinge });
      const sign = M(new THREE.PlaneGeometry(1.5, 0.42), new THREE.MeshBasicMaterial({ map: textTexture(game.baby ? 'EXIT (decoy)' : 'EXIT ➜', { w: 512, h: 144, color: '#6cf0b2', size: 96 }), transparent: true, toneMapped: false, color: new THREE.Color(1.8, 1.8, 1.8) }), 0, 3.1, 0.06, { to: g });
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0x6cf0b2, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })); halo.position.set(0, 3.1, 0.4); halo.scale.set(3, 1.6, 1); g.add(halo);
      void black; void sign;
      let shown = false, used = false;
      const it = w.interactable({ x: -X + 0.4, y: 1.3, z, w: 0.6, h: 2.6, d: 1.4, range: 3.5, label: () => (game.baby ? 'Open the EXIT door (decoy)' : 'Open the EXIT door'), enabled: () => shown && !used,
        onUse: () => {
          if (used || game.state !== 'playing') return; used = true; game.audio.click();
          const t0 = performance.now();
          const swing = () => { const k = Math.min(1, (performance.now() - t0) / 450); hinge.rotation.y = -k * 1.5; if (k < 1) later(30, swing); else later(380, () => { if (game.state === 'playing' && shown) { game.say('hotel.l14.closet', { priority: 2 }); game.kill('fake'); } }); };
          swing();
        } });
      void it;
      g.visible = false;
      w.onRespawn(() => { used = false; hinge.rotation.y = 0; });
      return { show(on) { shown = on; g.visible = on; used = false; hinge.rotation.y = 0; } };
    })();

    // ================================================================================================================================
    //  The rounds
    // ================================================================================================================================
    let round = 1, phase = 'rounds', cur = null, seen = false, roundT = 0, roundId = 0, expired = false, crashed = false, lapSaid = false;
    let mirRound = 3, upRound = 5;
    const used = new Set();
    const pickFrom = (pools) => { const c = Object.values(A).filter((a) => pools.includes(a.pool) && !used.has(a.id)); const a = c.length ? c[rnd(c.length)] : null; if (a) used.add(a.id); return a; };
    const rollRound = (r) => {
      if (r === 1) return null;
      if (r === 2) return Math.random() < 0.55 ? pickFrom([1]) : null;
      if (r === 3 || r === 4) return r === mirRound ? A.mirror : Math.random() < 0.5 ? pickFrom([1, 2]) : null;
      if (r === 5 || r === 6) return r === upRound ? A.upside : Math.random() < 0.5 ? pickFrom([2, 3]) : null;
      if (r === 7) return A.exitDoor;
      if (r === 8) return Math.random() < 0.6 ? pickFrom([1, 2, 3]) : null;
      return A.counter98;
    };
    const rerollAct = (a) => { if (a === 1) mirRound = 3 + rnd(2); if (a === 2) upRound = 5 + rnd(2); };
    const drawCount = () => {
      cc.fillStyle = '#0c0810'; cc.fillRect(0, 0, 512, 192); cc.strokeStyle = '#d8a94a'; cc.lineWidth = 8; cc.strokeRect(4, 4, 504, 184);
      cc.textAlign = 'center'; cc.textBaseline = 'middle';
      const shown = phase === 'encore' || phase === 'stairs' ? 9 : phase === 'exitLap' ? 8 : round;
      cc.fillStyle = '#d8a94a'; cc.font = '28px "Archivo Black", Impact, sans-serif';
      cc.fillText(phase === 'exitLap' ? 'ALL ROUNDS CLEARED' : `ACT ${['I', 'II', 'III', 'IV', '★'][phase === 'rounds' ? ACT_OF[round] : 4]} · ${phase === 'rounds' ? ACTS[ACT_OF[round]].toUpperCase() : 'ENCORE'}`, 256, 34);
      cc.fillStyle = '#ffe0a0'; cc.font = '74px "Archivo Black", Impact, sans-serif';
      cc.fillText(phase === 'exitLap' ? 'EXIT ↑' : `ROUND ${shown} / ${NEED}`, 256, 100);
      for (let k = 0; k < NEED; k++) { cc.fillStyle = k < Math.min(shown - 1, NEED) || phase === 'exitLap' ? '#6cf0b2' : '#3a2a30'; cc.beginPath(); cc.arc(256 + (k - 3.5) * 34, 158, 10, 0, 7); cc.fill(); }
      if (phase === 'rounds' && round === 6 && !game.baby && !expired) { cc.fillStyle = '#ffb35a'; cc.font = '24px "Archivo Black", Impact, sans-serif'; cc.fillText(`⌛ ${Math.max(0, Math.ceil(EXPIRE - roundT))}s*`, 452, 158); }
      cTex.needsUpdate = true;
    };
    const setup = () => {
      // put the corridor back to normal, then apply this round's act and anomaly
      for (const a of Object.values(A)) if (a.active) { a.off(); a.active = false; }
      cur = null;
      showAct(phase === 'encore' ? 0 : phase === 'exitLap' ? 3 : ACT_OF[round]);
      cur = phase === 'exitLap' ? null : phase === 'encore' ? A.counter98 : rollRound(round);
      if (cur) { cur.on(); cur.active = true; }
      seen = false; roundT = 0; roundId++; lapSaid = false; expired = false;
      drawCount();
    };
    const newRound = (banner) => {
      game.ui.fade(true, 70);
      setup();
      game.respawnPlayer(false);                // back to the start of the corridor (also resets crumbled carpet, twists, overlays)
      showAct(phase === 'encore' ? 0 : phase === 'exitLap' ? 3 : ACT_OF[round]);
      if (banner) banner();
      later(160, () => game.ui.fade(false, 320));
    };
    const actBanner = (a) => () => { stageTitle(game, w, a + 1, ACTS.length, ACTS[a]); game.say(`hotel.l14.act${a + 1}`, { priority: 1 }); game.ui.toast(`✔ Checkpoint · Act ${['I', 'II', 'III', 'IV'][a]}`, 'gold'); };
    const decide = (forward) => {
      if (game.state !== 'playing' || w.completed) return;
      if (phase === 'encore') {
        if (forward) { game.audio.buzzer(); game.ui.toast('✘ There was: the counter. 9 / 8 is not a number', ''); game.say('hotel.l14.encore.wrong', { priority: 2 }); newRound(); }
        else openStairs();
        return;
      }
      if (phase !== 'rounds') return;
      const anomalous = !!cur, right = forward ? !anomalous : anomalous;
      if (right) {
        game.audio.ding();
        if (round >= NEED) { phase = 'exitLap'; game.ui.toast(`✔ Correct · ${NEED} / ${NEED}`, 'gold'); game.say('hotel.l14.open', { priority: 2 }); newRound(); exitGoal.on(); return; }
        const nextAct = ACT_OF[round + 1] !== ACT_OF[round];
        round++;
        game.ui.toast(`✔ Correct · round ${round} next`, 'gold');
        if (nextAct) { rerollAct(ACT_OF[round]); newRound(actBanner(ACT_OF[round])); }
        else { newRound(); game.say(round === 2 ? 'hotel.l14.first' : 'hotel.l14.right', { priority: 2 }); }
        if (round === 6 && !game.baby) { game.ui.toast(`Round 5 counts for ${EXPIRE}s* — decide before the counter runs out`, 'gold'); game.say('hotel.l14.expire.warn', { priority: 1 }); }
      } else {
        game.audio.buzzer();
        const back = game.baby ? round : FIRST_OF[ACT_OF[round]];
        game.ui.toast(anomalous ? `✘ There was: ${cur.name}${back < round ? ` · back to round ${back}` : ''}` : `✘ There was nothing${back < round ? ` · back to round ${back}` : ''}`, '');
        game.say(anomalous ? 'hotel.l14.missed' : 'hotel.l14.paranoid', { priority: 2 });
        if (back < round) { round = back; rerollAct(ACT_OF[round]); }
        newRound();
      }
    };
    // the two doorways decide
    w.trigger({ x: 0, y: 1.2, z: -LC - 1.7, w: 3, h: 3, d: 1.2, once: false, onEnter: () => decide(true) });
    w.trigger({ x: 0, y: 1.2, z: 1.7, w: 3, h: 3, d: 1.2, once: false, onEnter: () => decide(false) });

    // ---- after round 8: the far door leads to the exit... with a LEVEL COMPLETE that is not
    const exitGoal = (() => {
      const g = w.goal({ x: 0, y: 0, z: -LC - 2.8, color: 0x6cf0b2, onReach: () => {
        if (phase !== 'exitLap') return;
        g.group.visible = false; g.trig.enabled = false;
        if (!fakeComplete(game, w, { title: 'LEVEL COMPLETE', sub: `Hallway Loop · ${NEED} / ${NEED} rounds · Deaths ${game.deaths}`, say: 'hotel.l14.fakewin', then: startEncore })) game.completeLevel();
      } });
      g.group.scale.setScalar(0.62);
      g.group.visible = false; g.trig.enabled = false;
      return { g, on() { g.group.visible = true; g.trig.enabled = true; g.trig.fired = false; } };
    })();
    function startEncore() {
      phase = 'encore';
      newRound(() => { stageTitle(game, w, 5, ACTS.length, ACTS[4]); game.say('hotel.l14.encore', { priority: 2 }); });
    }
    // ---- the fire stairs: behind the south vestibule, opened by turning back in the encore
    const stairs = fireStairs(w, game);
    function openStairs() {
      phase = 'stairs';
      game.audio.door(); game.audio.ding();
      southBack.setEnabled(false);
      stairs.open();
      for (const a of Object.values(A)) if (a.active) { a.off(); a.active = false; }
      cur = null; drawCount();
      game.ui.toast('✔ Correct · the way out was behind you', 'gold');
      game.say('hotel.l14.encore.right', { priority: 2 });
      w.respawn = { x: 0, y: 0, z: 3.2, yaw: Math.PI };
    }

    // ================================================================================================================================
    //  Per frame: chutes, the cart, flicker, sounds, the clock, twists, the crash, the counter, the host
    // ================================================================================================================================
    let t0 = 0, intro = false, sndT = 0, clockT = 0, clockN = 183, flickT = 0, dark = 0, twisted = 0;
    w.onUpdate((dt, t) => {
      const p = game.player;
      // laundry chutes (act III): amber strip blinks before they open
      if (actNow === 2) for (const c of chutes) {
        const s = chuteState(c, t);
        const open = s === 'open';
        if (open !== c.open) { c.open = open; c.p.body.enabled = !open; c.p.group.visible = !open; for (const l of c.leaves) { l.hg.visible = open; l.hg.rotation.z = open ? l.sx * 1.35 : 0; } if (open && Math.abs(p.z - (c.z0 + c.z1) / 2) < 12) game.audio.crumble(); }
        for (const st of c.strip) st.visible = s !== 'warn' || Math.sin(t * 22) > 0;
      }
      // the cart from 309
      if (actNow === 2) {
        const x = cartX(t);
        cart.enabled = x !== null; cart.group.visible = true;
        const cx = x ?? -X - 1.2; cart.body.setCenter(cx, cart.base.y, cart.base.z); cart.group.position.set(cx, cart.base.y, cart.base.z);
        const u = cartPhase(t), open = u < CART.OPEN + 2 * CART.OUT + 0.3 ? Math.min(1, u / 0.35) : Math.max(0, 1 - (u - CART.OPEN - 2 * CART.OUT - 0.3) / 0.4);
        doors[309].hinge.rotation.y = -1.45 * open; doors[309].spill.visible = open > 0.05;
      } else if (doors[309].hinge.rotation.y !== 0) { doors[309].hinge.rotation.y = 0; doors[309].spill.visible = false; }
      // act IV: the lights cut out for a moment every few seconds (they buzz and flicker first: that is the tell)
      if (actNow === 3) {
        const u = t % 7.5; const k = u > 6.9 ? 0.25 : u > 6.2 ? (Math.sin(t * 40) > 0 ? 1 : 0.4) : 1;
        if (k !== dark) { dark = k; for (const l of lights) l.intensity = 7 * k; for (const s of sconces) setSconce(s, lampOn(s) && k > 0.5); }
      }
      // anomalies that move or make a noise (quietly)
      if (flick) { flickT -= dt; if (flickT <= 0) { flickT = 0.05 + Math.random() * 0.25; const on = Math.random() < 0.6; for (const s of sconces) if (s.z === -18) setSconce(s, on); } }
      if (clockRun) { clockT += dt; if (clockT > 1) { clockT = 0; clockN = clockN <= 0 ? 719 : clockN - 1; drawClock(`${Math.floor(clockN / 60) || 12}:${String(clockN % 60).padStart(2, '0')}`); } }
      if (snd && game.state === 'playing') {
        sndT -= dt;
        const near = snd === 'knock' ? Math.abs(p.z - -30) < 7 : Math.abs(p.z - -34) < 9;
        if (near && sndT <= 0) {
          sndT = snd === 'knock' ? 3.2 : 2.6;
          if (snd === 'knock') { for (let k = 0; k < 3; k++) game.audio._noise({ dur: 0.07, vol: 0.12, f: 260, q: 1.2, when: k * 0.26 }); game.ui.toast('[ knock knock knock ]', ''); }
          else { for (let k = 0; k < 2; k++) game.audio._tone({ f: 1250, type: 'triangle', dur: 0.35, vol: 0.035, when: k * 0.45 }); game.ui.toast('[ a phone rings ]', ''); }
        }
        if (snd === 'knock') doors[307].hinge.rotation.y = near && sndT > 2.4 ? Math.sin(t * 40) * 0.015 : 0;
        if (snd === 'phone') { phone.rotation.z = near && sndT > 1.7 ? Math.sin(t * 50) * 0.04 : 0; handset.position.y = 1.18 + (near && sndT > 1.7 ? Math.abs(Math.sin(t * 30)) * 0.02 : 0); }
      }
      if (game.state !== 'playing' || game.frozen) return;
      roundT += dt;
      // the twists come with their anomalies (and they are the tell)
      if (cur && !seen && p.z <= cur.seeZ) seen = true;
      if (cur === A.mirror && p.z < -14 && twisted !== roundId) { twisted = roundId; twist(game, w, 'mouseX', { sec: 8, say: 'hotel.l14.mirror' }); }
      if (cur === A.upside && p.z < -19 && twisted !== roundId) { twisted = roundId; twist(game, w, 'mouseY', { sec: 8, say: 'hotel.l14.upside' }); }
      // round 7: reality crashes (once), then the EXIT appears to be lovely
      if (phase === 'rounds' && round === 7 && !crashed && p.z < -10) { crashed = true; crash(game, w, { sec: 2.6, say: 'hotel.l14.crash', sayAfter: 'hotel.l14.exit' }); }
      // the round-5 point expires if round 6 takes too long
      if (phase === 'rounds' && round === 6 && !game.baby) {
        if (!expired && roundT > EXPIRE) { expired = true; round = 5; game.audio.glitch(); game.ui.toast('✖ Progress expired · round 6 → 5', 'bad'); game.say('hotel.l14.expire', { priority: 2 }); }
        if (Math.floor(roundT * 2) !== Math.floor((roundT - dt) * 2)) drawCount();
      }
      // the host's opinion (right about a third of the time)
      if (!lapSaid && p.z < -22 && phase === 'rounds' && round !== 7) {
        lapSaid = true;
        const truth = !!cur, says = Math.random() < 0.35 ? truth : !truth;
        game.say(says ? 'hotel.l14.host.diff' : 'hotel.l14.host.same', { priority: 0 });
      }
    });
    w.onRespawn(() => { showAct(phase === 'encore' ? 0 : phase === 'exitLap' ? 3 : phase === 'stairs' ? 0 : ACT_OF[round]); twisted = twisted === roundId ? -1 : twisted; seen = false; });
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l14.intro'); g.say('hotel.l14.intro2', { vars: { need: NEED } }); stageTitle(g, w, 1, ACTS.length, ACTS[0]); }
    };
    w.hooks.onDeath = (info) => {
      const p = game.player;
      if (info.reason === 'fake') return true;
      if (info.reason === 'hazard') { game.say(Math.abs(p.z - -38) < 2 ? 'hotel.l14.cartdeath' : 'hotel.l14.trolley', { priority: 1 }); return true; }
      if (actNow === 2 && chutes.some((c) => p.z < c.z0 + 0.5 && p.z > c.z1 - 0.5)) { game.say('hotel.l14.chute', { priority: 1 }); return true; }
      if (Math.random() < 0.75) { game.say('hotel.l14.fall', { priority: 1, vars: { n: game.deaths } }); return true; }
      return false;
    };

    // ================================================================================================================================
    //  Hint: honest, about this round only (is there something? then where), plus a trail to the right door
    // ================================================================================================================================
    const routeNow = () => (phase === 'stairs' ? null : route[actNow]);
    const nodeAt = (p) => { const r = routeNow(); if (!r) return -1; let bi = 0, bd = Infinity; r.forEach((q, i) => { const d = Math.max(0, Math.abs(p.z - q.body.z) - q.body.hz); if (d < bd) { bd = d; bi = i; } }); return bi; };
    const trailTo = (g, forward) => {
      const p = g.player, r = routeNow(), out = [{ x: p.x, y: p.y + 0.15, z: p.z }];
      if (!r) return null;
      let i = nodeAt(p);
      for (let k = 0; k < 5; k++) { i += forward ? 1 : -1; if (i < 0 || i >= r.length) break; const b = r[i].body; out.push({ x: b.x, y: b.top + 0.15, z: forward ? Math.min(p.z, b.z + b.hz - 0.8) : Math.max(p.z, b.z - b.hz + 0.8) }); }
      if (i < 0 || i >= r.length) out.push({ x: 0, y: 0.15, z: forward ? -LC - 2.5 : 2.5 });
      return out;
    };
    let hintRound = -1, hintStage = 0;
    w.hintFn = (g) => (phase === 'stairs' ? stairs.hint(g) : trailTo(g, phase === 'exitLap' || !cur));
    w.hintFlat = false;
    w.hintAction = (g) => {
      if (phase === 'stairs' || phase === 'exitLap') return 'trail';
      if (hintRound !== roundId) { hintRound = roundId; hintStage = 0; }
      hintStage++;
      if (!cur) g.say('hotel.l14.hint.none', { priority: 2 });
      else if (hintStage === 1 && !g.baby) g.say('hotel.l14.hint.some', { priority: 2 });
      else g.say('hotel.l14.hint.where', { priority: 2, vars: { where: cur.hint } });
      const pts = trailTo(g, !cur);
      if (pts && pts.length >= 2) { w.hintTrail ||= new HintTrail(w); w.hintTrail.show(pts, g.baby ? 14 : 8); }
      return true;
    };

    // ================================================================================================================================
    //  The bot: a guest with perfect eyes. Walks the route; turns back where an anomaly can first be seen; waits for the dolly and chutes
    // ================================================================================================================================
    let botI = 0;
    w.botPlan = (g) => {
      const p = g.player;
      if (g.frozen || w.completed) return { x: p.x, z: p.z, wait: true };
      if (phase === 'stairs') return stairs.botPlan(g);
      const r = route[actNow];
      const fwd = phase === 'exitLap' || !cur || (!seen && p.z > cur.seeZ);
      // which route platform am I on?
      if (p.grounded) { const k = r.findIndex((q) => q.body === p.ground); if (k >= 0) botI = k; else if (p.z > -0.2 || p.z < -LC) botI = p.z > 0 ? 0 : r.length - 1; }
      const here = r[botI], ni = botI + (fwd ? 1 : -1), next = r[ni];
      const end = { x: 0, z: fwd ? -LC - 2.6 : 2.6 };
      if (!next) return end;
      const nb = next.body, hb = here.body, dir = fwd ? -1 : 1;
      const edgeHere = hb.z + dir * hb.hz, edgeNext = nb.z - dir * nb.hz;
      const waitAt = (z) => (Math.abs(p.z - z) < 0.35 ? { x: hb.x, z, wait: true } : { x: hb.x, z });
      // ride the dolly to the far side
      if (here.kind === 'ferry' && p.grounded && p.ground === hb) {
        return Math.abs(edgeHere - (nb.z - dir * nb.hz)) < 1.1 ? { body: nb } : { x: hb.x, z: hb.z, wait: true };
      }
      // wait for the dolly to come close
      if (next.kind === 'ferry') return Math.abs(edgeHere - edgeNext) < 1.0 ? { body: nb } : waitAt(edgeHere - dir * 1.3);
      // chutes: cross only if it stays shut long enough; crumbled carpet: wait until it is back
      if (next.kind === 'chute' && (chuteOpenSoon(chutes.find((c) => c.p === next), w.t, 1.5) || !nb.enabled)) return waitAt(edgeHere - dir * 1.0);
      if (!nb.enabled) return waitAt(edgeHere - dir * 1.0);
      return { body: nb };
    };

    w.hallway = {
      A, doors, paintings, sconces, chutes, route, trolley, cart, ghost, bridge, deco, exitDoor, stairs, ferries,
      get round() { return round; }, set round(v) { round = v; }, get phase() { return phase; }, get cur() { return cur; }, get act() { return actNow; },
      get roundT() { return roundT; }, set roundT(v) { roundT = v; }, get expired() { return expired; },
      decide, newRound, setRound(r, id = undefined) { round = r; phase = 'rounds'; setup(); if (id !== undefined) { if (cur) { cur.off(); cur.active = false; } cur = id ? A[id] : null; if (cur) { cur.on(); cur.active = true; } } game.respawnPlayer(false); showAct(ACT_OF[round]); },
      chuteState, cartX, NEED, LC,
    };
    setup();
    void rnd;
  },
};

// ---- the paintings (drawn, not loaded) ------------------------------------------------------------------------------------------------
function paintingTextures() {
  const mk = (draw, w = 256, h = 180) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const face = (g, w, h, back) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#1d3a2a'); bg.addColorStop(1, '#0c1a12'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#20160f'; g.beginPath(); g.ellipse(w / 2, h * 1.02, 70, 50, 0, 0, 7); g.fill();                     // shoulders
    if (!back) { g.fillStyle = '#f0f0f0'; g.beginPath(); g.moveTo(w / 2 - 22, h * 0.86); g.lineTo(w / 2, h * 0.98); g.lineTo(w / 2 + 22, h * 0.86); g.fill(); g.fillStyle = '#c0182a'; g.beginPath(); g.moveTo(w / 2 - 16, h * 0.84); g.lineTo(w / 2, h * 0.9); g.lineTo(w / 2 - 16, h * 0.96); g.fill(); g.beginPath(); g.moveTo(w / 2 + 16, h * 0.84); g.lineTo(w / 2, h * 0.9); g.lineTo(w / 2 + 16, h * 0.96); g.fill(); }
    g.fillStyle = back ? '#1a1210' : '#e8b896'; g.beginPath(); g.ellipse(w / 2, h * 0.52, 36, 46, 0, 0, 7); g.fill();     // head
    g.fillStyle = '#1a1210'; g.beginPath(); g.ellipse(w / 2, h * 0.36, 38, back ? 40 : 20, 0, Math.PI, back ? 3 * Math.PI : 2 * Math.PI); g.fill();   // slick hair
    if (!back) {
      g.fillStyle = '#1a1210'; g.fillRect(w / 2 - 22, h * 0.47, 14, 4); g.fillRect(w / 2 + 8, h * 0.44, 14, 4);   // one eyebrow up: smug
      g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(w / 2 - 15, h * 0.52, 3.5, 0, 7); g.arc(w / 2 + 15, h * 0.52, 3.5, 0, 7); g.fill();
      g.fillStyle = '#1a1210'; g.beginPath(); g.moveTo(w / 2 - 20, h * 0.65); g.quadraticCurveTo(w / 2, h * 0.6, w / 2 + 20, h * 0.65); g.quadraticCurveTo(w / 2, h * 0.68, w / 2 - 20, h * 0.65); g.fill();   // moustache
      g.strokeStyle = '#7a2a2a'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2 + 4, h * 0.68, 9, 0.2, 1.2); g.stroke();   // smirk
    }
  };
  return {
    portrait: mk((g, w, h) => face(g, w, h, false)),
    portraitBack: mk((g, w, h) => face(g, w, h, true)),
    ship: mk((g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#6a8ab0'); sky.addColorStop(0.6, '#c8b090'); sky.addColorStop(0.61, '#1a3a5a'); sky.addColorStop(1, '#0a2238'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = '#3a2216'; g.beginPath(); g.moveTo(70, 112); g.lineTo(190, 112); g.lineTo(176, 128); g.lineTo(84, 128); g.fill();
      g.fillStyle = '#efe6d0'; for (const [x, top] of [[100, 40], [130, 28], [160, 46]]) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, 108); g.lineTo(x + 26, 104); g.closePath(); g.fill(); }
      g.strokeStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(20 + k * 28, 140 + (k % 3) * 10, 12, Math.PI, 2 * Math.PI); g.stroke(); }
    }),
    hotel: mk((g, w, h) => {
      g.fillStyle = '#0c1030'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4ecc8'; g.beginPath(); g.arc(200, 40, 18, 0, 7); g.fill();
      g.fillStyle = '#2a2440'; g.fillRect(80, 30, 90, 150); g.fillStyle = '#d8a94a'; g.fillRect(118, 14, 14, 18);
      g.fillStyle = '#ffd890'; for (let r = 0; r < 9; r++) for (let c = 0; c < 5; c++) if ((r * 7 + c * 3) % 4) g.fillRect(88 + c * 16, 40 + r * 15, 9, 8);
      g.fillStyle = '#d8a94a'; g.font = 'bold 16px Georgia, serif'; g.textAlign = 'center'; g.fillText('TRUST-ME', 125, 176);
    }),
    fruit: mk((g, w, h) => {
      g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, w, h); g.fillStyle = '#5a3a20'; g.fillRect(0, 120, w, 60);
      g.fillStyle = '#c8c0b0'; g.beginPath(); g.ellipse(128, 124, 70, 18, 0, 0, Math.PI); g.fill();
      for (const [x, y, c, r] of [[100, 108, '#c0202a', 20], [132, 102, '#e0b020', 22], [160, 110, '#5a8a2a', 18], [120, 92, '#7a2a6a', 14], [146, 88, '#c0202a', 15]]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    }),
    moon: mk((g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#0a1a3a'); sky.addColorStop(1, '#3a4a6a'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f8f0d0'; g.beginPath(); g.arc(80, 60, 30, 0, 7); g.fill();
      g.fillStyle = '#16202a'; g.beginPath(); g.moveTo(0, 150); g.quadraticCurveTo(70, 100, 140, 140); g.quadraticCurveTo(200, 110, 256, 130); g.lineTo(256, 180); g.lineTo(0, 180); g.fill();
    }),
    n350: textTexture('350', { w: 256, h: 128, color: '#e8c673', bg: '#1a120e', border: '#d8a94a', size: 72 }),
  };
}

// the towel trolley (a low, wide housekeeping trolley stacked with towels: hop it)
function towelTrolley(group) {
  const steel = plainMaterial(0xc8ccd4, { metalness: 0.8, roughness: 0.3 }), towel = plainMaterial(0xf4f0e8, { roughness: 0.95 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.08, 1.0), steel); deck.position.y = -0.05; group.add(deck);
  for (let k = 0; k < 6; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.7), towel); t.position.set(-1.65 + k * 0.66, 0.15, 0); group.add(t); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), plainMaterial(0x1a1a1a)); wh.rotation.x = Math.PI / 2; wh.position.set(sx * 1.9, -0.28, sz * 0.4); group.add(wh); }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), glowMaterial(0xffa21f, 2.4)); lamp.position.set(0, 0.36, 0); group.add(lamp);
}
// the laundry cart that comes out of 309 (tall: do not try to hop it)
function laundryCart(group) {
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.0, 1.1), plainMaterial(0x2a4a8a, { roughness: 0.6 })); body.position.y = 0.0; group.add(body);
  const sheets = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.2, 1.0), plainMaterial(0xf4f0e8, { roughness: 0.95 })); sheets.position.y = 0.55; group.add(sheets);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), glowMaterial(0xff4a3a, 2.4)); lamp.position.set(0.5, 0.5, 0); group.add(lamp);
}

// ---- the fire stairs (the encore's way out): three broken flights up a concrete stairwell behind the south door ------------------------
function fireStairs(w, game) {
  const Z0 = 5.1, Z1 = 17.1, SX = 4;                       // inside of the stairwell
  const con = { tex: 'stone', color: 0x8a8a90, roughness: 0.85 };
  const parts = [];
  const P = (o) => { const p = w.plat({ ...con, radius: 0.03, ...o }); parts.push(p); return p; };
  // shell (walls and a ceiling; the front wall has the doorway the vestibule leads into)
  const shell = [];
  shell.push(w.plat({ x: -SX - 0.3, y: 11, z: (Z0 + Z1) / 2, w: 0.6, d: Z1 - Z0 + 1.2, h: 18, ...con }));
  shell.push(w.plat({ x: SX + 0.3, y: 11, z: (Z0 + Z1) / 2, w: 0.6, d: Z1 - Z0 + 1.2, h: 18, ...con }));
  shell.push(w.plat({ x: 0, y: 11, z: Z1 + 0.3, w: 2 * SX + 1.2, d: 0.6, h: 18, ...con }));
  for (const sx of [-1, 1]) shell.push(w.plat({ x: sx * (1.8 + (SX - 1.8) / 2 + 0.3), y: 11, z: Z0 - 0.3, w: SX - 1.8 + 0.6, d: 0.6, h: 18, ...con }));
  shell.push(w.plat({ x: 0, y: 11, z: Z0 - 0.3, w: 3.6, d: 0.6, h: 18 - 3.4 - 7, ...con }));
  shell.push(w.plat({ x: 0, y: 11.5, z: (Z0 + Z1) / 2, w: 2 * SX + 1.2, d: Z1 - Z0 + 1.2, h: 1, ...con }));
  // the route: entry landing, flight 1 (west, going south), landing A, flight 2 (east, coming back), landing B, flight 3 (west), landing C (exit)
  const route = [];
  const R = (o, crumble = false) => { const p = P(o); p.o.path = true; route.push(p); if (crumble) w.crumble(p, { delay: 0.6, gone: 2.6 }); return p; };
  R({ x: 0, y: 0, z: 6.6, w: 2 * SX, d: 3.0, h: 0.5 });
  R({ x: -2.2, y: 0.6, z: 9.1, w: 3.6, d: 2.0, h: 0.6 });
  R({ x: -2.2, y: 1.2, z: 11.1, w: 3.6, d: 2.0, h: 0.6 });
  R({ x: -2.2, y: 2.4, z: 14.6, w: 3.6, d: 2.0, h: 0.6 });                 // (a step is missing before this one)
  R({ x: 0, y: 2.4, z: 16.35, w: 2 * SX, d: 1.5, h: 0.6 });                // landing A
  R({ x: 2.2, y: 3.0, z: 14.1, w: 3.6, d: 2.0, h: 0.6 });
  R({ x: 2.2, y: 3.6, z: 12.1, w: 3.6, d: 2.0, h: 0.6 }, true);
  R({ x: 2.2, y: 4.2, z: 10.1, w: 3.6, d: 2.0, h: 0.6 });
  R({ x: 0, y: 4.8, z: 6.1, w: 2 * SX, d: 2.0, h: 0.6 });                  // landing B (a gap before it)
  R({ x: -2.2, y: 5.4, z: 8.6, w: 3.6, d: 2.0, h: 0.6 });
  R({ x: -2.2, y: 6.6, z: 12.1, w: 3.6, d: 2.0, h: 0.6 }, true);           // (and another missing step)
  const top = R({ x: 0, y: 7.2, z: 15.6, w: 2 * SX, d: 3.0, h: 0.6 });     // landing C
  // the basement far below (you will not reach it alive) and the floor numbers (all of them say 3)
  const base = w.box({ x: 0, y: -6.6, z: (Z0 + Z1) / 2, w: 2 * SX, h: 0.3, d: Z1 - Z0, color: 0x2a2a2e, rough: 0.9, shadow: false });
  parts.push({ setEnabled: (on) => { base.visible = on; } });
  const signs = [[-3.0, 1.8, Z0 + 0.02, '3'], [0, 4.4, Z1 - 0.02, '3'], [0, 7.6, Z0 + 0.02, '3?'], [0, 9.8, Z1 - 0.02, 'EXIT']].map(([x, y, z, t]) => w.sign({ text: t, x, y, z, w: t === 'EXIT' ? 2 : 1.1, h: 0.9, rotY: z > 10 ? Math.PI : 0, color: t === 'EXIT' ? '#6cf0b2' : '#e8e0d0', double: false, tw: 256, size: 100, glow: t === 'EXIT' }));
  const lamp = w.light(0xfff0d8, 0, 14, 0, 9, 11);
  const goal = w.goal({ x: 0, y: 7.2, z: 15.6, color: GOLD, onReach: () => { game.say('hotel.l14.done', { priority: 2 }); game.completeLevel(); } });
  goal.group.scale.setScalar(0.8);
  const all = [...parts, ...shell];
  const setOn = (on) => { for (const p of all) p.setEnabled(on); for (const s of signs) s.visible = on; goal.group.visible = on; goal.trig.enabled = on; lamp.intensity = on ? 9 : 0; };
  setOn(false);
  let isOpen = false;
  w.onRespawn(() => { if (!isOpen) setOn(false); });
  return {
    route, top, goal,
    open() { isOpen = true; setOn(true); },
    get isOpen() { return isOpen; },
    hint(g) { const p = g.player; let bi = 0, bd = Infinity; route.forEach((q, i) => { const d = Math.hypot(q.body.x - p.x, q.body.z - p.z) + Math.abs(q.top - p.y) * 2; if (d < bd) { bd = d; bi = i; } }); const out = [{ x: p.x, y: p.y + 0.15, z: p.z }]; for (let k = bi + 1; k < route.length && out.length < 6; k++) out.push({ x: route[k].body.x, y: route[k].top + 0.15, z: route[k].body.z }); return out.length >= 2 ? out : null; },
    botPlan(g) { const p = g.player; if (p.z < 5) return { x: 0, z: 7 }; return null; },
  };
}
