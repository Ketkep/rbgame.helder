import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture } from '../../engine/materials.js';
import { roomShell, hotelHalo, GOLD } from './kit.js';
import { onPlat } from '../common.js';
import { fakeComplete, fakeExit, twistZone, trollCheckpoint, vanishAfter, stageTitle, stageHint } from './trolls.js';

// Hotel level 6 — "Soufflé" (Medium · Restaurant). The kitchen. The chef made a soufflé. It is rising. You are above it, for now.
// Six stages up the kitchen, each ending on a long steel "pass" counter where the soufflé stops and rests (that is the checkpoint
// rhythm: it never rises above the counter you are standing on, and starts again only when you climb off it):
//   1 Prep Station     boards, sliding trays and a dishwasher belt that runs the wrong way (read the chevrons)
//   2 Grill Line       steam jets (the lamp goes amber first), a swinging pan, an EXIT door that is an oven, and a patch: input lag
//   3 Burner Bank      hot plates on a beat, a SERVICE LIFT that is a shaft, then a checkpoint with small print (it expires)
//   4 Pastry Counter   cookie sheets that crumble, a baking tray that gives way once you are half over (it shimmers: keep running)
//   5 Pot Rack         everything slides, the host says it is ten seconds behind you (it is three)
//   6 Roof Access      the hatch: LEVEL COMPLETE… the soufflé fell… it rose again. Five more steps.
// Baby Mode: the soufflé is slower and starts further back, the lag patch is short, the decoy exits are labelled, the expiring checkpoint keeps.

const NAMES = ['Prep Station', 'Grill Line', 'Burner Bank', 'Pastry Counter', 'Pot Rack', 'Roof Access'];
const STEEL = 0xf0f4fa;
const DY = 0.95;                                   // one hop up
const LANES = [0, -8, 8, -8, 8, 0];                // the x of each stage's climb
const H = 84;
const FLOOR = -11;                                 // top of the kitchen floor (everything stands on pillars from here)

export default {
  id: 'hotel-6',
  name: 'Soufflé',
  music: 'hotel_kitchen',
  completeQuip: 'It rose. You rose faster. Spiritually, you are now a pastry chef.',

  build(w, game) {
    w.env({
      top: 0x120a08, horizon: 0x3a1a10, bottom: 0x0b0605,
      fog: { color: 0x2a140c, near: 40, far: 160 },
      sun: { color: 0xffc890, intensity: 0.4, dir: [0.3, 0.8, 0.5], shadow: false },
      hemi: { sky: 0xffe0b8, ground: 0x8a5a40, intensity: 0.75 },
      exposure: 0.9, stars: 0,
      bloom: { strength: 0.5, radius: 0.7, threshold: 0.95 },
      motes: { color: 0xffd0a0, count: 160, size: 0.09, opacity: 0.55 },
      envMap: { top: 0xffe3b8, mid: 0x6a3a2a, bottom: 0x120c0a, intensity: 0.4, lights: [{ pos: [0, 10, 0], w: 16, h: 16, color: 0xffe2b0, intensity: 2.4 }, { pos: [-14, 3, 0], w: 6, h: 8, color: 0xffa060, intensity: 1.5 }] },
    });
    w.setTheme({ tex: 'metal', color: STEEL, trim: null, edge: null, edgeOpacity: 0, roughness: 0.35, metalness: 0.55, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.spawn = { x: 0, y: 1.0, z: 16.5, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -20;
    roomShell(w, { x0: -14, x1: 14, z0: -38, z1: 22, yb: -12, H, wallTex: 'tile', wallColor: 0xe9ecef, pilasterEvery: 13, lamps: false });
    w.plat({ x: 0, y: -11.5, z: -8, w: 28, d: 60, h: 1, tex: 'tile', color: 0x3a3030, roughness: 0.9 });
    for (const y of [6, 22, 38, 54, 70]) w.light(0xffb070, 20, 44, 0, y, y % 32 ? -6 : 6);

    // ---- the route: stages[i].at = where you respawn once you are in it; .route = what the hint follows ----------------
    const stages = NAMES.map(() => ({ at: null, route: [] }));
    const cps = new Map();
    const placed = NAMES.map(() => []);          // per stage: the platforms of the climb, in order
    const ends = [];                             // the long counters (the last one is the roof): { plat, x, y, z, w }
    const pillar = (x, z, top, ww = 1.1) => w.box({ x, y: (top - 0.45 + FLOOR) / 2, z, w: ww, h: top - 0.45 - FLOOR, d: ww, color: 0x9aa0aa, metal: 0.7, rough: 0.4, shadow: false });
    const dirOf = (si) => (si % 2 === 0 ? -1 : 1);           // stage 1 climbs north, stage 2 south, ...

    const TYPES = {
      steel: { w: 3.0, d: 3.0, h: 0.5 },
      board: { w: 2.0, d: 2.0, h: 0.25, tex: 'wood', color: 0xd9b27c, roughness: 0.6, metalness: 0 },
      pot: { w: 2.4, d: 2.4, h: 0.4, color: 0x555a66, roughness: 0.25, metalness: 0.95, radius: 0.18 },
      cookie: { w: 2.4, d: 2.4, h: 0.15, tex: 'stage', color: 0xc6b08a, roughness: 0.7, metalness: 0.3 },
      tray: { w: 2.6, d: 2.2, h: 0.2, color: 0xe0e4ea, roughness: 0.2, metalness: 0.9 },
      ztray: { w: 2.4, d: 2.4, h: 0.2, color: 0xe0e4ea, roughness: 0.2, metalness: 0.9 },
      burner: { w: 3.0, d: 3.0, h: 0.5, color: 0x2a2c34, roughness: 0.4, metalness: 0.8 },
      belt: { w: 3.0, d: 6.0, h: 0.5, color: 0x4a5160, roughness: 0.5, metalness: 0.5 },
      long: { w: 3.0, d: 7.0, h: 0.2, tex: 'stage', color: 0xd6c39a, roughness: 0.5, metalness: 0.4 },
    };
    const burners = [], vents = [], pans = [], movers = [];
    let cur = { x: 0, y: 1.0, z: 16.5, d: 4 };
    // start: the prep table
    const start = w.plat({ x: 0, y: 1.0, z: 16.5, w: 5, d: 4, h: 0.6, tex: 'tile', color: 0xd8dde4, roughness: 0.3, radius: 0.05, trim: 0xffc060 });
    start.o.path = true; pillar(0, 16.5, 1.0, 1.6);
    stages[0].at = { x: 0, y: 1.0, z: 16.5 };
    w.sign({ text: 'KITCHEN · STAFF ONLY', x: 0, y: 5.5, z: 21.4, w: 7, h: 0.8, color: '#ffd21f', double: false, tw: 1024, size: 54, rotY: Math.PI });

    const climb = (si, specs, gap = 1.0) => {
      const dir = dirOf(si), lane = LANES[si];
      specs.forEach(([type, o = {}], i) => {
        const t = TYPES[type], d = o.d ?? t.d, ww = o.w ?? t.w;
        const g = o.gap ?? gap;
        const x = o.x ?? (i === 0 ? lane : lane + (i % 2 ? 1.4 : -1.4));
        const z = cur.z + dir * (cur.d / 2 + g + d / 2), y = cur.y + (o.dy ?? DY);
        const p = w.plat({ x, y, z, w: ww, d, h: t.h, tex: t.tex ?? 'metal', color: t.color ?? STEEL, roughness: t.roughness ?? 0.3, metalness: t.metalness ?? 0.7, radius: t.radius ?? 0.05, trim: type === 'steel' || type === 'tray' ? 0xffc060 : undefined });
        p.o.path = true;
        const rec = { x, y, z, d, w: ww, type, plat: p, i, si, dir };
        placed[si].push(rec); stages[si].route.push({ x, y, z });
        if (type === 'tray') {
          const A = o.A ?? 1.8, per = o.per ?? 3.4, ph = o.ph ?? i;
          w.mover(p, (t) => ({ x: Math.sin(t * Math.PI * 2 / per + ph) * A }));
          w.box({ x, y: y - 0.32, z, w: 2 * A + ww + 0.2, h: 0.08, d: 0.14, color: 0x8a8d95, metal: 0.8, rough: 0.35, shadow: false });   // the rail it slides on
          movers.push(rec);
        } else if (type === 'ztray') {
          const A = o.A ?? 1.0, per = o.per ?? 3.2, ph = o.ph ?? i;
          w.mover(p, (t) => ({ z: Math.sin(t * Math.PI * 2 / per + ph) * A }));
          w.box({ x, y: y - 0.32, z, w: 0.14, h: 0.08, d: 2 * A + d + 0.2, color: 0x8a8d95, metal: 0.8, rough: 0.35, shadow: false });
          movers.push(rec);
        } else {
          pillar(x, z, y, type === 'belt' || type === 'long' ? 1.6 : 1.1);
          if (type === 'cookie') w.crumble(p, { delay: 0.55, gone: 3.2 });
          if (type === 'belt') w.conveyor(p, { vz: -dir * (o.v ?? 3.0), color: 0x3a2a12 });
          if (type === 'long') { rec.vanish = vanishAfter(w, game, p, { axis: 'z', dir, frac: 0.5, delay: 0.7, back: 3.4, say: 'hotel.l6.cookie' }); }
          if (type === 'burner') burner(rec, burners.length);
        }
        if (o.fn) o.fn(rec);
        cur = { x, y, z, d };
      });
    };
    // the long steel counter at the end of a stage: the soufflé stops below it. The checkpoint is on the side the next climb starts from
    const counter = (si, { x, ww, depth = 3.4 } = {}) => {
      const dir = dirOf(si), nxt = LANES[si + 1] ?? 0;
      const z = cur.z + dir * (cur.d / 2 + 1.0 + depth / 2), y = cur.y + DY;
      const cx = x ?? (LANES[si] + nxt) / 2, cw = ww ?? Math.abs(nxt - LANES[si]) + 7;
      const p = w.plat({ x: cx, y, z, w: cw, d: depth, h: 0.7, tex: 'marble', color: 0xd8d4cc, roughness: 0.3, metalness: 0, radius: 0.05, trim: 0xffc060 });
      p.o.path = true;
      for (const px of [cx - cw / 2 + 1.2, cx + cw / 2 - 1.2]) pillar(px, z, y, 1.4);
      const rec = { plat: p, x: cx, y, z, w: cw, d: depth, si, dir };
      ends[si] = rec; cur = { x: cx, y, z, d: depth };
      // the wall sign above it
      const wz = dir < 0 ? -37.55 : 21.55;
      if (si < 5) w.sign({ text:  `THE PASS · ${NAMES[si].toUpperCase()} ▸ ${NAMES[si + 1].toUpperCase()}`, x: cx, y: y + 3.6, z: wz, w: Math.min(11, cw), h: 0.8, color: '#ffd21f', double: false, tw: 1024, size: 58, rotY: dir < 0 ? 0 : Math.PI, glow: true });
      return rec;
    };
    // the checkpoint on a counter: the pole stands where the next climb starts; the whole counter's width counts
    const stageCp = (si) => {
      const e = ends[si], nl = LANES[si + 1] ?? 0, z = e.z - e.dir * 0.5;        // (the next climb goes back the other way: the pole stands on the side it leaves from)
      const c = w.checkpoint({ x: nl, y: e.y, z, real: true });
      cps.set(c, si); stages[si + 1].at = { x: nl, y: e.y, z };
      w.trigger({ x: e.x, y: e.y + 1.6, z, w: e.w - 1, h: 3.4, d: 2.4, once: false, onEnter: () => { if (c.used) return; c.used = true; w.burst(new THREE.Vector3(nl, e.y + 0.4, z), 0xffc83d, 24); game.onCheckpoint(c); } });
      return c;
    };

    // ---- the hazards, put in the gaps between two climb platforms ---------------------------------------------------
    const burnerMat = { off: glowMaterial(0x7a2010, 0.9), warn: glowMaterial(0xff7a30, 1.8), on: glowMaterial(0xffe8c0, 2.6) };
    const BURN_P = 4.2, BURN_ON = 1.2;                // on for 1.2 s; the ring goes amber for the 0.7 s before that
    function burner(p, k) {
      const hz = w.hazard({ x: p.x, y: p.y + 0.22, z: p.z, w: 2.9, h: 0.44, d: 2.9, color: 0xff6a20 });
      hz.core.visible = false; hz.shell.visible = false;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 8, 28), burnerMat.off); ring.rotation.x = Math.PI / 2; ring.position.set(p.x, p.y + 0.06, p.z); w.add(ring);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 8, 24), burnerMat.off); ring2.rotation.x = Math.PI / 2; ring2.position.set(p.x, p.y + 0.06, p.z); w.add(ring2);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.4, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); flame.position.set(p.x, p.y + 0.8, p.z); w.add(flame);
      hz.enabled = false; hz.group.visible = false; flame.visible = false;
      const ph = k * 1.9;      // (the amber warning is the last 0.7 s of the dark spell)
      hz.predict = (t) => ((((t + ph) % BURN_P) + BURN_P) % BURN_P) < BURN_ON;
      hz.burnPhase = ph;
      burners.push({ hz, ring, ring2, flame, ph, plat: p.plat });
    }
    const gapOf = (si, k) => { const a = placed[si][k], b = placed[si][k + 1]; return { a, b, mx: (a.x + b.x) / 2, mz: (a.z + b.z) / 2, low: Math.min(a.y, b.y), high: Math.max(a.y, b.y), gap: Math.abs(a.z - b.z) - a.d / 2 - b.d / 2 }; };
    const VENT_P = 3.6, VENT_ON0 = 1.2, VENT_ON1 = 2.5;
    const vent = (si, k) => {
      const { mx, mz, low, gap } = gapOf(si, k);
      const ph = (si * 7 + k) * 0.9;
      const predict = (t) => { const u = (((t + ph) % VENT_P) + VENT_P) % VENT_P; return u > VENT_ON0 && u < VENT_ON1; };
      // a curtain of three jets side by side (each its own hazard: the climb zigzags, and nobody gets round the end)
      const hzs = [-2.4, 0, 2.4].map((dx) => {
        const hz = w.hazard({ x: mx + dx, y: low + 1.4, z: mz, w: 2.4, h: 5.2, d: Math.max(0.5, gap - 0.5), color: 0xdde8ff });
        hz.core.visible = false; hz.shell.visible = false; hz.enabled = false; hz.group.visible = false; hz.predict = predict;
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.2, 8, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xeef4ff, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        cone.position.y = -1.3; hz.group.add(cone);
        return hz;
      });
      const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('puff'), color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })); puff.scale.set(3.2, 3.2, 1); puff.position.y = 2.2; hzs[1].group.add(puff);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 8, 10), plainMaterial(0x8a8d95, { metalness: 0.9, roughness: 0.35 })); pipe.position.set(mx, low - 4.3, mz); w.add(pipe);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), glowMaterial(0x40ff88, 1.6)); lamp.position.set(mx, low - 0.55, mz); w.add(lamp);
      const lamp2 = lamp.clone(); lamp2.position.x = mx - 3.2; w.add(lamp2); const lamp3 = lamp.clone(); lamp3.position.x = mx + 3.2; w.add(lamp3);
      vents.push({ hz: hzs[0], hzs, puff, lamps: [lamp, lamp2, lamp3], ph, si, k, predict });
    };
    const pan = (si, k, A = 2.6) => {
      const { mx, mz, high } = gapOf(si, k);
      const hz = w.hazard({ x: mx, y: high + 1.15, z: mz, w: 1.5, h: 0.5, d: 1.5, color: 0xff3a46, move: (t) => ({ x: Math.sin(t * 1.9 + si + k) * A }) });
      hz.core.visible = false; hz.shell.visible = false;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.62, 0.16, 20), plainMaterial(0x2c2d33, { metalness: 0.9, roughness: 0.3 })); m.castShadow = true; hz.group.add(m);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.16), plainMaterial(0x2c2d33, { metalness: 0.9, roughness: 0.3 })); handle.position.set(1.2, 0, 0); hz.group.add(handle);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 8, 6), plainMaterial(0x8a8d95, { metalness: 0.9, roughness: 0.4 })); chain.position.y = 4.1; hz.group.add(chain);
      pans.push(hz);
      hz.si = si;
    };

    // =============================== stage 1 · prep station =============================================================
    climb(0, [['steel'], ['board'], ['steel'], ['tray', { A: 1.6, per: 3.6 }], ['belt', { v: 3.0 }], ['pot'], ['tray', { A: 1.8, per: 3.2, ph: 2 }], ['board'], ['steel'], ['pot'], ['steel']]);
    counter(0);
    stageCp(0);

    // =============================== stage 2 · grill line ===============================================================
    climb(1, [['steel'], ['steel'], ['board'], ['pot'], ['tray', { A: 1.8, per: 3.4 }], ['steel'], ['board'], ['steel'], ['pot'], ['steel'], ['tray', { A: 1.8, per: 3.2, ph: 1 }]]);
    vent(1, 2); pan(1, 6); vent(1, 8);
    // the EXIT: a door on the west wall, beside the 7th board, that opens on the oven
    {
      const r = placed[1][6];
      w.plat({ x: -12.4, y: r.y, z: r.z, w: 2.8, d: 3.0, h: 0.3, tex: 'metal', color: STEEL, roughness: 0.3 });
      fakeExit(w, game, { x: -13.3, y: r.y, z: r.z, yaw: Math.PI / 2, kind: 'door', label: 'EXIT', say: 'hotel.l6.fakeexit', reason: 'oven' });
      pillar(-12.4, r.z, r.y, 1.0);
      w.trigger({ x: -9.5, y: r.y + 2, z: r.z, w: 8, h: 4, d: 4, once: true, onEnter: () => game.say('hotel.l6.exit', { priority: 1 }) });
    }
    // a patch goes out: input lag, over the first two steps after the tray
    { const r = placed[1][5]; twistZone(game, w, { x: r.x, y: r.y + 1.6, z: r.z, w: 4, h: 3.2, d: 3 }, 'lag', { sec: 5, say: 'hotel.l6.lag' }); }
    counter(1);
    stageCp(1);

    // =============================== stage 3 · burner bank =============================================================
    climb(2, [['steel'], ['burner'], ['steel'], ['burner'], ['tray', { A: 1.8, per: 3.0, ph: 0.5 }], ['steel'], ['burner'], ['pot'], ['burner'], ['steel'], ['tray', { A: 1.8, per: 3.6, ph: 2 }]]);
    // the SERVICE LIFT: a glowing ring on the east wall, beside the 6th step, over a shaft
    {
      const r = placed[2][5];
      w.plat({ x: 12.4, y: r.y, z: r.z, w: 2.8, d: 3.0, h: 0.3, tex: 'metal', color: STEEL, roughness: 0.3 });
      pillar(12.4, r.z, r.y, 1.0);
      fakeExit(w, game, { x: 12.4, y: r.y, z: r.z, kind: 'goal', label: 'SERVICE LIFT', say: 'hotel.l6.lift', reason: 'lift' });
      w.trigger({ x: 9, y: r.y + 2, z: r.z + 2, w: 6, h: 4, d: 5, once: true, onEnter: () => game.say('hotel.l6.liftsee', { priority: 1 }) });
    }
    counter(2);
    // the checkpoint with small print (floors 2 and 3: it forgets itself 28 s after you touch it; Baby Mode keeps it)
    {
      const e = ends[2], nl = LANES[3], z = e.z - e.dir * 0.5;
      const c = trollCheckpoint(w, game, { x: nl, y: e.y, z, mode: 'expire', ttl: 28, say: 'hotel.l6.expired' });
      cps.set(c, 2); stages[3].at = { x: nl, y: e.y, z };
    }

    // =============================== stage 4 · pastry counter ==========================================================
    climb(3, [['steel'], ['cookie'], ['cookie'], ['board'], ['cookie'], ['long'], ['steel'], ['cookie'], ['pot'], ['cookie'], ['steel']]);
    counter(3);
    stageCp(3);

    // =============================== stage 5 · pot rack ================================================================
    climb(4, [['steel'], ['tray', { A: 1.8, per: 3.2 }], ['pot'], ['ztray', { A: 1.0, per: 3.0, gap: 1.8 }], ['steel', { gap: 1.8 }], ['tray', { A: 1.8, per: 2.8, ph: 1 }], ['ztray', { A: 1.0, per: 3.4, gap: 1.8 }], ['steel', { gap: 1.8 }], ['pot'], ['tray', { A: 1.8, per: 3.0, ph: 2 }], ['steel']]);
    vent(4, 0); pan(4, 4, 2.2); vent(4, 8);
    counter(4);
    stageCp(4);

    // =============================== stage 6 · roof access =============================================================
    climb(5, [['steel'], ['burner'], ['steel'], ['cookie'], ['tray', { A: 1.8, per: 3.2 }], ['steel'], ['burner'], ['pot'], ['cookie'], ['steel'], ['pot']]);
    vent(5, 3); pan(5, 7, 2.2);
    // the roof: a wide steel apron and the hatch
    const roofRec = counter(5, { x: 0, ww: 10, depth: 4.0 });
    const roofY = roofRec.y, roofZ = roofRec.z;
    const roofCp = (() => { const c = w.checkpoint({ x: -3.2, y: roofY, z: roofZ + 0.6, real: true }); cps.set(c, 5); stages[6] = { at: { x: -3.2, y: roofY, z: roofZ + 0.6 }, route: [] }; return c; })();
    w.trigger({ x: 0, y: roofY + 1.6, z: roofZ, w: 9, h: 3.4, d: 3.6, once: false, onEnter: () => { if (roofCp.used) return; roofCp.used = true; game.onCheckpoint(roofCp); } });
    w.sign({ text: 'ROOF ACCESS', x: 0, y: roofY + 4.6, z: roofZ + 1.0, w: 4.4, h: 0.8, color: '#ffd21f', double: true, tw: 1024, size: 66 });
    // the bonus: five more steps (only there once the host has been rude)
    const bonus = [[-3.0, 2.6], [-6.4, 2.6], [-3.4, 2.4], [0.4, 2.4], [4.2, 3.0]].map(([x, s], k) => {
      const z = roofZ - 5 - k * 3.6, y = roofY + DY * (k + 1);
      const p = w.plat({ x, y, z, w: s, d: s, h: 0.3, tex: 'marble', color: 0xd8d4cc, roughness: 0.3, radius: 0.05, trim: 0xffc060 });
      p.o.path = true; p.setEnabled(false); stages[6].route.push({ x, y, z });
      return p;
    });
    // (the real hatch is on the last bonus step: five steps back down the room)
    const last = bonus[bonus.length - 1];
    const finalGoal = w.goal({ x: last.body.x, y: last.top, z: last.body.z, color: GOLD, onReach: () => { game.say('hotel.l6.done', { priority: 2 }); game.completeLevel(); } });
    finalGoal.group.visible = false; finalGoal.trig.enabled = false;
    const fakeGoal = w.goal({ x: 0, y: roofY, z: roofZ - 0.4, color: GOLD, onReach: () => { if (!fakeComplete(game, w, { title: 'LEVEL COMPLETE', jk: '…IT ROSE AGAIN', say: 'hotel.l6.fakewin', sayAfter: null, then: enableBonus })) { game.say('hotel.l6.done', { priority: 2 }); game.completeLevel(); } } });
    w.goalObj = fakeGoal;
    let bonusOn = false;
    const enableBonus = () => {
      bonusOn = true;
      for (const p of bonus) { p.setEnabled(true); w.burst(new THREE.Vector3(p.body.x, p.top + 0.3, p.body.z), GOLD, 12, 3); }
      finalGoal.group.visible = true; finalGoal.trig.enabled = true; w.goalObj = finalGoal;
      fakeGoal.group.visible = false; fakeGoal.trig.enabled = false;
      foam.y = Math.max(foam.y, roofY - 7); foam.hold = 1.5;
      game.say('hotel.l6.bonus', { priority: 2 });
    };
    const finalY = last.top;

    // ---- decor: ovens, pot racks, hanging pans, steel girders -----------------------------------------------------------
    for (let z = 12; z > -32; z -= 9) for (const sx of [-1, 1]) {
      w.box({ x: sx * 13.1, y: 2.0, z, w: 1.6, h: 4.0, d: 5.5, color: 0x8b9099, metal: 0.8, rough: 0.35, shadow: false });
      w.box({ x: sx * 12.2, y: 1.9, z, w: 0.12, h: 2.6, d: 2.8, color: 0x15161a, rough: 0.3, shadow: false });
      w.box({ x: sx * 12.17, y: 3.4, z, w: 0.1, h: 0.14, d: 2.0, glow: 0xff7a30, glowIntensity: 1.3, shadow: false });
    }
    for (let k = 0; k < 14; k++) {
      const y = 12 + k * 5.2, x = ((k * 7) % 5 - 2) * 4, z = -26 + ((k * 11) % 7) * 7;
      for (let j = 0; j < 4; j++) { const pn = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.12, 14), plainMaterial(0x30323a, { metalness: 0.9, roughness: 0.35 })); pn.position.set(x + j * 1.1, y - 0.8, z); w.add(pn); }
      w.box({ x: x + 1.7, y, z, w: 5, h: 0.12, d: 0.12, color: 0x8a8d95, metal: 0.9, rough: 0.35, shadow: false });
    }
    for (let y = 8; y < H - 8; y += 8) for (const z of [-26, 14]) { w.box({ x: 0, y, z, w: 26, h: 0.3, d: 0.3, color: 0x6f7480, metal: 0.8, rough: 0.4, shadow: false }); hotelHalo(w, 0, y - 0.5, z, 8, 0xffa860, 0.12); }
    for (const sx of [-1, 1]) for (const z of [-30, -10, 10]) w.box({ x: sx * 13.6, y: H / 2 - 6, z, w: 0.5, h: H - 10, d: 0.5, color: 0xb87333, metal: 0.9, rough: 0.35, shadow: false });   // copper risers up the walls

    // ---- hazards that tick ------------------------------------------------------------------------------------------------
    w.onUpdate((dt, t) => {
      for (const b of burners) {
        const u = (((t + b.ph) % BURN_P) + BURN_P) % BURN_P;
        const state = u < BURN_ON ? 'on' : u > BURN_P - 0.7 ? 'warn' : 'off';
        const on = state === 'on';
        if (b.hz.enabled !== on) { b.hz.enabled = on; b.hz.group.visible = on; b.flame.visible = on; }
        const m = burnerMat[state]; if (b.ring.material !== m) { b.ring.material = m; b.ring2.material = m; }
        if (on) b.flame.scale.y = 0.85 + 0.25 * Math.sin(t * 22);
      }
      for (const v of vents) {
        const u = (((t + v.ph) % VENT_P) + VENT_P) % VENT_P;
        const on = u > VENT_ON0 && u < VENT_ON1, warn = u > VENT_ON0 - 0.5 && u <= VENT_ON0;
        for (const hz of v.hzs) if (hz.enabled !== on) { hz.enabled = on; hz.group.visible = on; }
        const m = on ? LAMPM.on : warn ? LAMPM.warn : LAMPM.off;
        for (const l of v.lamps) l.material = m;
        if (on) v.puff.material.opacity = 0.35 + 0.2 * Math.sin(t * 17);
      }
    });
    const LAMPM = { off: glowMaterial(0x40ff88, 1.6), warn: glowMaterial(0xffc040, 1.8), on: glowMaterial(0xff3a46, 2.0) };

    // ============================ the soufflé ===============================================================================
    // it rises (0.66 m/s) but never above the counter you are working towards, and it waits a moment each time you climb off one.
    // `lead` = how far under a counter it rests; stage 5 rests closer (and sets off at once): the host says otherwise
    const lead = [3.4, 3.4, 3.4, 2.5, 3.4, 3.4, 3.4], hold0 = [2.4, 2.4, 2.4, 2.4, 0.9, 2.4, 2.4];
    const capY = (k) => (k < 6 ? ends[k].y : finalY) - lead[k] - (game.baby ? 0.8 : 0);
    const stageOf = (py) => { for (let k = 0; k < 6; k++) if (py < ends[k].y + 0.5) return k; return 6; };
    const speed = () => (game.baby ? 0.5 : 0.66) * (w.souffle ? w.souffle.scale : 1);
    const foam = { y: -5, hold: 6, stage: 0, rising: false };
    const foamTop = () => foam.y;
    const foamHz = w.hazard({ x: 0, y: -12, z: -8, w: 27.5, h: 14, d: 59, color: 0xffd9a0, move: () => ({ y: foam.y + 5 }) });
    foamHz.core.visible = false; foamHz.shell.visible = false;
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xf2dcae, roughness: 0.85, emissive: 0x3a2410, emissiveIntensity: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(27.5, 14, 59), creamMat); body.position.y = 0; foamHz.group.add(body);
    const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 8), creamMat, 150);
    const seeds = []; const m4 = new THREE.Matrix4();
    for (let i = 0; i < 150; i++) seeds.push([Math.random() * 25 - 12.5, Math.random() * 55 - 27.5, 0.5 + Math.random() * 1.0, Math.random() * 6]);
    foamHz.group.add(bubbles);
    const crown = new THREE.Mesh(new THREE.PlaneGeometry(27.5, 59), new THREE.MeshBasicMaterial({ map: softTexture('puff'), color: 0xffe8c0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); crown.rotation.x = -Math.PI / 2; crown.position.y = 7.9; foamHz.group.add(crown);
    w.onUpdate((dt, t) => {
      for (let i = 0; i < seeds.length; i++) { const [sx, sz, s, ph] = seeds[i]; m4.makeScale(s, s * (0.7 + 0.3 * Math.sin(t * 2 + ph)), s); m4.setPosition(sx, 7.1 + 0.25 * Math.sin(t * 1.5 + ph), sz); bubbles.setMatrixAt(i, m4); }
      bubbles.instanceMatrix.needsUpdate = true;
      if (game.state !== 'playing') return;
      const p = game.player, st = stageOf(p.y);
      if (st !== foam.stage) { if (st > foam.stage) foam.hold = Math.max(foam.hold, hold0[foam.stage + 1] ?? 2.4); foam.stage = st; }
      const cap = capY(foam.stage);
      if (foam.hold > 0) { foam.hold -= dt; return; }
      if (foam.y < cap) { foam.y = Math.min(cap, foam.y + speed() * dt); if (!foam.rising) { foam.rising = true; if (!said.rise) { said.rise = 1; game.say('hotel.l6.rise', { priority: 1 }); } } }
    });
    const respawnFoam = () => {
      foam.y = Math.max(-5, w.respawn.y - (game.baby ? 8.5 : 7.5)); foam.hold = w.respawn.y < 2 ? 6 : 2.5; foam.stage = stageOf(w.respawn.y); foam.rising = false;
      if (foam.y > capY(foam.stage)) foam.y = capY(foam.stage);
    };
    w.onRespawn(respawnFoam);

    // ---- the host --------------------------------------------------------------------------------------------------------------
    let t0 = 0, intro = false; const said = {};
    const once = (k, key = k) => { if (said[k]) return; said[k] = true; game.say(key, { priority: 1 }); };
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      const p = g.player;
      if (!intro && t0 > 1.0) { intro = true; g.say('hotel.l6.intro'); g.say('hotel.l6.intro2'); stageTitle(g, w, 1, NAMES.length, NAMES[0]); }
      // it has reached the counter it was heading for: the host explains (once per attempt)
      if (foam.hold <= 0 && foam.y >= capY(foam.stage) - 0.01 && !said['pause' + foam.stage] && foam.stage < 6) { said['pause' + foam.stage] = 1; game.say('hotel.l6.pause', { priority: 1 }); }
      if (foam.hold <= 0 && foam.rising && p.y - foam.y < 4 && p.y - foam.y > 0 && !said.near) { said.near = 1; game.say('hotel.l6.near', { priority: 1 }); }
    };
    w.hooks.onCheckpoint = (c) => {
      const i = cps.get(c);
      if (i === undefined) return;
      if (i < 5) stageTitle(game, w, i + 2, NAMES.length, NAMES[i + 1]);
      if (i >= 5) return;
      game.say('hotel.l6.s' + (i + 2), { priority: 1 });
      // the next climb goes the other way: face it
      w.respawn.yaw = dirOf(Math.min(i + 1, 5)) > 0 ? Math.PI : 0;
    };
    // lines on the way up
    onPlat(w, placed[0][3].plat, () => once('tray', 'hotel.l6.tray'));
    onPlat(w, placed[0][4].plat, () => once('belt', 'hotel.l6.belt'));
    onPlat(w, placed[1][3].plat, () => once('vents', 'hotel.l6.vents'));
    onPlat(w, placed[1][7].plat, () => once('pans', 'hotel.l6.pans'));
    onPlat(w, placed[2][1].plat, () => once('burner', 'hotel.l6.burner'));
    onPlat(w, placed[3][1].plat, () => once('cookies', 'hotel.l6.cookies'));
    onPlat(w, placed[4][0].plat, () => once('lie', 'hotel.l6.lie10'));
    onPlat(w, placed[4][1].plat, () => once('slide', 'hotel.l6.slide'));
    onPlat(w, placed[5][9].plat, () => once('top', 'hotel.l6.top'));
    onPlat(w, roofRec.plat, () => once('roof', 'hotel.l6.roof'));
    w.hooks.onDeath = (info) => {
      if (info.reason === 'oven' || info.reason === 'lift') return true;               // (the decoy exit already said its piece)
      const p = game.player;
      if (info.reason === 'hazard' || info.reason === 'void') {
        if (p.y < foam.y + 1.5 || p.y < -9) { game.say('hotel.l6.foam', { priority: 2 }); return true; }
        if (Math.random() < 0.7) { game.say('hotel.l6.burn', { priority: 2 }); return true; }
      }
      if (info.reason === 'fall' && Math.random() < 0.6) { game.say('hotel.l6.fall', { priority: 1 }); return true; }
      return false;
    };
    stageHint(w, stages, { flat: false });
    const baseHint = w.hintFn;
    w.hintFn = (g) => {
      const p = g.player;
      if (!bonusOn && p.y > roofY - 0.5) return [{ x: p.x, y: p.y + 0.15, z: p.z }, { x: fakeGoal.x, y: fakeGoal.y + 0.15, z: fakeGoal.z }];
      if (bonusOn && p.y > roofY - 0.5) return [{ x: p.x, y: p.y + 0.15, z: p.z }, ...stages[6].route.map((q) => ({ x: q.x, y: q.y + 0.15, z: q.z }))];
      return baseHint(g);
    };
    // the bot: wait out the input-lag patch; chase the hatch until the real one exists
    w.botPlan = (g) => {
      const p = g.player, t = w.t;
      if (g.mods.jumpLag && p.grounded) return { x: p.x, z: p.z, wait: true };
      if (!bonusOn && p.grounded && p.y > roofY - 0.5) return { x: fakeGoal.x, z: fakeGoal.z };
      // along a long counter to where the next climb starts (not diagonally off its edge)
      if (p.grounded && p.ground) {
        const ei = ends.findIndex((e) => e && e.plat.body === p.ground);
        if (ei >= 0 && ei < 5) { const n0 = placed[ei + 1][0], e = ends[ei]; if (Math.abs(p.x - n0.x) > 1.0) return { x: n0.x, z: e.z - e.dir * 1.0 }; }
      }
      // timing: do not set off for a hot plate or a steam gap unless it will stay quiet for the whole hop (a human reads the lamps)
      if (p.grounded && p.ground) {
        pathBodies = pathBodies || w.plats.filter((q) => q.o.path);
        const k = pathBodies.findIndex((q) => q.body === p.ground);
        const nx = pathBodies[k + 1];
        if (k >= 0 && nx && !burners.some((b) => b.plat.body === p.ground)) {
          const b = burners.find((q) => q.plat === nx);
          if (b) { for (let tau = 0.2; tau <= 1.5; tau += 0.1) if (b.hz.predict(t + tau)) return { x: p.x, z: p.z, wait: true }; }
          const a = pathBodies[k], x0 = Math.min(a.body.x, nx.body.x) - 4, x1 = Math.max(a.body.x, nx.body.x) + 4, z0 = Math.min(a.body.z, nx.body.z), z1 = Math.max(a.body.z, nx.body.z);
          for (const hz of pans) {
            const vz = hz.base.z;
            if (vz > z0 - 0.1 && vz < z1 + 0.1 && Math.abs(hz.base.y - nx.top) < 3) { for (let tau = 0.1; tau <= 0.5; tau += 0.1) { const px = hz.base.x + hz.move(t + tau).x; if (Math.abs(px - (p.x + nx.body.x) / 2) < 1.6) return { x: p.x, z: p.z, wait: true }; } }
          }
          for (const v of vents) {
            const vz = v.hz.body.z, vx = v.hz.body.x;
            if (vz > z0 - 0.1 && vz < z1 + 0.1 && vx > x0 && vx < x1 && Math.abs(v.hz.body.y - nx.top) < 4) { for (let tau = 0; tau <= 0.7; tau += 0.1) if (v.predict(t + tau)) return { x: p.x, z: p.z, wait: true }; }
          }
        }
      }
      return null;
    };
    let pathBodies = null;
    w.souffle = { scale: 1, foam, foamTop, plats: placed.flat().map((r) => r.plat), placed, ends, caps: capY, stageOf, burners, vents, pans, movers, stages, cps, roofCp, bonus, finalGoal, fakeGoal, get bonusOn() { return bonusOn; }, get startY() { return foam.y; }, get hold() { return foam.hold; } };
  },
};
