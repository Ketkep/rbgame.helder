import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture } from '../../engine/materials.js';
import { hotelHalo, citySkyline, GOLD } from './kit.js';
import { palm } from './props.js';
import { onPlat } from '../common.js';
import { mazeSection, pathRuns, sectionHint, routeHint } from './mazestage.js';
import { fakeExit, adBreak, stageTitle, vanishAfter } from './trolls.js';

// Hotel level 4 — "Revolving Door" (Easy · Mezzanine). The rooftop garden: two hedge mazes (new ones every attempt) with a fountain
// courtyard between them. Both mazes are sealed rooms: the hedges run on into the garden walls, so the only way is through.
// Five stages, a checkpoint at each:
//   1 Hedge Maze    maze A, south half: revolving doors on a schedule (green lamp = go)
//   2 Cart Track    maze A, north half (checkpoint in the middle cell): luggage-cart trains patrol the corridors (hop them)
//   3 The Fountain  the courtyard is a pool: stepping stones, a crumbling one, the fountain's rim, two jets, a rolling cart
//   4 Dusk Maze     the garden gate is "ad-supported" (it opens when the ad ends); maze B in the fog, faster doors
//   5 The Shortcut  maze B, north half: a SHORTCUT door that is a loop (back to the start of the maze) and an EXIT arch in a dead end
// Tricks: the host's confident directions (wrong), "the fountain is shallow", the ad gate, the loop door, the decoy EXIT arch.
// Baby Mode: the loop door is locked and labelled, the decoy says "(decoy)", the ad is shorter, the jets are slower.

const NAMES = ['Hedge Maze', 'Cart Track', 'The Fountain', 'Dusk Maze', 'The Shortcut', 'The Revolving Door'];
const C = 4.4, T = 0.8, WH = 3.6;
const NA = 8, NB = 9;
const XW = 25;                       // inner faces of the garden walls (x = ±XW)
const ZA = 0;                        // maze A: south wall line
const ZA1 = ZA - NA * C;             //         north wall line (-35.2)
const ZB = ZA1 - 44;                 // maze B: south wall line (-79.2)
const ZB1 = ZB - NB * C;             //         north wall line (-118.8)
const ZV0 = ZB1 - 7.2, ZV1 = ZV0 - 16;   // the glass vestibule (three revolving doors) into the roof pavilion
const ZP1 = ZV1 - 8;                 // the pavilion's back wall
const ZS = ZA + 13, ZE = ZP1 - 4;    // the parapets at the two ends of the roof
const WATER_N = ZB + T / 2, WATER_S = ZA1 - T / 2;   // the courtyard pool, wall to wall (-78.8 … -35.6)
const rnd = (n) => Math.floor(Math.random() * n);

export default {
  id: 'hotel-4',
  name: 'Revolving Door',
  music: 'hotel',
  completeQuip: 'Two mazes, one fountain, zero shortcuts. You found the exit. It was at the end. They always are. Mostly.',

  build(w, game) {
    w.env({
      top: 0x050824, horizon: 0x2a2250, bottom: 0x08080f,
      fog: { color: 0x15102c, near: 60, far: 300 },
      sun: { color: 0xa9c0ff, intensity: 1.5, dir: [-0.45, 0.8, 0.5] },
      hemi: { sky: 0xa8bcff, ground: 0x587058, intensity: 0.95 },
      exposure: 0.95, stars: 1.0,
      bloom: { strength: 0.5, radius: 0.7, threshold: 0.95 },
      motes: { color: 0xffe0a0, count: 160, size: 0.07, opacity: 0.5 },
    });
    w.setTheme({ tex: 'stone', color: 0xffffff, trim: null, edge: null, edgeOpacity: 0, roughness: 0.8, metalness: 0, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.killY = -30;
    w.stepHeight = 0;
    citySkyline(w);
    const baby = () => game.baby;

    // ---- the roof: terrace, garden walls, parapets ---------------------------------------------------
    const tW = 2 * XW;
    const terrace = (z0, z1) => w.plat({ x: 0, y: 0, z: (z0 + z1) / 2, w: tW + 1.6, d: z0 - z1, h: 1.4, tex: 'stone', color: 0xd9cdb5, roughness: 0.55 });
    terrace(ZS, WATER_S);                      // start yard + maze A
    terrace(WATER_N, ZE);                      // maze B + exit yard
    w.plat({ x: 0, y: -1.4, z: (WATER_S + WATER_N) / 2, w: tW + 1.6, d: WATER_S - WATER_N, h: 0.6, tex: 'tile', color: 0x1d3a4a, roughness: 0.3 });   // the pool's floor
    for (const sx of [-1, 1]) {                // tall garden walls: nothing to climb, nothing to walk round
      w.plat({ x: sx * (XW + 0.4), y: 4.6, z: (ZS + ZE) / 2, w: 0.8, d: ZS - ZE + 0.8, h: 6.6, tex: 'stone', color: 0xe4d8c0, roughness: 0.5 });
      w.box({ x: sx * (XW + 0.4), y: 4.66, z: (ZS + ZE) / 2, w: 1.0, h: 0.14, d: ZS - ZE + 1.0, color: GOLD, metal: 1, rough: 0.35, shadow: false });
      for (let z = ZS - 8; z > ZE + 4; z -= 16) {
        w.box({ x: sx * (XW + 0.4), y: 5.0, z, w: 0.3, h: 0.6, d: 0.3, glow: 0xffd8a0, glowIntensity: 1.6, shadow: false });
        hotelHalo(w, sx * (XW - 0.2), 5.0, z, 3.4, 0xffc070, 0.16);
      }
    }
    const parapet = (z) => {
      w.plat({ x: 0, y: 1.1, z, w: tW, d: 0.6, h: 2.5, tex: 'stone', color: 0xe4d8c0, roughness: 0.5 });
      w.box({ x: 0, y: 1.2, z, w: tW + 0.1, h: 0.14, d: 0.7, color: GOLD, metal: 1, rough: 0.35, shadow: false });
    };
    parapet(ZS); parapet(ZE);
    for (const [x, z] of [[-XW + 1, ZS - 1], [XW - 1, ZS - 1], [-XW + 1, ZE + 1], [XW - 1, ZE + 1]]) {
      w.box({ x, y: 1.6, z, w: 0.9, h: 3.2, d: 0.9, color: 0xe4d8c0, rough: 0.4 });
      w.box({ x, y: 3.45, z, w: 0.34, h: 0.34, d: 0.34, glow: 0xffd8a0, glowIntensity: 1.7, shadow: false });
      hotelHalo(w, x, 3.5, z, 5, 0xffc070, 0.22);
    }

    // ---- the two mazes ----------------------------------------------------------------------------------
    const MA = mazeSection(w, { N: NA, C, T, WH, Z0: ZA, band: [37, 43], walls: { tex: 'hedge', color: 0xffffff, roughness: 0.95, radius: 0.1, reach: [-XW, XW] } });
    const MB = mazeSection(w, { N: NB, C, T, WH, Z0: ZB, band: [51, 57], walls: { tex: 'hedge', color: 0x9fb4c4, roughness: 0.95, radius: 0.1, reach: [-XW, XW] } });
    const lanterns = (M, glow, poolColor) => {
      for (let i = 0; i <= M.N; i++) for (let j = 0; j <= M.N; j++) if ((i + j) % 2 === 0) w.box({ x: M.X0 + i * C, y: WH + 0.35, z: M.Z0 - j * C, w: 0.22, h: 0.5, d: 0.22, glow, glowIntensity: 1.6, shadow: false });
      const poolMat = new THREE.MeshBasicMaterial({ map: softTexture('glow'), color: poolColor, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const geo = new THREE.PlaneGeometry(C * 1.7, C * 1.7);
      for (let i = 0; i < M.N; i++) for (let j = 0; j < M.N; j++) {
        const m = new THREE.Mesh(geo, poolMat); m.rotation.x = -Math.PI / 2; m.position.set(M.cx(i), 0.02, M.cz(j)); m.matrixAutoUpdate = false; m.updateMatrix(); w.add(m);
      }
    };
    lanterns(MA, 0xffd8a0, 0xffc880);
    lanterns(MB, 0xb8d4ff, 0x8aa8ff);
    // mist in the dusk maze
    const mist = new THREE.SpriteMaterial({ map: softTexture('puff'), color: 0xb8c4ff, transparent: true, opacity: 0.12, depthWrite: false });
    for (let k = 0; k < 26; k++) { const sp = new THREE.Sprite(mist); sp.position.set(MB.X0 + Math.random() * NB * C, 0.7, ZB - Math.random() * NB * C); sp.scale.set(5, 1.6, 1); w.add(sp); }

    // ---- entrance, signs, exit ---------------------------------------------------------------------------
    w.spawn = { x: MA.cx(0), y: 0, z: ZA + 6, yaw: 0 };
    w.respawn = { ...w.spawn };
    const arch = (x, z, text, color = '#f1d28a') => {
      for (const sx of [-1, 1]) w.box({ x: x + sx * 2.3, y: 2.2, z, w: 0.35, h: 4.4, d: 0.35, color: 0xe4d8c0, rough: 0.4 });
      w.box({ x, y: 4.5, z, w: 5.4, h: 0.5, d: 0.5, color: GOLD, metal: 1, rough: 0.35 });
      w.sign({ text, x, y: 5.5, z: z + 0.05, w: 6, h: 1.1, color, double: true, tw: 1024, size: 80 });
    };
    arch(MA.cx(0), ZA + 0.6, 'ROOFTOP GARDEN');
    palm(w, MA.cx(0) - 6, ZA + 6, 1.1); palm(w, MA.cx(0) + 6, ZA + 6, 1.1);
    // the stair house you came up by (a door that does not open)
    w.box({ x: MA.cx(0), y: 1.6, z: ZS - 1.4, w: 4.2, h: 3.2, d: 1.6, tex: 'stone', color: 0xe4d8c0, rough: 0.5 });
    w.box({ x: MA.cx(0), y: 1.25, z: ZS - 2.25, w: 1.4, h: 2.5, d: 0.1, color: 0x2a1a12, rough: 0.5 });
    w.sign({ text: 'STAIRS · LOBBY', x: MA.cx(0), y: 2.9, z: ZS - 2.32, w: 2.2, h: 0.45, color: '#f1d28a', double: false, rotY: Math.PI, tw: 512, size: 60 });
    const exitX = MB.cx(NB - 1);
    w.sign({ text: 'EXIT', x: exitX, y: 4.2, z: ZB1 - 1.0, w: 4, h: 1.2, color: '#6cf0b2', double: true, tw: 512, size: 100, glow: true });
    palm(w, exitX - 7, ZB1 - 4, 1.1); palm(w, exitX - 13, ZB1 - 4, 1.1);
    // the way back in: a glass vestibule with three big revolving doors, into the roof pavilion (the real exit is inside)
    const VX = exitX, VW = 5.0, PX0 = VX - 6, PX1 = VX + 6;
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    for (const sx of [-1, 1]) {
      const x = VX + sx * (VW / 2 + 0.1);
      w.collider({ x, y: 2.2, z: (ZV0 + ZV1) / 2, w: 0.2, h: 4.4, d: ZV0 - ZV1 });
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(ZV0 - ZV1, 4.3), glassMat); pane.rotation.y = Math.PI / 2; pane.position.set(x, 2.2, (ZV0 + ZV1) / 2); w.add(pane);
      for (let z = ZV0; z >= ZV1 - 0.01; z -= 4) w.box({ x, y: 2.2, z, w: 0.16, h: 4.4, d: 0.16, color: GOLD, metal: 1, rough: 0.3 });
      w.box({ x, y: 4.45, z: (ZV0 + ZV1) / 2, w: 0.22, h: 0.14, d: ZV0 - ZV1 + 0.2, color: GOLD, metal: 1, rough: 0.3, shadow: false });
      w.box({ x, y: 0.08, z: (ZV0 + ZV1) / 2, w: 0.22, h: 0.16, d: ZV0 - ZV1 + 0.2, color: GOLD, metal: 1, rough: 0.3, shadow: false });
    }
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(VW + 0.4, ZV0 - ZV1), glassMat); roof.rotation.x = -Math.PI / 2; roof.position.set(VX, 4.5, (ZV0 + ZV1) / 2); w.add(roof);
    for (let z = ZV0; z >= ZV1 - 0.01; z -= 4) w.box({ x: VX, y: 4.5, z, w: VW + 0.4, h: 0.12, d: 0.14, color: GOLD, metal: 1, rough: 0.3, shadow: false });
    w.sign({ text: 'HOTEL · LOBBY', x: VX, y: 5.2, z: ZV0 + 0.05, w: 4.6, h: 0.9, color: '#f1d28a', double: true, tw: 1024, size: 80 });
    // the pavilion
    const pav = (x, z, ww, dd) => w.plat({ x, y: 5.2, z, w: ww, d: dd, h: 5.2, tex: 'stone', color: 0xe4d8c0, roughness: 0.5 });
    pav((PX0 + VX - VW / 2 - 0.2) / 2, ZV1 - 0.3, VX - VW / 2 - 0.2 - PX0, 0.6);
    pav((VX + VW / 2 + 0.2 + PX1) / 2, ZV1 - 0.3, PX1 - VX - VW / 2 - 0.2, 0.6);
    pav(VX, ZP1 + 0.3, PX1 - PX0, 0.6);
    pav(PX0 + 0.3, (ZV1 + ZP1) / 2, 0.6, ZV1 - ZP1);
    pav(PX1 - 0.3, (ZV1 + ZP1) / 2, 0.6, ZV1 - ZP1);
    w.box({ x: VX, y: 5.35, z: (ZV1 + ZP1) / 2, w: PX1 - PX0 + 0.4, h: 0.3, d: ZV1 - ZP1 + 0.4, tex: 'stone', color: 0xe4d8c0, rough: 0.5 });
    w.box({ x: VX, y: 5.55, z: (ZV1 + ZP1) / 2, w: PX1 - PX0 + 0.5, h: 0.12, d: ZV1 - ZP1 + 0.5, color: GOLD, metal: 1, rough: 0.35, shadow: false });
    w.box({ x: VX, y: 1.6, z: ZP1 + 0.62, w: 2.6, h: 3.2, d: 0.08, color: 0x8a6a3a, metal: 0.8, rough: 0.3 });
    w.sign({ text: 'LOBBY ↓', x: VX, y: 3.6, z: ZP1 + 0.68, w: 2.2, h: 0.5, color: '#f1d28a', double: false, tw: 512, size: 70 });
    w.light(0xffd9a0, 10, 14, VX, 4.2, (ZV1 + ZP1) / 2);
    const goal = w.goal({ x: VX, y: 0, z: ZP1 + 3.2, color: GOLD, onReach: () => { game.say('hotel.l4.done', { priority: 2 }); game.completeLevel(); } });

    // ---- revolving doors ------------------------------------------------------------------------------------
    const doors = [];
    const LAMP = { go: glowMaterial(0x40ff88, 1.8), stop: glowMaterial(0xff3a46, 1.8), loop: glowMaterial(0xb06cff, 2.0) };
    const brass = plainMaterial(GOLD, { metalness: 1, roughness: 0.3 }), chrome = plainMaterial(0xd8dde6, { metalness: 1, roughness: 0.18 });
    const glass = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
    const loopGlass = new THREE.MeshStandardMaterial({ color: 0xd8b8ff, transparent: true, opacity: 0.26, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
    const doorAt = (M, a, b, { P = 3.4, kind = 'door' } = {}) => {
      const mx = (M.cx(a[0]) + M.cx(b[0])) / 2, mz = (M.cz(a[1]) + M.cz(b[1])) / 2, ew = a[0] !== b[0];
      const body = w.collider({ x: mx, y: WH / 2, z: mz, w: ew ? T * 0.9 : C - T + 0.2, h: WH, d: ew ? C - T + 0.2 : T * 0.9 });
      const loop = kind === 'loop', metal = loop ? chrome : brass;
      const g = new THREE.Group(); g.position.set(mx, 0, mz);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.12, 28), metal); base.position.y = 0.06; g.add(base);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.3, 28), metal); cap.position.y = WH - 0.15; g.add(cap);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, WH, 12), metal); pole.position.y = WH / 2; g.add(pole);
      const wings = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const wing = new THREE.Group(); wing.rotation.y = (k * Math.PI) / 2;
        const pane = new THREE.Mesh(new THREE.BoxGeometry(1.65, WH - 0.5, 0.05), loop ? loopGlass : glass); pane.position.set(0.9, WH / 2, 0); wing.add(pane);
        for (const yy of [0.3, WH - 0.3]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.1, 0.1), metal); bar.position.set(0.9, yy, 0); wing.add(bar); }
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.08, WH - 0.5, 0.08), metal); edge.position.set(1.72, WH / 2, 0); wing.add(edge);
        wings.add(wing);
      }
      g.add(wings);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), loop ? LAMP.loop : LAMP.stop); lamp.position.y = WH + 0.55; g.add(lamp);
      const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), metal); lampPost.position.y = WH + 0.25; g.add(lampPost);
      w.add(g);
      const d = { M, a, b, body, wings, lamp, phase: Math.random() * P, P, win: M === MB ? 0.2 : 0.22, open: false, mx, mz, ew, kind, locked: false };
      doors.push(d);
      return d;
    };
    const doorOpenAt = (d, t) => { const u = (((t + d.phase) % d.P) + d.P) % d.P / d.P, o = d.win ?? 0.22; return u > 0.5 - o && u < 0.5 + o; };   // open for 2·win of each quarter turn
    w.onUpdate((dt, t) => {
      for (const d of doors) {
        d.wings.rotation.y = (d.kind === 'loop' ? -1 : 1) * ((t + d.phase) / d.P) * (Math.PI / 2);
        const op = !d.locked && doorOpenAt(d, t);
        if (op !== d.open) { d.open = op; d.body.enabled = !op; if (d.kind !== 'loop') d.lamp.material = op ? LAMP.go : LAMP.stop; }
      }
    });
    // maze A: three doors on the way out (south half), two on the way to nowhere
    const midA = MA.path.length >> 1, midB = MB.path.length >> 1;
    const doorEdges = new Set();
    const pathDoor = (M, k, opts) => { const e = M.edge(M.path[k], M.path[k + 1]); if (doorEdges.has(e)) return; doorEdges.add(e); doorAt(M, M.path[k], M.path[k + 1], opts); };
    for (const f of [0.1, 0.25, 0.4]) pathDoor(MA, Math.max(1, Math.min(midA - 2, Math.round(f * (MA.path.length - 1)))));
    const offEdges = (M, pred) => M.openEdges().filter(([a, b]) => !M.pathEdges.has(M.edge(a, b)) && pred(a, b));
    const offA = offEdges(MA, (a, b) => MA.cz(Math.max(a[1], b[1])) > MA.cz(MA.mid[1]) - 2);
    for (let n = 0; n < 2 && offA.length; n++) { const [a, b] = offA.splice(rnd(offA.length), 1)[0]; doorAt(MA, a, b); doorEdges.add(MA.edge(a, b)); }
    // maze B: six doors on the path (faster), avoiding the cells next to the mid-point checkpoint
    for (const f of [0.07, 0.17, 0.27, 0.37, 0.6, 0.7, 0.8, 0.9]) {
      let k = Math.max(1, Math.min(MB.path.length - 3, Math.round(f * (MB.path.length - 1))));
      if (Math.abs(k - midB) <= 1) k = k < midB ? midB - 2 : midB + 2;
      pathDoor(MB, k, { P: 3.2 });
    }

    // ---- the vestibule's three big revolving doors (each on its own schedule; the middle one spins you round) ----------
    const bigDoor = (z, P, phase) => {
      const body = w.collider({ x: VX, y: 2.0, z, w: VW + 0.2, h: 4.0, d: 0.6 });
      const g = new THREE.Group(); g.position.set(VX, 0, z);
      const R = VW / 2 - 0.05;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.1, 36), brass); base.position.y = 0.05; g.add(base);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.35, 36), brass); cap.position.y = 4.2; g.add(cap);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.1, 12), brass); pole.position.y = 2.1; g.add(pole);
      const wings = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const wing = new THREE.Group(); wing.rotation.y = (k * Math.PI) / 2;
        const pane = new THREE.Mesh(new THREE.BoxGeometry(R - 0.2, 3.6, 0.05), glass); pane.position.set((R - 0.2) / 2 + 0.15, 2.05, 0); wing.add(pane);
        for (const yy of [0.3, 3.8]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(R - 0.2, 0.1, 0.1), brass); bar.position.set((R - 0.2) / 2 + 0.15, yy, 0); wing.add(bar); }
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 3.6, 0.09), brass); edge.position.set(R - 0.05, 2.05, 0); wing.add(edge);
        wings.add(wing);
      }
      g.add(wings);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), LAMP.stop); lamp.position.y = 4.85; g.add(lamp);
      const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), brass); lampPost.position.y = 4.55; g.add(lampPost);
      w.add(g);
      const d = { M: null, a: null, b: null, body, wings, lamp, phase, P, win: 0.18, open: false, mx: VX, mz: z, ew: false, kind: 'big', locked: false };
      doors.push(d);
      return d;
    };
    const vest = [bigDoor(ZV0 - 2.6, 3.0, Math.random() * 3), bigDoor(ZV0 - 13.4, 2.6, Math.random() * 2.6)];
    // the Grand Revolving Door: a glass drum between them with four wings that turn all the time. Inside, you are in one of its four
    // compartments and you go round with it (the wing behind you pushes, the one in front blocks; the hub keeps you out of the middle). The way out is
    // the opening on the far side, when your compartment gets there. (Boxes cannot turn, so the drum is a constraint on the player.)
    const DR = 2.4, DZ = ZV0 - 8, DW = -2 * Math.PI / 15;
    const drum = { x: VX, z: DZ, R: DR, w: DW, phi0: Math.random() * Math.PI, phi: 0, inside: false, entered: 0 };
    {
      const g = new THREE.Group(); g.position.set(VX, 0, DZ);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(DR, DR, 0.1, 40), brass); base.position.y = 0.05; g.add(base);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(DR + 0.08, DR + 0.08, 0.4, 40), brass); cap.position.y = 4.25; g.add(cap);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.1, 14), brass); pole.position.y = 2.1; g.add(pole);
      // the drum's glass sides (east and west; in three.js theta is measured from +z toward +x)
      for (const t0 of [Math.PI / 4, Math.PI * 5 / 4]) {
        const arc = new THREE.Mesh(new THREE.CylinderGeometry(DR + 0.04, DR + 0.04, 4.0, 20, 1, true, t0, Math.PI / 2), glass); arc.position.y = 2.1; g.add(arc);
        for (const yy of [0.2, 4.0]) { const rib = new THREE.Mesh(new THREE.CylinderGeometry(DR + 0.07, DR + 0.07, 0.1, 20, 1, true, t0, Math.PI / 2), brass); rib.position.y = yy; g.add(rib); }
        for (const tt of [t0, t0 + Math.PI / 2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.1, 0.14), brass); post.position.set(Math.sin(tt) * (DR + 0.05), 2.05, Math.cos(tt) * (DR + 0.05)); g.add(post); }
      }
      const wings = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const wing = new THREE.Group(); wing.rotation.y = (k * Math.PI) / 2;
        const pane = new THREE.Mesh(new THREE.BoxGeometry(DR - 0.25, 3.7, 0.05), glass); pane.position.set((DR - 0.25) / 2 + 0.17, 2.0, 0); wing.add(pane);
        for (const yy of [0.25, 3.85]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(DR - 0.25, 0.1, 0.1), brass); bar.position.set((DR - 0.25) / 2 + 0.17, yy, 0); wing.add(bar); }
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.7, 0.1), brass); edge.position.set(DR - 0.1, 2.0, 0); wing.add(edge);
        const push = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.12), brass); push.position.set(DR - 0.8, 1.2, 0.08); wing.add(push);
        wings.add(wing);
      }
      g.add(wings); w.add(g);
      drum.wings = wings;
      w.sign({ text: 'GRAND REVOLVING DOOR · PLEASE KEEP MOVING', x: VX, y: 4.75, z: DZ + DR + 0.1, w: 4.4, h: 0.4, color: '#f1d28a', bg: '#1a1420', double: true, tw: 1024, size: 40 });
    }
    const wrapA = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    w.onUpdate((dt, t) => {
      drum.phi = drum.phi0 + drum.w * t;
      drum.wings.rotation.y = -drum.phi;
      const p = game.player;
      const dx = p.x - drum.x, dz = p.z - drum.z, r = Math.hypot(dx, dz);
      if (game.state !== 'playing' || r >= drum.R - 0.02 || p.y > 4) { drum.inside = false; return; }
      let th = Math.atan2(dz, dx);
      const inWall = Math.abs(wrapA(th)) < Math.PI / 4 || Math.abs(wrapA(th - Math.PI)) < Math.PI / 4;
      let rr = Math.max(1.0, r);
      if (inWall) rr = Math.min(rr, drum.R - 0.42);
      const Q = Math.PI / 2, rel = (((th - drum.phi) % Q) + Q) % Q;           // where you are in your compartment (0 to 90 degrees)
      const m = Math.asin(Math.min(0.99, 0.44 / rr));
      const nrel = m >= Q / 2 ? Q / 2 : Math.min(Math.max(rel, m), Q - m);
      th += nrel - rel;
      p.x = drum.x + Math.cos(th) * rr; p.z = drum.z + Math.sin(th) * rr;
      if (!drum.inside) {
        drum.inside = true; drum.entered++;
        if (drum.entered === 1 && !game.baby) { game.ui.toast('↻ You are being revolved', 'bad'); game.say('hotel.l4.spun', { priority: 1 }); }
      }
    });

    // ---- maze B: the SHORTCUT door (a loop) and the EXIT arch in a dead end -------------------------------------
    // the loop: an off-path edge from the north half of the path, the side that looks like it heads for the exit
    let loopC = null;
    for (let k = midB + 2; k < MB.path.length - 2; k++) {
      const c = MB.path[k];
      for (const n of MB.maze.nbrs(c[0], c[1])) {
        if (MB.onPath(n) || doorEdges.has(MB.edge(c, n))) continue;
        const score = (n[0] + n[1]) - (c[0] + c[1]) + k * 0.05 + Math.random() * 0.6;
        if (!loopC || score > loopC.score) loopC = { c, n, k, score };
      }
    }
    if (!loopC) for (let k = 3; k < MB.path.length - 2 && !loopC; k++) { const c = MB.path[k]; const n = MB.maze.nbrs(c[0], c[1]).find((q) => !MB.onPath(q) && !doorEdges.has(MB.edge(c, q))); if (n) loopC = { c, n, k }; }
    let loopDoor = null;
    const loopCells = new Set();
    if (loopC) {
      loopDoor = doorAt(MB, loopC.c, loopC.n, { P: 2.9, kind: 'loop' });
      doorEdges.add(MB.edge(loopC.c, loopC.n));
      // everything behind it (reachable only through it)
      const st = [loopC.n]; loopCells.add(MB.key(loopC.n));
      while (st.length) { const q = st.pop(); for (const r of MB.maze.nbrs(q[0], q[1])) if (!loopCells.has(MB.key(r)) && !(r[0] === loopC.c[0] && r[1] === loopC.c[1])) { loopCells.add(MB.key(r)); st.push(r); } }
      const dx = loopC.n[0] - loopC.c[0], dj = loopC.n[1] - loopC.c[1];
      // the sign on the hedge beside it, on the path side
      const sx = loopDoor.mx - dx * 0.5, sz = loopDoor.mz + dj * 0.5;
      loopDoor.sign = w.sign({ text: baby() ? 'LOOP (locked)' : 'SHORTCUT ▸ EXIT', x: sx, y: WH + 1.0, z: sz, w: 3.2, h: 0.7, rotY: loopDoor.ew ? Math.PI / 2 : 0, color: baby() ? '#ffb48a' : '#e8d0ff', double: true, tw: 512, size: 70, glow: true });
      if (baby()) { loopDoor.locked = true; loopDoor.body.enabled = true; loopDoor.lamp.material = LAMP.stop; }
      // a step through it (into the cell behind) is a step back to the start of the maze
      const tx = MB.cx(loopC.n[0]) - dx * (C / 2 - 1.1), tz = MB.cz(loopC.n[1]) + dj * (C / 2 - 1.1);
      w.trigger({ x: tx, y: 1.2, z: tz, w: dx ? 0.8 : C - T, h: 2.4, d: dx ? C - T : 0.8, once: false, onEnter: () => loopBack() });
    }
    let loops = 0;
    const loopBack = () => {
      if (game.state !== 'playing' || game.baby) return;
      loops++;
      game.player.teleport(MB.entry.x, 0.001, MB.entry.z - 0.6); game.yaw = 0; game.pitch = 0;
      game.audio.glitch(); game.ui.glitch(true); w.after(0.35, () => game.ui.glitch(false));
      game.ui.toast('↺ You are at the start of the maze. Again.', 'bad');
      game.say(loops === 1 ? 'hotel.l4.loop' : 'hotel.l4.loop2', { priority: 2 });
    };
    // the decoy EXIT arch: a dead end in the north half, near the path, not behind the loop door
    const distToPath = (c) => { const s = new Set([MB.key(c)]); let fr = [c], d = 0; while (fr.length) { for (const q of fr) if (MB.onPath(q)) return { d, k: MB.pathIdx.get(MB.key(q)) }; const nx = []; for (const q of fr) for (const r of MB.maze.nbrs(q[0], q[1])) if (!s.has(MB.key(r))) { s.add(MB.key(r)); nx.push(r); } fr = nx; d++; } return { d: 99, k: -1 }; };
    const nearDoor = (c) => doors.some((dd) => dd.M === MB && Math.hypot(dd.mx - MB.cx(c[0]), dd.mz - MB.cz(c[1])) < 3);
    let decoyC = null;
    for (const c of MB.deadEnds) {
      if (loopCells.has(MB.key(c)) || nearDoor(c)) continue;
      const { d, k } = distToPath(c);
      const score = (k >= midB ? 3 : 0) - Math.abs(d - 1.5) * 0.8 + Math.random() * 0.5;   // the north half, a step or two off the path
      if (!decoyC || score > decoyC.score) decoyC = { c, score, k, d };
    }
    let decoy = null;
    if (decoyC) decoy = { cell: decoyC.c, x: MB.cx(decoyC.c[0]), z: MB.cz(decoyC.c[1]), g: fakeExit(w, game, { x: MB.cx(decoyC.c[0]), y: 0, z: MB.cz(decoyC.c[1]), kind: 'goal', label: 'EXIT', color: 0x2dd4bf, say: 'hotel.l4.decoy', reason: 'decoy' }) };

    // ---- maze A, north half: luggage-cart trains ------------------------------------------------------------------
    const carts = [];
    for (const run of pathRuns(MA, { min: 2, skip: doorEdges, from: midA + 2 }).sort(() => Math.random() - 0.5).slice(0, 4)) {   // (never next to the checkpoint)
      const mx = (MA.cx(run.from[0]) + MA.cx(run.to[0])) / 2, mz = (MA.cz(run.from[1]) + MA.cz(run.to[1])) / 2;
      const alongX = run.dir[0] !== 0, Lr = (Math.abs(run.to[0] - run.from[0]) + Math.abs(run.to[1] - run.from[1])) * C, A = Lr / 2 - C / 2 - 0.3;   // (it never reaches the corner cells at either end)
      const len = 1.5, wid = 1.9, side = Math.random() < 0.5 ? -1 : 1, ph = Math.random() * 6, sp = 0.55 * (game.baby ? 0.8 : 1);
      const lx = alongX ? 0 : side * 0.85, lz = alongX ? side * 0.85 : 0;      // the train hugs one wall: the other half of the corridor is yours
      const hz = w.hazard({ x: mx + lx, y: 0.4, z: mz + lz, w: alongX ? len : wid, h: 0.8, d: alongX ? wid : len, color: 0xff3a46, move: (t) => (alongX ? { x: A * Math.sin(t * sp + ph) } : { z: A * Math.sin(t * sp + ph) }) });
      hz.core.visible = false; hz.shell.visible = false; hz.jumpable = true;
      cartVisual(hz.group, alongX, len, wid);
      carts.push({ hz, alongX, run, side });
    }

    // ---- the courtyard: a fountain pool, wall to wall --------------------------------------------------------------
    const water = w.hazard({ x: 0, y: -0.78, z: (WATER_S + WATER_N) / 2, w: tW, h: 1.3, d: WATER_S - WATER_N, color: 0x3a8ac8 });
    water.core.visible = false; water.shell.visible = false;
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x1f5f8a, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.82, emissive: 0x0a2a40, emissiveIntensity: 0.6 });
    const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(tW, WATER_S - WATER_N), waterMat);
    waterMesh.rotation.x = -Math.PI / 2; waterMesh.position.set(0, -0.15, (WATER_S + WATER_N) / 2); w.add(waterMesh);
    const ripple = new THREE.MeshBasicMaterial({ map: softTexture('puff'), color: 0x6ab8ff, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending });
    const ripples = [];
    for (let k = 0; k < 14; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), ripple); m.rotation.x = -Math.PI / 2; m.position.set(-XW + 3 + Math.random() * (tW - 6), -0.13, WATER_N + 2 + Math.random() * (WATER_S - WATER_N - 4)); w.add(m); ripples.push(m); }
    w.onUpdate((dt, t) => { ripples.forEach((m, k) => { m.rotation.z += dt * (k % 2 ? 0.1 : -0.1); }); waterMat.emissiveIntensity = 0.55 + Math.sin(t * 0.8) * 0.08; });

    // the route (stage 3): stones, the fountain's rim, two jets, the cart
    const route = [];
    const mark = (p) => { p.o.path = true; route.push({ x: p.body.x, y: p.top, z: p.body.z }); return p; };
    const stone = (x, y, z, s = 2.4) => {
      const p = w.plat({ x, y, z, w: s, d: s, h: y + 1.4, tex: 'stone', color: 0xcfc3ad, roughness: 0.6, radius: 0.12 });
      const lily = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), plainMaterial(0x3f8a4a, { roughness: 0.7 })); lily.rotation.x = -Math.PI / 2; lily.position.set(x + s / 2 + 0.25, -0.12, z + 0.3); w.add(lily);
      return p;
    };
    const L1 = mark(w.plat({ x: MA.exit.x, y: 0, z: WATER_S - 2.2, w: 5, d: 4.4, h: 1.4, tex: 'stone', color: 0xd9cdb5, roughness: 0.55 }));
    const z0 = WATER_S;
    const S1 = mark(stone(12.0, 0.3, z0 - 6.4));
    const S2 = mark(stone(8.8, 0.45, z0 - 8.4));
    const S3 = mark(w.crumble(stone(5.6, 0.6, z0 - 10.2, 2.2), { delay: 0.65, gone: 3 }));
    // the fountain: a square rim round a tiered column (the rim is the way; the middle is deep)
    const FX = 0.4, FZ = z0 - 13.2, FR = 3.6, RW = 1.8;
    const rim = (x, z, ww, dd) => w.plat({ x, y: 0.6, z, w: ww, d: dd, h: 2.0, tex: 'marble', color: 0xece3cf, roughness: 0.25, radius: 0.08 });
    const FE = mark(rim(FX + FR - RW / 2, FZ, RW, 2 * FR));
    const FS = mark(rim(FX, FZ - FR + RW / 2, 2 * FR - 2 * RW + 0.02, RW));
    const FW = mark(rim(FX - FR + RW / 2, FZ, RW, 2 * FR));
    rim(FX, FZ + FR - RW / 2, 2 * FR - 2 * RW + 0.02, RW);
    w.collider({ x: FX, y: 1.6, z: FZ, w: 1.4, h: 4.0, d: 1.4 });
    fountainVisual(w, FX, FZ);
    const S4 = mark(stone(-5.0, 0.55, z0 - 17.0));
    const S5 = mark(stone(-8.2, 0.5, z0 - 19.4));
    // two jets: a stone with a geyser under it (it bubbles first)
    const jets = [S4, S5].map((s, k) => jet(w, s, { period: game.baby ? 4.2 : 3.2, on: game.baby ? 0.7 : 0.95, warn: 0.7, phase: -0.45 * k }));   // a wave: the second fires just after the first
    // two lily pads that drift from side to side
    const pad = (x, z, ph) => {
      const p = mark(w.plat({ x, y: 0.4, z, w: 2.0, d: 2.0, h: 0.3, tex: 'leather', color: 0x3f8a4a, roughness: 0.7, radius: 0.3 }));
      w.mover(p, (t) => ({ x: 1.2 * Math.sin(t * 1.0 + ph) }));
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), plainMaterial(0xf4a8c8, { roughness: 0.6 })); flower.position.set(0.55, 0.22, -0.5); p.group.add(flower);
      return p;
    };
    const P1 = pad(-10.6, z0 - 23.0, 0), P2 = pad(-7.6, z0 - 26.8, Math.PI);
    // a long lily-pad bridge that gives way once you are half over (it shimmers: that is the tell; keep running)
    const V = mark(w.plat({ x: -6.0, y: 0.4, z: z0 - 32.6, w: 1.8, d: 7.2, h: 0.3, tex: 'leather', color: 0x4f9a5a, roughness: 0.7, radius: 0.2 }));
    vanishAfter(w, game, V, { axis: 'z', dir: -1, frac: 0.55, delay: 0.75, back: 3.2, say: 'hotel.l4.bridge' });
    // the luggage cart on a rail: it rolls to the gate with you on it (and back without you)
    const L2X = MB.cx(0), L2Z = WATER_N + 2.4, L2E = L2X + 2.5;
    const cartZ = WATER_N + 4.2, cart0 = -6.0, cartStop = L2E + 1.1;
    const cart = mark(w.plat({ x: cart0, y: 0.6, z: cartZ, w: 2.2, d: 1.6, h: 0.1, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.03 }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      cart.attach(w.box({ x: cart0 + sx * 1.0, y: 1.25, z: cartZ + sz * 0.7, w: 0.08, h: 1.2, d: 0.08, color: GOLD, metal: 1, rough: 0.28, static: false }));
      cart.attach(w.box({ x: cart0 + sx * 0.9, y: 0.36, z: cartZ + sz * 0.7, w: 0.22, h: 0.22, d: 0.12, color: 0x14141a, rough: 0.5, static: false }));
    }
    cart.attach(w.box({ x: cart0, y: 1.85, z: cartZ, w: 2.1, h: 0.06, d: 0.06, color: GOLD, metal: 1, rough: 0.3, static: false }));
    for (const sz of [-0.55, 0.55]) w.box({ x: (cart0 + cartStop) / 2, y: 0.2, z: cartZ + sz, w: cartStop - cart0 + 3, h: 0.08, d: 0.1, color: 0x8a7a50, metal: 1, rough: 0.4, shadow: false });
    for (let x = cart0 + 1; x > cartStop - 2; x -= 2.2) w.box({ x, y: -0.6, z: cartZ, w: 0.25, h: 1.6, d: 1.3, color: 0x4a4a52, rough: 0.6, shadow: false });
    w.rollaway(cart, { dir: [-1, 0], dist: cart0 - cartStop, accel: 2.4, speed: 3.0, delay: 0.5, hold: 3.2, back: 1.6, onGo: () => game.say('hotel.l4.trolley', { priority: 1 }) });
    const L2 = mark(w.plat({ x: L2X, y: 0, z: WATER_N - 0.0 + 2.4, w: 5, d: 4.8, h: 1.4, tex: 'stone', color: 0xd9cdb5, roughness: 0.55 }));
    void S1; void S2; void FS; void FW; void S5; void P1; void P2; void V;

    // ---- the garden gate: ad-supported -------------------------------------------------------------------------------
    const gate = { open: false, at: 0, body: w.collider({ x: MB.cx(0), y: WH / 2, z: ZB, w: C - T + 0.2, h: WH, d: T * 0.9 }), leaves: [] };
    const iron = plainMaterial(0x1a1a20, { metalness: 0.6, roughness: 0.4 });
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group(); hinge.position.set(MB.cx(0) + s * (C - T) / 2, 0, ZB); w.add(hinge);
      const leaf = new THREE.Group(); leaf.position.x = -s * (C - T) / 4; hinge.add(leaf);
      for (let k = 0; k < 7; k++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.9, 0.06), iron); bar.position.set((k - 3) * 0.26, 1.55, 0); leaf.add(bar); }
      for (const yy of [0.25, 1.6, 2.95]) { const rail = new THREE.Mesh(new THREE.BoxGeometry((C - T) / 2 - 0.05, 0.08, 0.08), iron); rail.position.y = yy; leaf.add(rail); }
      gate.leaves.push({ hinge, s });
    }
    w.sign({ text: 'GARDEN GATE · OPENS AFTER A SHORT MESSAGE', x: MB.cx(0), y: 3.35, z: ZB + 0.5, w: 3.4, h: 0.5, color: '#f1d28a', bg: '#1a1420', double: false, tw: 1024, size: 46 });
    arch(MB.cx(0), ZB + 0.6, 'THE DUSK MAZE', '#c8d4ff');
    let gateSwing = 0;
    w.trigger({
      x: L2X, y: 1.5, z: L2Z, w: 4.6, h: 3, d: 4.4, once: true,
      onEnter: () => { if (gate.open || gate.at) return; const n = game.baby ? 3 : 5; gate.at = w.t + n; adBreak(game, w, { sec: n, say: 'hotel.l4.gate' }); },
    });
    w.onUpdate((dt) => {
      if (!gate.open && gate.at && w.t >= gate.at) { gate.open = true; gate.body.enabled = false; game.audio.chime?.(); game.say('hotel.l4.gateopen', { priority: 1 }); }
      if (gate.open && gateSwing < 1) { gateSwing = Math.min(1, gateSwing + dt * 1.2); for (const l of gate.leaves) l.hinge.rotation.y = l.s * gateSwing * 1.7; }
    });

    // ---- dusk: the fog closes in over maze B ----------------------------------------------------------------------------
    const fogN = { c: new THREE.Color(0x15102c), near: 60, far: 300 }, fogD = { c: new THREE.Color(0x1d1830), near: 3, far: 27 };
    let dusk = 0;
    w.onUpdate((dt) => {
      const want = game.player.z < ZB + 6 ? 1 : 0;
      dusk += Math.max(-dt * 0.6, Math.min(dt * 0.6, want - dusk));
      const f = w.scene.fog; f.near = fogN.near + (fogD.near - fogN.near) * dusk; f.far = fogN.far + (fogD.far - fogN.far) * dusk; f.color.copy(fogN.c).lerp(fogD.c, dusk);
      w.scene.background.copy(f.color);
    });

    // ---- checkpoints and stages -----------------------------------------------------------------------------------------
    const cps = new Map();
    const cp = (i, x, z, y = 0) => { const c = w.checkpoint({ x, y, z, real: true }); cps.set(c, i); return c; };
    cp(1, MA.cx(MA.mid[0]), MA.cz(MA.mid[1]));
    cp(2, L1.body.x, L1.body.z);
    cp(3, L2X, L2Z);
    cp(4, MB.cx(MB.mid[0]), MB.cz(MB.mid[1]));
    cp(5, VX, ZB1 - 3.6);
    w.hooks.onCheckpoint = (c) => {
      const i = cps.get(c); if (i === undefined) return;
      stageTitle(game, w, i + 1, NAMES.length, NAMES[i]);
      const line = [null, 'hotel.l4.half', 'hotel.l4.fountain', null, 'hotel.l4.halfB', 'hotel.l4.vestibule'][i];   // (stage 4: the gate's ad does the talking)
      if (line) game.say(line, { priority: 1 });
    };

    // ---- the host -----------------------------------------------------------------------------------------------------
    const lieA = new Set([3, Math.floor(MA.path.length * 0.45), Math.floor(MA.path.length * 0.8)]);
    const lieB = new Set([Math.floor(MB.path.length * 0.3), Math.floor(MB.path.length * 0.66)]);
    const said = new Set();
    let t0 = 0, intro = false, lastDead = 0, doorSaid = false, cartSaid = false, shortSaid = false, decoySaid = false;
    const deadA = new Set(MA.deadEnds.map(MA.key)), deadB = new Set(MB.deadEnds.map(MB.key));
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l4.intro'); g.say('hotel.l4.intro2'); stageTitle(g, w, 1, NAMES.length, NAMES[0]); }
      const p = g.player;
      for (const [M, lies, dead, tag] of [[MA, lieA, deadA, 'A'], [MB, lieB, deadB, 'B']]) {
        if (!M.inside(p)) continue;
        const [ci, cj] = M.cellOf(p);
        if (!M.grid.inside(ci, cj)) continue;
        const k = M.key([ci, cj]), sk = tag + k;
        if (said.has(sk)) continue;
        said.add(sk);
        const idx = M.pathIdx.get(k);
        if (idx !== undefined && lies.has(idx)) g.say(tag === 'A' ? 'hotel.l4.lie' : 'hotel.l4.lie2', { priority: 1 });
        else if (dead.has(k) && g.time - lastDead > 25) { lastDead = g.time; g.say('hotel.l4.deadend', { priority: 1 }); }
      }
      if (!doorSaid) for (const d of doors) if (d.kind === 'door' && Math.hypot(p.x - d.mx, p.z - d.mz) < 7) { doorSaid = true; g.say('hotel.l4.door', { priority: 1 }); break; }
      if (!cartSaid) for (const c of carts) if (Math.hypot(p.x - c.hz.body.x, p.z - c.hz.body.z) < 9) { cartSaid = true; g.say('hotel.l4.carts', { priority: 1 }); break; }
      if (!shortSaid && loopDoor && !g.baby && Math.hypot(p.x - loopDoor.mx, p.z - loopDoor.mz) < 7) { shortSaid = true; g.say('hotel.l4.shortcut', { priority: 1 }); }
      if (!decoySaid && decoy && Math.hypot(p.x - decoy.x, p.z - decoy.z) < 11) { decoySaid = true; g.say('hotel.l4.decoyseen', { priority: 1 }); }
    };
    onPlat(w, S3, () => game.say('hotel.l4.crumble', { priority: 1 }));
    onPlat(w, FE, () => game.say('hotel.l4.rim', { priority: 1 }));
    onPlat(w, S4, () => game.say('hotel.l4.jets', { priority: 1 }));
    w.hooks.onDeath = (info) => {
      const p = game.player;
      if (info.reason === 'decoy') return true;                                   // (the arch already said its piece)
      if (info.deaths % 6 === 0) { game.say('hotel.l4.count', { priority: 1, vars: { n: info.deaths } }); return true; }
      if (info.reason === 'hazard' && p.z < WATER_S && p.z > WATER_N && p.y < 0.5) { game.say(jets.some((j) => j.hz.enabled && Math.hypot(p.x - j.hz.body.x, p.z - j.hz.body.z) < 1.6) ? 'hotel.l4.jet' : 'hotel.l4.splash', { priority: 1 }); return true; }
      if (info.reason === 'hazard' && jets.some((j) => Math.hypot(p.x - j.hz.body.x, p.z - j.hz.body.z) < 1.6)) { game.say('hotel.l4.jet', { priority: 1 }); return true; }
      if (info.reason === 'hazard' && Math.random() < 0.75) { game.say('hotel.l4.cart', { priority: 1 }); return true; }
      return false;
    };

    // ---- the hint: the way out of the maze you are in, or across the fountain; never further ------------------------------------
    sectionHint(w, [
      { zS: 1e9, zN: WATER_S, hint: (p) => MA.hint(p) },
      { zS: WATER_S, zN: L2Z + 2.4, flat: false, hint: routeHint(route.slice(1, -1), { x: L2X, y: 0, z: L2Z }) },
      { zS: L2Z + 2.4, zN: ZB1 - 0.4, hint: (p) => MB.hint(p) },
      { zS: ZB1 - 0.4, zN: -1e9, hint: routeHint([{ x: VX, y: 0.1, z: ZV0 + 1 }, { x: VX, y: 0.1, z: vest[0].mz - 1.4 }, { x: VX, y: 0.1, z: DZ + DR + 0.3 }, { x: VX, y: 0.1, z: DZ - DR - 0.6 }, { x: VX, y: 0.1, z: vest[1].mz - 1.2 }], { x: VX, y: 0.1, z: goal.z }) },
    ]);

    // the bot keeps to the free half of the corridor while it passes a cart train
    const laneTarget = (p) => {
      for (const c of carts) {
        const r = c.run, xs = [MA.cx(r.from[0]), MA.cx(r.to[0])], zs = [MA.cz(r.from[1]), MA.cz(r.to[1])];
        if (p.x < Math.min(...xs) - C / 2 || p.x > Math.max(...xs) + C / 2 || p.z < Math.min(...zs) - C / 2 || p.z > Math.max(...zs) + C / 2) continue;
        const lane = -c.side * 0.95, tg = c.alongX ? { x: xs[1], z: zs[0] + lane } : { x: xs[0] + lane, z: zs[1] };
        if (Math.hypot(tg.x - p.x, tg.z - p.z) < 0.9) continue;      // (arrived: the maze steering takes over)
        return tg;
      }
      return null;
    };
    // ---- the bot: maze steering, the courtyard's platforms (the default), ride the cart, wait for the gate --------------------------
    w.botPlan = (g) => {
      const p = g.player;
      if (p.z > WATER_S) return laneTarget(p) || MA.steer(p);
      if (p.grounded && p.ground === cart.body) return cart.body.x > cartStop + 0.15 ? { x: cart.body.x, z: cart.body.z, wait: true } : { x: L2X, z: L2Z };
      if (p.z > L2Z + 2.4 || (p.x > L2E && p.z > WATER_N)) return null;
      if (!gate.open) { const at = Math.hypot(p.x - L2X, p.z - (ZB + 2.4)) < 0.6; return { x: L2X, z: ZB + 2.4, wait: at }; }
      if (p.z < ZB1 - 0.4) return p.z > ZV0 - 0.5 && Math.abs(p.x - VX) > 0.4 ? { x: VX, z: ZV0 - 1 } : { x: VX, z: goal.z };
      return MB.steer(p);
    };

    // ---- test handles (tools/test-floors.mjs) ------------------------------------------------------------------------------
    w.maze = { path: MA.path, N: NA, C, X0: MA.X0, Z0: ZA, grid: MA.grid, cx: MA.cx, cz: MA.cz, doors: doors.filter((d) => d.M === MA), carts, nbrs: MA.maze.nbrs, solve: MA.solve, cellOf: MA.cellOf };
    w.l4 = { MA, MB, doors, carts, loopDoor, loopCells, decoy, gate, cart, cartStop, jets, water, route, cps, goal, L1, L2, NAMES, vest, drum, VX, ZV0, ZV1, get loops() { return loops; }, loopBack, doorOpenAt, ZB, WATER_S, WATER_N };
  },
};

// a geyser under a stepping stone: bubbles for `warn` seconds, then a column of water (a hazard) for `on` seconds, every `period`
function jet(w, stone, { period = 3.2, on = 0.95, warn = 0.7, phase = 0 } = {}) {
  const b = stone.body, top = stone.top;
  const hz = w.hazard({ x: b.x, y: top + 1.5, z: b.z, w: 1.5, h: 3.0, d: 1.5, color: 0x9fd8ff });
  hz.core.visible = false; hz.shell.visible = false;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 3.0, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  hz.group.add(col);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); cap.position.y = 1.5; cap.scale.y = 0.5; hz.group.add(cap);
  const bubbleMat = new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xcfeeff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
  const bubbles = [];
  for (let k = 0; k < 6; k++) { const sp = new THREE.Sprite(bubbleMat); sp.scale.set(0.25, 0.25, 1); sp.position.set(b.x + (Math.random() - 0.5) * 1.2, top + 0.1, b.z + (Math.random() - 0.5) * 1.2); sp.visible = false; w.add(sp); bubbles.push(sp); }
  // a grate in the stone, so it reads as "something comes out of here"
  w.box({ x: b.x, y: top + 0.012, z: b.z, w: 0.9, h: 0.02, d: 0.9, color: 0x2a3a48, metal: 0.6, rough: 0.4, shadow: false });
  const phaseOf = (t) => (((t + phase) % period) + period) % period;
  const live = (t) => phaseOf(t) < on;
  hz.predict = (t) => live(t);
  w.onUpdate((dt, t) => {
    const ph = phaseOf(t), on_ = ph < on, warning = !on_ && ph > period - warn;
    hz.enabled = on_; hz.group.visible = on_;
    col.scale.y = on_ ? Math.min(1, ph / 0.15) : 1;
    for (const s of bubbles) { s.visible = warning || on_; if (s.visible) { s.position.y = top + 0.1 + ((t * 2 + s.position.x) % 1) * 0.5; } }
  });
  return { hz, stone, live };
}

// the fountain: tiered bowls on the column, water falling from each tier, a gold finial
function fountainVisual(w, x, z) {
  const stoneM = plainMaterial(0xece3cf, { roughness: 0.3 }), goldM = plainMaterial(GOLD, { metalness: 1, roughness: 0.3 });
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 4.0, 20), stoneM); col.position.y = 1.6; col.castShadow = true; g.add(col);
  for (const [yy, r] of [[1.5, 1.35], [2.6, 0.95], [3.5, 0.6]]) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.45, 0.35, 24), stoneM); bowl.position.y = yy; bowl.castShadow = true; g.add(bowl);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 32), goldM); lip.rotation.x = Math.PI / 2; lip.position.y = yy + 0.17; g.add(lip);
    const fall = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.04, r + 0.25, yy - 0.2, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    fall.position.y = (yy + 0.2) / 2 - 0.1; g.add(fall);
  }
  const fin = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), goldM); fin.position.y = 3.85; g.add(fin);
  g.traverse((o) => { o.matrixAutoUpdate = false; o.updateMatrix(); }); g.matrixAutoUpdate = false; g.updateMatrix();
  w.add(g);
  hotelHalo(w, x, 2.4, z, 6, 0x8ac8ff, 0.18);
}

// a brass luggage-cart train: deck, four posts, a couple of suitcases, a rotating red lamp
function cartVisual(group, alongX, len, wid) {
  const brass = plainMaterial(GOLD, { metalness: 1, roughness: 0.3 });
  const wx = alongX ? len : wid, wz = alongX ? wid : len;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(wx, 0.12, wz), brass); deck.position.y = -0.12; deck.castShadow = true; group.add(deck);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), brass); post.position.set(sx * (wx / 2 - 0.08), 0.0, sz * (wz / 2 - 0.08)); group.add(post);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), plainMaterial(0x111111, { roughness: 0.6 })); wheel.rotation.z = Math.PI / 2; wheel.position.set(sx * (wx / 2 - 0.1), -0.3, sz * (wz / 2 - 0.1)); group.add(wheel);
  }
  const cols = [0x6a3a22, 0x1a2a4a, 0x7a1f2a, 0x2f5d3a];
  for (let k = 0; k < 4; k++) {
    const sc = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.6 : 0.8, 0.5, alongX ? 0.8 : 0.6), plainMaterial(cols[k], { roughness: 0.5 }));
    const t = (k - 1.5) / 2;
    sc.position.set(alongX ? 0 : t * (wid - 0.9), 0.2 + (k % 2) * 0.12, alongX ? t * (wid - 0.9) : 0); sc.castShadow = true; group.add(sc);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glowMaterial(0xff3a46, 2.2)); lamp.position.set(0, 0.62, 0); group.add(lamp);
}
