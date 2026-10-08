import * as THREE from 'three';
import { plainMaterial, glowMaterial, surfaceMaterial } from '../../engine/materials.js';
import { hotelEnv, hotelHalo, GOLD } from './kit.js';
import { luggageCart } from './props.js';
import { openKeypad } from '../../engine/keypad.js';
import { trollCheckpoint, fakeExit, loadingScreen } from './trolls.js';
import { shuffle, rint, roomBox, wallZ, wallX, slideDoor, doorFrame, keypadBox, escapeStages, canvasPlane, readModal } from './escape-kit.js';

// Hotel level 3 — "Lost Luggage" (Easy · Mezzanine). An escape room in five stages, one checkpoint each:
//   1 Baggage Office   count the suitcases by colour (the poster gives the order; the host's 1337 is a lie; one case is a mimic —
//                      it breathes and its tongue shows). The keypad says ACCESS GRANTED* the first time. The asterisk means "just kidding".
//   2 The Belts        the handling hall over a pit: a belt against you (with a suitcase riding it), an expiring checkpoint, the press,
//                      a sideways transfer belt, and a belt that reverses (its beacons blink first)
//   3 Weigh-In         carry three cases to the scale; the release code is their tag numbers, heaviest first (the big one is empty)
//   4 Lost Property    an X-ray arch that "loads", Carousel 13: find your bag (purple, rubber duck), read the claim number on its
//                      BACK (the host swears it is on the tag), claim it at the desk
//   5 The Pile         climb the mountain of unclaimed luggage (an overhead pallet to ride, a cardboard box that gives) to customs
//                      on the mezzanine: NOTHING TO DECLARE is a closet (you are holding a suitcase)
// Baby Mode: the keypad tells the truth, the reversing belt warns longer and pushes softer, the mimic growls, the expiring checkpoint
// keeps, the X-ray is quicker, the decoy door is labelled.

const COLORS = [
  { name: 'red', hex: 0xc2332a, css: '#e0463c' },
  { name: 'blue', hex: 0x2a62c8, css: '#3b7be8' },
  { name: 'yellow', hex: 0xe6bb2c, css: '#f2c93a' },
  { name: 'green', hex: 0x2f9e5b, css: '#3cc274' },
];
const NAMES = ['Baggage Office', 'The Belts', 'Weigh-In', 'Lost Property', 'The Pile'];
const STONE = { tex: 'stone', color: 0xd8cdb4, roughness: 0.7 };
const STEEL = { tex: 'metal', color: 0x6a7486, roughness: 0.5, metalness: 0.5 };
const WOODWALL = { tex: 'panel', color: 0x8a6a4a };

// z planes of the walls between the rooms (north is -z); each wall is 0.8 thick, centred on these
const WA = -8.4, WB = -72.4, WC = -82.4, WD = -112.4, WE = -125.4;
const BAY_Z0 = -55.2;                          // the weigh-in bay's south edge (the pit ends here)
const UP = 7.4;                                // the customs mezzanine's floor height
const CAR = { x: 0, z: -96, L: 8, R: 3.2 };    // Carousel 13: a stadium, straights along z
const BELT_C = { x: -11.1, z0: -47.0, z1: BAY_Z0, v: -3.0 };

export default {
  id: 'hotel-3',
  name: 'Lost Luggage',
  music: 'hotel',
  completeQuip: 'Bag claimed, customs cleared, dignity declared. Lost luggage: found. Lost guest: also found. Unfortunately.',

  build(w, game) {
    hotelEnv(w);
    w.spawn = { x: 0, y: 0, z: 11, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -8;
    const baby = () => game.baby;
    const near = (x, z, r) => Math.hypot(game.player.x - x, game.player.z - z) < r;

    // =====================================================================================================
    //  The building (floors and walls overlap into each other rather than meet flush: no shimmering seams)
    // =====================================================================================================
    // the office
    w.plat({ x: 0, y: 0, z: 2.8, w: 26, d: 22.8, h: 2, tex: 'tile', color: 0xb9c0c8, roughness: 0.45 });
    roomBox(w, { x0: -13, x1: 13, z0: -8, z1: 14, H: 7, ceil: { tex: 'coffer', color: 0xe8e2d4 }, walls: { s: true, w: true, e: true }, wallMat: STONE });
    wallZ(w, { z: WA, x0: -13.8, x1: 13.8, y0: -10, y1: 9, gaps: [{ c: 0, w: 4, h: 4.4 }], mat: STONE });
    for (const s of [-1, 1]) {   // a blue-grey dado band and a brass rail (both stand clear of the wall face)
      w.box({ x: s * 12.92, y: 0.65, z: 3, w: 0.06, h: 1.3, d: 21.8, tex: 'panel', color: 0x7f93a8, shadow: false });
      w.box({ x: s * 12.9, y: 1.34, z: 3, w: 0.1, h: 0.08, d: 21.8, color: GOLD, metal: 1, rough: 0.35, shadow: false });
    }
    for (const z of [10, 3, -4]) for (const x of [-7, 7]) { w.box({ x, y: 6.9, z, w: 2.6, h: 0.1, d: 0.3, glow: 0xdff4ff, glowIntensity: 1.5, shadow: false }); hotelHalo(w, x, 6.5, z, 4.5, 0xcfe8ff, 0.16); }
    w.light(0xfff0d0, 16, 26, 0, 5.4, 4);
    w.light(0xe4f0ff, 12, 22, 0, 5.4, -4);

    // the baggage hall: a pit under the belts, then the weigh-in bay
    wallX(w, { x: -13.4, z0: -72.8, z1: -8.8, y0: -10, y1: 9, mat: STEEL });
    wallX(w, { x: 13.4, z0: -72.8, z1: -8.8, y0: -10, y1: 9, mat: STEEL });
    w.plat({ x: 0, y: 9.5, z: -40.6, w: 28, d: 64.4, h: 0.5, tex: 'metal', color: 0x3a4050, roughness: 0.7 });
    w.plat({ x: 0, y: -9, z: (-8.6 + BAY_Z0) / 2, w: 26.4, d: -8.6 - BAY_Z0, h: 1, tex: 'tile', color: 0x22252c, roughness: 0.95 });
    w.plat({ x: 0, y: 0, z: (BAY_Z0 - 72.6) / 2, w: 26.4, d: 72.6 + BAY_Z0, h: 2, tex: 'metal', color: 0x8c95a3, roughness: 0.55 });
    w.box({ x: 0, y: -5.5, z: BAY_Z0 + 0.06, w: 26, h: 7, d: 0.1, tex: 'metal', color: 0x2c313b, shadow: false });     // the pit's north face, below the bay floor slab
    wallZ(w, { z: WB, x0: -13.8, x1: 13.8, y0: -2, y1: 9, gaps: [{ c: 0, w: 3, h: 3.6 }], mat: STEEL });
    for (let z = -16; z > -70; z -= 8) { w.box({ x: 0, y: 8.9, z, w: 3.4, h: 0.1, d: 0.3, glow: 0xdff4ff, glowIntensity: 1.4, shadow: false }); hotelHalo(w, 0, 8.4, z, 5.5, 0xcfe8ff, 0.12); }
    w.light(0xfff0d0, 18, 34, 0, 7.5, -26); w.light(0xffe6c0, 16, 30, 0, 7, -58);
    for (const s of [-1, 1]) for (let z = -59; z > -71; z -= 3.4) w.box({ x: s * 12.92, y: 0.3, z, w: 0.08, h: 0.6, d: 1.6, color: 0xffd21f, shadow: false });   // hazard plates along the bay walls
    w.sign({ text: 'BAGGAGE HANDLING · HALL B', x: 0, y: 6.4, z: WA - 0.44, w: 9, h: 1.0, rotY: Math.PI, color: '#ffd21f', double: false, tw: 1024, size: 70 });

    // the X-ray corridor
    w.plat({ x: 0, y: 0, z: -77.6, w: 6.6, d: 10.4, h: 2, tex: 'tile', color: 0xe8ecf0, roughness: 0.4 });
    wallX(w, { x: -2.9, z0: -82.8, z1: -72.8, y0: -2, y1: 3.6, mat: { tex: 'tile', color: 0xf2f4f6 } });
    wallX(w, { x: 2.9, z0: -82.8, z1: -72.8, y0: -2, y1: 3.6, mat: { tex: 'tile', color: 0xf2f4f6 } });
    w.plat({ x: 0, y: 4.1, z: -77.6, w: 6.6, d: 10.4, h: 0.5, tex: 'tile', color: 0xdfe4ea });

    // lost property
    w.plat({ x: 0, y: 0, z: -97.6, w: 26.4, d: 30, h: 2, tex: 'wood', color: 0x9a7a58, roughness: 0.6 });
    roomBox(w, { x0: -13, x1: 13, z0: -112, z1: -82.8, H: 7, ceil: { tex: 'coffer', color: 0xd8ccb8 }, walls: { w: true, e: true }, wallMat: WOODWALL });
    wallZ(w, { z: WC, x0: -13.8, x1: 13.8, y0: -2, y1: 7, gaps: [{ c: 0, w: 3, h: 3.6 }], mat: WOODWALL });
    wallZ(w, { z: WD, x0: -13.8, x1: 13.8, y0: -2, y1: 15, gaps: [{ c: 0, w: 4, h: 4.2 }], mat: WOODWALL });
    w.light(0xffd8a8, 16, 26, 0, 6, -90); w.light(0xffd8a8, 16, 26, 0, 6, -104);
    for (const z of [-88, -96, -104]) for (const x of [-7, 7]) { w.box({ x, y: 6.85, z, w: 0.6, h: 0.3, d: 0.6, glow: 0xffd9a0, glowIntensity: 1.6, shadow: false }); hotelHalo(w, x, 6.5, z, 3.2, 0xffc880, 0.18); }

    // the pile (a tall hall of unclaimed luggage) and customs on the mezzanine above its north end
    w.plat({ x: 0, y: 0, z: -118.9, w: 20.4, d: 12.6, h: 2, tex: 'stone', color: 0x7a7468, roughness: 0.8 });
    roomBox(w, { x0: -10, x1: 10, z0: -125, z1: -112.8, H: 15, ceil: { tex: 'metal', color: 0x4a505c }, walls: { w: true, e: true }, wallMat: { tex: 'stone', color: 0xa89c88 } });
    wallZ(w, { z: WE, x0: -10.8, x1: 10.8, y0: -2, y1: 15, gaps: [{ c: 0, w: 3.4, h: 3.8, y: UP }], mat: { tex: 'stone', color: 0xa89c88 } });
    w.light(0xffe0b0, 18, 30, 0, 12, -118);
    for (const x of [-6, 0, 6]) { w.box({ x, y: 14.85, z: -118.9, w: 0.5, h: 0.3, d: 9, glow: 0xfff0d0, glowIntensity: 1.3, shadow: false }); hotelHalo(w, x, 14.2, -118.9, 4, 0xffe0b0, 0.14); }
    w.plat({ x: 0, y: UP, z: -132.4, w: 18.4, d: 14.8, h: 2, tex: 'marble', color: 0xffffff, roughness: 0.2 });
    roomBox(w, { x0: -9, x1: 9, z0: -139, z1: -125.8, y: UP, H: 5.6, ceil: { tex: 'coffer', color: 0xffffff }, walls: { n: true, w: true, e: true }, wallMat: { tex: 'tile', color: 0xf0f0ec }, yb: UP - 2 });
    w.light(0xffffff, 12, 20, 0, UP + 4.6, -132);

    // real-time timers that die with the level (only for things the player watches; game logic uses world time)
    const timers = new Set();
    const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
    w.onDispose(() => { for (const id of timers) clearTimeout(id); });

    // =====================================================================================================
    //  Stage 1 · the baggage office (count the suitcases)
    // =====================================================================================================
    const order = shuffle(COLORS);
    let counts, code;
    do { counts = order.map(() => rint(2, 6)); code = counts.join(''); } while (code === '1337');
    const fake = '1337';
    const slots = shuffle([[-7.2, 5.5], [7.2, 5.5], [-7.2, -1.5], [7.2, -1.5]]);
    const pallets = [];
    COLORS.forEach((col, i) => {
      const n = counts[order.indexOf(col)];
      const [px, pz] = slots[i];
      w.plat({ x: px, y: 0.16, z: pz, w: 7, d: 3.6, h: 0.16, tex: 'wood', color: 0xb08a5a, roughness: 0.8, radius: 0.02 });
      for (let k = 0; k < n; k++) suitcase(w, px - 2.4 + (k % 3) * 2.4, pz - 0.7 + Math.floor(k / 3) * 1.4, col.hex, 0.16);
      w.sign({ text: col.name.toUpperCase(), x: px, y: 0.19, z: pz + 2.1, w: 2.4, h: 0.5, rotX: -Math.PI / 2, color: col.css, double: false, tw: 512, size: 70 });
      pallets.push({ col, n, px, pz });
    });
    poster(w, order, -7.4, 2.6, WA + 0.52);
    luggageCart(w, -11, 9, 1); luggageCart(w, 11, 9, 1);
    const junk = ['a single sock', 'a rubber duck (not yours)', 'forty-two keys (none fit)', 'a sandwich of unclear age', 'a tiny hat for a tiny dog', 'a laminated apology', 'six spoons. Only spoons.'];
    const openJunk = (g) => { g.ui.toast('Inside: ' + junk[Math.floor(Math.random() * junk.length)], 'gold'); g.audio.click(); g.say('hotel.l3.junk', { priority: 1 }); };
    for (const [x, z, c] of [[-11.4, 12.2, 0x44434a], [11.4, 12.2, 0x5a5560], [-11.4, -6.4, 0x3e3a46], [8.4, -6.9, 0x4c5260]]) {
      suitcase(w, x, z, c, 0, 1.15);
      w.interactable({ x, y: 0.4, z, w: 1.3, h: 0.9, d: 0.75, label: 'Open suitcase', onUse: openJunk });
    }
    // the mimic: it breathes (watch the lid) and its tongue pokes out of the seam. That is the tell.
    const MX = -3.6, MZ = -6.8;
    const mimic = suitcase(w, MX, MZ, 0x111114, 0, 1.25);
    mimic.group.matrixAutoUpdate = true;
    const tongue = w.box({ x: MX - 0.15, y: 0.42, z: MZ + 0.37, w: 0.22, h: 0.05, d: 0.16, color: 0xc8324a, rough: 0.4, shadow: false, static: false });
    for (const tx of [MX - 0.35, MX + 0.3]) w.box({ x: tx, y: 0.43, z: MZ + 0.36, w: 0.06, h: 0.07, d: 0.04, color: 0xf4f0e6, shadow: false });
    w.onUpdate((dt, t) => { const k = Math.max(0, Math.sin(t * 2.1)); mimic.group.scale.set(1, 1 + 0.05 * k, 1); tongue.position.z = MZ + 0.37 + 0.05 * k; });
    w.interactable({ x: MX, y: 0.45, z: MZ, w: 1.45, h: 0.95, d: 0.85, label: () => (baby() ? 'Open suitcase (it is growling)' : 'Open suitcase'), onUse: (g) => { g.say('hotel.l3.mimic', { priority: 2 }); g.audio.buzzer(); g.kill('mimic'); } });
    // the ledger on the desk (in the host's handwriting)
    w.plat({ x: 11.3, y: 1.0, z: -5.2, w: 2.6, d: 1.3, h: 0.14, tex: 'wood', color: 0xc9a56e, roughness: 0.5, radius: 0.04 });
    w.plat({ x: 11.3, y: 0.86, z: -5.2, w: 2.4, d: 1.1, h: 0.86, tex: 'wood', color: 0x8c6a3e, roughness: 0.6, radius: 0.04 });
    w.box({ x: 11.3, y: 1.04, z: -5.2, w: 0.9, h: 0.08, d: 0.65, color: 0x7a1f2a, rough: 0.7 });
    w.interactable({ x: 11.3, y: 1.15, z: -5.2, w: 1.1, h: 0.4, d: 0.8, label: 'Read the ledger', onUse: (g) => g.say('hotel.l3.ledger', { priority: 1, vars: { fake } }) });

    // the door, and a keypad that lies exactly once (ACCESS GRANTED*, with an asterisk)
    const doorA = slideDoor(w, game, { x: 0, z: WA, width: 4, height: 4.4, stripes: 0xffd21f });
    doorFrame(w, { x: 0, z: WA, width: 4, height: 4.4 });
    w.sign({ text: 'BAGGAGE HANDLING · STAFF ONLY', x: 0, y: 5.3, z: WA + 0.44, w: 6, h: 0.9, color: '#ffd21f', double: false, tw: 1024, size: 54 });
    let attemptsA = 0, liedA = false;
    const padA = keypadBox(w, game, { x: 3.7, z: WA + 0.47, face: 's', label: () => (doorA.open ? 'Door unlocked' : 'Use keypad'), use: (g) => { if (!doorA.open) useKeypadA(g); } });
    const useKeypadA = (g) => openKeypad(g, {
      title: 'BAGGAGE DOOR · ENTER CODE', digits: 4,
      onSubmit: (c, api) => {
        if (c === code) {
          if (!liedA && !g.baby) {
            liedA = true;
            api.setMsg('ACCESS GRANTED*', 'good'); g.audio.confirm(); padA.setLed(0x40ff88);
            w.after(0.8, () => { api.close(); doorA.jolt(0.35); padA.setLed(0xff3a46); g.ui.toast('*just kidding. Please re-enter your code.', 'bad'); g.say('hotel.l3.jk', { priority: 2 }); });
            return;
          }
          api.setMsg('ACCESS GRANTED', 'good'); g.audio.confirm();
          w.after(0.6, () => { api.close(); doorA.openDoor(); padA.setLed(0x40ff88); w.after(0.6, () => g.say('hotel.l3.granted', { priority: 2 })); });
        } else {
          attemptsA++; g.audio.buzzer(); api.clear(); api.setMsg('ACCESS DENIED', 'bad');
          if (c === fake) g.say('hotel.l3.fake', { priority: 2, vars: { fake } });
          else if (attemptsA % 3 === 0) { g.say('hotel.l3.lock', { priority: 2 }); api.lockout(5); }
          else g.say('hotel.l3.denied', { priority: 1 });
        }
      },
    });

    // =====================================================================================================
    //  Stage 2 · the belts
    // =====================================================================================================
    const path = (p) => { p.o.path = true; return p; };
    const stand = (x, z, ww, dd, bottom) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) w.box({ x: x + sx * (ww / 2 - 0.45), y: (bottom - 8.5) / 2, z: z + sz * (dd / 2 - 0.45), w: 0.3, h: bottom + 8.5, d: 0.3, color: 0x4a505c, metal: 0.6, rough: 0.4, shadow: false }); };
    const pad = (x, z0, z1, ww) => {
      const d = Math.abs(z0 - z1), z = (z0 + z1) / 2;
      const p = path(w.plat({ x, y: 0, z, w: ww, d, h: 1.1, tex: 'metal', color: 0xaab2bc, roughness: 0.5, metalness: 0.4, radius: 0.04 }));
      for (const e of [-1, 1]) w.box({ x, y: 0.012, z: z + e * (d / 2 - 0.15), w: ww - 0.3, h: 0.02, d: 0.16, color: 0xffd21f, shadow: false });
      stand(x, z, ww, d, -1.1);
      return p;
    };
    const belt = (x, z, ww, dd, v, rails = [-1, 1]) => {
      const p = path(w.plat({ x, y: 0, z, w: ww, d: dd, h: 0.9, tex: 'metal', color: 0x4a5160, roughness: 0.5, metalness: 0.5, radius: 0.03 }));
      w.conveyor(p, v);
      const alongZ = Math.abs(v.vz || 0) > Math.abs(v.vx || 0);
      for (const s of rails) {
        if (alongZ) w.box({ x: x + s * (ww / 2 + 0.12), y: 0.12, z, w: 0.24, h: 0.5, d: dd, color: GOLD, metal: 1, rough: 0.35, shadow: false });
        else w.box({ x, y: 0.12, z: z + s * (dd / 2 + 0.12), w: ww, h: 0.5, d: 0.24, color: GOLD, metal: 1, rough: 0.35, shadow: false });
      }
      stand(x, z, ww, dd, -0.9);
      return p;
    };
    const E = pad(0, -8.6, -13.4, 9);
    const BA = belt(0, -19.7, 6, 9, { vz: 2.8 });                  // against you (a suitcase rides it)
    const P1 = pad(0, -24.2, -27.4, 7);                            // (flush with belt A's far end: no gap after the suitcase hop)
    const BB = belt(0, -34.9, 6, 11, { vz: -3.4 });                // with you, under the press
    const PRESS_Z = -34.9;
    const P2 = pad(0, -42.4, -45.6, 7);
    const BT = belt(-7.1, -44, 5, 3.2, { vx: 3.2 });                // sideways, against you
    const P3 = pad(-11.1, -42.0, -46.0, 3);
    const BC = belt(BELT_C.x, (BELT_C.z0 + BELT_C.z1) / 2, 3, BELT_C.z0 - BELT_C.z1 + 0.2, { vz: BELT_C.v }, [1]);   // with you... until it is not
    void E; void BA; void P1; void BB; void P2; void BT; void P3;
    w.box({ x: 0, y: 0.012, z: BAY_Z0 - 0.25, w: 26, h: 0.02, d: 0.2, color: 0xffd21f, shadow: false });
    // (an invisible route marker on the bay floor, flush with it: the last stop of the belt route)
    const bayEdge = path(w.plat({ x: -9, y: 0, z: BAY_Z0 - 1.8, w: 8, d: 3.2, h: 0.2, tex: 'metal', color: 0x8c95a3 }));
    bayEdge.group.visible = false;
    const cpBelts = w.checkpoint({ x: 0, y: 0, z: -11.2, real: true });
    trollCheckpoint(w, game, { x: 0, y: 0, z: -25.8, mode: 'expire', ttl: 15, say: 'hotel.l3.expired' });

    // luggage traffic on belt A: one suitcase rides it toward you, out of one flap curtain and into the other (hop it, or step round it)
    const BA_N = -23.6, BA_RUN = 7.8;
    const bagHz = w.hazard({ x: 0.6, y: 0.3, z: BA_N, w: 1.0, h: 0.6, d: 0.5, color: 0xff3a46, move: (t) => ({ z: (t * 2.8) % BA_RUN }) });
    bagHz.core.visible = false; bagHz.shell.visible = false; bagHz.jumpable = true;
    { const m = bagMesh({ color: 0x7a2a52, s: 1.05 }); m.position.y = -0.3; bagHz.group.add(m); }
    for (const fz of [-15.45, -23.95]) flapCurtain(w, 0, fz, 6.2);
    // the press over belt B
    const press = w.hazard({ x: 0, y: 3.2, z: PRESS_Z, w: 6.2, h: 1.1, d: 2.2, color: 0xff3a4a, move: (t) => ({ y: -2.3 * Math.max(0, Math.sin(t * 1.6) * 1.4 - 0.4) }) });
    for (const sx of [-1, 1]) w.box({ x: sx * 3.4, y: 1.5, z: PRESS_Z, w: 0.4, h: 21, d: 0.4, color: 0x5a6070, metal: 0.7, rough: 0.4 });
    w.box({ x: 0, y: 6.6, z: PRESS_Z, w: 7.4, h: 0.6, d: 0.7, color: 0x5a6070, metal: 0.7, rough: 0.4 });
    w.sign({ text: 'MIND THE PRESS', x: 0, y: 5.6, z: PRESS_Z + 0.38, w: 4, h: 0.6, color: '#ffd21f', double: false, tw: 512, size: 60 });
    w.box({ x: 0, y: 5.6, z: PRESS_Z + 0.32, w: 4.2, h: 0.75, d: 0.06, color: 0x1c2028, shadow: false });
    // belt C reverses: two amber beacons on its rail blink (and tick quietly), then it runs backwards for a while
    const beacons = [];
    for (const z of [BELT_C.z0 - 0.3, BELT_C.z1 + 0.4]) {
      w.box({ x: BELT_C.x + 1.62, y: 1.07, z, w: 0.1, h: 1.4, d: 0.1, color: 0x30343c, metal: 0.6, rough: 0.4, shadow: false });
      beacons.push(w.box({ x: BELT_C.x + 1.62, y: 1.9, z, w: 0.3, h: 0.3, d: 0.3, color: 0x3a2a10, static: false, shadow: false }));
    }
    w.sign({ text: '⚠ REVERSES WHEN AMBER', x: BELT_C.x + 1.75, y: 1.45, z: (BELT_C.z0 + BELT_C.z1) / 2, w: 4.2, h: 0.4, rotY: Math.PI / 2, color: '#ffa21f', double: true, tw: 512, size: 48 });
    const beaconOn = glowMaterial(0xffa21f, 2.6), beaconOff = plainMaterial(0x3a2a10, { roughness: 0.5 });
    const beltMesh = BC.group.children[BC.group.children.length - 1];
    const r0 = beltMesh.rotation.y;
    const rev = { phase: 'fwd', t: 0, saidRev: false, on: false };
    const REV = () => ({ fwd: 5.5, warn: baby() ? 2.2 : 1.3, back: 2.2, speed: baby() ? 3.8 : 5.2 });
    const setRev = (back) => { BC.body.conv = [0, back ? REV().speed : BELT_C.v]; beltMesh.rotation.y = back ? r0 + Math.PI : r0; for (const b of beacons) b.material = back ? beaconOn : beaconOff; };
    w.onUpdate((dt) => {
      const R = REV();
      rev.t += dt;
      if (rev.phase === 'fwd' && rev.t > R.fwd) { rev.phase = 'warn'; rev.t = 0; }
      else if (rev.phase === 'warn') {
        const on = Math.floor(rev.t * 6) % 2 === 0;
        if (on !== rev.on) { rev.on = on; for (const b of beacons) b.material = on ? beaconOn : beaconOff; if (on && near(BELT_C.x, -51, 14)) game.audio.tick(); }
        if (rev.t > R.warn) {
          rev.phase = 'back'; rev.t = 0; setRev(true);
          if (!rev.saidRev && near(BELT_C.x, -51, 12)) { rev.saidRev = true; game.say('hotel.l3.reverse', { priority: 1 }); }
        }
      } else if (rev.phase === 'back' && rev.t > R.back) { rev.phase = 'fwd'; rev.t = 0; setRev(false); }
    });

    // =====================================================================================================
    //  Stage 3 · weigh-in (carry the cases to the scale; the code is their tags, heaviest first)
    // =====================================================================================================
    const cpWeigh = w.checkpoint({ x: BELT_C.x, y: 0, z: BAY_Z0 - 2.4, real: true });
    w.trigger({ x: -9.5, y: 1.2, z: BAY_Z0 - 2.4, w: 7, h: 3, d: 3, once: true, onEnter: () => { if (!cpWeigh.used) { cpWeigh.used = true; w.burst(new THREE.Vector3(cpWeigh.x, 0.4, cpWeigh.z), 0xffc83d, 24); game.onCheckpoint(cpWeigh); } } });   // (the whole belt exit counts)
    const wcols = shuffle(COLORS).slice(0, 3);
    const bigI = rint(0, 2);
    const weights = [];
    for (let i = 0; i < 3; i++) {
      let kg;
      do { kg = i === bigI ? rint(3, 7) : rint(12, 31); } while (weights.some((o) => Math.abs(o - kg) < 3));
      weights.push(kg);
    }
    const tags = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3);
    const wbags = wcols.map((col, i) => ({ col, kg: weights[i], tag: tags[i], big: i === bigI, mesh: null, i }));
    const wcode = [...wbags].sort((a, b) => b.kg - a.kg).map((b) => b.tag).join('');
    // three baggage carts round the bay (one case on each), the scale in the middle
    const CARTS = shuffle([{ x: -8.6, z: -66.6, face: 'e' }, { x: 8.2, z: -59.6, face: 'w' }, { x: 8.2, z: -69.4, face: 'w' }]);
    for (const c of CARTS) {
      w.plat({ x: c.x, y: 0.55, z: c.z, w: 1.6, d: 2.2, h: 0.12, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.03 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) w.box({ x: c.x + sx * 0.65, y: 0.245, z: c.z + sz * 0.95, w: 0.08, h: 0.49, d: 0.08, color: 0x14141a, rough: 0.5, shadow: false });
      w.box({ x: c.x + (c.face === 'e' ? -0.78 : 0.78), y: 1.25, z: c.z, w: 0.06, h: 1.3, d: 2.2, color: GOLD, metal: 1, rough: 0.3, shadow: false });
      w.collider({ x: c.x, y: 0.3, z: c.z, w: 1.6, h: 0.6, d: 2.2 });
    }
    const SCALE = { x: 2.4, z: -64.4 };
    w.box({ x: SCALE.x, y: 0.04, z: SCALE.z, w: 2.0, h: 0.08, d: 2.0, color: 0x2c313b, metal: 0.6, rough: 0.35 });
    w.box({ x: SCALE.x, y: 0.09, z: SCALE.z, w: 1.7, h: 0.04, d: 1.7, tex: 'metal', color: 0xc8ced8, shadow: false });
    w.box({ x: SCALE.x, y: 1.05, z: SCALE.z - 1.15, w: 0.12, h: 2.1, d: 0.12, color: 0x30343c, metal: 0.6, shadow: false });
    w.box({ x: SCALE.x, y: 2.15, z: SCALE.z - 1.14, w: 1.75, h: 0.75, d: 0.08, color: 0x14161c, shadow: false });
    const disp = canvasPlane(w, { x: SCALE.x, y: 2.15, z: SCALE.z - 1.08, width: 1.6, height: 0.6, px: 512, draw: () => {} });
    const showKg = (txt, col = '#7dffb0') => disp.redraw((g, cw, ch) => { g.fillStyle = '#05140c'; g.fillRect(0, 0, cw, ch); g.fillStyle = col; g.font = '700 110px ui-monospace, Menlo, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, cw / 2, ch / 2 + 6); });
    showKg('0.0 kg');
    // slots: three on the rack, one on the scale. E on a slot swaps what you hold with what is there.
    const wslots = CARTS.map((c, i) => ({ x: c.x, z: c.z, y: 0.61, bag: wbags[i], scale: false, i, face: c.face }));
    const scaleSlot = { x: SCALE.x, z: SCALE.z, y: 0.11, bag: null, scale: true };
    const allSlots = [...wslots, scaleSlot];
    let held = null;
    for (const b of wbags) { b.mesh = bagMesh({ color: b.col.hex, s: b.big ? 1.45 : 1, tag: String(b.tag) }); w.add(b.mesh); }
    const seat = (slot) => { const b = slot.bag; if (!b) return; b.mesh.position.set(slot.x, slot.y, slot.z); b.mesh.rotation.set(0, slot.scale ? 0 : slot.face === 'e' ? Math.PI / 2 : -Math.PI / 2, 0); b.mesh.scale.setScalar(1); };
    allSlots.forEach(seat);
    const weighed = new Set();
    let saidScale = false, saidBig = false;
    const updScale = (announce) => {
      const b = scaleSlot.bag;
      if (!b) { showKg('0.0 kg'); return; }
      showKg(`${b.kg.toFixed(1)} kg`); weighed.add(b.i);
      if (!announce) return;
      if (b.big && !saidBig) { saidBig = true; game.say('hotel.l3.bigkg', { priority: 1 }); }
      else if (!saidScale) { saidScale = true; game.say('hotel.l3.scale', { priority: 1 }); }
    };
    const useSlot = (g, slot) => {
      if (!held && !slot.bag) return;
      g.audio.click();
      const was = slot.bag;
      slot.bag = held; held = was;
      seat(slot);
      if (slot.scale) updScale(true);
    };
    for (const slot of allSlots) {
      w.interactable({
        x: slot.x, y: slot.y + 0.45, z: slot.z, w: slot.scale ? 1.8 : 1.6, h: 1.0, d: slot.scale ? 1.8 : 1.6, range: 3.4, pad: 0.05,
        label: () => {
          if (held && slot.bag) return slot.scale ? `Weigh the ${held.col.name} case instead` : `Swap for the ${slot.bag.col.name} case`;
          if (held) return slot.scale ? `Put the ${held.col.name} case on the scale` : `Put the ${held.col.name} case down`;
          return `Pick up the ${slot.bag?.col.name} case`;
        },
        enabled: () => !!(held || slot.bag) && !claimed,
        onUse: (g) => useSlot(g, slot),
      });
    }
    // standing on the scale yourself
    w.trigger({ x: SCALE.x, y: 1, z: SCALE.z, w: 1.6, h: 2, d: 1.6, once: false, onEnter: () => { if (!scaleSlot.bag) { showKg('404 kg', '#ff7a85'); game.say('hotel.l3.you', { priority: 0 }); } }, onExit: () => updScale(false) });
    // the carried case rides in front of you, slightly to the right
    w.onUpdate(() => {
      if (!held) return;
      const p = game.player, yw = game.yaw;
      const fx = -Math.sin(yw), fz = -Math.cos(yw), rx = Math.cos(yw), rz = -Math.sin(yw);
      held.mesh.position.set(p.x + fx * 0.75 + rx * 0.42, p.y + 0.78, p.z + fz * 0.75 + rz * 0.42);
      held.mesh.rotation.set(0, yw + Math.PI / 2, 0);
      held.mesh.scale.setScalar(0.62);
    });
    weighPoster(w, -6.0, 3.2, WB + 0.52);
    w.sign({ text: 'SCALE ▸', x: SCALE.x, y: 0.03, z: SCALE.z + 1.5, w: 1.8, h: 0.5, rotX: -Math.PI / 2, color: '#7dffb0', double: false, tw: 512, size: 70 });
    luggageCart(w, -10.6, -60.2, 0);
    w.plat({ x: 8.0, y: 1.2, z: -70.6, w: 1.2, d: 1.2, h: 1.2, tex: 'wood', color: 0xa07a4a, roughness: 0.8 });
    w.plat({ x: 9.4, y: 1.0, z: -70.6, w: 1.0, d: 1.0, h: 1.0, tex: 'wood', color: 0x8a6a3a, roughness: 0.8 });
    w.plat({ x: 8.75, y: 2.0, z: -70.6, w: 0.8, d: 0.8, h: 0.8, tex: 'wood', color: 0xb08a5a, roughness: 0.8 });
    // the door to security (keypad: the tags, heaviest first)
    const doorB = slideDoor(w, game, { x: 0, z: WB, width: 3, height: 3.6, stripes: 0xffd21f });
    doorFrame(w, { x: 0, z: WB, width: 3, height: 3.6 });
    w.sign({ text: 'SECURITY ▸ LOST PROPERTY', x: 0, y: 4.5, z: WB + 0.44, w: 5, h: 0.7, color: '#ffd21f', double: false, tw: 1024, size: 54 });
    let attemptsB = 0;
    const padB = keypadBox(w, game, { x: 2.6, z: WB + 0.47, face: 's', label: () => (doorB.open ? 'Door unlocked' : 'Release code'), use: (g) => { if (!doorB.open) useKeypadB(g); } });
    const useKeypadB = (g) => openKeypad(g, {
      title: 'HOLD BAGGAGE · RELEASE CODE', digits: 3,
      info: () => 'Weighed so far: ' + (weighed.size ? wbags.filter((b) => weighed.has(b.i)).map((b) => `${b.col.name} ${b.kg} kg (tag ${b.tag})`).join(' · ') : 'nothing'),
      onSubmit: (c, api) => {
        if (c === wcode) { api.setMsg('RELEASED', 'good'); g.audio.confirm(); w.after(0.6, () => { api.close(); doorB.openDoor(); padB.setLed(0x40ff88); w.after(0.5, () => g.say('hotel.l3.w.open', { priority: 2 })); }); }
        else {
          attemptsB++; g.audio.buzzer(); api.clear(); api.setMsg('WRONG ORDER', 'bad');
          if (attemptsB % 3 === 0) { g.say('hotel.l3.lock', { priority: 2 }); api.lockout(5); } else g.say('hotel.l3.w.denied', { priority: 1 });
        }
      },
    });

    // =====================================================================================================
    //  Stage 4 · X-ray, lost property, customs
    // =====================================================================================================
    // the X-ray arch: it scans you. It is a loading screen. (It also confiscates the case you are carrying: it was not yours.)
    for (const sx of [-1, 1]) { w.box({ x: sx * 1.6, y: 1.35, z: -77.2, w: 0.5, h: 2.7, d: 1.2, color: 0xdfe4ea, rough: 0.3 }); w.collider({ x: sx * 1.6, y: 1.35, z: -77.2, w: 0.5, h: 2.7, d: 1.2 }); }
    w.box({ x: 0, y: 2.85, z: -77.2, w: 3.7, h: 0.5, d: 1.2, color: 0xdfe4ea, rough: 0.3 });
    w.box({ x: 0, y: 2.85, z: -76.58, w: 2.4, h: 0.22, d: 0.04, glow: 0x6ad4ff, glowIntensity: 1.8, shadow: false });
    w.sign({ text: 'X-RAY · PLEASE HOLD STILL', x: 0, y: 3.3, z: -76.58, w: 3.2, h: 0.4, color: '#bfe8ff', double: false, tw: 512, size: 50 });
    let xrayDone = false;
    w.trigger({
      x: 0, y: 1, z: -77.2, w: 2.6, h: 2, d: 1.0, once: false, onEnter: () => {
        if (held && !claimed) { const free = allSlots.find((s) => !s.bag); if (free) { free.bag = held; held = null; seat(free); updScale(false); game.ui.toast('Confiscated by security: one (1) suitcase. It was not yours.', 'bad'); } }
        if (xrayDone) return;
        xrayDone = true; loadingScreen(game, w, { sec: 2.4, say: 'hotel.l3.xray', sayAfter: 'hotel.l3.xray2' });
      },
    });
    w.sign({ text: 'LIQUIDS: 100 ml · DIGNITY: 0 ml', x: -2.47, y: 2.0, z: -75, w: 2.6, h: 0.45, rotY: Math.PI / 2, color: '#2a3a4a', bg: '#e8f4ff', double: false, tw: 512, size: 34 });

    const cpLP = w.checkpoint({ x: 0, y: 0, z: -85.6, real: true });
    // the cage: wire mesh in front of shelves full of other people's things
    for (const s of [-1, 1]) {
      const sx = s * 12.2;
      for (const y of [1.2, 2.6]) w.box({ x: sx, y, z: -97.4, w: 1.4, h: 0.06, d: 27, tex: 'wood', color: 0x6a4a2a, shadow: false });
      for (let z = -84.4; z >= -110.4; z -= 3.25) w.box({ x: sx, y: 1.5, z, w: 1.4, h: 3.0, d: 0.08, tex: 'wood', color: 0x5a3a1a, shadow: false });
      w.collider({ x: s * 12.15, y: 1.5, z: -97.4, w: 1.7, h: 3, d: 27 });
      for (let k = 0; k < 8; k++) lostItem(w, sx, k % 2 ? 2.63 : 1.23, -86 - k * 3.25, k + (s > 0 ? 8 : 0));
      wireMesh(w, s * 11.25, -97.4, 27, 5.4, s);
      w.sign({ text: 'LOST PROPERTY · DO NOT FEED THE UMBRELLAS', x: s * 11.2, y: 5.9, z: -97.4, w: 8, h: 0.5, rotY: -s * Math.PI / 2, color: '#f1d28a', double: false, tw: 1024, size: 44 });
    }
    // Carousel 13
    const BAGCOL = [0x6a3fa0, 0x6a3fa0, 0x6a3fa0, 0xc2332a, 0x2a62c8, 0x2f9e5b, 0x22222a, 0xe07a2a];
    const claim = String(rint(1000, 9999));
    const decoyNum = () => { let s; do { s = String(rint(1000, 9999)); } while (s === claim); return s; };
    const duckI = 0;
    const cbags = BAGCOL.map((col, i) => ({ col, duck: i === duckI, back: i === duckI ? claim : decoyNum(), tag: decoyNum(), s0: 0, mesh: null, pos: null, claimed: false }));
    const order2 = shuffle(cbags.map((_, i) => i));
    const PER = 2 * CAR.L + 2 * Math.PI * CAR.R, SPD = 1.05;
    order2.forEach((bi, k) => { cbags[bi].s0 = (k / cbags.length) * PER; });
    for (const b of cbags) { b.mesh = bagMesh({ color: b.col, s: 1, duck: b.duck, back: b.back, tag: b.tag, front: true }); w.add(b.mesh); }
    const carPos = (s) => {   // position + outward normal along the stadium
      s = ((s % PER) + PER) % PER;
      const { x, z, L, R } = CAR;
      if (s < L) return { x: x + R, z: z + L / 2 - s, nx: 1, nz: 0 };                                 // east straight, going north
      s -= L;
      if (s < Math.PI * R) { const a = s / R; return { x: x + R * Math.cos(a), z: z - L / 2 - R * Math.sin(a), nx: Math.cos(a), nz: -Math.sin(a) }; }
      s -= Math.PI * R;
      if (s < L) return { x: x - R, z: z - L / 2 + s, nx: -1, nz: 0 };                                // west straight, going south
      s -= L;
      const a = s / R; return { x: x - R * Math.cos(a), z: z + L / 2 + R * Math.sin(a), nx: -Math.cos(a), nz: Math.sin(a) };
    };
    const placeBags = (t) => { for (const b of cbags) { if (b.claimed) continue; const q = carPos(b.s0 + t * SPD); b.pos = q; b.mesh.position.set(q.x, 0.56, q.z); b.mesh.rotation.y = Math.atan2(q.nx, q.nz); } };
    placeBags(0);
    w.onUpdate((dt, t) => placeBags(t));
    carousel(w, CAR);
    for (const dz of [-1.3, 1.3]) w.box({ x: 0, y: 1.0, z: CAR.z + dz, w: 0.08, h: 0.6, d: 0.08, color: 0x30343c, metal: 0.6, shadow: false });
    w.sign({ text: 'CAROUSEL 13', x: 0, y: 1.6, z: CAR.z, w: 3.2, h: 0.65, rotY: Math.PI / 2, color: '#ffd21f', bg: '#1c2028', double: true, tw: 512, size: 90 });
    // the claim desk, the report, the keypad
    w.plat({ x: 0, y: 1.1, z: -107, w: 10, d: 1.2, h: 1.1, tex: 'wood', color: 0x7a5232, roughness: 0.5, radius: 0.04 });
    w.plat({ x: 0, y: 1.16, z: -107, w: 10.3, d: 1.4, h: 0.06, tex: 'wood', color: 0xc9a56e, roughness: 0.4, radius: 0.02 });
    w.sign({ text: 'CLAIMS · WINDOW 13', x: 0, y: 0.62, z: -106.37, w: 4, h: 0.5, color: '#f1d28a', double: false, tw: 512, size: 60 });
    w.box({ x: -2.4, y: 1.19, z: -106.9, w: 0.75, h: 0.02, d: 1.0, color: 0x5a3a1a, shadow: false });
    canvasPlane(w, { x: -2.4, y: 1.205, z: -106.9, width: 0.7, height: 0.95, rotX: -Math.PI / 2, px: 360, draw: (g, cw, ch) => drawReport(g, cw, ch) });
    const REPORT_HTML = '<b>LOST BAGGAGE REPORT · No. 404</b><br>Guest: you (probably)<br>Item: <b>PURPLE</b> hard-shell case with a <b>yellow rubber-duck sticker</b><br>Location: Carousel 13<br>Claim number: stencilled on the <b>BACK</b> of the case (regulation 4.04).<br><i>Luggage tags are decorative. Please do not trust them.</i>';
    let readReport = false;
    w.interactable({ x: -2.4, y: 1.35, z: -106.9, w: 1.1, h: 0.5, d: 1.3, range: 3.2, label: 'Read the lost baggage report', onUse: (g) => { readReport = true; readModal(g, { title: 'LOST & FOUND', html: REPORT_HTML }); g.say('hotel.l3.report', { priority: 1 }); } });
    w.plat({ x: 6.6, y: 2.2, z: -107, w: 0.5, d: 0.5, h: 2.2, tex: 'wood', color: 0x3a2a1a, roughness: 0.5 });
    const gate = slideDoor(w, game, { x: 0, z: WD, width: 4, height: 4.2, tex: 'metal', color: 0x6a7280 });
    doorFrame(w, { x: 0, z: WD, width: 4, height: 4.2 });
    w.sign({ text: 'CUSTOMS ▸', x: 0, y: 4.95, z: WD + 0.44, w: 3, h: 0.6, color: '#f1d28a', double: false, tw: 512, size: 60 });
    let attemptsC = 0, claimed = false;
    const padC = keypadBox(w, game, { x: 6.6, y: 1.45, z: -106.68, face: 's', label: () => (claimed ? 'Bag claimed' : 'Enter claim number'), use: (g) => { if (!claimed) useKeypadC(g); } });
    const useKeypadC = (g) => openKeypad(g, {
      title: 'CLAIMS · ENTER CLAIM NUMBER', digits: 4,
      onSubmit: (c, api) => {
        if (c === claim) { api.setMsg('BAG RELEASED', 'good'); g.audio.confirm(); w.after(0.6, () => { api.close(); claimBag(g); }); }
        else {
          attemptsC++; g.audio.buzzer(); api.clear(); api.setMsg('NO SUCH CLAIM', 'bad');
          if (c === cbags[duckI].tag) g.say('hotel.l3.tag', { priority: 2 });
          else if (attemptsC % 3 === 0) { g.say('hotel.l3.lock', { priority: 2 }); api.lockout(5); }
          else g.say('hotel.l3.lp.denied', { priority: 1 });
        }
      },
    });
    const claimBag = (g) => {
      claimed = true; padC.setLed(0x40ff88);
      const duck = cbags[duckI]; duck.claimed = true;
      if (held) { const free = allSlots.find((s) => !s.bag); if (free) { free.bag = held; seat(free); } }
      held = { mesh: duck.mesh, col: { name: 'purple' } };
      gate.openDoor();
      w.after(0.5, () => g.say('hotel.l3.claimed', { priority: 2 }));
    };
    // customs: two channels, a counter between them. You are carrying a suitcase. You have something to declare.
    w.plat({ x: 0, y: 1.05, z: -120.7, w: 0.8, d: 10.8, h: 1.05, tex: 'marble', color: 0xffffff, roughness: 0.2, radius: 0.04 });
    w.box({ x: 4.5, y: 0.012, z: -120, w: 5, h: 0.02, d: 11.6, color: 0x8a1a22, rough: 0.9, shadow: false });
    w.box({ x: -4.5, y: 0.012, z: -120, w: 5, h: 0.02, d: 11.6, color: 0x1a6a3a, rough: 0.9, shadow: false });
    fakeExit(w, game, { x: -4.5, y: 0, z: -125.75, kind: 'door', label: 'NOTHING TO DECLARE', color: 0x2dd47f, say: 'hotel.l3.green' });
    w.sign({ text: 'GOODS TO DECLARE', x: 4.5, y: 4.95, z: -125.55, w: 3.4, h: 0.9, color: '#ff8a8a', double: false, tw: 512, size: 70, glow: true });
    w.sign({ text: '(say, a suitcase)', x: 4.5, y: 4.38, z: -125.55, w: 3.4, h: 0.4, color: '#ffc8c8', double: false, tw: 512, size: 40 });
    const goal = w.goal({ x: 4.5, y: 0, z: -122.6, color: GOLD, onReach: () => { game.say('hotel.l3.done', { priority: 2 }); game.completeLevel(); } });

    // =====================================================================================================
    //  The host, the stages, the hint
    // =====================================================================================================
    const S = escapeStages(w, game, [
      { name: NAMES[0], at: { x: 0, y: 0, z: 11 }, clues: ['hotel.l3.hint1', 'hotel.l3.hint2', 'hotel.l3.hint3'], vars: () => ({ a: code[0], b: code[1], code }), solved: () => doorA.open, trail: [{ x: 0, y: 0, z: -6.5 }, { x: 0, y: 0, z: -9.6 }] },
      { name: NAMES[1], at: { x: 0, y: 0, z: -11.2 }, trail: [{ x: 0, y: 0, z: -16 }, { x: 0, y: 0, z: -23 }, { x: 0, y: 0, z: -27.5 }, { x: 0, y: 0, z: -33 }, { x: 0, y: 0, z: -40 }, { x: 0, y: 0, z: -45.5 }, { x: -6.5, y: 0, z: -45.5 }, { x: BELT_C.x, y: 0, z: -45.5 }, { x: BELT_C.x, y: 0, z: -50 }, { x: BELT_C.x, y: 0, z: -55 }] },
      { name: NAMES[2], at: { x: BELT_C.x, y: 0, z: -58.8 }, clues: ['hotel.l3.w.hint1', 'hotel.l3.w.hint2', 'hotel.l3.w.hint3'], vars: () => ({ code: wcode }), solved: () => doorB.open, trail: [{ x: 0, y: 0, z: -70.5 }, { x: 0, y: 0, z: -74 }, { x: 0, y: 0, z: -80 }] },
      { name: NAMES[3], at: { x: 0, y: 0, z: -85.6 }, clues: ['hotel.l3.lp.hint1', 'hotel.l3.lp.hint2', 'hotel.l3.lp.hint3'], vars: () => ({ code: claim }), solved: () => claimed, trail: [{ x: 8.2, y: 0, z: -105.6 }, { x: 8.2, y: 0, z: -109.6 }, { x: 0, y: 0, z: -110.2 }, { x: 0, y: 0, z: -114 }, { x: 4.5, y: 0, z: -116.5 }], end: { x: goal.x, y: 0, z: goal.z } },
    ]);
    const cps = new Map([[cpBelts, 1], [cpWeigh, 2], [cpLP, 3]]);
    w.hooks.onCheckpoint = (c) => {
      const i = cps.get(c);
      if (i === undefined) return;
      S.enter(i);
      if (i === 1) game.say('hotel.l3.belt', { priority: 1 });
      if (i === 2) { game.say('hotel.l3.weigh', { priority: 1 }); game.say('hotel.l3.big', { priority: 1 }); }
      if (i === 3) game.say('hotel.l3.lp', { priority: 1 });
    };
    // (the expiring checkpoint announces itself with the kit's toast; the host adds his bit)
    w.trigger({ x: 0, y: 1.2, z: -27.5, w: 2.4, h: 3.2, d: 2.4, once: true, onEnter: () => { if (!game.baby) game.say('hotel.l3.exp', { priority: 1 }); } });
    let t0 = 0, intro = false, saidBag = false, saidPress = false;
    w.onUpdate((dt) => {
      if (game.state !== 'playing') return;
      t0 += dt;
      const p = game.player;
      if (!intro && t0 > 1.2) { intro = true; game.say('hotel.l3.intro'); game.say('hotel.l3.intro2', { vars: { fake } }); S.banner(); }
      if (!saidBag && p.z < -14.5 && p.z > -25 && p.y > -1) { saidBag = true; game.say('hotel.l3.bag', { priority: 1 }); }
      if (!saidPress && p.z < -31 && p.z > -42 && p.y > -1) { saidPress = true; game.say('hotel.l3.press', { priority: 1 }); }
    });
    w.hooks.onDeath = (info) => {
      const p = game.player;
      if (info.reason === 'mimic' || info.reason === 'fake') return true;
      if (info.reason === 'hazard' && p.z < -31 && p.z > -42) { game.say('hotel.l3.pressed', { priority: 1 }); return true; }
      if (info.reason === 'hazard' && p.z < -14 && p.z > -25) { game.say('hotel.l3.bagged', { priority: 1 }); return true; }
      if (info.reason === 'void') { game.say(p.x < -8 && p.z < -47 ? 'hotel.l3.revdeath' : 'hotel.l3.pit', { priority: 1 }); return true; }
      return false;
    };
    // a respawn puts a carried weigh-in case back on the rack, and the reversing belt starts its cycle over
    w.onRespawn(() => {
      if (held && !claimed) { const free = allSlots.find((s) => !s.bag); if (free) { free.bag = held; held = null; seat(free); updScale(false); } }
      rev.phase = 'fwd'; rev.t = 0; setRev(false);
    });

    // =====================================================================================================
    //  Test hooks + the bot (it walks to every clue a person has to look at)
    // =====================================================================================================
    w.escape = {
      get code() { return code; }, fake, get doorOpen() { return doorA.open; }, pallets, order, useKeypad: useKeypadA, doorA, doorB, gate, padA, padB, padC,
      weigh: { bags: wbags, code: wcode, slots: allSlots, scaleSlot, useSlot: (slot) => useSlot(game, slot), get held() { return held; }, weighed },
      claim, cbags, duck: cbags[duckI], carPos, get claimed() { return claimed; }, useKeypadB, useKeypadC, stages: S, rev, BC, press, bagHz, mimic: { x: MX, z: MZ }, goal,
      get readReport() { return readReport; }, get liedA() { return liedA; },
    };
    const goTo = (x, z, tol = 0.8) => { const p = game.player; return Math.hypot(p.x - x, p.z - z) > tol ? { x, z } : null; };
    let typedFor = null;
    const keypad = (g, padObj, open, digits) => {
      const m = goTo(padObj.standAt.x, padObj.standAt.z, 0.6); if (m) return m;
      if (!g.modal) { open(g); typedFor = null; }
      else if (typedFor !== g.modal) { typedFor = g.modal; for (const d of digits) g.modal.key({ code: 'Digit' + d }); g.modal.key({ code: 'Enter' }); }
      return { wait: true, x: padObj.x, z: padObj.z };
    };
    const carBox = { x0: -4.7, x1: 4.7, z0: -104.7, z1: -87.3 };
    const crosses = (ax, az, bx, bz) => { for (let k = 0; k <= 24; k++) { const u = k / 24, x = ax + (bx - ax) * u, z = az + (bz - az) * u; if (x > carBox.x0 && x < carBox.x1 && z > carBox.z0 && z < carBox.z1) return true; } return false; };
    const around = (p, tx, tz) => {   // walk round the carousel instead of into it
      if (!crosses(p.x, p.z, tx, tz)) return { x: tx, z: tz };
      const corners = [[-5.7, -86.4], [5.7, -86.4], [-5.7, -105.6], [5.7, -105.6]];
      let best = null, bd = Infinity;
      for (const [cx, cz] of corners) { if (crosses(p.x, p.z, cx, cz)) continue; const d = Math.hypot(cx - p.x, cz - p.z) + Math.hypot(tx - cx, tz - cz) + (crosses(cx, cz, tx, tz) ? 40 : 0); if (d < bd) { bd = d; best = [cx, cz]; } }
      return best ? { x: best[0], z: best[1] } : { x: tx, z: tz };
    };
    let look = 0, weighK = 0, weighT = 0, readBack = false;
    w.botPlan = (g) => {
      const p = g.player;
      if (g.frozen) return { wait: true, x: p.x, z: p.z - 1 };
      // ---- stage 1: walk past the four pallets and the poster, then the keypad (twice: it lies once) ----
      if (!doorA.open) {
        const looks = [[-2.6, 7.5], [-3.2, 5.5], [3.2, 5.5], [3.2, -1.5], [-3.2, -1.5], [-2.4, -4.2], [-6.4, -5.4]];
        if (look < looks.length) { const m = goTo(looks[look][0], looks[look][1]); if (m) return m; look++; return { wait: true, x: p.x, z: p.z - 1 }; }
        return keypad(g, padA, useKeypadA, code);
      }
      if (doorA.t < 1 && p.z > WA) return p.z > WA + 3 ? { x: 0, z: WA + 2 } : { wait: true, x: 0, z: WA - 2 };
      if (p.z > WA + 0.4) return Math.abs(p.x) > 0.9 ? { x: 0, z: WA + 1.8 } : { x: 0, z: WA - 3 };
      // ---- stage 2: the belts (the route platforms) ----
      if (p.z > BAY_Z0 - 0.6 && !(p.grounded && p.ground === bayEdge.body)) return null;
      // ---- stage 3: weigh all three cases, then the keypad ----
      if (!doorB.open) {
        if (p.z > -59.4 && p.x < -5) return { x: -3.8, z: -59.2 };
        const seq = [wslots[0], scaleSlot, wslots[1], scaleSlot, wslots[2], scaleSlot];
        if (weighK < seq.length) {
          const s = seq[weighK], sx = s.scale ? s.x : s.x + 2.2, sz = s.scale ? s.z + 2.0 : s.z;
          const m = goTo(sx, sz, 0.7); if (m) return m;
          if (weighT === 0) { useSlot(g, s); weighT = 0.3; } else { weighT = Math.max(0, weighT - 1 / 60); if (weighT === 0) weighK++; }
          return { wait: true, x: s.x, z: s.z };
        }
        return keypad(g, padB, useKeypadB, wcode);
      }
      if (doorB.t < 1 && p.z > WB) return p.z > WB + 3 ? { x: 0, z: WB + 2 } : { wait: true, x: 0, z: WB - 2 };
      if (p.z > WB + 0.4 && Math.abs(p.x) > 0.8) return { x: 0, z: WB + 1.6 };
      if (p.z > WC - 1.5) return { x: 0, z: Math.max(WC - 2.6, p.z - 4) };
      // ---- stage 4: the report, the back of the duck case, the claim keypad, the red channel ----
      if (!claimed) {
        if (!readReport) { const t = around(p, -2.4, -105.5); const m = goTo(t.x, t.z, 0.7); if (m) return m; readReport = true; return { wait: true, x: -2.4, z: -107 }; }
        if (!readBack) {
          const q = cbags[duckI].pos, D = 2 * CAR.R + 2.8;
          const vx = Math.max(-10, Math.min(10, q.x - q.nx * D)), vz = Math.max(-105.5, Math.min(-86.5, q.z - q.nz * D));
          if (Math.hypot(p.x - vx, p.z - vz) < 1.7) { readBack = true; return { wait: true, x: q.x, z: q.z }; }
          return around(p, vx, vz);
        }
        const t = around(p, padC.standAt.x, padC.standAt.z);
        if (t.x !== padC.standAt.x || t.z !== padC.standAt.z) return t;
        return keypad(g, padC, useKeypadC, claim);
      }
      if (p.z > -108.6 && p.x > 3) return p.x < 8.2 ? { x: 8.7, z: p.z } : { x: 8.7, z: -109.8 };    // round the keypad pillar and the desk
      if (gate.t < 1 && p.z < -109) return { wait: true, x: 0, z: WD - 2 };
      if (p.z > WD + 0.4) return Math.abs(p.x) > 1.0 ? { x: 0, z: -110.4 } : { x: 0, z: WD - 1.6 };
      if (p.z > -115.5 && p.x < 3.5) return { x: 4.5, z: -116.4 };
      return { x: goal.x, z: goal.z };
    };
  },
};

// =========================================================================================================
//  Pieces
// =========================================================================================================
// a solid suitcase: a leather slab with a handle and two brass latches. `y` = surface it stands on.
function suitcase(w, x, z, color, y = 0, s = 1) {
  const body = w.plat({ x, y: y + 0.62 * s, z, w: 0.95 * s, d: 0.55 * s, h: 0.62 * s, tex: 'leather', color, roughness: 0.55, radius: 0.08 });
  w.box({ x, y: y + 0.62 * s + 0.05, z: z + 0.28 * s, w: 0.3 * s, h: 0.06, d: 0.04, color: 0x1a1a1a, rough: 0.5, shadow: false });
  for (const sx of [-1, 1]) w.box({ x: x + sx * 0.28 * s, y: y + 0.4 * s, z: z + 0.28 * s + 0.01, w: 0.1 * s, h: 0.1 * s, d: 0.03, color: GOLD, metal: 1, rough: 0.3, shadow: false });
  w.box({ x, y: y + 0.32 * s, z: z + 0.28 * s + 0.005, w: 0.95 * s, h: 0.05, d: 0.02, color: 0x000000, rough: 0.8, shadow: false });
  return body;
}

// a (non-solid) suitcase you can carry: front = +z local. Options: a luggage tag with a number, a duck sticker, a stencilled number on the back.
function bagMesh({ color, s = 1, tag = null, duck = false, back = null, front = false }) {
  const g = new THREE.Group();
  const W = 0.95 * s, Hh = 0.62 * s, D = 0.4 * s;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, D), surfaceMaterial({ tex: 'leather', color, roughness: 0.55 }));
  body.position.y = Hh / 2; body.castShadow = true; g.add(body);
  const dark = plainMaterial(0x15151a, { roughness: 0.5 }), brass = plainMaterial(GOLD, { metalness: 1, roughness: 0.3 });
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.06, 0.06), dark); handle.position.set(0, Hh + 0.04, 0); g.add(handle);
  for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.08 * s, 0.02), brass); l.position.set(sx * 0.28 * s, Hh * 0.75, D / 2 + 0.01); g.add(l); }
  const plane = (wd, ht, draw, z, ry) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * ht / wd); const x = c.getContext('2d'); draw(x, c.width, c.height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, transparent: true }));
    m.position.set(0, Hh / 2, z); m.rotation.y = ry; g.add(m); return m;
  };
  const duckDraw = (x, cx, cy, r) => {
    x.fillStyle = '#ffd21f'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    x.fillStyle = '#ff8a1f'; x.beginPath(); x.moveTo(cx + r * 0.55, cy - r * 0.1); x.lineTo(cx + r * 1.05, cy + r * 0.02); x.lineTo(cx + r * 0.55, cy + r * 0.2); x.fill();
    x.fillStyle = '#111'; x.beginPath(); x.arc(cx + r * 0.25, cy - r * 0.3, r * 0.12, 0, 7); x.fill();
  };
  if (back || duck) {
    plane(W * 0.92, Hh * 0.86, (x, cw, ch) => {
      x.clearRect(0, 0, cw, ch);
      if (back) { x.fillStyle = 'rgba(255,255,255,0.92)'; x.font = `700 ${Math.round(ch * 0.46)}px "Archivo Black", Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(back, cw / 2, ch * 0.56); x.font = `700 ${Math.round(ch * 0.13)}px Arial, sans-serif`; x.fillText('CLAIM No.', cw / 2, ch * 0.2); }
      if (duck) duckDraw(x, cw * 0.88, ch * 0.18, ch * 0.13);
    }, -D / 2 - 0.006, Math.PI);
  }
  if (duck && front) plane(0.24 * s, 0.24 * s, (x, cw, ch) => { x.clearRect(0, 0, cw, ch); duckDraw(x, cw * 0.45, ch / 2, cw * 0.36); }, D / 2 + 0.006, 0).position.set(-0.22 * s, Hh * 0.45, D / 2 + 0.006);
  if (tag) {
    const tg = plane(0.34, 0.5, (x, cw, ch) => {
      x.fillStyle = '#f6efd8'; x.fillRect(0, 0, cw, ch); x.strokeStyle = '#7a5a1c'; x.lineWidth = 6; x.strokeRect(3, 3, cw - 6, ch - 6);
      x.fillStyle = '#7a1f2a'; x.font = '700 30px Arial, sans-serif'; x.textAlign = 'center'; x.fillText(tag.length > 1 ? 'CLAIM' : 'TAG', cw / 2, 46);
      x.fillStyle = '#1a1a22'; x.font = `700 ${tag.length > 1 ? 74 : 230}px "Archivo Black", Impact, sans-serif`; x.textBaseline = 'middle'; x.fillText(tag, cw / 2, ch * 0.6);
    }, D / 2 + 0.03, 0);
    tg.position.set(0.18 * s, Hh * 0.5, D / 2 + 0.03);
  }
  return g;
}

// "LOST & FOUND · CLAIM CODE" with four coloured dots, in the order the digits go
function poster(w, order, x, y, z) {
  canvasPlane(w, {
    x, y, z, width: 4.2, height: 2.8, px: 768, draw: (g) => {
      g.fillStyle = '#f3e9d2'; g.fillRect(0, 0, 768, 512);
      g.strokeStyle = '#7a5a1c'; g.lineWidth = 10; g.strokeRect(14, 14, 740, 484);
      g.fillStyle = '#7a1f2a'; g.textAlign = 'center';
      g.font = '64px "Archivo Black", Impact, sans-serif'; g.fillText('LOST & FOUND', 384, 100);
      g.fillStyle = '#2a2430'; g.font = '34px "Archivo Black", Impact, sans-serif'; g.fillText('CLAIM CODE = HOW MANY', 384, 160);
      g.font = '28px "Archivo Black", Impact, sans-serif'; g.fillText('CASES OF EACH COLOUR, IN ORDER:', 384, 200);
      order.forEach((col, i) => {
        const cx = 130 + i * 168;
        g.fillStyle = col.css; g.beginPath(); g.arc(cx, 320, 54, 0, 7); g.fill();
        g.strokeStyle = '#2a2430'; g.lineWidth = 5; g.stroke();
        g.fillStyle = '#2a2430'; g.font = '40px "Archivo Black", Impact, sans-serif'; g.fillText(`${i + 1}`, cx, 424);
      });
      g.fillStyle = '#7a5a1c'; g.font = '22px "Archivo Black", Impact, sans-serif'; g.fillText('(the host says it is 1337. the host says a lot)', 384, 474);
    },
  });
  w.box({ x, y, z: z - 0.05, w: 4.5, h: 3.1, d: 0.06, color: GOLD, metal: 1, rough: 0.35, shadow: false });
}

function weighPoster(w, x, y, z) {
  canvasPlane(w, {
    x, y, z, width: 4.4, height: 2.6, px: 768, draw: (g, cw, ch) => {
      g.fillStyle = '#1c2230'; g.fillRect(0, 0, cw, ch);
      g.strokeStyle = '#ffd21f'; g.lineWidth = 12; g.strokeRect(10, 10, cw - 20, ch - 20);
      g.fillStyle = '#ffd21f'; g.textAlign = 'center'; g.font = '58px "Archivo Black", Impact, sans-serif'; g.fillText('HOLD BAGGAGE', cw / 2, 92);
      g.fillStyle = '#ffffff'; g.font = '34px "Archivo Black", Impact, sans-serif';
      g.fillText('RELEASE CODE = THE TAG NUMBERS,', cw / 2, 170);
      g.fillText('HEAVIEST CASE FIRST', cw / 2, 216);
      g.fillStyle = '#9fb2c8'; g.font = '28px "Archivo Black", Impact, sans-serif'; g.fillText('weigh every case on the scale ▸', cw / 2, 300);
      g.fillText('size is not weight. ask any suitcase.', cw / 2, 344);
      g.fillStyle = '#ffd21f'; for (let i = 0; i < 12; i++) { g.fillRect(40 + i * 60, ch - 60, 30, 26); }
    },
  });
  w.box({ x, y, z: z - 0.05, w: 4.6, h: 2.8, d: 0.06, color: 0x30343c, metal: 0.6, rough: 0.4, shadow: false });
}

function drawReport(g, cw, ch) {
  g.fillStyle = '#f6f1e2'; g.fillRect(0, 0, cw, ch);
  g.fillStyle = '#5a3a1a'; g.fillRect(cw * 0.35, 0, cw * 0.3, 26);
  g.fillStyle = '#7a1f2a'; g.font = '700 30px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('LOST BAGGAGE', cw / 2, 66); g.fillText('REPORT No. 404', cw / 2, 100);
  g.fillStyle = '#222'; g.font = '22px Arial, sans-serif'; g.textAlign = 'left';
  const L = ['Guest: you (probably)', 'Item: PURPLE case,', '  yellow DUCK sticker', 'Carousel 13', 'Claim number is', 'stencilled on the', 'BACK of the case.', 'Tags are decorative.'];
  L.forEach((l, i) => g.fillText(l, 22, 150 + i * 36));
  g.strokeStyle = '#7a1f2a'; g.lineWidth = 3; g.strokeRect(14, 360, cw - 28, 112);
}

// a wire-mesh cage wall (transparent canvas)
function wireMesh(w, x, z, len, h, side) {
  canvasPlane(w, {
    x, y: h / 2, z, width: len, height: h, rotY: -side * Math.PI / 2, px: 1024, transparent: true, double: true, basic: true, draw: (g, cw, ch) => {
      g.clearRect(0, 0, cw, ch); g.strokeStyle = 'rgba(190,198,210,0.75)'; g.lineWidth = 1.6;
      const s = 18;
      for (let i = -ch; i < cw + ch; i += s) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + ch, ch); g.stroke(); g.beginPath(); g.moveTo(i + ch, 0); g.lineTo(i, ch); g.stroke(); }
      g.fillStyle = 'rgba(120,128,140,0.95)'; g.fillRect(0, 0, cw, 8); g.fillRect(0, ch - 8, cw, 8);
      for (let x = 0; x < cw; x += cw / 8) g.fillRect(x, 0, 6, ch);
    },
  });
}

// odd things on the lost property shelves (the shelf top is at y)
function lostItem(w, x, y, z, k) {
  const kind = k % 6;
  const add = (geo, col, dx, dy, dz, rz = 0) => { const m = new THREE.Mesh(geo, plainMaterial(col, { roughness: 0.6 })); m.position.set(x + dx, y + dy, z + dz); m.rotation.z = rz; m.castShadow = true; w.add(m); return m; };
  if (kind === 0) { add(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), 0x222222, 0, 0.45, 0, 0.3); add(new THREE.ConeGeometry(0.35, 0.3, 8), 0x2a4a8a, -0.14, 0.86, 0, 0.3); }   // umbrella
  else if (kind === 1) { add(new THREE.SphereGeometry(0.28, 12, 10), 0x9a6a3a, 0, 0.28, 0); add(new THREE.SphereGeometry(0.17, 10, 8), 0x9a6a3a, 0, 0.66, 0); for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.07, 8, 6), 0x7a4a2a, 0, 0.8, s * 0.12); }   // teddy
  else if (kind === 2) { add(new THREE.TorusGeometry(0.28, 0.08, 8, 18), GOLD, 0, 0.42, 0); add(new THREE.CylinderGeometry(0.06, 0.2, 0.5, 10), GOLD, 0, 0.3, 0.2); }   // a tuba (roughly)
  else if (kind === 3) { add(new THREE.BoxGeometry(0.5, 0.35, 0.6), 0x3a2a4a, 0, 0.18, 0); add(new THREE.BoxGeometry(0.4, 0.3, 0.5), 0x7a2a2a, 0, 0.5, 0); }   // boxes
  else if (kind === 4) { add(new THREE.ConeGeometry(0.3, 0.3, 16), 0x2a2a2a, 0, 0.15, 0); add(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 18), 0x2a2a2a, 0, 0.02, 0); }   // a hat
  else { add(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 10), 0x4a8a5a, 0, 0.35, 0); add(new THREE.SphereGeometry(0.16, 10, 8), 0xf0f0f0, 0, 0.78, 0); }   // a bottle with a ball on top (why)
}

// Carousel 13: a stadium-shaped belt around a steel island, with colliders
function carousel(w, C) {
  const shape = (r) => { const s = new THREE.Shape(); s.moveTo(r, C.L / 2); s.lineTo(r, -C.L / 2); s.absarc(0, -C.L / 2, r, 0, -Math.PI, true); s.lineTo(-r, C.L / 2); s.absarc(0, C.L / 2, r, Math.PI, 0, true); return s; };
  const outer = shape(C.R + 0.75), hole = shape(C.R - 0.6);
  outer.holes.push(hole);
  const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.55, bevelEnabled: false, curveSegments: 24 }), plainMaterial(0x30343c, { metalness: 0.6, roughness: 0.35 }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(C.x, 0, C.z); w.add(ring);
  const islandShape = shape(C.R - 0.6);
  const island = new THREE.Mesh(new THREE.ExtrudeGeometry(islandShape, { depth: 0.72, bevelEnabled: false, curveSegments: 24 }), plainMaterial(0x9aa2ae, { metalness: 0.7, roughness: 0.3 }));
  island.rotation.x = -Math.PI / 2; island.position.set(C.x, 0, C.z); w.add(island);
  const lip = new THREE.Mesh(new THREE.ExtrudeGeometry((() => { const o = shape(C.R + 0.85); o.holes.push(shape(C.R + 0.7)); return o; })(), { depth: 0.66, bevelEnabled: false, curveSegments: 24 }), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 }));
  lip.rotation.x = -Math.PI / 2; lip.position.set(C.x, 0, C.z); w.add(lip);
  // colliders (a straight middle and stepped round ends)
  const R = C.R + 0.85;
  w.collider({ x: C.x, y: 1.0, z: C.z, w: 2 * R, h: 2.0, d: C.L });   // (taller than it looks: nobody rides the carousel)
  for (const s of [-1, 1]) {
    w.collider({ x: C.x, y: 1.0, z: C.z + s * (C.L / 2 + 0.8), w: 2 * R * 0.94, h: 2.0, d: 1.6 });
    w.collider({ x: C.x, y: 1.0, z: C.z + s * (C.L / 2 + 2.25), w: 2 * R * 0.7, h: 2.0, d: 1.3 });
    w.collider({ x: C.x, y: 1.0, z: C.z + s * (C.L / 2 + 3.4), w: 2 * R * 0.36, h: 2.0, d: 1.0 });
  }
}
