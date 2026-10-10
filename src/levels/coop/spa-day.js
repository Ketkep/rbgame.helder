import * as THREE from 'three';
import { chain } from '../common.js';
import { glowMaterial } from '../../engine/materials.js';
import { retreatEnv, deck, stone, sign, roleSign, lantern, lake, stage, botSteps, beacon, COL } from './kit.js';
import { controlRoom, liveScreen, consoleButton, rail, vent, mud, belt, iceTile, pool, gate, aroma, SCENTS } from './spa-day-kit.js';

// Session 5 — Spa Day. Asymmetric control: one of you stands in a glass control room with a live map console and a row of valves,
// the other crosses the spa. Wing A: the first player crosses (steam corridor, mud bath + conveyor, the four sauna doors, the cold plunge).
// Wing B: roles swap, new gadgets (mist tiles, colour-coded sliding gates, a second steam hall, sinking pool tiles). The controller walks out to join.
// Dusk over the lake. First-time pairs: ~10 minutes.

// ---- layout constants (z runs negative) ----
const A = { rows: [-34, -42, -50], mud: [-60, -76], belt: [-76, -88], rest: [-88, -96], hall: [-96, -116], gateZ: -106, tiles: [-121, -128, -135, -142], lounge: [-167, -180] };
const L = { chairs: [-183, -187.5, -192], deck2: [-195, -212] };
const B = { entry: [-212, -222], gateZ: -214, rowZ0: -223.7, rowStep: 3.4, rows: 7, mistEnd: -245.8, rest1: [-245.8, -252], slip: [-252, -292], gates: [-260, -272, -284], rest2: [-292, -300], vents: [-332, -340.5, -349], ventDeck: [-300, -355], plaza: [-392, -413], goalZ: -405 };

const GATE_COLORS = [{ name: 'TEAL', hex: 0x39d7c9 }, { name: 'ROSE', hex: 0xff6f9c }, { name: 'GOLD', hex: 0xffc83d }];

export default {
  id: 'coop5',
  name: 'Spa Day',
  music: 'l5',
  deathRule: 'self',
  completeQuip: 'Two wings. One towel. Zero trust issues, apparently. The counsellor is billing you anyway.',
  titleCam: { center: [0, 2, -90], radius: 40, height: 18 },

  build(w, game) {
    retreatEnv(w, { mood: 'dusk' });
    lake(w, -30);
    const c = w.coop, me = c.me, N = c.names, P = c.partner;
    w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    const tell = (r, k, o) => c.tell(r, k, o);
    const pulse = (key) => c.set(key, (c.get(key, 0) | 0) + 1);
    const ctlA = me === 'p2', ctlB = me === 'p1';                  // am I the controller in wing A / wing B?
    const rA = c.rng(5), rB = c.rng(55);

    // ================================================================ seeds (same on both machines) ================
    const stuckA = Math.floor(rA() * 3);                             // which of the three steam rows is stuck on
    const safeDoor = Math.floor(rA() * 4);                           // which sauna door is safe (0..3)
    const others = [0, 1, 2, 3].filter((k) => k !== safeDoor);
    const signDoor = others.splice(Math.floor(rA() * 3), 1)[0];       // what the lying sign says
    const lieDoor = others[Math.floor(rA() * 2)];                    // what the counsellor tells the crosser (differs from the sign)
    const path = [];                                                 // mist tiles: safe column per row (0..2)
    path[0] = Math.floor(rB() * 3);
    for (let i = 1; i < B.rows; i++) path[i] = Math.max(0, Math.min(2, path[i - 1] + [-1, 0, 1][Math.floor(rB() * 3)]));
    const perm = [0, 1, 2];                   // gate g has colour GATE_COLORS[perm[g]]
    for (let i = 2; i > 0; i--) { const j = Math.floor(rB() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const stuckB = Math.floor(rB() * 3);
    const seqA = Array.from({ length: 5 }, () => Math.floor(rA() * 4));            // scent order for the lock in wing A (the crosser reads it)
    const seqB = Array.from({ length: 6 }, () => Math.floor(rB() * 4));            // and wing B (the controller reads it)

    // ================================================================ 0. reception ===========================
    deck(w, { x: 0, y: 0, z: -9, w: 28, d: 30, path: true });                            // z 6 … -24
    sign(w, 'SERENITY FALLS · SPA DAY', 0, 5.4, 4, { w: 12, h: 1.6 });
    sign(w, 'SESSION 5: ONE OF YOU RUNS THE CONTROL ROOM', 0, 3.7, 4, { w: 11, h: 1, border: '#39d7c9', size: 30 });
    for (const lx of [-12, 12]) { lantern(w, lx, 0, 2); lantern(w, lx, 0, -20); }
    roleSign(w, 'p1', `${N.p1}: YOU CROSS FIRST ↓`, -5, 3.0, -16, { w: 6.4, h: 1.0, size: 32 });
    roleSign(w, 'p2', `${N.p2}: YOU RUN THE CONTROL ROOM → STAIRS`, 9, 3.0, -16, { w: 7.8, h: 1.0, size: 28 });
    roleSign(w, 'p1', `${N.p2} IS IN THE GLASS ROOM. YOU CAN'T SEE THEIR SCREEN.`, 0, 4.6, -22, { w: 11, h: 1.0, size: 26 });
    stage(w, 'welcome', { x: 0, y: 1, z: 2, w: 30, h: 4, d: 8 }, () => { tell('p1', 'coop.l5.intro.p1', { priority: 2 }); tell('p2', 'coop.l5.intro.p2', { priority: 2 }); });

    // ---- wing A control room (east) ----
    // steps up from the reception: y1 (x 14..17), y2 (x 17..20), room floor y3 (x 20..36)
    stone(w, { x: 15.5, y: 1, z: -16, w: 3, d: 4, h: 1 }); stone(w, { x: 18.5, y: 2, z: -16, w: 3, d: 4, h: 1 });
    const roomA = controlRoom(w, { side: 1, z0: -8, z1: -30, dz0: -13.5, dz1: -18.5, exitZ: -25, title: 'CONTROL ROOM · WING A' });
    // walkway out of room A, down to the lounge
    deck(w, { x: 38.5, y: 3, z: -99, w: 4, d: 154, h: 1, color: 0xd8c4a0 });                // z -22 … -176
    rail(w, { x: 40.6, y: 3, z: -99, len: 154 }); rail(w, { x: 36.45, y: 3, z: -98, len: 140 }); rail(w, { x: 38.5, y: 3, z: -21.8, len: 4.4, axis: 'x' });
    stone(w, { x: 34.5, y: 2, z: -172, w: 4, d: 8, h: 1 }); stone(w, { x: 23, y: 1, z: -172, w: 18, d: 8, h: 1 });
    for (const lz of [-40, -70, -100, -130, -160]) lantern(w, 40, 3, lz);

    // ================================================================ WING A =====================================
    // A1 steam corridor
    deck(w, { x: 0, y: 0, z: -42, w: 10, d: 36, path: true });                            // z -24 … -60
    const gateA = gate(w, { x: 0, z: -26, w: 10, h: 4.5 });
    const readyA = c.zone({ x: 28, y: 4.8, z: -19, w: 15, h: 3, d: 20, need: 'p2', shrink: 0 });
    let aOpen = false;
    w.updaters.push(() => { if (readyA.p2) aOpen = true; gateA.set(aOpen); });
    sign(w, 'WING A · THE STEAM HALL', 0, 5.4, -27.5, { w: 8, h: 1, border: '#ff8a5c' });
    sign(w, 'GATE OPENS WHEN YOUR PARTNER IS AT THE CONSOLE', 0, 4.2, -24.4, { w: 8, h: 0.8, size: 26 });
    const ventEndA = [-1, -1, -1];
    const ventsA = A.rows.map((z, k) => vent(w, { z, stuck: k === stuckA, offset: k * 1.7, venting: (t) => Math.max(0, ventEndA[k] - t) }));
    for (let k = 0; k < 3; k++) c.on('A.v' + k, () => { ventEndA[k] = w.t + 7.5; });
    for (const z of A.rows) sign(w, '♨', 4.6, 2.9, z, { w: 1.0, h: 1.0, tw: 128, size: 80, border: null, bg: null });
    w.checkpoint({ x: 0, y: 0, z: -57, real: true });
    stage(w, 'A1', { x: 0, y: 1, z: -29, w: 10, h: 4, d: 3 }, () => { tell('p1', 'coop.l5.vents.p1'); tell('p2', 'coop.l5.vents.p2'); });
    stage(w, 'A1done', { x: 0, y: 1, z: -58, w: 10, h: 4, d: 3 }, () => tell('all', 'coop.l5.ventsdone'));

    // A2 mud bath, then the belt that is faster than you
    mud(w, { x: 0, y: 0, z: -68, w: 10, d: 16, h: 1, path: true });
    sign(w, 'MUD BATH · NO RUNNING', 0, 3.3, -61, { w: 6, h: 0.9, border: '#b98a55', size: 30 });
    const beltA = belt(w, { x: 0, y: 0, z: -82, w: 10, d: 12, h: 1, path: true }, 7);
    let beltStopped = false;
    c.on('A.belt', (v) => { beltStopped = (v | 0) % 2 === 1; beltA.target = beltStopped ? 0 : 7; });
    sign(w, 'BELT SPEED 7 m/s · YOU: 6.6 m/s', 0, 3.6, -75.6, { w: 7, h: 0.9, border: '#ff4d5e', size: 28 });
    deck(w, { x: 0, y: 0, z: -92, w: 10, d: 8, path: true });
    w.checkpoint({ x: 0, y: 0, z: -92, real: true });
    stage(w, 'A2', { x: 0, y: 1, z: -62, w: 10, h: 4, d: 3 }, () => { tell('p1', 'coop.l5.mud.p1'); tell('p2', 'coop.l5.mud.p2'); });
    stage(w, 'A2belt', { x: 0, y: 1, z: -74.5, w: 10, h: 4, d: 3 }, () => tell('all', 'coop.l5.belt'));
    stage(w, 'A2done', { x: 0, y: 1, z: -90, w: 10, h: 4, d: 3 }, () => tell('all', 'coop.l5.beltdone'));

    // A3 the four sauna doors
    deck(w, { x: 0, y: 0, z: -106, w: 10, d: 20, path: true });                          // z -96 … -116
    const doorX = (k) => -3.75 + k * 2.5;
    const doors = [0, 1, 2, 3].map((k) => gate(w, { x: doorX(k), z: A.gateZ, w: 2.4, h: 4.2, d: 0.8, color: 0x8a5a36 }));
    const doorT = [0, 0, 0, 0];
    const alarm = { at: -100 };
    const alarmV = vent(w, { x: 0, z: -100.5, wd: 10, dp: 9, state: (t) => { const d = t - alarm.at; return d < 0 ? 0 : d < 2.5 ? 1 : d < 4.5 ? 2 : 0; } });
    for (let k = 0; k < 4; k++) {
      sign(w, String(k + 1), doorX(k), 3.3, A.gateZ + 0.5, { w: 1.2, h: 1.2, tw: 128, size: 90, border: '#ffc83d' });
      c.on('A.door' + k, () => { if (k === safeDoor) doorT[k] = 12; else alarm.at = w.t; });
    }
    w.updaters.push((dt) => { for (let k = 0; k < 4; k++) { doorT[k] = Math.max(0, doorT[k] - dt); doors[k].set(doorT[k] > 0); } });
    sign(w, `DOOR ${signDoor + 1} IS THE SAFE ONE.   — MANAGEMENT`, 0, 5.6, A.gateZ + 1.2, { w: 8, h: 1.1, size: 30, border: '#ff4d5e' });
    w.checkpoint({ x: 0, y: 0, z: -112, real: true });
    stage(w, 'A3', { x: 0, y: 1, z: -97, w: 10, h: 4, d: 3 }, () => { tell('p1', 'coop.l5.door.p1'); tell('p2', 'coop.l5.door.p2'); w.after(7, () => { tell('p1', 'coop.l5.lie' + (lieDoor + 1)); }); });
    c.onEvent('stage:alarmed', () => {});
    stage(w, 'A3b', { x: 0, y: 1, z: -108, w: 10, h: 4, d: 3 }, () => tell('all', 'coop.l5.doordone'));

    // A4 the cold plunge (the controller starts the pump; four tiles surface one after another)
    pool(w, { x: 0, z: -131.5, wd: 14, dp: 30, y: -1.3, color: 0x3aa6c8 });
    const pumpAt = { t: -100 };
    const tp = () => { const t = w.t - pumpAt.t; return t >= 0 && t < 12 ? t : -1; };
    const tiles = A.tiles.map((z, k) => iceTile(w, { z, start: 1.0 + 1.7 * k, tp }));
    c.on('A.pump', () => { if (tp() < 0) pumpAt.t = w.t; });
    sign(w, 'COLD PLUNGE · THE PUMP IS IN THE GLASS ROOM', 0, 4.4, -116.5, { w: 9, h: 1.0, border: '#66e0ff', size: 28 });
    stage(w, 'A4', { x: 0, y: 1, z: -113, w: 10, h: 4, d: 3 }, () => { tell('p1', 'coop.l5.plunge.p1'); tell('p2', 'coop.l5.plunge.p2'); });
    w.checkpoint({ x: 0, y: 0, z: -151, real: true });

    // A5 the aromatherapy lock: the crosser reads the scent order off the gate, the controller works the diffusers on the north desk
    deck(w, { x: 0, y: 0, z: -157, w: 10, d: 20, path: true });                          // z -147 … -167
    const lockA = aroma(w, { key: 'A.aroma', seq: seqA, z: -160, reveal: true });
    sign(w, 'THE DIFFUSERS ARE IN THE GLASS ROOM. READ THE ORDER OUT LOUD.', 0, 5.6, -152, { w: 9, h: 1.0, border: '#39d7c9', size: 26 });
    stage(w, 'A5', { x: 0, y: 1, z: -150, w: 10, h: 4, d: 3 }, () => { tell('p1', 'coop.l5.aroma.p1'); tell('p2', 'coop.l5.aroma.p2'); });
    stage(w, 'A5done', { x: 0, y: 1, z: -163, w: 10, h: 4, d: 3 }, () => tell('all', 'coop.l5.aromadone'));
    w.checkpoint({ x: 0, y: 0, z: -164, real: true });
    deck(w, { x: 0, y: 0, z: -173.5, w: 28, d: 13, path: true });                        // lounge, first half (z -167 … -180)
    let exitA = false;
    stage(w, 'A.exit', { x: 0, y: 1, z: -164, w: 10, h: 5, d: 2.5 }, () => { exitA = true; });
    w.updaters.push(() => roomA.exit.set(exitA));

    // ================================================================ the lounge: massage chairs + fake finish =========
    sign(w, 'THE LOUNGE · PLEASE REMAIN SEATED', 0, 4.8, -170.2, { w: 10, h: 1.1, border: '#ff8ac0' });
    pool(w, { x: 0, z: -187.5, wd: 28, dp: 15, y: -1.2, color: 0xe58c4a, hot: true });
    const chairs = L.chairs.map((z, k) => {
      const p = w.plat({ x: k === 1 ? 2 : 0, y: 0, z, w: 7, d: 3, h: 0.8, tex: 'wood', color: 0x9a4a5a, trim: 0xff8ac0, path: true });
      w.rollaway(p, { dir: [k === 1 ? -1 : 1, 0], dist: 3.5, accel: 5, speed: 5, delay: 0.9, hold: 2.4, back: 1.6 });
      const back = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x7a3748, roughness: 0.6 }));
      back.position.set(0, 1.0, 1.3); p.group.add(back);
      return p;
    });
    const chairsHome = () => chairs.every((p) => Math.abs(p.body.x - p.base.x) < 0.25);
    sign(w, 'MASSAGE CHAIRS · THEY LEAVE WHEN YOU DO', 0, 3.4, -180.4, { w: 8, h: 0.9, border: '#ff8ac0', size: 28 });
    stage(w, 'chairs', { x: 0, y: 1, z: -178, w: 28, h: 4, d: 3 }, () => tell('all', 'coop.l5.chairs'));
    deck(w, { x: 0, y: 0, z: -203.5, w: 28, d: 17, path: true });                     // z -195 … -212
    // the fake finish
    const fake = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 12, 48), glowMaterial(0x3ddc97, 2));
    fake.position.set(0, 1.9, -198); w.add(fake);
    sign(w, 'FINISH · CERTIFICATE OF RELAXATION', 0, 4.6, -198, { w: 7, h: 1, border: '#3ddc97', size: 28 });
    const fakeZ = c.zone({ x: 0, y: 1.9, z: -198, w: 3, h: 3.4, d: 3, need: 'any', shrink: 0 });
    let fakeDone = false;
    fakeZ.onChange((z) => { if (z.active && !fakeDone) { fakeDone = true; tell('p1', 'coop.l5.fake.p1'); tell('p2', 'coop.l5.fake.p2'); fake.visible = false; } });
    for (const lx of [-12, 12]) lantern(w, lx, 0, -195);

    // ---- wing B control room (west) ----
    stone(w, { x: -15.5, y: 1, z: -204, w: 3, d: 4, h: 1 }); stone(w, { x: -18.5, y: 2, z: -204, w: 3, d: 4, h: 1 });
    const roomB = controlRoom(w, { side: -1, z0: -196, z1: -218, dz0: -201.5, dz1: -206.5, exitZ: -213, title: 'CONTROL ROOM · WING B' });
    deck(w, { x: -38.5, y: 3, z: -304.5, w: 4, d: 191, h: 1, color: 0xd8c4a0 });          // z -209 … -400
    rail(w, { x: -40.6, y: 3, z: -304.5, len: 191 }); rail(w, { x: -36.45, y: 3, z: -303.5, len: 175 }); rail(w, { x: -38.5, y: 3, z: -208.8, len: 4.4, axis: 'x' });
    stone(w, { x: -34.5, y: 2, z: -396, w: 4, d: 8, h: 1 }); stone(w, { x: -23, y: 1, z: -396, w: 18, d: 8, h: 1 });
    for (const lz of [-235, -265, -295, -325, -355, -385]) lantern(w, -40, 3, lz);

    // ================================================================ WING B =====================================
    // B0 entry deck + gate
    deck(w, { x: 0, y: 0, z: -217, w: 10, d: 10, path: true });                          // z -212 … -222
    const gateB = gate(w, { x: 0, z: B.gateZ, w: 10, h: 4.5 });
    const readyB = c.zone({ x: -28, y: 4.8, z: -207, w: 15, h: 3, d: 20, need: 'p1', shrink: 0 });
    let bOpen = false;
    w.updaters.push(() => { if (readyB.p1) bOpen = true; gateB.set(bOpen); });
    sign(w, 'WING B · SWAP · THE MIST', 0, 5.4, -215.5, { w: 8, h: 1, border: '#39d7c9' });
    sign(w, 'GATE OPENS WHEN YOUR PARTNER IS AT THE CONSOLE', 0, 4.2, -212.4, { w: 8, h: 0.8, size: 26 });
    stage(w, 'B0', { x: 0, y: 1, z: -210, w: 14, h: 4, d: 3 }, () => { tell('p2', 'coop.l5.wingB.p2'); tell('p1', 'coop.l5.wingB.p1'); });
    w.checkpoint({ x: 0, y: 0, z: -219, real: true });

    // B1 mist tiles: only the console knows which tiles are real
    pool(w, { x: 0, z: -234, wd: 12, dp: 25, y: -2.4, color: 0xe58c4a, hot: true });
    const colX = (cc) => (cc - 1) * 3.4, rowZ = (i) => B.rowZ0 - i * B.rowStep;
    const mistCells = [];
    for (let i = 0; i < B.rows; i++) {
      for (let cc = 0; cc < 3; cc++) {
        const real = path[i] === cc;
        if (real) w.plat({ x: colX(cc), y: 0, z: rowZ(i), w: 3.3, d: B.rowStep, h: 0.8, tex: 'metal', color: 0xd6e6ee, path: true });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(3.38, B.rowStep - 0.08), new THREE.MeshBasicMaterial({ color: 0xf2f6fa, transparent: true, opacity: 0.93, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.set(colX(cc), 0.12, rowZ(i)); w.add(m); mistCells.push([m, i, cc]);
      }
    }
    w.updaters.push((dt, t) => { for (const [m, i, cc] of mistCells) m.material.opacity = 0.9 + Math.sin(t * 0.8 + i * 1.7 + cc * 2.3) * 0.04; });
    sign(w, 'THE MIST IS DECORATIVE. WALK STRAIGHT.   — MANAGEMENT', 0, 4.4, -222.2, { w: 9, h: 1.1, size: 28, border: '#ff4d5e' });
    stage(w, 'B1', { x: 0, y: 1, z: -221, w: 10, h: 4, d: 2 }, () => { tell('p2', 'coop.l5.mist.p2'); tell('p1', 'coop.l5.mist.p1'); });
    deck(w, { x: 0, y: 0, z: -249, w: 10, d: 6.2, path: true });
    w.checkpoint({ x: 0, y: 0, z: -249, real: true });
    stage(w, 'B1done', { x: 0, y: 1, z: -248, w: 10, h: 4, d: 3 }, () => tell('all', 'coop.l5.mistdone'));

    // B2 the slippery hall and the colour-coded sliding gates
    const slip = w.plat({ x: 0, y: 0, z: -272, w: 4, d: 40, h: 1, tex: 'metal', color: 0x9fd0e0, slippery: true, path: true });
    rail(w, { x: -2.1, y: 0, z: -272, len: 40, h: 1.2 }); rail(w, { x: 2.1, y: 0, z: -272, len: 40, h: 1.2 });
    const gatesB = B.gates.map((z, g) => {
      const col = GATE_COLORS[perm[g]];
      const gt = gate(w, { x: 0, z, w: 4, h: 4.4, d: 0.8, color: col.hex, tex: 'metal', glow: col.hex });
      sign(w, `GATE ${g + 1} · ${col.name}`, 0, 5.8, z + 0.6, { w: 4, h: 0.9, size: 34, border: '#' + col.hex.toString(16).padStart(6, '0') });
      return gt;
    });
    const gateT = [0, 0, 0];
    for (let ci = 0; ci < 3; ci++) c.on('B.gate' + ci, () => { const g = perm.indexOf(ci); gateT[g] = 10; });
    w.updaters.push((dt) => { for (let g = 0; g < 3; g++) { gateT[g] = Math.max(0, gateT[g] - dt); gatesB[g].set(gateT[g] > 0); } });
    deck(w, { x: 0, y: 0, z: -308, w: 10, d: 32, path: true });                          // z -292 … -324
    w.checkpoint({ x: 0, y: 0, z: -296, real: true });
    // B4 the second aromatherapy lock, roles reversed: the controller reads the scent order on the console, the crosser works the diffusers
    const lockB = aroma(w, { key: 'B.aroma', seq: seqB, z: -320, reveal: false });
    const diffRoom = { bx: (i) => -3 + i * 2, bz: -314.2, floorY: 0, standZ: -312.5, dir: 1 };
    w.box({ x: 0, y: 0.5, z: -314.25, w: 8.6, h: 1.0, d: 1.1, color: 0x2b2f3a, rough: 0.5 }); w.box({ x: 0, y: 1.04, z: -314.25, w: 8.6, h: 0.08, d: 1.2, color: 0x4a5160, rough: 0.4 });
    SCENTS.forEach((sc, k) => consoleButton(w, diffRoom, k, { label: sc.sym, color: sc.hex, onPress: () => lockB.press(k), lit: () => lockB.pos > 0 && lockB.seq[lockB.pos - 1] === k, enabled: me === 'p2', size: 60 }));
    sign(w, 'DIFFUSERS · YOUR PARTNER HAS THE ORDER', 0, 3.9, -314.2, { w: 7, h: 0.9, border: '#39d7c9', size: 28 });
    stage(w, 'B4', { x: 0, y: 1, z: -302, w: 10, h: 4, d: 3 }, () => { tell('p2', 'coop.l5.aroma2.p2'); tell('p1', 'coop.l5.aroma2.p1'); });
    stage(w, 'B4done', { x: 0, y: 1, z: -323, w: 10, h: 4, d: 3 }, () => tell('all', 'coop.l5.aromadone2'));
    stage(w, 'B2', { x: 0, y: 1, z: -253.5, w: 5, h: 4, d: 3 }, () => { tell('p2', 'coop.l5.gates.p2'); tell('p1', 'coop.l5.gates.p1'); });
    stage(w, 'B2done', { x: 0, y: 1, z: -290, w: 10, h: 4, d: 3 }, () => tell('all', 'coop.l5.gatesdone'));

    // B3 the second steam hall, then pool tiles that sink
    deck(w, { x: 0, y: 0, z: -339.5, w: 10, d: 31, path: true });                          // z -300 … -355
    const ventEndB = [-1, -1, -1];
    const ventsB = B.vents.map((z, k) => vent(w, { z, stuck: k === stuckB, offset: k * 1.3 + 0.6, period: 4.2, venting: (t) => Math.max(0, ventEndB[k] - t) }));
    for (let k = 0; k < 3; k++) c.on('B.v' + k, () => { ventEndB[k] = w.t + 7.5; });
    stage(w, 'B3', { x: 0, y: 1, z: -325.5, w: 10, h: 4, d: 3 }, () => { tell('p2', 'coop.l5.vents2.p2'); tell('p1', 'coop.l5.vents2.p1'); });
    pool(w, { x: 0, z: -374, wd: 14, dp: 42, y: -1.3, color: 0xe58c4a, hot: true });
    const sink = chain(w, { x: 0, y: 0, z: -355 }, [{ gap: 2.8, d: 4, w: 5 }, { gap: 2.8, d: 4, w: 5 }, { gap: 2.8, d: 4, w: 5 }, { gap: 2.8, d: 4, w: 5 }, { gap: 2.8, d: 4, w: 5 }]);
    sink.slice(1).forEach((p, i) => w.crumble(p, { delay: 0.9, gone: 3.2 + (i % 2) }));
    w.checkpoint({ x: 0, y: sink[0].top, z: sink[0].body.z, real: true });
    stage(w, 'B3sink', { x: 0, y: 1, z: -356, w: 10, h: 4, d: 2 }, () => tell('all', 'coop.l5.sinks'));
    let exitB = false;
    stage(w, 'B.exit', { x: 0, y: 1, z: -353, w: 10, h: 5, d: 2.5 }, () => { exitB = true; tell('p1', 'coop.l5.leave.p1'); tell('p2', 'coop.l5.leave.p2'); });
    w.updaters.push(() => roomB.exit.set(exitB));

    // the plaza and the real finish
    deck(w, { x: 0, y: 0, z: -402.5, w: 28, d: 21, path: true });                          // z -392 … -413
    w.goal({ x: 0, y: 0, z: B.goalZ });
    sign(w, 'BOTH OF YOU. IN THE CIRCLE. THE ONE IN THE GLASS ROOM TOO.', 0, 5.4, B.goalZ - 4, { w: 11, h: 1.6, size: 30 });
    beacon(w, 0, 0, B.goalZ, 0xffe9a8, 20);
    for (const lx of [-6, 6]) lantern(w, lx, 0, B.goalZ + 3);
    stage(w, 'plaza', { x: 0, y: 1, z: -395, w: 28, h: 4, d: 4 }, () => tell('all', 'coop.l5.circle'));
    w.hooks.onPartnerDeath = () => { tell('all', 'coop.l5.partnerdown'); return true; };

    // ================================================================ consoles ======================================
    const hexs = (n) => '#' + n.toString(16).padStart(6, '0');
    const font = (g, px, wt = 600) => { g.font = `${wt} ${px}px Inter, system-ui, sans-serif`; };
    const vcol = (s) => (s === 2 ? '#ff4d5e' : s === 1 ? '#ffb02e' : '#3b4a58');
    const dot = (g, x, y, r, col, label) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); if (label) { g.fillStyle = '#fff'; font(g, 22, 700); g.textAlign = 'center'; g.fillText(label, x, y - r - 8); } };
    const header = (g, cw, title, sub) => { g.fillStyle = '#2dd4bf'; font(g, 40, 800); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(title, 40, 52); g.fillStyle = '#7f93a6'; font(g, 24, 500); g.textAlign = 'right'; g.fillText(sub, cw - 40, 50); };
    const crosserDot = (g, X, Y, role) => { if (P.has && !P.dead) dot(g, X(P.sz), Y(P.sx), 11, hexs(COL[role]), N[role]); };

    // ---- console A ----
    const scentRow = (g, seq, x0, y0, cell, pos, reveal) => {
      g.textAlign = 'center';
      seq.forEach((sy, i) => {
        const cx = x0 + i * (cell + 8) + cell / 2;
        g.fillStyle = i < pos ? 'rgba(61,220,151,0.3)' : 'rgba(255,255,255,0.07)'; g.fillRect(cx - cell / 2, y0, cell, cell);
        if (reveal) { g.fillStyle = SCENTS[sy].css; font(g, cell * 0.7, 800); g.fillText(SCENTS[sy].sym, cx, y0 + cell * 0.74); }
        else { g.fillStyle = i < pos ? '#3ddc97' : '#40505a'; font(g, cell * 0.55, 800); g.fillText(i < pos ? '✔' : '?', cx, y0 + cell * 0.7); }
      });
    };
    liveScreen(w, roomA, ctlA, (g, cw, ch) => {
      const t = w.t, s = 1712 / 156, X = (z) => 40 + (-24 - z) * s, Y = (x) => 96 + (x + 5.5) * s;
      header(g, cw, 'SERENITY FALLS · SPA CONTROL · WING A', `${N.p1} is crossing. They cannot see this screen.`);
      const rect = (z0, z1, col, x0 = -5, x1 = 5) => { g.fillStyle = col; g.fillRect(X(z0), Y(x0), X(z1) - X(z0), Y(x1) - Y(x0)); };
      rect(-24, -60, '#1f3a46'); rect(-60, -76, '#5a3d28'); rect(-76, -88, '#3a3d4a'); rect(-88, -96, '#1f3a46'); rect(-96, -116, '#2a3340'); rect(-116, -147, '#12384a'); rect(-147, -167, '#1f3a46'); rect(-167, -180, '#3a2a3a', -5, 5);
      // belt chevrons
      g.fillStyle = beltStopped ? '#ff4d5e' : '#e9b83f'; font(g, 26, 800); g.textAlign = 'center';
      for (let z = -78; z > -88; z -= 3.2) g.fillText(beltStopped ? '■' : '◀', X(z), Y(0.9));
      // steam rows
      ventsA.forEach((v, k) => { const z = A.rows[k]; g.fillStyle = vcol(v.s); g.fillRect(X(z + 0.8), Y(-5), X(z - 0.8) - X(z + 0.8), Y(5) - Y(-5)); g.fillStyle = '#fff'; font(g, 20, 700); g.fillText('V' + (k + 1), X(z), Y(-5) - 6); });
      // doors
      for (let k = 0; k < 4; k++) { const x0 = -5 + k * 2.5; g.fillStyle = doorT[k] > 0 ? '#7ad7a0' : '#6b4a2e'; g.fillRect(X(-105.6), Y(x0 + 0.1), X(-106.6) - X(-105.6), Y(x0 + 2.4) - Y(x0 + 0.1)); g.fillStyle = k === safeDoor ? '#3ddc97' : '#8aa0b4'; font(g, 22, 800); g.fillText(String(k + 1), X(-103.2), Y(x0 + 1.25) + 8); }
      g.strokeStyle = '#3ddc97'; g.lineWidth = 4; g.strokeRect(X(-100), Y(-5 + safeDoor * 2.5 + 0.05), X(-110) - X(-100), Y(2.4) - Y(0));
      g.fillStyle = '#3ddc97'; font(g, 22, 800); g.fillText('SAFE', X(-113), Y(-5 + safeDoor * 2.5 + 1.25) + 8);
      if (alarmV.s > 0) { g.fillStyle = alarmV.s === 2 ? 'rgba(255,77,94,0.55)' : 'rgba(255,176,46,0.4)'; g.fillRect(X(-96), Y(-5), X(-105) - X(-96), Y(5) - Y(-5)); }
      // plunge tiles + the scent lock
      tiles.forEach((tl, k) => { g.fillStyle = tl.level > 0.8 ? '#8be8ff' : `rgba(140,230,255,${0.12 + tl.level * 0.5})`; g.fillRect(X(A.tiles[k] + 1.7), Y(-3), X(A.tiles[k] - 1.7) - X(A.tiles[k] + 1.7), Y(3) - Y(-3)); });
      g.fillStyle = lockA.openT > 0 ? '#7ad7a0' : '#8a5a36'; g.fillRect(X(-159.6), Y(-5), X(-160.4) - X(-159.6), Y(5) - Y(-5));
      crosserDot(g, X, Y, 'p1');
      // status
      const row = 262;
      g.textAlign = 'left'; g.fillStyle = '#e8eef4'; font(g, 30, 700); g.fillText('SOUTH DESK, LEFT TO RIGHT', 40, row);
      g.fillStyle = '#9fb0c0'; font(g, 25, 500);
      g.fillText('1-3 STEAM VALVES (vent that row for 7 s)   4 BELT (stop / start)   5-8 SAUNA DOORS 1-4   9 COLD PLUNGE PUMP', 40, row + 36);
      g.fillStyle = '#e8eef4'; font(g, 28, 600);
      g.fillText(ventsA.map((v, k) => `V${k + 1} ${v.s === 2 ? 'SCALDING' : v.s === 1 ? 'hissing' : 'off'}`).join('    '), 40, row + 86);
      g.fillText(`BELT: ${beltStopped ? 'STOPPED' : 'RUNNING 7 m/s'}        PUMP: ${tp() < 0 ? 'READY' : 'RUNNING ' + tp().toFixed(1) + ' s'}`, 40, row + 128);
      g.fillStyle = '#ffb02e'; font(g, 26, 500);
      g.fillText('The sign in the hall is not on the system. Neither is the counsellor.', 40, row + 176);
      g.fillStyle = '#9fb0c0'; g.fillText('A wrong sauna door floods the hall with steam. Your partner will be standing in it.', 40, row + 212);
      // the scent lock, on the right
      const lx = 1120;
      g.fillStyle = '#e8eef4'; font(g, 30, 700); g.textAlign = 'left'; g.fillText('NORTH DESK · SCENT DIFFUSERS', lx, row);
      g.fillStyle = '#9fb0c0'; font(g, 24, 500); g.fillText('Your partner reads the order off the gate. You press.', lx, row + 36);
      scentRow(g, seqA, lx, row + 70, 88, lockA.pos, false);
      g.textAlign = 'left'; g.fillStyle = lockA.bad > 0 ? '#ff4d5e' : lockA.openT > 0 ? '#3ddc97' : '#9fb0c0'; font(g, 26, 600);
      g.fillText(lockA.openT > 0 ? 'LOCK OPEN' : lockA.bad > 0 ? 'WRONG SCENT · START OVER' : `PROGRESS ${lockA.pos} / ${seqA.length}`, lx, row + 190);
      SCENTS.forEach((sc, k) => { g.fillStyle = sc.css; font(g, 36, 800); g.fillText(sc.sym, lx + k * 120, row + 240); g.fillStyle = '#9fb0c0'; font(g, 22, 500); g.fillText(sc.name, lx + k * 120 + 40, row + 238); });
    });
    // ---- console B ----
    liveScreen(w, roomB, ctlB, (g, cw, ch) => {
      const t = w.t, s = 1712 / 178, X = (z) => 40 + (-212 - z) * s, Y = (x) => 96 + (x + 5.5) * s;
      header(g, cw, 'SERENITY FALLS · SPA CONTROL · WING B', `${N.p2} is crossing. They cannot see this screen.`);
      const rect = (z0, z1, col, x0 = -5, x1 = 5) => { g.fillStyle = col; g.fillRect(X(z0), Y(x0), X(z1) - X(z0), Y(x1) - Y(x0)); };
      rect(-212, -222, '#1f3a46'); rect(-222, -246, '#cfd8e0'); rect(-246, -252, '#1f3a46'); rect(-252, -292, '#2a4a60', -2, 2); rect(-292, -355, '#1f3a46'); rect(-355, -390, '#4a2a20', -2.5, 2.5);
      for (let i = 0; i < B.rows; i++) { g.fillStyle = '#2bbf84'; g.fillRect(X(rowZ(i) + 1.7), Y(colX(path[i]) - 1.65), X(rowZ(i) - 1.7) - X(rowZ(i) + 1.7) - 1, Y(1.65) - Y(0)); }
      B.gates.forEach((z, g2) => { g.fillStyle = gateT[g2] > 0 ? '#7ad7a0' : '#8a5a36'; g.fillRect(X(z + 0.4), Y(-2), X(z - 0.4) - X(z + 0.4), Y(2) - Y(-2)); g.fillStyle = '#fff'; font(g, 20, 800); g.textAlign = 'center'; g.fillText('G' + (g2 + 1), X(z), Y(-2) - 6); });
      g.fillStyle = lockB.openT > 0 ? '#7ad7a0' : '#8a5a36'; g.fillRect(X(-319.6), Y(-5), X(-320.4) - X(-319.6), Y(5) - Y(-5));
      ventsB.forEach((v, k) => { const z = B.vents[k]; g.fillStyle = vcol(v.s); g.fillRect(X(z + 0.8), Y(-5), X(z - 0.8) - X(z + 0.8), Y(5) - Y(-5)); g.fillStyle = '#fff'; font(g, 20, 700); g.textAlign = 'center'; g.fillText('V' + (k + 1), X(z), Y(-5) - 6); });
      sink.forEach((p) => { g.fillStyle = p.body.enabled ? '#9fb0c0' : '#3a2a28'; g.fillRect(X(p.body.z + 2), Y(-2.5), X(p.body.z - 2) - X(p.body.z + 2) - 2, Y(2.5) - Y(-2.5)); });
      crosserDot(g, X, Y, 'p2');
      // the mist grid, big: green = real tile
      const gx = 40, gy = 262, cs = 64;
      g.textAlign = 'left'; g.fillStyle = '#e8eef4'; font(g, 28, 700); g.fillText('MIST FIELD · green = a real tile, dark = nothing (they fall)', gx, gy - 12);
      let cr = -1, cc2 = -1;
      if (P.has && P.sz < B.rowZ0 + 1.7 && P.sz > B.mistEnd) { cr = Math.max(0, Math.min(B.rows - 1, Math.floor((B.rowZ0 + 1.7 - P.sz) / B.rowStep))); cc2 = Math.max(0, Math.min(2, Math.round(P.sx / 3.4 + 1))); }
      for (let i = 0; i < B.rows; i++) for (let cc = 0; cc < 3; cc++) {
        const real = path[i] === cc;
        g.fillStyle = real ? '#2bbf84' : '#2a1d22'; g.fillRect(gx + i * (cs + 6), gy + cc * (cs + 6), cs, cs);
        if (i === cr && cc === cc2) { g.strokeStyle = hexs(COL.p2); g.lineWidth = 6; g.strokeRect(gx + i * (cs + 6) + 3, gy + cc * (cs + 6) + 3, cs - 6, cs - 6); }
      }
      g.fillStyle = '#9fb0c0'; font(g, 23, 500); g.fillText('← they enter here (row 1). LEFT / RIGHT = THEIR left / right, walking away from the gate.', gx, gy + 3 * (cs + 6) + 30);
      // lever legend + status
      const lx = 560;
      g.fillStyle = '#e8eef4'; font(g, 28, 700); g.fillText('DESK, LEFT TO RIGHT', lx, gy - 12);
      g.fillStyle = '#9fb0c0'; font(g, 24, 500);
      g.fillText('1-3 STEAM VALVES (7 s)   4-6 SLIDING GATES BY COLOUR (10 s)', lx, gy + 24);
      GATE_COLORS.forEach((gc, k) => { g.fillStyle = hexs(gc.hex); g.fillRect(lx + k * 200, gy + 44, 32, 32); g.fillStyle = '#e8eef4'; font(g, 24, 700); g.fillText(gc.name, lx + k * 200 + 42, gy + 70); });
      g.fillStyle = '#e8eef4'; font(g, 27, 600);
      g.fillText(ventsB.map((v, k) => `V${k + 1} ${v.s === 2 ? 'SCALDING' : v.s === 1 ? 'hissing' : 'off'}`).join('   '), lx, gy + 118);
      g.fillText(gatesB.map((_, k) => `G${k + 1} ${gateT[k] > 0 ? 'OPEN' : 'shut'}`).join('   '), lx, gy + 156);
      g.fillStyle = '#ffb02e'; font(g, 24, 500); g.fillText('The gates are numbered. Your levers are coloured. Your partner can see both.', lx, gy + 196);
      // the scent lock: you hold the order, they hold the diffusers
      const sx = 1180;
      g.fillStyle = '#e8eef4'; font(g, 28, 700); g.textAlign = 'left'; g.fillText('SCENT LOCK · THE ORDER', sx, gy - 12);
      g.fillStyle = '#9fb0c0'; font(g, 23, 500); g.fillText('Read it out. They press, in this order.', sx, gy + 22);
      scentRow(g, seqB, sx, gy + 44, 76, lockB.pos, true);
      g.textAlign = 'left'; g.fillStyle = lockB.bad > 0 ? '#ff4d5e' : lockB.openT > 0 ? '#3ddc97' : '#9fb0c0'; font(g, 26, 600);
      g.fillText(lockB.openT > 0 ? 'LOCK OPEN' : lockB.bad > 0 ? 'WRONG SCENT · START OVER' : `PROGRESS ${lockB.pos} / ${seqB.length}`, sx, gy + 168);
    });

    // ---- console buttons ----
    const ventLabel = (k) => 'VALVE ' + (k + 1);
    for (let k = 0; k < 3; k++) consoleButton(w, roomA, k, { label: ventLabel(k), color: 0xff8a5c, onPress: () => pulse('A.v' + k), lit: () => ventEndA[k] > w.t, enabled: ctlA });
    consoleButton(w, roomA, 3, { label: 'BELT', color: 0xe9b83f, onPress: () => pulse('A.belt'), lit: () => beltStopped, enabled: ctlA });
    for (let k = 0; k < 4; k++) consoleButton(w, roomA, 4 + k, { label: 'DOOR ' + (k + 1), color: 0xb98a55, onPress: () => pulse('A.door' + k), lit: () => doorT[k] > 0, enabled: ctlA });
    consoleButton(w, roomA, 8, { label: 'PUMP', color: 0x66e0ff, onPress: () => pulse('A.pump'), lit: () => tp() >= 0, enabled: ctlA });
    SCENTS.forEach((sc, k) => consoleButton(w, roomA.north, 4 + k, { label: sc.sym, color: sc.hex, onPress: () => lockA.press(k), lit: () => lockA.pos > 0 && lockA.seq[lockA.pos - 1] === k, enabled: ctlA, size: 60 }));
    sign(w, 'SCENT DIFFUSERS', roomA.xc, 3 + 3.2, roomA.z0 - 0.5, { w: 5, h: 0.8, size: 34, border: '#39d7c9' });
    for (let k = 0; k < 3; k++) consoleButton(w, roomB, k, { label: ventLabel(k), color: 0xff8a5c, onPress: () => pulse('B.v' + k), lit: () => ventEndB[k] > w.t, enabled: ctlB });
    for (let k = 0; k < 3; k++) consoleButton(w, roomB, 3 + k, { label: GATE_COLORS[k].name, color: GATE_COLORS[k].hex, onPress: () => pulse('B.gate' + k), lit: () => gateT[perm.indexOf(k)] > 0, enabled: ctlB });
    stage(w, 'roomA', { x: 28, y: 4.8, z: -19, w: 15, h: 3, d: 20 }, () => { tell('p2', 'coop.l5.room.p2'); });
    stage(w, 'roomB', { x: -28, y: 4.8, z: -207, w: 15, h: 3, d: 20 }, () => { tell('p1', 'coop.l5.room.p1'); });

    // ================================================================ bots ========================================
    const D = game.player;
    const steps = { p1: [], p2: [] };
    const add = (role, ...s) => steps[role].push(...s);
    const mark = {};
    const at = (role, name) => { mark[role + '.' + name] = steps[role].length; };
    // go to console button i of a room (approach from the north so the crosshair is on it), then keep pressing it while `need()`, until `done()`
    const press = (role, room, i, need, done) => {
      const bxi = room.bx(i), z = room.standZ, d = room.dir || 1;
      // the second leg aims through the desk at the wall, so the player ends up facing the button
      add(role, { x: bxi, z: z + 2.2 * d, r: 0.6 }, { x: bxi, z: room.bz - 5 * d, r: 0.1, until: () => { if (done()) return true; const off = (D.z - room.bz) * d; if (Math.abs(D.x - bxi) < 0.5 && off < 1.9 && off > -1.2 && need()) game.useFocus(); return false; } });
    };
    const inZ = (hi, lo) => P.has && P.sz < hi && P.sz > lo;
    const rem = (end) => end - w.t;
    // ---- wing A: p1 crosses, p2 controls ----
    at('p1', 'A');
    add('p1',
      { x: 0, z: -22, r: 1.5 }, { x: 0, z: -23.2, r: 0.8, until: () => gateA.passable },
      { x: 0, z: A.rows[0] + 4, r: 1.0 }, { x: 0, z: -57, r: 1.5 },
      { x: 0, z: -73, r: 1.5 }, { x: 0, z: -74.5, until: () => beltStopped },
      { x: 0, z: -92, r: 1.5 },
      { x: doorX(safeDoor), z: -100, r: 0.8 },
      { x: doorX(safeDoor), z: -104, until: () => doors[safeDoor].passable },
      { x: doorX(safeDoor), z: -112, r: 1.2 },
      { x: 0, z: -109, r: 0.8, until: () => tiles[0].solid },
    );
    for (let k = 0; k < 4; k++) {
      add('p1', { x: 0, z: A.tiles[k], r: 1.0 });
      if (k < 3) add('p1', { x: 0, z: A.tiles[k] + 1.2, r: 0.4, until: () => tiles[k + 1].solid });
    }
    add('p1', { x: 0, z: -156, r: 1.5 }, { x: 0, z: -158.2, r: 0.8, until: () => lockA.gate.passable }, { x: 0, z: -172, r: 1.5 });
    at('p1', 'chairs');
    add('p1', { x: 1, z: -177.5, r: 0.5, until: chairsHome }, { x: 1, z: -179.2, r: 0.5 }, { x: 1, z: -199, r: 1.5 });
    at('p1', 'toB');
    add('p1', { x: 0, z: -198, r: 1.2 },
      { x: -10, z: -204, r: 1.5 }, { x: -15.5, z: -204, r: 0.8 }, { x: -18.5, z: -204, r: 0.8 }, { x: -24, z: -204, r: 1.0 });
    // ---- wing B: p1 controls ----
    at('p1', 'B');
    for (let g = 0; g < 3; g++) {
      press('p1', roomB, 3 + perm[g], () => inZ(B.gates[g] + 12, B.gates[g] - 3) && gateT[g] < 1.5, () => P.has && P.sz < B.gates[g] - 3);
    }
    press('p1', roomB, stuckB, () => inZ(B.vents[stuckB] + 9, B.vents[stuckB] - 1) && rem(ventEndB[stuckB]) < 1.2, () => P.has && P.sz < B.vents[stuckB] - 2);
    add('p1',
      { x: roomB.bx(stuckB), z: roomB.standZ, r: 0.5, until: () => exitB },
      { x: -34, z: -212, r: 1.0 }, { x: -34, z: -213, r: 0.8, until: () => roomB.exit.passable }, { x: -38.5, z: -213, r: 1.0 }, { x: -38.5, z: -391, r: 1.5 },
      { x: -34.5, z: -396, r: 1.0 }, { x: -22, z: -396, r: 1.5 }, { x: 0, z: B.goalZ, r: 1.0 });
    // ---- wing A controller (p2) ----
    at('p2', 'A');
    add('p2', { x: 10, z: -16, r: 1.5 }, { x: 15.5, z: -16, r: 0.8 }, { x: 18.5, z: -16, r: 0.8 }, { x: 24, z: -16, r: 1.2 });
    press('p2', roomA, stuckA, () => inZ(A.rows[stuckA] + 9, A.rows[stuckA] - 1) && rem(ventEndA[stuckA]) < 1.2, () => P.has && P.sz < A.rows[stuckA] - 2);
    press('p2', roomA, 3, () => inZ(-62, -90) && !beltStopped, () => beltStopped);
    press('p2', roomA, 4 + safeDoor, () => inZ(-90, -108) && doorT[safeDoor] < 1.5, () => P.has && P.sz < -108);
    press('p2', roomA, 8, () => inZ(-108, -119) && tp() < 0, () => P.has && P.sz < -146);
    seqA.forEach((sy, i) => press('p2', roomA.north, 4 + sy, () => inZ(-147, -160) && lockA.pos === i && lockA.openT <= 0, () => lockA.pos > i || lockA.openT > 0));
    add('p2', { x: roomA.bx(4), z: roomA.north.standZ, r: 0.6, until: () => exitA });
    add('p2',
      { x: 34, z: -22, r: 1.0 }, { x: 34, z: -25, r: 0.8, until: () => roomA.exit.passable }, { x: 38.5, z: -25, r: 1.0 }, { x: 38.5, z: -170, r: 1.5 },
      { x: 34.5, z: -172, r: 1.0 }, { x: 23, z: -172, r: 1.5 }, { x: 8, z: -173, r: 1.5 },
      { x: 1, z: -177.5, r: 0.5, until: chairsHome }, { x: 1, z: -179.2, r: 0.5 }, { x: 1, z: -199, r: 1.5 });
    at('p2', 'B');
    add('p2',
      { x: 0, z: -210, r: 1.5 }, { x: 0, z: -212.8, r: 0.8, until: () => gateB.passable },
      { x: 0, z: -220, r: 1.0 });
    for (let i = 0; i < B.rows; i++) add('p2', { x: colX(path[i]), z: rowZ(i), r: 0.55 });
    add('p2', { x: 0, z: -249, r: 1.5 });
    for (let g = 0; g < 3; g++) add('p2',
      { x: 0, z: B.gates[g] + 3.5, r: 0.8, until: () => gatesB[g].passable },
      { x: 0, z: B.gates[g] - 3, r: 1.0 });
    add('p2', { x: 0, z: -297, r: 1.5 });
    seqB.forEach((sy, i) => press('p2', diffRoom, sy, () => lockB.pos === i && lockB.openT <= 0, () => lockB.pos > i || lockB.openT > 0));
    add('p2', { x: 0, z: -316.5, r: 0.8, until: () => lockB.gate.passable }, { x: 0, z: -329, r: 1.5 }, { x: 0, z: -353, r: 1.5 }, { follow: true });
    w.dbg = { stuckA, stuckB, safeDoor, path, perm, ventsB, ventEndB };
    botSteps(w, steps);
    w.botMarks = mark;
  },
};
